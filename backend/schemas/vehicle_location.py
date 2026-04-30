from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LocationPush(BaseModel):
    vehicle_id: int
    latitude:   float = Field(..., ge=-90,  le=90)
    longitude:  float = Field(..., ge=-180, le=180)
    speed:      Optional[float] = None


class LocationResponse(BaseModel):
    id:          int
    vehicle_id:  int
    latitude:    float
    longitude:   float
    speed:       Optional[float]
    recorded_at: datetime

    model_config = {"from_attributes": True}


class LatestLocationResponse(BaseModel):
    vehicle_id:    int
    reg_number:    str
    type:          str
    status:        str
    employee_id:   Optional[int]
    employee_name: Optional[str]
    latitude:      Optional[float]
    longitude:     Optional[float]
    speed:         Optional[float]
    recorded_at:   Optional[datetime]
