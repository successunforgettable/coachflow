import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { campaignKits, idealCustomerProfiles, services } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const campaignKitsRouter = router({
  /**
   * getOrCreate — finds or creates a campaign kit for a given ICP.
   * Auto-generates the name as "{serviceName} — {icpName} Campaign".
   */
  getOrCreate: protectedProcedure
    .input(z.object({ icpId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check for existing kit
      const [existing] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.userId, ctx.user.id), eq(campaignKits.icpId, input.icpId)))
        .limit(1);

      if (existing) return existing;

      // Fetch ICP and service for name generation
      const [icp] = await db
        .select()
        .from(idealCustomerProfiles)
        .where(and(eq(idealCustomerProfiles.id, input.icpId), eq(idealCustomerProfiles.userId, ctx.user.id)))
        .limit(1);

      if (!icp) throw new TRPCError({ code: "NOT_FOUND", message: "ICP not found" });

      let serviceName = "My Service";
      if (icp.serviceId) {
        const [svc] = await db
          .select()
          .from(services)
          .where(eq(services.id, icp.serviceId))
          .limit(1);
        if (svc) serviceName = svc.name;
      }

      const name = `${serviceName} — ${icp.name} Campaign`;

      const result: any = await db.insert(campaignKits).values({
        userId: ctx.user.id,
        icpId: input.icpId,
        name,
      });

      const [newKit] = await db
        .select()
        .from(campaignKits)
        .where(eq(campaignKits.id, result[0].insertId))
        .limit(1);

      return newKit;
    }),

  /**
   * updateSelection — updates any subset of the 9 selected*Id fields.
   * After updating, checks if all 9 are filled and sets status to "complete" if so.
   */
  updateSelection: protectedProcedure
    .input(z.object({
      kitId: z.number(),
      selectedOfferId: z.number().nullable().optional(),
      selectedMechanismId: z.number().nullable().optional(),
      selectedHvcoId: z.number().nullable().optional(),
      selectedHeadlineId: z.number().nullable().optional(),
      selectedAdCopyId: z.number().nullable().optional(),
      selectedLandingPageId: z.number().nullable().optional(),
      selectedLandingPageAngle: z.string().nullable().optional(),
      selectedEmailSequenceId: z.number().nullable().optional(),
      selectedWhatsAppSequenceId: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify ownership
      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);

      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });

      // Build update object with only provided fields
      const { kitId, ...fields } = input;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      await db
        .update(campaignKits)
        .set(updateData as any)
        .where(eq(campaignKits.id, input.kitId));

      // Fetch updated row and check completeness
      const [updated] = await db
        .select()
        .from(campaignKits)
        .where(eq(campaignKits.id, input.kitId))
        .limit(1);

      const isComplete =
        updated.selectedOfferId != null &&
        updated.selectedMechanismId != null &&
        updated.selectedHvcoId != null &&
        updated.selectedHeadlineId != null &&
        updated.selectedAdCopyId != null &&
        updated.selectedLandingPageId != null &&
        updated.selectedEmailSequenceId != null &&
        updated.selectedWhatsAppSequenceId != null;

      // Auto-update status if all slots are filled
      if (isComplete && updated.status === "draft") {
        await db
          .update(campaignKits)
          .set({ status: "complete", updatedAt: new Date() } as any)
          .where(eq(campaignKits.id, input.kitId));
      } else if (!isComplete && updated.status === "complete") {
        // If a selection is removed, revert to draft
        await db
          .update(campaignKits)
          .set({ status: "draft", updatedAt: new Date() } as any)
          .where(eq(campaignKits.id, input.kitId));
      }

      // Return final state
      const [final] = await db
        .select()
        .from(campaignKits)
        .where(eq(campaignKits.id, input.kitId))
        .limit(1);

      return final;
    }),

  /**
   * getById — returns a single campaign kit by ID.
   */
  getById: protectedProcedure
    .input(z.object({ kitId: z.number() }))
    .query(async ({ ctx, input }) => {
      console.log(`[campaignKits.getById] kitId=${input.kitId} userId=${ctx.user.id}`);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);

      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: `Campaign kit ${input.kitId} not found for user ${ctx.user.id}` });

      return kit;
    }),

  /**
   * getByUser — returns all campaign kits for the current user with ICP name joined.
   */
  getByUser: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const kits = await db
        .select()
        .from(campaignKits)
        .where(eq(campaignKits.userId, ctx.user.id));

      // Join ICP names
      const icpIds = [...new Set(kits.map(k => k.icpId))];
      const icpMap: Record<number, string> = {};
      if (icpIds.length > 0) {
        for (const icpId of icpIds) {
          const [icp] = await db
            .select({ id: idealCustomerProfiles.id, name: idealCustomerProfiles.name })
            .from(idealCustomerProfiles)
            .where(eq(idealCustomerProfiles.id, icpId))
            .limit(1);
          if (icp) icpMap[icp.id] = icp.name;
        }
      }

      return kits.map(kit => ({
        ...kit,
        icpName: icpMap[kit.icpId] || "Unknown ICP",
      }));
    }),
});
