from services.subscription_service import LicenseSpec, compute_capacity, count_seats


def lic(max_users=26, max_admins=1, status="active", id=None):
    return LicenseSpec(id=id, status=status, max_users=max_users, max_admins=max_admins)


def test_capacity_one_licence():
    c = compute_capacity([lic()])
    assert (c.seats, c.admins, c.active_licenses) == (26, 1, 1)


def test_capacity_two_and_three_licences_sum():
    assert compute_capacity([lic(), lic()]).seats == 52
    c = compute_capacity([lic(), lic(), lic()])
    assert (c.seats, c.admins, c.active_licenses) == (78, 3, 3)


def test_unlimited_when_any_licence_has_null_max_users():
    c = compute_capacity([lic(), lic(max_users=None)])
    assert c.seats is None
    assert c.admins == 2


def test_revoked_licences_excluded():
    c = compute_capacity([lic(), lic(status="revoked"), lic(status="revoked", max_users=None)])
    assert (c.seats, c.admins, c.active_licenses) == (26, 1, 1)


def test_no_licences_is_zero_capacity():
    c = compute_capacity([])
    assert (c.seats, c.admins, c.active_licenses) == (0, 0, 0)


def test_count_seats_master_never_consumes_and_null_active_counts():
    users = [("master", True), ("admin", True), ("admin", None), ("worker", None), ("worker", False), ("supervisor", True)]
    seats, admins = count_seats(users)
    assert seats == 4      # admin, admin(NULL), worker(NULL), supervisor
    assert admins == 2
