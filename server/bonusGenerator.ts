import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";
import {
  validateBonusFabricationPatterns,
  type RawBonus,
  type BonusValidationContext,
} from "./_core/validator";

// ─── Bonus generation (forward-sequence step 2, Layer 1) ─────────────────────
// Gen-core mirroring runHvcoGeneration (ICP-derived) + the offer generator's validate-retry loop.
// ONE LLM call produces all 3 bonuses together — that single call is what makes cross-stack coherence,
// subordination, and no-overlap enforceable (do NOT split into 3 calls without surfacing it as a decision).
// value is ALWAYS null from the LLM; a £ figure is coach-supplied only, filled downstream by the token-fill.

export interface GeneratedBonus {
  bonusType: "accelerator" | "gap_filler" | "objection_crusher";
  title: string;
  description: string; // full buyer-facing copy → LP + Layer-2 PDF
  shortLine: string;   // ~12-18 word outcome line → offer + email (the full description is too long there)
  format: string; // checklist | template | script | sop | swipe | cheatsheet
  derivedFromObstacle: string;
  value: null;
}

const BONUS_VALIDATOR_RETRY_MAX_ATTEMPTS = 3;

const BONUS_SYSTEM =
  "You are a strategic offer architect who designs bonus stacks for coaches, speakers, and consultants. " +
  "You derive every bonus from a specific obstacle the buyer faces via Problem-Solution Mapping, and you build " +
  "implementation-heavy done-for-you assets (checklists, fill-in templates, script banks, SOPs, swipe files, " +
  "1-page cheat sheets) that do the work for the buyer. You frame each bonus by the outcome it produces, the " +
  "time it saves, or the problem it dissolves. You return strictly valid JSON.";

export async function runBonusGeneration(input: {
  userId: number;
  serviceId: number;
  campaignId?: number | null;
  icpId?: number | null;
}): Promise<{ bonusSetId: string; bonuses: GeneratedBonus[]; campaignKitId: number | null } | null> {
  const { getDb } = await import("./db");
  const { services, idealCustomerProfiles, campaignKits, hvcoTitles, bonuses: bonusesTable } =
    await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const { getCascadeContext } = await import("./_core/cascadeContext");

  const db = await getDb();
  if (!db) return null;

  const [service] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
  if (!service) return null;

  let icp: typeof idealCustomerProfiles.$inferSelect | undefined;
  if (input.icpId) {
    [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, input.icpId)).limit(1);
  }
  if (!icp) {
    [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
  }
  if (!icp) return null;

  const [kit] = await db
    .select()
    .from(campaignKits)
    .where(and(eq(campaignKits.userId, input.userId), eq(campaignKits.icpId, icp.id)))
    .limit(1);

  // Distinctness context: offer + mechanism + hvco already-selected. "headlines" is the cascade node whose
  // UPSTREAM is exactly [offer, mechanism, hvco] — reused here to avoid adding a new node to the locked
  // CascadeNode union + its three Record maps. (Bonuses aren't upstream of anything, so a real node buys nothing.)
  const cascadeContext = await getCascadeContext(input.userId, icp.id, "headlines");

  // Selected lead-magnet title → the overlap/distinctness cross-check.
  let leadMagnetTitle: string | null = null;
  if (kit?.selectedHvcoId) {
    const [lm] = await db.select({ title: hvcoTitles.title }).from(hvcoTitles).where(eq(hvcoTitles.id, kit.selectedHvcoId)).limit(1);
    leadMagnetTitle = lm?.title ?? null;
  }

  const validationCtx: BonusValidationContext = {
    pains: icp.pains,
    frustrations: icp.frustrations,
    objections: icp.objections,
    implementationBarriers: icp.implementationBarriers,
    leadMagnetTitle,
  };

  const obstacleBlock = [
    "ICP OBSTACLES — derive each bonus from a SPECIFIC line below (Problem-Solution Mapping):",
    icp.pains ? `Pains: ${icp.pains}` : "",
    icp.frustrations ? `Frustrations: ${icp.frustrations}` : "",
    icp.objections ? `Objections to buying: ${icp.objections}` : "",
    icp.implementationBarriers ? `Implementation barriers: ${icp.implementationBarriers}` : "",
  ].filter(Boolean).join("\n");

  const leadMagnetLine = leadMagnetTitle
    ? `\nThe coach's lead magnet is "${leadMagnetTitle}". Every bonus must be DISTINCT from it — solve a different obstacle, never restate or overlap the lead magnet.\n`
    : "";

  const prompt = `Product: ${service.name}
Target market: ${service.targetCustomer ?? ""}

${obstacleBlock}
${leadMagnetLine}
Generate EXACTLY 3 bonuses that make the core offer's outcome faster and more certain — one of each type:

1. ACCELERATOR (type "accelerator") — collapses TIME DELAY. Derive from an obstacle that delays the buyer's first win. Deliver a quick-win checklist or protocol that produces a result within the first 7 days.
2. GAP-FILLER (type "gap_filler") — resolves a MISSING PREREQUISITE or logistical friction the buyer lacks. Deliver a fill-in template or SOP that finishes the missing step for them.
3. OBJECTION-CRUSHER (type "objection_crusher") — dissolves the buyer's TOP buying objection (derive it from the Objections line above). Deliver a done-for-you script bank or template so acting takes minutes. It is ALWAYS a self-serve asset.

For every bonus:
- It is an implementation-heavy done-for-you asset. Choose a format from: checklist, template, script, sop, swipe, cheatsheet.
- Write "title" as a clean NAME for the asset — around 6 words, concrete and specific to this audience (keep the distinctive niche term, e.g. "Sector Translation"), ending in the format word (Checklist, Template, Script Bank, SOP, Swipe File, Cheat Sheet). The title names the deliverable and stops there; the shortLine and description carry the outcome, so the title stays a plain name a coach could say aloud in one breath. Examples of the register: "The Sector Translation Checklist", "The Quiet Pivot Outreach SOP", "The 'Different From Last Time' Script Bank".
- Write "description" as full buyer-facing copy (3-5 sentences) framed by the outcome it produces, the time it saves, or the problem it dissolves — concrete and niche-specific to this exact audience.
- Write "shortLine" as ONE clause of 12-18 words — the same outcome in a single line, for a bonus stack on the offer and in emails. It must name the same format and outcome as the description (never a different deliverable, never a live session).
- Set "derivedFromObstacle" to the specific ICP obstacle text it maps to (quote the relevant words from the obstacle lines).
- Set "value" to null. A monetary value is supplied by the coach later; you never state one.
- Keep every bonus subordinate to the core offer — a small, self-serve asset, never a second programme, course, community, live session, call, Q&A, or guarantee.

Return ONLY valid JSON: { "bonuses": [ {bonusType, title, description, format, derivedFromObstacle, value}, {…}, {…} ] } with exactly 3 items in the order accelerator, gap_filler, objection_crusher.`;

  let failContext = "";
  let parsed: GeneratedBonus[] | null = null;

  let __residualLegacyHits: Array<{ classId: string; matched: string; location: string }> = [];

  for (let attempt = 1; attempt <= BONUS_VALIDATOR_RETRY_MAX_ATTEMPTS; attempt++) {
    const inj = failContext ? `\n\nPRIOR-ATTEMPT FEEDBACK (you must address this):\n${failContext}\n\n` : "";
    const response = await invokeLLM({
      messages: [
        { role: "system", content: BONUS_SYSTEM },
        { role: "user", content: cascadeContext + inj + prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bonus_stack",
          strict: true,
          schema: {
            type: "object",
            properties: {
              bonuses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    bonusType: { type: "string", enum: ["accelerator", "gap_filler", "objection_crusher"] },
                    title: { type: "string" },
                    description: { type: "string" },
                    shortLine: { type: "string" },
                    format: { type: "string", enum: ["checklist", "template", "script", "sop", "swipe", "cheatsheet"] },
                    derivedFromObstacle: { type: "string" },
                    value: { type: ["string", "null"] },
                  },
                  required: ["bonusType", "title", "description", "shortLine", "format", "derivedFromObstacle", "value"],
                  additionalProperties: false,
                },
              },
            },
            required: ["bonuses"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (typeof content !== "string") throw new Error("Invalid response format from AI");
    const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const raw = JSON.parse(stripped) as { bonuses: RawBonus[] };
    // value is coach-supplied only — force null from the LLM regardless of what it returned.
    parsed = (raw.bonuses ?? []).map((b) => ({
      bonusType: b.bonusType as GeneratedBonus["bonusType"],
      title: b.title ?? "",
      description: b.description ?? "",
      shortLine: (b as any).shortLine ?? "",
      format: b.format ?? "checklist",
      derivedFromObstacle: b.derivedFromObstacle ?? "",
      value: null,
    }));

    const fab = validateBonusFabricationPatterns(parsed as RawBonus[], validationCtx);
    // Carried out of the loop so the persistence gate can fold these into ONE verdict rather
    // than the legacy family reaching its own separate conclusion.
    __residualLegacyHits = fab.ok ? [] : (fab.hits ?? []).map((h) => ({
      classId: String(h.classId), matched: String((h as any).matched ?? ""), location: String(h.location ?? "bonus"),
    }));
    if (fab.ok) break;

    if (attempt < BONUS_VALIDATOR_RETRY_MAX_ATTEMPTS) {
      failContext = fab.failContext;
      const summary = fab.hits.slice(0, 3).map((h) => `${h.classId}@${h.location}`).join(",");
      console.warn(`[bonusGenerator] fabrication check failed attempt ${attempt}/${BONUS_VALIDATOR_RETRY_MAX_ATTEMPTS} (${fab.hits.length} hits, top=[${summary}]). Retrying with fail-context.`);
      continue;
    }
    console.warn(`[bonusGenerator] fabrication check exhausted retries (${fab.hits.length} hits remaining, classes=[${fab.hits.map((h) => h.classId).join(",")}]); persisting best-effort.`);
  }

  if (!parsed || parsed.length === 0) return null;

  const bonusSetId = nanoid();
  const __bonusRows = parsed.map((b) => ({
      userId: input.userId,
      serviceId: input.serviceId,
      campaignId: input.campaignId ?? null,
      campaignKitId: kit?.id ?? null,
      bonusSetId,
      bonusType: b.bonusType,
      title: b.title,
      description: b.description,
      shortLine: b.shortLine,
      value: null,
      derivedFromObstacle: b.derivedFromObstacle,
    format: b.format,
  }));
  {
    // ONE VERDICT: the legacy bonus validator ran upstream; its hits fold in here rather
    // than reaching a separate conclusion.
    const { gateBeforePersist } = await import("./_core/persistenceGate");
    const __g = await gateBeforePersist("bonuses", __bonusRows as any[], { legacyHits: __residualLegacyHits });
    await db.insert(bonusesTable).values(__g.kept as any);
  };

  return { bonusSetId, bonuses: parsed, campaignKitId: kit?.id ?? null };
}
