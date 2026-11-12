import json
import re
from typing import Any
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from scraper.schemas import (
    ContextType,
    ScrapedHeading,
    ScrapedLink,
    SpecializedProvider,
)

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
    "developer_sdk": (
        "sdk",
        "typescript sdk",
        "python sdk",
        "github.com",
        "npm install",
        "crate",
    ),
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
    "governance": ("governance", "snapshot.org", "tally.xyz", "dao proposal", "forum."),
    "bridge": ("cross-chain", "omnichain", "layerzero", "wormhole", "bridge"),
    "security_bounty": ("immunefi", "bug bounty", "hackenproof", "security policy"),
}

URL_REGEX = re.compile(r"https?://[^\s<>()\"']+", re.IGNORECASE)
HANDLE_REGEX = re.compile(r"(?<!\w)@([A-Za-z0-9_]{3,32})")
EMAIL_REGEX = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,12}\b"
)
IGNORED_EMAIL_DOMAINS = {"example.com", "sentry.io", "wixpress.com"}
IGNORED_EMAIL_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js")


def clean_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def normalize_host(host: str | None) -> str:
    if not host:
        return ""
    h = host.lower().strip().rstrip(".")
    return h[4:] if h.startswith("www.") else h


def is_same_site(candidate_host: str, seed_host: str, *, include_subdomains: bool) -> bool:
    cand = normalize_host(candidate_host)
    seed = normalize_host(seed_host)
    if not cand or not seed:
        return False
    if cand == seed:
        return True
    if include_subdomains:
        return cand.endswith(f".{seed}") or seed.endswith(f".{cand}")
    return False


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
        if value.startswith("t.me/") or value.startswith("telegram.me/"):
            return f"https://{value}"
        return f"https://t.me/{value}"
    return f"https://{value}"


def detect_specialized_provider(
    target_type: ContextType,
    normalized_url: str | None = None,
    raw_value: str | None = None,
) -> SpecializedProvider | None:
    if target_type == "x_handle":
        return "x"
    if target_type == "linkedin":
        return "linkedin"
    if target_type == "telegram":
        return "telegram"
    if target_type == "message":
        return None

    candidate = (normalized_url or raw_value or "").strip().lower()
    if not candidate:
        return None
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    host = normalize_host(urlparse(candidate).hostname)
    if host == "x.com" or host.endswith(".x.com") or host == "twitter.com" or host.endswith(".twitter.com"):
        return "x"
    if host == "linkedin.com" or host.endswith(".linkedin.com"):
        return "linkedin"
    if host == "t.me" or host.endswith(".t.me") or host == "telegram.me" or host.endswith(".telegram.me"):
        return "telegram"
    return None


def classify_social_link(href: str) -> str | None:
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
    if "youtube.com" in host or "youtu.be" in host:
        return "youtube"
    if "medium.com" in host or "mirror.xyz" in host or "substack.com" in host:
        return "blog"
    if host.startswith("docs.") or "/docs" in parsed.path:
        return "docs"
    if "dune.com" in host or "defillama.com" in host:
        return "analytics"
    return None


def detect_signals(corpus: str, links: dict[str, str]) -> list[str]:
    combined = f"{corpus} {' '.join(links.values())}".lower()
    detected: list[str] = []
    for signal_name, keywords in SIGNAL_PATTERNS.items():
        if any(kw in combined for kw in keywords):
            detected.append(signal_name)
    return detected


def extract_contacts(corpus: str, mailto_addresses: list[str]) -> list[str]:
    seen: list[str] = []
    candidates = [*mailto_addresses, *EMAIL_REGEX.findall(corpus)]
    for raw in candidates:
        email = raw.strip().lower().rstrip(".,;:)")
        if not email or "@" not in email:
            continue
        domain = email.split("@", 1)[1]
        if domain in IGNORED_EMAIL_DOMAINS:
            continue
        if any(email.endswith(ext) for ext in IGNORED_EMAIL_EXTENSIONS):
            continue
        if email not in seen:
            seen.append(email)
        if len(seen) >= 20:
            break
    return seen


def build_summary(
    title: str | None,
    description: str | None,
    signals: list[str],
    social_links: dict[str, str],
    pages_count: int = 1,
    levels_scraped: int = 1,
) -> str:
    parts: list[str] = []
    if title:
        parts.append(title)
    if description and description != title:
        parts.append(description)
    if pages_count > 1:
        parts.append(f"Crawled {pages_count} pages across {levels_scraped} levels")
    if signals:
        parts.append(f"Signals: {', '.join(signals)}")
    if social_links:
        parts.append(f"Links: {', '.join(sorted(social_links.keys()))}")
    return " • ".join(parts)[:800]


def parse_html_document(
    html: str,
    base_url: str,
    *,
    seed_host: str | None = None,
    include_subdomains: bool = True,
    extract_structured_data: bool = True,
    extract_contacts_flag: bool = True,
) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")

    structured_data: list[Any] = []
    if extract_structured_data:
        for script_tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
            raw_json = script_tag.string or script_tag.get_text()
            if not raw_json or not raw_json.strip():
                continue
            try:
                parsed_ld = json.loads(raw_json)
                structured_data.append(parsed_ld)
            except Exception:
                continue
            if len(structured_data) >= 10:
                break

    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    html_el = soup.find("html")
    language = (
        clean_text(str(html_el.get("lang")))[:24]
        if html_el and html_el.get("lang")
        else None
    )

    canonical_tag = soup.find("link", attrs={"rel": lambda v: v and "canonical" in v})
    canonical_url = (
        urljoin(base_url, str(canonical_tag["href"]).strip())
        if canonical_tag and canonical_tag.get("href")
        else None
    )

    meta_tags: dict[str, str] = {}
    for meta in soup.find_all("meta"):
        key = meta.get("property") or meta.get("name")
        content = meta.get("content")
        if key and content:
            k_str = clean_text(str(key))[:60]
            v_str = clean_text(str(content))[:500]
            if k_str and v_str and k_str not in meta_tags:
                meta_tags[k_str] = v_str
        if len(meta_tags) >= 30:
            break

    raw_title = (
        meta_tags.get("og:title")
        or (soup.title.string if soup.title and soup.title.string else "")
    )
    title = clean_text(raw_title)[:240] or None

    description = (
        meta_tags.get("description")
        or meta_tags.get("og:description")
        or meta_tags.get("twitter:description")
    )
    if description:
        description = description[:500]

    headings: list[ScrapedHeading] = []
    heading_texts: list[str] = []
    for heading_tag in soup.find_all(["h1", "h2", "h3"], limit=25):
        cleaned = clean_text(heading_tag.get_text(" ", strip=True))
        if cleaned and cleaned not in heading_texts:
            heading_texts.append(cleaned[:200])
            headings.append(
                ScrapedHeading(level=heading_tag.name.lower(), text=cleaned[:200])
            )

    if not title and heading_texts:
        title = heading_texts[0][:240]

    effective_seed_host = seed_host or urlparse(base_url).hostname or ""
    links: list[ScrapedLink] = []
    seen_link_urls: set[str] = set()
    social_links: dict[str, str] = {}
    mailto_addresses: list[str] = []

    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"]).strip()
        if not href or href.startswith(("#", "javascript:", "tel:")):
            continue
        if href.lower().startswith("mailto:"):
            addr = href[7:].split("?", 1)[0].strip()
            if addr:
                mailto_addresses.append(addr)
            continue

        resolved = urljoin(base_url, href)
        parsed = urlparse(resolved)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            continue

        clean_url = parsed._replace(fragment="").geturl()
        category = classify_social_link(clean_url)
        if category and category not in social_links:
            social_links[category] = clean_url

        if clean_url not in seen_link_urls and len(links) < 150:
            seen_link_urls.add(clean_url)
            anchor_text = clean_text(anchor.get_text(" ", strip=True))[:160]
            internal = is_same_site(
                parsed.hostname,
                effective_seed_host,
                include_subdomains=include_subdomains,
            )
            links.append(
                ScrapedLink(
                    url=clean_url,
                    text=anchor_text,
                    is_internal=internal,
                    category=category,
                )
            )

    body_text = clean_text(soup.get_text(" ", strip=True))
    text_content = body_text[:30000] or None
    word_count = len(body_text.split()) if body_text else 0
    raw_preview = body_text[:1500] or None

    contacts = (
        extract_contacts(body_text[:20000], mailto_addresses)
        if extract_contacts_flag
        else []
    )

    corpus = " ".join(
        filter(None, [title, description, " ".join(heading_texts), body_text[:12000]])
    )
    signals = detect_signals(corpus, social_links)
    summary = build_summary(title, description, signals, social_links)

    return {
        "title": title,
        "description": description,
        "language": language,
        "canonical_url": canonical_url,
        "headings": headings,
        "heading_texts": heading_texts,
        "links": links,
        "social_links": social_links,
        "contacts": contacts,
        "signals": signals,
        "meta_tags": meta_tags,
        "structured_data": structured_data,
        "text_content": text_content,
        "word_count": word_count,
        "raw_preview": raw_preview,
        "summary": summary or None,
    }
