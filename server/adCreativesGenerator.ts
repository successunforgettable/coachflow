/**
 * Ad Creatives gen-core (Sprint B+1 path d Phase C C1, 2026-05-11).
 *
 * Phase C C1 extension to the B1 runX pattern. Extracts the 5-variation
 * generation loop from adCreativesRouter.generate so the orchestrator can
 * call it directly without an HTTP round-trip and without the free-tier
 * gate (which lives at the router level and is now redundant for Auto Mode
 * since Phase C C0 gates the orchestrate mutation at the same tier).
 *
 * Mirrors B1's 8 other runX cores: typed input shape, no quota check, no
 * tier gate, returns a structured result (batchId + creativeCount). The
 * router's `generate` mutation now calls this gen-core after its free-tier
 * gate, keeping single-source-of-truth on the generation logic.
 *
 * Compositionally: 5 image variations per batch, each ~$0.04 Replicate Flux
 * cost (~$0.20/batch), wall-clock ~2-2.5 min sequential. Auto Mode runs
 * this as cascade step 9 (after whatsappSequence), inserted at the end of
 * the cascade so:
 *   - 8 text generators complete first (faster failure-feedback if any of
 *     them break)
 *   - The visual finale lands after all the text is settled
 *   - Partial-cascade value: if adCreatives fails, the 8 text assets are
 *     still in the kit (per the orchestrator's per-step DB write pattern)
 *
 * Inputs derived in the orchestrator from cascade state:
 *   - niche: service.targetCustomer slice (visual prompting flavor —
 *     "Person dressed and styled for the {niche} world")
 *   - productName: service.name
 *   - uniqueMechanism: looked up from the kit's selectedMechanismId
 *   - targetAudience: service.targetCustomer
 *   - mainBenefit: service.mainBenefit
 *   - pressingProblem: service.painPoints (with ICP fallback)
 *   - adType: "lead_gen" default (matches V2 wizard default)
 *
 * Failure mode: any single variation's image generation failure throws,
 * which surfaces as a step failure in the orchestrator's catch block.
 * Partial-batch (e.g. 3 of 5 succeeded then 4th failed) discards work —
 * not ideal but consistent with router's existing behavior. Sprint 3+
 * could add per-variation retry.
 */
import { getDb } from "./db";
import { adCreatives, services } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { compositeHeadline } from "./_core/compositeHeadline";
import { randomBytes } from "crypto";
import {
  HEADLINE_FORMULAS,
  generateAdImagePrompt,
  checkCompliance,
} from "./routers/adCreatives";

export type RunAdCreativesGenerationInput = {
  userId: number;
  serviceId: number;
  niche: string;
  productName: string;
  uniqueMechanism?: string;
  targetAudience: string;
  mainBenefit: string;
  pressingProblem: string;
  adType?: "lead_gen" | "ecommerce";
};

export type RunAdCreativesGenerationResult = {
  batchId: string;
  creativeCount: number;
};

const VARIATIONS = [
  { style: "person_shocked" as const, formula: "benefit" as const },
  { style: "screenshot" as const, formula: "social_proof" as const },
  { style: "person_intense" as const, formula: "curiosity" as const },
  { style: "object" as const, formula: "contrast" as const },
  { style: "person_curious" as const, formula: "challenge" as const },
];

export async function runAdCreativesGeneration(
  input: RunAdCreativesGenerationInput,
): Promise<RunAdCreativesGenerationResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Lookup service for social-proof context (customer count drives the
  // social_proof headline formula's customer-count phrasing).
  const [serviceRow] = await db
    .select()
    .from(services)
    .where(eq(services.id, input.serviceId))
    .limit(1);
  if (!serviceRow) throw new Error(`Service ${input.serviceId} not found`);

  const customerCount = serviceRow.totalCustomers || 0;
  const mechanism = input.uniqueMechanism || "System";
  const adType = input.adType ?? "lead_gen";
  const batchId = `batch-${Date.now()}-${randomBytes(4).toString("hex")}`;

  let createdCount = 0;
  for (let i = 0; i < VARIATIONS.length; i++) {
    const variation = VARIATIONS[i];
    const headline = HEADLINE_FORMULAS[variation.formula](
      mechanism,
      input.niche,
      customerCount,
    );

    const complianceIssues = checkCompliance(
      headline,
      input.mainBenefit,
      input.pressingProblem,
    );

    const imagePrompt = generateAdImagePrompt(
      variation.style,
      input.niche,
      input.pressingProblem,
    );

    console.log(
      `[adCreativesGenerator] Generating variation ${i + 1}/${VARIATIONS.length} ` +
        `— style=${variation.style} formula=${variation.formula} batchId=${batchId}`,
    );

    const imageResult = await generateImage({ prompt: imagePrompt });
    if (!imageResult.url) {
      throw new Error(
        `Ad creative variation ${i + 1} image generation returned no URL (batchId=${batchId})`,
      );
    }

    // Download raw Flux output, then dual-upload: raw → rawImageUrl,
    // composited headline → imageUrl. Matches the router's pattern so
    // future recomposites work the same way for orchestrator-generated
    // batches as for wizard-generated ones.
    const imageResponse = await fetch(imageResult.url);
    const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const rawKey = `ad-creatives/${input.userId}/${batchId}/raw-variation-${i + 1}.png`;
    const { url: rawImageUrl } = await storagePut(rawKey, rawBuffer, "image/png");

    const compositedBuffer = await compositeHeadline(
      rawBuffer,
      headline,
      variation.style,
    );
    const fileKey = `ad-creatives/${input.userId}/${batchId}/variation-${i + 1}.png`;
    const { url: s3Url } = await storagePut(fileKey, compositedBuffer, "image/png");

    await db.insert(adCreatives).values({
      userId: input.userId,
      serviceId: input.serviceId,
      niche: input.niche,
      productName: input.productName,
      uniqueMechanism: mechanism,
      targetAudience: input.targetAudience,
      mainBenefit: input.mainBenefit,
      pressingProblem: input.pressingProblem,
      adType,
      designStyle: variation.style,
      headlineFormula: variation.formula,
      headline,
      imageUrl: s3Url,
      rawImageUrl,
      imageFormat: "1080x1080",
      complianceChecked: true,
      complianceIssues: complianceIssues.length > 0 ? JSON.stringify(complianceIssues) : null,
      batchId,
      variationNumber: i + 1,
    });

    createdCount += 1;
  }

  console.log(
    `[adCreativesGenerator] Batch ${batchId} complete — ${createdCount} variations`,
  );

  return { batchId, creativeCount: createdCount };
}
