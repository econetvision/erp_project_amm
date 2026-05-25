import os
import base64
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from database import get_db
from models.company import Company
from models.employee import Employee
from models.user import User
from schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse, CompanyStats
from auth.dependencies import require_master, require_admin, get_current_user

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "photos", "companies")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter()


class LogoUploadRequest(BaseModel):
    image: str  # base64-encoded image


@router.get("")
def list_companies(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    search: str = Query("", alias="q"),
    all: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List companies. Master sees all, Admin sees only their company."""
    q = db.query(Company)
    if current_user.role != "master":
        q = q.filter(Company.id == current_user.company_id)
    if search:
        q = q.filter(
            or_(
                Company.name.ilike(f"%{search}%"),
                Company.code.ilike(f"%{search}%"),
                Company.city.ilike(f"%{search}%"),
            )
        )
    if all:
        items = q.order_by(Company.id).all()
        return {
            "items": [CompanyResponse.model_validate(c) for c in items],
            "total": len(items),
            "page": 1,
            "per_page": len(items),
            "pages": 1,
        }
    total = q.count()
    items = q.order_by(Company.id).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [CompanyResponse.model_validate(c) for c in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    }


@router.get("/stats")
def company_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_master),
):
    """Get statistics for all companies (master only)."""
    companies = db.query(Company).all()
    result = []
    for c in companies:
        emp_count = db.query(func.count(Employee.id)).filter(Employee.company_id == c.id).scalar() or 0
        user_count = db.query(func.count(User.id)).filter(User.company_id == c.id).scalar() or 0
        result.append(CompanyStats(
            id=c.id,
            name=c.name,
            code=c.code,
            is_active=c.is_active,
            employee_count=emp_count,
            user_count=user_count,
            active_employees=emp_count,
        ))
    return result


@router.post("", response_model=CompanyResponse, status_code=201)
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_master),
):
    if db.query(Company).filter(Company.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Company code already exists")
    if db.query(Company).filter(Company.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Company name already exists")
    company = Company(**payload.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if current_user.role != "master" and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Access denied to this company")
    return company


@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if current_user.role != "master" and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Access denied to this company")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_master),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()


@router.post("/{company_id}/logo", response_model=CompanyResponse)
def upload_company_logo(
    company_id: int,
    payload: LogoUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if current_user.role != "master" and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Access denied to this company")
    try:
        img_data = payload.image
        if "," in img_data:
            img_data = img_data.split(",", 1)[1]
        img_bytes = base64.b64decode(img_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    if len(img_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB")
    filename = f"company_{company_id}_{uuid.uuid4().hex[:8]}.png"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(img_bytes)
    company.logo_path = f"/uploads/photos/companies/{filename}"
    db.commit()
    db.refresh(company)
    return company


@router.post("/{company_id}/assign-admin")
def assign_admin_to_company(
    company_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_master),
):
    """Assign an existing admin user to a company (master only)."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role not in ("admin",):
        raise HTTPException(status_code=400, detail="Only admin users can be assigned to companies")
    user.company_id = company_id
    db.commit()
    return {"detail": f"User {user.username} assigned to company {company.name}"}
