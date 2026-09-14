# Subscription & Site Licensing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the invisible one-row-per-company `company_licenses` system with subscriptions, per-site 26-seat licences, GST invoices, and a master console UI to manage them, plus a read-only admin view and a dashboard seat widget.

**Architecture:** Four new tables (`subscriptions`, `licenses`, `invoices`, `invoice_lines`) replace `company_licenses` via a data-preserving Alembic migration. All seat/validity/invoice maths lives in pure functions in `services/subscription_service.py` and `services/invoice_service.py` (unit-tested without a DB); thin DB wrappers load rows and call them. Three routers (`/api/subscriptions`, `/api/licenses`, `/api/invoices`) are master-write / admin-read. The React frontend gains two API modules, four master pages, one admin page and one dashboard widget, all using the existing Bootstrap 5 + `AlertMessage` conventions.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2.0, Pydantic v2, Alembic, PostgreSQL 16, pytest; React 18 (CRA) + TypeScript 4.9 + React Router 6 + Bootstrap 5 + Axios.

**Spec:** `docs/superpowers/specs/2026-08-29-subscription-licensing-design.md`

## Global Constraints

- Every schema change touches three places: the SQLAlchemy model, a new Alembic migration, and `db/init.sql` (AGENTS.md).
- Migration revision id is `0031_subscription_licensing`, `down_revision = "0030_geofence_exit_alerts"` (the spec's `0030` number is already taken by the geofence migration).
- Seat maths: `capacity = NULL (unlimited) if any active licence has max_users IS NULL else Σ max_users`; `admin_cap = Σ max_admins`; `seats_used = COUNT(users WHERE company_id=? AND role != 'master' AND is_active IS NOT FALSE)`; `admins_used` = same AND `role='admin'`.
- D7: `LICENSE_KEY` / `LICENSE_ENFORCE=false` bypass skips ONLY subscription validity (missing / suspended / expired / no licence). Seat and admin caps are always enforced, except when bypass is active AND the company has no subscription AND no licence at all (then unmetered).
- D6: revoke is soft; existing users keep working; only new user creation is blocked while over capacity.
- Denial messages carry counts: `Seat limit exceeded (78/78)`, `Admin limit exceeded (3/3)`. Exceptions carry a machine-readable `code` (`SEAT_LIMIT`, `ADMIN_LIMIT`, …); the bulk import must branch on the code, never on the message.
- Licence defaults: `max_users = 26`, `max_admins = 1`, `license_key = secrets.token_urlsafe(32)`. Stacking allowed: no unique constraint on `(company_id, site_id)`.
- Invoice: one line per licence active in the period, `unit_price = subscription.unit_price`, `tax_rate` default `18.00`, money rounded half-up to 2 dp at subtotal, tax and total; `invoice_number = INV-{YYYY}-{NNNN}` allocated under `SELECT … FOR UPDATE`; created as `draft`; `billing_snapshot` freezes company name, address, city, state, pincode, gst_number.
- All mutations are `require_master` and write an `AuditLog` row (`user_id`, `company_id`, `action`, `entity_type`, `entity_id`, `details`).
- Frontend: TypeScript, Bootstrap 5 classes directly (no React-Bootstrap), `AlertMessage` + `useState({ type, message })`, one API module per domain with named exports, print via `window.print()` — no new PDF dependency.
- `validate_company_license(db, company_id)` keeps its name and 403 behaviour. `enforce_seat_limit(db, company_id, role)` gains a `role` parameter.
- Out of scope: payment gateway, per-site metering, external licence server protocol, mobile app changes.
- Run backend commands from `backend/`; tests with `python -m pytest tests -q`. Frontend type-check/build with `npm run build` from `frontend/` (`CI=true` so warnings fail).
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File Map

**Backend — create**
- `backend/models/subscription.py` — `Subscription`, `License` models.
- `backend/models/invoice.py` — `Invoice`, `InvoiceLine` models.
- `backend/alembic/versions/0031_subscription_licensing.py` — create 4 tables, migrate `company_licenses` rows, drop it; downgrade reverses.
- `backend/services/subscription_service.py` — pure seat maths + enforcement (`evaluate_state`), `LicenseError`, DB wrappers (`validate_company_license`, `enforce_seat_limit`, `company_usage`), activation email.
- `backend/services/invoice_service.py` — pure line/total/number helpers + `generate_invoice`.
- `backend/schemas/subscription.py` — subscription + licence schemas.
- `backend/schemas/invoice.py` — invoice schemas.
- `backend/routers/subscriptions.py`, `backend/routers/invoices.py` — new routers.
- `backend/tests/test_seat_maths.py`, `backend/tests/test_enforcement.py`, `backend/tests/test_invoice.py`.

**Backend — modify**
- `backend/routers/licenses.py` — rewrite for the new `License` model (grant / revoke / list).
- `backend/services/license_service.py` — **delete** (replaced by `subscription_service.py`).
- `backend/models/license.py` — **delete** (`CompanyLicense` gone, D1).
- `backend/models/__init__.py`, `backend/main.py` — model imports, router mounts.
- `backend/auth/dependencies.py:137-147` — import path change only.
- `backend/routers/auth.py:37-39, 77-78, 207-209` — import path + `role` arg.
- `backend/routers/employees.py:20, 195-198, 450-453, 514-518` — import path, `role` arg, branch on error code.
- `db/init.sql` — append the four tables.

**Frontend — create**
- `frontend/src/types/subscription.ts`, `frontend/src/types/invoice.ts`
- `frontend/src/api/subscriptionApi.ts`, `frontend/src/api/invoiceApi.ts`
- `frontend/src/pages/master/SubscriptionList.tsx`, `SubscriptionDetail.tsx`, `InvoiceList.tsx`, `InvoiceView.tsx`
- `frontend/src/pages/settings/SubscriptionInfo.tsx`
- `frontend/src/components/SeatUsageWidget.tsx`

**Frontend — modify**
- `frontend/src/App.tsx` — routes; `frontend/src/components/Sidebar.tsx` — Billing nav group; `frontend/src/pages/dashboard/Dashboard.tsx` — widget for admin.

**Docs — modify**
- `AGENTS.md` — test framework note, licensing env table; `README.md:64-74` — licensing section.

---

### Task 1: Models, migration, init.sql

**Files:**
- Create: `backend/models/subscription.py`, `backend/models/invoice.py`, `backend/alembic/versions/0031_subscription_licensing.py`
- Delete: `backend/models/license.py`
- Modify: `backend/models/__init__.py`, `backend/main.py:31`, `db/init.sql` (append at end)

**Interfaces:**
- Produces: `Subscription(id, company_id, plan, status, billing_cycle, starts_at, ends_at, unit_price: Numeric(12,2), currency, tax_rate: Numeric(5,2), features, notes, created_at, updated_at)`; `License(id, subscription_id, company_id, site_id, license_key, status, max_users, max_admins, granted_by, granted_at, revoked_by, revoked_at, revoke_reason, created_at, updated_at)`; `Invoice(...)`, `InvoiceLine(...)` per spec §3. `Invoice.lines` relationship (cascade delete-orphan), `License.site` relationship to `WorkLocation`.

- [ ] **Step 1: Create `backend/models/subscription.py`**

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric, Index, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Subscription(Base):
    """Billing envelope for one company. One *active* subscription per company
    (partial unique index); historical cancelled rows are retained."""
    __tablename__ = "subscriptions"

    id            = Column(Integer, primary_key=True, index=True)
    company_id    = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    plan          = Column(String(20), nullable=False, default="basic")      # basic | pro | enterprise
    status        = Column(String(20), nullable=False, default="active")     # trial | active | past_due | suspended | cancelled
    billing_cycle = Column(String(10), nullable=False, default="yearly")     # monthly | yearly
    starts_at     = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ends_at       = Column(DateTime(timezone=True), nullable=True)           # NULL = perpetual
    unit_price    = Column(Numeric(12, 2), nullable=False, default=0)        # per licence per cycle
    currency      = Column(String(3), nullable=False, default="INR")
    tax_rate      = Column(Numeric(5, 2), nullable=False, default=18)        # GST %
    features      = Column(JSONB, nullable=True)                             # NULL = all allowed
    notes         = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    licenses = relationship("License", back_populates="subscription", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ux_subscriptions_one_active_per_company", "company_id", unique=True,
              postgresql_where=text("status <> 'cancelled'")),
    )


class License(Base):
    """One site licence: 26 seats + 1 admin slot (defaults), granted and revoked only by master."""
    __tablename__ = "licenses"

    id              = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    company_id      = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    site_id         = Column(Integer, ForeignKey("work_locations.id", ondelete="SET NULL"), nullable=True)
    license_key     = Column(String(64), nullable=False, unique=True)
    status          = Column(String(20), nullable=False, default="active")   # active | revoked
    max_users       = Column(Integer, nullable=True, default=26)             # NULL = unlimited
    max_admins      = Column(Integer, nullable=False, default=1)
    granted_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    granted_at      = Column(DateTime(timezone=True), server_default=func.now())
    revoked_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    revoked_at      = Column(DateTime(timezone=True), nullable=True)
    revoke_reason   = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    subscription = relationship("Subscription", back_populates="licenses")
    site         = relationship("WorkLocation", foreign_keys=[site_id])

    __table_args__ = (
        Index("ix_licenses_company_status", "company_id", "status"),
    )
```

- [ ] **Step 2: Create `backend/models/invoice.py`**

```python
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id               = Column(Integer, primary_key=True, index=True)
    invoice_number   = Column(String(30), nullable=False, unique=True)      # INV-{YYYY}-{NNNN}
    company_id       = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id  = Column(Integer, ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    period_start     = Column(Date, nullable=False)
    period_end       = Column(Date, nullable=False)
    issue_date       = Column(Date, nullable=False)
    due_date         = Column(Date, nullable=False)
    currency         = Column(String(3), nullable=False, default="INR")
    subtotal         = Column(Numeric(12, 2), nullable=False, default=0)
    tax_rate         = Column(Numeric(5, 2), nullable=False, default=18)
    tax_amount       = Column(Numeric(12, 2), nullable=False, default=0)
    total            = Column(Numeric(12, 2), nullable=False, default=0)
    status           = Column(String(20), nullable=False, default="draft")   # draft | sent | paid | void
    paid_at          = Column(DateTime(timezone=True), nullable=True)
    payment_ref      = Column(String(100), nullable=True)
    billing_snapshot = Column(JSONB, nullable=True)
    created_by       = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan",
                         order_by="InvoiceLine.id")


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id          = Column(Integer, primary_key=True, index=True)
    invoice_id  = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    license_id  = Column(Integer, ForeignKey("licenses.id", ondelete="SET NULL"), nullable=True)
    description = Column(String(255), nullable=False)
    quantity    = Column(Numeric(10, 2), nullable=False, default=1)
    unit_price  = Column(Numeric(12, 2), nullable=False, default=0)
    amount      = Column(Numeric(12, 2), nullable=False, default=0)

    invoice = relationship("Invoice", back_populates="lines")
```

- [ ] **Step 3: Delete `backend/models/license.py` and update imports**

Delete the file. In `backend/models/__init__.py` replace `from models.license import CompanyLicense` with:

```python
from models.subscription import Subscription, License
from models.invoice import Invoice, InvoiceLine
```

In `backend/main.py` replace line `import models.license            # noqa: F401` with:

```python
import models.subscription       # noqa: F401
import models.invoice            # noqa: F401
```

(`main.py` will still fail to import until Task 4 removes the old `licenses` router import; that is expected at this point.)

- [ ] **Step 4: Verify models import**

Run from `backend/`:
```bash
python -c "import models; from models import Subscription, License, Invoice, InvoiceLine; print('ok')"
```
Expected: `ok`

- [ ] **Step 5: Write the migration `backend/alembic/versions/0031_subscription_licensing.py`**

```python
"""Subscriptions, site licences and invoices (replaces company_licenses).

Revision ID: 0031_subscription_licensing
Revises: 0030_geofence_exit_alerts
Create Date: 2026-09-12
"""
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.dialects.postgresql import JSONB

revision = "0031_subscription_licensing"
down_revision = "0030_geofence_exit_alerts"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    return sa_inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _table_exists("subscriptions"):
        op.create_table(
            "subscriptions",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("plan", sa.String(20), nullable=False, server_default="basic"),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("billing_cycle", sa.String(10), nullable=False, server_default="yearly"),
            sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("unit_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
            sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="18"),
            sa.Column("features", JSONB, nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_subscriptions_company_id", "subscriptions", ["company_id"])
        op.execute(
            "CREATE UNIQUE INDEX ux_subscriptions_one_active_per_company "
            "ON subscriptions (company_id) WHERE status <> 'cancelled'"
        )

    if not _table_exists("licenses"):
        op.create_table(
            "licenses",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("subscription_id", sa.Integer, sa.ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("site_id", sa.Integer, sa.ForeignKey("work_locations.id", ondelete="SET NULL"), nullable=True),
            sa.Column("license_key", sa.String(64), nullable=False, unique=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("max_users", sa.Integer, nullable=True, server_default="26"),
            sa.Column("max_admins", sa.Integer, nullable=False, server_default="1"),
            sa.Column("granted_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("revoked_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("revoke_reason", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_licenses_company_status", "licenses", ["company_id", "status"])

    if not _table_exists("invoices"):
        op.create_table(
            "invoices",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("invoice_number", sa.String(30), nullable=False, unique=True),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("subscription_id", sa.Integer, sa.ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True),
            sa.Column("period_start", sa.Date, nullable=False),
            sa.Column("period_end", sa.Date, nullable=False),
            sa.Column("issue_date", sa.Date, nullable=False),
            sa.Column("due_date", sa.Date, nullable=False),
            sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
            sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="18"),
            sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("total", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("payment_ref", sa.String(100), nullable=True),
            sa.Column("billing_snapshot", JSONB, nullable=True),
            sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_invoices_company_id", "invoices", ["company_id"])

    if not _table_exists("invoice_lines"):
        op.create_table(
            "invoice_lines",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
            sa.Column("license_id", sa.Integer, sa.ForeignKey("licenses.id", ondelete="SET NULL"), nullable=True),
            sa.Column("description", sa.String(255), nullable=False),
            sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
            sa.Column("unit_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        )
        op.create_index("ix_invoice_lines_invoice_id", "invoice_lines", ["invoice_id"])

    # ── Data migration: one subscription + one company-wide licence per legacy row ──
    if _table_exists("company_licenses"):
        conn = op.get_bind()
        rows = conn.execute(sa.text(
            "SELECT cl.id, cl.company_id, cl.license_key, cl.tier, cl.status, cl.max_seats, "
            "cl.valid_from, cl.valid_until, cl.features, cl.notes, COALESCE(c.currency, 'INR') AS currency "
            "FROM company_licenses cl JOIN companies c ON c.id = cl.company_id"
        )).mappings().all()
        for r in rows:
            sub_status = "active" if r["status"] == "active" else "suspended"
            sub_id = conn.execute(sa.text(
                "INSERT INTO subscriptions (company_id, plan, status, billing_cycle, starts_at, ends_at, "
                "unit_price, currency, tax_rate, features, notes) "
                "VALUES (:company_id, :plan, :status, 'yearly', COALESCE(:starts_at, now()), :ends_at, "
                "0, :currency, 18, CAST(:features AS jsonb), :notes) RETURNING id"
            ), {
                "company_id": r["company_id"], "plan": r["tier"] or "basic", "status": sub_status,
                "starts_at": r["valid_from"], "ends_at": r["valid_until"],
                "currency": (r["currency"] or "INR")[:3],
                "features": None if r["features"] is None else json.dumps(r["features"]),
                "notes": r["notes"],
            }).scalar_one()
            conn.execute(sa.text(
                "INSERT INTO licenses (subscription_id, company_id, site_id, license_key, status, max_users, max_admins, granted_at) "
                "VALUES (:sub_id, :company_id, NULL, :key, :status, :max_users, 1, COALESCE(:granted_at, now()))"
            ), {
                "sub_id": sub_id, "company_id": r["company_id"], "key": r["license_key"],
                "status": "active" if r["status"] == "active" else "revoked",
                "max_users": r["max_seats"],           # NULL stays NULL = unlimited
                "granted_at": r["valid_from"],
            })
        op.drop_table("company_licenses")
```

- [ ] **Step 6: Write the downgrade in the same file**

```python
def downgrade() -> None:
    if not _table_exists("company_licenses"):
        op.create_table(
            "company_licenses",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("license_key", sa.String(64), nullable=False, unique=True),
            sa.Column("tier", sa.String(20), nullable=False, server_default="basic"),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("max_seats", sa.Integer, nullable=True),
            sa.Column("valid_from", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("features", JSONB, nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    if _table_exists("subscriptions"):
        # First non-cancelled subscription per company, with its first active licence (or any licence).
        op.execute(sa.text("""
            INSERT INTO company_licenses (company_id, license_key, tier, status, max_seats, valid_from, valid_until, features, notes)
            SELECT DISTINCT ON (s.company_id)
                   s.company_id,
                   COALESCE(l.license_key, md5(random()::text)),
                   s.plan,
                   CASE WHEN s.status IN ('trial','active') THEN 'active' ELSE 'suspended' END,
                   l.max_users,
                   s.starts_at, s.ends_at, s.features, s.notes
            FROM subscriptions s
            LEFT JOIN licenses l ON l.subscription_id = s.id
            WHERE s.status <> 'cancelled'
            ORDER BY s.company_id, (l.status = 'active') DESC, l.id
        """))
    for name in ("invoice_lines", "invoices", "licenses", "subscriptions"):
        if _table_exists(name):
            op.drop_table(name)
```

- [ ] **Step 7: Append the four tables to `db/init.sql`**

Append at the end of the file:

```sql

-- ================================================================
-- SUBSCRIPTIONS, SITE LICENCES, INVOICES
-- ================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan            VARCHAR(20) NOT NULL DEFAULT 'basic',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    billing_cycle   VARCHAR(10) NOT NULL DEFAULT 'yearly',
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at         TIMESTAMPTZ,
    unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 18,
    features        JSONB,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_subscriptions_company_id ON subscriptions(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_subscriptions_one_active_per_company
    ON subscriptions(company_id) WHERE status <> 'cancelled';

CREATE TABLE IF NOT EXISTS licenses (
    id              SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    site_id         INTEGER REFERENCES work_locations(id) ON DELETE SET NULL,
    license_key     VARCHAR(64) NOT NULL UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    max_users       INTEGER DEFAULT 26,
    max_admins      INTEGER NOT NULL DEFAULT 1,
    granted_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    granted_at      TIMESTAMPTZ DEFAULT now(),
    revoked_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    revoked_at      TIMESTAMPTZ,
    revoke_reason   TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_licenses_company_status ON licenses(company_id, status);

CREATE TABLE IF NOT EXISTS invoices (
    id               SERIAL PRIMARY KEY,
    invoice_number   VARCHAR(30) NOT NULL UNIQUE,
    company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    subscription_id  INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    issue_date       DATE NOT NULL,
    due_date         DATE NOT NULL,
    currency         VARCHAR(3) NOT NULL DEFAULT 'INR',
    subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 18,
    tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
    total            NUMERIC(12,2) NOT NULL DEFAULT 0,
    status           VARCHAR(20) NOT NULL DEFAULT 'draft',
    paid_at          TIMESTAMPTZ,
    payment_ref      VARCHAR(100),
    billing_snapshot JSONB,
    created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_invoices_company_id ON invoices(company_id);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id          SERIAL PRIMARY KEY,
    invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    license_id  INTEGER REFERENCES licenses(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount      NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_invoice_lines_invoice_id ON invoice_lines(invoice_id);
```

- [ ] **Step 8: Verify the migration compiles and has a single head**

Run from `backend/`:
```bash
python -c "import ast,sys; ast.parse(open('alembic/versions/0031_subscription_licensing.py').read()); print('syntax ok')"
python -c "from alembic.config import Config; from alembic.script import ScriptDirectory; s=ScriptDirectory.from_config(Config('alembic.ini')); print(s.get_heads())"
```
Expected: `syntax ok` and `['0031_subscription_licensing']`.

- [ ] **Step 9: Commit**

```bash
git add backend/models/subscription.py backend/models/invoice.py backend/models/__init__.py backend/main.py backend/alembic/versions/0031_subscription_licensing.py db/init.sql
git rm -q backend/models/license.py
git commit -m "feat(licensing): subscriptions, site licences and invoice tables with data migration" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pure seat maths in `subscription_service.py`

**Files:**
- Create: `backend/services/subscription_service.py`
- Test: `backend/tests/test_seat_maths.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) LicenseSpec(id: int | None, status: str, max_users: int | None, max_admins: int)`
  - `@dataclass(frozen=True) Capacity(seats: int | None, admins: int, active_licenses: int)`  (`seats=None` = unlimited)
  - `compute_capacity(licenses: Sequence[LicenseSpec]) -> Capacity`
  - `count_seats(users: Sequence[tuple[str, bool | None]]) -> tuple[int, int]` → `(seats_used, admins_used)` from `(role, is_active)` pairs.

- [ ] **Step 1: Write the failing tests `backend/tests/test_seat_maths.py`**

```python
from services.subscription_service import LicenseSpec, compute_capacity, count_seats


def lic(max_users=26, max_admins=1, status="active", id=None):
    return LicenseSpec(id=id, status=status, max_users=max_users, max_admins=max_admins)


def test_capacity_one_licence():
    c = compute_capacity([lic()])
    assert (c.seats, c.admins, c.active_licenses) == (26, 1, 1)


def test_capacity_two_and_three_licences_sum():
    assert compute_capacity([lic(), lic()]).seats == 52
    c = compute_capacity([lic(), lic(), lic()])
    assert (c.seats, c.admins, c.active_licenses) == (78, 3, 3)


def test_unlimited_when_any_licence_has_null_max_users():
    c = compute_capacity([lic(), lic(max_users=None)])
    assert c.seats is None
    assert c.admins == 2


def test_revoked_licences_excluded():
    c = compute_capacity([lic(), lic(status="revoked"), lic(status="revoked", max_users=None)])
    assert (c.seats, c.admins, c.active_licenses) == (26, 1, 1)


def test_no_licences_is_zero_capacity():
    c = compute_capacity([])
    assert (c.seats, c.admins, c.active_licenses) == (0, 0, 0)


def test_count_seats_master_never_consumes_and_null_active_counts():
    users = [("master", True), ("admin", True), ("admin", None), ("worker", None), ("worker", False), ("supervisor", True)]
    seats, admins = count_seats(users)
    assert seats == 4      # admin, admin(NULL), worker(NULL), supervisor
    assert admins == 2
```

- [ ] **Step 2: Run to verify failure**

Run from `backend/`: `python -m pytest tests/test_seat_maths.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'services.subscription_service'`

- [ ] **Step 3: Create `backend/services/subscription_service.py` with the pure helpers**

```python
"""Subscription validity, seat capacity and enforcement.

Pure helpers (``compute_capacity``, ``count_seats``, ``evaluate_state``) carry
the decision logic and are unit-tested without a database. The DB-backed
wrappers at the bottom load rows and delegate to them.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Sequence

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config.settings import settings
from models.company import Company
from models.subscription import License, Subscription
from models.user import User

logger = logging.getLogger(__name__)

# ── Pure helpers ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class LicenseSpec:
    id: int | None
    status: str                # active | revoked
    max_users: int | None      # None = unlimited
    max_admins: int


@dataclass(frozen=True)
class Capacity:
    seats: int | None          # None = unlimited
    admins: int
    active_licenses: int


def compute_capacity(licenses: Sequence[LicenseSpec]) -> Capacity:
    """Company-wide pool (D2): sum of active licences. Any unlimited licence makes the pool unlimited."""
    active = [l for l in licenses if l.status == "active"]
    if not active:
        return Capacity(seats=0, admins=0, active_licenses=0)
    unlimited = any(l.max_users is None for l in active)
    seats = None if unlimited else sum(int(l.max_users) for l in active)
    return Capacity(seats=seats, admins=sum(int(l.max_admins) for l in active), active_licenses=len(active))


def count_seats(users: Sequence[tuple[str, bool | None]]) -> tuple[int, int]:
    """(seats_used, admins_used) from (role, is_active) pairs. master never consumes a seat;
    is_active NULL counts as active (matches the legacy behaviour)."""
    seats = admins = 0
    for role, is_active in users:
        if role == "master" or is_active is False:
            continue
        seats += 1
        if role == "admin":
            admins += 1
    return seats, admins
```

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/test_seat_maths.py -q`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/services/subscription_service.py backend/tests/test_seat_maths.py
git commit -m "feat(licensing): pure seat capacity maths" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Enforcement (`evaluate_state`), `LicenseError`, DB wrappers

**Files:**
- Modify: `backend/services/subscription_service.py`
- Test: `backend/tests/test_enforcement.py`

**Interfaces:**
- Produces:
  - Reason codes: `NO_SUBSCRIPTION`, `SUSPENDED`, `EXPIRED`, `NO_LICENSE`, `SEAT_LIMIT`, `ADMIN_LIMIT` (module constants, values equal their names) and `REASON_MESSAGES: dict[str, str]`.
  - `@dataclass(frozen=True) SubscriptionSpec(status: str, ends_at: datetime | None)`
  - `@dataclass(frozen=True) Denial(code: str, message: str)`
  - `evaluate_state(subscription, licenses, seats_used, admins_used, *, bypass, check_seats=False, role=None, now=None) -> Denial | None`
  - `class LicenseError(HTTPException)` with `.code: str`; `status_code=403`, `detail=message`.
  - `is_capacity_error(exc: BaseException) -> bool`
  - `license_bypass_active() -> bool`
  - `@dataclass CompanyUsage(subscription, capacity: Capacity, seats_used, admins_used, licenses: list[License])`
  - `load_company_usage(db, company_id) -> CompanyUsage`
  - `evaluate_company(db, company_id, *, check_seats=False, role=None) -> tuple[CompanyUsage, Denial | None]`
  - `validate_company_license(db, company_id) -> Optional[Subscription]` (raises `LicenseError`)
  - `enforce_seat_limit(db, company_id, role) -> None` (raises `LicenseError`)
  - `has_feature(subscription, key) -> bool`
  - `send_subscription_activated_email(db, subscription, company=None) -> bool`

- [ ] **Step 1: Write the failing tests `backend/tests/test_enforcement.py`**

```python
from datetime import datetime, timedelta, timezone

from services.subscription_service import (
    ADMIN_LIMIT, EXPIRED, NO_LICENSE, NO_SUBSCRIPTION, SEAT_LIMIT, SUSPENDED,
    LicenseSpec, SubscriptionSpec, LicenseError, evaluate_state, is_capacity_error,
)

NOW = datetime(2026, 9, 12, tzinfo=timezone.utc)
ACTIVE = SubscriptionSpec(status="active", ends_at=None)
THREE = [LicenseSpec(id=i, status="active", max_users=26, max_admins=1) for i in range(3)]


def test_valid_active_subscription_with_licences():
    assert evaluate_state(ACTIVE, THREE, 10, 1, bypass=False, now=NOW) is None


def test_missing_subscription():
    assert evaluate_state(None, [], 0, 0, bypass=False, now=NOW).code == NO_SUBSCRIPTION


def test_suspended_and_cancelled_block_but_trial_allowed():
    assert evaluate_state(SubscriptionSpec("suspended", None), THREE, 0, 0, bypass=False, now=NOW).code == SUSPENDED
    assert evaluate_state(SubscriptionSpec("cancelled", None), THREE, 0, 0, bypass=False, now=NOW).code == SUSPENDED
    assert evaluate_state(SubscriptionSpec("trial", None), THREE, 0, 0, bypass=False, now=NOW) is None


def test_expired_subscription():
    sub = SubscriptionSpec("active", ends_at=NOW - timedelta(days=1))
    assert evaluate_state(sub, THREE, 0, 0, bypass=False, now=NOW).code == EXPIRED


def test_naive_ends_at_is_treated_as_utc():
    sub = SubscriptionSpec("active", ends_at=datetime(2026, 9, 11))
    assert evaluate_state(sub, THREE, 0, 0, bypass=False, now=NOW).code == EXPIRED


def test_zero_active_licences_blocks():
    revoked = [LicenseSpec(id=1, status="revoked", max_users=26, max_admins=1)]
    assert evaluate_state(ACTIVE, revoked, 0, 0, bypass=False, now=NOW).code == NO_LICENSE


def test_seat_limit_only_when_check_seats():
    assert evaluate_state(ACTIVE, THREE, 78, 1, bypass=False, now=NOW) is None          # login/per-request: ok
    d = evaluate_state(ACTIVE, THREE, 78, 1, bypass=False, check_seats=True, role="worker", now=NOW)
    assert d.code == SEAT_LIMIT
    assert d.message == "Seat limit exceeded (78/78)"


def test_admin_limit_while_seats_remain():
    d = evaluate_state(ACTIVE, THREE, 10, 3, bypass=False, check_seats=True, role="admin", now=NOW)
    assert d.code == ADMIN_LIMIT
    assert d.message == "Admin limit exceeded (3/3)"
    assert evaluate_state(ACTIVE, THREE, 10, 3, bypass=False, check_seats=True, role="worker", now=NOW) is None


def test_unlimited_licence_never_hits_seat_limit_but_admin_cap_still_applies():
    lics = [LicenseSpec(id=1, status="active", max_users=None, max_admins=1)]
    assert evaluate_state(ACTIVE, lics, 5000, 0, bypass=False, check_seats=True, role="worker", now=NOW) is None
    assert evaluate_state(ACTIVE, lics, 5000, 1, bypass=False, check_seats=True, role="admin", now=NOW).code == ADMIN_LIMIT


def test_bypass_skips_validity_but_still_enforces_caps():
    expired = SubscriptionSpec("suspended", ends_at=NOW - timedelta(days=30))
    assert evaluate_state(expired, THREE, 0, 0, bypass=True, now=NOW) is None
    d = evaluate_state(expired, THREE, 78, 0, bypass=True, check_seats=True, role="worker", now=NOW)
    assert d.code == SEAT_LIMIT
    d = evaluate_state(expired, THREE, 0, 3, bypass=True, check_seats=True, role="admin", now=NOW)
    assert d.code == ADMIN_LIMIT


def test_bypass_with_no_subscription_and_no_licences_is_unmetered():
    assert evaluate_state(None, [], 500, 40, bypass=True, check_seats=True, role="admin", now=NOW) is None


def test_bypass_with_subscription_but_no_licences_is_metered_to_zero():
    d = evaluate_state(ACTIVE, [], 0, 0, bypass=True, check_seats=True, role="worker", now=NOW)
    assert d.code == SEAT_LIMIT
    assert d.message == "Seat limit exceeded (0/0)"


def test_soft_revoke_keeps_existing_users_but_blocks_next_create():
    two = THREE[:2]   # one licence revoked → 52 seats, 60 users already exist
    assert evaluate_state(ACTIVE, two, 60, 2, bypass=False, now=NOW) is None
    assert evaluate_state(ACTIVE, two, 60, 2, bypass=False, check_seats=True, role="worker", now=NOW).code == SEAT_LIMIT


def test_license_error_carries_code_and_403():
    err = LicenseError(SEAT_LIMIT, "Seat limit exceeded (78/78)")
    assert err.status_code == 403 and err.detail == "Seat limit exceeded (78/78)" and err.code == SEAT_LIMIT
    assert is_capacity_error(err)
    assert not is_capacity_error(LicenseError(EXPIRED, "x"))
    assert not is_capacity_error(ValueError("Seat limit exceeded (78/78)"))
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_enforcement.py -q`
Expected: FAIL with `ImportError: cannot import name 'ADMIN_LIMIT'`

- [ ] **Step 3: Add the enforcement code to `backend/services/subscription_service.py`** (append after `count_seats`)

```python
# ── Reason codes ─────────────────────────────────────────────────────────────

NO_SUBSCRIPTION = "NO_SUBSCRIPTION"
SUSPENDED       = "SUSPENDED"
EXPIRED         = "EXPIRED"
NO_LICENSE      = "NO_LICENSE"
SEAT_LIMIT      = "SEAT_LIMIT"
ADMIN_LIMIT     = "ADMIN_LIMIT"

REASON_MESSAGES = {
    NO_SUBSCRIPTION: "No subscription for this company",
    SUSPENDED:       "Subscription suspended",
    EXPIRED:         "Subscription expired",
    NO_LICENSE:      "No active licence for this company",
    SEAT_LIMIT:      "Seat limit exceeded",
    ADMIN_LIMIT:     "Admin limit exceeded",
}

VALID_SUBSCRIPTION_STATUSES = ("trial", "active")


@dataclass(frozen=True)
class SubscriptionSpec:
    status: str
    ends_at: datetime | None


@dataclass(frozen=True)
class Denial:
    code: str
    message: str


class LicenseError(HTTPException):
    """403 with a machine-readable ``code`` so callers (bulk import) never match on text."""
    def __init__(self, code: str, message: str):
        super().__init__(status_code=403, detail=message)
        self.code = code


def is_capacity_error(exc: BaseException) -> bool:
    return isinstance(exc, LicenseError) and exc.code in (SEAT_LIMIT, ADMIN_LIMIT)


def license_bypass_active() -> bool:
    """LICENSE_ENFORCE=false or a static LICENSE_KEY: validity checks are skipped (D7)."""
    return (not settings.license_enforce) or settings.has_static_license


def _is_expired(ends_at: datetime | None, now: datetime) -> bool:
    if ends_at is None:
        return False
    if ends_at.tzinfo is None:
        ends_at = ends_at.replace(tzinfo=timezone.utc)
    return now > ends_at


def evaluate_state(
    subscription: SubscriptionSpec | None,
    licenses: Sequence[LicenseSpec],
    seats_used: int,
    admins_used: int,
    *,
    bypass: bool,
    check_seats: bool = False,
    role: str | None = None,
    now: datetime | None = None,
) -> Denial | None:
    """Spec §4. Returns None when allowed, else the first Denial."""
    now = now or datetime.now(timezone.utc)
    cap = compute_capacity(licenses)

    if not bypass:
        if subscription is None:
            return Denial(NO_SUBSCRIPTION, REASON_MESSAGES[NO_SUBSCRIPTION])
        if subscription.status not in VALID_SUBSCRIPTION_STATUSES:
            return Denial(SUSPENDED, REASON_MESSAGES[SUSPENDED])
        if _is_expired(subscription.ends_at, now):
            return Denial(EXPIRED, REASON_MESSAGES[EXPIRED])
        if cap.active_licenses == 0:
            return Denial(NO_LICENSE, REASON_MESSAGES[NO_LICENSE])

    if not check_seats:
        return None
    # Nothing to meter against: bypassed company with no subscription and no licences at all.
    if bypass and subscription is None and not licenses:
        return None
    if cap.seats is not None and seats_used >= cap.seats:
        return Denial(SEAT_LIMIT, f"{REASON_MESSAGES[SEAT_LIMIT]} ({seats_used}/{cap.seats})")
    if role == "admin" and admins_used >= cap.admins:
        return Denial(ADMIN_LIMIT, f"{REASON_MESSAGES[ADMIN_LIMIT]} ({admins_used}/{cap.admins})")
    return None
```

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/test_enforcement.py tests/test_seat_maths.py -q`
Expected: `20 passed`

- [ ] **Step 5: Add the DB-backed wrappers and the activation email** (append to the same file)

```python
# ── DB-backed wrappers ───────────────────────────────────────────────────────

@dataclass
class CompanyUsage:
    subscription: Subscription | None
    licenses: list[License]
    capacity: Capacity
    seats_used: int
    admins_used: int


def get_subscription(db: Session, company_id: int) -> Subscription | None:
    """The company's current (non-cancelled) subscription, if any."""
    return (
        db.query(Subscription)
        .filter(Subscription.company_id == company_id, Subscription.status != "cancelled")
        .order_by(Subscription.id.desc())
        .first()
    )


def load_company_usage(db: Session, company_id: int) -> CompanyUsage:
    sub = get_subscription(db, company_id)
    lic_rows = db.query(License).filter(License.company_id == company_id).order_by(License.id).all()
    specs = [LicenseSpec(id=l.id, status=l.status, max_users=l.max_users, max_admins=l.max_admins) for l in lic_rows]
    users = db.query(User.role, User.is_active).filter(User.company_id == company_id).all()
    seats_used, admins_used = count_seats([(r, a) for r, a in users])
    return CompanyUsage(subscription=sub, licenses=lic_rows, capacity=compute_capacity(specs),
                        seats_used=seats_used, admins_used=admins_used)


def evaluate_company(
    db: Session, company_id: int, *, check_seats: bool = False, role: str | None = None
) -> tuple[CompanyUsage, Denial | None]:
    usage = load_company_usage(db, company_id)
    sub_spec = None
    if usage.subscription is not None:
        sub_spec = SubscriptionSpec(status=usage.subscription.status, ends_at=usage.subscription.ends_at)
    specs = [LicenseSpec(id=l.id, status=l.status, max_users=l.max_users, max_admins=l.max_admins)
             for l in usage.licenses]
    denial = evaluate_state(sub_spec, specs, usage.seats_used, usage.admins_used,
                            bypass=license_bypass_active(), check_seats=check_seats, role=role)
    return usage, denial


def validate_company_license(db: Session, company_id: int) -> Optional[Subscription]:
    """Raise LicenseError(403) when the company's subscription is missing / suspended /
    expired / has no active licence. Returns the subscription (None under bypass)."""
    usage, denial = evaluate_company(db, company_id)
    if denial:
        raise LicenseError(denial.code, denial.message)
    return usage.subscription


def enforce_seat_limit(db: Session, company_id: int, role: str) -> None:
    """Raise LicenseError(403) when adding a user with ``role`` would exceed the seat
    or admin cap (validity problems surface first, unless bypassed)."""
    _, denial = evaluate_company(db, company_id, check_seats=True, role=role)
    if denial:
        raise LicenseError(denial.code, denial.message)


def has_feature(subscription: Subscription | None, key: str) -> bool:
    if license_bypass_active():
        return True
    if subscription is None:
        return False
    if not subscription.features:
        return True
    return bool(subscription.features.get(key, False))


def _recipients(db: Session, company: Company) -> list[str]:
    emails: set[str] = set()
    if company.email:
        emails.add(company.email)
    contacts = (
        db.query(User.email)
        .filter(User.company_id == company.id, User.role.in_(("admin", "supervisor")),
                User.email.isnot(None), User.is_active.isnot(False))
        .all()
    )
    emails.update(e for (e,) in contacts if e)
    return sorted(emails)


def send_subscription_activated_email(
    db: Session, subscription: Subscription, company: Company | None = None
) -> bool:
    """Best-effort notification; never raises."""
    from services.email_service import send_email
    try:
        if company is None:
            company = db.query(Company).filter(Company.id == subscription.company_id).first()
        if not company:
            return False
        recipients = _recipients(db, company)
        if not recipients:
            return False
        usage = load_company_usage(db, company.id)
        seats = "Unlimited" if usage.capacity.seats is None else str(usage.capacity.seats)
        ends = subscription.ends_at.strftime("%Y-%m-%d") if subscription.ends_at else "No expiry"
        html = f"""\
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
          <h2 style="color:#0d6efd;margin:0 0 12px;">Your subscription is active</h2>
          <p>Hello {company.name} team,</p>
          <table style="border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Plan</td><td style="text-transform:capitalize;">{subscription.plan}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Licences</td><td>{usage.capacity.active_licenses}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Seats</td><td>{seats}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#666;">Valid until</td><td>{ends}</td></tr>
          </table>
          <p style="color:#888;font-size:12px;">This is an automated message; please do not reply.</p>
        </div>"""
        return send_email(recipients, f"Subscription Activated — {company.name}", html)
    except Exception as e:
        logger.error("Failed to send subscription-activated email: %s", e)
        return False
```

- [ ] **Step 6: Verify the module imports and tests still pass**

Run: `python -c "import services.subscription_service as s; print(s.enforce_seat_limit.__name__)" && python -m pytest tests -q`
Expected: `enforce_seat_limit` and all tests pass (`28 passed` including the 8 geofence tests).

- [ ] **Step 7: Commit**

```bash
git add backend/services/subscription_service.py backend/tests/test_enforcement.py
git commit -m "feat(licensing): subscription enforcement with typed LicenseError and D7 bypass rules" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Rewire call sites, delete the legacy service, temporary router removal

**Files:**
- Delete: `backend/services/license_service.py`
- Modify: `backend/auth/dependencies.py:137-147`, `backend/routers/auth.py:14-20 (imports), 37-39, 77-78, 207-209`, `backend/routers/employees.py:20, 195-198, 450-453, 514-518`, `backend/main.py:9, 102`

**Interfaces:**
- Consumes: `validate_company_license`, `enforce_seat_limit(db, company_id, role)`, `is_capacity_error` from Task 3.

- [ ] **Step 1: Delete `backend/services/license_service.py`**

```bash
git rm -q backend/services/license_service.py
```

- [ ] **Step 2: Update `backend/auth/dependencies.py`**

In `require_valid_license` change the lazy import line to:

```python
    from services.subscription_service import validate_company_license
```

- [ ] **Step 3: Update `backend/routers/auth.py`**

Find the import of `validate_company_license, enforce_seat_limit` from `services.license_service` (grep `license_service` in the file) and change it to:

```python
from services.subscription_service import validate_company_license, enforce_seat_limit
```

At the user-creation call (`if payload.role != "master": enforce_seat_limit(db, company_id)`), pass the role:

```python
    if payload.role != "master":
        enforce_seat_limit(db, company_id, payload.role)
```

Login call sites (`validate_company_license(db, user.company_id)`) are unchanged.

- [ ] **Step 4: Update `backend/routers/employees.py`**

Replace line 20:

```python
from services.subscription_service import enforce_seat_limit, is_capacity_error
```

In `_persist_employee` (around line 195):

```python
    if company_id is not None:
        enforce_seat_limit(db, company_id, role)
```

In the bulk import fail-fast (around line 452) — bulk import only creates workers:

```python
    if current_user.company_id is not None:
        enforce_seat_limit(db, current_user.company_id, "worker")
```

In the import loop's `except HTTPException as he:` branch (around line 515) replace the string comparison:

```python
        except HTTPException as he:
            db.rollback()
            if is_capacity_error(he):
                errors.append({"row": idx, "error": f"{he.detail} — this and all remaining rows were skipped"})
                break
            errors.append({"row": idx, "error": str(he.detail)})
```

- [ ] **Step 5: Temporarily unmount the legacy licences router in `backend/main.py`**

Change line 9 to `from routers import payslip_templates, geofence` and delete the line `app.include_router(licenses.router, prefix="/api/licenses", tags=["Licenses"])`. (Task 6 rewrites `routers/licenses.py` and re-mounts it.)

- [ ] **Step 6: Verify nothing references the old module and the app imports**

Run from `backend/`:
```bash
grep -rn "license_service\|CompanyLicense\|models.license\b" --include=*.py . ; echo "grep exit $?"
python -c "import os; os.environ.setdefault('DATABASE_URL','sqlite:///./_chk.db'); import main; print('app ok')"; rm -f _chk.db
python -m pytest tests -q
```
Expected: only `routers/licenses.py` matches (rewritten in Task 5). `import main` fails until that file stops importing `models.license`, so replace its whole content now with this stub (Task 5 overwrites it):

```python
from fastapi import APIRouter
router = APIRouter()
```

Tests: `28 passed`.

- [ ] **Step 7: Commit**

```bash
git add -A backend/auth backend/routers/auth.py backend/routers/employees.py backend/routers/licenses.py backend/main.py backend/services
git commit -m "refactor(licensing): route seat and validity checks through subscription_service" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Subscription + licence schemas and routers

**Files:**
- Create: `backend/schemas/subscription.py`, `backend/routers/subscriptions.py`
- Modify: `backend/routers/licenses.py` (full rewrite), `backend/main.py` (mount both routers)

**Interfaces:**
- Consumes: `load_company_usage`, `evaluate_company`, `get_subscription`, `send_subscription_activated_email`, `Capacity` from Task 3; `Subscription`, `License` from Task 1.
- Produces (HTTP, consumed by the frontend in Task 8):
  - `SubscriptionResponse` = columns + `company_name`, `capacity: int|null`, `admin_cap`, `seats_used`, `admins_used`, `active_licenses`, `is_valid`, `reason_code`, `reason`.
  - `MySubscriptionResponse` = `SubscriptionResponse` + `licenses: list[LicenseResponse]`, `days_to_renewal: int|null`.
  - `LicenseResponse` = columns + `site_name`.
  - Routes exactly as spec §5.

- [ ] **Step 1: Create `backend/schemas/subscription.py`**

```python
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

Plan = Literal["basic", "pro", "enterprise"]
SubscriptionStatus = Literal["trial", "active", "past_due", "suspended", "cancelled"]
BillingCycle = Literal["monthly", "yearly"]


class SubscriptionCreate(BaseModel):
    company_id:    int
    plan:          Plan = "basic"
    status:        SubscriptionStatus = "active"
    billing_cycle: BillingCycle = "yearly"
    starts_at:     Optional[datetime] = None
    ends_at:       Optional[datetime] = None
    unit_price:    Decimal = Field(Decimal("0"), ge=0)
    currency:      Optional[str] = Field(None, min_length=3, max_length=3)   # None → company currency
    tax_rate:      Decimal = Field(Decimal("18.00"), ge=0, le=100)
    features:      Optional[dict] = None
    notes:         Optional[str] = None
    # Convenience: grant this many company-wide licences on creation.
    initial_licenses: int = Field(0, ge=0, le=100)


class SubscriptionUpdate(BaseModel):
    plan:          Optional[Plan] = None
    status:        Optional[SubscriptionStatus] = None
    billing_cycle: Optional[BillingCycle] = None
    starts_at:     Optional[datetime] = None
    ends_at:       Optional[datetime] = None
    unit_price:    Optional[Decimal] = Field(None, ge=0)
    currency:      Optional[str] = Field(None, min_length=3, max_length=3)
    tax_rate:      Optional[Decimal] = Field(None, ge=0, le=100)
    features:      Optional[dict] = None
    notes:         Optional[str] = None


class LicenseGrant(BaseModel):
    subscription_id: int
    site_id:         Optional[int] = None
    quantity:        int = Field(1, ge=1, le=100)
    max_users:       Optional[int] = Field(26, ge=1)     # explicit null = unlimited
    max_admins:      int = Field(1, ge=0)
    unlimited:       bool = False                        # True → max_users stored as NULL


class LicenseRevoke(BaseModel):
    reason: Optional[str] = None


class LicenseResponse(BaseModel):
    id:              int
    subscription_id: int
    company_id:      int
    site_id:         Optional[int] = None
    site_name:       Optional[str] = None
    license_key:     str
    status:          str
    max_users:       Optional[int] = None
    max_admins:      int
    granted_by:      Optional[int] = None
    granted_at:      Optional[datetime] = None
    revoked_by:      Optional[int] = None
    revoked_at:      Optional[datetime] = None
    revoke_reason:   Optional[str] = None
    created_at:      Optional[datetime] = None

    model_config = {"from_attributes": True}


class SubscriptionResponse(BaseModel):
    id:            int
    company_id:    int
    company_name:  Optional[str] = None
    plan:          str
    status:        str
    billing_cycle: str
    starts_at:     Optional[datetime] = None
    ends_at:       Optional[datetime] = None
    unit_price:    Decimal
    currency:      str
    tax_rate:      Decimal
    features:      Optional[dict] = None
    notes:         Optional[str] = None
    created_at:    Optional[datetime] = None
    updated_at:    Optional[datetime] = None

    # Derived
    capacity:        Optional[int] = None     # None = unlimited
    admin_cap:       int = 0
    seats_used:      int = 0
    admins_used:     int = 0
    active_licenses: int = 0
    is_valid:        bool = True
    reason_code:     Optional[str] = None
    reason:          Optional[str] = None

    model_config = {"from_attributes": True}


class MySubscriptionResponse(SubscriptionResponse):
    licenses:        list[LicenseResponse] = []
    days_to_renewal: Optional[int] = None
```

- [ ] **Step 2: Create `backend/routers/subscriptions.py`**

```python
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth.dependencies import require_admin, require_master
from database import get_db
from models.company import Company
from models.rbac import AuditLog
from models.subscription import License, Subscription
from models.user import User
from models.work_location import WorkLocation
from schemas.subscription import (
    LicenseResponse, MySubscriptionResponse, SubscriptionCreate, SubscriptionResponse, SubscriptionUpdate,
)
from services.subscription_service import (
    evaluate_company, get_subscription, send_subscription_activated_email,
)
import secrets

router = APIRouter()


def _audit(db: Session, user: User, company_id: int, action: str, entity_type: str, entity_id: int, details: str) -> None:
    db.add(AuditLog(user_id=user.id, company_id=company_id, action=action,
                    entity_type=entity_type, entity_id=entity_id, details=details))


def license_to_response(lic: License) -> LicenseResponse:
    resp = LicenseResponse.model_validate(lic)
    resp.site_name = lic.site.location_name if lic.site else None
    return resp


def subscription_to_response(db: Session, sub: Subscription, company: Company | None = None) -> SubscriptionResponse:
    usage, denial = evaluate_company(db, sub.company_id)
    resp = SubscriptionResponse.model_validate(sub)
    company = company or db.query(Company).filter(Company.id == sub.company_id).first()
    resp.company_name = company.name if company else None
    resp.capacity = usage.capacity.seats
    resp.admin_cap = usage.capacity.admins
    resp.seats_used = usage.seats_used
    resp.admins_used = usage.admins_used
    resp.active_licenses = usage.capacity.active_licenses
    resp.is_valid = denial is None
    resp.reason_code = denial.code if denial else None
    resp.reason = denial.message if denial else None
    return resp


def _get_or_404(db: Session, subscription_id: int) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub


@router.get("", response_model=list[SubscriptionResponse])
def list_subscriptions(
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(Subscription, Company).join(Company, Company.id == Subscription.company_id)
    if current_user.role != "master":
        q = q.filter(Subscription.company_id == current_user.company_id)
    elif company_id is not None:
        q = q.filter(Subscription.company_id == company_id)
    rows = q.order_by(Company.name, Subscription.id.desc()).all()
    return [subscription_to_response(db, sub, company) for sub, company in rows]


@router.get("/my", response_model=MySubscriptionResponse)
def my_subscription(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if current_user.company_id is None:
        raise HTTPException(status_code=404, detail="User is not assigned to a company")
    sub = get_subscription(db, current_user.company_id)
    if not sub:
        raise HTTPException(status_code=404, detail="No subscription for this company")
    base = subscription_to_response(db, sub)
    resp = MySubscriptionResponse(**base.model_dump())
    resp.licenses = [license_to_response(l) for l in
                     db.query(License).filter(License.subscription_id == sub.id).order_by(License.id).all()]
    if sub.ends_at:
        ends = sub.ends_at if sub.ends_at.tzinfo else sub.ends_at.replace(tzinfo=timezone.utc)
        resp.days_to_renewal = (ends - datetime.now(timezone.utc)).days
    return resp


@router.get("/{subscription_id}", response_model=MySubscriptionResponse)
def get_subscription_detail(
    subscription_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)
):
    sub = _get_or_404(db, subscription_id)
    if current_user.role != "master" and sub.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Subscription not found")
    base = subscription_to_response(db, sub)
    resp = MySubscriptionResponse(**base.model_dump())
    resp.licenses = [license_to_response(l) for l in
                     db.query(License).filter(License.subscription_id == sub.id).order_by(License.id).all()]
    if sub.ends_at:
        ends = sub.ends_at if sub.ends_at.tzinfo else sub.ends_at.replace(tzinfo=timezone.utc)
        resp.days_to_renewal = (ends - datetime.now(timezone.utc)).days
    return resp


@router.post("", response_model=MySubscriptionResponse, status_code=201)
def create_subscription(
    payload: SubscriptionCreate, db: Session = Depends(get_db), master_user: User = Depends(require_master)
):
    company = db.query(Company).filter(Company.id == payload.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if get_subscription(db, payload.company_id):
        raise HTTPException(status_code=400, detail="Company already has an active subscription")
    data = payload.model_dump(exclude={"initial_licenses"}, exclude_none=True)
    data.setdefault("currency", (company.currency or "INR")[:3])
    data.setdefault("starts_at", datetime.now(timezone.utc))
    sub = Subscription(**data)
    db.add(sub)
    db.flush()
    for _ in range(payload.initial_licenses):
        db.add(License(subscription_id=sub.id, company_id=sub.company_id, site_id=None,
                       license_key=secrets.token_urlsafe(32), granted_by=master_user.id))
    _audit(db, master_user, sub.company_id, "create", "subscription", sub.id,
           f"Master {master_user.username} created {sub.plan} subscription for {company.name} "
           f"with {payload.initial_licenses} licence(s)")
    db.commit()
    db.refresh(sub)
    if sub.status in ("trial", "active"):
        send_subscription_activated_email(db, sub, company)
    return get_subscription_detail(sub.id, db, master_user)


@router.put("/{subscription_id}", response_model=MySubscriptionResponse)
def update_subscription(
    subscription_id: int, payload: SubscriptionUpdate,
    db: Session = Depends(get_db), master_user: User = Depends(require_master),
):
    sub = _get_or_404(db, subscription_id)
    was_valid = sub.status in ("trial", "active")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(sub, key, value)
    _audit(db, master_user, sub.company_id, "update", "subscription", sub.id,
           f"Master {master_user.username} updated subscription {sub.id}")
    db.commit()
    db.refresh(sub)
    if sub.status in ("trial", "active") and not was_valid:
        send_subscription_activated_email(db, sub)
    return get_subscription_detail(sub.id, db, master_user)


def _set_status(db: Session, subscription_id: int, status: str, master_user: User) -> MySubscriptionResponse:
    sub = _get_or_404(db, subscription_id)
    was_valid = sub.status in ("trial", "active")
    sub.status = status
    _audit(db, master_user, sub.company_id, "update", "subscription", sub.id,
           f"Master {master_user.username} set subscription {sub.id} status to {status}")
    db.commit()
    db.refresh(sub)
    if status == "active" and not was_valid:
        send_subscription_activated_email(db, sub)
    return get_subscription_detail(sub.id, db, master_user)


@router.post("/{subscription_id}/suspend", response_model=MySubscriptionResponse)
def suspend_subscription(subscription_id: int, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    return _set_status(db, subscription_id, "suspended", master_user)


@router.post("/{subscription_id}/activate", response_model=MySubscriptionResponse)
def activate_subscription(subscription_id: int, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    return _set_status(db, subscription_id, "active", master_user)
```

- [ ] **Step 3: Rewrite `backend/routers/licenses.py`**

```python
"""Site licences: grant (master), list (master/admin), soft revoke (master)."""
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth.dependencies import require_admin, require_master
from database import get_db
from models.rbac import AuditLog
from models.subscription import License, Subscription
from models.user import User
from models.work_location import WorkLocation
from routers.subscriptions import license_to_response
from schemas.subscription import LicenseGrant, LicenseResponse, LicenseRevoke

router = APIRouter()


@router.get("", response_model=list[LicenseResponse])
def list_licenses(
    company_id: Optional[int] = Query(None),
    subscription_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(License)
    if current_user.role != "master":
        q = q.filter(License.company_id == current_user.company_id)
    elif company_id is not None:
        q = q.filter(License.company_id == company_id)
    if subscription_id is not None:
        q = q.filter(License.subscription_id == subscription_id)
    return [license_to_response(l) for l in q.order_by(License.id).all()]


@router.get("/{license_id}", response_model=LicenseResponse)
def get_license(license_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    lic = db.query(License).filter(License.id == license_id).first()
    if not lic or (current_user.role != "master" and lic.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Licence not found")
    return license_to_response(lic)


@router.post("", response_model=list[LicenseResponse], status_code=201)
def grant_licenses(payload: LicenseGrant, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    """Create ``quantity`` licence rows on one subscription (D4 stacking)."""
    sub = db.query(Subscription).filter(Subscription.id == payload.subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    site_name = "Company-wide"
    if payload.site_id is not None:
        site = db.query(WorkLocation).filter(WorkLocation.id == payload.site_id).first()
        if not site or site.company_id != sub.company_id:
            raise HTTPException(status_code=400, detail="Site does not belong to this company")
        site_name = site.location_name
    max_users = None if payload.unlimited else payload.max_users
    created: list[License] = []
    for _ in range(payload.quantity):
        lic = License(
            subscription_id=sub.id, company_id=sub.company_id, site_id=payload.site_id,
            license_key=secrets.token_urlsafe(32), status="active",
            max_users=max_users, max_admins=payload.max_admins, granted_by=master_user.id,
        )
        db.add(lic)
        created.append(lic)
    db.flush()
    for lic in created:
        db.add(AuditLog(user_id=master_user.id, company_id=sub.company_id, action="create",
                        entity_type="license", entity_id=lic.id,
                        details=f"Master {master_user.username} granted licence {lic.id} ({site_name}, "
                                f"{'unlimited' if max_users is None else max_users} seats)"))
    db.commit()
    for lic in created:
        db.refresh(lic)
    return [license_to_response(l) for l in created]


@router.post("/{license_id}/revoke", response_model=LicenseResponse)
def revoke_license(
    license_id: int, payload: LicenseRevoke,
    db: Session = Depends(get_db), master_user: User = Depends(require_master),
):
    lic = db.query(License).filter(License.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licence not found")
    if lic.status == "revoked":
        raise HTTPException(status_code=400, detail="Licence is already revoked")
    lic.status = "revoked"
    lic.revoked_by = master_user.id
    lic.revoked_at = datetime.now(timezone.utc)
    lic.revoke_reason = payload.reason
    db.add(AuditLog(user_id=master_user.id, company_id=lic.company_id, action="update",
                    entity_type="license", entity_id=lic.id,
                    details=f"Master {master_user.username} revoked licence {lic.id}: {payload.reason or 'no reason'}"))
    db.commit()
    db.refresh(lic)
    return license_to_response(lic)
```

- [ ] **Step 4: Mount both routers in `backend/main.py`**

Change the import line to:

```python
from routers import payslip_templates, licenses, geofence, subscriptions, invoices
```

(`invoices` is created in Task 6 — until then, leave `invoices` out of this import and add it in Task 6.) After the `payslip_templates` mount add:

```python
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["Subscriptions"])
app.include_router(licenses.router, prefix="/api/licenses", tags=["Licenses"])
```

Neither carries `_licensed`: blocked admins must still be able to read `/my`.

- [ ] **Step 5: Verify the app imports and routes exist**

Run from `backend/`:
```bash
python -c "import os; os.environ.setdefault('DATABASE_URL','sqlite:///./_chk.db'); import main; print(sorted(r.path for r in main.app.routes if r.path.startswith(('/api/subscriptions','/api/licenses'))))"; rm -f _chk.db
python -m pytest tests -q
```
Expected: the list contains `/api/subscriptions`, `/api/subscriptions/my`, `/api/subscriptions/{subscription_id}`, `/api/subscriptions/{subscription_id}/suspend`, `/api/subscriptions/{subscription_id}/activate`, `/api/licenses`, `/api/licenses/{license_id}`, `/api/licenses/{license_id}/revoke`; tests `28 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/subscription.py backend/routers/subscriptions.py backend/routers/licenses.py backend/main.py
git commit -m "feat(licensing): subscription and licence APIs" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Invoice service, schemas and router

**Files:**
- Create: `backend/services/invoice_service.py`, `backend/schemas/invoice.py`, `backend/routers/invoices.py`
- Test: `backend/tests/test_invoice.py`
- Modify: `backend/main.py` (mount)

**Interfaces:**
- Produces (pure):
  - `@dataclass(frozen=True) LineSpec(license_id: int|None, description: str, quantity: Decimal, unit_price: Decimal, amount: Decimal)`
  - `build_lines(licenses: Sequence[tuple[int, str|None, int|None, datetime|None, datetime|None]], unit_price: Decimal, period_start: date, period_end: date) -> list[LineSpec]` — tuple = `(license_id, site_name, max_users, granted_at, revoked_at)`.
  - `compute_totals(lines, tax_rate) -> tuple[Decimal, Decimal, Decimal]` → `(subtotal, tax_amount, total)`, half-up 2 dp.
  - `next_invoice_number(year: int, existing_numbers: Iterable[str]) -> str`
- Produces (DB): `generate_invoice(db, company_id, period_start, period_end, created_by) -> Invoice`

- [ ] **Step 1: Write the failing tests `backend/tests/test_invoice.py`**

```python
from datetime import date, datetime, timezone
from decimal import Decimal

from services.invoice_service import LineSpec, build_lines, compute_totals, next_invoice_number

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
START, END = date(2026, 4, 1), date(2026, 4, 30)


def test_one_line_per_active_licence_with_description():
    lics = [(1, "HQ", 26, T0, None), (2, None, 26, T0, None), (3, "Yard", None, T0, None)]
    lines = build_lines(lics, Decimal("1000.00"), START, END)
    assert [l.description for l in lines] == [
        "Site licence — HQ (26 seats)",
        "Site licence — Company-wide (26 seats)",
        "Site licence — Yard (unlimited seats)",
    ]
    assert all(l.quantity == Decimal("1") and l.unit_price == Decimal("1000.00") and l.amount == Decimal("1000.00") for l in lines)
    assert [l.license_id for l in lines] == [1, 2, 3]


def test_licences_outside_the_period_are_excluded():
    lics = [
        (1, "HQ", 26, datetime(2026, 5, 1, tzinfo=timezone.utc), None),                       # granted after period
        (2, "HQ", 26, T0, datetime(2026, 3, 15, tzinfo=timezone.utc)),                         # revoked before period
        (3, "HQ", 26, T0, datetime(2026, 4, 10, tzinfo=timezone.utc)),                         # revoked inside period → billed
        (4, "HQ", 26, datetime(2026, 4, 20, tzinfo=timezone.utc), None),                       # granted inside period → billed
    ]
    assert [l.license_id for l in build_lines(lics, Decimal("10"), START, END)] == [3, 4]


def test_gst_maths_and_half_up_rounding():
    lines = [LineSpec(None, "x", Decimal("1"), Decimal("333.33"), Decimal("333.33"))] * 3
    subtotal, tax, total = compute_totals(lines, Decimal("18.00"))
    assert subtotal == Decimal("999.99")
    assert tax == Decimal("180.00")        # 179.9982 → 180.00
    assert total == Decimal("1179.99")
    lines = [LineSpec(None, "x", Decimal("1"), Decimal("0.125"), Decimal("0.125"))]
    subtotal, tax, total = compute_totals(lines, Decimal("18"))
    assert subtotal == Decimal("0.13")     # half-up, not banker's
    assert tax == Decimal("0.02")
    assert total == Decimal("0.15")


def test_zero_tax():
    lines = [LineSpec(None, "x", Decimal("2"), Decimal("50"), Decimal("100"))]
    assert compute_totals(lines, Decimal("0")) == (Decimal("100.00"), Decimal("0.00"), Decimal("100.00"))


def test_invoice_number_sequence_per_year():
    assert next_invoice_number(2026, []) == "INV-2026-0001"
    assert next_invoice_number(2026, ["INV-2026-0001", "INV-2026-0007", "INV-2025-0099"]) == "INV-2026-0008"
    assert next_invoice_number(2027, ["INV-2026-0007"]) == "INV-2027-0001"
    assert next_invoice_number(2026, ["INV-2026-9999"]) == "INV-2026-10000"


def test_concurrent_allocation_from_same_snapshot_collides_so_lock_is_required():
    # Documents why generate_invoice() locks the year's rows: two callers seeing the
    # same snapshot get the same number. The DB unique constraint + FOR UPDATE prevent it.
    snapshot = ["INV-2026-0003"]
    assert next_invoice_number(2026, snapshot) == next_invoice_number(2026, snapshot)
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/test_invoice.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'services.invoice_service'`

- [ ] **Step 3: Create `backend/services/invoice_service.py`**

```python
"""Invoice generation from site licences (spec §5 "Invoice generation")."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Sequence

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from models.company import Company
from models.invoice import Invoice, InvoiceLine
from models.subscription import License
from services.subscription_service import get_subscription

TWO_DP = Decimal("0.01")
_NUM_RE = re.compile(r"^INV-(\d{4})-(\d+)$")


def q2(value: Decimal) -> Decimal:
    return Decimal(value).quantize(TWO_DP, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class LineSpec:
    license_id: int | None
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def build_lines(
    licenses: Sequence[tuple[int, str | None, int | None, datetime | None, datetime | None]],
    unit_price: Decimal,
    period_start: date,
    period_end: date,
) -> list[LineSpec]:
    """One line per licence active at any point in [period_start, period_end].
    Tuple: (license_id, site_name, max_users, granted_at, revoked_at)."""
    p_start = datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc)
    p_end = datetime.combine(period_end, datetime.max.time(), tzinfo=timezone.utc)
    out: list[LineSpec] = []
    for license_id, site_name, max_users, granted_at, revoked_at in licenses:
        g, r = _as_utc(granted_at), _as_utc(revoked_at)
        if g is not None and g > p_end:
            continue
        if r is not None and r < p_start:
            continue
        seats = "unlimited seats" if max_users is None else f"{max_users} seats"
        price = q2(Decimal(unit_price))
        out.append(LineSpec(
            license_id=license_id,
            description=f"Site licence — {site_name or 'Company-wide'} ({seats})",
            quantity=Decimal("1"), unit_price=price, amount=price,
        ))
    return out


def compute_totals(lines: Sequence[LineSpec], tax_rate: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = q2(sum((Decimal(l.amount) for l in lines), Decimal("0")))
    tax_amount = q2(subtotal * Decimal(tax_rate) / Decimal("100"))
    total = q2(subtotal + tax_amount)
    return subtotal, tax_amount, total


def next_invoice_number(year: int, existing_numbers: Iterable[str]) -> str:
    seq = 0
    for n in existing_numbers:
        m = _NUM_RE.match(n or "")
        if m and int(m.group(1)) == year:
            seq = max(seq, int(m.group(2)))
    return f"INV-{year}-{seq + 1:04d}"


# ── DB-backed ────────────────────────────────────────────────────────────────

def generate_invoice(db: Session, company_id: int, period_start: date, period_end: date, created_by: int) -> Invoice:
    if period_end < period_start:
        raise HTTPException(status_code=400, detail="period_end must be on or after period_start")
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    sub = get_subscription(db, company_id)
    if not sub:
        raise HTTPException(status_code=400, detail="Company has no subscription")

    rows = db.query(License).filter(License.subscription_id == sub.id).order_by(License.id).all()
    lines = build_lines(
        [(l.id, l.site.location_name if l.site else None, l.max_users, l.granted_at, l.revoked_at) for l in rows],
        Decimal(sub.unit_price), period_start, period_end,
    )
    if not lines:
        raise HTTPException(status_code=400, detail="No licences were active in that period")
    subtotal, tax_amount, total = compute_totals(lines, Decimal(sub.tax_rate))

    today = date.today()
    year = today.year
    # Lock this year's rows so concurrent generation cannot allocate the same number.
    existing = db.execute(
        text("SELECT invoice_number FROM invoices WHERE invoice_number LIKE :p FOR UPDATE"),
        {"p": f"INV-{year}-%"},
    ).scalars().all()
    number = next_invoice_number(year, existing)

    inv = Invoice(
        invoice_number=number, company_id=company_id, subscription_id=sub.id,
        period_start=period_start, period_end=period_end,
        issue_date=today, due_date=today + timedelta(days=15),
        currency=sub.currency, subtotal=subtotal, tax_rate=Decimal(sub.tax_rate),
        tax_amount=tax_amount, total=total, status="draft",
        billing_snapshot={
            "name": company.name, "address": company.address, "city": company.city,
            "state": company.state, "pincode": company.pincode, "gst_number": company.gst_number,
        },
        created_by=created_by,
    )
    for l in lines:
        inv.lines.append(InvoiceLine(license_id=l.license_id, description=l.description,
                                     quantity=l.quantity, unit_price=l.unit_price, amount=l.amount))
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv
```

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/test_invoice.py -q`
Expected: `6 passed`

- [ ] **Step 5: Create `backend/schemas/invoice.py`**

```python
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class InvoiceGenerate(BaseModel):
    company_id:   int
    period_start: date
    period_end:   date


class InvoiceMarkPaid(BaseModel):
    payment_ref: Optional[str] = Field(None, max_length=100)


class InvoiceLineResponse(BaseModel):
    id:          int
    license_id:  Optional[int] = None
    description: str
    quantity:    Decimal
    unit_price:  Decimal
    amount:      Decimal

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id:               int
    invoice_number:   str
    company_id:       int
    company_name:     Optional[str] = None
    subscription_id:  Optional[int] = None
    period_start:     date
    period_end:       date
    issue_date:       date
    due_date:         date
    currency:         str
    subtotal:         Decimal
    tax_rate:         Decimal
    tax_amount:       Decimal
    total:            Decimal
    status:           str
    paid_at:          Optional[datetime] = None
    payment_ref:      Optional[str] = None
    billing_snapshot: Optional[dict] = None
    created_by:       Optional[int] = None
    created_at:       Optional[datetime] = None
    lines:            list[InvoiceLineResponse] = []

    model_config = {"from_attributes": True}
```

- [ ] **Step 6: Create `backend/routers/invoices.py`**

```python
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth.dependencies import require_admin, require_master
from database import get_db
from models.company import Company
from models.invoice import Invoice
from models.rbac import AuditLog
from models.user import User
from schemas.invoice import InvoiceGenerate, InvoiceMarkPaid, InvoiceResponse
from services.invoice_service import generate_invoice

router = APIRouter()


def _to_response(db: Session, inv: Invoice) -> InvoiceResponse:
    resp = InvoiceResponse.model_validate(inv)
    company = db.query(Company).filter(Company.id == inv.company_id).first()
    resp.company_name = company.name if company else (inv.billing_snapshot or {}).get("name")
    return resp


def _get_visible(db: Session, invoice_id: int, current_user: User) -> Invoice:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv or (current_user.role != "master" and inv.company_id != current_user.company_id):
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@router.get("", response_model=list[InvoiceResponse])
def list_invoices(
    company_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    q = db.query(Invoice)
    if current_user.role != "master":
        q = q.filter(Invoice.company_id == current_user.company_id)
    elif company_id is not None:
        q = q.filter(Invoice.company_id == company_id)
    if status:
        q = q.filter(Invoice.status == status)
    return [_to_response(db, i) for i in q.order_by(Invoice.id.desc()).all()]


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return _to_response(db, _get_visible(db, invoice_id, current_user))


@router.post("/generate", response_model=InvoiceResponse, status_code=201)
def generate(payload: InvoiceGenerate, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    inv = generate_invoice(db, payload.company_id, payload.period_start, payload.period_end, master_user.id)
    db.add(AuditLog(user_id=master_user.id, company_id=inv.company_id, action="create",
                    entity_type="invoice", entity_id=inv.id,
                    details=f"Master {master_user.username} generated invoice {inv.invoice_number} "
                            f"for {payload.period_start}..{payload.period_end} total {inv.total}"))
    db.commit()
    return _to_response(db, inv)


@router.post("/{invoice_id}/mark-paid", response_model=InvoiceResponse)
def mark_paid(invoice_id: int, payload: InvoiceMarkPaid, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    inv = _get_visible(db, invoice_id, master_user)
    if inv.status == "void":
        raise HTTPException(status_code=400, detail="A void invoice cannot be marked paid")
    inv.status = "paid"
    inv.paid_at = datetime.now(timezone.utc)
    inv.payment_ref = payload.payment_ref
    db.add(AuditLog(user_id=master_user.id, company_id=inv.company_id, action="update",
                    entity_type="invoice", entity_id=inv.id,
                    details=f"Master {master_user.username} marked {inv.invoice_number} paid ({payload.payment_ref or 'no ref'})"))
    db.commit()
    db.refresh(inv)
    return _to_response(db, inv)


@router.post("/{invoice_id}/void", response_model=InvoiceResponse)
def void_invoice(invoice_id: int, db: Session = Depends(get_db), master_user: User = Depends(require_master)):
    inv = _get_visible(db, invoice_id, master_user)
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="A paid invoice cannot be voided")
    inv.status = "void"
    db.add(AuditLog(user_id=master_user.id, company_id=inv.company_id, action="update",
                    entity_type="invoice", entity_id=inv.id,
                    details=f"Master {master_user.username} voided {inv.invoice_number}"))
    db.commit()
    db.refresh(inv)
    return _to_response(db, inv)
```

- [ ] **Step 7: Mount in `backend/main.py`**

Import line becomes `from routers import payslip_templates, licenses, geofence, subscriptions, invoices` and add after the licences mount:

```python
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
```

- [ ] **Step 8: Verify**

```bash
python -c "import os; os.environ.setdefault('DATABASE_URL','sqlite:///./_chk.db'); import main; print([r.path for r in main.app.routes if r.path.startswith('/api/invoices')])"; rm -f _chk.db
python -m pytest tests -q
```
Expected: 5 invoice paths listed; `34 passed`.

- [ ] **Step 9: Commit**

```bash
git add backend/services/invoice_service.py backend/schemas/invoice.py backend/routers/invoices.py backend/tests/test_invoice.py backend/main.py
git commit -m "feat(licensing): GST invoice generation with locked sequential numbering" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Run the migration both ways against local Postgres

**Files:** none new. Uses `docker-compose.yml` postgres (port 5433).

- [ ] **Step 1: Start Postgres and migrate from empty**

```bash
docker compose up -d postgres
cd backend
export DATABASE_URL=postgresql://erp_user:erp_pass@localhost:5433/erp_db
python migrate.py upgrade
python -c "from sqlalchemy import create_engine, inspect; import os; print(sorted(t for t in inspect(create_engine(os.environ['DATABASE_URL'])).get_table_names() if t in ('subscriptions','licenses','invoices','invoice_lines','company_licenses')))"
```
Expected: `['invoice_lines', 'invoices', 'licenses', 'subscriptions']` (no `company_licenses`).

- [ ] **Step 2: Test the legacy-data path**

```bash
alembic downgrade 0030_geofence_exit_alerts
psql postgresql://erp_user:erp_pass@localhost:5433/erp_db -c "INSERT INTO companies (name, code) VALUES ('Legacy Co','LEG') ON CONFLICT DO NOTHING; INSERT INTO company_licenses (company_id, license_key, tier, status, max_seats) SELECT id, 'legacy-key-1', 'pro', 'active', 40 FROM companies WHERE code='LEG'; INSERT INTO company_licenses (company_id, license_key, tier, status, max_seats) SELECT id, 'legacy-key-2', 'basic', 'suspended', NULL FROM companies WHERE code<>'LEG' LIMIT 1;"
python migrate.py upgrade
psql postgresql://erp_user:erp_pass@localhost:5433/erp_db -c "SELECT s.plan, s.status, l.license_key, l.max_users, l.status FROM subscriptions s JOIN licenses l ON l.subscription_id=s.id ORDER BY s.id;"
alembic downgrade 0030_geofence_exit_alerts
psql postgresql://erp_user:erp_pass@localhost:5433/erp_db -c "SELECT license_key, tier, status, max_seats FROM company_licenses ORDER BY id;"
python migrate.py upgrade
```
Expected after first upgrade: `pro | active | legacy-key-1 | 40 | active` and `basic | suspended | legacy-key-2 | NULL | revoked`. After downgrade: both keys back with original tier/status/max_seats. If `psql` is not on PATH, run the SQL with `docker compose exec postgres psql -U erp_user -d erp_db -c "..."`.

- [ ] **Step 3: No commit** (nothing changed). If any step fails, fix the migration file and commit the fix with message `fix(licensing): migration …`.

---

### Task 8: Frontend types and API modules

**Files:**
- Create: `frontend/src/types/subscription.ts`, `frontend/src/types/invoice.ts`, `frontend/src/api/subscriptionApi.ts`, `frontend/src/api/invoiceApi.ts`

**Interfaces:**
- Consumes: HTTP shapes from Tasks 5–6. Pydantic serialises `Decimal` as a JSON string, so money fields are typed `string` here and parsed with `Number()` for display.
- Produces: named exports listed below, used by Tasks 9–11.

- [ ] **Step 1: Create `frontend/src/types/subscription.ts`**

```ts
export type Plan = "basic" | "pro" | "enterprise";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";
export type BillingCycle = "monthly" | "yearly";

export interface License {
  id: number;
  subscription_id: number;
  company_id: number;
  site_id: number | null;
  site_name: string | null;
  license_key: string;
  status: "active" | "revoked";
  max_users: number | null;      // null = unlimited
  max_admins: number;
  granted_by: number | null;
  granted_at: string | null;
  revoked_by: number | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string | null;
}

export interface Subscription {
  id: number;
  company_id: number;
  company_name: string | null;
  plan: Plan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  starts_at: string | null;
  ends_at: string | null;
  unit_price: string;            // Decimal serialised as string
  currency: string;
  tax_rate: string;
  features: Record<string, boolean> | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  // derived
  capacity: number | null;       // null = unlimited
  admin_cap: number;
  seats_used: number;
  admins_used: number;
  active_licenses: number;
  is_valid: boolean;
  reason_code: string | null;
  reason: string | null;
}

export interface SubscriptionDetail extends Subscription {
  licenses: License[];
  days_to_renewal: number | null;
}

export interface SubscriptionCreate {
  company_id: number;
  plan: Plan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  starts_at?: string | null;
  ends_at?: string | null;
  unit_price: string;
  currency?: string | null;
  tax_rate: string;
  notes?: string | null;
  initial_licenses: number;
}

export interface SubscriptionUpdate {
  plan?: Plan;
  status?: SubscriptionStatus;
  billing_cycle?: BillingCycle;
  starts_at?: string | null;
  ends_at?: string | null;
  unit_price?: string;
  currency?: string;
  tax_rate?: string;
  notes?: string | null;
}

export interface LicenseGrant {
  subscription_id: number;
  site_id?: number | null;
  quantity: number;
  max_users?: number | null;
  max_admins: number;
  unlimited: boolean;
}
```

- [ ] **Step 2: Create `frontend/src/types/invoice.ts`**

```ts
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface InvoiceLine {
  id: number;
  license_id: number | null;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  company_id: number;
  company_name: string | null;
  subscription_id: number | null;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  status: InvoiceStatus;
  paid_at: string | null;
  payment_ref: string | null;
  billing_snapshot: {
    name?: string | null; address?: string | null; city?: string | null;
    state?: string | null; pincode?: string | null; gst_number?: string | null;
  } | null;
  created_by: number | null;
  created_at: string | null;
  lines: InvoiceLine[];
}

export interface InvoiceGenerate {
  company_id: number;
  period_start: string;
  period_end: string;
}
```

- [ ] **Step 3: Create `frontend/src/api/subscriptionApi.ts`**

```ts
import api from "./axiosConfig";
import type { AxiosResponse } from "axios";
import type {
  Subscription, SubscriptionDetail, SubscriptionCreate, SubscriptionUpdate, License, LicenseGrant,
} from "../types/subscription";

export const getSubscriptions = (params?: { company_id?: number }): Promise<AxiosResponse<Subscription[]>> =>
  api.get("/api/subscriptions", { params });

export const getMySubscription = (): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.get("/api/subscriptions/my");

export const getSubscription = (id: number): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.get(`/api/subscriptions/${id}`);

export const createSubscription = (data: SubscriptionCreate): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.post("/api/subscriptions", data);

export const updateSubscription = (id: number, data: SubscriptionUpdate): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.put(`/api/subscriptions/${id}`, data);

export const suspendSubscription = (id: number): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.post(`/api/subscriptions/${id}/suspend`);

export const activateSubscription = (id: number): Promise<AxiosResponse<SubscriptionDetail>> =>
  api.post(`/api/subscriptions/${id}/activate`);

export const getLicenses = (params?: { company_id?: number; subscription_id?: number }): Promise<AxiosResponse<License[]>> =>
  api.get("/api/licenses", { params });

export const grantLicenses = (data: LicenseGrant): Promise<AxiosResponse<License[]>> =>
  api.post("/api/licenses", data);

export const revokeLicense = (id: number, reason: string): Promise<AxiosResponse<License>> =>
  api.post(`/api/licenses/${id}/revoke`, { reason });
```

- [ ] **Step 4: Create `frontend/src/api/invoiceApi.ts`**

```ts
import api from "./axiosConfig";
import type { AxiosResponse } from "axios";
import type { Invoice, InvoiceGenerate } from "../types/invoice";

export const getInvoices = (params?: { company_id?: number; status?: string }): Promise<AxiosResponse<Invoice[]>> =>
  api.get("/api/invoices", { params });

export const getInvoice = (id: number): Promise<AxiosResponse<Invoice>> =>
  api.get(`/api/invoices/${id}`);

export const generateInvoice = (data: InvoiceGenerate): Promise<AxiosResponse<Invoice>> =>
  api.post("/api/invoices/generate", data);

export const markInvoicePaid = (id: number, payment_ref?: string): Promise<AxiosResponse<Invoice>> =>
  api.post(`/api/invoices/${id}/mark-paid`, { payment_ref: payment_ref || null });

export const voidInvoice = (id: number): Promise<AxiosResponse<Invoice>> =>
  api.post(`/api/invoices/${id}/void`);
```

- [ ] **Step 5: Type-check**

Run from `frontend/`: `npx tsc --noEmit --moduleResolution node -p tsconfig.json 2>&1 | grep -v "TS6046\|TS5070" ; echo done`
Expected: no errors printed besides the two known tsconfig option warnings (the CRA build is the real gate — `CI=true npm run build` in Task 11).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/subscription.ts frontend/src/types/invoice.ts frontend/src/api/subscriptionApi.ts frontend/src/api/invoiceApi.ts
git commit -m "feat(licensing): frontend types and API modules for subscriptions, licences, invoices" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Master pages — SubscriptionList and SubscriptionDetail, routes, nav

**Files:**
- Create: `frontend/src/pages/master/SubscriptionList.tsx`, `frontend/src/pages/master/SubscriptionDetail.tsx`
- Modify: `frontend/src/App.tsx` (imports + routes), `frontend/src/components/Sidebar.tsx` (Billing group)

**Interfaces:**
- Consumes: `getSubscriptions`, `createSubscription`, `getSubscription`, `updateSubscription`, `suspendSubscription`, `activateSubscription`, `grantLicenses`, `revokeLicense` (Task 8); `getCompanies({ all: true })` from `api/companyApi.ts`; `getAllLocations()` from `api/locationApi.ts` (returns the caller's company locations for admin; for master it returns all — filter by `company_id` is not available on `WorkLocation`, so the picker lists all active locations returned and the backend rejects a site from another company with 400).

- [ ] **Step 1: Create `frontend/src/pages/master/SubscriptionList.tsx`**

```tsx
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getSubscriptions, createSubscription } from "../../api/subscriptionApi";
import { getCompanies } from "../../api/companyApi";
import AlertMessage from "../../components/AlertMessage";
import type { Subscription, SubscriptionCreate } from "../../types/subscription";
import type { Company } from "../../types/company";

const EMPTY: SubscriptionCreate = {
  company_id: 0, plan: "basic", status: "active", billing_cycle: "yearly",
  starts_at: null, ends_at: null, unit_price: "0", tax_rate: "18", notes: "", initial_licenses: 1,
};

export function statusBadge(status: string): string {
  return ({ active: "success", trial: "info", past_due: "warning", suspended: "danger", cancelled: "secondary" } as Record<string, string>)[status] || "secondary";
}

export function seatsLabel(used: number, cap: number | null): string {
  return cap === null ? `${used} / ∞` : `${used} / ${cap}`;
}

function fmtDate(v: string | null): string {
  return v ? new Date(v).toLocaleDateString() : "—";
}

export default function SubscriptionList() {
  const navigate = useNavigate();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SubscriptionCreate>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([getSubscriptions(), getCompanies({ all: true })]);
      setSubs(s.data);
      setCompanies(c.data.items);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const licensedIds = new Set(subs.map(s => s.company_id));
  const unlicensed = companies.filter(c => !licensedIds.has(c.id));

  function set<K extends keyof SubscriptionCreate>(field: K, value: SubscriptionCreate[K]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.company_id) { setAlert({ type: "warning", message: "Select a company." }); return; }
    setLoading(true);
    try {
      const r = await createSubscription({ ...form, starts_at: form.starts_at || null, ends_at: form.ends_at || null });
      setAlert({ type: "success", message: `Subscription created for ${r.data.company_name}.` });
      setForm(EMPTY);
      setShowForm(false);
      navigate(`/master/subscriptions/${r.data.id}`);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Subscriptions</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancel" : "+ New subscription"}
        </button>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      {showForm && (
        <div className="card mb-4">
          <div className="card-body">
            <form className="row g-3" onSubmit={handleCreate}>
              <div className="col-md-4">
                <label className="form-label">Company</label>
                <select className="form-select" value={form.company_id} onChange={e => set("company_id", Number(e.target.value))} required>
                  <option value={0}>Select…</option>
                  {unlicensed.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Plan</label>
                <select className="form-select" value={form.plan} onChange={e => set("plan", e.target.value as SubscriptionCreate["plan"])}>
                  <option value="basic">Basic</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => set("status", e.target.value as SubscriptionCreate["status"])}>
                  <option value="trial">Trial</option><option value="active">Active</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Billing</label>
                <select className="form-select" value={form.billing_cycle} onChange={e => set("billing_cycle", e.target.value as SubscriptionCreate["billing_cycle"])}>
                  <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Licences (26 seats each)</label>
                <input type="number" min={0} max={100} className="form-control" value={form.initial_licenses}
                  onChange={e => set("initial_licenses", Number(e.target.value))} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Price per licence / cycle</label>
                <input type="number" min={0} step="0.01" className="form-control" value={form.unit_price}
                  onChange={e => set("unit_price", e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label">GST %</label>
                <input type="number" min={0} max={100} step="0.01" className="form-control" value={form.tax_rate}
                  onChange={e => set("tax_rate", e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Starts</label>
                <input type="date" className="form-control" value={form.starts_at || ""} onChange={e => set("starts_at", e.target.value || null)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Ends (blank = perpetual)</label>
                <input type="date" className="form-control" value={form.ends_at || ""} onChange={e => set("ends_at", e.target.value || null)} />
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                <input className="form-control" value={form.notes || ""} onChange={e => set("notes", e.target.value)} />
              </div>
              <div className="col-12">
                <button className="btn btn-success" disabled={loading}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Company</th><th>Plan</th><th>Status</th><th>Licences</th>
                <th>Seats</th><th>Admins</th><th>Renews / ends</th><th>Validity</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted py-4">{loading ? "Loading…" : "No subscriptions yet."}</td></tr>
              ) : subs.map(s => (
                <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/master/subscriptions/${s.id}`)}>
                  <td className="fw-semibold">{s.company_name}</td>
                  <td className="text-capitalize">{s.plan}</td>
                  <td><span className={`badge bg-${statusBadge(s.status)}`}>{s.status}</span></td>
                  <td>{s.active_licenses}</td>
                  <td>{seatsLabel(s.seats_used, s.capacity)}</td>
                  <td>{s.admins_used} / {s.admin_cap}</td>
                  <td>{fmtDate(s.ends_at)}</td>
                  <td>{s.is_valid ? <span className="text-success">OK</span> : <span className="text-danger">{s.reason}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {unlicensed.length > 0 && (
        <p className="text-muted small mt-2">{unlicensed.length} compan{unlicensed.length === 1 ? "y has" : "ies have"} no subscription.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/pages/master/SubscriptionDetail.tsx`**

```tsx
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getSubscription, updateSubscription, suspendSubscription, activateSubscription, grantLicenses, revokeLicense,
} from "../../api/subscriptionApi";
import { getAllLocations, type WorkLocation } from "../../api/locationApi";
import AlertMessage from "../../components/AlertMessage";
import { statusBadge, seatsLabel } from "./SubscriptionList";
import type { SubscriptionDetail as Detail, SubscriptionUpdate, License, LicenseGrant } from "../../types/subscription";

function toDateInput(v: string | null | undefined): string {
  return v ? v.slice(0, 10) : "";
}

export default function SubscriptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const subId = Number(id);
  const [sub, setSub] = useState<Detail | null>(null);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<SubscriptionUpdate>({});
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [grant, setGrant] = useState<LicenseGrant>({ subscription_id: subId, site_id: null, quantity: 1, max_users: 26, max_admins: 1, unlimited: false });
  const [revokeTarget, setRevokeTarget] = useState<License | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await getSubscription(subId);
      setSub(r.data);
      setEdit({
        plan: r.data.plan, status: r.data.status, billing_cycle: r.data.billing_cycle,
        starts_at: toDateInput(r.data.starts_at) || null, ends_at: toDateInput(r.data.ends_at) || null,
        unit_price: r.data.unit_price, currency: r.data.currency, tax_rate: r.data.tax_rate, notes: r.data.notes || "",
      });
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }, [subId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getAllLocations({ active_only: true }).then(r => setLocations(r.data)).catch(() => {});
  }, []);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setSaving(true);
    try { await fn(); setAlert({ type: "success", message: ok }); await load(); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setSaving(false); }
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    run(() => updateSubscription(subId, { ...edit, starts_at: edit.starts_at || null, ends_at: edit.ends_at || null }), "Subscription updated.");
  }

  function handleGrant(e: FormEvent) {
    e.preventDefault();
    run(() => grantLicenses({ ...grant, subscription_id: subId, site_id: grant.site_id || null }),
        `${grant.quantity} licence${grant.quantity === 1 ? "" : "s"} granted.`);
  }

  function handleRevoke() {
    if (!revokeTarget) return;
    const target = revokeTarget;
    setRevokeTarget(null);
    run(() => revokeLicense(target.id, revokeReason), `Licence #${target.id} revoked.`);
    setRevokeReason("");
  }

  if (!sub) return <div className="container py-4"><AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />Loading…</div>;

  const pct = sub.capacity ? Math.min(100, Math.round(sub.seats_used / sub.capacity * 100)) : 0;
  const barColor = sub.capacity !== null && sub.seats_used >= sub.capacity ? "danger" : pct >= 80 ? "warning" : "success";

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <button className="btn btn-link btn-sm px-0" onClick={() => navigate("/master/subscriptions")}>← Subscriptions</button>
          <h4 className="mb-0">{sub.company_name} <span className={`badge bg-${statusBadge(sub.status)} ms-2`}>{sub.status}</span></h4>
        </div>
        <div className="d-flex gap-2">
          {sub.status === "suspended"
            ? <button className="btn btn-success btn-sm" disabled={saving} onClick={() => run(() => activateSubscription(subId), "Subscription activated.")}>Activate</button>
            : <button className="btn btn-outline-danger btn-sm" disabled={saving} onClick={() => run(() => suspendSubscription(subId), "Subscription suspended.")}>Suspend</button>}
        </div>
      </div>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      <div className="row g-3 mb-3">
        <div className="col-md-3"><div className="card h-100"><div className="card-body">
          <div className="text-muted small">Seats</div>
          <div className="fs-4 fw-semibold">{seatsLabel(sub.seats_used, sub.capacity)}</div>
          {sub.capacity !== null && <div className="progress" style={{ height: 6 }}><div className={`progress-bar bg-${barColor}`} style={{ width: `${pct}%` }} /></div>}
        </div></div></div>
        <div className="col-md-3"><div className="card h-100"><div className="card-body">
          <div className="text-muted small">Admins</div><div className="fs-4 fw-semibold">{sub.admins_used} / {sub.admin_cap}</div>
        </div></div></div>
        <div className="col-md-3"><div className="card h-100"><div className="card-body">
          <div className="text-muted small">Active licences</div><div className="fs-4 fw-semibold">{sub.active_licenses}</div>
        </div></div></div>
        <div className="col-md-3"><div className="card h-100"><div className="card-body">
          <div className="text-muted small">Validity</div>
          <div className={`fw-semibold ${sub.is_valid ? "text-success" : "text-danger"}`}>{sub.is_valid ? "Valid" : sub.reason}</div>
          {sub.days_to_renewal !== null && <div className="small text-muted">{sub.days_to_renewal} days to renewal</div>}
        </div></div></div>
      </div>

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card"><div className="card-header">Plan &amp; billing</div><div className="card-body">
            <form className="row g-2" onSubmit={handleSave}>
              <div className="col-6"><label className="form-label">Plan</label>
                <select className="form-select" value={edit.plan} onChange={e => setEdit(s => ({ ...s, plan: e.target.value as SubscriptionUpdate["plan"] }))}>
                  <option value="basic">Basic</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
                </select></div>
              <div className="col-6"><label className="form-label">Status</label>
                <select className="form-select" value={edit.status} onChange={e => setEdit(s => ({ ...s, status: e.target.value as SubscriptionUpdate["status"] }))}>
                  {["trial", "active", "past_due", "suspended", "cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div className="col-6"><label className="form-label">Billing cycle</label>
                <select className="form-select" value={edit.billing_cycle} onChange={e => setEdit(s => ({ ...s, billing_cycle: e.target.value as SubscriptionUpdate["billing_cycle"] }))}>
                  <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                </select></div>
              <div className="col-6"><label className="form-label">Currency</label>
                <input className="form-control" maxLength={3} value={edit.currency || ""} onChange={e => setEdit(s => ({ ...s, currency: e.target.value.toUpperCase() }))} /></div>
              <div className="col-6"><label className="form-label">Price / licence / cycle</label>
                <input type="number" min={0} step="0.01" className="form-control" value={edit.unit_price || ""} onChange={e => setEdit(s => ({ ...s, unit_price: e.target.value }))} /></div>
              <div className="col-6"><label className="form-label">GST %</label>
                <input type="number" min={0} max={100} step="0.01" className="form-control" value={edit.tax_rate || ""} onChange={e => setEdit(s => ({ ...s, tax_rate: e.target.value }))} /></div>
              <div className="col-6"><label className="form-label">Starts</label>
                <input type="date" className="form-control" value={edit.starts_at || ""} onChange={e => setEdit(s => ({ ...s, starts_at: e.target.value || null }))} /></div>
              <div className="col-6"><label className="form-label">Ends</label>
                <input type="date" className="form-control" value={edit.ends_at || ""} onChange={e => setEdit(s => ({ ...s, ends_at: e.target.value || null }))} /></div>
              <div className="col-12"><label className="form-label">Notes</label>
                <textarea className="form-control" rows={2} value={edit.notes || ""} onChange={e => setEdit(s => ({ ...s, notes: e.target.value }))} /></div>
              <div className="col-12"><button className="btn btn-primary" disabled={saving}>Save</button></div>
            </form>
          </div></div>
        </div>

        <div className="col-lg-7">
          <div className="card mb-3"><div className="card-header">Grant licences</div><div className="card-body">
            <form className="row g-2 align-items-end" onSubmit={handleGrant}>
              <div className="col-md-4"><label className="form-label">Site</label>
                <select className="form-select" value={grant.site_id ?? ""} onChange={e => setGrant(g => ({ ...g, site_id: e.target.value ? Number(e.target.value) : null }))}>
                  <option value="">Company-wide</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                </select></div>
              <div className="col-md-2"><label className="form-label">Qty</label>
                <input type="number" min={1} max={100} className="form-control" value={grant.quantity} onChange={e => setGrant(g => ({ ...g, quantity: Number(e.target.value) }))} /></div>
              <div className="col-md-2"><label className="form-label">Seats</label>
                <input type="number" min={1} className="form-control" value={grant.max_users ?? 26} disabled={grant.unlimited} onChange={e => setGrant(g => ({ ...g, max_users: Number(e.target.value) }))} /></div>
              <div className="col-md-2"><label className="form-label">Admins</label>
                <input type="number" min={0} className="form-control" value={grant.max_admins} onChange={e => setGrant(g => ({ ...g, max_admins: Number(e.target.value) }))} /></div>
              <div className="col-md-2">
                <div className="form-check mb-2">
                  <input id="unl" type="checkbox" className="form-check-input" checked={grant.unlimited} onChange={e => setGrant(g => ({ ...g, unlimited: e.target.checked }))} />
                  <label htmlFor="unl" className="form-check-label">Unlimited</label>
                </div>
                <button className="btn btn-success w-100" disabled={saving}>Grant</button>
              </div>
            </form>
          </div></div>

          <div className="card"><div className="card-header">Licences</div>
            <div className="table-responsive"><table className="table table-sm align-middle mb-0">
              <thead><tr><th>#</th><th>Site</th><th>Seats</th><th>Admins</th><th>Status</th><th>Granted</th><th>Revoked</th><th></th></tr></thead>
              <tbody>
                {sub.licenses.length === 0 ? <tr><td colSpan={8} className="text-center text-muted py-3">No licences.</td></tr>
                : sub.licenses.map(l => (
                  <tr key={l.id} className={l.status === "revoked" ? "text-muted" : ""}>
                    <td>{l.id}</td>
                    <td>{l.site_name || "Company-wide"}</td>
                    <td>{l.max_users === null ? "∞" : l.max_users}</td>
                    <td>{l.max_admins}</td>
                    <td><span className={`badge bg-${l.status === "active" ? "success" : "secondary"}`}>{l.status}</span></td>
                    <td>{l.granted_at ? new Date(l.granted_at).toLocaleDateString() : "—"}</td>
                    <td>{l.revoked_at ? <span title={l.revoke_reason || ""}>{new Date(l.revoked_at).toLocaleDateString()}{l.revoke_reason ? ` — ${l.revoke_reason}` : ""}</span> : "—"}</td>
                    <td className="text-end">{l.status === "active" && (
                      <button className="btn btn-outline-danger btn-sm" disabled={saving} onClick={() => setRevokeTarget(l)}>Revoke</button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>

      {revokeTarget && (
        <div className="card mt-3 border-danger"><div className="card-body">
          <div className="mb-2">Revoke licence #{revokeTarget.id} ({revokeTarget.site_name || "Company-wide"})? Existing users keep working; new users are blocked while over capacity.</div>
          <input className="form-control mb-2" placeholder="Reason (optional)" value={revokeReason} onChange={e => setRevokeReason(e.target.value)} />
          <button className="btn btn-danger me-2" onClick={handleRevoke}>Revoke</button>
          <button className="btn btn-secondary" onClick={() => setRevokeTarget(null)}>Cancel</button>
        </div></div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add routes to `frontend/src/App.tsx`**

Add imports next to the `MasterDashboard` import:

```tsx
import SubscriptionList   from "./pages/master/SubscriptionList";
import SubscriptionDetail from "./pages/master/SubscriptionDetail";
```

Add inside the `{/* Master only */}` block after the `companies/:id` route:

```tsx
        <Route path="master/subscriptions" element={
          <RequireAuth roles={["master"]}><SubscriptionList /></RequireAuth>
        } />
        <Route path="master/subscriptions/:id" element={
          <RequireAuth roles={["master"]}><SubscriptionDetail /></RequireAuth>
        } />
```

- [ ] **Step 4: Add a Billing nav group to `frontend/src/components/Sidebar.tsx`**

Insert a new section object into `NAV_SECTIONS` immediately after the `"MASTER"` section:

```tsx
  {
    title: "BILLING",
    items: [
      { to: "/master/subscriptions", label: "Subscriptions", icon: "settings", roles: ["master"] },
      { to: "/master/invoices",      label: "Invoices",      icon: "reports",  roles: ["master"] },
      { to: "/subscription",         label: "Subscription",  icon: "settings", roles: ["admin"] },
    ],
  },
```

(`/master/invoices` and `/subscription` routes are added in Tasks 10 and 11.)

- [ ] **Step 5: Build**

Run from `frontend/`: `CI=true npm run build 2>&1 | tail -15`
Expected: `Compiled successfully.` (an `exhaustive-deps` or unused-var warning fails the build — fix it, do not disable the rule).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/master/SubscriptionList.tsx frontend/src/pages/master/SubscriptionDetail.tsx frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat(licensing): master subscription list and detail pages with licence grant/revoke" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Master pages — InvoiceList and InvoiceView

**Files:**
- Create: `frontend/src/pages/master/InvoiceList.tsx`, `frontend/src/pages/master/InvoiceView.tsx`
- Modify: `frontend/src/App.tsx` (routes)

**Interfaces:**
- Consumes: `getInvoices`, `generateInvoice`, `markInvoicePaid`, `voidInvoice`, `getInvoice` (Task 8); `getSubscriptions` (Task 8) for the company picker; `Invoice` type.

- [ ] **Step 1: Create `frontend/src/pages/master/InvoiceList.tsx`**

```tsx
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getInvoices, generateInvoice, markInvoicePaid, voidInvoice } from "../../api/invoiceApi";
import { getSubscriptions } from "../../api/subscriptionApi";
import AlertMessage from "../../components/AlertMessage";
import type { Invoice } from "../../types/invoice";
import type { Subscription } from "../../types/subscription";

export function money(v: string | number, currency: string): string {
  return `${currency} ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function invoiceBadge(status: string): string {
  return ({ draft: "secondary", sent: "info", paid: "success", void: "dark" } as Record<string, string>)[status] || "secondary";
}

function firstOfMonth(): string {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function lastOfMonth(): string {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [filterCompany, setFilterCompany] = useState<number>(0);
  const [filterStatus, setFilterStatus] = useState("");
  const [gen, setGen] = useState({ company_id: 0, period_start: firstOfMonth(), period_end: lastOfMonth() });
  const [payRef, setPayRef] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    try {
      const [i, s] = await Promise.all([
        getInvoices({ company_id: filterCompany || undefined, status: filterStatus || undefined }),
        getSubscriptions(),
      ]);
      setInvoices(i.data);
      setSubs(s.data);
    } catch (e: any) {
      setAlert({ type: "danger", message: e.message });
    }
  }, [filterCompany, filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); setAlert({ type: "success", message: ok }); await load(); }
    catch (e: any) { setAlert({ type: "danger", message: e.message }); }
    finally { setBusy(false); }
  }

  function handleGenerate(e: FormEvent) {
    e.preventDefault();
    if (!gen.company_id) { setAlert({ type: "warning", message: "Select a company." }); return; }
    run(async () => {
      const r = await generateInvoice(gen);
      navigate(`/master/invoices/${r.data.id}`);
    }, "Invoice generated.");
  }

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-3">Invoices</h4>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />

      <div className="card mb-3"><div className="card-header">Generate invoice</div><div className="card-body">
        <form className="row g-2 align-items-end" onSubmit={handleGenerate}>
          <div className="col-md-4"><label className="form-label">Company</label>
            <select className="form-select" value={gen.company_id} onChange={e => setGen(g => ({ ...g, company_id: Number(e.target.value) }))}>
              <option value={0}>Select…</option>
              {subs.map(s => <option key={s.id} value={s.company_id}>{s.company_name} ({s.active_licenses} licences)</option>)}
            </select></div>
          <div className="col-md-3"><label className="form-label">Period start</label>
            <input type="date" className="form-control" value={gen.period_start} onChange={e => setGen(g => ({ ...g, period_start: e.target.value }))} required /></div>
          <div className="col-md-3"><label className="form-label">Period end</label>
            <input type="date" className="form-control" value={gen.period_end} onChange={e => setGen(g => ({ ...g, period_end: e.target.value }))} required /></div>
          <div className="col-md-2"><button className="btn btn-primary w-100" disabled={busy}>Generate</button></div>
        </form>
      </div></div>

      <div className="d-flex gap-2 mb-2">
        <select className="form-select form-select-sm w-auto" value={filterCompany} onChange={e => setFilterCompany(Number(e.target.value))}>
          <option value={0}>All companies</option>
          {subs.map(s => <option key={s.id} value={s.company_id}>{s.company_name}</option>)}
        </select>
        <select className="form-select form-select-sm w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["draft", "sent", "paid", "void"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card"><div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead><tr><th>Number</th><th>Company</th><th>Period</th><th>Issued</th><th>Due</th><th className="text-end">Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {invoices.length === 0 ? <tr><td colSpan={8} className="text-center text-muted py-4">No invoices.</td></tr>
            : invoices.map(inv => (
              <tr key={inv.id}>
                <td><button className="btn btn-link p-0" onClick={() => navigate(`/master/invoices/${inv.id}`)}>{inv.invoice_number}</button></td>
                <td>{inv.company_name}</td>
                <td>{inv.period_start} → {inv.period_end}</td>
                <td>{inv.issue_date}</td>
                <td>{inv.due_date}</td>
                <td className="text-end">{money(inv.total, inv.currency)}</td>
                <td><span className={`badge bg-${invoiceBadge(inv.status)}`}>{inv.status}</span>{inv.payment_ref && <div className="small text-muted">{inv.payment_ref}</div>}</td>
                <td className="text-end">
                  {(inv.status === "draft" || inv.status === "sent") && (
                    <div className="d-inline-flex gap-1">
                      <input className="form-control form-control-sm" style={{ width: 130 }} placeholder="Payment ref"
                        value={payRef[inv.id] || ""} onChange={e => setPayRef(p => ({ ...p, [inv.id]: e.target.value }))} />
                      <button className="btn btn-success btn-sm" disabled={busy}
                        onClick={() => run(() => markInvoicePaid(inv.id, payRef[inv.id]), `${inv.invoice_number} marked paid.`)}>Paid</button>
                      <button className="btn btn-outline-dark btn-sm" disabled={busy}
                        onClick={() => run(() => voidInvoice(inv.id), `${inv.invoice_number} voided.`)}>Void</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/pages/master/InvoiceView.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getInvoice } from "../../api/invoiceApi";
import AlertMessage from "../../components/AlertMessage";
import { money, invoiceBadge } from "./InvoiceList";
import type { Invoice } from "../../types/invoice";

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [alert, setAlert] = useState({ type: "", message: "" });

  useEffect(() => {
    getInvoice(Number(id)).then(r => setInv(r.data)).catch((e: any) => setAlert({ type: "danger", message: e.message }));
  }, [id]);

  if (!inv) return <div className="container py-4"><AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />Loading…</div>;
  const b = inv.billing_snapshot || {};

  return (
    <div className="container py-4">
      <div className="d-flex gap-2 mb-3 d-print-none">
        <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Back</button>
      </div>
      <div className="bg-white p-4 border rounded" style={{ maxWidth: 800, margin: "0 auto" }} id="invoice-card">
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <h3 className="mb-0">TAX INVOICE</h3>
            <div className="text-muted">{inv.invoice_number}</div>
          </div>
          <span className={`badge bg-${invoiceBadge(inv.status)} fs-6`}>{inv.status.toUpperCase()}</span>
        </div>
        <hr />
        <div className="row">
          <div className="col-6">
            <div className="text-muted small">Billed to</div>
            <div className="fw-semibold">{b.name || inv.company_name}</div>
            <div className="small">{[b.address, b.city, b.state, b.pincode].filter(Boolean).join(", ")}</div>
            {b.gst_number && <div className="small">GSTIN: {b.gst_number}</div>}
          </div>
          <div className="col-6 text-end small">
            <div>Issue date: <strong>{inv.issue_date}</strong></div>
            <div>Due date: <strong>{inv.due_date}</strong></div>
            <div>Period: <strong>{inv.period_start} → {inv.period_end}</strong></div>
            {inv.paid_at && <div>Paid: <strong>{new Date(inv.paid_at).toLocaleDateString()}</strong>{inv.payment_ref ? ` (${inv.payment_ref})` : ""}</div>}
          </div>
        </div>
        <table className="table mt-4">
          <thead><tr><th>Description</th><th className="text-end">Qty</th><th className="text-end">Unit price</th><th className="text-end">Amount</th></tr></thead>
          <tbody>
            {inv.lines.map(l => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td className="text-end">{Number(l.quantity)}</td>
                <td className="text-end">{money(l.unit_price, inv.currency)}</td>
                <td className="text-end">{money(l.amount, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="text-end">Subtotal</td><td className="text-end">{money(inv.subtotal, inv.currency)}</td></tr>
            <tr><td colSpan={3} className="text-end">GST @ {Number(inv.tax_rate)}%</td><td className="text-end">{money(inv.tax_amount, inv.currency)}</td></tr>
            <tr className="fw-bold"><td colSpan={3} className="text-end">Total</td><td className="text-end">{money(inv.total, inv.currency)}</td></tr>
          </tfoot>
        </table>
        <p className="text-muted small mb-0">Generated by EcoNetVision ERP. This is a computer-generated invoice.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add routes in `frontend/src/App.tsx`**

Imports:

```tsx
import InvoiceList        from "./pages/master/InvoiceList";
import InvoiceView        from "./pages/master/InvoiceView";
```

Routes, after `master/subscriptions/:id`:

```tsx
        <Route path="master/invoices" element={
          <RequireAuth roles={["master"]}><InvoiceList /></RequireAuth>
        } />
        <Route path="master/invoices/:id" element={
          <RequireAuth roles={["master","admin"]}><InvoiceView /></RequireAuth>
        } />
```

(`InvoiceView` is master + admin so the admin subscription page can open an invoice; the backend already scopes admins to their own company.)

- [ ] **Step 4: Build**

Run from `frontend/`: `CI=true npm run build 2>&1 | tail -15`
Expected: `Compiled successfully.`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/master/InvoiceList.tsx frontend/src/pages/master/InvoiceView.tsx frontend/src/App.tsx
git commit -m "feat(licensing): master invoice list, generation, and printable invoice view" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Admin read-only page, dashboard seat widget

**Files:**
- Create: `frontend/src/components/SeatUsageWidget.tsx`, `frontend/src/pages/settings/SubscriptionInfo.tsx`
- Modify: `frontend/src/App.tsx` (route), `frontend/src/pages/dashboard/Dashboard.tsx` (widget)

**Interfaces:**
- Consumes: `getMySubscription`, `getInvoices` (Task 8); `SubscriptionDetail` type; `seatsLabel`, `statusBadge` from Task 9; `money`, `invoiceBadge` from Task 10.

- [ ] **Step 1: Create `frontend/src/components/SeatUsageWidget.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMySubscription } from "../api/subscriptionApi";
import type { SubscriptionDetail } from "../types/subscription";

/** Seat usage + renewal banner for admins. Fed by GET /api/subscriptions/my. Renders nothing on 404. */
export default function SeatUsageWidget() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);

  useEffect(() => {
    getMySubscription().then(r => setSub(r.data)).catch(() => setSub(null));
  }, []);

  if (!sub) return null;
  const atCap = sub.capacity !== null && sub.seats_used >= sub.capacity;
  const pct = sub.capacity ? Math.min(100, Math.round(sub.seats_used / sub.capacity * 100)) : 0;
  const color = atCap ? "danger" : pct >= 80 ? "warning" : "success";
  const expiringSoon = sub.days_to_renewal !== null && sub.days_to_renewal <= 30;

  return (
    <div className="card shadow-sm mb-4" style={{ cursor: "pointer" }} onClick={() => navigate("/subscription")}>
      <div className="card-body py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="text-muted small">Licensed seats</div>
            <div className="fs-5 fw-semibold">
              {sub.capacity === null ? `${sub.seats_used} seats (unlimited)` : `${sub.seats_used} / ${sub.capacity} seats`}
            </div>
          </div>
          <div className="text-end small text-muted">
            {sub.admins_used} / {sub.admin_cap} admins · {sub.active_licenses} licence{sub.active_licenses === 1 ? "" : "s"}
          </div>
        </div>
        {sub.capacity !== null && (
          <div className="progress mt-2" style={{ height: 8 }}>
            <div className={`progress-bar bg-${color}`} role="progressbar" style={{ width: `${pct}%` }} />
          </div>
        )}
        {expiringSoon && (
          <div className={`alert alert-${sub.days_to_renewal! < 0 ? "danger" : "warning"} py-1 px-2 mt-2 mb-0 small`}>
            {sub.days_to_renewal! < 0
              ? "Your subscription has expired. Contact your provider to renew."
              : `Your subscription renews in ${sub.days_to_renewal} day${sub.days_to_renewal === 1 ? "" : "s"}.`}
          </div>
        )}
        {!sub.is_valid && !expiringSoon && (
          <div className="alert alert-danger py-1 px-2 mt-2 mb-0 small">{sub.reason}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/pages/settings/SubscriptionInfo.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMySubscription } from "../../api/subscriptionApi";
import { getInvoices } from "../../api/invoiceApi";
import AlertMessage from "../../components/AlertMessage";
import SeatUsageWidget from "../../components/SeatUsageWidget";
import { statusBadge, seatsLabel } from "../master/SubscriptionList";
import { money, invoiceBadge } from "../master/InvoiceList";
import type { SubscriptionDetail } from "../../types/subscription";
import type { Invoice } from "../../types/invoice";

export default function SubscriptionInfo() {
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getMySubscription(), getInvoices()])
      .then(([s, i]) => { setSub(s.data); setInvoices(i.data); })
      .catch((e: any) => setAlert({ type: "warning", message: e.message }))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return <div className="container py-4">Loading…</div>;

  return (
    <div className="container py-4">
      <h4 className="mb-3">Subscription</h4>
      <AlertMessage {...alert} onClose={() => setAlert({ type: "", message: "" })} />
      {!sub ? (
        <p className="text-muted">No subscription is on record for your company. Contact your provider.</p>
      ) : (
        <>
          <SeatUsageWidget />
          <div className="row g-3 mb-4">
            <div className="col-md-3"><div className="card h-100"><div className="card-body">
              <div className="text-muted small">Plan</div>
              <div className="fs-5 text-capitalize">{sub.plan} <span className={`badge bg-${statusBadge(sub.status)} ms-1`}>{sub.status}</span></div>
            </div></div></div>
            <div className="col-md-3"><div className="card h-100"><div className="card-body">
              <div className="text-muted small">Renewal</div>
              <div className="fs-5">{sub.ends_at ? new Date(sub.ends_at).toLocaleDateString() : "No expiry"}</div>
              {sub.days_to_renewal !== null && <div className="small text-muted">{sub.days_to_renewal} days</div>}
            </div></div></div>
            <div className="col-md-3"><div className="card h-100"><div className="card-body">
              <div className="text-muted small">Seats</div><div className="fs-5">{seatsLabel(sub.seats_used, sub.capacity)}</div>
            </div></div></div>
            <div className="col-md-3"><div className="card h-100"><div className="card-body">
              <div className="text-muted small">Admins</div><div className="fs-5">{sub.admins_used} / {sub.admin_cap}</div>
            </div></div></div>
          </div>

          <div className="card mb-4"><div className="card-header">Licensed sites</div>
            <div className="table-responsive"><table className="table table-sm align-middle mb-0">
              <thead><tr><th>Site</th><th>Seats</th><th>Admins</th><th>Status</th><th>Since</th></tr></thead>
              <tbody>
                {sub.licenses.filter(l => l.status === "active").length === 0
                  ? <tr><td colSpan={5} className="text-center text-muted py-3">No active licences.</td></tr>
                  : sub.licenses.filter(l => l.status === "active").map(l => (
                    <tr key={l.id}>
                      <td>{l.site_name || "Company-wide"}</td>
                      <td>{l.max_users === null ? "Unlimited" : l.max_users}</td>
                      <td>{l.max_admins}</td>
                      <td><span className="badge bg-success">active</span></td>
                      <td>{l.granted_at ? new Date(l.granted_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      <div className="card"><div className="card-header">Invoice history</div>
        <div className="table-responsive"><table className="table table-sm align-middle mb-0">
          <thead><tr><th>Number</th><th>Period</th><th>Due</th><th className="text-end">Total</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.length === 0 ? <tr><td colSpan={5} className="text-center text-muted py-3">No invoices.</td></tr>
            : invoices.map(inv => (
              <tr key={inv.id}>
                <td><button className="btn btn-link p-0" onClick={() => navigate(`/master/invoices/${inv.id}`)}>{inv.invoice_number}</button></td>
                <td>{inv.period_start} → {inv.period_end}</td>
                <td>{inv.due_date}</td>
                <td className="text-end">{money(inv.total, inv.currency)}</td>
                <td><span className={`badge bg-${invoiceBadge(inv.status)}`}>{inv.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Route in `frontend/src/App.tsx`**

Import: `import SubscriptionInfo   from "./pages/settings/SubscriptionInfo";`

Route, in the admin section (next to `company-settings`):

```tsx
        <Route path="subscription" element={
          <RequireAuth roles={["admin"]}><SubscriptionInfo /></RequireAuth>
        } />
```

- [ ] **Step 4: Dashboard widget for admins in `frontend/src/pages/dashboard/Dashboard.tsx`**

Add the import next to `SystemInfo`:

```tsx
import SeatUsageWidget from "../../components/SeatUsageWidget";
```

Find the line `{(auth?.role === "admin" || auth?.role === "master") && <SystemInfo />}` and insert directly above it:

```tsx
      {auth?.role === "admin" && <SeatUsageWidget />}
```

- [ ] **Step 5: Build**

Run from `frontend/`: `CI=true npm run build 2>&1 | tail -15`
Expected: `Compiled successfully.`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SeatUsageWidget.tsx frontend/src/pages/settings/SubscriptionInfo.tsx frontend/src/App.tsx frontend/src/pages/dashboard/Dashboard.tsx
git commit -m "feat(licensing): admin subscription page and dashboard seat widget" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Docs, then manual regression on local Docker

**Files:**
- Modify: `AGENTS.md` (the "**No test framework**" line and the env var table), `README.md:64-74`

- [ ] **Step 1: Update `AGENTS.md`**

Replace the line `**No test framework** is configured (no pytest, no jest/react-testing-library).` with:

```markdown
**Backend tests**: `cd backend && python -m pytest tests -q` (pure-function tests for geofence, seat/licence maths, enforcement and invoices; no DB needed). No frontend test framework.
```

Append to the Environment Variables table:

```markdown
| `LICENSE_KEY` | _(empty)_ — when set, subscription validity checks are bypassed; seat and admin caps are still enforced (D7) |
| `LICENSE_ENFORCE` | `true` — `false` bypasses validity like `LICENSE_KEY` |
```

- [ ] **Step 2: Update `README.md` licensing section (lines 64-74)**

Replace that section's body with:

```markdown
Licensing is per company + site. Master creates a **subscription** (plan, billing cycle, price, GST) and grants **site licences** (26 seats + 1 admin each, stackable) from *Billing → Subscriptions*. Seats are metered company-wide; new users are rejected with `Seat limit exceeded (n/n)` or `Admin limit exceeded (n/n)`. Revoking a licence never locks out existing users. Invoices are generated from *Billing → Invoices* and printed from the browser. Setting `LICENSE_KEY` (or `LICENSE_ENFORCE=false`) bypasses validity checks but **not** seat caps.
```

- [ ] **Step 3: Commit docs**

```bash
git add AGENTS.md README.md
git commit -m "docs: describe subscription licensing and backend tests" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 4: Manual regression (local Docker, no deploy)**

```bash
docker compose up --build -d
```
Then in a browser at `http://localhost:3000`, logged in as `master` / `master123` (seeded), walk spec §8:

1. Billing → Subscriptions → New subscription for a company with 3 initial licences → detail shows `0 / 78` seats, `0 / 3` admins.
2. Users → add users until the cap: the 79th is rejected with `Seat limit exceeded (78/78)`.
3. Add a 4th admin → `Admin limit exceeded (3/3)`.
4. Employees → Import an Excel sheet larger than remaining capacity → result stops at the **first** rejected row with `Seat limit exceeded (…) — this and all remaining rows were skipped`.
5. Revoke one licence while over capacity → existing users still log in; creating a user is rejected.
6. Billing → Invoices → Generate for the current month → 3 lines, GST 18%, number `INV-2026-0001`; open → Print preview renders.
7. Log in as a company admin → *Subscription* page and dashboard widget show the same numbers; the widget turns amber at ≥ 80% and red at cap.
8. Attendance, payslips, payroll, vehicles and tracking pages still load.

Record any failure as a bug and fix it before finishing. There is no commit for this step unless a fix was needed.

---

## Self-review notes

- Spec coverage: §3 tables → Task 1; §4 seat maths + enforcement + bulk-import trap → Tasks 2–4; §5 API → Tasks 5–6; §6 frontend → Tasks 8–11; §7 migration both directions → Tasks 1, 7; §8 tests → Tasks 2, 3, 6 (pure) and Task 12 (manual); D7/D6 → Task 3 tests; `enforce_seat_limit(db, company_id, role)` signature → Task 4.
- Deviation from spec: migration number is `0031` (spec said `0030`, now taken by geofence). `POST /api/licenses` returns a list (one per created licence) since `quantity` may create several rows. Money fields cross the wire as JSON strings (Pydantic `Decimal`).
- Known limitation carried from the spec: the master site picker lists locations returned by `GET /api/locations` for the master user; the backend validates that the chosen site belongs to the subscription's company and answers 400 otherwise.
