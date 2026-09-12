from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GeofencePingRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy_m: Optional[float] = Field(None, ge=0)
    # Admin/supervisor may ping on behalf of another employee (e.g. a shared
    # device). Workers may only ping for themselves; omitted means "me".
    employee_id: Optional[int] = None


class GeofencePingResponse(BaseModel):
    tracking: bool
    inside: bool
    distance_m: Optional[float] = None
    nearest_location: Optional[str] = None
    ping_interval_s: int
    event: Optional[str] = None  # "exit" | "return" | None


class GeofenceExitEventResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    location_id: Optional[int] = None
    location_name: Optional[str] = None
    distance_m: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    exited_at: datetime
    returned_at: Optional[datetime] = None
    notified_user_ids: Optional[list[int]] = None

    model_config = {"from_attributes": True}


class DeviceTokenRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=512)
    platform: str = Field("android", max_length=20)


class DeviceTokenDeleteRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=512)
