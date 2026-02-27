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
  getDb,
} from "../db";
import { services } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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

  // Generate all missing assets for campaign
  generateAllMissing: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId, ctx.user.id);
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      // TODO: Implement batch generation logic
      // This is a placeholder that will be enhanced to:
      // 1. Check which generators haven't been run (assetCounts = 0)
      // 2. Call each missing generator with campaign defaults
      // 3. Return progress updates
      
      return { 
        success: true,
        message: "Generate All Missing feature coming soon. For now, please run each generator individually from the dashboard."
      };
    }),

  // Export all campaign assets as ZIP
  exportCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId, ctx.user.id);
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      // TODO: Implement export logic
      // This is a placeholder that will be enhanced to:
      // 1. Fetch all campaign assets from all 9 generators
      // 2. Package them into a ZIP file
      // 3. Return download URL
      
      return { 
        success: true,
        message: "Export Campaign feature coming soon. For now, please export individual assets from each generator."
      };
    }),

  // Generate ad creatives (images + videos) for campaign
  generateCreatives: protectedProcedure
    .input(
      z.object({
        campaignId: z.number(),
        serviceId: z.number(),
        includeImages: z.boolean(),
        includeVideos: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(input.campaignId, ctx.user.id);
      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      // Import generation functions
      const { generateAdCreativesBatch } = await import("./adCreatives");
      const { generateVideoScriptForService, renderVideoFromScript } = await import("./videoScripts");
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }
      
      const [service] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);
      if (!service) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Service not found",
        });
      }

      let imagesCount = 0;
      let videosCount = 0;

      // Generate images if requested (FREE)
      if (input.includeImages) {
        try {
          const imageResult = await generateAdCreativesBatch({
            userId: ctx.user.id,
            serviceId: input.serviceId,
            campaignId: input.campaignId,
            niche: service.category || "coaching",
            productName: service.name,
            targetAudience: service.targetCustomer || "professionals",
            mainBenefit: service.mainBenefit || "transformation",
            pressingProblem: service.description || "challenges",
            uniqueMechanism: service.name,
            adType: "lead_gen",
          });
          imagesCount = 5; // Always generate 5 images
        } catch (error: any) {
          console.error("[generateCreatives] Image generation failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Image generation failed: ${error.message}`,
          });
        }
      }

      // Generate videos if requested (PAID - credits deducted in video generation)
      if (input.includeVideos) {
        try {
          // Generate 5 videos with different types and durations
          const videoConfigs = [
            { type: "explainer" as const, duration: "30" as const },
            { type: "explainer" as const, duration: "60" as const },
            { type: "proof_results" as const, duration: "30" as const },
            { type: "testimonial" as const, duration: "60" as const },
            { type: "mechanism_reveal" as const, duration: "30" as const },
          ];

          for (let i = 0; i < 5; i++) {
            try {
              const config = videoConfigs[i];
              // Step 1: Generate script
              const scriptId = await generateVideoScriptForService({
                userId: ctx.user.id,
                serviceId: input.serviceId,
                campaignId: input.campaignId,
                videoType: config.type,
                duration: config.duration,
              });

              // Step 2: Render video from script
              await renderVideoFromScript({
                userId: ctx.user.id,
                scriptId,
                visualStyle: "kinetic_typography",
                campaignId: input.campaignId,
              });

              videosCount++;
            } catch (videoError: any) {
              console.error(`[generateCreatives] Video ${i + 1} generation failed:`, videoError);
              // Continue with other videos even if one fails
            }
          }
        } catch (error: any) {
          console.error("[generateCreatives] Video generation failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Video generation failed: ${error.message}`,
          });
        }
      }

      // Send notification to owner
      const { notifyOwner } = await import("../_core/notification");
      await notifyOwner({
        title: "Campaign Creatives Ready",
        content: `Your ad creatives for "${campaign.name}" are ready! Generated ${imagesCount} images and ${videosCount} videos.`,
      });

      return {
        success: true,
        imagesCount,
        videosCount,
      };
    }),

  /**
   * Download all campaign creatives (images + videos) as ZIP
   */
  downloadAllCreatives: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Verify campaign ownership
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, userId)))
        .limit(1);

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // Get all images
      const images = await db
        .select()
        .from(adCreatives)
        .where(eq(adCreatives.campaignId, input.campaignId));

      // Get all videos
      const videosList = await db
        .select()
        .from(videos)
        .where(eq(videos.campaignId, input.campaignId));

      // Return URLs for client-side ZIP creation
      return {
        success: true,
        campaignName: campaign.name,
        images: images.map(img => ({
          id: img.id,
          url: img.imageUrl,
          filename: `image-${img.id}.png`,
        })),
        videos: videosList.map(vid => ({
          id: vid.id,
          url: vid.videoUrl,
          filename: `video-${vid.id}.mp4`,
        })),
      };
    }),
});
