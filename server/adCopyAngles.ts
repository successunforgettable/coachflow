/**
 * Issue 3: Ad Copy Angle Diversity
 *
 * 18 distinct psychological angles for ad body copy generation.
 * Includes 15 core angles + 3 PDC (Pain/Desire/Circumstance) angles added in W2.
 *
 * REGISTER (2026-07-27): every angle is written in FIRST PERSON by default — the
 * coach's own experience, the method, and what the offer does. The angles are
 * unchanged in intent; only the register and the worked examples moved. The prior
 * versions instructed the model to address the reader diagnostically ("You know
 * that feeling when…", "Right now you're…", "make it feel unnervingly accurate"),
 * which is the exact mechanism Meta's Personal Attributes policy prohibits — and
 * the third-person worked examples ("6 months ago, Sarah was…") required a client
 * a launch-stage coach does not have. See _core/copywritingRules REGISTER_STANDARD
 * and docs/compliance/META_AD_COMPLIANCE_REFERENCE.md §1.1/§1.2/§3.1.
 *
 * Worked examples are deliberately drawn from ordinary coaching/consulting work.
 * The prior set was uniformly crypto-themed, which primed both the fabrication
 * shape (invented portfolios, invented percentages) and the one vertical carrying
 * its own Meta permission regime (§1.8).
 */

import { BANNED_COPYWRITING_WORDS } from "./_core/copywritingRules";
import type { AwarenessStage } from "./_core/conceptAxis";

export type BodyAngle =
  | "pain_agitation"
  | "social_proof"
  | "authority"
  | "curiosity"
  | "story"
  | "urgency"
  | "benefit_stack"
  | "comparison"
  | "question"
  | "guarantee"
  | "transformation"
  | "contrarian"
  | "data_driven"
  | "emotional"
  | "direct_response"
  | "pain_pdc"
  | "desire_pdc"
  | "circumstance_pdc";

export const BODY_ANGLE_PROMPTS: Record<BodyAngle, string> = {
  pain_agitation: `
Generate body copy using the PAS (Problem-Agitate-Solution) formula, told from the coach's own experience:

Structure:
1. PROBLEM (30-40 words): Open on the specific moment the coach remembers from this problem — theirs, or one they have watched close up in this work. Name it concretely enough that the right reader recognises it.
2. AGITATE (40-50 words): Stay in that moment and show what it cost — what the week looked like, what kept repeating, what the coach tried that did not hold.
3. SOLUTION (40-60 words): Present the unique mechanism as what changed it, end with clear CTA

Tone: Empathetic but direct, emotional intensity builds through sections. The intensity comes from the precision of the remembered moment.
Hook: Open IN FIRST PERSON on a specific moment — a time, a place, a repeated small action the coach remembers. The opening line is something the coach is saying about their own experience.
Example: "I used to reopen the same proposal four times before sending it. Every time I found one more thing to soften. That draft sat in my outbox for nine days while the client went quiet, and I told myself I was being thorough. What actually changed it was the [Unique Mechanism] — a fixed structure that decides the shape of the proposal before I write a word, so there is nothing left to second-guess. [CTA]"
`,

  social_proof: `
Generate proof-driven body copy:

Structure:
1. CREDIBILITY HOOK (20-30 words): Establish trust from the proof data supplied above — the real customer count, rating, or press feature
2. CLIENT ACCOUNT (50-70 words): Where the supplied material includes real client testimonials, tell one of those accounts using the role, situation and result exactly as it appears there
3. PROOF STACK (30-40 words): Add 2-3 more brief indicators, each one drawn from the supplied material
4. CTA (20-30 words): One clear next step

Tone: Authentic, specific, evidence-based
Hook: Lead with the strongest real figure in the supplied proof data.
PROOF SOURCE: Every name, number, rating, review count and client outcome in this copy appears in the proof data supplied above. Where the supplied data carries no client material, write this angle from the coach's own first-person account of doing the work and what the method reliably changes — the structural shift it produces, described from the inside.
`,

  authority: `
Generate expertise-led body copy, grounded in the coach's own real background:

Structure:
1. EXPERIENCE INTRO (25-35 words): Open on what the coach has actually done in this work, as supplied in the input fields above
2. GROUNDING (30-40 words): What that work taught them — the pattern they kept seeing
3. THE PRINCIPLE (40-50 words): Explain in first person why the unique mechanism works, as something they arrived at
4. INVITATION (20-30 words): One clear next step

Tone: Professional, credible, plainly stated
Hook: Open on the work itself — what they were doing when the pattern became obvious.
CREDENTIAL SOURCE: Years of experience, titles, certifications, awards and media features come from the supplied input fields (credibleAuthority, pressFeatures, featuredIn) when those carry a real value; otherwise the copy describes the work itself without a credential claim.
Example: "The same thing came up in every pricing conversation I sat in: the number was never the problem. People walked because the scope moved after they said yes. So I started fixing the scope first and quoting second, and the objections stopped arriving. That sequencing is the whole of the [Unique Mechanism]. [CTA]"
`,

  curiosity: `
Generate mystery-driven body copy with open loops:

Structure:
1. INTRIGUE HOOK (25-35 words): Open a loop on something counterintuitive the coach found in this work
2. TEASE (40-50 words): Hint at the answer without revealing, build tension
3. MECHANISM REVEAL (40-50 words): Partially reveal the unique mechanism as what resolved it
4. CURIOSITY CTA (20-30 words): Promise the full picture behind the click

Tone: Intriguing, plainly told, the pull of an unfinished story
Hook: Start with "There's one thing I got wrong for years about..." or "It took me far too long to notice..."
Keep it honest: the loop is opened by something genuinely surprising in the work, and the copy describes a new approach rather than hidden or withheld knowledge.
`,

  story: `
Generate narrative-driven body copy — the coach's own account:

Structure:
1. THE STARTING POINT (30-40 words): Where the coach was when this began, told concretely
2. STRUGGLE (40-50 words): What they tried and why it did not hold
3. DISCOVERY (30-40 words): The turn — what they found, and what made it different
4. WHERE IT LANDED (20-30 words): What changed, plus CTA

Tone: Narrative, plainly told, first person throughout
Hook: Start with "For two years I..." or "The week I finally..."
Example: "For two years I ran discovery calls with no agenda and called it being flexible. Half of them ended with 'let me think about it' and no second date. I tried scripts, and they made me sound like a call centre. What finally worked was fixing the first four minutes and leaving the rest open — that's the [Unique Mechanism]. Bookings stopped depending on how the conversation happened to go. [CTA]"
CLIENT ACCOUNTS: Where the supplied material above includes real client testimonials, one of those accounts can carry this angle instead — told with the role, situation and result exactly as supplied. Without supplied client material, this is the coach's own story.
`,

  urgency: `
Generate scarcity-driven body copy (MUST be truthful):

Structure:
1. OPPORTUNITY FRAME (25-35 words): Present the time-sensitive opportunity
2. SCARCITY REASON (40-50 words): Explain WHY it's limited (capacity, resources, exclusivity)
3. WHAT WAITING COSTS (30-40 words): Describe what the next cycle looks like without this in place
4. ACTION CTA (20-30 words): Clear next step with time element

Tone: Urgent but professional, not manipulative
Hook: Start with "Applications now open" or "Limited enrollment period"
CRITICAL: Only use real scarcity (actual enrollment limits, genuine deadlines). Do NOT fabricate "only 3 spots left" unless literally true.
`,

  benefit_stack: `
Generate feature-list body copy:

Structure:
1. VALUE PROMISE (20-30 words): Overall statement of what the offer does
2. BENEFIT LIST (60-80 words): 4-5 specific benefits with brief explanations, use bullet format in prose
3. MECHANISM CONTEXT (30-40 words): How the unique mechanism delivers these benefits
4. CTA (15-25 words): Simple action step

Tone: Clear, value-focused, organized
Hook: Start with "Here's exactly what's included:" or "Inside [Product]:"
Format: "[Benefit 1], so [outcome]. Plus [Benefit 2], which [outcome]. And [Benefit 3]..."
This angle speaks about the offer and what it does — the benefit, the process, the outcome the method is built to produce.
`,

  comparison: `
Generate contrast body copy — the shift the method creates:

Structure:
1. THE OLD SHAPE (30-40 words): Describe how this work goes without the mechanism — the default approach and where it runs out
2. CONTRAST (40-50 words): Set that against how it goes with the mechanism in place. Contrast the two APPROACHES, not two versions of a person
3. BRIDGE (30-40 words): The unique mechanism as what moves one to the other
4. CTA (20-30 words): One clear next step

Tone: Aspirational, contrast-focused, hopeful
Hook: Start with "There are two ways to run [specific task]..." or "The old version of my [process] worked like this:" — the contrast is between two APPROACHES, described from the coach's side.
Contrast the process and the working week — what the method changes about how the work is done. Physical appearance and body comparisons are not the subject of this angle.
`,

  question: `
Generate Socratic method body copy:

Structure:
1. OPENING QUESTION (20-30 words): A genuine question about the SUBJECT — why this problem persists, why the common approach falls short
2. FOLLOW-UP QUESTIONS (40-50 words): 2-3 more that dig into the mechanics of the problem itself
3. ANSWER REVEAL (40-50 words): Unique mechanism presented as the answer
4. CLOSING CTA (20-30 words): One clear next step

Tone: Conversational, engaging, Socratic
Hook: Start with "Why does [specific situation] keep happening?" or "What actually decides whether [outcome] lands?" — the question is about the subject, and the answer is given from the coach's own experience of it.
The questions are about the problem and the method — how the thing works, why the usual approach falls short. Any figure used comes from the supplied material.
Example: "Why do most discovery calls stall at the same point? Not price — the conversation almost never gets that far. It stalls where the scope is still undefined and both sides are guessing. The [Unique Mechanism] fixes the scope in the first four minutes, before anyone talks about money. [CTA]"
`,

  guarantee: `
Generate risk-reversal body copy:

Structure:
1. THE GUARANTEE (25-35 words): State the guarantee upfront, exactly as supplied in the input
2. WHY IT CAN BE OFFERED (40-50 words): Explain what about the method makes this guarantee possible
3. WHAT IS KEPT EITHER WAY (30-40 words): Name what stays with them regardless
4. GUARANTEE CTA (20-30 words): One clear next step

Tone: Confident, reassuring, plainly stated
Hook: Start with "Here's the guarantee:" or "The terms are simple:"
CRITICAL: Only use real guarantees (actual money-back policies, real refund terms supplied in the input). Do NOT fabricate guarantees.
`,

  transformation: `
Generate identity-shift body copy — told as the coach's own shift, or the shift the method produces:

Structure:
1. THE OLD SELF-DESCRIPTION (30-40 words): How the coach used to describe themselves in this work, and what that description cost them
2. WHAT WAS ACTUALLY MISSING (35-45 words): Not a character flaw — the missing structure or skill, named plainly
3. MECHANISM AS BRIDGE (35-45 words): How the unique mechanism closes that gap
4. CTA (20-30 words): One clear next step

Tone: Aspirational, identity-focused, first person
Hook: Start with "I used to introduce myself as..." or "For years I thought I was [description]. I wasn't — I was missing [specific thing]."
Example: "I used to tell people I was 'not a salesperson', and I meant it as an apology. It turned out I was not missing confidence — I was missing a first question that made the rest of the call obvious. That question is the front end of the [Unique Mechanism], and I have not dreaded a discovery call since. [CTA]"
`,

  contrarian: `
Generate belief-challenging body copy:

Structure:
1. COMMON BELIEF (25-35 words): State the conventional wisdom in this field
2. CHALLENGE (40-50 words): Explain why that belief is incomplete, from what the coach has seen in the work
3. WHAT HOLDS UP INSTEAD (40-50 words): Present the unique mechanism as what actually works
4. CTA (15-25 words): One clear next step

Tone: Contrarian, confident, plainly argued
Hook: Start with "The standard advice on [topic] is backwards." or "Here's what I had to unlearn:"
Frame it as a different approach that holds up better — the argument is with the conventional method, not with the reader.
`,

  data_driven: `
Generate evidence-based body copy:

Structure:
1. THE NUMBER (20-30 words): Lead with a real figure from the supplied material — the coach's own client count, rating, review count, or a result they have actually recorded
2. CONTEXT (40-50 words): Explain what that figure reflects about how this work goes
3. THE MECHANISM (40-50 words): Present the unique mechanism and what it accounts for
4. CTA (20-30 words): One clear next step

Tone: Analytical, grounded, credible
Hook: Lead with the strongest real figure available in the supplied material.
FIGURE SOURCE: Every number, percentage and statistic in this copy appears in the supplied material above. Where the supplied material carries no figures, this angle is written qualitatively — the pattern the coach kept observing in the work, described precisely, with no numbers at all.
`,

  emotional: `
Generate empathy-driven body copy, told in first person:

Structure:
1. THE FEELING, OWNED (30-40 words): The coach names what this felt like for them, concretely — a specific moment, not a general state
2. WHAT THEY DID WITH IT (40-50 words): What they tried, what did not work, how long it went on
3. HOPE INTRODUCTION (35-45 words): The unique mechanism as what shifted it
4. CTA (15-25 words): One clear next step

Tone: Empathetic, plainly told, first person throughout
Hook: Start with "I know how this feels because..." or "The part nobody warned me about was..."
Example: "I know how this one feels, because I checked my inbox at 6am for eleven straight months hoping one reply would fix the month. Nothing in that inbox was ever going to. What changed it was having a pipeline I could see on one page — that visibility is the front end of the [Unique Mechanism], and the 6am checking stopped within three weeks. [CTA]"
`,

  direct_response: `
Generate action-focused body copy:

Structure:
1. CLEAR OFFER (25-35 words): State exactly what's included
2. VALUE PROPOSITION (40-50 words): What the offer does and the problem it addresses
3. SIMPLE PROCESS (30-40 words): Break down the steps to get started
4. STRONG CTA (20-30 words): Direct, clear action

Tone: Direct, no-nonsense, action-oriented
Hook: Start with "Here's how it works:" or "The whole thing is three steps:"
Format: Short sentences, active voice
Example: "Here's how it works. Book a call and we map your current pipeline on one page. You leave with the three gaps costing you the most and the order to fix them in. Then the [Unique Mechanism] gives you the weekly rhythm that keeps it from drifting back. That's it. [CTA]"
`,

  pain_pdc: `
Generate body copy using the PDC Pain angle — the specific struggle at the centre of this work, told from the coach's side.

Framework: PDC Pain (Pain / Desire / Circumstance) — Pain leg.

Structure following PAS:
1. PAIN — Name it precisely (30-40 words): Open on the specific moment the coach knows this problem by — from their own experience of it, or from doing this work up close. Name the actual lived detail, not a category. Concrete beats general.
2. AGITATE — Show what it costs (40-50 words): Stay with that moment and name what it takes out of a week, and which of the usual fixes do not hold. Keep sentences short — maximum 15 words each.
3. SOLUTION — Position the offer as the way through (40-60 words): Introduce the unique mechanism. Name what makes it structurally different. Include one specific outcome or timeframe drawn from the supplied material.
4. CTA (1 sentence): One clear next step. Use an approved Meta CTA format: "Learn More", "Book a Call", "Get Started", "Sign Up", or "Download Free Guide".

ICP CONTEXT: Use the ideal customer profile data provided to choose WHICH struggle this angle leads with and what vocabulary the field uses for it. The copy then describes that struggle from the coach's own experience of it — the profile selects the subject; it is not a set of claims to make about the reader.

Tone: Empathetic but direct. No motivation-poster language. No fluff. Write like someone describing something they have actually sat in.

BANNED WORDS — never use any of these: ${BANNED_COPYWRITING_WORDS.join(', ')}.

Output ONE body copy, 125-150 words, plain text, no JSON wrapper.
`,

  desire_pdc: `
Generate body copy using the PDC Desire angle — the outcome this work is aimed at.

Framework: PDC Desire (Pain / Desire / Circumstance) — Desire leg.

Structure following PAS:
1. PAIN — The gap, named plainly (20-30 words): One short sentence on the distance between how this work usually goes and how it goes once it's working. Grounds the desire in something real.
2. AGITATE — How small the missing piece is (40-50 words): Name the specific thing that holds the outcome just out of reach. It is not effort — name the missing mechanism, and how close the gap actually is.
3. SOLUTION — The offer as the bridge (50-60 words): Describe the end state concretely — a number, a timeframe, a daily reality, each drawn from the supplied material. Then show how the unique mechanism gets there. Aspirational but grounded: no guarantees, no hype.
4. CTA (1 sentence): One clear next step. Use an approved Meta CTA format: "Learn More", "Book a Call", "Get Started", "Sign Up", or "Download Free Guide".

ICP CONTEXT: Use the ideal customer profile data to choose which outcome to lead with and the vocabulary the field uses for it. Describe the end state in that vocabulary rather than in coaching language.

Tone: Aspirational but grounded. Specific outcomes, not emotional hyperbole. The outcome should read as achievable and earned.

BANNED WORDS — never use any of these: ${BANNED_COPYWRITING_WORDS.join(', ')}.

Output ONE body copy, 125-150 words, plain text, no JSON wrapper.
`,

  circumstance_pdc: `
Generate body copy using the PDC Circumstance angle — describe the stage of the work this offer meets, precisely enough to be unmistakable.

Framework: PDC Circumstance (Pain / Desire / Circumstance) — Circumstance leg.

Structure following PAS:
1. PAIN — Describe the stage with precision (35-45 words): Name the specific point in this work where the offer becomes relevant — the actions already being taken at that stage, and why those actions stop short of the result they should produce. Write it as an observation about the stage itself: "There's a point in [specific work] where…" Open on an observation, not a question.
2. AGITATE — Name what holds things at that stage (40-50 words): The structural reason effort alone does not clear it. Not a character flaw — a missing mechanism, named so it reads as obvious once said. Keep sentences under 15 words.
3. SOLUTION — The mechanism that moves past it (40-55 words): Introduce the unique mechanism as the thing that addresses that exact bottleneck. Connect it to the stage described in the opening. One concrete outcome or timeframe, drawn from the supplied material.
4. CTA (1 sentence): One clear next step. Use an approved Meta CTA format: "Learn More", "Book a Call", "Get Started", "Sign Up", or "Download Free Guide".

ICP CONTEXT: Use the ideal customer profile data — objections, current situation, communication style, buying triggers — to identify WHICH stage of the work to describe and the vocabulary the field uses for it. The accuracy belongs to the description of that stage, drawn from the coach's experience of it. The copy describes a situation; it does not tell the reader that they are in it.

Tone: Observational, not salesy. Precise, not clinical. Write like someone who has worked this stage many times and is describing what reliably happens there.

BANNED WORDS — never use any of these: ${BANNED_COPYWRITING_WORDS.join(', ')}.

Output ONE body copy, 125-150 words, plain text, no JSON wrapper.
`,
};

/**
 * Angles whose BEAT STRUCTURE is built around proof — a client account or a real
 * figure. Offered only once the coach's proof is on the record; a launch-stage coach
 * handed one of these has to invent the client or the number to fill the structure.
 * The remaining angles carry a full deck on their own.
 */
export const PROOF_DEPENDENT_ANGLES: BodyAngle[] = ["social_proof", "data_driven"];

export const ALL_BODY_ANGLES: BodyAngle[] = [
  "pain_agitation",
  "social_proof",
  "authority",
  "curiosity",
  "story",
  "urgency",
  "benefit_stack",
  "comparison",
  "question",
  "guarantee",
  "transformation",
  "contrarian",
  "data_driven",
  "emotional",
  "direct_response",
  "pain_pdc",
  "desire_pdc",
  "circumstance_pdc",
];

// ─── AWARENESS-STAGE ADAPTATION ──────────────────────────────────────────────
//
// Schwartz's core principle: the same offer needs different copy depending on what the reader
// already knows. Until now the live cascade ignored this entirely — `liteMode` selected
// `availableAngles.slice(0, 3)`, i.e. the first three angles in ARRAY ORDER, with no strategic
// basis. For a coach with testimonials that resolved to pain_agitation + social_proof + authority:
// two of the three cold-traffic ads written for people who already know the brand, and nothing at
// all for the Unaware reader the prospecting research allocates 37.5% of the batch to.
//
// SOURCES (all in docs/andromeda/):
//   [HOOK-MAP]   script-research/Meta Ads Creative Strategy 2026_ Mapping Hook Patterns to
//                Schwartz Awareness Stages.md — §2 Unaware, §3 Problem-Aware, §4 Solution-Aware,
//                §5 Product-Aware, §6 Most-Aware. Gives the primary + secondary hook per stage.
//   [COHERENCE]  image-research/Image-and-Copy Coherence… §2 "The Matched-Pair Awareness Map" —
//                splits each stage into a HEADLINE focus (intrigue) and a PRIMARY TEXT focus
//                (invite). The stage guidance below is taken from its Primary-Text column.
//   [PROSPECT]   prospecting-research/…Definitive B2C Prospecting & Creative Architecture
//                Playbook.md §3 — Unaware copy mechanics.

/**
 * Which body angle carries each awareness stage.
 *
 * Deliberately mirrors the shape of CANDIDATE_HOOK_AWARENESS_MAP in _core/conceptAxis.ts — same
 * primary/secondary structure and the same fall-through behaviour when an angle is unavailable,
 * so the two maps stay legible as one idea applied twice (hooks there, body copy here).
 *
 * Mapping rationale, per stage, from [HOOK-MAP]:
 *   unaware        §2 "ultimate pattern interrupt… bridges total ignorance and curiosity"; the 18
 *                  angles carry no meme/humour angle, so `curiosity` (the counterintuitive reason
 *                  the problem persists) is the closest pattern-interrupt. `data_driven` matches
 *                  the report's named SECONDARY ("shocking statistics") exactly.
 *   problem_aware  §3 "Primary Hook – Problem-First… leading with recognition of the struggle
 *                  validates the user's experience" → pain_agitation (PAS). The report names a
 *                  "contrarian truth" as the rapport mechanism → `contrarian`; and
 *                  founder-authenticity as secondary → `story`.
 *   solution_aware §4 "Primary Hook – Aspirational/Transformation" → `transformation`. The reader
 *                  is "comparing mechanisms" → `comparison`. Founder shifts "from Guide to
 *                  Architect" → `authority`.
 *   product_aware  §5 "Primary Hook – Social-Proof… Secondary Hook – Data/Chart" → social_proof,
 *                  data_driven. "Lower the perceived risk" → `guarantee`.
 *   most_aware     §6 the six primary hooks are "generally ineffective" here; the shift is to
 *                  "Direct Offer, Urgency, or Scarcity" → urgency, direct_response. NOTE: the cold
 *                  prospecting batch allocates ZERO most_aware slots (COLD_WEIGHTED_STAGE_MIX), so
 *                  this row is reached only by a warm/retargeting caller. Kept for completeness.
 */
export const ANGLE_AWARENESS_MAP: Record<
  AwarenessStage,
  { primary: BodyAngle; secondary: BodyAngle[] }
> = {
  unaware: { primary: "curiosity", secondary: ["story", "data_driven"] },
  problem_aware: { primary: "pain_agitation", secondary: ["contrarian", "story"] },
  solution_aware: { primary: "transformation", secondary: ["comparison", "authority"] },
  product_aware: { primary: "social_proof", secondary: ["data_driven", "guarantee"] },
  most_aware: { primary: "urgency", secondary: ["direct_response", "social_proof"] },
};

/**
 * Resolve the angle for a stage against the angles actually available to THIS coach.
 *
 * Proof-dependent angles (social_proof, data_driven) are withheld from a coach whose client
 * material is not on the record — see PROOF_DEPENDENT_ANGLES above. product_aware's primary AND
 * first secondary are both proof-dependent, so a launch-stage coach falls through to `guarantee`.
 * Identical fall-through logic to renderHookGuidance() in conceptGenerator.ts, for the same reason:
 * a stage must never lose its guidance just because its preferred angle is unavailable.
 *
 * `taken` lets a caller avoid handing the same angle to two slots — with 3 unaware slots in a full
 * batch, the primary alone would repeat three times.
 */
export function angleForStage(
  stage: AwarenessStage,
  availableAngles: readonly BodyAngle[],
  taken: ReadonlySet<BodyAngle> = new Set(),
): BodyAngle | null {
  const { primary, secondary } = ANGLE_AWARENESS_MAP[stage];
  const ordered = [primary, ...secondary];
  // Returns null when every mapped angle is unavailable or already spent. The caller backfills that
  // slot from the remaining angles, keeping the slot's PLANNED stage guidance — which preserves
  // deck size without ever issuing the same angle twice. (A deck longer than 4 stages × 3 mapped
  // angles necessarily exhausts the map; the 18-angle full deck does exactly that.)
  return ordered.find((a) => availableAngles.includes(a) && !taken.has(a)) ?? null;
}

/**
 * The stage-appropriate directive appended to a body-copy prompt.
 *
 * Taken from [COHERENCE §2]'s Primary-Text column, with the stage objective from [HOOK-MAP].
 * POSITIVE-FRAMED ONLY — CLAUDE.md §14: naming a failure shape in an LLM prompt primes the model
 * to emit it, which is what caused the Sprint B email regression. Each block states what the copy
 * IS, never what it must avoid.
 *
 * Deliberately additive: this does NOT restate word count, PAS structure, register, banned words
 * or compliance rules. Those already exist in the body prompt and are unchanged — the stage block
 * only says who the reader is and what job the copy is doing for them.
 */
/**
 * The HEADLINE half of the same research table.
 *
 * [COHERENCE §2] "The Matched-Pair Awareness Map" has two copy columns, not one:
 * a **Headline Focus (Intrigue)** and a **Primary Text Focus (Invite)**.
 * STAGE_COPY_GUIDANCE below is the Primary-Text column. This is the Headline
 * column, quoted per stage:
 *
 *   Unaware        "Broad curiosity; opening a knowledge gap without selling."
 *   Problem-Aware  "Validating the specific pain; naming the struggle with precision."
 *   Solution-Aware "Highlighting unique benefits; the mechanism of change."
 *   Product-Aware  "Reducing perceived risk; lead with social proof or credentials."
 *   Most-Aware     "Specific incentives; limited-time offers or urgent CTAs."
 *
 * Both columns live in this one file deliberately. They are two halves of a single
 * table, and splitting them across modules is how the two would quietly drift into
 * disagreeing about the same stage — the failure [COHERENCE §3] calls a "Case 1
 * awareness mismatch", where a Problem-Aware image meets a Product-Aware headline
 * and "triggers retrieval suppression due to conflicting DNA".
 *
 * A headline is not a short body. The Intrigue column asks the headline to open the
 * loop; the Invite column asks the body to walk through it. Guidance written for one
 * produces the wrong shape in the other.
 */
export const STAGE_HEADLINE_GUIDANCE: Record<AwarenessStage, string> = {
  unaware: `AWARENESS STAGE — UNAWARE ([COHERENCE §2] headline column, [HOOK-MAP §2]).
This headline's job is broad curiosity: open a knowledge gap WITHOUT selling. The reader
does not yet have words for the problem, so naming the offer, the method or the outcome
closes the loop before it opens. Lead on the counterintuitive observation about the
situation itself. No mechanism name, no outcome promise, no urgency.`,

  problem_aware: `AWARENESS STAGE — PROBLEM-AWARE ([COHERENCE §2] headline column, [HOOK-MAP §3]).
This headline's job is validation: name the specific struggle with precision, in the
reader's own vocabulary, so it reads as recognition before it reads as an offer. The
recognisable version of the problem — not the category, and not yet the solution.`,

  solution_aware: `AWARENESS STAGE — SOLUTION-AWARE ([COHERENCE §2] headline column, [HOOK-MAP §4]).
This headline's job is the mechanism of change: lead on what this method does differently
and why that difference produces the result. The reader is comparing approaches, so the
headline must give them the thing to compare.`,

  product_aware: `AWARENESS STAGE — PRODUCT-AWARE ([COHERENCE §2] headline column, [HOOK-MAP §5]).
This headline's job is reducing perceived risk: lead with proof or credentials drawn from
the supplied material. The reader knows the coach and is weighing whether to commit, so
the headline answers the hesitation rather than restating the promise.`,

  most_aware: `AWARENESS STAGE — MOST-AWARE ([COHERENCE §2] headline column, [HOOK-MAP §6]).
This headline's job is the specific incentive and the next step. Be direct: the offer and
any REAL coach-supplied deadline or limit. Urgency only where a genuine deadline exists in
the supplied material; otherwise close on the concrete next step.`,
};

export const STAGE_COPY_GUIDANCE: Record<AwarenessStage, string> = {
  unaware: `AWARENESS STAGE — UNAWARE ([HOOK-MAP §2], [COHERENCE §2]).
This reader does not yet have words for the problem. They are scrolling for entertainment, not
solutions. Open a knowledge gap and let curiosity carry them — an educational entry point, a short
story or an observation that lands as native to the feed. Keep the offer in the background; the job
of this copy is recognition, not the sale. Lead with the counterintuitive observation, so the first
lines carry the specific subject matter rather than a generic opening ([PROSPECT §3]: the platform
reads the opening tokens to classify what this ad is about).`,

  problem_aware: `AWARENESS STAGE — PROBLEM-AWARE ([HOOK-MAP §3], [COHERENCE §2]).
This reader feels the problem clearly and has no guide. Name the struggle with precision — the
specific, recognisable version of it — so the copy reads as validation before it reads as an offer.
A contrarian truth about why the problem persists builds rapport fastest here. Then establish the
coach's expertise and introduce the pathway.`,

  solution_aware: `AWARENESS STAGE — SOLUTION-AWARE ([HOOK-MAP §4], [COHERENCE §2]).
This reader already knows solutions exist and is comparing mechanisms. Lead with the mechanism of
change — what this method does differently and why that difference produces the result. Demonstrate
the unique approach concretely enough to be compared against the alternatives they are weighing.`,

  product_aware: `AWARENESS STAGE — PRODUCT-AWARE ([HOOK-MAP §5], [COHERENCE §2]).
This reader knows the coach and is weighing risk. Lead with proof drawn from the supplied material —
real results, credentials, real client accounts. Address the specific hesitation directly and give
the reader permission to commit.`,

  most_aware: `AWARENESS STAGE — MOST-AWARE ([HOOK-MAP §6], [COHERENCE §2]).
This reader is convinced and waiting on timing. Be direct: the offer, the next step, and any REAL
coach-supplied deadline or limit. Urgency comes only from a genuine deadline present in the supplied
material; where none exists, close on the concrete next step instead.`,
};
