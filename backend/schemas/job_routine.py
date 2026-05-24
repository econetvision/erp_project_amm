from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class JobRoutineCreate(BaseModel):
    name:                 str = Field(..., min_length=1, max_length=255)
    type:                 Literal["absent_report", "late_report", "custom"]
    frequency:            Literal["daily", "weekly", "monthly"]
    schedule_time:        str = Field("08:00", pattern=r"^\d{2}:\d{2}$")
    schedule_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    schedule_day_of_month: Optional[int] = Field(None, ge=1, le=28)
    delivery_channels:    dict = {"email": True, "in_app": True, "whatsapp": False}
    recipients:           list = []
    filters:              Optional[dict] = None
    is_active:            bool = True


class JobRoutineUpdate(BaseModel):
    name:                 Optional[str] = Field(None, min_length=1, max_length=255)
    type:                 Optional[Literal["absent_report", "late_report", "custom"]] = None
    frequency:            Optional[Literal["daily", "weekly", "monthly"]] = None
    schedule_time:        Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    schedule_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    schedule_day_of_month: Optional[int] = Field(None, ge=1, le=28)
    delivery_channels:    Optional[dict] = None
    recipients:           Optional[list] = None
    filters:              Optional[dict] = None
    is_active:            Optional[bool] = None


class JobRoutineResponse(BaseModel):
    id:                   int
    name:                 str
    type:                 str
    frequency:            str
    schedule_time:        str
    schedule_day_of_week: Optional[int] = None
    schedule_day_of_month: Optional[int] = None
    delivery_channels:    dict
    recipients:           list
    filters:              Optional[dict] = None
    is_active:            bool
    created_by:           Optional[int] = None
    created_at:           datetime
    updated_at:           datetime

    model_config = {"from_attributes": True}


class JobRoutineLogResponse(BaseModel):
    id:             int
    job_id:         int
    executed_at:    datetime
    status:         str
    result_summary: Optional[str] = None
    error_message:  Optional[str] = None

    model_config = {"from_attributes": True}


class JobDetailResponse(JobRoutineResponse):
    recent_logs: list[JobRoutineLogResponse] = []
