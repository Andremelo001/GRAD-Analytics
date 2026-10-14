from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
from loguru import logger

from app.core.config.settings import settings
from app.core.infrastructure.storage.json_exporter import JsonExporter
from app.modules.dashboard.application.ports.dashboard_source import DashboardSource
from app.modules.dashboard.domain import shared
from app.modules.dashboard.domain.section import DashboardContext, DashboardSection
from app.modules.dashboard.domain.services import (
    alerts,
    campus_overview,
    campus_summary,
    course_comparison,
    course_profile,
    national_benchmarks,
    quality_areas,
    trajectory_areas,
    trajectory_comparison,
)
from app.modules.dashboard.infrastructure.sources.processed_csv_source import (
    ProcessedCsvSource,
)

# Um JSON por campus em app/data/processed/dashboard/<slug>.json, mais o
# index.json com a lista de campi (o front baixa só o campus escolhido).
_DIR_NAME = "dashboard"
_INDEX_NAME = "index"
# Um JSON por área de avaliação em dashboard/areas_qualidade/<slug>.json (todos
# os cursos do Brasil na edição mais recente da área), compartilhado entre os
# campi: o mapa da aba Qualidade baixa só a área do curso escolhido.
_AREAS_DIR_NAME = "areas_qualidade"
# Um JSON por área CINE em dashboard/trajetoria_areas/<slug>.json (a turma
# madura de cada curso do Brasil na área): as Comparações da Trajetória baixam
# só a área do curso escolhido.
_TRAJETORIA_AREAS_DIR_NAME = "trajetoria_areas"
# Resumo de todos os cursos de todos os campi (comparação entre campi).
_RESUMO_NAME = "resumo_campi"

# Ordem = ordem das seções no dashboard.json. Acrescentar uma seção nova
# é registrar mais uma linha aqui — não editar build_dashboard().
_SECTIONS: tuple[DashboardSection, ...] = (
    course_profile.CourseProfileSection(),
    course_comparison.CourseComparisonSection(),
    trajectory_comparison.TrajectoryComparisonSection(),
    campus_overview.CampusOverviewSection(),
    national_benchmarks.NationalBenchmarksSection(),
    alerts.AlertsSection(),
)


def build_dashboard(
    *, source: DashboardSource | None = None, out_dir: Path | None = None
) -> Path:
    """Lê qualidade.csv + trajetoria.csv[.gz] e grava um JSON por campus.

    Os campi são todos os municípios onde a IES configurada
    (``DASHBOARD_CODIGO_IES``) tem curso na trajetória. Cada campus vira
    ``<out_dir>/<slug>.json`` com a mesma estrutura, e ``index.json`` lista
    os campi. JSONs de campus que deixou de existir são apagados. Retorna
    ``out_dir`` (default: ``app/data/processed/dashboard/``).
    """
    source = source if source is not None else ProcessedCsvSource()
    out_dir = out_dir if out_dir is not None else settings.processed_dir / _DIR_NAME
    qualidade_nacional = source.read_qualidade()
    trajetoria_nacional = source.read_trajetoria()
    fontes = _build_fontes(source.read_meta())
    gerado_em = datetime.now(UTC).isoformat(timespec="seconds")

    campi = shared.discover_campi(
        qualidade_nacional, trajetoria_nacional, settings.dashboard_codigo_ies
    )
    if not campi:
        logger.warning(
            "dashboard | nenhum campus encontrado para a IES {} "
            "(ver DASHBOARD_CODIGO_IES no .env)",
            settings.dashboard_codigo_ies,
        )

    exporter = JsonExporter(out_dir=out_dir)
    index: list[dict[str, object]] = []
    escopos: list[shared.ScopedData] = []
    resumo: list[dict[str, object]] = []
    for campus in campi:
        data = shared.build_scoped_data(qualidade_nacional, trajetoria_nacional, campus)
        escopos.append(data)
        context = DashboardContext(
            data=data,
            qualidade_nacional=qualidade_nacional,
            trajetoria_nacional=trajetoria_nacional,
        )
        payload: dict[str, object] = {
            "gerado_em": gerado_em,
            "escopo": shared.build_escopo(data.qualidade, data.trajetoria, campus),
            "cursos": shared.records(data.cursos),
            "fontes": fontes,
        }
        for section in _SECTIONS:
            payload[section.key] = section.build(context)

        exporter.export(payload, campus.slug)
        index.append(
            {
                "slug": campus.slug,
                "nome": campus.nome,
                "codigo_municipio": campus.codigo_municipio,
                "total_cursos": len(data.cursos),
                "arquivo": f"{campus.slug}.json",
            }
        )
        resumo.append(
            {
                "slug": campus.slug,
                "nome": campus.nome,
                "cursos": campus_summary.build_resumo_cursos(data),
            }
        )
        logger.info("dashboard | {} | cursos={}", campus.nome, len(data.cursos))

    exporter.export(
        {
            "gerado_em": gerado_em,
            "codigo_ies": settings.dashboard_codigo_ies,
            "campi": index,
        },
        _INDEX_NAME,
    )
    exporter.export({"gerado_em": gerado_em, "campi": resumo}, _RESUMO_NAME)
    _remove_stale(
        out_dir,
        {f"{c.slug}.json" for c in campi}
        | {f"{_INDEX_NAME}.json", f"{_RESUMO_NAME}.json"},
    )
    _build_areas(qualidade_nacional, escopos, out_dir / _AREAS_DIR_NAME, gerado_em)
    _build_areas_trajetoria(
        trajetoria_nacional,
        qualidade_nacional,
        escopos,
        out_dir / _TRAJETORIA_AREAS_DIR_NAME,
        gerado_em,
    )
    return out_dir


def _build_areas(
    qualidade_nacional: pd.DataFrame,
    escopos: list[shared.ScopedData],
    areas_dir: Path,
    gerado_em: str,
) -> None:
    """Grava ``areas_qualidade/<slug>.json`` de cada área dos campi + o index."""
    exporter = JsonExporter(out_dir=areas_dir, indent=None)
    index: list[dict[str, object]] = []
    for area in quality_areas.areas_dos_campi(escopos):
        payload = quality_areas.build_area(
            qualidade_nacional, area, settings.dashboard_codigo_ies
        )
        if payload is None:
            continue
        slug = quality_areas.area_slug(area)
        exporter.export(payload, slug)
        cursos = payload["cursos"]
        index.append(
            {
                "slug": slug,
                "area_avaliacao": area,
                "ano": payload["ano"],
                "total_cursos": len(cursos) if isinstance(cursos, list) else 0,
                "arquivo": f"{slug}.json",
            }
        )
    JsonExporter(out_dir=areas_dir).export(
        {"gerado_em": gerado_em, "areas": index}, _INDEX_NAME
    )
    _remove_stale(
        areas_dir,
        {str(a["arquivo"]) for a in index} | {f"{_INDEX_NAME}.json"},
    )
    logger.info("dashboard | áreas de avaliação={}", len(index))


def _build_areas_trajetoria(
    trajetoria_nacional: pd.DataFrame,
    qualidade_nacional: pd.DataFrame,
    escopos: list[shared.ScopedData],
    areas_dir: Path,
    gerado_em: str,
) -> None:
    """Grava ``trajetoria_areas/<slug>.json`` de cada área CINE + o index."""
    exporter = JsonExporter(out_dir=areas_dir, indent=None)
    nomes = trajectory_areas.nomes_da_qualidade(qualidade_nacional)
    index: list[dict[str, object]] = []
    for area in trajectory_areas.areas_dos_campi(escopos):
        payload = trajectory_areas.build_area(
            trajetoria_nacional, nomes, area, settings.dashboard_codigo_ies
        )
        if payload is None:
            continue
        slug = trajectory_areas.area_slug(area)
        exporter.export(payload, slug)
        cursos = payload["cursos"]
        index.append(
            {
                "slug": slug,
                "area": area,
                "total_cursos": len(cursos) if isinstance(cursos, list) else 0,
                "arquivo": f"{slug}.json",
            }
        )
    JsonExporter(out_dir=areas_dir).export(
        {"gerado_em": gerado_em, "areas": index}, _INDEX_NAME
    )
    _remove_stale(
        areas_dir,
        {str(a["arquivo"]) for a in index} | {f"{_INDEX_NAME}.json"},
    )
    logger.info("dashboard | áreas CINE da trajetória={}", len(index))


def _remove_stale(out_dir: Path, keep: set[str]) -> None:
    """Apaga JSONs de campus que não saíram neste run (ex.: campus extinto)."""
    for path in out_dir.glob("*.json"):
        if path.name not in keep:
            path.unlink()
            logger.info("dashboard | removido {} (campus fora da lista)", path.name)


def _build_fontes(meta: dict[str, object]) -> dict[str, object]:
    """Data de geração + nº de linhas de cada CSV fonte (de ``_meta.json``).

    Só os campos relevantes pro front (não os de uso interno, tipo
    ``review_items``/``source_urls``).
    """
    fontes: dict[str, object] = {}
    for nome in ("qualidade", "trajetoria"):
        info = meta.get(nome)
        if isinstance(info, dict):
            fontes[nome] = {
                "gerado_em": info.get("generated_at"),
                "linhas": info.get("rows"),
            }
    return fontes
