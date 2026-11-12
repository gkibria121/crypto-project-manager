import asyncio
import logging
from typing import Any
from urllib.parse import urlparse

from scraper.config import Settings
from scraper.schemas import ScrapeConfig
from scraper.security import UnsafeTargetError, validate_public_url
from scraper.services.fetcher import FetchResult

logger = logging.getLogger("pulseos.scraper.browser")

MEDIA_RESOURCE_TYPES = frozenset({"image", "media", "font"})

try:
    from playwright.async_api import (
        Browser,
        CDPSession,
        Page,
        Playwright,
        async_playwright,
    )
    from playwright.async_api import (
        Error as PlaywrightError,
    )
    from playwright.async_api import (
        Response as PlaywrightResponse,
    )
    from playwright.async_api import (
        TimeoutError as PlaywrightTimeoutError,
    )

    PLAYWRIGHT_INSTALLED = True
except ImportError:  # pragma: no cover - guarded fallback if optional in bare env

    class _MissingPlaywrightError(Exception):
        pass

    class _MissingPlaywrightTimeoutError(_MissingPlaywrightError):
        pass

    Browser = object  # type: ignore[misc,assignment]
    CDPSession = object  # type: ignore[misc,assignment]
    Page = object  # type: ignore[misc,assignment]
    Playwright = object  # type: ignore[misc,assignment]
    PlaywrightResponse = object  # type: ignore[misc,assignment]
    PlaywrightError = _MissingPlaywrightError  # type: ignore[misc,assignment]
    PlaywrightTimeoutError = _MissingPlaywrightTimeoutError  # type: ignore[misc,assignment]
    async_playwright = None  # type: ignore[assignment]
    PLAYWRIGHT_INSTALLED = False


class BrowserUnavailableError(RuntimeError):
    """Raised when Playwright Chromium cannot be started for JS rendering."""


async def _evaluate_intercepted_request(
    req_url: str,
    resource_type: str,
    *,
    block_media: bool,
    allow_private_networks: bool,
) -> tuple[bool, str | None, str | None]:
    """Validate an intercepted browser request.

    Returns ``(allow, fail_reason, unsafe_detail)``.
    """
    parsed = urlparse(req_url)

    if parsed.scheme in ("data", "blob", "about"):
        return True, None, None

    if parsed.scheme not in ("http", "https"):
        return False, "BlockedByClient", None

    res_type = resource_type.lower()
    if block_media and res_type in MEDIA_RESOURCE_TYPES:
        return False, "BlockedByClient", None

    try:
        await asyncio.to_thread(
            validate_public_url,
            req_url,
            allow_private_networks=allow_private_networks,
        )
    except UnsafeTargetError as exc:
        return False, "AccessDenied", str(exc)

    return True, None, None


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
            service_workers="block",
        )

        blocked_error: list[str] = []
        pending_tasks: set[asyncio.Task[None]] = set()
        cdp: CDPSession | None = None
        page: Page | None = None
        main_frame_id: str | None = None
        nav_response: PlaywrightResponse | None = None

        def _track_task(task: asyncio.Task[None]) -> None:
            pending_tasks.add(task)
            task.add_done_callback(pending_tasks.discard)

        def _on_popup(popup_page: Page) -> None:
            if page is not None and popup_page is not page:
                _track_task(asyncio.create_task(popup_page.close()))

        context.on("page", _on_popup)

        async def _handle_paused_request(event: dict[str, Any]) -> None:
            if cdp is None:
                return
            req_id = event["requestId"]
            req_url = str((event.get("request") or {}).get("url") or "")
            res_type = str(event.get("resourceType") or "")
            frame_id = event.get("frameId")

            try:
                allow, fail_reason, unsafe_detail = await _evaluate_intercepted_request(
                    req_url,
                    res_type,
                    block_media=config.block_media,
                    allow_private_networks=self._settings.allow_private_networks,
                )
            except Exception:
                allow, fail_reason, unsafe_detail = False, "AccessDenied", None

            if unsafe_detail and res_type.lower() == "document" and (
                main_frame_id is None or frame_id == main_frame_id
            ):
                blocked_error.append(unsafe_detail)

            try:
                if allow:
                    await cdp.send("Fetch.continueRequest", {"requestId": req_id})
                else:
                    await cdp.send(
                        "Fetch.failRequest",
                        {"requestId": req_id, "errorReason": fail_reason or "BlockedByClient"},
                    )
            except Exception:
                # Context/page may have already closed or timed out mid-flight
                pass

        def _on_request_paused(event: dict[str, Any]) -> None:
            _track_task(asyncio.create_task(_handle_paused_request(event)))

        def _on_response(resp: PlaywrightResponse) -> None:
            nonlocal nav_response
            try:
                if (
                    page is not None
                    and resp.request.is_navigation_request()
                    and resp.frame == page.main_frame
                ):
                    nav_response = resp
            except Exception:
                pass

        try:
            page = await context.new_page()
            page.on("response", _on_response)

            # Use CDP Fetch.enable instead of Playwright context.route() because
            # context.route() forces Network.setCacheDisabled(true), causing
            # Chromium to inject Cache-Control: no-cache / Pragma: no-cache and
            # triggering origin 520 errors on CDN-cached sites like Cloudflare APO.
            cdp = await context.new_cdp_session(page)
            try:
                frame_tree = await cdp.send("Page.getFrameTree")
                main_frame_id = (
                    (frame_tree.get("frameTree") or {}).get("frame") or {}
                ).get("id")
            except Exception:
                main_frame_id = None

            cdp.on("Fetch.requestPaused", _on_request_paused)
            await cdp.send("Fetch.enable", {"patterns": [{"urlPattern": "*"}]})

            timeout_ms = config.timeout_seconds * 1000
            goto_timeout_ms = (
                min(timeout_ms, 8000)
                if config.wait_until == "networkidle"
                else timeout_ms
            )
            page.set_default_timeout(timeout_ms)

            response: PlaywrightResponse | None = None
            try:
                response = await page.goto(
                    url,
                    wait_until=config.wait_until,
                    timeout=goto_timeout_ms,
                )
            except (PlaywrightTimeoutError, PlaywrightError) as exc:
                if blocked_error:
                    raise UnsafeTargetError(blocked_error[0]) from exc
                # If networkidle timed out on background analytics/sockets, capture loaded DOM
                if (
                    isinstance(exc, PlaywrightTimeoutError)
                    and config.wait_until == "networkidle"
                ):
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

            active_response = response or nav_response
            status_code = active_response.status if active_response is not None else 200
            content_type = (
                active_response.headers.get("content-type", "text/html")
                if active_response is not None
                else "text/html"
            )

            if status_code < 400:
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

            return FetchResult(
                final_url=final_url,
                status_code=status_code,
                content_type=content_type,
                html=html,
            )
        finally:
            for task in list(pending_tasks):
                if not task.done():
                    task.cancel()
            if pending_tasks:
                await asyncio.gather(*pending_tasks, return_exceptions=True)
            if cdp is not None:
                try:
                    await cdp.detach()
                except Exception:
                    pass
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
