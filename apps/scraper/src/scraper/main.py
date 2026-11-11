import logging
import time
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request

from scraper.config import get_settings
from scraper.routers import health, scrape

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("pulseos.scraper")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(settings.scraper_timeout_seconds),
        follow_redirects=False,
    )
    logger.info("PulseOS Python Scraper initialized")
    try:
        yield
    finally:
        await app.state.http_client.aclose()
        logger.info("PulseOS Python Scraper shut down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="PulseOS Python Scraper Microservice",
        version=settings.service_version,
        description=(
            "Extracts metadata, social links, and Web3 product signals from project "
            "websites, social profiles, and context notes."
        ),
        lifespan=lifespan,
    )

    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Request-Id"] = request_id
        logger.info(
            "%s %s -> %s (%sms) req_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response

    app.include_router(health.router)
    app.include_router(scrape.router)
    return app


app = create_app()
