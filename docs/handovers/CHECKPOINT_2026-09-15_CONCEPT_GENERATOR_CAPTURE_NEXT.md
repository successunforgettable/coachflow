# 🟢 RESUME POINT — 2026-09-15: video scripts live; concept generator mid-investigation; kit 187 capture authorised, NOT run

**Written so a fresh terminal resumes from exactly this point with nothing lost.** Every figure was **measured at write time,
2026-09-14 21:48 UTC** (2026-09-15 03:18 local) unless it says otherwise (§15f). Read this file first, then act.

---

## 0. THE THIRTY-SECOND VERSION

| | |
|---|---|
| **production** | **`87596d7`, Railway SUCCESS** (build 2026-09-14T21:11:33Z). Video scripts live and browser-proven |
| **held branch** | `docs/held-2026-09-12` HEAD **`1befc9a`** = production + 4 docs-only commits. Clean fast-forward, no stills, no exclusion step |
| **stills** | only on **`personal/dab-stills` = `2562e64`** (plus a backup ref). Local only, not on origin |
| **closed** | video-scripts package · item 15 (⚠️ two follow-ons were never run, §3.2) · held-branch stills drift |
| **open, nothing built** | shared `llm.ts` 8,192 ceiling · concept-generator truncation · concept re-arm race |
| 🟡 **AUTHORISED, NOT EXECUTED** | (1) kit 187 read-only gate capture · (2) correct the two false code comments |
| **not decided** | the reaper-race fix direction · the shared `llm.ts` fix · Tool Library navigation · bonus-34/43 follow-ons |
| **next step** | §7: verify ground truth → run the kit 187 capture (choose harness vs dry-run first, §5.1) → fix the comments → decide the concept-generator fix shape |

🔴 **PUSHING `railway-build` IS THE DEPLOY.** Nothing is waiting to deploy. The held branch is 4 docs-only commits.

---

## 1. PRODUCTION

| | measured |
|---|---|
| deployed | **`87596d7`**, status **SUCCESS**, build created 2026-09-14T21:11:33Z. The previous deploy `9156875` is REMOVED |
| `origin/railway-build` | `87596d7` |
| `origin/main` · local `main` | `67517e3` · `67517e3` (untouched) |
| deploy contents | 33 commits: all held-branch work **except the stills commit `2562e64`**, which Arfeen excluded. The last three were cherry-picked (`7adb428→eab4feb`, `9102140→8d1bdd1`, `4a89ea9→87596d7`) |

### Video scripts, verified live (Arfeen's Chrome, signed in as user 1, 2026-09-14 21:18–21:20 UTC)

**The page:** `https://zapcampaigns.com/v2-dashboard/wizard/adCopy?serviceId=318` (kit 225) → **🎬 Video** tab.

**What it showed:**
- the new caption, *"Optional — generate talk-to-camera video scripts, one for each of your ad concepts."*;
- **"8 of 8 scripts written"**, and a full script (hook, scenes, on-screen text, delivery notes, teleprompter);
- **0 × "Coming Soon"** and **0 × "Video Creator"** in the rendered page.

**Bundle markers** (`index-Cw5P3O25.js`):
- new caption 1;
- "Generate the missing scripts" 2;
- the old caption 0;
- "Video Creator — Coming Soon" 1 — the untouched V1 `/video-creator` page.

**Where the proof is kept:**
- **full record:** `docs/handovers/VIDEO_SCRIPTS_CLOSING_SUMMARY_2026-09-14.md` §6;
- **screenshots:** sent in the session and copied to this session's scratchpad `deploy-proof-87596d7/`. **The scratchpad is
  session-temporary; the §6 record is the durable one.**

### Production data relevant to open work (read-only)

| table | measured |
|---|---|
| `campaignConcepts` | **8** rows, all ICP **291** (kit 225) |
| `conceptScripts` | **8** rows, **1** set |
| `jobs` | `concepts-icp-249` **failed** (created 18:34:04) · 8 × `script-concept-*` **complete**. ⚠️ **A daily cleanup deletes job rows older than 24 h** (`server/_core/index.ts:275-289`), so these vanish after about 2026-09-15 18:34 UTC. Do not rely on them |
| `product_events` since the 2026-09-12 wipe | **1** (21:18:40, this session's browser proof). **No coach activity since the wipe** |
| kits (measured 2026-09-14) | 22 in total: **14 orphaned** (ids 204–218; their ICPs were deleted in the wipe) + **8 live**, of which only kit 225 has concepts |

---

## 2. BRANCHES — measured, with two corrections to the brief this was written from

| ref | hash | what it is |
|---|---|---|
| **`docs/held-2026-09-12`** (HEAD) | **`1befc9a`** | production `87596d7` + 4 docs-only commits (0 non-doc files) |
| `origin/docs/held-2026-09-12` | `6d88070` | an ancestor of `87596d7`, so a future push of the held branch is a fast-forward with no force |
| `origin/railway-build` | `87596d7` | = production |
| `deploy/railway-build-2026-09-15` | `87596d7` | the exact commit pushed on 2026-09-15 |
| **`personal/dab-stills`** | **`2562e64`** | the DAB stills commit with its original history. **Never merge into a ZAP branch** |
| `backup/held-2026-09-12-pre-cleanup` | `752f7bf` | the held tip before the cleanup (it contains the stills). Delete once satisfied |
| local `railway-build` | `aa9209b` | **stale. Never push from it** |
| local `main` | `67517e3` | untouched |

**The held branch's commits over production, oldest first:**

| commit | what |
|---|---|
| `7f07b96` | post-deploy docs: video scripts deployed + browser-proven; Tool Library corrections; the Tool Library unscoped item |
| `591f0a9` | restart block: held branch rebuilt as a fast-forward; stills moved to `personal/dab-stills` |
| `62b1a09` | investigation: the shared 8,192 ceiling + the reaper sweep (`INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md`) |
| `1befc9a` | investigation: the concept generator split + the re-arm race (`INVESTIGATION_CONCEPT_GENERATOR_SPLIT_AND_REARM_2026-09-15.md`) |
| *(next)* | this checkpoint |

⚠️ **Correction 1:** the brief said the held branch was "rebuilt clean at `62b1a09`". **The rebuild is `7f07b96`** (production +
the post-deploy docs commit), recorded by `591f0a9`. `62b1a09` is the first investigation commit on top of it.

⚠️ **Correction 2:** the brief put the token-cap/reaper investigation at `1befc9a`. **`1befc9a` is the concept-split / re-arm
investigation**; the token-cap / reaper-sweep investigation is `62b1a09`. Both are committed locally.

**Working tree:** 0 uncommitted tracked changes · **322 untracked** (screenshots and plates, in no commit). **Never `git add .`**

**How to deploy next time (only with Arfeen's go-ahead):** `git push origin docs/held-2026-09-12:railway-build`, no force. It is a
plain fast-forward with **no exclusion step**. Docs-only commits stay held until the next code push (the standing rule).

---

## 3. COMPLETED AND CLOSED

### 3.1 · Video scripts — the moderate build ✅ CLOSED (live, browser-proven)

**What shipped:**
- `generateScriptForConcept` is made reachable.
- **Batch owner:** `ensureScriptsForIcp` (`server/conceptScriptBatch.ts`, pure core `server/_core/scriptBatch.ts`) — one
  `scriptSetId` per set, one job row per concept, abort on a claim collision, no-kit guard.
- **Router:** `server/routers/conceptScripts.ts`.
- **Screen:** `client/src/v2/V2ConceptScripts.tsx`, which waits on concept rows rather than job status.
- **Lengths:** tiered by awareness stage from the research table, capped at 60 s (`activeLengthForStage`, `conceptAxis.ts`).
- `V2VideoCreator.tsx` is left intact and unmounted.

**The Tool Library correction:**
- **The Tool Library was never a live entry point:** `V2Dashboard` imports `V2ToolLibrary` and never renders it.
- **The claim is struck, visibly and dated,** from all four handover docs (scoping, proposal, build record, closing summary),
  plus `docs/LAUNCH_READINESS_AUDIT.md`.
- **The only live entry point is Ad Copy node → Video tab.**

**Records:**
- `VIDEO_SCRIPTS_BUILD_2026-09-14.md`
- `VIDEO_SCRIPTS_CLOSING_SUMMARY_2026-09-14.md` (§6 = deploy + browser proof)
- `ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md`

**Logged leftovers, not in scope:**
- a stale *"Script: Free · Render: Credits"* sub-label under the Ad Copy tabs;
- the Tool Library navigation decision;
- this package's own reaper tail risk: if one concept's script generation ever ran over 5 min, "Generate the missing
  scripts" could re-arm a live row (investigation §5 #2).

### 3.2 · Item 15 — bonus-page fabrication ✅ CLOSED (per Arfeen, 2026-09-15)

- bonus-35 closed as a confirmed node defect, root cause unconfirmed:
  `docs/handovers/ITEM15_2026-09-14_BONUS35_CLOSING_SUMMARY.md` (it carries the corrected wording).
- ⚠️ **Recorded so it is a visible choice, not a lost task:** the **bonus-34 (declares 12 prompts, delivers 9)** and **bonus-43
  (declares 5 steps, delivers 3)** declared-count follow-ons named in that summary **were never executed**.
  - Both pages are live with the mismatch.
  - Fixing either is a production write needing an explicit go-ahead.
  - They are not scheduled.

### 3.3 · Held-branch stills drift ✅ RESOLVED

- The stills commit `2562e64` lives only on `personal/dab-stills`; all 25 files are verified byte-identical there.
- The held branch was rebuilt from the deployed state.
- `origin/railway-build` is an ancestor of the held branch, and `2562e64` is not in its history. **No future ZAP deploy
  needs a manual exclusion step.**

---

## 4. OPEN — mid-investigation, NOTHING BUILT

### 4.1 · The shared `llm.ts` output ceiling

Record: `INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md`.

**What is confirmed:**
- **The ceiling:** `server/_core/llm.ts:428` hardcodes `max_tokens: 8192` on the only production path. `maxTokens` is declared
  (`:63-64`) and read nowhere.
- **Truncation is silent:** `finish_reason` is returned, and no caller reads it.
- **Callers that set a cap:** 6 of 54 call sites, all asking for less than 8,192. The concept generator's own 4,000 is below
  its real output (about 7,800), so **honouring caps as written would break it**.

**Proxy measure:** landing-page angles sit at the ceiling (≈ 8,300); bonus and lead-magnet bodies near it.

**What a fix could break:** a raised ceiling means longer calls, which meet the **5-minute fetch abort** (`llm.ts:445`), and
landing pages / ad copy then rerun the whole generation.

### 4.2 · Concept-generator truncation

Record: `INVESTIGATION_CONCEPT_GENERATOR_SPLIT_AND_REARM_2026-09-15.md` §A.

- **The size:** one call asks for **12 concepts** (1.5× over-generation, about 650 tokens each). The whole-set retry is what
  hits 8,192.
- **A split looks feasible inside the generator.** Only ONE rule is set-level (desire × awareness distinct), and the subset
  machinery already runs in production (`buildConceptPrompt` `planOverride` + `existingDesires`, used by the top-up).
  **HIGH confidence** that it removes the truncation without touching `llm.ts` or the reaper.
- 🔴 **NOT proven to fix kit 187.** Its attempt 1 was a **clean 7,892-token response REJECTED by the gate, with unlogged labels.**
  That may be a systematic content rejection, independent of truncation.

### 4.3 · The concept re-arm race

Record: same file §B, plus the reaper sweep in `INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md` §5.

**The defect:** `ensureConceptsForIcp` (`conceptGenerator.ts:643`) re-arms a failed job **without resetting `created_at`**.
**Reproduced live on production** (kit 187, run 2): the re-armed job read failed at **+1.1 min** while its generation was alive.

**How often it fires:** on every `ensureCampaignKit`, about 10–11 triggers per cascade.

| case | consequence |
|---|---|
| generation over 5 min | duplicate generations; a late duplicate **replaces the set**, which **cascade-deletes concept scripts** and **nulls adCopy / adCreatives concept stamps** |
| deterministic failure | **every trigger re-runs a full doomed generation** (measured: 9,507 input + 16,084 output tokens, zero concepts) |

**Spend today: none** (no coach activity since the wipe). **It starts on the first real cascade.**

---

## 5. 🟡 AUTHORISED BUT NOT YET EXECUTED — THE VERY NEXT STEP

Authorised by Arfeen on 2026-09-15, in the message that commissioned this checkpoint.

### 5.1 · Kit 187 read-only gate capture

- **Target:** ICP **249** · kit **187** · smoke user **117174** · service **272**.
- **Purpose:** one fresh concept generation, run through the gate, **logging the actual rejection labels and failure context.
  WRITE NOTHING TO THE DATABASE.**
- **What it decides:**
  - **truncation** → fixable by the split (§4.2);
  - **systematic gate rejection** → a different problem, so identify the class.

⚠️ **Pre-flight finding, measured at write time — there is NO non-persisting path today:**
- `generateConceptsForIcp` **always** deletes and inserts the set (`server/conceptGenerator.ts:522-541`).
- The gate is a **closure** inside it (`:287`), not exported. `CONCEPT_JSON_SCHEMA` (`:152`) is not exported either.
- **Exported pieces:**
  - `buildConceptPrompt` (`conceptGenerator.ts:57`);
  - `validateConceptSetStructure` (`server/_core/conceptValidator.ts:84`);
  - `screenConceptCompliance` (`conceptValidator.ts:180`);
  - `checkOutput` (`server/_core/complianceAxis.ts:1234`), with grounding from `buildCoachCorpus` / `buildProofSupplied`.
- 🔴 **Do NOT use the product path.** `ensureConceptsForIcp`, `conceptScripts.generateForIcp` and `generateConceptsForIcp`
  all WRITE (a job row and concept rows).
- **First decision of the capture:**
  - **(i)** a scratch harness that rebuilds the gate from the exported pieces (the schema must be copied or exported); or
  - **(ii)** a dry-run option added to `generateConceptsForIcp`, which is a code change.

  Either way, production must record **zero writes**.
- **Discipline:**
  - whole-database snapshot (`dbsnap2.py`, `docs/handovers/REGEN_RUNBOOK_2026-09-11.md` §2) immediately before and after,
    **expecting 0 changes**;
  - target guard: `@@version_comment` = *MySQL Community Server - GPL*;
  - spend: LLM tokens only (about 10–16k output per attempt set).

### 5.2 · Correct or flag the two confirmed-false code comments, in the same pass

| file:line | the comment | why it is false |
|---|---|---|
| `server/routers/campaignKits.ts:164` | *"repeat calls cost one indexed SELECT each and nothing more."* | true only while the concept set exists or a job is `pending`. **Once a concept job has failed, each call re-arms it and pays for a full generation** |
| `server/conceptGenerator.ts:602-603` | *"…generateConceptsForIcp itself deletes-then-inserts per ICP, so even a lost race cannot produce a doubled set."* | the delete (`:522`) and the insert (`:523`) are two statements **with no transaction**; two finishing generations could interleave. A hypothesis, not observed; the claim is still unsupported |

**Rules for this pass:**
- Correct the comment text only (CLAUDE.md §15i / §15j): **remove no defence, change no behaviour.**
- Commit on the held branch; it is not deployed until the next code push.
- Specifics: the investigation doc §B.

---

## 6. EXPLICITLY NOT YET DECIDED — do not pick without the reading below

1. **The reaper-race fix direction.**
   - **(a) Reset `created_at` on re-arm:** narrows the race; does NOT stop the first reap of a generation over 5 min.
   - **(b) Exclude concept jobs from the reaper:** closes duplicates; opens a permanent stall when a deploy kills a
     generation.
   - **Neither addresses the deterministic-failure repeat.**
   - **Coupling:** if the split brings generation under the 5-minute window, the race shrinks on its own.
   - ⚠️ **Re-read the coupling analysis first.** It lives mainly in
     **`INVESTIGATION_CONCEPT_GENERATOR_SPLIT_AND_REARM_2026-09-15.md` §B** ("Is a fix for just this separable" and "In effect:
     COUPLED"). Read it together with **`INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md` §4** (what a fix could break) and
     **§5** (the sweep). The brief named only the second file; the (a)/(b) trade-off table and the coupling conclusion are in
     the first.
2. **The shared `llm.ts` fix:** honour caps or raise the ceiling. Blocked on §4.1's break analysis.
3. **The concept-generator fix shape:** a split, or something else. **Decided by the §5.1 capture result.**
4. **The Tool Library:** make it reachable or remove the dead import and button (`ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md`).
5. **The bonus-34 / bonus-43 declared-count follow-ons** (§3.2).

---

## 7. NEXT SESSION — FIRST STEPS, IN ORDER

1. **Verify ground truth** against these values:
   ```
   git fetch origin && git rev-parse --short HEAD origin/railway-build origin/docs/held-2026-09-12 personal/dab-stills
       # expect: this checkpoint's commit (child of 1befc9a) · 87596d7 · 6d88070 · 2562e64
   git merge-base --is-ancestor origin/railway-build HEAD && echo fast-forward-ok
   git merge-base --is-ancestor 2562e64 HEAD || echo stills-absent-ok
   git status --porcelain --untracked-files=no          # expect nothing
   npx tsc --noEmit 2>&1 | grep -c "error TS"            # expect 34
   railway deployment list --service coachflow --environment production --json | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(d['status'], d['meta']['commitHash'][:7])"
       # expect: SUCCESS 87596d7
   ```
2. **Run the kit 187 read-only capture** (§5.1, authorised). Choose harness vs dry-run first, snapshot before and after, target
   guard on, **0 database changes**.
3. **Correct the two false comments** (§5.2, authorised), in the same pass.
4. **Decide the concept-generator fix shape** from the capture.
   - Truncation → the split.
   - Systematic gate rejection → name the class and scope that problem instead.
5. **Only then take up the reaper-race direction.** Re-read the coupling analysis first (§6.1).

---

## 8. HARD GATES — unchanged

- **Every production write needs an explicit go-ahead in the immediately preceding message.** Show the prepared statement and
  hold.
- **Pushing `railway-build` IS the deploy.** Never push `main`. Never push from the stale local `railway-build`.
- **Never `git add .`:** 322 untracked files. Add named paths.
- **Screenshots come from Arfeen's browser.** No Cloudinary purge calls.
- **Never merge `personal/dab-stills` into a ZAP branch.**
- **Reserved-word and snake_case traps** seen this session: `campaignConcepts.longText`, `idealCustomerProfiles.values`,
  `angle_name`, `jobs.created_at`.

## 9. WHAT A STRAY COMMAND DESTROYS

| command | what it destroys |
|---|---|
| **`git reset --hard origin/railway-build`** or a re-clone | the 4 held docs commits (+ this checkpoint), which exist **only on this machine** (origin held is `6d88070`) |
| **deleting `personal/dab-stills` AND `backup/held-2026-09-12-pre-cleanup`** | **the stills commit `2562e64`: it exists only locally, in those two refs, and not on origin** |
| **`git clean -fd`** | 322 untracked files, including the DAB stills plates under `docs/screenshots/dab-creator-stills-2026-09-14/` |

**Time-limited evidence:** the `jobs` rows for kit 187 / kit 225 are auto-deleted after 24 h (§1).

## 10. RECORDS INDEX

| topic | file |
|---|---|
| video scripts: build · closing (§6 deploy proof) · proposal · scoping | `VIDEO_SCRIPTS_BUILD_2026-09-14.md` · `VIDEO_SCRIPTS_CLOSING_SUMMARY_2026-09-14.md` · `PROPOSAL_VIDEO_SCRIPTS_MODERATE_2026-09-14.md` · `SCOPING_VIDEO_SCRIPT_GENERATOR_GAP_2026-09-14.md` |
| shared ceiling + reaper sweep | `INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md` |
| concept split + re-arm race (**the coupling analysis**) | `INVESTIGATION_CONCEPT_GENERATOR_SPLIT_AND_REARM_2026-09-15.md` |
| unscoped items | `ITEM_CONCEPT_GENERATOR_TRUNCATION_UNSCOPED_2026-09-14.md` · `ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md` |
| item 15 | `ITEM15_2026-09-14_BONUS35_CLOSING_SUMMARY.md` · `CHECKPOINT_2026-09-14_ITEM15_BONUS35_NODE_DEFECT_PENDING_CLOSE.md` |
| stills (on `personal/dab-stills` only) | `docs/handovers/DAB_STILLS_2026-09-14_OVERNIGHT.md` |
| snapshot tool + SQL runner | `REGEN_RUNBOOK_2026-09-11.md` §2 |
