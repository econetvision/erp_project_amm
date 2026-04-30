from sqlalchemy import Column, Integer, ForeignKey, DateTime, Numeric, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class VehicleLocation(Base):
    __tablename__ = "vehicle_locations"

    id          = Column(Integer, primary_key=True, index=True)
    vehicle_id  = Column(Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    latitude    = Column(Float, nullable=False)
    longitude   = Column(Float, nullable=False)
    speed       = Column(Numeric(6, 2), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    vehicle = relationship("Vehicle", back_populates="locations")
