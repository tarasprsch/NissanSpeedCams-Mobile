# Speedcam CSV Builder

An Android and web app for downloading speed-camera data from a KML source, comparing it with a private baseline, and exporting an updated `speedcam.csv`.

## What it does

- Downloads and parses the configured speed-camera KML feed.
- Shows loaded records, saved records, and records that are new since the previous CSV.
- Keeps the comparison baseline in private app storage after a successful export or import.
- On Android, exports through Save As, `Download/NissanRogue/myPOIs/myPOIWarnings/speedcam.csv`, or `myPOIs/myPOIWarnings/speedcam.csv` on removable storage.
- Detects mounted USB drives and microSD cards and disables removable export when none is available.
- Imports an existing CSV to replace the private comparison baseline.
- Uses browser local storage and a CSV download when running on the web.

## Requirements

- Node.js (current LTS recommended)
- Android Studio with an Android SDK, for Android builds and device testing
- JDK 17 or 21 with `JAVA_HOME` configured

## Getting started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Scripts

```bash
npm run dev           # Start the Vite development server
npm run build         # Type-check and build the web bundle
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
npm run android:sync  # Sync the built web bundle into Android
npm run android:open  # Open the Android project in Android Studio
npm run android:debug # Build a debug APK
npm run android:release # Build a signed release APK
```

## Build an Android APK

Install Node.js, Android Studio, Android SDK 36, and JDK 17 or 21. Set
`JAVA_HOME` to the JDK, then run:

```powershell
npm run android:debug
```

The APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Build a signed release APK

Create a signing key once:

```powershell
New-Item -ItemType Directory -Force android_keys
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore android_keys\speedcams-release.jks -alias speedcams -keyalg RSA -keysize 2048 -validity 10000
Copy-Item android\keystore.properties.example android\keystore.properties
```

Put the key passwords in `android/keystore.properties`, then run:

```bash
npm run android:release
```

The signed APK is copied to `release/com.nissan.speedcams-v1.0.apk`. After the
copy succeeds, the script removes generated Android build and Capacitor files.
Keep the keystore and passwords backed up securely; they are excluded from Git.

## Project structure

- `src/` - React application, CSV/KML parsing, and storage logic.
- `android/` - Capacitor Android project and native storage integration.
- `src/lib/loadSpeedcams.ts` - configured KML data source.

## Signing and generated files

Signing keys, Android release output, local environment files, dependencies, and generated build artifacts are intentionally excluded from version control. Do not commit keystores or other credentials.
