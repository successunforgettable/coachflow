// Client-side wrapper for compliance checking
// This duplicates the server-side logic for UI display purposes only
// The authoritative compliance check happens on the server

interface ComplianceIssue {
  severity: 'critical' | 'warning' | 'info';
  phrase: string;
  reason: string;
  suggestion: string;
}

interface ComplianceResult {
  compliant: boolean;
  score: number;
  issues: ComplianceIssue[];
  suggestions: string[];
  version: string;
  lastUpdated: string;
  nextReviewDue: string;
}

// Critical violations
const CRITICAL_VIOLATIONS = [
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
];

// Warnings
const WARNING_VIOLATIONS = [
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
];

function isPhraseQuoted(adCopy: string, phrase: string): boolean {
  const lowerCopy = adCopy.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();
  
  return (
    lowerCopy.includes(`"${lowerPhrase}"`) ||
    lowerCopy.includes(`'${lowerPhrase}'`) ||
    lowerCopy.includes(`\u201c${lowerPhrase}\u201d`) || // Smart double quotes
    lowerCopy.includes(`\u2018${lowerPhrase}\u2019`)    // Smart single quotes
  );
}

export function checkCompliance(adCopy: string): ComplianceResult {
  if (!adCopy || typeof adCopy !== 'string') {
    return { issues: [], score: 100, passed: true };
  }
  const lowerCopy = adCopy.toLowerCase();
  const issues: ComplianceIssue[] = [];
  let score = 100;

  // Check critical violations
  for (const violation of CRITICAL_VIOLATIONS) {
    for (const phrase of violation.phrases) {
      if (lowerCopy.includes(phrase.toLowerCase())) {
        if (isPhraseQuoted(adCopy, phrase)) {
          continue;
        }
        
        issues.push({
          severity: 'critical',
          phrase,
          reason: violation.reason,
          suggestion: violation.suggestion
        });
        score -= 20;
        break;
      }
    }
  }

  // Check warnings
  for (const violation of WARNING_VIOLATIONS) {
    for (const phrase of violation.phrases) {
      if (lowerCopy.includes(phrase.toLowerCase())) {
        if (isPhraseQuoted(adCopy, phrase)) {
          continue;
        }
        
        issues.push({
          severity: 'warning',
          phrase,
          reason: violation.reason,
          suggestion: violation.suggestion
        });
        score -= 8;
        break;
      }
    }
  }

  score = Math.max(0, score);
  const hasCritical = issues.some(i => i.severity === 'critical');
  const compliant = !hasCritical && score >= 70;
  const suggestions = issues.map(i => `Replace "${i.phrase}": ${i.suggestion}`);

  return {
    compliant,
    score,
    issues,
    suggestions,
    version: 'v1.0',
    lastUpdated: '2026-02-21',
    nextReviewDue: '2026-05-21'
  };
}
