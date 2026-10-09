# Development APKs

This folder holds the **latest development (debug) build** of the ERP Android app,
published automatically by the [Build Dev APK](../../.github/workflows/build-dev-apk.yml)
workflow on every push to `master`/`develop` that touches `mobile/**`.

The APK here is **debug-signed** — installable directly on a device for testing.
It is *not* the production/release build.

## Download

- **Latest:** [`erp-dev-latest.apk`](./erp-dev-latest.apk)
  - Direct link: `https://github.com/econetvision/erp_project_amm/raw/master/android/development/erp-dev-latest.apk`
- The file is overwritten on each successful build. See [`BUILD_INFO.txt`](./BUILD_INFO.txt)
  for the commit and timestamp of the current APK.

## Install

1. Download `erp-dev-latest.apk` to your Android device.
2. Enable **Install from unknown sources** for your browser / file manager.
3. Open the APK to install.

> Note: because these are debug builds, installing a dev APK alongside a release
> build with the same `applicationId` may require uninstalling the other first.

## ERP Attendance (supervisor app)

A separate, attendance-only app for supervisors enabled under **Workforce → Physical Attendance**
on the web portal. It installs alongside the main ERP app.

- **Latest:** [`attendance/erp-attendance-latest.apk`](./attendance/erp-attendance-latest.apk)
  - Direct link: `https://github.com/econetvision/erp_project_amm/raw/master/android/development/attendance/erp-attendance-latest.apk`
- See [`attendance/BUILD_INFO.txt`](./attendance/BUILD_INFO.txt) for the commit and checksum.
- This copy is published by hand from the **Build Attendance APK** workflow's artifact; it is not
  overwritten automatically.
- Like the dev APK it is debug-signed. Builds from different CI runs are signed with different
  keys, so uninstall the old copy before installing a newer one.
