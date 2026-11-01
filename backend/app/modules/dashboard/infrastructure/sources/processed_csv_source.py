import json
from pathlib import Path

import pandas as pd

from app.core.config.settings import settings
from app.core.infrastructure.storage.dataset_locator import find_dataset
from app.core.infrastructure.storage.meta_writer import read_meta

# Colunas de texto que parecem número: sem tipo explícito, o pandas lê o CSV e
# "04" (código CINE) vira 4, e a faixa do CPC vira float num ano sem "SC".
_QUALIDADE_TEXT = {"cpc_faixa": "string", "sigla_ies": "string"}
_TRAJETORIA_TEXT = {"codigo_cine_area_geral": "string", "codigo_cine_rotulo": "string"}


class ProcessedCsvSource:
    """Implementa ``DashboardSource`` lendo os CSVs já processados.

    Lê qualidade.csv/trajetoria.csv[.gz] de ``app/data/processed/`` e os
    JSONs de unidades da raiz (``unidades_ufc.json`` + ajustes).
    """

    def read_qualidade(self) -> pd.DataFrame:
        return pd.read_csv(
            find_dataset(settings.processed_dir, "qualidade"), dtype=_QUALIDADE_TEXT
        )

    def read_trajetoria(self) -> pd.DataFrame:
        return pd.read_csv(
            find_dataset(settings.processed_dir, "trajetoria"), dtype=_TRAJETORIA_TEXT
        )

    def read_meta(self) -> dict[str, object]:
        return read_meta()

    def read_unidades(self) -> dict[str, object]:
        return _read_json(settings.unidades_ufc_file)

    def read_unidades_ajustes(self) -> dict[str, object]:
        return _read_json(settings.unidades_ufc_ajustes_file)


class ArquivoJsonInvalidoError(ValueError):
    """``unidades_ufc.json``/``unidades_ufc_ajustes.json`` com erro de formato."""


def _read_json(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        # mesma mensagem do colunas_inep.json: quem edita à mão vê onde errou
        msg = (
            f"{path.name}: JSON inválido na linha {exc.lineno}, coluna {exc.colno} "
            f"({exc.msg}) — confira vírgulas, aspas e chaves perto desse ponto"
        )
        raise ArquivoJsonInvalidoError(msg) from exc
    return data if isinstance(data, dict) else {}
