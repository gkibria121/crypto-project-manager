import re
import time
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from scraper.config import Settings
from scraper.schemas import ContextType, ScrapeRequest, ScrapeResponse
from scraper.security import UnsafeTargetError, validate_public_url
from scraper.services.fetcher import ContentTooLargeError, fetch_url_safely

SIGNAL_PATTERNS: dict[str, tuple[str, ...]] = {
    "telegram_bot": ("t.me/", "telegram bot", "mini app", "mini-app", "tg bot"),
    "mcp_server": ("model context protocol", "mcp server", "mcp-server", "mcp"),
    "ai_integration": (
        "chatgpt",
        "claude",
        "ai agent",
        "agentic",
        "llm",
        "inference",
        "deepmind",
    ),
    "developer_sdk": ("sdk", "typescript sdk", "python sdk", "github.com", "npm install"),
    "api_docs": ("api docs", "openapi", "swagger", "graphql", "rest api", "docs."),
    "onchain_analytics": (
        "dune.com",
        "defillama",
        "tvl",
        "on-chain",
        "onchain",
        "explorer",
        "telemetry",
    ),
    "audit": ("audit", "spearbit", "certik", "trail of bits", "halborn", "zellic"),
    "litepaper": ("litepaper", "whitepaper", "manifesto", "tokenomics"),
    "mainnet": ("mainnet", "testnet", "epoch", "staking", "restaking"),
}

URL_REGEX = re.compile(r"https?://[^\s<>()\"']+", re.IGNORECASE)
HANDLE_REGEX = re.compile(r"(?<!\w)@([A-Za-z0-9_]{3,32})")


def normalize_target_url(target_type: ContextType, raw_value: str) -> str | None:
    value = raw_value.strip()
    if not value or target_type == "message":
        return None
    if "://" in value:
        return value
    if target_type == "x_handle":
        handle = value.lstrip("@").split("/")[0]
        return f"https://x.com/{handle}"
    if target_type == "telegram":
        if value.startswith("@"):
            return f"https://t.me/{value.lstrip('@')}"
        if value.startswith("t.me/"):
            return f"https://{value}"
        return f"https://t.me/{value}"
    return f"https://{value}"


def _clean_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _detect_signals(corpus: str, links: dict[str, str]) -> list[str]:
    combined = f"{corpus} {' '.join(links.values())}".lower()
    detected: list[str] = []
    for signal_name, keywords in SIGNAL_PATTERNS.items():
        if any(kw in combined for kw in keywords):
            detected.append(signal_name)
    return detected


def _classify_social_link(href: str) -> str | None:
    lower = href.lower()
    parsed = urlparse(lower)
    host = parsed.hostname or ""
    if "x.com" in host or "twitter.com" in host:
        return "x"
    if "t.me" in host or "telegram.me" in host:
        return "telegram"
    if "linkedin.com" in host:
        return "linkedin"
    if "github.com" in host:
        return "github"
    if "discord.gg" in host or "discord.com" in host:
        return "discord"
    if host.startswith("docs.") or "/docs" in parsed.path:
        return "docs"
    if "dune.com" in host or "defillama.com" in host:
        return "analytics"
    return None


def _build_summary(
    title: str | None,
    description: str | None,
    signals: list[str],
    social_links: dict[str, str],
) -> str:
    parts: list[str] = []
    if title:
        parts.append(title)
    if description and description != title:
        parts.append(description)
    if signals:
        parts.append(f"Signals: {', '.join(signals)}")
    if social_links:
        parts.append(f"Links: {', '.join(sorted(social_links.keys()))}")
    return " • ".join(parts)[:600]


def _extract_from_message_note(req: ScrapeRequest, start_ms: float) -> ScrapeResponse:
    text = _clean_text(req.target_value)
    links: dict[str, str] = {}
    for match in URL_REGEX.findall(text):
        category = _classify_social_link(match) or "reference"
        links.setdefault(category, match)
    handles = HANDLE_REGEX.findall(text)
    if handles and "x" not in links:
        links["x_mentioned"] = f"@{handles[0]}"

    signals = _detect_signals(text, links)
    summary = _build_summary(
        title="Admin Note Analysis",
        description=text[:240],
        signals=signals,
        social_links=links,
    )
    elapsed = int((time.perf_counter() - start_ms) * 1000)
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
    )


def parse_html_document(html: str, base_url: str) -> dict:
    soup = BeautifulSoup(html, "lxml")

    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    og_title = soup.find("meta", attrs={"property": "og:title"})
    raw_title = (
        og_title.get("content")
        if og_title and og_title.get("content")
        else (soup.title.string if soup.title else "")
    )
    title = _clean_text(raw_title)[:200] or None

    description = None
    for attr_key, attr_val in (
        ("name", "description"),
        ("property", "og:description"),
        ("name", "twitter:description"),
    ):
        meta = soup.find("meta", attrs={attr_key: attr_val})
        if meta and meta.get("content"):
            description = _clean_text(str(meta.get("content")))[:400]
            break

    headings: list[str] = []
    for heading_tag in soup.find_all(["h1", "h2"], limit=8):
        cleaned = _clean_text(heading_tag.get_text(" ", strip=True))
        if cleaned and cleaned not in headings:
            headings.append(cleaned[:160])

    social_links: dict[str, str] = {}
    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"]).strip()
        if not href or href.startswith(("#", "mailto:", "javascript:")):
            continue
        resolved = urljoin(base_url, href)
        category = _classify_social_link(resolved)
        if category and category not in social_links:
            social_links[category] = resolved

    body_text = _clean_text(soup.get_text(" ", strip=True))
    raw_preview = body_text[:1500] or None

    corpus = " ".join(
        filter(None, [title, description, " ".join(headings), body_text[:6000]])
    )
    signals = _detect_signals(corpus, social_links)
    summary = _build_summary(title, description, signals, social_links)

    return {
        "title": title,
        "description": description,
        "headings": headings,
        "social_links": social_links,
        "signals": signals,
        "raw_preview": raw_preview,
        "summary": summary or None,
    }


async def scrape_target(
    req: ScrapeRequest,
    settings: Settings,
    client: httpx.AsyncClient | None = None,
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
        )

    try:
        validate_public_url(
            normalized_url,
            allow_private_networks=settings.allow_private_networks,
        )
        fetched = await fetch_url_safely(normalized_url, settings, client=client)
    except UnsafeTargetError as exc:
        elapsed = int((time.perf_counter() - start_ms) * 1000)
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed",
            reachable=False,
            error_reason=str(exc),
            duration_ms=elapsed,
        )
    except ContentTooLargeError as exc:
        elapsed = int((time.perf_counter() - start_ms) * 1000)
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed",
            reachable=True,
            error_reason=str(exc),
            duration_ms=elapsed,
        )
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        elapsed = int((time.perf_counter() - start_ms) * 1000)
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="unreachable",
            reachable=False,
            error_reason=f"Network error while fetching target: {exc.__class__.__name__}",
            summary=(
                f"Target {normalized_url} could not be reached directly; "
                "using stored context metadata."
            ),
            duration_ms=elapsed,
        )

    elapsed = int((time.perf_counter() - start_ms) * 1000)

    if fetched.status_code >= 400:
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=fetched.final_url,
            status="unreachable",
            reachable=False,
            http_status=fetched.status_code,
            error_reason=f"Target responded with HTTP {fetched.status_code}",
            summary=(
                f"Target {fetched.final_url} returned HTTP {fetched.status_code} "
                "(likely anti-bot protection or gated access)."
            ),
            duration_ms=elapsed,
        )

    parsed = parse_html_document(fetched.html, fetched.final_url)
    return ScrapeResponse(
        target_type=req.target_type,
        target_value=req.target_value,
        normalized_url=fetched.final_url,
        status="completed",
        reachable=True,
        http_status=fetched.status_code,
        title=parsed["title"],
        description=parsed["description"],
        headings=parsed["headings"],
        social_links=parsed["social_links"],
        signals=parsed["signals"],
        raw_preview=parsed["raw_preview"],
        summary=parsed["summary"],
        error_reason=None,
        duration_ms=elapsed,
    )
