/**
 * complianceFilter.ts
 * ZAP Campaigns — 3-Tier Compliance Classification & Rewrite Engine
 *
 * Tier 1 — REJECTED:  Hard-banned content. Do not write to DB. Return error.
 * Tier 2 — PIVOT_REQUIRED: Restricted language rewritten via 16-hook pivot table.
 * Tier 3 — VALID: No issues found.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ComplianceClassification = "VALID" | "PIVOT_REQUIRED" | "REJECTED";

/**
 * An ATTRIBUTABLE trigger: the rule that fired, the compliance class it belongs to, and the
 * EXACT span of input text that matched it.
 *
 * ⚠️ THIS EXISTS BECAUSE `flaggedTerms` CANNOT DO THE JOB, and the reason is structural rather
 * than incidental. On the PIVOT_REQUIRED path `flaggedTerms` is collected by scanning
 * SOFT_FLAG_PATTERNS over the CLEANED text — text from which the pivot has already removed the
 * offending phrase — so the normal outcome is an empty array. The caller then had a real verdict
 * with nothing to attribute it to, and `complianceAxis` fell back to reporting the field's first
 * 80 characters as though that were the match. Measured on landing page 238: three blocking hits,
 * all three pointing at an opening sentence that no rule had objected to.
 *
 * `triggers` is populated at the moment of the match, against the ORIGINAL text, so it cannot be
 * emptied by a later rewrite. `flaggedTerms` is unchanged and still means what it always meant.
 *
 * `classId` values are the string names of `ComplianceClass` in `_core/complianceAxis.ts`. They
 * are typed as plain strings HERE ON PURPOSE: `complianceAxis` imports this module, so importing
 * the type back would close a cycle. The axis casts at its own boundary.
 */
export interface ComplianceTrigger {
  ruleId: string;
  classId: string;
  span: string;
}

export interface ComplianceResult {
  cleanedText: string;
  classification: ComplianceClassification;
  wasModified: boolean;
  flaggedTerms: string[];
  pivotApplied: string | null;
  /** Attributable matches, in the order the rules ran. Empty only when the verdict is VALID. */
  triggers: ComplianceTrigger[];
}

// ---------------------------------------------------------------------------
// TIER 1 — REJECTED patterns (hard ban — block entirely, do not write to DB)
// ---------------------------------------------------------------------------
const REJECTED_PATTERNS: Array<{ pattern: RegExp; label: string; classId: string }> = [
  // Adult / sexual content
  {
    pattern: /\b(porn|pornography|nude|nudity|naked|sexually explicit|adult content|erotic)\b/gi,
    label: "adult content or sexual reference",
    classId: "prohibited_content",
  },
  // Hate speech / discriminatory targeting
  {
    pattern: /\b(hate speech|racial slur|ethnic slur|white supremac|nazi|antisemit)\b/gi,
    label: "hate speech",
    classId: "prohibited_content",
  },
  {
    pattern: /based\s+on\s+your\s+(race|religion|financial\s+status)/gi,
    label: "discriminatory targeting language",
    classId: "second_person_protected_attribute",
  },
  // Medical misinformation — cure/diagnose/treat a disease
  {
    pattern: /\b(cure|diagnose|treat)\s+(cancer|diabetes|hiv|aids|covid|alzheimer|depression|anxiety disorder|disease|illness|condition)\b/gi,
    label: "medical misinformation",
    classId: "clinical_outcome_claim",
  },
  // Guaranteed income with specific amounts AND timeframes (any currency)
  {
    pattern: /earn\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s+in\s+\d+\s+days?\s+guaranteed/gi,
    label: "guaranteed income claim with specific amount and timeframe",
    classId: "promised_result",
  },
  {
    pattern: /make\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s+(?:in\s+\d+\s+days?|this\s+weekend|overnight)\s+guaranteed/gi,
    label: "guaranteed income claim with specific amount and timeframe",
    classId: "promised_result",
  },
  // Also catch "lakhs/crore" written out with guaranteed
  {
    pattern: /(earn|make)\s+[\d,.]+\s*(lakhs?|crore|cr)\s+.*?\s+guaranteed/gi,
    label: "guaranteed income claim with specific amount and timeframe",
    classId: "promised_result",
  },
  // Second-person personal attribute targeting (Meta discriminatory ad policy)
  {
    pattern: /are\s+you\s+(a\s+)?(struggling\s+)?\d+[\s-]year[\s-]old/gi,
    label: "personal attribute targeting in second person",
    classId: "second_person_protected_attribute",
  },
];

// ---------------------------------------------------------------------------
// TIER 2 — PIVOT_REQUIRED (16-hook pivot table)
// ---------------------------------------------------------------------------
interface PivotRule {
  id: string;
  pattern: RegExp;
  pivot: (match: string) => string;
  /** Compliance class this rule belongs to. See ComplianceTrigger.classId. */
  classId: string;
  /**
   * Optional veto, consulted with the match and its position in the ORIGINAL text. Returning
   * true leaves the span untouched and records no trigger — the rule is treated as not having
   * fired. Used where a pattern is correct about the word but wrong about the sentence.
   */
  exempt?: (match: string, offset: number, whole: string) => boolean;
}

/**
 * NEGATED GUARANTEE — the tail of the text immediately BEFORE a "guaranteed" match, when that
 * match sits inside a denial.
 *
 * THE DEFECT THIS FIXES (measured on landing page 238, three real fields): rule 2's bare
 * `\bguaranteed\b` cannot tell "the output is guaranteed" from "there is no waitlist with a
 * guaranteed place". Two of the three blocking hits on that page were sentences whose whole
 * purpose was to DENY a guarantee — "no guaranteed timeline", "no waitlist with a guaranteed
 * place" — and the pivot rewrote them into nonsense ("no waitlist with a Proven approach used by
 * thousands of professionals place") before the caller reported them as urgency violations.
 *
 * DELIBERATELY TIGHT, in two independent ways, because a loose guard here is a hole a real
 * guarantee claim walks through:
 *
 *   1. AT MOST FOUR intervening words. "no waitlist with a guaranteed place" uses three.
 *      "There is no reason to doubt that the outcome is guaranteed" uses seven and still blocks.
 *   2. NO COPULA may intervene. A copula starts a new predicate, which is the grammatical signal
 *      that the negation governs something ELSE and the guarantee is being asserted afresh:
 *      "not a guaranteed outcome" is a denial; "not the point — results are guaranteed" is not.
 *
 * Anchored with \s*$ so it only ever matches a negation ending exactly where the guarantee word
 * begins. It is applied to a bounded 60-character prefix, never to the whole field.
 */
const NEGATED_GUARANTEE_TAIL =
  /\b(?:no|not|never)\b(?:\s+(?!is\b|are\b|was\b|were\b|be\b|been\b|being\b)[\w'’-]+){0,4}\s*$/i;

/** True when the "guaranteed" match at `offset` is governed by a clear denial. */
function guaranteeIsNegated(match: string, offset: number, whole: string): boolean {
  const prefix = whole.slice(Math.max(0, offset - 60), offset);
  return NEGATED_GUARANTEE_TAIL.test(prefix);
}

const PIVOT_RULES: PivotRule[] = [
  // 1. Make/Earn [amount] in X days (any currency symbol)
  {
    id: "1",
    pattern: /(make|earn)\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s*(?:\/\w+\s+)?(?:in|within)\s+\d+\s+(?:days?|weeks?|months?)/gi,
    pivot: () => "Learn the framework professionals use to build sustainable revenue",
    classId: "promised_result",
  },
  // 1b. Make/Earn X lakhs/crore in Y days (written-out Indian denominations, optional currency symbol)
  {
    id: "1b",
    pattern: /(make|earn)\s+(?:₹)?[\d,.]+\s*(?:lakhs?|lacs?|crore|cr)\s*(?:(?:\/\w+|per\s+\w+)\s+)?(?:in|within)\s+\d+\s+(?:days?|weeks?|months?)/gi,
    pivot: () => "Learn the framework professionals use to build sustainable revenue",
    classId: "promised_result",
  },
  // 2. Guaranteed results / 100% success rate / guaranteed
  //    ⚠️ A GUARANTEE CLAIM, NOT AN URGENCY DEVICE. This rule was the single largest source of
  //    mislabelled hits before `classId` existed — every verdict from this file was reported by
  //    `complianceAxis` as `deceptive_urgency`, so a guarantee with no deadline anywhere in it
  //    came back to the coach as a deadline problem. See ComplianceTrigger.
  {
    id: "2",
    pattern: /\b(guaranteed\s+results?|100%\s+success\s+rate|guaranteed)\b/gi,
    pivot: () => "Proven approach used by thousands of professionals",
    classId: "promised_result",
    exempt: guaranteeIsNegated,
  },
  // 3. Get rich / passive income guaranteed / financial freedom guaranteed
  {
    id: "3",
    pattern: /\b(get\s+rich|passive\s+income\s+guaranteed|financial\s+freedom\s+guaranteed)\b/gi,
    pivot: () => "Build a scalable income model through proven systems",
    classId: "promised_result",
  },
  // 4. Lose X pounds / lose weight guaranteed
  {
    id: "4",
    pattern: /\blose\s+(\d+\s+)?pounds?\b|\blose\s+weight\s+guaranteed\b/gi,
    pivot: () => "Reach your health goals with a proven system",
    classId: "promised_result",
  },
  // 5. Secret formula / forbidden / leaked / glitch / banned
  {
    id: "5",
    pattern: /\b(secret\s+formula|forbidden|leaked|glitch|banned)\b/gi,
    pivot: () => "The proven method experts rely on",
    classId: "deceptive_urgency",
  },
  // 6. Last chance / doors closing forever / never available again
  {
    id: "6",
    pattern: /\b(last\s+chance|doors?\s+closing\s+forever|never\s+available\s+again)\b/gi,
    pivot: () => "Limited-time access to this offer",
    classId: "deceptive_urgency",
  },
  // 6b. Gone forever / pricing dies / offer expires tonight — hard deadline scarcity
  {
    id: "6b",
    pattern: /\b(gone\s+forever|pricing\s+dies\s*(?:tonight|today|now)?|offer\s+expires?\s*(tonight|today|now)|price\s+(?:goes\s+up|increases?|doubles?)\s+(tonight|today|at\s+midnight))\b/gi,
    pivot: () => "Limited-time access to this offer",
    classId: "deceptive_urgency",
  },
  // 6c. Expires today / ends today / closes today / deadline tonight
  {
    id: "6c",
    pattern: /\b(expires?\s+today|ends?\s+today|closes?\s+today|deadline\s+tonight|offer\s+ends?\s+today)\b/gi,
    pivot: () => "Limited-time access to this offer",
    classId: "deceptive_urgency",
  },
  // 7. Everyone is getting rich but you / you're falling behind
  {
    id: "7",
    pattern: /\b(everyone\s+is\s+getting\s+rich\s+but\s+you|you'?re?\s+falling\s+behind)\b/gi,
    pivot: () => "Join thousands of professionals who have mastered this skill",
    classId: "second_person_protected_attribute",
  },
  // 8. Want a fatter bank account / sick of being broke
  {
    id: "8",
    pattern: /\b(want\s+a\s+fatter\s+bank\s+account|sick\s+of\s+being\s+broke)\b/gi,
    pivot: () => "Are you ready to build a more predictable revenue model?",
    classId: "second_person_protected_attribute",
  },
  // 9. I stole this secret / they don't want you to know
  {
    id: "9",
    pattern: /\b(i\s+stole\s+this\s+secret|they\s+don'?t\s+want\s+you\s+to\s+know)\b/gi,
    pivot: () => "The one ingredient your process is missing",
    classId: "deceptive_urgency",
  },
  // 10. From $0/$₹0 to $XM/₹X lakhs in X days / overnight success
  {
    id: "10",
    pattern: /\b(from\s+(?:\$|₹|£|€)0\s+to\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s+in\s+\d+\s+days?|overnight\s+success)\b/gi,
    pivot: () => "The 30-day shift that transformed my approach",
    classId: "promised_result",
  },
  // 11. Click here to see the secret
  {
    id: "11",
    pattern: /\bclick\s+here\s+to\s+see\s+the\s+secret\b/gi,
    pivot: () => "Don't click this unless you are serious about your goal",
    classId: "deceptive_urgency",
  },
  // 12. 100% guaranteed returns / no risk
  {
    id: "12",
    pattern: /\b(100%\s+guaranteed\s+returns?|no[\s-]risk\s+guarantee)\b/gi,
    pivot: () => "A structured approach to results with clear milestones",
    classId: "promised_result",
  },
  // 13. Cure your [condition] / treat [disease]
  {
    id: "13",
    pattern: /\b(cure\s+your|treat\s+your)\s+\w+/gi,
    pivot: () => "Support your journey toward better health outcomes",
    classId: "clinical_outcome_claim",
  },
  // 14. Are you a struggling 40-year-old / direct personal attribute targeting
  {
    id: "14",
    pattern: /\bare\s+you\s+a\s+(struggling\s+)?\w[\w\s-]*\?/gi,
    pivot: () => "For those navigating this scenario while building toward their goal",
    classId: "second_person_protected_attribute",
  },
  // 15. Make $10k/₹X lakhs this weekend
  {
    id: "15",
    pattern: /(make|earn)\s+(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s+this\s+weekend/gi,
    pivot: () => "The framework coaches use to stabilise and grow monthly revenue",
    classId: "promised_result",
  },
  // 16. Passive income secrets / make money while you sleep guaranteed
  {
    id: "16",
    pattern: /\b(passive\s+income\s+secrets?|make\s+money\s+while\s+you\s+sleep\s+guaranteed)\b/gi,
    pivot: () => "Build automated systems that generate consistent client flow",
    classId: "promised_result",
  },
];

// ---------------------------------------------------------------------------
// Soft flag patterns (log only — do not modify text)
// ---------------------------------------------------------------------------
const SOFT_FLAG_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /(?:\$|₹|£|€)[\d,.]+[kKlLmM]?\s*(?:per\s+(?:month|week|day|year)|\/mo|\/yr|\/wk)?/gi,
    label: "income claim with specific amount",
  },
  {
    pattern: /[\d,.]+\s*(?:lakhs?|lacs?|crore|cr)\s*(?:per\s+(?:month|week|day|year)|\/mo|\/yr|\/wk)?/gi,
    label: "income claim with specific amount (INR denomination)",
  },
  {
    pattern: /before\s+and\s+after|before\/after/gi,
    label: "before and after comparison",
  },
  {
    pattern: /limited\s+spots?|only\s+\d+\s+left|closing\s+soon/gi,
    label: "urgency language",
  },
  {
    pattern: /are\s+you\s+(a\s+)?\w[\w\s]+\?/gi,
    label: "borderline personal attribute language",
  },
];

// ---------------------------------------------------------------------------
// Main filter function
// ---------------------------------------------------------------------------
export function complianceFilter(text: string, _context?: string): ComplianceResult {
  if (!text || typeof text !== "string") {
    return {
      cleanedText: text ?? "",
      classification: "VALID",
      wasModified: false,
      flaggedTerms: [],
      pivotApplied: null,
      triggers: [],
    };
  }

  const flaggedTerms: string[] = [];
  const triggers: ComplianceTrigger[] = [];

  // --- TIER 1: REJECTED check ---
  for (const { pattern, label, classId } of REJECTED_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      flaggedTerms.push(`${label}: "${matches[0]}"`);
      triggers.push({ ruleId: label, classId, span: matches[0] });
    }
  }
  if (flaggedTerms.length > 0) {
    return {
      cleanedText: text, // return original unchanged
      classification: "REJECTED",
      wasModified: false,
      flaggedTerms,
      pivotApplied: null,
      triggers,
    };
  }

  // --- TIER 2: PIVOT_REQUIRED check ---
  let cleanedText = text;
  let pivotApplied: string | null = null;
  let wasModified = false;

  for (const rule of PIVOT_RULES) {
    const before = cleanedText;
    // A function replacer, so the ACTUAL matched span is captured as the rule fires and an
    // `exempt` rule can decline the match in place. Offsets are into `cleanedText` — the text
    // this rule is actually reading — not into the original, because earlier rules may already
    // have rewritten spans ahead of this one.
    cleanedText = cleanedText.replace(rule.pattern, (...args: any[]) => {
      const match = String(args[0]);
      // replace() passes (match, ...groups, offset, whole); with named groups a final object
      // follows, so locate the offset by type rather than by position.
      const offset = Number(args.find((a, i) => i > 0 && typeof a === "number"));
      const whole = before;
      if (rule.exempt?.(match, offset, whole)) return match;
      triggers.push({ ruleId: rule.id, classId: rule.classId, span: match });
      return rule.pivot(match);
    });
    if (cleanedText !== before) {
      wasModified = true;
      pivotApplied = rule.id;
    }
  }

  if (wasModified) {
    // Collapse overlapping pivot outputs: when multiple scarcity patterns match
    // the same string, the same pivot phrase can appear multiple times.
    // Deduplicate by collapsing repeated pivot phrases separated by punctuation/whitespace.
    const pivotPhrases = PIVOT_RULES.map(r => r.pivot(""));
    for (const phrase of pivotPhrases) {
      // Match the phrase appearing 2+ times separated by any non-alphanumeric chars
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const dupePattern = new RegExp(`(${escaped})([^a-zA-Z0-9]*)(${escaped})`, "gi");
      while (dupePattern.test(cleanedText)) {
        cleanedText = cleanedText.replace(dupePattern, "$1");
      }
    }
    // Clean up leftover dangling punctuation/whitespace from collapsed duplicates
    cleanedText = cleanedText.replace(/\s*[—–\-]\s*$/g, "").replace(/\s{2,}/g, " ").trim();

    // Collect soft flags on cleaned text
    for (const { pattern, label } of SOFT_FLAG_PATTERNS) {
      const matches = cleanedText.match(pattern);
      if (matches) flaggedTerms.push(`${label}: "${matches[0]}"`);
    }
    return {
      cleanedText,
      classification: "PIVOT_REQUIRED",
      wasModified: true,
      flaggedTerms,
      pivotApplied,
      triggers,
    };
  }

  // --- TIER 3: VALID ---
  // Still collect soft flags for logging
  for (const { pattern, label } of SOFT_FLAG_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) flaggedTerms.push(`${label}: "${matches[0]}"`);
  }

  return {
    cleanedText: text,
    classification: "VALID",
    wasModified: false,
    flaggedTerms,
    pivotApplied: null,
    triggers,
  };
}

// ---------------------------------------------------------------------------
// Global Negative Prompts — inject into every Meta ad generation call
// ---------------------------------------------------------------------------
export function getGlobalNegativePrompts(): string[] {
  return [
    "adult content",
    "nudity",
    "sexually suggestive",
    "hate speech",
    "discriminatory targeting imagery",
    "misleading financial claims",
    "unrealistic ROI",
    "guaranteed profit",
    "distorted faces",
    "extra limbs",
    "offensive gestures",
    "harmful misinformation",
    "unauthorized financial advice",
    "predatory lending",
    "before and after body shaming",
    "extreme weight loss claims",
    "miracle cure language",
    "get rich quick imagery",
  ];
}

// ---------------------------------------------------------------------------
// Convenience helper: filter a record of string fields
// ---------------------------------------------------------------------------
export function filterRecord<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[]
): { cleaned: T; anyModified: boolean; classification: ComplianceClassification; allFlaggedTerms: string[] } {
  const cleaned = { ...record };
  let anyModified = false;
  let overallClassification: ComplianceClassification = "VALID";
  const allFlaggedTerms: string[] = [];

  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string") {
      const result = complianceFilter(value);
      if (result.classification === "REJECTED") {
        overallClassification = "REJECTED";
        allFlaggedTerms.push(...result.flaggedTerms);
        // Don't write — keep original for error reporting
        continue;
      }
      (cleaned as Record<string, unknown>)[field as string] = result.cleanedText;
      if (result.wasModified) anyModified = true;
      if (result.classification === "PIVOT_REQUIRED" && overallClassification !== "REJECTED") {
        overallClassification = "PIVOT_REQUIRED";
      }
      allFlaggedTerms.push(...result.flaggedTerms);
    }
  }

  return { cleaned, anyModified, classification: overallClassification, allFlaggedTerms };
}
