from sqlalchemy import Column, Integer, Date, Time, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    id           = Column(Integer, primary_key=True, index=True)
    employee_id  = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date         = Column(Date, nullable=False)
    entry_time   = Column(Time, nullable=False)
    exit_time    = Column(Time, nullable=True)
    hours_worked = Column(Numeric(5, 2), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    employee = relationship("Employee", back_populates="attendance")
