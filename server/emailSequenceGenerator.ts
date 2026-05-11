// ─── Auto Mode Phase B1 — emailSequenceGenerator.ts ─────────────────────────
// Verbatim relocation of email sequence helpers + 10 prompt builders +
// system prompt + retry helper from server/routers/emailSequences.ts.
// All Sprint B regression-fix v2 anchors preserved unchanged:
//   - EMAIL_SEQUENCE_SYSTEM_PROMPT (positive-only CRITICAL OUTPUT FORMAT, no Wrong/Right framing per b4f2fb4)
//   - invokeEmailSequenceWithRetry defensive un-stringify (Sprint B regression fix)
//   - buildNurtureEmailPrompt does NOT include NO-FABRICATION RULE (per b4f2fb4 rollback rationale)
//   - PROOF SPECIFICITY RULE format strings at all 4 sites (welcome ep3, engagement ep2, sales ep2, nurture ep5)
//
// runEmailSequenceGeneration appended at bottom (gen-core for orchestrator
// + tRPC mutation wrappers in server/routers/emailSequences.ts).

import { invokeLLM } from "./_core/llm";
import { truncateQuote, NO_DATE_FABRICATION_RULE } from "./_core/copywritingRules";
import { getCascadeContext } from "./_core/cascadeContext";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
}

interface EmailPromptParams {
  sotContext: string;
  serviceName: string;
  campaignTypeContext: string;
  icpContext: string;
  socialProofGuidance: string;
  // welcome / nurture / launch / re-engagement (generic service context)
  category?: string | null;
  description?: string | null;
  targetCustomer?: string | null;
  mainBenefit?: string | null;
  // engagement & sales (event-anchored — Decision-C placeholders fall back
  // to [INSERT_EVENT_NAME] / [INSERT_HOST_NAME] when undefined)
  eventName?: string;
  hostName?: string;
  // sales (Decision-C placeholders [INSERT_OFFER_NAME] / [INSERT_PRICE] /
  // [INSERT_DEADLINE] when undefined)
  offerName?: string;
  price?: string;
  deadline?: string;
  // Note on nurture / launch / re-engagement (commit 2 of Email Sequence wire):
  // these three new builders do NOT add new schema fields per the locked A1
  // strategy. They use [INSERT_*] operator placeholders for their anchor
  // variables (lead magnet name, cart-open/close dates, incentive, etc.) —
  // surfaced via PlaceholderBanner at V2EmailSequenceResultPanel:419 for the
  // operator to fill in post-generation.
  // Workstream commit 2.5b extended eventDetails (Zod) with 7 new optional
  // fields. Workstream commit 3b consumes them via the 4 new builders below
  // (discovery_call_confirmation / discovery_call_reminder / event_logistics
  // / replay_for_no_shows). All optional; missing values fall through to
  // [INSERT_*] operator placeholders per the established Decision-C pattern.
  eventTime?: string;       // discovery_call_*, event_logistics
  eventTimezone?: string;   // discovery_call_*, event_logistics
  eventDate?: string;       // event_logistics (also reused by sales prompt)
  eventVenue?: string;      // event_logistics
  eventAgenda?: string;     // event_logistics
  eventDuration?: string;   // discovery_call_confirmation, event_logistics
  replayUrl?: string;       // replay_for_no_shows
  bookingUrl?: string;      // discovery_call_*
}

// ───────────────────────────────────────────────────────────────────────────
// DELAY METADATA — workstream commit 4c (sprint 3b backlog item #2)
// ───────────────────────────────────────────────────────────────────────────
// Per-sequenceType delay maps. The persistence layer OVERRIDES whatever the
// LLM emits with these server-controlled values. Server is source of truth
// for delay metadata; LLM is source of truth for content only.
//
// SEMANTIC CONVENTION (documented per type):
//   - Sequence-start-anchored types (welcome, engagement, sales, nurture,
//     launch, re-engagement, replay_for_no_shows): delay = hours from first
//     message send time. Day 0 = first message; Day N = N*24h offset.
//   - Event-anchored types (discovery_call_reminder, event_logistics):
//     delay = INTENDED SPACING since previous message. Operator-side
//     automation computes absolute send time relative to the anchor event
//     (booking time, event date). The first message's delay=0 marks the
//     start of the sequence; subsequent values are spacing.
//   - Single-message types (discovery_call_confirmation): delay=0;
//     operator triggers immediately on the booking event.
//
// Replaces the prior (idx * 24) naive fallback that produced wrong cadence
// for non-daily sequences (nurture, launch, replay) and semantically-wrong
// cadence for event-anchored types.
const DELAY_HOURS_BY_EMAIL_TYPE: Record<string, number[]> = {
  welcome:                       [0, 48, 96],                                  // Day 1/3/5 (3 emails)
  engagement:                    [0, 24, 48, 72, 96],                          // Mon-Fri pre-event (5 emails)
  sales:                         [0, 24, 48, 72, 96, 120, 144],                // Day 1-7 post-event (7 emails)
  nurture:                       [0, 60, 132, 216, 312, 408, 480],             // 7 emails: Day 0 / Day 2-3 / Day 5-6 / Day 8-10 / Day 12-14 / Day 16-18 / Day 19-21 (mid-range hour offsets)
  launch:                        [0, 72, 120, 168, 192, 240, 288, 336, 342],   // 9 emails: Day -7 / -4 / -2 / 0 (cart open) / +1 / +3 / +5 / +7 morning / +7 final hours (~6h after morning)
  "re-engagement":               [0, 48, 120, 336],                            // Day 0/2/5/14 (4 emails)
  discovery_call_confirmation:   [0],                                          // single message — operator triggers immediately on booking
  discovery_call_reminder:       [0, 22, 1.75],                                // Intended spacing: T-24h start; +22h = T-2h; +1.75h = T-15min
  event_logistics:               [0, 96, 144, 192],                            // Day -7/-3/-1/+1 (event sits at 168h from Day -7; +1 = +192h, +24h after event)
  replay_for_no_shows:           [0, 48, 96],                                  // Day +1/+3/+5 from first send
};

function getEmailRules(): string {
  // Word count rules per sequence type — update the BODY COPY RULES block below if new sequence types are added.
  // Welcome sequence: max 200 words
  // Engagement sequence: max 200 words (event-anchored)
  // Sales sequence: max 300 words (event-anchored)
  // Nurture sequence: max 200 words (commit 2 of Email Sequence wire)
  // Launch sequence: max 250 words (commit 2 of Email Sequence wire)
  // Re-engagement sequence: max 150 words (commit 2 of Email Sequence wire)
  // Discovery call confirmation: max 150 words (workstream commit 3b — single transactional)
  // Discovery call reminder: max 100 words (workstream commit 3b — short mobile reminders)
  // Event logistics: max 200 words (workstream commit 3b — practical info)
  // Replay for no-shows: max 175 words (workstream commit 3b — value re-extension)
  return `ONE EMAIL ONE JOB RULE: Every email in this sequence has exactly ONE job. The entire email — subject line, body, and CTA — must serve only that one job. Nothing else. No secondary CTAs. No topic shifts.

SUBJECT LINE RULES:
- Every subject line must create curiosity or pattern interrupt — NEVER describe what the email is about
- Banned subject line patterns: "Welcome to [X]", "Here's what I promised", "Don't miss [X]", "[X] is now available"
- Good patterns: A provocative question, an incomplete statement, something unexpected, something specific and slightly strange
- Max 50 characters. Test: Would you open this if you didn't know the sender?

PREVIEW TEXT RULES:
- Preview text extends the subject line — it completes the thought or adds a second layer of intrigue. Never repeat the subject line. Never describe the email content. Max 140 characters.

BODY COPY RULES:
- Welcome sequence emails: max 200 words
- Engagement sequence emails: max 200 words
- Sales sequence emails: max 300 words
- Nurture sequence emails: max 200 words
- Launch sequence emails: max 250 words
- Re-engagement sequence emails: max 150 words
- Discovery call confirmation emails: max 150 words
- Discovery call reminder emails: max 100 words
- Event logistics emails: max 200 words
- Replay for no-shows emails: max 175 words
- Max 15 words per sentence. Max 2 sentences per paragraph. Line breaks between paragraphs.
- Grade 6 reading level. Short words. Direct language. Contractions (you're, it's, don't).
- Never use: "I hope this email finds you well", "As per my last email", "I wanted to reach out"
- Open with the most interesting sentence — not a greeting, not context-setting

MOBILE-FIRST RULE: Most emails are read on a phone in under 8 seconds. Every email must pass this test: read only the first sentence of each paragraph. Does the email still make sense? If yes, the structure is correct. If no, the paragraphs are burying the lead. Front-load every paragraph with the most important information.

HOOK RULE: The first sentence of every email is the hook. It must do one of three things: name a specific situation the reader is in right now, make a counterintuitive claim that challenges something they believe, or open a loop they cannot close without reading further. The hook must be niche-specific — it must contain at least one word or phrase that only someone in this specific world would recognise. A hook that could be sent by any coach in any niche is not a hook — it is a greeting.

ICP LANGUAGE RULE: Write in the customer's own language — the words they use to describe their problem to a friend, not the words a coach uses to describe it. The ICP context provided contains their pains, fears, and frustrations. Extract the most specific phrase from that context and use it verbatim in at least one place in each email. Never use coaching language to describe a customer problem.

PS LINE RULE: Every email MUST end with a PS. The PS must do ONE of: add a key piece of information not in the body, create additional urgency, or deepen the curiosity loop. The PS is often read first — make it pull them into the body.

CTA RULE: One CTA per email. State it once. Make it specific to the job of this email.`;
}

export function buildWelcomeEmailPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 3-email welcome sequence for new subscribers using Russell Brunson's Soap Opera Sequence framework.

Service: ${p.serviceName}
Category: ${p.category || ""}
Description: ${p.description || ""}
Target Customer: ${p.targetCustomer || ""}
Main Benefit: ${p.mainBenefit || ""}
Host: ${p.hostName || "[INSERT_HOST_NAME]"}
Lead Magnet: [INSERT_LEAD_MAGNET_NAME]
Programme duration: [INSERT_PROGRAMME_DURATION]

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

HOST-NAME ANCHOR (Sprint B — host-name fabrication fix): Use [INSERT_HOST_NAME] (operator-fills) when the email needs to introduce, sign off, or self-reference. Never invent a host name. If the host data above is supplied as a literal value, use that exact name throughout; if it appears as the [INSERT_HOST_NAME] token, emit the token verbatim where the host's name would appear.

PLACEHOLDER ALLOW-LIST (Sprint B+1 — retroactive coverage of pre-existing welcome builder, matching the commit 6 / Bucket 3 retroactive-coverage pattern for engagement / sales / WA sales; Sprint B+2 — LEAD_MAGNET_NAME extension closing email 1 lead-magnet-content fabrication from spot-check 3, and PROGRAMME_DURATION extension closing email 3 "twelve weeks" duration drift): [INSERT_HOST_NAME], [INSERT_LEAD_MAGNET_NAME], and [INSERT_PROGRAMME_DURATION] are the COMPLETE set of [INSERT_*] tokens permitted in this builder. [INSERT_LEAD_MAGNET_NAME] anchors any reference to what the subscriber just downloaded — used in email 1's handoff (the email body links to the asset, never reproduces its contents or invents its structure). [INSERT_PROGRAMME_DURATION] is permitted ONLY for email 3's mechanism description (e.g. "conducted over [INSERT_PROGRAMME_DURATION], long enough to see patterns") — welcome remains non-pitch (no offer / guarantee / cohort framing). The token anchors method-duration references in proof framing; it does NOT introduce sales framing. The welcome sequence is non-pitch (emails 1-2 deliver, email 3 proofs) — no offer, no guarantee, no cohort framing belongs here, so no GUARANTEE_TERMS / COHORT_* / PRICE / OFFER_* tokens. DO NOT invent placeholders for content the LLM should be writing — welcome's job is to BUILD trust through specific concrete prose, not to defer that work to the operator. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use canonical [INSERT_BOOKING_URL] only if the sequence's CTA is a 1:1 booking, otherwise write the actual call-to-action), [INSERT_BOOKING_TIME], [INSERT_BOOKING_TIMEZONE] (welcome does not anchor to call times), [INSERT_FLAG_COUNT], [INSERT_CHAPTER_NUMBER] (do NOT invent structural divisions of the lead magnet — link to it, do not reproduce it). Write actual content for any value not in the allow-list.

SEQUENCE GOAL: By the end of email 3, the reader should feel they know who you are, believe you understand their situation better than anyone else has, and feel that the next logical step is to learn more about how you can help them specifically. Every email moves them one step closer to this state. Nothing in emails 1 or 2 asks them to buy — the sequence earns that right in email 3.

Create 3 emails.
1. DELIVER THE PROMISE (Day 1) — Primary job: Drop the LINK to [INSERT_LEAD_MAGNET_NAME] in the first paragraph. The email body is the handoff, not the asset itself — never paste the asset's contents. Sprint B+2-fix BROADENED NO-FABRICATION RULE — DELIVERABLE-ASSET CLAIMS (replaces the narrower Sprint B+2 rule that only forbade structure-claims; this rule extends to outcome and reader-experience claims after spot-check showed the LLM fabricating "Most women who read it expect to recognise one or two flags. They end up circling five." despite the structure-claim ban): do NOT make ANY claim about what the lead magnet contains, how it is organised, what readers do when they engage with it, what specific outcomes they get from it, how readers respond to it, or what specific items inside it stand out. Forbidden phrasing patterns: "X people who read it expect to recognise Y", "the [number] [items]", "one of these [items]", "X stopped a senior exec mid-sentence", any countable structural division (flags, chapters, principles, bullets, sections), any reader-outcome inference. Reference [INSERT_LEAD_MAGNET_NAME] by name only. Any claim beyond "it is the asset they signed up for" must be rooted in operator-supplied content, not inferred from the niche, the event name, the ICP, or the SoT context above. Set up ONE specific reason to actually open it — a teaser at the LEVEL OF THE READER'S SITUATION (what shifts in their thinking after they engage with material like this in their niche), NOT at the level of the asset's contents. NO preamble. NO selling. Just the handoff + ONE situation-level teaser. Secondary function (not a second job — a structural element): the PS IS the question, verbatim. Format: "PS. [Question text ending in ?]". Do NOT preface with "There's a question I want to ask..." or "I want to ask you something" or any meta-framing about the question existing. Do NOT describe the question. The PS body IS one direct question to the reader, ending in a question mark, that they cannot answer without opening email 2. The question must be real, niche-specific, and something they genuinely do not know the answer to.
2. ORIGIN STORY (Day 3) — Job: Why you do this work. One vulnerable moment (what it looked like when things were not working), one turning point (the specific thing that changed), one result (what became possible after). No selling. No pitch. The story must make them feel they are not alone in their situation.
3. PROOF (Day 5) — Job: One client story with a specific before/after. PROOF SPECIFICITY RULE (Sprint B — case-study fabrication fix, ported from WhatsApp's ENGAGEMENT_PROOF_BLOCK pattern): Anonymous proof must still be specific. Required structure: state the role first (specific job title or life situation), then the problem they had, then the mechanism or change, then the outcome with a number, timeframe, or named result. Never use 'someone', 'a person', 'one of our clients', 'a student' without qualification. Never invent named individuals (e.g. "Sarah, a senior leader") — anonymised role-based composites only. ANCHOR ON [INSERT_PROGRAMME_DURATION] FOR METHOD-DURATION REFERENCES (Sprint B+2 — closes "twelve weeks" duration drift surfaced in welcome spot-check 3): if the proof's mechanism description references method duration (e.g. "conducted over X weeks/months/sessions, long enough to see patterns"), anchor on [INSERT_PROGRAMME_DURATION]; emit the token verbatim if not pre-supplied. Do NOT invent specific durations like "twelve weeks" or "six months" — pick the token, let the operator resolve. PROGRAMME_DURATION here is permitted ONLY for email 3's mechanism description (welcome remains non-pitch — no offer / cohort / guarantee framing). WHEN NO TESTIMONIALS ARE SUPPLIED (per the socialProofGuidance block above — Sprint B+1 rewrite of prior conditional framing that the LLM was echoing as content-to-acknowledge): structure this email as a mechanism-only frame. Replace the client story with a mechanism-only frame — describe the change the method produces (the structural shift, the new capability) without anchoring to a specific person, and end with a question inviting the reader to consider whether they're at the starting point of that change. The story must be specific enough that the reader thinks "that could be me."

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars, never descriptive)
- previewText: (extends the subject line — completes the thought or adds a second layer of intrigue, never repeats the subject, max 140 chars)
- body: (max 200 words, short sentences, line breaks between paragraphs)
- cta: (one specific action)
- ps: (mandatory — one sentence that creates curiosity or urgency)

Return as a JSON object with an 'emails' key containing the array.`;
}

export function buildEngagementEmailPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 5-email engagement sequence for event attendees using Russell Brunson's Soap Opera Sequence.

Service: ${p.serviceName}
Event: ${p.eventName || "[INSERT_EVENT_NAME]"}
Host: ${p.hostName || "[INSERT_HOST_NAME]"}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

ANCHOR PLACEHOLDERS: Use [INSERT_EVENT_NAME] for the event name and [INSERT_HOST_NAME] for the host. These are the ONLY operator-fill tokens this builder may emit — they are pre-resolved upstream when supplied; emit them verbatim when not.

PLACEHOLDER ALLOW-LIST (Bucket 3 — retroactive coverage of pre-existing engagement builder, matching the commit 6 nurture/launch/re-engagement pattern): [INSERT_EVENT_NAME] and [INSERT_HOST_NAME] are the COMPLETE set of [INSERT_*] tokens permitted in this builder. DO NOT invent placeholders for content the LLM should be writing — the engagement sequence's job is to BUILD anticipation through specific concrete prose, not to defer that work to the operator. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use canonical [INSERT_BOOKING_URL] only if the sequence's CTA is a 1:1 booking, otherwise write the actual call-to-action), [INSERT_BOOKING_TIME], [INSERT_BOOKING_TIMEZONE] (event timing is anchored elsewhere — engagement copy refers to the event by name, not by clock). Write actual content for any value not in the allow-list.

Create 5 emails (Monday to Friday before event).
1. SET THE STAGE (Monday) — Job: Create anticipation for the event. Make them feel something valuable is coming — something they'd regret missing.
2. OPEN WITH HIGH DRAMA (Tuesday) — Job: Tell one specific story that makes the problem feel urgent and personal. PROOF SPECIFICITY RULE (Sprint B+2 — extends Sprint B's case-study fabrication fix to engagement email 2): Anonymous proof must still be specific. Required structure: state the role first (specific job title or life situation), then the problem they had, then the mechanism or change, then the outcome with a number, timeframe, or named result. Never use 'someone', 'a person', 'one of our clients', 'a student' without qualification. Never invent named individuals — anonymised role-based composites only. WHEN NO TESTIMONIALS ARE SUPPLIED (per the socialProofGuidance block above): structure this email as a hypothetical/aspirational story using "imagine you're..." framing. Replace the specific-individual story with an aspirational scenario rooted in the niche — "imagine you're a [role] who's been [specific situation]..." — do NOT fabricate even an anonymised composite. Engagement is anticipation-led not proof-led, so the fallback stays narrative-shaped (story without a real protagonist), not mechanism-only. VOICE CONSISTENCY (Sprint B+2-fix Obs 3): when the narrative fallback applies (no testimonials), subject + previewText must match the body's first/second-person voice. If body opens "Imagine you're a [role]...", subject + previewText address "you" directly — do NOT shift to third-person "she" / "he" / "they" in subject or preview. Voice locks at the body's pronoun and stays there across all three fields. No product pitch.
3. EPIPHANY (Wednesday) — Job: Reveal the insight that makes the event feel essential to attend. Not a feature list — one counterintuitive truth that is specific enough that the reader thinks "I never knew that about my situation."
4. HIDDEN BENEFITS (Thursday) — Job: Name one specific benefit of attending that they haven't considered yet. Make showing up feel obviously worth it.
5. URGENCY & CTA (Friday) — Job: Create genuine urgency around showing up live. Name what they'll miss if they don't.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars, never descriptive)
- previewText: (extends the subject line — completes the thought or adds a second layer of intrigue, never repeats the subject, max 140 chars)
- body: (max 200 words, short sentences, line breaks between paragraphs)
- cta: (one specific action)
- ps: (mandatory — one sentence that creates curiosity or urgency)

Return as a JSON object with an 'emails' key containing the array.`;
}

export function buildSalesEmailPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 7-email sales sequence for event attendees who didn't buy.

Service: ${p.serviceName}
Event: ${p.eventName || "[INSERT_EVENT_NAME]"}
Offer: ${p.offerName || "[INSERT_OFFER_NAME]"}
Price: ${p.price || "[INSERT_PRICE]"}
Deadline: ${p.deadline || "[INSERT_DEADLINE]"}
Host: ${p.hostName || "[INSERT_HOST_NAME]"}
Guarantee terms: [INSERT_GUARANTEE_TERMS]
Cohort limit: [INSERT_COHORT_LIMIT]
Cohort close date: [INSERT_COHORT_CLOSE_DATE]

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

LOSS AVERSION FRAME — applies to emails 1 through 4: Every email must contain at least one sentence that names something the reader is actively losing right now — not something they might gain later. Frame it in present tense: 'Every week you stay here is another week of [specific cost].' The cost must be niche-specific and concrete — a number, a named situation, or a recurring experience. Losses feel twice as painful as equivalent gains. Use this asymmetry.

SUBJECT LINE SPECIFICITY RULE FOR SALES SEQUENCES: Each of the 7 emails has a different emotional job. The subject line must match that job's emotional tone — not just create generic curiosity. Email 1 (Thank You): subject must feel personal and specific to what they just experienced. Email 2 (Case Study): subject must name a specific situation, not just promise a story. Email 3 (Objection): subject must name the real objection, not hint at it. Email 4 (Bonus): subject must make the bonus feel like a surprise discovery, not a sales pitch. Email 5 (Guarantee): subject must make the guarantee feel like news, not reassurance. Email 6 (Scarcity): subject must name what specifically closes, not just create urgency. Email 7 (Final Call): subject must name the choice, not the deadline.

ANCHOR PLACEHOLDERS: Use [INSERT_EVENT_NAME] for the event the reader attended, [INSERT_OFFER_NAME] for the offer being sold, [INSERT_PRICE] for the price tag, [INSERT_DEADLINE] for the cart-close or genuine deadline, and [INSERT_OFFER_LINK] for the offer URL the CTA drives to (distinct from [INSERT_BOOKING_URL] which is for 1:1 call scheduling — use OFFER_LINK for sales-page or checkout destinations). [INSERT_HOST_NAME] for the host. Operator pre-fills these before sending — emit the tokens verbatim when not pre-supplied. Do not invent prices, deadlines, offer names, URLs, or host identity.

PLACEHOLDER ALLOW-LIST (Bucket 3 — retroactive coverage of pre-existing sales builder, matching the commit 6 nurture/launch/re-engagement pattern; OFFER_LINK newly cataloged from WA sales spot-check 1; Sprint B — GUARANTEE_TERMS + COHORT_LIMIT + COHORT_CLOSE_DATE + PROGRAMME_DURATION canonicals added to anchor previously-fabricated specifics): [INSERT_EVENT_NAME], [INSERT_OFFER_NAME], [INSERT_PRICE], [INSERT_DEADLINE], [INSERT_OFFER_LINK], [INSERT_HOST_NAME], [INSERT_GUARANTEE_TERMS], [INSERT_COHORT_LIMIT], [INSERT_COHORT_CLOSE_DATE], [INSERT_PROGRAMME_DURATION] are the COMPLETE set of [INSERT_*] tokens permitted in this builder. [INSERT_GUARANTEE_TERMS] anchors refund duration / conditions / process — distinct from generic [INSERT_DEADLINE]. [INSERT_COHORT_LIMIT] anchors genuine spot-count claims (e.g. "12 founding members"); [INSERT_COHORT_CLOSE_DATE] anchors genuine cohort close dates — both distinct from cart-close [INSERT_DEADLINE]. [INSERT_PROGRAMME_DURATION] is the canonical operator-fill for total programme length (e.g. "12 weeks", "6 months") — distinct from [INSERT_BOOKING_DURATION] (call duration) and [INSERT_EVENT_DURATION] (event duration). Use these tokens whenever a sales email references guarantee specifics, cohort limits, or programme length; emit verbatim if the operator hasn't pre-filled. Do NOT invent durations like "12-week" or "6-month" — pick the token, let the operator resolve. DO NOT invent placeholders for content the LLM should be writing — sales copy's job is to MAKE the case through specific concrete prose, not to defer the case-making work to the operator. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE] (use [INSERT_DEADLINE] for cart-close framing), [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION] (use canonical [INSERT_OFFER_LINK]), [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use canonical [INSERT_BOOKING_URL] if the offer drives to a 1:1 call, otherwise [INSERT_OFFER_LINK]), [INSERT_BOOKING_TIME], [INSERT_BOOKING_TIMEZONE] (sales emails do not anchor to call times — the event already happened by Day 1). Write actual content for any value not in the allow-list.

Create 7 emails (Day 1-7 after event).
1. THANK YOU (Day 1) — Job: Re-open the door. Thank them and name the one specific insight from the event that would have felt most personally true to someone in their situation. One clear next step at the end. Nothing else.
2. CASE STUDY (Day 2) — Job: Remove the "will it work for me?" objection. PROOF SPECIFICITY RULE (Sprint B — case-study fabrication fix, ported from WhatsApp's SALES_PROOF_MECHANISM_BLOCK pattern): Anonymous proof must still be specific. Required structure: state the role first (specific job title or life situation), then the problem they had, then the mechanism or change, then the outcome with a number, timeframe, or named result. Never use 'someone', 'a person', 'one of our clients', 'a student' without qualification. Never invent named individuals (e.g. "She was a senior leader at a professional services firm") — anonymised role-based composites only. ANCHORING RULE: State the starting point before the result. The reader must see the gap — where the person started versus where they ended up. A result without a starting point has no anchor. WHEN NO TESTIMONIALS ARE SUPPLIED (per the socialProofGuidance block above — Sprint B+1 rewrite of prior conditional framing that the LLM was echoing as content-to-acknowledge): structure this email as a mechanism-only frame. Replace the case study with a mechanism-only frame — describe the structural shift the method produces, end with a question inviting the reader to consider whether their situation matches the starting-point pattern. Do NOT fabricate even an anonymised composite when no real proof underlies it.
3. OBJECTION HANDLING (Day 3) — Job: Name the real objection — not the polite version they'd say out loud, but the actual thought in their head. Then answer it with specifics: a number, a story, or a mechanism. Do not be defensive. Do not sell. Just dismantle the objection with evidence.
4. BONUS REVEAL (Day 4) — Job: Make the offer feel more irresistible by revealing one bonus that solves a specific problem they didn't think was included. State the specific dollar value of the bonus. Use anchoring — state total value before revealing the ask. The bonus must feel directly useful, not like padding.
5. GUARANTEE (Day 5) — Job: Remove all risk from the decision. ANCHOR ON [INSERT_GUARANTEE_TERMS] (Sprint B — guarantee fabrication fix, new canonical operator-fill token following Bucket 3's OFFER_LINK / PROGRAMME_DURATION convention): the operator-supplied guarantee terms specify refund duration, refund conditions, refund process. Do NOT invent guarantee specifics (refund duration, refund process, conditions for refund eligibility, money-back framing details). If the operator has not supplied real guarantee terms, emit [INSERT_GUARANTEE_TERMS] verbatim wherever the email body would otherwise enumerate refund mechanics, and reframe the email's job as "reduce risk through framing the safety of the decision" — describe what about the offer's structure makes it low-risk (e.g. the time-bound nature of the work, the operator's named track record, the fit-check process) without inventing refund mechanics. Make keeping their money feel riskier than spending it — name the ongoing cost of not solving this problem for one more month.
6. SCARCITY (Day 6) — Job: Make inaction feel costly and concrete. ANCHOR ON [INSERT_COHORT_LIMIT] + [INSERT_COHORT_CLOSE_DATE] (Sprint B — cohort/scarcity fabrication fix, two new canonical operator-fill tokens following Bucket 3's OFFER_LINK / PROGRAMME_DURATION convention): [INSERT_COHORT_LIMIT] anchors any genuine spot-count claim (e.g. "12 founding members"); [INSERT_COHORT_CLOSE_DATE] anchors any genuine cohort close date. Do NOT invent cohort numbers, fixed-place claims, or scarcity deadlines. URGENCY FALLBACK (ported from WhatsApp's SALES_DIRECT_OFFER_BLOCK pattern): If no genuine deadline, price increase, or spot limit exists (i.e. the operator has not supplied [INSERT_COHORT_LIMIT] or [INSERT_COHORT_CLOSE_DATE] or [INSERT_DEADLINE]), use social-proof scarcity grounded in psychology — "People who attended [INSERT_EVENT_NAME] and acted within 48 hours got [specific result]. The window where momentum works in your favour is closing." This is honest urgency from social proof, not fabricated scarcity. Name what specifically happens after the deadline ONLY if a real deadline is anchored to a token; otherwise frame the urgency as the inertia cost of one more week unchanged.
7. FINAL CALL (Day 7) — Job: Resolve the most important open loop from earlier in the sequence — the one question or tension that has been building. Name it explicitly: 'You've been wondering [specific question]. Here's the answer.' Then make the choice binary and concrete: [specific outcome if they act today] versus [specific cost if they don't]. One CTA. Nothing else.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars, never descriptive)
- previewText: (extends the subject line — completes the thought or adds a second layer of intrigue, never repeats the subject, max 140 chars)
- body: (max 300 words, short sentences, line breaks between paragraphs)
- cta: (one specific action)
- ps: (mandatory — one sentence that creates urgency or reveals additional stakes)

Return as a JSON object with an 'emails' key containing the array.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Net-new sequence types (commit 2 of Email Sequence wire).
// Locked structural designs from the prior design pass:
//   - Nurture: 7 emails over ~21 days, Russell Brunson Soap Opera Sequence,
//     anchored to a lead magnet (NOT an event). [INSERT_LEAD_MAGNET_NAME]
//     placeholder per A1 strategy (no schema field, surfaced via banner).
//   - Launch: 9 emails around a cart-open window, Jeff Walker Product Launch
//     Formula structure (3 pre-launch + 5 open-cart + 1 close-cart). Anchored
//     to product/cart window. Placeholders: [INSERT_LAUNCH_PRODUCT_NAME],
//     [INSERT_CART_OPEN_DATE], [INSERT_CART_CLOSE_DATE], [INSERT_CART_CLOSE_TIME],
//     [INSERT_PRICE], [INSERT_BONUS_VALUE].
//   - Re-engagement: 4 emails over 14 days, marketingskills repo template
//     (Check-in → Value Reminder → Incentive → Last Chance). Anchored to
//     subscriber inactivity (NOT event). Placeholders: [INSERT_LAST_ENGAGEMENT_TIMEFRAME],
//     [INSERT_INCENTIVE].
// All three are tier-agnostic. Free-tier gating is at the wizard-render level
// (PRO_GATED_STEPS includes emailSequence — entire node behind paywall today).
// ───────────────────────────────────────────────────────────────────────────

export function buildNurtureEmailPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 7-email nurture sequence for new subscribers who just downloaded a lead magnet, using Russell Brunson's Soap Opera Sequence framework.

Service: ${p.serviceName}
Category: ${p.category || ""}
Description: ${p.description || ""}
Target Customer: ${p.targetCustomer || ""}
Main Benefit: ${p.mainBenefit || ""}
Lead Magnet: [INSERT_LEAD_MAGNET_NAME]
Host: ${p.hostName || "[INSERT_HOST_NAME]"}
Guarantee terms: [INSERT_GUARANTEE_TERMS]
Programme start date: [INSERT_PROGRAMME_START_DATE]

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

HOST-NAME ANCHOR (Sprint B — host-name fabrication fix; root cause of "I'm Sarah" drift in email 1): Use [INSERT_HOST_NAME] (operator-fills) when the email needs to introduce, sign off, or self-reference. Never invent a host name. If the host data above is supplied as a literal value, use that exact name throughout all 7 emails; if it appears as the [INSERT_HOST_NAME] token, emit the token verbatim. Email 1's "Brief intro of who you are" instruction is anchored on this token specifically — DO NOT default to a fabricated archetype name.

SEQUENCE GOAL: Build trust over ~21 days. The reader signed up for a lead magnet. By Email 7, they should feel they know your method, have seen one transformation it produced, and be ready to consider the offer. Emails 1 through 6 earn the right to pitch in Email 7. No selling before Email 7 — every earlier email delivers value or builds the relationship.

TONE: Warm, expert, conversational throughout — same Soap Opera register as a welcome sequence. Email 1 is the warmest (delivery + handoff); Email 7 the most direct (the pitch). Curiosity and generosity stay constant; intensity rises gradually.

ANCHOR PLACEHOLDER: The lead magnet name is [INSERT_LEAD_MAGNET_NAME]. Use this token verbatim wherever the email needs to reference what the subscriber just downloaded — the operator fills it in before publishing. Do not invent a lead magnet name.

PLACEHOLDER ALLOW-LIST (workstream commit 6 — sprint 3b+4b items #5 + #11 + #14, retroactive coverage of pre-existing nurture builder; Bucket 3 PROGRAMME_DURATION addition from commit 6 spot-check 4 12-week-vs-6-month drift; Sprint B HOST_NAME addition for "I'm Sarah" host-name fabrication fix; Sprint B+1 GUARANTEE_TERMS + PROGRAMME_START_DATE additions for email 7 fabrication patterns from spot-check 1): [INSERT_LEAD_MAGNET_NAME], [INSERT_PROGRAMME_DURATION], [INSERT_HOST_NAME], [INSERT_GUARANTEE_TERMS], [INSERT_PROGRAMME_START_DATE] are the COMPLETE set permitted in this builder. [INSERT_PROGRAMME_DURATION] is the canonical operator-fill for total programme length (e.g. "12 weeks", "6 months") — distinct from [INSERT_BOOKING_DURATION] (call duration) and [INSERT_EVENT_DURATION] (event duration). [INSERT_HOST_NAME] anchors any introduction, sign-off, or self-reference — never fabricate a host archetype name (e.g. "I'm Sarah"). [INSERT_GUARANTEE_TERMS] anchors refund duration / conditions / process at email 7's offer reveal — never fabricate "or pay nothing" or other guarantee specifics. [INSERT_PROGRAMME_START_DATE] anchors when the programme cohort begins (e.g. "next cohort starts on...") — distinct from [INSERT_COHORT_CLOSE_DATE] (when sign-ups close, used in sales / launch builders) and from [INSERT_LAUNCH_DATE] (forbidden — operator-controlled cart mechanics, not relevant for nurture). Use these tokens whenever the nurture sequence references programme length, host identity, guarantee specifics, or programme start; emit verbatim if the operator hasn't pre-filled them. Do NOT invent durations like "12-week" or "6-month" — pick the token, let the operator resolve. DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK], [INSERT_FLAG_COUNT], [INSERT_CHAPTER_NUMBER], [INSERT_START_DATE] (use canonical [INSERT_PROGRAMME_START_DATE] — START_DATE is ambiguous, the namespaced PROGRAMME_START_DATE distinguishes from cart/event start dates). Same NO-FABRICATION reasoning as WhatsApp's nurture builder (item #10): do NOT invent specific structural details about the lead magnet (chapter counts, flag counts, page numbers).

Create 7 emails.

1. DELIVER + INTRO (Day 0) — Job: Hand off the lead magnet immediately in the first paragraph. No preamble. Brief intro of who you are (one sentence). Preview what's coming over the next ~3 weeks. End with a soft hook to the next email — one specific question or observation that pays off in Email 2. The PS is mandatory and is where the hook lives, not the body.

2. EXPAND ON THE TOPIC (Day 2-3) — Job: Add one extra insight beyond what was in the lead magnet. First-person observation framing — "I've noticed something specific about [reader's situation]." Position yourself as having a deeper view than what the magnet alone delivered. Soft CTA: "reply if X resonates" or "let me know which one fits you" — invitation to dialogue, not action.

3. PROBLEM DEEP-DIVE (Day 5-6) — Job: Articulate their problem more specifically than they've heard before. Name the specific moment in their workflow or week where the problem actually shows up — not the abstract version. Show you understand the texture, not just the headline. No CTA — pure value email. End with a question that confirms you've named their actual problem.

4. SOLUTION FRAMEWORK (Day 8-10) — Job: Introduce your method or framework in plain language. One sentence: what it is. One sentence: the principle that makes it work. One sentence: the proof point that proves the principle. Origin framing in the opening — "I get asked this all the time" or "I spent X years figuring this out." Soft CTA: "want me to walk you through how it works for [their situation]?"

5. CASE STUDY (Day 12-14) — Job: Tell one specific transformation story. PROOF SPECIFICITY RULE (Sprint B — case-study fabrication fix, "Sarah" seeding removed; ported from WhatsApp's ENGAGEMENT_PROOF_BLOCK pattern): Anonymous proof must still be specific. Required structure: state the role first (specific job title or life situation), then the problem they had, then the mechanism or change, then the outcome with a number, timeframe, or named result. Never use 'someone', 'a person', 'one of our clients', 'a student' without qualification. Never invent named individuals — anonymised role-based composites only. WHEN NO TESTIMONIALS ARE SUPPLIED (per the socialProofGuidance block above — Sprint B+1 rewrite of prior conditional framing that the LLM was echoing as content-to-acknowledge): structure this email as a mechanism-only frame. Replace the transformation story with a mechanism-only frame — describe the change the method produces structurally, end with a question inviting the reader to consider whether they recognise the starting-point pattern in their own situation. Do NOT fabricate even an anonymised composite when no real proof underlies it. Soft CTA: an invitation to explore your work or read more case studies (only if real case studies exist; otherwise an invitation to engage with the method directly).

6. DIFFERENTIATION + OBJECTION (Day 16-18) — Combined slot. Job: Address the alternative they're probably considering AND the natural objection to your method in one email. Two-part body: (1) name the obvious approach and why it fails for their specific situation; (2) preempt the most common objection to your approach with a concrete answer. Don't be defensive. Soft CTA: "ready to talk?" or "still on the fence — what's the question?"

7. DIRECT OFFER (Day 19-21) — Job: The first explicit pitch. No hedging. State the offer, the named outcome, the single specific next step. ANCHORING RULE: state the value of what they get before naming the price or the close. ANCHOR ON [INSERT_GUARANTEE_TERMS] (Sprint B+1 — guarantee fabrication fix extended from email sales email 5 / email launch email 4 pattern; nurture email 7 was fabricating "or pay nothing" framing per spot-check 1): the operator-supplied guarantee terms specify refund duration, conditions, and process. Do NOT invent guarantee specifics. If the operator has not supplied real guarantee terms, emit [INSERT_GUARANTEE_TERMS] verbatim where the guarantee would be enumerated, and frame the risk-reduction line at the structural level (what about the offer's structure makes it safe to enrol) rather than fabricating refund mechanics. ANCHOR ON [INSERT_PROGRAMME_START_DATE] when email 7's CTA references when the programme begins (e.g. "next cohort starts on..."); emit verbatim if the operator hasn't pre-filled. Do NOT invent start dates. Confidence, not apology. Primary CTA: book a call / buy / specific action.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars, never descriptive)
- previewText: (extends the subject line — completes the thought or adds a second layer of intrigue, never repeats the subject, max 140 chars)
- body: (max 200 words, short sentences, line breaks between paragraphs)
- cta: (one specific action)
- ps: (mandatory — one sentence that creates curiosity, urgency, or hooks to the next email)

Return as a JSON object with an 'emails' key containing the array.`;
}

export function buildLaunchEmailPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 9-email launch sequence around a cart-open window, using Jeff Walker's Product Launch Formula structure (3 pre-launch + 5 open-cart + 1 close-cart).

Service: ${p.serviceName}
Target Customer: ${p.targetCustomer || ""}
Main Benefit: ${p.mainBenefit || ""}
Product launching: [INSERT_LAUNCH_PRODUCT_NAME]
Cart opens: [INSERT_CART_OPEN_DATE]
Cart closes: [INSERT_CART_CLOSE_DATE] at [INSERT_CART_CLOSE_TIME]
Price: [INSERT_PRICE]
Host: ${p.hostName || "[INSERT_HOST_NAME]"}
Guarantee terms: [INSERT_GUARANTEE_TERMS]
Cohort limit: [INSERT_COHORT_LIMIT]
Cohort close date: [INSERT_COHORT_CLOSE_DATE]

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

SEQUENCE GOAL: Drive cart-open conversions during the open-cart window. The 3 pre-launch emails build anticipation by teaching, story-telling, and shifting how the reader sees their problem — without revealing the offer. Day 0 (Email 4) opens the cart with a full reveal. The 5 open-cart emails (Email 4-8) work different conversion angles. Email 9 is the final-call close-cart email a few hours before the deadline.

TONE: Anticipation in pre-launch (Emails 1-3) → confident clarity at cart-open (Email 4) → respectful urgency rising across open-cart (Emails 5-8) → direct, no-hedging close in Email 9. Warmth stays throughout; pressure rises only as the deadline approaches.

ANCHOR PLACEHOLDERS: Use [INSERT_LAUNCH_PRODUCT_NAME] for the product, [INSERT_CART_OPEN_DATE] / [INSERT_CART_CLOSE_DATE] / [INSERT_CART_CLOSE_TIME] for the cart window dates and time, [INSERT_PRICE] for the offer price, and [INSERT_BONUS_VALUE] for any bonus dollar value. The operator fills these in before publishing. Do not invent dates, times, prices, or product names — emit the tokens verbatim.

PLACEHOLDER ALLOW-LIST (workstream commit 6 — sprint 3b+4b items #5 + #11 + #14, retroactive coverage of pre-existing launch builder; Sprint B — HOST_NAME + GUARANTEE_TERMS + COHORT_LIMIT + COHORT_CLOSE_DATE + PROGRAMME_DURATION canonicals added to anchor previously-fabricated specifics): The placeholders enumerated above plus [INSERT_HOST_NAME], [INSERT_GUARANTEE_TERMS], [INSERT_COHORT_LIMIT], [INSERT_COHORT_CLOSE_DATE], [INSERT_PROGRAMME_DURATION] are the COMPLETE set permitted. [INSERT_HOST_NAME] anchors any introduction, sign-off, or self-reference. [INSERT_GUARANTEE_TERMS] anchors refund duration / conditions / process at the cart-open reveal. [INSERT_COHORT_LIMIT] anchors genuine spot-count claims (e.g. "12 founding members"); [INSERT_COHORT_CLOSE_DATE] anchors any genuine cohort close date beyond the cart window. [INSERT_PROGRAMME_DURATION] anchors total programme length (e.g. "12 weeks", "6 months") — distinct from [INSERT_BOOKING_DURATION] (call duration) and [INSERT_EVENT_DURATION] (event duration). Use these tokens whenever the launch references guarantee specifics, cohort limits, host identity, or programme length; emit verbatim if the operator hasn't pre-filled. Do NOT invent durations like "12-week" or "6-month" — pick the token, let the operator resolve. DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE] (use [INSERT_CART_OPEN_DATE] / [INSERT_CART_CLOSE_DATE] for cart-window framing), [INSERT_DEADLINE] (use [INSERT_CART_CLOSE_DATE] for cart-window framing or [INSERT_COHORT_CLOSE_DATE] for cohort framing), [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK]. Write actual content for any value not in the allow-list.

INTEGRITY RULE: Never invent scarcity that isn't real. Cart-close deadlines must reference [INSERT_CART_CLOSE_DATE] / [INSERT_CART_CLOSE_TIME] explicitly — operator-controlled, honest. Do not fabricate countdown timers, "spots left" claims, or price-increase deadlines unless they are real.

Create 9 emails.

1. PRE-LAUNCH HOOK (Day -7, PLF Video 1 frame) — Job: Tease that something's coming without revealing the product. First-person opener: "I've been working on something for [timeframe]." Name the bigger transformation it enables. No product reveal, no price, no CTA except "watch for the next email." Soft anticipation, warm tone.

2. PRE-LAUNCH TEACHING (Day -4, PLF Video 2 frame) — Job: Teach one principle that shifts how the reader sees their problem. Counterintuitive framing — "[common belief] is actually backwards." Show that this principle ties to your method and previews why a launch is coming. Soft CTA: "tell me what you think" or "does this match your experience?" Authority + generosity.

3. PRE-LAUNCH STORY (Day -2, PLF Video 3 frame) — Job: One detailed transformation arc. PROOF SPECIFICITY RULE (Sprint B — case-study fabrication fix, ported from WhatsApp's ENGAGEMENT_PROOF_BLOCK pattern): Anonymous proof must still be specific. Required structure: state the role first (specific job title or life situation), then the problem they had, then the mechanism or change, then the outcome with a number, timeframe, or named result. Never use 'someone', 'a person', 'one of our clients', 'a student' without qualification. Never invent named individuals — anonymised role-based composites only. WHEN NO TESTIMONIALS ARE SUPPLIED (per the socialProofGuidance block above — Sprint B+1 rewrite of prior conditional framing that the LLM was echoing as content-to-acknowledge): structure this email as a mechanism-only frame. Replace the transformation arc with a method-walkthrough frame — show what the method does structurally and what shift it produces, without anchoring to a specific person. Explicit "this is what's possible" framing remains. Tease that the cart opens in 48 hours. Soft CTA: "doors open [INSERT_CART_OPEN_DATE]."

4. THE DOORS ARE OPEN (Day 0) — Job: Full offer reveal. State the product name ([INSERT_LAUNCH_PRODUCT_NAME]), what's included, what they'll get, the price ([INSERT_PRICE]), the bonuses, the guarantee. ANCHOR ON [INSERT_GUARANTEE_TERMS] (Sprint B — guarantee fabrication fix, new canonical operator-fill following Bucket 3's OFFER_LINK / PROGRAMME_DURATION convention): the operator-supplied guarantee terms specify refund duration, conditions, and process. Do NOT invent guarantee specifics. If the operator has not supplied real guarantee terms, emit [INSERT_GUARANTEE_TERMS] verbatim where the guarantee would be enumerated, and frame the risk-reduction line at the structural level (what about the offer's structure makes it safe to enrol) rather than fabricating refund mechanics. ANCHORING RULE: total value before ask. Direct, clear, confident. Primary CTA: buy now / enroll. Subject: direct, "It's live."

5. SPECIFIC USE CASE (Day +1) — Job: Address one ICP segment specifically. Walk through one concrete user persona ("If you're a [specific archetype] dealing with [specific situation]..."), show how the product solves their version of the problem. Targeted helpful tone. Primary CTA: buy now.

6. OBJECTION HANDLING (Day +3) — Job: Name the real objection their head is asking — not the polite version. Three-paragraph structure: (1) state the objection in their words, (2) answer with concrete evidence, (3) acknowledge if it's actually a fit issue (and that's okay). Honest, dismantling, not defensive. Primary CTA: buy now.

7. BONUS REVEAL (Day +5) — Job: Reveal an unannounced bonus with a specific dollar value. Surprise framing — "I almost forgot to mention this." State the bonus name and what it specifically gives the buyer. ANCHORING RULE: state [INSERT_BONUS_VALUE] before reanchoring against the total package value. Generous tone with rising urgency. Primary CTA: buy now.

8. SCARCITY / TIME-BOUND (Day +7, morning) — Job: Name what specifically closes when. "Cart closes [INSERT_CART_CLOSE_DATE] at [INSERT_CART_CLOSE_TIME]." Preview what they'll lose access to. ANCHOR ON [INSERT_COHORT_LIMIT] + [INSERT_COHORT_CLOSE_DATE] (Sprint B — cohort/scarcity fabrication fix, new canonical operator-fill tokens) for any spot-count or cohort-close claim beyond the cart window — emit verbatim if not pre-supplied. URGENCY FALLBACK (ported from WhatsApp's SALES_DIRECT_OFFER_BLOCK pattern): If no genuine cohort limit or genuine secondary deadline beyond the cart window exists, use social-proof scarcity — "People who attended [INSERT_EVENT_NAME] and acted within 48 hours got [specific result]." Honest urgency from social proof, not fabricated cohort numbers. One social-proof moment (specific number of buyers, specific named transformation) — only if real, never fabricated. Primary CTA: buy now.

9. FINAL CALL / LAST HOURS (Day +7, final hours) — Job: Resolve the most important open loop from earlier in the sequence — the question or tension that has been building. "You've been wondering [specific question]. Here's the answer." Then make the choice binary: [specific outcome if they act today] versus [specific cost if they don't]. One CTA. Nothing else. The last email you'll send about this product. Direct, no hedging.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars, never descriptive)
- previewText: (extends the subject line — completes the thought or adds a second layer of intrigue, never repeats the subject, max 140 chars)
- body: (max 250 words, short sentences, line breaks between paragraphs)
- cta: (one specific action)
- ps: (mandatory — one sentence that creates urgency, reveals additional stakes, or hooks to the next email)

Return as a JSON object with an 'emails' key containing the array.`;
}

export function buildReengagementEmailPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 4-email re-engagement sequence for subscribers who've been inactive for [INSERT_LAST_ENGAGEMENT_TIMEFRAME], using the canonical Check-in → Value Reminder → Incentive → Last Chance structure.

Service: ${p.serviceName}
Target Customer: ${p.targetCustomer || ""}
Main Benefit: ${p.mainBenefit || ""}
Inactivity window: [INSERT_LAST_ENGAGEMENT_TIMEFRAME]
Re-engagement incentive: [INSERT_INCENTIVE]
Host: ${p.hostName || "[INSERT_HOST_NAME]"}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

HOST-NAME ANCHOR (Sprint B — host-name fabrication fix): Use [INSERT_HOST_NAME] (operator-fills) when the email needs to introduce, sign off, or self-reference. Never invent a host name. The first-person "I noticed..." check-in framing in Email 1 must anchor on this token — emit the host's literal name if supplied, [INSERT_HOST_NAME] verbatim if not. Do NOT default to a fabricated archetype name.

SEQUENCE GOAL: Win back genuinely re-interested subscribers OR honestly clean the list of those who've moved on. Both outcomes are wins. The 4 emails span 14 days. By Email 4, anyone who hasn't engaged should be removed from the active list — keeping a healthy list matters more than keeping a large one.

TONE — DESCENDS ACROSS THE 4: Email 1 is the warmest (genuine concern, no pressure). Email 2 stays warm but adds curiosity (value reminder). Email 3 shifts to generous-direct (specific offer). Email 4 is honest-direct, willing to be unsubscribed without guilt. Crucially: no pressure, no guilt language, no "don't leave us" pleading at any point.

ANCHOR PLACEHOLDERS: Use [INSERT_LAST_ENGAGEMENT_TIMEFRAME] for the inactivity window the operator chose to define (e.g., "the past 60 days", "since March"). Use [INSERT_INCENTIVE] for the specific re-engagement offer the operator picked — typical options for coaching/consulting: free strategy call, exclusive content drop, returning-subscriber bonus, or course discount. Do not invent these — emit the tokens verbatim.

PLACEHOLDER ALLOW-LIST (workstream commit 6 — sprint 3b+4b items #5 + #11 + #14, retroactive coverage of pre-existing re-engagement builder; Sprint B — HOST_NAME + PROGRAMME_DURATION canonicals added to anchor host identity in Email 1 check-in framing and any programme-length references in Email 3 incentive framing): The placeholders enumerated above plus [INSERT_HOST_NAME] and [INSERT_PROGRAMME_DURATION] are the COMPLETE set permitted. [INSERT_HOST_NAME] anchors the first-person check-in framing in Email 1 — never fabricate a host archetype name. [INSERT_PROGRAMME_DURATION] anchors any reference to total programme length (e.g. "12 weeks", "6 months") that may appear when [INSERT_INCENTIVE] references re-entry to a paid programme — distinct from [INSERT_BOOKING_DURATION] (call duration) and [INSERT_EVENT_DURATION] (event duration). Use these tokens when the email needs to introduce/sign-off or reference programme length; emit verbatim if the operator hasn't pre-filled. DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK]. Write actual content for any value not in the allow-list.

INTEGRITY RULE: No fake urgency. No "limited time" framing unless [INSERT_INCENTIVE] is genuinely time-bound. The honesty of Email 4 ("Should we stop emailing you?") is what makes the whole sequence work — fake urgency in earlier emails undermines that.

Create 4 emails.

1. GENUINE CHECK-IN (Day 0) — Job: Honest concern, no sales. Subject: personal-feeling, "Is everything okay, [First Name]?"-style. Opening: name the inactivity directly — "I noticed you haven't been opening emails lately." Acknowledge their priorities may have changed. Ask one open question. Offer one easy win to re-engage (a single piece of content, a quick reply prompt). Soft CTA: "reply with one word: stay or go." Warm, no pressure.

2. VALUE REMINDER (Day 2-3) — Job: Remind them of one consistent thing this list has delivered — the kind of value that brought subscribers in the first place. SUBSCRIBER-SPECIFIC FRAMING IS FORBIDDEN (Sprint B+2 — closes welcome-class fabrication risk): the LLM does NOT have access to the subscriber's actual engagement history. Do NOT fabricate "what THEY specifically engaged with," do NOT invent a specific past moment they participated in, do NOT reference a specific email/post/event they opened. Frame at the LIST level (what the list is about, what it consistently does, what brought subscribers in), NOT at the subscriber-specific level. Sprint B+2-fix BROADENED NO-FABRICATION RULE — DELIVERABLE-ASSET CLAIMS (ported from welcome email 1; closes cross-builder fabrication observed in spot-check where this email invented "the free guide: '7 Identity Red Flags That Reveal You're Living for Everyone But Yourself'" + "Red Flag #4 is the one most women say made them stop scrolling"): the "high-value content as a reactivation hook" must reference a generic content category at the LIST level (a recent post, a podcast episode, a case study you sent, a thread in the archive), NOT a named deliverable. Do NOT name a specific guide, workbook, ebook, or course. Do NOT invent its title. Do NOT invent its structure (numbered points, named flags, chapters, principles, sections). Do NOT claim what specific items inside it produce in readers. If the operator wants to anchor on a specific named deliverable, they post-edit before sending. Write at the level "here's what I wrote about last week that fits this exact moment for you" without fabricating the specific piece. Subject: past-anchored framing about the list ("the [topic] thing I keep coming back to" / "still the most useful [niche-specific category] I've sent" / similar) rather than subscriber-specific framing like "Remember when you...". Body: remind them of consistent past value the list has delivered, share what's new since they were last active, offer one generic-category piece of high-value content as a reactivation hook. Soft CTA: explore the new content. Curious, generous tone.

3. INCENTIVE / BRIDGE (Day 5-7) — Job: Make a specific offer to bring them back. Subject: direct framing — "[INSERT_INCENTIVE]" or "Something I'd like to give you." Body: name [INSERT_INCENTIVE] explicitly (the operator fills in what it is). ANCHORING RULE: state the value before the ask. Generous tone with light, honest urgency if [INSERT_INCENTIVE] genuinely is time-bound. Primary CTA: claim the offer / book the call / download the resource.

4. HONEST LAST CHANCE (Day 10-14) — Job: Direct binary close. Subject: "Should we stop emailing you?" Opening: "I'd rather you unsubscribe than ignore my emails — both are okay." Body: name what they'll miss if they leave (without guilt), make staying as easy as one click. Two clear options: one click to stay, one click to unsubscribe. Honest, direct, willing to lose them. No "we'll miss you so much" language. Cleaning the list is the win if they don't respond.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars, never descriptive)
- previewText: (extends the subject line — completes the thought or adds a second layer of intrigue, never repeats the subject, max 140 chars)
- body: (max 150 words, short sentences, line breaks between paragraphs)
- cta: (one specific action — or for Email 4, two binary actions)
- ps: (mandatory — one sentence that adds context, hooks to the next email, or in Email 4 reinforces the no-guilt frame)

Return as a JSON object with an 'emails' key containing the array.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Workstream commit 3b — 4 net-new sequence types extending the dispatcher
// from 6 to 10. Locked architectures from the pre-flight design pass:
//   - discovery_call_confirmation: 1 transactional email post-booking.
//     Anchored to bookingUrl + eventTime + eventTimezone + eventDuration
//     + hostName. Word cap 150.
//   - discovery_call_reminder: 3 emails (T-24h, T-2h, T-15min). Drives
//     show-up + catches reschedules. Anchored to bookingUrl + eventTime
//     + eventTimezone. Word cap 100.
//   - event_logistics: 4 emails (Day -7, -3, -1, +1). Practical info for
//     in-person events — venue / parking / agenda / day-of arrival.
//     Anchored to eventVenue + eventAgenda + eventDate + eventTime
//     + eventTimezone + eventDuration. Word cap 200.
//   - replay_for_no_shows: 3 emails (Day +1, +3, +5/+7). Post-event
//     replay distribution to no-shows. Anchored to replayUrl + eventName.
//     Word cap 175.
// All four use [INSERT_*] operator placeholders for fields not passed via
// eventDetails (Decision-C pattern). PlaceholderBanner self-detection at
// V2EmailSequenceResultPanel.tsx already covers any new tokens via the
// generic /\[INSERT_[A-Z][A-Z0-9_]*\]/g regex — no banner code change.
// All four are tier-agnostic. Free-tier gating remains at the wizard-
// render level (PRO_GATED_STEPS includes emailSequence).
// ───────────────────────────────────────────────────────────────────────────

export function buildDiscoveryCallConfirmationPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 1-email discovery-call confirmation, sent immediately after a prospect books a 1:1 call. This is a transactional-but-personal email that confirms the booking, sets expectations for the call, and drives show-up.

Service: ${p.serviceName}
Host: ${p.hostName || "[INSERT_HOST_NAME]"}
Booking time: ${p.eventTime || "[INSERT_BOOKING_TIME]"} (${p.eventTimezone || "[INSERT_BOOKING_TIMEZONE]"})
Call duration: ${p.eventDuration || "[INSERT_BOOKING_DURATION]"}
Booking URL (for reschedule): ${p.bookingUrl || "[INSERT_BOOKING_URL]"}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

SEQUENCE GOAL: Reduce no-shows. The reader has already committed to a 1:1 call — this email cements that commitment without selling anything new. By the end of this email, the reader should feel: confirmed, prepared, looking forward to the call. They should NOT feel pitched, sold-to, or that the call will be a sales call.

TONE: Warm, professionally personal, transactional-but-friendly. Same register as a confirmation from a thoughtful service provider — not a sales sequence. No urgency, no pitch, no upsell. The CALL is the pitch; this email is the door-holding moment.

VOICE CONVENTION LOCK (workstream commit 4c — sprint 3b backlog item #1): First-person singular throughout. The host is "I" / "me" / "my". Sign-off uses the host name. Do not switch between third-person ("Arfeen will see you") and first-person ("I'll see you") — pick first-person and stay there.

FIELD SUBSTITUTION CONVENTION (workstream commit 4c — sprint 3b backlog item #3): When a field above (Booking time, Booking URL, etc.) is provided as a literal value (e.g., "3:00 PM"), use that literal value verbatim in the body. When the field above is provided as an [INSERT_*] placeholder, emit the placeholder verbatim in the body. Never paraphrase a literal value, never substitute different content for an [INSERT_*] placeholder.

ANCHOR PLACEHOLDERS: Use [INSERT_BOOKING_TIME] for the call time, [INSERT_BOOKING_TIMEZONE] for the timezone, [INSERT_BOOKING_DURATION] for the duration, [INSERT_BOOKING_URL] for the reschedule link, and [INSERT_HOST_NAME] for the host. Operator fills these in before sending. Do not invent times, zones, durations, URLs, or names — emit the tokens verbatim.

PLACEHOLDER ALLOW-LIST (workstream commit 6 — sprint 3b+4b items #5 + #11 + #14): The placeholders enumerated above are the COMPLETE set of [INSERT_*] tokens permitted in this builder. DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use canonical [INSERT_BOOKING_URL]). Write actual content for any value not in the allow-list.

Create 1 email.

1. CONFIRMATION (Day 0, immediate post-booking) — Job: Confirm the booking. Open by restating the booking time + timezone clearly (mobile-readable). One sentence on what the reader will get from the 30 minutes — make it about THEM, not about you. Acknowledge the reschedule link is there if life happens. End warm but professional. PS: one specific question they can think about before the call to make the conversation more useful — not a sales question, a discovery question rooted in the niche.

The email must include:
- subject: (personal-feeling confirmation, max 50 chars — NOT "Booking confirmed" / "Your call is scheduled")
- previewText: (extends the subject — confirms the time without repeating "confirmed", max 140 chars)
- body: (max 150 words, short sentences, mobile-friendly, includes the booking time + reschedule link verbatim)
- cta: ("Add to calendar" or "Reschedule if needed" — one specific action)
- ps: (mandatory — one specific question to anchor the call's value, niche-specific)

Return as a JSON object with an 'emails' key containing the array.`;
}

export function buildDiscoveryCallReminderPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 3-email discovery-call reminder sequence — T-24h, T-2h, T-15min before a booked 1:1 call. This sequence prevents no-shows by progressively building reminder cadence and catching last-minute reschedules.

Service: ${p.serviceName}
Host: ${p.hostName || "[INSERT_HOST_NAME]"}
Booking time: ${p.eventTime || "[INSERT_BOOKING_TIME]"} (${p.eventTimezone || "[INSERT_BOOKING_TIMEZONE]"})
Booking URL (for reschedule): ${p.bookingUrl || "[INSERT_BOOKING_URL]"}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

SEQUENCE GOAL: Drive show-up. Industry baseline for 1:1 booked calls is ~30% no-show rate; a tight reminder sequence brings that to 10-15%. Each email has one job — the reader must see something specific that pulls them toward the call rather than letting it slip past.

TONE — INTENSITY ASCENDS:
Email 1 (T-24h): friendly reminder, low pressure, confirms timing.
Email 2 (T-2h): day-of practical, slightly more energetic.
Email 3 (T-15min): imminent, action-focused, link-prominent.
NEVER apologetic ("sorry to bother you again") — these are useful nudges, not interruptions. NEVER guilt-laden ("don't bail on me") — respectful adult tone.

VOICE CONVENTION LOCK (workstream commit 4c — sprint 3b backlog item #1): First-person singular throughout. The host is "I" / "me". Sign-off uses host name in all 3 emails (or no sign-off if email ends with the link). Do not drift to third-person ("Arfeen will be there") or first-person plural ("we'll be there") — first-person singular only, all 3 emails. This explicitly addresses the 3b Attempt 2 drift where messages cycled third-person → first-person plural → first-person singular.

FIELD SUBSTITUTION CONVENTION (workstream commit 4c — sprint 3b backlog item #3): When a field above (Booking time, Booking URL, etc.) is provided as a literal value, use that literal value verbatim in every email's body. When provided as an [INSERT_*] placeholder, emit the placeholder verbatim. Consistent across all 3 emails — no coin-flip behavior between substituting and leaving placeholder.

ANCHOR PLACEHOLDERS: Use [INSERT_BOOKING_TIME] for the call time, [INSERT_BOOKING_TIMEZONE] for the timezone, [INSERT_BOOKING_URL] for the reschedule link, and [INSERT_HOST_NAME] for the host. Operator fills these in. Do not invent.

PLACEHOLDER ALLOW-LIST (workstream commit 6 — sprint 3b+4b items #5 + #11 + #14): The placeholders enumerated above are the COMPLETE set permitted in this builder. DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use canonical [INSERT_BOOKING_URL]). Write actual content for any value not in the allow-list.

Create 3 emails.

1. T-24H REMINDER (Day -1) — Job: Friendly reminder. Open with confirmation of the call time + timezone. Soft tech check (zoom link auto-arrives in calendar invite). One specific outcome the reader should think about before the call — same anchor question as the confirmation email's PS, restated. End with reschedule link if life shifts. Mobile-short.

2. T-2H REMINDER (Day 0, 2 hours before) — Job: Day-of practical. Open with "We're talking in 2 hours" + restated time + zone. Quick "make sure you have the calendar invite handy" practical note. Optional: name one thing you'll cover in the call (anchored to the PS question from email 1). Reschedule link if absolutely needed but tone discourages it ("if something just came up, here's the link"). Confirm-style energy.

3. T-15MIN IMMINENT (Day 0, 15 minutes before) — Job: Show up now. Open with "Starting in 15 minutes". One sentence: "I'll be there." The booking URL or zoom link verbatim. NOTHING else — this is a one-tap reminder. PS optional but if present, single sentence, action-oriented.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars — NOT "Reminder: your call" / "Don't forget our meeting")
- previewText: (extends the subject — completes the thought, max 140 chars)
- body: (max 100 words — short, mobile, action-oriented; line breaks between paragraphs)
- cta: (one specific action — "Add to calendar" / "Reschedule" / "Join now")
- ps: (mandatory — one sentence; for email 1 = anchor question, for email 2 = soft tech note, for email 3 = action confirm)

Return as a JSON object with an 'emails' key containing the array.`;
}

export function buildEventLogisticsPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 4-email event logistics sequence for an in-person event — Day -7, Day -3, Day -1, and Day +1 follow-up. Practical info delivery (venue / parking / agenda / day-of arrival) with a thank-you + recap close.

Service: ${p.serviceName}
Event: ${p.eventName || "[INSERT_EVENT_NAME]"}
Host: ${p.hostName || "[INSERT_HOST_NAME]"}
Event date: ${p.eventDate || "[INSERT_EVENT_DATE]"}
Event time: ${p.eventTime || "[INSERT_EVENT_TIME]"} (${p.eventTimezone || "[INSERT_EVENT_TIMEZONE]"})
Event duration: ${p.eventDuration || "[INSERT_EVENT_DURATION]"}
Venue: ${p.eventVenue || "[INSERT_EVENT_VENUE]"}
Agenda: ${p.eventAgenda || "[INSERT_EVENT_AGENDA]"}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

SEQUENCE GOAL: Deliver practical info that makes attendees feel prepared and welcome. By Day -1 every reader should know: where to go, when to arrive, what to bring, how to dress, where to park. Day +1 closes the loop with a thank-you + concrete next step.

TONE: Event-host-helper. Practical, warm, concrete, host-of-a-good-gathering register. Not salesy — this is delivering on a commitment, not pitching. Use specific details over generic phrases ("park in the lot behind the building, entrance on Maple Street" beats "easy parking available").

VOICE CONVENTION LOCK (workstream commit 4c — sprint 3b backlog item #1): First-person singular throughout all 4 emails. The host is "I" / "me" / "my". Sign-off uses host name. Do not drift to third-person or first-person plural — first-person singular only, all 4 emails.

FIELD SUBSTITUTION CONVENTION (workstream commit 4c — sprint 3b backlog item #3): When a field above is provided as a literal value, use it verbatim across all 4 emails. When provided as an [INSERT_*] placeholder, emit the placeholder verbatim. Consistent — no coin-flip between substituting and placeholder.

ANCHOR PLACEHOLDERS: Use [INSERT_EVENT_VENUE], [INSERT_EVENT_AGENDA], [INSERT_EVENT_DATE], [INSERT_EVENT_TIME], [INSERT_EVENT_TIMEZONE], [INSERT_EVENT_DURATION], [INSERT_EVENT_NAME], [INSERT_HOST_NAME] for fields the operator pre-supplies. For optional practical fields not in our schema, use [INSERT_PARKING_INFO], [INSERT_DRESS_CODE], [INSERT_WHAT_TO_BRING], [INSERT_ROOM_OR_FLOOR_INFO], [INSERT_HOST_CONTACT_OR_ASSISTANT_EMAIL] — operator fills these in. Do not invent venue addresses, parking lots, dress codes, or items to bring.

PLACEHOLDER ALLOW-LIST (workstream commit 4c — sprint 3b+4b backlog items #5 + #11; Bucket 3 BOOKING_TIME drift fix from commit 6 spot-check 2; Sprint B PROGRAMME_DURATION addition for Day +1 follow-up references to "the program"): The placeholders enumerated above plus [INSERT_PROGRAMME_DURATION] are the COMPLETE set of [INSERT_*] tokens permitted in this builder. [INSERT_PROGRAMME_DURATION] is the canonical operator-fill for total programme length (e.g. "12 weeks", "6 months") — distinct from [INSERT_BOOKING_DURATION] (call duration) and [INSERT_EVENT_DURATION] (event duration). Use it whenever the Day +1 follow-up email's CTA references how long a paid programme runs; emit verbatim if the operator hasn't pre-filled. Do NOT invent durations like "six months of 1:1 work" — pick the token, let the operator resolve. You MAY emit additional [INSERT_X_Y] tokens ONLY for operator-discretion data fields the operator must pre-fill before sending (room number, host contact, dietary notes, accessibility info — fields the operator would type into a configuration screen). DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_EVENT_MOMENT], [INSERT_SPECIFIC_OUTCOME], [INSERT_BOOKING_TIME], [INSERT_BOOKING_TIMEZONE] (use canonical [INSERT_EVENT_TIME] / [INSERT_EVENT_TIMEZONE] for event start time — BOOKING_* tokens are for 1:1 call scheduling, not in-person events). If uncertain whether a value is operator-supplied or LLM-generated, default to LLM-generated and write the actual content rather than emit a placeholder.

Create 4 emails.

1. WELCOME + BIG PICTURE (Day -7) — Job: Confirm attendance, paint the room. Open with "You're confirmed for [INSERT_EVENT_NAME]" + restate date / time / city. One paragraph on what they'll experience — the energy, the people, the kind of conversations that happen. Soft preview of the agenda (high-level, not detailed). Close with "Detailed logistics coming Day -3." PS: anticipatory — one specific moment from a past event worth looking forward to.

2. DETAILED LOGISTICS (Day -3) — Job: Practical info dump done well. Lead with venue address ([INSERT_EVENT_VENUE]) + how to get there. Parking ([INSERT_PARKING_INFO]). Dress code ([INSERT_DRESS_CODE]). What to bring ([INSERT_WHAT_TO_BRING]). Dietary notes if relevant. Full agenda ([INSERT_EVENT_AGENDA]). Each item gets one short paragraph — scannable, mobile-friendly. PS: encouragement, "looking forward to it" energy.

3. FINAL REMINDER (Day -1) — Job: Day-of arrival info. Open with "See you tomorrow" + time + venue. Short list: when to arrive (15 min early), where to check in, what room/floor. Contact for last-minute issues (host phone or assistant email). Single sentence on energy: "Come ready to [verb]." PS: one specific thing they should bring or think about before walking in.

4. THANK YOU + RECAP (Day +1, post-event) — Job: Close the loop. Open with thanks specific to what happened in the room — name one moment, one quote, one shift. Acknowledge their presence mattered. Concrete next step: the campaign's broader CTA (book a call, join the program, sign up for the next thing). NOT a hard pitch — a natural follow-on for someone who showed up. PS: one specific thing the event surfaced that they can apply this week.

EMAIL 4 STRICT RULES (workstream commit 4c — sprint 3b backlog items #4 + #7):
- WORD CAP: 200 words STRICT. Count carefully; trim adverbs and parenthetical asides if approaching cap. Item #4 fix.
- BANNED PHRASES (item #7 fix): "Cohort places are limited", "apply now rather than later", "spots filling fast", "limited spots", "before this cohort closes", "doors closing", any urgency / scarcity language. Day +1 is INFORMATIONAL, not URGENT. Operator-side urgency lives at the CTA destination page, not in this email. The next-step mention is a single concrete sentence with the CTA, no urgency framing.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars — NOT "Event logistics" / "Important info about [event]")
- previewText: (extends the subject — completes the thought, max 140 chars)
- body: (max 200 words; practical, scannable, mobile-friendly; line breaks between paragraphs)
- cta: (one specific action — "Add to calendar" / "Confirm RSVP" / "Book your follow-up call" depending on email)
- ps: (mandatory — one sentence; specific, anticipatory or actionable)

Return as a JSON object with an 'emails' key containing the array.`;
}

// Workstream commit 4c — sprint 3b backlog item #6 resolution: the
// soft-last-reminder-without-expiry framing is INTENTIONAL DESIGN, not a
// bug. When [INSERT_REPLAY_EXPIRY] is not supplied, the builder explicitly
// instructs email 3 to use "I won't keep sending these" honest-close framing
// instead of fabricating expiry urgency. Verified against locked design
// from sprint 3b pre-flight section 10. Backlog item #6 closed as
// "intentional, not a bug."
export function buildReplayForNoShowsPrompt(p: EmailPromptParams): string {
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert email marketer. Create a 3-email replay-for-no-shows sequence — Day +1, Day +3, Day +5 (or +7) post-event. Distributes the replay to registrants who didn't attend live, with respectful no-shaming framing.

Service: ${p.serviceName}
Event: ${p.eventName || "[INSERT_EVENT_NAME]"}
Host: ${p.hostName || "[INSERT_HOST_NAME]"}
Replay URL: ${p.replayUrl || "[INSERT_REPLAY_URL]"}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

SEQUENCE GOAL: Re-extend value to no-shows who still hold attention. Drive replay views — replays are the actual lever for delayed conversion. By email 3, anyone who hasn't watched should either watch or self-select out without bad feelings on either side.

TONE — RESPECTFUL THROUGHOUT: No shaming. No "you missed out" guilt language. No "we worked hard on this" pity. Acknowledge they had a real reason to miss (work / life / time-zone / forgot — all legit). Lead with value re-extension, not chastisement. Crucially: never pretend they are now somehow behind everyone else — that's manipulative.

VOICE CONVENTION LOCK (workstream commit 4c — sprint 3b backlog item #1; Sprint B+2-fix-6 — strengthened with explicit host-name third-person forbiddance + body↔signature coherence requirement after F-CC surfaced "Arfeen recorded the whole thing, and the replay is ready for you now" body↔signature voice mismatch in email 1; same field-pair-coherence problem class as Sprint B+2-fix-4 Obs 3 engagement subject↔body, ported to replay's body↔signature pair): First-person singular throughout all 3 emails. The host speaks as "I" / "me" / "my" across body prose. Sign-off uses host name. Do not drift to first-person plural ("we") or third-person — first-person singular only. EXPLICIT FORBIDDANCE — HOST-NAME-AS-THIRD-PERSON: do NOT refer to [INSERT_HOST_NAME] (or the supplied hostName field's literal value) in third person inside body prose. Forbidden patterns: "Arfeen recorded", "Sarah walked through", "[INSERT_HOST_NAME]'s approach", "the host explained" — any prose treating the host as a third-person referent the reader is being told ABOUT. The host's name appears ONLY in the sign-off / signature, never in body text. Body sentences referring to the host's actions use first-person ("I recorded", "I walked through", "my approach"), never the hostName as a third-person referent. BODY↔SIGNATURE COHERENCE: the body opens, transitions, and closes in first-person; the signature signs off as the same first-person speaker. The reader must perceive a single first-person voice from the first body sentence through the signature — no shift between "the host did X" framing and "I did X" framing within the same email.

FIELD SUBSTITUTION CONVENTION (workstream commit 4c — sprint 3b backlog item #3): When a field above is provided as a literal value, use it verbatim across all 3 emails. When provided as an [INSERT_*] placeholder, emit the placeholder verbatim. Consistent — no coin-flip behavior.

ANCHOR PLACEHOLDERS: Use [INSERT_REPLAY_URL] for the replay link, [INSERT_EVENT_NAME] for the event name, [INSERT_HOST_NAME] for the host. For replay-window framing, use [INSERT_REPLAY_EXPIRY] when the operator supplies a real expiry date — DO NOT invent expiry dates. For replay-audience framing (e.g., live attendees only / all registrants / publicly available), use [INSERT_REPLAY_AVAILABILITY] when the operator supplies it; omit otherwise.

NO-FABRICATION RULE — REPLAY EVENT (Sprint B+2-fix lineage: -fix Path B revert from JSON-shape regression at b4f2fb4; -fix-2 added MOMENT_5 for email 3 site coverage; -fix-3 broadened to MECHANICS category + "examples include" framing; -fix-4 added ATTENDEES/PERSONAS category + MOMENT-TOKEN SCAFFOLDING RULE; -fix-5 added OFFER/CTA LANGUAGE category + NON-TOKEN PROSE CONSTRAINT after F-BB surfaced "risk-free spot" guarantee fabrication in email 3 CTA — the first failure surface NOT around a MOMENT token, at the CTA layer; lesson — LLM finds the next-untouched fabrication surface each round, including non-token prose slots): broad principle — the LLM does NOT have access to the actual content of the event, its mechanics, who attended it, OR what offer is associated with it. Do NOT make ANY claim about the event or the offer behind it that the operator has not supplied via the data block above or anchored via canonical token. Four categories covered: (1) CONTENT — what happened inside the event, what the host said or did, topics addressed, frameworks discussed, stories told live, specific moments, timestamps, quotes; (2) MECHANICS — duration, format, participant count, registration figures, retention statistics, attendance type; (3) ATTENDEES / PERSONAS — named individuals (real or composite), archetype names ("Claire", "Sarah", "Jane"), persona references implying known cohort members ("women in Claire's position", "people like Sarah"), aggregate attendee claims ("most women say", "X% of viewers", "attendees reported"), social-proof statistics about replay viewers or event attendees, any framing that implies the reader should recognise an unnamed referent; (4) OFFER / CTA LANGUAGE — guarantee terms ("risk-free", "money-back", "30-day refund", "satisfaction guaranteed"), refund policies, scarcity claims about offer slots ("limited spots", "closing soon", "doors close"), sales-page-style CTA extrapolation ("claim your spot", "enroll today", "lock in your place", "reserve your seat"), promotional pricing references, payment-plan claims, any framing that implies a paid offer behind the replay beyond what the operator has supplied. The replay sequence is REPLAY DISTRIBUTION, not an offer pitch — its CTA is the replay link, not a sales link. The canonical [INSERT_GUARANTEE_TERMS] is allow-listed for sales + launch sequences only and is NOT permitted in replay; do NOT use it here. Examples of forbidden phrasings include but are not limited to: "There's a moment in the replay where I walk through X", "I covered Y", "we got into Z", "this is 90 minutes that works on...", "a 2-hour deep dive", "particularly worth 90 minutes of your time", "X people attended live", "this was a live workshop / masterclass / training", "most women in Claire's position", "attendees reported Y", "Sarah found this transformational", "people like you said Z", "claim your risk-free spot", "money-back guarantee", "limited spots remaining", "lock in your place", "enroll today", "reserve your seat below" — any inference about content, mechanics, attendees, personas, or offer not anchored in supplied data. Reference moments via five canonical operator-fill tokens — [INSERT_REPLAY_MOMENT_1], [INSERT_REPLAY_MOMENT_2], [INSERT_REPLAY_MOMENT_3], [INSERT_REPLAY_MOMENT_4], [INSERT_REPLAY_MOMENT_5]. Emit each token verbatim where a specific moment would go. MOMENT-TOKEN SCAFFOLDING RULE: when emitting any [INSERT_REPLAY_MOMENT_N] token, surround it with minimal scaffolding ONLY — a brief framing phrase that names the moment-slot's purpose ("worth jumping to", "second moment worth catching", "final value-tease") and the token itself. Do NOT add testimonials, named individuals, persona references, aggregate claims about other attendees, offer language, or any prose that gives the moment social-proof or sales-pitch weight beyond what the token alone communicates. The token + framing phrase = entire moment slot. Example of correct minimal scaffolding: "PS — also worth jumping to: [INSERT_REPLAY_MOMENT_2]." NOT: "PS — also worth jumping to: [INSERT_REPLAY_MOMENT_2]. Most women in Claire's position say that's the one that stopped them." NON-TOKEN PROSE CONSTRAINT (Sprint B+2-fix-5 — covers prose slots that are NOT directly emitting a canonical token, e.g. CTAs, opening lines, transitions, PS framing, "no pressure" closes; F-BB surfaced fabrication at the CTA layer where no MOMENT token was adjacent to scaffold against): any email prose not directly emitting an [INSERT_*] token is also subject to the 4-category rule above. Do NOT add offer language, guarantee references, scarcity claims, named individuals, persona references, aggregate-attendee claims, or any inference about content / mechanics / attendees / offer not anchored in supplied data. The CTA is a link emission, not a pitch; PS slots and opening lines stay reader-side and event-name-only. For event mechanics (duration, format, participant count): if the operator has not supplied them via the data block, OMIT mechanics framing entirely. The operator post-edits each token and adds any genuine mechanics / attendee / offer references they want before sending.

PLACEHOLDER ALLOW-LIST (workstream commit 4c — sprint 3b+4b backlog items #5 + #11; Sprint B+2-fix — added 4 REPLAY_MOMENT canonicals to replace the bracket-operator-prompt pattern that triggered the JSON-shape regression class; Sprint B+2-fix-2 — extended to 5 canonicals after F-Y surfaced same fabrication class in email 3 value-tease site that was out of B+2-fix scope): The placeholders enumerated above plus [INSERT_REPLAY_MOMENT_1], [INSERT_REPLAY_MOMENT_2], [INSERT_REPLAY_MOMENT_3], [INSERT_REPLAY_MOMENT_4], [INSERT_REPLAY_MOMENT_5] are the COMPLETE set of [INSERT_*] tokens permitted. The five REPLAY_MOMENT tokens anchor specific event moments referenced across email 1 (body + PS — _MOMENT_1 + _MOMENT_2), email 2 (two body moments — _MOMENT_3 + _MOMENT_4), and email 3 (final value-tease — _MOMENT_5). Each token is a canonical operator-fill — emit verbatim, the operator post-edits with the real moment before sending. DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_SPECIFIC_OUTCOME]. Write actual content for any value not in the allow-list.

INTEGRITY RULE: Only frame the replay as time-bound if [INSERT_REPLAY_EXPIRY] is genuinely supplied AND that expiry is real. If no real expiry exists, the third email softens to a "last reminder" frame without fake scarcity. Fake replay-expiry destroys trust faster than letting the email be slightly less urgent.

Create 3 emails.

1. HERE'S THE REPLAY (Day +1) — Job: Drop the replay link prominently with one specific moment worth jumping to. OPENER SLOT (Sprint B+2-fix-7 — converts open-prose 'Open with neutral framing' permission into a constrained slot spec after F-DD lineage showed open-prose slots accumulate fabrication categories): first sentence is a near-verbatim opener naming [INSERT_EVENT_NAME] and the replay availability — pattern "Sharing the [INSERT_EVENT_NAME] replay — figured you'd want it whether you made it or not." or close paraphrase of identical structure (event-name + replay-availability, nothing more). Do NOT extend the opener with treatment claims ("the replay speaks to X", "this addresses Y as Z"), host-action claims ("Arfeen recorded", "the host walked through Y"), or social-proof framing ("most women found this..."). The opener is event-name + availability ONLY. BODY: emit [INSERT_REPLAY_MOMENT_1] verbatim where the moment would go (operator post-edits). CTA: [INSERT_REPLAY_URL] verbatim, replay-anchored copy ("watch the replay" / "catch the recording" / link itself), never offer-anchored. PS SLOT: emit [INSERT_REPLAY_MOMENT_2] with minimal scaffolding — pattern "PS — also worth jumping to: [INSERT_REPLAY_MOMENT_2]." or close paraphrase. Operator post-edits with a second moment, different angle from body. No surrounding prose beyond the minimal scaffolding phrase.

2. DID YOU WATCH? (Day +3) — Job: Soft nudge for those who didn't open Email 1. OPENER SLOT (Sprint B+2-fix-7 — converts open-prose 'Open direct, friendly, no guilt' permission into a constrained slot spec): first sentence is a near-verbatim opener — pattern "Did you get a chance to watch the replay yet?" or close paraphrase of identical structure (direct check-in question, no guilt). Do NOT extend the opener with treatment claims, host-action claims, attendee claims, or social-proof framing. BODY: emit [INSERT_REPLAY_MOMENT_3] and [INSERT_REPLAY_MOMENT_4] verbatim where the two body moments would go — operator fills with two moments different from email 1's. End body with one question inviting a reply (e.g. "which moment resonated?" / "anything you want me to clarify?" — reader-side question, not event-content claim). CTA: [INSERT_REPLAY_URL] verbatim, replay-anchored copy never offer-anchored. PS SLOT (Sprint B+2-fix-7 — F-DD closure; converts the prior 'one specific way the event applies' open-prose permission that the LLM filled with "the replay speaks to X — not as concept but as pattern with traceable cause" treatment-claim fabrication into a constrained reader-side-only slot): single sentence, reader-side ONLY. Format options: (1) a question to the reader about their specific situation in the niche — one direct second-person question ending in a question mark, anchored on the reader's recurring experience; or (2) a niche-specific second-person observation about the reader's situation — opens with "I notice" or "You know that moment when" and continues with something concrete about the reader's recurring experience. The PS speaks to the reader's situation, NEVER about the event. Forbidden: any claim about how the replay treats / addresses / approaches / frames the topic ("the replay speaks to X", "this addresses Y as Z", "not as concept — as pattern", "this isn't about Y, it's about Z"), any claim about the replay's methodology / treatment / framing, any aggregate-reader claim ("most women in your position", "most attendees report"). The PS is reader-side ONLY — the reader's situation, not the event.

3. LAST REMINDER (Day +5 or +7) — Job: Final value-tease + honest close. OPENER SLOT (Sprint B+2-fix-7 — converts conditional open-prose opener permission into a constrained slot spec): first sentence is conditional on [INSERT_REPLAY_EXPIRY] presence — if supplied, opener is near-verbatim "The replay closes [INSERT_REPLAY_EXPIRY] — one last note before then." or close paraphrase; if not supplied, opener is near-verbatim "I won't keep sending these, but here's one last thing." or close paraphrase. Do NOT extend the opener with event-content / treatment / attendee / offer claims. BODY: emit [INSERT_REPLAY_MOMENT_5] verbatim where the final value-tease moment would go — operator post-edits with one final moment most likely to land for this reader's situation, distinct from emails 1+2's moments. Do NOT invent a moment, host action ("There's a moment where I walk through X"), or claim about what specific topics the host addressed inside the event. CTA SLOT: [INSERT_REPLAY_URL] ONLY. The CTA promotes the REPLAY, not the product or offer behind it. Sprint B+2-fix-5 forbids: do NOT add offer language, sales-page extrapolation, guarantee references ("risk-free", "money-back", "30-day refund"), scarcity claims about offer slots ("limited spots", "claim your spot"), or promotional framing. CTA copy is replay-anchored ("watch the replay", "catch the recording", or the link itself), NEVER offer-anchored. PS SLOT (Sprint B+2-fix-7 — converts open-prose 'no pressure close' permission into a constrained slot spec): single sentence in honest-direct close register. Format options: (1) clean unsubscribe-acknowledgement — "No pressure either way." or "If now's not the moment, that's okay — clean inboxes matter." or close paraphrase; (2) reader-side niche-specific honest close — "If something in this resonates, you know where to find it. If not, no worries." or close paraphrase. Do NOT add offer language, guarantee references, named individuals, persona references, aggregate-attendee claims, or claims about how the replay treats / addresses / frames the topic. The PS is honest-direct close ONLY — speaks to the reader, never about the event.

Each email must include:
- subject: (curiosity or pattern-interrupt, max 50 chars — NOT "Replay available" / "You missed it but..." / "Here's the recording")
- previewText: (extends the subject — completes the thought, max 140 chars)
- body: (max 175 words; specific moments named, mobile-friendly, line breaks between paragraphs)
- cta: (one specific action — replay link)
- ps: (mandatory — one sentence; specific moment, niche application, or honest close)

Return as a JSON object with an 'emails' key containing the array.`;
}

// ---------------------------------------------------------------------------
// Email LLM call + retry helper. Sonnet 4.6 intermittently returns the
// `emails` field as a non-array shape (object-with-numeric-keys, stringified
// array, null) despite the tool-use schema declaring it `required: array`.
// Production evidence Apr 30: ~50% failure rate on the welcome sequence
// schema across 4 attempts (2 fail / 2 succeed). Retry up to 3 times on
// validation failure; capture shape evidence on each failure for diagnosis;
// on final failure throw with the captured context. Mirror of
// landingPageGenerator's LP_SCHEMA_RETRY_MAX_ATTEMPTS pattern.
// ---------------------------------------------------------------------------

const EMAIL_RETRY_MAX_ATTEMPTS = 3;

const EMAIL_SEQUENCE_SYSTEM_PROMPT =
  "You are an expert email marketer specializing in high-converting email sequences for coaches, speakers, and consultants. You apply the ONE EMAIL ONE JOB principle — every email has a single clear job and the entire email serves only that job. You write curiosity-driven, pattern-interrupt subject lines that are never descriptive. You write short sentences (max 15 words), short paragraphs (max 2 sentences), with line breaks between paragraphs. Every email ends with a mandatory PS that creates curiosity or urgency. Use Russell Brunson's Soap Opera Sequence framework. Always respond with valid JSON.\n\n" +
  "CRITICAL OUTPUT FORMAT: The tool input's 'emails' field is an array of email objects. Each email object has the keys day, subject, previewText, body, cta, ps. Emit each email as a structured object directly — populate the array with objects, do not wrap them in any container.\n\n" +
  NO_DATE_FABRICATION_RULE;

const EMAIL_SEQUENCE_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "email_sequence",
    strict: true,
    schema: {
      type: "object",
      properties: {
        emails: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "integer" },
              subject: { type: "string" },
              previewText: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" },
              ps: { type: "string" },
            },
            required: ["day", "subject", "previewText", "body", "cta", "ps"],
            additionalProperties: false,
          },
        },
      },
      required: ["emails"],
      additionalProperties: false,
    },
  },
};

interface RawEmail {
  day?: number;
  subject?: string;
  previewText?: string;
  body?: string;
  cta?: string;
  ps?: string;
}

async function invokeEmailSequenceWithRetry(userPrompt: string): Promise<RawEmail[]> {
  let lastFailureContext: string | null = null;
  for (let attempt = 1; attempt <= EMAIL_RETRY_MAX_ATTEMPTS; attempt++) {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: EMAIL_SEQUENCE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: EMAIL_SEQUENCE_RESPONSE_FORMAT,
    });
    const content = response.choices[0].message.content;
    if (typeof content !== "string") throw new Error("Invalid response format from AI");
    let parsed = JSON.parse(stripMarkdownJson(content));
    if (Array.isArray(parsed)) parsed = { emails: parsed };
    // Defensive un-stringify (Sprint B regression fix): Sonnet 4.6 sometimes
    // returns the `emails` field as a JSON-encoded string ("[{...}]") rather
    // than a literal array, despite strict json_schema declaring array. Try
    // to un-stringify before declaring failure — content is valid, only the
    // wrapping shape is wrong, so this recovers the response without a retry.
    //
    // Sprint B+1 regression-fix v1: Sonnet 4.6 also emits Python-dict-style
    // single-quote object literals ("[{ 'day': 1, 'subject': '...' }]") when
    // prompt size grows past Sprint B+1's PROOF_COMPOSITIONAL_CEILING_RULE
    // additions. Plain JSON.parse fails on single quotes; recover via guarded
    // property-name + value-string conversion. Guard requires the string to
    // LOOK like a single-quoted dict (starts with [{ or { and contains a
    // single-quoted word-char key) before converting — avoids touching
    // strings that happen to contain apostrophes for unrelated reasons.
    if (typeof parsed?.emails === "string") {
      const raw = parsed.emails as string;
      try {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) parsed.emails = v;
      } catch {
        const looksLikePyDict = /^\s*[\[{].*?'[a-zA-Z_]\w*'\s*:/.test(raw);
        if (looksLikePyDict) {
          const converted = raw
            .replace(/'(\w+)'\s*:/g, '"$1":')
            .replace(/:\s*'([^']*)'/g, ': "$1"');
          try {
            const v = JSON.parse(converted);
            if (Array.isArray(v)) parsed.emails = v;
          } catch { /* fall through to retry */ }
        }
      }
    }
    if (parsed?.emails && Array.isArray(parsed.emails)) {
      return parsed.emails as RawEmail[];
    }
    const emailsVal = parsed?.emails;
    const emailsType = typeof emailsVal;
    const emailsKeys = emailsType === "object" && emailsVal !== null ? Object.keys(emailsVal).slice(0, 10) : [];
    const emailsPreview = emailsType === "string"
      ? (emailsVal as string).slice(0, 300)
      : JSON.stringify(emailsVal).slice(0, 300);
    lastFailureContext =
      `attempt=${attempt}/${EMAIL_RETRY_MAX_ATTEMPTS} ` +
      `top_keys=[${Object.keys(parsed ?? {}).join(",")}] ` +
      `typeof_emails=${emailsType} isArray=${Array.isArray(emailsVal)} ` +
      `emails_subkeys=[${emailsKeys.join(",")}] emails_preview=${emailsPreview}`;
    console.warn(`[emailSequences] Schema violation, retrying. ${lastFailureContext}`);
  }
  throw new Error(
    `LLM did not return a valid emails array after ${EMAIL_RETRY_MAX_ATTEMPTS} attempts. Last failure: ${lastFailureContext}`,
  );
}

// ─── runEmailSequenceGeneration ─────────────────────────────────────────────
// Gen-core for the email-sequence node. Callable directly by:
//   - emailSequences.generate (sync tRPC mutation) — wrapped with quota check, returns full row
//   - emailSequences.generateAsync (async tRPC mutation) — wrapped with quota check + jobId enqueue + setImmediate
//   - autoMode.orchestrate (Phase B2 orchestrator) — direct call, no HTTP round-trip
//
// What's inside: Service/SOT/ICP/Campaign/Kit fetches → context building →
// 10-way dispatcher (sequenceType → buildXxxEmailPrompt) → invokeEmailSequenceWithRetry
// → DELAY_HOURS_BY_EMAIL_TYPE override → DB insert into emailSequences →
// return { id }.
// What's outside: quota ENFORCEMENT (caller's job).
//
// No async-prompt drift: both paths (sync + async) use the same shared
// builder functions above. No prompt-content changes during the move.
type EmailSequenceType =
  | "welcome" | "engagement" | "sales" | "nurture" | "launch" | "re-engagement"
  | "discovery_call_confirmation" | "discovery_call_reminder"
  | "event_logistics" | "replay_for_no_shows";

export async function runEmailSequenceGeneration(input: {
  userId: number;
  serviceId: number;
  campaignId?: number;
  sequenceType: EmailSequenceType;
  name: string;
  eventDetails?: {
    eventName?: string;
    eventDate?: string;
    hostName?: string;
    offerName?: string;
    price?: string;
    deadline?: string;
    eventTime?: string;
    eventTimezone?: string;
    eventVenue?: string;
    eventAgenda?: string;
    eventDuration?: string;
    replayUrl?: string;
    bookingUrl?: string;
  };
}): Promise<{ id: number }> {
  const { getDb } = await import("./db");
  const { emailSequences, services, idealCustomerProfiles, sourceOfTruth, campaigns, campaignKits } = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, input.serviceId), eq(services.userId, input.userId)))
    .limit(1);
  if (!service) throw new Error("Service not found");

  const [sot] = await db
    .select()
    .from(sourceOfTruth)
    .where(eq(sourceOfTruth.userId, input.userId))
    .limit(1);
  const sotLines = sot ? [
    sot.coreOffer        ? `Core offer: ${sot.coreOffer}` : '',
    sot.targetAudience   ? `Target audience: ${sot.targetAudience}` : '',
    sot.mainPainPoint    ? `Main pain point: ${sot.mainPainPoint}` : '',
    sot.mainBenefits     ? `Main benefits: ${sot.mainBenefits}` : '',
    sot.uniqueValue      ? `Unique value: ${sot.uniqueValue}` : '',
    sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : '',
  ].filter(Boolean) : [];
  const sotContext = sotLines.length > 0
    ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
    : '';

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

  // campaignType from V2 SoT (campaignKits)
  let campaignType: string = 'course_launch';
  if (icp?.id) {
    const [kit] = await db.select().from(campaignKits)
      .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, icp.id)))
      .limit(1);
    if (kit?.campaignType) campaignType = kit.campaignType;
  }

  const cascadeContext = await getCascadeContext(input.userId, icp?.id, "email");

  const icpContext = icp ? `
IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:
${icp.pains ? `Their daily pains: ${icp.pains}` : ''}
${icp.fears ? `Their deep fears: ${icp.fears}` : ''}
${icp.objections ? `Their objections to buying: ${icp.objections}` : ''}
${icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : ''}
${icp.implementationBarriers ? `What stops them from taking action: ${icp.implementationBarriers}` : ''}
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

  // Social proof + guidance
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
  const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers
    ? `REAL SOCIAL PROOF AVAILABLE:
${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}
${socialProof.hasRating ? `- ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews` : ''}
${socialProof.hasTestimonials ? `- Real testimonials:\n${socialProof.testimonials.map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')}` : ''}

You MUST use these exact numbers and real names. Do not fabricate.`
    : `NO SOCIAL PROOF DATA PROVIDED:
- DO NOT mention customer counts, ratings, or specific testimonials
- Focus on benefit claims and transformation outcomes
- Use outcome-based stories WITHOUT specific names ("One client" instead of "John Smith")`;

  const emailPromptParams: EmailPromptParams = {
    sotContext,
    serviceName: service.name,
    campaignTypeContext,
    icpContext,
    socialProofGuidance,
    category: service.category,
    description: service.description,
    targetCustomer: service.targetCustomer,
    mainBenefit: service.mainBenefit,
    eventName: input.eventDetails?.eventName,
    hostName: input.eventDetails?.hostName,
    offerName: input.eventDetails?.offerName,
    price: input.eventDetails?.price,
    deadline: input.eventDetails?.deadline,
    eventTime: input.eventDetails?.eventTime,
    eventTimezone: input.eventDetails?.eventTimezone,
    eventDate: input.eventDetails?.eventDate,
    eventVenue: input.eventDetails?.eventVenue,
    eventAgenda: input.eventDetails?.eventAgenda,
    eventDuration: input.eventDetails?.eventDuration,
    replayUrl: input.eventDetails?.replayUrl,
    bookingUrl: input.eventDetails?.bookingUrl,
  };

  // 10-way dispatch — switch on sequenceType to call appropriate builder.
  let prompt: string;
  switch (input.sequenceType) {
    case "welcome":
      prompt = buildWelcomeEmailPrompt(emailPromptParams);
      break;
    case "engagement":
      prompt = buildEngagementEmailPrompt(emailPromptParams);
      break;
    case "sales":
      prompt = buildSalesEmailPrompt(emailPromptParams);
      break;
    case "nurture":
      prompt = buildNurtureEmailPrompt(emailPromptParams);
      break;
    case "launch":
      prompt = buildLaunchEmailPrompt(emailPromptParams);
      break;
    case "re-engagement":
      prompt = buildReengagementEmailPrompt(emailPromptParams);
      break;
    case "discovery_call_confirmation":
      prompt = buildDiscoveryCallConfirmationPrompt(emailPromptParams);
      break;
    case "discovery_call_reminder":
      prompt = buildDiscoveryCallReminderPrompt(emailPromptParams);
      break;
    case "event_logistics":
      prompt = buildEventLogisticsPrompt(emailPromptParams);
      break;
    case "replay_for_no_shows":
      prompt = buildReplayForNoShowsPrompt(emailPromptParams);
      break;
  }

  const rawEmails = await invokeEmailSequenceWithRetry(cascadeContext + prompt);
  const sequenceData: { emails: any[] } = { emails: rawEmails };

  // Server-controlled delay metadata override (workstream commit 4c).
  const delays = DELAY_HOURS_BY_EMAIL_TYPE[input.sequenceType] ?? [];
  sequenceData.emails = sequenceData.emails.map((email: any, idx: number) => ({
    subject: email.subject || `Email ${idx + 1}: Check this out`,
    previewText: email.previewText || '',
    body: email.body || `This is email ${idx + 1}. Click the link to learn more.`,
    delay: delays[idx] ?? (idx * 24),
    delayUnit: 'hours',
    cta: email.cta || 'Learn More',
    ctaLink: email.ctaLink || '#',
    ps: email.ps || '',
  }));

  const insertResult: any = await db.insert(emailSequences).values({
    userId: input.userId,
    serviceId: input.serviceId,
    campaignId: input.campaignId || null,
    sequenceType: input.sequenceType,
    name: input.name,
    emails: sequenceData.emails,
  });

  return { id: insertResult[0].insertId };
}
