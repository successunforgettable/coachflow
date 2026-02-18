import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { idealCustomerProfiles, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

const generateICPSchema = z.object({
  serviceId: z.number(),
  name: z.string().min(1).max(255),
});

const updateICPSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  // 17 Kong tabs
  introduction: z.string().optional(),
  fears: z.string().optional(),
  hopesDreams: z.string().optional(),
  demographics: z.any().optional(),
  psychographics: z.string().optional(),
  pains: z.string().optional(),
  frustrations: z.string().optional(),
  goals: z.string().optional(),
  values: z.string().optional(),
  objections: z.string().optional(),
  buyingTriggers: z.string().optional(),
  mediaConsumption: z.string().optional(),
  influencers: z.string().optional(),
  communicationStyle: z.string().optional(),
  decisionMaking: z.string().optional(),
  successMetrics: z.string().optional(),
  implementationBarriers: z.string().optional(),
  // Legacy fields
  painPoints: z.string().optional(),
  desiredOutcomes: z.string().optional(),
  valuesMotivations: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const icpsRouter = router({
  // List all ICPs for current user
  list: protectedProcedure
    .input(z.object({ serviceId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(idealCustomerProfiles.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(idealCustomerProfiles.serviceId, input.serviceId));
      }

      return await db
        .select()
        .from(idealCustomerProfiles)
        .where(and(...conditions))
        .orderBy(desc(idealCustomerProfiles.createdAt));
    }),

  // Get single ICP by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [icp] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(
          and(
            eq(idealCustomerProfiles.id, input.id),
            eq(idealCustomerProfiles.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!icp) {
        throw new Error("ICP not found");
      }

      return icp;
    }),

  // Generate ICP using AI
  generate: protectedProcedure
    .input(generateICPSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Check quota limit
      const limit = getQuotaLimit(ctx.user.subscriptionTier, "icp");
      if (ctx.user.icpGeneratedCount >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've reached your monthly limit of ${limit} ICP generations. Upgrade to generate more.`,
        });
      }

      // Get service details
      const [service] = await db
        .select()
        .from(services)
        .where(
          and(
            eq(services.id, input.serviceId),
            eq(services.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!service) {
        throw new Error("Service not found");
      }

      // Generate ICP using AI - ALL 17 KONG TABS
      const prompt = `You are an expert marketing strategist. Create a detailed Ideal Customer Profile (ICP) for the following service:

Service Name: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

Generate a comprehensive ICP with ALL 17 sections (Kong parity):

1. INTRODUCTION: 2-3 paragraph overview of who this person is
2. FEARS: 5-7 specific fears that keep them up at night
3. HOPES & DREAMS: 5-7 aspirations and what they dream about achieving
4. DEMOGRAPHICS: JSON object with age_range, gender, income_level, education, occupation, location, family_status
5. PSYCHOGRAPHICS: Personality traits, lifestyle, attitudes, interests (3-4 paragraphs)
6. PAINS: 7-10 specific pain points they experience daily
7. FRUSTRATIONS: 5-7 daily frustrations and annoyances
8. GOALS: 6-8 specific goals they want to achieve
9. VALUES: 5-7 core values that guide their decisions
10. OBJECTIONS: 5-7 common objections to buying your service
11. BUYING TRIGGERS: 5-7 specific triggers that make them ready to buy
12. MEDIA CONSUMPTION: Where they consume content (platforms, channels, formats)
13. INFLUENCERS: Who they follow, trust, and listen to
14. COMMUNICATION STYLE: How they prefer to communicate and be communicated with
15. DECISION MAKING: How they make purchasing decisions (process, timeline, factors)
16. SUCCESS METRICS: How they measure success in their life/business
17. IMPLEMENTATION BARRIERS: What stops them from taking action after buying

Format as JSON with these exact keys (use bullet points • for lists):
{
  "introduction": "...",
  "fears": "• Fear 1\\n• Fear 2\\n...",
  "hopesDreams": "• Dream 1\\n• Dream 2\\n...",
  "demographics": { ... },
  "psychographics": "...",
  "pains": "• Pain 1\\n• Pain 2\\n...",
  "frustrations": "• Frustration 1\\n• Frustration 2\\n...",
  "goals": "• Goal 1\\n• Goal 2\\n...",
  "values": "• Value 1\\n• Value 2\\n...",
  "objections": "• Objection 1\\n• Objection 2\\n...",
  "buyingTriggers": "• Trigger 1\\n• Trigger 2\\n...",
  "mediaConsumption": "...",
  "influencers": "...",
  "communicationStyle": "...",
  "decisionMaking": "...",
  "successMetrics": "...",
  "implementationBarriers": "..."
}`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert marketing strategist specializing in creating detailed customer profiles for coaches, speakers, and consultants. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ideal_customer_profile_17_tabs",
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
                  required: [
                    "age_range",
                    "gender",
                    "income_level",
                    "education",
                    "occupation",
                    "location",
                    "family_status",
                  ],
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
                "introduction",
                "fears",
                "hopesDreams",
                "demographics",
                "psychographics",
                "pains",
                "frustrations",
                "goals",
                "values",
                "objections",
                "buyingTriggers",
                "mediaConsumption",
                "influencers",
                "communicationStyle",
                "decisionMaking",
                "successMetrics",
                "implementationBarriers",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      if (typeof content !== 'string') {
        throw new Error('Invalid response format from AI');
      }
      const icpData = JSON.parse(content);

      // Save to database - ALL 17 sections
      const insertResult: any = await db
        .insert(idealCustomerProfiles)
        .values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          name: input.name,
          // 17 Kong tabs
          introduction: icpData.introduction,
          fears: icpData.fears,
          hopesDreams: icpData.hopesDreams,
          demographics: icpData.demographics,
          psychographics: icpData.psychographics,
          pains: icpData.pains,
          frustrations: icpData.frustrations,
          goals: icpData.goals,
          values: icpData.values,
          objections: icpData.objections,
          buyingTriggers: icpData.buyingTriggers,
          mediaConsumption: icpData.mediaConsumption,
          influencers: icpData.influencers,
          communicationStyle: icpData.communicationStyle,
          decisionMaking: icpData.decisionMaking,
          successMetrics: icpData.successMetrics,
          implementationBarriers: icpData.implementationBarriers,
          // Legacy fields for backward compatibility
          painPoints: icpData.pains, // Map to old field
          desiredOutcomes: icpData.goals, // Map to old field
          valuesMotivations: icpData.values, // Map to old field
        });

      // Fetch the created ICP
      const [newICP] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, insertResult[0].insertId))
        .limit(1);

      return newICP;
    }),

  // Update ICP
  update: protectedProcedure
    .input(updateICPSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(
          and(
            eq(idealCustomerProfiles.id, id),
            eq(idealCustomerProfiles.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("ICP not found");
      }

      await db
        .update(idealCustomerProfiles)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(idealCustomerProfiles.id, id));

      // Fetch updated ICP
      const [updated] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, id))
        .limit(1);

      return updated;
    }),

  // Delete ICP
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(
          and(
            eq(idealCustomerProfiles.id, input.id),
            eq(idealCustomerProfiles.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("ICP not found");
      }

      await db
        .delete(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, input.id));

      return { success: true };
    }),
});
