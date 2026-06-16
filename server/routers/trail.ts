/**
 * Trail router — Trail Sprint 1, Commit 4.
 *
 * Read-side state for the Campaign Trail page plus transcript persistence.
 * All procedures are kit-ownership-scoped. The selected*Id completion
 * inference and cascade prereqs are read-only here — nothing in this
 * router mutates campaignKits.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  campaignKits,
  nodeStatuses,
  chatTranscripts,
  idealCustomerProfiles,
  type CampaignKit,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/** Loads a kit and verifies the caller owns it. Throws NOT_FOUND otherwise. */
async function getOwnedKit(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, kitId: number, userId: number): Promise<CampaignKit> {
  const [kit] = await db
    .select()
    .from(campaignKits)
    .where(and(eq(campaignKits.id, kitId), eq(campaignKits.userId, userId)))
    .limit(1);
  if (!kit) throw new TRPCError({ code: "NOT_FOUND", message: `Campaign kit ${kitId} not found` });
  return kit;
}

/**
 * Persisted chat message shape — mirrors ChatThread's ChatMessage.
 * passthrough() keeps richer Sprint 2/3 payloads (reveal, deck, milestone)
 * storable without a schema change.
 */
const chatMessageSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum([
    "zappy-bubble", "user-bubble", "chip-row", "asset-reveal-card",
    "card-deck", "milestone-badge", "system-divider",
  ]),
  text: z.string().max(8000).optional(),
  mood: z.enum(["idle", "thinking", "celebrating"]).optional(),
  nodeKey: z.string().max(50).optional(),
  chips: z.array(z.string().max(200)).optional(),
}).passthrough();

/** Clears a stale nodeStatuses row (after regeneration). */
async function clearStaleNode(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, kitId: number, nodeType: string) {
  await db.delete(nodeStatuses).where(
    and(eq(nodeStatuses.campaignKitId, kitId), eq(nodeStatuses.nodeType, nodeType)),
  );
}

/** Sprint 4 C3: quota status for deal-more chips. */
const DEALABLE_GENERATORS: { step: string; generatorType: string; countField: string }[] = [
  { step: "offer",     generatorType: "offers",          countField: "offerGeneratedCount" },
  { step: "mechanism", generatorType: "heroMechanisms",   countField: "heroMechanismGeneratedCount" },
  { step: "hvco",      generatorType: "hvco",             countField: "hvcoGeneratedCount" },
  { step: "headlines", generatorType: "headlines",         countField: "headlineGeneratedCount" },
  { step: "adCopy",    generatorType: "adCopy",            countField: "adCopyGeneratedCount" },
  { step: "landingPage", generatorType: "landingPages",    countField: "landingPageGeneratedCount" },
];

export const trailRouter = router({
  /**
   * getTrailState — everything the Trail page needs to derive the 11 stop
   * states: the kit's selected*Id columns, nodeStatuses overrides
   * (imported/stale), and the ICP's serviceId for the "service" stop.
   */
  getTrailState: protectedProcedure
    .input(z.object({ campaignKitId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const kit = await getOwnedKit(db, input.campaignKitId, ctx.user.id);

      const statuses = await db
        .select({ nodeType: nodeStatuses.nodeType, status: nodeStatuses.status })
        .from(nodeStatuses)
        .where(eq(nodeStatuses.campaignKitId, kit.id));

      const [icp] = await db
        .select({ serviceId: idealCustomerProfiles.serviceId })
        .from(idealCustomerProfiles)
        .where(eq(idealCustomerProfiles.id, kit.icpId))
        .limit(1);

      return {
        kit,
        statuses,
        serviceId: icp?.serviceId ?? null,
      };
    }),

  /**
   * getTranscript — the persisted chat messages for a kit, or null when the
   * kit has no transcript yet (the Trail renders its welcome state then).
   */
  getTranscript: protectedProcedure
    .input(z.object({ campaignKitId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await getOwnedKit(db, input.campaignKitId, ctx.user.id);

      const [row] = await db
        .select()
        .from(chatTranscripts)
        .where(eq(chatTranscripts.campaignKitId, input.campaignKitId))
        .limit(1);

      return row ? { messages: row.messages as unknown[] } : null;
    }),

  /**
   * appendMessages — appends messages to the kit's transcript, creating the
   * chatTranscripts row on first write (one row per kit, unique index).
   */
  appendMessages: protectedProcedure
    .input(z.object({
      campaignKitId: z.number(),
      // 50: intake transcripts flush in one call (typically 10–20 messages).
      messages: z.array(chatMessageSchema).min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await getOwnedKit(db, input.campaignKitId, ctx.user.id);

      const [existing] = await db
        .select()
        .from(chatTranscripts)
        .where(eq(chatTranscripts.campaignKitId, input.campaignKitId))
        .limit(1);

      if (existing) {
        const current = Array.isArray(existing.messages) ? existing.messages as unknown[] : [];
        await db
          .update(chatTranscripts)
          .set({ messages: [...current, ...input.messages] })
          .where(eq(chatTranscripts.id, existing.id));
      } else {
        await db.insert(chatTranscripts).values({
          campaignKitId: input.campaignKitId,
          messages: input.messages,
        });
      }

      return { ok: true };
    }),

  /**
   * getQuotaStatus — remaining generation count per dealable node.
   * Used by the "Deal a fresh set · {n} left" chip in the manual loop.
   */
  getQuotaStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const { getQuotaLimit } = await import("../quotaLimits");
      const user = ctx.user as Record<string, unknown>;
      const tier = (user.subscriptionTier ?? "trial") as "trial" | "pro" | "agency";
      const role = String(user.role ?? "user");
      return DEALABLE_GENERATORS.map(dg => {
        const limit = getQuotaLimit(tier, dg.generatorType as any, role);
        const used = Number(user[dg.countField] ?? 0);
        return {
          step: dg.step,
          remaining: limit === Infinity ? 999 : Math.max(0, limit - used),
          unlimited: limit === Infinity,
        };
      });
    }),

  /**
   * markImported — upserts a nodeStatuses row with status='imported' so the
   * TrailBar shows the paperclip badge. Kit-ownership-scoped.
   */
  markImported: protectedProcedure
    .input(z.object({
      campaignKitId: z.number(),
      nodeType: z.string().min(1).max(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await getOwnedKit(db, input.campaignKitId, ctx.user.id);
      await db.insert(nodeStatuses).values({
        campaignKitId: input.campaignKitId,
        nodeType: input.nodeType,
        status: "imported",
      }).onDuplicateKeyUpdate({ set: { status: "imported", updatedAt: new Date() } });
      return { ok: true };
    }),

  /**
   * clearStale — removes a stale nodeStatuses row after a node has been
   * regenerated by "Update the rest". Kit-ownership-scoped.
   */
  clearStale: protectedProcedure
    .input(z.object({
      campaignKitId: z.number(),
      nodeType: z.string().min(1).max(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await getOwnedKit(db, input.campaignKitId, ctx.user.id);
      await clearStaleNode(db, input.campaignKitId, input.nodeType);
      return { ok: true };
    }),

  /**
   * dismissStale — flips all stale rows to 'dismissed' for a kit.
   * Amber flags persist on the trail bar, but return-visit chips stop re-offering.
   * A re-tweak naturally flips dismissed→stale via the markTweakStale upsert.
   */
  dismissStale: protectedProcedure
    .input(z.object({ campaignKitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await getOwnedKit(db, input.campaignKitId, ctx.user.id);
      await db.update(nodeStatuses)
        .set({ status: "dismissed" })
        .where(and(
          eq(nodeStatuses.campaignKitId, input.campaignKitId),
          eq(nodeStatuses.status, "stale"),
        ));
      return { ok: true };
    }),
});
