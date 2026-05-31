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
from auth.dependencies import require_admin_or_supervisor, get_current_user

router = APIRouter()

# In-memory registry: vehicle_id -> set of connected WebSockets (admin viewers)
_viewers: Dict[int, set] = {}
# vehicle_id -> latest location dict (broadcast cache)
_latest: Dict[int, dict] = {}


# ── REST: push location (for devices that can't hold WebSocket) ──────────────
@router.post("/push", response_model=LocationResponse, status_code=201)
def push_location(payload: LocationPush, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

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
    await websocket.accept()

    # Register viewer
    _viewers.setdefault(vehicle_id, set()).add(websocket)

    # Send the cached latest location immediately on connect
    if vehicle_id in _latest:
        await websocket.send_text(json.dumps(_latest[vehicle_id]))

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                lat  = float(data["latitude"])
                lng  = float(data["longitude"])
                spd  = float(data["speed"]) if "speed" in data else None
            except (KeyError, ValueError):
                await websocket.send_text(json.dumps({"error": "Invalid payload"}))
                continue

            # Persist asynchronously
            db = SessionLocal()
            try:
                loc = VehicleLocation(vehicle_id=vehicle_id, latitude=lat, longitude=lng, speed=spd)
                db.add(loc)
                db.commit()
                db.refresh(loc)
                update = {
                    "vehicle_id": vehicle_id,
                    "latitude":   loc.latitude,
                    "longitude":  loc.longitude,
                    "speed":      float(loc.speed) if loc.speed else None,
                    "recorded_at": loc.recorded_at.isoformat(),
                }
            finally:
                db.close()

            _latest[vehicle_id] = update
            await _broadcast(vehicle_id, update)

    except WebSocketDisconnect:
        _viewers.get(vehicle_id, set()).discard(websocket)


async def _broadcast(vehicle_id: int, data: dict):
    dead = set()
    for ws in _viewers.get(vehicle_id, set()):
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            dead.add(ws)
    _viewers.get(vehicle_id, set()).difference_update(dead)
