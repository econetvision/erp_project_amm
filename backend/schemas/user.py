from pydantic import BaseModel
from typing import Optional, Literal


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username:    str
    password:    str
    role:        Literal["admin", "supervisor", "worker"]
    employee_id: Optional[int] = None


class UserResponse(BaseModel):
    id:          int
    username:    str
    role:        str
    employee_id: Optional[int] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    username:     str
    employee_id:  Optional[int] = None
