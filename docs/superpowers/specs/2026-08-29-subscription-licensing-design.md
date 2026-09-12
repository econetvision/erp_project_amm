# Subscription & Site Licensing — Design

**Date:** 2026-08-29
**Status:** Approved design, pending implementation plan
**Scope:** Backend model + API, master console UI, admin visibility, invoice generation

---

## 1. Problem

Licensing today is company-level and invisible:

- `company_licenses` holds **one row per company** (`company_id` is `UNIQUE`) with a free-form
  `max_seats`. There is no notion of a *site*.
- Seats are counted as "every active non-`master` user in the company"
  (`license_service.count_active_seats`).
- **No frontend exists at all** — `grep -i license frontend/src` returns nothing. The
  `/api/licenses` endpoints work but nothing in the UI calls them.
- There is no subscription, no billing period, and no invoicing.

We need licences sold per **company + site**, each covering **26 users (25 + 1 admin)**, granted
and revoked **only by `master`**, with **invoices** generated from master.

---

## 2. Decisions

These were settled during brainstorming and are not open for re-litigation during implementation.

| # | Decision | Choice |
|---|---|---|
| D1 | Relationship to `company_licenses` | **Full replace.** New `subscriptions` + `licenses` tables; `company_licenses` is migrated then dropped. |
| D2 | How a user consumes a seat | **Company-wide pool.** Capacity = Σ of the company's active licences. No per-site metering. |
| D3 | Seat maths | **26 seats per licence shared across roles, plus a separate cap of 1 admin per licence.** |
| D4 | Multiple licences for one site | **Allowed (stacking).** No uniqueness on `(company_id, site_id)`. Each adds 26 seats + 1 admin slot. |
| D5 | What a subscription carries | **Billing envelope.** Plan, period, status, price, tax and features live on the subscription; licences inherit validity and features from it. |
| D6 | Revoke semantics | **Soft.** Revoking is always allowed; existing users keep working; only *new* users are blocked while over capacity. |
| D7 | `LICENSE_KEY` bypass | **Validity only.** It still skips status/expiry and the external server; it **never** skips seat or admin-cap enforcement. |
| D8 | Invoices | **Auto-generated from licences, with GST**, persisted with a sequential number and paid/unpaid status. |
| D9 | UI scope | **Full** — master console, admin read-only page, dashboard seat widget. |

### Assumptions (stated, not confirmed — strike these if wrong)

- **A1 — Pricing.** `unit_price` (per licence, per billing cycle) is set on the subscription by
  master. `currency` defaults from `companies.currency` (INR). `tax_rate` defaults to `18.00`
  and is editable per subscription.
- **A2 — Tests.** `pytest` is introduced, covering **only** the seat/capacity/admin-cap maths and
  invoice totals. This is deliberately not a general test-coverage push; it exists because these
  two areas silently cause either lockouts or wrong money.

---

## 3. Data model

Four new tables. `company_licenses` is dropped after migration.

### `subscriptions`

One **active** subscription per company (enforced by a partial unique index; historical
cancelled rows are retained).

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `company_id` | FK companies CASCADE | |
| `plan` | varchar(20) | `basic` \| `pro` \| `enterprise` |
| `status` | varchar(20) | `trial` \| `active` \| `past_due` \| `suspended` \| `cancelled` |
| `billing_cycle` | varchar(10) | `monthly` \| `yearly` |
| `starts_at` | timestamptz | |
| `ends_at` | timestamptz NULL | NULL = perpetual |
| `unit_price` | numeric(12,2) | per licence per cycle |
| `currency` | varchar(3) | default from `companies.currency` |
| `tax_rate` | numeric(5,2) | GST %, default 18.00 |
| `features` | JSONB NULL | feature flags; NULL = all allowed (matches current `has_feature`) |
| `notes` | text NULL | |
| `created_at` / `updated_at` | timestamptz | |

### `licenses`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `subscription_id` | FK subscriptions CASCADE | |
| `company_id` | FK companies CASCADE | denormalised — every seat query and tenant filter needs it |
| `site_id` | FK work_locations SET NULL, **nullable** | NULL = company-wide (how legacy rows migrate in) |
| `license_key` | varchar(64) UNIQUE | generated `secrets.token_urlsafe(32)` |
| `status` | varchar(20) | `active` \| `revoked` |
| `max_users` | int NULL | default 26; **NULL = unlimited** (preserves legacy `max_seats IS NULL`) |
| `max_admins` | int | default 1 |
| `granted_by` / `granted_at` | FK users / timestamptz | |
| `revoked_by` / `revoked_at` / `revoke_reason` | FK users / timestamptz / text | |
| `created_at` / `updated_at` | timestamptz | |

**No unique constraint on `(company_id, site_id)`** — stacking is intentional (D4).
Index: `(company_id, status)` — the hot path for capacity.

### `invoices`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `invoice_number` | varchar(30) UNIQUE | `INV-{YYYY}-{NNNN}` |
| `company_id` / `subscription_id` | FK | |
| `period_start` / `period_end` | date | |
| `issue_date` / `due_date` | date | |
| `currency` | varchar(3) | |
| `subtotal` / `tax_rate` / `tax_amount` / `total` | numeric | |
| `status` | varchar(20) | `draft` \| `sent` \| `paid` \| `void` |
| `paid_at` / `payment_ref` | timestamptz / varchar(100) | |
| `billing_snapshot` | JSONB | company name, address, GST **frozen at issue time** |
| `created_by` | FK users | |
| `created_at` / `updated_at` | timestamptz | |

`billing_snapshot` exists so a reprinted invoice never silently changes when the company edits
its address or GST number.

### `invoice_lines`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `invoice_id` | FK invoices CASCADE | |
| `license_id` | FK licenses SET NULL | line survives licence deletion |
| `description` | varchar(255) | e.g. `Site licence — HQ (26 seats)` |
| `quantity` / `unit_price` / `amount` | numeric | |

---

## 4. Seat maths — `services/subscription_service.py`

```
active_licenses(company) = licenses WHERE company_id = ? AND status = 'active'

capacity(company)    = NULL if any active licence has max_users IS NULL   # unlimited
                     = Σ max_users  otherwise
admin_cap(company)   = Σ max_admins over active licences
seats_used(company)  = COUNT(users WHERE company_id = ? AND role != 'master'
                                     AND is_active IS NOT FALSE)
admins_used(company) = same, AND role = 'admin'
```

`is_active IS NOT FALSE` preserves today's behaviour where `NULL` counts as active.

### Enforcement

```
evaluate(company, check_seats=False, role=None) -> (subscription, reason|None)

  # D7: LICENSE_KEY / LICENSE_ENFORCE=false skip ONLY the block below
  if not bypass_active():
      subscription missing            -> NO_SUBSCRIPTION
      status not in (trial, active)   -> SUSPENDED
      ends_at in the past             -> EXPIRED
      zero active licences            -> NO_LICENSE

  # Always enforced, bypass or not (D7)
  if check_seats:
      # Nothing to meter against -> unmetered. See "unlicensed company" below.
      if bypass_active() and no subscription and no active licences:
          pass
      else:
          capacity is not NULL and seats_used  >= capacity   -> SEAT_LIMIT
          role == 'admin' and admins_used >= admin_cap       -> ADMIN_LIMIT
```

**The unlicensed-company case (resolved ambiguity).** D7 says seats are always enforced, but a
company with *no* subscription and *no* licences has `capacity = 0`. Read literally that would
make it impossible to create **any** user in such a company — and under `LICENSE_KEY` bypass
that is exactly the state our own deployments are in today, so a literal reading would brick
user creation on upgrade.

Resolution: seats are metered **against the licences that exist**. When bypass is active *and*
the company has no subscription and no licences at all, there is nothing to meter and seat
checks pass. As soon as a company has any subscription or licence, its caps are enforced —
including under bypass. This preserves D7's actual intent (you cannot dodge the 26-seat cap by
setting `LICENSE_KEY`) without locking anyone out.

Without bypass, the same company is rejected earlier with `NO_SUBSCRIPTION`, exactly as today's
code rejects it with `NO_LICENSE`.

Denial messages carry the numbers: `Seat limit exceeded (78/78)`,
`Admin limit exceeded (3/3)`.

**Signature change:** `enforce_seat_limit(db, company_id)` becomes
`enforce_seat_limit(db, company_id, role)` — the admin cap cannot be applied without knowing
the role being added. Three call sites update:

- `routers/auth.py:209` — pass `payload.role`
- `routers/employees.py:198` — pass the resolved `role`
- `routers/employees.py:453` — see below

### Bulk import — already correct, must not regress

An earlier draft of this spec claimed the bulk Excel import bypassed the seat cap. **That was
wrong**, and it was disproved empirically during validation (licence capped at 4 with 2 seats
used, 5-row file imported → `created: 2, failed: 1`, row 4 reported *"License seat limit reached
— this and all remaining rows were skipped"*).

The reason: `enforce_seat_limit` lives at `employees.py:198`, **inside** the shared
`_persist_employee` helper (lines 163–218), which *both* the single-create endpoint (line 226)
and the import loop (line 505) call. So every row is checked. The extra call at line 453 is a
fail-fast optimisation, not the only guard. **No refactor is needed here.**

> **Trap this creates for the implementation.** The import loop at `employees.py:515` breaks out
> early via an exact string comparison:
> ```python
> if he.detail == SEAT_LIMIT:      # SEAT_LIMIT = "Seat limit exceeded"
> ```
> §4 changes the denial message to carry counts (`Seat limit exceeded (78/78)`). That equality
> check would then **silently never match**, and a 500-row import over the cap would stop
> breaking early — grinding through every remaining row and reporting a generic error on each.
>
> Required: stop matching on the message. Raise a typed error (or attach a machine-readable
> `reason` code such as `SEAT_LIMIT` / `ADMIN_LIMIT` to the exception) and have the import branch
> on that code, with the human-readable counts kept only for display. A regression test covers
> "import over cap still breaks at the first rejected row".

### Validity call sites (unchanged in shape)

`validate_company_license` keeps its name and 403 behaviour so
`auth/dependencies.py:145` (`require_valid_license`, mounted on most routers via `_licensed` in
`main.py`) and `routers/auth.py:39,78` (login) need no structural change — only the service it
delegates to changes.

---

## 5. API

All mutations are `master`-only (`require_master`) and write an `AuditLog` row
(`user_id`, `company_id`, `action`, `entity_type`, `entity_id`, `details`) — matching the
existing pattern in `routers/licenses.py`.

```
/api/subscriptions
  GET    ""                 master: all (filter ?company_id); admin: own only
  POST   ""                 master — create
  GET    "/my"              admin — plan, seats, sites, renewal  (drives admin page + widget)
  GET    "/{id}"
  PUT    "/{id}"            master
  POST   "/{id}/suspend"    master
  POST   "/{id}/activate"   master

/api/licenses
  GET    ""                 master: all (filter ?company_id); admin: own only
  POST   ""                 master — grant {subscription_id, site_id?, quantity=1}
  GET    "/{id}"
  POST   "/{id}/revoke"     master — soft revoke {reason}
  (no DELETE — revoked rows are retained for audit)

/api/invoices
  POST   "/generate"        master {company_id, period_start, period_end}
  GET    ""                 master: all; admin: own only
  GET    "/{id}"            includes lines
  POST   "/{id}/mark-paid"  master {payment_ref?}
  POST   "/{id}/void"       master
```

`POST /api/licenses` with `quantity: n` creates *n* licence rows in one call — this is the
"buy more capacity" flow (D4), not a `quantity` column.

### Invoice generation

1. Load the company's subscription and its licences active during `[period_start, period_end]`.
2. One line per licence: `Site licence — {site.location_name or "Company-wide"} ({max_users} seats)`,
   `quantity = 1`, `unit_price = subscription.unit_price`.
3. `subtotal = Σ amount`; `tax_amount = subtotal × tax_rate / 100`; `total = subtotal + tax_amount`.
4. `invoice_number = INV-{year}-{seq}` where `seq` is `MAX(seq for that year) + 1`, allocated
   inside the same transaction as the insert (`SELECT … FOR UPDATE` on the year's rows) so
   concurrent generation cannot duplicate a number.
5. Snapshot company `name`, `address`, `city`, `state`, `pincode`, `gst_number` into
   `billing_snapshot`.
6. Created as `status = 'draft'`.

Rounding: all money is `numeric` and rounded half-up to 2 decimals at each of subtotal, tax and
total.

---

## 6. Frontend

Follows existing conventions: TypeScript, Bootstrap 5 classes directly (no React-Bootstrap),
`AlertMessage` + `useState({type, message})` alert pattern, one API module per domain with named
exports.

**API modules**
- `api/subscriptionApi.ts` — subscriptions + licences (one domain from the UI's perspective)
- `api/invoiceApi.ts`
- `types/subscription.ts`, `types/invoice.ts`

**Master pages** (`pages/master/`)
- `SubscriptionList.tsx` — every company, plan, status, seats used/total, renewal date
- `SubscriptionDetail.tsx` — edit plan/price/period; grant & revoke licences inline (site
  picker from `work_locations`, quantity); licence table with status and revoke reason
- `InvoiceList.tsx` — filter by company/status; generate for a period; mark paid; void
- `InvoiceView.tsx` — printable invoice, `window.print()` exactly as
  `pages/payslips/PayslipView.tsx:103` does. **No new PDF dependency.**

**Admin page**
- `pages/settings/SubscriptionInfo.tsx` — read-only: plan, renewal date, seats used/total,
  admins used/cap, licensed sites, invoice history. No grant/revoke controls.

**Dashboard**
- `components/SeatUsageWidget.tsx` — `61 / 78 seats` with a progress bar, amber ≥ 80%, red at
  cap; plus a banner when the subscription expires within 30 days. Fed by
  `GET /api/subscriptions/my`.

**Routing & nav** — new routes in `App.tsx`; `Sidebar.tsx` gains a Billing group:
`Subscriptions`, `Invoices` (`roles: ["master"]`) and `Subscription` (`roles: ["admin"]`).

---

## 7. Migration

Per AGENTS.md, a schema change touches **three** places: the model, a new Alembic migration, and
`db/init.sql`.

`alembic/versions/0030_subscriptions_licenses_invoices.py`:

1. Create `subscriptions`, `licenses`, `invoices`, `invoice_lines`.
2. **Data migration** — for each `company_licenses` row:
   - insert a `subscription`: `plan = tier`, `status = 'active' if status='active' else 'suspended'`,
     `starts_at = valid_from`, `ends_at = valid_until`, `features = features`,
     `unit_price = 0`, `currency` from the company, `tax_rate = 18.00`, `notes` carried over
   - insert one `license`: `site_id = NULL`, `max_users = max_seats` (**NULL stays NULL =
     unlimited**), `max_admins = 1`, `license_key` reused, `status` mapped
   - capacity is preserved exactly — no company gains or loses seats at migration time
3. Drop `company_licenses`.

`db/init.sql` — add all four tables. Note it is **currently missing `company_licenses`
entirely**, so this also repairs existing drift.

**Downgrade** recreates `company_licenses` and maps the first active licence per company back.

---

## 8. Testing

`pytest` + `httpx`, added to `backend/requirements.txt` (assumption A2). Scope is deliberately
narrow — `backend/tests/`:

- `test_seat_maths.py` — capacity with 1/2/3 licences; unlimited (`max_users IS NULL`);
  admin cap reached while seats remain; seats reached while admin slots remain; revoked licences
  excluded; `is_active IS NULL` counts as active; `master` never consumes a seat.
- `test_enforcement.py` — `LICENSE_KEY` set still enforces seats and the admin cap (D7 — the
  regression most likely to be reintroduced); a bypassed company with **no** subscription and no
  licences stays unmetered (§4 unlicensed-company case — the counterpart regression, which would
  brick user creation); suspended/expired subscription blocks login; soft revoke leaves existing
  users working but blocks the next create (D6).
- `test_invoice.py` — line generation from licences; GST maths and rounding; sequential
  numbering under concurrent generation.

### Manual regression (local Docker, no deploy)

Run against `localhost:3001` / `8088` / pg `5434`:

1. Fresh volume → migrations apply cleanly from empty **and** from a DB holding legacy
   `company_licenses` rows (test both directions, plus `downgrade`).
2. `master`/`master123` → create subscription → grant 3 licences → seats show `n/78`.
3. Add users to the cap → 79th rejected with `Seat limit exceeded (78/78)`.
4. Add a 4th admin with 3 licences → `Admin limit exceeded (3/3)`.
5. Bulk-import an Excel sheet larger than remaining capacity → still stops at the **first**
   rejected row (not after grinding through every row) — guards the §4 string-comparison trap.
6. Revoke a licence while over capacity → existing users still log in; new user blocked.
7. Generate an invoice → correct lines, GST, sequential number → print view renders.
8. Admin logs in → read-only subscription page and dashboard widget show the right numbers.
9. Existing flows unaffected: attendance, payslips, payroll, vehicles, tracking.

---

## 9. Out of scope

- Payment gateway / online payment collection. Invoices record `paid` state only.
- Per-site seat metering (explicitly rejected — D2).
- Changes to the external license server protocol (`services/license_client.py`) — it keeps its
  current contract.
- Mobile app changes. The Android client is unaffected; it only ever sees the 403 reason string.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Dropping `company_licenses` is irreversible in prod | Data migration is verified locally in both directions before anything ships; `downgrade` implemented and tested. |
| D7 makes seats enforceable where they previously were not — a deployment with `LICENSE_KEY` set and more users than licences could start rejecting **new** user creation on upgrade | Migration preserves capacity exactly (`max_users = old max_seats`, unlimited stays unlimited), so no company is newly over capacity. Existing users are never locked out (D6). |
| `enforce_seat_limit` signature change | Only 3 call sites, all in this repo; compile/test covers them. |
| Invoice number races | Sequence allocated under `SELECT … FOR UPDATE` in the insert transaction. |
