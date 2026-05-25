from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal
from datetime import datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username:     str
    password:     str
    role:         Literal["master", "admin", "supervisor", "worker"]
    company_id:   Optional[int] = None
    email:        Optional[str] = None
    display_name: Optional[str] = None
    phone:        Optional[str] = None


class ThemePreference(BaseModel):
    mode: Literal["light", "dark", "custom"] = "light"
    primaryColor: Optional[str] = "#0d6efd"
    accentColor: Optional[str] = "#4ea8e8"


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=255)
    email:        Optional[str] = Field(None, max_length=255)
    phone:        Optional[str] = Field(None, max_length=20)
    lock_timeout: Optional[int] = Field(None, ge=1, le=60)
    theme_preference: Optional[dict] = None


class AdminUserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=255)
    email:        Optional[str] = Field(None, max_length=255)
    phone:        Optional[str] = Field(None, max_length=20)
    role:         Optional[Literal["master", "admin", "supervisor", "worker"]] = None
    company_id:   Optional[int] = None
    password:     Optional[str] = Field(None, min_length=4)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password:     str = Field(..., min_length=4)


class UserResponse(BaseModel):
    id:           int
    username:     str
    role:         str
    company_id:   Optional[int] = None
    email:        Optional[str] = None
    display_name: Optional[str] = None
    phone:        Optional[str] = None
    photo_path:   Optional[str] = None
    name:         Optional[str] = None
    has_pin:      bool = False
    lock_timeout: Optional[int] = None
    theme_preference: Optional[dict] = None
    is_active:    Optional[bool] = True
    created_at:   Optional[datetime] = None
    updated_at:   Optional[datetime] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def compute_has_pin(cls, data):
        if hasattr(data, "pin_hash"):
            pin = data.pin_hash
        elif isinstance(data, dict):
            pin = data.get("pin_hash")
        else:
            pin = None
        if isinstance(data, dict):
            data["has_pin"] = bool(pin)
        return data


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    username:     str
    company_id:   Optional[int] = None
    employee_id:  Optional[int] = None
    email:        Optional[str] = None
    display_name: Optional[str] = None
    lock_timeout: Optional[int] = None
    has_pin:      bool = False
    theme_preference: Optional[dict] = None
