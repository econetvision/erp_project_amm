"""Add work location columns to employees table

Revision ID: 0005
Revises: 0004_attendance_location
"""

from alembic import op

revision = "0005_employee_work_location"
down_revision = "0004_attendance_location"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_location_name VARCHAR(255)")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_latitude DOUBLE PRECISION")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_longitude DOUBLE PRECISION")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS attendance_radius_km DOUBLE PRECISION DEFAULT 10.0")


def downgrade():
    op.drop_column("employees", "attendance_radius_km")
    op.drop_column("employees", "work_longitude")
    op.drop_column("employees", "work_latitude")
    op.drop_column("employees", "work_location_name")
