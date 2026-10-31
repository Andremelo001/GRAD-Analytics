import re
from collections.abc import Mapping, Sequence

import pandas as pd
from loguru import logger

from app.core.domain.normalization import normalize_key
from app.core.domain.value_objects.raw_file import RawFile

# Linha de códigos técnicos sob o cabeçalho (ex.: CO_IES, TP_CATEGORIA).
_TECHNICAL_CODE_RE = re.compile(r"[A-Z][A-Z0-9_]*")


class HeaderNotFoundError(ValueError):
    """Nenhuma linha da planilha parece o cabeçalho esperado (layout mudou)."""


_DEFAULT_SKIP_SHEETS: tuple[str, ...] = (
    "atualizações",
    "atualizacoes",
    "dicionário",
    "dicionario",
    "sobre",
    "notas",
    "leia-me",
    "leiame",
)


class SpreadsheetReader:
    """Lê ``.xlsx``/``.xls``: escolhe a planilha e detecta a linha de cabeçalho.

    - Seleção da sheet: primeiro nome que casa ``sheet_patterns`` (regex);
      senão, primeira sheet fora de ``skip_sheet_names``.
    - Linha do cabeçalho: ``header_overrides`` (por nome de arquivo) > ``header_row``
      fixo > heurística (linha cujas células mais casam ``expected_labels``).
    - ``min_header_matches``: na heurística, quantos nomes esperados a melhor
      linha precisa casar; abaixo disso é ``HeaderNotFoundError`` em vez de
      seguir com a linha 0 (o INEP mudou o layout ou os nomes das colunas).
    - ``header_block_rows``: altura máxima do bloco de cabeçalho. Se > 1, os
      nomes vêm da linha ``header_row`` completados pela seguinte, e as linhas
      seguintes do bloco são descartadas **só se não forem dado**: vazias, só
      com códigos técnicos (``CO_IES``...) ou só com nomes de coluna. Se um
      arquivo vier com cabeçalho menor, as linhas de dado ficam.
    """

    def __init__(
        self,
        *,
        sheet_patterns: Sequence[str] = (),
        skip_sheet_names: Sequence[str] = _DEFAULT_SKIP_SHEETS,
        expected_labels: Sequence[str] = (),
        header_row: int | None = None,
        header_block_rows: int = 1,
        header_overrides: Mapping[str, int] | None = None,
        max_header_scan: int = 20,
        min_header_matches: int = 1,
    ) -> None:
        self._sheet_res = [
            re.compile(pattern, re.IGNORECASE) for pattern in sheet_patterns
        ]
        self._skip = {name.casefold() for name in skip_sheet_names}
        self._expected = {normalize_key(label) for label in expected_labels}
        self._header_row = header_row
        self._header_block_rows = max(1, header_block_rows)
        self._overrides = {
            key.casefold(): row for key, row in (header_overrides or {}).items()
        }
        self._max_scan = max_header_scan
        self._min_matches = min_header_matches

    def read(self, raw: RawFile) -> pd.DataFrame:
        # calamine (Rust) lê .xlsx/.xls/.xlsb com o mesmo comportamento e é
        # 3-6x mais rápido que openpyxl/xlrd nos arquivos grandes do INEP.
        excel = pd.ExcelFile(raw.path, engine="calamine")
        sheet = self._pick_sheet([str(name) for name in excel.sheet_names])
        header_row = self._resolve_header_row(raw, excel, sheet)

        frame = pd.read_excel(excel, sheet_name=sheet, header=header_row, dtype=object)
        if self._header_block_rows > 1:
            frame = self._merge_fill_header(excel, sheet, header_row + 1, frame)
            frame = self._drop_header_residue(frame, raw)
        frame.columns = pd.Index([str(col).strip() for col in frame.columns])

        logger.info(
            "read | {} sheet={!r} header_row={} block={} rows={} cols={}",
            raw.path.name,
            sheet,
            header_row,
            self._header_block_rows,
            len(frame),
            frame.shape[1],
        )
        return frame

    def _drop_header_residue(self, frame: pd.DataFrame, raw: RawFile) -> pd.DataFrame:
        expected = self._header_block_rows - 1
        residue = 0
        while residue < min(expected, len(frame)) and self._is_header_residue(
            frame.iloc[residue].tolist()
        ):
            residue += 1
        if residue < expected:
            logger.warning(
                "read | {} bloco de cabeçalho com {} linha(s) a menos que o "
                "esperado — as linhas seguintes parecem dado e foram mantidas",
                raw.path.name,
                expected - residue,
            )
        return frame.iloc[residue:].reset_index(drop=True)

    def _is_header_residue(self, values: Sequence[object]) -> bool:
        """Linha que ainda é cabeçalho, não dado.

        Vazia, só códigos técnicos de coluna (``CO_IES``, ...) ou só nomes de
        coluna esperados (2ª linha de um cabeçalho quebrado em duas).
        """
        cells = [str(v).strip() for v in values if not pd.isna(v) and str(v).strip()]
        return all(
            _TECHNICAL_CODE_RE.fullmatch(cell) or normalize_key(cell) in self._expected
            for cell in cells
        )

    def _pick_sheet(self, sheet_names: Sequence[str]) -> str:
        for pattern in self._sheet_res:
            for name in sheet_names:
                if pattern.search(name):
                    return name
        for name in sheet_names:
            if name.casefold() not in self._skip:
                return name
        return sheet_names[0]

    def _resolve_header_row(self, raw: RawFile, excel: pd.ExcelFile, sheet: str) -> int:
        override = self._overrides.get(raw.path.name.casefold())
        if override is not None:
            return override
        if self._header_row is not None:
            return self._header_row
        return self._detect_header_row(excel, sheet, raw.path.name)

    def _detect_header_row(
        self, excel: pd.ExcelFile, sheet: str, file_name: str = ""
    ) -> int:
        probe = pd.read_excel(
            excel, sheet_name=sheet, header=None, nrows=self._max_scan, dtype=object
        )
        best_row = 0
        best_score = -1
        for i in range(len(probe)):
            cells = {
                normalize_key(value)
                for value in probe.iloc[i].tolist()
                if value is not None and str(value).strip()
            }
            score = len(cells & self._expected) if self._expected else len(cells)
            if score > best_score:
                best_row, best_score = i, score
        if self._expected and best_score < self._min_matches:
            msg = (
                f"{file_name} (aba {sheet!r}): nenhuma das primeiras "
                f"{self._max_scan} linhas parece o cabeçalho — a melhor casou "
                f"{best_score} nome(s) de coluna, o mínimo é {self._min_matches}. "
                "O INEP pode ter mudado o layout: confira os nomes em "
                "colunas_inep.json (guia: COLUNAS_INEP.md)."
            )
            raise HeaderNotFoundError(msg)
        logger.info(
            "header_row detectado | sheet={!r} row={} score={}",
            sheet,
            best_row,
            best_score,
        )
        return best_row

    def _merge_fill_header(
        self,
        excel: pd.ExcelFile,
        sheet: str,
        fill_row: int,
        frame: pd.DataFrame,
    ) -> pd.DataFrame:
        fill = (
            pd.read_excel(
                excel,
                sheet_name=sheet,
                header=None,
                skiprows=fill_row,
                nrows=1,
                dtype=object,
            )
            .iloc[0]
            .tolist()
        )
        columns = list(frame.columns)
        for idx, col in enumerate(columns):
            if idx >= len(fill):
                break
            current = str(col).strip()
            alt = "" if fill[idx] is None else str(fill[idx]).strip()
            if not alt:
                continue
            looks_blank = current == "" or current.lower().startswith("unnamed")
            primary_matches = normalize_key(current) in self._expected
            alt_matches = normalize_key(alt) in self._expected
            if looks_blank or (not primary_matches and alt_matches):
                columns[idx] = alt
        frame.columns = pd.Index(columns)
        return frame
