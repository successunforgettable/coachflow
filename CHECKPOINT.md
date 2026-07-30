# CHECKPOINT — 2026-07-31, pre-break

**For a cold terminal with no memory of the session that produced this.** Read this file, then
`docs/handovers/STATE.md`. Everything below was verified, not recalled.

---

## 1. Where the repo is

| | |
|---|---|
| Branch | `railway-build` |
| Parent commit | `785df87` — also what `origin/railway-build` still points at |
| This checkpoint commit | **HEAD of `railway-build`.** Print it with `git rev-parse HEAD` |
| Pushed? | **NO. Nothing pushed. `origin/railway-build` is still `785df87`.** |
| Working tree | Clean after this commit (306 unrelated untracked files from *earlier* sessions were deliberately left alone — see §5) |

**Why nothing is pushed:** on this project **push = instant production deploy**. Measured this
session: commit `785df87` was authored at `04:16:17Z` and Railway created its deployment at
`04:16:21.231Z` — **4 seconds**, no human gate, one deployment per commit including docs-only
commits. The object-slot fix below is **not cleared for release**, so the work stays local.

---

## 2. What is built and proven

### P6c — the coach's "Generate Ad Images" button (FIXED, proven on a real live run)

It used to crash outright. `adCreatives.headline` is `varchar(255)`, and
`services.uniqueMechanismSuggestion` — documented as "a proprietary-sounding NAME" but persisted with
`trunc(…, 65535)` — holds a *description* on **94 of the 101** production services that have one
(mean 394 chars, max 622). The templates interpolated it whole, so the INSERT died on variation 1.
**93% of production services would have hit this.**

Fixed in `server/routers/adCreatives.ts`, both layers inside the formulas so no call site can skip them:
- `resolveMechanismName()` — recovers the name by splitting the `Name — description` shape.
- `fitAdHeadline()` — trims the **finished** headline to the house 38-char limit. Load-bearing:
  extraction alone still left four of five headlines over the limit. **Trim-to-fit, never reject** —
  a hard length gate has previously killed a live cascade.
- `checkCompliance` relabelled: the old unsourced "exceeds 40 characters (Meta recommendation)" now
  reads as a **ZAP house craft standard, not a Meta rule**. Meta publishes **27** as a *display*
  recommendation; **neither 38 nor 40 appears in Meta's docs** (`META_AD_COMPLIANCE_REFERENCE` §1.4a).
- "COACHING COACHES" fixed via `audienceLabel()`.

**Proven live** on a real wizard run (Step D): a 398-char input produced five valid headlines,
measured `CHAR_LENGTH` 32 / 16 / 37 / 36 / 34.

### Object-slot text leak — L1–L4 built, **PARTIALLY** effective

Started because a live render put a wall sign reading **"COACHING"** into the object slot, sharp and
centred directly above the composited headline.

Built (object slot only — the shared strings are untouched so the four clean slots are unaffected):
- **L1** `nicheContextObject` — the *object* carries the niche; the background carries nothing.
- **L2** `seamlessBackdropObject` — a seamless studio sweep, so there is structurally nowhere for
  signage to live. **This is the change that worked.**
- **L3** niche and problem-gist removed from the object slot's scene layer (both were text vectors).
- **L4** `complianceNote` made style-aware — it said "an ordinary **person**" and was being appended
  to the two person-free still lifes.

**Test: 30 renders, every one opened and eyeballed at full size.**

| niche | kind | clean | leaked |
|---|---|---|---|
| coaching | abstract | **4/4** | — |
| career-pivot | abstract | **4/4** | — |
| mindset | abstract | 3/4 | **1** |
| leadership | abstract | 3/4 | **1** |
| fitness | prop-rich | 4/4 | — |
| dog-training | prop-rich | 4/4 | — |
| screenshot controls | — | **6/6** | — |

**Final: 22 clean / 2 leaked on the object slot = ~8%, one in twelve.**

- **The background vector is fully eliminated** — zero background signage in all 24 renders, and
  `coaching`, the niche that caused the original leak, is now 4/4 clean.
- **The leak relocated onto the object surface.** `mindset__4` = a block with **"MINDSET" embossed**;
  `leadership__2` = a letterform **"L"** on a plinth engraved **"LEADERSHIP"**.
- Pattern: **0/8 on prop-rich niches, 2/16 on abstract ones.** Both leaks were trophy/plaque/monument
  objects — the object class that conventionally carries engraving.

🔴 **8% fails the no-uncontrolled-text standard. THE OBJECT SLOT IS NOT CLEARED FOR PUBLISH.**

Renders: `docs/screenshots/run-2026-07-31-objectleak/` · live Step D proof set:
`docs/screenshots/ZAP-IMAGES-2026-07-30/` · earlier hybrid proofs:
`docs/screenshots/run-2026-07-30-hybrid/`.

---

## 3. THE OPEN DECISION — waiting on Arfeen

**(a) Test L5 — recommended.** One targeted instruction that the object's own surfaces carry no
engraved, embossed or cast lettering, applied to the **gpt-only** object slot. Same 24-render
protocol weighted to abstract niches. **~$1, ~8 minutes, local harness only — no prod rows, no
Cloudinary, nothing to tear down.** Then reassess.

**(b) Ship the hybrid switch for the `screenshot` slot ONLY** — 6/6 clean here and clean on the live
Step D run — and treat the object slot as a separate unsolved problem, possibly retiring it in favour
of a pure-template style that carries zero generation risk. This is the fallback if L5 does not reach
clean.

**"Ship the object slot as-is" is OFF the table. 8% is a blocker, settled.**

### ⚠️ CORRECTED PREMISE — do not let a future session re-offer this

**"Just revert the object slot to the old Flux model, which was text-clean" is FALSE.** Flux was not
clean on this slot either — the 6-niche bake-off recorded it producing a **garbled brand name
("Famron")**. Reverting trades a correctly-spelled stray word for a misspelled one, which is worse.
**Neither image model is text-clean by default on the object slot.** Reverting is not a clean
fallback and must not be presented as one.

---

## 4. Explicitly NOT done — held, not forgotten

- **L5** (targeted object-surface text prohibition) — **held pending Arfeen's go.** See §3.
- **Write-side shape guard on `uniqueMechanismSuggestion`** — sized, not built. Small (3 edits, one
  file, no migration): tighten the prompt at `routers/services.ts:194`, validate shape at `:326` and
  `:364` (`:364` currently has **no** truncation at all), tighten the Zod input at `:67`.
  ⚠️ **A length clamp would be wrong** — five consumers read that field for its descriptive content
  (`adCopyGenerator.ts:329`, `headlinesGenerator.ts:311`, `leadMagnetContentGenerator.ts:155`,
  `icpAngleSuggestions.ts:49`, `groundingCorpus.ts:101`). Enforce *shape*, not length.
- **C — data backfill of the 94 oversized rows.** Not needed for correctness: the fix is read-time,
  so every existing row already renders correctly.
- **Three softer-claim fallback lines**, for a later copy-honesty pass: `_core/campaignCta.ts:23`
  ("Book a Free Call"), `lib/templates/eventImanGadzhi.ts:287` ("A free live event…"),
  `lib/templates/salesLight.ts:146` ("Here's exactly what you'll be able to do."). Price/outcome
  claims, no invented statistics.
- **`V2ToolLibrary` is dead code** — imported at `V2Dashboard.tsx:11`, **never rendered anywhere**.
  The ad-image creator is reachable only via `/v2-dashboard/wizard/adCopy` → Images tab.
- **Route 1063 (V1 campaign dashboard, `/campaigns/:id`)** still lacks the `zone: "lower"` scrim.
  Live route, real user path. See `docs/handovers/AD_IMAGE_SITE_SWEEP_2026-07-30.md`.

---

## 5. Standing rules for whoever resumes

- **Nothing pushes without Arfeen's explicit go.** Push = instant prod deploy (4s trigger).
- **Every prod write needs Arfeen's "execute" in the immediately preceding message.** No exceptions
  for small, safe, or "done it before".
- **Save proof images to disk BEFORE teardown.** This failed once and cost the only render of a run.
- **The object slot must never render uncontrolled in-image text before it publishes.**
- **The four clean slots — the three person styles and `screenshot` — are out of scope for the object
  fix and must not be touched.**
- **306 untracked files from earlier sessions were deliberately left alone** by this checkpoint. They
  predate this work. Do not sweep them into a commit without asking.
- Gates: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **34**. Suites: `server/pipeline-fixes.test.ts`
  (382), plus the new `server/_core/fallbackHeadlineLength.test.ts` (117),
  `fallbackHeadlineClaims.test.ts` (15), `imagePromptNegation.test.ts` (18), `imageRenderer.test.ts` (6).

---

## 6. Step D live re-run recipe

If the object slot later needs its own live proof, this is the exact protocol that worked:

1. Start the local server with **`ZAP_DISABLE_REAPER=1`** and confirm the boot line
   `[boot] Stuck-job reaper: SKIPPED`. Without it, a local server started via `railway run` sweeps the
   **production** jobs table every 60s. The guard is **opt-out by design** — absence means enabled, so
   a push can never silently disable production's own sweep.
2. Log in via the dev-only `/api/test-login/native_ea8a5ee639013dd01bc0b6b585b9dd52` (smoke user
   **117174**, tier `pro` so the free-tier gate does not apply). Server on `PORT=3100`,
   `NODE_ENV=development`.
3. Drive `/v2-dashboard/wizard/adCopy` → Images tab → "Generate Ad Images".
4. **Assert the new-code marker** `[imageGeneration] gpt-image-1 rendered style=` in local stdout
   before trusting any result. Deployed prod cannot emit it.
5. Read-only `meta_published_ads` count for 117174 immediately before and after — expect **0 → 0**.
   (Table is snake_case: `meta_published_ads`. `jobs.created_at` is snake_case too.)
6. **Declared write scope: 5 `adCreatives` + 1 `jobs` row + 10 Cloudinary objects. Nothing else.**
7. **Save every image to disk and verify the files exist BEFORE teardown.**
8. Teardown: `sweepAdCreativeBatch` (reads Cloudinary public_ids *before* deleting rows), then
   **explicitly delete the jobs row** — the module does not cover it. Settle, then re-verify counts.

**Baseline to reconcile against:** creatives **397** · jobs **94** · `meta_published_ads` for 117174
**0** · running jobs **0** · protected rows **24** (services 272–277, ICPs 249–254, kits 187–192,
LPs 222–227). Production was left at exactly this baseline.
