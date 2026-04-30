from sqlalchemy import Column, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class VehicleAssignment(Base):
    __tablename__ = "vehicle_assignments"

    id          = Column(Integer, primary_key=True, index=True)
    vehicle_id  = Column(Integer, ForeignKey("vehicles.id",  ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    released_at = Column(DateTime(timezone=True), nullable=True)
    notes       = Column(Text, nullable=True)

    vehicle  = relationship("Vehicle",  back_populates="assignments")
    employee = relationship("Employee")
