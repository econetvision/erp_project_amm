from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.vehicle import Vehicle
from models.user import User
from schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleResponse
from auth.dependencies import require_admin_or_supervisor, require_admin, get_current_user_or_service, ServiceIdentity

router = APIRouter()


@router.get("", response_model=list[VehicleResponse])
def list_vehicles(db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    return db.query(Vehicle).order_by(Vehicle.id).all()


@router.get("/imei-map")
def imei_map(db: Session = Depends(get_db), current=Depends(get_current_user_or_service)):
    """IMEI -> vehicle_id lookup for the tracking gateway. Trusted service callers
    (X-Internal-Key) or admin/supervisor/master only."""
    if not isinstance(current, ServiceIdentity) and current.role not in ("admin", "supervisor", "master"):
        raise HTTPException(status_code=403, detail="Admin or Supervisor access required")
    rows = db.query(Vehicle.tracker_imei, Vehicle.id).filter(Vehicle.tracker_imei.isnot(None)).all()
    return {imei: vehicle_id for imei, vehicle_id in rows}


@router.post("", response_model=VehicleResponse, status_code=201)
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    existing = db.query(Vehicle).filter(Vehicle.reg_number == payload.reg_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Registration number already exists")
    if payload.tracker_imei:
        imei_taken = db.query(Vehicle).filter(Vehicle.tracker_imei == payload.tracker_imei).first()
        if imei_taken:
            raise HTTPException(status_code=400, detail="Tracker IMEI is already registered to another vehicle")
    v = Vehicle(**payload.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.get("/{vehicle_id}", response_model=VehicleResponse)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin_or_supervisor)):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return v


@router.patch("/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(vehicle_id: int, payload: VehicleUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if payload.tracker_imei:
        imei_taken = (
            db.query(Vehicle)
            .filter(Vehicle.tracker_imei == payload.tracker_imei, Vehicle.id != vehicle_id)
            .first()
        )
        if imei_taken:
            raise HTTPException(status_code=400, detail="Tracker IMEI is already registered to another vehicle")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(v, key, value)
    db.commit()
    db.refresh(v)
    return v


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(v)
    db.commit()
