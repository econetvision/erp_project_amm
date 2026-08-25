from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models.user import User
from models.attendance import Attendance
from models.payslip    import Payslip
from schemas.payslip   import PayslipGenerateRequest
from services.attendance_service import get_monthly_hours, get_monthly_days
from services.payroll_service import resolve_payroll_config, resolve_monthly_salary
from sqlalchemy import extract
from config.shifts import SHIFTS, WORKING_DAYS_PER_MONTH


def generate_or_regenerate_payslip(db: Session, request: PayslipGenerateRequest) -> Payslip:
    employee = db.query(User).filter(User.id == request.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Block if any attendance record is missing exit_time
    open_records = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == request.employee_id,
            extract("month", Attendance.date) == request.month,
            extract("year",  Attendance.date) == request.year,
            Attendance.exit_time.is_(None),
        )
        .all()
    )
    if open_records:
        dates = ", ".join(str(r.date) for r in open_records)
        raise HTTPException(
            status_code=400,
            detail=f"Cannot generate payslip: exit time not recorded for {dates}",
        )

    # Salary calculation: monthly salary pro-rated over the company's working days.
    # Rates come from the company's payroll config so payslips and payroll runs
    # agree (both fall back to the system defaults when unconfigured).
    pcfg           = resolve_payroll_config(db, employee.company_id)
    working_days   = int(pcfg["working_days"]) or WORKING_DAYS_PER_MONTH
    monthly_salary = resolve_monthly_salary(employee)
    hourly_rate    = Decimal(str(employee.hourly_rate or 0))

    daily_rate  = (monthly_salary / Decimal(working_days)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    days_worked  = get_monthly_days(db, request.employee_id, request.month, request.year)
    total_hours  = get_monthly_hours(db, request.employee_id, request.month, request.year)

    # Never pay beyond a full month, even if attendance exceeds the working-day count.
    payable_days = min(days_worked, working_days)

    gross_pay = (daily_rate * Decimal(payable_days)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    esi       = (gross_pay * pcfg["esi_rate"] / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    pf        = (gross_pay * pcfg["pf_rate"] / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net_pay   = (gross_pay - esi - pf).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    existing = (
        db.query(Payslip)
        .filter(
            Payslip.employee_id == request.employee_id,
            Payslip.month == request.month,
            Payslip.year  == request.year,
        )
        .first()
    )

    if existing:
        existing.days_worked    = days_worked
        existing.total_hours    = total_hours
        existing.hourly_rate    = hourly_rate
        existing.monthly_salary = monthly_salary
        existing.working_days   = working_days
        existing.daily_rate     = daily_rate
        existing.gross_pay      = gross_pay
        existing.esi            = esi
        existing.pf             = pf
        existing.net_pay        = net_pay
        db.commit()
        db.refresh(existing)
        return existing

    payslip = Payslip(
        employee_id=request.employee_id,
        month=request.month,
        year=request.year,
        days_worked=days_worked,
        total_hours=total_hours,
        hourly_rate=hourly_rate,
        monthly_salary=monthly_salary,
        working_days=working_days,
        daily_rate=daily_rate,
        gross_pay=gross_pay,
        esi=esi,
        pf=pf,
        net_pay=net_pay,
    )
    db.add(payslip)
    db.commit()
    db.refresh(payslip)
    return payslip
