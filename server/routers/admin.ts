import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Admin-only middleware
 * Checks if the authenticated user has admin role
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

export const adminRouter = router({
  /**
   * Get all users with their quota usage
   */
  getAllUsers: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const allUsers = await db.select().from(users);
    return allUsers;
  }),

  /**
   * Get analytics data
   */
  getAnalytics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const allUsers = await db.select().from(users);

    // Count users by tier
    const usersByTier = {
      trial: allUsers.filter((u) => u.subscriptionTier === "trial" || !u.subscriptionTier).length,
      pro: allUsers.filter((u) => u.subscriptionTier === "pro").length,
      agency: allUsers.filter((u) => u.subscriptionTier === "agency").length,
    };

    // Calculate total generations per generator type
    const popularGenerators = {
      headlines: allUsers.reduce((sum, u) => sum + u.headlineGeneratedCount, 0),
      hvco: allUsers.reduce((sum, u) => sum + u.hvcoGeneratedCount, 0),
      heroMechanisms: allUsers.reduce((sum, u) => sum + u.heroMechanismGeneratedCount, 0),
      icp: allUsers.reduce((sum, u) => sum + u.icpGeneratedCount, 0),
      adCopy: allUsers.reduce((sum, u) => sum + u.adCopyGeneratedCount, 0),
      email: allUsers.reduce((sum, u) => sum + u.emailSeqGeneratedCount, 0),
      whatsapp: allUsers.reduce((sum, u) => sum + u.whatsappSeqGeneratedCount, 0),
      landingPages: allUsers.reduce((sum, u) => sum + u.landingPageGeneratedCount, 0),
      offers: allUsers.reduce((sum, u) => sum + u.offerGeneratedCount, 0),
    };

    return {
      usersByTier,
      popularGenerators,
      totalUsers: allUsers.length,
    };
  }),

  /**
   * Reset user quota counts to 0
   */
  resetUserQuota: adminProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(users)
        .set({
          headlineGeneratedCount: 0,
          hvcoGeneratedCount: 0,
          heroMechanismGeneratedCount: 0,
          icpGeneratedCount: 0,
          adCopyGeneratedCount: 0,
          emailSeqGeneratedCount: 0,
          whatsappSeqGeneratedCount: 0,
          landingPageGeneratedCount: 0,
          offerGeneratedCount: 0,
        })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  /**
   * Override user subscription tier
   */
  overrideUserTier: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        newTier: z.enum(["trial", "pro", "agency"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(users)
        .set({
          subscriptionTier: input.newTier,
        })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),
});
