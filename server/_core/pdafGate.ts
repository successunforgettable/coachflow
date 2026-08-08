/**
 * pdafGate.ts — the DISTINCTNESS GATE. The copy analogue of the image visibility tier.
 *
 * WHAT THIS IS FOR. Two pieces of copy are genuinely different to Meta only if they
 * differ on at least TWO of four axes — Persona, Desire, Awareness, Format. Differ on
 * 0 or 1 and Meta collapses them into one Entity ID with one auction ticket: you think
 * you are testing eight ads, Meta is really running one. Measured on production before
 * this chapter: 69-71% of all copy pairs collapsed.
 *
 * ⚠️ THE 2-of-4 CATEGORICAL RULE IS THE SOLE AUTHORITY HERE. Everything else in this
 * file that looks like a threshold — the anti-echo word run, the band sizes — is a
 * TUNABLE HEURISTIC of ours and is labelled as such at its definition. The build spec
 * §7 is explicit about why: the "reject above 0.40 cosine similarity" instruction that
 * appears in all six research reports comes from a local sentence-transformer that is
 * NOT Meta's embedding, and baking it in as though it were Meta's real boundary would
 * repeat the "60% threshold" folklore mistake the research side already threw out.
 * No score in this file decides pass or fail. The categorical rule does.
 *
 * FOUR THINGS HAPPEN HERE, IN THIS ORDER:
 *   1. EVICTION      — collapsing pairs resolved by removing the piece that clashes most
 *   2. REGENERATION  — each evicted piece redrafted on a different axis, capped
 *   3. ANTI-ECHO     — deck-wide, over a per-ad LIST of surfaces (see below)
 *   4. TRIM          — cut to the budget band, keeping the most-separated pieces
 *
 * ORDER RELATIVE TO COMPLIANCE: the compliance gate runs FIRST, in the caller, and this
 * gate runs on its survivors. Spending distinctness budget redrafting a piece that will
 * be hard-blocked anyway is wasted work, and a distinctness redraft has to re-enter the
 * compliance gate regardless — which is why `regenerate` callbacks below are required to
 * return only compliance-clean candidates.
 *
 * WHAT IS DELIBERATELY NOT HERE:
 *   - No DB access, no ORM, no schema import. The caller passes labels and text in and
 *     gets decisions out. Same boundary pdafDistinctness.ts keeps, for the same reason.
 *   - No inference of axes from finished copy. The gate compares what was ASSIGNED at
 *     generation time and written to the 0097 columns. The Phase 0 recovery-by-replay in
 *     scripts/pdaf-collapse-audit.ts was a one-off measurement device and is not how the
 *     gate works.
 *   - No new retry ceiling. The cap is COMPLIANCE_RETRY_MAX_ATTEMPTS, imported from
 *     complianceAxis, so every path in the codebase has ONE ceiling.
 */

import {
  auditBatch,
  comparePair,
  PDAF_DIMENSIONS,
  type PdafDimension,
  type PdafLabels,
} from "./pdafDistinctness";
import { COMPLIANCE_RETRY_MAX_ATTEMPTS } from "./complianceAxis";
import { AWARENESS_STAGES, type AwarenessStage } from "./conceptAxis";
import { DISTINCT_TARGET_BY_BAND, type BudgetBand } from "./variationCounts";

// ─── Budget band ─────────────────────────────────────────────────────────────

/**
 * DEFAULT BAND — Arfeen's decision, 2026-08-07: small (8-12).
 *
 * ⚠️ EXPLICIT SETTING, NEVER INFERRED. It is deliberately NOT derived from the Meta
 * daily-budget field (which defaults to $20 in PushKitModal) or from any spend signal.
 * A band inferred from a number the coach has not thought about is a silent decision
 * about how many ads they ship; the research bands are about how much CONVERSION SIGNAL
 * an account has, which a starting daily budget does not measure.
 */
export const DEFAULT_BUDGET_BAND: BudgetBand = "small";

/** Resolve the band. Caller value wins, then env, then the small default. */
export function resolveBudgetBand(explicit?: BudgetBand | null): BudgetBand {
  if (explicit && explicit in DISTINCT_TARGET_BY_BAND) return explicit;
  const raw = process.env.ZAP_BUDGET_BAND;
  if (raw && raw in DISTINCT_TARGET_BY_BAND) return raw as BudgetBand;
  return DEFAULT_BUDGET_BAND;
}

/**
 * The ship ceiling for a band.
 *
 * ⚠️ DECOUPLED FROM IMAGE CARDINALITY BY DESIGN. The copy deck trims to this number on
 * its own. The rule that a copy deck must not exceed the image deck (8 copy angles
 * against 4 pictures re-collapses, which is what the image chapter was spent
 * eliminating) binds at DECK ASSEMBLY, not here — the effective published count is
 * min(this, image deck size). When the image deck grows 4 -> 8 in its own sprint, this
 * gate changes by zero lines: the number it reads changes, not the mechanism.
 */
export function bandMax(band: BudgetBand): number {
  return DISTINCT_TARGET_BY_BAND[band].max;
}
/**
 * A per-surface override of the band. Settled by Arfeen 2026-08-08.
 *
 * ⚠️ WHY SURFACES GET THEIR OWN BANDS. One shared band of 12 across three surfaces let them
 * starve each other. Measured on the live run of 2026-08-08 (adSet NUTz86js4K4fovKp0ZxT1):
 * the deck kept **6 headlines / 5 image hooks / 1 body**. Not a trim failure — 15 of ~17
 * bodies were dropped at the cap, every one "no axis move clears 2-of-4", so by the time
 * trim ran there was a single body left to rebalance. Persona is pinned and format is fixed
 * per piece, so with 8 desires the supply of distinct (desire × awareness × format) cells is
 * finite, and the surface generated in the largest quantity loses the race for them.
 *
 * A deck with one body cannot ship: twelve ads cannot share a single body.
 */
export type SurfaceBandOverride = { min?: number; max?: number };

/** Per-surface accounting. The shippability question is asked SURFACE BY SURFACE. */
export type SurfaceLedger = {
  surface: string;
  populationSize: number;
  bandMin: number;
  bandMax: number;
  collapsingPairsBefore: number;
  collapseRateBefore: number;
  collapsingPairsAfter: number;
  collapseRateAfter: number;
  evicted: number;
  recovered: number;
  dropped: number;
  trimmed: number;
  kept: number;
  /** kept >= bandMin. False is the "unshippable surface" signal the shared band could not see. */
  meetsFloor: boolean;
};

export function bandMin(band: BudgetBand): number {
  return DISTINCT_TARGET_BY_BAND[band].min;
}

// ─── The population ──────────────────────────────────────────────────────────

export type GateItem<TId> = {
  id: TId;
  labels: PdafLabels;
  /**
   * Which text surface this piece is.
   *
   * ⚠️ UPDATED 2026-08-08. This used to read "drives anti-echo roles, and nothing else —
   * the P.D.A.F. comparison is blind to it." That is no longer true, and the change is the
   * point: distinctness is now judged WITHIN a surface. `comparePair` itself is still blind
   * to surface — the GROUPING is what changed, not the comparison — but a headline and a
   * body are never compared, because they are two surfaces of one ad rather than two ads.
   */
  surface: string;
  /** The finished copy. Used ONLY by anti-echo, never by the P.D.A.F. comparison. */
  text: string;
  /** The surface this was generated beside — see EchoSurface.partnerId. */
  partnerId?: string | null;
};

/**
 * Surfaces that are NEVER part of the distinctness population.
 *
 * LOCKED DECISION. A link description is a ~30-character CTA surface, and is not one of
 * the three surfaces Meta fuses into one meaning (image text / headline / body). So
 * link-vs-link collapse is not a real delivery signal, and counting it would make the
 * gate reject genuinely fine copy to fix a collision that costs nothing.
 *
 * Links KEEP their awareness stamp — it coordinates them with the headline and body they
 * ship beside — they are simply never counted. This exclusion is applied in ONE place
 * (`partitionPopulation`) so a later caller cannot re-admit them by forgetting a filter.
 */
export const EXCLUDED_SURFACES: readonly string[] = ["link", "link_description"] as const;

export function isExcludedSurface(surface: string): boolean {
  return EXCLUDED_SURFACES.includes(String(surface));
}

export function partitionPopulation<TId>(items: Array<GateItem<TId>>): {
  population: Array<GateItem<TId>>;
  excluded: Array<GateItem<TId>>;
} {
  const population: Array<GateItem<TId>> = [];
  const excluded: Array<GateItem<TId>> = [];
  for (const it of items) (isExcludedSurface(it.surface) ? excluded : population).push(it);
  return { population, excluded };
}

// ─── 1. Eviction ─────────────────────────────────────────────────────────────

export type Eviction<TId> = {
  id: TId;
  /** How many other pieces this one collapsed against when it was evicted. */
  collisions: number;
  /** The pieces it collapsed against. */
  against: TId[];
  /** The axis the regeneration should move it on. null when nothing can move. */
  axis: PdafDimension | null;
};

/**
 * PERSONA IS NEVER A REGENERATION TARGET.
 *
 * It is pinned to the ICP by construction — conceptGenerator.ts sets personaLabel once
 * from the ICP and stamps it on every concept, and both copy nodes stamp it from
 * input.targetMarket. One campaign speaks to one buyer today. Widening it is the
 * separate PERSONA/PAIN WIDENING phase (build spec §8a decision 1) and needs ICP-level
 * work, not a gate change. Asking the model for "a different persona" here would produce
 * a LABEL that differs and copy that does not — fake diversity, which is the exact
 * failure this whole chapter exists to remove.
 */
export const MOVABLE_AXES: readonly PdafDimension[] = ["desire", "awareness", "format"] as const;

/**
 * Choose which axis an evicted piece should be redrafted on.
 *
 * PRIORITY: desire -> awareness -> format. Reasons, in the order they matter:
 *
 *  - DESIRE FIRST. It is the widest genuinely-available space: the concept set supplies
 *    N distinct desires for one ICP, and turning it on is what took collapse from 42.3%
 *    to 19.4% on Node 6. Moving it changes what the copy is ABOUT, which is real
 *    difference rather than restyling.
 *  - AWARENESS SECOND, AND CAREFULLY. Only five values exist and the deck's spread across
 *    them is a deliberate cold-weighted allocation. Reassigning freely would flatten the
 *    cold weighting the deck was planned with, so the replacement value is drawn from the
 *    PLAN'S SLACK — see suggestAwarenessFromSlack.
 *  - FORMAT LAST. Most constrained (5 formulas in Node 6, a fixed angle list in Node 7),
 *    and moving it changes the copy architecture the whole deck was planned around.
 *
 * Only axes that currently MATCH a collapsing partner are candidates — moving an axis
 * that already differs cannot fix the collapse.
 */
export function chooseAxis(
  item: PdafLabels,
  partners: PdafLabels[],
): PdafDimension | null {
  const matching = new Set<PdafDimension>();
  for (const p of partners) {
    for (const d of PDAF_DIMENSIONS) {
      if (!comparePair(item, p).differingDimensions.includes(d)) matching.add(d);
    }
  }
  return MOVABLE_AXES.find((d) => matching.has(d)) ?? null;
}

/**
 * Resolve every collapsing pair by eviction.
 *
 * MAX-DEGREE GREEDY. Treat collapsing pairs as a web of clashes: each piece is a node,
 * each collapse an edge. Remove the node with the MOST edges first, because removing it
 * clears the most clashes at once. Recompute and repeat until no edges remain.
 *
 * REPRODUCIBLE TIE-BREAKING: ties on degree go to the LATER item (higher index), so
 * earlier-generated pieces are stable and the same input always produces the same
 * survivors. Without a deterministic rule the same deck would gate differently run to
 * run, and no before/after measurement would mean anything.
 */
export function planEvictions<TId>(items: Array<GateItem<TId>>): {
  keep: Array<GateItem<TId>>;
  evictions: Array<Eviction<TId>>;
} {
  const alive = items.map((it, index) => ({ it, index, dead: false }));
  const evictions: Array<Eviction<TId>> = [];

  for (;;) {
    const live = alive.filter((a) => !a.dead);
    const audit = auditBatch(live.map((a) => ({ id: a.index, labels: a.it.labels })));
    if (audit.collapsingPairs.length === 0) break;

    const degree = new Map<number, number[]>();
    for (const pair of audit.collapsingPairs) {
      if (!degree.has(pair.a)) degree.set(pair.a, []);
      if (!degree.has(pair.b)) degree.set(pair.b, []);
      degree.get(pair.a)!.push(pair.b);
      degree.get(pair.b)!.push(pair.a);
    }

    let worstIndex = -1;
    let worstCount = -1;
    for (const [index, partners] of Array.from(degree.entries())) {
      // Higher degree loses; on a tie the LATER item loses.
      if (partners.length > worstCount || (partners.length === worstCount && index > worstIndex)) {
        worstCount = partners.length;
        worstIndex = index;
      }
    }
    if (worstIndex < 0) break;

    const partnerIndexes = degree.get(worstIndex) ?? [];
    const victim = alive[worstIndex];
    victim.dead = true;
    evictions.push({
      id: victim.it.id,
      collisions: partnerIndexes.length,
      against: partnerIndexes.map((i) => alive[i].it.id),
      axis: chooseAxis(victim.it.labels, partnerIndexes.map((i) => alive[i].it.labels)),
    });
  }

  return { keep: alive.filter((a) => !a.dead).map((a) => a.it), evictions };
}

// ─── 2. Replacement values, drawn so the deck plan survives ──────────────────

/**
 * Pick an awareness stage FROM THE PLAN'S SLACK.
 *
 * The deck was planned with a deliberate cold-weighted distribution
 * (COLD_WEIGHTED_STAGE_MIX: unaware 3, problem_aware 3, solution_aware 1, product_aware 1,
 * most_aware 0). If the gate reassigned awareness to whatever differs, it would quietly
 * destroy that weighting — the deck would still pass 2-of-4 and would no longer be the
 * cold-traffic deck anyone asked for. The research is explicit that the 25% warmer tail is
 * load-bearing against Entity-ID pigeonholing, so this cuts both ways.
 *
 * So: choose the stage that is MOST UNDER-REPRESENTED against the plan. Ties go to the
 * colder stage (AWARENESS_STAGES is ordered coldest -> hottest), matching how
 * awarenessPlanForCount breaks its own ties. Stages with zero planned slots are never
 * chosen, so most_aware cannot leak into a cold batch through the back door.
 */
export function suggestAwarenessFromSlack(
  planned: readonly AwarenessStage[],
  current: readonly (AwarenessStage | string | null)[],
  avoid: ReadonlySet<string> = new Set(),
): AwarenessStage | null {
  const want = new Map<AwarenessStage, number>();
  for (const s of planned) want.set(s, (want.get(s) ?? 0) + 1);
  const have = new Map<string, number>();
  for (const s of current) if (s) have.set(String(s), (have.get(String(s)) ?? 0) + 1);

  let best: AwarenessStage | null = null;
  let bestSlack = -Infinity;
  for (const stage of AWARENESS_STAGES) {
    const planCount = want.get(stage) ?? 0;
    if (planCount === 0) continue;              // never introduce an unplanned stage
    if (avoid.has(stage)) continue;
    const slack = planCount - (have.get(stage) ?? 0);
    if (slack > bestSlack) { bestSlack = slack; best = stage; }
  }
  return best;
}

/**
 * Pick the least-used value from a pool, skipping anything in `avoid`.
 *
 * Used for desire (the concept set's desires) and format (the formula / angle list).
 * Least-used rather than random: it spreads the axis as evenly as the pool allows, and it
 * is deterministic, so a re-run of the same deck makes the same choice.
 */
export function suggestLeastUsed(
  pool: readonly string[],
  current: readonly (string | null)[],
  avoid: ReadonlySet<string> = new Set(),
): string | null {
  const used = new Map<string, number>();
  for (const v of current) if (v) used.set(v, (used.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = Infinity;
  for (const v of pool) {
    if (avoid.has(v)) continue;
    const c = used.get(v) ?? 0;
    if (c < bestCount) { bestCount = c; best = v; }
  }
  return best;
}

export type AxisPools = {
  desires: readonly string[];
  awarenessPlan: readonly AwarenessStage[];
  formats: readonly string[];
  /**
   * Which axes this NODE is able to move. Node 7 can move all three: its formats are
   * angles over one row shape. Node 6 passes ["desire", "awareness"] only, because moving
   * its format means moving the headline to a different FORMULA and the formulas do not
   * share a row shape (`eyebrow` carries an eyebrow and a subheadline, `story` neither).
   * Defaults to all three when unset.
   */
  movable?: readonly PdafDimension[];
};

export type Reassignment = {
  /** One or more axis moves, applied together. */
  moves: Array<{ dimension: PdafDimension; value: string }>;
};

/**
 * Work out a reassignment that ACTUALLY CLEARS 2-of-4 against every colliding survivor.
 *
 * 🔴 THIS REPLACES A FIRST CUT THAT DROPPED 12 OF 19 EVICTIONS ON THE LIVE RUN
 * (2026-08-07, adSet vO1S7PVlm6G6EM76qYMX2). That version picked ONE axis and fell through
 * to the next only when the axis's POOL was exhausted — never when the move was made and
 * still left the pair collapsing. With persona pinned and the piece's format fixed,
 * changing desire alone yields at most two differing axes; against a survivor sharing BOTH
 * awareness and format it yields one, so the redraft collapsed again and the loop spent all
 * three attempts re-trying the same useless axis. Every one of the 19 evictions chose
 * `desire`, and 12 died on it.
 *
 * THE FIX IS TO TEST THE OUTCOME, NOT THE POOL. Candidate moves are simulated against the
 * survivors before any model call is made, and only a combination that clears the rule is
 * returned. Single-axis moves are tried first, in the same desire -> awareness -> format
 * priority (desire is the widest real space; awareness must respect the cold-weighted plan;
 * format changes the architecture the deck was built around). Only if no single move works
 * is a PAIR of axes tried — moving two is still far better than dropping the piece.
 *
 * Returns null only when no available combination can clear the rule. That is a genuine
 * state — Node 6 with one desire and a saturated awareness plan has nowhere to go — and the
 * caller must then drop, never pad.
 */
export function suggestReassignment<TId>(
  eviction: Eviction<TId>,
  item: GateItem<TId>,
  survivors: Array<GateItem<TId>>,
  pools: AxisPools,
): Reassignment | null {
  const movable = (pools.movable ?? MOVABLE_AXES).filter((d) => MOVABLE_AXES.includes(d));

  // Candidate values per axis, best-first. Awareness draws from the PLAN'S SLACK so the
  // cold weighting survives; desire and format take least-used from their pools.
  const candidatesFor = (dimension: PdafDimension): string[] => {
    const current = String(item.labels[dimension] ?? "");
    if (dimension === "awareness") {
      const out: string[] = [];
      const avoid = new Set<string>([current].filter(Boolean));
      // Repeatedly ask for the most under-represented stage, excluding what we already took,
      // so the list stays ordered by slack rather than by enum position.
      for (let i = 0; i < AWARENESS_STAGES.length; i++) {
        const v = suggestAwarenessFromSlack(pools.awarenessPlan, survivors.map((s) => s.labels.awareness), avoid);
        if (!v) break;
        out.push(v);
        avoid.add(v);
      }
      return out;
    }
    const pool = dimension === "desire" ? pools.desires : pools.formats;
    const used = new Map<string, number>();
    for (const s of survivors) {
      const v = s.labels[dimension];
      if (v) used.set(v, (used.get(v) ?? 0) + 1);
    }
    return pool
      .filter((v) => v !== current)
      .slice()
      .sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0) || pool.indexOf(a) - pool.indexOf(b));
  };

  // Does this hypothetical set of labels clear 2-of-4 against EVERY survivor? Checked
  // against all survivors, not just the pair that triggered the eviction — a redraft that
  // fixes one collision and creates another has fixed nothing.
  const clears = (moves: Array<{ dimension: PdafDimension; value: string }>): boolean => {
    const hypo: PdafLabels = { ...item.labels };
    for (const m of moves) (hypo as any)[m.dimension] = m.value;
    return survivors.every((s) => comparePair(hypo, s.labels).distinct);
  };

  // Priority order: the eviction's own suggestion first, then the rest.
  const ordered = eviction.axis && movable.includes(eviction.axis)
    ? [eviction.axis, ...movable.filter((d) => d !== eviction.axis)]
    : [...movable];

  // ── single-axis moves ──
  for (const d of ordered) {
    for (const v of candidatesFor(d)) {
      if (clears([{ dimension: d, value: v }])) return { moves: [{ dimension: d, value: v }] };
    }
  }

  // ── two-axis moves ── bounded to the top few candidates per axis so this stays cheap
  // and deterministic; the pools are small and the best candidates are first.
  const CAP = 4;
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i];
      const b = ordered[j];
      for (const va of candidatesFor(a).slice(0, CAP)) {
        for (const vb of candidatesFor(b).slice(0, CAP)) {
          const moves = [{ dimension: a, value: va }, { dimension: b, value: vb }];
          if (clears(moves)) return { moves };
        }
      }
    }
  }

  return null;
}

// ─── 3. Deck-wide anti-echo ──────────────────────────────────────────────────

/**
 * ⚠️ TUNABLE HEURISTIC — NOT AN AUTHORITY, and never to be described as a Meta rule.
 *
 * Same discipline as the 0.40 cosine number the build spec strips out (§7): this is OUR
 * readability rule about surfaces repeating each other, not a boundary Meta publishes.
 * It rewrites copy; it never decides whether a deck is distinct. The 2-of-4 rule does
 * that, and it is categorical.
 *
 * MIN_ECHO_RUN starts at 3 on Arfeen's decision, 2026-08-07.
 */
export const ANTI_ECHO_DEFAULTS = {
  /** A shared contiguous run of this many content words counts as an echo. */
  minRun: 3,
  /** How far into the opening surface to look. The first ~10 words are what Meta files the ad on. */
  openingWords: 10,
} as const;

/**
 * The surfaces an ad can carry, as a LIST rather than named fields.
 *
 * ⚠️ THIS SHAPE IS THE WHOLE REASON THE IMAGE SPRINT WILL NOT NEED A REBUILD. Today an ad
 * has two text surfaces the gate knows about — headline and body. The compositor also
 * bakes text INTO the picture, and that baked text is currently the first 140 characters
 * of the body, taken verbatim from the same table the published primary text comes from:
 * the exact repeat-across-surfaces case the research names as collapse-inducing, live
 * today. The decided fix is that the image gets its OWN short hook line.
 *
 * When it does, the ONLY change here is that "image_hook" joins `targetRoles` below. The
 * check, the normaliser and the deck-wide sweep are already written against a list.
 */
export type EchoSurface = {
  id: string;
  role: string;
  text: string;
  /**
   * The surface this one was GENERATED beside, if any — for a body, the headline the
   * chaining prompt paired it with.
   *
   * ⚠️ RECORDED SO THE DECK-WIDE CLAIM IS CHECKABLE RATHER THAN ARGUED. A finding where
   * `wasPartner` is false is a case the old pairwise check could not have caught: the body
   * echoes a headline it was never generated against, which only matters because
   * publishing recombines the surfaces. That distinction is the entire justification for
   * checking deck-wide, so the gate reports it instead of leaving it to be inferred.
   */
  partnerId?: string | null;
};

export type EchoFinding = {
  /** The piece that must be redrafted — the one carrying the opening. */
  id: string;
  role: string;
  /** The surface it echoed. */
  againstId: string;
  againstRole: string;
  /** The shared run of words, for the redraft instruction. */
  shared: string;
  /** True when the echoed surface is the one this piece was generated beside. */
  wasPartner: boolean;
};

// Function words carry no topical signal, so a shared run of them is not an echo —
// "how to get the" repeating across two surfaces means nothing. Kept small and generic
// on purpose: a long stoplist starts making topical decisions.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "so", "then", "than", "that", "this",
  "these", "those", "of", "to", "in", "on", "at", "by", "for", "with", "from", "as",
  "is", "are", "was", "were", "be", "been", "being", "it", "its", "you", "your",
  "i", "my", "we", "our", "they", "their", "he", "she", "his", "her",
  "do", "does", "did", "have", "has", "had", "will", "would", "can", "could",
  "not", "no", "yes", "up", "out", "about", "into", "over", "just", "how", "what",
  "when", "why", "who", "which", "there", "here", "all", "any", "more", "most",
]);

/**
 * Lowercase, strip punctuation, drop stopwords. Returns content words in order.
 *
 * Punctuation is stripped by an explicit character class rather than a Unicode property
 * escape (\p{L}) — this project's tsconfig targets ES5, where \p is a compile error, and
 * a class also keeps accented letters intact instead of shredding them into separate
 * words, which a naive [^a-z0-9] would do.
 */
export function contentWords(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()"'?\[\]<>|\\+…—–’“”]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w));
}

function runs(words: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(" "));
  return out;
}

/**
 * DECK-WIDE echo check.
 *
 * ⚠️ DECK-WIDE, NOT PAIRWISE — and this is the whole point. Generation pairs a body with
 * one headline, but publishing RECOMBINES the surfaces: any headline in the set can ship
 * beside any body. Checking a body only against the headline it happened to be generated
 * with proves nothing about the ad that actually runs. So every opening is checked against
 * EVERY target surface in the deck.
 */
export function findDeckEchoes(
  surfaces: readonly EchoSurface[],
  opts?: {
    minRun?: number;
    openingWords?: number;
    openingRoles?: readonly string[];
    targetRoles?: readonly string[];
  },
): EchoFinding[] {
  const minRun = opts?.minRun ?? ANTI_ECHO_DEFAULTS.minRun;
  const openingWords = opts?.openingWords ?? ANTI_ECHO_DEFAULTS.openingWords;
  const openingRoles = opts?.openingRoles ?? ["body"];
  // "image_hook" is listed NOW, before the image sprint exists. Nothing emits that role
  // yet, so it is inert — and the day the compositor emits its own hook line, this file
  // does not change at all.
  const targetRoles = opts?.targetRoles ?? ["headline", "image_hook"];

  const targets = surfaces
    .filter((s) => targetRoles.includes(s.role))
    .map((s) => ({ ...s, words: contentWords(s.text) }));

  const findings: EchoFinding[] = [];
  for (const s of surfaces) {
    if (!openingRoles.includes(s.role)) continue;
    const opening = contentWords(s.text).slice(0, openingWords);
    const openingRuns = runs(opening, minRun);
    if (openingRuns.length === 0) continue;
    for (const t of targets) {
      if (t.id === s.id) continue;
      const targetRuns = new Set(runs(t.words, minRun));
      const shared = openingRuns.find((r) => targetRuns.has(r));
      if (shared) {
        findings.push({
          id: s.id, role: s.role, againstId: t.id, againstRole: t.role, shared,
          wasPartner: s.partnerId != null && String(s.partnerId) === String(t.id),
        });
        break;      // one finding per opening is enough to trigger one redraft
      }
    }
  }
  return findings;
}

// ─── 4. Trim to the band ─────────────────────────────────────────────────────

/**
 * Cut a collision-free set down to the band ceiling, KEEPING THE MOST-DISTINCT.
 *
 * "Most distinct" = for each piece, its WEAKEST comparison against any other survivor
 * (the fewest axes it differs by from its nearest neighbour). Drop the piece whose
 * weakest comparison is the weakest in the set — the one sitting closest to a collision —
 * and repeat. Ties go to the later item, same reproducible rule as eviction.
 *
 * This is why the trim happens HERE and not by generating fewer: the gate needs a surplus
 * to reject from, and choosing which surplus to drop requires knowing how separated
 * everything is, which is only knowable once it exists.
 */
/**
 * 🔴 SURFACE-AWARE. THE FIRST CUT WAS NOT, AND IT PRODUCED AN UNSHIPPABLE DECK.
 *
 * On the live run (2026-08-07, adSet vO1S7PVlm6G6EM76qYMX2) this kept **11 headlines and
 * 1 body** — verified by direct query. Maximising pairwise separation is blind to what a
 * piece IS, and headlines carried more format variety, so they won every comparison. An ad
 * needs a headline AND a body; a deck of eleven headlines and one body is safe under the
 * 2-of-4 rule and cannot be shipped.
 *
 * TARGET COMPOSITION: an EVEN SPLIT across the surfaces present, allocated round-robin.
 * At band max 12 with both surfaces plentiful that is **6 headlines / 6 bodies**. Where one
 * surface has fewer survivors than its share, the remainder flows to the other rather than
 * being wasted — so a run that lost most of its bodies still fills the band with headlines
 * instead of shipping a short deck, and the composition is reported either way.
 *
 * WITHIN a surface the original rule is unchanged: drop the piece sitting closest to a
 * collision (weakest comparison against any other survivor), ties to the later item, so the
 * result stays reproducible. Separation still decides WHICH pieces survive; it no longer
 * decides HOW MANY of each kind.
 */
export function trimToBand<TId>(
  items: Array<GateItem<TId>>,
  max: number,
): { keep: Array<GateItem<TId>>; trimmed: Array<GateItem<TId>> } {
  if (items.length <= max) return { keep: [...items], trimmed: [] };

  const surfaces: string[] = [];
  const countBySurface = new Map<string, number>();
  for (const it of items) {
    if (!countBySurface.has(it.surface)) { surfaces.push(it.surface); countBySurface.set(it.surface, 0); }
    countBySurface.set(it.surface, countBySurface.get(it.surface)! + 1);
  }

  // Round-robin quota: one slot to each surface in turn until the band is full or a
  // surface runs out. Even by construction; slack flows to whoever still has pieces.
  const quota = new Map<string, number>(surfaces.map((s) => [s, 0]));
  let remaining = Math.min(max, items.length);
  let progressed = true;
  while (remaining > 0 && progressed) {
    progressed = false;
    for (const s of surfaces) {
      if (remaining <= 0) break;
      const have = quota.get(s)!;
      if (have < countBySurface.get(s)!) { quota.set(s, have + 1); remaining--; progressed = true; }
    }
  }

  const alive = items.map((it, index) => ({ it, index, dead: false }));
  const trimmed: Array<GateItem<TId>> = [];
  const liveCount = (s: string) => alive.filter((a) => !a.dead && a.it.surface === s).length;

  for (;;) {
    const over = surfaces.filter((s) => liveCount(s) > quota.get(s)!);
    if (over.length === 0) break;
    const live = alive.filter((a) => !a.dead);
    const candidates = live.filter((a) => over.includes(a.it.surface));
    let worstIndex = -1;
    let worstMin = Infinity;
    for (const a of candidates) {
      let min = Infinity;
      for (const b of live) {
        if (b.index === a.index) continue;
        min = Math.min(min, comparePair(a.it.labels, b.it.labels).differingCount);
      }
      if (min < worstMin || (min === worstMin && a.index > worstIndex)) {
        worstMin = min;
        worstIndex = a.index;
      }
    }
    if (worstIndex < 0) break;
    alive[worstIndex].dead = true;
    trimmed.push(alive[worstIndex].it);
  }

  return { keep: alive.filter((a) => !a.dead).map((a) => a.it), trimmed };
}

// ─── The ledger ──────────────────────────────────────────────────────────────

/**
 * no_move_available     — the simulator found no combination of movable axes that clears
 *                         the rule. The correct, honest outcome; expected on Node 6 where
 *                         format cannot move.
 * regenerate_failed     — the model returned nothing, or the redraft failed the compliance
 *                         gate on every attempt.
 * redraft_still_collapsed — a redraft came back but still collided with a survivor.
 */
export type DropReason = "no_move_available" | "regenerate_failed" | "redraft_still_collapsed";

export type GateLedger = {
  node: string;
  band: BudgetBand;
  bandMax: number;
  populationSize: number;
  excludedCount: number;
  collapsingPairsBefore: number;
  collapseRateBefore: number;
  collapsingPairsAfter: number;
  collapseRateAfter: number;
  evicted: Array<{ id: string; collisions: number; axis: string | null }>;
  recovered: Array<{ id: string; axis: string; value: string; attempt: number }>;
  /**
   * Why each drop happened. This is what separates an HONEST drop — no available axis move
   * can clear 2-of-4 — from the burn-the-cap defect fixed on 2026-08-07, where the gate kept
   * retrying an axis that could never separate the piece. Recorded rather than inferred,
   * because a proof harness cannot reconstruct a piece that was never persisted.
   */
  droppedAtCap: Array<{ id: string; axis: string | null; reason: DropReason }>;
  echoRewrites: Array<{ id: string; against: string; shared: string; attempt: number; wasPartner: boolean }>;
  echoUnfixed: Array<{ id: string; against: string; shared: string; wasPartner: boolean }>;
  trimmed: string[];
  keptCount: number;
  /** Kept rows by surface — the shippability check the first cut had no way to see. */
  keptBySurface: Record<string, number>;
  /**
   * Per-surface detail. Distinctness is judged WITHIN a surface (settled 2026-08-08), so the
   * aggregate pair counts above are the SUM of these — never a cross-surface comparison. A
   * headline and a body are two surfaces of ONE ad and are meant to be coherent; counting
   * them as a collapsing pair measured the wrong thing and starved the body surface.
   */
  bySurface: Record<string, SurfaceLedger>;
  /** Surfaces that finished below their band floor. Empty is the shippable case. */
  surfacesBelowFloor: string[];
};

export function emptyLedger(node: string, band: BudgetBand): GateLedger {
  return {
    node,
    band,
    bandMax: bandMax(band),
    populationSize: 0,
    excludedCount: 0,
    collapsingPairsBefore: 0,
    collapseRateBefore: 0,
    collapsingPairsAfter: 0,
    collapseRateAfter: 0,
    evicted: [],
    recovered: [],
    droppedAtCap: [],
    echoRewrites: [],
    echoUnfixed: [],
    trimmed: [],
    keptCount: 0,
    keptBySurface: {},
    bySurface: {},
    surfacesBelowFloor: [],
  };
}

/** Human-readable ledger. Printed by the proof harness; logged in production. */
export function formatLedger(l: GateLedger): string {
  const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "n/a");
  const lines = [
    `── P.D.A.F. DISTINCTNESS GATE — ${l.node} ──`,
    `population ${l.populationSize} (excluded ${l.excludedCount} link surfaces) · band ${l.band} (max ${l.bandMax})`,
    `collapse BEFORE: ${l.collapsingPairsBefore} pairs (${pct(l.collapseRateBefore)})`,
    `collapse AFTER:  ${l.collapsingPairsAfter} pairs (${pct(l.collapseRateAfter)})`,
    `evicted ${l.evicted.length} · recovered ${l.recovered.length} · dropped at cap ${l.droppedAtCap.length} · trimmed ${l.trimmed.length} · KEPT ${l.keptCount}`,
    `KEPT COMPOSITION: ${Object.entries(l.keptBySurface).map(([k, v]) => `${k} ${v}`).join(" · ") || "(none)"}`,
  ];
  // Per-surface is the shippability view. The aggregate above can look healthy while one
  // surface sits at a single row — which is exactly what the shared band produced.
  const surfaceRows = Object.values(l.bySurface);
  if (surfaceRows.length > 0) {
    lines.push("PER SURFACE (distinctness is judged WITHIN a surface):");
    for (const s of surfaceRows) {
      lines.push(
        `  ${s.surface.padEnd(12)} pop ${String(s.populationSize).padStart(3)} · ` +
        `collapse ${s.collapsingPairsBefore} (${pct(s.collapseRateBefore)}) -> ${s.collapsingPairsAfter} (${pct(s.collapseRateAfter)}) · ` +
        `evicted ${s.evicted} recovered ${s.recovered} dropped ${s.dropped} trimmed ${s.trimmed} · ` +
        `KEPT ${s.kept}/band ${s.bandMin}-${s.bandMax} ${s.meetsFloor ? "✅" : "🔴 BELOW FLOOR"}`,
      );
    }
    lines.push(
      l.surfacesBelowFloor.length === 0
        ? "  ✅ every surface is at or above its floor — the deck is shippable on composition."
        : `  🔴 UNSHIPPABLE: ${l.surfacesBelowFloor.join(", ")} below floor. A deck cannot ship a surface that thin.`,
    );
  }
  for (const e of l.evicted) lines.push(`  evicted   ${e.id} — ${e.collisions} collision(s), axis to move: ${e.axis ?? "none available"}`);
  for (const r of l.recovered) lines.push(`  recovered ${r.id} — moved ${r.axis} -> "${String(r.value).slice(0, 48)}" on attempt ${r.attempt}`);
  for (const d of l.droppedAtCap) lines.push(`  DROPPED   ${d.id} — ${d.reason === "no_move_available" ? "NO available axis move clears 2-of-4 (honest drop)" : d.reason === "regenerate_failed" ? "the redraft never came back clean" : "the redraft still collapsed"} [axis sought: ${d.axis ?? "none"}]`);
  for (const e of l.echoRewrites) lines.push(`  echo-fix  ${e.id} — echoed ${e.against} ("${e.shared}")${e.wasPartner ? " [its OWN generation partner]" : " [a NON-PARTNER headline — pairwise checking would have MISSED this]"}, rewritten on attempt ${e.attempt}`);
  for (const e of l.echoUnfixed) lines.push(`  echo-LEFT ${e.id} — still echoes ${e.against} ("${e.shared}") after the cap`);
  for (const t of l.trimmed) lines.push(`  trimmed   ${t}`);
  return lines.join("\n");
}

// ─── The orchestrator ────────────────────────────────────────────────────────

export type RegenerateFn<TId> = (args: {
  item: GateItem<TId>;
  /**
   * The axis moves to apply TOGETHER. Usually one; two when no single axis can clear the
   * 2-of-4 rule against the surviving deck. The caller must write EVERY move into the
   * prompt and stamp every one on the row — an axis that labels output without changing it
   * is the fake diversity this gate exists to remove.
   */
  moves: Array<{ dimension: PdafDimension; value: string }>;
  attempt: number;
}) => Promise<GateItem<TId> | null>;

export type EchoRewriteFn<TId> = (args: {
  item: GateItem<TId>;
  finding: EchoFinding;
  avoidPhrases: string[];
  attempt: number;
}) => Promise<GateItem<TId> | null>;

/**
 * Run the whole gate.
 *
 * `regenerate` and `rewriteEcho` are supplied by the calling node, because only the node
 * knows how to draft one of its own pieces. Both MUST return a candidate that has already
 * passed the compliance gate, or null — a distinctness redraft that reintroduces a policy
 * violation must never reach the deck, and the two gates are not allowed to disagree.
 *
 * THE CAP IS SHARED. COMPLIANCE_RETRY_MAX_ATTEMPTS, not a new constant. Each attempt
 * re-gates its own output, so a redraft that still collapses is discarded rather than kept,
 * and a piece that exhausts the cap is DROPPED — never padded, never waved through. A
 * thinner honest deck beats a full deck with collisions in it.
 */
export async function runDistinctnessGate<TId>(args: {
  node: string;
  items: Array<GateItem<TId>>;
  pools: AxisPools;
  band?: BudgetBand | null;
  /**
   * Per-surface band overrides. Unset surfaces take the resolved global band. Node 7 caps
   * `image_hook` at the number of images the deck will actually render — a hook with no
   * picture to sit on is not a shippable asset.
   */
  surfaceBands?: Record<string, SurfaceBandOverride>;
  /**
   * Per-surface pool overrides, merged over `pools`. Node 7 uses this to take `format` off
   * the image hook's movable axes: a hook's format IS its surface, so moving it stamps a
   * body/headline taxonomy (`pain_agitation`, `story`) onto a hook row and describes it
   * with a vocabulary that does not apply.
   */
  surfacePools?: Record<string, Partial<AxisPools>>;
  regenerate: RegenerateFn<TId>;
  rewriteEcho?: EchoRewriteFn<TId>;
  antiEcho?: { minRun?: number; openingRoles?: readonly string[]; targetRoles?: readonly string[] };
  /** Skip the band trim (the proof harness measures with it off). Default false. */
  skipTrim?: boolean;
}): Promise<{ kept: Array<GateItem<TId>>; excluded: Array<GateItem<TId>>; ledger: GateLedger }> {
  const band = resolveBudgetBand(args.band);
  const ledger = emptyLedger(args.node, band);
  const { population, excluded } = partitionPopulation(args.items);
  ledger.populationSize = population.length;
  ledger.excludedCount = excluded.length;

  // ── Group by surface. THIS IS THE CHANGE. ─────────────────────────────────
  // Distinctness is judged WITHIN a surface, never across (settled 2026-08-08). Meta
  // collapses whole ADS, and an ad is the fused triple of image text, headline and body —
  // so two headlines competing is a real signal, while a headline "colliding" with a body
  // it will only ever ship ALONGSIDE is not. Comparing across surfaces made three surfaces
  // fight for one pool of distinct cells and starved the largest of them.
  const surfaces: string[] = population
    .map((p) => p.surface)
    .filter((s, i, a) => a.indexOf(s) === i);
  // Returns tuples rather than a Map: `for…of` over a Map trips TS2802 under this repo's
  // compiler target, which is a pre-existing constraint and not worth a config change here.
  const groupsOf = (items: Array<GateItem<TId>>): Array<[string, Array<GateItem<TId>>]> =>
    surfaces.map((s) => [s, items.filter((i) => i.surface === s)]);
  const bandFor = (surface: string) => {
    const o = args.surfaceBands?.[surface];
    return { min: o?.min ?? bandMin(band), max: o?.max ?? bandMax(band) };
  };
  const poolsFor = (surface: string): AxisPools => ({
    ...args.pools,
    ...(args.surfacePools?.[surface] ?? {}),
  });

  const populationBySurface = groupsOf(population);
  for (const [surface, items] of populationBySurface) {
    const b = bandFor(surface);
    const bef = auditBatch(items.map((p) => ({ id: String(p.id), labels: p.labels })));
    ledger.bySurface[surface] = {
      surface,
      populationSize: items.length,
      bandMin: b.min,
      bandMax: b.max,
      collapsingPairsBefore: bef.collapsingPairs.length,
      collapseRateBefore: Number.isFinite(bef.collapseRate) ? bef.collapseRate : 0,
      collapsingPairsAfter: 0,
      collapseRateAfter: 0,
      evicted: 0, recovered: 0, dropped: 0, trimmed: 0, kept: 0,
      meetsFloor: false,
    };
    ledger.collapsingPairsBefore += bef.collapsingPairs.length;
  }
  // The aggregate rate is the population-weighted mean of the per-surface rates, so it stays
  // a rate rather than becoming a sum of fractions.
  ledger.collapseRateBefore = population.length
    ? Object.values(ledger.bySurface)
        .reduce((acc, s) => acc + s.collapseRateBefore * s.populationSize, 0) / population.length
    : 0;

  // ── evict + regenerate, capped — PER SURFACE ──────────────────────────────
  let survivors: Array<GateItem<TId>> = [];
  for (const [surface, items] of populationBySurface) {
    const sl = ledger.bySurface[surface];
    let kept: Array<GateItem<TId>>;
    let queue: Array<{ item: GateItem<TId>; eviction: Eviction<TId>; reason: DropReason }>;
    {
      const plan = planEvictions(items);
      kept = plan.keep;
      const byId = new Map(items.map((p) => [String(p.id), p]));
      queue = plan.evictions.map((e) => ({ item: byId.get(String(e.id))!, eviction: e, reason: "no_move_available" as DropReason }));
      sl.evicted = plan.evictions.length;
      for (const e of plan.evictions) ledger.evicted.push({ id: String(e.id), collisions: e.collisions, axis: e.axis });
    }

    const pools = poolsFor(surface);
    for (let attempt = 1; attempt <= COMPLIANCE_RETRY_MAX_ATTEMPTS && queue.length > 0; attempt++) {
      const stillFailing: typeof queue = [];
      // Sequential, not parallel: each redraft's target value depends on what the survivors
      // already carry, so two concurrent redrafts would both aim at the same empty slot and
      // land on top of each other.
      for (const { item, eviction } of queue) {
        // Simulated against THIS SURFACE'S survivors before any model call, so a piece is
        // only asked to redraft on a move that would actually separate it. null means no
        // combination of available axes can clear the rule — an honest drop.
        const suggestion = suggestReassignment(eviction, item, kept, pools);
        if (!suggestion) { stillFailing.push({ item, eviction, reason: "no_move_available" }); continue; }
        let candidate: GateItem<TId> | null = null;
        try {
          candidate = await args.regenerate({ item, moves: suggestion.moves, attempt });
        } catch { candidate = null; }
        if (!candidate) { stillFailing.push({ item, eviction, reason: "regenerate_failed" }); continue; }
        // Re-gate against this surface's survivors, or the redraft is discarded.
        const collides = kept.some((s) => comparePair(candidate!.labels, s.labels).collapses);
        if (collides) { stillFailing.push({ item, eviction, reason: "redraft_still_collapsed" }); continue; }
        kept.push(candidate);
        sl.recovered += 1;
        ledger.recovered.push({
          id: String(item.id),
          axis: suggestion.moves.map((m) => m.dimension).join("+"),
          value: suggestion.moves.map((m) => m.value).join(" | "),
          attempt,
        });
      }
      queue = stillFailing;
    }
    sl.dropped = queue.length;
    for (const { item, eviction, reason } of queue) {
      ledger.droppedAtCap.push({ id: String(item.id), axis: eviction.axis, reason });
    }
    survivors.push(...kept);
  }

  // ── deck-wide anti-echo ───────────────────────────────────────────────────
  if (args.rewriteEcho) {
    for (let attempt = 1; attempt <= COMPLIANCE_RETRY_MAX_ATTEMPTS; attempt++) {
      const findings = findDeckEchoes(
        survivors.map((s) => ({ id: String(s.id), role: s.surface, text: s.text, partnerId: s.partnerId ?? null })),
        args.antiEcho,
      );
      if (findings.length === 0) break;
      const byId = new Map(survivors.map((s) => [String(s.id), s]));
      // Every target surface's words are what a rewrite must avoid — not just the one it
      // happened to echo, or the redraft simply lands on a different headline.
      const targetRoles = args.antiEcho?.targetRoles ?? ["headline", "image_hook"];
      const avoidPhrases = survivors
        .filter((s) => targetRoles.includes(s.surface))
        .map((s) => s.text);
      let changed = false;
      for (const f of findings) {
        const item = byId.get(f.id);
        if (!item) continue;
        let candidate: GateItem<TId> | null = null;
        try {
          candidate = await args.rewriteEcho({ item, finding: f, avoidPhrases, attempt });
        } catch { candidate = null; }
        if (!candidate) continue;
        const i = survivors.findIndex((s) => String(s.id) === f.id);
        if (i >= 0) { survivors[i] = candidate; changed = true; }
        ledger.echoRewrites.push({ id: f.id, against: f.againstId, shared: f.shared, attempt, wasPartner: f.wasPartner });
      }
      if (!changed) break;
    }
    ledger.echoUnfixed = findDeckEchoes(
      survivors.map((s) => ({ id: String(s.id), role: s.surface, text: s.text, partnerId: s.partnerId ?? null })),
      args.antiEcho,
    ).map((f) => ({ id: f.id, against: f.againstId, shared: f.shared, wasPartner: f.wasPartner }));
  }

  // ── trim — PER SURFACE, to that surface's own ceiling ─────────────────────
  // A shared ceiling meant a surface with many survivors could consume the whole allowance
  // and leave another at one row. Each surface is now cut to its own max, so no surface can
  // spend another's slots.
  if (!args.skipTrim) {
    const trimmed: Array<GateItem<TId>> = [];
    for (const [surface, items] of groupsOf(survivors)) {
      const t = trimToBand(items, bandFor(surface).max);
      trimmed.push(...t.keep);
      const sl = ledger.bySurface[surface];
      if (sl) sl.trimmed = t.trimmed.length;
      for (const x of t.trimmed) ledger.trimmed.push(String(x.id));
    }
    survivors = trimmed;
  }

  // ── after, per surface then aggregated ────────────────────────────────────
  for (const [surface, items] of groupsOf(survivors)) {
    const sl = ledger.bySurface[surface];
    if (!sl) continue;
    const aft = auditBatch(items.map((s) => ({ id: String(s.id), labels: s.labels })));
    sl.collapsingPairsAfter = aft.collapsingPairs.length;
    sl.collapseRateAfter = Number.isFinite(aft.collapseRate) ? aft.collapseRate : 0;
    sl.kept = items.length;
    sl.meetsFloor = items.length >= sl.bandMin;
    ledger.collapsingPairsAfter += aft.collapsingPairs.length;
  }
  ledger.collapseRateAfter = survivors.length
    ? Object.values(ledger.bySurface)
        .reduce((acc, s) => acc + s.collapseRateAfter * s.kept, 0) / survivors.length
    : 0;
  ledger.surfacesBelowFloor = Object.values(ledger.bySurface)
    .filter((s) => !s.meetsFloor)
    .map((s) => s.surface);
  ledger.keptCount = survivors.length;
  ledger.keptBySurface = survivors.reduce((acc, s2) => {
    acc[s2.surface] = (acc[s2.surface] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return { kept: survivors, excluded, ledger };
}
