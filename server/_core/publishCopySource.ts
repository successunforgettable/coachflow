/**
 * publishCopySource.ts — where a published ad's headline and body come from.
 *
 * ⚠️ THIS MODULE EXISTS TO CLOSE THE GAP TRACED ON 2026-08-09: the gated copy engine's
 * output reached NOTHING live. On the V2 publish path the Meta headline field was
 * `selectedCreative.headline` — a side-generation inside the image engine, carrying no
 * P.D.A.F. axes and never passing the distinctness gate — and the primary text was
 * `deriveDefaultBody`, i.e. the LANDING PAGE's subheadline. Of Meta's three fused surfaces
 * only the baked image hook was gated.
 *
 * Two things make that worse than "untidy":
 *
 *   1. The control publish on 2026-08-09 was BLOCKED by our own compliance gate
 *      (`meta.ts:316`, `second_person_protected_attribute`) on that landing-page body. Page
 *      copy is written for a page and never screened as AD copy, so the live path can hard
 *      fail at the final step on text nobody ever checked for this use. Gated rows are
 *      screened at generation, which is why this module requires that screening.
 *   2. Distinctness is meaningless if the distinct pool is not what ships.
 *
 * SELECTION IS DELIBERATELY SIMPLE HERE. Pairing headline and body BY CONCEPT is step 4 and
 * needs `conceptId` stamped on adCopy first; until then this returns the strongest
 * candidates and the full lists, so the operator picks. What it will NOT do is return a row
 * that was never gated or never screened.
 */
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { adCopy } from "../../drizzle/schema";
import { measureHeadlineFit } from "./compositeHeadline";

/** A gated, compliance-screened piece of copy, with the provenance to prove both. */
export type GatedPiece = {
  id: number;
  text: string;
  contentType: "headline" | "body";
  /** The four axes, stamped at generation by migration 0097. */
  persona: string | null;
  desire: string | null;
  awareness: string | null;
  format: string | null;
  /**
   * The concept this piece descends from (migration 0101), carried so a consumer can record
   * WHICH concept it used without re-querying and without matching on `desire` text. The image
   * path stamps it onto adCreatives (migration 0102). NULL where the piece predates concepts or
   * its ICP had none.
   */
  conceptId: number | null;
  /** Compliance provenance — screened at GENERATION, not at publish. */
  complianceCheckedAt: Date | null;
  complianceScore: number | null;
  complianceVersion: string | null;
  selectionScore: string | null;
};

export type GatedPublishCopy = {
  adSetId: string | null;
  headline: GatedPiece | null;
  body: GatedPiece | null;
  headlineCandidates: GatedPiece[];
  bodyCandidates: GatedPiece[];
  /** Headlines excluded because they would ELLIPSIS on the canvas — see measureHeadlineFit. */
  rejectedForWidth: Array<{ id: number; text: string; lines: string[] }>;
  /** Why there is no usable copy, when that is the case. Null when resolution succeeded. */
  unavailableReason: string | null;
};

/**
 * A row counts as GATED only if it carries an awareness stamp AND was compliance-checked.
 *
 * ⚠️ `awareness IS NOT NULL` is the load-bearing predicate. Migration 0097 added the axis
 * columns to production, but the code that WRITES them is the undeployed copy engine — so
 * as at 2026-08-09 all 5424 production adCopy rows have NULL axes. A resolver that fell
 * back to ungated rows would silently reproduce exactly the defect this module removes, and
 * the fallback would look like it was working. It refuses instead.
 */
function isGated(row: { awareness: unknown; complianceCheckedAt: unknown }): boolean {
  return row.awareness != null && String(row.awareness).length > 0 && row.complianceCheckedAt != null;
}

const toPiece = (r: any): GatedPiece => ({
  id: Number(r.id),
  text: String(r.content ?? ""),
  contentType: r.contentType,
  persona: r.persona ?? null,
  desire: r.desire ?? null,
  awareness: r.awareness ?? null,
  format: r.format ?? null,
  // Kept as a NUMBER (or null) — never stringified, never compared to `desire`. It is an
  // identity, and the whole point of carrying it is that it either matches or it does not.
  conceptId: r.conceptId == null ? null : Number(r.conceptId),
  complianceCheckedAt: r.complianceCheckedAt ?? null,
  complianceScore: r.complianceScore ?? null,
  complianceVersion: r.complianceVersion ?? null,
  selectionScore: r.selectionScore ?? null,
});

/** Strongest first: selectionScore descending, ties broken by id so runs are reproducible. */
function byStrength(a: GatedPiece, b: GatedPiece): number {
  const sa = a.selectionScore == null ? -1 : Number(a.selectionScore);
  const sb = b.selectionScore == null ? -1 : Number(b.selectionScore);
  if (sb !== sa) return sb - sa;
  return a.id - b.id;
}

/**
 * Resolve the headline and body a published ad should carry for `serviceId`.
 *
 * `canvasWidth` is the EMITTED pixel width of the creative the headline will be baked onto
 * — 896 for Flux at 4:5, 1024 for gpt-image-1. Defaults to 896, the narrower of the two, so
 * a headline chosen without knowing the renderer still fits the tighter canvas.
 */
export async function resolveGatedPublishCopy(
  db: any,
  userId: number,
  serviceId: number,
  opts: { canvasWidth?: number; adSetId?: string } = {},
): Promise<GatedPublishCopy> {
  const canvasWidth = opts.canvasWidth ?? 896;

  const empty = (reason: string): GatedPublishCopy => ({
    adSetId: null, headline: null, body: null,
    headlineCandidates: [], bodyCandidates: [], rejectedForWidth: [],
    unavailableReason: reason,
  });

  // The most recent gated ad set for this service. Scoped by userId as well as serviceId —
  // a service id alone is not an ownership claim.
  let adSetId = opts.adSetId ?? null;
  if (!adSetId) {
    const recent = await db
      .select({ adSetId: adCopy.adSetId })
      .from(adCopy)
      .where(and(eq(adCopy.userId, userId), eq(adCopy.serviceId, serviceId), isNotNull(adCopy.awareness)))
      .orderBy(desc(adCopy.id))
      .limit(1);
    adSetId = recent?.[0]?.adSetId ?? null;
  }
  if (!adSetId) {
    return empty(
      `no GATED ad copy exists for service ${serviceId}. Rows must carry an awareness stamp ` +
      `(migration 0097) and a compliance check from generation. Ungated rows are refused rather ` +
      `than used, because using them would silently reproduce the defect this reroute removes.`,
    );
  }

  const rows: any[] = await db
    .select({
      id: adCopy.id, content: adCopy.content, contentType: adCopy.contentType,
      persona: adCopy.persona, desire: adCopy.desire, awareness: adCopy.awareness, format: adCopy.format,
      conceptId: adCopy.conceptId,
      complianceCheckedAt: adCopy.complianceCheckedAt, complianceScore: adCopy.complianceScore,
      complianceVersion: adCopy.complianceVersion, selectionScore: adCopy.selectionScore,
    })
    .from(adCopy)
    .where(and(eq(adCopy.userId, userId), eq(adCopy.adSetId, adSetId)));

  const gated = rows.filter(isGated);
  const headlineCandidates = gated.filter((r) => r.contentType === "headline").map(toPiece).sort(byStrength);
  const bodyCandidates = gated.filter((r) => r.contentType === "body").map(toPiece).sort(byStrength);

  if (headlineCandidates.length === 0 || bodyCandidates.length === 0) {
    return {
      ...empty(
        `ad set ${adSetId} has ${headlineCandidates.length} gated headline(s) and ` +
        `${bodyCandidates.length} gated body(ies); both surfaces are required.`,
      ),
      adSetId,
      headlineCandidates,
      bodyCandidates,
    };
  }

  // ── The length rule, applied by RENDERED WIDTH ──────────────────────────────
  // The retired micro-call enforced ≤38 characters with retries; nothing else did. Gated
  // headlines are written to Meta's ~40-char field and have never been measured against a
  // canvas, so select on whether the compositor would actually ellipsis them.
  const rejectedForWidth: GatedPublishCopy["rejectedForWidth"] = [];
  let headline: GatedPiece | null = null;
  for (const cand of headlineCandidates) {
    const fit = measureHeadlineFit(cand.text, canvasWidth, "lower");
    if (fit.fits) { headline = cand; break; }
    rejectedForWidth.push({ id: cand.id, text: cand.text, lines: fit.lines });
  }
  if (!headline) {
    return {
      ...empty(
        `all ${headlineCandidates.length} gated headline(s) would truncate at ${canvasWidth}px. ` +
        `Shipping a truncated headline is the defect this rule exists to prevent.`,
      ),
      adSetId, headlineCandidates, bodyCandidates, rejectedForWidth,
    };
  }

  return {
    adSetId,
    headline,
    body: bodyCandidates[0],
    headlineCandidates,
    bodyCandidates,
    rejectedForWidth,
    unavailableReason: null,
  };
}
