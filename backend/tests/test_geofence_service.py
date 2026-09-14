from services.geofence_service import (
    LocationSpec, evaluate_position, should_open_exit,
)

# Test site: 50 m radius around a fixed point.
SITE = LocationSpec(id=1, name="Yard A", latitude=17.3850, longitude=78.4867, radius_m=50.0, supervisor_id=7)
SITE_B = LocationSpec(id=2, name="Depot B", latitude=17.4000, longitude=78.5000, radius_m=100.0, supervisor_id=None)

# ~0.0001 deg latitude ≈ 11.1 m
def offset_lat(base, metres):
    return base + metres / 111_000.0


def test_inside_when_within_radius():
    r = evaluate_position([SITE], SITE.latitude, SITE.longitude, buffer_m=25.0)
    assert r.inside is True
    assert r.nearest is SITE
    assert r.distance_m < 1.0
    assert r.effective_radius_m == 75.0


def test_inside_when_within_buffer():
    lat = offset_lat(SITE.latitude, 70)  # 70 m: outside 50 m radius, inside 75 m effective
    r = evaluate_position([SITE], lat, SITE.longitude, buffer_m=25.0)
    assert r.inside is True
    assert 65 < r.distance_m < 75


def test_outside_when_beyond_buffer():
    lat = offset_lat(SITE.latitude, 200)
    r = evaluate_position([SITE], lat, SITE.longitude, buffer_m=25.0)
    assert r.inside is False
    assert r.nearest is SITE
    assert 190 < r.distance_m < 210


def test_multi_location_inside_any_passes_and_reports_that_site():
    r = evaluate_position([SITE, SITE_B], SITE_B.latitude, SITE_B.longitude, buffer_m=25.0)
    assert r.inside is True
    assert r.nearest is SITE_B


def test_multi_location_outside_all_reports_nearest():
    lat = offset_lat(SITE.latitude, 300)
    r = evaluate_position([SITE, SITE_B], lat, SITE.longitude, buffer_m=25.0)
    assert r.inside is False
    assert r.nearest is SITE


def test_no_locations_counts_as_inside():
    r = evaluate_position([], 0.0, 0.0, buffer_m=25.0)
    assert r.inside is True
    assert r.nearest is None


def test_should_open_exit_requires_threshold_consecutive_outside():
    assert should_open_exit([False, False, False], 3) is True
    assert should_open_exit([True, False, False], 3) is False
    assert should_open_exit([False, False], 3) is False
    # Only the most recent `threshold` pings matter.
    assert should_open_exit([True, True, False, False, False], 3) is True
    assert should_open_exit([False, False, True, False, False], 3) is False


def test_should_open_exit_threshold_one_triggers_immediately():
    assert should_open_exit([False], 1) is True
    assert should_open_exit([True], 1) is False
