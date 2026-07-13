from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class IfscCode(Base):
    """Branch-level IFSC directory imported from the Razorpay IFSC dataset
    (https://github.com/razorpay/ifsc/releases). Lookups hit this table first;
    the public ifsc.razorpay.com API is only a fallback for codes newer than
    the imported dataset."""
    __tablename__ = "ifsc_codes"

    ifsc     = Column(String(11), primary_key=True)
    bank     = Column(String(200), nullable=False)
    branch   = Column(Text)
    centre   = Column(String(200))
    district = Column(String(200))
    state    = Column(String(200))
    address  = Column(Text)
    city     = Column(String(200))
    contact  = Column(String(100))
    micr     = Column(String(20))
    swift    = Column(String(20))
    iso3166  = Column(String(10))
    imps     = Column(Boolean, nullable=False, default=False)
    rtgs     = Column(Boolean, nullable=False, default=False)
    neft     = Column(Boolean, nullable=False, default=False)
    upi      = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class IfscDatasetMeta(Base):
    """Single-row bookkeeping for the imported IFSC dataset (release tag,
    row count, import time). Used to decide whether the local directory is
    authoritative and to show dataset freshness."""
    __tablename__ = "ifsc_dataset_meta"

    id          = Column(Integer, primary_key=True)
    version     = Column(String(40), nullable=False)     # release tag, e.g. v2.0.60
    row_count   = Column(Integer, nullable=False, default=0)
    imported_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
