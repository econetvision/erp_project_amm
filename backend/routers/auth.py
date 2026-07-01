import os
import base64
import uuid
import random
import time
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import get_db
from models.user import User
from schemas.user import (
    LoginRequest, UserCreate, UserUpdate, AdminUserUpdate, UserResponse,
    TokenResponse, PasswordChangeRequest,
)
from auth.dependencies import (
    hash_password, verify_password, create_access_token,
    require_admin, get_current_user, require_any,
)
from services.face_service import identify_employee
from services.license_service import validate_company_license, enforce_seat_limit
from services import storage

router = APIRouter()


class PhotoUploadRequest(BaseModel):
    image: str  # base64-encoded image


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    # Validate the company license for every role below master in the hierarchy.
    if user.role != "master" and user.company_id is not None:
        validate_company_license(db, user.company_id)
    token = create_access_token({"sub": str(user.id), "role": user.role, "company_id": user.company_id})
    return TokenResponse(
        access_token=token,
        role=user.role,
        username=user.username,
        company_id=user.company_id,
        employee_id=user.id,
        email=user.email,
        display_name=user.display_name,
        lock_timeout=user.lock_timeout,
        has_pin=bool(user.pin_hash),
        theme_preference=user.theme_preference,
    )


class FaceLoginRequest(BaseModel):
    image: str  # base64-encoded image


@router.post("/face-login", response_model=TokenResponse)
def face_login(payload: FaceLoginRequest, db: Session = Depends(get_db)):
    candidates = db.query(User).filter(User.face_encoding.isnot(None), User.is_active.is_(True)).all()
    user = identify_employee(payload.image, candidates)
    if not user:
        raise HTTPException(status_code=401, detail="Face not recognized. Please log in with your username and password.")
    if user.role != "master" and user.company_id is not None:
        validate_company_license(db, user.company_id)
    token = create_access_token({"sub": str(user.id), "role": user.role, "company_id": user.company_id})
    return TokenResponse(
        access_token=token,
        role=user.role,
        username=user.username,
        company_id=user.company_id,
        employee_id=user.id,
        email=user.email,
        display_name=user.display_name,
        lock_timeout=user.lock_timeout,
        has_pin=bool(user.pin_hash),
        theme_preference=user.theme_preference,
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password changed successfully"}


@router.post("/me/photo", response_model=UserResponse)
def upload_user_photo(
    payload: PhotoUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any),
):
    try:
        img_data = payload.image
        if "," in img_data:
            img_data = img_data.split(",", 1)[1]
        img_bytes = base64.b64decode(img_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    if len(img_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB")
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.jpg"
    current_user.photo_path = storage.save_image("users", filename, img_bytes, "image/jpeg")
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    search: str = Query("", alias="q"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(User)
    # Non-master users should not see master accounts
    if current_user.role != "master":
        q = q.filter(User.role != "master")
    if search:
        q = q.filter(
            or_(
                User.username.ilike(f"%{search}%"),
                User.display_name.ilike(f"%{search}%"),
                User.role.ilike(f"%{search}%"),
            )
        )
    total = q.count()
    items = q.order_by(User.id).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [UserResponse.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    # Only master can create master users
    if payload.role == "master" and _.role != "master":
        raise HTTPException(status_code=403, detail="Only master users can create master accounts")

    # Company hierarchy: every non-master user must belong to a company.
    #  - Master may assign the new user (including an admin) to any company, but must pick one.
    #  - Admin/supervisor may only add users within their own company.
    if payload.role == "master":
        company_id = None  # master accounts are global, not tied to a company
    elif _.role == "master":
        if not payload.company_id:
            raise HTTPException(status_code=400, detail="Select a company for this user")
        company_id = payload.company_id
    else:
        if _.company_id is None:
            raise HTTPException(status_code=400, detail="Your account is not linked to a company")
        company_id = _.company_id

    # Enforce the company seat limit when adding a seat-consuming (non-master) user.
    if payload.role != "master":
        enforce_seat_limit(db, company_id)
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        company_id=company_id,
        email=payload.email,
        display_name=payload.display_name,
        phone=payload.phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class UnlockRequest(BaseModel):
    password: str = ""
    pin: str = ""


@router.post("/unlock")
def unlock_session(
    payload: UnlockRequest,
    current_user: User = Depends(get_current_user),
):
    """Verify password or PIN to unlock a locked session."""
    if payload.pin and current_user.pin_hash:
        if not verify_password(payload.pin, current_user.pin_hash):
            raise HTTPException(status_code=401, detail="Incorrect PIN")
        return {"detail": "Session unlocked"}
    if payload.password:
        if not verify_password(payload.password, current_user.password_hash):
            raise HTTPException(status_code=401, detail="Incorrect password")
        return {"detail": "Session unlocked"}
    raise HTTPException(status_code=400, detail="Provide password or PIN")


class PinRequest(BaseModel):
    pin: str
    current_password: str


@router.post("/me/pin")
def set_pin(
    payload: PinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.pin) < 4 or len(payload.pin) > 6:
        raise HTTPException(status_code=400, detail="PIN must be 4-6 digits")
    current_user.pin_hash = hash_password(payload.pin)
    db.commit()
    return {"detail": "PIN set successfully"}


@router.delete("/me/pin")
def remove_pin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.pin_hash = None
    db.commit()
    return {"detail": "PIN removed"}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    if current.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


@router.put("/users/{user_id}", response_model=UserResponse)
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = payload.model_dump(exclude_none=True)
    if "password" in update_data:
        user.password_hash = hash_password(update_data.pop("password"))
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


# ---------- Email / Phone Verification ----------

# In-memory store: {user_id: {"type": "email"|"phone", "code": str, "expires": float}}
_verification_codes: dict[int, dict] = {}


class VerifyRequest(BaseModel):
    type: str   # "email" or "phone"


class VerifyCodeRequest(BaseModel):
    type: str   # "email" or "phone"
    code: str


@router.post("/me/send-verification")
def send_verification_code(
    payload: VerifyRequest,
    current_user: User = Depends(get_current_user),
):
    if payload.type not in ("email", "phone"):
        raise HTTPException(status_code=400, detail="type must be 'email' or 'phone'")
    value = current_user.email if payload.type == "email" else current_user.phone
    if not value:
        raise HTTPException(status_code=400, detail=f"No {payload.type} set on your profile")
    code = str(random.randint(100000, 999999))
    _verification_codes[current_user.id] = {
        "type": payload.type,
        "code": code,
        "expires": time.time() + 300,  # 5 minutes
    }
    # TODO: integrate real email/SMS provider
    return {"detail": f"Verification code sent to your {payload.type}", "debug_code": code}


@router.post("/me/verify")
def verify_code(
    payload: VerifyCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stored = _verification_codes.get(current_user.id)
    if not stored or stored["type"] != payload.type:
        raise HTTPException(status_code=400, detail="No verification pending")
    if time.time() > stored["expires"]:
        _verification_codes.pop(current_user.id, None)
        raise HTTPException(status_code=400, detail="Verification code expired")
    if stored["code"] != payload.code:
        raise HTTPException(status_code=400, detail="Invalid code")
    _verification_codes.pop(current_user.id, None)
    return {"detail": f"{payload.type} verified successfully"}
