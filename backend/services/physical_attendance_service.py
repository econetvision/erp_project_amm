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
