import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userOnboarding } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const onboardingRouter = router({
  /**
   * Get onboarding status for current user
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");
    const [status] = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, ctx.user.id))
      .limit(1);

    // Create onboarding record if it doesn't exist
    if (!status) {
      const [newStatus] = await db.insert(userOnboarding).values({
        userId: ctx.user.id,
        currentStep: 1,
        completed: false,
        skipped: false,
      });

      return {
        id: newStatus.insertId,
        userId: ctx.user.id,
        currentStep: 1,
        completed: false,
        serviceId: null,
        icpId: null,
        headlineSetId: null,
        campaignId: null,
        skipped: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };
    }

    return status;
  }),

  /**
   * Update current step and save progress
   */
  updateStep: protectedProcedure
    .input(
      z.object({
        step: z.number().min(1).max(5),
        data: z.object({
          serviceId: z.number().optional(),
          icpId: z.string().optional(),
          headlineSetId: z.string().optional(),
          campaignId: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      await db
        .update(userOnboarding)
        .set({
          currentStep: input.step,
          serviceId: input.data.serviceId,
          icpId: input.data.icpId,
          headlineSetId: input.data.headlineSetId,
          campaignId: input.data.campaignId,
        })
        .where(eq(userOnboarding.userId, ctx.user.id));

      return { success: true };
    }),

  /**
   * Mark onboarding as complete
   */
  complete: protectedProcedure
    .input(
      z.object({
        serviceId: z.number().optional(),
        icpId: z.string().optional(),
        headlineSetId: z.string().optional(),
        campaignId: z.number().optional(),
        skipped: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      await db
        .update(userOnboarding)
        .set({
          completed: true,
          completedAt: new Date(),
          skipped: input.skipped || false,
          serviceId: input.serviceId,
          icpId: input.icpId,
          headlineSetId: input.headlineSetId,
          campaignId: input.campaignId,
        })
        .where(eq(userOnboarding.userId, ctx.user.id));

      return { success: true };
    }),

  /**
   * Reset onboarding (for testing or restart)
   */
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    await db
      .update(userOnboarding)
      .set({
        currentStep: 1,
        completed: false,
        completedAt: null,
        skipped: false,
        serviceId: null,
        icpId: null,
        headlineSetId: null,
        campaignId: null,
      })
      .where(eq(userOnboarding.userId, ctx.user.id));

    return { success: true };
  }),
});
