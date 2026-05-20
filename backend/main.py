import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import employees, attendance, payslips, auth, holidays, vehicles, assignments, tracking
import models.holiday           # noqa: F401
import models.vehicle           # noqa: F401
import models.vehicle_assignment  # noqa: F401
import models.vehicle_location  # noqa: F401

Base.metadata.create_all(bind=engine)

from seed import seed
seed()

app = FastAPI(
    title="ERP System API",
    description="Employee, Attendance and Payslip management",
    version="1.0.0",
    redirect_slashes=False,
)

_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")]
print(f"[CORS] Allowed origins: {_allowed_origins}", flush=True)

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


@app.get("/health")
def health_check():
    return {"status": "ok"}
