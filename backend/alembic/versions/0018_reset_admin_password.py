"""reset admin and master passwords to defaults

Revision ID: 0018_reset_admin_password
Revises: 0017_vl_composite_idx
Create Date: 2026-06-28
"""
from alembic import op
import bcrypt

revision = "0018_reset_admin_password"
down_revision = "0017_vl_composite_idx"
branch_labels = None
depends_on = None


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def upgrade():
    # Reset master password to master123
    master_hash = _hash("master123")
    op.execute(
        f"UPDATE users SET password_hash = '{master_hash}' WHERE username = 'master'"
    )
    # Reset admin password to admin123
    admin_hash = _hash("admin123")
    op.execute(
        f"UPDATE users SET password_hash = '{admin_hash}' WHERE username = 'admin'"
    )


def downgrade():
    # No downgrade - passwords are irreversibly hashed
    pass
