# Lesenacht

Lesenacht is a progressive web app designed for streaming and listening to audiobooks, utilizing your self-hosted Plex server as the backend.

##  AI statement

This application is completely **vibe coded**. If thats not for you, please move on.

## Features

- **Plex Integration**: Connect to your Plex server to access your audiobook library.
- **Local Progress Tracking**: Automatically saves your position in every audiobook locally on your device.
- **Progressive Web App**: Optimized for use on mobile and desktop browsers with offline capabilities.

## Getting Started

### Prerequisites

- A running Plex server with your audiobooks.
- Node.js 
- npm 

## Deployment

### Local Deployment
To run Lesenacht on your local machine with full proxy support:
1. **Install**: `npm install`
2. **Start**: `npm run dev`
3. **Access**: Open `http://localhost:3000`

### Cloudflare Pages Deployment

This app is optimized for deployment on [Cloudflare Pages](https://pages.cloudflare.com/):

1.  **Framework Preset**: None (or select Vite)
2.  **Build Command**: `npm run build`
3.  **Build Output Directory**: `dist`
4.  **Backend Logic**: The `/functions` directory contains the Plex proxy logic. Cloudflare Pages detects this automatically and deploys it as Cloudflare Workers.
5
## Mobile App (Android)

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
- **Open in Android Studio**:
  ```bash
  npm run cap:open
  ```

---

*This project was built using the Google AI Studio environment.*
