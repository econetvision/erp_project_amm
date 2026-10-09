"""Physical attendance: supervisor site assignment and site-stamped attendance.

Revision ID: 0032_physical_attendance
Revises: 0031_subscription_licensing
Create Date: 2026-10-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0032_physical_attendance"
down_revision = "0031_subscription_licensing"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    return column in {c["name"] for c in sa_inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    if not _has_column("users", "physical_attendance_site_id"):
        op.add_column("users", sa.Column("physical_attendance_site_id", sa.Integer, nullable=True))
        op.create_foreign_key(
            "fk_users_physical_attendance_site", "users", "work_locations",
            ["physical_attendance_site_id"], ["id"], ondelete="SET NULL",
        )
    if not _has_column("attendance", "site_location_id"):
        op.add_column("attendance", sa.Column("site_location_id", sa.Integer, nullable=True))
        op.create_foreign_key(
            "fk_attendance_site_location", "attendance", "work_locations",
            ["site_location_id"], ["id"], ondelete="SET NULL",
        )
    if not _has_column("attendance", "marked_by"):
        op.add_column("attendance", sa.Column("marked_by", sa.Integer, nullable=True))
        op.create_foreign_key(
            "fk_attendance_marked_by", "attendance", "users",
            ["marked_by"], ["id"], ondelete="SET NULL",
        )
    op.create_index("ix_attendance_site_location_id", "attendance", ["site_location_id"],
                    if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_attendance_site_location_id", table_name="attendance", if_exists=True)
    if _has_column("attendance", "marked_by"):
        op.drop_column("attendance", "marked_by")
    if _has_column("attendance", "site_location_id"):
        op.drop_column("attendance", "site_location_id")
    if _has_column("users", "physical_attendance_site_id"):
        op.drop_column("users", "physical_attendance_site_id")
