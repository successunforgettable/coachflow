/**
 * ICP Enrichment — fills NULL fields on imported ICPs via the seeded 17-tab generator.
 *
 * After importIcp saves a thin row (5 of 17 fields), this function:
 * 1. Loads the ICP row and identifies which fields are NULL
 * 2. Calls the proven ICP_USER_PROMPT with the user's existing content as seed
 * 3. Updates ONLY the NULL fields — user-provided fields are NEVER overwritten
 *
 * This ensures the cascade reads a fully-populated ICP regardless of import path.
 */
import { ICP_SYSTEM_PROMPT, ICP_USER_PROMPT, ICP_JSON_SCHEMA, type ICPServiceInput } from "./icpPrompts";
import { invokeLLM } from "./llm";
import { getDb } from "../db";
import { idealCustomerProfiles, services } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { filterRecord } from "../lib/complianceFilter";

/**
 * The generated sections enrichment can fill. mediaConsumption / influencers are
 * absent because they are no longer generated at all (see icpPrompts.ts).
 */
export const ICP_CONTENT_FIELDS = [
  "introduction", "fears", "hopesDreams", "psychographics",
  "pains", "frustrations", "goals", "values", "objections",
  "buyingTriggers",
  "communicationStyle", "decisionMaking", "successMetrics",
  "implementationBarriers",
] as const;

/**
 * Pure function: builds the set of updates to apply, writing ONLY to NULL fields.
 * Exported for testing — the enrichImportedIcp function uses this internally.
 */
export function buildNullOnlyUpdates(
  icp: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const field of ICP_CONTENT_FIELDS) {
    if (icp[field] == null && generated[field]) {
      updates[field] = generated[field];
    }
  }
  if (updates.pains && !icp.painPoints) updates.painPoints = updates.pains;
  if (updates.goals && !icp.desiredOutcomes) updates.desiredOutcomes = updates.goals;
  if (updates.values && !icp.valuesMotivations) updates.valuesMotivations = updates.values;
  return updates;
}

export async function enrichImportedIcp(icpId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [icp] = await db.select().from(idealCustomerProfiles)
    .where(eq(idealCustomerProfiles.id, icpId)).limit(1);
  if (!icp) return;

  const nullFields = ICP_CONTENT_FIELDS.filter(f => (icp as any)[f] == null);
  if (nullFields.length === 0) return;

  let service: ICPServiceInput = {
    name: "Service", category: null, description: null,
    targetCustomer: null, mainBenefit: null,
  };
  if (icp.serviceId) {
    const [svc] = await db.select({
      name: services.name,
      category: services.category,
      description: services.description,
      targetCustomer: services.targetCustomer,
      mainBenefit: services.mainBenefit,
      // The coach's buyer intel — the import path fetches it too, or an
      // existing-assets coach gets a prompt starved of what they already typed
      // while the generate path gets the full picture. Same seven columns the
      // prompt and the grounding corpus read (ICP_BUYER_INTEL_FIELDS).
      painPoints: services.painPoints,
      whyProblemExists: services.whyProblemExists,
      failedSolutions: services.failedSolutions,
      falseBeliefsVsRealReasons: services.falseBeliefsVsRealReasons,
      hiddenReasons: services.hiddenReasons,
      avatarName: services.avatarName,
      avatarTitle: services.avatarTitle,
    }).from(services).where(eq(services.id, icp.serviceId)).limit(1);
    if (svc) service = svc;
  }

  const existingContent: string[] = [];
  if (icp.name) existingContent.push(`ICP Name: ${icp.name}`);
  for (const field of ICP_CONTENT_FIELDS) {
    const val = (icp as any)[field];
    if (val != null && String(val).trim().length > 0) {
      existingContent.push(`${field} (user-provided): ${val}`);
    }
  }
  if (icp.demographics) {
    existingContent.push(`demographics (user-provided): ${JSON.stringify(icp.demographics)}`);
  }

  const seedBlock = existingContent.length > 0
    ? `\n\nUSER-PROVIDED GROUND TRUTH — the user imported the following content about their ideal customer. Treat this as authoritative. Your generated sections MUST be consistent with this voice, this audience, and this framing. Do NOT contradict, generalize, or drift from the user's specifics. Match their level of niche detail.\n\n${existingContent.join("\n\n")}`
    : "";

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: ICP_SYSTEM_PROMPT() },
        { role: "user", content: ICP_USER_PROMPT(service) + seedBlock },
      ],
      response_format: {
        type: "json_schema",
        json_schema: ICP_JSON_SCHEMA,
      },
    });

    if (!response?.choices?.[0]?.message?.content) return;
    const rawContent = response.choices[0].message.content;

    // Tool-use responses arrive as JSON strings; parse robustly.
    // Guard against HTML error pages (proxy/CDN) and pre-parsed objects.
    let generated: Record<string, unknown>;
    if (typeof rawContent !== "string") {
      generated = rawContent as Record<string, unknown>;
    } else {
      const trimmed = rawContent.trim();
      if (trimmed.startsWith("<")) {
        console.warn(`[icpEnrichment] Received HTML instead of JSON (first 200 chars): ${trimmed.slice(0, 200)}`);
        return;
      }
      generated = JSON.parse(trimmed.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim());
    }

    const textFields = ICP_CONTENT_FIELDS.filter(f => typeof generated[f] === "string");
    const { cleaned: compliant } = filterRecord(
      Object.fromEntries(textFields.map(f => [f, generated[f]])),
      textFields as unknown as string[],
    );

    const updates = buildNullOnlyUpdates(
      icp as Record<string, unknown>,
      { ...compliant, demographics: generated.demographics },
    );

    if (Object.keys(updates).length === 0) return;

    await db.update(idealCustomerProfiles)
      .set(updates)
      .where(eq(idealCustomerProfiles.id, icpId));

    console.log(`[icpEnrichment] Enriched ICP ${icpId}: filled ${Object.keys(updates).length} NULL fields (${Object.keys(updates).join(", ")})`);
  } catch (err) {
    console.warn(`[icpEnrichment] Failed to enrich ICP ${icpId}:`, err instanceof Error ? err.message : String(err));
  }
}
