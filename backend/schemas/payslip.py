from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime


class PayslipGenerateRequest(BaseModel):
    employee_id: int
    month:       int = Field(..., ge=1, le=12)
    year:        int = Field(..., ge=2000)


class PayslipResponse(BaseModel):
    id:            int
    employee_id:   int
    month:         int
    year:          int
    days_worked:   int
    total_hours:   Decimal
    hourly_rate:   Decimal
    daily_rate:    Decimal
    gross_pay:     Decimal
    esi:           Decimal
    pf:            Decimal
    net_pay:       Decimal
    generated_at:  datetime
    employee_name: str

    model_config = {"from_attributes": True}
