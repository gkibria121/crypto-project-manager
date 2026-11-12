import time

import httpx

from scraper.config import Settings
from scraper.schemas import (
    ScrapedHeading,
    ScrapedLink,
    ScrapedPageResult,
    ScrapeRequest,
    ScrapeResponse,
)
from scraper.services.browser_fetcher import BrowserFetcher
from scraper.services.crawler import crawl_website
from scraper.services.parser import (
    HANDLE_REGEX,
    URL_REGEX,
    build_summary,
    classify_social_link,
    clean_text,
    detect_signals,
    detect_specialized_provider,
    extract_contacts,
    normalize_target_url,
    parse_html_document,
)
from scraper.services.specialized import scrape_specialized_target

# Re-export parse_html_document and normalize_target_url for backward compatibility
__all__ = [
    "normalize_target_url",
    "parse_html_document",
    "scrape_target",
]


def _extract_from_message_note(req: ScrapeRequest, start_ms: float) -> ScrapeResponse:
    text = clean_text(req.target_value)
    links: dict[str, str] = {}
    link_items: list[ScrapedLink] = []
    for match in URL_REGEX.findall(text):
        category = classify_social_link(match) or "reference"
        links.setdefault(category, match)
        link_items.append(
            ScrapedLink(url=match, text=match, is_internal=False, category=category)
        )
    handles = HANDLE_REGEX.findall(text)
    if handles and "x" not in links:
        links["x_mentioned"] = f"@{handles[0]}"

    signals = detect_signals(text, links)
    contacts = extract_contacts(text, []) if req.config.extract_contacts else []
    summary = build_summary(
        title="Admin Note Analysis",
        description=text[:240],
        signals=signals,
        social_links=links,
    )
    elapsed = int((time.perf_counter() - start_ms) * 1000)

    note_page = ScrapedPageResult(
        url="note://admin-context",
        depth=1,
        render_mode="note_parser",
        title="Admin Context Note",
        description=text[:300],
        headings=[ScrapedHeading(level="h1", text="Admin Context Note")],
        text_content=text,
        word_count=len(text.split()),
        links=link_items,
        social_links=links,
        contacts=contacts,
        signals=signals,
        duration_ms=elapsed,
    )

    return ScrapeResponse(
        target_type=req.target_type,
        target_value=req.target_value,
        normalized_url=None,
        status="completed",
        reachable=True,
        http_status=None,
        title="Admin Context Note",
        description=text[:300],
        headings=[],
        social_links=links,
        signals=signals,
        raw_preview=text[:1200],
        summary=summary,
        error_reason=None,
        duration_ms=elapsed,
        provider_used="note_parser",
        levels_scraped=1,
        pages_scraped=1,
        contacts=contacts,
        pages=[note_page],
        config_used=req.config,
    )


async def scrape_target(
    req: ScrapeRequest,
    settings: Settings,
    client: httpx.AsyncClient | None = None,
    browser_fetcher: BrowserFetcher | None = None,
) -> ScrapeResponse:
    start_ms = time.perf_counter()

    if req.target_type == "message":
        return _extract_from_message_note(req, start_ms)

    normalized_url = normalize_target_url(req.target_type, req.target_value)
    if not normalized_url:
        elapsed = int((time.perf_counter() - start_ms) * 1000)
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=None,
            status="failed",
            reachable=False,
            error_reason="Could not normalize target into a valid HTTP(S) URL",
            duration_ms=elapsed,
            config_used=req.config,
        )

    specialized = detect_specialized_provider(
        req.target_type, normalized_url, req.target_value
    )
    if specialized is not None:
        return await scrape_specialized_target(
            specialized,
            req,
            normalized_url,
            settings,
            client=client,
            start_ms=start_ms,
        )

    return await crawl_website(
        req,
        normalized_url,
        settings,
        client=client,
        browser_fetcher=browser_fetcher,
        start_ms=start_ms,
    )
