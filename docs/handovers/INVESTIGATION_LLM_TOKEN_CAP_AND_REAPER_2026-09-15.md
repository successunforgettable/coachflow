# INVESTIGATION: the shared 8,192-token output ceiling, and the reaper race (2026-09-15)

**Investigation only. No fix shape is proposed.** Every database read was read-only, and nothing was changed or pushed.

Follows `ITEM_CONCEPT_GENERATOR_TRUNCATION_UNSCOPED_2026-09-14.md`.

---

## 1. Root cause: CONFIRMED, and wider than one caller

| fact | where |
|---|---|
| Production always uses the Claude path: `invokeLLM` → `invokeClaudeAPI` whenever an Anthropic key is set | `server/_core/llm.ts:705-711` |
| **The request body hardcodes `max_tokens: 8192`** | `llm.ts:428` |
| `maxTokens` / `max_tokens` are declared on `InvokeParams` and **read nowhere** on that path | `llm.ts:63-64` (the only other occurrences: `:428`, `:742`) |
| The Forge fallback sets 32,768, but it runs only when no Anthropic key is set, so **never in production** | `llm.ts:742` |
| **Truncation is silent.** `stop_reason` is logged, then returned as `finish_reason`. An error is thrown only if the tool-use block is missing or its input is null, so a cut-off tool call returns partial JSON | `llm.ts:598`, `:649`, `:624-630` |
| **No caller reads `finish_reason` or `stop_reason`** | grep across `server/` (excluding tests and scripts): 0 hits |
| Each Anthropic fetch aborts at 5 minutes (the strict-schema retry too) | `llm.ts:444-445`, `:476-477` |
| **Test pins on 8,192: none.** `server/anthropic.test.ts` sends `max_tokens: 10` in its own direct API key check, unrelated to `llm.ts` | — |

**So there are two defects, not one.**
- **(a) Requested caps are ignored.**
- **(b) Every caller has a hard 8,192 ceiling, whether it asked for one or not.** This is the one that truncates.

## 2. Callers that SET a cap: 6 of 54 `invokeLLM` call sites, and every one asks for LESS than 8,192

| caller | requested | measured output | verdict |
|---|---|---|---|
| `server/conceptGenerator.ts:192` | 4,000 | **7,754 and 7,892** on attempt 1; the retry was **cut off at 8,192** (production, ICP 249, 2026-09-14) | 🔴 **cut off by the ceiling.** **It depends on the cap being ignored:** honouring 4,000 would cut off every attempt, including the first |
| `server/conceptScriptGenerator.ts:156` | 2,000 | 19 production calls, **max 844** (kits 225 runs) | 🟢 unaffected either way |
| `server/routers/videoScripts.ts:925`, `:1120`, `:1215` | 2,000 | none: production holds **0 `videoScripts` rows**. The V2 entry points no longer mount this tool; V1 `CampaignDashboard` can still call it | ⬜ no evidence |
| `server/routers/videos.ts:347` | 2,000 | none (the render-tool script regeneration) | ⬜ no evidence |

## 3. The other 48 call sites have the same 8,192 ceiling, uninvited

**Production logs cannot measure this.** `railway logs` reads one deployment.

- **The previous deployment (`9156875`, the four days of runtime):** its logs are retained, but a filtered pull returned **0** `stop_reason` lines. The same filter on the current deployment returns hits for a known string (182 lines), so the filter works and those four days of logs are gone.
- **The current deployment (`87596d7`):** it has had no LLM traffic since the deploy.
- **So zero `max_tokens` lines in the logs is not zero truncation.** It is no coverage.

### Proxy: stored output size per single generation

Read-only, post-wipe production, 983 rows total, so the sample is small. **Calibration is ≈ 2.6–2.7 stored characters per
output token**, from two measured points:
- the concept set: 21,050 chars vs about 7,800 tokens;
- bonus bodies: 12,516 avg chars vs 4,466–5,174 tokens, recorded in item 15.

| generator (call shape) | stored max · avg chars | ≈ output tokens (max) | against 8,192 |
|---|---|---|---|
| **Landing page, per angle** (4 angles in parallel, one call each) | **22,407** · 18,592 (largest angle) | **≈ 8,300** | 🔴 **at or over the ceiling** |
| **Concept set** (one call) | 21,050 · 21,050 (n=1) | ≈ 7,800 (**measured**) | 🔴 **measured: the retry is cut off** |
| **Bonus body** (one call; stored AFTER per-tool trimming, so raw output was larger) | **18,779** · 12,516 | ≈ 7,000 | 🟠 near |
| **Lead-magnet body** (one call; stored after trimming) | **17,461** (n=1) | ≈ 6,500 | 🟠 near |
| Mechanisms per set (about 4 calls) | 18,421 · 17,410 | ≈ 6,800 in total | 🟢 per call (unverified split) |
| **ICP, all text columns** | **38,078** · 34,696 | ≈ 14,000 | ❓ **more than one call can emit.** It must be assembled across calls (generate plus enrichment or sharpen); the per-call split is not traced |
| Lead-magnet titles per set (4 calls) | 8,701 · 6,867 | ≈ 3,300 in total | 🟢 |
| Email sequence · WhatsApp · offer angle | 4,830 · 4,401 · 2,384 | ≤ 1,800 | 🟢 |
| Headlines per set (5 calls) · ad copy per set (6 calls) · concept script | 2,592 · 3,141 · 2,482 | ≤ 950 | 🟢 |

**Caveat:** a stored row is by definition an output that survived its gates. **A cut-off output that failed validation left no
row**, so this proxy cannot count truncations. It only shows which generators run close to the ceiling.

## 4. What fixing it could break (dependencies on the current behaviour)

1. **The concept generator's own 4,000** sits below its real output (§2). Honouring requested caps as written would break
   concept generation outright.
2. **A higher ceiling means longer calls, and that runs into the 5-minute fetch abort.** The concept call took roughly
   2.8 minutes for about 7,800 tokens, which is **about 45 tokens/s** (an estimate from harness timestamps). At that rate,
   an output much beyond **about 13,000 tokens** would reach the abort at `llm.ts:445`.
   - `landingPages.ts:668` and the ad-copy router **treat `AbortError` as a network error** and rerun the whole
     generation (`landingPages.ts:674-699`, read and confirmed).
   - **So a raised ceiling can turn a truncation into an abort followed by a full rerun.**
3. **Longer calls mean longer jobs, and more reaper exposure** (§5).
4. **Checks that currently absorb a truncation.** These are protections, not dependents, but which failure fires will
   change:
   - `conceptGenerator.ts:198` ("no concepts array");
   - the lead-magnet completeness floor, `repairArrayField` and the declared-count gate;
   - `landingPageGenerator.ts`'s string-field checks;
   - every 3-attempt validate/retry loop.
5. **No test pins 8,192 or `maxTokens`.** A fix changes no test by itself.

## 5. The reaper race: which other slow jobs share it

**Mechanism:**
- **The reaper:** at boot and every 60 s it marks any `pending` job older than 5 min as `failed` (`_core/index.ts:61-76`,
  `:143-150`). `running` is never swept.
- **Fetch timeout:** each LLM fetch aborts at 5 min (`llm.ts:445`).

**The sweep** (an Explore agent covering all 19 job-insert sites, every row cited to file:line) found **16 sites that stay
`pending`** and so can be reaped while alive, and 3 that use `running`. I re-read the concept generator re-arm and the
landing-page rerun myself; the other rows are as the sweep reported.

### Highest risk

| # | path | why |
|---|---|---|
| 1 | **Concept generator** (`conceptGenerator.ts:642-644`, re-arm at `:643`) | measured over 5 min; triggered on every kit auto-select (`campaignKits.ts:183`), the ad-copy entry and video scripts. A reaped job reads `failed` with no rows, so the next caller **re-arms it and starts a second generation**. The re-arm keeps the original `created_at`, so the reaper fails it again within 60 s and the next caller starts a third. The delete-then-insert prevents a doubled set, **not doubled LLM spend**. **Re-read directly** |
| 2 | **Video-script batch, this package's own code** (`conceptScriptBatch.ts:74` + `_core/scriptBatch.ts:81-84`) | per-concept jobs measured 20–61 s, so this is unlikely. But if one concept's generation ever ran past 5 min (3 attempts × up to 5-min fetches), its reaped row reads `failed`, and "Generate the missing scripts" would re-arm it while the original loop is still writing that concept. **Open against this package** |
| 3 | **Landing pages** (`landingPages.ts:674-699`) and **ad copy** (`adCopy.ts:320-336`) | four parallel angles, each allowed several attempts (landing pages). A network error, **including the fetch abort**, triggers a 30 s wait and a full rerun **on the same row with the original 5-minute clock**, so the reaper can fail a job that is inside its own rerun. **Landing pages re-read directly** |
| 4 | **Wizard generators** (ICP, offers, mechanisms, lead-magnet titles, headlines, ad copy, landing pages, email, WhatsApp — `V2GeneratorWizard.tsx:2119-2153`) and **ad images** (`V2AdImageCreator.tsx:723-757`) | the client gives up at 300 s (ad images: 180 s); retry starts a NEW job while the old one still writes. Possible duplicate sets and double quota (**unverified**) |
| 5 | **Bonus PDF reconcile** (`bonusPdfGenerator.ts:153`) | not the reaper, same shape: a run older than 10 min is re-upserted to `pending` while possibly still alive |

**`running` jobs, which become zombies if the process dies** (never swept):
- `orchestrate` (`orchestration.ts:1140`): the progress page spins forever.
- `orchestrateStep` (`autoMode.ts:231`): V2Trail gives up at 600 s, and each zombie holds one of 3 concurrency slots
  (`autoMode.ts:93-103`). **Three zombies block Auto Mode for that user.**
- Bonus PDF (`bonusPdfGenerator.ts:125`): recovered by reconcile.

**Also reported:** `adCreatives.regenerateSingle`'s client **treats `failed` as success** (`V2AdImageCreator.tsx:831-834`).

## 6. Scale — corrected against the database, not the summary

"21 of 22 production kits have no concepts" is true as a count, and misleading as a cause. Measured 2026-09-14, by joining
`campaignKits` to `idealCustomerProfiles`:

| kits | state |
|---|---|
| **14** (ids 204–218) | **orphaned:** their ICPs were deleted in the 2026-09-12 wipe. They can **never** have concepts or scripts, whatever the fix |
| **8** | have a live ICP. Of these, **1 has concepts** (225) and **7 do not** (187–192 on the smoke account, 200 for user 1) |

- **Why the 7 are empty is NOT measured.** The wipe also emptied `jobs`, so there is no record of a concept attempt for them.
- **Only ICP 249 (kit 187) has a measured truncation.** That the other 6 fail the same way is **likely, not established**
  (the concept set runs at about 7,800 tokens on attempt 1).
- **The video-script generator today is usable for 1 of 8 live kits**, and blocked for the other 7 until each has a concept
  set.

## 7. Rough blast radius, before any fix is decided

| tier | what | evidence |
|---|---|---|
| 🔴 **confirmed** | **Concept generation.** Blocks video scripts, the ad-copy concept axis (unstamped `conceptId`, `adCopyGenerator.ts:739-747`) and the Meta concept assembly | measured on production |
| 🔴 **probable** | **Landing-page angles**: the largest stored angle is at the ceiling | stored-size proxy; truncation count unmeasurable |
| 🟠 **possible** | **Bonus and lead-magnet bodies**: near the ceiling, raw output above stored | proxy + item-15 measurements (4,466–5,174 tokens, not cut off) |
| ❓ **unknown** | **ICP**: stored output larger than one call can emit; the call split is not traced | proxy |
| 🟢 **low** | email, WhatsApp, offers, headlines, ad copy, concept scripts, mechanisms per call | measured or proxy, well under |
| ⚠️ **shared exposure** | any fix that lengthens calls interacts with the 5-min fetch abort (§4.2) and the reaper race (§5), including this package's own script batch (§5 #2) | code read + timing estimate |

## 8. Evidence gaps, stated so they are not mistaken for findings

- **No production-wide count of `max_tokens` hits exists or can be recovered from logs** (§3).
- The chars-per-token calibration rests on **n = 2** points.
- Tokens/s is estimated from harness timestamps, not measured per call.
- The sweep's rows other than the concept generator and landing pages were not individually re-read.
