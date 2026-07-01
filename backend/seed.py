from database import SessionLocal
from models.user import User
from models.company import Company
from models.rbac import Permission, Role, RolePermission
from auth.dependencies import hash_password
from sqlalchemy.exc import IntegrityError


DEFAULT_PERMISSIONS = [
    ("attendance.view", "View Attendance", "attendance"),
    ("attendance.create", "Mark Attendance", "attendance"),
    ("attendance.manage", "Manage Attendance", "attendance"),
    ("employees.view", "View Employees", "employees"),
    ("employees.view_workers", "View Workers Only", "employees"),  # For supervisors
    ("employees.create", "Create Employees", "employees"),
    ("employees.edit", "Edit Employees", "employees"),
    ("employees.edit_location", "Edit Work Location", "employees"),  # For supervisors
    ("employees.delete", "Delete Employees", "employees"),
    ("users.view", "View Users", "users"),
    ("users.create", "Create Users", "users"),
    ("users.edit", "Edit Users", "users"),
    ("users.delete", "Delete Users", "users"),
    ("payroll.view", "View Payroll", "payroll"),
    ("payroll.generate", "Generate Payroll", "payroll"),
    ("payroll.approve", "Approve Payroll", "payroll"),
    ("payslips.view", "View Payslips", "payslips"),
    ("payslips.generate", "Generate Payslips", "payslips"),
    ("vehicles.view", "View Vehicles", "vehicles"),
    ("vehicles.manage", "Manage Vehicles", "vehicles"),
    ("tracking.view", "View Tracking", "tracking"),
    ("tracking.assign", "Assign Vehicles", "tracking"),
    ("jobs.view", "View Jobs", "jobs"),
    ("jobs.manage", "Manage Jobs", "jobs"),
    ("jobs.assign", "Assign Jobs", "jobs"),
    ("company.view", "View Company", "company"),
    ("company.manage", "Manage Company", "company"),
    ("locations.view", "View Locations", "locations"),
    ("locations.manage", "Manage Locations", "locations"),
    ("holidays.view", "View Holidays", "holidays"),
    ("holidays.manage", "Manage Holidays", "holidays"),
    ("notifications.view", "View Notifications", "notifications"),
    ("reports.view", "View Reports", "reports"),
    ("settings.view", "View Settings", "settings"),
    ("settings.manage", "Manage Settings", "settings"),
]


def seed():
    db = SessionLocal()
    try:
        # ── Seed default company ─────────────────────────────────────────
        default_company = db.query(Company).filter(Company.code == "DEFAULT").first()
        if not default_company:
            try:
                default_company = Company(
                    name="Default Company",
                    code="DEFAULT",
                    country="India",
                    timezone="Asia/Kolkata",
                    currency="INR",
                    is_active=True,
                    features={"payroll": True, "vehicles": True, "attendance_face": True, "jobs": True},
                    payroll_config={"esi_rate": 0.75, "pf_rate": 12.0, "working_days": 26, "overtime_multiplier": 1.5},
                )
                db.add(default_company)
                db.flush()
                print(f"Default company created: {default_company.name}")
            except IntegrityError:
                db.rollback()
                default_company = db.query(Company).filter(Company.code == "DEFAULT").first()

        # ── Seed permissions ─────────────────────────────────────────────
        for code, name, module in DEFAULT_PERMISSIONS:
            if not db.query(Permission).filter(Permission.code == code).first():
                db.add(Permission(code=code, name=name, module=module))
        try:
            db.flush()
        except IntegrityError:
            db.rollback()

        # ── Seed system roles ────────────────────────────────────────────
        system_roles = {
            "master": "Global system master with full access",
            "admin": "Company administrator",
            "supervisor": "Team supervisor",
            "worker": "Regular worker with self-service access",
        }
        for role_name, desc in system_roles.items():
            existing = db.query(Role).filter(
                Role.name == role_name, Role.company_id.is_(None), Role.is_system == True
            ).first()
            if not existing:
                db.add(Role(name=role_name, company_id=None, is_system=True, description=desc))
        try:
            db.flush()
        except IntegrityError:
            db.rollback()

        # ── Assign permissions to system roles ───────────────────────────
        admin_role = db.query(Role).filter(Role.name == "admin", Role.is_system == True).first()
        if admin_role:
            all_perms = db.query(Permission).all()
            existing_admin_perms = {rp.permission_id for rp in db.query(RolePermission).filter(RolePermission.role_id == admin_role.id).all()}
            for p in all_perms:
                if p.id not in existing_admin_perms:
                    db.add(RolePermission(role_id=admin_role.id, permission_id=p.id))
            try:
                db.flush()
            except IntegrityError:
                db.rollback()

        supervisor_role = db.query(Role).filter(Role.name == "supervisor", Role.is_system == True).first()
        # Supervisors have limited permissions:
        # - Can view workers (not other supervisors)
        # - Can create workers
        # - Can only edit work location (not full employee details)
        # - Can manage attendance for their workers
        supervisor_perms = [
            "attendance.view", "attendance.create", "attendance.manage",
            "employees.view_workers",  # Can only view workers, not supervisors
            "employees.create",        # Can create new workers
            "employees.edit_location", # Can only edit work location
            "vehicles.view", "tracking.view",
            "jobs.view", "locations.view",
            "holidays.view", "notifications.view", "reports.view",
        ]
        if supervisor_role:
            existing_sup_perms = {rp.permission_id for rp in db.query(RolePermission).filter(RolePermission.role_id == supervisor_role.id).all()}
            for code in supervisor_perms:
                p = db.query(Permission).filter(Permission.code == code).first()
                if p and p.id not in existing_sup_perms:
                    db.add(RolePermission(role_id=supervisor_role.id, permission_id=p.id))

        worker_role = db.query(Role).filter(Role.name == "worker", Role.is_system == True).first()
        worker_perms = ["attendance.view", "attendance.create", "notifications.view", "settings.view"]
        if worker_role:
            existing_wkr_perms = {rp.permission_id for rp in db.query(RolePermission).filter(RolePermission.role_id == worker_role.id).all()}
            for code in worker_perms:
                p = db.query(Permission).filter(Permission.code == code).first()
                if p and p.id not in existing_wkr_perms:
                    db.add(RolePermission(role_id=worker_role.id, permission_id=p.id))

        try:
            db.flush()
        except IntegrityError:
            db.rollback()

        # ── Seed master user ────────────────────────────────────────────
        if not db.query(User).filter(User.username == "master").first():
            try:
                master = User(
                    username="master",
                    password_hash=hash_password("master123"),
                    role="master",
                    display_name="System Master",
                    company_id=None,
                )
                db.add(master)
                db.flush()
                print("Master user created: master / master123")
            except IntegrityError:
                db.rollback()

        # ── Seed admin user (assign to default company) ──────────────────
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            try:
                admin = User(
                    username="admin",
                    password_hash=hash_password("admin123"),
                    role="admin",
                    company_id=default_company.id,
                )
                db.add(admin)
                db.flush()
                print("Admin user created: admin / admin123")
            except IntegrityError:
                db.rollback()
                admin = db.query(User).filter(User.username == "admin").first()
        if admin and admin.company_id is None:
            admin.company_id = default_company.id
            print(f"Admin user assigned to company: {default_company.name}")

        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
