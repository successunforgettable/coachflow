import { lpFramingForCampaign, LP_FRAMING_FREE_NEXT_STEP, FREE_NEXT_STEP_REPLAY_TEXT } from "./_core/campaignFraming";
import { resolveAutoFillTokens, substituteCopyToken } from "./lib/templates/operatorFields";
import { invokeLLM } from "./_core/llm";
import type { LandingPageContent } from "../drizzle/schema";
import { BANNED_COPYWRITING_WORDS, GUARANTEE_CLAIMS_RULE, META_COMPLIANCE_NOTES, NO_DATE_FABRICATION_RULE, NO_RESEARCH_STATISTIC_FABRICATION_RULE, REGISTER_STANDARD, registerPersonGuidance, physicalSubjectGuidance, truncateQuote } from "./_core/copywritingRules";
import { MECHANISM_CASCADE_MARKER } from "./_core/cascadeContext";
import { buildCoachCorpus, buildProofSupplied } from "./_core/groundingCorpus";
import { checkOutput } from "./_core/complianceAxis";
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
- Specific deliverables and the timeframe they are handed over in
- Proprietary system name
- Step-by-step process
- A guarantee that names its remedy and the window that remedy runs for

CTA: "Claim Your FREE Consultation!"
  `,
  godfather: `
Generate a landing page with an IRRESISTIBLE OFFER using risk reversal.

Focus on:
- Money-back guarantee, stated together with the window it runs for
- "Or you don't pay" - a refund promise, written so it reads as one
- Making it impossible to say no
- Risk reversal throughout copy, always about the transaction rather than about how the reader turns out

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

ALSO POPULATE (sales-page-specific, additive):
- curriculum — the course module list (8-10 items), each a concise module title
  plus one leading emoji. Real course STRUCTURE only — module names describing what
  is taught. Write actual module titles; never fabricate student counts, revenue, or
  results figures. Example shape: {title: "Find Your Perfect Niche", emoji: "🎯"}.
- systemTiles — up to EIGHT short, single-line "how it helps" phrases naming the
  systems/skills the buyer builds (e.g. "A repeatable content system", "An outsourcing
  playbook"). Qualitative and NON-numeric — no counts, no revenue, no percentages.

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
- bonuses — 2-3 free bonuses attendees receive for showing up LIVE. Each is a
  concise title plus one specific single-line description of what it is and how it
  helps. Title + description ONLY. Do NOT include any monetary value or price —
  bonus values are operator-supplied later; never invent a ₹/$ figure.

METHOD BAND — whyOldFail + uniqueMechanism. The registration page carries a
"why this works" band that the renderer builds from exactly these two fields.

When a "Selected hero mechanism" is supplied in the context above:
- uniqueMechanism — write it FROM that mechanism. Use its supplied name as the
  name of the method, and draw the explanation from its supplied description,
  rendered in this page's voice. 2-4 sentences.
- whyOldFail — one short paragraph naming what the reader has already tried that
  stalls, written so the supplied mechanism reads as the structural answer to it.

When no "Selected hero mechanism" is supplied in the context above, return both
as empty strings:
- uniqueMechanism: ""
- whyOldFail: ""

SECTIONS TO LEAVE EMPTY (return as empty string ""):
- problemAgitation: ""
- solutionIntro: ""
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

LOCATION LOCK (critical — no fabrication): You are NOT told the event's city,
venue, or address. NEVER write a specific location — no city name, no venue
name, no street address — in ANY field (eyebrow, headline, subheadline, CTA,
scarcityUrgency, insiderAdvantages, faq, agenda). Everywhere a location would
naturally appear, write the LITERAL token [INSERT_EVENT_VENUE]; the operator's
answer substitutes it in every field at once. Pick ONE consistent token, never
a plausible-sounding placeholder city. The same rule for the date/time: use
[INSERT_EVENT_DATE] / [INSERT_EVENT_TIME] / [INSERT_EVENT_TIMEZONE], never an
invented date. Inventing a location or date is a hard failure.

SECTIONS TO POPULATE (fill substantively):
- eyebrowHeadline, mainHeadline, subheadline, primaryCta — registration
  hero. CTA: "Reserve Your Seat", "Register Now", "Save My Spot". If a CTA or
  any headline/body names WHERE it is, write [INSERT_EVENT_VENUE] — never a
  city or venue name.
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
  /** Residual legacy-validator hits, so the persistence gate folds them into ONE verdict. */
  __sink?: { hits: Array<{ classId: string; matched: string; location: string }> },
  /**
   * THE COACH'S OWN COMMERCIAL TERMS (2026-09-05). `services.guaranteeType` / `guaranteeDuration`
   * existed and were NEVER passed here, so the guarantee instruction's "if the operator provided
   * one, use it exactly" branch could never fire and the "if not" branch — which told the model to
   * invent a refund window — ran on every sales page ever generated.
   */
  operatorFacts?: { guaranteeType?: string | null; guaranteeDuration?: string | null; cohortLimit?: string | null; cohortCloseDate?: string | null } | null,
  /**
   * The coach corpus + supplied proof. Without it `checkOutput`'s fabrication half silently
   * no-ops (complianceAxis.ts:1262), which is why `invented_guarantee` never fired on this path.
   */
  grounding?: { corpus: any; supplied: any } | null,
): Promise<LandingPageContent> {
  // Social proof guidance (Issue 2 fix)
  const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers || socialProof.hasPress
    ? `REAL SOCIAL PROOF AVAILABLE:
${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}
${socialProof.hasRating ? `- ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews` : ''}
${socialProof.hasTestimonials ? `- Real testimonials:\n${socialProof.testimonials.map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')}` : ''}
${socialProof.hasPress ? `- Press features: ${socialProof.press}` : ''}

You MUST use these exact numbers and real testimonials. Do not fabricate or inflate.`
    : `LAUNCH-STAGE PAGE — this coach's proof is not yet on the record, so the page is carried by the substance of the method and the coach's own account of the work:
- "testimonials" is an EMPTY ARRAY []. The renderer omits the section cleanly, and the page reads as a confident new offer.
- "asSeenIn" is an EMPTY ARRAY []. The renderer omits it the same way.
- The proof sections' job passes to the method: what it does, the order it does it in, and what the coach has seen it change.
Every figure, publication, client name and quoted result on this page appears in the supplied material above.`;

  // Real-proof signal. The As-Seen-In, testimonial and statistic sections all ask
  // the model to produce PROOF, so they are only requested when the coach's proof
  // is actually on the record. Previously they were unconditional numbered
  // requirements that overrode the no-proof branch immediately above them — the
  // page spec ordered five publication names, four named testimonials with
  // locations, and a population statistic, from a coach who had supplied none.
  const hasRealProof = !!(socialProof.hasTestimonials || socialProof.hasCustomers || socialProof.hasPress);

  const asSeenInSection = hasRealProof && socialProof.hasPress
    ? `5. **As Seen In** (array of the real press features supplied above, exactly as named)
   Use only the publications named in the supplied proof data. NOTE: DO NOT include "Meta", "Facebook", or "Instagram" as these imply platform endorsement which violates Meta advertising policy`
    : `5. **As Seen In** — set to an EMPTY ARRAY []. The renderer omits this section cleanly.`;

  const testimonialsSection = hasRealProof && socialProof.hasTestimonials
    ? `11. **Social Proof / Testimonials** (built from the real testimonials supplied above)
    Use the supplied quotes, names and roles exactly as they appear in the proof data. Each item: headline (a short phrase drawn from that quote), quote (the supplied words), name (as supplied), location (only if supplied).`
    : `11. **Social Proof / Testimonials** — set to an EMPTY ARRAY []. The renderer omits this section cleanly, and the mechanism and offer sections carry the page.`;

  const shockingStatSection = hasRealProof
    ? `14. **Shocking Statistic** (150-200 words)
    Build this section around a real figure from the supplied proof data — the coach's own customer count, rating, review count, or a result that appears in the supplied material. State what that figure reflects about how this work goes. Use no figure that does not appear above.`
    : `14. **Shocking Statistic** (150-200 words)
    No population statistics or research figures are available for this offer, so this section is written WITHOUT numbers: name the pattern the coach keeps seeing in this work and why the standard approach leaves it in place. Qualitative and specific throughout — a precisely described pattern in place of a figure.`;

  // The coach's real terms, or an explicit statement that there are none. Stating the absence is
  // load-bearing: silence let the model treat the field as free prose.
  const g = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
  const guaranteeSupplied = [g(operatorFacts?.guaranteeType), g(operatorFacts?.guaranteeDuration)].filter(Boolean).join(", ");
  const cohortLimitSupplied = g(operatorFacts?.cohortLimit);
  const cohortCloseSupplied = g(operatorFacts?.cohortCloseDate);
  const operatorFactsBlock = `OPERATOR-SUPPLIED COMMERCIAL TERMS — the only source of truth for these:
- Guarantee terms: ${guaranteeSupplied || "NOT SUPPLIED"}
- Cohort size limit: ${cohortLimitSupplied || "NOT SUPPLIED"}
- Cohort close date: ${cohortCloseSupplied || "NOT SUPPLIED"}
Where a line reads NOT SUPPLIED, the coach has given nothing and there is nothing to state.`;

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

${operatorFactsBlock}

${registerPersonGuidance(hasRealProof && socialProof.hasTestimonials)}

${physicalSubjectGuidance([productName, productDescription, avatarName, avatarDescription].join(" "))}

EMOTIONAL ARC — every section of this landing page must serve a specific emotional purpose in sequence. A visitor who reads from top to bottom moves through these in order. Each emotion is produced by describing something precisely from the coach's side of the table — the accuracy of the described moment is what does the work:
Section 1 (Hero — eyebrow + main headline + subheadline): RECOGNITION. Describe the specific situation this work turns on, in the vocabulary the field actually uses, precisely enough that the right reader recognises it immediately.
Section 2 (Problem — quizSection + problemAgitation): PUT INTO WORDS. Name the problem more precisely than it usually gets named — the specific moment it shows up, described from the coach's experience of it. Precision is the point; a category of pain is not.
Section 3 (Agitate — whyOldFail): WHAT IT COSTS. Name concretely what the problem takes out of a week or a quarter when it goes unaddressed — described as what the coach has seen this cost, in time, money and repeated effort.
Section 4 (Solution — solutionIntroduction): HOPE. "There might be a way out." Introduce the possibility of a different outcome before introducing the mechanism. Make hope feel credible, not hype.
Section 5 (Mechanism — uniqueMechanismIntro): DIFFERENT FROM THE USUAL APPROACH. Name 1-2 of the standard approaches in this field and explain why this one is structurally different — not just "better."
Section 6 (Proof — socialProofTestimonials + insiderAdvantages): SAFE TO BELIEVE. Where real proof is supplied above, quote it exactly as supplied — the real situations and real results. Where none is supplied, this section carries the substance of the method instead.
Section 7 (Offer — scarcityUrgency + timeSavingBenefit + consultationOutline): OBVIOUS NEXT STEP. The offer stacks enough value that the next step is easy to justify. Apply anchoring — state total value before the ask.

Generate a complete landing page with 16 sections following this structure:

1. **Eyebrow Headline** (all caps, attention-grabbing, addresses target avatar's pain, max 100 chars)
   Example: "FOR FREELANCE DESIGNERS QUOTING THEIR OWN PROJECTS"

2. **Main Headline** (long-form, benefit-driven, 100-150 chars)
   A great landing page headline does three things simultaneously: (1) identifies the exact person it is written for so precisely that anyone else feels excluded, (2) names the specific outcome they want using their own words not marketing language, (3) signals that this is different from everything they have already tried. Do not use fill-in-the-blank template patterns — write a headline that could only exist for this specific product and this specific avatar. The headline must not use any of these words: ${BANNED_COPYWRITING_WORDS.join(', ')}.

3. **Subheadline** (explains why current methods fail or what makes this different, 150-200 chars)
   Example: "...without rewriting the proposal four times, discounting to close, or adding another tool to the stack."

4. **Primary CTA Button** (clear action, 3-6 words)
   Example: "Claim Your FREE Consultation!"

${asSeenInSection}

6. **Quiz/Question Section** (niche-specific question with 5 plausible options and a surprising reveal answer, 200-300 words total)
   A great quiz question does two things: it makes the reader feel smart for knowing the answer (or curious because they don't), and it reframes their understanding of the problem. Rules: the question must use insider language from the target market; every option must sound genuinely plausible — a good option is one the reader would seriously consider before seeing the answer; the answer must surprise the reader and teach them something they could not have known without reading this page; the question must name a specific scenario from the niche, not a generic category. BANNED quiz patterns (too generic, do not use): "Which of these is the most important X", "What is the first step to X", "How many X do you need to Y".

7. **Problem Agitation** (emotional pain points, 200-300 words)
   Example: "The Quote That Sat In My Outbox For Nine Days"

8. **Solution Introduction** (introduces the unique mechanism, 200-300 words)
   Example: "Scripts, discounts and faster follow-up all treat the symptom. The scope is what moves."

9. **Why Old Methods Fail** (contrarian angle, 200-300 words)
   Example: "Why The Standard Advice On Pricing Leaves The Real Problem Untouched"

10. **Unique Mechanism Introduction** (names the proprietary system, 200-300 words)
    Example: "Introducing the 'Scope-First Method': the four minutes that decide the rest of the call"

${testimonialsSection}

12. **Insider Advantages** (what makes it different, 200-300 words)
    Example: "Built From Six Years Of Running These Calls Wrong, Then Right"

13. **Scarcity / Urgency** (200-300 words)
    ANCHOR ON [INSERT_COHORT_LIMIT] and [INSERT_COHORT_CLOSE_DATE] — the same canonical operator-fill tokens the email sales builder uses. A seat count, a cohort cap, a closing window and a price increase are all operator-supplied facts.
    Do NOT invent a number of spots or seats (in digits or spelled out as words), a cohort size, a closing date, an enrolment window, a founding-member rate, a price increase, or a claim that a rate will not be offered again.
    WHEN the OPERATOR-SUPPLIED COMMERCIAL TERMS block above gives a cohort size limit or close date: use them exactly, and emit the matching token where the other is NOT SUPPLIED.
    WHEN both read NOT SUPPLIED: emit [INSERT_COHORT_LIMIT] and [INSERT_COHORT_CLOSE_DATE] verbatim where the count and the date would go, and carry the section on the REAL reason acting now matters to this reader — the ongoing cost of the problem continuing for another month, named concretely for this niche. That cost is a description of the reader's own situation, not a claim about the offer's availability.

${shockingStatSection}

15. **Time-Saving Benefit** (shortcut positioning, 150-200 words)
    Example: "The Ordering Took Me Six Years To Work Out. The Programme Hands It Over In Week One."

16. **Consultation Outline** (10 numbered items, each with a specific title and a deliverable-focused description)
    The consultation outline must feel like a genuine agenda, not a marketing list. Each item must name the specific deliverable the client will have at the end of that segment — what they have after that step that they did not have before it. BANNED consultation outline patterns (do not use as titles or descriptions): "Introduction and welcome", "Q&A", "Next steps", "Strategy overview", "Getting to know you" — these are placeholders, not deliverables. Every item must name a specific analysis, assessment, calculation, or output. Example: "Revenue Gap Analysis — At the end of this segment you will have a precise number: the exact monthly gap between your current income and your target, and the three specific levers available to close it."

17. **FAQ** (5-7 frequently asked questions with answers)
    Generate 5-7 FAQ items that address: common objections to buying, logistics questions (how it works, what is included, how long it takes), and one question about who this is NOT for. Do NOT cross-reference other sections of the page by name — never write "see the guarantee section below" or "the guarantee section covers this", because a section whose facts the coach has not supplied does not render and the reference would point at nothing. An answer that touches the guarantee follows the same rule as section 18: the coach's supplied terms, or [INSERT_GUARANTEE_TERMS] verbatim, never invented refund mechanics. Each item has a "question" and "answer". Answers are 2-3 sentences and conversational. An answer that reaches for the guarantee names ONLY the coach's supplied remedy and period; where none is supplied it emits [INSERT_GUARANTEE_TERMS] verbatim rather than naming a window. An answer that addresses doubt settles it with what the programme DOES and what the reader is handed — the concrete thing that meets the objection — rather than with an assurance about how the reader ends up.

18. **Guarantee** (dedicated guarantee statement, 100-200 words)
    ANCHOR ON [INSERT_GUARANTEE_TERMS] (ported verbatim in approach from the email sales builder's Sprint B guarantee-fabrication fix, and using the same canonical token so the two paths stay consistent): the operator-supplied guarantee terms specify refund duration, refund conditions, refund process. Do NOT invent guarantee specifics (refund duration, refund process, conditions for refund eligibility, money-back framing details, a support or contact address to claim through).
    WHEN the OPERATOR-SUPPLIED COMMERCIAL TERMS block above gives guarantee terms: use them exactly, and write the section around them. Format as: first line is the guarantee headline, remaining lines are the body stating what the reader has to have done to use it and by when. Frame positively — what the customer gets or gets back.
    WHEN that block reads NOT SUPPLIED: emit [INSERT_GUARANTEE_TERMS] verbatim wherever the section would otherwise enumerate refund mechanics, and reframe the section's job as "reduce risk through framing the safety of the decision" — describe what about the offer's structure makes it low-risk (e.g. the time-bound nature of the work, the coach's named track record, the fit-check process) without inventing refund mechanics.

SPECIFICITY CHECK — apply this before returning the JSON:
For every section, ask: does this section contain at least one phrase that could only appear on a landing page for THIS specific service in THIS specific niche? If any section contains only generic direct response language that could apply to any coaching programme, rewrite that section before returning. The test: mentally swap the product name for a different coaching product in a different niche. If the section still makes sense without any changes, it is not specific enough. Rewrite until it only makes sense for this product, this avatar, and this outcome.

Return as JSON matching the LandingPageContent type.
The avatar profile above is INTERNAL — it selects which situation, vocabulary and outcome the page leads with. Its invented specifics (the avatar's name, age, location, income) are working notes, not page content: they never appear in the copy, and the page never states them as facts about the reader.
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
      { role: "system", content: `You are a world-class direct response copywriter specializing in high-converting landing pages. You engineer an emotional arc through each page — every section serves a specific emotional purpose, moving through 'recognition', 'put into words', 'what it costs', 'hope', 'different from the usual approach', 'safe to believe', and finally 'obvious next step'. Each of those is produced by describing something from the coach's own side of the table, precisely — never by telling the reader what is true of them. You write in the customer's own vocabulary — the words they use with a close friend, not marketing language. FORMATTING RULE: Return plain text only inside all JSON string values. No markdown. No asterisks (*). No hash symbols (#). No bold or italic formatting of any kind. No bullet markers. Just clean readable sentences and paragraphs.\n\n${META_COMPLIANCE_NOTES}\n\n${NO_DATE_FABRICATION_RULE}\n\n${NO_RESEARCH_STATISTIC_FABRICATION_RULE}\n\n${GUARANTEE_CLAIMS_RULE}\n\n${REGISTER_STANDARD}` },
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
            // Additive (templates 2–9). Free bonuses attendees/registrants get. Copy only —
            // title + one-line description. Monetary VALUES are NEVER generated here (operator-
            // supplied later via the conversational intake; fabricating a ₹/$ figure is forbidden).
            // Page types that don't use bonuses return [] (like testimonials on event pages).
            bonuses: {
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
            // Additive (sales_page). Course module list for the curriculum accordion. Real course
            // STRUCTURE (titles), never fabricated numbers. Non-sales page types return [].
            curriculum: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  emoji: { type: "string" }
                },
                required: ["title", "emoji"],
                additionalProperties: false
              }
            },
            // Additive (sales_page). Up to 8 short, qualitative "how it helps" lines for the
            // "build systems for" tile grid. NON-numeric. Separate from featureHighlights (which
            // the Burchard template reads) so this never changes shipped Burchard output.
            // Non-sales page types return [].
            systemTiles: {
              type: "array",
              items: { type: "string" }
            },
          },
          required: [
            "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
            "asSeenIn", "quizSection", "problemAgitation", "solutionIntro",
            "whyOldFail", "uniqueMechanism", "testimonials", "insiderAdvantages",
            "scarcityUrgency", "shockingStat", "timeSavingBenefit", "consultationOutline",
            "faq", "guarantee", "bonuses", "curriculum", "systemTiles"
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
    if (__sink) __sink.hits.push(...(fabResult.ok ? [] : (fabResult.hits ?? []).map((h: any) => ({
      classId: String(h.classId), matched: String(h.matched ?? ""), location: String(h.location ?? "lpTestimonials"),
    }))));
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

  // ── OUTPUT GATE (compliance axis) ────────────────────────────────────────────
  // Reuses the existing retry loop rather than adding a second one. SHORT fields are
  // checked as short: the eyebrow, headline and subheadline are exactly where the
  // register standard has no room to work, and where a live run produced
  // "FOR WOMEN WHO JUST HAD A BABY AND FEEL LIKE THEIR BODY NO LONGER BELONGS TO THEM".
  // Fabrication is not run here — the LP has its own testimonials fabrication check
  // immediately above, and the publish gate re-checks the resolved page.
  {
    const p = parsed as Record<string, unknown>;
    const gateFields = ([
      ["eyebrowHeadline", "short"], ["mainHeadline", "short"], ["subheadline", "short"],
      ["problemAgitation", "body"], ["solutionIntro", "body"], ["whyOldFail", "body"],
      ["uniqueMechanism", "body"], ["insiderAdvantages", "body"], ["shockingStat", "body"],
      ["timeSavingBenefit", "body"], ["primaryCta", "cta"],
      // ADDED 2026-09-05. Both were absent, so even with grounding wired the fabrication half
      // would never have seen the two fields that were actually being invented.
      ["guarantee", "body"], ["scarcityUrgency", "body"],
    ] as const).map(([k, role]) => ({ location: `landingPage.${k}`, text: p[k] as string | undefined, role }));
    // GROUNDING WAS ABSENT HERE (fixed 2026-09-05). `checkOutput` runs its fabrication half only
    // when a corpus is supplied (complianceAxis.ts:1262); this call passed none, so
    // `invented_guarantee` — the class that exists for exactly this — could never fire on a
    // landing page. Passed now. `requireGrounding` is deliberately NOT set: callers that supply
    // no grounding keep today's behaviour rather than newly failing closed.
    const gate = checkOutput(gateFields, grounding ?? undefined);
    if (!gate.ok) {
      if (leakAttempt < LP_SCHEMA_RETRY_MAX_ATTEMPTS) {
        validatorFailContext = gate.failContext;
        console.warn(
          `[landingPageGenerator] Compliance gate failed on attempt ${leakAttempt}/${LP_SCHEMA_RETRY_MAX_ATTEMPTS} ` +
          `(angle=${angle}, classes=[${Array.from(new Set(gate.blocking.map((h) => String(h.classId)))).join(",")}]). Retrying with fail-context.`,
        );
        continue;
      }
      // Exhaust path mirrors the testimonials check directly above: return best-effort so
      // the coach still gets a page, and let the publish gate be the hard stop.
      console.warn(
        `[landingPageGenerator] Compliance gate exhausted retries on angle=${angle} ` +
        `(${gate.blocking.length} hits, classes=[${Array.from(new Set(gate.blocking.map((h) => String(h.classId)))).join(",")}]); returning best-effort — publish gate will hold it.`,
      );
    }
  }

  // ── ENFORCE THE METHOD-BAND BINDING (2026-09-05) ────────────────────────────
  // The prompt asks for `uniqueMechanism` + `whyOldFail` only when the cascade supplied a
  // selected hero mechanism. A prompt instruction is STEERING, not enforcement (§15i), so the
  // no-mechanism case is decided here, where it is decidable. Production evidence for why:
  // 37 sales pages were generated for services with no campaign kit — no mechanism in context
  // at all — and every one of them returned a confident, invented mechanism.
  if (pageType === "webinar_registration" && !cascadeContext.includes(MECHANISM_CASCADE_MARKER)) {
    const pm = parsed as Record<string, unknown>;
    if ((typeof pm.uniqueMechanism === "string" && pm.uniqueMechanism.trim() !== "")
      || (typeof pm.whyOldFail === "string" && pm.whyOldFail.trim() !== "")) {
      console.warn(
        `[landingPageGenerator] webinar angle=${angle}: no selected hero mechanism in the cascade; ` +
        `clearing uniqueMechanism/whyOldFail rather than publishing an invented method band.`,
      );
    }
    pm.uniqueMechanism = "";
    pm.whyOldFail = "";
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
  /** Residual legacy-validator hits, so the persistence gate folds them into ONE verdict. */
  __sink?: { hits: Array<{ classId: string; matched: string; location: string }> },
  /** The coach's own commercial terms — see generateLandingPageAngle. */
  operatorFacts?: { guaranteeType?: string | null; guaranteeDuration?: string | null; cohortLimit?: string | null; cohortCloseDate?: string | null } | null,
  /** Coach corpus + supplied proof, so the fabrication half of the output gate actually runs. */
  grounding?: { corpus: any; supplied: any } | null,
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
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'original', socialProof, cascadeContext, pageType, __sink, operatorFacts, grounding).then(async r => { await notify(); return r; }),
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'godfather', socialProof, cascadeContext, pageType, __sink, operatorFacts, grounding).then(async r => { await notify(); return r; }),
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'free', socialProof, cascadeContext, pageType, __sink, operatorFacts, grounding).then(async r => { await notify(); return r; }),
    generateLandingPageAngle(productName, productDescription, avatarName, avatarDescription, 'dollar', socialProof, cascadeContext, pageType, __sink, operatorFacts, grounding).then(async r => { await notify(); return r; }),
  ]);
  return { original, godfather, free, dollar };
}

// ─── The free-next-step seams — both UNIT-PROVEN, NEVER EXERCISED IN A RUN ───
/**
 * Is this generation producing the kit's PRIMARY landing page, or an ADDITIONAL artefact?
 *
 * A lead-magnet campaign is to produce a second landing page — the free event the magnet bridges
 * to — on the same service. `landingPages` is already one-to-many per service; the
 * single-destination assumption lives entirely in `campaignKits.selectedLandingPageId`.
 */
export type LandingPageRole = "primary" | "additional";

export type CrownOutcome = "crowned" | "skipped-additional" | "skipped-no-icp";

/**
 * The crown decision, extracted so it is REACHABLE BY A TEST. `runLandingPageGeneration` does
 * eight database round-trips and four LLM calls, so the conditional cannot otherwise be exercised
 * without an integration harness; the dependency is injected for the same reason.
 *
 * 🔴 THE INTENT LIVES HERE, NOT ON `autoSelectBest`. Only the caller knows which kind of page it
 * is producing. `autoSelectBest` is called by every generator in the cascade and cannot be taught
 * the difference without all of them growing the same flag.
 *
 * ⚠️ SUPPRESSING THE CROWN SUPPRESSES FOUR THINGS, NOT ONE. `autoSelectBest` performs, in order:
 *   1. `ensureCampaignKit` — CREATES the kit when absent;
 *   2. the `selectedLandingPageId` pointer write — the clobber this exists to prevent, on a
 *      pointer with 33 readers across 14 files including Push to GHL and the Meta publish script;
 *   3. `markDownstreamStale` (the extraction committed in 85bcc8b);
 *   4. the kit COMPLETENESS check, which flips `status` draft → complete.
 *
 * (3) is CORRECT to suppress and is pinned by an executable-documentation test: an additional
 * artefact reselects nothing, so no downstream asset is built against a superseded choice. Stale
 * marking answers "the selection moved"; on this path it did not move. Do not read its silence
 * here as a regression of 85bcc8b.
 *
 * 🔴 (4) IS A CONSTRAINT ON THE TRIGGER, AND IT IS THE ONE THAT CAN BITE. A kit whose ONLY landing
 * page is the free-event page would never flip to `complete`, because nothing else would ever
 * crown one. In the designed flow the magnet's own opt-in page crowns first, so the kit already
 * carries the pointer and completeness has already been evaluated by a crowning step. Whoever
 * scopes the cascade trigger owns this: the free-event page must never be a kit's first or only
 * landing page. The same constraint is recorded in the handover, in the same words.
 *
 * (1) is likewise safe only because the kit exists by then — the magnet campaign's own kit.
 */
export async function crownIfPrimary(
  deps: { autoSelectBest: (userId: number, icpId: number, field: string, itemId: number) => Promise<void> },
  pageRole: LandingPageRole,
  userId: number,
  icpId: number | undefined,
  landingPageId: number,
): Promise<CrownOutcome> {
  // Role first, deliberately: a deliberate decision is worth recording over an incidental absence.
  if (pageRole === "additional") {
    // The ONLY new log line in this change. The crown path stays byte-identical including stdout;
    // this branch has no caller today, so logging it changes nothing that exists — and it means
    // the first time the trigger fires there is EVIDENCE the suppression worked rather than
    // silence. This sprint has already met one defect that was invisible precisely because a path
    // did something and recorded nothing.
    console.log(
      `[landingPage] crown SKIPPED (pageRole=additional) landingPageId=${landingPageId} ` +
      `userId=${userId} icpId=${icpId ?? "none"} — kit pointer, stale marking and completeness all left untouched`,
    );
    return "skipped-additional";
  }
  // `!icpId` rather than `icpId == null`, reproducing the previous `if (icp?.id)` exactly,
  // including its treatment of 0.
  if (!icpId) return "skipped-no-icp";
  await deps.autoSelectBest(userId, icpId, "selectedLandingPageId", landingPageId);
  return "crowned";
}

/**
 * The campaign framing for this page: the caller's override when it supplies one, otherwise
 * derived from the kit's campaign type exactly as before.
 *
 * ⚠️ `trim()`, NEVER `??`. Under nullish coalescing an empty-string override is a PRESENT value,
 * so the framing block would be deleted from the prompt entirely rather than falling back — the
 * page would generate against no campaign framing at all and nothing would say so. A blank
 * override is an absent one. A non-blank one passes through exactly as supplied.
 *
 * 📌 The override does NOT touch offer suppression. `describeOffer`'s free-vs-paid behaviour comes
 * from `getCascadeContext`, which derives campaign type from the kit itself — so a free-event page
 * still gets the kit's `lead_magnet` → free treatment and no price reaches it.
 */
export function resolveLpFraming(campaignType: string, override?: string): string {
  return override?.trim() ? override : lpFramingForCampaign(campaignType);
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
  /**
   * Whether this generation owns the kit's landing-page pointer. Defaults to `"primary"`, which
   * is today's behaviour exactly, so every existing caller is unchanged. See `crownIfPrimary`
   * for what `"additional"` suppresses — it is four things, not one. NO CALLER PASSES THIS YET.
   */
  pageRole?: LandingPageRole;
  /**
   * Campaign framing to use instead of the one derived from the kit's campaign type. Pass a
   * framing exported from `_core/campaignFraming` — never a hand-written string; a source guard
   * in `pipeline-fixes.test.ts` pins that this file inlines none. NO CALLER PASSES THIS YET.
   */
  campaignFraming?: string;
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

  // Campaign framing is single-sourced from `_core/campaignFraming.ts`. The map that stood here
  // carried FOUR of the seven campaign types, so `discovery_call`, `lead_magnet` and
  // `in_person_event` fell through to `course_launch` — and a FREE discovery-call page was
  // generated against "Enrolment is the decision point … CTA language: Enrol now", directly
  // contradicting the `discovery_call_booking` block in PAGETYPE_PROMPTS above. The shared map is
  // typed `Record<CampaignType, string>`, so an incomplete map is now a compile error.
  // …and the caller may override it outright, for a page whose reader is not a stranger arriving
  // from an ad. Every entry in the map addresses a cold reader; measured over ten rows, reusing
  // one for a magnet's free next step produces a page that restates the magnet.
  const campaignTypeContext = resolveLpFraming(campaignType, input.campaignFraming);

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

  const __lpSink = { hits: [] as Array<{ classId: string; matched: string; location: string }> };
  // THE DEAD BRANCH, FED (2026-09-05). `services.guaranteeType` / `guaranteeDuration` have existed
  // since the table was written and were never handed to the generator, so the guarantee
  // instruction's "use the operator's terms" arm was unreachable and the "otherwise invent one" arm
  // ran every time. `riskReversal` is deliberately NOT read here: the column is documented
  // "Guarantee suggestion" and is LLM-generated, so treating it as coach-supplied would launder a
  // generated line into a commercial promise.
  const operatorFacts = {
    guaranteeType: (service as any).guaranteeType ?? null,
    guaranteeDuration: (service as any).guaranteeDuration ?? null,
    // No column captures either of these yet — passed as null so the prompt states NOT SUPPLIED
    // and emits the token, rather than the model filling the silence.
    cohortLimit: null,
    cohortCloseDate: null,
  };

  // The corpus the fabrication half needs. Built here because this is where the service row and the
  // ICP's groundingMeta are both already loaded — no extra query.
  const lpGrounding = {
    corpus: buildCoachCorpus({ service, groundingMeta: (icp as any)?.groundingMeta ?? null }),
    supplied: buildProofSupplied(service),
  };

  const allAnglesRaw = await generateAllAngles(
    service.name,
    service.description || "",
    avatarName,
    enrichedAvatarDescription,
    socialProof,
    input.onProgress,
    cascadeContext,
    input.pageType,
    __lpSink,
    operatorFacts,
    lpGrounding
  );

  // Typed as LandingPageContent, not Record<string, unknown>. The old Record cast threw away
  // the shape the `landingPages.*Angle` columns actually declare, so the insert never
  // type-checked — a pre-existing TS2769 on this persistence path that the 35-error baseline
  // had simply absorbed. Casting to the column's own type fixes it at source rather than
  // silencing it at the call.
  const allAngles = {
    original: allAnglesRaw.original as LandingPageContent,
    godfather: allAnglesRaw.godfather as LandingPageContent,
    free: allAnglesRaw.free as LandingPageContent,
    dollar: allAnglesRaw.dollar as LandingPageContent,
  };

  // ── TOKEN RESOLUTION AT THE SOURCE — before the row is ever written ──────────────────────────
  // The publish gate throws on ANY surviving `[INSERT_*]`, and that is the guard working: it stays
  // strict and is not touched here. But three tokens in the webinar allow-list could never be
  // answered, so a coach could supply date, time AND timezone and the page would still refuse to
  // publish (Test 5, kit 152: "1 unfilled placeholder: [INSERT_REPLAY_AVAILABILITY]").
  //
  // Resolved HERE rather than after the insert, so a page is never STORED holding a token nothing
  // will ever fill. No prohibition is added to any prompt (naming a shape leaves the space empty —
  // the seat-cap lesson) and nothing is neutralised to an empty string (that ships a hole and tells
  // nobody). Each token is resolved from a fact, or left alone for the gate to catch.
  const __autoFilled = resolveAutoFillTokens(allAngles, {
    // ⚠️ THE REGISTRY'S DECLARED HOST SOURCE IS RIGHT IN INTENT AND WRONG IN PRACTICE.
    // `autoFillFrom: "coachName"` points at `users.coach_name` — set for 1 of 23 production
    // coaches (4%), measured 2026-08-28. `users.name` is set for 23 of 23 (100%). So coach_name
    // WINS when present (it is the name the coach deliberately chose to be known by) and
    // users.name is the fallback that makes the fill actually land.
    coachName: (user.coachName ?? "").trim() || (user.name ?? "").trim(),
    serviceName: service.name,
    // leadMagnetName is deliberately NOT supplied: [INSERT_LEAD_MAGNET_NAME] is absent from the
    // webinar allow-list so it cannot reach this page, and fetching it would add a read for a
    // token no measurement has ever seen here. Unsupplied → the token survives → the gate catches
    // it, which is the honest outcome rather than a guessed one.
  });

  // The framing answers the replay slot, so the page can write from a fact instead of deferring to
  // an operator who does not exist in Auto Mode. Scoped to the free-next-step framing ON PURPOSE:
  // on a coach-driven webinar page the coach IS asked ("Will there be a replay?"), and pre-empting
  // that answer would take a real choice away. See FREE_NEXT_STEP_REPLAY_TEXT for why the text
  // restates live-and-once and never claims the session is unrecorded.
  const __isFreeNextStep = input.campaignFraming === LP_FRAMING_FREE_NEXT_STEP;
  const allAnglesResolved = __isFreeNextStep
    ? substituteCopyToken(__autoFilled.content, "[INSERT_REPLAY_AVAILABILITY]", FREE_NEXT_STEP_REPLAY_TEXT)
    : __autoFilled.content;

  const __row = {
    userId: input.userId,
    serviceId: input.serviceId,
    campaignId: input.campaignId || null,
    productName: service.name,
    productDescription: service.description || "",
    avatarName,
    avatarDescription,
    originalAngle: allAnglesResolved.original,
    godfatherAngle: allAnglesResolved.godfather,
    freeAngle: allAnglesResolved.free,
    dollarAngle: allAnglesResolved.dollar,
    // `as const` because extracting the row into a variable loses the contextual typing the
    // inline .values({...}) used to supply — without it the literal widens to `string` and
    // no longer satisfies the column's enum.
    activeAngle: "original" as const,
    pageType: input.pageType,
    rating: 0,
  };
  // Persistence backstop — landing-page copy lives in a JSON column, so the gate is given
  // an explicit extractor. Single-row insert: the floor keeps it and logs rather than
  // emptying the node (degrade, never kill).
  const { gateBeforePersist, copyFieldsOfJson } = await import("./_core/persistenceGate");
  const __g = await gateBeforePersist("landingPages", [__row], { textOf: (r: any) => ["originalAngle","godfatherAngle","freeAngle","dollarAngle"].flatMap((k) => copyFieldsOfJson(r[k], k)), legacyHits: __lpSink.hits });
  const insertResult: any = await db.insert(landingPages).values((__g.kept[0] ?? __row));
  const landingPageId = insertResult[0].insertId;

  // Quota tracking — both wizard and orchestrator paths increment consistently.
  //
  // 🔴 THIS USED TO INCREMENT TWICE, AND EVERY LANDING PAGE COUNTED AS TWO. A manual
  // `landingPageGeneratedCount + 1` stood here, and `incrementQuotaCount("landingPages")` resolves
  // — via `quotaLimits.ts` — to THE SAME `users` column. The manual write used a stale read taken
  // before generation; the helper then re-selected and added one more. Net +2 per page.
  //
  // MEASURED, NOT INFERRED, because the source read alone would not have been enough: a real
  // generation on a local production copy moved the counter from 0 to 2 while creating exactly one
  // page. The trial ceiling is 2, so a trial coach's FIRST landing page consumed their entire
  // allowance.
  //
  // The manual write is the one removed. `incrementQuotaCount` is the canonical helper every other
  // generator uses, it owns the column mapping, and it also emits the product event — reimplementing
  // half of it here is what let the two drift into agreement about the column and disagreement about
  // the count.
  //
  // ⚠️ FIX-FORWARD ONLY. No counter repair and no backfill: every row is pre-launch test data and
  // the clean-slate wipe before launch clears them. Repairing counters would mean guessing how many
  // of each user's historical generations went through this path.
  //
  // 🔴 AN ADDITIONAL PAGE DOES NOT CONSUME THE COACH'S QUOTA. The free-event page is machinery the
  // lead magnet needs, not an asset the coach asked for — they never saw it in a picker and never
  // chose it. Charging it would spend a trial coach's ENTIRE allowance (limit 2) on plumbing that
  // is invisible to them, on their first campaign. Suppressed on the `pageRole` signal, which is
  // the only thing that knows what kind of page this is.
  //
  // This suppresses the single write to `users.landingPageGeneratedCount` and the product event
  // `incrementQuotaCount` emits. NO OTHER COUNTER MOVES: there is no per-node quota table, and
  // `quotaLimits.ts` maps "landingPages" to that one column and nothing else.
  const { consumesLandingPageQuota } = await import("./_core/nextStepBridge");
  if (consumesLandingPageQuota(input.pageRole)) {
    await incrementQuotaCount(input.userId, "landingPages");
  } else {
    console.log(`[landingPage] quota NOT incremented (pageRole=additional) landingPageId=${landingPageId} — machinery, not a coach-requested asset`);
  }

  // Auto-score + autoSelectBest — non-blocking
  try {
    const originalContent = JSON.stringify(allAngles.original);
    const s = await scoreItem({ content: originalContent, nodeType: "landingPages", formulaType: "original" });
    await db.update(landingPages).set({ selectionScore: String(s) } as any).where(eq(landingPages.id, landingPageId));
    // The crown decision is `crownIfPrimary`'s, and it is this file's ONLY call site for
    // `autoSelectBest` — pinned by a source-parity test, because an inlined second call would
    // reinstate the clobber silently. It does not swallow; this existing catch keeps error
    // behaviour identical.
    await crownIfPrimary({ autoSelectBest }, input.pageRole ?? "primary", input.userId, icp?.id, landingPageId);
  } catch (e) { console.warn("[auto-select] landingPages failed:", e); }

  return { landingPageId };
}
