from loguru import logger

from app.core.config.settings import settings
from app.core.infrastructure.http.inep_client import InepClient
from app.modules.unidades.domain.schema import PaginaCursosSigaa
from app.modules.unidades.infrastructure.sources.sigaa_parser import parse_lista_cursos


class SigaaUnidadesSource:
    """Baixa e estrutura a lista pública de cursos de graduação do SIGAA.

    Uma página só, HTML estático (não precisa de sessão nem de JavaScript);
    o ``InepClient`` é usado só pelo GET com retry. URL em
    ``settings.sigaa_cursos_url`` (``.env``).
    """

    def __init__(self, *, url: str | None = None) -> None:
        self.url = url or settings.sigaa_cursos_url

    def collect(self) -> PaginaCursosSigaa:
        with InepClient() as client:
            html = client.get_text(self.url)
        pagina = parse_lista_cursos(html, self.url)
        logger.info(
            "unidades | SIGAA | {} unidades, {} cursos",
            len(pagina.unidades),
            pagina.total_cursos,
        )
        return pagina
