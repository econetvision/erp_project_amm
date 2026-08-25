from pydantic import BaseModel
from decimal import Decimal
from datetime import date, time, datetime
from typing import Optional


class AttendanceClockIn(BaseModel):
    employee_id: int
    date:        date
    entry_time:  time
    image:       str        # base64 face photo — required for verification
    latitude:    Optional[float] = None
    longitude:   Optional[float] = None


class AttendanceClockOut(BaseModel):
    exit_time:  time
    image:      str        # base64 face photo — required for verification
    latitude:   Optional[float] = None
    longitude:  Optional[float] = None


class AttendanceManualClockIn(BaseModel):
    """Clock-in without face verification (fallback when face capture is unavailable)."""
    employee_id: int
    date:        date
    entry_time:  time
    latitude:    Optional[float] = None
    longitude:   Optional[float] = None


class AttendanceManualClockOut(BaseModel):
    """Clock-out without face verification."""
    exit_time:  time
    latitude:   Optional[float] = None
    longitude:  Optional[float] = None


class AttendanceUpdate(BaseModel):
    date:       Optional[date] = None
    entry_time: Optional[time] = None
    exit_time:  Optional[time] = None


class AttendanceResponse(BaseModel):
    id:                  int
    employee_id:         int
    date:                date
    entry_time:          time
    exit_time:           Optional[time]
    hours_worked:        Optional[Decimal]
    clock_in_latitude:   Optional[float] = None
    clock_in_longitude:  Optional[float] = None
    clock_out_latitude:  Optional[float] = None
    clock_out_longitude: Optional[float] = None
    created_at:          datetime
    updated_at:          datetime

    model_config = {"from_attributes": True}


class MonthlyAttendanceSummary(BaseModel):
    employee_id:   int
    employee_name: Optional[str] = None
    month:         int
    year:          int
    total_days:    int
    total_hours:   Decimal
    records:       list[AttendanceResponse]


# ── Dashboard schemas ────────────────────────────────────────────────────────

class DailyOverviewEntry(BaseModel):
    date:            date
    present_count:   int
    absent_count:    int
    late_count:      int
    total_employees: int


class DashboardOverviewResponse(BaseModel):
    month:           int
    year:            int
    total_employees: int
    working_days:    int
    daily_entries:   list[DailyOverviewEntry]


class EmployeeStatEntry(BaseModel):
    employee_id:     int
    name:            Optional[str] = None
    shift:           Optional[str] = None
    days_present:    int
    days_absent:     int
    attendance_rate: float
    late_days:       int
    overtime_hours:  float


class DailyEmployeeStatus(BaseModel):
    employee_id:    int
    name:           str
    shift:          str
    status:         str   # "present" | "absent" | "holiday"
    entry_time:     Optional[time]
    exit_time:      Optional[time]
    hours_worked:   Optional[Decimal]
    is_late:        bool
    overtime_hours: float



# ── Missed attendance schemas ────────────────────────────────────────────────

class MissedDayDetail(BaseModel):
    date:       date
    reason:     str   # "absent" | "incomplete" | "late"
    entry_time: Optional[time] = None
    exit_time:  Optional[time] = None


class MissedAttendanceEntry(BaseModel):
    employee_id:     int
    employee_code:   Optional[str] = None
    name:            Optional[str] = None
    shift:           Optional[str] = None
    missed_days:     int
    absent_days:     int
    incomplete_days: int
    late_days:       int
    details:         list[MissedDayDetail]


class MissedAttendanceResponse(BaseModel):
    period:                str   # "daily" | "weekly" | "monthly"
    start_date:            date
    end_date:              date
    working_days:          int
    total_employees:       int
    employees_with_misses: int
    total_absent:          int
    total_incomplete:      int
    total_late:            int
    total_missed:          int
    employees:             list[MissedAttendanceEntry]
