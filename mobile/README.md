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
- ✅ Bottom navigation (Dashboard, Attendance, Notifications, Settings)
- ✅ Session management via SharedPreferences
- ✅ Dashboard with monthly attendance overview
- ✅ Upcoming holidays display on dashboard
- ✅ Attendance clock-in/out with face photo capture
- ✅ Face scan auto clock-in/out (identify employee by face)
- ✅ Notifications list with mark-read and mark-all-read
- ✅ Profile editing (display name, email, phone)
- ✅ Password change
- ✅ Error handling with user-facing messages

## Test Credentials

- **admin** / `admin123`
- **supervisor1** / `test123`
- **worker1** / `test123`
