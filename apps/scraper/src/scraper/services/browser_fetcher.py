import asyncio
import logging
from urllib.parse import urlparse

from scraper.config import Settings
from scraper.schemas import ScrapeConfig
from scraper.security import UnsafeTargetError, validate_public_url
from scraper.services.fetcher import FetchResult

logger = logging.getLogger("pulseos.scraper.browser")

try:
    from playwright.async_api import (
        Browser,
        Playwright,
        Route,
        TimeoutError as PlaywrightTimeoutError,
        async_playwright,
    )

    PLAYWRIGHT_INSTALLED = True
except ImportError:  # pragma: no cover - guarded fallback if optional in bare env
    Browser = object  # type: ignore[misc,assignment]
    Playwright = object  # type: ignore[misc,assignment]
    Route = object  # type: ignore[misc,assignment]
    PlaywrightTimeoutError = TimeoutError  # type: ignore[misc,assignment]
    async_playwright = None  # type: ignore[assignment]
    PLAYWRIGHT_INSTALLED = False


class BrowserUnavailableError(RuntimeError):
    """Raised when Playwright Chromium cannot be started for JS rendering."""


class BrowserFetcher:
    """Manages a shared Playwright Chromium browser with SSRF-safe isolated contexts."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._lock = asyncio.Lock()

    async def _ensure_browser(self) -> Browser:
        if not PLAYWRIGHT_INSTALLED or async_playwright is None:
            raise BrowserUnavailableError(
                "Playwright is not installed in this Python environment."
            )

        if self._browser is not None and self._browser.is_connected():
            return self._browser

        async with self._lock:
            if self._browser is not None and self._browser.is_connected():
                return self._browser

            try:
                self._playwright = await async_playwright().start()
                self._browser = await self._playwright.chromium.launch(
                    headless=self._settings.playwright_headless,
                    args=[
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--disable-extensions",
                    ],
                )
                logger.info("Playwright Chromium browser launched for JS rendering")
                return self._browser
            except Exception as exc:  # pragma: no cover - environment dependent
                await self.close()
                raise BrowserUnavailableError(
                    f"Failed to launch Playwright Chromium browser: {exc}"
                ) from exc

    async def fetch_with_js(
        self,
        url: str,
        config: ScrapeConfig,
    ) -> FetchResult:
        """Render a URL with headless Chromium and return the hydrated DOM HTML."""
        validate_public_url(
            url,
            allow_private_networks=self._settings.allow_private_networks,
        )

        browser = await self._ensure_browser()
        context = await browser.new_context(
            user_agent=self._settings.user_agent,
            viewport={"width": 1440, "height": 900},
            java_script_enabled=True,
            ignore_https_errors=False,
        )

        blocked_error: list[str] = []

        async def _route_interceptor(route: Route) -> None:
            req = route.request
            req_url = req.url
            parsed = urlparse(req_url)

            if parsed.scheme in ("data", "blob", "about"):
                await route.continue_()
                return

            if parsed.scheme not in ("http", "https"):
                await route.abort("blockedbyclient")
                return

            if req.resource_type in ("document", "fetch", "xhr", "script"):
                try:
                    validate_public_url(
                        req_url,
                        allow_private_networks=self._settings.allow_private_networks,
                    )
                except UnsafeTargetError as exc:
                    if req.is_navigation_request():
                        blocked_error.append(str(exc))
                    await route.abort("accessdenied")
                    return

            if config.block_media and req.resource_type in ("image", "media", "font"):
                await route.abort("blockedbyclient")
                return

            await route.continue_()

        try:
            await context.route("**/*", _route_interceptor)
            page = await context.new_page()
            timeout_ms = config.timeout_seconds * 1000
            page.set_default_timeout(timeout_ms)

            response = None
            try:
                response = await page.goto(
                    url,
                    wait_until=config.wait_until,
                    timeout=timeout_ms,
                )
            except PlaywrightTimeoutError as exc:
                if blocked_error:
                    raise UnsafeTargetError(blocked_error[0]) from exc
                # If networkidle timed out on background analytics/sockets, capture loaded DOM
                if config.wait_until == "networkidle":
                    try:
                        await page.wait_for_load_state(
                            "domcontentloaded", timeout=3000
                        )
                    except PlaywrightTimeoutError:
                        pass
                else:
                    raise

            if blocked_error:
                raise UnsafeTargetError(blocked_error[0])

            if config.wait_for_ms > 0:
                await page.wait_for_timeout(config.wait_for_ms)

            if config.scroll_to_bottom:
                try:
                    await page.evaluate(
                        """async () => {
                            const h = Math.min(document.body?.scrollHeight || 0, 12000);
                            window.scrollTo(0, h / 2);
                            await new Promise(r => setTimeout(r, 150));
                            window.scrollTo(0, h);
                        }"""
                    )
                    await page.wait_for_timeout(250)
                except Exception:
                    pass

            final_url = page.url or url
            validate_public_url(
                final_url,
                allow_private_networks=self._settings.allow_private_networks,
            )

            html = await page.content()
            max_chars = self._settings.scraper_max_content_bytes
            if len(html.encode("utf-8", errors="ignore")) > max_chars:
                html = html[:max_chars]

            status_code = response.status if response is not None else 200
            content_type = (
                response.headers.get("content-type", "text/html")
                if response is not None
                else "text/html"
            )

            return FetchResult(
                final_url=final_url,
                status_code=status_code,
                content_type=content_type,
                html=html,
            )
        finally:
            await context.close()

    async def close(self) -> None:
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None
