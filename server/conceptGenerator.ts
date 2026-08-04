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
import { idealCustomerProfiles, campaignConcepts } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import {
  AWARENESS_STAGES,
  HOOK_PATTERNS,
  DEFAULT_CONCEPT_COUNT,
  CANDIDATE_HOOK_AWARENESS_MAP,
  awarenessPlanForCount,
} from "./_core/conceptAxis";
import { validateConceptSetStructure, screenConceptCompliance, type RawConcept } from "./_core/conceptValidator";
import { REGISTER_STANDARD, registerPersonGuidance, physicalSubjectGuidance } from "./_core/copywritingRules";

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
function renderHookGuidance(availableHooks: readonly string[]): string {
  const lines = AWARENESS_STAGES.map((stage) => {
    const m = CANDIDATE_HOOK_AWARENESS_MAP.map[stage];
    // A stage whose primary hook is unavailable (social_proof, when the coach has no
    // client material) falls through to its secondary rather than losing its guidance.
    const usable = [m.primary, ...m.secondary].filter((h) => availableHooks.includes(h));
    if (usable.length === 0) return `  - ${stage}: any pattern above that fits this stage`;
    const sec = usable.slice(1).length ? ` (or ${usable.slice(1).join(", ")})` : "";
    return `  - ${stage}: prefer ${usable[0]}${sec}`;
  });
  const status = CANDIDATE_HOOK_AWARENESS_MAP.approved
    ? "Use this hook→awareness pairing."
    : "Suggested hook→awareness pairing (candidate — treat as guidance, not a hard rule):";
  return `${status}\n${lines.join("\n")}`;
}

export function buildConceptPrompt(icp: ConceptIcpInput, count: number, hasRealClientMaterial: boolean = false): string {
  const persona = icp.angleName || icp.name || "this ideal customer";
  // COLD-WEIGHTED, DETERMINISTIC. The stage for each slot is decided here, not by the model — see
  // COLD_WEIGHTED_STAGE_MIX in _core/conceptAxis.ts for the research citation and the recorded
  // counter-evidence. Previously the prompt asked the model to "span all 5 stages" and only the
  // desire × awareness PAIR was enforced, which meant a set could legally put all 8 concepts at one
  // stage (8 different desires = 8 distinct pairs) and still pass.
  const awarenessPlan = awarenessPlanForCount(count);
  const planLines = awarenessPlan.map((stage, i) => `  - Concept ${i + 1}: ${stage}`).join("\n");
  // PROOF-DEPENDENT HOOKS. social_proof asks for a client result; data_chart asks for a
  // figure. Both are offered only once the coach's proof is on the record — otherwise the
  // set is built from the remaining patterns and the prompt never asks for something the
  // coach cannot supply. (Verified 2026-07-27: with data_chart still offered, a launch-stage
  // coach's set produced "screened out ... more than 70% of the time. Four months of data."
  // — an invented statistic presented as the coach's own tracked result.)
  // Mirrors PROOF_DEPENDENT_ANGLES in adCopyAngles.ts.
  const availableHooks = hasRealClientMaterial
    ? [...HOOK_PATTERNS]
    : HOOK_PATTERNS.filter((h) => h !== "social_proof" && h !== "data_chart");
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

AWARENESS — ASSIGNED PER CONCEPT, NOT CHOSEN. This is a cold-traffic, broad-targeting batch, so the
set is weighted toward earlier-stage prospects. Write each concept TO the stage assigned to its slot:
${planLines}
Return the concepts in exactly this order, each carrying its assigned awareness value. Do NOT
substitute a different stage, reorder the set, or re-balance the distribution.
HOOK PATTERN — each concept uses exactly one of these patterns: ${availableHooks.join(", ")}.${hasRealClientMaterial ? "" : "\n(The social-proof and data-chart hooks need a real client account or a real figure to carry them, and this coach's proof is not on the record yet, so this set is built from the other patterns.)"}
${renderHookGuidance(availableHooks)}

REAL-URGENCY RULE (direct_offer_urgency hook): express urgency ONLY from a genuine, coach-supplied deadline or offer. NEVER invent scarcity — no "expires tonight", "gone forever", "price doubles at midnight", fake countdowns, or guaranteed-income claims. If no real deadline exists, use a non-urgency close instead. This copy is screened by Meta ad-policy filters.

${registerPersonGuidance(hasRealClientMaterial)}
${physicalSubjectGuidance([icp.pains, icp.goals, icp.fears, persona].join(" "))}

STRUCTURAL RULES (every concept):
- desire: the single pain/goal this concept leads with, in this person's own language.
- awareness: exactly one of the 5 stages above.
- hookPattern: exactly one of the patterns listed above.
- hook: the scroll-stopping opening line, named to this awareness stage.
- headline: carries a DIFFERENT signal from the hook (the mechanism or the outcome) — NEVER a repeat of the hook.
- shortText: the short-form primary text (feeds the ranking model).
- longText: the long-form primary text (feeds sequence learning).

SET RULES:
- The ${count} concepts must be DISTINCT on desire × awareness — no two concepts share the same desire AND awareness pair. Since the awareness stages are already fixed above, this means: where two concepts share an assigned stage, their DESIRES must differ.
- The awareness distribution is set by the assignment above and is not yours to change.

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
      { role: "system", content: `You are a world-class direct-response strategist. Always respond with valid JSON only.\n\n${REGISTER_STANDARD}` },
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
}): Promise<ConceptGenerationResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [icp] = await db
    .select()
    .from(idealCustomerProfiles)
    .where(and(eq(idealCustomerProfiles.id, params.icpId), eq(idealCustomerProfiles.userId, params.userId)))
    .limit(1);
  if (!icp) throw new Error(`ICP ${params.icpId} not found for user ${params.userId}`);

  const count = params.count ?? DEFAULT_CONCEPT_COUNT;
  // The same deterministic plan the prompt assigns, re-derived here so the validator enforces
  // exactly what was asked for. Same input → same plan, so these cannot drift apart.
  const awarenessPlan = awarenessPlanForCount(count);
  // Real-proof signal for the third-person unlock — the coach's own supplied client
  // material. Absent (or no serviceId) resolves to first-person-only, the safe direction.
  let hasRealClientMaterial = false;
  if (params.serviceId != null) {
    const { services } = await import("../drizzle/schema");
    const [svc] = await db
      .select({
        t1: services.testimonial1Name,
        t2: services.testimonial2Name,
        t3: services.testimonial3Name,
      })
      .from(services)
      .where(eq(services.id, params.serviceId))
      .limit(1);
    hasRealClientMaterial = !!(svc && (svc.t1 || svc.t2 || svc.t3));
  }

  const prompt = buildConceptPrompt(icp as ConceptIcpInput, count, hasRealClientMaterial);

  // Generate → structural validate + compliance screen → retry once with combined failContext.
  // Both gates run every attempt: structure (fields/enums/distinct/headline≠hook) AND Meta ad-policy
  // screening (complianceFilter — fabricated scarcity / income guarantees, highest risk on the
  // direct_offer_urgency hook). The ICP-corpus anti-fabrication check stays deferred until ICP grounding.
  // ONE SHARED PASS — structure + Meta ad-policy + the compliance axis + fabrication, so a
  // single retry sees every constraint at once. Run separately, a fabrication retry can
  // reintroduce a compliance violation and neither pass ever sees both.
  const { checkOutput } = await import("./_core/complianceAxis");
  const { buildCoachCorpus, buildProofSupplied } = await import("./_core/groundingCorpus");
  let gateService: any = null;
  if (params.serviceId != null) {
    const { services } = await import("../drizzle/schema");
    [gateService] = await db.select().from(services).where(eq(services.id, params.serviceId)).limit(1);
  }
  const grounding = gateService
    ? { corpus: buildCoachCorpus({ service: gateService, groundingMeta: (icp as any)?.groundingMeta }), supplied: buildProofSupplied(gateService) }
    : undefined;

  const gate = (cs: RawConcept[]): { ok: boolean; failContext: string; labels: string } => {
    const structure = validateConceptSetStructure(cs, awarenessPlan);
    const compliance = screenConceptCompliance(cs);
    const output = checkOutput(
      cs.flatMap((c, i) => [
        { location: `concept[${i}].hook`, text: c.hook, role: "short" as const },
        { location: `concept[${i}].headline`, text: c.headline, role: "short" as const },
        { location: `concept[${i}].shortText`, text: c.shortText, role: "body" as const },
        { location: `concept[${i}].longText`, text: c.longText, role: "body" as const },
      ]),
      grounding,
      // FAIL CLOSED. Concepts are the upstream input to Andromeda-driven ads; if the coach's
      // material cannot be loaded there is nothing to check claims against, and a silent pass
      // here would carry through to a live ad. Holding is the safe direction.
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

  const { COMPLIANCE_RETRY_MAX_ATTEMPTS } = await import("./_core/complianceAxis");
  let concepts = await invokeConcepts(prompt, "");
  let result = gate(concepts);
  // Captured BEFORE any regeneration — the first-pass verdict is the prevention signal.
  const firstPassOk = result.ok;
  const firstPassLabels = result.ok
    ? []
    : String(result.labels || "").split(",").map((x) => x.trim()).filter(Boolean);
  for (let attempt = 2; attempt <= COMPLIANCE_RETRY_MAX_ATTEMPTS && !result.ok; attempt++) {
    concepts = await invokeConcepts(prompt, result.failContext);
    result = gate(concepts);
  }
  // BLOCK-RATE INSTRUMENTATION. Concepts already had the locked behaviour — hard-block via the
  // gate, regenerate up to COMPLIANCE_RETRY_MAX_ATTEMPTS, then throw rather than persist anything
  // that failed. What was missing was visibility: no way to tell how often the prompt produced a
  // violating set in the first place.
  // ── PARTIAL DELIVERY (Arfeen's call, 2026-08-04) ────────────────────────────
  // Previously an all-or-nothing throw: one concept the gate would not pass killed the whole set
  // and the coach got nothing. Now the clean concepts are delivered and only the failures are
  // skipped, with the count surfaced so the coach can be told plainly.
  //
  // Per-concept evaluation applies the SAME two gates (compliance, then fabrication) to one
  // concept's four copy fields. Set-level structural rules — desire x awareness distinctness and
  // slot adherence — are deliberately NOT re-applied here: they describe the shape of a full set,
  // and a set that has had failures removed is smaller by definition. The awareness distribution
  // degrades accordingly, which is the accepted cost of delivering something rather than nothing.
  let skippedCount = 0;
  if (!result.ok) {
    const conceptPassesAlone = (c: RawConcept, i: number): boolean => {
      const cmp = screenConceptCompliance([c]);
      if (!cmp.ok) return false;
      const out = checkOutput(
        [
          { location: `concept[${i}].hook`, text: c.hook, role: "short" as const },
          { location: `concept[${i}].headline`, text: c.headline, role: "short" as const },
          { location: `concept[${i}].shortText`, text: c.shortText, role: "body" as const },
          { location: `concept[${i}].longText`, text: c.longText, role: "body" as const },
        ],
        grounding,
        { requireGrounding: true },
      );
      return out.ok;
    };
    const survivors = concepts.filter((c, i) => conceptPassesAlone(c, i));
    skippedCount = concepts.length - survivors.length;
    if (survivors.length === 0) {
      // Nothing survived — there is no partial result to deliver, so this still throws rather
      // than persisting an empty set the coach would read as a silent failure.
      throw new Error(
        `Concept set failed validation after ${COMPLIANCE_RETRY_MAX_ATTEMPTS} attempts: ${result.labels}`,
      );
    }
    console.warn(
      `[conceptGenerator] partial delivery: ${survivors.length}/${concepts.length} concepts kept, ` +
      `${skippedCount} skipped after ${COMPLIANCE_RETRY_MAX_ATTEMPTS} attempts (classes=[${result.labels}]).`,
    );
    concepts = survivors;
  }

  {
    const { recordComplianceGate } = await import("./_core/complianceTelemetry");
    recordComplianceGate({
      asset: "concepts",
      generated: count,
      blockedFirstPass: firstPassOk ? 0 : count,
      recovered: !firstPassOk && skippedCount === 0 ? count : 0,
      kept: concepts.length,
      classes: firstPassLabels,
    });
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

  // SURFACING THE SKIP COUNT. Returned as a structured result rather than a bare number so the
  // caller — and eventually the coach-facing surface — can say "2 angles were filtered" without
  // re-deriving it. Nothing reads concepts in the UI yet (see the Andromeda stock-take), so this
  // is the API-boundary half of that notice; the render half lands with the concepts UI.
  return { persisted: concepts.length, skipped: skippedCount, requested: count };
}

/**
 * What one concept-set generation produced. `skipped` is the number the gate blocked and
 * regeneration could not recover — the number a coach is told about ("2 angles were filtered").
 */
export type ConceptGenerationResult = {
  /** Concepts actually written to the database. */
  persisted: number;
  /** Concepts blocked by the gate and not recovered within the attempt cap. */
  skipped: number;
  /** How many were asked for. persisted + skipped === requested. */
  requested: number;
};

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
