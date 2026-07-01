import os
import base64
import uuid
import random
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import get_db
from models.user import User
from schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    EmployeeCreateResponse, WorkLocationUpdateSchema
)
from services.face_service import get_face_encoding
from auth.dependencies import require_admin_or_supervisor, require_admin, get_current_user
from config.settings import settings
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "photos", "employees")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter()


def _generate_employee_code(db: Session, company_id: int | None) -> str:
    prefix = "EMP"
    if company_id:
        from models.company import Company
        company = db.query(Company).filter(Company.id == company_id).first()
        if company:
            letters = re.sub(r"[^A-Za-z]", "", company.name).upper()
            prefix = letters[:5] or "EMP"
    for _ in range(20):
        code = f"{prefix}-{random.randint(10000, 99999)}"
        if not db.query(User).filter(User.employee_code == code).first():
            return code
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


class FaceRegisterRequest(BaseModel):
    image: str  # base64-encoded image


@router.get("")
def list_employees(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    search: str = Query("", alias="q"),
    all: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_supervisor),
):
    # Supervisors can only see workers, admins/masters can see both workers and supervisors
    if current_user.role == "supervisor":
        q = db.query(User).filter(User.role == "worker")
    else:
        q = db.query(User).filter(User.role.in_(["worker", "supervisor"]))
    if search:
        q = q.filter(
            or_(
                User.name.ilike(f"%{search}%"),
                User.aadhar_number.ilike(f"%{search}%"),
                User.bank_account_number.ilike(f"%{search}%"),
            )
        )
    if all:
        items = q.order_by(User.id).all()
        return {
            "items": [EmployeeResponse.model_validate(e) for e in items],
            "total": len(items),
            "page": 1,
            "per_page": len(items),
            "pages": 1,
        }
    total = q.count()
    items = q.order_by(User.id).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [EmployeeResponse.model_validate(e) for e in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


@router.post("", status_code=201)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin_or_supervisor)):
    """Create a new employee with auto-generated login credentials.

    Returns the generated username and password so admin can share with the employee.
    The employee can then login via the mobile app or web portal.
    """
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=422, detail="Employee name is required")
    existing = db.query(User).filter(User.aadhar_number == payload.aadhar_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Aadhar number already registered")

    data = payload.model_dump()

    # Auto-generate username and password for new employee user
    username = data.pop("username", None) or f"emp_{data['aadhar_number']}"
    password = data.pop("password", None) or data["aadhar_number"][-4:] + "1234"
    role = data.pop("role", None) or "worker"
    company_id = data.pop("company_id", None) or current_user.company_id

    # Supervisors can only create workers
    if current_user.role == "supervisor" and role != "worker":
        raise HTTPException(status_code=403, detail="Supervisors can only create workers")

    # Check username uniqueness
    if db.query(User).filter(User.username == username).first():
        username = f"emp_{uuid.uuid4().hex[:8]}"

    emp = User(
        username=username,
        password_hash=pwd_context.hash(password),
        role=role,
        company_id=company_id,
        employee_code=_generate_employee_code(db, company_id),
        onboarding_complete=False,
        **data,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)

    # Return response with generated credentials
    return {
        "id": emp.id,
        "username": username,
        "generated_password": password,  # Only shown on creation!
        "role": emp.role,
        "company_id": emp.company_id,
        "name": emp.name,
        "aadhar_number": emp.aadhar_number,
        "onboarding_complete": emp.onboarding_complete,
        "created_at": emp.created_at,
        "message": f"Employee created successfully. Login credentials: Username: {username}, Password: {password}"
    }


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin_or_supervisor)):
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Supervisors can only view workers (not other supervisors)
    if current_user.role == "supervisor" and emp.role != "worker":
        raise HTTPException(status_code=403, detail="Supervisors can only view workers")

    return emp


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: int, payload: EmployeeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Full update of employee - Admin only.

    Supervisors should use PATCH /employees/{id}/work-location for work location updates.
    """
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=422, detail="Employee name is required")
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    data = payload.model_dump(exclude={"username", "password", "role", "company_id"})
    for key, value in data.items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return emp


@router.patch("/{employee_id}", response_model=EmployeeResponse)
def partial_update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Partial update of employee - Admin only.

    Supervisors should use PATCH /employees/{id}/work-location for work location updates.
    """
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return emp


@router.patch("/{employee_id}/work-location", response_model=EmployeeResponse)
def update_employee_work_location(
    employee_id: int,
    payload: WorkLocationUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_supervisor)
):
    """Update employee work location - Available to Admin and Supervisor.

    Supervisors can only update work location for workers, not other supervisors.
    """
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Supervisors can only edit workers
    if current_user.role == "supervisor" and emp.role != "worker":
        raise HTTPException(status_code=403, detail="Supervisors can only edit work location for workers")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Delete employee - Admin only."""
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if emp.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    db.delete(emp)
    db.commit()


@router.post("/{employee_id}/face", response_model=EmployeeResponse)
def register_face(employee_id: int, payload: FaceRegisterRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin_or_supervisor)):
    """Register employee face for biometric attendance.

    This is a critical step in employee onboarding. Once face is registered,
    the employee can use face scan for attendance and login.
    """
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Supervisors can only register faces for workers
    if current_user.role == "supervisor" and emp.role != "worker":
        raise HTTPException(status_code=403, detail="Supervisors can only register faces for workers")

    emp.face_encoding = get_face_encoding(payload.image)
    # Save photo as file instead of base64
    try:
        img_data = payload.image
        if "," in img_data:
            img_data = img_data.split(",", 1)[1]
        img_bytes = base64.b64decode(img_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    if len(img_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB")
    filename = f"{employee_id}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(img_bytes)
    emp.photo = f"/uploads/photos/employees/{filename}"

    # Mark onboarding as complete once face is registered
    emp.onboarding_complete = True

    db.commit()
    db.refresh(emp)
    return emp


@router.get("/{employee_id}/ifsc-lookup")
async def ifsc_lookup(employee_id: int, ifsc: str, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    from services.kyc_service import lookup_ifsc
    return await lookup_ifsc(ifsc)


@router.post("/{employee_id}/verify-bank", response_model=EmployeeResponse)
async def verify_bank_account_endpoint(
    employee_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_supervisor),
):
    from services.kyc_service import verify_bank_account
    import os
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not emp.ifsc_code:
        raise HTTPException(status_code=400, detail="IFSC code is required for bank verification")
    
    result = await verify_bank_account(
        bank_account=emp.bank_account_number,
        ifsc_code=emp.ifsc_code,
        account_holder_name=emp.name,
        provider=settings.kyc_provider,
        api_key=settings.kyc_api_key or None,
        api_secret=settings.kyc_api_secret or None,
    )
    emp.kyc_status = result["status"]
    emp.kyc_verified_name = result.get("registered_name")
    db.commit()
    db.refresh(emp)
    return emp


# ── Twilio Phone/Email Verification ──────────────────────────────────────────

class OTPRequest(BaseModel):
    code: str


@router.post("/{employee_id}/send-phone-otp")
def send_phone_verification(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    """Send OTP to employee's phone number via Twilio."""
    from services.twilio_service import send_phone_otp
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not emp.phone:
        raise HTTPException(status_code=400, detail="Employee phone number is not set")
    result = send_phone_otp(emp.phone)
    if result.get("status") == "error":
        raise HTTPException(status_code=502, detail=result.get("message", "Failed to send OTP"))
    return {"detail": "OTP sent to phone", "status": result["status"]}


@router.post("/{employee_id}/verify-phone", response_model=EmployeeResponse)
def verify_phone(employee_id: int, payload: OTPRequest, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    """Verify phone OTP and mark phone as verified."""
    from services.twilio_service import verify_phone_otp
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not emp.phone:
        raise HTTPException(status_code=400, detail="Employee phone number is not set")
    result = verify_phone_otp(emp.phone, payload.code)
    if not result.get("valid"):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    emp.phone_verified = "Y"
    db.commit()
    db.refresh(emp)
    return emp


@router.post("/{employee_id}/send-email-otp")
def send_email_verification(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    """Send OTP to employee's email via Twilio."""
    from services.twilio_service import send_email_otp
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not emp.email:
        raise HTTPException(status_code=400, detail="Employee email is not set")
    result = send_email_otp(emp.email)
    if result.get("status") == "error":
        raise HTTPException(status_code=502, detail=result.get("message", "Failed to send OTP"))
    return {"detail": "OTP sent to email", "status": result["status"]}


@router.post("/{employee_id}/verify-email", response_model=EmployeeResponse)
def verify_email(employee_id: int, payload: OTPRequest, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    """Verify email OTP and mark email as verified."""
    from services.twilio_service import verify_email_otp
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not emp.email:
        raise HTTPException(status_code=400, detail="Employee email is not set")
    result = verify_email_otp(emp.email, payload.code)
    if not result.get("valid"):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    emp.email_verified = "Y"
    db.commit()
    db.refresh(emp)
    return emp


# ── Work Location Assignment ─────────────────────────────────────────────────

class WorkLocationAssignment(BaseModel):
    work_location_name: str
    work_latitude: float
    work_longitude: float
    attendance_radius_m: float = 50.0


@router.put("/{employee_id}/work-location", response_model=EmployeeResponse)
def assign_work_location(employee_id: int, payload: WorkLocationAssignment, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    """Assign or update work location for an User."""
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.work_location_name = payload.work_location_name
    emp.work_latitude = payload.work_latitude
    emp.work_longitude = payload.work_longitude
    emp.attendance_radius_m = payload.attendance_radius_m
    db.commit()
    db.refresh(emp)
    return emp
