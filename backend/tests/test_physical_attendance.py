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


# ── clock_out_too_soon ───────────────────────────────────────────────────────

def test_clock_out_too_soon_inside_the_gap():
    from services.physical_attendance_service import clock_out_too_soon
    assert clock_out_too_soon(time(9, 0), time(9, 0), 5) is True
    assert clock_out_too_soon(time(9, 0), time(9, 4), 5) is True


def test_clock_out_allowed_from_the_gap_onwards():
    from services.physical_attendance_service import clock_out_too_soon
    assert clock_out_too_soon(time(9, 0), time(9, 5), 5) is False
    assert clock_out_too_soon(time(9, 0), time(17, 0), 5) is False


# ── drop_site_if_ineligible ──────────────────────────────────────────────────

def test_site_is_dropped_when_supervisor_is_demoted():
    from services.physical_attendance_service import drop_site_if_ineligible
    u = SimpleNamespace(role="worker", company_id=1, physical_attendance_site_id=5)
    drop_site_if_ineligible(u, previous_company_id=1)
    assert u.physical_attendance_site_id is None


def test_site_is_dropped_when_supervisor_moves_company():
    # The site belongs to the old company; keeping it would let the supervisor
    # read and mark attendance at another company's site.
    from services.physical_attendance_service import drop_site_if_ineligible
    u = SimpleNamespace(role="supervisor", company_id=2, physical_attendance_site_id=5)
    drop_site_if_ineligible(u, previous_company_id=1)
    assert u.physical_attendance_site_id is None


def test_site_is_kept_when_role_and_company_are_unchanged():
    from services.physical_attendance_service import drop_site_if_ineligible
    u = SimpleNamespace(role="supervisor", company_id=1, physical_attendance_site_id=5)
    drop_site_if_ineligible(u, previous_company_id=1)
    assert u.physical_attendance_site_id == 5
