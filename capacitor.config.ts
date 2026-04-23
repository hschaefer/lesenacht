import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.lesenacht.app',
  appName: 'Lesenacht',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
