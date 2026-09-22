package com.nissan.speedcams;

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

    static String volumeIdFromTreeDocumentId(String documentId) {
        int separator = documentId.indexOf(':');
        if (separator <= 0) {
            return null;
        }
        String volumeId = documentId.substring(0, separator);
        return "primary".equalsIgnoreCase(volumeId) ? null : volumeId;
    }

    private StoragePaths() {}
}
