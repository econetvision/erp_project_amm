"""Email provider adapters."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from providers.base import EmailProvider, ProviderResult
from providers.registry import register_provider


@register_provider
class SmtpEmailProvider(EmailProvider):
    CODE = "smtp_email"
    NAME = "SMTP"

    def send_email(self, to: list[str], subject: str, html_body: str, **kwargs) -> ProviderResult:
        def _send():
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.credentials.get("from_email", self.credentials.get("username", ""))
            msg["To"] = ", ".join(to)
            msg.attach(MIMEText(html_body, "html"))

            host = self.credentials["host"]
            port = int(self.credentials.get("port", 587))
            use_tls = str(self.credentials.get("use_tls", "true")).lower() == "true"

            with smtplib.SMTP(host, port) as server:
                if use_tls:
                    server.starttls()
                user = self.credentials.get("username")
                pwd = self.credentials.get("password")
                if user and pwd:
                    server.login(user, pwd)
                server.sendmail(msg["From"], to, msg.as_string())
            return {"sent_to": to, "subject": subject}
        return self._timed(_send)

    def test_connection(self) -> ProviderResult:
        def _test():
            host = self.credentials["host"]
            port = int(self.credentials.get("port", 587))
            use_tls = str(self.credentials.get("use_tls", "true")).lower() == "true"
            with smtplib.SMTP(host, port, timeout=10) as server:
                if use_tls:
                    server.starttls()
                user = self.credentials.get("username")
                pwd = self.credentials.get("password")
                if user and pwd:
                    server.login(user, pwd)
            return {"status": "connected"}
        return self._timed(_test)


@register_provider
class SendGridEmailProvider(EmailProvider):
    CODE = "sendgrid_email"
    NAME = "Twilio SendGrid"

    def send_email(self, to: list[str], subject: str, html_body: str, **kwargs) -> ProviderResult:
        import httpx
        def _send():
            resp = httpx.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {self.credentials['api_key']}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": e} for e in to]}],
                    "from": {"email": self.credentials.get("from_email", "noreply@erp.com")},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_body}],
                },
                timeout=15,
            )
            resp.raise_for_status()
            return {"status_code": resp.status_code, "sent_to": to}
        return self._timed(_send)

    def send_template(self, to: list[str], template_id: str, variables: dict, **kwargs) -> ProviderResult:
        import httpx
        def _send():
            resp = httpx.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {self.credentials['api_key']}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": e} for e in to], "dynamic_template_data": variables}],
                    "from": {"email": self.credentials.get("from_email", "noreply@erp.com")},
                    "template_id": template_id,
                },
                timeout=15,
            )
            resp.raise_for_status()
            return {"status_code": resp.status_code}
        return self._timed(_send)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.get(
                "https://api.sendgrid.com/v3/scopes",
                headers={"Authorization": f"Bearer {self.credentials['api_key']}"},
                timeout=10,
            )
            resp.raise_for_status()
            return {"status": "ok", "scopes_count": len(resp.json().get("scopes", []))}
        return self._timed(_test)


@register_provider
class AwsSesEmailProvider(EmailProvider):
    CODE = "aws_ses_email"
    NAME = "AWS SES"

    def _client(self):
        import boto3
        return boto3.client(
            "ses",
            aws_access_key_id=self.credentials.get("access_key_id"),
            aws_secret_access_key=self.credentials.get("secret_access_key"),
            region_name=self.credentials.get("region", "ap-south-1"),
        )

    def send_email(self, to: list[str], subject: str, html_body: str, **kwargs) -> ProviderResult:
        def _send():
            resp = self._client().send_email(
                Source=self.credentials.get("from_email", "noreply@erp.com"),
                Destination={"ToAddresses": to},
                Message={
                    "Subject": {"Data": subject},
                    "Body": {"Html": {"Data": html_body}},
                },
            )
            return {"message_id": resp["MessageId"]}
        return self._timed(_send)

    def test_connection(self) -> ProviderResult:
        def _test():
            resp = self._client().get_send_quota()
            return {"max_24h": resp["Max24HourSend"], "sent_last_24h": resp["SentLast24Hours"]}
        return self._timed(_test)


@register_provider
class MailgunEmailProvider(EmailProvider):
    CODE = "mailgun_email"
    NAME = "Mailgun"

    def send_email(self, to: list[str], subject: str, html_body: str, **kwargs) -> ProviderResult:
        import httpx
        def _send():
            domain = self.credentials["domain"]
            resp = httpx.post(
                f"https://api.mailgun.net/v3/{domain}/messages",
                auth=("api", self.credentials["api_key"]),
                data={
                    "from": self.credentials.get("from_email", f"noreply@{domain}"),
                    "to": to,
                    "subject": subject,
                    "html": html_body,
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_send)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            domain = self.credentials["domain"]
            resp = httpx.get(
                f"https://api.mailgun.net/v3/{domain}",
                auth=("api", self.credentials["api_key"]),
                timeout=10,
            )
            resp.raise_for_status()
            return {"domain": domain, "state": resp.json().get("domain", {}).get("state")}
        return self._timed(_test)
