import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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
  }),

  // Feature routers
  services: servicesRouter,
  icps: icpsRouter,
  adCopy: adCopyRouter,
  emailSequences: emailSequencesRouter,
  whatsappSequences: whatsappSequencesRouter,
  landingPages: landingPagesRouter,
  offers: offersRouter,
  subscription: subscriptionRouter,
  campaigns: campaignsRouter,
  sourceOfTruth: sourceOfTruthRouter,
  headlines: headlinesRouter,
  hvco: hvcoRouter,
  heroMechanisms: heroMechanismsRouter,
});

export type AppRouter = typeof appRouter;
