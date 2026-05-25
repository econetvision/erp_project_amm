from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import get_db
from models.user import User
from models.rbac import Permission, Role, RolePermission, AuditLog
from schemas.rbac import (
    PermissionResponse, RoleCreate, RoleUpdate, RoleResponse, AuditLogResponse,
)
from auth.dependencies import require_master, require_admin, get_current_user

router = APIRouter()


# ── Permissions ──────────────────────────────────────────────────────────────
@router.get("/permissions")
def list_permissions(
    module: str = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = db.query(Permission)
    if module:
        q = q.filter(Permission.module == module)
    perms = q.order_by(Permission.module, Permission.code).all()
    return [PermissionResponse.model_validate(p) for p in perms]


@router.get("/permissions/modules")
def list_permission_modules(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    modules = db.query(Permission.module).distinct().order_by(Permission.module).all()
    return [m[0] for m in modules]


# ── Roles ────────────────────────────────────────────────────────────────────
@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(Role)
    if current_user.role != "master":
        q = q.filter(
            (Role.company_id == current_user.company_id) | (Role.company_id.is_(None))
        )
    roles = q.order_by(Role.name).all()
    result = []
    for role in roles:
        perms = db.query(Permission).join(
            RolePermission, RolePermission.permission_id == Permission.id
        ).filter(RolePermission.role_id == role.id).all()
        role_data = RoleResponse(
            id=role.id,
            name=role.name,
            company_id=role.company_id,
            is_system=role.is_system,
            description=role.description,
            permissions=[PermissionResponse.model_validate(p) for p in perms],
            created_at=role.created_at,
        )
        result.append(role_data)
    return result


@router.post("/roles", status_code=201)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Non-master users can only create roles for their company
    company_id = payload.company_id
    if current_user.role != "master":
        company_id = current_user.company_id
    existing = db.query(Role).filter(
        Role.name == payload.name,
        Role.company_id == company_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Role already exists")
    role = Role(
        name=payload.name,
        company_id=company_id,
        description=payload.description,
    )
    db.add(role)
    db.flush()
    # Add permissions
    for perm_id in payload.permissions:
        db.add(RolePermission(role_id=role.id, permission_id=perm_id))
    db.commit()
    db.refresh(role)
    return {"id": role.id, "name": role.name, "detail": "Role created"}


@router.put("/roles/{role_id}")
def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system and current_user.role != "master":
        raise HTTPException(status_code=403, detail="System roles can only be modified by master")
    if current_user.role != "master" and role.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if payload.name:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description
    if payload.permissions is not None:
        db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
        for perm_id in payload.permissions:
            db.add(RolePermission(role_id=role.id, permission_id=perm_id))
    db.commit()
    return {"detail": "Role updated"}


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    if current_user.role != "master" and role.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(role)
    db.commit()


# ── Audit Logs ───────────────────────────────────────────────────────────────
@router.get("/audit-logs")
def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    entity_type: str = Query(None),
    action: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(AuditLog)
    if current_user.role != "master":
        q = q.filter(AuditLog.company_id == current_user.company_id)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    items = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [AuditLogResponse.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }
