from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


class EmployeeLocationPing(Base):
    """One background position report from the mobile app while clocked in."""
    __tablename__ = "employee_location_pings"

    id                  = Column(Integer, primary_key=True, index=True)
    employee_id         = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    latitude            = Column(Float, nullable=False)
    longitude           = Column(Float, nullable=False)
    accuracy_m          = Column(Float, nullable=True)
    inside_geofence     = Column(Boolean, nullable=False)
    nearest_location_id = Column(Integer, ForeignKey("work_locations.id", ondelete="SET NULL"), nullable=True)
    distance_m          = Column(Float, nullable=True)
    recorded_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_employee_location_pings_emp_time", "employee_id", "recorded_at"),
    )


class GeofenceExitEvent(Base):
    """One episode of an employee being outside every assigned work location.

    ``returned_at`` is NULL while the employee is still outside.
    """
    __tablename__ = "geofence_exit_events"

    id                = Column(Integer, primary_key=True, index=True)
    employee_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id       = Column(Integer, ForeignKey("work_locations.id", ondelete="SET NULL"), nullable=True)
    location_name     = Column(String(255), nullable=True)
    distance_m        = Column(Float, nullable=True)
    latitude          = Column(Float, nullable=True)
    longitude         = Column(Float, nullable=True)
    exited_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    returned_at       = Column(DateTime(timezone=True), nullable=True)
    notified_user_ids = Column(JSONB, nullable=True)
