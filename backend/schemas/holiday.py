from datetime import date, datetime
from pydantic import BaseModel, Field


class HolidayCreate(BaseModel):
    date: date
    name: str = Field(..., min_length=1, max_length=120)


class HolidayResponse(BaseModel):
    id:         int
    date:       date
    name:       str
    created_at: datetime

    model_config = {"from_attributes": True}
