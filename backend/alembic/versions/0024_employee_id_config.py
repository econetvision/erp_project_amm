"""add employee_id_config JSONB to companies

Stores the employee-code generation pattern configured in company settings,
e.g. {"prefix": "ABC", "include_site": true, "separator": "-",
      "seq_digits": 3, "seq_start": 1}

Revision ID: 0024_employee_id_config
Revises: 0023_onboarding_complete
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import inspect as sa_inspect

revision = "0024_employee_id_config"
down_revision = "0023_onboarding_complete"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    insp = sa_inspect(op.get_bind())
    if not insp.has_table(table):
        return False
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade():
    if not _column_exists("companies", "employee_id_config"):
        op.add_column("companies", sa.Column("employee_id_config", JSONB(), nullable=True))


def downgrade():
    if _column_exists("companies", "employee_id_config"):
        op.drop_column("companies", "employee_id_config")
