import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { idealCustomerProfiles, services, jobs } from "../../drizzle/schema";

import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { filterRecord, getGlobalNegativePrompts } from "../lib/complianceFilter";
import { ICP_SYSTEM_PROMPT, type ICPLadderAnswers, type ICPServiceInput } from "../_core/icpPrompts";
import { runIcpGeneration } from "../_core/icpGenerate";
import { normalizeDemographics } from "../_core/icpGrounding";
import { stripObjectionScaffolding } from "../_core/icpSanitize";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

// ICP_SYSTEM_PROMPT and ICP_USER_PROMPT are defined in server/_core/icpPrompts.ts
// and imported above — both generate (sync) and generateAsync use them.

/**
 * Laddered follow-ups (R2 5-Rings, coach→individual). Every field optional and
 * skippable by design: a coach with no client history answers none, and their
 * profile is labelled mostly-inferred rather than blocked.
 */
const ladderSchema = z
  .object({
    trigger: z.string().max(2000).optional(),
    priorAttempts: z.string().max(2000).optional(),
    hesitation: z.string().max(2000).optional(),
    successMoment: z.string().max(2000).optional(),
  })
  .optional();

const generateICPSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  name: z.string().min(1).max(255),
  ladder: ladderSchema,
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

      // Generate ICP using AI — ALL 17 sections, through the single grounded runner
      // (structural gate + R3 grounding labels + retry 1→3).
      const { icp: icpData, provenance } = await runIcpGeneration({
        service,
        ladder: (input.ladder ?? null) as ICPLadderAnswers | null,
        logLabel: "icps.generate",
      });

      // Compliance pre-filter before DB write
      const ICP_FILTER_FIELDS = ["introduction", "fears", "hopesDreams", "pains", "frustrations", "goals", "objections", "buyingTriggers"];
      const { cleaned: cleanedIcpData, classification: icpClassification, allFlaggedTerms: icpFlaggedTerms } = filterRecord(icpData as Record<string, unknown>, ICP_FILTER_FIELDS);
      if (icpClassification === "REJECTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Some generated content contained prohibited language and could not be saved. Please regenerate. Flagged: ${icpFlaggedTerms.join("; ")}` });
      }
      const filteredIcpData: any = { ...icpData, ...cleanedIcpData };
      filteredIcpData.objections = stripObjectionScaffolding(filteredIcpData.objections) as string; // item 6: strip FAQ scaffolding at source

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
          demographics: normalizeDemographics(filteredIcpData.demographics),
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
          // Provenance is stored OUT OF BAND — never inline in the 17 text fields,
          // which every downstream generator interpolates straight into its prompt.
          groundingMeta: provenance,
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

          const { icp: icpData, provenance } = await runIcpGeneration({
            service: capturedService,
            ladder: (capturedInput.ladder ?? null) as ICPLadderAnswers | null,
            logLabel: "icps.generateAsync",
          });

          // Compliance pre-filter before DB write (async path)
          const ICP_FILTER_FIELDS_ASYNC = ["introduction", "fears", "hopesDreams", "pains", "frustrations", "goals", "objections", "buyingTriggers"];
          const { cleaned: cleanedIcpDataAsync, classification: icpClassificationAsync, allFlaggedTerms: icpFlaggedTermsAsync } = filterRecord(icpData as Record<string, unknown>, ICP_FILTER_FIELDS_ASYNC);
          if (icpClassificationAsync === "REJECTED") {
            throw new Error(`Some generated content contained prohibited language and could not be saved. Flagged: ${icpFlaggedTermsAsync.join("; ")}`);
          }
          const filteredIcpDataAsync: any = { ...icpData, ...cleanedIcpDataAsync };
          filteredIcpDataAsync.objections = stripObjectionScaffolding(filteredIcpDataAsync.objections) as string; // item 6: strip FAQ scaffolding at source

          const insertResult: any = await bgDb.insert(idealCustomerProfiles).values({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId,
            name: capturedInput.name,
            introduction: filteredIcpDataAsync.introduction,
            fears: filteredIcpDataAsync.fears,
            hopesDreams: filteredIcpDataAsync.hopesDreams,
            demographics: normalizeDemographics(filteredIcpDataAsync.demographics),
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
            groundingMeta: provenance,
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

  regenerateSection: protectedProcedure
    .input(z.object({
      id: z.number(),
      sectionKey: z.enum([
        "introduction", "fears", "hopesDreams", "demographics", "psychographics",
        "pains", "frustrations", "goals", "values", "objections", "buyingTriggers",
        "mediaConsumption", "influencers", "communicationStyle", "decisionMaking",
        "successMetrics", "implementationBarriers",
      ]),
      promptOverride: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [row] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(and(eq(idealCustomerProfiles.id, input.id), eq(idealCustomerProfiles.userId, ctx.user.id)))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "ICP not found" });

      const currentValue = (row as Record<string, unknown>)[input.sectionKey];
      const serialized = typeof currentValue === "string" ? currentValue : JSON.stringify(currentValue);

      const userInstruction = input.promptOverride?.trim()
        ? ` User instruction: ${input.promptOverride.trim()}.`
        : "";

      // The service this profile belongs to IS the ground truth for a rewrite —
      // without it this path regenerated against nothing but its own prior output.
      let service: ICPServiceInput | null = null;
      if (row.serviceId) {
        const [svc] = await db
          .select({
            name: services.name,
            category: services.category,
            description: services.description,
            targetCustomer: services.targetCustomer,
            mainBenefit: services.mainBenefit,
          })
          .from(services)
          .where(eq(services.id, row.serviceId))
          .limit(1);
        if (svc) service = svc;
      }

      const groundTruth = service
        ? `\n\nWHAT THE COACH TOLD US — treat as authoritative; stay consistent with it.\nService: ${service.name}\nDescription: ${service.description}\nTarget customer: ${service.targetCustomer}\nMain benefit: ${service.mainBenefit}`
        : "";

      // Sections 4/12/13 state checkable facts about real people; the same
      // real-or-"Not specified" rule that governs generation governs a rewrite.
      const CLASS_A_SECTIONS = new Set(["demographics", "mediaConsumption", "influencers"]);
      const groundingRule = CLASS_A_SECTIONS.has(input.sectionKey)
        ? `\n\nThis section states checkable facts about real people. Carry across what the coach's information above establishes. Name a specific individual, publication or brand only where the coach named it; otherwise describe the KIND of voice or channel this person trusts. Any demographic value the information above leaves open carries the exact text "Not specified".`
        : `\n\nKeep the customer's internal monologue — specific lived situations, their own words, the detail that makes them recognise themselves. Build it on the coach's information above rather than on invented specifics.`;

      const prompt = `Rewrite the "${input.sectionKey}" section for this ideal customer profile. Current value: ${serialized}.${userInstruction}${groundTruth}${groundingRule}\n\nReturn ONLY the rewritten text. No JSON, no markdown, no explanation.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: ICP_SYSTEM_PROMPT() },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") throw new Error("Invalid response from AI");

      let cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

      // Same compliance pre-filter the generate paths run before any DB write.
      const { cleaned: compliant, classification } = filterRecord({ [input.sectionKey]: cleaned }, [input.sectionKey]);
      if (classification === "REJECTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The rewritten section contained prohibited language and was not saved. Please try again.",
        });
      }
      if (typeof compliant[input.sectionKey] === "string") cleaned = compliant[input.sectionKey] as string;
      if (input.sectionKey === "objections") cleaned = stripObjectionScaffolding(cleaned) as string;

      await db
        .update(idealCustomerProfiles)
        .set({ [input.sectionKey]: cleaned })
        .where(eq(idealCustomerProfiles.id, input.id));

      return { value: cleaned };
    }),
});
