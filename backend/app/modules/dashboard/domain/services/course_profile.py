import pandas as pd

from app.modules.dashboard.domain.section import DashboardContext
from app.modules.dashboard.domain.shared import ScopedData, records, scalar

# notas padronizadas (escala 0-5, comparáveis entre si) -> rótulo do radar
# público porque national_benchmarks.py reaproveita pra calcular a média nacional
RADAR_FIELDS: dict[str, str] = {
    "formacao_geral": "nota_padronizada_fg",
    "componente_especifico": "nota_padronizada_ce",
    "idd": "nota_padronizada_idd",
    "organizacao_didatico_pedagogica": "nota_padronizada_org_didatico_pedagogica",
    "infraestrutura": "nota_padronizada_infraestrutura",
    "oportunidade_ampliacao": "nota_padronizada_oportunidade_ampliacao",
    "mestres": "nota_padronizada_mestres",
    "doutores": "nota_padronizada_doutores",
    "regime_trabalho": "nota_padronizada_regime_trabalho",
}


_PARTICIPACAO_COLUMNS = ["n_concluintes_inscritos", "n_concluintes_participantes"]


def build_evolucao_cpc(data: ScopedData) -> list[dict[str, object]]:
    """CPC do curso por ano de avaliação (só os anos com ciclo Enade).

    Inclui ``area_avaliacao`` como chave de junção com a média nacional do
    grupo de pares (``national_benchmarks.build``), e a participação no Enade
    daquela edição: concluintes inscritos, participantes e a taxa
    (participantes / inscritos, em %) — participação baixa deixa o conceito
    menos representativo da turma.
    """
    if data.qualidade.empty:
        return []
    cols = [
        "codigo_curso",
        "nome_curso",
        "area_avaliacao",
        "ano",
        "cpc_continuo",
        "cpc_faixa",
        "conceito_enade_continuo",
    ]
    frame = data.qualidade.reindex(columns=cols + _PARTICIPACAO_COLUMNS)
    inscritos = frame["n_concluintes_inscritos"].astype(float)
    participantes = frame["n_concluintes_participantes"].astype(float)
    frame["taxa_participacao"] = (
        100 * participantes / inscritos.where(inscritos > 0)
    ).round(1)
    return records(frame.sort_values(["codigo_curso", "ano"]))


def build_perfil_radar(data: ScopedData) -> list[dict[str, object]]:
    """Notas padronizadas (0-5) do ano mais recente de cada curso.

    Inclui ``area_avaliacao`` + ``ano`` como chave de junção com a média
    nacional do grupo de pares (``national_benchmarks.build``, que é por área
    *e* ano — as notas são padronizadas dentro de cada edição), e o CPC/Enade
    da mesma avaliação, pra que as notas e o conceito que elas compõem venham
    juntos.
    """
    if data.qualidade.empty:
        return []
    idx = data.qualidade.groupby("codigo_curso")["ano"].idxmax()
    latest = data.qualidade.loc[idx]
    cols = [
        "codigo_curso",
        "nome_curso",
        "area_avaliacao",
        "ano",
        "cpc_continuo",
        "cpc_faixa",
        "conceito_enade_continuo",
    ]
    out = latest[cols].copy()
    for label, column in RADAR_FIELDS.items():
        out[label] = latest[column]
    return records(out.sort_values("codigo_curso"))


def build_kpis_por_curso(data: ScopedData) -> list[dict[str, object]]:
    """Cartões de indicador — CPC + trajetória da coorte mais recente."""
    rows: list[dict[str, object]] = []
    for _, curso in data.cursos.iterrows():
        codigo = curso["codigo_curso"]
        rows.append(
            {
                "codigo_curso": scalar(curso, "codigo_curso"),
                "nome_curso": curso["nome_curso"],
                **_kpis_for_course(data, codigo),
            }
        )
    return rows


def _kpis_for_course(data: ScopedData, codigo_curso: object) -> dict[str, object]:
    curso_qualidade = data.qualidade[data.qualidade["codigo_curso"] == codigo_curso]
    curso_trajetoria = data.trajetoria[data.trajetoria["codigo_curso"] == codigo_curso]

    latest_q = (
        curso_qualidade.sort_values("ano").iloc[-1]
        if not curso_qualidade.empty
        else None
    )
    latest_cohort = _latest_cohort_latest_year(curso_trajetoria)

    return {
        "ano_qualidade": scalar(latest_q, "ano"),
        "cpc_continuo": scalar(latest_q, "cpc_continuo"),
        "cpc_faixa": scalar(latest_q, "cpc_faixa"),
        "conceito_enade_continuo": scalar(latest_q, "conceito_enade_continuo"),
        "ano_ingresso_referencia": scalar(latest_cohort, "ano_ingresso"),
        "ano_referencia": scalar(latest_cohort, "ano_referencia"),
        "qt_ingressante": scalar(latest_cohort, "qt_ingressante"),
        "taxa_permanencia": scalar(latest_cohort, "taxa_permanencia"),
        "taxa_conclusao_acumulada": scalar(latest_cohort, "taxa_conclusao_acumulada"),
        "taxa_desistencia_acumulada": scalar(
            latest_cohort, "taxa_desistencia_acumulada"
        ),
    }


def _latest_cohort_latest_year(curso_trajetoria: pd.DataFrame) -> pd.Series | None:
    if curso_trajetoria.empty:
        return None
    latest_ingresso = curso_trajetoria["ano_ingresso"].max()
    cohort = curso_trajetoria[curso_trajetoria["ano_ingresso"] == latest_ingresso]
    return cohort.sort_values("ano_referencia").iloc[-1]


def build_funil_por_coorte(data: ScopedData) -> list[dict[str, object]]:
    """Estado mais recente de cada coorte.

    Ingressou/permanece/concluiu/desistiu/faleceu.
    """
    if data.trajetoria.empty:
        return []
    idx = data.trajetoria.groupby(["codigo_curso", "ano_ingresso"])[
        "ano_referencia"
    ].idxmax()
    latest_per_cohort = data.trajetoria.loc[idx]
    cols = [
        "codigo_curso",
        "nome_curso",
        "ano_ingresso",
        "ano_referencia",
        "qt_ingressante",
        "qt_permanencia",
        "qt_concluinte",
        "qt_desistencia",
        "qt_falecido",
    ]
    # prazo previsto da turma (anos): diz se ela ainda está em andamento e
    # quanto atrasou quem concluiu — pode mudar entre turmas do mesmo curso
    if "prazo_integralizacao" in latest_per_cohort.columns:
        cols.append("prazo_integralizacao")
    frame = latest_per_cohort[cols].sort_values(["codigo_curso", "ano_ingresso"])
    return records(frame)


# Anos de folga além do prazo pra uma turma contar como "madura" (já teve
# tempo de se formar, inclusive com atraso): só elas entram nas comparações.
ANOS_ALEM_DO_PRAZO = 2


def turma_madura(curso_trajetoria: pd.DataFrame) -> tuple[int, int] | None:
    """A turma madura mais recente de um curso: ``(ano_ingresso, prazo)``.

    Madura = acompanhada até ``prazo + ANOS_ALEM_DO_PRAZO`` anos depois do
    ingresso (``anos_desde_ingresso`` chega a ``prazo + 1``). ``None`` sem
    turma assim (curso novo) ou sem a coluna de prazo.
    """
    if curso_trajetoria.empty or "prazo_integralizacao" not in curso_trajetoria:
        return None
    frame = curso_trajetoria.dropna(subset=["prazo_integralizacao"])
    if frame.empty:
        return None
    anos = (
        (frame["ano_referencia"] - frame["ano_ingresso"])
        .groupby(frame["ano_ingresso"])
        .max()
    )
    prazos = frame.groupby("ano_ingresso")["prazo_integralizacao"].first()
    maduras = [
        int(ano)
        for ano in anos.index
        if anos[ano] >= int(prazos[ano]) + ANOS_ALEM_DO_PRAZO - 1
    ]
    if not maduras:
        return None
    ano = max(maduras)
    return ano, int(prazos[ano])


def build_curva_sobrevivencia(data: ScopedData) -> list[dict[str, object]]:
    """Série completa, todas as coortes e anos de acompanhamento.

    Para o front desenhar a curva de sobrevivência de uma coorte à escolha.
    Inclui ``nome_cine_area_geral`` e ``anos_desde_ingresso`` como chave de
    junção com a média nacional do grupo de pares
    (``national_benchmarks.build``), que é alinhada por anos-desde-o-ingresso
    em vez de ano calendário.
    """
    if data.trajetoria.empty:
        return []
    frame = data.trajetoria.copy()
    frame["anos_desde_ingresso"] = frame["ano_referencia"] - frame["ano_ingresso"]
    cols = [
        "codigo_curso",
        "nome_curso",
        "nome_cine_area_geral",
        "ano_ingresso",
        "ano_referencia",
        "anos_desde_ingresso",
        "taxa_permanencia",
        "taxa_conclusao_acumulada",
        "taxa_desistencia_acumulada",
    ]
    frame = frame[cols].sort_values(["codigo_curso", "ano_ingresso", "ano_referencia"])
    return records(frame)


class CourseProfileSection:
    """Perfil por curso — implementa ``DashboardSection``.

    Só agrupa os 5 builders acima num payload; a lógica em si continua nas
    funções soltas (testadas à parte, reaproveitadas por outras seções).
    """

    key = "curso_perfil"

    def build(self, context: DashboardContext) -> dict[str, object]:
        data = context.data
        return {
            "kpis": build_kpis_por_curso(data),
            "evolucao_cpc": build_evolucao_cpc(data),
            "perfil_radar": build_perfil_radar(data),
            "funil_coortes": build_funil_por_coorte(data),
            "curva_sobrevivencia": build_curva_sobrevivencia(data),
        }
