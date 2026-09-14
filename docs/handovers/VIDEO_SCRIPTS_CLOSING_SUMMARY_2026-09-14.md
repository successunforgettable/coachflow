# VIDEO SCRIPTS — closing summary (moderate build, 2026-09-14)

**The package is complete, pending the browser/deploy proof. That proof needs Arfeen's separate go-ahead, because it
touches a live deploy.**

- **Branch:** `docs/held-2026-09-12`. Build commit `9102140`; this summary and the clean-up follow it. Not pushed, not
  deployed (`railway-build` = `9156875`).
- **Full record:** `VIDEO_SCRIPTS_BUILD_2026-09-14.md`.

## 1. What is proven

**Video-script generation is reachable end to end for a kit that already has concepts. Proven for real on production,
kit 225: 8 of 8 scripts.**

- **Endpoints:** `conceptScripts.generateForIcp` / `listForIcp`, reached from Ad Copy node → **Video** tab and Tool
  Library → **Video Scripts**.
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
| `docs/LAUNCH_READINESS_AUDIT.md` | the Video Creator render tool is disabled **and unmounted**; both entry points open Video Scripts; not yet deployed |
| `client/src/v2/components/UpgradePrompt.tsx` | the call-site comment marks `V2VideoCreator` as unmounted |
| `server/routers/videos.ts` | the `getLatestByServiceId` comment notes that no screen calls it since the unmount |

## 4. Production footprint of the whole package (58-table snapshots, before and after each run)

- **`conceptScripts` +8:** kit 225, one set.
- **`jobs` +9:** 8 script jobs complete, plus `concepts-icp-249` failed.
- **The other 56 tables are unchanged**, `campaignConcepts` included. No Cloudinary, KV or Meta calls.

## 5. Remaining, each on its own authorisation

1. **Deploy + browser proof** of `V2ConceptScripts` at both entry points. Arfeen's go-ahead; screenshots from Arfeen's
   browser.
2. **The concept-generator item**: triage and scope.
