from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class VehicleCreate(BaseModel):
    reg_number: str = Field(..., min_length=1, max_length=20)
    type:       Literal["truck", "auto", "van", "bike", "other"]
    make:       Optional[str] = Field(None, max_length=100)
    model:      Optional[str] = Field(None, max_length=100)


class VehicleUpdate(BaseModel):
    reg_number: Optional[str]  = Field(None, min_length=1, max_length=20)
    type:       Optional[Literal["truck", "auto", "van", "bike", "other"]] = None
    make:       Optional[str]  = Field(None, max_length=100)
    model:      Optional[str]  = Field(None, max_length=100)
    status:     Optional[Literal["available", "assigned", "maintenance"]] = None


class VehicleResponse(BaseModel):
    id:         int
    reg_number: str
    type:       str
    make:       Optional[str]
    model:      Optional[str]
    status:     str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
