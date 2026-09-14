/**
 * scriptBatch.ts — the pure core of the per-concept video-script BATCH. No database, no LLM.
 *
 * One batch = one script for every concept in an ICP's current concept set, all sharing ONE scriptSetId.
 * The database and generator wiring lives in server/conceptScriptBatch.ts (ensureScriptsForIcp). Every effect
 * here is an injected function, so the set-identity, job-row and no-kit rules are unit-testable.
 *
 * ── WHY ONE JOB ROW PER CONCEPT, INSERTED AS THAT CONCEPT STARTS ───────────────
 * The reaper (server/_core/index.ts, reapStuckJobs) runs every 60 s and marks any `pending` job older than
 * 5 minutes failed. One row covering a whole set (8 concepts × up to 3 LLM calls each) could be failed while
 * it is still writing scripts. A row per concept, created at the moment its concept starts, lives for one
 * generator call. Rows go `pending` → `complete | failed` and never `running`: `running` is never swept,
 * which is how a dead job becomes a permanent zombie (the same reasoning as conceptGenerator.ts).
 *
 * ── WHY A COLLISION ABORTS THE WHOLE LOOP ──────────────────────────────────────
 * Two loops started together would each mint a different set id. Both reach the same first missing
 * concept; whoever claims its row first owns the batch, and the other stops before writing anything.
 * A set can therefore never be split across two ids.
 */

/** Deterministic per-concept job id. jobs.id is varchar(36); an 11-digit concept id gives 26 characters. */
export function scriptJobId(conceptId: number): string {
  return `script-concept-${conceptId}`;
}

export interface BatchScriptRow {
  conceptId: number;
  scriptSetId: string;
}

export interface BatchJobRow {
  id: string;
  status: string;
  result: string | null;
}

/** The set id a job row recorded when it was claimed, or null. */
export function setIdFromJobResult(result: string | null): string | null {
  if (!result) return null;
  try {
    const v = JSON.parse(result);
    return typeof v?.scriptSetId === "string" && v.scriptSetId ? v.scriptSetId : null;
  } catch {
    return null;
  }
}

/**
 * The set this batch writes into: an existing script's set id → a set id recorded on one of this set's job
 * rows (a batch that failed part-way or is being retried) → a freshly minted one. Minting happens at most once.
 */
export function resolveScriptSetId(scripts: BatchScriptRow[], jobs: BatchJobRow[], mint: () => string): string {
  const fromScript = scripts.find((s) => s.scriptSetId)?.scriptSetId;
  if (fromScript) return fromScript;
  for (const j of jobs) {
    const id = setIdFromJobResult(j.result);
    if (id) return id;
  }
  return mint();
}

export type GenerateDecision = "no_kit" | "preparing_concepts" | "complete" | "in_flight" | "start";

/**
 * What a "generate scripts" request does. The no-kit check comes FIRST: concepts are generated only once a
 * campaign kit exists, so that sharpening a profile can never leave a stale concept set behind
 * (conceptGenerator.ts, ensureConceptsForIcp header; routers/icps.ts sharpenWithLadder).
 */
export function decideGenerate(s: {
  hasKit: boolean;
  conceptIds: number[];
  scriptConceptIds: number[];
  jobs: BatchJobRow[];
}): GenerateDecision {
  if (!s.hasKit) return "no_kit";
  if (s.conceptIds.length === 0) return "preparing_concepts";
  const have = new Set(s.scriptConceptIds);
  const missing = s.conceptIds.filter((id) => !have.has(id));
  if (missing.length === 0) return "complete";
  const missingJobIds = new Set(missing.map(scriptJobId));
  if (s.jobs.some((j) => missingJobIds.has(j.id) && (j.status === "pending" || j.status === "running"))) {
    return "in_flight";
  }
  return "start";
}

export interface BatchDeps {
  /** The ICP's current concept set, in id order. */
  loadConceptIds(): Promise<number[]>;
  loadScripts(conceptIds: number[]): Promise<BatchScriptRow[]>;
  loadJobs(jobIds: string[]): Promise<BatchJobRow[]>;
  /** INSERT a pending row carrying {scriptSetId}. false = primary-key collision. Any other error throws. */
  insertJob(jobId: string, scriptSetId: string): Promise<boolean>;
  /** Re-arm a failed/complete row to pending with a fresh created_at. false = not re-armable (someone is on it). */
  rearmJob(jobId: string, scriptSetId: string): Promise<boolean>;
  completeJob(jobId: string, scriptId: number, scriptSetId: string): Promise<void>;
  failJob(jobId: string, message: string): Promise<void>;
  generate(conceptId: number, scriptSetId: string): Promise<number>;
  mintSetId(): string;
}

export interface BatchOutcome {
  scriptSetId: string | null;
  generated: { conceptId: number; scriptId: number }[];
  failed: { conceptId: number; error: string }[];
  skippedExisting: number[];
  aborted: null | { conceptId: number; reason: "collision" | "not_rearmable" };
}

/**
 * Write a script for every concept in the set that has none, one concept at a time, into ONE set.
 * A concept whose generation fails is recorded and the loop continues; a concept someone else has
 * claimed stops the loop (see the header).
 */
export async function runScriptBatch(deps: BatchDeps): Promise<BatchOutcome> {
  const out: BatchOutcome = { scriptSetId: null, generated: [], failed: [], skippedExisting: [], aborted: null };
  const conceptIds = await deps.loadConceptIds();
  if (conceptIds.length === 0) return out;

  const scripts = await deps.loadScripts(conceptIds);
  const jobs = await deps.loadJobs(conceptIds.map(scriptJobId));
  const scriptSetId = resolveScriptSetId(scripts, jobs, () => deps.mintSetId());
  out.scriptSetId = scriptSetId;

  const have = new Set(scripts.map((s) => s.conceptId));
  const existingJobIds = new Set(jobs.map((j) => j.id));

  for (const conceptId of conceptIds) {
    if (have.has(conceptId)) {
      out.skippedExisting.push(conceptId);
      continue;
    }
    const jobId = scriptJobId(conceptId);
    const hadRow = existingJobIds.has(jobId);
    const claimed = hadRow ? await deps.rearmJob(jobId, scriptSetId) : await deps.insertJob(jobId, scriptSetId);
    if (!claimed) {
      out.aborted = { conceptId, reason: hadRow ? "not_rearmable" : "collision" };
      break;
    }

    let scriptId: number;
    try {
      scriptId = await deps.generate(conceptId, scriptSetId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      out.failed.push({ conceptId, error: message });
      await deps.failJob(jobId, message).catch((e) => {
        console.error(`[scriptBatch] could not mark ${jobId} failed (the reaper will):`, e instanceof Error ? e.message : e);
      });
      continue;
    }
    out.generated.push({ conceptId, scriptId });
    await deps.completeJob(jobId, scriptId, scriptSetId).catch((e) => {
      console.error(`[scriptBatch] script ${scriptId} saved but ${jobId} not marked complete:`, e instanceof Error ? e.message : e);
    });
  }
  return out;
}

export interface EntryIO {
  hasKit(): Promise<boolean>;
  loadConceptIds(): Promise<number[]>;
  loadScripts(conceptIds: number[]): Promise<BatchScriptRow[]>;
  loadJobs(jobIds: string[]): Promise<BatchJobRow[]>;
  /** ensureConceptsForIcp — only ever reached when a kit exists. */
  ensureConcepts(): Promise<string>;
  /** Start runScriptBatch in the background. Never awaited by the caller. */
  startBatch(): void;
}

export type EntryResult =
  | { status: "no_kit" }
  | { status: "preparing_concepts"; conceptsOutcome: string }
  | { status: "complete" }
  | { status: "in_flight" }
  | { status: "started" };

/** The "generate scripts" request: decide, then act on exactly one branch. */
export async function planAndStart(io: EntryIO): Promise<EntryResult> {
  const hasKit = await io.hasKit();
  if (!hasKit) return { status: "no_kit" };
  const conceptIds = await io.loadConceptIds();
  const scripts = conceptIds.length ? await io.loadScripts(conceptIds) : [];
  const jobs = conceptIds.length ? await io.loadJobs(conceptIds.map(scriptJobId)) : [];
  const decision = decideGenerate({ hasKit, conceptIds, scriptConceptIds: scripts.map((s) => s.conceptId), jobs });
  switch (decision) {
    case "no_kit":
      return { status: "no_kit" };
    case "preparing_concepts":
      return { status: "preparing_concepts", conceptsOutcome: await io.ensureConcepts() };
    case "complete":
      return { status: "complete" };
    case "in_flight":
      return { status: "in_flight" };
    case "start":
      io.startBatch();
      return { status: "started" };
  }
}
