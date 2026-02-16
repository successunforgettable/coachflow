import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { adCopy, services, campaigns } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const generateAdCopySchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  adType: z.enum(["story", "authority", "question", "social_proof", "cta"]),
  count: z.number().min(1).max(15).default(5),
});

const updateAdCopySchema = z.object({
  id: z.number(),
  headline: z.string().optional(),
  bodyCopy: z.string().optional(),
  linkDescription: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const adCopyRouter = router({
  // List all ad copy for current user
  list: protectedProcedure
    .input(
      z
        .object({
          serviceId: z.number().optional(),
          campaignId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(adCopy.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(adCopy.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(adCopy.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(adCopy)
        .where(and(...conditions))
        .orderBy(desc(adCopy.createdAt));
    }),

  // Get single ad copy by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [ad] = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.id, input.id), eq(adCopy.userId, ctx.user.id)))
        .limit(1);

      if (!ad) {
        throw new Error("Ad copy not found");
      }

      return ad;
    }),

  // Generate ad copy using AI
  generate: protectedProcedure
    .input(generateAdCopySchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get service details
      const [service] = await db
        .select()
        .from(services)
        .where(
          and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id))
        )
        .limit(1);

      if (!service) {
        throw new Error("Service not found");
      }

      // Generate ad copy using AI
      const adTypeInstructions = {
        story: "Use storytelling - start with a relatable problem, show transformation, end with benefit",
        authority: "Establish credibility - use statistics, expert positioning, proven results",
        question: "Ask provocative questions that highlight pain points and create curiosity",
        social_proof: "Leverage testimonials, case studies, and social validation",
        cta: "Direct call-to-action focused - clear benefit, urgency, and next step",
      };

      const prompt = `You are an expert Facebook/Instagram ad copywriter. Create ${input.count} high-converting ad variations for this service:

Service: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

Ad Type: ${input.adType.toUpperCase()}
Instructions: ${adTypeInstructions[input.adType]}

For each ad variation, provide:
1. HEADLINE (max 40 characters, attention-grabbing)
2. BODY COPY (125-150 words, compelling and benefit-focused)
3. LINK DESCRIPTION (max 30 characters, clear CTA)

Format as JSON array:
[
  {
    "headline": "...",
    "bodyCopy": "...",
    "linkDescription": "..."
  },
  ...
]`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert ad copywriter specializing in high-converting Facebook and Instagram ads for coaches, speakers, and consultants. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ad_copy_variations",
            strict: true,
            schema: {
              type: "object",
              properties: {
                ads: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      headline: { type: "string" },
                      bodyCopy: { type: "string" },
                      linkDescription: { type: "string" },
                    },
                    required: ["headline", "bodyCopy", "linkDescription"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["ads"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") {
        throw new Error("Invalid response format from AI");
      }
      const adData = JSON.parse(content);

      // Save all variations to database
      const createdAds = [];
      for (const ad of adData.ads) {
        const insertResult: any = await db.insert(adCopy).values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId || null,
          adType: input.adType,
          headline: ad.headline,
          bodyCopy: ad.bodyCopy,
          linkDescription: ad.linkDescription,
        });

        const [newAd] = await db
          .select()
          .from(adCopy)
          .where(eq(adCopy.id, insertResult[0].insertId))
          .limit(1);

        createdAds.push(newAd);
      }

      return createdAds;
    }),

  // Update ad copy
  update: protectedProcedure
    .input(updateAdCopySchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.id, id), eq(adCopy.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new Error("Ad copy not found");
      }

      await db
        .update(adCopy)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(adCopy.id, id));

      // Fetch updated ad
      const [updated] = await db
        .select()
        .from(adCopy)
        .where(eq(adCopy.id, id))
        .limit(1);

      return updated;
    }),

  // Delete ad copy
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.id, input.id), eq(adCopy.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new Error("Ad copy not found");
      }

      await db.delete(adCopy).where(eq(adCopy.id, input.id));

      return { success: true };
    }),
});
