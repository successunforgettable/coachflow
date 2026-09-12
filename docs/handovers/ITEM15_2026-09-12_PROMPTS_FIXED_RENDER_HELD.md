# ITEM 15 — both prompt sources fixed; the re-render HELD before any write

**Written 2026-09-12. Every number measured at write time (§15f). NOTHING WAS WRITTEN TO PRODUCTION.**

Authorisation received: fix both prompt sources, then re-render `bonus-42`, `bonus-43`, `bonus-33`, overriding
the retention hold on those three rows only. **The prompt fix is done and verified. The re-render is held**,
for three reasons found during verification — each one contradicts a premise of the instruction.

---

## 1. WHAT WAS BUILT — prompt sources A and B

| file | change |
|---|---|
| `server/_core/offerStandard.ts` | new `VALUE_EQUATION_BLOCK_FREE_ASSET` (lever 3 carries no clock) assembled into free-asset mode; godfather angle, `free` angle, and section spec items 2/3/5 rewritten |
| `server/offersGenerator.ts` | the three `isFreeAsset` branches: guarantee, duration, access |
| `server/leadMagnetContentGenerator.ts` | `SYSTEM_PROMPT_LEAD_MAGNET` + `SYSTEM_PROMPT_BONUS` ("uses TODAY" → "uses as they are"); checklist and toolkit format lines |
| `server/_core/offerStandard.test.ts` | **new** — 13 tests, incl. the scanner's own calibration controls |
| 4 × `magnet-bonus-*.json` | pins re-recorded |

**The core diagnosis: the defect was a CONTRADICTION, not a missing rule.** `systemPromptFor` already appends
`GUARANTEE_CLAIMS_RULE`, which states *"what the reader will have become by day thirty is a promise about
them."* That rule and *"checklists the reader uses TODAY"* reached the model **in the same system prompt**, and
the nearer, more concrete instruction won. The fix is therefore a **deletion**, not a third statement.

`VALUE_EQUATION_BLOCK_FREE_ASSET` is written as a full literal, not derived by `.replace()`: a derivation that
misses its marker falls back to the ORIGINAL, which is the timed line — so a future rewording would silently
restore the defect in the one mode that must never carry it. `offerStandard.test.ts` asserts levers 1/2/4 stay
byte-identical to the paid block, so the duplication cannot drift unnoticed.

### Pin status — GREEN, and the split is the proof (§15c)

Baseline measured before the change: **30/30 green**. After the change, before re-recording, **exactly 4 pins
failed** — `magnet-bonus-{guide,checklist,toolkit,quiz}` — while all 12 paid/free-event offer pins, both cascade
pins, both map pins and `magnet-bonus-guide-nomethod` passed. That split is the negative control: the pin can
detect this class of change, and the paid/free-event prompts were not touched.

After re-recording: `promptPins` **21/21**, `leadMagnetOfferMode` **9/9**, `leadMagnetClose` **12/12**,
`offerStandard` **13/13**, `pipeline-fixes` **414/414**, `complianceFilter` **31/31**, `tokenCrypto` **10/10**.
`npx tsc --noEmit` = **34**, the baseline, zero new errors.

`git status` proof that only the intended fixtures moved: a full `PIN_RECORD=1` re-record left **4 files
modified and 18 untouched**.

Prompts now scan clean of timed-outcome steer in every mode and format. The single residual hit is
`"within 30 days"` inside `GUARANTEE_CLAIMS_RULE`'s own refund example — a promise about MONEY, which §14b
explicitly permits.

**One mistake worth recording:** the first version of the access line introduced the word "cohort" into the
free-asset prompt. `leadMagnetOfferMode.test.ts`'s event-vocabulary guard caught it immediately. Fixed to
"no group to join, no waiting list and no closing date".

---

## 2. 🔴 WHY THE RE-RENDER IS HELD — three findings, each contradicting a premise

### FINDING 1 — the prompt fix alone does NOT produce clean output. Verified by real generation.

A real LLM generation was run for all three, through production's own path and production's exact brief, with
the corrected prompts. **It wrote nothing.** Result:

| bonus | brief carries | output timed claims | verdict |
|---|---|---|---|
| **bonus-33** | — | **0** | ✅ clean (was 2) |
| **bonus-42** | `by day 7` | **5** — `by day 7`, `today`×4 | 🔴 still dirty |
| **bonus-43** | — | **2** — `one sitting`, `within 48 hours` | 🔴 still dirty (was 5) |

So re-rendering now would replace two of the three pages with **new copy that still carries the claim**.

### FINDING 2 — bonus-42's claim re-enters through the BRIEF, from an unscoped THIRD source

`bonusPdfGenerator.ts:54` builds the regeneration brief as `b.description` + the obstacle. **bonus-42's own
`description` contains "by Day 7"**, so the corrected prompt is handed the claim as input. `description` and
`shortLine` are written by **`bonusGenerator.ts` — a third prompt source, not source A or B, and not in the
scoping.** Measured: `bonus-33.shortLine` carries `in 48 hours`; `bonus-42.description` carries `by Day 7`;
`bonus-44.shortLine` carries `in minutes`.

Those two fields do **not** render on the `/p/bonus-NN` pages (verified by fetching — the text is absent), so
they are not a public exposure on these pages. They are the *input* to any re-render, and they reach the
campaign LP and email surfaces.

### FINDING 3 — 🔴 IT IS SIX LIVE PAGES, NOT THREE

Every bonus row in the post-wipe database was scanned. **All 6 have an `assetBody`, all 6 are published, and
all 6 carry timed claims.** All three fetched fresh: HTTP 200.

| page | kit / service | retention set | body hits |
|---|---|---|---|
| `bonus-33` | 200 / 285 | prohibition set | `in 48 hours`, `today` |
| **`bonus-34`** | 200 / 285 | prohibition set | `one sitting`, `the same day`, `today` |
| **`bonus-35`** | 200 / 285 | prohibition set | `today`×3, `one sitting` |
| `bonus-42` | 225 / 318 | pinned corpus | `by day 7`, `within 90 days`, `today` |
| `bonus-43` | 225 / 318 | pinned corpus | `one sitting`, `overnight`, `today` |
| **`bonus-44`** | 225 / 318 | pinned corpus | `today`×3, `within 48 hours` |

Also: `hvco-7293` (service 318) carries 6 hits in its magnet body — **not published** (`magnetHtmlUrl` null),
so not a public exposure today.

The scoping recorded three because three were read, not because three was the count — the same shape as §15l.
The authorisation covers three rows; the other three sit under the same two retention rules.

### Not every hit is a §14b violation — the boundary needs a product call

Per §14b, *"a duration inside scene-setting prose is not a promise."* Some hits are exactly that and **must not
be edited**:

- `bonus-43` — `"I want to think about it overnight"` — a quoted prospect objection inside swipe copy.
- `bonus-35` — `"...this was exactly what I needed today"` / `"I did the thing today"` — quoted self-talk.
- `bonus-44` — `"That yes is the only clarity I need today"` — quoted self-talk.

Clear violations, same class as the three scoped: `bonus-33` *"complete sales page draft in 48 hours ...
complete today"* · `bonus-42` *"By Day 7, you will hold a ranked shortlist"* · `bonus-43` *"send to a real
person today"*, *"One sitting. Five steps."* · `bonus-34` *"live copy within the same day"* · `bonus-44`
*"Each script is ready to [use] today"*.

---

## 3. NOTHING WAS TOUCHED — proven, not asserted

`updatedAt` and an MD5 of `assetBody` were read for all 6 bonus rows before and after. All three authorised
rows **UNCHANGED**; the other three carry Aug-03 / Aug-30 timestamps. A control confirmed the comparator would
report a 1-second difference as CHANGED. No fixture in kit 225, kit 200 or services 272–277/285 was written.

Production is still `9156875`. The prompt fix is **local and uncommitted** — so **every NEW generation still
carries the defect until it is deployed**, and pushing `railway-build` is the deploy.

---

## 4. RECOMMENDATION

1. **Add a timed-claim check with a corrective retry to the deliverable generator.** §0.7 records Arfeen's own
   ruling that reproducing an ungrounded claim is *"a defect in the node, not a bad roll — stop, never
   re-roll"*, which forbids regenerating until it comes out clean. The generator already has a validator/retry
   seam, and §14a expressly permits a **specific, post-hoc** `failContext` about the output just produced. The
   calibrated scanner in `offerStandard.test.ts` is the detector. **This is what makes the pages reliably clean
   rather than luckily clean, and it is the missing enforcement behind findings 1 and 3.**
2. **Then decide the scope of the re-render: three pages or six.** Six is the defect's actual footprint.
3. **Then decide on `bonusGenerator.ts` (source C)** and whether the three rows' `description`/`shortLine` are
   cleaned — without it, any future production re-render re-inherits the claim.
4. **Per-hit classification needs a ruling on quoted speech** before any page is rewritten, so scene-setting
   prose is not stripped along with the claims.
