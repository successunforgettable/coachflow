/**
 * Compliance Rewrites router (W5 Phase 1 — headlines, Phase 2 — adCopy,
 * Phase 3 — landingPages).
 *
 * Procedures:
 *   - getForItem: fetch cached rewrites for one source row.
 *   - listForHeadlineSet / listForAdSet / listForLandingPage: batched
 *     fetch, fired once on panel mount.
 *   - generateMore: on-demand top-up of alternatives. Idempotent.
 *   - accept: mark a rewrite accepted AND write the rewritten text back
 *     to the source. Phase 1 = headlines.headline; Phase 2 = adCopy.content;
 *     Phase 3 = a single section path inside one of the four landingPages
 *     angle JSONs (atomic via JSON_SET). After Phase 3 accept, if the
 *     landing page is published (publicSlug NOT NULL), republish to
 *     Cloudflare KV — fire-and-forget; failure does NOT roll back accept.
 *   - dismiss: mark a rewrite dismissed; per-rewrite-row, so naturally
 *     scoped to (sourceTable, sourceId, sourceSubKey).
 *   - undismiss: bulk-restore. Optional sourceSubKey input scopes the
 *     restore to one section; absent input keeps Phase 1/2 bulk semantics.
 *
 * All mutating procedures check ENABLE_COMPLIANCE_REWRITES and throw
 * FORBIDDEN when off — so a stale client bundle can't write rows behind
 * a disabled flag.
 *
 * getForItem and the listFor* readers are intentionally flag-agnostic:
 * reads are harmless, and the client's panel only renders under the flag
 * anyway.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  complianceRewrites,
  headlines,
  adCopy,
  landingPages,
  services,
  users,
  coachAssets,
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

// 12 simple-string sections that Phase 3 rewrites cover. Mirrors
// LP_STRING_SECTIONS in server/routers/landingPages.ts — kept in lock-step
// because the panel's section-aware label and accept's path validation
// both gate on this set.
const LP_STRING_SECTIONS = new Set([
  "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
  "problemAgitation", "solutionIntro", "whyOldFail", "uniqueMechanism",
  "insiderAdvantages", "scarcityUrgency", "shockingStat", "timeSavingBenefit",
]);

// Map a landing-page section to the rewrite engine's contentType (which
// drives word-count rules + hybrid model routing). Headlines and the CTA
// are short — Sonnet handles them. Everything else is body-shaped
// (100-170 words) and routes to Opus 4.7.
function lpSectionToContentType(sectionKey: string): "headline" | "body" | "link" {
  if (sectionKey === "eyebrowHeadline" || sectionKey === "mainHeadline" || sectionKey === "subheadline") return "headline";
  if (sectionKey === "primaryCta") return "link";
  return "body";
}

// Angle column dispatch table. JSON_SET on accept keys off this map; an
// invalid angle string fails closed via the BAD_REQUEST below rather than
// touching a column the user did not intend.
const LP_ANGLE_COL_MAP = {
  original: "originalAngle",
  godfather: "godfatherAngle",
  free: "freeAngle",
  dollar: "dollarAngle",
} as const;

type LpAngleKey = keyof typeof LP_ANGLE_COL_MAP;

/**
 * Unified source-row lookup across Phases 1-3. Returns a normalised shape
 * so downstream code doesn't branch on table.
 *
 *   text             — the rewritable content
 *   contentType      — drives word-count rules in the rewrite engine
 *   violationReasons — string[] | null regardless of source JSON shape
 *   sourceSubKey     — null for Phase 1/2; "<angle>:<sectionKey>" for Phase 3
 *
 * Ownership (userId match) enforced by the query WHERE clause; returns
 * null when the row is missing or not owned by the caller.
 */
type SourceRow = {
  id: number;
  text: string;
  serviceId: number | null;
  contentType: "headline" | "body" | "link";
  violationReasons: string[] | null;
  uniqueMechanism: string | null;
  desiredOutcome: string | null;
  sourceSubKey: string | null;
};

function normaliseReasons(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const list = (raw as unknown[]).filter((v): v is string => typeof v === "string");
  return list.length > 0 ? list : null;
}

/**
 * Phase 3 — fetch the per-section view of a landing-page row.
 * sourceSubKey is required, formatted "<angle>:<sectionKey>". Validates
 * that:
 *   - angle is one of the four canonical keys,
 *   - sectionKey is in LP_STRING_SECTIONS,
 *   - the LP row exists and is owned by `userId`,
 *   - the parsed angle JSON has the requested section as a string.
 */
async function getLandingPageSection(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  landingPageId: number,
  userId: number,
  sourceSubKey: string,
): Promise<SourceRow | null> {
  const [angleKey, sectionKey] = sourceSubKey.split(":", 2);
  if (!angleKey || !sectionKey) return null;
  if (!(angleKey in LP_ANGLE_COL_MAP)) return null;
  if (!LP_STRING_SECTIONS.has(sectionKey)) return null;

  const [row] = await db
    .select()
    .from(landingPages)
    .where(and(eq(landingPages.id, landingPageId), eq(landingPages.userId, userId)))
    .limit(1);
  if (!row) return null;

  const angleCol = LP_ANGLE_COL_MAP[angleKey as LpAngleKey];
  const rawAngle = (row as Record<string, unknown>)[angleCol];
  const angleData: Record<string, unknown> = typeof rawAngle === "string"
    ? JSON.parse(rawAngle)
    : ((rawAngle as Record<string, unknown>) ?? {});
  const value = angleData[sectionKey];
  if (typeof value !== "string") return null;

  return {
    id: landingPageId,
    text: value,
    serviceId: row.serviceId ?? null,
    contentType: lpSectionToContentType(sectionKey),
    // Landing-page rows don't carry per-section violationReasons in
    // the row — generateMore re-derives via checkCompliance on the
    // section text below.
    violationReasons: null,
    // Landing-page rewrites don't have access to the same niche /
    // mechanism / desiredOutcome columns headlines + adCopy carry. The
    // angle copy itself bakes that context in, so we pass null and let
    // the rewrite engine work from the section text alone.
    uniqueMechanism: null,
    desiredOutcome: null,
    sourceSubKey,
  };
}

async function getSourceRow(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  sourceTable: "headlines" | "adCopy" | "landingPages",
  sourceId: number,
  userId: number,
  sourceSubKey?: string,
): Promise<SourceRow | null> {
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
      sourceSubKey: null,
    };
  }

  if (sourceTable === "adCopy") {
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
      sourceSubKey: null,
    };
  }

  // landingPages — sourceSubKey required.
  if (!sourceSubKey) return null;
  return getLandingPageSection(db, sourceId, userId, sourceSubKey);
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

/**
 * Re-render and write a published landing page's HTML to Cloudflare KV.
 * Skips `deployWorker` — the worker script is static, only the KV
 * content changes on accept. Caller has already verified ownership; this
 * helper does NOT re-validate userId. Throws on any failure; caller
 * decides whether to swallow.
 *
 * Mirrors the read+render logic inside landingPages.publishToCloudflare —
 * inlined rather than refactored to keep Phase 3 changes minimally
 * invasive on the publish path.
 */
async function republishLandingPageToKv(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  landingPageId: number,
): Promise<void> {
  const [lp] = await db
    .select()
    .from(landingPages)
    .where(and(eq(landingPages.id, landingPageId), eq(landingPages.userId, userId)))
    .limit(1);
  if (!lp || !lp.publicSlug) return;

  let serviceName = "Campaign";
  if (lp.serviceId) {
    const [svc] = await db
      .select({ name: services.name })
      .from(services)
      .where(eq(services.id, lp.serviceId))
      .limit(1);
    if (svc) serviceName = svc.name;
  }

  const angleKey = lp.activeAngle || "original";
  const content =
    angleKey === "godfather" ? lp.godfatherAngle
    : angleKey === "free" ? lp.freeAngle
    : angleKey === "dollar" ? lp.dollarAngle
    : lp.originalAngle;
  if (!content) return;

  const styleMode: "text" | "visual" = lp.publishedStyle === "visual" ? "visual" : "text";

  const [coachProfileRow] = await db
    .select({ coachName: users.coachName, coachBackground: users.coachBackground })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const coachName = coachProfileRow?.coachName ?? null;
  const coachBackground = coachProfileRow?.coachBackground ?? null;

  const assetRows = await db
    .select({ assetType: coachAssets.assetType, url: coachAssets.url })
    .from(coachAssets)
    .where(eq(coachAssets.userId, userId));
  const headshotUrl = assetRows.find(a => a.assetType === "headshot")?.url ?? null;
  const logoUrl = assetRows.find(a => a.assetType === "logo")?.url ?? null;
  const socialProofUrls = assetRows.filter(a => a.assetType === "social_proof").map(a => a.url);

  const { buildTextStyleHtml, buildVisualStyleHtml } = await import("../lib/landingPageHtml");
  const { ensureKvNamespace, writeKvPage } = await import("../lib/cloudflare");

  const html = styleMode === "visual"
    ? buildVisualStyleHtml(content, serviceName, { headshotUrl, logoUrl, socialProofUrls, coachName, coachBackground })
    : buildTextStyleHtml(content, serviceName);
  const namespaceId = await ensureKvNamespace();
  await writeKvPage(namespaceId, lp.publicSlug, html);
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

  // Phase 3 — batched fetch for the Node 8 landing-page panel: every
  // rewrite tied to one landingPages row. Client groups by sourceSubKey
  // (one rewrite-stack per "<angle>:<sectionKey>" pair).
  listForLandingPage: protectedProcedure
    .input(z.object({ landingPageId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      // Ownership check: confirm the LP row belongs to the user before
      // surfacing any rewrites for it.
      const [lp] = await db
        .select({ id: landingPages.id })
        .from(landingPages)
        .where(and(eq(landingPages.id, input.landingPageId), eq(landingPages.userId, ctx.user.id)))
        .limit(1);
      if (!lp) return [];
      const rows = await db
        .select()
        .from(complianceRewrites)
        .where(and(
          eq(complianceRewrites.userId, ctx.user.id),
          eq(complianceRewrites.sourceTable, "landingPages"),
          eq(complianceRewrites.sourceId, input.landingPageId),
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
  // invoking the rewrite model. Flag- and free-tier-gated.
  //
  // Phase 3: when sourceTable === "landingPages", `sourceSubKey` is required
  // (format "<angle>:<sectionKey>") so the source-row lookup can pinpoint
  // which section's text to rewrite. The hybrid model also kicks in here:
  // body sections route to Opus 4.7, headline/link to Sonnet 4.6.
  //
  // Instrumented end-to-end with `[W5.generateMore]` log lines — every
  // branch logs its exit reason so a silent empty return can never
  // happen undetected again (see R5 bug: live checkCompliance returned
  // zero issues on manually-seeded rows whose stored complianceScore was
  // < 70, so the "no issues detected" early-return fired without any
  // log and Sonnet was never called).
  generateMore: protectedProcedure
    .input(z.object({
      sourceTable: z.enum(["headlines", "adCopy", "landingPages"]),
      sourceId: z.number(),
      sourceSubKey: z.string().optional(),
      count: z.number().min(1).max(5).default(2),
    }).refine(
      v => v.sourceTable !== "landingPages" || (typeof v.sourceSubKey === "string" && v.sourceSubKey.length > 0),
      { message: "sourceSubKey is required when sourceTable === 'landingPages'", path: ["sourceSubKey"] },
    ))
    .mutation(async ({ ctx, input }) => {
      const flagOn = isRewriteEngineEnabled();
      console.log(`[W5.generateMore] entered — user=${ctx.user.id} role=${ctx.user.role} tier=${ctx.user.subscriptionTier} sourceTable=${input.sourceTable} sourceId=${input.sourceId} sourceSubKey=${input.sourceSubKey ?? "—"} count=${input.count} flagOn=${flagOn}`);
      assertFlagOn();
      const db = await getDb();
      if (!db) {
        console.error(`[W5.generateMore] no db — throwing INTERNAL_SERVER_ERROR`);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Source row + ownership check (unified across headlines / adCopy / landingPages).
      const source = await getSourceRow(db, input.sourceTable, input.sourceId, ctx.user.id, input.sourceSubKey);
      if (!source) {
        console.log(`[W5.generateMore] NOT_FOUND — ${input.sourceTable}.${input.sourceId} sourceSubKey=${input.sourceSubKey ?? "—"} not owned by user=${ctx.user.id}`);
        throw new TRPCError({ code: "NOT_FOUND", message: "Source row not found" });
      }
      if (source.serviceId == null) {
        console.log(`[W5.generateMore] BAD_REQUEST — ${input.sourceTable}.${input.sourceId} has null serviceId`);
        throw new TRPCError({ code: "BAD_REQUEST", message: "Source row has no associated service" });
      }
      console.log(`[W5.generateMore] source loaded — table=${input.sourceTable} id=${source.id} serviceId=${source.serviceId} contentType=${source.contentType} sourceSubKey=${source.sourceSubKey ?? "—"} violationReasonsStored=${source.violationReasons?.length ?? 0} text="${source.text.slice(0, 60)}"`);

      try {
        await enforceFreeTierRewriteCap(db, ctx.user, source.serviceId);
        console.log(`[W5.generateMore] cap check passed`);
      } catch (err) {
        console.error(`[W5.generateMore] cap check FAILED — role=${ctx.user.role} tier=${ctx.user.subscriptionTier}:`, err instanceof Error ? err.message : err);
        throw err;
      }

      // Idempotency check: only count rewrites the user hasn't already
      // accepted or dismissed. For Phase 3 landingPages, scope to the
      // specific section via sourceSubKey — a body and a headline on
      // the same row each get their own alternatives stack.
      const existingFilters = [
        eq(complianceRewrites.userId, ctx.user.id),
        eq(complianceRewrites.sourceTable, input.sourceTable),
        eq(complianceRewrites.sourceId, input.sourceId),
        eq(complianceRewrites.userAccepted, false),
        eq(complianceRewrites.userDismissed, false),
      ];
      if (input.sourceTable === "landingPages" && input.sourceSubKey) {
        existingFilters.push(eq(complianceRewrites.sourceSubKey, input.sourceSubKey));
      }
      const existing = await db
        .select()
        .from(complianceRewrites)
        .where(and(...existingFilters))
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
      // legacy rows whose stored column is NULL — and on Phase 3
      // landingPages where the row never carries per-section reasons.
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
        console.log(`[W5.generateMore] RETURN path=no-issues-detected — neither stored nor live violations found; rewrite engine NOT invoked. rows=${existing.length}`);
        return existing;
      }

      const needed = input.count - existing.length;
      console.log(`[W5.generateMore] calling rewriteForComplianceBatch — needed=${needed} issueCount=${issues.length} contentType=${source.contentType}`);

      // Hybrid model wiring (Phase 3 landingPages only):
      //   body  → Opus 4.7
      //   headline / link → Sonnet (default; modelOverride undefined)
      // Phase 1 / Phase 2 sourceTables always pass undefined.
      const isLp = input.sourceTable === "landingPages";
      const modelOverride = isLp && source.contentType === "body" ? "claude-opus-4-7" : undefined;

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
          modelOverride,
          isLp,
        );
      } catch (err) {
        console.error(`[W5.generateMore] rewriteForComplianceBatch threw — propagating:`, err instanceof Error ? err.message : err);
        throw err;
      }
      fresh.forEach((r, i) => {
        console.log(`[W5.generateMore] fresh[${i}] score=${r.score} model=${r.modelUsed} rewrite="${r.rewrite.slice(0, 60)}"`);
      });

      if (fresh.length === 0) {
        console.log(`[W5.generateMore] RETURN path=no-fresh-rewrites — engine produced nothing across ${needed} attempt(s); rows=${existing.length}`);
        return existing;
      }

      const rowsToInsert = fresh.map(r => ({
        userId: ctx.user.id,
        serviceId: source.serviceId!,
        contentType: source.contentType,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        sourceSubKey: source.sourceSubKey ?? null,
        originalText: source.text,
        rewrittenText: r.rewrite,
        violationReasons: issues.map(i => i.reason),
        complianceScore: r.score,
        modelUsed: r.modelUsed,
      }));
      await db.insert(complianceRewrites).values(rowsToInsert);
      console.log(`[W5.generateMore] inserted ${rowsToInsert.length} rewrite rows`);

      // After insert: return only live (not-accepted / not-dismissed) rows
      // for this source / sub-key.
      const after = await db
        .select()
        .from(complianceRewrites)
        .where(and(...existingFilters))
        .orderBy(desc(complianceRewrites.createdAt));
      console.log(`[W5.generateMore] RETURN path=success rows=${after.length}`);
      return after;
    }),

  // Accept a specific rewrite: mark userAccepted=true AND update the source
  // row so subsequent renders see it as compliant. Dispatches by
  // sourceTable.
  //   headlines  — UPDATE headlines.headline + complianceScore.
  //   adCopy     — UPDATE adCopy.content + complianceScore.
  //   landingPages — atomic JSON_SET on the per-angle JSON column,
  //                  followed by an opportunistic Cloudflare KV
  //                  republish if the page is published. Republish
  //                  failure does NOT roll back the accept (the local
  //                  copy is the source of truth; KV is a derived
  //                  artefact that re-syncs on next manual republish).
  // Wrapped in a transaction so we don't half-apply — either both
  // writes land or neither does. (Republish runs after the tx commits,
  // intentionally outside.)
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

      let republishLpId: number | null = null;

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
      } else if (rewrite.sourceTable === "landingPages") {
        if (!rewrite.sourceSubKey) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Landing-page rewrite is missing sourceSubKey — cannot resolve target section.",
          });
        }
        const [angleKey, sectionKey] = rewrite.sourceSubKey.split(":", 2);
        if (!angleKey || !(angleKey in LP_ANGLE_COL_MAP) || !sectionKey || !LP_STRING_SECTIONS.has(sectionKey)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid sourceSubKey "${rewrite.sourceSubKey}" — expected "<angle>:<sectionKey>" with a known angle and a Phase 3 in-scope section.`,
          });
        }
        const angleCol = LP_ANGLE_COL_MAP[angleKey as LpAngleKey];
        // JSON_SET path is `'$.<sectionKey>'`. sectionKey is whitelisted
        // above (LP_STRING_SECTIONS), so a path injection isn't possible.
        // angleCol is whitelisted via LP_ANGLE_COL_MAP — using sql.raw is
        // safe because every value flowing into it has been match-checked
        // against the four-element angle table; user input never reaches
        // sql.raw.
        const jsonPath = `$.${sectionKey}`;
        const colExpr = sql.raw(`\`${angleCol}\``);
        await db.transaction(async (tx) => {
          await tx.execute(sql`
            UPDATE \`landingPages\`
            SET ${colExpr} = JSON_SET(${colExpr}, ${jsonPath}, ${rewrite.rewrittenText})
            WHERE \`id\` = ${rewrite.sourceId} AND \`userId\` = ${ctx.user.id}
          `);
          await tx
            .update(complianceRewrites)
            .set({ userAccepted: true, userDismissed: false })
            .where(eq(complianceRewrites.id, rewrite.id));
        });
        republishLpId = rewrite.sourceId;
      } else {
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: `Accept is not yet supported for sourceTable=${rewrite.sourceTable}`,
        });
      }

      // Conditional Cloudflare KV republish — landing pages only, only
      // when publicSlug is set, never blocking the accept's success.
      let republished = false;
      if (republishLpId != null) {
        try {
          // Read publicSlug *after* the JSON_SET commits to confirm the
          // page is actually published; republishLandingPageToKv exits
          // early if publicSlug is null.
          const slugRows = await db
            .select({ slug: landingPages.publicSlug })
            .from(landingPages)
            .where(and(eq(landingPages.id, republishLpId), eq(landingPages.userId, ctx.user.id)))
            .limit(1);
          if (slugRows[0]?.slug) {
            await republishLandingPageToKv(db, ctx.user.id, republishLpId);
            republished = true;
          }
        } catch (err) {
          // Swallow — accept already committed. The user can manually
          // republish from the publish panel if KV got out of sync.
          console.warn(`[W5.accept] CF republish failed for LP ${republishLpId}:`, err instanceof Error ? err.message : err);
        }
      }

      return { success: true, rewrittenText: rewrite.rewrittenText, complianceScore: rewrite.complianceScore, republished };
    }),

  // Dismiss a specific rewrite — keep original, flip the badge to amber
  // "Warning dismissed" client-side. Per-rewrite-row, so naturally scoped
  // to (sourceTable, sourceId, sourceSubKey) on Phase 3 surfaces.
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

  // Undismiss — bulk-restore. For Phase 1/2 (headlines, adCopy) the
  // dismissal is a property of the warning on the source row, so
  // Reconsider restores every dismissed-not-accepted rewrite for that
  // row. For Phase 3 (landingPages) the optional `sourceSubKey` input
  // narrows the restore to a single section; without it, we keep the
  // bulk semantics so the existing "Reconsider all" button on
  // headlines / adCopy keeps working unchanged.
  undismiss: protectedProcedure
    .input(z.object({
      sourceTable: z.enum(["headlines", "adCopy", "landingPages"]),
      sourceId: z.number(),
      sourceSubKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertFlagOn();
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const filters = [
        eq(complianceRewrites.userId, ctx.user.id),
        eq(complianceRewrites.sourceTable, input.sourceTable),
        eq(complianceRewrites.sourceId, input.sourceId),
        eq(complianceRewrites.userDismissed, true),
        eq(complianceRewrites.userAccepted, false),
      ];
      if (input.sourceSubKey) {
        filters.push(eq(complianceRewrites.sourceSubKey, input.sourceSubKey));
      }
      // Pre-count how many rows we're about to flip so the return is
      // deterministic (Drizzle's update result shape isn't stable across
      // drivers for affectedRows introspection).
      const targets = await db
        .select({ id: complianceRewrites.id })
        .from(complianceRewrites)
        .where(and(...filters));
      if (targets.length === 0) return { updated: 0 };
      await db
        .update(complianceRewrites)
        .set({ userDismissed: false })
        .where(and(...filters));
      return { updated: targets.length };
    }),
});

// Helpers re-exported for the headlines / adCopy / landingPages generator
// hooks so the flag check, the free-tier cap, and the Phase 3 LP-section
// constants stay in one place.
export {
  isRewriteEngineEnabled,
  enforceFreeTierRewriteCap,
  LP_STRING_SECTIONS,
  lpSectionToContentType,
};
