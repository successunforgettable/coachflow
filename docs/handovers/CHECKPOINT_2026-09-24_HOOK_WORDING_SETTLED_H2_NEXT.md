> 🗄️ **SUPERSEDED 2026-09-24 (late) — NOT THE ENTRY POINT.** Resume from `CHECKPOINT_2026-09-24_TRIAL_QUOTA_GHL_DEPLOY_PLAN.md`.

# 🗄️ RESUME POINT (SUPERSEDED) — 2026-09-24: hook wording settled, a same-day baseline, H2 next

**Supersedes `CHECKPOINT_2026-09-22_F5_HOOK_AND_SPRINT4.md`**, which is retained and marked superseded.
Written so a cold terminal resumes from exactly this point.

**Every figure below was measured at write time (§15f)**: git via `git rev-parse` / `git ls-remote`, Railway via
`railway deployment list`, the production DB via read-only 59-table snapshots (count, max id, max `updatedAt`,
`CHECKSUM TABLE`), and every quality number from raw run JSON committed under `docs/handovers/runs/`.

Full measurement record: **`docs/handovers/HOOK_BASELINE_MEASUREMENT_2026-09-24.md`** (§1–§6).

---

## 0. THE THIRTY-SECOND VERSION

| | |
|---|---|
| **production code** | **`87596d7`**, Railway `SUCCESS`, deployed 2026-09-14 21:11:33 UTC. GitHub `railway-build` = `87596d7`. **Untouched all session — nothing pushed or merged to it** |
| **held branch** | `docs/held-2026-09-12` = **`a36f68f`**, **39 commits over production**, clean fast-forward. **GitHub backup = `a36f68f`, identical to local** at the time of writing. (This checkpoint's own commit sits on top; see §8) |
| **scenes fix** | `fix/scenes-array-guard` = **`94ae237`**, 1 commit over `87596d7`, on GitHub. **NOT merged, NOT deployed** |
| **production DB** | **Zero writes.** Four 59-table snapshot pairs this session, every `diff` empty |
| **settled tonight** | H0 (scene-1 note reverted — the only wording change that cost length) · H1 ("carries on" phrase removed — does nothing on its own) · same-day control (**wording is not the lever**; the recorded 10/24 is stale) |
| **next action** | **H2 — the hook as its own output field. NOT designed, NOT started.** See §5 |

🔴 **PUSHING `railway-build` IS THE DEPLOY.**

---

## 1. VERIFY GROUND TRUTH FIRST — measure, never read from this file (§15f)

```bash
git fetch origin && git rev-parse --short HEAD origin/railway-build origin/docs/held-2026-09-12 origin/fix/scenes-array-guard
#   expect: <checkpoint commit on top of a36f68f> · 87596d7 · a36f68f (or the checkpoint commit if pushed) · 94ae237
git ls-remote origin refs/heads/railway-build              # expect 87596d7
git rev-list --count origin/railway-build..HEAD            # expect 39 (40 counting this checkpoint's commit)
git merge-base --is-ancestor origin/railway-build HEAD && echo ff-ok
git rev-list --left-right --count 87596d7...origin/fix/scenes-array-guard   # expect 0 1
git status --porcelain --untracked-files=no                # expect nothing
npx tsc --noEmit 2>&1 | grep -c "error TS"                 # expect 34
```

---

## 2. SETTLED 2026-09-24

### 2a. The measurement script was blind — FIXED, KEEP USING IT (`ae175bc`)
`sprint0b-two-arm.ts` read only the **blocking** `labels` of a **failed** first pass. Since `60ec85f` made
`script_hook_too_long` label-only it lives in `axes.observedLabels`, so the harness would have reported the hook
rate as **0/24 whatever the model did** (§15k).

- `server/scripts/lib-gate-summary.ts` — `summariseGate()` reads observed labels on **every** attempt, the first
  attempt's hook word count, and flags any label/count disagreement as a broken instrument.
- `ScriptGateAxes.hookWords` (observation only, `conceptScriptGenerator.ts`) is counted by `hookWordCount()` in
  `conceptScriptValidator.ts` — **the same helper the hook check uses**, so the measurement cannot drift from the check.
- `server/gateSummary.test.ts` (7): a 17-word hook on a **passing** draft is caught with its count; the old
  extraction is pinned returning `[]` for it. Mutation: pointing the summariser back at blocking-only labels fails 2/7.
- Live liveness: across 96 cells in four runs, every first pass reported a count except one that returned no scenes;
  **0 label/count mismatches**.
- **Every future hook or length measurement uses this harness.** Run: `docs/handovers/runs/*/` shows the layout;
  analysis script shape is in §7 below.

### 2b. H0 — the scene-1 note reverted (`a717818`)
`conceptScriptGenerator.ts:105` restored byte-identical to `0288828^`: *"Scene 1 is the HOOK, written in the … style,
opening on the leading desire above."* **The only wording change measured to cost length**: with it in, first-pass
over-budget was 22/24 and production 13/24.

### 2c. H1 — "carries on in its own sentences" removed (`d076ecb`)
Removed from `HOOK_RULE` (`scriptPromptCraft.ts`) and from the structure retry line (`conceptScriptValidator.ts`).
**Does nothing on its own**: first-pass hook 16 → 16/24, over-budget 17 → 17/24.

Provenance, for the record: the HOOK_RULE phrase was deliberate in variant A (`0288828`) — to stop "the hook" being
read as the whole scene. The retry-line phrase was deliberate when the hook check blocked and became a leftover when
`60ec85f` demoted the check without revisiting it.

### 2d. The same-day control — WORDING IS NOT THE LEVER (`a36f68f`)
The untouched pre-hook prompt (`scriptPromptCraft.ts` whole + the retry line restored to `0288828^`, byte-verified;
the generator prompt already identical after H0) on today's model:

| 24 cells each, arm (a), dryRun | kept note (`ae175bc`) | H0 | H1 (= HEAD) | **control, pre-hook** |
|---|---|---|---|---|
| produced within 3 attempts | 13/24 | 17/24 | 19/24 | **22/24** |
| first-pass gate PASS | 2/24 | 5/24 | 7/24 | **7/24** |
| first-pass `hook_too_long` | 12/24 | 16/24 | 16/24 | **17/24** |
| first-pass hook mean · max (words) | 13.2 · 29 | 19.3 · 41 | 16.6 · 40 | **19.2 · 36** |
| first-pass `over_budget` | 22/24 | 17/24 | 17/24 | **17/24** |

🔴 **THE RECORDED PRE-HOOK "10/24 OVER-BUDGET" (2026-09-21/22) IS STALE. DO NOT USE IT AS A BASELINE.** The same
prompt overruns 17/24 today (two-sided p ≈ 0.08 against 10/24 — the model shifted, or 10/24 was a low draw; one
control cannot tell which). **The current baseline is this control run: 22/24 produced, 7/24 first-pass PASS,
17/24 first-pass hook_too_long, 17/24 first-pass over-budget.** Every over-budget comparison made against 10/24 in
earlier documents (including the 2026-09-22 checkpoint's variant table) must be re-read against 17/24.

**What that settles:**
1. The remaining hook wording (HEAD) does nothing to the first-pass hook: 16/24 vs the control's 17/24.
2. On length, HEAD equals the control (17 = 17). The scene-1 note was the one measured length cost, and it is gone.
3. **Across seven measured prompt states, every one that shortened the hook (B, C, kept note) overran on length
   (22–24/24), and every one with baseline length left the hook long in two-thirds of first drafts or more.** Prompt
   wording has not found a state that does both.

🟡 **Watch, not established:** production within 3 attempts, HEAD 19/24 vs control 22/24. Inside noise at n = 24. The
direction fits the retry line still instructing *"the opening SENTENCE of scene 1 is 10 words or fewer"* on every
over-budget retry, for a check that no longer blocks. Not measured on its own.

---

## 3. THE SCENES CRASH FIX — ITS OWN BRANCH, READY, NOT DEPLOYED

**`fix/scenes-array-guard` = `94ae237`**, a clean cherry-pick of `231e655` onto `87596d7` (no conflicts), on GitHub.

- **Scope:** exactly 3 files — `server/_core/conceptScriptValidator.ts`, `server/conceptScriptGenerator.ts`, the new
  `server/conceptScriptScenesGuard.test.ts`. **None of the F5, hook, checker or harness changes.**
- **The bug is live in production:** `87596d7` calls `gate(script)` bare at `conceptScriptGenerator.ts:275` and `:283`,
  outside any `try` — a non-array `scenes` throws `scenes.forEach is not a function`, skips every retry and
  `recordComplianceGate`. Measured ~8% of generations in sprint 0b (2 of 24).
- **Tests on the branch:** tsc 34 · scenesGuard 15/15 · pipeline-fixes 414 · complianceFilter 31 · tokenCrypto 10 ·
  validator 8 · generator 11 · complianceGate 24 · fabricationGateDefects 15. (dryRun, groundingChecker, coachFacts
  do not exist on production.)
- **Negative control:** production's two source files restored → the regression test fails **14/15** with the real
  `scenes.forEach is not a function`; fix restored → 15/15.
- **Seen working live on the held branch:** H0's run had one first pass return no scenes; it read as
  `script_too_few_scenes`, retried and produced.
- 🔴 **Deploying it needs Arfeen's explicit go-ahead.** It can ship **independently of the held branch** whenever he
  decides: merging it into `railway-build` is a one-commit fast-forward. The held branch will need it merged or
  rebased back in afterwards (same change, so no content conflict is expected — verify at the time).

---

## 4. STILL OPEN — restated so nothing is lost

### 🔴 K9 · event-fact false positives — UNTESTED, NO FIXTURE
The number cross-check marks legitimate event lines ("Sunday", "two hours") ungrounded because date, format,
duration and session structure are not facts in `coachFacts`. **No fixture, not measured.** It gates any F5 or F2
promotion to blocking independently of the pension line.

### 🔴 D-g · F5's enforcement tier — UNDECIDED, Arfeen's call
F5 is record-only. The pension ruling (`financialAmbiguous`) did not decide D-g.

### 🟡 F2 false-positive drift — OBSERVED TWICE, NOT INVESTIGATED
Biography FPs went 0–1 → 2 per 42 runs in both n=12 probes after the specific-state clause (`23c563e`) landed.

### 🟡 Sprint 4 step 2 (max-sentence ≤ 18) — HELD, behind H2
Still held on the hook converging. Its shape when built is unchanged from the 2026-09-22 checkpoint §6: deterministic
check, count-only retry note, label-only first, measured alone **against the 2026-09-24 control baseline**.

### 🔴 Repetition — finding only, no gate approved
~40% of cross-sibling 4-gram repetition is upstream (a byte-identical 1,519-char cascade context for all 8 concepts);
~60% is not, and includes the fabricated "twelve years". No gate built or approved.

### Carried forward, unchanged
Thread A parked (kit 187; `llm.ts:428` 8,192 ceiling; reaper race) · D-d coach-ask screen · D-e promotion · D-m ·
D-j word window provisional · `readLadderAnswers` string bug (`groundingCorpus.ts:80-84`) not fixed · bonus-34 and
bonus-43 count mismatches, no go-ahead · fragment detector not calibrated to D-l.

---

## 5. NEXT ACTION ON COLD RESUME

1. **Verify ground truth** (§1).
2. **H2 — make the hook its own output field.** **Not designed, not started. Investigate and propose before any code.**
   - Premise: the hook is a separate 10-word unit in the model's output, joined onto scene 1 in code before
     anything is stored, so the stored shape is unchanged. The model no longer has to count words inside a longer line.
   - Judge it against the **2026-09-24 control** (22/24 · 7/24 · 17/24 · 17/24), never the stale 10/24.
   - One change, one 24-cell measurement, dryRun, 59-table snapshot either side — same method as tonight.
   - Things the proposal must answer: how the schema field is enforced given tool-use `required` is steering not
     enforcement (§15i); what happens when the field is missing or not a string (§15j); whether the existing
     `script_hook_too_long` check reads the new field or the joined scene; what the retry line says about the hook.
3. Then Sprint 4 step 2, then repetition (upstream measurement before any gate proposal).

**Open decisions for Arfeen:** the scenes-fix deploy (§3) · D-g · K9 fixture · whether to investigate F2 drift.

---

## 6. WHAT A PUSH OF THE HELD BRANCH WOULD DEPLOY — commits since the 2026-09-22 checkpoint

| commit | what | type |
|---|---|---|
| `ae175bc` | harness reads `observedLabels`; `hookWords` observation; `hookWordCount` shared helper; record + run evidence | **CODE** (observation only) + docs |
| `a717818` | H0 — scene-1 note reverted | **CODE** (prompt) |
| `d076ecb` | H1 — "carries on" phrase removed from HOOK_RULE and the retry line | **CODE** (prompt) |
| `a36f68f` | same-day control record | docs |

Plus everything listed in the 2026-09-22 checkpoint §5 (F5 clause, `financialAmbiguous`, beats/latency, scenes fix,
label-only hook check). `personal/dab-stills` (`2562e64`) is local only — **never merge it.**

---

## 7. GATE STATUS AT THIS CHECKPOINT — measured at write time

| gate | result |
|---|---|
| `npx tsc --noEmit \| grep -c "error TS"` | **34** — floor held, zero added all session |
| `server/pipeline-fixes.test.ts` | **414** |
| `server/lib/complianceFilter.test.ts` | **31** |
| `server/_core/tokenCrypto.test.ts` | **10** |
| blast-radius | `conceptScriptValidator` **14** · `conceptScriptScenesGuard` **15** · `conceptScriptGenerator` **11** · `conceptScriptGeneratorDryRun` **7** · `complianceGate` **24** · `fabricationGateDefects` **15** · `groundingChecker` **60** · `coachFacts` **21** · **`gateSummary` 7 (new)** |
| **total, 12 gated suites** | **629 passed, 0 failed.** (The 2026-09-22 checkpoint's "623 across 11" was an addition error: its own per-suite figures sum to 622, which is what was re-measured today) |
| mutation checks this session | summariser → blocking-only labels: **2/7 fail** · scenes fix on its own branch, production files restored: **14/15 fail** |
| NUL-byte scan | **clean** — 27 files changed this session; negative control (a file with a NUL) detected |
| **production writes** | **ZERO.** Four 59-table snapshot pairs, every `diff` empty: baseline 19:44:22→19:51:44Z · H0 19:56:45→20:03:29Z · H1 20:04:36→20:10:52Z · control 21:24:51→21:31:01Z UTC (2026-09-23 UTC = 2026-09-24 IST). Every generation ran through `dryRun` |
| **merges / pushes to `railway-build`** | **NONE.** `railway-build` = `87596d7` on GitHub and Railway |
| pushes this session (all authorised) | `docs/held-2026-09-12`: `6d88070→824ce53→ae175bc→d076ecb→a36f68f` · `fix/scenes-array-guard` created at `94ae237` |
| model spend | ≈ 4 runs × 24 cells, ~1.5–2.6 generation attempts each plus one grounding-checker call per produced script |
| working tree | clean of tracked changes; 322 untracked (**never `git add .`**) |

**Analysis method** (the script used lives only in the session scratchpad; its logic, to rebuild it): load
`sprint0b-raw.json`, and per cell read `summary` (from `lib-gate-summary`): `firstPassHookTooLong`,
`firstPassHookWords`, `firstPassBlockingLabels` (over-budget = contains `script_length_over_budget`),
`hookInstrumentMismatch`; `ok` = produced; `firstPassOk` = first-pass PASS. Run it with
`railway run --environment production --service coachflow npx tsx server/scripts/sprint0b-two-arm.ts --user 1 --runs 3 --arms a --out DIR`,
with a `dbsnap2.py` snapshot (source: `REGEN_RUNBOOK_2026-09-11.md` §2) immediately before and after.

---

## 8. WHAT A STRAY COMMAND DESTROYS

| command | loses |
|---|---|
| `git reset --hard origin/railway-build`, or a re-clone | the checkpoint commit, if not yet pushed. Everything up to `a36f68f` is on GitHub |
| `git clean -fd` | 322 untracked files |
| deleting `personal/dab-stills` and the backup ref | `2562e64`, the stills — local only |
| the session scratchpad ending | nothing durable — all four runs' raw JSON, diffs and snapshots are committed under `docs/handovers/runs/` |

## 9. RECORDS INDEX

| topic | file |
|---|---|
| **this resume point** | `CHECKPOINT_2026-09-24_HOOK_WORDING_SETTLED_H2_NEXT.md` |
| tonight's measurements, in full | `HOOK_BASELINE_MEASUREMENT_2026-09-24.md` |
| run evidence | `runs/hook-baseline-2026-09-24/` · `runs/hook-h0-2026-09-24/` · `runs/hook-h1-2026-09-24/` · `runs/hook-ctrl-prehook-2026-09-24/` |
| superseded resume point | `CHECKPOINT_2026-09-22_F5_HOOK_AND_SPRINT4.md` |
| build plan (sequence) | `BUILD_PLAN_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md` |
| snapshot tool | `REGEN_RUNBOOK_2026-09-11.md` §2 (`dbsnap2.py`) |
