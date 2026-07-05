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
import { generateImage, generateEditorialImage } from "./_core/imageGeneration";
import { buildEditorialPrompt, EDITORIAL_VARIATIONS } from "./_core/editorialPrompt";
import { storagePut } from "./storage";
import { renderAdCreative, deriveAccent, resolveAdBodyText } from "./_core/compositeHeadline";
import { ctaForCampaignType } from "./_core/campaignCta";
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
  // validateAdHeadlines on the producer side). Stage 2: each carries an
  // optional accent `emphasis` for the two-tone headline render.
  headlines?: { text: string; emphasis?: string }[];
  // Stage 2: drives the render template's CTA pill (CAMPAIGN_TO_CTA).
  campaignType?: string;
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

// Sprint 3 C4 side-fix: 3→5. Long-named niches (kit 128: "shift-working
// nurses who can't switch off after night shifts…") exhausted 3 attempts
// twice in the wild. The ≤38-char validator is untouched — more attempts +
// saner inputs (truncation in buildAdHeadlinesUserPrompt) fix the inputs,
// never the gate.
const AD_HEADLINES_RETRY_MAX_ATTEMPTS = 5;

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
        // Parallel to headlines: emphases[i] is the single phrase in headlines[i]
        // to render in the gold accent colour — a verbatim substring, 1-4 words.
        emphases: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["headlines", "emphases"],
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
  icpPains?: string;
  icpFears?: string;
  icpObjections?: string;
  icpBuyingTriggers?: string;
};

/**
 * Build the user prompt for the contextual-ad-headlines LLM call.
 * Phase C C1.1 Phase 2 fortification (Sprint B+1 path d, 2026-05-11):
 *
 *   - Length rule moved to the TOP with word-count planning strategy
 *     (4-7 words → ~25-45 chars). Empirically, Sonnet length-follows
 *     better when given a word-count proxy than abstract char counts.
 *   - "Avoid generic audience-naming" rule added explicitly. The kit 13
 *     C1 audit showed compliance-flagged HEADLINE_FORMULAS pattern was
 *     always shape `WHY {LONG_AUDIENCE_NAMING} COACHES ARE SWITCHING TO
 *     {MECH}` — dropping the audience-prefix is the single
 *     highest-leverage compression. Few-shot examples reinforce the
 *     pattern.
 *   - 3 few-shot compression examples spanning the 3 service categories
 *     audited this session (speaking / consulting / info-product). Each
 *     pair shows the long-form being compressed → compliant headline +
 *     names what got cut + names what stayed. Cross-context examples
 *     (not Calm Authority — the actual ICP) avoid seeding specific
 *     output while still teaching the pattern.
 *   - SOCIAL_PROOF register guidance tightened. The successful kit 13
 *     C1.1 run produced 4/5 strong headlines + 1/5 weak — the weak one
 *     was "Senior leaders trust this protocol", a generic credibility
 *     claim. New guidance: ban "X trust this" / "experts use this"
 *     shapes, require named contexts or numeric proofs.
 *   - Per-register example shapes (1-2 short references per emotional
 *     register) so each register has concrete length-fitting models,
 *     not just abstract guidance.
 *   - Closes with a "count characters on each" final reminder.
 *
 * Exported for smoke-testability — pipeline-fixes.test.ts verifies the
 * example compressions + length-rule wording are present in the
 * constructed prompt.
 */
export function buildAdHeadlinesUserPrompt(input: GenerateContextualAdHeadlinesInput): string {
  // Sprint 3 C4 side-fix: cascade-derived inputs can be full sentences
  // (ICP descriptors, mechanism paragraphs). Long inputs drag the model
  // toward long headlines and exhaust the ≤38-char validator's retries.
  // The prompt only needs the gist — truncate at word boundaries.
  const gist = (s: string, max: number): string => {
    const t = (s ?? "").trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)}…`;
  };
  return `Write 5 Meta-compliant ad headlines for this service.

Service: ${gist(input.productName, 60)}
Audience: ${gist(input.targetAudience, 90)}
Main benefit: ${gist(input.mainBenefit, 110)}
Mechanism: ${gist(input.uniqueMechanism, 60)}
Pressing problem: ${gist(input.pressingProblem, 120)}${input.icpPains ? `\nAudience daily pains: ${gist(input.icpPains, 200)}` : ""}${input.icpFears ? `\nAudience deep fears: ${gist(input.icpFears, 200)}` : ""}${input.icpObjections ? `\nAudience objections to buying: ${gist(input.icpObjections, 150)}` : ""}${input.icpBuyingTriggers ? `\nWhat triggers them to buy: ${gist(input.icpBuyingTriggers, 150)}` : ""}

LENGTH RULE (READ TWICE):
- Each headline MUST be ≤ 38 characters. This is a HARD LIMIT — Meta-compliance gate.
- Plan each headline as 4 to 7 WORDS before writing. A 5-word headline averages 25-35 characters; a 7-word headline averages 35-45 characters. Word-count planning is more reliable than character-counting after the fact.
- After writing each headline, count the characters. If 38 or fewer, keep. If over 38, cut filler words (the, a, your, this, that, our) or pick a shorter verb. Never ship a headline over 38 characters.

VOICE RULES:
- No exclamation points anywhere.
- No vague buzzwords (synergy, leverage, optimize, transform, unlock, revolutionary).
- Drop the audience prefix. Headlines like "Senior leaders who…", "Founders at $X ARR…", "Coaches struggling with…" are forbidden — the Meta ad targeting handles audience selection. Lead with the scenario, outcome, or pattern-interrupt instead.
- Each headline must reference a SPECIFIC scenario, number, outcome, or contrast — NEVER a generic claim like "trust this", "experts use this", "the best way to…".

EXAMPLE COMPRESSIONS — see how long-form audience descriptions become compliant ad headlines:

Service: senior-leader keynote presence coaching
TOO LONG: "Finance and engineering leaders who struggle with boardroom pressure"
COMPLIANT (38 chars): "Boardroom voice killed the promotion."
Pattern: dropped audience prefix ("Finance and engineering leaders who…"); kept the specific failure scenario; declarative form.

Service: B2B SaaS pipeline-diagnosis consulting
TOO LONG: "SaaS founders who can't distinguish closing deals from time-wasters"
COMPLIANT (33 chars): "Your $800k pipeline might be $200k."
Pattern: dropped audience prefix; kept the specific number-contrast; question-shape via "might be".

Service: field-audio-recording info-product course
TOO LONG: "Field journalists who struggle with inconsistent phone audio quality"
COMPLIANT (33 chars): "Why your last clip went unusable."
Pattern: dropped audience prefix; kept the niche-specific failure mode ("last clip went unusable"); question-shape.

In all three compressions, the audience-naming consumed 40-60% of the characters and added zero ad-headline value. Compress aggressively.

THE 5 HEADLINES — each must match a different ad register, in order:

1. BENEFIT — name the outcome the audience wants. Direct, declarative, claim-the-result.
   Example shapes: "Cut sales cycles 50%." / "Board-ready in 90 days." / "Stop the 2am replay loop."

2. SOCIAL_PROOF — reference a SPECIFIC outcome, named context, or numeric proof. NOT "X trust this" or "experts use this" or "leaders adopt this" — those are generic and forbidden. Use a concrete claim, a named situation, or a number.
   Example shapes: "Most boards see it in 90 days." / "From 26 dead deals to 11 real ones."

3. CURIOSITY — open a loop or hint at a reframe. Make the reader want to know more.
   Example shapes: "Your prep is fine. Your state isn't." / "It's not the deck." / "The 4-second window before words."

4. CONTRAST — before/after framing OR what-vs-what positioning.
   Example shapes: "Six rehearsals at home, froze onstage." / "Hope vs. data." / "Closed-won — not closed-wished."

5. CHALLENGE — call out the wrong way; provoke action against a counterproductive pattern.
   Example shapes: "Stop chasing dead pipeline." / "Sitting up straight won't hold a room." / "Forecasting fiction isn't strategy."

Output: a JSON object with a "headlines" key (array of exactly 5 strings, in the order above: benefit, social_proof, curiosity, contrast, challenge) AND an "emphases" key (array of exactly 5 strings, parallel to headlines).

For each headline, emphases[i] is the single most impactful phrase to highlight in a gold accent colour on the finished ad — the emotional or specific-outcome punch of that line. It MUST be a verbatim substring of headlines[i] (identical characters, same case), 1 to 4 words, never the entire headline. Examples: for "Your one income source has zero backup plan" → "backup plan"; for "30 apps, zero calls back. This worked." → "This worked."; for "Stop blaming price for lost deals" → "lost deals".

Count the characters on each headline before finalising. Anything over 38 forces a rewrite.`;
}

/**
 * Per-attempt diagnostic record for Bridge-B-style observability on retry
 * exhaust. Captures everything needed to reconstruct what Sonnet produced
 * across all 3 attempts + how the fail-context evolved between them.
 * Mirrors the email validator's Bridge B pattern; richer here because ad-
 * headline failures are a content-class problem (compliance) where seeing
 * Sonnet's output evolution matters more than just the final raw content.
 */
type AdHeadlineAttemptRecord = {
  attempt: number;
  rawContent: string;
  headlinesPreview: string[]; // each parsed headline string (or [] if parse-shape unexpected)
  charCounts: number[]; // each headline's char count
  validationOk: boolean;
  subCase: string | null;
  failContextInjectedNext: string | null; // what got prepended to the NEXT attempt's prompt
};

export async function generateContextualAdHeadlines(
  input: GenerateContextualAdHeadlinesInput,
): Promise<{ text: string; emphasis: string }[]> {
  const userPromptBase = buildAdHeadlinesUserPrompt(input);
  let lastFailContext: string | null = null;
  let lastFailureSubCase: string | null = null;
  // Phase C C1.1 diagnostic (Bridge-B-style — Sprint B+1 path d lineage):
  // captures every attempt's raw content + parsed headlines + char counts +
  // validation outcome + fail-context-injected-for-next-attempt. On retry
  // exhaust, the full history dumps to console.error so Railway logs let us
  // see what Sonnet actually produced across all 3 attempts. Without this,
  // the existing console.warn only shows subCase + attempt number, which
  // doesn't reveal whether Sonnet is missing the 38-char cap by 2 chars
  // (prompt-tuning territory) or by 30+ chars (architectural prompt failure
  // territory). Bounded cost: history array max 3 entries; only dumps on
  // exhaust, never on success path.
  const attemptHistory: AdHeadlineAttemptRecord[] = [];

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

    // Pre-extract headlines for diagnostic regardless of validation outcome.
    // The validator may reject these but we still want to log what Sonnet
    // produced so we can see content + lengths.
    let diagnosticHeadlines: string[] = [];
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const candidate = (parsed as Record<string, unknown>).headlines;
      if (Array.isArray(candidate)) {
        diagnosticHeadlines = candidate.filter((h): h is string => typeof h === "string");
      } else if (typeof candidate === "string") {
        // Pre-un-stringify for diagnostic purposes (mirrors validator's path)
        try {
          const v = JSON.parse(candidate);
          if (Array.isArray(v)) diagnosticHeadlines = v.filter((h): h is string => typeof h === "string");
        } catch { /* leave empty */ }
      }
    } else if (Array.isArray(parsed)) {
      diagnosticHeadlines = parsed.filter((h): h is string => typeof h === "string");
    }
    const diagnosticCharCounts = diagnosticHeadlines.map(h => h.length);

    const result = validateAdHeadlines(parsed);

    // Per-attempt visibility log (always fires — pass or fail). Concise
    // summary line + verbatim headlines so log greps can correlate.
    if (diagnosticHeadlines.length > 0) {
      console.warn(
        `[adCreativesGenerator] Attempt ${attempt}/${AD_HEADLINES_RETRY_MAX_ATTEMPTS} produced ` +
          `${diagnosticHeadlines.length} headlines, char counts [${diagnosticCharCounts.join(",")}], ` +
          `validation=${result.ok ? "PASS" : `FAIL(${result.subCase})`}`,
      );
      diagnosticHeadlines.forEach((h, i) => {
        console.warn(`[adCreativesGenerator]   attempt ${attempt} headline[${i}] (${h.length} chars): "${h}"`);
      });
    } else {
      console.warn(
        `[adCreativesGenerator] Attempt ${attempt}/${AD_HEADLINES_RETRY_MAX_ATTEMPTS} produced ` +
          `no extractable headlines (parsed shape unexpected), validation=FAIL(${result.ok ? "OK?" : result.subCase})`,
      );
    }

    if (result.ok) {
      console.log(
        `[adCreativesGenerator] Contextual ad headlines: ${result.headlines.length} produced, ` +
          `max len = ${Math.max(...result.headlines.map(h => h.length))} chars (attempt ${attempt})`,
      );
      // Pair each headline with its accent phrase. The generator's emphasis is
      // used only when it's a genuine verbatim substring; otherwise the
      // deterministic heuristic (parity-safe) picks it.
      const rawEmphases = Array.isArray((parsed as Record<string, unknown>).emphases)
        ? ((parsed as Record<string, unknown>).emphases as unknown[])
        : [];
      return result.headlines.map((text, i) => {
        const cand = typeof rawEmphases[i] === "string" ? (rawEmphases[i] as string).trim() : "";
        const valid = cand.length > 0 && text.toUpperCase().includes(cand.toUpperCase());
        return { text, emphasis: valid ? cand : deriveAccent(text) };
      });
    }

    // Record attempt for exhaust dump; failContext gets recorded AS the
    // one that will be injected into the NEXT attempt (or, on attempt 3,
    // would have been injected into a non-existent attempt 4).
    attemptHistory.push({
      attempt,
      rawContent: content,
      headlinesPreview: diagnosticHeadlines,
      charCounts: diagnosticCharCounts,
      validationOk: false,
      subCase: result.subCase,
      failContextInjectedNext: result.failContext,
    });

    lastFailContext = result.failContext;
    lastFailureSubCase = result.subCase;
    console.warn(
      `[adCreativesGenerator] Ad headlines validation failed on attempt ${attempt}/${AD_HEADLINES_RETRY_MAX_ATTEMPTS} ` +
        `(subCase=${result.subCase}). Retrying with fail-context.`,
    );
  }

  // Retry exhaust — Bridge-B-style comprehensive diagnostic dump.
  // Mirrors invokeEmailSequenceWithRetry's RETRY EXHAUST pattern: console.error
  // (so log aggregators surface above warnings) + multiple lines (so
  // line-length truncation doesn't lose data) + full per-attempt history.
  console.error(`[adCreativesGenerator] RETRY EXHAUST — Phase C C1.1 Bridge B diagnostic dump for ad headlines generation.`);
  console.error(`[adCreativesGenerator] RETRY EXHAUST — final lastFailureSubCase: ${lastFailureSubCase}`);
  console.error(`[adCreativesGenerator] RETRY EXHAUST — attempt count: ${attemptHistory.length}`);
  attemptHistory.forEach((rec) => {
    console.error(
      `[adCreativesGenerator] RETRY EXHAUST — attempt ${rec.attempt}: ` +
        `validation=FAIL(${rec.subCase}), ${rec.charCounts.length} headlines extracted, ` +
        `char counts [${rec.charCounts.join(",")}], over38=${rec.charCounts.filter(c => c > 38).length}`,
    );
    rec.headlinesPreview.forEach((h, i) => {
      console.error(`[adCreativesGenerator] RETRY EXHAUST — attempt ${rec.attempt} headline[${i}] (${h.length} chars): "${h}"`);
    });
  });
  // Dump full raw content of the LAST attempt (in case parse extracted
  // different content than the validator saw — e.g. if the schema response
  // wrapped the array in an unexpected outer shape).
  const last = attemptHistory[attemptHistory.length - 1];
  if (last) {
    console.error(`[adCreativesGenerator] RETRY EXHAUST — last attempt FULL RAW CONTENT: ${last.rawContent}`);
  }
  // Show the SHAPE of fail-context evolution: was the next-attempt prompt
  // the same advice every retry, or did it change? Answers H3 (fail-context
  // staleness) from the Phase 1 diagnosis hypothesis ranking.
  attemptHistory.forEach((rec) => {
    if (rec.failContextInjectedNext) {
      const truncated = rec.failContextInjectedNext.length > 600
        ? rec.failContextInjectedNext.slice(0, 600) + "...[truncated]"
        : rec.failContextInjectedNext;
      console.error(`[adCreativesGenerator] RETRY EXHAUST — attempt ${rec.attempt} failContext injected into attempt ${rec.attempt + 1}: ${truncated}`);
    }
  });

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

  // Stage 2 render-template inputs, resolved once per batch: the CTA pill label
  // (campaign-type-driven) and the campaign-aligned body copy (reused ad copy).
  const ctaLabel = ctaForCampaignType(input.campaignType);
  const bodyText = await resolveAdBodyText(db, input.userId, input.serviceId);

  let createdCount = 0;
  for (let i = 0; i < VARIATIONS.length; i++) {
    const variation = VARIATIONS[i];
    const hl = input.headlines
      ? input.headlines[i]
      : { text: HEADLINE_FORMULAS[variation.formula](mechanism, input.niche, customerCount), emphasis: undefined as string | undefined };
    const headline = hl.text;

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

    const compositedBuffer = await renderAdCreative(rawBuffer, {
      headline,
      emphasis: hl.emphasis,
      bodyText,
      ctaLabel,
    });
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

// ─── Stage 3: editorial (gold-on-black) ad creatives ─────────────────────────
// Parallel to runAdCreativesGeneration but on the flux-2-pro editorial recipe
// (no green-arrow tabloid cues) with zone-aware text placement. Photo prompt is
// recipe-only (no input_images — provenance-clean, no sample echo). Tabloid path
// is untouched. Aspect ratio 4:5 (editorial feed standard).
export async function runEditorialAdCreativesGeneration(
  input: RunAdCreativesGenerationInput,
): Promise<RunAdCreativesGenerationResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [serviceRow] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
  if (!serviceRow) throw new Error(`Service ${input.serviceId} not found`);

  const customerCount = serviceRow.totalCustomers || 0;
  const mechanism = input.uniqueMechanism || "System";
  const adType = input.adType ?? "lead_gen";
  const batchId = `batch-${Date.now()}-${randomBytes(4).toString("hex")}`;

  if (input.headlines && input.headlines.length !== EDITORIAL_VARIATIONS.length) {
    throw new Error(
      `runEditorialAdCreativesGeneration: input.headlines length ${input.headlines.length} ` +
        `does not match expected ${EDITORIAL_VARIATIONS.length} variations`,
    );
  }

  const ctaLabel = ctaForCampaignType(input.campaignType);
  const bodyText = await resolveAdBodyText(db, input.userId, input.serviceId);

  let createdCount = 0;
  for (let i = 0; i < EDITORIAL_VARIATIONS.length; i++) {
    const variation = EDITORIAL_VARIATIONS[i];
    const hl = input.headlines
      ? input.headlines[i]
      : { text: HEADLINE_FORMULAS[variation.formula](mechanism, input.niche, customerCount), emphasis: undefined as string | undefined };
    const headline = hl.text;

    const complianceIssues = checkCompliance(headline, input.mainBenefit, input.pressingProblem);
    const imagePrompt = buildEditorialPrompt(variation, input.niche, input.pressingProblem);

    console.log(`[editorialGen] variation ${i + 1}/${EDITORIAL_VARIATIONS.length} — ${variation.key} zone=${variation.zone} batchId=${batchId}`);

    const imageResult = await generateEditorialImage({ prompt: imagePrompt, aspectRatio: "4:5" });
    if (!imageResult.url) throw new Error(`Editorial variation ${i + 1} returned no URL (batchId=${batchId})`);

    const rawBuffer = Buffer.from(await (await fetch(imageResult.url)).arrayBuffer());
    const rawKey = `ad-creatives/${input.userId}/${batchId}/raw-variation-${i + 1}.png`;
    const { url: rawImageUrl } = await storagePut(rawKey, rawBuffer, "image/png");

    const compositedBuffer = await renderAdCreative(rawBuffer, {
      headline, emphasis: hl.emphasis, bodyText, ctaLabel, zone: variation.zone,
    });
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
      // designStyle/styleType are restricted enums that don't yet include the
      // editorial keys — a clean-up migration (add "editorial" to styleType +
      // the 5 editorial keys to designStyle) is the proper follow-up. Until
      // then: store a VALID existing designStyle (vestigial for editorial —
      // the editorial path prompts from the variation, not this column) and let
      // styleType default. Editorial rows are identified by imageFormat 1080x1350.
      designStyle: (variation.mode === "person" ? "person_intense" : "object") as any,
      headlineFormula: variation.formula,
      headline,
      imageUrl: s3Url,
      rawImageUrl,
      imageFormat: "1080x1350",
      complianceChecked: true,
      complianceIssues: complianceIssues.length > 0 ? JSON.stringify(complianceIssues) : null,
      batchId,
      variationNumber: i + 1,
    } as any);
    createdCount += 1;
  }

  console.log(`[editorialGen] Batch ${batchId} complete — ${createdCount} editorial variations`);
  return { batchId, creativeCount: createdCount };
}
