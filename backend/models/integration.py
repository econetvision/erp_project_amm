from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text,
    UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


class IntegrationProvider(Base):
    """
    Master catalogue of supported providers.
    Rows are system-managed; MASTER can add new ones.
    """
    __tablename__ = "integration_providers"

    id           = Column(Integer, primary_key=True, index=True)
    category     = Column(String(50), nullable=False)          # sms | email | maps | kyc | bank | notification | otp | geolocation
    code         = Column(String(100), nullable=False, unique=True)  # e.g. "twilio_sms", "sendgrid_email"
    name         = Column(String(255), nullable=False)         # Human label
    description  = Column(Text, nullable=True)
    logo_url     = Column(String(500), nullable=True)
    # JSON schema describing which config keys the provider requires
    config_schema = Column(JSONB, nullable=True)
    # e.g. {"account_sid": {"type": "string", "required": true, "secret": true}, ...}
    is_active    = Column(Boolean, nullable=False, default=True)
    version      = Column(String(20), nullable=True, default="1.0")
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CompanyIntegration(Base):
    """
    Per-company provider assignment for each category.
    Links a company to a provider with company-specific credentials/config.
    """
    __tablename__ = "company_integrations"

    id             = Column(Integer, primary_key=True, index=True)
    company_id     = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    provider_id    = Column(Integer, ForeignKey("integration_providers.id", ondelete="CASCADE"), nullable=False)
    category       = Column(String(50), nullable=False)
    is_enabled     = Column(Boolean, nullable=False, default=True)
    is_default     = Column(Boolean, nullable=False, default=False)   # default provider for this category
    priority       = Column(Integer, nullable=False, default=0)       # lower = higher priority for fallback
    is_fallback    = Column(Boolean, nullable=False, default=False)
    # Encrypted credentials stored as JSONB (values are Fernet-encrypted strings)
    credentials    = Column(JSONB, nullable=True)
    # Provider-specific config (non-secret settings)
    config         = Column(JSONB, nullable=True)
    # Quota / rate limit
    daily_quota    = Column(Integer, nullable=True)
    monthly_quota  = Column(Integer, nullable=True)
    rate_limit_per_min = Column(Integer, nullable=True)
    # Health
    last_health_check = Column(DateTime(timezone=True), nullable=True)
    health_status     = Column(String(20), nullable=True, default="unknown")  # healthy | degraded | down | unknown
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("company_id", "provider_id", name="uq_company_provider"),
        Index("ix_ci_company_category", "company_id", "category"),
    )


class GlobalIntegrationDefault(Base):
    """
    System-wide default provider for each category (used when company has no override).
    MASTER-managed.
    """
    __tablename__ = "global_integration_defaults"

    id          = Column(Integer, primary_key=True, index=True)
    category    = Column(String(50), nullable=False, unique=True)
    provider_id = Column(Integer, ForeignKey("integration_providers.id", ondelete="SET NULL"), nullable=True)
    fallback_provider_id = Column(Integer, ForeignKey("integration_providers.id", ondelete="SET NULL"), nullable=True)
    credentials = Column(JSONB, nullable=True)
    config      = Column(JSONB, nullable=True)
    is_enabled  = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ProviderLog(Base):
    """
    Audit / usage log for every provider API call.
    """
    __tablename__ = "provider_logs"

    id            = Column(Integer, primary_key=True, index=True)
    company_id    = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    provider_id   = Column(Integer, ForeignKey("integration_providers.id", ondelete="SET NULL"), nullable=True)
    category      = Column(String(50), nullable=False)
    action        = Column(String(100), nullable=False)  # send_sms, send_email, verify_kyc, ...
    status        = Column(String(20), nullable=False, default="pending")  # pending | success | failed | retrying
    request_data  = Column(JSONB, nullable=True)   # sanitised request (no secrets)
    response_data = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    latency_ms    = Column(Integer, nullable=True)
    retry_count   = Column(Integer, nullable=False, default=0)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_pl_company_category", "company_id", "category"),
        Index("ix_pl_created", "created_at"),
    )


class WebhookLog(Base):
    """
    Inbound webhook payloads from external providers.
    """
    __tablename__ = "webhook_logs"

    id            = Column(Integer, primary_key=True, index=True)
    provider_id   = Column(Integer, ForeignKey("integration_providers.id", ondelete="SET NULL"), nullable=True)
    company_id    = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    event_type    = Column(String(100), nullable=True)
    payload       = Column(JSONB, nullable=True)
    headers       = Column(JSONB, nullable=True)
    status        = Column(String(20), nullable=False, default="received")  # received | processed | failed
    error_message = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())


class ProviderUsage(Base):
    """
    Daily aggregated usage counters per company+provider.
    """
    __tablename__ = "provider_usage"

    id            = Column(Integer, primary_key=True, index=True)
    company_id    = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    provider_id   = Column(Integer, ForeignKey("integration_providers.id", ondelete="CASCADE"), nullable=False)
    category      = Column(String(50), nullable=False)
    date          = Column(DateTime(timezone=True), nullable=False)
    request_count = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    failure_count = Column(Integer, nullable=False, default=0)
    total_latency_ms = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("company_id", "provider_id", "date", name="uq_usage_daily"),
        Index("ix_pu_date", "date"),
    )
