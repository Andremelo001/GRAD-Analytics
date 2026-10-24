import pandas as pd

from app.modules.dashboard.domain.services import national_benchmarks
from app.modules.dashboard.domain.shared import Campus, ScopedData, build_scoped_data


def _peer_qualidade_row() -> pd.DataFrame:
    """Outra IES, mesma área de avaliação do curso 10 (Ciência da Computação)."""
    return pd.DataFrame(
        [
            {
                "codigo_ies": 7,
                "codigo_municipio": 500,
                "codigo_curso": 700,
                "ano": 2019,
                "area_avaliacao": "Ciência da Computação",
                "nome_ies": "Outra Federal",
                "sigla_ies": "OF",
                "cpc_continuo": 4.2,
                "cpc_faixa": "5",
                "conceito_enade_continuo": 4.3,
                "nota_padronizada_fg": 5.0,
                "nota_padronizada_ce": 5.0,
                "nota_padronizada_idd": 5.0,
                "nota_padronizada_org_didatico_pedagogica": 5.0,
                "nota_padronizada_infraestrutura": 5.0,
                "nota_padronizada_oportunidade_ampliacao": 5.0,
                "nota_padronizada_mestres": 5.0,
                "nota_padronizada_doutores": 5.0,
                "nota_padronizada_regime_trabalho": 5.0,
            }
        ]
    )


def _peer_trajetoria_row() -> pd.DataFrame:
    """Outra IES, mesma área CINE do curso 10, mesma coorte (2018/2019)."""
    return pd.DataFrame(
        [
            {
                "codigo_ies": 7,
                "codigo_municipio": 500,
                "codigo_curso": 700,
                "nome_curso": "Ciência da Computação",
                "nome_ies": "Outra Federal",
                "tp_grau_academico_desc": "Bacharelado",
                "tp_modalidade_ensino_desc": "Presencial",
                "nome_cine_area_geral": "Ciência da computação",
                "ano_ingresso": 2018,
                "ano_referencia": 2019,
                "qt_ingressante": 40,
                "qt_permanencia": 32,
                "qt_concluinte": 0,
                "qt_desistencia": 8,
                "qt_falecido": 0,
                "taxa_permanencia": 80.0,
                "taxa_conclusao_acumulada": 0.0,
                "taxa_desistencia_acumulada": 20.0,
                "taxa_desistencia_anual": 20.0,
            }
        ]
    )


def test_build_returns_all_sections(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    result = national_benchmarks.build(qualidade_raw, trajetoria_raw, scoped_data)
    assert set(result) == {
        "evolucao_cpc",
        "perfil_radar",
        "curva_sobrevivencia",
        "heatmap_evasao_anual",
        "campus",
        "distribuicao_uf",
        "ingressantes",
        "concluintes",
        "trajetoria_pares",
    }


def test_excludes_areas_the_campus_does_not_offer(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    result = national_benchmarks.build(qualidade_raw, trajetoria_raw, scoped_data)
    areas = {row["area_avaliacao"] for row in result["evolucao_cpc"]}
    assert "Outra Instituição" not in areas  # área que o campus não oferece


def test_evolucao_cpc_averages_across_peer_institutions(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    nacional = pd.concat([qualidade_raw, _peer_qualidade_row()], ignore_index=True)
    result = national_benchmarks.build(nacional, trajetoria_raw, scoped_data)
    row = next(
        r
        for r in result["evolucao_cpc"]
        if r["area_avaliacao"] == "Ciência da Computação" and r["ano"] == 2019
    )
    # curso 10 (3.8) + curso-par de outra IES (4.2) -> média nacional 4.0
    assert row["cpc_continuo_medio_nacional"] == 4.0
    assert row["quantidade_cursos_considerados"] == 2


def test_perfil_radar_nacional_is_per_area_and_year(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    nacional = pd.concat([qualidade_raw, _peer_qualidade_row()], ignore_index=True)
    result = national_benchmarks.build(nacional, trajetoria_raw, scoped_data)
    rows = {
        r["ano"]: r
        for r in result["perfil_radar"]
        if r["area_avaliacao"] == "Ciência da Computação"
    }
    # 2019: curso 10 (nota 4.0) + par (5.0) -> 4.5; 2017: só o curso 10 (3.0)
    assert rows[2019]["formacao_geral"] == 4.5
    assert rows[2019]["quantidade_cursos_considerados"] == 2
    assert rows[2017]["formacao_geral"] == 3.0


def test_perfil_radar_nacional_skips_years_the_campus_was_not_evaluated(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    edicao_nova = _peer_qualidade_row().assign(ano=2023)
    nacional = pd.concat([qualidade_raw, edicao_nova], ignore_index=True)
    result = national_benchmarks.build(nacional, trajetoria_raw, scoped_data)
    anos = {
        r["ano"]
        for r in result["perfil_radar"]
        if r["area_avaliacao"] == "Ciência da Computação"
    }
    # 2023 é a edição mais recente da área, mas o campus não foi avaliado nela
    assert anos == {2017, 2019}


def test_curva_sobrevivencia_nacional_aligns_by_anos_desde_ingresso(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    nacional = pd.concat([trajetoria_raw, _peer_trajetoria_row()], ignore_index=True)
    result = national_benchmarks.build(qualidade_raw, nacional, scoped_data)
    # curso 10, coorte 2018, 1 ano depois do ingresso (ano_referencia 2019): 10%
    # par, coorte 2018, 1 ano depois do ingresso (ano_referencia 2019): 20%
    row = next(
        r
        for r in result["curva_sobrevivencia"]
        if r["nome_cine_area_geral"] == "Ciência da computação"
        and r["anos_desde_ingresso"] == 1
    )
    assert row["taxa_desistencia_acumulada_media_nacional"] == 15.0
    assert row["quantidade_cursos_considerados"] == 2


def test_heatmap_evasao_nacional_groups_by_area_and_ano_referencia(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    nacional = pd.concat([trajetoria_raw, _peer_trajetoria_row()], ignore_index=True)
    result = national_benchmarks.build(qualidade_raw, nacional, scoped_data)
    row = next(
        r
        for r in result["heatmap_evasao_anual"]
        if r["nome_cine_area_geral"] == "Ciência da computação"
        and r["ano_referencia"] == 2019
    )
    assert row["taxa_desistencia_anual_media_nacional"] == 15.0


def test_campus_nacional_kpis_and_distribuicao(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    result = national_benchmarks.build(qualidade_raw, trajetoria_raw, scoped_data)
    campus = result["campus"]
    assert set(campus) == {"kpis", "distribuicao_cpc_faixa"}
    assert campus["kpis"]["quantidade_cursos_considerados"] >= 1
    faixas = {row["cpc_faixa"] for row in campus["distribuicao_cpc_faixa"]}
    assert faixas <= {"4", "2"}  # só as faixas dos cursos-pares do campus


def test_build_handles_empty_national_frames(scoped_data: ScopedData) -> None:
    result = national_benchmarks.build(pd.DataFrame(), pd.DataFrame(), scoped_data)
    assert result["evolucao_cpc"] == []
    assert result["perfil_radar"] == []
    assert result["curva_sobrevivencia"] == []
    assert result["heatmap_evasao_anual"] == []
    assert result["campus"]["kpis"]["quantidade_cursos_considerados"] == 0
    assert result["campus"]["distribuicao_cpc_faixa"] == []


def _with_uf(
    frame: pd.DataFrame, por_curso: dict[int, tuple[int, str]]
) -> pd.DataFrame:
    """Põe ``codigo_uf``/``sigla_uf`` nas linhas: CE (23) salvo ``por_curso``."""
    frame = frame.copy()
    frame["codigo_uf"] = 23
    frame["sigla_uf"] = "CE"
    for codigo, (codigo_uf, sigla) in por_curso.items():
        mask = frame["codigo_curso"] == codigo
        frame.loc[mask, "codigo_uf"] = codigo_uf
        frame.loc[mask, "sigla_uf"] = sigla
    return frame


def test_distribuicao_uf_has_one_item_per_campus_course(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    result = national_benchmarks.build(qualidade_raw, trajetoria_raw, scoped_data)
    codigos = [item["codigo_curso"] for item in result["distribuicao_uf"]]
    assert codigos == [int(c) for c in scoped_data.cursos["codigo_curso"]]


def test_distribuicao_uf_counts_peers_per_state(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, campus: Campus
) -> None:
    # curso-par (700) em SP, com turma no mesmo ano mais recente do curso 10
    par = _peer_trajetoria_row().assign(ano_ingresso=2020, ano_referencia=2021)
    trajetoria = _with_uf(
        pd.concat([trajetoria_raw, par], ignore_index=True), {700: (35, "SP")}
    )
    qualidade = _with_uf(
        pd.concat([qualidade_raw, _peer_qualidade_row()], ignore_index=True),
        {700: (35, "SP")},
    )
    scoped = build_scoped_data(qualidade, trajetoria, campus)
    result = national_benchmarks.build(qualidade, trajetoria, scoped)

    item = next(i for i in result["distribuicao_uf"] if i["codigo_curso"] == 10)
    assert item["sigla_uf_campus"] == "CE"
    assert item["nome_cine_area_geral"] == "Ciência da computação"
    assert item["area_avaliacao"] == "Ciência da Computação"
    assert item["ano_ingresso"] == 2020
    assert item["ano_cpc"] == 2019
    estados = {e["sigla_uf"]: e for e in item["estados"]}
    assert set(estados) == {"CE", "SP"}
    assert estados["CE"]["quantidade_cursos"] == 1  # o próprio curso do campus
    assert estados["SP"]["quantidade_cursos"] == 1
    assert estados["SP"]["qt_ingressante"] == 40
    assert estados["SP"]["taxa_desistencia_media"] == 20.0
    assert estados["SP"]["cpc_continuo_medio"] == 4.2
    assert estados["SP"]["quantidade_cursos_cpc"] == 1


def test_distribuicao_uf_without_state_columns_has_no_states(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    # fixtures sem codigo_uf/sigla_uf: ainda um item por curso, sem estados
    result = national_benchmarks.build(qualidade_raw, trajetoria_raw, scoped_data)
    assert all(item["estados"] == [] for item in result["distribuicao_uf"])


def test_ingressantes_nacional_averages_peer_cohorts(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    nacional = pd.concat([trajetoria_raw, _peer_trajetoria_row()], ignore_index=True)
    result = national_benchmarks.build(qualidade_raw, nacional, scoped_data)
    itens = result["ingressantes"]
    assert isinstance(itens, list)
    item = next(
        i for i in itens if i["codigo_curso"] == 10 and i["ano_ingresso"] == 2018
    )
    pares = nacional[
        (nacional["nome_cine_area_geral"] == "Ciência da computação")
        & (nacional["ano_ingresso"] == 2018)
    ].drop_duplicates("codigo_curso")
    assert item["quantidade_cursos_considerados"] == len(pares)
    assert item["qt_ingressante_media_nacional"] == round(
        float(pares["qt_ingressante"].mean()), 1
    )
    assert len(pares) == 2  # o curso do campus e o par de outra IES


def test_trajetoria_pares_compares_mature_cohort_with_national_peers(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, scoped_data: ScopedData
) -> None:
    def turma(codigo: int, ies: int, evasao: float) -> list[dict[str, object]]:
        return [
            {
                "codigo_ies": ies,
                "codigo_municipio": 500,
                "codigo_curso": codigo,
                "nome_curso": "Ciência da Computação",
                "tp_grau_academico_desc": "Bacharelado",
                "tp_modalidade_ensino_desc": "Presencial",
                "nome_cine_area_geral": "Ciência da computação",
                "ano_ingresso": 2010,
                "ano_referencia": 2010 + k,
                "prazo_integralizacao": 4,
                "taxa_desistencia_acumulada": evasao,
                "taxa_conclusao_acumulada": 100 - evasao,
            }
            for k in range(6)
        ]

    local = pd.DataFrame(turma(10, 1, 40.0))
    nacional = pd.DataFrame(turma(10, 1, 40.0) + turma(700, 7, 60.0))
    data = ScopedData(
        qualidade=scoped_data.qualidade, trajetoria=local, cursos=scoped_data.cursos
    )
    itens = national_benchmarks._trajetoria_pares(nacional, data)
    assert isinstance(itens, list)
    item = next(i for i in itens if i["codigo_curso"] == 10)
    assert item["ano_ingresso"] == 2010
    assert item["anos_desde_ingresso"] == 5
    assert sorted(item["evasao"]) == [40.0, 60.0]
