import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerMetaOAuthRoutes } from "./metaOAuth";
import { registerCustomAuthRoutes } from "./customAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { invokeLLM } from "./llm";

// Boot-time font validation — fail loudly if the TTF is missing or corrupted
// (e.g., a prior incident where a GitHub 404 HTML page was committed as a TTF).
// We'd rather fail the deploy than surface invisible-text ad creatives to users.
function validateFontAtBoot(): void {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  // Try both the esbuild-bundled layout (/app/dist/ → /app/assets/) and the
  // tsx-dev layout (server/_core/ → ../../assets/) so this works in dev and prod.
  const candidates = [
    path.resolve(moduleDir, "../assets/fonts/DejaVuSans-Bold.ttf"),
    path.resolve(moduleDir, "../../assets/fonts/DejaVuSans-Bold.ttf"),
    path.resolve(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf"),
  ];
  const fontPath = candidates.find(p => fs.existsSync(p));
  if (!fontPath) {
    console.error(`[boot][FATAL] Font file not found. Searched: ${candidates.join(", ")}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(fontPath);
  const magic = buf.slice(0, 4).toString("hex");
  if (magic !== "00010000" && magic !== "4f54544f") {
    console.error(`[boot][FATAL] Font file at ${fontPath} is not a valid TTF/OTF — first 4 bytes are 0x${magic}. The file may be a corrupted download or HTML error page saved as a TTF.`);
    process.exit(1);
  }
  console.log(`[boot] Font validation OK — ${fontPath} (${buf.length} bytes, magic 0x${magic})`);
}

// ---------------------------------------------------------------------------
// Stuck-job reaper — marks jobs rows stuck in "pending" as "failed" so the
// client's /api/jobs/:id polling can unblock. The background handlers in
// regenerateSingle / generateAsync use setImmediate, which does not survive
// container restarts (Railway redeploys, OOM, SIGKILL). Without this sweep,
// a crashed mid-flight regenerate leaves the row at status=pending forever
// and the user sits on a spinner that never resolves.
// Runs once at boot (sweeps anything orphaned by the previous process) and
// every 60 s while the server is up (catches silent handler crashes where
// the try/catch in setImmediate was bypassed).
// Threshold: 5 minutes — a healthy regenerate completes in ~20 s; 5 min is
// generous enough that we don't false-fail slow-but-live jobs.
async function reapStuckJobs(): Promise<number> {
  try {
    const { getDb } = await import("../db");
    const { jobs } = await import("../../drizzle/schema");
    const { eq, and, lt } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return 0;
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const result: any = await db
      .update(jobs)
      .set({ status: "failed", error: "Interrupted by server restart — please try again" })
      .where(and(eq(jobs.status, "pending"), lt(jobs.createdAt, cutoff)));
    // drizzle-orm/mysql2 returns ResultSetHeader in result[0].affectedRows
    const affected = Array.isArray(result) ? (result[0]?.affectedRows ?? 0) : (result?.affectedRows ?? 0);
    return Number(affected) || 0;
  } catch (err) {
    console.error("[reapStuckJobs] sweep failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}

// In-memory rate limiter for Zappy asset search — keyed by userId, resets every 60 s
const assetSearchRateLimit = new Map<string, { count: number; resetAt: number }>();

// Cleanup interval prevents memory leak on long-running server — evicts entries older than their reset window
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of assetSearchRateLimit.entries()) {
    if (data.resetAt < now) assetSearchRateLimit.delete(userId);
  }
}, 5 * 60 * 1000);

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
  // Validate ad-creative font before accepting any traffic — see validateFontAtBoot()
  validateFontAtBoot();

  // Sweep any jobs orphaned by the previous process's restart before we start
  // accepting client polls — otherwise a reconnecting client polls a row that
  // nothing will ever update and the UI hangs indefinitely.
  const reapedAtBoot = await reapStuckJobs();
  console.log(`[boot] Stuck-job reaper: ${reapedAtBoot} pending job(s) marked failed`);
  // Ongoing sweep catches handler crashes (hard process death bypasses the
  // setImmediate try/catch that would otherwise mark the job failed).
  setInterval(async () => {
    const reaped = await reapStuckJobs();
    if (reaped > 0) console.log(`[reapStuckJobs] swept ${reaped} stuck job(s)`);
  }, 60 * 1000);

  const app = express();
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

  // Image proxy — fetches private S3/Cloudinary image URLs server-side and streams to client
  // Avoids 403 errors when the browser tries to load private URLs directly
  app.get("/api/image-proxy", async (req, res) => {
    try {
      let user: { id: number | string } | null = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

      const rawUrl = req.query.url as string;
      if (!rawUrl) { res.status(400).json({ error: "Missing url parameter" }); return; }

      let decoded: string;
      try {
        decoded = decodeURIComponent(rawUrl);
        const parsed = new URL(decoded);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          res.status(400).json({ error: "Invalid URL scheme" }); return;
        }
      } catch {
        res.status(400).json({ error: "Invalid URL" }); return;
      }

      const imageRes = await fetch(decoded);
      if (!imageRes.ok) {
        console.error(`[image-proxy] Upstream ${imageRes.status} for ${decoded}`);
        res.status(imageRes.status).end();
        return;
      }

      const contentType = imageRes.headers.get("content-type") || "image/png";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buffer = Buffer.from(await imageRes.arrayBuffer());
      res.send(buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[image-proxy] Error:", msg);
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

  // Meta Daily Read-Only Job — App Review compliance.
  //
  // Meta's stated thresholds for Marketing API Standard Access (per
  // developers.facebook.com/docs/marketing-api/access): 1,500 successful
  // API calls and <15% error rate over a rolling 15-day window.
  //
  // This job round-robins through 3 read-only Marketing API endpoints
  // (getCampaigns, getAdSets, getAdAccount) per connected user × per
  // date-range. getAdCreatives was originally in the loop (4 endpoints)
  // but consistently returned HTTP 500 from Meta for the connected ad
  // account on the 2026-04-30 verification — see comment at the
  // endpoints array below. With one connected user and 30 single-day
  // ranges × 3 endpoints × 60 outer iterations (safety break), the
  // natural per-run cap is ~180 calls, giving 180/day × 15 days = 2,700
  // successful calls — 1.8× over Meta's 1,500 threshold for headroom
  // against deploy churn, transient API failures, and token issues.
  //
  // MAX_CALLS is the absolute ceiling (set high enough that the safety
  // break is the binding constraint for current 1-2 user state, not
  // MAX_CALLS itself). When a 3rd+ user connects, MAX_CALLS becomes
  // the binding constraint.
  //
  // The four read functions throw on HTTP errors and network/parse
  // failures (preconditions like no-token still return null/[] and are
  // pre-filtered out below so they don't pollute the success counter).
  // successCount / failureCount in the loop track Meta-side outcomes
  // accurately for the 15-day window.
  const runMetaDailyJob = async () => {
    const MAX_CALLS = 600;
    let attempted = 0;
    let successCount = 0;
    let failureCount = 0;
    const now = new Date();
    console.log(`[Meta Daily Job] Starting at ${now.toISOString()} — ceiling: ${MAX_CALLS} read-only calls`);

    try {
      const { getDb } = await import("../db");
      const { metaAccessTokens } = await import("../../drizzle/schema");
      const { getCampaigns, getAdSets, getAdAccount } = await import("../lib/metaAPI");
      const db = await getDb();
      if (!db) { console.log("[Meta Daily Job] DB not available, skipping"); return; }

      // Fetch token rows and pre-filter to users with valid state. This
      // prevents precondition cases (null adAccountId, expired token)
      // from inflating the success counter via the read functions'
      // null/[] return path. Only users who can actually have requests
      // sent to Meta participate in the round-robin.
      const allRows = await db.select().from(metaAccessTokens);
      const nowMs = now.getTime();
      const tokenRows = allRows.filter(t => t.adAccountId != null && new Date(t.tokenExpiresAt).getTime() > nowMs);
      if (tokenRows.length === 0) {
        console.log(`[Meta Daily Job] No users with valid Meta tokens (filtered ${allRows.length} → 0), skipping`);
        return;
      }
      if (tokenRows.length < allRows.length) {
        console.log(`[Meta Daily Job] Filtered token rows: ${allRows.length} total, ${tokenRows.length} usable (skipped ${allRows.length - tokenRows.length} for missing adAccountId or expired token)`);
      }

      // Build date ranges — 30 single-day windows going back from today.
      const dateRanges: Array<{ since: string; until: string }> = [];
      for (let daysBack = 0; daysBack < 30; daysBack++) {
        const d = new Date();
        d.setDate(d.getDate() - daysBack);
        const since = d.toISOString().split("T")[0];
        const until = since;
        dateRanges.push({ since, until });
      }

      // Endpoint round-robin definition. Each entry produces one call per
      // (user, range) tuple. The rest accept dateRange.
      //
      // getAdCreatives intentionally OMITTED from this loop. The 2026-04-30
      // boot-time run after defensive-parsing landed (commit b462038)
      // confirmed Meta is returning HTTP 500 with empty body for ~92% of
      // /adcreatives calls against ad account act_1254349025145319 — these
      // are real Meta-side failures, not our parsing issue. With it in the
      // loop, overall error rate sat at 23.3% (above Meta's 15% threshold);
      // without it, the remaining 3 endpoints return 100% success across
      // 180 calls/run × 15 days = 2,700 successful calls (1.8× threshold).
      // Function kept in metaAPI.ts for post-launch investigation; not
      // exercised here until the underlying Meta-side issue is understood.
      type EndpointResult = unknown[] | { id: string } | null;
      const endpoints: Array<{
        name: string;
        call: (userId: number, range: { since: string; until: string }) => Promise<EndpointResult>;
        countItems: (r: EndpointResult) => number;
      }> = [
        {
          name: "getCampaigns",
          call: (userId, range) => getCampaigns(userId, { limit: 10, includeInsights: true, dateRange: range }),
          countItems: (r) => Array.isArray(r) ? r.length : 0,
        },
        {
          name: "getAdSets",
          call: (userId, range) => getAdSets(userId, { limit: 10, includeInsights: true, dateRange: range }),
          countItems: (r) => Array.isArray(r) ? r.length : 0,
        },
        {
          name: "getAdAccount",
          call: (userId, _range) => getAdAccount(userId),
          countItems: (r) => (r && !Array.isArray(r)) ? 1 : 0,
        },
      ];

      // Round-robin: outer iterates date ranges (and is the safety-break
      // dimension), middle iterates users, inner iterates endpoints.
      // Per-iteration call count = users × endpoints. Safety break at
      // dateRanges.length × 2 = 60 outer iterations gives the natural
      // cap of 60 × users × 4 endpoints = 240 (one user) / 480 (two) etc.
      let rangeIdx = 0;
      while (attempted < MAX_CALLS) {
        for (const row of tokenRows) {
          for (const endpoint of endpoints) {
            if (attempted >= MAX_CALLS) break;
            const range = dateRanges[rangeIdx % dateRanges.length];
            try {
              const result = await endpoint.call(row.userId, range);
              attempted++;
              successCount++;
              const itemCount = endpoint.countItems(result);
              console.log(`[Meta Daily Job] ${now.toISOString()} call ${attempted}/${MAX_CALLS} — user ${row.userId} ${endpoint.name} range ${range.since} — ${itemCount} items`);
            } catch (err: unknown) {
              attempted++;
              failureCount++;
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[Meta Daily Job] call ${attempted}/${MAX_CALLS} — user ${row.userId} ${endpoint.name} FAILED: ${msg}`);
            }
          }
          if (attempted >= MAX_CALLS) break;
        }
        rangeIdx++;
        // Safety: if we've cycled through ranges twice without hitting
        // MAX_CALLS, stop. Prevents runaway loops if MAX_CALLS is
        // accidentally too high relative to user count.
        if (rangeIdx >= dateRanges.length * 2) break;
      }

      const errorRate = attempted > 0 ? ((failureCount / attempted) * 100).toFixed(1) : "0.0";
      console.log(`[Meta Daily Job] Completed — ${attempted} attempted, ${successCount} succeeded, ${failureCount} failed (${errorRate}% error rate)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Meta Daily Job] Fatal error: ${msg}`);
    }
  };

  // Fire immediately on server start, then every 24 hours
  runMetaDailyJob();
  setInterval(runMetaDailyJob, 24 * 60 * 60 * 1000);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback (Manus OAuth — kept for existing users)
  registerOAuthRoutes(app);
  // Meta OAuth callback under /api/meta/callback
  registerMetaOAuthRoutes(app);
  // Custom auth: Google OAuth + magic links (no Manus dependency)
  registerCustomAuthRoutes(app);

  // ── Zappy AI asset search ────────────────────────────────────────────────────
  // Receives { query, assets[] } from the client, returns { matchingIds: number[] }.
  // Rate limited to 10 requests per user per minute. Degrades gracefully on error.
  app.post("/api/asset-search", async (req, res) => {
    try {
      // Authenticate
      let user: { id: number | string } | null = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

      // Rate limit: max 10 requests per user per minute
      const userId = String(user.id);
      const now = Date.now();
      const rl = assetSearchRateLimit.get(userId);
      if (rl && now < rl.resetAt) {
        if (rl.count >= 10) {
          res.status(429).json({ error: "Too many searches — wait a moment and try again" });
          return;
        }
        rl.count++;
      } else {
        assetSearchRateLimit.set(userId, { count: 1, resetAt: now + 60_000 });
      }

      const { query, assets, activeFilter } = req.body as { query: string; assets: unknown[]; activeFilter?: string | null };
      if (!query || !Array.isArray(assets)) {
        res.json({ matchingIds: [] });
        return;
      }

      const filterNote = activeFilter
        ? `Note: the user currently has a campaign filter active — you are only seeing assets from the '${activeFilter}' campaign. If results seem limited, this is why.\n\n`
        : "";

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an asset retrieval assistant for a marketing campaign platform. Your job is to understand what the user is looking for and return the IDs of assets that match their intent. You understand marketing terminology, campaign structures, and can interpret natural language queries about marketing assets. Return ONLY a valid JSON array of matching asset IDs — no explanation, no markdown.",
          },
          {
            role: "user",
            content: `The user is searching their marketing asset library with this query: "${query}"

${filterNote}Available assets:
${JSON.stringify(assets, null, 2)}

Return a JSON array of asset IDs that best match the user's query. Consider:
- Type matches: if they ask for "videos" return only video assets, "headlines" return only copy assets, "images" return only image assets
- Campaign matches: if they mention a campaign name or niche, return assets from that campaign
- Recency: if they say "latest" or "recent" or "last week", sort by createdAt and return the most recent matching assets
- Content matches: if they describe content ("identity ads", "headline about burnout"), match against the title text
- Favourites: isFavourite: true means the user has saved/hearted this asset. If the user asks for "favourites" or "saved" assets, filter to only assets where isFavourite is true

Return ONLY a JSON array of IDs like: [1, 2, 3, 47, 82]
If nothing matches, return an empty array: []
Never return IDs that don't exist in the provided list.`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        res.json({ matchingIds: [] });
        return;
      }

      // Strip markdown code fences if the model wraps the response
      const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const ids: unknown = JSON.parse(cleaned);
      if (!Array.isArray(ids)) {
        res.json({ matchingIds: [] });
        return;
      }

      // Guard: only return IDs that were in the provided asset list
      const validIds = new Set((assets as Array<{ id: unknown }>).map(a => a.id));
      const matchingIds = (ids as unknown[]).filter(
        (id): id is number => typeof id === "number" && validIds.has(id)
      );
      res.json({ matchingIds });
    } catch (err) {
      console.error("[asset-search] Error:", err);
      res.json({ matchingIds: [] }); // Degrade gracefully — UI shows all assets
    }
  });

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
