from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Optional, Literal


class HolidayCreate(BaseModel):
    date: date
    name: str = Field(..., min_length=1, max_length=120)
    holiday_type: Literal["public", "company", "optional"] = "public"
    is_optional: bool = False


class HolidayResponse(BaseModel):
    id:           int
    date:         date
    name:         str
    holiday_type: str
    is_optional:  bool
    created_at:   datetime

    model_config = {"from_attributes": True}
