import logging
from datetime import date, datetime, time
from sqlalchemy.orm import Session
from sqlalchemy import extract
from models.employee import Employee
from models.attendance import Attendance
from models.user import User
from models.notification import Notification
from models.job_routine import JobRoutine, JobRoutineLog
from services.attendance_service import is_late_arrival
from services.email_service import send_email
from config.shifts import SHIFTS

logger = logging.getLogger(__name__)


def execute_job(db: Session, job: JobRoutine, target_date: date | None = None):
    """Execute a job routine and log the result."""
    target = target_date or date.today()
    try:
        if job.type == "absent_report":
            result = _absent_report(db, target, job.filters)
        elif job.type == "late_report":
            result = _late_report(db, target, job.filters)
        elif job.type == "custom":
            result = _custom_report(db, target, job.filters)
        else:
            raise ValueError(f"Unknown job type: {job.type}")

        # Deliver
        _deliver(db, job, result["subject"], result["html"], result["summary"])

        # Log success
        log = JobRoutineLog(job_id=job.id, status="success", result_summary=result["summary"])
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Job {job.id} ({job.name}) failed: {e}")
        log = JobRoutineLog(job_id=job.id, status="failed", error_message=str(e))
        db.add(log)
        db.commit()


def _absent_report(db: Session, target: date, filters: dict | None) -> dict:
    employees = db.query(Employee).order_by(Employee.id).all()
    present_ids = {
        a.employee_id
        for a in db.query(Attendance).filter(Attendance.date == target).all()
    }
    absent = [e for e in employees if e.id not in present_ids]
    if filters and filters.get("shift"):
        absent = [e for e in absent if e.shift == filters["shift"]]

    rows = "".join(
        f"<tr><td>{e.id}</td><td>{e.name}</td><td>{e.shift}</td></tr>"
        for e in absent
    )
    html = f"""
    <h2>Absent Report — {target}</h2>
    <p>{len(absent)} employee(s) absent out of {len(employees)} total.</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>ID</th><th>Name</th><th>Shift</th></tr>
      {rows}
    </table>
    """
    return {
        "subject": f"Absent Report — {target}",
        "html": html,
        "summary": f"{len(absent)}/{len(employees)} absent on {target}",
    }


def _late_report(db: Session, target: date, filters: dict | None) -> dict:
    records = (
        db.query(Attendance)
        .filter(Attendance.date == target)
        .all()
    )
    late = []
    for r in records:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        if emp and is_late_arrival(r.entry_time, emp.shift):
            shift_start = SHIFTS.get(emp.shift, {}).get("start", time(0, 0))
            late.append({"emp": emp, "entry": r.entry_time, "shift_start": shift_start})

    if filters and filters.get("shift"):
        late = [l for l in late if l["emp"].shift == filters["shift"]]

    rows = "".join(
        f"<tr><td>{l['emp'].id}</td><td>{l['emp'].name}</td><td>{l['shift_start']}</td><td>{l['entry']}</td></tr>"
        for l in late
    )
    html = f"""
    <h2>Late Arrival Report — {target}</h2>
    <p>{len(late)} employee(s) arrived late.</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>ID</th><th>Name</th><th>Shift Start</th><th>Arrived</th></tr>
      {rows}
    </table>
    """
    return {
        "subject": f"Late Arrival Report — {target}",
        "html": html,
        "summary": f"{len(late)} late arrivals on {target}",
    }


def _custom_report(db: Session, target: date, filters: dict | None) -> dict:
    # Placeholder for custom reports
    return {
        "subject": f"Custom Report — {target}",
        "html": f"<h2>Custom Report — {target}</h2><p>No custom logic configured.</p>",
        "summary": "Custom report placeholder",
    }


def _deliver(db: Session, job: JobRoutine, subject: str, html: str, summary: str):
    channels = job.delivery_channels or {}
    recipients = job.recipients or []

    # Collect email addresses and user IDs
    emails: list[str] = []
    user_ids: list[int] = []
    for r in recipients:
        if r.get("type") == "email":
            emails.append(r["value"])
        elif r.get("type") == "user":
            user_ids.append(int(r["value"]))

    # Also get emails from user_ids
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        for u in users:
            if u.email:
                emails.append(u.email)

    # Email delivery
    if channels.get("email") and emails:
        send_email(emails, subject, html)

    # In-app notification
    if channels.get("in_app") and user_ids:
        for uid in user_ids:
            notif = Notification(user_id=uid, title=subject, body=summary, type="info")
            db.add(notif)
        db.commit()
