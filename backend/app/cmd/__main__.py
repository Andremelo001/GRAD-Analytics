import argparse
from collections.abc import Callable, Sequence

from loguru import logger

from app.core.config.column_mapping import ColumnMappingError
from app.core.config.log import configure_logging
from app.core.domain.pipelines.report import ModuleReport
from app.core.domain.pipelines.schema import SchemaMappingError
from app.core.infrastructure.readers.spreadsheet_reader import HeaderNotFoundError
from app.modules.dashboard.application.use_cases.build_dashboard import build_dashboard
from app.modules.qualidade.application.use_cases.build_qualidade_dataset import (
    build_qualidade_dataset,
)
from app.modules.trajetoria.application.use_cases.build_trajetoria_dataset import (
    build_trajetoria_dataset,
)

_Builder = Callable[..., ModuleReport]
_BUILDERS: dict[str, _Builder] = {
    "qualidade": build_qualidade_dataset,
    "trajetoria": build_trajetoria_dataset,
}
_DASHBOARD = "dashboard"


def _parse_years(raw: str | None) -> list[int] | None:
    if not raw:
        return None
    return [int(part) for part in raw.split(",") if part.strip()]


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="app.cmd",
        description="Pipelines de processamento de dados (PROGRAD Analytics).",
    )
    parser.add_argument("module", choices=[*_BUILDERS, _DASHBOARD, "all"])
    parser.add_argument(
        "--years",
        help="subconjunto de anos separados por vírgula, ex.: 2023,2022",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="rebaixa os arquivos brutos ignorando o cache em app/data/raw/",
    )
    args = parser.parse_args(argv)

    configure_logging()

    try:
        return _run(args)
    except (ColumnMappingError, SchemaMappingError) as exc:
        # Erro de edição no colunas_inep.json: mensagem direta, sem traceback,
        # pra quem editou o arquivo saber exatamente o que corrigir.
        logger.error("configuração de colunas inválida — {}", exc)
        return 1
    except HeaderNotFoundError as exc:
        logger.error("cabeçalho não encontrado — {}", exc)
        return 1


def _run(args: argparse.Namespace) -> int:
    if args.module == _DASHBOARD:
        path = build_dashboard()
        logger.info("dashboard concluído -> {}", path)
        return 0

    years = _parse_years(args.years)
    targets = list(_BUILDERS) if args.module == "all" else [args.module]

    pending_review: list[str] = []
    for name in targets:
        report = _BUILDERS[name](years=years, force=args.force)
        if report.reused:
            logger.info(
                "{} sem mudanças na fonte | mantém {}", name, report.output_path
            )
        else:
            logger.info(
                "{} concluído | {} linhas -> {}",
                name,
                report.rows_final,
                report.output_path,
            )
        if report.review_items():
            pending_review.append(name)

    if args.module == "all":
        path = build_dashboard()
        logger.info("dashboard concluído -> {}", path)

    if pending_review:
        logger.warning(
            "ATENÇÃO: {} módulo(s) com arquivo novo/mudado e coluna(s) para "
            "revisar — ver 'review_items' em app/data/processed/_meta.json: {}",
            len(pending_review),
            ", ".join(pending_review),
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
