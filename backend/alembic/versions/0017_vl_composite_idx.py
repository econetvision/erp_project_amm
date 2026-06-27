"""add composite index on vehicle_locations(vehicle_id, recorded_at)

Revision ID: 0017_vl_composite_idx
Revises: 0016_vehicle_tracker_imei
Create Date: 2026-06-27
"""
from alembic import op

revision = "0017_vl_composite_idx"
down_revision = "0016_vehicle_tracker_imei"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_vl_vehicle_recorded ON vehicle_locations(vehicle_id, recorded_at DESC)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_vl_vehicle_recorded")
