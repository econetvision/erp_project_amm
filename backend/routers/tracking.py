import json
import asyncio
from typing import Dict
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import func, and_
from sqlalchemy.orm import Session, joinedload
from database import get_db, SessionLocal
from models.vehicle import Vehicle
from models.vehicle_assignment import VehicleAssignment
from models.vehicle_location import VehicleLocation
from models.user import User
from schemas.vehicle_location import LocationPush, LocationResponse, LatestLocationResponse
from auth.dependencies import (
    require_admin_or_supervisor, get_current_user, get_current_user_or_service,
    decode_ws_token, ServiceIdentity,
)

router = APIRouter()

# In-memory registry: vehicle_id -> set of connected WebSockets (admin viewers)
_viewers: Dict[int, set] = {}
# vehicle_id -> latest location dict (broadcast cache)
_latest: Dict[int, dict] = {}


def _assert_can_push(vehicle_id: int, current, db: Session) -> None:
    """Raise 403 unless current is a trusted service, admin/supervisor/master,
    or a worker with an active assignment to this vehicle."""
    if isinstance(current, ServiceIdentity):
        return
    if current.role in ("admin", "supervisor", "master"):
        return
    active = (
        db.query(VehicleAssignment)
        .filter(
            VehicleAssignment.vehicle_id == vehicle_id,
            VehicleAssignment.employee_id == current.id,
            VehicleAssignment.released_at.is_(None),
        )
        .first()
    )
    if not active:
        raise HTTPException(status_code=403, detail="You are not assigned to this vehicle")


# ── REST: push location (for devices that can't hold WebSocket) ──────────────
@router.post("/push", response_model=LocationResponse, status_code=201)
def push_location(payload: LocationPush, db: Session = Depends(get_db), current=Depends(get_current_user_or_service)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    _assert_can_push(payload.vehicle_id, current, db)

    loc = VehicleLocation(
        vehicle_id=payload.vehicle_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        speed=payload.speed,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)

    # Update in-memory cache and broadcast to live viewers
    update = {
        "vehicle_id": loc.vehicle_id,
        "latitude":   loc.latitude,
        "longitude":  loc.longitude,
        "speed":      float(loc.speed) if loc.speed else None,
        "recorded_at": loc.recorded_at.isoformat(),
    }
    _latest[payload.vehicle_id] = update
    asyncio.create_task(_broadcast(payload.vehicle_id, update))
    return loc


# ── REST: latest location for all assigned vehicles ──────────────────────────
@router.get("/latest", response_model=list[LatestLocationResponse])
def get_latest_locations(db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    # Subquery: max recorded_at per vehicle
    latest_ts_subq = (
        db.query(
            VehicleLocation.vehicle_id,
            func.max(VehicleLocation.recorded_at).label("max_ts"),
        )
        .group_by(VehicleLocation.vehicle_id)
        .subquery()
    )
    # Fetch full location rows for each vehicle's latest timestamp
    latest_locs = (
        db.query(VehicleLocation)
        .join(
            latest_ts_subq,
            and_(
                VehicleLocation.vehicle_id == latest_ts_subq.c.vehicle_id,
                VehicleLocation.recorded_at == latest_ts_subq.c.max_ts,
            ),
        )
        .all()
    )
    loc_map = {loc.vehicle_id: loc for loc in latest_locs}

    # Fetch all active assignments with employee name in one query
    active_assignments = (
        db.query(VehicleAssignment)
        .filter(VehicleAssignment.released_at == None)  # noqa: E711
        .options(joinedload(VehicleAssignment.employee))
        .all()
    )
    assign_map = {a.vehicle_id: a for a in active_assignments}

    vehicles = db.query(Vehicle).all()
    result = []
    for v in vehicles:
        active = assign_map.get(v.id)
        last = loc_map.get(v.id)
        result.append(LatestLocationResponse(
            vehicle_id=v.id,
            reg_number=v.reg_number,
            type=v.type,
            status=v.status,
            employee_id=active.employee_id if active else None,
            employee_name=active.employee.name if active else None,
            latitude=last.latitude if last else None,
            longitude=last.longitude if last else None,
            speed=float(last.speed) if last and last.speed else None,
            recorded_at=last.recorded_at if last else None,
        ))
    return result


# ── REST: location history for a vehicle ─────────────────────────────────────
@router.get("/{vehicle_id}/history", response_model=list[LocationResponse])
def location_history(
    vehicle_id: int,
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_supervisor),
):
    return (
        db.query(VehicleLocation)
        .filter(VehicleLocation.vehicle_id == vehicle_id)
        .order_by(VehicleLocation.recorded_at.desc())
        .limit(limit)
        .all()
    )


# ── WebSocket: driver sends location; admin viewers receive broadcasts ────────
@router.websocket("/ws/{vehicle_id}")
async def vehicle_ws(vehicle_id: int, websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = decode_ws_token(token, db)
        if user is None:
            await websocket.close(code=4401)
            return

        is_viewer = user.role in ("admin", "supervisor", "master")
        can_push = is_viewer
        if not is_viewer:
            active = (
                db.query(VehicleAssignment)
                .filter(
                    VehicleAssignment.vehicle_id == vehicle_id,
                    VehicleAssignment.employee_id == user.id,
                    VehicleAssignment.released_at.is_(None),
                )
                .first()
            )
            can_push = active is not None
    finally:
        db.close()

    if not can_push:
        await websocket.close(code=4403)
        return

    await websocket.accept()

    # Only viewers (admin/supervisor/master) are registered for broadcasts —
    # drivers push location but don't need the stream echoed back to them.
    if is_viewer:
        _viewers.setdefault(vehicle_id, set()).add(websocket)
        if vehicle_id in _latest:
            await websocket.send_text(json.dumps(_latest[vehicle_id]))

    try:
        while True:
            raw = await websocket.receive_text()
            if is_viewer:
                continue  # viewer sockets are receive-only

            try:
                data = json.loads(raw)
                lat  = float(data["latitude"])
                lng  = float(data["longitude"])
                spd  = float(data["speed"]) if "speed" in data else None
            except (KeyError, ValueError):
                await websocket.send_text(json.dumps({"error": "Invalid payload"}))
                continue

            # Persist asynchronously
            write_db = SessionLocal()
            try:
                loc = VehicleLocation(vehicle_id=vehicle_id, latitude=lat, longitude=lng, speed=spd)
                write_db.add(loc)
                write_db.commit()
                write_db.refresh(loc)
                update = {
                    "vehicle_id": vehicle_id,
                    "latitude":   loc.latitude,
                    "longitude":  loc.longitude,
                    "speed":      float(loc.speed) if loc.speed else None,
                    "recorded_at": loc.recorded_at.isoformat(),
                }
            finally:
                write_db.close()

            _latest[vehicle_id] = update
            await _broadcast(vehicle_id, update)

    except WebSocketDisconnect:
        if is_viewer:
            _viewers.get(vehicle_id, set()).discard(websocket)


async def _broadcast(vehicle_id: int, data: dict):
    dead = set()
    for ws in _viewers.get(vehicle_id, set()):
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            dead.add(ws)
    _viewers.get(vehicle_id, set()).difference_update(dead)
