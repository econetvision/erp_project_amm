from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import extract
from datetime import date
from database import get_db
from models.attendance import Attendance
from models.employee import Employee
from models.holiday import PublicHoliday
from models.user import User
from schemas.attendance import (
    AttendanceClockIn, AttendanceClockOut, AttendanceUpdate,
    AttendanceResponse, MonthlyAttendanceSummary,
    DailyOverviewEntry, DashboardOverviewResponse,
    EmployeeStatEntry, DailyEmployeeStatus,
)
from services.attendance_service import (
    calculate_hours_worked, get_dashboard_overview, get_employee_stats,
    get_working_days_in_month, is_late_arrival, calc_overtime,
)
from services.face_service import identify_employee, verify_employee_face
from auth.dependencies import require_any, require_admin_or_supervisor
from decimal import Decimal
import math

router = APIRouter()


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two lat/lng points in kilometres."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def validate_geofence(emp: Employee, latitude: float | None, longitude: float | None, db: Session | None = None):
    """Raise 403 if employee has assigned locations and the provided coordinates are outside all allowed radii."""
    # First check multi-location assignments if db is available
    if db:
        from models.work_location import EmployeeLocationAssignment, WorkLocation
        assignments = (
            db.query(EmployeeLocationAssignment)
            .filter(EmployeeLocationAssignment.employee_id == emp.id)
            .all()
        )
        if assignments:
            if latitude is None or longitude is None:
                raise HTTPException(status_code=400, detail="Location is required. Please enable GPS and try again.")
            for a in assignments:
                loc = db.query(WorkLocation).filter(WorkLocation.id == a.location_id).first()
                if loc and loc.is_active:
                    distance = haversine_km(loc.latitude, loc.longitude, latitude, longitude)
                    if distance <= loc.allowed_radius_km:
                        return  # Within at least one assigned location
            # Not within any assigned location
            loc_names = []
            for a in assignments:
                loc = db.query(WorkLocation).filter(WorkLocation.id == a.location_id).first()
                if loc and loc.is_active:
                    loc_names.append(loc.location_name)
            raise HTTPException(
                status_code=403,
                detail=f"You are not within any assigned work location ({', '.join(loc_names)}). Please move closer to mark attendance."
            )

    # Fallback: check the legacy work_location fields on employee
    if emp.work_latitude is None or emp.work_longitude is None:
        return  # No work location configured — skip validation
    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="Location is required. Please enable GPS and try again.")
    distance = haversine_km(emp.work_latitude, emp.work_longitude, latitude, longitude)
    radius = emp.attendance_radius_km or 10.0
    if distance > radius:
        raise HTTPException(
            status_code=403,
            detail=f"You are {distance:.1f} km away from your work location ({emp.work_location_name or 'assigned site'}). Must be within {radius:.1f} km."
        )


class FaceScanRequest(BaseModel):
    image: str  # base64-encoded image
    latitude:  float | None = None
    longitude: float | None = None


class FaceScanResponse(BaseModel):
    employee_id:   int
    employee_name: str
    action:        str  # "clock_in" or "clock_out"
    attendance:    AttendanceResponse


class BlinkVerifyRequest(BaseModel):
    frames: list[str]  # list of base64-encoded images


class BlinkVerifyResponse(BaseModel):
    blink_detected: bool


# ── Blink verification endpoint ───────────────────────────────────────────────

@router.post("/verify-blink", response_model=BlinkVerifyResponse)
def verify_blink(payload: BlinkVerifyRequest, _: User = Depends(require_any)):
    """Check if a blink is detected in the provided sequence of face frames."""
    from services.face_service import detect_blink_in_frames
    frames = payload.frames[-15:]  # limit to last 15 frames
    result = detect_blink_in_frames(frames)
    return BlinkVerifyResponse(blink_detected=result)


# ── Dashboard endpoints (must appear before /{employee_id} routes) ────────────

@router.get("/dashboard/overview", response_model=DashboardOverviewResponse)
def dashboard_overview(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    Session = Depends(get_db),
    _:     object  = Depends(require_admin_or_supervisor),
):
    holiday_rows  = (
        db.query(PublicHoliday)
        .filter(
            extract("month", PublicHoliday.date) == month,
            extract("year",  PublicHoliday.date) == year,
        )
        .all()
    )
    holiday_dates    = {h.date for h in holiday_rows}
    total_employees  = db.query(Employee).count()
    working_day_list = get_working_days_in_month(year, month, holiday_dates)
    daily_entries    = get_dashboard_overview(db, month, year, holiday_dates)

    return DashboardOverviewResponse(
        month=month,
        year=year,
        total_employees=total_employees,
        working_days=len(working_day_list),
        daily_entries=daily_entries,
    )


@router.get("/dashboard/employee-stats", response_model=list[EmployeeStatEntry])
def dashboard_employee_stats(
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db:    Session = Depends(get_db),
    _:     object  = Depends(require_admin_or_supervisor),
):
    holiday_rows  = (
        db.query(PublicHoliday)
        .filter(
            extract("month", PublicHoliday.date) == month,
            extract("year",  PublicHoliday.date) == year,
        )
        .all()
    )
    holiday_dates = {h.date for h in holiday_rows}
    return get_employee_stats(db, month, year, holiday_dates)


@router.get("/daily-summary", response_model=list[DailyEmployeeStatus])
def daily_summary(
    date_param: date = Query(..., alias="date"),
    db:         Session = Depends(get_db),
    _:          object  = Depends(require_admin_or_supervisor),
):
    holiday = db.query(PublicHoliday).filter(PublicHoliday.date == date_param).first()
    employees = db.query(Employee).order_by(Employee.id).all()
    records   = db.query(Attendance).filter(Attendance.date == date_param).all()
    rec_map   = {r.employee_id: r for r in records}

    result = []
    for emp in employees:
        rec = rec_map.get(emp.id)
        if holiday:
            status  = "holiday"
            is_late = False
            ot      = 0.0
        elif rec:
            status  = "present"
            is_late = is_late_arrival(rec.entry_time, emp.shift)
            ot      = float(calc_overtime(rec.hours_worked, emp.shift))
        else:
            status  = "absent"
            is_late = False
            ot      = 0.0

        result.append(DailyEmployeeStatus(
            employee_id    = emp.id,
            name           = emp.name,
            shift          = emp.shift,
            status         = status,
            entry_time     = rec.entry_time    if rec else None,
            exit_time      = rec.exit_time     if rec else None,
            hours_worked   = rec.hours_worked  if rec else None,
            is_late        = is_late,
            overtime_hours = ot,
        ))
    return result


@router.post("/clock-in", response_model=AttendanceResponse, status_code=201)
def clock_in(payload: AttendanceClockIn, db: Session = Depends(get_db), current: User = Depends(require_any)):
    # Workers can only clock in for themselves
    if current.role == "worker" and current.employee_id != payload.employee_id:
        raise HTTPException(status_code=403, detail="Workers can only clock in for themselves")

    emp = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    validate_geofence(emp, payload.latitude, payload.longitude, db)
    verify_employee_face(payload.image, emp)

    existing = db.query(Attendance).filter(
        Attendance.employee_id == payload.employee_id,
        Attendance.date == payload.date
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee already clocked in for this date")
    record = Attendance(
        employee_id=payload.employee_id,
        date=payload.date,
        entry_time=payload.entry_time,
        clock_in_latitude=payload.latitude,
        clock_in_longitude=payload.longitude,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.patch("/{attendance_id}/clock-out", response_model=AttendanceResponse)
def clock_out(attendance_id: int, payload: AttendanceClockOut, db: Session = Depends(get_db), current: User = Depends(require_any)):
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    if record.exit_time:
        raise HTTPException(status_code=400, detail="Already clocked out")

    # Workers can only clock out for themselves
    if current.role == "worker" and current.employee_id != record.employee_id:
        raise HTTPException(status_code=403, detail="Workers can only clock out for themselves")

    emp = db.query(Employee).filter(Employee.id == record.employee_id).first()
    validate_geofence(emp, payload.latitude, payload.longitude, db)
    verify_employee_face(payload.image, emp)

    record.exit_time    = payload.exit_time
    record.clock_out_latitude  = payload.latitude
    record.clock_out_longitude = payload.longitude
    record.hours_worked = calculate_hours_worked(record.entry_time, payload.exit_time, emp.shift if emp else None)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{employee_id}/monthly", response_model=MonthlyAttendanceSummary)
def get_monthly_report(
    employee_id: int,
    month: int = Query(..., ge=1, le=12),
    year:  int = Query(..., ge=2000),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_supervisor),
):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    records = (
        db.query(Attendance)
        .filter(
            Attendance.employee_id == employee_id,
            extract("month", Attendance.date) == month,
            extract("year",  Attendance.date) == year,
        )
        .order_by(Attendance.date)
        .all()
    )
    total_hours = sum(
        (r.hours_worked for r in records if r.hours_worked is not None),
        Decimal("0.00")
    )
    return MonthlyAttendanceSummary(
        employee_id=employee_id,
        employee_name=emp.name,
        month=month,
        year=year,
        total_days=len(records),
        total_hours=total_hours,
        records=records,
    )


@router.get("/{employee_id}/today", response_model=AttendanceResponse | None)
def get_today_status(employee_id: int, db: Session = Depends(get_db), _: User = Depends(require_any)):
    today = date.today()
    return db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date == today
    ).first()


@router.get("/date/{record_date}", response_model=list[AttendanceResponse])
def get_by_date(record_date: date, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    return db.query(Attendance).filter(Attendance.date == record_date).all()


@router.put("/{attendance_id}", response_model=AttendanceResponse)
def update_attendance(attendance_id: int, payload: AttendanceUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(record, key, value)
    if record.entry_time and record.exit_time:
        emp = db.query(Employee).filter(Employee.id == record.employee_id).first()
        record.hours_worked = calculate_hours_worked(record.entry_time, record.exit_time, emp.shift if emp else None)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{attendance_id}", status_code=204)
def delete_attendance(attendance_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    db.delete(record)
    db.commit()


@router.post("/face-scan", response_model=FaceScanResponse, status_code=201)
def face_scan_clock(payload: FaceScanRequest, db: Session = Depends(get_db), _: User = Depends(require_any)):
    """Identify employee from face image and auto clock in or clock out."""
    employees = db.query(Employee).filter(Employee.face_encoding.isnot(None)).all()
    emp = identify_employee(payload.image, employees)
    if not emp:
        raise HTTPException(status_code=404, detail="No matching employee found. Please register your face first.")

    validate_geofence(emp, payload.latitude, payload.longitude, db)

    today = date.today()
    time_now_str = __import__("datetime").datetime.now().strftime("%H:%M")
    from datetime import time as dt_time
    time_now = dt_time(*map(int, time_now_str.split(":")))

    existing = db.query(Attendance).filter(
        Attendance.employee_id == emp.id,
        Attendance.date == today,
    ).first()

    if not existing:
        record = Attendance(employee_id=emp.id, date=today, entry_time=time_now,
                            clock_in_latitude=payload.latitude, clock_in_longitude=payload.longitude)
        db.add(record)
        db.commit()
        db.refresh(record)
        return FaceScanResponse(employee_id=emp.id, employee_name=emp.name,
                                action="clock_in", attendance=record)
    elif not existing.exit_time:
        existing.exit_time    = time_now
        existing.clock_out_latitude  = payload.latitude
        existing.clock_out_longitude = payload.longitude
        existing.hours_worked = calculate_hours_worked(existing.entry_time, time_now, emp.shift)
        db.commit()
        db.refresh(existing)
        return FaceScanResponse(employee_id=emp.id, employee_name=emp.name,
                                action="clock_out", attendance=existing)
    else:
        raise HTTPException(status_code=400,
            detail=f"{emp.name} has already clocked in and out today.")
