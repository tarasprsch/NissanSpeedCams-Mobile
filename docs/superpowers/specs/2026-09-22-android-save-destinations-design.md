# Android Save Destinations Design

## Summary

The Android app will ask users how to export `speedcam.csv` on every save. It will support a system Save As picker, the existing automatic Downloads workflow at a new path, and removable storage. The app will maintain its comparison baseline in private internal storage instead of treating any exported CSV as the source of truth.

## Goals

- Present three save choices every time the user selects **Save to file**.
- Keep **Save to flash drive** visible and disable it when no mounted removable storage exists.
- Export to an exact Nissan folder hierarchy for automatic destinations.
- Store the latest successfully exported dataset in app-private storage.
- Keep existing CSV import as an explicit recovery and setup action.
- Preserve current web behavior.

## Save Choices

The save modal will list these actions in this order:

1. **Choose folder/name** opens Android's `ACTION_CREATE_DOCUMENT` picker with `speedcam.csv` as the suggested name.
2. **Save to Downloads** writes to `Download/NissanRogue/myPOIs/myPOIWarnings/speedcam.csv` through the existing MediaStore or legacy-file implementation.
3. **Save to flash drive** writes to `myPOIs/myPOIWarnings/speedcam.csv` beneath a user-approved removable-storage directory. The action is always shown and is disabled with explanatory text when no removable storage is mounted.

The modal also provides **Cancel**. Canceling any Android picker is a normal outcome, not an error.

## Internal Baseline

The comparison baseline will be stored as CSV text in app-private internal storage. Startup reads only this internal file. A new installation starts with an empty baseline; the app will not inspect, migrate, or copy an older Downloads file.

After an export completes successfully, the app writes the same CSV text to the internal baseline, refreshes the **Saved CSV** view, and opens that tab. A canceled or failed export leaves the previous baseline unchanged.

The existing device picker will be renamed **Import existing CSV**. A successful import parses the selected file and replaces the internal baseline. Export destinations are never read to determine the baseline.

## Android Storage Integration

The existing `SpeedcamStoragePlugin` will remain the native boundary and gain focused methods for:

- reading and replacing the private baseline;
- reporting whether mounted non-primary removable storage exists;
- notifying JavaScript when removable-storage state changes;
- exporting through Save As, Downloads, or removable storage;
- importing an existing CSV.

Mounted removable storage will include USB drives and microSD cards because Android's public API does not reliably distinguish them. `StorageManager` and `StorageVolume` will provide current mount state. The plugin will emit changes while the app is active so the modal updates without reopening it.

Save As will use `ACTION_CREATE_DOCUMENT`, allowing Android to handle naming, location selection, and overwrite confirmation.

For removable storage, the plugin will open `ACTION_OPEN_DOCUMENT_TREE` at an available removable volume when it lacks a valid grant. It will persist read/write URI permission and create or locate `myPOIs`, `myPOIWarnings`, and `speedcam.csv` through `DocumentsContract`. If multiple removable volumes exist, the system picker allows the user to choose one. A stale grant will trigger directory selection again.

## Web Behavior

Web storage and browser download behavior remain unchanged. The three-choice Android modal and removable-storage status apply only to the native Android build.

## Errors and State Transitions

- Picker cancellation closes the save flow without logging an error or changing the baseline.
- Export failures show the existing user-facing failure handling and preserve the baseline.
- Removing storage during a write causes the flash export to fail safely.
- Internal baseline failure after a successful external export is reported explicitly because the exported file and comparison state then differ.
- Save controls remain disabled while a save operation is active to prevent overlapping native calls.

## Testing

Vitest and Testing Library tests will verify modal ordering, Android-only presentation, removable-storage enabled state, destination dispatch, cancellation, success, failure, baseline update timing, and import replacement. Storage adapter tests will cover the new result contracts and preserve web behavior.

Native tests will isolate path construction and removable-volume filtering where practical. Device acceptance checks will verify insertion and removal updates, first-time directory permission, nested directory creation, overwrite behavior, Save As naming, import, failed-write baseline preservation, and internal baseline restoration after restart.

## Acceptance Criteria

- Every Android save starts with the three-choice modal in the specified order.
- **Save to flash drive** is disabled exactly when no mounted removable volume is available.
- Automatic Downloads and removable-storage exports use their specified paths.
- Only successful exports or imports replace the internal baseline.
- Fresh installs begin with no baseline and perform no CSV migration.
- Web behavior and existing CSV serialization remain unchanged.
