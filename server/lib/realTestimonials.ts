/**
 * Real-testimonial injection — the 3-cap fix (2026-07-18).
 *
 * ROOT CAUSE: the cascade populates `content.testimonials` from `services.testimonial1/2/3` — three
 * literal columns, capped at 3. The `testimonials` LIBRARY table (unlimited per coach) was never
 * wired into landing-page rendering, so a coach with 8 real testimonials silently lost 5. This is a
 * bug, not an optimisation: every LP template that renders testimonials (Burchard, Discovery, Hormozi,
 * Sales, Webinar) was showing at most 3 of however many the coach actually has.
 *
 * FIX: at publish time (both publish paths), read the coach's FULL real testimonial library for this
 * service and replace `content.testimonials` with the complete set — VERBATIM, bypassing both the
 * 3-column bridge and any LLM regurgitation (no paraphrase, no token cost). Additive and isolated:
 * when the library is empty, content is returned unchanged (so nothing regresses for coaches who only
 * use the 3 service fields). The 3 columns stay exactly as-is for the ad / email / whatsapp generators
 * that legitimately want ~3. NEVER fabricates — real-or-nothing holds absolutely.
 */
import { and, eq, or, isNull, asc } from "drizzle-orm";
import { getDb } from "../db";
import { testimonials } from "../../drizzle/schema";
import type { LandingPageContent } from "../../drizzle/schema";

/** The shape LandingPageContent.testimonials uses. `location` carries the library `title` (subtitle). */
export type RealTestimonial = LandingPageContent["testimonials"][number];

/** Map one library row → the content.testimonials shape. `title` (e.g. "CEO, Acme") → `location`
 * (the subtitle every template renders under the name). No `headline` in the library → "". */
export function mapLibraryRow(r: { name: string; title: string | null; quote: string }): RealTestimonial {
  return { headline: "", quote: r.quote, name: r.name, location: r.title ?? "" };
}

/**
 * PURE. Replace content.testimonials with the FULL real library set when it has entries; otherwise
 * leave content untouched (keeps the generated ≤3 from the service fields, or empty). Unit-testable
 * without a DB — the "is this additive / does it ever fabricate" contract lives here.
 */
export function mergeRealTestimonials(content: LandingPageContent, real: RealTestimonial[]): LandingPageContent {
  const clean = (Array.isArray(real) ? real : []).filter((t) => typeof t?.quote === "string" && t.quote.trim().length > 0);
  if (clean.length === 0) return content; // library empty → no change (never removes existing real proof)
  return { ...content, testimonials: clean };
}

/**
 * Read the coach's REAL testimonial library for this service (service-scoped + global rows, coach-owned
 * only). Ordered oldest-first for stable output. Returns [] on any failure or missing DB, so a publish
 * never breaks over testimonials — worst case it falls back to the generated set.
 */
export async function getRealTestimonials(userId: number, serviceId: number | null): Promise<RealTestimonial[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({ name: testimonials.name, title: testimonials.title, quote: testimonials.quote })
      .from(testimonials)
      .where(
        and(
          eq(testimonials.userId, userId),
          serviceId == null
            ? isNull(testimonials.serviceId)
            : or(eq(testimonials.serviceId, serviceId), isNull(testimonials.serviceId)),
        ),
      )
      .orderBy(asc(testimonials.createdAt));
    return rows.filter((r) => r.quote && r.quote.trim().length > 0).map(mapLibraryRow);
  } catch {
    return [];
  }
}

/**
 * Publish-time convenience: read the real library and merge it into content. Called by BOTH publish
 * paths (landingPagePublisher + complianceRewrites) BEFORE the style discriminators run, so the
 * proof-based selection also sees the real count. No-op when the library is empty.
 */
export async function injectRealTestimonials(
  content: LandingPageContent,
  userId: number,
  serviceId: number | null,
): Promise<LandingPageContent> {
  const real = await getRealTestimonials(userId, serviceId);
  return mergeRealTestimonials(content, real);
}
