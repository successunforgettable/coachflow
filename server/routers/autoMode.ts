/**
 * Auto Mode Phase B2 — autoMode router.
 *
 * Single mutation `orchestrate` that enqueues a multi-step generation job.
 * The orchestration handler in server/_core/orchestration.ts runs the 8-step
 * cascade (offer → mechanism → hvco → headlines → adCopy → landingPage →
 * emailSequence → whatsappSequence) outside the HTTP request cycle via
 * setImmediate.
 *
 * Returns jobId immediately. Client polls /api/jobs/:jobId every 5s for
 * status + progress (Phase B3's V2AutoModeProgress UI consumes the
 * progress.label strings from runOrchestration's writeProgress calls).
 *
 * Status transitions:
 *   pending (insert here) → running (orchestration handler's first DB write,
 *   pre-LLM, escapes the 5-min reaper) → complete | failed (orchestration
 *   handler's terminal write).
 *
 * v1 retry semantics (locked): on failure, job is marked 'failed' with
 * error message; orchestration's skip-already-populated logic lets a
 * re-triggered run resume from the failed step (DB rows already inserted
 * for prior steps stay in place).
 */
import { z } from "zod";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { runOrchestration } from "../_core/orchestration";

/**
 * Phase C C0: Auto Mode tier gate.
 *
 * Auto Mode is a paid-only feature. Per the locked Phase C product
 * decisions (Sprint B+1 path d completion + Phase C scope writeup):
 *   - Free-tier ("trial") users would consume their entire trial
 *     allotment of ad creatives in one cascade (FREE_TIER_AD_IMAGE_LIMIT
 *     = 2 vs 5 generated per Auto Mode run)
 *   - Per-asset quotas live at the per-router tRPC layer; Auto Mode's
 *     runX cores bypass them (B1 design), so trial users would burn
 *     through 8 quota slots per cascade — bad UX and bad economics
 *   - The greeting overlay CTA promises a launchable campaign; gating
 *     mid-flow is worse UX than gating at intake
 *
 * Backend FORBIDDEN check is mandatory (belt-and-suspenders behind the
 * V2AutoModeIntake frontend gate). Free-tier users hitting the endpoint
 * directly (or via stale frontend cache) get a clean tRPC error.
 *
 * Pure helper extracted for unit-testability — the mutation calls it
 * with ctx.user; tests call it directly with synthetic user shapes.
 *
 * Subscription tiers (drizzle/schema.ts: `["trial", "pro", "agency"]`):
 *   - trial: blocked (free-equivalent entry tier)
 *   - pro / agency: allowed
 *   - null/missing subscriptionTier: blocked (defensive — defaults to
 *     trial per schema, but coerce explicitly)
 *
 * Role bypass: `superuser` AND `admin` always allowed regardless of tier
 * (matches V2GeneratorWizard's existing isFreeTier client-side predicate
 * which already treats both roles as bypassing — and C0.1 client/server
 * predicate mirror per Phase F sequencing decision). Admin is an
 * internal-only role never held by customers, so bypass is safe and
 * keeps Auto Mode consistent with the wizard's gating model.
 *
 * Pure helper, single call site at autoMode.orchestrate below. No
 * cross-router dependency — this change does not widen bypass behavior
 * on any other tier gate (per-router quota checks at adCopy.ts:203,
 * adCreatives.ts:123, etc. remain unaffected).
 */
export function isAutoModeTierAllowed(user: {
  role: string;
  subscriptionTier: string | null | undefined;
}): { allowed: boolean; reason?: string } {
  if (user.role === "superuser" || user.role === "admin") return { allowed: true };
  const tier = user.subscriptionTier;
  if (tier === "pro" || tier === "agency") return { allowed: true };
  return {
    allowed: false,
    reason:
      "Auto Mode is a Pro feature. Upgrade your subscription to unlock the 1-click campaign builder.",
  };
}

const orchestrateSchema = z.object({
  serviceId: z.number(),
  icpId: z.number(),
  campaignType: z
    .enum(["webinar", "challenge", "course_launch", "product_launch", "discovery_call", "lead_magnet", "in_person_event"])
    .optional(),
});

export const autoModeRouter = router({
  /**
   * orchestrate — kick off the 8-step Auto Mode generation job.
   * Quota enforcement is upstream (intake screen handles entry-gate; per-
   * generator quotas would otherwise fire mid-cascade and partially
   * complete — undesirable UX). Orchestrator skips per-generator quota
   * checks by calling runX cores directly (which omit quota checks per the
   * B1 pattern — quota lives in the wizard's tRPC mutation wrappers).
   *
   * If a per-generator quota IS hit mid-cascade (e.g. user upgraded mid-
   * run), it surfaces as a step failure with the tRPC FORBIDDEN message
   * via runX → throw → orchestrator catch → mark job failed.
   */
  orchestrate: protectedProcedure
    .input(orchestrateSchema)
    .mutation(async ({ ctx, input }) => {
      // Phase C C0: tier gate. Trial-tier users must upgrade to use Auto
      // Mode. Superuser bypass per existing quota-check convention.
      const tierCheck = isAutoModeTierAllowed(ctx.user);
      if (!tierCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: tierCheck.reason! });
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const capturedInput = { ...input };
      const capturedUserId = ctx.user.id;

      const jobId = randomUUID();
      await db.insert(jobs).values({
        id: jobId,
        userId: String(capturedUserId),
        status: "pending",
      });

      setImmediate(async () => {
        try {
          await runOrchestration({
            jobId,
            userId: capturedUserId,
            serviceId: capturedInput.serviceId,
            icpId: capturedInput.icpId,
            campaignType: capturedInput.campaignType,
          });
          console.log(`[autoMode.orchestrate] Job ${jobId} completed.`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[autoMode.orchestrate] Job ${jobId} failed:`, errorMessage);
          try {
            const bgDb = await getDb();
            if (bgDb) {
              await bgDb.update(jobs)
                .set({ status: "failed", error: errorMessage.slice(0, 1024) })
                .where(eq(jobs.id, jobId));
            }
          } catch { /* ignore */ }
        }
      });

      return { jobId };
    }),
});
