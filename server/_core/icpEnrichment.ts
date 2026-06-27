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
import { ICP_SYSTEM_PROMPT, ICP_USER_PROMPT, type ICPServiceInput } from "./icpPrompts";
import { invokeLLM } from "./llm";
import { getDb } from "../db";
import { idealCustomerProfiles, services } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { filterRecord } from "../lib/complianceFilter";

export const ICP_CONTENT_FIELDS = [
  "introduction", "fears", "hopesDreams", "psychographics",
  "pains", "frustrations", "goals", "values", "objections",
  "buyingTriggers", "mediaConsumption", "influencers",
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
  if (icp.demographics == null && generated.demographics) {
    updates.demographics = generated.demographics;
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
        json_schema: {
          name: "icp_enrichment",
          strict: true,
          schema: {
            type: "object",
            properties: {
              introduction: { type: "string" },
              fears: { type: "string" },
              hopesDreams: { type: "string" },
              demographics: {
                type: "object",
                properties: {
                  age_range: { type: "string" },
                  gender: { type: "string" },
                  income_level: { type: "string" },
                  education: { type: "string" },
                  occupation: { type: "string" },
                  location: { type: "string" },
                  family_status: { type: "string" },
                },
                required: ["age_range", "gender", "income_level", "education", "occupation", "location", "family_status"],
                additionalProperties: false,
              },
              psychographics: { type: "string" },
              pains: { type: "string" },
              frustrations: { type: "string" },
              goals: { type: "string" },
              values: { type: "string" },
              objections: { type: "string" },
              buyingTriggers: { type: "string" },
              mediaConsumption: { type: "string" },
              influencers: { type: "string" },
              communicationStyle: { type: "string" },
              decisionMaking: { type: "string" },
              successMetrics: { type: "string" },
              implementationBarriers: { type: "string" },
            },
            required: [
              "introduction", "fears", "hopesDreams", "demographics",
              "psychographics", "pains", "frustrations", "goals", "values",
              "objections", "buyingTriggers", "mediaConsumption", "influencers",
              "communicationStyle", "decisionMaking", "successMetrics",
              "implementationBarriers",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    if (!response?.choices?.[0]?.message?.content) return;
    const content = response.choices[0].message.content;
    const cleaned = (typeof content === "string" ? content : "")
      .replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
    const generated = JSON.parse(cleaned);

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
