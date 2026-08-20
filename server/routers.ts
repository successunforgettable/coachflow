import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { servicesRouter } from "./routers/services";
import { icpsRouter } from "./routers/icps";
import { adCopyRouter } from "./routers/adCopy";
import { emailSequencesRouter } from "./routers/emailSequences";
import { whatsappSequencesRouter } from "./routers/whatsappSequences";
import { landingPagesRouter } from "./routers/landingPages";
import { offersRouter } from "./routers/offers";
import { bonusesRouter } from "./routers/bonuses";
import { subscriptionRouter } from "./routers/subscription";
import { campaignsRouter } from "./routers/campaigns";
import { sourceOfTruthRouter } from "./routers/sourceOfTruth";
import { headlinesRouter } from "./routers/headlines";
import { hvcoRouter } from "./routers/hvco";
import { heroMechanismsRouter } from "./routers/heroMechanisms";
import { methodsRouter } from "./routers/methods";
import { adminRouter } from "./routers/admin";
import { analyticsRouter } from "./routers/analytics";
import { onboardingRouter } from "./routers/onboarding";
import { progressRouter } from "./routers/progress";
import { userRouter } from "./routers/user";
import { complianceRouter } from "./routers/compliance";
import { metaRouter } from "./routers/meta";
import { ghlRouter } from "./routers/ghl";
import { favouritesRouter } from "./routers/favourites";
import { adCreativesRouter } from "./routers/adCreatives";
import { videoCreditsRouter } from "./routers/videoCreditsRouter";
import { videoScriptsRouter } from "./routers/videoScripts";
import { videosRouter } from "./routers/videos";
import { demoVideosRouter } from "./routers/demoVideos";
import { icpAngleSuggestionsRouter } from "./routers/icpAngleSuggestions";
import { nativeAuthRouter } from "./routers/nativeAuth";
import { landingRouter } from "./routers/landing";
import { campaignKitsRouter } from "./routers/campaignKits";
import { campaignExportRouter } from "./routers/campaignExport";
import { nodeSkipsRouter } from "./routers/nodeSkips";
import { complianceRewritesRouter } from "./routers/complianceRewrites";
import { autoModeRouter } from "./routers/autoMode";
import { placeholdersRouter } from "./routers/placeholders";
import { trailRouter } from "./routers/trail";
import { testimonialsRouter } from "./routers/testimonials";
import { capturedLeadsRouter } from "./routers/capturedLeads";
import { getQuotaLimit } from "./quotaLimits";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      // Strip passwordHash (auth secret) and add hasPassword boolean
      const { passwordHash, ...safeUser } = opts.ctx.user;
      return { ...safeUser, hasPassword: !!passwordHash };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    toggleBeastMode: publicProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db
          .update(users)
          .set({ powerMode: input.enabled })
          .where(eq(users.id, ctx.user.id));
        return { success: true, enabled: input.enabled };
      }),
    getQuotaLimits: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const tier = ctx.user.subscriptionTier || "trial";
      const userRole = ctx.user.role;
      return {
        headlines: getQuotaLimit(tier, "headlines", userRole),
        hvco: getQuotaLimit(tier, "hvco", userRole),
        heroMechanisms: getQuotaLimit(tier, "heroMechanisms", userRole),
        icp: getQuotaLimit(tier, "icp", userRole),
        adCopy: getQuotaLimit(tier, "adCopy", userRole),
        email: getQuotaLimit(tier, "email", userRole),
        whatsapp: getQuotaLimit(tier, "whatsapp", userRole),
        landingPages: getQuotaLimit(tier, "landingPages", userRole),
        offers: getQuotaLimit(tier, "offers", userRole),
      };
    }),
    updateProfile: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
          email: z.string().trim().email("Invalid email address").max(255, "Email is too long"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new Error("Not authenticated");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Check if email is already taken by another user
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);
        
        if (existingUser && existingUser.id !== ctx.user.id) {
          throw new Error("Email is already in use by another account");
        }
        
        await db
          .update(users)
          .set({ 
            name: input.name, 
            email: input.email,
            updatedAt: new Date(),
          })
          .where(eq(users.id, ctx.user.id));
        
        return {
          success: true,
          user: {
            ...ctx.user,
            name: input.name,
            email: input.email
          }
        };
      }),

    /**
     * Delete account — self-serve with billing guard (Option C).
     *
     * Order of operations:
     * 1. Check for active Stripe subscription → block if present
     * 2. NULL foreign keys in NO-ACTION tables (admin_audit_log, user_notes, content_flags)
     * 3. Delete the user row (CASCADE handles 32 other tables)
     * 4. Clear session cookie
     *
     * Known cleanup debt (not handled):
     * - Cloudinary ad-creative images at ad-creatives/{userId}/ → orphaned
     * - Cloudflare Workers KV landing pages at /p/{slug} → orphaned
     * - Meta/GHL OAuth tokens → not revoked remotely (rows cascade-deleted)
     * - Active JWTs → valid until expiry (30 days, no revocation mechanism)
     */
    deleteAccount: protectedProcedure
      .input(z.object({ confirmation: z.literal("DELETE") }))
      .mutation(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // Guard: admin accounts cannot be self-deleted
        if (ctx.user.role === "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admin accounts cannot be deleted through self-serve." });
        }

        const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        // Step 1: Billing guard — block if active Stripe subscription (READ-ONLY check)
        if (user.stripeSubscriptionId) {
          try {
            const Stripe = (await import("stripe")).default;
            const stripe = new Stripe((process.env.CUSTOM_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY)!, { apiVersion: "2026-01-28.clover" as any });
            const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
            if (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "Please cancel your subscription before deleting your account. Go to Settings → Subscription → Cancel.",
              });
            }
          } catch (err) {
            if (err instanceof TRPCError) throw err;
            console.error("[deleteAccount] Stripe check failed:", err);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not verify subscription status. Please try again." });
          }
        }

        // Steps 2-3: FK cleanup + user deletion in a single transaction.
        // If any step fails, the entire operation rolls back — no partially
        // scrubbed account left behind.
        await db.transaction(async (tx) => {
          const uid = ctx.user.id;
          // NO-ACTION FK tables: clean up before the CASCADE delete
          await tx.execute(sql`UPDATE admin_audit_log SET target_user_id = NULL WHERE target_user_id = ${uid}`);
          await tx.execute(sql`DELETE FROM admin_audit_log WHERE admin_user_id = ${uid}`);
          await tx.execute(sql`DELETE FROM user_notes WHERE user_id = ${uid} OR admin_user_id = ${uid}`);
          await tx.execute(sql`UPDATE content_flags SET resolved_by = NULL WHERE resolved_by = ${uid}`);
          await tx.execute(sql`DELETE FROM content_flags WHERE user_id = ${uid}`);

          // Tables with userId column but NO FK constraint in the actual DB
          // (Drizzle schema declares them but migrations never added the FK).
          // Must delete explicitly — CASCADE won't reach these.
          await tx.execute(sql`DELETE FROM campaignKits WHERE userId = ${uid}`);
          await tx.execute(sql`DELETE FROM coachAssets WHERE userId = ${uid}`);
          await tx.execute(sql`DELETE FROM ghl_access_tokens WHERE userId = ${uid}`);
          await tx.execute(sql`DELETE FROM meta_access_tokens WHERE userId = ${uid}`);
          await tx.execute(sql`DELETE FROM jobs WHERE userId = ${String(uid)}`);
          await tx.execute(sql`DELETE FROM testimonials WHERE userId = ${uid}`);
          await tx.execute(sql`DELETE FROM product_events WHERE userId = ${uid}`);
          await tx.execute(sql`DELETE FROM phrase_usage_stats WHERE userId = ${uid}`);

          // Delete user row — CASCADE handles remaining FK-constrained tables
          await tx.delete(users).where(eq(users.id, uid));
        });

        // Clear session cookie (outside transaction — cookie is non-transactional)
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });

        return { success: true, message: "Account deleted." };
      }),
  }),

  // Feature routers
  services: servicesRouter,
  icps: icpsRouter,
  icpAngleSuggestions: icpAngleSuggestionsRouter,
  adCopy: adCopyRouter,
  emailSequences: emailSequencesRouter,
  whatsappSequences: whatsappSequencesRouter,
  landingPages: landingPagesRouter,
  adCreatives: adCreativesRouter,
  offers: offersRouter,
  bonuses: bonusesRouter,
  subscription: subscriptionRouter,
  campaigns: campaignsRouter,
  sourceOfTruth: sourceOfTruthRouter,
  headlines: headlinesRouter,
  hvco: hvcoRouter,
  heroMechanisms: heroMechanismsRouter,
  methods: methodsRouter,
  admin: adminRouter,
  analytics: analyticsRouter,
  onboarding: onboardingRouter,
  progress: progressRouter,
  user: userRouter,
  compliance: complianceRouter,
  meta: metaRouter,
  ghl: ghlRouter,
  favourites: favouritesRouter,
  videoCredits: videoCreditsRouter,
  videoScripts: videoScriptsRouter,
  videos: videosRouter,
  demoVideos: demoVideosRouter,
  nativeAuth: nativeAuthRouter,
  landing: landingRouter,
  campaignKits: campaignKitsRouter,
  campaignExport: campaignExportRouter,
  nodeSkips: nodeSkipsRouter,
  complianceRewrites: complianceRewritesRouter,
  autoMode: autoModeRouter,
  placeholders: placeholdersRouter,
  trail: trailRouter,
  testimonials: testimonialsRouter,
  capturedLeads: capturedLeadsRouter,
});

export type AppRouter = typeof appRouter;
