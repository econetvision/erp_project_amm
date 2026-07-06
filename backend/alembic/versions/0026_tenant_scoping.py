"""add company_id to fleet / job / holiday tables for tenant scoping

Adds a company_id column to vehicles, vehicle_assignments, vehicle_locations,
job_routines and public_holidays so multi-tenant filtering can be enforced.
Existing rows are back-filled best-effort from related records; if the
deployment has a single company, any remaining fleet/job rows are attached to
it. Public holidays are left global (NULL) unless already company-specific.

Revision ID: 0026_tenant_scoping
Revises: 0025_must_change_password
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0026_tenant_scoping"
down_revision = "0025_must_change_password"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    insp = sa_inspect(op.get_bind())
    if not insp.has_table(table):
        return False
    return column in [c["name"] for c in insp.get_columns(table)]


def _add_company_id(table, index_name):
    if not _column_exists(table, "company_id"):
        op.add_column(
            table,
            sa.Column(
                "company_id", sa.Integer(),
                sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True,
            ),
        )
        op.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table}(company_id)")


def upgrade():
    _add_company_id("vehicles", "idx_veh_company")
    _add_company_id("vehicle_assignments", "idx_va_company")
    _add_company_id("vehicle_locations", "idx_vl_company")
    _add_company_id("job_routines", "idx_jr_company")
    _add_company_id("public_holidays", "idx_ph_company")
    _add_company_id("salary_structures", "idx_ss_company")
    _add_company_id("payroll_runs", "idx_pr_company")

    # ── Best-effort back-fill from related records ──────────────────────────
    # Assignments inherit the assigned employee's company.
    op.execute("""
        UPDATE vehicle_assignments va
        SET company_id = u.company_id
        FROM users u
        WHERE va.employee_id = u.id AND va.company_id IS NULL
    """)
    # Vehicles inherit the company of any of their assignments.
    op.execute("""
        UPDATE vehicles v
        SET company_id = sub.company_id
        FROM (
            SELECT vehicle_id, MIN(company_id) AS company_id
            FROM vehicle_assignments
            WHERE company_id IS NOT NULL
            GROUP BY vehicle_id
        ) sub
        WHERE v.id = sub.vehicle_id AND v.company_id IS NULL
    """)
    # Location samples inherit their vehicle's company.
    op.execute("""
        UPDATE vehicle_locations vl
        SET company_id = v.company_id
        FROM vehicles v
        WHERE vl.vehicle_id = v.id AND vl.company_id IS NULL
    """)
    # Job routines inherit their creator's company.
    op.execute("""
        UPDATE job_routines jr
        SET company_id = u.company_id
        FROM users u
        WHERE jr.created_by = u.id AND jr.company_id IS NULL
    """)
    # Payroll runs inherit the company of the employees they paid.
    op.execute("""
        UPDATE payroll_runs pr
        SET company_id = sub.company_id
        FROM (
            SELECT pi.run_id, MIN(u.company_id) AS company_id
            FROM payroll_items pi
            JOIN users u ON u.id = pi.employee_id
            WHERE u.company_id IS NOT NULL
            GROUP BY pi.run_id
        ) sub
        WHERE pr.id = sub.run_id AND pr.company_id IS NULL
    """)
    # Salary structures inherit the company of employees assigned to them.
    op.execute("""
        UPDATE salary_structures ss
        SET company_id = sub.company_id
        FROM (
            SELECT es.structure_id, MIN(u.company_id) AS company_id
            FROM employee_salary es
            JOIN users u ON u.id = es.employee_id
            WHERE u.company_id IS NOT NULL
            GROUP BY es.structure_id
        ) sub
        WHERE ss.id = sub.structure_id AND ss.company_id IS NULL
    """)

    # Single-company deployments: attach any orphaned fleet/job rows to the
    # sole company so existing admins keep seeing their data.
    op.execute("""
        DO $$
        DECLARE only_company INTEGER;
        BEGIN
            SELECT id INTO only_company FROM companies LIMIT 2;
            IF (SELECT COUNT(*) FROM companies) = 1 THEN
                UPDATE vehicles           SET company_id = only_company WHERE company_id IS NULL;
                UPDATE vehicle_assignments SET company_id = only_company WHERE company_id IS NULL;
                UPDATE vehicle_locations  SET company_id = only_company WHERE company_id IS NULL;
                UPDATE job_routines       SET company_id = only_company WHERE company_id IS NULL;
                UPDATE payroll_runs       SET company_id = only_company WHERE company_id IS NULL;
                UPDATE salary_structures  SET company_id = only_company WHERE company_id IS NULL;
            END IF;
        END $$;
    """)

    # Salary structure names were globally unique; scope uniqueness per company.
    op.execute("ALTER TABLE salary_structures DROP CONSTRAINT IF EXISTS salary_structures_name_key")
    op.execute("DROP INDEX IF EXISTS salary_structures_name_key")

    # ── Rescope the holiday uniqueness from global-date to (company, date) ───
    op.execute("ALTER TABLE public_holidays DROP CONSTRAINT IF EXISTS public_holidays_date_key")
    op.execute("DROP INDEX IF EXISTS public_holidays_date_key")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_holiday_company_date'
            ) THEN
                ALTER TABLE public_holidays
                ADD CONSTRAINT uq_holiday_company_date UNIQUE (company_id, date);
            END IF;
        END $$;
    """)


def downgrade():
    op.execute("ALTER TABLE public_holidays DROP CONSTRAINT IF EXISTS uq_holiday_company_date")
    for table, idx in [
        ("vehicles", "idx_veh_company"),
        ("vehicle_assignments", "idx_va_company"),
        ("vehicle_locations", "idx_vl_company"),
        ("job_routines", "idx_jr_company"),
        ("public_holidays", "idx_ph_company"),
        ("salary_structures", "idx_ss_company"),
        ("payroll_runs", "idx_pr_company"),
    ]:
        if _column_exists(table, "company_id"):
            op.execute(f"DROP INDEX IF EXISTS {idx}")
            op.drop_column(table, "company_id")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'public_holidays_date_key'
            ) THEN
                ALTER TABLE public_holidays ADD CONSTRAINT public_holidays_date_key UNIQUE (date);
            END IF;
        END $$;
    """)
