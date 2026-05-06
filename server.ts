import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy for Plex API calls to handle CORS
  app.get("/api/plex-proxy", async (req, res) => {
    const { url } = req.query;
    
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const parsedUrl = new URL(url);
      const isPlexDirect = parsedUrl.hostname.endsWith(".plex.direct");
      const isPlexTv = parsedUrl.hostname === "plex.tv" || parsedUrl.hostname.endsWith(".plex.tv");

      if (!isPlexDirect && !isPlexTv) {
        console.warn(`Blocked potentially malicious proxy attempt to: ${url}`);
        return res.status(403).json({ error: "Forbidden: Only Plex domains are allowed" });
      }
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    // Sanitize URL for logging (remove potential tokens from query string)
    const sanitizeUrl = (u: string) => u.replace(/X-Plex-Token=[^&]+/g, "X-Plex-Token=REDACTED");

    const plexHeaders: Record<string, string> = {
      "Accept": "application/json",
    };

    // Forward all X-Plex headers
    Object.keys(req.headers).forEach(key => {
      if (key.toLowerCase().startsWith('x-plex-')) {
        plexHeaders[key] = req.headers[key] as string;
      }
    });

    try {
      // We don't log the full URL to avoid potential tokens in it
      console.log(`Proxying request to Plex: ${sanitizeUrl(url)}`);
      
      const response = await axios({
        method: "get",
        url: url,
        headers: plexHeaders,
        timeout: 10000, // 10 second timeout
      });
      res.send(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorMsg = error.response?.data || error.message;
      
      // Limit error message logging if it might contain private data
      console.error(`Plex Proxy Error [${status}]: ${sanitizeUrl(url)}`);
      res.status(status).send(errorMsg);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
