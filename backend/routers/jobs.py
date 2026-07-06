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
from auth.dependencies import require_admin, get_current_user, assert_tenant, tenant_scope

router = APIRouter()


@router.get("", response_model=list[JobRoutineResponse])
def list_jobs(db: Session = Depends(get_db), current: User = Depends(require_admin)):
    q = tenant_scope(db.query(JobRoutine), JobRoutine.company_id, current)
    return q.order_by(JobRoutine.id).all()


@router.post("", response_model=JobRoutineResponse, status_code=201)
def create_job(
    payload: JobRoutineCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    job = JobRoutine(**payload.model_dump(), created_by=current.id, company_id=current.company_id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobDetailResponse)
def get_job(job_id: int, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    job = db.query(JobRoutine).filter(JobRoutine.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    assert_tenant(current, job.company_id)
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
def update_job(job_id: int, payload: JobRoutineUpdate, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    job = db.query(JobRoutine).filter(JobRoutine.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    assert_tenant(current, job.company_id)
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    job = db.query(JobRoutine).filter(JobRoutine.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    assert_tenant(current, job.company_id)
    db.delete(job)
    db.commit()


@router.post("/{job_id}/run", response_model=JobRoutineLogResponse)
def run_job_now(job_id: int, db: Session = Depends(get_db), current: User = Depends(require_admin)):
    job = db.query(JobRoutine).filter(JobRoutine.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    assert_tenant(current, job.company_id)
    execute_job(db, job)
    log = (
        db.query(JobRoutineLog)
        .filter(JobRoutineLog.job_id == job_id)
        .order_by(JobRoutineLog.executed_at.desc())
        .first()
    )
    return log
