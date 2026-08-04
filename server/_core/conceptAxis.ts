/**
 * conceptAxis.ts — the P.D.A. concept axis vocabulary for Andromeda per-concept fan-out.
 *
 * Concepts are "one person, many angles": N concepts vary Desire × Awareness WITHIN one ICP
 * (persona fixed to the ICP). See docs/andromeda/EXECUTION_BRIEF.md §2/§8.
 *
 * This module holds ONLY the vocabulary + config — no generation, no validation logic. The
 * awareness enum, hook-pattern enum, and the candidate hook→awareness mapping live here so the
 * schema, generator, and validator share one source of truth, and so the mapping stays CONFIG
 * (approvable/editable) rather than baked into generation code.
 */

// ─── Awareness (Eugene Schwartz's 5 stages) ──────────────────────────────────
// The 5 stages themselves are fixed. How a BATCH is distributed across them is NOT even —
// see COLD_WEIGHTED_STAGE_MIX below.
//
// ⚠️ SUPERSEDES an earlier comment here which read: "Concepts span ALL 5 stages … there is no
// cold-narrowing rule in the data (docs/andromeda/landing-page-research/)." That was true of the
// landing-page research it cited, but the IMAGE research banked 2026-08-03 does carry a concrete
// distribution — see the citation on COLD_WEIGHTED_STAGE_MIX. The stages are still all VALID; what
// changed is that the default batch no longer spreads across them evenly.
export const AWARENESS_STAGES = [
  "unaware",
  "problem_aware",
  "solution_aware",
  "product_aware",
  "most_aware",
] as const;
export type AwarenessStage = (typeof AWARENESS_STAGES)[number];

// ─── Hook patterns (the 6 named patterns from EXECUTION_BRIEF §2 + the 7th) ──
// The 7th — direct_offer_urgency — is the Most-Aware close. It was added in-session, but the research
// banked on 2026-08-03 shows it is GROUNDED, not invented: docs/andromeda/script-research/Meta Ads
// Creative Strategy 2026… §6 states the six patterns are ineffective at Most-Aware because those users
// are "waiting for the right timing or deal". It is the HIGHEST Meta-compliance-risk hook:
// it must express only REAL urgency (a genuine coach-supplied deadline/offer), never fabricated scarcity
// or fake countdowns. Its output is screened through the existing complianceFilter guards
// (server/lib/complianceFilter.ts — income REJECT + scarcity PIVOT patterns) via screenConceptCompliance.
export const HOOK_PATTERNS = [
  "problem_first",
  "founder_authenticity",
  "social_proof",
  "aspirational_transformation",
  "meme_humor",
  "data_chart",
  "direct_offer_urgency",
] as const;
export type HookPattern = (typeof HOOK_PATTERNS)[number];

// ─── Concept count ───────────────────────────────────────────────────────────
// Start at 8 (locked). Brief §2 says build to a range (5–12), scale with spend — kept as a single
// tunable constant, not false precision.
export const DEFAULT_CONCEPT_COUNT = 8;

// ─── Awareness distribution across a batch — COLD-WEIGHTED ───────────────────
//
// SOURCE (primary, and it is the reports' actual SUBJECT rather than an aside):
//   docs/andromeda/prospecting-research/Meta Ads 2026_ Prospecting Campaign Ad Concept
//     Distribution.md §3 — "The Proportional Weighting Model" table, with counts AND percentages.
//   docs/andromeda/prospecting-research/Meta Ads 2026_ The Definitive B2C Prospecting & Creative
//     Architecture Playbook.md §4 — "The 8-Concept Prospecting Batch Allocation Strategy",
//     INDEPENDENTLY restating the identical split.
//
//     unaware 3 · problem_aware 3 · solution_aware 1 · product_aware 1 · most_aware 0
//
// Report 1 §3 restates it in prose two ways and both reconcile: "Weighting 75% of assets toward the
// top of the funnel (Unaware and Problem-Aware)" (3+3 = 6/8) and "the 25% warmer weighting"
// (1+1 = 2/8). Report 1 §2 is explicit on the exclusion: "By representing 4 out of 5 Schwartz stages
// (excluding 'Most Aware' for cold traffic)"; the table's own note reads "Excluded from cold broad to
// avoid cannibalization."
//
// ⚠️ THE 25% WARMER TAIL IS LOAD-BEARING — do not zero solution_aware/product_aware to buy more
// top-funnel reach. Report 1 §3: it is "a vital safeguard against Entity-ID pigeonholing. Without
// these warmer signals, the algorithm may cluster the account into a narrow intent segment, leading
// to accelerated creative fatigue and a collapse in delivery volume."
//
// ── SUPERSEDES (2026-08-04, same day) ────────────────────────────────────────
// This constant was first built as 1/2/3/2/0 from the Entity-ID Protocol §3 "Somatic Anxiety Relief"
// worked example (docs/andromeda/image-research/). That was the only concrete figure available at
// the time, but it was an ILLUSTRATION inside a report about visual diversity — not a stated finding
// about batch allocation. The prospecting reports address allocation as their subject and agree with
// each other, so they win. Both old and new agree most_aware = 0; they differ sharply on the rest
// (the new split puts 75% in the top two stages where the old put 37.5%).
//
// ⚠️ COUNTER-EVIDENCE, still recorded rather than buried: Eugene Schwartz Awareness-Stage… §5
// (image-research) argues all stages should run simultaneously for a "Surround Sound Effect,
// capturing cold, warm, and hot prospects… without cannibalisation" — under which a most_aware slot
// is not wasted because Andromeda routes it to hot prospects itself. The corpus does not reconcile
// this. Two directly-on-topic reports now state the exclusion explicitly and attribute a mechanism to
// it (cannibalisation), which outweighs a general principle that names no allocation. Flagged.
//
// most_aware is NOT retired — it stays a valid stage, and its image-rule cells stay valid for a
// warm/retargeting batch. It simply gets no slot in the default cold-prospecting batch.
export const COLD_WEIGHTED_STAGE_MIX: Readonly<Record<AwarenessStage, number>> = {
  unaware: 3,
  problem_aware: 3,
  solution_aware: 1,
  product_aware: 1,
  most_aware: 0,
};

const COLD_MIX_TOTAL = Object.values(COLD_WEIGHTED_STAGE_MIX).reduce((a, b) => a + b, 0);

/**
 * The deterministic per-slot awareness plan for a batch of `count` concepts.
 *
 * At count = 8 this reproduces the Entity-ID Protocol §3 distribution exactly. Other counts are
 * apportioned from the same weights by largest-remainder, with ties broken toward the COLDER stage
 * (AWARENESS_STAGES is ordered coldest → hottest), preserving the cold weighting at any size.
 *
 * Slots are emitted round-robin rather than grouped, so consecutive concepts differ in stage — the
 * research's own worked example interleaves rather than clustering, and it gives the generator a
 * clearer per-slot instruction.
 *
 * Deterministic: same count always yields the same plan. No randomness, no model choice.
 */
export function awarenessPlanForCount(count: number): AwarenessStage[] {
  if (!Number.isFinite(count) || count <= 0) return [];

  // Largest-remainder apportionment over the cold-weighted mix.
  const exact = AWARENESS_STAGES.map((stage) => ({
    stage,
    ideal: (COLD_WEIGHTED_STAGE_MIX[stage] * count) / COLD_MIX_TOTAL,
  }));
  const alloc = new Map<AwarenessStage, number>(exact.map((e) => [e.stage, Math.floor(e.ideal)]));
  let remaining = count - Array.from(alloc.values()).reduce((a, b) => a + b, 0);

  // Only stages with non-zero weight may receive a remainder slot — otherwise most_aware (weight 0)
  // could pick one up at small counts and silently break the cold weighting.
  const byRemainder = exact
    .filter((e) => COLD_WEIGHTED_STAGE_MIX[e.stage] > 0)
    .map((e) => ({ ...e, frac: e.ideal - Math.floor(e.ideal) }))
    .sort((a, b) => b.frac - a.frac || AWARENESS_STAGES.indexOf(a.stage) - AWARENESS_STAGES.indexOf(b.stage));

  let i = 0;
  while (remaining > 0 && byRemainder.length > 0) {
    const pick = byRemainder[i % byRemainder.length].stage;
    alloc.set(pick, (alloc.get(pick) ?? 0) + 1);
    remaining--;
    i++;
  }

  // Round-robin emit, coldest-first each pass, so stages interleave instead of clustering.
  const plan: AwarenessStage[] = [];
  const left = new Map(alloc);
  while (plan.length < count) {
    let placedThisPass = false;
    for (const stage of AWARENESS_STAGES) {
      const n = left.get(stage) ?? 0;
      if (n > 0 && plan.length < count) {
        plan.push(stage);
        left.set(stage, n - 1);
        placedThisPass = true;
      }
    }
    if (!placedThisPass) break; // exhausted — defensive, cannot happen when totals agree
  }
  return plan;
}

// ─── Hook→awareness mapping — ✅ APPROVED (grounded), 2026-07-25 ──────────────────────────────────
//
// SOURCE (banked 2026-08-03, previously Downloads-only):
//   docs/andromeda/script-research/Meta Ads Creative Strategy 2026_ Mapping Hook Patterns to Schwartz
//   Awareness Stages.md — §2-§6 give the per-stage primary/secondary hooks implemented below verbatim.
// Corroborated by the banked ICP docs on the two stages where the corpus and the run matched INDEPENDENTLY:
//   - Problem-Aware → Problem-First  (docs/icp-research/The Psychology of the ICP §6: "Empathize with the
//     'Problem Pressure' and name the lived situation")
//   - Product-Aware → Social-Proof   (same §6: "Address 'Perceived Barriers' and provide validation/proof")
// The earlier web-derived candidate (hawky/selzee/sparkugc) is RETIRED — it was not grounded in Arfeen's data.
//
// Each stage lists the PRIMARY hook first; secondary is allowed because hooks are not stage-exclusive.
// CROSS-STAGE (preserve): Founder/Authenticity spans Problem/Solution-Aware; Data/Chart spans
// Unaware/Product-Aware; Social-Proof spans Solution/Product-Aware.
export const CANDIDATE_HOOK_AWARENESS_MAP: {
  approved: boolean;
  map: Record<AwarenessStage, { primary: HookPattern; secondary: HookPattern[] }>;
} = {
  approved: true, // grounded in Arfeen's corpus + corroborated on the 2 overlapping stages; signed off this session.
  map: {
    unaware: { primary: "meme_humor", secondary: ["data_chart"] },
    problem_aware: { primary: "problem_first", secondary: ["founder_authenticity"] },
    solution_aware: { primary: "aspirational_transformation", secondary: ["founder_authenticity"] },
    product_aware: { primary: "social_proof", secondary: ["data_chart"] },
    // Most-Aware — the 7th hook: a REAL coach-supplied deadline/offer, never fabricated scarcity.
    most_aware: { primary: "direct_offer_urgency", secondary: ["social_proof"] },
  },
};

export function isAwarenessStage(v: unknown): v is AwarenessStage {
  return typeof v === "string" && (AWARENESS_STAGES as readonly string[]).includes(v);
}
export function isHookPattern(v: unknown): v is HookPattern {
  return typeof v === "string" && (HOOK_PATTERNS as readonly string[]).includes(v);
}

// ─── Video-script LENGTH config ───────────────────────────────────────────────────────────────────
// SOURCE (banked 2026-08-03): docs/andromeda/script-research/Strategic Report_ Optimising Meta Video
// Ad Lengths for the 2026 AI Ecosystem.md
//
// DECISION: one length per concept, anchored SHORT / placement-safe. Meta Advantage+ auto-distributes ONE
// asset across Reels/Stories/Feed and decides per-user, so the short end runs cleanly everywhere. We store
// the FULL research-ideal range per stage (so the two-cut / long-Feed option can be enabled later WITHOUT a
// rebuild), but ACTIVE generation caps every stage to the placement-safe ceiling.
export const PLACEMENT_SAFE_CEILING_SECONDS = 30;

// TWO_CUT (short + long-Feed asset per placement, via Meta placement asset customization) is PARKED.
// When true, generation would emit a second research-ideal-length cut for Feed. Not built — config only.
export const TWO_CUT_ENABLED = false;

export interface AwarenessLength {
  /** Full research-ideal range (low, high) in seconds — stored for the parked long-Feed cut. */
  researchIdealSeconds: readonly [number, number];
  /** The ACTIVE length used NOW — capped to PLACEMENT_SAFE_CEILING_SECONDS. */
  activeSeconds: number;
}

export const LENGTH_BY_AWARENESS: Record<AwarenessStage, AwarenessLength> = {
  unaware: { researchIdealSeconds: [60, 90], activeSeconds: 30 },
  problem_aware: { researchIdealSeconds: [30, 60], activeSeconds: 30 },
  solution_aware: { researchIdealSeconds: [60, 90], activeSeconds: 30 },
  product_aware: { researchIdealSeconds: [15, 30], activeSeconds: 30 },
  most_aware: { researchIdealSeconds: [15, 15], activeSeconds: 15 },
};

export function activeLengthForStage(stage: AwarenessStage): number {
  return Math.min(LENGTH_BY_AWARENESS[stage].activeSeconds, PLACEMENT_SAFE_CEILING_SECONDS);
}

// Spoken word budget — the GROUNDED per-duration table from the 7 NotebookLM scriptwriting reports
// (banked 2026-08-03 at docs/andromeda/script-research/ — see its README for the per-report index)
// (Zizzo conservative range + JL max), replacing the old ~130-wpm formula which under-targeted and
// over-capped (30s gave target 65 / max 98, letting a 94-word script pass; reports want 75–85 / max 90).
// Scripts are written ~2–3s shy of the slot; pace ≈ 3 words/sec. Only 15s/30s are used operationally
// (activeLengthForStage caps there); 60s kept for completeness; other durations fall back to ~3 w/s.
const WORD_BUDGET_TABLE: Record<number, { min: number; target: number; max: number }> = {
  15: { min: 30, target: 35, max: 45 },
  30: { min: 75, target: 80, max: 90 },
  60: { min: 150, target: 160, max: 180 },
};

export function wordBudgetForSeconds(seconds: number): { min: number; target: number; max: number } {
  const table = WORD_BUDGET_TABLE[seconds];
  if (table) return table;
  // Fallback (non-standard durations): ~3 words/sec, written 2s shy of the slot, with a small tolerance band.
  const target = Math.round(Math.max(0, seconds - 2) * 3);
  return { min: Math.round(target * 0.85), target, max: Math.round(target * 1.15) };
}
