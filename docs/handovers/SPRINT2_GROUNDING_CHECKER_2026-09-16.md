# SPRINT 2 — Grounding checker (F2 speaker facts + F5 viewer financial information), record-only

**Date:** 2026-09-16 · **Base:** `64b2e7c` (docs/held-2026-09-12; sprint 1b `41c817c` confirmed an ancestor) · **Not pushed.**
Plan: `BUILD_PLAN_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md` §2 Phase C. Design: proposal §2 F2 / §3, addendum §2–§5.

> ⚠️ **§15d, stated deliberately: NOTHING in production code calls this module.** It is not wired into any generator,
> gate, router or publish path. Its only callers are `server/groundingChecker.test.ts` and
> `server/scripts/grounding-checker-eval.ts`. Wiring is sprint 3. It never blocks anything; its output is labels.

## 1. Files

| file | what |
|---|---|
| `server/_core/groundingChecker.ts` | the module: one model call per asset, deterministic verification and verdicts, retry-safe renderer |
| `server/__fixtures__/groundingCheckerScripts.ts` | 7 whole-script fixtures with verdicts fixed before any live run, plus the shared scorer |
| `server/groundingChecker.test.ts` | 53 unit tests, LLM mocked |
| `server/scripts/grounding-checker-eval.ts` | live harness: N runs per fixture, per-class report |

Untouched (sprint 3): `copywritingRules.ts`, `fabricationValidator.ts`, `complianceAxis.ts`, `publishBlockMessage.ts`, every
generator, `client/src/pages/`. Nothing removed (§15j).

## 2. API

```ts
checkGrounding(asset: CheckedAsset, coachFacts: CoachFactsResult, options?: { invoke?, model? }): Promise<GroundingCheckResult>
renderRetryNote(result: GroundingCheckResult): string
```

- **`CheckedAsset`** = `{ assetType, assetId?, fields: [{ name, text }] }`. All fields are read in ONE call.
- **`coachFacts`** is `buildCoachFacts` output, and nothing else. It already carries the A2 operator-captured offer facts
  (`campaignFacts` event schedule and price, `placeholderValues`). There is no second input for "offer facts": the
  selected offer row is generated text, and generated text never grounds. Never `buildCoachCorpus`.
- **The call:** `invokeLLM` with `strictToolUse: true` and one `json_schema` tool, `grounding_check`, carrying three lists:
  - `speaker_claims[]`: `quote`, `kind` (age · family · career · tenure · date · place · life_event · credential · witnessed_event
    · practice · offer_outcome), `specificity` (specific | unspecific), `slot` (none | people_trained | countries |
    years_experience | clients_served | headline_credential), `normalised_value`, `evidence`, `certainty_markers[]`;
  - `viewer_financial_findings[]`: `quote`, `attribute` (income · pay · savings · money_location · investments ·
    debts_credit · net_worth · business_revenue · spending);
  - `beats[]`: `quote`, `beat` (hook · problem · reframe · mechanism · credential · offer · logistics · cta).
- **The model sees only groundable facts.** Superseded values never reach the prompt; they are used in code for slot
  comparison only.
- **`GroundingCheckResult`**:
  - `status`: `checked` | `extraction_failed` | `empty_input`;
  - `recordOnly: true`;
  - the verified `speakerClaims`, `viewerFinancialFindings` and `beats`, plus `sentenceCount`;
  - `counts`: by verdict; specific biography ungrounded; conflicts; overstated; not_checkable; viewer financial;
    unverified evidence;
  - `extractionErrors`: call errors, malformed responses, unverified claim / financial / beat quotes, responses without
    beats, total;
  - `rejectedQuotes` (for humans), `attempts[]` (outcome, model, latency, tokens), and `usage` (calls, tokens, latency,
    models).
- **Model:** the default `invokeLLM` ladder unless `options.model` is set. The requested max tokens is ignored by
  `llm.ts`, which always sends 8192, so the module does not pass one.

## 3. Verification and verdicts (all in code, never trusted from the model)

**Normalisation (both sides of every test):** NFKC; curly single and double quotes made straight; the hyphen and dash
family made `-`, with spaces around a dash collapsed; whitespace collapsed; case folded. A quote's edge punctuation is
trimmed, and its body must match.

**Quotes.** A quote must be a substring of ONE field; a quote spanning two fields fails, and so does one under 3
characters. An unverified quote is an extraction error. It is counted, listed in `rejectedQuotes`, and never becomes a
finding.

**Evidence** verifies only if all of these hold:
1. It is non-empty, at least 3 characters, and has a token of 2 or more alphanumerics.
2. It is a substring of ONE groundable fact's value. A span joined across two facts fails.
3. **D-a:** for a biography kind, the containing fact is not a `coach_confirmed_rewording`.
4. **Number cross-check:** when the quote carries numbers (a bare pronoun "one" excluded), the evidence carries at
   least one of the same numbers. A real span that states a different fact cannot ground a figure.

**Numbers.** Handled forms:
- digits, with thousands commas and a `k` suffix;
- number words: "fifty-two" = 52, "forty nine" = 49, "one hundred and twenty" = 120;
- scales: "a million" = 1,000,000, "two million";
- groups: "a dozen" = 12, "a decade" = 10, "two decades" = 20;
- "twenty-five years" = 25.

For a count slot, years after since / in / from / until / by / of are excluded.

**Verdict precedence per claim:**

| verdict | rule |
|---|---|
| `not_checkable` | `specificity = unspecific` (D-c). Ignored by every count of findings and by the renderer |
| `conflicts_with_current_fact` | single-valued slot with a canonical value, and the copy's value differs. Count slots: the canonical value must parse to exactly one number; the copy's value is the quote's single number, or the model's `normalised_value` when it is one of several numbers in the quote; otherwise `undetermined`, which falls through. `headline_credential`: a conflict only when the quote carries a superseded value and not the canonical one. Outranks verified evidence |
| `ungrounded` | specific, and evidence did not verify |
| `overstated` | a grounded `offer_outcome` whose quote carries a certainty marker absent from every fact the evidence was found in. Markers: lexicon (exactly, precisely, guaranteed, always, every time, without fail, 100%, definitely, proven, …) plus model-reported markers verified in the quote |
| `grounded` | specific, evidence verified, none of the above |

**A3: extraction failure.**
- **Malformed** means any of: the call threw, the response is not JSON, a list is not an array, or an item is out of shape
  or outside its enum.
- **Unverifiable** means any claim or financial quote failed verification, or **no beat label verified** on non-empty copy.
  That last case is §15k: silence must fail.
- Either outcome triggers **one re-extraction**. After that the status is `extraction_failed`.
- It is **reported, never read as "no findings"**. The last well-formed attempt's verified findings are kept for humans.
- Beat-quote failures are counted but do not by themselves trigger a re-extraction.
- `renderRetryNote` returns "" for a failed extraction, because the copy is not at fault.

**Retry-safe renderer (quoting ruling).** One abstract line per class present:
- specific biography ungrounded (kinds only);
- slot conflict (slot names only);
- unsupported practice or offer statements;
- overstated certainty;
- viewer finances (attribute names).

Each line gives a positive route (§14). **No counts or figures of any kind**, so no number can coincide with one in the
copy. The pin: the note contains no quote, no three-word run of any quote, no digit and no number word.

## 4. D-c handling

The prompt defines **specific** as a claim carrying a checkable fact: a name, age, employer, job title, year or date,
number, place, named family member or named event. For practice and offer outcomes it means a definite statement.
**Unspecific** is narrative colour with none of those. An unspecific claim gets `not_checkable` whatever its evidence.
It is extracted and shown, but it is not a finding. The D-c fixture requires **at least one `not_checkable` claim** and
zero flagged specific biography. A run that extracts nothing fails the control (§15k).

## 5. Fixtures (whole scripts; expected verdicts written before running)

| id | script | facts (through the real `buildCoachFacts`) | expected |
|---|---|---|---|
| `k225-s229` | kit 225 script 229, SAY lines verbatim | ladder answers, "mind coach"; the intake rewording is refused | ungrounded specific biography: forty-four · youngest / university · procurement / global firm / twelve years · since 2021. No F5 |
| `p1-with-facts` | coach-voice P1 verbatim | coachFacts rows: years_experience "Twenty-five years"; presenter "My brother Shez presents…"; event facts | grounded: twenty-five years · Shez. F5 controls: pension line, "None of them is money" |
| `p1-without-facts` | same P1 | event facts only | ungrounded: twenty-five years · Shez |
| `dc-control` | synthetic; only unspecific first-person moments | ladder answers, event facts | 0 flagged specific biography, ≥1 not_checkable |
| `f5-controls` | synthetic script | event facts | find: well paid / current account · your savings · credit card. Not find: can't afford (idiom) · people in their fifties (third person) · if you're earning well (conditional) |
| `conflict-countries` | synthetic | countries 49 (2025, superseded) and 52 (2026, canonical); years 25 | conflict: forty-nine. Grounded control: twenty-five years |
| `certainty` | synthetic | ladder answers stating the outcome without certainty | overstated: "exactly … guaranteed". Grounded control: written plan |

**Scoring.**
- An expected item is an anchor set, matched when a finding's quote contains any of its anchors.
- One quote may satisfy two items, so recall is lenient on clause granularity.
- A run that does not finish `checked` scores every expected item as missed and adds no false positives.
- Every flagged specific-biography claim that matches no expected item is a false positive. So is every F5 finding that
  matches no expected item. No tolerance lists.

## 6. Unit tests — `server/groundingChecker.test.ts`, 53/53 (LLM mocked)

The tests cover:
- quote verification: quote-mark and dash variants; altered, short and cross-field quotes;
- 13 number forms and the pronoun "one";
- evidence: a verified span; fabricated, joined-across-facts, short and empty spans; the number mismatch; D-a;
- each verdict, including conflict over evidence, the year exclusion, no canonical value, and the text-slot conflict;
- certainty: overstated, the fact carrying the marker, ungrounded outcomes, the biography exemption, model markers;
- F5: verified findings, and an unverified quote leading to a re-extraction;
- A3: throw twice, malformed twice, malformed then good, a bad enum, unverifiable twice, no beats (silence), empty input;
- call shape: one strict call, all fields together, superseded values absent, and usage recorded;
- the §14 pin: no fixture sentence in the prompt;
- slot-list parity with coachFacts;
- import hygiene: the only runtime import is `./llm`;
- the renderer's no-quote pin, and its empty output on a clean result;
- fixture self-consistency: every anchor occurs in its script, and the facts the builder derives contain what each fixture
  needs and none of the invented biography;
- the scorer: silence scores as a miss, a failed run scores nothing, the D-c control fails on silence, and F5 control
  hits are recorded.

**Mutation controls (§15c).** Each rule was broken in `groundingChecker.ts` and the suite re-run. The file was restored
byte-identical (sha256 `80af0ac2abc9…` before and after).

| mutation | failing tests |
|---|---|
| quote verification disabled | 3 |
| unverified claim quote kept as a finding | 1 |
| evidence verification disabled | 2 |
| D-a rewording filter disabled | 1 |
| evidence number cross-check disabled | 1 |
| D-c exclusion disabled | 1 |
| number word "forty" removed | 4 |
| "a" before a scale not read as one | 2 |
| hyphen compounds: both split mechanisms removed | 6 |
| year-after-since exclusion disabled | 1 |
| conflict verdict disabled | 4 |
| overstated verdict disabled | 2 |
| certainty not compared with evidence | 1 |
| re-extraction removed (1 attempt) | 5 |
| extraction failure reported as checked | 5 |
| silence guard (no beats) disabled | 1 |
| renderer quotes the flagged text | 1 |
| superseded values shown to the model | 1 |
| curly apostrophe not normalised | 2 |
| strict tool use off | 1 |

📌 **Recorded mutation-run defects.**
- **An equivalent mutant.** Disabling only the hyphen-to-space replace in `extractNumbers` fails nothing. The tokeniser
  already splits on hyphens, so the two mechanisms are redundant. Both were kept (§15j). Removing both fails 6 tests
  (row above).
- **A mutation that never ran.** The first curly-apostrophe mutation made no change: `$&` in a replacement string
  re-inserts the match. It was re-run with a function replacer, and the script now refuses a no-op mutation.

## 7. No database access — proof

- **The module.** Its runtime imports are `./llm` → `./env`. `./coachFacts` is imported with `import type`, which is
  erased at compile time. This is pinned by a unit test.
- **The harness.** An esbuild bundle metafile lists every file reachable from the harness:
  - `grounding-checker-eval.ts` and `groundingCheckerScripts.ts`;
  - `_core/`: `groundingChecker`, `llm`, `env`, `coachFacts`, `groundingCorpus`, `validator`, `icpPrompts`,
    `mechanismStandard`, `copywritingRules`;
  - `lib/complianceFilter`.

  Its only external imports are `fs`, `os` and `path`. The bundle's single match for `mysql|drizzle|getDb|DATABASE_URL`
  is `env.ts` copying the environment variable into a config object. Nothing opens a connection. Railway was used only
  to inject `ANTHROPIC_API_KEY`.

## 8. Live evaluation

**How it ran.** `railway run --environment production --service coachflow npx tsx server/scripts/grounding-checker-eval.ts
--runs 3 --label run1`. Railway injected the API key only. It ran **once**, with 7 fixtures × 3 runs, making 21 calls.

**The prompt was not revised.** There is one run, and no second prompt version exists. The weakness found (F5, below)
was not tuned against the fixtures.

- **Full report:** `SPRINT2_GROUNDING_CHECKER_EVAL_RUN1_2026-09-16.md`, committed.
- **Raw JSON:** kept in the scratchpad at `sprint2/live/grounding-checker-eval-run1.json`, not committed.

| class | measured |
|---|---|
| **F2 specific biography recall** | **18 / 18 (100%)**: every expected item in every run. Script 229: forty-four, youngest/university, procurement, since 2021, 3/3 runs. P1 without facts: twenty-five years, Shez, 3/3 |
| **F2 specific biography precision** | **25 / 28 (89.3%)**. The 3 false positives are all in script 229: 2 × "finally ready to launch the consulting business" (life_event) and 1 × "So I built a forensic process — Career Layer Excavation…" (credential). On review the first reads as a real invented career claim the fixture labels did not anticipate; the second is a method claim mis-kinded as a credential. Scored as labelled before the run, not re-adjudicated |
| F2 grounding (must ground) | **9 / 9**. P1 with facts: twenty-five years and Shez grounded 3/3. The conflict fixture's twenty-five years was grounded 3/3 |
| **F5 recall** | **9 / 9 (100%)** |
| **F5 precision** | **12 / 19 (63.2%)**. False positives: **6 × "Nobody's building a pension behind a salary any more."** (P1, both variants, every run, read as `income`), the general-statement case the addendum §4 probe flagged; **1 ×** the conditional "If you're earning well…" (1 of 3 runs). The idiom "can't afford to get this wrong" and the third-person "people in their fifties" were **not** flagged in any run |
| **D-c** | **3 / 3** control runs had zero flagged specific biography and 2 `not_checkable` claims each |
| **conflicts** | **3 / 3** detected; 0 false positives |
| **certainty (overstated)** | **3 / 3** detected; 0 false positives. The grounded-without-marker control stayed grounded 3/3 |
| **extraction errors** | **0** in 21 calls: no call errors, no malformed responses, no unverified quotes (claims, financial or beats), no silent responses. 0 re-extractions. Beat labels verified for 213 / 213 sentences |
| model | `claude-sonnet-4-6` on all 21 calls (the ladder head); no strict-schema downgrade was logged |
| **latency** | median **8.3 s**, max **17.6 s** per call. Script 229 took 16–17.6 s |
| **tokens** | input mean **2,206**, max 2,412; output mean **673**, max 1,017 |

**Verdict totals over 21 assets:**
- **Claims by verdict:** 65 ungrounded · 33 grounded · 15 not_checkable · 3 conflicts · 3 overstated.
- **Claims by kind:** 57 offer_outcome · 19 practice · 12 tenure · 9 family · 6 life_event · 4 credential · 3 age ·
  3 career · 3 date · 3 witnessed_event.
- **Evidence rejections:** 71 no evidence · 9 number mismatch · 3 too short.

**Findings from the numbers:**
- **Latency and output are ~4× and ~8× the proposal §3.2 probe** (2.0 s median; 84 output tokens). The cause is the
  combined call: the beat labels (one per sentence) and the offer-outcome claims dominate the output. A kit's scripts at
  3 attempts are still within budget as a background label, but **at a Meta publish check a user would wait ~8 s per
  asset**. Sprint 3 should weigh splitting the beat list off the F2/F5 call, or running it only where P2 needs it.
- **F5 is the precision problem, and it is systematic, not noise.** The P1 pension line was flagged 6/6. By the rule it
  is a general statement. It says nothing about the viewer. **F5 is not ready for any tier above a label.** The fix is a
  sprint-3 question: describe the general-statement category more exactly, or require a second-person or presumptive
  form deterministically before a finding counts. It must then be re-measured on held-out copy, not this fixture.
- **The number cross-check behaves as designed, and bluntly.** All 9 mismatches are event lines. 6 are "Sunday I take you
  through all four… inside ten minutes" (P1) and 3 are "On Sunday I walk through… from zero. Two hours" (F5). The model
  cited "Sunday" as evidence, and the figures are not in that span, so both lines read `ungrounded` offer outcomes.
  Neither is biography, so neither is a precision error above. They are exactly what a blocking tier would dead-end
  (K9/A2).
- **The conflict fixture's model cited the canonical "52" as evidence for "forty-nine".** It was rejected as too short,
  and the conflict verdict held, since conflict outranks evidence. The model's `slot` assignment was correct 3/3.

## 9. Gates (measured at run time in this worktree, §15f)

| gate | before (base `64b2e7c`) | after |
|---|---|---|
| `tsc` errors | 34 | 34 |
| coachFacts.test.ts | 21/21 | 21/21 |
| fabricationValidator.test.ts | 23/23 | 23/23 |
| fabricationGateDefects.test.ts | 15/15 | 15/15 |
| _core/complianceCheckerPrecision.test.ts | 63/63 | 63/63 |
| complianceGate.test.ts | 24/24 | 24/24 |
| pipeline-fixes.test.ts | 414/414 | 414/414 |
| groundingChecker.test.ts | — | 53/53 |

NUL bytes in every new file: 0. The module's normalisation regexes are written as ASCII `\uXXXX` escapes, not raw
characters.

## 10. Known limits

- **7 fixtures × 3 runs is a probe, not a corpus.** Tier promotion (D-e / D-g / D-h) needs a larger labelled corpus of
  real generated copy.
- **Clause granularity.** Recall counts an expected item found when any flagged quote contains its anchor. A single quote
  covering an age and a family member satisfies both.
- **The number cross-check is conservative.** A true claim whose supporting fact states the figure differently fails it
  and reads as ungrounded. Example: a quote of "four patterns" with evidence of "Sunday". That pushes toward ungrounded,
  the safe direction for a record-only label.
- **Slot conflicts need the model to assign the slot.** If it returns `none`, a stale figure reads as `ungrounded`, not
  `conflicts_with_current_fact`. A text slot (`headline_credential`) conflicts only on an exact superseded value.
- **`overstated` compares marker words, not meaning.** Strength expressed without a lexicon word, or a marker present in
  the fact with a different scope, is not detected.
- **Beat labels are verified for quote only.** The label itself is the model's judgement. No structural comparison is
  built yet; that is addendum §2, P2.
- **The prompt was not tuned against the fixtures.** See §8 for how many prompt revisions were run.
- `rejectedQuotes` and findings carry verbatim copy for humans and logs. Only `renderRetryNote` output is fit for a retry
  prompt.
