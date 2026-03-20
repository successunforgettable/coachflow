import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { users } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";

export const userRouter = router({
  /**
   * Get user preferences (welcome banner dismissal, etc.)
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const user = await db.select({
      dismissedWelcomeBanner: users.dismissedWelcomeBanner,
    }).from(users).where(eq(users.id, ctx.user.id)).limit(1);

    if (!user[0]) {
      throw new Error("User not found");
    }

    return user[0];
  }),

  /**
   * Dismiss the post-onboarding welcome banner
   */
  dismissWelcomeBanner: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    await db.update(users)
      .set({ dismissedWelcomeBanner: true })
      .where(eq(users.id, ctx.user.id));

    return { success: true };
  }),

  /**
   * Get coach profile fields for the current user
   */
  getCoachProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [row] = await db.select({
      coachName: users.coachName,
      coachGender: users.coachGender,
      coachBackground: users.coachBackground,
    }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return row ?? { coachName: null, coachGender: null, coachBackground: null };
  }),

  /**
   * Update coach profile fields for the current user
   */
  updateCoachProfile: protectedProcedure
    .input(z.object({
      coachName: z.string().min(1).max(255),
      coachGender: z.string().min(1).max(50),
      coachBackground: z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(users).set({
        coachName: input.coachName,
        coachGender: input.coachGender,
        coachBackground: input.coachBackground,
      }).where(eq(users.id, ctx.user.id));
      const [updated] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      return updated;
    }),
});
