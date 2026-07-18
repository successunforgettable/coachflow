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
import { capturedLeads, hvcoTitles, landingPages } from "../drizzle/schema";
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

// Quiz answers (zero-party). Accept only a well-shaped array of
// {question, answer, weight}; cap the count and per-field length and drop the
// whole payload if it serialises beyond a sane ceiling — a client cannot bloat
// the row. Returns null when there's nothing valid (static formats, junk input).
const SUBMISSION_MAX_ITEMS = 30;
const SUBMISSION_MAX_BYTES = 20000;
type QuizAnswer = { question: string; answer: string; weight: number | null };
function sanitizeSubmission(raw: unknown): QuizAnswer[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: QuizAnswer[] = raw.slice(0, SUBMISSION_MAX_ITEMS).map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const w = Number(o.weight);
    return {
      question: String(o.question ?? "").slice(0, 500),
      answer: String(o.answer ?? "").slice(0, 500),
      weight: Number.isFinite(w) ? w : null,
    };
  }).filter((a) => a.question || a.answer);
  if (items.length === 0) return null;
  if (JSON.stringify(items).length > SUBMISSION_MAX_BYTES) return null;
  return items;
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

    // 3. Validate (common to every capture mode).
    const email = String(body.email ?? "").trim();
    const consent = body.consent === true;
    if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "A valid email is required" }); return; }
    if (!consent) { res.status(400).json({ error: "Consent is required" }); return; }

    const db = await getDb();
    if (!db) { res.status(503).json({ error: "Database not available" }); return; }

    // 3w. Webinar / event / sales registration mode. A webinar, event, or sales page has NO magnet
    // to deliver — it just captures the lead (email + consent) against the landing page's owner. The
    // page posts { mode: "webinar" | "event" | "sales", slug } where slug is the LP's public slug
    // (read from its URL), so the owner/service/campaign are resolved here. Same PII/consent/retention
    // path as the lead-magnet opt-in; hvcoId is null (nullable column) and nothing is delivered
    // on-page. Sales capture is the fallback for a sales page whose coach has set NO checkout URL —
    // the CTA collects the email so a coach follows up with enrolment details (never a dead button).
    if (body.mode === "webinar" || body.mode === "event" || body.mode === "sales" || body.mode === "discovery") {
      const consentByMode =
        body.mode === "event"
          ? "I agree to receive my event ticket and related emails, and accept the privacy policy."
          : body.mode === "sales"
          ? "I agree to receive enrolment details and related emails, and accept the privacy policy."
          : body.mode === "discovery"
          ? "I agree to be contacted about a discovery call and accept the privacy policy."
          : "I agree to receive the webinar joining link and related emails, and accept the privacy policy.";
      const slug = typeof body.slug === "string" ? body.slug.trim().slice(0, 255) : "";
      if (!slug) { res.status(400).json({ error: "Invalid registration" }); return; }
      const [lp] = await db
        .select({ userId: landingPages.userId, serviceId: landingPages.serviceId, campaignId: landingPages.campaignId })
        .from(landingPages)
        .where(eq(landingPages.publicSlug, slug))
        .limit(1);
      if (!lp) { res.status(404).json({ error: "Registration page not found" }); return; }

      const wName = String(body.name ?? "").trim();
      const wNow = new Date();
      await db.insert(capturedLeads).values({
        userId: lp.userId,
        serviceId: lp.serviceId ?? null,
        campaignId: lp.campaignId ?? null,
        hvcoId: null,
        emailEncrypted: encryptPii(email),
        emailHash: hashEmail(email),
        nameEncrypted: wName ? encryptPii(wName) : null,
        consentGiven: true,
        consentText: consentByMode,
        privacyPolicyUrl: "https://zapcampaigns.com/privacy",
        sourceSlug: slug,
        ipHash: ipHashed,
        userAgent: (req.headers["user-agent"] || "").toString().slice(0, 500) || null,
        magnetHtmlUrl: null,
        magnetPdfUrl: null,
        submissionData: null,
        resultBand: null,
        deliveredAt: wNow,
        purgeAfter: new Date(wNow.getTime() + RETENTION_MS),
      });
      res.status(200).json({ ok: true, registered: true });
      return;
    }

    // 3m. Lead-magnet mode requires a valid magnet id.
    const hvcoId = Number(body.hvcoId);
    if (!Number.isInteger(hvcoId) || hvcoId <= 0) { res.status(400).json({ error: "Invalid magnet" }); return; }

    // 4. Resolve the magnet — must be a published lead-magnet row.
    const [hvco] = await db.select().from(hvcoTitles).where(eq(hvcoTitles.id, hvcoId)).limit(1);
    if (!hvco || !hvco.magnetHtmlUrl) { res.status(404).json({ error: "Magnet not found" }); return; }

    // 4b. Quiz zero-party payload (optional — static formats never send these).
    //     submissionData = the taker's answers; resultBand = their scored band.
    //     Sanitised + size-capped so a hostile client can't bloat the row.
    const submissionData = sanitizeSubmission(body.submissionData);
    const resultBand =
      typeof body.resultBand === "string" && body.resultBand.trim()
        ? body.resultBand.trim().slice(0, 120)
        : null;

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
      submissionData,
      resultBand,
      deliveredAt: now,
      purgeAfter: new Date(now.getTime() + RETENTION_MS),
    }).onDuplicateKeyUpdate({
      // Retake overwrites: the new submission is authoritative, so the answers and
      // band must REPLACE the prior ones (not silently keep the old ones).
      set: {
        deliveredAt: now, consentGiven: true,
        magnetHtmlUrl: hvco.magnetHtmlUrl, magnetPdfUrl: hvco.magnetPdfUrl ?? null,
        submissionData, resultBand,
      },
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
