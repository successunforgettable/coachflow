# 🟢 RESUME POINT — 2026-09-16: script-quality + grounding build, sprints 0a · 8 · 1 · 1b · 2 done; 0b next

**Supersedes `CHECKPOINT_2026-09-15_THREADS_A_B.md`**, which is retained and marked superseded. Written so a fresh terminal resumes from
exactly this point with nothing lost.

**Every state figure below was measured at write time** (§15f): git and GitHub via `git fetch` + `git ls-remote`, Railway via
`railway deployment list`, and the production DB via a read-only query at **2026-09-15 22:07:17 UTC** (the local clock reads
2026-09-16). Figures from earlier runs name the run they came from.

---

## 0. THE THIRTY-SECOND VERSION

| | |
|---|---|
| **production code** | **`87596d7`**, Railway `SUCCESS`, deployed 2026-09-14 21:11:33 UTC. GitHub `railway-build` = `87596d7`. **Nothing pushed past it** |
| **production DB** | **59 tables** (migration 0111 added `coachFacts`; **0 rows**) · 3 users · guard `MySQL Community Server - GPL` |
| **held branch** | `docs/held-2026-09-12` local HEAD **= this checkpoint's commit** (child of `7303b99`), **24 commits ahead of production** before this commit. GitHub copy still `6d88070`. **Pushing it deploys CODE** (§2) |
| **gates** | tsc **34** · working tree clean of tracked changes · 322 untracked (never `git add .`) · no worktrees, no stash |
| **Thread A** (token cap / reaper) | **PARKED.** Kit 187 has no working path. Fix shapes NOT decided (§4) |
| **Thread B** (script quality + grounding) | **ACTIVE.** Sprints **0a, 8, 1, 1b, 2 built**; migration 0111 **applied**. D-b wording + retry-note sourcing **approved, ship with sprint 3**. **Next: sprint 0b** (§6) |
| **the plan** | `docs/handovers/BUILD_PLAN_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md`, kept current (§5 holds the decisions and foundation results) |

🔴 **PUSHING `railway-build` IS THE DEPLOY.** Deploy is on **HOLD** by Arfeen: bundle with the next substantive deploy. **Migration 0111 is
already in production, so the code that reads it may ship after it, never before** (already satisfied).

---

## 1. VERIFY GROUND TRUTH FIRST — measure, never read from this file (§15f)

```bash
git fetch origin && git rev-parse --short HEAD origin/railway-build origin/docs/held-2026-09-12 personal/dab-stills
#   expect: <this checkpoint's commit> · 87596d7 · 6d88070 · 2562e64
git ls-remote origin refs/heads/railway-build            # expect 87596d7 (nothing pushed)
git merge-base --is-ancestor origin/railway-build HEAD && echo ff-ok
git merge-base --is-ancestor 2562e64 HEAD || echo stills-absent-ok
git status --porcelain --untracked-files=no                 # expect nothing
npx tsc --noEmit 2>&1 | grep -c "error TS"                  # expect 34
railway deployment list --service coachflow --environment production --json | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(d['status'], d['meta']['commitHash'][:7])"   # SUCCESS 87596d7
# production DB, read-only: SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE();  -- expect 59
#                           SELECT COUNT(*) FROM coachFacts;                                            -- expect 0 (no writer yet)
```

⚠️ **Agent worktrees (`isolation: worktree`) were created at `67517e3` (main), NOT the held branch, every time this session.** Any new
worktree must be checked and reset to the held HEAD before work starts.

---

## 2. THE HELD BRANCH — what a push would deploy

Oldest first, over `87596d7`. **CODE** rows change runtime.

| commit | what | type |
|---|---|---|
| `7f07b96` `591f0a9` `62b1a09` `1befc9a` `92948f3` | video-scripts closing docs; branch rebuild; Thread A investigations; checkpoint | docs |
| `82d1949` | concept generator `dryRun` + `onGate` (Thread A instrument) | **CODE** (inert unless a caller passes `dryRun`) |
| `dd2936c` | checkpoint | docs |
| `54c7555` | two false comments corrected (Thread A) | **CODE** (comments only) |
| `68e041b` `2057135` `e22f03e` `f8a7d77` `949f4a6` `35baeb1` | capture 2, Thread B investigations, proposal, addendum, build plan | docs |
| `dbfe389` | **sprint 0a**: script generator `dryRun` + `onGate`, pinned, capture harness | **CODE** (inert unless a caller passes `dryRun`) |
| `5c2d34e` | **sprint 8**: lexical checker precision | **CODE — changes live compliance verdicts** |
| `51bda65` | NUL byte from sprint 8 replaced with its escape | **CODE** (runtime-identical) |
| `799bd84` | **sprint 1**: `coachFacts` schema + migration 0111 | **CODE** (schema; already applied to production) |
| `41c817c` | **sprint 1b**: `buildCoachFacts` | **CODE** (no production caller) |
| `f0b13b7` `64b2e7c` `1034590` | decisions, migration record, spec §2.2 amendment, D-b investigation | docs |
| `d04a08c` | **sprint 2**: F2 + F5 record-only checker | **CODE** (no production caller) |
| `7303b99` + this checkpoint | checkpoints | docs |

**`personal/dab-stills` (`2562e64`)** is local only, not on GitHub, and not in the held branch. **Never merge it into ZAP.**

---

## 3. CLOSED / SEPARATE

- **Video scripts** (moderate build): closed, live in `87596d7`.
- **Item 15**: closed. **bonus-34** (12 promised / 9 delivered) and **bonus-43** (5 / 3) remain live; fixing either is a production write, and
  no go-ahead has been given.
- **Arfeen's personal Digital Asset Blueprint three-script set is NOT ZAP work.** It kept no file on any ZAP branch. Round 6 was verified
  this session **from pasted text** and passed every check (hooks, 18-word ceiling, ≤ 156 words, overlap, no 3-way 4-gram, no
  allocation language, no implied viewer-finance knowledge, credential consistent). A file
  `~/Downloads/Arfeen_Scripts_FINAL_Verified.docx` exists (seen in a file search) but **was not read or compared**. No action unless
  Arfeen raises it.

---

## 4. THREAD A — token cap / reaper / concept generator — PARKED, unchanged

**Kit 187 (ICP 249) has no working path today.** What is known, from `CAPTURE_KIT187_CONCEPT_DRY_RUN_2026-09-15.md` and
`CAPTURE2_KIT187_CONCEPT_DRY_RUN_2026-09-15.md`:

1. **`llm.ts:428` sends `max_tokens: 8192` whatever the caller asks for.** Profile 249's first attempts measured 7,754 · 7,892 · 8,192
   (truncated) · 7,163.
2. **A truncated response is never retried:** the throw escapes the attempt loop. The script loop behaves the same (sprint 0a finding).
3. **A first attempt that fits was rejected by the gate** (capture 2):
   - **2 × `invented_statistic`, TRUE positives:** "90%", present only in generated ICP prose.
   - **4 × `second_person_protected_attribute`, mostly false positives:** "conviction" read as a criminal record ×2, the idiom "can't afford
     to get this wrong" ×1, and 1 arguably genuine ("an income threshold you can't afford").
   - ⚠️ **Sprint 8 has since fixed the "conviction" and idiom false positives, so capture 2's rejection set is partly stale. Not re-measured.**
4. **The retry, carrying the failContext, truncated in both measured retries (2 of 2).**

**Done on this thread:** the two false comments corrected (`54c7555`).

**NOT decided:**
- the concept-generator fix shape (split, or raise / honour the cap);
- the shared `llm.ts` ceiling;
- the reaper-race direction (reset `created_at` vs exclude concept jobs — re-read the coupling analysis first:
  `INVESTIGATION_CONCEPT_GENERATOR_SPLIT_AND_REARM_2026-09-15.md` §B + `INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md` §4–5).

**Not blocking Thread B, except:**
- any blocking promotion at concepts (sprint 7) waits on the truncation fix;
- D-m (structural check) is sequenced behind it.

---

## 5. THREAD B — script quality + grounding — ACTIVE

**Plan:** `BUILD_PLAN_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md`, with conflicts K1–K11 in §1, sequence in §2, decisions and foundations in §5.
**Supporting records:**
- `PROPOSAL_SPEAKER_FACT_GROUNDING_2026-09-15.md` (F1–F4)
- `ADDENDUM_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md` (F5, cadence, structure, certainty)
- `THREADB_FIX_SCOPING_2026-09-15.md` (P1 / P2)
- `THREADB_GROUNDING_CHECK_2026-09-15.md` (the blind spot)
- `INVESTIGATION_COPYWRITINGRULES_DB_2026-09-16.md` (D-b)

### 5.1 · Built, committed on the held branch, not pushed

Gates re-run on the held branch by the main session, not only by the building agent.

| sprint | commit | what | verified |
|---|---|---|---|
| **0a** | `dbfe389` | `dryRun` + `onGate` on `generateScriptForConcept`; capture harness `server/scripts/script-dry-run-capture.ts` (never run) | tsc 34; 8 files / 497 tests; removing the dry-run block fails 2 of 5 pins |
| **8** | `5c2d34e` | clinical adjacency · "can't afford to" idiom · "conviction" certainty sense · "digital asset(s)" with word-sense guard | 13 checker files; 63 new tests; neutralising `DIGITAL_ASSET_RE` fails 4/63; corpus: 8 verdict changes, all removed clinical false positives |
| **8 fix** | `51bda65` | a raw NUL byte sprint 8 put at `complianceAxis.ts:778` (made the file binary to grep) → escape, runtime-identical | 16 files / 749 tests |
| **1** | `799bd84` | `coachFacts` schema + migration `drizzle/0111_coach_facts.sql` (isolated commit) | **APPLIED TO PRODUCTION 2026-09-15 21:19:49 UTC** on Arfeen's go-ahead: guard passed; table absent before; 58 → 59 tables, diff = exactly one added line; all 58 prior tables unchanged (count, max id, max updatedAt, CHECKSUM); read-back: 12 columns, FK `userId` CASCADE / `serviceId` SET NULL, 3 indexes, 0 rows. Re-measured at write time: 59 tables, 0 rows |
| **1b** | `41c817c` | `buildCoachFacts`: coach-only sources with provenance, supersession, D-a enforced; **generated fields never ground** | 21 tests; leaking `painPoints` as coach-typed fails 2/21 |
| **2** | `d04a08c` | `server/_core/groundingChecker.ts`: one strict-tool call per asset returning speaker claims (F2), viewer-financial findings (F5) and beat labels; all quotes and evidence verified in code; verdicts grounded / ungrounded / conflicts_with_current_fact / not_checkable / overstated; retry-safe renderer quotes nothing; **record-only, no production caller** | tsc 34; 8 files / 618 tests (53 new); `verifyQuote`-always-verified fails 4/53. **Live eval** (7 whole-script fixtures × 3, recomputed from raw JSON): F2 specific biography **18/18** found, precision **25/28** · must-ground **9/9** · F5 recall **9/9**, precision **12/19** · D-c unspecific colour never flagged 3/3 · conflicts 3/3 · overstated 3/3 · extraction errors 0 · median **8.25 s**, max 17.6 s · mean 2,206 in / 673 out tokens |

**What reaches this code today (§15d):**
- `buildCoachFacts` and `groundingChecker` have no production caller until sprint 3.
- `coachFacts` has no writer until sprint 6 or an approved backfill.
- Both dry runs are reachable only through their harnesses.

### 5.2 · Approved, NOT built — ships WITH sprint 3 (same pass, not deferred)

1. **D-b:** the additive `copywritingRules.ts` wording in `INVESTIGATION_COPYWRITINGRULES_DB_2026-09-16.md` §2.
   - `REGISTER_STANDARD` +48 words; `registerPersonGuidance(false)` +27.
   - All 17 register pins verified against the proposal text.
   - Reaches **11** files.
   - **It names "the coach facts supplied above", so it must ship with the coach-facts prompt block.**
2. **Retry-note sourcing, the same pattern, in the three live retry paths:**
   - `fabricationValidator.ts:375` `buildFailContext`;
   - the complianceAxis finding descriptions (`:843, 895, 910, 1139`);
   - `publishBlockMessage.ts:48`.

   Coach facts only, or told through what happened / what changed. **Never quoting the flagged text.**

### 5.3 · Next session — first steps, in order

1. **Verify ground truth** (§1).
2. **Sprint 0b: the two-arm drafting-order dry run.** **AUTHORISED by Arfeen on 2026-09-16; not run.**
   - Arms: (a) today's constraint-in-prompt vs (b) a natural draft + deterministic checks + a trim retry, on the same concepts.
   - Instruments: sprint 8's checker, `groundingChecker` labels, fragment share and run, SD, contractions, overlap, structural distance,
     attempts, tokens, **first-pass block rate per family** (K8).
   - Zero writes: the script dry run via its harness; a whole-DB snapshot (58-table method, now **59 tables**) before and after.
   - ⚠️ **Not yet designed:** arm (b)'s drafting prompt, and the concept selection. Design both and show them before spending.
3. **Investigate the F5 false positive:** "Nobody's building a pension behind a salary any more." was flagged in **6 of 6** runs, and a
   conditional ("If you're earning well…") in 1 of 3. The suspected cause is a narrow framing issue in the F5 extraction instructions or
   verdict logic. Root-cause it before sprint 3 connects anything. Investigation first.
4. **Investigate splitting the beat labelling from fact verification.** The combined call is ~8 s, ~4× the 2 s probe, too slow for a coach
   waiting at publish. Propose separate, cached, precomputed or lighter labelling, with measured accuracy. Investigation only.

### 5.4 · Logged, not blocking

- **Event facts need a place in the facts store.** The number cross-check marks legitimate event lines ("Sunday", "two hours") ungrounded
  because date, format, duration and session structure are not facts in `coachFacts`. Needed before any blocking (K9). For whoever scopes
  the facts-store expansion.
- **Sprint 8 did not widen the checker.** Already missed before it and still missed: "Can't afford the course?", "a criminal conviction",
  "spent convictions", "heal your gut in 30 days". Belief-sense "conviction" without "with" still blocks in live bonus-35 copy.
- **Sprint 8 removed a wrong-reason catch.** "Your savings are sitting in a fixed deposit doing nothing" now passes; only F5 (record-only)
  sees it.
- **`readLadderAnswers`** (`groundingCorpus.ts:80-84`) returns `{}` before its string branch can run, so a JSON-string `groundingMeta`
  gives the live corpus no ladder answers. Code-verified; live impact unverified. Not fixed.
- **`maxTokens: 2000`** at `conceptScriptGenerator.ts:156` is read by nothing (`llm.ts:428`).
- **D-a gap:** ZAP stores no record that a coach confirmed a reworded intake, so the builder fails closed. A confirmation flag needs its own
  screen and migration.
- **Sprint 5:** the video-script prompt's own invented-biography example line (`scriptPromptCraft.ts:96-101`). Not before then.

---

## 6. STANDING DECISIONS FOR THE REST OF THIS BUILD (all confirmed by Arfeen)

| decision | ruling | evidence / status |
|---|---|---|
| **D-a** | AI-reworded coach text counts for PRACTICE facts once the coach confirmed it; never for biography | enforced in `buildCoachFacts`; confirmation is not stored today → fails closed |
| **D-b** | the `copywritingRules.ts` wording approved | ships with sprint 3 (§5.2) |
| **D-c** | unspecific narrative colour (no checkable fact) is allowed and never flagged; only specific invented biography (name, age, employer, title, year, number, place, family member, named event) is a finding | sprint 2 eval: 0 flagged, 3/3 runs |
| **D-g / D-h** | F5 and certainty-overstatement stay record-only, like F2 | promotion only in sprint 7, per family, on measured precision |
| **D-j** | word-window buffer ~5% of slot, at 2.7 w/s → **30 s ≤ 76 words (floor 75), 60 s ≤ 153 (floor 150)** | **provisional**: no ZAP-generated script has been filmed for a timed read |
| **D-l** | fragment run ≤ 3 | passes all nine coach-voice scripts (max 3). ⚠️ **Correction to the brief: kit 225 also passes** (max 3). The run of 4 that fails the cap is **round 4 of the manual revision set**, not kit 225 |
| **D-m** | structural / beat-order check sequenced behind Thread A's concept-truncation fix | not reachable yet |
| **D-n** | resolved: the coach-voice nine is `docs/andromeda/worked-examples/final-shoot-2026-09-10/1-script-and-talent-brief.md` (`a1ab84e`) | plan K4 corrected in place |
| **overlap cap** | ≤ 27% pairwise content-word Jaccard, with **presenter name + method name** stripped as whole phrases | coach nine max **25.81%**, 0/36 over (raw 28.12%); kit 225 still **11/28** over |
| **4-gram rule** | no 4-gram in 3+ scripts, exempting **presenter name, method name, logistics tail** | coach nine **4 → 0**; kit 225 **23** remain. Recorded in `script-rule-spec.md` §2.2 amendment 2026-09-16 |
| **quoting ruling** | new code never shows the model its own flagged text; **retry-note WORDING is not frozen** | three live retry paths updated in sprint 3 under this ruling (§5.2) |
| **attempt budget** | stays locked at **3** (item 15; `complianceGate.test.ts:76`) | blocking any family waits for 0b to show convergence within 3 |
| **deploy** | HOLD; bundle with the next substantive deploy | nothing pushed |
| **method lesson** | recalibrate every numeric threshold against real accepted output (coach-voice nine) and a known-bad set (kit 225) before finalising | thresholds set on theory proved wrong on: structural repetition, the ≤ 156-word buffer, fragment share (0.33 fails a coach script), the contraction range, the overlap exemption |

---

## 7. HARD GATES — unchanged

- **Every production write needs Arfeen's explicit go-ahead in the immediately preceding message.** Show the statement and hold.
- **Pushing `railway-build` is the deploy.** Never push `main`. Never push from the stale local `railway-build`.
- **Never `git add .`** (322 untracked). Screenshots come from Arfeen's browser. No Cloudinary purge calls.
- **Never merge `personal/dab-stills` into ZAP.** Personal marketing content never lands on a ZAP branch.
- **Apply a migration with the `mysql` client stopping on the first error**, not the runbook's `--force` runner.
- **Scan new files for NUL bytes** (sprint 8's lesson): a binary-looking source file silently blinds grep.
- **In zsh, never store a command in a quoted variable** (`"$RR"`): define a function. The 0111 first attempt aborted at the guard for this.

## 8. WHAT A STRAY COMMAND DESTROYS

| command | loses |
|---|---|
| `git reset --hard origin/railway-build`, or a re-clone | **every held commit over production (25 at `870d262`): local only.** GitHub's held copy is `6d88070`, **38 commits behind** local at `870d262` (measured). This includes sprints 0a, 8, 1, 1b and 2 |
| `git clean -fd` | 322 untracked files |
| deleting `personal/dab-stills` and the backup ref | `2562e64`, the stills: local only |
| `DROP TABLE coachFacts` | nothing today (0 rows, no writer); coach facts once sprint 6 writes |
| the session scratchpad ending | eval JSON, capture outputs, probe scripts. **The durable records are the handover docs** |

## 9. RECORDS INDEX

| topic | file |
|---|---|
| **this resume point** | `CHECKPOINT_2026-09-16_SCRIPT_QUALITY_BUILD.md` |
| superseded resume point | `CHECKPOINT_2026-09-15_THREADS_A_B.md` |
| build plan (live) | `BUILD_PLAN_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md` |
| sprint records | `SPRINT0A_SCRIPT_DRY_RUN_2026-09-16.md` · `SPRINT8_CHECKER_PRECISION_2026-09-16.md` · `SPRINT1_COACH_FACTS_2026-09-16.md` · `SPRINT2_GROUNDING_CHECKER_2026-09-16.md` · `SPRINT2_GROUNDING_CHECKER_EVAL_RUN1_2026-09-16.md` |
| D-b | `INVESTIGATION_COPYWRITINGRULES_DB_2026-09-16.md` |
| proposal / addendum / scoping / grounding check | `PROPOSAL_SPEAKER_FACT_GROUNDING_2026-09-15.md` · `ADDENDUM_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md` · `THREADB_FIX_SCOPING_2026-09-15.md` · `THREADB_GROUNDING_CHECK_2026-09-15.md` |
| spec amendment | `docs/andromeda/script-rule-spec.md` §2.2 (2026-09-16) |
| benchmarks | coach voice: `worked-examples/final-shoot-2026-09-10/1-script-and-talent-brief.md` · attendee voice: `…/nine-creator-scripts-attendee.md` |
| Thread A | `CAPTURE_KIT187_CONCEPT_DRY_RUN_2026-09-15.md` · `CAPTURE2_KIT187_CONCEPT_DRY_RUN_2026-09-15.md` · `INVESTIGATION_CONCEPT_GENERATOR_SPLIT_AND_REARM_2026-09-15.md` · `INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md` |
| snapshot tool | `REGEN_RUNBOOK_2026-09-11.md` §2 (`dbsnap2.py`; now 59 tables) |
