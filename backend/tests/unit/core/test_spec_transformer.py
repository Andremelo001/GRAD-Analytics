from pathlib import Path

import pandas as pd

from app.core.domain.pipelines.spec_transformer import SpecTransformer
from app.core.domain.value_objects.column_spec import ColumnSpec
from app.core.domain.value_objects.raw_file import RawFile

_RAW = RawFile(module="m", year_label="y", source_url="u", path=Path("x.xlsx"))

_SPECS = [
    ColumnSpec(normalized="ano", dtype="int", aliases=("Ano", "Edição")),
    ColumnSpec(normalized="nota", dtype="float", aliases=("Nota",)),
    ColumnSpec(normalized="faixa", dtype="string", aliases=("Faixa",)),
    ColumnSpec(normalized="cat", dtype="int", aliases=("Categoria",)),
    ColumnSpec(normalized="ausente", dtype="int", aliases=("Ausente",)),
    ColumnSpec(normalized="codigo_ies", dtype="int", aliases=("Código da IES",)),
]
_LABELS = {"cat": {1: "Um", 2: "Dois"}}


def _transform(required=("codigo_ies",)):
    frame = pd.DataFrame(
        {
            " ANO ": ["2023", "2024", "xx", "2025"],  # 'xx' invalido -> linha dropada
            "Nota": ["1.5", "2.0", "3", "0,75"],  # vírgula decimal inequívoca
            "Faixa": ["4", "SC", "-", "2"],
            "Categoria": ["1", "2", "1", "2"],
            "Sobra": ["a", "b", "c", "d"],  # nao mapeada
            "Código da IES": ["10", "20", "30", None],  # última linha sem chave
        }
    )
    return SpecTransformer(_SPECS, _LABELS, required_columns=required).transform(
        frame, _RAW
    )


def test_rename_and_column_report():
    result = _transform()
    assert set(result.frame.columns) == {
        "ano",
        "nota",
        "faixa",
        "cat",
        "codigo_ies",
        "cat_desc",
    }
    assert set(result.report.columns_matched) == {
        "ano",
        "nota",
        "faixa",
        "cat",
        "codigo_ies",
    }
    assert result.report.columns_unmatched_in_file == ["Sobra"]
    assert result.report.columns_missing_from_file == ["ausente"]


def test_alias_matches_alternative_label():
    frame = pd.DataFrame({"Edição": ["2017"], "Código da IES": ["1"]})
    result = SpecTransformer(_SPECS, required_columns=()).transform(frame, _RAW)
    assert result.frame["ano"].tolist() == [2017]


def test_comma_decimal_is_normalized():
    result = _transform(required=())  # sem exigir a chave, só a linha "xx" cai
    assert result.frame["nota"].tolist() == [1.5, 2.0, 0.75]


def test_bad_type_row_dropped_and_null_tokens_kept():
    result = _transform()
    assert result.report.rows_in == 4
    assert result.report.rows_dropped_bad_type == 1  # "xx"
    assert result.report.rows_dropped_missing_key == 1  # última linha, sem codigo_ies
    assert result.report.rows_out == 2
    assert result.frame["ano"].tolist() == [2023, 2024]
    assert result.frame["faixa"].tolist() == ["4", "SC"]


def test_required_columns_drop_rows_without_key():
    result = _transform(required=("codigo_ies",))
    assert all(result.frame["codigo_ies"].notna())

    unfiltered = _transform(required=())
    assert unfiltered.report.rows_dropped_missing_key == 0


def test_category_decode():
    result = _transform()
    assert result.frame["cat_desc"].tolist() == ["Um", "Dois"]


def test_sc_and_excel_errors_are_null_in_numeric_columns_only():
    frame = pd.DataFrame(
        {
            "Nota": ["SC", "#NÚM!", "#DIV/0!", "2,5"],
            "Faixa": ["SC", "SC", "3", "4"],
            "Código da IES": ["1", "2", "3", "4"],
        }
    )
    result = SpecTransformer(_SPECS, required_columns=("codigo_ies",)).transform(
        frame, _RAW
    )
    # nenhuma linha some: na coluna numérica "SC"/erro do Excel viram nulo...
    assert result.report.rows_dropped_bad_type == 0
    assert result.frame["nota"].isna().tolist() == [True, True, True, False]
    assert result.frame["nota"].iloc[3] == 2.5
    # ...e na de texto "SC" continua sendo o dado
    assert result.frame["faixa"].tolist() == ["SC", "SC", "3", "4"]


def test_fractional_value_in_int_column_drops_row_instead_of_rounding():
    frame = pd.DataFrame({"Ano": ["2023", "2023.7"], "Código da IES": ["1", "2"]})
    result = SpecTransformer(_SPECS, required_columns=("codigo_ies",)).transform(
        frame, _RAW
    )
    assert result.report.rows_dropped_bad_type == 1
    assert result.frame["codigo_ies"].tolist() == [1]


def test_zero_as_null_keeps_row_and_clears_value():
    frame = pd.DataFrame(
        {"Categoria": ["0", "2"], "Faixa": ["0", "3"], "Código da IES": ["1", "2"]}
    )
    result = SpecTransformer(
        _SPECS, required_columns=("codigo_ies",), zero_as_null=("cat", "faixa")
    ).transform(frame, _RAW)
    assert len(result.frame) == 2
    assert result.frame["cat"].isna().tolist() == [True, False]
    assert result.frame["faixa"].isna().tolist() == [True, False]


def test_unmapped_category_code_is_reported():
    frame = pd.DataFrame({"Categoria": ["1", "9"], "Código da IES": ["1", "2"]})
    result = SpecTransformer(
        _SPECS, _LABELS, required_columns=("codigo_ies",)
    ).transform(frame, _RAW)
    assert result.report.categories_unmapped == {"cat": [9]}
    assert result.frame["cat_desc"].isna().tolist() == [False, True]
