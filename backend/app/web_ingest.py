from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import httpx
import trafilatura

_MAX_BYTES = 20 * 1024 * 1024  # 20MB
_TIMEOUT = 20.0
_MAX_REDIRECTS = 3


class UnsafeUrlError(Exception):
    """Raised when a URL is refused for safety reasons (bad scheme, resolves to
    a private/internal address, too large, etc.) — never a real HTTP error."""


def _assert_safe_host(url: str) -> None:
    """SSRF guard: fetching a URL an LLM cited is fetching attacker-influenced
    input from the backend's own network position, so this must reject
    anything that could reach an internal service or a cloud metadata
    endpoint (e.g. 169.254.169.254), not just validate the scheme."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError(f"Unsupported scheme: {parsed.scheme!r}")
    hostname = parsed.hostname
    if not hostname:
        raise UnsafeUrlError("URL has no hostname")
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise UnsafeUrlError(f"Could not resolve host: {hostname}") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise UnsafeUrlError(f"Refusing to fetch a non-public address: {ip}")


def fetch_document(url: str) -> tuple[bytes, str, str]:
    """Downloads `url` with SSRF protections and returns (bytes, content_type,
    filename). Redirects are followed manually (never httpx's own
    follow_redirects, which wouldn't re-validate each hop) up to
    _MAX_REDIRECTS times, re-checking _assert_safe_host on every hop —
    otherwise a safe first URL could redirect straight to an internal address.
    Size is capped while streaming, not just checked via Content-Length
    (which a malicious/misconfigured server could lie about or omit).

    Raises UnsafeUrlError or an httpx exception — callers should catch broadly
    and skip that one source; one bad URL must never fail a whole ingestion
    run (see routers/materials.py)."""
    current_url = url
    for _ in range(_MAX_REDIRECTS + 1):
        _assert_safe_host(current_url)
        with httpx.stream("GET", current_url, timeout=_TIMEOUT, follow_redirects=False) as response:
            if response.is_redirect:
                location = response.headers.get("location")
                if not location:
                    raise UnsafeUrlError("Redirect with no Location header")
                current_url = urljoin(current_url, location)
                continue

            response.raise_for_status()
            content_type = response.headers.get("content-type", "").split(";")[0].strip()
            chunks: list[bytes] = []
            total = 0
            for chunk in response.iter_bytes():
                total += len(chunk)
                if total > _MAX_BYTES:
                    raise UnsafeUrlError(f"Response exceeded {_MAX_BYTES} bytes")
                chunks.append(chunk)
            filename = urlparse(current_url).path.rsplit("/", 1)[-1] or "document"
            return b"".join(chunks), content_type, filename

    raise UnsafeUrlError("Too many redirects")


def extract_readable_text(html: str) -> str:
    """Best-effort main-content extraction from an HTML page (e.g. a syllabus
    published as a web page rather than a PDF) — used only when
    fetch_document's content_type is text/html. Raises ValueError if nothing
    extractable, same failure contract as parsing.py's file-based paths."""
    text = trafilatura.extract(html)
    if not text or not text.strip():
        raise ValueError("Could not extract readable text from this page")
    return text
