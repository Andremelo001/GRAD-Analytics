import re
from collections.abc import Iterator, Sequence
from pathlib import Path

from loguru import logger

from app.core.config.settings import settings
from app.core.domain.value_objects.raw_file import RawFile
from app.core.infrastructure.http.cached_download import resolve_downloads
from app.core.infrastructure.http.inep_client import InepClient
from app.core.infrastructure.scraping.govbr_tabs import parse_file_links, parse_tabs
from app.core.infrastructure.storage.raw_cache import RawCacheManifest

_YEAR_RE = re.compile(r"(?:19|20)\d{2}")
_CPC_RE = re.compile(r"cpc", re.IGNORECASE)
_EXCLUDE_RE = re.compile(r"idd|igc", re.IGNORECASE)


class InepQualidadeSource:
    """Descobre e baixa os arquivos CPC do portal de Indicadores de Qualidade.

    landing -> abas (por ano) -> subpágina -> link do arquivo ``CPC`` -> download.
    URL da landing e faixa de anos padrão vêm de ``settings`` (``.env``).
    """

    def __init__(
        self,
        *,
        client: InepClient | None = None,
        raw_dir: Path | None = None,
        landing_url: str | None = None,
        min_year: int | None = None,
        max_year: int | None = None,
    ) -> None:
        self._client = client or InepClient()
        self._raw_dir = raw_dir or (settings.raw_dir / "qualidade")
        self._landing = landing_url or settings.qualidade_landing_url
        self._min_year = (
            min_year if min_year is not None else settings.qualidade_min_year
        )
        self._max_year = (
            max_year if max_year is not None else settings.qualidade_max_year
        )

    def collect(
        self,
        *,
        years: Sequence[int] | None = None,
        force: bool = False,
    ) -> Iterator[RawFile]:
        wanted = set(years) if years is not None else None
        landing_html = self._client.get_text(self._landing)

        plan: list[tuple[int, str]] = []
        for tab in parse_tabs(landing_html, self._landing):
            year = self._year_of(tab.label)
            if year is None or not self._in_scope(year, wanted):
                continue
            target = self._pick_cpc(
                parse_file_links(self._client.get_text(tab.url), tab.url)
            )
            if target is None:
                logger.warning("qualidade | sem arquivo CPC na aba {}", tab.label)
                continue
            plan.append((year, target))

        manifest = RawCacheManifest(self._raw_dir)
        resolved = resolve_downloads(
            self._client,
            manifest,
            [(str(year), url) for year, url in plan],
            lambda key, url: self._raw_dir / key / url.rsplit("/", 1)[-1],
            force=force,
        )

        for (year, target), (path, changed) in zip(plan, resolved, strict=True):
            yield RawFile(
                module="qualidade",
                year_label=str(year),
                source_url=target,
                path=path,
                changed=changed,
            )

    def _in_scope(self, year: int, wanted: set[int] | None) -> bool:
        if wanted is not None:
            return year in wanted
        if year < self._min_year:
            return False
        return self._max_year is None or year <= self._max_year

    @staticmethod
    def _year_of(label: str) -> int | None:
        match = _YEAR_RE.search(label)
        return int(match.group()) if match else None

    @staticmethod
    def _pick_cpc(links: Sequence[str]) -> str | None:
        candidates = [
            url
            for url in links
            if _CPC_RE.search(url.rsplit("/", 1)[-1])
            and not _EXCLUDE_RE.search(url.rsplit("/", 1)[-1])
        ]
        candidates.sort(
            key=lambda url: (0 if url.lower().endswith(".xlsx") else 1, url)
        )
        return candidates[0] if candidates else None
