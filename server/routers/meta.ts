import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { metaAccessTokens } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { encryptToken, decryptToken } from "../_core/tokenCrypto";
import { buildResolvedMap, resolveTokensInText } from "../lib/placeholderResolver";

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

      // ── Invented-proof hard gate (Class 1) ─────────────────────────────────
      // Runs on the RESOLVED copy, deliberately: a real price that a [INSERT_*]
      // token just resolved to must read as supplied, and an unresolved token
      // must not read as a missing figure. Content-agnostic, so it catches
      // whatever produced the copy — including a coach's hand-edit in the Kit.
      // Ground truth is the coach's OWN words, never the ICP prose.
      if (input.serviceId != null) {
        const { validatePublishContentFabrication } = await import("../_core/fabricationValidator");
        const { buildCoachCorpus, buildProofSupplied } = await import("../_core/groundingCorpus");
        const { services, idealCustomerProfiles } = await import("../../drizzle/schema");
        const gateDb = await getDb();
        if (gateDb) {
          const [svc] = await gateDb.select().from(services)
            .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id))).limit(1);
          const [gateIcp] = await gateDb.select().from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.serviceId, input.serviceId)).limit(1);
          const gate = validatePublishContentFabrication(
            { headline, body, callToAction },
            buildCoachCorpus({ service: svc, groundingMeta: gateIcp?.groundingMeta }),
            buildProofSupplied(svc),
          );
          if (!gate.ok) {
            const detail = gate.blocking.slice(0, 4)
              .map((h) => `${h.location}: "${h.matched}"`).join("; ");
            console.warn(
              `[publishToMeta] BLOCKED for user ${ctx.user.id} — invented proof ` +
              `(classes=[${Array.from(new Set(gate.blocking.map((h) => h.classId))).join(",")}])`,
            );
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                `This ad states things your own material doesn't back up, so it wasn't published: ${detail}. ` +
                `Edit the copy to speak to the reader's situation and your method, or add the real figures to your profile first.`,
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
            adSetId: "temp", // Will be passed from frontend in next iteration
            metaCampaignId: campaign.id,
            metaAdSetId: adSet.id,
            metaAdId: ad.id,
            metaCreativeId: creative.id,
            campaignName,
            status: input.status,
            objective: input.objective,
            dailyBudget: input.dailyBudget?.toString(),
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
