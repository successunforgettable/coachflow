/**
 * conceptScriptGenerator.ts — Andromeda per-concept video-script generator (mechanism only, DRAFT-only).
 *
 * Takes a conceptId from campaignConcepts, writes ONE script to that concept's {persona, desire, awareness,
 * hookPattern}. N concepts → N distinct scripts. The concept's hookPattern drives the opening hook. Length
 * is the capped placement-safe short length for the concept's awareness stage (Advantage+ serves one asset
 * across Reels/Stories/Feed → short runs clean everywhere). Cascade-fed (getCascadeContext) for ad↔script↔
 * page coherence. Reuses the paused generator's craft (scriptPromptCraft), scene-schema shape, and the
 * async-job / json_schema / validate→retry patterns.
 *
 * SCOPE OUT: video generation; record→upload→push-to-Meta (separate pass). Ends at: generate + read/edit.
 * DRAFT-only — nothing reaches Meta until publishToMeta. NO script-quality/ICP-fabrication truth check
 * (deferred to the ICP grounding sprint) — structural + compliance screening only.
 */

import { randomUUID } from "crypto";
import { getDb } from "./db";
import { campaignConcepts, conceptScripts, idealCustomerProfiles } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { activeLengthForStage, wordBudgetForSeconds, type AwarenessStage } from "./_core/conceptAxis";
import {
  validateScriptStructure,
  screenScriptCompliance,
  type RawScript,
  type RawScriptScene,
} from "./_core/conceptScriptValidator";
import { NICHE_DETECTION, HOOK_RULE, BANNED_WORDS, META_COMPLIANCE, REAL_URGENCY_RULE, SPOKEN_REGISTER } from "./_core/scriptPromptCraft";

export interface ScriptConceptInput {
  personaLabel?: string | null;
  desire?: string | null;
  awareness?: string | null;
  hookPattern?: string | null;
}

export function buildConceptScriptPrompt(concept: ScriptConceptInput, cascadeContext: string, targetSeconds: number): string {
  const budget = wordBudgetForSeconds(targetSeconds);
  const persona = concept.personaLabel || "this ideal customer";
  return `You are a world-class direct-response video scriptwriter for Meta ads. Write ONE short script a coach
will record themselves (phone camera or avatar), for a SINGLE fixed concept.

${cascadeContext}
THE CONCEPT (persona is fixed to this — do NOT drift to a different audience):
- Persona: ${persona}
- Leading desire: ${concept.desire || "(none provided)"}
- Awareness stage: ${concept.awareness || "(none)"}
- Hook pattern (drives the OPENING): ${concept.hookPattern || "(none)"}

${NICHE_DETECTION}
${HOOK_RULE}
${SPOKEN_REGISTER}
${BANNED_WORDS}
${META_COMPLIANCE}
${REAL_URGENCY_RULE}

Every line — hook, body and CTA — sounds like a real person said it, not a copywriter. The whole script,
not just the opening, must survive the read-aloud test above.

LENGTH — this script targets ${targetSeconds} seconds (placement-safe short; Meta Advantage+ serves one asset
across Reels, Stories and Feed, and the short end runs cleanly everywhere). Total spoken words ≈ ${budget.target}
(hard max ${budget.max}). Keep it tight — tight means FEWER spoken beats (one idea per breath), not denser
sentences; short sayable lines, not compressed written clauses.

STRUCTURE (${targetSeconds === 15 ? "3 tight scenes: hook → the one point → CTA" : targetSeconds <= 30 ? "3–4 scenes: hook → problem → solution → CTA" : "4–5 scenes: hook → problem → solution → CTA"}):
- Scene 1 is the HOOK, written in the ${concept.hookPattern} style, opening on the leading desire above.
- At ${targetSeconds}s the total spoken read is ONLY ~${budget.target} words (hard max ${budget.max}) — keep scenes short and cut ruthlessly; fewer, tighter scenes beat more scenes that overrun.
- Each scene is for a HUMAN presenter recording themselves — no stock footage, no render directions.

Return valid JSON only, no markdown:
{ "hookPattern": "${concept.hookPattern}", "scenes": [ { "sceneNumber": 1, "sceneType": "hook", "spokenLine": "the exact words the coach says out loud, written the way people talk", "onScreenText": "SHORT CAPTION OVERLAY", "deliveryNote": "pacing/tone cue for the presenter" } ] }`;
}

const SCRIPT_JSON_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "concept_video_script",
    strict: true,
    schema: {
      type: "object",
      properties: {
        hookPattern: { type: "string" },
        scenes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sceneNumber: { type: "number" },
              sceneType: { type: "string" },
              spokenLine: { type: "string" },
              onScreenText: { type: "string" },
              deliveryNote: { type: "string" },
            },
            required: ["sceneNumber", "sceneType", "spokenLine", "onScreenText", "deliveryNote"],
            additionalProperties: false,
          },
        },
      },
      required: ["hookPattern", "scenes"],
      additionalProperties: false,
    },
  },
};

async function invokeScript(prompt: string, failContext: string): Promise<RawScript> {
  const userContent = failContext ? `${prompt}\n\n---\n\n${failContext}` : prompt;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a world-class direct-response video scriptwriter. Always respond with valid JSON only." },
      { role: "user", content: userContent },
    ],
    response_format: SCRIPT_JSON_SCHEMA as any,
    maxTokens: 2000,
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Invalid AI response for script");
  return JSON.parse(content.replace(/```json|```/g, "").trim());
}

/**
 * Generate the video script for one concept: fetch concept + cascade → LLM → structural validate +
 * compliance screen → retry once → persist to conceptScripts. Returns the new scriptId.
 */
export async function generateScriptForConcept(params: { userId: number; conceptId: number }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [concept] = await db
    .select()
    .from(campaignConcepts)
    .where(and(eq(campaignConcepts.id, params.conceptId), eq(campaignConcepts.userId, params.userId)))
    .limit(1);
  if (!concept) throw new Error(`Concept ${params.conceptId} not found for user ${params.userId}`);

  const targetSeconds = activeLengthForStage(concept.awareness as AwarenessStage);

  // Cascade context: the same UPSTREAM SELECTED-ASSETS block ad copy + the LP share — ad↔script↔page
  // coherence by construction. Persona/desire come from the concept, not the cascade.
  const { getCascadeContext } = await import("./_core/cascadeContext");
  const cascadeContext = await getCascadeContext(params.userId, concept.icpId, "adCopy");

  const prompt = buildConceptScriptPrompt(concept as ScriptConceptInput, cascadeContext, targetSeconds);

  const gate = (s: RawScript): { ok: boolean; failContext: string; labels: string } => {
    const structure = validateScriptStructure(s, { hookPattern: concept.hookPattern, targetSeconds });
    const compliance = screenScriptCompliance(s.scenes ?? []);
    if (structure.ok && compliance.ok) return { ok: true, failContext: "", labels: "" };
    const parts = [structure.ok ? "" : structure.failContext, compliance.ok ? "" : compliance.failContext].filter(Boolean);
    const labels = [
      ...(structure.ok ? [] : structure.hits.map((h) => h.classId)),
      ...(compliance.ok ? [] : compliance.hits.map((h) => h.classId)),
    ].join(", ");
    return { ok: false, failContext: parts.join("\n\n"), labels };
  };

  let script = await invokeScript(prompt, "");
  let result = gate(script);
  if (!result.ok) {
    script = await invokeScript(prompt, result.failContext);
    result = gate(script);
    if (!result.ok) throw new Error(`Script failed validation after retry: ${result.labels}`);
  }

  const scenes = (script.scenes ?? []) as RawScriptScene[];
  const teleprompter = scenes.map((s) => s.spokenLine).filter(Boolean).join("\n\n");
  const scriptSetId = randomUUID();

  const insert: any = await db.insert(conceptScripts).values({
    userId: params.userId,
    conceptId: params.conceptId,
    icpId: concept.icpId,
    serviceId: concept.serviceId ?? null,
    campaignId: concept.campaignId ?? null,
    scriptSetId,
    awareness: concept.awareness as any,
    hookPattern: concept.hookPattern as any,
    targetLengthSeconds: targetSeconds,
    scenes,
    teleprompter,
    status: "draft" as const,
    source: "generated" as const,
  });
  return insert[0].insertId;
}
