from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, Date, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Employee(Base):
    __tablename__ = "employees"

    id                  = Column(Integer, primary_key=True, index=True)
    name                = Column(String(255), nullable=False)
    gender              = Column(String(10), nullable=True)           # male | female | other
    date_of_birth       = Column(Date, nullable=True)
    blood_group         = Column(String(5), nullable=True)            # A+, B-, etc.
    marital_status      = Column(String(20), nullable=True)           # single | married | divorced | widowed
    emergency_contact   = Column(String(20), nullable=True)
    emergency_name      = Column(String(255), nullable=True)
    phone               = Column(String(20), nullable=True)
    email               = Column(String(255), nullable=True)
    phone_verified      = Column(String(1), nullable=True, default="N")   # Y | N
    email_verified      = Column(String(1), nullable=True, default="N")   # Y | N
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

    attendance = relationship("Attendance", back_populates="employee", cascade="all, delete")
    payslips   = relationship("Payslip",    back_populates="employee", cascade="all, delete")
    location_assignments = relationship("EmployeeLocationAssignment", back_populates="employee", cascade="all, delete")
