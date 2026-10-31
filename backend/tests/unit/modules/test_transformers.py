from pathlib import Path

import pandas as pd

from app.core.domain.value_objects.column_spec import ColumnSpec
from app.core.domain.value_objects.raw_file import RawFile
from app.modules.qualidade.domain.services.transform import (
    CpcTransformer,
    normalize_cpc_faixa,
)
from app.modules.trajetoria.domain.services.transform import TrajetoriaTransformer

_RAW = RawFile(module="m", year_label="y", source_url="u", path=Path("x.xlsx"))


def _spec(name: str, dtype: str) -> ColumnSpec:
    return ColumnSpec(normalized=name, dtype=dtype, aliases=(name,))  # type: ignore[arg-type]


def test_normalize_cpc_faixa_keeps_1_to_5_and_maps_the_rest_to_sc():
    nao_reconhecido = "Curso não reconhecido até 31/12/2015"
    raw = pd.Series(["4", "4.0", "SC", "SC (Sub judice)", nao_reconhecido, None, "7"])
    assert normalize_cpc_faixa(raw).tolist() == ["4", "4", "SC", "SC", "SC", "SC", "SC"]


def test_cpc_transformer_requires_course_and_clears_zero_codes():
    specs = [
        _spec("codigo_ies", "int"),
        _spec("codigo_curso", "int"),
        _spec("codigo_municipio", "int"),
        _spec("sigla_ies", "string"),
        _spec("cpc_faixa", "string"),
    ]
    frame = pd.DataFrame(
        {
            "codigo_ies": ["1", "2", "3"],
            "codigo_curso": ["10", None, "30"],
            "codigo_municipio": ["0", "2304400", "2311306"],
            "sigla_ies": ["0", "UFC", "UFC"],
            "cpc_faixa": ["Curso não reconhecido até 31/12/2015", "4", None],
        }
    )
    result = CpcTransformer(specs, {}).transform(frame, _RAW)
    assert result.report.rows_dropped_missing_key == 1  # o sem código de curso
    out = result.frame
    assert out["codigo_curso"].tolist() == [10, 30]
    assert out["codigo_municipio"].isna().tolist() == [True, False]
    assert out["sigla_ies"].isna().tolist() == [True, False]
    assert out["cpc_faixa"].tolist() == ["SC", "SC"]


def test_trajetoria_transformer_requires_course_cohort_and_reference_year():
    names = ["codigo_ies", "codigo_curso", "ano_ingresso", "ano_referencia"]
    frame = pd.DataFrame(
        {
            "codigo_ies": ["1", "1", "1", "1"],
            "codigo_curso": ["10", "10", None, "10"],
            "ano_ingresso": ["2020", None, "2020", "2020"],
            "ano_referencia": ["2021", "2021", "2021", None],
        }
    )
    result = TrajetoriaTransformer([_spec(n, "int") for n in names], {}).transform(
        frame, _RAW
    )
    assert result.report.rows_dropped_missing_key == 3
    assert len(result.frame) == 1
