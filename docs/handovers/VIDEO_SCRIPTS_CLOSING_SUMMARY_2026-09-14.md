# VIDEO SCRIPTS — closing summary (moderate build, 2026-09-14)

> ⚠️ **CORRECTION (2026-09-15): the Tool Library was never an entry point.** This document listed the Tool Library (the "Video Creator" / "Video Scripts" card in `V2ToolLibrary.tsx`) as a place coaches reach video. **That was wrong when it was written.** `V2Dashboard.tsx` imports `V2ToolLibrary` and never renders it. The "Jump to Tool Library" button sets an `activeTab` state that nothing reads, and none of the component's own strings exist in the production bundle, before or after deploy `87596d7`. It was found before the push, by the bundle-marker count (CLAUDE.md §15h). **The only live entry point is Ad Copy node → Video tab.** Each claim below is corrected in place and marked `[CORRECTED 2026-09-15]`; nothing was silently removed. Record: `docs/handovers/ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md`.

**The package is complete, pending the browser/deploy proof. That proof needs Arfeen's separate go-ahead, because it
touches a live deploy.**

- **Branch:** `docs/held-2026-09-12`. Build commit `9102140`; this summary and the clean-up follow it. Not pushed, not
  deployed (`railway-build` = `9156875`).
- **Full record:** `VIDEO_SCRIPTS_BUILD_2026-09-14.md`.

## 1. What is proven

**Video-script generation is reachable end to end for a kit that already has concepts. Proven for real on production,
kit 225: 8 of 8 scripts.**

- **Endpoints:** `conceptScripts.generateForIcp` / `listForIcp`, reached from Ad Copy node → **Video** tab. `[CORRECTED 2026-09-15]` "and Tool Library → Video Scripts" was listed here; that screen is never rendered.
- **Batch owner:** `ensureScriptsForIcp` wrote all 8 into **one** set (`60731b15-…`). Every script is at its stage length
  (unaware and solution-aware 60 s, problem- and product-aware 30 s) and inside its grounded word budget.
- **Retry:** the one script the existing gate refused (concept 227) was retried through "generate the missing ones" and
  **rejoined the same set**.
- **Job timing:** per-concept jobs ran 20–61 s each, inside the reaper's 5-minute window.

**The two handoffs are correct:**

| path | what it did | writes |
|---|---|---|
| **no kit** (proven on a local database through the real endpoint; production has no ICP without a kit) | returned `no_kit` | **none** — 0 concept rows and 0 job rows in the whole database |
| **kit, no concepts yet** (production, kit 187) | returned `preparing_concepts`, handed off to `ensureConceptsForIcp`, started no script batch | **one job row** (`concepts-icp-249`, which the concept generator enqueues); **0 concept rows, 0 script rows** |

**The gates:**
- tsc stays at 34.
- New and affected suites are green.
- **Five mutation controls each failed their target tests**, including one that reinstates the inverted length tiering.

## 2. What is not proven, and why it is not this package's

A kit with no concepts reaching written scripts. **Everything unconfirmed sits inside the concept generator**, downstream of
a correct handoff.

It rejected its first attempt and was cut off at 8,192 tokens on retry. The 4,000-token cap it requests is never applied
(`_core/llm.ts:428` hardcodes 8,192).

That is a pre-existing defect, logged as its own unscoped item: **`ITEM_CONCEPT_GENERATOR_TRUNCATION_UNSCOPED_2026-09-14.md`**.
The item also records the likely shared reaper/5-minute mismatch in the generator's other callers (kit creation, ad copy,
Meta assembly) as a question to check. This package's own screen already waits on rows rather than job status.

## 3. Clean-up done in this commit

| file | now says |
|---|---|
| `docs/LAUNCH_READINESS_AUDIT.md` | the Video Creator render tool is disabled **and unmounted**; the Ad Copy Video tab opens Video Scripts `[CORRECTED 2026-09-15]` ("both entry points" was wrong); not yet deployed at the time |
| `client/src/v2/components/UpgradePrompt.tsx` | the call-site comment marks `V2VideoCreator` as unmounted |
| `server/routers/videos.ts` | the `getLatestByServiceId` comment notes that no screen calls it since the unmount |

## 4. Production footprint of the whole package (58-table snapshots, before and after each run)

- **`conceptScripts` +8:** kit 225, one set.
- **`jobs` +9:** 8 script jobs complete, plus `concepts-icp-249` failed.
- **The other 56 tables are unchanged**, `campaignConcepts` included. No Cloudinary, KV or Meta calls.

## 5. Remaining, each on its own authorisation

1. **Deploy + browser proof** of `V2ConceptScripts` at the Ad Copy Video tab `[CORRECTED 2026-09-15]` (not "both entry points"). **Done 2026-09-15, see §6.** Arfeen's go-ahead; screenshots from Arfeen's
   browser.
2. **The concept-generator item**: triage and scope.

## 6. DEPLOYED AND PROVEN IN THE BROWSER — 2026-09-15 (Arfeen's go-ahead)

### Pushed

**`87596d7`**, a fast-forward with no force: `git push origin 87596d7:refs/heads/railway-build`, `9156875..87596d7`, at
21:11:30 UTC.

- **Contents:** 33 commits, meaning everything on `docs/held-2026-09-12` **except the stills commit `2562e64`**, which
  Arfeen excluded. The first 30 commits keep their hashes. The last three were cherry-picked onto `62bfbff`:
  `7adb428 → eab4feb`, `9102140 → 8d1bdd1`, `4a89ea9 → 87596d7`.
- **The exclusion is exact:** the candidate differs from held `4a89ea9` in exactly the 25 files `2562e64` touches, and
  those 25 are byte-identical to production `9156875`.
- **Gates on the candidate:**
  - tsc 34; `pnpm install --frozen-lockfile` passes.
  - 21 suites green: scriptBatch 15 · conceptAxis 20 · generator 11 · validator 8 · fabricationGateDefects 15 ·
    complianceGate 24 · pipeline-fixes 414 · complianceFilter 31 · tokenCrypto 10 · declaredCount 15 ·
    timedClaimScanner 48 · retry slots 10 · completeness 9 · strictToolSchema 9 · researchStatRule 3 ·
    offerStandard 13 · bonusPdfFormat 3 · leadMagnetClose 12 · leadMagnetOfferMode 9 · promptPins 21 · node5Screening 16.

### Deploy

Railway reports **`SUCCESS` for `87596d7`** (build started 2026-09-14T21:11:33Z). The previous deploy, `9156875`, is
`REMOVED`.

**Bundle markers (§15h), counted in all three builds:**

| marker | live before (`index-Duou2EVh.js`) | candidate build | live after (`index-Cw5P3O25.js`) |
|---|---|---|---|
| "one for each of your ad concepts" | 0 | 1 | **1** |
| "Generate the missing scripts" | 0 | 2 | **2** |
| `listForIcp` | 0 | 2 | **2** |
| old caption "Optional — generate video ads with voiceover and motion graphics." | 1 | 0 | **0** |
| "Video Creator — Coming Soon" | 2 | 1 | **1** (the V1 `/video-creator` page, untouched) |

### Browser proof

Arfeen's own Chrome, signed in as **user 1** (checked with `auth.me` before any screenshot), at
`https://zapcampaigns.com/v2-dashboard/wizard/adCopy?serviceId=318` (kit 225) → **🎬 Video** tab.

| # | screenshot | shows |
|---|---|---|
| 1 | `1-video-tab-caption-8of8.jpg` | the new caption *"Optional — generate talk-to-camera video scripts, one for each of your ad concepts."* and **"Video scripts — 8 of 8 scripts written"**. No Coming Soon card |
| 2 | `2-concept1-hook-scenes1-4.jpg` | Concept 1: chips (Cold audience · Humour · ~60s), hook, "Leads with", Scenes 1–4, each with spoken line, on-screen text and delivery note |
| 3 | `3-concept1-scenes3-5-buttons.jpg` | Scenes 3–5 including the CTA, then Show teleprompter / Copy script |
| 4 | `4-concept1-teleprompter.jpg` | the teleprompter view open |

**Rendered-page DOM check on that tab:**
- **0** × "Coming Soon" and **0** × "Video Creator" (both entry-point checks read from the live page, not from code);
- the new caption is present;
- 8 concept cards and 8 teleprompter buttons.

**The Coming Soon card is gone from the only reachable entry point.** The Tool Library is never rendered, so it had no
card to remove (`ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md`).

### Blast radius of the browser session

Snapshots of all 58 tables were taken at 21:18:13 and 21:20:28 UTC.

- **Two rows changed, both the product's own page-open behaviour, neither from video scripts:**
  - `product_events` +1 (id 989, `campaign_started`, user 1, `{"serviceId": 318}`), which the wizard fires once on
    mount;
  - `users` id 1 `lastSignedIn` / `updatedAt` → 21:19:01, the session touch.
- **No script, concept or job row changed.** The only click was the Video tab plus the client-side teleprompter toggle.

### Found during the proof: logged, not fixed

Under the tabs, a pre-existing sub-label reads *"Script: Free · Render: Credits"*. It describes the old render tool and was
not part of this package.
