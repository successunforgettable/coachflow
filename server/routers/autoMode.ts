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
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs, idealCustomerProfiles, offers, heroMechanisms, hvcoTitles, services } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { runOrchestration, runOrchestrationStep, ORCHESTRATION_STEP_NAMES, type OrchestrationStepName } from "../_core/orchestration";
import { autoSelectBest } from "./campaignKits";

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

  /**
   * orchestrateStep — Trail Sprint 3 C1: run ONE cascade node as its own job.
   *
   * The chat-paced Trail loop (spec §5.1) drives the cascade node by node:
   * reveal → chips → next step request. Same tier ground-truth gate as
   * orchestrate; same jobs/poll pattern (a synchronous step mutation would
   * re-create the B3.3 Railway proxy-timeout failure for 30-120s LLM calls).
   *
   * Job result payload: { stepName, skipped, generatedId, kitField } —
   * the client reveals from kit.selected*Id (committed by autoSelectBest
   * inside the step, before the job flips complete).
   */
  orchestrateStep: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      icpId: z.number(),
      step: z.enum(ORCHESTRATION_STEP_NAMES as [OrchestrationStepName, ...OrchestrationStepName[]]),
      campaignType: z
        .enum(["webinar", "challenge", "course_launch", "product_launch", "discovery_call", "lead_magnet", "in_person_event"])
        .optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tierCheck = isAutoModeTierAllowed(ctx.user);
      if (!tierCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: tierCheck.reason! });
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const capturedInput = { ...input };
      const capturedUserId = ctx.user.id;
      const stepIndex = ORCHESTRATION_STEP_NAMES.indexOf(input.step) + 1;
      const totalSteps = ORCHESTRATION_STEP_NAMES.length;

      const jobId = randomUUID();
      await db.insert(jobs).values({
        id: jobId,
        userId: String(capturedUserId),
        status: "pending",
      });

      setImmediate(async () => {
        const bgDb = await getDb();
        try {
          // pending → running before the LLM call (reaper immunity, same
          // ordering rule as runOrchestration).
          if (bgDb) {
            await bgDb.update(jobs)
              .set({ status: "running", progress: JSON.stringify({ step: stepIndex, total: totalSteps, label: `Starting ${capturedInput.step}…` }) })
              .where(eq(jobs.id, jobId));
          }

          const result = await runOrchestrationStep(
            {
              userId: capturedUserId,
              serviceId: capturedInput.serviceId,
              icpId: capturedInput.icpId,
              campaignType: capturedInput.campaignType,
            },
            capturedInput.step,
            async (label) => {
              if (!bgDb) return;
              await bgDb.update(jobs)
                .set({ progress: JSON.stringify({ step: stepIndex, total: totalSteps, label }) })
                .where(eq(jobs.id, jobId));
            },
          );

          if (bgDb) {
            await bgDb.update(jobs)
              .set({
                status: "complete",
                result: JSON.stringify({
                  stepName: capturedInput.step,
                  skipped: result.skipped,
                  generatedId: result.generatedId,
                  kitField: result.kitField,
                }),
              })
              .where(eq(jobs.id, jobId));
          }
          console.log(`[autoMode.orchestrateStep] Job ${jobId} (${capturedInput.step}) completed.`);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`[autoMode.orchestrateStep] Job ${jobId} (${capturedInput.step}) failed:`, errorMessage);
          try {
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

  /**
   * importIcp — synchronous ICP import for existing-assets users.
   *
   * Inserts a single ICP row with user-supplied fields and returns icpId
   * immediately (no job/polling). The Confirm screen calls this instead of
   * icps.generateAsync when the user toggles "I Have One" on the ICP card.
   *
   * Required: name. Optional: pains, goals, implementationBarriers.
   * All 14 remaining Kong tabs are left null — acceptable v1 tradeoff
   * (generators that read those tabs produce less personalised output,
   * but the cascade still runs end-to-end).
   */
  importIcp: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      name: z.string().min(1).max(255),
      pains: z.string().max(2000).optional(),
      goals: z.string().max(2000).optional(),
      implementationBarriers: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tierCheck = isAutoModeTierAllowed(ctx.user);
      if (!tierCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: tierCheck.reason! });
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result: any = await db.insert(idealCustomerProfiles).values({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        name: input.name,
        pains: input.pains || null,
        goals: input.goals || null,
        implementationBarriers: input.implementationBarriers || null,
        source: "imported",
      });

      return { icpId: result[0].insertId as number };
    }),

  /**
   * importAssets — pre-populate kit slots for user-imported assets.
   *
   * Called between icpId-resolve and orchestrate on the Confirm screen.
   * For each provided asset (offer, mechanism, hvco), inserts one row
   * into the target table with source='imported', then calls
   * autoSelectBest to write the kit slot. The orchestrator's
   * skip-already-populated logic (orchestration.ts:191-196) then skips
   * these steps on the first cascade run.
   *
   * All three asset fields are optional — only populated for assets
   * where the user toggled "I Have One". Blank-slate users skip this
   * call entirely (or call with no assets — both work).
   */
  importAssets: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      icpId: z.number(),
      offer: z.object({
        name: z.string().min(1).max(500),
        valueProposition: z.string().min(1).max(2000),
        cta: z.string().min(1).max(500),
      }).optional(),
      mechanism: z.object({
        name: z.string().min(1).max(255),
        description: z.string().min(1).max(2000),
      }).optional(),
      hvco: z.object({
        title: z.string().min(1).max(500),
        topic: z.string().min(1).max(2000),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tierCheck = isAutoModeTierAllowed(ctx.user);
      if (!tierCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: tierCheck.reason! });
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch service for auto-populating context fields
      const [svc] = await db.select().from(services)
        .where(and(eq(services.id, input.serviceId), eq(services.userId, ctx.user.id)))
        .limit(1);
      const targetMarket = svc?.targetCustomer || "";

      // --- Offer ---
      if (input.offer) {
        const offerResult: any = await db.insert(offers).values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          productName: input.offer.name,
          activeAngle: "godfather",
          godfatherAngle: {
            offerName: input.offer.name,
            valueProposition: input.offer.valueProposition,
            cta: input.offer.cta,
            pricing: "",
            bonuses: "",
            guarantee: "",
            urgency: "",
          },
          source: "imported",
        });
        await autoSelectBest(ctx.user.id, input.icpId, "selectedOfferId", offerResult[0].insertId);
      }

      // --- Mechanism ---
      if (input.mechanism) {
        const mechResult: any = await db.insert(heroMechanisms).values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          mechanismSetId: nanoid(),
          tabType: "hero_mechanisms",
          mechanismName: input.mechanism.name,
          mechanismDescription: input.mechanism.description,
          targetMarket,
          pressingProblem: "",
          whyProblem: "",
          whatTried: "",
          whyExistingNotWork: "",
          desiredOutcome: "",
          credibility: "",
          socialProof: "",
          source: "imported",
        });
        await autoSelectBest(ctx.user.id, input.icpId, "selectedMechanismId", mechResult[0].insertId);
      }

      // --- HVCO (lead magnet / free opt-in) ---
      if (input.hvco) {
        const hvcoResult: any = await db.insert(hvcoTitles).values({
          userId: ctx.user.id,
          serviceId: input.serviceId,
          hvcoSetId: nanoid(),
          tabType: "long",
          title: input.hvco.title,
          targetMarket,
          hvcoTopic: input.hvco.topic,
          source: "imported",
        });
        await autoSelectBest(ctx.user.id, input.icpId, "selectedHvcoId", hvcoResult[0].insertId);
      }

      return { success: true };
    }),
});
