"""add missing employee columns

Revision ID: 0002_employee_columns
Revises: 0001_baseline
Create Date: 2026-05-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_employee_columns"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(11)")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255)")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'pending'")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS kyc_verified_name VARCHAR(255)")


def downgrade() -> None:
    op.drop_column("employees", "kyc_verified_name")
    op.drop_column("employees", "kyc_status")
    op.drop_column("employees", "bank_name")
    op.drop_column("employees", "ifsc_code")
