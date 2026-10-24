import numbers
from dataclasses import dataclass, field

import pandas as pd

from app.modules.dashboard.domain.section import DashboardContext
from app.modules.dashboard.domain.services import course_profile
from app.modules.dashboard.domain.shared import ScopedData, records

# Código IBGE da UF (``codigo_uf`` da trajetória) -> sigla (``sigla_uf`` da
# qualidade): as duas fontes identificam o estado de jeitos diferentes.
UF_SIGLAS: dict[int, str] = {
    11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
    21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL",
    28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR",
    42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF",
}  # fmt: skip

_RATE_COLUMNS = (
    "taxa_permanencia",
    "taxa_conclusao_acumulada",
    "taxa_desistencia_acumulada",
)


def build(
    qualidade_nacional: pd.DataFrame,
    trajetoria_nacional: pd.DataFrame,
    data: ScopedData,
) -> dict[str, object]:
    """Médias nacionais por grupo de pares."""
    pares_qualidade = _pares_nacionais(
        qualidade_nacional, data.qualidade, "area_avaliacao"
    )
    pares_trajetoria = _pares_nacionais(
        trajetoria_nacional, data.trajetoria, "nome_cine_area_geral"
    )
    return {
        "evolucao_cpc": _evolucao_cpc_nacional(pares_qualidade),
        "perfil_radar": _perfil_radar_nacional(pares_qualidade, data.qualidade),
        "curva_sobrevivencia": _curva_sobrevivencia_nacional(pares_trajetoria),
        "heatmap_evasao_anual": _heatmap_evasao_nacional(pares_trajetoria),
        "campus": _campus_nacional(pares_qualidade, pares_trajetoria),
        "distribuicao_uf": _distribuicao_uf(
            qualidade_nacional, trajetoria_nacional, data
        ),
        "ingressantes": _ingressantes_nacional(trajetoria_nacional, data),
        "concluintes": _concluintes_nacional(trajetoria_nacional, data),
        "trajetoria_pares": _trajetoria_pares(trajetoria_nacional, data),
    }


def _trajetoria_pares(
    trajetoria_nacional: pd.DataFrame, data: ScopedData
) -> list[dict[str, object]]:
    """Evasão e conclusão dos cursos-pares no Brasil, na turma madura.

    Um item por curso do campus: a turma madura mais recente dele
    (``course_profile.turma_madura``) e, para os pares do Brasil (mesma área
    CINE — o curso em si —, modalidade e grau) com turma no mesmo ano de
    ingresso, a evasão e a conclusão acumuladas no mesmo ponto — ``prazo + 1``
    anos depois do ingresso (dois anos de folga além do prazo). O front põe o
    curso entre os pares (percentil).
    """
    if data.trajetoria.empty or trajetoria_nacional.empty:
        return []
    # o curso em si (ex.: "Ciência da computação"); o ``nome_cine_rotulo`` do
    # INEP é o grupo largo ("Computação e TIC"), que mistura cursos diferentes
    coluna = "nome_cine_area_geral"
    itens: list[dict[str, object]] = []
    for codigo in data.cursos["codigo_curso"]:
        local = _rows_of(data.trajetoria, int(codigo))
        madura = course_profile.turma_madura(local)
        rotulo = _first(local, coluna)
        if madura is None or rotulo is None:
            continue
        ano, prazo = madura
        anos = prazo + course_profile.ANOS_ALEM_DO_PRAZO - 1
        pares = trajetoria_nacional[
            (trajetoria_nacional[coluna] == rotulo)
            & (trajetoria_nacional["ano_ingresso"] == ano)
            & (
                trajetoria_nacional["ano_referencia"]
                - trajetoria_nacional["ano_ingresso"]
                == anos
            )
        ]
        pares = _same_value(pares, local, "tp_modalidade_ensino_desc")
        pares = _same_value(pares, local, "tp_grau_academico_desc")
        pares = pares.drop_duplicates("codigo_curso").dropna(
            subset=["taxa_desistencia_acumulada", "taxa_conclusao_acumulada"]
        )
        if pares.empty:
            continue
        itens.append(
            {
                "codigo_curso": int(codigo),
                "ano_ingresso": ano,
                "anos_desde_ingresso": anos,
                "evasao": [
                    round(float(v), 1) for v in pares["taxa_desistencia_acumulada"]
                ],
                "conclusao": [
                    round(float(v), 1) for v in pares["taxa_conclusao_acumulada"]
                ],
            }
        )
    return itens


def _ingressantes_nacional(
    trajetoria_nacional: pd.DataFrame, data: ScopedData
) -> list[dict[str, object]]:
    """Ingressantes médios por curso-par, por ano de ingresso.

    Um item por (curso do campus, ano): a média de ingressantes dos cursos do
    Brasil com a mesma área CINE (o curso em si, ex.: "Ciência da
    computação" — o rótulo do INEP é um grupo largo, que juntaria cursos de
    tamanhos muito diferentes), modalidade e grau acadêmico.
    """
    if data.trajetoria.empty or trajetoria_nacional.empty:
        return []
    # o curso em si (ex.: "Ciência da computação"); o ``nome_cine_rotulo`` do
    # INEP é o grupo largo ("Computação e TIC"), que mistura cursos diferentes
    coluna = "nome_cine_area_geral"
    # ingressantes de cada turma: uma linha por (curso, ano de ingresso)
    turmas = trajetoria_nacional.drop_duplicates(["codigo_curso", "ano_ingresso"])
    itens: list[dict[str, object]] = []
    for codigo in data.cursos["codigo_curso"]:
        local = _rows_of(data.trajetoria, int(codigo))
        rotulo = _first(local, coluna)
        if rotulo is None:
            continue
        pares = turmas[turmas[coluna] == rotulo]
        pares = _same_value(pares, local, "tp_modalidade_ensino_desc")
        pares = _same_value(pares, local, "tp_grau_academico_desc")
        pares = pares.dropna(subset=["qt_ingressante"])
        for ano, grupo in pares.groupby("ano_ingresso"):
            itens.append(
                {
                    "codigo_curso": int(codigo),
                    "ano_ingresso": int(ano),
                    "qt_ingressante_media_nacional": round(
                        float(grupo["qt_ingressante"].mean()), 1
                    ),
                    "quantidade_cursos_considerados": int(
                        grupo["codigo_curso"].nunique()
                    ),
                }
            )
    return itens


def _concluintes_nacional(
    trajetoria_nacional: pd.DataFrame, data: ScopedData
) -> list[dict[str, object]]:
    """Concluintes médios por curso-par, por ano de referência.

    Um item por (curso do campus, ano): a média de concluintes no ano dos
    cursos do Brasil com a mesma área CINE, modalidade e grau (os mesmos
    pares de ``_ingressantes_nacional``), contando os pares com turma
    acompanhada naquele ano — e só nos anos em que os dados do curso do
    campus estão completos (``course_profile.janela_concluintes``).
    """
    if (
        data.trajetoria.empty
        or trajetoria_nacional.empty
        or "prazo_integralizacao" not in data.cursos
    ):
        return []
    coluna = "nome_cine_area_geral"
    atributos = trajetoria_nacional.drop_duplicates("codigo_curso")
    anual = trajetoria_nacional.groupby(
        ["codigo_curso", "ano_referencia"], as_index=False
    )["qt_concluinte"].sum()
    prazos = dict(
        zip(
            data.cursos["codigo_curso"],
            data.cursos["prazo_integralizacao"],
            strict=True,
        )
    )
    itens: list[dict[str, object]] = []
    for codigo in data.cursos["codigo_curso"]:
        local = _rows_of(data.trajetoria, int(codigo))
        rotulo = _first(local, coluna)
        janela = course_profile.janela_concluintes(
            local["ano_ingresso"] if not local.empty else pd.Series(dtype=float),
            pd.Series([prazos.get(codigo)]),
        )
        if rotulo is None or janela is None:
            continue
        pares = atributos[atributos[coluna] == rotulo]
        pares = _same_value(pares, local, "tp_modalidade_ensino_desc")
        pares = _same_value(pares, local, "tp_grau_academico_desc")
        inicio, fim = janela
        do_ano = anual[
            anual["codigo_curso"].isin(set(pares["codigo_curso"]))
            & (anual["ano_referencia"] >= inicio)
            & (anual["ano_referencia"] <= fim)
        ]
        for ano, grupo in do_ano.groupby("ano_referencia"):
            itens.append(
                {
                    "codigo_curso": int(codigo),
                    "ano_referencia": int(ano),
                    "qt_concluinte_media_nacional": round(
                        float(grupo["qt_concluinte"].mean()), 1
                    ),
                    "quantidade_cursos_considerados": int(
                        grupo["codigo_curso"].nunique()
                    ),
                }
            )
    return itens


def _pares_nacionais(
    nacional: pd.DataFrame, escopo_local: pd.DataFrame, coluna_area: str
) -> pd.DataFrame:
    """Restringe o dataset nacional às áreas que o campus realmente oferece."""
    if nacional.empty or escopo_local.empty or coluna_area not in escopo_local.columns:
        return nacional.iloc[0:0]
    areas = set(escopo_local[coluna_area].dropna().unique())
    return nacional[nacional[coluna_area].isin(areas)]


def _evolucao_cpc_nacional(pares_qualidade: pd.DataFrame) -> list[dict[str, object]]:
    """Contraparte nacional: CPC médio por área de avaliação, por ano."""
    if pares_qualidade.empty:
        return []
    valid = pares_qualidade.dropna(subset=["cpc_continuo"])
    if valid.empty:
        return []
    grouped = valid.groupby(["area_avaliacao", "ano"])["cpc_continuo"].agg(
        ["mean", "count"]
    )
    grouped = grouped.rename(
        columns={
            "mean": "cpc_continuo_medio_nacional",
            "count": "quantidade_cursos_considerados",
        }
    )
    return records(
        grouped.round(2).reset_index().sort_values(["area_avaliacao", "ano"])
    )


def _perfil_radar_nacional(
    pares_qualidade: pd.DataFrame, local_qualidade: pd.DataFrame
) -> list[dict[str, object]]:
    """Contraparte nacional: notas padronizadas médias por área e ano.

    Só os pares (área, ano) em que algum curso do campus foi avaliado: as
    notas são padronizadas dentro de cada edição do Enade, então o curso só
    se compara com a média da mesma área *no mesmo ano* — a edição mais
    recente da área pode ser outra.
    """
    if pares_qualidade.empty or local_qualidade.empty:
        return []
    chaves = local_qualidade[["area_avaliacao", "ano"]].drop_duplicates()
    pares = pares_qualidade.merge(chaves, on=["area_avaliacao", "ano"])
    if pares.empty:
        return []
    group_cols = ["area_avaliacao", "ano"]
    radar_cols = list(course_profile.RADAR_FIELDS.values())
    means = pares.groupby(group_cols)[radar_cols].mean()
    means = means.rename(
        columns={column: label for label, column in course_profile.RADAR_FIELDS.items()}
    )
    means["quantidade_cursos_considerados"] = pares.groupby(group_cols)[
        "codigo_curso"
    ].nunique()
    return records(means.round(2).reset_index().sort_values(group_cols))


def _curva_sobrevivencia_nacional(
    pares_trajetoria: pd.DataFrame,
) -> list[dict[str, object]]:
    """Contraparte nacional: taxas médias por área CINE.

    Alinhadas por anos-desde-o-ingresso — assim coortes de anos diferentes,
    de instituições diferentes, ficam comparáveis.
    """
    if pares_trajetoria.empty:
        return []
    working = pares_trajetoria.copy()
    working["anos_desde_ingresso"] = working["ano_referencia"] - working["ano_ingresso"]
    group_cols = ["nome_cine_area_geral", "anos_desde_ingresso"]
    grouped = working.groupby(group_cols)[list(_RATE_COLUMNS)].mean()
    grouped = grouped.rename(
        columns={col: f"{col}_media_nacional" for col in _RATE_COLUMNS}
    )
    grouped["quantidade_cursos_considerados"] = working.groupby(group_cols)[
        "codigo_curso"
    ].nunique()
    return records(grouped.round(2).reset_index().sort_values(group_cols))


def _heatmap_evasao_nacional(pares_trajetoria: pd.DataFrame) -> list[dict[str, object]]:
    """Contraparte nacional: desistência anual média por área CINE.

    Por ano de referência — aqui é direto por ano calendário, sem precisar
    alinhar por coorte (o heatmap local já é assim).
    """
    if pares_trajetoria.empty:
        return []
    group_cols = ["nome_cine_area_geral", "ano_referencia"]
    media = pares_trajetoria.groupby(group_cols)["taxa_desistencia_anual"].mean()
    media = media.rename("taxa_desistencia_anual_media_nacional")
    quantidade = pares_trajetoria.groupby(group_cols)["codigo_curso"].nunique()
    quantidade = quantidade.rename("quantidade_cursos_considerados")
    grouped = pd.concat([media, quantidade], axis=1)
    return records(grouped.round(2).reset_index().sort_values(group_cols))


def _campus_nacional(
    pares_qualidade: pd.DataFrame, pares_trajetoria: pd.DataFrame
) -> dict[str, object]:
    """Contraparte nacional: mesmas métricas de ``campus_overview``.

    Calculadas sobre os cursos-pares do Brasil inteiro em vez dos cursos do
    campus.
    """
    return {
        "kpis": _kpis_nacional(pares_trajetoria),
        "distribuicao_cpc_faixa": _distribuicao_cpc_faixa_nacional(pares_qualidade),
    }


def _kpis_nacional(pares_trajetoria: pd.DataFrame) -> dict[str, object]:
    if pares_trajetoria.empty:
        return {
            "taxa_conclusao_media_nacional": None,
            "taxa_desistencia_media_nacional": None,
            "quantidade_cursos_considerados": 0,
        }
    latest = _latest_state_per_course(pares_trajetoria)
    return {
        "taxa_conclusao_media_nacional": _safe_mean(latest["taxa_conclusao_acumulada"]),
        "taxa_desistencia_media_nacional": _safe_mean(
            latest["taxa_desistencia_acumulada"]
        ),
        "quantidade_cursos_considerados": int(latest["codigo_curso"].nunique()),
    }


def _latest_state_per_course(frame: pd.DataFrame) -> pd.DataFrame:
    """Para cada curso nacional, a coorte de ingresso mais recente.

    No seu ano de acompanhamento mais recente — mesma lógica de
    ``course_profile._latest_cohort_latest_year``, vetorizada para todos os
    cursos-pares de uma vez.
    """
    max_ingresso = frame.groupby("codigo_curso")["ano_ingresso"].transform("max")
    latest_cohort = frame[frame["ano_ingresso"] == max_ingresso]
    idx = latest_cohort.groupby("codigo_curso")["ano_referencia"].idxmax()
    return latest_cohort.loc[idx]


def _safe_mean(series: pd.Series) -> float | None:
    value = series.mean()
    return None if pd.isna(value) else round(float(value), 2)


def _distribuicao_cpc_faixa_nacional(
    pares_qualidade: pd.DataFrame,
) -> list[dict[str, object]]:
    """Contraparte nacional da distribuição: % de cursos-pares por faixa.

    Ano mais recente de cada curso, em percentual — não contagem, senão
    milhares de cursos nacionais sempre esmagariam os poucos do campus.
    """
    if pares_qualidade.empty:
        return []
    idx = pares_qualidade.groupby("codigo_curso")["ano"].idxmax()
    latest = pares_qualidade.loc[idx]
    counts = latest["cpc_faixa"].value_counts()
    total = int(counts.sum())
    if total == 0:
        return []
    return [
        {"cpc_faixa": faixa, "percentual_nacional": round(100 * int(count) / total, 1)}
        for faixa, count in counts.sort_index().items()
    ]


def _distribuicao_uf(
    qualidade_nacional: pd.DataFrame,
    trajetoria_nacional: pd.DataFrame,
    data: ScopedData,
) -> list[dict[str, object]]:
    """Onde, no Brasil, existem cursos-pares de cada curso do campus.

    Um item por curso do campus, com os estados que oferecem o mesmo curso:
    na trajetória, mesma área CINE geral, modalidade e grau acadêmico; no
    CPC, mesma área de avaliação e modalidade. A modalidade entra porque um
    curso EaD é registrado no município-sede e inflaria o estado da sede; o
    grau, porque a área CINE junta bacharelado e tecnólogo (ex.: Sistemas de
    Informação com Análise e Desenvolvimento de Sistemas).
    """
    return [
        _distribuicao_uf_curso(
            int(codigo), qualidade_nacional, trajetoria_nacional, data
        )
        for codigo in data.cursos["codigo_curso"]
    ]


def _distribuicao_uf_curso(
    codigo_curso: int,
    qualidade_nacional: pd.DataFrame,
    trajetoria_nacional: pd.DataFrame,
    data: ScopedData,
) -> dict[str, object]:
    local_t = _rows_of(data.trajetoria, codigo_curso)
    local_q = _rows_of(data.qualidade, codigo_curso)

    area_cine = _first(local_t, "nome_cine_area_geral")
    uf_campus = _first(local_t, "codigo_uf")
    trajetoria = _uf_trajetoria(trajetoria_nacional, local_t)
    qualidade = _uf_qualidade(qualidade_nacional, local_q)

    estados: dict[str, dict[str, object]] = {}
    for resumo in (trajetoria, qualidade):
        for sigla, valores in resumo.estados.items():
            estados.setdefault(sigla, _estado_vazio(sigla)).update(valores)

    return {
        "codigo_curso": codigo_curso,
        "nome_cine_area_geral": area_cine,
        "area_avaliacao": qualidade.area,
        "sigla_uf_campus": _sigla_uf(uf_campus),
        "ano_ingresso": trajetoria.ano,
        "ano_cpc": qualidade.ano,
        "estados": [estados[sigla] for sigla in sorted(estados)],
    }


@dataclass(frozen=True, slots=True)
class _ResumoUf:
    """Uma fonte (trajetória ou qualidade) resumida por UF."""

    area: object | None = None
    ano: int | None = None
    estados: dict[str, dict[str, object]] = field(default_factory=dict)


def _sigla_uf(codigo_uf: object) -> str | None:
    if not isinstance(codigo_uf, numbers.Real):
        return None
    return UF_SIGLAS.get(int(float(codigo_uf)))


def _estado_vazio(sigla: str) -> dict[str, object]:
    return {
        "sigla_uf": sigla,
        "quantidade_cursos": 0,
        "qt_ingressante": None,
        "taxa_desistencia_media": None,
        "cpc_continuo_medio": None,
        "quantidade_cursos_cpc": 0,
    }


def _uf_trajetoria(nacional: pd.DataFrame, local: pd.DataFrame) -> _ResumoUf:
    """Por UF: cursos-pares com turma no ano de ingresso mais recente.

    Junto, os ingressantes dessa turma e a evasão média dela no último ano
    acompanhado (mesmo recorte dos KPIs do campus).
    """
    needed = {"nome_cine_area_geral", "codigo_uf", "ano_ingresso", "codigo_curso"}
    if local.empty or nacional.empty or not needed <= set(nacional.columns):
        return _ResumoUf()
    pares = nacional[
        nacional["nome_cine_area_geral"] == _first(local, "nome_cine_area_geral")
    ]
    pares = _same_value(pares, local, "tp_modalidade_ensino_desc")
    pares = _same_value(pares, local, "tp_grau_academico_desc")
    pares = pares.dropna(subset=["codigo_uf"])
    if pares.empty:
        return _ResumoUf()

    ano = int(pares["ano_ingresso"].max())
    turma = pares[pares["ano_ingresso"] == ano]
    idx = turma.groupby("codigo_curso")["ano_referencia"].idxmax()
    ultimo = turma.loc[idx]
    ingressantes = turma.drop_duplicates("codigo_curso")

    estados: dict[str, dict[str, object]] = {}
    for codigo_uf, grupo in ultimo.groupby("codigo_uf"):
        sigla = _sigla_uf(codigo_uf)
        if sigla is None:
            continue
        cursos = set(grupo["codigo_curso"])
        qt = ingressantes[ingressantes["codigo_curso"].isin(cursos)]["qt_ingressante"]
        estados[sigla] = {
            "quantidade_cursos": len(cursos),
            "qt_ingressante": int(qt.sum()),
            "taxa_desistencia_media": _safe_mean(grupo["taxa_desistencia_acumulada"]),
        }
    return _ResumoUf(ano=ano, estados=estados)


def _uf_qualidade(nacional: pd.DataFrame, local: pd.DataFrame) -> _ResumoUf:
    """Por UF: CPC contínuo médio dos cursos-pares na avaliação mais recente.

    A área é a ``area_avaliacao`` do ano mais recente do curso do campus.
    """
    if local.empty or nacional.empty or "sigla_uf" not in nacional.columns:
        return _ResumoUf()
    area = local.sort_values("ano")["area_avaliacao"].iloc[-1]
    pares = nacional[nacional["area_avaliacao"] == area]
    pares = _same_value(pares, local, "modalidade_ensino")
    pares = pares.dropna(subset=["cpc_continuo", "sigla_uf"])
    if pares.empty:
        return _ResumoUf(area=area)

    ano = int(pares["ano"].max())
    ultimo = pares[pares["ano"] == ano]
    estados: dict[str, dict[str, object]] = {
        str(sigla): {
            "cpc_continuo_medio": _safe_mean(grupo["cpc_continuo"]),
            "quantidade_cursos_cpc": int(grupo["codigo_curso"].nunique()),
        }
        for sigla, grupo in ultimo.groupby("sigla_uf")
    }
    return _ResumoUf(area=area, ano=ano, estados=estados)


def _rows_of(frame: pd.DataFrame, codigo_curso: int) -> pd.DataFrame:
    if frame.empty or "codigo_curso" not in frame.columns:
        return frame.iloc[0:0]
    return frame[frame["codigo_curso"] == codigo_curso]


def _first(frame: pd.DataFrame, column: str) -> object | None:
    if frame.empty or column not in frame.columns:
        return None
    values = frame[column].dropna()
    return None if values.empty else values.iloc[0]


def _same_value(pares: pd.DataFrame, local: pd.DataFrame, column: str) -> pd.DataFrame:
    """Restringe ``pares`` ao mesmo valor de ``column`` do curso local.

    Só quando a coluna existe nas duas pontas e o curso local tem valor.
    """
    valor = _first(local, column)
    if valor is None or column not in pares.columns:
        return pares
    return pares[pares[column] == valor]


class NationalBenchmarksSection:
    """Médias nacionais do grupo de pares — implementa ``DashboardSection``.

    Só chama o ``build(qualidade_nacional, trajetoria_nacional, data)`` de
    nível de módulo (testado à parte).
    """

    key = "medias_nacionais"

    def build(self, context: DashboardContext) -> dict[str, object]:
        return build(
            context.qualidade_nacional, context.trajetoria_nacional, context.data
        )
