from dataclasses import dataclass
from urllib.parse import urljoin

import httpx

from scraper.config import Settings
from scraper.security import validate_public_url


@dataclass(slots=True)
class FetchResult:
    final_url: str
    status_code: int
    content_type: str
    html: str


class ContentTooLargeError(ValueError):
    """Raised when response body exceeds configured maximum byte limit."""


async def fetch_url_safely(
    url: str,
    settings: Settings,
    client: httpx.AsyncClient | None = None,
) -> FetchResult:
    headers = {
        "User-Agent": settings.user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    owns_client = client is None
    active_client = client or httpx.AsyncClient(
        timeout=httpx.Timeout(settings.scraper_timeout_seconds),
        follow_redirects=False,
    )

    try:
        current_url = url
        max_redirects = 5
        response: httpx.Response | None = None

        for _ in range(max_redirects + 1):
            validate_public_url(
                current_url,
                allow_private_networks=settings.allow_private_networks,
            )

            async with active_client.stream(
                "GET",
                current_url,
                headers=headers,
                follow_redirects=False,
            ) as resp:
                if resp.is_redirect and "location" in resp.headers:
                    next_url = urljoin(current_url, resp.headers["location"])
                    current_url = next_url
                    continue

                content_length = resp.headers.get("content-length")
                if (
                    content_length
                    and content_length.isdigit()
                    and int(content_length) > settings.scraper_max_content_bytes
                ):
                    raise ContentTooLargeError(
                        f"Response exceeds {settings.scraper_max_content_bytes} byte limit"
                    )

                chunks: list[bytes] = []
                total_bytes = 0
                async for chunk in resp.aiter_bytes():
                    total_bytes += len(chunk)
                    if total_bytes > settings.scraper_max_content_bytes:
                        raise ContentTooLargeError(
                            f"Streamed response exceeded {settings.scraper_max_content_bytes} bytes"
                        )
                    chunks.append(chunk)

                encoding = resp.encoding or "utf-8"
                body_text = b"".join(chunks).decode(encoding, errors="replace")
                content_type = resp.headers.get("content-type", "")
                response = resp
                return FetchResult(
                    final_url=str(resp.url),
                    status_code=resp.status_code,
                    content_type=content_type,
                    html=body_text,
                )

        if response is None:
            raise httpx.TooManyRedirects("Exceeded maximum redirect hops")

        return FetchResult(
            final_url=current_url,
            status_code=response.status_code,
            content_type=response.headers.get("content-type", ""),
            html="",
        )
    finally:
        if owns_client:
            await active_client.aclose()
