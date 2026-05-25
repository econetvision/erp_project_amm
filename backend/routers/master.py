from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.user import User
from models.user import User
from models.company import Company
from models.attendance import Attendance
from models.rbac import AuditLog
from auth.dependencies import require_master, get_current_user

router = APIRouter()


@router.get("/overview")
def master_overview(
    db: Session = Depends(get_db),
    _: User = Depends(require_master),
):
    """Master dashboard overview — cross-company analytics."""
    total_companies = db.query(func.count(Company.id)).scalar() or 0
    active_companies = db.query(func.count(Company.id)).filter(Company.is_active == True).scalar() or 0
    total_employees = db.query(func.count(User.id)).scalar() or 0
    total_users = db.query(func.count(User.id)).scalar() or 0

    # Users by role
    role_counts = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    users_by_role = {role: count for role, count in role_counts}

    # Employees per company
    emp_per_company = db.query(
        Company.name, func.count(User.id)
    ).outerjoin(User, User.company_id == Company.id).group_by(Company.name).all()
    employees_by_company = [{"company": name, "count": count} for name, count in emp_per_company]

    # Recent audit logs
    recent_logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()
    logs_data = [
        {
            "id": l.id,
            "action": l.action,
            "entity_type": l.entity_type,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in recent_logs
    ]

    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "total_employees": total_employees,
        "total_users": total_users,
        "users_by_role": users_by_role,
        "employees_by_company": employees_by_company,
        "recent_audit_logs": logs_data,
    }


@router.get("/companies-summary")
def companies_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_master),
):
    """Summary of all companies with stats."""
    companies = db.query(Company).order_by(Company.name).all()
    result = []
    for c in companies:
        emp_count = db.query(func.count(User.id)).filter(User.company_id == c.id).scalar() or 0
        user_count = db.query(func.count(User.id)).filter(User.company_id == c.id).scalar() or 0
        admin_count = db.query(func.count(User.id)).filter(
            User.company_id == c.id, User.role == "admin"
        ).scalar() or 0
        result.append({
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "is_active": c.is_active,
            "employee_count": emp_count,
            "user_count": user_count,
            "admin_count": admin_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return result


@router.post("/impersonate/{user_id}")
def impersonate_user(
    user_id: int,
    db: Session = Depends(get_db),
    master_user: User = Depends(require_master),
):
    """Master impersonates another user for support purposes."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "master":
        raise HTTPException(status_code=400, detail="Cannot impersonate another master user")
    from auth.dependencies import create_access_token
    token = create_access_token({
        "sub": str(target.id),
        "role": target.role,
        "company_id": target.company_id,
        "impersonated_by": master_user.id,
    })
    # Log the impersonation
    audit = AuditLog(
        user_id=master_user.id,
        company_id=target.company_id,
        action="impersonate",
        entity_type="user",
        entity_id=target.id,
        details=f"Master {master_user.username} impersonated {target.username}",
    )
    db.add(audit)
    db.commit()
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": target.role,
        "username": target.username,
        "company_id": target.company_id,
        "display_name": target.display_name,
        "impersonated": True,
    }
