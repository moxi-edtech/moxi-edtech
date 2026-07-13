import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ao.klasse.app',
  appName: 'Klasse',
  webDir: 'public',
  server: {
    url: 'https://app.klasse.ao',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
