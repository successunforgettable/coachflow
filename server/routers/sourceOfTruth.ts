import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { BANNED_COPYWRITING_WORDS, META_COMPLIANCE_NOTES } from "../_core/copywritingRules";

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
      const prompt = `Create a Source of Truth profile for the following coaching/consulting programme. Every field must pass the product-swap test — if the same output could have been generated for a different coaching programme in a different niche, rewrite it until it could not.

Programme Name: ${input.programName}
Core Offer: ${input.coreOffer}
Target Audience: ${input.targetAudience}
Main Pain Point: ${input.mainPainPoint}
Price Range: ${input.priceRange || "Not specified"}

SPECIFICITY RULE: Every field in this profile must contain at least one word or phrase that only someone in this specific niche would recognise. Generic coaching language is not allowed. If a field could appear in any coach's marketing, rewrite it until it could not.

BANNED COPYWRITING WORDS — never use any of these in any field: ${BANNED_COPYWRITING_WORDS.join(', ')}

VOICE RULE: Write in the customer's own language — the words they use to describe their situation to a close friend, not the words a coach uses to describe their programme. The customer's internal experience, not a marketing description of it.

FABRICATION RULE: Never invent statistics, income claims, testimonials, or social proof not explicitly provided in the input above. If specific numbers are not provided, use directional language only — "coaches who complete this" not "83% of coaches who complete this."

Generate a complete Source of Truth profile with these six fields:

description: 2-3 sentences. Name the specific type of person this serves, the specific problem it solves, and the specific outcome it delivers. Must contain at least one niche-specific term that only someone in this world would use. Must not use any banned copywriting word. Must not be interchangeable with a description of any other coaching programme.

targetCustomer: Write as an internal monologue in the customer's own voice. Structure: "I am a [specific role or life situation] who [specific daily experience that is the problem]. I have tried [specific things they have tried] and they did not work because [specific reason unique to this situation]. What I actually need is [specific outcome, not a category of outcomes]." This must feel like a real person speaking, not a demographic profile.

mainBenefits: 3-5 benefits. Each benefit must have a concrete anchor — a number, a timeframe, or a named situation. Not "improved confidence" — "confident enough to charge £5,000 for a programme they used to give away for £500." Not "better results" — "clients who complete in 90 days instead of spinning their wheels for 2 years." Every benefit must be niche-specific and outcome-specific. No vague benefit language.

painPoints: 5-7 pain points. Each must be a specific daily situation — not an emotion and not a category of pain. Format: "Every [day/week/month], [specific thing that happens to them that they cannot stop]." The situation must be niche-specific and observable — something another person could witness happening to them.

uniqueValue: What specifically makes this different from every other coaching programme in this niche. Name 2-3 specific things the customer has already tried that did not work, and explain precisely why this is structurally different — not just better. Never use "unique approach" or "proprietary system" without naming what the approach or system actually does differently. The difference must be mechanistic and specific, not a marketing claim.

idealCustomerAvatar: A specific person, not a demographic category. Give them a real first name, a specific job title or life situation, and a specific age. Describe the specific stuck state they are in right now — what is happening to them today that is making them consider buying. Describe the specific moment or event that would finally make them buy — not "when they are ready to invest in themselves" but the actual trigger event.

Return as JSON with these exact keys:
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
            content: `You are a world-class direct response copywriter and market researcher who creates Source of Truth profiles for coaches and consultants. You write from inside the customer's world — using their language, their fears, their specific situation. You never use generic coaching language. You never produce output that could apply to a different coaching programme. Always respond with valid JSON only. ${META_COMPLIANCE_NOTES}`,
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
