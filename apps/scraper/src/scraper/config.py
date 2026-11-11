from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    service_name: str = "pulseos-scraper"
    service_version: str = "0.1.0"
    scraper_port: int = 8000
    scraper_api_key: str = ""
    scraper_timeout_seconds: float = 12.0
    scraper_max_content_bytes: int = 2_097_152  # 2 MiB
    allow_private_networks: bool = False
    log_level: str = "INFO"
    user_agent: str = (
        "PulseOS-ContextScraper/1.0 (+https://pulseos.local; Web3-Research-Bot)"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
