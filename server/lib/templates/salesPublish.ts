/**
 * Shared sales publish helper — the sales analogue of leadMagnetPublish.ts / discoveryPublish.ts /
 * webinarPublish.ts / eventPublish.ts. Used by BOTH publish paths (landingPagePublisher +
 * complianceRewrites) via the template registry, so an initial publish and a compliance re-render
 * select + render the sales template identically.
 *
 * Resolves: the coach's image slots (headshot / hero image / logo); the coach's REAL video URL
 * (guarded reader → poster fallback, never a fabricated player); and the coach's REAL external
 * checkout URL (guarded reader — column pending migration 0088 → null falls back to on-page email
 * capture, never a dead button). No fabrication of Ali's charts, counts, price, or stats.
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import { getCoachVideoUrl } from "../coachVideoUrl";
import { getCoachCheckoutUrl } from "../coachCheckoutUrl";
import { slotImageUrl } from "../images/imageSlots";
import { buildSalesAliAbdaalHtml } from "./salesAliAbdaal";

/** Additive publishedStyle enum value that selects the sales template. */
export const SALES_ALI_ABDAAL_STYLE = "sales_ali_abdaal" as const;

type AssetRow = { assetType: string; url: string };

export async function renderSalesAliAbdaal(opts: {
  content: LandingPageContent;
  serviceName: string;
  coachName: string | null;
  coachBackground: string | null;
  assetRows: AssetRow[];
  userId: number;
}): Promise<string> {
  const { content, serviceName, coachName, coachBackground, assetRows, userId } = opts;

  const rawHeadshot = assetRows.find((a) => a.assetType === "headshot")?.url ?? null;
  const rawHero = assetRows.find((a) => a.assetType === "hero_image")?.url ?? null;
  const logoUrl = assetRows.find((a) => a.assetType === "logo")?.url ?? null;

  // REAL video only (guarded reader). Null → headshot poster (no fake play), else omit.
  const videoUrl = await getCoachVideoUrl(userId);
  // REAL checkout URL only (guarded reader — column pending 0088). Null → on-page email capture.
  const checkoutUrl = await getCoachCheckoutUrl(userId);

  return buildSalesAliAbdaalHtml(content, serviceName, {
    headshotUrl: rawHeadshot ? slotImageUrl(rawHeadshot, "headshot") : null,
    heroImageUrl: rawHero ? slotImageUrl(rawHero, "hero_image") : null,
    logoUrl,
    coachName,
    coachBackground,
    videoUrl,
    checkoutUrl,
  });
}
