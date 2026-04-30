from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models.employee import Employee
from models.user import User
from schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from services.face_service import get_face_encoding
from auth.dependencies import require_admin_or_supervisor

router = APIRouter()


class FaceRegisterRequest(BaseModel):
    image: str  # base64-encoded image


@router.get("", response_model=list[EmployeeResponse])
def list_employees(db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    return db.query(Employee).order_by(Employee.id).all()


@router.post("", response_model=EmployeeResponse, status_code=201)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    existing = db.query(Employee).filter(Employee.aadhar_number == payload.aadhar_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Aadhar number already registered")
    emp = Employee(**payload.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: int, payload: EmployeeCreate, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    for key, value in payload.model_dump().items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return emp


@router.patch("/{employee_id}", response_model=EmployeeResponse)
def partial_update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(emp, key, value)
    db.commit()
    db.refresh(emp)
    return emp


@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(emp)
    db.commit()


@router.post("/{employee_id}/face", response_model=EmployeeResponse)
def register_face(employee_id: int, payload: FaceRegisterRequest, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.face_encoding = get_face_encoding(payload.image)
    emp.photo         = payload.image
    db.commit()
    db.refresh(emp)
    return emp
