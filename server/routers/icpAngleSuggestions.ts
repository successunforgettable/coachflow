import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { icpAngleSuggestions, services, idealCustomerProfiles } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

export const icpAngleSuggestionsRouter = router({
  /**
   * Generate 10 audience angle suggestions for a service.
   * Deletes any existing suggestions for this service+user before inserting.
   * Input: { serviceId }
   */
  generate: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify service ownership and fetch all expanded fields
      const [service] = await db
        .select()
        .from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);

      if (!service) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
      }

      // Verbatim prompt from Requirement 2
      const prompt = `You are a world-class market research strategist for coaches and consultants.

A coach/consultant has created this service:
Name: ${service.name}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}
Pain Points: ${service.painPoints || "Not specified"}
Why Problem Exists: ${service.whyProblemExists || "Not specified"}
Unique Mechanism: ${service.uniqueMechanismSuggestion || "Not specified"}

Your task: Identify 10 distinct audience segments that could benefit from this service.
Each segment must be genuinely different — different demographics, different situations,
different primary pains, different reasons for buying.

Do not generate variations of the same person. Each of the 10 must be a meaningfully
different type of buyer.

Return a JSON array of exactly 10 objects with these exact fields:
[
  {
    "angleName": "4-6 word label for this audience segment",
    "description": "One sentence describing who this person is and their situation",
    "primaryPain": "The single most powerful pain this person feels that this service solves",
    "primaryBuyingTrigger": "The single event or realisation that would make this person buy now"
  }
]

Return valid JSON only. No markdown. No explanation.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a world-class market research strategist. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "icp_angle_suggestions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      angleName: { type: "string" },
                      description: { type: "string" },
                      primaryPain: { type: "string" },
                      primaryBuyingTrigger: { type: "string" },
                    },
                    required: ["angleName", "description", "primaryPain", "primaryBuyingTrigger"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") {
        throw new Error("Invalid response format from AI");
      }

      let suggestions: Array<{
        angleName: string;
        description: string;
        primaryPain: string;
        primaryBuyingTrigger: string;
      }> = [];

      try {
        // Try wrapped format first (json_schema enforces this)
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          suggestions = parsed;
        } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
          suggestions = parsed.suggestions;
        } else {
          suggestions = parsed;
        }
      } catch (e) {
        throw new Error("Failed to parse AI response as JSON");
      }

      if (suggestions.length < 10) {
        console.warn(`[icpAngleSuggestions.generate] Warning: LLM returned ${suggestions.length} suggestions (expected 10)`);
      }

      // Delete existing suggestions for this service+user
      await db
        .delete(icpAngleSuggestions)
        .where(
          and(
            eq(icpAngleSuggestions.serviceId, input.serviceId),
            eq(icpAngleSuggestions.userId, ctx.user.id)
          )
        );

      // Insert new suggestions
      if (suggestions.length > 0) {
        await db.insert(icpAngleSuggestions).values(
          suggestions.map((s) => ({
            serviceId: input.serviceId,
            userId: ctx.user.id,
            angleName: s.angleName,
            description: s.description,
            primaryPain: s.primaryPain,
            primaryBuyingTrigger: s.primaryBuyingTrigger,
            status: "suggested",
          }))
        );
      }

      // Return inserted rows
      return await db
        .select()
        .from(icpAngleSuggestions)
        .where(
          and(
            eq(icpAngleSuggestions.serviceId, input.serviceId),
            eq(icpAngleSuggestions.userId, ctx.user.id)
          )
        )
        .orderBy(desc(icpAngleSuggestions.createdAt));
    }),

  /**
   * Generate full ICPs from selected angle suggestions (1-3).
   * Processes sequentially to avoid rate limiting.
   * No quota check — angle-generated ICPs are part of the onboarding flow.
   * Input: { suggestionIds: number[] (min 1, max 3) }
   */
  generateICPs: protectedProcedure
    .input(z.object({ suggestionIds: z.array(z.number()).min(1).max(3) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const generatedICPs: Array<typeof idealCustomerProfiles.$inferSelect & { angleName: string | null }> = [];

      // Process sequentially to avoid rate limiting
      for (const suggestionId of input.suggestionIds) {
        // Verify suggestion ownership
        const [suggestion] = await db
          .select()
          .from(icpAngleSuggestions)
          .where(
            and(
              eq(icpAngleSuggestions.id, suggestionId),
              eq(icpAngleSuggestions.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!suggestion) {
          console.warn(`[icpAngleSuggestions.generateICPs] Suggestion ${suggestionId} not found for user ${ctx.user.id}, skipping`);
          continue;
        }

        // Fetch the linked service
        const [service] = await db
          .select()
          .from(services)
          .where(and(eq(services.id, suggestion.serviceId), eq(services.userId, ctx.user.id)))
          .limit(1);

        if (!service) {
          console.warn(`[icpAngleSuggestions.generateICPs] Service ${suggestion.serviceId} not found, skipping suggestion ${suggestionId}`);
          continue;
        }

        // Build biased ICP prompt: standard prompt + angle focus block (Requirement 3)
        const prompt = `You are an expert marketing strategist. Create a detailed Ideal Customer Profile (ICP) for the following service:

Service Name: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

FOCUS THIS ICP ON THIS SPECIFIC AUDIENCE ANGLE:
Angle name: ${suggestion.angleName}
Who this person is: ${suggestion.description}
Their primary pain: ${suggestion.primaryPain}
What would make them buy: ${suggestion.primaryBuyingTrigger}

All 17 tabs must reflect this specific type of person — not a generic customer.

Generate a comprehensive ICP with ALL 17 sections (Industry standard):

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
                    required: ["age_range", "gender", "income_level", "education", "occupation", "location", "family_status"],
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
                  "introduction", "fears", "hopesDreams", "demographics", "psychographics",
                  "pains", "frustrations", "goals", "values", "objections", "buyingTriggers",
                  "mediaConsumption", "influencers", "communicationStyle", "decisionMaking",
                  "successMetrics", "implementationBarriers",
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0].message.content;
        if (typeof content !== "string") {
          console.warn(`[icpAngleSuggestions.generateICPs] Invalid response for suggestion ${suggestionId}`);
          continue;
        }

        const icpData = JSON.parse(content);

        // Insert ICP with angleName populated (Requirement 3)
        const insertResult: any = await db.insert(idealCustomerProfiles).values({
          userId: ctx.user.id,
          serviceId: suggestion.serviceId,
          name: suggestion.angleName, // ICP name = angle name
          angleName: suggestion.angleName, // Item 1.1b field
          // 17 tabs
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
          painPoints: icpData.pains,
          desiredOutcomes: icpData.goals,
          valuesMotivations: icpData.values,
        });

        const newIcpId = insertResult[0].insertId;

        // Update suggestion: status = 'generated', icpId = newIcpId (Requirement 3)
        await db
          .update(icpAngleSuggestions)
          .set({ status: "generated", icpId: newIcpId })
          .where(eq(icpAngleSuggestions.id, suggestionId));

        // Fetch the created ICP
        const [newICP] = await db
          .select()
          .from(idealCustomerProfiles)
          .where(eq(idealCustomerProfiles.id, newIcpId))
          .limit(1);

        if (newICP) {
          generatedICPs.push(newICP);
        }
      }

      return generatedICPs;
    }),

  /**
   * List all angle suggestions for a service.
   * Input: { serviceId }
   */
  list: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return await db
        .select()
        .from(icpAngleSuggestions)
        .where(
          and(
            eq(icpAngleSuggestions.serviceId, input.serviceId),
            eq(icpAngleSuggestions.userId, ctx.user.id)
          )
        )
        .orderBy(desc(icpAngleSuggestions.createdAt));
    }),
});
