import asyncio
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Request

from scraper.config import Settings, get_settings
from scraper.schemas import (
    BatchScrapeRequest,
    BatchScrapeResponse,
    ScraperCapabilitiesResponse,
    ScraperProviderStatusResponse,
    ScrapeRequest,
    ScrapeResponse,
    SpecializedProvider,
)
from scraper.security import verify_internal_api_key
from scraper.services.browser_fetcher import PLAYWRIGHT_INSTALLED, BrowserFetcher
from scraper.services.extractor import scrape_target
from scraper.services.specialized import PROVIDER_REQUIREMENTS

router = APIRouter(
    prefix="/api/v1/scrape",
    tags=["scrape"],
    dependencies=[Depends(verify_internal_api_key)],
)


def _get_http_client(request: Request) -> httpx.AsyncClient | None:
    return getattr(request.app.state, "http_client", None)


def _get_browser_fetcher(request: Request) -> BrowserFetcher | None:
    return getattr(request.app.state, "browser_fetcher", None)


@router.get(
    "/providers",
    response_model=ScraperCapabilitiesResponse,
    response_model_by_alias=True,
)
async def get_scraper_capabilities(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ScraperCapabilitiesResponse:
    key_map: dict[SpecializedProvider, str] = {
        "x": settings.x_api_bearer_token,
        "linkedin": settings.linkedin_api_key,
        "telegram": settings.telegram_bot_token,
    }
    providers = [
        ScraperProviderStatusResponse(
            provider=prov,
            env_var=meta["env_var"],
            configured=bool(key_map[prov].strip()),
            preferred_method=meta["preferred_method"],
        )
        for prov, meta in PROVIDER_REQUIREMENTS.items()
    ]
    return ScraperCapabilitiesResponse(
        playwright_available=PLAYWRIGHT_INSTALLED and settings.playwright_enabled,
        providers=providers,
    )


@router.post(
    "",
    response_model=ScrapeResponse,
    response_model_by_alias=True,
)
async def scrape_single_endpoint(
    payload: ScrapeRequest,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> ScrapeResponse:
    client = _get_http_client(request)
    browser_fetcher = _get_browser_fetcher(request)
    return await scrape_target(
        payload,
        settings=settings,
        client=client,
        browser_fetcher=browser_fetcher,
    )


@router.post(
    "/batch",
    response_model=BatchScrapeResponse,
    response_model_by_alias=True,
)
async def scrape_batch_endpoint(
    payload: BatchScrapeRequest,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> BatchScrapeResponse:
    client = _get_http_client(request)
    browser_fetcher = _get_browser_fetcher(request)
    semaphore = asyncio.Semaphore(3)

    async def _bounded_scrape(item: ScrapeRequest) -> ScrapeResponse:
        effective_item = item.model_copy(
            update={
                "config": payload.config if payload.config is not None else item.config,
                "provider_credentials": (
                    item.provider_credentials or payload.provider_credentials
                ),
            }
        )
        async with semaphore:
            return await scrape_target(
                effective_item,
                settings=settings,
                client=client,
                browser_fetcher=browser_fetcher,
            )

    results = await asyncio.gather(*(_bounded_scrape(t) for t in payload.targets))
    return BatchScrapeResponse(results=list(results))
