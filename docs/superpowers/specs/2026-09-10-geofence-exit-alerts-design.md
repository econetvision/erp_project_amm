# Geofence exit alerts with push notifications

Date: 2026-09-10

## Goal

Notify the responsible supervisor and every company admin when a clocked-in
employee leaves their assigned work location, and again when they return.
Deliver the alert in-app (web bell, mobile Alerts tab) and as an Android push
notification via Firebase Cloud Messaging (FCM).

## Decisions

- Tracking window: the Android app sends location pings only while the
  employee is clocked in (today's attendance row has no exit time).
- Ping cadence: 60 seconds, from a foreground location service.
- Exit rule: 3 consecutive pings outside every assigned location's
  `allowed_radius_m + geofence_buffer_m`. One alert per exit episode. A
  return alert closes the episode when a ping lands back inside.
- Recipients: `WorkLocation.supervisor_id` of the nearest assigned location
  (when set) plus all active `admin` users in the employee's company. The
  employee is never a recipient.
- Push is optional: the backend sends FCM only when Firebase credentials are
  configured. In-app rows are always written.

## Backend

### New tables (migration `0030_geofence_exit_alerts`)

- `device_tokens(id, user_id FK users CASCADE, token UNIQUE(512),
  platform(20) default 'android', created_at, last_seen_at)`
- `employee_location_pings(id, employee_id FK users CASCADE, latitude,
  longitude, accuracy_m NULL, inside_geofence BOOL, nearest_location_id FK
  work_locations SET NULL, distance_m NULL, recorded_at)` with index on
  `(employee_id, recorded_at)`. Purged by the existing daily retention job.
- `geofence_exit_events(id, employee_id FK users CASCADE, location_id FK
  work_locations SET NULL, location_name, distance_m, latitude, longitude,
  exited_at, returned_at NULL, notified_user_ids JSONB)`. An open event
  (`returned_at IS NULL`) means the employee is currently outside.

### Services

- `services/geofence_service.py`
  - `evaluate_position(locations, lat, lng, buffer_m)`: pure. Returns inside
    flag, nearest location, distance, effective radius.
  - `should_open_exit(inside_flags, threshold)`: pure. True when the last
    `threshold` flags are all False.
  - `assigned_locations(db, emp)`: active `EmployeeLocationAssignment`
    locations, else the legacy single work location on the user.
  - `alert_recipients(db, emp, location)`: supervisor + company admins.
  - `record_ping(db, emp, lat, lng, accuracy_m)`: checks clocked-in state,
    stores the ping, opens or closes an exit event, sends notifications.
- `services/notification_service.py`: `notify_users(db, user_ids, title,
  body, type, data)` writes `notifications` rows and calls push.
- `services/push_service.py`: lazy `firebase_admin` init from
  `FIREBASE_CREDENTIALS_JSON` or `FIREBASE_CREDENTIALS_FILE`; multicast
  send; removes tokens FCM reports as unregistered. No-op when unconfigured.

### API

- `POST /api/geofence/ping` (any role, workers self only):
  `{latitude, longitude, accuracy_m?}` ->
  `{tracking, inside, distance_m, nearest_location, ping_interval_s}`.
  `tracking=false` tells the app to stop the service.
- `GET /api/geofence/events?open_only&employee_id&date_from&date_to`
  (admin/supervisor, tenant scoped).
- `POST /api/notifications/device-token` `{token, platform}` and
  `DELETE /api/notifications/device-token` `{token}`.

### Settings

`geofence_exit_consecutive_pings=3`, `geofence_ping_interval_s=60`,
`firebase_credentials_json=""`, `firebase_credentials_file=""`.

## Android

- Firebase Messaging via `firebase-bom`. The `google-services` plugin is
  applied only when `app/google-services.json` exists so the build keeps
  working without it. Token registration is guarded with try/catch.
- `ErpFirebaseMessagingService`: registers new tokens with the backend and
  shows received pushes on an `alerts` channel.
- `PushTokenManager`: register after login and on app start; unregister on
  logout.
- `WorkLocationTrackingService`: foreground location service posting a ping
  every 60 s; stops itself when the server says `tracking=false` or on 401.
- `AttendanceFragment`: starts the service after a successful clock-in (or
  when today's status shows clocked in), stops it after clock-out. Asks for
  background location and notification permissions first.

## Web

- `GeofenceAlerts` page under Fleet & Tracking for admin/supervisor listing
  exit events, with currently-outside employees highlighted.
- Notification bell colours `alert` type rows red.

## Testing

- Pytest unit tests for the pure functions (no DB).
- Manual: clock in on the app, walk out of the radius, confirm supervisor
  receives the bell/push, walk back, confirm return notice.
