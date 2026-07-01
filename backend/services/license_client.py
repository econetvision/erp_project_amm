"""Client for the external license server's public API (``/api/v1``).

Contract (auth = licenseKey in the body):

    POST {base}/validate    {licenseKey}                              -> status, no seat
    POST {base}/activate    {licenseKey, deviceId, hostname?, platform?}  idempotent per device
    POST {base}/heartbeat   {licenseKey, deviceId}                    keep seat alive (<30 min)
    POST {base}/deactivate  {licenseKey, deviceId}                    release seat
    GET  {base}/public-key                                            PEM for offline verify

The ``base`` is ``settings.license_server_url + settings.license_api_base``.

This client is only used when license enforcement is NOT bypassed — a configured
static ``LICENSE_KEY`` (or ``LICENSE_ENFORCE=false``) makes the backend skip the
server entirely (see ``license_service.license_bypass_active``).

Device / OS / browser info is carried in the contract's ``hostname`` and ``platform``
fields; web and mobile clients can pass their own ``platform`` descriptor
(e.g. ``"web:Chrome/120"``, ``"android:Pixel7/Android14"``) so the license server
can track where a seat is being consumed.
"""
import hashlib
import logging
import platform as _platform
import socket
import uuid

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)


class LicenseServerError(RuntimeError):
    """Raised when the license server is unreachable or returns an error status."""


def is_configured() -> bool:
    """True when an external license server URL is set."""
    return bool(settings.license_server_url.strip())


def _base_url() -> str:
    root = settings.license_server_url.rstrip("/")
    base = settings.license_api_base.strip("/")
    return f"{root}/{base}" if base else root


def current_hostname() -> str:
    """Best-effort host name of this ERP instance."""
    try:
        return socket.gethostname()
    except Exception:
        return "unknown-host"


def current_device_id() -> str:
    """Stable per-instance device id.

    Prefers an explicit ``INSTANCE_ID``; otherwise derives a deterministic id from
    the host name + MAC so the same instance keeps the same seat across restarts.
    """
    if settings.instance_id.strip():
        return settings.instance_id.strip()
    seed = f"{current_hostname()}:{uuid.getnode()}"
    return hashlib.sha256(seed.encode()).hexdigest()[:32]


def current_platform() -> str:
    """Descriptor for this backend instance, reported as the contract ``platform``."""
    version = settings.app_version or "dev"
    return f"{settings.license_product}-backend/{version} ({_platform.platform()})"


def _post(path: str, payload: dict) -> dict:
    url = f"{_base_url()}/{path.lstrip('/')}"
    try:
        with httpx.Client(timeout=settings.license_timeout_seconds) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json() if resp.content else {}
    except httpx.HTTPStatusError as e:
        body = e.response.text[:500] if e.response is not None else ""
        logger.warning("License server %s -> %s: %s", url, e.response.status_code, body)
        raise LicenseServerError(f"License server returned {e.response.status_code}") from e
    except httpx.HTTPError as e:
        logger.warning("License server %s unreachable: %s", url, e)
        raise LicenseServerError(str(e)) from e


# ── Public API ───────────────────────────────────────────────────────────────
def validate(license_key: str) -> dict:
    """POST /validate — check a license's status without consuming a seat."""
    return _post("validate", {"licenseKey": license_key})


def activate(
    license_key: str,
    device_id: str | None = None,
    hostname: str | None = None,
    platform: str | None = None,
) -> dict:
    """POST /activate — claim a seat for this device (idempotent per device)."""
    return _post("activate", {
        "licenseKey": license_key,
        "deviceId": device_id or current_device_id(),
        "hostname": hostname or current_hostname(),
        "platform": platform or current_platform(),
    })


def heartbeat(license_key: str, device_id: str | None = None) -> dict:
    """POST /heartbeat — keep this device's seat alive (call at least every 30 min)."""
    return _post("heartbeat", {
        "licenseKey": license_key,
        "deviceId": device_id or current_device_id(),
    })


def deactivate(license_key: str, device_id: str | None = None) -> dict:
    """POST /deactivate — release this device's seat."""
    return _post("deactivate", {
        "licenseKey": license_key,
        "deviceId": device_id or current_device_id(),
    })


def get_public_key() -> str:
    """GET /public-key — PEM public key for offline signature verification."""
    url = f"{_base_url()}/public-key"
    try:
        with httpx.Client(timeout=settings.license_timeout_seconds) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.text
    except httpx.HTTPError as e:
        logger.warning("License server %s unreachable: %s", url, e)
        raise LicenseServerError(str(e)) from e
