# Physical Attendance App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin nominate one supervisor per site who marks workers' attendance by face scan from a separate attendance-only Android app, accepted only at that site.

**Architecture:** A nullable `users.physical_attendance_site_id` both enables the feature and names the site. A new backend router `/api/physical-attendance` (admin endpoints plus supervisor endpoints behind a new guard) reuses the existing face-identification and hours maths. A new admin web page under Workforce manages assignments. A new Gradle module `mobile/attendance` builds a second APK with copied camera/session/network code.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Alembic; React 18 + TypeScript + Bootstrap 5; Kotlin + CameraX + ML Kit + Retrofit; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-09-physical-attendance-app-design.md`

## Global Constraints

- The existing `:app` Android module is not modified. The only existing mobile file that changes is `mobile/settings.gradle.kts`.
- Existing `/api/attendance/*` endpoints and their behaviour do not change.
- Existing GitHub workflows are not edited.
- Any schema change is made in three places: the model, Alembic migration `0032_physical_attendance`, and `db/init.sql`.
- A scan is accepted only inside `allowed_radius_m + settings.geofence_buffer_m` of the supervisor's site; a scan without coordinates is rejected.
- Enabled means: active user, role `supervisor`, `physical_attendance_site_id` set.
- Only `admin` and `master` can assign, change or clear a site.
- Android: application id `com.econetvision.erp.attendance`, min SDK 26, compile/target SDK 34, JDK 17.
- Error responses are `HTTPException` with a `detail` string. Exact texts:
  - `Physical attendance is not enabled for your account. Contact your admin.` (403)
  - `Location is required. Please enable GPS and try again.` (400)
  - `You are {n} m from {site}. Attendance can only be marked at the site.` (403)
  - `No matching employee found. Register the worker's face first.` (404)
  - `{name} has already clocked in and out today.` (400)
  - `Your assigned site is no longer available. Contact your admin.` (409)
- Nothing is deployed or merged by this plan. It ends with a pushed branch, an open PR, and a CI-built APK.

## Review Focus

1. **Scan with no GPS fix** (coordinates missing): must be rejected with the 400 above and record nothing. Pinned in Task 2 (`test_ensure_at_site_requires_coordinates`).
2. **Supervisor disabled, deactivated or demoted while logged in**: the next API call must be refused. Pinned in Task 2 (`test_is_enabled_*`) and Task 3 (`test_guard_rejects_disabled`).
3. **Site deactivated or deleted after assignment**: must give the 409 above, not a 500. Pinned in Task 2 (`test_ensure_site_usable_*`).
4. **Worker clocked in through the existing flow, then scanned out by the supervisor**: clock-out must work and the worker must appear in the site list. Pinned in Task 2 (`test_stamp_site_fills_missing_only`).
5. **Error body that is not the usual JSON** (a new supervisor who has not done the first browser login gets a 403 with a `detail` string; a gateway error returns HTML): the app must show the server's message when there is one and a readable fallback otherwise. Pinned in Task 5 (`ApiErrorTest`).

---

### Task 1: Schema

**Files:**
- Modify: `backend/models/user.py`
- Modify: `backend/models/attendance.py`
- Create: `backend/alembic/versions/0032_physical_attendance.py`
- Modify: `db/init.sql` (after the `idx_wl_active` index)
- Test: `backend/tests/test_physical_attendance_schema.py`

**Interfaces:**
- Produces: `User.physical_attendance_site_id`, `Attendance.site_location_id`, `Attendance.marked_by` (all nullable `Integer`).

- [ ] **Step 1: Install the test runner in the project venv**

Run: `.venv/bin/python -m pip install pytest`
Then: `cd backend && ../.venv/bin/python -m pytest tests -q`
Expected: existing tests pass. Record the count.

- [ ] **Step 2: Write the failing test**

`backend/tests/test_physical_attendance_schema.py`:

```python
import importlib
import pkgutil

import models
from sqlalchemy.orm import configure_mappers


def _import_all_models():
    for mod in pkgutil.iter_modules(models.__path__):
        importlib.import_module(f"models.{mod.name}")


def test_new_columns_exist():
    _import_all_models()
    from models.attendance import Attendance
    from models.user import User

    assert "physical_attendance_site_id" in User.__table__.c
    assert User.__table__.c.physical_attendance_site_id.nullable is True
    assert "site_location_id" in Attendance.__table__.c
    assert "marked_by" in Attendance.__table__.c


def test_mappers_still_configure():
    # attendance now has two foreign keys to users (employee_id, marked_by);
    # the employee relationship must name which one it uses.
    _import_all_models()
    configure_mappers()
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_physical_attendance_schema.py -q`
Expected: `test_new_columns_exist` FAILS on the first assert. (If `_import_all_models` itself errors on a legacy module, replace the `pkgutil` loop with the explicit `import models.<name>` list from `backend/main.py` and re-run.)

- [ ] **Step 4: Add the columns**

In `backend/models/user.py`, after the `must_change_password` column:

```python
    # Physical attendance: the one work location where this supervisor may mark
    # workers' attendance from the attendance-only app. NULL = not enabled.
    physical_attendance_site_id = Column(
        Integer,
        ForeignKey("work_locations.id", ondelete="SET NULL", use_alter=True,
                   name="fk_users_physical_attendance_site"),
        nullable=True,
    )
```

In the same file change the `attendance` relationship to:

```python
    attendance = relationship("Attendance", back_populates="employee", cascade="all, delete",
                              foreign_keys="Attendance.employee_id")
```

In `backend/models/attendance.py`, after `clock_out_longitude`:

```python
    # Set only for records marked through physical attendance (supervisor scan).
    site_location_id = Column(Integer, ForeignKey("work_locations.id", ondelete="SET NULL"),
                              nullable=True, index=True)
    marked_by        = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
```

and change the relationship to:

```python
    employee = relationship("User", back_populates="attendance", foreign_keys=[employee_id])
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && ../.venv/bin/python -m pytest tests -q`
Expected: all pass, two more than Step 1.

- [ ] **Step 6: Write the migration**

`backend/alembic/versions/0032_physical_attendance.py`:

```python
"""Physical attendance: supervisor site assignment and site-stamped attendance.

Revision ID: 0032_physical_attendance
Revises: 0031_subscription_licensing
Create Date: 2026-10-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0032_physical_attendance"
down_revision = "0031_subscription_licensing"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    return column in {c["name"] for c in sa_inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    if not _has_column("users", "physical_attendance_site_id"):
        op.add_column("users", sa.Column("physical_attendance_site_id", sa.Integer, nullable=True))
        op.create_foreign_key(
            "fk_users_physical_attendance_site", "users", "work_locations",
            ["physical_attendance_site_id"], ["id"], ondelete="SET NULL",
        )
    if not _has_column("attendance", "site_location_id"):
        op.add_column("attendance", sa.Column("site_location_id", sa.Integer, nullable=True))
        op.create_foreign_key(
            "fk_attendance_site_location", "attendance", "work_locations",
            ["site_location_id"], ["id"], ondelete="SET NULL",
        )
    if not _has_column("attendance", "marked_by"):
        op.add_column("attendance", sa.Column("marked_by", sa.Integer, nullable=True))
        op.create_foreign_key(
            "fk_attendance_marked_by", "attendance", "users",
            ["marked_by"], ["id"], ondelete="SET NULL",
        )
    op.create_index("ix_attendance_site_location_id", "attendance", ["site_location_id"],
                    if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_attendance_site_location_id", table_name="attendance", if_exists=True)
    if _has_column("attendance", "marked_by"):
        op.drop_column("attendance", "marked_by")
    if _has_column("attendance", "site_location_id"):
        op.drop_column("attendance", "site_location_id")
    if _has_column("users", "physical_attendance_site_id"):
        op.drop_column("users", "physical_attendance_site_id")
```

- [ ] **Step 7: Mirror in `db/init.sql`**

Immediately after the line `CREATE INDEX IF NOT EXISTS idx_wl_active ON work_locations(is_active);` add:

```sql

-- ── Physical Attendance ──────────────────────────────────────────────────────
-- A supervisor with a site set here may mark workers' attendance by face scan
-- from the attendance-only app, at that site only. NULL = not enabled.
ALTER TABLE users ADD COLUMN IF NOT EXISTS physical_attendance_site_id INTEGER
    CONSTRAINT fk_users_physical_attendance_site REFERENCES work_locations(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS site_location_id INTEGER
    CONSTRAINT fk_attendance_site_location REFERENCES work_locations(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS marked_by INTEGER
    CONSTRAINT fk_attendance_marked_by REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_attendance_site_location_id ON attendance(site_location_id);
```

- [ ] **Step 8: Check the migration chain has a single head**

Run: `cd backend && ../.venv/bin/python -m alembic heads`
Expected: one line, `0032_physical_attendance (head)`. (If alembic cannot load its config without a database, instead run `grep -rn "down_revision" alembic/versions/0032_physical_attendance.py` and confirm it names `0031_subscription_licensing`.)

- [ ] **Step 9: Commit**

```bash
git add backend/models/user.py backend/models/attendance.py backend/alembic/versions/0032_physical_attendance.py db/init.sql backend/tests/test_physical_attendance_schema.py
git commit -m "feat(backend): physical attendance schema"
```

---

### Task 2: Pure rules

**Files:**
- Create: `backend/services/physical_attendance_service.py`
- Test: `backend/tests/test_physical_attendance.py`

**Interfaces:**
- Consumes: `services.geofence_service.haversine_m(lat1, lon1, lat2, lon2) -> float`.
- Produces (all in `services.physical_attendance_service`):
  - `NOT_ENABLED_DETAIL: str`
  - `SiteCheck(inside: bool, distance_m: float)`
  - `is_enabled(user) -> bool`
  - `check_at_site(site_lat, site_lon, radius_m, buffer_m, lat, lon) -> SiteCheck`
  - `ensure_site_usable(site) -> None` (raises 409)
  - `ensure_at_site(site, latitude, longitude, buffer_m) -> SiteCheck` (raises 400 / 403)
  - `next_action(record) -> str` (`"clock_in"`, `"clock_out"` or `"done"`)
  - `stamp_site(record, site_id, supervisor_id) -> None`
  - `worker_label(user) -> str`

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_physical_attendance.py`:

```python
from datetime import time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from services.physical_attendance_service import (
    NOT_ENABLED_DETAIL, check_at_site, ensure_at_site, ensure_site_usable,
    is_enabled, next_action, stamp_site, worker_label,
)

SITE = SimpleNamespace(id=5, location_name="Yard A", latitude=17.3850, longitude=78.4867,
                       allowed_radius_m=50.0, is_active=True)


def offset_lat(base, metres):
    return base + metres / 111_000.0


def user(**kw):
    base = dict(role="supervisor", is_active=True, physical_attendance_site_id=5)
    base.update(kw)
    return SimpleNamespace(**base)


# ── is_enabled ───────────────────────────────────────────────────────────────

def test_is_enabled_for_active_supervisor_with_site():
    assert is_enabled(user()) is True


def test_is_enabled_false_without_site():
    assert is_enabled(user(physical_attendance_site_id=None)) is False


def test_is_enabled_false_when_deactivated():
    assert is_enabled(user(is_active=False)) is False


@pytest.mark.parametrize("role", ["worker", "admin", "master"])
def test_is_enabled_false_for_other_roles(role):
    assert is_enabled(user(role=role)) is False


def test_is_enabled_treats_null_is_active_as_active():
    # users.is_active is nullable in the model; legacy rows may hold NULL.
    assert is_enabled(user(is_active=None)) is True


# ── check_at_site ────────────────────────────────────────────────────────────

def test_check_at_site_inside_radius():
    r = check_at_site(SITE.latitude, SITE.longitude, 50.0, 25.0, SITE.latitude, SITE.longitude)
    assert r.inside is True
    assert r.distance_m < 1.0


def test_check_at_site_inside_buffer_only():
    lat = offset_lat(SITE.latitude, 70)  # outside 50 m, inside 50 + 25 m
    r = check_at_site(SITE.latitude, SITE.longitude, 50.0, 25.0, lat, SITE.longitude)
    assert r.inside is True
    assert 65 < r.distance_m < 75


def test_check_at_site_outside():
    lat = offset_lat(SITE.latitude, 340)
    r = check_at_site(SITE.latitude, SITE.longitude, 50.0, 25.0, lat, SITE.longitude)
    assert r.inside is False
    assert 330 < r.distance_m < 350


# ── ensure_site_usable ───────────────────────────────────────────────────────

def test_ensure_site_usable_passes_for_active_site():
    ensure_site_usable(SITE)


def test_ensure_site_usable_rejects_missing_site():
    with pytest.raises(HTTPException) as e:
        ensure_site_usable(None)
    assert e.value.status_code == 409
    assert e.value.detail == "Your assigned site is no longer available. Contact your admin."


def test_ensure_site_usable_rejects_inactive_site():
    inactive = SimpleNamespace(**{**SITE.__dict__, "is_active": False})
    with pytest.raises(HTTPException) as e:
        ensure_site_usable(inactive)
    assert e.value.status_code == 409


# ── ensure_at_site ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("lat,lon", [(None, 78.4867), (17.385, None), (None, None)])
def test_ensure_at_site_requires_coordinates(lat, lon):
    with pytest.raises(HTTPException) as e:
        ensure_at_site(SITE, lat, lon, 25.0)
    assert e.value.status_code == 400
    assert e.value.detail == "Location is required. Please enable GPS and try again."


def test_ensure_at_site_rejects_far_away_with_distance_and_name():
    lat = offset_lat(SITE.latitude, 340)
    with pytest.raises(HTTPException) as e:
        ensure_at_site(SITE, lat, SITE.longitude, 25.0)
    assert e.value.status_code == 403
    assert "Yard A" in e.value.detail
    assert e.value.detail.endswith("Attendance can only be marked at the site.")
    metres = int(e.value.detail.split(" ")[2])
    assert 330 < metres < 350


def test_ensure_at_site_rejects_zero_zero_fix():
    # A failed GPS fix sometimes reports 0,0. It must not pass as "at the site".
    with pytest.raises(HTTPException) as e:
        ensure_at_site(SITE, 0.0, 0.0, 25.0)
    assert e.value.status_code == 403


def test_ensure_at_site_accepts_inside():
    r = ensure_at_site(SITE, SITE.latitude, SITE.longitude, 25.0)
    assert r.inside is True


# ── next_action ──────────────────────────────────────────────────────────────

def test_next_action_clock_in_when_no_record():
    assert next_action(None) == "clock_in"


def test_next_action_clock_out_when_open():
    assert next_action(SimpleNamespace(entry_time=time(9, 0), exit_time=None)) == "clock_out"


def test_next_action_done_when_closed():
    assert next_action(SimpleNamespace(entry_time=time(9, 0), exit_time=time(17, 0))) == "done"


# ── stamp_site ───────────────────────────────────────────────────────────────

def test_stamp_site_fills_missing_only():
    # Clocked in through the existing flow (no site), scanned out by the supervisor.
    rec = SimpleNamespace(site_location_id=None, marked_by=None)
    stamp_site(rec, 5, 42)
    assert (rec.site_location_id, rec.marked_by) == (5, 42)


def test_stamp_site_keeps_original_stamp():
    rec = SimpleNamespace(site_location_id=3, marked_by=7)
    stamp_site(rec, 5, 42)
    assert (rec.site_location_id, rec.marked_by) == (3, 7)


# ── worker_label ─────────────────────────────────────────────────────────────

def test_worker_label_prefers_name_then_display_name_then_username():
    assert worker_label(SimpleNamespace(name="Ravi K", display_name="RK", username="ravi")) == "Ravi K"
    assert worker_label(SimpleNamespace(name=None, display_name="RK", username="ravi")) == "RK"
    assert worker_label(SimpleNamespace(name="", display_name=None, username="ravi")) == "ravi"


def test_not_enabled_detail_text():
    assert NOT_ENABLED_DETAIL == "Physical attendance is not enabled for your account. Contact your admin."
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_physical_attendance.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'services.physical_attendance_service'`.

- [ ] **Step 3: Write the implementation**

`backend/services/physical_attendance_service.py`:

```python
"""Physical attendance: a nominated supervisor marks workers' attendance by
face scan from the attendance-only app, at their one assigned site.

The pure helpers at the top carry the rules and are unit-tested without a
database. The DB-backed functions below them are what the router calls.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException

from services.geofence_service import haversine_m

NOT_ENABLED_DETAIL = "Physical attendance is not enabled for your account. Contact your admin."
SITE_UNAVAILABLE_DETAIL = "Your assigned site is no longer available. Contact your admin."


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


def stamp_site(record, site_id: int, supervisor_id: int) -> None:
    """Tag a record with the site it was marked at, unless it already has one."""
    if record.site_location_id is None:
        record.site_location_id = site_id
        record.marked_by = supervisor_id


def worker_label(user) -> str:
    return user.name or user.display_name or user.username
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ../.venv/bin/python -m pytest tests -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/services/physical_attendance_service.py backend/tests/test_physical_attendance.py
git commit -m "feat(backend): physical attendance rules"
```

---

### Task 3: API

**Files:**
- Create: `backend/schemas/physical_attendance.py`
- Modify: `backend/services/physical_attendance_service.py` (append DB functions)
- Modify: `backend/auth/dependencies.py` (add guard after `require_any`)
- Create: `backend/routers/physical_attendance.py`
- Modify: `backend/main.py` (import + mount)
- Modify: `backend/schemas/user.py` (`UserResponse`, `TokenResponse`)
- Modify: `backend/routers/auth.py` (`login` return)
- Test: `backend/tests/test_physical_attendance_api.py`

**Interfaces:**
- Consumes: everything Task 2 produces; `auth.dependencies.tenant_scope`, `assert_tenant`, `require_admin`, `get_current_user`; `services.attendance_service.calculate_hours_worked(entry, exit, shift)`; `services.face_service.identify_employee(b64_image, employees)`.
- Produces:
  - `auth.dependencies.require_physical_attendance`
  - Service: `supervisor_row(user, site_name) -> dict`, `list_supervisors(db, admin) -> list[dict]`, `set_site(db, admin, supervisor_id, location_id) -> dict`, `get_site(db, supervisor) -> WorkLocation`, `scan(db, supervisor, image, latitude, longitude) -> dict`, `today_list(db, supervisor) -> dict`
  - HTTP (JSON field names are what the web page and the Android app rely on):
    - `GET /api/physical-attendance/supervisors` → `[{id, username, display_name, name, is_active, company_id, must_change_password, site_id, site_name}]`
    - `PUT /api/physical-attendance/supervisors/{user_id}` body `{location_id: int|null}` → one row as above
    - `GET /api/physical-attendance/me` → `{id, location_name, latitude, longitude, allowed_radius_m}`
    - `POST /api/physical-attendance/scan` body `{image, latitude, longitude}` → 201 `{employee_id, employee_name, employee_code, action, time}`
    - `GET /api/physical-attendance/today` → `{site_name, date, present_count, entries: [{employee_id, name, employee_code, entry_time, exit_time}]}`
  - Login response and `/api/auth/me` gain `physical_attendance_site_id: int|null`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_physical_attendance_api.py`:

```python
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError


def test_guard_allows_enabled_supervisor():
    from auth.dependencies import require_physical_attendance
    u = SimpleNamespace(role="supervisor", is_active=True, physical_attendance_site_id=5)
    assert require_physical_attendance(current_user=u) is u


@pytest.mark.parametrize("u", [
    SimpleNamespace(role="supervisor", is_active=True, physical_attendance_site_id=None),
    SimpleNamespace(role="supervisor", is_active=False, physical_attendance_site_id=5),
    SimpleNamespace(role="admin", is_active=True, physical_attendance_site_id=5),
    SimpleNamespace(role="worker", is_active=True, physical_attendance_site_id=5),
])
def test_guard_rejects_disabled(u):
    from auth.dependencies import require_physical_attendance
    with pytest.raises(HTTPException) as e:
        require_physical_attendance(current_user=u)
    assert e.value.status_code == 403
    assert e.value.detail == "Physical attendance is not enabled for your account. Contact your admin."


def test_router_exposes_exactly_the_planned_routes():
    from routers.physical_attendance import router
    found = {(m, r.path) for r in router.routes for m in r.methods}
    assert found == {
        ("GET", "/supervisors"),
        ("PUT", "/supervisors/{user_id}"),
        ("GET", "/me"),
        ("POST", "/scan"),
        ("GET", "/today"),
    }


def test_assign_request_requires_location_id_key_but_allows_null():
    from schemas.physical_attendance import SiteAssignRequest
    assert SiteAssignRequest(location_id=None).location_id is None
    assert SiteAssignRequest(location_id=3).location_id == 3
    with pytest.raises(ValidationError):
        SiteAssignRequest()


@pytest.mark.parametrize("lat,lon", [(91.0, 10.0), (-91.0, 10.0), (10.0, 181.0), (10.0, -181.0)])
def test_scan_request_rejects_impossible_coordinates(lat, lon):
    from schemas.physical_attendance import ScanRequest
    with pytest.raises(ValidationError):
        ScanRequest(image="x", latitude=lat, longitude=lon)


def test_scan_request_allows_missing_coordinates_so_service_can_explain():
    from schemas.physical_attendance import ScanRequest
    r = ScanRequest(image="x")
    assert r.latitude is None and r.longitude is None


def test_supervisor_row_shape():
    from services.physical_attendance_service import supervisor_row
    u = SimpleNamespace(id=9, username="sup1", display_name="Sup One", name=None, is_active=True,
                        company_id=2, must_change_password=True, physical_attendance_site_id=5)
    assert supervisor_row(u, "Yard A") == {
        "id": 9, "username": "sup1", "display_name": "Sup One", "name": None,
        "is_active": True, "company_id": 2, "must_change_password": True,
        "site_id": 5, "site_name": "Yard A",
    }


def test_token_and_user_responses_carry_site_id():
    from schemas.user import TokenResponse, UserResponse
    assert "physical_attendance_site_id" in TokenResponse.model_fields
    assert "physical_attendance_site_id" in UserResponse.model_fields
    t = TokenResponse(access_token="a", role="supervisor", username="s")
    assert t.physical_attendance_site_id is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_physical_attendance_api.py -q`
Expected: FAIL (`ImportError` for `require_physical_attendance`, missing modules).

- [ ] **Step 3: Schemas**

`backend/schemas/physical_attendance.py`:

```python
from datetime import date, time
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SupervisorSiteResponse(BaseModel):
    id:           int
    username:     str
    display_name: Optional[str] = None
    name:         Optional[str] = None
    is_active:    bool = True
    company_id:   Optional[int] = None
    must_change_password: bool = False
    site_id:      Optional[int] = None
    site_name:    Optional[str] = None


class SiteAssignRequest(BaseModel):
    # Required key; null clears the assignment (disables physical attendance).
    location_id: Optional[int]


class MySiteResponse(BaseModel):
    id:               int
    location_name:    str
    latitude:         float
    longitude:        float
    allowed_radius_m: float

    model_config = {"from_attributes": True}


class ScanRequest(BaseModel):
    image:     str  # base64-encoded image
    latitude:  Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class ScanResponse(BaseModel):
    employee_id:   int
    employee_name: str
    employee_code: Optional[str] = None
    action:        Literal["clock_in", "clock_out"]
    time:          time


class TodayEntry(BaseModel):
    employee_id:   int
    name:          str
    employee_code: Optional[str] = None
    entry_time:    time
    exit_time:     Optional[time] = None


class TodayResponse(BaseModel):
    site_name:     str
    date:          date
    present_count: int
    entries:       list[TodayEntry]
```

- [ ] **Step 4: Guard**

In `backend/auth/dependencies.py`, after `require_any`:

```python
def require_physical_attendance(current_user: User = Depends(get_current_user)) -> User:
    """Supervisors the admin has enabled for physical attendance (a site is assigned)."""
    # Lazy import to avoid a model/service import cycle (mirrors require_valid_license).
    from services.physical_attendance_service import NOT_ENABLED_DETAIL, is_enabled
    if not is_enabled(current_user):
        raise HTTPException(status_code=403, detail=NOT_ENABLED_DETAIL)
    return current_user
```

- [ ] **Step 5: DB-backed service functions**

In `backend/services/physical_attendance_service.py`, extend the imports at the top to:

```python
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
```

and append at the end of the file:

```python
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
        .filter(Attendance.date == today, Attendance.site_location_id == site.id)
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
```

- [ ] **Step 6: Router**

`backend/routers/physical_attendance.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import require_admin, require_physical_attendance
from database import get_db
from models.user import User
from schemas.physical_attendance import (
    MySiteResponse, ScanRequest, ScanResponse, SiteAssignRequest,
    SupervisorSiteResponse, TodayResponse,
)
from services import physical_attendance_service as service

router = APIRouter()


# ── Admin: who may mark physical attendance, and where ───────────────────────

@router.get("/supervisors", response_model=list[SupervisorSiteResponse])
def list_supervisors(db: Session = Depends(get_db), current: User = Depends(require_admin)):
    return service.list_supervisors(db, current)


@router.put("/supervisors/{user_id}", response_model=SupervisorSiteResponse)
def assign_site(
    user_id: int,
    payload: SiteAssignRequest,
    db:      Session = Depends(get_db),
    current: User    = Depends(require_admin),
):
    return service.set_site(db, current, user_id, payload.location_id)


# ── Supervisor: attendance-only app ──────────────────────────────────────────

@router.get("/me", response_model=MySiteResponse)
def my_site(db: Session = Depends(get_db), current: User = Depends(require_physical_attendance)):
    return service.get_site(db, current)


@router.post("/scan", response_model=ScanResponse, status_code=201)
def scan(
    payload: ScanRequest,
    db:      Session = Depends(get_db),
    current: User    = Depends(require_physical_attendance),
):
    return service.scan(db, current, payload.image, payload.latitude, payload.longitude)


@router.get("/today", response_model=TodayResponse)
def today(db: Session = Depends(get_db), current: User = Depends(require_physical_attendance)):
    return service.today_list(db, current)
```

- [ ] **Step 7: Mount it**

In `backend/main.py` change the third `from routers import` line to:

```python
from routers import payslip_templates, licenses, geofence, subscriptions, invoices, physical_attendance
```

and after the `geofence.router` mount add:

```python
app.include_router(physical_attendance.router, prefix="/api/physical-attendance", tags=["Physical Attendance"], dependencies=_licensed)
```

- [ ] **Step 8: Expose the site id at login**

In `backend/schemas/user.py`:
- in `UserResponse`, after `is_active`, add `physical_attendance_site_id: Optional[int] = None`
- in `TokenResponse`, after `must_change_password`, add `physical_attendance_site_id: Optional[int] = None`

In `backend/routers/auth.py`, in `login`, add to the `TokenResponse(...)` call after `must_change_password=...`:

```python
        physical_attendance_site_id=user.physical_attendance_site_id,
```

- [ ] **Step 9: Run to verify it passes**

Run: `cd backend && ../.venv/bin/python -m pytest tests -q`
Expected: all pass.

- [ ] **Step 10: Exercise the endpoints against a real database (when Docker is available)**

Run: `docker info >/dev/null 2>&1 && echo docker-ok || echo no-docker`

If `docker-ok`: `docker-compose up --build -d`, wait for `curl -s localhost:8088/docs` to answer, then with the seeded `admin` / `admin123`:

```bash
TOKEN=$(curl -s localhost:8088/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123","client":"web"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s localhost:8088/api/physical-attendance/supervisors -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w '%{http_code}\n' localhost:8088/api/physical-attendance/me -H "Authorization: Bearer $TOKEN"
```

Expected: a JSON list (possibly empty) from the first call; `403` from the second (admin is not an enabled supervisor). Then `docker-compose down`.

If `no-docker`: skip, and state in the final report that the endpoints were not exercised against a database.

- [ ] **Step 11: Commit**

```bash
git add backend/schemas/physical_attendance.py backend/services/physical_attendance_service.py backend/auth/dependencies.py backend/routers/physical_attendance.py backend/main.py backend/schemas/user.py backend/routers/auth.py backend/tests/test_physical_attendance_api.py
git commit -m "feat(backend): physical attendance API"
```

---

### Task 4: Admin web page

**Files:**
- Create: `frontend/src/api/physicalAttendanceApi.ts`
- Create: `frontend/src/pages/attendance/PhysicalAttendance.tsx`
- Modify: `frontend/src/App.tsx` (import + route after the `work-locations` route)
- Modify: `frontend/src/components/Sidebar.tsx` (WORKFORCE items)

**Interfaces:**
- Consumes: the two admin endpoints from Task 3; `getAllLocations({ active_only: true })` from `api/locationApi`; `createUser` from `api/authApi`; `AlertMessage`; `useAuth` (find its import path with `grep -n "useAuth" frontend/src/App.tsx`).

- [ ] **Step 1: API module**

`frontend/src/api/physicalAttendanceApi.ts`:

```ts
import api from "./axiosConfig";
import type { AxiosResponse } from "axios";

export interface AttendanceSupervisor {
  id: number;
  username: string;
  display_name: string | null;
  name: string | null;
  is_active: boolean;
  company_id: number | null;
  must_change_password: boolean;
  site_id: number | null;
  site_name: string | null;
}

export const getAttendanceSupervisors = (): Promise<AxiosResponse<AttendanceSupervisor[]>> =>
  api.get("/api/physical-attendance/supervisors");

// locationId = null disables physical attendance for the supervisor.
export const setSupervisorSite = (userId: number, locationId: number | null): Promise<AxiosResponse<AttendanceSupervisor>> =>
  api.put(`/api/physical-attendance/supervisors/${userId}`, { location_id: locationId });
```

- [ ] **Step 2: Page**

`frontend/src/pages/attendance/PhysicalAttendance.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getAttendanceSupervisors, setSupervisorSite } from "../../api/physicalAttendanceApi";
import type { AttendanceSupervisor } from "../../api/physicalAttendanceApi";
import { getAllLocations } from "../../api/locationApi";
import type { WorkLocation } from "../../api/locationApi";
import { createUser } from "../../api/authApi";
import AlertMessage from "../../components/AlertMessage";
import { useAuth } from "../../context/AuthContext";

type Dialog =
  | { mode: "assign"; supervisor: AttendanceSupervisor }
  | { mode: "disable"; supervisor: AttendanceSupervisor }
  | { mode: "add" }
  | null;

const EMPTY_FORM = { display_name: "", username: "", password: "" };

function label(s: AttendanceSupervisor): string {
  return s.name || s.display_name || s.username;
}

export default function PhysicalAttendance() {
  const { auth } = useAuth();
  const [supervisors, setSupervisors] = useState<AttendanceSupervisor[]>([]);
  const [locations, setLocations]     = useState<WorkLocation[]>([]);
  const [alert, setAlert]             = useState<{ type: string; message: string } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [dialog, setDialog]           = useState<Dialog>(null);
  const [siteId, setSiteId]           = useState("");
  const [form, setForm]               = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sup, loc] = await Promise.all([
        getAttendanceSupervisors(),
        getAllLocations({ active_only: true }),
      ]);
      setSupervisors(sup.data);
      setLocations(loc.data);
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function open(next: Dialog) {
    setSiteId(next && next.mode === "assign" && next.supervisor.site_id ? String(next.supervisor.site_id) : "");
    setForm(EMPTY_FORM);
    setDialog(next);
  }

  async function saveSite(e: FormEvent) {
    e.preventDefault();
    if (!dialog || dialog.mode !== "assign" || !siteId) return;
    setSaving(true);
    try {
      await setSupervisorSite(dialog.supervisor.id, Number(siteId));
      setAlert({ type: "success", message: `Physical attendance enabled for ${label(dialog.supervisor)}.` });
      setDialog(null);
      await load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function disable() {
    if (!dialog || dialog.mode !== "disable") return;
    setSaving(true);
    try {
      await setSupervisorSite(dialog.supervisor.id, null);
      setAlert({ type: "success", message: `Physical attendance disabled for ${label(dialog.supervisor)}.` });
      setDialog(null);
      await load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function addSupervisor(e: FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    setSaving(true);
    try {
      const { data: created } = await createUser({
        username: form.username.trim(),
        password: form.password,
        role: "supervisor",
        display_name: form.display_name.trim() || undefined,
      });
      try {
        await setSupervisorSite(created.id, Number(siteId));
        setAlert({
          type: "success",
          message: `Supervisor ${created.username} added. They must sign in once on this web portal to set their own password before using the attendance app.`,
        });
      } catch (err: any) {
        // The account exists; only the site assignment failed. Say so, so the
        // admin retries with "Enable" instead of creating a duplicate account.
        setAlert({
          type: "warning",
          message: `Supervisor ${created.username} was created, but the site could not be assigned: ${err.message} Use Enable on their row to try again.`,
        });
      }
      setDialog(null);
      await load();
    } catch (err: any) {
      setAlert({ type: "danger", message: err.message });
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = supervisors.filter(s => s.site_id !== null).length;
  const siteSelect = (
    <div className="mb-3">
      <label className="form-label" htmlFor="paSite">Site</label>
      <select id="paSite" className="form-select" required value={siteId} onChange={e => setSiteId(e.target.value)}>
        <option value="">Select a site…</option>
        {locations.map(l => (
          <option key={l.id} value={l.id}>
            {l.location_name}{l.city ? ` — ${l.city}` : ""} ({l.allowed_radius_m} m)
          </option>
        ))}
      </select>
      <div className="form-text">Attendance can be marked only while the supervisor's phone is inside this site's radius.</div>
    </div>
  );

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Physical Attendance</h4>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          {/* Master has no company of its own, so new accounts are created from Users. */}
          {auth?.role === "admin" && (
            <button className="btn btn-primary btn-sm" onClick={() => open({ mode: "add" })}>Add supervisor</button>
          )}
        </div>
      </div>
      <AlertMessage alert={alert} onClose={() => setAlert(null)} />

      <p className="text-muted small">
        For sites where workers do not carry smartphones. An enabled supervisor uses the ERP Attendance
        app to photograph each worker; the worker is recognised by face and clocked in or out. Each
        supervisor covers one site, and scans are accepted only at that site. Workers must have a face
        registered on their employee record. {enabledCount} of {supervisors.length} supervisors enabled.
      </p>

      {locations.length === 0 && !loading && (
        <div className="alert alert-warning py-2">
          There are no active work locations. Add one under Work Locations before enabling a supervisor.
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Supervisor</th>
                <th>Username</th>
                <th>Site</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {supervisors.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted py-4">
                  {loading ? "Loading…" : "No supervisors yet."}
                </td></tr>
              )}
              {supervisors.map(s => (
                <tr key={s.id}>
                  <td>
                    {label(s)}
                    {!s.is_active && <span className="badge bg-secondary ms-2">Inactive account</span>}
                    {s.must_change_password && (
                      <div className="small text-muted">Has not yet set a password on the web portal</div>
                    )}
                  </td>
                  <td>{s.username}</td>
                  <td>{s.site_name ?? "—"}</td>
                  <td>
                    {s.site_id !== null
                      ? <span className="badge bg-success">Enabled</span>
                      : <span className="badge bg-secondary">Disabled</span>}
                  </td>
                  <td className="text-end">
                    <button className="btn btn-outline-primary btn-sm me-2" onClick={() => open({ mode: "assign", supervisor: s })}>
                      {s.site_id !== null ? "Change site" : "Enable"}
                    </button>
                    {s.site_id !== null && (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => open({ mode: "disable", supervisor: s })}>
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                {dialog.mode === "assign" && (
                  <form onSubmit={saveSite}>
                    <div className="modal-header">
                      <h5 className="modal-title">
                        {dialog.supervisor.site_id !== null ? "Change site" : "Enable physical attendance"}
                      </h5>
                      <button type="button" className="btn-close" onClick={() => setDialog(null)} />
                    </div>
                    <div className="modal-body">
                      <p className="mb-3">Supervisor: <strong>{label(dialog.supervisor)}</strong></p>
                      {siteSelect}
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={saving || !siteId}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </form>
                )}

                {dialog.mode === "disable" && (
                  <>
                    <div className="modal-header">
                      <h5 className="modal-title">Disable physical attendance</h5>
                      <button type="button" className="btn-close" onClick={() => setDialog(null)} />
                    </div>
                    <div className="modal-body">
                      {label(dialog.supervisor)} will no longer be able to mark attendance at{" "}
                      {dialog.supervisor.site_name ?? "their site"} from the attendance app. Attendance
                      already recorded is kept.
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
                      <button type="button" className="btn btn-danger" onClick={disable} disabled={saving}>
                        {saving ? "Disabling…" : "Disable"}
                      </button>
                    </div>
                  </>
                )}

                {dialog.mode === "add" && (
                  <form onSubmit={addSupervisor}>
                    <div className="modal-header">
                      <h5 className="modal-title">Add supervisor</h5>
                      <button type="button" className="btn-close" onClick={() => setDialog(null)} />
                    </div>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label" htmlFor="paName">Name</label>
                        <input id="paName" className="form-control" required maxLength={255}
                          value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="paUsername">Username</label>
                        <input id="paUsername" className="form-control" required maxLength={50} autoComplete="off"
                          value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="paPassword">Temporary password</label>
                        <input id="paPassword" type="password" className="form-control" required minLength={8}
                          autoComplete="new-password"
                          value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                        <div className="form-text">
                          At least 8 characters. The supervisor sets their own password at first sign-in on this web portal.
                        </div>
                      </div>
                      {siteSelect}
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setDialog(null)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={saving || !siteId}>
                        {saving ? "Adding…" : "Add supervisor"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Route**

In `frontend/src/App.tsx` add the import next to the other attendance pages:

```tsx
import PhysicalAttendance from "./pages/attendance/PhysicalAttendance";
```

and directly after the `work-locations` route:

```tsx
        <Route path="workforce/physical-attendance" element={
          <RequireAuth roles={["master","admin"]}><PhysicalAttendance /></RequireAuth>
        } />
```

- [ ] **Step 4: Sidebar**

In `frontend/src/components/Sidebar.tsx`, add to the `WORKFORCE` items after Work Locations:

```tsx
      { to: "/workforce/physical-attendance", label: "Physical Attendance", icon: "attendance", roles: ["master","admin"] },
```

- [ ] **Step 5: Type-check and build**

Run: `cd frontend && npx tsc --noEmit -p . && CI=false npm run build`
Expected: no TypeScript errors; "Compiled successfully" (warnings that exist on `master` are acceptable; no new ones from the new files). If `useAuth` is not exported from `context/AuthContext`, use the path found by the grep in the Interfaces note.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/physicalAttendanceApi.ts frontend/src/pages/attendance/PhysicalAttendance.tsx frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat(frontend): Physical Attendance admin page under Workforce"
```

---

### Task 5: Android module and data layer

**Files:**
- Modify: `mobile/settings.gradle.kts`
- Create: `mobile/attendance/build.gradle.kts`
- Create: `mobile/attendance/src/main/AndroidManifest.xml`
- Create (copied): `mobile/attendance/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`, `ic_launcher_round.xml`, `mobile/attendance/src/main/res/drawable/ic_launcher_background.xml`, `ic_launcher_foreground.xml`
- Create: `mobile/attendance/src/main/res/values/{strings,colors,themes}.xml`
- Create under `mobile/attendance/src/main/java/com/econetvision/erp/attendance/`: `AttendanceApp.kt`, `data/Models.kt`, `data/ApiService.kt`, `data/AuthInterceptor.kt`, `data/RetrofitClient.kt`, `data/SessionManager.kt`, `data/ApiError.kt`, `data/AccessPolicy.kt`, `data/AttendanceRepository.kt`
- Test: `mobile/attendance/src/test/java/com/econetvision/erp/attendance/data/ApiErrorTest.kt`, `AccessPolicyTest.kt`

**Interfaces:**
- Consumes: HTTP shapes from Task 3.
- Produces (package `com.econetvision.erp.attendance.data`):
  - `TokenResponse(accessToken, role, username, displayName, physicalAttendanceSiteId)`, `Site(id, locationName, latitude, longitude, allowedRadiusM)`, `ScanRequest(image, latitude, longitude)`, `ScanResponse(employeeId, employeeName, employeeCode, action, time)`, `TodayEntry(employeeId, name, employeeCode, entryTime, exitTime)`, `TodayResponse(siteName, date, presentCount, entries)`
  - `ApiError.parse(body: String?, fallback: String): String`
  - `AccessPolicy.canUse(role: String?, siteId: Int?): Boolean`
  - `ApiException(code: Int, message: String)`; `code == 0` means no response from the server
  - `AttendanceRepository` with `suspend fun login(username, password): Result<TokenResponse>`, `mySite(): Result<Site>`, `scan(image, latitude, longitude): Result<ScanResponse>`, `today(): Result<TodayResponse>`
  - `SessionManager(context)` with `save(token)`, `getToken()`, `getDisplayName()`, `isLoggedIn()`, `clear()`
  - String resources used by Task 6: `app_name`, `not_enabled`, `face_scan_title`, `face_scan_position_hint`, `face_scan_cancel`, `face_scan_switch_camera`

**Note:** this machine has no Android SDK, so Kotlin is compiled only in CI (Task 7). Write carefully; the first CI run is the compile check.

- [ ] **Step 1: Register the module**

`mobile/settings.gradle.kts`, last line becomes:

```kotlin
include(":app")
include(":attendance")
```

- [ ] **Step 2: Build file**

`mobile/attendance/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ERP Attendance: attendance-only app for supervisors enabled for physical
// attendance. Installs alongside the main ERP app (separate application id).
android {
    namespace = "com.econetvision.erp.attendance"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.econetvision.erp.attendance"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        // Production backend on Railway (same as the main app).
        buildConfigField("String", "API_BASE_URL", "\"https://erpprojectamm-production-595f.up.railway.app/\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")

    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")

    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")

    implementation("com.google.android.gms:play-services-location:21.1.0")

    // CameraX preview + ML Kit blink liveness, as in the main app's face scan.
    implementation("androidx.camera:camera-core:1.3.1")
    implementation("androidx.camera:camera-camera2:1.3.1")
    implementation("androidx.camera:camera-lifecycle:1.3.1")
    implementation("androidx.camera:camera-view:1.3.1")
    implementation("com.google.android.gms:play-services-mlkit-face-detection:17.1.0")

    testImplementation("junit:junit:4.13.2")
}
```

- [ ] **Step 3: Manifest**

`mobile/attendance/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />

    <application
        android:name=".AttendanceApp"
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.ErpAttendance">

        <activity
            android:name=".ui.LoginActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <activity android:name=".ui.HomeActivity" />
        <activity
            android:name=".ui.FaceCaptureActivity"
            android:exported="false"
            android:screenOrientation="portrait" />

        <!-- Ask Play services to download the ML Kit face model at install time so
             the first scan doesn't have to wait for it. -->
        <meta-data
            android:name="com.google.mlkit.vision.DEPENDENCIES"
            android:value="face" />
    </application>
</manifest>
```

- [ ] **Step 4: Resources**

Copy the launcher icon (files are copied, the originals are untouched):

```bash
cd mobile
mkdir -p attendance/src/main/res/mipmap-anydpi-v26 attendance/src/main/res/drawable attendance/src/main/res/values attendance/src/main/res/layout
cp app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml attendance/src/main/res/mipmap-anydpi-v26/
cp app/src/main/res/drawable/ic_launcher_background.xml app/src/main/res/drawable/ic_launcher_foreground.xml attendance/src/main/res/drawable/
grep -ho '@[a-z]*/[a-z_]*' attendance/src/main/res/mipmap-anydpi-v26/*.xml attendance/src/main/res/drawable/*.xml | sort -u
```

Expected from the grep: only `@drawable/ic_launcher_background`, `@drawable/ic_launcher_foreground` and/or `@color/…` names. Any `@color/` name printed must exist in `colors.xml` below; add it with the value from `app/src/main/res/values/colors.xml` if it is not listed.

`mobile/attendance/src/main/res/values/colors.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="primary">#0d6efd</color>
    <color name="primary_dark">#0a1628</color>
    <color name="accent">#4ea8e8</color>
    <color name="white">#FFFFFF</color>
    <color name="black">#000000</color>
    <color name="success">#198754</color>
    <color name="danger">#dc3545</color>
</resources>
```

`mobile/attendance/src/main/res/values/themes.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.ErpAttendance" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="colorPrimary">@color/primary</item>
        <item name="colorPrimaryDark">@color/primary_dark</item>
        <item name="colorAccent">@color/accent</item>
    </style>
</resources>
```

`mobile/attendance/src/main/res/values/strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">ERP Attendance</string>

    <string name="login_title">ERP Attendance</string>
    <string name="login_subtitle">Sign in to mark attendance at your site</string>
    <string name="login_username">Username</string>
    <string name="login_password">Password</string>
    <string name="login_button">Sign in</string>
    <string name="login_missing_fields">Enter your username and password.</string>
    <string name="not_enabled">Physical attendance is not enabled for your account. Contact your admin.</string>

    <string name="home_logout">Sign out</string>
    <string name="home_scan">Scan worker</string>
    <string name="home_on_site_today">On site today</string>
    <string name="home_present_count">%1$d present</string>
    <string name="home_empty">No one has been marked at this site today.</string>
    <string name="home_in">In %1$s</string>
    <string name="home_out">Out %1$s</string>
    <string name="home_out_pending">Not clocked out</string>
    <string name="home_marking">Marking attendance…</string>

    <string name="scan_clocked_in_title">Clocked in</string>
    <string name="scan_clocked_out_title">Clocked out</string>
    <string name="scan_result">%1$s at %2$s</string>
    <string name="scan_failed_title">Not marked</string>
    <string name="scan_ok">OK</string>
    <string name="permission_needed_title">Permissions needed</string>
    <string name="permission_needed_body">Camera and location access are required. Attendance can be marked only at your site, so the app must check where the phone is.</string>
    <string name="location_unavailable">Could not get your location. Turn on GPS, wait a few seconds and try again.</string>
    <string name="capture_failed">The photo could not be read. Please scan again.</string>
    <string name="session_expired">Your session has expired. Please sign in again.</string>

    <string name="face_scan_title">Scan worker</string>
    <string name="face_scan_position_hint">Position the worker\'s face inside the oval</string>
    <string name="face_scan_cancel">Cancel</string>
    <string name="face_scan_switch_camera">Switch camera</string>
</resources>
```

- [ ] **Step 5: Write the failing unit tests**

`mobile/attendance/src/test/java/com/econetvision/erp/attendance/data/ApiErrorTest.kt`:

```kotlin
package com.econetvision.erp.attendance.data

import org.junit.Assert.assertEquals
import org.junit.Test

class ApiErrorTest {

    @Test
    fun `string detail is returned as is`() {
        val body = """{"detail":"You are 340 m from Yard A. Attendance can only be marked at the site."}"""
        assertEquals(
            "You are 340 m from Yard A. Attendance can only be marked at the site.",
            ApiError.parse(body, "fallback"),
        )
    }

    @Test
    fun `first browser login message reaches the user`() {
        val body = """{"detail":"First login must be done from a browser. Please sign in on the web portal, set your password, then log in here."}"""
        assertEquals(
            "First login must be done from a browser. Please sign in on the web portal, set your password, then log in here.",
            ApiError.parse(body, "fallback"),
        )
    }

    @Test
    fun `validation error list is joined`() {
        val body = """{"detail":[{"loc":["body","latitude"],"msg":"Input should be less than or equal to 90"},{"msg":"Field required"}]}"""
        assertEquals("Input should be less than or equal to 90, Field required", ApiError.parse(body, "fallback"))
    }

    @Test
    fun `html gateway error falls back`() {
        assertEquals("fallback", ApiError.parse("<html><body>502 Bad Gateway</body></html>", "fallback"))
    }

    @Test
    fun `null empty and detail-less bodies fall back`() {
        assertEquals("fallback", ApiError.parse(null, "fallback"))
        assertEquals("fallback", ApiError.parse("", "fallback"))
        assertEquals("fallback", ApiError.parse("{}", "fallback"))
        assertEquals("fallback", ApiError.parse("""{"detail":null}""", "fallback"))
        assertEquals("fallback", ApiError.parse("""{"detail":[]}""", "fallback"))
    }
}
```

`mobile/attendance/src/test/java/com/econetvision/erp/attendance/data/AccessPolicyTest.kt`:

```kotlin
package com.econetvision.erp.attendance.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AccessPolicyTest {

    @Test
    fun `supervisor with a site may use the app`() {
        assertTrue(AccessPolicy.canUse("supervisor", 5))
    }

    @Test
    fun `supervisor without a site may not`() {
        assertFalse(AccessPolicy.canUse("supervisor", null))
    }

    @Test
    fun `other roles may not even with a site`() {
        assertFalse(AccessPolicy.canUse("admin", 5))
        assertFalse(AccessPolicy.canUse("worker", 5))
        assertFalse(AccessPolicy.canUse("master", 5))
        assertFalse(AccessPolicy.canUse(null, 5))
    }
}
```

- [ ] **Step 6: Data layer**

`data/Models.kt`:

```kotlin
package com.econetvision.erp.attendance.data

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val username: String,
    val password: String,
    // Lets the backend enforce the first-login-from-browser rule for supervisors.
    val client: String = "android",
)

data class TokenResponse(
    @SerializedName("access_token") val accessToken: String,
    val role: String,
    val username: String,
    @SerializedName("display_name") val displayName: String?,
    @SerializedName("physical_attendance_site_id") val physicalAttendanceSiteId: Int?,
)

data class Site(
    val id: Int,
    @SerializedName("location_name") val locationName: String,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("allowed_radius_m") val allowedRadiusM: Double,
)

data class ScanRequest(
    val image: String,
    val latitude: Double?,
    val longitude: Double?,
)

data class ScanResponse(
    @SerializedName("employee_id") val employeeId: Int,
    @SerializedName("employee_name") val employeeName: String,
    @SerializedName("employee_code") val employeeCode: String?,
    val action: String, // "clock_in" or "clock_out"
    val time: String,   // "HH:MM:SS"
)

data class TodayEntry(
    @SerializedName("employee_id") val employeeId: Int,
    val name: String,
    @SerializedName("employee_code") val employeeCode: String?,
    @SerializedName("entry_time") val entryTime: String,
    @SerializedName("exit_time") val exitTime: String?,
)

data class TodayResponse(
    @SerializedName("site_name") val siteName: String,
    val date: String,
    @SerializedName("present_count") val presentCount: Int,
    val entries: List<TodayEntry>,
)
```

`data/ApiService.kt`:

```kotlin
package com.econetvision.erp.attendance.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface ApiService {
    @POST("/api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<TokenResponse>

    @GET("/api/physical-attendance/me")
    suspend fun mySite(): Response<Site>

    @POST("/api/physical-attendance/scan")
    suspend fun scan(@Body request: ScanRequest): Response<ScanResponse>

    @GET("/api/physical-attendance/today")
    suspend fun today(): Response<TodayResponse>
}
```

`data/AuthInterceptor.kt`:

```kotlin
package com.econetvision.erp.attendance.data

import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
        tokenProvider()?.let { token ->
            request.addHeader("Authorization", "Bearer $token")
        }
        return chain.proceed(request.build())
    }
}
```

`data/RetrofitClient.kt`:

```kotlin
package com.econetvision.erp.attendance.data

import com.econetvision.erp.attendance.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private var authInterceptor: AuthInterceptor? = null

    fun init(interceptor: AuthInterceptor) {
        authInterceptor = interceptor
    }

    val instance: ApiService by lazy {
        // BODY logging writes the bearer token, passwords and the base64 face
        // images into logcat. Keep full bodies for debug builds only.
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor ?: AuthInterceptor { null })
            .addInterceptor(logging)
            .connectTimeout(20, TimeUnit.SECONDS)
            // A scan uploads a base64 JPEG and the backend then runs face
            // recognition on it; short timeouts fail on mobile data.
            .writeTimeout(45, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .build()

        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
```

`data/SessionManager.kt`:

```kotlin
package com.econetvision.erp.attendance.data

import android.content.Context
import android.content.SharedPreferences

class SessionManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("erp_attendance_session", Context.MODE_PRIVATE)

    fun save(token: TokenResponse) {
        prefs.edit().apply {
            putString("access_token", token.accessToken)
            putString("username", token.username)
            putString("display_name", token.displayName)
            apply()
        }
    }

    fun getToken(): String? = prefs.getString("access_token", null)
    fun getDisplayName(): String? =
        prefs.getString("display_name", null) ?: prefs.getString("username", null)

    fun isLoggedIn(): Boolean = getToken() != null

    fun clear() {
        prefs.edit().clear().apply()
    }
}
```

`data/ApiError.kt`:

```kotlin
package com.econetvision.erp.attendance.data

import com.google.gson.JsonParser

/** Turns a FastAPI error body into the message to show the supervisor. */
object ApiError {
    fun parse(body: String?, fallback: String): String {
        if (body.isNullOrBlank()) return fallback
        return try {
            val detail = JsonParser.parseString(body).asJsonObject.get("detail")
            when {
                detail == null || detail.isJsonNull -> fallback
                detail.isJsonPrimitive -> detail.asString.ifBlank { fallback }
                // Request validation errors arrive as a list of {loc, msg, type}.
                detail.isJsonArray -> detail.asJsonArray
                    .mapNotNull { it.asJsonObject.get("msg")?.asString }
                    .joinToString(", ")
                    .ifBlank { fallback }
                else -> fallback
            }
        } catch (e: Exception) {
            // Not JSON (e.g. an HTML page from a gateway).
            fallback
        }
    }
}
```

`data/AccessPolicy.kt`:

```kotlin
package com.econetvision.erp.attendance.data

/**
 * Who may use this app. The backend enforces the same rule on every request
 * (`require_physical_attendance`); this check only gives a clear message at login.
 */
object AccessPolicy {
    fun canUse(role: String?, siteId: Int?): Boolean = role == "supervisor" && siteId != null
}
```

`data/AttendanceRepository.kt`:

```kotlin
package com.econetvision.erp.attendance.data

import kotlinx.coroutines.CancellationException
import retrofit2.Response
import java.io.IOException

/** [code] is the HTTP status, or 0 when no response was received. */
class ApiException(val code: Int, message: String) : Exception(message)

class AttendanceRepository(private val api: ApiService = RetrofitClient.instance) {

    suspend fun login(username: String, password: String): Result<TokenResponse> =
        call("Sign in failed. Please try again.") { api.login(LoginRequest(username, password)) }

    suspend fun mySite(): Result<Site> =
        call("Could not load your site.") { api.mySite() }

    suspend fun scan(image: String, latitude: Double, longitude: Double): Result<ScanResponse> =
        call("Attendance could not be marked. Please try again.") {
            api.scan(ScanRequest(image, latitude, longitude))
        }

    suspend fun today(): Result<TodayResponse> =
        call("Could not load today's list.") { api.today() }

    private suspend fun <T> call(fallback: String, block: suspend () -> Response<T>): Result<T> =
        try {
            val response = block()
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                Result.failure(ApiException(response.code(), ApiError.parse(response.errorBody()?.string(), fallback)))
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: IOException) {
            Result.failure(ApiException(0, "Cannot reach the server. Check your internet connection and try again."))
        } catch (e: Exception) {
            Result.failure(ApiException(0, fallback))
        }
}
```

`AttendanceApp.kt`:

```kotlin
package com.econetvision.erp.attendance

import android.app.Application
import com.econetvision.erp.attendance.data.AuthInterceptor
import com.econetvision.erp.attendance.data.RetrofitClient
import com.econetvision.erp.attendance.data.SessionManager

class AttendanceApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val session = SessionManager(this)
        RetrofitClient.init(AuthInterceptor { session.getToken() })
    }
}
```

- [ ] **Step 7: Confirm build outputs are ignored**

Run: `git check-ignore -q mobile/attendance/build && echo ignored || echo NOT-ignored`
If `NOT-ignored`, create `mobile/attendance/.gitignore` containing the single line `/build`.

- [ ] **Step 8: Commit**

The manifest names activities that Task 6 creates, so the module does not build until then; the unit tests are run in Task 7's CI.

```bash
git add mobile/settings.gradle.kts mobile/attendance
git commit -m "feat(mobile): ERP Attendance module scaffold and data layer"
```

---

### Task 6: Android screens

**Files (under `mobile/attendance/src/main/`):**
- Create: `res/layout/activity_login.xml`, `activity_home.xml`, `item_today.xml`, `activity_face_capture.xml`
- Create: `java/com/econetvision/erp/attendance/ui/LoginActivity.kt`, `HomeViewModel.kt`, `HomeActivity.kt`, `TodayAdapter.kt`, `FaceOverlayView.kt`, `FaceCaptureActivity.kt`

**Interfaces:**
- Consumes: everything Task 5 produces.
- Produces: `FaceCaptureActivity.EXTRA_IMAGE_PATH`; the three activities named in the manifest.

- [ ] **Step 1: Layouts**

`res/layout/activity_login.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fillViewport="true">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center_horizontal"
        android:orientation="vertical"
        android:padding="24dp">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="48dp"
            android:text="@string/login_title"
            android:textAppearance="?attr/textAppearanceHeadlineMedium" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:layout_marginBottom="32dp"
            android:gravity="center"
            android:text="@string/login_subtitle"
            android:textAppearance="?attr/textAppearanceBodyMedium" />

        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:hint="@string/login_username">

            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etUsername"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:imeOptions="actionNext"
                android:inputType="textNoSuggestions"
                android:maxLines="1" />
        </com.google.android.material.textfield.TextInputLayout>

        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:hint="@string/login_password"
            app:endIconMode="password_toggle">

            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etPassword"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:imeOptions="actionDone"
                android:inputType="textPassword"
                android:maxLines="1" />
        </com.google.android.material.textfield.TextInputLayout>

        <TextView
            android:id="@+id/tvError"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:textColor="@color/danger"
            android:textAppearance="?attr/textAppearanceBodyMedium"
            android:visibility="gone" />

        <com.google.android.material.button.MaterialButton
            android:id="@+id/btnLogin"
            android:layout_width="match_parent"
            android:layout_height="56dp"
            android:layout_marginTop="24dp"
            android:text="@string/login_button" />

        <ProgressBar
            android:id="@+id/progress"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:visibility="gone" />
    </LinearLayout>
</ScrollView>
```

`res/layout/activity_home.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:fitsSystemWindows="true"
    android:orientation="vertical">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center_vertical"
        android:orientation="horizontal"
        android:paddingStart="16dp"
        android:paddingTop="12dp"
        android:paddingEnd="8dp"
        android:paddingBottom="4dp">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical">

            <TextView
                android:id="@+id/tvSite"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textAppearance="?attr/textAppearanceTitleLarge" />

            <TextView
                android:id="@+id/tvSubtitle"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:textAppearance="?attr/textAppearanceBodyMedium" />
        </LinearLayout>

        <com.google.android.material.button.MaterialButton
            android:id="@+id/btnLogout"
            style="@style/Widget.Material3.Button.TextButton"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="@string/home_logout" />
    </LinearLayout>

    <com.google.android.material.button.MaterialButton
        android:id="@+id/btnScan"
        android:layout_width="match_parent"
        android:layout_height="72dp"
        android:layout_marginStart="16dp"
        android:layout_marginTop="12dp"
        android:layout_marginEnd="16dp"
        android:text="@string/home_scan"
        android:textSize="18sp" />

    <LinearLayout
        android:id="@+id/busyRow"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center"
        android:orientation="horizontal"
        android:padding="8dp"
        android:visibility="gone">

        <ProgressBar
            style="?android:attr/progressBarStyleSmall"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginStart="8dp"
            android:text="@string/home_marking" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:paddingStart="16dp"
        android:paddingTop="16dp"
        android:paddingEnd="16dp"
        android:paddingBottom="8dp">

        <TextView
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="@string/home_on_site_today"
            android:textAppearance="?attr/textAppearanceTitleMedium" />

        <TextView
            android:id="@+id/tvCount"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textAppearance="?attr/textAppearanceTitleMedium" />
    </LinearLayout>

    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        android:id="@+id/swipe"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1">

        <FrameLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent">

            <androidx.recyclerview.widget.RecyclerView
                android:id="@+id/rvToday"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:clipToPadding="false"
                android:paddingBottom="16dp" />

            <TextView
                android:id="@+id/tvEmpty"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="48dp"
                android:gravity="center"
                android:padding="24dp"
                android:text="@string/home_empty"
                android:visibility="gone" />
        </FrameLayout>
    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>
</LinearLayout>
```

`res/layout/item_today.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:gravity="center_vertical"
    android:orientation="horizontal"
    android:paddingStart="16dp"
    android:paddingTop="12dp"
    android:paddingEnd="16dp"
    android:paddingBottom="12dp">

    <LinearLayout
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_weight="1"
        android:orientation="vertical">

        <TextView
            android:id="@+id/tvName"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textAppearance="?attr/textAppearanceBodyLarge" />

        <TextView
            android:id="@+id/tvCode"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textAppearance="?attr/textAppearanceBodySmall" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:gravity="end"
        android:orientation="vertical">

        <TextView
            android:id="@+id/tvIn"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textAppearance="?attr/textAppearanceBodyMedium" />

        <TextView
            android:id="@+id/tvOut"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textAppearance="?attr/textAppearanceBodySmall" />
    </LinearLayout>
</LinearLayout>
```

`res/layout/activity_face_capture.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/black">

    <androidx.camera.view.PreviewView
        android:id="@+id/previewView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

    <com.econetvision.erp.attendance.ui.FaceOverlayView
        android:id="@+id/faceOverlay"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

    <TextView
        android:id="@+id/tvTitle"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_gravity="top"
        android:layout_marginTop="32dp"
        android:gravity="center"
        android:text="@string/face_scan_title"
        android:textColor="@color/white"
        android:textSize="20sp"
        android:textStyle="bold" />

    <TextView
        android:id="@+id/tvInstruction"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="bottom|center_horizontal"
        android:layout_marginBottom="120dp"
        android:background="#B3000000"
        android:paddingStart="20dp"
        android:paddingTop="10dp"
        android:paddingEnd="20dp"
        android:paddingBottom="10dp"
        android:text="@string/face_scan_position_hint"
        android:textColor="@color/white"
        android:textSize="16sp" />

    <LinearLayout
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="bottom|center_horizontal"
        android:layout_marginBottom="40dp"
        android:orientation="horizontal">

        <com.google.android.material.button.MaterialButton
            android:id="@+id/btnCancel"
            style="@style/Widget.Material3.Button.TextButton"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="@string/face_scan_cancel"
            android:textColor="@color/white"
            app:rippleColor="@color/accent" />

        <com.google.android.material.button.MaterialButton
            android:id="@+id/btnSwitchCamera"
            style="@style/Widget.Material3.Button.TextButton"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginStart="24dp"
            android:text="@string/face_scan_switch_camera"
            android:textColor="@color/white"
            app:rippleColor="@color/accent" />
    </LinearLayout>
</FrameLayout>
```

- [ ] **Step 2: Capture screen (copied from `:app`, trimmed and adapted)**

`ui/FaceOverlayView.kt`: copy `mobile/app/src/main/java/com/econetvision/erp/ui/attendance/FaceOverlayView.kt` and change only its first line to `package com.econetvision.erp.attendance.ui`:

```bash
cd mobile
mkdir -p attendance/src/main/java/com/econetvision/erp/attendance/ui
sed '1s/.*/package com.econetvision.erp.attendance.ui/' \
  app/src/main/java/com/econetvision/erp/ui/attendance/FaceOverlayView.kt \
  > attendance/src/main/java/com/econetvision/erp/attendance/ui/FaceOverlayView.kt
head -1 attendance/src/main/java/com/econetvision/erp/attendance/ui/FaceOverlayView.kt
```

Expected: `package com.econetvision.erp.attendance.ui`.

`ui/FaceCaptureActivity.kt` (differences from the original: package and binding import, rear camera by default with a switch button, worker-facing prompts):

```kotlin
package com.econetvision.erp.attendance.ui

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Size
import android.view.WindowManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.econetvision.erp.attendance.databinding.ActivityFaceCaptureBinding
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Live face scan of a worker with a blink liveness check.
 *
 * Opens on the rear camera (the supervisor points the phone at the worker) and
 * runs ML Kit face detection on the analysis stream. The worker must be seen
 * with eyes open, then closed, then open again (a real blink) before a frame is
 * captured, so a printed photo cannot pass. The captured frame is saved as a
 * JPEG and its path is returned in [EXTRA_IMAGE_PATH].
 */
class FaceCaptureActivity : AppCompatActivity() {

    private lateinit var binding: ActivityFaceCaptureBinding
    private lateinit var analysisExecutor: ExecutorService
    private var detector: FaceDetector? = null
    private val captured = AtomicBoolean(false)
    private var useFrontCamera = false

    // Blink state machine: eyes open -> eyes closed -> eyes open again.
    private var sawEyesOpen = false
    private var sawEyesClosed = false
    private var noFaceFrames = 0

    private val timeoutHandler = Handler(Looper.getMainLooper())
    private val timeoutRunnable = Runnable {
        if (!captured.get()) {
            Toast.makeText(
                this,
                "Could not verify a blink. Try again with the face inside the oval and good lighting.",
                Toast.LENGTH_LONG,
            ).show()
            setResult(RESULT_CANCELED)
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityFaceCaptureBinding.inflate(layoutInflater)
        setContentView(binding.root)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        binding.btnCancel.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Toast.makeText(this, "Camera permission is required", Toast.LENGTH_LONG).show()
            setResult(RESULT_CANCELED)
            finish()
            return
        }

        analysisExecutor = Executors.newSingleThreadExecutor()
        detector = FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
                .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
                .setMinFaceSize(MIN_FACE_SIZE)
                .build()
        )

        binding.btnSwitchCamera.setOnClickListener {
            if (captured.get()) return@setOnClickListener
            useFrontCamera = !useFrontCamera
            resetBlinkState()
            noFaceFrames = 0
            setStatus(POSITION_HINT, GUIDE_NEUTRAL)
            startCamera()
        }

        setStatus(POSITION_HINT, GUIDE_NEUTRAL)
        startCamera()
        timeoutHandler.postDelayed(timeoutRunnable, TIMEOUT_MS)
    }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.previewView.surfaceProvider)
            }

            val analysis = ImageAnalysis.Builder()
                .setResolutionSelector(
                    ResolutionSelector.Builder()
                        .setResolutionStrategy(
                            ResolutionStrategy(
                                Size(640, 480),
                                ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                            )
                        )
                        .build()
                )
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { it.setAnalyzer(analysisExecutor) { proxy -> analyzeFrame(proxy) } }

            val wanted = if (useFrontCamera) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
            val other = if (useFrontCamera) CameraSelector.DEFAULT_BACK_CAMERA else CameraSelector.DEFAULT_FRONT_CAMERA
            try {
                provider.unbindAll()
                try {
                    provider.bindToLifecycle(this, wanted, preview, analysis)
                } catch (e: Exception) {
                    // Devices with a single camera fall back to the one they have.
                    provider.bindToLifecycle(this, other, preview, analysis)
                }
            } catch (e: Exception) {
                Toast.makeText(this, "Could not start camera: ${e.message}", Toast.LENGTH_LONG).show()
                setResult(RESULT_CANCELED)
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
    private fun analyzeFrame(imageProxy: ImageProxy) {
        if (captured.get()) {
            imageProxy.close()
            return
        }
        val mediaImage = imageProxy.image
        val faceDetector = detector
        if (mediaImage == null || faceDetector == null) {
            imageProxy.close()
            return
        }
        val input = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        faceDetector.process(input)
            .addOnSuccessListener { faces -> onFacesDetected(faces, imageProxy) }
            .addOnCompleteListener { imageProxy.close() }
    }

    /**
     * Runs on the main thread (ML Kit's default callback executor). The
     * [imageProxy] is still open here; it is closed by the analyzer's
     * onComplete listener after this returns, so the winning frame must be
     * converted to a bitmap synchronously.
     */
    private fun onFacesDetected(faces: List<Face>, imageProxy: ImageProxy) {
        if (captured.get() || isFinishing) return

        when {
            faces.isEmpty() -> {
                // A few empty frames are normal (e.g. mid-blink on some devices);
                // only reset after a sustained loss of the face.
                if (++noFaceFrames > NO_FACE_RESET_FRAMES) {
                    resetBlinkState()
                    setStatus(POSITION_HINT, GUIDE_NEUTRAL)
                }
            }
            faces.size > 1 -> {
                resetBlinkState()
                setStatus("Only one face should be visible", GUIDE_NEUTRAL)
            }
            else -> {
                noFaceFrames = 0
                val face = faces[0]
                val left = face.leftEyeOpenProbability
                val right = face.rightEyeOpenProbability
                if (left == null || right == null) return

                val bothOpen = left >= EYE_OPEN_THRESHOLD && right >= EYE_OPEN_THRESHOLD
                val bothClosed = left <= EYE_CLOSED_THRESHOLD && right <= EYE_CLOSED_THRESHOLD

                when {
                    !sawEyesOpen -> {
                        if (bothOpen) {
                            sawEyesOpen = true
                            setStatus("Ask the worker to blink", GUIDE_PROMPT)
                        } else {
                            setStatus("The worker should look at the camera with eyes open", GUIDE_NEUTRAL)
                        }
                    }
                    !sawEyesClosed -> {
                        if (bothClosed) sawEyesClosed = true
                    }
                    bothOpen -> {
                        // Full open -> closed -> open cycle observed: liveness verified.
                        if (captured.compareAndSet(false, true)) {
                            setStatus("Blink verified ✓ Capturing…", GUIDE_SUCCESS)
                            captureFrame(imageProxy)
                        }
                    }
                }
            }
        }
    }

    private fun resetBlinkState() {
        sawEyesOpen = false
        sawEyesClosed = false
    }

    private fun setStatus(text: String, guideColor: Int) {
        binding.tvInstruction.text = text
        binding.faceOverlay.setGuideColor(guideColor)
    }

    private fun captureFrame(imageProxy: ImageProxy) {
        try {
            var bitmap = imageProxy.toBitmap()

            val rotation = imageProxy.imageInfo.rotationDegrees
            if (rotation != 0) {
                val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
                bitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            }

            if (bitmap.width > TARGET_WIDTH) {
                val ratio = TARGET_WIDTH.toFloat() / bitmap.width
                bitmap = Bitmap.createScaledBitmap(
                    bitmap, TARGET_WIDTH, (bitmap.height * ratio).toInt(), true
                )
            }

            val dir = File(cacheDir, "face_captures").apply { mkdirs() }
            val file = File(dir, "face_${System.currentTimeMillis()}.jpg")
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
            }

            timeoutHandler.removeCallbacks(timeoutRunnable)
            setResult(RESULT_OK, intent.putExtra(EXTRA_IMAGE_PATH, file.absolutePath))
            finish()
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to capture image: ${e.message}", Toast.LENGTH_LONG).show()
            setResult(RESULT_CANCELED)
            finish()
        }
    }

    override fun onDestroy() {
        timeoutHandler.removeCallbacks(timeoutRunnable)
        detector?.close()
        if (::analysisExecutor.isInitialized) analysisExecutor.shutdown()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_IMAGE_PATH = "extra_image_path"

        private const val POSITION_HINT = "Position the worker's face inside the oval"

        // ML Kit eye-open probability thresholds for the blink state machine.
        private const val EYE_OPEN_THRESHOLD = 0.65f
        private const val EYE_CLOSED_THRESHOLD = 0.25f
        private const val MIN_FACE_SIZE = 0.2f
        private const val NO_FACE_RESET_FRAMES = 5
        private const val TIMEOUT_MS = 45_000L
        private const val TARGET_WIDTH = 640

        private const val GUIDE_NEUTRAL = 0xFFFFFFFF.toInt()
        private const val GUIDE_PROMPT = 0xFF4EA8E8.toInt() // accent
        private const val GUIDE_SUCCESS = 0xFF198754.toInt() // success
    }
}
```

- [ ] **Step 3: Login screen**

`ui/LoginActivity.kt`:

```kotlin
package com.econetvision.erp.attendance.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.econetvision.erp.attendance.R
import com.econetvision.erp.attendance.data.AccessPolicy
import com.econetvision.erp.attendance.data.AttendanceRepository
import com.econetvision.erp.attendance.data.SessionManager
import com.econetvision.erp.attendance.databinding.ActivityLoginBinding
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var session: SessionManager
    private val repository = AttendanceRepository()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        session = SessionManager(this)
        if (session.isLoggedIn()) {
            goHome()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // HomeActivity passes the reason when it ends the session (disabled, expired).
        intent.getStringExtra(EXTRA_MESSAGE)?.let { showError(it) }

        binding.btnLogin.setOnClickListener { submit() }
        binding.etPassword.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                submit()
                true
            } else {
                false
            }
        }
    }

    private fun submit() {
        val username = binding.etUsername.text?.toString()?.trim().orEmpty()
        val password = binding.etPassword.text?.toString().orEmpty()
        if (username.isEmpty() || password.isEmpty()) {
            showError(getString(R.string.login_missing_fields))
            return
        }

        setLoading(true)
        lifecycleScope.launch {
            val result = repository.login(username, password)
            setLoading(false)
            result.fold(
                onSuccess = { token ->
                    if (AccessPolicy.canUse(token.role, token.physicalAttendanceSiteId)) {
                        session.save(token)
                        goHome()
                    } else {
                        showError(getString(R.string.not_enabled))
                    }
                },
                onFailure = { showError(it.message ?: getString(R.string.login_missing_fields)) },
            )
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.progress.visibility = if (loading) View.VISIBLE else View.GONE
        binding.btnLogin.isEnabled = !loading
        if (loading) binding.tvError.visibility = View.GONE
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }

    private fun goHome() {
        startActivity(Intent(this, HomeActivity::class.java))
        finish()
    }

    companion object {
        const val EXTRA_MESSAGE = "extra_message"
    }
}
```

- [ ] **Step 4: Home view model**

`ui/HomeViewModel.kt`:

```kotlin
package com.econetvision.erp.attendance.ui

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.attendance.data.ApiException
import com.econetvision.erp.attendance.data.AttendanceRepository
import com.econetvision.erp.attendance.data.ScanResponse
import com.econetvision.erp.attendance.data.Site
import com.econetvision.erp.attendance.data.TodayResponse
import kotlinx.coroutines.launch

/** Outcome of one scan, shown once in a dialog. */
sealed class ScanOutcome {
    data class Marked(val response: ScanResponse) : ScanOutcome()
    data class Failed(val message: String) : ScanOutcome()
}

class HomeViewModel : ViewModel() {

    private val repository = AttendanceRepository()

    private val _site = MutableLiveData<Site?>()
    val site: LiveData<Site?> = _site

    private val _today = MutableLiveData<TodayResponse?>()
    val today: LiveData<TodayResponse?> = _today

    private val _refreshing = MutableLiveData(false)
    val refreshing: LiveData<Boolean> = _refreshing

    private val _scanning = MutableLiveData(false)
    val scanning: LiveData<Boolean> = _scanning

    // One-shot values: the activity shows them and then calls the matching consume*().
    private val _scanOutcome = MutableLiveData<ScanOutcome?>()
    val scanOutcome: LiveData<ScanOutcome?> = _scanOutcome

    private val _notice = MutableLiveData<String?>()
    val notice: LiveData<String?> = _notice

    // Non-null when the session must end (signed out, disabled by the admin).
    private val _sessionEnded = MutableLiveData<String?>()
    val sessionEnded: LiveData<String?> = _sessionEnded

    fun refresh() {
        if (_refreshing.value == true) return
        _refreshing.value = true
        viewModelScope.launch {
            val siteResult = repository.mySite()
            val siteError = siteResult.exceptionOrNull()
            if (siteError != null) {
                // 401: token no longer valid. 403 here comes only from the access
                // guard: the admin disabled physical attendance for this account.
                if (siteError is ApiException && (siteError.code == 401 || siteError.code == 403)) {
                    _sessionEnded.value = siteError.message
                } else {
                    _notice.value = siteError.message
                }
                _refreshing.value = false
                return@launch
            }
            _site.value = siteResult.getOrNull()

            repository.today().fold(
                onSuccess = { _today.value = it },
                onFailure = { _notice.value = it.message },
            )
            _refreshing.value = false
        }
    }

    fun submitScan(imageBase64: String, latitude: Double, longitude: Double) {
        if (_scanning.value == true) return
        _scanning.value = true
        viewModelScope.launch {
            repository.scan(imageBase64, latitude, longitude).fold(
                onSuccess = { _scanOutcome.value = ScanOutcome.Marked(it) },
                onFailure = { error ->
                    if (error is ApiException && error.code == 401) {
                        _sessionEnded.value = error.message
                    } else {
                        // Includes 403 "You are N m from <site>…": shown, session kept.
                        _scanOutcome.value = ScanOutcome.Failed(error.message ?: "")
                    }
                },
            )
            _scanning.value = false
            refresh()
        }
    }

    fun setScanning(value: Boolean) {
        _scanning.value = value
    }

    fun consumeScanOutcome() {
        _scanOutcome.value = null
    }

    fun consumeNotice() {
        _notice.value = null
    }
}
```

- [ ] **Step 5: Today list adapter**

`ui/TodayAdapter.kt`:

```kotlin
package com.econetvision.erp.attendance.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.econetvision.erp.attendance.R
import com.econetvision.erp.attendance.data.TodayEntry
import com.econetvision.erp.attendance.databinding.ItemTodayBinding

class TodayAdapter : ListAdapter<TodayEntry, TodayAdapter.Holder>(Diff) {

    class Holder(val binding: ItemTodayBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(ItemTodayBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val entry = getItem(position)
        val context = holder.binding.root.context
        holder.binding.tvName.text = entry.name
        holder.binding.tvCode.text = entry.employeeCode.orEmpty()
        holder.binding.tvIn.text = context.getString(R.string.home_in, shortTime(entry.entryTime))
        holder.binding.tvOut.text = entry.exitTime
            ?.let { context.getString(R.string.home_out, shortTime(it)) }
            ?: context.getString(R.string.home_out_pending)
    }

    private object Diff : DiffUtil.ItemCallback<TodayEntry>() {
        override fun areItemsTheSame(oldItem: TodayEntry, newItem: TodayEntry) =
            oldItem.employeeId == newItem.employeeId

        override fun areContentsTheSame(oldItem: TodayEntry, newItem: TodayEntry) = oldItem == newItem
    }

    companion object {
        /** The backend sends "HH:MM:SS"; the list shows "HH:MM". */
        fun shortTime(value: String): String = value.take(5)
    }
}
```

- [ ] **Step 6: Home screen**

`ui/HomeActivity.kt`:

```kotlin
package com.econetvision.erp.attendance.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.util.Base64
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.econetvision.erp.attendance.R
import com.econetvision.erp.attendance.data.SessionManager
import com.econetvision.erp.attendance.databinding.ActivityHomeBinding
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import java.io.File

class HomeActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHomeBinding
    private lateinit var session: SessionManager
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private val viewModel: HomeViewModel by viewModels()
    private val adapter = TodayAdapter()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        if (hasCameraPermission() && hasLocationPermission()) {
            launchCapture()
        } else {
            showDialog(getString(R.string.permission_needed_title), getString(R.string.permission_needed_body))
        }
    }

    private val captureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != RESULT_OK) return@registerForActivityResult
        val path = result.data?.getStringExtra(FaceCaptureActivity.EXTRA_IMAGE_PATH)
        val image = path?.let { readAndDelete(it) }
        if (image == null) {
            showDialog(getString(R.string.scan_failed_title), getString(R.string.capture_failed))
            return@registerForActivityResult
        }
        submitWithLocation(image)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        session = SessionManager(this)
        if (!session.isLoggedIn()) {
            endSession(null)
            return
        }

        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        binding.tvSubtitle.text = session.getDisplayName().orEmpty()
        binding.rvToday.layoutManager = LinearLayoutManager(this)
        binding.rvToday.adapter = adapter

        binding.btnScan.setOnClickListener { startScan() }
        binding.btnLogout.setOnClickListener { endSession(null) }
        binding.swipe.setOnRefreshListener { viewModel.refresh() }

        viewModel.site.observe(this) { site ->
            binding.tvSite.text = site?.locationName.orEmpty()
        }
        viewModel.today.observe(this) { today ->
            val entries = today?.entries.orEmpty()
            adapter.submitList(entries)
            binding.tvCount.text = getString(R.string.home_present_count, today?.presentCount ?: 0)
            binding.tvEmpty.visibility = if (today != null && entries.isEmpty()) View.VISIBLE else View.GONE
        }
        viewModel.refreshing.observe(this) { binding.swipe.isRefreshing = it == true }
        viewModel.scanning.observe(this) { scanning ->
            binding.busyRow.visibility = if (scanning == true) View.VISIBLE else View.GONE
            binding.btnScan.isEnabled = scanning != true
        }
        viewModel.scanOutcome.observe(this) { outcome ->
            when (outcome) {
                is ScanOutcome.Marked -> {
                    val title = if (outcome.response.action == "clock_in") {
                        getString(R.string.scan_clocked_in_title)
                    } else {
                        getString(R.string.scan_clocked_out_title)
                    }
                    val body = getString(
                        R.string.scan_result,
                        outcome.response.employeeName,
                        TodayAdapter.shortTime(outcome.response.time),
                    )
                    showDialog(title, body)
                    viewModel.consumeScanOutcome()
                }
                is ScanOutcome.Failed -> {
                    showDialog(getString(R.string.scan_failed_title), outcome.message)
                    viewModel.consumeScanOutcome()
                }
                null -> Unit
            }
        }
        viewModel.notice.observe(this) { notice ->
            if (notice != null) {
                showDialog(getString(R.string.app_name), notice)
                viewModel.consumeNotice()
            }
        }
        viewModel.sessionEnded.observe(this) { reason ->
            if (reason != null) endSession(reason)
        }
    }

    override fun onResume() {
        super.onResume()
        if (session.isLoggedIn()) viewModel.refresh()
    }

    private fun startScan() {
        if (hasCameraPermission() && hasLocationPermission()) {
            launchCapture()
        } else {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                )
            )
        }
    }

    private fun launchCapture() {
        captureLauncher.launch(Intent(this, FaceCaptureActivity::class.java))
    }

    /** The server accepts a scan only at the site, so a fresh GPS fix is required. */
    @SuppressLint("MissingPermission")
    private fun submitWithLocation(imageBase64: String) {
        if (!hasLocationPermission()) {
            showDialog(getString(R.string.permission_needed_title), getString(R.string.permission_needed_body))
            return
        }
        viewModel.setScanning(true)
        val cts = CancellationTokenSource()
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
            .addOnSuccessListener { location: Location? ->
                viewModel.setScanning(false)
                if (location == null) {
                    showDialog(getString(R.string.scan_failed_title), getString(R.string.location_unavailable))
                } else {
                    viewModel.submitScan(imageBase64, location.latitude, location.longitude)
                }
            }
            .addOnFailureListener {
                viewModel.setScanning(false)
                showDialog(getString(R.string.scan_failed_title), getString(R.string.location_unavailable))
            }
    }

    /** Reads the captured JPEG as base64 and removes it; a worker's photo is not kept on the phone. */
    private fun readAndDelete(path: String): String? {
        val file = File(path)
        return try {
            if (!file.exists()) null else Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
        } catch (e: Exception) {
            null
        } finally {
            file.delete()
        }
    }

    private fun hasCameraPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    private fun showDialog(title: String, body: String) {
        if (isFinishing) return
        MaterialAlertDialogBuilder(this)
            .setTitle(title)
            .setMessage(body)
            .setPositiveButton(R.string.scan_ok, null)
            .show()
    }

    private fun endSession(reason: String?) {
        session.clear()
        val intent = Intent(this, LoginActivity::class.java)
        if (reason != null) intent.putExtra(LoginActivity.EXTRA_MESSAGE, reason)
        startActivity(intent)
        finish()
    }
}
```

- [ ] **Step 7: Check that the existing app is untouched**

Run: `git status --porcelain mobile/app && git diff --stat master -- mobile/app`
Expected: no output from either command.

- [ ] **Step 8: Commit**

```bash
git add mobile/attendance
git commit -m "feat(mobile): ERP Attendance login, scan and on-site list screens"
```

---

### Task 7: CI, docs, PR and APK

**Files:**
- Create: `.github/workflows/build-attendance-apk.yml`
- Modify: `AGENTS.md`
- Modify: `mobile/README.md`

- [ ] **Step 1: Workflow**

`.github/workflows/build-attendance-apk.yml`:

```yaml
name: Build Attendance APK

# ERP Attendance: the attendance-only app for supervisors enabled for physical
# attendance. Builds a debug-signed, directly-installable APK and uploads it as
# a run artifact. It is not committed back to the repo.

on:
  pull_request:
    paths:
      - 'mobile/attendance/**'
      - 'mobile/settings.gradle.kts'
      - 'mobile/build.gradle.kts'
      - '.github/workflows/build-attendance-apk.yml'
  push:
    branches: [master, develop]
    paths:
      - 'mobile/attendance/**'
      - '.github/workflows/build-attendance-apk.yml'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: build-attendance-apk-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: 'gradle'

      - name: Set up Android SDK
        uses: android-actions/setup-android@v3

      - name: Configure local.properties
        working-directory: ./mobile
        run: |
          # Gradle uses ANDROID_SDK_ROOT/ANDROID_HOME on the runner. The Maps key
          # is only read by :app; this build does not need a real one.
          echo "MAPS_API_KEY=" > local.properties

      - name: Grant execute permission for gradlew
        working-directory: ./mobile
        run: chmod +x gradlew

      - name: Unit tests
        working-directory: ./mobile
        run: ./gradlew :attendance:testDebugUnitTest --no-daemon

      - name: Build Attendance debug APK
        working-directory: ./mobile
        run: ./gradlew :attendance:assembleDebug --no-daemon

      # Adding a module must not break the existing app's build.
      - name: Build main app (regression check)
        working-directory: ./mobile
        run: ./gradlew :app:assembleDebug --no-daemon

      - name: Rename APK
        working-directory: ./mobile
        run: |
          SHORT_SHA=$(echo "${{ github.event.pull_request.head.sha || github.sha }}" | cut -c1-7)
          mv attendance/build/outputs/apk/debug/attendance-debug.apk \
             "attendance/build/outputs/apk/debug/erp-attendance-${SHORT_SHA}.apk"
          ls -la attendance/build/outputs/apk/debug/

      - name: Upload Attendance APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: erp-attendance-apk
          path: mobile/attendance/build/outputs/apk/debug/erp-attendance-*.apk
          retention-days: 30

      - name: Build Summary
        run: |
          echo "### ERP Attendance APK built" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Type:** debug (installable, debug-signed)" >> $GITHUB_STEP_SUMMARY
          echo "**Artifact:** \`erp-attendance-apk\` (download from this run's Artifacts section)" >> $GITHUB_STEP_SUMMARY
```

- [ ] **Step 2: Docs**

In `AGENTS.md`, under "Architecture — Key Facts", add after the **Face recognition** bullet:

```markdown
- **Physical attendance** (sites where workers have no smartphones): an admin gives a supervisor one work location (`users.physical_attendance_site_id`; NULL = not enabled) on the web page Workforce → Physical Attendance. That supervisor uses the separate attendance-only Android app (`mobile/attendance`, application id `com.econetvision.erp.attendance`) to face-scan workers. Endpoints live under `/api/physical-attendance` (`backend/routers/physical_attendance.py`, rules in `backend/services/physical_attendance_service.py`); supervisor endpoints are guarded by `require_physical_attendance` and a scan is accepted only when the supervisor's phone is inside the site's radius plus `geofence_buffer_m`. Records are ordinary `attendance` rows stamped with `site_location_id` and `marked_by`. The existing `/api/attendance/*` flows are independent of this.
```

In the Tech Stack list, change the **Mobile** bullet to end with:

```markdown
 — see [mobile/README.md](mobile/README.md). The same Gradle project also builds a second, attendance-only APK from the `:attendance` module.
```

In `mobile/README.md`, append:

```markdown
## ERP Attendance (attendance-only app)

`mobile/attendance` is a second application module (`com.econetvision.erp.attendance`) that installs
alongside the main app. It is for supervisors an admin has enabled under Workforce → Physical
Attendance on the web portal, at sites where workers do not carry smartphones.

- **Sign in**: supervisor username and password. A new supervisor must first sign in once on the web
  portal to set their own password.
- **Scan worker**: rear camera with a blink liveness check; the backend recognises the face and clocks
  the worker in (first scan of the day) or out (second scan). Accepted only at the supervisor's site.
- **On site today**: everyone marked at the site today, with in and out times.

Workers need a face registered on their employee record. The module shares no code with `:app`; the
camera, session and network classes are copies.

Build: `./gradlew :attendance:assembleDebug` (output in `attendance/build/outputs/apk/debug/`).
Unit tests: `./gradlew :attendance:testDebugUnitTest`. CI: `.github/workflows/build-attendance-apk.yml`.
```

- [ ] **Step 3: Full local verification**

```bash
cd backend && ../.venv/bin/python -m pytest tests -q
cd ../frontend && npx tsc --noEmit -p . && CI=false npm run build
cd .. && git status --porcelain mobile/app && git diff --stat master -- mobile/app .github/workflows/build-dev-apk.yml .github/workflows/build-mobile-apk.yml backend/routers/attendance.py
```

Expected: tests pass; build succeeds; the last two commands print nothing.

- [ ] **Step 4: Commit, push, open the PR**

```bash
git add .github/workflows/build-attendance-apk.yml AGENTS.md mobile/README.md
git commit -m "ci(mobile): build ERP Attendance APK; docs"
git push -u origin feature/physical-attendance-app
gh pr create --base master --title "Physical Attendance: supervisor attendance app + admin page" --body-file <path to a PR body written from the spec's Goal, Decisions and Testing sections, including the manual phone test checklist below>
```

PR body must include this manual checklist (not automatable here):

```markdown
## Manual test on a phone (before merge)
- [ ] Admin: Workforce → Physical Attendance → enable a supervisor with a site
- [ ] Supervisor signs in once on the web portal and sets a password
- [ ] App: sign in; site name shows in the header
- [ ] App: scan a worker with a registered face at the site → "Clocked in"
- [ ] App: scan the same worker again → "Clocked out"; third scan is refused
- [ ] App: scan away from the site → "You are N m from <site>…"
- [ ] App: scan a person with no registered face → "No matching employee found…"
- [ ] Admin disables the supervisor → app signs out on next refresh
- [ ] Main ERP app still installs and its face scan still works
```

- [ ] **Step 5: Get the APK from CI**

```bash
gh run watch $(gh run list --workflow build-attendance-apk.yml --branch feature/physical-attendance-app --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
```

If the run fails on a compile or test error: read it with `gh run view <id> --log-failed`, fix the cause in the module, commit, push, and watch the new run. Repeat until green. Do not weaken or delete a test to get green.

When green, download and report:

```bash
gh run download <id> --name erp-attendance-apk --dir <scratchpad>/apk
ls -la <scratchpad>/apk
```

Report to the user: the PR URL, the run URL (Artifacts section holds the APK), the local path of the downloaded APK, what was verified, and what was not (on-device camera/GPS behaviour; DB-backed endpoint check if Docker was unavailable).
