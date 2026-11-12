from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ContextType = Literal["website", "x_handle", "linkedin", "telegram", "message"]
ScrapeStatus = Literal[
    "pending", "running", "completed", "unreachable", "failed", "api_key_required"
]
SpecializedProvider = Literal["x", "linkedin", "telegram"]
WaitUntilMode = Literal["domcontentloaded", "load", "networkidle"]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


class ScrapeConfig(CamelModel):
    levels: int = Field(default=2, ge=1, le=5)
    max_pages: int = Field(default=10, ge=1, le=50)
    render_js: bool = True
    wait_until: WaitUntilMode = "networkidle"
    wait_for_ms: int = Field(default=1200, ge=0, le=10000)
    scroll_to_bottom: bool = True
    same_domain_only: bool = True
    include_subdomains: bool = True
    respect_robots_txt: bool = True
    extract_structured_data: bool = True
    extract_contacts: bool = True
    block_media: bool = True
    timeout_seconds: int = Field(default=15, ge=5, le=60)
    include_patterns: list[str] = Field(default_factory=list, max_length=20)
    exclude_patterns: list[str] = Field(default_factory=list, max_length=20)
    x_posts_limit: int = Field(default=10, ge=1, le=100)
    specialized_max_items: int = Field(default=10, ge=1, le=100)


class ProviderCredentials(CamelModel):
    x_bearer_token: str | None = None
    linkedin_access_token: str | None = None
    telegram_bot_token: str | None = None


class ScrapedHeading(CamelModel):
    level: str
    text: str


class ScrapedLink(CamelModel):
    url: str
    text: str = ""
    is_internal: bool = False
    category: str | None = None


class ScrapedPageResult(CamelModel):
    url: str
    canonical_url: str | None = None
    parent_url: str | None = None
    depth: int = Field(default=1, ge=1)
    http_status: int | None = None
    content_type: str | None = None
    render_mode: str = "playwright_js"
    title: str | None = None
    description: str | None = None
    language: str | None = None
    headings: list[ScrapedHeading] = Field(default_factory=list)
    text_content: str | None = None
    word_count: int = 0
    links: list[ScrapedLink] = Field(default_factory=list)
    social_links: dict[str, str] = Field(default_factory=dict)
    contacts: list[str] = Field(default_factory=list)
    signals: list[str] = Field(default_factory=list)
    meta_tags: dict[str, str] = Field(default_factory=dict)
    structured_data: list[Any] = Field(default_factory=list)
    platform_data: dict[str, Any] | None = None
    error_message: str | None = None
    duration_ms: int | None = None


class ScrapeRequest(CamelModel):
    target_type: ContextType
    target_value: str = Field(..., min_length=1, max_length=4000)
    config: ScrapeConfig = Field(default_factory=ScrapeConfig)
    provider_credentials: ProviderCredentials | None = None


class BatchScrapeRequest(CamelModel):
    targets: list[ScrapeRequest] = Field(..., min_length=1, max_length=20)
    config: ScrapeConfig | None = None
    provider_credentials: ProviderCredentials | None = None


class ScrapeResponse(CamelModel):
    target_type: ContextType
    target_value: str
    normalized_url: str | None = None
    status: ScrapeStatus
    reachable: bool = False
    http_status: int | None = None
    title: str | None = None
    description: str | None = None
    headings: list[str] = Field(default_factory=list)
    social_links: dict[str, str] = Field(default_factory=dict)
    signals: list[str] = Field(default_factory=list)
    raw_preview: str | None = None
    summary: str | None = None
    error_reason: str | None = None
    duration_ms: int = 0
    provider_used: str | None = None
    specialized_provider: SpecializedProvider | None = None
    requires_api_key: bool = False
    api_key_configured: bool = False
    levels_scraped: int = 0
    pages_scraped: int = 0
    contacts: list[str] = Field(default_factory=list)
    structured_data: list[Any] = Field(default_factory=list)
    platform_data: dict[str, Any] | None = None
    pages: list[ScrapedPageResult] = Field(default_factory=list)
    config_used: ScrapeConfig | None = None


class BatchScrapeResponse(CamelModel):
    results: list[ScrapeResponse]


class ScraperProviderStatusResponse(CamelModel):
    provider: SpecializedProvider
    env_var: str
    configured: bool
    preferred_method: str


class ScraperCapabilitiesResponse(CamelModel):
    playwright_available: bool
    providers: list[ScraperProviderStatusResponse]


class HealthResponse(CamelModel):
    status: Literal["ok"]
    service: str
    version: str
