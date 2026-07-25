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

// ─── Hook patterns (the 6 named patterns from EXECUTION_BRIEF §2) ─────────────
export const HOOK_PATTERNS = [
  "problem_first",
  "founder_authenticity",
  "social_proof",
  "aspirational_transformation",
  "meme_humor",
  "data_chart",
] as const;
export type HookPattern = (typeof HOOK_PATTERNS)[number];

// ─── Concept count ───────────────────────────────────────────────────────────
// Start at 8 (locked). Brief §2 says build to a range (5–12), scale with spend — kept as a single
// tunable constant, not false precision.
export const DEFAULT_CONCEPT_COUNT = 8;

// ─── CANDIDATE hook→awareness mapping — ⚠️ PENDING ARFEEN APPROVAL, DO NOT TREAT AS FINAL ──────
//
// The brief ASSERTS "each [hook pattern] maps to an awareness stage" (§2) but NEVER specifies the
// mapping. This candidate is DERIVED from direct-response marketing sources (Schwartz's stages ×
// ad-hook practice), NOT invented — sources cited below. It is deliberately kept as editable config:
// generation reads it as guidance, it is NOT hardcoded into any prompt string. Arfeen approves/edits
// the mapping before it is treated as final.
//
// Sources (CLAUDE §15 web fallback; marketingskills repo not cloned locally):
//   - Schwartz 5 stages: selzee.com/eugene-schwartz-5-levels-of-awareness
//   - Hook-by-stage ad mapping: hawky.ai/blog/customer-awareness-stages
//   - UGC-ad stage hooks: sparkugc.com/resources/stages-of-awareness-ugc-ads
//
// Each stage lists the PRIMARY well-fit hook pattern first; secondary patterns are allowed because
// hooks are not stage-exclusive (e.g. Founder/Authenticity spans Unaware→Problem-Aware).
export const CANDIDATE_HOOK_AWARENESS_MAP: {
  approved: false;
  map: Record<AwarenessStage, { primary: HookPattern; secondary: HookPattern[] }>;
} = {
  approved: false, // flips to true only when Arfeen signs off; generation may guard on this.
  map: {
    // Unaware — pull them into a world they didn't know existed: curiosity / pattern-interrupt / story.
    unaware: { primary: "meme_humor", secondary: ["founder_authenticity"] },
    // Problem-Aware — validate + agitate the lived pain; founder-story videos that mirror the frustration.
    problem_aware: { primary: "problem_first", secondary: ["founder_authenticity"] },
    // Solution-Aware — introduce the better way / the transformation the mechanism unlocks.
    solution_aware: { primary: "aspirational_transformation", secondary: ["data_chart"] },
    // Product-Aware — verifiable evidence: case studies, testimonials, objection-handling.
    product_aware: { primary: "social_proof", secondary: ["data_chart"] },
    // Most-Aware — hard numeric proof + a final reason to act; the specific-numbers close.
    most_aware: { primary: "data_chart", secondary: ["social_proof"] },
  },
};

export function isAwarenessStage(v: unknown): v is AwarenessStage {
  return typeof v === "string" && (AWARENESS_STAGES as readonly string[]).includes(v);
}
export function isHookPattern(v: unknown): v is HookPattern {
  return typeof v === "string" && (HOOK_PATTERNS as readonly string[]).includes(v);
}
