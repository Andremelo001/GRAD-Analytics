from collections.abc import Mapping, Sequence

import pandas as pd

from app.core.domain.pipelines.spec_transformer import SpecTransformer
from app.core.domain.value_objects.column_spec import ColumnSpec

_REQUIRED_COLUMNS = ("codigo_ies", "codigo_curso")
# 0 = não informado: o CPC 2018 traz cursos com código de município 0 (de
# cidades diferentes) e sigla da IES "0".
_ZERO_AS_NULL = ("codigo_municipio", "sigla_ies")

_FAIXAS = {"1", "2", "3", "4", "5"}
_SEM_CONCEITO = "SC"


class CpcTransformer(SpecTransformer):
    """Transform do módulo Qualidade.

    ``specs``/``category_labels`` vêm de ``CpcRow`` + ``colunas_inep.json``
    (montados no use case); aqui ficam as colunas-chave obrigatórias e a
    padronização da faixa do CPC.
    """

    def __init__(
        self,
        specs: Sequence[ColumnSpec],
        category_labels: Mapping[str, Mapping[int, str]],
    ) -> None:
        super().__init__(
            specs,
            category_labels,
            required_columns=_REQUIRED_COLUMNS,
            zero_as_null=_ZERO_AS_NULL,
        )

    def _normalize(self, out: pd.DataFrame) -> pd.DataFrame:
        if "cpc_faixa" in out.columns:
            out["cpc_faixa"] = normalize_cpc_faixa(out["cpc_faixa"])
        return out


def normalize_cpc_faixa(faixa: pd.Series) -> pd.Series:
    """Faixa do CPC só com "1"-"5" ou "SC".

    O INEP grava na coluna, além da faixa, textos como "Curso não reconhecido
    até 31/12/2015" e "SC (Sub judice)", e deixa vazia (ou "-") a faixa de
    curso sem CPC calculado. Tudo isso quer dizer "sem conceito" -> "SC".
    Faixa numérica vinda como número ("4.0") vira "4".
    """
    text = faixa.astype("string").str.strip()
    as_number = pd.to_numeric(text, errors="coerce")
    whole = as_number.notna() & (as_number % 1 == 0)
    text = text.mask(whole, as_number.astype("Int64").astype("string"))
    return text.where(text.isin(_FAIXAS), _SEM_CONCEITO).astype("string")
