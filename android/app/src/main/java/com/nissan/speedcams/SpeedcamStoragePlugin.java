package com.nissan.speedcams;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

@CapacitorPlugin(name = "SpeedcamStorage")
public class SpeedcamStoragePlugin extends Plugin {

    private static final String BASELINE_PATH = "internal/" + StoragePaths.BASELINE_FILE_NAME;
    private static final String PREFERENCES_NAME = "speedcam_storage";
    private static final String REMOVABLE_TREE_URI_KEY = "removable_tree_uri";
    private StorageManager storageManager;
    private StorageManager.StorageVolumeCallback storageVolumeCallback;
    private BroadcastReceiver storageReceiver;

    @Override
    public void load() {
        storageManager = (StorageManager) getContext().getSystemService(Context.STORAGE_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            storageVolumeCallback = new StorageManager.StorageVolumeCallback() {
                @Override
                public void onStateChanged(StorageVolume volume) {
                    notifyRemovableStorageChanged();
                }
            };
            storageManager.registerStorageVolumeCallback(
                getContext().getMainExecutor(),
                storageVolumeCallback
            );
        } else {
            storageReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    notifyRemovableStorageChanged();
                }
            };
            IntentFilter filter = new IntentFilter();
            filter.addAction(Intent.ACTION_MEDIA_MOUNTED);
            filter.addAction(Intent.ACTION_MEDIA_UNMOUNTED);
            filter.addAction(Intent.ACTION_MEDIA_REMOVED);
            filter.addAction(Intent.ACTION_MEDIA_EJECT);
            filter.addAction(Intent.ACTION_MEDIA_BAD_REMOVAL);
            filter.addDataScheme("file");
            getContext().registerReceiver(storageReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && storageVolumeCallback != null) {
            storageManager.unregisterStorageVolumeCallback(storageVolumeCallback);
            storageVolumeCallback = null;
        } else if (storageReceiver != null) {
            getContext().unregisterReceiver(storageReceiver);
            storageReceiver = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void readBaselineCsv(PluginCall call) {
        try {
            File baselineFile = getContext().getFileStreamPath(StoragePaths.BASELINE_FILE_NAME);
            JSObject result = new JSObject();
            result.put("content", baselineFile.exists() ? readTextFromFile(baselineFile) : JSONObject.NULL);
            result.put("path", BASELINE_PATH);
            result.put("source", baselineFile.exists() ? "internal" : "none");
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to read the internal speedcam baseline.", exception);
        }
    }

    @PluginMethod
    public void writeBaselineCsv(PluginCall call) {
        String content = call.getString("content");

        if (content == null) {
            call.reject("Missing CSV content.");
            return;
        }

        try (FileOutputStream outputStream = getContext().openFileOutput(
            StoragePaths.BASELINE_FILE_NAME,
            Context.MODE_PRIVATE
        )) {
            outputStream.write(content.getBytes(StandardCharsets.UTF_8));
            outputStream.flush();

            JSObject result = new JSObject();
            result.put("path", BASELINE_PATH);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to update the internal speedcam baseline.", exception);
        }
    }

    @PluginMethod
    public void getRemovableStorageStatus(PluginCall call) {
        JSObject status = new JSObject();
        status.put("mounted", hasMountedRemovableStorage());
        call.resolve(status);
    }

    @PluginMethod
    public void exportCsv(PluginCall call) {
        String content = call.getString("content");
        String destination = call.getString("destination");

        if (content == null) {
            call.reject("Missing CSV content.");
            return;
        }
        if ("picker".equals(destination)) {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("text/csv");
            intent.putExtra(Intent.EXTRA_TITLE, StoragePaths.DISPLAY_NAME);
            startActivityForResult(call, intent, "handleCreateCsv");
            return;
        }
        if ("removable".equals(destination)) {
            exportToRemovableStorage(call);
            return;
        }
        if (!"downloads".equals(destination)) {
            call.reject("Unsupported export destination.");
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                writeToMediaStore(content);
            } else {
                writeLegacyFile(content);
            }

            JSObject result = new JSObject();
            result.put("status", "saved");
            result.put("path", StoragePaths.DOWNLOAD_TARGET_PATH);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to save speedcam.csv to the Downloads folder.", exception);
        }
    }

    @ActivityCallback
    private void handleCreateCsv(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            resolveCancelled(call);
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            resolveCancelled(call);
            return;
        }

        try {
            writeTextToUri(uri, call.getString("content"));
            JSObject response = new JSObject();
            response.put("status", "saved");
            response.put("path", describeUri(uri));
            call.resolve(response);
        } catch (Exception exception) {
            call.reject("Unable to save the selected CSV file.", exception);
        }
    }

    @ActivityCallback
    private void handlePickRemovableTree(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            resolveCancelled(call);
            return;
        }

        Intent data = result.getData();
        Uri treeUri = data.getData();
        if (treeUri == null) {
            resolveCancelled(call);
            return;
        }
        if (!treeMatchesMountedRemovableVolume(treeUri)) {
            call.reject("The selected folder is not on mounted removable storage.");
            return;
        }

        try {
            int flags = data.getFlags()
                & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContext().getContentResolver().takePersistableUriPermission(treeUri, flags);
            storeRemovableTreeUri(treeUri);
            writeRemovableCsv(treeUri, call.getString("content"));
            resolveRemovableSaved(call);
        } catch (Exception exception) {
            clearRemovableTreeUri();
            call.reject("Unable to save speedcam.csv to removable storage.", exception);
        }
    }

    @PluginMethod
    public void pickExistingCsv(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(
            Intent.EXTRA_MIME_TYPES,
            new String[] {
                "text/csv",
                "text/comma-separated-values",
                "application/vnd.ms-excel",
                "text/plain",
            }
        );
        startActivityForResult(call, intent, "handlePickExistingCsv");
    }

    @ActivityCallback
    private void handlePickExistingCsv(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            resolveCancelled(call);
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            resolveCancelled(call);
            return;
        }

        try {
            persistReadPermission(result.getData(), uri);

            JSObject response = new JSObject();
            response.put("status", "picked");
            response.put("content", readTextFromUri(uri));
            response.put("path", describeUri(uri));
            call.resolve(response);
        } catch (Exception exception) {
            call.reject("Unable to read the selected CSV file.", exception);
        }
    }

    private void exportToRemovableStorage(PluginCall call) {
        if (!hasMountedRemovableStorage()) {
            call.reject("No removable storage is mounted.");
            return;
        }

        Uri treeUri = findPersistedRemovableTreeUri();
        if (treeUri == null) {
            launchRemovableTreePicker(call);
            return;
        }

        try {
            writeRemovableCsv(treeUri, call.getString("content"));
            resolveRemovableSaved(call);
        } catch (SecurityException exception) {
            clearRemovableTreeUri();
            launchRemovableTreePicker(call);
        } catch (IOException exception) {
            call.reject("Unable to save speedcam.csv to removable storage.", exception);
        }
    }

    private void launchRemovableTreePicker(PluginCall call) {
        List<StorageVolume> volumes = getMountedRemovableVolumes();
        if (volumes.isEmpty()) {
            call.reject("No removable storage is mounted.");
            return;
        }

        Intent intent = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? volumes.get(0).createOpenDocumentTreeIntent()
            : new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "handlePickRemovableTree");
    }

    private boolean hasMountedRemovableStorage() {
        return !getMountedRemovableVolumes().isEmpty();
    }

    private List<StorageVolume> getMountedRemovableVolumes() {
        if (storageManager == null) {
            storageManager = (StorageManager) getContext().getSystemService(Context.STORAGE_SERVICE);
        }

        List<StorageVolume> mounted = new ArrayList<>();
        for (StorageVolume volume : storageManager.getStorageVolumes()) {
            if (
                StoragePaths.isMountedRemovable(
                    volume.isPrimary(),
                    volume.isRemovable(),
                    volume.getState()
                )
            ) {
                mounted.add(volume);
            }
        }
        return mounted;
    }

    private void notifyRemovableStorageChanged() {
        JSObject status = new JSObject();
        status.put("mounted", hasMountedRemovableStorage());
        notifyListeners("removableStorageChanged", status);
    }

    private Uri findPersistedRemovableTreeUri() {
        String storedValue = getStoragePreferences().getString(REMOVABLE_TREE_URI_KEY, null);
        if (storedValue == null) {
            return null;
        }

        Uri storedUri = Uri.parse(storedValue);
        boolean hasWritablePermission = false;
        for (UriPermission permission : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (
                storedUri.equals(permission.getUri())
                    && permission.isReadPermission()
                    && permission.isWritePermission()
            ) {
                hasWritablePermission = true;
                break;
            }
        }

        if (!hasWritablePermission || !treeMatchesMountedRemovableVolume(storedUri)) {
            clearRemovableTreeUri();
            return null;
        }
        return storedUri;
    }

    private boolean treeMatchesMountedRemovableVolume(Uri treeUri) {
        String documentId;
        try {
            documentId = DocumentsContract.getTreeDocumentId(treeUri);
        } catch (IllegalArgumentException exception) {
            return false;
        }

        String volumeId = StoragePaths.volumeIdFromTreeDocumentId(documentId);
        if (volumeId == null) {
            return false;
        }

        for (StorageVolume volume : getMountedRemovableVolumes()) {
            String uuid = volume.getUuid();
            if (uuid != null && uuid.equalsIgnoreCase(volumeId)) {
                return true;
            }
        }
        return false;
    }

    private void writeRemovableCsv(Uri treeUri, String content) throws IOException {
        if (content == null) {
            throw new IOException("Missing CSV content.");
        }

        String treeDocumentId = DocumentsContract.getTreeDocumentId(treeUri);
        Uri current = DocumentsContract.buildDocumentUriUsingTree(treeUri, treeDocumentId);

        for (int index = 0; index < StoragePaths.REMOVABLE_SEGMENTS.length; index++) {
            String name = StoragePaths.REMOVABLE_SEGMENTS[index];
            boolean isFile = index == StoragePaths.REMOVABLE_SEGMENTS.length - 1;
            String mimeType = isFile ? "text/csv" : DocumentsContract.Document.MIME_TYPE_DIR;
            Uri child = findChildDocument(current, name, mimeType);
            if (child == null) {
                child = DocumentsContract.createDocument(
                    getContext().getContentResolver(),
                    current,
                    mimeType,
                    name
                );
            }
            if (child == null) {
                throw new IOException("Unable to create " + name + " on removable storage.");
            }
            current = child;
        }

        writeTextToUri(current, content);
    }

    private Uri findChildDocument(Uri parentUri, String name, String expectedMimeType) throws IOException {
        String parentDocumentId = DocumentsContract.getDocumentId(parentUri);
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(parentUri, parentDocumentId);
        String[] projection = new String[] {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
        };

        try (Cursor cursor = getContext().getContentResolver().query(childrenUri, projection, null, null, null)) {
            if (cursor == null) {
                throw new IOException("Unable to inspect removable storage.");
            }
            while (cursor.moveToNext()) {
                if (!name.equals(cursor.getString(1))) {
                    continue;
                }
                if (!expectedMimeType.equals(cursor.getString(2))) {
                    throw new IOException(name + " exists with an incompatible type.");
                }
                return DocumentsContract.buildDocumentUriUsingTree(parentUri, cursor.getString(0));
            }
        }
        return null;
    }

    private SharedPreferences getStoragePreferences() {
        return getContext().getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    private void storeRemovableTreeUri(Uri treeUri) {
        getStoragePreferences().edit().putString(REMOVABLE_TREE_URI_KEY, treeUri.toString()).apply();
    }

    private void clearRemovableTreeUri() {
        getStoragePreferences().edit().remove(REMOVABLE_TREE_URI_KEY).apply();
    }

    private void resolveRemovableSaved(PluginCall call) {
        JSObject result = new JSObject();
        result.put("status", "saved");
        result.put("path", "myPOIs/myPOIWarnings/" + StoragePaths.DISPLAY_NAME);
        call.resolve(result);
    }

    private void writeToMediaStore(String content) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        Uri existingUri = findTargetUri();

        if (existingUri != null) {
            resolver.delete(existingUri, null, null);
        }

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, StoragePaths.DISPLAY_NAME);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "text/csv");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, getRelativePathForMediaStore());
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri newUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (newUri == null) {
            throw new IOException("MediaStore did not return a URI for speedcam.csv.");
        }

        try (OutputStream outputStream = resolver.openOutputStream(newUri, "w")) {
            if (outputStream == null) {
                throw new IOException("Unable to open output stream for speedcam.csv.");
            }

            outputStream.write(content.getBytes(StandardCharsets.UTF_8));
            outputStream.flush();
        } catch (Exception exception) {
            resolver.delete(newUri, null, null);
            throw exception;
        }

        ContentValues completeValues = new ContentValues();
        completeValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(newUri, completeValues, null, null);
    }

    private Uri findTargetUri() {
        ContentResolver resolver = getContext().getContentResolver();
        String[] projection = new String[] { MediaStore.MediaColumns._ID };
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + " = ? AND " + MediaStore.MediaColumns.RELATIVE_PATH + " = ?";
        String[] selectionArgs = new String[] { StoragePaths.DISPLAY_NAME, getRelativePathForMediaStore() };

        try (Cursor cursor = resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI, projection, selection, selectionArgs, null)) {
            if (cursor == null || !cursor.moveToFirst()) {
                return null;
            }

            long id = cursor.getLong(0);
            return ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI, id);
        }
    }

    private void writeLegacyFile(String content) throws IOException {
        File targetFile = getLegacyTargetFile();
        File parent = targetFile.getParentFile();

        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("Unable to create the target folder.");
        }

        try (FileOutputStream outputStream = new FileOutputStream(targetFile, false)) {
            outputStream.write(content.getBytes(StandardCharsets.UTF_8));
            outputStream.flush();
        }
    }

    private File getLegacyTargetFile() {
        File downloadsDirectory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        return new File(
            downloadsDirectory,
            StoragePaths.DOWNLOAD_RELATIVE_SUBPATH + StoragePaths.DISPLAY_NAME
        );
    }

    private String readTextFromUri(Uri uri) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        try (InputStream inputStream = resolver.openInputStream(uri)) {
            if (inputStream == null) {
                throw new IOException("The selected CSV file could not be opened.");
            }
            return readTextFromStream(inputStream);
        }
    }

    private void writeTextToUri(Uri uri, String content) throws IOException {
        if (content == null) {
            throw new IOException("Missing CSV content.");
        }

        ContentResolver resolver = getContext().getContentResolver();
        try (OutputStream outputStream = resolver.openOutputStream(uri, "rwt")) {
            if (outputStream == null) {
                throw new IOException("The selected CSV file could not be opened.");
            }
            outputStream.write(content.getBytes(StandardCharsets.UTF_8));
            outputStream.flush();
        }
    }

    private String readTextFromFile(File file) throws IOException {
        try (InputStream inputStream = new FileInputStream(file)) {
            return readTextFromStream(inputStream);
        }
    }

    private String readTextFromStream(InputStream inputStream) throws IOException {
        byte[] buffer = new byte[4096];
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        int bytesRead;

        while ((bytesRead = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, bytesRead);
        }

        return new String(outputStream.toByteArray(), StandardCharsets.UTF_8);
    }

    private void persistReadPermission(Intent data, Uri uri) {
        int takeFlags = data.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION;
        if (takeFlags == 0) {
            return;
        }

        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, takeFlags);
        } catch (SecurityException ignored) {}
    }

    private String describeUri(Uri uri) {
        String displayName = queryDisplayName(uri);
        return displayName != null ? displayName : uri.toString();
    }

    private String queryDisplayName(Uri uri) {
        String[] projection = new String[] { MediaStore.MediaColumns.DISPLAY_NAME };

        try (Cursor cursor = getContext().getContentResolver().query(uri, projection, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) {
                return null;
            }

            return cursor.getString(0);
        }
    }

    private void resolveCancelled(PluginCall call) {
        JSObject response = new JSObject();
        response.put("status", "cancelled");
        call.resolve(response);
    }

    private String getRelativePathForMediaStore() {
        return Environment.DIRECTORY_DOWNLOADS + "/" + StoragePaths.DOWNLOAD_RELATIVE_SUBPATH;
    }
}
