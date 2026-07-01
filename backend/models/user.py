from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, Text, Float, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20), nullable=False)          # master | admin | supervisor | worker
    company_id    = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    email         = Column(String(255), nullable=True)
    display_name  = Column(String(255), nullable=True)
    phone         = Column(String(20), nullable=True)
    photo_path    = Column(String(500), nullable=True)
    pin_hash      = Column(String(255), nullable=True)
    lock_timeout  = Column(Integer, nullable=True, default=2)   # minutes
    theme_preference = Column(JSONB, nullable=True, default=None)
    is_active     = Column(Boolean, nullable=True, default=True)

    # ── Employee fields (merged from employees table) ─────────────────────────
    employee_code       = Column(String(20), nullable=True, unique=True)
    name                = Column(String(255), nullable=True)
    gender              = Column(String(10), nullable=True)
    date_of_birth       = Column(Date, nullable=True)
    blood_group         = Column(String(5), nullable=True)
    marital_status      = Column(String(20), nullable=True)
    emergency_contact   = Column(String(20), nullable=True)
    emergency_name      = Column(String(255), nullable=True)
    address             = Column(Text, nullable=True)
    aadhar_number       = Column(String(12), nullable=True, unique=True)
    bank_account_number = Column(String(18), nullable=True)
    ifsc_code           = Column(String(11), nullable=True)
    bank_name           = Column(String(255), nullable=True)
    kyc_status          = Column(String(20), nullable=True, default="pending")
    kyc_verified_name   = Column(String(255), nullable=True)
    hourly_rate         = Column(Numeric(10, 2), nullable=True, default=0.00)
    shift               = Column(String(10), nullable=True, default="SHIFT_A")
    face_encoding       = Column(JSONB, nullable=True)
    photo               = Column(Text, nullable=True)
    work_location_name  = Column(String(255), nullable=True)
    work_latitude       = Column(Float, nullable=True)
    work_longitude      = Column(Float, nullable=True)
    attendance_radius_m = Column(Float, nullable=True, default=50.0)
    phone_verified      = Column(String(1), nullable=True, default="N")
    email_verified      = Column(String(1), nullable=True, default="N")
    onboarding_complete = Column(Boolean, nullable=True, default=False)

    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    attendance = relationship("Attendance", back_populates="employee", cascade="all, delete")
    payslips   = relationship("Payslip",    back_populates="employee", cascade="all, delete")
    location_assignments = relationship(
        "EmployeeLocationAssignment",
        back_populates="employee",
        cascade="all, delete",
        primaryjoin="User.id == foreign(EmployeeLocationAssignment.employee_id)",
    )
