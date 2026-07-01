"""Add employee_code column to users table

Revision ID: 0020_add_employee_code
Revises: 0019_cleanup_null_name_role
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0020_add_employee_code"
down_revision = "0019_cleanup_null_name_role"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("employee_code", sa.String(20), nullable=True, unique=True),
    )


def downgrade():
    op.drop_column("users", "employee_code")
