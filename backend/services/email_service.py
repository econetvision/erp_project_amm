import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)


def get_smtp_config() -> dict | None:
    host = os.environ.get("SMTP_HOST")
    if not host:
        return None
    return {
        "host": host,
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", ""),
        "password": os.environ.get("SMTP_PASS", ""),
        "from_email": os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "")),
        "use_tls": os.environ.get("SMTP_USE_TLS", "true").lower() == "true",
    }


def send_email(to: list[str], subject: str, html_body: str) -> bool:
    config = get_smtp_config()
    if not config:
        logger.warning("SMTP not configured — skipping email")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config["from_email"]
        msg["To"] = ", ".join(to)
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(config["host"], config["port"]) as server:
            if config["use_tls"]:
                server.starttls()
            if config["user"] and config["password"]:
                server.login(config["user"], config["password"])
            server.sendmail(config["from_email"], to, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False
