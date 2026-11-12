import time
from collections import deque
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from scraper.config import Settings
from scraper.schemas import (
    ScrapedPageResult,
    ScrapeRequest,
    ScrapeResponse,
)
from scraper.security import UnsafeTargetError, validate_public_url
from scraper.services.browser_fetcher import BrowserFetcher, BrowserUnavailableError
from scraper.services.fetcher import ContentTooLargeError, FetchResult, fetch_url_safely
from scraper.services.parser import (
    build_summary,
    is_same_site,
    parse_html_document,
)

NON_HTML_EXTENSIONS = (
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
    ".zip",
    ".tar",
    ".gz",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".exe",
    ".dmg",
)


def _canonicalize_crawl_url(url: str) -> str:
    parsed = urlparse(url.strip())
    clean = parsed._replace(fragment="")
    result = clean.geturl()
    if clean.path == "/" and result.endswith("/"):
        return result[:-1]
    return result


def _matches_patterns(url: str, include_patterns: list[str], exclude_patterns: list[str]) -> bool:
    lower = url.lower()
    if any(lower.endswith(ext) for ext in NON_HTML_EXTENSIONS):
        return False
    if exclude_patterns and any(p.lower() in lower for p in exclude_patterns if p.strip()):
        return False
    if include_patterns and not any(p.lower() in lower for p in include_patterns if p.strip()):
        return False
    return True


async def _load_robots_parser(
    origin_url: str,
    settings: Settings,
    client: httpx.AsyncClient | None,
) -> RobotFileParser | None:
    parsed = urlparse(origin_url)
    if not parsed.scheme or not parsed.netloc:
        return None
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        res = await fetch_url_safely(robots_url, settings, client=client)
        if res.status_code >= 400:
            return None
        rp = RobotFileParser()
        rp.parse(res.html.splitlines())
        return rp
    except Exception:
        return None


async def crawl_website(
    req: ScrapeRequest,
    seed_url: str,
    settings: Settings,
    *,
    client: httpx.AsyncClient | None = None,
    browser_fetcher: BrowserFetcher | None = None,
    start_ms: float | None = None,
) -> ScrapeResponse:
    started = start_ms if start_ms is not None else time.perf_counter()
    cfg = req.config
    seed_host = urlparse(seed_url).hostname or ""

    robots_cache: dict[str, RobotFileParser | None] = {}
    visited: set[str] = set()
    queue: deque[tuple[str, int, str | None]] = deque([(_canonicalize_crawl_url(seed_url), 1, None)])

    pages: list[ScrapedPageResult] = []
    all_social_links: dict[str, str] = {}
    all_signals: list[str] = []
    all_contacts: list[str] = []
    all_headings: list[str] = []
    all_structured_data: list[object] = []
    root_error_status: int | None = None
    root_error_reason: str | None = None
    root_final_url: str = seed_url
    render_engine_used = "playwright_js" if cfg.render_js else "static_html"

    while queue and len(pages) < cfg.max_pages:
        current_url, depth, parent_url = queue.popleft()
        canon_key = _canonicalize_crawl_url(current_url)
        if canon_key in visited or depth > cfg.levels:
            continue
        visited.add(canon_key)

        try:
            validate_public_url(
                current_url,
                allow_private_networks=settings.allow_private_networks,
            )
        except UnsafeTargetError as exc:
            if depth == 1:
                elapsed = int((time.perf_counter() - started) * 1000)
                return ScrapeResponse(
                    target_type=req.target_type,
                    target_value=req.target_value,
                    normalized_url=current_url,
                    status="failed",
                    reachable=False,
                    error_reason=str(exc),
                    duration_ms=elapsed,
                    provider_used=render_engine_used,
                    config_used=cfg,
                )
            continue

        if cfg.respect_robots_txt:
            parsed_cur = urlparse(current_url)
            origin = f"{parsed_cur.scheme}://{parsed_cur.netloc}"
            if origin not in robots_cache:
                robots_cache[origin] = await _load_robots_parser(
                    origin, settings, client
                )
            rp = robots_cache.get(origin)
            if rp is not None and not rp.can_fetch(settings.user_agent, current_url):
                if depth == 1:
                    root_error_reason = f"Blocked by robots.txt on {origin}"
                continue

        page_start = time.perf_counter()
        fetched: FetchResult | None = None
        page_render_mode = "playwright_js" if cfg.render_js else "static_html"

        try:
            if cfg.render_js and settings.playwright_enabled:
                if browser_fetcher is not None:
                    fetched = await browser_fetcher.fetch_with_js(current_url, cfg)
                else:
                    temp_browser = BrowserFetcher(settings)
                    try:
                        fetched = await temp_browser.fetch_with_js(current_url, cfg)
                    finally:
                        await temp_browser.close()
            else:
                fetched = await fetch_url_safely(current_url, settings, client=client)
                page_render_mode = "static_html"
        except BrowserUnavailableError as exc:
            # Graceful fallback to static HTTP fetch only if Playwright browser binary is missing locally
            if depth == 1:
                root_error_reason = f"Playwright unavailable ({exc}); fell back to static HTTP"
            try:
                fetched = await fetch_url_safely(current_url, settings, client=client)
                page_render_mode = "static_html_fallback"
                render_engine_used = "static_html_fallback"
            except Exception as inner_exc:
                if depth == 1:
                    elapsed = int((time.perf_counter() - started) * 1000)
                    return ScrapeResponse(
                        target_type=req.target_type,
                        target_value=req.target_value,
                        normalized_url=current_url,
                        status="unreachable",
                        reachable=False,
                        error_reason=f"JS browser unavailable and HTTP fallback failed: {inner_exc}",
                        duration_ms=elapsed,
                        provider_used="static_html_fallback",
                        config_used=cfg,
                    )
                continue
        except UnsafeTargetError as exc:
            if depth == 1:
                elapsed = int((time.perf_counter() - started) * 1000)
                return ScrapeResponse(
                    target_type=req.target_type,
                    target_value=req.target_value,
                    normalized_url=current_url,
                    status="failed",
                    reachable=False,
                    error_reason=str(exc),
                    duration_ms=elapsed,
                    provider_used=render_engine_used,
                    config_used=cfg,
                )
            continue
        except ContentTooLargeError as exc:
            if depth == 1:
                elapsed = int((time.perf_counter() - started) * 1000)
                return ScrapeResponse(
                    target_type=req.target_type,
                    target_value=req.target_value,
                    normalized_url=current_url,
                    status="failed",
                    reachable=True,
                    error_reason=str(exc),
                    duration_ms=elapsed,
                    provider_used=render_engine_used,
                    config_used=cfg,
                )
            continue
        except (httpx.TimeoutException, httpx.TransportError, TimeoutError) as exc:
            if depth == 1:
                elapsed = int((time.perf_counter() - started) * 1000)
                return ScrapeResponse(
                    target_type=req.target_type,
                    target_value=req.target_value,
                    normalized_url=current_url,
                    status="unreachable",
                    reachable=False,
                    error_reason=f"Network/timeout error while fetching target: {exc.__class__.__name__}",
                    summary=(
                        f"Target {current_url} could not be reached directly; "
                        "using stored context metadata."
                    ),
                    duration_ms=elapsed,
                    provider_used=render_engine_used,
                    config_used=cfg,
                )
            continue
        except Exception as exc:
            if depth == 1:
                elapsed = int((time.perf_counter() - started) * 1000)
                return ScrapeResponse(
                    target_type=req.target_type,
                    target_value=req.target_value,
                    normalized_url=current_url,
                    status="failed",
                    reachable=False,
                    error_reason=f"Scrape error: {exc}",
                    duration_ms=elapsed,
                    provider_used=render_engine_used,
                    config_used=cfg,
                )
            continue

        assert fetched is not None
        page_elapsed = int((time.perf_counter() - page_start) * 1000)
        visited.add(_canonicalize_crawl_url(fetched.final_url))
        if depth == 1:
            root_final_url = fetched.final_url

        if fetched.status_code >= 400:
            if depth == 1:
                root_error_status = fetched.status_code
                root_error_reason = f"Target responded with HTTP {fetched.status_code}"
                break
            continue

        parsed = parse_html_document(
            fetched.html,
            fetched.final_url,
            seed_host=seed_host,
            include_subdomains=cfg.include_subdomains,
            extract_structured_data=cfg.extract_structured_data,
            extract_contacts_flag=cfg.extract_contacts,
        )

        page_result = ScrapedPageResult(
            url=fetched.final_url,
            canonical_url=parsed["canonical_url"],
            parent_url=parent_url,
            depth=depth,
            http_status=fetched.status_code,
            content_type=fetched.content_type,
            render_mode=page_render_mode,
            title=parsed["title"],
            description=parsed["description"],
            language=parsed["language"],
            headings=parsed["headings"],
            text_content=parsed["text_content"],
            word_count=parsed["word_count"],
            links=parsed["links"],
            social_links=parsed["social_links"],
            contacts=parsed["contacts"],
            signals=parsed["signals"],
            meta_tags=parsed["meta_tags"],
            structured_data=parsed["structured_data"],
            duration_ms=page_elapsed,
        )
        pages.append(page_result)

        for k, v in parsed["social_links"].items():
            all_social_links.setdefault(k, v)
        for sig in parsed["signals"]:
            if sig not in all_signals:
                all_signals.append(sig)
        for email in parsed["contacts"]:
            if email not in all_contacts:
                all_contacts.append(email)
        for h_txt in parsed["heading_texts"]:
            if h_txt not in all_headings and len(all_headings) < 30:
                all_headings.append(h_txt)
        for sd in parsed["structured_data"]:
            if len(all_structured_data) < 15:
                all_structured_data.append(sd)

        if depth < cfg.levels and len(pages) < cfg.max_pages:
            for link in parsed["links"]:
                next_url = urljoin(fetched.final_url, link.url)
                canon_next = _canonicalize_crawl_url(next_url)
                if canon_next in visited:
                    continue
                next_host = urlparse(next_url).hostname or ""
                if cfg.same_domain_only and not is_same_site(
                    next_host,
                    seed_host,
                    include_subdomains=cfg.include_subdomains,
                ):
                    continue
                if not _matches_patterns(
                    next_url, cfg.include_patterns, cfg.exclude_patterns
                ):
                    continue
                queue.append((next_url, depth + 1, fetched.final_url))

    elapsed = int((time.perf_counter() - started) * 1000)

    if not pages:
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=root_final_url,
            status="unreachable",
            reachable=False,
            http_status=root_error_status,
            error_reason=root_error_reason or "Target returned no crawlable HTML pages",
            summary=(
                f"Target {root_final_url} returned HTTP {root_error_status} "
                "(likely anti-bot protection or gated access)."
                if root_error_status
                else (root_error_reason or "No crawlable pages found.")
            ),
            duration_ms=elapsed,
            provider_used=render_engine_used,
            config_used=cfg,
        )

    root_page = pages[0]
    levels_scraped = max(p.depth for p in pages)
    title = root_page.title or next((p.title for p in pages if p.title), None)
    description = root_page.description or next(
        (p.description for p in pages if p.description), None
    )
    raw_preview = root_page.text_content[:1500] if root_page.text_content else None
    summary = build_summary(
        title,
        description,
        all_signals,
        all_social_links,
        pages_count=len(pages),
        levels_scraped=levels_scraped,
    )

    return ScrapeResponse(
        target_type=req.target_type,
        target_value=req.target_value,
        normalized_url=root_page.url,
        status="completed",
        reachable=True,
        http_status=root_page.http_status,
        title=title,
        description=description,
        headings=all_headings[:20],
        social_links=all_social_links,
        signals=all_signals,
        raw_preview=raw_preview,
        summary=summary or None,
        error_reason=root_error_reason,
        duration_ms=elapsed,
        provider_used=render_engine_used,
        specialized_provider=None,
        requires_api_key=False,
        api_key_configured=False,
        levels_scraped=levels_scraped,
        pages_scraped=len(pages),
        contacts=all_contacts,
        structured_data=all_structured_data,
        pages=pages,
        config_used=cfg,
    )
