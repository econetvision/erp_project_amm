from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class JobRoutine(Base):
    __tablename__ = "job_routines"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(255), nullable=False)
    type            = Column(String(50), nullable=False)    # absent_report | late_report | custom
    frequency       = Column(String(20), nullable=False)    # daily | weekly | monthly
    schedule_time   = Column(String(5), nullable=False, default="08:00")  # HH:MM
    schedule_day_of_week = Column(Integer, nullable=True)   # 0=Mon..6=Sun (for weekly)
    schedule_day_of_month = Column(Integer, nullable=True)  # 1-28 (for monthly)
    delivery_channels = Column(JSONB, nullable=False, default={"email": True, "in_app": True, "whatsapp": False})
    recipients      = Column(JSONB, nullable=False, default=[])  # list of {type: "user"|"email", value: user_id|email}
    filters         = Column(JSONB, nullable=True)           # optional filters like shift, department
    is_active       = Column(Boolean, nullable=False, default=True)
    created_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    logs = relationship("JobRoutineLog", back_populates="job", cascade="all, delete")


class JobRoutineLog(Base):
    __tablename__ = "job_routine_logs"

    id             = Column(Integer, primary_key=True, index=True)
    job_id         = Column(Integer, ForeignKey("job_routines.id", ondelete="CASCADE"), nullable=False)
    executed_at    = Column(DateTime(timezone=True), server_default=func.now())
    status         = Column(String(20), nullable=False)  # success | failed
    result_summary = Column(Text, nullable=True)
    error_message  = Column(Text, nullable=True)

    job = relationship("JobRoutine", back_populates="logs")
