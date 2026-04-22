/**
 * Compliance Rewrite Engine (W5 Phase 1 — headlines; Phases 2/3 extend to
 * ad copy and landing pages).
 *
 * Takes a flagged piece of generated content + the specific violations
 * detected by checkCompliance, asks Sonnet 4.6 for a compliant rewrite,
 * re-scores it, and returns the first passing candidate. Retries on weak
 * rewrites up to 2 times (3 attempts total). If every attempt fails, we
 * throw — never return a rewrite we haven't verified, since the whole
 * point of this module is "users can trust what the panel surfaces."
 *
 * Gated at call sites on ENABLE_COMPLIANCE_REWRITES. This module doesn't
 * check the flag itself — it's a pure utility; callers (headlines
 * generator hook, complianceRewrites router) decide whether to invoke.
 *
 * Re-scoring uses checkCompliance (the same function that raised the
 * original flag) rather than scoreAdContent. The user spec said
 * scoreAdContent, but scoreAdContent measures hook strength, not Meta
 * compliance — gating on it would accept a rewrite that still contains
 * "make money" if it has a strong hook. Flagged in the honest-suggestions
 * pass. Both are captured in the retry prompt so Sonnet sees both signals.
 */

import { invokeLLM } from "./llm";
import {
  BANNED_HEADLINE_PATTERNS,
  META_COMPLIANCE_NOTES,
  scoreAdContent,
} from "./copywritingRules";
import { checkCompliance, type ComplianceIssue } from "../lib/complianceChecker";

export type RewriteContentType = "headline" | "body" | "link";

export interface RewriteContext {
  niche?: string | null;
  mechanism?: string | null;
  mainBenefit?: string | null;
}

export interface RewriteResult {
  rewrite: string;
  /** checkCompliance score of the returned rewrite (0-100, >= 70). */
  score: number;
  /** Sonnet's one-sentence rationale for the rewrite, used as audit context. */
  reasoning: string;
}

const MAX_ATTEMPTS = 3;
const MIN_ACCEPTABLE_SCORE = 70;

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
}

// Keywords that trigger Meta's Special Ad Category restrictions (finance,
// housing, employment, health). When any of these appear in the detected
// violations OR the contentType is "body" (where the higher word count
// makes accidental SAC trips much more likely), we append a SAC reminder
// paragraph to the system prompt so Sonnet steers clear even if the source
// itself didn't explicitly trip SAC.
const SAC_TRIGGER_KEYWORDS = [
  // Finance / income
  "income", "financial", "credit", "loan", "investment", "money",
  // Employment
  "employment", "job", "career", "hiring", "salary",
  // Housing
  "housing", "rent", "mortgage", "real estate",
  // Health / medical
  "health", "medical", "weight", "cure", "treat", "heal", "diet", "fitness", "mental",
];

function shouldApplySAC(contentType: RewriteContentType, violations: ComplianceIssue[]): boolean {
  if (contentType === "body") return true;
  const haystack = violations
    .flatMap(v => [v.phrase, v.reason, v.suggestion])
    .join(" ")
    .toLowerCase();
  return SAC_TRIGGER_KEYWORDS.some(kw => haystack.includes(kw));
}

const SAC_REMINDER_BLOCK = [
  ``,
  `META SPECIAL AD CATEGORY REMINDER:`,
  `This rewrite may touch finance / housing / employment / health — Meta's Special Ad Categories (SAC). SAC rules are stricter than baseline compliance. Do NOT:`,
  `- imply income, credit, or financial outcomes, even obliquely ("build wealth", "save on bills" are both SAC-flagged in finance context),`,
  `- target by age, gender, postcode, or protected attribute — write copy that reads as audience-neutral,`,
  `- reference specific health conditions, body changes, medications, or medical outcomes,`,
  `- use employment framing that implies a job guarantee, salary change, or career outcome.`,
  `If the original copy lived in any of these categories, the rewrite should soften outcome claims into *process* language ("learn a structured approach", "work with a certified practitioner") rather than *result* language ("earn $X", "lose Y kg", "get hired").`,
].join("\n");

function buildSystemPrompt(contentType: RewriteContentType, violations: ComplianceIssue[]): string {
  const bannedList = BANNED_HEADLINE_PATTERNS.map((p) => `"${p}"`).join(", ");
  const wordRule = contentType === "headline" ? "Keep headlines 5-14 words."
                 : contentType === "body"     ? "Keep body copy 100-170 words."
                 :                              "Keep link text ≤ 60 characters.";
  const base = [
    `You are a Meta ad compliance rewriter for ${contentType} content.`,
    `Your job: take a flagged piece and produce a version that passes Meta compliance while preserving marketing intent.`,
    ``,
    `Hard rules:`,
    `- Do NOT use these opener patterns: ${bannedList}.`,
    `- Do NOT restate the specific banned phrases the user will show you under "Violations".`,
    `- Preserve niche / mechanism / benefit where given.`,
    `- ${wordRule}`,
    `- Return ONLY JSON, no markdown fences, in this shape:`,
    `  {"rewrite": "...", "reasoning": "one sentence on how you fixed the violation"}`,
    ``,
    META_COMPLIANCE_NOTES,
  ].join("\n");

  return shouldApplySAC(contentType, violations) ? `${base}${SAC_REMINDER_BLOCK}` : base;
}

function buildUserPrompt(
  originalText: string,
  issues: ComplianceIssue[],
  context: RewriteContext,
  previousAttempt?: { rewrite: string; complianceScore: number; hookScore: number; stillFlagged: ComplianceIssue[] },
): string {
  const lines: string[] = [];
  lines.push(`Original (flagged): "${originalText}"`);
  lines.push(``);
  lines.push(`Violations detected:`);
  for (const issue of issues) {
    lines.push(`- [${issue.severity}] "${issue.phrase}" — ${issue.reason}. Suggestion: ${issue.suggestion}`);
  }
  lines.push(``);
  lines.push(`Context:`);
  if (context.niche)       lines.push(`- Niche: ${context.niche}`);
  if (context.mechanism)   lines.push(`- Unique mechanism: ${context.mechanism}`);
  if (context.mainBenefit) lines.push(`- Main benefit: ${context.mainBenefit}`);
  if (!context.niche && !context.mechanism && !context.mainBenefit) {
    lines.push(`- (no service context supplied — stay generic to the niche implied by the original)`);
  }
  if (previousAttempt) {
    lines.push(``);
    lines.push(`Your previous attempt did not pass.`);
    lines.push(`Previous rewrite: "${previousAttempt.rewrite}"`);
    lines.push(`Compliance score: ${previousAttempt.complianceScore}/100 (need >= ${MIN_ACCEPTABLE_SCORE}). Hook score: ${previousAttempt.hookScore}/100.`);
    if (previousAttempt.stillFlagged.length > 0) {
      lines.push(`Still-flagged phrases in your previous attempt:`);
      for (const issue of previousAttempt.stillFlagged) {
        lines.push(`- "${issue.phrase}" — ${issue.reason}`);
      }
      lines.push(`Remove these phrases entirely. Do not paraphrase them — rewrite around them.`);
    } else {
      lines.push(`No banned phrases remain, but the hook is too weak — add specificity (a number, a direct "you", or a curiosity loop).`);
    }
  }
  return lines.join("\n");
}

async function parseJsonResponse(content: string): Promise<{ rewrite: string; reasoning: string }> {
  const stripped = stripMarkdownJson(content);
  const parsed = JSON.parse(stripped);
  if (typeof parsed !== "object" || parsed === null) throw new Error("LLM response is not an object");
  const rewrite  = typeof parsed.rewrite  === "string" ? parsed.rewrite.trim()  : "";
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
  if (!rewrite) throw new Error("LLM response missing 'rewrite' field");
  return { rewrite, reasoning };
}

/**
 * Ask Sonnet to rewrite `originalText` to clear the `violations`, retry up
 * to MAX_ATTEMPTS times, and return the first rewrite that passes
 * checkCompliance >= 70. Throws if no attempt passes — callers decide
 * whether to swallow (skip inserting a rewrite row) or surface.
 */
export async function rewriteForCompliance(
  originalText: string,
  violations: ComplianceIssue[],
  contentType: RewriteContentType,
  context: RewriteContext,
): Promise<RewriteResult> {
  const system = buildSystemPrompt(contentType, violations);

  let previousAttempt: { rewrite: string; complianceScore: number; hookScore: number; stillFlagged: ComplianceIssue[] } | undefined;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const user = buildUserPrompt(originalText, violations, context, previousAttempt);
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user",   content: user },
      ],
      responseFormat: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string") {
      lastError = "Non-string LLM response";
      continue;
    }
    let parsed: { rewrite: string; reasoning: string };
    try {
      parsed = await parseJsonResponse(content);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "JSON parse failed";
      continue;
    }

    // Re-score the rewrite. Compliance gate is the binding one (banned
    // phrases); hook score is captured for the retry prompt and the
    // return value's telemetry.
    const complianceResult = await checkCompliance(parsed.rewrite);
    const hookScore = scoreAdContent(contentType, parsed.rewrite);

    if (complianceResult.score >= MIN_ACCEPTABLE_SCORE && complianceResult.issues.every(i => i.severity !== "critical")) {
      return {
        rewrite: parsed.rewrite,
        score: complianceResult.score,
        reasoning: parsed.reasoning,
      };
    }

    previousAttempt = {
      rewrite: parsed.rewrite,
      complianceScore: complianceResult.score,
      hookScore,
      stillFlagged: complianceResult.issues,
    };
    lastError = `Attempt ${attempt}: compliance ${complianceResult.score}/100, hook ${hookScore}/100, ${complianceResult.issues.length} issue(s) remain.`;
    console.warn(`[complianceRewrite] ${lastError}`);
  }

  throw new Error(
    `rewriteForCompliance: ${MAX_ATTEMPTS} attempts failed to produce a compliant rewrite. Last state: ${lastError}. Original: "${originalText.slice(0, 80)}"`
  );
}

/**
 * Generate `count` independent rewrite alternatives. Used by the
 * "See 2 more alternatives" path in the warning panel. Calls are
 * sequential (not parallel) so each retry loop sees a fresh Sonnet
 * roll — parallelism would likely produce near-identical rewrites.
 */
export async function rewriteForComplianceBatch(
  originalText: string,
  violations: ComplianceIssue[],
  contentType: RewriteContentType,
  context: RewriteContext,
  count: number,
): Promise<RewriteResult[]> {
  const results: RewriteResult[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const r = await rewriteForCompliance(originalText, violations, contentType, context);
      // Simple de-dup: if Sonnet returned an identical rewrite, ask for
      // another. No retry counter — rewriteForCompliance already caps.
      if (!results.some(prev => prev.rewrite === r.rewrite)) {
        results.push(r);
      }
    } catch (err) {
      // Swallow per-alternative failure; caller decides what to do with
      // a short batch (usually: return what we have).
      console.warn(`[complianceRewrite] batch element ${i + 1}/${count} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return results;
}
