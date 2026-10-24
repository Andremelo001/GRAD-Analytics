from app.modules.dashboard.domain.services import trajectory_comparison
from app.modules.dashboard.domain.shared import ScopedData


def test_build_returns_all_sections(scoped_data: ScopedData) -> None:
    result = trajectory_comparison.build(scoped_data)
    assert set(result) == {
        "evasao_por_curso",
        "heatmap_evasao_anual",
        "demanda_ingressantes",
        "demanda_concluintes",
    }


def test_evasao_por_curso_computes_anos_desde_ingresso(scoped_data: ScopedData) -> None:
    rows = trajectory_comparison.build(scoped_data)["evasao_por_curso"]
    curso_10 = [r for r in rows if r["codigo_curso"] == 10]
    by_ano_referencia = {
        r["ano_referencia"]: r["anos_desde_ingresso"] for r in curso_10
    }
    assert by_ano_referencia == {2018: 0, 2019: 1, 2020: 0}


def test_heatmap_evasao_anual_averages_overlapping_cohorts(
    scoped_data: ScopedData,
) -> None:
    rows = trajectory_comparison.build(scoped_data)["heatmap_evasao_anual"]
    # em 2019 só a coorte 2018 do curso 10 está ativa -> média = ela mesma
    curso_10_2019 = next(
        r for r in rows if r["codigo_curso"] == 10 and r["ano_referencia"] == 2019
    )
    assert curso_10_2019["taxa_desistencia_anual"] == 10.0


def test_demanda_ingressantes_avoids_double_counting_cohort(
    scoped_data: ScopedData,
) -> None:
    rows = trajectory_comparison.build(scoped_data)["demanda_ingressantes"]
    curso_10_rows = [r for r in rows if r["codigo_curso"] == 10]
    # coorte 2018 aparece em 2 anos de referência no dataset bruto, mas só deve
    # contar uma vez aqui (senão duplicaria o ingressante).
    assert [r["ano_ingresso"] for r in curso_10_rows] == [2018, 2020]
    assert [r["qt_ingressante"] for r in curso_10_rows] == [50, 60]
