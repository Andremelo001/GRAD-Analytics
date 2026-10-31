from collections.abc import Sequence

from app.core.config.column_mapping import load_column_mapping
from app.core.config.settings import settings
from app.core.domain.pipelines.pipeline import DataPipeline
from app.core.domain.pipelines.report import ModuleReport
from app.core.domain.pipelines.schema import model_to_specs, validate_category_columns
from app.core.domain.pipelines.spec_transformer import CLEANING_VERSION
from app.core.infrastructure.readers.spreadsheet_reader import SpreadsheetReader
from app.core.infrastructure.storage.file_exporter import CsvExporter
from app.core.infrastructure.storage.meta_writer import (
    DatasetMeta,
    MetaWriter,
    read_previous_fingerprint,
)
from app.modules.trajetoria.application.ports.trajetoria_source import TrajetoriaSource
from app.modules.trajetoria.domain.schema import TrajetoriaRow
from app.modules.trajetoria.domain.services.transform import TrajetoriaTransformer
from app.modules.trajetoria.infrastructure.sources.inep_trajetoria_source import (
    InepTrajetoriaSource,
)

_MODULE = "trajetoria"
# uma linha por curso, turma e ano de acompanhamento
_UNIQUE_KEY = ("codigo_curso", "ano_ingresso", "ano_referencia")
_SHEET_PATTERNS = ("trajetoria", "fluxo", "indicadores")
_HEADER_BLOCK_ROWS = 3


def build_trajetoria_dataset(
    *,
    source: TrajetoriaSource | None = None,
    years: Sequence[int] | None = None,
    force: bool = False,
) -> ModuleReport:
    """Executa o pipeline do módulo Trajetória e grava ``trajetoria.csv`` + meta."""
    mapping = load_column_mapping(_MODULE)
    context = f"{settings.colunas_inep_file.name} [{_MODULE}]"
    specs = model_to_specs(TrajetoriaRow, mapping.colunas, context=context)
    validate_category_columns(specs, mapping.categorias, context=context)
    pipeline = DataPipeline(
        module=_MODULE,
        source=source if source is not None else InepTrajetoriaSource(),
        reader=SpreadsheetReader(
            sheet_patterns=_SHEET_PATTERNS,
            # todos os nomes conhecidos de cada coluna, não só o atual: arquivos
            # antigos usam os nomes antigos (inclusive na 2ª linha do cabeçalho)
            expected_labels=[alias for spec in specs for alias in spec.aliases],
            # metade das colunas do schema: uma linha qualquer não chega lá
            min_header_matches=len(specs) // 2,
            header_block_rows=_HEADER_BLOCK_ROWS,
        ),
        transformer=TrajetoriaTransformer(specs, mapping.categorias),
        exporter=CsvExporter(),
        # nomes das colunas + versão das regras de limpeza: mudou um dos dois,
        # o CSV anterior não serve e o módulo é reprocessado do cache
        config_fingerprint=f"{mapping.fingerprint()}-limpeza{CLEANING_VERSION}",
        previous_config_fingerprint=read_previous_fingerprint(_MODULE),
        unique_key=_UNIQUE_KEY,
    )
    report = pipeline.run(years=years, force=force)
    _write_meta(report)
    return report


def _write_meta(report: ModuleReport) -> None:
    if report.output_path is None or report.reused:
        return
    source_urls = sorted(
        {fr.raw_file.source_url for fr in report.file_reports if fr.raw_file.source_url}
    )
    review_items = report.review_items()
    MetaWriter().upsert(
        DatasetMeta(
            name=_MODULE,
            file=report.output_path.name,
            rows=report.rows_final,
            columns=report.columns,
            source_urls=source_urls,
            review_needed=bool(review_items),
            review_items=review_items,
            mapping_fingerprint=report.config_fingerprint,
        )
    )
