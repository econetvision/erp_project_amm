from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PermissionResponse(BaseModel):
    id:          int
    code:        str
    name:        str
    module:      str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name:        str = Field(..., max_length=50)
    company_id:  Optional[int] = None
    description: Optional[str] = None
    permissions: List[int] = []


class RoleUpdate(BaseModel):
    name:        Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    permissions: Optional[List[int]] = None


class RoleResponse(BaseModel):
    id:          int
    name:        str
    company_id:  Optional[int] = None
    is_system:   bool = False
    description: Optional[str] = None
    permissions: List[PermissionResponse] = []
    created_at:  Optional[datetime] = None

    model_config = {"from_attributes": True}


class AuditLogResponse(BaseModel):
    id:          int
    user_id:     Optional[int] = None
    company_id:  Optional[int] = None
    action:      str
    entity_type: Optional[str] = None
    entity_id:   Optional[int] = None
    details:     Optional[str] = None
    ip_address:  Optional[str] = None
    created_at:  Optional[datetime] = None

    model_config = {"from_attributes": True}
