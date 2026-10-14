import pandas as pd

from app.modules.dashboard.domain.services import quality_areas
from app.modules.dashboard.domain.shared import ScopedData


def _curso(**kwargs: object) -> dict[str, object]:
    base: dict[str, object] = {
        "codigo_ies": 1,
        "nome_ies": "UF Teste",
        "sigla_ies": "UFT",
        "categoria_administrativa": "Pública Federal",
        "codigo_municipio": 100,
        "municipio_curso": "Cidade",
        "sigla_uf": "CE",
        "modalidade_ensino": "Educação Presencial",
        "area_avaliacao": "SISTEMAS DE INFORMAÇÃO",
        "ano": 2021,
        "cpc_continuo": 3.0107,
        "cpc_faixa": "4",
    }
    for coluna in quality_areas.course_profile.RADAR_FIELDS.values():
        base[coluna] = 3.0
    base.update(kwargs)
    return base


def _nacional() -> pd.DataFrame:
    return pd.DataFrame(
        [
            _curso(codigo_curso=10),
            _curso(codigo_curso=10, ano=2017, cpc_continuo=2.0),  # edição antiga
            _curso(
                codigo_curso=20,
                codigo_ies=2,
                nome_ies="Faculdade X",
                sigla_ies="FX",
                categoria_administrativa="Privada com fins lucrativos",
                codigo_municipio=200,
                municipio_curso="Outra",
                sigla_uf="SP",
                modalidade_ensino="Educação a Distância",
                cpc_continuo=None,
                cpc_faixa="SC",
            ),
            _curso(codigo_curso=30, area_avaliacao="DIREITO"),
        ]
    )


def test_build_area_uses_latest_edition_only() -> None:
    payload = quality_areas.build_area(_nacional(), "SISTEMAS DE INFORMAÇÃO", 1)
    assert payload is not None
    assert payload["ano"] == 2021
    cursos = payload["cursos"]
    assert isinstance(cursos, list)
    assert [c[0] for c in cursos] == [10, 20]  # sem o curso de DIREITO


def test_build_area_rows_follow_columns() -> None:
    payload = quality_areas.build_area(_nacional(), "SISTEMAS DE INFORMAÇÃO", 1)
    assert payload is not None
    colunas = payload["colunas"]
    assert isinstance(colunas, list)
    cursos = payload["cursos"]
    assert isinstance(cursos, list)
    linha = dict(zip(colunas, cursos[0], strict=True))
    assert linha["cpc_continuo"] == 3.011
    assert linha["cpc_faixa"] == 4
    assert linha["ead"] is False
    assert linha["idd"] == 3.0
    sem_conceito = dict(zip(colunas, cursos[1], strict=True))
    assert sem_conceito["cpc_continuo"] is None
    assert sem_conceito["cpc_faixa"] is None
    assert sem_conceito["ead"] is True


def test_build_area_dictionaries_and_network() -> None:
    payload = quality_areas.build_area(_nacional(), "SISTEMAS DE INFORMAÇÃO", 1)
    assert payload is not None
    assert payload["ies"] == {
        "1": ["UF Teste", "UFT", True],
        "2": ["Faculdade X", "FX", False],
    }
    assert payload["municipios"] == {"100": ["Cidade", "CE"], "200": ["Outra", "SP"]}


def test_build_area_unknown_area_returns_none() -> None:
    assert quality_areas.build_area(_nacional(), "MEDICINA", 1) is None


def test_publica_handles_inep_spellings() -> None:
    assert quality_areas.rede_publica("Federal") is True
    assert quality_areas.rede_publica("Pessoa Jurídica de Direito Público - Estadual")
    assert quality_areas.rede_publica("Especial") is True
    assert (
        quality_areas.rede_publica(
            "Pessoa Jurídica de Direito Privado - Sem fins lucrativos - "
            "Associação de Utilidade Pública"
        )
        is False
    )
    assert quality_areas.rede_publica("Comunitária/Confessional") is False
    assert quality_areas.rede_publica(None) is None


def test_areas_dos_campi_uses_latest_evaluation_of_each_course(
    scoped_data: ScopedData,
) -> None:
    antiga = scoped_data.qualidade.assign(
        area_avaliacao=["Área Antiga", "Ciência da Computação", "Curso Só Qualidade"]
    )
    data = ScopedData(
        qualidade=antiga, trajetoria=scoped_data.trajetoria, cursos=scoped_data.cursos
    )
    assert quality_areas.areas_dos_campi([data]) == [
        "Ciência da Computação",
        "Curso Só Qualidade",
    ]


def test_area_slug() -> None:
    assert (
        quality_areas.area_slug("CIÊNCIA DA COMPUTAÇÃO (BACHARELADO)")
        == "ciencia-da-computacao-bacharelado"
    )


def test_build_area_historico_column_has_every_edition() -> None:
    nacional = _nacional().assign(
        n_concluintes_inscritos=[40, 30, 10, 5],
        n_concluintes_participantes=[36, 21, 0, 5],
    )
    payload = quality_areas.build_area(nacional, "SISTEMAS DE INFORMAÇÃO", 1)
    assert payload is not None
    colunas = payload["colunas"]
    edicao = payload["colunas_edicao"]
    cursos = payload["cursos"]
    assert isinstance(colunas, list) and isinstance(edicao, list)
    assert isinstance(cursos, list)
    dez = dict(zip(colunas, cursos[0], strict=True))
    vinte = dict(zip(colunas, cursos[1], strict=True))
    edicoes = [dict(zip(edicao, e, strict=True)) for e in dez["historico"]]
    # curso 10: as duas edições (2017 e 2021), da mais antiga à mais recente
    assert [e["ano"] for e in edicoes] == [2017, 2021]
    assert edicoes[0]["n_concluintes_inscritos"] == 30
    assert edicoes[0]["n_concluintes_participantes"] == 21
    assert edicoes[0]["cpc_continuo"] == 2.0
    # curso 20: só 2021, sem conceito
    assert [e[0] for e in vinte["historico"]] == [2021]
    assert vinte["historico"][0][2] is None
