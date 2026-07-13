"""Twilio verification service for phone (SMS) and email verification.

Credential resolution order:
  1. Integration system — the ``otp`` category provider configured per company
     (or the global default) via the Provider Management UI. Credentials are
     stored encrypted in the DB (see providers/registry.resolve_provider).
  2. Environment settings — TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
     TWILIO_VERIFY_SERVICE_SID, kept as a fallback for existing deployments.

Callers should pass ``db`` and ``company_id`` so per-company keys apply; when
omitted, only the env fallback is used (legacy behaviour).
"""
from typing import Optional

from sqlalchemy.orm import Session
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from config.settings import settings


def _resolve_otp_provider(db: Optional[Session], company_id: Optional[int]):
    """Return the configured OTP adapter from the integration system, if any."""
    if db is None:
        return None
    try:
        import providers.otp  # noqa: F401 — ensure adapter is registered
        from providers.registry import resolve_provider
        adapter = resolve_provider("otp", company_id, db)
        # Only usable if the required credentials were actually configured.
        if adapter and adapter.credentials.get("account_sid") and adapter.credentials.get("auth_token"):
            return adapter
    except Exception:
        pass
    return None


def _get_client() -> Client:
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise RuntimeError(
            "Twilio credentials not configured. Add a Twilio Verify provider under "
            "Integrations → OTP, or set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
        )
    return Client(settings.twilio_account_sid, settings.twilio_auth_token)


def _get_verify_service_sid() -> str:
    if not settings.twilio_verify_service_sid:
        raise RuntimeError("TWILIO_VERIFY_SERVICE_SID is not configured.")
    return settings.twilio_verify_service_sid


def _send_otp(to: str, channel: str, db: Optional[Session], company_id: Optional[int]) -> dict:
    adapter = _resolve_otp_provider(db, company_id)
    if adapter:
        result = adapter.send_otp(to, channel=channel)
        if result.success:
            return {"status": result.data.get("status", "pending"), "to": to}
        return {"status": "error", "message": result.error}

    client = _get_client()
    service_sid = _get_verify_service_sid()
    try:
        verification = client.verify.v2.services(service_sid).verifications.create(
            to=to,
            channel=channel,
        )
        return {"status": verification.status, "to": to}
    except TwilioRestException as e:
        return {"status": "error", "message": str(e)}


def _verify_otp(to: str, code: str, db: Optional[Session], company_id: Optional[int]) -> dict:
    adapter = _resolve_otp_provider(db, company_id)
    if adapter:
        result = adapter.verify_otp(to, code)
        if result.success:
            return {
                "status": result.data.get("status", "unknown"),
                "valid": bool(result.data.get("valid")),
            }
        return {"status": "error", "valid": False, "message": result.error}

    client = _get_client()
    service_sid = _get_verify_service_sid()
    try:
        check = client.verify.v2.services(service_sid).verification_checks.create(
            to=to,
            code=code,
        )
        return {"status": check.status, "valid": check.status == "approved"}
    except TwilioRestException as e:
        return {"status": "error", "valid": False, "message": str(e)}


def send_phone_otp(phone_number: str, db: Optional[Session] = None, company_id: Optional[int] = None) -> dict:
    """Send OTP to a phone number via the configured OTP provider."""
    return _send_otp(phone_number, "sms", db, company_id)


def verify_phone_otp(phone_number: str, code: str, db: Optional[Session] = None, company_id: Optional[int] = None) -> dict:
    """Verify the OTP code for a phone number."""
    return _verify_otp(phone_number, code, db, company_id)


def send_email_otp(email: str, db: Optional[Session] = None, company_id: Optional[int] = None) -> dict:
    """Send OTP to an email address via the configured OTP provider."""
    return _send_otp(email, "email", db, company_id)


def verify_email_otp(email: str, code: str, db: Optional[Session] = None, company_id: Optional[int] = None) -> dict:
    """Verify the OTP code for an email address."""
    return _verify_otp(email, code, db, company_id)
