import pandas as pd

from app.modules.dashboard.domain.section import DashboardContext
from app.modules.dashboard.domain.services import course_profile
from app.modules.dashboard.domain.shared import ScopedData, records


def build(data: ScopedData) -> dict[str, object]:
    """Trajetória comparada entre os cursos do campus."""
    return {
        "evasao_por_curso": _evasao_por_curso(data),
        "heatmap_evasao_anual": _heatmap_evasao_anual(data),
        "demanda_ingressantes": _demanda_ingressantes(data),
        "demanda_concluintes": _demanda_concluintes(data),
    }


def _evasao_por_curso(data: ScopedData) -> list[dict[str, object]]:
    """Evasão acumulada por curso, alinhada por anos-desde-o-ingresso.

    Não por ano-calendário — assim coortes de anos diferentes ficam
    comparáveis.
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
        "taxa_desistencia_acumulada",
    ]
    frame = frame[cols].sort_values(["codigo_curso", "ano_ingresso", "ano_referencia"])
    return records(frame)


def _heatmap_evasao_anual(data: ScopedData) -> list[dict[str, object]]:
    """Curso x ano-calendário -> taxa de desistência anual.

    Várias coortes podem estar ativas no mesmo ano de referência; a célula é a
    média entre elas (não a soma, pra continuar sendo uma taxa comparável).
    """
    if data.trajetoria.empty:
        return []
    grouped = (
        data.trajetoria.groupby(
            ["codigo_curso", "nome_curso", "nome_cine_area_geral", "ano_referencia"]
        )["taxa_desistencia_anual"]
        .mean()
        .reset_index()
        .sort_values(["codigo_curso", "ano_referencia"])
    )
    return records(grouped)


def _demanda_ingressantes(data: ScopedData) -> list[dict[str, object]]:
    """Quantidade de ingressantes por curso, por ano de ingresso."""
    if data.trajetoria.empty:
        return []
    primeira_linha = data.trajetoria[
        data.trajetoria["ano_referencia"] == data.trajetoria["ano_ingresso"]
    ]
    cols = ["codigo_curso", "nome_curso", "ano_ingresso", "qt_ingressante"]
    frame = primeira_linha[cols].sort_values(["codigo_curso", "ano_ingresso"])
    return records(frame)


def _demanda_concluintes(data: ScopedData) -> list[dict[str, object]]:
    """Concluintes por curso, por ano de referência.

    Só nos anos em que os dados do curso estão completos
    (``course_profile.janela_concluintes``, com o prazo do curso).
    """
    if data.trajetoria.empty or "prazo_integralizacao" not in data.cursos:
        return []
    prazos = dict(
        zip(
            data.cursos["codigo_curso"],
            data.cursos["prazo_integralizacao"],
            strict=True,
        )
    )
    partes: list[pd.DataFrame] = []
    for codigo, local in data.trajetoria.groupby("codigo_curso"):
        janela = course_profile.janela_concluintes(
            local["ano_ingresso"], pd.Series([prazos.get(codigo)])
        )
        if janela is not None:
            partes.append(course_profile.concluintes_por_ano(local, janela))
    if not partes:
        return []
    frame = pd.concat(partes)
    nomes = data.trajetoria.drop_duplicates("codigo_curso").set_index("codigo_curso")[
        "nome_curso"
    ]
    frame["nome_curso"] = frame["codigo_curso"].map(nomes)
    return records(
        frame[["codigo_curso", "nome_curso", "ano_referencia", "qt_concluinte"]]
    )


class TrajectoryComparisonSection:
    """Trajetória comparada — implementa ``DashboardSection``.

    Só chama o ``build(data)`` de nível de módulo (testado à parte).
    """

    key = "trajetoria_comparada"

    def build(self, context: DashboardContext) -> dict[str, object]:
        return build(context.data)
