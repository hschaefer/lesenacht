# Lesenacht

Lesenacht is a progressive web app designed for streaming and listening to audiobooks, utilizing your self-hosted Plex server as the backend.

## ✨ Vibe Coded

This application is completely **vibe coded**. It was developed through natural language guidance and creative intuition, prioritizing a fluid development experience and emotional resonance over traditional rigid specifications.

## Features

- **Plex Integration**: Connect to your Plex server to access your audiobook library.
- **Progress Syncing**: Keep your position synced across devices.
- **Progressive Web App**: Optimized for use on mobile and desktop browsers with offline capabilities.

## Getting Started

### Prerequisites

- A running Plex server with your audiobooks.
- Node.js (v20 or higher recommended).
- npm (usually installed with Node.js).

### Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd lesenacht
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application:
   ```bash
   npm run dev
   ```

This will start the development server. Access the app at `http://localhost:3000`.

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

### Native vs Web
On Android, the app communicates directly with the Plex API, bypassing the CORS proxy used in the web version for better performance and reliability.

## Self-Hosting / Deployment

To build the application for production:

1. Build the static assets:
   ```bash
   npm run build
   ```

2. The production files will be generated in the `dist/` directory. You can serve these files using any static file server (like Nginx, Apache, or `serve`).

---

*This project was built using the Google AI Studio environment.*
