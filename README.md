# Speedcam CSV Builder

An Android and web app for downloading the latest speed-camera data from a KML source, comparing it with an existing `speedcam.csv`, and saving the updated CSV.

## What it does

- Downloads and parses the configured speed-camera KML feed.
- Shows loaded records, saved records, and records that are new since the previous CSV.
- Saves the current CSV to `Download/_CopyTo-FlashDrive/myPOIs/myPOIWarnings/speedcam.csv` on Android.
- Supports opening an existing CSV from an Android device.
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

## Android workflow

After changing the web app, sync it before building or running from Android Studio:

```bash
npm run android:sync
npm run android:open
```

The Capacitor app ID is `com.nissan.speedcams`.

## Project structure

- `src/` - React application, CSV/KML parsing, and storage logic.
- `android/` - Capacitor Android project and native storage integration.
- `src/lib/loadSpeedcams.ts` - configured KML data source.

## Signing and generated files

Signing keys, Android release output, local environment files, dependencies, and generated build artifacts are intentionally excluded from version control. Do not commit keystores or other credentials.
