# ERP Mobile — Android App

Native Kotlin Android app for the ERP system.

## Setup

1. Open the `mobile/` directory in **Android Studio** (Arctic Fox or later)
2. Let Gradle sync complete
3. Configure the API base URL in `app/build.gradle.kts` → `buildConfigField`
   - Default: `http://10.0.2.2:8088` (emulator → host machine)
   - For physical device: use your machine's local IP (e.g., `http://192.168.1.x:8088`)
4. Run on emulator or device (min API 26 / Android 8.0)

## Architecture

- **MVVM** — ViewModel + LiveData + Repository pattern
- **Retrofit** + OkHttp for networking
- **Navigation Component** for fragment navigation
- **Material Design 3** theming

## Features

- ✅ Login screen with JWT authentication
- ✅ Face login (1:N face match against registered employees, no password needed)
- ✅ Fingerprint quick re-login (BiometricPrompt unlocks Android-Keystore-encrypted credentials and silently replays the normal login call — no raw biometric data ever leaves the device or hits the server)
- ✅ Bottom navigation (Dashboard, Attendance, Notifications, Settings)
- ✅ RBAC-gated "Management" section in Settings (visible only to `admin`/`master`/`supervisor`, hidden for `worker`)
  - Employees list (read-only)
  - Work Locations list (read-only, shows geofence radius in meters)
  - Users management (full create/edit/delete, admin/master only)
- ✅ Session management via SharedPreferences
- ✅ Dashboard with monthly attendance overview
- ✅ Upcoming holidays display on dashboard
- ✅ Attendance screen shows the employee's assigned work location and live in/out-of-geofence status before clocking in
- ✅ Vehicle trip tracking (backup path) — if the logged-in user has an active vehicle assignment, a "Start Trip Tracking" card on the Attendance screen runs a foreground service pushing GPS location every ~20s to the same fleet-tracking pipeline. This is a fallback only; hardware GPS trackers (via the `gateway/` service) are the primary tracking source
- ✅ Attendance clock-in/out with face photo capture
- ✅ Face scan auto clock-in/out (identify employee by face)
- ✅ Notifications list with mark-read and mark-all-read
- ✅ Profile editing (display name, email, phone)
- ✅ Password change
- ✅ Error handling with user-facing messages

## Roles

Four roles, same as the backend: `master`, `admin`, `supervisor`, `worker`. `SessionManager.canManage()` returns `true` for `master`/`admin`/`supervisor` and gates the Management section; `worker` only sees the four bottom-nav tabs.

## Test Credentials

- **admin** / `admin123`
- **supervisor1** / `test123`
- **worker1** / `test123`
