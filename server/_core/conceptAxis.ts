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
// Concepts span ALL 5 stages: the banked research shows diversity earns separate Meta Entity-IDs,
// and there is no cold-narrowing rule in the data (docs/andromeda/landing-page-research/).
export const AWARENESS_STAGES = [
  "unaware",
  "problem_aware",
  "solution_aware",
  "product_aware",
  "most_aware",
] as const;
export type AwarenessStage = (typeof AWARENESS_STAGES)[number];

// ─── Hook patterns (the 6 named patterns from EXECUTION_BRIEF §2 + the 7th, added this session) ──
// The 7th — direct_offer_urgency — is the Most-Aware close. It is the HIGHEST Meta-compliance-risk hook:
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

// ─── Hook→awareness mapping — ✅ APPROVED (grounded), 2026-07-25 ──────────────────────────────────
//
// SOURCE: Arfeen's NotebookLM run over his own research corpus, corroborated by the banked ICP docs on
// the two stages where the corpus and the run matched INDEPENDENTLY:
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
