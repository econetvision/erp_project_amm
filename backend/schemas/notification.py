from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class NotificationResponse(BaseModel):
    id:         int
    user_id:    int
    title:      str
    body:       Optional[str] = None
    type:       str
    is_read:    bool
    created_at: datetime

    model_config = {"from_attributes": True}
