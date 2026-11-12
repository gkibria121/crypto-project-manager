from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    service_name: str = "pulseos-scraper"
    service_version: str = "0.2.0"
    scraper_port: int = 8000
    scraper_api_key: str = ""
    scraper_timeout_seconds: float = 15.0
    scraper_max_content_bytes: int = 3_145_728  # 3 MiB
    allow_private_networks: bool = False
    log_level: str = "INFO"
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 PulseOS-Scraper/2.0"
    )

    # Playwright JS-enabled browser settings
    playwright_enabled: bool = True
    playwright_headless: bool = True

    # Specialized platform API credentials (fallback when not supplied per-request)
    x_api_bearer_token: str = Field(
        default="",
        validation_alias=AliasChoices(
            "X_API_BEARER_TOKEN", "X_API_KEY", "TWITTER_BEARER_TOKEN"
        ),
    )
    linkedin_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("LINKEDIN_API_KEY", "LINKEDIN_ACCESS_TOKEN"),
    )
    telegram_bot_token: str = Field(
        default="",
        validation_alias=AliasChoices("TELEGRAM_BOT_TOKEN", "TELEGRAM_API_KEY"),
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
