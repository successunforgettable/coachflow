# CAPTURE: kit 187 concept generation, dry run on production data (2026-09-14 22:02 UTC)

**Read-only. Zero writes, proven below.** Authorised by Arfeen. It ran the REAL `generateConceptsForIcp` with the new
`dryRun` flag.

## 1. The dry-run addition, and proof it shares the production gate

**Changed:** `server/conceptGenerator.ts`, 55 lines added and 2 removed, against the deployed `87596d7`.

- **`dryRun?: boolean`:** a single early return, placed immediately before the function's only write (the delete-then-insert
  of `campaignConcepts`). It returns `persisted: 0` plus the concepts that would have been written.
- **`onGate?: (record) => void`:** an observer called after each existing `gate(…)` verdict and on each generation error, in
  both modes. Absent, it is a no-op. It never assigns a verdict.
- **The only two removed lines** are the attempt loop's `invokeConcepts(prompt, …)` calls. They now go through
  `generateAttempt(…)`, which makes **the same call with the same arguments** and re-throws unchanged.
- **Untouched:** `gate`, `conceptPassesAlone`, the retry loop condition, partial delivery, trim, top-up, the write.

### Pinned by `server/conceptGeneratorDryRun.test.ts` (5 tests)

1. exactly ONE `const gate = (` in the file;
2. the dry-run return comes after every `gate(` call and before the delete and the insert;
3. exactly one delete and one insert in the function;
4. the dry-run branch calls no gate, validator, compliance check, `checkOutput`, `invokeConcepts` or `conceptPassesAlone`;
5. the observer is never used as a verdict.

**Negative controls.** Each mutation was applied, run, then restored and md5-verified. **Every one failed the pin test:**

| mutation | failed |
|---|---|
| N1 · dry-run return moved after the write | 1 |
| N2 · a second gate definition | 1 |
| N3 · the dry-run branch calls `gate()` itself | 2 |

### Gates

| gate | result |
|---|---|
| tsc | **34** (baseline) |
| dry-run pins | 5/5 |
| conceptGenerator | 12 |
| complianceGate (source pins on the generator) | 24 |
| fabricationGateDefects | 15 |
| conceptAxis | 20 |
| scriptBatch | 15 |
| conceptScriptValidator | 8 |
| pipeline-fixes | 414 |
| complianceFilter | 31 |
| tokenCrypto | 10 |

**Code parity:** the gate, validator, compliance-axis and `llm.ts` files are byte-identical to the deployed `87596d7`, so the
capture ran production's gate.

## 2. The run

- **Target:** user 117174 · ICP 249 · kit 187 · service 272.
- **Harness:** `server/scripts/concept-dry-run-capture.ts`, a thin caller of the real function.
- **Target guard:** `@@version_comment` = *MySQL Community Server - GPL*.

| time (UTC) | event |
|---|---|
| 22:02:10 | whole-database snapshot, 58 tables with `CHECKSUM TABLE` |
| 22:02:18 | capture start |
| +187 s | **attempt 1: `[LLM][model] stop_reason=max_tokens in=4427 out=8192`** → *"Concept generation returned no concepts array"* |
| 22:05:27 | capture end: `completed: false`. The error escaped `generateConceptsForIcp` |
| 22:05:34 | snapshot #2 |

**Observer record:** `{ phase: "attempt", attempt: 1, conceptsReturned: null, ok: null, labels: "", error: "Concept generation returned no concepts array" }`.

### Blast radius: 🟢 ZERO WRITES

`diff` of the two snapshots: **no change in any of 58 tables** (row count, max id, max `updatedAt`, `CHECKSUM TABLE`).

- **The instrument can see writes:** the same tool detected every write in this session's earlier runs (`conceptScripts` +8,
  `jobs` +9, and a `product_events` +1 / `users` touch from a page view).
- **This path writes no job row:** the harness calls `generateConceptsForIcp` directly, not `ensureConceptsForIcp`.

## 3. What it shows — kit 187's actual failure on this run

**This run: TRUNCATION at the 8,192 ceiling on attempt 1, BEFORE the gate.** The gate never ran, so **no gate verdict and no
rejection labels exist for this run.**

### Evidence across all three first attempts measured on ICP 249

| run | attempt 1 output | stop_reason | reached the gate? |
|---|---|---|---|
| 2026-09-14 run 1 (product path) | 7,754 | `tool_use` | yes; verdict unrecorded, and the generation was then killed by a harness fault |
| 2026-09-14 run 2 (product path) | 7,892 | `tool_use` | yes, **rejected** (labels unlogged); the retry was then truncated at 8,192 |
| **2026-09-14 22:02 dry run** | **≥ 8,192** | **`max_tokens`** | **no.** Truncated before the gate |

**The first attempt itself sits AT the ceiling:** 1 of 3 first attempts measured was cut off. Kit 187 therefore has
**two failure paths**:
1. truncation, on any attempt;
2. a gate rejection whose reason is still unknown.

### A new structural finding

**A truncated response is never retried.** `invokeConcepts` throws on a missing array, and that throw escapes the attempt loop
(`generateAttempt` re-throws, exactly as the original call did). The loop only regenerates on a *gate* failure, so one
truncation ends the whole generation: no attempt 2, no partial delivery, no top-up.

### What is still NOT known

**The gate's rejection reason for ICP 249.** No run in this session has recorded it:
- run 2's verdict was never logged;
- this run never reached the gate.

Absence of labels here is not evidence of no gate problem (CLAUDE.md §15-PARENT).

**Getting it needs a first attempt that comes back under 8,192.** Two of the three measured did. A re-run of this same dry run
is the cheapest way:
- read-only, zero writes, the same harness;
- about 3–8 minutes and about 8–16k output tokens per attempt;
- **not run, pending a go-ahead.**

## 4. Unchanged, still authorised and not done

The two false-comment corrections:
- `server/routers/campaignKits.ts`: *"repeat calls cost one indexed SELECT each and nothing more."*
- `server/conceptGenerator.ts`: *"…so even a lost race cannot produce a doubled set."*
