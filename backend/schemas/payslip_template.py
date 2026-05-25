from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


# ── Default layout structure for new templates ──────────────────────
DEFAULT_LAYOUT: dict = {
    "paperSize": "A4",
    "orientation": "portrait",
    "margins": {"top": 20, "right": 20, "bottom": 20, "left": 20},
    "showHeader": True,
    "showFooter": True,
    "showLogo": True,
    "showSignature": True,
    "primaryColor": "#0d6efd",
    "headerBg": "#0d6efd",
    "headerTextColor": "#ffffff",
    "fontFamily": "Arial, sans-serif",
    "fontSize": 14,
    "sections": [
        {
            "id": "company_header",
            "type": "header",
            "label": "Company Header",
            "enabled": True,
            "order": 0,
        },
        {
            "id": "employee_details",
            "type": "info",
            "label": "Employee Details",
            "enabled": True,
            "order": 1,
            "fields": [
                {"key": "name", "label": "Employee Name", "enabled": True},
                {"key": "id", "label": "Employee ID", "enabled": True},
                {"key": "aadhar_number", "label": "Aadhar Number", "enabled": True, "masked": True},
                {"key": "bank_account_number", "label": "Bank Account", "enabled": True},
                {"key": "shift", "label": "Shift", "enabled": True},
                {"key": "department", "label": "Department", "enabled": True},
                {"key": "designation", "label": "Designation", "enabled": True},
                {"key": "work_location", "label": "Work Location", "enabled": False},
                {"key": "phone", "label": "Phone", "enabled": False},
                {"key": "email", "label": "Email", "enabled": False},
            ],
        },
        {
            "id": "pay_period",
            "type": "info",
            "label": "Pay Period",
            "enabled": True,
            "order": 2,
            "fields": [
                {"key": "month_year", "label": "Pay Period", "enabled": True},
                {"key": "generated_at", "label": "Generated On", "enabled": True},
            ],
        },
        {
            "id": "earnings",
            "type": "table",
            "label": "Earnings",
            "enabled": True,
            "order": 3,
            "fields": [
                {"key": "days_worked", "label": "Days Worked", "enabled": True},
                {"key": "total_hours", "label": "Total Hours", "enabled": True},
                {"key": "hourly_rate", "label": "Hourly Rate", "enabled": True},
                {"key": "daily_rate", "label": "Daily Rate", "enabled": True},
                {"key": "overtime_hours", "label": "Overtime Hours", "enabled": True},
                {"key": "overtime_pay", "label": "Overtime Pay", "enabled": True},
                {"key": "gross_pay", "label": "Gross Pay", "enabled": True},
            ],
        },
        {
            "id": "deductions",
            "type": "table",
            "label": "Deductions",
            "enabled": True,
            "order": 4,
            "fields": [
                {"key": "esi", "label": "ESI (0.75%)", "enabled": True},
                {"key": "pf", "label": "PF (12%)", "enabled": True},
                {"key": "professional_tax", "label": "Professional Tax", "enabled": False},
                {"key": "advance_deduction", "label": "Advance Deduction", "enabled": True},
                {"key": "other_deductions", "label": "Other Deductions", "enabled": False},
            ],
        },
        {
            "id": "net_pay",
            "type": "summary",
            "label": "Net Pay",
            "enabled": True,
            "order": 5,
        },
        {
            "id": "formula",
            "type": "note",
            "label": "Calculation Formula",
            "enabled": True,
            "order": 6,
        },
        {
            "id": "footer",
            "type": "footer",
            "label": "Footer & Signature",
            "enabled": True,
            "order": 7,
        },
    ],
}


# ── Schemas ─────────────────────────────────────────────────────────

class PayslipTemplateCreate(BaseModel):
    name: str = Field(..., max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    company_id: Optional[int] = None
    is_default: bool = False
    layout: dict = Field(default_factory=lambda: DEFAULT_LAYOUT.copy())
    logo_url: Optional[str] = None
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    footer_text: Optional[str] = None
    signature_label: Optional[str] = None


class PayslipTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    layout: Optional[dict] = None
    logo_url: Optional[str] = None
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    footer_text: Optional[str] = None
    signature_label: Optional[str] = None


class PayslipTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    company_id: Optional[int]
    is_default: bool
    is_active: bool
    layout: dict
    logo_url: Optional[str]
    company_name: Optional[str]
    company_address: Optional[str]
    company_phone: Optional[str]
    company_email: Optional[str]
    footer_text: Optional[str]
    signature_label: Optional[str]
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
