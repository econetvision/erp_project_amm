from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

Plan = Literal["basic", "pro", "enterprise"]
SubscriptionStatus = Literal["trial", "active", "past_due", "suspended", "cancelled"]
BillingCycle = Literal["monthly", "yearly"]


class SubscriptionCreate(BaseModel):
    company_id:    int
    plan:          Plan = "basic"
    status:        SubscriptionStatus = "active"
    billing_cycle: BillingCycle = "yearly"
    starts_at:     Optional[datetime] = None
    ends_at:       Optional[datetime] = None
    unit_price:    Decimal = Field(Decimal("0"), ge=0)
    currency:      Optional[str] = Field(None, min_length=3, max_length=3)   # None -> company currency
    tax_rate:      Decimal = Field(Decimal("18.00"), ge=0, le=100)
    features:      Optional[dict] = None
    notes:         Optional[str] = None
    # Convenience: grant this many company-wide licences on creation.
    initial_licenses: int = Field(0, ge=0, le=100)


class SubscriptionUpdate(BaseModel):
    plan:          Optional[Plan] = None
    status:        Optional[SubscriptionStatus] = None
    billing_cycle: Optional[BillingCycle] = None
    starts_at:     Optional[datetime] = None
    ends_at:       Optional[datetime] = None
    unit_price:    Optional[Decimal] = Field(None, ge=0)
    currency:      Optional[str] = Field(None, min_length=3, max_length=3)
    tax_rate:      Optional[Decimal] = Field(None, ge=0, le=100)
    features:      Optional[dict] = None
    notes:         Optional[str] = None


class LicenseGrant(BaseModel):
    subscription_id: int
    site_id:         Optional[int] = None
    quantity:        int = Field(1, ge=1, le=100)
    max_users:       Optional[int] = Field(26, ge=1)
    max_admins:      int = Field(1, ge=0)
    unlimited:       bool = False                        # True -> max_users stored as NULL


class LicenseRevoke(BaseModel):
    reason: Optional[str] = None


class LicenseResponse(BaseModel):
    id:              int
    subscription_id: int
    company_id:      int
    site_id:         Optional[int] = None
    site_name:       Optional[str] = None
    license_key:     str
    status:          str
    max_users:       Optional[int] = None
    max_admins:      int
    granted_by:      Optional[int] = None
    granted_at:      Optional[datetime] = None
    revoked_by:      Optional[int] = None
    revoked_at:      Optional[datetime] = None
    revoke_reason:   Optional[str] = None
    created_at:      Optional[datetime] = None

    model_config = {"from_attributes": True}


class SubscriptionResponse(BaseModel):
    id:            int
    company_id:    int
    company_name:  Optional[str] = None
    plan:          str
    status:        str
    billing_cycle: str
    starts_at:     Optional[datetime] = None
    ends_at:       Optional[datetime] = None
    unit_price:    Decimal
    currency:      str
    tax_rate:      Decimal
    features:      Optional[dict] = None
    notes:         Optional[str] = None
    created_at:    Optional[datetime] = None
    updated_at:    Optional[datetime] = None

    # Derived
    capacity:        Optional[int] = None     # None = unlimited
    admin_cap:       int = 0
    seats_used:      int = 0
    admins_used:     int = 0
    active_licenses: int = 0
    is_valid:        bool = True
    reason_code:     Optional[str] = None
    reason:          Optional[str] = None

    model_config = {"from_attributes": True}


class MySubscriptionResponse(SubscriptionResponse):
    licenses:        list[LicenseResponse] = []
    days_to_renewal: Optional[int] = None
