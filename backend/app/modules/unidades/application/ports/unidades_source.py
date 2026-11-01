from typing import Protocol, runtime_checkable

from app.modules.unidades.domain.schema import PaginaCursosSigaa


@runtime_checkable
class UnidadesSource(Protocol):
    """Fonte da lista de cursos por unidade (a página pública do SIGAA).

    ``url``: de onde a lista veio, gravada junto no ``unidades_ufc.json``.
    """

    url: str

    def collect(self) -> PaginaCursosSigaa: ...
