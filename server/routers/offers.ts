import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { offers, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { runOfferGeneration } from "../offersGenerator";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";

const generateOfferSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  offerType: z.enum(["standard", "premium", "vip"]),
});

const updateActiveAngleSchema = z.object({
  id: z.number(),
  activeAngle: z.enum(["godfather", "free", "dollar"]),
});

const updateRatingSchema = z.object({
  id: z.number(),
  rating: z.number().min(0).max(5),
});

export const offersRouter = router({
  // List all offers for current user
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

      const conditions = [eq(offers.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(offers.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(offers.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(offers)
        .where(and(...conditions))
        .orderBy(desc(offers.createdAt));
    }),

  // Get single offer by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [offer] = await db
        .select()
        .from(offers)
        .where(
          and(eq(offers.id, input.id), eq(offers.userId, ctx.user.id))
        )
        .limit(1);

      if (!offer) {
        throw new Error("Offer not found");
      }

      return offer;
    }),

  // Generate offer with all 3 angles using AI (Godfather, Free, Dollar)
  // Auto Mode Phase B1: thin wrapper around runOfferGeneration. Quota
  // checks live here in the tRPC layer; the gen-core itself is in
  // server/offersGenerator.ts and is callable directly by the orchestrator.
  generate: protectedProcedure
    .input(generateOfferSchema)
    .mutation(async ({ ctx, input }) => {
      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "offers");
        if (ctx.user.offerGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} offers. Upgrade to generate more.`,
          });
        }
      }

      const { offerId } = await runOfferGeneration({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId,
        offerType: input.offerType,
      });

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [newOffer] = await db
        .select()
        .from(offers)
        .where(eq(offers.id, offerId))
        .limit(1);

      return newOffer;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; offer generation runs via setImmediate.
   * Auto Mode Phase B1: thin wrapper around runOfferGeneration.
   */
  generateAsync: protectedProcedure
    .input(generateOfferSchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "offers");
        if (user.offerGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} offers. Upgrade to generate more.` });
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
          const result = await runOfferGeneration({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId,
            offerType: capturedInput.offerType,
          });
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");
          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ offerId: result.offerId }) })
            .where(eq(jobs.id, jobId));
          console.log(`[offers.generateAsync] Job ${jobId} completed`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[offers.generateAsync] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Update active angle
  updateActiveAngle: protectedProcedure
    .input(updateActiveAngleSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(offers)
        .where(
          and(eq(offers.id, input.id), eq(offers.userId, ctx.user.id))
        )
        .limit(1);

      if (!existing) {
        throw new Error("Offer not found");
      }

      await db
        .update(offers)
        .set({
          activeAngle: input.activeAngle,
          updatedAt: new Date(),
        })
        .where(eq(offers.id, input.id));

      // Fetch updated offer
      const [updated] = await db
        .select()
        .from(offers)
        .where(eq(offers.id, input.id))
        .limit(1);

      return updated;
    }),

  // Update rating
  update: protectedProcedure
    .input(updateRatingSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(offers)
        .where(
          and(eq(offers.id, input.id), eq(offers.userId, ctx.user.id))
        )
        .limit(1);

      if (!existing) {
        throw new Error("Offer not found");
      }

      await db
        .update(offers)
        .set({
          rating: input.rating,
          updatedAt: new Date(),
        })
        .where(eq(offers.id, input.id));

      // Fetch updated offer
      const [updated] = await db
        .select()
        .from(offers)
        .where(eq(offers.id, input.id))
        .limit(1);

      return updated;
    }),

  // Delete offer
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(offers)
        .where(
          and(eq(offers.id, input.id), eq(offers.userId, ctx.user.id))
        )
        .limit(1);

      if (!existing) {
        throw new Error("Offer not found");
      }

      await db.delete(offers).where(eq(offers.id, input.id));

      return { success: true };
    }),
});
