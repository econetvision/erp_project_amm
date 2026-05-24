"""Add missing updated_at column to users table

Revision ID: 0009
Revises: 0008_user_profile_columns
"""

from alembic import op
import sqlalchemy as sa

revision = "0009_add_missing_updated_at"
down_revision = "0008_user_profile_columns"
branch_labels = None
depends_on = None


def upgrade():
    # Add updated_at column if it doesn't exist
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    """)


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS updated_at")
