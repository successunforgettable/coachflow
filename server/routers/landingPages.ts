import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { landingPages, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const generateLandingPageSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  angle: z.enum(["shock_solve", "contrarian", "story", "authority"]),
});

const updateLandingPageSchema = z.object({
  id: z.number(),
  headline: z.string().optional(),
  sections: z.any().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const landingPagesRouter = router({
  // List all landing pages for current user
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

      const conditions = [eq(landingPages.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(landingPages.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(landingPages.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(landingPages)
        .where(and(...conditions))
        .orderBy(desc(landingPages.createdAt));
    }),

  // Get single landing page by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [page] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!page) {
        throw new Error("Landing page not found");
      }

      return page;
    }),

  // Generate landing page using AI
  generate: protectedProcedure
    .input(generateLandingPageSchema)
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

      const angleInstructions = {
        shock_solve: "Start with shocking statistic or bold claim, then present solution",
        contrarian: "Challenge conventional wisdom, present contrarian viewpoint",
        story: "Use personal transformation story, hero's journey framework",
        authority: "Establish credibility with credentials, results, social proof",
      };

      const prompt = `You are an expert landing page copywriter. Create a high-converting landing page for this service using the ${input.angle.toUpperCase().replace("_", " ")} angle.

Service: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

Angle: ${angleInstructions[input.angle]}

Create a complete landing page with these sections:
1. HEADLINE (10-15 words, attention-grabbing, benefit-focused)
2. SUBHEADLINE (20-30 words, expand on headline)
3. HERO SECTION (100-150 words, hook the reader)
4. PROBLEM SECTION (150-200 words, agitate pain points)
5. SOLUTION SECTION (150-200 words, introduce your solution)
6. BENEFITS SECTION (3-5 bullet points, specific benefits)
7. HOW IT WORKS (3-4 steps, simple process)
8. SOCIAL PROOF (2-3 testimonials or case studies)
9. GUARANTEE (50-75 words, risk reversal)
10. CTA SECTION (50-75 words, clear call-to-action)

Format as JSON with these exact keys.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert landing page copywriter specializing in high-converting sales pages for coaches, speakers, and consultants. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "landing_page",
            strict: true,
            schema: {
              type: "object",
              properties: {
                headline: { type: "string" },
                subheadline: { type: "string" },
                heroSection: { type: "string" },
                problemSection: { type: "string" },
                solutionSection: { type: "string" },
                benefits: {
                  type: "array",
                  items: { type: "string" },
                },
                howItWorks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      step: { type: "integer" },
                      title: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["step", "title", "description"],
                    additionalProperties: false,
                  },
                },
                socialProof: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      testimonial: { type: "string" },
                      result: { type: "string" },
                    },
                    required: ["name", "testimonial", "result"],
                    additionalProperties: false,
                  },
                },
                guarantee: { type: "string" },
                ctaSection: { type: "string" },
              },
              required: [
                "headline",
                "subheadline",
                "heroSection",
                "problemSection",
                "solutionSection",
                "benefits",
                "howItWorks",
                "socialProof",
                "guarantee",
                "ctaSection",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") {
        throw new Error("Invalid response format from AI");
      }
      const pageData = JSON.parse(content);

      // Save to database
      const insertResult: any = await db.insert(landingPages).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        angle: input.angle,
        headline: pageData.headline,
        sections: pageData,
      });

      // Fetch the created landing page
      const [newPage] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, insertResult[0].insertId))
        .limit(1);

      return newPage;
    }),

  // Update landing page
  update: protectedProcedure
    .input(updateLandingPageSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Landing page not found");
      }

      await db
        .update(landingPages)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(landingPages.id, id));

      // Fetch updated landing page
      const [updated] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, id))
        .limit(1);

      return updated;
    }),

  // Delete landing page
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Landing page not found");
      }

      await db.delete(landingPages).where(eq(landingPages.id, input.id));

      return { success: true };
    }),
});
