from collections.abc import Mapping, Sequence

from app.core.domain.pipelines.spec_transformer import SpecTransformer
from app.core.domain.value_objects.column_spec import ColumnSpec

_REQUIRED_COLUMNS = ("codigo_ies", "codigo_curso", "ano_ingresso", "ano_referencia")


class TrajetoriaTransformer(SpecTransformer):
    """Transform do módulo Trajetória.

    ``specs``/``category_labels`` vêm de ``TrajetoriaRow`` +
    ``colunas_inep.json`` (montados no use case); aqui só fixa as colunas-chave
    obrigatórias (curso + turma + ano de referência).
    """

    def __init__(
        self,
        specs: Sequence[ColumnSpec],
        category_labels: Mapping[str, Mapping[int, str]],
    ) -> None:
        super().__init__(specs, category_labels, required_columns=_REQUIRED_COLUMNS)
