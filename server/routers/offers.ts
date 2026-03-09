import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { offers, services, idealCustomerProfiles, sourceOfTruth, campaigns, jobs } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateAllOfferAngles } from "../offersGenerator";
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
  generate: protectedProcedure
    .input(generateOfferSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check and reset quota if user's anniversary date has passed
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      // Superusers have unlimited quota
      if (ctx.user.role !== "superuser") {
        // Check quota limit
        const limit = getQuotaLimit(ctx.user.subscriptionTier, "offers");
        if (ctx.user.offerGeneratedCount >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your monthly limit of ${limit} offers. Upgrade to generate more.`,
          });
        }
      }

      // Get service details with social proof (Issue 2 fix)
      const [service] = await db
        .select()
        .from(services)
        .where(
          and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id))
        )
        .limit(1);

      if (!service) {
        throw new Error("Service not found");
      }

      // Campaign fetch — Item 1.1b (icpId support)
      let campaignRecord;
      if (input.campaignId) {
        [campaignRecord] = await db.select().from(campaigns)
          .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, ctx.user.id))).limit(1);
      }

      // ICP fetch — Item 1.1b: campaign-specific ICP first, serviceId fallback
      let icp;
      if (campaignRecord?.icpId) {
        [icp] = await db.select().from(idealCustomerProfiles)
          .where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1);
      }
      if (!icp) {
        [icp] = await db.select().from(idealCustomerProfiles)
          .where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
      }

      const icpContext = icp ? [
        'IDEAL CUSTOMER PROFILE — use this to make every offer specific and targeted:',
        icp.objections ? `Their objections to buying: ${icp.objections}` : '',
        icp.buyingTriggers ? `What makes them buy: ${icp.buyingTriggers}` : '',
        icp.implementationBarriers ? `What stops them from taking action: ${icp.implementationBarriers}` : '',
        icp.successMetrics ? `How they measure success: ${icp.successMetrics}` : '',
      ].filter(Boolean).join('\n').trim() : '';

      // SOT query — Item 1.4
      const [sot] = await db
        .select()
        .from(sourceOfTruth)
        .where(eq(sourceOfTruth.userId, ctx.user.id))
        .limit(1);

      const sotLines = sot ? [
        sot.coreOffer        ? `Core offer: ${sot.coreOffer}` : '',
        sot.targetAudience   ? `Target audience: ${sot.targetAudience}` : '',
        sot.mainPainPoint    ? `Main pain point: ${sot.mainPainPoint}` : '',
        sot.mainBenefits     ? `Main benefits: ${sot.mainBenefits}` : '',
        sot.uniqueValue      ? `Unique value: ${sot.uniqueValue}` : '',
        sot.idealCustomerAvatar ? `Ideal customer: ${sot.idealCustomerAvatar}` : '',
      ].filter(Boolean) : [];

      const sotContext = sotLines.length > 0
        ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
        : '';

      // Extract real social proof data
      const socialProof = {
        hasCustomers: !!service.totalCustomers && service.totalCustomers > 0,
        customerCount: service.totalCustomers || 0,
      };

      // Append SOT + ICP context to targetCustomer so it flows into the helper prompt — Item 1.2 + 1.4
      const enrichedTargetCustomer = sotContext || icpContext
        ? `${sotContext ? `${sotContext}\n\n` : ''}${service.targetCustomer || 'Target Customer'}${icpContext ? `\n\n${icpContext}` : ''}`
        : service.targetCustomer || 'Target Customer';

      // Generate all 3 angles in parallel with social proof
      const allAngles = await generateAllOfferAngles(
        service.name,
        service.description || "",
        enrichedTargetCustomer,
        service.mainBenefit || "Main Benefit",
        input.offerType,
        socialProof
      );

      // Save to database
      const insertResult: any = await db.insert(offers).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId || null,
        productName: service.name,
        offerType: input.offerType,
        godfatherAngle: allAngles.godfather,
        freeAngle: allAngles.free,
        dollarAngle: allAngles.dollar,
        activeAngle: "godfather",
        rating: 0,
      });

      // Fetch the created offer
      const [newOffer] = await db
        .select()
        .from(offers)
        .where(eq(offers.id, insertResult[0].insertId))
        .limit(1);

      return newOffer;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; offer generation runs via setImmediate.
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
      const [service] = await db.select().from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, user.id))).limit(1);
      if (!service) throw new Error("Service not found");

      let campaignRecord: any;
      if (input.campaignId) {
        [campaignRecord] = await db.select().from(campaigns)
          .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, user.id))).limit(1);
      }
      let icp: any;
      if (campaignRecord?.icpId) {
        [icp] = await db.select().from(idealCustomerProfiles)
          .where(eq(idealCustomerProfiles.id, campaignRecord.icpId)).limit(1);
      }
      if (!icp) {
        [icp] = await db.select().from(idealCustomerProfiles)
          .where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
      }
      const [sot] = await db.select().from(sourceOfTruth)
        .where(eq(sourceOfTruth.userId, user.id)).limit(1);

      const capturedInput = { ...input };
      const capturedUserId = user.id;
      const capturedService = { ...service };
      const capturedIcp = icp ? { ...icp } : undefined;
      const capturedSot = sot ? { ...sot } : undefined;

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      setImmediate(async () => {
        try {
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");

          const icpContext = capturedIcp ? [
            'IDEAL CUSTOMER PROFILE — use this to make every offer specific and targeted:',
            capturedIcp.objections ? `Their objections to buying: ${capturedIcp.objections}` : '',
            capturedIcp.buyingTriggers ? `What makes them buy: ${capturedIcp.buyingTriggers}` : '',
            capturedIcp.implementationBarriers ? `What stops them from taking action: ${capturedIcp.implementationBarriers}` : '',
            capturedIcp.successMetrics ? `How they measure success: ${capturedIcp.successMetrics}` : '',
          ].filter(Boolean).join('\n').trim() : '';

          const sotLines = capturedSot ? [
            capturedSot.coreOffer ? `Core offer: ${capturedSot.coreOffer}` : '',
            capturedSot.targetAudience ? `Target audience: ${capturedSot.targetAudience}` : '',
            capturedSot.mainPainPoint ? `Main pain point: ${capturedSot.mainPainPoint}` : '',
            capturedSot.mainBenefits ? `Main benefits: ${capturedSot.mainBenefits}` : '',
            capturedSot.uniqueValue ? `Unique value: ${capturedSot.uniqueValue}` : '',
            capturedSot.idealCustomerAvatar ? `Ideal customer: ${capturedSot.idealCustomerAvatar}` : '',
          ].filter(Boolean) : [];
          const sotContext = sotLines.length > 0
            ? ['BRAND CONTEXT — this is the approved brand voice. All copy must be consistent with this:', ...sotLines].join('\n')
            : '';

          const socialProof = { hasCustomers: !!capturedService.totalCustomers && capturedService.totalCustomers > 0, customerCount: capturedService.totalCustomers || 0 };
          const enrichedTargetCustomer = sotContext || icpContext
            ? `${sotContext ? `${sotContext}\n\n` : ''}${capturedService.targetCustomer || 'Target Customer'}${icpContext ? `\n\n${icpContext}` : ''}`
            : capturedService.targetCustomer || 'Target Customer';

          const allAngles = await generateAllOfferAngles(
            capturedService.name,
            capturedService.description || "",
            enrichedTargetCustomer,
            capturedService.mainBenefit || "Main Benefit",
            capturedInput.offerType,
            socialProof
          );

          const insertResult: any = await bgDb.insert(offers).values({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId || null,
            productName: capturedService.name,
            offerType: capturedInput.offerType,
            godfatherAngle: allAngles.godfather,
            freeAngle: allAngles.free,
            dollarAngle: allAngles.dollar,
            activeAngle: "godfather",
            rating: 0,
          });

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ offerId: insertResult[0].insertId }) })
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
