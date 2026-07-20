import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { campaignKits, idealCustomerProfiles, services, offers, nodeStatuses, users } from "../../drizzle/schema";
import type { LandingPageContent } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { deriveOperatorQuestions, deriveAnsweredOperatorFields, applyOperatorAnswer, expandOperatorAnswer } from "../lib/templates/operatorFields";
import { pageTypeForCampaign } from "../_core/orchestration";
import { getCoachBookingUrl } from "../lib/coachBookingUrl";

const MAX_KIT_NAME = 255;

/** Build a kit name from service + ICP, length-guarded to fit varchar(255).
 *  Keeps service name intact, elides ICP at a word boundary when needed. */
function buildKitName(serviceName: string | null | undefined, icpName: string | null | undefined): string {
  const svc = (serviceName ?? "").trim();
  const icp = (icpName ?? "").trim();
  if (!svc && !icp) return "Campaign";
  if (!svc) return icp.length <= MAX_KIT_NAME ? icp : `${icp.slice(0, MAX_KIT_NAME - 1)}…`;

  const suffix = " Campaign";
  const separator = " — ";
  // Service-only fallback when no ICP
  if (!icp) return `${svc}${suffix}`.slice(0, MAX_KIT_NAME);

  const full = `${svc}${separator}${icp}${suffix}`;
  if (full.length <= MAX_KIT_NAME) return full;

  // Truncate ICP portion at a word boundary
  const budget = MAX_KIT_NAME - svc.length - separator.length - suffix.length - 1; // -1 for "…"
  if (budget <= 10) return `${svc}${suffix}`.slice(0, MAX_KIT_NAME);
  const trimmed = icp.slice(0, budget).replace(/\s+\S*$/, "");
  return `${svc}${separator}${trimmed || icp.slice(0, budget)}…${suffix}`;
}

// Shared downstream maps — used by both updateSelection (re-crown) and
// markTweakStale (in-place edit) to propagate staleness consistently.
const STALE_FIELD_TO_NODE: Record<string, string> = {
  selectedOfferId: "offer",
  selectedMechanismId: "uniqueMethod",
  selectedHvcoId: "freeOptIn",
  selectedHeadlineId: "headlines",
  selectedAdCopyId: "adCopy",
  selectedLandingPageId: "landingPage",
  selectedEmailSequenceId: "emailSequence",
  selectedWhatsAppSequenceId: "whatsappSequence",
  selectedAdCreativeBatchId: "adCreatives",
};
const STALE_NODE_DOWNSTREAM: Record<string, string[]> = {
  offer: ["uniqueMethod", "freeOptIn", "headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  uniqueMethod: ["freeOptIn", "headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  freeOptIn: ["headlines", "adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  headlines: ["adCopy", "landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  adCopy: ["landingPage", "emailSequence", "whatsappSequence", "adCreatives"],
  landingPage: ["emailSequence", "whatsappSequence", "adCreatives"],
  emailSequence: ["whatsappSequence", "adCreatives"],
  whatsappSequence: ["adCreatives"],
};
const STALE_NODE_TO_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(STALE_FIELD_TO_NODE).map(([f, n]) => [n, f]),
);

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
    // Fetch ICP + service to build a rich name
    const [icp] = await db.select().from(idealCustomerProfiles).where(eq(idealCustomerProfiles.id, icpId)).limit(1);
    let serviceName: string | null = null;
    if (icp?.serviceId) {
      const [svc] = await db.select().from(services).where(eq(services.id, icp.serviceId)).limit(1);
      if (svc) serviceName = svc.name;
    }
    const name = buildKitName(serviceName, icp?.name);
    const result: any = await db.insert(campaignKits).values({
      userId,
      icpId,
      name,
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

      // Names are now rich from creation. No completion rename needed —
      // the buildKitName pattern is the final name.

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

      let serviceName: string | null = null;
      if (icp.serviceId) {
        const [svc] = await db
          .select()
          .from(services)
          .where(eq(services.id, icp.serviceId))
          .limit(1);
        if (svc) serviceName = svc.name;
      }

      const name = buildKitName(serviceName, icp.name);

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

  // ── Campaign facts (Phase 1 / Problem A) — capture operator facts UPFRONT, before any generation node ──
  // Kit-level twins of getPublishReadiness / answerOperatorField: the SAME intake resolver
  // (deriveOperatorQuestions / applyOperatorAnswer), sourced from campaignKits.campaignFacts
  // (eventSchedule + price) + the coach booking column, keyed off the kit's campaignType. Booking stays
  // coach-level (users column). Read later by orchestration's email/whatsapp/LP steps so they generate
  // with REAL facts (no hardcoded sequenceLength:3, no [INSERT_*] placeholders). Wizard path only.
  getCampaignFactsReadiness: protectedProcedure
    .input(z.object({ kitId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [kit] = await db.select().from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id))).limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found" });
      const pageType = pageTypeForCampaign(kit.campaignType);
      const facts = (kit.campaignFacts ?? {}) as LandingPageContent;
      const bookingUrl = await getCoachBookingUrl(kit.userId);
      const questions = deriveOperatorQuestions(pageType, facts, { bookingUrl });
      const answered = deriveAnsweredOperatorFields(pageType, facts, { bookingUrl });
      return { kitId: kit.id, campaignType: kit.campaignType, pageType, ready: questions.length === 0, remaining: questions.length, questions, answered };
    }),

  answerCampaignFact: protectedProcedure
    .input(z.object({ kitId: z.number(), token: z.string().max(60), answer: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [kit] = await db.select().from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id))).limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Kit not found" });
      const pageType = pageTypeForCampaign(kit.campaignType);
      let facts = (kit.campaignFacts ?? {}) as LandingPageContent;
      let coachColumn: { column: string; value: string } | undefined;
      if (input.answer !== "__SKIP__") {
        // Front-load: a full datetime on the date question fills date+time+tz. applyOperatorAnswer sets the
        // structured field on the facts object (facts carry no copy → the copy-substitution is a no-op);
        // a coach-scoped answer (booking) comes back as coachColumn → users row.
        for (const w of expandOperatorAnswer(input.token, input.answer)) {
          const applied = applyOperatorAnswer(facts, w.token, w.value);
          facts = applied.content;
          if (applied.coachColumn) coachColumn = applied.coachColumn;
        }
        await db.update(campaignKits).set({ campaignFacts: facts as any }).where(eq(campaignKits.id, kit.id));
        if (coachColumn) {
          await db.update(users).set({ [coachColumn.column]: coachColumn.value } as any).where(eq(users.id, kit.userId));
        }
      }
      const bookingUrl = coachColumn?.column === "bookingUrl" ? coachColumn.value : await getCoachBookingUrl(kit.userId);
      const questions = deriveOperatorQuestions(pageType, facts, { bookingUrl });
      const answered = deriveAnsweredOperatorFields(pageType, facts, { bookingUrl });
      return { kitId: kit.id, campaignType: kit.campaignType, pageType, ready: questions.length === 0, remaining: questions.length, questions, answered };
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
      selectedAdCreativeBatchId: z.string().nullable().optional(),
      adImageStyle: z.string().nullable().optional(),
      // Sprint 4 C3: mid-campaign path switching. Mutable by design (spec §4
      // line 134). Existing callers that omit it leave the column unchanged.
      path: z.enum(["auto", "manual", "has_assets"]).optional(),
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

      // ── Sprint 4 C2: server-side stale propagation ──────────────────────
      // On a RE-CROWN (a selected*Id field changes from one non-null value to
      // another), every DOWNSTREAM step that currently has a non-null
      // selected*Id gets marked stale in nodeStatuses. This fires for BOTH
      // the Trail and the wizard — one truth, both surfaces.
      const FIELD_TO_NODE = STALE_FIELD_TO_NODE;
      const NODE_DOWNSTREAM = STALE_NODE_DOWNSTREAM;
      const NODE_TO_FIELD = STALE_NODE_TO_FIELD;
      try {
        // Identify which node was changed
        const changedField = Object.keys(fields).find(k =>
          k.startsWith("selected") && (fields as any)[k] != null && k !== "selectedLandingPageAngle" && k !== "campaignType",
        );
        if (changedField) {
          const changedNode = FIELD_TO_NODE[changedField];
          const oldValue = (kit as Record<string, unknown>)[changedField];
          const newValue = (fields as any)[changedField];
          // Only on a RE-CROWN (old was non-null, new differs)
          if (changedNode && oldValue != null && oldValue !== newValue) {
            const downstream = NODE_DOWNSTREAM[changedNode] ?? [];
            // Read the UPDATED kit (already fetched above as `updated`)
            const [freshKit] = await db.select().from(campaignKits).where(eq(campaignKits.id, input.kitId)).limit(1);
            const staleNodes: string[] = [];
            for (const dsNode of downstream) {
              const dsField = NODE_TO_FIELD[dsNode];
              if (dsField && (freshKit as Record<string, unknown>)[dsField] != null) {
                staleNodes.push(dsNode);
              }
            }
            // Upsert stale rows — ON DUPLICATE KEY UPDATE status='stale'
            for (const nodeType of staleNodes) {
              await db.insert(nodeStatuses).values({
                campaignKitId: input.kitId,
                nodeType,
                status: "stale",
              }).onDuplicateKeyUpdate({ set: { status: "stale", updatedAt: new Date() } });
            }
            // Clear stale on the CHANGED node itself (it was just crowned fresh)
            if (changedNode) {
              await db.delete(nodeStatuses).where(
                and(eq(nodeStatuses.campaignKitId, input.kitId), eq(nodeStatuses.nodeType, changedNode)),
              );
            }
          }
        }
      } catch (staleErr) {
        console.warn("[updateSelection] stale propagation failed:", staleErr instanceof Error ? staleErr.message : staleErr);
      }

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
   * markTweakStale — after an in-place tweak (content edit without ID change),
   * propagate staleness to all downstream nodes. Same logic as re-crown but
   * triggered explicitly by the client after a successful tweak.
   */
  markTweakStale: protectedProcedure
    .input(z.object({ kitId: z.number(), tweakedNode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify ownership
      const [kit] = await db
        .select()
        .from(campaignKits)
        .where(and(eq(campaignKits.id, input.kitId), eq(campaignKits.userId, ctx.user.id)))
        .limit(1);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND" });

      const downstream = STALE_NODE_DOWNSTREAM[input.tweakedNode] ?? [];
      const staleNodes: string[] = [];
      for (const dsNode of downstream) {
        const dsField = STALE_NODE_TO_FIELD[dsNode];
        if (dsField && (kit as Record<string, unknown>)[dsField] != null) {
          staleNodes.push(dsNode);
        }
      }
      for (const nodeType of staleNodes) {
        await db.insert(nodeStatuses).values({
          campaignKitId: input.kitId,
          nodeType,
          status: "stale",
        }).onDuplicateKeyUpdate({ set: { status: "stale", updatedAt: new Date() } });
      }
      return { staleCount: staleNodes.length };
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

      if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign kit not found" });

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
