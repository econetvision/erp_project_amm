"""Subscription validity, seat capacity and enforcement.

Pure helpers (``compute_capacity``, ``count_seats``, ``evaluate_state``) carry
the decision logic and are unit-tested without a database. The DB-backed
wrappers at the bottom load rows and delegate to them.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Sequence

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config.settings import settings
from models.company import Company
from models.subscription import License, Subscription
from models.user import User

logger = logging.getLogger(__name__)

# ── Pure helpers ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class LicenseSpec:
    id: int | None
    status: str                # active | revoked
    max_users: int | None      # None = unlimited
    max_admins: int


@dataclass(frozen=True)
class Capacity:
    seats: int | None          # None = unlimited
    admins: int
    active_licenses: int


def compute_capacity(licenses: Sequence[LicenseSpec]) -> Capacity:
    """Company-wide pool (D2): sum of active licences. Any unlimited licence makes the pool unlimited."""
    active = [l for l in licenses if l.status == "active"]
    if not active:
        return Capacity(seats=0, admins=0, active_licenses=0)
    unlimited = any(l.max_users is None for l in active)
    seats = None if unlimited else sum(int(l.max_users) for l in active)
    return Capacity(seats=seats, admins=sum(int(l.max_admins) for l in active), active_licenses=len(active))


def count_seats(users: Sequence[tuple[str, bool | None]]) -> tuple[int, int]:
    """(seats_used, admins_used) from (role, is_active) pairs. master never consumes a seat;
    is_active NULL counts as active (matches the legacy behaviour)."""
    seats = admins = 0
    for role, is_active in users:
        if role == "master" or is_active is False:
            continue
        seats += 1
        if role == "admin":
            admins += 1
    return seats, admins


# ── Reason codes ─────────────────────────────────────────────────────────────

NO_SUBSCRIPTION = "NO_SUBSCRIPTION"
SUSPENDED       = "SUSPENDED"
EXPIRED         = "EXPIRED"
NO_LICENSE      = "NO_LICENSE"
SEAT_LIMIT      = "SEAT_LIMIT"
ADMIN_LIMIT     = "ADMIN_LIMIT"

REASON_MESSAGES = {
    NO_SUBSCRIPTION: "No subscription for this company",
    SUSPENDED:       "Subscription suspended",
    EXPIRED:         "Subscription expired",
    NO_LICENSE:      "No active licence for this company",
    SEAT_LIMIT:      "Seat limit exceeded",
    ADMIN_LIMIT:     "Admin limit exceeded",
}

VALID_SUBSCRIPTION_STATUSES = ("trial", "active")


@dataclass(frozen=True)
class SubscriptionSpec:
    status: str
    ends_at: datetime | None


@dataclass(frozen=True)
class Denial:
    code: str
    message: str


class LicenseError(HTTPException):
    """403 with a machine-readable ``code`` so callers (bulk import) never match on text."""
    def __init__(self, code: str, message: str):
        super().__init__(status_code=403, detail=message)
        self.code = code


def is_capacity_error(exc: BaseException) -> bool:
    return isinstance(exc, LicenseError) and exc.code in (SEAT_LIMIT, ADMIN_LIMIT)


def license_bypass_active() -> bool:
    """LICENSE_ENFORCE=false or a static LICENSE_KEY: validity checks are skipped (D7)."""
    return (not settings.license_enforce) or settings.has_static_license


def _is_expired(ends_at: datetime | None, now: datetime) -> bool:
    if ends_at is None:
        return False
    if ends_at.tzinfo is None:
        ends_at = ends_at.replace(tzinfo=timezone.utc)
    return now > ends_at


def evaluate_state(
    subscription: SubscriptionSpec | None,
    licenses: Sequence[LicenseSpec],
    seats_used: int,
    admins_used: int,
    *,
    bypass: bool,
    check_seats: bool = False,
    role: str | None = None,
    now: datetime | None = None,
) -> Denial | None:
    """Spec §4. Returns None when allowed, else the first Denial."""
    now = now or datetime.now(timezone.utc)
    cap = compute_capacity(licenses)

    if not bypass:
        if subscription is None:
            return Denial(NO_SUBSCRIPTION, REASON_MESSAGES[NO_SUBSCRIPTION])
        if subscription.status not in VALID_SUBSCRIPTION_STATUSES:
            return Denial(SUSPENDED, REASON_MESSAGES[SUSPENDED])
        if _is_expired(subscription.ends_at, now):
            return Denial(EXPIRED, REASON_MESSAGES[EXPIRED])
        if cap.active_licenses == 0:
            return Denial(NO_LICENSE, REASON_MESSAGES[NO_LICENSE])

    if not check_seats:
        return None
    # Nothing to meter against: bypassed company with no subscription and no licences at all.
    if bypass and subscription is None and not licenses:
        return None
    if cap.seats is not None and seats_used >= cap.seats:
        return Denial(SEAT_LIMIT, f"{REASON_MESSAGES[SEAT_LIMIT]} ({seats_used}/{cap.seats})")
    if role == "admin" and admins_used >= cap.admins:
        return Denial(ADMIN_LIMIT, f"{REASON_MESSAGES[ADMIN_LIMIT]} ({admins_used}/{cap.admins})")
    return None


# ── DB-backed wrappers ───────────────────────────────────────────────────────

@dataclass
class CompanyUsage:
    subscription: Subscription | None
    licenses: list[License]
    capacity: Capacity
    seats_used: int
    admins_used: int


def get_subscription(db: Session, company_id: int) -> Subscription | None:
    """The company's current (non-cancelled) subscription, if any."""
    return (
        db.query(Subscription)
        .filter(Subscription.company_id == company_id, Subscription.status != "cancelled")
        .order_by(Subscription.id.desc())
        .first()
    )


def load_company_usage(db: Session, company_id: int) -> CompanyUsage:
    sub = get_subscription(db, company_id)
    lic_rows = db.query(License).filter(License.company_id == company_id).order_by(License.id).all()
    specs = [LicenseSpec(id=l.id, status=l.status, max_users=l.max_users, max_admins=l.max_admins) for l in lic_rows]
    users = db.query(User.role, User.is_active).filter(User.company_id == company_id).all()
    seats_used, admins_used = count_seats([(r, a) for r, a in users])
    return CompanyUsage(subscription=sub, licenses=lic_rows, capacity=compute_capacity(specs),
                        seats_used=seats_used, admins_used=admins_used)


def evaluate_company(
    db: Session, company_id: int, *, check_seats: bool = False, role: str | None = None
) -> tuple[CompanyUsage, Denial | None]:
    usage = load_company_usage(db, company_id)
    sub_spec = None
    if usage.subscription is not None:
        sub_spec = SubscriptionSpec(status=usage.subscription.status, ends_at=usage.subscription.ends_at)
    specs = [LicenseSpec(id=l.id, status=l.status, max_users=l.max_users, max_admins=l.max_admins)
             for l in usage.licenses]
    denial = evaluate_state(sub_spec, specs, usage.seats_used, usage.admins_used,
                            bypass=license_bypass_active(), check_seats=check_seats, role=role)
    return usage, denial


def validate_company_license(db: Session, company_id: int) -> Optional[Subscription]:
    """Raise LicenseError(403) when the company's subscription is missing / suspended /
    expired / has no active licence. Returns the subscription (None under bypass)."""
    usage, denial = evaluate_company(db, company_id)
    if denial:
        raise LicenseError(denial.code, denial.message)
    return usage.subscription


def enforce_seat_limit(db: Session, company_id: int, role: str) -> None:
    """Raise LicenseError(403) when adding a user with ``role`` would exceed the seat
    or admin cap (validity problems surface first, unless bypassed)."""
    _, denial = evaluate_company(db, company_id, check_seats=True, role=role)
    if denial:
        raise LicenseError(denial.code, denial.message)


def has_feature(subscription: Subscription | None, key: str) -> bool:
    if license_bypass_active():
        return True
    if subscription is None:
        return False
    if not subscription.features:
        return True
    return bool(subscription.features.get(key, False))


def _recipients(db: Session, company: Company) -> list[str]:
    emails: set[str] = set()
    if company.email:
        emails.add(company.email)
    contacts = (
        db.query(User.email)
        .filter(User.company_id == company.id, User.role.in_(("admin", "supervisor")),
                User.email.isnot(None), User.is_active.isnot(False))
        .all()
    )
    emails.update(e for (e,) in contacts if e)
    return sorted(emails)


def send_subscription_activated_email(
    db: Session, subscription: Subscription, company: Company | None = None
) -> bool:
    """Best-effort notification; never raises."""
    from services.email_service import send_email
    try:
        if company is None:
            company = db.query(Company).filter(Company.id == subscription.company_id).first()
        if not company:
            return False
        recipients = _recipients(db, company)
        if not recipients:
            return False
        usage = load_company_usage(db, company.id)
        seats = "Unlimited" if usage.capacity.seats is None else str(usage.capacity.seats)
        ends = subscription.ends_at.strftime("%Y-%m-%d") if subscription.ends_at else "No expiry"
        html = f"""\
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
          <h2 style="color:#0d6efd;margin:0 0 12px;">Your subscription is active</h2>
          <p>Hello {company.name} team,</p>
          <table style="border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Plan</td><td style="text-transform:capitalize;">{subscription.plan}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Licences</td><td>{usage.capacity.active_licenses}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Seats</td><td>{seats}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Valid until</td><td>{ends}</td></tr>
          </table>
          <p style="color:#888;font-size:12px;">This is an automated message; please do not reply.</p>
        </div>"""
        return send_email(recipients, f"Subscription Activated — {company.name}", html)
    except Exception as e:
        logger.error("Failed to send subscription-activated email: %s", e)
        return False
