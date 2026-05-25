"""
Base provider interface & common types.
Every provider adapter inherits from BaseProvider.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
import time


@dataclass
class ProviderResult:
    """Standardised result from any provider call."""
    success: bool
    data: dict = field(default_factory=dict)
    error: Optional[str] = None
    latency_ms: int = 0
    provider_code: str = ""
    raw_response: Any = None


class BaseProvider(ABC):
    """Abstract base for all provider adapters."""

    CATEGORY: str = ""       # sms | email | maps | kyc | bank | ...
    CODE: str = ""           # unique code matching integration_providers.code
    NAME: str = ""

    def __init__(self, credentials: dict, config: dict | None = None):
        self.credentials = credentials or {}
        self.config = config or {}

    # ── Common helpers ────────────────────────────────────────────────
    def _timed(self, fn, *args, **kwargs) -> ProviderResult:
        """Execute fn, capture timing & errors, return ProviderResult."""
        start = time.perf_counter()
        try:
            data = fn(*args, **kwargs)
            elapsed = int((time.perf_counter() - start) * 1000)
            return ProviderResult(
                success=True,
                data=data if isinstance(data, dict) else {"result": data},
                latency_ms=elapsed,
                provider_code=self.CODE,
            )
        except Exception as exc:
            elapsed = int((time.perf_counter() - start) * 1000)
            return ProviderResult(
                success=False,
                error=str(exc),
                latency_ms=elapsed,
                provider_code=self.CODE,
            )

    @abstractmethod
    def test_connection(self) -> ProviderResult:
        """Validate credentials / connectivity."""
        ...


# ── Category-specific abstract interfaces ─────────────────────────────

class SmsProvider(BaseProvider):
    CATEGORY = "sms"

    @abstractmethod
    def send_sms(self, to: str, message: str, **kwargs) -> ProviderResult: ...

    @abstractmethod
    def send_otp(self, to: str, **kwargs) -> ProviderResult: ...

    def send_bulk(self, recipients: list[str], message: str, **kwargs) -> list[ProviderResult]:
        return [self.send_sms(r, message, **kwargs) for r in recipients]


class EmailProvider(BaseProvider):
    CATEGORY = "email"

    @abstractmethod
    def send_email(self, to: list[str], subject: str, html_body: str, **kwargs) -> ProviderResult: ...

    def send_template(self, to: list[str], template_id: str, variables: dict, **kwargs) -> ProviderResult:
        raise NotImplementedError("Template sending not supported by this provider")


class MapsProvider(BaseProvider):
    CATEGORY = "maps"

    @abstractmethod
    def geocode(self, address: str) -> ProviderResult: ...

    @abstractmethod
    def reverse_geocode(self, lat: float, lng: float) -> ProviderResult: ...

    def distance(self, origin: tuple, destination: tuple) -> ProviderResult:
        raise NotImplementedError

    def autocomplete(self, query: str) -> ProviderResult:
        raise NotImplementedError


class KycProvider(BaseProvider):
    CATEGORY = "kyc"

    @abstractmethod
    def verify_aadhaar(self, aadhaar_number: str, **kwargs) -> ProviderResult: ...

    @abstractmethod
    def verify_pan(self, pan_number: str, **kwargs) -> ProviderResult: ...

    def verify_gst(self, gst_number: str, **kwargs) -> ProviderResult:
        raise NotImplementedError

    def verify_face(self, image_base64: str, **kwargs) -> ProviderResult:
        raise NotImplementedError


class BankProvider(BaseProvider):
    CATEGORY = "bank"

    @abstractmethod
    def verify_account(self, account_number: str, ifsc: str, **kwargs) -> ProviderResult: ...

    def verify_upi(self, upi_id: str, **kwargs) -> ProviderResult:
        raise NotImplementedError

    def validate_ifsc(self, ifsc: str) -> ProviderResult:
        raise NotImplementedError
