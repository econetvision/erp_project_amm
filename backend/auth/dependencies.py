from datetime import datetime, timedelta
from typing import Optional, List
import os
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from models.user import User

SECRET_KEY  = os.getenv("SECRET_KEY", "erp-secret-key-change-in-production")
ALGORITHM   = "HS256"
TOKEN_EXPIRY_HOURS = 12

VALID_ROLES = ("master", "admin", "supervisor", "worker")
ROLE_HIERARCHY = {"master": 0, "admin": 1, "supervisor": 2, "worker": 3}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id  = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise credentials_exception
    return user


# ── Role guards ────────────────────────────────────────────────────────────
def require_master(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "master":
        raise HTTPException(status_code=403, detail="Master access required")
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "master"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_admin_or_supervisor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "supervisor", "master"):
        raise HTTPException(status_code=403, detail="Admin or Supervisor access required")
    return current_user


def require_any(current_user: User = Depends(get_current_user)) -> User:
    return current_user


def require_role(*allowed_roles: str):
    """Factory for role-based access control dependency."""
    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        # Master always has access
        if current_user.role == "master":
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access requires one of: {', '.join(allowed_roles)}"
            )
        return current_user
    return _dependency


def require_permission(*permission_codes: str):
    """Factory for permission-based access control dependency."""
    def _dependency(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        # Master always has full access
        if current_user.role == "master":
            return current_user
        from models.rbac import Role, RolePermission, Permission
        # Check if user's role has the needed permissions
        role_obj = db.query(Role).filter(
            Role.name == current_user.role,
            ((Role.company_id == current_user.company_id) | (Role.company_id.is_(None)))
        ).first()
        if not role_obj:
            raise HTTPException(status_code=403, detail="No role assigned")
        granted = db.query(Permission.code).join(
            RolePermission, RolePermission.permission_id == Permission.id
        ).filter(RolePermission.role_id == role_obj.id).all()
        granted_codes = {p[0] for p in granted}
        if not any(pc in granted_codes for pc in permission_codes):
            raise HTTPException(
                status_code=403,
                detail=f"Missing permission: {', '.join(permission_codes)}"
            )
        return current_user
    return _dependency


def get_tenant_company_id(current_user: User = Depends(get_current_user), request: Request = None) -> Optional[int]:
    """Extract the effective company_id for multi-tenant filtering.
    Master users can pass ?company_id=X or X-Company-Id header.
    Admin/Supervisor/Worker are always scoped to their own company_id.
    """
    if current_user.role == "master":
        # Master can specify which company to operate on
        if request:
            company_id = request.query_params.get("company_id") or request.headers.get("x-company-id")
            if company_id:
                return int(company_id)
        return None  # None = all companies for master
    return current_user.company_id
