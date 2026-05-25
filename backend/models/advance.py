from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Date, Text
from sqlalchemy.sql import func
from database import Base


class Advance(Base):
    __tablename__ = "advances"

    id                = Column(Integer, primary_key=True, index=True)
    employee_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount            = Column(Numeric(12, 2), nullable=False)
    disbursed_date    = Column(Date, nullable=False)
    repayment_months  = Column(Integer, nullable=False, default=1)
    monthly_deduction = Column(Numeric(12, 2), nullable=False)
    remaining_balance = Column(Numeric(12, 2), nullable=False)
    status            = Column(String(20), nullable=False, default="active")  # active | repaid
    notes             = Column(Text, nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
