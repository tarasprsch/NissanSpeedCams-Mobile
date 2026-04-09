package com.nissan.speedcams;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
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
import org.json.JSONObject;

@CapacitorPlugin(name = "SpeedcamStorage")
public class SpeedcamStoragePlugin extends Plugin {

    private static final String DISPLAY_NAME = "speedcam.csv";
    private static final String RELATIVE_SUBPATH = "_CopyTo-FlashDrive/myPOIs/myPOIWarnings/";
    private static final String TARGET_PATH = "Download/" + RELATIVE_SUBPATH + DISPLAY_NAME;
    private static final String PREFERENCES_NAME = "speedcam_storage";
    private static final String PICKED_URI_KEY = "picked_csv_uri";

    @PluginMethod
    public void readSavedCsv(PluginCall call) {
        try {
            JSObject targetResult = tryReadTargetCsv();
            if (targetResult != null) {
                call.resolve(targetResult);
                return;
            }

            Uri pickedUri = getStoredUri(PICKED_URI_KEY);
            if (pickedUri != null) {
                JSObject pickedResult = new JSObject();
                pickedResult.put("content", readTextFromUri(pickedUri));
                pickedResult.put("path", describeUri(pickedUri));
                pickedResult.put("source", "picked");
                call.resolve(pickedResult);
                return;
            }

            JSObject emptyResult = new JSObject();
            emptyResult.put("content", JSONObject.NULL);
            emptyResult.put("path", TARGET_PATH);
            emptyResult.put("source", "none");
            call.resolve(emptyResult);
        } catch (Exception exception) {
            call.reject("Unable to read speedcam.csv from device storage.", exception);
        }
    }

    @PluginMethod
    public void writeSavedCsv(PluginCall call) {
        String content = call.getString("content");

        if (content == null) {
            call.reject("Missing CSV content.");
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                writeToMediaStore(content);
            } else {
                writeLegacyFile(content);
            }

            JSObject result = new JSObject();
            result.put("path", TARGET_PATH);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to save speedcam.csv to the Downloads folder.", exception);
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
            call.reject("CSV selection was cancelled.");
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("No CSV file was selected.");
            return;
        }

        try {
            persistReadPermission(result.getData(), uri);
            storeUri(PICKED_URI_KEY, uri.toString());

            JSObject response = new JSObject();
            response.put("content", readTextFromUri(uri));
            response.put("path", describeUri(uri));
            response.put("source", "picked");
            call.resolve(response);
        } catch (Exception exception) {
            call.reject("Unable to read the selected CSV file.", exception);
        }
    }

    private JSObject tryReadTargetCsv() throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Uri mediaStoreUri = findTargetUri();
            if (mediaStoreUri == null) {
                return null;
            }

            JSObject result = new JSObject();
            result.put("content", readTextFromUri(mediaStoreUri));
            result.put("path", TARGET_PATH);
            result.put("source", "target");
            return result;
        }

        File legacyFile = getLegacyTargetFile();
        if (!legacyFile.exists()) {
            return null;
        }

        JSObject result = new JSObject();
        result.put("content", readTextFromFile(legacyFile));
        result.put("path", TARGET_PATH);
        result.put("source", "target");
        return result;
    }

    private void writeToMediaStore(String content) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        Uri existingUri = findTargetUri();

        if (existingUri != null) {
            resolver.delete(existingUri, null, null);
        }

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, DISPLAY_NAME);
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
        String[] selectionArgs = new String[] { DISPLAY_NAME, getRelativePathForMediaStore() };

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
        return new File(downloadsDirectory, RELATIVE_SUBPATH + DISPLAY_NAME);
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

    private SharedPreferences getPreferences() {
        return getContext().getSharedPreferences(PREFERENCES_NAME, Activity.MODE_PRIVATE);
    }

    private Uri getStoredUri(String key) {
        String value = getPreferences().getString(key, null);
        return value == null ? null : Uri.parse(value);
    }

    private void storeUri(String key, String value) {
        getPreferences().edit().putString(key, value).apply();
    }

    private String getRelativePathForMediaStore() {
        return Environment.DIRECTORY_DOWNLOADS + "/" + RELATIVE_SUBPATH;
    }
}
