import math

import pandas as pd

from app.modules.dashboard.domain.shared import (
    Campus,
    ScopedData,
    build_escopo,
    discover_campi,
    records,
    scalar,
    slugify,
    with_course_name,
)


def test_build_scoped_data_filters_out_of_scope_rows(scoped_data: ScopedData) -> None:
    assert set(scoped_data.qualidade["codigo_curso"]) == {10, 20}
    assert set(scoped_data.trajetoria["codigo_curso"]) == {10, 30}


def test_build_scoped_data_catalog_merges_both_sources(scoped_data: ScopedData) -> None:
    # 10 e 30 vêm da trajetória, 20 só existe na qualidade -> catálogo tem os 3
    assert scoped_data.cursos["codigo_curso"].tolist() == [10, 20, 30]
    curso_20 = scoped_data.cursos.set_index("codigo_curso").loc[20]
    assert curso_20["nome_curso"] == "Curso Só Qualidade"  # veio de area_avaliacao
    assert curso_20["grau_academico"] is None


def test_build_scoped_data_attaches_course_name_to_qualidade(
    scoped_data: ScopedData,
) -> None:
    assert "nome_curso" in scoped_data.qualidade.columns
    nomes = scoped_data.qualidade.drop_duplicates("codigo_curso").set_index(
        "codigo_curso"
    )["nome_curso"]
    assert nomes.loc[10] == "Ciência da Computação"
    assert nomes.loc[20] == "Curso Só Qualidade"


def test_with_course_name_skips_when_already_present() -> None:
    frame = pd.DataFrame({"codigo_curso": [1], "nome_curso": ["Já Tem"]})
    cursos = pd.DataFrame({"codigo_curso": [1], "nome_curso": ["Outro Nome"]})
    out = with_course_name(frame, cursos)
    assert out["nome_curso"].tolist() == ["Já Tem"]


def test_with_course_name_returns_empty_frame_unchanged() -> None:
    frame = pd.DataFrame(columns=["codigo_curso"])
    cursos = pd.DataFrame({"codigo_curso": [1], "nome_curso": ["X"]})
    assert with_course_name(frame, cursos).empty


def test_build_escopo_reads_metadata_from_qualidade(
    scoped_data: ScopedData, campus: Campus
) -> None:
    escopo = build_escopo(scoped_data.qualidade, scoped_data.trajetoria, campus)
    assert escopo["nome_ies"] == "UF Teste"
    assert escopo["sigla_ies"] == "UFT"
    assert escopo["codigo_ies"] == 1
    assert escopo["codigo_municipio"] == 100
    assert escopo["municipio"] == "UFT em Teste"


def test_build_escopo_falls_back_to_trajetoria_when_qualidade_empty(
    campus: Campus,
) -> None:
    trajetoria = pd.DataFrame({"nome_ies": ["Só Trajetória"]})
    escopo = build_escopo(pd.DataFrame(), trajetoria, campus)
    assert escopo["nome_ies"] == "Só Trajetória"
    assert escopo["sigla_ies"] is None


def test_records_converts_nan_to_none_and_numpy_to_native() -> None:
    frame = pd.DataFrame({"a": [1, 2], "b": [1.5, math.nan]})
    rows = records(frame)
    assert rows == [{"a": 1, "b": 1.5}, {"a": 2, "b": None}]
    assert isinstance(rows[0]["a"], int)


def test_records_returns_empty_list_for_empty_frame() -> None:
    assert records(pd.DataFrame()) == []


def test_scalar_returns_none_for_none_row() -> None:
    assert scalar(None, "qualquer") is None


def test_scalar_returns_none_for_nan_value() -> None:
    row = pd.Series({"a": math.nan})
    assert scalar(row, "a") is None


def test_scalar_extracts_native_type() -> None:
    row = pd.Series({"a": 3})
    value = scalar(row, "a")
    assert value == 3
    assert isinstance(value, int)


def _campi_frames() -> tuple[pd.DataFrame, pd.DataFrame]:
    trajetoria = pd.DataFrame(
        {
            "codigo_ies": [1, 1, 1, 2],
            "codigo_municipio": [300, 100, 300, 999],
            "codigo_curso": [1, 2, 3, 4],
        }
    )
    qualidade = pd.DataFrame(
        {
            "codigo_ies": [1, 1, 1, 1],
            "codigo_municipio": [100, 100, 100, 555],
            "municipio_curso": ["CRATEÚS", "Crateús", "Crateús", "Polo EaD"],
            "sigla_ies": ["UFT", "UFT", "UFT", "UFT"],
        }
    )
    return qualidade, trajetoria


def test_discover_campi_one_per_municipality_with_trajetoria() -> None:
    qualidade, trajetoria = _campi_frames()
    campi = discover_campi(qualidade, trajetoria, codigo_ies=1)
    # 999 é de outra IES; 555 (polo) só aparece na qualidade -> fora
    assert [c.codigo_municipio for c in campi] == [100, 300]


def test_discover_campi_names_from_qualidade_most_common_spelling() -> None:
    qualidade, trajetoria = _campi_frames()
    campus = discover_campi(qualidade, trajetoria, codigo_ies=1)[0]
    assert campus.nome == "UFT em Crateús"
    assert campus.slug == "crateus"


def test_discover_campi_falls_back_to_code_without_name() -> None:
    qualidade, trajetoria = _campi_frames()
    campus = discover_campi(qualidade, trajetoria, codigo_ies=1)[1]
    assert campus.nome == "UFT em 300"
    assert campus.slug == "300"


def test_discover_campi_empty_trajetoria() -> None:
    qualidade, _ = _campi_frames()
    assert discover_campi(qualidade, pd.DataFrame(), codigo_ies=1) == []


def test_slugify_strips_accents_and_spaces() -> None:
    assert slugify("Juazeiro do Norte") == "juazeiro-do-norte"
    assert slugify("Quixadá") == "quixada"
