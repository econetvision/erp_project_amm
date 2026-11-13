"""Site-scoped visibility: supervisors and workers see only their own site(s);
master and admin keep the full company view. Runs on in-memory SQLite."""
import sys
from datetime import date, datetime, time, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from models.attendance import Attendance
from models.company import Company
from models.geofence import GeofenceExitEvent
from models.holiday import PublicHoliday
from models.user import User
from models.vehicle import Vehicle
from models.vehicle_assignment import VehicleAssignment
from models.vehicle_location import VehicleLocation
from models.work_location import EmployeeLocationAssignment, WorkLocation
from services import site_scope_service as scope

# Routers import face_service, which needs numpy/face_recognition. Neither is
# under test here, so stand in a stub when they aren't installed.
try:
    import services.face_service  # noqa: F401
except ImportError:
    import types

    _stub = types.ModuleType("services.face_service")
    _stub.__getattr__ = lambda name: (lambda *a, **k: None)
    sys.modules["services.face_service"] = _stub


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    models = (Company, User, WorkLocation, EmployeeLocationAssignment, Attendance, PublicHoliday,
              GeofenceExitEvent, Vehicle, VehicleAssignment, VehicleLocation)
    Company.metadata.create_all(engine, tables=[m.__table__ for m in models])
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def w(db):
    """Company 1 has sites North (10) and South (11); company 2 has site Far (20).

    sup_n   — North's named supervisor (work_locations.supervisor_id)
    sup_s   — assigned to South like an employee (employee_location_assignments)
    sup_p   — physical-attendance site South (users.physical_attendance_site_id)
    sup_x   — no site at all
    """
    db.add_all([Company(id=1, name="Acme", code="ACME"), Company(id=2, name="Other", code="OTH")])
    db.flush()

    def user(id, role, company_id=1, **kw):
        u = User(id=id, username=f"u{id}", password_hash="x", role=role, company_id=company_id,
                 is_active=True, name=f"User {id}", **kw)
        db.add(u)
        return u

    ns = SimpleNamespace(
        master=user(1, "master", company_id=None),
        admin=user(2, "admin"),
        sup_n=user(3, "supervisor"),
        sup_s=user(4, "supervisor"),
        sup_p=user(5, "supervisor"),
        sup_x=user(6, "supervisor"),
        n1=user(7, "worker"),
        n2=user(8, "worker"),
        s1=user(9, "worker"),
        unassigned=user(10, "worker"),
        far=user(11, "worker", company_id=2),
    )
    db.flush()

    def site(id, name, company_id=1, supervisor_id=None, active=True):
        loc = WorkLocation(id=id, company_id=company_id, location_name=name, latitude=17.0,
                           longitude=78.0, allowed_radius_m=50.0, supervisor_id=supervisor_id,
                           is_active=active)
        db.add(loc)
        return loc

    ns.north = site(10, "North", supervisor_id=ns.sup_n.id)
    ns.south = site(11, "South")
    ns.closed = site(12, "Closed", supervisor_id=ns.sup_x.id, active=False)
    ns.far_site = site(20, "Far", company_id=2)
    db.flush()
    ns.sup_p.physical_attendance_site_id = ns.south.id

    for emp, loc in [(ns.n1, ns.north), (ns.n2, ns.north), (ns.s1, ns.south),
                     (ns.sup_s, ns.south), (ns.far, ns.far_site)]:
        db.add(EmployeeLocationAssignment(employee_id=emp.id, location_id=loc.id, is_primary=True))
    db.commit()
    return ns


# ── Who is site-scoped ────────────────────────────────────────────────────────

def test_only_supervisor_and_worker_are_scoped(w):
    assert [scope.is_site_scoped(u) for u in (w.master, w.admin, w.sup_n, w.n1)] == [False, False, True, True]


def test_master_and_admin_are_unrestricted(db, w):
    for u in (w.master, w.admin):
        assert scope.site_ids_for(db, u) is None
        assert scope.visible_employee_ids(db, u) is None


# ── Supervisor sites: union of all three links ────────────────────────────────

def test_named_supervisor_gets_their_site(db, w):
    assert scope.site_ids_for(db, w.sup_n) == {10}


def test_assigned_supervisor_gets_their_site(db, w):
    assert scope.site_ids_for(db, w.sup_s) == {11}


def test_physical_attendance_site_counts(db, w):
    assert scope.site_ids_for(db, w.sup_p) == {11}


def test_all_three_links_are_combined(db, w):
    w.south.supervisor_id = w.sup_n.id
    db.add(EmployeeLocationAssignment(employee_id=w.sup_n.id, location_id=w.north.id))
    db.commit()
    assert scope.site_ids_for(db, w.sup_n) == {10, 11}


def test_inactive_and_foreign_sites_are_ignored(db, w):
    w.sup_x.physical_attendance_site_id = w.far_site.id   # foreign company
    db.commit()
    # sup_x is the named supervisor of the inactive "Closed" site only.
    assert scope.site_ids_for(db, w.sup_x) == set()


# ── Visible employees ─────────────────────────────────────────────────────────

def test_supervisor_sees_self_and_their_site_only(db, w):
    assert scope.visible_employee_ids(db, w.sup_n) == {w.sup_n.id, w.n1.id, w.n2.id}
    assert scope.visible_employee_ids(db, w.sup_p) == {w.sup_p.id, w.s1.id, w.sup_s.id}


def test_supervisor_without_site_sees_only_self(db, w):
    assert scope.visible_employee_ids(db, w.sup_x) == {w.sup_x.id}


def test_worker_sees_only_self(db, w):
    assert scope.visible_employee_ids(db, w.n1) == {w.n1.id}
    assert scope.site_ids_for(db, w.n1) == {10}


def test_assert_employee_visible_404s_for_other_site(db, w):
    scope.assert_employee_visible(db, w.sup_n, w.n1.id)
    with pytest.raises(HTTPException) as e:
        scope.assert_employee_visible(db, w.sup_n, w.s1.id)
    assert e.value.status_code == 404


def test_assert_location_visible_404s_for_other_site(db, w):
    scope.assert_location_visible(db, w.sup_n, w.north.id)
    scope.assert_location_visible(db, w.admin, w.south.id)
    with pytest.raises(HTTPException) as e:
        scope.assert_location_visible(db, w.sup_n, w.south.id)
    assert e.value.status_code == 404


def test_default_site_prefers_physical_attendance_site(db, w):
    db.add(EmployeeLocationAssignment(employee_id=w.sup_p.id, location_id=w.north.id))
    db.commit()
    assert scope.default_site_for(db, w.sup_p) == w.south.id
    assert scope.default_site_for(db, w.sup_x) is None
    assert scope.default_site_for(db, w.admin) is None


# ── Vehicles follow their driver ──────────────────────────────────────────────

def _vehicle(db, id, driver=None):
    v = Vehicle(id=id, company_id=1, reg_number=f"TS{id}", type="truck", status="available")
    db.add(v)
    db.flush()
    if driver:
        db.add(VehicleAssignment(vehicle_id=id, employee_id=driver.id, company_id=1))
        v.status = "assigned"
    db.commit()
    return v


def test_vehicle_visibility(db, w):
    mine, theirs, pool = _vehicle(db, 1, w.n1), _vehicle(db, 2, w.s1), _vehicle(db, 3)
    assert scope.can_see_vehicle(db, w.sup_n, mine.id) is True
    assert scope.can_see_vehicle(db, w.sup_n, theirs.id) is False
    assert scope.can_see_vehicle(db, w.sup_n, pool.id) is True
    assert scope.can_see_vehicle(db, w.admin, theirs.id) is True


# ── Router wiring ─────────────────────────────────────────────────────────────

def test_employee_list_is_site_scoped(db, w):
    from routers.employees import list_employees

    def names(user):
        res = list_employees(page=1, per_page=100, search="", all=True, db=db, current_user=user)
        return {e.id for e in res["items"]}

    assert names(w.sup_n) == {w.n1.id, w.n2.id}                 # workers only, own site
    assert names(w.sup_x) == set()
    assert w.s1.id in names(w.admin) and w.unassigned.id in names(w.admin)
    assert w.far.id not in names(w.admin)                        # company isolation intact


def test_get_employee_from_other_site_is_404(db, w):
    from routers.employees import get_employee
    assert get_employee(employee_id=w.n1.id, db=db, current_user=w.sup_n).id == w.n1.id
    with pytest.raises(HTTPException) as e:
        get_employee(employee_id=w.s1.id, db=db, current_user=w.sup_n)
    assert e.value.status_code == 404


def test_location_list_and_detail_are_site_scoped(db, w):
    from routers.locations import get_location, list_locations, list_location_employees, location_stats
    ids = {l.id for l in list_locations(search="", city="", active_only=True, db=db, current_user=w.sup_n)}
    assert ids == {10}
    assert {l.id for l in list_locations(search="", city="", active_only=True, db=db, current_user=w.admin)} == {10, 11}
    assert location_stats(db=db, current_user=w.sup_n)["total_locations"] == 1
    with pytest.raises(HTTPException):
        get_location(location_id=w.south.id, db=db, current=w.sup_n)
    with pytest.raises(HTTPException):
        list_location_employees(location_id=w.south.id, db=db, current=w.sup_n)


def test_supervisor_cannot_assign_to_other_site(db, w):
    from routers.locations import assign_employee
    from schemas.work_location import EmployeeLocationAssignmentCreate
    payload = EmployeeLocationAssignmentCreate(employee_id=w.unassigned.id, location_id=w.south.id)
    with pytest.raises(HTTPException) as e:
        assign_employee(payload=payload, db=db, current=w.sup_n)
    assert e.value.status_code == 404


def test_supervisor_can_assign_unassigned_worker_to_own_site(db, w):
    from routers.locations import assign_employee
    from schemas.work_location import EmployeeLocationAssignmentCreate
    payload = EmployeeLocationAssignmentCreate(employee_id=w.unassigned.id, location_id=w.north.id)
    assign_employee(payload=payload, db=db, current=w.sup_n)
    assert w.unassigned.id in scope.visible_employee_ids(db, w.sup_n)


def test_supervisor_cannot_pull_worker_from_other_site(db, w):
    from routers.locations import assign_employee
    from schemas.work_location import EmployeeLocationAssignmentCreate
    payload = EmployeeLocationAssignmentCreate(employee_id=w.s1.id, location_id=w.north.id)
    with pytest.raises(HTTPException) as e:
        assign_employee(payload=payload, db=db, current=w.sup_n)
    assert e.value.status_code == 404


def test_attendance_views_are_site_scoped(db, w):
    from routers.attendance import daily_summary, get_by_date, get_monthly_report
    today = date(2026, 11, 10)
    for emp in (w.n1, w.s1):
        db.add(Attendance(employee_id=emp.id, date=today, entry_time=time(9, 0)))
    db.commit()

    assert {r.employee_id for r in daily_summary(date_param=today, db=db, current=w.sup_n)} == {
        w.sup_n.id, w.n1.id, w.n2.id}
    assert {r.employee_id for r in get_by_date(record_date=today, db=db, current=w.sup_n)} == {w.n1.id}
    assert {r.employee_id for r in get_by_date(record_date=today, db=db, current=w.admin)} == {w.n1.id, w.s1.id}
    with pytest.raises(HTTPException):
        get_monthly_report(employee_id=w.s1.id, month=11, year=2026, db=db, current=w.sup_n)


def test_dashboards_count_only_own_site(db, w):
    from routers.attendance import dashboard_employee_stats, dashboard_missed_attendance, dashboard_overview
    assert dashboard_overview(month=11, year=2026, db=db, current=w.sup_n).total_employees == 3
    assert {s["employee_id"] for s in dashboard_employee_stats(month=11, year=2026, db=db, current=w.sup_n)} == {
        w.sup_n.id, w.n1.id, w.n2.id}
    missed = dashboard_missed_attendance(period="daily", date_param=date(2026, 11, 10), db=db, current=w.sup_n)
    assert missed.total_employees == 3


def test_geofence_events_are_site_scoped(db, w):
    from routers.geofence import list_events
    for emp in (w.n1, w.s1):
        db.add(GeofenceExitEvent(employee_id=emp.id, exited_at=datetime(2026, 11, 10, tzinfo=timezone.utc),
                                 latitude=17.0, longitude=78.0, distance_m=500.0))
    db.commit()
    rows = list_events(open_only=False, employee_id=None, date_from=None, date_to=None, limit=100,
                       db=db, current=w.sup_n)
    assert {r.employee_id for r in rows} == {w.n1.id}


def test_fleet_views_are_site_scoped(db, w):
    from routers.assignments import list_assignments
    from routers.tracking import get_latest_locations, location_history
    from routers.vehicles import list_vehicles
    _vehicle(db, 1, w.n1), _vehicle(db, 2, w.s1), _vehicle(db, 3)

    assert {v.id for v in list_vehicles(db=db, current=w.sup_n)} == {1, 3}
    assert {v.id for v in list_vehicles(db=db, current=w.admin)} == {1, 2, 3}
    assert {a.vehicle_id for a in list_assignments(active_only=True, db=db, current=w.sup_n)} == {1}
    assert {r.vehicle_id for r in get_latest_locations(db=db, current=w.sup_n)} == {1, 3}
    with pytest.raises(HTTPException):
        location_history(vehicle_id=2, limit=10, db=db, current=w.sup_n)


def test_worker_face_scan_only_matches_themselves(db, w, monkeypatch):
    import routers.attendance as att
    seen = {}

    def fake_identify(image, employees):
        seen["ids"] = {e.id for e in employees}
        return None

    monkeypatch.setattr(att, "identify_employee", fake_identify)
    w.n1.face_encoding = [0.1]
    w.n2.face_encoding = [0.2]
    db.commit()
    payload = SimpleNamespace(image="x", latitude=17.0, longitude=78.0)
    with pytest.raises(HTTPException):
        att.face_scan_clock(payload=payload, db=db, current=w.n1)
    assert seen["ids"] == {w.n1.id}


# ── Supervisor-created workers join the supervisor's site ─────────────────────

def _new_worker_payload(username):
    from schemas.employee import EmployeeCreate
    return EmployeeCreate(
        username=username, password="secret123", name="New Hire", address="12 MG Road",
        aadhar_number="234567890123", bank_account_number="12345678901", hourly_rate=100,
    )


def test_supervisor_created_worker_joins_their_site(db, w, monkeypatch):
    import routers.employees as emp_router
    monkeypatch.setattr(emp_router, "enforce_seat_limit", lambda *a, **k: None)
    monkeypatch.setattr(emp_router, "_generate_employee_code", lambda *a, **k: "E900")

    emp = emp_router._persist_employee(db, _new_worker_payload("newhire"), w.sup_n)

    assert emp.id in scope.visible_employee_ids(db, w.sup_n)
    assert emp.id not in scope.visible_employee_ids(db, w.sup_s)
    assert emp.work_location_name == "North"


def test_supervisor_without_site_cannot_create_workers(db, w, monkeypatch):
    import routers.employees as emp_router
    monkeypatch.setattr(emp_router, "enforce_seat_limit", lambda *a, **k: None)
    with pytest.raises(HTTPException) as e:
        emp_router._persist_employee(db, _new_worker_payload("orphan"), w.sup_x)
    assert e.value.status_code == 409
