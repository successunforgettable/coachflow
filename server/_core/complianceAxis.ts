/**
 * complianceAxis.ts — Meta ad-policy checks that run on GENERATED OUTPUT.
 *
 * Authoritative source: docs/compliance/META_AD_COMPLIANCE_REFERENCE.md §3.3.
 * TIER 1 ONLY becomes enforcement logic. Nothing from the reference's do-not-build
 * list appears here — no "MARS", no Account Health Score, no policy numbers, no
 * percentages, no review-time thresholds. Those are unverifiable, and a rule built on
 * fake precision breaks every campaign at once if the assumption was wrong.
 *
 * WHY OUTPUT AND NOT THE SERVICE RECORD. A prod-data investigation (2026-07-27, 124
 * services) found the risk is created at COPY TIME, not offer time: a career-pivot
 * service row is clean in every field while its generated ad produces the violation.
 * It also found that `services.category` is `coaching|speaking|consulting` — delivery
 * modality, not topic — and that the sharpest §1.1 exposures in the whole dataset
 * (a consultancy for ex-prisoners → criminal record; a programme for Indian women in
 * the U.S. → ethnicity) contain no health or money vocabulary at all and would be
 * classified "low risk" by any keyword band. Hence: no classifier, no stored tier.
 *
 * HIT SHAPE deliberately mirrors _core/fabricationValidator.ts (held at 6a89396) so the
 * two axes merge into ONE pass with ONE failContext when the validator returns. That
 * matters: run as separate passes, a fabrication retry can reintroduce a compliance
 * violation and vice versa, with no single retry seeing both constraints. See
 * `checkOutput` below for the seam.
 *
 * TIERS HERE:
 *   tier 1 → blocking (retry at generation, block at publish)
 *   tier 2 → ADVISORY, never blocks, surfaced to the coach
 */

import { complianceFilter } from "../lib/complianceFilter";
// Static import, NOT a lazy require: this module is ESM, and require() is not defined at
// runtime here. The lazy form type-checked and passed every unit test — the tests call
// checkComplianceAxis directly and never exercised checkOutput WITH grounding — but threw
// on the first real generation. Caught by the end-to-end run, not by the suite.
import { checkFabrication } from "./fabricationValidator";

export type ComplianceClass =
  | "second_person_protected_attribute"   // §1.1  check 1
  | "audience_attribute_descriptor"       // §1.1  check 1 (short-field form)
  | "negative_self_perception"            // §1.3  check 2
  | "crypto_trade_endorsement"            // §1.8  check 4
  | "deceptive_urgency"                   // §1.6  check 6 (delegated to complianceFilter)
  | "ad_to_page_mismatch"                 // §1.4  check 3 (publish only)
  | "special_ad_category_employment"      // Tier-2 evidence — ADVISORY ONLY, check 5
  | "register_diagnostic_address";        // TIER 3 house style — LABELS, never blocks

export type ComplianceHit = {
  classId: ComplianceClass;
  tier: 1 | 2;
  description: string;
  matched: string;
  location: string;
};

export type ComplianceAxisResult = {
  ok: boolean;                 // true when nothing BLOCKING was found (advisories don't affect this)
  hits: ComplianceHit[];
  blocking: ComplianceHit[];   // tier 1
  advisories: ComplianceHit[]; // tier 2 — surfaced, never gated
  failContext: string;
};

// ─── Vocabulary ──────────────────────────────────────────────────────────────
// Sourced from Meta's own enumerated list (§1.1). Kept as attribute NOUNS; the
// grammar engine below decides whether a given sentence asserts one about the reader.

const PROTECTED_ATTRIBUTE_TERMS = [
  // physical / mental health, incl. medical conditions
  "body", "weight", "fat", "obese", "overweight", "belly", "waistline", "physique",
  "health", "illness", "condition", "diagnosis", "diagnosed", "symptoms", "pain",
  "anxiety", "anxious", "depression", "depressed", "burnout", "burnt out", "exhausted",
  "exhaustion", "insomnia", "sleepless", "menopause", "postpartum", "post-natal",
  "pregnancy", "pre-pregnancy", "fertility", "disability", "disabled", "chronic",
  // Named medical conditions — physical or mental health is enumerated in §1.1, and the
  // enforcement narrowing makes this vocabulary load-bearing: a burden frame now blocks
  // only when it names an enumerated attribute, so a condition missing from this list
  // would silently stop blocking. ("Tired of your acne?" is the reference's own §3.1
  // prohibited example and was missed until this was added.)
  "acne", "eczema", "psoriasis", "rosacea", "migraine", "migraines", "ibs", "reflux",
  "thyroid", "diabetes", "arthritis", "back pain", "joint pain", "blood pressure",
  "cholesterol", "adhd", "autism", "ptsd", "ocd", "burn-out", "panic attacks",
  "addiction", "alcohol", "menopausal", "perimenopause", "endometriosis", "fatigue",
  "hair loss", "balding", "cellulite", "bloating", "gut health",
  // vulnerable financial status
  "broke", "debt", "in debt", "debts", "bankrupt", "overdrawn", "can't afford", "cannot afford",
  "struggling financially", "financially stuck", "paycheck to paycheck",
  "pay cheque to pay cheque", "savings", "no money",
  // age / gender identity / orientation / religion / race / ethnicity
  "single mum", "single mom", "divorced", "widowed", "immigrant", "expat",
  // criminal record
  "criminal record", "conviction", "prison", "ex-offender", "ex-prisoner", "incarcerated",

  // ── VOCABULARY EXPANSION (2026-07-27) ────────────────────────────────────────
  // Triaged against 3,006 real texts (prod ad copy + prod ICP prose + post-register
  // generated blocks): these 62 terms produced ZERO new blocks, while the rejected
  // high-risk group (reset, reclaim, healing, career transitions) produced all 13 —
  // "reset" and "reclaim" are PRODUCT NAMES in real prod copy. Marketing-industry terms
  // (CAPI, ROAS, MRR…) and the mental symptom/proxy group (executive function, sensory
  // regulation — service categories more often than health assertions) were rejected.
  //
  // A protected noun NEVER blocks on its own. Every term below reaches a verdict only
  // through the anchoring engine: 22/22 planted cases block when predicated of the
  // reader, 22/22 inverses pass as the offer's or the coach's own account.
  // enumerated attributes on Meta's own §1.1 list that were missing — the 269 (criminal record)
  // and 203 (ethnicity) cases exposed this class as the real blind spot
  "citizenship", "citizenship status", "residency status", "immigration status", "green card",
  "visa status", "undocumented", "asylum", "voting status", "registered to vote",
  "trade union", "union member", "union membership",
  // named medical conditions (physical health, §1.1)
  "diabetes", "hypertension", "cardiovascular", "reproductive health", "oncology", "cancer",
  "autoimmune", "hiv", "addiction", "eating disorder", "menopause", "sibo", "ibs", "leaky gut",
  "celiac", "coeliac", "crohn", "overweight", "obesity",
  // symptoms and proxies — only meaningful because the anchoring engine decides predication:
  // "Tired of your bloating?" blocks, "the meal plan reduces bloating" does not
  "bloating", "slow digestion", "chronic pain", "night sweats", "acne scars", "post-acne",
  "thinning hair", "hair loss", "wrinkles", "constipation", "high blood pressure",
  "sugar cravings",
  // mental health conditions (§1.1)
  "adhd", "autism", "dyslexia", "bipolar", "neurodivergent", "sensory impairment",
  "cognitive decline",
  // vulnerable financial status (§1.1)
  "bankruptcy", "credit score", "unemployment", "unemployed", "low income",
  // everyday financial-vulnerability phrasing
  "money is tight", "paycheck to paycheck", "paycheque to paycheque", "financial insecurity",
  "financial struggle", "financial vulnerability",
];

// Predicates that assert a DEFICIT about whoever the sentence is about. These are what
// turn an otherwise-neutral noun into an assertion — "the mirror" is nothing until it
// is "a daily reminder that something hasn't come back".
const DEFICIT_PREDICATES = [
  "don't fit", "doesn't fit", "do not fit", "does not fit", "no longer fit",
  "hasn't come back", "has not come back", "never came back", "not come back",
  "no longer belongs", "doesn't belong", "does not belong",
  "stopped working", "isn't working", "is not working", "never works",
  "can't", "cannot", "couldn't", "unable to", "failing", "failed",
  "losing", "lost", "stuck", "trapped", "behind", "falling behind",
  "not enough", "never enough", "running on empty", "nothing left",
  "avoid", "avoiding", "hide", "hiding", "dread", "dreading", "ashamed", "embarrassed",
];

// Intimate-possession nouns that carry an implied owner even with a definite article.
// "The clothes still don't fit" has no pronoun but is unmistakably about someone.
// BODY-PROXY nouns. Meta §1.3 prohibits copy that implies or generates negative
// self-perception about the body; "the clothes still don't fit" and "the mirror is a
// daily reminder" do exactly that without naming a body part. ENUMERATED → tier 1.
/**
 * Attribute nouns that are NEUTRAL in isolation — everyone has a body, weight and skin.
 * These block only when the sentence characterises them negatively. Diagnoses, financial
 * status and the enumerated identity attributes are NOT in this list: naming one about the
 * reader is the assertion, with or without a negative predicate.
 */
const NEUTRAL_ATTRIBUTE_TERMS = ["body", "weight", "skin", "hair", "face", "energy", "sleep", "savings"];

const BODY_PROXY_NOUNS = [
  "clothes", "jeans", "dress", "shirt", "trousers", "wardrobe",
  "mirror", "camera", "photo", "photos", "photograph", "photographs", "scale", "scales",
  "reflection", "body", "stomach", "arms", "legs", "face", "skin", "hair",
];

// Employment and history nouns. NOT on Meta's enumerated list — a CV gap, a work history
// or a career record is not a protected attribute. Diagnostic address about these is
// house style (Tier 3), so it LABELS and no longer blocks. See ENFORCEMENT SCOPE below.
const NON_ENUMERATED_POSSESSION_NOUNS = ["cv", "resume", "résumé", "record", "history", "gap"];

// Second-person assertions of what the reader is DOING or has DONE. This is the
// canonical prohibited form in the reference (§3.1) — "You're sitting in the car park to
// delay going in" names no attribute at all, yet is the exact construction the policy
// targets, because it claims knowledge of the viewer's present behaviour.
const DIAGNOSTIC_PRESENT: RegExp[] = [
  /\byou(?:'re|\s+are)\s+(?!going\s+to\b)([a-z]+ing)\b/i,           // you're sitting / scrolling / avoiding
  /\byou\s+(keep|kept|always|still|constantly|never)\s+[a-z]+/i,      // you keep rewriting
  /\byou(?:'ve|\s+have)\s+(been|tried|spent|struggled)\b/i,          // you've tried everything
  /\byou\s+(feel|felt|wonder|dread|fear|hide|avoid|avoided)\b/i,      // you feel / you avoid
];

// BURDEN FRAMES. The reference's prohibited column (§3.1) includes "Tired of your acne?"
// and "Struggling with debt?" — the second carries no pronoun at all. Opening a sentence
// with a burden frame IS an implied "are you", which is why both are prohibited while
// "Financial planning services for long-term growth" is permitted.
const BURDEN_FRAMES = [
  "tired of", "sick of", "fed up with", "fed up of", "struggling with", "struggle with",
  "suffering from", "worried about", "embarrassed by", "ashamed of", "frustrated with",
  "stuck with", "stuck in", "battling", "dealing with",
  "living with", "coping with", "recovering from",
];

/**
 * Fires when a sentence OPENS with a burden frame and is addressed — marked either by a
 * question mark or by second person in the same sentence. The pair of conditions is what
 * separates "Struggling with debt?" (prohibited) from "Struggling with pricing is normal
 * in year one" (an observation, permitted).
 */
function burdenFrameAddress(sentence: string): string | undefined {
  const s = lower(sentence).replace(/^(are\s+you\s+|still\s+)/, "");
  const frame = BURDEN_FRAMES.find((b) => s.startsWith(b));
  if (!frame) return undefined;
  const addressed = sentence.includes("?") || SECOND_RE.test(sentence);
  return addressed ? frame : undefined;
}

// Readiness and volition are INVITATIONS, not diagnoses — "if you're ready" asserts
// nothing about the reader, it offers them a choice. Kept out of the diagnostic set.
const READINESS = "ready|welcome|invited|curious|interested|keen|looking|thinking about|considering|serious about";
const VOLITIONAL = new RegExp(
  `\\byou(?:'re|\\s+are)\\s+(?:${READINESS})\\b` +          // "you're ready"
  `|\\b(?:are|is)\\s+you\\s+(?:${READINESS})\\b`,           // "are you ready"
  "i",
);

// The inverted question form — "Are you struggling to land high-ticket clients?" is
// listed in the reference's prohibited column (§3.1) and carries no attribute noun at
// all. Its diagnostic force comes entirely from asking the reader about themselves.
const DIAGNOSTIC_QUESTION = /\b(are|do|does|have|has|did|is|were|was)\s+you(?:r)?\b/i;

// Second person that is about THE OFFER — Meta's own stated remedy (§1.1: "focus on
// the benefits of the product or service"). Never flagged.
const OFFER_DIRECTED = [
  "you'll get", "you will get", "you'll learn", "you will learn", "you'll leave",
  "you'll walk", "you'll receive", "you will receive", "you'll have", "you get",
  "you learn", "you receive", "your seat", "your spot", "your place", "your copy",
  "your call", "your slot", "your session", "book your", "claim your", "save your",
  "reserve your", "download your", "grab your", "join us", "sign up",
];

// §1.3 — diet/weight/health negative self-perception. Meta prohibits copy that implies
// or attempts to generate negative self-perception to promote these products.
const APPEARANCE_COMPARISON = [
  "before and after", "before & after", "before/after",
  "pre-pregnancy body", "pre-baby body", "get your body back", "bounce back",
  "beach body", "bikini body", "summer body", "dress size", "how you used to look",
  "the old you", "back to your old", "your best self",
];

// §1.8 — the boundary is ENDORSEMENT of buying or selling. Education, events, news,
// blockchain technology and non-currency products are permitted without permission.
const CRYPTO_TERMS = ["crypto", "cryptocurrency", "bitcoin", "ethereum", "altcoin", "coin", "coins", "token", "tokens", "blockchain", "web3", "wallet"];
const TRADE_ENDORSEMENT = [
  "buy now", "start buying", "start trading", "trade now", "invest now", "start investing",
  "buy the dip", "get in early", "get in now", "before the price", "moon", "pump",
  "portfolio returns", "grow your portfolio", "profit from", "returns of",
  // NOT bare "yield": measured live, it fired on "a colleague mentioned DeFi, yield, and
  // a wallet address" — jargon the reader does not understand, not an endorsement to buy.
  "yield farming", "high yield",
  "which coins to buy", "what to buy", "best coins", "top coins to", "start staking",
];

// Check 5 — TIER 2 ONLY. Practitioner-reported Employment Special Ad Category triggers.
// Meta's published policy does NOT say these words trigger SAC; the reference records
// this under Tier 2 (anecdote) explicitly. It therefore WARNS and never gates.
const SAC_EMPLOYMENT_TRIGGERS = [
  "resume", "résumé", "cv", "interview preparation", "interview prep", "job interview",
  "get hired", "hiring", "recruiter", "recruiters", "job search", "job offer",
  "land a job", "new job", "career change", "career pivot", "promotion", "promoted",
  "salary", "pay rise", "pay raise", "quit your job", "leave your job", "employment",
  "scale your consulting income",
];

// ─── Grammar engine: sentence-level person anchoring ─────────────────────────
//
// THE PROBLEM THIS SOLVES. A lexical matcher cannot separate these two, because they
// share their nouns and differ only in who the sentence is about:
//   FLAG : "You avoid the camera. … the mirror is a daily reminder that something
//           hasn't come back yet."            (second person, deficit asserted at reader)
//   PASS : "The clothes still hang there. The ones from before. I kept them too."
//           (first person — the coach's own account, which is the register we want)
// Observed live, 2026-07-27: a regex keyed on "you're" missed the first and falsely
// flagged the second.
//
// So: classify each sentence's PERSON, let unpronouned sentences inherit from their
// neighbours, and only consider sentences that resolve to second person.

export type Person = "first" | "second" | "none";

const FIRST_RE = /\b(i|i'm|i've|i'd|i'll|my|mine|me|we|we're|we've|our|ours|us)\b/i;
const SECOND_RE = /\b(you|you're|you've|you'd|you'll|your|yours|yourself)\b/i;

export function splitSentences(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function classifyPerson(sentence: string): Person {
  const first = FIRST_RE.test(sentence);
  const second = SECOND_RE.test(sentence);
  // A sentence carrying both is anchored to the speaker — "I know how you feel" is the
  // coach's account, not a claim about the reader.
  if (first) return "first";
  if (second) return "second";
  return "none";
}

/**
 * Resolve every sentence's person, with unpronouned sentences inheriting from the
 * nearest preceding classified sentence, then the nearest following one. This is what
 * carries "the mirror is a daily reminder…" back to the "You avoid the camera" that
 * governs it, and carries "The clothes still hang there." forward to "I kept them too."
 */
export function resolveAnchors(sentences: string[]): Person[] {
  const raw = sentences.map(classifyPerson);
  const out = [...raw];
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== "none") continue;
    let prev: Person = "none";
    for (let j = i - 1; j >= 0; j--) if (raw[j] !== "none") { prev = raw[j]; break; }
    if (prev !== "none") { out[i] = prev; continue; }
    let next: Person = "none";
    for (let j = i + 1; j < raw.length; j++) if (raw[j] !== "none") { next = raw[j]; break; }
    out[i] = next;
  }
  return out;
}

const lower = (s: string) => s.toLowerCase();
/**
 * WORD-BOUNDARY matching. Plain substring matching silently produced false positives that
 * only surfaced once the vocabulary grew: "body" matched inside "noBODY", so
 * "nobody has shown you a framework you can stand behind" blocked as a body assertion.
 * The same class lurks in "asking"/skin, "surface"/face, "warms"/arms, "hive"/hiv.
 * Multi-word terms ("night sweats", "paycheck to paycheck") still match as phrases.
 */
const containsAny = (hay: string, needles: string[]) =>
  needles.find((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(hay));

function isOfferDirected(sentence: string): boolean {
  return OFFER_DIRECTED.some((p) => lower(sentence).includes(p));
}

/**
 * A conditional does not assert. "If you've been through sales training that felt like
 * theatre" explicitly declines to claim the advertiser knows that — which is the precise
 * thing §1.1 prohibits. Meta's rule is about IMPLYING KNOWLEDGE of the viewer, so a
 * clause that offers the reader the choice of recognising themselves is outside it.
 */
const CONDITIONAL_OPENER =
  /(^|[\s:—-])(if|whether|in case|should you|for anyone who|for those who)\b[^.?!]{0,40}\byou\b/i;

/**
 * "you" inside a relative clause modifying a third party — "the person you are talking
 * to", "the client you just lost". The sentence is about that third party, not about the
 * reader, so the diagnostic rules must not fire on it.
 */
const RELATIVE_CLAUSE_YOU = /\b(the|a|an|every|any|each)\s+[a-z]+\s+you\s+(are|were|have|had|just|already)\b/i;

/**
 * Sentences whose subject is the offer. Meta's own stated remedy is to focus on the
 * benefits of the product, so "The Fourth Trimester Method starts where your body
 * actually is" describes the method, not the reader.
 */
const ABOUT_THE_OFFER = /\b(method|programme|program|course|cohort|framework|system|approach|session|workshop|plan|training|the link)\b/i;

/**
 * The offer-guard must require the offer to be the SUBJECT, not merely present.
 *
 * Bare presence is too permissive in the dangerous direction: "You're overweight and the
 * programme helps" contains "programme", so a presence test exempts it and a real §1.1
 * assertion walks through. This was flagged as a watch-item for `overweight`/`obesity`
 * once weight vocabulary expanded; requiring subject position closes it rather than
 * leaving it to be noticed in production.
 *
 * Subject position is approximated the same way the deliverable-noun-phrase guard does
 * it — the offer noun must appear BEFORE the first second-person marker, so the reader
 * can only be in a modifier hanging off it:
 *   exempt  "The Fourth Trimester Method starts where your body actually is right now."
 *   BLOCKS  "You're overweight and the programme helps."
 */
function offerIsSubject(sentence: string): boolean {
  const m = ABOUT_THE_OFFER.exec(sentence);
  if (!m) return false;
  const you = SECOND_RE.exec(sentence);
  if (!you) return true;                       // no reader in the sentence at all
  return (m.index ?? 0) < (you.index ?? 0);    // offer introduced before the reader
}

/**
 * DELIVERABLE NOUN PHRASE — the offer is the subject and the reader appears only inside a
 * modifier attached to it: "Progressive strength work specific to where your body is
 * right now", "support tailored to where you are", "a plan built around your schedule",
 * "coaching matched to your stage".
 *
 * These carry NO verb predicated of the reader, so the offer-guard had nothing to grip
 * and they flagged as violations. The form is common in coaching copy and
 * disproportionately common in health and money niches — exactly where the detector most
 * needs to be right — so this is a structural hole rather than the 1-in-331 the sweep
 * measured.
 *
 * The recognition is deliberately narrow: the sentence must NOT open on the reader, and
 * must attach the reader through a fitting participle plus a preposition. That leaves
 * every construction where the reader IS the subject fully detectable — "Your body did
 * something incredible", "You're tired because your body needs rebuilding" — because
 * those open on the reader and carry a predicate about them.
 */
const FITTING_PARTICIPLE =
  /\b(tailored|built|designed|matched|specific|suited|adapted|customised|customized|geared|calibrated|shaped|structured|scaled|pitched|written|made|set up|put together|paced)\b\s+(to|for|around|at|with|against)\b/i;

function isDeliverableNounPhrase(sentence: string): boolean {
  // Strip a leading field label or list marker before judging how the sentence opens.
  const body = sentence.replace(/^[\s•\-–—]*[a-zA-Z]{0,24}:\s*/, "").trim();
  if (/^(you|your)\b/i.test(body)) return false;   // opens on the reader → not a deliverable
  const m = FITTING_PARTICIPLE.exec(body);
  if (!m) return false;
  // The reader must appear ONLY inside the modifier. Where second person also precedes
  // the participle, the main clause is predicating something about them and the sentence
  // is not a deliverable description — "Every tip you've tried was calibrated to the
  // wrong body clock" diagnoses the reader and then describes the tip. Measured against
  // real prod copy, suppressing those was a genuine false-negative class.
  return !SECOND_RE.test(body.slice(0, m.index));
}

// ─── Field roles ─────────────────────────────────────────────────────────────
// Short fields are the priority gap: the register standard fixes body copy, but a
// 40-character headline cannot carry a first-person moment, so diagnostic framing
// survives there. CTA fields are exempt from attribute checks — "Claim your seat" is
// second person about the offer by construction.

export type FieldRole = "short" | "body" | "cta";

/**
 * ENFORCEMENT SCOPE (2026-07-27, Arfeen's decision) — ONLY Tier 1 blocks.
 *
 * The compliance reference is explicit that Tier 1 (confirmed Meta policy) is the ONLY
 * tier that may become enforcement logic. The first cut of this axis blocked on the
 * REGISTER STANDARD as well, which is Tier 3 — ZAP's own house style. That meant we were
 * gating on our own preference: a second-person sentence about someone's job situation,
 * business frustration or ambition was blocked even though employment status appears
 * nowhere on Meta's enumerated attribute list.
 *
 * Measured consequence: the career-pivot shape lost 12 of 16 body angles on prod, and
 * career + client-acquisition is the largest cluster in the real service distribution —
 * the niche with the most users was getting the thinnest decks, on a rule Meta does not
 * impose.
 *
 * WHAT STILL BLOCKS (tier 1): second person plus an ENUMERATED attribute — physical or
 * mental health including medical conditions, vulnerable financial status, race,
 * ethnicity, religion, age, sexual orientation, gender identity, disability, criminal
 * record, voting status, trade union membership, name — plus §1.3 negative
 * self-perception, §1.8 crypto endorsement, §1.4 ad-to-page mismatch, §1.6 deceptive
 * urgency.
 *
 * WHAT NOW LABELS INSTEAD (tier 2, `register_diagnostic_address`): diagnostic second
 * person about NON-enumerated topics. The register standard remains in every generation
 * prompt and still shapes the copy — it simply no longer gates it. Expect output to be
 * less uniformly first-person on non-enumerated topics; that is the intended trade.
 */
export function checkComplianceAxis(
  fields: Array<{ location: string; text: string | null | undefined; role?: FieldRole }>,
): ComplianceAxisResult {
  const hits: ComplianceHit[] = [];
  const push = (classId: ComplianceClass, tier: 1 | 2, description: string, matched: string, location: string) =>
    hits.push({ classId, tier, description, matched: String(matched).slice(0, 160), location });

  for (const f of fields) {
    const text = typeof f.text === "string" ? f.text : "";
    if (!text.trim()) continue;
    const role: FieldRole = f.role ?? "body";
    const hay = lower(text);

    // ── Check 1 (short-field form) — audience descriptor asserting an attribute.
    // "FOR WOMEN WHO JUST HAD A BABY AND FEEL LIKE THEIR BODY NO LONGER BELONGS TO THEM"
    // carries NO second-person pronoun, so anchoring alone never reaches it. This is the
    // shape Meta describes as singling out an attribute as an audience identifier.
    if (role !== "cta") {
      const descriptor = /\bfor\s+[^.!?]{0,60}?\bwho\s+([^.!?]{0,120})/i.exec(text)
        ?? /\b(women|men|mums|moms|mothers|fathers|dads|parents|people|professionals|coaches|founders)\s+who\s+([^.!?]{0,120})/i.exec(text);
      if (descriptor) {
        const clause = lower(descriptor[descriptor.length - 1] || "");
        const attr = containsAny(clause, PROTECTED_ATTRIBUTE_TERMS);
        const deficit = containsAny(clause, DEFICIT_PREDICATES);
        if (attr) {
          // Enumerated attribute used as an audience identifier — Meta policy.
          push("audience_attribute_descriptor", 1,
            "This names a group by a personal attribute, which reads as identifying the audience by that attribute. Describing what the offer is for, or the situation it addresses, carries the same targeting without the assertion.",
            descriptor[0], f.location);
        } else if (deficit) {
          // A difficulty that is NOT an enumerated attribute ("designers who keep losing
          // pitches"). House style, not Meta policy → label only.
          push("register_diagnostic_address", 2,
            "This names a group by a difficulty. Meta's policy does not reach this — recorded as register, not blocked.",
            descriptor[0], f.location);
        }
      }
    }

    // ── Checks 1 + 2 — sentence-anchored assertions about the reader.
    const sentences = splitSentences(text);
    const anchors = resolveAnchors(sentences);
    sentences.forEach((sentence, i) => {
      if (role === "cta" || isOfferDirected(sentence)) return;
      if (CONDITIONAL_OPENER.test(sentence)) return;
      if (RELATIVE_CLAUSE_YOU.test(sentence)) return;
      if (isDeliverableNounPhrase(sentence)) return;

      // Burden frame — an implied "are you". Checked BEFORE anchoring, because
      // "Struggling with debt?" carries no pronoun for anchoring to resolve, yet is
      // prohibited in the reference's own table (§3.1).
      if (burdenFrameAddress(sentence)) {
        // "Struggling with debt?" names an ENUMERATED attribute (vulnerable financial
        // status) → policy. "Struggling with your pipeline?" does not → house style.
        if (containsAny(lower(sentence), PROTECTED_ATTRIBUTE_TERMS)) {
          push("second_person_protected_attribute", 1,
            "This opens by naming a personal attribute as the reader's own. Naming what the offer is for carries the same targeting without stating anything about them.",
            sentence, f.location);
        } else {
          push("register_diagnostic_address", 2,
            "This opens by naming a difficulty as the reader's own. Not an attribute Meta enumerates — recorded as register, not blocked.",
            sentence, f.location);
        }
        return;
      }

      // A question naming a protected attribute, not anchored to the coach's own
      // account, addresses the reader by implication even with no pronoun present.
      if (sentence.includes("?") && anchors[i] !== "first" && !offerIsSubject(sentence)) {
        const qAttr = containsAny(lower(sentence), PROTECTED_ATTRIBUTE_TERMS);
        if (qAttr) {
          push("second_person_protected_attribute", 1,
            "This asks the reader about a personal attribute, which reads as knowing it applies to them. Naming what the offer helps with states the same thing about the offer instead.",
            sentence, f.location);
          return;
        }
      }

      // §1.3 BODY PROXY — checked BEFORE the anchor gate. "The clothes still don't fit and
      // the mirror is a daily reminder" carries no pronoun at all, so anchoring resolves it
      // to "none" and would skip it; it is nonetheless the negative self-perception §1.3
      // prohibits. Suppressed only when the sentence is the coach's own first-person
      // account ("The clothes still hang there. I kept them too.").
      if (anchors[i] !== "first" && !offerIsSubject(sentence)) {
        const ls = lower(sentence);
        const bp = containsAny(ls, BODY_PROXY_NOUNS);
        const df = containsAny(ls, DEFICIT_PREDICATES);
        if (bp && df) {
          push("second_person_protected_attribute", 1,
            "This describes the reader's body, or something standing in for it, as lacking or failing. Told as a moment the coach lived, the same detail carries its full weight without asserting anything about the reader.",
            sentence, f.location);
          return;
        }
      }

      if (anchors[i] !== "second") return;          // first-person account → the register we want
      const s = lower(sentence);

      // The attribute must be PREDICATED OF THE READER, not merely present in a
      // second-anchored sentence. Measured 2026-07-27 over 252 real prose blocks: the
      // looser form produced ~50% false positives — sentences about the METHOD
      // ("starts with energy first, not weight"), product names carrying an attribute
      // term ("Postpartum Reset"), and third-person sentences pulled in by inheritance
      // ("That her body would just sort itself out"). Requiring adjacency to an explicit
      // second-person marker, and only in a sentence that carries one, removes that class.
      // Naming a DIAGNOSIS about the reader is itself the assertion ("reverse your
      // diabetes"). Naming a neutral body noun is not — "your body can absorb more from
      // food" is product mechanism, and only becomes an assertion when the sentence
      // characterises it negatively ("your body is failing you"). Without this split the
      // rule fired on ordinary nutrition and fitness copy.
      const neutralOnly = (t: string) => NEUTRAL_ATTRIBUTE_TERMS.includes(t);
      const negativeContext = !!containsAny(s, DEFICIT_PREDICATES) || !!containsAny(s, APPEARANCE_COMPARISON)
        || /\b(tired of|sick of|struggling|failing|embarrassed|ashamed|hate|hating|stuck|wrong|broken|no longer|worse|not where|should be|gave up|betrayed|hijack)\b/i.test(sentence)
        // Possession denial characterises the reader's body just as directly as
        // "wrong" does — "a body clock you don't currently have".
        || /\byou\s+(don't|do not|didn't|can't|cannot|no longer)\b/i.test(sentence);
      const attr = SECOND_RE.test(sentence) && !offerIsSubject(sentence)
        ? PROTECTED_ATTRIBUTE_TERMS.find((t) =>
            new RegExp(`\\byou(?:'re|r|\\s+are|\\s+feel|\\s+felt|\\s+look)?\\b[^.?!]{0,70}\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence)
            || new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^.?!]{0,45}\\byou\\b`, "i").test(sentence))
        : undefined;
      // Order matters: containsAny returns the FIRST list match, so a neutral term can mask
      // a non-neutral one ("the weight of a life" masked "exhaustion"). Decide on whether
      // ANY non-neutral attribute matched, not on whichever matched first.
      const attrIsNonNeutral = attr !== undefined &&
        PROTECTED_ATTRIBUTE_TERMS.some((t) => !neutralOnly(t) && new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence));
      if (attr && (attrIsNonNeutral || negativeContext)) {
        push("second_person_protected_attribute", 1,
          "This states a personal attribute — health, body, financial standing, background or circumstances — as a fact about the person reading it. The same point lands as the coach's own experience, or as what the offer does.",
          sentence, f.location);
        return;
      }

      // Diagnostic present — a claim about what the reader is doing or has done,
      // in either word order.
      if (!VOLITIONAL.test(sentence) && !offerIsSubject(sentence)) {
        const dp = DIAGNOSTIC_PRESENT.find((re) => re.test(sentence))
          ?? (sentence.includes("?") && DIAGNOSTIC_QUESTION.test(sentence) ? DIAGNOSTIC_QUESTION : undefined);
        if (dp) {
          // Telling the reader what they are doing is the register standard's concern, not
          // Meta's — the enumerated-attribute case is caught by the attribute rule above at
          // tier 1. Labels, does not block.
          push("register_diagnostic_address", 2,
            "This tells the reader what they are doing or have been through. The same moment, told as one the coach lived, keeps every bit of its force and claims nothing about the person reading. Recorded as register, not blocked.",
            sentence, f.location);
          return;
        }
      }

      // Implied address: no attribute noun, but an intimate-possession noun plus a
      // deficit predicate, in a sentence the reader is the subject of.
      const deficit = containsAny(s, DEFICIT_PREDICATES);
      const bodyProxy = containsAny(s, BODY_PROXY_NOUNS);
      const otherNoun = containsAny(s, NON_ENUMERATED_POSSESSION_NOUNS);
      if (deficit && !offerIsSubject(sentence)) {
        if (bodyProxy) {
          // §1.3 — negative self-perception about the body, stated via a proxy.
          push("second_person_protected_attribute", 1,
            "This describes the reader's body, or something standing in for it, as lacking or failing. Told as a moment the coach lived, the same detail carries its full weight without asserting anything about the reader.",
            sentence, f.location);
        } else if (otherNoun) {
          // A CV gap or work history is not an enumerated attribute.
          push("register_diagnostic_address", 2,
            "This describes something of the reader's as lacking. Not an attribute Meta enumerates — recorded as register, not blocked.",
            sentence, f.location);
        }
      }
    });

    // ── Check 2 — §1.3 appearance comparison, regardless of person. Meta prohibits
    // generating negative self-perception to promote diet/weight/cosmetic products;
    // a before-and-after framing does that even in the advertiser's own voice.
    const appearance = containsAny(hay, APPEARANCE_COMPARISON);
    if (appearance) {
      push("negative_self_perception", 1,
        "This frames physical change as a comparison against how someone looked before. Capability — what becomes possible to do — carries the result without the comparison.",
        appearance, f.location);
    }

    // ── Check 4 — §1.8. Permitted without prior permission: education, events, news,
    // blockchain technology, non-currency products. The line is ENDORSING buying or
    // selling. Fires only where the copy is about crypto AND endorses trading.
    if (containsAny(hay, CRYPTO_TERMS)) {
      const endorse = containsAny(hay, TRADE_ENDORSEMENT);
      if (endorse) {
        push("crypto_trade_endorsement", 1,
          "This encourages buying, selling or trading cryptocurrency, which needs Meta's prior written permission. Education, events, news and how the technology works are permitted without it.",
          endorse, f.location);
      }
    }

    // ── Check 5 — TIER 2, ADVISORY ONLY, NEVER BLOCKS. ────────────────────────
    // Practitioner-reported: business and career coaches flagged for the Employment
    // Special Ad Category over ordinary career vocabulary. Meta's published policy does
    // NOT state this, so it cannot become a gate — it is surfaced to the coach with both
    // remedies and honest wording about its evidence base.
    const sac = containsAny(hay, SAC_EMPLOYMENT_TRIGGERS);
    if (sac) {
      push("special_ad_category_employment", 2,
        "Career and employment wording. Meta MAY treat an ad using this language as a job ad, which would place it in the Employment Special Ad Category and restrict its targeting.",
        sac, f.location);
    }

    // ── Check 6 — delegate to the existing filter rather than duplicating it.
    const verdict = complianceFilter(text);
    if (verdict.classification === "REJECTED" || verdict.classification === "PIVOT_REQUIRED") {
      for (const term of verdict.flaggedTerms.slice(0, 3)) {
        push("deceptive_urgency", 1,
          "This carries a claim or an urgency device Meta's policy filters reject. Real deadlines the coach has set, and what the offer actually does, both pass cleanly.",
          term, f.location);
      }
    }
  }

  const blocking = hits.filter((h) => h.tier === 1);
  const advisories = hits.filter((h) => h.tier === 2);
  return { ok: blocking.length === 0, hits, blocking, advisories, failContext: buildComplianceFailContext(blocking) };
}

/**
 * Positive-framed retry guidance (§14) — describes the copy that IS wanted rather than
 * naming failure shapes back at the model, which primes them. Written to sit alongside
 * the register standard, not against it.
 */
export function buildComplianceFailContext(blocking: ComplianceHit[], maxHits = 6): string {
  if (blocking.length === 0) return "";
  const lines = blocking.slice(0, maxHits).map((h) => `- ${h.location}: "${h.matched}" — ${h.description}`);
  const more = blocking.length > maxHits ? `\n(plus ${blocking.length - maxHits} more of the same kind)` : "";
  return `The previous draft stated things about the person reading it:
${lines.join("\n")}${more}

Write it again with the same force and the same specific detail. The detail belongs to a moment the coach lived and to what the method does — that is what the reader recognises. Where the offer concerns the body, the subject is what becomes possible to do.`;
}

// ─── Check 3 — ad-to-landing-page match (§1.4), publish only ─────────────────
//
// Meta states the products and services promoted in an ad must MATCH those promoted on
// the landing page, and that review may include the destination. Evaluable only where
// both artefacts exist, so it lives at the publish gate rather than at generation.
//
// Deliberately coarse: it asks whether the ad and the page are about the same offer, by
// content-word overlap. A tight threshold here would be exactly the fake precision the
// reference warns against, so this fires only on a near-total disjoint — the case where
// an ad points at an unrelated page.

const STOPWORDS = new Set(["the","a","an","and","or","but","of","to","in","for","on","with","your","you","our","we","is","are","it","this","that","at","by","from","as","be","will","can","how","what","why","who","i","my","me"]);

function contentWords(text: string): Set<string> {
  return new Set(
    lower(String(text || ""))
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

export function checkAdToPageMatch(adText: string, pageText: string): ComplianceAxisResult {
  const ad = contentWords(adText);
  const page = contentWords(pageText);
  const hits: ComplianceHit[] = [];

  // Not enough signal to judge — say nothing rather than guess.
  if (ad.size < 5 || page.size < 15) {
    return { ok: true, hits, blocking: [], advisories: [], failContext: "" };
  }
  let shared = 0;
  // Array.from rather than for..of over the Set — the repo targets ES5 without
  // downlevelIteration, and a bare Set spread is the known TS2802 class here.
  Array.from(ad).forEach((w) => { if (page.has(w)) shared++; });
  const overlap = shared / ad.size;

  // A single deliberately loose floor. Anything above it is a judgement call this cannot
  // make honestly; anything at or below it means the ad and the page share almost no
  // subject matter at all.
  if (overlap <= 0.1) {
    hits.push({
      classId: "ad_to_page_mismatch",
      tier: 1,
      description:
        "The ad and the page it points to share almost no subject matter. Meta requires the products and services promoted in an ad to match those on its landing page, and reviews the destination.",
      matched: `${shared}/${ad.size} words shared`,
      location: "ad→page",
    });
  }
  return {
    ok: hits.length === 0,
    hits,
    blocking: hits,
    advisories: [],
    failContext: buildComplianceFailContext(hits),
  };
}

// ─── Unified output gate ─────────────────────────────────────────────────────
//
// ONE call site per surface, so a single retry sees every constraint at once. The
// fabrication axis is absent from this branch (reverted at a912a2b, held at 6a89396);
// when it returns, call it here and concatenate its hits — the shapes already match, and
// buildFailContext outputs merge by concatenation.
//
// ⚠️ WHEN THE FABRICATION VALIDATOR RETURNS: its buildFailContext currently instructs the
// model that "the copy speaks to the reader's situation", which is the diagnostic address
// the register standard removes. That line must be rewritten as the two merge, or every
// fabrication retry will push copy back into the register we just took out.

export type OutputHit = ComplianceHit | { classId: string; tier: 1 | 2; description: string; matched: string; location: string };

export type OutputGateResult = {
  ok: boolean;
  blocking: OutputHit[];
  advisories: OutputHit[];
  failContext: string;
};

/**
 * THE SHARED PASS — one call site per surface, so a single retry sees every constraint.
 *
 * Run as separate passes, a fabrication retry can reintroduce a compliance violation and
 * vice versa, with neither retry seeing both. Merging the failContexts means one redraft
 * fixes both. The two rule modules stay separate because their inputs differ — fabrication
 * needs the coach corpus, compliance needs only the text and the field's role.
 *
 * Fabrication runs only when a corpus is supplied; callers without one (or before the
 * validator is available) still get the compliance axis.
 */
export function checkOutput(
  fields: Array<{ location: string; text: string | null | undefined; role?: FieldRole }>,
  grounding?: { corpus: any; supplied: any },
): OutputGateResult {
  const cmp = checkComplianceAxis(fields);
  const blocking: OutputHit[] = [...cmp.blocking];
  const advisories: OutputHit[] = [...cmp.advisories];
  const contexts: string[] = [];
  if (cmp.failContext) contexts.push(cmp.failContext);

  if (grounding?.corpus && grounding?.supplied) {
    const fabFields: Record<string, string> = {};
    for (const f of fields) if (typeof f.text === "string" && f.text.trim()) fabFields[f.location] = f.text;
    if (Object.keys(fabFields).length > 0) {
      const fab = checkFabrication({ fields: fabFields, corpus: grounding.corpus, supplied: grounding.supplied });
      blocking.push(...fab.blocking);
      advisories.push(...fab.hits.filter((h) => h.tier === 2));
      if (fab.failContext) contexts.push(fab.failContext);
    }
  }

  return { ok: blocking.length === 0, blocking, advisories, failContext: contexts.join("\n\n") };
}

export const COMPLIANCE_RETRY_MAX_ATTEMPTS = 3;
