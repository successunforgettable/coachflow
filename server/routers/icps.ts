import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { idealCustomerProfiles, services, jobs } from "../../drizzle/schema";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```json\s*|^```\s*|\s*```$/gm, '').trim();
}
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { filterRecord, getGlobalNegativePrompts } from "../lib/complianceFilter";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

const generateICPSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  name: z.string().min(1).max(255),
});

const updateICPSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(255).optional(),
  // 17 tabs
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

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "icp");
        if (ctx.user.icpGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} ICP generations. Upgrade to generate more.`,
          });
        }
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
      const prompt = `Create a detailed Ideal Customer Profile (ICP) for the following service. Write from INSIDE the customer's head — use their internal monologue, not a textbook description of them.

Service Name: ${service.name}
Category: ${service.category}
Description: ${service.description}
Target Customer: ${service.targetCustomer}
Main Benefit: ${service.mainBenefit}

VOICE RULES — apply to every section:
- Write as if you are narrating the customer's internal experience, not describing them from the outside
- Use specific situations, not generic emotions ("It's 2am and I'm refreshing my inbox again" not "they feel anxious")
- Every bullet point must be niche-specific — if it could appear in any coach's ICP, rewrite it
- Use the language they use with a close friend, not the language they'd use in a job interview

Generate a comprehensive ICP with ALL 17 sections:

1. INTRODUCTION: 2-3 paragraphs. Who is this person right now — their current situation, their daily life, their stuck state. Use their internal voice. Name their niche, their role, their specific problem.

2. FEARS: 5-7 fears. Each fear = the 3am version — the thought that wakes them at 3am, not the polite daytime version. Format: "I lie awake worrying that [specific fear]..." Not: "They fear failure."

3. HOPES & DREAMS: 5-7 hopes. Each must name a SPECIFIC desired situation — what their life looks like on the day everything has worked. Not feelings. Situations.

4. DEMOGRAPHICS: JSON object with age_range, gender, income_level, education, occupation, location, family_status — make these specific and realistic for this exact niche.

5. PSYCHOGRAPHICS: 3-4 paragraphs. Personality traits, lifestyle, attitudes, interests — all niche-specific. What do they do on weekends? What do they read? What podcasts do they listen to? What do they argue about online?

6. PAINS: 7-10 pains. Each pain = a specific daily situation, not an emotion. Format: "Every [day/week/month], [specific situation that happens to them]." Not: "They struggle with marketing."

7. FRUSTRATIONS: 5-7 frustrations. The things that make them say "WHY does this always happen to me?" — niche-specific, situational, specific enough to recognise themselves in.

8. GOALS: 6-8 goals. Each goal = a specific outcome they can picture — a number, a situation, a moment. Not "grow their business." What does it look and feel like when they've succeeded?

9. VALUES: 5-7 values. Not generic values (hard work, family). The values that CONFLICT with what they need to do to solve their problem — the values that make them resist buying or taking action.

10. OBJECTIONS: 5-7 objections. Each objection = the REAL reason they won't buy — not the polite reason they'd tell a salesperson. Format: "What they say: [polite objection]. What they mean: [real objection]."

11. BUYING TRIGGERS: 5-7 triggers. Each trigger = the SPECIFIC MOMENT that breaks the dam — the event, conversation, or realisation that pushes them from considering to buying. "The moment I knew I had to do something was when..."

12. MEDIA CONSUMPTION: Specific platforms, specific channels, specific shows, specific newsletters, specific communities — for this exact niche.

13. INFLUENCERS: Specific names of people they follow and why — not "industry experts" but real figures relevant to this niche.

14. COMMUNICATION STYLE: How they prefer to communicate — specific to their niche and demographics. What turns them off? What makes them trust someone?

15. DECISION MAKING: How they actually make purchasing decisions — who they consult, how long they take, what triggers action vs paralysis.

16. SUCCESS METRICS: How they measure whether something has worked — their specific KPIs, the numbers they track, the feeling they're chasing.

17. IMPLEMENTATION BARRIERS: What stops them from taking action AFTER they've decided to buy — the real friction points, niche-specific.

Format as JSON with these exact keys (use bullet points • for lists where appropriate):
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
              `You are an expert direct response copywriter who writes Ideal Customer Profiles from inside the customer's head — using their internal monologue, not a textbook description. You write in the specific language of this niche, not generic marketing language. Every answer must be so specific that the customer reads it and thinks "this is about me." Always respond with valid JSON. Never produce content containing: ${getGlobalNegativePrompts().join(", ")}.`,
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
      const icpData = JSON.parse(stripMarkdownJson(content));

      // Compliance pre-filter before DB write
      const ICP_FILTER_FIELDS = ["introduction", "fears", "hopesDreams", "pains", "frustrations", "goals", "objections", "buyingTriggers"];
      const { cleaned: cleanedIcpData, classification: icpClassification, allFlaggedTerms: icpFlaggedTerms } = filterRecord(icpData as Record<string, unknown>, ICP_FILTER_FIELDS);
      if (icpClassification === "REJECTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Some generated content contained prohibited language and could not be saved. Please regenerate. Flagged: ${icpFlaggedTerms.join("; ")}` });
      }
      const filteredIcpData = { ...icpData, ...cleanedIcpData };

      // Save to database - ALL 17 sections
      const insertResult: any = await db
        .insert(idealCustomerProfiles)
        .values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          campaignId: input.campaignId,
          name: input.name,
          // 17 tabs
          introduction: filteredIcpData.introduction,
          fears: filteredIcpData.fears,
          hopesDreams: filteredIcpData.hopesDreams,
          demographics: filteredIcpData.demographics,
          psychographics: filteredIcpData.psychographics,
          pains: filteredIcpData.pains,
          frustrations: filteredIcpData.frustrations,
          goals: filteredIcpData.goals,
          values: filteredIcpData.values,
          objections: filteredIcpData.objections,
          buyingTriggers: filteredIcpData.buyingTriggers,
          mediaConsumption: filteredIcpData.mediaConsumption,
          influencers: filteredIcpData.influencers,
          communicationStyle: filteredIcpData.communicationStyle,
          decisionMaking: filteredIcpData.decisionMaking,
          successMetrics: filteredIcpData.successMetrics,
          implementationBarriers: filteredIcpData.implementationBarriers,
          // Legacy fields for backward compatibility
          painPoints: filteredIcpData.pains, // Map to old field
          desiredOutcomes: filteredIcpData.goals, // Map to old field
          valuesMotivations: filteredIcpData.values, // Map to old field
        });

      // Fetch the created ICP
      const [newICP] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, insertResult[0].insertId))
        .limit(1);

      return newICP;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; ICP generation runs via setImmediate.
   * Client polls GET /api/jobs/:jobId every 5s.
   */
  generateAsync: protectedProcedure
    .input(generateICPSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "icp");
        if (user.icpGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} ICP generations. Upgrade to generate more.` });
        }
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [service] = await db.select().from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, user.id))).limit(1);
      if (!service) throw new Error("Service not found");

      const capturedInput = { ...input };
      const capturedUserId = user.id;
      const capturedService = { ...service };

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");

          const prompt = `Create a detailed Ideal Customer Profile (ICP) for the following service. Write from INSIDE the customer's head — use their internal monologue, not a textbook description of them.\n\nService Name: ${capturedService.name}\nCategory: ${capturedService.category}\nDescription: ${capturedService.description}\nTarget Customer: ${capturedService.targetCustomer}\nMain Benefit: ${capturedService.mainBenefit}\n\nVOICE RULES: Write as if narrating the customer's internal experience. Use specific situations, not generic emotions. Every bullet point must be niche-specific. Use the language they use with a close friend.\n\nGenerate ALL 17 sections:\n1. INTRODUCTION: Current situation, daily life, stuck state — in their internal voice.\n2. FEARS: 5-7 fears — the 3am version. Format: "I lie awake worrying that [specific fear]..."\n3. HOPES & DREAMS: 5-7 specific desired situations — what life looks like when it's worked.\n4. DEMOGRAPHICS: JSON object with age_range, gender, income_level, education, occupation, location, family_status — niche-realistic.\n5. PSYCHOGRAPHICS: 3-4 paragraphs — niche-specific personality, lifestyle, what they read/watch/argue about.\n6. PAINS: 7-10 specific daily situations. Format: "Every [day/week], [specific situation that happens to them]."\n7. FRUSTRATIONS: 5-7 "WHY does this always happen to me?" moments — niche-specific.\n8. GOALS: 6-8 specific outcomes with numbers, situations, or moments — not vague ambitions.\n9. VALUES: 5-7 values that CONFLICT with what they need to do — the values that make them resist action.\n10. OBJECTIONS: 5-7 real reasons they won't buy. Format: "What they say: [polite]. What they mean: [real]."\n11. BUYING TRIGGERS: 5-7 specific moments that break the dam. Format: "The moment I knew I had to do something was when..."\n12. MEDIA CONSUMPTION: Specific platforms, channels, shows, newsletters, communities — for this niche.\n13. INFLUENCERS: Specific names of people they follow and why — real figures for this niche.\n14. COMMUNICATION STYLE: How they communicate — niche-specific, what turns them off, what builds trust.\n15. DECISION MAKING: How they actually buy — who they consult, how long, what triggers action vs paralysis.\n16. SUCCESS METRICS: Specific KPIs, numbers they track, the feeling they're chasing.\n17. IMPLEMENTATION BARRIERS: Real friction points after deciding to buy — niche-specific.\n\nFormat as JSON with these exact keys (use bullet points \u2022 for lists):\n{\n  "introduction": "...",\n  "fears": "\u2022 Fear 1\\n\u2022 Fear 2\\n...",\n  "hopesDreams": "\u2022 Dream 1\\n\u2022 Dream 2\\n...",\n  "demographics": { ... },\n  "psychographics": "...",\n  "pains": "\u2022 Pain 1\\n\u2022 Pain 2\\n...",\n  "frustrations": "\u2022 Frustration 1\\n\u2022 Frustration 2\\n...",\n  "goals": "\u2022 Goal 1\\n\u2022 Goal 2\\n...",\n  "values": "\u2022 Value 1\\n\u2022 Value 2\\n...",\n  "objections": "\u2022 Objection 1\\n\u2022 Objection 2\\n...",\n  "buyingTriggers": "\u2022 Trigger 1\\n\u2022 Trigger 2\\n...",\n  "mediaConsumption": "...",\n  "influencers": "...",\n  "communicationStyle": "...",\n  "decisionMaking": "...",\n  "successMetrics": "...",\n  "implementationBarriers": "..."\n}`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: `You are an expert direct response copywriter who writes Ideal Customer Profiles from inside the customer's head — using their internal monologue, not a textbook description. You write in the specific language of this niche, not generic marketing language. Every answer must be so specific that the customer reads it and thinks "this is about me." Always respond with valid JSON. Never produce content containing: ${getGlobalNegativePrompts().join(", ")}.` },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_schema", json_schema: { name: "ideal_customer_profile_17_tabs", strict: true, schema: { type: "object", properties: { introduction: { type: "string" }, fears: { type: "string" }, hopesDreams: { type: "string" }, demographics: { type: "object", properties: { age_range: { type: "string" }, gender: { type: "string" }, income_level: { type: "string" }, education: { type: "string" }, occupation: { type: "string" }, location: { type: "string" }, family_status: { type: "string" } }, required: ["age_range","gender","income_level","education","occupation","location","family_status"], additionalProperties: false }, psychographics: { type: "string" }, pains: { type: "string" }, frustrations: { type: "string" }, goals: { type: "string" }, values: { type: "string" }, objections: { type: "string" }, buyingTriggers: { type: "string" }, mediaConsumption: { type: "string" }, influencers: { type: "string" }, communicationStyle: { type: "string" }, decisionMaking: { type: "string" }, successMetrics: { type: "string" }, implementationBarriers: { type: "string" } }, required: ["introduction","fears","hopesDreams","demographics","psychographics","pains","frustrations","goals","values","objections","buyingTriggers","mediaConsumption","influencers","communicationStyle","decisionMaking","successMetrics","implementationBarriers"], additionalProperties: false } } },
          });

          const content = response.choices[0].message.content;
          if (typeof content !== 'string') throw new Error('Invalid response format from AI');
          const icpData = JSON.parse(stripMarkdownJson(content));

          // Compliance pre-filter before DB write (async path)
          const ICP_FILTER_FIELDS_ASYNC = ["introduction", "fears", "hopesDreams", "pains", "frustrations", "goals", "objections", "buyingTriggers"];
          const { cleaned: cleanedIcpDataAsync, classification: icpClassificationAsync, allFlaggedTerms: icpFlaggedTermsAsync } = filterRecord(icpData as Record<string, unknown>, ICP_FILTER_FIELDS_ASYNC);
          if (icpClassificationAsync === "REJECTED") {
            throw new Error(`Some generated content contained prohibited language and could not be saved. Flagged: ${icpFlaggedTermsAsync.join("; ")}`);
          }
          const filteredIcpDataAsync = { ...icpData, ...cleanedIcpDataAsync };

          const insertResult: any = await bgDb.insert(idealCustomerProfiles).values({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId,
            name: capturedInput.name,
            introduction: filteredIcpDataAsync.introduction,
            fears: filteredIcpDataAsync.fears,
            hopesDreams: filteredIcpDataAsync.hopesDreams,
            demographics: filteredIcpDataAsync.demographics,
            psychographics: filteredIcpDataAsync.psychographics,
            pains: filteredIcpDataAsync.pains,
            frustrations: filteredIcpDataAsync.frustrations,
            goals: filteredIcpDataAsync.goals,
            values: filteredIcpDataAsync.values,
            objections: filteredIcpDataAsync.objections,
            buyingTriggers: filteredIcpDataAsync.buyingTriggers,
            mediaConsumption: filteredIcpDataAsync.mediaConsumption,
            influencers: filteredIcpDataAsync.influencers,
            communicationStyle: filteredIcpDataAsync.communicationStyle,
            decisionMaking: filteredIcpDataAsync.decisionMaking,
            successMetrics: filteredIcpDataAsync.successMetrics,
            implementationBarriers: filteredIcpDataAsync.implementationBarriers,
            painPoints: filteredIcpDataAsync.pains,
            desiredOutcomes: filteredIcpDataAsync.goals,
            valuesMotivations: filteredIcpDataAsync.values,
          });

          const [newICP] = await bgDb.select().from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.id, insertResult[0].insertId)).limit(1);

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ icpId: newICP?.id }) })
            .where(eq(jobs.id, jobId));
          console.log(`[icps.generateAsync] Job ${jobId} completed, icpId: ${newICP?.id}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[icps.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
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
