"""Add email, display_name, phone, photo_path, theme_preference to users

Revision ID: 0008
Revises: 0007_work_locations
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_user_profile_columns"
down_revision = "0007_work_locations"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference JSONB")


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS display_name")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS phone")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS photo_path")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS theme_preference")
