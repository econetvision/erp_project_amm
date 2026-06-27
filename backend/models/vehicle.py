from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id         = Column(Integer, primary_key=True, index=True)
    reg_number   = Column(String(20), nullable=False, unique=True)
    type         = Column(String(20), nullable=False)
    make         = Column(String(100), nullable=True)
    model        = Column(String(100), nullable=True)
    status       = Column(String(20), nullable=False, default="available")
    tracker_imei = Column(String(20), nullable=True, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    assignments = relationship("VehicleAssignment", back_populates="vehicle", cascade="all, delete")
    locations   = relationship("VehicleLocation",   back_populates="vehicle", cascade="all, delete")
