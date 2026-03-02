import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
}
import { sourceOfTruth } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Source of Truth Generator
 * User provides basic info → AI generates complete service profile
 */
export const sourceOfTruthRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        programName: z.string().min(1),
        coreOffer: z.string().min(10),
        targetAudience: z.string().min(10),
        mainPainPoint: z.string().min(10),
        priceRange: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prompt = `You are an expert marketing strategist. Based on the following information, generate a comprehensive service profile for a coaching/speaking/consulting program.

**Input Information:**
- Program Name: ${input.programName}
- Core Offer: ${input.coreOffer}
- Target Audience: ${input.targetAudience}
- Main Pain Point: ${input.mainPainPoint}
- Price Range: ${input.priceRange || "Not specified"}

**Generate a complete service profile with the following sections:**

1. **Service Description** (2-3 paragraphs): A compelling description of what this service offers and why it's unique.

2. **Target Customer Profile** (detailed): 
   - Demographics (age, location, profession)
   - Psychographics (interests, values, aspirations)
   - Current situation and challenges

3. **Main Benefits** (3-5 bullet points): Clear, specific benefits clients will receive.

4. **Pain Points Solved** (detailed):
   - Surface-level problems
   - Deeper emotional pain points
   - Hidden barriers they face

5. **Unique Value Proposition**: What makes this program different from competitors?

6. **Ideal Customer Avatar**: A detailed profile of the perfect client for this program.

Format your response as JSON with these exact keys:
{
  "description": "...",
  "targetCustomer": "...",
  "mainBenefits": "...",
  "painPoints": "...",
  "uniqueValue": "...",
  "idealCustomerAvatar": "..."
}`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an expert marketing strategist who creates comprehensive service profiles. Always respond with valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "service_profile",
            strict: true,
            schema: {
              type: "object",
              properties: {
                description: { type: "string" },
                targetCustomer: { type: "string" },
                mainBenefits: { type: "string" },
                painPoints: { type: "string" },
                uniqueValue: { type: "string" },
                idealCustomerAvatar: { type: "string" },
              },
              required: ["description", "targetCustomer", "mainBenefits", "painPoints", "uniqueValue", "idealCustomerAvatar"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("No response from AI");
      }

      const profile = JSON.parse(stripMarkdownJson(content));

      // Save to database
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if user already has a source of truth
      const existing = await db
        .select()
        .from(sourceOfTruth)
        .where(eq(sourceOfTruth.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(sourceOfTruth)
          .set({
            programName: input.programName,
            coreOffer: input.coreOffer,
            targetAudience: input.targetAudience,
            mainPainPoint: input.mainPainPoint,
            priceRange: input.priceRange || null,
            ...profile,
          })
          .where(eq(sourceOfTruth.id, existing[0].id));

        const updated = { ...existing[0], ...profile };
        return updated;
      } else {
        // Insert new
        const result = await db.insert(sourceOfTruth).values({
          userId: ctx.user.id,
          programName: input.programName,
          coreOffer: input.coreOffer,
          targetAudience: input.targetAudience,
          mainPainPoint: input.mainPainPoint,
          priceRange: input.priceRange || null,
          ...profile,
        });

        return { id: Number(result[0].insertId), programName: input.programName, coreOffer: input.coreOffer, priceRange: input.priceRange, ...profile };
      }
    }),

  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const result = await db
      .select()
      .from(sourceOfTruth)
      .where(eq(sourceOfTruth.userId, ctx.user.id))
      .limit(1);

    return result[0] || null;
  }),

  update: protectedProcedure
    .input(
      z.object({
        programName: z.string().optional(),
        coreOffer: z.string().optional(),
        targetAudience: z.string().optional(),
        mainPainPoint: z.string().optional(),
        priceRange: z.string().optional(),
        description: z.string().optional(),
        targetCustomer: z.string().optional(),
        mainBenefits: z.string().optional(),
        painPoints: z.string().optional(),
        uniqueValue: z.string().optional(),
        idealCustomerAvatar: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(sourceOfTruth)
        .set(input)
        .where(eq(sourceOfTruth.userId, ctx.user.id));

      return { success: true };
    }),
});
