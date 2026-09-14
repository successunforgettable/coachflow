# 🟢 RESUME POINT — 2026-09-15 (b): Thread A capture 2 authorised, not run · Thread B follow-up NOT RECEIVED

**Supersedes `CHECKPOINT_2026-09-15_CONCEPT_GENERATOR_CAPTURE_NEXT.md` (commit `92948f3`),** which is retained and marked
superseded. Written so a fresh terminal resumes from exactly this point with nothing lost.

**Every figure was measured at write time, 2026-09-14 22:11 UTC** (2026-09-15 03:41 local), unless it says otherwise (§15f).
Read this file first, then act.

---

## 0. THE THIRTY-SECOND VERSION

| | |
|---|---|
| **production** | **`87596d7`, Railway SUCCESS.** Video scripts live and browser-proven |
| **held branch** | `docs/held-2026-09-12` HEAD **`82d1949`** (+ this checkpoint) = production + docs + **ONE undeployed code change** (the concept generator `dryRun`/`onGate`) |
| **stills** | only `personal/dab-stills` (`2562e64`) and the backup ref. In no ZAP branch, not on origin |
| **closed** | video scripts (deploy verified) · item 15 (⚠️ bonus-34 and bonus-43 still live with count mismatches) · stills drift |
| **Thread A** (token cap / concept generation) | dry-run tool built and proven · capture 1 truncated before the gate · 🟡 **capture 2 AUTHORISED, NOT RUN** · 🟡 **two false comments AUTHORISED (twice), NOT DONE** |
| **Thread B** (script quality) | measurement done (§6.1). 🔴 **The follow-up (grounding check + fix scoping) was NEVER RECEIVED by CC.** Not started, nothing running |
| **next step** | §8: verify → **re-issue Thread B** (no response exists) → capture 2 + the comments → decide priority |

🔴 **PUSHING `railway-build` IS THE DEPLOY.** The held branch now carries a code change (§2). **Pushing it would deploy it.**

---

## 1. PRODUCTION

| | measured |
|---|---|
| deployed | **`87596d7`, SUCCESS** (build 2026-09-14T21:11:33Z); the previous `9156875` is REMOVED |
| GitHub | `railway-build` `87596d7` · `docs/held-2026-09-12` `6d88070` · `main` `67517e3`. **Nothing pushed beyond `87596d7`** |
| video scripts | live at Ad Copy node → 🎬 Video tab. Proven in Arfeen's browser (kit 225, 8/8 scripts, 0 × "Coming Soon"). Record: `VIDEO_SCRIPTS_CLOSING_SUMMARY_2026-09-14.md` §6 |

### Production data (read-only, 22:11 UTC)

| table | rows |
|---|---|
| `campaignConcepts` | 8 (ICP 291 only) |
| `conceptScripts` | 8 in 1 set (kit 225) |
| `jobs` | `concepts-icp-249` failed (created 2026-09-14 18:34:04) · 8 × `script-concept-*` complete |
| `product_events` since the 2026-09-12 wipe | 1 (this session's browser proof). **No coach activity since the wipe** |

### ⚠️ Correction — the job-row expiry has NOT passed

The brief assumed "~18:34 UTC on 2026-09-15 has likely passed". **At measurement it was 2026-09-14 22:11 UTC.** The local clock
reads 2026-09-15; UTC does not.

- **The kit 187 and kit 225 job rows are all still present.**
- **How the cleanup works:** a `setInterval` every 24 h from process boot deletes job rows older than 24 h
  (`server/_core/index.ts:275-289`). This deploy booted about 2026-09-14 21:12 UTC, so the first sweep is about
  **2026-09-15 21:12 UTC**, and **every deploy restarts that clock**.
- **It is no longer relevant to Thread A:** the dry-run capture path uses no job rows.

---

## 2. BRANCHES (measured)

| ref | hash | what it is |
|---|---|---|
| **`docs/held-2026-09-12`** (HEAD) | **`82d1949`** | production + 6 commits (+ this checkpoint) |
| `origin/docs/held-2026-09-12` | `6d88070` | an ancestor, so a future push is a fast-forward with no force |
| `origin/railway-build` · `deploy/railway-build-2026-09-15` | `87596d7` | = production |
| **`personal/dab-stills`** | **`2562e64`** | stills. **Not on origin** (0 remote refs). **Never merge into ZAP** |
| `backup/held-2026-09-12-pre-cleanup` | `752f7bf` | the old held tip. It also contains `2562e64`. Delete once satisfied |
| local `railway-build` | `aa9209b` | stale. Never push from it |
| `main` / `origin/main` | `67517e3` | untouched |

**Only two branches contain `2562e64`:** `personal/dab-stills` and the backup ref. The held branch does not.

### The held branch's commits over production, oldest first

| commit | what | type |
|---|---|---|
| `7f07b96` | video scripts deployed + browser-proven; Tool Library corrections | docs |
| `591f0a9` | held rebuilt as a fast-forward; stills moved off | docs |
| `62b1a09` | investigation: the shared 8,192 ceiling + the reaper sweep | docs |
| `1befc9a` | investigation: concept split + the re-arm race | docs |
| `92948f3` | the previous checkpoint (now superseded) | docs |
| **`82d1949`** | **`dryRun` + `onGate` on `generateConceptsForIcp`; the kit 187 capture record** | **CODE**: `server/conceptGenerator.ts`, `server/conceptGeneratorDryRun.test.ts`, `server/scripts/concept-dry-run-capture.ts` |

- 🔴 **The held branch is no longer docs-only.** A push to `railway-build` would deploy the `dryRun`/`onGate` addition. It is
  inert unless a caller passes `dryRun` or `onGate`, and it is proven (§5.1), but **it is a deploy and needs a go-ahead**.
- **Working tree:** 0 uncommitted tracked changes · **322 untracked** (never `git add .`).

---

## 3. FULLY CLOSED

| item | state | record |
|---|---|---|
| **Video scripts** (the moderate build + deploy) | ✅ closed. Live and browser-verified. The Tool Library was never an entry point; that claim is struck with dated banners in 4 docs + the audit | `VIDEO_SCRIPTS_BUILD_2026-09-14.md` · `VIDEO_SCRIPTS_CLOSING_SUMMARY_2026-09-14.md` |
| **Item 15** (bonus-page fabrication) | ✅ closed, **with two known unresolved LIVE defects** (below) | `ITEM15_2026-09-14_BONUS35_CLOSING_SUMMARY.md` |
| **Held-branch stills drift** | ✅ resolved | `591f0a9` |

### ⚠️ Item 15: two live defects still flagged

**Fixing either is a production write, and the go-ahead has NOT been given.**

| page | defect |
|---|---|
| **bonus-34** | the brief tool declares **12 prompts, delivers 9** (Section 4 empty; other tools send the reader to "Prompt 10/11") |
| **bonus-43** | the SOP tool "(5 Steps)" **delivers 3** (other tools send the reader to "Step 4c/5") |

---

## 4. LOGGED, UNSCOPED — carried forward, not active

| item | record |
|---|---|
| **Tool Library** is unreachable in the product (a navigation decision) | `ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md` |
| a stale *"Script: Free · Render: Credits"* sub-label under the Ad Copy tabs | — |
| the **shared `llm.ts` ceiling** decision (honour caps / raise the ceiling) | `INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md` |
| the **reaper-race fix direction**: (a) reset `created_at` vs (b) exclude concept jobs | **re-read the coupling analysis first:** `INVESTIGATION_CONCEPT_GENERATOR_SPLIT_AND_REARM_2026-09-15.md` §B + the token-cap doc §4–5 |

---

## 5. THREAD A — the token cap and concept generation, now with a working diagnostic

### 5.1 · Built and proven: the dry run on the REAL generator

Commit `82d1949`. Record: `docs/handovers/CAPTURE_KIT187_CONCEPT_DRY_RUN_2026-09-15.md`.

**What it is:**
- **`dryRun?: boolean`** on `generateConceptsForIcp`: one early return immediately before the only write.
- **`onGate?`:** an observer of each existing gate verdict and each generation error; a no-op when absent.
- **Diff vs `87596d7`:** 55 lines added, 2 removed. The 2 removed lines are the loop's `invokeConcepts` calls, now routed
  through `generateAttempt`, which makes the same call and re-throws unchanged. The gate, retries, partial delivery, trim,
  top-up and the write are untouched.

**Proven:**
- **Pinned** by `server/conceptGeneratorDryRun.test.ts`, 5 tests: one gate definition; the return after every gate call and
  before the only delete and insert; no validation of its own; the observer is never a verdict.
- **3 mutations each fail the pins:** the return moved after the write, a second gate, the branch calling `gate()`.
- **Gates:** tsc 34 · dry-run 5 · conceptGenerator 12 · complianceGate 24 · fabricationGateDefects 15 · conceptAxis 20 ·
  scriptBatch 15 · validator 8 · pipeline-fixes 414 · complianceFilter 31 · tokenCrypto 10.
- **Parity:** the gate, validator, compliance-axis and `llm.ts` files are byte-identical to the deployed `87596d7`.

### 5.2 · Capture 1 — kit 187, 2026-09-14 22:02 UTC

**Target:** user 117174 · ICP 249 · service 272.

- **Result:** **attempt 1 was truncated at `max_tokens` (in 4,427 / out 8,192) at +187 s, BEFORE the gate.** No verdict, no
  labels. *"Concept generation returned no concepts array."*
- **Zero writes:** whole-database snapshots before and after show **no change in any of 58 tables**, including
  `CHECKSUM TABLE`.
- **New finding, a harder failure than previously understood:** **a truncated response is never retried.** The throw escapes
  `generateConceptsForIcp`, because the retry loop regenerates only on a *gate* failure. One truncation ends the generation:
  **no second attempt, no partial delivery, no top-up.**
- **Profile 249's first attempts so far: 7,754 · 7,892 · 8,192 (truncated).** Consistently at or against the ceiling.
- **STILL UNANSWERED:** why the gate rejected profile 249's earlier *complete* response (7,892 tokens, run 2). No run has
  recorded the labels.

### 5.3 · 🟡 AUTHORISED, NOT YET RUN

**(1) Capture 2 — the same dry run on kit 187, to catch a first attempt under the ceiling and log the gate's actual rejection.**
- **Authorised** by Arfeen on 2026-09-15, in the message commissioning this checkpoint.
  - *Record correction:* the capture record `CAPTURE_KIT187_CONCEPT_DRY_RUN_2026-09-15.md` §3 listed it as "proposed, pending
    a go-ahead". **That go-ahead is now given.**
- **Command:** the same harness, the same discipline:
  ```
  # target guard (expect "MySQL Community Server - GPL") + dbsnap2.py before (REGEN_RUNBOOK_2026-09-11.md §2)
  railway run --environment production --service coachflow sh -c 'USER_ID=117174 ICP_ID=249 SERVICE_ID=272 OUT=<dir> npx tsx server/scripts/concept-dry-run-capture.ts'
  # dbsnap2.py after → diff → expect NO CHANGE in 58 tables
  ```
- **Expect either outcome:**
  - roughly 1 in 3 first attempts measured so far has truncated. **A second truncation is a result, not a failure:** record it
    and report the count.
  - An under-ceiling attempt yields `labels` and `failContext` in the observer record; **those are the answer**.
- **Cost:** about 3–8 min; LLM tokens only; zero writes.

**(2) Correct the two confirmed-false code comments.** **Authorised twice; still not done. Do it alongside capture 2.**

| file:line (measured) | the comment | why it is false |
|---|---|---|
| `server/routers/campaignKits.ts:164` | *"repeat calls cost one indexed SELECT each and nothing more."* | true only while the set exists or a job is `pending`. **Once a concept job has failed, each call re-arms it and pays for a full generation** |
| `server/conceptGenerator.ts:655-656` | *"…so even a lost race cannot produce a doubled set."* | the delete and the insert are two statements **with no transaction**. A hypothesis, not observed; the claim is unsupported |

**Rules:**
- **Comment text only** (§15i / §15j): remove no defence, change no behaviour.
- Commit on the held branch. The line numbers shifted after `82d1949`, so locate each comment by its quoted text.

---

## 6. THREAD B — script quality. Measurement done; 🔴 the follow-up NEVER ARRIVED

### 6.1 · Done: the quality measurement

This was reported in chat on 2026-09-15 and **existed in no file until this checkpoint.**

**Compared:** kit 225's 8 generated scripts (`conceptScripts`, set `60731b15…`, concepts 223–230) against the 9 human-written
creator scripts in `docs/andromeda/worked-examples/final-shoot-2026-09-10/nine-creator-scripts-attendee.md` ("Measured" table).

#### Instrument (published parameters, script-rule-spec.md §3.2 rule 7)

| parameter | value |
|---|---|
| words | whitespace tokens |
| sentences | split on `.` `!` `?` + whitespace, and on line/paragraph breaks |
| hook | the first sentence's words |
| contractions | per 100 words: tokens matching `letters'letters`, apostrophes straight or curly, possessive 's included |
| SD | sample SD of words per sentence |
| overlap | content-word Jaccard: stoplist and min length 3 per spec §3.2, apostrophes retained |

#### Control: the instrument reproduces the benchmark's own table

| metric | match |
|---|---|
| words, hook | exact, 9/9 |
| longest sentence | exact 6/9 |
| SD | mean \|Δ\| 0.11 |
| contractions | mean \|Δ\| 0.78 (so treat a contraction gap under ~1 as noise) |
| overlap | 27.4 max / 16.9 mean, against the published 26.0 / 17.0 |

#### Results (set means, with ranges)

| metric | 9 human | 8 generated |
|---|---|---|
| contractions / 100 words | 5.9 (3.9–7.9) | **4.0** (1.8–6.3) |
| **longest sentence** | 15.8 (13–18) | **25.2 (14–32)** · 6 of 8 exceed the human max of 18 |
| sentence-length SD | 4.6 | 7.4 (driven by long sentences, not rhythm) |
| mean sentence | 7.8 | 11.8 |
| **hook (first sentence)** | 7.6 (4–10) | **16 (5–31)** · 5 of 8 over the spec's 10 |
| **cross-script overlap max / mean** | 27.4% / 16.9% | **39.4% / 27.4%** |
| 4-grams in 3+ scripts | 16 (the deliberate shared "free session this Sunday" tail) | **29** |

#### The three confirmed problems

1. **Long written-register sentences** in the 60 s scripts (up to 32 words). Spec §1.4 (hook ≤ 10), §1.9 (max sentence ~18 +
   SD floor).
2. **Formula repetition across the set.** "first three outreach conversations" appears in 6 scripts; "your former industry
   will (actually) pay for" in 6; "Every quarter … the notes app stays closed" in 4; "Career Layer Excavation Process" in 4;
   "There's a different process/approach" in 6. Spec §2.2 (no 4+-gram in more than two scripts; one canonical mechanism name).
3. **Voice inconsistency:** the coach's "I" and the customer's "I" are mixed. Script 229 is both the 44-year-old returner and
   the builder of the process; 230 speaks as the customer ("my husband"); 223 speaks as the coach ("working with women coming
   back").

**Lines quoted as natural:** 224 *"Someone asks what you do. And you hear yourself start a sentence you don't finish. Again."* ·
228 *"You open LinkedIn, you find the name, and then you close the app. Every single time."*

### 6.2 · 🔴 THE FOLLOW-UP WAS NEVER RECEIVED — not "awaiting a response"

The brief for this checkpoint says a second prompt was sent to CC, asking it to:

- **(1) Check grounding:** are script 229's personal details grounded in anything the coach supplied, or fabricated? Check
  across all 8 scripts;
- **(2) Scope fixes** for the three quality problems, each mapped to the unenforced rules in `script-rule-spec.md`.

**That prompt did not reach this session.** Nothing was started, and no background agent or task is running it. The only agent
this session launched, the reaper sweep, completed earlier. **There is no response to check for. Re-issue the prompt.**

#### What the grounding check needs (so the next session can start immediately)

**Details to verify against the coach's material:**
- **script 229:** "Me at forty-four", "watching my youngest leave for university", "twelve years running procurement for a
  global firm", "since 2021";
- **script 230:** "my husband";
- **script 226:** "twelve years of director-level expertise";
- **all 8:** "twelve years of (real) expertise", "women coming back after a career break", "Career Layer Excavation Process",
  "First Client Blueprint", "90-Day First Client Script", "notes app".

**Where the coach's material lives:** service **318** (kit 225, ICP **291**, user 1). The fabrication gate's corpus is
`buildCoachCorpus({ service, groundingMeta })` (`server/_core/groundingCorpus.ts`), and `idealCustomerProfiles.groundingMeta`
holds the coach's verbatim ladder answers.

**Why it matters beyond style:**
- **All 8 scripts PASSED `checkOutput` with `requireGrounding: true`.** If those details are not in the corpus, **the
  fabrication gate did not catch invented persona details**. That is a §15c / §15k-shaped finding about the gate, not only the
  scripts.
- An invented personal claim in a live ad is a compliance problem, not a style problem. Per Arfeen, **grounding takes priority**
  if these turn out to be fabricated.

**Script text source:** production `conceptScripts` (read-only). The session scratchpad JSON is temporary.

---

## 7. EXPLICITLY NOT DECIDED

1. **The concept-generator fix shape** (a split, or something else). It waits on capture 2's gate labels.
2. **The reaper-race fix direction.** Re-read the coupling analysis first (§4).
3. **The shared `llm.ts` fix.** Concept generation's own 4,000 cap is below its real output, and raising the ceiling meets the
   5-minute abort.
4. **The script-quality fixes.** Waits on Thread B's re-issued investigation.
5. **Fix priority between threads.** Grounding first *if* fabricated.
6. **bonus-34 / bonus-43.**
7. **The Tool Library.**
8. **Whether to deploy `82d1949`'s code change.**

---

## 8. NEXT SESSION — FIRST STEPS, IN ORDER

1. **Verify ground truth:**
   ```
   git fetch origin && git rev-parse --short HEAD origin/railway-build origin/docs/held-2026-09-12 personal/dab-stills
       # expect: this checkpoint's commit (child of 82d1949) · 87596d7 · 6d88070 · 2562e64
   git merge-base --is-ancestor origin/railway-build HEAD && echo ff-ok ; git merge-base --is-ancestor 2562e64 HEAD || echo stills-absent-ok
   git status --porcelain --untracked-files=no      # expect nothing
   npx tsc --noEmit 2>&1 | grep -c "error TS"        # expect 34
   railway deployment list --service coachflow --environment production --json | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(d['status'], d['meta']['commitHash'][:7])"   # SUCCESS 87596d7
   ```
2. **Thread B:** there is **no pending response**. **Re-issue the grounding check + fix-scoping prompt** (§6.2 has the inputs),
   and run the grounding check first.
3. **Thread A:** run **capture 2** (§5.3 (1), authorised) and **correct the two comments** (§5.3 (2), authorised twice), in the
   same pass.
4. **When both report, decide fix priority.** Grounding first if the persona details are fabricated; otherwise weigh the
   concept-generator fix (informed by capture 2) against the script-quality fixes.

---

## 9. HARD GATES — unchanged

- **Every production write needs an explicit go-ahead in the immediately preceding message.** Show the statement and hold.
- **Pushing `railway-build` IS the deploy.** It would now include `82d1949`'s code. Never push `main`. Never push from local
  `railway-build`.
- **Never `git add .`** (322 untracked). Screenshots come from Arfeen's browser. No Cloudinary purge calls.
- **Never merge `personal/dab-stills` into ZAP.**
- **SQL traps seen this session:** `campaignConcepts.longText` and `idealCustomerProfiles.values` are reserved words; also
  `angle_name`, `jobs.created_at`. MySQL `ONLY_FULL_GROUP_BY` rejects non-aggregated expressions.
- **Dry-run discipline:** call `generateConceptsForIcp({ dryRun: true })` directly. **Never** `ensureConceptsForIcp` or
  `conceptScripts.generateForIcp`: those write job rows and concepts.

## 10. WHAT A STRAY COMMAND DESTROYS

| command | loses |
|---|---|
| `git reset --hard origin/railway-build` or a re-clone | the 6 held commits + this checkpoint: **local only**, including the only copy of the dry-run code |
| deleting `personal/dab-stills` AND the backup ref | **`2562e64`, the stills: local only, not on origin** |
| `git clean -fd` | 322 untracked files, including the DAB plates |
| the session scratchpad ending | the capture JSON, the snapshots and the screenshots. **The durable records are the handover docs; the Thread B numbers are durable only in §6.1 of this file** |

## 11. RECORDS INDEX

| topic | file |
|---|---|
| **this resume point** | `CHECKPOINT_2026-09-15_THREADS_A_B.md` |
| the superseded resume point | `CHECKPOINT_2026-09-15_CONCEPT_GENERATOR_CAPTURE_NEXT.md` |
| Thread A: capture 1 + the dry-run build | `CAPTURE_KIT187_CONCEPT_DRY_RUN_2026-09-15.md` |
| Thread A: concept split + re-arm race (**coupling**) | `INVESTIGATION_CONCEPT_GENERATOR_SPLIT_AND_REARM_2026-09-15.md` |
| Thread A: the shared ceiling + reaper sweep | `INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md` |
| unscoped items | `ITEM_CONCEPT_GENERATOR_TRUNCATION_UNSCOPED_2026-09-14.md` · `ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md` |
| video scripts | `VIDEO_SCRIPTS_BUILD_2026-09-14.md` · `VIDEO_SCRIPTS_CLOSING_SUMMARY_2026-09-14.md` · `PROPOSAL_…` · `SCOPING_…` |
| item 15 | `ITEM15_2026-09-14_BONUS35_CLOSING_SUMMARY.md` |
| Thread B: benchmark · rules | `docs/andromeda/worked-examples/final-shoot-2026-09-10/nine-creator-scripts-attendee.md` · `docs/andromeda/script-rule-spec.md` |
| snapshot tool | `REGEN_RUNBOOK_2026-09-11.md` §2 |
