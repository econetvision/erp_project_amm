"""Add phone, email and verification columns to employees

Revision ID: 0006
Revises: 0005_employee_work_location
"""

from alembic import op

revision = "0006_employee_phone_email"
down_revision = "0005_employee_work_location"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20)")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(255)")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone_verified VARCHAR(1) DEFAULT 'N'")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS email_verified VARCHAR(1) DEFAULT 'N'")


def downgrade():
    op.drop_column("employees", "email_verified")
    op.drop_column("employees", "phone_verified")
    op.drop_column("employees", "email")
    op.drop_column("employees", "phone")
