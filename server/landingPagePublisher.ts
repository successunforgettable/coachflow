/**
 * Landing page publish gen-core (Phase C C2, Sprint B+1 path d lineage,
 * 2026-05-11).
 *
 * Extracts the publish-to-Cloudflare-KV logic from
 * landingPagesRouter.publishToCloudflare so the Auto Mode orchestrator can
 * call it directly without an HTTP round-trip. Mirrors B1's runX pattern
 * + C1's adCreativesGenerator extraction:
 *
 *   - Typed input shape, typed output shape
 *   - No quota / tier check (handled upstream by Phase C C0 paid-tier gate
 *     on autoMode.orchestrate)
 *   - The router's `publishToCloudflare` mutation now wraps this gen-core,
 *     preserving its TRPCError code translations for the wizard path
 *
 * Auto Mode integration path (orchestration.ts landingPage step):
 *   1. runLandingPageGeneration produces landingPageId + 4 angles
 *   2. orchestrator calls runLandingPagePublish({landingPageId, styleMode:
 *      "visual"}) — Auto Mode default is visual style for paid-tier
 *   3. publish writes HTML to Cloudflare KV under `${slug}` key, updates
 *      LP row's publicSlug + publicUrl + publishedStyle
 *   4. orchestrator separately sets kit.selectedLandingPageAngle="original"
 *      so kit-page UI renders the published angle
 *
 * Error handling: throws on any failure. Caller in orchestration.ts wraps
 * in try/catch and treats publish failure as non-fatal (LP content is in
 * DB; user can re-publish via the wizard if Cloudflare hiccups). Router
 * caller surfaces as TRPCError.
 *
 * Published URL structure unchanged from the pre-extraction mutation:
 * `https://zapcampaigns.com/p/{slug}` where slug is
 * `{serviceName-lowercased-hyphenated}-{lpId}`.
 */
import { getDb } from "./db";
import { landingPages, services, users, coachAssets } from "../drizzle/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import type { LpStyleMode } from "./lib/templates/renderRegistry";

export type RunLandingPagePublishInput = {
  userId: number;
  landingPageId: number;
  // The canonical registry union — importing it (not re-listing the styles) means adding a
  // template never drifts this signature out of sync (webinar_rajsekar_coaching, etc.).
  styleMode: LpStyleMode;
  /**
   * The coach's own event facts, DECLARED by the caller rather than derived here.
   *
   * They live on `campaignKits.campaignFacts`, and the LP row carries `serviceId` but no `icpId` —
   * so deriving them would mean hopping serviceId → first ICP for that service → kit, and that
   * middle hop is a `.limit(1)` on a loose join: right with one ICP, silently wrong with several.
   * The same reasoning that put the magnet→page pointer on `hvcoTitles` instead of on the kit.
   *
   * Omitted by every existing caller, so the columns stay NULL and behaviour is unchanged.
   */
  eventFacts?: { date?: string | null; time?: string | null; timezone?: string | null } | null;
};

export type RunLandingPagePublishResult = {
  publicUrl: string;
  slug: string;
};

export async function runLandingPagePublish(
  input: RunLandingPagePublishInput,
): Promise<RunLandingPagePublishResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Load LP + verify ownership.
  const [lp] = await db
    .select()
    .from(landingPages)
    .where(and(
      eq(landingPages.id, input.landingPageId),
      eq(landingPages.userId, input.userId),
    ))
    .limit(1);
  if (!lp) {
    throw new Error(`Landing page ${input.landingPageId} not found for user ${input.userId}`);
  }

  // 2. Resolve service name (used in slug + HTML brand context).
  let serviceName = "Campaign";
  if (lp.serviceId) {
    const [svc] = await db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.id, lp.serviceId))
      .limit(1);
    if (svc) serviceName = svc.name;
  }

  // 3. Pick active angle's content. Defaults to originalAngle if
  // activeAngle is NULL — matches the LP generator's default output and
  // the orchestrator's Phase C C2 "set selectedLandingPageAngle='original'"
  // convention.
  const angleKey = lp.activeAngle || "original";
  const content =
    angleKey === "godfather" ? lp.godfatherAngle
    : angleKey === "free" ? lp.freeAngle
    : angleKey === "dollar" ? lp.dollarAngle
    : lp.originalAngle;
  if (!content) {
    throw new Error(
      `Landing page ${input.landingPageId} has no content for angle "${angleKey}" — generate the LP before publishing.`,
    );
  }

  // 3b. 3-CAP FIX: replace the generated ≤3 testimonials with the coach's FULL real library (verbatim,
  // never fabricated; no-op when the library is empty). Done BEFORE the discriminators so proof-based
  // selection sees the real count, and so EVERY testimonial-rendering template (Burchard/Discovery/
  // Hormozi/Sales/Webinar) shows all real proof, not just 3.
  const { injectRealTestimonials } = await import("./lib/realTestimonials");
  const enrichedContent = await injectRealTestimonials(content, input.userId, lp.serviceId);

  // 4. Coach profile + assets (used by visual style HTML builder).
  const [coachProfileRow] = await db
    .select({ coachName: users.coachName, coachBackground: users.coachBackground })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  const coachName = coachProfileRow?.coachName ?? null;
  const coachBackground = coachProfileRow?.coachBackground ?? null;
  // Fetch per-user assets (landingPageId IS NULL) + per-LP assets (landingPageId = this LP)
  const assetRows = await db
    .select({ assetType: coachAssets.assetType, url: coachAssets.url })
    .from(coachAssets)
    .where(and(
      eq(coachAssets.userId, input.userId),
      or(
        isNull(coachAssets.landingPageId),
        eq(coachAssets.landingPageId, input.landingPageId),
      ),
    ));

  // 5. Slug: re-use existing if already published, else generate stable.
  // ${serviceName-lowercased-hyphenated}-${lpId} is deterministic per LP
  // and survives slug regeneration. URL never changes for a given LP.
  const slug =
    lp.publicSlug ||
    (serviceName
      ? `${serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${lp.id}`
      : `campaign-${lp.id}`);

  // 6. Build HTML via the shared template registry — ONE dispatch that both this
  // path and the complianceRewrites re-render path call, so a template can never
  // be swapped by only one of them (the "family, not leaf" rule).
  const { ensureKvNamespace, writeKvPage, deployWorker } = await import("./lib/cloudflare");
  const { renderLandingPageHtml, resolveEventStyle, resolveSalesStyle, resolveWebinarStyle, styleForPageType } = await import("./lib/templates/renderRegistry");
  const { unansweredRequiredOperatorFields } = await import("./lib/templates/operatorFields");
  const pageType = (lp as any).pageType || "sales_page";
  // Base style is derived from the LP's pageType — the SAME per-reference template orchestration
  // auto-selects (styleForPageType) — so EVERY publish path renders the correct template and runs the
  // three-state discriminators/gate below. Without this the manual `publishToCloudflare` mutation (whose
  // styleMode input is the LEGACY text/visual/energetic enum, default "text") would publish a webinar or
  // event page as the old generic text template, bypassing the event/webinar gate entirely. Falls back
  // to the caller's styleMode only when the pageType has no registered per-reference template (legacy).
  const baseStyle = styleForPageType(pageType) ?? input.styleMode;
  // Publish-time style discriminators (each a no-op unless its default styleMode is in play, so the
  // chain is order-independent and safe on every publish). Decided here because this is where the LP
  // content — price + testimonials — is loaded; the resolved style drives BOTH the render and the
  // persisted publishedStyle so they never disagree.
  //  · Event free-vs-paid — a REAL operator price upgrades free Iman → paid Hormozi.
  //  · Sales/Webinar proof-gate — the proof-LIGHT default upgrades to the reference-faithful RICH page
  //    only when the coach has enough REAL testimonials (never fabricated; light stays until then).
  const styleMode = resolveWebinarStyle(
    resolveSalesStyle(resolveEventStyle(baseStyle, enrichedContent), enrichedContent),
    enrichedContent,
  ) as LpStyleMode;
  const html = await renderLandingPageHtml(styleMode, {
    content: enrichedContent,
    serviceName,
    coachName,
    coachBackground,
    assetRows,
    serviceId: lp.serviceId,
    userId: input.userId,
    pageType,
  });

  // 6a. Three-state operator-field gate (2026-07-18): HOLD when a REQUIRED operator field is in genuine
  // silence, so absence never routes to a published page. Currently the one field the dumb token scan
  // can't catch — EVENT PRICE: free (__FREE__) and unanswered both render on Iman which carries no price
  // token, so without this an unanswered-but-actually-PAID event would silently ship as a free page.
  // The N/A sentinels (__FREE__ etc.) read as "answered" here, so an explicitly-free event is NOT held.
  const heldFields = unansweredRequiredOperatorFields(pageType, enrichedContent);
  if (heldFields.length > 0) {
    throw new Error(
      `Landing page needs ${heldFields.length} operator answer${heldFields.length === 1 ? "" : "s"} before it can go live: ${heldFields.join(", ")}.`
    );
  }

  // 6b. B5 hard publish gate: block publish if unfilled placeholders remain.
  const unfilledTokens = html.match(/\[INSERT_[A-Z_0-9]+\]/g);
  if (unfilledTokens && unfilledTokens.length > 0) {
    const unique = Array.from(new Set(unfilledTokens));
    throw new Error(
      `Landing page has ${unique.length} unfilled placeholder${unique.length === 1 ? "" : "s"}: ${unique.slice(0, 5).join(", ")}${unique.length > 5 ? ` and ${unique.length - 5} more` : ""}. Fill them in the Campaign Kit before publishing.`
    );
  }

  // 6c. OUTPUT GATE — compliance axis on the RESOLVED page, alongside the operator-field
  // and placeholder gates above. Content-agnostic, so it holds a coach's hand-edit too.
  // Short fields are checked as short: the eyebrow and headline are where the register
  // standard has least room and where live runs produced the sharpest §1.1 constructions.
  {
    const { checkOutput } = await import("./_core/complianceAxis");
    const c = enrichedContent as Record<string, unknown>;
    const gate = checkOutput(([
      ["eyebrowHeadline", "short"], ["mainHeadline", "short"], ["subheadline", "short"],
      ["problemAgitation", "body"], ["solutionIntro", "body"], ["whyOldFail", "body"],
      ["uniqueMechanism", "body"], ["insiderAdvantages", "body"], ["shockingStat", "body"],
      ["timeSavingBenefit", "body"], ["primaryCta", "cta"],
    ] as const).map(([k, role]) => ({ location: k, text: c[k] as string | undefined, role })));
    if (!gate.ok) {
      const detail = gate.blocking.slice(0, 3).map((h) => `${h.location}: "${h.matched}"`).join("; ");
      throw new Error(
        `Landing page not published — it states things about the reader that Meta's policy does not allow: ${detail}. ` +
        `Rewrite those lines to describe the situation from your side and what the programme does, then publish again.`,
      );
    }
  }

  // 7. Cloudflare KV write + worker deploy. Both calls can throw on
  // transient errors (network, Cloudflare API quota, KV unavailable);
  // caller decides whether to retry or treat as non-fatal.
  const namespaceId = await ensureKvNamespace();
  await writeKvPage(namespaceId, slug, html);
  await deployWorker(namespaceId);

  const publicUrl = `https://zapcampaigns.com/p/${slug}`;

  // 8. Persist publish state on the LP row.
  //
  // `renderedBuild` records WHICH BUILD baked this HTML (0106). The markup is frozen in KV from
  // here until something republishes it, while the renderer keeps moving — without the stamp that
  // gap is invisible, which is how a republish came to carry 10582b9's markdown rewrite alongside
  // the one-line change it was actually testing. NULL when no build identifier is available, which
  // is the honest value rather than a guess — see `_core/buildStamp.ts`.
  //
  // The event facts are recorded rather than only substituted into the markup, so anything that
  // has to READ the date later — the deferred expiry decision above all — is not reduced to
  // grepping HTML. Stored as the coach supplied them; normalising is the expiry decision's job.
  const { currentBuildSha } = await import("./_core/buildStamp");
  const es = input.eventFacts ?? {};
  await db
    .update(landingPages)
    .set({
      publicSlug: slug, publicUrl, publishedStyle: styleMode,
      renderedBuild: currentBuildSha(),
      ...(es.date ? { eventDate: String(es.date).slice(0, 64) } : {}),
      ...(es.time ? { eventTime: String(es.time).slice(0, 64) } : {}),
      ...(es.timezone ? { eventTimezone: String(es.timezone).slice(0, 64) } : {}),
    })
    .where(eq(landingPages.id, lp.id));

  return { publicUrl, slug };
}
