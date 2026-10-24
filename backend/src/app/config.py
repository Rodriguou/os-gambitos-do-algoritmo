"""Application configuration loaded from environment variables.

Every tunable (engine paths, search limits, Azure OpenAI credentials) is read
from the environment, so no secret is ever hard-coded and deployments can be
retuned without touching the code.
"""

from typing import Literal, cast

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ExplainerMode = Literal["rule", "llm"]


class Settings(BaseSettings):
    """Runtime settings for the analysis API."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    stockfish_path: str = "stockfish"
    stockfish_pool_size: int = 4

    default_depth: int = 18
    # Safety watchdog for the engine, not the normal search bound: the
    # depth above is what actually stops the search. A small cap here
    # would cut lines at different depths and make Multi-PV inconsistent.
    default_max_time_ms: int = 3_000
    default_multi_pv: int = 3

    explainer_default_mode: ExplainerMode = "rule"
    cache_max_size: int = 512

    # Shallower search used only by the advantage bar: it needs to be
    # fast and does not feed the didactic explanations.
    position_eval_depth: int = 12

    azure_openai_endpoint: str | None = None
    azure_openai_key: str | None = None
    azure_openai_deployment: str | None = None
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_timeout_s: float = 20.0
    azure_openai_max_retries: int = 0

    cors_origins: list[str] = ["*"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                inner = value[1:-1].strip()
                if not inner:
                    return []
                return [item.strip().strip("'\"") for item in inner.split(",") if item.strip()]
            return [item.strip() for item in value.split(",") if item.strip()]
        if isinstance(value, (list, tuple)):
            origins: list[str] = []
            for item in cast(list[object] | tuple[object, ...], value):
                if isinstance(item, str):
                    origins.append(item.strip())
                elif item is not None:
                    origins.append(f"{item}".strip())
            return origins
        return ["*"]


settings = Settings()
