# Hook baseline measurement — 2026-09-24 (the kept prompt, first time measured whole)

Evidence: `docs/handovers/runs/hook-baseline-2026-09-24/` (raw JSON, per-cell log, before/after DB snapshots).
Measured at run time (§15f). Branch `docs/held-2026-09-12` at `824ce53` + the harness fix in this commit.

## 1. The instrument was blind, and is fixed

`sprint0b-two-arm.ts` read only the BLOCKING `labels` of a FAILED first pass. Since `60ec85f` made
`script_hook_too_long` label-only, it lives in `axes.observedLabels` — so the harness would have reported the hook
rate as **0/24 whatever the model did** (§15k).

- `lib-gate-summary.ts` reads observed labels on every attempt plus the first attempt's hook word count.
- `ScriptGateAxes.hookWords` (observation only) is counted by `hookWordCount`, the same helper the hook check uses.
- `gateSummary.test.ts` (7): a known 17-word hook on a PASSING draft is caught with its count, and the old extraction
  is shown returning `[]` for it; a count/label disagreement is flagged as a broken instrument.
- Mutation: pointing the summariser back at blocking-only labels fails **2 of 7**.
- Live liveness check: 24/24 cells reported a non-null first-pass hook count; **0 label/count mismatches**.

## 2. Result — arm (a), 8 concepts × 3 runs, dryRun

| | baseline (pre-hook) | A craft wording | **now (A + scene-1 note)** | B | C |
|---|---|---|---|---|---|
| produced within 3 attempts | 22/24 | 11/24* | **13/24** | 5/24* | 5/24* |
| first-pass gate PASS | 11/24 | — | **2/24** | — | — |
| first-pass `hook_too_long` | 0/24† | 19/24 | **12/24** | 1/24 | 4/24 |
| first-pass hook ≤ 10 | — | — | **12/24**, mean 13.2, median 10.5, max 29 | — | — |
| first-pass `over_budget` | 10/24 | 14/24 | **22/24** | 23/24 | 24/24 |

\* hook check was BLOCKING in A/B/C, so their produced figures are not comparable to now (label-only).
† the check did not exist; baseline hooks measured on final text: 4/22 ≤ 10, mean 21.0.

Failed cells (11): every one failed on `script_length_over_budget` at its last attempt (10 alone, 1 with
`unearned_authority`). All-attempt blocking labels: over_budget 46, unearned_authority 3.

Zero writes: 59-table snapshot (count, max id, max updatedAt, CHECKSUM) before 19:44:22Z and after 19:51:44Z UTC,
`diff` empty.

## 3. What it means

1. **The hook rate is 12/24 first pass — not the 1–4/24 the 2026-09-22 checkpoint credited to the kept note.** That
   figure came from B and C, which carried the clause later reverted.
2. **The kept scene-1 note is the one prompt difference between A (14/24 over-budget) and now (22/24)**; one-sided
   Fisher p ≈ 0.009. Every run carrying that line (B 23, C 24, now 22) overran; the two without it (baseline 10,
   A 14) did not. `0787b33` attributed the blow-up to "carries on … to fill its word range" — that separation was
   never measured, and this run contradicts it. It buys a shorter hook (19 → 12/24, p ≈ 0.03) at a large length cost.
3. **The held branch now produces 13/24 scripts against production's recorded 22/24.** Deploying it as-is would cost
   live generations. The scenes fix is isolated on `fix/scenes-array-guard` and carries none of this.
4. Caveat: baseline and A were measured on a different day (2026-09-21/22); model drift is not excluded.

## 4. "carries on in its own sentences" — provenance

- **HOOK RULE / SCRIPT_STRUCTURE_CRAFT: deliberate** in A (`0288828`): "say plainly that scene 1 carries on after it",
  to stop "the hook" being read as the whole scene.
- **Retry line (`conceptScriptValidator.ts` structure failContext): deliberate when written, a leftover now.** It was
  written while the hook check blocked; `60ec85f` demoted the check and did not revisit it, so every over-budget
  retry still instructs on a hook that no longer blocks.
- A's 10 → 14/24 over-budget is **not significant** (p ≈ 0.19) and A changed several lines at once, so it does not
  show that this phrase does damage on its own. The measured damage sits with the scene-1 note (§3.2).

---

## 5. H0 and H1 — measured 2026-09-24, one change each, same 24 cells, zero writes

Evidence: `runs/hook-h0-2026-09-24/`, `runs/hook-h1-2026-09-24/` (each: raw JSON, the exact worktree diff the run
used, before/after 59-table snapshots — both diffs empty).

- **H0** — scene-1 note at `conceptScriptGenerator.ts:105` reverted to the pre-hook wording, byte-identical to `0288828^`.
- **H1** — H0 plus: "Scene 1 carries on after it in its own sentences" removed from HOOK_RULE, and ", with the rest of
  scene 1 carrying on in its own sentences after it" removed from the structure retry line.

| | kept note (ae175bc) | **H0** | **H1** |
|---|---|---|---|
| produced within 3 attempts | 13/24 | **17/24** | **19/24** |
| first-pass gate PASS | 2/24 | 5/24 | **7/24** |
| first-pass `hook_too_long` | 12/24 | **16/24** | **16/24** |
| first-pass hook ≤ 10 · mean · max | 12/24 · 13.2 · 29 | 7/23 · 19.3 · 41 | 8/24 · 16.6 · 40 |
| first-pass `over_budget` | 22/24 | **17/24** | **17/24** |
| failed cells' last-attempt label | over_budget 10, authority 1 | over_budget 7 | over_budget 4, authority 1 |

H0's one null hook count is a first pass that returned no scenes: `script_too_few_scenes`, retried and produced —
the scenes guard doing its job.

**Reading, with n = 24 per arm (a 5-cell gap is p ≈ 0.07 — suggestive, not proof):**
1. **H0 prediction partly confirmed.** Hook drifted back toward 19 as predicted (12 → 16/24). Over-budget fell
   (22 → 17/24) but not to the predicted ~14.
2. **H1 moved neither first-pass metric** (hook 16 → 16, over-budget 17 → 17). The "carries on" phrase is not doing
   measurable damage on its own; production within 3 attempts rose 17 → 19/24, inside noise.
3. **Over-budget 17/24 is still well above the recorded pre-hook 10/24.** What remains between H1 and the pre-hook
   prompt is the "FIRST SENTENCE … 10 words or fewer" wording in HOOK_RULE, SCRIPT_STRUCTURE_CRAFT and the retry
   line — or day-to-day drift. The 10/24 was measured 2026-09-21/22 and has not been re-measured (§15f).
4. **Wording alone has not got the hook near zero.** Across six measured prompt states, every state with a short
   first-pass hook (B 1, C 4, kept note 12) overran on length (23, 24, 22/24); every state with tolerable length
   (baseline, H0, H1) left the hook long in two-thirds of drafts or more.
