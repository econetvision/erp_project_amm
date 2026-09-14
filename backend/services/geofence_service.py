"""Employee geofence tracking: position evaluation, exit/return detection
and alert routing to supervisors and admins.

The pure helpers (``evaluate_position``, ``should_open_exit``) carry the
decision logic and are unit-tested without a database. ``record_ping`` is the
DB-backed entry point used by the ping endpoint.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy.orm import Session

from config.settings import settings
from models.attendance import Attendance
from models.geofence import EmployeeLocationPing, GeofenceExitEvent
from models.user import User
from models.work_location import EmployeeLocationAssignment, WorkLocation

logger = logging.getLogger("geofence")


# ── Pure helpers ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class LocationSpec:
    """A work location reduced to what geofencing needs."""
    id: int | None
    name: str
    latitude: float
    longitude: float
    radius_m: float
    supervisor_id: int | None = None


@dataclass(frozen=True)
class GeofenceCheck:
    inside: bool
    nearest: LocationSpec | None
    distance_m: float | None
    effective_radius_m: float | None


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def evaluate_position(
    locations: Sequence[LocationSpec],
    latitude: float,
    longitude: float,
    buffer_m: float,
) -> GeofenceCheck:
    """Check a position against every assigned location.

    Inside if within any location's ``radius_m + buffer_m``. With no locations
    there is nothing to enforce, so the position counts as inside.
    """
    if not locations:
        return GeofenceCheck(inside=True, nearest=None, distance_m=None, effective_radius_m=None)

    nearest: LocationSpec | None = None
    nearest_distance = float("inf")
    for loc in locations:
        d = haversine_m(loc.latitude, loc.longitude, latitude, longitude)
        if d <= loc.radius_m + buffer_m:
            return GeofenceCheck(inside=True, nearest=loc, distance_m=d, effective_radius_m=loc.radius_m + buffer_m)
        if d < nearest_distance:
            nearest_distance = d
            nearest = loc
    assert nearest is not None
    return GeofenceCheck(
        inside=False, nearest=nearest, distance_m=nearest_distance,
        effective_radius_m=nearest.radius_m + buffer_m,
    )


def should_open_exit(inside_flags: Sequence[bool], threshold: int) -> bool:
    """True when the most recent ``threshold`` pings were all outside."""
    threshold = max(1, int(threshold))
    if len(inside_flags) < threshold:
        return False
    return not any(inside_flags[-threshold:])


# ── DB-backed helpers ────────────────────────────────────────────────────────

def assigned_locations(db: Session, emp: User) -> list[LocationSpec]:
    """Active multi-location assignments, else the legacy single work location."""
    rows = (
        db.query(WorkLocation)
        .join(EmployeeLocationAssignment, EmployeeLocationAssignment.location_id == WorkLocation.id)
        .filter(EmployeeLocationAssignment.employee_id == emp.id, WorkLocation.is_active == True)
        .all()
    )
    if rows:
        return [
            LocationSpec(
                id=loc.id, name=loc.location_name, latitude=loc.latitude, longitude=loc.longitude,
                radius_m=float(loc.allowed_radius_m or 50.0), supervisor_id=loc.supervisor_id,
            )
            for loc in rows
        ]
    if emp.work_latitude is not None and emp.work_longitude is not None:
        return [LocationSpec(
            id=None, name=emp.work_location_name or "Assigned Site",
            latitude=emp.work_latitude, longitude=emp.work_longitude,
            radius_m=float(emp.attendance_radius_m or 50.0), supervisor_id=None,
        )]
    return []


def is_clocked_in(db: Session, emp: User) -> bool:
    rec = (
        db.query(Attendance)
        .filter(Attendance.employee_id == emp.id, Attendance.date == date.today())
        .first()
    )
    return bool(rec and rec.exit_time is None)


def alert_recipients(db: Session, emp: User, location: LocationSpec | None) -> set[int]:
    """Supervisor of the location (if any) plus every active admin in the
    employee's company. Never the employee themself."""
    ids: set[int] = set()
    if location and location.supervisor_id:
        ids.add(location.supervisor_id)
    if emp.company_id is not None:
        admins = (
            db.query(User.id)
            .filter(User.company_id == emp.company_id, User.role == "admin", User.is_active == True)
            .all()
        )
        ids.update(a[0] for a in admins)
    ids.discard(emp.id)
    return ids


def open_exit_event(db: Session, employee_id: int) -> GeofenceExitEvent | None:
    return (
        db.query(GeofenceExitEvent)
        .filter(GeofenceExitEvent.employee_id == employee_id, GeofenceExitEvent.returned_at.is_(None))
        .order_by(GeofenceExitEvent.exited_at.desc())
        .first()
    )


@dataclass
class PingResult:
    tracking: bool
    inside: bool
    distance_m: float | None
    nearest_location: str | None
    ping_interval_s: int
    event: str | None = None  # "exit" | "return" | None


def _employee_label(emp: User) -> str:
    return emp.name or emp.display_name or emp.username


def record_ping(
    db: Session,
    emp: User,
    latitude: float,
    longitude: float,
    accuracy_m: float | None = None,
) -> PingResult:
    """Store a background ping and raise/clear exit alerts as needed.

    When the employee is not clocked in nothing is stored and ``tracking`` is
    False so the app can stop its location service.
    """
    interval = settings.geofence_ping_interval_s
    if not is_clocked_in(db, emp):
        return PingResult(tracking=False, inside=True, distance_m=None, nearest_location=None, ping_interval_s=interval)

    locations = assigned_locations(db, emp)
    check = evaluate_position(locations, latitude, longitude, settings.geofence_buffer_m)

    ping = EmployeeLocationPing(
        employee_id=emp.id, latitude=latitude, longitude=longitude, accuracy_m=accuracy_m,
        inside_geofence=check.inside,
        nearest_location_id=check.nearest.id if check.nearest else None,
        distance_m=check.distance_m,
    )
    db.add(ping)
    db.commit()

    result = PingResult(
        tracking=True, inside=check.inside, distance_m=check.distance_m,
        nearest_location=check.nearest.name if check.nearest else None, ping_interval_s=interval,
    )
    if not locations:
        return result  # nothing to enforce

    current = open_exit_event(db, emp.id)
    if check.inside:
        if current is not None:
            _close_exit(db, emp, current, check)
            result.event = "return"
        return result

    if current is not None:
        return result  # already alerted for this episode

    threshold = settings.geofence_exit_consecutive_pings
    recent = (
        db.query(EmployeeLocationPing.inside_geofence)
        .filter(EmployeeLocationPing.employee_id == emp.id)
        .order_by(EmployeeLocationPing.recorded_at.desc(), EmployeeLocationPing.id.desc())
        .limit(threshold)
        .all()
    )
    flags = [r[0] for r in reversed(recent)]
    if should_open_exit(flags, threshold):
        _open_exit(db, emp, check, latitude, longitude)
        result.event = "exit"
    return result


def _open_exit(db: Session, emp: User, check: GeofenceCheck, latitude: float, longitude: float) -> GeofenceExitEvent:
    from services.notification_service import notify_users

    loc = check.nearest
    recipients = alert_recipients(db, emp, loc)
    event = GeofenceExitEvent(
        employee_id=emp.id,
        location_id=loc.id if loc else None,
        location_name=loc.name if loc else None,
        distance_m=check.distance_m,
        latitude=latitude, longitude=longitude,
        notified_user_ids=sorted(recipients),
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    who = _employee_label(emp)
    where = loc.name if loc else "their work location"
    dist = f"{check.distance_m:.0f} m" if check.distance_m is not None else "an unknown distance"
    notify_users(
        db, recipients,
        title=f"{who} left {where}",
        body=f"{who} is {dist} away from {where}.",
        type_="alert",
        data={"kind": "geofence_exit", "employee_id": emp.id, "event_id": event.id},
    )
    logger.info("Geofence exit: employee=%s location=%s distance=%s notified=%s",
                emp.id, where, dist, sorted(recipients))
    return event


def _close_exit(db: Session, emp: User, event: GeofenceExitEvent, check: GeofenceCheck) -> None:
    from services.notification_service import notify_users

    event.returned_at = datetime.now(timezone.utc)
    db.commit()

    recipients = set(event.notified_user_ids or [])
    if not recipients:
        return
    who = _employee_label(emp)
    where = event.location_name or (check.nearest.name if check.nearest else "their work location")
    mins = ""
    if event.exited_at:
        away = event.returned_at - event.exited_at
        mins = f" after {int(away.total_seconds() // 60)} min"
    notify_users(
        db, recipients,
        title=f"{who} is back at {where}",
        body=f"{who} returned to {where}{mins}.",
        type_="info",
        data={"kind": "geofence_return", "employee_id": emp.id, "event_id": event.id},
    )


def purge_old_pings(db: Session, retention_days: int) -> int:
    """Delete pings older than ``retention_days``. Returns rows deleted."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    deleted = (
        db.query(EmployeeLocationPing)
        .filter(EmployeeLocationPing.recorded_at < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    if deleted:
        logger.info("Purged %d employee_location_pings row(s) older than %d days", deleted, retention_days)
    return deleted
