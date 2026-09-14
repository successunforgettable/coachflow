import { describe, it, expect } from "vitest";
import {
  scriptJobId,
  resolveScriptSetId,
  decideGenerate,
  runScriptBatch,
  planAndStart,
  type BatchDeps,
  type BatchJobRow,
  type BatchScriptRow,
} from "./_core/scriptBatch";

const EIGHT = [101, 102, 103, 104, 105, 106, 107, 108];

function fakeDeps(opts: {
  conceptIds: number[];
  scripts?: BatchScriptRow[];
  jobs?: BatchJobRow[];
  failOn?: number[];
  collideOn?: number[];
}) {
  const log: string[] = [];
  const generateCalls: { conceptId: number; scriptSetId: string }[] = [];
  const jobRows = new Map<string, BatchJobRow>((opts.jobs ?? []).map((j) => [j.id, { ...j }]));
  let minted = 0;
  const deps: BatchDeps = {
    loadConceptIds: async () => opts.conceptIds,
    loadScripts: async () => opts.scripts ?? [],
    loadJobs: async (ids) => [...jobRows.values()].filter((j) => ids.includes(j.id)).map((j) => ({ ...j })),
    insertJob: async (jobId, scriptSetId) => {
      if (jobRows.has(jobId) || (opts.collideOn ?? []).some((c) => scriptJobId(c) === jobId)) return false;
      jobRows.set(jobId, { id: jobId, status: "pending", result: JSON.stringify({ scriptSetId }) });
      log.push(`insert:${jobId}`);
      return true;
    },
    rearmJob: async (jobId, scriptSetId) => {
      const j = jobRows.get(jobId);
      if (!j || j.status === "pending" || j.status === "running") return false;
      j.status = "pending";
      j.result = JSON.stringify({ scriptSetId });
      log.push(`rearm:${jobId}`);
      return true;
    },
    completeJob: async (jobId) => {
      jobRows.get(jobId)!.status = "complete";
      log.push(`complete:${jobId}`);
    },
    failJob: async (jobId) => {
      jobRows.get(jobId)!.status = "failed";
      log.push(`fail:${jobId}`);
    },
    generate: async (conceptId, scriptSetId) => {
      log.push(`generate:${conceptId}`);
      generateCalls.push({ conceptId, scriptSetId });
      if ((opts.failOn ?? []).includes(conceptId)) throw new Error("Script failed validation after 3 attempts");
      return 9000 + conceptId;
    },
    mintSetId: () => `minted-${++minted}`,
  };
  return { deps, log, generateCalls, jobRows, mintedCount: () => minted };
}

describe("scriptBatch — one set id per batch", () => {
  it("every script in a batch receives the SAME scriptSetId, minted exactly once", async () => {
    const f = fakeDeps({ conceptIds: EIGHT });
    const o = await runScriptBatch(f.deps);
    expect(f.generateCalls).toHaveLength(8);
    expect(new Set(f.generateCalls.map((c) => c.scriptSetId)).size).toBe(1);
    expect(f.generateCalls[0].scriptSetId).toBe(o.scriptSetId);
    expect(f.mintedCount()).toBe(1);
  });

  it("the instrument can see two different sets (two fresh batches mint two ids)", async () => {
    const a = fakeDeps({ conceptIds: [1, 2] });
    const b = fakeDeps({ conceptIds: [3, 4] });
    let n = 0;
    a.deps.mintSetId = () => `set-${++n}`;
    b.deps.mintSetId = () => `set-${++n}`;
    const oa = await runScriptBatch(a.deps);
    const ob = await runScriptBatch(b.deps);
    expect(oa.scriptSetId).not.toBe(ob.scriptSetId);
  });

  it("a retry joins the EXISTING set: reuses its id, writes only the missing concepts, mints nothing", async () => {
    const scripts = [101, 102, 103].map((conceptId) => ({ conceptId, scriptSetId: "existing-set" }));
    const f = fakeDeps({ conceptIds: EIGHT, scripts });
    const o = await runScriptBatch(f.deps);
    expect(o.scriptSetId).toBe("existing-set");
    expect(f.generateCalls.map((c) => c.conceptId)).toEqual([104, 105, 106, 107, 108]);
    expect(f.generateCalls.every((c) => c.scriptSetId === "existing-set")).toBe(true);
    expect(o.skippedExisting).toEqual([101, 102, 103]);
    expect(f.mintedCount()).toBe(0);
  });

  it("with no scripts yet, reuses the set id recorded on a failed job row rather than minting a second set", () => {
    const jobs: BatchJobRow[] = [{ id: scriptJobId(101), status: "failed", result: JSON.stringify({ scriptSetId: "from-job" }) }];
    let minted = 0;
    expect(resolveScriptSetId([], jobs, () => `m-${++minted}`)).toBe("from-job");
    expect(minted).toBe(0);
  });
});

describe("scriptBatch — one job row per concept, reaper-safe", () => {
  it("inserts each concept's job row immediately before that concept is generated, never ahead of time", async () => {
    const f = fakeDeps({ conceptIds: [1, 2, 3] });
    await runScriptBatch(f.deps);
    expect(f.log).toEqual([
      `insert:${scriptJobId(1)}`, "generate:1", `complete:${scriptJobId(1)}`,
      `insert:${scriptJobId(2)}`, "generate:2", `complete:${scriptJobId(2)}`,
      `insert:${scriptJobId(3)}`, "generate:3", `complete:${scriptJobId(3)}`,
    ]);
  });

  it("a failed concept is recorded and the loop CONTINUES to the rest", async () => {
    const f = fakeDeps({ conceptIds: EIGHT, failOn: [103] });
    const o = await runScriptBatch(f.deps);
    expect(o.failed.map((x) => x.conceptId)).toEqual([103]);
    expect(o.generated).toHaveLength(7);
    expect(f.jobRows.get(scriptJobId(103))!.status).toBe("failed");
    expect(f.generateCalls.map((c) => c.conceptId)).toEqual(EIGHT);
  });

  it("a failed row is RE-ARMED on retry; concepts with scripts are skipped", async () => {
    const scripts = EIGHT.filter((c) => c !== 103).map((conceptId) => ({ conceptId, scriptSetId: "s" }));
    const jobs: BatchJobRow[] = [{ id: scriptJobId(103), status: "failed", result: JSON.stringify({ scriptSetId: "s" }) }];
    const f = fakeDeps({ conceptIds: EIGHT, scripts, jobs });
    const o = await runScriptBatch(f.deps);
    expect(f.log).toEqual([`rearm:${scriptJobId(103)}`, "generate:103", `complete:${scriptJobId(103)}`]);
    expect(o.generated).toEqual([{ conceptId: 103, scriptId: 9103 }]);
  });

  it("a concept another loop holds (pending row) ABORTS the batch before anything is written", async () => {
    const jobs: BatchJobRow[] = [{ id: scriptJobId(101), status: "pending", result: JSON.stringify({ scriptSetId: "other" }) }];
    const f = fakeDeps({ conceptIds: EIGHT, jobs });
    const o = await runScriptBatch(f.deps);
    expect(o.aborted).toEqual({ conceptId: 101, reason: "not_rearmable" });
    expect(f.generateCalls).toHaveLength(0);
    expect(f.log).toEqual([]);
  });

  it("a primary-key collision on insert ABORTS the batch before anything is written", async () => {
    const f = fakeDeps({ conceptIds: EIGHT, collideOn: [101] });
    const o = await runScriptBatch(f.deps);
    expect(o.aborted).toEqual({ conceptId: 101, reason: "collision" });
    expect(f.generateCalls).toHaveLength(0);
  });

  it("job ids fit jobs.id varchar(36) for the largest int id", () => {
    expect(scriptJobId(2147483647).length).toBeLessThanOrEqual(36);
  });
});

describe("decideGenerate / planAndStart — the no-kit guard and the no-concepts path", () => {
  it("decides every branch", () => {
    expect(decideGenerate({ hasKit: false, conceptIds: EIGHT, scriptConceptIds: [], jobs: [] })).toBe("no_kit");
    expect(decideGenerate({ hasKit: false, conceptIds: [], scriptConceptIds: [], jobs: [] })).toBe("no_kit");
    expect(decideGenerate({ hasKit: true, conceptIds: [], scriptConceptIds: [], jobs: [] })).toBe("preparing_concepts");
    expect(decideGenerate({ hasKit: true, conceptIds: [1, 2], scriptConceptIds: [1, 2], jobs: [] })).toBe("complete");
    expect(
      decideGenerate({ hasKit: true, conceptIds: [1, 2], scriptConceptIds: [1], jobs: [{ id: scriptJobId(2), status: "pending", result: null }] }),
    ).toBe("in_flight");
    expect(decideGenerate({ hasKit: true, conceptIds: [1, 2], scriptConceptIds: [1], jobs: [] })).toBe("start");
  });

  function io(over: { hasKit: boolean; conceptIds: number[]; scripts?: BatchScriptRow[] }) {
    const calls = { ensureConcepts: 0, startBatch: 0, loadConceptIds: 0 };
    return {
      calls,
      io: {
        hasKit: async () => over.hasKit,
        loadConceptIds: async () => {
          calls.loadConceptIds++;
          return over.conceptIds;
        },
        loadScripts: async () => over.scripts ?? [],
        loadJobs: async () => [],
        ensureConcepts: async () => {
          calls.ensureConcepts++;
          return "enqueued";
        },
        startBatch: () => {
          calls.startBatch++;
        },
      },
    };
  }

  it("NO KIT: never generates concepts or scripts — not even reading the concept set", async () => {
    const x = io({ hasKit: false, conceptIds: [] });
    expect(await planAndStart(x.io)).toEqual({ status: "no_kit" });
    expect(x.calls).toEqual({ ensureConcepts: 0, startBatch: 0, loadConceptIds: 0 });
  });

  it("KIT, NO CONCEPTS YET: prepares concepts once, starts no script batch", async () => {
    const x = io({ hasKit: true, conceptIds: [] });
    expect(await planAndStart(x.io)).toEqual({ status: "preparing_concepts", conceptsOutcome: "enqueued" });
    expect(x.calls.ensureConcepts).toBe(1);
    expect(x.calls.startBatch).toBe(0);
  });

  it("KIT + CONCEPTS: starts the batch, never touches concept generation", async () => {
    const x = io({ hasKit: true, conceptIds: EIGHT });
    expect(await planAndStart(x.io)).toEqual({ status: "started" });
    expect(x.calls).toMatchObject({ ensureConcepts: 0, startBatch: 1 });
  });

  it("ALL WRITTEN: does nothing", async () => {
    const x = io({ hasKit: true, conceptIds: [1], scripts: [{ conceptId: 1, scriptSetId: "s" }] });
    expect(await planAndStart(x.io)).toEqual({ status: "complete" });
    expect(x.calls).toMatchObject({ ensureConcepts: 0, startBatch: 0 });
  });
});
