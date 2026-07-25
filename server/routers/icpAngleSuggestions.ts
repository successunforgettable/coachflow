import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { icpAngleSuggestions, services, idealCustomerProfiles } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";
import { runIcpGeneration } from "../_core/icpGenerate";
import { normalizeDemographics } from "../_core/icpGrounding";
import { filterRecord } from "../lib/complianceFilter";
import { stripObjectionScaffolding } from "../_core/icpSanitize";

/** Same fields the generate paths compliance-filter before any DB write. */
const ANGLE_ICP_FILTER_FIELDS = [
  "introduction", "fears", "hopesDreams", "pains", "frustrations", "goals", "objections", "buyingTriggers",
];

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

ANGLE DIFFERENTIATION RULE: The 10 segments must be genuinely different people in genuinely different situations — not variations of the same person with slightly different demographics. Before finalising your 10, check: if two segments share the same primaryPain, they are not different segments — merge them and replace with a genuinely different audience.

ANGLENAME SPECIFICITY RULE: Each angleName must be 4-6 words that could only describe people in this specific niche — not generic descriptors like "Busy Professionals" or "Growth-Minded Entrepreneurs." The name must contain a niche-specific word or situation that makes the audience immediately recognisable. Good examples: "Burnt Out Corporate Coaches", "Photographers Stuck At $1,500", "Consultants Losing Proposals To Price". Bad examples: "Success-Driven Individuals", "Aspiring Entrepreneurs", "Motivated Professionals".

BUYING TRIGGER SPECIFICITY RULE: Every primaryBuyingTrigger must name a specific event or moment — not a category of motivation. Not "when they decide to invest in themselves" — "when they lose a client to a competitor who charges three times as much and realise their pricing is the problem." The trigger must be observable — something that happened or could happen on a specific day.

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

        // Angle-focused generation now runs through the SINGLE prompt source and the
        // same grounded runner as every other path (structural gate, R3 grounding
        // labels, retry 1→3). This file previously carried its own near-verbatim
        // copy of the prompt, which silently missed every improvement made to the
        // shared one and ran with no compliance filter at all.
        // Angle-focused generation runs through the SINGLE prompt source and the same
        // grounded runner as every other ICP path (structural gate, R3 grounding
        // labels, retry 1→3). This file previously carried its OWN near-verbatim copy
        // of the prompt: it silently missed every improvement made to the shared one
        // and ran with no compliance filter at all.
        let icpData: any;
        let provenance;
        try {
          const run = await runIcpGeneration({
            service: {
              name: service.name,
              category: service.category,
              description: service.description,
              targetCustomer: service.targetCustomer,
              mainBenefit: service.mainBenefit,
            },
            angle: {
              angleName: suggestion.angleName,
              description: suggestion.description,
              primaryPain: suggestion.primaryPain,
              primaryBuyingTrigger: suggestion.primaryBuyingTrigger,
            },
            logLabel: `icpAngleSuggestions[${suggestionId}]`,
          });
          icpData = run.icp;
          provenance = run.provenance;
        } catch (err) {
          console.warn(
            `[icpAngleSuggestions.generateICPs] Generation failed for suggestion ${suggestionId}:`,
            err instanceof Error ? err.message : String(err),
          );
          continue;
        }

        // Compliance pre-filter before DB write — this path previously had none.
        const { cleaned: cleanedAngleIcp, classification: angleClassification } = filterRecord(
          icpData as Record<string, unknown>,
          ANGLE_ICP_FILTER_FIELDS,
        );
        if (angleClassification === "REJECTED") {
          console.warn(`[icpAngleSuggestions.generateICPs] Suggestion ${suggestionId} rejected by compliance filter; skipping`);
          continue;
        }
        Object.assign(icpData, cleanedAngleIcp);
        icpData.objections = stripObjectionScaffolding(icpData.objections);

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
          demographics: normalizeDemographics(icpData.demographics),
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
          groundingMeta: provenance,
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
