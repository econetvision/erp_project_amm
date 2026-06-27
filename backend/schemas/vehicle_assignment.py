from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AssignRequest(BaseModel):
    vehicle_id:  int
    employee_id: int
    notes:       Optional[str] = None


class AssignmentResponse(BaseModel):
    id:          int
    vehicle_id:  int
    employee_id: int
    assigned_at: datetime
    released_at: Optional[datetime]
    notes:       Optional[str]
    # denormalized for convenience
    employee_name: Optional[str] = None
    reg_number:    Optional[str] = None

    model_config = {"from_attributes": True}


class MyAssignmentResponse(BaseModel):
    vehicle_id:  int
    reg_number:  str
    type:        str
    assigned_at: datetime
