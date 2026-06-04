import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getHeroMechanismSetsByUser,
  getHeroMechanismsBySetId,
  updateHeroMechanismRating,
  toggleHeroMechanismFavorite,
  deleteHeroMechanismSet,
} from "../db";
import { getDb } from "../db";
import { jobs, heroMechanisms } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { runHeroMechanismGeneration } from "../heroMechanismsGenerator";

/**
 * Hero Mechanisms Router - Industry Standard
 * 
 * Generates 3 tabs of mechanism variations:
 * - Hero Mechanisms (5 creative mechanisms with unique names)
 * - Headline Ideas (5 headline variations)
 * - Power Mode (5 extra powerful variations)
 * 
 * Each mechanism has:
 * - Creative name (e.g., "Breakthrough Neural Nexus System")
 * - Full paragraph description with credibility, outcome, timeframe, emotional transformation
 */

export const heroMechanismsRouter = router({
  /**
   * Generate Hero Mechanisms
   * Creates 3 tabs with 5 mechanism variations each
   */
  // Auto Mode Phase B1: thin wrapper around runHeroMechanismGeneration.
  // Quota checks live here in the tRPC layer; the gen-core itself is in
  // server/heroMechanismsGenerator.ts and is callable directly by the
  // orchestrator.
  generate: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        campaignId: z.number().optional(),
        targetMarket: z.string().max(5000),
        pressingProblem: z.string().max(5000),
        whyProblem: z.string().max(5000),
        whatTried: z.string().max(5000),
        whyExistingNotWork: z.string().max(5000),
        descriptor: z.string().max(5000).optional(),
        application: z.string().max(5000).optional(),
        desiredOutcome: z.string().max(5000),
        credibility: z.string().max(5000),
        socialProof: z.string().max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "heroMechanisms");
        if (user.heroMechanismGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} Hero Mechanism sets. Upgrade to generate more.`,
          });
        }
      }

      return await runHeroMechanismGeneration({
        userId: user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId,
        targetMarket: input.targetMarket,
        pressingProblem: input.pressingProblem,
        whyProblem: input.whyProblem,
        whatTried: input.whatTried,
        whyExistingNotWork: input.whyExistingNotWork,
        descriptor: input.descriptor,
        application: input.application,
        desiredOutcome: input.desiredOutcome,
        credibility: input.credibility,
        socialProof: input.socialProof,
      });
    }),


  /**
   * List all mechanism sets for current user
   */
  list: protectedProcedure
    .input(z.object({ serviceId: z.number() }).optional())
    .query(async ({ ctx, input }) => {
      const sets = await getHeroMechanismSetsByUser(ctx.user.id);
      if (input?.serviceId == null) return sets;
      return sets.filter((s: any) => s.serviceId === input.serviceId);
    }),

  // Get single mechanism by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [mechanism] = await db
        .select()
        .from(heroMechanisms)
        .where(
          and(eq(heroMechanisms.id, input.id), eq(heroMechanisms.userId, ctx.user.id))
        )
        .limit(1);

      if (!mechanism) {
        throw new Error("Mechanism not found");
      }

      return mechanism;
    }),

  /**
   * Get all mechanisms from a specific set
   */
  getBySetId: protectedProcedure
    .input(z.object({ mechanismSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const mechanisms = await getHeroMechanismsBySetId(input.mechanismSetId, ctx.user.id);
      return mechanisms;
    }),

  /**
   * Rate a mechanism (thumbs up/down)
   */
  rate: protectedProcedure
    .input(
      z.object({
        mechanismId: z.number(),
        rating: z.number().min(-1).max(1), // -1 = down, 0 = neutral, 1 = up
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateHeroMechanismRating(input.mechanismId, ctx.user.id, input.rating);
      return { success: true };
    }),

  /**
   * Toggle favorite status
   */
  toggleFavorite: protectedProcedure
    .input(
      z.object({
        mechanismId: z.number(),
        isFavorite: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await toggleHeroMechanismFavorite(input.mechanismId, ctx.user.id, input.isFavorite);
      return { success: true };
    }),

  /**
   * Delete entire mechanism set
   */
  delete: protectedProcedure
    .input(z.object({ mechanismSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteHeroMechanismSet(input.mechanismSetId, ctx.user.id);
      return { success: true };
    }),

  /**
   * generateAsync — background job version of generate.
   * Immediately returns a jobId; generation runs via setImmediate outside the
   * HTTP request cycle so platform-level proxy timeouts cannot kill it.
   * Client polls GET /api/jobs/:jobId every 5 s for completion.
   * Auto Mode Phase B1: thin wrapper around runHeroMechanismGeneration.
   */
  generateAsync: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        campaignId: z.number().optional(),
        targetMarket: z.string().max(5000),
        pressingProblem: z.string().max(5000),
        whyProblem: z.string().max(5000),
        whatTried: z.string().max(5000),
        whyExistingNotWork: z.string().max(5000),
        descriptor: z.string().max(5000).optional(),
        application: z.string().max(5000).optional(),
        desiredOutcome: z.string().max(5000),
        credibility: z.string().max(5000),
        socialProof: z.string().max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(ctx.user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "heroMechanisms");
        if (user.heroMechanismGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} Hero Mechanism sets. Upgrade to generate more.`,
          });
        }
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const capturedInput = { ...input };
      const capturedUserId = user.id;

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const result = await runHeroMechanismGeneration({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId,
            targetMarket: capturedInput.targetMarket,
            pressingProblem: capturedInput.pressingProblem,
            whyProblem: capturedInput.whyProblem,
            whatTried: capturedInput.whatTried,
            whyExistingNotWork: capturedInput.whyExistingNotWork,
            descriptor: capturedInput.descriptor,
            application: capturedInput.application,
            desiredOutcome: capturedInput.desiredOutcome,
            credibility: capturedInput.credibility,
            socialProof: capturedInput.socialProof,
          });
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");
          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify(result) })
            .where(eq(jobs.id, jobId));
          console.log(`[heroMechanisms.generateAsync] Job ${jobId} completed, mechanismSetId: ${result.mechanismSetId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[heroMechanisms.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),
});
