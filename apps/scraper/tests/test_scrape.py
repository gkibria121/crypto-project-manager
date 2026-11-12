import httpx
from fastapi.testclient import TestClient

from scraper.config import get_settings
from scraper.main import create_app
from scraper.schemas import ScrapeConfig
from scraper.services.fetcher import FetchResult


def _make_mock_client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


class _MockBrowserFetcher:
    def __init__(self, pages: dict[str, tuple[int, str]]):
        self.pages = pages
        self.visited_urls: list[str] = []

    async def fetch_with_js(self, url: str, config: ScrapeConfig) -> FetchResult:
        self.visited_urls.append(url)
        status, html = self.pages.get(
            url,
            (404, "<html><title>Not Found</title></html>"),
        )
        return FetchResult(
            final_url=url,
            status_code=status,
            content_type="text/html; charset=utf-8",
            html=html,
        )

    async def close(self) -> None:
        return None


def test_health_endpoint():
    app = create_app()
    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["service"] == "pulseos-scraper"


def test_scrape_website_with_js_enabled_and_multilevel_crawl():
    root_url = "https://93.184.216.34"
    docs_url = "https://93.184.216.34/docs"
    blog_url = "https://93.184.216.34/docs/mcp-guide"
    login_url = "https://93.184.216.34/login"

    pages = {
        root_url: (
            200,
            f"""
            <html lang="en">
              <head>
                <title>Aetheris AI Network — Decentralized GPU Mesh</title>
                <meta name="description" content="Sub-200ms AI inference on Solana with TypeScript SDK." />
                <script type="application/ld+json">{{"@context":"https://schema.org","@type":"Organization","name":"Aetheris"}}</script>
              </head>
              <body>
                <div id="app-hydrated">
                  <h1>Agentic Finance Infrastructure</h1>
                  <p>Hydrated via JS runtime. Contact hello@aetheris.network for enterprise onboarding.</p>
                  <a href="{docs_url}">Documentation</a>
                  <a href="{login_url}">Sign In</a>
                  <a href="https://github.com/aetheris-labs/sdk">GitHub</a>
                  <a href="https://external-partner.org/out">External Partner</a>
                </div>
              </body>
            </html>
            """,
        ),
        docs_url: (
            200,
            f"""
            <html>
              <head><title>Aetheris Docs & SDK</title></head>
              <body>
                <h2>TypeScript SDK & REST API</h2>
                <p>Explore our MCP server specification and Dune TVL telemetry.</p>
                <a href="{blog_url}">MCP Integration Guide</a>
              </body>
            </html>
            """,
        ),
        blog_url: (
            200,
            """
            <html>
              <head><title>MCP Server Guide</title></head>
              <body>
                <h3>Model Context Protocol Setup</h3>
                <p>Connect Claude or ChatGPT to our Telegram bot at https://t.me/AetherisOfficial.</p>
              </body>
            </html>
            """,
        ),
        login_url: (200, "<html><title>Login</title></html>"),
    }

    def http_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404, text="")
        return httpx.Response(404, text="Not found")

    app = create_app()
    with TestClient(app) as client:
        app.state.http_client = _make_mock_client(http_handler)
        mock_browser = _MockBrowserFetcher(pages)
        app.state.browser_fetcher = mock_browser

        res = client.post(
            "/api/v1/scrape",
            json={
                "targetType": "website",
                "targetValue": root_url,
                "config": {
                    "levels": 3,
                    "maxPages": 10,
                    "renderJs": True,
                    "sameDomainOnly": True,
                    "excludePatterns": ["/login"],
                },
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "completed"
        assert data["reachable"] is True
        assert data["providerUsed"] == "playwright_js"
        assert data["levelsScraped"] == 3
        assert data["pagesScraped"] == 3
        assert len(data["pages"]) == 3
        assert data["pages"][0]["depth"] == 1
        assert data["pages"][1]["depth"] == 2
        assert data["pages"][1]["parentUrl"] == root_url
        assert data["pages"][2]["depth"] == 3
        assert data["pages"][2]["parentUrl"] == docs_url
        assert login_url not in mock_browser.visited_urls
        assert "https://external-partner.org/out" not in mock_browser.visited_urls
        assert "hello@aetheris.network" in data["contacts"]
        assert len(data["structuredData"]) == 1
        assert "mcp_server" in data["signals"]
        assert "developer_sdk" in data["signals"]
        assert "telegram_bot" in data["signals"]
        assert data["socialLinks"]["github"] == "https://github.com/aetheris-labs/sdk"


def test_scrape_static_html_mode_when_render_js_false():
    html = """
    <html>
      <head><title>Static Site</title></head>
      <body><h1>Fast Static Parse</h1><a href="https://x.com/StaticWeb3">X</a></body>
    </html>
    """

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404, text="")
        return httpx.Response(200, text=html, headers={"content-type": "text/html"})

    app = create_app()
    with TestClient(app) as client:
        app.state.http_client = _make_mock_client(handler)
        res = client.post(
            "/api/v1/scrape",
            json={
                "targetType": "website",
                "targetValue": "https://93.184.216.34",
                "config": {"levels": 1, "renderJs": False},
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "completed"
        assert data["providerUsed"] == "static_html"
        assert data["title"] == "Static Site"
        assert data["socialLinks"]["x"] == "https://x.com/StaticWeb3"


def test_scrape_specialized_platforms_require_api_key_when_unconfigured(monkeypatch):
    monkeypatch.setenv("X_API_BEARER_TOKEN", "")
    monkeypatch.setenv("LINKEDIN_API_KEY", "")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "")
    get_settings.cache_clear()
    try:
        app = create_app()
        with TestClient(app) as client:
            for target_type, target_value, expected_provider, expected_env in (
                ("x_handle", "@AetherisNetwork", "x", "X_API_BEARER_TOKEN"),
                ("linkedin", "linkedin.com/company/aetheris-labs", "linkedin", "LINKEDIN_API_KEY"),
                ("telegram", "t.me/AetherisOfficial", "telegram", "TELEGRAM_BOT_TOKEN"),
                ("website", "https://x.com/DirectWebsiteX", "x", "X_API_BEARER_TOKEN"),
            ):
                res = client.post(
                    "/api/v1/scrape",
                    json={"targetType": target_type, "targetValue": target_value},
                )
                assert res.status_code == 200
                data = res.json()
                assert data["status"] == "api_key_required"
                assert data["requiresApiKey"] is True
                assert data["apiKeyConfigured"] is False
                assert data["specializedProvider"] == expected_provider
                assert expected_env in data["errorReason"]
    finally:
        get_settings.cache_clear()


def test_scrape_specialized_x_linkedin_telegram_when_configured():
    x_tweet_max_results: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        # X API v2
        if "api.x.com/2/users/by/username/AetherisNetwork" in url:
            assert request.headers.get("authorization") == "Bearer x-test-token"
            return httpx.Response(
                200,
                json={
                    "data": {
                        "id": "12345",
                        "name": "Aetheris AI",
                        "username": "AetherisNetwork",
                        "description": "Decentralized GPU mesh with MCP server https://aetheris.network",
                        "verified": True,
                        "public_metrics": {
                            "followers_count": 48200,
                            "following_count": 120,
                            "tweet_count": 512,
                        },
                    }
                },
            )
        if "api.x.com/2/users/12345/tweets" in url:
            x_tweet_max_results.append(request.url.params.get("max_results"))
            tweets = [
                {
                    "id": "999",
                    "text": "Epoch 3 mainnet staking and TypeScript SDK docs live at https://docs.aetheris.network",
                    "created_at": "2026-11-11T10:00:00Z",
                }
            ]
            for idx in range(2, 13):
                tweets.append(
                    {
                        "id": str(1000 + idx),
                        "text": f"Aetheris status update #{idx}",
                        "created_at": f"2026-11-10T{idx:02d}:00:00Z",
                    }
                )
            limit = int(request.url.params.get("max_results") or 10)
            return httpx.Response(200, json={"data": tweets[:limit]})
        # LinkedIn REST API
        if "api.linkedin.com/rest/organizations" in url:
            assert request.headers.get("authorization") == "Bearer li-test-token"
            return httpx.Response(
                200,
                json={
                    "elements": [
                        {
                            "id": 777,
                            "vanityName": "aetheris-labs",
                            "localizedName": "Aetheris Labs",
                            "localizedDescription": "Institutional Web3 AI infrastructure & Spearbit audited contracts.",
                            "localizedWebsite": "https://aetheris.network",
                            "staffCountRange": "SIZE_11_TO_50",
                        }
                    ]
                },
            )
        if "api.linkedin.com/rest/posts" in url:
            return httpx.Response(
                200,
                json={
                    "elements": [
                        {"commentary": "Announcing our enterprise MCP server integration."}
                    ]
                },
            )
        if "api.linkedin.com/rest/organizationalEntityFollowerStatistics" in url:
            return httpx.Response(200, json={"elements": [{"followerCounts": {"organicFollowerCount": 6400}}]})
        # Telegram Bot API
        if "api.telegram.org/bot" in url and "/getChatMemberCount" in url:
            return httpx.Response(200, json={"ok": True, "result": 19500})
        if "api.telegram.org/bot" in url and "/getChat" in url:
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "id": -100123456,
                        "title": "Aetheris Official",
                        "username": "AetherisOfficial",
                        "type": "supergroup",
                        "description": "Official community & Telegram mini app portal https://aetheris.network",
                        "pinned_message": {"text": "Epoch 3 testnet bot live!"},
                    },
                },
            )
        if "api.telegram.org/bot" in url and "/getUpdates" in url:
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": [
                        {
                            "message": {
                                "message_id": 55,
                                "date": 1762850000,
                                "chat": {"id": -100123456},
                                "text": "New Dune analytics dashboard live!",
                            }
                        }
                    ],
                },
            )
        return httpx.Response(404, json={"error": "unhandled mock url", "url": url})

    app = create_app()
    with TestClient(app) as client:
        app.state.http_client = _make_mock_client(handler)
        creds = {
            "xBearerToken": "x-test-token",
            "linkedinAccessToken": "li-test-token",
            "telegramBotToken": "tg-test-token",
        }

        import json

        # Default X scrape (levels=1, default xPostsLimit=10): account + 10 latest posts
        x_res = client.post(
            "/api/v1/scrape",
            json={
                "targetType": "x_handle",
                "targetValue": "@AetherisNetwork",
                "config": {"levels": 1},
                "providerCredentials": creds,
            },
        )
        assert x_res.status_code == 200
        x_data = x_res.json()
        assert x_data["status"] == "completed"
        assert x_data["providerUsed"] == "x_api_v2"
        assert x_data["apiKeyConfigured"] is True
        assert x_data["pagesScraped"] == 2
        assert x_data["platformData"]["metrics"]["followers_count"] == 48200
        assert "mcp_server" in x_data["signals"]
        x_platform_json = json.dumps(x_data["platformData"])
        assert "Aetheris status update #10" in x_platform_json
        assert "Aetheris status update #11" not in x_platform_json

        # Custom X scrape with xPostsLimit=2 (clamped upstream max_results=5, sliced to 2)
        x_custom_res = client.post(
            "/api/v1/scrape",
            json={
                "targetType": "x_handle",
                "targetValue": "@AetherisNetwork",
                "config": {"levels": 2, "xPostsLimit": 2},
                "providerCredentials": creds,
            },
        )
        assert x_custom_res.status_code == 200
        x_custom = x_custom_res.json()
        assert x_custom["status"] == "completed"
        assert x_custom["levelsScraped"] == 2
        assert x_custom["pagesScraped"] == 2
        x_custom_json = json.dumps(x_custom["platformData"])
        assert "Aetheris status update #2" in x_custom_json
        assert "Aetheris status update #3" not in x_custom_json
        assert x_tweet_max_results == ["10", "5"]

        li_res = client.post(
            "/api/v1/scrape",
            json={
                "targetType": "linkedin",
                "targetValue": "linkedin.com/company/aetheris-labs",
                "config": {"levels": 2},
                "providerCredentials": creds,
            },
        )
        assert li_res.status_code == 200
        li_data = li_res.json()
        assert li_data["status"] == "completed"
        assert li_data["providerUsed"] == "linkedin_api"
        assert li_data["pagesScraped"] == 2
        assert "audit" in li_data["signals"]

        tg_res = client.post(
            "/api/v1/scrape",
            json={
                "targetType": "telegram",
                "targetValue": "t.me/AetherisOfficial",
                "config": {"levels": 2},
                "providerCredentials": creds,
            },
        )
        assert tg_res.status_code == 200
        tg_data = tg_res.json()
        assert tg_data["status"] == "completed"
        assert tg_data["providerUsed"] == "telegram_bot_api"
        assert tg_data["pagesScraped"] == 2
        assert tg_data["platformData"]["memberCount"] == 19500
        assert "onchain_analytics" in tg_data["signals"]


def test_scrape_blocks_private_and_loopback_urls():
    app = create_app()
    with TestClient(app) as client:
        for blocked in (
            "http://127.0.0.1:8080/admin",
            "http://169.254.169.254/latest/meta-data",
            "http://localhost:5432",
            "ftp://example.com/file",
        ):
            res = client.post(
                "/api/v1/scrape",
                json={"targetType": "website", "targetValue": blocked},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "failed"
            assert data["reachable"] is False
            assert data["errorReason"]


def test_scrape_message_note_extracts_signals_without_http():
    app = create_app()
    with TestClient(app) as client:
        res = client.post(
            "/api/v1/scrape",
            json={
                "targetType": "message",
                "targetValue": (
                    "Launched MCP server and Telegram bot at "
                    "https://t.me/DemoBot with Spearbit audit @DemoWeb3"
                ),
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "completed"
        assert data["reachable"] is True
        assert data["providerUsed"] == "note_parser"
        assert len(data["pages"]) == 1
        assert "mcp_server" in data["signals"]
        assert "telegram_bot" in data["signals"]
        assert "audit" in data["signals"]
        assert data["socialLinks"]["telegram"] == "https://t.me/DemoBot"


def test_scrape_batch_and_internal_key_auth(monkeypatch):
    monkeypatch.setenv("SCRAPER_API_KEY", "secret-test-key")
    get_settings.cache_clear()
    try:
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404, text="")
            return httpx.Response(200, text="<html><title>Batch OK</title></html>")

        app = create_app()
        with TestClient(app) as client:
            app.state.http_client = _make_mock_client(handler)

            unauth = client.post(
                "/api/v1/scrape/batch",
                json={"targets": [{"targetType": "message", "targetValue": "hello"}]},
            )
            assert unauth.status_code == 401

            auth = client.post(
                "/api/v1/scrape/batch",
                headers={"X-Internal-Service-Key": "secret-test-key"},
                json={
                    "config": {"levels": 1, "renderJs": False},
                    "targets": [
                        {"targetType": "message", "targetValue": "SDK docs & TVL"},
                        {"targetType": "website", "targetValue": "https://93.184.216.34"},
                    ],
                },
            )
            assert auth.status_code == 200
            results = auth.json()["results"]
            assert len(results) == 2
            assert results[0]["status"] == "completed"
            assert results[1]["title"] == "Batch OK"
    finally:
        get_settings.cache_clear()


async def test_evaluate_intercepted_request_ssrf_and_media_blocking():
    from scraper.services.browser_fetcher import _evaluate_intercepted_request

    allow, reason, detail = await _evaluate_intercepted_request(
        "data:text/plain;base64,SGVsbG8=",
        "Image",
        block_media=True,
        allow_private_networks=False,
    )
    assert (allow, reason, detail) == (True, None, None)

    allow, reason, detail = await _evaluate_intercepted_request(
        "ftp://93.184.216.34/file",
        "Document",
        block_media=True,
        allow_private_networks=False,
    )
    assert (allow, reason, detail) == (False, "BlockedByClient", None)

    allow, reason, detail = await _evaluate_intercepted_request(
        "https://93.184.216.34/logo.png",
        "Image",
        block_media=True,
        allow_private_networks=False,
    )
    assert (allow, reason, detail) == (False, "BlockedByClient", None)

    allow, reason, detail = await _evaluate_intercepted_request(
        "http://127.0.0.1:8000/admin",
        "Document",
        block_media=True,
        allow_private_networks=False,
    )
    assert allow is False
    assert reason == "AccessDenied"
    assert detail is not None

    allow, reason, detail = await _evaluate_intercepted_request(
        "http://169.254.169.254/latest/meta-data",
        "Image",
        block_media=False,
        allow_private_networks=False,
    )
    assert allow is False
    assert reason == "AccessDenied"
    assert detail is not None

    allow, reason, detail = await _evaluate_intercepted_request(
        "https://93.184.216.34/",
        "Document",
        block_media=True,
        allow_private_networks=False,
    )
    assert (allow, reason, detail) == (True, None, None)


async def test_browser_fetcher_uses_cdp_fetch_and_preserves_nav_status_on_timeout():
    import asyncio
    from types import SimpleNamespace

    from scraper.services.browser_fetcher import BrowserFetcher, PlaywrightTimeoutError

    cdp_commands: list[tuple[str, dict]] = []
    route_calls: list[str] = []

    class _FakeCDP:
        def __init__(self) -> None:
            self._handlers: dict[str, object] = {}

        def on(self, event: str, handler: object) -> None:
            self._handlers[event] = handler

        async def send(self, method: str, params: dict | None = None) -> dict:
            cdp_commands.append((method, params or {}))
            if method == "Page.getFrameTree":
                return {"frameTree": {"frame": {"id": "main-frame"}}}
            return {}

        async def detach(self) -> None:
            return None

        async def emit_paused(self, payload: dict) -> None:
            handler = self._handlers["Fetch.requestPaused"]
            handler(payload)  # type: ignore[operator]
            await asyncio.sleep(0.02)

    class _FakePage:
        def __init__(self, cdp: _FakeCDP) -> None:
            self.url = "https://93.184.216.34/"
            self.main_frame = object()
            self._cdp = cdp
            self._response_handlers: list[object] = []

        def on(self, event: str, handler: object) -> None:
            if event == "response":
                self._response_handlers.append(handler)

        def set_default_timeout(self, timeout_ms: int) -> None:
            return None

        async def goto(self, url: str, wait_until: str, timeout: int):
            await self._cdp.emit_paused(
                {
                    "requestId": "req-1",
                    "frameId": "main-frame",
                    "resourceType": "Document",
                    "request": {"url": url},
                }
            )
            await self._cdp.emit_paused(
                {
                    "requestId": "req-2",
                    "frameId": "main-frame",
                    "resourceType": "Image",
                    "request": {"url": "https://93.184.216.34/hero.png"},
                }
            )
            nav_resp = SimpleNamespace(
                status=520,
                headers={"content-type": "text/html; charset=utf-8"},
                frame=self.main_frame,
                request=SimpleNamespace(is_navigation_request=lambda: True),
            )
            for h in self._response_handlers:
                h(nav_resp)  # type: ignore[operator]
            raise PlaywrightTimeoutError("networkidle timed out")

        async def wait_for_load_state(self, state: str, timeout: int) -> None:
            return None

        async def wait_for_timeout(self, ms: int) -> None:
            return None

        async def evaluate(self, script: str) -> None:
            return None

        async def content(self) -> str:
            return "<html><title>Error 520</title></html>"

    class _FakeContext:
        def __init__(self) -> None:
            self.cdp = _FakeCDP()
            self.page = _FakePage(self.cdp)

        def on(self, event: str, handler: object) -> None:
            return None

        async def route(self, pattern: str, handler: object) -> None:
            route_calls.append(pattern)

        async def new_page(self) -> _FakePage:
            return self.page

        async def new_cdp_session(self, page: _FakePage) -> _FakeCDP:
            return self.cdp

        async def close(self) -> None:
            return None

    class _FakeBrowser:
        def __init__(self) -> None:
            self.ctx = _FakeContext()

        def is_connected(self) -> bool:
            return True

        async def new_context(self, **kwargs) -> _FakeContext:
            assert kwargs.get("service_workers") == "block"
            return self.ctx

    settings = get_settings()
    fetcher = BrowserFetcher(settings)
    fake_browser = _FakeBrowser()

    async def _fake_ensure_browser():
        return fake_browser

    fetcher._ensure_browser = _fake_ensure_browser  # type: ignore[method-assign]

    result = await fetcher.fetch_with_js("https://93.184.216.34/", ScrapeConfig())
    assert route_calls == []
    assert ("Fetch.enable", {"patterns": [{"urlPattern": "*"}]}) in cdp_commands
    assert ("Fetch.continueRequest", {"requestId": "req-1"}) in cdp_commands
    assert (
        "Fetch.failRequest",
        {"requestId": "req-2", "errorReason": "BlockedByClient"},
    ) in cdp_commands
    assert result.status_code == 520


def test_crawler_falls_back_to_static_http_when_playwright_returns_520(monkeypatch):
    monkeypatch.setenv("SCRAPER_API_KEY", "")
    get_settings.cache_clear()
    try:
        root_url = "https://93.184.216.34"

        def http_handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404, text="")
            return httpx.Response(
                200,
                text=(
                    "<html><head><title>Recovered Site</title></head>"
                    "<body><h1>Live</h1></body></html>"
                ),
                headers={"content-type": "text/html"},
            )

        app = create_app()
        with TestClient(app) as client:
            app.state.http_client = _make_mock_client(http_handler)
            app.state.browser_fetcher = _MockBrowserFetcher(
                {root_url: (520, "<html><title>520</title></html>")}
            )

            res = client.post(
                "/api/v1/scrape",
                json={
                    "targetType": "website",
                    "targetValue": root_url,
                    "config": {"levels": 1, "renderJs": True},
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "completed"
            assert data["reachable"] is True
            assert data["providerUsed"] == "static_html_fallback"
            assert data["title"] == "Recovered Site"
            assert data["errorReason"] is None
    finally:
        get_settings.cache_clear()


def test_crawler_preserves_520_when_static_fallback_also_fails_with_520(monkeypatch):
    monkeypatch.setenv("SCRAPER_API_KEY", "")
    get_settings.cache_clear()
    try:
        root_url = "https://93.184.216.34"

        def http_handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/robots.txt":
                return httpx.Response(404, text="")
            return httpx.Response(520, text="<html><title>520</title></html>")

        app = create_app()
        with TestClient(app) as client:
            app.state.http_client = _make_mock_client(http_handler)
            app.state.browser_fetcher = _MockBrowserFetcher(
                {root_url: (520, "<html><title>520</title></html>")}
            )

            res = client.post(
                "/api/v1/scrape",
                json={
                    "targetType": "website",
                    "targetValue": root_url,
                    "config": {"levels": 1, "renderJs": True},
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "unreachable"
            assert data["httpStatus"] == 520
            assert data["errorReason"] == "Target responded with HTTP 520"
    finally:
        get_settings.cache_clear()


def test_crawler_does_not_fallback_on_unsafe_target_error(monkeypatch):
    from scraper.security import UnsafeTargetError

    monkeypatch.setenv("SCRAPER_API_KEY", "")
    get_settings.cache_clear()
    try:
        static_called = False

        def http_handler(request: httpx.Request) -> httpx.Response:
            nonlocal static_called
            if request.url.path == "/robots.txt":
                return httpx.Response(404, text="")
            static_called = True
            return httpx.Response(200, text="<html><title>Should Not Run</title></html>")

        class _SSRFBrowserFetcher:
            async def fetch_with_js(self, url: str, config: ScrapeConfig) -> FetchResult:
                raise UnsafeTargetError("Redirected to restricted IP 127.0.0.1")

            async def close(self) -> None:
                return None

        app = create_app()
        with TestClient(app) as client:
            app.state.http_client = _make_mock_client(http_handler)
            app.state.browser_fetcher = _SSRFBrowserFetcher()

            res = client.post(
                "/api/v1/scrape",
                json={
                    "targetType": "website",
                    "targetValue": "https://93.184.216.34",
                    "config": {"levels": 1, "renderJs": True},
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "failed"
            assert data["reachable"] is False
            assert "127.0.0.1" in data["errorReason"]
            assert static_called is False
    finally:
        get_settings.cache_clear()


def test_scrape_linkedin_posts_limit(monkeypatch):
    import json

    monkeypatch.setenv("SCRAPER_API_KEY", "")
    get_settings.cache_clear()
    try:
        requested_counts: list[str | None] = []

        def handler(request: httpx.Request) -> httpx.Response:
            url = str(request.url)
            if "api.linkedin.com/rest/organizations" in url:
                return httpx.Response(
                    200,
                    json={
                        "elements": [
                            {
                                "id": 777,
                                "vanityName": "aetheris-labs",
                                "localizedName": "Aetheris Labs",
                                "localizedDescription": "Web3 infrastructure.",
                                "localizedWebsite": "https://aetheris.network",
                            }
                        ]
                    },
                )
            if "api.linkedin.com/rest/posts" in url:
                requested_counts.append(request.url.params.get("count"))
                posts = [
                    {"commentary": f"LinkedIn update #{idx}"}
                    for idx in range(1, 25)
                ]
                limit = int(request.url.params.get("count") or 10)
                return httpx.Response(200, json={"elements": posts[:limit]})
            if "api.linkedin.com/rest/organizationalEntityFollowerStatistics" in url:
                return httpx.Response(200, json={"elements": []})
            return httpx.Response(404, json={"error": "unhandled"})

        app = create_app()
        with TestClient(app) as client:
            app.state.http_client = _make_mock_client(handler)
            creds = {"linkedinAccessToken": "li-test-token"}

            default_res = client.post(
                "/api/v1/scrape",
                json={
                    "targetType": "linkedin",
                    "targetValue": "linkedin.com/company/aetheris-labs",
                    "config": {"levels": 1},
                    "providerCredentials": creds,
                },
            )
            assert default_res.status_code == 200
            default_data = default_res.json()
            assert default_data["status"] == "completed"
            assert default_data["pagesScraped"] == 2
            assert default_data["platformData"]["linkedinPostsLimit"] == 10
            assert default_data["platformData"]["recentPostsCount"] == 10
            default_json = json.dumps(default_data["platformData"])
            assert "LinkedIn update #10" in default_json
            assert "LinkedIn update #11" not in default_json

            custom_res = client.post(
                "/api/v1/scrape",
                json={
                    "targetType": "linkedin",
                    "targetValue": "linkedin.com/company/aetheris-labs",
                    "config": {"levels": 2, "linkedinPostsLimit": 2},
                    "providerCredentials": creds,
                },
            )
            assert custom_res.status_code == 200
            custom_data = custom_res.json()
            assert custom_data["platformData"]["linkedinPostsLimit"] == 2
            assert custom_data["platformData"]["recentPostsCount"] == 2
            custom_json = json.dumps(custom_data["platformData"])
            assert "LinkedIn update #2" in custom_json
            assert "LinkedIn update #3" not in custom_json

            large_res = client.post(
                "/api/v1/scrape",
                json={
                    "targetType": "linkedin",
                    "targetValue": "linkedin.com/company/aetheris-labs",
                    "config": {"levels": 2, "linkedinPostsLimit": 20},
                    "providerCredentials": creds,
                },
            )
            assert large_res.status_code == 200
            large_data = large_res.json()
            assert large_data["platformData"]["linkedinPostsLimit"] == 20
            assert large_data["platformData"]["recentPostsCount"] == 20
            assert len(large_data["platformData"]["recentPosts"]) == 20
            assert requested_counts == ["10", "2", "20"]
    finally:
        get_settings.cache_clear()
