from pathlib import Path

import openpyxl
import pytest

from app.core.domain.value_objects.raw_file import RawFile
from app.core.infrastructure.readers.spreadsheet_reader import (
    HeaderNotFoundError,
    SpreadsheetReader,
)


def _raw(path: Path) -> RawFile:
    return RawFile(module="m", year_label="y", source_url="u", path=path)


def test_picks_data_sheet_and_header_row_zero(cpc_xlsx):
    reader = SpreadsheetReader(
        sheet_patterns=["cpc"],
        expected_labels=["Ano", "Código da IES", "Nome da IES", "CPC (Faixa)"],
    )
    frame = reader.read(_raw(cpc_xlsx))
    assert list(frame.columns)[:2] == ["Ano", "Código da IES"]
    assert "Coluna Extra" in frame.columns
    assert len(frame) == 3


def test_detects_header_row_block_and_split_header(trajetoria_xlsx):
    reader = SpreadsheetReader(
        sheet_patterns=["trajetoria", "indicadores"],
        expected_labels=[
            "Código da Instituição",
            "Ano de Ingresso",
            "Taxa de Permanência - TAP",
        ],
        header_block_rows=3,
    )
    frame = reader.read(_raw(trajetoria_xlsx))
    assert list(frame.columns) == [
        "Código da Instituição",
        "Ano de Ingresso",
        "Taxa de Permanência - TAP",
    ]
    assert len(frame) == 2
    assert frame.iloc[0].tolist() == [1, 2019, 98.5]


def test_raises_when_no_row_looks_like_the_header(cpc_xlsx):
    reader = SpreadsheetReader(
        sheet_patterns=["cpc"],
        expected_labels=["Coluna Que Não Existe", "Outra Inexistente"],
        min_header_matches=1,
    )
    with pytest.raises(HeaderNotFoundError, match="cabeçalho"):
        reader.read(_raw(cpc_xlsx))


def test_header_block_keeps_data_rows_when_file_has_shorter_header(tmp_path):
    # arquivo futuro sem a linha vazia e a de códigos técnicos: com bloco de 3,
    # as 2 primeiras turmas não podem sumir
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "INDICADORES_TRAJETORIA"
    ws.append(["Código da Instituição", "Ano de Ingresso"])
    ws.append([1, 2019])
    ws.append([2, 2020])
    ws.append([3, 2021])
    path = tmp_path / "trajetoria_curto.xlsx"
    wb.save(path)

    reader = SpreadsheetReader(
        sheet_patterns=["trajetoria"],
        expected_labels=["Código da Instituição", "Ano de Ingresso"],
        header_block_rows=3,
    )
    frame = reader.read(_raw(path))
    assert frame["Ano de Ingresso"].tolist() == [2019, 2020, 2021]
