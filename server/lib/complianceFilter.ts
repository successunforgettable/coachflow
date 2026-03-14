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

export interface ComplianceResult {
  cleanedText: string;
  classification: ComplianceClassification;
  wasModified: boolean;
  flaggedTerms: string[];
  pivotApplied: string | null;
}

// ---------------------------------------------------------------------------
// TIER 1 — REJECTED patterns (hard ban — block entirely, do not write to DB)
// ---------------------------------------------------------------------------
const REJECTED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Adult / sexual content
  {
    pattern: /\b(porn|pornography|nude|nudity|naked|sexually explicit|adult content|erotic)\b/gi,
    label: "adult content or sexual reference",
  },
  // Hate speech / discriminatory targeting
  {
    pattern: /\b(hate speech|racial slur|ethnic slur|white supremac|nazi|antisemit)\b/gi,
    label: "hate speech",
  },
  {
    pattern: /based\s+on\s+your\s+(race|religion|financial\s+status)/gi,
    label: "discriminatory targeting language",
  },
  // Medical misinformation — cure/diagnose/treat a disease
  {
    pattern: /\b(cure|diagnose|treat)\s+(cancer|diabetes|hiv|aids|covid|alzheimer|depression|anxiety disorder|disease|illness|condition)\b/gi,
    label: "medical misinformation",
  },
  // Guaranteed income with specific dollar amounts AND timeframes
  {
    pattern: /earn\s+\$[\d,]+\s+in\s+\d+\s+days?\s+guaranteed/gi,
    label: "guaranteed income claim with specific dollar amount and timeframe",
  },
  {
    pattern: /make\s+\$[\d,]+\s+(in\s+\d+\s+days?|this\s+weekend|overnight)\s+guaranteed/gi,
    label: "guaranteed income claim with specific dollar amount and timeframe",
  },
  // Second-person personal attribute targeting (Meta discriminatory ad policy)
  {
    pattern: /are\s+you\s+(a\s+)?(struggling\s+)?\d+[\s-]year[\s-]old/gi,
    label: "personal attribute targeting in second person",
  },
];

// ---------------------------------------------------------------------------
// TIER 2 — PIVOT_REQUIRED (16-hook pivot table)
// ---------------------------------------------------------------------------
interface PivotRule {
  id: string;
  pattern: RegExp;
  pivot: (match: string) => string;
}

const PIVOT_RULES: PivotRule[] = [
  // 1. Make/Earn $X in X days
  {
    id: "1",
    pattern: /(make|earn)\s+\$[\d,.]+\s+in\s+\d+\s+days?/gi,
    pivot: () => "Learn the framework professionals use to build sustainable revenue",
  },
  // 2. Guaranteed results / 100% success rate / guaranteed
  {
    id: "2",
    pattern: /\b(guaranteed\s+results?|100%\s+success\s+rate|guaranteed)\b/gi,
    pivot: () => "Proven approach used by thousands of professionals",
  },
  // 3. Get rich / passive income guaranteed / financial freedom guaranteed
  {
    id: "3",
    pattern: /\b(get\s+rich|passive\s+income\s+guaranteed|financial\s+freedom\s+guaranteed)\b/gi,
    pivot: () => "Build a scalable income model through proven systems",
  },
  // 4. Lose X pounds / lose weight guaranteed
  {
    id: "4",
    pattern: /\blose\s+(\d+\s+)?pounds?\b|\blose\s+weight\s+guaranteed\b/gi,
    pivot: () => "Reach your health goals with a proven system",
  },
  // 5. Secret formula / forbidden / leaked / glitch / banned
  {
    id: "5",
    pattern: /\b(secret\s+formula|forbidden|leaked|glitch|banned)\b/gi,
    pivot: () => "The proven method experts rely on",
  },
  // 6. Last chance / doors closing forever / never available again
  {
    id: "6",
    pattern: /\b(last\s+chance|doors?\s+closing\s+forever|never\s+available\s+again)\b/gi,
    pivot: () => "Limited-time access to this offer",
  },
  // 7. Everyone is getting rich but you / you're falling behind
  {
    id: "7",
    pattern: /\b(everyone\s+is\s+getting\s+rich\s+but\s+you|you'?re?\s+falling\s+behind)\b/gi,
    pivot: () => "Join thousands of professionals who have mastered this skill",
  },
  // 8. Want a fatter bank account / sick of being broke
  {
    id: "8",
    pattern: /\b(want\s+a\s+fatter\s+bank\s+account|sick\s+of\s+being\s+broke)\b/gi,
    pivot: () => "Are you ready to build a more predictable revenue model?",
  },
  // 9. I stole this secret / they don't want you to know
  {
    id: "9",
    pattern: /\b(i\s+stole\s+this\s+secret|they\s+don'?t\s+want\s+you\s+to\s+know)\b/gi,
    pivot: () => "The one ingredient your process is missing",
  },
  // 10. From $0 to $1M in X days / overnight success
  {
    id: "10",
    pattern: /\b(from\s+\$0\s+to\s+\$[\d,.]+\s+in\s+\d+\s+days?|overnight\s+success)\b/gi,
    pivot: () => "The 30-day shift that transformed my approach",
  },
  // 11. Click here to see the secret
  {
    id: "11",
    pattern: /\bclick\s+here\s+to\s+see\s+the\s+secret\b/gi,
    pivot: () => "Don't click this unless you are serious about your goal",
  },
  // 12. 100% guaranteed returns / no risk
  {
    id: "12",
    pattern: /\b(100%\s+guaranteed\s+returns?|no[\s-]risk\s+guarantee)\b/gi,
    pivot: () => "A structured approach to results with clear milestones",
  },
  // 13. Cure your [condition] / treat [disease]
  {
    id: "13",
    pattern: /\b(cure\s+your|treat\s+your)\s+\w+/gi,
    pivot: () => "Support your journey toward better health outcomes",
  },
  // 14. Are you a struggling 40-year-old / direct personal attribute targeting
  {
    id: "14",
    pattern: /\bare\s+you\s+a\s+(struggling\s+)?\w[\w\s-]*\?/gi,
    pivot: () => "For those navigating this scenario while building toward their goal",
  },
  // 15. Make $10k this weekend
  {
    id: "15",
    pattern: /\bmake\s+\$[\d,.]+\s+this\s+weekend\b/gi,
    pivot: () => "The framework coaches use to stabilise and grow monthly revenue",
  },
  // 16. Passive income secrets / make money while you sleep guaranteed
  {
    id: "16",
    pattern: /\b(passive\s+income\s+secrets?|make\s+money\s+while\s+you\s+sleep\s+guaranteed)\b/gi,
    pivot: () => "Build automated systems that generate consistent client flow",
  },
];

// ---------------------------------------------------------------------------
// Soft flag patterns (log only — do not modify text)
// ---------------------------------------------------------------------------
const SOFT_FLAG_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /\$[\d,.]+\s*(per\s+(month|week|day|year)|\/mo|\/yr|\/wk)?/gi,
    label: "income claim with specific dollar amount",
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
    };
  }

  const flaggedTerms: string[] = [];

  // --- TIER 1: REJECTED check ---
  for (const { pattern, label } of REJECTED_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      flaggedTerms.push(`${label}: "${matches[0]}"`);
    }
  }
  if (flaggedTerms.length > 0) {
    return {
      cleanedText: text, // return original unchanged
      classification: "REJECTED",
      wasModified: false,
      flaggedTerms,
      pivotApplied: null,
    };
  }

  // --- TIER 2: PIVOT_REQUIRED check ---
  let cleanedText = text;
  let pivotApplied: string | null = null;
  let wasModified = false;

  for (const rule of PIVOT_RULES) {
    const before = cleanedText;
    cleanedText = cleanedText.replace(rule.pattern, rule.pivot);
    if (cleanedText !== before) {
      wasModified = true;
      pivotApplied = rule.id;
    }
  }

  if (wasModified) {
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
