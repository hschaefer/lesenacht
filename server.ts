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
    const { url, token } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      console.log(`Proxying request to Plex: ${url}`);
      const response = await axios({
        method: "get",
        url: url,
        headers: {
          "X-Plex-Token": (token as string) || "",
          "Accept": "application/json, text/plain, */*",
        },
        timeout: 10000, // 10 second timeout
      });
      res.send(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorMsg = error.response?.data || error.message;
      console.error(`Plex Proxy Error [${status}]: ${url}`, errorMsg);
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
