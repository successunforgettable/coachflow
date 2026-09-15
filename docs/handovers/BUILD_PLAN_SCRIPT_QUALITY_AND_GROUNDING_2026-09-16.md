# BUILD PLAN — script quality + grounding, sequenced (2026-09-16)

**Status: plan only. Nothing built.**

**It assembles:**
- `PROPOSAL_SPEAKER_FACT_GROUNDING_2026-09-15.md`: F1–F4, sprints 1–7;
- `THREADB_FIX_SCOPING_2026-09-15.md`: P1 length, P2 repetition;
- `ADDENDUM_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md`: F5, the cadence brake, the within-stage structural check, certainty, sprints 0 and 8.

Every conflict below was checked against code or measured data in this session; each is marked ✔ where it was.

---

## 0. The shape in one paragraph

1. **Settle the decisions that change what gets built** (§1).
2. **Fix the instrument before measuring with it:** sprint 8 tightens today's false positives.
3. **Build the measurement plumbing and the new checkers without wiring them into generation:** the script dry run, and F2 + F5 as label-only modules.
4. **Run the drafting-order test using those checkers as instruments** (sprint 0b).
5. **Only then wire the gate, the length and repetition checks, and the steering changes**, all label-only first.
6. **The facts store and the coach screen run on their own track.**
7. **Blocking comes last, per family, on measured precision.**

---

## 1. Conflicts found — decisions made in isolation that later findings contradict

Ordered by how much they change the build.

### K1 · The drafting-order test cannot run before F2/F5 exist — the order the addendum implied is circular

- **Sprint 0** (addendum §1) compares two drafting prompts on "gate pass rate, fragment share, SD, contractions, overlap, attempts,
  tokens".
- **The gate it would measure with is the one proven blind** to invented biography (0 of 18) and to viewer-financial claims (0 of 6
  for the right reason). A pass rate from that gate is a §15c measurement: it cannot show the failure the test exists to find.
- **And the question as put** ("should sprint 0 run before F2 is finalised?") **partly misframes the dependency.** Sprint 0 tests
  the **generator's** drafting prompt; F2 is a **separate checker call** whose extraction prompt Sprint 0 does not touch. What
  Sprint 0 *does* change is (a) the generator prompt and F3's steering, and (b) whether a trim pass exists, which decides where the
  F2/F5 call sits and how many times it runs per script.
- ✅ **Resolution:** split Sprint 0.
  - **0a** — the script dry run — is built first.
  - **F2/F5 are built as offline, label-only modules.**
  - **0b** — the two-arm measurement — runs with F2/F5 as instruments.
  - **F2/F5 *wiring* into the generation path waits for 0b.**

### K2 · The ≤156-word buffer rule does not fit ZAP's own word budget

- **ZAP's live table** ✔ `conceptAxis.ts:346-350`: **30 s = 75–90, 60 s = 150–180** (min–max).
- **The ≤156 cap** was applied in the manual revision passes, from spec §1.2's "read 2–3 s shy" at 2.7 words/second.
- **If adopted for ZAP:**
  - **60 s:** the window becomes 150–156, six words.
  - **30 s:** 27–28 s × 2.7 = 72–75 words, against a floor of 75. **A 3 s buffer is impossible; a 2 s buffer allows exactly 75.**
- The spec itself carries this tension: §1.3's corpus anchors (75–85 for 30 s) predate §1.2's switch to 2.7 w/s.
- 🟡 **Decision D-j:** keep ZAP's table, adopt the buffer and re-derive the floors, or buffer only the ceiling. **CC recommends
  re-deriving both bounds from 2.7 w/s**, because the floor is what makes the buffer impossible.
  - **Ceiling:** (slot − 2 s) × 2.7, rounded down → **30 s ≤ 75, 60 s ≤ 156**.
  - **Floor:** needs its own rule, i.e. how short a read may leave the slot. No floor figure is proposed here; that is part of D-j.
  - `[CORRECTED 2026-09-16: an earlier draft of this line gave floors of 67 and 140 with no stated method; removed.]`

  Whatever is chosen must be re-validated against the human benchmark (28–43 s scripts at 76–116 words ✔) before adoption.

### K3 · The structural check would fire on repetition the concept generator creates by design

- **The concept generator enforces distinctness on desire × awareness only** ✔ `conceptGenerator.ts:145`. The hook pattern may repeat.
- **Kit 225 has three unaware / meme_humor concepts** (223, 227, 229 ✔) and two problem_aware / problem_first (224, 228).
- **So a within-stage structural check on hook / problem / turn** (addendum §2) would flag the very pairs the Andromeda spine
  deliberately allowed — same stage, same hook pattern, different desire. The fix would be fighting its own upstream allocation.
- 🟡 **Decision D-m**, one of:
  - **(i)** compare within stage × hookPattern, and require the hook pattern to be *executed* differently;
  - **(ii)** move distinctness upstream: the concept generator requires distinct awareness × hookPattern pairs where the count
    allows;
  - **(iii)** treat desire difference as sufficient and drop the structural check to advisory.
- **CC recommends (ii) plus (i) as a backstop.** Structural sameness is cheapest to prevent at allocation. But (ii) touches the
  concept generator, which is mid-investigation on truncation (Thread A), so (ii) queues behind that fix.

### K4 · The human benchmark itself shares beat order within a stage — and it is the wrong voice

> `[CORRECTED 2026-09-16 (b)]` **The statement below that the coach-voice nine "is not in the repo" is WRONG.** The set is
> `docs/andromeda/worked-examples/final-shoot-2026-09-10/1-script-and-talent-brief.md` (commit `a1ab84e`). It is now measured, and
> the calibration consequences are in §5.2. The attendee-voice point stands for the attendee file only.

- **Already recorded** (addendum §2): the nine human scripts share one beat order within each stage triplet by design.
- **Newly weighed:**
  - **they are attendee voice** ("I did the SMB programme"). The file states a *separate* set of nine coach-voice scripts exists ✔;
    it is not in the repo;
  - **they run 28–43 s.** ZAP writes 30 s and 60 s coach-voice scripts.
- **Consequence:** every calibration derived from this set is an extension to a different voice and length — the fragment brake, the
  SD range, the structural positive control, the 27% overlap cap. Arfeen already accepted the 18-word cap as uniform; the rest has not
  been accepted.
- 🟡 **Decision D-n:** obtain the coach-voice nine as the calibration set before any promotion to blocking, or accept the attendee set
  as proxy and record it.

### K5 · The fragment-run brake as proposed (≤ 2) fails text Arfeen accepted as natural

- **The addendum proposed "longest fragment run ≤ 2 (human maximum)".**
- **But** revisions 5 and 6 of the manual set — the output accepted as both natural and compliant — each have a script with a run of
  **3** ✔ (0.33 share / run 3), as does kit 225's script 223.
- **The round judged choppy had runs of 4** ✔ (two scripts).
- **So ≤ 2 would reject accepted text; ≤ 3 separates the choppy round from everything accepted.**
- 🟡 **Decision D-l:** ≤ 3 (**CC recommends**, calibrated on both controls) or ≤ 2 (the benchmark maximum). The share cap of ≤ 0.33
  is unaffected: the accepted scripts sit exactly at it.

### K6 · "No exemptions" on overlap was a manual-pass choice and must not transfer to ZAP

- The last manual passes applied the 27% cap raw.
- **On the human benchmark, raw, CP1–CE1 is 27.4%** ✔: the positive control fails.
- **Arfeen's ZAP decision was ≤ ~27% with the method/product name exempt, stripped as a whole phrase**, which passes the human set
  (max 25.4% ✔).
- ✅ **Resolution:** ZAP keeps the phrase exemption. No decision needed; recorded so the manual-pass variant is not inherited.

### K7 · F2 will block the house-style "lived moment" that the register standard asks for

- **F2's probe blocked** the unspecific invented moment ("The morning I finally sent that first message…") **3 of 3**
  (proposal §3.1).
- **The live register standard and retry texts ask for exactly that shape**: "a moment the coach lived".
- **Until D-c is decided**, F3's steering text and F2's extraction scope point in opposite directions. Built in either order, one
  generates what the other blocks.
- ✅ **Resolution:** D-c (and D-b, the `copywritingRules.ts` exception) are **prerequisites for F2's extraction scope and for F3**.
  F2 can be *built* label-only before D-c; its "life_event" scope is finalised after.

### K8 · The attempt budget is locked at 3, and every new check family shares it

- **Locked** ✔: the CHECKPOINT records "the attempt budget of 3 is NOT to be touched" (item 15), and `complianceGate.test.ts:76`
  pins `COMPLIANCE_RETRY_MAX_ATTEMPTS` to 3.
- **The plan adds** length, cadence, structure, F2, F5, timed-claim and certainty to the same three attempts.
- **First-pass block rates for these families are unknown**, so the chance a script exhausts its attempts cannot be estimated.
- ✅ **Resolution:** the budget is not touched. Sprint 0b measures first-pass block rates per family, so blocking promotion (sprint 7)
  happens family by family only where 3 attempts demonstrably converge.
- 🟡 **Decision D-k** is raised only if 0b shows they cannot converge.

### K9 · Blocking without F3 would dead-end a beginner

- **"Never dead-end a beginner"** ✔ is a standing decision (memory: validator v1).
- **With F2 blocking and no steering change**, a coach with no supplied biography is retried on text that asks for biography, three
  times, and then the script is thrown (P1: "do not ship the best failing attempt").
- ✅ **Resolution:** F3 before any F2 promotion.
- **Acceptance criterion for sprint 7:** a dry run on a no-facts coach produces passing scripts within the attempt budget.

### K10 · Sprint 8 changes the instrument; measurements taken before it are not comparable

- **Sprint 8** tightens `clinical_outcome_claim` adjacency, the idiom, "conviction", and crypto vocabulary.
- **Any first-pass block rate measured before it** includes those false positives.
- ✅ **Resolution:** sprint 8 runs **before** 0b. It is tighten-only (§15j), independent, and small.

### K11 · Minor, recorded

- **D-a vs stale facts.** D-a recommended counting coach-confirmed AI rewordings as practice facts; addendum §3 found documented facts
  go stale. Resolved by F1's `sourcedAt`: a confirmed rewording is allowed and supersedable.
- **F5 overlaps the existing `second_person_protected_attribute`** (vulnerable financial status). Keep both (§15j); de-duplicate
  findings in the correction slot.
- **F5's reach in generator prompts is small.** Only 2 files mention the reader's revenue or income, and both are prohibitions ✔.
  Generated *output* has not been measured, so the label-only run is the measurement.
- **Beat labels need storage for sibling comparison.** `conceptScripts` has no metadata column ✔, but `scenes` is JSON ✔; labels
  can live inside it without a migration.
- **The held branch already carries undeployed code** (`82d1949`, `54c7555`). **Every sprint that lands there is a deploy when
  pushed**, and label-only sprints still change live latency and cost (an F2/F5 call is ~1–2 s each). Each push needs its own
  go-ahead.
- **The §14a quoting ruling** (may a retry correction quote the model's own phrase?) is still open and **gates the correction text in
  sprints 3–4**.

---

## 2. The sequenced plan

`→` marks a hard dependency. Parallel tracks are shown side by side.

### Phase A — decisions and upstream prerequisites (no code)

**Decisions, all Arfeen's.** Blocking means what cannot start without it.

| decision | blocks |
|---|---|
| **D-a** confirmed rewordings as practice facts | sprint 1b |
| **D-b** `copywritingRules.ts` exception | sprint 5 |
| **D-c** unspecific invented moments | F2 scope finalisation, sprint 5 |
| **D-f / D-m** structural comparison group | sprint 4 structural half |
| **D-g** F5 tier | sprint 7 (F5) |
| **D-h** certainty: label or block | sprint 7 (certainty) |
| **D-i** run 0b before choosing the drafting prompt | sprint 4 prompt half, sprint 5 |
| **D-j** word window | sprint 4 length half |
| **D-l** fragment-run threshold | sprint 4 cadence |
| **D-n** calibration set | sprint 7 |
| **§14a ruling** on quoting in corrections | sprints 3–4 correction text |
| **deploy decision** on `82d1949` / `54c7555` | first push |

**Thread A**, existing and undecided:
- **concept-generator truncation fix** → blocks sprint 7 at concepts, and K3 option (ii);
- **reaper-race direction** → blocks P2 promotion (set checks read siblings).

### Phase B — foundations (three parallel tracks)

| track | sprint | contents | depends on | size |
|---|---|---|---|---|
| B1 | **8 · lexical-checker precision** | clinical adjacency, the idiom, "conviction", crypto vocabulary with word-sense negative controls; tighten-only | — | S |
| B2 | **0a · script generator dry run** | `dryRun` + `onGate` on the real `generateScriptForConcept`, pinned like `82d1949` (one gate definition, return before the only write, negative controls) | — | S |
| B3 | **1 · coach-facts store (migration, isolated)** | `{slot, value, source, sourcedAt}`; single-valued slots for credentials; A2 campaign/offer facts | D-a (source rules) | S–M |
| B3 | **1b · F1 builder** | provenance-tagged facts; `coachBackground` read from `users`; canonical-slot supersession; generated text never grounds a speaker fact (negative control) | 1 | S |

### Phase C — checkers as modules, label-only, not wired to generation

| sprint | contents | depends on | size |
|---|---|---|---|
| **2 · F2 + F5 checker module** | one combined model call with strict tool use:<br>• **F2:** speaker facts (A1 biography kinds) + offer-outcome claims + certainty comparison + "conflicts with current fact" + beat labels;<br>• **F5:** viewer-financial-information findings;<br>• deterministic verification of every quote and evidence span;<br>• fixture suite with verdicts fixed in advance, whole scripts not single sentences (the F5 probe's caveat);<br>• §15k positive-artefact controls. | 1b for grounding; **F5 half can start before 1b** | M |

F2's `life_event` / lived-moment scope is finalised after **D-c** (K7).

### Phase D — measurement

| sprint | contents | depends on | output |
|---|---|---|---|
| **0b · two-arm drafting test** | same concepts, arm (a) today's constraint-in-prompt vs arm (b) natural draft + deterministic checks + trim retry; instruments: sprint-8 checker, F2/F5 labels, fragment share and run, SD, contractions, overlap, structural distance, attempts, tokens, **first-pass block rate per family** | 8, 0a, 2 | **D-i** (drafting prompt), K8 evidence, calibration data for **D-l** and **D-m** |

### Phase E — wiring into generation, label-only

| sprint | contents | depends on | size |
|---|---|---|---|
| **3 · async gate + accumulating correction slots** | scripts and concepts `gate()` async; per-family slots (item-15 pattern); F2/F5 run on the **final** text each attempt, labels recorded; `scanTimedClaims` wired to concepts and scripts, with A2 offer facts as the supplied-exemption.<br>**+ (approved 2026-09-16 c, same pass, not deferred):**<br>• the coach-facts block added to generator prompts;<br>• the D-b `copywritingRules.ts` wording (`INVESTIGATION_COPYWRITINGRULES_DB_2026-09-16.md` §2);<br>• the same sourcing guidance in the three live retry paths — `fabricationValidator.ts:375` `buildFailContext`, the complianceAxis finding descriptions (`:843, 895, 910, 1139`), and `publishBlockMessage.ts:48` (coach facts only, or told through what happened / what changed; never quoting flagged text). | 0b (trim pass or not), 1b (A2), §14a ruling (**settled: quoting only**) | M |
| **4 · length + cadence + repetition** | hook ≤ 10, sentence ≤ 18 (uniform); window per D-j; fragment run per D-l, share ≤ 0.33 (labelled invented); overlap ≤ ~27% with phrase-stripped name exemption (K6); structural check per D-m, beat labels stored in `scenes` JSON; drafting prompt per 0b | 3, D-j, D-l, D-m | M |
| **5 · steering correction (F3)** | redirect texts and the `META_COMPLIANCE` example rewritten positive-only; aligned with 0b's winning drafting style; test pins updated | D-b, D-c, 0b | M |

### Phase F — the coach-facing track (can run alongside E once 1b lands)

| sprint | contents | depends on | size |
|---|---|---|---|
| **6 · the coach ask (F4)** | the chosen screen writes to the facts store; shows stored facts to confirm or replace (addendum §3); named screen (§15d); two-state proof from Arfeen's browser | 1, 1b, D-d | M |

### Phase G — promotion, per family, last

| sprint | gate to promote | depends on |
|---|---|---|
| **7 · blocking** | per family, **zero false blocks on a labelled whole-script corpus** in the calibration set (D-n); 3 attempts converge (0b, K8); no-facts beginner passes (K9) | 5 (always); for concepts also the Thread A truncation fix; for P2 also the reaper-race direction; for F5 **D-g**; for certainty **D-h** |

Suggested promotion order: scripts, then Meta publish, then concepts, then other surfaces (F5 only).

### The critical path, drawn

```
Phase A decisions ───────────────────────────────────────────────────────────────┐
                                                                                 │
8 (precision) ──┐                                                                │
0a (dry run) ───┼──► 0b (two-arm test) ──► 3 (async gate) ──► 4 (length/rep) ──┐ │
2 (F2+F5 mod) ──┘          ▲                    ▲                              │ │
1 (migration) ──► 1b ──────┴────────────────────┘ (A2 offer facts)             ├─► 7 (promotion)
                   └──────────────────► 6 (F4 screen)                          │
D-b, D-c, 0b ─────────────────────────► 5 (F3 steering) ───────────────────────┘
Thread A truncation fix ──────────────────────────────────────────────────────► 7 at concepts
```

---

## 3. Which of Arfeen's stated dependencies hold

| stated | verdict |
|---|---|
| "F1's migration needs to land before F4's confirmation screen" | ✅ **holds.** The screen writes to and reads from the store (sprint 6 depends on 1 and 1b) |
| "Sprint 0's result may change how F2's prompt is designed, so run it before F2 is finalised" | ⚠️ **partly.** Sprint 0 tests the *generator's* drafting prompt, not F2's extraction prompt. It changes F3 and whether a trim pass exists, which changes where F2/F5 run. **And it cannot be measured meaningfully without F2/F5 as instruments** (K1). So: build F2/F5 as modules first, run 0b, then wire |

---

## 4. What does not change

- the F1–F5 fix shapes;
- the decided hook ≤ 10 and uniform sentence ≤ 18;
- the 27% overlap cap with the name exempt;
- label-only before blocking;
- §15j (tighten, never delete);
- every production write and push needs its own go-ahead.

---

## 5. DECISIONS (Arfeen, 2026-09-16) AND FOUNDATIONS STATE

### 5.1 · Decisions as given, with what checking them found

| decision | as given | found on checking |
|---|---|---|
| **D-a** | AI-reworded coach text counts for practice facts once confirmed, never for biography | **ZAP stores no record that a coach confirmed a rewording** (sprint 1b, `SPRINT1_COACH_FACTS_2026-09-16.md`). "That's me" goes straight to `services.create`, and TweakBox edits look identical. So the builder fails closed: `description`, `targetCustomer` and `mainBenefit` never ground. A confirmation flag needs its own screen and migration |
| **D-b** | investigate why `copywritingRules.ts` is DO-NOT-TOUCH; no edit until reported and a specific change is confirmed | **It was a scope constraint on one fix, not a standing lock.** The only occurrence is CHECKPOINT:6086, inside the 2026-08-30 HVCO-title fix plan ("the fix composes around those imports and lives entirely inside hvcoGenerator.ts"), with no reason stated. The file has been edited since: `265207f` (2026-09-13) rewrote a rule positive-only. **The real risk is blast radius: 19 server files import it** (REGISTER_STANDARD 11, BANNED_COPYWRITING_WORDS 7, registerPersonGuidance 4). **No edit made; waiting on confirmation of a specific change (sprint 5)** |
| **D-c** | distinguish unspecific narrative colour (no checkable fact) from specific invented biography (a name, age, employer, year, number); only the latter blocks | recorded for sprint 2's extraction scope |
| **D-g / D-h** | F5 and certainty-overstatement stay record-only, like F2 | recorded; they change sprint 7 |
| **D-j** | a duration-proportional buffer of ~5% | computed at 2.7 w/s: **30 s → 28.5 s read → 76.95 words → ceiling 76** (floor 75); **60 s → 57.0 s read → 153.90 words → ceiling 153** (floor 150). **Provisional:** it needs timed reads of real generated scripts, and no ZAP-generated script has been filmed. Not implemented (sprint 4) |
| **D-l** | fragment run ≤ 3 | ✅ the coach-voice nine all pass (max 3) |
| **D-m** | confirmed, sequenced behind Thread A's concept-truncation fix | recorded |
| **D-n** | find the coach-voice nine; use it if found; attendee set record-only otherwise | **FOUND, already in git:** `docs/andromeda/worked-examples/final-shoot-2026-09-10/1-script-and-talent-brief.md` (`a1ab84e`, 2026-09-10; the same stored copy on production). First person, P1–P3 / E1–E3 / W1–W3. **§1 K4's statement that it is not in the repo is WRONG, corrected here.** The file name contains neither "nine" nor "coach" |
| **quoting ruling** | retry notes never quote the model's flagged text back; describe it in the abstract | ⚠️ **Conflicts with live code:** today's compliance/fabrication failContext and `timedClaimFailContext` quote the flagged text (capture 2's saved failContext carries the quoted lines). Applied to new code from sprint 3 on; **changing the live generators is a separate decision** |
| **deploy** | hold; bundle with the next substantive deploy | nothing pushed |

### 5.2 · The coach-voice nine, measured (same instrument as §6.1 / spec §3.2 rule 7)

**It changes calibrations that were derived from the attendee set:**

| metric | coach-voice nine | attendee nine | consequence |
|---|---|---|---|
| words | 112–114 (~41–42 s) | 76–116 | still no 60 s benchmark |
| hook | 4–10 | 4–10 | hook ≤ 10 holds |
| longest sentence | 13–18 (0 over 18) | 13–18 | sentence ≤ 18 holds |
| SD | 3.92–5.78 | 3.71–5.35 | three coach scripts above the attendee range |
| contractions / 100 w | **2.6–7.0** (mean 4.42) | 3.9–7.9 (5.9) | **5 of 9 below the attendee minimum: the attendee range is not a coach-voice reference** |
| fragment share | **0.08–0.38** | max 0.33 | **the proposed share cap ≤ 0.33 fails W1 (0.38); needs recalibration** |
| longest fragment run | max 3 | max 2 | D-l ≤ 3 holds |
| pairwise overlap | **28.12%** raw (P3–E3) · 27.37% stripping "Shez" · **25.81%** stripping "Shez" + "four patterns" | 27.4% raw | **the ≤ ~27% cap passes only if the exemption covers the presenter's name AND the method device**, not just a product name |
| 4-grams in 3+ scripts | 4: "then my brother shez", "one of four patterns", "two hours free and", "hours free and live" | 16 | **§2.2's literal "no 4-gram in more than two" fails the real benchmark**; the matches are the presenter name, the method device and the logistics tail |

### 5.3 · Foundations — built and on the held branch (not pushed)

| sprint | commit | gates re-run on the held branch |
|---|---|---|
| **0a** script dry run | `dbfe389` | tsc 34 · 8 suites / 497 tests · the dry-run block removed fails 2 of 5 pins |
| **8** checker precision | `5c2d34e` + **`51bda65`** | tsc 34 · 16 files / 749 tests · disabling `DIGITAL_ASSET_RE` fails 4 of 63. **`51bda65` fixes a raw NUL byte sprint 8 put in complianceAxis.ts:778**, which made the file read as binary and blinded grep (runtime string identical) |
| **1** coachFacts table + migration 0111 | `799bd84` | isolated commit. **0111 NOT applied anywhere:** no reachable local DB (Homebrew 3306 refused root; the 3307 scratch data dir is gone). The SQL is checked against the schema by a test only, which is weaker than an apply plus INFORMATION_SCHEMA read. **Production apply needs a go-ahead, and must land before any code that reads or writes the table deploys** |
| **1b** `buildCoachFacts` | `41c817c` | tsc 34 · 16 files / 775 tests (coachFacts 21) · adding `painPoints` as coach-typed fails 2 of 21 (the negative control and the generated-sources test) |

**Known consequences and findings:**
- **Sprint 8 removed a wrong-reason catch.** "Your savings are sitting in a fixed deposit doing nothing" was blocked only as a clinical claim; it now passes. Only F5 (sprint 2) will catch it for the right reason.
- **Sprint 8 did not widen** today's pre-existing misses. These already pass: "Can't afford the course?", "a criminal conviction", "spent convictions", "heal your gut in 30 days". Belief-sense "conviction" without "with" still blocks in live bonus-35 copy.
- **Sprint 0a** confirmed that a thrown model error on the script loop is never retried and skips `recordComplianceGate`, as in the concept loop. `maxTokens: 2000` at conceptScriptGenerator.ts:156 is read by nothing (`llm.ts:428` sends 8192).
- **`readLadderAnswers`** (groundingCorpus.ts:80-84) returns `{}` before its string branch can run, so a JSON-string `groundingMeta` yields no ladder answers to the live corpus. **Code-verified; live impact unverified** (it depends on whether the driver hands the column over as a string). Logged, not fixed.
- **§15d:** `buildCoachFacts` has no caller until sprint 2. The `coachFacts` table has no writer until sprint 6 or an approved backfill. The script dry run's only caller is its harness until 0b.
- **Every agent worktree was created at `67517e3`** (main), not the held branch; each agent caught it and reset. The worktrees were verified identical to their commits before removal.
