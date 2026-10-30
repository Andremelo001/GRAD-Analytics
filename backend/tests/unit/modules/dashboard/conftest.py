import pandas as pd
import pytest

from app.modules.dashboard.domain.section import DashboardContext
from app.modules.dashboard.domain.shared import Campus, ScopedData, build_scoped_data

_IES = 1
_MUNICIPIO = 100

# curso 10: tem qualidade (2 anos) e trajetória (2 coortes)
# curso 20: só tem qualidade (não aparece na trajetória)
# curso 30: só tem trajetória (não aparece na qualidade)
# curso 99: fora do escopo (outra IES) -> deve ser filtrado

_QUALIDADE_RAW = pd.DataFrame(
    [
        {
            "codigo_ies": _IES,
            "codigo_municipio": _MUNICIPIO,
            "codigo_curso": 10,
            "ano": 2017,
            "area_avaliacao": "Ciência da Computação",
            "nome_ies": "UF Teste",
            "sigla_ies": "UFT",
            "cpc_continuo": 3.1,
            "cpc_faixa": "3",
            "conceito_enade_continuo": 3.2,
            "nota_padronizada_fg": 3.0,
            "nota_padronizada_ce": 3.0,
            "nota_padronizada_idd": 3.0,
            "nota_padronizada_org_didatico_pedagogica": 3.0,
            "nota_padronizada_infraestrutura": 3.0,
            "nota_padronizada_oportunidade_ampliacao": 3.0,
            "nota_padronizada_mestres": 3.0,
            "nota_padronizada_doutores": 3.0,
            "nota_padronizada_regime_trabalho": 3.0,
        },
        {
            "codigo_ies": _IES,
            "codigo_municipio": _MUNICIPIO,
            "codigo_curso": 10,
            "ano": 2019,
            "area_avaliacao": "Ciência da Computação",
            "nome_ies": "UF Teste",
            "sigla_ies": "UFT",
            "cpc_continuo": 3.8,
            "cpc_faixa": "4",
            "conceito_enade_continuo": 3.9,
            "nota_padronizada_fg": 4.0,
            "nota_padronizada_ce": 4.0,
            "nota_padronizada_idd": 4.0,
            "nota_padronizada_org_didatico_pedagogica": 4.0,
            "nota_padronizada_infraestrutura": 4.0,
            "nota_padronizada_oportunidade_ampliacao": 4.0,
            "nota_padronizada_mestres": 4.0,
            "nota_padronizada_doutores": 4.0,
            "nota_padronizada_regime_trabalho": 4.0,
        },
        {
            "codigo_ies": _IES,
            "codigo_municipio": _MUNICIPIO,
            "codigo_curso": 20,
            "ano": 2019,
            "area_avaliacao": "Curso Só Qualidade",
            "nome_ies": "UF Teste",
            "sigla_ies": "UFT",
            "cpc_continuo": 2.0,
            "cpc_faixa": "2",
            "conceito_enade_continuo": 2.1,
            "nota_padronizada_fg": 2.0,
            "nota_padronizada_ce": 2.0,
            "nota_padronizada_idd": 2.0,
            "nota_padronizada_org_didatico_pedagogica": 2.0,
            "nota_padronizada_infraestrutura": 2.0,
            "nota_padronizada_oportunidade_ampliacao": 2.0,
            "nota_padronizada_mestres": 2.0,
            "nota_padronizada_doutores": 2.0,
            "nota_padronizada_regime_trabalho": 2.0,
        },
        {
            "codigo_ies": 2,  # fora do escopo
            "codigo_municipio": 999,
            "codigo_curso": 99,
            "ano": 2019,
            "area_avaliacao": "Outra Instituição",
            "nome_ies": "Outra IES",
            "sigla_ies": "OIES",
            "cpc_continuo": 5.0,
            "cpc_faixa": "5",
            "conceito_enade_continuo": 5.0,
            "nota_padronizada_fg": 5.0,
            "nota_padronizada_ce": 5.0,
            "nota_padronizada_idd": 5.0,
            "nota_padronizada_org_didatico_pedagogica": 5.0,
            "nota_padronizada_infraestrutura": 5.0,
            "nota_padronizada_oportunidade_ampliacao": 5.0,
            "nota_padronizada_mestres": 5.0,
            "nota_padronizada_doutores": 5.0,
            "nota_padronizada_regime_trabalho": 5.0,
        },
    ]
)

_TRAJETORIA_RAW = pd.DataFrame(
    [
        {
            "codigo_ies": _IES,
            "codigo_municipio": _MUNICIPIO,
            "codigo_curso": 10,
            "nome_curso": "Ciência da Computação",
            "nome_ies": "UF Teste",
            "tp_grau_academico_desc": "Bacharelado",
            "tp_modalidade_ensino_desc": "Presencial",
            "nome_cine_area_geral": "Ciência da computação",
            "ano_ingresso": 2018,
            "ano_referencia": 2018,
            "qt_ingressante": 50,
            "qt_permanencia": 50,
            "qt_concluinte": 0,
            "qt_desistencia": 0,
            "qt_falecido": 0,
            "taxa_permanencia": 100.0,
            "taxa_conclusao_acumulada": 0.0,
            "taxa_desistencia_acumulada": 0.0,
            "taxa_desistencia_anual": 0.0,
        },
        {
            "codigo_ies": _IES,
            "codigo_municipio": _MUNICIPIO,
            "codigo_curso": 10,
            "nome_curso": "Ciência da Computação",
            "nome_ies": "UF Teste",
            "tp_grau_academico_desc": "Bacharelado",
            "tp_modalidade_ensino_desc": "Presencial",
            "nome_cine_area_geral": "Ciência da computação",
            "ano_ingresso": 2018,
            "ano_referencia": 2019,
            "qt_ingressante": 50,
            "qt_permanencia": 45,
            "qt_concluinte": 0,
            "qt_desistencia": 5,
            "qt_falecido": 0,
            "taxa_permanencia": 90.0,
            "taxa_conclusao_acumulada": 0.0,
            "taxa_desistencia_acumulada": 10.0,
            "taxa_desistencia_anual": 10.0,
        },
        {
            "codigo_ies": _IES,
            "codigo_municipio": _MUNICIPIO,
            "codigo_curso": 10,
            "nome_curso": "Ciência da Computação",
            "nome_ies": "UF Teste",
            "tp_grau_academico_desc": "Bacharelado",
            "tp_modalidade_ensino_desc": "Presencial",
            "nome_cine_area_geral": "Ciência da computação",
            "ano_ingresso": 2020,
            "ano_referencia": 2020,
            "qt_ingressante": 60,
            "qt_permanencia": 60,
            "qt_concluinte": 0,
            "qt_desistencia": 0,
            "qt_falecido": 0,
            "taxa_permanencia": 100.0,
            "taxa_conclusao_acumulada": 0.0,
            "taxa_desistencia_acumulada": 0.0,
            "taxa_desistencia_anual": 0.0,
        },
        {
            "codigo_ies": _IES,
            "codigo_municipio": _MUNICIPIO,
            "codigo_curso": 30,
            "nome_curso": "Somente Trajetória",
            "nome_ies": "UF Teste",
            "tp_grau_academico_desc": "Bacharelado",
            "tp_modalidade_ensino_desc": "Presencial",
            "nome_cine_area_geral": "Somente Trajetória",
            "ano_ingresso": 2019,
            "ano_referencia": 2019,
            "qt_ingressante": 30,
            "qt_permanencia": 28,
            "qt_concluinte": 0,
            "qt_desistencia": 2,
            "qt_falecido": 0,
            "taxa_permanencia": 93.3,
            "taxa_conclusao_acumulada": 0.0,
            "taxa_desistencia_acumulada": 6.7,
            "taxa_desistencia_anual": 6.7,
        },
        {
            "codigo_ies": 2,  # fora do escopo
            "codigo_municipio": 999,
            "codigo_curso": 99,
            "nome_curso": "Outro Curso",
            "nome_ies": "Outra IES",
            "tp_grau_academico_desc": "Bacharelado",
            "tp_modalidade_ensino_desc": "Presencial",
            "nome_cine_area_geral": "Outra Área CINE",
            "ano_ingresso": 2019,
            "ano_referencia": 2019,
            "qt_ingressante": 10,
            "qt_permanencia": 10,
            "qt_concluinte": 0,
            "qt_desistencia": 0,
            "qt_falecido": 0,
            "taxa_permanencia": 100.0,
            "taxa_conclusao_acumulada": 0.0,
            "taxa_desistencia_acumulada": 0.0,
            "taxa_desistencia_anual": 0.0,
        },
    ]
)


@pytest.fixture
def campus() -> Campus:
    return Campus(
        codigo_ies=_IES,
        codigo_municipio=_MUNICIPIO,
        nome="UFT em Teste",
        slug="teste",
    )


@pytest.fixture
def qualidade_raw() -> pd.DataFrame:
    return _QUALIDADE_RAW.copy()


@pytest.fixture
def trajetoria_raw() -> pd.DataFrame:
    return _TRAJETORIA_RAW.copy()


@pytest.fixture
def scoped_data(
    qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame, campus: Campus
) -> ScopedData:
    return build_scoped_data(qualidade_raw, trajetoria_raw, campus)


@pytest.fixture
def dashboard_context(
    scoped_data: ScopedData, qualidade_raw: pd.DataFrame, trajetoria_raw: pd.DataFrame
) -> DashboardContext:
    """Contexto completo pra testar ``DashboardSection.build`` de ponta a ponta.

    Usa os próprios fixtures brutos como "nacional" — são um superconjunto de
    ``scoped_data`` (incluem uma IES fora do escopo), então servem também pra
    exercitar o recorte de pares de ``national_benchmarks``.
    """
    return DashboardContext(
        data=scoped_data,
        qualidade_nacional=qualidade_raw,
        trajetoria_nacional=trajetoria_raw,
    )
