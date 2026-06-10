import { z } from "zod";
import { randomUUID } from "crypto";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { checkAndResetQuotaIfNeeded } from "../quotaReset";
import { getQuotaLimit } from "../quotaLimits";
import { getDb } from "../db";
import { landingPages, services, users, campaigns, idealCustomerProfiles, sourceOfTruth, jobs, campaignKits, offers, heroMechanisms, hvcoTitles, coachAssets, complianceRewrites } from "../../drizzle/schema";
import { eq, and, desc, like } from "drizzle-orm";
import { generateAllAngles, runLandingPageGeneration } from "../landingPageGenerator";
import { getCascadeContext, validateCascadePrereqs } from "../_core/cascadeContext";
import { invokeLLM } from "../_core/llm";
import { enforceQuota, incrementQuotaCount } from "../lib/quotaEnforcement";
import { checkCompliance } from "../lib/complianceChecker";
import { scoreItem } from "../lib/selectionScorer";
import { autoSelectBest } from "./campaignKits";

function stripMarkdownJson(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

// 12 simple-string sections that Phase 3 compliance rewrites cover.
// Phase 3 MVP — out of scope: nested-array sections (testimonials,
// consultation, FAQ, quiz). These render through different React
// components with different shape contracts; layering rewrites onto them
// is its own design problem and lands in a follow-up phase.
const LP_STRING_SECTIONS = new Set([
  "eyebrowHeadline", "mainHeadline", "subheadline", "primaryCta",
  "problemAgitation", "solutionIntro", "whyOldFail", "uniqueMechanism",
  "insiderAdvantages", "scarcityUrgency", "shockingStat", "timeSavingBenefit",
]);

const LP_FREE_TIER_SECTIONS = new Set(["mainHeadline", "primaryCta"]);

// Map a landing-page section to the rewrite engine's contentType, which
// drives word-count rules and the hybrid model routing in the Phase 3
// precompute path. Mirrors lpSectionToContentType in
// server/routers/complianceRewrites.ts — the duplication keeps both files
// runnable in isolation.
function lpSectionToContentType(sectionKey: string): "headline" | "body" | "link" {
  if (sectionKey === "eyebrowHeadline" || sectionKey === "mainHeadline" || sectionKey === "subheadline") return "headline";
  if (sectionKey === "primaryCta") return "link";
  return "body";
}

const LP_ANGLE_COL_MAP = {
  original: "originalAngle",
  godfather: "godfatherAngle",
  free: "freeAngle",
  dollar: "dollarAngle",
} as const;

type LpAngleKey = keyof typeof LP_ANGLE_COL_MAP;

/**
 * Concurrency-limited map. Mirror of processInChunks in adCopy.ts —
 * inlined here so the landing-page precompute path doesn't take a hard
 * dependency on the adCopy router for a 10-line utility.
 */
async function processInChunks<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((item, offset) => fn(item, i + offset)));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * W5 Phase 3 — pre-compute compliance rewrites for one landing-page
 * row. Behind ENABLE_COMPLIANCE_REWRITES; when off, this is a no-op so
 * production sees no change until Railway flips the flag.
 *
 * Scope:
 *   - 12 simple-string sections of the active angle (LP_STRING_SECTIONS).
 *   - Trial-tier users: narrowed to mainHeadline + primaryCta only.
 *     The other 10 sections show an inline "Pro feature" upgrade message
 *     in the panel; that gating lives client-side in the panel against
 *     the rewrites cache, not server-side here.
 *   - Body sections route to Opus 4.7; headline/link inherit Sonnet 4.6.
 *   - isLandingPageContext=true so the rewrite engine unconditionally
 *     applies the SAC reminder regardless of contentType.
 *
 * COUNT-guard:
 *   - When `targetAngle` is undefined (post-generate path), skip if any
 *     rewrites already exist for this LP — same row through the retry
 *     path automatically becomes a no-op.
 *   - When `targetAngle` is set (angle-switch path), skip if any rewrites
 *     already exist for that specific angle. Other angles' rewrites do
 *     not gate this angle's precompute.
 *
 * Concurrency: processInChunks(sections, 5, …) — 5 model calls in flight
 * at peak, matching the cap in precomputeAdCopyComplianceRewrites.
 *
 * Best-effort: per-section failures are caught and logged. We never let
 * a precompute failure surface to the user-facing generate path.
 */
async function precomputeLandingPageComplianceRewrites(
  user: { id: number; subscriptionTier: string | null; role: string | null },
  landingPageId: number,
  serviceNiche: string | null,
  targetAngle?: LpAngleKey,
): Promise<void> {
  if (process.env.ENABLE_COMPLIANCE_REWRITES !== "true") return;

  try {
    const db = await getDb();
    if (!db) return;
    const { rewriteForCompliance } = await import("../_core/complianceRewrite");
    const { enforceFreeTierRewriteCap } = await import("./complianceRewrites");

    // Ownership + row read.
    const [lp] = await db
      .select()
      .from(landingPages)
      .where(and(eq(landingPages.id, landingPageId), eq(landingPages.userId, user.id)))
      .limit(1);
    if (!lp) {
      console.log(`[W5.precompute] landingPage id=${landingPageId} not found for user=${user.id} — skipping`);
      return;
    }

    const angleKey: LpAngleKey = targetAngle ?? ((lp.activeAngle as LpAngleKey | null) ?? "original");
    if (!(angleKey in LP_ANGLE_COL_MAP)) {
      console.log(`[W5.precompute] landingPage id=${landingPageId} unknown angle=${angleKey} — skipping`);
      return;
    }
    const angleCol = LP_ANGLE_COL_MAP[angleKey];

    // COUNT-guard. Use a LIKE filter on sourceSubKey when scoped to a
    // specific angle (angle-switch path); otherwise count any LP-keyed
    // rewrites for the row (post-generate path).
    const guardFilters = [
      eq(complianceRewrites.userId, user.id),
      eq(complianceRewrites.sourceTable, "landingPages"),
      eq(complianceRewrites.sourceId, landingPageId),
    ];
    if (targetAngle) {
      guardFilters.push(like(complianceRewrites.sourceSubKey, `${targetAngle}:%`));
    }
    const existing = await db
      .select({ id: complianceRewrites.id })
      .from(complianceRewrites)
      .where(and(...guardFilters))
      .limit(1);
    if (existing.length > 0) {
      console.log(`[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} already has rewrites — skipping`);
      return;
    }

    // Free-tier cap (skip-on-fail mirrors adCopy). Service-scoped, same
    // 3-rewrite-per-service ceiling as Phases 1/2.
    const serviceId = lp.serviceId ?? null;
    if (serviceId != null) {
      try { await enforceFreeTierRewriteCap(db, user, serviceId); }
      catch {
        console.log(`[W5.precompute] landingPage id=${landingPageId} free-tier cap hit for user ${user.id} — skipping`);
        return;
      }
    } else {
      console.log(`[W5.precompute] landingPage id=${landingPageId} has null serviceId — skipping (no service to attribute rewrites to)`);
      return;
    }

    // Free-tier section narrowing. Trial users get rewrites only on the
    // two highest-leverage sections; the rest of the in-scope set is
    // gated to Pro/agency.
    const isFreeTier = user.role !== "superuser" && (!user.subscriptionTier || user.subscriptionTier === "trial");
    const inScope = isFreeTier
      ? Array.from(LP_STRING_SECTIONS).filter(s => LP_FREE_TIER_SECTIONS.has(s))
      : Array.from(LP_STRING_SECTIONS);

    const rawAngle = (lp as Record<string, unknown>)[angleCol];
    const angleData: Record<string, unknown> = typeof rawAngle === "string"
      ? JSON.parse(rawAngle)
      : ((rawAngle as Record<string, unknown>) ?? {});

    const rowsToInsert: Array<typeof complianceRewrites.$inferInsert> = [];
    console.log(`[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} sectionsInScope=${inScope.length} freeTier=${isFreeTier}`);

    await processInChunks(inScope, 5, async (sectionKey) => {
      const text = angleData[sectionKey];
      if (typeof text !== "string" || !text.trim()) return;

      try {
        const c = await checkCompliance(text);
        // Threshold for landing pages is 100 — anything short of perfect
        // gets a rewrite suggestion. (Phases 1/2 use 70; landing pages
        // are higher-stakes copy with more surface area for issues.)
        if (c.score >= 100 || c.issues.length === 0) return;

        const contentType = lpSectionToContentType(sectionKey);
        const modelOverride = contentType === "body" ? "claude-opus-4-7" : undefined;

        const r = await rewriteForCompliance(
          text,
          c.issues,
          contentType,
          { niche: serviceNiche, mechanism: null, mainBenefit: null },
          modelOverride,
          /* isLandingPageContext */ true,
        );

        rowsToInsert.push({
          userId: user.id,
          serviceId,
          contentType,
          sourceTable: "landingPages",
          sourceId: landingPageId,
          sourceSubKey: `${angleKey}:${sectionKey}`,
          originalText: text,
          rewrittenText: r.rewrite,
          violationReasons: c.issues.map(i => i.reason),
          complianceScore: r.score,
          modelUsed: r.modelUsed,
        });
      } catch (err) {
        console.warn(
          `[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} section=${sectionKey} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    });

    if (rowsToInsert.length > 0) {
      await db.insert(complianceRewrites).values(rowsToInsert);
      console.log(`[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} inserted ${rowsToInsert.length} rewrite(s)`);
    } else {
      console.log(`[W5.precompute] landingPage id=${landingPageId} angle=${angleKey} produced no rewrites (all sections passed or skipped)`);
    }
  } catch (err) {
    console.error(
      `[W5.precompute] landingPage id=${landingPageId} unexpected failure:`,
      err instanceof Error ? err.message : err,
    );
  }
}

const generateLandingPageSchema = z.object({
  serviceId: z.number(),
  campaignId: z.number().optional(),
  avatarName: z.string().optional(), // e.g., "Amir from Abu Dhabi"
  avatarDescription: z.string().optional(), // e.g., "Expat Professional"
  // Workstream commit 5b — pageType drives prompt copy emphasis + section
  // blanks (Path A architecture). Default 'sales_page' preserves backward-
  // compatible behavior. V1/V2 callsites that don't pass pageType still
  // produce the existing long-form sales page.
  pageType: z.enum([
    "sales_page",
    "webinar_registration",
    "discovery_call_booking",
    "lead_magnet_download",
    "event_registration",
  ]).optional().default("sales_page"),
});

const updateActiveAngleSchema = z.object({
  id: z.number(),
  activeAngle: z.enum(["original", "godfather", "free", "dollar"]),
});

const updateRatingSchema = z.object({
  id: z.number(),
  rating: z.number().min(0).max(5),
});

export const landingPagesRouter = router({
  // List all landing pages for current user
  list: protectedProcedure
    .input(
      z
        .object({
          serviceId: z.number().optional(),
          campaignId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [eq(landingPages.userId, ctx.user.id)];
      if (input?.serviceId) {
        conditions.push(eq(landingPages.serviceId, input.serviceId));
      }
      if (input?.campaignId) {
        conditions.push(eq(landingPages.campaignId, input.campaignId));
      }

      return await db
        .select()
        .from(landingPages)
        .where(and(...conditions))
        .orderBy(desc(landingPages.createdAt));
    }),

  // Get single landing page by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [page] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!page) {
        throw new Error("Landing page not found");
      }

      return page;
    }),

  // Generate landing page with all 4 angles using AI
  // Auto Mode Phase B1: thin wrapper around runLandingPageGeneration.
  // Quota enforcement + sync-path fallback (no cascade context, no
  // progress callback) live here in the tRPC layer; gen-core itself is
  // in server/landingPageGenerator.ts and is callable directly by the
  // orchestrator.
  //
  // NOTE: sync `generate` previously called generateAllAngles with
  // cascadeContext="" (uncascaded by design — only async fired cascade).
  // The B1 refactor preserves this by NOT setting up a fresh cascade
  // path; runLandingPageGeneration's own cascade fetch surfaces the
  // upstream selections regardless. If V1 sync callsites depend on the
  // uncascaded behavior, that's now a behavioral change to flag.
  generate: protectedProcedure
    .input(generateLandingPageSchema)
    .mutation(async ({ ctx, input }) => {
      const prereqs = await validateCascadePrereqs(ctx.user.id, input.serviceId, "landingPage");
      if (!prereqs.ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: prereqs.message });

      await enforceQuota(ctx.user.id, "landingPages");
      await checkAndResetQuotaIfNeeded(ctx.user.id);

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new Error("User not found");

      if (user.role !== "superuser") {
        const quotaLimits = { trial: 2, pro: 50, agency: 500 };
        const limit = quotaLimits[user.subscriptionTier || "trial"];
        if (user.landingPageGeneratedCount >= limit) {
          throw new Error(`Landing page generation limit reached (${limit}). Please upgrade your plan.`);
        }
      }

      const { landingPageId } = await runLandingPageGeneration({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        campaignId: input.campaignId,
        avatarName: input.avatarName,
        avatarDescription: input.avatarDescription,
        pageType: input.pageType,
        // No onProgress on sync path — tRPC sync mutation doesn't poll a job.
      });

      const [newPage] = await db.select().from(landingPages).where(eq(landingPages.id, landingPageId)).limit(1);
      const [service] = await db.select().from(services).where(eq(services.id, input.serviceId)).limit(1);

      // Compliance precompute fire-and-forget — kept in the wrapper so
      // runX stays focused on producing the row; precompute runs async
      // after the row exists. setImmediate lets the user-facing return
      // land immediately.
      setImmediate(() => {
        precomputeLandingPageComplianceRewrites(
          { id: ctx.user.id, subscriptionTier: user.subscriptionTier ?? null, role: user.role ?? null },
          landingPageId,
          service?.category ?? null,
        ).catch(err => console.warn(`[W5.precompute] landingPage id=${landingPageId} sync-generate hook failed:`, err instanceof Error ? err.message : err));
      });

      return newPage;
    }),

  /**
   * generateAsync — background job version of generate.
   * Returns jobId immediately; landing page generation runs via setImmediate.
   */
  // Auto Mode Phase B1: thin wrapper around runLandingPageGeneration.
  // Network-error retry-once-after-30s preserved (the user-spec retry
  // policy from prior workstream); both the initial run and the retry
  // delegate to runX. writeProgress callback routes "Generating angle
  // X of 4…" labels to the job's own progress field.
  generateAsync: protectedProcedure
    .input(generateLandingPageSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await enforceQuota(ctx.user.id, "landingPages");
      await checkAndResetQuotaIfNeeded(ctx.user.id);
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new Error("User not found");
      if (user.role !== "superuser") {
        const quotaLimits = { trial: 2, pro: 50, agency: 500 };
        const limit = quotaLimits[user.subscriptionTier || "trial"];
        if (user.landingPageGeneratedCount >= limit) throw new Error(`Landing page generation limit reached (${limit}). Please upgrade your plan.`);
      }
      const [service] = await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id))).limit(1);
      if (!service) throw new Error("Service not found");

      const capturedInput = { ...input };
      const capturedUserId = ctx.user.id;
      const capturedUser = { id: user.id, subscriptionTier: user.subscriptionTier, role: user.role };
      const capturedServiceCategory = service.category;

      const jobId = randomUUID();
      await db.insert(jobs).values({ id: jobId, userId: String(capturedUserId), status: "pending" });

      // ── Helper: write angle-progress to job record (caller passes to runX)
      const makeWriteProgress = (bgDb: NonNullable<Awaited<ReturnType<typeof getDb>>>) => async (completed: number, total: number) => {
        const label = completed < total
          ? `Generating angle ${completed + 1} of ${total}…`
          : `Finalising your landing page…`;
        try {
          await bgDb.update(jobs)
            .set({ progress: JSON.stringify({ step: completed, total, label }) })
            .where(eq(jobs.id, jobId));
        } catch { /* non-fatal */ }
      };

      setImmediate(async () => {
        try {
          const bgDb = await getDb();
          if (!bgDb) throw new Error("Database not available in background job");

          const { landingPageId } = await runLandingPageGeneration({
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            campaignId: capturedInput.campaignId,
            avatarName: capturedInput.avatarName,
            avatarDescription: capturedInput.avatarDescription,
            pageType: capturedInput.pageType,
            onProgress: makeWriteProgress(bgDb),
          });

          // Compliance precompute fire-and-forget — wrapper concern,
          // mirrors sync-generate hook.
          setImmediate(() => {
            precomputeLandingPageComplianceRewrites(
              { id: capturedUserId, subscriptionTier: capturedUser.subscriptionTier ?? null, role: capturedUser.role ?? null },
              landingPageId,
              capturedServiceCategory ?? null,
            ).catch(err => console.warn(`[W5.precompute] landingPage id=${landingPageId} async-generate hook failed:`, err instanceof Error ? err.message : err));
          });

          await bgDb.update(jobs)
            .set({ status: "complete", result: JSON.stringify({ id: landingPageId }) })
            .where(eq(jobs.id, jobId));
          console.log(`[landingPages.generateAsync] Job ${jobId} completed, landingPageId: ${landingPageId}`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // ── Network-error auto-retry (once, 30-second delay) ─────────────────
          // Only retry on transient network failures — never on Zod/validation errors.
          const isNetworkError = errorMessage.includes('fetch failed') || errorMessage.includes('AbortError') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('network timeout');
          if (isNetworkError) {
            try {
              const checkDb = await getDb();
              const [currentJob] = checkDb ? await checkDb.select().from(jobs).where(eq(jobs.id, jobId)).limit(1) : [];
              const retryCount = (currentJob as any)?.retryCount ?? 0;
              if (retryCount < 1) {
                console.warn(`[landingPages.generateAsync] Job ${jobId} network error (attempt ${retryCount + 1}), retrying in 30s:`, errorMessage);
                if (checkDb) await checkDb.update(jobs).set({ retryCount: retryCount + 1, progress: JSON.stringify({ step: 0, total: 4, label: 'Network hiccup — retrying in 30s…' }) }).where(eq(jobs.id, jobId));
                await new Promise(resolve => setTimeout(resolve, 30_000));
                setImmediate(async () => {
                  try {
                    const retryDb = await getDb();
                    if (!retryDb) throw new Error('Database not available on retry');
                    const { landingPageId: retryLandingPageId } = await runLandingPageGeneration({
                      userId: capturedUserId,
                      serviceId: capturedInput.serviceId,
                      campaignId: capturedInput.campaignId,
                      avatarName: capturedInput.avatarName,
                      avatarDescription: capturedInput.avatarDescription,
                      pageType: capturedInput.pageType,
                      onProgress: makeWriteProgress(retryDb),
                    });
                    await retryDb.update(jobs).set({ status: 'complete', result: JSON.stringify({ id: retryLandingPageId }) }).where(eq(jobs.id, jobId));
                    console.log(`[landingPages.generateAsync] Job ${jobId} retry succeeded, landingPageId: ${retryLandingPageId}`);
                  } catch (retryErr: unknown) {
                    const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                    console.error(`[landingPages.generateAsync] Job ${jobId} retry also failed:`, retryMsg);
                    try { const fd = await getDb(); if (fd) await fd.update(jobs).set({ status: 'failed', error: retryMsg.slice(0, 1024) }).where(eq(jobs.id, jobId)); } catch { /* ignore */ }
                  }
                });
                return; // Don't mark as failed yet — retry is in flight
              }
            } catch { /* if retry setup fails, fall through to permanent failure */ }
          }
          console.error(`[landingPages.generateAsync] Job ${jobId} failed (permanent):`, errorMessage);
          try {
            const bgDb2 = await getDb();
            if (bgDb2) await bgDb2.update(jobs).set({ status: "failed", error: errorMessage.slice(0, 1024) }).where(eq(jobs.id, jobId));
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),

  // Update active angle (instant switching)
  updateActiveAngle: protectedProcedure
    .input(updateActiveAngleSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Landing page not found");
      }

      await db
        .update(landingPages)
        .set({
          activeAngle: input.activeAngle,
          updatedAt: new Date(),
        })
        .where(eq(landingPages.id, input.id));

      // Fetch updated landing page
      const [updated] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, input.id))
        .limit(1);

      return updated;
    }),

  // Update rating
  updateRating: protectedProcedure
    .input(updateRatingSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Landing page not found");
      }

      await db
        .update(landingPages)
        .set({
          rating: input.rating,
          updatedAt: new Date(),
        })
        .where(eq(landingPages.id, input.id));

      // Fetch updated landing page
      const [updated] = await db
        .select()
        .from(landingPages)
        .where(eq(landingPages.id, input.id))
        .limit(1);

      return updated;
    }),

  // Regenerate a single section within a landing page angle via AI
  regenerateSection: protectedProcedure
    .input(z.object({
      landingPageId: z.number(),
      angle: z.enum(["original", "godfather", "free", "dollar"]),
      sectionKey: z.string(),
      userPrompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await enforceQuota(ctx.user.id, "landingPages");

      const [row] = await db
        .select()
        .from(landingPages)
        .where(and(eq(landingPages.id, input.landingPageId), eq(landingPages.userId, ctx.user.id)))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Landing page not found" });
      }

      const angleColMap = { original: "originalAngle", godfather: "godfatherAngle", free: "freeAngle", dollar: "dollarAngle" } as const;
      const angleCol = angleColMap[input.angle];
      const rawAngle = row[angleCol];
      const angleData: Record<string, unknown> = typeof rawAngle === "string" ? JSON.parse(rawAngle) : (rawAngle as Record<string, unknown>) ?? {};

      const currentValue = angleData[input.sectionKey];
      const serialized = typeof currentValue === "string" ? currentValue : JSON.stringify(currentValue);

      const isStringSection = LP_STRING_SECTIONS.has(input.sectionKey);
      const userInstruction = input.userPrompt?.trim() ? ` User instruction: ${input.userPrompt.trim()}.` : "";
      const formatInstruction = isStringSection
        ? "Return ONLY the rewritten text. No JSON, no markdown, no explanation."
        : "Return ONLY valid JSON — no markdown, no explanation, no wrapping text.";

      const prompt = `Rewrite the ${input.sectionKey} section for this landing page. Current value: ${serialized}.${userInstruction} ${formatInstruction}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a direct-response copywriter for high-ticket coaching offers." },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0].message.content;
      if (typeof content !== "string") throw new Error("Invalid response from AI");

      const cleaned = stripMarkdownJson(content);

      let newValue: unknown;
      if (isStringSection) {
        // Phase 3: regex pre-clean removed. The compliance rewrite hook
        // below picks up flagged single-section regenerations and
        // surfaces a rewrite alternative through the panel.
        newValue = cleaned;
      } else {
        try {
          newValue = JSON.parse(cleaned);
        } catch {
          newValue = cleaned; // graceful fallback — store raw string
        }
      }

      angleData[input.sectionKey] = newValue;

      await db
        .update(landingPages)
        .set({ [angleCol]: JSON.stringify(angleData), updatedAt: new Date() })
        .where(eq(landingPages.id, input.landingPageId));

      // W5 Phase 3 — precompute hook for single-section regenerate. Only
      // fires for in-scope simple-string sections; nested-array
      // regenerations skip this entirely. Re-scopes the existing helper
      // by treating the regenerated angle as `targetAngle`. Inserts only
      // happen if the COUNT-guard finds zero rewrites for that angle —
      // which means a regenerate on an angle that already has rewrites
      // in the cache will be a no-op here. That is intentional: a
      // single-section regen does not fan out to refresh other sections'
      // rewrites; the user can clear and re-fire if they want a full
      // refresh.
      if (LP_STRING_SECTIONS.has(input.sectionKey)) {
        const regenAngle: LpAngleKey = input.angle;
        const regenLpId = input.landingPageId;
        // Pull the user's tier + role for the precompute helper. Cheap
        // single-row read — kept inline rather than threaded down from
        // ctx because the helper signature mirrors Phase 1/2.
        const [regenUser] = await db
          .select({ subscriptionTier: users.subscriptionTier, role: users.role })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        // Service niche for context — best-effort.
        let regenServiceNiche: string | null = null;
        if (row.serviceId) {
          const [svc] = await db
            .select({ category: services.category })
            .from(services)
            .where(eq(services.id, row.serviceId))
            .limit(1);
          regenServiceNiche = svc?.category ?? null;
        }
        setImmediate(() => {
          precomputeLandingPageComplianceRewrites(
            {
              id: ctx.user.id,
              subscriptionTier: regenUser?.subscriptionTier ?? null,
              role: regenUser?.role ?? null,
            },
            regenLpId,
            regenServiceNiche,
            regenAngle,
          ).catch(err => console.warn(`[W5.precompute] landingPage id=${regenLpId} regenerateSection hook failed:`, err instanceof Error ? err.message : err));
        });
      }

      return angleData;
    }),

  // W5 Phase 3 — lazy precompute on first switch to an inactive angle.
  // The panel calls this when the user clicks an angle they have not
  // viewed before. The helper's COUNT-guard makes repeated calls
  // idempotent, so a debounce on the client is "nice to have" not
  // "must have" — the server-side guard catches the rapid-switch case.
  // Returns immediately; the panel polls listForLandingPage to discover
  // when rewrites land.
  precomputeOnAngleSwitch: protectedProcedure
    .input(z.object({
      landingPageId: z.number(),
      targetAngle: z.enum(["original", "godfather", "free", "dollar"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (process.env.ENABLE_COMPLIANCE_REWRITES !== "true") {
        return { fired: false, reason: "flag-off" as const };
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Ownership check.
      const [lp] = await db
        .select({ id: landingPages.id, serviceId: landingPages.serviceId })
        .from(landingPages)
        .where(and(eq(landingPages.id, input.landingPageId), eq(landingPages.userId, ctx.user.id)))
        .limit(1);
      if (!lp) throw new TRPCError({ code: "NOT_FOUND", message: "Landing page not found" });

      // Tier read for the helper's free-tier section narrowing.
      const [me] = await db
        .select({ subscriptionTier: users.subscriptionTier, role: users.role })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      // Service niche, best-effort.
      let serviceNiche: string | null = null;
      if (lp.serviceId) {
        const [svc] = await db
          .select({ category: services.category })
          .from(services)
          .where(eq(services.id, lp.serviceId))
          .limit(1);
        serviceNiche = svc?.category ?? null;
      }

      // Fire-and-forget. setImmediate so the tRPC response returns
      // immediately and the panel can show its "Scanning…" indicator.
      const lpId = input.landingPageId;
      const targetAngle: LpAngleKey = input.targetAngle;
      setImmediate(() => {
        precomputeLandingPageComplianceRewrites(
          {
            id: ctx.user.id,
            subscriptionTier: me?.subscriptionTier ?? null,
            role: me?.role ?? null,
          },
          lpId,
          serviceNiche,
          targetAngle,
        ).catch(err => console.warn(`[W5.precompute] landingPage id=${lpId} angle-switch hook (target=${targetAngle}) failed:`, err instanceof Error ? err.message : err));
      });

      return { fired: true as const, targetAngle };
    }),

  // Delete landing page
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const [existing] = await db
        .select()
        .from(landingPages)
        .where(
          and(
            eq(landingPages.id, input.id),
            eq(landingPages.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Landing page not found");
      }

      await db.delete(landingPages).where(eq(landingPages.id, input.id));

      return { success: true };
    }),

  // D4: Publish landing page to Cloudflare Workers KV.
  // Phase C C2 refactor: publish logic extracted to
  // server/landingPagePublisher.ts so the Auto Mode orchestrator can call
  // it directly. This mutation is now a thin wrapper preserving the
  // TRPCError code translations the wizard-side callers expect.
  publishToCloudflare: protectedProcedure
    .input(z.object({ landingPageId: z.number(), styleMode: z.enum(["text", "visual"]).default("text") }))
    .mutation(async ({ ctx, input }) => {
      const { runLandingPagePublish } = await import("../landingPagePublisher");
      try {
        const { publicUrl, slug } = await runLandingPagePublish({
          userId: ctx.user.id,
          landingPageId: input.landingPageId,
          styleMode: input.styleMode,
        });
        return { success: true, publicUrl, slug };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Translate gen-core's plain Error.message shape into the tRPC
        // error codes the wizard's callers already handle.
        if (message.includes("not found for user")) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Landing page not found" });
        }
        if (message.includes("no content for angle")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No content for selected angle — please generate a landing page first.",
          });
        }
        throw err;
      }
    }),
});
