import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { campaigns } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  trackAnalyticsEvent,
  getCampaignMetrics,
  getOverallMetrics,
  calculateCampaignROI,
  getAssetPerformance,
} from "../db";

/**
 * Verify the authenticated user owns the campaign. Throws NOT_FOUND if
 * the campaign doesn't exist or belongs to another user — consistent
 * with the ownership pattern used across all resource routers.
 */
async function verifyOwnsCampaign(campaignId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [row] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
}

export const analyticsRouter = router({
  /**
   * Track analytics event (public for webhooks/tracking pixels).
   *
   * Kept as publicProcedure because tracking pixels fire from email
   * clients and external systems without ZAP auth. Validates that the
   * campaignId references an existing campaign to prevent injection
   * of events for nonexistent campaigns.
   */
  trackEvent: publicProcedure
    .input(
      z.object({
        campaignId: z.number(),
        eventType: z.enum(["email_open", "email_click", "link_click", "conversion", "purchase"]),
        assetId: z.string().optional(),
        assetType: z.string().optional(),
        userIdentifier: z.string().optional(),
        metadata: z.any().optional(),
        revenue: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Verify campaign exists (not ownership — public endpoint)
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [campaign] = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

      const eventId = await trackAnalyticsEvent(input);
      return { eventId };
    }),

  /**
   * Get campaign metrics for date range — ownership verified.
   */
  getCampaignMetrics: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyOwnsCampaign(input.campaignId, ctx.user.id);
      const metrics = await getCampaignMetrics(
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return metrics;
    }),

  /**
   * Get overall dashboard metrics — already scoped by userId.
   */
  getOverallMetrics: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const metrics = await getOverallMetrics(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return metrics;
    }),

  /**
   * Calculate ROI for campaign — ownership verified.
   */
  calculateROI: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyOwnsCampaign(input.campaignId, ctx.user.id);
      const roi = await calculateCampaignROI(
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return roi;
    }),

  /**
   * Get asset performance within campaign — ownership verified.
   */
  getAssetPerformance: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyOwnsCampaign(input.campaignId, ctx.user.id);
      const performance = await getAssetPerformance(
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return performance;
    }),
});
