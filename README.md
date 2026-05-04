# Lesenacht

Lesenacht is a progressive web app designed for streaming and listening to audiobooks, utilizing your self-hosted Plex server as the backend.

## AI statement

This application is completely **vibe coded**. If thats not for you, please move on.

## Features

- **Plex Integration**: Connect to your Plex server to access your audiobook library.
- **Local Progress Tracking**: Automatically saves your position in every audiobook locally on your device.
- **Progressive Web App**: Optimized for use on mobile and desktop browsers.
- **Android app** with audiobook download and offline capabilities.

## Deployment

### Local Deployment

To run Lesenacht on your local machine with full proxy support:

1. **Install**: `npm install`
2. **Start**: `npm run dev`
3. **Access**: Open `http://localhost:3000`

### Cloudflare Pages Deployment

This app is optimized for deployment on [Cloudflare Pages](https://pages.cloudflare.com/).

**Deployment Steps:**

1. **Dashboard**: Go to Cloudflare Dashboard > **Workers & Pages** > **Create** > **Pages** > **Connect to Git**.
2. **Build Settings**:
  - **Framework Preset**: `Vite`
    - **Build Command**: `npm run build`
    - **Build Output Directory**: `dist`

## Android app

This project uses **Capacitor** to turn the web application into a native Android app.

### Prerequisites for Android

- [Android Studio](https://developer.android.com/studio) installed on your local machine.
- Android SDK and build tools configured.

### Android Commands

- **First-time setup**:
  ```bash
  npm run cap:add
  ```
- **Sync web changes to Android**:
Run this every time you make changes to your React code that you want to see in the app:
  ```bash
  npm run cap:sync
  ```
- **Build APK (Command Line)**:
  Run this to generate a debug APK without opening Android Studio:
  ```bash
  npm run build && npx cap sync
  cd android && ./gradlew assembleDebug
  ```
  The generated APK will be located at: `android/app/build/outputs/apk/debug/app-debug.apk`

- **Open in Android Studio**:
  ```bash
  npm run cap:open
  ```
  From there, you can build and run the app using the standard Android Studio tools.

## Privacy Statement

This application is designed with privacy in mind. It does not collect or store personal information on external servers. All data processing related to your media remains under your control.

- **Local-First**: This app is "local-first". Your Plex authentication token and library metadata are stored locally in your browser or on your device.
- **No Central Backend**: There is no central database or analytics server. All communication happens directly between your application and the Plex servers. For the web app, some requests may be routed through your own self-hosted thin proxy for connectivity.
- **Data Control**: You remain in control of your data. The application does not transmit PII (Personally Identifiable Information) to any third party other than Plex.

---

*This project was built using the Google AI Studio environment.*
