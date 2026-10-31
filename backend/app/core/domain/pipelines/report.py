from dataclasses import dataclass, field
from pathlib import Path

from loguru import logger

from app.core.domain.value_objects.raw_file import RawFile

# Acima disso, linhas descartadas (tipo inválido ou sem chave) deixam de ser
# "o rodapé da planilha" e viram sinal de mudança no formato -> REVISAR.
MAX_ROWS_DROPPED_WITHOUT_REVIEW = 10


@dataclass
class FileReport:
    """Contadores de um arquivo bruto ao longo do transform."""

    raw_file: RawFile
    rows_in: int = 0
    rows_out: int = 0
    rows_dropped_bad_type: int = 0
    rows_dropped_missing_key: int = 0
    columns_matched: list[str] = field(default_factory=list)
    columns_unmatched_in_file: list[str] = field(default_factory=list)
    columns_missing_from_file: list[str] = field(default_factory=list)
    # coluna codificada -> códigos sem rótulo em colunas_inep.json
    categories_unmapped: dict[str, list[int]] = field(default_factory=dict)

    @property
    def rows_dropped(self) -> int:
        return self.rows_dropped_bad_type + self.rows_dropped_missing_key

    def needs_review(self, *, config_changed: bool = False) -> bool:
        """True se o arquivo merece um olhar humano.

        Motivos: coluna faltando/sem par, código de categoria sem rótulo ou
        mais de ``MAX_ROWS_DROPPED_WITHOUT_REVIEW`` linhas descartadas.

        Restrito a ``raw_file.changed`` de propósito: um arquivo antigo e já
        revisado (ex.: CPC 2015-2017, que estruturalmente não tem
        ``nota_padronizada_fg``) não deve gerar alerta toda vez que o
        pipeline roda de novo — só quando o arquivo em si mudou é que vale a
        pena olhar de novo. Exceção: ``config_changed`` (``colunas_inep.json``
        editado desde a última geração) reavalia todos os arquivos, pra quem
        editou ver se a correção resolveu.
        """
        if not (self.raw_file.changed or config_changed):
            return False
        return bool(
            self.columns_missing_from_file
            or self.columns_unmatched_in_file
            or self.categories_unmapped
            or self.rows_dropped > MAX_ROWS_DROPPED_WITHOUT_REVIEW
        )


@dataclass(frozen=True, slots=True)
class ReviewItem:
    """Um arquivo que merece revisão humana (colunas, categorias ou descartes)."""

    file: str
    year_label: str
    columns_missing_from_file: list[str]
    columns_unmatched_in_file: list[str]
    categories_unmapped: dict[str, list[int]] = field(default_factory=dict)
    rows_dropped: int = 0


@dataclass
class ModuleReport:
    """Resultado consolidado do pipeline de um módulo.

    ``reused=True`` quando nada mudou (nem a fonte nem a configuração de
    colunas) e o CSV anterior foi mantido como está. ``config_changed=True``
    quando o reprocessamento foi disparado por edição em ``colunas_inep.json``.
    """

    module: str
    file_reports: list[FileReport] = field(default_factory=list)
    rows_final: int = 0
    duplicates_removed: int = 0
    # linhas com a mesma chave e valores diferentes (mesmo dado em dois
    # arquivos): fica a do arquivo mais recente
    key_duplicates_removed: int = 0
    columns: list[str] = field(default_factory=list)
    output_path: Path | None = None
    reused: bool = False
    config_fingerprint: str | None = None
    config_changed: bool = False

    def review_items(self) -> list[ReviewItem]:
        return [
            ReviewItem(
                file=fr.raw_file.path.name,
                year_label=fr.raw_file.year_label,
                columns_missing_from_file=fr.columns_missing_from_file,
                columns_unmatched_in_file=fr.columns_unmatched_in_file,
                categories_unmapped=fr.categories_unmapped,
                rows_dropped=fr.rows_dropped,
            )
            for fr in self.file_reports
            if fr.needs_review(config_changed=self.config_changed)
        ]

    def log_summary(self) -> None:
        if self.reused:
            logger.info(
                "module {} | sem mudanças na fonte, mantém {}",
                self.module,
                self.output_path,
            )
            return
        logger.info(
            "module {} | files={} rows_final={} dups_removed={} "
            "key_dups_removed={} output={}",
            self.module,
            len(self.file_reports),
            self.rows_final,
            self.duplicates_removed,
            self.key_duplicates_removed,
            self.output_path,
        )
        for fr in self.file_reports:
            logger.info(
                "  file={} rows_in={} rows_out={} bad_type={} missing_key={} "
                "cols_matched={} cols_unmatched_in_file={} cols_missing_from_file={}",
                fr.raw_file.path.name,
                fr.rows_in,
                fr.rows_out,
                fr.rows_dropped_bad_type,
                fr.rows_dropped_missing_key,
                len(fr.columns_matched),
                len(fr.columns_unmatched_in_file),
                len(fr.columns_missing_from_file),
            )

        if self.key_duplicates_removed:
            logger.warning(
                "REVISAR | module={} {} linha(s) com a mesma chave em mais de um "
                "arquivo — mantida a do arquivo mais recente",
                self.module,
                self.key_duplicates_removed,
            )
        for item in self.review_items():
            logger.warning(
                "REVISAR | module={} file={} faltando={} novas_sem_par={} "
                "categorias_sem_rotulo={} linhas_descartadas={}"
                " — layout pode ter mudado; ajuste colunas_inep.json na raiz do repo",
                self.module,
                item.file,
                item.columns_missing_from_file,
                item.columns_unmatched_in_file,
                item.categories_unmapped,
                item.rows_dropped,
            )
