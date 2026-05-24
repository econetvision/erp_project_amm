"""Add location columns to attendance table

Revision ID: 0004
Revises: 0003_hr_fields_pin_holidays
"""

from alembic import op

revision = "0004_attendance_location"
down_revision = "0003_hr_fields_pin_holidays"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_latitude DOUBLE PRECISION")
    op.execute("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_in_longitude DOUBLE PRECISION")
    op.execute("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_latitude DOUBLE PRECISION")
    op.execute("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS clock_out_longitude DOUBLE PRECISION")


def downgrade():
    op.drop_column("attendance", "clock_out_longitude")
    op.drop_column("attendance", "clock_out_latitude")
    op.drop_column("attendance", "clock_in_longitude")
    op.drop_column("attendance", "clock_in_latitude")
