/**
 * conceptScriptBatch.ts — ensureScriptsForIcp: the caller that makes the Andromeda per-concept script generator
 * (generateScriptForConcept) reachable. Writes one script for every concept in an ICP's concept set, as ONE set.
 *
 * The rules live in the pure core, server/_core/scriptBatch.ts (set identity, one job row per concept, the
 * no-kit guard). This file only supplies the database and generator effects.
 *
 * Reached from: routers/conceptScripts.ts → client V2ConceptScripts (Ad Copy node → Video tab; Tool Library →
 * Video Scripts).
 */

import { randomUUID } from "crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { campaignConcepts, campaignKits, conceptScripts, idealCustomerProfiles, jobs } from "../drizzle/schema";
import { planAndStart, runScriptBatch, type BatchDeps, type EntryResult } from "./_core/scriptBatch";

export class IcpNotFoundError extends Error {}

function isDuplicateKey(err: unknown): boolean {
  const e: any = err;
  const c: any = e?.cause ?? {};
  return (
    e?.code === "ER_DUP_ENTRY" || c?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || c?.errno === 1062 ||
    /Duplicate entry/i.test(String(e?.message ?? "")) || /Duplicate entry/i.test(String(c?.message ?? ""))
  );
}

function affectedRows(result: any): number {
  const n = Array.isArray(result) ? result[0]?.affectedRows : result?.affectedRows;
  return Number(n ?? 0) || 0;
}

export function buildBatchDeps(db: any, userId: number, icpId: number): BatchDeps {
  const owner = String(userId);
  return {
    loadConceptIds: async () => {
      const rows = await db
        .select({ id: campaignConcepts.id })
        .from(campaignConcepts)
        .where(and(eq(campaignConcepts.userId, userId), eq(campaignConcepts.icpId, icpId)))
        .orderBy(asc(campaignConcepts.id));
      return rows.map((r: { id: number }) => r.id);
    },
    loadScripts: async (conceptIds) => {
      if (conceptIds.length === 0) return [];
      return db
        .select({ conceptId: conceptScripts.conceptId, scriptSetId: conceptScripts.scriptSetId })
        .from(conceptScripts)
        .where(and(eq(conceptScripts.userId, userId), inArray(conceptScripts.conceptId, conceptIds)))
        .orderBy(asc(conceptScripts.id));
    },
    loadJobs: async (jobIds) => {
      if (jobIds.length === 0) return [];
      return db
        .select({ id: jobs.id, status: jobs.status, result: jobs.result })
        .from(jobs)
        .where(and(inArray(jobs.id, jobIds), eq(jobs.userId, owner)));
    },
    insertJob: async (jobId, scriptSetId) => {
      try {
        await db.insert(jobs).values({ id: jobId, userId: owner, status: "pending", result: JSON.stringify({ scriptSetId }) });
        return true;
      } catch (err) {
        if (isDuplicateKey(err)) return false;
        throw err;
      }
    },
    rearmJob: async (jobId, scriptSetId) => {
      // created_at is reset so the reaper's 5-minute clock starts at the re-arm, not at the original insert.
      const result = await db
        .update(jobs)
        .set({ status: "pending", error: null, result: JSON.stringify({ scriptSetId }), createdAt: new Date() })
        .where(and(eq(jobs.id, jobId), eq(jobs.userId, owner), inArray(jobs.status, ["failed", "complete"])));
      return affectedRows(result) === 1;
    },
    completeJob: async (jobId, scriptId, scriptSetId) => {
      await db.update(jobs).set({ status: "complete", result: JSON.stringify({ scriptId, scriptSetId }) }).where(eq(jobs.id, jobId));
    },
    failJob: async (jobId, message) => {
      await db.update(jobs).set({ status: "failed", error: message.slice(0, 1024) }).where(eq(jobs.id, jobId));
    },
    generate: async (conceptId, scriptSetId) => {
      const { generateScriptForConcept } = await import("./conceptScriptGenerator");
      return generateScriptForConcept({ userId, conceptId, scriptSetId });
    },
    mintSetId: () => randomUUID(),
  };
}

/**
 * The "generate video scripts" request for one ICP. Returns immediately; the batch runs in the background.
 *   no_kit             — the ICP has no campaign kit. Nothing is generated, concepts included.
 *   preparing_concepts — a kit exists but its concept set does not yet; ensureConceptsForIcp was called.
 *   complete           — every concept already has a script.
 *   in_flight          — a batch for this set is already writing.
 *   started            — the batch was started.
 */
export async function ensureScriptsForIcp(params: { userId: number; icpId: number }): Promise<EntryResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { userId, icpId } = params;

  const [icp] = await db
    .select({ id: idealCustomerProfiles.id, serviceId: idealCustomerProfiles.serviceId })
    .from(idealCustomerProfiles)
    .where(and(eq(idealCustomerProfiles.id, icpId), eq(idealCustomerProfiles.userId, userId)))
    .limit(1);
  if (!icp) throw new IcpNotFoundError(`ICP ${icpId} not found for user ${userId}`);

  const deps = buildBatchDeps(db, userId, icpId);
  return planAndStart({
    hasKit: async () => {
      const [kit] = await db
        .select({ id: campaignKits.id })
        .from(campaignKits)
        .where(and(eq(campaignKits.icpId, icpId), eq(campaignKits.userId, userId)))
        .limit(1);
      return !!kit;
    },
    loadConceptIds: deps.loadConceptIds,
    loadScripts: deps.loadScripts,
    loadJobs: deps.loadJobs,
    ensureConcepts: async () => {
      const { ensureConceptsForIcp } = await import("./conceptGenerator");
      return ensureConceptsForIcp({ userId, icpId, serviceId: icp.serviceId ?? null });
    },
    startBatch: () => {
      setImmediate(async () => {
        try {
          const o = await runScriptBatch(deps);
          console.log(
            `[conceptScriptBatch] icp ${icpId} set ${o.scriptSetId}: generated=${o.generated.length} failed=${o.failed.length} ` +
              `skipped=${o.skippedExisting.length}${o.aborted ? ` aborted@${o.aborted.conceptId}:${o.aborted.reason}` : ""}`,
          );
        } catch (err) {
          console.error(`[conceptScriptBatch] icp ${icpId} batch threw:`, err instanceof Error ? err.message : err);
        }
      });
    },
  });
}
