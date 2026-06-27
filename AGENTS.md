# AGENTS.md — ERP Project (AMM)

ERP system for employee management, attendance (with facial recognition), payslips, vehicle fleet, live GPS tracking, and a native Android app. Built by **EcoNetVision Pvt. Ltd.**

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 + Pydantic v2, Python 3.11
- **Frontend**: React 18 (CRA) + React Router 6 + Bootstrap 5 (vanilla CSS, no wrapper lib) + Axios. TypeScript (`.ts`/`.tsx`) is used throughout (API modules and pages) — there is no plain-JS/TS split, just write `.ts`/`.tsx`.
- **Mobile**: Native Android (Kotlin), MVVM + Retrofit, min SDK 26 — see [mobile/README.md](mobile/README.md)
- **Gateway**: standalone asyncio TCP service in [gateway/](gateway/) translating hardware GPS tracker protocols (GT06) into calls against the backend's tracking API — deployed separately from `backend/`, see [DEPLOYMENT.md](DEPLOYMENT.md#fleet-tracking-gateway-railway)
- **Database**: PostgreSQL 16
- **Auth**: JWT (python-jose) + bcrypt, 4 roles: `master`, `admin`, `supervisor`, `worker` (RBAC permission model in [backend/models/rbac.py](backend/models/rbac.py), seeded in [backend/seed.py](backend/seed.py))
- **Infra**: Docker Compose (3 containers: postgres, backend, frontend/nginx)

## Commands

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

**No test framework** is configured (no pytest, no jest/react-testing-library).

**Default seed**: On first startup, `backend/seed.py` creates admin user `admin` / `admin123`.

## Architecture — Key Facts

- **Alembic migrations exist** under `backend/alembic/versions/` (sequential `000N_*.py`) AND the schema is mirrored in [db/init.sql](db/init.sql) for fresh installs, with tables also auto-created via `Base.metadata.create_all()` in [backend/main.py](backend/main.py). Any schema change requires updating all three: model, a new Alembic migration, and `db/init.sql`.
- **One file per domain** in every layer: models, schemas, routers, services, and frontend API/pages.
- All API routes are prefixed with `/api/` (see router mounts in [backend/main.py](backend/main.py)).
- Business logic lives in `backend/services/`, not in routers.
- Auth guards are FastAPI dependencies in [backend/auth/dependencies.py](backend/auth/dependencies.py): `get_current_user`, `require_admin`, `require_admin_or_supervisor`, `require_any`, `require_master`, `require_role(*roles)`, `require_permission(*codes)`.
- **Geofenced attendance**: work locations (`backend/models/work_location.py`) and the legacy per-user fallback (`User.attendance_radius_m`) store the allowed check-in radius **in meters** (default 50, range 1–5000), validated via Haversine distance in `backend/routers/attendance.py::validate_geofence`. A user's assigned location(s) for display purposes are exposed read-only at `GET /api/locations/my`.
- **Face recognition** is used in three places: attendance face-scan auto clock-in/out (`POST /api/attendance/face-scan`, 1:N match), face registration (`POST /api/employees/{id}/face`), and face login (`POST /api/auth/face-login`, 1:N match against all users with a stored `face_encoding`, issues a normal JWT). All three call into `backend/services/face_service.py`.
- **Fleet tracking**: `POST /api/tracking/push` and `WS /api/tracking/ws/{vehicle_id}` (`backend/routers/tracking.py`) persist `VehicleLocation` rows and broadcast to connected admin/supervisor viewers. The WS broadcast cache (`_viewers`/`_latest`) is **in-memory and per-process** — the backend must run with `WORKERS=1` (see `backend/entrypoint.sh`) or the broadcast silently misses viewers on other workers. Hardware GPS trackers reach this pipeline via the standalone `gateway/` service (not a per-user JWT — authenticates via the `X-Internal-Key`/`TRACKING_GATEWAY_KEY` shared secret, see `get_current_user_or_service` in `backend/auth/dependencies.py`); the Android app is a secondary/backup path using the same endpoint with a normal user JWT, gated by an active `VehicleAssignment` (`GET /api/assignments/my`).

## Backend Conventions

- **Models**: singular class (`Employee`), plural table (`employees`). Common columns: `id`, `created_at`, `updated_at`. Uses `JSONB` for face encodings.
- **Schemas**: `EntityBase` → `EntityCreate(EntityBase)` → `EntityResponse` with `model_config = {"from_attributes": True}`. `EntityUpdate` uses all `Optional` fields. Uses `Literal` types (not Python enums) for constrained strings.
- **Routers**: standard CRUD — `GET ""`, `POST ""`, `GET "/{id}"`, `PUT "/{id}"`, `PATCH "/{id}"`, `DELETE "/{id}"`. POST returns 201, DELETE returns 204.
- **Errors**: `HTTPException` with `detail` string.
- **DB sessions**: injected via `db: Session = Depends(get_db)`.

## Frontend Conventions

- TypeScript (`.ts`/`.tsx`) — no separate ESLint/Prettier config beyond CRA defaults.
- React Context (`AuthContext`) for auth state, stored in `localStorage` key `erp_auth`.
- Axios instance in `api/axiosConfig.ts` auto-attaches Bearer token; 401 triggers auto-logout.
- One API file per domain (e.g., `employeeApi.ts`) with named exports (`getAllEmployees`, `createEmployee`).
- **Bootstrap 5 CSS classes** used directly — no React-Bootstrap. `Modal` from Bootstrap JS imported for confirm dialogs.
- Alert pattern: `const [alert, setAlert] = useState({ type: "", message: "" })` with `<AlertMessage>` component.
- File naming: `PascalCase.tsx` for components/pages, `camelCase.ts` for API modules and types.

## Environment Variables

| Variable | Default |
|---|---|
| `DATABASE_URL` | `postgresql://erp_user:erp_pass@localhost:5432/erp_db` |
| `SECRET_KEY` | `erp-secret-key-change-in-production` |
| `ALLOWED_ORIGINS` | `http://localhost:3000` |
| `PORT` | `8088` |
| `WORKERS` | `1` (backend; see fleet tracking note above — don't raise without addressing the in-memory broadcast gap) |
| `TRACKING_GATEWAY_KEY` | _(empty)_ — shared secret with `gateway/`, only needed if hardware GPS trackers are in use |
| `LOCATION_RETENTION_DAYS` | `90` — vehicle_locations rows older than this are purged daily |
| `REACT_APP_API_URL` | `http://localhost:8088` |

## Domain Logic

- **Shifts** defined in [backend/config/shifts.py](backend/config/shifts.py): SHIFT_A (6:30–14:00), SHIFT_B (9:00–17:00), each with 20-min break. 26 working days/month.
- **Payslip**: daily rate × days worked, deductions: ESI 0.75%, PF 12%.
- **Face recognition**: base64 image → 128-d encoding via `face_recognition` lib, stored as JSONB.
