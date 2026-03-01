import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const createServiceSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: z.enum(["coaching", "speaking", "consulting"]),
  description: z.string().min(1, "Description is required"),
  targetCustomer: z.string().min(1, "Target customer is required").max(500),
  mainBenefit: z.string().min(1, "Main benefit is required").max(500),
  price: z.number().optional(),
});

const updateServiceSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  category: z.enum(["coaching", "speaking", "consulting"]).optional(),
  description: z.string().min(1).optional(),
  targetCustomer: z.string().min(1).max(500).optional(),
  mainBenefit: z.string().min(1).max(500).optional(),
  price: z.number().optional(),
  // Social proof fields (Issue 2 fix)
  totalCustomers: z.number().optional(),
  averageRating: z.number().optional(),
  totalReviews: z.number().optional(),
  testimonial1Name: z.string().max(255).optional(),
  testimonial1Title: z.string().max(255).optional(),
  testimonial1Quote: z.string().max(1000).optional(),
  testimonial2Name: z.string().max(255).optional(),
  testimonial2Title: z.string().max(255).optional(),
  testimonial2Quote: z.string().max(1000).optional(),
  testimonial3Name: z.string().max(255).optional(),
  testimonial3Title: z.string().max(255).optional(),
  testimonial3Quote: z.string().max(1000).optional(),
  pressFeatures: z.string().max(1000).optional(),
  // Video authority badge stat
  socialProofStat: z.string().max(255).optional(),
  // AutoPop fields (Phase 39 FIX 2)
  whyProblemExists: z.string().optional(),
  hvcoTopic: z.string().max(300).optional(),
  mechanismDescriptor: z.enum(["AI", "System", "Framework", "Method", "Blueprint", "Process"]).optional(),
  applicationMethod: z.string().max(150).optional(),
  avatarName: z.string().max(100).optional(),
  avatarTitle: z.string().max(100).optional(),
  // AI-expanded onboarding fields (Item 1.1 — Build Plan March 1 2026)
  falseBeliefsVsRealReasons: z.string().optional(),
  failedSolutions: z.string().optional(),
  hiddenReasons: z.string().optional(),
  riskReversal: z.string().optional(),
  uniqueMechanismSuggestion: z.string().optional(),
  painPoints: z.string().optional(),
});

export const servicesRouter = router({
  // List all services for current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    return await db
      .select()
      .from(services)
      .where(eq(services.userId, ctx.user.id))
      .orderBy(desc(services.createdAt));
  }),

  // Get single service by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.id), eq(services.userId, ctx.user.id)))
        .limit(1);
      
      if (!service) {
        throw new Error("Service not found");
      }
      
      return service;
    }),

  // Create new service
  create: protectedProcedure
    .input(createServiceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Convert price to string for decimal field
      const insertData: any = {
        userId: ctx.user.id,
        ...input,
      };
      if (insertData.price !== undefined) {
        insertData.price = insertData.price.toString();
      }
      
      const result: any = await db.insert(services).values(insertData);
      
      // MySQL doesn't support RETURNING, fetch the inserted record
      const [newService] = await db
        .select()
        .from(services)
        .where(eq(services.id, result[0].insertId))
        .limit(1);
      
      return newService;
    }),

  /**
   * AI Profile Expansion — Item 1.1 (Build Plan March 1 2026)
   *
   * Called immediately after services.create during onboarding.
   * Uses the exact LLM prompt specified in the build plan.
   * Saves all 10 expanded fields to the service record BEFORE returning,
   * so values are persisted even if the user skips the review screen.
   */
  expandProfile: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership and get the service record
      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);

      if (!service) throw new Error("Service not found");

      // --- EXACT PROMPT FROM BUILD PLAN (verbatim, variable names adapted) ---
      const prompt = `You are a world-class direct response copywriter and market researcher.

A coach/consultant has described their service:
- Name: ${service.name}
- Target Customer: ${service.targetCustomer}
- Main Benefit: ${service.mainBenefit}
- Description: ${service.description}

Based on this, generate a complete marketing intelligence profile.
Be specific to their niche — not generic. Use language their customer would actually use.

Return JSON with these exact fields:
{
  "painPoints": "3-5 specific pain points their customer feels daily",
  "falseBeliefsVsRealReasons": "3-5 pairs in format: what customer thinks is stopping them | what is really stopping them",
  "failedSolutions": "3-5 things they have tried before and exactly why each one failed for this specific audience",
  "hiddenReasons": "3-5 less-known real reasons behind their problem they would never admit or don't know",
  "whyProblemExists": "The root cause of the problem at a deep level",
  "uniqueMechanismSuggestion": "A compelling proprietary-sounding name for how this service solves the problem",
  "hvcoTopicSuggestion": "A specific lead magnet title that would attract this exact customer",
  "riskReversalSuggestion": "A compelling guarantee that removes the risk of buying",
  "avatarName": "A realistic first name for the ideal customer",
  "avatarTitle": "Their job title or life situation in 3-5 words"
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a world-class direct response copywriter. Always return valid JSON only, no markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "service_profile_expansion",
            strict: true,
            schema: {
              type: "object",
              properties: {
                painPoints: { type: "string" },
                falseBeliefsVsRealReasons: { type: "string" },
                failedSolutions: { type: "string" },
                hiddenReasons: { type: "string" },
                whyProblemExists: { type: "string" },
                uniqueMechanismSuggestion: { type: "string" },
                hvcoTopicSuggestion: { type: "string" },
                riskReversalSuggestion: { type: "string" },
                avatarName: { type: "string" },
                avatarTitle: { type: "string" },
              },
              required: [
                "painPoints",
                "falseBeliefsVsRealReasons",
                "failedSolutions",
                "hiddenReasons",
                "whyProblemExists",
                "uniqueMechanismSuggestion",
                "hvcoTopicSuggestion",
                "riskReversalSuggestion",
                "avatarName",
                "avatarTitle",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = response.choices[0].message.content;
      let expanded: Record<string, string>;
      try {
        expanded = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        throw new Error("AI returned invalid JSON during profile expansion");
      }

      // Map LLM field names to DB column names
      const updateFields: Record<string, string> = {
        painPoints: expanded.painPoints || "",
        falseBeliefsVsRealReasons: expanded.falseBeliefsVsRealReasons || "",
        failedSolutions: expanded.failedSolutions || "",
        hiddenReasons: expanded.hiddenReasons || "",
        whyProblemExists: expanded.whyProblemExists || "",
        uniqueMechanismSuggestion: expanded.uniqueMechanismSuggestion || "",
        hvcoTopic: expanded.hvcoTopicSuggestion || "",
        riskReversal: expanded.riskReversalSuggestion || "",
        avatarName: expanded.avatarName || "",
        avatarTitle: expanded.avatarTitle || "",
      };

      // REQUIREMENT 3: Save to DB BEFORE returning — persists even if user skips review
      await db
        .update(services)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(eq(services.id, input.serviceId));

      // Return the expanded fields so the review screen can display them
      return {
        serviceId: input.serviceId,
        expanded: updateFields,
      };
    }),

  // Update existing service
  update: protectedProcedure
    .input(updateServiceSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const { id, ...updateData } = input;
      
      // Verify ownership
      const [existing] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, id), eq(services.userId, ctx.user.id)))
        .limit(1);
      
      if (!existing) {
        throw new Error("Service not found");
      }
      
      // Convert price to string for decimal field
      const setData: any = { ...updateData, updatedAt: new Date() };
      if (setData.price !== undefined) {
        setData.price = setData.price?.toString();
      }
      
      await db
        .update(services)
        .set(setData)
        .where(eq(services.id, id));
      
      // Fetch updated record
      const [updated] = await db
        .select()
        .from(services)
        .where(eq(services.id, id))
        .limit(1);
      
      return updated;
    }),

  // Delete service
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Verify ownership
      const [existing] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.id), eq(services.userId, ctx.user.id)))
        .limit(1);
      
      if (!existing) {
        throw new Error("Service not found");
      }
      
      await db.delete(services).where(eq(services.id, input.id));
      
      return { success: true };
    }),
});
