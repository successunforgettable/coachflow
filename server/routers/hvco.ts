import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getHvcoSetsByUser,
  getHvcoTitlesBySetId,
  updateHvcoTitleRating,
  toggleHvcoTitleFavorite,
  deleteHvcoSet,
} from "../db";
import { getDb } from "../db";
import { jobs, hvcoTitles } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { runHvcoGeneration } from "../hvcoGenerator";

/**
 * HVCO Titles Router - Industry Standard
 * 
 * Generates 4 tabs of title variations:
 * - Long Titles (~20 alliterative 3-5 word titles)
 * - Short Titles (~20 concise titles)
 * - Power Mode Titles (~30 extra variations)
 * - Subheadlines (~20 supporting subheadlines)
 * 
 * All titles follow alliteration pattern: [Action/Benefit] [Crypto/Money Word] [Blueprint/Formula/Method]
 */

export const hvcoRouter = router({
  /**
   * Generate HVCO Titles
   * Creates 4 tabs with ~20-30 title variations each
   * Auto Mode Phase B1: thin wrapper around runHvcoGeneration.
   */
  generate: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        campaignId: z.number().optional(),
        targetMarket: z.string().max(5000),
        hvcoTopic: z.string().max(5000),
        powerMode: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "hvco");
        if (user.hvcoGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} HVCO title sets. Upgrade to generate more.`,
          });
        }
      }
      return await runHvcoGeneration({
        userId: user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId,
        targetMarket: input.targetMarket,
        hvcoTopic: input.hvcoTopic,
        powerMode: input.powerMode,
      });
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; HVCO generation runs via setImmediate.
   * Auto Mode Phase B1: thin wrapper around runHvcoGeneration.
   */
  generateAsync: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      campaignId: z.number().optional(),
      targetMarket: z.string().max(5000),
      hvcoTopic: z.string().max(5000),
      powerMode: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "hvco");
        if (user.hvcoGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} HVCO title sets. Upgrade to generate more.` });
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
          const result = await runHvcoGeneration({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId,
            targetMarket: capturedInput.targetMarket,
            hvcoTopic: capturedInput.hvcoTopic,
            powerMode: capturedInput.powerMode,
          });
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");
          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify(result) })
            .where(eq(jobs.id, jobId));
          console.log(`[hvco.generateAsync] Job ${jobId} completed, hvcoSetId: ${result.hvcoSetId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[hvco.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  /**
   * List all HVCO sets for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const sets = await getHvcoSetsByUser(ctx.user.id);
    return sets;
  }),

  // Get single HVCO title by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [title] = await db
        .select()
        .from(hvcoTitles)
        .where(
          and(eq(hvcoTitles.id, input.id), eq(hvcoTitles.userId, ctx.user.id))
        )
        .limit(1);

      if (!title) {
        throw new Error("HVCO title not found");
      }

      return title;
    }),

  /**
   * Get all titles from a specific HVCO set
   */
  getBySetId: protectedProcedure
    .input(z.object({ hvcoSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const titles = await getHvcoTitlesBySetId(input.hvcoSetId, ctx.user.id);
      return titles;
    }),

  /**
   * Rate a title (thumbs up/down)
   */
  rate: protectedProcedure
    .input(
      z.object({
        titleId: z.number(),
        rating: z.number().min(-1).max(1), // -1 = down, 0 = neutral, 1 = up
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateHvcoTitleRating(input.titleId, ctx.user.id, input.rating);
      return { success: true };
    }),

  /**
   * Toggle favorite status
   */
  toggleFavorite: protectedProcedure
    .input(
      z.object({
        titleId: z.number(),
        isFavorite: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await toggleHvcoTitleFavorite(input.titleId, ctx.user.id, input.isFavorite);
      return { success: true };
    }),

  /**
   * Delete entire HVCO set
   */
  delete: protectedProcedure
    .input(z.object({ hvcoSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteHvcoSet(input.hvcoSetId, ctx.user.id);
      return { success: true };
    }),
});
