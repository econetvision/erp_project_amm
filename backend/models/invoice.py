from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id               = Column(Integer, primary_key=True, index=True)
    invoice_number   = Column(String(30), nullable=False, unique=True)      # INV-{YYYY}-{NNNN}
    company_id       = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id  = Column(Integer, ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    period_start     = Column(Date, nullable=False)
    period_end       = Column(Date, nullable=False)
    issue_date       = Column(Date, nullable=False)
    due_date         = Column(Date, nullable=False)
    currency         = Column(String(3), nullable=False, default="INR")
    subtotal         = Column(Numeric(12, 2), nullable=False, default=0)
    tax_rate         = Column(Numeric(5, 2), nullable=False, default=18)
    tax_amount       = Column(Numeric(12, 2), nullable=False, default=0)
    total            = Column(Numeric(12, 2), nullable=False, default=0)
    status           = Column(String(20), nullable=False, default="draft")   # draft | sent | paid | void
    paid_at          = Column(DateTime(timezone=True), nullable=True)
    payment_ref      = Column(String(100), nullable=True)
    billing_snapshot = Column(JSONB, nullable=True)
    created_by       = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan",
                         order_by="InvoiceLine.id")


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id          = Column(Integer, primary_key=True, index=True)
    invoice_id  = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    license_id  = Column(Integer, ForeignKey("licenses.id", ondelete="SET NULL"), nullable=True)
    description = Column(String(255), nullable=False)
    quantity    = Column(Numeric(10, 2), nullable=False, default=1)
    unit_price  = Column(Numeric(12, 2), nullable=False, default=0)
    amount      = Column(Numeric(12, 2), nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="lines")
