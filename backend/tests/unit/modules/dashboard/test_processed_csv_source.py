from pathlib import Path

import pandas as pd
import pytest

from app.core.config.settings import settings
from app.modules.dashboard.infrastructure.sources.processed_csv_source import (
    ArquivoJsonInvalidoError,
    ProcessedCsvSource,
)


def test_reads_numeric_looking_text_columns_as_text(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    processed = tmp_path / "processed"
    processed.mkdir()
    pd.DataFrame({"codigo_cine_rotulo": ["04"], "codigo_curso": [1]}).to_csv(
        processed / "trajetoria.csv", index=False
    )
    pd.DataFrame({"cpc_faixa": ["4"], "sigla_ies": ["0"]}).to_csv(
        processed / "qualidade.csv", index=False
    )

    trajetoria = ProcessedCsvSource().read_trajetoria()
    qualidade = ProcessedCsvSource().read_qualidade()
    assert trajetoria["codigo_cine_rotulo"].tolist() == ["04"]
    assert qualidade["cpc_faixa"].tolist() == ["4"]  # texto, não 4.0


def test_read_unidades_ajustes_reports_line_of_json_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    arquivo = tmp_path / "unidades_ufc_ajustes.json"
    arquivo.write_text('{\n  "cursos": {\n    "1": "CT",\n  }\n}', encoding="utf-8")
    monkeypatch.setattr(settings, "unidades_ufc_ajustes_file", arquivo)

    with pytest.raises(ArquivoJsonInvalidoError, match="linha 4, coluna 3"):
        ProcessedCsvSource().read_unidades_ajustes()


def test_read_unidades_without_file_is_empty(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "unidades_ufc_file", tmp_path / "nao_existe.json")
    assert ProcessedCsvSource().read_unidades() == {}
