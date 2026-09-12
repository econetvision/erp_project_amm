"""End-to-end scenario for subscription licensing against a real Postgres.

Not collected by pytest (no ``test_`` prefix) because it needs a database.
Run from backend/ with DATABASE_URL pointing at a migrated, disposable DB and
enforcement ON (no LICENSE_KEY, LICENSE_ENFORCE unset/true):

    DATABASE_URL=postgresql://erp_user:erp_pass@localhost:5433/erp_db \
    python tests/integration_licensing_scenario.py

Walks spec §8 "Manual regression" items 2-8 through the HTTP API.
"""
import io
import os
import sys
from datetime import date

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)
os.environ.pop("LICENSE_KEY", None)
os.environ["LICENSE_ENFORCE"] = "true"

import types  # noqa: E402
try:
    import face_recognition  # noqa: F401
except ImportError:
    _stub = types.ModuleType("face_recognition")
    for _name in ("face_encodings", "face_locations", "compare_faces", "face_distance", "load_image_file", "face_landmarks"):
        setattr(_stub, _name, lambda *a, **k: [])
    sys.modules["face_recognition"] = _stub

from fastapi.testclient import TestClient  # noqa: E402
from openpyxl import Workbook  # noqa: E402

from main import app  # noqa: E402  (runs seed())
from database import SessionLocal  # noqa: E402
from auth.dependencies import create_access_token, hash_password  # noqa: E402
from models.company import Company  # noqa: E402
from models.user import User  # noqa: E402
from services.subscription_service import license_bypass_active  # noqa: E402

CODE = "LICTEST"
PREFIX = "lic_"


def check(cond, msg):
    if not cond:
        raise SystemExit(f"FAIL: {msg}")
    print(f"ok  - {msg}")


def auth(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': str(user.id), 'role': user.role})}"}


def main():
    check(not license_bypass_active(), "enforcement is on for this run")
    db = SessionLocal()
    # ── Clean slate ─────────────────────────────────────────────────────────
    db.query(User).filter(User.username.like(f"{PREFIX}%")).delete(synchronize_session=False)
    db.commit()
    old = db.query(Company).filter(Company.code == CODE).first()
    if old:
        db.delete(old)   # cascades subscriptions / licences / invoices
        db.commit()
    company = Company(name="Licensing Test Co", code=CODE, gst_number="29ABCDE1234F1Z5", city="Hyderabad")
    db.add(company)
    db.commit()
    db.refresh(company)
    master = db.query(User).filter(User.role == "master").first()
    check(master is not None, "seeded master user exists")
    M = auth(master)
    c = TestClient(app)

    # ── 1. Subscription + 3 licences ────────────────────────────────────────
    r = c.post("/api/subscriptions", json={"company_id": company.id, "plan": "pro", "unit_price": "1000.00",
                                           "initial_licenses": 3}, headers=M)
    check(r.status_code == 201, f"create subscription -> {r.status_code} {r.text[:120]}")
    sub = r.json()
    check(sub["capacity"] == 78 and sub["admin_cap"] == 3 and sub["active_licenses"] == 3,
          f"capacity 78 / admins 3 / licences 3 (got {sub['capacity']}/{sub['admin_cap']}/{sub['active_licenses']})")
    check(sub["seats_used"] == 0 and sub["is_valid"], "0 seats used, valid")
    r = c.post("/api/subscriptions", json={"company_id": company.id}, headers=M)
    check(r.status_code == 400, "second active subscription rejected")

    # ── 2. Admin cap: 3 admins ok, 4th rejected ─────────────────────────────
    def mk_user(username, role):
        return c.post("/api/auth/users", json={"username": username, "password": "Secret123", "role": role,
                                               "company_id": company.id}, headers=M)
    for i in range(1, 4):
        r = mk_user(f"{PREFIX}admin{i}", "admin")
        check(r.status_code == 201, f"admin {i} created")
    r = mk_user(f"{PREFIX}admin4", "admin")
    check(r.status_code == 403 and r.json()["detail"] == "Admin limit exceeded (3/3)",
          f"4th admin -> 403 'Admin limit exceeded (3/3)' (got {r.status_code} {r.text[:80]})")
    admin = db.query(User).filter(User.username == f"{PREFIX}admin1").first()
    A = auth(admin)

    # ── 3. Login passes while valid ─────────────────────────────────────────
    r = c.post("/api/auth/login", json={"username": admin.username, "password": "Secret123", "client": "web"})
    check(r.status_code == 200, f"admin login 200 (got {r.status_code} {r.text[:80]})")

    # ── 4. Fill seats to the cap, 79th rejected ─────────────────────────────
    for i in range(1, 75):  # 3 admins + 74 workers = 77
        db.add(User(username=f"{PREFIX}w{i}", password_hash=hash_password("x"), role="worker",
                    company_id=company.id, is_active=True, name=f"W{i}"))
    db.commit()
    # ── 5. Bulk import with 1 seat left: first row created, then stops at the
    #       first rejected row (guards the §4 string-comparison trap) ─────────
    def import_rows(n):
        wb = Workbook()
        ws = wb.active
        ws.append(["username*", "password*", "name*", "address*", "aadhar_number*", "bank_account_number*", "hourly_rate*"])
        for i in range(1, n + 1):
            ws.append([f"{PREFIX}imp{i}", "Secret123", f"Imp {i}", "12 MG Road", f"9{i:011d}", f"1234567{i:04d}", 100])
        buf = io.BytesIO()
        wb.save(buf)
        return c.post("/api/employees/import", files={"file": ("emp.xlsx", buf.getvalue(),
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}, headers=A)

    r = import_rows(3)
    check(r.status_code == 200, f"import with one seat left accepted ({r.status_code} {r.text[:120]})")
    body = r.json()
    check(body["created"] == 1 and body["created_employees"][0]["name"] == "Imp 1",
          f"exactly one row imported ({body['created_employees']})")
    errs = body["errors"]
    check(len(errs) == 1 and errs[0]["row"] == 3 and "Seat limit exceeded (78/78)" in errs[0]["error"]
          and "remaining rows were skipped" in errs[0]["error"],
          f"import stopped at the first rejected row with counts ({errs})")
    r = mk_user(f"{PREFIX}w79", "worker")
    check(r.status_code == 403 and r.json()["detail"] == "Seat limit exceeded (78/78)",
          f"79th user -> 403 'Seat limit exceeded (78/78)' (got {r.status_code} {r.text[:80]})")
    r = c.get("/api/subscriptions/my", headers=A)
    check(r.status_code == 200 and r.json()["seats_used"] == 78 and r.json()["admins_used"] == 3,
          "GET /subscriptions/my shows 78 seats / 3 admins")
    r = import_rows(1)
    check(r.status_code == 403 and r.json()["detail"] == "Seat limit exceeded (78/78)", "import at cap fails fast before parsing")

    # ── 6. Soft revoke: existing users keep working, new create blocked ─────
    lic_id = sub["licenses"][0]["id"]
    r = c.post(f"/api/licenses/{lic_id}/revoke", json={"reason": "downsized"}, headers=M)
    check(r.status_code == 200 and r.json()["status"] == "revoked" and r.json()["revoke_reason"] == "downsized", "licence revoked")
    r = c.post("/api/auth/login", json={"username": admin.username, "password": "Secret123", "client": "web"})
    check(r.status_code == 200, "admin still logs in while over capacity (78/52)")
    r = c.get("/api/employees", headers=A)
    check(r.status_code == 200, "per-request access still allowed while over capacity")
    r = mk_user(f"{PREFIX}w80", "worker")
    check(r.status_code == 403 and r.json()["detail"] == "Seat limit exceeded (78/52)",
          f"new user blocked with (78/52) (got {r.text[:80]})")
    r = c.post(f"/api/licenses/{lic_id}/revoke", json={}, headers=M)
    check(r.status_code == 400, "double revoke rejected")

    # ── 7. Grant one more licence on a site; site from another company rejected ─
    r = c.post("/api/licenses", json={"subscription_id": sub["id"], "quantity": 2, "site_id": None}, headers=M)
    check(r.status_code == 201 and len(r.json()) == 2, "grant quantity=2 creates 2 licences")
    r = c.get(f"/api/subscriptions/{sub['id']}", headers=M)
    check(r.json()["capacity"] == 104 and r.json()["active_licenses"] == 4, "capacity now 104 with 4 active licences")
    r = c.post("/api/licenses", json={"subscription_id": sub["id"], "site_id": 999999}, headers=M)
    check(r.status_code == 400, "unknown / foreign site rejected")

    # ── 8. Invoice ──────────────────────────────────────────────────────────
    today = date.today()
    r = c.post("/api/invoices/generate", json={"company_id": company.id, "period_start": today.replace(day=1).isoformat(),
                                               "period_end": today.isoformat()}, headers=M)
    check(r.status_code == 201, f"invoice generated ({r.status_code} {r.text[:120]})")
    inv = r.json()
    check(len(inv["lines"]) == 5, f"5 lines (3 original incl. revoked-in-period + 2 new) got {len(inv['lines'])}")
    check(inv["subtotal"] == "5000.00" and inv["tax_amount"] == "900.00" and inv["total"] == "5900.00",
          f"GST maths 5000 + 900 = 5900 (got {inv['subtotal']}/{inv['tax_amount']}/{inv['total']})")
    check(inv["invoice_number"].startswith(f"INV-{today.year}-") and inv["status"] == "draft", f"number {inv['invoice_number']} draft")
    check(inv["billing_snapshot"]["gst_number"] == "29ABCDE1234F1Z5", "billing snapshot frozen")
    r2 = c.post("/api/invoices/generate", json={"company_id": company.id, "period_start": today.replace(day=1).isoformat(),
                                                "period_end": today.isoformat()}, headers=M)
    n1, n2 = int(inv["invoice_number"].rsplit("-", 1)[1]), int(r2.json()["invoice_number"].rsplit("-", 1)[1])
    check(n2 == n1 + 1, f"sequential numbering {n1} -> {n2}")
    r = c.post(f"/api/invoices/{inv['id']}/mark-paid", json={"payment_ref": "UTR123"}, headers=M)
    check(r.status_code == 200 and r.json()["status"] == "paid" and r.json()["payment_ref"] == "UTR123", "mark paid")
    r = c.post(f"/api/invoices/{inv['id']}/void", headers=M)
    check(r.status_code == 400, "paid invoice cannot be voided")
    r = c.post(f"/api/invoices/{r2.json()['id']}/void", headers=M)
    check(r.status_code == 200 and r.json()["status"] == "void", "draft invoice voided")
    r = c.get("/api/invoices", headers=A)
    check(r.status_code == 200 and len(r.json()) == 2 and all(i["company_id"] == company.id for i in r.json()), "admin sees own invoices")
    r = c.get(f"/api/invoices/{inv['id']}", headers=A)
    check(r.status_code == 200 and len(r.json()["lines"]) == 5, "admin can open own invoice with lines")

    # ── 9. Suspend blocks login and requests; activate restores ────────────
    r = c.post(f"/api/subscriptions/{sub['id']}/suspend", headers=M)
    check(r.status_code == 200 and r.json()["status"] == "suspended", "suspended")
    r = c.post("/api/auth/login", json={"username": admin.username, "password": "Secret123", "client": "web"})
    check(r.status_code == 403 and r.json()["detail"] == "Subscription suspended", f"login blocked when suspended ({r.text[:60]})")
    r = c.get("/api/employees", headers=A)
    check(r.status_code == 403, "per-request blocked when suspended")
    r = c.get("/api/subscriptions/my", headers=A)
    check(r.status_code == 200 and r.json()["is_valid"] is False and r.json()["reason_code"] == "SUSPENDED",
          "blocked admin can still read /subscriptions/my with the reason")
    r = c.post(f"/api/subscriptions/{sub['id']}/activate", headers=M)
    check(r.status_code == 200 and r.json()["is_valid"], "activated again")

    # ── 10. Admin cannot mutate ─────────────────────────────────────────────
    r = c.post("/api/licenses", json={"subscription_id": sub["id"]}, headers=A)
    check(r.status_code == 403, "admin cannot grant licences")
    r = c.post(f"/api/subscriptions/{sub['id']}/suspend", headers=A)
    check(r.status_code == 403, "admin cannot suspend")

    # ── Cleanup ─────────────────────────────────────────────────────────────
    db.query(User).filter(User.username.like(f"{PREFIX}%")).delete(synchronize_session=False)
    db.commit()
    db.delete(db.query(Company).filter(Company.code == CODE).first())
    db.commit()
    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
