"""Per-company license validation.

The master role issues a `CompanyLicense` per company. Every role below master in the
hierarchy is validated against its company's license at login and on each request.
Master always bypasses these checks (handled by the callers / dependency).
"""
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.user import User
from models.license import CompanyLicense

# Reasons returned by evaluate_license / raised by validate_company_license
NO_LICENSE   = "No license issued for this company"
SUSPENDED    = "License suspended"
EXPIRED      = "License expired"
SEAT_LIMIT   = "Seat limit exceeded"


def get_company_license(db: Session, company_id: int) -> Optional[CompanyLicense]:
    return db.query(CompanyLicense).filter(CompanyLicense.company_id == company_id).first()


def count_active_seats(db: Session, company_id: int) -> int:
    """Active, non-master users that consume a seat in the given company."""
    return (
        db.query(User)
        .filter(
            User.company_id == company_id,
            User.role != "master",
            User.is_active.isnot(False),   # NULL or True both count as active
        )
        .count()
    )


def _is_expired(license: CompanyLicense) -> bool:
    if not license.valid_until:
        return False  # perpetual
    valid_until = license.valid_until
    if valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > valid_until


def evaluate_license(
    db: Session, company_id: int, *, check_seats: bool = False
) -> Tuple[Optional[CompanyLicense], Optional[str]]:
    """Return (license, reason). reason is None when the license is valid.

    Seat overage is only reported when check_seats=True, so that existing users are not
    locked out of an over-provisioned company on login / per request — it is enforced
    when *adding* a new user instead.
    """
    license = get_company_license(db, company_id)
    if license is None:
        return None, NO_LICENSE
    if license.status != "active":
        return license, SUSPENDED
    if _is_expired(license):
        return license, EXPIRED
    if check_seats and license.max_seats is not None:
        if count_active_seats(db, company_id) >= license.max_seats:
            return license, SEAT_LIMIT
    return license, None


def validate_company_license(db: Session, company_id: int) -> CompanyLicense:
    """Raise HTTPException(403) with a specific reason when the company's license is
    missing / suspended / expired. Returns the license when valid."""
    license, reason = evaluate_license(db, company_id)
    if reason:
        raise HTTPException(status_code=403, detail=reason)
    return license


def enforce_seat_limit(db: Session, company_id: int) -> None:
    """Raise HTTPException(403) when adding another active user would exceed the seat
    limit (also surfaces missing/suspended/expired before the seat check)."""
    _, reason = evaluate_license(db, company_id, check_seats=True)
    if reason:
        raise HTTPException(status_code=403, detail=reason)


def has_feature(license: Optional[CompanyLicense], key: str) -> bool:
    """Tier/feature gate helper. True when the license grants `key` (or has no feature
    map, i.e. all features allowed)."""
    if license is None:
        return False
    if not license.features:
        return True
    return bool(license.features.get(key, False))
