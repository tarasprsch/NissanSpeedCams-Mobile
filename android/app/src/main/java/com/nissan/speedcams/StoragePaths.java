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

    private StoragePaths() {}
}
