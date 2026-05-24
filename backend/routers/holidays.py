from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import Optional

from database import get_db
from models.holiday import PublicHoliday
from schemas.holiday import HolidayCreate, HolidayResponse
from auth.dependencies import require_admin, require_admin_or_supervisor

router = APIRouter()


@router.get("", response_model=list[HolidayResponse])
def list_holidays(
    year: Optional[int] = Query(None),
    db:   Session = Depends(get_db),
    _:    object  = Depends(require_admin_or_supervisor),
):
    q = db.query(PublicHoliday)
    if year:
        q = q.filter(extract("year", PublicHoliday.date) == year)
    return q.order_by(PublicHoliday.date).all()


@router.post("", response_model=HolidayResponse, status_code=201)
def create_holiday(
    payload: HolidayCreate,
    db:      Session = Depends(get_db),
    _:       object  = Depends(require_admin),
):
    existing = db.query(PublicHoliday).filter(PublicHoliday.date == payload.date).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    holiday = PublicHoliday(
        date=payload.date,
        name=payload.name,
        holiday_type=payload.holiday_type,
        is_optional=payload.is_optional,
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/{holiday_id}", status_code=204)
def delete_holiday(
    holiday_id: int,
    db:         Session = Depends(get_db),
    _:          object  = Depends(require_admin),
):
    holiday = db.query(PublicHoliday).filter(PublicHoliday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(holiday)
    db.commit()
