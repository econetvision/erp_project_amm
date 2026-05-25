"""add company_id to work_locations

Revision ID: 0014_work_location_company_id
Revises: 0013
Create Date: 2025-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0014_work_location_company_id"
down_revision = "0013"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    insp = sa_inspect(op.get_bind())
    if not insp.has_table(table):
        return False
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade():
    if not _column_exists("work_locations", "company_id"):
        op.add_column(
            "work_locations",
            sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True),
        )
        op.execute("CREATE INDEX IF NOT EXISTS idx_wl_company ON work_locations(company_id)")


def downgrade():
    if _column_exists("work_locations", "company_id"):
        op.execute("DROP INDEX IF EXISTS idx_wl_company")
        op.drop_column("work_locations", "company_id")
