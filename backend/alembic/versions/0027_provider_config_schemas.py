"""Seed Twilio Verify OTP provider and backfill config_schema for all built-in
providers so the UI can render exact credential fields per connector.

Revision ID: 0027_provider_config_schemas
Revises: 0026_tenant_scoping
"""
import json

import sqlalchemy as sa
from alembic import op

revision = "0027_provider_config_schemas"
down_revision = "0026_tenant_scoping"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # Import the canonical schema definitions from application code so the
    # migration never drifts from what the adapters actually read.
    from providers.schemas import PROVIDER_CONFIG_SCHEMAS

    # ── New OTP provider: Twilio Verify ─────────────────────────────
    exists = bind.execute(
        sa.text("SELECT COUNT(*) FROM integration_providers WHERE code = 'twilio_verify'")
    ).scalar()
    if not exists:
        bind.execute(
            sa.text(
                "INSERT INTO integration_providers "
                "(category, code, name, description, is_active, version) "
                "VALUES ('otp', 'twilio_verify', 'Twilio Verify', "
                "'Twilio Verify phone & email OTP verification', TRUE, '1.0')"
            )
        )

    # ── Backfill config_schema on every known provider ──────────────
    for code, schema in PROVIDER_CONFIG_SCHEMAS.items():
        bind.execute(
            sa.text(
                "UPDATE integration_providers "
                "SET config_schema = CAST(:schema AS jsonb), updated_at = NOW() "
                "WHERE code = :code"
            ),
            {"schema": json.dumps(schema), "code": code},
        )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("DELETE FROM integration_providers WHERE code = 'twilio_verify'")
    )
    bind.execute(
        sa.text("UPDATE integration_providers SET config_schema = NULL")
    )
