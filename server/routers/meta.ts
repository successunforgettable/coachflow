import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

/**
 * CURRENCY-AWARE DAILY-BUDGET FLOOR — the coach-facing half of what the 4c harness already does.
 *
 * ⚠️ WHY THIS IS NOT IN THE ZOD SCHEMA. `z.number().min(1)` is SYNCHRONOUS and runs before the
 * handler; the account's currency needs an async per-user Graph read. So the floor cannot live in
 * the schema at all — `min(1)` stays as a cheap sanity bound and the real check happens here,
 * before any Meta write. That is a structural constraint, not a preference.
 *
 * ⚠️ FAIL-OPEN ON AN UNRESOLVED CURRENCY, DELIBERATELY. `getAdAccount` is a live Graph call. If it
 * throws, or the account has no currency, we let the publish proceed exactly as it does today —
 * today there is NO floor on this path at all, so refusing on a transient hiccup would be a
 * regression dressed as a safety feature. Meta still rejects a genuinely bad budget; the coach
 * just gets Meta's message instead of ours.
 *
 * The thresholds and every message live in `_core/metaSafety`. This function only adapts the
 * verdict to a TRPCError — it must never carry a number of its own.
 */
async function assertDailyBudgetForAccount(userId: number, dailyBudget: number | undefined): Promise<void> {
  if (dailyBudget == null) return;
  let currency: string | null = null;
  try {
    const { getAdAccount } = await import("../lib/metaAPI");
    currency = (await getAdAccount(userId))?.currency ?? null;
  } catch (err) {
    console.warn(`[meta] budget floor: currency lookup failed for user ${userId}, allowing publish —`,
      err instanceof Error ? err.message : err);
    return;
  }
  const { checkDailyBudgetFloor, MEASURED_DAILY_BUDGET_FLOORS } = await import("../_core/metaSafety");
  const code = (currency ?? "").trim().toUpperCase();
  if (code && MEASURED_DAILY_BUDGET_FLOORS[code] === undefined) {
    console.warn(`[meta] budget floor: UNMEASURED CURRENCY ${code} (user ${userId}) — applying the ` +
      `cautious default. Measure this currency's real floor and add one line to ` +
      `MEASURED_DAILY_BUDGET_FLOORS.`);
  }
  const verdict = checkDailyBudgetFloor(dailyBudget, currency);
  if (!verdict.ok) throw new TRPCError({ code: "BAD_REQUEST", message: verdict.message });
}
import { getDb } from "../db";
import { metaAccessTokens } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encryptToken, decryptToken } from "../_core/tokenCrypto";
import { buildResolvedMap, resolveTokensInText } from "../lib/placeholderResolver";
import { pageTextForAdMatch } from "../_core/landingPageActiveAngle";
import { buildPublishBlockMessage } from "../_core/publishBlockMessage";

/**
 * Meta Ads Manager Integration Router
 * Handles OAuth connection, token storage, and Meta API interactions
 */

export const metaRouter = router({
  /**
   * Get current user's Meta connection status
   */
  getConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [connection] = await db
      .select()
      .from(metaAccessTokens)
      .where(eq(metaAccessTokens.userId, ctx.user.id))
      .limit(1);

    if (!connection) {
      return { connected: false };
    }

    // Check if token is expired
    const now = new Date();
    const isExpired = new Date(connection.tokenExpiresAt) < now;

    return {
      connected: !isExpired,
      adAccountId: connection.adAccountId,
      adAccountName: connection.adAccountName,
      connectedAt: connection.connectedAt,
      expiresAt: connection.tokenExpiresAt,
      isExpired,
    };
  }),

  /**
   * Get Meta OAuth URL for user to initiate connection
   */
  getOAuthUrl: protectedProcedure.query(async ({ ctx }) => {
    const appId = process.env.META_APP_ID;
    if (!appId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Meta App ID not configured",
      });
    }

    // Use the configured app URL for OAuth redirect
    const appUrl = process.env.VITE_APP_URL || "http://localhost:3000";
    const redirectUri = `${appUrl}/api/meta/callback`;

    // Meta OAuth URL with required permissions
    const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    oauthUrl.searchParams.set("client_id", appId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    // Phase C C3 follow-on: pages_show_list is required for /me/accounts to
    // return the user's managed Pages (without it, the endpoint returns an
    // empty data:[] array even when Pages exist). pages_read_engagement is
    // belt-and-suspenders for Page metadata reads. Together they let the
    // OAuth callback's Step 3.5 capture pageId into the metaAccessTokens row
    // so createAdCreative's object_story_spec.page_id is populated.
    // pages_manage_ads deliberately omitted — Page-as-creative-author works
    // with ads_management + the user's existing admin role on the Page.
    oauthUrl.searchParams.set("scope", "ads_management,ads_read,business_management,pages_show_list,pages_read_engagement");
    // HMAC-signed state token — prevents OAuth CSRF / token-binding attacks.
    // The callback verifies the signature before trusting the userId.
    const { signOAuthState } = await import("../_core/oauthState");
    oauthUrl.searchParams.set("state", signOAuthState(ctx.user.id));
    oauthUrl.searchParams.set("response_type", "code");

    return { url: oauthUrl.toString() };
  }),

  // Get Meta campaigns
  getCampaigns: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "DELETED"]).optional(),
        includeInsights: z.boolean().optional(),
        dateRange: z.object({
          since: z.string().optional(), // YYYY-MM-DD format
          until: z.string().optional(), // YYYY-MM-DD format
        }).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { getCampaigns } = await import("../lib/metaAPI");
      // Surgical try/catch wrap — preserves the pre-throw UI UX where
      // CampaignComparison.tsx, MetaCampaigns.tsx, and CampaignAlerts.tsx
      // render a benign empty list on either real-empty OR fetch-failure.
      // The underlying getCampaigns now throws on HTTP errors so the
      // App Review daily job (server/_core/index.ts) gets clean failure
      // signal; we re-absorb that here to keep the user-facing contract.
      try {
        return await getCampaigns(ctx.user.id, input);
      } catch (err) {
        console.error("[meta.getCampaigns] fetch failed, returning [] to UI:", err instanceof Error ? err.message : err);
        return [];
      }
    }),

  // Get Meta ad account details
  getAdAccount: protectedProcedure.query(async ({ ctx }) => {
    const { getAdAccount } = await import("../lib/metaAPI");
    // Same UX-preservation wrap as getCampaigns above. MetaCampaigns.tsx
    // renders a "not connected" state on null; throwing would surface as
    // a tRPC error in the UI, conflating fetch failure with disconnection.
    try {
      return await getAdAccount(ctx.user.id);
    } catch (err) {
      console.error("[meta.getAdAccount] fetch failed, returning null to UI:", err instanceof Error ? err.message : err);
      return null;
    }
  }),

  // Disconnect Meta Ads Manager
  disconnectMeta: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .delete(metaAccessTokens)
      .where(eq(metaAccessTokens.userId, ctx.user.id));

    return { success: true };
  }),

  /**
   * Refresh Meta access token (called automatically when token is about to expire)
   */
  refreshToken: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [connection] = await db
      .select()
      .from(metaAccessTokens)
      .where(eq(metaAccessTokens.userId, ctx.user.id))
      .limit(1);

    if (!connection) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Meta connection not found",
      });
    }

    // Exchange short-lived token for long-lived token
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Meta credentials not configured",
      });
    }

    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("fb_exchange_token", decryptToken(connection.accessToken));

    const response = await fetch(tokenUrl.toString());
    const data = await response.json();

    if (!response.ok || !data.access_token) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to refresh Meta token",
      });
    }

    // Update token in database (long-lived tokens expire in 60 days)
    const expiresIn = data.expires_in || 60 * 24 * 60 * 60; // 60 days in seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await db
      .update(metaAccessTokens)
      .set({
        accessToken: encryptToken(data.access_token),
        tokenExpiresAt: expiresAt,
        lastRefreshedAt: new Date(),
      })
      .where(eq(metaAccessTokens.userId, ctx.user.id));

    return { success: true, expiresAt };
  }),

  /**
   * The GATED copy a published ad should carry, for the publish modal.
   *
   * Replaces two ungated sources on the V2 path: `selectedCreative.headline` (an image-engine
   * side-generation) and `deriveDefaultBody` (the landing page's subheadline). The landing
   * page body is the one the 2026-08-09 control run was BLOCKED on — page copy is written for
   * a page and never screened as ad copy, so it can fail compliance at the final step.
   *
   * Returns candidates as well as a default so the operator can still choose; what it will
   * not do is hand back a row that was never gated or never compliance-screened.
   */
  getGatedPublishCopy: protectedProcedure
    .input(z.object({ serviceId: z.number(), canvasWidth: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { resolveGatedPublishCopy } = await import("../_core/publishCopySource");
      return resolveGatedPublishCopy(db, ctx.user.id, input.serviceId, {
        canvasWidth: input.canvasWidth,
      });
    }),

  /**
   * STEP 4b — the concept-keyed assembly plan for a service. READ-ONLY.
   *
   * One concept → one ad, every surface descending from it, paired by id and never by label
   * text. Returns the ads AND the ledger: a short set is a correct result, and the ledger is
   * what makes it legible rather than mysterious. Writes nothing and calls no Meta endpoint.
   */
  previewAssembledAds: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      batchId: z.string().optional(),
      adSetId: z.string().optional(),
      canvasWidth: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const { assembleConceptAds } = await import("../_core/adAssembly");
      return assembleConceptAds(db, ctx.user.id, input.serviceId, {
        batchId: input.batchId, adSetId: input.adSetId, canvasWidth: input.canvasWidth,
      });
    }),

  /**
   * STEP 4c — publish N assembled ads into ONE campaign and ONE ad set.
   *
   * ⚠️ NOT WIRED AND NOT INVOKED. No client code calls this. The live multi-ad push is step
   * 4c, it runs against an account carrying real advertising, and it needs Arfeen's explicit
   * word on the day. It is written here so the capability and its ordering exist and are
   * unit-proven before that authorisation is asked for.
   *
   * WHY IT IS SEPARATE FROM `publishToMeta` RATHER THAN AN EXTENSION OF IT. That mutation is
   * the single-ad path proven end to end on a real paused ad on 2026-08-09, and it remains
   * the way an editorial or ungated creative is published. Changing its shape to serve N ads
   * would put the proven path at risk for no gain.
   *
   * The ordering that keeps the ad account clean lives in `_core/multiAdPublish.ts` with the
   * Graph calls injected, so it is provable without touching Meta: screen every ad FIRST,
   * refuse before creating anything if none survives, then one campaign, one ad set, and a
   * creative plus an ad per survivor.
   *
   * 📌 The screen below repeats the field shape used by `publishToMeta`'s gate deliberately
   * rather than refactoring that block out of the proven path. Unify the two AFTER 4c has
   * been proven live, not before.
   */
  publishAssembledAds: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      batchId: z.string().optional(),
      adSetId: z.string().optional(),
      linkUrl: z.string().url(),
      campaignName: z.string().min(1),
      objective: z.enum(["OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_TRAFFIC"]),
      callToAction: z.string().optional(),
      dailyBudget: z.number().min(1).optional(),
      lifetimeBudget: z.number().min(1).optional(),
      targeting: z.object({
        countries: z.array(z.string()).optional(),
        ageMin: z.number().min(18).max(65).optional(),
        ageMax: z.number().min(18).max(65).optional(),
        genders: z.array(z.number()).optional(),
      }).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Currency-aware budget floor, BEFORE anything is created on the ad account.
      await assertDailyBudgetForAccount(ctx.user.id, input.dailyBudget);

      const { assembleConceptAds } = await import("../_core/adAssembly");
      const { publishAssembledAds: runPublish, MIN_ADS } = await import("../_core/multiAdPublish");
      const { createCampaign, createAdSet, createAdCreative, createAd } = await import("../lib/metaAPI");
      const { checkOutput, checkAdToPageMatch } = await import("../_core/complianceAxis");
      const { buildCoachCorpus, buildProofSupplied } = await import("../_core/groundingCorpus");
      const { services, idealCustomerProfiles, landingPages, metaPublishedAds } = await import("../../drizzle/schema");

      const { ads, ledger } = await assembleConceptAds(db, ctx.user.id, input.serviceId, {
        batchId: input.batchId, adSetId: input.adSetId,
      });
      if (ads.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            `No coherent ad could be assembled for this campaign. ${ledger.unavailableReason ?? ""} ` +
            `Concepts seen ${ledger.conceptsSeen}, creatives ${ledger.creativesSeen}.`,
        });
      }
      // THE FLOOR, point one — refused here so the caller gets a usable message, and refused
      // again inside `runPublish` regardless. A single assembled ad has no second ad to share an
      // ad set with, which is the entire point of this path; `publishToMeta` is the single-ad way.
      if (ads.length < MIN_ADS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            `Only ${ads.length} coherent ad could be assembled and at least ${MIN_ADS} are needed ` +
            `for a multi-ad push — a single ad shares an ad set with nothing. ` +
            `${ledger.unavailableReason ?? ""} ` +
            `Concepts seen ${ledger.conceptsSeen}, creatives ${ledger.creativesSeen}.`,
        });
      }

      // Token resolution and the grounding corpus, resolved once for the whole push.
      const resolvedMap = await buildResolvedMap(ctx.user.id, input.serviceId);
      const rt = (s: string) => (resolvedMap ? resolveTokensInText(s, resolvedMap) : s);
      const [svc] = await db.select().from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id))).limit(1);
      const [gateIcp] = await db.select().from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
      let pageText = "";
      try {
        const [lp] = await db.select().from(landingPages)
          .where(and(eq(landingPages.publicUrl, input.linkUrl), eq(landingPages.userId, ctx.user.id))).limit(1);
        // Reads the ACTIVE angle — the one the publisher renders. This previously read
        // `lp.content`, a column `landingPages` does not have, so `pageText` was always ""
        // and `checkAdToPageMatch` below never ran. See `_core/landingPageActiveAngle.ts`.
        pageText = pageTextForAdMatch(lp);
      } catch { /* destination not resolvable — the other checks still apply */ }

      const callToAction = input.callToAction ? rt(input.callToAction) : undefined;
      const campaignName = rt(input.campaignName);

      const result = await runPublish(
        { createCampaign, createAdSet, createAdCreative, createAd },
        {
          userId: ctx.user.id,
          campaignName,
          objective: input.objective,
          linkUrl: input.linkUrl,
          status: input.status,
          dailyBudget: input.dailyBudget,
          lifetimeBudget: input.lifetimeBudget,
          callToAction,
          targeting: {
            geoLocations: input.targeting?.countries ? { countries: input.targeting.countries } : { countries: ["US"] },
            ageMin: input.targeting?.ageMin,
            ageMax: input.targeting?.ageMax,
            genders: input.targeting?.genders,
          },
          startTime: input.startTime,
          endTime: input.endTime,
          ads: ads.map((a) => ({
            conceptId: a.conceptId,
            headline: rt(a.headline.text),
            body: rt(a.body.text),
            headlineAdCopyId: a.headline.id,
            bodyAdCopyId: a.body.id,
            imageUrl: a.creative.imageUrl,
            verticalImageUrl: a.creative.verticalImageUrl,
          })),
          // FAIL CLOSED, per ad, on the RESOLVED copy — the same shape publishToMeta uses.
          screen: async (a) => {
            const gate = checkOutput(
              [
                { location: "headline", text: a.headline, role: "short" as const },
                { location: "body", text: a.body, role: "body" as const },
                ...(callToAction ? [{ location: "callToAction", text: callToAction, role: "cta" as const }] : []),
              ],
              svc
                ? {
                    corpus: buildCoachCorpus({ service: svc, groundingMeta: (gateIcp as any)?.groundingMeta }),
                    supplied: buildProofSupplied(svc),
                  }
                : undefined,
              { requireGrounding: true },
            );
            const blocking = [...(gate?.blocking ?? [])];
            if (pageText) {
              const match = checkAdToPageMatch(`${a.headline} ${a.body}`, pageText);
              if (!match.ok) blocking.push(...(match.blocking as any));
            }
            return {
              blocked: blocking.length > 0,
              classes: Array.from(new Set(blocking.map((h: any) => String(h.classId)))),
            };
          },
        },
      );

      // Provenance: one row per ad that actually landed, all sharing one campaign and ad set.
      for (const p of result.published) {
        await db.insert(metaPublishedAds).values({
          userId: ctx.user.id,
          adSetId: ledger.adSetId ?? "temp",
          metaCampaignId: result.campaignId!,
          metaAdSetId: result.adSetId!,
          metaAdId: p.metaAdId,
          metaCreativeId: p.metaCreativeId,
          campaignName,
          status: input.status,
          objective: input.objective,
          dailyBudget: input.dailyBudget?.toString(),
          headlineAdCopyId: p.headlineAdCopyId ?? undefined,
          bodyAdCopyId: p.bodyAdCopyId ?? undefined,
        } as any);
      }

      return { ...result, ledger };
    }),

  /**
   * Publish ad copy to Meta Ads Manager
   * Creates campaign, ad set, ad creative, and ad in one flow
   */
  publishToMeta: protectedProcedure
    .input(
      z.object({
        // Ad content
        headline: z.string().min(1).max(255),
        body: z.string().min(1),
        linkUrl: z.string().url(),
        imageUrl: z.string().url().optional(),
        // Optional native 9:16 asset — when present the creative is published
        // placement-aware (feed → imageUrl, Stories/Reels → verticalImageUrl).
        verticalImageUrl: z.string().url().optional(),
        callToAction: z.string().optional(),
        // Placeholder registry key — lets the server resolve [INSERT_*] tokens
        // in the ad copy to their filled values before publishing. Optional so
        // callers without a registry context still publish (tokens left raw).
        serviceId: z.number().optional(),
        // ── Provenance (publish-path step 1, migration 0100) ─────────────────
        // Which gated adCopy rows produced this ad. Optional so the legacy path and
        // any caller without gated copy still publishes — but a NULL is then recorded,
        // which is how "this ad shipped ungated copy" stays visible after the fact
        // rather than being indistinguishable from a missing feature.
        headlineAdCopyId: z.number().optional(),
        bodyAdCopyId: z.number().optional(),
        /** The CoachFlow adCopy.adSetId the copy came from — replaces the "temp" placeholder. */
        copyAdSetId: z.string().max(21).optional(),
        // Campaign settings
        campaignName: z.string().min(1),
        objective: z.enum(["OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_TRAFFIC"]),
        dailyBudget: z.number().min(1).optional(),
        lifetimeBudget: z.number().min(1).optional(),
        // Ad set settings
        targeting: z.object({
          countries: z.array(z.string()).optional(),
          ageMin: z.number().min(18).max(65).optional(),
          ageMax: z.number().min(18).max(65).optional(),
          genders: z.array(z.number()).optional(), // 1=male, 2=female
        }).optional(),
        startTime: z.string().optional(), // ISO 8601
        endTime: z.string().optional(), // ISO 8601
        status: z.enum(["ACTIVE", "PAUSED"]).default("PAUSED"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Currency-aware budget floor, BEFORE the first of the four Graph creates.
      await assertDailyBudgetForAccount(ctx.user.id, input.dailyBudget);

      const { createCampaign, createAdSet, createAdCreative, createAd } = await import("../lib/metaAPI");

      // Resolve [INSERT_*] tokens in the ad copy to their filled registry
      // values before they reach Meta. Only the free-text fields can carry
      // tokens; linkUrl/imageUrl are URL-validated upstream so they can't.
      const resolvedMap = input.serviceId != null
        ? await buildResolvedMap(ctx.user.id, input.serviceId)
        : null;
      const rt = (s: string | undefined): string | undefined =>
        resolvedMap && s ? resolveTokensInText(s, resolvedMap) : s;
      const headline = rt(input.headline)!;
      const body = rt(input.body)!;
      const callToAction = rt(input.callToAction);
      const campaignName = rt(input.campaignName)!;

      // ── PUBLISH GATE — compliance axis + fabrication, on RESOLVED copy ──────────
      // Runs on the resolved text deliberately: a real price a [INSERT_*] token just
      // resolved to must read as supplied, and an unresolved token must not read as a
      // missing figure. Content-agnostic, so it catches a coach's hand-edit in the Kit
      // as well as anything a generator produced.
      // FAIL CLOSED ON A MISSING INPUT (2026-09-01). `serviceId` is
      // `z.number().optional()`, and this gate used to be wrapped in
      // `if (input.serviceId != null)` — so a caller that simply OMITTED the key
      // skipped the compliance axis, the fabrication check and the ad-to-page match
      // in silence, and the ad reached Meta unscreened. Absence of what the check
      // needs must BLOCK the publish, never skip the check.
      if (input.serviceId == null) {
        console.warn(
          `[publishToMeta] REFUSED for user ${ctx.user.id} — no serviceId supplied; ` +
          `the compliance gate cannot run without it.`,
        );
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This ad cannot be published because it is not linked to a service. " +
            "The compliance check needs the service to run, and publishing without it is not allowed.",
        });
      }
      {
        const { checkOutput, checkAdToPageMatch } = await import("../_core/complianceAxis");
        const { buildCoachCorpus, buildProofSupplied } = await import("../_core/groundingCorpus");
        const { services, idealCustomerProfiles, landingPages } = await import("../../drizzle/schema");
        const gateDb = await getDb();
        // Same defect, same rule: no database means the gate cannot run, so the
        // publish is refused rather than allowed through unchecked.
        if (!gateDb) {
          console.warn(
            `[publishToMeta] REFUSED for user ${ctx.user.id} serviceId=${input.serviceId} — ` +
            `database unavailable, compliance gate could not run.`,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Cannot publish right now — the compliance check is unavailable. Please try again.",
          });
        }
        {
          // PROOF THIS RAN. Without this line a publish that skipped the gate was
          // indistinguishable after the fact from one that passed it — there is no
          // serviceId column on `meta_published_ads` to reconstruct it from.
          console.log(
            `[publishToMeta] GATE RAN for user ${ctx.user.id} serviceId=${input.serviceId}`,
          );
          const [svc] = await gateDb.select().from(services)
            .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id))).limit(1);
          const [gateIcp] = await gateDb.select().from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);

          // FAIL CLOSED — the same defect as the generator gates, and this is the LAST boundary
          // before Meta. `svc ? … : null` meant a service row that could not be loaded skipped
          // BOTH the compliance axis and the fabrication check, and the ad published unchecked.
          // Passing the fields with no grounding still runs compliance, and requireGrounding turns
          // the missing corpus into a blocking hit instead of silence.
          const gateFields = [
            { location: "headline", text: headline, role: "short" as const },
            { location: "body", text: body, role: "body" as const },
            { location: "callToAction", text: callToAction, role: "cta" as const },
          ];
          const gate = checkOutput(
            gateFields,
            svc
              ? {
                  corpus: buildCoachCorpus({ service: svc, groundingMeta: (gateIcp as any)?.groundingMeta }),
                  supplied: buildProofSupplied(svc),
                }
              : undefined,
            { requireGrounding: true },
          );

          // CHECK 3 (§1.4) — Meta requires the products and services promoted in an ad to
          // match those on its landing page, and reviews the destination. Only evaluable
          // here, where both artefacts exist.
          const pageBlocking: Array<{ classId: string; matched: string; location: string }> = [];
          try {
            const [lp] = await gateDb.select().from(landingPages)
              .where(and(eq(landingPages.publicUrl, input.linkUrl), eq(landingPages.userId, ctx.user.id))).limit(1);
            // Reads the ACTIVE angle — the one the publisher renders. This previously read
            // `lp.content`, a column `landingPages` does not have, so `pageText` was always ""
            // and this check never ran. See `_core/landingPageActiveAngle.ts`.
            const pageText = pageTextForAdMatch(lp);
            if (pageText) {
              const match = checkAdToPageMatch(`${headline} ${body}`, pageText);
              if (!match.ok) pageBlocking.push(...match.blocking);
            }
          } catch { /* destination not resolvable — the other checks still apply */ }

          const blocking = [...(gate?.blocking ?? []), ...pageBlocking];
          if (blocking.length > 0) {
            console.warn(
              `[publishToMeta] BLOCKED for user ${ctx.user.id} — ` +
              `classes=[${Array.from(new Set(blocking.map((h) => String(h.classId)))).join(",")}]`,
            );
            // Per-class wording. `ad_to_page_mismatch` is a DESTINATION check, not a claim
            // about the copy, so it gets its own sentence — the compliance wording would send
            // the coach to rewrite copy that was never the problem. See `publishBlockMessage`.
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: buildPublishBlockMessage(blocking),
            });
          }
        }
      }

      try {
        // Step 1: Create campaign — budget intentionally NOT passed here.
        // Phase C C3 follow-on 5: passing daily_budget at the campaign
        // level activates Meta's Campaign Budget Optimization (CBO) mode,
        // which then overrides the ad-set-level bid_strategy with a
        // campaign-level default (LOWEST_COST_WITH_BID_CAP — the bid-cap
        // strategy). That default requires bid_amount which we don't pass,
        // so Meta rejects with error_subcode 1815857. Keeping the budget
        // exclusively at the ad-set level disables CBO and lets the
        // ad-set bid_strategy=LOWEST_COST_WITHOUT_CAP from f7accd5
        // actually take effect. Forensic confirmation: Meta's error
        // message enumerated LOWEST_COST_WITH_BID_CAP + TARGET_COST as
        // the strategies requiring bid_amount, but NOT
        // LOWEST_COST_WITHOUT_CAP — proving CBO was overriding our value.
        const campaign = await createCampaign(ctx.user.id, {
          name: campaignName,
          objective: input.objective,
          status: input.status,
        });

        if (!campaign) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Meta campaign",
          });
        }

        // Step 2: Create ad set
        const adSet = await createAdSet(ctx.user.id, {
          campaignId: campaign.id,
          name: `${campaignName} - Ad Set`,
          status: input.status,
          dailyBudget: input.dailyBudget,
          lifetimeBudget: input.lifetimeBudget,
          targeting: {
            geoLocations: input.targeting?.countries ? { countries: input.targeting.countries } : { countries: ["US"] },
            ageMin: input.targeting?.ageMin,
            ageMax: input.targeting?.ageMax,
            genders: input.targeting?.genders,
          },
          startTime: input.startTime,
          endTime: input.endTime,
        });

        if (!adSet) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Meta ad set",
          });
        }

        // Step 3: Create ad creative
        const creative = await createAdCreative(ctx.user.id, {
          name: `${campaignName} - Creative`,
          headline,
          body,
          linkUrl: input.linkUrl,
          imageUrl: input.imageUrl,
          verticalImageUrl: input.verticalImageUrl,
          callToAction,
        });

        if (!creative) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Meta ad creative",
          });
        }

        // Step 4: Create ad
        const ad = await createAd(ctx.user.id, {
          name: campaignName,
          adSetId: adSet.id,
          creativeId: creative.id,
          status: input.status,
        });

        if (!ad) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Meta ad",
          });
        }

        // Store published ad record in database
        const db = await getDb();
        if (db) {
          const { metaPublishedAds } = await import("../../drizzle/schema");
          
          await db.insert(metaPublishedAds).values({
            userId: ctx.user.id,
            // The CoachFlow ad set that produced this copy, when the caller knows it.
            // Falls back to the historical "temp" placeholder rather than changing the
            // column's NOT NULL contract — see §8c: "temp" means only that the row is not
            // traceable back to its copy, and the provenance columns below now carry that.
            adSetId: input.copyAdSetId ?? "temp",
            metaCampaignId: campaign.id,
            metaAdSetId: adSet.id,
            metaAdId: ad.id,
            metaCreativeId: creative.id,
            campaignName,
            status: input.status,
            objective: input.objective,
            dailyBudget: input.dailyBudget?.toString(),
            // PROVENANCE (migration 0100). NULL here says the legacy ungated path produced
            // this ad — which is the signal worth recording, not an omission.
            headlineAdCopyId: input.headlineAdCopyId ?? null,
            bodyAdCopyId: input.bodyAdCopyId ?? null,
          });
        }

        return {
          success: true,
          campaignId: campaign.id,
          adSetId: adSet.id,
          creativeId: creative.id,
          adId: ad.id,
          message: `Successfully published to Meta Ads Manager! Campaign: ${campaign.name}`,
        };
      } catch (error) {
        console.error("[Meta Publish] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to publish to Meta",
        });
      }
    }),

  /**
   * Update campaign status (pause/resume)
   */
  updateCampaignStatus: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        status: z.enum(["ACTIVE", "PAUSED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { updateCampaignStatus } = await import("../lib/metaAPI");
      const success = await updateCampaignStatus(ctx.user.id, input.campaignId, input.status);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update campaign status",
        });
      }

      // Update local database record
      const db = await getDb();
      if (db) {
        const { metaPublishedAds } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        await db
          .update(metaPublishedAds)
          .set({ status: input.status, lastSyncedAt: new Date() })
          .where(eq(metaPublishedAds.metaCampaignId, input.campaignId));
      }

      return { success: true, status: input.status };
    }),

  /**
   * Update campaign details (name, budget)
   */
  updateCampaign: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        name: z.string().optional(),
        dailyBudget: z.number().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Same floor on the EDIT path — `updateCampaign` sends daily_budget * 100 just as
      // `createAdSet` does, so a below-floor edit is rejected by Meta identically.
      await assertDailyBudgetForAccount(ctx.user.id, input.dailyBudget);

      const { updateCampaign } = await import("../lib/metaAPI");
      const success = await updateCampaign(ctx.user.id, input.campaignId, {
        name: input.name,
        dailyBudget: input.dailyBudget,
      });

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update campaign",
        });
      }

      // Update local database record
      const db = await getDb();
      if (db) {
        const { metaPublishedAds } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        const updateData: any = { lastSyncedAt: new Date() };
        if (input.name) updateData.campaignName = input.name;
        if (input.dailyBudget) updateData.dailyBudget = input.dailyBudget.toString();
        
        await db
          .update(metaPublishedAds)
          .set(updateData)
          .where(eq(metaPublishedAds.metaCampaignId, input.campaignId));
      }

      return { success: true };
    }),

  /**
   * Delete campaign
   */
  deleteCampaign: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { deleteCampaign } = await import("../lib/metaAPI");
      const success = await deleteCampaign(ctx.user.id, input.campaignId);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete campaign",
        });
      }

      // Update local database record to DELETED status
      const db = await getDb();
      if (db) {
        const { metaPublishedAds } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        await db
          .update(metaPublishedAds)
          .set({ status: "DELETED", lastSyncedAt: new Date() })
          .where(eq(metaPublishedAds.metaCampaignId, input.campaignId));
      }

      return { success: true };
    }),

  /**
   * Get published ads for user's ad sets
   */
  getPublishedAds: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const { metaPublishedAds } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const publishedAds = await db
      .select()
      .from(metaPublishedAds)
      .where(eq(metaPublishedAds.userId, ctx.user.id));

    return publishedAds;
  }),

  /**
   * Sync campaign statuses from Meta to local database
   * Updates metaPublishedAds table with latest status from Meta API
   */
  syncCampaignStatuses: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Get user's Meta connection
    const [connection] = await db
      .select()
      .from(metaAccessTokens)
      .where(eq(metaAccessTokens.userId, ctx.user.id))
      .limit(1);

    if (!connection) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Meta account not connected" });
    }

    // Check if token is expired
    const now = new Date();
    if (new Date(connection.tokenExpiresAt) < now) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Meta access token expired. Please reconnect." });
    }

    // Get all published ads for this user
    const { metaPublishedAds } = await import("../../drizzle/schema");
    const publishedAds = await db
      .select()
      .from(metaPublishedAds)
      .where(eq(metaPublishedAds.userId, ctx.user.id));

    if (publishedAds.length === 0) {
      return { synced: 0, message: "No published campaigns to sync" };
    }

    // Fetch current status from Meta for each campaign
    const { getCampaignStatus } = await import("../lib/metaAPI");
    let syncedCount = 0;
    const errors: string[] = [];

    for (const ad of publishedAds) {
      try {
        const status = await getCampaignStatus(decryptToken(connection.accessToken), ad.metaCampaignId);
        
        // Update local database with latest status
        await db
          .update(metaPublishedAds)
          .set({
            status: status as "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED",
            lastSyncedAt: new Date(),
          })
          .where(eq(metaPublishedAds.id, ad.id));

        syncedCount++;
      } catch (error: any) {
        console.error(`Failed to sync campaign ${ad.metaCampaignId}:`, error);
        errors.push(`Campaign ${ad.metaCampaignId}: ${error.message}`);
      }
    }

    return {
      synced: syncedCount,
      total: publishedAds.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced ${syncedCount} of ${publishedAds.length} campaigns`,
    };
  }),

  /**
   * Get user's campaign alerts
   */
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const { campaignAlerts } = await import("../../drizzle/schema");
    const alerts = await db
      .select()
      .from(campaignAlerts)
      .where(eq(campaignAlerts.userId, ctx.user.id));

    return alerts;
  }),

  /**
   * Create a new campaign alert
   */
  createAlert: protectedProcedure
    .input(
      z.object({
        metaCampaignId: z.string().optional(),
        alertType: z.enum(["ctr_drop", "cpc_exceed", "spend_limit", "low_impressions"]),
        threshold: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { campaignAlerts } = await import("../../drizzle/schema");
      const [alert] = await db.insert(campaignAlerts).values({
        userId: ctx.user.id,
        metaCampaignId: input.metaCampaignId || null,
        alertType: input.alertType,
        threshold: input.threshold.toString(),
        enabled: true,
      });

      return { success: true, alertId: alert.insertId };
    }),

  /**
   * Update alert settings
   */
  updateAlert: protectedProcedure
    .input(
      z.object({
        alertId: z.number(),
        enabled: z.boolean().optional(),
        threshold: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { campaignAlerts } = await import("../../drizzle/schema");
      const updateData: any = {};
      if (input.enabled !== undefined) updateData.enabled = input.enabled;
      if (input.threshold !== undefined) updateData.threshold = input.threshold.toString();

      await db
        .update(campaignAlerts)
        .set(updateData)
        .where(eq(campaignAlerts.id, input.alertId));

      return { success: true };
    }),

  /**
   * Delete an alert
   */
  deleteAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { campaignAlerts } = await import("../../drizzle/schema");
      await db.delete(campaignAlerts).where(eq(campaignAlerts.id, input.alertId));

      return { success: true };
    }),

  /**
   * Check campaigns against alert rules and notify owner
   */
  checkCampaignAlerts: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    // Get user's Meta connection
    const [connection] = await db
      .select()
      .from(metaAccessTokens)
      .where(eq(metaAccessTokens.userId, ctx.user.id))
      .limit(1);

    if (!connection) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Meta account not connected" });
    }

    // Get enabled alerts
    const { campaignAlerts } = await import("../../drizzle/schema");
    const alerts = await db
      .select()
      .from(campaignAlerts)
      .where(eq(campaignAlerts.userId, ctx.user.id));

    const enabledAlerts = alerts.filter((a) => a.enabled);
    if (enabledAlerts.length === 0) {
      return { checked: 0, triggered: 0, message: "No enabled alerts" };
    }

    // Get campaigns with insights
    const { getCampaigns } = await import("../lib/metaAPI");
    const campaigns = await getCampaigns(ctx.user.id, { includeInsights: true, limit: 50 });

    let triggeredCount = 0;
    const { notifyOwner } = await import("../_core/notification");

    for (const alert of enabledAlerts) {
      const targetCampaigns = alert.metaCampaignId
        ? campaigns.filter((c) => c.id === alert.metaCampaignId)
        : campaigns;

      for (const campaign of targetCampaigns) {
        if (!campaign.insights) continue;

        let triggered = false;
        let message = "";

        switch (alert.alertType) {
          case "ctr_drop":
            if (campaign.insights.ctr < parseFloat(alert.threshold)) {
              triggered = true;
              message = `Campaign "${campaign.name}" CTR dropped to ${campaign.insights.ctr.toFixed(2)}% (threshold: ${alert.threshold}%)`;
            }
            break;
          case "cpc_exceed":
            if (campaign.insights.cpc > parseFloat(alert.threshold)) {
              triggered = true;
              message = `Campaign "${campaign.name}" CPC exceeded $${campaign.insights.cpc.toFixed(2)} (threshold: $${alert.threshold})`;
            }
            break;
          case "spend_limit":
            if (campaign.insights.spend > parseFloat(alert.threshold)) {
              triggered = true;
              message = `Campaign "${campaign.name}" spend exceeded $${campaign.insights.spend.toFixed(2)} (limit: $${alert.threshold})`;
            }
            break;
          case "low_impressions":
            if (campaign.insights.impressions < parseFloat(alert.threshold)) {
              triggered = true;
              message = `Campaign "${campaign.name}" impressions dropped to ${campaign.insights.impressions} (threshold: ${alert.threshold})`;
            }
            break;
        }

        if (triggered) {
          // Send notification
          await notifyOwner({
            title: "⚠️ Campaign Alert Triggered",
            content: message,
          });

          // Update alert trigger count and timestamp
          await db
            .update(campaignAlerts)
            .set({
              lastTriggeredAt: new Date(),
              triggerCount: alert.triggerCount + 1,
            })
            .where(eq(campaignAlerts.id, alert.id));

          triggeredCount++;
        }
      }
    }

    return {
      checked: enabledAlerts.length,
      triggered: triggeredCount,
      message: triggeredCount > 0
        ? `${triggeredCount} alert${triggeredCount > 1 ? "s" : ""} triggered`
        : "All campaigns within thresholds",
    };
  }),
});
