import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { adCopy, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { runAdCopyGeneration } from "../adCopyGenerator";

const generateAdCopySchema = z.object({
  serviceId: z.coerce.number(),
  campaignId: z.number().optional(),
  adType: z.enum(["lead_gen", "ecommerce"]).default("lead_gen"),
  // 17 fields
  adStyle: z.string(),
  adCallToAction: z.string(),
  targetMarket: z.string(),
  productCategory: z.string(),
  specificProductName: z.string(),
  pressingProblem: z.string(),
  desiredOutcome: z.string(),
  uniqueMechanism: z.string().optional(),
  listBenefits: z.string().optional(),
  specificTechnology: z.string().optional(),
  scientificStudies: z.string().optional(),
  credibleAuthority: z.string().optional(),
  featuredIn: z.string().optional(),
  numberOfReviews: z.string().optional(),
  averageReviewRating: z.string().optional(),
  totalCustomers: z.string().optional(),
  testimonials: z.string().optional(),
  powerMode: z.boolean().optional(),
});

const updateAdCopySchema = z.object({
  id: z.number(),
  content: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
});

export const adCopyRouter = router({
  // List all ad sets for current user
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

      const conditions = [eq(adCopy.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(adCopy.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(adCopy.campaignId, input.campaignId));
      }

      const allAds = await db
        .select()
        .from(adCopy)
        .where(and(...conditions))
        .orderBy(desc(adCopy.createdAt));

      // Group by adSetId
      const adSets = new Map<string, any>();
      for (const ad of allAds) {
        if (!adSets.has(ad.adSetId)) {
          adSets.set(ad.adSetId, {
            adSetId: ad.adSetId,
            adType: ad.adType,
            serviceId: ad.serviceId,
            campaignId: ad.campaignId,
            // 17 fields
            adStyle: ad.adStyle,
            adCallToAction: ad.adCallToAction,
            targetMarket: ad.targetMarket,
            productCategory: ad.productCategory,
            specificProductName: ad.specificProductName,
            pressingProblem: ad.pressingProblem,
            desiredOutcome: ad.desiredOutcome,
            uniqueMechanism: ad.uniqueMechanism,
            listBenefits: ad.listBenefits,
            specificTechnology: ad.specificTechnology,
            scientificStudies: ad.scientificStudies,
            credibleAuthority: ad.credibleAuthority,
            featuredIn: ad.featuredIn,
            numberOfReviews: ad.numberOfReviews,
            averageReviewRating: ad.averageReviewRating,
            totalCustomers: ad.totalCustomers,
            testimonials: ad.testimonials,
            createdAt: ad.createdAt,
            headlines: [],
            bodies: [],
            links: [],
          });
        }
        const adSet = adSets.get(ad.adSetId);
        if (ad.contentType === "headline") adSet.headlines.push(ad);
        else if (ad.contentType === "body") adSet.bodies.push(ad);
        else if (ad.contentType === "link") adSet.links.push(ad);
      }

      return Array.from(adSets.values());
    }),

  // Get single ad set by adSetId
  getByAdSetId: protectedProcedure
    .input(z.object({ adSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rawAds = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.adSetId, input.adSetId), eq(adCopy.userId, ctx.user.id)))
        .orderBy(desc(adCopy.createdAt));

      if (rawAds.length === 0) {
        throw new Error("Ad set not found");
      }

      // Normalise violationReasons from Drizzle's `unknown` JSON to
      // `string[] | null` so the type flows end-to-end — mirrors
      // headlines.getBySetId. (W5 Phase 2.)
      const ads = rawAds.map(a => ({
        ...a,
        violationReasons:
          Array.isArray((a as { violationReasons?: unknown }).violationReasons)
            ? ((a as { violationReasons?: unknown[] }).violationReasons ?? []).filter((v): v is string => typeof v === "string")
            : null,
      }));

      const adSet = {
        adSetId: ads[0].adSetId,
        adType: ads[0].adType,
        serviceId: ads[0].serviceId,
        campaignId: ads[0].campaignId,
        // 17 fields
        adStyle: ads[0].adStyle,
        adCallToAction: ads[0].adCallToAction,
        targetMarket: ads[0].targetMarket,
        productCategory: ads[0].productCategory,
        specificProductName: ads[0].specificProductName,
        pressingProblem: ads[0].pressingProblem,
        desiredOutcome: ads[0].desiredOutcome,
        uniqueMechanism: ads[0].uniqueMechanism,
        listBenefits: ads[0].listBenefits,
        specificTechnology: ads[0].specificTechnology,
        scientificStudies: ads[0].scientificStudies,
        credibleAuthority: ads[0].credibleAuthority,
        featuredIn: ads[0].featuredIn,
        numberOfReviews: ads[0].numberOfReviews,
        averageReviewRating: ads[0].averageReviewRating,
        totalCustomers: ads[0].totalCustomers,
        testimonials: ads[0].testimonials,
        createdAt: ads[0].createdAt,
        headlines: ads.filter(a => a.contentType === "headline"),
        bodies: ads.filter(a => a.contentType === "body"),
        links: ads.filter(a => a.contentType === "link"),
      };

      return adSet;
    }),

  // Generate ad copy using AI (Industry standard: 15 headlines, 15 bodies, 15 links)
  // Auto Mode Phase B1: thin wrapper around runAdCopyGeneration.
  generate: protectedProcedure
    .input(generateAdCopySchema)
    .mutation(async ({ ctx, input }) => {
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      if (ctx.user.role !== "superuser") {
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "adCopy");
        if (ctx.user.adCopyGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} ad copy sets. Upgrade to generate more.`,
          });
        }
      }

      return await runAdCopyGeneration({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId,
        adType: input.adType,
        adStyle: input.adStyle,
        adCallToAction: input.adCallToAction,
        targetMarket: input.targetMarket,
        productCategory: input.productCategory,
        specificProductName: input.specificProductName,
        pressingProblem: input.pressingProblem,
        desiredOutcome: input.desiredOutcome,
        uniqueMechanism: input.uniqueMechanism,
        listBenefits: input.listBenefits,
        specificTechnology: input.specificTechnology,
        scientificStudies: input.scientificStudies,
        credibleAuthority: input.credibleAuthority,
        featuredIn: input.featuredIn,
        numberOfReviews: input.numberOfReviews,
        averageReviewRating: input.averageReviewRating,
        totalCustomers: input.totalCustomers,
        testimonials: input.testimonials,
        powerMode: input.powerMode,
        userSubscriptionTier: ctx.user.subscriptionTier ?? null,
        userRole: ctx.user.role ?? null,
      });
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; ad copy generation runs via setImmediate.
   * Auto Mode Phase B1: thin wrapper around runAdCopyGeneration.
   * Network-error retry-once-after-30s preserved (each attempt delegates to runX).
   */
  generateAsync: protectedProcedure
    .input(generateAdCopySchema)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;
      await checkAndResetQuotaIfNeeded(user.id);
      if (user.role !== "superuser") {
        const limit = getQuotaLimit(user.subscriptionTier, "adCopy");
        if (user.adCopyGeneratedCount >= limit) {
          throw new TRPCError({ code: "FORBIDDEN", message: `You've reached your monthly limit of ${limit} ad copy sets. Upgrade to generate more.` });
        }
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const capturedInput = { ...input };
      const capturedUserId = user.id;
      const capturedUserTier = user.subscriptionTier ?? null;
      const capturedUserRole = user.role ?? null;

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      const callRunX = async () => await runAdCopyGeneration({
        userId: capturedUserId,
        serviceId: capturedInput.serviceId,
        campaignId: capturedInput.campaignId,
        adType: capturedInput.adType,
        adStyle: capturedInput.adStyle,
        adCallToAction: capturedInput.adCallToAction,
        targetMarket: capturedInput.targetMarket,
        productCategory: capturedInput.productCategory,
        specificProductName: capturedInput.specificProductName,
        pressingProblem: capturedInput.pressingProblem,
        desiredOutcome: capturedInput.desiredOutcome,
        uniqueMechanism: capturedInput.uniqueMechanism,
        listBenefits: capturedInput.listBenefits,
        specificTechnology: capturedInput.specificTechnology,
        scientificStudies: capturedInput.scientificStudies,
        credibleAuthority: capturedInput.credibleAuthority,
        featuredIn: capturedInput.featuredIn,
        numberOfReviews: capturedInput.numberOfReviews,
        averageReviewRating: capturedInput.averageReviewRating,
        totalCustomers: capturedInput.totalCustomers,
        testimonials: capturedInput.testimonials,
        powerMode: capturedInput.powerMode,
        userSubscriptionTier: capturedUserTier,
        userRole: capturedUserRole,
      });

      setImmediate(async () => {
        try {
          const result = await callRunX();
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");
          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify(result) })
            .where(eq(jobs.id, jobId));
          console.log(`[adCopy.generateAsync] Job ${jobId} completed, adSetId: ${result.adSetId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // Network-error auto-retry (once, 30-second delay) — preserved from pre-B1.
          const isNetworkError = errorMessage.includes('fetch failed') || errorMessage.includes('AbortError') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('network timeout');
          if (isNetworkError) {
            try {
              const checkDb = await getDb();
              const [currentJob] = checkDb ? await checkDb.select().from(jobs).where(eq(jobs.id, jobId)).limit(1) : [];
              const retryCount = (currentJob as any)?.retryCount ?? 0;
              if (retryCount < 1) {
                console.warn(`[adCopy.generateAsync] Job ${jobId} network error (attempt ${retryCount + 1}), retrying in 30s:`, errorMessage);
                if (checkDb) await checkDb.update(jobs).set({ retryCount: retryCount + 1, progress: JSON.stringify({ step: 0, total: 1, label: 'Network hiccup — retrying in 30s…' }) }).where(eq(jobs.id, jobId));
                await new Promise(resolve => setTimeout(resolve, 30_000));
                setImmediate(async () => {
                  try {
                    const retryResult = await callRunX();
                    const retryDb = await getDb();
                    if (!retryDb) throw new Error('Database not available on retry');
                    await retryDb.update(jobs).set({ status: 'complete', result: JSON.stringify(retryResult) }).where(eq(jobs.id, jobId));
                    console.log(`[adCopy.generateAsync] Job ${jobId} retry succeeded, adSetId: ${retryResult.adSetId}`);
                  } catch (retryErr: unknown) {
                    const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                    console.error(`[adCopy.generateAsync] Job ${jobId} retry also failed:`, retryMsg);
                    try { const fd = await getDb(); if (fd) await fd.update(jobs).set({ status: 'failed', error: retryMsg.slice(0, 1024) }).where(eq(jobs.id, jobId)); } catch { /* ignore */ }
                  }
                });
                return;
              }
            } catch { /* if retry setup fails, fall through to permanent failure */ }
          }
          console.error(`[adCopy.generateAsync] Job ${jobId} failed (permanent):`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Update ad copy
  update: protectedProcedure
    .input(updateAdCopySchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.id, id), eq(adCopy.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new Error("Ad copy not found");
      }

      await db
        .update(adCopy)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(adCopy.id, id));

      // Fetch updated ad
      const [updated] = await db
        .select()
        .from(adCopy)
        .where(eq(adCopy.id, id))
        .limit(1);

      return updated;
    }),

  // Delete entire ad set
  deleteAdSet: protectedProcedure
    .input(z.object({ adSetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.adSetId, input.adSetId), eq(adCopy.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new Error("Ad set not found");
      }

      await db.delete(adCopy).where(eq(adCopy.adSetId, input.adSetId));

      return { success: true };
    }),

  // Get the most recent ad set for a given serviceId (V2 results panel revisit)
  getLatestByServiceId: protectedProcedure
    .input(z.object({ serviceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Find the most recent adSetId for this user + service
      const [latest] = await db
        .select({ adSetId: adCopy.adSetId })
        .from(adCopy)
        .where(and(eq(adCopy.userId, ctx.user.id), eq(adCopy.serviceId, input.serviceId)))
        .orderBy(desc(adCopy.createdAt))
        .limit(1);
      if (!latest) return null;
      const ads = await db
        .select()
        .from(adCopy)
        .where(and(eq(adCopy.adSetId, latest.adSetId), eq(adCopy.userId, ctx.user.id)))
        .orderBy(desc(adCopy.createdAt));
      if (ads.length === 0) return null;
      return {
        adSetId: ads[0].adSetId,
        adType: ads[0].adType,
        serviceId: ads[0].serviceId,
        campaignId: ads[0].campaignId,
        adStyle: ads[0].adStyle,
        adCallToAction: ads[0].adCallToAction,
        targetMarket: ads[0].targetMarket,
        productCategory: ads[0].productCategory,
        specificProductName: ads[0].specificProductName,
        pressingProblem: ads[0].pressingProblem,
        desiredOutcome: ads[0].desiredOutcome,
        createdAt: ads[0].createdAt,
        headlines: ads.filter(a => a.contentType === "headline"),
        bodies:    ads.filter(a => a.contentType === "body"),
        links:     ads.filter(a => a.contentType === "link"),
      };
    }),
});
