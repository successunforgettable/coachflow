/**
 * Shared discovery publish helper — the discovery analogue of leadMagnetPublish.ts.
 * Used by BOTH publish paths (landingPagePublisher + complianceRewrites) via the template
 * registry, so an initial publish and a compliance re-render select + render the discovery
 * template identically.
 *
 * Resolves the coach's image slots + the per-coach booking URL, then renders the Burchard
 * design-language discovery page. When the coach has no booking URL, the CTA emits the
 * [INSERT_BOOKING_URL] token → the publish placeholder hard-gate blocks the page, so a
 * discovery page never goes live with a dead "Book a Call" button (review-draft-when-absent).
 */
import type { LandingPageContent } from "../../../drizzle/schema";
import { getCoachBookingUrl } from "../coachBookingUrl";
import { buildDiscoveryBurchardHtml } from "./discoveryBurchard";

/** Additive publishedStyle enum value that selects the discovery template. */
export const DISCOVERY_BURCHARD_STYLE = "discovery_burchard_performance" as const;

type AssetRow = { assetType: string; url: string };

export async function renderDiscoveryBurchard(opts: {
  content: LandingPageContent;
  serviceName: string;
  coachName: string | null;
  assetRows: AssetRow[];
  userId: number;
}): Promise<string> {
  const { content, serviceName, coachName, assetRows, userId } = opts;

  const headshotUrl = assetRows.find((a) => a.assetType === "headshot")?.url ?? null;
  const logoUrl = assetRows.find((a) => a.assetType === "logo")?.url ?? null;

  // Per-coach booking URL (single source — also fills email/whatsapp). Null → CTA emits the
  // [INSERT_BOOKING_URL] token → publish hard-gate blocks → stays a review-draft.
  const bookingUrl = await getCoachBookingUrl(userId);

  return buildDiscoveryBurchardHtml(content, serviceName, {
    headshotUrl,
    logoUrl,
    coachName,
    bookingUrl,
    trustCount: null,
  });
}
