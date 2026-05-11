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
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { compositeHeadline } from "./_core/compositeHeadline";
import { randomBytes } from "crypto";
import {
  HEADLINE_FORMULAS,
  generateAdImagePrompt,
  checkCompliance,
} from "./routers/adCreatives";
import { validateAdHeadlines } from "./_core/validator";

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
  // Phase C C1.1: optional pre-formed headlines from
  // generateContextualAdHeadlines (Auto Mode path uses these; wizard path
  // omits and falls back to HEADLINE_FORMULAS for backward compat).
  // Length must be exactly 5; each headline ≤38 chars (enforced by
  // validateAdHeadlines on the producer side).
  headlines?: string[];
};

// ─── Phase C C1.1: contextual ad headlines micro-call ────────────────────────
// Replaces HEADLINE_FORMULAS template-fill for the Auto Mode cascade. The
// template approach blew past Meta's 40-char headline recommendation when
// fed cascade-derived niche + mechanism strings (kit 13 evidence: all 5
// variations flagged). This new function calls Sonnet with a tight prompt
// that produces 5 contextual ≤38-char headlines, validated post-gen via
// validateAdHeadlines with retry-with-fail-context.
//
// Wizard path is unchanged — adCreatives.generate's existing mutation passes
// no `headlines` arg, runAdCreativesGeneration falls back to HEADLINE_FORMULAS
// (which works fine for wizard-typed short niche + mechanism inputs).

const AD_HEADLINES_RETRY_MAX_ATTEMPTS = 3;

const AD_HEADLINES_SYSTEM_PROMPT =
  "You are a senior Meta ads copywriter. You write punchy, scroll-stopping ad headlines that fit Meta's 40-character recommendation. You use active verbs, ICP-recognising language, and no buzzwords. You never use exclamation points. You count characters before finalising each line.";

const AD_HEADLINES_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "ad_headlines",
    strict: true,
    schema: {
      type: "object",
      properties: {
        headlines: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["headlines"],
      additionalProperties: false,
    },
  },
};

export type GenerateContextualAdHeadlinesInput = {
  productName: string;
  mainBenefit: string;
  targetAudience: string;
  uniqueMechanism: string;
  pressingProblem: string;
};

function buildAdHeadlinesUserPrompt(input: GenerateContextualAdHeadlinesInput): string {
  return `Write 5 Meta-compliant ad headlines for this service.

Service: ${input.productName}
Audience: ${input.targetAudience}
Main benefit: ${input.mainBenefit}
Mechanism: ${input.uniqueMechanism}
Pressing problem: ${input.pressingProblem}

HARD RULES:
- Each headline MUST be ≤ 38 characters. Count before finalising. This is a HARD LIMIT — anything over forces a rewrite.
- No exclamation points anywhere.
- No vague buzzwords (synergy, leverage, optimize, transform, unlock, revolutionary).
- Use ICP-recognising specific language; avoid generic coach-speak.
- Each headline must work as a standalone Meta Facebook ad headline a paying user would actually run.

The 5 headlines must each match a different ad-emotional register, in order:
1. BENEFIT — name the outcome the audience wants (paired with shocked-face visual)
2. SOCIAL_PROOF — imply credibility or peer adoption (paired with screenshot visual)
3. CURIOSITY — open a loop or hint at a reframe (paired with intense-gaze visual)
4. CONTRAST — before/after framing OR what-vs-what positioning (paired with object visual)
5. CHALLENGE — call out the wrong way; provoke action (paired with curious-face visual)

Output: a JSON object with a "headlines" key containing an array of exactly 5 strings, in the order above.`;
}

export async function generateContextualAdHeadlines(
  input: GenerateContextualAdHeadlinesInput,
): Promise<string[]> {
  const userPromptBase = buildAdHeadlinesUserPrompt(input);
  let lastFailContext: string | null = null;
  let lastFailureSubCase: string | null = null;

  for (let attempt = 1; attempt <= AD_HEADLINES_RETRY_MAX_ATTEMPTS; attempt++) {
    const effectivePrompt = lastFailContext
      ? `${userPromptBase}\n\n---\n\nIMPORTANT: your previous attempt failed validation. ${lastFailContext}`
      : userPromptBase;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: AD_HEADLINES_SYSTEM_PROMPT },
        { role: "user", content: effectivePrompt },
      ],
      response_format: AD_HEADLINES_RESPONSE_FORMAT,
    });
    const content = response.choices[0].message.content;
    if (typeof content !== "string") {
      throw new Error("Invalid response format from ad-headlines LLM call");
    }
    const parsed = JSON.parse(content);

    const result = validateAdHeadlines(parsed);
    if (result.ok) {
      console.log(
        `[adCreativesGenerator] Contextual ad headlines: ${result.headlines.length} produced, ` +
          `max len = ${Math.max(...result.headlines.map(h => h.length))} chars (attempt ${attempt})`,
      );
      return result.headlines;
    }

    lastFailContext = result.failContext;
    lastFailureSubCase = result.subCase;
    console.warn(
      `[adCreativesGenerator] Ad headlines validation failed on attempt ${attempt}/${AD_HEADLINES_RETRY_MAX_ATTEMPTS} ` +
        `(subCase=${result.subCase}). Retrying with fail-context.`,
    );
  }

  // Retry exhaust — headlines unrecoverable. Throw with diagnostic so the
  // orchestrator's per-step catch marks the job failed cleanly (better than
  // shipping headlines that fail Meta compliance).
  throw new Error(
    `Ad headlines LLM did not return Meta-compliant headlines after ${AD_HEADLINES_RETRY_MAX_ATTEMPTS} attempts. ` +
      `Last failure: subCase=${lastFailureSubCase}`,
  );
}

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

  // Phase C C1.1: prefer caller-supplied headlines (Auto Mode path passes
  // generateContextualAdHeadlines output, length-validated ≤38 chars). Else
  // fall back to HEADLINE_FORMULAS template-fill (wizard path, unchanged).
  // Caller is responsible for the array's shape; defensive length check here
  // catches accidental wrong-length input from future callers.
  if (input.headlines && input.headlines.length !== VARIATIONS.length) {
    throw new Error(
      `runAdCreativesGeneration: input.headlines length ${input.headlines.length} ` +
        `does not match expected ${VARIATIONS.length} variations`,
    );
  }

  let createdCount = 0;
  for (let i = 0; i < VARIATIONS.length; i++) {
    const variation = VARIATIONS[i];
    const headline = input.headlines
      ? input.headlines[i]
      : HEADLINE_FORMULAS[variation.formula](mechanism, input.niche, customerCount);

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
