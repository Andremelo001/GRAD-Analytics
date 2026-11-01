from app.modules.dashboard.domain.section import DashboardContext
from app.modules.dashboard.domain.services import course_profile
from app.modules.dashboard.domain.shared import ScopedData, records


def build(data: ScopedData) -> dict[str, object]:
    """Comparação entre os cursos da unidade."""
    return {
        "ranking_cpc": _ranking_cpc(data),
        "tabela_comparativa": _tabela_comparativa(
            course_profile.build_kpis_por_curso(data)
        ),
        "notas_por_dimensao": course_profile.build_perfil_radar(data),
        "evolucao_cpc_comparada": course_profile.build_evolucao_cpc(data),
    }


def _ranking_cpc(data: ScopedData) -> list[dict[str, object]]:
    """CPC mais recente de cada curso, do maior pro menor."""
    if data.qualidade.empty:
        return []
    idx = data.qualidade.groupby("codigo_curso")["ano"].idxmax()
    latest = data.qualidade.loc[idx].sort_values(
        "cpc_continuo", ascending=False, na_position="last"
    )
    cols = ["codigo_curso", "nome_curso", "ano", "cpc_continuo"]
    return records(latest[cols])


def _tabela_comparativa(
    kpis_por_curso: list[dict[str, object]],
) -> list[dict[str, object]]:
    """Dispersão conclusão x evasão: 1 linha por curso."""
    keep = (
        "codigo_curso",
        "nome_curso",
        "cpc_faixa",
        "conceito_enade_continuo",
        "taxa_conclusao_acumulada",
        "taxa_desistencia_acumulada",
        "taxa_permanencia",
    )
    return [{field: row.get(field) for field in keep} for row in kpis_por_curso]


class CourseComparisonSection:
    """Comparação entre cursos — implementa ``DashboardSection``.

    Só chama o ``build(data)`` de nível de módulo (testado à parte).
    """

    key = "comparacao_cursos"

    def build(self, context: DashboardContext) -> dict[str, object]:
        return build(context.data)
