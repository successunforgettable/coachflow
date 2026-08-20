import type { OfferMode } from "./campaignFraming";

/**
 * THE ZAP B2C OFFER STANDARD — the prompt-side expression of `docs/offer-research/README.md`.
 *
 * Held in its own module for the same reason `copywritingRules.ts` is: it is a STANDARD that
 * several generators will judge themselves against, not a private detail of one generator.
 * Read the README first — it carries the reasoning, the regulatory citations, and the
 * B2B-contamination warning. This file is only the wording that reaches the model.
 *
 * 🔴 B2C ONLY. Every block below is written for an individual buying for themselves — a coach,
 * a consultant, a tarot reader, an astrologer, a yoga teacher. There is no buying committee, no
 * procurement, no board, no SME account, and no ROI case. A block that arrives in B2B clothing
 * has been contaminated and must be rewritten, not translated.
 *
 * 📌 Positive framing only (CLAUDE.md §14). Every block states the shape the output IS. The one
 * exception is the operator-fill prohibition list in `offersGenerator.ts`, which is a rule list
 * enforced by `validateOfferFabricationPatterns` rather than an illustration of failure.
 */

// ── The value equation, in B2C terms ────────────────────────────────────────────────────────
export const VALUE_EQUATION_BLOCK = `
THE VALUE EQUATION — the engine under every section you write:

  Value = (Dream Outcome x Perceived Likelihood of Achievement) / (Time Delay x Effort & Sacrifice)

Four levers. Every sentence you write raises the numerator or lowers the denominator.

1. DREAM OUTCOME — identity, not features. A B2C buyer is not buying a service, they are buying
   a version of themselves. Translate raw pain into identity: "anxious and overwhelmed" becomes
   "the woman who leads her family with calm authority". Name the specific situation that
   changes, in the vocabulary this field actually uses. The pain lives in the gap between who
   they are now and who they want to be, so name both ends of that gap precisely.

2. PERCEIVED LIKELIHOOD — certainty is often worth more than the thing itself. Raise it with the
   MECHANISM: name the process, say what it accounts for that the approaches they already tried
   do not, and show the order it runs in. A named, repeatable process reads as predictable. Where
   real proof is supplied below, it carries this lever; where none is supplied, the mechanism
   carries it alone and carries it well.

3. TIME DELAY — name the FIRST thing that shifts, and how soon. A fast, small, real win validates
   the whole system and is the strongest evidence of certainty a reader has. Name it concretely.

4. EFFORT & SACRIFICE — name the one thing they do NOT have to do that they assumed they would.
   Cognitive load is the offer killer. Where the work is structured, templated or walked through
   step by step, say so plainly: that is the denominator shrinking.
`;

// ── New Opportunity vs Incremental Improvement ──────────────────────────────────────────────
export const NEW_OPPORTUNITY_BLOCK = `
NEW OPPORTUNITY FRAMING — the mechanism is the context, and it does specific work:

A reader who has tried and failed at something reads "do it better" as "you did not try hard
enough", and withdraws. The way through is to move the blame off the person and onto the OLD
VEHICLE — the structurally different approach they were using — and to introduce a genuinely
different one.

Write it in this shape:
  - Name 1-2 approaches this reader has almost certainly already tried, by the names their field
    actually uses for them.
  - Say what those approaches structurally leave out — the thing they were never built to handle.
  - Introduce the coach's method as a different vehicle that addresses exactly that gap, named
    so the reader can hold it in mind as one thing.

The reader should finish the passage thinking "no wonder that did not work — that was never
built for this", not "I failed at that". Curiosity in place of shame is the whole objective.
`;

// ── MAGIC naming ─────────────────────────────────────────────────────────────────────────────
export const MAGIC_NAMING_BLOCK = `
NAMING — the name is the cognitive container, and on cold traffic it is the primary magnet.

A B2C reader must know the result within about three seconds of reading the name. Build it from
the MAGIC components, using the ones that genuinely apply rather than forcing all five:
  M agnet    — the theme or occasion, where one is real ("Winter Reset", "Live Q&A")
  A vatar    — who it is specifically for ("for postpartum mothers", "for solo consultants")
  G oal      — the outcome, in this field's own words
  I nterval  — the timeframe, ONLY where the timeframe is a supplied fact
  C ontainer — the format word that makes it feel like one designed thing: Protocol, Blueprint,
               Reset, Intensive, Roadmap, System, Audit, Masterclass

These architectures all work; pick the one that fits:
  - Result in the title      — "The Six-Figure Soulpreneur"
  - Stuck to unstuck         — "From Chronic Fatigue to Boundless Energy"
  - It is what it says       — "The Somatic Yoga Academy"

Test every candidate two ways. Say it to an imaginary friend: if they cannot state the outcome
back to you in three seconds, it is not there yet. Then ask whether it could sit on a different
coach's page in a different field — if it could, it is a category, not a name.

Names stay under about ten words and stay inside what the supplied facts support: a name carries
an interval only when the interval is a supplied fact, and describes a result the method plausibly
produces rather than an absolute one.
`;

// ── Ethical urgency ──────────────────────────────────────────────────────────────────────────
export const ETHICAL_URGENCY_BLOCK = `
URGENCY — real constraints only, because a real constraint is the only one that survives contact.

Urgency in a B2C offer comes from three places, all of them facts:
  1. OPERATIONAL CAPACITY — the honest limit of what one person can deliver. A room holds what it
     holds; a coach can run so many 1:1 calls in a week; a live session has a finite number of
     seats. This is the strongest and most defensible form of scarcity because it is simply true.
  2. A REAL DATE — a live session happens at a time. That time is the deadline, and it needs no
     decoration.
  3. THE COST OF WAITING — what another quarter of the current situation actually costs, described
     from the coach's experience of watching it. This one is always available and never expires.

Where a specific figure or date would appear and has not been supplied, use the operator-fill
token for it, so the coach fills in the real one. A window that is described is a window that is
honoured: the FTC treats a "limited" offer that is not actually limited as deceptive pricing
(16 CFR 233.5), and a countdown that resets is the single fastest way to lose a reader's trust.
`;

// ── Desire, status, identity ─────────────────────────────────────────────────────────────────
export const DESIRE_IDENTITY_BLOCK = `
DESIRE AND IDENTITY — what a B2C reader is actually buying:

B2C purchases are symbolic. The reader is resolving the friction between who they are now and who
they want to be, and the offer is the bridge. Three things follow:

  - Name the identity they are LEAVING and the one they are MOVING TO, both in specific terms.
    "The scattered seeker" to "the woman with a practice she trusts" does more work than any
    feature list.
  - Write in the vocabulary of the field. Three or more phrases only someone inside this world
    would use is the bar; that specificity is what makes a reader feel recognised.
  - Address the reader as one person the coach is speaking to. Describe situations from the
    coach's own side of the table — what they have seen, what keeps happening — rather than
    asserting facts about the reader's body, health, finances or state of mind.
`;

// ── The three angles, per mode ───────────────────────────────────────────────────────────────
/**
 * The DB carries three angle columns (`godfatherAngle`, `freeAngle`, `dollarAngle`) and a
 * three-value `activeAngle` enum. Those column names are PAID-SHAPED, and renaming them is a
 * migration. So the three angles are REINTERPRETED per mode instead: in `free_event` mode the
 * same three columns hold three positionings of the SAME free event, none of which carries a
 * price. Zero schema change; the coach still gets three real choices in the deck.
 */
export const FREE_EVENT_ANGLE_PROMPTS: Record<"godfather" | "free" | "dollar", string> = {
  godfather: `
ANGLE — NOTHING HELD BACK.

This free session is the real thing, not a trailer for the real thing. Write it so a reader
understands that the method itself gets taught here, in full, and that they could act on what
they learn without ever spending a penny.

Build it this way:
  - Name the single most valuable thing that gets handed over in the room, and say plainly that
    it is the same thing the coach uses in paid work.
  - Say what the attendee is able to DO when they walk out that they could not do walking in.
  - Name what they keep afterwards — the recording, the worksheet, the framework — where those
    are things the coach genuinely provides.
  - Make the generosity the argument. A reader who thinks "why is this free?" and finds a
    straight answer trusts the rest of the page.
`,
  free: `
ANGLE — RESULTS IN ADVANCE.

Let the reader verify the coach's competence before any money is ever discussed. This angle wins
by demonstration rather than by promise.

Build it this way:
  - Name the specific, tangible thing the attendee leaves with — a personalised map, a diagnosis
    of where their own situation is stuck, a written plan in their own words. Something that
    exists after the session ends.
  - Say who this is genuinely FOR, in terms concrete enough that the wrong reader self-selects
    out. Pre-qualification is a service to both sides.
  - Name the one thing that happens here that is not available anywhere else — the coach's own
    analysis, framework or read on the situation.
  - Set the expectation for the room honestly: what it is, how it runs, what it is not.
`,
  dollar: `
ANGLE — THE COST OF WAITING.

Anchor against the cost of the reader's current situation, not against any price. Nothing is
being sold in this session, so the only number that matters is what another quarter of the
status quo costs them.

Build it this way:
  - Describe concretely what the current situation takes out of a week or a quarter — the
    repeated effort, the missed openings, the same conversation had again. Describe it as the
    coach has watched it happen.
  - Set the effort of attending against that cost. One session against another quarter of this.
  - Name what changes first once the method is applied, and how soon that first shift shows up.
  - Keep the whole passage free of price framing. The comparison is situation-against-situation.
`,
};

export const PAID_ANGLE_PROMPTS: Record<"godfather" | "free" | "dollar", string> = {
  godfather: `
ANGLE — THE COMPLETE OFFER.

Assemble every lever of the value equation into one offer a well-matched reader would feel
irrational declining. The strength comes from the stack being genuinely good, not from pressure.

Build it this way:
  - Dream outcome named as a specific situation, in this field's vocabulary.
  - Likelihood carried by the named mechanism, and by real proof where proof is supplied.
  - The first visible result named, with its timing drawn from supplied facts or its token.
  - The effort that is removed named explicitly.
  - The core programme plus its three bonus slots.
  - A guarantee written about the TRANSACTION — what is returned, and the window it runs for —
    using the operator's supplied terms or the guarantee token. Say what the buyer keeps
    regardless, where the coach genuinely lets them keep it.
  - The investment stated as its own clear line, using the supplied price or the price token.
`,
  free: `
ANGLE — THE ENTRY SESSION.

Position a free consultation or assessment as the entry point to the paid programme, complete in
itself at the point of delivery.

Build it this way:
  - Name the specific deliverable the session produces — a gap analysis, a roadmap, a plan.
  - Say who it is for, concretely enough that the wrong reader self-selects out.
  - Name the one thing available here and nowhere else: the coach's own analysis or framework.
  - Where the programme's price is a supplied fact, it may be named plainly as the next step.
    Where it is not, use the price token rather than an estimate.
`,
  dollar: `
ANGLE — PRICE AGAINST THE COST OF THE PROBLEM.

Anchor the price against what the problem costs, so the price reads as the rational choice.

Build it this way:
  - Describe what staying stuck costs in concrete terms — time, repeated effort, missed openings.
  - Name what the buyer gets access to immediately on payment, not over the whole programme.
  - Where this is an entry-priced product rather than the full programme, say so openly and name
    what it does and does not include. Transparency about a value ladder converts better than
    concealment, because it removes the suspicion of a hidden agenda.
  - Present the price using the supplied figure or the price token, after the cost of the problem
    has been established.
`,
};

// ── The seven sections, per mode ─────────────────────────────────────────────────────────────
/**
 * The OUTPUT SHAPE IS IDENTICAL IN BOTH MODES — the same seven keys, all strings, exactly as
 * `OfferContent` in `drizzle/schema.ts` declares them. Only what those keys are asked to CONTAIN
 * changes. `pricing` and `guarantee` in particular keep their names and stay non-empty in free
 * mode (an empty `pricing` renders as "Pricing: —" on the kit card and ships blank in exports);
 * they simply carry access terms and an attendance promise instead of a price and a refund.
 */
export const FREE_EVENT_SECTION_SPEC = `
Produce seven sections. This campaign converts on a FREE next step, so no section names a price
for it and no section promises a refund — there is nothing to buy here and therefore nothing to
refund. The paid programme exists and is sold later, in conversation, away from this page.

1. **offerName** (up to 10 words)
   The name of the FREE session itself, built per the naming rules above. It should be obvious
   from the name that this is a free live session or a free asset, and obvious what the reader
   walks away with.

2. **valueProposition** (20-40 words)
   The specific situation that changes for someone who attends, and immediately after it, what
   another quarter of the current situation costs. A situation, not a feeling.

3. **pricing** — ACCESS AND TERMS (25-45 words)
   What it takes to attend, stated plainly: that the session is free, what the reader needs to
   bring or do to be there, and that nothing is sold in the room. This is where a reader's
   "what's the catch?" gets its straight answer. It names no programme price and no fee.

4. **bonuses** (EXACTLY 3)
   What an attendee receives for showing up. Emit ONLY the name slot for each, one per line:
   "BONUS #1: [INSERT_BONUS_1_NAME]" then "BONUS #2: [INSERT_BONUS_2_NAME]" then
   "BONUS #3: [INSERT_BONUS_3_NAME]". The real names and descriptions are filled from the
   campaign's own generated bonus stack immediately after this step, so the line stays at the
   name slot. Carry no monetary value on any line.

5. **guarantee** — THE ATTENDANCE PROMISE (50-75 words)
   The honest risk reversal for a free session, which is about the reader's TIME rather than
   their money. State what they walk away holding even if they never work with the coach, and
   state plainly that there is nothing to buy in the room. Write it about the transaction — what
   is given, what is kept — and not about how the reader will turn out.

6. **urgency** (30-50 words)
   Real capacity and a real date only, per the urgency rules above. Use [INSERT_COHORT_LIMIT] for
   a seat count and [INSERT_COHORT_CLOSE_DATE] or [INSERT_PROGRAMME_START_DATE] for a date. The
   cost of waiting is always available and needs no token.

7. **cta** (20-30 words)
   One clear next step: registering, booking or downloading. It matches what this campaign
   actually converts on.
`;

export const PAID_SECTION_SPEC = `
Produce seven sections. This campaign converts on a PURCHASE, so the price and the guarantee are
real parts of the offer and belong on the page.

1. **offerName** (up to 10 words)
   Built per the naming rules above: the outcome plus the angle's own positioning.

2. **valueProposition** (20-40 words)
   The specific functional outcome, then what staying where they are costs. A situation, not a
   feeling.

3. **pricing** (30-50 words)
   The supplied price, or the [INSERT_PRICE] token verbatim. Where an anchor is used it is drawn
   from supplied data or from the cost of the problem. Guarantee duration appears here only when
   the operator supplied it; otherwise reference [INSERT_GUARANTEE_TERMS].

4. **bonuses** (EXACTLY 3)
   Emit ONLY the name slot for each, one per line: "BONUS #1: [INSERT_BONUS_1_NAME]" then
   "BONUS #2: [INSERT_BONUS_2_NAME]" then "BONUS #3: [INSERT_BONUS_3_NAME]". The real names and
   descriptions are filled from the campaign's own generated bonus stack immediately after this
   step. Where the operator HAS supplied a value, the value rides on the same line in brackets after
   the name slot, as "BONUS #1: [INSERT_BONUS_1_NAME] ([INSERT_BONUS_1_VALUE])" — the operator-fill
   layer substitutes the real figure. No concrete amount appears in this instruction, because a
   worked figure in a prompt is itself a priming source (CLAUDE.md §14).

5. **guarantee** (50-75 words)
   Written about the TRANSACTION — what is returned and the window it runs for — using the
   operator's supplied terms or [INSERT_GUARANTEE_TERMS] verbatim. Name what the buyer keeps
   regardless, where the coach genuinely lets them keep it. It describes what the coach does,
   never how the buyer will turn out.

6. **urgency** (30-50 words)
   Real capacity and real dates per the urgency rules. [INSERT_COHORT_LIMIT] for a seat count,
   [INSERT_COHORT_CLOSE_DATE] for a closing date.

7. **cta** (20-30 words)
   One clear action, in the angle's own language.
`;

/** Assemble the full standard for a mode. Order matters: levers, then framing, then shape. */
export function offerStandardBlock(mode: OfferMode): string {
  return [
    VALUE_EQUATION_BLOCK,
    NEW_OPPORTUNITY_BLOCK,
    DESIRE_IDENTITY_BLOCK,
    MAGIC_NAMING_BLOCK,
    ETHICAL_URGENCY_BLOCK,
    mode === "free_event" ? FREE_EVENT_SECTION_SPEC : PAID_SECTION_SPEC,
  ].join("\n");
}

export function offerAngleBlock(mode: OfferMode, angle: "godfather" | "free" | "dollar"): string {
  return mode === "free_event" ? FREE_EVENT_ANGLE_PROMPTS[angle] : PAID_ANGLE_PROMPTS[angle];
}
