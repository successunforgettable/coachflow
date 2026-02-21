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
});
