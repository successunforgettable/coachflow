import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { adCreatives, services, users, jobs, headlines } from "../../drizzle/schema";
import { eq, and, desc, gte, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";
import { compositeHeadline } from "../_core/compositeHeadline";
import { randomBytes, randomUUID } from "crypto";

// Meta-prohibited phrases for compliance checking
const PROHIBITED_PHRASES = [
  "make $",
  "earn money while you sleep",
  "turn $",
  "into $",
  "guaranteed",
  "get rich quick",
  "proven to make money",
  "easy money",
  "fast cash",
];

// Meta-compliant scroll-stopper headline formulas
// These use curiosity, benefit claims, social proof, contrast, challenge, and pain without prohibited language
// Note on curiosity formula: "EXPERTS DON'T TALK ABOUT" is banned Meta suppressed-information framing — replaced
// Note on social_proof fallback: "PROS LOVE THIS" replaced with transformation-implying copy
// IMAGE STYLE GUIDE for future angle-matched creative selection:
//   person_shocked  → best for proof/results angles (concrete outcome, social proof)
//   screenshot      → best for mechanism/demonstration angles (show the tool, show the result)
//   person_intense  → best for identity/authority angles (aspiration, credibility)
//   object          → best for mechanism reveal angles (show the asset or deliverable)
//   person_curious  → best for curiosity/contrarian angles (intrigue, challenge to belief)
//   pain formula    → best for LOSS angles (name the shared pain, create recognition)
const HEADLINE_FORMULAS = {
  benefit: (mechanism: string, niche: string, _customers?: number) =>
    `${mechanism.toUpperCase()}: CUT YOUR ${niche.toUpperCase()} TIME BY 90%`,
  social_proof: (mechanism: string, niche: string, customers?: number) =>
    customers && customers > 0
      ? `${customers.toLocaleString()}+ ${niche.toUpperCase()} PROS USE THIS ${mechanism.toUpperCase()}`
      : `${niche.toUpperCase()} COACHES WHO TRY THIS DON'T GO BACK`,
  curiosity: (mechanism: string, niche: string, _customers?: number) =>
    `WHY ${niche.toUpperCase()} COACHES ARE SWITCHING TO ${mechanism.toUpperCase()}`,
  contrast: (mechanism: string, niche: string, _customers?: number) =>
    `BEFORE ${mechanism.toUpperCase()}: 40 HOURS. AFTER: 4 HOURS`,
  challenge: (mechanism: string, niche: string, _customers?: number) =>
    `STILL DOING ${niche.toUpperCase()} THE OLD WAY? TRY ${mechanism.toUpperCase()}`,
  pain: (mechanism: string, niche: string, _customers?: number) =>
    `EVERY ${niche.toUpperCase()} COACH FEELS THIS. MOST NEVER FIX IT.`,
};

// Check for Meta compliance issues
function checkCompliance(headline: string, benefit: string, problem: string): string[] {
  const issues: string[] = [];
  const textToCheck = `${headline} ${benefit} ${problem}`.toLowerCase();
  
  for (const phrase of PROHIBITED_PHRASES) {
    if (textToCheck.includes(phrase.toLowerCase())) {
      issues.push(`Contains prohibited phrase: "${phrase}"`);
    }
  }
  
  if (headline.length > 40) {
    issues.push("Headline exceeds 40 characters (Meta recommendation)");
  }
  
  return issues;
}

// Generate ad image prompt — visual scene only, no text instructions.
// Headline text is composited server-side via opentype.js + resvg-js after generation
// (see server/_core/compositeHeadline.ts). AI models cannot reliably render text —
// removing text instructions eliminates hallucinated glyphs.
function generateAdImagePrompt(
  style: string,
  niche: string,
  problem: string,
  uglyMode = false
): string {
  const baseStyle = uglyMode
    ? "Raw UGC aesthetic, shot on iPhone, unpolished and authentic, slightly messy real-world environment, natural handheld camera shake, no studio lighting, no professional makeup, low-budget realism, observational documentary style, native social feed feel"
    : "Gossip magazine style, tabloid aesthetic, phone-quality photo (NOT polished studio shot), dramatic lighting, high contrast";

  // Niche context and compliance — applied to every style
  const nicheContext = `The person and setting must visually match the ${niche} niche — their clothing, environment, and expression must be recognisable to someone in that world. A fitness coach's client looks different from a crypto trader's client looks different from a corporate executive's client.`;
  const complianceNote = `Do not generate images that imply medical treatment, guaranteed financial results, or dramatic physical before/after transformation. Images must show aspiration and possibility, not guaranteed outcomes.`;

  // Hard negative — applied to every style. Diffusion models treat text as
  // pixel-prediction and hallucinate garbled glyphs; real headlines are composited
  // server-side via resvg so the AI scene must have zero text.
  const noText = "NO text, NO words, NO letters, NO numbers, NO captions, NO labels, NO signs, NO chalk writing, NO handwriting, NO overlay text anywhere in the image.";

  const stylePrompts = {
    person_shocked: `${baseStyle}. Person (30-45 years old) dressed and styled for the ${niche} world, with EXCITED expression, wide eyes, enthusiastic smile, pointing at viewer. Dark grey/black background. Green circle annotation around head with checkmark. Hand-drawn green arrow pointing from circle to viewer. ${nicheContext} ${complianceNote} ${noText}`,

    screenshot: `${baseStyle}. Laptop screen photographed at angle showing a ${niche}-relevant dashboard or workspace with results/numbers. Dark desk surface, coffee cup visible. Multiple green circles around key metrics. Green arrows pointing UP at gains. ${nicheContext} ${complianceNote} ${noText}`,

    person_intense: `${baseStyle}. Person (30-45 years old) dressed and styled for the ${niche} world, with CONFIDENT expression, serious face, leaning forward, direct eye contact. Dark background with spotlight on face. Green circle around key element in background. Green arrow pointing TO circled element. ${nicheContext} ${complianceNote} ${noText}`,

    object: `${baseStyle}. Relevant object (document, product, device, or tool) specifically associated with the ${niche} niche. Dramatic lighting, dark background. Green circles around key features. Green arrows pointing to circled areas. ${nicheContext} ${complianceNote} ${noText}`,

    person_curious: `${baseStyle}. Person (30-45 years old) dressed and styled for the ${niche} world, with INTRIGUED expression, raised eyebrow, interested smile, head tilted. Dark grey background. Large green circle around a key element. Green arrow pointing from circle. ${nicheContext} ${complianceNote} ${noText}`,
  };

  return stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.person_shocked;
}

// Free-tier ad image gate — stops trial/free users from spamming Generate or
// Regenerate. Each click triggers a paid Replicate image call, so unlimited
// free usage is a direct money leak. Paid tiers (pro/agency) are ungated here
// (separate credit-deduction sprint will cover them).
// Threshold: once the user has ≥ FREE_TIER_AD_IMAGE_LIMIT total adCreatives
// rows across all their campaigns, both Generate and Regenerate are blocked.
const FREE_TIER_AD_IMAGE_LIMIT = 2;

async function enforceFreeTierAdImageGate(
  userId: number,
  subscriptionTier: string | null | undefined,
  userRole: string | null | undefined,
): Promise<void> {
  // Superusers and paid tiers (pro/agency) are ungated
  if (userRole === "superuser") return;
  const tier = subscriptionTier || "trial";
  if (tier !== "trial") return;

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [row] = await db
    .select({ n: count() })
    .from(adCreatives)
    .where(eq(adCreatives.userId, userId));

  const total = row?.n ?? 0;
  if (total >= FREE_TIER_AD_IMAGE_LIMIT) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Free tier ad image limit reached. Upgrade to Pro to regenerate.",
    });
  }
}

const generateAdCreativesSchema = z.object({
  serviceId: z.coerce.number(),
  niche: z.string().min(1, "Niche is required"),
  productName: z.string().min(1, "Product name is required"),
  uniqueMechanism: z.string().optional(),
  targetAudience: z.string().min(1, "Target audience is required"),
  mainBenefit: z.string().min(1, "Main benefit is required"),
  pressingProblem: z.string().min(1, "Pressing problem is required"),
  adType: z.enum(["lead_gen", "ecommerce"]).default("lead_gen"),
});

/**
 * Verify the submitted headlineId belongs to a Node 6 headline for this
 * campaign's service, and return the authoritative text from the DB so the
 * caller composites with server-trusted bytes — never the client's string.
 *
 * Contract: id match, not text match. Eliminates a class of bugs tied to the
 * headlines column's collation (utf8mb4_unicode_ci is case-insensitive, so a
 * text-based `eq(headlines.headline, x)` would false-match "hello" against
 * "Hello"), trailing-whitespace stripping, and Unicode normalization drift
 * through tRPC serialization. Also makes a future "edit headline" feature on
 * Node 6 safe — the id is stable across edits.
 *
 * Ownership: filters on userId AND serviceId so another user's or another
 * campaign's headline can't be passed off as this campaign's.
 */
async function assertHeadlineIsApproved(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  serviceId: number | null,
  headlineId: number,
): Promise<{ headline: string }> {
  if (serviceId == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Headline must be selected from your campaign's approved headlines.",
    });
  }
  const [match] = await db
    .select({ headline: headlines.headline })
    .from(headlines)
    .where(and(
      eq(headlines.id, headlineId),
      eq(headlines.userId, userId),
      eq(headlines.serviceId, serviceId),
    ))
    .limit(1);
  if (!match) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Headline must be selected from your campaign's approved headlines.",
    });
  }
  return { headline: match.headline };
}

export const adCreativesRouter = router({
  // List all ad creative batches for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const creatives = await db
      .select()
      .from(adCreatives)
      .where(eq(adCreatives.userId, ctx.user.id))
      .orderBy(desc(adCreatives.createdAt));
    
    // Group by batchId
    const batches = new Map<string, typeof creatives>();
    for (const creative of creatives) {
      const batchId = creative.batchId || `single-${creative.id}`;
      if (!batches.has(batchId)) {
        batches.set(batchId, []);
      }
      batches.get(batchId)!.push(creative);
    }
    
    return Array.from(batches.values()).map(batch => ({
      batchId: batch[0].batchId || `single-${batch[0].id}`,
      creatives: batch,
      createdAt: batch[0].createdAt,
      niche: batch[0].niche,
      productName: batch[0].productName,
    }));
  }),

  // Get single batch by batchId
  getBatch: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      
      const creatives = await db
        .select()
        .from(adCreatives)
        .where(
          and(
            eq(adCreatives.userId, ctx.user.id),
            eq(adCreatives.batchId, input.batchId)
          )
        )
        .orderBy(adCreatives.variationNumber);
      
      if (creatives.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Batch not found",
        });
      }
      
      return creatives;
    }),

  // Generate 5 ad creative variations
  generate: protectedProcedure
    .input(generateAdCreativesSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      
      // Check quota (if needed - add to users table)
      // const user = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      
      // Get service details with social proof
      const service = await db
        .select()
        .from(services)
        .where(eq(services.id, input.serviceId))
        .limit(1);
      
      if (service.length === 0) {
        throw new Error("Service not found");
      }
      
      // Extract social proof data (Issue 2 fix)
      const serviceData = service[0];
      const customerCount = serviceData.totalCustomers || 0;
      const hasSocialProof = {
        customers: customerCount > 0,
        rating: !!serviceData.averageRating && parseFloat(serviceData.averageRating) > 0,
        reviews: !!serviceData.totalReviews && serviceData.totalReviews > 0,
        testimonials: !!serviceData.testimonial1Name || !!serviceData.testimonial2Name || !!serviceData.testimonial3Name,
        press: !!serviceData.pressFeatures && serviceData.pressFeatures.trim().length > 0,
      };
      
      const batchId = `batch-${Date.now()}-${randomBytes(4).toString("hex")}`;
      const mechanism = input.uniqueMechanism || "System";
      
      // Define 5 variations with different styles and headlines
      const variations = [
        { style: "person_shocked", formula: "benefit" as const },
        { style: "screenshot", formula: "social_proof" as const },
        { style: "person_intense", formula: "curiosity" as const },
        { style: "object", formula: "contrast" as const },
        { style: "person_curious", formula: "challenge" as const },
      ];
      
      const generatedCreatives = [];
      
      for (let i = 0; i < 5; i++) {
        const variation = variations[i];
        const headline = HEADLINE_FORMULAS[variation.formula](mechanism, input.niche, customerCount);
        
        // Check Meta compliance
        const complianceIssues = checkCompliance(headline, input.mainBenefit, input.pressingProblem);
        
        // Generate image prompt — no headline in prompt; composited after generation
        const imagePrompt = generateAdImagePrompt(
          variation.style,
          input.niche,
          input.pressingProblem
        );
        
        console.log(`[Ad Creatives] Generating variation ${i + 1}/5 - Style: ${variation.style}, Formula: ${variation.formula}`);
        
        // Generate image using AI
        const imageResult = await generateImage({
          prompt: imagePrompt,
        });
        
        if (!imageResult.url) {
          throw new Error(`Failed to generate image for variation ${i + 1}`);
        }
        
        const imageUrl = imageResult.url;
        console.log(`[Ad Creatives] Image generated: ${imageUrl}`);
        
        // Download raw image from Replicate/S3
        const imageResponse = await fetch(imageUrl);
        const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());

        // Dual upload: raw Flux output → rawImageUrl (for future recomposites),
        // composited headline PNG → imageUrl (what users see).
        const rawKey = `ad-creatives/${ctx.user.id}/${batchId}/raw-variation-${i + 1}.png`;
        const { url: rawImageUrl } = await storagePut(rawKey, rawBuffer, "image/png");
        const compositedBuffer = await compositeHeadline(rawBuffer, headline, variation.style);
        const fileKey = `ad-creatives/${ctx.user.id}/${batchId}/variation-${i + 1}.png`;
        const { url: s3Url } = await storagePut(fileKey, compositedBuffer, "image/png");

        console.log(`[Ad Creatives] Uploaded raw=${rawImageUrl} composited=${s3Url}`);

        // Save to database
        const result = await db.insert(adCreatives).values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          niche: input.niche,
          productName: input.productName,
          uniqueMechanism: mechanism,
          targetAudience: input.targetAudience,
          mainBenefit: input.mainBenefit,
          pressingProblem: input.pressingProblem,
          adType: input.adType,
          designStyle: variation.style as any,
          headlineFormula: variation.formula,
          headline,
          imageUrl: s3Url,
          rawImageUrl,
          imageFormat: "1080x1080",
          complianceChecked: true,
          complianceIssues: complianceIssues.length > 0 ? JSON.stringify(complianceIssues) : null,
      batchId,
      variationNumber: i + 1,
    } as any);
        
      const creativeId = Number((result as any).insertId ?? (result as any)[0]?.insertId ?? 0);
      generatedCreatives.push({
          id: creativeId,
          headline,
          imageUrl: s3Url,
          style: variation.style,
          formula: variation.formula,
          complianceIssues,
        });
      }
      
      console.log(`[Ad Creatives] Batch generation complete: ${batchId}`);
      
      return {
        batchId,
        creatives: generatedCreatives,
        message: "5 ad creatives generated successfully",
      };
    }),

  // Delete batch
  deleteBatch: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      
      await db
        .delete(adCreatives)
        .where(
          and(
            eq(adCreatives.userId, ctx.user.id),
            eq(adCreatives.batchId, input.batchId)
          )
        );
      
      return { success: true };
    }),

  // Regenerate a single ad creative by ID — async job pattern to avoid
  // Cloudflare's 100s read timeout killing the connection during Flux generation.
  // Returns { jobId } immediately; client polls /api/jobs/:jobId for completion.
  regenerateSingle: protectedProcedure
    .input(z.object({
      id: z.number(),
      // Optional: override the stored headline with a new one, identified by
      // its Node 6 headlines.id. When provided, the server resolves the id to
      // the authoritative headline text and composites with that; the row's
      // headline column is updated so subsequent regenerates reuse it.
      headlineOverrideId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Free-tier gate — block regenerate once the user has ≥ 2 ad creatives
      await enforceFreeTierAdImageGate(ctx.user.id, ctx.user.subscriptionTier, ctx.user.role);

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validate the creative exists before firing the job
      const [existing] = await db
        .select()
        .from(adCreatives)
        .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Creative not found" });
      }

      // Compliance gate: if caller supplied a new headlineId, resolve it
      // through the approved-Node-6 helper and use the DB's text downstream.
      // Skip entirely when no override — existing.headline was already
      // compliance-checked when the row was generated.
      let overrideHeadline: string | null = null;
      if (input.headlineOverrideId != null) {
        const { headline: approved } =
          await assertHeadlineIsApproved(db, ctx.user.id, existing.serviceId, input.headlineOverrideId);
        if (approved !== existing.headline) overrideHeadline = approved;
      }

      // Persist the new headline now so it survives even if the background
      // job fails — user's edit is preserved and visible on retry.
      const nextHeadline = overrideHeadline ?? existing.headline ?? "";
      if (overrideHeadline) {
        await db
          .update(adCreatives)
          .set({ headline: nextHeadline })
          .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)));
      }

      // Create job record and return immediately — pipeline runs in background
      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(ctx.user.id), status: "pending" });

      const capturedUserId  = ctx.user.id;
      const capturedId      = input.id;
      const capturedStyle   = existing.designStyle || "person_shocked";
      const capturedNiche   = existing.niche;
      const capturedProblem = existing.pressingProblem;
      const capturedHeadline = nextHeadline;

      setImmediate(async () => {
        try {
          const { getDb: getDbBg }                    = await import("../db");
          const { eq: eqBg, and: andBg }              = await import("drizzle-orm");
          const { adCreatives: adCreativesTable, jobs: jobsTable } = await import("../../drizzle/schema");
          const { generateImage: genImg }             = await import("../_core/imageGeneration");
          const { storagePut: s3Put }                 = await import("../storage");
          const { compositeHeadline: doComposite }    = await import("../_core/compositeHeadline");
          const bgDb = await getDbBg();
          if (!bgDb) throw new Error("Database not available in background job");

          console.log(`[adCreatives.regenerateSingle] Job ${jobId} — regenerating creative ${capturedId}`);

          const imagePrompt = generateAdImagePrompt(capturedStyle, capturedNiche, capturedProblem);
          const imageResult = await genImg({ prompt: imagePrompt });
          if (!imageResult.url) throw new Error("Failed to generate replacement image");

          const imageResponse = await fetch(imageResult.url);
          const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());

          // Dual upload — raw Flux stays around so future recompositeText
          // calls start from a clean background.
          const rawKey = `ad-creatives/${capturedUserId}/raw-regen-${capturedId}-${Date.now()}.png`;
          const { url: rawImageUrl } = await s3Put(rawKey, rawBuffer, "image/png");
          const compositedBuffer = await doComposite(rawBuffer, capturedHeadline, capturedStyle);
          const fileKey = `ad-creatives/${capturedUserId}/regen-${capturedId}-${Date.now()}.png`;
          const { url: s3Url } = await s3Put(fileKey, compositedBuffer, "image/png");

          await bgDb
            .update(adCreativesTable)
            .set({ imageUrl: s3Url, rawImageUrl })
            .where(andBg(eqBg(adCreativesTable.id, capturedId), eqBg(adCreativesTable.userId, capturedUserId)));

          await bgDb
            .update(jobsTable)
            .set({ status: "complete", result: JSON.stringify({ id: capturedId, imageUrl: s3Url }) })
            .where(eqBg(jobsTable.id, jobId));

          console.log(`[adCreatives.regenerateSingle] Job ${jobId} complete — new URL: ${s3Url}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[adCreatives.regenerateSingle] Job ${jobId} failed:`, errorMessage);
          try {
            const { getDb: getDbBg2 } = await import("../db");
            const { eq: eqBg2 }       = await import("drizzle-orm");
            const { jobs: jobsTable2 } = await import("../../drizzle/schema");
            const bgDb2 = await getDbBg2();
            if (bgDb2) {
              await bgDb2
                .update(jobsTable2)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eqBg2(jobsTable2.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  /**
   * recompositeText — cheap text-only refresh on an existing ad creative.
   *
   * Fetches the current Cloudinary image, composites the new headline onto it,
   * uploads the result as a new image, and updates the row. Does NOT call Flux,
   * does NOT create a background job, does NOT count toward the free-tier gate.
   *
   * Returns the new imageUrl synchronously — the operation is typically < 3 s
   * (fetch + opentype.js path emit + resvg raster + Cloudinary upload).
   */
  recompositeText: protectedProcedure
    .input(z.object({
      id: z.number(),
      headlineId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Ownership check — same pattern as regenerateSingle
      const [existing] = await db
        .select()
        .from(adCreatives)
        .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Creative not found" });
      }

      // Compliance gate: headlineId must resolve to a Node 6 headline for this
      // campaign's service. We composite with the DB's text, not any
      // client-supplied string — eliminates whole classes of collation /
      // whitespace / normalization bugs.
      const { headline: newHeadline } =
        await assertHeadlineIsApproved(db, ctx.user.id, existing.serviceId, input.headlineId);

      console.log(`[adCreatives.recompositeText] Creative ${input.id} — new headline="${newHeadline.slice(0, 60)}"`);

      // Prefer the raw Flux output as the background so the new headline sits
      // on a clean image (no ghost pixels from the previous headline).
      // Legacy rows predating the rawImageUrl column fall back to the composited
      // imageUrl with a warning — still works, just with the ghost-pixel caveat
      // until the row is fully regenerated.
      let bgSource: string;
      if (existing.rawImageUrl) {
        bgSource = existing.rawImageUrl;
      } else {
        console.error(`[adCreatives.recompositeText][LEGACY] Creative ${input.id} has no rawImageUrl — falling back to composited imageUrl. Old headline pixels may bleed through.`);
        bgSource = existing.imageUrl;
      }

      const bgResponse = await fetch(bgSource);
      if (!bgResponse.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch existing image (${bgResponse.status})`,
        });
      }
      const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());

      const compositedBuffer = await compositeHeadline(bgBuffer, newHeadline, existing.designStyle || "person_shocked");

      const fileKey = `ad-creatives/${ctx.user.id}/recomp-${input.id}-${Date.now()}.png`;
      const { url: newImageUrl } = await storagePut(fileKey, compositedBuffer, "image/png");

      // Persist the new headline and composited URL only. rawImageUrl is
      // immutable per row — it's the original Flux background and should
      // never change unless the full image is regenerated.
      await db
        .update(adCreatives)
        .set({ headline: newHeadline, imageUrl: newImageUrl })
        .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)));

      console.log(`[adCreatives.recompositeText] Creative ${input.id} — new URL: ${newImageUrl}`);

      return { id: input.id, imageUrl: newImageUrl, headline: newHeadline };
    }),

  // Rate creative
  rate: protectedProcedure
    .input(z.object({
      id: z.number(),
      rating: z.number().min(0).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
    if (!db) throw new Error("Database not available");
      
      await db
        .update(adCreatives)
        .set({ rating: input.rating })
        .where(
          and(
            eq(adCreatives.id, input.id),
            eq(adCreatives.userId, ctx.user.id)
          )
        );
      
      return { success: true };
    }),

  /**
   * getLatestByServiceId — returns the most recent batch for a given serviceId.
   * Used by V2AdImageCreator to reload the last result on page revisit.
   */
  getLatestByServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [latest] = await db
        .select()
        .from(adCreatives)
        .where(
          and(
            eq(adCreatives.userId, ctx.user.id),
            eq(adCreatives.serviceId, input.serviceId)
          )
        )
        .orderBy(desc(adCreatives.createdAt))
        .limit(1);
      if (!latest || !latest.batchId) return null;
      const batch = await db
        .select()
        .from(adCreatives)
        .where(
          and(
            eq(adCreatives.userId, ctx.user.id),
            eq(adCreatives.batchId, latest.batchId)
          )
        )
        .orderBy(adCreatives.variationNumber);
      return { batchId: latest.batchId, creatives: batch };
    }),

  /**
   * generateAsync — wraps the synchronous generate in the standard V2 background
   * job pattern. Returns jobId immediately; image generation runs via setImmediate.
   * On completion stores { batchId } in jobs.result.
   */
  generateAsync: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      icpId: z.number().optional(),
      visualStyle: z.string().optional(),
      imageFormat: z.string().optional(),
      uglyMode: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Free-tier gate — block generate once the user has ≥ 2 ad creatives
      await enforceFreeTierAdImageGate(ctx.user.id, ctx.user.subscriptionTier, ctx.user.role);

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Pre-fetch service data synchronously before setImmediate
      const serviceRows = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);
      if (serviceRows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
      }
      const svc = serviceRows[0];
      const capturedUserId = ctx.user.id;
      const capturedInput = { ...input };
      const capturedSvc = { ...svc };
      // Create job record
      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });
      // Fire background generation
      setImmediate(async () => {
        try {
          const { getDb: getDbBg } = await import("../db");
          const { eq: eqBg, and: andBg } = await import("drizzle-orm");
          const bgDb = await getDbBg();
          if (!bgDb) throw new Error("Database not available in background job");
          const { adCreatives: adCreativesTable, jobs: jobsTable } = await import("../../drizzle/schema");
          const { generateImage: genImg } = await import("../_core/imageGeneration");
          const { storagePut: s3Put } = await import("../storage");
          const { randomBytes: rb } = await import("crypto");
          const mechanism = capturedSvc.uniqueMechanismSuggestion || capturedSvc.name || "System";
          const niche = capturedSvc.category || "coaching";
          const batchId = `batch-${Date.now()}-${rb(4).toString("hex")}`;
          const customerCount = capturedSvc.totalCustomers || 0;
          const variations = [
            { style: "person_shocked", formula: "benefit" as const },
            { style: "screenshot", formula: "social_proof" as const },
            { style: "person_intense", formula: "curiosity" as const },
            { style: "object", formula: "contrast" as const },
            { style: "person_curious", formula: "challenge" as const },
          ];
          for (let i = 0; i < 5; i++) {
            const variation = variations[i];
            const headline = HEADLINE_FORMULAS[variation.formula](mechanism, niche, customerCount);
            const complianceIssues = checkCompliance(
              headline,
              capturedSvc.mainBenefit || "",
              capturedSvc.painPoints || ""
            );
            const uglyMode = capturedInput.uglyMode ?? false;
            const imagePrompt = generateAdImagePrompt(
              variation.style,
              niche,
              capturedSvc.painPoints || "",
              uglyMode
            );
            console.log(`[adCreatives.generateAsync] Job ${jobId} — variation ${i+1}/5 uglyMode=${uglyMode}`);
            const imageResult = await genImg({ prompt: imagePrompt });
            if (!imageResult.url) throw new Error(`Failed to generate image for variation ${i + 1}`);
            const imageResponse = await fetch(imageResult.url);
            const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());

            // Dual upload: keep the raw Flux output so recompositeText can
            // rebuild cleanly later; also upload the composited headline PNG.
            const rawKey = `ad-creatives/${capturedUserId}/${batchId}/raw-variation-${i + 1}.png`;
            const { url: rawImageUrl } = await s3Put(rawKey, rawBuffer, "image/png");
            const { compositeHeadline: doComposite } = await import("../_core/compositeHeadline");
            const compositedBuffer = await doComposite(rawBuffer, headline, variation.style);
            const fileKey = `ad-creatives/${capturedUserId}/${batchId}/variation-${i + 1}.png`;
            const { url: s3Url } = await s3Put(fileKey, compositedBuffer, "image/png");

            await bgDb.insert(adCreativesTable).values({
              userId: capturedUserId,
              serviceId: capturedInput.serviceId,
              niche,
              productName: capturedSvc.name,
              uniqueMechanism: mechanism,
              targetAudience: capturedSvc.targetCustomer || "",
              mainBenefit: capturedSvc.mainBenefit || "",
              pressingProblem: capturedSvc.painPoints || "",
              adType: "lead_gen",
              styleType: uglyMode ? "lad_bible" : "tabloid",
              designStyle: variation.style as any,
              headlineFormula: variation.formula,
              headline,
              imageUrl: s3Url,
              rawImageUrl,
              imageFormat: capturedInput.imageFormat || "1080x1080",
              complianceChecked: true,
              complianceIssues: complianceIssues.length > 0 ? JSON.stringify(complianceIssues) : null,
              batchId,
              variationNumber: i + 1,
            } as any);
          }
          await bgDb
            .update(jobsTable)
            .set({ status: "complete", result: JSON.stringify({ batchId }) })
            .where(eqBg(jobsTable.id, jobId));
          console.log(`[adCreatives.generateAsync] Job ${jobId} complete — batchId: ${batchId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[adCreatives.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const { getDb: getDbBg2 } = await import("../db");
            const { eq: eqBg2 } = await import("drizzle-orm");
            const { jobs: jobsTable2 } = await import("../../drizzle/schema");
            const bgDb2 = await getDbBg2();
            if (bgDb2) {
              await bgDb2
                .update(jobsTable2)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eqBg2(jobsTable2.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });
      return { jobId };
    }),
});

// Export helper function for batch generation from campaigns
export async function generateAdCreativesBatch(params: {
  userId: number;
  serviceId: number;
  campaignId?: number;
  niche: string;
  productName: string;
  targetAudience: string;
  mainBenefit: string;
  pressingProblem: string;
  uniqueMechanism: string;
  adType: "lead_gen" | "ecommerce";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check rate limiting for images (FREE but limited)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyImageCount = await db
    .select()
    .from(adCreatives)
    .where(
      and(
        eq(adCreatives.userId, params.userId),
        // @ts-ignore - createdAt comparison
        gte(adCreatives.createdAt, startOfMonth)
      )
    );

  const currentCount = monthlyImageCount.length;

  // Hard cap: 500 images/month
  if (currentCount >= 500) {
    throw new Error(
      "Monthly image limit reached (500 images). Contact support for enterprise pricing."
    );
  }

  // Soft warning: 100 images/month
  if (currentCount >= 100 && currentCount < 500) {
    console.warn(
      `[generateAdCreativesBatch] User ${params.userId} has generated ${currentCount} images this month (soft limit warning)`
    );
  }

  const batchId = `batch-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const mechanism = params.uniqueMechanism || "System";

  // Get service details
  const service = await db
    .select()
    .from(services)
    .where(eq(services.id, params.serviceId))
    .limit(1);

  const customerCount = service[0]?.totalCustomers || 0;

  // Define 5 variations
  const variations = [
    { style: "person_shocked", formula: "benefit" as const },
    { style: "screenshot", formula: "social_proof" as const },
    { style: "person_intense", formula: "curiosity" as const },
    { style: "object", formula: "contrast" as const },
    { style: "person_curious", formula: "challenge" as const },
  ];

  const generatedCreatives = [];

  for (let i = 0; i < 5; i++) {
    const variation = variations[i];
    const headline = HEADLINE_FORMULAS[variation.formula](mechanism, params.niche, customerCount);
    const complianceIssues = checkCompliance(headline, params.mainBenefit, params.pressingProblem);
    const imagePrompt = generateAdImagePrompt(variation.style, params.niche, params.pressingProblem);

    console.log(`[generateAdCreativesBatch] Generating variation ${i + 1}/5`);

    // Generate image
    const imageResult = await generateImage({ prompt: imagePrompt });
    if (!imageResult.url) throw new Error(`Failed to generate image ${i + 1}`);

    // Dual upload: raw Flux output + composited PNG.
    const imageResponse = await fetch(imageResult.url);
    const rawBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const rawKey = `ad-creatives/${params.userId}/${batchId}/raw-variation-${i + 1}.png`;
    const { url: rawImageUrl } = await storagePut(rawKey, rawBuffer, "image/png");
    const compositedBuffer = await compositeHeadline(rawBuffer, headline, variation.style);
    const fileKey = `ad-creatives/${params.userId}/${batchId}/variation-${i + 1}.png`;
    const { url: s3Url } = await storagePut(fileKey, compositedBuffer, "image/png");

    // Save to database with campaignId
    console.log("[generateAdCreativesBatch] About to insert creative", { variation: i + 1 });
    const result = await db.insert(adCreatives).values({
      userId: params.userId,
      serviceId: params.serviceId,
      campaignId: params.campaignId || null,
      niche: params.niche,
      productName: params.productName,
      uniqueMechanism: mechanism,
      targetAudience: params.targetAudience,
      mainBenefit: params.mainBenefit,
      pressingProblem: params.pressingProblem,
      adType: params.adType,
      designStyle: variation.style as any,
      headlineFormula: variation.formula,
      headline,
      imageUrl: s3Url,
      rawImageUrl,
      imageFormat: "1080x1080",
      complianceChecked: true,
      complianceIssues: complianceIssues.length > 0 ? JSON.stringify(complianceIssues) : null,
      batchId,
    } as any);

    const creativeId = Number(result[0].insertId);
    console.log("[generateAdCreativesBatch] Converted creativeId:", creativeId);
    const [creative] = await db.select().from(adCreatives).where(eq(adCreatives.id, creativeId)).limit(1);
    generatedCreatives.push(creative);
  }

  return { batchId, creatives: generatedCreatives };
}
