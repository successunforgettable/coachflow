import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { metaAccessTokens } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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
    oauthUrl.searchParams.set("scope", "ads_management,ads_read,business_management");
    oauthUrl.searchParams.set("state", ctx.user.id.toString()); // Pass user ID for callback
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
      const campaigns = await getCampaigns(ctx.user.id, input);
      return campaigns;
    }),

  // Get Meta ad account details
  getAdAccount: protectedProcedure.query(async ({ ctx }) => {
    const { getAdAccount } = await import("../lib/metaAPI");
    const account = await getAdAccount(ctx.user.id);
    return account;
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
    tokenUrl.searchParams.set("fb_exchange_token", connection.accessToken);

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
        accessToken: data.access_token,
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
        callToAction: z.string().optional(),
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

      try {
        // Step 1: Create campaign
        const campaign = await createCampaign(ctx.user.id, {
          name: input.campaignName,
          objective: input.objective,
          status: input.status,
          dailyBudget: input.dailyBudget,
          lifetimeBudget: input.lifetimeBudget,
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
          name: `${input.campaignName} - Ad Set`,
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
          name: `${input.campaignName} - Creative`,
          headline: input.headline,
          body: input.body,
          linkUrl: input.linkUrl,
          imageUrl: input.imageUrl,
          callToAction: input.callToAction,
        });

        if (!creative) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Meta ad creative",
          });
        }

        // Step 4: Create ad
        const ad = await createAd(ctx.user.id, {
          name: input.campaignName,
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
            campaignName: input.campaignName,
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
        const status = await getCampaignStatus(connection.accessToken, ad.metaCampaignId);
        
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
