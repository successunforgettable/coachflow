import { invokeLLM } from "./_core/llm";
import type { LandingPageContent } from "../drizzle/schema";
import { BANNED_COPYWRITING_WORDS, META_COMPLIANCE_NOTES, NO_DATE_FABRICATION_RULE, truncateQuote } from "./_core/copywritingRules";

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
scarcityUrgency, shockingStat, timeSavingBenefit, consultationOutline, faq.

Follow the EMOTIONAL ARC structure below in full.
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

SECTIONS TO LEAVE EMPTY (return as empty string ""):
- problemAgitation: ""
- solutionIntro: ""
- whyOldFail: ""
- uniqueMechanism: ""
- shockingStat: ""
- insiderAdvantages: ""
- quizSection: { question: "", options: [], answer: "" }
- faq: []
- asSeenIn: [] (or 1-2 entries if real)

VOICE CONVENTION LOCK: First-person singular throughout. The host is "I" /
"me" / "my". No drift to "we" or third-person.

FIELD SUBSTITUTION CONVENTION: Use literal values from above when supplied
(eventDate, eventTime, etc.); use [INSERT_*] tokens verbatim when not
supplied. No coin-flipping.

PLACEHOLDER ALLOW-LIST: Only emit [INSERT_EVENT_DATE], [INSERT_EVENT_TIME],
[INSERT_EVENT_TIMEZONE], [INSERT_HOST_NAME], [INSERT_REPLAY_AVAILABILITY]
when their values are operator-supplied. SPECIFICALLY FORBIDDEN: [INSERT_
LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_
DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use
[INSERT_BOOKING_URL] if needed). Write actual content for any value not
in the allow-list.

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
- insiderAdvantages — re-purposed as "What we'll cover in [duration]" —
  3-bullet list of specific topics the call addresses. Use [INSERT_
  BOOKING_DURATION] if duration not supplied; never invent durations.
- testimonials — 1-2 short quotes from past clients if available.

SECTIONS TO LEAVE EMPTY (return as empty string ""):
- problemAgitation: ""
- whyOldFail: ""
- scarcityUrgency: ""
- shockingStat: ""
- uniqueMechanism: ""
- solutionIntro: ""
- timeSavingBenefit: ""
- consultationOutline: []
- quizSection: { question: "", options: [], answer: "" }
- faq: []
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

SECTIONS TO LEAVE EMPTY (return as empty string ""):
- scarcityUrgency: "" (CRITICAL — see banned phrases below)
- shockingStat: ""
- whyOldFail: ""
- uniqueMechanism: ""
- solutionIntro: ""
- insiderAdvantages: ""
- timeSavingBenefit: ""
- consultationOutline: []
- quizSection: { question: "", options: [], answer: "" }
- faq: []
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

SECTIONS TO LEAVE EMPTY (return as empty string ""):
- problemAgitation: ""
- whyOldFail: ""
- shockingStat: ""
- uniqueMechanism: ""
- solutionIntro: ""
- timeSavingBenefit: ""
- testimonials: [] (or 1-2 entries if real)
- quizSection: { question: "", options: [], answer: "" }
- faq: []
- asSeenIn: []

VOICE CONVENTION LOCK: First-person singular throughout. The host is "I" /
"me" / "my". Sign-off uses host name. No drift to "we" or third-person.

FIELD SUBSTITUTION CONVENTION: Literal when supplied; [INSERT_*] verbatim
when not.

PLACEHOLDER ALLOW-LIST: Only emit [INSERT_EVENT_VENUE], [INSERT_EVENT_
DATE], [INSERT_EVENT_TIME], [INSERT_EVENT_TIMEZONE], [INSERT_EVENT_
AGENDA], [INSERT_HOST_NAME], plus operator-discretion: [INSERT_PARKING_
INFO], [INSERT_DRESS_CODE], [INSERT_ROOM_OR_FLOOR_INFO], [INSERT_DIETARY_
NOTES]. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE],
[INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_
PROGRAM_NAME].

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
    : `NO SOCIAL PROOF DATA PROVIDED:
- For testimonials section: Use outcome-based quotes WITHOUT specific names ("A marketing agency owner" instead of "John Smith")
- For "As Seen In" section: OMIT entirely or use "Trusted by [audience] in 30+ countries"
- DO NOT fabricate customer counts, ratings, or press mentions
- Focus on benefit claims and transformation stories instead`;
  
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
  for (let leakAttempt = 1; leakAttempt <= LP_SCHEMA_RETRY_MAX_ATTEMPTS; leakAttempt++) {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: `You are a world-class direct response copywriter specializing in high-converting landing pages. You engineer an emotional arc through each page — every section serves a specific emotional purpose, moving the reader from 'seen and understood' through 'named and validated', 'cost of inaction', 'hope', 'different from what they've tried', 'safe to believe', and finally 'obvious next step'. You write in the customer's own language — the words they use with a close friend, not marketing language. FORMATTING RULE: Return plain text only inside all JSON string values. No markdown. No asterisks (*). No hash symbols (#). No bold or italic formatting of any kind. No bullet markers. Just clean readable sentences and paragraphs.\n\n${META_COMPLIANCE_NOTES}\n\n${NO_DATE_FABRICATION_RULE}` },
      { role: "user", content: cascadeContext + prompt }
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
            }
          },
          required: [
            "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
            "asSeenIn", "quizSection", "problemAgitation", "solutionIntro",
            "whyOldFail", "uniqueMechanism", "testimonials", "insiderAdvantages",
            "scarcityUrgency", "shockingStat", "timeSavingBenefit", "consultationOutline"
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
