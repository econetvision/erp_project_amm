"""Per-company license validation.

The master role issues a `CompanyLicense` per company. Every role below master in the
hierarchy is validated against its company's license at login and on each request.
Master always bypasses these checks (handled by the callers / dependency).
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.user import User
from models.company import Company
from models.license import CompanyLicense
from services.email_service import send_email
from config.settings import settings

logger = logging.getLogger(__name__)

# Reasons returned by evaluate_license / raised by validate_company_license
NO_LICENSE   = "No license issued for this company"
SUSPENDED    = "License suspended"
EXPIRED      = "License expired"
SEAT_LIMIT   = "Seat limit exceeded"


def license_bypass_active() -> bool:
    """True when local license enforcement is short-circuited to "always valid":
      - a static master LICENSE_KEY is configured (our own deployments), or
      - enforcement is globally disabled via LICENSE_ENFORCE=false.

    In bypass mode the backend also skips any call to the external license server.
    """
    return (not settings.license_enforce) or settings.has_static_license


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
    # Static master license / disabled enforcement → always valid, no DB or server check.
    if license_bypass_active():
        return None, None
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
    # Static master license / disabled enforcement grants every feature.
    if license_bypass_active():
        return True
    if license is None:
        return False
    if not license.features:
        return True
    return bool(license.features.get(key, False))


def _license_recipients(db: Session, company: Company) -> list[str]:
    """Notification targets for a company's license: the company contact email plus
    its active admin/supervisor users that have an email on file (deduplicated)."""
    emails: set[str] = set()
    if company.email:
        emails.add(company.email)
    contacts = (
        db.query(User)
        .filter(
            User.company_id == company.id,
            User.role.in_(("admin", "supervisor")),
            User.email.isnot(None),
            User.is_active.isnot(False),
        )
        .all()
    )
    for c in contacts:
        if c.email:
            emails.add(c.email)
    return list(emails)


def send_license_activated_email(
    db: Session, license: CompanyLicense, company: Optional[Company] = None
) -> bool:
    """Best-effort 'license activated' notification. Never raises — a failed/disabled
    email must not break license issuance or activation."""
    try:
        if company is None:
            company = db.query(Company).filter(Company.id == license.company_id).first()
        if not company:
            return False
        recipients = _license_recipients(db, company)
        if not recipients:
            logger.info("License %s activated but no recipient emails for company %s",
                        license.id, company.id)
            return False
        valid_until = (
            license.valid_until.strftime("%Y-%m-%d") if license.valid_until
            else "No expiry (perpetual)"
        )
        max_seats = license.max_seats if license.max_seats is not None else "Unlimited"
        subject = f"License Activated — {company.name}"
        html_body = f"""\
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
          <h2 style="color:#0d6efd;margin:0 0 12px;">Your license is now active</h2>
          <p>Hello {company.name} team,</p>
          <p>Your ERP license has been <strong>activated</strong>. You now have full
             access to your subscribed modules.</p>
          <table style="border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Company</td>
                <td style="padding:4px 0;"><strong>{company.name}</strong></td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Plan / Tier</td>
                <td style="padding:4px 0;text-transform:capitalize;">{license.tier}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Status</td>
                <td style="padding:4px 0;">Active</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Seats</td>
                <td style="padding:4px 0;">{max_seats}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Valid until</td>
                <td style="padding:4px 0;">{valid_until}</td></tr>
          </table>
          <p style="color:#888;font-size:12px;">This is an automated message; please do
             not reply.</p>
        </div>"""
        sent = send_email(recipients, subject, html_body)
        if sent:
            logger.info("License-activated email sent for company %s to %d recipient(s)",
                        company.id, len(recipients))
        return sent
    except Exception as e:  # never let email break the request
        logger.error("Failed to send license-activated email: %s", e)
        return False
