/**
 * conceptGenerator.ts — LAZY generation of campaignConcepts for one ICP.
 *
 * "One person, many angles": N concepts vary Desire × Awareness WITHIN one ICP (persona fixed to
 * the ICP). Reuses the icpAngleSuggestions.generate machinery pattern — strict json_schema, invokeLLM,
 * delete-then-insert idempotency — plus a structural validate→retry (validateConceptSetStructure).
 *
 * DRAFT-ONLY. Nothing generated here reaches Meta's compliance crawl or a real coach until the separate,
 * approval-gated publishToMeta action. The ICP feeding this is knowingly fabricated (grounding is a later
 * sprint) → the ICP-corpus anti-fabrication check is DEFERRED; only STRUCTURAL validation runs here.
 */

import { randomUUID } from "crypto";
import { getDb } from "./db";
import { idealCustomerProfiles, campaignConcepts, services } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import {
  AWARENESS_STAGES,
  HOOK_PATTERNS,
  DEFAULT_CONCEPT_COUNT,
  CANDIDATE_HOOK_AWARENESS_MAP,
} from "./_core/conceptAxis";
import { validateConceptSetStructure, screenConceptCompliance, type RawConcept } from "./_core/conceptValidator";
import { validateConceptFabricationPatterns, FABRICATION_RETRY_MAX_ATTEMPTS } from "./_core/fabricationValidator";
import { buildCoachCorpus, buildProofSupplied } from "./_core/groundingCorpus";

export interface ConceptIcpInput {
  name?: string | null;
  angleName?: string | null;
  pains?: string | null;
  goals?: string | null;
  fears?: string | null;
  objections?: string | null;
  buyingTriggers?: string | null;
}

// The candidate stage→hook guidance, rendered from CONFIG (not baked into the prompt text). Until
// CANDIDATE_HOOK_AWARENESS_MAP.approved flips true, this is guidance only — Arfeen signs off the mapping.
function renderHookGuidance(): string {
  const lines = AWARENESS_STAGES.map((stage) => {
    const m = CANDIDATE_HOOK_AWARENESS_MAP.map[stage];
    const sec = m.secondary.length ? ` (or ${m.secondary.join(", ")})` : "";
    return `  - ${stage}: prefer ${m.primary}${sec}`;
  });
  const status = CANDIDATE_HOOK_AWARENESS_MAP.approved
    ? "Use this hook→awareness pairing."
    : "Suggested hook→awareness pairing (candidate — treat as guidance, not a hard rule):";
  return `${status}\n${lines.join("\n")}`;
}

export function buildConceptPrompt(icp: ConceptIcpInput, count: number): string {
  const persona = icp.angleName || icp.name || "this ideal customer";
  return `You are a world-class direct-response strategist building Meta ad concepts for ONE fixed persona.

THE PERSONA IS FIXED — every concept is the SAME person: ${persona}.
Do NOT invent different audiences. Generate ${count} DISTINCT CONCEPTS for this one person, each varying
along two axes only: DESIRE (which specific pain/goal it leads with) and AWARENESS (funnel stage).

THIS PERSON'S REAL MATERIAL (draw desires from here — do not invent a different person):
Pains: ${icp.pains || "(none provided)"}
Goals: ${icp.goals || "(none provided)"}
Fears: ${icp.fears || "(none provided)"}
Objections: ${icp.objections || "(none provided)"}
Buying triggers: ${icp.buyingTriggers || "(none provided)"}

AWARENESS — span all 5 Schwartz stages across the set: ${AWARENESS_STAGES.join(", ")}.
HOOK PATTERN — each concept uses exactly one of the ${HOOK_PATTERNS.length} patterns: ${HOOK_PATTERNS.join(", ")}.
${renderHookGuidance()}

REAL-URGENCY RULE (direct_offer_urgency hook): express urgency ONLY from a genuine, coach-supplied deadline or offer. NEVER invent scarcity — no "expires tonight", "gone forever", "price doubles at midnight", fake countdowns, or guaranteed-income claims. If no real deadline exists, use a non-urgency close instead. This copy is screened by Meta ad-policy filters.

STRUCTURAL RULES (every concept):
- desire: the single pain/goal this concept leads with, in this person's own language.
- awareness: exactly one of the 5 stages above.
- hookPattern: exactly one of the 6 patterns above.
- hook: the scroll-stopping opening line, named to this awareness stage.
- headline: carries a DIFFERENT signal from the hook (the mechanism or the outcome) — NEVER a repeat of the hook.
- shortText: the short-form primary text (feeds the ranking model).
- longText: the long-form primary text (feeds sequence learning).

SET RULES:
- The ${count} concepts must be DISTINCT on desire × awareness — no two concepts share the same desire AND awareness pair. Vary the desire, the awareness stage, or both.
- Cover a spread of awareness stages; do not cluster everything at one stage.

Return valid JSON only, no markdown:
{ "concepts": [ { "desire": "...", "awareness": "problem_aware", "hookPattern": "problem_first", "hook": "...", "headline": "...", "shortText": "...", "longText": "..." } ] }`;
}

const CONCEPT_JSON_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "campaign_concepts",
    strict: true,
    schema: {
      type: "object",
      properties: {
        concepts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              desire: { type: "string" },
              awareness: { type: "string", enum: [...AWARENESS_STAGES] },
              hookPattern: { type: "string", enum: [...HOOK_PATTERNS] },
              hook: { type: "string" },
              headline: { type: "string" },
              shortText: { type: "string" },
              longText: { type: "string" },
            },
            required: ["desire", "awareness", "hookPattern", "hook", "headline", "shortText", "longText"],
            additionalProperties: false,
          },
        },
      },
      required: ["concepts"],
      additionalProperties: false,
    },
  },
};

async function invokeConcepts(prompt: string, failContext: string): Promise<RawConcept[]> {
  const userContent = failContext ? `${prompt}\n\n---\n\n${failContext}` : prompt;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a world-class direct-response strategist. Always respond with valid JSON only." },
      { role: "user", content: userContent },
    ],
    response_format: CONCEPT_JSON_SCHEMA as any,
    maxTokens: 4000,
  });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Invalid AI response for concepts");
  const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
  const concepts: RawConcept[] = Array.isArray(parsed) ? parsed : parsed.concepts;
  if (!Array.isArray(concepts)) throw new Error("Concept generation returned no concepts array");
  return concepts;
}

/**
 * Generate the concept set for one ICP: LLM → structural validate → retry-once-with-failContext →
 * delete-then-insert (idempotent per icpId). Returns the number of concepts persisted.
 */
export async function generateConceptsForIcp(params: {
  userId: number;
  icpId: number;
  serviceId?: number | null;
  campaignId?: number | null;
  count?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [icp] = await db
    .select()
    .from(idealCustomerProfiles)
    .where(and(eq(idealCustomerProfiles.id, params.icpId), eq(idealCustomerProfiles.userId, params.userId)))
    .limit(1);
  if (!icp) throw new Error(`ICP ${params.icpId} not found for user ${params.userId}`);

  // The service row is the coach's own words — the ground truth the fabrication
  // check measures against. Falls back to the ICP's own serviceId.
  const svcId = params.serviceId ?? icp.serviceId ?? null;
  const [service] = svcId
    ? await db.select().from(services).where(and(eq(services.id, svcId), eq(services.userId, params.userId))).limit(1)
    : [undefined];

  const count = params.count ?? DEFAULT_CONCEPT_COUNT;
  const prompt = buildConceptPrompt(icp as ConceptIcpInput, count);

  // Ground truth for the fabrication check is the COACH'S OWN WORDS — service
  // fields, their verbatim ladder answers, imported material — never the ICP
  // prose, which is model output (crediting it would launder fabrication a level
  // down). Predictable category psychology is legitimate inference and passes.
  const corpus = buildCoachCorpus({ service, groundingMeta: (icp as any).groundingMeta });
  const supplied = buildProofSupplied(service);

  // Generate → structure + Meta policy + invented-proof → retry with combined failContext.
  const gate = (cs: RawConcept[]): { ok: boolean; failContext: string; labels: string } => {
    const structure = validateConceptSetStructure(cs);
    const compliance = screenConceptCompliance(cs);
    const fabrication = validateConceptFabricationPatterns(cs, corpus, supplied);
    if (structure.ok && compliance.ok && fabrication.ok) return { ok: true, failContext: "", labels: "" };
    const parts = [
      structure.ok ? "" : structure.failContext,
      compliance.ok ? "" : compliance.failContext,
      fabrication.ok ? "" : fabrication.failContext,
    ].filter(Boolean);
    const labels = [
      ...(structure.ok ? [] : structure.hits.map((h) => h.classId)),
      ...(compliance.ok ? [] : compliance.hits.map((h) => h.classId)),
      ...fabrication.blocking.map((h) => h.classId),
    ].join(", ");
    return { ok: false, failContext: parts.join("\n\n"), labels };
  };

  let concepts = await invokeConcepts(prompt, "");
  let result = gate(concepts);
  for (let attempt = 2; attempt <= FABRICATION_RETRY_MAX_ATTEMPTS && !result.ok; attempt++) {
    console.warn(`[conceptGenerator] gate failed attempt ${attempt - 1}/${FABRICATION_RETRY_MAX_ATTEMPTS} (${result.labels}). Retrying.`);
    concepts = await invokeConcepts(prompt, result.failContext);
    result = gate(concepts);
  }
  if (!result.ok) {
    // Invented proof must never persist: a coach would read it as real.
    throw new Error(`Concept set failed validation after ${FABRICATION_RETRY_MAX_ATTEMPTS} attempts: ${result.labels}`);
  }

  const conceptSetId = randomUUID();
  const personaLabel = (icp as any).angleName || (icp as any).name || null;

  // Idempotent per ICP: replace any prior draft set for this ICP.
  await db.delete(campaignConcepts).where(eq(campaignConcepts.icpId, params.icpId));
  await db.insert(campaignConcepts).values(
    concepts.map((c) => ({
      userId: params.userId,
      icpId: params.icpId,
      serviceId: params.serviceId ?? null,
      campaignId: params.campaignId ?? null,
      conceptSetId,
      personaLabel,
      desire: c.desire!,
      awareness: c.awareness as any,
      hookPattern: c.hookPattern as any,
      hook: c.hook!,
      headline: c.headline!,
      shortText: c.shortText!,
      longText: c.longText!,
      status: "draft" as const,
      source: "generated" as const,
    })),
  );

  return concepts.length;
}

/**
 * LAZY entry — called at the ad-copy generation entry after validateCascadePrereqs passes. Checks for
 * existing concepts for this ICP; generates them in the background if absent. NEVER blocks the caller.
 */
export async function ensureConceptsForIcp(params: {
  userId: number;
  icpId: number;
  serviceId?: number | null;
  campaignId?: number | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select({ id: campaignConcepts.id })
    .from(campaignConcepts)
    .where(eq(campaignConcepts.icpId, params.icpId))
    .limit(1);
  if (existing.length > 0) return; // already generated for this ICP

  // Fire-and-forget so the ad-copy entry never blocks. (Draft-only; a durable jobs-table version is a
  // follow-up, matching how the bonus path started before its durability fix.)
  setImmediate(() => {
    generateConceptsForIcp(params).catch((err) => {
      console.error(`[conceptGenerator.ensureConceptsForIcp] icp ${params.icpId} failed:`, err instanceof Error ? err.message : String(err));
    });
  });
}
