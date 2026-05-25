from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CompanyCreate(BaseModel):
    name:       str = Field(..., min_length=1, max_length=255)
    code:       str = Field(..., min_length=1, max_length=50)
    address:    Optional[str] = None
    city:       Optional[str] = None
    state:      Optional[str] = None
    country:    Optional[str] = "India"
    pincode:    Optional[str] = None
    phone:      Optional[str] = None
    email:      Optional[str] = None
    website:    Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    timezone:   Optional[str] = "Asia/Kolkata"
    currency:   Optional[str] = "INR"


class CompanyUpdate(BaseModel):
    name:       Optional[str] = Field(None, max_length=255)
    code:       Optional[str] = Field(None, max_length=50)
    address:    Optional[str] = None
    city:       Optional[str] = None
    state:      Optional[str] = None
    country:    Optional[str] = None
    pincode:    Optional[str] = None
    phone:      Optional[str] = None
    email:      Optional[str] = None
    website:    Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    timezone:   Optional[str] = None
    currency:   Optional[str] = None
    is_active:  Optional[bool] = None
    theme_config:     Optional[dict] = None
    payroll_config:   Optional[dict] = None
    attendance_config: Optional[dict] = None
    features:         Optional[dict] = None


class CompanyResponse(BaseModel):
    id:         int
    name:       str
    code:       str
    logo_path:  Optional[str] = None
    address:    Optional[str] = None
    city:       Optional[str] = None
    state:      Optional[str] = None
    country:    Optional[str] = None
    pincode:    Optional[str] = None
    phone:      Optional[str] = None
    email:      Optional[str] = None
    website:    Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    timezone:   Optional[str] = None
    currency:   Optional[str] = None
    is_active:  bool = True
    theme_config:     Optional[dict] = None
    payroll_config:   Optional[dict] = None
    attendance_config: Optional[dict] = None
    features:         Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CompanyStats(BaseModel):
    id:               int
    name:             str
    code:             str
    is_active:        bool
    employee_count:   int = 0
    user_count:       int = 0
    active_employees: int = 0
