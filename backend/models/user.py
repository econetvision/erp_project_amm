from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20), nullable=False)          # admin | supervisor | worker
    employee_id   = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    email         = Column(String(255), nullable=True)
    display_name  = Column(String(255), nullable=True)
    phone         = Column(String(20), nullable=True)
    photo_path    = Column(String(500), nullable=True)
    pin_hash      = Column(String(255), nullable=True)
    lock_timeout  = Column(Integer, nullable=True, default=2)   # minutes
    theme_preference = Column(JSONB, nullable=True, default=None)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
