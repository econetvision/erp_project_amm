from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, SmallInteger
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id               = Column(Integer, primary_key=True, index=True)
    month            = Column(SmallInteger, nullable=False)
    year             = Column(SmallInteger, nullable=False)
    status           = Column(String(20), nullable=False, default="draft")  # draft | processing | completed | cancelled
    run_by           = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_at       = Column(DateTime(timezone=True), server_default=func.now())
    completed_at     = Column(DateTime(timezone=True), nullable=True)
    total_gross      = Column(Numeric(14, 2), nullable=True)
    total_net        = Column(Numeric(14, 2), nullable=True)
    total_deductions = Column(Numeric(14, 2), nullable=True)
    employee_count   = Column(Integer, nullable=True)

    items = relationship("PayrollItem", back_populates="run", cascade="all, delete")


class PayrollItem(Base):
    __tablename__ = "payroll_items"

    id                   = Column(Integer, primary_key=True, index=True)
    run_id               = Column(Integer, ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False)
    employee_id          = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    basic_pay            = Column(Numeric(12, 2), nullable=False)
    earnings_breakdown   = Column(JSONB, nullable=False, default={})   # {HRA: 5000, DA: 2000, ...}
    deductions_breakdown = Column(JSONB, nullable=False, default={})   # {ESI: 375, PF: 6000, ...}
    days_worked          = Column(SmallInteger, nullable=False, default=0)
    overtime_hours       = Column(Numeric(7, 2), nullable=False, default=0)
    overtime_pay         = Column(Numeric(12, 2), nullable=False, default=0)
    gross_pay            = Column(Numeric(12, 2), nullable=False)
    total_deductions     = Column(Numeric(12, 2), nullable=False)
    advance_deduction    = Column(Numeric(12, 2), nullable=False, default=0)
    net_pay              = Column(Numeric(12, 2), nullable=False)
    status               = Column(String(20), nullable=False, default="calculated")

    run = relationship("PayrollRun", back_populates="items")
