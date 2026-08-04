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
import { NICHE_DETECTION, HOOK_RULE, BANNED_WORDS, META_COMPLIANCE, REAL_URGENCY_RULE, SPOKEN_REGISTER, SCRIPT_STRUCTURE_CRAFT, SCRIPT_SAFETY } from "./_core/scriptPromptCraft";
import { REGISTER_STANDARD, registerPersonGuidance, physicalSubjectGuidance } from "./_core/copywritingRules";

// Tone by warmth — mapped from the concept's awareness stage. INTERNAL NOTE: the 3-category (Cold/Warm/Hot)
// → 5-stage (Schwartz) mapping is INFERRED from the tone report's category definitions — the tone report is
// docs/andromeda/script-research/Analytical Report_ Calibrating Spoken Tone for Video Ad Performance.md
// (banked 2026-08-03; previously Downloads-only). The report states
// there is "no strong signal" for a data-backed 1:1 map across all 5 stages. Positive-framed.
function toneForAwareness(awareness: string | null | undefined): string {
  switch (awareness) {
    case "unaware":
    case "problem_aware":
      return `TONE — COLD (${awareness}): this is a first handshake. Introduce, don't hard-sell. Lead with curiosity and a useful truth — like you're handing them something, not pitching.`;
    case "solution_aware":
    case "product_aware":
      return `TONE — WARM (${awareness}): they already know the category. Show a new opportunity — a different way — with reassurance, using only REAL authority the coach's material supports.`;
    case "most_aware":
      return `TONE — HOT (most_aware): they're ready to act. Be direct and urgent, with honest FOMO built ONLY on the real deadline, scarcity, or pain in the coach's material — never invented.`;
    default:
      return "";
  }
}

export interface ScriptConceptInput {
  personaLabel?: string | null;
  desire?: string | null;
  awareness?: string | null;
  hookPattern?: string | null;
}

export function buildConceptScriptPrompt(concept: ScriptConceptInput, cascadeContext: string, targetSeconds: number, hasRealClientMaterial: boolean = false): string {
  const budget = wordBudgetForSeconds(targetSeconds);
  const persona = concept.personaLabel || "this ideal customer";
  const sceneCount = targetSeconds === 15 ? 3 : targetSeconds <= 30 ? 4 : 5;
  const perScene = Math.floor(budget.min / sceneCount); // concrete per-scene cap, derived from the LOW end so the total lands under the hard max
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
${SCRIPT_STRUCTURE_CRAFT}
${toneForAwareness(concept.awareness)}
${BANNED_WORDS}
${META_COMPLIANCE}
${REAL_URGENCY_RULE}
${SCRIPT_SAFETY}
${registerPersonGuidance(hasRealClientMaterial)}
${physicalSubjectGuidance(`${cascadeContext} ${concept.desire ?? ""} ${persona}`)}

Every line — hook, body and CTA — sounds like a real person said it, not a copywriter. The whole script,
not just the opening, must survive the read-aloud test above.

LENGTH — this is a ${targetSeconds}-SECOND script. That is only ~${budget.target} spoken words TOTAL, hard max ${budget.max}.
You have ${sceneCount} scenes, so each scene is ONE short spoken line of about ${perScene} words — never more than ${perScene + 4}.
Count as you write. Every word costs a fraction of a second on camera. Placement-safe short: Meta Advantage+ serves
one asset across Reels, Stories and Feed, and the short end runs cleanly everywhere. Tight means FEWER, shorter
sayable lines — one idea per breath — not denser sentences.

SCENE MAP (${targetSeconds === 15 ? "3 tight scenes at 15s: hook → the turn (the one new-way point) → CTA — problem and solution fold into the turn" : targetSeconds <= 30 ? "4 scenes at 30s: hook → problem → turn → solution-and-CTA — fold the solution and the CTA into one closing scene so the whole thing fits the word cap" : "5 scenes: hook → problem → turn → solution → CTA"}):
- Scene 1 is the HOOK, written in the ${concept.hookPattern} style, opening on the leading desire above.
- Include a TURN beat — the "here's the new way" shift from problem to solution (sceneType: "turn"). Keep it short.
- Total spoken words ~${budget.target}, HARD MAX ${budget.max}. This ceiling is non-negotiable: if a draft lands near ${budget.max}, cut a WHOLE sentence — don't shave words. Fewer, tighter scenes beat more scenes that overrun.
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
      { role: "system", content: `You are a world-class direct-response video scriptwriter. Always respond with valid JSON only.\n\n${REGISTER_STANDARD}` },
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

  // Real-proof signal for the third-person unlock. A script may tell a client's
  // story only where the coach has actually supplied that client's material;
  // otherwise the script is first person and never asks for a client at all.
  // Best-effort: a concept with no serviceId resolves to first-person-only, which
  // is the safe direction.
  let hasRealClientMaterial = false;
  if (concept.serviceId != null) {
    const { services } = await import("../drizzle/schema");
    const [svc] = await db
      .select({
        t1: services.testimonial1Name,
        t2: services.testimonial2Name,
        t3: services.testimonial3Name,
      })
      .from(services)
      .where(eq(services.id, concept.serviceId))
      .limit(1);
    hasRealClientMaterial = !!(svc && (svc.t1 || svc.t2 || svc.t3));
  }

  const prompt = buildConceptScriptPrompt(concept as ScriptConceptInput, cascadeContext, targetSeconds, hasRealClientMaterial);

  // ONE SHARED PASS — structure + policy + compliance axis + fabrication in a single gate,
  // so one retry satisfies all of them. onScreenText is checked as a SHORT field: it is
  // exactly the place the register has no room to work.
  const { checkOutput } = await import("./_core/complianceAxis");
  const { buildCoachCorpus, buildProofSupplied } = await import("./_core/groundingCorpus");
  let gateService: any = null;
  if (concept.serviceId != null) {
    const { services } = await import("../drizzle/schema");
    [gateService] = await db.select().from(services).where(eq(services.id, concept.serviceId)).limit(1);
  }
  // DEFECT (b) — scripts now adjudicate against the SAME ground truth as concepts.
  // This passed `groundingMeta: null` while conceptGenerator.ts:227 and adCopyGenerator.ts:768
  // both pass the real value. groundingMeta carries the coach's VERBATIM ladder answers, which
  // feed corpus.text — the haystack claimIsGrounded() searches (trackRecordClaims.ts). So a figure
  // or a name the coach ACTUALLY stated was missing from the script's corpus and read as invented.
  // This was a FALSE-POSITIVE bug that over-blocked honest scripts, not merely thinner detection.
  const [gateIcp] = concept.icpId != null
    ? await db.select({ groundingMeta: idealCustomerProfiles.groundingMeta })
        .from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, concept.icpId))
        .limit(1)
    : [undefined as any];
  const grounding = gateService
    ? {
        corpus: buildCoachCorpus({ service: gateService, groundingMeta: gateIcp?.groundingMeta ?? null }),
        supplied: buildProofSupplied(gateService),
      }
    : undefined;

  const gate = (s: RawScript): { ok: boolean; failContext: string; labels: string } => {
    const structure = validateScriptStructure(s, { hookPattern: concept.hookPattern, targetSeconds });
    const compliance = screenScriptCompliance(s.scenes ?? []);
    const output = checkOutput(
      (s.scenes ?? []).flatMap((sc: any, i: number) => [
        { location: `scene[${i}].spokenLine`, text: sc.spokenLine, role: "body" as const },
        { location: `scene[${i}].onScreenText`, text: sc.onScreenText, role: "short" as const },
      ]),
      grounding,
      // FAIL CLOSED — scripts are free spoken prose, the highest-risk surface for invented proof.
      { requireGrounding: true },
    );
    if (structure.ok && compliance.ok && output.ok) return { ok: true, failContext: "", labels: "" };
    const parts = [
      structure.ok ? "" : structure.failContext,
      compliance.ok ? "" : compliance.failContext,
      output.ok ? "" : output.failContext,
    ].filter(Boolean);
    const labels = [
      ...(structure.ok ? [] : structure.hits.map((h) => h.classId)),
      ...(compliance.ok ? [] : compliance.hits.map((h) => h.classId)),
      ...output.blocking.map((h) => h.classId),
    ].join(", ");
    return { ok: false, failContext: parts.join("\n\n"), labels };
  };

  // Up to 3 attempts: the model is stochastic on spoken word count, so a compliant draw (under the hard
  // word cap, structurally sound, compliance-clean) usually lands within a few tries. The validator still
  // enforces the cap every time — we just give it more draws rather than shipping an overrun.
  const MAX_ATTEMPTS = 3;
  let script = await invokeScript(prompt, "");
  let result = gate(script);
  // Captured BEFORE any regeneration — the first-pass verdict is the PREVENTION signal.
  const firstPassOk = result.ok;
  const firstPassLabels = result.ok
    ? []
    : String(result.labels || "").split(",").map((x) => x.trim()).filter(Boolean);
  for (let attempt = 2; attempt <= MAX_ATTEMPTS && !result.ok; attempt++) {
    script = await invokeScript(prompt, result.failContext);
    result = gate(script);
  }

  // BLOCK-RATE INSTRUMENTATION — completes the set (adCopy, concepts, scripts). Scripts are free
  // spoken prose and the highest-risk surface for both invented proof and policy language, so the
  // rate here is the most informative of the three about how well the prompt craft is holding.
  {
    const { recordComplianceGate } = await import("./_core/complianceTelemetry");
    recordComplianceGate({
      asset: "script",
      generated: 1,
      blockedFirstPass: firstPassOk ? 0 : 1,
      recovered: !firstPassOk && result.ok ? 1 : 0,
      kept: result.ok ? 1 : 0,
      classes: firstPassLabels,
      labels: concept.awareness ? [String(concept.awareness)] : [],
    });
  }
  if (!result.ok) throw new Error(`Script failed validation after ${MAX_ATTEMPTS} attempts: ${result.labels}`);

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
