"""add onboarding_complete flag to users

Revision ID: 0023_onboarding_complete
Revises: 0022_merge_heads
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0023_onboarding_complete"
down_revision = "0022_merge_heads"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    insp = sa_inspect(op.get_bind())
    if not insp.has_table(table):
        return False
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade():
    # Add onboarding_complete flag to users table
    # This indicates whether the employee setup is complete (face registered, KYC verified, etc.)
    if not _column_exists("users", "onboarding_complete"):
        op.add_column(
            "users",
            sa.Column("onboarding_complete", sa.Boolean(), nullable=True, server_default="false")
        )

    # Mark existing users with face_encoding as onboarding complete
    op.execute("""
        UPDATE users
        SET onboarding_complete = true
        WHERE face_encoding IS NOT NULL
        AND role IN ('worker', 'supervisor')
    """)

    # Mark admin/master users as onboarding complete by default
    op.execute("""
        UPDATE users
        SET onboarding_complete = true
        WHERE role IN ('admin', 'master')
    """)


def downgrade():
    if _column_exists("users", "onboarding_complete"):
        op.drop_column("users", "onboarding_complete")
