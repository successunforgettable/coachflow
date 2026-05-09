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
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { jobs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { runOrchestration } from "../_core/orchestration";

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
