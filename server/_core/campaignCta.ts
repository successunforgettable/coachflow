/**
 * Campaign-type → CTA — single source of truth.
 *
 * Extracted from the inline map in orchestration.ts (adCopy case) so the ad
 * copy AND the ad-creative CTA pill read the SAME short imperative label per
 * campaign type. Keyed on the 7-value campaignType enum (drizzle/schema.ts).
 * Not hardcoded per creative: the render template resolves the label from the
 * campaign's campaignType at composite time.
 */
import { campaigns } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type CampaignType =
  | "webinar"
  | "challenge"
  | "course_launch"
  | "product_launch"
  | "discovery_call"
  | "lead_magnet"
  | "in_person_event";

export const CAMPAIGN_TO_CTA: Record<CampaignType, string> = {
  discovery_call: "Book a Free Call",
  webinar: "Save My Seat",
  challenge: "Join the Challenge",
  lead_magnet: "Download Now",
  course_launch: "Enroll Now",
  product_launch: "Get Instant Access",
  in_person_event: "Reserve My Spot",
};

/** Default matches the pre-existing orchestration.ts fallback. */
export const DEFAULT_CTA = "Book a Free Call";

/** Pure lookup — used wherever campaignType is already in hand. */
export function ctaForCampaignType(type: string | null | undefined): string {
  return (type && CAMPAIGN_TO_CTA[type as CampaignType]) || DEFAULT_CTA;
}

/**
 * Resolve the CTA label for an ad-creative render. Prefers an in-hand
 * campaignType; otherwise looks the type up from the creative's campaignId.
 * Falls back to DEFAULT_CTA so a pill always renders.
 */
export async function resolveCampaignCta(
  db: any,
  opts: { campaignType?: string | null; campaignId?: number | null },
): Promise<string> {
  if (opts.campaignType) return ctaForCampaignType(opts.campaignType);
  if (opts.campaignId != null) {
    try {
      const [row] = await db
        .select({ campaignType: campaigns.campaignType })
        .from(campaigns)
        .where(eq(campaigns.id, opts.campaignId))
        .limit(1);
      if (row?.campaignType) return ctaForCampaignType(row.campaignType);
    } catch {
      /* fall through to default */
    }
  }
  return DEFAULT_CTA;
}
