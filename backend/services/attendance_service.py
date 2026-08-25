from datetime import time, date, timedelta
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


def get_dashboard_overview(db: Session, month: int, year: int, holiday_dates: set,
                           company_id: int | None = None) -> list:
    from models.user import User

    # Tenant isolation: restrict to the given company's employees when provided
    # (None = master's cross-company view).
    emp_q = db.query(User.id).filter(User.role.in_(["worker", "supervisor"]))
    if company_id is not None:
        emp_q = emp_q.filter(User.company_id == company_id)
    emp_ids = [uid for (uid,) in emp_q.all()]

    rec_q = (
        db.query(Attendance)
        .options(joinedload(Attendance.employee))
        .filter(
            extract("month", Attendance.date) == month,
            extract("year",  Attendance.date) == year,
        )
    )
    if company_id is not None:
        rec_q = rec_q.filter(Attendance.employee_id.in_(emp_ids))
    records = rec_q.all()

    # Group records by date
    by_date: dict = {}
    for r in records:
        by_date.setdefault(r.date, []).append(r)

    total_employees = len(emp_ids)
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


def get_employee_stats(db: Session, month: int, year: int, holiday_dates: set,
                       company_id: int | None = None) -> list:
    from models.user import User

    # Tenant isolation: only this company's employees (None = master global view).
    emp_q = db.query(User).filter(User.role.in_(["worker", "supervisor"]))
    if company_id is not None:
        emp_q = emp_q.filter(User.company_id == company_id)
    employees = emp_q.order_by(User.id).all()

    rec_q = (
        db.query(Attendance)
        .filter(
            extract("month", Attendance.date) == month,
            extract("year",  Attendance.date) == year,
        )
    )
    if company_id is not None:
        rec_q = rec_q.filter(Attendance.employee_id.in_([e.id for e in employees]))
    records = rec_q.all()

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


# ── Missed attendance ─────────────────────────────────────────────────────────

# One reason per missed day, in priority order, so a day is never double-counted.
MISS_ABSENT     = "absent"      # no attendance record at all
MISS_INCOMPLETE = "incomplete"  # clocked in but never clocked out
MISS_LATE       = "late"        # arrived past the grace window


def get_working_days_in_range(start: date, end: date, holiday_dates: set) -> list:
    """Return all Mon–Sat dates in [start, end] that are not public holidays.

    Range-based sibling of get_working_days_in_month, used by the daily/weekly/
    monthly missed-attendance views which don't align to month boundaries.
    """
    days = []
    current = start
    while current <= end:
        if current.weekday() <= 5 and current not in holiday_dates:  # Sun=6 excluded
            days.append(current)
        current += timedelta(days=1)
    return days


def get_missed_attendance(db: Session, start: date, end: date, holiday_dates: set,
                          company_id: int | None = None, today: date | None = None) -> dict:
    """Employees who missed attendance on any working day in [start, end].

    A working day counts as missed when the employee has no record (absent), has
    a record with no exit_time (incomplete), or clocked in past the late grace
    window (late). The range is capped at today — a week or month still in
    progress must not report its future days as absences.
    """
    from models.user import User

    today = today or date.today()
    effective_end = min(end, today)

    emp_q = db.query(User).filter(User.role.in_(["worker", "supervisor"]))
    if company_id is not None:
        emp_q = emp_q.filter(User.company_id == company_id)
    employees = emp_q.order_by(User.id).all()

    working_days = get_working_days_in_range(start, effective_end, holiday_dates)

    # No working days elapsed yet (e.g. a week that starts on a Sunday holiday).
    if not working_days or not employees:
        return {
            "start_date":            start,
            "end_date":              effective_end,
            "working_days":          len(working_days),
            "total_employees":       len(employees),
            "employees_with_misses": 0,
            "total_absent":          0,
            "total_incomplete":      0,
            "total_late":            0,
            "total_missed":          0,
            "employees":             [],
        }

    emp_ids = [e.id for e in employees]
    records = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id.in_(emp_ids),
            Attendance.date >= start,
            Attendance.date <= effective_end,
        )
        .all()
    )

    # (employee_id, date) → record
    by_emp_date = {(r.employee_id, r.date): r for r in records}

    entries = []
    totals = {MISS_ABSENT: 0, MISS_INCOMPLETE: 0, MISS_LATE: 0}

    for emp in employees:
        details = []
        counts  = {MISS_ABSENT: 0, MISS_INCOMPLETE: 0, MISS_LATE: 0}

        for wday in working_days:
            rec = by_emp_date.get((emp.id, wday))
            if rec is None:
                reason = MISS_ABSENT
            elif rec.exit_time is None:
                reason = MISS_INCOMPLETE
            elif rec.entry_time is not None and is_late_arrival(rec.entry_time, emp.shift):
                reason = MISS_LATE
            else:
                continue

            counts[reason] += 1
            totals[reason] += 1
            details.append({
                "date":       wday,
                "reason":     reason,
                "entry_time": rec.entry_time if rec else None,
                "exit_time":  rec.exit_time  if rec else None,
            })

        missed = sum(counts.values())
        if missed == 0:
            continue

        entries.append({
            "employee_id":     emp.id,
            "employee_code":   emp.employee_code,
            "name":            emp.name,
            "shift":           emp.shift,
            "missed_days":     missed,
            "absent_days":     counts[MISS_ABSENT],
            "incomplete_days": counts[MISS_INCOMPLETE],
            "late_days":       counts[MISS_LATE],
            "details":         details,
        })

    # Worst offenders first so the dashboard surfaces who needs attention.
    entries.sort(key=lambda e: (-e["missed_days"], e["name"] or ""))

    return {
        "start_date":            start,
        "end_date":              effective_end,
        "working_days":          len(working_days),
        "total_employees":       len(employees),
        "employees_with_misses": len(entries),
        "total_absent":          totals[MISS_ABSENT],
        "total_incomplete":      totals[MISS_INCOMPLETE],
        "total_late":            totals[MISS_LATE],
        "total_missed":          sum(totals.values()),
        "employees":             entries,
    }
