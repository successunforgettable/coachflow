import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { adCreatives, services, users, jobs } from "../../drizzle/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";
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

// Generate tabloid-style ad image prompt
function generateAdImagePrompt(
  style: string,
  headline: string,
  niche: string,
  problem: string
): string {
  const baseStyle = "Gossip magazine style, tabloid aesthetic, phone-quality photo (NOT polished studio shot), dramatic lighting, high contrast";

  // Niche context and compliance — applied to every style
  const nicheContext = `The person and setting must visually match the ${niche} niche — their clothing, environment, and expression must be recognisable to someone in that world. A fitness coach's client looks different from a crypto trader's client looks different from a corporate executive's client.`;
  const complianceNote = `Do not generate images that imply medical treatment, guaranteed financial results, or dramatic physical before/after transformation. Images must show aspiration and possibility, not guaranteed outcomes.`;

  const stylePrompts = {
    person_shocked: `${baseStyle}. Person (30-45 years old) dressed and styled for the ${niche} world, with EXCITED expression, wide eyes, enthusiastic smile, pointing at viewer. Dark grey/black background. Green circle annotation around head with checkmark. Headline text overlay: "${headline}" in bold white text with yellow highlights on key words. Hand-drawn green arrow pointing from circle to viewer. ${nicheContext} ${complianceNote}`,

    screenshot: `${baseStyle}. Laptop screen photographed at angle showing a ${niche}-relevant dashboard or workspace with results/numbers. Dark desk surface, coffee cup visible. Multiple green circles around key metrics. Green arrows pointing UP at gains. Handwritten text "RESULTS" near circles. Headline: "${headline}" in bold white text at top. ${nicheContext} ${complianceNote}`,

    person_intense: `${baseStyle}. Person (30-45 years old) dressed and styled for the ${niche} world, with CONFIDENT expression, serious face, leaning forward, direct eye contact. Dark background with spotlight on face. Green circle around key element in background. Green arrow pointing TO circled element. Headline: "${headline}" in bold white text with yellow highlights. ${nicheContext} ${complianceNote}`,

    object: `${baseStyle}. Relevant object (document, product, device, or tool) specifically associated with the ${niche} niche. Dramatic lighting, dark background. Green circles around key features. Green arrows pointing to circled areas. Handwritten text "RESULTS" nearby. Headline: "${headline}" in bold white text. ${nicheContext} ${complianceNote}`,

    person_curious: `${baseStyle}. Person (30-45 years old) dressed and styled for the ${niche} world, with INTRIGUED expression, raised eyebrow, interested smile, head tilted. Dark grey background. Large green circle with handwritten benefit text inside. Green arrow pointing from circle. Headline: "${headline}" in bold white text with yellow highlights on key words. ${nicheContext} ${complianceNote}`,
  };

  return stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.person_shocked;
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
        
        // Generate image prompt
        const imagePrompt = generateAdImagePrompt(
          variation.style,
          headline,
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
        
        // Upload to S3 for permanent storage
        // Download image first
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        
        // Upload to S3
        const fileKey = `ad-creatives/${ctx.user.id}/${batchId}/variation-${i + 1}.png`;
        const { url: s3Url } = await storagePut(fileKey, imageBuffer, "image/png");
        
        console.log(`[Ad Creatives] Uploaded to S3: ${s3Url}`);
        
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

  // Regenerate a single ad creative by ID
  regenerateSingle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the existing creative
      const [existing] = await db
        .select()
        .from(adCreatives)
        .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Creative not found" });
      }

      const headline = existing.headline || "";
      const imagePrompt = generateAdImagePrompt(
        existing.designStyle || "person_shocked",
        headline,
        existing.niche,
        existing.pressingProblem
      );

      console.log(`[adCreatives.regenerateSingle] Regenerating creative ${input.id}`);

      // Generate new image
      const imageResult = await generateImage({ prompt: imagePrompt });
      if (!imageResult.url) throw new Error("Failed to generate replacement image");

      // Download and upload to S3
      const imageResponse = await fetch(imageResult.url);
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const fileKey = `ad-creatives/${ctx.user.id}/regen-${input.id}-${Date.now()}.png`;
      const { url: s3Url } = await storagePut(fileKey, imageBuffer, "image/png");

      // Update the existing record in-place
      await db
        .update(adCreatives)
        .set({ imageUrl: s3Url })
        .where(and(eq(adCreatives.id, input.id), eq(adCreatives.userId, ctx.user.id)));

      console.log(`[adCreatives.regenerateSingle] Done. New URL: ${s3Url}`);
      return { id: input.id, imageUrl: s3Url };
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
    }))
    .mutation(async ({ ctx, input }) => {
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
            const imagePrompt = generateAdImagePrompt(
              variation.style,
              headline,
              niche,
              capturedSvc.painPoints || ""
            );
            console.log(`[adCreatives.generateAsync] Job ${jobId} — variation ${i + 1}/5`);
            const imageResult = await genImg({ prompt: imagePrompt });
            if (!imageResult.url) throw new Error(`Failed to generate image for variation ${i + 1}`);
            const imageResponse = await fetch(imageResult.url);
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const fileKey = `ad-creatives/${capturedUserId}/${batchId}/variation-${i + 1}.png`;
            const { url: s3Url } = await s3Put(fileKey, imageBuffer, "image/png");
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
              designStyle: variation.style as any,
              headlineFormula: variation.formula,
              headline,
              imageUrl: s3Url,
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
    const imagePrompt = generateAdImagePrompt(variation.style, headline, params.niche, params.pressingProblem);

    console.log(`[generateAdCreativesBatch] Generating variation ${i + 1}/5`);

    // Generate image
    const imageResult = await generateImage({ prompt: imagePrompt });
    if (!imageResult.url) throw new Error(`Failed to generate image ${i + 1}`);

    // Download and upload to S3
    const imageResponse = await fetch(imageResult.url);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const fileKey = `ad-creatives/${params.userId}/${batchId}/variation-${i + 1}.png`;
    const { url: s3Url } = await storagePut(fileKey, imageBuffer, "image/png");

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
