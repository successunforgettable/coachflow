import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { adCreatives, services, users } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateImage } from "../_core/imageGeneration";
import { storagePut } from "../storage";
import { randomBytes } from "crypto";

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

// Tabloid headline formulas
const HEADLINE_FORMULAS = {
  banned: (mechanism: string, niche: string) => 
    `THIS ${mechanism.toUpperCase()} IS BANNED IN 3 COUNTRIES`,
  secret: (mechanism: string, niche: string) => 
    `THE ${niche.toUpperCase()} SECRET THEY DON'T WANT YOU TO KNOW`,
  leaked: (mechanism: string, niche: string) => 
    `'${mechanism.toUpperCase()}' LEAKED - EXPERTS FURIOUS`,
  glitch: (mechanism: string, niche: string) => 
    `THIS ${niche.toUpperCase()} GLITCH IS MAKING PEOPLE RICH`,
  forbidden: (mechanism: string, niche: string) => 
    `FORBIDDEN ${mechanism.toUpperCase()} FINALLY EXPOSED`,
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
  
  const stylePrompts = {
    person_shocked: `${baseStyle}. Person (30-45 years old) with SHOCKED expression, wide eyes, mouth open, pointing at viewer. Dark grey/black background. Red circle annotation around head. Red "BANNED" stamp in corner. Headline text overlay: "${headline}" in bold white text with yellow highlights on key words. Hand-drawn red arrow pointing from circle to viewer.`,
    
    screenshot: `${baseStyle}. Laptop screen photographed at angle showing dashboard with dramatic results/numbers. Dark desk surface, coffee cup visible. Multiple red circles around key numbers. Red arrows pointing UP at gains. Handwritten text "WTF?! NO WAY" near circles. "LEAKED" stamp in corner. Headline: "${headline}" in bold white text at top.`,
    
    person_intense: `${baseStyle}. Person (30-45 years old) with INTENSE expression, serious face, leaning forward, direct eye contact. Dark background with spotlight on face. Red circle around object in background. Red arrow pointing TO circled object. "EXPOSED" stamp. Headline: "${headline}" in bold white text with yellow highlights.`,
    
    object: `${baseStyle}. Relevant object (document, product, device) for ${niche} niche. Dramatic lighting, dark background. Red circles around key elements. Red arrows pointing to circled areas. Handwritten text "BANNED" or "LOOPHOLE". "CLASSIFIED" stamp. Headline: "${headline}" in bold white text.`,
    
    person_curious: `${baseStyle}. Person (30-45 years old) with CURIOUS expression, raised eyebrow, slight smile, head tilted. Dark grey background. Large red circle with handwritten text inside. Red arrow pointing from circle. Headline: "${headline}" in bold white text with yellow highlights on key words.`,
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
      
      // Get service details
      const service = await db
        .select()
        .from(services)
        .where(eq(services.id, input.serviceId))
        .limit(1);
      
      if (service.length === 0) {
        throw new Error("Service not found");
      }
      
      const batchId = `batch-${Date.now()}-${randomBytes(4).toString("hex")}`;
      const mechanism = input.uniqueMechanism || "System";
      
      // Define 5 variations with different styles and headlines
      const variations = [
        { style: "person_shocked", formula: "banned" as const },
        { style: "screenshot", formula: "secret" as const },
        { style: "person_intense", formula: "leaked" as const },
        { style: "object", formula: "glitch" as const },
        { style: "person_curious", formula: "forbidden" as const },
      ];
      
      const generatedCreatives = [];
      
      for (let i = 0; i < 5; i++) {
        const variation = variations[i];
        const headline = HEADLINE_FORMULAS[variation.formula](mechanism, input.niche);
        
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
        const [creative] = await db.insert(adCreatives).values({
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
        });
        
        generatedCreatives.push({
          id: creative.insertId,
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
});
