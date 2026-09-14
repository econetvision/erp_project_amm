"""Site licences: grant (master), list (master/admin), soft revoke (master)."""
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth.dependencies import require_admin, require_master
from database import get_db
from models.rbac import AuditLog
from models.subscription import License, Subscription
from models.user import User
from models.work_location import WorkLocation
from routers.subscriptions import license_to_response
from schemas.subscription import LicenseGrant, LicenseResponse, LicenseRevoke

router = APIRouter()


@router.get("", response_model=list[LicenseResponse])
def list_licenses(
    company_id: Optional[int] = Query(None),
    subscription_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(License)
    if current_user.role != "master":
        q = q.filter(License.company_id == current_user.company_id)
    elif company_id is not None:
        q = q.filter(License.company_id == company_id)
    if subscription_id is not None:
        q = q.filter(License.subscription_id == subscription_id)
    return [license_to_response(l) for l in q.order_by(License.id).all()]


@router.get("/{license_id}", response_model=LicenseResponse)
def get_license(license_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    lic = db.query(License).filter(License.id == license_id).first()
    if not lic or (current_user.role != "master" and lic.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Licence not found")
    return license_to_response(lic)


@router.post("", response_model=list[LicenseResponse], status_code=201)
def grant_licenses(payload: LicenseGrant, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    """Create ``quantity`` licence rows on one subscription (D4 stacking)."""
    sub = db.query(Subscription).filter(Subscription.id == payload.subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    site_name = "Company-wide"
    if payload.site_id is not None:
        site = db.query(WorkLocation).filter(WorkLocation.id == payload.site_id).first()
        if not site or site.company_id != sub.company_id:
            raise HTTPException(status_code=400, detail="Site does not belong to this company")
        site_name = site.location_name
    max_users = None if payload.unlimited else payload.max_users
    created: list[License] = []
    for _ in range(payload.quantity):
        lic = License(
            subscription_id=sub.id, company_id=sub.company_id, site_id=payload.site_id,
            license_key=secrets.token_urlsafe(32), status="active",
            max_users=max_users, max_admins=payload.max_admins, granted_by=master_user.id,
        )
        db.add(lic)
        created.append(lic)
    db.flush()
    for lic in created:
        db.add(AuditLog(user_id=master_user.id, company_id=sub.company_id, action="create",
                        entity_type="license", entity_id=lic.id,
                        details=f"Master {master_user.username} granted licence {lic.id} ({site_name}, "
                                f"{'unlimited' if max_users is None else max_users} seats)"))
    db.commit()
    for lic in created:
        db.refresh(lic)
    return [license_to_response(l) for l in created]


@router.post("/{license_id}/revoke", response_model=LicenseResponse)
def revoke_license(
    license_id: int, payload: LicenseRevoke,
    db: Session = Depends(get_db), master_user: User = Depends(require_master),
):
    lic = db.query(License).filter(License.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licence not found")
    if lic.status == "revoked":
        raise HTTPException(status_code=400, detail="Licence is already revoked")
    lic.status = "revoked"
    lic.revoked_by = master_user.id
    lic.revoked_at = datetime.now(timezone.utc)
    lic.revoke_reason = payload.reason
    db.add(AuditLog(user_id=master_user.id, company_id=lic.company_id, action="update",
                    entity_type="license", entity_id=lic.id,
                    details=f"Master {master_user.username} revoked licence {lic.id}: {payload.reason or 'no reason'}"))
    db.commit()
    db.refresh(lic)
    return license_to_response(lic)
