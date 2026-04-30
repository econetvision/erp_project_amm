from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20), nullable=False)          # admin | supervisor | worker
    employee_id   = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
