import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  trackAnalyticsEvent,
  getCampaignMetrics,
  getOverallMetrics,
  calculateCampaignROI,
  getAssetPerformance,
} from "../db";

export const analyticsRouter = router({
  /**
   * Track analytics event (public for webhooks/tracking pixels)
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
      const eventId = await trackAnalyticsEvent(input);
      return { eventId };
    }),

  /**
   * Get campaign metrics for date range
   */
  getCampaignMetrics: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        startDate: z.string(), // ISO date string
        endDate: z.string(),
      })
    )
    .query(async ({ input }) => {
      const metrics = await getCampaignMetrics(
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return metrics;
    }),

  /**
   * Get overall dashboard metrics
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
   * Calculate ROI for campaign
   */
  calculateROI: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input }) => {
      const roi = await calculateCampaignROI(
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return roi;
    }),

  /**
   * Get asset performance within campaign
   */
  getAssetPerformance: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input }) => {
      const performance = await getAssetPerformance(
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return performance;
    }),
});
