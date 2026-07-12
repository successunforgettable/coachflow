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

export type RunLandingPagePublishInput = {
  userId: number;
  landingPageId: number;
  styleMode: "text" | "visual" | "executive" | "energetic" | "clinical" | "warm" | "bold" | "lead_magnet_burchard";
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
  const headshotUrl = assetRows.find(a => a.assetType === "headshot")?.url ?? null;
  const logoUrl = assetRows.find(a => a.assetType === "logo")?.url ?? null;
  const heroImageUrl = assetRows.find(a => a.assetType === "hero_image")?.url ?? null;
  const socialProofUrls = assetRows.filter(a => a.assetType === "social_proof").map(a => a.url);
  const pressLogoUrls = assetRows.filter(a => a.assetType === "press_logo").map(a => a.url);

  // 5. Slug: re-use existing if already published, else generate stable.
  // ${serviceName-lowercased-hyphenated}-${lpId} is deterministic per LP
  // and survives slug regeneration. URL never changes for a given LP.
  const slug =
    lp.publicSlug ||
    (serviceName
      ? `${serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${lp.id}`
      : `campaign-${lp.id}`);

  // 6. Build HTML for the picked angle + style mode.
  const { ensureKvNamespace, writeKvPage, deployWorker } = await import("./lib/cloudflare");

  let html: string;
  const templateStyleIds = ["executive", "energetic", "clinical", "warm", "bold"] as const;
  if (input.styleMode === "lead_magnet_burchard") {
    // Bespoke lead-magnet template (route-by-pageType, set by orchestration). Shared
    // helper keeps this identical to the complianceRewrites re-render path.
    const { renderBurchardLeadMagnet } = await import("./lib/templates/leadMagnetPublish");
    html = await renderBurchardLeadMagnet({ content, serviceName, coachName, assetRows, serviceId: lp.serviceId });
  } else if (templateStyleIds.includes(input.styleMode as any)) {
    const { renderTemplate } = await import("./lib/templates/renderTemplate");
    const { getTemplate } = await import("./lib/templates/registry");
    const template = getTemplate(input.styleMode as typeof templateStyleIds[number]);
    const lpPageType = (lp as any).pageType || "sales_page";
    html = renderTemplate(content, template, {
      headshotUrl,
      logoUrl,
      heroImageUrl,
      socialProofUrls,
      pressLogoUrls,
      coachName,
      coachBackground,
    }, lpPageType);
  } else {
    // Legacy path for "text" / "visual" — existing published pages
    const { buildTextStyleHtml, buildVisualStyleHtml } = await import("./lib/landingPageHtml");
    html = input.styleMode === "visual"
      ? buildVisualStyleHtml(content, serviceName, {
          headshotUrl,
          logoUrl,
          socialProofUrls,
          coachName,
          coachBackground,
        })
      : buildTextStyleHtml(content, serviceName);
  }

  // 6b. B5 hard publish gate: block publish if unfilled placeholders remain.
  const unfilledTokens = html.match(/\[INSERT_[A-Z_0-9]+\]/g);
  if (unfilledTokens && unfilledTokens.length > 0) {
    const unique = Array.from(new Set(unfilledTokens));
    throw new Error(
      `Landing page has ${unique.length} unfilled placeholder${unique.length === 1 ? "" : "s"}: ${unique.slice(0, 5).join(", ")}${unique.length > 5 ? ` and ${unique.length - 5} more` : ""}. Fill them in the Campaign Kit before publishing.`
    );
  }

  // 7. Cloudflare KV write + worker deploy. Both calls can throw on
  // transient errors (network, Cloudflare API quota, KV unavailable);
  // caller decides whether to retry or treat as non-fatal.
  const namespaceId = await ensureKvNamespace();
  await writeKvPage(namespaceId, slug, html);
  await deployWorker(namespaceId);

  const publicUrl = `https://zapcampaigns.com/p/${slug}`;

  // 8. Persist publish state on the LP row.
  await db
    .update(landingPages)
    .set({ publicSlug: slug, publicUrl, publishedStyle: input.styleMode })
    .where(eq(landingPages.id, lp.id));

  return { publicUrl, slug };
}
