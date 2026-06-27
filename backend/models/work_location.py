from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class WorkLocation(Base):
    __tablename__ = "work_locations"

    id                = Column(Integer, primary_key=True, index=True)
    company_id        = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    location_name     = Column(String(255), nullable=False)
    location_code     = Column(String(50), nullable=True, unique=True)
    address           = Column(Text, nullable=True)
    city              = Column(String(100), nullable=True)
    state             = Column(String(100), nullable=True)
    pincode           = Column(String(10), nullable=True)
    latitude          = Column(Float, nullable=False)
    longitude         = Column(Float, nullable=False)
    allowed_radius_m  = Column(Float, nullable=False, default=50.0)
    work_type         = Column(String(50), nullable=True)       # dump_yard | office | site | depot
    supervisor_id     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active         = Column(Boolean, nullable=False, default=True)
    created_by        = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    assignments = relationship("EmployeeLocationAssignment", back_populates="location", cascade="all, delete")


class EmployeeLocationAssignment(Base):
    __tablename__ = "employee_location_assignments"

    id            = Column(Integer, primary_key=True, index=True)
    employee_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    location_id   = Column(Integer, ForeignKey("work_locations.id", ondelete="CASCADE"), nullable=False)
    is_primary    = Column(Boolean, nullable=False, default=False)
    assigned_by   = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at   = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    employee = relationship("User", back_populates="location_assignments", foreign_keys=[employee_id])
    location = relationship("WorkLocation", back_populates="assignments")
