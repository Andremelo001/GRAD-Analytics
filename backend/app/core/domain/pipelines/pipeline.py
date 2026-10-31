from collections.abc import Sequence

import pandas as pd
from loguru import logger

from app.core.domain.interfaces.data_source import DataSource
from app.core.domain.interfaces.exporter import Exporter
from app.core.domain.interfaces.reader import Reader
from app.core.domain.interfaces.transformer import Transformer
from app.core.domain.pipelines.report import ModuleReport

# Coluna auxiliar (removida antes de exportar): de qual arquivo veio a linha.
_SOURCE_COL = "__arquivo_origem"


class DataPipeline:
    """Orquestra os 4 estágios de um módulo: Extract -> Read -> Transform -> Load.

    Cada estágio é um Protocol (DataSource / Reader / Transformer / Exporter).
    Erros de linha e de coluna viram contadores no ``ModuleReport`` final,
    não exceptions.
    """

    def __init__(
        self,
        *,
        module: str,
        source: DataSource,
        reader: Reader,
        transformer: Transformer,
        exporter: Exporter,
        config_fingerprint: str | None = None,
        previous_config_fingerprint: str | None = None,
        unique_key: Sequence[str] = (),
    ) -> None:
        """Monta o pipeline de um módulo.

        ``config_fingerprint``: hash da configuração de colunas usada agora;
        ``previous_config_fingerprint``: o usado na última geração (do
        ``_meta.json``). Se diferirem, o CSV anterior não serve mais — foi
        gerado com outros nomes de coluna — e o módulo é reprocessado a partir
        dos arquivos em cache, mesmo sem nada novo na fonte.

        ``unique_key``: colunas que identificam uma linha (ex.: curso + ano).
        Depois de tirar as linhas idênticas, se a mesma chave ainda aparecer
        com valores diferentes — o mesmo dado publicado em dois arquivos —,
        fica a do arquivo mais recente (``year_label`` maior: "2015-2025" ganha
        de "2015-2024") e a ocorrência vai pro relatório.
        """
        self._module = module
        self._source = source
        self._reader = reader
        self._transformer = transformer
        self._exporter = exporter
        self._config_fingerprint = config_fingerprint
        self._unique_key = list(unique_key)
        self._config_changed = (
            config_fingerprint is not None
            and config_fingerprint != previous_config_fingerprint
        )

    def run(
        self,
        *,
        years: Sequence[int] | None = None,
        force: bool = False,
    ) -> ModuleReport:
        logger.info(
            "pipeline start | module={} years={} force={}", self._module, years, force
        )
        raw_files = list(self._source.collect(years=years, force=force))
        report = ModuleReport(
            module=self._module, config_fingerprint=self._config_fingerprint
        )

        if not raw_files:
            logger.warning("pipeline sem dados | module={}", self._module)
            report.log_summary()
            return report

        existing_output = self._exporter.exists(self._module)
        source_changed = any(raw.changed for raw in raw_files)
        if existing_output is not None and not source_changed:
            if not self._config_changed:
                report.output_path = existing_output
                report.reused = True
                report.log_summary()
                return report
            logger.info(
                "module {} | colunas_inep.json ou as regras de limpeza mudaram "
                "desde a última geração — "
                "reprocessando a partir dos arquivos em cache",
                self._module,
            )
        report.config_changed = self._config_changed

        frames: list[pd.DataFrame] = []
        for raw in raw_files:
            logger.info("read+transform | {}", raw.path.name)
            raw_frame = self._reader.read(raw)
            result = self._transformer.transform(raw_frame, raw)
            report.file_reports.append(result.report)
            if not result.frame.empty:
                frames.append(result.frame.assign(**{_SOURCE_COL: raw.year_label}))

        if not frames:
            logger.warning("pipeline sem dados | module={}", self._module)
            report.log_summary()
            return report

        combined = pd.concat(frames, ignore_index=True)
        data_cols = [col for col in combined.columns if col != _SOURCE_COL]
        rows_before = len(combined)
        combined = combined.drop_duplicates(subset=data_cols, ignore_index=True)
        report.duplicates_removed = rows_before - len(combined)
        combined, report.key_duplicates_removed = self._keep_newest_per_key(combined)
        combined = combined.drop(columns=_SOURCE_COL)
        report.rows_final = len(combined)
        report.columns = [str(col) for col in combined.columns]
        report.output_path = self._exporter.export(combined, self._module)

        report.log_summary()
        logger.info(
            "pipeline done | module={} rows_final={} -> {}",
            self._module,
            report.rows_final,
            report.output_path,
        )
        return report

    def _keep_newest_per_key(self, frame: pd.DataFrame) -> tuple[pd.DataFrame, int]:
        key = [col for col in self._unique_key if col in frame.columns]
        if not key:
            return frame, 0
        newest_first = frame.sort_values(_SOURCE_COL, ascending=False, kind="stable")
        kept = newest_first.drop_duplicates(subset=key, keep="first").sort_index()
        return kept.reset_index(drop=True), len(frame) - len(kept)
