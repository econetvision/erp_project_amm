"""Employee geofence tracking: background pings from the mobile app and the
exit/return event log for supervisors and admins."""
from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user, require_admin_or_supervisor, assert_tenant, tenant_scope
from database import get_db
from models.geofence import GeofenceExitEvent
from models.user import User
from schemas.geofence import GeofencePingRequest, GeofencePingResponse, GeofenceExitEventResponse
from services.geofence_service import record_ping

router = APIRouter()


@router.post("/ping", response_model=GeofencePingResponse)
def ping(payload: GeofencePingRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Record one background position report for a clocked-in employee.

    ``tracking`` is False when the employee is not clocked in today; the app
    should stop its location service on that response.
    """
    target_id = payload.employee_id or current.id
    if current.role == "worker" and target_id != current.id:
        raise HTTPException(status_code=403, detail="Workers can only report their own location")
    if target_id == current.id:
        emp = current
    else:
        emp = db.query(User).filter(User.id == target_id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        assert_tenant(current, emp.company_id)

    result = record_ping(db, emp, payload.latitude, payload.longitude, payload.accuracy_m)
    return GeofencePingResponse(**result.__dict__)


@router.get("/events", response_model=list[GeofenceExitEventResponse])
def list_events(
    open_only: bool = False,
    employee_id: Optional[int] = None,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current: User = Depends(require_admin_or_supervisor),
):
    """Exit episodes, newest first, scoped to the caller's company."""
    q = (
        db.query(GeofenceExitEvent, User.name, User.display_name, User.username, User.employee_code)
        .join(User, User.id == GeofenceExitEvent.employee_id)
    )
    q = tenant_scope(q, User.company_id, current)
    if open_only:
        q = q.filter(GeofenceExitEvent.returned_at.is_(None))
    if employee_id is not None:
        q = q.filter(GeofenceExitEvent.employee_id == employee_id)
    if date_from:
        q = q.filter(GeofenceExitEvent.exited_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        q = q.filter(GeofenceExitEvent.exited_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))
    rows = q.order_by(GeofenceExitEvent.exited_at.desc()).limit(limit).all()

    out: list[GeofenceExitEventResponse] = []
    for ev, name, display_name, username, code in rows:
        item = GeofenceExitEventResponse.model_validate(ev)
        item.employee_name = name or display_name or username
        item.employee_code = code
        out.append(item)
    return out
