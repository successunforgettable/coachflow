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
