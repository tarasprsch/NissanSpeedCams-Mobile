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
npm run android:sync  # Build the web bundle and sync it into Android
npm run android:open  # Open the Android project in Android Studio
```

## Build an Android APK

Install Node.js, Android Studio, and Android SDK 36, then run:

```powershell
npm install
npm run build
npm run android:sync

cd android
.\gradlew.bat assembleDebug
```

The APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.
For a signed release, run `npm run android:open` from the repository root and use
**Build > Generate Signed App Bundle or APK** in Android Studio.

## Project structure

- `src/` - React application, CSV/KML parsing, and storage logic.
- `android/` - Capacitor Android project and native storage integration.
- `src/lib/loadSpeedcams.ts` - configured KML data source.

## Signing and generated files

Signing keys, Android release output, local environment files, dependencies, and generated build artifacts are intentionally excluded from version control. Do not commit keystores or other credentials.
