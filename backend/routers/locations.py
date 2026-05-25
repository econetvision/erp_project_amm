from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from database import get_db
from models.work_location import WorkLocation, EmployeeLocationAssignment
from models.user import User
from models.user import User
from schemas.work_location import (
    WorkLocationCreate, WorkLocationUpdate, WorkLocationResponse,
    EmployeeLocationAssignmentCreate, EmployeeLocationAssignmentResponse,
    BulkAssignRequest,
)
from auth.dependencies import require_admin_or_supervisor, require_admin, get_current_user

router = APIRouter()


# ── Stats endpoint ────────────────────────────────────────────────────────────

@router.get("/stats")
def location_stats(db: Session = Depends(get_db), current_user: User = Depends(require_admin_or_supervisor)):
    q = db.query(WorkLocation)
    if current_user.role != "master":
        q = q.filter(WorkLocation.company_id == current_user.company_id)
    total = q.count()
    active = q.filter(WorkLocation.is_active == True).count()
    aq = db.query(EmployeeLocationAssignment)
    if current_user.role != "master":
        aq = aq.join(WorkLocation).filter(WorkLocation.company_id == current_user.company_id)
    total_assigned = aq.count()
    city_rows = (
        q.filter(WorkLocation.city.isnot(None), WorkLocation.city != "")
        .with_entities(WorkLocation.city, sa_func.count(WorkLocation.id))
        .group_by(WorkLocation.city)
        .all()
    )
    city_distribution = {city: count for city, count in city_rows}
    return {
        "total_locations": total,
        "active_locations": active,
        "total_assigned": total_assigned,
        "city_distribution": city_distribution,
    }


# ── Work Location CRUD ────────────────────────────────────────────────────────

@router.get("", response_model=list[WorkLocationResponse])
def list_locations(
    search: str = Query("", alias="q"),
    city: str = Query(""),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_supervisor),
):
    q = db.query(WorkLocation)
    # Company-scope: admin/supervisor see only their company's locations
    if current_user.role != "master":
        q = q.filter(WorkLocation.company_id == current_user.company_id)
    if active_only:
        q = q.filter(WorkLocation.is_active == True)
    if search:
        q = q.filter(WorkLocation.location_name.ilike(f"%{search}%"))
    if city:
        q = q.filter(WorkLocation.city.ilike(f"%{city}%"))
    locations = q.order_by(WorkLocation.id).all()

    # Attach employee counts
    counts = dict(
        db.query(EmployeeLocationAssignment.location_id, sa_func.count(EmployeeLocationAssignment.id))
        .group_by(EmployeeLocationAssignment.location_id)
        .all()
    )
    results = []
    for loc in locations:
        resp = WorkLocationResponse.model_validate(loc)
        resp.employee_count = counts.get(loc.id, 0)
        results.append(resp)
    return results


@router.post("", response_model=WorkLocationResponse, status_code=201)
def create_location(
    payload: WorkLocationCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    if payload.location_code:
        existing = db.query(WorkLocation).filter(WorkLocation.location_code == payload.location_code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Location code already exists")
    loc = WorkLocation(**payload.model_dump(), company_id=current.company_id, created_by=current.id)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    resp = WorkLocationResponse.model_validate(loc)
    resp.employee_count = 0
    return resp


@router.get("/{location_id}", response_model=WorkLocationResponse)
def get_location(location_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    loc = db.query(WorkLocation).filter(WorkLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Work location not found")
    count = db.query(EmployeeLocationAssignment).filter(EmployeeLocationAssignment.location_id == location_id).count()
    resp = WorkLocationResponse.model_validate(loc)
    resp.employee_count = count
    return resp


@router.put("/{location_id}", response_model=WorkLocationResponse)
def update_location(
    location_id: int,
    payload: WorkLocationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    loc = db.query(WorkLocation).filter(WorkLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Work location not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(loc, key, value)
    db.commit()
    db.refresh(loc)
    count = db.query(EmployeeLocationAssignment).filter(EmployeeLocationAssignment.location_id == location_id).count()
    resp = WorkLocationResponse.model_validate(loc)
    resp.employee_count = count
    return resp


@router.delete("/{location_id}", status_code=204)
def delete_location(location_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    loc = db.query(WorkLocation).filter(WorkLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Work location not found")
    db.delete(loc)
    db.commit()


# ── Employee-Location Assignments ─────────────────────────────────────────────

@router.get("/{location_id}/employees", response_model=list[EmployeeLocationAssignmentResponse])
def list_location_employees(location_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    loc = db.query(WorkLocation).filter(WorkLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Work location not found")
    assignments = (
        db.query(EmployeeLocationAssignment)
        .filter(EmployeeLocationAssignment.location_id == location_id)
        .all()
    )
    results = []
    for a in assignments:
        emp = db.query(User).filter(User.id == a.employee_id).first()
        resp = EmployeeLocationAssignmentResponse(
            id=a.id,
            employee_id=a.employee_id,
            location_id=a.location_id,
            is_primary=a.is_primary,
            assigned_by=a.assigned_by,
            assigned_at=a.assigned_at,
            location_name=loc.location_name,
            employee_name=emp.name if emp else None,
        )
        results.append(resp)
    return results


@router.post("/assign", response_model=EmployeeLocationAssignmentResponse, status_code=201)
def assign_employee(
    payload: EmployeeLocationAssignmentCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin_or_supervisor),
):
    emp = db.query(User).filter(User.id == payload.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    loc = db.query(WorkLocation).filter(WorkLocation.id == payload.location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Work location not found")
    # Check for duplicate
    existing = db.query(EmployeeLocationAssignment).filter(
        EmployeeLocationAssignment.employee_id == payload.employee_id,
        EmployeeLocationAssignment.location_id == payload.location_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee already assigned to this location")

    # If marking as primary, unmark other primaries
    if payload.is_primary:
        db.query(EmployeeLocationAssignment).filter(
            EmployeeLocationAssignment.employee_id == payload.employee_id,
            EmployeeLocationAssignment.is_primary == True,
        ).update({"is_primary": False})

    assignment = EmployeeLocationAssignment(
        employee_id=payload.employee_id,
        location_id=payload.location_id,
        is_primary=payload.is_primary,
        assigned_by=current.id,
    )
    db.add(assignment)

    # Also update the employee's work location fields (for backward compatibility with geofence)
    if payload.is_primary:
        emp.work_location_name = loc.location_name
        emp.work_latitude = loc.latitude
        emp.work_longitude = loc.longitude
        emp.attendance_radius_km = loc.allowed_radius_km

    db.commit()
    db.refresh(assignment)
    return EmployeeLocationAssignmentResponse(
        id=assignment.id,
        employee_id=assignment.employee_id,
        location_id=assignment.location_id,
        is_primary=assignment.is_primary,
        assigned_by=assignment.assigned_by,
        assigned_at=assignment.assigned_at,
        location_name=loc.location_name,
        employee_name=emp.name,
    )


@router.post("/assign-bulk", status_code=201)
def assign_bulk(
    payload: BulkAssignRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin_or_supervisor),
):
    loc = db.query(WorkLocation).filter(WorkLocation.id == payload.location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Work location not found")

    assigned = 0
    for emp_id in payload.employee_ids:
        emp = db.query(User).filter(User.id == emp_id).first()
        if not emp:
            continue
        existing = db.query(EmployeeLocationAssignment).filter(
            EmployeeLocationAssignment.employee_id == emp_id,
            EmployeeLocationAssignment.location_id == payload.location_id,
        ).first()
        if existing:
            continue
        if payload.is_primary:
            db.query(EmployeeLocationAssignment).filter(
                EmployeeLocationAssignment.employee_id == emp_id,
                EmployeeLocationAssignment.is_primary == True,
            ).update({"is_primary": False})
        assignment = EmployeeLocationAssignment(
            employee_id=emp_id,
            location_id=payload.location_id,
            is_primary=payload.is_primary,
            assigned_by=current.id,
        )
        db.add(assignment)
        if payload.is_primary:
            emp.work_location_name = loc.location_name
            emp.work_latitude = loc.latitude
            emp.work_longitude = loc.longitude
            emp.attendance_radius_km = loc.allowed_radius_km
        assigned += 1

    db.commit()
    return {"detail": f"{assigned} employee(s) assigned to {loc.location_name}"}


@router.delete("/assign/{assignment_id}", status_code=204)
def unassign_employee(assignment_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    assignment = db.query(EmployeeLocationAssignment).filter(EmployeeLocationAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()
