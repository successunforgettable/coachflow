# CHECKPOINT — 2026-08-01, pre-break

**For a cold terminal with no memory of the session that produced this.** Read this file, then
`docs/handovers/STATE.md`. Everything below was verified this session, not recalled.

---

## 1. Where the repo is

| | |
|---|---|
| Branch | `railway-build` |
| Parent commit | `a57cbb6` (the 2026-07-31 checkpoint: P6c + object-slot L1–L4) |
| This checkpoint commit | **HEAD of `railway-build`.** Print it with `git rev-parse HEAD` |
| `origin/railway-build` | **`785df87` — unchanged. NOTHING HAS BEEN PUSHED.** |
| Working tree | Clean for this work. ~310 untracked files from *earlier* sessions were deliberately left alone — see §6 |

**Two commits are now local-only and unpushed: `a57cbb6` and this one.** A push deploys BOTH.

**Why nothing is pushed:** on this project **push = instant production deploy**. Measured on
2026-07-31: commit `785df87` was authored at `04:16:17Z` and Railway created its deployment at
`04:16:21.231Z` — **4 seconds**, no human gate, one deployment per commit including docs-only
commits. The push decision is Arfeen's and has not been made. See §3.

---

## 2. What is built and proven

### P6c — the coach's "Generate Ad Images" button (FIXED, live-proven) — landed in `a57cbb6`

It used to crash outright. `adCreatives.headline` is `varchar(255)`, and
`services.uniqueMechanismSuggestion` — documented as "a proprietary-sounding NAME" but persisted with
`trunc(…, 65535)` — holds a *description* on **94 of the 101** production services that have one
(mean 394 chars, max 622). The templates interpolated it whole, so the INSERT died on variation 1.
**93% of production services would have hit this. It is still broken on production right now.**

Fixed in `server/routers/adCreatives.ts`, both layers inside the formulas so no call site can skip
them: `resolveMechanismName()` recovers the name by splitting the `Name — description` shape;
`fitAdHeadline()` trims the **finished** headline to the house 38-char limit (load-bearing —
extraction alone still left four of five headlines over). **Trim-to-fit, never reject** — a hard
length gate has previously killed a live cascade.

**Proven live** on a real wizard run (Step D): a 398-char input produced five valid headlines,
measured `CHAR_LENGTH` 32 / 16 / 37 / 36 / 34.

### Object slot RETIRED — tabloid deck 5 → 4 (this commit)

**Why retired, not fixed again.** Prompt-based text suppression failed three times. Each layer
closed the surface it named and the leak moved to the next one:

1. L1–L4 killed **background signage** → leak relocated onto the object's own surface.
2. L5 killed **engraved plinths** (13/13 trophies came back blank — that fix genuinely worked)
   → leak relocated again.
3. The L5 confirmation batch still produced **"LEADER" embroidered on a chair back** and
   **"MINDSET" debossed into a moulded block** — the second being the exact failure L5 was written
   to eliminate.

Cumulative across both L5 batches: **46 clean / 2 leaked on 48 renders.** Point estimate 4.2%, but
the exact 95% upper bound is **~12%**, which fails the no-uncontrolled-text bar for unattended
publishing. Evidence: `docs/handovers/OBJECT_SLOT_L5_RESULT_2026-07-31.md` and the 24 renders in
`docs/screenshots/run-2026-07-31-objectleak-L5-confirm/` (untracked, local disk only).

**What the retirement did — 8 files changed, +222/−120:**

- `_core/adVariations.ts` — `object`/`contrast` entry removed; `"object"` removed from the
  `AdVariationStyle` union **deliberately, so tsc rejects any residual literal**. Dead
  `PERSON_BEARING_STYLES` export removed. New `liveStyleFor()` — see §4.
- **`routers/adCreatives.ts:1153` and `:1317` — the two hardcoded `i < 5` loops.** These were live
  **production crash sites**: the coach's Generate button and the campaigns batch path. Both would
  have thrown on `variations[4].formula` the instant the deck shrank. Now derive `variations.length`.
- `adCreativesGenerator.ts` — the headline LLM prompt hardcoded "exactly 5 … benefit, social_proof,
  curiosity, contrast, challenge" in three places. All three now derive from `AD_VARIATIONS` via
  `HEADLINE_REGISTER_BLOCKS`, which is exhaustive over the formula union by type. **Purely
  subtractive + renumbering — no surviving register was reworded** (§14 discipline).
- `_core/imageGeneration.ts` — `STILL_LIFE_STYLES` narrowed to `{"screenshot"}`. **The set itself is
  load-bearing and stays** — deleting it would drop screenshot back onto Flux.
- The `object:` template and its four object-only strings (`nicheContextObject`,
  `seamlessBackdropObject`, `cleanPlateObject`, `unmarkedSurfacesObject`) deleted **surgically by
  identifier**.

**⚠️ NEVER `git revert` the L1–L5 object commits to undo this.** `cleanPlate`, `compositionSetting`,
`nicheContextSetting` and `complianceNoteStill` are **shared with `screenshot`**, and
`complianceNoteStill` was *created by* the L4 object work. A revert would drag it back into the
person-worded `complianceNotePerson` and silently regress the screenshot prompt.

**The four survivors are proven byte-for-byte undisturbed.** A fixture was captured from the
pre-retirement code (16 variants: 4 styles × uglyMode on/off × subject present/absent) and is
asserted verbatim by `server/_core/adImagePromptStability.test.ts`. **`screenshot` is identical to
the character.** The suite also guards itself — one test asserts the fixture carries no object-only
string, so a baseline captured after a bad edit could not pin a regression.

**Gates:** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **34** (baseline exactly held).
**608 tests passing across 9 suites, zero failures.** `pipeline-fixes` is now **383** (was 382).

**Smoke render 4/4 clean**, renderer chosen by the real `rendererForStyle`: screenshot still on
gpt-image-1, three person slots still on Flux. The screenshot render was opened and is text-free.

---

## 3. THE OPEN DECISION — waiting on Arfeen

**Push, or hold?**

- **Reason to push:** P6c fixes a live, widespread production bug. The "Generate Ad Images" button
  is currently broken for ~93% of production services. That fix is proven on a real live run and is
  sitting unpushed.
- **Reason to hold:** push is an immediate prod deploy with no human gate, and it ships the deck
  change at the same time.

**IMMEDIATE SUB-STEP BEFORE ANY PUSH — Arfeen's design gate.** He wants to personally eyeball the
four smoke-render PNGs first, then decide. They are:

```
docs/screenshots/run-2026-08-01-deck4-smoke/
  01__person_shocked__flux-1.1-pro.png
  02__screenshot__gpt-image-1.png
  03__person_intense__flux-1.1-pro.png
  04__person_curious__flux-1.1-pro.png
```

Do not push before he has looked at those and said go.

---

## 4. Judgment calls already made and accepted

- **Old `object` DB rows regenerate as `screenshot`**, via `liveStyleFor()` in `_core/adVariations.ts`.
  `regenerateSingle` and `makeVertical` read `designStyle` off the stored row, so the deck removal
  alone would not have closed that path. Mapped explicitly rather than left to the silent
  `person_shocked` fallthrough. `screenshot` was chosen over a person style because it preserves the
  slot's still-life character and is the proven-clean one. **The stored `designStyle` is deliberately
  NOT rewritten** — the row keeps its history, so the UI badge still reads "object" while the image
  is a screenshot. Cosmetic, intentional, not persisted-data churn.
- **`"object"` REMAINS in the `designStyle` mysqlEnum** (`drizzle/schema.ts:1140`). Historical rows
  carry it; removing it needs a migration. No migration was made this session.
- **`"contrast"` retained in the `AdVariationFormula` type**, and the specificity voice rule
  ("a SPECIFIC scenario, number, outcome, or contrast") left in place. Both are still needed by the
  template-card deck, which writes `contrast` to `headlineFormula`.

---

## 5. Explicitly NOT done — held, not forgotten

- **Deterministic object-slot rebuild** — server-side selection from a **curated per-niche
  text-free object list**. This is the ONLY real path to bringing the object slot back *with a
  guarantee* rather than a probability. **It is NOT another prompt clause** — that approach has now
  failed three times and must not be re-attempted. Parked, not cancelled.
- **Write-side shape guard on `uniqueMechanismSuggestion`** — sized, not built. 3 edits, one file,
  no migration: tighten the prompt at `routers/services.ts:194`, validate shape at `:326` and `:364`
  (`:364` currently has **no** truncation at all), tighten the Zod input at `:67`.
  ⚠️ **A length clamp would be wrong** — five consumers read that field for its descriptive content
  (`adCopyGenerator.ts:329`, `headlinesGenerator.ts:311`, `leadMagnetContentGenerator.ts:155`,
  `icpAngleSuggestions.ts:49`, `groundingCorpus.ts:101`). Enforce *shape*, not length.
- **C — data backfill of the 94 oversized rows.** Not needed for correctness: the P6c fix is
  read-time, so every existing row already renders correctly.
- **Three softer-claim fallback lines**, for a later copy-honesty pass: `_core/campaignCta.ts:23`
  ("Book a Free Call"), `lib/templates/eventImanGadzhi.ts:287` ("A free live event…"),
  `lib/templates/salesLight.ts:146` ("Here's exactly what you'll be able to do.").
- **`V2ToolLibrary` is dead code** — imported at `V2Dashboard.tsx:11`, never rendered anywhere.
- **Route 1063 (V1 campaign dashboard, `/campaigns/:id`)** still lacks the `zone: "lower"` scrim.
  Live route, real user path. See `docs/handovers/AD_IMAGE_SITE_SWEEP_2026-07-30.md`.
- **"coaching" renders as *athletic* coaching** (whistle, court clipboard) rather than business/life
  coaching. Pre-existing niche ambiguity, unrelated to any of the above. Still open.
- ~~Low intra-niche object variety~~ — **moot, the object slot is retired.**

---

## 6. Standing rules for whoever resumes

- **Nothing pushes without Arfeen's explicit go.** Push = instant prod deploy (~4s trigger, no gate).
- **Every prod write needs Arfeen's "execute" in the immediately preceding message.** No exceptions
  for small, safe, or "done it before".
- **Arfeen's eyes on renders are the design gate.** CC never self-certifies a visual result.
- **Save proof images to disk BEFORE any teardown.** This failed once and cost the only render of a run.
- **⚠️ THE OTHER TWO AD DECKS STAY AT 5. Only the tabloid deck is 4.** The style-dependent deck size
  is accepted and intended, not an oversight. These three sites must **never** be swept into a
  deck-size change:
  - `_core/orchestration.ts:879` — `i < 5`, the **template-card** deck (quote_card / notification /
    testimonial / comparison_card). Does not use `AD_VARIATIONS` at all.
  - `routers/campaigns.ts:337` — `i < 5`, **video** generation, its own `videoConfigs` array.
  - `EDITORIAL_VARIATIONS` in `_core/editorialPrompt.ts` — 5 variations, separate flux-2 renderer.

  A find-and-replace on `"object"` is likewise unsafe: it hits `mode: "object"` and `hero_object` in
  `editorialPrompt.ts` (a different, live deck) and `typeof x === "object"` throughout.
- **~310 untracked files from earlier sessions were deliberately left alone** by this checkpoint,
  including the 24 L5-confirmation renders in `docs/screenshots/run-2026-07-31-objectleak-L5-confirm/`.
  They predate or evidence this work. Do not sweep them into a commit without asking.
- **The landing-page cascade is NOT coupled to the ad deck.** Verified this session: `landingPage` is
  cascade step 6, `adCreatives` is step 9; LPs come from 4 fixed angles; exactly one LP row is
  inserted per run. GHL push already deletes orphaned `ZAP Ad Creative N` custom values for N > count.
  Email, WhatsApp, ad copy and Meta push are all deck-size agnostic. No stranded assets from 5 → 4.
