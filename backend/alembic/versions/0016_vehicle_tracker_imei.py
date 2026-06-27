"""add tracker_imei to vehicles

Revision ID: 0016_vehicle_tracker_imei
Revises: 0015_radius_km_to_m
Create Date: 2026-06-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0016_vehicle_tracker_imei"
down_revision = "0015_radius_km_to_m"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    insp = sa_inspect(op.get_bind())
    if not insp.has_table(table):
        return False
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade():
    if not _column_exists("vehicles", "tracker_imei"):
        op.add_column("vehicles", sa.Column("tracker_imei", sa.String(20), nullable=True))
        op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_tracker_imei ON vehicles(tracker_imei)")


def downgrade():
    if _column_exists("vehicles", "tracker_imei"):
        op.execute("DROP INDEX IF EXISTS idx_vehicles_tracker_imei")
        op.drop_column("vehicles", "tracker_imei")
