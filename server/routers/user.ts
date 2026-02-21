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
});
