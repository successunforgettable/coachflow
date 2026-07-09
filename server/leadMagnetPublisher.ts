/**
 * leadMagnetPublisher — the delivery layer for a generated lead magnet.
 *
 * From hvcoTitles.assetBody it produces ONE HTML source of truth and hosts it:
 *   1. deliverable page → Cloudflare KV (/p/{slug}) — the branded content + the
 *      exact page the PDF is rendered from.
 *   2. PDF → Cloudflare Browser Rendering on that page's URL → Cloudinary (raw).
 *   3. opt-in page → Cloudflare KV (/p/{slug}) — the capture form (consent +
 *      honeypot) that delivers on-page and reveals the deliverable + PDF.
 *   4. persists magnetHtmlUrl (deliverable) + magnetPdfUrl on the hvcoTitles row.
 *
 * Locked line held: nothing here touches GHL. The customer's follow-up layer is
 * the `ZAP Lead Magnet URL` Custom Value written at campaign-push (ghl.ts), and
 * ZAP-owned capture lives in capturedLeads. Quiz publishes as ONE interactive page
 * (renderQuizPage) — client-side scoring, email gate at the result, no separate
 * opt-in page and no PDF. Never throws into the orchestration cascade — returns
 * null on any failure and leaves the row unpublished (re-publishable).
 */
import { getDb } from "./db";
import { hvcoTitles, services } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { LeadMagnetBody } from "./leadMagnetContentGenerator";
import { renderDeliverableHtml, renderOptInHtml, renderQuizPage } from "./leadMagnetRenderer";
import { storagePut } from "./storage";
import { getCoachLogoUrl } from "./lib/coachLogo";

const BASE = "https://zapcampaigns.com";

function slugify(s: string): string {
  return (s || "magnet").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "magnet";
}

export type PublishLeadMagnetResult = {
  optInUrl: string;
  deliverableUrl: string;
  pdfUrl: string;
};

/**
 * Publish the delivery surfaces for one selected lead-magnet title.
 * Returns null if there is no body, the format is out of scope (quiz), or a
 * fatal publish error occurs (KV write). PDF failure is non-fatal (logged).
 */
export async function publishLeadMagnet(input: { hvcoId: number }): Promise<PublishLeadMagnetResult | null> {
  const db = await getDb();
  if (!db) return null;

  const [hvco] = await db.select().from(hvcoTitles).where(eq(hvcoTitles.id, input.hvcoId)).limit(1);
  if (!hvco || hvco.assetBody == null) return null;

  const body = hvco.assetBody as unknown as LeadMagnetBody;

  // Brand slot for the deliverable + opt-in. The magnet is the coach's asset, so it
  // carries the coach's own logo when one exists — never a ZAP wordmark. Resolved
  // from the shared getCoachLogoUrl (coachAssets, assetType='logo'); null when the
  // coach has no logo, in which case the slot renders nothing (no ZAP stamp).
  const coachLogoUrl = await getCoachLogoUrl(hvco.userId);

  // Service name → readable slug base; testimonial1 → social-proof slot (used by
  // both the quiz page and the static opt-in bridge).
  let base = "magnet";
  let testimonial: { quote: string; name: string; title: string } | null = null;
  if (hvco.serviceId) {
    const [svc] = await db.select({
      name: services.name,
      tQuote: services.testimonial1Quote,
      tName: services.testimonial1Name,
      tTitle: services.testimonial1Title,
    }).from(services).where(eq(services.id, hvco.serviceId)).limit(1);
    if (svc?.name) base = slugify(svc.name);
    if (svc?.tQuote) testimonial = { quote: svc.tQuote, name: svc.tName ?? "", title: svc.tTitle ?? "" };
  }
  const deliverableSlug = `${base}-magnet-${input.hvcoId}`;
  const optInSlug = `${base}-get-${input.hvcoId}`;

  const { ensureKvNamespace, writeKvPage, renderPdfFromUrl } = await import("./lib/cloudflare");
  const namespaceId = await ensureKvNamespace();

  // ── QUIZ: ONE self-contained interactive page. Client-side scoring, email gate
  //    at the result. No separate opt-in page and no PDF (an interactive scorecard
  //    has no meaningful print snapshot). magnetHtmlUrl points at this single page,
  //    which is also the promoted/captured URL. Static formats keep their two-page
  //    + PDF path unchanged below. ──
  if (body.format === "quiz") {
    const quizUrl = `${BASE}/p/${deliverableSlug}`;
    const quizHtml = renderQuizPage({
      body,
      slug: deliverableSlug,
      hvcoId: input.hvcoId,
      privacyPolicyUrl: `${BASE}/privacy`,
      apiBase: BASE,
      pageUrl: quizUrl,
      testimonial,
      coachLogoUrl,
    });
    await writeKvPage(namespaceId, deliverableSlug, quizHtml);
    await db.update(hvcoTitles)
      .set({ magnetHtmlUrl: quizUrl, magnetPdfUrl: null })
      .where(eq(hvcoTitles.id, input.hvcoId));
    console.log(`[leadMagnetPublisher] published QUIZ hvco ${input.hvcoId}: ${quizUrl} (one page, no PDF)`);
    return { optInUrl: quizUrl, deliverableUrl: quizUrl, pdfUrl: "" };
  }

  // ── static formats (guide / checklist / toolkit): deliverable + opt-in + PDF ──
  const deliverableHtml = renderDeliverableHtml(body, { coachLogoUrl });
  if (!deliverableHtml) {
    console.log(`[leadMagnetPublisher] format "${(body as any)?.format}" not deliverable this sprint (hvco ${input.hvcoId}) — skipped`);
    return null;
  }

  // 1. deliverable page (source of truth) → KV
  await writeKvPage(namespaceId, deliverableSlug, deliverableHtml);
  const deliverableUrl = `${BASE}/p/${deliverableSlug}`;

  // 2. PDF from that exact page → Cloudinary. Non-fatal: the hosted page still
  //    delivers even if Browser Rendering hiccups.
  let pdfUrl = "";
  try {
    const pdf = await renderPdfFromUrl(deliverableUrl);
    const stored = await storagePut(`lead-magnets/${hvco.userId}/${input.hvcoId}.pdf`, pdf, "application/pdf");
    pdfUrl = stored.url;
  } catch (err) {
    console.warn(`[leadMagnetPublisher] PDF render failed for hvco ${input.hvcoId}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. opt-in page (capture + bridge) → KV
  const optInHtml = renderOptInHtml({
    title: body.title || hvco.title,
    format: body.format,
    promise: body.promise || "",
    slug: deliverableSlug,
    hvcoId: input.hvcoId,
    deliverableUrl,
    pdfUrl,
    privacyPolicyUrl: `${BASE}/privacy`,
    apiBase: BASE,
    nextStep: body.nextStep,
    testimonial,
    coachLogoUrl,
  });
  await writeKvPage(namespaceId, optInSlug, optInHtml);
  const optInUrl = `${BASE}/p/${optInSlug}`;

  // 4. persist deliverable + PDF URLs on the row (magnetHtmlUrl = the content).
  await db.update(hvcoTitles)
    .set({ magnetHtmlUrl: deliverableUrl, magnetPdfUrl: pdfUrl || null })
    .where(eq(hvcoTitles.id, input.hvcoId));

  console.log(`[leadMagnetPublisher] published hvco ${input.hvcoId}: optin=${optInUrl} deliverable=${deliverableUrl} pdf=${pdfUrl ? "yes" : "none"}`);
  return { optInUrl, deliverableUrl, pdfUrl };
}
