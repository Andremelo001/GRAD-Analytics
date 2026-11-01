import pandas as pd
import pytest

from app.modules.dashboard.domain.shared import build_scoped_data, discover_unidades
from app.modules.dashboard.domain.unidade_mapping import (
    AjustesUnidades,
    CursoInep,
    CursoSigaa,
    UnidadeSigaa,
    chave_nome,
    match_unidade,
    parse_ajustes,
    parse_unidades,
    problemas_ajustes,
)


def _unidade(sigla: str, *cursos: tuple[str, str, str]) -> UnidadeSigaa:
    return UnidadeSigaa(
        sigla=sigla,
        rotulo=f"{sigla} - CENTRO",
        cursos=tuple(CursoSigaa(nome=n, sede=s, modalidade=m) for n, s, m in cursos),
    )


_UNIDADES = [
    _unidade(
        "FEAAC",
        ("ADMINISTRAÇÃO (DIURNO)", "FORTALEZA", "Presencial"),
        ("ADMINISTRAÇÃO (NOTURNO)", "FORTALEZA", "Presencial"),
        ("TECNOLOGIA EM GESTÃO DA QUALIDADE", "FORTALEZA", "Presencial"),
        ("FINANÇAS", "FORTALEZA", "Presencial"),
    ),
    _unidade("IUVI", ("ADMINISTRAÇÃO", "FORTALEZA", "A Distância")),
    _unidade("SOBRAL", ("FINANÇAS", "SOBRAL", "Presencial")),
    _unidade(
        "CC",
        ("FÍSICA - BACHARELADO", "FORTALEZA", "Presencial"),
        ("FÍSICA - LICENCIATURA", "FORTALEZA", "Presencial"),
    ),
    _unidade("FACED", ("FÍSICA", "FORTALEZA", "Presencial")),
    _unidade(
        "CH",
        ("LICENCIATURA INTERCULTURAL INDÍGENA KUABA", "FORTALEZA", "Presencial"),
    ),
    _unidade("FACMED", ("MEDICINA", "FORTALEZA", "Presencial")),
    _unidade("CARIRI", ("MEDICINA - BARBALHA", "FORTALEZA", "Presencial")),
]


def _curso(
    nome: str,
    municipio: str = "Fortaleza",
    *,
    ead: bool | None = False,
    grau: str | None = "Bacharelado",
    codigo: int = 1,
) -> CursoInep:
    return CursoInep(
        codigo_curso=codigo, nome=nome, municipio=municipio, ead=ead, grau=grau
    )


@pytest.mark.parametrize(
    ("nome", "sede", "chave"),
    [
        ("EDUCAÇÃO FÍSICA - BACHARELADO (DIURNO)", None, "EDUCACAO FISICA"),
        ("MEDICINA - SOBRAL", "SOBRAL", "MEDICINA"),
        ("PSICOLOGIA/CCGPSIC - SOBRAL", "SOBRAL", "PSICOLOGIA"),
        ("MÚSICA-LICENCIATURA", None, "MUSICA"),
        ("TECNOLOGIA EM GESTÃO DA QUALIDADE", None, "GESTAO DA QUALIDADE"),
        ("COMUNICAÇÃO SOCIAL - JORNALISMO", None, "JORNALISMO"),
        ("LICENCIATURA EM LETRAS - PORTUGUÊS", None, "LETRAS PORTUGUES"),
        ("LETRAS - LÍNGUA PORTUGUESA", None, "LETRAS PORTUGUES"),
        ("QUÍMICA (LICENCIATURA)", None, "QUIMICA"),
    ],
)
def test_chave_nome_normaliza(nome: str, sede: str | None, chave: str) -> None:
    assert chave_nome(nome, sede) == chave


def test_turnos_do_mesmo_unidade_nao_sao_ambiguidade() -> None:
    assert (
        match_unidade(_curso("ADMINISTRAÇÃO"), _UNIDADES, AjustesUnidades()) == "FEAAC"
    )


def test_modalidade_separa_presencial_de_ead() -> None:
    curso = _curso("ADMINISTRAÇÃO", ead=True, grau=None)
    assert match_unidade(curso, _UNIDADES, AjustesUnidades()) == "IUVI"


def test_sede_separa_o_mesmo_curso_em_cidades_diferentes() -> None:
    assert match_unidade(
        _curso("FINANÇAS", "Sobral"), _UNIDADES, AjustesUnidades()
    ) == ("SOBRAL")


def test_grau_desempata_unidades_diferentes() -> None:
    licenciatura = _curso("FÍSICA", grau="Licenciatura")
    assert match_unidade(licenciatura, _UNIDADES, AjustesUnidades()) == "CC"


def test_sem_grau_e_com_dois_unidades_fica_sem_unidade() -> None:
    assert (
        match_unidade(_curso("FÍSICA", grau=None), _UNIDADES, AjustesUnidades()) is None
    )


def test_nome_do_sigaa_que_comeca_com_o_do_inep() -> None:
    curso = _curso("LICENCIATURA INTERCULTURAL INDÍGENA", grau="Licenciatura")
    assert match_unidade(curso, _UNIDADES, AjustesUnidades()) == "CH"


def test_unidade_ignorado_sai_do_casamento() -> None:
    # o SIGAA grafa "MEDICINA - BARBALHA" com sede FORTALEZA
    barbalha = _curso("MEDICINA BARBALHA")
    assert match_unidade(barbalha, _UNIDADES, AjustesUnidades()) == "CARIRI"
    ajustes = AjustesUnidades(unidades_ignoradas=frozenset({"CARIRI"}))
    assert match_unidade(barbalha, _UNIDADES, ajustes) is None
    assert match_unidade(_curso("MEDICINA"), _UNIDADES, ajustes) == "FACMED"


def test_ajuste_manual_vence_o_nome() -> None:
    ajustes = AjustesUnidades(cursos={7: "CH"})
    curso = _curso("CURSO EXTINTO", codigo=7)
    assert match_unidade(curso, _UNIDADES, AjustesUnidades()) is None
    assert match_unidade(curso, _UNIDADES, ajustes) == "CH"


def test_parse_ajustes_e_problemas() -> None:
    ajustes = parse_ajustes(
        {
            "_sobre": "nota",
            "unidades_ignoradas": {"CARIRI": "UFCA", "NAOEXISTE": "x"},
            "cursos": {"7": {"unidade": "CH", "motivo": "m"}, "8": "ZZ"},
        }
    )
    assert ajustes.cursos == {7: "CH", 8: "ZZ"}
    assert problemas_ajustes(_UNIDADES, ajustes) == [
        "curso 8 -> unidade 'ZZ' inexistente",
        "unidade ignorada 'NAOEXISTE' inexistente",
    ]


def test_parse_unidades_le_o_json_do_sigaa() -> None:
    unidades = parse_unidades(
        {
            "unidades": [
                {
                    "sigla": "CC",
                    "rotulo": "CC - CENTRO DE CIÊNCIAS",
                    "nome": "CENTRO DE CIÊNCIAS",
                    "cursos": [
                        {
                            "nome": "FÍSICA",
                            "sede": "FORTALEZA",
                            "modalidade": "Presencial",
                            "coordenador": None,
                        }
                    ],
                }
            ]
        }
    )
    assert unidades == [
        UnidadeSigaa(
            sigla="CC",
            rotulo="CC - CENTRO DE CIÊNCIAS",
            cursos=(CursoSigaa("FÍSICA", "FORTALEZA", "Presencial"),),
        )
    ]
    assert parse_unidades({}) == []


def _frames() -> tuple[pd.DataFrame, pd.DataFrame]:
    trajetoria = pd.DataFrame(
        {
            "codigo_ies": [1, 1, 1],
            "codigo_municipio": [100, 100, 100],
            "codigo_curso": [1, 2, 3],
            "nome_curso": ["ADMINISTRAÇÃO", "FINANÇAS", "CURSO NOVO"],
            "tp_modalidade_ensino_desc": ["Presencial"] * 3,
            "tp_grau_academico_desc": ["Bacharelado"] * 3,
            "ano_ingresso": [2018] * 3,
        }
    )
    qualidade = pd.DataFrame(
        {
            "codigo_ies": [1, 1],
            "codigo_municipio": [100, 100],
            "codigo_curso": [1, 4],
            "municipio_curso": ["FORTALEZA", "Fortaleza"],
            "area_avaliacao": ["ADMINISTRAÇÃO", "ADMINISTRAÇÃO"],
            "modalidade_ensino": ["Educação Presencial", "Educação a Distância"],
            "sigla_ies": ["UFT", "UFT"],
            "ano": [2019, 2019],
        }
    )
    return qualidade, trajetoria


def test_discover_unidades_agrupa_por_unidade_do_sigaa() -> None:
    qualidade, trajetoria = _frames()
    unidades = discover_unidades(qualidade, trajetoria, 1, _UNIDADES, AjustesUnidades())

    assert [(c.slug, c.codigos_curso) for c in unidades] == [
        ("feaac", frozenset({1, 2})),
        ("iuvi", frozenset({4})),
        ("fortaleza", frozenset({3})),  # sem unidade no SIGAA: fica na cidade
    ]
    feaac = unidades[0]
    assert feaac.nome == "FEAAC - CENTRO"
    assert feaac.sigla == "FEAAC"
    assert feaac.localidade == "Fortaleza"
    assert feaac.municipio == "UFT em Fortaleza"
    assert unidades[2].nome == "UFT em Fortaleza"
    assert unidades[2].sigla is None


def test_recorte_por_unidade_so_tem_os_cursos_dele() -> None:
    qualidade, trajetoria = _frames()
    unidades = discover_unidades(qualidade, trajetoria, 1, _UNIDADES, AjustesUnidades())
    feaac = build_scoped_data(qualidade, trajetoria, unidades[0])
    cidade = build_scoped_data(qualidade, trajetoria, unidades[2])
    assert sorted(feaac.cursos["codigo_curso"]) == [1, 2]
    assert sorted(feaac.qualidade["codigo_curso"]) == [1]
    assert list(cidade.cursos["codigo_curso"]) == [3]
