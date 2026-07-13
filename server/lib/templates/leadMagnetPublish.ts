/**
 * Shared lead-magnet publish helper. Used by BOTH publish paths —
 * landingPagePublisher (initial publish) AND complianceRewrites (re-render after a
 * rewrite) — so they select and render the Burchard template IDENTICALLY. If only one
 * path knew about it, a compliance rewrite would silently re-render the page with the
 * wrong template. Keep this the single source of truth for lead-magnet rendering.
 */
import { and, desc, eq } from "drizzle-orm";
import type { LandingPageContent } from "../../../drizzle/schema";
import { hvcoTitles } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { resolveProductCoverUrl } from "../images/imageSlots";
import { buildBurchardProductivityHtml } from "./burchardProductivity";

/** Additive publishedStyle enum value that selects the Burchard lead-magnet template. */
export const LEAD_MAGNET_BURCHARD_STYLE = "lead_magnet_burchard" as const;

type AssetRow = { assetType: string; url: string };

/**
 * Resolve the coach's slots + the campaign's lead-magnet name and render the Burchard
 * hero+bands+testimonials+cream template. `assetRows` are the coach-asset rows the caller
 * already fetched (assetType + url). Trust count stays null (non-numeric — never fabricated).
 */
export async function renderBurchardLeadMagnet(opts: {
  content: LandingPageContent;
  serviceName: string;
  coachName: string | null;
  assetRows: AssetRow[];
  serviceId: number | null;
}): Promise<string> {
  const { content, serviceName, coachName, assetRows, serviceId } = opts;

  const headshotUrl = assetRows.find((a) => a.assetType === "headshot")?.url ?? null;
  const logoUrl = assetRows.find((a) => a.assetType === "logo")?.url ?? null;
  const uploadedCoverUrl = assetRows.find((a) => a.assetType === "value_stack")?.url ?? null;

  // Lead-magnet name for the orange emphasis + CTA + card title: the newest "long"
  // title for this service (the magnet generated earlier in the same cascade). The
  // same row also carries magnetPdfUrl (set at cascade step 3, before this LP
  // publishes at step 6) — page 1 of that PDF is the coach's REAL magnet cover.
  let leadMagnetName: string | null = null;
  let magnetPdfUrl: string | null = null;
  const db = await getDb();
  if (db && serviceId != null) {
    const [row] = await db
      .select({ title: hvcoTitles.title, magnetPdfUrl: hvcoTitles.magnetPdfUrl })
      .from(hvcoTitles)
      .where(and(eq(hvcoTitles.serviceId, serviceId), eq(hvcoTitles.tabType, "long")))
      .orderBy(desc(hvcoTitles.createdAt))
      .limit(1);
    leadMagnetName = row?.title ?? null;
    magnetPdfUrl = row?.magnetPdfUrl ?? null;
  }

  // Fallback order: coach-uploaded value_stack → real PDF-derived cover → null
  // (graceful empty-state in the template — never a fabricated stand-in).
  const productCoverUrl = resolveProductCoverUrl(uploadedCoverUrl, magnetPdfUrl);

  return buildBurchardProductivityHtml(content, serviceName, {
    headshotUrl,
    productCoverUrl,
    logoUrl,
    coachName,
    leadMagnetName,
    trustCount: null,
  });
}
