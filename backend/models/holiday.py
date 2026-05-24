from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean
from sqlalchemy.sql import func
from database import Base


class PublicHoliday(Base):
    __tablename__ = "public_holidays"

    id           = Column(Integer, primary_key=True, index=True)
    date         = Column(Date, nullable=False, unique=True)
    name         = Column(String(120), nullable=False)
    holiday_type = Column(String(20), nullable=False, default="public")  # public | company | optional
    is_optional  = Column(Boolean, nullable=False, default=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
