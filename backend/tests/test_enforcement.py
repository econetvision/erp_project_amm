from datetime import datetime, timedelta, timezone

from services.subscription_service import (
    ADMIN_LIMIT, EXPIRED, NO_LICENSE, NO_SUBSCRIPTION, SEAT_LIMIT, SUSPENDED,
    LicenseSpec, SubscriptionSpec, LicenseError, evaluate_state, is_capacity_error,
)

NOW = datetime(2026, 9, 12, tzinfo=timezone.utc)
ACTIVE = SubscriptionSpec(status="active", ends_at=None)
THREE = [LicenseSpec(id=i, status="active", max_users=26, max_admins=1) for i in range(3)]


def test_valid_active_subscription_with_licences():
    assert evaluate_state(ACTIVE, THREE, 10, 1, bypass=False, now=NOW) is None


def test_missing_subscription():
    assert evaluate_state(None, [], 0, 0, bypass=False, now=NOW).code == NO_SUBSCRIPTION


def test_suspended_and_cancelled_block_but_trial_allowed():
    assert evaluate_state(SubscriptionSpec("suspended", None), THREE, 0, 0, bypass=False, now=NOW).code == SUSPENDED
    assert evaluate_state(SubscriptionSpec("cancelled", None), THREE, 0, 0, bypass=False, now=NOW).code == SUSPENDED
    assert evaluate_state(SubscriptionSpec("trial", None), THREE, 0, 0, bypass=False, now=NOW) is None


def test_expired_subscription():
    sub = SubscriptionSpec("active", ends_at=NOW - timedelta(days=1))
    assert evaluate_state(sub, THREE, 0, 0, bypass=False, now=NOW).code == EXPIRED


def test_naive_ends_at_is_treated_as_utc():
    sub = SubscriptionSpec("active", ends_at=datetime(2026, 9, 11))
    assert evaluate_state(sub, THREE, 0, 0, bypass=False, now=NOW).code == EXPIRED


def test_zero_active_licences_blocks():
    revoked = [LicenseSpec(id=1, status="revoked", max_users=26, max_admins=1)]
    assert evaluate_state(ACTIVE, revoked, 0, 0, bypass=False, now=NOW).code == NO_LICENSE


def test_seat_limit_only_when_check_seats():
    assert evaluate_state(ACTIVE, THREE, 78, 1, bypass=False, now=NOW) is None          # login/per-request: ok
    d = evaluate_state(ACTIVE, THREE, 78, 1, bypass=False, check_seats=True, role="worker", now=NOW)
    assert d.code == SEAT_LIMIT
    assert d.message == "Seat limit exceeded (78/78)"


def test_admin_limit_while_seats_remain():
    d = evaluate_state(ACTIVE, THREE, 10, 3, bypass=False, check_seats=True, role="admin", now=NOW)
    assert d.code == ADMIN_LIMIT
    assert d.message == "Admin limit exceeded (3/3)"
    assert evaluate_state(ACTIVE, THREE, 10, 3, bypass=False, check_seats=True, role="worker", now=NOW) is None


def test_unlimited_licence_never_hits_seat_limit_but_admin_cap_still_applies():
    lics = [LicenseSpec(id=1, status="active", max_users=None, max_admins=1)]
    assert evaluate_state(ACTIVE, lics, 5000, 0, bypass=False, check_seats=True, role="worker", now=NOW) is None
    assert evaluate_state(ACTIVE, lics, 5000, 1, bypass=False, check_seats=True, role="admin", now=NOW).code == ADMIN_LIMIT


def test_bypass_skips_validity_but_still_enforces_caps():
    expired = SubscriptionSpec("suspended", ends_at=NOW - timedelta(days=30))
    assert evaluate_state(expired, THREE, 0, 0, bypass=True, now=NOW) is None
    d = evaluate_state(expired, THREE, 78, 0, bypass=True, check_seats=True, role="worker", now=NOW)
    assert d.code == SEAT_LIMIT
    d = evaluate_state(expired, THREE, 0, 3, bypass=True, check_seats=True, role="admin", now=NOW)
    assert d.code == ADMIN_LIMIT


def test_bypass_with_no_subscription_and_no_licences_is_unmetered():
    assert evaluate_state(None, [], 500, 40, bypass=True, check_seats=True, role="admin", now=NOW) is None


def test_bypass_with_subscription_but_no_licences_is_metered_to_zero():
    d = evaluate_state(ACTIVE, [], 0, 0, bypass=True, check_seats=True, role="worker", now=NOW)
    assert d.code == SEAT_LIMIT
    assert d.message == "Seat limit exceeded (0/0)"


def test_soft_revoke_keeps_existing_users_but_blocks_next_create():
    two = THREE[:2]   # one licence revoked -> 52 seats, 60 users already exist
    assert evaluate_state(ACTIVE, two, 60, 2, bypass=False, now=NOW) is None
    assert evaluate_state(ACTIVE, two, 60, 2, bypass=False, check_seats=True, role="worker", now=NOW).code == SEAT_LIMIT


def test_license_error_carries_code_and_403():
    err = LicenseError(SEAT_LIMIT, "Seat limit exceeded (78/78)")
    assert err.status_code == 403 and err.detail == "Seat limit exceeded (78/78)" and err.code == SEAT_LIMIT
    assert is_capacity_error(err)
    assert not is_capacity_error(LicenseError(EXPIRED, "x"))
    assert not is_capacity_error(ValueError("Seat limit exceeded (78/78)"))
