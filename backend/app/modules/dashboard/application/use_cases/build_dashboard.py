from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
from loguru import logger

from app.core.config.settings import settings
from app.core.infrastructure.storage.json_exporter import JsonExporter
from app.modules.dashboard.application.ports.dashboard_source import DashboardSource
from app.modules.dashboard.domain import shared, unidade_mapping
from app.modules.dashboard.domain.section import DashboardContext, DashboardSection
from app.modules.dashboard.domain.services import (
    alerts,
    course_comparison,
    course_profile,
    national_benchmarks,
    quality_areas,
    trajectory_areas,
    trajectory_comparison,
    unidade_overview,
    unidade_summary,
)
from app.modules.dashboard.infrastructure.sources.processed_csv_source import (
    ProcessedCsvSource,
)

# Um JSON por unidade em app/data/processed/dashboard/<slug>.json, mais o
# index.json com a lista de unidades (o front baixa só a unidade escolhida).
_DIR_NAME = "dashboard"
_INDEX_NAME = "index"
# Um JSON por área de avaliação em dashboard/areas_qualidade/<slug>.json (todos
# os cursos do Brasil na edição mais recente da área), compartilhado entre os
# unidades: o mapa da aba Qualidade baixa só a área do curso escolhido.
_AREAS_DIR_NAME = "areas_qualidade"
# Um JSON por área CINE em dashboard/trajetoria_areas/<slug>.json (a turma
# madura de cada curso do Brasil na área): as Comparações da Trajetória baixam
# só a área do curso escolhido.
_TRAJETORIA_AREAS_DIR_NAME = "trajetoria_areas"
# Resumo de todos os cursos de todas as unidades (comparação entre unidades).
_RESUMO_NAME = "resumo_unidades"

# Ordem = ordem das seções no dashboard.json. Acrescentar uma seção nova
# é registrar mais uma linha aqui — não editar build_dashboard().
_SECTIONS: tuple[DashboardSection, ...] = (
    course_profile.CourseProfileSection(),
    course_comparison.CourseComparisonSection(),
    trajectory_comparison.TrajectoryComparisonSection(),
    unidade_overview.UnidadeOverviewSection(),
    national_benchmarks.NationalBenchmarksSection(),
    alerts.AlertsSection(),
)


def build_dashboard(
    *, source: DashboardSource | None = None, out_dir: Path | None = None
) -> Path:
    """Lê qualidade.csv + trajetoria.csv[.gz] e grava um JSON por unidade.

    As unidades são as da lista de cursos do SIGAA (``unidades_ufc.json``), com os
    cursos da IES configurada (``DASHBOARD_CODIGO_IES``) nos municípios onde
    ela tem curso na trajetória; curso sem unidade fica no recorte da cidade
    (ver ``shared.discover_unidades``). Cada unidade vira
    ``<out_dir>/<slug>.json`` com a mesma estrutura, e ``index.json`` lista
    as unidades. JSONs de unidade que deixou de existir são apagados. Retorna
    ``out_dir`` (default: ``app/data/processed/dashboard/``).
    """
    source = source if source is not None else ProcessedCsvSource()
    out_dir = out_dir if out_dir is not None else settings.processed_dir / _DIR_NAME
    qualidade_nacional = source.read_qualidade()
    trajetoria_nacional = source.read_trajetoria()
    fontes = _build_fontes(source.read_meta())
    gerado_em = datetime.now(UTC).isoformat(timespec="seconds")

    unidades_sigaa = unidade_mapping.parse_unidades(source.read_unidades())
    ajustes = unidade_mapping.parse_ajustes(source.read_unidades_ajustes())
    _check_unidades_sigaa(unidades_sigaa, ajustes)
    unidades = shared.discover_unidades(
        qualidade_nacional,
        trajetoria_nacional,
        settings.dashboard_codigo_ies,
        unidades_sigaa,
        ajustes,
    )
    if not unidades:
        logger.warning(
            "dashboard | nenhuma unidade encontrada para a IES {} "
            "(ver DASHBOARD_CODIGO_IES no .env)",
            settings.dashboard_codigo_ies,
        )

    exporter = JsonExporter(out_dir=out_dir)
    index: list[dict[str, object]] = []
    escopos: list[shared.ScopedData] = []
    resumo: list[dict[str, object]] = []
    for unidade in unidades:
        data = shared.build_scoped_data(
            qualidade_nacional, trajetoria_nacional, unidade
        )
        escopos.append(data)
        context = DashboardContext(
            data=data,
            qualidade_nacional=qualidade_nacional,
            trajetoria_nacional=trajetoria_nacional,
        )
        payload: dict[str, object] = {
            "gerado_em": gerado_em,
            "escopo": shared.build_escopo(data.qualidade, data.trajetoria, unidade),
            "cursos": shared.records(data.cursos),
            "fontes": fontes,
        }
        for section in _SECTIONS:
            payload[section.key] = section.build(context)

        exporter.export(payload, unidade.slug)
        if unidades_sigaa and unidade.sigla is None and unidade.codigos_curso:
            _warn_sem_unidade(unidade, data)
        index.append(
            {
                "slug": unidade.slug,
                "nome": unidade.nome,
                "sigla": unidade.sigla,
                "localidade": unidade.localidade,
                "codigo_municipio": unidade.codigo_municipio,
                "total_cursos": len(data.cursos),
                "arquivo": f"{unidade.slug}.json",
            }
        )
        resumo.append(
            {
                "slug": unidade.slug,
                "nome": unidade.nome,
                "sigla": unidade.sigla,
                "localidade": unidade.localidade,
                "cursos": unidade_summary.build_resumo_cursos(data),
            }
        )
        logger.info("dashboard | {} | cursos={}", unidade.nome, len(data.cursos))

    exporter.export(
        {
            "gerado_em": gerado_em,
            "codigo_ies": settings.dashboard_codigo_ies,
            "unidades": index,
        },
        _INDEX_NAME,
    )
    # compacto, como os das áreas: com todas as turmas maduras de cada curso
    # (o seletor de turma das Comparações), indentado ele passava de 1,5 MB
    JsonExporter(out_dir=out_dir, indent=None).export(
        {"gerado_em": gerado_em, "unidades": resumo}, _RESUMO_NAME
    )
    _remove_stale(
        out_dir,
        {f"{c.slug}.json" for c in unidades}
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


def _check_unidades_sigaa(
    unidades_sigaa: list[unidade_mapping.UnidadeSigaa],
    ajustes: unidade_mapping.AjustesUnidades,
) -> None:
    if not unidades_sigaa:
        logger.warning(
            "dashboard | {} sem unidade — recorte por cidade (rode "
            "'python -m app.cmd unidades')",
            settings.unidades_ufc_file.name,
        )
    for problema in unidade_mapping.problemas_ajustes(unidades_sigaa, ajustes):
        logger.warning(
            "REVISAR | {}: {}", settings.unidades_ufc_ajustes_file.name, problema
        )


def _warn_sem_unidade(unidade: shared.Unidade, data: shared.ScopedData) -> None:
    """Cursos que não casaram com nenhuma unidade do SIGAA (ficam na cidade)."""
    cursos = ", ".join(
        f"{codigo} {nome}"
        for codigo, nome in zip(
            data.cursos["codigo_curso"], data.cursos["nome_curso"], strict=True
        )
    )
    logger.warning(
        "REVISAR | {} curso(s) sem unidade no SIGAA -> '{}' ({}). Fixe a unidade "
        "em {}: {}",
        len(data.cursos),
        unidade.nome,
        unidade.slug,
        settings.unidades_ufc_ajustes_file.name,
        cursos,
    )


def _build_areas(
    qualidade_nacional: pd.DataFrame,
    escopos: list[shared.ScopedData],
    areas_dir: Path,
    gerado_em: str,
) -> None:
    """Grava ``areas_qualidade/<slug>.json`` de cada área das unidades + o index."""
    exporter = JsonExporter(out_dir=areas_dir, indent=None)
    index: list[dict[str, object]] = []
    for area in quality_areas.areas_das_unidades(escopos):
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
    for area in trajectory_areas.areas_das_unidades(escopos):
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
    """Apaga JSONs de unidade que não saíram neste run (ex.: unidade extinta)."""
    for path in out_dir.glob("*.json"):
        if path.name not in keep:
            path.unlink()
            logger.info("dashboard | removido {} (unidade fora da lista)", path.name)


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
