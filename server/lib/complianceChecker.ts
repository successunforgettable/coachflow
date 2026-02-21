// server/lib/complianceChecker.ts
// Meta Ad Compliance Checker - v1.0+ (Updated Feb 2026)
// Now supports database-driven banned phrases with hardcoded fallback

import { getDb } from "../db";
import { bannedPhrases, complianceVersions } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface ComplianceResult {
  compliant: boolean
  score: number // 0-100
  issues: ComplianceIssue[]
  suggestions: string[]
  version: string
  lastUpdated: string
  nextReviewDue: string
}

export interface ComplianceIssue {
  severity: 'critical' | 'warning' | 'info'
  phrase: string
  reason: string
  suggestion: string
}

interface ViolationRule {
  phrases: string[]
  reason: string
  suggestion: string
}

// FALLBACK: Critical violations — will likely cause ad rejection
// Used only if database is unavailable
const FALLBACK_CRITICAL_VIOLATIONS: ViolationRule[] = [
  {
    phrases: ["make $", "earn $", "make money", "earn money", "passive income", "financial freedom", "quit your job", "quit your 9-5", "replace your income", "6 figure", "6-figure", "seven figure", "7 figure", "7-figure"],
    reason: "Income claim — violates Meta financial services policy",
    suggestion: "Focus on the coaching process and skills, not income outcomes"
  },
  {
    phrases: ["guaranteed", "100% guaranteed", "money back guaranteed", "results guaranteed", "i guarantee"],
    reason: "Guarantee claim — violates Meta misleading content policy",
    suggestion: "Replace with 'proven framework' or 'structured methodology'"
  },
  {
    phrases: ["lose weight fast", "lose 10kg", "lose 20kg", "drop dress sizes", "get abs", "burn fat fast", "slim down fast"],
    reason: "Personal health transformation claim — violates Meta health policy",
    suggestion: "Focus on the program structure and approach, not specific physical outcomes"
  },
  {
    phrases: ["secret method", "secret technique", "secret formula", "secret system", "they don't want you to know", "what they won't tell you", "banned", "underground method"],
    reason: "Sensationalist language — violates Meta misleading content policy",
    suggestion: "Replace with 'counterintuitive approach' or 'overlooked strategy'"
  },
  {
    phrases: ["doctors hate", "experts hate", "gurus hate", "industry secret"],
    reason: "Misleading authority claim — violates Meta policy",
    suggestion: "Remove entirely or reframe as a genuine differentiator"
  },
  {
    phrases: ["cure", "treat", "heal", "eliminate anxiety", "cure depression", "fix your mental health"],
    reason: "Medical/health claim — violates Meta health and wellness policy",
    suggestion: "Use 'manage', 'support', 'develop tools for' instead"
  },
  {
    phrases: ["only 1 spot left", "only 2 spots left", "only 3 spots left", "last chance", "expires tonight", "offer ends today"],
    reason: "Potentially false scarcity — violates Meta misleading content policy",
    suggestion: "Only use if literally true. Otherwise use 'Applications open' or 'Enrolment now available'"
  }
]

// FALLBACK: Warnings — may trigger review, should be reworded
const FALLBACK_WARNING_VIOLATIONS: ViolationRule[] = [
  {
    phrases: ["#1 coach", "best coach", "top coach", "world's best", "number one"],
    reason: "Unqualified superlative — may trigger review",
    suggestion: "Qualify with specific category: '#1 mindset coach for entrepreneurs'"
  },
  {
    phrases: ["shocking", "unbelievable", "you won't believe", "incredible results", "jaw-dropping"],
    reason: "Sensationalist language — may trigger review",
    suggestion: "Replace with specific, credible language about the outcome"
  },
  {
    phrases: ["before i was", "i used to be", "i was broke", "i was struggling"],
    reason: "Before/after transformation framing — may trigger review",
    suggestion: "Focus on the journey and learning, not the stark before/after contrast"
  },
  {
    phrases: ["click here", "click now", "act now", "don't wait", "stop scrolling"],
    reason: "Aggressive CTA — may trigger review",
    suggestion: "Use approved CTAs: 'Learn More', 'Book a Call', 'Get Started'"
  },
  {
    phrases: ["free money", "get paid", "work from home and earn", "side hustle income"],
    reason: "Income claim framing — may trigger review",
    suggestion: "Focus on the coaching skill or transformation, not the earning potential"
  }
]

// Simple in-memory cache to avoid DB queries on every check
let cachedPhrases: { critical: ViolationRule[], warning: ViolationRule[] } | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch banned phrases from database and convert to violation rules
 * Falls back to hardcoded rules if database is unavailable
 */
async function getViolationRules(): Promise<{ critical: ViolationRule[], warning: ViolationRule[] }> {
  // Return cached data if still valid
  if (cachedPhrases && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedPhrases
  }

  try {
    const db = await getDb()
    if (!db) throw new Error("Database not available")

    // Fetch all active banned phrases
    const phrases = await db
      .select()
      .from(bannedPhrases)
      .where(eq(bannedPhrases.active, true))

    // Group by category
    const criticalPhrases = phrases.filter(p => p.category === 'critical')
    const warningPhrases = phrases.filter(p => p.category === 'warning')

    // Convert to violation rules format (group by description)
    const groupByDescription = (items: typeof phrases) => {
      const grouped = new Map<string, string[]>()
      items.forEach(item => {
        const key = item.description || "Meta policy violation"
        if (!grouped.has(key)) {
          grouped.set(key, [])
        }
        grouped.get(key)!.push(item.phrase)
      })
      
      return Array.from(grouped.entries()).map(([reason, phrases]) => {
        // Get suggestion from first phrase with this description
        const firstItem = items.find(i => (i.description || "Meta policy violation") === reason)
        return {
          phrases,
          reason,
          suggestion: firstItem?.suggestion || "Rephrase to comply with Meta advertising policies"
        }
      })
    }

    const critical = groupByDescription(criticalPhrases)
    const warning = groupByDescription(warningPhrases)

    // Update cache
    cachedPhrases = { critical, warning }
    cacheTimestamp = Date.now()

    return { critical, warning }
  } catch (error) {
    console.error("Failed to fetch banned phrases from database, using fallback:", error)
    // Return hardcoded fallback
    return {
      critical: FALLBACK_CRITICAL_VIOLATIONS,
      warning: FALLBACK_WARNING_VIOLATIONS
    }
  }
}

/**
 * Get compliance version from database
 * Falls back to hardcoded version if database is unavailable
 */
async function getComplianceVersion(): Promise<{ version: string, lastUpdated: string, nextReviewDue: string }> {
  try {
    const db = await getDb()
    if (!db) throw new Error("Database not available")

    const [version] = await db
      .select()
      .from(complianceVersions)
      .orderBy(complianceVersions.id)
      .limit(1)

    if (version) {
      return {
        version: version.version,
        lastUpdated: version.lastUpdated.toISOString().split('T')[0],
        nextReviewDue: version.nextReviewDue.toISOString().split('T')[0]
      }
    }
  } catch (error) {
    console.error("Failed to fetch compliance version from database, using fallback:", error)
  }

  // Fallback to hardcoded version
  return {
    version: 'v1.0',
    lastUpdated: '2026-02-21',
    nextReviewDue: '2026-05-21'
  }
}

/**
 * Check if a phrase appears inside quotation marks (testimonial/case study context)
 * Handles both straight quotes (") and smart quotes ("")
 * Case-insensitive to catch "Guaranteed" vs "guaranteed"
 */
function isPhraseQuoted(adCopy: string, phrase: string): boolean {
  const lowerCopy = adCopy.toLowerCase()
  const lowerPhrase = phrase.toLowerCase()
  
  return (
    lowerCopy.includes(`"${lowerPhrase}"`) ||
    lowerCopy.includes(`'${lowerPhrase}'`) ||
    lowerCopy.includes(`\u201c${lowerPhrase}\u201d`) || // Smart double quotes
    lowerCopy.includes(`\u2018${lowerPhrase}\u2019`)    // Smart single quotes
  )
}

/**
 * Check ad copy compliance against Meta advertising policies
 * Fetches banned phrases from database with fallback to hardcoded rules
 */
export async function checkCompliance(adCopy: string): Promise<ComplianceResult> {
  const lowerCopy = adCopy.toLowerCase()
  const issues: ComplianceIssue[] = []
  let score = 100

  // Fetch violation rules (from DB or fallback)
  const { critical: CRITICAL_VIOLATIONS, warning: WARNING_VIOLATIONS } = await getViolationRules()

  // Check critical violations
  for (const violation of CRITICAL_VIOLATIONS) {
    for (const phrase of violation.phrases) {
      if (lowerCopy.includes(phrase.toLowerCase())) {
        // CRITICAL FIX: Skip if phrase is quoted (testimonial/case study context)
        if (isPhraseQuoted(adCopy, phrase)) {
          continue
        }
        
        issues.push({
          severity: 'critical',
          phrase,
          reason: violation.reason,
          suggestion: violation.suggestion
        })
        score -= 20 // Each critical violation costs 20 points
        break // Only flag once per violation category
      }
    }
  }

  // Check warnings
  for (const violation of WARNING_VIOLATIONS) {
    for (const phrase of violation.phrases) {
      if (lowerCopy.includes(phrase.toLowerCase())) {
        // CRITICAL FIX: Skip if phrase is quoted
        if (isPhraseQuoted(adCopy, phrase)) {
          continue
        }
        
        issues.push({
          severity: 'warning',
          phrase,
          reason: violation.reason,
          suggestion: violation.suggestion
        })
        score -= 8 // Each warning costs 8 points
        break
      }
    }
  }

  // Cap score at 0
  score = Math.max(0, score)

  // Determine overall compliance
  const hasCritical = issues.some(i => i.severity === 'critical')
  const compliant = !hasCritical && score >= 70

  // Build suggestions list
  const suggestions = issues.map(i => `Replace "${i.phrase}": ${i.suggestion}`)

  // Get version info
  const versionInfo = await getComplianceVersion()

  return {
    compliant,
    score,
    issues,
    suggestions,
    version: versionInfo.version,
    lastUpdated: versionInfo.lastUpdated,
    nextReviewDue: versionInfo.nextReviewDue
  }
}

export function getComplianceLabel(score: number): {
  label: string
  color: string
  emoji: string
} {
  if (score >= 90) return { label: 'Meta Compliant', color: '#10B981', emoji: '✅' }
  if (score >= 70) return { label: 'Mostly Compliant', color: '#F59E0B', emoji: '⚠️' }
  if (score >= 50) return { label: 'Review Required', color: '#EF4444', emoji: '🚫' }
  return { label: 'Non-Compliant', color: '#DC2626', emoji: '❌' }
}

/**
 * Get compliance color for list view dots
 */
export function getComplianceColor(score: number): string {
  if (score >= 90) return '#10B981' // Green
  if (score >= 70) return '#F59E0B' // Amber
  return '#EF4444' // Red
}

/**
 * Clear the cached phrases (useful after admin updates)
 */
export function clearComplianceCache(): void {
  cachedPhrases = null
  cacheTimestamp = 0
}
