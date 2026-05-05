import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
}
import { getDb } from "../db";
import { emailSequences, services, campaigns, idealCustomerProfiles, sourceOfTruth, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { truncateQuote, NO_DATE_FABRICATION_RULE } from "../_core/copywritingRules";
import { getCascadeContext } from "../_core/cascadeContext";

// ---------------------------------------------------------------------------
// Shared email prompt builders — used by generate (sync) and generateAsync.
// Per-email job structure is defined once here; both paths call these functions.
// ---------------------------------------------------------------------------

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
}

function getEmailRules(): string {
  // Word count rules per sequence type — update the BODY COPY RULES block below if new sequence types are added.
  // Welcome sequence: max 200 words
  // Engagement sequence: max 200 words (event-anchored)
  // Sales sequence: max 300 words (event-anchored)
  // Nurture sequence: max 200 words (commit 2 of Email Sequence wire)
  // Launch sequence: max 250 words (commit 2 of Email Sequence wire)
  // Re-engagement sequence: max 150 words (commit 2 of Email Sequence wire)
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

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

SEQUENCE GOAL: By the end of email 3, the reader should feel they know who you are, believe you understand their situation better than anyone else has, and feel that the next logical step is to learn more about how you can help them specifically. Every email moves them one step closer to this state. Nothing in emails 1 or 2 asks them to buy — the sequence earns that right in email 3.

Create 3 emails.
1. DELIVER THE PROMISE (Day 1) — Primary job: Give them exactly what was promised — the lead magnet, the resource, or the access — immediately in the first paragraph. No preamble. No selling. Just the thing they signed up for. Secondary function (not a second job — a structural element): end the email with one specific unanswered question that makes them want to open email 2. The question must be real, niche-specific, and something they genuinely do not know the answer to. The question lives in the PS — not the body.
2. ORIGIN STORY (Day 3) — Job: Why you do this work. One vulnerable moment (what it looked like when things were not working), one turning point (the specific thing that changed), one result (what became possible after). No selling. No pitch. The story must make them feel they are not alone in their situation.
3. PROOF (Day 5) — Job: One client story with a specific before/after. Name the situation they were in before, the specific change they made, and the specific outcome they got — a number, a named situation, or a measurable result. No generic testimonials. The story must be specific enough that the reader thinks "that could be me."

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

Create 5 emails (Monday to Friday before event).
1. SET THE STAGE (Monday) — Job: Create anticipation for the event. Make them feel something valuable is coming — something they'd regret missing.
2. OPEN WITH HIGH DRAMA (Tuesday) — Job: Tell one specific story that makes the problem feel urgent and personal. No product pitch.
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

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

LOSS AVERSION FRAME — applies to emails 1 through 4: Every email must contain at least one sentence that names something the reader is actively losing right now — not something they might gain later. Frame it in present tense: 'Every week you stay here is another week of [specific cost].' The cost must be niche-specific and concrete — a number, a named situation, or a recurring experience. Losses feel twice as painful as equivalent gains. Use this asymmetry.

SUBJECT LINE SPECIFICITY RULE FOR SALES SEQUENCES: Each of the 7 emails has a different emotional job. The subject line must match that job's emotional tone — not just create generic curiosity. Email 1 (Thank You): subject must feel personal and specific to what they just experienced. Email 2 (Case Study): subject must name a specific situation, not just promise a story. Email 3 (Objection): subject must name the real objection, not hint at it. Email 4 (Bonus): subject must make the bonus feel like a surprise discovery, not a sales pitch. Email 5 (Guarantee): subject must make the guarantee feel like news, not reassurance. Email 6 (Scarcity): subject must name what specifically closes, not just create urgency. Email 7 (Final Call): subject must name the choice, not the deadline.

Create 7 emails (Day 1-7 after event).
1. THANK YOU (Day 1) — Job: Re-open the door. Thank them and name the one specific insight from the event that would have felt most personally true to someone in their situation. One clear next step at the end. Nothing else.
2. CASE STUDY (Day 2) — Job: Remove the "will it work for me?" objection. ANCHORING RULE: State the starting point before the result. The reader must see the gap — where the person started versus where they ended up. Format: '[Situation before] → [specific change made] → [specific result with number or named outcome].' A result without a starting point has no anchor — the reader cannot feel the distance traveled. The case study situation must mirror the reader's situation. The reader must think "that person was exactly like me."
3. OBJECTION HANDLING (Day 3) — Job: Name the real objection — not the polite version they'd say out loud, but the actual thought in their head. Then answer it with specifics: a number, a story, or a mechanism. Do not be defensive. Do not sell. Just dismantle the objection with evidence.
4. BONUS REVEAL (Day 4) — Job: Make the offer feel more irresistible by revealing one bonus that solves a specific problem they didn't think was included. State the specific dollar value of the bonus. Use anchoring — state total value before revealing the ask. The bonus must feel directly useful, not like padding.
5. GUARANTEE (Day 5) — Job: Remove all risk from the decision. State the exact duration, the exact result guaranteed, and the exact refund process. Make keeping their money feel riskier than spending it — name the ongoing cost of not solving this problem for one more month.
6. SCARCITY (Day 6) — Job: Make inaction feel costly and concrete. Name the specific thing that closes or changes — a cohort deadline, a price increase, or a genuine limit. Never fabricate scarcity. Name what specifically happens after the deadline.
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

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

SEQUENCE GOAL: Build trust over ~21 days. The reader signed up for a lead magnet. By Email 7, they should feel they know your method, have seen one transformation it produced, and be ready to consider the offer. Emails 1 through 6 earn the right to pitch in Email 7. No selling before Email 7 — every earlier email delivers value or builds the relationship.

TONE: Warm, expert, conversational throughout — same Soap Opera register as a welcome sequence. Email 1 is the warmest (delivery + handoff); Email 7 the most direct (the pitch). Curiosity and generosity stay constant; intensity rises gradually.

ANCHOR PLACEHOLDER: The lead magnet name is [INSERT_LEAD_MAGNET_NAME]. Use this token verbatim wherever the email needs to reference what the subscriber just downloaded — the operator fills it in before publishing. Do not invent a lead magnet name.

Create 7 emails.

1. DELIVER + INTRO (Day 0) — Job: Hand off the lead magnet immediately in the first paragraph. No preamble. Brief intro of who you are (one sentence). Preview what's coming over the next ~3 weeks. End with a soft hook to the next email — one specific question or observation that pays off in Email 2. The PS is mandatory and is where the hook lives, not the body.

2. EXPAND ON THE TOPIC (Day 2-3) — Job: Add one extra insight beyond what was in the lead magnet. First-person observation framing — "I've noticed something specific about [reader's situation]." Position yourself as having a deeper view than what the magnet alone delivered. Soft CTA: "reply if X resonates" or "let me know which one fits you" — invitation to dialogue, not action.

3. PROBLEM DEEP-DIVE (Day 5-6) — Job: Articulate their problem more specifically than they've heard before. Name the specific moment in their workflow or week where the problem actually shows up — not the abstract version. Show you understand the texture, not just the headline. No CTA — pure value email. End with a question that confirms you've named their actual problem.

4. SOLUTION FRAMEWORK (Day 8-10) — Job: Introduce your method or framework in plain language. One sentence: what it is. One sentence: the principle that makes it work. One sentence: the proof point that proves the principle. Origin framing in the opening — "I get asked this all the time" or "I spent X years figuring this out." Soft CTA: "want me to walk you through how it works for [their situation]?"

5. CASE STUDY (Day 12-14) — Job: Tell one specific transformation story. Name a specific archetype ("Sarah, a [niche-specific role], came to me last [timeframe]"), the starting point, the mechanism (your method), and the outcome with a number, timeframe, or named result. Make it specific enough that the reader thinks "that could be me." Soft CTA: an invitation to explore your work or read more case studies.

6. DIFFERENTIATION + OBJECTION (Day 16-18) — Combined slot. Job: Address the alternative they're probably considering AND the natural objection to your method in one email. Two-part body: (1) name the obvious approach and why it fails for their specific situation; (2) preempt the most common objection to your approach with a concrete answer. Don't be defensive. Soft CTA: "ready to talk?" or "still on the fence — what's the question?"

7. DIRECT OFFER (Day 19-21) — Job: The first explicit pitch. No hedging. State the offer, the named outcome, the single specific next step. ANCHORING RULE: state the value of what they get before naming the price or the close. Confidence, not apology. Primary CTA: book a call / buy / specific action.

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

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

SEQUENCE GOAL: Drive cart-open conversions during the open-cart window. The 3 pre-launch emails build anticipation by teaching, story-telling, and shifting how the reader sees their problem — without revealing the offer. Day 0 (Email 4) opens the cart with a full reveal. The 5 open-cart emails (Email 4-8) work different conversion angles. Email 9 is the final-call close-cart email a few hours before the deadline.

TONE: Anticipation in pre-launch (Emails 1-3) → confident clarity at cart-open (Email 4) → respectful urgency rising across open-cart (Emails 5-8) → direct, no-hedging close in Email 9. Warmth stays throughout; pressure rises only as the deadline approaches.

ANCHOR PLACEHOLDERS: Use [INSERT_LAUNCH_PRODUCT_NAME] for the product, [INSERT_CART_OPEN_DATE] / [INSERT_CART_CLOSE_DATE] / [INSERT_CART_CLOSE_TIME] for the cart window dates and time, [INSERT_PRICE] for the offer price, and [INSERT_BONUS_VALUE] for any bonus dollar value. The operator fills these in before publishing. Do not invent dates, times, prices, or product names — emit the tokens verbatim.

INTEGRITY RULE: Never invent scarcity that isn't real. Cart-close deadlines must reference [INSERT_CART_CLOSE_DATE] / [INSERT_CART_CLOSE_TIME] explicitly — operator-controlled, honest. Do not fabricate countdown timers, "spots left" claims, or price-increase deadlines unless they are real.

Create 9 emails.

1. PRE-LAUNCH HOOK (Day -7, PLF Video 1 frame) — Job: Tease that something's coming without revealing the product. First-person opener: "I've been working on something for [timeframe]." Name the bigger transformation it enables. No product reveal, no price, no CTA except "watch for the next email." Soft anticipation, warm tone.

2. PRE-LAUNCH TEACHING (Day -4, PLF Video 2 frame) — Job: Teach one principle that shifts how the reader sees their problem. Counterintuitive framing — "[common belief] is actually backwards." Show that this principle ties to your method and previews why a launch is coming. Soft CTA: "tell me what you think" or "does this match your experience?" Authority + generosity.

3. PRE-LAUNCH STORY (Day -2, PLF Video 3 frame) — Job: One detailed transformation arc. Name a specific archetype (or anonymized specific person), the starting point, the mechanism (your method), the outcome with a number or named result. Explicit "this is what's possible" framing. Tease that the cart opens in 48 hours. Soft CTA: "doors open [INSERT_CART_OPEN_DATE]."

4. THE DOORS ARE OPEN (Day 0) — Job: Full offer reveal. State the product name ([INSERT_LAUNCH_PRODUCT_NAME]), what's included, what they'll get, the price ([INSERT_PRICE]), the bonuses, the guarantee. ANCHORING RULE: total value before ask. Direct, clear, confident. Primary CTA: buy now / enroll. Subject: direct, "It's live."

5. SPECIFIC USE CASE (Day +1) — Job: Address one ICP segment specifically. Walk through one concrete user persona ("If you're a [specific archetype] dealing with [specific situation]..."), show how the product solves their version of the problem. Targeted helpful tone. Primary CTA: buy now.

6. OBJECTION HANDLING (Day +3) — Job: Name the real objection their head is asking — not the polite version. Three-paragraph structure: (1) state the objection in their words, (2) answer with concrete evidence, (3) acknowledge if it's actually a fit issue (and that's okay). Honest, dismantling, not defensive. Primary CTA: buy now.

7. BONUS REVEAL (Day +5) — Job: Reveal an unannounced bonus with a specific dollar value. Surprise framing — "I almost forgot to mention this." State the bonus name and what it specifically gives the buyer. ANCHORING RULE: state [INSERT_BONUS_VALUE] before reanchoring against the total package value. Generous tone with rising urgency. Primary CTA: buy now.

8. SCARCITY / TIME-BOUND (Day +7, morning) — Job: Name what specifically closes when. "Cart closes [INSERT_CART_CLOSE_DATE] at [INSERT_CART_CLOSE_TIME]." Preview what they'll lose access to. One social-proof moment (specific number of buyers, specific named transformation) — only if real, never fabricated. Honest urgency. Primary CTA: buy now.

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

${p.socialProofGuidance}

${p.campaignTypeContext ? `${p.campaignTypeContext}\n\n` : ''}${p.icpContext}

${getEmailRules()}

SEQUENCE GOAL: Win back genuinely re-interested subscribers OR honestly clean the list of those who've moved on. Both outcomes are wins. The 4 emails span 14 days. By Email 4, anyone who hasn't engaged should be removed from the active list — keeping a healthy list matters more than keeping a large one.

TONE — DESCENDS ACROSS THE 4: Email 1 is the warmest (genuine concern, no pressure). Email 2 stays warm but adds curiosity (value reminder). Email 3 shifts to generous-direct (specific offer). Email 4 is honest-direct, willing to be unsubscribed without guilt. Crucially: no pressure, no guilt language, no "don't leave us" pleading at any point.

ANCHOR PLACEHOLDERS: Use [INSERT_LAST_ENGAGEMENT_TIMEFRAME] for the inactivity window the operator chose to define (e.g., "the past 60 days", "since March"). Use [INSERT_INCENTIVE] for the specific re-engagement offer the operator picked — typical options for coaching/consulting: free strategy call, exclusive content drop, returning-subscriber bonus, or course discount. Do not invent these — emit the tokens verbatim.

INTEGRITY RULE: No fake urgency. No "limited time" framing unless [INSERT_INCENTIVE] is genuinely time-bound. The honesty of Email 4 ("Should we stop emailing you?") is what makes the whole sequence work — fake urgency in earlier emails undermines that.

Create 4 emails.

1. GENUINE CHECK-IN (Day 0) — Job: Honest concern, no sales. Subject: personal-feeling, "Is everything okay, [First Name]?"-style. Opening: name the inactivity directly — "I noticed you haven't been opening emails lately." Acknowledge their priorities may have changed. Ask one open question. Offer one easy win to re-engage (a single piece of content, a quick reply prompt). Soft CTA: "reply with one word: stay or go." Warm, no pressure.

2. VALUE REMINDER (Day 2-3) — Job: Recall a specific moment of original engagement — what they got from being on the list when they first signed up. Subject: "Remember when you [specific thing they engaged with]?" or similar past-anchored framing. Body: remind them of past value, share what's new since they were last active, offer one piece of high-value content as a reactivation hook. Soft CTA: explore the new content. Curious, generous tone.

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

// ---------------------------------------------------------------------------

const generateEmailSequenceSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  sequenceType: z.enum(["welcome", "engagement", "sales", "nurture", "launch", "re-engagement"]),
  name: z.string().min(1).max(255),
  eventDetails: z
    .object({
      eventName: z.string(),
      eventDate: z.string(),
      hostName: z.string(),
      offerName: z.string().optional(),
      price: z.string().optional(),
      deadline: z.string().optional(),
    })
    .optional(),
});

const updateEmailSequenceSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  emails: z.any().optional(),
  automationEnabled: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const emailSequencesRouter = router({
  // List all email sequences for current user
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

      const conditions = [eq(emailSequences.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(emailSequences.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(emailSequences.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(emailSequences)
        .where(and(...conditions))
        .orderBy(desc(emailSequences.createdAt));
    }),

  // Get single email sequence by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [sequence] = await db
        .select()
        .from(emailSequences)
        .where(
          and(
            eq(emailSequences.id, input.id),
            eq(emailSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!sequence) {
        throw new Error("Email sequence not found");
      }

      return sequence;
    }),

  // Generate email sequence using AI (Russell Brunson Soap Opera Sequence)
  generate: protectedProcedure
    .input(generateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "email");
        if (ctx.user.emailSeqGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} email sequences. Upgrade to generate more.`,
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

      // Campaign fetch — Item 1.5 (campaignType) + Item 1.1b (icpId)
      let icp: typeof idealCustomerProfiles.$inferSelect | undefined;
      let campaignType = 'course_launch'; // default

      if (input.campaignId) {
        const [campaign] = await db
          .select()
          .from(campaigns)
          .where(and(
            eq(campaigns.id, input.campaignId),
            eq(campaigns.userId, ctx.user.id)
          ))
          .limit(1);

        if (campaign?.campaignType) {
          campaignType = campaign.campaignType;
        }
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

      // Cascade context — read upstream campaignKits selections for this ICP
      // and prepend to the LLM user-message. Must mirror the call in generateAsync.
      const cascadeContext = await getCascadeContext(ctx.user.id, icp?.id, "email");

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

      // Extract real social proof data
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
      
      // truncateQuote imported from copywritingRules.ts — one definition used everywhere.
      // Social proof guidance for email copy
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


      // Both sync and async use the shared builder functions — per-email job structure lives there.
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
      };
      // 6-way dispatch — commit 2 of Email Sequence wire. Existing welcome /
      // engagement / sales preserved unchanged; nurture / launch / re-engagement
      // are net-new builders. Switch (vs. nested ternary) gives exhaustiveness
      // protection — adding a 7th value to the Zod enum surfaces here as a TS
      // error instead of silently falling through to the default.
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
      }
      const rawEmails = await invokeEmailSequenceWithRetry(cascadeContext + prompt);
      // sequenceData typed as `any` here to match the pre-existing flow:
      // before the helper extraction, `sequenceData = JSON.parse(...)` was
      // inferred as `any`, which kept the downstream `.values({emails:...})`
      // call happy despite a Drizzle-schema-vs-actual-shape mismatch that
      // predates this commit. Out of scope to reconcile here.
      const sequenceData: { emails: any[] } = { emails: rawEmails };
      // Note: email sequences generated before commit 4d04611 may have null ps fields — the LLM
      // was returning ps but it was dropped before DB save. To find affected records run:
      // DB is MySQL/TiDB — do not use Postgres jsonb syntax.
      // SELECT id, JSON_LENGTH(emails) AS total,
      //   JSON_LENGTH(JSON_EXTRACT(emails, '$[*].ps')) AS with_ps
      // FROM email_sequences
      // WHERE JSON_LENGTH(emails) != JSON_LENGTH(JSON_EXTRACT(emails, '$[*].ps'))
      //    OR JSON_SEARCH(emails, 'one', NULL, NULL, '$[*].ps') IS NOT NULL;
      // Do not attempt to backfill — downstream display code should treat null/missing ps as empty string.
      sequenceData.emails = sequenceData.emails.map((email: any, idx: number) => ({
        subject: email.subject || `Email ${idx + 1}: Check this out`,
        previewText: email.previewText || '',
        body: email.body || `This is email ${idx + 1}. Click the link to learn more.`,
        delay: email.delay || (idx * 24),
        delayUnit: email.delayUnit || 'hours',
        cta: email.cta || 'Learn More',
        ctaLink: email.ctaLink || '#',
        ps: email.ps || '',
      }));
      // Save to database
      const insertResult: any = await db.insert(emailSequences).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        sequenceType: input.sequenceType,
        name: input.name,
        emails: sequenceData.emails,
      });

      // Fetch the created sequence
      const [newSequence] = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.id, insertResult[0].insertId))
        .limit(1);

      return newSequence;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; email sequence generation runs via setImmediate.
   */
  generateAsync: protectedProcedure
    .input(generateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "email");
        if (user.emailSeqGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} email sequences. Upgrade to generate more.` });
        }
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [service] = await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.userId, user.id))).limit(1);
      if (!service) throw new Error("Service not found");
      const [sot] = await db.select().from(sourceOfTruth).where(eq(sourceOfTruth.userId, user.id)).limit(1);
      let icp: any;
      let campaignType = 'course_launch';
      if (input.campaignId) {
        const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, user.id))).limit(1);
        if (campaign?.campaignType) campaignType = campaign.campaignType;
        if (campaign?.icpId) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, campaign.icpId)).limit(1); }
      }
      if (!icp) { [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1); }

      // Cascade context — fetched during request, captured for setImmediate.
      // Must mirror the call in generate.
      const capturedCascadeContext = await getCascadeContext(user.id, icp?.id, "email");

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
          const icpContext = capturedIcp ? `\nIDEAL CUSTOMER PROFILE — use this to make every line of copy specific and targeted:\n${capturedIcp.pains ? `Their daily pains: ${capturedIcp.pains}` : ''}\n${capturedIcp.fears ? `Their deep fears: ${capturedIcp.fears}` : ''}\n${capturedIcp.objections ? `Their objections to buying: ${capturedIcp.objections}` : ''}\n${capturedIcp.buyingTriggers ? `What makes them buy: ${capturedIcp.buyingTriggers}` : ''}\n${capturedIcp.implementationBarriers ? `What stops them from taking action: ${capturedIcp.implementationBarriers}` : ''}`.trim() : '';
          const campaignTypeContextMap: Record<string, string> = { webinar: `CAMPAIGN TYPE: Webinar\nFraming: Show-up urgency. CTA language: Register now / Save your seat / Join us live on [date]`, challenge: `CAMPAIGN TYPE: Challenge\nFraming: Community commitment. CTA language: Join the challenge / Claim your spot / Start with us on [date]`, course_launch: `CAMPAIGN TYPE: Course Launch\nFraming: Transformation journey. CTA language: Enrol now / Join the programme / Claim your place before [date]`, product_launch: `CAMPAIGN TYPE: Product Launch\nFraming: Early access. CTA language: Get early access / Become a founding member / Lock in launch pricing` };
          const campaignTypeContext = campaignTypeContextMap[capturedCampaignType] || campaignTypeContextMap['course_launch'];
          const socialProof = { hasCustomers: !!capturedService.totalCustomers && capturedService.totalCustomers > 0, hasRating: !!capturedService.averageRating && parseFloat(capturedService.averageRating) > 0, hasReviews: !!capturedService.totalReviews && capturedService.totalReviews > 0, hasTestimonials: !!capturedService.testimonial1Name || !!capturedService.testimonial2Name || !!capturedService.testimonial3Name, customerCount: capturedService.totalCustomers || 0, rating: capturedService.averageRating || '', reviewCount: capturedService.totalReviews || 0, testimonials: [capturedService.testimonial1Name ? { name: capturedService.testimonial1Name, title: capturedService.testimonial1Title || '', quote: capturedService.testimonial1Quote || '' } : null, capturedService.testimonial2Name ? { name: capturedService.testimonial2Name, title: capturedService.testimonial2Title || '', quote: capturedService.testimonial2Quote || '' } : null, capturedService.testimonial3Name ? { name: capturedService.testimonial3Name, title: capturedService.testimonial3Title || '', quote: capturedService.testimonial3Quote || '' } : null].filter(Boolean) };
          // truncateQuote imported from copywritingRules.ts — one definition used everywhere.
          const socialProofGuidance = socialProof.hasTestimonials || socialProof.hasCustomers ? `REAL SOCIAL PROOF AVAILABLE:\n${socialProof.hasCustomers ? `- ${socialProof.customerCount} verified customers` : ''}\n${socialProof.hasRating ? `- ${socialProof.rating} average rating from ${socialProof.reviewCount} reviews` : ''}\n${socialProof.hasTestimonials ? `- Real testimonials:\n${(socialProof.testimonials as any[]).map((t: any) => `  • ${t.name}${t.title ? ` (${t.title})` : ''}: "${truncateQuote(t.quote || '')}"`).join('\n')}` : ''}\n\nYou MUST use these exact numbers and real names. Do not fabricate.` : `NO SOCIAL PROOF DATA PROVIDED:\n- DO NOT mention customer counts, ratings, or specific testimonials\n- Focus on benefit claims and transformation outcomes\n- Use outcome-based stories WITHOUT specific names`;

          // Use the shared builders — same per-email job structure as the sync path.
          const bgEmailParams: EmailPromptParams = {
            sotContext,
            serviceName: capturedService.name,
            campaignTypeContext,
            icpContext,
            socialProofGuidance,
            category: capturedService.category,
            description: capturedService.description,
            targetCustomer: capturedService.targetCustomer,
            mainBenefit: capturedService.mainBenefit,
            eventName: capturedInput.eventDetails?.eventName,
            hostName: capturedInput.eventDetails?.hostName,
            offerName: capturedInput.eventDetails?.offerName,
            price: capturedInput.eventDetails?.price,
            deadline: capturedInput.eventDetails?.deadline,
          };
          // 6-way dispatch — mirrors sync path. Same exhaustiveness contract.
          let prompt: string;
          switch (capturedInput.sequenceType) {
            case "welcome":
              prompt = buildWelcomeEmailPrompt(bgEmailParams);
              break;
            case "engagement":
              prompt = buildEngagementEmailPrompt(bgEmailParams);
              break;
            case "sales":
              prompt = buildSalesEmailPrompt(bgEmailParams);
              break;
            case "nurture":
              prompt = buildNurtureEmailPrompt(bgEmailParams);
              break;
            case "launch":
              prompt = buildLaunchEmailPrompt(bgEmailParams);
              break;
            case "re-engagement":
              prompt = buildReengagementEmailPrompt(bgEmailParams);
              break;
          }

          const rawEmails = await invokeEmailSequenceWithRetry(capturedCascadeContext + prompt);
          // See sync path note above re: `any` typing on sequenceData.
          const sequenceData: { emails: any[] } = { emails: rawEmails.map((email: RawEmail, idx: number) => ({ subject: email.subject || `Email ${idx + 1}: Check this out`, previewText: email.previewText || '', body: email.body || `This is email ${idx + 1}. Click the link to learn more.`, delay: (email as any).delay || (idx * 24), delayUnit: (email as any).delayUnit || 'hours', cta: email.cta || 'Learn More', ctaLink: (email as any).ctaLink || '#', ps: email.ps || '' })) };

          const insertResult: any = await bgDb.insert(emailSequences).values({ userId: capturedUserId, serviceId: capturedInput.serviceId, campaignId: capturedInput.campaignId || null, sequenceType: capturedInput.sequenceType, name: capturedInput.name, emails: sequenceData.emails });
          const [newSequence] = await bgDb.select().from(emailSequences).where(eq(emailSequences.id, insertResult[0].insertId)).limit(1);

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ id: newSequence?.id }) })
            .where(eq(jobs.id, jobId));
          console.log(`[emailSequences.generateAsync] Job ${jobId} completed, sequenceId: ${newSequence?.id}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[emailSequences.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Update email sequence
  update: protectedProcedure
    .input(updateEmailSequenceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(emailSequences)
        .where(
          and(
            eq(emailSequences.id, id),
            eq(emailSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Email sequence not found");
      }

      await db
        .update(emailSequences)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(emailSequences.id, id));

      // Fetch updated sequence
      const [updated] = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.id, id))
        .limit(1);

      return updated;
    }),

  // Delete email sequence
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(emailSequences)
        .where(
          and(
            eq(emailSequences.id, input.id),
            eq(emailSequences.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Email sequence not found");
      }

      await db
        .delete(emailSequences)
        .where(eq(emailSequences.id, input.id));

      return { success: true };
    }),
});
