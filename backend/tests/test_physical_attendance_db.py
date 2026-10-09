"""DB-backed physical attendance flows on an in-memory SQLite database.

Face matching is the one thing stubbed: ``face_recognition`` is a heavy native
dependency, and what is under test here is everything around the match.
"""
import sys
from datetime import date, time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker

from models.attendance import Attendance
from models.company import Company
from models.user import User
from models.work_location import WorkLocation
from services import physical_attendance_service as service


@compiles(JSONB, "sqlite")
def _jsonb_on_sqlite(type_, compiler, **kw):
    return "JSON"


SITE_LAT, SITE_LON = 17.3850, 78.4867
FAR_LAT = SITE_LAT + 340 / 111_000.0


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    tables = [m.__table__ for m in (Company, User, WorkLocation, Attendance)]
    Company.metadata.create_all(engine, tables=tables)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def world(db):
    """Two companies; company 1 has an admin, two supervisors, two sites and two workers."""
    db.add_all([Company(id=1, name="Acme", code="ACME"), Company(id=2, name="Other", code="OTH")])
    db.flush()

    def user(id, role, company_id=1, **kw):
        u = User(id=id, username=f"u{id}", password_hash="x", role=role, company_id=company_id,
                 is_active=True, **kw)
        db.add(u)
        return u

    w = SimpleNamespace(
        admin=user(1, "admin"),
        sup=user(2, "supervisor", display_name="Sup One"),
        sup2=user(3, "supervisor"),
        ravi=user(4, "worker", name="Ravi K", employee_code="E004", shift="SHIFT_A", face_encoding=[0.1]),
        mala=user(5, "worker", name="Mala S", employee_code="E005", shift="SHIFT_A", face_encoding=[0.2]),
        inactive=user(6, "worker", name="Gone", face_encoding=[0.3]),
        other_admin=user(7, "admin", company_id=2),
        other_worker=user(8, "worker", company_id=2, name="Outsider", face_encoding=[0.4]),
        master=user(9, "master", company_id=None),
    )
    w.inactive.is_active = False
    db.flush()

    def site(id, name, company_id=1, active=True, lat=SITE_LAT):
        s = WorkLocation(id=id, company_id=company_id, location_name=name, latitude=lat,
                         longitude=SITE_LON, allowed_radius_m=50.0, is_active=active)
        db.add(s)
        return s

    w.yard = site(10, "Yard A")
    w.depot = site(11, "Depot B", lat=SITE_LAT + 1.0)
    w.closed = site(12, "Closed", active=False)
    w.foreign = site(13, "Foreign", company_id=2)
    db.commit()
    return w


@pytest.fixture
def match(monkeypatch):
    """Stub face matching. ``match.worker`` is who the next scan matches; the
    candidates the service offered are recorded in ``match.candidates``."""
    state = SimpleNamespace(worker=None, candidates=None)

    def identify_employee(image, employees):
        state.candidates = list(employees)
        return state.worker

    monkeypatch.setitem(sys.modules, "services.face_service",
                        SimpleNamespace(identify_employee=identify_employee))
    return state


def enable(db, w, supervisor=None, site=None):
    return service.set_site(db, w.admin, (supervisor or w.sup).id, (site or w.yard).id)


# ── set_site / list_supervisors ──────────────────────────────────────────────

def test_set_site_enables_supervisor(db, world):
    row = enable(db, world)
    assert (row["site_id"], row["site_name"]) == (10, "Yard A")
    assert service.is_enabled(world.sup) is True


def test_set_site_can_change_and_clear(db, world):
    enable(db, world)
    assert service.set_site(db, world.admin, world.sup.id, 11)["site_name"] == "Depot B"
    row = service.set_site(db, world.admin, world.sup.id, None)
    assert (row["site_id"], row["site_name"]) == (None, None)
    assert service.is_enabled(world.sup) is False


@pytest.mark.parametrize("target_id", [4, 1, 999])  # worker, admin, missing
def test_set_site_only_targets_supervisors(db, world, target_id):
    with pytest.raises(HTTPException) as e:
        service.set_site(db, world.admin, target_id, 10)
    assert e.value.status_code == 404


def test_set_site_rejects_other_companys_site(db, world):
    with pytest.raises(HTTPException) as e:
        service.set_site(db, world.admin, world.sup.id, 13)
    assert e.value.status_code == 404
    assert world.sup.physical_attendance_site_id is None


def test_set_site_rejects_inactive_site(db, world):
    with pytest.raises(HTTPException) as e:
        service.set_site(db, world.admin, world.sup.id, 12)
    assert e.value.status_code == 400


def test_admin_of_another_company_cannot_assign(db, world):
    with pytest.raises(HTTPException) as e:
        service.set_site(db, world.other_admin, world.sup.id, 10)
    assert e.value.status_code == 404


def test_master_can_assign_but_only_a_site_of_the_supervisors_company(db, world):
    assert service.set_site(db, world.master, world.sup.id, 10)["site_id"] == 10
    with pytest.raises(HTTPException):
        service.set_site(db, world.master, world.sup.id, 13)


def test_list_supervisors_is_tenant_scoped_and_names_sites(db, world):
    enable(db, world)
    rows = service.list_supervisors(db, world.admin)
    assert [(r["id"], r["site_name"]) for r in rows] == [(2, "Yard A"), (3, None)]
    assert service.list_supervisors(db, world.other_admin) == []


# ── scan ─────────────────────────────────────────────────────────────────────

def test_first_scan_clocks_in_and_stamps_site(db, world, match):
    enable(db, world)
    match.worker = world.ravi
    result = service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)

    assert result["action"] == "clock_in"
    assert (result["employee_id"], result["employee_name"], result["employee_code"]) == (4, "Ravi K", "E004")
    rec = db.query(Attendance).one()
    assert (rec.employee_id, rec.date, rec.site_location_id, rec.marked_by) == (4, date.today(), 10, 2)
    assert rec.exit_time is None
    assert (rec.clock_in_latitude, rec.clock_in_longitude) == (SITE_LAT, SITE_LON)


def test_second_scan_clocks_out_and_third_is_refused(db, world, match):
    enable(db, world)
    match.worker = world.ravi
    service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)
    rec = db.query(Attendance).one()
    rec.entry_time = time(0, 0)  # make the worked interval non-trivial
    db.commit()

    assert service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)["action"] == "clock_out"
    db.refresh(rec)
    assert rec.exit_time is not None
    assert rec.hours_worked is not None

    with pytest.raises(HTTPException) as e:
        service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)
    assert e.value.status_code == 400
    assert e.value.detail == "Ravi K has already clocked in and out today."
    assert db.query(Attendance).count() == 1


def test_scan_away_from_site_records_nothing(db, world, match):
    enable(db, world)
    match.worker = world.ravi
    with pytest.raises(HTTPException) as e:
        service.scan(db, world.sup, "img", FAR_LAT, SITE_LON)
    assert e.value.status_code == 403
    assert "Yard A" in e.value.detail
    assert db.query(Attendance).count() == 0
    assert match.candidates is None  # rejected before any face matching


def test_scan_without_gps_records_nothing(db, world, match):
    enable(db, world)
    match.worker = world.ravi
    with pytest.raises(HTTPException) as e:
        service.scan(db, world.sup, "img", None, None)
    assert e.value.status_code == 400
    assert db.query(Attendance).count() == 0


def test_scan_with_no_face_match_is_404(db, world, match):
    enable(db, world)
    with pytest.raises(HTTPException) as e:
        service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)
    assert e.value.status_code == 404
    assert e.value.detail == "No matching employee found. Register the worker's face first."


def test_scan_only_offers_active_faces_of_own_company(db, world, match):
    enable(db, world)
    match.worker = world.ravi
    service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)
    assert sorted(u.id for u in match.candidates) == [4, 5]


def test_scan_out_of_a_record_made_by_the_existing_flow_joins_the_site_list(db, world, match):
    enable(db, world)
    db.add(Attendance(employee_id=5, date=date.today(), entry_time=time(0, 0)))
    db.commit()
    assert service.today_list(db, world.sup)["present_count"] == 0

    match.worker = world.mala
    assert service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)["action"] == "clock_out"
    today = service.today_list(db, world.sup)
    assert [e["name"] for e in today["entries"]] == ["Mala S"]


def test_scan_when_site_was_deactivated_is_409(db, world, match):
    enable(db, world)
    world.yard.is_active = False
    db.commit()
    with pytest.raises(HTTPException) as e:
        service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)
    assert e.value.status_code == 409


# ── today_list ───────────────────────────────────────────────────────────────

def test_today_list_shows_only_this_sites_records_for_today(db, world, match):
    enable(db, world)
    enable(db, world, supervisor=world.sup2, site=world.depot)
    match.worker = world.ravi
    service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)
    match.worker = world.mala
    service.scan(db, world.sup2, "img", SITE_LAT + 1.0, SITE_LON)
    db.add(Attendance(employee_id=5, date=date(2020, 1, 1), entry_time=time(9, 0), site_location_id=10))
    db.commit()

    yard = service.today_list(db, world.sup)
    assert (yard["site_name"], yard["date"], yard["present_count"]) == ("Yard A", date.today(), 1)
    assert [(e["employee_id"], e["employee_code"], e["exit_time"]) for e in yard["entries"]] == [(4, "E004", None)]
    assert [e["name"] for e in service.today_list(db, world.sup2)["entries"]] == ["Mala S"]


def test_accidental_rescan_right_after_clock_in_does_not_clock_out(db, world, match):
    # A supervisor working through a queue can scan the same worker twice by
    # mistake. That must not end the worker's day seconds after it started.
    enable(db, world)
    match.worker = world.ravi
    service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)
    with pytest.raises(HTTPException) as e:
        service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)
    assert e.value.status_code == 400
    assert e.value.detail.startswith("Ravi K was clocked in at ")
    assert e.value.detail.endswith("Scan again later to clock out.")
    assert db.query(Attendance).one().exit_time is None


def test_site_of_another_company_is_never_usable(db, world, match):
    # Defence in depth: even if a stale assignment survives a company move,
    # the supervisor must not read or mark attendance at the old company's site.
    enable(db, world)
    match.worker = world.ravi
    service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)
    world.sup.company_id = 2
    db.commit()

    for call in (lambda: service.today_list(db, world.sup),
                 lambda: service.get_site(db, world.sup),
                 lambda: service.scan(db, world.sup, "img", SITE_LAT, SITE_LON)):
        with pytest.raises(HTTPException) as e:
            call()
        assert e.value.status_code == 409


# ── admin user update (existing endpoint) ────────────────────────────────────

@pytest.fixture
def auth_router(match):
    # routers.auth imports face_service at module level; `match` has stubbed it.
    sys.modules.pop("routers.auth", None)
    import routers.auth as auth
    yield auth
    sys.modules.pop("routers.auth", None)


def test_demoting_a_supervisor_through_user_update_disables_physical_attendance(db, world, auth_router):
    from schemas.user import AdminUserUpdate
    enable(db, world)
    auth_router.admin_update_user(world.sup.id, AdminUserUpdate(role="worker"), db=db, current=world.admin)
    assert world.sup.physical_attendance_site_id is None

    # Re-promotion must not silently bring it back.
    auth_router.admin_update_user(world.sup.id, AdminUserUpdate(role="supervisor"), db=db, current=world.admin)
    assert world.sup.physical_attendance_site_id is None


def test_moving_a_supervisor_to_another_company_disables_physical_attendance(db, world, auth_router):
    from schemas.user import AdminUserUpdate
    enable(db, world)
    auth_router.admin_update_user(world.sup.id, AdminUserUpdate(company_id=2), db=db, current=world.master)
    assert (world.sup.company_id, world.sup.physical_attendance_site_id) == (2, None)


def test_editing_other_fields_keeps_physical_attendance(db, world, auth_router):
    from schemas.user import AdminUserUpdate
    enable(db, world)
    auth_router.admin_update_user(world.sup.id, AdminUserUpdate(display_name="New Name"), db=db, current=world.admin)
    assert world.sup.physical_attendance_site_id == 10
