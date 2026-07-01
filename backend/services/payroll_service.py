from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import extract
from fastapi import HTTPException
from models.user import User
from models.company import Company
from models.salary_structure import SalaryStructure, SalaryComponent, EmployeeSalary
from models.advance import Advance
from models.payroll_run import PayrollRun, PayrollItem
from models.attendance import Attendance
from services.attendance_service import get_monthly_days, get_monthly_hours, calc_overtime
from config.shifts import SHIFTS, WORKING_DAYS_PER_MONTH


OVERTIME_MULTIPLIER = Decimal("1.5")
# Statutory defaults (percent of gross) — used when a company hasn't overridden them.
DEFAULT_ESI_RATE = Decimal("0.75")
DEFAULT_PF_RATE = Decimal("12.0")


def resolve_payroll_config(db: Session, company_id: int | None) -> dict:
    """Resolve a company's payroll settings (esi_rate, pf_rate, working_days,
    overtime_multiplier) as set by admin/master in Company Settings, falling back
    to system defaults so existing behaviour is preserved when unset."""
    cfg = {}
    if company_id:
        company = db.query(Company).filter(Company.id == company_id).first()
        if company and company.payroll_config:
            cfg = company.payroll_config
    return {
        "esi_rate": Decimal(str(cfg.get("esi_rate", DEFAULT_ESI_RATE))),
        "pf_rate": Decimal(str(cfg.get("pf_rate", DEFAULT_PF_RATE))),
        "working_days": Decimal(str(cfg.get("working_days", WORKING_DAYS_PER_MONTH))),
        "overtime_multiplier": Decimal(str(cfg.get("overtime_multiplier", OVERTIME_MULTIPLIER))),
    }


def create_payroll_run(db: Session, month: int, year: int, user_id: int) -> PayrollRun:
    # Check for existing draft/completed run
    existing = db.query(PayrollRun).filter(
        PayrollRun.month == month,
        PayrollRun.year == year,
        PayrollRun.status.in_(["draft", "completed"]),
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Payroll run already exists for {month}/{year} (status: {existing.status})",
        )

    run = PayrollRun(month=month, year=year, status="draft", run_by=user_id)
    db.add(run)
    db.flush()

    employees = db.query(User).filter(User.role.in_(["worker", "supervisor"])).order_by(User.id).all()
    total_gross = Decimal("0")
    total_deductions = Decimal("0")
    total_net = Decimal("0")

    for emp in employees:
        item = _calculate_employee_payroll(db, emp, month, year, run.id)
        db.add(item)
        total_gross += item.gross_pay
        total_deductions += item.total_deductions + item.advance_deduction
        total_net += item.net_pay

    run.total_gross = total_gross
    run.total_deductions = total_deductions
    run.total_net = total_net
    run.employee_count = len(employees)

    db.commit()
    db.refresh(run)
    return run


def _calculate_employee_payroll(
    db: Session, emp: User, month: int, year: int, run_id: int,
) -> PayrollItem:
    # Get active salary assignment
    salary = (
        db.query(EmployeeSalary)
        .filter(
            EmployeeSalary.employee_id == emp.id,
            EmployeeSalary.effective_to.is_(None),
        )
        .first()
    )

    # Company-configured payroll rates (admin/master set these in Company Settings).
    pcfg = resolve_payroll_config(db, emp.company_id)
    working_days = pcfg["working_days"]

    days_worked = get_monthly_days(db, emp.id, month, year)
    total_hours = get_monthly_hours(db, emp.id, month, year)
    overtime_hrs = Decimal("0")

    shift = SHIFTS.get(emp.shift, SHIFTS["SHIFT_A"])
    effective_hours = shift["effective_hours"]

    # Calculate overtime for each day
    day_records = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == emp.id,
            extract("month", Attendance.date) == month,
            extract("year", Attendance.date) == year,
            Attendance.hours_worked.isnot(None),
        )
        .all()
    )
    for r in day_records:
        ot = calc_overtime(r.hours_worked, emp.shift)
        overtime_hrs += ot

    if salary:
        # Structure-based calculation
        basic_pay = salary.basic_pay
        structure = db.query(SalaryStructure).filter(SalaryStructure.id == salary.structure_id).first()
        components = (
            db.query(SalaryComponent)
            .filter(SalaryComponent.structure_id == salary.structure_id)
            .order_by(SalaryComponent.display_order)
            .all()
        ) if structure else []

        # Pro-rate basic based on days worked
        daily_basic = (basic_pay / working_days).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        prorated_basic = (daily_basic * Decimal(str(days_worked))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        earnings = {}
        deductions = {}
        gross = prorated_basic

        for comp in components:
            if comp.calculation_type == "fixed":
                val = comp.amount_or_percentage
                # Pro-rate fixed amounts
                val = (val * Decimal(str(days_worked)) / working_days).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            elif comp.calculation_type == "percentage_of_basic":
                val = (prorated_basic * comp.amount_or_percentage / Decimal("100")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
            elif comp.calculation_type == "percentage_of_gross":
                val = Decimal("0")  # calculated after earnings are summed
            else:
                val = Decimal("0")

            if comp.type == "earning":
                earnings[comp.name] = float(val)
                gross += val
            else:
                deductions[comp.name] = float(val)

        # Second pass for percentage_of_gross deductions
        for comp in components:
            if comp.calculation_type == "percentage_of_gross" and comp.type == "deduction":
                val = (gross * comp.amount_or_percentage / Decimal("100")).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                deductions[comp.name] = float(val)

        total_ded = sum(Decimal(str(v)) for v in deductions.values())

    else:
        # Fallback: legacy hourly-rate based calculation
        hourly_rate = Decimal(str(emp.hourly_rate))
        daily_rate = (hourly_rate * effective_hours).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        basic_pay = daily_rate * working_days
        prorated_basic = (daily_rate * Decimal(str(days_worked))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        gross = prorated_basic

        earnings = {}
        deductions = {
            "ESI": float((gross * pcfg["esi_rate"] / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "PF": float((gross * pcfg["pf_rate"] / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        }
        total_ded = sum(Decimal(str(v)) for v in deductions.values())

    # Overtime pay
    ot_rate = (Decimal(str(emp.hourly_rate)) * pcfg["overtime_multiplier"]).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    overtime_pay = (ot_rate * overtime_hrs).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gross += overtime_pay

    # Advance deduction
    advance_ded = _get_advance_deduction(db, emp.id)

    net_pay = (gross - total_ded - advance_ded).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return PayrollItem(
        run_id=run_id,
        employee_id=emp.id,
        basic_pay=prorated_basic,
        earnings_breakdown=earnings,
        deductions_breakdown=deductions,
        days_worked=days_worked,
        overtime_hours=overtime_hrs,
        overtime_pay=overtime_pay,
        gross_pay=gross,
        total_deductions=total_ded,
        advance_deduction=advance_ded,
        net_pay=net_pay,
        status="calculated",
    )


def _get_advance_deduction(db: Session, employee_id: int) -> Decimal:
    active_advances = (
        db.query(Advance)
        .filter(Advance.employee_id == employee_id, Advance.status == "active")
        .all()
    )
    total = Decimal("0")
    for adv in active_advances:
        total += adv.monthly_deduction
    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def finalize_payroll_run(db: Session, run_id: int) -> PayrollRun:
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    if run.status != "draft":
        raise HTTPException(status_code=400, detail=f"Cannot finalize a run with status '{run.status}'")

    run.status = "completed"
    run.completed_at = datetime.utcnow()

    # Deduct advances
    items = db.query(PayrollItem).filter(PayrollItem.run_id == run_id).all()
    for item in items:
        if item.advance_deduction > 0:
            advances = (
                db.query(Advance)
                .filter(Advance.employee_id == item.employee_id, Advance.status == "active")
                .all()
            )
            for adv in advances:
                adv.remaining_balance = max(Decimal("0"), adv.remaining_balance - adv.monthly_deduction)
                if adv.remaining_balance <= 0:
                    adv.status = "repaid"
        item.status = "finalized"

    db.commit()
    db.refresh(run)
    return run
