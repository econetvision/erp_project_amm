import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
from routers import employees, attendance, payslips, auth, holidays, vehicles, assignments, tracking, jobs, notifications, payroll, locations
from routers import companies, rbac, master as master_router, integrations as integrations_router
from routers import payslip_templates
from logging_config import setup_logging, get_logger

# Setup logging before anything else
setup_logging(log_level=os.getenv("LOG_LEVEL", "INFO"))
logger = get_logger(__name__)
import models.holiday           # noqa: F401
import models.vehicle           # noqa: F401
import models.vehicle_assignment  # noqa: F401
import models.vehicle_location  # noqa: F401
import models.job_routine       # noqa: F401
import models.notification      # noqa: F401
import models.salary_structure  # noqa: F401
import models.advance           # noqa: F401
import models.payroll_run       # noqa: F401
import models.work_location     # noqa: F401
import models.company           # noqa: F401
import models.rbac              # noqa: F401
import models.integration       # noqa: F401
import models.payslip_template  # noqa: F401

# ── Run DB migrations on startup ──────────────────────────────────────────────
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command

def _run_migrations():
    logger.info("Starting database migrations...")
    try:
        ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
        cfg = AlembicConfig(ini_path)
        cfg.set_main_option("sqlalchemy.url", str(engine.url))
        alembic_command.upgrade(cfg, "head")
        logger.info("Database migrations completed successfully")
    except Exception as e:
        logger.error(f"Database migration failed: {str(e)}", exc_info=True)
        raise

_run_migrations()

from seed import seed
logger.info("Running database seed...")
seed()
logger.info("Database seed completed")

app = FastAPI(
    title="ERP System API",
    description="Employee, Attendance and Payslip management",
    version="1.0.0",
    redirect_slashes=False,
)

_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")]
logger.info(f"CORS allowed origins: {_allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(employees.router,   prefix="/api/employees",   tags=["Employees"])
app.include_router(attendance.router,  prefix="/api/attendance",  tags=["Attendance"])
app.include_router(payslips.router,    prefix="/api/payslips",    tags=["Payslips"])
app.include_router(holidays.router,    prefix="/api/holidays",    tags=["Holidays"])
app.include_router(vehicles.router,    prefix="/api/vehicles",    tags=["Vehicles"])
app.include_router(assignments.router, prefix="/api/assignments",  tags=["Assignments"])
app.include_router(tracking.router,    prefix="/api/tracking",    tags=["Tracking"])
app.include_router(jobs.router,        prefix="/api/jobs",        tags=["Jobs"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(payroll.router, prefix="/api/payroll", tags=["Payroll"])
app.include_router(locations.router, prefix="/api/locations", tags=["Work Locations"])
app.include_router(companies.router, prefix="/api/companies", tags=["Companies"])
app.include_router(rbac.router, prefix="/api/rbac", tags=["RBAC"])
app.include_router(master_router.router, prefix="/api/master", tags=["Master"])
app.include_router(integrations_router.router, prefix="/api/integrations", tags=["Integrations"])
app.include_router(payslip_templates.router, prefix="/api/payslip-templates", tags=["Payslip Templates"])


# ── Scheduled Job Runner ──────────────────────────────────────────────────────
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime

def run_scheduled_jobs():
    """Check all active jobs and execute those matching the current schedule."""
    from database import SessionLocal
    from models.job_routine import JobRoutine
    from services.job_service import execute_job
    db = SessionLocal()
    try:
        now = datetime.now()
        current_time = now.strftime("%H:%M")
        active_jobs = db.query(JobRoutine).filter(JobRoutine.is_active == True).all()
        logger.debug(f"Checking {len(active_jobs)} active jobs at {current_time}")
        for job in active_jobs:
            if job.schedule_time != current_time:
                continue
            if job.frequency == "weekly" and job.schedule_day_of_week is not None:
                if now.weekday() != job.schedule_day_of_week:
                    continue
            if job.frequency == "monthly" and job.schedule_day_of_month is not None:
                if now.day != job.schedule_day_of_month:
                    continue
            logger.info(f"Executing scheduled job: {job.name} (ID: {job.id})")
            execute_job(db, job)
    except Exception as e:
        logger.error(f"Error in scheduled job execution: {str(e)}", exc_info=True)
    finally:
        db.close()

scheduler = BackgroundScheduler()
scheduler.add_job(run_scheduled_jobs, CronTrigger(minute="*"), id="job_checker", replace_existing=True)

@app.on_event("startup")
def start_scheduler():
    logger.info("Starting background scheduler...")
    scheduler.start()
    logger.info("Background scheduler started successfully")
    logger.info(f"Application started - Version: {app.version}")

@app.on_event("shutdown")
def stop_scheduler():
    logger.info("Shutting down background scheduler...")
    scheduler.shutdown()
    logger.info("Background scheduler stopped")
    logger.info("Application shutdown complete")


@app.get("/health")
def health_check():
    return {"status": "ok"}

# Serve uploaded photos
_uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(_uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")
