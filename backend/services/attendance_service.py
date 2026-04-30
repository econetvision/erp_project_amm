from datetime import time, date
import calendar as _calendar
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from models.attendance import Attendance
from config.shifts import SHIFTS


def calculate_hours_worked(entry: time, exit: time, shift: str | None = None) -> Decimal:
    entry_min = entry.hour * 60 + entry.minute
    exit_min  = exit.hour  * 60 + exit.minute
    delta     = exit_min - entry_min
    if delta <= 0:
        return Decimal("0.00")

    # Deduct break time if it falls within the worked window
    if shift and shift in SHIFTS:
        brk             = SHIFTS[shift]
        brk_start       = brk["break_start"].hour * 60 + brk["break_start"].minute
        brk_end         = brk_start + brk["break_minutes"]
        overlap_start   = max(entry_min, brk_start)
        overlap_end     = min(exit_min,  brk_end)
        if overlap_end > overlap_start:
            delta -= (overlap_end - overlap_start)

    if delta <= 0:
        return Decimal("0.00")
    return (Decimal(delta) / Decimal("60")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_monthly_hours(db: Session, employee_id: int, month: int, year: int) -> Decimal:
    records = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee_id,
            extract("month", Attendance.date) == month,
            extract("year",  Attendance.date) == year,
            Attendance.hours_worked.isnot(None),
        )
        .all()
    )
    total = sum((r.hours_worked for r in records), Decimal("0.00"))
    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_monthly_days(db: Session, employee_id: int, month: int, year: int) -> int:
    """Count days where the employee has a complete (clocked-in + clocked-out) record."""
    return (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee_id,
            extract("month", Attendance.date) == month,
            extract("year",  Attendance.date) == year,
            Attendance.exit_time.isnot(None),
        )
        .count()
    )


# ── Dashboard helpers ─────────────────────────────────────────────────────────

LATE_GRACE_MINUTES = 10


def get_working_days_in_month(year: int, month: int, holiday_dates: set) -> list:
    """Return all Mon–Sat dates in the given month that are not public holidays."""
    _, days_in_month = _calendar.monthrange(year, month)
    return [
        date(year, month, d)
        for d in range(1, days_in_month + 1)
        if date(year, month, d).weekday() <= 5   # Mon=0 … Sat=5; Sun=6 excluded
        and date(year, month, d) not in holiday_dates
    ]


def is_late_arrival(entry_time: time, shift: str) -> bool:
    """Returns True if entry_time is more than LATE_GRACE_MINUTES past shift start."""
    if shift not in SHIFTS:
        return False
    shift_start = SHIFTS[shift]["start"]
    start_min   = shift_start.hour * 60 + shift_start.minute
    entry_min   = entry_time.hour  * 60 + entry_time.minute
    return entry_min > start_min + LATE_GRACE_MINUTES


def calc_overtime(hours_worked, shift: str) -> Decimal:
    """Overtime = hours_worked − effective_hours, floored at 0."""
    if hours_worked is None or shift not in SHIFTS:
        return Decimal("0.00")
    effective = SHIFTS[shift]["effective_hours"]
    ot = Decimal(str(hours_worked)) - effective
    return max(ot, Decimal("0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_dashboard_overview(db: Session, month: int, year: int, holiday_dates: set) -> list:
    from models.employee import Employee

    records = (
        db.query(Attendance)
        .options(joinedload(Attendance.employee))
        .filter(
            extract("month", Attendance.date) == month,
            extract("year",  Attendance.date) == year,
        )
        .all()
    )

    # Group records by date
    by_date: dict = {}
    for r in records:
        by_date.setdefault(r.date, []).append(r)

    total_employees = db.query(Employee).count()
    working_days    = get_working_days_in_month(year, month, holiday_dates)

    result = []
    for wday in working_days:
        day_records  = by_date.get(wday, [])
        present      = len(day_records)
        late_count   = sum(
            1 for r in day_records
            if r.employee and is_late_arrival(r.entry_time, r.employee.shift)
        )
        result.append({
            "date":            wday,
            "present_count":   present,
            "absent_count":    max(0, total_employees - present),
            "late_count":      late_count,
            "total_employees": total_employees,
        })
    return result


def get_employee_stats(db: Session, month: int, year: int, holiday_dates: set) -> list:
    from models.employee import Employee

    employees = db.query(Employee).order_by(Employee.id).all()
    records   = (
        db.query(Attendance)
        .filter(
            extract("month", Attendance.date) == month,
            extract("year",  Attendance.date) == year,
        )
        .all()
    )

    # Group records by employee_id
    by_emp: dict = {}
    for r in records:
        by_emp.setdefault(r.employee_id, []).append(r)

    working_days = len(get_working_days_in_month(year, month, holiday_dates))

    result = []
    for emp in employees:
        emp_records  = by_emp.get(emp.id, [])
        days_present = len(emp_records)
        days_absent  = max(0, working_days - days_present)
        rate         = round(days_present / working_days * 100, 1) if working_days > 0 else 0.0
        late_days    = sum(1 for r in emp_records if is_late_arrival(r.entry_time, emp.shift))
        overtime     = sum(
            float(calc_overtime(r.hours_worked, emp.shift)) for r in emp_records
        )
        result.append({
            "employee_id":     emp.id,
            "name":            emp.name,
            "shift":           emp.shift,
            "days_present":    days_present,
            "days_absent":     days_absent,
            "attendance_rate": rate,
            "late_days":       late_days,
            "overtime_hours":  round(overtime, 2),
        })
    return result
