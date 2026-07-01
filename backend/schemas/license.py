from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LicenseCreate(BaseModel):
    company_id:  int
    tier:        str = Field("basic", max_length=20)
    status:      str = Field("active", max_length=20)
    max_seats:   Optional[int] = Field(None, ge=1)
    valid_until: Optional[datetime] = None          # None = perpetual
    features:    Optional[dict] = None
    notes:       Optional[str] = None
    license_key: Optional[str] = None               # auto-generated when omitted


class LicenseUpdate(BaseModel):
    tier:        Optional[str] = Field(None, max_length=20)
    status:      Optional[str] = Field(None, max_length=20)   # active | suspended
    max_seats:   Optional[int] = Field(None, ge=1)
    valid_until: Optional[datetime] = None
    features:    Optional[dict] = None
    notes:       Optional[str] = None


class LicenseResponse(BaseModel):
    id:          int
    company_id:  int
    license_key: str
    tier:        str
    status:      str
    max_seats:   Optional[int] = None
    valid_from:  Optional[datetime] = None
    valid_until: Optional[datetime] = None
    features:    Optional[dict] = None
    notes:       Optional[str] = None
    created_at:  Optional[datetime] = None
    updated_at:  Optional[datetime] = None

    # Derived, filled in by the router/service
    is_valid:    bool = True
    seats_used:  int = 0
    reason:      Optional[str] = None

    model_config = {"from_attributes": True}
