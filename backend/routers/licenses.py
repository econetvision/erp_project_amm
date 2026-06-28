import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.company import Company
from models.license import CompanyLicense
from models.rbac import AuditLog
from schemas.license import LicenseCreate, LicenseUpdate, LicenseResponse
from services.license_service import (
    evaluate_license, count_active_seats, send_license_activated_email,
)
from auth.dependencies import require_master, require_admin

router = APIRouter()


def _to_response(db: Session, license: CompanyLicense) -> LicenseResponse:
    """Serialize a license with derived validity / seat usage fields."""
    _, reason = evaluate_license(db, license.company_id, check_seats=True)
    resp = LicenseResponse.model_validate(license)
    resp.seats_used = count_active_seats(db, license.company_id)
    resp.is_valid = reason is None
    resp.reason = reason
    return resp


@router.get("", response_model=list[LicenseResponse])
def list_licenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Master sees all licenses; admin sees only their own company's license."""
    q = db.query(CompanyLicense)
    if current_user.role != "master":
        q = q.filter(CompanyLicense.company_id == current_user.company_id)
    return [_to_response(db, lic) for lic in q.order_by(CompanyLicense.company_id).all()]


@router.get("/my", response_model=LicenseResponse)
def my_license(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Current user's company license + validity, so a blocked admin can see the reason."""
    if current_user.company_id is None:
        raise HTTPException(status_code=404, detail="User is not assigned to a company")
    license = db.query(CompanyLicense).filter(
        CompanyLicense.company_id == current_user.company_id
    ).first()
    if not license:
        raise HTTPException(status_code=404, detail="No license issued for this company")
    return _to_response(db, license)


@router.post("", response_model=LicenseResponse, status_code=201)
def issue_license(
    payload: LicenseCreate,
    db: Session = Depends(get_db),
    master_user: User = Depends(require_master),
):
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if db.query(CompanyLicense).filter(CompanyLicense.company_id == payload.company_id).first():
        raise HTTPException(status_code=400, detail="Company already has a license")
    license = CompanyLicense(
        company_id=payload.company_id,
        license_key=payload.license_key or secrets.token_urlsafe(32),
        tier=payload.tier,
        status=payload.status,
        max_seats=payload.max_seats,
        valid_until=payload.valid_until,
        features=payload.features,
        notes=payload.notes,
    )
    db.add(license)
    db.flush()
    db.add(AuditLog(
        user_id=master_user.id,
        company_id=payload.company_id,
        action="create",
        entity_type="license",
        entity_id=license.id,
        details=f"Master {master_user.username} issued {license.tier} license for company {company.name}",
    ))
    db.commit()
    db.refresh(license)
    # Notify the company that their license is active (best-effort).
    if license.status == "active":
        send_license_activated_email(db, license, company)
    return _to_response(db, license)


@router.put("/{license_id}", response_model=LicenseResponse)
def update_license(
    license_id: int,
    payload: LicenseUpdate,
    db: Session = Depends(get_db),
    master_user: User = Depends(require_master),
):
    license = db.query(CompanyLicense).filter(CompanyLicense.id == license_id).first()
    if not license:
        raise HTTPException(status_code=404, detail="License not found")
    was_active = license.status == "active"
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(license, key, value)
    db.add(AuditLog(
        user_id=master_user.id,
        company_id=license.company_id,
        action="update",
        entity_type="license",
        entity_id=license.id,
        details=f"Master {master_user.username} updated license {license.id}",
    ))
    db.commit()
    db.refresh(license)
    # Notify if this update transitioned the license into the active state (best-effort).
    if license.status == "active" and not was_active:
        send_license_activated_email(db, license)
    return _to_response(db, license)


@router.post("/{license_id}/suspend", response_model=LicenseResponse)
def suspend_license(
    license_id: int,
    db: Session = Depends(get_db),
    master_user: User = Depends(require_master),
):
    return _set_status(db, license_id, "suspended", master_user)


@router.post("/{license_id}/activate", response_model=LicenseResponse)
def activate_license(
    license_id: int,
    db: Session = Depends(get_db),
    master_user: User = Depends(require_master),
):
    return _set_status(db, license_id, "active", master_user)


def _set_status(db: Session, license_id: int, status: str, master_user: User) -> LicenseResponse:
    license = db.query(CompanyLicense).filter(CompanyLicense.id == license_id).first()
    if not license:
        raise HTTPException(status_code=404, detail="License not found")
    was_active = license.status == "active"
    license.status = status
    db.add(AuditLog(
        user_id=master_user.id,
        company_id=license.company_id,
        action="update",
        entity_type="license",
        entity_id=license.id,
        details=f"Master {master_user.username} set license {license.id} status to {status}",
    ))
    db.commit()
    db.refresh(license)
    # Notify only on a real transition into the active state (best-effort).
    if status == "active" and not was_active:
        send_license_activated_email(db, license)
    return _to_response(db, license)
