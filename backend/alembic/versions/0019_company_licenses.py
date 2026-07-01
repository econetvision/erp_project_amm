"""per-company licenses

Revision ID: 0019_company_licenses
Revises: 0018_reset_admin_password
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.dialects.postgresql import JSONB

revision = "0019_company_licenses"
down_revision = "0018_reset_admin_password"
branch_labels = None
depends_on = None


def _table_exists(name):
    return sa_inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _table_exists("company_licenses"):
        op.create_table(
            "company_licenses",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("company_id", sa.Integer,
                      sa.ForeignKey("companies.id", ondelete="CASCADE"),
                      nullable=False, unique=True),
            sa.Column("license_key", sa.String(64), nullable=False, unique=True),
            sa.Column("tier", sa.String(20), nullable=False, server_default="basic"),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("max_seats", sa.Integer, nullable=True),
            sa.Column("valid_from", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("features", JSONB, nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # License management permissions (idempotent)
    for code, name, desc in [
        ("licenses.view",   "View Licenses",   "View company license status"),
        ("licenses.manage", "Manage Licenses", "Issue, renew and suspend company licenses"),
    ]:
        op.execute(
            f"INSERT INTO permissions (code, name, module, description) "
            f"VALUES ('{code}', '{name}', 'licenses', '{desc}') "
            f"ON CONFLICT (code) DO NOTHING"
        )


def downgrade() -> None:
    op.drop_table("company_licenses")
    op.execute("DELETE FROM permissions WHERE module = 'licenses'")
