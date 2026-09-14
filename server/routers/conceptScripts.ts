// server/routers/conceptScripts.ts
// The Andromeda per-concept video scripts: read the concept set with its scripts, and start a batch.
// Screen: client/src/v2/V2ConceptScripts.tsx (Ad Copy node → Video tab; Tool Library → Video Scripts).

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { campaignConcepts, campaignKits, conceptScripts, idealCustomerProfiles, jobs } from "../../drizzle/schema";
import { activeLengthForStage, isAwarenessStage } from "../_core/conceptAxis";
import { scriptJobId } from "../_core/scriptBatch";

export const conceptScriptsRouter = router({
  listForIcp: protectedProcedure
    .input(z.object({ icpId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const userId = ctx.user.id;

      const [icp] = await db
        .select({ id: idealCustomerProfiles.id })
        .from(idealCustomerProfiles)
        .where(and(eq(idealCustomerProfiles.id, input.icpId), eq(idealCustomerProfiles.userId, userId)))
        .limit(1);
      if (!icp) throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });

      const [kit] = await db
        .select({ id: campaignKits.id })
        .from(campaignKits)
        .where(and(eq(campaignKits.icpId, input.icpId), eq(campaignKits.userId, userId)))
        .limit(1);

      const concepts = await db
        .select({
          id: campaignConcepts.id,
          awareness: campaignConcepts.awareness,
          hookPattern: campaignConcepts.hookPattern,
          desire: campaignConcepts.desire,
          hook: campaignConcepts.hook,
          personaLabel: campaignConcepts.personaLabel,
        })
        .from(campaignConcepts)
        .where(and(eq(campaignConcepts.userId, userId), eq(campaignConcepts.icpId, input.icpId)))
        .orderBy(asc(campaignConcepts.id));

      const conceptIds = concepts.map((c) => c.id);
      const scripts = conceptIds.length
        ? await db
            .select({
              id: conceptScripts.id,
              conceptId: conceptScripts.conceptId,
              scriptSetId: conceptScripts.scriptSetId,
              targetLengthSeconds: conceptScripts.targetLengthSeconds,
              scenes: conceptScripts.scenes,
              teleprompter: conceptScripts.teleprompter,
              createdAt: conceptScripts.createdAt,
            })
            .from(conceptScripts)
            .where(and(eq(conceptScripts.userId, userId), inArray(conceptScripts.conceptId, conceptIds)))
            .orderBy(asc(conceptScripts.id))
        : [];
      // Latest script per concept (a concept can hold older one-off scripts from before batching).
      const scriptByConcept = new Map<number, (typeof scripts)[number]>();
      for (const s of scripts) scriptByConcept.set(s.conceptId, s);

      const { conceptJobId } = await import("../conceptGenerator");
      const jobIds = [...conceptIds.map(scriptJobId), conceptJobId(input.icpId)];
      const jobRows = await db
        .select({ id: jobs.id, status: jobs.status, error: jobs.error })
        .from(jobs)
        .where(and(inArray(jobs.id, jobIds), eq(jobs.userId, String(userId))));
      const jobById = new Map(jobRows.map((j) => [j.id, j]));
      const conceptsJob = jobById.get(conceptJobId(input.icpId)) ?? null;

      return {
        icpId: input.icpId,
        hasKit: !!kit,
        conceptsJob: conceptsJob ? { status: conceptsJob.status } : null,
        concepts: concepts.map((c) => {
          const script = scriptByConcept.get(c.id) ?? null;
          const job = jobById.get(scriptJobId(c.id)) ?? null;
          return {
            ...c,
            targetLengthSeconds: isAwarenessStage(c.awareness) ? activeLengthForStage(c.awareness) : null,
            script,
            job: job ? { status: job.status } : null,
          };
        }),
      };
    }),

  generateForIcp: protectedProcedure
    .input(z.object({ icpId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { ensureScriptsForIcp, IcpNotFoundError } = await import("../conceptScriptBatch");
      try {
        return await ensureScriptsForIcp({ userId: ctx.user.id, icpId: input.icpId });
      } catch (err) {
        if (err instanceof IcpNotFoundError) throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
        throw err;
      }
    }),
});
