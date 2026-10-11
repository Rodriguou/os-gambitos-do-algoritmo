"""Application configuration loaded from environment variables.

Every tunable (engine paths, search limits, Azure OpenAI credentials) is read
from the environment, so no secret is ever hard-coded and deployments can be
retuned without touching the code.
"""

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

ExplainerMode = Literal["rule", "llm"]


class Settings(BaseSettings):
    """Runtime settings for the analysis API."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    stockfish_path: str = "stockfish"
    stockfish_pool_size: int = 4

    default_depth: int = 18
    default_max_time_ms: int = 300
    default_multi_pv: int = 3

    explainer_default_mode: ExplainerMode = "rule"
    cache_max_size: int = 512

    azure_openai_endpoint: str | None = None
    azure_openai_key: str | None = None
    azure_openai_deployment: str | None = None
    azure_openai_api_version: str = "2024-10-21"

    cors_origins: list[str] = ["*"]


settings = Settings()
