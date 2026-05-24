"""Add work_locations and employee_location_assignments tables

Revision ID: 0007
Revises: 0006_employee_phone_email
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_work_locations"
down_revision = "0006_employee_phone_email"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS work_locations (
            id                SERIAL PRIMARY KEY,
            location_name     VARCHAR(255) NOT NULL,
            location_code     VARCHAR(50) UNIQUE,
            address           TEXT,
            city              VARCHAR(100),
            state             VARCHAR(100),
            pincode           VARCHAR(10),
            latitude          DOUBLE PRECISION NOT NULL,
            longitude         DOUBLE PRECISION NOT NULL,
            allowed_radius_km DOUBLE PRECISION NOT NULL DEFAULT 10.0,
            work_type         VARCHAR(50),
            supervisor_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
            is_active         BOOLEAN NOT NULL DEFAULT TRUE,
            created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at        TIMESTAMPTZ DEFAULT NOW(),
            updated_at        TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS employee_location_assignments (
            id            SERIAL PRIMARY KEY,
            employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            location_id   INTEGER NOT NULL REFERENCES work_locations(id) ON DELETE CASCADE,
            is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
            assigned_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
            assigned_at   TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(employee_id, location_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_ela_employee ON employee_location_assignments(employee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ela_location ON employee_location_assignments(location_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_wl_city ON work_locations(city)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_wl_active ON work_locations(is_active)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS employee_location_assignments")
    op.execute("DROP TABLE IF EXISTS work_locations")
