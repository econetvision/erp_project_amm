"""rename radius columns from km to meters, default 50m

Revision ID: 0015_radius_km_to_m
Revises: 0014_work_location_company_id
Create Date: 2026-06-26
"""
from alembic import op
from sqlalchemy import inspect as sa_inspect

revision = "0015_radius_km_to_m"
down_revision = "0014_work_location_company_id"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    insp = sa_inspect(op.get_bind())
    if not insp.has_table(table):
        return False
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade():
    if _column_exists("work_locations", "allowed_radius_km") and not _column_exists("work_locations", "allowed_radius_m"):
        op.execute("ALTER TABLE work_locations RENAME COLUMN allowed_radius_km TO allowed_radius_m")
        op.execute("UPDATE work_locations SET allowed_radius_m = allowed_radius_m * 1000")
        op.execute("ALTER TABLE work_locations ALTER COLUMN allowed_radius_m SET DEFAULT 50.0")

    if _column_exists("users", "attendance_radius_km") and not _column_exists("users", "attendance_radius_m"):
        op.execute("ALTER TABLE users RENAME COLUMN attendance_radius_km TO attendance_radius_m")
        op.execute("UPDATE users SET attendance_radius_m = attendance_radius_m * 1000 WHERE attendance_radius_m IS NOT NULL")
        op.execute("ALTER TABLE users ALTER COLUMN attendance_radius_m SET DEFAULT 50.0")


def downgrade():
    if _column_exists("work_locations", "allowed_radius_m") and not _column_exists("work_locations", "allowed_radius_km"):
        op.execute("UPDATE work_locations SET allowed_radius_m = allowed_radius_m / 1000")
        op.execute("ALTER TABLE work_locations RENAME COLUMN allowed_radius_m TO allowed_radius_km")
        op.execute("ALTER TABLE work_locations ALTER COLUMN allowed_radius_km SET DEFAULT 10.0")

    if _column_exists("users", "attendance_radius_m") and not _column_exists("users", "attendance_radius_km"):
        op.execute("UPDATE users SET attendance_radius_m = attendance_radius_m / 1000 WHERE attendance_radius_m IS NOT NULL")
        op.execute("ALTER TABLE users RENAME COLUMN attendance_radius_m TO attendance_radius_km")
        op.execute("ALTER TABLE users ALTER COLUMN attendance_radius_km SET DEFAULT 10.0")
