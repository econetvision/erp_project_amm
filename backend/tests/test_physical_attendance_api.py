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


def test_my_site_response_does_not_reveal_site_coordinates():
    # The server decides whether the phone is at the site. Handing the app the
    # site's coordinates would only help someone forge a position.
    from schemas.physical_attendance import MySiteResponse
    assert set(MySiteResponse.model_fields) == {"id", "location_name"}
