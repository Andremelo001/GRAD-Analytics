import math

import pandas as pd

from app.modules.dashboard.domain.services import course_profile
from app.modules.dashboard.domain.shared import ScopedData, slugify

# Colunas de cada linha de ``cursos`` no JSON de uma área (formato colunar:
# uma lista por curso, na ordem de ``COLUNAS`` — com ~1.800 cursos numa área
# grande, repetir os nomes dos campos em cada linha triplicaria o arquivo).
COLUNAS: tuple[str, ...] = (
    "codigo_curso",
    "codigo_ies",
    "codigo_municipio",
    "ead",
    "cpc_continuo",
    "cpc_faixa",
    *course_profile.RADAR_FIELDS,
    # todas as edições do curso, cada uma uma lista na ordem de COLUNAS_EDICAO
    "historico",
)

# Cada edição na coluna ``historico`` de um curso (lista na mesma ordem).
COLUNAS_EDICAO: tuple[str, ...] = (
    "ano",
    "cpc_continuo",
    "cpc_faixa",
    "n_concluintes_inscritos",
    "n_concluintes_participantes",
)

_PRIVADA = ("privad", "comunit")
_PUBLICA = ("públic", "federal", "estadual", "municipal", "especial")


def areas_dos_campi(campi: list[ScopedData]) -> list[str]:
    """Áreas de avaliação da avaliação mais recente de cada curso dos campi.

    São as áreas que o front precisa pro mapa (o curso escolhido entra pela
    área da sua avaliação mais recente) — um arquivo por área, compartilhado
    por todos os campi.
    """
    areas: set[str] = set()
    for data in campi:
        if data.qualidade.empty:
            continue
        idx = data.qualidade.groupby("codigo_curso")["ano"].idxmax()
        areas.update(data.qualidade.loc[idx, "area_avaliacao"].dropna().astype(str))
    return sorted(areas)


def area_slug(area: str) -> str:
    """Nome do arquivo da área, sem acentos e minúsculo (como o dos campi).

    "CIÊNCIA DA COMPUTAÇÃO (BACHARELADO)" -> "ciencia-da-computacao-bacharelado".
    """
    return slugify(area)


def build_area(
    qualidade_nacional: pd.DataFrame, area: str, codigo_ies_destaque: int
) -> dict[str, object] | None:
    """Todos os cursos do Brasil na edição mais recente de uma área.

    Um curso por linha (CPC, faixa e as 9 notas padronizadas), com o código
    da IES e do município apontando pros dicionários ``ies`` e
    ``municipios`` — o front agrega por estado/município, filtra por rede
    (pública/privada) e modalidade e calcula percentis a partir disso. A
    coluna ``historico`` traz todas as edições do curso (``colunas_edicao``:
    ano, CPC, faixa, concluintes inscritos e participantes), pra comparar
    cursos ano a ano.
    ``None`` se a área não tem curso no dataset nacional.
    """
    pares = qualidade_nacional[qualidade_nacional["area_avaliacao"] == area]
    if pares.empty:
        return None
    ano = int(pares["ano"].max())
    edicao = pares[pares["ano"] == ano].drop_duplicates("codigo_curso")
    edicao = edicao.sort_values("codigo_curso")

    ies = {
        str(int(codigo)): [
            texto_mais_comum(grupo, "nome_ies"),
            texto_mais_comum(grupo, "sigla_ies"),
            rede_publica(texto_mais_comum(grupo, "categoria_administrativa")),
        ]
        for codigo, grupo in edicao.groupby("codigo_ies")
    }
    municipios = {
        str(int(codigo)): [
            texto_mais_comum(grupo, "municipio_curso"),
            texto_mais_comum(grupo, "sigla_uf"),
        ]
        for codigo, grupo in edicao.groupby("codigo_municipio")
    }
    # todas as edições desses cursos — pelo código, não pelo nome da área, que
    # o INEP às vezes grafa diferente entre edições
    todas = qualidade_nacional[
        qualidade_nacional["codigo_curso"].isin(set(edicao["codigo_curso"]))
    ]
    historicos: dict[int, list[list[object]]] = {}
    for _, linha in (
        todas.drop_duplicates(["codigo_curso", "ano"])
        .sort_values(["codigo_curso", "ano"])
        .iterrows()
    ):
        historicos.setdefault(int(linha["codigo_curso"]), []).append(_edicao(linha))
    cursos = [
        [*_linha(row), historicos.get(int(row["codigo_curso"]), [])]
        for _, row in edicao.iterrows()
    ]

    return {
        "area_avaliacao": area,
        "ano": ano,
        "codigo_ies_destaque": codigo_ies_destaque,
        "colunas": list(COLUNAS),
        "colunas_edicao": list(COLUNAS_EDICAO),
        "cursos": cursos,
        "ies": ies,
        "municipios": municipios,
    }


def _edicao(row: pd.Series) -> list[object]:
    return [
        int(row["ano"]),
        _numero(row.get("cpc_continuo"), 3),
        _faixa(row.get("cpc_faixa")),
        _inteiro(row.get("n_concluintes_inscritos")),
        _inteiro(row.get("n_concluintes_participantes")),
    ]


def _inteiro(value: object) -> int | None:
    numero = _numero(value, 0)
    return None if numero is None else int(numero)


def _linha(row: pd.Series) -> list[object]:
    modalidade = str(row.get("modalidade_ensino") or "")
    valores: list[object] = [
        int(row["codigo_curso"]),
        int(row["codigo_ies"]),
        int(row["codigo_municipio"]),
        "dist" in modalidade.lower(),
        _numero(row.get("cpc_continuo"), 3),
        _faixa(row.get("cpc_faixa")),
    ]
    valores.extend(
        _numero(row.get(coluna), 2) for coluna in course_profile.RADAR_FIELDS.values()
    )
    return valores


def _numero(value: object, casas: int) -> float | None:
    if value is None or isinstance(value, str):
        return None
    numero = float(value)  # type: ignore[arg-type]
    return None if math.isnan(numero) else round(numero, casas)


def _faixa(value: object) -> int | None:
    """Faixa 1-5 do CPC; "SC", "Curso não reconhecido…" e nulo -> None."""
    try:
        faixa = int(float(str(value)))
    except ValueError:
        return None
    return faixa if 1 <= faixa <= 5 else None


def rede_publica(categoria: str | None) -> bool | None:
    """Rede (pública/privada) pela categoria administrativa do INEP.

    A grafia mudou entre edições ("Pública Federal", "Federal", "Pessoa
    Jurídica de Direito Público - Federal"…). Privada é checada antes:
    "Associação de Utilidade Pública" é de direito privado.
    """
    if not categoria:
        return None
    texto = categoria.lower()
    if any(chave in texto for chave in _PRIVADA):
        return False
    if any(chave in texto for chave in _PUBLICA):
        return True
    return None


def texto_mais_comum(frame: pd.DataFrame, column: str) -> str | None:
    if column not in frame.columns:
        return None
    values = frame[column].dropna().astype(str).str.strip()
    values = values[values != ""]
    return None if values.empty else str(values.value_counts().index[0])
