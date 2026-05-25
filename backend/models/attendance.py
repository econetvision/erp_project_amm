from sqlalchemy import Column, Integer, Date, Time, Numeric, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    id           = Column(Integer, primary_key=True, index=True)
    employee_id  = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date         = Column(Date, nullable=False)
    entry_time   = Column(Time, nullable=False)
    exit_time    = Column(Time, nullable=True)
    hours_worked = Column(Numeric(5, 2), nullable=True)
    clock_in_latitude   = Column(Float, nullable=True)
    clock_in_longitude  = Column(Float, nullable=True)
    clock_out_latitude  = Column(Float, nullable=True)
    clock_out_longitude = Column(Float, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee = relationship("User", back_populates="attendance")
