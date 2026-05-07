import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
}
import { whatsappSequences, services, campaigns, campaignKits, idealCustomerProfiles, sourceOfTruth, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { truncateQuote, NO_DATE_FABRICATION_RULE } from "../_core/copywritingRules";
import { getCascadeContext } from "../_core/cascadeContext";

// ---------------------------------------------------------------------------
// PLACEHOLDER CONVENTIONS — workstream commit 4c (sprint 3b+4b backlog item #9)
// ---------------------------------------------------------------------------
// Two distinct token categories appear in generated WhatsApp messages.
// Conflating them is a common LLM hallucination root cause (item #11).
//
// 1. [First Name] / [Last Name] — MAIL-MERGE tokens.
//    Send-time recipient personalization. Resolved by the operator's WhatsApp
//    platform (GoHighLevel, Twilio, Manychat, etc.) at delivery time against
//    the recipient row. SQUARE BRACKETS, no INSERT prefix. Existing WhatsApp
//    builders already use [First Name] in tone-rule blocks per buildWhatsapp
//    Rules() — opener convention.
//
// 2. [INSERT_X] — DESIGN-TIME OPERATOR-FILL tokens.
//    Resolved by the operator BEFORE sending — they edit the generated copy
//    to substitute the actual value (booking URL, venue, etc.). The
//    PlaceholderBanner at V2WhatsAppResultPanel surfaces these via
//    /\[INSERT_[A-Z][A-Z0-9_]*\]/g regex so the operator catches all
//    unfilled tokens at once.
//
// LLM rules: emit [First Name] for recipient personalization. Emit [INSERT_X]
// only for fields enumerated in each builder's anchor-placeholder allow-list.
// Do NOT invent ad-hoc placeholders for content the LLM should be writing.
// ---------------------------------------------------------------------------
// Shared WhatsApp prompt builders — used by generate (sync) and generateAsync.
// Per-message job structure is defined once here; both paths call these functions.
// ---------------------------------------------------------------------------

// Length × tone wiring (commit 2 of WhatsApp wire sprint).
// Both fields are optional; builders coalesce to the documented defaults
// (length=3, tone="conversational") so callsites that don't pass them get
// behavior identical to the pre-wire path. Schema parse provides the same
// defaults at the tRPC boundary; this is the secondary defense.
type WhatsappTone = "conversational" | "professional" | "urgent";
type WhatsappSequenceLength = 3 | 5 | 7;

// ───────────────────────────────────────────────────────────────────────────
// DELAY METADATA — workstream commit 4c (sprint 3b backlog item #2)
// ───────────────────────────────────────────────────────────────────────────
// Per-sequenceType delay maps for WhatsApp's 4 NEW types (commit 4b).
// Persistence layer OVERRIDES whatever the LLM emits with these values.
// Server is source of truth for delay metadata; LLM is source of truth for
// content only. Same convention as DELAY_HOURS_BY_EMAIL_TYPE in
// emailSequences.ts.
//
// engagement and sales (existing 2 types, parameterized by sequenceLength
// 3/5/7) are NOT in this map — their existing (idx * 24) fallback behavior
// is preserved. Their per-length cadence imperfection is a pre-existing
// issue, registered for the prompt-quality sprint.
//
// SEMANTIC CONVENTION:
//   - nurture (sequence-start-anchored): delay = hours from first message.
//   - discovery_call_reminder (event-anchored): delay = INTENDED SPACING
//     since previous message. Operator computes absolute send relative to
//     bookingTime.
//   - event_logistics (event-anchored, 3 messages): delay = hours from
//     first message. Event sits at +144h (Day -1's anniversary). Day +1 =
//     +192h (24h after event).
//   - discovery_call_confirmation (single-msg): delay=0; trigger immediately.
const DELAY_HOURS_BY_WHATSAPP_TYPE: Record<string, number[]> = {
  discovery_call_confirmation:   [0],                    // single message
  discovery_call_reminder:       [0, 22, 1.75],          // Intended spacing: T-24h start; +22h = T-2h; +1.75h = T-15min
  nurture:                       [0, 72, 168, 336, 504], // Day 0/3/7/14/21 (5 messages — locked design from commit 4b)
  event_logistics:               [0, 144, 192],          // Day -7/-1/+1 (3 messages — locked design from commit 4b; event at +144h)
};

interface WhatsappPromptParams {
  sotContext: string;
  serviceName: string;
  campaignTypeContext: string;
  icpContext: string;
  socialProofGuidance: string;
  eventName: string;
  hostName: string;
  eventDate?: string;
  offerName?: string;
  price?: string;
  tone?: WhatsappTone;
  sequenceLength?: WhatsappSequenceLength;
  // Workstream commit 4b — additive optional fields consumed by the 4 new
  // builders (discovery_call_*, nurture, event_logistics). All optional;
  // procedure-layer pass-through applies [INSERT_*] Decision-C fallbacks
  // for the procedurally-resolvable fields, leaving operator-discretion
  // tokens like [INSERT_PARKING_INFO] as embedded prompt prose.
  // Mirror of email's WhatsappPromptParams equivalents (commit 3b).
  eventTime?: string;       // discovery_call_*, event_logistics
  eventTimezone?: string;   // discovery_call_*, event_logistics
  eventVenue?: string;      // event_logistics
  eventAgenda?: string;     // event_logistics (not used in current 3-msg arc, retained for parity)
  eventDuration?: string;   // discovery_call_confirmation
  replayUrl?: string;       // unused on WhatsApp today (channel-omitted), retained for type-parity with email
  bookingUrl?: string;      // discovery_call_*, nurture (final-message CTA)
}

// Conversational tone preserves the pre-refactor rule string verbatim — same
// content, same order, identical bytes when no tone is supplied. Professional
// and urgent are net-new variants per the locked research-report rules.
function buildWhatsappRules(serviceName: string, tone: WhatsappTone = "conversational"): string {
  if (tone === "professional") {
    return `WHATSAPP COPY RULES — non-negotiable for every message:

LENGTH: Maximum 3 sentences per message. WhatsApp is read on mobile in seconds — not emails, not articles.

LANGUAGE: Business-appropriate. No slang. No "gonna", "wanna", "y'all", "ain't". Use complete sentences with proper grammar. The reader is a peer in a professional context — not a friend you'd text on a Friday night.

CONTRACTIONS: Use sparingly. "you're", "it's", "don't" are fine. Avoid colloquial abbreviations like "tmrw", "pls", "u", "btw". Spell out "by the way", "tomorrow", "please".

SPECIFIC SITUATION: Reference something specific about where they are right now — the event they attended, the thing they said yes to, the problem they're trying to solve. Never write a generic message.

ENDING RULE — every message must end with EITHER a direct yes/no question OR a specific action with a link. NEVER both. NEVER neither.

EMOJI RULES: Maximum 1 emoji per message. Only functional icons (✓ ⏰ 📅 📍). Never expressive emojis (😊 🙌 🔥). When in doubt, omit the emoji.

OPENER CONVENTION: "Hello [First Name]," — comma after the name. Never "Hey".

CLOSER CONVENTION: "Best," / "Speak soon," / no close + clear action. Never "Cheers" / "x" / informal sign-offs.

PLACEHOLDER RULES: Use [First Name] (NOT {{Name}}). Use actual service name "${serviceName}". Write actual timing (not {{Date}} or {{Time}}).`;
  }

  if (tone === "urgent") {
    return `WHATSAPP COPY RULES — non-negotiable for every message:

LENGTH: Maximum 3 sentences per message. WhatsApp is read on mobile in seconds — not emails, not articles.

LANGUAGE: Direct, time-pressured. Lead with the cost of inaction or the closing window. Trim every word that isn't pulling weight.

CONTRACTIONS: Use to compress sentences and feel time-pressured. "you're", "it's", "don't" — required.

SPECIFIC SITUATION: Reference something specific about where they are right now — the event they attended, the thing they said yes to, the problem they're trying to solve. Never write a generic message.

ENDING RULE — every message must end with EITHER a direct yes/no question OR a specific action with a link. NEVER both. NEVER neither.

SCARCITY MARKER — at least one per message, mandatory. Use ONE of:
- Specific deadline (e.g. "ends 11:59 PM tonight", "doors close in 6 hours", "before [INSERT_CART_CLOSE_DATE]")
- Specific quantity (e.g. "3 spots left", "12 already in")
- Specific consequence (e.g. "after Friday, the price goes up 40%")

EMOJI RULES: Maximum 1 emoji per message. Only urgency markers (⏰ 🔥 ⚠️). Never warmth emojis (😊 🙌 💕).

OPENER CONVENTION: "[First Name] — [time window]" / "Quick one — [deadline]" / "Last chance —"

CLOSER CONVENTION: Hard CTA only — no question. The action is the close.

INTEGRITY RULE: Never invent a deadline that doesn't exist. Never invent scarcity that isn't real. If no genuine deadline, price increase, or spot limit exists, use social-proof scarcity grounded in psychology — "People who acted within 48 hours got [specific outcome]" — not fabricated countdown timers.

PLACEHOLDER RULES: Use [First Name] (NOT {{Name}}). Use actual service name "${serviceName}". Write actual timing (not {{Date}} or {{Time}}).`;
  }

  // Default: conversational — verbatim pre-refactor string, byte-identical
  // to what the no-Advanced default path produced before this commit.
  return `WHATSAPP COPY RULES — non-negotiable for every message:

LENGTH: Maximum 3 sentences per message. WhatsApp is read on mobile in seconds — not emails, not articles.

LANGUAGE: No formal language. No "I hope this message finds you well." Write like you're texting a friend who trusts you.

CONTRACTIONS ONLY: "you're" not "you are". "it's" not "it is". "don't" not "do not". Contractions are mandatory.

SPECIFIC SITUATION: Reference something specific about where they are right now — the event they attended, the thing they said yes to, the problem they're trying to solve. Never write a generic message.

ENDING RULE — every message must end with EITHER a direct yes/no question OR a specific action with a link. NEVER both. NEVER neither.

EMOJI RULES: Maximum 2 emojis per message. Only where they add context. Never in formal context.

PLACEHOLDER RULES: Use [First Name] (NOT {{Name}}). Use actual service name "${serviceName}". Write actual timing (not {{Date}} or {{Time}}).`;
}

// ── Per-message role-block helpers ─────────────────────────────────────────
// Length 3 = pre-refactor canonical arc, preserved verbatim except where
// Decision A explicitly tightens Message 3 (engagement only).
// Lengths 5 and 7 = locked role arcs from the WhatsApp wire research report.

const ENGAGEMENT_FINAL_MESSAGE_DECISION_A = `Name the event specifically. Give one clear next step and the link or action. **Do not add a deadline phrase, scarcity language, or "before [date]" construction.** Do not include "before [INSERT_CART_CLOSE_DATE]" or any time-pressure framing — engagement Message-final is the soft CTA, not the close. End with the action only — no question, no urgency.`;

const ENGAGEMENT_PROOF_BLOCK = `Share one real result from one specific type of person (anonymised if needed). PROOF SPECIFICITY RULE: Anonymous proof must still be specific. Required format: '[specific job title or life situation] who [specific problem they had] → [specific mechanism or change] → [specific result with number, timeframe, or named outcome].' Never use: 'someone', 'a person', 'one of our clients', 'a student' without qualification. One sentence on what changed for them and how. Make it feel like evidence, not marketing. End with a direct question asking if that sounds familiar to them.`;

const ENGAGEMENT_ASSUMPTION_BREAK_BLOCK = `Message 1 first sentence rule: The first sentence must break an assumption the reader currently holds — not just create curiosity. Identify the most common belief someone in this niche has about their situation, then write a first sentence that makes that belief feel worth questioning. This is not a shocking statement — it is something so precisely true about their current situation that it stops the scroll because it feels personal. It must contain one niche-specific word or phrase. Open a loop — ask one question they don't yet know the answer to, that makes them want to come to the event to find out. Do not answer the question in this message.`;

function buildEngagementMessageBlocks(length: WhatsappSequenceLength): string {
  if (length === 5) {
    return `Create 5 WhatsApp messages (T-9, T-7, T-5, T-3, T-1 days before event). Each message has ONE job — the entire message serves that job only:

Message 1 job = HOOK + MINI-STORY (T-9 days)
Open with a specific situation from their life — the kind of moment that reveals the problem this event will help with. Tell it as a 2-sentence mini-story, not a setup-payoff joke; an observation from inside their world. Tease the event topic at the end. End with a one-line teaser question that won't resolve until the event.

Message 2 job = ASSUMPTION BREAK + OPEN LOOP (T-7 days)
${ENGAGEMENT_ASSUMPTION_BREAK_BLOCK}

Message 3 job = SPECIFIC PROOF MOMENT (T-5 days)
${ENGAGEMENT_PROOF_BLOCK}

Message 4 job = OBJECTION PRE-EMPT (T-3 days)
Name the most common reason people in this niche don't show up to events like this — the specific quiet reason, not the polite one. Reframe it. Ask for a tentative commitment ("if you can make it, are you in?") so they feel they've already half-decided. End with the question.

Message 5 job = SOFT CTA (T-1 day)
${ENGAGEMENT_FINAL_MESSAGE_DECISION_A}`;
  }

  if (length === 7) {
    return `Create 7 WhatsApp messages (Day -7 through Day -1 — daily for the week before the event). Each message has ONE job — the entire message serves that job only:

Message 1 job = TEASE THE EVENT WITH A QUESTION (Day -7)
Pose the exact question the event answers. One sentence. No setup. Make it a question that — if they thought about it for 60 seconds — would feel uncomfortable to leave unanswered. End with the question itself, no CTA.

Message 2 job = HOOK + MINI-STORY (Day -6)
Open with a specific situation from their life — the kind of moment that reveals the problem this event will help with. Tell it as a 2-sentence mini-story, not a setup-payoff joke; an observation from inside their world. Tease the event topic at the end. End with a one-line teaser question that won't resolve until the event.

Message 3 job = ASSUMPTION BREAK + OPEN LOOP (Day -5)
${ENGAGEMENT_ASSUMPTION_BREAK_BLOCK}

Message 4 job = PROOF MOMENT 1 (Day -4)
${ENGAGEMENT_PROOF_BLOCK}

Message 5 job = PROOF MOMENT 2 (Day -3)
A second proof moment from a different angle and a different audience slice. Same PROOF SPECIFICITY RULE format. Make it clear this is NOT the same person as Message 4 — broaden the proof so it doesn't feel like a one-off. End with a question asking which version sounds more like them.

Message 6 job = OBJECTION PRE-EMPT + REMINDER (Day -2)
Name the most common reason people in this niche don't show up — the specific quiet reason, not the polite one. Reframe it. Add a soft reminder of when the event happens. Ask for a tentative commitment ("if you can make it, are you in?"). End with the question.

Message 7 job = SOFT CTA (Day -1)
${ENGAGEMENT_FINAL_MESSAGE_DECISION_A}`;
  }

  // Length 3 (default) — pre-refactor canonical arc, preserved verbatim
  // except Message 3 swaps to the Decision A tightened final-message text.
  return `Create 3 WhatsApp messages (Monday, Wednesday, Friday before event). Each message has ONE job — the entire message serves that job only:

Message 1 job = ASSUMPTION BREAK + OPEN LOOP (Monday)
${ENGAGEMENT_ASSUMPTION_BREAK_BLOCK}

Message 2 job = SPECIFIC PROOF MOMENT (Wednesday)
${ENGAGEMENT_PROOF_BLOCK}

Message 3 job = SOFT CTA (Friday)
${ENGAGEMENT_FINAL_MESSAGE_DECISION_A}`;
}

const SALES_COST_OF_INACTION_BLOCK = `Reference what they just attended. Name the specific cost of staying where they are — the thing that keeps happening if they don't act. One concrete, niche-specific consequence. End with the direct link or action.`;

const SALES_PROOF_MECHANISM_BLOCK = `Name one specific result from one specific type of person (anonymised if needed). PROOF SPECIFICITY RULE: Anonymous proof must still be specific. Required format: '[specific job title or life situation] who [specific problem they had] → [specific mechanism or change] → [specific result with number, timeframe, or named outcome].' Never use: 'someone', 'a person', 'one of our clients', 'a student' without qualification. Name the method or mechanism that produced that result — one sentence. End with a closing question derived from the ICP's specific situation — their named fear, their specific frustration, or their stated buying trigger. The question must make them feel seen, not categorised. Use their language, not coaching language.`;

const SALES_DIRECT_OFFER_BLOCK = `ANCHORING RULE: In the first sentence, state the total value of what they get before naming the price or the close. Given the 3-sentence constraint, the format is: sentence 1 = value anchor, sentence 2 = closing mechanism with specific named condition, sentence 3 = single action with CTA copy that communicates what they get (not just 'click here'). URGENCY FALLBACK: If no genuine deadline, price increase, or spot limit exists, use social proof scarcity — 'People who attended [event] and acted within 48 hours got [specific result]. The window where momentum works in your favour is closing.' This is honest urgency grounded in psychology, not fabricated scarcity. End with the single action and link only — no question.`;

const SALES_DIFFERENTIATION_BLOCK = `Why this approach is different from what they've already tried — address the unsaid alternative. Don't compare directly to a named competitor; compare to the path they're already on. Make the difference structural, not just "better." End with a question that makes them notice the difference applies to their specific situation.`;

const SALES_OBJECTION_HANDLER_BLOCK = `Name the specific objection most likely to keep them out — not a generic one, the actual quiet reason this audience hesitates. Reframe it with a concrete answer. Sentence 1 = the objection stated in their words (not yours). Sentence 2 = the answer. Sentence 3 = a small action to test the answer ("if X is true for you, here's the simplest next step"). End with the action.`;

function buildSalesMessageBlocks(length: WhatsappSequenceLength): string {
  if (length === 5) {
    return `Create 5 WhatsApp messages (Day 1, 3, 5, 6, 7 after event). Each message has ONE job — the entire message serves that job only:

Message 1 job = NAME THE COST OF INACTION (Day 1)
${SALES_COST_OF_INACTION_BLOCK}

Message 2 job = PROOF + MECHANISM (Day 3)
${SALES_PROOF_MECHANISM_BLOCK}

Message 3 job = DIFFERENTIATION (Day 5)
${SALES_DIFFERENTIATION_BLOCK}

Message 4 job = OBJECTION HANDLER (Day 6)
${SALES_OBJECTION_HANDLER_BLOCK}

Message 5 job = DIRECT OFFER + URGENCY + SINGLE ACTION (Day 7)
${SALES_DIRECT_OFFER_BLOCK}`;
  }

  if (length === 7) {
    return `Create 7 WhatsApp messages (Day 1, 2, 4, 6, 7, 8, 10 after event). Each message has ONE job — the entire message serves that job only:

Message 1 job = NAME THE COST OF INACTION (Day 1)
${SALES_COST_OF_INACTION_BLOCK}

Message 2 job = PROBLEM DEEP-DIVE (Day 2)
Articulate their problem more specifically than they've heard it articulated before. Not: "you're stuck on X". Yes: "the specific kind of stuck that happens at [specific moment in their workflow or week]." Show you understand the texture of the problem, not just the headline. End with a question that confirms you've named their actual problem.

Message 3 job = SOLUTION FRAMEWORK (Day 4)
Your method, named, in plain language. One sentence: what it is. One sentence: the principle that makes it work. One sentence: the proof point that proves the principle. End with a question or an action that asks if they want to know how it works for their specific situation.

Message 4 job = PROOF + MECHANISM (Day 6)
${SALES_PROOF_MECHANISM_BLOCK}

Message 5 job = DIFFERENTIATION (Day 7)
${SALES_DIFFERENTIATION_BLOCK}

Message 6 job = OBJECTION HANDLER (Day 8)
${SALES_OBJECTION_HANDLER_BLOCK}

Message 7 job = DIRECT OFFER + URGENCY + SINGLE ACTION (Day 10)
${SALES_DIRECT_OFFER_BLOCK}`;
  }

  // Length 3 (default) — pre-refactor canonical arc, preserved verbatim.
  return `Create 3 WhatsApp messages (Day 1, 3, 5 after event). Each message has ONE job — the entire message serves that job only:

Message 1 job = NAME THE COST OF INACTION (Day 1)
${SALES_COST_OF_INACTION_BLOCK}

Message 2 job = PROOF + MECHANISM (Day 3)
${SALES_PROOF_MECHANISM_BLOCK}

Message 3 job = DIRECT OFFER + URGENCY + SINGLE ACTION (Day 5)
${SALES_DIRECT_OFFER_BLOCK}`;
}

export function buildWhatsappEngagementPrompt(p: WhatsappPromptParams): string {
  const tone = p.tone ?? "conversational";
  const length: WhatsappSequenceLength = p.sequenceLength ?? 3;
  const rules = buildWhatsappRules(p.serviceName, tone);
  const messageBlocks = buildEngagementMessageBlocks(length);
  // COMMITMENT AND CONSISTENCY: length-3 path uses the verbatim pre-refactor
  // text (preserves byte-equivalent default-flow output). Lengths 5/7 use a
  // length-agnostic version since the original referenced specific message
  // numbers that no longer fit a longer arc.
  const commitmentPrinciple = length === 3
    ? `COMMITMENT AND CONSISTENCY PRINCIPLE: Message 1 opens a question they cannot answer without the event. Message 2 shows proof that someone like them got the answer. Message 3 makes attending the obvious next step for someone who engaged with messages 1 and 2. Build on the micro-commitment of each previous message. Message 3 should feel like the natural conclusion of a conversation that started in message 1 — not a standalone CTA.`
    : `COMMITMENT AND CONSISTENCY PRINCIPLE: Build on the micro-commitment of each previous message — each message earns the next. The final message should feel like the natural conclusion of a conversation that started with the first — not a standalone CTA.`;
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert WhatsApp marketer. Create a ${length}-message WhatsApp engagement sequence for event attendees.

Service: ${p.serviceName}
Event: ${p.eventName}
Host: ${p.hostName}
Event Date: ${p.eventDate}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${rules}

${commitmentPrinciple}

${messageBlocks}

Return as a JSON object with a 'messages' key containing the array.`;
}

export function buildWhatsappSalesPrompt(p: WhatsappPromptParams): string {
  const tone = p.tone ?? "conversational";
  const length: WhatsappSequenceLength = p.sequenceLength ?? 3;
  const rules = buildWhatsappRules(p.serviceName, tone);
  const messageBlocks = buildSalesMessageBlocks(length);
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert WhatsApp marketer. Create a ${length}-message WhatsApp sales sequence for event attendees.

Service: ${p.serviceName}
Event: ${p.eventName}
Offer: ${p.offerName}
Price: ${p.price}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${rules}

ANCHOR PLACEHOLDERS: Use [INSERT_EVENT_NAME] for the event the reader attended, [INSERT_OFFER_NAME] for the offer being sold, [INSERT_PRICE] for the price tag, and [INSERT_OFFER_LINK] for the offer URL the CTA drives to (distinct from [INSERT_BOOKING_URL] which is for 1:1 call scheduling — use OFFER_LINK for sales-page or checkout destinations). Operator pre-fills these before sending — emit the tokens verbatim when not pre-supplied. Do not invent prices, offer names, or URLs.

PLACEHOLDER ALLOW-LIST (Bucket 3 — retroactive coverage of pre-existing WA sales builder, matching the commit 6 nurture/launch/re-engagement pattern; OFFER_LINK newly cataloged from WA sales spot-check 1; Sprint B — PROGRAMME_DURATION canonical added to anchor any programme-length references in sales messages): [INSERT_EVENT_NAME], [INSERT_OFFER_NAME], [INSERT_PRICE], [INSERT_OFFER_LINK], [INSERT_PROGRAMME_DURATION] are the COMPLETE set of [INSERT_*] tokens permitted in this builder. [INSERT_PROGRAMME_DURATION] is the canonical operator-fill for total programme length (e.g. "12 weeks", "6 months") — distinct from [INSERT_BOOKING_DURATION] (call duration) and [INSERT_EVENT_DURATION] (event duration). Use it whenever a sales message references how long the programme runs; emit verbatim if the operator hasn't pre-filled. Do NOT invent durations like "12-week" or "6-month" — pick the token, let the operator resolve. DO NOT invent placeholders for content the LLM should be writing — WhatsApp sales messages' job is to BUILD the case in 30-100 words per message, not to defer that work to the operator. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION] (use canonical [INSERT_OFFER_LINK]), [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use canonical [INSERT_BOOKING_URL] if the offer drives to a 1:1 call, otherwise [INSERT_OFFER_LINK]), [INSERT_BOOKING_TIME], [INSERT_BOOKING_TIMEZONE] (sales messages do not anchor to call times — the event already happened). Write actual content for any value not in the allow-list.

${messageBlocks}

Return as a JSON object with a 'messages' key containing the array.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Workstream commit 4b — 4 net-new sequence types extending the dispatcher
// from 2 to 6. Channel-adjusted vs email's 10-type set:
//   - discovery_call_confirmation: 1 message post-booking (single transactional).
//     Anchored to bookingUrl + eventTime + eventTimezone + eventDuration.
//     Tone parameter ignored — locked at professional register.
//   - discovery_call_reminder: 3 messages T-24h / T-1h / T-15min. Tone
//     parameter overridden — ascending intensity locked across the 3 msgs
//     (conversational → professional → urgent).
//   - nurture: 5 messages over 21 days, lead-magnet-anchored. Tone parameter
//     respected (conversational throughout). Final msg ends with discovery-
//     call CTA + bookingUrl.
//   - event_logistics: 3 messages Day -7 / -1 / +1. In-person event practical
//     info. Tone parameter respected (professional helpful-host).
// All four are tier-agnostic. sequenceLength parameter IGNORED for all 4
// (each builder has its own fixed message count). Same pattern as email's
// commit 3b approach where each net-new type has fixed count.
//
// VOICE CONVENTION LOCKED PER SPRINT 3B BACKLOG ITEM #1: each builder
// declares its pronoun/sign-off convention in prompt prose to prevent the
// third-person/first-person drift observed in email Attempt 2. Every msg
// in a sequence uses the SAME pronoun convention as the first.
// ───────────────────────────────────────────────────────────────────────────

export function buildWhatsappDiscoveryCallConfirmationPrompt(p: WhatsappPromptParams): string {
  // Tone parameter intentionally ignored: confirmation is locked at the
  // professional register regardless of caller's choice.
  const rules = buildWhatsappRules(p.serviceName, "professional");
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert WhatsApp marketer. Create a 1-message WhatsApp discovery-call confirmation, sent immediately after a prospect books a 1:1 call. This is transactional-but-personal — confirms the booking, restates the time, drops the calendar link via WhatsApp's tap-to-open advantage. NOT a sales pitch.

Service: ${p.serviceName}
Host: ${p.hostName}
Booking time: ${p.eventTime} (${p.eventTimezone})
Call duration: ${p.eventDuration}
Booking URL: ${p.bookingUrl}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${rules}

SEQUENCE GOAL: Reduce no-shows by cementing the booking commitment immediately. The reader has already said yes; this message is the door-holding moment. They should feel: confirmed, prepared, looking forward to it. They should NOT feel pitched.

VOICE CONVENTION LOCK: First-person singular throughout. The host (${p.hostName}) is "I" / "me" / "my". Sign-off uses the host's name. Do not switch between third-person ("Arfeen will see you") and first-person ("I'll see you") — pick first-person and stay there.

TONE: Professional but warm. Same register as a thoughtful service provider's confirmation. WhatsApp-native: feels personal because of the channel.

ANCHOR PLACEHOLDERS (substitute when present, leave [INSERT_*] verbatim when absent — convention locked across all 4 new builders): the booking time + timezone + duration + URL all come pre-resolved via procedure pass-through. Use them literally.

WORD BUDGET (workstream commit 4c — sprint 4b backlog item #8): Target 30-50 words total. Single tap to act, no preamble. WhatsApp's terse register favors brevity over completeness. Sentence cap of 3 is a HARD ceiling; word budget is the WORKING target. If the message reads >55 words, trim — every word should be working.

PLACEHOLDER ALLOW-LIST (workstream commit 6 — sprint 3b+4b items #5 + #11 + #14): The placeholders enumerated above ([INSERT_BOOKING_URL], [INSERT_BOOKING_TIME], [INSERT_BOOKING_TIMEZONE], [INSERT_BOOKING_DURATION], [INSERT_HOST_NAME]) are the COMPLETE set permitted. DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use canonical [INSERT_BOOKING_URL]). Write actual content for any value not in the allow-list.

Create 1 message:

1. CONFIRMATION (Day 0, immediate post-booking) — Job: confirm + drop link. Open by stating the booking time + timezone explicitly. ONE sentence on what the reader will get from the time (about THEM, not about you). End with the booking URL as the action. Maximum 3 sentences, target 30-50 words. No PS, no question, no upsell.

The message must include:
- day: 0 (immediate)
- message: (max 3 sentences, max 300 chars target — WhatsApp-native length)
- timing: ("Immediately after booking")
- emojis: (max 1 — only ✓ or 📅 if absolutely needed; first-person register prefers no emoji)

Return as a JSON object with a 'messages' key containing the array.`;
}

export function buildWhatsappDiscoveryCallReminderPrompt(p: WhatsappPromptParams): string {
  // Tone parameter OVERRIDDEN per locked design: ascending intensity across
  // the 3 messages regardless of caller's tone choice. The 3 rules-blocks
  // below get embedded inline (conversational / professional / urgent).
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert WhatsApp marketer. Create a 3-message WhatsApp discovery-call reminder sequence: T-24h, T-1h, T-15min before a booked 1:1 call. Drives show-up and catches reschedules via WhatsApp's high-open-rate channel.

Service: ${p.serviceName}
Host: ${p.hostName}
Booking time: ${p.eventTime} (${p.eventTimezone})
Booking URL (for reschedule or join): ${p.bookingUrl}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

SEQUENCE GOAL: Industry baseline for booked 1:1 calls is ~30% no-show rate; a tight WhatsApp reminder sequence brings that to 10-15%. Each message must be useful (not interruptive) — recipients tap through gladly because each delivers a single concrete piece of info.

VOICE CONVENTION LOCK: First-person singular throughout. The host is "I" / "me". Sign-off uses host name in all 3 messages (or no sign-off if message ends with the link). Do not drift to third-person ("Arfeen will be there") or first-person plural ("we'll be there") — first-person singular only, all 3 messages.

TONE — INTENSITY ASCENDS (overrides caller's tone parameter):
- Message 1 (T-24h): conversational. Friendly reminder, low pressure.
- Message 2 (T-1h): professional. Day-of practical, energetic but composed.
- Message 3 (T-15min): urgent. Imminent, link-prominent, single-tap.

NEVER apologetic ("sorry to bother you again") — these are useful nudges, not interruptions. NEVER guilt-laden ("don't bail on me") — respectful adult tone.

WHATSAPP COPY RULES — non-negotiable for every message:
LENGTH: Maximum 3 sentences per message. WhatsApp is read on mobile in seconds.
LANGUAGE: Mobile-native. Contractions required ("you're", "it's", "don't"). No formal corporate-speak.
SPECIFIC SITUATION: Reference the booking specifically — the time, the duration, what they booked it for.
ENDING RULE — every message must end with EITHER a direct yes/no question OR a specific action with a link. NEVER both. NEVER neither.
PLACEHOLDER RULES: Use actual service name "${p.serviceName}". Booking time + timezone + URL are pre-resolved upstream — substitute literally.

ANCHOR PLACEHOLDERS (substitute when present, leave [INSERT_*] verbatim when absent — convention locked across all 4 new builders).

PLACEHOLDER ALLOW-LIST (workstream commit 6 — sprint 3b+4b items #5 + #11 + #14): The placeholders enumerated above ([INSERT_BOOKING_URL], [INSERT_BOOKING_TIME], [INSERT_BOOKING_TIMEZONE], [INSERT_HOST_NAME]) are the COMPLETE set permitted. DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use canonical [INSERT_BOOKING_URL]). Write actual content for any value not in the allow-list.

Create 3 messages.

1. T-24H REMINDER (Day -1) — Job: friendly reminder. CONVERSATIONAL tone. Open with: "Quick reminder we're talking [time] [timezone]." Mention the reschedule link is there if needed. End with one anchor question that primes the call's value (something specific about their situation they should think about). Max 3 sentences. Emojis: 1 max.

2. T-1H REMINDER (Day 0, 1 hour before) — Job: day-of practical. PROFESSIONAL tone. Open with: "We're talking in an hour." Restate the time + zone briefly. Single sentence: "If anything just shifted, the reschedule link is here: [booking URL]." End with the action (booking URL or zoom link). Max 3 sentences. Emojis: 0-1.

3. T-15MIN IMMINENT (Day 0, 15 minutes before) — Job: show up now. URGENT tone — direct, action-focused. Open with: "Starting in 15 minutes." Single sentence with the link. That's it. Max 2 sentences. Emojis: 1 max (⏰ allowed if needed).

Each message must include:
- day: (numeric: -1 for T-24h, 0 for T-1h and T-15min — operator-side scheduling math computes actual send times relative to bookingTime)
- message: (max 3 sentences for messages 1 + 2, max 2 sentences for message 3)
- timing: ("T-24h" / "T-1h" / "T-15min")
- emojis: (per-message rules above)

Return as a JSON object with a 'messages' key containing the array.`;
}

export function buildWhatsappNurturePrompt(p: WhatsappPromptParams): string {
  const tone = p.tone ?? "conversational";  // honored
  const rules = buildWhatsappRules(p.serviceName, tone);
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert WhatsApp marketer. Create a 5-message WhatsApp nurture sequence for new subscribers who downloaded a lead magnet. Mirrors email's 7-message nurture arc compressed for WhatsApp's short-form, mobile-pocket, high-open-rate channel.

Service: ${p.serviceName}
Target Customer: (use ICP context below)
Lead Magnet: [INSERT_LEAD_MAGNET_NAME]
Booking URL (for final-message CTA): ${p.bookingUrl}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${rules}

SEQUENCE GOAL: Build trust over ~21 days via 5 short WhatsApp touches, ending with a soft pitch to a discovery call. The reader gave you their phone number — that's higher trust than email; honor it by not over-messaging or pitching too soon. Messages 1-4 deliver value or build relationship; message 5 earns the right to ask.

VOICE CONVENTION LOCK: First-person singular throughout. The host is "I" / "me" / "my". Sign-off uses the host name on messages 1, 3, and 5 (the longer / more substantive ones); 2 and 4 can omit sign-off if they end with the link or question. Do not drift to "we" or third-person — first-person singular only across all 5 messages.

TONE: Conversational throughout. Warm, peer-to-peer, observation-from-inside-the-niche register. Mobile-pocket informal. NOT salesy, NOT performative.

ANCHOR PLACEHOLDER: The lead magnet name is [INSERT_LEAD_MAGNET_NAME] — substitute literally if the operator pre-fills it; leave the token verbatim if not (convention locked).

NO-FABRICATION RULE (workstream commit 4c — sprint 4b backlog item #10): Do NOT invent specific structural details about the lead magnet — chapter counts, flag counts, section counts, page numbers, durations. SPECIFICALLY FORBIDDEN: "Flag #3", "Which of the 7 [things]", "30-min sit-down", "Chapter 4", "Page 12", "Day 3 of the 21-day program". Reference the lead magnet by name only ([INSERT_LEAD_MAGNET_NAME]); let the operator's CTA + the user's own engagement with the magnet provide specifics. Same root cause as the placeholder hallucination problem — LLM is inventing details that should come from outside the prompt context. When a structural detail would help the message, write it as a generic reference ("the section that hit closest" beats "Flag #3").

PLACEHOLDER ALLOW-LIST (workstream commit 4c — sprint 3b+4b items #5 + #11; Bucket 3 PROGRAMME_DURATION addition from commit 6 spot-check 4 12-week-vs-6-month drift): [INSERT_LEAD_MAGNET_NAME] and [INSERT_PROGRAMME_DURATION] are the COMPLETE set of [INSERT_*] tokens permitted in this builder ([INSERT_BOOKING_URL] is pre-resolved upstream and used literally in msg 5). [INSERT_PROGRAMME_DURATION] is the canonical operator-fill for total programme length (e.g. "12 weeks", "6 months") — distinct from [INSERT_BOOKING_DURATION] (call duration) and [INSERT_EVENT_DURATION] (event duration). Use it whenever a message references how long the programme runs; emit verbatim if the operator hasn't pre-filled it. Do NOT invent durations like "12-week" or "6-month" — pick the token, let the operator resolve. DO NOT invent ad-hoc tokens like [INSERT_DEADLINE], [INSERT_LAUNCH_DATE], [INSERT_FLAG_COUNT], [INSERT_CHAPTER_NUMBER]. Write actual content for any value not in the allow-list.

Create 5 messages.

1. HAND-OFF (Day 0) — Job: confirm download + name the most useful page. Open with: "Got [INSERT_LEAD_MAGNET_NAME] open?" Single sentence on the most niche-relevant page worth flagging. End with one specific question that invites a reply ("which part hit closest?"). Max 3 sentences.

2. FIELD NOTE (Day 3) — Job: one observation from inside the niche the reader will instantly recognize. Open with the observation, not a setup. Soft question to invite reply ("does this land?"). Max 2 sentences. NO link, NO CTA — pure relationship-building.

3. MECHANISM TEASE (Day 7) — Job: name the unique method in plain language. Sentence 1: what it is. Sentence 2: the principle that makes it work. End with a question: "want me to show you how it applies to [niche-specific situation]?" Max 3 sentences.

4. PROOF (Day 14) — Job: one specific transformation story with a niche-specific marker. PROOF SPECIFICITY RULE: anonymous proof must still be specific. Format: "[specific job/role] who [specific problem] → [specific change] → [specific outcome with number or named result]." End with a question that asks if any part sounds familiar. Max 3 sentences.

5. SOFT PITCH (Day 21) — Job: the first explicit invitation. Open with one sentence connecting back to the reader's situation (their pain or desire from earlier messages). Sentence 2: name the discovery call by what it gives them, not by what it is — frame on the OUTCOME of the call ("a conversation where you walk away with the next concrete step for your specific situation"), NOT on the call's structural attributes (do NOT say "a 30-min sit-down" or any specific duration — the L528 NO-FABRICATION RULE forbids it; if the call duration matters, anchor on [INSERT_BOOKING_DURATION] instead). End with the booking URL as the action. Max 3 sentences. This is the only message in the sequence with a hard CTA.

Each message must include:
- day: (0 / 3 / 7 / 14 / 21)
- message: (per-message length caps above; all max 3 sentences)
- timing: ("Day 0" / "Day 3" / "Day 7" / "Day 14" / "Day 21")
- emojis: (max 1 per message, only when functional)

Return as a JSON object with a 'messages' key containing the array.`;
}

export function buildWhatsappEventLogisticsPrompt(p: WhatsappPromptParams): string {
  const tone = p.tone ?? "professional";  // honored, default professional for helpful-host register
  const rules = buildWhatsappRules(p.serviceName, tone);
  return `${p.sotContext ? `${p.sotContext}\n\n` : ''}You are an expert WhatsApp marketer. Create a 3-message WhatsApp event logistics sequence for an in-person event: Day -7 (welcome + venue), Day -1 (final reminder + day-of), Day +1 (thank-you + next step). Compressed from email's 4-msg version (Day -3 detailed-logistics middle email folded into Day -7).

Service: ${p.serviceName}
Event: ${p.eventName}
Host: ${p.hostName}
Event date: ${p.eventDate}
Event time: ${p.eventTime} (${p.eventTimezone})
Venue: ${p.eventVenue}

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${rules}

SEQUENCE GOAL: Deliver practical info that makes attendees feel prepared and welcomed. WhatsApp is the right channel for day-of logistics specifically — recipients have their phones in their pockets at the venue. By Day -1, every reader should know: where to go, when to arrive. Day +1 closes the loop with thanks + concrete next step.

VOICE CONVENTION LOCK: First-person singular throughout. The host is "I" / "me" / "my". Sign-off uses host name on all 3 messages. Do not drift to third-person or "we" — first-person singular only.

TONE: Professional helpful-host register. Practical, warm, concrete. Use specific details over generic phrases ("park behind the building, entrance on Maple Street" beats "easy parking available"). NOT salesy.

ANCHOR PLACEHOLDERS (substitute when present, leave [INSERT_*] verbatim when absent — convention locked):
- [INSERT_EVENT_VENUE], [INSERT_EVENT_DATE], [INSERT_EVENT_TIME], [INSERT_EVENT_TIMEZONE], [INSERT_EVENT_NAME] are pre-resolved upstream.
- [INSERT_PARKING_INFO] is operator-discretion — embedded as inline prose token. Leave verbatim if the operator hasn't pre-filled it.

Create 3 messages.

1. WELCOME + VENUE (Day -7) — Job: confirm attendance + drop venue + parking. Open with: "[INSERT_EVENT_NAME] is [date] at [venue]." Sentence 2: parking info ([INSERT_PARKING_INFO]). Sentence 3 optional: anticipation note. Max 3 sentences.

2. FINAL REMINDER (Day -1) — Job: day-of arrival info. Open with: "Tomorrow!" — short, energetic. Sentence 2: doors at [time minus 15 min] / arrival prep. Sentence 3: venue address one-line. Max 3 sentences. The reader is going tomorrow; do not bury the practical info.

3. THANK YOU + NEXT STEP (Day +1, post-event) — Job: close the loop. Open with one specific thank-you naming a moment from the event (write a generic reference like "the room's energy on the topic of X" rather than inventing a specific moment; if uncertain leave it generic — operator will personalize). Sentence 2: concrete next step (booking link, or campaign-level CTA). Max 3 sentences. Warm but professional — not pushy.

MSG 3 BANNED PHRASES (workstream commit 4c — sprint 4b backlog item #12): "claim your place", "before this cohort closes", "cohort closing", "places limited", "spots filling fast", "apply now rather than later", "doors closing", any urgency / scarcity language. Day +1 is INFORMATIONAL, not URGENT. Operator-side urgency lives at the CTA destination, not in this message. The CTA mention is a single concrete sentence with the link, no urgency framing.

PLACEHOLDER ALLOW-LIST (workstream commit 4c — sprint 3b+4b items #5 + #11; commit 6 token-drift expansion; Bucket 3 BOOKING_TIME drift fix from commit 6 spot-check 2; Sprint B PROGRAMME_DURATION addition for Day +1 follow-up references to "the program"): The placeholders enumerated above plus [INSERT_PROGRAMME_DURATION] are the COMPLETE set permitted. [INSERT_PROGRAMME_DURATION] is the canonical operator-fill for total programme length (e.g. "12 weeks", "6 months") — distinct from [INSERT_BOOKING_DURATION] (call duration) and [INSERT_EVENT_DURATION] (event duration). Use it whenever the Day +1 thank-you message's CTA references how long a paid programme runs; emit verbatim if the operator hasn't pre-filled. Do NOT invent durations like "six months of 1:1 work" — pick the token, let the operator resolve. Operator-discretion tokens explicitly allowed: [INSERT_PARKING_INFO], [INSERT_ROOM_OR_FLOOR_INFO], [INSERT_EVENT_AGENDA], [INSERT_DRESS_CODE], [INSERT_DIETARY_NOTES] — operator pre-fills before sending. DO NOT invent placeholders for content the LLM should be writing. SPECIFICALLY FORBIDDEN: [INSERT_LAUNCH_DATE], [INSERT_DEADLINE], [INSERT_REGISTRATION_DATE], [INSERT_EVENT_MOMENT], [INSERT_CTA_DESTINATION], [INSERT_NEXT_PROGRAM_NAME], [INSERT_BOOKING_LINK] (use [INSERT_BOOKING_URL] — sprint 4b item #14 fix), [INSERT_BOOKING_TIME], [INSERT_BOOKING_TIMEZONE] (use canonical [INSERT_EVENT_TIME] / [INSERT_EVENT_TIMEZONE] for event start time — BOOKING_* tokens are for 1:1 call scheduling, not in-person events). Write actual content (or a generic descriptive phrase) for any value not in the allow-list.

Each message must include:
- day: (-7 / -1 / 1)
- message: (max 3 sentences; concrete; no fluff)
- timing: ("Day -7" / "Day -1" / "Day +1")
- emojis: (max 1; only functional — 📍 acceptable for venue, 🙏 NOT acceptable for thank-you)

Return as a JSON object with a 'messages' key containing the array.`;
}

// ---------------------------------------------------------------------------
// WhatsApp LLM call + retry helper. Same nested-object-array schema pattern
// as emailSequences, same intermittent failure mode (Sonnet 4.6 occasionally
// returns the `messages` field as a non-array shape despite tool-use schema
// declaring it required: array). Retry up to 3 times on validation failure;
// capture shape evidence on each failure; throw with context after all
// attempts exhausted. Mirror of emailSequences.invokeEmailSequenceWithRetry.
// ---------------------------------------------------------------------------

const WHATSAPP_RETRY_MAX_ATTEMPTS = 3;

const WHATSAPP_SEQUENCE_SYSTEM_PROMPT =
  "You are an expert WhatsApp marketer specializing in high-converting WhatsApp sequences for coaches, speakers, and consultants. You write maximum 3 sentences per message. You use contractions exclusively (you're, it's, don't, we've). You use no formal language. Every message references a specific situation and ends with either a question OR an action — never both, never neither. Always respond with valid JSON.\n\n" +
  NO_DATE_FABRICATION_RULE;

const WHATSAPP_SEQUENCE_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "whatsapp_sequence",
    strict: true,
    schema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "integer" },
              message: { type: "string" },
              cta: { type: "string" },
            },
            required: ["day", "message", "cta"],
            additionalProperties: false,
          },
        },
      },
      required: ["messages"],
      additionalProperties: false,
    },
  },
};

interface RawWhatsappMessage {
  day?: number;
  message?: string;
  text?: string;
  cta?: string;
}

async function invokeWhatsappSequenceWithRetry(userPrompt: string): Promise<RawWhatsappMessage[]> {
  let lastFailureContext: string | null = null;
  for (let attempt = 1; attempt <= WHATSAPP_RETRY_MAX_ATTEMPTS; attempt++) {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: WHATSAPP_SEQUENCE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: WHATSAPP_SEQUENCE_RESPONSE_FORMAT,
    });
    const content = response.choices[0].message.content;
    if (typeof content !== "string") throw new Error("Invalid response format from AI");
    let parsed = JSON.parse(stripMarkdownJson(content));
    if (Array.isArray(parsed)) parsed = { messages: parsed };
    if (parsed?.messages && Array.isArray(parsed.messages)) {
      return parsed.messages as RawWhatsappMessage[];
    }
    const messagesVal = parsed?.messages;
    const messagesType = typeof messagesVal;
    const messagesKeys = messagesType === "object" && messagesVal !== null ? Object.keys(messagesVal).slice(0, 10) : [];
    const messagesPreview = messagesType === "string"
      ? (messagesVal as string).slice(0, 300)
      : JSON.stringify(messagesVal).slice(0, 300);
    lastFailureContext =
      `attempt=${attempt}/${WHATSAPP_RETRY_MAX_ATTEMPTS} ` +
      `top_keys=[${Object.keys(parsed ?? {}).join(",")}] ` +
      `typeof_messages=${messagesType} isArray=${Array.isArray(messagesVal)} ` +
      `messages_subkeys=[${messagesKeys.join(",")}] messages_preview=${messagesPreview}`;
    console.warn(`[whatsappSequences] Schema violation, retrying. ${lastFailureContext}`);
  }
  throw new Error(
    `LLM did not return a valid messages array after ${WHATSAPP_RETRY_MAX_ATTEMPTS} attempts. Last failure: ${lastFailureContext}`,
  );
}

// ---------------------------------------------------------------------------

const generateWhatsAppSequenceSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  sequenceType: z.enum([
    "engagement", "sales",
    // Workstream commit 4b — 4 new types matching DB migration 0069.
    "discovery_call_confirmation", "discovery_call_reminder",
    "nurture", "event_logistics",
  ]),
  name: z.string().min(1).max(255),
  // Length × tone (commit 2 of WhatsApp wire sprint).
  // Optional with defaults so callsites that omit them get the
  // canonical pre-wire behavior (length=3, tone=conversational).
  tone: z.enum(["conversational", "professional", "urgent"]).optional().default("conversational"),
  sequenceLength: z.union([z.literal(3), z.literal(5), z.literal(7)]).optional().default(3),
  eventDetails: z
    .object({
      eventName: z.string(),
      eventDate: z.string(),
      hostName: z.string(),
      offerName: z.string().optional(),
      price: z.string().optional(),
      // Workstream commit 2 — additive optional fields enabling downstream
      // sequence-type expansions (commits 3-5). Mirror of the emailSequences
      // extension. Pre-existing email-vs-WhatsApp drift on `deadline` field
      // (email has it, WhatsApp doesn't) stays as-is — out of scope here,
      // registered backlog.
      eventTime: z.string().optional(),       // "3:00 PM"
      eventTimezone: z.string().optional(),   // "GMT" / "London time" / "PT"
      eventVenue: z.string().optional(),      // for in_person_event
      eventAgenda: z.string().optional(),     // also useful for webinar pre-event reminders
      eventDuration: z.string().optional(),   // "60 minutes" / "2 hours"
      replayUrl: z.string().optional(),       // enables future replay_for_no_shows variants
      bookingUrl: z.string().optional(),      // enables discovery_call campaign type
    })
    .optional(),
});

const updateWhatsAppSequenceSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  messages: z.any().optional(),
  automationEnabled: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const whatsappSequencesRouter = router({
  // List all WhatsApp sequences for current user
  list: protectedProcedure
    .input(
      z
        .object({
          serviceId: z.number().optional(),
          campaignId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(whatsappSequences.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(whatsappSequences.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(whatsappSequences.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(whatsappSequences)
        .where(and(...conditions))
        .orderBy(desc(whatsappSequences.createdAt));
    }),

  // Get single WhatsApp sequence by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [sequence] = await db
        .select()
        .from(whatsappSequences)
        .where(
          and(
            eq(whatsappSequences.id, input.id),
            eq(whatsappSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!sequence) {
        throw new Error("WhatsApp sequence not found");
      }

      return sequence;
    }),

  // Generate WhatsApp sequence using AI
  generate: protectedProcedure
    .input(generateWhatsAppSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "whatsapp");
        if (ctx.user.whatsappSeqGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} WhatsApp sequences. Upgrade to generate more.`,
          });
        }
      }

      // Get service details with social proof (Issue 2 fix)
      const [service] = await db
        .select()
        .from(services)
        .where(
          and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id))
        )
        .limit(1);

      if (!service) {
        throw new Error("Service not found");
      }

      // SOT query — Item 1.4
      const [sot] = await db
        .select()
        .from(sourceOfTruth)
        .where(eq(sourceOfTruth.userId, ctx.user.id))
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

      // Campaign fetch — Item 1.1b (icpId fallback for V1 callsites that
      // pass campaignId). Workstream commit 2.5b separated the campaignType
      // read from this V1-backward-compat ICP-derivation: campaignType now
      // comes from campaignKits (V2 SoT), keyed on (userId, icpId), AFTER
      // ICP resolution.
      let icp: typeof idealCustomerProfiles.$inferSelect | undefined;

      if (input.campaignId) {
        const [campaign] = await db
          .select()
          .from(campaigns)
          .where(and(
            eq(campaigns.id, input.campaignId),
            eq(campaigns.userId, ctx.user.id)
          ))
          .limit(1);

        if (campaign?.icpId) {
          [icp] = await db.select().from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.id, campaign.icpId)).limit(1);
        }
      }
      // ICP serviceId fallback — Item 1.1b
      if (!icp) {
        [icp] = await db.select().from(idealCustomerProfiles)
          .where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
      }

      // Workstream commit 2.5b — campaignType from campaignKits (V2 SoT).
      let campaignType: string = 'course_launch';
      if (icp?.id) {
        const [kit] = await db.select().from(campaignKits)
          .where(and(eq(campaignKits.userId, ctx.user.id), eq(campaignKits.icpId, icp.id)))
          .limit(1);
        if (kit?.campaignType) {
          campaignType = kit.campaignType;
        }
      }

      // Cascade context — read upstream campaignKits selections for this ICP
      // and prepend to the LLM user-message. Must mirror the call in generateAsync.
      const cascadeContext = await getCascadeContext(ctx.user.id, icp?.id, "whatsapp");

      const icpContext = icp ? `
IDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:
${icp.pains ? `Their daily pains: ${icp.pains}` : ''}
${icp.fears ? `Their deep fears: ${icp.fears}` : ''}
${icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : ''}
${icp.communicationStyle ? `How they communicate: ${icp.communicationStyle}` : ''}
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

      // Extract real social proof data — full structure matching emailSequences.ts
      const socialProof = {
        hasCustomers: !!service.totalCustomers && service.totalCustomers > 0,
        hasTestimonials: !!service.testimonial1Name || !!service.testimonial2Name || !!service.testimonial3Name,
        customerCount: service.totalCustomers || 0,
        testimonials: [
          service.testimonial1Name ? { name: service.testimonial1Name, title: service.testimonial1Title || '', quote: service.testimonial1Quote || '' } : null,
          service.testimonial2Name ? { name: service.testimonial2Name, title: service.testimonial2Title || '', quote: service.testimonial2Quote || '' } : null,
          service.testimonial3Name ? { name: service.testimonial3Name, title: service.testimonial3Title || '', quote: service.testimonial3Quote || '' } : null,
        ].filter(Boolean),
      };

      // Social proof guidance for WhatsApp messages — truncateQuote from copywritingRules.ts
      const socialProofGuidance = socialProof.hasCustomers || socialProof.hasTestimonials
        ? `REAL SOCIAL PROOF AVAILABLE:
${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}
${socialProof.hasTestimonials ? `- Real testimonials:\n${socialProof.testimonials.map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')}` : ''}

You MUST use these exact numbers and real names. Do not fabricate.`
        : `NO SOCIAL PROOF DATA PROVIDED:
- DO NOT mention customer counts or specific testimonials
- Focus on benefit claims and value propositions
- Use outcome-based language WITHOUT specific names`;

      // Both sync and async use the shared builder functions — per-message job structure lives there.
      // Decision C: when eventDetails fields are absent, emit operator placeholders
      // ([INSERT_EVENT_NAME] / [INSERT_HOST_NAME] / [INSERT_EVENT_DATE]) instead of
      // literal "Event" / "Host" / "Date" strings. Matches NO_DATE_FABRICATION_RULE
      // convention; surfaced by PlaceholderBanner in V2WhatsAppResultPanel.
      const promptParams: WhatsappPromptParams = {
        sotContext,
        serviceName: service.name,
        campaignTypeContext,
        icpContext,
        socialProofGuidance,
        eventName: input.eventDetails?.eventName || "[INSERT_EVENT_NAME]",
        hostName: input.eventDetails?.hostName || "[INSERT_HOST_NAME]",
        eventDate: input.eventDetails?.eventDate || "[INSERT_EVENT_DATE]",
        // Workstream commit 6 — Decision-C procedure-layer fix. Replaces the
        // builder-template literal "Offer" / "Price" fallbacks at L383-384
        // (now empty fallbacks since this procedure-layer Decision-C swap
        // makes them moot). Matches the existing eventName/hostName/event
        // Date pattern above for cross-channel consistency with email.
        offerName: input.eventDetails?.offerName || "[INSERT_OFFER_NAME]",
        price: input.eventDetails?.price || "[INSERT_PRICE]",
        tone: input.tone,
        sequenceLength: input.sequenceLength,
        // Workstream commit 4b — pass-through for the 7 fields shipped in
        // commit 2.5b's eventDetails extension. Field-substitution convention
        // locked here: substitute when value present, [INSERT_*] when absent
        // (prevents the "coin-flip" substitution pattern observed in email
        // sprint 3b backlog item #3). Procedurally-resolvable fields get the
        // [INSERT_*] fallback at this layer; operator-discretion tokens
        // (parking, dress code, etc.) live as embedded prose in the builders.
        eventTime: input.eventDetails?.eventTime || "[INSERT_BOOKING_TIME]",
        eventTimezone: input.eventDetails?.eventTimezone || "[INSERT_BOOKING_TIMEZONE]",
        eventVenue: input.eventDetails?.eventVenue || "[INSERT_EVENT_VENUE]",
        eventAgenda: input.eventDetails?.eventAgenda,
        eventDuration: input.eventDetails?.eventDuration || "[INSERT_BOOKING_DURATION]",
        replayUrl: input.eventDetails?.replayUrl,
        bookingUrl: input.eventDetails?.bookingUrl || "[INSERT_BOOKING_URL]",
      };
      // Workstream commit 4b — 6-way dispatch refactored from the prior
      // 2-way ternary. Switch (vs ternary) gives exhaustiveness protection:
      // adding a 7th value to the Zod enum surfaces here as a TS error
      // instead of silently falling through. Cases ordered: existing 2 first,
      // new 4 appended (mirrors enum-ordinal order in migration 0069).
      let prompt: string;
      switch (input.sequenceType) {
        case "engagement":
          prompt = buildWhatsappEngagementPrompt(promptParams);
          break;
        case "sales":
          prompt = buildWhatsappSalesPrompt(promptParams);
          break;
        case "discovery_call_confirmation":
          prompt = buildWhatsappDiscoveryCallConfirmationPrompt(promptParams);
          break;
        case "discovery_call_reminder":
          prompt = buildWhatsappDiscoveryCallReminderPrompt(promptParams);
          break;
        case "nurture":
          prompt = buildWhatsappNurturePrompt(promptParams);
          break;
        case "event_logistics":
          prompt = buildWhatsappEventLogisticsPrompt(promptParams);
          break;
      }
      const rawMessages = await invokeWhatsappSequenceWithRetry(cascadeContext + prompt);
      // sequenceData typed as `any` here to match pre-existing flow (Drizzle
      // schema-vs-actual-shape mismatch predates this commit; out of scope).
      // Workstream commit 4c (sprint 3b backlog item #2) — server-controlled
      // delays for the 4 new types. engagement/sales preserve existing
      // (idx * 24) fallback (pre-existing imperfect cadence registered for
      // prompt-quality sprint).
      const delays = DELAY_HOURS_BY_WHATSAPP_TYPE[input.sequenceType] ?? [];
      const sequenceData: { messages: any[] } = {
        messages: rawMessages.map((msg: RawWhatsappMessage, idx: number) => ({
          text: msg.message || msg.text || `Message ${idx + 1}: Check this out`,
          delay: delays[idx] ?? (idx * 24),
          delayUnit: 'hours',
          mediaUrl: (msg as any).mediaUrl || null,
          mediaType: (msg as any).mediaType || null,
        })),
      };
      // Save to database — tone || "conversational" is a belt-and-suspenders
      // default in case any future codepath bypasses the Zod schema's default.
      const insertResult: any = await db.insert(whatsappSequences).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        sequenceType: input.sequenceType,
        tone: input.tone || "conversational",
        name: input.name,
        messages: sequenceData.messages,
      });

      // Fetch the created sequence
      const [newSequence] = await db
        .select()
        .from(whatsappSequences)
        .where(eq(whatsappSequences.id, insertResult[0].insertId))
        .limit(1);

      return newSequence;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; WhatsApp sequence generation runs via setImmediate.
   */
  generateAsync: protectedProcedure
    .input(generateWhatsAppSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "whatsapp");
        if (user.whatsappSeqGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} WhatsApp sequences. Upgrade to generate more.` });
        }
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [service] = await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.userId, user.id))).limit(1);
      if (!service) throw new Error("Service not found");
      const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, user.id)).limit(1);
      // Workstream commit 2.5b — campaign-fetch retained only for V1
      // backward-compat ICP fallback. campaignType now comes from
      // campaignKits (V2 SoT) below.
      let icp: any;
      if (input.campaignId) {
        const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, user.id))).limit(1);
        if (campaign?.icpId) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaign.icpId)).limit(1); }
      }
      if (!icp) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1); }

      // Workstream commit 2.5b — campaignType from campaignKits (V2 SoT).
      let campaignType: string = 'course_launch';
      if (icp?.id) {
        const [kit] = await db.select().from(campaignKits)
          .where(and(eq(campaignKits.userId, user.id), eq(campaignKits.icpId, icp.id)))
          .limit(1);
        if (kit?.campaignType) {
          campaignType = kit.campaignType;
        }
      }

      // Cascade context — fetched during request, captured for setImmediate.
      // Must mirror the call in generate.
      const capturedCascadeContext = await getCascadeContext(user.id, icp?.id, "whatsapp");

      const capturedInput = { ...input };
      const capturedUserId = user.id;
      const capturedService = { ...service };
      const capturedIcp = icp ? { ...icp } : undefined;
      const capturedSot = sot ? { ...sot } : undefined;
      const capturedCampaignType = campaignType;

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");

          const sotLines = capturedSot ? [capturedSot.coreOffer ? `Core offer: ${capturedSot.coreOffer}` : '', capturedSot.targetAudience ? `Target audience: ${capturedSot.targetAudience}` : '', capturedSot.mainPainPoint ? `Main pain point: ${capturedSot.mainPainPoint}` : '', capturedSot.mainBenefits ? `Main benefits: ${capturedSot.mainBenefits}` : '', capturedSot.uniqueValue ? `Unique value: ${capturedSot.uniqueValue}` : '', capturedSot.idealCustomerAvatar ? `Ideal customer: ${capturedSot.idealCustomerAvatar}` : ''].filter(Boolean) : [];
          const sotContext = sotLines.length > 0 ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n') : '';
          const icpContext = capturedIcp ? `\nIDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:\n${capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : ''}\n${capturedIcp.fears ? `Their deep fears: ${capturedIcp.fears}` : ''}\n${capturedIcp.buyingTriggers ? `What makes them buy: ${capturedIcp.buyingTriggers}` : ''}\n${capturedIcp.communicationStyle ? `How they communicate: ${capturedIcp.communicationStyle}` : ''}`.trim() : '';
          const campaignTypeContextMap: Record<string, string> = { webinar: `CAMPAIGN TYPE: Webinar\nFraming: Show-up urgency. CTA language: Register now / Save your seat / Join us live on [date]`, challenge: `CAMPAIGN TYPE: Challenge\nFraming: Community commitment. CTA language: Join the challenge / Claim your spot / Start with us on [date]`, course_launch: `CAMPAIGN TYPE: Course Launch\nFraming: Transformation journey. CTA language: Enrol now / Join the programme / Claim your place before [date]`, product_launch: `CAMPAIGN TYPE: Product Launch\nFraming: Early access. CTA language: Get early access / Become a founding member / Lock in launch pricing` };
          const campaignTypeContext = campaignTypeContextMap[capturedCampaignType] || campaignTypeContextMap['course_launch'];
          const socialProof = { hasCustomers: !!capturedService.totalCustomers && capturedService.totalCustomers > 0, hasTestimonials: !!capturedService.testimonial1Name || !!capturedService.testimonial2Name || !!capturedService.testimonial3Name, customerCount: capturedService.totalCustomers || 0, testimonials: [capturedService.testimonial1Name ? { name: capturedService.testimonial1Name, title: capturedService.testimonial1Title || '', quote: capturedService.testimonial1Quote || '' } : null, capturedService.testimonial2Name ? { name: capturedService.testimonial2Name, title: capturedService.testimonial2Title || '', quote: capturedService.testimonial2Quote || '' } : null, capturedService.testimonial3Name ? { name: capturedService.testimonial3Name, title: capturedService.testimonial3Title || '', quote: capturedService.testimonial3Quote || '' } : null].filter(Boolean) };
          // truncateQuote imported from copywritingRules.ts — one definition used everywhere.
          const socialProofGuidance = socialProof.hasCustomers || socialProof.hasTestimonials ? `REAL SOCIAL PROOF AVAILABLE:\n${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}\n${socialProof.hasTestimonials ? `- Real testimonials:\n${socialProof.testimonials.map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')}` : ''}\n\nYou MUST use these exact numbers and real names. Do not fabricate.` : `NO SOCIAL PROOF DATA PROVIDED:\n- DO NOT mention customer counts or specific testimonials\n- Focus on benefit claims and value propositions\n- Use outcome-based language WITHOUT specific names`;

          // Use the shared builders — same per-message job structure as the sync path.
          // Decision C operator-placeholder fallback mirrored from sync path L610-621.
          const bgPromptParams: WhatsappPromptParams = {
            sotContext,
            serviceName: capturedService.name,
            campaignTypeContext,
            icpContext,
            socialProofGuidance,
            eventName: capturedInput.eventDetails?.eventName || "[INSERT_EVENT_NAME]",
            hostName: capturedInput.eventDetails?.hostName || "[INSERT_HOST_NAME]",
            eventDate: capturedInput.eventDetails?.eventDate || "[INSERT_EVENT_DATE]",
            // Workstream commit 6 — Decision-C procedure-layer fix (mirror of sync path).
            offerName: capturedInput.eventDetails?.offerName || "[INSERT_OFFER_NAME]",
            price: capturedInput.eventDetails?.price || "[INSERT_PRICE]",
            tone: capturedInput.tone,
            sequenceLength: capturedInput.sequenceLength,
            // Workstream commit 4b — async-path mirror of sync pass-through.
            // Field-substitution convention: substitute when present,
            // [INSERT_*] when absent (locked).
            eventTime: capturedInput.eventDetails?.eventTime || "[INSERT_BOOKING_TIME]",
            eventTimezone: capturedInput.eventDetails?.eventTimezone || "[INSERT_BOOKING_TIMEZONE]",
            eventVenue: capturedInput.eventDetails?.eventVenue || "[INSERT_EVENT_VENUE]",
            eventAgenda: capturedInput.eventDetails?.eventAgenda,
            eventDuration: capturedInput.eventDetails?.eventDuration || "[INSERT_BOOKING_DURATION]",
            replayUrl: capturedInput.eventDetails?.replayUrl,
            bookingUrl: capturedInput.eventDetails?.bookingUrl || "[INSERT_BOOKING_URL]",
          };
          // Workstream commit 4b — 6-way dispatch (mirror of sync path).
          // Same exhaustiveness contract.
          let prompt: string;
          switch (capturedInput.sequenceType) {
            case "engagement":
              prompt = buildWhatsappEngagementPrompt(bgPromptParams);
              break;
            case "sales":
              prompt = buildWhatsappSalesPrompt(bgPromptParams);
              break;
            case "discovery_call_confirmation":
              prompt = buildWhatsappDiscoveryCallConfirmationPrompt(bgPromptParams);
              break;
            case "discovery_call_reminder":
              prompt = buildWhatsappDiscoveryCallReminderPrompt(bgPromptParams);
              break;
            case "nurture":
              prompt = buildWhatsappNurturePrompt(bgPromptParams);
              break;
            case "event_logistics":
              prompt = buildWhatsappEventLogisticsPrompt(bgPromptParams);
              break;
          }

          const rawMessages = await invokeWhatsappSequenceWithRetry(capturedCascadeContext + prompt);
          // See sync path note above re: `any` typing on sequenceData.
          // Workstream commit 4c (sprint 3b backlog item #2) — server-controlled delays. Mirror of sync path.
          const delays = DELAY_HOURS_BY_WHATSAPP_TYPE[capturedInput.sequenceType] ?? [];
          const sequenceData: { messages: any[] } = { messages: rawMessages.map((msg: RawWhatsappMessage, idx: number) => ({ text: msg.message || msg.text || `Message ${idx + 1}: Check this out`, delay: delays[idx] ?? (idx * 24), delayUnit: 'hours', mediaUrl: (msg as any).mediaUrl || null, mediaType: (msg as any).mediaType || null })) };

          // tone || "conversational" belt-and-suspenders default; mirrors sync path.
          const insertResult: any = await bgDb.insert(whatsappSequences).values({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, sequenceType: capturedInput.sequenceType, tone: capturedInput.tone || "conversational", name: capturedInput.name, messages: sequenceData.messages });
          const [newSequence] = await bgDb.select().from(whatsappSequences).where(eq(whatsappSequences.id, insertResult[0].insertId)).limit(1);

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ id: newSequence?.id }) })
            .where(eq(jobs.id, jobId));
          console.log(`[whatsappSequences.generateAsync] Job ${jobId} completed, sequenceId: ${newSequence?.id}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[whatsappSequences.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Update WhatsApp sequence
  update: protectedProcedure
    .input(updateWhatsAppSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(whatsappSequences)
        .where(
          and(
            eq(whatsappSequences.id, id),
            eq(whatsappSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("WhatsApp sequence not found");
      }

      await db
        .update(whatsappSequences)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(whatsappSequences.id, id));

      // Fetch updated sequence
      const [updated] = await db
        .select()
        .from(whatsappSequences)
        .where(eq(whatsappSequences.id, id))
        .limit(1);

      return updated;
    }),

  // Delete WhatsApp sequence
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(whatsappSequences)
        .where(
          and(
            eq(whatsappSequences.id, input.id),
            eq(whatsappSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("WhatsApp sequence not found");
      }

      await db
        .delete(whatsappSequences)
        .where(eq(whatsappSequences.id, input.id));

      return { success: true };
    }),
});
