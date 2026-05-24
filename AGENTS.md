# AGENTS.md — ERP Project (AMM)

ERP system for employee management, attendance (with facial recognition), payslips, vehicle fleet, and live GPS tracking. Built by **EcoNetVision Pvt. Ltd.**

## Tech Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 + Pydantic v2, Python 3.11
- **Frontend**: React 18 (CRA) + React Router 6 + Bootstrap 5 (vanilla CSS, no wrapper lib) + Axios
- **Database**: PostgreSQL 16
- **Auth**: JWT (python-jose) + bcrypt, 3 roles: `admin`, `supervisor`, `worker`
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

- **No migration tool** — schema is in [db/init.sql](db/init.sql), tables also auto-created via `Base.metadata.create_all()` in [backend/main.py](backend/main.py). Any schema change requires updating both.
- **One file per domain** in every layer: models, schemas, routers, services, and frontend API/pages.
- All API routes are prefixed with `/api/` (see router mounts in [backend/main.py](backend/main.py)).
- Business logic lives in `backend/services/`, not in routers.
- Auth guards are FastAPI dependencies in [backend/auth/dependencies.py](backend/auth/dependencies.py): `get_current_user`, `require_admin`, `require_admin_or_supervisor`, `require_any`.

## Backend Conventions

- **Models**: singular class (`Employee`), plural table (`employees`). Common columns: `id`, `created_at`, `updated_at`. Uses `JSONB` for face encodings.
- **Schemas**: `EntityBase` → `EntityCreate(EntityBase)` → `EntityResponse` with `model_config = {"from_attributes": True}`. `EntityUpdate` uses all `Optional` fields. Uses `Literal` types (not Python enums) for constrained strings.
- **Routers**: standard CRUD — `GET ""`, `POST ""`, `GET "/{id}"`, `PUT "/{id}"`, `PATCH "/{id}"`, `DELETE "/{id}"`. POST returns 201, DELETE returns 204.
- **Errors**: `HTTPException` with `detail` string.
- **DB sessions**: injected via `db: Session = Depends(get_db)`.

## Frontend Conventions

- **No TypeScript, no ESLint, no Prettier** — plain JavaScript.
- React Context (`AuthContext`) for auth state, stored in `localStorage` key `erp_auth`.
- Axios instance in `api/axiosConfig.js` auto-attaches Bearer token; 401 triggers auto-logout.
- One API file per domain (e.g., `employeeApi.js`) with named exports (`getAllEmployees`, `createEmployee`).
- **Bootstrap 5 CSS classes** used directly — no React-Bootstrap. `Modal` from Bootstrap JS imported for confirm dialogs.
- Alert pattern: `const [alert, setAlert] = useState({ type: "", message: "" })` with `<AlertMessage>` component.
- File naming: `PascalCase.js` for components/pages, `camelCase.js` for API modules.

## Environment Variables

| Variable | Default |
|---|---|
| `DATABASE_URL` | `postgresql://erp_user:erp_pass@localhost:5432/erp_db` |
| `SECRET_KEY` | `erp-secret-key-change-in-production` |
| `ALLOWED_ORIGINS` | `http://localhost:3000` |
| `PORT` | `8088` |
| `REACT_APP_API_URL` | `http://localhost:8088` |

## Domain Logic

- **Shifts** defined in [backend/config/shifts.py](backend/config/shifts.py): SHIFT_A (6:30–14:00), SHIFT_B (9:00–17:00), each with 20-min break. 26 working days/month.
- **Payslip**: daily rate × days worked, deductions: ESI 0.75%, PF 12%.
- **Face recognition**: base64 image → 128-d encoding via `face_recognition` lib, stored as JSONB.
