# ERP Project (AMM)

ERP system for employee management, attendance (with facial recognition and geofenced check-in), payslips, vehicle fleet, live GPS tracking, and a native Android app. Built by **EcoNetVision Pvt. Ltd.**

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 + Pydantic v2, Python 3.11
- **Frontend**: React 18 (CRA) + React Router 6 + Bootstrap 5 + Axios
- **Mobile**: Native Android (Kotlin), MVVM + Retrofit, min SDK 26
- **Database**: PostgreSQL 16
- **Auth**: JWT (python-jose) + bcrypt, RBAC with 4 roles: `master`, `admin`, `supervisor`, `worker`
- **Infra**: Docker Compose (postgres, backend, frontend/nginx)

## Repo Structure

| Path | Description |
|---|---|
| `backend/` | FastAPI app — models, schemas, routers, services, Alembic migrations |
| `frontend/` | React admin/web app |
| `mobile/` | Native Android app — see [mobile/README.md](mobile/README.md) |
| `gateway/` | Standalone TCP gateway translating hardware GPS tracker protocol (GT06) into the backend's tracking API — see [gateway/README.md](gateway/README.md) |
| `db/` | `init.sql` schema for fresh installs |

## Quick Start

```bash
# Dev — start all services
docker-compose up --build

# Prod
docker-compose -f docker-compose.prod.yml up -d --build

# Backend only (requires Postgres on localhost:5432)
cd backend && pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8088 --reload

# Frontend only
cd frontend && npm install
REACT_APP_API_URL=http://localhost:8088 npm start
```

Default seed admin account: `admin` / `admin123` (created by `backend/seed.py` on first startup).

## Key Features

- Employee & user management with RBAC (master/admin/supervisor/worker)
- Attendance: manual clock-in/out, face-scan auto clock-in/out, fingerprint and face login on mobile
- Geofenced check-in — work locations have a configurable radius (meters, default 50)
- Payslips, payroll runs, and templated PDF generation
- Vehicle fleet assignment and live GPS tracking, fed by hardware GPS trackers (via `gateway/`) with the Android app as a backup location source
- Holidays, notifications, multi-company/multi-tenant support

For architecture conventions and contributor guidance, see [AGENTS.md](AGENTS.md). For the Android app, see [mobile/README.md](mobile/README.md).
