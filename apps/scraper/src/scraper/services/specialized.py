import re
import time
from typing import Any
from urllib.parse import urlparse

import httpx

from scraper.config import Settings
from scraper.schemas import (
    ScrapedHeading,
    ScrapedLink,
    ScrapedPageResult,
    ScrapeRequest,
    ScrapeResponse,
    SpecializedProvider,
)
from scraper.services.parser import (
    URL_REGEX,
    build_summary,
    classify_social_link,
    clean_text,
    detect_signals,
    extract_contacts,
)

PROVIDER_REQUIREMENTS: dict[SpecializedProvider, dict[str, str]] = {
    "x": {
        "env_var": "X_API_BEARER_TOKEN",
        "label": "X (Twitter) API v2",
        "preferred_method": "Official X API v2 (/2/users/by/username & /2/users/:id/tweets)",
        "reason": (
            "X (Twitter) API key is needed (X_API_BEARER_TOKEN). X blocks unauthenticated "
            "scraping behind a login wall; configure an X API v2 Bearer Token in Global "
            "Settings or .env to scrape profiles and posts via the official X API v2."
        ),
    },
    "linkedin": {
        "env_var": "LINKEDIN_API_KEY",
        "label": "LinkedIn REST API",
        "preferred_method": "Official LinkedIn Organizations & Community REST API",
        "reason": (
            "LinkedIn API key is needed (LINKEDIN_API_KEY). LinkedIn blocks unauthenticated "
            "scraping; configure an official LinkedIn OAuth 2.0 Access Token in Global "
            "Settings or .env to fetch organization details and posts via LinkedIn REST API."
        ),
    },
    "telegram": {
        "env_var": "TELEGRAM_BOT_TOKEN",
        "label": "Telegram Bot API",
        "preferred_method": "Official Telegram Bot API (getChat, getChatMemberCount, getUpdates)",
        "reason": (
            "Telegram API key is needed (TELEGRAM_BOT_TOKEN). Create a bot token via "
            "@BotFather and configure it in Global Settings or .env to inspect Telegram "
            "channels, groups, and messages via the official Telegram Bot API."
        ),
    },
}


def resolve_provider_api_key(
    provider: SpecializedProvider,
    req: ScrapeRequest,
    settings: Settings,
) -> str:
    creds = req.provider_credentials
    if provider == "x":
        return ((creds.x_bearer_token if creds else None) or settings.x_api_bearer_token).strip()
    if provider == "linkedin":
        return ((creds.linkedin_access_token if creds else None) or settings.linkedin_api_key).strip()
    if provider == "telegram":
        return ((creds.telegram_bot_token if creds else None) or settings.telegram_bot_token).strip()
    return ""


def _missing_key_response(
    provider: SpecializedProvider,
    req: ScrapeRequest,
    normalized_url: str,
    start_ms: float,
) -> ScrapeResponse:
    meta = PROVIDER_REQUIREMENTS[provider]
    elapsed = int((time.perf_counter() - start_ms) * 1000)
    return ScrapeResponse(
        target_type=req.target_type,
        target_value=req.target_value,
        normalized_url=normalized_url,
        status="api_key_required",
        reachable=False,
        error_reason=meta["reason"],
        summary=meta["reason"],
        duration_ms=elapsed,
        provider_used=f"{provider}_api_key_required",
        specialized_provider=provider,
        requires_api_key=True,
        api_key_configured=False,
        levels_scraped=0,
        pages_scraped=0,
        config_used=req.config,
    )


def _extract_links_from_texts(
    texts: list[str],
    explicit_urls: list[str] | None = None,
) -> tuple[list[ScrapedLink], dict[str, str]]:
    links: list[ScrapedLink] = []
    social_links: dict[str, str] = {}
    seen: set[str] = set()

    candidates: list[str] = list(explicit_urls or [])
    for txt in texts:
        if txt:
            candidates.extend(URL_REGEX.findall(txt))

    for raw in candidates:
        cleaned = raw.strip().rstrip(".,;)")
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        cat = classify_social_link(cleaned)
        if cat and cat not in social_links:
            social_links[cat] = cleaned
        links.append(
            ScrapedLink(url=cleaned, text=cleaned, is_internal=False, category=cat)
        )
    return links, social_links


def _extract_x_target(normalized_url: str, raw_value: str) -> tuple[str | None, str | None]:
    """Return (username, tweet_id) parsed from an X handle or URL."""
    status_match = re.search(
        r"(?:x\.com|twitter\.com)/([A-Za-z0-9_]+)/status/(\d+)",
        normalized_url,
        re.IGNORECASE,
    )
    if status_match:
        return status_match.group(1), status_match.group(2)

    parsed = urlparse(normalized_url)
    segments = [seg for seg in parsed.path.split("/") if seg]
    if segments and segments[0].lower() not in {"i", "intent", "search", "explore", "home"}:
        return segments[0].lstrip("@"), None

    fallback = raw_value.strip().lstrip("@").split("/")[0]
    return (fallback or None), None


async def _scrape_x_api(
    req: ScrapeRequest,
    normalized_url: str,
    api_key: str,
    client: httpx.AsyncClient,
    start_ms: float,
) -> ScrapeResponse:
    username, tweet_id = _extract_x_target(normalized_url, req.target_value)
    if not username and not tweet_id:
        elapsed = int((time.perf_counter() - start_ms) * 1000)
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed",
            reachable=False,
            error_reason="Could not parse an X username or status ID from target.",
            duration_ms=elapsed,
            provider_used="x_api_v2",
            specialized_provider="x",
            requires_api_key=True,
            api_key_configured=True,
            config_used=req.config,
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }
    timeout = httpx.Timeout(req.config.timeout_seconds)

    if tweet_id and not username:
        endpoint = f"https://api.x.com/2/tweets/{tweet_id}"
        resp = await client.get(
            endpoint,
            headers=headers,
            params={
                "tweet.fields": "created_at,public_metrics,entities,lang",
                "expansions": "author_id",
                "user.fields": "name,username,description,public_metrics,verified",
            },
            timeout=timeout,
        )
    else:
        endpoint = f"https://api.x.com/2/users/by/username/{username}"
        resp = await client.get(
            endpoint,
            headers=headers,
            params={
                "user.fields": (
                    "created_at,description,entities,id,location,name,"
                    "pinned_tweet_id,profile_image_url,public_metrics,url,verified,verified_type"
                )
            },
            timeout=timeout,
        )

    elapsed = int((time.perf_counter() - start_ms) * 1000)
    if resp.status_code >= 400:
        detail = clean_text(resp.text)[:300]
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed" if resp.status_code in (401, 403, 404) else "unreachable",
            reachable=resp.status_code not in (401, 403, 429),
            http_status=resp.status_code,
            error_reason=f"X API v2 returned HTTP {resp.status_code}: {detail}",
            summary=f"X API v2 request failed with HTTP {resp.status_code}.",
            duration_ms=elapsed,
            provider_used="x_api_v2",
            specialized_provider="x",
            requires_api_key=True,
            api_key_configured=True,
            config_used=req.config,
        )

    payload = resp.json()
    user_data: dict[str, Any] = payload.get("data") or {}
    if not user_data:
        errors = payload.get("errors") or []
        err_msg = errors[0].get("detail") if errors else "User or tweet not found on X."
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed",
            reachable=True,
            http_status=resp.status_code,
            error_reason=f"X API v2 error: {err_msg}",
            duration_ms=elapsed,
            provider_used="x_api_v2",
            specialized_provider="x",
            requires_api_key=True,
            api_key_configured=True,
            config_used=req.config,
        )

    x_limit = req.config.x_posts_limit
    tweets: list[dict[str, Any]] = []
    if user_data.get("id") and not tweet_id and x_limit > 0:
        # X API v2 /users/:id/tweets requires max_results in [5, 100]; slice to exact configured limit
        api_max_results = min(max(5, x_limit), 100)
        tweets_resp = await client.get(
            f"https://api.x.com/2/users/{user_data['id']}/tweets",
            headers=headers,
            params={
                "max_results": api_max_results,
                "tweet.fields": "created_at,public_metrics,entities,lang",
                "exclude": "retweets,replies",
            },
            timeout=timeout,
        )
        if tweets_resp.status_code == 200:
            tweets = (tweets_resp.json().get("data") or [])[:x_limit]

    explicit_urls: list[str] = []
    for url_item in (user_data.get("entities") or {}).get("url", {}).get("urls", []):
        if url_item.get("expanded_url"):
            explicit_urls.append(str(url_item["expanded_url"]))
    for desc_url in (user_data.get("entities") or {}).get("description", {}).get("urls", []):
        if desc_url.get("expanded_url"):
            explicit_urls.append(str(desc_url["expanded_url"]))
    for tw in tweets:
        for tw_url in (tw.get("entities") or {}).get("urls", []):
            if tw_url.get("expanded_url"):
                explicit_urls.append(str(tw_url["expanded_url"]))

    bio = clean_text(user_data.get("description") or user_data.get("text"))
    tweet_texts = [clean_text(t.get("text")) for t in tweets if t.get("text")]
    all_texts = [bio, *tweet_texts]
    links, social_links = _extract_links_from_texts(all_texts, explicit_urls)
    social_links.setdefault("x", normalized_url)

    metrics = user_data.get("public_metrics") or {}
    followers = metrics.get("followers_count")
    following = metrics.get("following_count")
    tweet_count = metrics.get("tweet_count")
    display_name = user_data.get("name") or f"@{username}"
    title = f"{display_name} (@{user_data.get('username', username)}) on X"
    if followers is not None:
        title = f"{title} · {followers:,} followers"

    profile_lines = [
        f"Name: {display_name}",
        f"Handle: @{user_data.get('username', username)}",
        f"Bio: {bio}" if bio else "",
        f"Location: {user_data.get('location')}" if user_data.get("location") else "",
        f"Followers: {followers:,}" if isinstance(followers, int) else "",
        f"Following: {following:,}" if isinstance(following, int) else "",
        f"Total Posts: {tweet_count:,}" if isinstance(tweet_count, int) else "",
    ]
    profile_text = "\n".join(line for line in profile_lines if line)
    combined_corpus = "\n".join([profile_text, *tweet_texts])
    signals = detect_signals(combined_corpus, social_links)
    contacts = (
        extract_contacts(combined_corpus, []) if req.config.extract_contacts else []
    )

    pages: list[ScrapedPageResult] = [
        ScrapedPageResult(
            url=normalized_url,
            canonical_url=normalized_url,
            parent_url=None,
            depth=1,
            http_status=resp.status_code,
            content_type="application/json",
            render_mode="x_api_v2",
            title=title[:240],
            description=bio[:500] or None,
            headings=[
                ScrapedHeading(level="h1", text=title[:200]),
            ],
            text_content=profile_text,
            word_count=len(profile_text.split()),
            links=links,
            social_links=social_links,
            contacts=contacts,
            signals=signals,
            platform_data={
                "provider": "x",
                "user": user_data,
            },
            duration_ms=elapsed,
        )
    ]

    if tweets:
        posts_body = "\n\n".join(
            f"[{t.get('created_at', '')}] {clean_text(t.get('text'))}" for t in tweets
        )
        pages.append(
            ScrapedPageResult(
                url=f"{normalized_url}#recent-posts",
                canonical_url=normalized_url,
                parent_url=normalized_url,
                depth=2,
                http_status=200,
                content_type="application/json",
                render_mode="x_api_v2",
                title=f"Recent Posts ({len(tweets)}) — @{user_data.get('username', username)}",
                description=f"Latest {len(tweets)} posts fetched via X API v2",
                headings=[ScrapedHeading(level="h2", text=f"Recent {len(tweets)} X Posts")],
                text_content=posts_body[:30000],
                word_count=len(posts_body.split()),
                links=links,
                social_links=social_links,
                contacts=contacts,
                signals=detect_signals(posts_body, social_links),
                platform_data={"provider": "x", "tweets": tweets},
                duration_ms=elapsed,
            )
        )

    platform_data = {
        "provider": "x",
        "username": user_data.get("username", username),
        "userId": user_data.get("id"),
        "name": display_name,
        "verified": bool(user_data.get("verified")),
        "verifiedType": user_data.get("verified_type"),
        "metrics": metrics,
        "bio": bio,
        "location": user_data.get("location"),
        "recentPostsCount": len(tweets),
        "xPostsLimit": x_limit,
        "recentPosts": tweets,
    }

    levels_scraped = max((p.depth for p in pages), default=1)
    summary = build_summary(
        title,
        bio[:400] or None,
        signals,
        social_links,
        pages_count=len(pages),
        levels_scraped=levels_scraped,
    )

    return ScrapeResponse(
        target_type=req.target_type,
        target_value=req.target_value,
        normalized_url=normalized_url,
        status="completed",
        reachable=True,
        http_status=resp.status_code,
        title=title[:240],
        description=bio[:500] or None,
        headings=[title[:200], *(t[:120] for t in tweet_texts[:5])],
        social_links=social_links,
        signals=signals,
        raw_preview=combined_corpus[:1500] or None,
        summary=summary or None,
        duration_ms=int((time.perf_counter() - start_ms) * 1000),
        provider_used="x_api_v2",
        specialized_provider="x",
        requires_api_key=True,
        api_key_configured=True,
        levels_scraped=levels_scraped,
        pages_scraped=len(pages),
        contacts=contacts,
        platform_data=platform_data,
        pages=pages,
        config_used=req.config,
    )


def _extract_linkedin_slug(normalized_url: str) -> tuple[str, str]:
    """Return (kind, slug) where kind is 'company' | 'school' | 'in' | 'unknown'."""
    parsed = urlparse(normalized_url)
    segments = [seg for seg in parsed.path.split("/") if seg]
    if len(segments) >= 2 and segments[0].lower() in ("company", "school", "in"):
        return segments[0].lower(), segments[1]
    if segments:
        return "company", segments[-1]
    return "unknown", ""


async def _scrape_linkedin_api(
    req: ScrapeRequest,
    normalized_url: str,
    api_key: str,
    client: httpx.AsyncClient,
    start_ms: float,
) -> ScrapeResponse:
    kind, slug = _extract_linkedin_slug(normalized_url)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "LinkedIn-Version": "202411",
        "X-Restli-Protocol-Version": "2.0.0",
    }
    timeout = httpx.Timeout(req.config.timeout_seconds)

    if kind == "in":
        resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
            timeout=timeout,
        )
    else:
        resp = await client.get(
            "https://api.linkedin.com/rest/organizations",
            headers=headers,
            params={"q": "vanityName", "vanityName": slug},
            timeout=timeout,
        )
        if resp.status_code in (404, 410):
            resp = await client.get(
                "https://api.linkedin.com/v2/organizations",
                headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
                params={"q": "vanityName", "vanityName": slug},
                timeout=timeout,
            )

    elapsed = int((time.perf_counter() - start_ms) * 1000)
    if resp.status_code >= 400:
        detail = clean_text(resp.text)[:300]
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed" if resp.status_code in (401, 403, 404) else "unreachable",
            reachable=resp.status_code not in (401, 403, 429),
            http_status=resp.status_code,
            error_reason=f"LinkedIn API returned HTTP {resp.status_code}: {detail}",
            summary=f"LinkedIn API request failed with HTTP {resp.status_code}.",
            duration_ms=elapsed,
            provider_used="linkedin_api",
            specialized_provider="linkedin",
            requires_api_key=True,
            api_key_configured=True,
            config_used=req.config,
        )

    data = resp.json()
    if kind == "in":
        name = clean_text(data.get("name") or f"{data.get('given_name', '')} {data.get('family_name', '')}")
        email = data.get("email")
        title = f"{name or slug} — LinkedIn Profile"
        description = clean_text(data.get("locale", {}).get("country") if isinstance(data.get("locale"), dict) else "")
        text_body = "\n".join(
            line
            for line in [
                f"Name: {name}" if name else "",
                f"Sub: {data.get('sub')}" if data.get("sub") else "",
                f"Email: {email}" if email else "",
            ]
            if line
        )
        contacts = [email] if email and req.config.extract_contacts else []
        social_links = {"linkedin": normalized_url}
        page = ScrapedPageResult(
            url=normalized_url,
            canonical_url=normalized_url,
            depth=1,
            http_status=resp.status_code,
            content_type="application/json",
            render_mode="linkedin_api",
            title=title[:240],
            description=description or None,
            headings=[ScrapedHeading(level="h1", text=title[:200])],
            text_content=text_body or None,
            word_count=len(text_body.split()),
            social_links=social_links,
            contacts=contacts,
            platform_data={"provider": "linkedin", "profile": data},
            duration_ms=elapsed,
        )
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="completed",
            reachable=True,
            http_status=resp.status_code,
            title=title[:240],
            description=description or None,
            headings=[title[:200]],
            social_links=social_links,
            raw_preview=text_body[:1500] or None,
            summary=build_summary(title, description or None, [], social_links),
            duration_ms=elapsed,
            provider_used="linkedin_api",
            specialized_provider="linkedin",
            requires_api_key=True,
            api_key_configured=True,
            levels_scraped=1,
            pages_scraped=1,
            contacts=contacts,
            platform_data={"provider": "linkedin", "profile": data},
            pages=[page],
            config_used=req.config,
        )

    elements = data.get("elements") or ([data] if data.get("id") else [])
    if not elements:
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed",
            reachable=True,
            http_status=resp.status_code,
            error_reason=f"LinkedIn organization '{slug}' was not returned by API.",
            duration_ms=elapsed,
            provider_used="linkedin_api",
            specialized_provider="linkedin",
            requires_api_key=True,
            api_key_configured=True,
            config_used=req.config,
        )

    org = elements[0]
    org_id = org.get("id")
    org_name = (
        org.get("localizedName")
        or (org.get("name", {}).get("localized", {}).get("en_US") if isinstance(org.get("name"), dict) else None)
        or slug
    )
    description_raw = org.get("localizedDescription")
    if not description_raw and isinstance(org.get("description"), dict):
        localized_map = org["description"].get("localized") or {}
        description_raw = next(iter(localized_map.values()), "")
    description = clean_text(str(description_raw or ""))
    website_url = org.get("localizedWebsite") or org.get("websiteUrl")
    specialties = org.get("localizedSpecialties") or org.get("specialties") or []
    staff_range = org.get("staffCountRange")

    posts: list[dict[str, Any]] = []
    follower_stats: dict[str, Any] | None = None
    if req.config.levels >= 2 and org_id:
        org_urn = f"urn:li:organization:{org_id}"
        posts_resp = await client.get(
            "https://api.linkedin.com/rest/posts",
            headers=headers,
            params={
                "author": org_urn,
                "q": "author",
                "count": min(req.config.specialized_max_items, 20),
            },
            timeout=timeout,
        )
        if posts_resp.status_code == 200:
            posts = posts_resp.json().get("elements") or []

        stats_resp = await client.get(
            "https://api.linkedin.com/rest/organizationalEntityFollowerStatistics",
            headers=headers,
            params={"q": "organizationalEntity", "organizationalEntity": org_urn},
            timeout=timeout,
        )
        if stats_resp.status_code == 200:
            stat_els = stats_resp.json().get("elements") or []
            follower_stats = stat_els[0] if stat_els else None

    post_texts = [
        clean_text(p.get("commentary")) for p in posts if isinstance(p, dict) and p.get("commentary")
    ]
    explicit_urls = [str(website_url)] if website_url else []
    links, social_links = _extract_links_from_texts([description, *post_texts], explicit_urls)
    social_links.setdefault("linkedin", normalized_url)

    title = f"{org_name} — LinkedIn Organization"
    profile_lines = [
        f"Organization: {org_name}",
        f"Vanity Name: {org.get('vanityName', slug)}",
        f"Website: {website_url}" if website_url else "",
        f"Staff Range: {staff_range}" if staff_range else "",
        f"Specialties: {', '.join(map(str, specialties))}" if specialties else "",
        f"Description: {description}" if description else "",
    ]
    profile_text = "\n".join(line for line in profile_lines if line)
    combined_corpus = "\n".join([profile_text, *post_texts])
    signals = detect_signals(combined_corpus, social_links)
    contacts = (
        extract_contacts(combined_corpus, []) if req.config.extract_contacts else []
    )

    pages: list[ScrapedPageResult] = [
        ScrapedPageResult(
            url=normalized_url,
            canonical_url=normalized_url,
            depth=1,
            http_status=resp.status_code,
            content_type="application/json",
            render_mode="linkedin_api",
            title=title[:240],
            description=description[:500] or None,
            headings=[ScrapedHeading(level="h1", text=title[:200])],
            text_content=profile_text,
            word_count=len(profile_text.split()),
            links=links,
            social_links=social_links,
            contacts=contacts,
            signals=signals,
            platform_data={
                "provider": "linkedin",
                "organization": org,
                "followerStats": follower_stats,
            },
            duration_ms=elapsed,
        )
    ]

    if posts:
        posts_body = "\n\n".join(post_texts)
        pages.append(
            ScrapedPageResult(
                url=f"{normalized_url}#posts",
                canonical_url=normalized_url,
                parent_url=normalized_url,
                depth=2,
                http_status=200,
                content_type="application/json",
                render_mode="linkedin_api",
                title=f"LinkedIn Organization Posts ({len(posts)}) — {org_name}",
                description=f"Latest {len(posts)} LinkedIn posts fetched via LinkedIn REST API",
                headings=[ScrapedHeading(level="h2", text=f"Organization Posts ({len(posts)})")],
                text_content=posts_body[:30000] or None,
                word_count=len(posts_body.split()),
                links=links,
                social_links=social_links,
                contacts=contacts,
                signals=detect_signals(posts_body, social_links),
                platform_data={"provider": "linkedin", "posts": posts},
                duration_ms=elapsed,
            )
        )

    platform_data = {
        "provider": "linkedin",
        "organizationId": org_id,
        "name": org_name,
        "vanityName": org.get("vanityName", slug),
        "websiteUrl": website_url,
        "staffCountRange": staff_range,
        "specialties": specialties,
        "followerStats": follower_stats,
        "recentPostsCount": len(posts),
        "recentPosts": posts[:15],
    }

    levels_scraped = max((p.depth for p in pages), default=1)
    summary = build_summary(
        title,
        description[:400] or None,
        signals,
        social_links,
        pages_count=len(pages),
        levels_scraped=levels_scraped,
    )

    return ScrapeResponse(
        target_type=req.target_type,
        target_value=req.target_value,
        normalized_url=normalized_url,
        status="completed",
        reachable=True,
        http_status=resp.status_code,
        title=title[:240],
        description=description[:500] or None,
        headings=[title[:200], *(p[:120] for p in post_texts[:5])],
        social_links=social_links,
        signals=signals,
        raw_preview=combined_corpus[:1500] or None,
        summary=summary or None,
        duration_ms=int((time.perf_counter() - start_ms) * 1000),
        provider_used="linkedin_api",
        specialized_provider="linkedin",
        requires_api_key=True,
        api_key_configured=True,
        levels_scraped=levels_scraped,
        pages_scraped=len(pages),
        contacts=contacts,
        platform_data=platform_data,
        pages=pages,
        config_used=req.config,
    )


def _extract_telegram_chat_identifier(normalized_url: str, raw_value: str) -> tuple[str | None, bool]:
    parsed = urlparse(normalized_url)
    segments = [seg for seg in parsed.path.split("/") if seg]
    if segments and segments[0].startswith("+"):
        return None, True
    if len(segments) >= 2 and segments[0].lower() == "s":
        return f"@{segments[1].lstrip('@')}", False
    if segments:
        return f"@{segments[0].lstrip('@')}", False
    cleaned = raw_value.strip().lstrip("@").split("/")[0]
    return (f"@{cleaned}" if cleaned else None), False


async def _scrape_telegram_api(
    req: ScrapeRequest,
    normalized_url: str,
    api_key: str,
    client: httpx.AsyncClient,
    start_ms: float,
) -> ScrapeResponse:
    chat_ref, is_private_invite = _extract_telegram_chat_identifier(
        normalized_url, req.target_value
    )
    if is_private_invite or not chat_ref:
        elapsed = int((time.perf_counter() - start_ms) * 1000)
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed",
            reachable=False,
            error_reason=(
                "Telegram Bot API getChat requires a public @username or numeric chat_id; "
                "private invite links (+hash) cannot be queried directly via Bot API."
            ),
            duration_ms=elapsed,
            provider_used="telegram_bot_api",
            specialized_provider="telegram",
            requires_api_key=True,
            api_key_configured=True,
            config_used=req.config,
        )

    base = f"https://api.telegram.org/bot{api_key}"
    timeout = httpx.Timeout(req.config.timeout_seconds)
    chat_resp = await client.get(
        f"{base}/getChat", params={"chat_id": chat_ref}, timeout=timeout
    )

    elapsed = int((time.perf_counter() - start_ms) * 1000)
    if chat_resp.status_code >= 400:
        detail = clean_text(chat_resp.text)[:300]
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed" if chat_resp.status_code in (400, 401, 403, 404) else "unreachable",
            reachable=chat_resp.status_code != 401,
            http_status=chat_resp.status_code,
            error_reason=f"Telegram Bot API returned HTTP {chat_resp.status_code}: {detail}",
            summary=f"Telegram Bot API request failed with HTTP {chat_resp.status_code}.",
            duration_ms=elapsed,
            provider_used="telegram_bot_api",
            specialized_provider="telegram",
            requires_api_key=True,
            api_key_configured=True,
            config_used=req.config,
        )

    chat_body = chat_resp.json()
    if not chat_body.get("ok") or not chat_body.get("result"):
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="failed",
            reachable=True,
            http_status=chat_resp.status_code,
            error_reason=f"Telegram Bot API error: {chat_body.get('description', 'Unknown error')}",
            duration_ms=elapsed,
            provider_used="telegram_bot_api",
            specialized_provider="telegram",
            requires_api_key=True,
            api_key_configured=True,
            config_used=req.config,
        )

    chat = chat_body["result"]
    member_count: int | None = None
    count_resp = await client.get(
        f"{base}/getChatMemberCount", params={"chat_id": chat_ref}, timeout=timeout
    )
    if count_resp.status_code == 200 and count_resp.json().get("ok"):
        member_count = count_resp.json().get("result")

    pinned_msg = chat.get("pinned_message") or {}
    pinned_text = clean_text(pinned_msg.get("text") or pinned_msg.get("caption"))

    recent_messages: list[dict[str, Any]] = []
    if req.config.levels >= 2:
        updates_resp = await client.get(
            f"{base}/getUpdates",
            params={"limit": min(req.config.specialized_max_items, 100)},
            timeout=timeout,
        )
        if updates_resp.status_code == 200 and updates_resp.json().get("ok"):
            chat_id = chat.get("id")
            for upd in updates_resp.json().get("result") or []:
                msg = (
                    upd.get("channel_post")
                    or upd.get("message")
                    or upd.get("edited_channel_post")
                )
                if not isinstance(msg, dict):
                    continue
                if msg.get("chat", {}).get("id") == chat_id:
                    msg_text = clean_text(msg.get("text") or msg.get("caption"))
                    if msg_text:
                        recent_messages.append(
                            {
                                "messageId": msg.get("message_id"),
                                "date": msg.get("date"),
                                "text": msg_text,
                            }
                        )

    chat_title = clean_text(chat.get("title") or chat_ref)
    chat_type = chat.get("type") or "channel"
    description = clean_text(chat.get("description"))
    invite_link = chat.get("invite_link")

    msg_texts = [m["text"] for m in recent_messages]
    explicit_urls = [str(invite_link)] if invite_link else []
    links, social_links = _extract_links_from_texts(
        [description, pinned_text, *msg_texts], explicit_urls
    )
    social_links.setdefault("telegram", normalized_url)

    title = f"{chat_title} (Telegram {chat_type})"
    if isinstance(member_count, int):
        title = f"{title} · {member_count:,} members"

    profile_lines = [
        f"Title: {chat_title}",
        f"Username: @{chat.get('username', chat_ref.lstrip('@'))}",
        f"Type: {chat_type}",
        f"Members: {member_count:,}" if isinstance(member_count, int) else "",
        f"Description: {description}" if description else "",
        f"Pinned Message: {pinned_text}" if pinned_text else "",
    ]
    profile_text = "\n".join(line for line in profile_lines if line)
    combined_corpus = "\n".join([profile_text, *msg_texts])
    signals = detect_signals(combined_corpus, social_links)
    contacts = (
        extract_contacts(combined_corpus, []) if req.config.extract_contacts else []
    )

    pages: list[ScrapedPageResult] = [
        ScrapedPageResult(
            url=normalized_url,
            canonical_url=normalized_url,
            depth=1,
            http_status=chat_resp.status_code,
            content_type="application/json",
            render_mode="telegram_bot_api",
            title=title[:240],
            description=description[:500] or None,
            headings=[ScrapedHeading(level="h1", text=title[:200])],
            text_content=profile_text,
            word_count=len(profile_text.split()),
            links=links,
            social_links=social_links,
            contacts=contacts,
            signals=signals,
            platform_data={
                "provider": "telegram",
                "chat": chat,
                "memberCount": member_count,
            },
            duration_ms=elapsed,
        )
    ]

    if recent_messages:
        messages_body = "\n\n".join(msg_texts)
        pages.append(
            ScrapedPageResult(
                url=f"{normalized_url}#updates",
                canonical_url=normalized_url,
                parent_url=normalized_url,
                depth=2,
                http_status=200,
                content_type="application/json",
                render_mode="telegram_bot_api",
                title=f"Telegram Recent Messages ({len(recent_messages)}) — {chat_title}",
                description=f"Captured {len(recent_messages)} messages via Telegram Bot API",
                headings=[
                    ScrapedHeading(level="h2", text=f"Recent Messages ({len(recent_messages)})")
                ],
                text_content=messages_body[:30000] or None,
                word_count=len(messages_body.split()),
                links=links,
                social_links=social_links,
                contacts=contacts,
                signals=detect_signals(messages_body, social_links),
                platform_data={"provider": "telegram", "messages": recent_messages},
                duration_ms=elapsed,
            )
        )

    platform_data = {
        "provider": "telegram",
        "chatId": chat.get("id"),
        "title": chat_title,
        "username": chat.get("username"),
        "type": chat_type,
        "memberCount": member_count,
        "description": description,
        "pinnedMessage": pinned_text or None,
        "recentMessagesCount": len(recent_messages),
        "recentMessages": recent_messages[:20],
    }

    levels_scraped = max((p.depth for p in pages), default=1)
    summary = build_summary(
        title,
        description[:400] or pinned_text[:400] or None,
        signals,
        social_links,
        pages_count=len(pages),
        levels_scraped=levels_scraped,
    )

    return ScrapeResponse(
        target_type=req.target_type,
        target_value=req.target_value,
        normalized_url=normalized_url,
        status="completed",
        reachable=True,
        http_status=chat_resp.status_code,
        title=title[:240],
        description=description[:500] or None,
        headings=[title[:200], *(m[:120] for m in msg_texts[:5])],
        social_links=social_links,
        signals=signals,
        raw_preview=combined_corpus[:1500] or None,
        summary=summary or None,
        duration_ms=int((time.perf_counter() - start_ms) * 1000),
        provider_used="telegram_bot_api",
        specialized_provider="telegram",
        requires_api_key=True,
        api_key_configured=True,
        levels_scraped=levels_scraped,
        pages_scraped=len(pages),
        contacts=contacts,
        platform_data=platform_data,
        pages=pages,
        config_used=req.config,
    )


async def scrape_specialized_target(
    provider: SpecializedProvider,
    req: ScrapeRequest,
    normalized_url: str,
    settings: Settings,
    client: httpx.AsyncClient | None = None,
    start_ms: float | None = None,
) -> ScrapeResponse:
    started = start_ms if start_ms is not None else time.perf_counter()
    api_key = resolve_provider_api_key(provider, req, settings)
    if not api_key:
        return _missing_key_response(provider, req, normalized_url, started)

    owns_client = client is None
    active_client = client or httpx.AsyncClient(
        timeout=httpx.Timeout(req.config.timeout_seconds),
        follow_redirects=False,
    )
    try:
        if provider == "x":
            return await _scrape_x_api(req, normalized_url, api_key, active_client, started)
        if provider == "linkedin":
            return await _scrape_linkedin_api(req, normalized_url, api_key, active_client, started)
        return await _scrape_telegram_api(req, normalized_url, api_key, active_client, started)
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        elapsed = int((time.perf_counter() - started) * 1000)
        return ScrapeResponse(
            target_type=req.target_type,
            target_value=req.target_value,
            normalized_url=normalized_url,
            status="unreachable",
            reachable=False,
            error_reason=f"Network error calling {provider} API: {exc.__class__.__name__}",
            duration_ms=elapsed,
            provider_used=f"{provider}_api",
            specialized_provider=provider,
            requires_api_key=True,
            api_key_configured=True,
            config_used=req.config,
        )
    finally:
        if owns_client:
            await active_client.aclose()
