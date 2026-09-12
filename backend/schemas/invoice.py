from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class InvoiceGenerate(BaseModel):
    company_id:   int
    period_start: date
    period_end:   date


class InvoiceMarkPaid(BaseModel):
    payment_ref: Optional[str] = Field(None, max_length=100)


class InvoiceLineResponse(BaseModel):
    id:          int
    license_id:  Optional[int] = None
    description: str
    quantity:    Decimal
    unit_price:  Decimal
    amount:      Decimal

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id:               int
    invoice_number:   str
    company_id:       int
    company_name:     Optional[str] = None
    subscription_id:  Optional[int] = None
    period_start:     date
    period_end:       date
    issue_date:       date
    due_date:         date
    currency:         str
    subtotal:         Decimal
    tax_rate:         Decimal
    tax_amount:       Decimal
    total:            Decimal
    status:           str
    paid_at:          Optional[datetime] = None
    payment_ref:      Optional[str] = None
    billing_snapshot: Optional[dict] = None
    created_by:       Optional[int] = None
    created_at:       Optional[datetime] = None
    lines:            list[InvoiceLineResponse] = []

    model_config = {"from_attributes": True}
