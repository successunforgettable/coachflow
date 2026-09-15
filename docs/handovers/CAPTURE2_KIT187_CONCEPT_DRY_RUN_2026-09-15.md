# CAPTURE 2: kit 187 concept generation, dry run on production data (2026-09-15 13:37 UTC)

**Authorised:** `CHECKPOINT_2026-09-15_THREADS_A_B.md` §5.3 (1), re-confirmed in Arfeen's 2026-09-15 session instruction.
**Harness:** unchanged from capture 1 (`CAPTURE_KIT187_CONCEPT_DRY_RUN_2026-09-15.md`): `server/scripts/concept-dry-run-capture.ts`
calling the real `generateConceptsForIcp({ dryRun: true })`. Code at `dd2936c` (the comment-only commit `54c7555` landed
during the run and changes no executable line).
**Target:** user 117174 · ICP 249 · kit 187 · service 272.

## 1. The run

| time (UTC) | event |
|---|---|
| 13:37:32 | target guard: `@@version_comment` = **MySQL Community Server - GPL** → PASS |
| 13:37:35 | whole-database snapshot, 58 tables, `CHECKSUM TABLE` (measured at run time, §15f) |
| 13:37:43 | capture start |
| +162 s | **attempt 1: `stop_reason=tool_use in=4427 out=7163`** → 12 concepts returned → **gate REJECTED** |
| +341 s | **attempt 2 (the retry): `stop_reason=max_tokens in=4968 out=8192`** → *"Concept generation returned no concepts array"* |
| 13:43:27 | capture end, `completed: false` · snapshot #2 |

### Blast radius: 🟢 ZERO WRITES

`diff before.tsv after.tsv`: **0 changed lines across 58 tables** (row count, max id, max `updatedAt`, checksum).

The instrument was not blind: the before-snapshot holds 1,001 rows, a checksum for every one of the 58 tables (0 × "?"),
and non-zero checksums on every populated table (the 28 zero checksums are the tables left empty by the 2026-09-12 wipe).
Sample: `campaignConcepts` 8 · `conceptScripts` 8 · `jobs` 9 · `product_events` 27.

## 2. THE ANSWER: why the gate rejects profile 249

**Attempt 1 came back complete (7,163 tokens) and the gate rejected it on six findings, two classes:**

### 2a. `second_person_protected_attribute` × 4 — from `complianceAxis.ts:882-897`

The rule fires when a term from `PROTECTED_ATTRIBUTE_TERMS` (`complianceAxis.ts:73`) sits adjacent to a second-person marker.

| location | flagged sentence | term matched | reading |
|---|---|---|---|
| concept[9].shortText | "It ends with an answer you can say with conviction." | `"conviction"` (`:98`, criminal-record list) | 🔴 **false positive.** "Conviction" means certainty here |
| concept[9].longText | "A named role, a specific type of organisation, an answer you could say out loud with actual conviction." | `"conviction"` | 🔴 **false positive**, same word sense |
| concept[1].longText | "It accounts for the fact that you can't afford to get this wrong." | `"can't afford"` (`:92`, financial list) | 🟠 **false positive by meaning**: an idiom for "the stakes are high", not a statement of the reader's finances |
| concept[3].shortText | "…every step is scoped to protect the income threshold you can't affo[rd]…" | `"can't afford"` | 🟢 **arguably a true positive**: it states a financial circumstance of the reader |

**Confidence:** HIGH that both "conviction" findings are a word-sense false positive (the term list has no sense
disambiguation; the adjacency test is purely lexical). MEDIUM on the idiom. So **at least two, and probably three, of the four
protected-attribute findings are the checker misreading ordinary English**, not the model breaking policy.

### 2b. `invented_statistic` × 2 — from `fabricationValidator.ts` (`outcome_statistic` → `invented_statistic`, `:41`)

| location | flagged |
|---|---|
| concept[2].longText | "90%" |
| concept[3].longText | "90%" |

Whether this coach's material carries a 90% figure: see §2c.

### 2c. Is "90%" in the coach's material?

Read-only query 2026-09-15, every occurrence of `90` or `ninety` in the three sources:

| source | what it is | "90" occurrences | percent form |
|---|---|---|---|
| `services` 272 `description`, `riskReversal` | **the coach's own material** | 3, all **"90-day"** (the plan, the guarantee window) | **0** |
| `idealCustomerProfiles` 249 `groundingMeta` | the coach's verbatim ladder answers | 0 — **the column is NULL; this profile has no ladder answers** | 0 |
| `idealCustomerProfiles` 249 prose (`demographics`, `desiredOutcomes`, …) | **generated** by the ICP generator | 7 | **2**, e.g. *"without dropping below **85–90%** of my current salary"* |

🟢 **Both `invented_statistic` findings are TRUE POSITIVES.** The only "90%" anywhere upstream is in the generated ICP prose,
and a generated row is not the coach's words (CLAUDE.md §15a). The concept model lifted a figure the ICP generator invented
and stated it as evidence; the gate correctly refused it. The concept[3] "income threshold you can't afford" line traces to
the same generated salary figure.

**So the two rejection classes split cleanly:** the statistic findings are the gate working; the protected-attribute findings
are mostly the gate misreading English (§2a).

## 3. What happened next — the retry truncated, and a truncation ends the run

- The gate's `failContext` (both correction families) was appended to the retry prompt: input rose **4,427 → 4,968** tokens.
- **The retry was cut off at the 8,192 ceiling.** `invokeConcepts` threw, the throw escaped the attempt loop, and the generation
  ended with **no third attempt, no partial delivery, no top-up** — the capture-1 structural finding, now observed a second time.

### Every measured ICP 249 attempt

| run | attempt 1 | gate | attempt 2 (retry) |
|---|---|---|---|
| 2026-09-14 run 1 (product path) | 7,754 `tool_use` | verdict unrecorded | killed by a harness fault |
| 2026-09-14 run 2 (product path) | 7,892 `tool_use` | rejected, labels unlogged | **8,192 truncated** |
| 2026-09-14 22:02 capture 1 | **8,192 truncated** | never reached | none (truncation not retried) |
| **2026-09-15 13:37 capture 2** | **7,163 `tool_use`** | **rejected: 4 × protected attribute, 2 × invented statistic** | **8,192 truncated** |

- First attempts: **1 of 4 truncated.**
- Retries that reached generation: **2 of 2 truncated** — the retry carries a longer prompt and asks the model to rewrite
  twelve concepts "with the same force and the same specific detail", and has never once fit under the ceiling.

## 4. What this means for kit 187 (a finding, not a fix shape)

Kit 187 has no successful path today:
1. a first attempt sometimes truncates, and a truncation is never retried;
2. a first attempt that fits is rejected, **at least partly by false positives** in the protected-attribute term list;
3. the retry that should repair it has truncated every time it has run.

The concept-generator fix shape (`CHECKPOINT_2026-09-15_THREADS_A_B.md` §7 item 1) is still **not decided**. This capture adds
one new input to it: a second defect in the protected-attribute rule (word-sense false positives on "conviction" and the idiom
"can't afford to"), which affects every caller of `complianceAxis` — not only concepts. Not scoped here.

## 5. Files

Scratchpad (temporary): `capture2/run.log`, `capture.log`, `before.tsv`, `after.tsv`, `diff.txt`,
`out/concept-dry-run-icp249.json`. The observer record and every figure above are reproduced in this file.
