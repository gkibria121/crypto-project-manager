import httpx
from fastapi.testclient import TestClient

from scraper.config import get_settings
from scraper.main import create_app


def _make_mock_client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_health_endpoint():
    app = create_app()
    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["service"] == "pulseos-scraper"


def test_scrape_website_extracts_metadata_socials_and_signals():
    html = """
    <html>
      <head>
        <title>Aetheris AI Network — Decentralized GPU Mesh</title>
        <meta name="description" content="Sub-200ms AI inference on Solana with TypeScript SDK." />
      </head>
      <body>
        <h1>Agentic Finance Infrastructure — MCP Server</h1>
        <p>Explore our public REST API docs, Dune TVL telemetry, and Telegram mini app bot.</p>
        <a href="https://x.com/AetherisNetwork">Twitter</a>
        <a href="https://t.me/AetherisOfficial">Telegram</a>
        <a href="https://github.com/aetheris-labs/sdk">GitHub</a>
        <a href="https://docs.aetheris.network">Docs</a>
      </body>
    </html>
    """

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=html, headers={"content-type": "text/html"})

    app = create_app()
    with TestClient(app) as client:
        app.state.http_client = _make_mock_client(handler)
        res = client.post(
            "/api/v1/scrape",
            json={"targetType": "website", "targetValue": "https://93.184.216.34"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "completed"
        assert data["reachable"] is True
        assert data["title"] == "Aetheris AI Network — Decentralized GPU Mesh"
        assert "Sub-200ms AI inference" in data["description"]
        assert data["socialLinks"]["x"] == "https://x.com/AetherisNetwork"
        assert data["socialLinks"]["telegram"] == "https://t.me/AetherisOfficial"
        assert data["socialLinks"]["github"] == "https://github.com/aetheris-labs/sdk"
        assert data["socialLinks"]["docs"] == "https://docs.aetheris.network"
        assert "mcp_server" in data["signals"]
        assert "telegram_bot" in data["signals"]
        assert "developer_sdk" in data["signals"]
        assert "onchain_analytics" in data["signals"]


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
        assert "mcp_server" in data["signals"]
        assert "telegram_bot" in data["signals"]
        assert "audit" in data["signals"]
        assert data["socialLinks"]["telegram"] == "https://t.me/DemoBot"


def test_scrape_handles_http_error_gracefully():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text="Forbidden")

    app = create_app()
    with TestClient(app) as client:
        app.state.http_client = _make_mock_client(handler)
        res = client.post(
            "/api/v1/scrape",
            json={"targetType": "linkedin", "targetValue": "93.184.216.34/company/demo"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "unreachable"
        assert data["reachable"] is False
        assert data["httpStatus"] == 403


def test_scrape_batch_and_internal_key_auth(monkeypatch):
    monkeypatch.setenv("SCRAPER_API_KEY", "secret-test-key")
    get_settings.cache_clear()
    try:
        def handler(request: httpx.Request) -> httpx.Response:
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
                    "targets": [
                        {"targetType": "message", "targetValue": "SDK docs & TVL"},
                        {"targetType": "website", "targetValue": "https://93.184.216.34"},
                    ]
                },
            )
            assert auth.status_code == 200
            results = auth.json()["results"]
            assert len(results) == 2
            assert results[0]["status"] == "completed"
            assert results[1]["title"] == "Batch OK"
    finally:
        get_settings.cache_clear()
