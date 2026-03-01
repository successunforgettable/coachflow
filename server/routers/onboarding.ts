import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userOnboarding, users } from "../../drizzle/schema";
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
        offerId: null,
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
        step: z.number().min(1).max(6),
        data: z.object({
          serviceId: z.number().optional(),
          icpId: z.string().optional(),
          offerId: z.number().optional(),
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
          offerId: input.data.offerId,
          headlineSetId: input.data.headlineSetId,
          campaignId: input.data.campaignId,
        })
        .where(eq(userOnboarding.userId, ctx.user.id));

      return { success: true };
    }),

  /**
   * Mark onboarding as complete — sets both user_onboarding.completed and users.onboardingComplete.
   * Called from Stage 4 ("Start from Step 1" or "I'll explore on my own").
   */
  setComplete: protectedProcedure
    .input(
      z.object({
        serviceId: z.number().optional(),
        campaignId: z.number().optional(),
        headlineSetId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // Update user_onboarding table
      await db
        .update(userOnboarding)
        .set({
          completed: true,
          completedAt: new Date(),
          skipped: false,
          serviceId: input.serviceId,
          campaignId: input.campaignId,
          headlineSetId: input.headlineSetId,
        })
        .where(eq(userOnboarding.userId, ctx.user.id));

      // Update users table — fast single-field check on login without a join
      await db
        .update(users)
        .set({
          onboardingComplete: true,
          onboardingStage: 5,
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  /**
   * Update onboarding stage on users table (called at end of each stage)
   */
  updateStageFlag: protectedProcedure
    .input(z.object({ stage: z.number().min(1).max(5) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      await db
        .update(users)
        .set({ onboardingStage: input.stage })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  /**
   * Mark onboarding as complete (legacy — kept for backward compatibility)
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

    // Also reset users table flags
    await db
      .update(users)
      .set({
        onboardingComplete: false,
        onboardingStage: 1,
      })
      .where(eq(users.id, ctx.user.id));

    return { success: true };
  }),
});
