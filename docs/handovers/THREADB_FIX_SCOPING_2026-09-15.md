# THREAD B — script-quality fix scoping (2026-09-15)

**Investigation and proposal only.** No repo code changed, nothing committed or staged, no production write. Production
reads were SELECT-only through a runner that refuses any statement not starting with `SELECT`, after an
`INFORMATION_SCHEMA.COLUMNS` audit of `conceptScripts`, `campaignConcepts`, `campaignKits`, `heroMechanisms`, `offers`,
`hvcoTitles`. Every figure below was **measured at run time** (§15f) from production `conceptScripts` (set
`60731b15…`, concepts 223–230) and from the in-repo human file. Throwaway instruments, never in the repo:
`/private/tmp/claude-501/-Users-arfeenkhan-zap-deploy/57bcb7ed-4d1c-4421-b236-173c483df455/scratchpad/threadb-scoping/`
(`metrics.py`, `controls.py`, `controls_out.txt`, `metrics_out.json`).

The grounding of the scripts' personal details is a **separate, parallel investigation** and is not judged here. §E
only places the gate.

---

## 0. Summary

| problem | tied to script-rule-spec.md? | proposal | confidence |
|---|---|---|---|
| 1 · sentence length | **yes**: §1.4 (hook ≤ 10, CORPUS) and §1.9 (max ~18, INFERRED) | P1: per-script hard checks in `validateScriptStructure`, plus a correction to the prompt line that sets a 30–36-word "line" | **HIGH** check · MEDIUM convergence |
| 1b · SD floor, contractions | SD floor: yes (§1.9), **but the human set fails it**. Contractions: **no written threshold anywhere** | emit only, do not gate | n/a |
| 2 · cross-script repetition | **yes**: §2.2 test 1 (4-grams) and test 2 (one canonical name) | P2: a sibling-aware set check inside the per-concept gate; canonical names read from the database | name check **HIGH** · 4-gram check **MEDIUM** (threshold undecided) |
| 2b · Jaccard overlap | **no threshold exists** (spec §5.3 and §5.4 say so) | emit only | n/a |
| 3 · narrator voice | 🔴 **NO.** script-rule-spec.md has no narrator rule. It is tied only to ZAP's prompt-level register standard | P3: (a) grounding of first-person details (the gate's job); (b) a lexical consistency check; (c) a product decision on the meme_humor pattern first | (a) placement HIGH, adequacy unknown · (b) **LOW** |

**Two threshold problems the positive control exposed.** Neither was tuned silently.
- **§1.9's SD floor (~4.0) fails 2 of 9 human scripts:** CP1 3.71, CE2 3.96.
- **§2.2's "no 4-gram in more than two scripts" fails the human set:** 16 four-grams appear in 3 scripts.

**One internal conflict in §2.2.** Test 2 requires one canonical mechanism name, used verbatim. Test 1 forbids any 4-gram in
3 or more scripts. "Career Layer Excavation Process" is exactly four tokens, so the two tests contradict each other whenever
the name appears in 3 or more scripts.

**One correction to CHECKPOINT_2026-09-15_THREADS_A_B §6.1.** It says "6 of 8 exceed the human max of 18". The instrument
reproduces every other §6.1 figure exactly, including the 14–32 range and the 25.2 mean, but gives **7 of 8**. Only 224
(longest sentence 14) is inside the limit. This is the typed-assertion signature from spec §3.1.

---

## A. What already exists

**Searches run.**
- `git log --all` (1,323 commits) with messages grepped for script, naturalness, contraction, sentence, overlap,
  repetition, 4-gram, voice, narrator.
- Pickaxe (`-S`) over `server client/src shared` for contraction, sentenceLength, longestSentence, ngram, n-gram,
  4-gram, jaccard, script_hook_too_long, script_length_under, narrator.
- History of `conceptScriptValidator.ts`, `scriptPromptCraft.ts` and `conceptScriptGenerator.ts`.

**Never built on any branch.** No metric code exists in `server`, `client` or `shared`: no sentence length, no hook word
count, no n-gram, Jaccard or contraction counting. The `contraction` pickaxe hits are all prompt strings: 7bbfd0e, the
605909f copywritingRules port, and the c07cbd0/670aa6b email work. **Nothing was built and then reverted.** The nearest
revert, a912a2b (anti-fabrication validator v1), is not script-specific and was re-landed through the compliance layer.

**Built, prompt-only (steering, per §15i):**
- **7bbfd0e** *"spoken register across the whole script (was hook-only) — prompt-only"*, now `SPOKEN_REGISTER`
  (`scriptPromptCraft.ts:115-124`): "Everyday contractions", "Short, breath-length sentences".
- **f9221fb** research-grounded standard, now `SCRIPT_STRUCTURE_CRAFT` (`:58-75`): "HOOK (the opening, under ~10 words)",
  "One idea per sentence".
- **5fc1a1c** first-person register standard: `REGISTER_STANDARD` and `registerPersonGuidance` (`copywritingRules.ts:120-205`).
- **2ba4572** per-scene word steering: *"Each scene is ONE spoken line of ${perSceneMin}–${perSceneMax} words"*
  (`conceptScriptGenerator.ts:97`). **This line bears directly on problem 1** (see P1).

**Built, enforced:**
- **Structure** (`conceptScriptValidator.ts`): ≥3 scenes, a non-empty spokenLine in every scene, scene[0] is the hook,
  hookPattern matches the concept, and the word-count ceiling.
- **Compliance** (`complianceFilter`).
- **Compliance axis plus fail-closed fabrication** (`checkOutput`, `requireGrounding: true`; 7c93d84 and defect (b)).

**Deliberately deferred, in writing:**
- `conceptScriptGenerator.ts:12-13`: *"NO script-quality/ICP-fabrication truth check (deferred to the ICP grounding sprint)
  — structural + compliance screening only."* The same deferral sits in `conceptScriptValidator.ts:5-6`.
- `PROPOSAL_VIDEO_SCRIPTS_MODERATE_2026-09-14.md` puts *"set-level compliance checks beyond what exists"* **out of scope by
  instruction**. The same document's §6 repeats: "set-level compliance — no — the per-script gate is unchanged".
- `VIDEO_SCRIPTS_BUILD_2026-09-14.md` §4: *"Claim quality in the copy was not judged in this package (out of scope)."*

**On paper, unbuilt:**
- `SCRIPT_GENERATOR_REQUIREMENTS.md` (2026-09-03) R4: *"hook ≤ 10 words · 🔴 HARD · ❌ missing"*, called *"the single
  highest-value validator addition in this document"*. R9, the word-count floor, is also missing.
- `script-rule-spec.md` header: *"No code implements any of it yet."* That is still true for every rule audited in §C.

**Other documents read:**
- **`SCRIPT_GENERATOR_FIX_SUMMARY.md`** is at the **repo root**, not under `docs/andromeda/worked-examples/`. It came from
  commit 537405d (Feb 2026, Manus) and covers the legacy `server/routers/videoScripts.ts`. It holds six prompt rules (niche,
  angle, banned words, customer language, specificity, hook), which are the ancestors of `NICHE_DETECTION`, `HOOK_RULE` and
  `BANNED_WORDS`. Its "verification" was reading the scripts. It enforces nothing and says nothing about sentence length,
  repetition or narrator.
- **`rhythm-and-readability-on-a-phone.md`** covers a *read* surface. It allows 20+-word sentences when they use parallel
  construction ("Medium 14–20, Long 20+"), and its only cadence rule is "never three consecutive sentences of identical
  length". **It does not support an 18-word cap and is not a source for any threshold below.**
- **`script-research/README.md`**: "§5 intro under ~10 words", the source of §1.4.

**Duplication and reversal risk:**
- P1 extends `validateScriptStructure`. It duplicates nothing.
- P1's prompt correction amends the wording of 2ba4572's "ONE spoken line" and keeps its fix, which anchored the budget on
  the target rather than the floor.
- **P2 lifts the "no set-level checks" exclusion that Arfeen set for the moderate build, so it needs explicit
  authorisation.** It does not reverse the grounding deferral.

---

## B. The live script path (deployed in 87596d7; code from 9102140/8d1bdd1)

| step | file : function (line) |
|---|---|
| screen | `client/src/v2/V2ConceptScripts.tsx`, mounted at `V2AdCopyResultPanel.tsx:961` (Ad Copy node → Video tab, the only live entry). Polls `listForIcp` (`:230-237`) |
| router | `server/routers/conceptScripts.ts`: `generateForIcp` (`:94-99`) → `ensureScriptsForIcp`; `listForIcp` (`:15`) |
| batch owner | `server/conceptScriptBatch.ts` `ensureScriptsForIcp` (`:99`) → `planAndStart` → `setImmediate(runScriptBatch)` |
| batch loop | `server/_core/scriptBatch.ts` `runScriptBatch` (`:115-158`): **a sequential awaited loop over concept ids in id order**. Each concept claims its job (`insertJob`/`rearmJob`, `:135`) and aborts on a collision. A failed concept is recorded and the loop continues (`:144-150`) |
| prompt | `server/conceptScriptGenerator.ts` `buildConceptScriptPrompt` (`:58-111`), with `invokeScript` (`:148-161`; system prompt = `REGISTER_STANDARD`) |
| output schema | `SCRIPT_JSON_SCHEMA` (`:117-146`): `{hookPattern, scenes[{sceneNumber, sceneType, spokenLine, onScreenText, deliveryNote}]}`. `strict`/`required` steer and do not enforce (§15i) |
| validator | `_core/conceptScriptValidator.ts` `validateScriptStructure` (`:61-104`), `screenScriptCompliance` (`:107-128`); its failContext builder is `build()` (`:55-59`) |
| compliance + fabrication gate | `checkOutput(fields, {corpus: buildCoachCorpus({service, groundingMeta}), supplied: buildProofSupplied(service)}, {requireGrounding: true})` (`:245-253`) |
| single shared pass + retry | `gate()` closure (`:242-266`) merges all failContexts. `MAX_ATTEMPTS = 3` (`:271`); each retry appends the failContext to the prompt (`:149`); `throw` after 3 attempts (`:299`) |
| telemetry | `recordComplianceGate` (`:288-297`), which emits first-pass classIds |
| write | `db.insert(conceptScripts)` (`:305-319`), **per concept, as soon as that script passes** |

📌 **`server/_core/validator.ts` failContext is not on this path.** That module is the email/sequence JSON-shape
validator. The script path builds its failContexts in `conceptScriptValidator.ts build()` and `checkOutput`.
`validator.ts:97` is still the precedent for quoting a preview of the model's own output in a retry (see P2).

**Where a set-level stage could sit, and the constraints:**
1. **After the loop** (end of `runScriptBatch`). Every script is already INSERTed and visible to the polling screen, so this
   would be detection after the write, repaired by UPDATE or DELETE. **It fails the standard.** Use it only to *emit* a
   set report (spec §3.2 rule 5).
2. **Inside each concept's gate, against the siblings already written** (same `scriptSetId`). **This is enforcement at
   generation time. Recommended.** The constraints:
   - **Order dependence.** Script k is checked against k−1 siblings, so the first scripts are unconstrained and later ones
     take the retries. A concept retried later sees the whole set (227, created 18:43, was generated after 230, created
     18:38). The set bound uses n = the concept-set size (`loadConceptIds`), which is known up front.
   - **Serialisation.** Concepts in one set never generate concurrently in normal flow: the loop is awaited, and a second
     batch collides on the job claim and aborts (`scriptBatch.ts:135-139`).
   - **Residual race.** If the reaper marks a still-running job failed, a re-request can re-arm it and generate a sibling
     concurrently; that race is logged in 62b1a09 and 1befc9a. Two candidates would then each read siblings without the
     other and could jointly exceed the bound by one. Re-reading the siblings immediately before the INSERT narrows the
     window but does not close it. Closing it needs a set lock, which is its own item.

---

## C. Rule audit (script-rule-spec.md)

ENFORCED means a named line rejects or regenerates, and that line runs on the live path (`runScriptBatch` →
`generateScriptForConcept` → `gate()`).

| rule | quote | status | stated to the model? |
|---|---|---|---|
| **§1.4** hook | *"Hook: 10 words maximum"*; `[HOOKS-COLD] §5` *"under 10 words"* | **PAPER ONLY.** No hook word count anywhere | **Approximately.** `SCRIPT_STRUCTURE_CRAFT` `:60` *"HOOK (the opening, under ~10 words)"*. The "~" loosens it, and "the opening" is scene 1, which the model writes as several sentences |
| **§1.9** max sentence and SD floor | *"Enforce a maximum sentence length **and** a minimum standard deviation of sentence length… cap at ~18 words for a 45s script, and reject any script whose sentence-length SD falls below ~4.0. Both numbers are 🔷."* | **PAPER ONLY** | **No number is stated.** `SPOKEN_REGISTER :119` "Short, breath-length sentences"; `:70` "If a line has a comma… split them". 🔴 **Contradicted** by generator `:97` *"Each scene is ONE spoken line of {min}–{max} words"*: 30–36 words at 60 s, 19–22 at 30 s |
| §2.1 fragmentation brake | *"The test: §1.9's SD floor."* | PAPER ONLY | no |
| **§2.2** test 1 | *"No n-gram of 4+ tokens may appear in more than two scripts in a set."* | **PAPER ONLY.** The per-concept prompt and gate have no knowledge of siblings | **no** |
| **§2.2** test 2 | *"Cross-script consistency of any named mechanism — one canonical term, and no two scripts may assert incompatible superlatives about the same finite set."* | **PAPER ONLY** | **Indirectly.** The mechanism name reaches the prompt only inside the cascade block (`Selected hero mechanism: "…"`, `cascadeContext.ts:426`). No instruction says to use it verbatim |
| **§3.2 rule 7** instrument | *"'Jaccard over content words, with this stoplist, dropping tokens under three characters, apostrophes retained' is a method."* Stoplist published at `:676-687` | **PAPER ONLY.** No metric code exists | n/a |
| §3.2 rules 1 and 5 compute and emit | *"Every claim… must be a value it calculated and emitted"*; *"name what it checked, what the value was, and what the threshold was — for every check"* | **PARTIAL.** Only failing classIds are emitted (`recordComplianceGate`), and no values | n/a |
| **contractions** | **No contraction rule exists in the spec.** §2.7 only measures contractions: *"Measure register on every surface — contraction density… and emit the delta between surfaces"* | PAPER ONLY (measurement, no threshold) | **Yes, as steering.** `SPOKEN_REGISTER :118` "Everyday contractions — you're, don't, it's…" |
| **narrator / voice** | **No narrator-identity rule exists in the spec.** §2.7 is register across surfaces; §4.3 is the unresolved second-person conflict | n/a in spec | **Yes, as steering (ZAP standard, not the spec).** `registerPersonGuidance` (`copywritingRules.ts:200-204`) *"PERSON — first person throughout. This copy is built from the coach's own experience"*; `HOOK_RULE :27-28` *"a specific moment the coach has lived… told from their side"*; `META_COMPLIANCE :97-98` "told from the coach's side" |
| §1.2 word budget ceiling | *"3.0 remains the reject threshold"* | **ENFORCED.** `conceptScriptValidator.ts:92` `if (totalWords > budget.max)` → hit → `gate` fails → retry → `throw` `:299` | yes |
| §1.2 floor (REQUIREMENTS R9) | budget.min | PAPER ONLY | yes ("HARD FLOOR") |
| §1.8 CTA in every script | *"Assert CTA presence structurally"* | PAPER ONLY | yes |
| §1.10 five beats / Turn | *"a reframe of the problem AND a named mechanism, both before the agenda"* | PARTIAL: only `scene[0].sceneType === "hook"` (`:78`) | yes |
| §1.11 / §2.4 compliance on every surface, every edit | *"runs over every surface, after every edit"* | **ENFORCED** within the script (spokenLine and onScreenText re-screened on every attempt, `:244-253`) | yes |

---

## F. Controls (§15c): each check can fail

### F.1 · The instrument reproduces the benchmark before any check is trusted

Parameters from §6.1: whitespace words; sentences split on `(?<=[.!?])\s+` and on line and paragraph breaks; hook = the first
sentence; contractions = tokens matching `letters'letters` (straight or curly apostrophes) per 100 words; SD = sample SD;
Jaccard = `[a-z']+`, min length 3, the §3.2 stoplist. **4-grams:** `[a-z']+` lower-cased tokens (curly apostrophes
normalised), no stoplist, counted as the distinct scripts containing each 4-gram. This parameter set reproduces §6.1's 16
and 29; §6.1 did not publish it, so it is published here.

- **Human, against the doc's Measured table:** words 9/9 exact; hook 9/9 exact; longest 6/9 exact (the table is pre-rename:
  CP3 17→18, CE2 12→15, CW2 15→16).
- **Human set values:** contractions 5.9 · longest 15.8 · SD 4.6 · mean sentence 7.8 · hook 7.6 · overlap 27.4/16.9 ·
  4-grams in 3+ scripts: 16. **All identical to §6.1.**
- **Kit 225 set values:** 4.0 · 25.2 · 7.4 · 11.8 · 16 · 39.4/27.4 · 29. **All identical to §6.1.** The only mismatch is
  "6 of 8 over 18"; the instrument measures 7 of 8.

### F.2 · Verdicts

| check | human 9 (must PASS) | kit 225 8 (must FAIL where §6.1 says) | mutation control |
|---|---|---|---|
| hook ≤ 10 | ✅ PASS 9/9 (max 10, CW3) | ✅ FAIL 225 (26) · 226 (16) · 228 (13) · 229 (31) · 230 (22) = the 5 in §6.1 | n/a |
| longest sentence ≤ 18 | ✅ PASS 9/9 (max 18) | ✅ FAIL 223 (29) · 225 (32) · 226 (22) · 227 (30) · 228 (22) · 229 (31) · 230 (22) | n/a |
| SD ≥ 4.0 (spec §1.9) | 🔴 **FAIL CP1 3.71, CE2 3.96. THRESHOLD PROBLEM** | FAIL 224 (3.54) only. The long sentences inflate the generated SDs, so this check does not catch problem 1 | n/a |
| 4-gram in > 2 scripts (§2.2 literal) | 🔴 **FAIL: 16. THRESHOLD PROBLEM** (14 still fail with each script's last paragraph removed) | FAIL: 29 | n/a |
| 4-gram in > ceil(n/3) scripts (**derived from the benchmark, not established**) | PASS: 0 (the human max share is 3 of 9) | FAIL: 14 | n/a |
| canonical-name variant | PASS; exact "SMB programme" found in 3 scripts (a positive artefact, not silence, §15k) | FAIL 229 only ("Career Layer Excavation"). Canonical names come from the DB: mechanism `Career Layer Excavation Process`, offer `The First Client Blueprint`, HVCO `The 90-Day First Client Script` | Injected "the Money Patterns" beside canonical "The Four Money Patterns": **fires on CP3, not on CP2's exact use.** Restoring 229's full name **clears it** |
| narrator mixed within a script (lexical proxy) | PASS; 6/9 narrators positively identified as audience, 3 unclassified | FAIL 223 · 227 · 229 | A coach "I built this process…" injected into CP1 **fires** |
| narrator class consistent across the set | PASS (audience only) | FAIL: coach {225, 226}, audience {230}, mixed {223, 227, 229} | **fires** |
| Jaccard overlap | no threshold: 27.4 / 16.9 | 39.4 / 27.4 | report only |
| contractions | no threshold: 5.9 (3.9–7.9) | 4.0 (1.8–6.3) | report only |

⚠️ **The narrator proxy disagrees with §6.1 on 223 and adds 227.** Both open in the meme format ("Me at 9am: …", "Me: …
Also me: …"), which voices the viewer. §6.1 called 223 coach. See P3(c).

---

## D. Proposals: enforced at generation time

### P1 · Sentence length: hook ≤ 10, every sentence ≤ 18

- **Where.** `validateScriptStructure` in `server/_core/conceptScriptValidator.ts`, as two new hit classes:
  `script_hook_over_word_limit` and `script_sentence_over_word_limit`. They run inside the existing `gate()`, on every
  attempt, in the same merged failContext as compliance and fabrication, so one redraft sees every constraint and a length
  fix cannot slip past the fabrication check (spec Part Two; §3.2 rule 4).
- **What it measures.** The §6.1 instrument, exactly:
  - each `spokenLine` is its own paragraph and is split on `(?<=[.!?])\s+`;
  - words are whitespace tokens (a spaced "—" counts, as in the benchmark; publish that parameter, §3.2 rule 7);
  - the hook is the first sentence of `scenes[0].spokenLine`.
- **Thresholds and sources:**
  - **hook ≤ 10.** Spec §1.4, CORPUS (`[HOOKS-COLD] §5`). Human max 10. The corpus's literal "under 10" would fail CW3;
    use the spec's "10 words maximum".
  - **sentence ≤ 18.** Spec §1.9, 🔷 INFERRED. §5.2 requires this limit to be *"labelled as"* an invention of the spec,
    so the classId description must say so. Human max 18 (i).
  - ⚠️ Spec §1.9 wrote 18 "for a 45s script". The human benchmark has no 60 s script, so applying 18 to 60 s scripts is an
    extension; state it.
- **On failure.** A post-hoc failContext about this output, carrying location and count, **not the sentence text**. For
  example: `scene[3], sentence 2: 30 words (ceiling 18)` and `scene[0], first sentence: 26 words (ceiling 10)`. Then a
  positive tail: *"Regenerate so every spoken sentence is 18 words or fewer and the hook's first sentence is 10 words or
  fewer, with the total still inside the word budget."* No failure exemplar enters any standing prompt (§14a).
- **Companion prompt correction (steering; required for convergence).**
  - `conceptScriptGenerator.ts:97` tells the model each scene is **"ONE spoken line of 30–36 words"** at 60 s (19–22 at 30 s).
  - The measured longest sentences sit on those bands: at 60 s they are 29, 30, 31 and 32; at 30 s they are 22, 22 and 22
    (224 is 14).
  - Without the correction the validator fights the prompt and attempts run out.
  - Proposed positive rewording: *"Each scene's spoken words total {min}–{max}, said as a few short sentences."*
  - `conceptScriptGenerator.test.ts:47-51` pins "breath"; keep it.
  - **This is a hypothesis from 8 scripts (MEDIUM).** The validator is the enforcement; the prompt change only reduces
    retries.
- **Retry budget.** Keep `MAX_ATTEMPTS = 3` (`:271`). Tests pin the shared compliance constant at 3
  (`complianceGate.test.ts:76`). **When attempts run out:**
  - the generator throws at `:299` and no row is written;
  - `runScriptBatch` marks that concept's job failed and moves to the next;
  - the screen shows it failed, and a re-request re-arms it.
  - **Do not ship the best failing attempt**, because that would quiet the symptom.
  - Before deploying, measure the first-pass block rate on these classes. The telemetry already records classIds; note that
    no script `dryRun` exists (82d1949 added one for concepts only).
- **Not gated:**
  - **SD floor:** the human set fails it (§F).
  - **Contractions:** no written threshold exists.
  - **Emit both values** (§3.2 rule 5) so the §1.9 risk stays visible, since a ceiling alone compresses variation. A column
    would be a migration, so use a log or telemetry line.
- **Maps to** (i) human max 18 and hook max 10 · (ii) §1.4, §1.9.
- **Confidence.** **HIGH** that the check is correct and enforces the written rule (a deterministic count, identical to the
  benchmark, with both controls behaving as required). **MEDIUM** that 3 attempts converge without the prompt correction.
- **Does it enforce the rule or quiet the symptom?** It enforces §1.4 and the §1.9 ceiling. It does not enforce the §1.9 SD
  floor, whose threshold fails the human positive control.

### P2 · Cross-script repetition: a set property enforced per concept

- **Where.** A pure `checkSetRepetition(candidate, siblings, canonicalNames, setSize)`, in `conceptScriptValidator.ts` or a
  new `_core/scriptSetValidator.ts`. It is called from `gate()`.
  - The siblings are `conceptScripts` rows with the same `scriptSetId` and `userId`, read **after the LLM returns, on every
    attempt**, and read again just before the INSERT.
  - An end-of-batch stage is rejected for this: see §B(1).
- **Measure 2a, the 4-gram share (§2.2 test 1).**
  - `[a-z']+` lower-cased tokens, apostrophes retained, curly apostrophes normalised, no stoplist. This is the parameter set
    that reproduces 16 and 29.
  - For each 4-gram in the candidate, count the distinct scripts containing it: siblings plus the candidate.
  - Exclude 4-grams that fall wholly inside an exact canonical-name span.
- **Threshold for 2a: 🔴 UNDECIDED. Needs a ruling; not picked here.**
  - **The literal §2.2 "> 2 scripts" fails the human positive control (16).** Those 4-grams are deliberate lines each stage
    shares across its three audiences (CP/CE/CW triplets) plus the logistics tail.
  - **Benchmark-derived candidate, (i) only, NOT established:** no 4-gram in more than ceil(n/3) scripts. Human: 0.
    Kit 225: 14.
  - **§2.2's internal conflict** (test 2 against test 1, §0) is resolved here by *reading* test 2 as exempting canonical-name
    spans. That is a reading, not a finding; surface it.
- **Measure 2b, the canonical name (§2.2 test 2).**
  - The names are fixed from the database, not taken from the model:
    - `campaignKits.selectedMechanismId` → `heroMechanisms.mechanismName`;
    - `selectedOfferId` → `offers.godfatherAngle $.offerName`, the part before the colon;
    - `selectedHvcoId` → `hvcoTitles.title`.
  - A Title-Case run of 2 or more tokens that is a proper sub-run of a canonical name, and is not inside an exact occurrence,
    is rejected as `script_mechanism_name_variant`.
  - Companion steering, positive: *"When the method is named, it is named "{mechanismName}", word for word."*
  - Limits:
    - it catches truncation and splitting (229), not synonyms ("the Excavation Method") or an invented second name;
    - "incompatible superlatives about a finite set" (the rest of test 2) cannot be measured lexically and **stays PAPER
      ONLY**.
- **On failure.** A post-hoc failContext: *"scene[2] shares the four-word run "your former industry will" with 5 other
  scripts in this set; say that idea in this script's own wording"*, and *"scene[3] names the method "Career Layer
  Excavation"; its name is "Career Layer Excavation Process"."*
  - ⚠️ **Needs a §14a ruling.** Quoting the run is post-hoc and about this output, and `validator.ts:97` is the precedent for
    quoting the model's own output. But §14a's test ("could the model reproduce this text as output?") literally catches a
    quoted phrase.
  - The fallback is location plus count only, which is weaker.
  - **Never list sibling phrases pre-emptively in the prompt.** That would be a generic, pre-emptive exemplar, which §14a bans.
- **Retry budget.** The same 3 attempts in the same merged pass. When they run out: throw, the concept fails, and the set is
  left one script short. The screen shows that concept failed. That is the correct result; writing a script over the bound
  would quiet the rule.
  - ⚠️ Later concepts take most of the retries (order dependence, §B).
- **Races.** See §B(2): serialised by the job claim; a residual one-over race through a reaper re-arm; closing it needs a set
  lock (its own item).
- **Jaccard overlap: emit only.** Spec §5.3 and §5.4 say no number exists for any bound.
- **Maps to** (ii) §2.2 tests 1 and 2 · (i) for the derived bound only.
- **Confidence.** Name check **HIGH** for truncation variants. 4-gram check **MEDIUM**: the threshold is undecided, a race
  remains, and the §14a ruling is open.
- **Does it enforce the rule or quiet the symptom?** It enforces §2.2 as written, once a threshold is set. **By the spec's own
  account it is a fix for the human viewer, not for semantic diversity:** *"Entity ID is assigned to MEANING, not to the
  string… Rewording nine sentences that all say the same thing buys nothing algorithmically."* A 4-gram gate can be satisfied
  by rewording the same idea, so the formula repetition's *meaning* is not addressed. No written rule covers that.

### P3 · Narrator voice

- 🔴 **NOT TIED TO script-rule-spec.md.** There is no narrator-identity rule in it, and none is invented here.
- **The written rules that exist are ZAP's prompt-level register standard**, all steering, none enforced:
  - `registerPersonGuidance` ("first person throughout… built from the coach's own experience");
  - `HOOK_RULE` ("a moment the coach has lived… told from their side");
  - `META_COMPLIANCE` ("told from the coach's side");
  - `REGISTER_STANDARD` ("speaks from what the coach has lived").
  - Together these establish **narrator = the coach**.
- **The human benchmark (i) supports consistency, not identity.** Its narrator is the *attendee*, held in all nine scripts.
- **(a) Placement: grounding.** Under narrator = coach, *"Me at forty-four", "my youngest", "my husband", "twelve years
  running procurement"* are the coach's autobiographical claims and must be in the coach corpus. **That is the fabrication
  gate's job, and it is the structural enforcement.**
  - It sits in the same `checkOutput` pass (`:245-253`).
  - Whether the gate catches personal-detail claims at all is for the **parallel grounding investigation**; all 8 scripts
    passed `requireGrounding: true`.
  - **Confidence:** HIGH for placement; adequacy UNKNOWN.
- **(b) A narrator-consistency check (lexical proxy)** in `gate()`:
  - classify first-person sentences by coach cues ("I built / I walk you / working with women / my clients / I watched a…")
    and audience cues ("Me: / me at / my husband|kids|youngest / I did|sat in|joined / I'll just / mine was");
  - reject a script that carries both cue types;
  - at set level, reject a narrator class that differs from the siblings', using the P2 sibling read.
  - Controls behave as required (§F).
  - **Confidence LOW:** the cue lists were hand-built on these 17 scripts (circular), are easy to game, and identify 6 of 9
    human narrators.
  - **It quiets the symptom more than it enforces the rule.** Recommend it only as a report line until (a) is settled.
- **(c) Decision required before (b), a conflict inside ZAP's own rules.**
  - `HOOK_RULE` makes the hook the coach's lived moment. The `meme_humor` hook pattern conventionally voices the viewer
    ("Me: … Also me: …").
  - 223 and 227 are "mixed" only because of that format.
  - Surface it; do not resolve it silently (§15g, spec §4).
- **Not proposed:** a `narrator` schema field. It would be steering, not enforcement (§15i).

---

## E. Grounding in the script path

- **Where the gate runs.** In `generateScriptForConcept`'s `gate()` (`conceptScriptGenerator.ts:245-253`), on every attempt,
  inside the one merged pass. It runs over `scene[i].spokenLine` (role `body`) and `scene[i].onScreenText` (role `short`),
  with `requireGrounding: true`. If the service row is missing, it blocks as `fabrication_check_unavailable`
  (`complianceAxis.ts:1263-1278`).
- **Corpus.** `buildCoachCorpus({service, groundingMeta})` (`groundingCorpus.ts:95-128`):
  - service fields: name, category, description, targetCustomer, mainBenefit, painPoints, whyProblemExists,
    uniqueMechanismSuggestion, coachBackground, pressFeatures, socialProofStat, the testimonial names and quotes;
  - the ICP's verbatim **ladder answers** only.
  - `supplied` comes from `buildProofSupplied(service)`.
- **The prompt sees more than the corpus.** It also gets the cascade block (offer, mechanism, HVCO, headlines, ad copy, all
  generated) and the concept's generated persona and desire. The gate judges against the narrower, coach-only corpus. That
  asymmetry is by design, and it is why the adequacy question belongs to the parallel investigation.
- **Where the new checks sit relative to the gate.** The same `gate()` and the same pass. Suggested order:
  1. structure, including P1;
  2. compliance;
  3. `checkOutput` (compliance axis and fabrication);
  4. the P2 and P3(b) set checks.

  All failContexts are merged and one redraft answers all of them, because a retry that shortens sentences can otherwise
  reintroduce an ungrounded detail (spec Part Two).
- **Whether the gate itself is adequate depends on the parallel grounding investigation.** No proposal here relies on it being
  adequate; P3(a) only depends on it.

---

## G. Confidence and honesty

| proposal | confidence | enforces the written rule, or only quiets the symptom? |
|---|---|---|
| P1 hook ≤ 10 · sentence ≤ 18 | **HIGH** (check) · MEDIUM (convergence without the prompt fix) | **Enforces** §1.4 and the §1.9 ceiling. The §1.9 SD floor is not enforced (threshold fails the human set) |
| P1 prompt-line correction | MEDIUM | Steering only. Reduces the retries the check causes; enforces nothing |
| P2 canonical name | **HIGH** | **Enforces** §2.2 test 2's name half, for truncation and split variants. The superlatives half stays paper only |
| P2 4-gram share | **MEDIUM** | Enforces §2.2 test 1 **once a threshold is chosen**. By the spec's own statement, it does not enforce semantic diversity |
| P3(a) grounding placement | HIGH placement · adequacy unknown | Enforces ZAP's grounding standard if the gate is adequate (parallel investigation) |
| P3(b) narrator proxy | **LOW** | **Mostly quiets the symptom.** A cue list tuned on the evidence it is tested against |
| contractions, Jaccard, SD | n/a | **No established threshold.** Emit only; no proposal to gate |

## Decisions needed (none taken here)

1. The §2.2 4-gram threshold: literal (fails the human set) or derived from the benchmark (ceil(n/3)), and whether
   canonical-name spans are exempt.
2. §14a: may a retry failContext quote the model's own repeated run?
3. meme_humor: may that hook pattern voice the viewer, given narrator = coach?
4. Authorisation to lift the moderate build's "no set-level checks" exclusion for P2.
5. Whether the 18-word ceiling (written for 45 s) applies to 60 s scripts.
