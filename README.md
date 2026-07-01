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

## Configuration

All backend settings are centralized in **[`backend/config/settings.py`](backend/config/settings.py)** (a Pydantic `BaseSettings` singleton). Import `settings` instead of calling `os.getenv` directly:

```python
from config.settings import settings
engine = create_engine(settings.database_url)
```

Values come from environment variables (or a local `.env`); field names map to `UPPER_SNAKE_CASE` (`database_url` → `DATABASE_URL`). See **[`.env.example`](.env.example)** for the full list. Key groups: database/auth, CORS, SMTP email, Twilio, KYC, fleet tracking, and **licensing**.

### Licensing

Each company has a license validated at login and per request (`backend/services/license_service.py`). Two enforcement modes:

| Mode | Trigger | Behaviour |
|---|---|---|
| **Local DB** (default) | no `LICENSE_KEY` set | Validates against the `company_licenses` table (status/expiry/seats). |
| **Static bypass** | `LICENSE_KEY` set, or `LICENSE_ENFORCE=false` | Every company is treated as licensed; the external license server is **not** called. Used for our own deployments — inject `LICENSE_KEY` via a CI/deploy secret. |

**External license server** — when configured (`LICENSE_SERVER_URL`) and not bypassed, `backend/services/license_client.py` talks to the server's public API (`LICENSE_API_BASE`, default `/api/v1`; auth = `licenseKey` in the body):

| Method | Path | Body | Purpose |
|---|---|---|---|
| POST | `/validate` | `{licenseKey}` | Check status, no seat consumed |
| POST | `/activate` | `{licenseKey, deviceId, hostname?, platform?}` | Claim a device seat (idempotent) |
| POST | `/heartbeat` | `{licenseKey, deviceId}` | Keep the seat alive (< 30 min) |
| POST | `/deactivate` | `{licenseKey, deviceId}` | Release the seat |
| GET | `/public-key` | — | PEM for offline verification |

Device / OS / browser info is reported via the `hostname` and `platform` fields; web and mobile clients can pass their own `platform` descriptor (e.g. `web:Chrome/120`, `android:Pixel7/Android14`).

In CI, `LICENSE_KEY` and `LICENSE_SERVER_URL` are GitHub Actions secrets that the Railway deploy workflow syncs to the service's runtime variables.

## Key Features

- Employee & user management with RBAC (master/admin/supervisor/worker)
- **Employee onboarding**: Admin creates employees with username/password; employees can immediately login to the mobile app
- **Employee code format**: `COMPANY-SITE-ID` (e.g., `ECONE-HQ-001`) — auto-generated, admin-editable
- Attendance: manual clock-in/out, face-scan auto clock-in/out, fingerprint and face login on mobile
- Geofenced check-in — work locations have a configurable radius (meters, default 50); the Android app shows a Google Maps view of the live position, geofence radius, and recorded clock-in/out pins
- Payslips, payroll runs, and templated PDF generation
- Vehicle fleet assignment and live GPS tracking, fed by hardware GPS trackers (via `gateway/`) with the Android app as a backup location source
- Holidays, notifications, multi-company/multi-tenant support

## Mobile App

The Android app allows workers and supervisors to:
- Login with admin-provided credentials
- Clock in/out with face recognition and GPS verification
- View attendance history and work location on map

### Latest Release

| Version | Download | Changes |
|---------|----------|---------|
| **v1.1.0** | [GitHub Release](https://github.com/econetvision/erp_project_amm/releases/tag/mobile-v1.1.0) | Fixed authentication for clock-in/out, improved session management |
| v1.0.0 | [GitHub Release](https://github.com/econetvision/erp_project_amm/releases/tag/mobile-v1.0.0) | Initial release |

To install: Download the APK, enable "Install from unknown sources" on your Android device, and open the APK file.

For architecture conventions and contributor guidance, see [AGENTS.md](AGENTS.md). For the Android app details, see [mobile/README.md](mobile/README.md).
