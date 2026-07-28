# ZAP Handover — 2026-07-21

State-save checkpoint. **No new feature code this session beyond the Phase 1 build (already committed).**
The bulk of the session was a live-run diagnosis + settling the fix batch and the Phase 2 design.

## Ground truth (actuals, verified)
- `HEAD = origin/railway-build = ccc250053c39a28fce7edd89d07834a2f0d9d014`
- branch `railway-build`; tracked tree clean (only untracked scratch: `trailstate-response.json`).
- Gates: **TS 35** · **vitest 565** (established 558 + 7 new `orchestrationFacts` helper tests).
- Migrations 0084–0090 applied on prod; **0090 (`campaignKits.campaignFacts` JSON) applied + verified** via
  INFORMATION_SCHEMA (json, nullable, default null; 40 rows unaffected). 0081 superseded.

## What shipped this session — Phase 1 (facts upfront), PARTIAL (commit `ccc2500`)
- **Migration 0090:** `campaignKits.campaignFacts` JSON (eventSchedule + price sub-shape of LandingPageContent).
- **Kit-level tRPC:** `getCampaignFactsReadiness` / `answerCampaignFact` — reuse deriveOperatorQuestions /
  applyOperatorAnswer / expandOperatorAnswer, target `campaignFacts` (+ booking → users column).
- **Upfront facts step in `runManualLoop`** (before the AUTO_STEPS loop): Zappy-led, one at a time, N/A
  chips, skippable, fresh-build only; new `factsMode` routes text/chips to a fact-answer resolver.
  **`runAutoLoop` UNTOUCHED.**
- **orchestration reads:** email/whatsapp populate `eventDetails` from campaignFacts; whatsapp
  `sequenceLength = deriveLengthFromDate(date)`; landingPage applies facts via `applyOperatorAnswer` AFTER
  generation, BEFORE auto-publish. `deriveLengthFromDate` + `factsToTokenAnswers` helpers (unit-tested).
- **🔴 A live wizard run proved Phase 1 is only PARTIALLY working — see the diagnosis below.**

## Live-run diagnosis — trail 184 / kit 184 / page campaign-220 (in-person FREE event)
All confirmed from real DB rows / Railway logs / served bytes. No code changed.
- **Facts-schema gap = root of the placeholder pile.** Upfront step asks only date/venue/price
  (`PAGETYPE_REQUIRED_TOKENS.event_registration`); generators bake MORE — time, timezone,
  `[INSERT_EVENT_AGENDA]`, and a rogue **`[INSERT_COACH_CREDENTIAL]` not in the registry**. Because facts
  are asked BEFORE generation, the step can't see what will be baked → LP publish failed on
  `[INSERT_COACH_CREDENTIAL] + [INSERT_EVENT_AGENDA]` (Railway log) → publicUrl null → end-of-flow backfill.
- **Wrong-template routing (right family, wrong variant).** `campaignFacts.price = "free"` (literal string,
  NOT the `__FREE__` sentinel — coach typed it) → `classifyPrice` reads it as a real price →
  `resolveEventStyle` → **`event_hormozi`** (paid) instead of **`event_iman_gadzhi`** (free). Served bytes
  confirm Hormozi (40× Hormozi purple, 60× Poppins, 0 Iman gold/Montserrat). Design intact; wrong
  reference, correctly rendered.
- **LP node marks complete on a swallowed publish failure.** `orchestration.ts` `landingPage` case wraps
  `runLandingPagePublish` in a non-fatal try/catch (log: "Cascade continues; user can re-publish"),
  completion gated on `generatedId` (`:427`) not `publicUrl` → 11/11 on an UNPUBLISHED page.
- **WhatsApp stayed 3.** `deriveLengthFromDate("28th august 2026")` → `Date.parse` = NaN (the ordinal
  "th") → fallback 3. (`selectedWhatsAppSequenceId=276`, `JSON_LENGTH(messages)=3`.)
- **Offer generator.** Doesn't read `campaignFacts` + lacks a price/date no-invention lock → first pass
  fabricated "£3,200 / 6-month / June" (overwritten by a regen — the offer ran twice; current persisted
  offer 199 is correctly TOKENIZED, no fabrication in the data).
- **Ad Copy "didn't come through" = display bug only.** `selectedAdCopyId=5334` is a real, compliant
  (score 100), on-topic ad; adCopy job completed. `fetchDeckCards` returned 0 cards (deck didn't render);
  the server auto-selected. NOT a generation failure.
- **FAQ scaffolding leak.** The `whoFor`/ICP generator emitted objection scaffolding
  (`**What they say:** "…" **What they mean:** …`, literal markdown `**`) into published copy; the Hormozi
  `whoForBody` ("Is this right for my business?") renders it verbatim (esc keeps the `**`).
- **Off-ICP testimonials.** Working as designed: `realTestimonials` injects the coach LIBRARY coach-wide
  (not ICP-filtered). User 1 (Arfeen) library is generic test/seed data ("Sarah Chen/TechStart", "Priya
  K./University Student") → looks wrong on an ex-offender page. On a real coach it's their real proof.

## SETTLED FIX BATCH — approved, NOT yet built (the build queue)
1. **Placeholder pile → Way 2** (per-node scan-and-ask via `deriveOperatorQuestions`, folded into Phase 2
   forward-only review). Keep ONLY date/price/venue upfront (routing-critical); retire the end-of-flow
   backfill; **register `[INSERT_COACH_CREDENTIAL]`** in the registry. (Way 1 generator-constraint =
   secondary hardening, not primary.)
2. **Wrong-template routing:** normalize typed N/A → sentinels at STORAGE (`__FREE__` / `__ONLINE__` /
   `__BY_APPLICATION__`) in `answerCampaignFact` / `applyOperatorAnswer`.
3. **Structured inputs:** `inputType` per token in the registry; date PICKER (kills Date.parse-NaN → fixes
   WhatsApp length), venue (Online chip / In-person → real place-name → fixes "in in person"), price chips
   (Free/By-application/number). Subsumes #2's typed path.
4. **LP completion gated on `landingPages.publicUrl`;** failed publish → explicit NON-complete state
   (`review_draft`/`needs_publish` in nodeStatuses); the swallowed catch records the failure instead of
   silently continuing.
5. **Offer generator:** wire `campaignFacts` (apply facts after `runOfferGeneration` in the `offer` case,
   `orchestration.ts:~280`, same pattern as the LP) + add the price/date no-invention lock in
   `offersGenerator.ts`.
6. **FAQ scaffolding strip + markdown-safety pass** (approved — raw scaffolding can't ship). Strip at the
   `whoFor`/ICP source + a markdown-safety pass in the template.
- **Tracked separately (deferred):** off-ICP testimonial ICP-filtering — a PRODUCT call, leave as-is.

## SETTLED PHASE 2 DESIGN (existing-assets + per-node review)
- **Forward-only wizard:** approve advances + locks; regenerate acts only on the current not-yet-approved
  node; NO jump-back → the **stale / re-crown / `markTweakStale` / dismiss machinery RETIRES** (dead weight
  under forward-only) — done in Phase 2, same code as the review surface.
- **Offer / Method / Lead-Magnet are ALL load-bearing** — every downstream node lists them in `UPSTREAM`
  (`cascadeContext.ts`); a NULL selection throws `PRECONDITION_FAILED` (hard fail, enforced by adCopy /
  adCreatives / email / headlines / landingPage / whatsapp). So **import-or-generate, NO skip.** The
  current "Skip — I already have this" is a silent bypass that BREAKS the cascade → convert to real capture.
- **One engine, two doors:** `extractFromAssets` → `importAssets` (already creates the row AND selects it
  via `autoSelectBest`, per-asset, each optional) → `markImported`. Door 1 (upfront `has_assets` fork) is
  wired. Door 2 (per-node "I already have this") = a second caller: paste → extract → import that one
  category → becomes the node's selection. **Creative nodes (Headlines / Ad Copy / Landing Page) drop the
  chip** (no import path exists) → generate → approve/regenerate.
- **Review surface built source-aware ONCE:** every node shows its real asset + approve/regenerate;
  imported vs generated differ only by one button label (regenerate = switch source imported→generated).

## RESUME POINT
CC has been asked to propose the **build sequencing/batching from real code** (which items share files,
what unblocks what, live-verify checkpoints between batches). **Claude's rough hypothesis to
pressure-test:** items **2+3 land together** (same facts-step); **4+5+6 land in a Phase-1-completion pass**
with 2+3; **item 1 (Way 2) is Phase 2** with the existing-assets import + per-node review. **Flow:** CC
returns the sequencing proposal → Claude pressure-tests → Arfeen approves → build batch-by-batch with live
browser verification between each. No code until the sequencing is approved.
