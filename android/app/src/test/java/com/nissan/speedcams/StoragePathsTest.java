package com.nissan.speedcams;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertEquals;

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
