/**
 * Shared event publish helper — the event analogue of leadMagnetPublish.ts / discoveryPublish.ts /
 * webinarPublish.ts. Used by BOTH publish paths (landingPagePublisher + complianceRewrites) via the
 * template registry, so an initial publish and a compliance re-render select + render the event
 * template identically.
 *
 * Two bespoke references, two resolvers:
 *   - Iman (free-ticket challenge): resolves the coach's headshot (the presenter — the page's
 *     authority anchor) + optional audience-wall hero image. No video, no ICP, no price.
 *   - Hormozi (paid workshop): resolves headshot/hero slots, the coach's REAL video URL (guarded
 *     reader → poster fallback, never a fabricated player), and an ICP-derived "who this is for"
 *     for the qualification section (real-or-nothing; NEVER Hormozi's revenue thresholds).
 *
 * Which of the two renders is decided upstream by `resolveEventStyle` (price-presence) in the
 * registry; this module just resolves each template's inputs.
 */
import { eq } from "drizzle-orm";
import type { LandingPageContent } from "../../../drizzle/schema";
import { idealCustomerProfiles } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { getCoachVideoUrl } from "../coachVideoUrl";
import { slotImageUrl, resolvePresenterCutoutUrl } from "../images/imageSlots";
import { buildEventImanGadzhiHtml } from "./eventImanGadzhi";
import { buildEventHormoziHtml } from "./eventHormozi";

/** Additive publishedStyle enum values that select the event templates. */
export const EVENT_IMAN_STYLE = "event_iman_gadzhi" as const;
export const EVENT_HORMOZI_STYLE = "event_hormozi" as const;

type AssetRow = { assetType: string; url: string };

/** First real sentence (or a clean ~150-char slice) of a long ICP field — line-sized, not fabricated. */
function conciseIcp(raw: unknown): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const dot = s.search(/[.!?]\s/);
  if (dot > 30 && dot < 160) return s.slice(0, dot + 1);
  return s.length > 150 ? s.slice(0, 147).trimEnd() + "…" : s;
}

/**
 * ICP-derived "who this is for" lines for Hormozi's qualification section — bound to the coach's
 * EXISTING long ICP (pains / frustrations), never freshly generated and never containing a revenue
 * threshold. Real-or-nothing: empty fields → no lines → the section omits.
 */
async function whoForFromIcp(serviceId: number | null): Promise<string[]> {
  const db = await getDb();
  if (!db || serviceId == null) return [];
  try {
    const [icp] = await db
      .select({
        pains: idealCustomerProfiles.pains,
        frustrations: idealCustomerProfiles.frustrations,
        objections: idealCustomerProfiles.objections,
      })
      .from(idealCustomerProfiles)
      .where(eq(idealCustomerProfiles.serviceId, serviceId))
      .limit(1);
    if (!icp) return [];
    return [conciseIcp(icp.pains), conciseIcp(icp.frustrations), conciseIcp(icp.objections)]
      .filter((s) => s.length > 0)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function renderEventImanGadzhi(opts: {
  content: LandingPageContent;
  serviceName: string;
  coachName: string | null;
  assetRows: AssetRow[];
}): Promise<string> {
  const { content, serviceName, coachName, assetRows } = opts;
  const rawHeadshot = assetRows.find((a) => a.assetType === "headshot")?.url ?? null;
  const rawHero = assetRows.find((a) => a.assetType === "hero_image")?.url ?? null;
  // The presenter IS the page — render it as a background-removed CUTOUT (HEAD-verified, same
  // discipline as the magnet cover) so the open-arm figure stands free over the audience wall,
  // matching the reference. Null when removal is unavailable/failed → the hero emits
  // [INSERT_PRESENTER_PHOTO] → publish hard-gate → review-draft (never a framed rectangle).
  const presenterCutout = await resolvePresenterCutoutUrl(rawHeadshot);
  return buildEventImanGadzhiHtml(content, serviceName, {
    headshotUrl: presenterCutout,
    heroImageUrl: rawHero ? slotImageUrl(rawHero, "hero_image") : null,
    coachName,
  });
}

export async function renderEventHormozi(opts: {
  content: LandingPageContent;
  serviceName: string;
  coachName: string | null;
  coachBackground: string | null;
  assetRows: AssetRow[];
  serviceId: number | null;
  userId: number;
}): Promise<string> {
  const { content, serviceName, coachName, coachBackground, assetRows, serviceId, userId } = opts;
  const rawHeadshot = assetRows.find((a) => a.assetType === "headshot")?.url ?? null;
  const rawHero = assetRows.find((a) => a.assetType === "hero_image")?.url ?? null;

  // REAL video only (guarded reader). Null → headshot poster (no fake play), else omit.
  const videoUrl = await getCoachVideoUrl(userId);
  // ICP-derived qualification lines — never a fresh generation call, never revenue thresholds.
  const whoFor = await whoForFromIcp(serviceId);

  return buildEventHormoziHtml(content, serviceName, {
    headshotUrl: rawHeadshot ? slotImageUrl(rawHeadshot, "headshot") : null,
    heroImageUrl: rawHero ? slotImageUrl(rawHero, "hero_image") : null,
    coachName,
    coachBackground,
    videoUrl,
    whoFor,
  });
}
