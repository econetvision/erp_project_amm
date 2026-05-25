from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, Date, Float, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


class Employee(Base):
    """Legacy model – the employees table was merged into users by migration 0013.
    Kept only so Alembic can reference the table during downgrades / history."""
    __tablename__ = "employees"

    id                  = Column(Integer, primary_key=True, index=True)
    company_id          = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    name                = Column(String(255), nullable=False)
    gender              = Column(String(10), nullable=True)
    date_of_birth       = Column(Date, nullable=True)
    blood_group         = Column(String(5), nullable=True)
    marital_status      = Column(String(20), nullable=True)
    emergency_contact   = Column(String(20), nullable=True)
    emergency_name      = Column(String(255), nullable=True)
    phone               = Column(String(20), nullable=True)
    email               = Column(String(255), nullable=True)
    phone_verified      = Column(String(1), nullable=True, default="N")
    email_verified      = Column(String(1), nullable=True, default="N")
    address             = Column(Text, nullable=False)
    aadhar_number       = Column(String(12), nullable=False, unique=True)
    bank_account_number = Column(String(18), nullable=False)
    ifsc_code           = Column(String(11), nullable=True)
    bank_name           = Column(String(255), nullable=True)
    kyc_status          = Column(String(20), nullable=True, default="pending")
    kyc_verified_name   = Column(String(255), nullable=True)
    hourly_rate         = Column(Numeric(10, 2), nullable=False, default=0.00)
    shift               = Column(String(10), nullable=False, default="SHIFT_A")
    face_encoding       = Column(JSONB, nullable=True)
    photo               = Column(Text, nullable=True)
    work_location_name  = Column(String(255), nullable=True)
    work_latitude       = Column(Float, nullable=True)
    work_longitude      = Column(Float, nullable=True)
    attendance_radius_km = Column(Float, nullable=True, default=10.0)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
