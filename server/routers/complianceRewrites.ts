/**
 * Compliance Rewrites router (W5 Phase 1).
 *
 * Four procedures:
 *   - getForItem: fetch cached rewrites for one source row (fast path for
 *     the warning panel's expand).
 *   - generateMore: on-demand generate additional alternatives. Idempotent:
 *     if `count` rows already exist, returns them; otherwise tops up.
 *   - accept: mark a rewrite accepted AND write the rewritten text back
 *     to the source table (headlines in Phase 1). Transactional.
 *   - dismiss: mark a rewrite dismissed, keep original.
 *
 * All mutating procedures check process.env.ENABLE_COMPLIANCE_REWRITES and
 * throw FORBIDDEN when off — so a stale client bundle can't write rows
 * behind a disabled flag.
 *
 * getForItem is intentionally flag-agnostic: reads are harmless, and the
 * client's panel only renders under the flag anyway.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  complianceRewrites,
  headlines,
} from "../../drizzle/schema";
import { inArray } from "drizzle-orm";
import { checkCompliance } from "../lib/complianceChecker";
import { rewriteForComplianceBatch } from "../_core/complianceRewrite";

// Feature flag — matched at every call site so production stays a no-op
// until ENABLE_COMPLIANCE_REWRITES=true is flipped on Railway.
function isRewriteEngineEnabled(): boolean {
  return process.env.ENABLE_COMPLIANCE_REWRITES === "true";
}

function assertFlagOn(): void {
  if (!isRewriteEngineEnabled()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Compliance rewrite engine is not enabled.",
    });
  }
}

// Free-tier cap for Phase 1: 3 compliance rewrites per service per user.
// Pro/agency/superuser bypass. Scoped per service (not user-wide) so the
// cap resets when a user starts a new campaign — the alternative ("3
// forever") would feel broken on second-campaign users. Documented in
// the honest-suggestions pass.
const FREE_TIER_REWRITE_CAP = 3;

async function enforceFreeTierRewriteCap(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  user: { id: number; subscriptionTier: string | null; role: string | null },
  serviceId: number,
): Promise<void> {
  if (user.role === "superuser") return;
  if (user.subscriptionTier && user.subscriptionTier !== "trial") return;
  // Count rewrites this user has for this service. complianceRewrites
  // carries serviceId directly (denormalised at insert time) so this is a
  // single indexed lookup — no JOIN needed, works across all sourceTables
  // unchanged when Phases 2/3 add adCopy / landingPage rewrites.
  const existing = await db
    .select({ id: complianceRewrites.id })
    .from(complianceRewrites)
    .where(and(
      eq(complianceRewrites.userId, user.id),
      eq(complianceRewrites.serviceId, serviceId),
    ));
  if (existing.length >= FREE_TIER_REWRITE_CAP) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Free tier compliance rewrite limit reached. Upgrade to Pro for unlimited.",
    });
  }
}

export const complianceRewritesRouter = router({
  // Feature flag probe — exposes the ENABLE_COMPLIANCE_REWRITES env value so
  // the client can decide whether to render the warning panel at all. Cached
  // with staleTime: Infinity on the client since the flag changes only at
  // server restart.
  isEnabled: protectedProcedure.query(() => ({ enabled: isRewriteEngineEnabled() })),

  // Batched fetch: every rewrite for every headline in a given set.
  // Used once on mount by V2HeadlinesResultPanel — avoids firing getForItem
  // per card. Client groups the returned array by sourceId.
  listForHeadlineSet: protectedProcedure
    .input(z.object({ headlineSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const ids = await db
        .select({ id: headlines.id })
        .from(headlines)
        .where(and(eq(headlines.userId, ctx.user.id), eq(headlines.headlineSetId, input.headlineSetId)));
      if (ids.length === 0) return [];
      const rows = await db
        .select()
        .from(complianceRewrites)
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, "headlines"),
          inArray(complianceRewrites.sourceId, ids.map(r => r.id)),
        ))
        .orderBy(desc(complianceRewrites.createdAt));
      // Normalise violationReasons from `unknown` to `string[]` so the
      // client gets a real typed field instead of having to cast.
      return rows.map(r => ({
        ...r,
        violationReasons: Array.isArray(r.violationReasons)
          ? (r.violationReasons as unknown[]).filter((v): v is string => typeof v === "string")
          : [],
      }));
    }),

  // Read cached rewrites for one source row — used when the warning panel expands.
  getForItem: protectedProcedure
    .input(z.object({
      sourceTable: z.enum(["headlines", "adCopy", "landingPages"]),
      sourceId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const rows = await db
        .select()
        .from(complianceRewrites)
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, input.sourceTable),
          eq(complianceRewrites.sourceId, input.sourceId),
        ))
        .orderBy(desc(complianceRewrites.createdAt));
      return rows;
    }),

  // On-demand: generate additional rewrite alternatives for a flagged item.
  // Idempotent — if >= count rows already exist, returns them without
  // invoking Sonnet. Flag- and free-tier-gated.
  generateMore: protectedProcedure
    .input(z.object({
      sourceTable: z.literal("headlines"),
      sourceId: z.number(),
      count: z.number().min(1).max(5).default(2),
    }))
    .mutation(async ({ ctx, input }) => {
      assertFlagOn();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Source row + ownership check.
      const [source] = await db
        .select()
        .from(headlines)
        .where(and(eq(headlines.id, input.sourceId), eq(headlines.userId, ctx.user.id)))
        .limit(1);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Source row not found" });
      if (source.serviceId == null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Source row has no associated service" });
      }

      await enforceFreeTierRewriteCap(db, ctx.user, source.serviceId);

      // Idempotency check: only count rewrites the user hasn't already
      // accepted or dismissed. Without this filter, one accepted rewrite
      // would block further "see 2 more alternatives" because count is
      // already satisfied by the stale accepted row.
      const existing = await db
        .select()
        .from(complianceRewrites)
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, "headlines"),
          eq(complianceRewrites.sourceId, input.sourceId),
          eq(complianceRewrites.userAccepted, false),
          eq(complianceRewrites.userDismissed, false),
        ))
        .orderBy(desc(complianceRewrites.createdAt));
      if (existing.length >= input.count) return existing;

      // Re-derive violations at generate time — headlines table doesn't
      // store the issue array, only the score.
      const compliance = await checkCompliance(source.headline, {
        userId: ctx.user.id,
        generatorType: "headlines",
        trackUsage: false,
      });
      if (compliance.issues.length === 0) {
        // Nothing to rewrite — return existing (possibly empty).
        return existing;
      }

      const needed = input.count - existing.length;
      const fresh = await rewriteForComplianceBatch(
        source.headline,
        compliance.issues,
        "headline",
        {
          niche: null,              // Phase 1: no service-context lookup on this path
          mechanism: source.uniqueMechanism,
          mainBenefit: source.desiredOutcome,
        },
        needed,
      );
      if (fresh.length === 0) return existing;

      const rowsToInsert = fresh.map(r => ({
        userId: ctx.user.id,
        serviceId: source.serviceId!,
        contentType: "headline" as const,
        sourceTable: "headlines",
        sourceId: input.sourceId,
        originalText: source.headline,
        rewrittenText: r.rewrite,
        violationReasons: compliance.issues.map(i => i.reason),
        complianceScore: r.score,
      }));
      await db.insert(complianceRewrites).values(rowsToInsert);

      // After insert: return only live (not-accepted / not-dismissed) rows
      // so the panel sees the up-to-date candidate list.
      const after = await db
        .select()
        .from(complianceRewrites)
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, "headlines"),
          eq(complianceRewrites.sourceId, input.sourceId),
          eq(complianceRewrites.userAccepted, false),
          eq(complianceRewrites.userDismissed, false),
        ))
        .orderBy(desc(complianceRewrites.createdAt));
      return after;
    }),

  // Accept a specific rewrite: mark userAccepted=true AND update the source
  // row's text + compliance score so subsequent renders correctly see the
  // row as compliant (the warning panel re-reads complianceScore on mount
  // to decide whether to render). Phase 1 only knows how to update the
  // `headlines` table. Wrapped in a transaction so we don't half-apply —
  // either both writes land or neither does.
  accept: protectedProcedure
    .input(z.object({ rewriteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertFlagOn();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [rewrite] = await db
        .select()
        .from(complianceRewrites)
        .where(and(eq(complianceRewrites.id, input.rewriteId), eq(complianceRewrites.userId, ctx.user.id)))
        .limit(1);
      if (!rewrite) throw new TRPCError({ code: "NOT_FOUND", message: "Rewrite not found" });
      if (rewrite.sourceTable !== "headlines") {
        // Phases 2/3 will add adCopy / landingPage branches here.
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: `Accept is not yet supported for sourceTable=${rewrite.sourceTable}`,
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(headlines)
          .set({
            headline: rewrite.rewrittenText,
            // Propagate the rewrite's re-scored complianceScore back to the
            // source row so on reload the card no longer classifies as
            // "< 70" and the warning panel doesn't re-show.
            complianceScore: rewrite.complianceScore,
          })
          .where(and(eq(headlines.id, rewrite.sourceId), eq(headlines.userId, ctx.user.id)));

        await tx
          .update(complianceRewrites)
          .set({ userAccepted: true, userDismissed: false })
          .where(eq(complianceRewrites.id, rewrite.id));
      });

      return { success: true, rewrittenText: rewrite.rewrittenText, complianceScore: rewrite.complianceScore };
    }),

  // Dismiss a specific rewrite — keep original, flip the badge to amber
  // "Warning dismissed" client-side.
  dismiss: protectedProcedure
    .input(z.object({ rewriteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertFlagOn();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [rewrite] = await db
        .select({ id: complianceRewrites.id })
        .from(complianceRewrites)
        .where(and(eq(complianceRewrites.id, input.rewriteId), eq(complianceRewrites.userId, ctx.user.id)))
        .limit(1);
      if (!rewrite) throw new TRPCError({ code: "NOT_FOUND", message: "Rewrite not found" });
      await db
        .update(complianceRewrites)
        .set({ userDismissed: true })
        .where(eq(complianceRewrites.id, input.rewriteId));
      return { success: true };
    }),

  // Undismiss — dismissal is a property of the warning on a headline,
  // not of each individual rewrite, so Reconsider restores the
  // pre-dismissal state of the entire headline. Bulk-flips every
  // currently-dismissed, not-accepted rewrite for the source back to
  // live. Ownership enforced via userId match. No time window — a user
  // can reconsider any past dismissal.
  undismiss: protectedProcedure
    .input(z.object({
      sourceTable: z.enum(["headlines", "adCopy", "landingPages"]),
      sourceId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertFlagOn();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      // Pre-count how many rows we're about to flip so the return is
      // deterministic (Drizzle's update result shape isn't stable across
      // drivers for affectedRows introspection).
      const targets = await db
        .select({ id: complianceRewrites.id })
        .from(complianceRewrites)
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, input.sourceTable),
          eq(complianceRewrites.sourceId, input.sourceId),
          eq(complianceRewrites.userDismissed, true),
          eq(complianceRewrites.userAccepted, false),
        ));
      if (targets.length === 0) return { updated: 0 };
      await db
        .update(complianceRewrites)
        .set({ userDismissed: false })
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, input.sourceTable),
          eq(complianceRewrites.sourceId, input.sourceId),
          eq(complianceRewrites.userDismissed, true),
          eq(complianceRewrites.userAccepted, false),
        ));
      return { updated: targets.length };
    }),
});

// Helpers re-exported for the headlines generator hook so the flag check
// and the free-tier cap stay in one place.
export { isRewriteEngineEnabled, enforceFreeTierRewriteCap };
