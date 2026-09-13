# ITEM 15 — read-only capture, 2026-09-14: bonus-35, one run of the attempt loop (budget 3). Nothing written.

Purpose (Arfeen): confirm whether pass 6 attempt 3's `in a second@nextStep.body` rejection was a genuine timed-outcome
claim or the "in a second tab" misread. Baseline 21:25:15 UTC → capture → report written → after-snapshot:
**539 compared · 0 changed.** No publisher imported; the loop returned no body (none passed).

**Strict:** 3/3 `strict: true`, HTTP 200, 0 `[LLM][strict]` fallbacks.

## 🔴 The question could not be answered from this capture

**None of the three attempts contains "in a second" anywhere** (every string field walked). Output is not deterministic,
and pass 6's failed body was never persisted — its sentence is unrecoverable. What IS known structurally: the pattern
matches only the literal words `in a second`; it sat in `nextStep.body`; it was not exempted as action timing, so its
clause did not open with an instruction verb. Whether it was "in a second tab/pass/session" (a misread) or a genuine
"back on the page in a second" cannot be settled from evidence.

## What the capture did show — every flagged sentence, verbatim

| attempt | out tok | floor | count (17) | flagged sentence | read |
|---|---|---|---|---|---|
| 1 | 1,111 | ✗ tools 184/399/387 c | ✗ 0 scripts | promise: *"You'll move from frozen to typing **in under three minutes**, using only your own voice."* | **genuine** outcome |
| 1 | | | | tools.2.name: *"The Stuck-Moment SOP (From Frozen to First Draft **in 12 Minutes**)"* | **genuine** outcome |
| 1 | | | | tools.2.content: *"**Trigger:** You have opened a document to write copy … and **after 90 seconds** you have typed nothing, or you have deleted everything you've typed."* | **misread** — a trigger condition describing the reader's situation |
| 2 | 489 | ✗ 1 tool | ✗ 0 scripts | — | degenerate |
| 3 | 2,792 | ✓ | ✓ **17** | promise: *"…so you can move from stuck to moving **in under two minutes** at any point in your copy process."* | **genuine** outcome |
| 3 | | | | tools.1.content (quoted script): *"…Nothing I write **in the next twenty minutes** is going public. I'm just thinking out loud in a document."* | **misread** — scene-setting speech; caught by the pass-1 quoted-speech narrowing (a quantified clock in a quote is flagged unless it schedules an event) — the residual noted then |

Attempt 3 met its count and its floor and was refused on two hits: one genuine, one misread. It would have been refused
on the genuine one alone.

## Files

`35-attemptN-raw.json` (full response) · `35-attemptN-bounded-body.json` (the exact body the gates judged, after
`repairArrayField` + `applyBodyBounds`) · `capture-report.json` (per-attempt gates, every timed hit with its full line,
strict proof, feedback sent).
