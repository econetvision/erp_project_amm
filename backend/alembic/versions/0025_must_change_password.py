"""add must_change_password flag to users

Admin/supervisor accounts created with an admin-supplied password must set
their own password on first browser login before mobile login is allowed.

Revision ID: 0025_must_change_password
Revises: 0024_employee_id_config
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0025_must_change_password"
down_revision = "0024_employee_id_config"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    insp = sa_inspect(op.get_bind())
    if not insp.has_table(table):
        return False
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade():
    if not _column_exists("users", "must_change_password"):
        op.add_column(
            "users",
            sa.Column("must_change_password", sa.Boolean(), nullable=True, server_default="false")
        )

    # Existing users have already been using their passwords — don't force them.
    op.execute("UPDATE users SET must_change_password = false WHERE must_change_password IS NULL")


def downgrade():
    if _column_exists("users", "must_change_password"):
        op.drop_column("users", "must_change_password")
