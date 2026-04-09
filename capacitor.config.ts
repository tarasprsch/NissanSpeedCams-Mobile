import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nissan.speedcams',
  appName: 'Speedcam CSV Builder',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;

