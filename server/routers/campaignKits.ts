import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { campaignKits, idealCustomerProfiles, services, offers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export async function autoSelectBest(
  userId: number,
  icpId: number,
  field: string,
  // Phase C C1: widened to number|string. 8 text-asset selectedXxxId fields
  // are numeric row IDs; selectedAdCreativeBatchId is a varchar(100) batchId
  // pointing to the adCreatives.batchId grouping. Both shapes go through
  // the same auto-select-on-cascade-completion path; Drizzle's set() accepts
  // either because the column types differ per field.
  itemId: number | string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Find or create kit
  const [existing] = await db
    .select()
    .from(campaignKits)
    .where(and(eq(campaignKits.userId, userId), eq(campaignKits.icpId, icpId)))
    .limit(1);

  let kitId: number;
  if (existing) {
    kitId = existing.id;
  } else {
    // Auto-create with generic name
    const result: any = await db.insert(campaignKits).values({
      userId,
      icpId,
      name: "Auto Campaign Kit",
    });
    kitId = result[0].insertId;
  }

  // Update the specific selection field
  await db
    .update(campaignKits)
    .set({ [field]: itemId, updatedAt: new Date() } as any)
    .where(eq(campaignKits.id, kitId));

  // Check completeness
  const [updated] = await db
    .select()
    .from(campaignKits)
    .where(eq(campaignKits.id, kitId))
    .limit(1);

  if (updated) {
    const isComplete =
      updated.selectedOfferId != null &&
      updated.selectedMechanismId != null &&
      updated.selectedHvcoId != null &&
      updated.selectedHeadlineId != null &&
      updated.selectedAdCopyId != null &&
      updated.selectedLandingPageId != null &&
      updated.selectedEmailSequenceId != null &&
      updated.selectedWhatsAppSequenceId != null &&
      // Phase C C1: ad creative batch required for new-cascade completeness.
      // Legacy kits (id ≤ 15) that completed before C1 already have
      // status='complete' set — this check only flips draft→complete, so
      // they're not retroactively re-evaluated. New Auto Mode runs after
      // C1 wait for adCreatives step 9 before flipping.
      updated.selectedAdCreativeBatchId != null;

    if (isComplete && updated.status === "draft") {
      const completionUpdate: Record<string, unknown> = { status: "complete", updatedAt: new Date() };

      // Auto-derive title from offer's productName — but only if name is
      // still the generic "Auto Campaign Kit" default. Never overwrite a
      // manual/custom title or the "{Service} — {ICP} Campaign" name.
      if (updated.name === "Auto Campaign Kit" && updated.selectedOfferId) {
        const [offer] = await db.select().from(offers).where(eq(offers.id, updated.selectedOfferId)).limit(1);
        if (offer?.productName) {
          completionUpdate.name = offer.productName;
        }
      }

      await db.update(campaignKits).set(completionUpdate as any).where(eq(campaignKits.id, kitId));
    }
  }
}

export const campaignKitsRouter = router({
  /**
   * getOrCreate — finds or creates a campaign kit for a given ICP.
   * Auto-generates the name as "{serviceName} — {icpName} Campaign".
   */
  getOrCreate: protectedProcedure
    .input(z.object({
      icpId: z.number(),
      // Workstream commit 2.5b — optional funnel-type field. Sets the kit's
      // campaignType at creation time. Existing callsites that omit it leave
      // the column NULL (downstream generators default to course_launch).
      // The 7 enum values match campaignKits.campaignType (migration 0067).
      campaignType: z.enum([
        "webinar", "challenge", "course_launch", "product_launch",
        "discovery_call", "lead_magnet", "in_person_event",
      ]).optional(),
      // Trail Sprint 2 — optional entry path (migration 0076 column). When
      // omitted, behaviour is unchanged and the column stays NULL.
      path: z.enum(["auto", "manual", "has_assets"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Check for existing kit
      const [existing] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.userId, ctx.user.id), eq(campaignKits.icpId, input.icpId)))
        .limit(1);

      if (existing) {
        // Trail Sprint 2: record/refresh the entry path when supplied
        // (path is mutable by design — users can switch mid-campaign).
        if (input.path && existing.path !== input.path) {
          await db
            .update(campaignKits)
            .set({ path: input.path, updatedAt: new Date() } as any)
            .where(eq(campaignKits.id, existing.id));
          return { ...existing, path: input.path };
        }
        return existing;
      }

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
        // Workstream commit 2.5b — write campaignType when supplied; null
        // otherwise. Generators default to course_launch when null.
        campaignType: input.campaignType ?? null,
        // Trail Sprint 2 — entry path when supplied; NULL otherwise.
        path: input.path ?? null,
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
      // Workstream commit 2.5b — optional funnel-type update. Lets the kit
      // owner change campaignType post-creation (used by commit 7's UI).
      // Nullable so callers can clear the field; existing callsites that
      // omit it leave the column unchanged (the loop below skips undefined).
      campaignType: z.enum([
        "webinar", "challenge", "course_launch", "product_launch",
        "discovery_call", "lead_magnet", "in_person_event",
      ]).nullable().optional(),
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

      // Track node_completed event (non-blocking)
      try {
        const { trackEvent } = await import("../lib/productEvents");
        const nodeField = Object.keys(fields).find(k => k.startsWith("selected") && (fields as any)[k] != null);
        if (nodeField) await trackEvent(ctx.user.id, "node_completed", { node: nodeField, kitId: input.kitId });
      } catch (_) { /* ignore */ }

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
        // Fire campaign_completed event
        try {
          const { trackEvent: te } = await import("../lib/productEvents");
          await te(ctx.user.id, "campaign_completed", { kitId: input.kitId });
        } catch (_) {}
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

  hasCompletedCampaign: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return false;
      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.userId, ctx.user.id), eq(campaignKits.status, "complete")))
        .limit(1);
      return !!kit;
    }),

  /**
   * updateName — rename a campaign kit. Owner-scoped: only the kit owner
   * can rename it. Persists the user's custom title so it survives
   * regeneration (autoSelectBest never overwrites a non-default name).
   */
  updateName: protectedProcedure
    .input(z.object({
      kitId: z.number(),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);

      if (!kit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });
      }

      await db
        .update(campaignKits)
        .set({ name: input.name, updatedAt: new Date() } as any)
        .where(eq(campaignKits.id, input.kitId));

      return { success: true };
    }),

  // ── Wizard event tracking (client → product_events) ──
  trackWizardEvent: protectedProcedure
    .input(
      z.object({
        eventType: z.string(),
        // zod v4 requires explicit key schema — z.record(z.unknown()) parses
        // with an undefined value schema and 400s every call ("_zod" TypeError).
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { trackEvent } = await import("../lib/productEvents");
      await trackEvent(ctx.user.id, input.eventType, input.metadata);
      return { ok: true };
    }),
});
