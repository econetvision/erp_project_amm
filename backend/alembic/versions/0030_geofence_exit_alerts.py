"""Employee geofence tracking + push device tokens.

- device_tokens: FCM registration tokens per user/device.
- employee_location_pings: background position reports while clocked in.
- geofence_exit_events: one row per "left the work location" episode.

Revision ID: 0030_geofence_exit_alerts
Revises: 0029_merge_heads
Create Date: 2026-09-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect as sa_inspect

revision = "0030_geofence_exit_alerts"
down_revision = "0029_merge_heads"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    return sa_inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _table_exists("device_tokens"):
        op.create_table(
            "device_tokens",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token", sa.String(512), nullable=False, unique=True),
            sa.Column("platform", sa.String(20), nullable=False, server_default="android"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_device_tokens_user_id", "device_tokens", ["user_id"])

    if not _table_exists("employee_location_pings"):
        op.create_table(
            "employee_location_pings",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("employee_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("latitude", sa.Float, nullable=False),
            sa.Column("longitude", sa.Float, nullable=False),
            sa.Column("accuracy_m", sa.Float, nullable=True),
            sa.Column("inside_geofence", sa.Boolean, nullable=False),
            sa.Column("nearest_location_id", sa.Integer, sa.ForeignKey("work_locations.id", ondelete="SET NULL"), nullable=True),
            sa.Column("distance_m", sa.Float, nullable=True),
            sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_employee_location_pings_emp_time", "employee_location_pings", ["employee_id", "recorded_at"])

    if not _table_exists("geofence_exit_events"):
        op.create_table(
            "geofence_exit_events",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("employee_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("location_id", sa.Integer, sa.ForeignKey("work_locations.id", ondelete="SET NULL"), nullable=True),
            sa.Column("location_name", sa.String(255), nullable=True),
            sa.Column("distance_m", sa.Float, nullable=True),
            sa.Column("latitude", sa.Float, nullable=True),
            sa.Column("longitude", sa.Float, nullable=True),
            sa.Column("exited_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notified_user_ids", postgresql.JSONB, nullable=True),
        )
        op.create_index("ix_geofence_exit_events_employee_id", "geofence_exit_events", ["employee_id"])


def downgrade() -> None:
    if _table_exists("geofence_exit_events"):
        op.drop_table("geofence_exit_events")
    if _table_exists("employee_location_pings"):
        op.drop_table("employee_location_pings")
    if _table_exists("device_tokens"):
        op.drop_table("device_tokens")
