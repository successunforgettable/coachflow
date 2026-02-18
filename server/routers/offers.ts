import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { offers, services } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateAllOfferAngles } from "../offersGenerator";
import { getQuotaLimit } from "../quotaLimits";
import { TRPCError } from "@trpc/server";

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

      // Check quota limit
      const limit = getQuotaLimit(ctx.user.subscriptionTier, "offers");
      if (ctx.user.offerGeneratedCount >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've reached your monthly limit of ${limit} offers. Upgrade to generate more.`,
        });
      }

      // Get service details
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

      // Generate all 3 angles in parallel
      const allAngles = await generateAllOfferAngles(
        service.name,
        service.description || "",
        service.targetCustomer || "Target Customer",
        service.mainBenefit || "Main Benefit",
        input.offerType
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
