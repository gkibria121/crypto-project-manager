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
            return httpx.Response(
                200,
                json={
                    "data": [
                        {
                            "id": "999",
                            "text": "Epoch 3 mainnet staking and TypeScript SDK docs live at https://docs.aetheris.network",
                            "created_at": "2026-11-11T10:00:00Z",
                        }
                    ]
                },
            )
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

        x_res = client.post(
            "/api/v1/scrape",
            json={
                "targetType": "x_handle",
                "targetValue": "@AetherisNetwork",
                "config": {"levels": 2},
                "providerCredentials": creds,
            },
        )
        assert x_res.status_code == 200
        x_data = x_res.json()
        assert x_data["status"] == "completed"
        assert x_data["providerUsed"] == "x_api_v2"
        assert x_data["apiKeyConfigured"] is True
        assert x_data["levelsScraped"] == 2
        assert x_data["pagesScraped"] == 2
        assert x_data["platformData"]["metrics"]["followers_count"] == 48200
        assert "mcp_server" in x_data["signals"]

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
