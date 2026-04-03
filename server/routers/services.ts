import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { filterRecord, getGlobalNegativePrompts } from "../lib/complianceFilter";

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

      // Determine which fields need to be generated vs already filled
      // Treat placeholder values ("To be defined") as empty — same logic as frontend
      const isPlaceholder = (v: string | null | undefined) =>
        !v?.trim() || v.trim().toLowerCase() === 'to be defined';
      const needsDescription = isPlaceholder(service.description);
      const needsTargetCustomer = isPlaceholder(service.targetCustomer);
      const needsMainBenefit = isPlaceholder(service.mainBenefit);

      const prompt = `You are a world-class direct response copywriter and market researcher applying the Jobs-To-Be-Done framework.

A coach/consultant has described their service:
- Name: ${service.name}${service.description?.trim() ? `\n- Description: ${service.description}` : ""}${service.targetCustomer?.trim() ? `\n- Target Customer: ${service.targetCustomer}` : ""}${service.mainBenefit?.trim() ? `\n- Main Benefit: ${service.mainBenefit}` : ""}

Generate a complete marketing intelligence profile for a coach in this niche.

SPECIFICITY RULES — every field must pass this test:
- Find ONE word or phrase that is niche-specific (an industry term, a role title, a platform name, a specific frustration) and build each answer around it
- If the answer could apply to any coach in any niche, it is too generic — rewrite it
- Use the language the customer uses when talking to a friend, not polished marketing language

BANNED PHRASES — never use in any field: mindset shift, limiting beliefs, step into your power, show up, do the work, level up, transform your life, unlock your potential, embrace your journey, take your business to the next level, achieve your dreams

JTBD FRAMEWORK — for each field, answer the question: what is this person really hiring this service to do? What is the functional job (the task they're trying to complete)? What is the emotional job (how they want to feel)? What is the social job (how they want to be perceived)?

Return JSON with these exact fields:
{
  "description": "1-2 sentences. Name what this service does and who it's for using niche-specific language. Include a concrete outcome (number, timeframe, or named result). Must NOT be interchangeable with any other coaching service.",
  "targetCustomer": "Specific demographic and psychographic description. Name their job title or life situation, their current stuck state, and the specific thing they want — all in niche-specific language.",
  "mainBenefit": "The single functional outcome the customer hires this service to deliver. Must contain a concrete result — a number, a timeframe, or a named change in situation. Not a feeling. Not a journey.",
  "painPoints": "3-5 pains. Each must name a SPECIFIC situation this person faces — not 'feeling overwhelmed' but 'posting every day for 3 months with zero client enquiries'. Use their internal monologue language.",
  "falseBeliefsVsRealReasons": "3-5 pairs. Format: [what customer believes is stopping them] | [what is actually stopping them]. Each pair must be niche-specific. The false belief must sound plausible. The real reason must be surprising.",
  "failedSolutions": "3-5 things this specific audience has tried. Name the actual product, approach, or platform (e.g. 'cold outreach on LinkedIn', 'hiring a VA', 'buying a $2k course on Instagram ads'). Explain exactly why each failed for THIS audience specifically.",
  "hiddenReasons": "3-5 real reasons behind their problem that they would never admit out loud or have never considered. These must be uncomfortable truths specific to this niche — not generic psychology.",
  "whyProblemExists": "The systemic or structural root cause of this problem. Not the symptom. Not 'lack of mindset'. The actual mechanism that keeps people stuck in this niche.",
  "uniqueMechanismSuggestion": "A proprietary-sounding name for how this service solves the problem. Must contain a specific process word or metaphor from this niche. NOT: The Success Blueprint, The Growth System, The Transformation Framework, The Mindset Method. Good names contain a word from the niche itself.",
  "hvcoTopicSuggestion": "A lead magnet title that would make someone in this niche stop scrolling. Must contain a specific number or timeframe, a named enemy or obstacle, and a concrete promised insight.",
  "riskReversalSuggestion": "A guarantee that makes the risk of not buying feel greater than the risk of buying. Must include: specific duration, specific result guaranteed, and exact refund process.",
  "avatarName": "A realistic first name for the ideal customer (match cultural context of the niche).",
  "avatarTitle": "Their job title or life situation in 3-5 words. Must be niche-specific."
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a world-class direct response copywriter and Jobs-To-Be-Done researcher. You write in the language real people use — not marketing language. Always return valid JSON only, no markdown, no explanation." },
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
                description: { type: "string" },
                targetCustomer: { type: "string" },
                mainBenefit: { type: "string" },
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
                "description",
                "targetCustomer",
                "mainBenefit",
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

      const rawContent = response.choices[0].message.content;
      let expanded: Record<string, unknown>;

      // Helper: try to parse JSON from a string, stripping markdown fences first
      const tryParse = (s: string): Record<string, unknown> | null => {
        try {
          const stripped = s
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "")
            .trim();
          return JSON.parse(stripped);
        } catch {
          return null;
        }
      };

      if (typeof rawContent !== "string") {
        // Already a parsed object (some LLM backends return objects directly)
        expanded = rawContent as unknown as Record<string, string>;
      } else {
        const parsed = tryParse(rawContent);
        if (parsed) {
          expanded = parsed;
        } else {
          // Claude sometimes wraps JSON in a preamble — find the first '{' and parse from there
          const firstBrace = rawContent.indexOf('{');
          const lastBrace = rawContent.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonSlice = rawContent.slice(firstBrace, lastBrace + 1);
            const sliceParsed = tryParse(jsonSlice);
            if (sliceParsed) {
              expanded = sliceParsed;
            } else {
              console.error('[expandProfile] Raw LLM output (first 500 chars):', rawContent.slice(0, 500));
              throw new Error("AI returned invalid JSON during profile expansion");
            }
          } else {
            console.error('[expandProfile] Raw LLM output (first 500 chars):', rawContent.slice(0, 500));
            throw new Error("AI returned invalid JSON during profile expansion");
          }
        }
      }

      // Helper to normalize a field: join arrays to newline-separated string, then truncate
      const normalize = (v: unknown, max: number): string => {
        if (Array.isArray(v)) return v.map(String).join('\n').slice(0, max);
        if (typeof v === 'string') return v.slice(0, max);
        if (v == null) return '';
        return String(v).slice(0, max);
      };
      const trunc = normalize; // alias for clarity

      // Compliance pre-filter on AI-generated service fields before DB write
      const SERVICE_FILTER_FIELDS = ["painPoints", "targetCustomer", "description", "mainBenefit", "falseBeliefsVsRealReasons", "failedSolutions", "hiddenReasons"];
      const { cleaned: cleanedServiceData, classification: serviceClassification, allFlaggedTerms: serviceFlaggedTerms } = filterRecord(expanded, SERVICE_FILTER_FIELDS);
      if (serviceClassification === "REJECTED") {
        throw new Error(`Generated service content contained prohibited language. Please regenerate. Flagged: ${serviceFlaggedTerms.join("; ")}`);
      }
      const filteredExpanded = { ...expanded, ...cleanedServiceData };

      // Map LLM field names to DB column names.
      // Only overwrite fields that were empty — never overwrite user-filled content.
      // Truncate to column limits: text = 65535, varchar(300) = 300, varchar(100) = 100
      const updateFields: Record<string, string> = {
        // Always overwrite deep-research fields (not user-editable in the form)
        painPoints: trunc(filteredExpanded.painPoints, 65535),
        falseBeliefsVsRealReasons: trunc(filteredExpanded.falseBeliefsVsRealReasons, 65535),
        failedSolutions: trunc(filteredExpanded.failedSolutions, 65535),
        hiddenReasons: trunc(filteredExpanded.hiddenReasons, 65535),
        whyProblemExists: trunc(filteredExpanded.whyProblemExists, 65535),
        riskReversal: trunc(filteredExpanded.riskReversalSuggestion, 65535),
        avatarName: trunc(filteredExpanded.avatarName, 100),
        avatarTitle: trunc(filteredExpanded.avatarTitle, 100),
        // Only overwrite user-visible fields if they were empty
        ...(needsDescription && filteredExpanded.description ? { description: trunc(filteredExpanded.description, 65535) } : {}),
        ...(needsTargetCustomer && filteredExpanded.targetCustomer ? { targetCustomer: trunc(filteredExpanded.targetCustomer, 65535) } : {}),
        ...(needsMainBenefit && filteredExpanded.mainBenefit ? { mainBenefit: trunc(filteredExpanded.mainBenefit, 65535) } : {}),
        uniqueMechanismSuggestion: trunc(filteredExpanded.uniqueMechanismSuggestion, 65535),
        hvcoTopic: trunc(filteredExpanded.hvcoTopicSuggestion, 300),
      };

      // REQUIREMENT 3: Save to DB BEFORE returning — persists even if user skips review
      try {
        await db
          .update(services)
          .set({ ...updateFields, updatedAt: new Date() })
          .where(eq(services.id, input.serviceId));
      } catch (dbErr: unknown) {
        const e = dbErr as { code?: string; sqlMessage?: string; message?: string };
        console.error('[expandProfile] DB update failed:', {
          code: e.code,
          sqlMessage: e.sqlMessage,
          message: e.message,
          fieldLengths: Object.fromEntries(
            Object.entries(updateFields).map(([k, v]) => [k, typeof v === 'string' ? v.length : v])
          ),
        });
        throw dbErr;
      }

      // Return the expanded fields so the review screen can display them
      // Always include all generated fields (even if not saved to DB) so frontend can pre-fill form
      const expandedResult = {
        painPoints: updateFields.painPoints || '',
        falseBeliefsVsRealReasons: updateFields.falseBeliefsVsRealReasons || '',
        failedSolutions: updateFields.failedSolutions || '',
        hiddenReasons: updateFields.hiddenReasons || '',
        whyProblemExists: updateFields.whyProblemExists || '',
        riskReversal: updateFields.riskReversal || '',
        avatarName: updateFields.avatarName || '',
        avatarTitle: updateFields.avatarTitle || '',
        uniqueMechanismSuggestion: updateFields.uniqueMechanismSuggestion || '',
        hvcoTopic: updateFields.hvcoTopic || '',
        // Include user-visible generated fields even if they weren't saved (already had content)
        targetCustomer: trunc(expanded.targetCustomer, 65535) || updateFields.targetCustomer || '',
        mainBenefit: trunc(expanded.mainBenefit, 65535) || updateFields.mainBenefit || '',
        description: trunc(expanded.description, 65535) || updateFields.description || '',
      };
      return {
        serviceId: input.serviceId,
        expanded: expandedResult,
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
