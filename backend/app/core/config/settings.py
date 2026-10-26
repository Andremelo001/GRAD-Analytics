from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_APP_DIR = Path(__file__).resolve().parents[2]  # .../backend/app
_REPO_ROOT = _APP_DIR.parent.parent  # backend/app -> backend -> raiz
# .env e colunas_inep.json moram na raiz do repositório; caminhos absolutos pra
# funcionar independente do diretório de onde o comando é rodado.
_ENV_FILE = _REPO_ROOT / ".env"


class Settings(BaseSettings):
    env: str = "local"
    log_level: str = "INFO"

    data_dir: Path = _APP_DIR / "data"

    http_timeout: float = 30.0
    http_user_agent: str = "GRAD-Analytics/0.1 (data pipeline)"
    http_max_retries: int = 3
    http_backoff: float = 2.0

    qualidade_landing_url: str = (
        "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/"
        "indicadores-educacionais/indicadores-de-qualidade-da-educacao-superior"
    )

    qualidade_min_year: int = 2015
    qualidade_max_year: int = 2025

    trajetoria_landing_url: str = (
        "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/"
        "indicadores-educacionais/indicadores-de-trajetoria-da-educacao-superior"
    )
    # None = sem restrição (processa todas as faixas encontradas na página).
    trajetoria_min_year: int | None = None
    trajetoria_max_year: int | None = None

    csv_gzip_threshold_mb: float = 40.0

    # Nomes das colunas dos arquivos do INEP + rótulos das categorias — fora do
    # código pra que uma coluna renomeada pelo INEP se resolva editando JSON.
    colunas_inep_file: Path = _REPO_ROOT / "colunas_inep.json"

    # Instituição do módulo dashboard (código INEP). Os campi não são
    # configurados: cada município onde ela tem curso vira um JSON.
    dashboard_codigo_ies: int = 583

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def processed_dir(self) -> Path:
        return self.data_dir / "processed"

    @property
    def csv_gzip_threshold_bytes(self) -> int:
        return int(self.csv_gzip_threshold_mb * 1024 * 1024)


settings = Settings()
