from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Employee(Base):
    __tablename__ = "employees"

    id                  = Column(Integer, primary_key=True, index=True)
    name                = Column(String(255), nullable=False)
    address             = Column(Text, nullable=False)
    aadhar_number       = Column(String(12), nullable=False, unique=True)
    bank_account_number = Column(String(18), nullable=False)
    hourly_rate         = Column(Numeric(10, 2), nullable=False, default=0.00)
    shift               = Column(String(10), nullable=False, default="SHIFT_A")
    face_encoding       = Column(JSONB, nullable=True)
    photo               = Column(Text, nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    attendance = relationship("Attendance", back_populates="employee", cascade="all, delete")
    payslips   = relationship("Payslip",    back_populates="employee", cascade="all, delete")
