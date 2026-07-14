/**
 * Shared webinar publish helper — the webinar analogue of leadMagnetPublish.ts /
 * discoveryPublish.ts. Used by BOTH publish paths (landingPagePublisher + complianceRewrites)
 * via the template registry, so an initial publish and a compliance re-render select + render
 * the webinar template identically.
 *
 * Resolves: the coach's image slots (headshot / hero image / logo); the coach's REAL video URL
 * (guarded reader — null → headshot poster, never a fabricated player); and the "Is This You"
 * pain cards, which bind to the coach's EXISTING long ICP (pains / frustrations / objections) —
 * NOT a fresh generation call — so the cards and every other ICP-driven asset stay one source.
 *
 * When the coach has set no event date, the card emits [INSERT_EVENT_*] tokens → the publish
 * placeholder hard-gate blocks the page → it stays a review-draft (never a live webinar page
 * with a missing date). Video absence does NOT block publish (graceful headshot fallback).
 */
import { eq } from "drizzle-orm";
import type { LandingPageContent } from "../../../drizzle/schema";
import { idealCustomerProfiles } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { getCoachVideoUrl } from "../coachVideoUrl";
import { slotImageUrl } from "../images/imageSlots";
import { buildWebinarRajsekarHtml } from "./webinarRajsekar";

/** Additive publishedStyle enum value that selects the webinar template. */
export const WEBINAR_RAJSEKAR_STYLE = "webinar_rajsekar_coaching" as const;

type AssetRow = { assetType: string; url: string };

/** First real sentence (or a clean ~180-char slice) of a long ICP field — card-sized, not fabricated. */
function conciseIcp(raw: unknown): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const dot = s.search(/[.!?]\s/);
  if (dot > 40 && dot < 200) return s.slice(0, dot + 1);
  return s.length > 180 ? s.slice(0, 177).trimEnd() + "…" : s;
}

/**
 * Build up to 3 "Is This You" pain cards from the coach's existing long ICP — pains,
 * frustrations, objections (the fields the LP generator already reads). Real-or-nothing:
 * only non-empty fields become cards; none → the template omits the section.
 */
async function isThisYouFromIcp(serviceId: number | null): Promise<Array<{ label: string; body: string }>> {
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
    const candidates: Array<{ label: string; body: string }> = [
      { label: "The daily struggle", body: conciseIcp(icp.pains) },
      { label: "The frustration", body: conciseIcp(icp.frustrations) },
      { label: "The doubt", body: conciseIcp(icp.objections) },
    ];
    return candidates.filter((c) => c.body.length > 0).slice(0, 3);
  } catch {
    return [];
  }
}

export async function renderWebinarRajsekar(opts: {
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
  const headshotUrl = rawHeadshot ? slotImageUrl(rawHeadshot, "headshot") : null;
  const heroImageUrl = rawHero ? slotImageUrl(rawHero, "hero_image") : null;
  const logoUrl = assetRows.find((a) => a.assetType === "logo")?.url ?? null;

  // REAL video only (guarded reader — column pending migration 0087). Null → headshot poster.
  const videoUrl = await getCoachVideoUrl(userId);

  // "Is This You" cards from the existing long ICP — not a fresh generation call.
  const isThisYou = await isThisYouFromIcp(serviceId);

  return buildWebinarRajsekarHtml(content, serviceName, {
    headshotUrl,
    heroImageUrl,
    logoUrl,
    coachName,
    coachBackground,
    videoUrl,
    isThisYou,
    trustCount: null,
  });
}
