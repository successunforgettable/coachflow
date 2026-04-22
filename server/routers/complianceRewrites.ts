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
  adCopy,
} from "../../drizzle/schema";
import { inArray } from "drizzle-orm";
import { checkCompliance, type ComplianceIssue } from "../lib/complianceChecker";
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

/**
 * Unified source-row lookup across Phase 1 (headlines) and Phase 2 (adCopy).
 * Returns a normalised shape so downstream code doesn't branch on table.
 *
 *   text             — the rewritable content (headline.headline / adCopy.content)
 *   contentType      — always "headline" for headlines; row-specific for adCopy
 *   violationReasons — normalised to string[] | null regardless of JSON shape
 *
 * Ownership (userId match) enforced by the query WHERE clause; returns null
 * when the row is missing or not owned by the caller.
 */
type SourceRow = {
  id: number;
  text: string;
  serviceId: number | null;
  contentType: "headline" | "body" | "link";
  violationReasons: string[] | null;
  uniqueMechanism: string | null;
  desiredOutcome: string | null;
};

async function getSourceRow(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  sourceTable: "headlines" | "adCopy",
  sourceId: number,
  userId: number,
): Promise<SourceRow | null> {
  const normaliseReasons = (raw: unknown): string[] | null => {
    if (!Array.isArray(raw)) return null;
    const list = (raw as unknown[]).filter((v): v is string => typeof v === "string");
    return list.length > 0 ? list : null;
  };

  if (sourceTable === "headlines") {
    const [row] = await db
      .select()
      .from(headlines)
      .where(and(eq(headlines.id, sourceId), eq(headlines.userId, userId)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      text: row.headline,
      serviceId: row.serviceId,
      contentType: "headline",
      violationReasons: normaliseReasons(row.violationReasons),
      uniqueMechanism: row.uniqueMechanism,
      desiredOutcome: row.desiredOutcome,
    };
  }

  // adCopy
  const [row] = await db
    .select()
    .from(adCopy)
    .where(and(eq(adCopy.id, sourceId), eq(adCopy.userId, userId)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    text: row.content,
    serviceId: row.serviceId,
    contentType: row.contentType,
    violationReasons: normaliseReasons(row.violationReasons),
    uniqueMechanism: row.uniqueMechanism,
    desiredOutcome: row.desiredOutcome,
  };
}

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

  // Batched fetch for the Node 7 Copy tab: every rewrite for every
  // adCopy row in a given adSetId. Mirror of listForHeadlineSet — fires
  // once on mount, client groups by sourceId.
  listForAdSet: protectedProcedure
    .input(z.object({ adSetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const ids = await db
        .select({ id: adCopy.id })
        .from(adCopy)
        .where(and(eq(adCopy.userId, ctx.user.id), eq(adCopy.adSetId, input.adSetId)));
      if (ids.length === 0) return [];
      const rows = await db
        .select()
        .from(complianceRewrites)
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, "adCopy"),
          inArray(complianceRewrites.sourceId, ids.map(r => r.id)),
        ))
        .orderBy(desc(complianceRewrites.createdAt));
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
  // Idempotent — if >= count LIVE rows already exist, returns them without
  // invoking Sonnet. Flag- and free-tier-gated.
  //
  // Instrumented end-to-end with `[W5.generateMore]` log lines — every
  // branch logs its exit reason so a silent empty return can never
  // happen undetected again (see R5 bug: live checkCompliance returned
  // zero issues on manually-seeded rows whose stored complianceScore was
  // < 70, so the "no issues detected" early-return fired without any
  // log and Sonnet was never called).
  generateMore: protectedProcedure
    .input(z.object({
      sourceTable: z.enum(["headlines", "adCopy"]),
      sourceId: z.number(),
      count: z.number().min(1).max(5).default(2),
    }))
    .mutation(async ({ ctx, input }) => {
      const flagOn = isRewriteEngineEnabled();
      console.log(`[W5.generateMore] entered — user=${ctx.user.id} role=${ctx.user.role} tier=${ctx.user.subscriptionTier} sourceTable=${input.sourceTable} sourceId=${input.sourceId} count=${input.count} flagOn=${flagOn}`);
      assertFlagOn();
      const db = await getDb();
      if (!db) {
        console.error(`[W5.generateMore] no db — throwing INTERNAL_SERVER_ERROR`);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Source row + ownership check (unified across headlines / adCopy).
      const source = await getSourceRow(db, input.sourceTable, input.sourceId, ctx.user.id);
      if (!source) {
        console.log(`[W5.generateMore] NOT_FOUND — ${input.sourceTable}.${input.sourceId} not owned by user=${ctx.user.id}`);
        throw new TRPCError({ code: "NOT_FOUND", message: "Source row not found" });
      }
      if (source.serviceId == null) {
        console.log(`[W5.generateMore] BAD_REQUEST — ${input.sourceTable}.${input.sourceId} has null serviceId`);
        throw new TRPCError({ code: "BAD_REQUEST", message: "Source row has no associated service" });
      }
      console.log(`[W5.generateMore] source loaded — table=${input.sourceTable} id=${source.id} serviceId=${source.serviceId} contentType=${source.contentType} violationReasonsStored=${source.violationReasons?.length ?? 0} text="${source.text.slice(0, 60)}"`);

      try {
        await enforceFreeTierRewriteCap(db, ctx.user, source.serviceId);
        console.log(`[W5.generateMore] cap check passed`);
      } catch (err) {
        console.error(`[W5.generateMore] cap check FAILED — role=${ctx.user.role} tier=${ctx.user.subscriptionTier}:`, err instanceof Error ? err.message : err);
        throw err;
      }

      // Idempotency check: only count rewrites the user hasn't already
      // accepted or dismissed.
      const existing = await db
        .select()
        .from(complianceRewrites)
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, input.sourceTable),
          eq(complianceRewrites.sourceId, input.sourceId),
          eq(complianceRewrites.userAccepted, false),
          eq(complianceRewrites.userDismissed, false),
        ))
        .orderBy(desc(complianceRewrites.createdAt));
      console.log(`[W5.generateMore] idempotency check — existing.length=${existing.length} requested=${input.count}`);
      if (existing.length >= input.count) {
        console.log(`[W5.generateMore] RETURN path=idempotent-short-circuit rows=${existing.length}`);
        return existing;
      }

      // R5 fix: prefer stored violationReasons over re-running checkCompliance.
      // Stored reasons are the server-of-record at insert time; the live
      // re-check bailed on manually-seeded QA rows and on rows whose phrases
      // had been pruned from bannedPhrases. Fall back to live only on
      // legacy rows whose stored column is NULL.
      let issues: ComplianceIssue[];
      let issuesSource: "stored" | "live";
      if (source.violationReasons && source.violationReasons.length > 0) {
        issuesSource = "stored";
        issues = source.violationReasons.map(reason => ({
          severity: "warning" as const,
          phrase: "(stored)",
          reason,
          suggestion: "Rephrase to comply with Meta advertising policies",
        }));
      } else {
        const live = await checkCompliance(source.text, {
          userId: ctx.user.id,
          generatorType: input.sourceTable,
          trackUsage: false,
        });
        issuesSource = "live";
        issues = live.issues;
        console.log(`[W5.generateMore] live checkCompliance — score=${live.score} issueCount=${live.issues.length}`);
      }
      console.log(`[W5.generateMore] issues resolved — source=${issuesSource} count=${issues.length}`);

      if (issues.length === 0) {
        console.log(`[W5.generateMore] RETURN path=no-issues-detected — neither stored nor live violations found; Sonnet NOT invoked. rows=${existing.length}`);
        return existing;
      }

      const needed = input.count - existing.length;
      console.log(`[W5.generateMore] calling rewriteForComplianceBatch — needed=${needed} issueCount=${issues.length} contentType=${source.contentType}`);

      let fresh: Awaited<ReturnType<typeof rewriteForComplianceBatch>>;
      try {
        fresh = await rewriteForComplianceBatch(
          source.text,
          issues,
          source.contentType,
          {
            niche: null,
            mechanism: source.uniqueMechanism,
            mainBenefit: source.desiredOutcome,
          },
          needed,
        );
      } catch (err) {
        console.error(`[W5.generateMore] rewriteForComplianceBatch threw — propagating:`, err instanceof Error ? err.message : err);
        throw err;
      }
      fresh.forEach((r, i) => {
        console.log(`[W5.generateMore] fresh[${i}] score=${r.score} rewrite="${r.rewrite.slice(0, 60)}"`);
      });

      if (fresh.length === 0) {
        console.log(`[W5.generateMore] RETURN path=no-fresh-rewrites — Sonnet produced nothing across ${needed} attempt(s); rows=${existing.length}`);
        return existing;
      }

      const rowsToInsert = fresh.map(r => ({
        userId: ctx.user.id,
        serviceId: source.serviceId!,
        contentType: source.contentType,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        originalText: source.text,
        rewrittenText: r.rewrite,
        violationReasons: issues.map(i => i.reason),
        complianceScore: r.score,
      }));
      await db.insert(complianceRewrites).values(rowsToInsert);
      console.log(`[W5.generateMore] inserted ${rowsToInsert.length} rewrite rows`);

      // After insert: return only live (not-accepted / not-dismissed) rows.
      const after = await db
        .select()
        .from(complianceRewrites)
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, input.sourceTable),
          eq(complianceRewrites.sourceId, input.sourceId),
          eq(complianceRewrites.userAccepted, false),
          eq(complianceRewrites.userDismissed, false),
        ))
        .orderBy(desc(complianceRewrites.createdAt));
      console.log(`[W5.generateMore] RETURN path=success rows=${after.length}`);
      return after;
    }),

  // Accept a specific rewrite: mark userAccepted=true AND update the source
  // row's text + compliance score so subsequent renders correctly see the
  // row as compliant (the warning panel re-reads complianceScore on mount
  // to decide whether to render). Dispatches by sourceTable — Phase 1
  // targets headlines; Phase 2 adds adCopy. Wrapped in a transaction so
  // we don't half-apply — either both writes land or neither does.
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

      if (rewrite.sourceTable === "headlines") {
        await db.transaction(async (tx) => {
          await tx
            .update(headlines)
            .set({
              headline: rewrite.rewrittenText,
              complianceScore: rewrite.complianceScore,
            })
            .where(and(eq(headlines.id, rewrite.sourceId), eq(headlines.userId, ctx.user.id)));
          await tx
            .update(complianceRewrites)
            .set({ userAccepted: true, userDismissed: false })
            .where(eq(complianceRewrites.id, rewrite.id));
        });
      } else if (rewrite.sourceTable === "adCopy") {
        await db.transaction(async (tx) => {
          await tx
            .update(adCopy)
            .set({
              content: rewrite.rewrittenText,
              complianceScore: rewrite.complianceScore,
            })
            .where(and(eq(adCopy.id, rewrite.sourceId), eq(adCopy.userId, ctx.user.id)));
          await tx
            .update(complianceRewrites)
            .set({ userAccepted: true, userDismissed: false })
            .where(eq(complianceRewrites.id, rewrite.id));
        });
      } else {
        // Phase 3 adds landingPages branch here.
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: `Accept is not yet supported for sourceTable=${rewrite.sourceTable}`,
        });
      }

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
