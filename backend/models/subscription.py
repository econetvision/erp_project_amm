from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric, Index, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Subscription(Base):
    """Billing envelope for one company. One *active* subscription per company
    (partial unique index); historical cancelled rows are retained."""
    __tablename__ = "subscriptions"

    id            = Column(Integer, primary_key=True, index=True)
    company_id    = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    plan          = Column(String(20), nullable=False, default="basic")      # basic | pro | enterprise
    status        = Column(String(20), nullable=False, default="active")     # trial | active | past_due | suspended | cancelled
    billing_cycle = Column(String(10), nullable=False, default="yearly")     # monthly | yearly
    starts_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ends_at       = Column(DateTime(timezone=True), nullable=True)           # NULL = perpetual
    unit_price    = Column(Numeric(12, 2), nullable=False, default=0)        # per licence per cycle
    currency      = Column(String(3), nullable=False, default="INR")
    tax_rate      = Column(Numeric(5, 2), nullable=False, default=18)        # GST %
    features      = Column(JSONB, nullable=True)                             # NULL = all allowed
    notes         = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    licenses = relationship("License", back_populates="subscription", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ux_subscriptions_one_active_per_company", "company_id", unique=True,
              postgresql_where=text("status <> 'cancelled'")),
    )


class License(Base):
    """One site licence: 26 seats + 1 admin slot (defaults), granted and revoked only by master."""
    __tablename__ = "licenses"

    id              = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    company_id      = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    site_id         = Column(Integer, ForeignKey("work_locations.id", ondelete="SET NULL"), nullable=True)
    license_key     = Column(String(64), nullable=False, unique=True)
    status          = Column(String(20), nullable=False, default="active")   # active | revoked
    max_users       = Column(Integer, nullable=True, default=26)             # NULL = unlimited
    max_admins      = Column(Integer, nullable=False, default=1)
    granted_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    granted_at      = Column(DateTime(timezone=True), server_default=func.now())
    revoked_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    revoked_at      = Column(DateTime(timezone=True), nullable=True)
    revoke_reason   = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    subscription = relationship("Subscription", back_populates="licenses")
    site         = relationship("WorkLocation", foreign_keys=[site_id])

    __table_args__ = (
        Index("ix_licenses_company_status", "company_id", "status"),
    )
