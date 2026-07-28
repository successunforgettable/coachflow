/**
 * trackRecordClaims — the METHOD vs TRACK-RECORD discriminator.
 *
 * 🔴 THE GOVERNING RULE (Arfeen, 2026-07-28). A coach may state what their method is
 * DESIGNED to produce — that is their own product and professional judgement, and needs
 * no evidence. What the model may NOT do is assert something that ALREADY HAPPENED:
 * past results, counts of real people, named people, client statistics — unless the
 * coach supplied it.
 *
 *     Test: is this a claim about what the method DOES,
 *           or about something that ALREADY HAPPENED?
 *
 * SUPPLIED IS TRUE. If the coach supplied it, ZAP treats it as fact — full stop. Not our
 * job to verify, categorise, or ask for proof. Explicitly NOT limited to paying clients or
 * formal testimonials: beta testers, free clients, friends, family, their own child all
 * count equally, and ZAP must never ask which. There are deliberately no relationship
 * categories and no evidence fields in this module.
 *
 * ── Why this replaces surface-form fabrication matching ──────────────────────
 * The old shape detected FABRICATION by surface form, then consulted the corpus only to
 * excuse a hit a regex had already made. That made the regex the sole decider and the
 * evidence layer purely subtractive — so a phrasing the regex missed could never be
 * caught, by construction. "94% of my clients" passed while "87% of consultants" blocked.
 *
 * This module inverts it: detect PROOF-SHAPED claims (a small closed set — the forms of
 * evidence are finite, the forms of invention are not), classify each as METHOD or
 * TRACK-RECORD, and require grounding only for TRACK-RECORD.
 *
 * ⚠️ SEPARATE FROM COMPLIANCE, deliberately. This module answers "did the MODEL invent
 * this?" only. Whether copy READS like a claim Meta polices is complianceAxis's question,
 * decided on FORM not truth. The two must be free to disagree: a genuinely true,
 * coach-supplied testimonial PASSES here and may still be flagged there — that flag is
 * CORRECT, not a false positive. Supplied-ness must never exempt copy from compliance.
 */

import type { CoachCorpus, ProofSupplied } from "./groundingCorpus";

export type ClaimKind =
  | "possessive_population"   // "my clients", "our students" — the coach's ACTUAL people
  | "people_count"            // "over 200 families", "two hundred parents"
  | "named_person_outcome"    // "Sarah got her baby sleeping…"
  | "past_client_event"       // "after working with…", "I've helped…"
  | "client_narrative"        // "A first-time parent … had been feeding to sleep since birth"
  | "outcome_statistic"       // "94%", "9 out of 10"
  | "stated_guarantee"        // "or your money back"
  | "third_party_attribution"; // "featured in…", "according to…"

export type Claim = { kind: ClaimKind; matched: string; index: number };

/**
 * People the coach could have actually served. The discriminator turns on PEOPLE:
 * "80% of my week" is self-description (a week is not a person) and must stay legal —
 * it was 80 of 137 blocking hits across 101 real prod ICPs. "94% of my clients" is a
 * track-record claim. The old STAT_SELF_DESCRIPTIVE exemption could not tell them apart
 * because it matched "of my" alone; that is exactly the false negative this fixes.
 */
const PERSON_NOUNS = [
  // ⚠️ PEOPLE THE COACH COULD HAVE SERVED — nothing else. Measured on 15,586 prod rows,
  // a looser list produced a false-positive flood: "coaching business" 326×, "our ideal
  // customer" 179×, "one person" 158×, "two kids" 67×. Those are ORG nouns, AUDIENCE
  // description and PERSONA detail, none of which assert a track record. They are excluded:
  //   business/team    — an organisation is not a person the coach served
  //   person/people    — too generic; "one person" is ordinary prose, not a client count
  //   kid/child/baby   — the CLIENT'S dependants, not the coach's clients
  "client", "clients", "customer", "customers", "student", "students", "member", "members",
  "family", "families", "parent", "parents", "mum", "mums", "mom", "moms", "mother", "mothers",
  "dad", "dads", "father", "fathers", "couple", "couples",
  "founder", "founders", "owner", "owners", "consultant", "consultants", "coachee", "coachees",
  "patient", "patients", "participant", "participants", "attendee", "attendees",
  "subscriber", "subscribers", "professional", "professionals",
];
const PERSON = `(?:${PERSON_NOUNS.join("|")})`;

/** Spelled-out numbers — "over two hundred families" carries no digit and must still count. */
const NUMBER_WORDS =
  "(?:a\\s+few|several|dozens?|scores?|hundreds?|thousands?|one|two|three|four|five|six|seven|eight|nine|ten|" +
  "eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)";

/** "my clients", "our first students", "clients of mine". */
const POSSESSIVE_POPULATION_RE =
  new RegExp(`\\b(?:my|our)\\s+(?:\\w+\\s+){0,2}?${PERSON}\\b|\\b${PERSON}\\s+of\\s+(?:mine|ours)\\b`, "gi");

/** "over 200 families", "two hundred parents", "hundreds of clients". */
const PEOPLE_COUNT_RE =
  new RegExp(
    `\\b(?:over|more than|upwards of|nearly|almost|around|about)?\\s*` +
    `(?:\\d[\\d,]*|${NUMBER_WORDS}(?:\\s+${NUMBER_WORDS})?)\\s+` +
    `(?:\\w+\\s+){0,2}?${PERSON}\\b`,
    "gi",
  );

/** Verbs that mark a result already delivered to someone. */
const OUTCOME_VERB =
  "(?:went from|got|grew|scaled|doubled|tripled|landed|booked|made|earned|added|hit|reached|" +
  // "is now" / "was now" are too weak to mark a delivered result: measured on prod they
  // matched "Enrolment is now…" across six services, which is scheduling copy, not a
  // client outcome. A result verb has to describe something the person DID or REACHED.
  "dropped|lost|saw|achieved|finished|completed|started sleeping)";

/**
 * A bare first name plus an outcome verb — "Sarah got her baby sleeping 12 hours in 4 days".
 * The old TESTIMONIAL_RE required a literal opener ("one of my clients", "a client"), so a
 * plain first name — the most natural way to write a testimonial — never matched at all.
 */
const NAMED_PERSON_OUTCOME_RE =
  new RegExp(`\\b[A-Z][a-z]{2,}\\b(?:'s)?\\s+(?:\\w+\\s+){0,3}?${OUTCOME_VERB}\\b`, "g");

/**
 * Capitalised words that open sentences but name nobody. Without this, "One of my clients
 * went from…" reads "One" as a client's name — the same class of false positive that
 * "Every Monday" and "When I'm" caused in the July sweep.
 */
const NOT_A_NAME = new Set([
  "one", "once", "this", "that", "these", "those", "after", "before", "every", "when", "while", "since",
  "most", "many", "some", "your", "you", "the", "and", "but", "for", "nor", "yet", "our", "their",
  "there", "here", "now", "then", "what", "who", "why", "how", "where", "which", "another", "each",
  "both", "either", "neither", "during", "until", "unless", "because", "although", "though", "with",
  "without", "from", "into", "over", "under", "again", "still", "even", "just", "only", "also",
]);

/** "after working with…", "I've helped…", "having coached…" — the coach's own past delivery. */
const PAST_CLIENT_EVENT_RE =
  new RegExp(
    `\\b(?:after|from|having|since)?\\s*(?:work(?:ing|ed)\\s+with|help(?:ing|ed)|coach(?:ing|ed)|` +
    `train(?:ing|ed)|guid(?:ing|ed)|serv(?:ing|ed))\\s+` +
    `(?:over|more than|upwards of)?\\s*(?:\\d[\\d,]*|${NUMBER_WORDS}(?:\\s+${NUMBER_WORDS})?|my|our|the)?\\s*` +
    `(?:\\w+\\s+){0,2}?${PERSON}\\b|\\bI(?:'ve| have)\\s+(?:helped|coached|worked with|trained|served)\\b`,
    "gi",
  );

/**
 * The INVERTED form: the person comes BEFORE the verb — "A parent I worked with", "parents
 * I work with", "clients I've helped". PAST_CLIENT_EVENT_RE only matches verb-then-person,
 * so a live 2026-07-29 run produced "A parent I worked with — back-to-work countdown
 * ticking…" for a zero-client coach and it passed clean. The delivery verb is required, so
 * "the parents I want to reach" (a method claim) still passes.
 */
const INVERTED_CLIENT_EVENT_RE =
  new RegExp(`\\b(?:a|an|one|another|the|most|many|some)?\\s*${PERSON}\\s+(?:that\\s+|who(?:m)?\\s+)?I(?:'ve| have)?\\s+` +
    `(?:work|works|worked|working|coach|coaches|coached|coaching|help|helps|helped|helping|` +
    `train|trains|trained|training|serve|serves|served|serving)\\b`, "gi");

/**
 * The un-named case study: "A first-time parent, baby around seven months, HAD BEEN feeding
 * to sleep since birth… By night four the transfer was holding." No name, no count, no
 * percentage — so every count/name/stat detector misses it, yet it is a full invented client
 * story. The tell is an INDEFINITE individual plus PAST-TENSE narration: a method claim is
 * written generically and in the present ("most families reach…"), never as one person's
 * completed history.
 */
const PAST_TENSE_NARRATION =
  // Contractions matter: "A mum who'd been feeding to sleep" is the commonest case-study
  // opener there is, and "who'd been" never matches a plain "had been" alternation.
  "(?:\\w+'d\\s+been|had been|had|was|were|went|got|reached|saw|started|stopped|came|finished|" +
  "worked through|used to|ended up|turned out|managed)";
// ⚠️ The window is deliberately TIGHT (40 chars). A real case study narrates in the past
// immediately — "A mum who'd been feeding to sleep", "A first-time parent, baby around seven
// months, had been…". A generic present-tense scenario does not: a live run produced
// "a parent checks the time and thinks — I knew this was…", where the only past-tense word
// sat 46 characters away inside quoted speech. A wide window reads that as a case study and
// blocks legitimate copy, which is the one failure mode a launch-stage coach must never hit.
const INDEFINITE_CLIENT_NARRATIVE_RE =
  new RegExp(`\\b(?:a|an|one|another)\\s+(?:[\\w-]+\\s+){0,3}?${PERSON}\\b[^.!?]{0,40}?\\b${PAST_TENSE_NARRATION}\\b`, "gi");

const OUTCOME_STATISTIC_RE =
  /\b\d{1,3}(?:\.\d+)?\s?%|\b\d+\s*(?:out of|in)\s*\d+\b|\b\d+(?:\.\d+)?x\s+(?:more|faster|better|higher)\b/gi;

/**
 * Widened from the old GUARANTEE_RE, which required "money-back guarantee" as a unit and so
 * missed the commonest phrasing of all — a trailing "or your money back".
 */
const GUARANTEE_RE =
  /\b(?:money[-\s]?back(?:\s+guarantee)?|risk[-\s]free|100%\s+guarantee|satisfaction guarantee|full refund|guaranteed refund|we guarantee|I guarantee|guaranteed results?|guarantee(?:d)?\s+or\s+your\s+money\s+back)\b|\bor\s+your\s+money\s+back\b/gi;

/**
 * An attribution cue ALONE is not a claim — "according to the plan" names nobody. The risk is
 * a cue plus a NAMED entity presented as the source. Requiring the name also avoids
 * over-blocking ordinary prose, and it is why the old ATTRIBUTION_CUE gate is no longer
 * needed: a bare first name with an outcome is caught by NAMED_PERSON_OUTCOME_RE instead of
 * depending on a cue that a testimonial rarely contains.
 */
const THIRD_PARTY_ATTRIBUTION_RE =
  /\b(?:[Ff]eatured (?:in|on)|[Aa]s seen (?:in|on)|[Ss]een (?:in|on)|[Aa]ccording to|[Ee]ndorsed by|[Bb]acked by|[Rr]ecommended by|[Cc]ertified by|[Tt]rained by|[Ss]tudied (?:under|with)|[Pp]artnered with)\s+(?:the\s+)?((?:[A-Z][\w&'.-]*\s*){1,4})/g;

/** Percentages that are intensifier or hedged perception, not evidence. */
const STAT_IDIOMATIC_AFTER =
  /^\s*(?:sure|certain|convinced|committed|honest|right|clear|focused|present|there|yours|mine|worth it)\b/i;
const STAT_HEDGED_BEFORE = /\b(?:about|roughly|maybe|around|feels? like|probably|nearly|almost|like)\s*$/i;

/**
 * A percentage about the speaker's OWN time or work is self-description: "80% of my week".
 * Narrowed from the old rule so it exempts only NON-PERSON possessions — the old form
 * matched "of my" alone and therefore exempted "94% of my clients" too.
 */
const NON_PERSON_POSSESSION_RE =
  new RegExp(`\\b(?:of|in|on)\\s+(?:my|our)\\s+(?!(?:\\w+\\s+){0,2}?${PERSON}\\b)\\w+|` +
    `\\bI\\s+(?:spend|spent|give|gave|lose|lost|waste|wasted|put)\\b`, "i");

/**
 * A forward promise addressed to the reader — "in 8 weeks you will land three retainer
 * clients" — is a claim about what the method is DESIGNED to produce, so under Rule 1 it is
 * not a track record and must not read as one just because it contains a count of people.
 */
const FORWARD_SECOND_PERSON_RE =
  /\b(?:you(?:'ll| will| can| could| get| land| book| have)|your\s+\w+\s+(?:will|can))\b/i;

function windowAround(text: string, index: number, len: number, pad = 40): string {
  return text.slice(Math.max(0, index - pad), index + len + pad);
}

function statIsEvidence(text: string, m: RegExpMatchArray): boolean {
  const i = m.index ?? 0;
  const before = text.slice(Math.max(0, i - 24), i);
  const after = text.slice(i + m[0].length, i + m[0].length + 24);
  if (STAT_IDIOMATIC_AFTER.test(after) || STAT_HEDGED_BEFORE.test(before)) return false;
  if (NON_PERSON_POSSESSION_RE.test(windowAround(text, i, m[0].length))) return false;
  return true;
}

const all = (t: string, re: RegExp): RegExpMatchArray[] => Array.from(t.matchAll(new RegExp(re.source, re.flags)));

/**
 * Every proof-shaped claim in the text. A claim NOT returned here is a method claim and is
 * always allowed — that is Rule 1's "what the method is designed to produce".
 */
export function detectProofShapedClaims(text: string): Claim[] {
  if (!text || !text.trim()) return [];
  const claims: Claim[] = [];
  const add = (kind: ClaimKind, m: RegExpMatchArray) =>
    claims.push({ kind, matched: m[0].trim().slice(0, 160), index: m.index ?? 0 });

  for (const m of all(text, POSSESSIVE_POPULATION_RE)) add("possessive_population", m);
  for (const m of all(text, PEOPLE_COUNT_RE)) {
    if (FORWARD_SECOND_PERSON_RE.test(windowAround(text, m.index ?? 0, m[0].length, 60))) continue;
    add("people_count", m);
  }
  for (const m of all(text, NAMED_PERSON_OUTCOME_RE)) {
    const lead = m[0].match(/^[A-Z][a-z]+/)?.[0].toLowerCase() ?? "";
    if (NOT_A_NAME.has(lead)) continue;
    add("named_person_outcome", m);
  }
  for (const m of all(text, PAST_CLIENT_EVENT_RE)) add("past_client_event", m);
  for (const m of all(text, INVERTED_CLIENT_EVENT_RE)) add("past_client_event", m);
  for (const m of all(text, INDEFINITE_CLIENT_NARRATIVE_RE)) add("client_narrative", m);
  for (const m of all(text, OUTCOME_STATISTIC_RE)) if (statIsEvidence(text, m)) add("outcome_statistic", m);
  for (const m of all(text, GUARANTEE_RE)) add("stated_guarantee", m);
  for (const m of all(text, THIRD_PARTY_ATTRIBUTION_RE)) add("third_party_attribution", m);

  return claims;
}

/**
 * Is this claim carried by what the coach actually supplied?
 *
 * 🔑 THE DETERMINISTIC BEGINNER RULE. `isLaunchStage` means the coach supplied no proof of
 * ANY kind, so a track-record claim is unsupported BY DEFINITION — no reasoning, no model
 * call, no corpus search needed. The signal was already computed at groundingCorpus.ts and
 * then discarded; wiring it is the single cheapest correctness win available here.
 */
/**
 * Has the coach told us they have served anyone at all? SUPPLIED IS TRUE — a count, a
 * background line, a testimonial name or a proof stat all count equally, and ZAP never asks
 * whether those people paid. A coach who has said so owns "my clients" and past-delivery
 * language without needing the exact phrase to appear in their own words.
 */
function hasClientEvidence(supplied: ProofSupplied): boolean {
  return !!(supplied.coachBackground || (supplied.totalCustomers ?? 0) > 0 ||
            supplied.testimonialNames.some(Boolean) || supplied.socialProofStat ||
            (supplied.totalReviews ?? 0) > 0);
}

export function claimIsGrounded(claim: Claim, corpus: CoachCorpus, supplied: ProofSupplied): boolean {
  if (claim.kind === "stated_guarantee") {
    return !!(supplied.guaranteeType || supplied.guaranteeDuration);
  }

  if (corpus.isLaunchStage) return false;

  const hay = [
    corpus.text, supplied.socialProofStat, supplied.averageRating, supplied.coachBackground,
    supplied.pressFeatures, supplied.totalCustomers, supplied.totalReviews,
    ...supplied.testimonialNames,
  ].filter(Boolean).join(" ").toLowerCase();

  switch (claim.kind) {
    case "outcome_statistic": {
      const digits = claim.matched.match(/\d[\d.,]*/g) ?? [];
      return digits.length > 0 && digits.every((d) => hay.includes(d));
    }
    case "named_person_outcome": {
      const names = supplied.testimonialNames.filter(Boolean).map((n) => String(n).toLowerCase());
      const first = claim.matched.match(/\b[A-Z][a-z]{2,}\b/)?.[0].toLowerCase() ?? "";
      return names.some((n) => n.includes(first)) || hay.includes(first);
    }
    case "possessive_population":
    case "past_client_event":
    case "client_narrative": {
      // SUPPLIED IS TRUE: a coach who has told us about their background owns past-delivery
      // language. Only a stated COUNT still has to match a supplied figure.
      const digits = claim.matched.match(/\d[\d,]*/g) ?? [];
      if (digits.length > 0) return digits.every((d) => hay.includes(d.replace(/,/g, "")) || hay.includes(d));
      return hasClientEvidence(supplied);
    }
    case "people_count": {
      const digits = claim.matched.match(/\d[\d,]*/g) ?? [];
      if (digits.length > 0) return digits.every((d) => hay.includes(d.replace(/,/g, "")) || hay.includes(d));
      return hasClientEvidence(supplied) || hay.includes(claim.matched.toLowerCase());
    }
    default:
      return hay.includes(claim.matched.toLowerCase());
  }
}

/** Claims the coach's own material does not carry. Empty ⇒ nothing invented. */
export function ungroundedClaims(text: string, corpus: CoachCorpus, supplied: ProofSupplied): Claim[] {
  return detectProofShapedClaims(text).filter((c) => !claimIsGrounded(c, corpus, supplied));
}
