"""Site-scoped visibility for supervisors and workers.

Master and admin keep the company-wide view (company isolation is still applied
separately via ``tenant_scope`` / ``assert_tenant``). Supervisors and workers are
narrowed further, to their own site(s):

* A **supervisor's sites** are the union of every link the system already has:
  ``work_locations.supervisor_id``, their own ``employee_location_assignments``
  rows, and ``users.physical_attendance_site_id``. Only active sites in the
  supervisor's own company count.
* A supervisor can see **themselves** plus every employee assigned to one of
  their sites.
* A worker can only ever see **themselves** and their own assigned sites.

Everything fails closed: a supervisor with no site sees only themselves.
Helpers return ``None`` for "unrestricted" so callers can skip the filter.
"""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.user import User
from models.work_location import EmployeeLocationAssignment, WorkLocation

SITE_SCOPED_ROLES = ("supervisor", "worker")


def is_site_scoped(user) -> bool:
    """True when the caller must be limited to their own site(s)."""
    return getattr(user, "role", None) in SITE_SCOPED_ROLES


def site_ids_for(db: Session, user) -> Optional[set[int]]:
    """Location ids the user may see; ``None`` means unrestricted."""
    if not is_site_scoped(user):
        return None

    candidate: set[int] = {
        lid for (lid,) in db.query(EmployeeLocationAssignment.location_id)
        .filter(EmployeeLocationAssignment.employee_id == user.id)
        .all()
    }
    if user.role == "supervisor":
        candidate |= {
            lid for (lid,) in db.query(WorkLocation.id)
            .filter(WorkLocation.supervisor_id == user.id)
            .all()
        }
        if user.physical_attendance_site_id is not None:
            candidate.add(user.physical_attendance_site_id)
    if not candidate:
        return set()

    # Only active sites inside the caller's own company count — a stale link to
    # a deactivated or foreign location must never widen visibility.
    q = db.query(WorkLocation.id).filter(
        WorkLocation.id.in_(candidate),
        WorkLocation.is_active == True,  # noqa: E712
        WorkLocation.company_id == user.company_id,
    )
    return {lid for (lid,) in q.all()}


def visible_employee_ids(db: Session, user) -> Optional[set[int]]:
    """User ids the caller may see; ``None`` means unrestricted."""
    if not is_site_scoped(user):
        return None
    if user.role == "worker":
        return {user.id}

    ids = {user.id}
    sites = site_ids_for(db, user)
    if sites:
        ids |= {
            eid for (eid,) in db.query(EmployeeLocationAssignment.employee_id)
            .join(User, User.id == EmployeeLocationAssignment.employee_id)
            .filter(
                EmployeeLocationAssignment.location_id.in_(sites),
                User.company_id == user.company_id,
            )
            .all()
        }
    return ids


# ── Query filters ─────────────────────────────────────────────────────────────

def scope_by_employee(query, column, db: Session, user):
    """Filter ``query`` so ``column`` (a user/employee id) is visible to ``user``."""
    ids = visible_employee_ids(db, user)
    if ids is None:
        return query
    return query.filter(column.in_(ids))


def scope_by_location(query, column, db: Session, user):
    """Filter ``query`` so ``column`` (a work location id) is visible to ``user``."""
    ids = site_ids_for(db, user)
    if ids is None:
        return query
    return query.filter(column.in_(ids))


# ── Single-record guards ──────────────────────────────────────────────────────
# 404, not 403, so callers cannot probe whether another site's record exists.

def can_see_employee(db: Session, user, employee_id: int) -> bool:
    ids = visible_employee_ids(db, user)
    return ids is None or employee_id in ids


def assert_employee_visible(db: Session, user, employee_id: int) -> None:
    if not can_see_employee(db, user, employee_id):
        raise HTTPException(status_code=404, detail="Employee not found")


def assert_employee_assignable(db: Session, user, employee_id: int) -> None:
    """A supervisor may place an employee on their own site only when the
    employee is already theirs or not at any site yet — never pull someone
    away from another supervisor's site."""
    if can_see_employee(db, user, employee_id):
        return
    has_site = (
        db.query(EmployeeLocationAssignment.id)
        .filter(EmployeeLocationAssignment.employee_id == employee_id)
        .first()
    )
    if has_site:
        raise HTTPException(status_code=404, detail="Employee not found")


def can_see_location(db: Session, user, location_id: int) -> bool:
    ids = site_ids_for(db, user)
    return ids is None or location_id in ids


def assert_location_visible(db: Session, user, location_id: int) -> None:
    if not can_see_location(db, user, location_id):
        raise HTTPException(status_code=404, detail="Work location not found")


def can_see_vehicle(db: Session, user, vehicle_id: int) -> bool:
    """Vehicles have no site of their own, so they follow their driver.

    A vehicle with an active assignment is visible only when its driver is; an
    unassigned (pool) vehicle stays visible so a supervisor can still hand it out.
    """
    ids = visible_employee_ids(db, user)
    if ids is None:
        return True
    from models.vehicle_assignment import VehicleAssignment
    active = (
        db.query(VehicleAssignment.employee_id)
        .filter(VehicleAssignment.vehicle_id == vehicle_id, VehicleAssignment.released_at.is_(None))
        .first()
    )
    return active is None or active[0] in ids


def vehicle_visibility(db: Session, user):
    """Batch form of ``can_see_vehicle`` for list views: two queries up front,
    then a cheap ``vehicle_id -> bool`` check per vehicle."""
    ids = visible_employee_ids(db, user)
    if ids is None:
        return lambda vehicle_id: True
    from models.vehicle_assignment import VehicleAssignment
    drivers = dict(
        db.query(VehicleAssignment.vehicle_id, VehicleAssignment.employee_id)
        .filter(VehicleAssignment.released_at.is_(None))
        .all()
    )
    return lambda vehicle_id: vehicle_id not in drivers or drivers[vehicle_id] in ids


def assert_vehicle_visible(db: Session, user, vehicle_id: int) -> None:
    if not can_see_vehicle(db, user, vehicle_id):
        raise HTTPException(status_code=404, detail="Vehicle not found")


def default_site_for(db: Session, user) -> Optional[int]:
    """The site a supervisor's newly created worker should join.

    Prefers the physical-attendance site, then the lowest site id, so the
    choice is deterministic. ``None`` when the caller is unrestricted or has
    no site.
    """
    sites = site_ids_for(db, user)
    if not sites:
        return None
    if user.physical_attendance_site_id in sites:
        return user.physical_attendance_site_id
    return min(sites)
