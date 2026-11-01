from datetime import UTC, datetime
from pathlib import Path

from app.core.config.settings import settings
from app.core.infrastructure.storage.json_exporter import JsonExporter
from app.modules.unidades.application.ports.unidades_source import UnidadesSource
from app.modules.unidades.infrastructure.sources.sigaa_unidades_source import (
    SigaaUnidadesSource,
)


class UnidadesVaziasError(RuntimeError):
    """A página veio sem curso nenhum: não sobrescreve o unidades_ufc.json bom."""


def build_unidades(
    *, source: UnidadesSource | None = None, out_file: Path | None = None
) -> Path:
    """Lê a lista de cursos do SIGAA e grava ``unidades_ufc.json`` na raiz.

    O arquivo guarda a página inteira (unidades, cursos e todas as colunas, mais
    título, descrição e filtros), não só o que o dashboard usa. Uma página
    sem curso nenhum (fora do ar, layout novo) levanta ``UnidadesVaziasError``
    em vez de apagar o arquivo anterior. Retorna o caminho gravado.
    """
    source = source if source is not None else SigaaUnidadesSource()
    out_file = out_file if out_file is not None else settings.unidades_ufc_file
    pagina = source.collect()
    if pagina.total_cursos == 0:
        msg = f"nenhum curso encontrado na página do SIGAA ({source.url})"
        raise UnidadesVaziasError(msg)

    payload: dict[str, object] = {
        "gerado_em": datetime.now(UTC).isoformat(timespec="seconds"),
        "fonte": source.url,
        "total_unidades": len(pagina.unidades),
        "total_cursos": pagina.total_cursos,
        **pagina.model_dump(mode="json"),
    }
    return JsonExporter(out_dir=out_file.parent).export(payload, out_file.stem)
