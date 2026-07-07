/**
 * leadCapture — the public opt-in endpoint (ZAP-owned capture) + retention reaper.
 *
 * POST /api/capture-lead is unauthenticated by design (a marketing opt-in, modeled
 * on the Stripe-webhook public-route pattern). Abuse protection is built in:
 * honeypot field, per-IP rate limit, email validation, hashed IP only. PII is
 * encrypted at rest via piiCrypto. Nothing here touches GHL — the customer's
 * follow-up layer is the Custom Value written at campaign-push.
 *
 * Retention: reapExpiredLeads() hard-deletes rows past purgeAfter (24 months).
 */
import type { Request, Response } from "express";
import { getDb } from "./db";
import { capturedLeads, hvcoTitles } from "../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";
import { encryptPii, hashEmail, hashIp } from "./lib/piiCrypto";

const RETENTION_MS = 24 * 30 * 24 * 60 * 60 * 1000; // ~24 months
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── per-IP rate limit (in-memory; single service) ──
const RL_WINDOW_MS = 60 * 1000;
const RL_MAX = 5;
const rlBucket = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const b = rlBucket.get(key);
  if (!b || now > b.resetAt) { rlBucket.set(key, { count: 1, resetAt: now + RL_WINDOW_MS }); return false; }
  b.count += 1;
  return b.count > RL_MAX;
}

function clientIp(req: Request): string {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return fwd || req.ip || req.socket?.remoteAddress || "unknown";
}

export async function handleCaptureLead(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // 1. Honeypot — a filled hidden field means a bot. Silent success, no store.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      res.status(200).json({ ok: true });
      return;
    }

    // 2. Rate limit by hashed IP.
    const ipHashed = hashIp(clientIp(req));
    if (rateLimited(ipHashed)) { res.status(429).json({ error: "Too many requests" }); return; }

    // 3. Validate.
    const email = String(body.email ?? "").trim();
    const consent = body.consent === true;
    const hvcoId = Number(body.hvcoId);
    if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "A valid email is required" }); return; }
    if (!consent) { res.status(400).json({ error: "Consent is required" }); return; }
    if (!Number.isInteger(hvcoId) || hvcoId <= 0) { res.status(400).json({ error: "Invalid magnet" }); return; }

    const db = await getDb();
    if (!db) { res.status(503).json({ error: "Database not available" }); return; }

    // 4. Resolve the magnet — must be a published lead-magnet row.
    const [hvco] = await db.select().from(hvcoTitles).where(eq(hvcoTitles.id, hvcoId)).limit(1);
    if (!hvco || !hvco.magnetHtmlUrl) { res.status(404).json({ error: "Magnet not found" }); return; }

    // 5. Encrypt + upsert (dedup on userId+emailHash+hvcoId).
    const name = String(body.name ?? "").trim();
    const consentText =
      "I agree to receive this resource and related emails, and accept the privacy policy.";
    const now = new Date();
    await db.insert(capturedLeads).values({
      userId: hvco.userId,
      serviceId: hvco.serviceId ?? null,
      campaignId: hvco.campaignId ?? null,
      hvcoId,
      emailEncrypted: encryptPii(email),
      emailHash: hashEmail(email),
      nameEncrypted: name ? encryptPii(name) : null,
      consentGiven: true,
      consentText,
      privacyPolicyUrl: "https://zapcampaigns.com/privacy",
      sourceSlug: typeof body.slug === "string" ? body.slug.slice(0, 255) : null,
      ipHash: ipHashed,
      userAgent: (req.headers["user-agent"] || "").toString().slice(0, 500) || null,
      magnetHtmlUrl: hvco.magnetHtmlUrl,
      magnetPdfUrl: hvco.magnetPdfUrl ?? null,
      deliveredAt: now,
      purgeAfter: new Date(now.getTime() + RETENTION_MS),
    }).onDuplicateKeyUpdate({
      set: { deliveredAt: now, consentGiven: true, magnetHtmlUrl: hvco.magnetHtmlUrl, magnetPdfUrl: hvco.magnetPdfUrl ?? null },
    });

    // 6. Deliver on-page (bridge reads these).
    res.status(200).json({ ok: true, magnetHtmlUrl: hvco.magnetHtmlUrl, magnetPdfUrl: hvco.magnetPdfUrl ?? "" });
  } catch (err) {
    console.error("[capture-lead] error:", err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: "Capture failed" });
  }
}

/** Hard-delete captured leads past their retention window. Returns count. */
export async function reapExpiredLeads(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;
    const result = await db.delete(capturedLeads).where(lt(capturedLeads.purgeAfter, new Date()));
    const affected = (result as unknown as { rowsAffected?: number })?.rowsAffected ?? 0;
    return affected;
  } catch (err) {
    console.warn("[reapExpiredLeads] error:", err instanceof Error ? err.message : String(err));
    return 0;
  }
}
