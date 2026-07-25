/**
 * conceptValidator.ts — STRUCTURAL validation of a generated concept set.
 *
 * Mirrors the shape of validateOfferFabricationPatterns / validateBonusFabricationPatterns
 * (server/_core/validator.ts): pattern hits → a failContext string for the generate→validate→retry loop.
 *
 * SCOPE (deliberate): STRUCTURE ONLY. This does NOT cross-check concept desires against the ICP
 * corpus for fabrication — that anti-fabrication check is DEFERRED until the ICP grounding sprint,
 * because the ICP feeding this is knowingly fabricated and cross-checking against fabricated source
 * data would be validation theatre. Add the ICP-corpus check only after ICP grounding ships.
 *
 * Structural rules enforced (from EXECUTION_BRIEF §2):
 *   - every concept carries all four ad-copy payload fields (hook, headline, shortText, longText)
 *   - awareness ∈ the 5 Schwartz stages; hookPattern ∈ the 6 named patterns
 *   - the headline carries a DIFFERENT signal from the hook (never a verbatim repeat)
 *   - the set is DISTINCT on desire × awareness (the intended fan-out is "one person, many angles")
 */

import { isAwarenessStage, isHookPattern } from "./conceptAxis";

export interface RawConcept {
  desire?: string;
  awareness?: string;
  hookPattern?: string;
  hook?: string;
  headline?: string;
  shortText?: string;
  longText?: string;
}

export type ConceptStructureClass =
  | "concept_missing_field"
  | "concept_bad_awareness"
  | "concept_bad_hook_pattern"
  | "concept_headline_equals_hook"
  | "concept_duplicate_axis";

export interface ConceptStructureHit {
  classId: ConceptStructureClass;
  description: string;
  location: string;
}

export type ConceptStructureResult =
  | { ok: true }
  | { ok: false; hits: ConceptStructureHit[]; failContext: string };

const REQUIRED_FIELDS: Array<keyof RawConcept> = ["hook", "headline", "shortText", "longText"];

/** Normalize a string for cosmetic-insensitive comparison (case, whitespace collapse). */
function norm(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildFailContext(hits: ConceptStructureHit[], maxHits = 8): string {
  if (hits.length === 0) return "";
  const top = hits.slice(0, maxHits);
  const lines = top.map((h) => `- ${h.location}: ${h.description}`);
  const more =
    hits.length > maxHits
      ? `\n(plus ${hits.length - maxHits} additional structural issue${hits.length - maxHits === 1 ? "" : "s"} not shown)`
      : "";
  return `Your previous concept set failed structural validation and must be regenerated:\n${lines.join("\n")}${more}\n\nRegenerate the full set so that: every concept has a non-empty hook, headline, shortText and longText; awareness is one of the 5 stages (unaware, problem_aware, solution_aware, product_aware, most_aware); hookPattern is one of the 6 patterns (problem_first, founder_authenticity, social_proof, aspirational_transformation, meme_humor, data_chart); the headline carries a DIFFERENT signal from the hook (mechanism or outcome), never a repeat; and no two concepts share the same desire × awareness pair — vary the desire, the awareness stage, or both so every concept is genuinely distinct.`;
}

/**
 * Validate the STRUCTURE of a generated concept set. Returns ok=true when structurally sound,
 * ok=false with hits + a failContext shaped for prompt-injection on the next retry attempt.
 */
export function validateConceptSetStructure(concepts: RawConcept[]): ConceptStructureResult {
  const hits: ConceptStructureHit[] = [];

  concepts.forEach((c, i) => {
    const at = `concept[${i}]`;

    for (const field of REQUIRED_FIELDS) {
      if (typeof c[field] !== "string" || (c[field] as string).trim().length === 0) {
        hits.push({
          classId: "concept_missing_field",
          description: `missing or empty required field "${field}"`,
          location: `${at}.${field}`,
        });
      }
    }

    if (!isAwarenessStage(c.awareness)) {
      hits.push({
        classId: "concept_bad_awareness",
        description: `awareness "${c.awareness ?? ""}" is not one of the 5 Schwartz stages`,
        location: `${at}.awareness`,
      });
    }

    if (!isHookPattern(c.hookPattern)) {
      hits.push({
        classId: "concept_bad_hook_pattern",
        description: `hookPattern "${c.hookPattern ?? ""}" is not one of the 6 named patterns`,
        location: `${at}.hookPattern`,
      });
    }

    if (c.hook && c.headline && norm(c.hook) === norm(c.headline)) {
      hits.push({
        classId: "concept_headline_equals_hook",
        description: "headline repeats the hook — it must carry a different signal (mechanism or outcome)",
        location: `${at}.headline`,
      });
    }
  });

  // Set-level: distinct on desire × awareness.
  const seen = new Map<string, number>();
  concepts.forEach((c, i) => {
    const key = `${norm(c.desire)}|${norm(c.awareness)}`;
    if (seen.has(key)) {
      hits.push({
        classId: "concept_duplicate_axis",
        description: `duplicates the desire × awareness pair of concept[${seen.get(key)}] — the set must be distinct`,
        location: `concept[${i}]`,
      });
    } else {
      seen.set(key, i);
    }
  });

  if (hits.length === 0) return { ok: true };
  return { ok: false, hits, failContext: buildFailContext(hits) };
}
