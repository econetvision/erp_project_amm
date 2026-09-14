from datetime import date, datetime, timezone
from decimal import Decimal

from services.invoice_service import LineSpec, build_lines, compute_totals, next_invoice_number

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
START, END = date(2026, 4, 1), date(2026, 4, 30)


def test_one_line_per_active_licence_with_description():
    lics = [(1, "HQ", 26, T0, None), (2, None, 26, T0, None), (3, "Yard", None, T0, None)]
    lines = build_lines(lics, Decimal("1000.00"), START, END)
    assert [l.description for l in lines] == [
        "Site licence — HQ (26 seats)",
        "Site licence — Company-wide (26 seats)",
        "Site licence — Yard (unlimited seats)",
    ]
    assert all(l.quantity == Decimal("1") and l.unit_price == Decimal("1000.00") and l.amount == Decimal("1000.00") for l in lines)
    assert [l.license_id for l in lines] == [1, 2, 3]


def test_licences_outside_the_period_are_excluded():
    lics = [
        (1, "HQ", 26, datetime(2026, 5, 1, tzinfo=timezone.utc), None),                       # granted after period
        (2, "HQ", 26, T0, datetime(2026, 3, 15, tzinfo=timezone.utc)),                         # revoked before period
        (3, "HQ", 26, T0, datetime(2026, 4, 10, tzinfo=timezone.utc)),                         # revoked inside period -> billed
        (4, "HQ", 26, datetime(2026, 4, 20, tzinfo=timezone.utc), None),                       # granted inside period -> billed
    ]
    assert [l.license_id for l in build_lines(lics, Decimal("10"), START, END)] == [3, 4]


def test_gst_maths_and_half_up_rounding():
    lines = [LineSpec(None, "x", Decimal("1"), Decimal("333.33"), Decimal("333.33"))] * 3
    subtotal, tax, total = compute_totals(lines, Decimal("18.00"))
    assert subtotal == Decimal("999.99")
    assert tax == Decimal("180.00")        # 179.9982 -> 180.00
    assert total == Decimal("1179.99")
    lines = [LineSpec(None, "x", Decimal("1"), Decimal("0.125"), Decimal("0.125"))]
    subtotal, tax, total = compute_totals(lines, Decimal("18"))
    assert subtotal == Decimal("0.13")     # half-up, not banker's
    assert tax == Decimal("0.02")
    assert total == Decimal("0.15")


def test_zero_tax():
    lines = [LineSpec(None, "x", Decimal("2"), Decimal("50"), Decimal("100"))]
    assert compute_totals(lines, Decimal("0")) == (Decimal("100.00"), Decimal("0.00"), Decimal("100.00"))


def test_invoice_number_sequence_per_year():
    assert next_invoice_number(2026, []) == "INV-2026-0001"
    assert next_invoice_number(2026, ["INV-2026-0001", "INV-2026-0007", "INV-2025-0099"]) == "INV-2026-0008"
    assert next_invoice_number(2027, ["INV-2026-0007"]) == "INV-2027-0001"
    assert next_invoice_number(2026, ["INV-2026-9999"]) == "INV-2026-10000"


def test_concurrent_allocation_from_same_snapshot_collides_so_lock_is_required():
    # Documents why generate_invoice() locks the year's rows: two callers seeing the
    # same snapshot get the same number. The DB unique constraint + FOR UPDATE prevent it.
    snapshot = ["INV-2026-0003"]
    assert next_invoice_number(2026, snapshot) == next_invoice_number(2026, snapshot)
