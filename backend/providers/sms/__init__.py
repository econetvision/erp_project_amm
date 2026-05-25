"""SMS provider adapters."""
from providers.base import SmsProvider, ProviderResult
from providers.registry import register_provider


@register_provider
class TwilioSmsProvider(SmsProvider):
    CODE = "twilio_sms"
    NAME = "Twilio SMS"

    def _client(self):
        from twilio.rest import Client
        return Client(self.credentials["account_sid"], self.credentials["auth_token"])

    def send_sms(self, to: str, message: str, **kwargs) -> ProviderResult:
        def _send():
            msg = self._client().messages.create(
                body=message,
                from_=self.credentials.get("from_number", ""),
                to=to,
            )
            return {"sid": msg.sid, "status": msg.status, "to": to}
        return self._timed(_send)

    def send_otp(self, to: str, **kwargs) -> ProviderResult:
        def _send():
            v = self._client().verify.v2.services(
                self.credentials["verify_service_sid"]
            ).verifications.create(to=to, channel="sms")
            return {"status": v.status, "to": to}
        return self._timed(_send)

    def test_connection(self) -> ProviderResult:
        def _test():
            acct = self._client().api.accounts(self.credentials["account_sid"]).fetch()
            return {"account_name": acct.friendly_name, "status": acct.status}
        return self._timed(_test)


@register_provider
class Msg91SmsProvider(SmsProvider):
    CODE = "msg91_sms"
    NAME = "MSG91"

    def send_sms(self, to: str, message: str, **kwargs) -> ProviderResult:
        import httpx
        def _send():
            resp = httpx.post(
                "https://control.msg91.com/api/v5/flow/",
                headers={"authkey": self.credentials["auth_key"], "Content-Type": "application/json"},
                json={
                    "template_id": self.config.get("template_id", ""),
                    "recipients": [{"mobiles": to, "message": message}],
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_send)

    def send_otp(self, to: str, **kwargs) -> ProviderResult:
        import httpx
        def _send():
            resp = httpx.post(
                "https://control.msg91.com/api/v5/otp",
                headers={"authkey": self.credentials["auth_key"]},
                json={"mobile": to, "template_id": self.config.get("otp_template_id", "")},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_send)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.get(
                "https://control.msg91.com/api/v5/report",
                headers={"authkey": self.credentials["auth_key"]},
                timeout=10,
            )
            return {"status_code": resp.status_code}
        return self._timed(_test)


@register_provider
class AwsSnsSmsProvider(SmsProvider):
    CODE = "aws_sns_sms"
    NAME = "AWS SNS"

    def _client(self):
        import boto3
        return boto3.client(
            "sns",
            aws_access_key_id=self.credentials.get("access_key_id"),
            aws_secret_access_key=self.credentials.get("secret_access_key"),
            region_name=self.credentials.get("region", "ap-south-1"),
        )

    def send_sms(self, to: str, message: str, **kwargs) -> ProviderResult:
        def _send():
            resp = self._client().publish(PhoneNumber=to, Message=message)
            return {"message_id": resp["MessageId"]}
        return self._timed(_send)

    def send_otp(self, to: str, **kwargs) -> ProviderResult:
        import secrets
        otp = secrets.token_hex(3)[:6]
        return self.send_sms(to, f"Your OTP is {otp}")

    def test_connection(self) -> ProviderResult:
        def _test():
            self._client().get_sms_attributes()
            return {"status": "ok"}
        return self._timed(_test)


@register_provider
class TextLocalSmsProvider(SmsProvider):
    CODE = "textlocal_sms"
    NAME = "TextLocal"

    def send_sms(self, to: str, message: str, **kwargs) -> ProviderResult:
        import httpx
        def _send():
            resp = httpx.post(
                "https://api.textlocal.in/send/",
                data={
                    "apikey": self.credentials["api_key"],
                    "numbers": to,
                    "message": message,
                    "sender": self.config.get("sender", "ERPSMS"),
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_send)

    def send_otp(self, to: str, **kwargs) -> ProviderResult:
        import secrets
        otp = secrets.token_hex(3)[:6]
        return self.send_sms(to, f"Your OTP is {otp}")

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.post(
                "https://api.textlocal.in/balance/",
                data={"apikey": self.credentials["api_key"]},
                timeout=10,
            )
            return resp.json()
        return self._timed(_test)


@register_provider
class VonageSmsProvider(SmsProvider):
    CODE = "vonage_sms"
    NAME = "Vonage / Nexmo"

    def send_sms(self, to: str, message: str, **kwargs) -> ProviderResult:
        import httpx
        def _send():
            resp = httpx.post(
                "https://rest.nexmo.com/sms/json",
                json={
                    "api_key": self.credentials["api_key"],
                    "api_secret": self.credentials["api_secret"],
                    "to": to,
                    "from": self.config.get("from_name", "ERP"),
                    "text": message,
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_send)

    def send_otp(self, to: str, **kwargs) -> ProviderResult:
        import secrets
        otp = secrets.token_hex(3)[:6]
        return self.send_sms(to, f"Your OTP is {otp}")

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.get(
                "https://rest.nexmo.com/account/get-balance",
                params={"api_key": self.credentials["api_key"], "api_secret": self.credentials["api_secret"]},
                timeout=10,
            )
            return resp.json()
        return self._timed(_test)
