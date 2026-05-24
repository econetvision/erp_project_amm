"""baseline - stamp existing schema

Revision ID: 0001_baseline
Revises:
Create Date: 2026-05-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables if they don't already exist.

    This migration is safe to run against a database that already has
    the schema (every statement uses IF NOT EXISTS).  For a brand-new
    database it bootstraps the full schema.
    """

    # ── employees ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            id                  SERIAL PRIMARY KEY,
            name                VARCHAR(255)   NOT NULL,
            address             TEXT           NOT NULL,
            aadhar_number       CHAR(12)       NOT NULL UNIQUE,
            bank_account_number VARCHAR(18)    NOT NULL,
            ifsc_code           VARCHAR(11),
            bank_name           VARCHAR(255),
            kyc_status          VARCHAR(20)    DEFAULT 'pending',
            kyc_verified_name   VARCHAR(255),
            hourly_rate         NUMERIC(10,2)  NOT NULL DEFAULT 0.00,
            shift               VARCHAR(10)    NOT NULL DEFAULT 'SHIFT_A'
                                CHECK (shift IN ('SHIFT_A','SHIFT_B')),
            face_encoding       JSONB,
            photo               TEXT,
            created_at          TIMESTAMP      NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMP      NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_bank_account_length
                CHECK (LENGTH(bank_account_number) BETWEEN 8 AND 18)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_employees_aadhar ON employees(aadhar_number)")

    # ── users ─────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            username      VARCHAR(50)    NOT NULL UNIQUE,
            password_hash VARCHAR(255)   NOT NULL,
            role          VARCHAR(20)    NOT NULL
                          CHECK (role IN ('admin','supervisor','worker')),
            employee_id   INTEGER        REFERENCES employees(id) ON DELETE SET NULL,
            email         VARCHAR(255),
            display_name  VARCHAR(255),
            phone         VARCHAR(20),
            photo_path    VARCHAR(500),
            theme_preference JSONB,
            created_at    TIMESTAMP      NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMP      NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")

    # ── attendance ────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id           SERIAL PRIMARY KEY,
            employee_id  INTEGER        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            date         DATE           NOT NULL,
            entry_time   TIME           NOT NULL,
            exit_time    TIME,
            hours_worked NUMERIC(5,2),
            created_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, date)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)")

    # ── payslips ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS payslips (
            id           SERIAL PRIMARY KEY,
            employee_id  INTEGER        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            month        SMALLINT       NOT NULL CHECK (month BETWEEN 1 AND 12),
            year         SMALLINT       NOT NULL CHECK (year > 2000),
            days_worked  SMALLINT       NOT NULL DEFAULT 0,
            total_hours  NUMERIC(7,2)   NOT NULL DEFAULT 0.00,
            hourly_rate  NUMERIC(10,2)  NOT NULL,
            daily_rate   NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
            gross_pay    NUMERIC(12,2)  NOT NULL,
            esi          NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
            pf           NUMERIC(12,2)  NOT NULL DEFAULT 0.00,
            net_pay      NUMERIC(12,2)  NOT NULL,
            generated_at TIMESTAMP      NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_payslip_employee_month_year UNIQUE (employee_id, month, year)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_payslips_employee_id ON payslips(employee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_payslips_month_year ON payslips(month, year)")

    # ── public_holidays ───────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS public_holidays (
            id         SERIAL PRIMARY KEY,
            date       DATE           NOT NULL UNIQUE,
            name       VARCHAR(120)   NOT NULL,
            created_at TIMESTAMP      NOT NULL DEFAULT NOW()
        )
    """)

    # ── vehicles ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS vehicles (
            id           SERIAL PRIMARY KEY,
            reg_number   VARCHAR(20)    NOT NULL UNIQUE,
            type         VARCHAR(20)    NOT NULL
                         CHECK (type IN ('truck','auto','van','bike','other')),
            make         VARCHAR(100),
            model        VARCHAR(100),
            status       VARCHAR(20)    NOT NULL DEFAULT 'available'
                         CHECK (status IN ('available','assigned','maintenance')),
            created_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMP      NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_vehicles_reg ON vehicles(reg_number)")

    # ── vehicle_assignments ───────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS vehicle_assignments (
            id           SERIAL PRIMARY KEY,
            vehicle_id   INTEGER        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
            employee_id  INTEGER        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            assigned_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
            released_at  TIMESTAMP,
            notes        TEXT,
            CONSTRAINT uq_active_vehicle UNIQUE (vehicle_id, released_at)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_va_vehicle ON vehicle_assignments(vehicle_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_va_employee ON vehicle_assignments(employee_id)")

    # ── vehicle_locations ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS vehicle_locations (
            id           SERIAL PRIMARY KEY,
            vehicle_id   INTEGER        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
            latitude     DOUBLE PRECISION NOT NULL,
            longitude    DOUBLE PRECISION NOT NULL,
            speed        NUMERIC(6,2),
            recorded_at  TIMESTAMP      NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_vl_vehicle ON vehicle_locations(vehicle_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_vl_recorded_at ON vehicle_locations(recorded_at DESC)")

    # ── job_routines ──────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS job_routines (
            id                    SERIAL PRIMARY KEY,
            name                  VARCHAR(255)   NOT NULL,
            type                  VARCHAR(50)    NOT NULL
                                  CHECK (type IN ('absent_report','late_report','custom')),
            frequency             VARCHAR(20)    NOT NULL
                                  CHECK (frequency IN ('daily','weekly','monthly')),
            schedule_time         VARCHAR(5)     NOT NULL DEFAULT '08:00',
            schedule_day_of_week  INTEGER        CHECK (schedule_day_of_week BETWEEN 0 AND 6),
            schedule_day_of_month INTEGER        CHECK (schedule_day_of_month BETWEEN 1 AND 28),
            delivery_channels     JSONB          NOT NULL
                                  DEFAULT '{"email": true, "in_app": true, "whatsapp": false}',
            recipients            JSONB          NOT NULL DEFAULT '[]',
            filters               JSONB,
            is_active             BOOLEAN        NOT NULL DEFAULT TRUE,
            created_by            INTEGER        REFERENCES users(id) ON DELETE SET NULL,
            created_at            TIMESTAMP      NOT NULL DEFAULT NOW(),
            updated_at            TIMESTAMP      NOT NULL DEFAULT NOW()
        )
    """)

    # ── job_routine_logs ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS job_routine_logs (
            id              SERIAL PRIMARY KEY,
            job_id          INTEGER NOT NULL REFERENCES job_routines(id) ON DELETE CASCADE,
            executed_at     TIMESTAMP NOT NULL DEFAULT NOW(),
            status          VARCHAR(20) NOT NULL CHECK (status IN ('success','failed')),
            result_summary  TEXT,
            error_message   TEXT
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_jrl_job_id ON job_routine_logs(job_id)")

    # ── notifications ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id         SERIAL PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title      VARCHAR(255) NOT NULL,
            body       TEXT,
            type       VARCHAR(50)  NOT NULL DEFAULT 'info',
            is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP    NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read)")

    # ── salary_structures ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS salary_structures (
            id          SERIAL PRIMARY KEY,
            name        VARCHAR(255) NOT NULL UNIQUE,
            description VARCHAR(500),
            is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
            created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
        )
    """)

    # ── salary_components ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS salary_components (
            id                    SERIAL PRIMARY KEY,
            structure_id          INTEGER NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
            name                  VARCHAR(100) NOT NULL,
            type                  VARCHAR(20)  NOT NULL
                                  CHECK (type IN ('earning','deduction')),
            calculation_type      VARCHAR(30)  NOT NULL
                                  CHECK (calculation_type IN ('fixed','percentage_of_basic','percentage_of_gross')),
            amount_or_percentage  NUMERIC(12,4) NOT NULL DEFAULT 0,
            is_mandatory          BOOLEAN NOT NULL DEFAULT TRUE,
            display_order         SMALLINT NOT NULL DEFAULT 0
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_sc_structure ON salary_components(structure_id)")

    # ── employee_salary ───────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS employee_salary (
            id             SERIAL PRIMARY KEY,
            employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            structure_id   INTEGER NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
            basic_pay      NUMERIC(12,2) NOT NULL,
            effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
            effective_to   TIMESTAMP,
            created_at     TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_es_employee ON employee_salary(employee_id)")

    # ── advances ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS advances (
            id                SERIAL PRIMARY KEY,
            employee_id       INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            amount            NUMERIC(12,2) NOT NULL,
            disbursed_date    DATE NOT NULL,
            repayment_months  INTEGER NOT NULL DEFAULT 1,
            monthly_deduction NUMERIC(12,2) NOT NULL,
            remaining_balance NUMERIC(12,2) NOT NULL,
            status            VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','repaid')),
            notes             TEXT,
            created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_advances_employee ON advances(employee_id)")

    # ── payroll_runs ──────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS payroll_runs (
            id               SERIAL PRIMARY KEY,
            month            SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
            year             SMALLINT NOT NULL CHECK (year > 2000),
            status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','processing','completed','cancelled')),
            run_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
            started_at       TIMESTAMP NOT NULL DEFAULT NOW(),
            completed_at     TIMESTAMP,
            total_gross      NUMERIC(14,2),
            total_net        NUMERIC(14,2),
            total_deductions NUMERIC(14,2),
            employee_count   INTEGER
        )
    """)

    # ── payroll_items ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS payroll_items (
            id                   SERIAL PRIMARY KEY,
            run_id               INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
            employee_id          INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            basic_pay            NUMERIC(12,2) NOT NULL,
            earnings_breakdown   JSONB NOT NULL DEFAULT '{}',
            deductions_breakdown JSONB NOT NULL DEFAULT '{}',
            days_worked          SMALLINT NOT NULL DEFAULT 0,
            overtime_hours       NUMERIC(7,2) NOT NULL DEFAULT 0,
            overtime_pay         NUMERIC(12,2) NOT NULL DEFAULT 0,
            gross_pay            NUMERIC(12,2) NOT NULL,
            total_deductions     NUMERIC(12,2) NOT NULL,
            advance_deduction    NUMERIC(12,2) NOT NULL DEFAULT 0,
            net_pay              NUMERIC(12,2) NOT NULL,
            status               VARCHAR(20) NOT NULL DEFAULT 'calculated'
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_pi_run ON payroll_items(run_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_pi_employee ON payroll_items(employee_id)")


def downgrade() -> None:
    """Drop all tables in reverse dependency order."""
    op.execute("DROP TABLE IF EXISTS payroll_items CASCADE")
    op.execute("DROP TABLE IF EXISTS payroll_runs CASCADE")
    op.execute("DROP TABLE IF EXISTS advances CASCADE")
    op.execute("DROP TABLE IF EXISTS employee_salary CASCADE")
    op.execute("DROP TABLE IF EXISTS salary_components CASCADE")
    op.execute("DROP TABLE IF EXISTS salary_structures CASCADE")
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
    op.execute("DROP TABLE IF EXISTS job_routine_logs CASCADE")
    op.execute("DROP TABLE IF EXISTS job_routines CASCADE")
    op.execute("DROP TABLE IF EXISTS vehicle_locations CASCADE")
    op.execute("DROP TABLE IF EXISTS vehicle_assignments CASCADE")
    op.execute("DROP TABLE IF EXISTS vehicles CASCADE")
    op.execute("DROP TABLE IF EXISTS public_holidays CASCADE")
    op.execute("DROP TABLE IF EXISTS payslips CASCADE")
    op.execute("DROP TABLE IF EXISTS attendance CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP TABLE IF EXISTS employees CASCADE")
