import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerMetaOAuthRoutes } from "./metaOAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Stripe webhook MUST be registered BEFORE express.json() for signature verification
  const { handleStripeWebhook } = await import("../stripe/webhook");
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Meta OAuth callback under /api/meta/callback
  registerMetaOAuthRoutes(app);
  // Server-side ZIP download for campaign creatives (avoids CORS issues with CDN images)
  app.get("/api/campaigns/:campaignId/download-zip", async (req, res) => {
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        res.status(400).json({ error: "Invalid campaign ID" });
        return;
      }

      const { getDb } = await import("../db");
      const { campaigns, adCreatives, videos } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const archiver = (await import("archiver")).default;
      const https = await import("https");
      const http = await import("http");

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Database not available" });
        return;
      }

      // Verify campaign ownership
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
        .limit(1);

      if (!campaign) {
        res.status(404).json({ error: "Campaign not found" });
        return;
      }

      // Get all images and videos
      const images = await db.select().from(adCreatives).where(eq(adCreatives.campaignId, campaignId));
      const videosList = await db.select().from(videos).where(eq(videos.campaignId, campaignId));

      // Helper to fetch a URL as a stream
      const fetchStream = (url: string): Promise<NodeJS.ReadableStream> => {
        return new Promise((resolve, reject) => {
          const client = url.startsWith("https") ? https : http;
          client.get(url, (response) => {
            if (response.statusCode && response.statusCode >= 400) {
              reject(new Error(`HTTP ${response.statusCode} for ${url}`));
            } else {
              resolve(response);
            }
          }).on("error", reject);
        });
      };

      // Set up ZIP streaming response
      const campaignName = campaign.name.replace(/[^a-zA-Z0-9\s-_]/g, "").trim();
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${campaignName}-creatives.zip"`);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(res);

      // Add images to ZIP
      for (const image of images) {
        if (!image.imageUrl) continue;
        try {
          const stream = await fetchStream(image.imageUrl);
          archive.append(stream as any, { name: `images/image-${image.id}.png` });
        } catch (err) {
          console.error(`[ZIP] Failed to fetch image ${image.id}:`, err);
        }
      }

      // Add videos to ZIP (only succeeded ones)
      for (const video of videosList) {
        if (!video.videoUrl || video.creatomateStatus !== "succeeded") continue;
        try {
          const stream = await fetchStream(video.videoUrl);
          archive.append(stream as any, { name: `videos/video-${video.id}.mp4` });
        } catch (err) {
          console.error(`[ZIP] Failed to fetch video ${video.id}:`, err);
        }
      }

      await archive.finalize();
    } catch (err) {
      console.error("[ZIP] Download error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create ZIP" });
      }
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
