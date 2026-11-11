import asyncio
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Request

from scraper.config import Settings, get_settings
from scraper.schemas import (
    BatchScrapeRequest,
    BatchScrapeResponse,
    ScrapeRequest,
    ScrapeResponse,
)
from scraper.security import verify_internal_api_key
from scraper.services.extractor import scrape_target

router = APIRouter(
    prefix="/api/v1/scrape",
    tags=["scrape"],
    dependencies=[Depends(verify_internal_api_key)],
)


def _get_http_client(request: Request) -> httpx.AsyncClient | None:
    return getattr(request.app.state, "http_client", None)


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
    return await scrape_target(payload, settings=settings, client=client)


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
    semaphore = asyncio.Semaphore(4)

    async def _bounded_scrape(item: ScrapeRequest) -> ScrapeResponse:
        async with semaphore:
            return await scrape_target(item, settings=settings, client=client)

    results = await asyncio.gather(*(_bounded_scrape(t) for t in payload.targets))
    return BatchScrapeResponse(results=list(results))
