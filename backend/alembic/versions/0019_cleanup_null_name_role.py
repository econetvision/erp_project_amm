"""Remove employee/user rows with null name or null role

Revision ID: 0019_cleanup_null_name_role
Revises: 0018_reset_admin_password
Create Date: 2026-07-01
"""
from alembic import op

revision = "0019_cleanup_null_name_role"
down_revision = "0018_reset_admin_password"
branch_labels = None
depends_on = None


def upgrade():
    # Delete worker/supervisor records that have no name — these crash the employee list
    op.execute(
        "DELETE FROM users WHERE role IN ('worker', 'supervisor') AND (name IS NULL OR TRIM(name) = '')"
    )
    # Delete any user records that ended up with no role (defensive)
    op.execute(
        "DELETE FROM users WHERE role IS NULL OR TRIM(role) = ''"
    )


def downgrade():
    pass
