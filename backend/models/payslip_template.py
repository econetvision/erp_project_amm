from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, ForeignKey,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


class PayslipTemplate(Base):
    __tablename__ = "payslip_templates"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(120), nullable=False)
    description = Column(String(500))
    company_id  = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    is_default  = Column(Boolean, default=False, nullable=False)
    is_active   = Column(Boolean, default=True, nullable=False)

    # Layout config — stored as JSON
    # { header, sections[], footer, styling, fields }
    layout      = Column(JSONB, nullable=False, default=dict)

    # Company branding
    logo_url        = Column(Text)
    company_name    = Column(String(200))
    company_address = Column(Text)
    company_phone   = Column(String(50))
    company_email   = Column(String(200))
    footer_text     = Column(Text)
    signature_label = Column(String(200))

    created_by  = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
