"""Add HR fields to employees, PIN/lock_timeout to users, holiday_type to public_holidays

Revision ID: 0003
Revises: 0002
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_hr_fields_pin_holidays"
down_revision = "0002_employee_columns"
branch_labels = None
depends_on = None


def upgrade():
    # ── employees: HR fields ────────────────────────────────────────────
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(10)")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS blood_group VARCHAR(5)")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20)")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20)")
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_name VARCHAR(255)")

    # ── users: PIN + lock timeout ───────────────────────────────────────
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_timeout INTEGER DEFAULT 2")

    # ── public_holidays: type + optional flag ───────────────────────────
    op.execute("ALTER TABLE public_holidays ADD COLUMN IF NOT EXISTS holiday_type VARCHAR(20) DEFAULT 'public'")
    op.execute("ALTER TABLE public_holidays ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT FALSE")


def downgrade():
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS gender")
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS date_of_birth")
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS blood_group")
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS marital_status")
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS emergency_contact")
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS emergency_name")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS pin_hash")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS lock_timeout")
    op.execute("ALTER TABLE public_holidays DROP COLUMN IF EXISTS holiday_type")
    op.execute("ALTER TABLE public_holidays DROP COLUMN IF EXISTS is_optional")
