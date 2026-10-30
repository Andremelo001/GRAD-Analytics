import json
import re
import unicodedata
from dataclasses import dataclass

import pandas as pd

_CATALOG_COLUMNS = [
    "codigo_curso",
    "nome_curso",
    "grau_academico",
    "modalidade_ensino",
    "prazo_integralizacao",
]
_LOWERCASE_WORDS = {"de", "da", "do", "das", "dos", "e"}


@dataclass(frozen=True, slots=True)
class Campus:
    """Uma cidade da IES: o recorte (IES + município) de um arquivo do dashboard.

    ``nome`` é o rótulo exibido no front (``escopo.municipio``, ex.: "UFC em
    Quixadá" — a cidade, não um campus: Fortaleza junta vários); ``slug`` é o
    nome do arquivo (``quixada`` -> ``quixada.json``).
    """

    codigo_ies: int
    codigo_municipio: int
    nome: str
    slug: str


@dataclass(frozen=True, slots=True)
class ScopedData:
    """Os dois datasets nacionais já recortados para o escopo do dashboard."""

    qualidade: pd.DataFrame
    trajetoria: pd.DataFrame
    cursos: pd.DataFrame


def discover_campi(
    qualidade: pd.DataFrame, trajetoria: pd.DataFrame, codigo_ies: int
) -> list[Campus]:
    """Todos os campi da IES: cada município onde ela tem curso na trajetória.

    A trajetória decide quem é campus (tem curso com turma acompanhada); só
    aparecer na qualidade não basta — é o caso de polo EaD com um curso
    avaliado uma vez. O nome do município vem da qualidade (a trajetória só
    tem o código); sem ele, o campus é identificado pelo código.
    """
    if trajetoria.empty:
        return []
    municipios = (
        trajetoria.loc[trajetoria["codigo_ies"] == codigo_ies, "codigo_municipio"]
        .dropna()
        .astype(int)
        .unique()
    )
    da_ies = (
        qualidade[qualidade["codigo_ies"] == codigo_ies]
        if not qualidade.empty
        else qualidade
    )
    sigla = _most_common(da_ies, "sigla_ies")
    campi = []
    for codigo in sorted(municipios):
        nome_municipio = _municipio_nome(da_ies, int(codigo))
        rotulo = nome_municipio or str(codigo)
        campi.append(
            Campus(
                codigo_ies=codigo_ies,
                codigo_municipio=int(codigo),
                nome=f"{sigla} em {rotulo}" if sigla else rotulo,
                slug=slugify(rotulo),
            )
        )
    return campi


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
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, campus: Campus
) -> ScopedData:
    """Filtra os dois datasets para um campus e monta o catálogo de cursos."""
    qualidade = _filter_scope(qualidade_raw, campus)
    trajetoria = _filter_scope(trajetoria_raw, campus)
    cursos = _course_catalog(trajetoria, qualidade)
    qualidade = with_course_name(qualidade, cursos)
    return ScopedData(qualidade=qualidade, trajetoria=trajetoria, cursos=cursos)


def _filter_scope(frame: pd.DataFrame, campus: Campus) -> pd.DataFrame:
    if frame.empty:
        return frame
    mask = (frame["codigo_ies"] == campus.codigo_ies) & (
        frame["codigo_municipio"] == campus.codigo_municipio
    )
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
    qualidade: pd.DataFrame, trajetoria: pd.DataFrame, campus: Campus
) -> dict[str, object]:
    nome_ies = None
    sigla_ies = None
    if not qualidade.empty:
        nome_ies = qualidade["nome_ies"].iloc[0]
        sigla_ies = qualidade["sigla_ies"].iloc[0]
    elif not trajetoria.empty:
        nome_ies = trajetoria["nome_ies"].iloc[0]
    return {
        "codigo_ies": campus.codigo_ies,
        "nome_ies": nome_ies,
        "sigla_ies": sigla_ies,
        "codigo_municipio": campus.codigo_municipio,
        "municipio": campus.nome,
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
