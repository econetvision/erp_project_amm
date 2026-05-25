from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


class Company(Base):
    __tablename__ = "companies"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(255), nullable=False, unique=True)
    code            = Column(String(50), nullable=False, unique=True)
    logo_path       = Column(String(500), nullable=True)
    address         = Column(Text, nullable=True)
    city            = Column(String(100), nullable=True)
    state           = Column(String(100), nullable=True)
    country         = Column(String(100), nullable=True, default="India")
    pincode         = Column(String(10), nullable=True)
    phone           = Column(String(20), nullable=True)
    email           = Column(String(255), nullable=True)
    website         = Column(String(255), nullable=True)
    gst_number      = Column(String(20), nullable=True)
    pan_number      = Column(String(10), nullable=True)
    timezone        = Column(String(50), nullable=True, default="Asia/Kolkata")
    currency        = Column(String(10), nullable=True, default="INR")
    is_active       = Column(Boolean, nullable=False, default=True)

    # Branding / theme
    theme_config    = Column(JSONB, nullable=True, default=None)
    # e.g. {"primaryColor": "#0d6efd", "accentColor": "#4ea8e8", "mode": "light", "font": "Inter"}

    # Payroll settings
    payroll_config  = Column(JSONB, nullable=True, default=None)
    # e.g. {"esi_rate": 0.75, "pf_rate": 12.0, "working_days": 26, "overtime_multiplier": 1.5}

    # Attendance settings
    attendance_config = Column(JSONB, nullable=True, default=None)
    # e.g. {"gps_enabled": true, "geofencing": true, "qr_enabled": false}

    # Feature flags
    features        = Column(JSONB, nullable=True, default=None)
    # e.g. {"payroll": true, "vehicles": true, "attendance_face": true, "jobs": true}

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
