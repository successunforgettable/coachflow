/**
 * adAssembly.ts — one concept → one ad. READ-ONLY.
 *
 * ⚠️ WHAT THIS EXISTS TO FIX. Step 1 made the published headline and body come from the
 * GATED pool, which was the gap that mattered most — but it picks them INDEPENDENTLY, so the
 * first ad this product ever published shipped a `solution_aware` headline against a
 * `problem_aware` body. Both good, both compliant, two different stages of one funnel in one
 * ad. Distinctness across ads is worth nothing if each ad is incoherent inside itself.
 *
 * This module chooses the four surfaces of an ad TOGETHER, keyed on concept identity, and
 * refuses to invent an ad it cannot make properly.
 *
 * ── THE RULES, and why each is the way it is ────────────────────────────────────────────
 *
 * 1. **THE PICTURE DRIVES THE HEADLINE, NOT THE OTHER WAY ROUND.** A headline cannot be
 *    chosen independently of the image, because the image has already BAKED one — they are
 *    one artefact from the moment it renders. So assembly enumerates creatives and reads
 *    each one's headline off `headlineAdCopyId`. Choosing a "better" headline than the one
 *    on the picture would put two different headlines on one ad, which spec §3 calls three
 *    unrelated messages and is worse than repetition.
 *
 * 2. **PAIR BY ID, NEVER BY LABEL TEXT.** The creative names its headline row by id; that
 *    row names its concept by id. `conceptId` on the creative is then ASSERTED to agree, and
 *    a disagreement DROPS the ad and is reported as a defect. It is never repaired,
 *    reconciled or preferred one way — two concepts can share an awareness stage and
 *    `desire` is free text, so a silent mispair produces a plausible ad that is internally
 *    incoherent with nothing anywhere to detect it. See migrations 0101/0102.
 *
 * 3. **AWARENESS COHERENCE IS CHECKED ROW TO ROW, ON THE LIVE STAMPS.** The distinctness
 *    gate moved 8 of 28 kept rows to a different awareness stage to break collisions, and an
 *    awareness move does NOT re-point `conceptId` (only a desire move does). So a row's
 *    concept and its stage can legitimately disagree. There is deliberately NO rule about
 *    "moved rows": eligibility does not depend on history. The concept is the GROUPING key
 *    (persona + desire, an identity) and the ad's internal coherence is a comparison of the
 *    headline's and body's OWN current `awareness` values. A row is eligible whenever it
 *    still agrees with what it would ship beside. An ad may therefore ship on a stage its
 *    concept was not written at, which is honest and recoverable from the rows themselves.
 *
 * 4. **EVERY PIECE IS CONSUMED AT MOST ONCE — HEADLINE, BODY, PICTURE AND HOOK TEXT.** Two
 *    ads sharing any surface re-collapse into one Entity ID, which is what the whole chapter
 *    was spent eliminating. When a concept has no unconsumed piece left, IT SHIPS NO AD.
 *    Never pad, never reuse, and say so in the ledger.
 *
 * 5. **NULL `conceptId` MEANS "NOT CONCEPT-KEYED" — SKIP, NEVER DEFAULT.** Editorial
 *    creatives and the two router insert sites write NULL by design. They are not eligible
 *    here and they are not broken: they stay publishable through the existing single-ad
 *    path. A NULL is never read as a wildcard or as a default concept.
 *
 * ⚠️ THE HOOK IS RECORDED, NOT DECIDED, HERE. The on-image hook is baked at RENDER time
 * (`dealHooksByConcept`), so by the time assembly runs the pixels exist and cannot be
 * changed. Assembly therefore does three things with it and nothing more: it PREFERS a
 * creative whose hook agrees with its concept when a concept has more than one; it RECORDS
 * the agreement per ad; and it DROPS an ad whose hook text duplicates one already assembled,
 * because duplicate baked text is the real collapse risk and is the one thing still fixable
 * at this point. A mismatched-but-unique hook does NOT drop the ad — throwing away a
 * rendered picture over a surface that cannot be re-chosen would ship fewer ads for no gain.
 *
 * ⚠️ THIS MODULE MAKES NO META CALL AND WRITES NOTHING. It reads rows and returns a plan.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { adCopy, adCreatives } from "../../drizzle/schema";
import { resolveGatedPublishCopy, type GatedPiece } from "./publishCopySource";

export type HookAgreement =
  /** The baked hook's concept equals the ad's concept. */
  | "match"
  /** A hook row was baked and its concept is a different one. */
  | "mismatch"
  /**
   * No hook identity is recorded on the row. ⚠️ This deliberately collapses THREE different
   * situations, because nothing in the database distinguishes them after the fact: no hook
   * line was drawn at all (a short hook deck — see `dealHooksByConcept`), the picture
   * predates migration 0103, or the legacy body/mainBenefit fallback supplied the line.
   * Reporting one category honestly beats inventing three we cannot tell apart.
   */
  | "unknown";

export type AssembledCreative = {
  id: number;
  conceptId: number;
  headlineAdCopyId: number;
  hookAdCopyId: number | null;
  imageUrl: string | null;
  verticalImageUrl: string | null;
  variationNumber: number | null;
  batchId: string | null;
};

export type AssembledAd = {
  conceptId: number;
  /** The stage this AD ships on — the headline's own live stamp, which the body agrees with. */
  awareness: string;
  headline: GatedPiece;
  body: GatedPiece;
  creative: AssembledCreative;
  hook: {
    adCopyId: number | null;
    conceptId: number | null;
    text: string | null;
    agreement: HookAgreement;
  };
};

export type DropReason =
  | "creative_not_concept_keyed"
  | "creative_headline_not_recorded"
  | "headline_row_not_gated"
  | "headline_would_truncate"
  | "concept_stamp_mismatch"
  | "headline_already_used"
  | "no_body_for_concept"
  | "no_body_agrees_on_awareness"
  | "bodies_already_used"
  | "duplicate_hook_text"
  | "concept_already_shipped";

export type AssemblyLedger = {
  adSetId: string | null;
  /** Why nothing could be assembled at all. Null when at least the inputs were usable. */
  unavailableReason: string | null;
  creativesSeen: number;
  creativesEligible: number;
  conceptsSeen: number;
  adsAssembled: number;
  /** Concepts that produced a complete, internally coherent ad vs. those that did not. */
  coherenceYield: { conceptsWithAd: number; conceptsWithoutAd: number };
  gatedPool: { headlines: number; bodies: number; bodiesConsumed: number };
  hookAgreement: Record<HookAgreement, number>;
  /**
   * Every creative or concept that did NOT become an ad, with the reason. A short set is a
   * correct result; a short set nobody can explain is not.
   */
  drops: Array<{ creativeId?: number; conceptId?: number; reason: DropReason; detail?: string }>;
  /**
   * 🔴 Stamp disagreements: the creative's concept is not its headline row's concept. This is
   * a DEFECT in the step-3 stamp, never something to reconcile here. Empty is the expectation.
   */
  conceptStampMismatches: Array<{ creativeId: number; creativeConceptId: number; headlineConceptId: number | null }>;
};

export type AssemblyResult = { ads: AssembledAd[]; ledger: AssemblyLedger };

const byStrength = (a: GatedPiece, b: GatedPiece): number => {
  const sa = a.selectionScore == null ? -1 : Number(a.selectionScore);
  const sb = b.selectionScore == null ? -1 : Number(b.selectionScore);
  if (sb !== sa) return sb - sa;
  return a.id - b.id;
};

/** Normalised for the duplicate check only — never for pairing, which is always by id. */
const hookKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Assemble concept-keyed ads for one service.
 *
 * `batchId` scopes which render deck is used; without it the MOST RECENT batch is taken,
 * because assembling across batches would mix decks rendered at different times against one
 * gated ad set and quietly pair a picture with copy it never saw.
 */
export async function assembleConceptAds(
  db: any,
  userId: number,
  serviceId: number,
  opts: { adSetId?: string; batchId?: string; canvasWidth?: number } = {},
): Promise<AssemblyResult> {
  const ledger: AssemblyLedger = {
    adSetId: null, unavailableReason: null,
    creativesSeen: 0, creativesEligible: 0, conceptsSeen: 0, adsAssembled: 0,
    coherenceYield: { conceptsWithAd: 0, conceptsWithoutAd: 0 },
    gatedPool: { headlines: 0, bodies: 0, bodiesConsumed: 0 },
    hookAgreement: { match: 0, mismatch: 0, unknown: 0 },
    drops: [], conceptStampMismatches: [],
  };

  // ── The gated copy pool ─────────────────────────────────────────────────────
  const gated = await resolveGatedPublishCopy(db, userId, serviceId, {
    adSetId: opts.adSetId, canvasWidth: opts.canvasWidth,
  });
  ledger.adSetId = gated.adSetId;
  ledger.gatedPool.headlines = gated.headlineCandidates.length;
  ledger.gatedPool.bodies = gated.bodyCandidates.length;

  if (gated.headlineCandidates.length === 0 || gated.bodyCandidates.length === 0) {
    ledger.unavailableReason =
      gated.unavailableReason ??
      "the gated pool is missing one of the two required copy surfaces";
    return { ads: [], ledger };
  }

  const headlineById = new Map(gated.headlineCandidates.map((h) => [h.id, h]));
  const truncating = new Set(gated.rejectedForWidth.map((r) => r.id));

  // ── The render deck ─────────────────────────────────────────────────────────
  const creativeRows: any[] = await db
    .select({
      id: adCreatives.id, conceptId: adCreatives.conceptId,
      headlineAdCopyId: adCreatives.headlineAdCopyId, hookAdCopyId: adCreatives.hookAdCopyId,
      imageUrl: adCreatives.imageUrl, verticalImageUrl: adCreatives.verticalImageUrl,
      variationNumber: adCreatives.variationNumber, batchId: adCreatives.batchId,
    })
    .from(adCreatives)
    .where(and(eq(adCreatives.userId, userId), eq(adCreatives.serviceId, serviceId)))
    .orderBy(desc(adCreatives.id));

  const all = creativeRows ?? [];
  const batchId = opts.batchId ?? (all.length > 0 ? all[0].batchId ?? undefined : undefined);
  const deck = batchId ? all.filter((r) => r.batchId === batchId) : all;
  ledger.creativesSeen = deck.length;

  if (deck.length === 0) {
    ledger.unavailableReason = `no ad creatives exist for service ${serviceId}`;
    return { ads: [], ledger };
  }

  // ── The baked hooks, by id ──────────────────────────────────────────────────
  const hookIds = Array.from(
    new Set(deck.map((r) => r.hookAdCopyId).filter((v: any) => v != null).map(Number)),
  );
  const hookById = new Map<number, { conceptId: number | null; text: string }>();
  if (hookIds.length > 0) {
    const rows: any[] = await db
      .select({ id: adCopy.id, conceptId: adCopy.conceptId, content: adCopy.content })
      .from(adCopy)
      .where(and(eq(adCopy.userId, userId), inArray(adCopy.id, hookIds)));
    for (const r of rows ?? []) {
      hookById.set(Number(r.id), {
        conceptId: r.conceptId == null ? null : Number(r.conceptId),
        text: String(r.content ?? ""),
      });
    }
  }

  // ── Eligible (creative, headline) pairs ─────────────────────────────────────
  type Candidate = {
    creative: AssembledCreative;
    headline: GatedPiece;
    hook: AssembledAd["hook"];
  };
  const candidates: Candidate[] = [];

  for (const r of deck) {
    const creativeId = Number(r.id);
    if (r.conceptId == null) {
      ledger.drops.push({ creativeId, reason: "creative_not_concept_keyed" });
      continue;
    }
    if (r.headlineAdCopyId == null) {
      ledger.drops.push({ creativeId, reason: "creative_headline_not_recorded" });
      continue;
    }
    const headlineAdCopyId = Number(r.headlineAdCopyId);
    const headline = headlineById.get(headlineAdCopyId);
    if (!headline) {
      ledger.drops.push({
        creativeId, reason: "headline_row_not_gated",
        detail: `adCopy ${headlineAdCopyId} is not in the gated pool for ad set ${gated.adSetId}`,
      });
      continue;
    }
    if (truncating.has(headlineAdCopyId)) {
      // The picture already baked a headline the compositor would ellipsis. Shipping it is
      // the defect the width rule exists to prevent, so the ad is dropped rather than fixed.
      ledger.drops.push({ creativeId, reason: "headline_would_truncate", detail: `adCopy ${headlineAdCopyId}` });
      continue;
    }
    const creativeConceptId = Number(r.conceptId);
    if (headline.conceptId !== creativeConceptId) {
      ledger.conceptStampMismatches.push({
        creativeId, creativeConceptId, headlineConceptId: headline.conceptId,
      });
      ledger.drops.push({ creativeId, reason: "concept_stamp_mismatch" });
      continue;
    }

    const hookRow = r.hookAdCopyId == null ? null : hookById.get(Number(r.hookAdCopyId)) ?? null;
    const agreement: HookAgreement =
      r.hookAdCopyId == null ? "unknown"
        : hookRow == null ? "unknown"
          : hookRow.conceptId == null ? "unknown"
            : hookRow.conceptId === creativeConceptId ? "match" : "mismatch";

    candidates.push({
      creative: {
        id: creativeId, conceptId: creativeConceptId, headlineAdCopyId,
        hookAdCopyId: r.hookAdCopyId == null ? null : Number(r.hookAdCopyId),
        imageUrl: r.imageUrl ?? null, verticalImageUrl: r.verticalImageUrl ?? null,
        variationNumber: r.variationNumber ?? null, batchId: r.batchId ?? null,
      },
      headline,
      hook: {
        adCopyId: r.hookAdCopyId == null ? null : Number(r.hookAdCopyId),
        conceptId: hookRow?.conceptId ?? null,
        text: hookRow?.text ?? null,
        agreement,
      },
    });
  }
  ledger.creativesEligible = candidates.length;

  // ── Assemble, one ad per concept, deterministically ─────────────────────────
  const byConcept = new Map<number, Candidate[]>();
  for (const c of candidates) {
    const list = byConcept.get(c.creative.conceptId) ?? [];
    list.push(c);
    byConcept.set(c.creative.conceptId, list);
  }
  ledger.conceptsSeen = byConcept.size;

  const bodies = [...gated.bodyCandidates].sort(byStrength);
  const usedBodies = new Set<number>();
  const usedHeadlines = new Set<number>();
  const usedCreatives = new Set<number>();
  const usedHookText = new Set<string>();
  const ads: AssembledAd[] = [];

  for (const conceptId of Array.from(byConcept.keys()).sort((a, b) => a - b)) {
    // A hook that agrees is preferred; strength decides among equals. Both keys are total,
    // so the walk is reproducible run to run.
    const rank = (c: Candidate) => (c.hook.agreement === "match" ? 0 : c.hook.agreement === "mismatch" ? 2 : 1);
    const ordered = [...(byConcept.get(conceptId) ?? [])].sort(
      (a, b) => rank(a) - rank(b) || byStrength(a.headline, b.headline),
    );

    let shipped = false;
    for (const cand of ordered) {
      if (shipped) {
        ledger.drops.push({ creativeId: cand.creative.id, conceptId, reason: "concept_already_shipped" });
        continue;
      }
      if (usedCreatives.has(cand.creative.id)) continue;
      if (usedHeadlines.has(cand.headline.id)) {
        ledger.drops.push({ creativeId: cand.creative.id, conceptId, reason: "headline_already_used" });
        continue;
      }

      const key = cand.hook.text ? hookKey(cand.hook.text) : null;
      if (key && usedHookText.has(key)) {
        // Duplicate baked text on the surface Meta's OCR reads. Ship fewer, never reuse.
        ledger.drops.push({ creativeId: cand.creative.id, conceptId, reason: "duplicate_hook_text" });
        continue;
      }

      // The body: same concept, and — rule 3 — the same awareness as THIS headline's own stamp.
      const sameConcept = bodies.filter((b) => b.conceptId === conceptId);
      if (sameConcept.length === 0) {
        ledger.drops.push({ conceptId, creativeId: cand.creative.id, reason: "no_body_for_concept" });
        break;
      }
      const unconsumed = sameConcept.filter((b) => !usedBodies.has(b.id));
      if (unconsumed.length === 0) {
        ledger.drops.push({ conceptId, creativeId: cand.creative.id, reason: "bodies_already_used" });
        break;
      }
      const body = unconsumed.find((b) => b.awareness === cand.headline.awareness);
      if (!body) {
        // CONTINUE, not break: the stage that failed belongs to THIS headline, and another
        // creative of the same concept may bake a headline whose stage a body does agree
        // with. The two cases above are facts about the concept, so they break.
        ledger.drops.push({
          conceptId, creativeId: cand.creative.id, reason: "no_body_agrees_on_awareness",
          detail: `headline is ${cand.headline.awareness}; available bodies are ` +
                  `${unconsumed.map((b) => b.awareness ?? "null").join(", ")}`,
        });
        continue;
      }

      ads.push({
        conceptId,
        awareness: String(cand.headline.awareness),
        headline: cand.headline,
        body,
        creative: cand.creative,
        hook: cand.hook,
      });
      usedBodies.add(body.id);
      usedHeadlines.add(cand.headline.id);
      usedCreatives.add(cand.creative.id);
      if (key) usedHookText.add(key);
      ledger.hookAgreement[cand.hook.agreement] += 1;
      shipped = true;
    }

    if (shipped) ledger.coherenceYield.conceptsWithAd += 1;
    else ledger.coherenceYield.conceptsWithoutAd += 1;
  }

  ledger.adsAssembled = ads.length;
  ledger.gatedPool.bodiesConsumed = usedBodies.size;
  if (ads.length === 0 && ledger.unavailableReason == null) {
    ledger.unavailableReason =
      `no concept produced a complete coherent ad from ${ledger.creativesSeen} creative(s) — see drops`;
  }
  return { ads, ledger };
}

/** One-line ledger summary for a proof run's log. Never a substitute for the ledger itself. */
export function describeAssembly(ledger: AssemblyLedger): string {
  const h = ledger.hookAgreement;
  return (
    `[adAssembly] adSet ${ledger.adSetId ?? "none"} — creatives ${ledger.creativesSeen} ` +
    `(eligible ${ledger.creativesEligible}) · concepts ${ledger.conceptsSeen} · ` +
    `ADS ${ledger.adsAssembled} · coherence ${ledger.coherenceYield.conceptsWithAd} with / ` +
    `${ledger.coherenceYield.conceptsWithoutAd} without · bodies ${ledger.gatedPool.bodiesConsumed}/` +
    `${ledger.gatedPool.bodies} consumed · hook match ${h.match} mismatch ${h.mismatch} ` +
    `unknown ${h.unknown} · stamp mismatches ${ledger.conceptStampMismatches.length}`
  );
}
