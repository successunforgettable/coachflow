/**
 * Real-testimonial injection + proof partition — the 3-cap fix and the coach-vs-offer proof model.
 *
 * TWO BUGS this addresses:
 *  1. THE 3-CAP: `content.testimonials` was populated only from `services.testimonial1/2/3` (three
 *     literal columns, capped at 3); the unlimited `testimonials` LIBRARY table was never wired into
 *     LP rendering. A coach with 8 real testimonials silently lost 5.
 *  2. THE OTHER-PROGRAMS BUG (2026-07-17): the earlier fix read `serviceId = S OR serviceId IS NULL`,
 *     so testimonials scoped to the coach's OTHER programs never flowed. An established coach with 40
 *     testimonials across programs #1–3 launching #4 saw ZERO of them — the coach with the most proof
 *     got the least. Fix: read COACH-WIDE (every testimonial the coach owns).
 *
 * THE MODEL (scope-derived, no migration). On a page for service S:
 *   · OFFER proof  = library rows with `serviceId === S`  → the results wall (about THIS program).
 *   · COACH proof  = every other row the coach owns (`serviceId` NULL or another service) → the
 *                    authority surface near the bio ("what clients say about working with [Coach]").
 * Each testimonial lands in exactly ONE bucket → no quote appears twice on a page (de-dup by
 * construction, same discipline as the sales allocator). NEVER fabricates — real-or-nothing absolute.
 * The 3 service columns stay untouched for the ad/email/whatsapp generators that legitimately want ~3.
 *
 * FOLLOW-UP (deferred): an explicit `kind enum('offer','coach')` column for curation (a book review or
 * "great mentor" quote a coach wants pinned as coach-proof regardless of scope). Not built — scope
 * derivation covers the launch case; curation UI doesn't exist yet.
 */
import { eq, asc } from "drizzle-orm";
import { getDb } from "../db";
import { testimonials } from "../../drizzle/schema";
import type { LandingPageContent } from "../../drizzle/schema";

/** The shape LandingPageContent.testimonials / .coachTestimonials use. `location` carries `title`. */
export type RealTestimonial = NonNullable<LandingPageContent["testimonials"]>[number];
/**
 * A raw library row. Carries `serviceId` to partition, and `scope`/`source` (migration 0110) to
 * decide whether the row may be DISPLAYED at all.
 *
 * Both are nullable because every row predating 0110 has neither. NULL is NOT a permission.
 */
export type TestimonialScope = "service_specific" | "coach_portable";
export type TestimonialSource = "coach_supplied" | "seeded_demo" | "imported";
export type LibraryRow = {
  serviceId: number | null;
  name: string;
  title: string | null;
  quote: string;
  scope?: TestimonialScope | null;
  source?: TestimonialSource | null;
};

/** Map one library row → the content testimonial shape. `title` → `location` (the rendered subtitle). */
export function mapLibraryRow(r: { name: string; title: string | null; quote: string }): RealTestimonial {
  return { headline: "", quote: r.quote, name: r.name, location: r.title ?? "" };
}

/**
 * PURE. Partition library rows into OFFER proof and COACH proof, dropping blank quotes and dropping
 * anything the coach has not affirmatively marked as displayable.
 *
 * ── WHY THE `else` WENT AWAY (2026-09-03) ─────────────────────────────────────────────────────
 * The previous shape was:
 *
 *     if (serviceId != null && r.serviceId === serviceId) offer.push(...);
 *     else coach.push(...);                       // ← unconditional
 *
 * That `else` PROMOTED every row that was not this service's into "the coach's own portable
 * proof". `serviceId IS NULL` means UNSCOPED, not ENDORSED-FOR-ANY-PAGE, and the code read the
 * first as the second. Ten seeded demo rows sitting in one production library therefore rendered
 * on EIGHTEEN live public pages — carrying invented percentage claims ("our lead quality jumped
 * 40%") under a real coach's name, across webinar, sales, event, discovery and lead-magnet
 * templates alike, because this runs in the shared publisher before any template is chosen.
 *
 * ── THE RULE NOW ─────────────────────────────────────────────────────────────────────────────
 * Display is OPT-IN and requires TWO affirmative facts, both captured at write time:
 *   · `source === "coach_supplied"` — the coach gave us this, it is not demo or unvetted import
 *   · `scope`  — where the coach said it may appear
 *
 * Anything else — NULL, "seeded_demo", "imported", unknown — is DROPPED. It appears on no page.
 *
 * 🔴 THIS FAILS CLOSED, DELIBERATELY, AND IT IS THE POINT. Every row predating 0110 has NULL for
 * both, so every existing library row becomes invisible until a human tags it. Arfeen accepted
 * that explicitly, including for the Tony Robbins quote and for other users' rows. A missing
 * testimonial costs a little credibility; an invented one on a public page under a coach's name
 * is what took eighteen pages down. Absence of a tag is not permission (see CLAUDE.md §15m).
 */
export function partitionProof(rows: LibraryRow[], serviceId: number | null): { offer: RealTestimonial[]; coach: RealTestimonial[] } {
  const clean = (Array.isArray(rows) ? rows : []).filter((r) => typeof r?.quote === "string" && r.quote.trim().length > 0);
  const offer: RealTestimonial[] = [];
  const coach: RealTestimonial[] = [];
  for (const r of clean) {
    // Gate 1 — provenance. Only material the coach affirmatively supplied may ever render.
    if (r.source !== "coach_supplied") continue;
    // Gate 2 — placement. The coach says where it belongs; we never infer it from absence.
    if (serviceId != null && r.serviceId === serviceId && r.scope === "service_specific") {
      offer.push(mapLibraryRow(r));
    } else if (r.scope === "coach_portable") {
      coach.push(mapLibraryRow(r));
    }
    // else: dropped. An untagged row of unknown origin renders nowhere.
  }
  return { offer, coach };
}

/**
 * PURE. Apply the partition to content: `testimonials` = offer, `coachTestimonials` = coach. When the
 * library has NO real rows at all, content is returned UNCHANGED (keeps the generated ≤3 from the
 * service fields as offer proof; never removes existing real proof). Never fabricates.
 */
export function mergeProof(content: LandingPageContent, part: { offer: RealTestimonial[]; coach: RealTestimonial[] }): LandingPageContent {
  if (part.offer.length === 0 && part.coach.length === 0) return content;
  return { ...content, testimonials: part.offer, coachTestimonials: part.coach };
}

/** Read EVERY testimonial the coach owns (coach-wide — the bug fix). Ordered oldest-first, stable. */
export async function getAllCoachTestimonials(userId: number): Promise<LibraryRow[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      // scope/source are SELECTED because partitionProof gates on them. Omitting them here would
      // make every row undisplayable — the gate would be reading undefined, not a decision.
      .select({
        serviceId: testimonials.serviceId, name: testimonials.name, title: testimonials.title,
        quote: testimonials.quote, scope: testimonials.scope, source: testimonials.source,
      })
      .from(testimonials)
      .where(eq(testimonials.userId, userId))
      .orderBy(asc(testimonials.createdAt));
  } catch {
    return [];
  }
}

/**
 * Publish-time convenience: read the coach's whole library, partition offer/coach for this service, and
 * merge into content. Called by BOTH publish paths BEFORE the discriminators (which now count offer +
 * coach). No-op when the library is empty.
 */
export async function injectRealTestimonials(
  content: LandingPageContent,
  userId: number,
  serviceId: number | null,
): Promise<LandingPageContent> {
  const rows = await getAllCoachTestimonials(userId);
  if (rows.length === 0) return content;
  return mergeProof(content, partitionProof(rows, serviceId));
}
