/**
 * fabricationValidator — catches invented PROOF in generated assets before it
 * reaches a coach or Meta. Mirrors the shipped validateBonusFabricationPatterns
 * shape: hits → failContext → retry.
 *
 * ── THE GOVERNING LINE ───────────────────────────────────────────────────────
 * Predictable category PSYCHOLOGY is legitimate inference, not fabrication.
 * "Business owners worry about cash flow, or about the team, or about time" is
 * common-knowledge inference from the audience category; every marketer makes it,
 * it is safe, and it is what carries a launch-stage coach. It is NEVER blocked.
 *
 * What is blocked is specific invented PROOF:
 *   - testimonials / case studies / named client results
 *   - statistics or percentages with no supplied basis
 *   - named real third parties implying endorsement
 *   - guarantees the coach has not said they offer
 *   - specific results or timeframes stated as promises
 *   - the coach's OWN unearned track record ("in my 15 years", "I've helped hundreds")
 *
 * ── Two classes, two dispositions ────────────────────────────────────────────
 * CLASS 1 (invented proof)   → retry 1→3, then BLOCK. Checked against SUPPLIED
 *                              scalars; needs no ICP at all, so it is precise.
 * CLASS 2 (persona claims)   → retry once, then LABEL. Never blocks: word overlap
 *                              detects vocabulary reuse, not truth, and a launch-
 *                              stage coach's inferred psychology is legitimate.
 *
 * Ground truth is the COACH CORPUS only (see groundingCorpus.ts) — never ICP prose.
 */

import { bonusWordOverlap } from "./validator";
import type { CoachCorpus, ProofSupplied } from "./groundingCorpus";

export type FabricationClass =
  | "invented_testimonial"
  | "invented_statistic"
  | "invented_named_third_party"
  | "invented_guarantee"
  | "promised_result"
  | "unearned_authority"
  | "untraceable_persona_claim";

export type FabricationHit = {
  classId: FabricationClass;
  /** 1 = invented proof (blocks). 2 = persona claim (labels). */
  tier: 1 | 2;
  description: string;
  matched: string;
  location: string;
};

export type FabricationResult = {
  ok: boolean;
  hits: FabricationHit[];
  /** Tier-1 hits only — these are what block. */
  blocking: FabricationHit[];
  failContext: string;
};

// ── Tier-1 patterns ──────────────────────────────────────────────────────────

/** A statistic offered as evidence: "87%", "9 out of 10", "3x more". */
const STAT_RE = /\b\d{1,3}(?:\.\d+)?\s?%|\b\d+\s*(?:out of|in)\s*\d+\b|\b\d+(?:\.\d+)?x\s+(?:more|faster|better|higher)\b/gi;

/**
 * A percentage can be an intensifier ("100% sure") or a hedged self-perception
 * ("about 80% of my week"), neither of which is evidence. Those are how real
 * people talk, and blocking them would gut ordinary copy.
 */
const STAT_IDIOMATIC_AFTER = /^\s*(?:sure|certain|convinced|committed|honest|right|clear|focused|present|there|yours|mine|worth it)\b/i;
const STAT_HEDGED_BEFORE = /\b(?:about|roughly|maybe|around|feels? like|probably|nearly|almost|like)\s*$/i;

/** True when this percentage is idiom or hedged perception rather than a stated fact. */
function statIsIdiomatic(text: string, m: RegExpMatchArray): boolean {
  const start = m.index ?? 0;
  const before = text.slice(Math.max(0, start - 24), start);
  const after = text.slice(start + m[0].length, start + m[0].length + 24);
  return STAT_IDIOMATIC_AFTER.test(after) || STAT_HEDGED_BEFORE.test(before);
}

/** A named client result / case study. */
const TESTIMONIAL_RE =
  /\b(?:one (?:of my |of our )?(?:client|student|member)s?|a client|my client|one woman|one guy|a founder|a consultant)\b[^.!?]{0,80}\b(?:went from|grew|scaled|doubled|tripled|landed|booked|made|earned|added|hit)\b/gi;

/** A result promised in a timeframe. */
const PROMISED_RESULT_RE =
  /\b(?:in|within|inside)\s+(?:just\s+)?\d+\s*(?:day|week|month|year)s?\b[^.!?]{0,60}\b(?:you(?:'ll| will)?|guarantee|promise|results?|revenue|clients?|leads?)\b|\b(?:you(?:'ll| will)|guaranteed to)\s+(?:make|earn|add|hit|land|book|double|triple)\b/gi;

/** A guarantee offered on the coach's behalf. */
const GUARANTEE_RE =
  /\b(?:money[- ]back|refund(?:ed)?|risk[- ]free|100%\s+guarantee|satisfaction guarantee|full refund|we guarantee|I guarantee)\b/gi;

/** The coach's own track record. */
const AUTHORITY_RE =
  /\b(?:in|over|after|with)\s+(?:my\s+)?\d+\+?\s*(?:years?|yrs)\b(?:\s+(?:of\s+)?(?:experience|coaching|consulting|practice|in the industry))?|\bI(?:'ve| have)\s+(?:helped|coached|worked with|trained|served)\s+(?:over\s+|more than\s+)?(?:\d[\d,]*|hundreds|thousands|dozens)\b|\b(?:hundreds|thousands)\s+of\s+(?:my\s+)?(?:clients|students|coaches|founders)\b/gi;

/** Two or more consecutive capitalised words — the proper-noun signature. */
const PROPER_NOUN_RE = /\b[A-Z][a-z']+(?:\s+(?:for\s+)?[A-Z][a-z0-9']+)+\b/g;

/**
 * Capitalised words that are never part of a third-party NAME — sentence openers,
 * pronouns, temporal words, days and months. A phrase containing any of these is
 * ordinary prose ("Every Monday morning", "When I'm"), not an endorsement.
 */
const NON_NAME_TOKENS = new Set([
  "every", "when", "while", "after", "before", "since", "until", "next", "last", "this",
  "that", "these", "those", "the", "and", "but", "for", "your", "you", "my", "mine", "our",
  "their", "his", "her", "its", "i", "i'm", "i've", "i'll", "i'd", "it", "it's", "there",
  "then", "now", "today", "tonight", "tomorrow", "yesterday", "sometimes", "always", "never",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "not", "specified", "day", "week", "month", "year", "morning", "afternoon", "evening", "night",
]);

function has(text: string, re: RegExp): RegExpMatchArray[] {
  return Array.from(String(text).matchAll(re));
}

/** True when the supplied data actually establishes a track record. */
function authoritySupported(matched: string, supplied: ProofSupplied): boolean {
  const bg = (supplied.coachBackground ?? "").toLowerCase();
  if (bg) {
    // A year-count claim passes when the same number appears in the real background.
    const years = matched.match(/\d+/)?.[0];
    if (years && bg.includes(years)) return true;
    // A count claim passes when the background carries a matching count.
    if (/helped|coached|worked with|trained|served|clients|students/.test(bg)) {
      if (years && bg.includes(years)) return true;
    }
  }
  const n = Number(matched.match(/\d[\d,]*/)?.[0]?.replace(/,/g, "") ?? NaN);
  if (!Number.isNaN(n) && (supplied.totalCustomers ?? 0) >= n) return true;
  return false;
}

function statSupported(matched: string, supplied: ProofSupplied, corpus: CoachCorpus): boolean {
  const digits = matched.match(/\d[\d.,]*/g) ?? [];
  if (digits.length === 0) return true;
  const hay = `${corpus.text} ${supplied.socialProofStat ?? ""} ${supplied.averageRating ?? ""} ` +
    `${supplied.totalCustomers ?? ""} ${supplied.totalReviews ?? ""}`;
  return digits.every((d) => hay.includes(d));
}

function unsupportedProperNouns(text: string, corpus: CoachCorpus): string[] {
  const hay = corpus.text.toLowerCase();
  const found = new Set<string>();
  for (const m of has(text, PROPER_NOUN_RE)) {
    const phrase = m[0].trim();
    const lower = phrase.toLowerCase();
    // Ordinary prose that merely capitalises — a real name has no such token.
    if (lower.split(/\s+/).some((t) => NON_NAME_TOKENS.has(t))) continue;
    if (hay.includes(lower)) continue;
    const tokens = lower.split(/\s+/).filter((t) => t.length > 3);
    if (tokens.length > 0 && tokens.every((t) => hay.includes(t))) continue;
    found.add(phrase);
  }
  return Array.from(found);
}

// ── Core ─────────────────────────────────────────────────────────────────────

export type FabricationCheckInput = {
  /** Field label → generated text. */
  fields: Record<string, string | null | undefined>;
  corpus: CoachCorpus;
  supplied: ProofSupplied;
  /** Persona-claim traceability is only meaningful where a claim asserts fact. */
  checkPersonaTraceability?: boolean;
};

export function checkFabrication(input: FabricationCheckInput): FabricationResult {
  const hits: FabricationHit[] = [];
  const push = (
    classId: FabricationClass, tier: 1 | 2, description: string, matched: string, location: string,
  ) => hits.push({ classId, tier, description, matched: String(matched).slice(0, 160), location });

  for (const [location, raw] of Object.entries(input.fields)) {
    const text = typeof raw === "string" ? raw : "";
    if (!text.trim()) continue;

    for (const m of has(text, TESTIMONIAL_RE)) {
      // A client story passes only when the coach supplied real testimonial data.
      const names = input.supplied.testimonialNames.filter(Boolean);
      if (names.length === 0) {
        push("invented_testimonial", 1,
          "A client story or named result appears in copy for a coach whose proof is not on the record. Client stories come from supplied testimonials.",
          m[0], location);
      }
    }

    for (const m of has(text, STAT_RE)) {
      if (statIsIdiomatic(text, m)) continue;
      if (!statSupported(m[0], input.supplied, input.corpus)) {
        push("invented_statistic", 1,
          "A statistic is stated as evidence without a supplied figure behind it. Figures come from the coach's own data.",
          m[0], location);
      }
    }

    for (const m of has(text, PROMISED_RESULT_RE)) {
      push("promised_result", 1,
        "A specific result in a specific timeframe reads as a promise. Copy describes the method and the shift rather than promising an outcome.",
        m[0], location);
    }

    for (const m of has(text, GUARANTEE_RE)) {
      if (!input.supplied.guaranteeType && !input.supplied.guaranteeDuration) {
        push("invented_guarantee", 1,
          "A guarantee appears that the coach has not said they offer. Guarantee terms are the coach's to state.",
          m[0], location);
      }
    }

    for (const m of has(text, AUTHORITY_RE)) {
      if (!authoritySupported(m[0], input.supplied)) {
        push("unearned_authority", 1,
          "A track record is claimed on the coach's behalf that the supplied background does not establish. Authority comes from what the coach has actually told us.",
          m[0], location);
      }
    }

    for (const name of unsupportedProperNouns(text, input.corpus)) {
      push("invented_named_third_party", 1,
        "A named person, publication or brand appears that the coach never mentioned, which reads as an endorsement.",
        name, location);
    }

    // ── Tier 2 — persona traceability. Deliberately soft. ──
    // Predictable category psychology is legitimate inference and is NEVER blocked.
    // This records how much of the claim is built from the coach's own words so a
    // thin-input profile is visible; it does not gate anything.
    if (input.checkPersonaTraceability && input.corpus.words > 0) {
      const overlap = bonusWordOverlap(text, input.corpus.text);
      if (overlap === 0) {
        push("untraceable_persona_claim", 2,
          "This copy shares no vocabulary with the coach's own material. Legitimate as category-level inference; recorded, not blocked.",
          text.slice(0, 80), location);
      }
    }
  }

  const blocking = hits.filter((h) => h.tier === 1);
  return { ok: blocking.length === 0, hits, blocking, failContext: buildFailContext(blocking) };
}

/**
 * Positive-framed retry guidance (§14): describes what the copy IS, rather than
 * naming failure shapes back at the model.
 */
export function buildFailContext(blocking: FabricationHit[], maxHits = 6): string {
  if (blocking.length === 0) return "";
  const lines = blocking.slice(0, maxHits).map((h) => `- ${h.location}: "${h.matched}" — ${h.description}`);
  const more = blocking.length > maxHits ? `\n(plus ${blocking.length - maxHits} more of the same kind)` : "";
  return `The previous draft carried claims the coach's own material does not establish:
${lines.join("\n")}${more}

Write it again with the same energy and the same specificity about the reader's situation. Every number, percentage, client story, named person, guarantee and stated track record in the copy comes from the supplied material above. Where the supplied material does not carry one, the copy speaks to the reader's situation, to the method and to the shift it creates — which is what makes launch-stage copy land.`;
}

// ── Per-generator adapters ───────────────────────────────────────────────────

export const FABRICATION_RETRY_MAX_ATTEMPTS = 3;

export type RawConceptLike = { desire?: string | null; personaLabel?: string | null };

/**
 * Concepts carry a fixed persona plus a desire axis — psychology, not proof — so
 * persona traceability is deliberately NOT checked here. A launch-stage coach's
 * concepts are category inference and pass clean.
 */
export function validateConceptFabricationPatterns(
  concepts: readonly RawConceptLike[], corpus: CoachCorpus, supplied: ProofSupplied,
): FabricationResult {
  const fields: Record<string, string | null | undefined> = {};
  concepts.forEach((c, i) => {
    fields[`concept[${i}].desire`] = typeof c.desire === "string" ? c.desire : "";
  });
  return checkFabrication({ fields, corpus, supplied });
}

export type RawSceneLike = { spokenLine?: string | null; onScreenText?: string | null };

/** Scripts are free spoken prose — the highest-risk surface for invented proof. */
export function validateScriptFabricationPatterns(
  scenes: readonly RawSceneLike[], corpus: CoachCorpus, supplied: ProofSupplied,
): FabricationResult {
  const fields: Record<string, string | null | undefined> = {};
  scenes.forEach((sc, i) => {
    fields[`scene[${i}].spokenLine`] = typeof sc.spokenLine === "string" ? sc.spokenLine : "";
    fields[`scene[${i}].onScreenText`] = typeof sc.onScreenText === "string" ? sc.onScreenText : "";
  });
  return checkFabrication({ fields, corpus, supplied });
}

/** Ad copy is what actually reaches Meta. Headlines + bodies, every variant. */
export function validateAdCopyFabricationPatterns(
  ads: { headline?: string | null; primaryText?: string | null; description?: string | null }[],
  corpus: CoachCorpus, supplied: ProofSupplied,
): FabricationResult {
  const fields: Record<string, string | null | undefined> = {};
  ads.forEach((a, i) => {
    fields[`ad[${i}].headline`] = a.headline ?? "";
    fields[`ad[${i}].primaryText`] = a.primaryText ?? "";
    fields[`ad[${i}].description`] = a.description ?? "";
  });
  return checkFabrication({ fields, corpus, supplied });
}

/**
 * The publishToMeta boundary check. Runs on RESOLVED content (after [INSERT_*]
 * substitution) so a real resolved price is not read as invented and an
 * unresolved placeholder is not read as a missing figure. Content-agnostic: it
 * catches whatever produced the copy, including a coach's hand-edit in the Kit.
 */
export function validatePublishContentFabrication(
  content: { headline: string; body: string; callToAction?: string },
  corpus: CoachCorpus, supplied: ProofSupplied,
): FabricationResult {
  return checkFabrication({
    fields: {
      headline: content.headline,
      body: content.body,
      ...(content.callToAction ? { callToAction: content.callToAction } : {}),
    },
    corpus,
    supplied,
  });
}
