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
