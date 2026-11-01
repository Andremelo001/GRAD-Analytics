from typing import Protocol, runtime_checkable

import pandas as pd


@runtime_checkable
class DashboardSource(Protocol):
    """Fonte dos dois datasets nacionais já processados que o dashboard lê."""

    def read_qualidade(self) -> pd.DataFrame: ...

    def read_trajetoria(self) -> pd.DataFrame: ...

    def read_meta(self) -> dict[str, object]: ...

    def read_unidades(self) -> dict[str, object]:
        """``unidades_ufc.json`` (lista de cursos do SIGAA); ``{}`` sem o arquivo."""
        ...

    def read_unidades_ajustes(self) -> dict[str, object]:
        """``unidades_ufc_ajustes.json``; ``{}`` sem o arquivo."""
        ...
