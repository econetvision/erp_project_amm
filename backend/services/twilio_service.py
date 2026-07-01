"""Twilio verification service for phone (SMS) and email verification."""

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from config.settings import settings

TWILIO_ACCOUNT_SID = settings.twilio_account_sid
TWILIO_AUTH_TOKEN = settings.twilio_auth_token
TWILIO_VERIFY_SERVICE_SID = settings.twilio_verify_service_sid


def _get_client() -> Client:
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        raise RuntimeError("Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.")
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def _get_verify_service_sid() -> str:
    if not TWILIO_VERIFY_SERVICE_SID:
        raise RuntimeError("TWILIO_VERIFY_SERVICE_SID is not configured.")
    return TWILIO_VERIFY_SERVICE_SID


def send_phone_otp(phone_number: str) -> dict:
    """Send OTP to a phone number via Twilio Verify."""
    client = _get_client()
    service_sid = _get_verify_service_sid()
    try:
        verification = client.verify.v2.services(service_sid).verifications.create(
            to=phone_number,
            channel="sms",
        )
        return {"status": verification.status, "to": phone_number}
    except TwilioRestException as e:
        return {"status": "error", "message": str(e)}


def verify_phone_otp(phone_number: str, code: str) -> dict:
    """Verify the OTP code for a phone number."""
    client = _get_client()
    service_sid = _get_verify_service_sid()
    try:
        check = client.verify.v2.services(service_sid).verification_checks.create(
            to=phone_number,
            code=code,
        )
        return {"status": check.status, "valid": check.status == "approved"}
    except TwilioRestException as e:
        return {"status": "error", "valid": False, "message": str(e)}


def send_email_otp(email: str) -> dict:
    """Send OTP to an email address via Twilio Verify."""
    client = _get_client()
    service_sid = _get_verify_service_sid()
    try:
        verification = client.verify.v2.services(service_sid).verifications.create(
            to=email,
            channel="email",
        )
        return {"status": verification.status, "to": email}
    except TwilioRestException as e:
        return {"status": "error", "message": str(e)}


def verify_email_otp(email: str, code: str) -> dict:
    """Verify the OTP code for an email address."""
    client = _get_client()
    service_sid = _get_verify_service_sid()
    try:
        check = client.verify.v2.services(service_sid).verification_checks.create(
            to=email,
            code=code,
        )
        return {"status": check.status, "valid": check.status == "approved"}
    except TwilioRestException as e:
        return {"status": "error", "valid": False, "message": str(e)}
