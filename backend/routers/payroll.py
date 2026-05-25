from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.salary_structure import SalaryStructure, SalaryComponent, EmployeeSalary
from models.advance import Advance
from models.payroll_run import PayrollRun, PayrollItem
from schemas.payroll import (
    SalaryStructureCreate, SalaryStructureUpdate, SalaryStructureResponse,
    EmployeeSalaryCreate, EmployeeSalaryResponse,
    AdvanceCreate, AdvanceResponse,
    PayrollRunCreate, PayrollRunResponse, PayrollRunDetailResponse, PayrollItemResponse,
)
from services.payroll_service import create_payroll_run, finalize_payroll_run
from auth.dependencies import require_admin

router = APIRouter()


# ── Salary Structures ────────────────────────────────────────────────────────

@router.get("/structures", response_model=list[SalaryStructureResponse])
def list_structures(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(SalaryStructure).order_by(SalaryStructure.id).all()


@router.post("/structures", response_model=SalaryStructureResponse, status_code=201)
def create_structure(payload: SalaryStructureCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(SalaryStructure).filter(SalaryStructure.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Structure name already exists")

    if payload.is_default:
        db.query(SalaryStructure).filter(SalaryStructure.is_default == True).update({"is_default": False})

    structure = SalaryStructure(name=payload.name, description=payload.description, is_default=payload.is_default)
    db.add(structure)
    db.flush()

    for c in payload.components:
        comp = SalaryComponent(structure_id=structure.id, **c.model_dump())
        db.add(comp)

    db.commit()
    db.refresh(structure)
    return structure


@router.put("/structures/{structure_id}", response_model=SalaryStructureResponse)
def update_structure(structure_id: int, payload: SalaryStructureUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    structure = db.query(SalaryStructure).filter(SalaryStructure.id == structure_id).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")

    if payload.name is not None:
        structure.name = payload.name
    if payload.description is not None:
        structure.description = payload.description
    if payload.is_default is not None:
        if payload.is_default:
            db.query(SalaryStructure).filter(SalaryStructure.is_default == True).update({"is_default": False})
        structure.is_default = payload.is_default

    if payload.components is not None:
        db.query(SalaryComponent).filter(SalaryComponent.structure_id == structure_id).delete()
        for c in payload.components:
            comp = SalaryComponent(structure_id=structure_id, **c.model_dump())
            db.add(comp)

    db.commit()
    db.refresh(structure)
    return structure


@router.delete("/structures/{structure_id}", status_code=204)
def delete_structure(structure_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    structure = db.query(SalaryStructure).filter(SalaryStructure.id == structure_id).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")
    db.delete(structure)
    db.commit()


# ── Employee Salary Assignment ────────────────────────────────────────────────

@router.get("/employees/{employee_id}/salary", response_model=list[EmployeeSalaryResponse])
def get_employee_salary(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(EmployeeSalary).filter(EmployeeSalary.employee_id == employee_id).order_by(EmployeeSalary.effective_from.desc()).all()


@router.post("/employees/{employee_id}/salary", response_model=EmployeeSalaryResponse, status_code=201)
def assign_salary(employee_id: int, payload: EmployeeSalaryCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    # Deactivate current assignment
    from datetime import datetime
    db.query(EmployeeSalary).filter(
        EmployeeSalary.employee_id == employee_id,
        EmployeeSalary.effective_to.is_(None),
    ).update({"effective_to": datetime.utcnow()})

    assignment = EmployeeSalary(
        employee_id=employee_id,
        structure_id=payload.structure_id,
        basic_pay=payload.basic_pay,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


# ── Advances ──────────────────────────────────────────────────────────────────

@router.get("/advances", response_model=list[AdvanceResponse])
def list_advances(employee_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    q = db.query(Advance).order_by(Advance.id.desc())
    if employee_id:
        q = q.filter(Advance.employee_id == employee_id)
    return q.all()


@router.post("/advances", response_model=AdvanceResponse, status_code=201)
def create_advance(payload: AdvanceCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    monthly = (payload.amount / payload.repayment_months).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    advance = Advance(
        employee_id=payload.employee_id,
        amount=payload.amount,
        disbursed_date=payload.disbursed_date,
        repayment_months=payload.repayment_months,
        monthly_deduction=monthly,
        remaining_balance=payload.amount,
        notes=payload.notes,
    )
    db.add(advance)
    db.commit()
    db.refresh(advance)
    return advance


@router.delete("/advances/{advance_id}", status_code=204)
def delete_advance(advance_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    adv = db.query(Advance).filter(Advance.id == advance_id).first()
    if not adv:
        raise HTTPException(status_code=404, detail="Advance not found")
    db.delete(adv)
    db.commit()


# ── Payroll Runs ──────────────────────────────────────────────────────────────

@router.get("/runs", response_model=list[PayrollRunResponse])
def list_runs(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(PayrollRun).order_by(PayrollRun.started_at.desc()).all()


@router.post("/runs", response_model=PayrollRunResponse, status_code=201)
def create_run(payload: PayrollRunCreate, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    run = create_payroll_run(db, payload.month, payload.year, current.id)
    return run


@router.get("/runs/{run_id}", response_model=PayrollRunDetailResponse)
def get_run(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    items = db.query(PayrollItem).filter(PayrollItem.run_id == run_id).all()
    resp = PayrollRunDetailResponse.model_validate(run)
    item_responses = []
    for item in items:
        emp = db.query(User).filter(User.id == item.employee_id).first()
        ir = PayrollItemResponse.model_validate(item)
        ir.employee_name = emp.name if emp else "Unknown"
        item_responses.append(ir)
    resp.items = item_responses
    return resp


@router.post("/runs/{run_id}/finalize", response_model=PayrollRunResponse)
def finalize_run(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return finalize_payroll_run(db, run_id)


@router.delete("/runs/{run_id}", status_code=204)
def cancel_run(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    if run.status == "completed":
        raise HTTPException(status_code=400, detail="Cannot delete a completed payroll run")
    db.delete(run)
    db.commit()
