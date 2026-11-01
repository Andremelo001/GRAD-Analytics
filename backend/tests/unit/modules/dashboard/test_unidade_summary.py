from app.modules.dashboard.domain.services import unidade_summary
from app.modules.dashboard.domain.shared import ScopedData


def test_trajetoria_madura_carries_cohort_size(scoped_data: ScopedData) -> None:
    # prazo 0: a turma de 2018 (acompanhada por 1 ano) já conta como madura
    data = ScopedData(
        qualidade=scoped_data.qualidade,
        trajetoria=scoped_data.trajetoria.assign(prazo_integralizacao=0),
        cursos=scoped_data.cursos,
    )
    cursos = {c["codigo_curso"]: c for c in unidade_summary.build_resumo_cursos(data)}
    trajetoria = cursos[10]["trajetoria"]
    assert isinstance(trajetoria, dict)
    assert trajetoria["ano_ingresso"] == 2018
    assert trajetoria["ingressantes"] == 50
    # todas as turmas maduras (aqui só a de 2018: a de 2020 não foi
    # acompanhada nenhum ano), no mesmo formato; a última é a de cima
    turmas = trajetoria["turmas"]
    assert isinstance(turmas, list)
    assert [t["ano_ingresso"] for t in turmas] == [2018]
    assert turmas[-1]["curva"] == trajetoria["curva"]
    assert turmas[-1]["ingressantes"] == 50
    # a de 2020 ainda não teve tempo de se formar: em andamento
    andamento = trajetoria["turmas_em_andamento"]
    assert isinstance(andamento, list)
    assert [t["ano_ingresso"] for t in andamento] == [2020]


def test_resumo_carries_grau_academico(scoped_data: ScopedData) -> None:
    cursos = {
        c["codigo_curso"]: c for c in unidade_summary.build_resumo_cursos(scoped_data)
    }
    assert cursos[10]["grau_academico"] == "Bacharelado"
