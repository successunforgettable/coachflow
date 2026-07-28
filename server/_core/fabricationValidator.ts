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
import { ungroundedClaims, type ClaimKind } from "./trackRecordClaims";

/** Track-record claim kinds map onto the existing reported classes. */
const CLAIM_CLASS: Record<ClaimKind, FabricationClass> = {
  possessive_population: "unearned_authority",
  people_count: "unearned_authority",
  past_client_event: "unearned_authority",
  named_person_outcome: "invented_testimonial",
  client_narrative: "invented_testimonial",
  outcome_statistic: "invented_statistic",
  stated_guarantee: "invented_guarantee",
  third_party_attribution: "invented_named_third_party",
};

const CLAIM_DESCRIPTION: Record<ClaimKind, string> = {
  possessive_population: "Copy refers to the coach's own clients or students, which asserts people they have not told us about. What the method is designed to do needs no client behind it.",
  people_count: "A count of real people appears that the coach has not supplied. Numbers of people served come from what the coach has told us.",
  past_client_event: "Copy states the coach has already worked with people, which their supplied material does not establish. The method's design stands on its own.",
  named_person_outcome: "A named person and their result appear in copy for a coach whose proof is not on the record. Client stories come from supplied material.",
  client_narrative: "A client's story is narrated as something that already happened, which the coach's supplied material does not carry. The method can be described without a case study.",
  outcome_statistic: "A statistic is stated as evidence without a supplied figure behind it. Figures come from the coach's own data.",
  invented_guarantee: "",
  stated_guarantee: "A guarantee appears that the coach has not said they offer. Guarantee terms are the coach's to state.",
  third_party_attribution: "A named person, publication or brand is presented as a source or endorsement that the coach never mentioned.",
} as Record<ClaimKind, string>;

export type FabricationClass =
  | "invented_testimonial"
  | "invented_statistic"
  | "invented_named_third_party"
  | "invented_guarantee"
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

/**
 * Tokens that make a capitalised phrase a TOOL, PLATFORM or ROLE TITLE rather than a
 * named person or publication. Measured over 101 real prod ICPs: every hit in this class
 * was one of these — "Google Drive", "Sales Navigator", "Independent Consultant",
 * "General Counsel", "Science Hour". None is invented and none implies an endorsement.
 * A real person or publication ("Justin Welsh", "Harvard Business Review") carries none
 * of them, so detection of the actual risk is unaffected.
 */
const TOOL_OR_ROLE_TOKENS = new Set([
  // platforms and tools
  "google", "drive", "docs", "sheets", "gmail", "zoom", "slack", "notion", "canva",
  "linkedin", "navigator", "instagram", "facebook", "meta", "tiktok", "youtube",
  "whatsapp", "stripe", "shopify", "hubspot", "salesforce", "mailchimp", "calendly",
  "excel", "powerpoint", "word", "outlook", "teams", "asana", "trello", "ads", "analytics",
  // role and title nouns
  "consultant", "consultants", "counsel", "director", "manager", "officer", "president",
  "founder", "coach", "trainer", "specialist", "analyst", "engineer", "designer",
  "partner", "associate", "assistant", "executive", "lead", "head", "chief", "vp",
  "hour", "session", "call", "meeting", "review", "report", "program", "programme",
  // places — a location is not a named third party
  "new", "york", "san", "jose", "los", "angeles", "london", "dubai", "mumbai", "delhi",
  "singapore", "sydney", "toronto", "chicago", "boston", "austin", "francisco", "street",
  "wall", "city", "county", "state", "north", "south", "east", "west",
]);

/**
 * A percentage in the speaker's own account of their own time or work is
 * self-description, not evidence — "about 80% of my week", "70% of my time on admin".
 * That is how real people write, and it was 80 of the 137 blocking hits measured across
 * 101 real prod ICPs. A claim about a population or a result ("87% of consultants",
 * "a 40% lift", "9 out of 10 doubled") carries no such first-person frame and still blocks.
 */
const STAT_SELF_DESCRIPTIVE =
  /\b(of|in|on)\s+(my|our)\b|\bI\s+(spend|spent|give|gave|lose|lost|waste|wasted|put)\b/i;

function statIsSelfDescriptive(text: string, m: RegExpMatchArray): boolean {
  const start = m.index ?? 0;
  const window = text.slice(Math.max(0, start - 40), start + m[0].length + 40);
  return STAT_SELF_DESCRIPTIVE.test(window);
}

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
  /\b(?:money[- ]back guarantee|risk[- ]free|100%\s+guarantee|satisfaction guarantee|full refund|we guarantee|I guarantee|guaranteed refund)\b/gi;

/** The coach's own track record. */
const AUTHORITY_RE =
  /\b(?:in|over|after|with)\s+my\s+\d+\+?\s*(?:years?|yrs)\b(?:\s+(?:of\s+)?(?:experience|coaching|consulting|practice|in the industry))?|\bI(?:'ve| have)\s+(?:helped|coached|worked with|trained|served)\s+(?:over\s+|more than\s+)?(?:\d[\d,]*|hundreds|thousands|dozens)\b|\b(?:hundreds|thousands)\s+of\s+(?:my\s+)?(?:clients|students|coaches|founders)\b/gi;

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

/**
 * Frames that present a named party as a source, an endorser, or the person behind a
 * result. Without one, a capitalised phrase in marketing copy is styling.
 */
const ATTRIBUTION_CUE =
  /\b(featured|as seen|seen (?:in|on)|according to|says|said|partnered|endorsed|backed by|recommended by|recommends|alongside|swears by|quoted|interviewed|the same (?:system|method|approach)\s+\w+|used to (?:go|build|scale|grow)|studied (?:under|with)|trained by|certified by)\b/i;

/**
 * Title Case and ALL CAPS destroy the proper-noun signal: in "Designers Are Replacing
 * Project Churn With Predictable Monthly Retainers" every pair of adjacent capitalised
 * words looks like a name. Headlines, eyebrows and on-screen text are routinely written
 * that way, so proper-noun detection has to stand down for them or it fires on all of
 * them. Measured on real generated assets, this was the single largest false-positive
 * class — "Without Starving", "Keep Seeing", "Consultancies From Scratch".
 * A genuine name inside ordinary sentence-case prose is unaffected.
 */
function isTitleCased(line: string): boolean {
  const words = line.trim().split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length < 4) return false;
  const capped = words.filter((w) => /^[A-Z]/.test(w)).length;
  // 0.85, not a looser figure: a Title Case headline capitalises essentially every word
  // ("Designers Are Replacing Project Churn With Predictable Monthly Retainers" = 1.0),
  // whereas ordinary prose naming two real parties tops out well below it
  // ("As featured alongside Harvard Business Review and Marie Forleo" = 0.67) and must
  // still be scanned.
  return capped / words.length >= 0.85;
}

/**
 * The CTA strings ZAP's own compliance rules REQUIRE the model to use. Each is two or
 * three capitalised words absent from the coach's corpus, so proper-noun scanning read
 * them as invented named third parties and dropped the whole variant.
 *
 * Measured live (2026-07-27): "Learn More" accounted for 2 of 6 career-shape body drops.
 * The interaction is worse than it looks — the phrase that opens proper-noun scanning
 * ("the same method I used to build…") is first-person construction the REGISTER STANDARD
 * actively encourages, so one layer pushed the copy into a shape the other then punished,
 * over a CTA we mandate. Niche-independent; it had been thinning every deck since ship.
 */
const APPROVED_CTA_PHRASES = new Set([
  "learn more", "sign up", "book a call", "get started", "download free guide",
  "watch free training", "apply now", "register now", "save my spot", "save your seat",
  "get early access", "join the challenge", "claim your place", "book a discovery call",
  "reserve your slot", "enrol now", "enroll now", "start now", "download now",
]);

function unsupportedProperNouns(text: string, corpus: CoachCorpus): string[] {
  const hay = corpus.text.toLowerCase();
  const found = new Set<string>();
  // Drop title-cased / shouted lines before scanning — their capitalisation is styling.
  const scannable = String(text)
    .split(/\n|(?<=[.!?])\s+/)
    .filter((line) => !isTitleCased(line))
    .join(" ");
  for (const m of has(scannable, PROPER_NOUN_RE)) {
    const phrase = m[0].trim();
    const lower = phrase.toLowerCase();
    // Ordinary prose that merely capitalises — a real name has no such token.
    if (lower.split(/\s+/).some((t) => NON_NAME_TOKENS.has(t))) continue;
    // Tools, platforms and job titles are not named third parties.
    if (lower.split(/\s+/).some((t) => TOOL_OR_ROLE_TOKENS.has(t))) continue;
    // A CTA we ourselves require the model to write is never an invented third party.
    if (APPROVED_CTA_PHRASES.has(lower)) continue;
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

    // ── Track-record detection (Rule 1) ──────────────────────────────────────
    // Detect PROOF-SHAPED claims, then require grounding. A claim the detector does not
    // return is a METHOD claim — what the coach's method is designed to produce — and is
    // always allowed, at zero clients included. See trackRecordClaims.ts for the rule.
    //
    // This replaces the old shape, where six regexes decided alone and the corpus was only
    // consulted afterwards to excuse a hit. That made a missed phrasing uncatchable by
    // construction: "94% of my clients" passed while "87% of consultants" blocked.
    for (const claim of ungroundedClaims(text, input.corpus, input.supplied)) {
      push(CLAIM_CLASS[claim.kind], 1, CLAIM_DESCRIPTION[claim.kind], claim.matched, location);
    }

    // ── Legacy detectors, retained as ADDITIONAL inputs to the SAME decision ──────
    // Consolidation means one verdict, not one regex: these catch shapes the claim
    // detector does not model — tenure ("in my 15 years") and an endorsement frame
    // naming a third party. Dropping them when the claim detector landed cost five
    // real detections, so they stay.
    for (const m of has(text, AUTHORITY_RE)) {
      if (!authoritySupported(m[0], input.supplied)) {
        push("unearned_authority", 1,
          "A track record is claimed on the coach's behalf that the supplied background does not establish. Authority comes from what the coach has actually told us.",
          m[0], location);
      }
    }

    if (ATTRIBUTION_CUE.test(text)) for (const name of unsupportedProperNouns(text, input.corpus)) {
      push("invented_named_third_party", 1,
        "A named person, publication or brand appears that the coach never mentioned, which reads as an endorsement.",
        name, location);
    }

    // A forward promise is a METHOD claim under Rule 1 and is not invention, so it is not
    // detected here at all. It is a results-claim risk, which complianceAxis owns as check 7.

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

Write it again with the same energy and the same specific detail. Every number, percentage, client story, named person, guarantee and stated track record in the copy comes from the supplied material above. Where the supplied material does not carry one, the copy speaks from the coach's own experience — the moment they remember — and to the method and the shift it creates, which is what makes launch-stage copy land.`;
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
