"""Centralized application configuration.

Single source of truth for every environment-driven setting. Import the shared
``settings`` singleton anywhere instead of calling ``os.getenv`` directly::

    from config.settings import settings
    engine = create_engine(settings.database_url)

Field names map to UPPER_SNAKE_CASE env vars automatically (case-insensitive),
so ``database_url`` reads ``DATABASE_URL``. Values are also loaded from a local
``.env`` file when present.
"""
from functools import cached_property

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Core ────────────────────────────────────────────────────────────────
    database_url: str = "postgresql://erp_user:erp_pass@localhost:5432/erp_db"
    secret_key: str = "erp-secret-key-change-in-production"
    allowed_origins: str = "http://localhost:3000"
    log_level: str = "INFO"
    seed_test_data: bool = False

    # ─── Build / version metadata ────────────────────────────────────────────
    app_version: str = ""
    build_sha: str = "dev"
    build_time: str = "unknown"

    # ─── Fleet tracking gateway ──────────────────────────────────────────────
    tracking_gateway_key: str = ""
    location_retention_days: int = 90

    # ─── KYC provider ────────────────────────────────────────────────────────
    kyc_provider: str = "manual"
    kyc_api_key: str = ""
    kyc_api_secret: str = ""

    # ─── Email (SMTP) ────────────────────────────────────────────────────────
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True

    # ─── Twilio (phone/email verification) ───────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_verify_service_sid: str = ""

    # ─── Licensing ───────────────────────────────────────────────────────────
    # LICENSE_KEY is the static master license (injected from a CI/deploy secret).
    # When set, the backend treats every company as licensed and does NOT call the
    # external license server — a fully offline bypass for our own deployments.
    license_key: str = ""
    # Base URL of the external license server that issues/validates licenses.
    license_server_url: str = ""
    # Base path of the license server's public client API (validate/activate/…).
    license_api_base: str = "/api/v1"
    # Product identifier reported to the license server.
    license_product: str = "erp"
    # Master switch: when False, license enforcement is skipped entirely.
    license_enforce: bool = True
    # When True, device/location/browser telemetry is sent with verification.
    license_telemetry_enabled: bool = True
    # Timeout (seconds) for calls to the external license server.
    license_timeout_seconds: float = 5.0
    # Stable identifier for this ERP instance (falls back to a derived value).
    instance_id: str = Field(default="")

    # ─── Derived helpers ─────────────────────────────────────────────────────
    @cached_property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def effective_smtp_from(self) -> str:
        return self.smtp_from or self.smtp_user

    @property
    def has_static_license(self) -> bool:
        """True when a static master license key is configured (bypass mode)."""
        return bool(self.license_key.strip())


# Import this singleton everywhere; instantiated once at import time.
settings = Settings()
