from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.payslip import Payslip
from models.user import User
from schemas.payslip import PayslipGenerateRequest, PayslipResponse
from services.payslip_service import generate_or_regenerate_payslip
from auth.dependencies import require_admin

router = APIRouter()


def _to_response(payslip: Payslip, db: Session) -> PayslipResponse:
    emp = db.query(User).filter(User.id == payslip.employee_id).first()
    return PayslipResponse(
        id=payslip.id,
        employee_id=payslip.employee_id,
        month=payslip.month,
        year=payslip.year,
        days_worked=payslip.days_worked,
        total_hours=payslip.total_hours,
        hourly_rate=payslip.hourly_rate,
        daily_rate=payslip.daily_rate,
        gross_pay=payslip.gross_pay,
        esi=payslip.esi,
        pf=payslip.pf,
        net_pay=payslip.net_pay,
        generated_at=payslip.generated_at,
        employee_name=emp.name if emp else "Unknown",
    )


@router.post("/generate", response_model=PayslipResponse, status_code=201)
def generate_payslip(payload: PayslipGenerateRequest, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    payslip = generate_or_regenerate_payslip(db, payload)
    return _to_response(payslip, db)


@router.get("/{employee_id}", response_model=list[PayslipResponse])
def list_employee_payslips(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    payslips = (
        db.query(Payslip)
        .filter(Payslip.employee_id == employee_id)
        .order_by(Payslip.year.desc(), Payslip.month.desc())
        .all()
    )
    return [_to_response(p, db) for p in payslips]


@router.get("/{employee_id}/{year}/{month}", response_model=PayslipResponse)
def get_payslip(employee_id: int, year: int, month: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    payslip = db.query(Payslip).filter(
        Payslip.employee_id == employee_id,
        Payslip.year == year,
        Payslip.month == month,
    ).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    return _to_response(payslip, db)


@router.get("/month/{year}/{month}", response_model=list[PayslipResponse])
def get_month_payslips(year: int, month: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    payslips = (
        db.query(Payslip)
        .filter(Payslip.year == year, Payslip.month == month)
        .all()
    )
    return [_to_response(p, db) for p in payslips]


@router.delete("/{payslip_id}", status_code=204)
def delete_payslip(payslip_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    payslip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    db.delete(payslip)
    db.commit()
