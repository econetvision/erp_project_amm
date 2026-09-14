"""End-to-end scenario for geofence exit alerts against a real Postgres.

Not collected by pytest (no ``test_`` prefix) because it needs a database.
Run from backend/ with DATABASE_URL pointing at a migrated, disposable DB:

    DATABASE_URL=postgresql://erp_user:erp_pass@localhost:5434/erp_db \
    LICENSE_ENFORCE=false python tests/integration_geofence_scenario.py
"""
import os
import sys
from datetime import date, time

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)

# face_recognition (dlib) is heavy and irrelevant here; stub it when absent so
# importing the app does not require it on a dev machine.
import types  # noqa: E402
try:
    import face_recognition  # noqa: F401
except ImportError:
    _stub = types.ModuleType("face_recognition")
    for _name in ("face_encodings", "face_locations", "compare_faces", "face_distance", "load_image_file", "face_landmarks"):
        setattr(_stub, _name, lambda *a, **k: [])
    sys.modules["face_recognition"] = _stub

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402  (runs seed())
from database import SessionLocal  # noqa: E402
from auth.dependencies import create_access_token, hash_password  # noqa: E402
from models.user import User  # noqa: E402
from models.company import Company  # noqa: E402
from models.attendance import Attendance  # noqa: E402
from models.notification import Notification  # noqa: E402
from models.device_token import DeviceToken  # noqa: E402
from models.geofence import GeofenceExitEvent, EmployeeLocationPing  # noqa: E402
from models.work_location import WorkLocation, EmployeeLocationAssignment  # noqa: E402

SITE_LAT, SITE_LNG = 17.3850, 78.4867
FAR_LAT = SITE_LAT + 0.003  # ~330 m north


def check(cond, msg):
    if not cond:
        raise SystemExit(f"FAIL: {msg}")
    print(f"ok  - {msg}")


def main():
    db = SessionLocal()
    # ── Clean slate for our fixtures ─────────────────────────────────────────
    for username in ("gf_admin", "gf_super", "gf_worker", "gf_other"):
        u = db.query(User).filter(User.username == username).first()
        if u:
            db.delete(u)
    db.commit()
    company = db.query(Company).filter(Company.code == "GFTEST").first()
    if not company:
        company = Company(name="Geofence Test Co", code="GFTEST")
        db.add(company)
        db.commit()
        db.refresh(company)
    db.query(WorkLocation).filter(WorkLocation.location_code == "GF-YARD").delete()
    db.commit()

    def mk(username, role, **kw):
        u = User(username=username, password_hash=hash_password("x"), role=role,
                 company_id=company.id, is_active=True, name=kw.pop("name", username), **kw)
        db.add(u)
        db.commit()
        db.refresh(u)
        return u

    admin = mk("gf_admin", "admin")
    sup = mk("gf_super", "supervisor")
    worker = mk("gf_worker", "worker", name="Ravi Kumar")
    other = mk("gf_other", "worker")

    loc = WorkLocation(company_id=company.id, location_name="North Yard", location_code="GF-YARD",
                       latitude=SITE_LAT, longitude=SITE_LNG, allowed_radius_m=50.0,
                       supervisor_id=sup.id, is_active=True)
    db.add(loc)
    db.commit()
    db.refresh(loc)
    db.add(EmployeeLocationAssignment(employee_id=worker.id, location_id=loc.id, is_primary=True))
    db.add(Attendance(employee_id=worker.id, date=date.today(), entry_time=time(9, 0)))
    db.commit()

    client = TestClient(app)

    def auth(u):
        return {"Authorization": f"Bearer {create_access_token({'sub': str(u.id), 'role': u.role})}"}

    def ping(u, lat, lng, **extra):
        r = client.post("/api/geofence/ping", json={"latitude": lat, "longitude": lng, **extra}, headers=auth(u))
        return r

    # ── Worker cannot ping for someone else ─────────────────────────────────
    r = ping(worker, SITE_LAT, SITE_LNG, employee_id=other.id)
    check(r.status_code == 403, "worker pinging for another employee is rejected")

    # ── Inside: tracking on, no event ───────────────────────────────────────
    r = ping(worker, SITE_LAT, SITE_LNG)
    check(r.status_code == 200, f"inside ping accepted ({r.status_code} {r.text[:80]})")
    body = r.json()
    check(body["tracking"] is True and body["inside"] is True and body["event"] is None,
          f"inside ping reports tracking+inside, no event: {body}")
    check(body["nearest_location"] == "North Yard" and body["ping_interval_s"] == 60,
          "ping response carries nearest location and interval")

    # ── Two outside pings: still no alert (threshold 3) ─────────────────────
    for i in (1, 2):
        body = ping(worker, FAR_LAT, SITE_LNG).json()
        check(body["inside"] is False and body["event"] is None, f"outside ping {i} of 3: no alert yet")
    check(db.query(GeofenceExitEvent).filter(GeofenceExitEvent.employee_id == worker.id).count() == 0,
          "no exit event before threshold")

    # ── Third outside ping opens the episode and notifies ───────────────────
    body = ping(worker, FAR_LAT, SITE_LNG).json()
    check(body["event"] == "exit", f"third outside ping raises exit event: {body}")
    ev = db.query(GeofenceExitEvent).filter(GeofenceExitEvent.employee_id == worker.id).one()
    check(ev.returned_at is None and ev.location_name == "North Yard" and 300 < ev.distance_m < 360,
          f"exit event open, location + distance recorded ({ev.distance_m:.0f} m)")
    check(sorted(ev.notified_user_ids) == sorted([admin.id, sup.id]),
          f"supervisor and admin recorded as recipients: {ev.notified_user_ids}")

    def notes(u):
        return db.query(Notification).filter(Notification.user_id == u.id).order_by(Notification.id).all()

    check(len(notes(sup)) == 1 and "left North Yard" in notes(sup)[0].title and notes(sup)[0].type == "alert",
          f"supervisor got alert notification: {notes(sup)[0].title}")
    check(len(notes(admin)) == 1 and "Ravi Kumar" in notes(admin)[0].title,
          "admin got alert notification naming the employee")
    check(len(notes(worker)) == 0, "employee themself not notified")
    check(len(notes(other)) == 0, "unrelated worker not notified")

    # ── Staying outside does not re-alert ───────────────────────────────────
    body = ping(worker, FAR_LAT, SITE_LNG).json()
    check(body["event"] is None, "further outside ping does not duplicate alert")
    check(len(notes(sup)) == 1, "no duplicate notification while still outside")

    # ── Return closes the episode and notifies ──────────────────────────────
    body = ping(worker, SITE_LAT, SITE_LNG).json()
    check(body["event"] == "return", f"inside ping after exit reports return: {body}")
    db.refresh(ev)
    check(ev.returned_at is not None, "exit event closed with returned_at")
    check(len(notes(sup)) == 2 and "back at North Yard" in notes(sup)[1].title and notes(sup)[1].type == "info",
          f"supervisor got return notification: {notes(sup)[1].title}")
    check(len(notes(admin)) == 2, "admin got return notification")

    # ── Events listing (tenant scoped, includes employee name) ──────────────
    r = client.get("/api/geofence/events", headers=auth(admin))
    check(r.status_code == 200, f"admin can list events ({r.status_code})")
    rows = r.json()
    check(len(rows) == 1 and rows[0]["employee_name"] == "Ravi Kumar" and rows[0]["returned_at"],
          "events listing shows the closed episode with employee name")
    r = client.get("/api/geofence/events", params={"open_only": True}, headers=auth(sup))
    check(r.status_code == 200 and r.json() == [], "open_only filter hides closed episodes; supervisor allowed")
    r = client.get("/api/geofence/events", headers=auth(worker))
    check(r.status_code == 403, "worker cannot list events")

    # ── Device token registration ───────────────────────────────────────────
    tok = "fcm-test-token-" + "x" * 40
    r = client.post("/api/notifications/device-token", json={"token": tok}, headers=auth(sup))
    check(r.status_code == 201 and r.json()["push_enabled"] is False,
          "device token registered; push reported disabled without Firebase creds")
    r = client.post("/api/notifications/device-token", json={"token": tok}, headers=auth(admin))
    check(r.status_code == 201, "same token re-registered by another user")
    row = db.query(DeviceToken).filter(DeviceToken.token == tok).one()
    check(row.user_id == admin.id, "token re-owned by the latest user")
    r = client.request("DELETE", "/api/notifications/device-token", json={"token": tok}, headers=auth(admin))
    check(r.status_code == 200 and db.query(DeviceToken).filter(DeviceToken.token == tok).count() == 0,
          "device token unregistered")

    # ── After clock-out tracking stops ──────────────────────────────────────
    att = db.query(Attendance).filter(Attendance.employee_id == worker.id, Attendance.date == date.today()).one()
    att.exit_time = time(17, 0)
    db.commit()
    before = db.query(EmployeeLocationPing).filter(EmployeeLocationPing.employee_id == worker.id).count()
    body = ping(worker, FAR_LAT, SITE_LNG).json()
    after = db.query(EmployeeLocationPing).filter(EmployeeLocationPing.employee_id == worker.id).count()
    check(body["tracking"] is False and after == before, "after clock-out: tracking=false and ping not stored")

    print("\nALL SCENARIO CHECKS PASSED")
    db.close()


if __name__ == "__main__":
    main()
