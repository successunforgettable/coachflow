import { describe, it, expect } from "vitest";
import { NO_RESEARCH_STATISTIC_FABRICATION_RULE } from "./copywritingRules";
import { scanTimedClaimsInString } from "./timedClaimScanner";

/**
 * NO_RESEARCH_STATISTIC_FABRICATION_RULE IS POSITIVE-ONLY (CLAUDE.md §14 / §14a — item 15, 2026-09-13).
 *
 * This rule is appended to every deliverable prompt. The version below, kept as a TEST FIXTURE (the one
 * surface §14a requires bad examples on), carried the banned shapes verbatim — including the timed
 * claims "within 90 seconds of waking" and "lose 47 minutes per interruption". It is the NEGATIVE
 * CONTROL: every check here must fail on it, or the check proves nothing (§15c).
 */
const PRE_REWRITE_RULE = `NO RESEARCH STATISTIC FABRICATION: You do not have ground truth on epidemiological, demographic, behavioural-science, or industry-survey findings. Do not invent any population-level statistic in published copy. Specifically banned:
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

/** Every quoted example in the rule — the text a model could reproduce as output. */
const quotedExamples = (rule: string) => [...rule.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

/** The ways a standing prompt carries a failure exemplar. Returns the offending text, so a pass is a list read and found empty. */
function exemplarFaults(rule: string): string[] {
  const faults: string[] = [];
  for (const v of scanTimedClaimsInString(rule).violations) faults.push(`timed claim: ${v.match}`);
  for (const q of quotedExamples(rule)) {
    if (/\d|%/.test(q)) faults.push(`figure in a quoted example: "${q}"`);
    if (/\b(?:stud(?:y|ies)|research|data|science|harvard|stanford|gallup)\b/i.test(q)) faults.push(`research-shaped quoted example: "${q}"`);
  }
  for (const m of rule.matchAll(/\b(?:banned|do not|don't|never|avoid|forbidden)\b/gi)) faults.push(`prohibition wording: ${m[0]}`);
  return faults;
}

describe("the research-statistic rule carries no failure exemplar", () => {
  it("negative control: the pre-rewrite rule fails on every class of check", () => {
    const faults = exemplarFaults(PRE_REWRITE_RULE);
    expect(faults.some((f) => f.startsWith("timed claim"))).toBe(true);
    expect(faults.some((f) => f.startsWith("figure in a quoted example"))).toBe(true);
    expect(faults.some((f) => f.startsWith("research-shaped"))).toBe(true);
    expect(faults.some((f) => f.startsWith("prohibition wording"))).toBe(true);
    expect(faults).toContain(`figure in a quoted example: "first reactive decision within 90 seconds of waking"`);
  });

  it("the live rule: its quoted examples were read, and none is a wrong shape", () => {
    expect(quotedExamples(NO_RESEARCH_STATISTIC_FABRICATION_RULE).length).toBeGreaterThan(5); // it was read, not skipped
    expect(exemplarFaults(NO_RESEARCH_STATISTIC_FABRICATION_RULE)).toEqual([]);
  });

  it("still states the requirement and keeps the positive ladder the pins and the model rely on", () => {
    const r = NO_RESEARCH_STATISTIC_FABRICATION_RULE;
    expect(r).toContain("supplied in the input fields");
    expect(r).toContain("Real statistics supplied in input fields");
    expect(r).toContain("many of the people I work with");
    expect(r).toContain("imagine you're someone who");
  });
});
