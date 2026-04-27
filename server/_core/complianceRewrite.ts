/**
 * Compliance Rewrite Engine (W5 Phase 1 — headlines; Phase 2 ad copy;
 * Phase 3 landing pages).
 *
 * Takes a flagged piece of generated content + the specific violations
 * detected by checkCompliance, asks Sonnet 4.6 by default for a compliant
 * rewrite, re-scores it, and returns the first passing candidate. Retries
 * on weak rewrites up to 2 times (3 attempts total). If every attempt
 * fails, we throw — never return a rewrite we haven't verified, since the
 * whole point of this module is "users can trust what the panel surfaces."
 *
 * Sonnet 4.6 by default; caller may override (Phase 3 landing-page bodies
 * use Opus 4.7). The `modelUsed` field on the return value records which
 * model produced each accepted rewrite so callers can persist it as
 * complianceRewrites.modelUsed for retroactive A/B telemetry.
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
  /** LLM's short rationale for the rewrite, used as audit context. */
  reasoning: string;
  /** Actual model that produced the accepted rewrite (e.g. "claude-opus-4-7"). */
  modelUsed: string;
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

function shouldApplySAC(
  contentType: RewriteContentType,
  violations: ComplianceIssue[],
  isLandingPageContext?: boolean,
): boolean {
  // Phase 3: landing-page surface always gets the SAC reminder regardless
  // of contentType — even short headlines/CTAs on a landing page sit
  // alongside long-form body sections in a single ad-target experience,
  // so the whole page needs to read SAC-clean as one unit.
  if (isLandingPageContext) return true;
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

function buildSystemPrompt(
  contentType: RewriteContentType,
  violations: ComplianceIssue[],
  isLandingPageContext?: boolean,
): string {
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
    `  {"rewrite": "...", "reasoning": "one short sentence (≤25 words) on how you fixed the violation"}`,
    ``,
    META_COMPLIANCE_NOTES,
  ].join("\n");

  return shouldApplySAC(contentType, violations, isLandingPageContext) ? `${base}${SAC_REMINDER_BLOCK}` : base;
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
 * Default model used when the caller does not override. Mirrors the
 * primary in invokeClaudeAPI's PREFERRED_MODELS ladder so the
 * `modelUsed` we record matches what the API actually ran. If invokeLLM's
 * default ladder ever changes, update this constant in lockstep.
 */
const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Ask the model to rewrite `originalText` to clear the `violations`,
 * retry up to MAX_ATTEMPTS times, and return the first rewrite that
 * passes checkCompliance >= 70. Throws if no attempt passes — callers
 * decide whether to swallow (skip inserting a rewrite row) or surface.
 *
 * `modelOverride` — Phase 3 landing-page bodies route here with
 * "claude-opus-4-7". Headlines/links and Phase 1/2 callers omit it and
 * inherit the Sonnet default.
 *
 * `isLandingPageContext` — when true, SAC reminder is unconditionally
 * applied regardless of contentType. The whole landing page reads as
 * one ad-target experience, so the SAC tone has to be consistent
 * across short and long sections.
 */
export async function rewriteForCompliance(
  originalText: string,
  violations: ComplianceIssue[],
  contentType: RewriteContentType,
  context: RewriteContext,
  modelOverride?: string,
  isLandingPageContext?: boolean,
): Promise<RewriteResult> {
  const system = buildSystemPrompt(contentType, violations, isLandingPageContext);

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
      model: modelOverride,
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

    // Runtime type-check on the rewrite-engine response shape. The
    // production landing-page audit (JSON_TYPE inspection across 22
    // rows) confirmed the LLM sometimes emits nested objects where the
    // schema declared `type: "string"`. The rewrite engine uses
    // {type:"json_object"} so its schema isn't even nominally enforced;
    // the type-check below is the content-safety layer. Permanent —
    // Option B's tool-use migration enforces type at the API level, but
    // a no-cost runtime check is belt-and-braces and stays.
    if (typeof parsed.rewrite !== "string" || typeof parsed.reasoning !== "string") {
      const rewriteType = typeof parsed.rewrite;
      const reasoningType = typeof parsed.reasoning;
      lastError = `Attempt ${attempt}: Schema violation — rewrite type=${rewriteType}, reasoning type=${reasoningType}.`;
      console.warn(`[complianceRewrite] ${lastError}`);
      continue;
    }

    // Re-score the rewrite. Compliance gate is the binding one (banned
    // phrases); hook score is captured for the retry prompt and the
    // return value's telemetry.
    const complianceResult = await checkCompliance(parsed.rewrite);
    const hookScore = scoreAdContent(contentType, parsed.rewrite);

    if (complianceResult.score >= MIN_ACCEPTABLE_SCORE && complianceResult.issues.every(i => i.severity !== "critical")) {
      // response.model echoes whichever entry in the PREFERRED_MODELS
      // ladder actually returned 200. Prefer that over the override
      // we requested in case a 404/500 caused a fall-through.
      const modelUsed = response.model || modelOverride || DEFAULT_MODEL;
      return {
        rewrite: parsed.rewrite,
        score: complianceResult.score,
        reasoning: parsed.reasoning,
        modelUsed,
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
 * sequential (not parallel) so each retry loop sees a fresh model
 * roll — parallelism would likely produce near-identical rewrites.
 */
export async function rewriteForComplianceBatch(
  originalText: string,
  violations: ComplianceIssue[],
  contentType: RewriteContentType,
  context: RewriteContext,
  count: number,
  modelOverride?: string,
  isLandingPageContext?: boolean,
): Promise<RewriteResult[]> {
  const results: RewriteResult[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const r = await rewriteForCompliance(originalText, violations, contentType, context, modelOverride, isLandingPageContext);
      // Simple de-dup: if the model returned an identical rewrite, ask
      // for another. No retry counter — rewriteForCompliance already caps.
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
