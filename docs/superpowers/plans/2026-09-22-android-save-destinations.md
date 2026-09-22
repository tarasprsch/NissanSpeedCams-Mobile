# Android Save Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three Android export destinations while keeping the comparison baseline in private app storage.

**Architecture:** Keep React responsible for save-mode selection and for committing a successful export to the internal baseline. Extend the existing Capacitor `SpeedcamStoragePlugin` for private-file access, Android document pickers, MediaStore Downloads export, removable-volume detection, URI grants, and nested document creation. Keep browser local storage and browser download behavior unchanged.

**Tech Stack:** React 19, TypeScript 6, Capacitor 8, Vitest, Testing Library, Java, Android Storage Access Framework, MediaStore, JUnit 4.

**Spec:** `docs/superpowers/specs/2026-09-22-android-save-destinations-design.md`

## Global Constraints

- Android `minSdkVersion` stays 24 and `targetSdkVersion` stays 36.
- Add no production dependency; extend the existing native plugin.
- Save choices appear in this exact order: **Choose folder/name**, **Save to Downloads**, **Save to flash drive**.
- Downloads target is exactly `Download/NissanRogue/myPOIs/myPOIWarnings/speedcam.csv`.
- Removable target is exactly `myPOIs/myPOIWarnings/speedcam.csv` beneath the user-approved tree.
- Treat mounted USB drives and microSD cards as removable storage.
- A fresh install has no baseline. Never inspect, copy, or migrate the old Downloads CSV.
- Only a successful export or import replaces the private baseline.
- Picker cancellation is not an error and never changes the baseline.
- Preserve current web local-storage and CSV-download behavior.
- Preserve CSV serialization as longitude, latitude, and location.

## Review Focus

- Picker cancellation must return `cancelled`, leave the baseline unchanged, and avoid error logging; Task 6 tests this orchestration.
- A removable drive disconnected between detection and writing must reject the export and preserve the baseline; Task 4 covers the native failure path in its device acceptance test and Task 6 pins baseline preservation with a rejected export.
- An external export followed by an internal baseline-write failure must report failure without pretending the baseline advanced; Task 6 tests this partial-success path.
- With multiple removable volumes, the system picker must remain available so the user can choose the intended volume; Task 4 includes this device acceptance case.
- An invalid imported CSV must not replace valid internal data; Task 6 tests parsing before baseline writing.

---

## File Structure

- Modify `src/types.ts`: represent internal baseline sources.
- Modify `src/lib/storage.ts`: expose platform-neutral baseline, export, import, and removable-status APIs.
- Create `src/lib/storage.test.ts`: verify web fallback and storage result contracts.
- Create `src/components/SaveDestinationDialog.tsx`: render the Android save-mode modal.
- Create `src/components/SaveDestinationDialog.test.tsx`: verify modal semantics, order, and disabled state.
- Modify `src/App.tsx`: orchestrate export, baseline updates, import, and removable-status events.
- Modify `src/App.test.tsx`: verify end-to-end React behavior at the native storage boundary.
- Modify `src/styles.css`: style the accessible modal and save choices.
- Create `android/app/src/main/java/com/nissan/speedcams/StoragePaths.java`: own exact paths and pure storage predicates.
- Create `android/app/src/test/java/com/nissan/speedcams/StoragePathsTest.java`: test paths and removable-volume/tree helpers without Android framework state.
- Modify `android/app/src/main/java/com/nissan/speedcams/SpeedcamStoragePlugin.java`: implement all native storage operations.
- Delete `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`: remove unrelated generated test.
- Modify `README.md`: document new baseline and export behavior.

### Task 1: TypeScript Storage Contract and Web Fallback

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/storage.ts`
- Create: `src/lib/storage.test.ts`

**Interfaces:**
- Produces: `SaveDestination = 'picker' | 'downloads' | 'removable'`.
- Produces: `ExportCsvResult = { status: 'saved'; path: string } | { status: 'cancelled' }`.
- Produces: `PickExistingCsvResult = { status: 'picked'; content: string; path: string } | { status: 'cancelled' }`.
- Produces: `readBaselineCsv()`, `writeBaselineCsv(content)`, `exportCsv(content, destination)`, `getRemovableStorageStatus()`, `addRemovableStorageListener(listener)`, `pickExistingCsv()`, and `usesNativeSaveDialog()`.

- [ ] **Step 1: Write failing web storage tests**

Mock only `Capacitor.getPlatform`, exercise the real adapter, and assert these literal outcomes:

```ts
it('stores and reads the web baseline', async () => {
  platformMock.mockReturnValue('web');

  await writeBaselineCsv('28.453992,45.32507,"camera"');

  await expect(readBaselineCsv()).resolves.toEqual({
    content: '28.453992,45.32507,"camera"',
    path: 'speedcam.csv',
    source: 'web',
  });
});

it('reports no removable storage on web', async () => {
  platformMock.mockReturnValue('web');
  await expect(getRemovableStorageStatus()).resolves.toEqual({ mounted: false });
});

it('downloads a web export and returns saved status', async () => {
  platformMock.mockReturnValue('web');
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  await expect(exportCsv('csv', 'picker')).resolves.toEqual({
    status: 'saved',
    path: 'speedcam.csv',
  });
  expect(click).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/lib/storage.test.ts`

Expected: FAIL because the new storage functions and result types do not exist.

- [ ] **Step 3: Define the storage contracts**

Update `SavedCsvSource` and add native result types:

```ts
export type SavedCsvSource = 'internal' | 'web' | 'none';

export interface ReadSavedCsvResult {
  content: string | null;
  path: string;
  source: SavedCsvSource;
}
```

In `storage.ts`, declare the exact boundary:

```ts
export type SaveDestination = 'picker' | 'downloads' | 'removable';
export type ExportCsvResult =
  | { status: 'saved'; path: string }
  | { status: 'cancelled' };
export type PickExistingCsvResult =
  | { status: 'picked'; content: string; path: string }
  | { status: 'cancelled' };
export interface RemovableStorageStatus { mounted: boolean }

interface SpeedcamStoragePlugin {
  readBaselineCsv(): Promise<ReadSavedCsvResult>;
  writeBaselineCsv(options: { content: string }): Promise<{ path: string }>;
  exportCsv(options: {
    content: string;
    destination: SaveDestination;
  }): Promise<ExportCsvResult>;
  pickExistingCsv(): Promise<PickExistingCsvResult>;
  getRemovableStorageStatus(): Promise<RemovableStorageStatus>;
  addListener(
    eventName: 'removableStorageChanged',
    listener: (status: RemovableStorageStatus) => void,
  ): Promise<PluginListenerHandle>;
}
```

- [ ] **Step 4: Implement web behavior and native delegation**

Use `speedcam.csv` as the web key and download name. Return a no-op listener handle on web:

```ts
export function usesNativeSaveDialog(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function writeBaselineCsv(content: string) {
  if (!usesNativeSaveDialog()) {
    window.localStorage.setItem(WEB_STORAGE_KEY, content);
    return { path: DOWNLOAD_FILE_NAME };
  }
  return SpeedcamStorage.writeBaselineCsv({ content });
}

export async function getRemovableStorageStatus() {
  return usesNativeSaveDialog()
    ? SpeedcamStorage.getRemovableStorageStatus()
    : { mounted: false };
}

export async function addRemovableStorageListener(
  listener: (status: RemovableStorageStatus) => void,
): Promise<PluginListenerHandle> {
  if (!usesNativeSaveDialog()) {
    return { remove: async () => {} };
  }
  return SpeedcamStorage.addListener('removableStorageChanged', listener);
}

export async function exportCsv(
  content: string,
  destination: SaveDestination,
): Promise<ExportCsvResult> {
  if (usesNativeSaveDialog()) {
    return SpeedcamStorage.exportCsv({ content, destination });
  }
  downloadCsv(content);
  return { status: 'saved', path: DOWNLOAD_FILE_NAME };
}

export async function pickExistingCsv(): Promise<PickExistingCsvResult> {
  if (!usesNativeSaveDialog()) {
    throw new Error('Importing a device CSV is only available in the Android app.');
  }
  return SpeedcamStorage.pickExistingCsv();
}
```

Extract the current Blob and temporary-anchor code into private `downloadCsv(content)`. Implement `readBaselineCsv` with strict `content === null` source detection, and delegate it to the native plugin on Android.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- src/lib/storage.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/storage.ts src/lib/storage.test.ts
git commit -m "Refactor storage export contracts"
```

### Task 2: Native Baseline and Downloads Export

**Files:**
- Create: `android/app/src/main/java/com/nissan/speedcams/StoragePaths.java`
- Create: `android/app/src/test/java/com/nissan/speedcams/StoragePathsTest.java`
- Modify: `android/app/src/main/java/com/nissan/speedcams/SpeedcamStoragePlugin.java`
- Delete: `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`

**Interfaces:**
- Consumes: native methods declared by `SpeedcamStoragePlugin` in Task 1.
- Produces: private baseline methods and `downloads` support in `exportCsv`.
- Produces: `StoragePaths.DOWNLOAD_TARGET_PATH`, `DOWNLOAD_RELATIVE_SUBPATH`, `REMOVABLE_SEGMENTS`, and `isMountedRemovable(...)`.

- [ ] **Step 1: Write failing pure Java tests**

```java
package com.nissan.speedcams;

import static org.junit.Assert.*;
import org.junit.Test;

public class StoragePathsTest {
    @Test
    public void exposesExactExportPaths() {
        assertEquals(
            "Download/NissanRogue/myPOIs/myPOIWarnings/speedcam.csv",
            StoragePaths.DOWNLOAD_TARGET_PATH
        );
        assertArrayEquals(
            new String[] { "myPOIs", "myPOIWarnings", "speedcam.csv" },
            StoragePaths.REMOVABLE_SEGMENTS
        );
    }

    @Test
    public void onlyMountedNonPrimaryRemovableVolumesQualify() {
        assertTrue(StoragePaths.isMountedRemovable(false, true, "mounted"));
        assertFalse(StoragePaths.isMountedRemovable(true, true, "mounted"));
        assertFalse(StoragePaths.isMountedRemovable(false, false, "mounted"));
        assertFalse(StoragePaths.isMountedRemovable(false, true, "unmounted"));
    }
}
```

- [ ] **Step 2: Run the native unit test and verify RED**

Run: `.\android\gradlew.bat -p android testDebugUnitTest`

Expected: FAIL because `StoragePaths` does not exist.

- [ ] **Step 3: Add exact storage constants and predicate**

```java
final class StoragePaths {
    static final String DISPLAY_NAME = "speedcam.csv";
    static final String BASELINE_FILE_NAME = "speedcam.csv";
    static final String DOWNLOAD_RELATIVE_SUBPATH = "NissanRogue/myPOIs/myPOIWarnings/";
    static final String DOWNLOAD_TARGET_PATH =
        "Download/" + DOWNLOAD_RELATIVE_SUBPATH + DISPLAY_NAME;
    static final String[] REMOVABLE_SEGMENTS =
        new String[] { "myPOIs", "myPOIWarnings", DISPLAY_NAME };

    static boolean isMountedRemovable(
        boolean primary,
        boolean removable,
        String state
    ) {
        return !primary && removable && "mounted".equals(state);
    }

    private StoragePaths() {}
}
```

- [ ] **Step 4: Replace target-file methods with private baseline methods**

Implement `readBaselineCsv` with `getContext().getFileStreamPath(...)`. Return `content: null`, `path: "internal/speedcam.csv"`, and `source: "none"` when absent. Implement `writeBaselineCsv` with `getContext().openFileOutput(..., Context.MODE_PRIVATE)` and return `path: "internal/speedcam.csv"`.

Do not call `findTargetUri`, `getLegacyTargetFile`, or any migration helper from baseline reads.

- [ ] **Step 5: Convert the current writer into Downloads export**

Dispatch `destination: "downloads"` through the existing MediaStore/legacy implementation, using:

```java
values.put(MediaStore.MediaColumns.RELATIVE_PATH,
    Environment.DIRECTORY_DOWNLOADS + "/" + StoragePaths.DOWNLOAD_RELATIVE_SUBPATH);
```

Resolve successful writes as:

```java
JSObject result = new JSObject();
result.put("status", "saved");
result.put("path", StoragePaths.DOWNLOAD_TARGET_PATH);
call.resolve(result);
```

Reject unsupported destinations until their tasks implement them.

- [ ] **Step 6: Run native tests**

Run: `.\android\gradlew.bat -p android testDebugUnitTest`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add android/app/src/main/java/com/nissan/speedcams/StoragePaths.java android/app/src/main/java/com/nissan/speedcams/SpeedcamStoragePlugin.java android/app/src/test/java/com/nissan/speedcams/StoragePathsTest.java android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java
git commit -m "Add internal baseline storage"
```

### Task 3: Android Save As and CSV Import

**Files:**
- Modify: `android/app/src/main/java/com/nissan/speedcams/SpeedcamStoragePlugin.java`

**Interfaces:**
- Consumes: `exportCsv({ content, destination: 'picker' })` and `pickExistingCsv()` from Task 1.
- Produces: saved/cancelled result unions for Android document activities.

- [ ] **Step 1: Add an App orchestration test that demands cancellation results**

Add the native mock shape now so later UI code cannot treat cancellation as an exception:

```ts
pickExistingCsvMock.mockResolvedValue({ status: 'cancelled' });
await expect(pickExistingCsv()).resolves.toEqual({ status: 'cancelled' });
```

Place this boundary test in `src/lib/storage.test.ts` with a mocked registered plugin and Android platform.

- [ ] **Step 2: Run the boundary test and verify RED**

Run: `npm test -- src/lib/storage.test.ts`

Expected: FAIL until Android delegation returns the new union unchanged.

- [ ] **Step 3: Implement Save As launch and callback**

For destination `picker`, launch:

```java
Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
intent.addCategory(Intent.CATEGORY_OPENABLE);
intent.setType("text/csv");
intent.putExtra(Intent.EXTRA_TITLE, StoragePaths.DISPLAY_NAME);
startActivityForResult(call, intent, "handleCreateCsv");
```

In `handleCreateCsv`, resolve `{ status: "cancelled" }` for non-OK results. For a valid URI, write UTF-8 content with `resolver.openOutputStream(uri, "rwt")`, then resolve `{ status: "saved", path: describeUri(uri) }`.

- [ ] **Step 4: Update import cancellation and persisted read access**

Make `handlePickExistingCsv` resolve cancellation instead of rejecting it. Valid results must resolve:

```java
response.put("status", "picked");
response.put("content", readTextFromUri(uri));
response.put("path", describeUri(uri));
```

Keep only persistable read permission for imports. Do not store an import URI as baseline state.

- [ ] **Step 5: Run web tests and compile Android**

Run: `npm test -- src/lib/storage.test.ts`

Expected: PASS.

Run: `.\android\gradlew.bat -p android testDebugUnitTest assembleDebug`

Expected: PASS.

- [ ] **Step 6: Device-check picker outcomes**

On an Android device, verify Save As with a new name, replacement confirmation for an existing name, cancellation, and import cancellation. Each cancellation must return to the app without a failure log.

- [ ] **Step 7: Commit**

```bash
git add src/lib/storage.test.ts android/app/src/main/java/com/nissan/speedcams/SpeedcamStoragePlugin.java
git commit -m "Add Android Save As export"
```

### Task 4: Removable Storage Detection and Export

**Files:**
- Modify: `android/app/src/main/java/com/nissan/speedcams/StoragePaths.java`
- Modify: `android/app/src/test/java/com/nissan/speedcams/StoragePathsTest.java`
- Modify: `android/app/src/main/java/com/nissan/speedcams/SpeedcamStoragePlugin.java`

**Interfaces:**
- Consumes: `getRemovableStorageStatus`, `removableStorageChanged`, and destination `removable` from Task 1.
- Produces: live `{ mounted: boolean }` status and removable-tree export.

- [ ] **Step 1: Add failing tree-volume matching tests**

```java
@Test
public void extractsVolumeIdFromTreeDocumentId() {
    assertEquals("ABCD-1234", StoragePaths.volumeIdFromTreeDocumentId("ABCD-1234:"));
    assertEquals("ABCD-1234", StoragePaths.volumeIdFromTreeDocumentId("ABCD-1234:exports"));
    assertNull(StoragePaths.volumeIdFromTreeDocumentId("primary:Download"));
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `.\android\gradlew.bat -p android testDebugUnitTest`

Expected: FAIL because `volumeIdFromTreeDocumentId` does not exist.

- [ ] **Step 3: Implement pure volume-ID matching**

```java
static String volumeIdFromTreeDocumentId(String documentId) {
    int separator = documentId.indexOf(':');
    if (separator <= 0) return null;
    String volumeId = documentId.substring(0, separator);
    return "primary".equalsIgnoreCase(volumeId) ? null : volumeId;
}
```

- [ ] **Step 4: Implement mounted status and live events**

Use `StorageManager.getStorageVolumes()` and qualify each volume with:

```java
StoragePaths.isMountedRemovable(
    volume.isPrimary(),
    volume.isRemovable(),
    volume.getState()
)
```

Expose `getRemovableStorageStatus`. In `load()`, register `StorageManager.StorageVolumeCallback` on API 30+ and a dynamic media mount/unmount receiver on API 24-29. Both call:

```java
JSObject status = new JSObject();
status.put("mounted", hasMountedRemovableStorage());
notifyListeners("removableStorageChanged", status);
```

Unregister the callback or receiver in `handleOnDestroy()`.

- [ ] **Step 5: Implement removable tree selection and permission**

If no mounted removable volume exists, reject with `No removable storage is mounted.` If a persisted writable tree grant matches a mounted volume UUID, reuse it. Otherwise launch the first mounted removable volume's `createOpenDocumentTreeIntent()` and let the system picker navigate to other volumes.

Request and persist both URI flags:

```java
int flags = data.getFlags()
    & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
resolver.takePersistableUriPermission(treeUri, flags);
```

- [ ] **Step 6: Create or locate the target hierarchy**

Starting at `DocumentsContract.getTreeDocumentId(treeUri)`, query each child by `COLUMN_DISPLAY_NAME`. Create missing directories using `Document.MIME_TYPE_DIR`; create `speedcam.csv` using `text/csv`. Open the final URI with mode `rwt` and write UTF-8 content.

On `SecurityException`, clear the saved tree URI and reopen tree selection once. On storage removal or `IOException`, reject without changing baseline state.

- [ ] **Step 7: Run native tests and build**

Run: `.\android\gradlew.bat -p android testDebugUnitTest assembleDebug`

Expected: PASS.

- [ ] **Step 8: Device-check removable edge cases**

Verify all cases: absent drive, insertion while app is open, removal while app is open, first permission, repeated overwrite, removal during write, stale permission after reformat, microSD, and choosing between two removable volumes. Confirm final path is `myPOIs/myPOIWarnings/speedcam.csv` beneath the granted tree.

- [ ] **Step 9: Commit**

```bash
git add android/app/src/main/java/com/nissan/speedcams/StoragePaths.java android/app/src/main/java/com/nissan/speedcams/SpeedcamStoragePlugin.java android/app/src/test/java/com/nissan/speedcams/StoragePathsTest.java
git commit -m "Add removable storage export"
```

### Task 5: Save Destination Modal

**Files:**
- Create: `src/components/SaveDestinationDialog.tsx`
- Create: `src/components/SaveDestinationDialog.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `SaveDestination` from Task 1.
- Produces: `SaveDestinationDialog` with `open`, `isSaving`, `removableStorageMounted`, `onSelect`, and `onCancel` props.

- [ ] **Step 1: Write the failing component tests**

```tsx
it('shows save choices in required order', () => {
  render(<SaveDestinationDialog open removableStorageMounted onSelect={onSelect} onCancel={onCancel} />);
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
    'Choose folder/name',
    'Save to Downloads',
    'Save to flash drive',
    'Cancel',
  ]);
});

it('keeps flash save visible but disabled without removable storage', () => {
  render(<SaveDestinationDialog open removableStorageMounted={false} onSelect={onSelect} onCancel={onCancel} />);
  expect(screen.getByRole('button', { name: 'Save to flash drive' })).toBeDisabled();
  expect(screen.getByText('No removable storage detected')).toBeInTheDocument();
});
```

Also assert each enabled choice calls `onSelect` with `picker`, `downloads`, or `removable`, and Escape/backdrop cancellation calls `onCancel` only when no save is active.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/components/SaveDestinationDialog.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the accessible dialog**

Render nothing when closed. When open, render a backdrop and `role="dialog"`, `aria-modal="true"`, a heading `Save speedcam.csv`, the four buttons in exact order, and the unavailable helper text. Disable all choices during `isSaving`; always disable flash save when `removableStorageMounted` is false.

Use the exact dispatch calls:

```tsx
onClick={() => onSelect('picker')}
onClick={() => onSelect('downloads')}
onClick={() => onSelect('removable')}
```

- [ ] **Step 4: Add focused modal CSS**

Add `.modal-backdrop`, `.save-dialog`, `.save-option`, `.save-option-detail`, and `.dialog-actions`. Use the existing dark palette, a full-screen fixed backdrop, a width constrained to the mobile viewport, and visible disabled opacity. Do not alter table layout.

- [ ] **Step 5: Run component tests and build**

Run: `npm test -- src/components/SaveDestinationDialog.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SaveDestinationDialog.tsx src/components/SaveDestinationDialog.test.tsx src/styles.css
git commit -m "Add save destination dialog"
```

### Task 6: Application Save and Import Orchestration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: all Task 1 storage functions and Task 5 dialog.
- Produces: successful-export baseline commits, safe cancellation/failure, live flash option state, and renamed import action.

- [ ] **Step 1: Replace storage mocks and write failing startup/import tests**

Mock the new functions and verify startup calls `readBaselineCsv`, not an export destination. Add:

```ts
it('imports an existing CSV into the internal baseline', async () => {
  pickExistingCsvMock.mockResolvedValue({
    status: 'picked',
    content: '30.593149,50.417382,"imported"',
    path: 'picked/speedcam.csv',
  });

  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Import existing CSV' }));

  await waitFor(() => {
    expect(writeBaselineCsvMock).toHaveBeenCalledWith(
      '30.593149,50.417382,"imported"',
    );
  });
});
```

Add a malformed import test that makes `parseCsv` throw and asserts `writeBaselineCsvMock` was not called.

- [ ] **Step 2: Write failing export orchestration tests**

Cover these exact cases:

```ts
it('opens native choices and commits baseline after successful export', async () => {
  exportCsvMock.mockResolvedValue({ status: 'saved', path: 'exported/speedcam.csv' });
  render(<App />);
  await loadKmlAndOpenSaveDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Save to Downloads' }));

  await waitFor(() => {
    expect(exportCsvMock).toHaveBeenCalledWith(expect.any(String), 'downloads');
    expect(writeBaselineCsvMock).toHaveBeenCalledAfter(exportCsvMock);
  });
});
```

Also test: canceled export never writes baseline; rejected export never writes baseline; rejected baseline write does not refresh the Saved CSV tab and logs `CSV exported, but the internal baseline could not be updated.`; web save skips the modal; listener updates flash button from disabled to enabled.

- [ ] **Step 3: Run App tests and verify RED**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because App still uses `readSavedCsv` and `writeSavedCsv` directly.

- [ ] **Step 4: Implement startup and removable-status lifecycle**

Replace `refreshSavedRecords` with internal baseline reading. On Android mount, fetch current removable status and subscribe to `removableStorageChanged`. Remove the listener during effect cleanup. Refresh status again before opening the modal to close the race between mount events and user action.

- [ ] **Step 5: Implement export sequencing**

For web, call `performSave('picker')` directly. For Android, open the modal. Use this strict sequence:

```ts
const csvText = serializeCsv(loadedRecords);
const exportResult = await exportCsv(csvText, destination);
if (exportResult.status === 'cancelled') return;
await writeBaselineCsv(csvText);
setSavedRecords(loadedRecords);
setActiveTab('saved');
```

Close the modal after success, cancellation, or error. Keep save controls disabled for the full operation. Use separate error boundaries: export failure logs `CSV export failed`, while a baseline failure after external success logs `CSV exported, but the internal baseline could not be updated.` This makes the partial-success state explicit and leaves `savedRecords` unchanged.

- [ ] **Step 6: Implement safe import sequencing**

Rename the button to **Import existing CSV**. On `cancelled`, return without logging. On `picked`, parse first, then write the unmodified content to baseline, then set parsed records and select the Saved CSV tab:

```ts
const result = await pickExistingCsv();
if (result.status === 'cancelled') return;
const records = parseCsv(result.content);
await writeBaselineCsv(result.content);
setSavedRecords(records);
setActiveTab('saved');
```

- [ ] **Step 7: Run App tests and full web verification**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

Run: `npm test`

Expected: all test files pass.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "Connect save destinations to baseline"
```

### Task 7: Documentation and Final Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: completed behavior from Tasks 1-6.
- Produces: contributor-facing documentation and release evidence.

- [ ] **Step 1: Update README behavior bullets**

Replace the old single-path description with exact user behavior:

```markdown
- Keeps the comparison baseline in private app storage after a successful export or import.
- On Android, exports through Save As, `Download/NissanRogue/myPOIs/myPOIWarnings/speedcam.csv`, or `myPOIs/myPOIWarnings/speedcam.csv` on removable storage.
- Detects mounted USB drives and microSD cards and disables removable export when none is available.
- Imports an existing CSV to replace the private comparison baseline.
```

- [ ] **Step 2: Run complete automated verification**

Run: `npm test`

Expected: all Vitest tests pass with zero failures.

Run: `npm run build`

Expected: TypeScript and Vite build pass.

Run: `.\android\gradlew.bat -p android testDebugUnitTest assembleDebug`

Expected: JUnit tests and debug APK build pass.

- [ ] **Step 3: Run final Android acceptance pass**

Install the debug APK on a target Android device. Verify all three save choices, removable-state changes, both exact paths, cancellation, export failure, import, app restart, and a fresh-install empty baseline. Confirm no first-run Downloads migration occurs.

- [ ] **Step 4: Inspect final changes**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only intended implementation and documentation files are modified.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "Document Android save destinations"
```
