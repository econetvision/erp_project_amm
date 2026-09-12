# Push notifications and work-location alerts

## What it does

While an employee is clocked in, the Android app shares their position with
the backend once a minute. If three consecutive checks land outside every
assigned work location (radius plus the 25 m GPS buffer), the backend:

1. Records a `geofence_exit_events` row.
2. Writes an in-app notification for the location's supervisor
   (`work_locations.supervisor_id`) and every active admin in the company.
3. Sends a Firebase Cloud Messaging (FCM) push to each of those users' phones,
   when Firebase is configured.

When the employee comes back inside, the event is closed and the same people
get a "returned" notice. Admins and supervisors can review episodes on the web
under Fleet & Tracking > Location Alerts, or via `GET /api/geofence/events`.

Tracking stops automatically at clock-out: the ping endpoint answers
`tracking=false` and the app shuts down its location service.

## Backend configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEOFENCE_BUFFER_M` | 25 | GPS tolerance added to each location radius |
| `GEOFENCE_EXIT_CONSECUTIVE_PINGS` | 3 | Outside pings needed before an alert |
| `GEOFENCE_PING_INTERVAL_S` | 60 | Cadence the app is told to ping at |
| `FIREBASE_CREDENTIALS_JSON` | empty | Service-account JSON, inline (Railway) |
| `FIREBASE_CREDENTIALS_FILE` | empty | Path to the service-account JSON file |
| `LOCATION_RETENTION_DAYS` | 90 | Pings older than this are purged nightly |

Push is dormant until one of the two `FIREBASE_CREDENTIALS_*` variables is
set. In-app notifications work regardless.

### Getting Firebase credentials

1. Create a Firebase project at console.firebase.google.com and add an
   Android app with package name `com.econetvision.erp`.
2. Project settings > Service accounts > Generate new private key. Put the
   downloaded JSON in `FIREBASE_CREDENTIALS_JSON` (paste the whole file as the
   value) or mount it and set `FIREBASE_CREDENTIALS_FILE`.
3. Project settings > General > download `google-services.json` and copy it
   to `mobile/app/google-services.json`. The file is gitignored; the Android
   build applies the Google Services plugin only when it is present, so
   builds without it still work with push disabled.

## Migration

`0030_geofence_exit_alerts` adds `device_tokens`, `employee_location_pings`
and `geofence_exit_events`. It runs with the usual `python migrate.py upgrade`
(the container entrypoint does this).

## API

- `POST /api/geofence/ping` `{latitude, longitude, accuracy_m?}` (any role;
  workers only for themselves). Returns `{tracking, inside, distance_m,
  nearest_location, ping_interval_s, event}`.
- `GET /api/geofence/events?open_only=&employee_id=&date_from=&date_to=`
  (admin/supervisor, company scoped).
- `POST /api/notifications/device-token` `{token, platform}` and
  `DELETE /api/notifications/device-token` `{token}`.

## Android behaviour

- After clock-in (or on opening the Attendance screen while clocked in) the
  app asks once for background location and notification permission, then
  starts a low-priority foreground service ("Clocked in") that pings the
  backend. It stops on clock-out, logout, or when the backend says the
  employee is no longer clocked in.
- On login and on every cold start the app registers its FCM token. Logout
  removes it.
- Pushes arrive on the high-importance "Alerts" channel and open the app's
  Alerts tab.

## Prerequisite for routing

Alerts reach a supervisor only when the work location has
`supervisor_id` set. Locations without one still alert all company admins.
