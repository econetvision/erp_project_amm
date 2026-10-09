from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth.dependencies import require_admin, require_physical_attendance
from database import get_db
from models.user import User
from schemas.physical_attendance import (
    MySiteResponse, ScanRequest, ScanResponse, SiteAssignRequest,
    SupervisorSiteResponse, TodayResponse,
)
from services import physical_attendance_service as service

router = APIRouter()


# ── Admin: who may mark physical attendance, and where ───────────────────────

@router.get("/supervisors", response_model=list[SupervisorSiteResponse])
def list_supervisors(db: Session = Depends(get_db), current: User = Depends(require_admin)):
    return service.list_supervisors(db, current)


@router.put("/supervisors/{user_id}", response_model=SupervisorSiteResponse)
def assign_site(
    user_id: int,
    payload: SiteAssignRequest,
    db:      Session = Depends(get_db),
    current: User    = Depends(require_admin),
):
    return service.set_site(db, current, user_id, payload.location_id)


# ── Supervisor: attendance-only app ──────────────────────────────────────────

@router.get("/me", response_model=MySiteResponse)
def my_site(db: Session = Depends(get_db), current: User = Depends(require_physical_attendance)):
    return service.get_site(db, current)


@router.post("/scan", response_model=ScanResponse, status_code=201)
def scan(
    payload: ScanRequest,
    db:      Session = Depends(get_db),
    current: User    = Depends(require_physical_attendance),
):
    return service.scan(db, current, payload.image, payload.latitude, payload.longitude)


@router.get("/today", response_model=TodayResponse)
def today(db: Session = Depends(get_db), current: User = Depends(require_physical_attendance)):
    return service.today_list(db, current)
