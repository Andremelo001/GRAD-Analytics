from dataclasses import replace
from pathlib import Path

import pandas as pd

from app.core.domain.interfaces.transformer import TransformResult
from app.core.domain.pipelines.pipeline import DataPipeline
from app.core.domain.pipelines.report import FileReport
from app.core.domain.value_objects.raw_file import RawFile

_RAW = RawFile(module="m", year_label="2023", source_url="u", path=Path("x.xlsx"))


class _FakeSource:
    def __init__(self, raw_files: list[RawFile]) -> None:
        self._raw_files = raw_files

    def collect(self, *, years=None, force=False):
        return list(self._raw_files)


class _FakeReader:
    def read(self, raw: RawFile) -> pd.DataFrame:
        return pd.DataFrame({"a": [1]})


class _FakeTransformer:
    def transform(self, frame: pd.DataFrame, raw: RawFile) -> TransformResult:
        return TransformResult(
            frame=frame, report=FileReport(raw_file=raw, rows_in=1, rows_out=1)
        )


class _FakeExporter:
    def __init__(self, existing: Path | None) -> None:
        self._existing = existing
        self.export_calls = 0

    def exists(self, name: str) -> Path | None:
        return self._existing

    def export(self, frame: pd.DataFrame, name: str) -> Path:
        self.export_calls += 1
        return Path(f"{name}.csv")


def _pipeline(exporter: _FakeExporter, raw_files: list[RawFile]) -> DataPipeline:
    return DataPipeline(
        module="m",
        source=_FakeSource(raw_files),
        reader=_FakeReader(),
        transformer=_FakeTransformer(),
        exporter=exporter,
    )


def test_skips_regeneration_when_nothing_changed_and_output_exists():
    exporter = _FakeExporter(existing=Path("m.csv"))
    unchanged = replace(_RAW, changed=False)
    report = _pipeline(exporter, [unchanged]).run()

    assert report.reused is True
    assert report.output_path == Path("m.csv")
    assert exporter.export_calls == 0


def test_rebuilds_when_something_changed():
    exporter = _FakeExporter(existing=Path("m.csv"))
    changed = replace(_RAW, changed=True)
    report = _pipeline(exporter, [changed]).run()

    assert report.reused is False
    assert exporter.export_calls == 1


def test_rebuilds_when_nothing_changed_but_no_previous_output():
    exporter = _FakeExporter(existing=None)
    unchanged = replace(_RAW, changed=False)
    report = _pipeline(exporter, [unchanged]).run()

    assert report.reused is False
    assert exporter.export_calls == 1


def _pipeline_with_config(
    exporter: _FakeExporter,
    raw_files: list[RawFile],
    current: str,
    previous: str | None,
) -> DataPipeline:
    return DataPipeline(
        module="m",
        source=_FakeSource(raw_files),
        reader=_FakeReader(),
        transformer=_FakeTransformer(),
        exporter=exporter,
        config_fingerprint=current,
        previous_config_fingerprint=previous,
    )


def test_reuses_when_source_and_column_config_unchanged():
    exporter = _FakeExporter(existing=Path("m.csv"))
    unchanged = replace(_RAW, changed=False)
    report = _pipeline_with_config(exporter, [unchanged], "abc", "abc").run()

    assert report.reused is True
    assert report.config_changed is False
    assert exporter.export_calls == 0


def test_rebuilds_from_cache_when_column_config_changed():
    # colunas_inep.json editado: fonte igual, mas o CSV anterior foi gerado
    # com outros nomes de coluna -> precisa reprocessar.
    exporter = _FakeExporter(existing=Path("m.csv"))
    unchanged = replace(_RAW, changed=False)
    report = _pipeline_with_config(exporter, [unchanged], "novo", "antigo").run()

    assert report.reused is False
    assert report.config_changed is True
    assert report.config_fingerprint == "novo"
    assert exporter.export_calls == 1


def test_missing_previous_fingerprint_counts_as_changed():
    exporter = _FakeExporter(existing=Path("m.csv"))
    unchanged = replace(_RAW, changed=False)
    report = _pipeline_with_config(exporter, [unchanged], "abc", None).run()

    assert report.reused is False
    assert exporter.export_calls == 1


class _PerFileReader:
    """Mesma chave (curso 1) nos dois arquivos, com valor diferente."""

    def read(self, raw: RawFile) -> pd.DataFrame:
        valor = 10 if raw.year_label == "2015-2024" else 20
        return pd.DataFrame({"curso": [1, 2], "valor": [valor, 5]})


class _CapturingExporter(_FakeExporter):
    def export(self, frame: pd.DataFrame, name: str) -> Path:
        self.frame = frame
        return super().export(frame, name)


def test_same_key_in_two_files_keeps_the_newest_file():
    exporter = _CapturingExporter(existing=None)
    older = replace(_RAW, year_label="2015-2024")
    newer = replace(_RAW, year_label="2015-2025")
    report = DataPipeline(
        module="m",
        source=_FakeSource([older, newer]),
        reader=_PerFileReader(),
        transformer=_FakeTransformer(),
        exporter=exporter,
        unique_key=("curso",),
    ).run()

    # curso 2 é idêntico nos dois -> some como duplicado exato; curso 1 difere
    assert report.duplicates_removed == 1
    assert report.key_duplicates_removed == 1
    assert sorted(exporter.frame.itertuples(index=False)) == [(1, 20), (2, 5)]
    assert list(exporter.frame.columns) == ["curso", "valor"]
