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
