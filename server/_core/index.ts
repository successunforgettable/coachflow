import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerMetaOAuthRoutes } from "./metaOAuth";
import { registerCustomAuthRoutes } from "./customAuth";
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
  app.set("trust proxy", 1);
  const server = createServer(app);
  
  // Stripe webhook MUST be registered BEFORE express.json() for signature verification
  const { handleStripeWebhook } = await import("../stripe/webhook");
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  
  // Jobs polling endpoint — returns job status/result for background generation
  // Requires authentication; enforces userId ownership so users can only poll their own jobs
  app.get("/api/jobs/:jobId", async (req, res) => {
    try {
      // Authenticate the request
      let user: { id: number | string } | null = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

      const { getDb } = await import("../db");
      const { jobs } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Database not available" }); return; }
      // Ownership check: only the job owner can poll
      const [job] = await db.select().from(jobs)
        .where(and(eq(jobs.id, req.params.jobId), eq(jobs.userId, String(user.id))))
        .limit(1);
      if (!job) { res.status(404).json({ error: "Job not found" }); return; }
      res.json({ status: job.status, result: job.result ? JSON.parse(job.result) : null, error: job.error, progress: job.progress ? (() => { try { return JSON.parse(job.progress); } catch { return null; } })() : null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Daily cleanup cron — delete jobs older than 24 hours to prevent table bloat
  setInterval(async () => {
    try {
      const { getDb } = await import("../db");
      const { jobs } = await import("../../drizzle/schema");
      const { lt } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return;
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db.delete(jobs).where(lt(jobs.createdAt, cutoff));
      console.log(`[jobs-cleanup] Deleted jobs older than ${cutoff.toISOString()}`);
    } catch (err) {
      console.error("[jobs-cleanup] Error:", err);
    }
  }, 24 * 60 * 60 * 1000); // runs every 24 hours

  // Meta Daily Read-Only Job — 150 API calls/day for App Review compliance
  const runMetaDailyJob = async () => {
    const MAX_CALLS = 150;
    let callCount = 0;
    const now = new Date();
    console.log(`[Meta Daily Job] Starting at ${now.toISOString()} — target: ${MAX_CALLS} read-only calls`);

    try {
      const { getDb } = await import("../db");
      const { metaAccessTokens } = await import("../../drizzle/schema");
      const { getCampaigns } = await import("../lib/metaAPI");
      const db = await getDb();
      if (!db) { console.log("[Meta Daily Job] DB not available, skipping"); return; }

      // Fetch all users with Meta tokens
      const tokenRows = await db.select({ userId: metaAccessTokens.userId }).from(metaAccessTokens);
      if (tokenRows.length === 0) { console.log("[Meta Daily Job] No users with Meta tokens, skipping"); return; }

      // Build date ranges for multiple calls per user
      const dateRanges: Array<{ since: string; until: string }> = [];
      for (let daysBack = 0; daysBack < 30; daysBack++) {
        const d = new Date();
        d.setDate(d.getDate() - daysBack);
        const since = d.toISOString().split("T")[0];
        const until = since;
        dateRanges.push({ since, until });
      }

      // Round-robin through users × date ranges until 150 calls
      let rangeIdx = 0;
      while (callCount < MAX_CALLS) {
        for (const row of tokenRows) {
          if (callCount >= MAX_CALLS) break;
          const range = dateRanges[rangeIdx % dateRanges.length];
          try {
            const campaigns = await getCampaigns(row.userId, {
              limit: 10,
              includeInsights: true,
              dateRange: range,
            });
            callCount++;
            console.log(`[Meta Daily Job] ${now.toISOString()} call ${callCount} of ${MAX_CALLS} — user ${row.userId} range ${range.since} — ${campaigns.length} campaigns`);
          } catch (err: unknown) {
            callCount++;
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[Meta Daily Job] call ${callCount} of ${MAX_CALLS} — user ${row.userId} FAILED: ${msg}`);
          }
        }
        rangeIdx++;
        // Safety: if we've exhausted all date ranges × users and still not at 150, break
        if (rangeIdx >= dateRanges.length * 2) break;
      }

      console.log(`[Meta Daily Job] Completed — ${callCount} total calls`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Meta Daily Job] Fatal error: ${msg}`);
    }
  };

  // Fire immediately on server start, then every 24 hours
  runMetaDailyJob();
  setInterval(runMetaDailyJob, 24 * 60 * 60 * 1000);

  // ── Asset upload endpoint (Cloudinary) ──────────────────────────────────────
  {
    const multer = (await import("multer")).default;
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
      },
    });

    // GHL OAuth callback
    app.get("/api/oauth/gohighlevel/callback", async (req, res) => {
      try {
        const { code, state } = req.query as { code?: string; state?: string };
        console.log("[GHL callback] Hit — code:", code ? "present" : "missing", "state:", state);
        if (!code) { res.status(400).send("Missing authorization code"); return; }
        // state contains the userId — redirect to dashboard with code param for client to exchange
        res.redirect(`/v2-dashboard/wizard/pushToMeta?ghl_code=${encodeURIComponent(code)}&ghl_state=${encodeURIComponent(state || "")}`);
      } catch (err) {
        console.error("[GHL callback] Error:", err);
        res.status(500).send("GHL OAuth callback failed");
      }
    });

    app.post("/api/upload-asset", upload.single("file"), async (req, res) => {
      try {
        let user: { id: number | string } | null = null;
        try { user = await sdk.authenticateRequest(req); } catch { /* */ }
        if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

        const file = (req as any).file;
        if (!file) { res.status(400).json({ error: "No file provided" }); return; }

        const { storagePut } = await import("../storage");
        const key = `coach-assets/${user.id}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { url } = await storagePut(key, file.buffer, file.mimetype);
        res.json({ url });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[upload-asset] Error:", msg);
        res.status(400).json({ error: msg });
      }
    });
  }

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Meta OAuth callback under /api/meta/callback
  registerMetaOAuthRoutes(app);
  // Custom auth: Google OAuth + magic links (no Manus dependency)
  registerCustomAuthRoutes(app);
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

  // Item 2.4 — Full campaign export ZIP (all 11 steps as markdown + media)
  app.get("/api/campaigns/:campaignId/export-zip", async (req, res) => {
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
      const {
        campaigns,
        offers,
        heroMechanisms,
        hvcoTitles,
        headlines,
        idealCustomerProfiles,
        adCopy,
        adCreatives,
        videoScripts,
        videos,
        landingPages,
        emailSequences,
        whatsappSequences,
      } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const archiver = (await import("archiver")).default;
      const https = await import("https");
      const http = await import("http");
      const {
        formatSalesOffer,
        formatUniqueMethod,
        formatFreeOptIn,
        formatHeadlines,
        formatIdealCustomerProfile,
        formatAdCopy,
        formatVideoScripts,
        formatLandingPage,
        formatEmailSequence,
        formatWhatsappSequence,
        generateReadme,
      } = await import("../campaignExportFormatters");

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

      // Fetch all assets in parallel
      const [
        offersRows, heroRows, hvcoRows, headlineRows, icpRows, adCopyRows,
        adCreativeRows, videoScriptRows, videoRows, landingPageRows,
        emailRows, whatsappRows,
      ] = await Promise.all([
        db.select().from(offers).where(eq(offers.campaignId, campaignId)),
        db.select().from(heroMechanisms).where(eq(heroMechanisms.campaignId, campaignId)),
        db.select().from(hvcoTitles).where(eq(hvcoTitles.campaignId, campaignId)),
        db.select().from(headlines).where(eq(headlines.campaignId, campaignId)),
        db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.campaignId, campaignId)),
        db.select().from(adCopy).where(eq(adCopy.campaignId, campaignId)),
        db.select().from(adCreatives).where(eq(adCreatives.campaignId, campaignId)),
        db.select().from(videoScripts).where(eq(videoScripts.campaignId, campaignId)),
        db.select().from(videos).where(eq(videos.campaignId, campaignId)),
        db.select().from(landingPages).where(eq(landingPages.campaignId, campaignId)),
        db.select().from(emailSequences).where(eq(emailSequences.campaignId, campaignId)),
        db.select().from(whatsappSequences).where(eq(whatsappSequences.campaignId, campaignId)),
      ]);

      // Helper to fetch a URL as a stream with graceful failure
      const warnings: string[] = [];
      const fetchStream = (url: string, label: string): Promise<NodeJS.ReadableStream | null> => {
        return new Promise((resolve) => {
          const client = url.startsWith("https") ? https : http;
          client.get(url, (response) => {
            if (response.statusCode && response.statusCode >= 400) {
              warnings.push(`${label} — HTTP ${response.statusCode}`);
              resolve(null);
            } else {
              resolve(response);
            }
          }).on("error", (err: Error) => {
            warnings.push(`${label} — ${err.message}`);
            resolve(null);
          });
        });
      };

      // Build step summaries for README
      const stepSummaries: Array<{ number: number; name: string; included: boolean; reason?: string; warnings?: string[] }> = [
        { number: 1, name: "Sales Offer", included: offersRows.length > 0 },
        { number: 2, name: "Unique Method", included: heroRows.length > 0 },
        { number: 3, name: "Free Opt-In", included: hvcoRows.length > 0 },
        { number: 4, name: "Headlines", included: headlineRows.length > 0 },
        { number: 5, name: "Ideal Customer Profile", included: icpRows.length > 0 },
        { number: 6, name: "Ad Copy", included: adCopyRows.length > 0 },
        { number: 7, name: "Ad Images", included: adCreativeRows.filter((r) => !!r.imageUrl).length > 0 },
        { number: 8, name: "Ad Videos", included: videoScriptRows.length > 0 || videoRows.filter((v) => v.videoUrl && v.creatomateStatus === "succeeded").length > 0 },
        { number: 9, name: "Landing Page", included: landingPageRows.length > 0 },
        { number: 10, name: "Email Follow-Up", included: emailRows.length > 0 },
        { number: 11, name: "WhatsApp Follow-Up", included: whatsappRows.length > 0 },
      ];
      for (const s of stepSummaries) {
        if (!s.included) s.reason = "No assets generated";
      }

      // Set up ZIP streaming response
      const safeName = campaign.name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim();
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}-campaign.zip"`);
      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.pipe(res);

      // Step 1 — Sales Offer
      if (offersRows.length > 0) {
        archive.append(formatSalesOffer(offersRows as any), { name: "01-sales-offer/sales-offer.md" });
      }
      // Step 2 — Unique Method
      if (heroRows.length > 0) {
        archive.append(formatUniqueMethod(heroRows as any), { name: "02-unique-method/unique-method.md" });
      }
      // Step 3 — Free Opt-In
      if (hvcoRows.length > 0) {
        archive.append(formatFreeOptIn(hvcoRows as any), { name: "03-free-opt-in/free-opt-in.md" });
      }
      // Step 4 — Headlines
      if (headlineRows.length > 0) {
        archive.append(formatHeadlines(headlineRows as any), { name: "04-headlines/headlines.md" });
      }
      // Step 5 — Ideal Customer Profile
      if (icpRows.length > 0) {
        archive.append(formatIdealCustomerProfile(icpRows as any), { name: "05-ideal-customer-profile/icp.md" });
      }
      // Step 6 — Ad Copy
      if (adCopyRows.length > 0) {
        archive.append(formatAdCopy(adCopyRows as any), { name: "06-ad-copy/ad-copy.md" });
      }
      // Step 7 — Ad Images
      const imageWarnings: string[] = [];
      for (const img of adCreativeRows) {
        if (!img.imageUrl) continue;
        const stream = await fetchStream(img.imageUrl, `image-${img.id}.png`);
        if (stream) {
          archive.append(stream as any, { name: `07-ad-images/image-${img.id}.png` });
        } else {
          imageWarnings.push(`image-${img.id}.png — fetch failed`);
        }
      }
      if (imageWarnings.length > 0) stepSummaries[6].warnings = imageWarnings;
      // Step 8 — Ad Videos + video-scripts.md
      if (videoScriptRows.length > 0) {
        archive.append(formatVideoScripts(videoScriptRows as any), { name: "08-ad-videos/video-scripts.md" });
      }
      const videoWarnings: string[] = [];
      for (const vid of videoRows) {
        if (!vid.videoUrl || vid.creatomateStatus !== "succeeded") continue;
        const stream = await fetchStream(vid.videoUrl, `video-${vid.id}.mp4`);
        if (stream) {
          archive.append(stream as any, { name: `08-ad-videos/video-${vid.id}.mp4` });
        } else {
          videoWarnings.push(`video-${vid.id}.mp4 — fetch failed`);
        }
      }
      if (videoWarnings.length > 0) stepSummaries[7].warnings = videoWarnings;
      // Step 9 — Landing Page
      if (landingPageRows.length > 0) {
        archive.append(formatLandingPage(landingPageRows as any), { name: "09-landing-page/landing-page.md" });
      }
      // Step 10 — Email Follow-Up
      if (emailRows.length > 0) {
        archive.append(formatEmailSequence(emailRows as any), { name: "10-email-follow-up/email-sequence.md" });
      }
      // Step 11 — WhatsApp Follow-Up
      if (whatsappRows.length > 0) {
        archive.append(formatWhatsappSequence(whatsappRows as any), { name: "11-whatsapp-follow-up/whatsapp-sequence.md" });
      }
      // README.txt
      archive.append(generateReadme(campaign.name, new Date(), stepSummaries), { name: "README.txt" });

      await archive.finalize();
    } catch (err) {
      console.error("[ExportZIP] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create export ZIP" });
      }
    }
  });

  // Temporary debug: save ZIP to disk (remove after evidence capture)
  app.post("/api/debug-save-zip", async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const buf = Buffer.from(body.data, "base64");
        const fsSync = require("fs");
        fsSync.writeFileSync("/tmp/campaign-debug-export.zip", buf);
        res.json({ ok: true, size: buf.length });
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // TEMP: E2E test login endpoint (dev/preview only — not in production)
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/test-login/:openId", async (req, res) => {
      try {
        const { COOKIE_NAME, ONE_YEAR_MS } = await import("../../shared/const");
        const { getSessionCookieOptions } = await import("./cookies");
        const { openId } = req.params;
        const token = await sdk.createSessionToken(openId, { name: "Test User E2E", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        res.redirect("/v2-dashboard");
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });
  }

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
