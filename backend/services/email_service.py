import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

from config.settings import settings

logger = logging.getLogger(__name__)


def get_smtp_config() -> dict | None:
    if not settings.smtp_host:
        return None
    return {
        "host": settings.smtp_host,
        "port": settings.smtp_port,
        "user": settings.smtp_user,
        "password": settings.smtp_pass,
        "from_email": settings.effective_smtp_from,
        "use_tls": settings.smtp_use_tls,
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
