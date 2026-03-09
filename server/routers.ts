import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { servicesRouter } from "./routers/services";
import { icpsRouter } from "./routers/icps";
import { adCopyRouter } from "./routers/adCopy";
import { emailSequencesRouter } from "./routers/emailSequences";
import { whatsappSequencesRouter } from "./routers/whatsappSequences";
import { landingPagesRouter } from "./routers/landingPages";
import { offersRouter } from "./routers/offers";
import { subscriptionRouter } from "./routers/subscription";
import { campaignsRouter } from "./routers/campaigns";
import { sourceOfTruthRouter } from "./routers/sourceOfTruth";
import { headlinesRouter } from "./routers/headlines";
import { hvcoRouter } from "./routers/hvco";
import { heroMechanismsRouter } from "./routers/heroMechanisms";
import { adminRouter } from "./routers/admin";
import { analyticsRouter } from "./routers/analytics";
import { onboardingRouter } from "./routers/onboarding";
import { progressRouter } from "./routers/progress";
import { userRouter } from "./routers/user";
import { complianceRouter } from "./routers/compliance";
import { metaRouter } from "./routers/meta";
import { adCreativesRouter } from "./routers/adCreatives";
import { videoCreditsRouter } from "./routers/videoCreditsRouter";
import { videoScriptsRouter } from "./routers/videoScripts";
import { videosRouter } from "./routers/videos";
import { demoVideosRouter } from "./routers/demoVideos";
import { icpAngleSuggestionsRouter } from "./routers/icpAngleSuggestions";
import { nativeAuthRouter } from "./routers/nativeAuth";
import { landingRouter } from "./routers/landing";
import { getQuotaLimit } from "./quotaLimits";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
  subscription: subscriptionRouter,
  campaigns: campaignsRouter,
  sourceOfTruth: sourceOfTruthRouter,
  headlines: headlinesRouter,
  hvco: hvcoRouter,
  heroMechanisms: heroMechanismsRouter,
  admin: adminRouter,
  analytics: analyticsRouter,
  onboarding: onboardingRouter,
  progress: progressRouter,
  user: userRouter,
  compliance: complianceRouter,
  meta: metaRouter,
  videoCredits: videoCreditsRouter,
  videoScripts: videoScriptsRouter,
  videos: videosRouter,
  demoVideos: demoVideosRouter,
  nativeAuth: nativeAuthRouter,
  landing: landingRouter,
});

export type AppRouter = typeof appRouter;
