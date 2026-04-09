package com.nissan.speedcams;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SpeedcamStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
