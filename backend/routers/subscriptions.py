"""Subscriptions: the billing envelope per company. Master writes, admin reads own."""
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth.dependencies import require_admin, require_master
from database import get_db
from models.company import Company
from models.rbac import AuditLog
from models.subscription import License, Subscription
from models.user import User
from schemas.subscription import (
    LicenseResponse, MySubscriptionResponse, SubscriptionCreate, SubscriptionResponse, SubscriptionUpdate,
)
from services.subscription_service import (
    evaluate_company, get_subscription, send_subscription_activated_email,
)

router = APIRouter()


def _audit(db: Session, user: User, company_id: int, action: str, entity_type: str, entity_id: int, details: str) -> None:
    db.add(AuditLog(user_id=user.id, company_id=company_id, action=action,
                    entity_type=entity_type, entity_id=entity_id, details=details))


def license_to_response(lic: License) -> LicenseResponse:
    resp = LicenseResponse.model_validate(lic)
    resp.site_name = lic.site.location_name if lic.site else None
    return resp


def subscription_to_response(db: Session, sub: Subscription, company: Company | None = None) -> SubscriptionResponse:
    usage, denial = evaluate_company(db, sub.company_id)
    resp = SubscriptionResponse.model_validate(sub)
    company = company or db.query(Company).filter(Company.id == sub.company_id).first()
    resp.company_name = company.name if company else None
    resp.capacity = usage.capacity.seats
    resp.admin_cap = usage.capacity.admins
    resp.seats_used = usage.seats_used
    resp.admins_used = usage.admins_used
    resp.active_licenses = usage.capacity.active_licenses
    resp.is_valid = denial is None
    resp.reason_code = denial.code if denial else None
    resp.reason = denial.message if denial else None
    return resp


def _detail(db: Session, sub: Subscription) -> MySubscriptionResponse:
    base = subscription_to_response(db, sub)
    resp = MySubscriptionResponse(**base.model_dump())
    resp.licenses = [license_to_response(l) for l in
                     db.query(License).filter(License.subscription_id == sub.id).order_by(License.id).all()]
    if sub.ends_at:
        ends = sub.ends_at if sub.ends_at.tzinfo else sub.ends_at.replace(tzinfo=timezone.utc)
        resp.days_to_renewal = (ends - datetime.now(timezone.utc)).days
    return resp


def _get_or_404(db: Session, subscription_id: int) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub


@router.get("", response_model=list[SubscriptionResponse])
def list_subscriptions(
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(Subscription, Company).join(Company, Company.id == Subscription.company_id)
    if current_user.role != "master":
        q = q.filter(Subscription.company_id == current_user.company_id)
    elif company_id is not None:
        q = q.filter(Subscription.company_id == company_id)
    rows = q.order_by(Company.name, Subscription.id.desc()).all()
    return [subscription_to_response(db, sub, company) for sub, company in rows]


@router.get("/my", response_model=MySubscriptionResponse)
def my_subscription(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if current_user.company_id is None:
        raise HTTPException(status_code=404, detail="User is not assigned to a company")
    sub = get_subscription(db, current_user.company_id)
    if not sub:
        raise HTTPException(status_code=404, detail="No subscription for this company")
    return _detail(db, sub)


@router.get("/{subscription_id}", response_model=MySubscriptionResponse)
def get_subscription_detail(
    subscription_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
):
    sub = _get_or_404(db, subscription_id)
    if current_user.role != "master" and sub.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return _detail(db, sub)


@router.post("", response_model=MySubscriptionResponse, status_code=201)
def create_subscription(
    payload: SubscriptionCreate, db: Session = Depends(get_db), master_user: User = Depends(require_master)
):
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if get_subscription(db, payload.company_id):
        raise HTTPException(status_code=400, detail="Company already has an active subscription")
    data = payload.model_dump(exclude={"initial_licenses"}, exclude_none=True)
    data.setdefault("currency", (company.currency or "INR")[:3])
    data.setdefault("starts_at", datetime.now(timezone.utc))
    sub = Subscription(**data)
    db.add(sub)
    db.flush()
    for _ in range(payload.initial_licenses):
        db.add(License(subscription_id=sub.id, company_id=sub.company_id, site_id=None,
                       license_key=secrets.token_urlsafe(32), granted_by=master_user.id))
    _audit(db, master_user, sub.company_id, "create", "subscription", sub.id,
           f"Master {master_user.username} created {sub.plan} subscription for {company.name} "
           f"with {payload.initial_licenses} licence(s)")
    db.commit()
    db.refresh(sub)
    if sub.status in ("trial", "active"):
        send_subscription_activated_email(db, sub, company)
    return _detail(db, sub)


@router.put("/{subscription_id}", response_model=MySubscriptionResponse)
def update_subscription(
    subscription_id: int, payload: SubscriptionUpdate,
    db: Session = Depends(get_db), master_user: User = Depends(require_master),
):
    sub = _get_or_404(db, subscription_id)
    was_valid = sub.status in ("trial", "active")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(sub, key, value)
    _audit(db, master_user, sub.company_id, "update", "subscription", sub.id,
           f"Master {master_user.username} updated subscription {sub.id}")
    db.commit()
    db.refresh(sub)
    if sub.status in ("trial", "active") and not was_valid:
        send_subscription_activated_email(db, sub)
    return _detail(db, sub)


def _set_status(db: Session, subscription_id: int, status: str, master_user: User) -> MySubscriptionResponse:
    sub = _get_or_404(db, subscription_id)
    was_valid = sub.status in ("trial", "active")
    sub.status = status
    _audit(db, master_user, sub.company_id, "update", "subscription", sub.id,
           f"Master {master_user.username} set subscription {sub.id} status to {status}")
    db.commit()
    db.refresh(sub)
    if status == "active" and not was_valid:
        send_subscription_activated_email(db, sub)
    return _detail(db, sub)


@router.post("/{subscription_id}/suspend", response_model=MySubscriptionResponse)
def suspend_subscription(subscription_id: int, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    return _set_status(db, subscription_id, "suspended", master_user)


@router.post("/{subscription_id}/activate", response_model=MySubscriptionResponse)
def activate_subscription(subscription_id: int, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    return _set_status(db, subscription_id, "active", master_user)
