# ZAP Handover — 2026-07-22

State-save checkpoint. **No new feature code in this step** — this commits the Phase-1 harness + docs;
Batch A's code changes are deliberately left in the working tree for the Phase-2 build batch.

## 🔴 WORKING MODEL SHIFT — the machine tests the machine (record prominently)

We have moved to a **self-verifying** model. **Arfeen no longer hand-verifies functional breakage.**
A Playwright harness (13 assertions) is the acceptance gate. CC builds every fix against that harness in an
**isolated local test DB**, iterating in its own terminal until the full run is green end-to-end, and
**surfaces to Arfeen ONLY when 13/13 pass**. Arfeen's role narrows to the **final design-gate pass** —
copy quality and reference fidelity — on an already-working campaign. CC does NOT surface mid-build except
for a genuine product/brand decision.

## Ground truth

- `HEAD = origin/railway-build = 3e67d33` at the start of this session.
- **Batch A (structured inputs + sentinel normalize) is BUILT BUT UNCOMMITTED** — five modified files in the
  working tree (`V2Trail.tsx`, `ChatThread.tsx`, `V2OperatorIntake.tsx`, `operatorFields.ts`,
  `operatorFields.test.ts`), never pushed. **This is exactly why deployed prod still renders free-text fact
  inputs.** Left in the working tree for the Phase-2 batch ("commit Batch A properly").
- **TS baseline is 38, not 35.** The prior "35" was measured against a stale `node_modules`; the committed
  `package-lock` pins `@types/node@24.12.0`, and two pre-existing `TS2802` iterator errors live on clean HEAD
  (`V2AdImageCreator.tsx:758`, `_core/index.ts:88`). **Batch A + the harness add ZERO new errors.**
- vitest ≥ 565 (Batch A took `operatorFields` 36 → 61).

## Routing truth (reconciled — the open item from the approval)

`resolveEventStyle` (`renderRegistry.ts:283`) renders Iman unless `classifyPrice(price).status === "value"`.
The `__FREE__` sentinel classifies as `"na"` → **Iman**. So free→Iman is **committed and correct for the
CHIP path** (tapping "It's free" writes `__FREE__`). It is **BROKEN for the TYPED path** — typing "free"
stores the literal string, which reads as a real price → **Hormozi**. Kit-184 rendered Hormozi for this
reason. Batch A's `normalizeOperatorAnswer` (typed "free" → `__FREE__`) + the chips-only price control close
it. **A5 is genuinely RED until Batch A ships** — not a misread.

## Harness (Phase 1 — complete, approved, COMMITTED in this checkpoint)

`@playwright/test` (dev-dep) + `playwright.config.ts` + `e2e/manual-wizard-free-event.spec.ts` (13 soft
assertions A1–A13) + `e2e/fixtures/free-event-material.ts` + `e2e/README.md`. Isolated: `tsconfig` excludes
`e2e/`, `vitest` globs `server/**` only — neither gate is perturbed. The 13 assertions:

| # | Asserts |
|---|---|
| A1 | facts DATE renders a real date-picker |
| A2 | facts VENUE renders Online/In-person chips + place field |
| A3 | facts PRICE renders Free/By-application chips |
| A4 | WhatsApp length reflects the date (≠ hardcoded 3) |
| A5 | published LP = Iman (free), not Hormozi |
| A6 | no "in in person" / non-place venue substitution |
| A7 | no fabricated cities the coach never entered |
| A8 | ad-copy node shows a visible selectable deck |
| A9 | ad-copy failure does not loop back to offer |
| A10 | LP not complete when publish fails (gated on publicUrl) |
| A11 | kit unresolved `[INSERT_*]` count = 0 |
| A12 | offer copy has no fabricated price/date |
| A13 | Flesch–Kincaid grade reported (bar TBD) |

## Clean-room environment (proven working, ZERO prod writes)

Throwaway local `mysqld` :3307 (`/tmp/zap-e2e-mysql`, db `zap_test`) → `drizzle-kit push` (52 tables) →
seeded a Pro coach (`users` id=1, openId `e2e-test-coach`) → `npm run dev` with **only the prod Anthropic
key** (local-random JWT; dummy Stripe/Resend/PII; Cloudflare/Cloudinary/AWS/Replicate omitted). Import-time
guards needing dummies: `customAuth` Resend, `stripe/client`, `piiCrypto`. `.env` is gitignored.

A real campaign was driven through via the MCP browser: `/api/test-login/:openId` → business intake →
"Live event" → "I'll pick as we go" → **ICP generated (real Anthropic call, in-process `setImmediate` job,
~2 min)** → skip testimonials → **facts step**, with **Batch A's native date picker confirmed in the DOM**
(`input[type=date]`). Generation works Anthropic-only (`invokeLLM → invokeClaudeAPI`, `json_schema` via
Anthropic tool-use). **A1 before/after control proven:** picker on the Batch-A tree, free-text on HEAD.

**Real intake flow (the harness driver must match — the first spec draft did NOT):** type business
description → chip "That's me" → chip "Live event" → chip "I'll pick as we go" → wait ICP job complete →
testimonial picker → "Skip — I don't have testimonials" → facts step → offer node…

**Operational realities:** ~2 min/node latency → a full 11-node run is ~20 min. Node groups:
FOUNDATION(Service, ICP, Offer, Method) → MAGNET(Lead Magnet, Headlines, Ad Copy) →
CONVERT(Landing Page, Email, WhatsApp) → CREATIVE(**Ad Images LAST**). Ad Images needs Replicate/Cloudinary
(omitted) → will be stubbed in dev; no assertion depends on it (A8/A9 are ad *copy*).

## In-flight (CC building — no Arfeen decision needed)

(a) Rewriting the harness intake driver to the REAL runtime flow (business-description-first, then fork).
(b) Stubbing the Ad Images node in dev.
(c) Capturing RED baseline + GREEN final from one harness pass (~20 min/full run) as a before/after control.

## Phase-2 build queue (all iterated against the harness to green)

1. Structured inputs — **commit Batch A properly** → A1–A3 green.
2. Sentinel normalize (typed "free" → `__FREE__`) → A5 green.
3. Date canonicalization → A4 green (WhatsApp length reflects the date).
4. Venue place-name enforcement → A6 green (no "in in person").
5. Ad-copy deck display fix → A8 green; confirm A9 stays green.
6. LP completion gated on `publicUrl` → A10 green.
7. Offer facts-wire + no-invention price/date lock → A12 green.
8. Way 2 per-node scan-ask + retire end-of-flow backfill → A11 green (placeholder count 0).
9. Fabricated-city fix → A7 green.
10. FAQ scaffolding strip + markdown-safety (the `**What they say:/What they mean:**` + raw `**` leak).
11. Readability constraint — report A13's Flesch–Kincaid; propose a grade bar for Arfeen to set.

Gates: TS ≤ 38 (no new errors); vitest ≥ 565; all 13 Playwright assertions PASS.

## Resume point

CC is **dark, building all fixes against the harness in the clean room**. Next surface = the full green
**13/13 table (before/after)**, OR a genuine product/brand blocker. Then Arfeen does the design-gate pass
(copy quality, reference fidelity) on a working campaign.

**Deferred (tracked, not now):** off-ICP testimonial ICP-filtering — a product call, leave as-is.

Prior: `docs/handovers/ZAP_Handover_July21_2026.md`.
