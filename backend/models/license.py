from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


class CompanyLicense(Base):
    """Per-company license issued by the master role. Every role below master in the
    hierarchy (admin/supervisor/worker) is validated against its company's license."""
    __tablename__ = "company_licenses"

    id          = Column(Integer, primary_key=True, index=True)
    company_id  = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"),
                         nullable=False, unique=True)          # one license per company
    license_key = Column(String(64), nullable=False, unique=True)
    tier        = Column(String(20), nullable=False, default="basic")   # basic | pro | enterprise
    status      = Column(String(20), nullable=False, default="active")  # active | suspended
    max_seats   = Column(Integer, nullable=True)               # None = unlimited
    valid_from  = Column(DateTime(timezone=True), server_default=func.now())
    valid_until = Column(DateTime(timezone=True), nullable=True)  # None = perpetual
    features    = Column(JSONB, nullable=True)                  # tier feature flags
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
