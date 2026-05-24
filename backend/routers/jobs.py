from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.job_routine import JobRoutine, JobRoutineLog
from schemas.job_routine import (
    JobRoutineCreate, JobRoutineUpdate, JobRoutineResponse,
    JobDetailResponse, JobRoutineLogResponse,
)
from services.job_service import execute_job
from auth.dependencies import require_admin, get_current_user

router = APIRouter()


@router.get("", response_model=list[JobRoutineResponse])
def list_jobs(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(JobRoutine).order_by(JobRoutine.id).all()


@router.post("", response_model=JobRoutineResponse, status_code=201)
def create_job(
    payload: JobRoutineCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    job = JobRoutine(**payload.model_dump(), created_by=current.id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobDetailResponse)
def get_job(job_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    job = db.query(JobRoutine).filter(JobRoutine.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    logs = (
        db.query(JobRoutineLog)
        .filter(JobRoutineLog.job_id == job_id)
        .order_by(JobRoutineLog.executed_at.desc())
        .limit(20)
        .all()
    )
    resp = JobDetailResponse.model_validate(job)
    resp.recent_logs = [JobRoutineLogResponse.model_validate(l) for l in logs]
    return resp


@router.put("/{job_id}", response_model=JobRoutineResponse)
def update_job(job_id: int, payload: JobRoutineUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    job = db.query(JobRoutine).filter(JobRoutine.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    job = db.query(JobRoutine).filter(JobRoutine.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()


@router.post("/{job_id}/run", response_model=JobRoutineLogResponse)
def run_job_now(job_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    job = db.query(JobRoutine).filter(JobRoutine.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    execute_job(db, job)
    log = (
        db.query(JobRoutineLog)
        .filter(JobRoutineLog.job_id == job_id)
        .order_by(JobRoutineLog.executed_at.desc())
        .first()
    )
    return log
