/**
 * groundingChecker — sprint 2: the F2 speaker-fact check and the F5 viewer-financial-information check,
 * built as ONE RECORD-ONLY module.
 *
 *   ⚠️ RECORD-ONLY. It never blocks anything; its output is labels. It is NOT wired into any generator,
 *   gate, router or publish path. §15d, stated deliberately: NOTHING in production code calls it until
 *   sprint 3. Its only callers are its unit test and `server/scripts/grounding-checker-eval.ts`.
 *
 * SHAPE (proposal §2 F2, addendum §2–§5): one model call per checked asset reads all its text fields
 * together and returns two lists — speaker claims and viewer financial findings — plus an O(1) reading proof. Nothing the
 * model says is trusted as a verdict:
 *   - every quote must be a substring of the checked text (after normalising whitespace, quote marks and
 *     dashes), else it is an EXTRACTION ERROR, counted and reported;
 *   - every evidence span must be a substring of ONE supplied coach fact, else the claim is ungrounded;
 *   - verdicts (grounded / ungrounded / conflicts_with_current_fact / not_checkable / overstated) are
 *     computed here, in code.
 * The model can therefore never make a claim grounded by asserting it; a hallucination can only push a
 * verdict toward "ungrounded".
 *
 * GROUNDING SOURCE: a `CoachFactsResult` from `buildCoachFacts` ONLY (which already carries the A2
 * operator-captured offer facts). Never `buildCoachCorpus`; generated text never grounds a speaker fact.
 * Superseded values are never shown to the model and never ground; they exist here only so a copy figure
 * can be compared against the canonical one.
 *
 * D-a: biography never grounds from a coach-confirmed rewording (enforced again here, per fact).
 * D-c: only SPECIFIC biographical claims are findings; unspecific narrative colour is `not_checkable`.
 * D-g / D-h: F5 and certainty-overstatement are record-only, like F2.
 * Quoting ruling: `renderRetryNote` describes problems in the abstract and quotes none of the flagged text.
 *
 * RUNTIME IMPORTS: `./llm` only (which imports `./env`). `./coachFacts` is imported for TYPES only, so no
 * database module is reachable from here.
 */

import { invokeLLM, type InvokeParams, type InvokeResult } from "./llm";
import type { CoachFact, CoachFactsResult, SingleValuedSlot } from "./coachFacts";

// ── Closed sets ───────────────────────────────────────────────────────────────────────────────────

/** A1 biography kinds. `career` covers employer and job title. */
export const BIOGRAPHY_KINDS = [
  "age", "family", "career", "tenure", "date", "place", "life_event", "credential", "witnessed_event",
] as const;
export type BiographyKind = (typeof BIOGRAPHY_KINDS)[number];

export const SPEAKER_CLAIM_KINDS = [...BIOGRAPHY_KINDS, "practice", "offer_outcome"] as const;
export type SpeakerClaimKind = (typeof SPEAKER_CLAIM_KINDS)[number];

export const SPECIFICITY = ["specific", "unspecific"] as const;
export type Specificity = (typeof SPECIFICITY)[number];

/**
 * Mirrors coachFacts.SINGLE_VALUED_SLOTS. Kept as a local copy so this module takes no runtime import of
 * coachFacts; the `satisfies` clause and a unit test pin the two lists together.
 */
export const CHECKER_SINGLE_VALUED_SLOTS = [
  "people_trained", "countries", "years_experience", "clients_served", "headline_credential",
] as const satisfies readonly SingleValuedSlot[];

/** Slots whose value is a count and is compared numerically. `headline_credential` is text. */
const NUMERIC_SLOTS: ReadonlySet<string> = new Set(["people_trained", "countries", "years_experience", "clients_served"]);

export const CLAIM_SLOTS = ["none", ...CHECKER_SINGLE_VALUED_SLOTS] as const;
export type ClaimSlot = (typeof CLAIM_SLOTS)[number];

export const FINANCIAL_ATTRIBUTES = [
  "income", "pay", "savings", "money_location", "investments", "debts_credit", "net_worth", "business_revenue", "spending",
] as const;
export type FinancialAttribute = (typeof FINANCIAL_ATTRIBUTES)[number];

/**
 * The sentence-role vocabulary. Beat labelling left the synchronous call in the latency pass: it cost one verbatim
 * re-emission of the whole asset (~a third of generated output) for labels NOTHING reads — their only intended
 * consumer is D-m's set-level structural check, which is parked behind Thread A and is not a publish-time question.
 * The vocabulary stays here for whatever computes beats off-path.
 */
export const BEAT_LABELS = ["hook", "problem", "reframe", "mechanism", "credential", "offer", "logistics", "cta"] as const;
export type BeatLabel = (typeof BEAT_LABELS)[number];

/** Words that make a claim absolute. Matched on word boundaries in the normalised quote. */
export const CERTAINTY_MARKERS = [
  "exactly", "precisely", "guaranteed", "guarantee", "guarantees", "always", "every time", "every single time",
  "without fail", "never fails", "never fail", "100%", "one hundred percent", "certainly", "definitely", "for sure",
  "without a doubt", "no doubt", "proven", "surefire", "sure-fire",
] as const;

export const CLAIM_VERDICTS = ["grounded", "ungrounded", "conflicts_with_current_fact", "not_checkable", "overstated"] as const;
export type ClaimVerdict = (typeof CLAIM_VERDICTS)[number];

/** A3: the first extraction plus one re-extraction. */
export const MAX_EXTRACTION_ATTEMPTS = 2;

// ── Inputs and outputs ────────────────────────────────────────────────────────────────────────────

export type CheckedAsset = {
  assetType: string;
  assetId?: string | number | null;
  /** Every text field of the asset. All are read in ONE model call. */
  fields: Array<{ name: string; text: string }>;
};

export type EvidenceRejection =
  | "no_evidence"
  | "evidence_too_short"
  | "evidence_not_found"
  | "rewording_not_evidence_for_biography"
  | "evidence_number_mismatch";

export type SlotCheck = "not_applicable" | "no_canonical" | "match" | "conflict" | "undetermined";

export type SpeakerClaimFinding = {
  field: string;
  /** The model's quote, verified to be in the checked text. Evidence for humans and logs; never for a retry note. */
  quote: string;
  kind: SpeakerClaimKind;
  biography: boolean;
  specificity: Specificity;
  slot: ClaimSlot;
  modelNormalisedValue: string;
  evidence: string;
  evidenceVerified: boolean;
  evidenceSourceRefs: string[];
  evidenceRejection: EvidenceRejection | null;
  /** Certainty markers found in the quote (lexicon ∪ model-reported markers verified in the quote). */
  certaintyMarkers: string[];
  /** Markers present in the quote and absent from every fact the evidence was found in. */
  certaintyMarkersMissingFromEvidence: string[];
  slotCheck: SlotCheck;
  conflict: { slot: SingleValuedSlot; copyValue: number | string; canonicalValue: string; canonicalSourceRef: string } | null;
  verdict: ClaimVerdict;
};

export type ViewerFinancialFinding = { field: string; quote: string; attribute: FinancialAttribute };
/**
 * §15k LIVENESS CONTROL. Beats used to serve this: "a response that read the copy labels at least one sentence."
 * The right control at the wrong price — O(number of sentences). This is the same control at O(1): the model
 * returns the FIRST and LAST sentence verbatim plus its sentence count, and the code checks the two quotes against
 * the copy's own first and last sentence. A model that did not read to the end cannot produce the last one.
 * SILENCE MUST FAIL, NEVER PASS: an unverified copyRead is `unverifiable`, never "no findings".
 */
export type CopyRead = {
  sentenceCount: number;
  firstSentence: string;
  lastSentence: string;
  /** Both quotes matched the copy's actual first and last sentence. The whole point of the control. */
  verified: boolean;
  /** The model's count against the code's. Recorded, never gating: sentence splitting legitimately differs. */
  countMatches: boolean;
};

export type AttemptOutcome = "ok" | "call_error" | "malformed" | "unverifiable";

export type AttemptRecord = {
  attempt: number;
  outcome: AttemptOutcome;
  detail: string[];
  model: string | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type ExtractionErrorCounts = {
  callErrors: number;
  malformedResponses: number;
  unverifiedClaimQuotes: number;
  unverifiedFinancialQuotes: number;
  unverifiedCopyRead: number;
  total: number;
};

export type GroundingCheckResult = {
  /**
   * `checked`: a well-formed, fully verified response was read.
   * `extraction_failed`: both attempts were malformed or unverifiable. REPORTED, never "no findings" —
   *   whatever the last well-formed attempt yielded is kept for humans, but it is not a clean read.
   * `empty_input`: the asset had no text; no call was made.
   */
  status: "checked" | "extraction_failed" | "empty_input";
  recordOnly: true;
  assetType: string;
  assetId: string | number | null;
  speakerClaims: SpeakerClaimFinding[];
  viewerFinancialFindings: ViewerFinancialFinding[];
  /** §15k: null until a response verifies it. A `checked` result ALWAYS carries a verified one. */
  copyRead: CopyRead | null;
  sentenceCount: number;
  counts: {
    byVerdict: Record<ClaimVerdict, number>;
    specificBiographyUngrounded: number;
    conflicts: number;
    overstated: number;
    notCheckable: number;
    viewerFinancial: number;
    /** Non-empty evidence spans that did not verify (a fabricated or altered citation). */
    unverifiedEvidence: number;
  };
  extractionErrors: ExtractionErrorCounts;
  /** Model quotes that failed verification, for humans and logs. */
  rejectedQuotes: Array<{ attempt: number; list: "speaker_claims" | "viewer_financial_findings" | "copy_read"; quote: string }>;
  attempts: AttemptRecord[];
  usage: { calls: number; inputTokens: number; outputTokens: number; latencyMs: number; models: string[] };
};

export type CheckGroundingOptions = {
  /** Injected for tests. Defaults to the real `invokeLLM`. */
  invoke?: (params: InvokeParams) => Promise<InvokeResult>;
  model?: string;
};

// ── Normalisation ─────────────────────────────────────────────────────────────────────────────────

/** Whitespace, quote marks and dashes normalised; case folded. Used on BOTH sides of every substring test. */
export function normaliseForMatch(s: unknown): string {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201A\u201B\u2032`\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/ ?- ?/g, "-")
    .trim()
    .toLowerCase();
}

/** A quote's edges may differ by punctuation only; the body must match verbatim. */
function normaliseQuote(s: unknown): string {
  return normaliseForMatch(s).replace(/^[\s.,;:!?"'…-]+|[\s.,;:!?"'…-]+$/g, "");
}

const hasContent = (n: string) => /[a-z0-9]{2,}/.test(n);

function containsPhrase(haystackNorm: string, phraseNorm: string): boolean {
  if (!phraseNorm) return false;
  const esc = phraseNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lead = /^[a-z0-9]/.test(phraseNorm) ? "(?<![a-z0-9])" : "";
  const trail = /[a-z0-9]$/.test(phraseNorm) ? "(?![a-z0-9])" : "";
  return new RegExp(`${lead}${esc}${trail}`).test(haystackNorm);
}

// ── Numbers ───────────────────────────────────────────────────────────────────────────────────────

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const BIG: Record<string, number> = { thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 };
const GROUP: Record<string, number> = { dozen: 12, dozens: 12, decade: 10, decades: 10 };
const own = (o: Record<string, number>, k: string | undefined) => k !== undefined && Object.prototype.hasOwnProperty.call(o, k);
const isNumberWord = (w: string | undefined) => own(SMALL, w) || own(TENS, w) || w === "hundred" || own(BIG, w);
const isScale = (w: string | undefined) => w === "hundred" || own(BIG, w);

export type NumberMention = {
  value: number;
  /** The word before the number, e.g. "since" in "since 2021". */
  prevWord: string;
  /** A bare "one" — usually a pronoun ("the one question"), so it is ignored for comparisons. */
  lone: boolean;
};

/** Digits and number words: "fifty-two" = 52, "a million" = 1,000,000, "twenty-five years" = 25, "a decade" = 10. */
export function extractNumbers(text: string): NumberMention[] {
  const t = normaliseForMatch(text).replace(/(?<=[a-z])-(?=[a-z])/g, " ");
  const tokens = Array.from(t.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?k?(?![a-z0-9])|[a-z]+/g)).map((m) => m[0]);
  const out: NumberMention[] = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const prevWord = i > 0 ? tokens[i - 1] : "";
    let value: number | null = null;
    let j = i + 1;
    let lone = false;
    if (/^\d/.test(tok)) {
      value = parseFloat(tok.replace(/,/g, "").replace(/k$/, ""));
      if (tok.endsWith("k")) value *= 1_000;
      if (isScale(tokens[j])) { value *= tokens[j] === "hundred" ? 100 : BIG[tokens[j]]; j++; }
    } else if (isNumberWord(tok) || ((tok === "a" || tok === "an") && (isScale(tokens[i + 1]) || own(GROUP, tokens[i + 1])))) {
      let total = 0;
      let current = 0;
      let any = false;
      j = i;
      while (j < tokens.length) {
        const w = tokens[j];
        if (own(SMALL, w)) { current += SMALL[w]; any = true; j++; }
        else if (own(TENS, w)) { current += TENS[w]; any = true; j++; }
        else if (w === "hundred") { current = (current || 1) * 100; any = true; j++; }
        else if (own(BIG, w)) { total += (current || 1) * BIG[w]; current = 0; any = true; j++; }
        else if ((w === "a" || w === "an") && !any && (isScale(tokens[j + 1]) || own(GROUP, tokens[j + 1]))) { current = 1; j++; }
        else if (w === "and" && any && isNumberWord(tokens[j + 1])) { j++; }
        else break;
      }
      if (any || own(GROUP, tokens[j])) {
        value = total + current;
        lone = j - i === 1 && tok === "one";
      }
    }
    if (value !== null && Number.isFinite(value)) {
      if (own(GROUP, tokens[j])) { value *= GROUP[tokens[j]]; j++; lone = false; }
      out.push({ value, prevWord, lone });
      i = Math.max(j, i + 1);
    } else {
      i++;
    }
  }
  return out;
}

const YEAR_PREPOSITIONS = new Set(["since", "in", "from", "until", "by", "of", "circa"]);
const isYearMention = (m: NumberMention) =>
  Number.isInteger(m.value) && m.value >= 1900 && m.value <= 2099 && YEAR_PREPOSITIONS.has(m.prevWord);

/** Numbers that can be compared: bare pronoun "one" excluded. */
function comparableNumbers(text: string): number[] {
  return Array.from(new Set(extractNumbers(text).filter((m) => !m.lone).map((m) => m.value)));
}

/** Numbers that can be a count-slot value: bare "one" and "since 2021"-style years excluded. */
function slotNumbers(text: string): number[] {
  return Array.from(new Set(extractNumbers(text).filter((m) => !m.lone && !isYearMention(m)).map((m) => m.value)));
}

// ── Deterministic verification ────────────────────────────────────────────────────────────────────

type FieldIndex = Array<{ name: string; norm: string }>;

/** The field a quote is found in, or null. A quote spanning two fields does not verify. */
export function verifyQuote(quote: unknown, fields: FieldIndex): string | null {
  const q = normaliseQuote(quote);
  if (q.length < 3 || !hasContent(q)) return null;
  const hit = fields.find((f) => f.norm.includes(q));
  return hit ? hit.name : null;
}

export function isBiographyKind(kind: string): kind is BiographyKind {
  return (BIOGRAPHY_KINDS as readonly string[]).includes(kind);
}

type EvidenceCheck = { verified: boolean; facts: CoachFact[]; rejection: EvidenceRejection | null };

/**
 * Evidence verifies only when it is a substring of ONE groundable fact (never a span joined across
 * facts), is not trivially short, comes from a fact that may evidence this kind (D-a), and — when the
 * quote carries numbers — shares at least one of them.
 */
export function verifyEvidence(evidence: unknown, quote: string, kind: string, facts: CoachFact[]): EvidenceCheck {
  const e = normaliseQuote(evidence);
  if (!e) return { verified: false, facts: [], rejection: "no_evidence" };
  if (e.length < 3 || !hasContent(e)) return { verified: false, facts: [], rejection: "evidence_too_short" };
  const containing = facts.filter((f) => normaliseForMatch(f.value).includes(e));
  if (containing.length === 0) return { verified: false, facts: [], rejection: "evidence_not_found" };
  const admissible = isBiographyKind(kind) ? containing.filter((f) => f.source !== "coach_confirmed_rewording") : containing;
  if (admissible.length === 0) return { verified: false, facts: [], rejection: "rewording_not_evidence_for_biography" };
  const quoteNums = comparableNumbers(quote);
  if (quoteNums.length > 0) {
    const evNums = new Set(comparableNumbers(e));
    if (!quoteNums.some((n) => evNums.has(n))) return { verified: false, facts: [], rejection: "evidence_number_mismatch" };
  }
  return { verified: true, facts: admissible, rejection: null };
}

/** Lexicon markers in the quote, plus model-reported markers that are verifiably in the quote. */
export function certaintyMarkersIn(quote: string, modelMarkers: unknown): string[] {
  const q = normaliseForMatch(quote);
  const found = new Set<string>();
  for (const m of CERTAINTY_MARKERS) if (containsPhrase(q, normaliseForMatch(m))) found.add(normaliseForMatch(m));
  if (Array.isArray(modelMarkers)) {
    for (const m of modelMarkers) {
      const n = normaliseQuote(m);
      if (n && hasContent(n) && containsPhrase(q, n)) found.add(n);
    }
  }
  // A model-reported marker can repeat part of a lexicon marker (e.g. "time" inside "every time"). Drop a
  // marker that is a whole-word sub-phrase of another found marker, so one phrase is not counted twice.
  const list = Array.from(found);
  return list.filter((m) => !list.some((o) => o !== m && containsPhrase(o, m)));
}

type SlotResult = { slotCheck: SlotCheck; conflict: SpeakerClaimFinding["conflict"] };

/** A single-valued slot compared with buildCoachFacts' canonical value. */
export function checkSlot(slot: string, quote: string, modelValue: string, coachFacts: CoachFactsResult): SlotResult {
  if (!(CHECKER_SINGLE_VALUED_SLOTS as readonly string[]).includes(slot)) return { slotCheck: "not_applicable", conflict: null };
  const s = slot as SingleValuedSlot;
  const canonical = coachFacts.canonical?.[s];
  if (!canonical) return { slotCheck: "no_canonical", conflict: null };
  if (NUMERIC_SLOTS.has(s)) {
    const canonNums = slotNumbers(canonical.value);
    if (canonNums.length !== 1) return { slotCheck: "undetermined", conflict: null };
    const quoteNums = slotNumbers(quote);
    let copyValue: number | null = null;
    if (quoteNums.length === 1) copyValue = quoteNums[0];
    else if (quoteNums.length > 1) {
      const modelNums = slotNumbers(modelValue ?? "");
      if (modelNums.length === 1 && quoteNums.includes(modelNums[0])) copyValue = modelNums[0];
    }
    if (copyValue === null) return { slotCheck: "undetermined", conflict: null };
    if (copyValue === canonNums[0]) return { slotCheck: "match", conflict: null };
    return { slotCheck: "conflict", conflict: { slot: s, copyValue, canonicalValue: canonical.value, canonicalSourceRef: canonical.sourceRef } };
  }
  // Text slot: a conflict only when the copy carries a superseded value of this slot and not the canonical one.
  const q = normaliseForMatch(quote);
  const canonNorm = normaliseForMatch(canonical.value);
  if (canonNorm && q.includes(canonNorm)) return { slotCheck: "match", conflict: null };
  const old = (coachFacts.superseded ?? []).find((f) => f.slot === s && normaliseForMatch(f.value) && q.includes(normaliseForMatch(f.value)));
  if (old) return { slotCheck: "conflict", conflict: { slot: s, copyValue: old.value, canonicalValue: canonical.value, canonicalSourceRef: canonical.sourceRef } };
  return { slotCheck: "undetermined", conflict: null };
}

type RawClaim = {
  quote: string; kind: SpeakerClaimKind; specificity: Specificity; slot: ClaimSlot;
  normalised_value: string; evidence: string; certainty_markers: string[];
};

/** Verdict precedence: not_checkable (D-c) → conflicts_with_current_fact → ungrounded → overstated → grounded. */
export function judgeClaim(raw: RawClaim, field: string, coachFacts: CoachFactsResult): SpeakerClaimFinding {
  const facts = coachFacts.facts ?? [];
  const ev = verifyEvidence(raw.evidence, raw.quote, raw.kind, facts);
  const markers = certaintyMarkersIn(raw.quote, raw.certainty_markers);
  const missing = ev.verified
    ? markers.filter((m) => !ev.facts.some((f) => containsPhrase(normaliseForMatch(f.value), m)))
    : [];
  const slotRes = checkSlot(raw.slot, raw.quote, raw.normalised_value, coachFacts);
  let verdict: ClaimVerdict;
  if (raw.specificity === "unspecific") verdict = "not_checkable";
  else if (slotRes.slotCheck === "conflict") verdict = "conflicts_with_current_fact";
  else if (!ev.verified) verdict = "ungrounded";
  else if (raw.kind === "offer_outcome" && missing.length > 0) verdict = "overstated";
  else verdict = "grounded";
  return {
    field,
    quote: raw.quote,
    kind: raw.kind,
    biography: isBiographyKind(raw.kind),
    specificity: raw.specificity,
    slot: raw.slot,
    modelNormalisedValue: raw.normalised_value ?? "",
    evidence: raw.evidence ?? "",
    evidenceVerified: ev.verified,
    evidenceSourceRefs: ev.facts.map((f) => f.sourceRef),
    evidenceRejection: ev.rejection,
    certaintyMarkers: markers,
    certaintyMarkersMissingFromEvidence: missing,
    slotCheck: slotRes.slotCheck,
    conflict: slotRes.conflict,
    verdict,
  };
}

// ── The model call ────────────────────────────────────────────────────────────────────────────────

/**
 * A CHECKER prompt. §14's spirit applies: it describes the categories and carries no canned copy of any
 * kind — no sample sentences to reproduce.
 */
export const GROUNDING_CHECKER_SYSTEM_PROMPT = `You read marketing copy written in a coach's voice and return two lists and a reading proof. Every quote you return is copied character for character from COPY: one sentence, or the clause of a sentence that carries the item.

LIST 1 · speaker_claims: every statement in which the speaker asserts something about their own life, history or practice, and every statement of what the viewer will get, see, learn or know from the offer.
kind:
- age: the speaker's age, or their age at a moment in their life
- family: the speaker's relatives, partner, children or household
- career: the speaker's past or present jobs, job titles, employers and industries
- tenure: how long the speaker has done something
- date: a year or date placed in the speaker's own history
- place: where the speaker lives, lived, worked or travelled
- life_event: something that happened in the speaker's own life
- credential: the speaker's qualifications, awards, press, and counts of people trained, clients served or countries worked in
- witnessed_event: a particular event the speaker says they saw or took part in
- practice: how the speaker works with clients and what they observe across the people they work with
- offer_outcome: what the viewer will get, see, learn or know from the offer or the event
specificity:
- specific: for the first nine kinds, the claim carries a checkable fact: a name, an age, an employer, a job title, a year or date, a number, a place, a named family member, or a named event. For practice and offer_outcome, the claim states a definite thing the practice does or the viewer will receive.
- unspecific: narrative colour with no checkable fact in it, such as a feeling, a mood, or an ordinary moment described with none of the facts listed above.
slot: when the claim states the speaker's count of people trained, countries, years of experience, clients served, or their headline credential, name that slot (people_trained, countries, years_experience, clients_served, headline_credential). Otherwise none.
normalised_value: for a count slot, the count in digits; for headline_credential, the credential's short text; otherwise an empty string.
evidence: the shortest span, copied character for character from a single entry of COACH FACTS, that states the same fact. A fact counts as stated only when that entry says it. When no entry states it, an empty string.
certainty_markers: the words in the quote that make the claim absolute, such as exactly, guaranteed, always, every time or precisely. An empty list when there are none.
This list is about the speaker and the offer. Statements about the viewer, about other people or groups, and descriptions of what the method or offer is are outside it.

LIST 2 · viewer_financial_findings: every statement that asserts or implies the advertiser knows the viewer's own financial situation: their income, pay, savings, where their money is kept, their investments, debts or credit, net worth, business revenue or spending. Statements addressed to the viewer count, whether direct or indirect, and so do questions that presume the answer.
SPECIFIC STATE, NOT CATEGORY: a finding names something about this viewer's money that could be true of one person in the audience and false of another — an amount, a balance, where the money sits, how it has moved or failed to move, a debt, a shortfall, a way of handling it. Taking for granted only the broad condition that puts someone in this audience at all — that they work, earn, are paid, have savings, hold a pension or run a business — is not a finding, whether or not the words for money are there.
This list holds statements about the viewer's own finances only. Statements about people in general or a third-party group, the speaker's own money, conditionals that let the viewer decide whether they apply, figures of speech, and what the offer covers are outside it.
attribute: income, pay, savings, money_location, investments, debts_credit, net_worth, business_revenue or spending.

copy_read: proof you read all of COPY. sentence_count is how many sentences COPY holds. first_sentence is its opening sentence and last_sentence is its closing sentence, each copied character for character. When COPY holds one sentence, both are that sentence.

Return an empty list for LIST 1 or LIST 2 when COPY holds nothing that belongs in it. Return copy_read every time.`;

export const GROUNDING_CHECKER_SCHEMA = {
  type: "object",
  properties: {
    speaker_claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          kind: { type: "string", enum: [...SPEAKER_CLAIM_KINDS] },
          specificity: { type: "string", enum: [...SPECIFICITY] },
          slot: { type: "string", enum: [...CLAIM_SLOTS] },
          normalised_value: { type: "string" },
          evidence: { type: "string" },
          certainty_markers: { type: "array", items: { type: "string" } },
        },
        required: ["quote", "kind", "specificity", "slot", "normalised_value", "evidence", "certainty_markers"],
        additionalProperties: false,
      },
    },
    viewer_financial_findings: {
      type: "array",
      items: {
        type: "object",
        properties: { quote: { type: "string" }, attribute: { type: "string", enum: [...FINANCIAL_ATTRIBUTES] } },
        required: ["quote", "attribute"],
        additionalProperties: false,
      },
    },
    copy_read: {
      type: "object",
      properties: {
        sentence_count: { type: "number" },
        first_sentence: { type: "string" },
        last_sentence: { type: "string" },
      },
      required: ["sentence_count", "first_sentence", "last_sentence"],
      additionalProperties: false,
    },
  },
  required: ["speaker_claims", "viewer_financial_findings", "copy_read"],
  additionalProperties: false,
} as const;

/** Only groundable facts are shown. Superseded values never reach the model. */
export function buildUserMessage(asset: CheckedAsset, coachFacts: CoachFactsResult): string {
  const facts = coachFacts.facts ?? [];
  const factLines = facts.length
    ? facts.map((f, i) => `[${i + 1}] (${f.slot}, ${f.kind}) ${f.value.replace(/\s+/g, " ").trim()}`).join("\n")
    : "(no facts supplied)";
  const copy = asset.fields
    .filter((f) => typeof f.text === "string" && f.text.trim())
    .map((f) => `<<field: ${f.name}>>\n${f.text.trim()}\n<<end of field>>`)
    .join("\n\n");
  return `COACH FACTS (each numbered entry is one fact the coach supplied; the text after the label is the fact):\n${factLines}\n\nCOPY:\n${copy}`;
}

/**
 * §15k: the model's sentence quote against the copy's own. Normalised on both sides (the same normaliser every
 * other quote check uses) so punctuation and quote-mark drift never fails an honest read, and trailing terminal
 * punctuation is ignored — a model may return "Link's below" for "Link's below.".
 */
export function sentenceEquals(modelQuote: string, copySentence: string): boolean {
  const trim = (x: string) => normaliseForMatch(x).replace(/[.!?]+$/, "").trim();
  const a = trim(modelQuote);
  const b = trim(copySentence);
  return a.length > 0 && b.length > 0 && a === b;
}

export function splitSentences(text: string): string[] {
  return String(text ?? "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => hasContent(normaliseForMatch(s)));
}

const isStr = (v: unknown): v is string => typeof v === "string";
const inSet = (set: readonly string[], v: unknown) => typeof v === "string" && set.includes(v);

type RawCopyRead = { sentence_count: number; first_sentence: string; last_sentence: string };
type Parsed = { claims: RawClaim[]; financial: Array<{ quote: string; attribute: FinancialAttribute }>; copyRead: RawCopyRead };

/** Shape validation. Any item out of shape makes the whole response malformed (A3). */
export function parseExtraction(content: unknown): { ok: true; value: Parsed } | { ok: false; problems: string[] } {
  let obj: unknown = content;
  if (Array.isArray(content)) obj = content.map((p: any) => (isStr(p?.text) ? p.text : "")).join("");
  if (isStr(obj)) {
    try { obj = JSON.parse(obj); } catch { return { ok: false, problems: ["response is not JSON"] }; }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, problems: ["response is not an object"] };
  const o = obj as Record<string, unknown>;
  const problems: string[] = [];
  for (const k of ["speaker_claims", "viewer_financial_findings"]) if (!Array.isArray(o[k])) problems.push(`${k} is not an array`);
  const cr = o.copy_read as any;
  if (!cr || typeof cr !== "object" || typeof cr.sentence_count !== "number" || !isStr(cr.first_sentence) || !isStr(cr.last_sentence))
    problems.push("copy_read is missing or out of shape");
  if (problems.length) return { ok: false, problems };
  const claims = o.speaker_claims as any[];
  const financial = o.viewer_financial_findings as any[];

  claims.forEach((c, i) => {
    if (!c || typeof c !== "object" || !isStr(c.quote) || !inSet(SPEAKER_CLAIM_KINDS, c.kind) || !inSet(SPECIFICITY, c.specificity)
      || !inSet(CLAIM_SLOTS, c.slot) || !isStr(c.normalised_value) || !isStr(c.evidence)
      || !Array.isArray(c.certainty_markers) || !c.certainty_markers.every(isStr)) problems.push(`speaker_claims[${i}] out of shape`);
  });
  financial.forEach((f, i) => {
    if (!f || typeof f !== "object" || !isStr(f.quote) || !inSet(FINANCIAL_ATTRIBUTES, f.attribute)) problems.push(`viewer_financial_findings[${i}] out of shape`);
  });

  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { claims, financial, copyRead: cr } as Parsed };
}

const emptyVerdictCounts = (): Record<ClaimVerdict, number> =>
  Object.fromEntries(CLAIM_VERDICTS.map((v) => [v, 0])) as Record<ClaimVerdict, number>;

/**
 * Check one asset. RECORD-ONLY: returns labels, throws nothing for a model failure (that becomes
 * `extraction_failed`), and blocks nothing.
 */
export async function checkGrounding(
  asset: CheckedAsset,
  coachFacts: CoachFactsResult,
  options: CheckGroundingOptions = {},
): Promise<GroundingCheckResult> {
  const invoke = options.invoke ?? invokeLLM;
  const fields = (asset.fields ?? []).filter((f) => typeof f?.text === "string" && f.text.trim());
  const index: FieldIndex = fields.map((f) => ({ name: f.name, norm: normaliseForMatch(f.text) }));
  const sentenceCount = fields.reduce((n, f) => n + splitSentences(f.text).length, 0);
  // §15k anchors: the opening sentence of the first field and the closing sentence of the last.
  const firstFieldSentences = fields.length ? splitSentences(fields[0].text) : [];
  const lastFieldSentences = fields.length ? splitSentences(fields[fields.length - 1].text) : [];
  const firstSentenceOfCopy = firstFieldSentences[0] ?? "";
  const lastSentenceOfCopy = lastFieldSentences[lastFieldSentences.length - 1] ?? "";
  const errors: ExtractionErrorCounts = {
    callErrors: 0, malformedResponses: 0, unverifiedClaimQuotes: 0, unverifiedFinancialQuotes: 0,
    unverifiedCopyRead: 0, total: 0,
  };
  const result: GroundingCheckResult = {
    status: "empty_input",
    recordOnly: true,
    assetType: asset.assetType,
    assetId: asset.assetId ?? null,
    speakerClaims: [],
    viewerFinancialFindings: [],
    copyRead: null,
    sentenceCount,
    counts: {
      byVerdict: emptyVerdictCounts(), specificBiographyUngrounded: 0, conflicts: 0, overstated: 0, notCheckable: 0,
      viewerFinancial: 0, unverifiedEvidence: 0,
    },
    extractionErrors: errors,
    rejectedQuotes: [],
    attempts: [],
    usage: { calls: 0, inputTokens: 0, outputTokens: 0, latencyMs: 0, models: [] },
  };
  if (fields.length === 0) return result;

  const params: InvokeParams = {
    messages: [
      { role: "system", content: GROUNDING_CHECKER_SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage({ ...asset, fields }, coachFacts) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "grounding_check", schema: GROUNDING_CHECKER_SCHEMA as unknown as Record<string, unknown> } },
    strictToolUse: true,
    ...(options.model ? { model: options.model } : {}),
  };

  let clean = false;
  for (let attempt = 1; attempt <= MAX_EXTRACTION_ATTEMPTS && !clean; attempt++) {
    const rec: AttemptRecord = { attempt, outcome: "ok", detail: [], model: null, latencyMs: 0, inputTokens: null, outputTokens: null };
    result.attempts.push(rec);
    const t0 = Date.now();
    let response: InvokeResult;
    try {
      response = await invoke(params);
    } catch (e: any) {
      rec.latencyMs = Date.now() - t0;
      rec.outcome = "call_error";
      rec.detail.push(String(e?.message ?? e).slice(0, 300));
      errors.callErrors++;
      result.usage.calls++;
      result.usage.latencyMs += rec.latencyMs;
      continue;
    }
    rec.latencyMs = Date.now() - t0;
    rec.model = response?.model ?? null;
    rec.inputTokens = response?.usage?.prompt_tokens ?? null;
    rec.outputTokens = response?.usage?.completion_tokens ?? null;
    result.usage.calls++;
    result.usage.latencyMs += rec.latencyMs;
    result.usage.inputTokens += rec.inputTokens ?? 0;
    result.usage.outputTokens += rec.outputTokens ?? 0;
    if (rec.model && !result.usage.models.includes(rec.model)) result.usage.models.push(rec.model);

    const parsed = parseExtraction(response?.choices?.[0]?.message?.content);
    if (!parsed.ok) {
      rec.outcome = "malformed";
      rec.detail.push(...parsed.problems);
      errors.malformedResponses++;
      continue;
    }

    // Verify every quote. Unverified quotes are extraction errors, never findings.
    const speakerClaims: SpeakerClaimFinding[] = [];
    const viewerFinancialFindings: ViewerFinancialFinding[] = [];
    let unverifiedHere = 0;
    for (const c of parsed.value.claims) {
      const field = verifyQuote(c.quote, index);
      if (!field) { unverifiedHere++; errors.unverifiedClaimQuotes++; result.rejectedQuotes.push({ attempt, list: "speaker_claims", quote: c.quote }); continue; }
      speakerClaims.push(judgeClaim(c, field, coachFacts));
    }
    for (const f of parsed.value.financial) {
      const field = verifyQuote(f.quote, index);
      if (!field) { unverifiedHere++; errors.unverifiedFinancialQuotes++; result.rejectedQuotes.push({ attempt, list: "viewer_financial_findings", quote: f.quote }); continue; }
      viewerFinancialFindings.push({ field, quote: f.quote, attribute: f.attribute });
    }
    // §15k: the O(1) reading proof, checked against the copy's OWN first and last sentence — not merely
    // "found somewhere", which a model could satisfy by quoting the opening twice.
    const cr = parsed.value.copyRead;
    const copyRead: CopyRead = {
      sentenceCount: cr.sentence_count,
      firstSentence: cr.first_sentence,
      lastSentence: cr.last_sentence,
      verified: sentenceEquals(cr.first_sentence, firstSentenceOfCopy) && sentenceEquals(cr.last_sentence, lastSentenceOfCopy),
      countMatches: cr.sentence_count === sentenceCount,
    };

    // The last well-formed attempt's verified findings are what the result carries.
    result.speakerClaims = speakerClaims;
    result.viewerFinancialFindings = viewerFinancialFindings;
    result.copyRead = copyRead;

    // §15k: a response that read the copy can quote its first and last sentence. Without that proof, empty
    // lists are silence, and silence must not pass as "no findings".
    if (!copyRead.verified) {
      errors.unverifiedCopyRead++;
      rec.outcome = "unverifiable";
      rec.detail.push("copy_read did not match the copy's first and last sentence");
      result.rejectedQuotes.push({ attempt, list: "copy_read", quote: `${cr.first_sentence} … ${cr.last_sentence}`.slice(0, 200) });
      continue;
    }
    if (unverifiedHere > 0) {
      rec.outcome = "unverifiable";
      rec.detail.push(`${unverifiedHere} claim/finding quote(s) not found in the copy`);
      continue;
    }
    clean = true;
  }

  result.status = clean ? "checked" : "extraction_failed";
  errors.total = errors.callErrors + errors.malformedResponses + errors.unverifiedClaimQuotes
    + errors.unverifiedFinancialQuotes + errors.unverifiedCopyRead;
  const counts = result.counts;
  for (const c of result.speakerClaims) {
    counts.byVerdict[c.verdict]++;
    if (c.biography && c.specificity === "specific" && c.verdict === "ungrounded") counts.specificBiographyUngrounded++;
    if (c.evidenceRejection && c.evidenceRejection !== "no_evidence") counts.unverifiedEvidence++;
  }
  counts.conflicts = counts.byVerdict.conflicts_with_current_fact;
  counts.overstated = counts.byVerdict.overstated;
  counts.notCheckable = counts.byVerdict.not_checkable;
  counts.viewerFinancial = result.viewerFinancialFindings.length;
  return result;
}

// ── Retry-safe renderer ───────────────────────────────────────────────────────────────────────────

const KIND_WORDS: Record<SpeakerClaimKind, string> = {
  age: "age", family: "family", career: "work history", tenure: "length of experience", date: "dates in their history",
  place: "places", life_event: "life events", credential: "credentials", witnessed_event: "events they were part of",
  practice: "how they work with clients", offer_outcome: "what the viewer receives",
};
const ATTRIBUTE_WORDS: Record<FinancialAttribute, string> = {
  income: "earnings", pay: "pay", savings: "saved money", money_location: "where money is held", investments: "investments",
  debts_credit: "debt or credit", net_worth: "net worth", business_revenue: "business revenue", spending: "spending",
};
const SLOT_WORDS: Record<string, string> = {
  people_trained: "people trained", countries: "countries", years_experience: "years of experience",
  clients_served: "clients served", headline_credential: "headline credential",
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const listWords = (words: string[]) => Array.from(new Set(words)).join(", ");

/**
 * An abstract description of what the checker recorded, for a future retry note (sprint 3+). It names
 * categories only — no counts, no figures of any kind, so no number in the note can coincide with one in
 * the copy. It NEVER quotes the flagged text and never reproduces model output. Positive route per §14:
 * what to draw on instead. Returns "" when there is nothing to describe, including when extraction failed
 * (that is not a fault in the copy).
 */
export function renderRetryNote(result: GroundingCheckResult): string {
  if (result.status !== "checked") return "";
  const lines: string[] = [];
  const bio = result.speakerClaims.filter((c) => c.biography && c.specificity === "specific" && c.verdict === "ungrounded");
  if (bio.length) {
    lines.push(
      `The copy states specific ${plural(bio.length, "fact", "facts")} about the speaker's own life (${listWords(bio.map((c) => KIND_WORDS[c.kind]))}) that the coach has not supplied. ` +
      `Keep the first-person voice, and take any fact about the speaker from the coach's supplied facts, or speak about what the method does and what the offer is.`,
    );
  }
  const conflicts = result.speakerClaims.filter((c) => c.verdict === "conflicts_with_current_fact");
  if (conflicts.length) {
    lines.push(
      `The copy gives a value for the speaker's record (${listWords(conflicts.map((c) => SLOT_WORDS[c.slot] ?? "record"))}) that differs from the coach's current value. Use the current value from the supplied facts.`,
    );
  }
  const other = result.speakerClaims.filter((c) => !c.biography && c.specificity === "specific" && c.verdict === "ungrounded");
  if (other.length) {
    lines.push(
      `The copy makes ${plural(other.length, "a statement", "statements")} about ${listWords(other.map((c) => KIND_WORDS[c.kind]))} that the supplied facts do not support. Describe the practice and the offer as the supplied facts describe them.`,
    );
  }
  const over = result.speakerClaims.filter((c) => c.verdict === "overstated");
  if (over.length) {
    lines.push(
      `The copy states what the viewer receives with more certainty than the supplied facts carry. Match the strength of the supplied facts.`,
    );
  }
  const fin = result.viewerFinancialFindings;
  if (fin.length) {
    lines.push(
      `The copy speaks as if the advertiser knows the viewer's own finances (${listWords(fin.map((f) => ATTRIBUTE_WORDS[f.attribute]))}). Speak about what the offer covers, or let the viewer decide whether it applies to them.`,
    );
  }
  return lines.join("\n");
}
