# Physical Attendance: supervisor attendance app

Date: 2026-10-09

## Goal

Some sites have workers who do not own smartphones, so they cannot clock in
with the existing ERP app. Let an admin nominate one supervisor for such a
site. That supervisor uses a separate, attendance-only Android app to
photograph each worker; the backend recognises the face and clocks the worker
in or out. The app also shows who has come to the site today.

This is an additional feature. The existing ERP app, the existing web
attendance flows, and the existing `/api/attendance/*` endpoints do not change.

## Decisions

- **Face match only.** A scan is matched 1:N against registered faces in the
  supervisor's company. A worker with no registered face cannot be marked from
  this app; faces are registered through the existing employee screen
  (`POST /api/employees/{id}/face`).
- **One site per supervisor.** The admin picks a supervisor and a work
  location together. The admin can change or remove the site at any time. A
  supervisor never covers more than one site. Two supervisors may be given the
  same site (for example a relief supervisor); this is not blocked.
- **Location-only.** A scan is accepted only when the supervisor's phone is
  inside the assigned site's `allowed_radius_m + geofence_buffer_m`. A scan
  with no coordinates is rejected. This check replaces the scanned worker's
  own geofence check for these scans: the phone being at the site is the
  proof, and the worker does not need an assignment to that location.
- **Enabled means "has a site".** There is no separate on/off flag. Physical
  attendance is enabled for a supervisor exactly when
  `users.physical_attendance_site_id` is set, so it can never be enabled
  without a site. Deleting the work location clears it (`SET NULL`).
- **Separate APK, copied code.** The new app is a second module in the
  existing `mobile/` Gradle project. The camera, session and network code it
  needs is copied into it. No file of the existing `:app` module is modified.
- **Admin only.** Only the `admin` role (and `master`) can enable, change or
  disable physical attendance. Supervisors cannot see the web page.

## Backend

### Schema (migration `0032_physical_attendance`, mirrored in `db/init.sql`)

- `users.physical_attendance_site_id INTEGER NULL` FK `work_locations(id)`
  `ON DELETE SET NULL`.
- `attendance.site_location_id INTEGER NULL` FK `work_locations(id)`
  `ON DELETE SET NULL`: the site a record was marked at through this feature.
  Null for every record created by the existing flows.
- `attendance.marked_by INTEGER NULL` FK `users(id)` `ON DELETE SET NULL`:
  the supervisor who scanned. Null for existing flows.

### Service: `backend/services/physical_attendance_service.py`

Pure functions, unit-tested without a database:

- `is_enabled(user) -> bool`: active, role `supervisor`, site id set.
- `check_at_site(site_lat, site_lon, radius_m, buffer_m, lat, lon)
  -> SiteCheck(inside: bool, distance_m: float)`. Reuses
  `geofence_service.haversine_m`.

Database functions:

- `set_site(db, admin, supervisor_id, location_id | None)`: validates that
  the target is a `supervisor` in the admin's company and that the location is
  active and in the same company, then sets or clears the column.
- `scan(db, supervisor, image, latitude, longitude)`: loads the site, runs
  `check_at_site`, identifies the face among the company's users with
  `face_service.identify_employee`, then clocks in or out using the same rules
  as the existing `face-scan` endpoint (first scan of the day clocks in, second
  clocks out, third is rejected). Stamps `site_location_id` and `marked_by` on
  clock-in.
- `today_list(db, supervisor)`: attendance rows for today with
  `site_location_id` equal to the supervisor's site, joined to the worker's
  name and employee code, ordered by entry time.

### Auth guard

`require_physical_attendance` in `backend/auth/dependencies.py`: resolves the
current user and raises 403 "Physical attendance is not enabled for your
account. Contact your admin." unless `is_enabled(user)`.

### Router: `backend/routers/physical_attendance.py`, mounted at `/api/physical-attendance`

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | `/supervisors` | `require_admin` | Company supervisors with their assigned site (id, name) or null |
| PUT | `/supervisors/{user_id}` | `require_admin` | Body `{location_id: int \| null}`; set, change or clear the site |
| GET | `/me` | `require_physical_attendance` | Supervisor's site: id, name, latitude, longitude, radius |
| POST | `/scan` | `require_physical_attendance` | Body `{image, latitude, longitude}`; returns worker id, name, action, attendance |
| GET | `/today` | `require_physical_attendance` | Today's list for the site, plus a present count |

Errors use `HTTPException` with a `detail` string:

- 400 "Location is required. Please enable GPS and try again."
- 403 "You are {n} m from {site}. Attendance can only be marked at the site."
- 404 "No matching employee found. Register the worker's face first."
- 400 "{name} has already clocked in and out today."
- 409 on `/me`, `/scan`, `/today` when the assigned site is inactive.

Creating a new supervisor account stays in the existing
`POST /api/auth/users`; the web page calls it and then the `PUT` above.

### Login

`TokenResponse` and `UserResponse` gain a read-only
`physical_attendance_site_id: int | None`. The new app reads it to decide
whether to let the user in. The existing app ignores unknown fields.

## Web

- New page `frontend/src/pages/attendance/PhysicalAttendance.tsx` at route
  `/workforce/physical-attendance`, with API module
  `frontend/src/api/physicalAttendanceApi.ts`.
- Sidebar: new item "Physical Attendance" in the WORKFORCE section with
  `roles: ["master", "admin"]`. The route uses the same role guard.
- The page shows a table of the company's supervisors: name, username, assigned
  site, status badge (Enabled / Disabled), and actions.
  - **Enable / Change site** opens a modal with a required site dropdown
    (active work locations). Save calls the `PUT`.
  - **Disable** asks for confirmation, then calls the `PUT` with `null`.
  - **Add supervisor** opens a form (name, username, password, required site),
    creates the account through the existing user API with role `supervisor`,
    then assigns the site.
- Follows the existing Bootstrap 5 class usage and the `AlertMessage` pattern.

## Android app: "ERP Attendance"

- New Gradle module `mobile/attendance`, application id
  `com.econetvision.erp.attendance`, min SDK 26, same `API_BASE_URL` build
  config as `:app`. Installs alongside the existing app.
- Permissions: camera, fine location, internet. No Firebase, maps, biometric or
  background services.
- Copied from `:app` and trimmed: `FaceCaptureActivity`, `FaceOverlayView`,
  `SessionManager`, `AuthInterceptor`, `RetrofitClient`, and the helpers they
  need. A new, small `ApiService` declares only login and the three
  `/api/physical-attendance` calls used by the app.

Screens:

1. **Login.** Username and password. After login the app requires role
   `supervisor` and a non-null `physical_attendance_site_id`; otherwise it
   clears the session and shows "Physical attendance is not enabled for your
   account. Contact your admin."
2. **Home.** Header with the site name and today's date. A large "Scan worker"
   button. Below it the "On site today" list: name, employee code, entry time,
   exit time, with a present count and pull-to-refresh. Logout in the toolbar.
3. **Scan.** The copied capture screen, opening on the rear camera with a
   button to switch to the front camera, with the existing blink liveness
   check. On capture the app takes a fresh GPS fix and posts the image and
   coordinates. The result is shown as "{name} clocked in at HH:MM" or
   "clocked out at HH:MM", or the server's error message, and the list
   refreshes.

The server is the authority on the location rule. The app does not pre-check
distance; it displays the server's 403 message.

## CI and delivery

- New workflow `.github/workflows/build-attendance-apk.yml`: runs on pull
  requests and pushes that touch `mobile/attendance/**`, and on manual
  dispatch. Builds `:attendance:assembleDebug` and uploads the APK as a run
  artifact. It does not commit the APK back to the repository.
- The existing APK workflows are not edited. `mobile/settings.gradle.kts` gains
  `include(":attendance")`, which is the only change to an existing mobile
  file.
- Nothing is deployed from the feature branch. The migration runs when the PR
  is merged and the backend is deployed.

## Testing

- `backend/tests/test_physical_attendance.py` (pure functions, no database):
  `is_enabled` for each role, inactive user and missing site;
  `check_at_site` inside the radius, inside the buffer only, outside, and the
  reported distance.
- Existing backend suite still passes.
- Frontend: `npm run build` type-checks the new page.
- Android: the CI build of `:attendance` and of the unchanged `:app`.
- Not covered by automated tests: the camera, liveness and GPS behaviour on a
  real phone. This needs a manual check with the APK before release.

## Out of scope

- Marking a worker who has no registered face.
- Registering faces from the new app.
- Offline scanning and later sync.
- Multiple sites per supervisor.
- Any change to the existing app, payroll, or attendance reports. Records
  created here are ordinary `attendance` rows, so they appear in existing
  reports and payslips with no further work.
