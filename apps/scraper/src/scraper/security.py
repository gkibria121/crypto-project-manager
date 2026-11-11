import hmac
import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import Header, HTTPException, status

from scraper.config import get_settings

BLOCKED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
}


class UnsafeTargetError(ValueError):
    """Raised when a target URL violates SSRF safety rules."""


def _is_disallowed_ip(ip_str: str) -> bool:
    ip = ipaddress.ip_address(ip_str)
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_public_url(url: str, *, allow_private_networks: bool = False) -> None:
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise UnsafeTargetError(f"Unsupported URL scheme: {parsed.scheme or 'none'}")

    if not parsed.hostname:
        raise UnsafeTargetError("URL is missing a valid hostname")

    if parsed.username or parsed.password:
        raise UnsafeTargetError("Credentials in URLs are not allowed")

    hostname = parsed.hostname.lower().rstrip(".")

    if allow_private_networks:
        return

    if (
        hostname in BLOCKED_HOSTNAMES
        or hostname.endswith(".local")
        or hostname.endswith(".internal")
    ):
        raise UnsafeTargetError(f"Access to internal host '{hostname}' is blocked")

    # Direct IP literal check
    try:
        if _is_disallowed_ip(hostname):
            raise UnsafeTargetError(f"Access to private/reserved IP '{hostname}' is blocked")
        return
    except ValueError:
        pass

    # DNS resolution check (if DNS succeeds, block any private/loopback target)
    try:
        addr_infos = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        # Let HTTP fetcher handle unresolvable domains cleanly as `unreachable`
        return

    for info in addr_infos:
        resolved_ip = info[4][0]
        if _is_disallowed_ip(resolved_ip):
            raise UnsafeTargetError(
                f"Hostname '{hostname}' resolves to restricted IP '{resolved_ip}'"
            )


async def verify_internal_api_key(
    x_internal_service_key: str | None = Header(default=None),
) -> None:
    settings = get_settings()
    expected = settings.scraper_api_key.strip()
    if not expected:
        return

    if not x_internal_service_key or not hmac.compare_digest(
        x_internal_service_key, expected
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal service key",
        )
