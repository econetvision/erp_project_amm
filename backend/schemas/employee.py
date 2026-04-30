from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from datetime import datetime
from typing import Optional, Literal
import re


class EmployeeBase(BaseModel):
    name:                str     = Field(..., min_length=1, max_length=255)
    address:             str     = Field(..., min_length=1)
    aadhar_number:       str     = Field(..., min_length=12, max_length=12)
    bank_account_number: str     = Field(..., min_length=8, max_length=18)
    hourly_rate:         Decimal = Field(..., ge=0, decimal_places=2)
    shift:               Literal["SHIFT_A", "SHIFT_B"] = "SHIFT_A"

    @field_validator("aadhar_number")
    @classmethod
    def validate_aadhar(cls, v: str) -> str:
        if not re.fullmatch(r"\d{12}", v):
            raise ValueError("Aadhar number must be exactly 12 digits")
        return v


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name:                Optional[str]     = Field(None, min_length=1, max_length=255)
    address:             Optional[str]     = Field(None, min_length=1)
    aadhar_number:       Optional[str]     = Field(None, min_length=12, max_length=12)
    bank_account_number: Optional[str]     = Field(None, min_length=8, max_length=18)
    hourly_rate:         Optional[Decimal] = Field(None, ge=0)
    shift:               Optional[Literal["SHIFT_A", "SHIFT_B"]] = None


class EmployeeResponse(BaseModel):
    id:                  int
    name:                str
    address:             str
    aadhar_number:       str
    bank_account_number: str
    hourly_rate:         Decimal
    shift:               str
    photo:               Optional[str] = None
    created_at:          datetime
    updated_at:          datetime

    model_config = {"from_attributes": True}
