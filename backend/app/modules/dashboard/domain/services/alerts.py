from typing import cast

from app.modules.dashboard.domain.section import DashboardContext
from app.modules.dashboard.domain.services import course_profile, unidade_overview
from app.modules.dashboard.domain.shared import ScopedData

_SEM_CPC = {None, "SC"}
_FAIXAS_BAIXAS = {"1", "2"}


def build(data: ScopedData) -> list[dict[str, object]]:
    """Alertas automáticos sobre os cursos da unidade.

    Heurísticas simples, prontas pro front destacar sem precisar recalcular
    limiar nenhum. Cada regra só entra na lista se tiver pelo menos 1 curso —
    lista vazia é sinal de que não há nada chamando atenção agora.
    """
    kpis_por_curso = course_profile.build_kpis_por_curso(data)
    unidade_kpis = cast(
        "dict[str, object]", unidade_overview.build(data, kpis_por_curso)["kpis"]
    )
    media_unidade = cast("float | None", unidade_kpis["taxa_desistencia_media"])

    result: list[dict[str, object]] = []
    result += _sem_cpc(kpis_por_curso)
    result += _faixa_baixa(kpis_por_curso)
    result += _evasao_acima_da_media(kpis_por_curso, media_unidade)
    return result


def _sem_cpc(kpis_por_curso: list[dict[str, object]]) -> list[dict[str, object]]:
    cursos = [
        row["nome_curso"] for row in kpis_por_curso if row["cpc_faixa"] in _SEM_CPC
    ]
    if not cursos:
        return []
    mensagem = f"{len(cursos)} curso(s) sem avaliação de CPC no ciclo atual."
    return [_item("sem_cpc", "atencao", mensagem, cursos)]


def _faixa_baixa(kpis_por_curso: list[dict[str, object]]) -> list[dict[str, object]]:
    cursos = [
        row["nome_curso"]
        for row in kpis_por_curso
        if row["cpc_faixa"] in _FAIXAS_BAIXAS
    ]
    if not cursos:
        return []
    mensagem = f"{len(cursos)} curso(s) em faixa de CPC baixa (1-2)."
    return [_item("cpc_faixa_baixa", "critico", mensagem, cursos)]


def _evasao_acima_da_media(
    kpis_por_curso: list[dict[str, object]], media_unidade: float | None
) -> list[dict[str, object]]:
    """Compara com a média da própria unidade, não a nacional.

    Não usa ``national_benchmarks`` de propósito: aquele cálculo varre o
    dataset nacional inteiro (~2,7 milhões de linhas) e duplicaria esse custo
    aqui; a média da unidade já está calculada em ``unidade_overview`` e é
    igualmente útil pra sinalizar "curso destoante dos colegas".
    """
    if media_unidade is None:
        return []
    cursos = [
        row["nome_curso"]
        for row in kpis_por_curso
        if row["taxa_desistencia_acumulada"] is not None
        and float(row["taxa_desistencia_acumulada"]) > media_unidade  # type: ignore[arg-type]
    ]
    if not cursos:
        return []
    # mensagem vai pronta pro front: decimal com vírgula (pt-BR), não ponto
    media_texto = f"{media_unidade:.1f}".replace(".", ",")
    mensagem = (
        f"{len(cursos)} curso(s) com evasão acima da média da unidade "
        f"({media_texto}%)."
    )
    return [_item("evasao_acima_da_media", "atencao", mensagem, cursos)]


def _item(
    tipo: str, severidade: str, mensagem: str, cursos: list[object]
) -> dict[str, object]:
    return {
        "tipo": tipo,
        "severidade": severidade,
        "mensagem": mensagem,
        "cursos": cursos,
    }


class AlertsSection:
    """Alertas automáticos da unidade — implementa ``DashboardSection``."""

    key = "alertas"

    def build(self, context: DashboardContext) -> dict[str, object]:
        return {"itens": build(context.data)}
