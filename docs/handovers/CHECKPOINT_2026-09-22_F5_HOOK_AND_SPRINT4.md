> 🗄️ **SUPERSEDED 2026-09-24 — NOT THE ENTRY POINT.** Resume from `CHECKPOINT_2026-09-24_HOOK_WORDING_SETTLED_H2_NEXT.md`.
> ⚠️ This document's over-budget comparisons use the recorded 10/24 pre-hook baseline, which a same-day control showed to be stale (17/24 on 2026-09-24).

# 🗄️ RESUME POINT (SUPERSEDED) — 2026-09-22: F5 label class, the hook fix, and where sprint 4 actually stands

**Supersedes `CHECKPOINT_2026-09-16_SCRIPT_QUALITY_BUILD.md`**, which is retained and marked superseded.
Written so a cold terminal resumes from exactly this point.

**Every figure below was measured at write time** (§15f): git via `git rev-parse` / `git ls-remote`, Railway via
`railway deployment list`, the production DB via a read-only 59-table snapshot, and every quality number from
raw run JSON produced tonight. Nothing here is copied from an older document.

---

## 0. THE THIRTY-SECOND VERSION

| | |
|---|---|
| **production code** | **`87596d7`**, Railway `SUCCESS`, deployed 2026-09-14 21:11:33 UTC. GitHub `railway-build` = `87596d7`. **Nothing pushed past it** |
| **held branch** | `docs/held-2026-09-12` = **`60ec85f`**, **34 commits over production**, clean fast-forward. **NOT pushed** |
| **production DB** | 59 tables, `coachFacts` 0 rows. **Zero writes tonight** — snapshot identical either side of 168 generations |
| **tonight's spend** | ~294 model calls: 210 F5 probe + 4 × 24 generation runs + 42 latency |
| **what changed** | F5 gained a specific-state clause and an ambiguous class · beat labels left the checker (−30% output) · the scenes crash is fixed · the hook is measured, fixed and demoted to label-only |
| **next action** | **Sprint 4 step 2 (max-sentence ≤ 18), HELD** — see §6 |

🔴 **PUSHING `railway-build` IS THE DEPLOY.** Deploy remains on HOLD. Two things on this branch now matter to a
live coach: the scenes-crash fix (§4) and the checker's latency and prompt changes.

---

## 1. VERIFY GROUND TRUTH FIRST — measure, never read from this file (§15f)

```bash
git fetch origin && git rev-parse --short HEAD origin/railway-build
#   expect: 60ec85f · 87596d7
git ls-remote origin refs/heads/railway-build              # expect 87596d7 (nothing pushed)
git rev-list --count origin/railway-build..HEAD            # expect 34
git merge-base --is-ancestor origin/railway-build HEAD && echo ff-ok
git branch -a --contains 2562e64                           # expect ONLY personal/dab-stills + the backup ref
git status --porcelain --untracked-files=no                # expect nothing
npx tsc --noEmit 2>&1 | grep -c "error TS"                 # expect 34
```

---

## 2. DECISIONS LOCKED TONIGHT

### D-i · drafting prompt — **arm (a). Arm (b) CLOSED.**
Sprint 0b ran 8 concepts × 2 arms × 3 runs = 48 generations, zero writes.

| | arm (a) prompt-enforced | arm (b) gate-enforced |
|---|---|---|
| produced within 3 attempts | **22/24 = 92%** | **14/24 = 58%** |
| first-pass gate PASS | **11/24 = 46%** | **0/24 = 0%** |
| `script_length_over_budget` first pass | 10/24 | **24/24 = 100%** |
| mean attempts | 1.50 | 2.63 |

Every arm-(b) draft overran; 10 of 24 exhausted the budget and produced nothing. **K8 answered: arm (b) does not
converge within the locked budget of 3.** No further work on arm (b). Its instrument (`lib-arm-b.ts`,
`--arms`) is retained and kept tracking the production prompt so it fails loudly rather than rotting.

⚠️ Arm (b)'s other columns are **survivorship-biased** (14 survivors are the cells that happened to converge) and
its set-level rows came from 5/7/2-script sets against arm (a)'s 8/8/6. **Do not quote them as a comparison.**

### The conditional clause — **LANDED and CONFIRMED** (`23c563e`)
`groundingChecker.ts` LIST 2 carries the specific-state-vs-category-membership distinction, **alone**. Three A/B
probes, 210 calls, arms differing by exactly that one line:

| | before | after |
|---|---|---|
| conditional control flagged | **14/15** | **0/15** |
| must-block recall | 45/45 | **45/45** |
| F5 precision (n=12) | 50.0% | **69.2%** |

The **subject-test** clause tried first was measured inert (pension 6/6 → 6/6) and reverted. It is not on the branch.

### F5 label — **Arfeen's ruling, implemented as `financialAmbiguous`** (`60ec85f`)
The pension line — *"Nobody's building a pension behind a salary any more."*, **P1's opening hook in the
coach-voice nine** — is ruled an accepted personal-voice hook, not a finance claim.

Deleting it from `financialNotFind` would have stopped the **scorer** reporting a flag the **checker still
raises in production** — the failure moved out of sight, not out of the product (§15-PARENT). So it moved to a
third class: **reported every run, counted as neither a false positive nor a promotion blocker.**
`financialNotFind` is unchanged and still gates, pinned by two tests (the conditional control; the other p1
control line "none of them is money").

🔴 **The checker still flags this line** — 16 of 24 after-arm runs. The ruling changes what it COSTS, not what
the model does. If F5 is ever promoted to blocking, this line is blocked in production unless something else
changes.

### The hook fix — **prompt steering KEPT, blocking check DEMOTED to label-only** (`0288828`, `0787b33`, `60ec85f`)
Four generation runs, 24 cells each, one change at a time (§15h):

| variant | produced /3 att | hook ≤10 | hook mean | `hook_too_long` 1st pass | `over_budget` 1st pass |
|---|---|---|---|---|---|
| baseline | **22/24** | 4/22 = 18% | 21.0 | 0/24 | 10/24 |
| A craft wording only | 11/24 | **11/11** | 7.0 | 19/24 | 14/24 |
| B + scene-1 rewrite + "2–3 sentences" | 5/24 | 5/5 | 6.6 | 1/24 | 23/24 |
| C scene-1 rewrite, no sentence invite | 5/24 | 5/5 | 6.8 | 4/24 | **24/24** |

*(benchmark: hook ≤10 9/9, mean 8.6)*

- **Root cause was a CONTRADICTION, not a missing rule:** `SCRIPT_STRUCTURE_CRAFT` said *"HOOK (the opening,
  under ~10 words)"* while the generator sized scene 1 at 30–36 words, and "the opening" reads as the scene.
- **KEPT:** the craft-wording disambiguation (first SENTENCE, "~" gone) and the one-line scene-1 note. Together
  they took first-pass `hook_too_long` from **19/24 to 1–4/24** — that is the steering.
- **REVERTED as measured-harmful:** telling the model scene 1 *"carries on … to fill its word range"*. It
  inflated the whole script.
- ⚠️ **I was wrong once here and variant C is what proved it.** I blamed B's blow-up on "two or three sayable
  sentences"; removing it changed nothing (23/24 → 24/24). The cause was the other half of the same edit.
- ⚠️ **`"ONE spoken line"` is load-bearing as a LENGTH BRAKE** even though it is factually wrong about what the
  model does (2.60 sentences per scene, measured). Replacing it cost 14 of 24 generations. Restored. **Do not
  "fix" that phrase without measuring.**
- **Demoted to label-only:** blocking gave the right copy and far too little of it (22/24 → 11/24).
  `ScriptResult` gained `labels`, recorded on a pass and a fail alike, surfaced through `onGate` as
  `observedLabels`. **Promote on the first-pass rate, not on an argument.**

### Sprint 4 step 2 (max-sentence ≤ 18) — **EXPLICITLY NOT BUILT**
**Why:** the gate already fails 10–24 of 24 first passes on `script_length_over_budget`, and step 1's hook check
had to be demoted for eating the attempt budget. Adding a second blocking length check on top would measure
nothing and would compound the convergence problem. **It is next in sequence and it is held** — see §6.

### Beats / latency — **shipped** (`c609910`)
Moves 1+2 as a pair. §15k liveness control moved from beat labels to an O(1) `copy_read` proof (first and last
sentence verbatim, checked in code against the copy's own first and last sentence). LIST 3 left the synchronous
call. Measured, same 7 fixtures × 3 runs either side: **output tokens 647 → 450 (−30%), mean latency
10,743 → 8,584 ms (−20%), max 23,596 → 15,027 ms (−36%), all 7 fixtures faster, 21/21 `checked`, 0 extraction
errors, `copy_read` verified 21/21.** The model's own `sentence_count` matched the code's on only **14/21**, so
that field is recorded and never gating — gating on it would have failed a third of honest reads.
Moves 3–5 (off-path beats, cheaper model, concurrency) are **out of scope and not done.**

---

## 3. STILL OPEN — stated as open

### 🔴 K9 · event-fact false positives — UNTESTED, NO FIXTURE
The number cross-check marks legitimate event lines ("Sunday", "two hours") ungrounded because date, format,
duration and session structure are not facts in `coachFacts`. **No fixture covers this and it was not measured
tonight.** It gates any F5 or F2 promotion to blocking independently of the pension line.

### 🔴 D-g · F5's enforcement tier — UNDECIDED
Still Arfeen's call. F5 is record-only. The pension ruling did **not** decide D-g.

### 🔴 Repetition — a finding, no gate, PROPOSAL ONLY AND NOT APPROVED
Measured read-only. The cascade context is **1,519 chars / 233 words and byte-identical for all 8 concepts**
(keyed on `userId`+`icpId` alone).

| set | 4-grams in 3+ scripts | also in the cascade context | share upstream |
|---|---|---|---|
| run 1 (8) | 40 | 14 | **35%** |
| run 2 (8) | 31 | 14 | **45%** |
| run 3 (6) | 23 | 10 | **43%** |

Of the 8 content words present in **all 8** scripts of run 1, **8 of 8 (100%)** are in the cascade context.

**~40% of cross-sibling repetition is handed to all 8 concepts in shared input. ~60% is not** — and that half
includes *"you have twelve years"*, *"twelve years of real"*, *"years of real expertise"*. **"twelve years" is
one of the fabricated biography details Thread B found in script 229, and it is NOT in the cascade context: the
model invents it and then converges on the same invention across siblings.** Repetition and the grounding gap
are the same defect seen twice.

🛑 **No 4-gram or overlap gate is built, and none is approved.** A gate would fight its own input for ~40% of
what it fires on (the K3 shape) and suppress a fabrication symptom for the other ~60%.

### 🟡 F2 false-positive drift — OBSERVED TWICE, NOT INVESTIGATED
F2 biography false positives went **0–1 → 2 per 42 runs** in both n=12 probes after the specific-state clause
landed. Small, consistent, unexplained. Not investigated.

### 🟡 Instrument caveats that must not be forgotten
- **The fragment detector does not reproduce the recorded calibration.** It reads the coach-voice nine at
  **max run 2** against the recorded **max 3**. Fragment figures are arm-vs-arm only and are **NOT** comparable
  to D-l. Do not build a fragment gate on them.
- **Kit 225's 4-gram count** reproduces at 26 (raw 29) against the recorded 23; the record does not enumerate
  which logistics-tail phrases were exempt. Overlap reproduces **exactly** (11/28 with the method name exempt).

### Carried forward, unchanged from 2026-09-16
Thread A parked (kit 187 has no working path; `llm.ts:428` 8,192 ceiling; reaper race) · D-d coach-ask screen ·
D-e promotion · D-m structural, behind Thread A · D-j word window still provisional (no timed reads exist) ·
`readLadderAnswers` string bug (`groundingCorpus.ts:80-84`), code-verified, live impact unverified, not fixed ·
bonus-34 and bonus-43 still live with count mismatches, no go-ahead.

---

## 4. 🔴 THE SCENES CRASH FIX — ON THE HELD BRANCH, **NOT DEPLOYED**

**`231e655`.** Found live by the sprint-0b run: **`scenes.forEach is not a function`, 2 of 24 arm-(a) cells**
(concepts 224 and 230, run 3). The model returned `scenes` as a non-array; `SCRIPT_JSON_SCHEMA` declares an
array but on the Anthropic tool-use path that is steering, not enforcement (§15i), and `script.scenes ?? []`
only guarded null/undefined.

**It cost the whole generation, not one bad draft:** the throw happened inside `gate()`, which sits OUTSIDE
`generateAttempt`'s `try`, so it escaped the attempt loop — **no retry, and `recordComplianceGate` skipped**, so
the block-rate telemetry never saw it. Same shape as sprint 0a's truncation finding.

Fixed with `Array.isArray(...) ? ... : []` at every gate-path site. A non-array now reads as no scenes →
`script_too_few_scenes` → an ordinary gate failure that **retries**. Regression test pins the failure mode
across object / object-with-scenes-key / JSON string / plain string / number / boolean plus the exact error
message; reverting the guard fails 6 of 15.

⚠️ **The literal payload was never captured** (the throw escaped before anything recorded it). The test pins the
failure mode and the message, not the bytes concepts 224/230 produced.

🔴 **This is live-relevant — production loses ~8% of generations to it today — and it is NOT deployed.
Pushing needs Arfeen's separate, explicit go-ahead.**

---

## 5. THE HELD BRANCH — what a push would deploy (tonight's commits only)

Oldest first, over `060e4d4` (the 2026-09-16 resume point).

| commit | what | type |
|---|---|---|
| `c609910` | O(1) `copy_read` §15k control replaces beat labels; `promptTransform` seam; 0b harnesses | **CODE** — changes checker latency, output and shape |
| `231e655` | the scenes non-array guard + regression test | **CODE — live-relevant, see §4** |
| `60a14bf` | the F5 probe takes `--clause` | harness |
| `23c563e` | LIST 2 specific-state clause | **CODE — changes live F5 verdicts** |
| `0288828` | hook: craft wording + `script_hook_too_long` | **CODE** |
| `0787b33` | scene-1 note kept, the wider rewrite reverted; `--arms` | **CODE** (prompt) |
| `60ec85f` | `financialAmbiguous`; hook check demoted to label-only | **CODE** |

`personal/dab-stills` (`2562e64`) is local only, on no ZAP branch, not on GitHub. **Never merge it.**

---

## 6. NEXT ACTION IF RESUMING COLD

1. **Verify ground truth** (§1).
2. **Sprint 4 step 2 — the max-sentence ≤ 18 check with a count-only retry. THIS IS NEXT, AND IT IS HELD.**
   - **Held on:** step 1's convergence. `script_hook_too_long` is label-only precisely because the attempt
     budget could not absorb it, and `script_length_over_budget` already fires on 10–24 of 24 first passes.
     **Adding a second blocking length check before that is resolved would measure nothing.**
   - **The resolution to reach first:** get first-pass `script_hook_too_long` low enough by STEERING that the
     label could be promoted without costing generations — then step 2 can be built and measured the same way.
   - **Shape when it is built:** deterministic max-sentence check, retry note carrying the COUNT only and never
     the sentence (the 2026-09-16 quoting ruling), label-only first, measured alone against the baseline.
   - **Do NOT reach for the per-scene "30–36 words" line.** Measured: the model reads it as a scene of ~32
     words across **2.60 sentences averaging 13.1 words** — under the cap. The mean is not the problem; the
     tail is (22–28% of sentences over 18, so every script has at least one).
3. Then, and only then, repetition — **and the upstream measurement in §3 comes before any gate proposal.**

**Open questions for Arfeen, carried:** D-g (F5 tier) · K9 (needs a fixture before anything promotes) · whether
to investigate the F2 FP drift · whether the scenes fix goes in the next deploy bundle.

---

## 7. GATE STATUS AT THIS CHECKPOINT — measured at write time

| gate | result |
|---|---|
| `npx tsc --noEmit \| grep -c "error TS"` | **34** — floor held, zero added all session |
| `server/pipeline-fixes.test.ts` | **414 passed** |
| `server/lib/complianceFilter.test.ts` | **31 passed** |
| `server/_core/tokenCrypto.test.ts` | **10 passed** |
| blast-radius suites | `conceptScriptValidator` **14** · `conceptScriptScenesGuard` **15** · `conceptScriptGenerator` **11** · `conceptScriptGeneratorDryRun` **7** · `complianceGate` **24** · `fabricationGateDefects` **15** · `groundingChecker` **60** · `coachFacts` **21** |
| **total across the 11 gated suites** | **623 passed, 0 failed** |
| mutation checks (all fail-on-mutate, i.e. the checks are load-bearing) | `copy_read.verified` always-true → **2 fail** · `promptTransform` ignored → **2 fail** · scenes guard reverted to `?? []` → **6 fail** · hook check neutered → **4 fail** · hook label promoted back to `hits` → **4 fail** |
| NUL-byte scan (sprint 8's lesson) | **clean** on every file touched this session |
| **production writes** | **ZERO.** 59-table row-count snapshot taken either side of the 48-generation 0b run: `diff` empty, 59/59 identical. Every generation ran through `dryRun`, which returns before the only insert. No DB writes in any later run |
| **push status** | **NOTHING PUSHED.** `origin/railway-build` = `87596d7`, `origin/main` = `67517e3`, `origin/docs/held-2026-09-12` = `6d88070` (42 behind local) |
| working tree | clean of tracked changes; 322 untracked (**never `git add .`**) |

---

## 8. WHAT A STRAY COMMAND DESTROYS

| command | loses |
|---|---|
| `git reset --hard origin/railway-build`, or a re-clone | **all 34 held commits: local only.** GitHub's held copy is `6d88070`, 42 behind. Includes sprints 0a/8/1/1b/2, the beats latency work, the scenes fix and tonight's F5 and hook work |
| `git clean -fd` | 322 untracked files |
| deleting `personal/dab-stills` and the backup ref | `2562e64`, the stills: local only |
| the session scratchpad ending | raw run JSON for all four generation runs, three F5 probes and the latency runs. **The durable record is this document** |

## 9. RECORDS INDEX

| topic | file |
|---|---|
| **this resume point** | `CHECKPOINT_2026-09-22_F5_HOOK_AND_SPRINT4.md` |
| superseded resume point | `CHECKPOINT_2026-09-16_SCRIPT_QUALITY_BUILD.md` |
| build plan (still live for sequence) | `BUILD_PLAN_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md` |
| sprint 4 source scoping (⚠️ its P1 hypothesis is corrected here) | `THREADB_FIX_SCOPING_2026-09-15.md` |
| sprint records | `SPRINT0A_SCRIPT_DRY_RUN_2026-09-16.md` · `SPRINT8_CHECKER_PRECISION_2026-09-16.md` · `SPRINT1_COACH_FACTS_2026-09-16.md` · `SPRINT2_GROUNDING_CHECKER_2026-09-16.md` · `SPRINT2_GROUNDING_CHECKER_EVAL_RUN1_2026-09-16.md` |
| benchmarks | coach voice: `docs/andromeda/worked-examples/final-shoot-2026-09-10/1-script-and-talent-brief.md` |
| harnesses built tonight (no production caller, §15d) | `server/scripts/lib-script-metrics.ts` · `lib-controls.ts` · `lib-arm-b.ts` · `sprint0b-two-arm.ts` · `sprint0b-report.ts` · `f5-subject-test-probe.ts` |
