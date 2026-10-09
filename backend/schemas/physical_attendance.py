from datetime import date, time
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SupervisorSiteResponse(BaseModel):
    id:           int
    username:     str
    display_name: Optional[str] = None
    name:         Optional[str] = None
    is_active:    bool = True
    company_id:   Optional[int] = None
    must_change_password: bool = False
    site_id:      Optional[int] = None
    site_name:    Optional[str] = None


class SiteAssignRequest(BaseModel):
    # Required key; null clears the assignment (disables physical attendance).
    location_id: Optional[int]


class MySiteResponse(BaseModel):
    # Deliberately no coordinates or radius: the server alone decides whether
    # the phone is at the site.
    id:            int
    location_name: str

    model_config = {"from_attributes": True}


class ScanRequest(BaseModel):
    image:     str  # base64-encoded image
    latitude:  Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class ScanResponse(BaseModel):
    employee_id:   int
    employee_name: str
    employee_code: Optional[str] = None
    action:        Literal["clock_in", "clock_out"]
    time:          time


class TodayEntry(BaseModel):
    employee_id:   int
    name:          str
    employee_code: Optional[str] = None
    entry_time:    time
    exit_time:     Optional[time] = None


class TodayResponse(BaseModel):
    site_name:     str
    date:          date
    present_count: int
    entries:       list[TodayEntry]
