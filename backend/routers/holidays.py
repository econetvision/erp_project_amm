from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, or_
from typing import Optional

from database import get_db
from models.holiday import PublicHoliday
from models.user import User
from schemas.holiday import HolidayCreate, HolidayResponse
from auth.dependencies import require_admin, require_admin_or_supervisor, assert_tenant

router = APIRouter()


@router.get("", response_model=list[HolidayResponse])
def list_holidays(
    year:    Optional[int] = Query(None),
    db:      Session = Depends(get_db),
    current: User    = Depends(require_admin_or_supervisor),
):
    q = db.query(PublicHoliday)
    # A NULL company_id is a GLOBAL holiday visible to every tenant. Non-master
    # users see their own company's rows plus globals; master sees everything.
    if current.role != "master":
        q = q.filter(
            or_(
                PublicHoliday.company_id == current.company_id,
                PublicHoliday.company_id.is_(None),
            )
        )
    if year:
        q = q.filter(extract("year", PublicHoliday.date) == year)
    return q.order_by(PublicHoliday.date).all()


@router.post("", response_model=HolidayResponse, status_code=201)
def create_holiday(
    payload: HolidayCreate,
    db:      Session = Depends(get_db),
    current: User    = Depends(require_admin),
):
    # Duplicate check is scoped to the caller's own company so a company may add a
    # date even when a global/other-company row already exists for it.
    existing = (
        db.query(PublicHoliday)
        .filter(
            PublicHoliday.date == payload.date,
            PublicHoliday.company_id == current.company_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    holiday = PublicHoliday(
        date=payload.date,
        name=payload.name,
        holiday_type=payload.holiday_type,
        is_optional=payload.is_optional,
        company_id=current.company_id,
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/{holiday_id}", status_code=204)
def delete_holiday(
    holiday_id: int,
    db:         Session = Depends(get_db),
    current:    User    = Depends(require_admin),
):
    holiday = db.query(PublicHoliday).filter(PublicHoliday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    # Non-master users may never delete a global (NULL company) holiday.
    if holiday.company_id is None and current.role != "master":
        raise HTTPException(status_code=403, detail="Cannot delete a global holiday")
    assert_tenant(current, holiday.company_id)
    db.delete(holiday)
    db.commit()
