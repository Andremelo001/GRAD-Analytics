from collections.abc import Mapping, Sequence

import pandas as pd
from loguru import logger

from app.core.domain.interfaces.transformer import TransformResult
from app.core.domain.normalization import normalize_key
from app.core.domain.pipelines.report import FileReport
from app.core.domain.value_objects.column_spec import ColumnSpec, DType
from app.core.domain.value_objects.raw_file import RawFile

# Versão das regras de limpeza (deste arquivo e dos transformers dos módulos).
# Entra no hash que decide se o CSV anterior ainda serve (ver use cases): mudou
# uma regra -> incremente aqui, e o próximo run reprocessa a partir do cache,
# sem precisar de --force.
CLEANING_VERSION = 4

_NULL_TOKENS = {
    "",
    "-",
    ".",
    "nan",
    "none",
    "null",
    "n/a",
    "na",
    "--",
    "s/i",
    "sem informacao",
}


# Só em coluna numérica: o INEP escreve "SC" (sem conceito) numa coluna de
# número em vez de deixá-la vazia, e erro de fórmula do
# Excel (#NÚM!, #DIV/0!...) vaza pra planilha. Os dois querem dizer "sem
# valor" — não linha corrompida. Em coluna de texto "SC" é dado (CPC Faixa) e
# fica como está.
_NUMERIC_NULL_TOKENS = {"sc"}
_EXCEL_ERROR_PREFIX = "#"


def _is_null_token(series: pd.Series, *, numeric: bool = False) -> pd.Series:
    text = series.astype("string").str.strip().str.casefold()
    null = series.isna() | text.isin(_NULL_TOKENS)
    if numeric:
        null = (
            null
            | text.isin(_NUMERIC_NULL_TOKENS)
            | text.str.startswith(_EXCEL_ERROR_PREFIX).fillna(False)
        )
    return null


def _dot_decimal(text: pd.Series) -> pd.Series:
    """Vírgula decimal -> ponto, só quando inequívoco.

    Ex.: ``0,92`` -> ``0.92``; exige exatamente 1 vírgula e nenhum ponto.
    """
    has_one_comma = text.str.count(",").eq(1)
    has_dot = text.str.contains(".", regex=False)
    swap = (has_one_comma & ~has_dot).fillna(False)
    return text.mask(swap, text.str.replace(",", ".", regex=False))


def _coerce(series: pd.Series, dtype: DType) -> pd.Series:
    cleaned = series.mask(
        _is_null_token(series, numeric=dtype != "string"), other=pd.NA
    )
    if dtype == "string":
        return cleaned.astype("string").str.strip()
    text = _dot_decimal(cleaned.astype("string"))
    numeric = pd.to_numeric(text, errors="coerce")
    if dtype == "float":
        return numeric.astype("Float64")
    # inteiro com parte fracionária (3.7, ou "1,234" lido como 1.234) não é
    # arredondado: vira inválido e a linha é descartada e contada (D4)
    fractional = (numeric % 1 != 0).fillna(False)
    return numeric.mask(fractional).astype("Float64").astype("Int64")


def _find_match(spec: ColumnSpec, file_cols: Mapping[str, str]) -> str | None:
    for alias in spec.aliases:
        actual = file_cols.get(normalize_key(alias))
        if actual is not None:
            return actual
    return None


class SpecTransformer:
    """Renomeia, converte tipos, decodifica categorias e garante as colunas-chave.

    - Casa colunas do arquivo x qualquer alias de ``spec`` por chave normalizada.
    - Coluna do arquivo sem correspondência -> descartada + registrada.
    - ``spec`` sem coluna no arquivo -> registrada como ausente.
    - Valor não-nulo que não converte -> a linha é descartada e contada (D4).
    - Token nulo (``-``, ``.``, vazio, ...) -> ``<NA>`` sem descartar a linha (D3).
      Em coluna numérica também ``SC`` e erro do Excel (``#NÚM!``, ...).
    - Decimal com vírgula inequívoco -> convertido para ponto antes de coagir.
    - Inteiro com parte fracionária -> inválido (a linha é descartada), não
      arredondado.
    - ``zero_as_null``: colunas em que ``0`` quer dizer "não informado" (ex.:
      código de município 0) -> ``<NA>``, sem descartar a linha.
    - Linha sem valor em alguma coluna de ``required_columns`` -> descartada.
    - ``_normalize``: regras próprias do módulo (subclasses), depois das acima.
    - Para cada ``col`` em ``category_labels``: cria ``<col>_desc`` com o rótulo.
    """

    def __init__(
        self,
        specs: Sequence[ColumnSpec],
        category_labels: Mapping[str, Mapping[int, str]] | None = None,
        required_columns: Sequence[str] = (),
        zero_as_null: Sequence[str] = (),
    ) -> None:
        self._specs = list(specs)
        self._categories = dict(category_labels or {})
        self._required = list(required_columns)
        self._zero_as_null = list(zero_as_null)

    def transform(self, frame: pd.DataFrame, raw: RawFile) -> TransformResult:
        report = FileReport(raw_file=raw, rows_in=len(frame))

        rename, matched_specs = self._match_columns(frame, report)
        out = frame[list(rename)].rename(columns=rename)

        out = self._coerce_matched(out, matched_specs, report)
        out = self._zeros_to_null(out)
        out = self._drop_missing_required(out, report)
        out = self._normalize(out)
        out = self._decode_categories(out, report)

        out = out.reset_index(drop=True)
        report.rows_out = len(out)
        return TransformResult(frame=out, report=report)

    def _match_columns(
        self,
        frame: pd.DataFrame,
        report: FileReport,
    ) -> tuple[dict[str, str], list[ColumnSpec]]:
        file_cols: dict[str, str] = {}
        for col in frame.columns:
            key = normalize_key(col)
            if key in file_cols:
                logger.warning(
                    "coluna duplicada após normalizar | {!r} ~ {!r}",
                    col,
                    file_cols[key],
                )
            file_cols[key] = str(col)

        rename: dict[str, str] = {}
        matched_specs: list[ColumnSpec] = []
        for spec in self._specs:
            actual = _find_match(spec, file_cols)
            if actual is None:
                report.columns_missing_from_file.append(spec.normalized)
                continue
            rename[actual] = spec.normalized
            matched_specs.append(spec)
            report.columns_matched.append(spec.normalized)

        matched_actuals = set(rename)
        report.columns_unmatched_in_file = [
            str(col) for col in frame.columns if str(col) not in matched_actuals
        ]
        return rename, matched_specs

    @staticmethod
    def _coerce_matched(
        out: pd.DataFrame,
        matched_specs: Sequence[ColumnSpec],
        report: FileReport,
    ) -> pd.DataFrame:
        bad_mask = pd.Series(False, index=out.index)
        for spec in matched_specs:
            source = out[spec.normalized]
            coerced = _coerce(source, spec.dtype)
            meaningful = ~_is_null_token(source, numeric=spec.dtype != "string")
            bad_mask = bad_mask | (coerced.isna() & meaningful)
            out[spec.normalized] = coerced

        report.rows_dropped_bad_type = int(bad_mask.sum())
        return out.loc[~bad_mask] if report.rows_dropped_bad_type else out

    def _zeros_to_null(self, out: pd.DataFrame) -> pd.DataFrame:
        for col in self._zero_as_null:
            if col in out.columns:
                zero = out[col].astype("string").str.strip().eq("0").fillna(False)
                out[col] = out[col].mask(zero)
        return out

    def _normalize(self, out: pd.DataFrame) -> pd.DataFrame:
        """Gancho pra regras de limpeza de um módulo só (ex.: faixa do CPC)."""
        return out

    def _drop_missing_required(
        self, out: pd.DataFrame, report: FileReport
    ) -> pd.DataFrame:
        rows_before = len(out)
        for required in self._required:
            if required in out.columns:
                out = out.loc[out[required].notna()]
        report.rows_dropped_missing_key = rows_before - len(out)
        return out

    def _decode_categories(self, out: pd.DataFrame, report: FileReport) -> pd.DataFrame:
        for col, mapping in self._categories.items():
            if col in out.columns:
                out[f"{col}_desc"] = out[col].map(mapping).astype("string")
                # código novo do INEP sem rótulo em colunas_inep.json: o _desc
                # fica vazio -> registrado pra REVISAR, não some calado
                codes = out[col].dropna()
                unmapped = sorted({int(c) for c in codes} - set(mapping))
                if unmapped:
                    report.categories_unmapped[col] = unmapped
        return out
