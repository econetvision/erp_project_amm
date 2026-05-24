from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime, date
from typing import Optional, Literal


# ── Salary Structure ──────────────────────────────────────────────────────────

class SalaryComponentCreate(BaseModel):
    name:                 str = Field(..., max_length=100)
    type:                 Literal["earning", "deduction"]
    calculation_type:     Literal["fixed", "percentage_of_basic", "percentage_of_gross"]
    amount_or_percentage: Decimal = Field(..., ge=0)
    is_mandatory:         bool = True
    display_order:        int = 0


class SalaryComponentResponse(BaseModel):
    id:                   int
    structure_id:         int
    name:                 str
    type:                 str
    calculation_type:     str
    amount_or_percentage: Decimal
    is_mandatory:         bool
    display_order:        int

    model_config = {"from_attributes": True}


class SalaryStructureCreate(BaseModel):
    name:        str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_default:  bool = False
    components:  list[SalaryComponentCreate] = []


class SalaryStructureUpdate(BaseModel):
    name:        Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    is_default:  Optional[bool] = None
    components:  Optional[list[SalaryComponentCreate]] = None


class SalaryStructureResponse(BaseModel):
    id:          int
    name:        str
    description: Optional[str] = None
    is_default:  bool
    components:  list[SalaryComponentResponse] = []
    created_at:  datetime

    model_config = {"from_attributes": True}


# ── Employee Salary Assignment ────────────────────────────────────────────────

class EmployeeSalaryCreate(BaseModel):
    structure_id: int
    basic_pay:    Decimal = Field(..., gt=0)


class EmployeeSalaryResponse(BaseModel):
    id:             int
    employee_id:    int
    structure_id:   int
    basic_pay:      Decimal
    effective_from: datetime
    effective_to:   Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Advance ───────────────────────────────────────────────────────────────────

class AdvanceCreate(BaseModel):
    employee_id:      int
    amount:           Decimal = Field(..., gt=0)
    disbursed_date:   date
    repayment_months: int = Field(..., ge=1, le=60)
    notes:            Optional[str] = None


class AdvanceResponse(BaseModel):
    id:                int
    employee_id:       int
    amount:            Decimal
    disbursed_date:    date
    repayment_months:  int
    monthly_deduction: Decimal
    remaining_balance: Decimal
    status:            str
    notes:             Optional[str] = None
    created_at:        datetime

    model_config = {"from_attributes": True}


# ── Payroll Run ───────────────────────────────────────────────────────────────

class PayrollRunCreate(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year:  int = Field(..., gt=2000)


class PayrollItemResponse(BaseModel):
    id:                   int
    run_id:               int
    employee_id:          int
    basic_pay:            Decimal
    earnings_breakdown:   dict
    deductions_breakdown: dict
    days_worked:          int
    overtime_hours:       Decimal
    overtime_pay:         Decimal
    gross_pay:            Decimal
    total_deductions:     Decimal
    advance_deduction:    Decimal
    net_pay:              Decimal
    status:               str
    employee_name:        Optional[str] = None

    model_config = {"from_attributes": True}


class PayrollRunResponse(BaseModel):
    id:               int
    month:            int
    year:             int
    status:           str
    run_by:           Optional[int] = None
    started_at:       datetime
    completed_at:     Optional[datetime] = None
    total_gross:      Optional[Decimal] = None
    total_net:        Optional[Decimal] = None
    total_deductions: Optional[Decimal] = None
    employee_count:   Optional[int] = None

    model_config = {"from_attributes": True}


class PayrollRunDetailResponse(PayrollRunResponse):
    items: list[PayrollItemResponse] = []
