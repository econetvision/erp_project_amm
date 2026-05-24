from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class WorkLocationBase(BaseModel):
    location_name:     str   = Field(..., min_length=1, max_length=255)
    location_code:     Optional[str] = Field(None, max_length=50)
    address:           Optional[str] = None
    city:              Optional[str] = Field(None, max_length=100)
    state:             Optional[str] = Field(None, max_length=100)
    pincode:           Optional[str] = Field(None, max_length=10)
    latitude:          float = Field(..., ge=-90, le=90)
    longitude:         float = Field(..., ge=-180, le=180)
    allowed_radius_km: float = Field(10.0, ge=0.1, le=100)
    work_type:         Optional[Literal["dump_yard", "office", "site", "depot"]] = None
    supervisor_id:     Optional[int] = None
    is_active:         bool = True


class WorkLocationCreate(WorkLocationBase):
    pass


class WorkLocationUpdate(BaseModel):
    location_name:     Optional[str]   = Field(None, min_length=1, max_length=255)
    location_code:     Optional[str]   = Field(None, max_length=50)
    address:           Optional[str]   = None
    city:              Optional[str]   = Field(None, max_length=100)
    state:             Optional[str]   = Field(None, max_length=100)
    pincode:           Optional[str]   = Field(None, max_length=10)
    latitude:          Optional[float] = Field(None, ge=-90, le=90)
    longitude:         Optional[float] = Field(None, ge=-180, le=180)
    allowed_radius_km: Optional[float] = Field(None, ge=0.1, le=100)
    work_type:         Optional[str]   = None
    supervisor_id:     Optional[int]   = None
    is_active:         Optional[bool]  = None


class WorkLocationResponse(BaseModel):
    id:                int
    location_name:     str
    location_code:     Optional[str] = None
    address:           Optional[str] = None
    city:              Optional[str] = None
    state:             Optional[str] = None
    pincode:           Optional[str] = None
    latitude:          float
    longitude:         float
    allowed_radius_km: float
    work_type:         Optional[str] = None
    supervisor_id:     Optional[int] = None
    is_active:         bool
    created_by:        Optional[int] = None
    employee_count:    int = 0
    created_at:        Optional[datetime] = None
    updated_at:        Optional[datetime] = None

    model_config = {"from_attributes": True}


class EmployeeLocationAssignmentCreate(BaseModel):
    employee_id:  int
    location_id:  int
    is_primary:   bool = False


class EmployeeLocationAssignmentResponse(BaseModel):
    id:           int
    employee_id:  int
    location_id:  int
    is_primary:   bool
    assigned_by:  Optional[int] = None
    assigned_at:  Optional[datetime] = None
    location_name: Optional[str] = None
    employee_name: Optional[str] = None

    model_config = {"from_attributes": True}


class BulkAssignRequest(BaseModel):
    employee_ids: list[int] = Field(..., min_length=1)
    location_id:  int
    is_primary:   bool = False
