import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { users, coachAssets } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";

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

  /**
   * Get all coach assets for the current user
   */
  getCoachAssets: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const rows = await db.select().from(coachAssets).where(eq(coachAssets.userId, ctx.user.id));
    return rows;
  }),

  /**
   * Save a coach asset (headshot, logo, social_proof, hero_image, press_logo)
   * Singular types (headshot, logo, hero_image) replace existing on save.
   * Plural types (social_proof, press_logo) accumulate.
   * Per-LP assets (hero_image) require landingPageId.
   */
  saveCoachAsset: protectedProcedure
    .input(z.object({
      assetType: z.enum(["headshot", "logo", "social_proof", "hero_image", "press_logo"]),
      url: z.string().url(),
      landingPageId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Singular types: replace existing (only one allowed per scope)
      const singularTypes = ["headshot", "logo", "hero_image"];
      if (singularTypes.includes(input.assetType)) {
        const conditions = [
          eq(coachAssets.userId, ctx.user.id),
          eq(coachAssets.assetType, input.assetType),
        ];
        // hero_image is per-LP; headshot/logo are per-user
        if (input.assetType === "hero_image" && input.landingPageId) {
          conditions.push(eq(coachAssets.landingPageId, input.landingPageId));
        }
        await db.delete(coachAssets).where(and(...conditions));
      }

      const result: any = await db.insert(coachAssets).values({
        userId: ctx.user.id,
        landingPageId: input.landingPageId ?? null,
        assetType: input.assetType,
        url: input.url,
      });
      return { id: result[0].insertId, url: input.url, assetType: input.assetType };
    }),

  /**
   * Delete a coach asset by id
   */
  deleteCoachAsset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(coachAssets).where(
        and(eq(coachAssets.id, input.id), eq(coachAssets.userId, ctx.user.id))
      );
      return { success: true };
    }),
});
