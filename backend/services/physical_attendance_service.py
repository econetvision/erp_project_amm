"""Physical attendance: a nominated supervisor marks workers' attendance by
face scan from the attendance-only app, at their one assigned site.

The pure helpers at the top carry the rules and are unit-tested without a
database. The DB-backed functions below them are what the router calls.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from auth.dependencies import assert_tenant, tenant_scope
from config.settings import settings
from models.attendance import Attendance
from models.user import User
from models.work_location import WorkLocation
from services.attendance_service import calculate_hours_worked
from services.geofence_service import haversine_m

NOT_ENABLED_DETAIL = "Physical attendance is not enabled for your account. Contact your admin."
SITE_UNAVAILABLE_DETAIL = "Your assigned site is no longer available. Contact your admin."
# A second scan this soon after clock-in is treated as an accidental re-scan
# (a supervisor working through a queue), not as a clock-out.
MIN_MINUTES_BEFORE_CLOCK_OUT = 5


# ── Pure helpers ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class SiteCheck:
    inside: bool
    distance_m: float


def is_enabled(user) -> bool:
    """Enabled means: active supervisor with a site assigned."""
    return (
        user.is_active is not False
        and user.role == "supervisor"
        and user.physical_attendance_site_id is not None
    )


def check_at_site(site_lat: float, site_lon: float, radius_m: float, buffer_m: float,
                  lat: float, lon: float) -> SiteCheck:
    distance = haversine_m(site_lat, site_lon, lat, lon)
    return SiteCheck(inside=distance <= radius_m + buffer_m, distance_m=distance)


def ensure_site_usable(site) -> None:
    if site is None or not site.is_active:
        raise HTTPException(status_code=409, detail=SITE_UNAVAILABLE_DETAIL)


def ensure_at_site(site, latitude: float | None, longitude: float | None, buffer_m: float) -> SiteCheck:
    """Raise unless the supervisor's phone is at the site."""
    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="Location is required. Please enable GPS and try again.")
    check = check_at_site(site.latitude, site.longitude, site.allowed_radius_m, buffer_m, latitude, longitude)
    if not check.inside:
        raise HTTPException(
            status_code=403,
            detail=(f"You are {round(check.distance_m)} m from {site.location_name}. "
                    "Attendance can only be marked at the site."),
        )
    return check


def next_action(record) -> str:
    """First scan of the day clocks in, the second clocks out, a third is refused."""
    if record is None:
        return "clock_in"
    if record.exit_time is None:
        return "clock_out"
    return "done"


def clock_out_too_soon(entry_time, now, min_gap_minutes: int) -> bool:
    worked = (now.hour * 60 + now.minute) - (entry_time.hour * 60 + entry_time.minute)
    return worked < min_gap_minutes


def stamp_site(record, site_id: int, supervisor_id: int) -> None:
    """Tag a record with the site it was marked at, unless it already has one."""
    if record.site_location_id is None:
        record.site_location_id = site_id
        record.marked_by = supervisor_id


def drop_site_if_ineligible(user, previous_company_id: int | None) -> None:
    """Clear the site when a user stops being a supervisor or changes company.

    The site belongs to the old company, and a later re-promotion must not
    silently bring physical attendance back.
    """
    if user.role != "supervisor" or user.company_id != previous_company_id:
        user.physical_attendance_site_id = None


def worker_label(user) -> str:
    return user.name or user.display_name or user.username


# ── Admin side ───────────────────────────────────────────────────────────────

def supervisor_row(user, site_name: str | None) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "name": user.name,
        "is_active": user.is_active is not False,
        "company_id": user.company_id,
        "must_change_password": bool(user.must_change_password),
        "site_id": user.physical_attendance_site_id,
        "site_name": site_name,
    }


def list_supervisors(db: Session, admin: User) -> list[dict]:
    q = db.query(User).filter(User.role == "supervisor")
    supervisors = tenant_scope(q, User.company_id, admin).order_by(User.id).all()
    site_ids = {s.physical_attendance_site_id for s in supervisors if s.physical_attendance_site_id}
    names: dict[int, str] = {}
    if site_ids:
        names = dict(
            db.query(WorkLocation.id, WorkLocation.location_name)
            .filter(WorkLocation.id.in_(site_ids))
            .all()
        )
    return [supervisor_row(s, names.get(s.physical_attendance_site_id)) for s in supervisors]


def set_site(db: Session, admin: User, supervisor_id: int, location_id: int | None) -> dict:
    """Assign, change or clear (``location_id=None``) a supervisor's site."""
    supervisor = db.query(User).filter(User.id == supervisor_id).first()
    if not supervisor or supervisor.role != "supervisor":
        raise HTTPException(status_code=404, detail="Supervisor not found")
    assert_tenant(admin, supervisor.company_id)

    site = None
    if location_id is not None:
        site = db.query(WorkLocation).filter(WorkLocation.id == location_id).first()
        # The site must belong to the supervisor's own company (also holds for master).
        if not site or site.company_id != supervisor.company_id:
            raise HTTPException(status_code=404, detail="Work location not found")
        if not site.is_active:
            raise HTTPException(status_code=400, detail="This work location is inactive. Choose an active site.")

    supervisor.physical_attendance_site_id = site.id if site else None
    db.commit()
    db.refresh(supervisor)
    return supervisor_row(supervisor, site.location_name if site else None)


# ── Supervisor side ──────────────────────────────────────────────────────────

def get_site(db: Session, supervisor: User) -> WorkLocation:
    site = (
        db.query(WorkLocation)
        .filter(WorkLocation.id == supervisor.physical_attendance_site_id)
        .first()
    )
    # A site of another company is never usable, whatever the column says.
    if site is not None and site.company_id != supervisor.company_id:
        site = None
    ensure_site_usable(site)
    return site


def scan(db: Session, supervisor: User, image: str,
         latitude: float | None, longitude: float | None) -> dict:
    """Identify the worker in ``image`` and clock them in or out at the supervisor's site."""
    site = get_site(db, supervisor)
    ensure_at_site(site, latitude, longitude, settings.geofence_buffer_m)

    # Lazy import: face_service loads the face_recognition models.
    from services.face_service import identify_employee
    candidates = (
        db.query(User)
        .filter(
            User.company_id == supervisor.company_id,
            User.face_encoding.isnot(None),
            User.is_active.isnot(False),
        )
        .all()
    )
    worker = identify_employee(image, candidates)
    if not worker:
        raise HTTPException(status_code=404,
                            detail="No matching employee found. Register the worker's face first.")

    today = date.today()
    now = datetime.now().time().replace(second=0, microsecond=0)
    record = (
        db.query(Attendance)
        .filter(Attendance.employee_id == worker.id, Attendance.date == today)
        .first()
    )
    action = next_action(record)
    if action == "done":
        raise HTTPException(status_code=400,
                            detail=f"{worker_label(worker)} has already clocked in and out today.")

    if action == "clock_out" and clock_out_too_soon(record.entry_time, now, MIN_MINUTES_BEFORE_CLOCK_OUT):
        raise HTTPException(
            status_code=400,
            detail=(f"{worker_label(worker)} was clocked in at {record.entry_time.strftime('%H:%M')}. "
                    "Scan again later to clock out."),
        )

    if action == "clock_in":
        record = Attendance(
            employee_id=worker.id, date=today, entry_time=now,
            clock_in_latitude=latitude, clock_in_longitude=longitude,
            site_location_id=site.id, marked_by=supervisor.id,
        )
        db.add(record)
    else:
        record.exit_time = now
        record.clock_out_latitude = latitude
        record.clock_out_longitude = longitude
        record.hours_worked = calculate_hours_worked(record.entry_time, now, worker.shift)
        stamp_site(record, site.id, supervisor.id)
    db.commit()

    return {
        "employee_id": worker.id,
        "employee_name": worker_label(worker),
        "employee_code": worker.employee_code,
        "action": action,
        "time": now,
    }


def today_list(db: Session, supervisor: User) -> dict:
    site = get_site(db, supervisor)
    today = date.today()
    rows = (
        db.query(Attendance, User)
        .join(User, Attendance.employee_id == User.id)
        .filter(
            Attendance.date == today,
            Attendance.site_location_id == site.id,
            User.company_id == supervisor.company_id,
        )
        .order_by(Attendance.entry_time)
        .all()
    )
    entries = [
        {
            "employee_id": worker.id,
            "name": worker_label(worker),
            "employee_code": worker.employee_code,
            "entry_time": record.entry_time,
            "exit_time": record.exit_time,
        }
        for record, worker in rows
    ]
    return {
        "site_name": site.location_name,
        "date": today,
        "present_count": len(entries),
        "entries": entries,
    }
