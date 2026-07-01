from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from datetime import datetime, date
from typing import Optional, Literal
import re


class EmployeeBase(BaseModel):
    name:                str     = Field(..., min_length=1, max_length=255)
    gender:              Optional[Literal["male", "female", "other"]] = None
    date_of_birth:       Optional[date] = None
    blood_group:         Optional[str] = None
    marital_status:      Optional[Literal["single", "married", "divorced", "widowed"]] = None
    emergency_contact:   Optional[str] = None
    emergency_name:      Optional[str] = None
    phone:               Optional[str] = Field(None, max_length=20)
    email:               Optional[str] = Field(None, max_length=255)
    address:             str     = Field(..., min_length=1)
    aadhar_number:       str     = Field(..., min_length=12, max_length=12)
    bank_account_number: str          = Field(..., min_length=8, max_length=18)
    ifsc_code:           Optional[str] = None
    hourly_rate:         Decimal = Field(..., ge=0, decimal_places=2)
    shift:               Literal["SHIFT_A", "SHIFT_B"] = "SHIFT_A"
    work_location_name:  Optional[str] = Field(None, max_length=255)
    work_latitude:       Optional[float] = None
    work_longitude:      Optional[float] = None
    attendance_radius_m: Optional[float] = Field(50.0, ge=1, le=5000)

    @field_validator("aadhar_number")
    @classmethod
    def validate_aadhar(cls, v: str) -> str:
        if not re.fullmatch(r"\d{12}", v):
            raise ValueError("Aadhar number must be exactly 12 digits")
        return v

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", v):
            raise ValueError("IFSC code must be 11 characters: 4 letters + 0 + 6 alphanumeric")
        return v


class EmployeeCreate(EmployeeBase):
    username: Optional[str] = None  # Auto-generated if not provided
    password: Optional[str] = None  # Auto-generated if not provided
    role: Optional[Literal["worker", "supervisor"]] = "worker"
    company_id: Optional[int] = None


class EmployeeUpdate(BaseModel):
    name:                Optional[str]     = Field(None, min_length=1, max_length=255)
    gender:              Optional[str]     = None
    date_of_birth:       Optional[date]    = None
    blood_group:         Optional[str]     = None
    marital_status:      Optional[str]     = None
    emergency_contact:   Optional[str]     = None
    emergency_name:      Optional[str]     = None
    phone:               Optional[str]     = Field(None, max_length=20)
    email:               Optional[str]     = Field(None, max_length=255)
    address:             Optional[str]     = Field(None, min_length=1)
    aadhar_number:       Optional[str]     = Field(None, min_length=12, max_length=12)
    bank_account_number: Optional[str]     = Field(None, min_length=8, max_length=18)
    ifsc_code:           Optional[str] = None
    hourly_rate:         Optional[Decimal] = Field(None, ge=0)
    shift:               Optional[Literal["SHIFT_A", "SHIFT_B"]] = None
    work_location_name:  Optional[str] = Field(None, max_length=255)
    work_latitude:       Optional[float] = None
    work_longitude:      Optional[float] = None
    attendance_radius_m: Optional[float] = Field(None, ge=1, le=5000)


class EmployeeCreateResponse(BaseModel):
    """Response for employee creation - includes generated credentials"""
    id:                  int
    username:            str
    generated_password:  str  # Only returned on creation
    role:                str
    company_id:          Optional[int] = None
    name:                Optional[str] = None
    aadhar_number:       Optional[str] = None
    onboarding_complete: bool = False
    created_at:          datetime

    model_config = {"from_attributes": True}


class EmployeeResponse(BaseModel):
    id:                  int
    employee_code:       Optional[str] = None
    username:            Optional[str] = None
    role:                Optional[str] = None
    company_id:          Optional[int] = None
    name:                Optional[str] = None
    gender:              Optional[str] = None
    date_of_birth:       Optional[date] = None
    blood_group:         Optional[str] = None
    marital_status:      Optional[str] = None
    emergency_contact:   Optional[str] = None
    emergency_name:      Optional[str] = None
    phone:               Optional[str] = None
    email:               Optional[str] = None
    phone_verified:      Optional[str] = None
    email_verified:      Optional[str] = None
    address:             Optional[str] = None
    aadhar_number:       Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code:           Optional[str] = None
    bank_name:           Optional[str] = None
    kyc_status:          Optional[str] = None
    kyc_verified_name:   Optional[str] = None
    hourly_rate:         Optional[Decimal] = None
    shift:               Optional[str] = None
    photo:               Optional[str] = None
    work_location_name:  Optional[str] = None
    work_latitude:       Optional[float] = None
    work_longitude:      Optional[float] = None
    attendance_radius_m: Optional[float] = None
    onboarding_complete: Optional[bool] = False
    created_at:          datetime
    updated_at:          datetime

    model_config = {"from_attributes": True}


class WorkLocationUpdateSchema(BaseModel):
    """Schema for supervisor to update only work location"""
    work_location_name:  Optional[str] = Field(None, max_length=255)
    work_latitude:       Optional[float] = None
    work_longitude:      Optional[float] = None
    attendance_radius_m: Optional[float] = Field(None, ge=1, le=5000)
