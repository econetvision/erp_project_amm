"""Invoices generated from a company's site licences. Master writes, admin reads own."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth.dependencies import require_admin, require_master
from database import get_db
from models.company import Company
from models.invoice import Invoice
from models.rbac import AuditLog
from models.user import User
from schemas.invoice import InvoiceGenerate, InvoiceMarkPaid, InvoiceResponse
from services.invoice_service import generate_invoice

router = APIRouter()


def _to_response(db: Session, inv: Invoice) -> InvoiceResponse:
    resp = InvoiceResponse.model_validate(inv)
    company = db.query(Company).filter(Company.id == inv.company_id).first()
    resp.company_name = company.name if company else (inv.billing_snapshot or {}).get("name")
    return resp


def _get_visible(db: Session, invoice_id: int, current_user: User) -> Invoice:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv or (current_user.role != "master" and inv.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@router.get("", response_model=list[InvoiceResponse])
def list_invoices(
    company_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(Invoice)
    if current_user.role != "master":
        q = q.filter(Invoice.company_id == current_user.company_id)
    elif company_id is not None:
        q = q.filter(Invoice.company_id == company_id)
    if status:
        q = q.filter(Invoice.status == status)
    return [_to_response(db, i) for i in q.order_by(Invoice.id.desc()).all()]


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return _to_response(db, _get_visible(db, invoice_id, current_user))


@router.post("/generate", response_model=InvoiceResponse, status_code=201)
def generate(payload: InvoiceGenerate, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    inv = generate_invoice(db, payload.company_id, payload.period_start, payload.period_end, master_user.id)
    db.add(AuditLog(user_id=master_user.id, company_id=inv.company_id, action="create",
                    entity_type="invoice", entity_id=inv.id,
                    details=f"Master {master_user.username} generated invoice {inv.invoice_number} "
                            f"for {payload.period_start}..{payload.period_end} total {inv.total}"))
    db.commit()
    return _to_response(db, inv)


@router.post("/{invoice_id}/mark-paid", response_model=InvoiceResponse)
def mark_paid(invoice_id: int, payload: InvoiceMarkPaid, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    inv = _get_visible(db, invoice_id, master_user)
    if inv.status == "void":
        raise HTTPException(status_code=400, detail="A void invoice cannot be marked paid")
    inv.status = "paid"
    inv.paid_at = datetime.now(timezone.utc)
    inv.payment_ref = payload.payment_ref
    db.add(AuditLog(user_id=master_user.id, company_id=inv.company_id, action="update",
                    entity_type="invoice", entity_id=inv.id,
                    details=f"Master {master_user.username} marked {inv.invoice_number} paid ({payload.payment_ref or 'no ref'})"))
    db.commit()
    db.refresh(inv)
    return _to_response(db, inv)


@router.post("/{invoice_id}/void", response_model=InvoiceResponse)
def void_invoice(invoice_id: int, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    inv = _get_visible(db, invoice_id, master_user)
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="A paid invoice cannot be voided")
    inv.status = "void"
    db.add(AuditLog(user_id=master_user.id, company_id=inv.company_id, action="update",
                    entity_type="invoice", entity_id=inv.id,
                    details=f"Master {master_user.username} voided {inv.invoice_number}"))
    db.commit()
    db.refresh(inv)
    return _to_response(db, inv)
