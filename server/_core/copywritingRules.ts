/**
 * Shared copywriting rules — imported by all prompt files.
 * Centralised here so a change in one place propagates everywhere.
 */

/**
 * Words and phrases banned across all AI-generated copy.
 * Merged from: landing.ts, adCopy.ts, services.ts, hvco.ts, headlines.ts
 */
export const BANNED_COPYWRITING_WORDS: string[] = [
  "transformation",
  "journey",
  "potential",
  "unlock",
  "empower",
  "breakthrough",
  "passion",
  "purpose",
  "impact",
  "fulfilment",
  "abundance",
  "mindset shift",
  "limiting beliefs",
  "step into your power",
  "show up",
  "do the work",
  "level up",
  "transform your life",
  "unlock your potential",
  "embrace your journey",
  "take your business to the next level",
  "achieve your dreams",
  "game-changer",
  "next level",
  "crushing it",
  "hustle",
  "grind",
  "manifest",
  "authentic self",
  "show up fully",
  "lean into",
  "unpack",
  "circle back",
  "bandwidth",
  "synergy",
  "scalable",
  "leverage",
  "pivot",
];

/**
 * Banned headline opener patterns.
 * Merged from: headlines.ts, adCopy.ts
 */
export const BANNED_HEADLINE_PATTERNS: string[] = [
  "Discover",
  "Unlock",
  "Transform",
  "Imagine",
  "Are you ready",
  "It's time to",
  "Say goodbye to",
  "Tired of",
  "Are you struggling with",
  "Finally",
  "The secret to",
  "How to finally",
];

/**
 * Banned generic mechanism names.
 * Used in heroMechanisms.ts, services.ts, hvco.ts
 */
export const BANNED_MECHANISM_NAMES: string[] = [
  "The Success Blueprint",
  "The Growth System",
  "The Transformation Framework",
  "The Mindset Method",
  "The Achievement Protocol",
  "The Breakthrough System",
  "The Empowerment Method",
  "The Results Framework",
];

/**
 * Meta advertising compliance note — appended to system prompts
 * in all ad-facing generators.
 */
export const META_COMPLIANCE_NOTES =
  "Never include: As seen on Meta, As seen on Facebook, As seen on Instagram. Never make income guarantees. Never use banned Meta language: banned, secret they don't want you to know, leaked, exposed, glitch.";

/**
 * Date-fabrication ban — appended to system prompts in all generators
 * with urgency/scarcity surfaces (Offer, Landing Page, Email, WhatsApp).
 * The model has no temporal awareness; any specific calendar date it
 * writes will be a guess and visibly stale to the reader. Production
 * evidence Apr 30 2026: "August 4 2025" in Offer urgency, "January
 * cohort" × 4 angles in Landing Page scarcityUrgency, "January cohort"
 * in welcome Email body. WhatsApp prompts already prove the model
 * complies with named placeholders when given them — this rule
 * generalizes that pattern.
 */
export const NO_DATE_FABRICATION_RULE = `NO DATE FABRICATION: You do not have access to today's date — any calendar reference you write will be a guess and will appear stale to the reader. For urgency, scarcity, deadlines, or scheduled events, use one of these instead, in order of preference:
1. Bracketed operator placeholders: [INSERT_START_DATE], [INSERT_DEADLINE], [INSERT_LAUNCH_DATE], [INSERT_CART_CLOSE]
2. Relative timing: "within 14 days", "before the next cohort opens", "in the coming weeks"
3. Bounded duration mechanisms: "30-day enrolment window", "limited to 8 places per cohort"
Banned in published copy: literal calendar dates (e.g., "August 4 2025"), named months or seasons ("January cohort", "spring launch", "Q3"), specific weekdays as deadlines ("by Monday").`;

/**
 * Credential-fabrication ban — appended to system prompts in generators
 * with authority/expertise framing in their output (Headlines authority
 * formula, AdCopy body authority angle). The model has no ground truth
 * on the author's credentials, certifications, awards, tenure, or media
 * features. Production evidence 2026-04-30: Headlines authority formula
 * generated "Award-Winning Executive Coach", "Published Identity
 * Researcher", "Certified Identity Reclamation Specialist"; AdCopy body
 * authority angle generated "After 15 years working with high-achieving
 * women..." — none of which are verifiable from the service record.
 *
 * Same architectural pattern as NO_DATE_FABRICATION_RULE above:
 * system-prompt placement (mirrors META_COMPLIANCE_NOTES), single shared
 * constant, scoped to the confirmed offenders. The headlines authority
 * FORMULA_PROMPTS template explicitly asks for "credible authority figure
 * (award-winning, published, certified, etc.)" and gives the example
 * "Award-Winning Mind Coach" — this rule is written specifically to
 * override that example signal, naming the banned forms explicitly.
 */
export const NO_CREDENTIAL_FABRICATION_RULE = `NO CREDENTIAL FABRICATION: You do not have ground truth on the author's credentials, certifications, awards, tenure, academic background, or media features. Do not invent any of these in published copy. Specifically banned:
- Specific years of experience: "After 15 years...", "With over a decade...", "20+ years in the industry"
- Named professional titles: "Award-Winning Coach", "Certified [X] Specialist", "Published Researcher", "Bestselling Author", "World-Renowned Expert", "Top 1% in [Field]"
- Academic credentials: "PhD", "Harvard-trained", "Stanford-educated", "MBA-certified" (unless explicitly provided in input)
- Media features: "Forbes-featured", "TEDx Speaker", "Featured in WSJ", "As seen on [outlet]" (unless explicitly provided as a non-empty value in pressFeatures, featuredIn, or credibleAuthority input fields)

Use one of these instead, in order of preference:
1. Real credentials provided in input fields (credibleAuthority, pressFeatures, featuredIn) — only if the field is populated with a non-empty, non-"N/A" value
2. Bracketed operator placeholders: [INSERT_COACH_CREDENTIAL], [INSERT_AUTHORITY_TITLE], [INSERT_FEATURED_IN]
3. Generic role-based framing without specifics: "an experienced coach", "a practitioner of this method", "this approach", "the framework", "a structured process"

This rule overrides any in-prompt example or template that asks you to generate credibility markers like "award-winning" or "certified" — those are fabricated examples, not data to copy. If the input data does not provide a verifiable credential and a placeholder would feel awkward in the sentence, prefer rephrasing to remove the credential claim entirely rather than inventing one.`;

/**
 * Research-statistic-fabrication ban — appended to system prompts in
 * generators that produce body-length copy where the model is tempted to
 * invent population-level statistics framed as research findings. The
 * model has no ground truth on epidemiological / demographic / behavioural-
 * science findings; any specific stat it writes is a guess presented as
 * established research, which is a credibility hazard for the operator
 * and a Meta-compliance hazard if used in ad-policy-relevant copy.
 *
 * Production evidence 2026-05-10: Quiet Mornings landing page (kit 11,
 * landingPages.id=52) generated "first reactive decision within 90
 * seconds of waking", "fewer than 1 in 8", "above 80% failure rate",
 * "fewer than 11 uninterrupted personal minutes per day" — all framed
 * as established findings without operator-supplied source. None
 * verifiable from the service record.
 *
 * Same architectural pattern as NO_DATE_FABRICATION_RULE and
 * NO_CREDENTIAL_FABRICATION_RULE: single shared constant, system-prompt
 * placement, scoped to the confirmed offender (landing page generator)
 * this commit. Sprint B+2 budget: cross-generator audit for the same
 * leakage in email / whatsapp / headlines / adCopy / offers body copy.
 *
 * Sprint B+1 placement scope locked: landing-page-only this commit. The
 * rule's allow-list is deliberately permissive on first-person
 * experiential framing and explicit hypotheticals so it does not
 * over-scrub useful niche-grounded prose.
 */
export const NO_RESEARCH_STATISTIC_FABRICATION_RULE = `NO RESEARCH STATISTIC FABRICATION: You do not have ground truth on epidemiological, demographic, behavioural-science, or industry-survey findings. Do not invent any population-level statistic in published copy. Specifically banned:
- Invented percentages framed as research findings: "above 80% failure rate", "92% of [group] experience X", "less than 12% of people..."
- Invented X-of-Y ratios: "fewer than 1 in 8", "1 in 5 [group] report", "3 out of 4 [target] struggle with..."
- Invented time-to-X claims: "first reactive decision within 90 seconds of waking", "make 35,000 decisions a day", "lose 47 minutes per interruption"
- Invented bounded-quantity claims: "fewer than 11 uninterrupted personal minutes per day", "the average person checks their phone 144 times daily"
- Research-shaped phrasings presented as established findings: "studies show", "research finds", "data indicates", "neuroscience tells us", "the science is clear" — when no operator-supplied source backs the claim
- Named-source attribution without operator-supplied source: "Stanford research shows", "a Harvard study found", "Gallup data indicates"

Use one of these instead, in order of preference:
1. Real statistics supplied in input fields (when populated with non-empty, non-"N/A" values) — quoted verbatim, attributed if attribution was supplied
2. First-person experiential framing without research shape: "many of the people I work with", "in my work with [niche]", "the pattern I see most often is", "what I've noticed across [n] cohorts"
3. Explicit hypothetical framing: "imagine you're someone who", "what often happens when [situation]", "consider the [niche]-specific case where"
4. Generic situational framing without quantifier: "when [situation], it's common to feel", "people in [role] often find that"

This rule overrides any in-prompt example or template that asks you to "make the problem feel urgent with a number" — research-shaped numbers are fabricated examples, not data to copy. The model's job is to make the problem feel personal through specific situational framing, not to invent population-level statistics. If a sentence reads better with a specific number, prefer rephrasing toward situational specificity ("the moment between alarm and first decision") over fabricated quantification ("the 90 seconds between alarm and first decision").`;

/**
 * PROOF specificity compositional-ceiling modifier — DEFINED BUT NOT
 * CURRENTLY PASTED INTO PROMPTS. Retained as a pattern-catalog entry for
 * the post-generation validator (Sprint 2 architectural shift, in flight
 * 2026-05-11). Originally pasted into 5 email + WhatsApp paste sites by
 * Sprint B+1; rolled back the same day after Sprint B+1 surfaced an
 * intermittent JSON-shape regression class (commit 6225ca0 Option A
 * handled the Python-dict sub-case; sub-case 3 — likely truncation at
 * max_tokens — emerged ~30 min later and is not durably recoverable via
 * defensive parser). The validator approach replaces in-prompt rule
 * pasting with post-generation regex / LLM-as-judge pattern matching +
 * retry-with-fail-context — slim prompts eliminate the size-pressure
 * regression class while preserving fabrication coverage.
 *
 * The existing PROOF SPECIFICITY rule (welcome 3 / engagement 2 / sales 2
 * / WA engagement / WA sales) requires "role-first composite" and bans
 * named individuals, but treats the role as the FLOOR rather than the
 * CEILING — biographical scaffolding (family composition, partner
 * profession, employer specifics) and direct quoted speech were both
 * slipping through.
 *
 * Production evidence 2026-05-10: Quiet Mornings welcome email 3
 * (emailSequences.id=66) and WA engagement message 2 (whatsappSequences
 * .id=43) both fabricated "a primary school teacher with a 10-month-old
 * and a partner on shift work" + invented direct quoted speech, despite
 * complying with the role-first composite requirement.
 *
 * Validator pattern targets (extracted from this rule's content):
 *   - Family composition strings: /\bwith a \d+-?(month|year)-old\b/i,
 *     /\bnewly (single|divorced|married)\b/i
 *   - Partner profession strings: /\b(a partner|a spouse) (on|in|at)\b/i
 *   - Employer specifics: /\bat (a )?(Big-?4|Y Combinator|FAANG|MAANG)\b/i
 *   - Direct quoted speech in proof context: detect quoted dialogue
 *     attributed to anonymised composites (harder regex; LLM-as-judge
 *     candidate)
 *
 * Positive-only framing was preserved per b4f2fb4 lesson when the rule
 * was pasted in-prompt; same positive-only framing transfers to the
 * validator's retry-fail-context message ("the previous output included
 * biographical scaffolding; rewrite the composite at role + situation
 * level only").
 */
export const PROOF_COMPOSITIONAL_CEILING_RULE = `COMPOSITIONAL CEILING (Sprint B+1 — extends PROOF SPECIFICITY beyond the role-first floor): the role-based composite is the WHOLE composite, not a foundation to layer biographical scaffolding on. Permitted: 1 niche-specific situational anchor (the role itself or its proximate context — e.g. "a primary school teacher", "a senior manager in healthcare", "a freelance designer between contracts") + the problem → mechanism/change → outcome structure. Forbidden in addition to the existing rule: invented family composition ("with a 10-month-old", "with three kids under 5", "newly single"), invented partner specifics ("a partner on shift work", "a stay-at-home spouse"), invented employer detail ("at a Big-4 firm", "at a Y Combinator startup"), invented dependent ages or relationship status, invented direct quoted speech ("she told me X", "he said Y"), invented dialogue or paraphrase attributed to the composite individual. The composite is a structural placeholder for the reader to project themselves into — not a third-party narrative to flesh out. If the proof needs more weight than role + situation supports, prefer mechanism-only framing (the structural shift the method produces) over biographical scaffolding.`;

/**
 * Truncate a testimonial quote to a maximum length (default 100 chars).
 * Prevents the model spending token budget on quote reproduction rather than copy.
 * Used in: offersGenerator.ts, emailSequences.ts, whatsappSequences.ts
 */
export const truncateQuote = (q: string, max = 100): string =>
  q.length > max ? q.slice(0, max - 3) + '...' : q;

/**
 * W3 — Hook Rate Scoring.
 * Returns a 0-100 score for generated ad content based on copywriting signal strength.
 * No LLM calls — pure heuristic, runs at insert time.
 *
 * Scoring bands (approximate):
 *   90-100  → elite hook (multiple strong signals)
 *   70-89   → solid copy
 *   50-69   → baseline (no bonus signals triggered)
 *   <50     → not possible with current logic (base is 50)
 */
export function scoreAdContent(
  contentType: 'headline' | 'body' | 'link',
  content: string,
  angle?: string,
): number {
  let score = 50;

  if (contentType === 'headline') {
    const words = content.trim().split(/\s+/);
    const wordCount = words.length;

    // +10 if contains a number (specificity signals)
    if (/\d/.test(content)) score += 10;

    // +10 if NOT starting with a banned opener
    const bannedStart = BANNED_HEADLINE_PATTERNS.some(p =>
      content.toLowerCase().startsWith(p.toLowerCase()),
    );
    if (!bannedStart) score += 10;

    // +10 if 5-12 words (optimal headline length)
    if (wordCount >= 5 && wordCount <= 12) score += 10;

    // +10 if contains "you" or "your" (direct address)
    if (/\byou(r)?\b/i.test(content)) score += 10;

    // +10 if ends with "?" or "…" (open loop / curiosity gap)
    if (/[?…]$/.test(content.trim())) score += 10;
  }

  if (contentType === 'body') {
    const words = content.trim().split(/\s+/);
    const wordCount = words.length;

    // +10 if PDC angle — ICP-specific, highest-specificity frameworks
    if (angle && ['pain_pdc', 'desire_pdc', 'circumstance_pdc'].includes(angle)) score += 10;

    // +10 if 100-170 words (optimal body copy length)
    if (wordCount >= 100 && wordCount <= 170) score += 10;

    // +10 if no banned copywriting words present
    const hasBanned = BANNED_COPYWRITING_WORDS.some(w =>
      content.toLowerCase().includes(w.toLowerCase()),
    );
    if (!hasBanned) score += 10;

    // +10 if first sentence ≤ 15 words (punchy opener)
    const firstSentence = content.split(/[.!?]/)[0] ?? '';
    if (firstSentence.trim().split(/\s+/).length <= 15) score += 10;

    // +10 if ends with an approved Meta CTA phrase
    const lc = content.toLowerCase().trim();
    const ctaPatterns = ['learn more', 'book a call', 'get started', 'sign up', 'download free guide'];
    if (ctaPatterns.some(p => lc.endsWith(p) || lc.endsWith(p + '.'))) score += 10;
  }

  if (contentType === 'link') {
    // +10 if ≤ 60 characters (concise link text)
    if (content.trim().length <= 60) score += 10;

    // +10 if starts with uppercase
    if (/^[A-Z]/.test(content.trim())) score += 10;

    // +15 if contains a common action verb
    const actionVerbs = ['get', 'start', 'join', 'learn', 'try', 'claim', 'book', 'grab', 'access', 'watch', 'discover'];
    if (actionVerbs.some(v => new RegExp(`\\b${v}\\b`, 'i').test(content))) score += 15;
  }

  return Math.min(score, 100);
}
