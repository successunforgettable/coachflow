# PROPOSAL — speaker-fact grounding: closing the first-person biography gap (2026-09-15)

**Status: investigate-and-propose only. Nothing built.** Priority set by Arfeen 2026-09-15, ahead of the length/repetition fixes.
Inputs: `THREADB_GROUNDING_CHECK_2026-09-15.md` (the blind spot) · `CAPTURE2_KIT187_CONCEPT_DRY_RUN_2026-09-15.md` §2a (word-list false
positives) · three read-only investigations this session (prior art, gate architecture, coach-biography data), whose load-bearing
claims were re-checked against the files before use (marked ✔ where re-checked here).

---

## 0. Summary

The gap is not one missing detector. It is **four defects that produce one output**, and closing only the detector would leave
three of them in place:

| # | defect | evidence |
|---|---|---|
| D1 | **Nothing is ever asked about the coach.** The only screen that saves `users.coachBackground` (`CoachIdentityModal`) is reachable only through an "Edit bio" link shown when a background *already exists* and is under 80 chars | ✔ `V2LandingPageResultPanel.tsx:1076-1088`; first-visit entry removed by ✔ `1e25c5c` (2026-03-21). The 4 ladder questions all ask about a client ✔ `V2TrailIntake.tsx:64-69` |
| D2 | **The grounding corpus has no provenance.** Coach-typed words and model-written text are flattened into one string; `expandProfile` writes buyer inner-monologue into `painPoints` ("Use their internal monologue language" ✔ `services.ts:384`), which is where "HR for 12 years" and "my husband" come from. `coachBackground` is read from the services row, which has no such column, so it is always null ✔ `groundingCorpus.ts:102`, ✔ `schema.ts:55` | kit 225's corpus holds 3,832 chars; the coach typed 1,077 of them (measured) |
| D3 | **The generators are told to write coach biography, with no source.** `META_COMPLIANCE` routes "health, body, age, financial standing, background" into "the coach's own account of their own experience" and carries a first-person biographical example ("the morning I went to pick my toddler up and my back said no") ✔ `scriptPromptCraft.ts:96-101`. The gate's own retry text redirects every blocked claim to "the coach's own experience — the moment they remember" (`fabricationValidator.ts:375`, seen verbatim in capture 2's failContext) | script 229's "Me at forty-four, watching my youngest leave for university" is exactly the shape requested |
| D4 | **The detector allows anything it does not recognise.** `detectProofShapedClaims` returns client/proof shapes only; "a claim NOT returned here … is always allowed" ✔ `trackRecordClaims.ts:222-225`. Hard blocks exist only at concepts, scripts and the two Meta publish procedures ✔ (`requireGrounding: true` at `conceptGenerator.ts:315,382`, `conceptScriptGenerator.ts:252`, `meta.ts:433,604`); the persistence gate keeps every row when every row is blocked ✔ `persistenceGate.ts:17,212` | all 8 kit 225 scripts passed |

**Proposed shape (§2):** a provenance-separated source of coach facts (F1), a model-read / machine-verified speaker-fact check
that does **not** extend the word lists (F2), a paired correction of the steering text (F3), and a screen where a coach can supply
biography (F4). Rolled out label-only first, blocking only on Arfeen's tier-1 decision (§4).

---

## 1. Constraints this fix must not break (all recorded decisions)

1. **First person stays.** CHECKPOINT §6a: first-person copy *is* the anti-fabrication design (`5fc1a1c`) — a claim about the
   advertiser's own experience needs no client. The target is **unsourced facts spoken in the first person**, never the voice.
2. **Never dead-end a beginner.** A coach with no biography must still get copy; it speaks from the method and the offer.
3. **Predictable category psychology flows; specific invented proof blocks.** Statements about the audience are not speaker facts.
4. **Only tier 1 blocks, and blocking is Arfeen's decision** (`2389a05`); "TEST MORE FIRST" — zero false positives before a blocking
   detector.
5. **Ground truth is the coach's own words, never generated prose** (CLAUDE.md §15a; memory: validator v1, ICP grounding).
6. **§15j:** no existing check is removed or loosened. `checkOutput` and its word lists stay exactly as they are.
7. **§14 / §14a:** positive-only steering; no failure exemplar in a standing prompt.
8. **Unmade product decisions this touches, not pre-empted here:** the assertable-vs-thinking-material classification of upstream
   fields (CHECKPOINT ~7184-7204) and grounding-vs-vividness.
9. **`_core/copywritingRules.ts` is marked DO-NOT-TOUCH** (CHECKPOINT:6082). F3 needs an explicit exception.

---

## 2. The fix shape

### F1 · A coach-facts source, separate from the corpus

- A builder returning **spans with provenance**, not a flat string: `{ text, source }` where source is one of the coach-typed
  channels only — ladder answers (verbatim), `users.coachBackground` (read from `users`, fixing D2's wrong-table read), the coach's
  own intake messages if stored verbatim *(reported by the data investigation; confirm the table before building)*,
  `coachMethods.differentiator`, and coach-typed proof fields (`pressFeatures`, `socialProofStat`, testimonial quotes).
- **Excluded from speaker-fact grounding:** every model-written field — `expandProfile` output, ICP prose, offers, mechanisms,
  concepts. They can still feed generation as thinking material; they cannot *make a speaker fact true*.
- The existing `buildCoachCorpus` is left untouched for the existing checks (§15j).
- 🟡 **Decision for Arfeen (D-a):** `description` / `targetCustomer` / `mainBenefit` are a model's rewording of what the coach typed,
  reportedly shown back to the coach to confirm. Do confirmed rewordings count as the coach's words for **practice facts** (who they
  help, what they offer)? Recommendation: yes for practice facts, no for biography.

### F2 · The detector: read by a model, verified by a machine

**Why not extend the word lists.** The existing mechanism decides by term presence. Its measured failure mode is word sense —
"conviction" read as a criminal record, "can't afford to" read as a financial statement (capture 2). Biography is *all* word
sense: "twelve years" is a speaker fact in "I spent twelve years in procurement" and a reader attribute in "not for someone with
twelve years of expertise"; "my youngest" is a fact, "the youngest idea in the room" is not. A biography word list inherits the
failure mode at its worst. §3 measures this directly.

**The shape — two steps with a hard boundary between judgement and verdict:**
1. **Extraction (model).** One call per asset (all its fields together) lists every statement in which the speaker asserts a
   fact about their own life, history or practice, each with a **verbatim quote** and, if the coach facts state it, a **verbatim
   evidence span** from F1.
2. **Verdict (deterministic).** A claim counts only if its quote is a substring of the copy (else: extractor error). It is
   **grounded only if its evidence is a substring of F1's text.** No evidence, or evidence that is not found, → **ungrounded**.

**What this buys structurally:**
- **The model can never make a claim grounded by asserting it.** A fabricated citation fails the substring test (the
  `methodExtractor.ts:189-196` precedent: "a fabrication wearing the costume of a citation"). Hallucination can only push a
  verdict *toward* blocking, never toward passing.
- **Silence cannot pass a control (§15k).** Every negative control asserts a positive artefact: at least one extracted claim,
  classified ungrounded.
- **Word sense is read, not matched** — the exact class the lexical gate gets wrong.
- **Residual risk is missed extraction** (a false negative). It is measurable on a labelled fixture set and is the number that has
  to be tracked (§3).

**Placement.** A new async stage beside `checkOutput`, which stays synchronous and unchanged. Called from: the concept `gate()`,
the script `gate()`, and both Meta publish procedures (already async at `meta.ts:420`). Label-only at every other surface.

### F3 · Correct the steering, in the same package

Without it the check fights the prompt: every retry is told to "speak from the coach's own experience" and writes a new biography.
- Replace the redirect with a positive route to **(a) the facts the coach supplied, passed in as a short list**, or **(b) what the
  method does and what the offer is.** Sites: `scriptPromptCraft.ts:96-101` (including removing the first-person biographical
  example from a standing prompt), `fabricationValidator.ts:375`, `complianceAxis.ts:843,895,910,1139`,
  `publishBlockMessage.ts:48`, and the register lines in `copywritingRules.ts:122-140,177-181,200-203`.
- Pinned by `fabricationValidator.test.ts:250` and `registerStandard.test.ts:34,54`; those assertions change with the text.
- §6a is preserved: first person stays; only the unsourced facts go.
- 🟡 **Decision for Arfeen (D-b):** the DO-NOT-TOUCH exception for `copywritingRules.ts`.
- 🟡 **Decision for Arfeen (D-c), grounding vs vividness:** may copy carry an **unspecific** first-person moment with no checkable
  fact in it ("the morning I finally sent that first message, I wanted to delete it")? It is invented experience, but it asserts no
  age, name, employer, number or date. §3 records what the detector does with it (fixture N5); the rule is a product call.

### F4 · Give the coach somewhere to say it (§15d — the screen)

Without F4 the fix is correct and every coach's copy becomes biography-free. The capture component already exists
(`CoachIdentityModal`, 3 required fields) and is unreachable for any coach without a saved background.
- 🟡 **Decision for Arfeen (D-d), the screen:** where a coach is asked, once, skippable. The locked pattern is a conversational
  Zappy ask, one question at a time, N/A a first-class answer (memory: operator capture). The natural moments are the intake's
  first exchange or the ladder offer. CC recommends the ladder moment, as one optional fifth rung about the coach, because it
  already sits after the reveal and before the kit, and already writes verbatim answers.

---

## 3. Evidence: three detectors on the same fixtures

Throwaway harness, never in the repo: `scratchpad/biogap/proto.ts`, `proto2.ts`. No DB writes; LLM calls only.
- **Set 1:** 20 fixtures: real kit 225 sentences, script 229 whole, synthetic variants, the capture-2 false-positive sentences,
  practice and method claims. ⚠️ The word list was written alongside set 1, so its score there is circular (§15c corollary).
- **Set 2:** 16 **held-out** fixtures written to test word sense in both directions: biography that uses no list word, and
  innocent sentences that do. Expected verdicts fixed before running.
- **Grounding source:** the coach-typed text for service 318 plus the account background "mind coach". **F2 ran 3 times per fixture.**
- Today's gate is `checkOutput` with the real corpus and `requireGrounding: true`.

### 3.1 · Results (both sets; 2 AMBIG fixtures excluded from scoring)

| detector | biography: must BLOCK | innocent: must PASS |
|---|---|---|
| **today's gate** | **0 / 18** | 13 / 16 — false blocks on "conviction", "can't afford to", "my youngest clients" |
| **biography word list** | 12 / 18 — set 1 18/18 (circular); **set 2 missed all 6** ("the twins", "left nursing", "the year I turned fifty", "a decade in banking", "my old boss at Unilever", "buying for a supermarket chain") | 11 / 16 — **5 false blocks, every one on set 2**: "running", "at forty", "since 2021", "youngest", "partner" |
| **F2: model-read, machine-verified** | **54 / 54 runs** | 40 / 48 runs: **5 false blocks, 3 malformed responses** |

- **The word list fails in both directions on held-out text.** This is the failure Arfeen flagged, now measured on biography
  itself: set 2 scores 5 / 16.
- **F2 never missed a biography fixture** in 54 runs, and **no response ever carried a fabricated citation**: 0 evidence spans
  failed verification across 108 calls.
- **F2's 5 false blocks, by cause:**
  - **3 × "I'm running a free masterclass this Sunday."** Extracted as a life event, and ungroundable because event details live in
    the kit's operator-captured facts, which are not in the source. **A scoping gap (A2).**
  - **1 of 3 × "My youngest clients are usually the most afraid to name a price."** A client claim read as a practice fact.
    **Scoping (A1).**
  - **1 × "Since 2021 LinkedIn has changed…"** The date was attributed to the speaker. **A genuine sense error**, and the residual
    to measure.
- **The 3 errors:** `claims` did not come back as an array. This is the shape failure `strictToolUse` (item 15) was built to
  prevent (A3).
- **AMBIG fixtures:**
  - the meme hook voicing the viewer (R7) **passed 3/3**;
  - the unspecific lived moment (N5, *"The morning I finally sent that first message…"*) **was blocked 3/3**. **As currently
    instructed, F2 blocks house-style invented moments. That makes decision D-c real, not theoretical.**

### 3.2 · Cost and latency (measured)

- All 108 calls went to `claude-sonnet-4-6` through the default `invokeLLM` ladder; `stop_reason=tool_use` on every call.
- Per call: mean **1,258 input / 84 output tokens**; max **1,436 / 405** (the whole of script 229). Far below the 8,192 ceiling.
- Latency: median **2.0 s** (set 1) and **1.8 s** (set 2); max **5.7 s**.
- Load: one call per gated asset per attempt. A kit's 8 scripts at up to 3 attempts is at most 24 calls. At the Meta publish check,
  where a user waits, it adds about 2 s per asset.

### 3.3 · Amendments the evidence requires before any blocking

- **A1.** Block only **biography kinds**: age, family, career/employer/title, tenure, dates, places, life events, credentials,
  witnessed events. Practice and offer statements are recorded, not blocked.
- **A2.** Add the kit's **operator-captured campaign facts** (event schedule, etc.) and the selected offer's logistics to the source
  as offer facts, so an event line is groundable.
- **A3.** `strictToolUse: true`. An extraction error re-extracts once, then **fails closed**: blocking at the hard-block sites,
  labelled elsewhere.
- **A4.** Re-run both sets **plus a larger held-out set** after A1–A3. The since-2021 sense error is the residual to measure.

### 3.4 · Confidence

- **HIGH that the structure is right.** On held-out text the word-list approach is wrong in both directions. The model-read shape
  caught every biography run, and it cannot ground a claim with a fabricated citation, by construction.
- **MEDIUM that false blocks reach the zero bar** required before blocking. Before the amendments, 5 of 45 valid must-pass runs
  were wrong; 4 of the 5 have scoping causes that A1/A2 address; 1 is a sense error.
- **36 fixtures is a probe, not a corpus.** The tier-1 promotion (D-e) needs a larger labelled corpus from real generated copy.

---

## 4. Rollout and enforcement

1. **Label-only everywhere first** (a tier-2 class through the existing telemetry). Build a labelled fixture corpus from real
   generated copy — the 252-block and 3,006-text corpora cited in `complianceAxis.ts` are not in the repo, so this starts small:
   the 8 kit 225 scripts, the concepts, the synthetic set.
2. **Blocking at concepts, scripts and Meta publish only when the measured false-positive rate on that corpus is zero** —
   🟡 **Decision for Arfeen (D-e): the tier-1 promotion.**
3. **The persistence gate stays label-only** and keeps its fail-open behaviour.

### ⚠️ Sequencing with the concept generator

Blocking a new class at concepts raises retries, and profile 249's retries have truncated 2 of 2 times, where a truncation ends the
generation. **Do not promote F2 to blocking at concepts before the truncation-not-retried defect is fixed**, or concept sets will
fail more often. Scripts and Meta publish have no such dependency.

---

## 5. What it takes to build (separate sprints, one commit each)

| # | sprint | contents | size | needs first |
|---|---|---|---|---|
| 1 | **coach-facts source (F1)** | provenance-tagged builder; `coachBackground` read from `users`; A2's campaign/offer facts; unit tests incl. a negative control proving generated text never grounds a speaker fact. Server only, no migration | S | D-a |
| 2 | **speaker-fact checker (F2), label-only** | the extraction module (A1, A3), the deterministic verification, the fixture suite (both sets plus real kit 225 scripts, verdicts fixed in advance, §15k positive artefacts), tier-2 telemetry, wired label-only at concepts, scripts and both Meta publish procedures; the A4 re-measure | M | sprint 1 |
| 3 | **async gate with accumulating correction slots** | scripts and concepts `gate()` made async; per-family correction slots (the item-15 pattern); shared by F2, length and repetition | M | — (can run in parallel with 2) |
| 4 | **length + repetition (decided)** | P1 and P2 per §6, on the sprint-3 gate | M | sprint 3 |
| 5 | **steering correction (F3)** | the redirect texts and the `META_COMPLIANCE` example; test pins updated | M | D-b, D-c |
| 6 | **the coach ask (F4)** | the chosen screen writing `users.coachBackground`; screenshot proof from Arfeen's browser, two-state (asked, then post-refresh) | M | D-d |
| 7 | **promotion to blocking** | tier-1 at scripts and Meta publish once the labelled corpus shows zero false blocks; at concepts only after the truncation-not-retried fix (§4) | S | D-e + measurement |

- **No DB migration is required** if F4 writes the existing `users.coachBackground`. A structured biography store would be a
  migration, isolated in its own sprint (CLAUDE.md §5.6).
- **Order:** 1 → 2 runs label-only and gathers real data while 3 → 4 ship the decided quality fixes. 5 and 6 follow their
  decisions. 7 is last.

---

## 6. Do the decided length and repetition fixes change? (confirmation requested)

**Their rules do not change.** Three things about **how** they are built do, and they should be built once, together:

1. **`gate()` becomes async.** F2 is a model call and repetition already needs a DB read of saved siblings. Build P1 (length), P2
   (repetition) and F2 on one async gate, in one merged pass, so a redraft that shortens a sentence cannot slip a new biography
   past the check (scoping §E).
2. **The retry must accumulate corrections by family.** Scripts and concepts pass only the latest attempt's failContext ✔
   (`conceptScriptGenerator.ts:280`) — the single-slot shape item 15 had to fix in the lead-magnet generator (`2349d6e`). With
   length, compliance, fabrication, speaker facts and repetition sharing 3 attempts, a single slot will oscillate. Build the
   accumulating slots once, shared.
3. **One §14a ruling covers both.** Repetition's correction may want to quote the repeated run; F2's correction will want to name
   the unsupported claim. Both are post-hoc quotes of the model's own output (`validator.ts:97` precedent). 🟡 Decide once.

**Decided parameters, re-measured (2026-09-15, the §6.1 instrument):**
- **Length:** hook ≤ 10, every sentence ≤ 18, uniform across 30 s and 60 s (this settles the scoping doc's open "extension"
  question). No change from F2.
- **Repetition:** pairwise content-word Jaccard ≤ ~27%, with the fixed method/product name **stripped as a whole phrase** before
  measuring.
  - Without the exemption the human pair CP1–CE1 measures **27.4%** and would **fail** a 27% cap; with "SMB programme" stripped
    it is **25.4%** and all 9 human scripts pass.
  - Kit 225 with names stripped: max **37.7%**, **11 pairs over 27%**, **5 of 8 scripts** would be rejected against an
    earlier-saved sibling.
  - Strip the phrase, not the tokens: "first", "client" and "process" are ordinary words.
  - This replaces the scoping doc's 4-gram threshold question for the repetition gate; the name-variant check (P2 2b) is unaffected.
- **Retry budget:** first-pass block rates for all new classes must be measured before deploy. No script dry run exists
  (`82d1949` added one for concepts only).
