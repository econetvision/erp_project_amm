from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class PublicHoliday(Base):
    __tablename__ = "public_holidays"
    # A NULL company_id row is a global holiday visible to every tenant; a
    # non-NULL company_id row belongs to a single company. Uniqueness is scoped
    # per-company so two tenants can each register their own holiday on a date.
    __table_args__ = (
        UniqueConstraint("company_id", "date", name="uq_holiday_company_date"),
    )

    id           = Column(Integer, primary_key=True, index=True)
    company_id   = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    date         = Column(Date, nullable=False)
    name         = Column(String(120), nullable=False)
    holiday_type = Column(String(20), nullable=False, default="public")  # public | company | optional
    is_optional  = Column(Boolean, nullable=False, default=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
