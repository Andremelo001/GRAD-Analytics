from app.modules.dashboard.domain.services import campus_summary
from app.modules.dashboard.domain.shared import ScopedData


def test_trajetoria_madura_carries_cohort_size(scoped_data: ScopedData) -> None:
    # prazo 0: a turma de 2018 (acompanhada por 1 ano) já conta como madura
    data = ScopedData(
        qualidade=scoped_data.qualidade,
        trajetoria=scoped_data.trajetoria.assign(prazo_integralizacao=0),
        cursos=scoped_data.cursos,
    )
    cursos = {c["codigo_curso"]: c for c in campus_summary.build_resumo_cursos(data)}
    trajetoria = cursos[10]["trajetoria"]
    assert isinstance(trajetoria, dict)
    assert trajetoria["ano_ingresso"] == 2018
    assert trajetoria["ingressantes"] == 50
