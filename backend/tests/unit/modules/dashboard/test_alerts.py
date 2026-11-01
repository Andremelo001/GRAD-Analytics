import re

import pandas as pd

from app.modules.dashboard.domain.section import DashboardContext
from app.modules.dashboard.domain.services import alerts
from app.modules.dashboard.domain.shared import ScopedData


def test_build_flags_course_without_cpc(scoped_data: ScopedData) -> None:
    result = alerts.build(scoped_data)
    item = next(a for a in result if a["tipo"] == "sem_cpc")
    assert item["cursos"] == ["Somente Trajetória"]  # curso 30, sem qualidade


def test_build_flags_low_cpc_faixa(scoped_data: ScopedData) -> None:
    result = alerts.build(scoped_data)
    item = next(a for a in result if a["tipo"] == "cpc_faixa_baixa")
    assert item["cursos"] == ["Curso Só Qualidade"]  # curso 20, faixa "2"


def test_build_flags_evasao_above_unidade_average(scoped_data: ScopedData) -> None:
    result = alerts.build(scoped_data)
    item = next(a for a in result if a["tipo"] == "evasao_acima_da_media")
    # média da unidade é 3.35% (curso 10: 0%, curso 30: 6.7%) -> só o 30 destoa
    assert item["cursos"] == ["Somente Trajetória"]


def test_build_omits_rule_with_no_matching_course() -> None:
    empty = pd.DataFrame()
    result = alerts.build(ScopedData(qualidade=empty, trajetoria=empty, cursos=empty))
    assert result == []


def test_section_build_wraps_items_under_itens_key(
    dashboard_context: DashboardContext,
) -> None:
    result = alerts.AlertsSection().build(dashboard_context)
    assert set(result) == {"itens"}
    assert isinstance(result["itens"], list)


def test_mensagem_usa_decimal_pt_br(scoped_data: ScopedData) -> None:
    # vai direto pra tela: "3,3%", nunca "3.3%"
    item = next(
        a for a in alerts.build(scoped_data) if a["tipo"] == "evasao_acima_da_media"
    )
    assert re.search(r"\(\d+,\d%\)", str(item["mensagem"]))
