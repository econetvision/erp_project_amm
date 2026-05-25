from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from database import get_db
from models.vehicle import Vehicle
from models.vehicle_assignment import VehicleAssignment
from models.user import User
from schemas.vehicle_assignment import AssignRequest, AssignmentResponse
from auth.dependencies import require_admin_or_supervisor

router = APIRouter()


def _enrich(a: VehicleAssignment) -> AssignmentResponse:
    return AssignmentResponse(
        id=a.id,
        vehicle_id=a.vehicle_id,
        employee_id=a.employee_id,
        assigned_at=a.assigned_at,
        released_at=a.released_at,
        notes=a.notes,
        employee_name=a.employee.name if a.employee else None,
        reg_number=a.vehicle.reg_number if a.vehicle else None,
    )


@router.get("", response_model=list[AssignmentResponse])
def list_assignments(active_only: bool = True, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    q = db.query(VehicleAssignment)
    if active_only:
        q = q.filter(VehicleAssignment.released_at == None)  # noqa: E711
    assignments = q.order_by(VehicleAssignment.assigned_at.desc()).all()
    return [_enrich(a) for a in assignments]


@router.post("", response_model=AssignmentResponse, status_code=201)
def assign_vehicle(payload: AssignRequest, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle.status == "assigned":
        raise HTTPException(status_code=400, detail="Vehicle is already assigned")
    if vehicle.status == "maintenance":
        raise HTTPException(status_code=400, detail="Vehicle is under maintenance")

    employee = db.query(User).filter(User.id == payload.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Check employee doesn't already have an active vehicle
    active = (
        db.query(VehicleAssignment)
        .filter(VehicleAssignment.employee_id == payload.employee_id, VehicleAssignment.released_at == None)  # noqa: E711
        .first()
    )
    if active:
        raise HTTPException(status_code=400, detail="Employee already has an active vehicle assignment")

    assignment = VehicleAssignment(
        vehicle_id=payload.vehicle_id,
        employee_id=payload.employee_id,
        notes=payload.notes,
    )
    vehicle.status = "assigned"
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return _enrich(assignment)


@router.delete("/{assignment_id}", response_model=AssignmentResponse)
def release_vehicle(assignment_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    a = db.query(VehicleAssignment).filter(VehicleAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.released_at is not None:
        raise HTTPException(status_code=400, detail="Assignment already released")
    a.released_at = datetime.now(timezone.utc)
    a.vehicle.status = "available"
    db.commit()
    db.refresh(a)
    return _enrich(a)
