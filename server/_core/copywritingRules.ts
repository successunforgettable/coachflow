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
