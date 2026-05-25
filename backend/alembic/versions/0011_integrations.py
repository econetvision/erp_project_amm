"""integration management tables

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.dialects.postgresql import JSONB

revision = "0011_integrations"
down_revision = "0010_multi_tenant"
branch_labels = None
depends_on = None


def _table_exists(name):
    return sa_inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    # ── integration_providers ────────────────────────────────────────
    if not _table_exists("integration_providers"):
        op.create_table(
            "integration_providers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("code", sa.String(100), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("config_schema", JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("version", sa.String(20), nullable=True, server_default="1.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── company_integrations ─────────────────────────────────────────
    if not _table_exists("company_integrations"):
      op.create_table(
        "company_integrations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_id", sa.Integer, sa.ForeignKey("integration_providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("is_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("priority", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_fallback", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("credentials", JSONB, nullable=True),
        sa.Column("config", JSONB, nullable=True),
        sa.Column("daily_quota", sa.Integer, nullable=True),
        sa.Column("monthly_quota", sa.Integer, nullable=True),
        sa.Column("rate_limit_per_min", sa.Integer, nullable=True),
        sa.Column("last_health_check", sa.DateTime(timezone=True), nullable=True),
        sa.Column("health_status", sa.String(20), nullable=True, server_default="'unknown'"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "provider_id", name="uq_company_provider"),
      )
    op.execute("CREATE INDEX IF NOT EXISTS ix_ci_company_category ON company_integrations (company_id, category)")

    # ── global_integration_defaults ──────────────────────────────────
    if not _table_exists("global_integration_defaults"):
      op.create_table(
        "global_integration_defaults",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("category", sa.String(50), nullable=False, unique=True),
        sa.Column("provider_id", sa.Integer, sa.ForeignKey("integration_providers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("fallback_provider_id", sa.Integer, sa.ForeignKey("integration_providers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("credentials", JSONB, nullable=True),
        sa.Column("config", JSONB, nullable=True),
        sa.Column("is_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── provider_logs ────────────────────────────────────────────────
    if not _table_exists("provider_logs"):
      op.create_table(
        "provider_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("provider_id", sa.Integer, sa.ForeignKey("integration_providers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="'pending'"),
        sa.Column("request_data", JSONB, nullable=True),
        sa.Column("response_data", JSONB, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=True),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_pl_company_category ON provider_logs (company_id, category)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pl_created ON provider_logs (created_at)")

    # ── webhook_logs ─────────────────────────────────────────────────
    if not _table_exists("webhook_logs"):
      op.create_table(
        "webhook_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("provider_id", sa.Integer, sa.ForeignKey("integration_providers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=True),
        sa.Column("payload", JSONB, nullable=True),
        sa.Column("headers", JSONB, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="'received'"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── provider_usage ───────────────────────────────────────────────
    if not _table_exists("provider_usage"):
      op.create_table(
        "provider_usage",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_id", sa.Integer, sa.ForeignKey("integration_providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("success_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("failure_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_latency_ms", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("company_id", "provider_id", "date", name="uq_usage_daily"),
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_pu_date ON provider_usage (date)")

    # ── Seed default providers (skip if already populated) ─────────
    bind = op.get_bind()
    row_count = bind.execute(sa.text("SELECT COUNT(*) FROM integration_providers")).scalar()
    if row_count == 0:
        providers_table = sa.table(
            "integration_providers",
            sa.column("category", sa.String),
            sa.column("code", sa.String),
            sa.column("name", sa.String),
            sa.column("description", sa.Text),
            sa.column("is_active", sa.Boolean),
            sa.column("version", sa.String),
        )

        op.bulk_insert(providers_table, [
        # SMS
        {"category": "sms", "code": "twilio_sms",     "name": "Twilio SMS",         "description": "Twilio programmable SMS & Verify", "is_active": True, "version": "1.0"},
        {"category": "sms", "code": "msg91_sms",      "name": "MSG91",              "description": "MSG91 transactional & OTP SMS",     "is_active": True, "version": "1.0"},
        {"category": "sms", "code": "aws_sns_sms",    "name": "AWS SNS",            "description": "Amazon SNS SMS service",            "is_active": True, "version": "1.0"},
        {"category": "sms", "code": "textlocal_sms",  "name": "TextLocal",          "description": "TextLocal SMS gateway",             "is_active": True, "version": "1.0"},
        {"category": "sms", "code": "vonage_sms",     "name": "Vonage / Nexmo",     "description": "Vonage (Nexmo) SMS API",            "is_active": True, "version": "1.0"},
        # Email
        {"category": "email", "code": "smtp_email",     "name": "SMTP",              "description": "Generic SMTP server",                "is_active": True, "version": "1.0"},
        {"category": "email", "code": "sendgrid_email", "name": "Twilio SendGrid",   "description": "SendGrid email API",                 "is_active": True, "version": "1.0"},
        {"category": "email", "code": "aws_ses_email",  "name": "AWS SES",           "description": "Amazon Simple Email Service",         "is_active": True, "version": "1.0"},
        {"category": "email", "code": "mailgun_email",  "name": "Mailgun",           "description": "Mailgun email API",                   "is_active": True, "version": "1.0"},
        # Maps
        {"category": "maps", "code": "google_maps",  "name": "Google Maps",        "description": "Google Maps Platform",               "is_active": True, "version": "1.0"},
        {"category": "maps", "code": "mapbox_maps",   "name": "Mapbox",             "description": "Mapbox geocoding & maps",            "is_active": True, "version": "1.0"},
        {"category": "maps", "code": "osm_maps",      "name": "OpenStreetMap",      "description": "Nominatim / OpenStreetMap",          "is_active": True, "version": "1.0"},
        {"category": "maps", "code": "here_maps",     "name": "HERE Maps",          "description": "HERE location platform",             "is_active": True, "version": "1.0"},
        # KYC
        {"category": "kyc", "code": "cashfree_kyc",    "name": "Cashfree KYC",     "description": "Cashfree verification APIs",          "is_active": True, "version": "1.0"},
        {"category": "kyc", "code": "signzy_kyc",      "name": "Signzy",           "description": "Signzy digital verification",         "is_active": True, "version": "1.0"},
        {"category": "kyc", "code": "hyperverge_kyc",  "name": "HyperVerge",       "description": "HyperVerge AI verification",          "is_active": True, "version": "1.0"},
        {"category": "kyc", "code": "karza_kyc",       "name": "Karza",            "description": "Karza Technologies verification",     "is_active": True, "version": "1.0"},
        # Bank
        {"category": "bank", "code": "razorpayx_bank", "name": "RazorpayX",        "description": "RazorpayX banking & verification",    "is_active": True, "version": "1.0"},
        {"category": "bank", "code": "cashfree_bank",  "name": "Cashfree",         "description": "Cashfree bank account verification",  "is_active": True, "version": "1.0"},
        {"category": "bank", "code": "decentro_bank",  "name": "Decentro",         "description": "Decentro banking APIs",               "is_active": True, "version": "1.0"},
        {"category": "bank", "code": "setu_bank",      "name": "Setu",             "description": "Setu fintech APIs",                   "is_active": True, "version": "1.0"},
    ])

    # Add integration permissions (idempotent via raw SQL)
    for code, name, desc in [
        ("integrations.view",    "View Integrations",   "View integration dashboard & logs"),
        ("integrations.manage",  "Manage Integrations", "Configure company integrations"),
        ("integrations.admin",   "Admin Integrations",  "Manage provider catalogue & global defaults"),
        ("integrations.secrets", "Manage Secrets",      "View and edit provider credentials"),
    ]:
        op.execute(
            f"INSERT INTO permissions (code, name, module, description) "
            f"VALUES ('{code}', '{name}', 'integrations', '{desc}') "
            f"ON CONFLICT (code) DO NOTHING"
        )


def downgrade() -> None:
    op.drop_table("provider_usage")
    op.drop_table("webhook_logs")
    op.drop_table("provider_logs")
    op.drop_table("global_integration_defaults")
    op.drop_table("company_integrations")
    op.drop_table("integration_providers")
    op.execute("DELETE FROM permissions WHERE module = 'integrations'")
