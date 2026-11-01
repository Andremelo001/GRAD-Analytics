import json
import math
import re
import unicodedata
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, replace

import pandas as pd

from app.modules.dashboard.domain.unidade_mapping import (
    AjustesUnidades,
    CursoInep,
    UnidadeSigaa,
    is_ead,
    match_unidade,
)

_CATALOG_COLUMNS = [
    "codigo_curso",
    "nome_curso",
    "grau_academico",
    "modalidade_ensino",
    "prazo_integralizacao",
]
_LOWERCASE_WORDS = {"de", "da", "do", "das", "dos", "e"}


@dataclass(frozen=True, slots=True)
class Unidade:
    """Uma unidade da IES: o recorte de um arquivo do dashboard.

    Com a lista do SIGAA (``unidades_ufc.json``), é um centro, faculdade,
    instituto ou campus do interior: ``nome`` é o rótulo do SIGAA ("CCA -
    CENTRO DE CIÊNCIAS AGRÁRIAS"), ``sigla`` a sigla ("CCA") e
    ``codigos_curso`` os cursos casados com ela. Sem unidade no SIGAA, o
    recorte é a cidade (``sigla=None``, ``nome`` "UFC em Fortaleza",
    ``codigos_curso=None``: todos os cursos do município).

    ``localidade``: o município ("Fortaleza"); ``municipio``: a cidade como
    o front a escreve no mapa ("UFC em Fortaleza"); ``codigo_municipio``: o
    município principal; ``municipios``: todos os dos cursos do recorte
    (vazio = só ``codigo_municipio``). ``slug`` é o nome do arquivo.
    """

    codigo_ies: int
    codigo_municipio: int
    nome: str
    slug: str
    sigla: str | None = None
    localidade: str | None = None
    municipio: str | None = None
    codigos_curso: frozenset[int] | None = None
    municipios: frozenset[int] = frozenset()


@dataclass(frozen=True, slots=True)
class ScopedData:
    """Os dois datasets nacionais já recortados para o escopo do dashboard."""

    qualidade: pd.DataFrame
    trajetoria: pd.DataFrame
    cursos: pd.DataFrame


def discover_unidades(
    qualidade: pd.DataFrame,
    trajetoria: pd.DataFrame,
    codigo_ies: int,
    unidades_sigaa: Sequence[UnidadeSigaa] = (),
    ajustes: AjustesUnidades | None = None,
) -> list[Unidade]:
    """Todas as unidades da IES, a partir dos cursos de cada município.

    A trajetória decide os municípios (tem curso com turma acompanhada); só
    aparecer na qualidade não basta — é o caso de polo EaD com um curso
    avaliado uma vez. Os cursos desses municípios (da trajetória e da
    qualidade) vão para a unidade do SIGAA com que casam
    (``unidade_mapping.match_unidade``); o que não casa — ou tudo, sem
    ``unidades_sigaa`` — fica num recorte da cidade, como "UFC em Fortaleza".
    Ordem: por município (o código do IBGE segue a ordem alfabética) e, no
    mesmo município, pelo rótulo, com o recorte da cidade por último.
    """
    if trajetoria.empty:
        return []
    ajustes = ajustes if ajustes is not None else AjustesUnidades()
    trajetoria_ies = trajetoria.loc[trajetoria["codigo_ies"] == codigo_ies]
    municipios = set(trajetoria_ies["codigo_municipio"].dropna().astype(int))
    da_ies = (
        qualidade[qualidade["codigo_ies"] == codigo_ies]
        if not qualidade.empty
        else qualidade
    )
    sigla_ies = _most_common(da_ies, "sigla_ies")
    nomes = {codigo: _municipio_nome(da_ies, codigo) for codigo in municipios}

    grupos: dict[str | int, list[tuple[int, int]]] = {}
    for sem_municipio, codigo_municipio in _cursos_inep(
        da_ies, trajetoria_ies, municipios
    ):
        curso = replace(sem_municipio, municipio=nomes[codigo_municipio])
        sigla = (
            match_unidade(curso, unidades_sigaa, ajustes) if unidades_sigaa else None
        )
        chave: str | int = sigla if sigla is not None else codigo_municipio
        grupos.setdefault(chave, []).append((curso.codigo_curso, codigo_municipio))
    # município sem curso nenhum identificado (dados antigos, sem nome de
    # curso): ainda vira o recorte da cidade, como antes
    for codigo in municipios - {m for cursos in grupos.values() for _, m in cursos}:
        grupos[codigo] = []

    rotulos = {c.sigla: c.rotulo for c in unidades_sigaa}
    unidades = []
    for chave, cursos in grupos.items():
        do_grupo = [m for _, m in cursos]
        principal = Counter(do_grupo).most_common(1)[0][0] if do_grupo else int(chave)
        localidade = nomes[principal] or str(principal)
        cidade = f"{sigla_ies} em {localidade}" if sigla_ies else localidade
        sigla = chave if isinstance(chave, str) else None
        por_curso = bool(cursos) and (sigla is not None or bool(unidades_sigaa))
        unidades.append(
            Unidade(
                codigo_ies=codigo_ies,
                codigo_municipio=principal,
                nome=rotulos[sigla] if sigla is not None else cidade,
                slug=slugify(sigla if sigla is not None else localidade),
                sigla=sigla,
                localidade=localidade,
                municipio=cidade,
                # recorte da cidade ao lado de unidades do SIGAA: só os cursos
                # que não casaram (senão repetiria os do município inteiro)
                codigos_curso=(frozenset(c for c, _ in cursos) if por_curso else None),
                municipios=frozenset(do_grupo) if por_curso else frozenset(),
            )
        )
    return sorted(unidades, key=lambda c: (c.codigo_municipio, c.sigla is None, c.nome))


def _cursos_inep(
    qualidade_ies: pd.DataFrame, trajetoria_ies: pd.DataFrame, municipios: set[int]
) -> list[tuple[CursoInep, int]]:
    """Os cursos da IES nos municípios das unidades, com o que o casamento usa.

    Nome, modalidade e grau vêm da trajetória (turma mais recente); curso só
    da qualidade usa a área de avaliação como nome ("QUÍMICA (LICENCIATURA)").
    Curso sem município (EaD na trajetória) fica de fora, como no recorte.
    """
    partes = []
    for frame, nome, modalidade, grau, ordem in (
        (
            trajetoria_ies,
            "nome_curso",
            "tp_modalidade_ensino_desc",
            "tp_grau_academico_desc",
            "ano_ingresso",
        ),
        (qualidade_ies, "area_avaliacao", "modalidade_ensino", None, "ano"),
    ):
        if frame.empty or "codigo_curso" not in frame.columns:
            continue
        validos = frame.dropna(subset=["codigo_municipio"])
        if ordem in validos.columns:
            validos = validos.sort_values(ordem)
        validos = validos.drop_duplicates("codigo_curso", keep="last")
        partes.append(
            pd.DataFrame(
                {
                    "codigo_curso": validos["codigo_curso"].astype(int),
                    "codigo_municipio": validos["codigo_municipio"].astype(int),
                    "nome": _coluna(validos, nome),
                    "modalidade": _coluna(validos, modalidade),
                    "grau": _coluna(validos, grau),
                }
            )
        )
    if not partes:
        return []
    cursos = pd.concat(partes, ignore_index=True).drop_duplicates(
        "codigo_curso", keep="first"
    )
    cursos = cursos[cursos["codigo_municipio"].isin(municipios)]
    return [
        (
            CursoInep(
                codigo_curso=int(row.codigo_curso),
                nome=_texto(row.nome) or "",
                municipio=None,
                ead=(
                    None
                    if _texto(row.modalidade) is None
                    else is_ead(str(row.modalidade))
                ),
                grau=_texto(row.grau),
            ),
            int(row.codigo_municipio),
        )
        for row in cursos.sort_values("codigo_curso").itertuples(index=False)
    ]


def _coluna(frame: pd.DataFrame, coluna: str | None) -> pd.Series:
    if coluna is None or coluna not in frame.columns:
        return pd.Series([None] * len(frame), index=frame.index, dtype=object)
    return frame[coluna]


def _texto(valor: object) -> str | None:
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return None
    texto = str(valor).strip()
    return texto or None


def _municipio_nome(qualidade: pd.DataFrame, codigo_municipio: int) -> str | None:
    """Nome do município em caixa de título ("FORTALEZA" -> "Fortaleza").

    O INEP grafa o mesmo município em caixa alta em uns anos e não em outros;
    vale a grafia mais frequente.
    """
    if qualidade.empty or "municipio_curso" not in qualidade.columns:
        return None
    nome = _most_common(
        qualidade[qualidade["codigo_municipio"] == codigo_municipio],
        "municipio_curso",
    )
    return None if nome is None else _title_case(nome)


def _most_common(frame: pd.DataFrame, column: str) -> str | None:
    if frame.empty or column not in frame.columns:
        return None
    values = frame[column].dropna().astype(str).str.strip()
    values = values[values != ""]
    return None if values.empty else str(values.value_counts().index[0])


def _title_case(text: str) -> str:
    words = text.lower().split()
    return " ".join(
        word if index > 0 and word in _LOWERCASE_WORDS else word.capitalize()
        for index, word in enumerate(words)
    )


def slugify(text: str) -> str:
    """Nome -> slug de arquivo: "Juazeiro do Norte" -> "juazeiro-do-norte".

    Sem acentos e minúsculo ("Crateús" -> "crateus").
    """
    ascii_text = (
        unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode("ascii")
    )
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def build_scoped_data(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, unidade: Unidade
) -> ScopedData:
    """Filtra os dois datasets para uma unidade e monta o catálogo de cursos."""
    qualidade = _filter_scope(qualidade_raw, unidade)
    trajetoria = _filter_scope(trajetoria_raw, unidade)
    cursos = _course_catalog(trajetoria, qualidade)
    qualidade = with_course_name(qualidade, cursos)
    return ScopedData(qualidade=qualidade, trajetoria=trajetoria, cursos=cursos)


def _filter_scope(frame: pd.DataFrame, unidade: Unidade) -> pd.DataFrame:
    """Linhas da IES nos municípios da unidade e, se houver, só dos cursos dela.

    O município entra mesmo com a lista de cursos: o mesmo curso EaD aparece
    sem município na trajetória e num polo na qualidade, e o recorte é o da
    sede.
    """
    if frame.empty:
        return frame
    municipios = unidade.municipios or {unidade.codigo_municipio}
    mask = (frame["codigo_ies"] == unidade.codigo_ies) & frame["codigo_municipio"].isin(
        municipios
    )
    if unidade.codigos_curso is not None:
        mask &= frame["codigo_curso"].isin(unidade.codigos_curso)
    return frame.loc[mask].reset_index(drop=True)


def _course_catalog(trajetoria: pd.DataFrame, qualidade: pd.DataFrame) -> pd.DataFrame:
    from_trajetoria = pd.DataFrame(columns=_CATALOG_COLUMNS)
    if not trajetoria.empty:
        from_trajetoria = (
            trajetoria[
                [
                    "codigo_curso",
                    "nome_curso",
                    "tp_grau_academico_desc",
                    "tp_modalidade_ensino_desc",
                ]
            ]
            .drop_duplicates("codigo_curso")
            .rename(
                columns={
                    "tp_grau_academico_desc": "grau_academico",
                    "tp_modalidade_ensino_desc": "modalidade_ensino",
                }
            )
        )
        from_trajetoria["prazo_integralizacao"] = from_trajetoria["codigo_curso"].map(
            _prazo_mais_recente(trajetoria)
        )

    known = set(from_trajetoria["codigo_curso"]) if not from_trajetoria.empty else set()
    extra = pd.DataFrame(columns=_CATALOG_COLUMNS)
    if not qualidade.empty:
        only_qualidade = qualidade.loc[
            ~qualidade["codigo_curso"].isin(known), ["codigo_curso", "area_avaliacao"]
        ]
        only_qualidade = only_qualidade.drop_duplicates("codigo_curso").rename(
            columns={"area_avaliacao": "nome_curso"}
        )
        only_qualidade["grau_academico"] = None
        only_qualidade["modalidade_ensino"] = None
        only_qualidade["prazo_integralizacao"] = None
        extra = only_qualidade[_CATALOG_COLUMNS]

    catalog = pd.concat([from_trajetoria, extra], ignore_index=True)
    return catalog.sort_values("codigo_curso").reset_index(drop=True)


def _prazo_mais_recente(trajetoria: pd.DataFrame) -> dict[object, int | None]:
    """Duração prevista (anos) de cada curso, na turma mais recente.

    O prazo pode mudar entre turmas (mudança de currículo); vale o da última.
    Sem a coluna (dados antigos), ``None``.
    """
    if "prazo_integralizacao" not in trajetoria.columns:
        return {}
    validos = trajetoria.dropna(subset=["prazo_integralizacao"])
    if validos.empty:
        return {}
    ultima = validos.sort_values("ano_ingresso").groupby("codigo_curso").tail(1)
    return {
        codigo: int(prazo)
        for codigo, prazo in zip(
            ultima["codigo_curso"], ultima["prazo_integralizacao"], strict=True
        )
    }


def with_course_name(frame: pd.DataFrame, cursos: pd.DataFrame) -> pd.DataFrame:
    """Anexa ``nome_curso`` a um frame que só tem ``codigo_curso`` (ex.: qualidade)."""
    if frame.empty or "nome_curso" in frame.columns:
        return frame
    lookup = cursos.set_index("codigo_curso")["nome_curso"]
    out = frame.copy()
    out["nome_curso"] = out["codigo_curso"].map(lookup)
    return out


def build_escopo(
    qualidade: pd.DataFrame, trajetoria: pd.DataFrame, unidade: Unidade
) -> dict[str, object]:
    nome_ies = None
    sigla_ies = None
    if not qualidade.empty:
        nome_ies = qualidade["nome_ies"].iloc[0]
        sigla_ies = qualidade["sigla_ies"].iloc[0]
    elif not trajetoria.empty:
        nome_ies = trajetoria["nome_ies"].iloc[0]
    return {
        "codigo_ies": unidade.codigo_ies,
        "nome_ies": nome_ies,
        "sigla_ies": sigla_ies,
        "slug": unidade.slug,
        "unidade": unidade.nome,
        "sigla_unidade": unidade.sigla,
        "localidade": unidade.localidade,
        "codigo_municipio": unidade.codigo_municipio,
        "municipio": unidade.municipio or unidade.nome,
    }


def records(frame: pd.DataFrame) -> list[dict[str, object]]:
    """Converte um DataFrame em lista de dicts JSON-seguros.

    ``NaN``/``NaT`` viram ``null`` e tipos numpy viram tipos nativos.
    """
    if frame is None or frame.empty:
        return []
    return json.loads(frame.to_json(orient="records"))


def scalar(row: pd.Series | None, column: str) -> object:
    """Extrai um valor escalar de uma linha, já convertido pra tipo nativo.

    Retorna ``None`` se a linha for ``None`` ou o valor for nulo.
    """
    if row is None or column not in row or pd.isna(row[column]):
        return None
    value = row[column]
    return value.item() if hasattr(value, "item") else value
