import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getCampaignsByUserId,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  addAssetToCampaign,
  removeAssetFromCampaign,
  updateAssetPosition,
  createCampaignLink,
  deleteCampaignLink,
} from "../db";

export const campaignsRouter = router({
  // List all user campaigns
  list: protectedProcedure.query(async ({ ctx }) => {
    return await getCampaignsByUserId(ctx.user.id);
  }),

  // Get campaign by ID with assets and links
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.id, ctx.user.id);
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }
      
      // Calculate asset counts by type
      const assetCounts = {
        headline: campaign.assets.filter((a) => a.assetType === "headline").length,
        hvco: campaign.assets.filter((a) => a.assetType === "hvco").length,
        hero_mechanism: campaign.assets.filter((a) => a.assetType === "hero_mechanism").length,
        ad_copy: campaign.assets.filter((a) => a.assetType === "ad_copy").length,
        email_sequence: campaign.assets.filter((a) => a.assetType === "email_sequence").length,
        whatsapp_sequence: campaign.assets.filter((a) => a.assetType === "whatsapp_sequence").length,
        landing_page: campaign.assets.filter((a) => a.assetType === "landing_page").length,
        offer: campaign.assets.filter((a) => a.assetType === "offer").length,
        icp: campaign.assets.filter((a) => a.assetType === "icp").length,
      };
      
      return { ...campaign, assetCounts };
    }),

  // Create new campaign
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        serviceId: z.number().optional(),
        campaignType: z.enum(["webinar", "challenge", "course_launch", "product_launch"]).optional(),
        status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
        startDate: z.string().optional(), // ISO date string
        endDate: z.string().optional(), // ISO date string
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaignId = await createCampaign({
        userId: ctx.user.id,
        name: input.name,
        description: input.description,
        serviceId: input.serviceId,
        campaignType: input.campaignType,
        status: input.status,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      });
      return { id: campaignId };
    }),

  // Update campaign details
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        campaignType: z.enum(["webinar", "challenge", "course_launch", "product_launch"]).optional(),
        status: z.enum(["draft", "active", "paused", "completed"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      
      // Convert date strings to Date objects
      const updateData: any = { ...data };
      if (data.startDate) updateData.startDate = new Date(data.startDate);
      if (data.endDate) updateData.endDate = new Date(data.endDate);
      
      await updateCampaign(id, ctx.user.id, updateData);
      return { success: true };
    }),

  // Delete campaign
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCampaign(input.id, ctx.user.id);
      return { success: true };
    }),

  // Duplicate campaign
  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const newCampaignId = await duplicateCampaign(input.id, ctx.user.id);
      return { id: newCampaignId };
    }),

  // Add asset to campaign
  addAsset: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        assetType: z.enum([
          "headline",
          "hvco",
          "hero_mechanism",
          "ad_copy",
          "email_sequence",
          "whatsapp_sequence",
          "landing_page",
          "offer",
          "icp",
        ]),
        assetId: z.string(),
        position: z.number().default(0),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assetId = await addAssetToCampaign({
        campaignId: input.campaignId,
        assetType: input.assetType,
        assetId: input.assetId,
        position: input.position,
        notes: input.notes,
      });
      return { assetId };
    }),

  // List all assets in a campaign
  listAssets: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId, ctx.user.id);
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }
      // Return assets from the campaign (assuming getCampaignById returns assets)
      return campaign.assets || [];
    }),

  // Remove asset from campaign
  removeAsset: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await removeAssetFromCampaign(input.assetId);
      return { success: true };
    }),

  // Reorder assets in campaign
  reorderAssets: protectedProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            assetId: z.number(),
            position: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      for (const update of input.updates) {
        await updateAssetPosition(update.assetId, update.position);
      }
      return { success: true };
    }),

  // List all links in a campaign
  listLinks: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId, ctx.user.id);
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }
      // Return links from the campaign (assuming getCampaignById returns links)
      return campaign.links || [];
    }),

  // Create link between assets
  linkAssets: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        sourceAssetId: z.number(),
        targetAssetId: z.number(),
        linkType: z.enum(["leads_to", "supports", "requires"]).default("leads_to"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const linkId = await createCampaignLink({
        campaignId: input.campaignId,
        sourceAssetId: input.sourceAssetId,
        targetAssetId: input.targetAssetId,
        linkType: input.linkType,
      });
      return { linkId };
    }),

  // Delete link between assets
  unlinkAssets: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCampaignLink(input.linkId);
      return { success: true };
    }),
});
