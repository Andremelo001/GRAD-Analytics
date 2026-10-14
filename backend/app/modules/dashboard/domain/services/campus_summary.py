from app.modules.dashboard.domain.services import course_profile
from app.modules.dashboard.domain.shared import ScopedData

_KPIS = (
    "ano_ingresso_referencia",
    "ano_referencia",
    "taxa_conclusao_acumulada",
    "taxa_desistencia_acumulada",
)


def build_resumo_cursos(data: ScopedData) -> list[dict[str, object]]:
    """Resumo de cada curso de um campus, pra comparar entre campi e cursos.

    Avaliação mais recente (área, ano, CPC, faixa, Enade, IDD e as 9 notas
    padronizadas em ``notas``), as edições do CPC (``historico``) e a evasão e
    a conclusão da turma mais recente — os mesmos números de
    ``curso_perfil.perfil_radar``, ``evolucao_cpc`` e ``kpis``, num arquivo
    pequeno (``resumo_campi.json``): o front compara cursos e campi sem baixar
    o JSON de cada campus (o de Fortaleza tem ~8 MB).
    """
    perfis = {p["codigo_curso"]: p for p in course_profile.build_perfil_radar(data)}
    historicos: dict[object, list[dict[str, object]]] = {}
    for ponto in course_profile.build_evolucao_cpc(data):
        historicos.setdefault(ponto["codigo_curso"], []).append(
            {campo: ponto[campo] for campo in ("ano", "cpc_continuo", "cpc_faixa")}
        )
    rows: list[dict[str, object]] = []
    for kpi in course_profile.build_kpis_por_curso(data):
        perfil = perfis.get(kpi["codigo_curso"], {})
        rows.append(
            {
                "codigo_curso": kpi["codigo_curso"],
                "nome_curso": kpi["nome_curso"],
                "area_avaliacao": perfil.get("area_avaliacao"),
                "ano": perfil.get("ano"),
                "cpc_continuo": perfil.get("cpc_continuo"),
                "cpc_faixa": perfil.get("cpc_faixa"),
                "conceito_enade_continuo": perfil.get("conceito_enade_continuo"),
                "idd": perfil.get("idd"),
                "notas": (
                    {campo: perfil.get(campo) for campo in course_profile.RADAR_FIELDS}
                    if perfil
                    else None
                ),
                "historico": historicos.get(kpi["codigo_curso"], []),
                **{campo: kpi[campo] for campo in _KPIS},
                "trajetoria": _trajetoria_madura(data, kpi["codigo_curso"]),
            }
        )
    return rows


def _trajetoria_madura(
    data: ScopedData, codigo_curso: object
) -> dict[str, object] | None:
    """A turma madura do curso, pra comparar o mesmo curso entre campi.

    Área CINE (o curso em si) e grau — pra achar o mesmo curso noutro
    campus —, prazo, ano de ingresso, ingressantes (o peso do curso nas
    médias do campus) e a curva ano a ano: ``[anos desde o ingresso,
    % cursando, % concluiu, % desistiu]``. ``None`` sem turma madura.
    """
    local = data.trajetoria[data.trajetoria["codigo_curso"] == codigo_curso]
    madura = course_profile.turma_madura(local)
    if madura is None:
        return None
    ano, prazo = madura
    turma = local[local["ano_ingresso"] == ano].sort_values("ano_referencia")

    def _texto(coluna: str) -> str | None:
        if coluna not in turma.columns or turma[coluna].dropna().empty:
            return None
        return str(turma[coluna].dropna().iloc[0])

    return {
        "nome_cine_area_geral": _texto("nome_cine_area_geral"),
        "grau_academico": _texto("tp_grau_academico_desc"),
        "prazo_integralizacao": prazo,
        "ano_ingresso": ano,
        "ingressantes": (
            int(turma["qt_ingressante"].dropna().iloc[0])
            if "qt_ingressante" in turma.columns
            and not turma["qt_ingressante"].dropna().empty
            else None
        ),
        "curva": [
            [
                int(linha["ano_referencia"] - linha["ano_ingresso"]),
                round(float(linha["taxa_permanencia"]), 1),
                round(float(linha["taxa_conclusao_acumulada"]), 1),
                round(float(linha["taxa_desistencia_acumulada"]), 1),
            ]
            for _, linha in turma.iterrows()
        ],
    }
