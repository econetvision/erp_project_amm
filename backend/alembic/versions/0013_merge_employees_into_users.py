"""merge employees into users

Revision ID: 0013
Revises: 0012
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.dialects import postgresql

revision = "0013"
down_revision = "0012_payslip_templates"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    insp = sa_inspect(op.get_bind())
    if not insp.has_table(table):
        return False
    return column in [c["name"] for c in insp.get_columns(table)]


def _table_exists(name):
    return sa_inspect(op.get_bind()).has_table(name)


def upgrade():
    # Skip entire migration if employees table is already gone (already merged)
    if not _table_exists("employees"):
        return

    # If users doesn't have employee_id, the schema was initialized in the
    # post-merge state (e.g. from init.sql). Just drop the orphan employees
    # table and ensure users has the right columns/indexes.
    if not _column_exists("users", "employee_id"):
        op.execute("DROP TABLE IF EXISTS employees CASCADE")
        op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_aadhar ON users(aadhar_number) WHERE aadhar_number IS NOT NULL")
        return

    # ── Step 1: Add employee-specific columns to users ────────────────────────
    cols = [
        ("name", sa.String(255), {}),
        ("gender", sa.String(10), {}),
        ("date_of_birth", sa.Date, {}),
        ("blood_group", sa.String(5), {}),
        ("marital_status", sa.String(20), {}),
        ("emergency_contact", sa.String(20), {}),
        ("emergency_name", sa.String(255), {}),
        ("address", sa.Text, {}),
        ("aadhar_number", sa.String(12), {}),
        ("bank_account_number", sa.String(18), {}),
        ("ifsc_code", sa.String(11), {}),
        ("bank_name", sa.String(255), {}),
        ("kyc_status", sa.String(20), {"server_default": "pending"}),
        ("kyc_verified_name", sa.String(255), {}),
        ("hourly_rate", sa.Numeric(10, 2), {"server_default": "0.00"}),
        ("shift", sa.String(10), {"server_default": "SHIFT_A"}),
        ("face_encoding", postgresql.JSONB, {}),
        ("photo", sa.Text, {}),
        ("work_location_name", sa.String(255), {}),
        ("work_latitude", sa.Float, {}),
        ("work_longitude", sa.Float, {}),
        ("attendance_radius_km", sa.Float, {"server_default": "10.0"}),
        ("phone_verified", sa.String(1), {"server_default": "N"}),
        ("email_verified", sa.String(1), {"server_default": "N"}),
    ]
    for col_name, col_type, kwargs in cols:
        if not _column_exists("users", col_name):
            op.add_column("users", sa.Column(col_name, col_type, nullable=True, **kwargs))

    # ── Step 2: Migrate data from employees to linked users ───────────────────
    op.execute("""
        UPDATE users u SET
            name                = e.name,
            gender              = e.gender,
            date_of_birth       = e.date_of_birth,
            blood_group         = e.blood_group,
            marital_status      = e.marital_status,
            emergency_contact   = e.emergency_contact,
            emergency_name      = e.emergency_name,
            address             = e.address,
            aadhar_number       = e.aadhar_number,
            bank_account_number = e.bank_account_number,
            ifsc_code           = e.ifsc_code,
            bank_name           = e.bank_name,
            kyc_status          = e.kyc_status,
            kyc_verified_name   = e.kyc_verified_name,
            hourly_rate         = e.hourly_rate,
            shift               = e.shift,
            face_encoding       = e.face_encoding,
            photo               = e.photo,
            work_location_name  = e.work_location_name,
            work_latitude       = e.work_latitude,
            work_longitude      = e.work_longitude,
            attendance_radius_km = e.attendance_radius_km,
            phone_verified      = e.phone_verified,
            email_verified      = e.email_verified
        FROM employees e
        WHERE u.employee_id = e.id
    """)

    # ── Step 3: Create users for orphan employees (no linked user) ────────────
    op.execute("""
        INSERT INTO users (username, password_hash, role, company_id, name, gender,
            date_of_birth, blood_group, marital_status, emergency_contact, emergency_name,
            phone, email, address, aadhar_number, bank_account_number, ifsc_code, bank_name,
            kyc_status, kyc_verified_name, hourly_rate, shift, face_encoding, photo,
            work_location_name, work_latitude, work_longitude, attendance_radius_km,
            phone_verified, email_verified, is_active)
        SELECT
            'emp_' || e.id,
            '$2b$12$placeholder_hash_for_orphan_employees',
            'worker',
            e.company_id,
            e.name, e.gender, e.date_of_birth, e.blood_group, e.marital_status,
            e.emergency_contact, e.emergency_name, e.phone, e.email, e.address,
            e.aadhar_number, e.bank_account_number, e.ifsc_code, e.bank_name,
            e.kyc_status, e.kyc_verified_name, e.hourly_rate, e.shift,
            e.face_encoding, e.photo, e.work_location_name, e.work_latitude,
            e.work_longitude, e.attendance_radius_km, e.phone_verified, e.email_verified,
            TRUE
        FROM employees e
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.employee_id = e.id)
    """)

    # ── Step 4: Update FKs in child tables ────────────────────────────────────
    # For each child table, update employee_id to point to users.id instead

    # attendance: update employee_id to the user.id that absorbed that employee
    op.execute("""
        UPDATE attendance a SET employee_id = u.id
        FROM users u WHERE u.employee_id = a.employee_id
    """)
    # Handle orphans (employees that became new users via emp_ username)
    op.execute("""
        UPDATE attendance a SET employee_id = u.id
        FROM users u
        WHERE u.username = 'emp_' || a.employee_id
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.employee_id = a.employee_id AND u2.username != 'emp_' || a.employee_id)
    """)

    # payslips
    op.execute("""
        UPDATE payslips p SET employee_id = u.id
        FROM users u WHERE u.employee_id = p.employee_id
    """)
    op.execute("""
        UPDATE payslips p SET employee_id = u.id
        FROM users u
        WHERE u.username = 'emp_' || p.employee_id
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.employee_id = p.employee_id AND u2.username != 'emp_' || p.employee_id)
    """)

    # advances
    op.execute("""
        UPDATE advances a SET employee_id = u.id
        FROM users u WHERE u.employee_id = a.employee_id
    """)
    op.execute("""
        UPDATE advances a SET employee_id = u.id
        FROM users u
        WHERE u.username = 'emp_' || a.employee_id
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.employee_id = a.employee_id AND u2.username != 'emp_' || a.employee_id)
    """)

    # vehicle_assignments
    op.execute("""
        UPDATE vehicle_assignments va SET employee_id = u.id
        FROM users u WHERE u.employee_id = va.employee_id
    """)
    op.execute("""
        UPDATE vehicle_assignments va SET employee_id = u.id
        FROM users u
        WHERE u.username = 'emp_' || va.employee_id
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.employee_id = va.employee_id AND u2.username != 'emp_' || va.employee_id)
    """)

    # employee_location_assignments
    op.execute("""
        UPDATE employee_location_assignments ela SET employee_id = u.id
        FROM users u WHERE u.employee_id = ela.employee_id
    """)
    op.execute("""
        UPDATE employee_location_assignments ela SET employee_id = u.id
        FROM users u
        WHERE u.username = 'emp_' || ela.employee_id
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.employee_id = ela.employee_id AND u2.username != 'emp_' || ela.employee_id)
    """)

    # payroll_items
    op.execute("""
        UPDATE payroll_items pi SET employee_id = u.id
        FROM users u WHERE u.employee_id = pi.employee_id
    """)
    op.execute("""
        UPDATE payroll_items pi SET employee_id = u.id
        FROM users u
        WHERE u.username = 'emp_' || pi.employee_id
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.employee_id = pi.employee_id AND u2.username != 'emp_' || pi.employee_id)
    """)

    # employee_salary
    op.execute("""
        UPDATE employee_salary es SET employee_id = u.id
        FROM users u WHERE u.employee_id = es.employee_id
    """)
    op.execute("""
        UPDATE employee_salary es SET employee_id = u.id
        FROM users u
        WHERE u.username = 'emp_' || es.employee_id
        AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.employee_id = es.employee_id AND u2.username != 'emp_' || es.employee_id)
    """)

    # ── Step 5: Drop old FK constraints and re-create pointing to users ───────
    # Drop constraints referencing employees
    op.execute("ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_fkey")
    op.execute("ALTER TABLE payslips DROP CONSTRAINT IF EXISTS payslips_employee_id_fkey")
    op.execute("ALTER TABLE advances DROP CONSTRAINT IF EXISTS advances_employee_id_fkey")
    op.execute("ALTER TABLE vehicle_assignments DROP CONSTRAINT IF EXISTS vehicle_assignments_employee_id_fkey")
    op.execute("ALTER TABLE employee_location_assignments DROP CONSTRAINT IF EXISTS employee_location_assignments_employee_id_fkey")
    op.execute("ALTER TABLE payroll_items DROP CONSTRAINT IF EXISTS payroll_items_employee_id_fkey")
    op.execute("ALTER TABLE employee_salary DROP CONSTRAINT IF EXISTS employee_salary_employee_id_fkey")

    # Add new FK constraints pointing to users(id)
    op.execute("ALTER TABLE attendance ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE payslips ADD CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE advances ADD CONSTRAINT advances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE vehicle_assignments ADD CONSTRAINT vehicle_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE employee_location_assignments ADD CONSTRAINT employee_location_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE payroll_items ADD CONSTRAINT payroll_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE employee_salary ADD CONSTRAINT employee_salary_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE")

    # Update unique constraints
    op.execute("ALTER TABLE attendance DROP CONSTRAINT IF EXISTS uq_attendance_employee_date")
    op.execute("ALTER TABLE attendance ADD CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, date)")
    op.execute("ALTER TABLE payslips DROP CONSTRAINT IF EXISTS uq_payslip_employee_month_year")
    op.execute("ALTER TABLE payslips ADD CONSTRAINT uq_payslip_employee_month_year UNIQUE (employee_id, month, year)")

    # ── Step 6: Drop employees table ─────────────────────────────────────────
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employee_id_fkey")
    op.drop_column("users", "employee_id")
    op.execute("DROP TABLE IF EXISTS employees CASCADE")

    # ── Step 7: Add unique constraint on aadhar ───────────────────────────────
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_aadhar ON users(aadhar_number) WHERE aadhar_number IS NOT NULL")


def downgrade():
    # This migration is not safely reversible since data has been restructured.
    # A full restore from backup would be needed.
    raise NotImplementedError("Cannot downgrade: employees table has been merged into users. Restore from backup.")
