from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ContextType = Literal["website", "x_handle", "linkedin", "telegram", "message"]
ScrapeStatus = Literal["pending", "running", "completed", "unreachable", "failed"]


class CamelModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


class ScrapeRequest(CamelModel):
    target_type: ContextType
    target_value: str = Field(..., min_length=1, max_length=4000)


class BatchScrapeRequest(CamelModel):
    targets: list[ScrapeRequest] = Field(..., min_length=1, max_length=10)


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


class BatchScrapeResponse(CamelModel):
    results: list[ScrapeResponse]


class HealthResponse(CamelModel):
    status: Literal["ok"]
    service: str
    version: str
