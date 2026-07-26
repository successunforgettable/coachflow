/**
 * ICP grounding — structural gate, R3 failure-mode labelling, and out-of-band provenance.
 *
 * Three jobs, deliberately separated because they have different failure semantics:
 *
 *  1. validateIcpStructure — a HARD gate. A structurally malformed ICP must never
 *     persist. Retried, and the generation fails if it never comes back clean.
 *     (An earlier prompt draft flattened the demographics object into six top-level
 *     keys on ~half of runs; nothing downstream would have caught that.)
 *
 *  2. validateIcpGrounding — R3's failure modes, run as a LABEL-and-persist check.
 *     Class-A violations (a named real person presented as fact) drive a regeneration
 *     retry; everything else is recorded, not rejected. "Inferred" is a legitimate
 *     terminal state: a coach with no client history genuinely has a hypothesis, and
 *     blocking them would break the product.
 *
 *  3. computeIcpProvenance — per-section stated / partial / inferred, stored OUT OF
 *     BAND. Never inline in the 17 text fields: every downstream generator string-
 *     interpolates those fields straight into its own prompt, so an inline marker
 *     would flow into ad copy and published landing pages.
 *
 * Traceability reuses bonusWordOverlap from the shipped bonus validator rather than
 * re-implementing the same idea a second time.
 *
 * NOTE (2026-07-26): demographics / mediaConsumption / influencers are no longer
 * generated. The Class-A checks below are kept and still run — they are cheap, they
 * are tested, and they guard the day a future ICP-powered tool repopulates those
 * dormant columns. Against a generated profile they simply find nothing, because
 * the fields are absent.
 */

import { bonusWordOverlap, bonusSignificantWords } from "./validator";
import {
  ICP_TEXT_SECTION_KEYS,
  ICP_DEMOGRAPHIC_KEYS,
  type ICPServiceInput,
  type ICPAngleInput,
  type ICPLadderAnswers,
  ICP_LADDER_KEYS,
} from "./icpPrompts";

// ── Types ────────────────────────────────────────────────────────────────────

export type IcpStructuralHit = { code: string; description: string; location: string };

export type IcpGroundingClass =
  | "icp_named_third_party"        // R3 mode 2/3 — a real person or brand asserted as fact
  | "icp_demographic_unsupported"  // R3 mode 3 — demographic filler the input cannot support
  | "icp_breadth"                  // R3 mode 1 — Cast-Iron Net
  | "icp_assumed_prior_evaluation"; // R3 mode 4 — Aspirational Fantasy / awareness mismatch

export type IcpGroundingHit = {
  classId: IcpGroundingClass;
  description: string;
  matched: string;
  location: string;
  /** Class-A violations drive a regeneration retry; the rest are labelled only. */
  retryable: boolean;
};

export type IcpProvenanceLabel = "stated" | "partial" | "inferred";

export type IcpProvenance = {
  /** Per-section label for the 14 generated sections (+ demographics on legacy rows). */
  perSection: Record<string, IcpProvenanceLabel>;
  /** Which laddered follow-ups the coach actually answered. */
  ladderAnswered: string[];
  /**
   * The coach's laddered answers, verbatim. Persisted so a later regenerate
   * RE-GROUNDS on their real input instead of silently reverting to the thin
   * service description. Coach-supplied text is real input and is not discardable.
   * Absent when nothing was answered.
   */
  ladderAnswers?: Record<string, string>;
  /** Significant-word count of the coach-supplied corpus this was built from. */
  corpusWords: number;
  /** R3 hits recorded at generation time (labels, not rejections). */
  hits: IcpGroundingHit[];
  /** Roll-up for a future UI badge; not currently surfaced to the coach. */
  overall: IcpProvenanceLabel;
  version: 1;
};

/**
 * Canonical demographics shape. snake_case is what every generator writes and what
 * every stored row holds. `summary` is the free-text "who they are" line the import
 * path supplies instead of structured keys — previously written as { ageRange: blob },
 * which no reader understood, so imported demographics were invisible everywhere.
 */
export type IcpDemographics = {
  age_range?: string;
  gender?: string;
  income_level?: string;
  education?: string;
  occupation?: string;
  location?: string;
  family_status?: string;
  summary?: string;
};

export type IcpValidationContext = {
  service: ICPServiceInput;
  ladder?: ICPLadderAnswers | null;
  angle?: ICPAngleInput | null;
};

// ── Demographics normalisation (sibling fix 3) ───────────────────────────────

/**
 * The generators emit snake_case (age_range); drizzle's $type declared camelCase
 * (ageRange); campaignExportFormatters read camelCase — so the demographics table
 * rendered EMPTY in every export of a generated ICP. autoMode's import path writes
 * a third shape again ({ ageRange: "<blob>" }).
 *
 * snake_case is what is actually stored in every existing row, so that is canonical.
 * This accepts any of the three shapes and returns the canonical one. Pure; safe on
 * legacy rows.
 */
const DEMO_ALIASES: Record<string, keyof IcpDemographics> = {
  agerange: "age_range",
  age_range: "age_range",
  gender: "gender",
  incomelevel: "income_level",
  income_level: "income_level",
  education: "education",
  occupation: "occupation",
  location: "location",
  familystatus: "family_status",
  family_status: "family_status",
  summary: "summary",
};

export function normalizeDemographics(raw: unknown): IcpDemographics | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      // A bare string (import path) is a free-text description, not a structured
      // value — carry it as `summary` rather than inventing a key for it.
      return { summary: trimmed };
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const out: IcpDemographics = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const canon = DEMO_ALIASES[k.toLowerCase().replace(/[^a-z_]/g, "")];
    if (canon && v != null) out[canon] = String(v);
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ── 1. Structural gate ───────────────────────────────────────────────────────

const ALL_KEYS: string[] = [...ICP_TEXT_SECTION_KEYS];

/**
 * HARD gate. Returns [] when the payload is shaped correctly.
 * Catches the tool-call flattening failure mode directly: demographics must be a
 * plain object, and no stray top-level keys may appear.
 */
export function validateIcpStructure(raw: unknown): IcpStructuralHit[] {
  const hits: IcpStructuralHit[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [{ code: "icp_not_object", description: "The ICP payload must be a JSON object.", location: "root" }];
  }
  const obj = raw as Record<string, unknown>;

  for (const k of ICP_TEXT_SECTION_KEYS) {
    const v = obj[k];
    if (typeof v !== "string") {
      hits.push({ code: "icp_section_not_string", description: `Section "${k}" must be a text string.`, location: k });
    } else if (v.trim().length === 0) {
      hits.push({ code: "icp_section_empty", description: `Section "${k}" must carry content.`, location: k });
    }
  }

  // Any extra top-level key means the model invented structure. This used to be
  // dominated by the seven demographic values being hoisted out of their nested
  // object; with no nested object in the schema, that failure mode is gone.
  const extra = Object.keys(obj).filter((k) => !ALL_KEYS.includes(k));
  if (extra.length > 0) {
    hits.push({
      code: "icp_unexpected_top_level_keys",
      description: `Unexpected top-level keys: ${extra.join(", ")}. Return only the named sections.`,
      location: "root",
    });
  }
  return hits;
}

export function buildIcpStructuralFailContext(hits: IcpStructuralHit[]): string {
  const lines = hits.slice(0, 8).map((h) => `- ${h.location}: ${h.description}`);
  return `The previous response was not shaped correctly:\n${lines.join("\n")}\n\nReturn the profile again with exactly the ${ICP_TEXT_SECTION_KEYS.length} keys named in the format block, each holding a text string, and no other keys.`;
}

// ── 2. R3 grounding validator ────────────────────────────────────────────────

/** Everything the coach actually supplied, as one corpus. */
export function buildIcpInputCorpus(ctx: IcpValidationContext): string {
  const s = ctx.service;
  const parts = [s.name, s.category, s.description, s.targetCustomer, s.mainBenefit];
  if (ctx.angle) {
    parts.push(ctx.angle.angleName, ctx.angle.description, ctx.angle.primaryPain, ctx.angle.primaryBuyingTrigger);
  }
  if (ctx.ladder) for (const k of ICP_LADDER_KEYS) parts.push(ctx.ladder[k] ?? null);
  return parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0).join(" \n");
}

/**
 * Two or more consecutive capitalised words — the proper-noun signature. Catches
 * "Justin Welsh", "Becky Kennedy", "Lenny's Newsletter", "Ship 30 for 30".
 */
const PROPER_NOUN_RE = /\b[A-Z][a-z']+(?:\s+(?:for\s+)?[A-Z][a-z0-9']+)+\b/g;

/** Capitalised phrases that are not third-party identities. */
const PROPER_NOUN_ALLOW = new Set([
  "not specified", "class a", "class b", "monday morning", "sunday night", "sunday nights",
  "friday afternoon", "new year", "google analytics",
]);

function unsupportedProperNouns(text: string, corpus: string): string[] {
  const corpusLower = corpus.toLowerCase();
  const found = new Set<string>();
  for (const m of Array.from(String(text).matchAll(PROPER_NOUN_RE))) {
    const phrase = m[0].trim();
    const lower = phrase.toLowerCase();
    if (PROPER_NOUN_ALLOW.has(lower)) continue;
    if (corpusLower.includes(lower)) continue;           // the coach named it
    // Any single token of the phrase present in the corpus is treated as supported
    // enough (e.g. the coach said "LinkedIn" and the profile says "LinkedIn Premium").
    const tokens: string[] = lower.split(/\s+/).filter((t: string) => t.length > 3);
    if (tokens.length > 0 && tokens.every((t: string) => corpusLower.includes(t))) continue;
    found.add(phrase);
  }
  return Array.from(found);
}

/** A demographic value counts as supported if its words or its digits appear in the corpus. */
function demographicSupported(value: string, corpus: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (/^not specified$/i.test(v)) return true;
  if (bonusWordOverlap(v, corpus) > 0) return true;
  const digits = v.match(/\d+/g) ?? [];
  if (digits.length > 0 && digits.every((d) => corpus.includes(d))) return true;
  return false;
}

const BROAD_AUDIENCE_RE =
  /^\s*(business owners|entrepreneurs|coaches|consultants|everyone|anyone|people|small business owners|professionals)\s*$/i;

/** Claims the buyer has already evaluated specific alternatives the coach never mentioned. */
const PRIOR_EVALUATION_RE =
  /\b(already (?:tried|used|worked with|bought|subscribed to)|switching from|churned from|cancelled their)\b/gi;

export function validateIcpGrounding(icp: Record<string, unknown>, ctx: IcpValidationContext): IcpGroundingHit[] {
  const hits: IcpGroundingHit[] = [];
  const corpus = buildIcpInputCorpus(ctx);

  // R3 mode 3 — named third parties in the Class-A fields.
  for (const field of ["influencers", "mediaConsumption"] as const) {
    const text = typeof icp[field] === "string" ? (icp[field] as string) : "";
    for (const name of unsupportedProperNouns(text, corpus)) {
      hits.push({
        classId: "icp_named_third_party",
        description:
          "A named real person, publication or brand is presented as fact about this audience. Named identities come from the coach; otherwise describe the KIND of voice or channel they trust.",
        matched: name,
        location: field,
        retryable: true,
      });
    }
  }

  // R3 mode 3 — demographic values the input cannot support.
  const demo = normalizeDemographics(icp.demographics);
  if (demo) {
    for (const k of ICP_DEMOGRAPHIC_KEYS) {
      const v = demo[k] ?? "";
      if (!demographicSupported(v, corpus)) {
        hits.push({
          classId: "icp_demographic_unsupported",
          description:
            `demographics.${k} states a specific value the coach's information does not establish. Unsupported demographic values carry the exact text "Not specified".`,
          matched: v.slice(0, 120),
          location: `demographics.${k}`,
          retryable: true,
        });
      }
    }
  }

  // R3 mode 1 — Cast-Iron Net.
  const target = (ctx.service.targetCustomer ?? "").trim();
  if (BROAD_AUDIENCE_RE.test(target) || bonusSignificantWords(target).size < 2) {
    hits.push({
      classId: "icp_breadth",
      description:
        "The audience given is broad enough to cover most of the market, so every section below is an assumption about which slice of it the coach means.",
      matched: target.slice(0, 120) || "(empty)",
      location: "service.targetCustomer",
      retryable: false,
    });
  }

  // R3 mode 4 — asserts prior evaluation of alternatives the coach never mentioned.
  for (const field of ["buyingTriggers", "objections"] as const) {
    const text = typeof icp[field] === "string" ? (icp[field] as string) : "";
    for (const m of Array.from(text.matchAll(PRIOR_EVALUATION_RE))) {
      const window = text.slice(m.index ?? 0, (m.index ?? 0) + 160);
      const names = unsupportedProperNouns(window, corpus);
      if (names.length > 0) {
        hits.push({
          classId: "icp_assumed_prior_evaluation",
          description:
            "States this buyer has already evaluated a specific named alternative that the coach's information never mentions — an awareness-stage assumption presented as fact.",
          matched: `${m[0]} … ${names[0]}`,
          location: field,
          retryable: false,
        });
      }
    }
  }

  return hits;
}

export function buildIcpGroundingFailContext(hits: IcpGroundingHit[], maxHits = 6): string {
  const retryable = hits.filter((h) => h.retryable).slice(0, maxHits);
  const lines = retryable.map((h) => `- ${h.location}: "${h.matched}" — ${h.description}`);
  const more = hits.filter((h) => h.retryable).length > maxHits ? `\n(plus more of the same)` : "";
  return `The previous profile stated the following as fact about this audience without the coach's information establishing it:\n${lines.join("\n")}${more}\n\nGenerate the profile again. Keep every internal-monologue section exactly as vivid and as specific as before — the lived situations, the 3am fears, the daily detail all stay. In sections 12 and 13, describe the KIND of voice and the KIND of channel this person trusts and name an individual, publication or brand only where the coach named it. In demographics, carry across what the coach established and give any remaining value the exact text "Not specified".`;
}

// ── 3. Out-of-band provenance ────────────────────────────────────────────────

/** Coverage thresholds — calibrated against real profiles, tunable in one place. */
export const PROVENANCE_STATED_RATIO = 0.35;
export const PROVENANCE_PARTIAL_RATIO = 0.15;

function labelFor(section: string, corpus: string, corpusWordCount: number): IcpProvenanceLabel {
  if (corpusWordCount === 0) return "inferred";
  const ratio = bonusWordOverlap(section, corpus) / corpusWordCount;
  if (ratio >= PROVENANCE_STATED_RATIO) return "stated";
  if (ratio >= PROVENANCE_PARTIAL_RATIO) return "partial";
  return "inferred";
}

/**
 * Per-section provenance. Coverage = how much of the coach's own vocabulary a
 * section is actually built out of. Not a truth score — a "did this come from
 * the coach or from the model" signal.
 */
export function computeIcpProvenance(
  icp: Record<string, unknown>,
  ctx: IcpValidationContext,
  hits: IcpGroundingHit[] = [],
): IcpProvenance {
  const corpus = buildIcpInputCorpus(ctx);
  const corpusWordCount = bonusSignificantWords(corpus).size;
  const perSection: Record<string, IcpProvenanceLabel> = {};

  for (const k of ICP_TEXT_SECTION_KEYS) {
    const v = typeof icp[k] === "string" ? (icp[k] as string) : "";
    perSection[k] = labelFor(v, corpus, corpusWordCount);
  }

  // demographics is not generated; only label it when a row actually carries one
  // (a legacy profile, or a coach-supplied import).
  const demo = normalizeDemographics(icp.demographics);
  if (demo) {
    const values = ICP_DEMOGRAPHIC_KEYS.map((k) => demo[k] ?? "");
    const specified = values.filter((v) => v.trim() && !/^not specified$/i.test(v));
    const supported = specified.filter((v) => demographicSupported(v, corpus));
    perSection.demographics =
      specified.length === 0 ? "inferred" : supported.length === specified.length ? "stated" : "partial";
  }

  const ladderAnswered = ctx.ladder
    ? ICP_LADDER_KEYS.filter((k) => typeof ctx.ladder![k] === "string" && (ctx.ladder![k] as string).trim().length > 0)
    : [];
  const ladderAnswers: Record<string, string> = {};
  for (const k of ladderAnswered) ladderAnswers[k] = (ctx.ladder![k] as string).trim();

  const counts = { stated: 0, partial: 0, inferred: 0 };
  for (const v of Object.values(perSection)) counts[v]++;
  const total = Object.keys(perSection).length || 1;
  const overall: IcpProvenanceLabel =
    counts.stated / total >= 0.5 ? "stated" : counts.inferred / total >= 0.6 ? "inferred" : "partial";

  return {
    perSection,
    ladderAnswered,
    ...(ladderAnswered.length > 0 ? { ladderAnswers } : {}),
    corpusWords: corpusWordCount,
    hits,
    overall,
    version: 1,
  };
}
