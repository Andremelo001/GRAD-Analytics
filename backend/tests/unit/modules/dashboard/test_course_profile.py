import pandas as pd

from app.modules.dashboard.domain.section import DashboardContext
from app.modules.dashboard.domain.services import course_profile
from app.modules.dashboard.domain.services.course_profile import CourseProfileSection
from app.modules.dashboard.domain.shared import ScopedData


def test_build_evolucao_cpc_has_one_row_per_year(scoped_data: ScopedData) -> None:
    rows = course_profile.build_evolucao_cpc(scoped_data)
    curso_10 = [r for r in rows if r["codigo_curso"] == 10]
    assert [r["ano"] for r in curso_10] == [2017, 2019]
    assert curso_10[1]["cpc_continuo"] == 3.8


def test_build_evolucao_cpc_computes_enade_participation(
    scoped_data: ScopedData,
) -> None:
    qualidade = scoped_data.qualidade.assign(
        n_concluintes_inscritos=[40, 50, 0],
        n_concluintes_participantes=[30, 49, 0],
    )
    data = ScopedData(
        qualidade=qualidade,
        trajetoria=scoped_data.trajetoria,
        cursos=scoped_data.cursos,
    )
    rows = {
        (r["codigo_curso"], r["ano"]): r
        for r in course_profile.build_evolucao_cpc(data)
    }
    assert rows[(10, 2017)]["taxa_participacao"] == 75.0
    assert rows[(10, 2019)]["n_concluintes_participantes"] == 49
    assert rows[(10, 2019)]["taxa_participacao"] == 98.0
    assert rows[(20, 2019)]["taxa_participacao"] is None  # 0 inscritos


def test_build_evolucao_cpc_without_participation_columns(
    scoped_data: ScopedData,
) -> None:
    rows = course_profile.build_evolucao_cpc(scoped_data)
    assert all(r["taxa_participacao"] is None for r in rows)


def test_build_perfil_radar_uses_latest_year_only(scoped_data: ScopedData) -> None:
    rows = course_profile.build_perfil_radar(scoped_data)
    curso_10 = next(r for r in rows if r["codigo_curso"] == 10)
    assert curso_10["formacao_geral"] == 4.0  # ano 2019, não 2017
    assert set(course_profile.RADAR_FIELDS) <= curso_10.keys()


def test_build_perfil_radar_carries_year_and_cpc_of_same_evaluation(
    scoped_data: ScopedData,
) -> None:
    rows = course_profile.build_perfil_radar(scoped_data)
    curso_10 = next(r for r in rows if r["codigo_curso"] == 10)
    assert curso_10["ano"] == 2019
    assert curso_10["cpc_continuo"] == 3.8
    assert curso_10["cpc_faixa"] == "4"
    assert curso_10["conceito_enade_continuo"] == 3.9


def test_build_kpis_por_curso_uses_most_recent_cohort_most_recent_year(
    scoped_data: ScopedData,
) -> None:
    kpis = {
        row["codigo_curso"]: row
        for row in course_profile.build_kpis_por_curso(scoped_data)
    }

    # curso 10: coorte mais recente é 2020 (não 2018), acompanhada até 2020
    curso_10 = kpis[10]
    assert curso_10["ano_ingresso_referencia"] == 2020
    assert curso_10["ano_referencia"] == 2020
    assert curso_10["qt_ingressante"] == 60
    assert curso_10["cpc_continuo"] == 3.8  # qualidade mais recente (2019)

    # curso 20: só tem qualidade, sem trajetória
    curso_20 = kpis[20]
    assert curso_20["cpc_continuo"] == 2.0
    assert curso_20["ano_ingresso_referencia"] is None
    assert curso_20["qt_ingressante"] is None

    # curso 30: só tem trajetória, sem qualidade
    curso_30 = kpis[30]
    assert curso_30["cpc_continuo"] is None
    assert curso_30["qt_ingressante"] == 30


def test_build_funil_por_coorte_keeps_latest_state_per_cohort(
    scoped_data: ScopedData,
) -> None:
    rows = course_profile.build_funil_por_coorte(scoped_data)
    curso_10_coortes = {r["ano_ingresso"]: r for r in rows if r["codigo_curso"] == 10}
    assert set(curso_10_coortes) == {2018, 2020}
    # coorte 2018 tem 2 anos de acompanhamento (2018, 2019) -> fica com o de 2019
    assert curso_10_coortes[2018]["ano_referencia"] == 2019
    assert curso_10_coortes[2018]["qt_desistencia"] == 5


def test_build_curva_sobrevivencia_returns_full_series(scoped_data: ScopedData) -> None:
    rows = course_profile.build_curva_sobrevivencia(scoped_data)
    curso_10_rows = [r for r in rows if r["codigo_curso"] == 10]
    assert len(curso_10_rows) == 3  # 2018/2018, 2018/2019, 2020/2020
    curso_20_rows = [r for r in rows if r["codigo_curso"] == 20]
    assert curso_20_rows == []  # curso 20 não tem trajetória


def test_section_build_assembles_full_payload(
    dashboard_context: DashboardContext,
) -> None:
    payload = CourseProfileSection().build(dashboard_context)
    assert set(payload) == {
        "kpis",
        "evolucao_cpc",
        "perfil_radar",
        "funil_coortes",
        "curva_sobrevivencia",
    }


def _turmas(prazo: int, anos_por_turma: dict[int, int]) -> pd.DataFrame:
    """Linhas de trajetória: cada turma acompanhada por N anos (0..N)."""
    linhas = [
        {
            "codigo_curso": 1,
            "ano_ingresso": ingresso,
            "ano_referencia": ingresso + k,
            "prazo_integralizacao": prazo,
        }
        for ingresso, n in anos_por_turma.items()
        for k in range(n + 1)
    ]
    return pd.DataFrame(linhas)


def test_turma_madura_is_latest_cohort_tracked_two_years_past_deadline() -> None:
    # prazo 4: madura precisa de anos_desde_ingresso >= 5 (prazo + 1)
    frame = _turmas(4, {2015: 9, 2018: 6, 2019: 5, 2020: 4})
    assert course_profile.turma_madura(frame) == (2019, 4)


def test_turma_madura_none_without_mature_cohort_or_prazo() -> None:
    assert course_profile.turma_madura(_turmas(5, {2020: 4})) is None
    sem_prazo = _turmas(5, {2010: 9}).drop(columns=["prazo_integralizacao"])
    assert course_profile.turma_madura(sem_prazo) is None


def test_funil_por_coorte_carries_cohort_deadline(scoped_data: ScopedData) -> None:
    trajetoria = scoped_data.trajetoria.assign(prazo_integralizacao=4)
    data = ScopedData(
        qualidade=scoped_data.qualidade,
        trajetoria=trajetoria,
        cursos=scoped_data.cursos,
    )
    funil = course_profile.build_funil_por_coorte(data)
    assert funil and all(item["prazo_integralizacao"] == 4 for item in funil)


def test_janela_concluintes_covers_only_complete_years() -> None:
    # turmas de 2010 a 2020, prazo 4: de 2010+4+1 até 2020+4-1
    anos = pd.Series([2010, 2015, 2020])
    assert course_profile.janela_concluintes(anos, pd.Series([4])) == (2015, 2023)
    # prazos diferentes: o maior no começo, o menor no fim
    assert course_profile.janela_concluintes(anos, pd.Series([4, 6])) == (2017, 2023)
    assert course_profile.janela_concluintes(anos, pd.Series([None])) is None
    assert course_profile.janela_concluintes(pd.Series([2020]), pd.Series([6])) is None


def test_concluintes_por_ano_sums_cohorts_inside_window() -> None:
    frame = pd.DataFrame(
        {
            "codigo_curso": [1, 1, 1, 1],
            "ano_ingresso": [2010, 2011, 2010, 2011],
            "ano_referencia": [2015, 2015, 2016, 2014],
            "qt_concluinte": [3, 4, 5, 9],
        }
    )
    rows = course_profile.concluintes_por_ano(frame, (2015, 2016))
    assert rows.to_dict("records") == [
        {"codigo_curso": 1, "ano_referencia": 2015, "qt_concluinte": 7},
        {"codigo_curso": 1, "ano_referencia": 2016, "qt_concluinte": 5},
    ]
