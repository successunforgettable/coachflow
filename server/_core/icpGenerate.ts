/**
 * runIcpGeneration — the single generation runner behind every ICP path.
 *
 * Retry semantics deliberately differ by failure type (mirrors the shipped bonus
 * generator's hit → failContext → retry shape):
 *
 *   structural  → retry, and THROW if still malformed after the last attempt.
 *                 A structurally malformed ICP must never persist.
 *   grounding   → retry while a Class-A violation is retryable, then LABEL and
 *                 persist best-effort. "Inferred" is a legitimate terminal state,
 *                 so a coach with a thin input is never blocked.
 *
 * Provenance is computed here and returned OUT OF BAND — the caller stores it in
 * its own column and never writes it into the 17 text fields.
 */

import { invokeLLM } from "./llm";
import {
  ICP_SYSTEM_PROMPT,
  ICP_USER_PROMPT,
  ICP_JSON_SCHEMA,
  type ICPServiceInput,
  type ICPAngleInput,
  type ICPLadderAnswers,
} from "./icpPrompts";
import {
  validateIcpStructure,
  buildIcpStructuralFailContext,
  validateIcpGrounding,
  buildIcpGroundingFailContext,
  computeIcpProvenance,
  type IcpProvenance,
  type IcpValidationContext,
} from "./icpGrounding";

export const ICP_VALIDATOR_RETRY_MAX_ATTEMPTS = 3;

export type RunIcpGenerationParams = {
  service: ICPServiceInput;
  angle?: ICPAngleInput | null;
  ladder?: ICPLadderAnswers | null;
  seedBlock?: string | null;
  /** Label used in logs, e.g. "icps.generate" or "icpAngleSuggestions". */
  logLabel?: string;
};

export type RunIcpGenerationResult = {
  icp: Record<string, unknown>;
  provenance: IcpProvenance;
  attempts: number;
};

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
}

function parseIcpResponse(content: unknown): Record<string, unknown> {
  if (content && typeof content === "object") return content as Record<string, unknown>;
  if (typeof content !== "string") throw new Error("Invalid response format from AI");
  const trimmed = content.trim();
  if (trimmed.startsWith("<")) throw new Error("Received HTML instead of JSON from the model endpoint");
  return JSON.parse(stripMarkdownJson(trimmed));
}

export async function runIcpGeneration(params: RunIcpGenerationParams): Promise<RunIcpGenerationResult> {
  const label = params.logLabel ?? "icpGenerate";
  const ctx: IcpValidationContext = {
    service: params.service,
    ladder: params.ladder ?? null,
    angle: params.angle ?? null,
  };
  const basePrompt = ICP_USER_PROMPT(params.service, {
    angle: params.angle ?? null,
    ladder: params.ladder ?? null,
    seedBlock: params.seedBlock ?? null,
  });

  let failContext = "";
  let lastStructuralHits: ReturnType<typeof validateIcpStructure> = [];

  for (let attempt = 1; attempt <= ICP_VALIDATOR_RETRY_MAX_ATTEMPTS; attempt++) {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: ICP_SYSTEM_PROMPT() },
        { role: "user", content: failContext ? `${basePrompt}\n\n${failContext}` : basePrompt },
      ],
      response_format: { type: "json_schema", json_schema: ICP_JSON_SCHEMA },
    });

    let candidate: Record<string, unknown>;
    try {
      candidate = parseIcpResponse(response.choices[0].message.content);
    } catch (err) {
      lastStructuralHits = [{ code: "icp_unparseable", description: err instanceof Error ? err.message : String(err), location: "root" }];
      failContext = buildIcpStructuralFailContext(lastStructuralHits);
      console.warn(`[${label}] unparseable response attempt ${attempt}/${ICP_VALIDATOR_RETRY_MAX_ATTEMPTS}`);
      continue;
    }

    // 1. Structural — hard gate.
    const structural = validateIcpStructure(candidate);
    if (structural.length > 0) {
      lastStructuralHits = structural;
      failContext = buildIcpStructuralFailContext(structural);
      console.warn(
        `[${label}] structural check failed attempt ${attempt}/${ICP_VALIDATOR_RETRY_MAX_ATTEMPTS} ` +
        `(${structural.length} hits, codes=[${Array.from(new Set(structural.map((h) => h.code))).join(",")}]). Retrying.`,
      );
      continue;
    }
    // 2. Grounding — retry only while a Class-A violation is fixable.
    const grounding = validateIcpGrounding(candidate, ctx);
    const retryable = grounding.filter((h) => h.retryable);
    if (retryable.length > 0 && attempt < ICP_VALIDATOR_RETRY_MAX_ATTEMPTS) {
      failContext = buildIcpGroundingFailContext(grounding);
      console.warn(
        `[${label}] grounding check failed attempt ${attempt}/${ICP_VALIDATOR_RETRY_MAX_ATTEMPTS} ` +
        `(${retryable.length} retryable hits, classes=[${Array.from(new Set(retryable.map((h) => h.classId))).join(",")}]). Retrying.`,
      );
      continue;
    }
    if (retryable.length > 0) {
      console.warn(
        `[${label}] grounding retries exhausted (${retryable.length} hits remaining, ` +
        `classes=[${Array.from(new Set(retryable.map((h) => h.classId))).join(",")}]); labelling and persisting best-effort.`,
      );
    }

    const provenance = computeIcpProvenance(candidate, ctx, grounding);
    console.log(
      `[${label}] generated on attempt ${attempt}: overall=${provenance.overall} corpusWords=${provenance.corpusWords} ` +
      `ladder=[${provenance.ladderAnswered.join(",") || "none"}] hits=${grounding.length}`,
    );
    return { icp: candidate, provenance, attempts: attempt };
  }

  // Structural failure survived every attempt — refuse to persist.
  throw new Error(
    `ICP generation could not produce a correctly structured profile after ${ICP_VALIDATOR_RETRY_MAX_ATTEMPTS} attempts ` +
    `(${lastStructuralHits.map((h) => h.code).join(", ") || "unknown"}). Nothing was saved. Please try again.`,
  );
}
