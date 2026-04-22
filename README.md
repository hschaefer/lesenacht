# Lesenacht

Lesenacht is a progressive web app designed for streaming and listening to audiobooks, utilizing your self-hosted Plex server as the backend.

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

## Self-Hosting / Deployment

To build the application for production:

1. Build the static assets:
   ```bash
   npm run build
   ```

2. The production files will be generated in the `dist/` directory. You can serve these files using any static file server (like Nginx, Apache, or `serve`).

---

*This project was built using the Google AI Studio environment.*
