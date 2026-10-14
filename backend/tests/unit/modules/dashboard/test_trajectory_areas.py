import pandas as pd

from app.modules.dashboard.domain.services import trajectory_areas


def _linhas(curso: int, ano: int, anos: int, prazo: int) -> list[dict[str, object]]:
    return [
        {
            "codigo_curso": curso,
            "codigo_ies": 7,
            "codigo_municipio": 2304400.0,
            "codigo_uf": 23,
            "nome_ies": "Universidade Teste",
            "tp_categoria_administrativa_desc": "Pública Federal",
            "tp_grau_academico_desc": "Bacharelado",
            "tp_modalidade_ensino_desc": "Presencial",
            "nome_cine_area_geral": "Direito",
            "ano_ingresso": ano,
            "ano_referencia": ano + a,
            "prazo_integralizacao": prazo,
            "qt_ingressante": 40,
            "taxa_permanencia": 100.0 - 10 * a,
            "taxa_conclusao_acumulada": 5.0 * a,
            "taxa_desistencia_acumulada": 5.0 * a,
        }
        for a in range(anos + 1)
    ]


def test_build_area_keeps_latest_mature_cohort_per_course() -> None:
    frame = pd.DataFrame(
        # curso 1: 2015 e 2017 maduras (prazo 2 -> precisa de 3 anos); 2019 não
        _linhas(1, 2015, 5, 2)
        + _linhas(1, 2017, 3, 2)
        + _linhas(1, 2019, 1, 2)
        # curso 2: nenhuma turma madura
        + _linhas(2, 2019, 2, 4)
    )
    qualidade = pd.DataFrame(
        [
            {
                "codigo_ies": 7,
                "sigla_ies": "UT",
                "codigo_municipio": 2304400,
                "municipio_curso": "Fortaleza",
            }
        ]
    )
    nomes = trajectory_areas.nomes_da_qualidade(qualidade)
    payload = trajectory_areas.build_area(frame, nomes, "Direito", 7)
    assert payload is not None
    cursos = payload["cursos"]
    assert isinstance(cursos, list) and len(cursos) == 1
    codigo, ies, municipio, grau, ead, prazo, ano, ingressantes, curva = cursos[0]
    assert (codigo, ies, municipio, grau, ead) == (1, 7, 2304400, "Bacharelado", False)
    assert (prazo, ano, ingressantes) == (2, 2017, 40)
    assert curva[-1] == [3, 70.0, 15.0, 15.0]
    assert payload["ies"] == {"7": ["Universidade Teste", "UT", True]}
    assert payload["municipios"] == {"2304400": ["Fortaleza", "CE"]}


def test_build_area_none_without_mature_cohort() -> None:
    frame = pd.DataFrame(_linhas(2, 2019, 2, 4))
    assert trajectory_areas.build_area(frame, ({}, {}), "Direito", 7) is None
