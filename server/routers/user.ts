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
   * Save a coach asset from an already-uploaded (Cloudinary) URL — the direct
   * upload path. Routes through the ONE shared ingestion path so direct uploads
   * and Has-Assets imports behave identically (slot bakes, replace-in-scope).
   * Singular (headshot, logo, hero_image, value_stack) replace; plural
   * (social_proof, press_logo) accumulate. hero_image/value_stack are per-LP.
   * grayscale (trust-logo colour override) and facingFlip (portrait mirror) are
   * the user-choice bakes.
   */
  saveCoachAsset: protectedProcedure
    .input(z.object({
      assetType: z.enum(["headshot", "logo", "social_proof", "hero_image", "press_logo", "value_stack"]),
      url: z.string().url(),
      landingPageId: z.number().optional(),
      grayscale: z.boolean().optional(),
      facingFlip: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { ingestCoachAssetImage } = await import("../lib/images/ingestCoachAssetImage");
      return ingestCoachAssetImage({
        userId: ctx.user.id,
        assetType: input.assetType,
        source: { kind: "url", url: input.url },
        landingPageId: input.landingPageId ?? null,
        grayscale: input.grayscale,
        facingFlip: input.facingFlip,
      });
    }),

  /**
   * Import a coach asset image from Has-Assets material — a remote URL found in
   * imported content or a base64 data URL from multimodal extraction. Same
   * shared ingestion path as direct upload; the image is re-hosted on Cloudinary
   * so it can be slot-transformed.
   */
  importCoachAssetImage: protectedProcedure
    .input(z.object({
      assetType: z.enum(["headshot", "logo", "social_proof", "hero_image", "press_logo", "value_stack"]),
      remoteUrl: z.string().url().optional(),
      dataUrl: z.string().optional(),
      landingPageId: z.number().optional(),
      grayscale: z.boolean().optional(),
      facingFlip: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.remoteUrl && !input.dataUrl) {
        throw new Error("Provide remoteUrl or dataUrl");
      }
      const { ingestCoachAssetImage } = await import("../lib/images/ingestCoachAssetImage");
      return ingestCoachAssetImage({
        userId: ctx.user.id,
        assetType: input.assetType,
        source: input.dataUrl
          ? { kind: "dataUrl", dataUrl: input.dataUrl }
          : { kind: "url", url: input.remoteUrl! },
        landingPageId: input.landingPageId ?? null,
        grayscale: input.grayscale,
        facingFlip: input.facingFlip,
      });
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
