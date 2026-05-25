from sqlalchemy import Column, Integer, SmallInteger, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Payslip(Base):
    __tablename__ = "payslips"

    id           = Column(Integer, primary_key=True, index=True)
    employee_id  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    month        = Column(SmallInteger, nullable=False)
    year         = Column(SmallInteger, nullable=False)
    days_worked  = Column(SmallInteger, nullable=False, default=0)
    total_hours  = Column(Numeric(7, 2), nullable=False, default=0.00)
    hourly_rate  = Column(Numeric(10, 2), nullable=False)
    daily_rate   = Column(Numeric(12, 2), nullable=False, default=0.00)
    gross_pay    = Column(Numeric(12, 2), nullable=False)
    esi          = Column(Numeric(12, 2), nullable=False, default=0.00)
    pf           = Column(Numeric(12, 2), nullable=False, default=0.00)
    net_pay      = Column(Numeric(12, 2), nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("User", back_populates="payslips")
