"""Add multi-tenant support: companies, RBAC, audit logs, master role

Revision ID: 0010_multi_tenant
Revises: 0009_add_missing_updated_at
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.dialects.postgresql import JSONB

revision = "0010_multi_tenant"
down_revision = "0009_add_missing_updated_at"
branch_labels = None
depends_on = None


def _table_exists(name):
    return sa_inspect(op.get_bind()).has_table(name)


def _column_exists(table, column):
    cols = [c["name"] for c in sa_inspect(op.get_bind()).get_columns(table)]
    return column in cols


def upgrade():
    # ── Companies table ──────────────────────────────────────────────────────
    if not _table_exists("companies"):
        op.create_table(
            "companies",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("name", sa.String(255), nullable=False, unique=True),
            sa.Column("code", sa.String(50), nullable=False, unique=True),
            sa.Column("logo_path", sa.String(500)),
            sa.Column("address", sa.Text),
            sa.Column("city", sa.String(100)),
            sa.Column("state", sa.String(100)),
            sa.Column("country", sa.String(100), server_default="India"),
            sa.Column("pincode", sa.String(10)),
            sa.Column("phone", sa.String(20)),
            sa.Column("email", sa.String(255)),
            sa.Column("website", sa.String(255)),
            sa.Column("gst_number", sa.String(20)),
            sa.Column("pan_number", sa.String(10)),
            sa.Column("timezone", sa.String(50), server_default="Asia/Kolkata"),
            sa.Column("currency", sa.String(10), server_default="INR"),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
            sa.Column("theme_config", JSONB),
            sa.Column("payroll_config", JSONB),
            sa.Column("attendance_config", JSONB),
            sa.Column("features", JSONB),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # ── Permissions table ────────────────────────────────────────────────────
    if not _table_exists("permissions"):
        op.create_table(
            "permissions",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("code", sa.String(100), nullable=False, unique=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("module", sa.String(50), nullable=False),
            sa.Column("description", sa.Text),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # ── Roles table ──────────────────────────────────────────────────────────
    if not _table_exists("roles"):
        op.create_table(
            "roles",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("name", sa.String(50), nullable=False),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE")),
            sa.Column("is_system", sa.Boolean, nullable=False, server_default="false"),
            sa.Column("description", sa.Text),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("name", "company_id", name="uq_role_name_company"),
        )

    # ── Role Permissions table ───────────────────────────────────────────────
    if not _table_exists("role_permissions"):
        op.create_table(
            "role_permissions",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("role_id", sa.Integer, sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
            sa.Column("permission_id", sa.Integer, sa.ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False),
            sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
        )

    # ── Audit Logs table ─────────────────────────────────────────────────────
    if not _table_exists("audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="SET NULL")),
            sa.Column("action", sa.String(50), nullable=False),
            sa.Column("entity_type", sa.String(50)),
            sa.Column("entity_id", sa.Integer),
            sa.Column("details", sa.Text),
            sa.Column("ip_address", sa.String(45)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs (company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at)")

    # ── Add company_id to users ──────────────────────────────────────────────
    if not _column_exists("users", "company_id"):
        op.add_column("users", sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="SET NULL")))
    if not _column_exists("users", "is_active"):
        op.add_column("users", sa.Column("is_active", sa.Boolean, server_default="true"))

    # ── Update role constraint to allow 'master' ─────────────────────────────
    # Drop old CHECK constraint if it exists (PostgreSQL)
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT users_role_check "
        "CHECK (role IN ('master','admin','supervisor','worker'))"
    )

    # ── Add company_id to employees ──────────────────────────────────────────
    if _table_exists("employees") and not _column_exists("employees", "company_id"):
        op.add_column("employees", sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="SET NULL")))
    if _table_exists("employees"):
        op.execute("CREATE INDEX IF NOT EXISTS idx_employees_company ON employees (company_id)")

    # ── Seed default permissions ─────────────────────────────────────────────
    permissions = [
        # Attendance
        ("attendance.view", "View Attendance", "attendance", "View attendance records"),
        ("attendance.create", "Mark Attendance", "attendance", "Mark attendance entries"),
        ("attendance.manage", "Manage Attendance", "attendance", "Edit/delete attendance records"),
        # Employees
        ("employees.view", "View Employees", "employees", "View employee list"),
        ("employees.create", "Create Employees", "employees", "Add new employees"),
        ("employees.edit", "Edit Employees", "employees", "Modify employee records"),
        ("employees.delete", "Delete Employees", "employees", "Remove employees"),
        # Users
        ("users.view", "View Users", "users", "View user accounts"),
        ("users.create", "Create Users", "users", "Create user accounts"),
        ("users.edit", "Edit Users", "users", "Modify user accounts"),
        ("users.delete", "Delete Users", "users", "Delete user accounts"),
        # Payroll
        ("payroll.view", "View Payroll", "payroll", "View payroll data"),
        ("payroll.generate", "Generate Payroll", "payroll", "Run payroll generation"),
        ("payroll.approve", "Approve Payroll", "payroll", "Approve payroll runs"),
        # Payslips
        ("payslips.view", "View Payslips", "payslips", "View payslip records"),
        ("payslips.generate", "Generate Payslips", "payslips", "Generate payslips"),
        # Vehicles
        ("vehicles.view", "View Vehicles", "vehicles", "View vehicle fleet"),
        ("vehicles.manage", "Manage Vehicles", "vehicles", "Add/edit/delete vehicles"),
        # Tracking
        ("tracking.view", "View Tracking", "tracking", "View live tracking"),
        ("tracking.assign", "Assign Vehicles", "tracking", "Assign vehicles to employees"),
        # Jobs
        ("jobs.view", "View Jobs", "jobs", "View job routines"),
        ("jobs.manage", "Manage Jobs", "jobs", "Create/edit/delete jobs"),
        ("jobs.assign", "Assign Jobs", "jobs", "Assign workers to jobs"),
        # Company
        ("company.view", "View Company", "company", "View company settings"),
        ("company.manage", "Manage Company", "company", "Edit company settings"),
        # Locations
        ("locations.view", "View Locations", "locations", "View work locations"),
        ("locations.manage", "Manage Locations", "locations", "Add/edit/delete locations"),
        # Holidays
        ("holidays.view", "View Holidays", "holidays", "View holidays"),
        ("holidays.manage", "Manage Holidays", "holidays", "Add/remove holidays"),
        # Notifications
        ("notifications.view", "View Notifications", "notifications", "View notifications"),
        # Reports
        ("reports.view", "View Reports", "reports", "View analytics and reports"),
        # Settings
        ("settings.view", "View Settings", "settings", "View settings"),
        ("settings.manage", "Manage Settings", "settings", "Modify settings"),
    ]
    for code, name, module, desc in permissions:
        op.execute(
            f"INSERT INTO permissions (code, name, module, description) "
            f"VALUES ('{code}', '{name}', '{module}', '{desc}') "
            f"ON CONFLICT (code) DO NOTHING"
        )

    # ── Seed system roles ────────────────────────────────────────────────────
    op.execute(
        "INSERT INTO roles (name, company_id, is_system, description) "
        "VALUES ('master', NULL, true, 'Global system master with full access') "
        "ON CONFLICT DO NOTHING"
    )
    op.execute(
        "INSERT INTO roles (name, company_id, is_system, description) "
        "VALUES ('admin', NULL, true, 'Company administrator') "
        "ON CONFLICT DO NOTHING"
    )
    op.execute(
        "INSERT INTO roles (name, company_id, is_system, description) "
        "VALUES ('supervisor', NULL, true, 'Team supervisor') "
        "ON CONFLICT DO NOTHING"
    )
    op.execute(
        "INSERT INTO roles (name, company_id, is_system, description) "
        "VALUES ('worker', NULL, true, 'Regular worker with self-service access') "
        "ON CONFLICT DO NOTHING"
    )

    # Grant all permissions to admin role
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name = 'admin' AND r.is_system = true
        ON CONFLICT DO NOTHING
    """)

    # Grant limited permissions to supervisor role
    supervisor_perms = [
        "attendance.view", "attendance.create", "attendance.manage",
        "employees.view", "employees.create", "employees.edit",
        "vehicles.view", "tracking.view", "tracking.assign",
        "jobs.view", "jobs.assign", "locations.view",
        "holidays.view", "notifications.view", "reports.view",
    ]
    for perm_code in supervisor_perms:
        op.execute(f"""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r, permissions p
            WHERE r.name = 'supervisor' AND r.is_system = true AND p.code = '{perm_code}'
            ON CONFLICT DO NOTHING
        """)

    # Grant minimal permissions to worker role
    worker_perms = [
        "attendance.view", "attendance.create",
        "notifications.view", "settings.view",
    ]
    for perm_code in worker_perms:
        op.execute(f"""
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r, permissions p
            WHERE r.name = 'worker' AND r.is_system = true AND p.code = '{perm_code}'
            ON CONFLICT DO NOTHING
        """)


def downgrade():
    op.drop_index("idx_employees_company", "employees")
    op.drop_column("employees", "company_id")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check")
    op.execute(
        "ALTER TABLE users ADD CONSTRAINT users_role_check "
        "CHECK (role IN ('admin','supervisor','worker'))"
    )
    op.drop_column("users", "is_active")
    op.drop_column("users", "company_id")
    op.drop_table("audit_logs")
    op.drop_table("role_permissions")
    op.drop_table("roles")
    op.drop_table("permissions")
    op.drop_table("companies")
