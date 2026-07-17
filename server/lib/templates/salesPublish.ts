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
import { buildSalesLightHtml } from "./salesLight";

/** Additive publishedStyle enum values that select the sales templates (rich + proof-light). */
export const SALES_ALI_ABDAAL_STYLE = "sales_ali_abdaal" as const;
export const SALES_LIGHT_STYLE = "sales_ali_abdaal_light" as const;

type AssetRow = { assetType: string; url: string };

interface SalesRenderOpts {
  content: LandingPageContent;
  serviceName: string;
  coachName: string | null;
  coachBackground: string | null;
  assetRows: AssetRow[];
  userId: number;
}

/** Shared coach-input resolution — identical slot / video / checkout resolution for both variants. */
async function resolveSalesCoach(opts: SalesRenderOpts) {
  const { coachName, coachBackground, assetRows, userId } = opts;
  const rawHeadshot = assetRows.find((a) => a.assetType === "headshot")?.url ?? null;
  const rawHero = assetRows.find((a) => a.assetType === "hero_image")?.url ?? null;
  const logoUrl = assetRows.find((a) => a.assetType === "logo")?.url ?? null;
  // REAL video only (guarded reader). Null → headshot poster (no fake play), else omit.
  const videoUrl = await getCoachVideoUrl(userId);
  // REAL checkout URL only (guarded reader). Null → on-page email capture.
  const checkoutUrl = await getCoachCheckoutUrl(userId);
  return {
    headshotUrl: rawHeadshot ? slotImageUrl(rawHeadshot, "headshot") : null,
    heroImageUrl: rawHero ? slotImageUrl(rawHero, "hero_image") : null,
    logoUrl,
    coachName,
    coachBackground,
    videoUrl,
    checkoutUrl,
  };
}

/** RICH sales variant (reference-faithful; selected only when proof clears the threshold). */
export async function renderSalesAliAbdaal(opts: SalesRenderOpts): Promise<string> {
  const coach = await resolveSalesCoach(opts);
  return buildSalesAliAbdaalHtml(opts.content, opts.serviceName, coach);
}

/** Proof-LIGHT sales variant (the default; offer/method-forward). Same coach resolution as the rich. */
export async function renderSalesLight(opts: SalesRenderOpts): Promise<string> {
  const coach = await resolveSalesCoach(opts);
  return buildSalesLightHtml(opts.content, opts.serviceName, coach);
}
