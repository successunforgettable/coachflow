# SPRINT 0a: script generator dry run (2026-09-16)

**Build only. Not run against any database, not deployed, not pushed.** This is Phase B track B2 of
`BUILD_PLAN_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md`, and the "0a" split in its conflict K1. It adds `dryRun` and
`onGate` to the real `generateScriptForConcept` (`server/conceptScriptGenerator.ts`), built the same way `82d1949`
built them for `generateConceptsForIcp`. Base: `35baeb1`.

## 1. Prior art

- `git log --all -S dryRun` on the script files returned `82d1949` and `b9cf6d2`.
  - `82d1949` matched only because the path glob also covers `server/scripts/concept-dry-run-capture.ts`.
  - `b9cf6d2` is `sweepAdCreativeBatch({dryRun})`, which is ad-creative teardown and unrelated.
- `-S onGate` returned only `82d1949`.
- **No script dry run existed, and none was ever removed.**

## 2. Every write, and where the dry run stops

| write | file:line | reached by a direct dry-run call? |
|---|---|---|
| `db.insert(conceptScripts).values(row)` | `server/conceptScriptGenerator.ts:369` | **No.** The dry-run return at `:361` comes first |
| `db.insert(jobs)` (insertJob) | `server/conceptScriptBatch.ts:62` | No. This is the batch owner, which the dry run never calls |
| `db.update(jobs)` (rearmJob) | `server/conceptScriptBatch.ts:71-74` | No |
| `db.update(jobs)` (completeJob) | `server/conceptScriptBatch.ts:78` | No |
| `db.update(jobs)` (failJob) | `server/conceptScriptBatch.ts:81` | No |

Other calls on the path were checked, and none of them writes:

- **`recordComplianceGate`** only updates a tally in process memory and logs one line (`_core/complianceTelemetry.ts:75`).
- **`getCascadeContext`, `groundingCorpus` and `complianceAxis`** contain no insert, update or delete.

**The batch path never reaches the dry run.** `BatchDeps.generate` calls
`generateScriptForConcept({ userId, conceptId, scriptSetId })`, and the `dryRun?: false` overload types that call as
`Promise<number>`. Neither batch file mentions `dryRun`, and a pin checks both.

## 3. The change

| part | what it does |
|---|---|
| `dryRun?: boolean` | One early return (`:361`), placed after the final-failure throw (`:335`) and immediately before the only write. It returns `{ dryRun: true, scriptId: null, wouldInsert: row }` |
| `row` | The insert's values literal, moved into `const row` unchanged. The insert now receives `row`, so the reported row is the written row by construction |
| `onGate?` | Called after each `gate(…)` verdict and on each generation error, in both modes. A no-op when absent |
| record per attempt | `attempt`, `scenesReturned`, combined `ok`, `labels`, `failContext`, `error`, and `axes` |
| `axes` | The structure, compliance and output verdicts, each with its own labels |
| `lastAxes` | Copies `axes` from the objects `gate` already built (`:270`). Nothing reads it except the observer |
| overloads | `dryRun: true` returns `ScriptDryRunResult`; otherwise the return is `number`, as before |

**Proof the non-dry-run lines are untouched.** `git diff -U0` shows exactly 5 removed lines:

```
-}): Promise<number> {                                         → }): Promise<number | ScriptDryRunResult> {
-  let script = await invokeScript(prompt, "");                → await generateAttempt(1, "")
-    script = await invokeScript(prompt, result.failContext);  → await generateAttempt(attempt, result.failContext)
-  const insert: any = await db.insert(conceptScripts).values({ → const row = {
-  });                                                         → };   (then the insert .values(row))
```

- **`generateAttempt` makes the same call with the same arguments, and re-throws the same error.**
- **The rest is additions only.** No line of `gate`, the attempt budget (`MAX_ATTEMPTS = 3`), the loop condition, the
  first-pass capture, the telemetry, the throw, or the values literal changed.

## 4. Pins: `server/conceptScriptGeneratorDryRun.test.ts` (5 tests)

Every position a pin compares is first asserted to be found (> -1), so a renamed marker fails the pin instead of
passing it (§15k).

1. **One gate definition:** exactly one `const gate = (` in the file.
2. **Return placement:** the dry-run return comes after the last `gate(` call and after `if (!result.ok) throw`, and
   before `db.insert(conceptScripts)`.
   - The function has exactly one `db.insert(`, and no update, delete or `.execute(`.
   - The insert takes `.values(row)`.
3. **The dry-run branch does nothing of its own:**
   - no `gate(`, `validateScriptStructure`, `screenScriptCompliance`, `checkOutput`, `invokeScript`,
     `generateAttempt`, `db.` or `observe(`;
   - it must contain `dryRun: true` and `wouldInsert: row`.
4. **The observer is never a verdict:**
   - `const observe = params.onGate ?? (() => {})`;
   - no `result = observe`, no `onGate?.(`, no `if (` on `lastAxes` or `observe`, no `ok: lastAxes`;
   - exactly two `result = gate(`;
   - the gate's combined-verdict line is unchanged;
   - `generateAttempt` observes an error and then re-throws it.
5. **The default path is unchanged:**
   - the budget, loop and throw lines are unchanged, and the function never mentions `jobs`;
   - the batch call has no `dryRun`, and neither batch file mentions it;
   - the harness passes `dryRun: true`.

### Mutations (negative controls)

Each mutation was applied to the file, the pins were run, and the file was restored from a copy. All three restores
were md5-checked: `1942866de96d94a56177ebe69bdfd309`. **None of the mutations was committed.**

| mutation | pins failed |
|---|---|
| N1 · the dry-run return moved after the insert | 1 (pin 2) |
| N2 · a second `const gate = (` inside the dry-run branch | 1 (pin 1) |
| N3 · the dry-run branch calls `result = gate(script)` itself | 3 (pins 2, 3, 4) |

## 5. Gates: baseline measured in this worktree before any change, and re-run after (§15f)

| gate | before | after |
|---|---|---|
| `npx tsc --noEmit` error count | 34 | **34** |
| conceptScriptGeneratorDryRun (new) | — | **5/5** |
| conceptScriptGenerator | 11 | 11 |
| scriptBatch | 15 | 15 |
| conceptGeneratorDryRun | 5 | 5 |
| conceptScriptValidator | 8 | 8 |
| complianceGate | 24 | 24 |
| fabricationGateDefects | 15 | 15 |
| pipeline-fixes | 414 | 414 |

Notes on the test files:

- **Two named files do not exist.** There is no `server/_core/validator.test.ts` and no `server/conceptScriptBatch*.test.ts`.
  The matching files are `server/conceptScriptValidator.test.ts` and `server/scriptBatch.test.ts`, the same ones
  `82d1949` counted.
- **`fabricationGateDefects.test.ts` was added** because it also pins the script generator's source.

## 6. Truncation: the script loop behaves the same as the concept loop

**A truncation that throws is never retried.**

- **No retry.** `generateAttempt` is awaited in the loop with no `try` around it. So a throw from the model call leaves
  the loop and the function on whichever attempt it happens. The loop only regenerates after a gate failure.
- **The throws in question:**
  - the tool-use response missing its `tool_use` block, `llm.ts:625` (the message carries `stop_reason`);
  - `JSON.parse` failing in `invokeScript`.
- **Telemetry never sees it.** `recordComplianceGate` sits after the loop, so a truncated script never enters the
  block rate.
- **The observer records it** as `{ ok: null, axes: null, error }`, which keeps it separate from a gate rejection.
- **Not verified: a partial `tool_use` input.** If the API returns one at `max_tokens`, the object would reach the gate
  instead, and a gate failure is retried. The observer shows which of the two cases happened.

**The ceiling is 8192, not 2000.**

- `invokeScript` passes `maxTokens: 2000` (`conceptScriptGenerator.ts:156`), and **nothing reads it**. `maxTokens`
  appears in `llm.ts` only as a type field (`:63`).
- The Anthropic path, `invokeClaudeAPI`, sends a fixed `max_tokens: 8192` (`llm.ts:428`). The Gemini fallback sends
  32768 (`:742`).
- This was established by reading the code, not by a run.

## 7. Callers (§15d)

`server/scripts/script-dry-run-capture.ts` is a thin caller built like `concept-dry-run-capture.ts`.

- **Input and output:** it reads env `USER_ID`, `CONCEPT_ID` and `OUT`, and writes `script-dry-run-concept<id>.json`
  containing every `onGate` record and the outcome.
- **The only caller.** Until sprint 0b, the harness is the only caller of `dryRun`, by design. Nothing in the product
  reaches it, and nothing should.
- **Not run.** Running it reads a real database and calls the model, so it needs its own authorisation.

## 8. Known properties, carried over from `82d1949` unchanged

- **A throwing observer.** `observe` is called unguarded, so an `onGate` that throws would change control flow.
  - Production never passes `onGate`, so there it is a no-op.
  - The harness observer only pushes to an array and logs.
- **A gate that throws.** A throw inside `gate` itself, for example on malformed partial input, is not observed. It
  propagates exactly as before.
- **Worktree base.** The worktree branch was created at an old commit (`67517e3`). It was reset to `35baeb1`, with no
  local changes, before any work began.
