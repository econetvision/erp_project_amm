"""OTP / verification provider adapters."""
from providers.base import OtpProvider, ProviderResult
from providers.registry import register_provider


@register_provider
class TwilioVerifyProvider(OtpProvider):
    """Twilio Verify — phone (SMS) and email OTP verification."""

    CODE = "twilio_verify"
    NAME = "Twilio Verify"

    def _client(self):
        from twilio.rest import Client
        return Client(self.credentials["account_sid"], self.credentials["auth_token"])

    def _service_sid(self) -> str:
        return self.credentials["verify_service_sid"]

    def send_otp(self, to: str, channel: str = "sms", **kwargs) -> ProviderResult:
        def _send():
            v = self._client().verify.v2.services(self._service_sid()).verifications.create(
                to=to, channel=channel,
            )
            return {"status": v.status, "to": to}
        return self._timed(_send)

    def verify_otp(self, to: str, code: str, **kwargs) -> ProviderResult:
        def _check():
            check = self._client().verify.v2.services(self._service_sid()).verification_checks.create(
                to=to, code=code,
            )
            return {"status": check.status, "valid": check.status == "approved"}
        return self._timed(_check)

    def test_connection(self) -> ProviderResult:
        def _test():
            svc = self._client().verify.v2.services(self._service_sid()).fetch()
            return {"service_name": svc.friendly_name}
        return self._timed(_test)
