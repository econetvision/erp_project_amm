"""Invoice generation from site licences (spec §5 "Invoice generation")."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Sequence

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from models.company import Company
from models.invoice import Invoice, InvoiceLine
from models.subscription import License
from services.subscription_service import get_subscription

TWO_DP = Decimal("0.01")
_NUM_RE = re.compile(r"^INV-(\d{4})-(\d+)$")


def q2(value: Decimal) -> Decimal:
    return Decimal(value).quantize(TWO_DP, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class LineSpec:
    license_id: int | None
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def build_lines(
    licenses: Sequence[tuple[int, str | None, int | None, datetime | None, datetime | None]],
    unit_price: Decimal,
    period_start: date,
    period_end: date,
) -> list[LineSpec]:
    """One line per licence active at any point in [period_start, period_end].
    Tuple: (license_id, site_name, max_users, granted_at, revoked_at)."""
    p_start = datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc)
    p_end = datetime.combine(period_end, datetime.max.time(), tzinfo=timezone.utc)
    out: list[LineSpec] = []
    for license_id, site_name, max_users, granted_at, revoked_at in licenses:
        g, r = _as_utc(granted_at), _as_utc(revoked_at)
        if g is not None and g > p_end:
            continue
        if r is not None and r < p_start:
            continue
        seats = "unlimited seats" if max_users is None else f"{max_users} seats"
        price = q2(Decimal(unit_price))
        out.append(LineSpec(
            license_id=license_id,
            description=f"Site licence — {site_name or 'Company-wide'} ({seats})",
            quantity=Decimal("1"), unit_price=price, amount=price,
        ))
    return out


def compute_totals(lines: Sequence[LineSpec], tax_rate: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = q2(sum((Decimal(l.amount) for l in lines), Decimal("0")))
    tax_amount = q2(subtotal * Decimal(tax_rate) / Decimal("100"))
    total = q2(subtotal + tax_amount)
    return subtotal, tax_amount, total


def next_invoice_number(year: int, existing_numbers: Iterable[str]) -> str:
    seq = 0
    for n in existing_numbers:
        m = _NUM_RE.match(n or "")
        if m and int(m.group(1)) == year:
            seq = max(seq, int(m.group(2)))
    return f"INV-{year}-{seq + 1:04d}"


# ── DB-backed ────────────────────────────────────────────────────────────────

def generate_invoice(db: Session, company_id: int, period_start: date, period_end: date, created_by: int) -> Invoice:
    if period_end < period_start:
        raise HTTPException(status_code=400, detail="period_end must be on or after period_start")
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    sub = get_subscription(db, company_id)
    if not sub:
        raise HTTPException(status_code=400, detail="Company has no subscription")

    rows = db.query(License).filter(License.subscription_id == sub.id).order_by(License.id).all()
    lines = build_lines(
        [(l.id, l.site.location_name if l.site else None, l.max_users, l.granted_at, l.revoked_at) for l in rows],
        Decimal(sub.unit_price), period_start, period_end,
    )
    if not lines:
        raise HTTPException(status_code=400, detail="No licences were active in that period")
    subtotal, tax_amount, total = compute_totals(lines, Decimal(sub.tax_rate))

    today = date.today()
    year = today.year
    # Lock this year's rows so concurrent generation cannot allocate the same number.
    existing = db.execute(
        text("SELECT invoice_number FROM invoices WHERE invoice_number LIKE :p FOR UPDATE"),
        {"p": f"INV-{year}-%"},
    ).scalars().all()
    number = next_invoice_number(year, existing)

    inv = Invoice(
        invoice_number=number, company_id=company_id, subscription_id=sub.id,
        period_start=period_start, period_end=period_end,
        issue_date=today, due_date=today + timedelta(days=15),
        currency=sub.currency, subtotal=subtotal, tax_rate=Decimal(sub.tax_rate),
        tax_amount=tax_amount, total=total, status="draft",
        billing_snapshot={
            "name": company.name, "address": company.address, "city": company.city,
            "state": company.state, "pincode": company.pincode, "gst_number": company.gst_number,
        },
        created_by=created_by,
    )
    for l in lines:
        inv.lines.append(InvoiceLine(license_id=l.license_id, description=l.description,
                                     quantity=l.quantity, unit_price=l.unit_price, amount=l.amount))
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv
