import { invokeLLM } from "./_core/llm";
import type { LandingPageContent } from "../drizzle/schema";
import { BANNED_COPYWRITING_WORDS, META_COMPLIANCE_NOTES, NO_DATE_FABRICATION_RULE, NO_RESEARCH_STATISTIC_FABRICATION_RULE, truncateQuote } from "./_core/copywritingRules";
import { validateLandingPageTestimonialsFabrication } from "./_core/validator";

// The 12 simple-string fields in the landing-page schema. Each is
// declared `type: "string"` in the json_schema below; production data
// (JSON_TYPE inspection on 22 rows) confirmed the LLM sometimes emits
// these as nested {body, headline} objects instead of flat strings,
// which previously slipped through three layers (JSON.parse, the
// validated block's `||` fallback, MySQL JSON column storage) and
// reached the renderer as visible JSON syntax. The runtime typeof
// check below is the content-safety layer that prevents this; it is
// permanent and survives the planned Option B tool-use migration
// (tool-use enforces type at the API level, but a no-cost runtime
// check is belt-and-braces — kept).
const LP_STRING_SCHEMA_FIELDS = [
  "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
  "problemAgitation", "solutionIntro", "whyOldFail", "uniqueMechanism",
  "insiderAdvantages", "scarcityUrgency", "shockingStat", "timeSavingBenefit",
] as const;

// Bounded retry on schema-violating model output. Three attempts gives
// the model two retries to produce schema-conforming output before
// throwing; if all three return at least one non-string field, we
// fail the generation rather than store structurally corrupt content.
const LP_SCHEMA_RETRY_MAX_ATTEMPTS = 3;

// Angle-specific prompt modifiers based on industry research
const ANGLE_PROMPTS = {
  original: `
Generate a benefit-driven landing page emphasizing the unique mechanism and transformation.

Focus on:
- Specific results and timeframe
- Proprietary system name
- Step-by-step process
- Guarantee included

CTA: "Claim Your FREE Consultation!"
  `,
  godfather: `
Generate a landing page with an IRRESISTIBLE OFFER using risk reversal.

Focus on:
- Money-back guarantee
- "Or you don't pay" - removes all risk
- Making it impossible to say no
- Risk reversal throughout copy

CTA: "Book My Free [Service] Call"
Key phrase: Emphasize "Or you don't pay" throughout the copy
  `,
  free: `
Generate a landing page emphasizing FREE consultation/training/resources.

Focus on:
- Free value
- No credit card required
- Risk-free start
- Immediate access

CTA: "Claim Your FREE [Offer]!"
Key phrase: Emphasize "FREE" and "no strings attached"
  `,
  dollar: `
Generate a landing page with specific price positioning.

Focus on:
- Exact pricing
- Value comparison
- Cost breakdown
- Limited-time pricing

CTA: "Get Started for $[Price]"
Key phrase: Emphasize specific price and value
  `
};

// ───────────────────────────────────────────────────────────────────────────
// PAGETYPE_PROMPTS — workstream commit 5b
// ───────────────────────────────────────────────────────────────────────────
// Path A architecture: pageType drives prompt copy emphasis + intentional
// section blanks within the existing 16-section LandingPageContent shape.
// Renderer (server/lib/landingPageHtml.ts:76-220) already gracefully omits
// empty sections via ok(content.X) checks — so for non-sales-page types,
// instructing the LLM to leave specific sections as empty strings produces
// a structurally appropriate page (webinar registration, discovery call
// booking, lead magnet download, event registration) without renderer
// changes.
//
// Sprint 3b/4b/4c learnings baked in at builder-design time:
//   - VOICE CONVENTION LOCK (item #1): each block declares first-person
//     singular pronoun convention. Critical for discovery_call_booking
//     which overlaps email's discovery_call domain.
//   - FIELD SUBSTITUTION CONVENTION (item #3): substitute when present,
//     [INSERT_*] when absent — uniform across all sections.
//   - PLACEHOLDER ALLOW-LIST (items #5 + #11): only emit cataloged
//     [INSERT_*] tokens. Negative list explicit. Canonical names used
//     ([INSERT_BOOKING_URL] not [INSERT_BOOKING_LINK] — item #14
//     preemptively applied).
//   - BANNED-PHRASE BLOCKS (item #7): lead_magnet_download forbids fake
//     urgency. discovery_call_booking forbids cohort-scarcity language.
export type LpPageType =
  | 'sales_page'
  | 'webinar_registration'
  | 'discovery_call_booking'
  | 'lead_magnet_download'
  | 'event_registration';

const PAGETYPE_PROMPTS: Record<LpPageType, string> = {
  sales_page: `
PAGE TYPE: Long-form sales page (default; backward-compatible with all
landing pages generated pre-commit-5b).

SECTIONS TO POPULATE: ALL 16 sections — eyebrowHeadline, mainHeadline,
subheadline, primaryCta, asSeenIn, quizSection, problemAgitation,
solutionIntro, whyOldFail, uniqueMechanism, testimonials, insiderAdvantages,
scarcityUrgency, shockingStat, timeSavingBenefit, consultationOutline, faq, guarantee.

Follow the EMOTIONAL ARC structure below in full.

PLACEHOLDER ALLOW-LIST (workstream commit 6 — sprint 3b+4b items #5 + #11
+ #14, retroactive coverage of sales_page baseline): Sales page copy is
generated as final content; do NOT emit operator-fill [INSERT_*] tokens
for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_
LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_
CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK]
(use canonical [INSERT_BOOKING_URL] only if the page is meant to drive
a 1:1 booking, otherwise write the actual call-to-action). Write actual
content for any value not in this allow-list.
`,

  webinar_registration: `
PAGE TYPE: Webinar registration page.

SECTIONS TO POPULATE (fill substantively):
- eyebrowHeadline, mainHeadline, subheadline, primaryCta — registration hero.
- scarcityUrgency — date + time + timezone of the LIVE webinar (use
  [INSERT_EVENT_DATE], [INSERT_EVENT_TIME], [INSERT_EVENT_TIMEZONE] if not
  pre-supplied; never invent dates).
- consultationOutline — re-purposed as "What you'll learn LIVE" — 3-4
  specific learning outcomes the attendee will walk away with.
- testimonials — 2-3 short-form quotes from past attendees if available.
- timeSavingBenefit — re-purposed as "Why attend live (not just the replay)" —
  one specific reason live attendance matters.
- faq — 2-3 FAQ items about the webinar (when is it, how to access, replay availability).

SECTIONS TO LEAVE EMPTY (return as empty string ""):
- problemAgitation: ""
- solutionIntro: ""
- whyOldFail: ""
- uniqueMechanism: ""
- shockingStat: ""
- insiderAdvantages: ""
- quizSection: { question: "", options: [], answer: "" }
- guarantee: ""
- asSeenIn: [] (or 1-2 entries if real)

VOICE CONVENTION LOCK: First-person singular throughout. The host is "I" /
"me" / "my". No drift to "we" or third-person.

FIELD SUBSTITUTION CONVENTION: Use literal values from above when supplied
(eventDate, eventTime, etc.); use [INSERT_*] tokens verbatim when not
supplied. No coin-flipping.

PLACEHOLDER ALLOW-LIST: Only emit [INSERT_EVENT_DATE], [INSERT_EVENT_TIME],
[INSERT_EVENT_TIMEZONE], [INSERT_EVENT_NAME], [INSERT_HOST_NAME],
[INSERT_REPLAY_AVAILABILITY] when their values are operator-supplied.
SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE],
[INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_
PROGRAM_NAME], [INSERT_BOOKING_LINK] (use [INSERT_BOOKING_URL] if
needed). Write actual content for any value not in the allow-list.

CTA copy: "Save your seat", "Register now", "Join us live on [date]"
(substitute eventDate if supplied).

EMOTIONAL ARC: Show-up urgency (the live event is the vehicle) — copy must
give a compelling reason to attend live, not just register. Section voice
focuses on what the attendee WILL EXPERIENCE in the room/Zoom, not on
problem-agitation or transformation-journey arcs. Sales page emotional
sequencing does NOT apply here.
`,

  discovery_call_booking: `
PAGE TYPE: 1:1 discovery call booking page.

SECTIONS TO POPULATE (fill substantively):
- eyebrowHeadline, mainHeadline, subheadline, primaryCta — booking hero.
  CTA: "Book a Discovery Call", "Apply for a Call", "Reserve Your Slot".
- consultationOutline — exactly THREE items, shown as three benefit bands, covering
  what the call addresses. Each item: title = a 2-4 word topic keyword the reader gains
  clarity on (e.g. "Clarify Your Offer", "Map Your Path", "Spot The Gap"); description =
  one concrete single-line sentence on what that part of the call covers for the reader.
  First-person singular voice, niche-specific to this offer. Do NOT invent call durations,
  dates, cohort windows, or specific outcomes.
- testimonials — 1-2 short quotes from past clients if available.
- faq — 2-3 FAQ items about the call (duration, what to prepare, is it a sales call).

SECTIONS TO LEAVE EMPTY (return as empty string ""):
- problemAgitation: ""
- whyOldFail: ""
- scarcityUrgency: ""
- shockingStat: ""
- uniqueMechanism: ""
- solutionIntro: ""
- timeSavingBenefit: ""
- insiderAdvantages: ""
- quizSection: { question: "", options: [], answer: "" }
- guarantee: ""
- asSeenIn: []

VOICE CONVENTION LOCK: First-person singular throughout. The host is "I" /
"me" / "my". Sign-off uses host name. No drift to "we" or third-person.
This page MUST match the voice convention used by email's discovery_call_
confirmation/reminder builders (commit 4c retroactive port) — operator-
side cross-channel consistency.

FIELD SUBSTITUTION CONVENTION: Use literal values when supplied; use
[INSERT_*] tokens verbatim when not.

PLACEHOLDER ALLOW-LIST: Only emit [INSERT_BOOKING_DURATION], [INSERT_
HOST_NAME], [INSERT_BOOKING_URL]. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_
DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_
DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_COHORT_DATE], [INSERT_
APPLICATION_DEADLINE]. Write actual content for any value not in the
allow-list.

BANNED PHRASES (item #7 + sprint 4b item #12 lessons applied):
"cohort places limited", "spots filling fast", "apply now rather than
later", "before this cohort closes", "places filling up", any
fabricated cohort-scarcity language. The CTA is informational
("Book a call"), not urgent. Operator-side urgency lives at the
calendar destination, not on this page.

NO-FABRICATION RULE (item #10 lesson applied): Do NOT invent specific
call durations beyond what's supplied. Do NOT invent cohort dates,
program names, application windows. If duration not supplied, use
[INSERT_BOOKING_DURATION] verbatim.

EMOTIONAL ARC: Selectivity + qualification framing. The page's job is
to set the expectation that this is a 1:1 fit-check, not a sales pitch.
The reader should feel: "this is for people serious about [outcome] —
let me see if I qualify." NOT: "I'm being pitched to / This is a
high-pressure close."
`,

  lead_magnet_download: `
PAGE TYPE: Lead magnet download / opt-in page.

SECTIONS TO POPULATE (fill substantively):
- eyebrowHeadline, mainHeadline, subheadline, primaryCta — opt-in hero.
  CTA: "Get the Free Guide", "Download Free", "Send Me the [Asset]".
- problemAgitation — one short paragraph naming the specific situation the
  reader is in that this asset addresses. Concrete + niche-specific.
- testimonials — 1-2 short quotes from past readers if available.
- faq — 2-3 FAQ items about the download (format, how to access, what is included).
- consultationOutline — exactly THREE benefit items, shown as three benefit bands.
  Each item has: title = a 2-4 word capability keyword the reader gains (e.g.
  "Organize & Maximize", "Discipline & Focus", "Structure & Support"); description =
  one concrete single-line sentence stating who it is for and the outcome the asset
  delivers. Make the three cover distinct angles — a headline outcome, a capability
  gained, and a structure/support benefit. First-person singular voice, niche-specific
  to this asset. Keep each description to one line.
- featureHighlights — up to EIGHT short "what's inside / how it helps" feature lines,
  shown as a tile grid. Each is a single short phrase describing something concrete the
  reader gets or can do with the asset (e.g. "A simple one-page format", "Daily focus
  prompts", "Print-friendly layout", "A short video walkthrough"). Keep them QUALITATIVE:
  describe the format, the usefulness, and how it fits into a busy day. Do NOT invent
  quantities, durations, counts, or statistics — no "X years", no "X prompts", no
  numeric claims unless a real figure is supplied in the input. Positive, first-person
  singular voice, niche-specific to this asset.

SECTIONS TO LEAVE EMPTY (return as empty string ""):
- scarcityUrgency: "" (CRITICAL — see banned phrases below)
- shockingStat: ""
- whyOldFail: ""
- uniqueMechanism: ""
- solutionIntro: ""
- insiderAdvantages: ""
- timeSavingBenefit: ""
- quizSection: { question: "", options: [], answer: "" }
- guarantee: ""
- asSeenIn: []

VOICE CONVENTION LOCK: First-person singular throughout. The host is "I" /
"me" / "my". No drift to "we".

FIELD SUBSTITUTION CONVENTION: Use literal values when supplied;
[INSERT_*] verbatim otherwise.

PLACEHOLDER ALLOW-LIST: Only emit [INSERT_LEAD_MAGNET_NAME], [INSERT_
HOST_NAME]. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_
DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_
NEXT_PROGRAM_NAME], [INSERT_DOWNLOAD_LINK] (the form handles delivery,
no link in copy needed).

BANNED PHRASES (CRITICAL — this is an opt-in page, not a sales close):
NO "limited time", NO "limited spots", NO "available for X days", NO
"hurry before this expires", NO "act fast", NO countdown timers, NO
fabricated urgency. The asset itself is the value — fake urgency on
opt-in pages erodes trust faster than it converts. The integrity of
the offer comes from "what you get is genuinely useful," not from
artificial scarcity.

NO-FAKE-PRICING RULE: Do NOT mention pricing, "normally $X / today
free", "value of $XYZ" anchoring. The asset is positioned as
genuinely-free, no anchor games.

EMOTIONAL ARC: Specific concrete asset framing. The reader should
feel: "this is exactly the [PDF / guide / training / template] I
needed — let me grab it before I lose the tab." NOT: "this is part
of a sales sequence I'm being funneled through."
`,

  event_registration: `
PAGE TYPE: In-person event registration page.

SECTIONS TO POPULATE (fill substantively):
- eyebrowHeadline, mainHeadline, subheadline, primaryCta — registration
  hero. CTA: "Reserve Your Seat", "Register for [city]", "Save Your
  Spot at [venue]".
- scarcityUrgency — venue + date + time + timezone. Use [INSERT_EVENT_
  VENUE], [INSERT_EVENT_DATE], [INSERT_EVENT_TIME], [INSERT_EVENT_
  TIMEZONE] when not supplied.
- consultationOutline — re-purposed as "Event agenda" — bullet list of
  what happens during the day. Use [INSERT_EVENT_AGENDA] if not
  supplied; never invent agenda items.
- insiderAdvantages — "Why this is worth being in the room for" — 2-3
  reasons attending in person beats watching recordings.
- faq — 2-3 FAQ items about the event (parking, what to bring, dress code).

SECTIONS TO LEAVE EMPTY (return as empty string ""):
- problemAgitation: ""
- whyOldFail: ""
- shockingStat: ""
- uniqueMechanism: ""
- solutionIntro: ""
- timeSavingBenefit: ""
- testimonials: [] (or 1-2 entries if real)
- quizSection: { question: "", options: [], answer: "" }
- guarantee: ""
- asSeenIn: []

VOICE CONVENTION LOCK: First-person singular throughout. The host is "I" /
"me" / "my". Sign-off uses host name. No drift to "we" or third-person.

FIELD SUBSTITUTION CONVENTION: Literal when supplied; [INSERT_*] verbatim
when not.

PLACEHOLDER ALLOW-LIST: Only emit [INSERT_EVENT_VENUE], [INSERT_EVENT_
DATE], [INSERT_EVENT_TIME], [INSERT_EVENT_TIMEZONE], [INSERT_EVENT_NAME],
[INSERT_EVENT_AGENDA], [INSERT_HOST_NAME], plus operator-discretion:
[INSERT_PARKING_INFO], [INSERT_DRESS_CODE], [INSERT_ROOM_OR_FLOOR_INFO],
[INSERT_DIETARY_NOTES]. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE],
[INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION],
[INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_TIME], [INSERT_BOOKING_
TIMEZONE] (use canonical [INSERT_EVENT_TIME] / [INSERT_EVENT_TIMEZONE]
for event start time — BOOKING_* tokens are for 1:1 call scheduling,
not in-person events).

EMOTIONAL ARC: Physical-presence value framing. The reader should feel:
"the room itself is the value — being there in person matters." NOT:
"this is one of many events I could attend / I can catch the recording."
Specific city + venue + date anchor the sense of "this specific moment
in this specific place."
`,
};

export async function generateLandingPageAngle(
  productName: string,
  productDescription: string,
  avatarName: string,
  avatarDescription: string,
  angle: 'original' | 'godfather' | 'free' | 'dollar',
  socialProof: any,
  cascadeContext: string = "",
  pageType: LpPageType = 'sales_page',
): Promise<LandingPageContent> {
  // Social proof guidance (Issue 2 fix)
  const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers || socialProof.hasPress
    ? `REAL SOCIAL PROOF AVAILABLE:
${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}
${socialProof.hasRating ? `- ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews` : ''}
${socialProof.hasTestimonials ? `- Real testimonials:\n${socialProof.testimonials.map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')}` : ''}
${socialProof.hasPress ? `- Press features: ${socialProof.press}` : ''}

You MUST use these exact numbers and real testimonials. Do not fabricate or inflate.`
    : `NO SOCIAL PROOF DATA PROVIDED — SUPPRESS ALL FABRICATED PROOF:
- Set "testimonials" to an EMPTY ARRAY []. Do not generate fictional testimonials, fictional names, or fictional quotes of any kind.
- Set "asSeenIn" to an EMPTY ARRAY []. Do not fabricate publication names.
- The renderer will gracefully omit these sections when empty.
- Focus the remaining sections on benefit claims and transformation stories.`;
  
  const prompt = `
You are a world-class direct response copywriter specializing in high-converting landing pages.

Product: ${productName}
Description: ${productDescription}
Target Avatar: ${avatarName} - ${avatarDescription}
Angle: ${angle}
Page Type: ${pageType}

${ANGLE_PROMPTS[angle]}

${PAGETYPE_PROMPTS[pageType]}

${socialProofGuidance}

EMOTIONAL ARC — every section of this landing page must serve a specific emotional purpose in sequence. A visitor who reads from top to bottom must feel each emotion in order:
Section 1 (Hero — eyebrow + main headline + subheadline): SEEN AND UNDERSTOOD. The reader must feel "this person knows exactly who I am and what I'm going through." Use their internal language. Name their situation precisely.
Section 2 (Problem — quizSection + problemAgitation): NAMED AND VALIDATED. "Finally, someone has put words to this." The problem must be described so accurately that the reader feels exposed. Name the specific daily situation, not a category of pain.
Section 3 (Agitate — whyOldFail + shockingStat): COST OF INACTION. "I cannot afford to stay here." Make the cost of not solving this problem feel concrete and immediate. Name the specific ways staying stuck is costing them (time, money, relationships, self-respect).
Section 4 (Solution — solutionIntroduction): HOPE. "There might be a way out." Introduce the possibility of a different outcome before introducing the mechanism. Make hope feel credible, not hype.
Section 5 (Mechanism — uniqueMechanismIntro): DIFFERENT FROM WHAT THEY'VE TRIED. "This is not the same thing I've already failed with." Explicitly name 1-2 things they've already tried and explain why this is structurally different — not just "better."
Section 6 (Proof — socialProofTestimonials + insiderAdvantages): SAFE TO BELIEVE. "Other people like me have done this." Testimonials must feel like real people, not marketing copy. Quote specific situations and specific results.
Section 7 (Offer — scarcityUrgency + timeSavingBenefit + consultationOutline): OBVIOUS NEXT STEP. "Not buying would be irrational." The offer must stack so much value that the question becomes "why wouldn't I?" Apply anchoring — state total value before the ask.

Generate a complete landing page with 16 sections following this structure:

1. **Eyebrow Headline** (all caps, attention-grabbing, addresses target avatar's pain, max 100 chars)
   Example: "FOR UAE & GCC CRYPTO BEGINNERS"

2. **Main Headline** (long-form, benefit-driven, 100-150 chars)
   A great landing page headline does three things simultaneously: (1) identifies the exact person it is written for so precisely that anyone else feels excluded, (2) names the specific outcome they want using their own words not marketing language, (3) signals that this is different from everything they have already tried. Do not use fill-in-the-blank template patterns — write a headline that could only exist for this specific product and this specific avatar. The headline must not use any of these words: ${BANNED_COPYWRITING_WORDS.join(', ')}.

3. **Subheadline** (explains why current methods fail or what makes this different, 150-200 chars)
   Example: "...No blocked accounts, stress, or risking your family's trust - even if you've lost money before or think the local banking system is impossible to beat."

4. **Primary CTA Button** (clear action, 3-6 words)
   Example: "Claim Your FREE Consultation!"

5. **As Seen In** (5 credible publication names as array)
   Example: ["Forbes", "Inc.", "Entrepreneur", "Yahoo Finance", "Business Insider"]
   NOTE: DO NOT include "Meta", "Facebook", or "Instagram" as these imply platform endorsement which violates Meta advertising policy

6. **Quiz/Question Section** (niche-specific question with 5 plausible options and a surprising reveal answer, 200-300 words total)
   A great quiz question does two things: it makes the reader feel smart for knowing the answer (or curious because they don't), and it reframes their understanding of the problem. Rules: the question must use insider language from the target market; every option must sound genuinely plausible — a good option is one the reader would seriously consider before seeing the answer; the answer must surprise the reader and teach them something they could not have known without reading this page; the question must name a specific scenario from the niche, not a generic category. BANNED quiz patterns (too generic, do not use): "Which of these is the most important X", "What is the first step to X", "How many X do you need to Y".

7. **Problem Agitation** (emotional pain points, 200-300 words)
   Example: "Still Worrying You'll Be The Next Account Freeze Or Crypto Horror Story?"

8. **Solution Introduction** (introduces the unique mechanism, 200-300 words)
   Example: "If You've Tried P2P Groups, Chased Hot Signals, or Risked Your Bank Cards - and Still Aren't Seeing Real Crypto Profits..."

9. **Why Old Methods Fail** (contrarian angle, 200-300 words)
   Example: "Why Playing It 'Safe' With Mainstream Crypto Advice Actually Keeps You Stuck (and Broke)"

10. **Unique Mechanism Introduction** (names the proprietary system, 200-300 words)
    Example: "Introducing the 'Steady Wealth Protocol': Your Step-by-Step Safe Haven in Middle East Crypto"

11. **Social Proof / Testimonials** (4 testimonials with headline, quote, name, location)
    Example: 
    - Headline: "No More Blocked Accounts"
    - Quote: "Before this, every time I tried cashing out, my bank flagged me. Now I follow their exact steps and my accounts are safe. Finally, I have peace of mind."
    - Name: "Mohammed S."
    - Location: "Abu Dhabi, UAE"

12. **Insider Advantages** (what makes it different, 200-300 words)
    Example: "Unlock Insider Advantages: Built on Real Middle East Banking, Not Generic Advice"

13. **Scarcity / Urgency** (limited enrollment messaging, 200-300 words)
    Example: "The Steady Wealth Protocol Doors Are Only Open For a Short Window (Secure Your Spot Now)"

14. **Shocking Statistic** (data-driven fear, 150-200 words)
    Example: "92% of UAE Crypto Beginners Will Never Build Real Wealth Without a Proven System"

15. **Time-Saving Benefit** (shortcut positioning, 150-200 words)
    Example: "Save Yourself Years of Painful Guesswork: Our Blueprint Gives You the Shortcut to Real Crypto Income"

16. **Consultation Outline** (10 numbered items, each with a specific title and a deliverable-focused description)
    The consultation outline must feel like a genuine agenda, not a marketing list. Each item must name the specific deliverable the client will have at the end of that segment — what they have after that step that they did not have before it. BANNED consultation outline patterns (do not use as titles or descriptions): "Introduction and welcome", "Q&A", "Next steps", "Strategy overview", "Getting to know you" — these are placeholders, not deliverables. Every item must name a specific analysis, assessment, calculation, or output. Example: "Revenue Gap Analysis — At the end of this segment you will have a precise number: the exact monthly gap between your current income and your target, and the three specific levers available to close it."

17. **FAQ** (5-7 frequently asked questions with answers)
    Generate 5-7 FAQ items that address: common objections to buying, logistics questions (how it works, what is included, how long it takes), guarantee details, and one question about who this is NOT for. Each item has a "question" and "answer". Answers should be 2-3 sentences, conversational, and reassuring.

18. **Guarantee** (dedicated guarantee statement, 100-200 words)
    Write a dedicated risk-reversal guarantee section. Format as: first line is the guarantee headline (e.g., "Our 90-Day Money-Back Guarantee"), remaining lines are the guarantee body explaining terms and building confidence. If the operator provided a specific guarantee type or duration in the cascade context above, use it exactly. If not, write a results-oriented satisfaction guarantee appropriate to the offer type. Frame positively — what the customer gets, not what they lose.

SPECIFICITY CHECK — apply this before returning the JSON:
For every section, ask: does this section contain at least one phrase that could only appear on a landing page for THIS specific service in THIS specific niche? If any section contains only generic direct response language that could apply to any coaching programme, rewrite that section before returning. The test: mentally swap the product name for a different coaching product in a different niche. If the section still makes sense without any changes, it is not specific enough. Rewrite until it only makes sense for this product, this avatar, and this outcome.

Return as JSON matching the LandingPageContent type.
Use the avatar's name, location, and description throughout the copy to personalize it.
Make it compelling, benefit-driven, and conversion-focused.
Use direct response copywriting principles: pain agitation, unique mechanism, social proof, scarcity, and strong CTAs.
`;

  // Schema-violation retry. Wraps the LLM call + parse + type-check in a
  // bounded loop; if the model emits a non-string value for any field
  // declared as type:"string", we discard it and retry rather than store
  // structurally corrupt content. Permanent — Option B's tool-use
  // migration enforces types server-side, this runtime check stays as
  // belt-and-braces.
  //
  // Validator Phase 2 (Sprint B+1 path d, 2026-05-11): testimonials
  // fabrication-pattern check wired into the same retry loop. On
  // fabrication hits with attempts remaining, the validator's failContext
  // is injected into the next user prompt so Sonnet has explicit
  // information about what to fix. On retry exhaust, fabrication is
  // best-effort: log warning + return content (the LP completes; user
  // can swap individual fabricated testimonials post-hoc).
  let validatorFailContext: string | null = null;
  for (let leakAttempt = 1; leakAttempt <= LP_SCHEMA_RETRY_MAX_ATTEMPTS; leakAttempt++) {
  const effectiveUserContent = validatorFailContext
    ? `${cascadeContext}${prompt}\n\n---\n\nIMPORTANT: your previous attempt failed validation. ${validatorFailContext}`
    : `${cascadeContext}${prompt}`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: `You are a world-class direct response copywriter specializing in high-converting landing pages. You engineer an emotional arc through each page — every section serves a specific emotional purpose, moving the reader from 'seen and understood' through 'named and validated', 'cost of inaction', 'hope', 'different from what they've tried', 'safe to believe', and finally 'obvious next step'. You write in the customer's own language — the words they use with a close friend, not marketing language. FORMATTING RULE: Return plain text only inside all JSON string values. No markdown. No asterisks (*). No hash symbols (#). No bold or italic formatting of any kind. No bullet markers. Just clean readable sentences and paragraphs.\n\n${META_COMPLIANCE_NOTES}\n\n${NO_DATE_FABRICATION_RULE}\n\n${NO_RESEARCH_STATISTIC_FABRICATION_RULE}` },
      { role: "user", content: effectiveUserContent }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "landing_page_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            eyebrowHeadline: { type: "string" },
            mainHeadline: { type: "string" },
            subheadline: { type: "string" },
            primaryCta: { type: "string" },
            asSeenIn: { 
              type: "array", 
              items: { type: "string" }
            },
            quizSection: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: { 
                  type: "array", 
                  items: { type: "string" }
                },
                answer: { type: "string" }
              },
              required: ["question", "options", "answer"],
              additionalProperties: false
            },
            problemAgitation: { type: "string" },
            solutionIntro: { type: "string" },
            whyOldFail: { type: "string" },
            uniqueMechanism: { type: "string" },
            testimonials: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  quote: { type: "string" },
                  name: { type: "string" },
                  location: { type: "string" }
                },
                required: ["headline", "quote", "name", "location"],
                additionalProperties: false
              }
            },
            insiderAdvantages: { type: "string" },
            scarcityUrgency: { type: "string" },
            shockingStat: { type: "string" },
            timeSavingBenefit: { type: "string" },
            consultationOutline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" }
                },
                required: ["title", "description"],
                additionalProperties: false
              }
            },
            faq: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" }
                },
                required: ["question", "answer"],
                additionalProperties: false
              }
            },
            guarantee: { type: "string" },
          },
          required: [
            "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
            "asSeenIn", "quizSection", "problemAgitation", "solutionIntro",
            "whyOldFail", "uniqueMechanism", "testimonials", "insiderAdvantages",
            "scarcityUrgency", "shockingStat", "timeSavingBenefit", "consultationOutline",
            "faq", "guarantee"
          ],
          additionalProperties: false
        }
      }
    }
  });

  // Add error handling for undefined response
  if (!response || !response.choices || response.choices.length === 0) {
    console.error('Invalid LLM response:', JSON.stringify(response, null, 2));
    throw new Error('Invalid response from LLM: no choices returned');
  }
  
  const content = response.choices[0].message.content;
  if (typeof content !== 'string') {
    throw new Error('Invalid response format from LLM');
  }
  // Strip markdown code fences if LLM wraps response in ```json ... ```
  const cleaned = content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
  const parsed = JSON.parse(cleaned);

  // Runtime type-check on schema-declared string fields. Production
  // evidence (JSON_TYPE inspection across 22 rows: 13 corrupted, 59%)
  // shows the LLM frequently emits {body, headline} nested objects for
  // long-form sections where the schema declares `type: "string"`.
  // JSON.parse, the validated-block's `||` fallback, and MySQL's JSON
  // column all accept this without complaint, so the corruption surfaces
  // only at render time. Catch it here.
  let schemaViolated = false;
  for (const field of LP_STRING_SCHEMA_FIELDS) {
    const got = (parsed as Record<string, unknown>)[field];
    if (typeof got !== "string") {
      console.warn(
        `[landingPageGenerator] Schema violation on attempt ${leakAttempt}/${LP_SCHEMA_RETRY_MAX_ATTEMPTS} ` +
        `(angle=${angle}, field=${field}, gotType=${got === null ? "null" : typeof got}). Retrying.`,
      );
      schemaViolated = true;
      break;
    }
  }
  if (schemaViolated) continue;

  // No more silent-fallback layer. The previous validated-block pattern
  // (`parsed.X || 'fallback content'`) hid 5 weeks of model omissions
  // by substituting placeholder strings — primaryCta omitted on 100% of
  // production generations, masked as "Get Started Now"; OBJECT-typed
  // body sections rendered as visible JSON syntax. Under invokeLLM's
  // tool-use migration, every required field is enforced server-side
  // by Anthropic before the response returns. The typeof retry loop
  // above is belt-and-braces over that enforcement. Past this point,
  // `parsed` matches LandingPageContent by contract.

  // Validator Phase 2: testimonials fabrication-pattern check. Catches
  // direct quoted speech, invented tenure, family composition, research-
  // source attribution, etc. in the testimonials array. On hits with
  // attempts remaining, retry with fail-context. On exhaust, return
  // best-effort (LP completes; user-side swap available post-hoc).
  const testimonials = (parsed as { testimonials?: unknown }).testimonials;
  if (Array.isArray(testimonials)) {
    const fabResult = validateLandingPageTestimonialsFabrication(testimonials as Parameters<typeof validateLandingPageTestimonialsFabrication>[0]);
    if (!fabResult.ok) {
      if (leakAttempt < LP_SCHEMA_RETRY_MAX_ATTEMPTS) {
        validatorFailContext = fabResult.failContext;
        const hitCount = fabResult.hits.length;
        const hitSummary = fabResult.hits.slice(0, 3).map(h => `${h.classId}@${h.location}`).join(",");
        console.warn(`[landingPageGenerator] Testimonials fabrication check failed on attempt ${leakAttempt}/${LP_SCHEMA_RETRY_MAX_ATTEMPTS} (angle=${angle}, ${hitCount} hits, top=[${hitSummary}]). Retrying with fail-context.`);
        continue;
      }
      // Exhaust path — best-effort return + warning log.
      const hitClasses = fabResult.hits.map(h => h.classId).join(",");
      console.warn(`[landingPageGenerator] Testimonials fabrication check exhausted retries on angle=${angle} (${fabResult.hits.length} hits remaining, classes=[${hitClasses}]); returning content as best-effort. Sprint B+1 path d Phase 2.`);
      fabResult.hits.forEach((h, i) => {
        if (i < 5) console.warn(`[landingPageGenerator]   hit ${i + 1}: ${h.classId} @ ${h.location} matched "${h.matched}"`);
      });
    }
  }

  return parsed as LandingPageContent;
  }

  throw new Error(
    `Landing page generation failed for angle "${angle}": all ${LP_SCHEMA_RETRY_MAX_ATTEMPTS} attempts produced schema-violating output. Aborting rather than storing corrupt content.`,
  );
}

// Generate all 4 angles at once.
// onAngleComplete(completed, total) is called after each angle finishes so callers
// can write real progress updates to the job record during generation.
export async function generateAllAngles(
  productName: string,
  productDescription: string,
  avatarName: string,
  avatarDescription: string,
  socialProof: any,
  onAngleComplete?: (completed: number, total: number) => Promise<void>,
  cascadeContext: string = "",
  // Workstream commit 5b — pageType drives prompt copy emphasis + section
  // blanks (Path A architecture). Default 'sales_page' preserves backward-
  // compatible behavior for all existing callsites that don't pass pageType.
  pageType: LpPageType = 'sales_page',
): Promise<{
  original: LandingPageContent;
  godfather: LandingPageContent;
  free: LandingPageContent;
  dollar: LandingPageContent;
}> {
  // Generate all 4 angles in parallel. Previously batched 2+2 to avoid
  // "fetch failed" timeouts on the plain-text path under tool-use's
  // predecessor (see commits c18a8f8 and b8d43b1, March 2026). The
  // tool-use migration in e51aeed gives us API-level token-budget
  // predictability + every call has a 5-minute AbortController in
  // invokeClaudeAPI; running 4 concurrently brings end-to-end wall-time
  // from ~250s (2 batches × ~120s) down to ~120-140s (max of 4
  // parallel calls). Each angle's per-call output is ~5300 tokens —
  // 4 concurrent × ~5300 = ~21k tokens in flight, well under
  // Anthropic's tier-1 ITPM/OTPM ceilings.
  const TOTAL = 4;
  let completed = 0;
  const notify = async () => {
    completed++;
    if (onAngleComplete) {
      try { await onAngleComplete(completed, TOTAL); } catch { /* progress write failure is non-fatal */ }
    }
  };

  const [original, godfather, free, dollar] = await Promise.all([
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'original', socialProof, cascadeContext, pageType).then(async r => { await notify(); return r; }),
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'godfather', socialProof, cascadeContext, pageType).then(async r => { await notify(); return r; }),
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'free', socialProof, cascadeContext, pageType).then(async r => { await notify(); return r; }),
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'dollar', socialProof, cascadeContext, pageType).then(async r => { await notify(); return r; }),
  ]);
  return { original, godfather, free, dollar };
}

// ─── Auto Mode Phase B1 — runLandingPageGeneration ──────────────────────────
// Gen-core for the landing-page node. Callable directly by:
//   - landingPages.generate (sync tRPC mutation) — wrapped with quota check, returns full row
//   - landingPages.generateAsync (async tRPC mutation) — wrapped with quota check + jobId enqueue + retry-on-network-error path
//   - autoMode.orchestrate (Phase B2 orchestrator) — direct call with onProgress callback for "Generating angle X of 4…" labels routed to the orchestrator's own job
//
// What's inside: Service/SOT/ICP/Kit fetches → context building → avatar
// parsing → social-proof shape → generateAllAngles → DB insert → user-count
// + quota-count increments → auto-score + autoSelectBest into kit.
// What's outside: quota ENFORCEMENT (caller's job — wizard wrapper enforces;
// orchestrator skips by design), compliance precompute fire-and-forget
// (caller fires setImmediate after success).
export async function runLandingPageGeneration(input: {
  userId: number;
  serviceId: number;
  campaignId?: number;
  avatarName?: string;
  avatarDescription?: string;
  pageType?: LpPageType;
  onProgress?: (completed: number, total: number) => Promise<void>;
}): Promise<{ landingPageId: number }> {
  const { getDb } = await import("./db");
  const { landingPages, services, users, idealCustomerProfiles, sourceOfTruth, campaigns, campaignKits } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const { getCascadeContext } = await import("./_core/cascadeContext");
  const { incrementQuotaCount } = await import("./lib/quotaEnforcement");
  const { scoreItem } = await import("./lib/selectionScorer");
  const { autoSelectBest } = await import("./routers/campaignKits");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, input.serviceId), eq(services.userId, input.userId)))
    .limit(1);
  if (!service) throw new Error("Service not found");

  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) throw new Error("User not found");

  const [sot] = await db
    .select()
    .from(sourceOfTruth)
    .where(eq(sourceOfTruth.userId, input.userId))
    .limit(1);

  // ICP fetch — campaign-specific first, serviceId fallback
  let icp: typeof idealCustomerProfiles.$inferSelect | undefined;
  if (input.campaignId) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, input.userId)))
      .limit(1);
    if (campaign?.icpId) {
      [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaign.icpId)).limit(1);
    }
  }
  if (!icp) {
    [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
  }

  // campaignType from campaignKits (V2 SoT). Default course_launch when no kit.
  let campaignType: string = 'course_launch';
  if (icp?.id) {
    const [kit] = await db
      .select()
      .from(campaignKits)
      .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, icp.id)))
      .limit(1);
    if (kit?.campaignType) campaignType = kit.campaignType;
  }

  // Cascade context — upstream campaignKits selections for this ICP
  const cascadeContext = await getCascadeContext(input.userId, icp?.id, "landingPage");

  const sotLines = sot ? [
    sot.coreOffer ? `Core offer: ${sot.coreOffer}` : '',
    sot.targetAudience ? `Target audience: ${sot.targetAudience}` : '',
    sot.mainPainPoint ? `Main pain point: ${sot.mainPainPoint}` : '',
    sot.mainBenefits ? `Main benefits: ${sot.mainBenefits}` : '',
    sot.uniqueValue ? `Unique value: ${sot.uniqueValue}` : '',
    sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : '',
  ].filter(Boolean) : [];
  const sotContext = sotLines.length > 0
    ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
    : '';

  const icpContext = icp ? `
IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:
${icp.pains ? `Their daily pains: ${icp.pains}` : ''}
${icp.fears ? `Their deep fears: ${icp.fears}` : ''}
${icp.objections ? `Their objections to buying: ${icp.objections}` : ''}
${icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : ''}
${icp.implementationBarriers ? `What stops them from taking action: ${icp.implementationBarriers}` : ''}
${icp.successMetrics ? `How they measure success: ${icp.successMetrics}` : ''}
`.trim() : '';

  const campaignTypeContextMap: Record<string, string> = {
    webinar: `CAMPAIGN TYPE: Webinar
Framing: Show-up urgency — the live event is the vehicle. Copy must give a compelling reason to attend live, not just register.
Urgency mechanism: Date and time of the webinar. Limited seats available.
CTA language: Register now / Save your seat / Join us live on [date]`,
    challenge: `CAMPAIGN TYPE: Challenge
Framing: Community commitment — joining a group doing this together. Daily wins build momentum.
Urgency mechanism: Challenge start date. Community closes when the challenge begins.
CTA language: Join the challenge / Claim your spot / Start with us on [date]`,
    course_launch: `CAMPAIGN TYPE: Course Launch
Framing: Transformation journey — who they are now vs who they will become. Enrolment is the decision point.
Urgency mechanism: Enrolment deadline. Cohort size is limited.
CTA language: Enrol now / Join the programme / Claim your place before [date]`,
    product_launch: `CAMPAIGN TYPE: Product Launch
Framing: Early access and founding member status. First to experience something new.
Urgency mechanism: Launch day price increase. Founding member pricing closes on launch day.
CTA language: Get early access / Become a founding member / Lock in launch pricing`,
  };
  const campaignTypeContext = campaignTypeContextMap[campaignType] || campaignTypeContextMap['course_launch'];

  // Social proof
  const socialProof = {
    hasCustomers: !!service.totalCustomers && service.totalCustomers > 0,
    hasRating: !!service.averageRating && parseFloat(service.averageRating) > 0,
    hasReviews: !!service.totalReviews && service.totalReviews > 0,
    hasTestimonials: !!service.testimonial1Name || !!service.testimonial2Name || !!service.testimonial3Name,
    hasPress: !!service.pressFeatures && service.pressFeatures.trim().length > 0,
    customerCount: service.totalCustomers || 0,
    rating: service.averageRating || '',
    reviewCount: service.totalReviews || 0,
    testimonials: [
      service.testimonial1Name ? { name: service.testimonial1Name, title: service.testimonial1Title || '', quote: service.testimonial1Quote || '' } : null,
      service.testimonial2Name ? { name: service.testimonial2Name, title: service.testimonial2Title || '', quote: service.testimonial2Quote || '' } : null,
      service.testimonial3Name ? { name: service.testimonial3Name, title: service.testimonial3Title || '', quote: service.testimonial3Quote || '' } : null,
    ].filter(Boolean),
    press: service.pressFeatures || '',
  };

  // Avatar parsing — Issue 5
  let avatarName = input.avatarName || `${service.targetCustomer}`;
  let avatarDescription = input.avatarDescription || service.description || "Target Customer";
  if (avatarName.includes(',')) {
    const parts = avatarName.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      avatarName = `${parts[0]} the ${parts[2]}`;
      avatarDescription = parts.length >= 4 ? parts[3] : parts[2];
    } else if (parts.length === 2) {
      avatarName = `${parts[0]} the ${parts[1]}`;
      avatarDescription = parts[1];
    }
  }

  const enrichedAvatarDescription = [
    sotContext || null,
    avatarDescription || null,
    campaignTypeContext || null,
    icpContext || null,
  ].filter(Boolean).join('\n\n');

  const allAnglesRaw = await generateAllAngles(
    service.name,
    service.description || "",
    avatarName,
    enrichedAvatarDescription,
    socialProof,
    input.onProgress,
    cascadeContext,
    input.pageType,
  );

  const allAngles = {
    original: allAnglesRaw.original as Record<string, unknown>,
    godfather: allAnglesRaw.godfather as Record<string, unknown>,
    free: allAnglesRaw.free as Record<string, unknown>,
    dollar: allAnglesRaw.dollar as Record<string, unknown>,
  };

  const insertResult: any = await db.insert(landingPages).values({
    userId: input.userId,
    serviceId: input.serviceId,
    campaignId: input.campaignId || null,
    productName: service.name,
    productDescription: service.description || "",
    avatarName,
    avatarDescription,
    originalAngle: allAngles.original,
    godfatherAngle: allAngles.godfather,
    freeAngle: allAngles.free,
    dollarAngle: allAngles.dollar,
    activeAngle: "original",
    pageType: input.pageType,
    rating: 0,
  });
  const landingPageId = insertResult[0].insertId;

  // Quota tracking — both wizard and orchestrator paths increment consistently
  await db.update(users).set({ landingPageGeneratedCount: user.landingPageGeneratedCount + 1 }).where(eq(users.id, input.userId));
  await incrementQuotaCount(input.userId, "landingPages");

  // Auto-score + autoSelectBest — non-blocking
  try {
    const originalContent = JSON.stringify(allAngles.original);
    const s = await scoreItem({ content: originalContent, nodeType: "landingPages", formulaType: "original" });
    await db.update(landingPages).set({ selectionScore: String(s) } as any).where(eq(landingPages.id, landingPageId));
    if (icp?.id) await autoSelectBest(input.userId, icp.id, "selectedLandingPageId", landingPageId);
  } catch (e) { console.warn("[auto-select] landingPages failed:", e); }

  return { landingPageId };
}
