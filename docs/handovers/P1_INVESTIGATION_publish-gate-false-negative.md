# P1 — Publish gate does not fire on real invented proof

**Investigation only. Nothing built.** Traced at `HEAD = 1b282f8`.

---

## 1. Both causes confirmed — but the map is different from the banked version

### The banked claim was too kind. There are THREE systems, not one missing wire.

| Module | What it is |
|---|---|
| `server/_core/validator.ts` (~1900 ln) | **Legacy per-asset catalogs**, predating the compliance layer. `validateOfferFabricationPatterns`, `validateEmailFabricationPatterns`, `validateWhatsappFabricationPatterns`, `validateBonusFabricationPatterns`, `validateLandingPageTestimonialsFabrication`. Cross-check against `supplied` operator data. |
| `server/_core/fabricationValidator.ts` (430 ln) | **The Class-1/2 anti-fabrication validator.** Corpus + supplied. |
| `server/_core/complianceAxis.ts` (840 ln) | **Meta Tier-1 checks.** Imports and calls `checkFabrication`. |

The compliance layer was added **alongside** the legacy validator, not replacing it. So coverage is
**bifurcated, not absent** — which is why it looks inconsistent.

### Guard matrix [CODE — confidence HIGH]

| Generator | Legacy catalog | Compliance layer (`checkOutput`) |
|---|---|---|
| `adCopyGenerator` | — | ✅ |
| `conceptGenerator` | — | ✅ (+ `complianceFilter`, `screenConceptCompliance`) |
| `conceptScriptGenerator` | — | ✅ |
| `landingPageGenerator` | ✅ LP testimonials | ✅ |
| `landingPagePublisher` | — | ✅ |
| `meta.publishToMeta` | — | ✅ |
| `offersGenerator` | ✅ | — |
| `emailSequenceGenerator` | ✅ | — |
| `whatsappSequenceGenerator` | ✅ | — |
| `bonusGenerator` | ✅ | — |
| **`heroMechanismsGenerator`** | **—** | **—** |
| **`hvcoGenerator`** (lead-magnet title) | **—** | **—** |
| **`leadMagnetContentGenerator`** (body) | **—** | **—** |
| **`headlinesGenerator`** | **—** | **—** |
| **`adCreativesGenerator`** | **—** | **—** |
| **`bonusPdfGenerator`** | **—** | **—** |

**Six generators are in neither system.** Two guard families, neither universal.

⚠️ **And the legacy guards did not save the assets they cover.** Email 3 and WhatsApp 2 both carried
full invented case studies in the live run, and both generators *have* a legacy validator. So this is
not only a coverage problem — **detection is insufficient in both families.**

### Cause (a) — confirmed, with the mechanism's position as the aggravating factor

`heroMechanismsGenerator.ts` has no guard of any kind and sits upstream of the whole cascade. Its
*"Developed after working with over two hundred families… Most families reach… by night fourteen"*
propagated into the lead magnet, ad copy, email and WhatsApp. It did **not** reach the published
landing page — the guarded surface held.

### Cause (b) — confirmed, and the wiring is NOT at fault

`complianceAxis.ts:826-834` correctly calls `checkFabrication` and pushes `fab.blocking` into
`blocking`. **The gate is plumbed correctly; the detectors returned nothing.** [CODE — HIGH]

---

## 2. Three further defects found, not previously banked

**(i) `isLaunchStage` is DEAD CODE.** Computed at `groundingCorpus.ts:120`, **read nowhere in the
codebase**. The documented rule — *"unearned authority blocks for a beginner, passes for a veteran"* —
is **not implemented** in the blocking path. This matters enormously for §3 below: the single
cheapest, highest-precision signal already exists and is thrown away. [CODE — HIGH]

**(ii) `buildProofSupplied` hardcodes `price: null, guaranteeType: null, guaranteeDuration: null`**
(`groundingCorpus.ts:151-153`). The guarantee cross-check can never see supplied guarantee data
through this path. [CODE — HIGH]

**(iii) The proper-noun detector is gated behind `ATTRIBUTION_CUE`** (`fabricationValidator.ts:324`) —
it only runs if the text contains "says", "featured", "according to", "endorsed by"… *"Sarah got her
baby sleeping 12 hours in 4 days"* has no attribution cue, so **the named-third-party check never
executed either.** Two independent detectors both missed the same string. [CODE — HIGH]

---

## 3. THE STRUCTURAL FINDING — the corpus is an allow-list, never a detector

This is the answer to "does the grounding corpus generalise here".

`corpus` is used in **exactly three places** in `fabricationValidator.ts`:

| Line | Use | Effect |
|---|---|---|
| 177 `statSupported` | do the matched digits appear in corpus text? | **ALLOW** only |
| 231 `unsupportedProperNouns` | does the capitalised name appear in corpus? | **ALLOW** only (and gated behind `ATTRIBUTION_CUE`) |
| 334 `checkPersonaTraceability` | word overlap with corpus | **tier 2 — never blocks** |

**Detection is 100% regex. The corpus is only ever consulted *after* a regex has already fired, to
excuse the hit.** It can lower false positives; it can never catch anything. **So no amount of
corpus intelligence, in the current shape, can fix a missed phrasing — by construction.** [CODE — HIGH]

That is the real reason "add more regexes" reproduces the problem: the architecture makes the regex
the sole decider, and the evidence layer purely subtractive.

---

## 4. Proposal for (a) — wiring `checkOutput` everywhere is the wrong primary move

**Recommendation: one shared implementation, two enforcement points, not sixteen.** [Design — MEDIUM]

Wiring `checkOutput` into the six unguarded generators would be sixteen call sites across two
incompatible guard families, each a future chance to be missed — and we already have proof that
happens six times over. It would also double-validate the four legacy-guarded generators under two
different definitions of "fabrication".

Instead:

1. **Consolidate the two families behind one `checkFabrication`.** The legacy catalogs contain real,
   working detection (the offer validator fired correctly in an earlier run — that value must not be
   thrown away). Fold them in as **additional detectors feeding one decision**, rather than as a
   parallel system with its own verdict.
2. **Keep per-generator checks — but for RETRY, not for gating.** Their real value is the
   `failContext` regenerate loop (retry 1→3): they make the model produce better copy rather than
   just refusing. A terminal gate can only block.
3. **Add ONE cascade-level assertion at the persistence boundary** — no asset persists carrying a
   blocking-class hit. This is the choke point that cannot be forgotten when generator #17 is added.
4. **Sequence by blast radius:** mechanism first (upstream, propagates to five downstream assets),
   then lead-magnet title + body (the coach-facing deliverable), then headlines.

---

## 5. Proposal for (b) — what replaces surface matching

**The corpus does generalise, but not as a bag of words.** Three layers, cheapest first.

### Layer 1 — invert the question, and use the signal that already exists

Stop trying to detect *fabrication* (open-ended surface forms). Detect **proof-shaped claims**
(closed, small surface: a numeral + unit, a percentage, a named person, a client/family count, a
guarantee, a result-in-a-timeframe) and then **require grounding**.

Claim-detection is far more robust than fabrication-detection because the forms of *evidence* are a
small closed set, while the forms of *invention* are unbounded.

**And for the beginner case it needs no reasoning at all.** `isLaunchStage === true` means the coach
supplied **no proof of any kind** — so *any* proof-shaped claim is unsupported **by definition**.
That is a hard, deterministic, near-zero-cost rule, and it would have caught **all four planted
strings and all five real ones** in this run. The signal is already computed and currently discarded.

⚠️ Product question this raises, for Arfeen (§7): does this also forbid a beginner writing *"most
families reach…"*? That is generic-population language with no client behind it. Strictly it is
unsupported; commercially it may be acceptable. **This one decision sets the strictness of the whole
layer.**

### Layer 2 — an LLM judge for the residual only

Only for claims that are proof-shaped **and** the coach has *some* proof (so Layer 1 can't decide).
Question per claim: *is this supported by the coach's supplied words?* — corpus in the prompt.

**Costs, honestly [MEDIUM–LOW confidence, not measured]:**
- **Latency:** ~1–3s per gated surface. Irrelevant mid-cascade (already minutes). Noticeable but
  acceptable at the publish gate, which is a deliberate user action.
- **False positives:** the real risk. A blocking FP dead-ends a beginner — the exact failure the
  July FP sweep existed to prevent. Bound it by only invoking on proof-shaped claims, and by
  **disposition-by-surface**: drop-the-variant where a deck exists (adCopy already does this), retry
  with failContext where regeneration is possible, hard-block only where there is no alternative.
- **Non-determinism:** an LLM judge cannot carry hard blocks or you cannot write a stable test.
  **Deterministic rules must own the blocking decision; the judge is advisory + retry-trigger.**

### Layer 3 — keep the regexes as a fast pre-filter, never as the decision

And fix the four known holes as regression tests regardless (see §6).

---

## 6. Proposal for the test suite — measure behaviour, not fixtures

**The governing principle: a detector's tests must be authored from OUTPUTS, not from the detector.**
If the same author writes the regex and the test string, the test can only confirm the regex matches
itself. That is precisely how 23/23 stayed green while the gate was blind.

**This is already precedented in this very codebase.** `complianceAxis.ts:31-34` documents an
earlier bug in the same module: *"The lazy form type-checked and passed every unit test — the tests
call `checkComplianceAxis` directly and never exercised `checkOutput` WITH grounding — but threw on
the first real generation. **Caught by the end-to-end run, not by the suite.**"* Same failure mode,
same file, already written down. It should be treated as a standing lesson, not a one-off.

Four layers; only (i) exists today:

**(i) Unit/fixture tests** — keep, but they may **never** be the coverage criterion.

**(ii) A held-out adversarial corpus.** ~100 real-shaped invented-proof strings **harvested from
actual generated output across niches**, authored without sight of the regexes. Metric = **recall,
asserted with a floor** (e.g. ≥90%), not "all pass". Every real miss found in production is appended
— it only ever grows. This run contributes nine.

**(iii) Paraphrase / mutation testing.** For each known-blocking string, auto-generate variants:
swap the noun (`consultants → clients → families → parents`), swap the number form
(`87% → ninety-four percent → 9 in 10`), move the possessive (`of consultants → of my clients`).
Assert the **class** still blocks. **This exact mutation is what would have caught the `of my`
exemption the day it was introduced.**

**(iv) A scheduled end-to-end assertion.** Run a beginner cascade; assert no blocking-class string
survives into persisted assets. Expensive — run pre-release or nightly, not per-commit. **This is
the only layer that actually caught the bug.**

**Immediately:** the five real phrasings become permanent regression tests —
`94% of my clients…`, `Sarah got her baby…`, `Guaranteed results or your money back`,
`working with over two hundred families`, `Most families reach… by night fourteen`.

---

## 7. Split — Arfeen (product) vs us (technical)

### 🔴 Needs Arfeen — these are brand/honesty calls, not compliance necessities

**Framing that matters:** **invented proof is NOT one of the six Tier-1 checks** in
`META_AD_COMPLIANCE_REFERENCE.md` §3.3. Those six are Meta-policy checks. Fabrication is **ZAP's own
honesty standard**; its nearest Tier-1 anchor is §1.6 *deceptive practices*, which is broad and
unenumerated. **So how hard this blocks is a product decision, not something Meta forces.**

1. **How hard should invented proof block?** Always / only at publish / drop-variant-and-label.
2. **May a beginner use generic-population language** (*"most families reach…"*) with no client
   behind it? This single answer sets Layer 1's strictness and is the highest-leverage decision here.
3. **Is an LLM judge acceptable in the publish path** — latency, cost, non-determinism.
4. **P2 is the same question in template form** — "Trusted by high achievers" is hardcoded chrome, so
   whatever standard is set for generated copy should govern it too.

### ✅ We settle these — no product input needed

- Consolidating the two guard families behind one implementation
- The persistence-boundary assertion + wiring the six unguarded generators
- `isLaunchStage` dead code — implement it or delete it (it must not stay as a lie in the docstring)
- `buildProofSupplied` hardcoded nulls
- `ATTRIBUTION_CUE` gating the proper-noun check
- The four-layer test shape, and the nine regression strings

---

## 8. Confidence

| Claim | Confidence | Basis |
|---|---|---|
| Guard matrix, 6 generators unguarded | **HIGH** | [CODE] direct grep of every generator |
| Gate wiring correct; detectors blind | **HIGH** | [CODE] `complianceAxis.ts:826-834` + live gate returning `ok=true` |
| `isLaunchStage` dead | **HIGH** | [CODE] grep — 2 hits, both in its own definition |
| Corpus is allow-list only | **HIGH** | [CODE] all 3 use sites enumerated |
| `ATTRIBUTION_CUE` blocked the Sarah catch | **HIGH** | [CODE] line 324 |
| Legacy guards also insufficient | **HIGH** | live run — email/WA both guarded, both leaked |
| Consolidate-don't-wire-16-places | **MEDIUM** | design judgement |
| Layer-1 beginner rule catches all 9 | **MEDIUM-HIGH** | reasoned from `isLaunchStage` semantics; **not executed** |
| LLM-judge latency/cost figures | **LOW-MEDIUM** | **not measured** |

---

# BUILD — 2026-07-28. Rule 1 implemented and verified.

## What shipped

**New `server/_core/trackRecordClaims.ts`** — the METHOD vs TRACK-RECORD discriminator.
Detects **proof-shaped claims** (a closed set: possessive population, people count, named-person
outcome, past client event, indefinite client narrative, outcome statistic, guarantee, third-party
attribution) and requires grounding **only** for those. Anything not returned is a method claim and
is always allowed — including at zero clients.

**The discriminator is the actual-people assertion, not tense.** `"Most families reach a five-to-six
hour stretch by night fourteen"` and `"94% of my clients see a full night by week two"` are both
results in a timeframe; the second asserts a real population the coach has not told us about.

**The `of my` inversion is the core fix.** The old `STAT_SELF_DESCRIPTIVE` exemption matched `of my`
alone, so it exempted `94% of my clients` (the highest-risk phrasing) in order to protect
`80% of my week`. The exemption is now narrowed to **non-person** possessions, so the possessive is a
*trigger* for people and an *exemption* for weeks and time. Both cases are covered by tests.

**`isLaunchStage` is now live** — zero supplied proof ⇒ any track-record claim is unsupported by
definition. Deterministic, no model call, no corpus search. It was computed and discarded.

**Three defects fixed:** `isLaunchStage` dead code (now the primary rule) · `buildProofSupplied`
hardcoded `price`/`guaranteeType`/`guaranteeDuration` to null (now read from `services`, incl.
`riskReversal` fallback) · `ATTRIBUTION_CUE` gating (a bare first name is now caught by a dedicated
detector rather than depending on a cue a testimonial rarely contains; the attribution detector now
requires an actual named entity, so ordinary "according to the plan" no longer trips it).

**Legacy detectors retained as ADDITIONAL inputs to one verdict** — consolidation means one decision,
not one regex. Dropping `AUTHORITY_RE` and the endorsement check when the claim detector landed cost
five real detections immediately; they are back, feeding the same result.

## 🔴 One policy consequence of Rule 1 — flagged for confirmation

**`promised_result` no longer blocks as fabrication; it is now tier 2.** A forward promise
("in 8 weeks you will land three retainer clients") is a claim about what the method is designed to
produce — nothing is asserted to have already happened — so under Rule 1 it is not invention.
It remains a **results-claim risk**, which is compliance's question, decided on form not truth.
Two existing tests were updated to assert the new policy. **Its proper long-term home is
`complianceAxis`; it is parked in the fabrication result as tier 2 until moved.**

## Verification — executed, not reasoned

The Layer-1 claim was labelled MEDIUM-HIGH and unexecuted. It is now executed.

| Set | Result |
|---|---|
| 9 harvested track-record strings, zero-client coach | **9/9 BLOCK** |
| 10 method-claim controls (incl. both Arfeen called ALLOW, and the July false positives) | **10/10 PASS** |
| Same strings once SUPPLIED | **PASS fabrication** |
| Supplied guarantee | **PASS** |
| Mutation: 6 person-nouns × possessive | **all block** |
| Mutation: 4 number forms × 6 nouns | **all block** |
| Mutation: 5 first names | **all block** |
| Mutation: 5 non-person possessions | **none block** |
| `server/trackRecordClaims.test.ts` + `fabricationValidator.test.ts` | **37/37** |
| `server/pipeline-fixes.test.ts` | **382/382** |
| TypeScript | **35** — baseline, zero added |

## ⚠️ NOT BUILT — remaining P1 scope

1. **The six unguarded generators are still unguarded** — heroMechanisms, hvco,
   leadMagnetContent, headlines, adCreatives, bonusPdf. The detector is fixed; nothing yet calls it
   from those generators. **heroMechanisms is the priority: it is upstream of five downstream assets.**
2. **The persistence-boundary assertion is not built.**
3. **The legacy `_core/validator.ts` families are not yet folded in** — they still run in parallel
   for offer/email/whatsapp/bonus with their own verdicts.
4. **Layer (iv), the scheduled end-to-end assertion**, is not built.

---

# PROPOSAL (not built) — how a beginner SUPPLIES informal results

**The problem.** Every current field assumes paying clients and formal testimonials
(`testimonial1Name`, `totalCustomers`, `pressFeatures`). A coach who tested on free users, friends or
their own child has **no route to declare it** — so their TRUE story gets blocked while an invented
one from a coach with a filled `coachBackground` slips through. The honesty layer currently punishes
the honest beginner.

**Where it fits: the laddered intake.** It already exists, is opt-in, fires after the first ICP
reveal and before the kit exists (the one window with zero staleness blast radius), already persists
**verbatim** answers to `groundingMeta.ladderAnswers`, and `buildCoachCorpus` **already reads them
into `corpus.text`**. No new surface, no migration — `groundingMeta` exists from 0096.

**The ask — one question, plain, no categories, no proof requested:**

> "Have you had results with anyone yet? Could be paying clients, free sessions, friends, even your
> own family. Tell us what happened — in your words."

Free text. Skippable. **ZAP must never ask who they were or whether they paid.**

**🔴 THE ONE CODE CHANGE THIS NEEDS.** A ladder answer flows into `corpus.text`, but `isLaunchStage`
is computed **only** from structured fields (`groundingCorpus.ts:107-114`). So today a coach could
write a full account of real results and **still** be `isLaunchStage: true` and still be blocked.
**`hasProof` must also count a non-empty results ladder answer.** Without that, adding the question
achieves nothing.

**Why not a settings form:** a form reintroduces the categories and evidence fields Rule 2 forbids,
and asks for proof at exactly the moment the coach is least willing to give it.

**Open for Arfeen:** whether an unanswered ladder should nudge once at the point a claim is blocked
("you mentioned free sessions — want to tell us about them?"), which converts a dead end into a
route, or whether that reads as ZAP asking for proof.

---

# WIRING SESSION — 2026-07-28 (second build). Five of six items done.

## ✅ 5. `promised_result` is now OWNED — closed first, as instructed

Removed from `fabricationValidator` entirely (a forward promise is a METHOD claim under Rule 1,
so it is not invention) and added to `complianceAxis` as **check 7**. Verified both sides:

```
fabrication (must PASS - method claim): PASS ✅
compliance   (must BLOCK):              BLOCK ✅  | promised_result
```

⚠️ **Evidence discipline.** A results claim is **not** one of the six confirmed Tier-1 checks in
`META_AD_COMPLIANCE_REFERENCE.md` §3.3, and no Meta document enumerates it. It is implemented as a
**ZAP HOUSE STANDARD** — legitimate as craft in exactly the way the 38-character headline rule is
legitimate as craft — and the code comment says so. **It must never be described to a coach as a
Meta requirement.** The remedy is wording (one person's experience, no promise of typicality), not
proving the result happened.

## ✅ 1. heroMechanisms — the ROOT CAUSE was the prompt, not the model

The mechanism prompt **instructed the model to invent**, unconditionally:

```
- Who developed it and why (credibility tied to niche, not generic "award-winning expert")
- A concrete outcome with a number or timeframe ($X/month, X clients in Y weeks, etc.)
```

A coach with zero clients has neither, so the model supplied both — *"Developed after working with
over two hundred families… Most families reach… by night fourteen"* — and it propagated into five
downstream assets. **The mechanism was not going rogue; it was following instructions.** Detecting
that downstream is strictly worse than not asking for it.

Both bullets are now **conditional on `isLaunchStage`**, positive-framed per §14, same pattern as
adCopyGenerator's already-conditional proof angles. Launch-stage coaches get method-design framing;
coaches with a supplied background get their own supplied figures and nothing else.

## ✅ 2. (partial) The other five generators

**`offersGenerator` carried a worse instruction than the mechanism did** —
*"specific client numbers from the data provided, **or 'hundreds of clients' minimum if none
available**"*: an explicit instruction to state a fabricated figure. Removed; likelihood is now
established through the mechanism when no proof is supplied. A sweep found no other generator
telling the model to invent a floor figure.

`hvcoTitles` and `headlines` are covered by the persistence gate (below).
**NOT wired: `leadMagnetContent`, `adCreatives`, `bonusPdf`.**

## ✅ 3. THE PERSISTENCE-BOUNDARY ASSERTION — the structural fix

New `server/_core/persistenceGate.ts`, wired into `db.ts` at `createHeroMechanisms`,
`createHeadlines`, `createHvcoTitles`. It derives its own grounding from the rows' own
`userId`/`serviceId`, so **no call site plumbs anything** — it sits on the insert and cannot be
forgotten when generator #17 arrives.

**Disposition: DEGRADE, NEVER KILL.** F1(b) is the precedent — a mid-cascade throw destroyed a run
that had completed eight nodes. The gate drops offending rows and keeps the rest; if every row would
drop it keeps the batch and logs loudly rather than emptying the node.
⚠️ **Accepted limitation:** in that case invented proof still persists. It is visible in logs and
blocked at publish. Revisit only with a retry path.

## ✅ 6. THE SCHEDULED END-TO-END ASSERTION — built and run

`scripts/fabrication-e2e-audit.ts`, two read-only modes, non-zero exit so a scheduler can alarm.

**`live`** — runs a REAL generation for a synthetic zero-client coach and screens what the model
returns, persisting nothing. This is the root-cause check.

**`audit <serviceId>`** — screens already-persisted assets through the same gate.

## Verification — executed on LIVE output, not fixtures

**Live generation, first run** — the prompt fix held (all three mechanisms in method-design
register, zero invented track record) but surfaced a **false positive**: the narrative detector read
*"a parent checks the time and thinks — I knew this was…"* as a case study, because a past-tense word
sat 46 characters away **inside quoted speech**. An FP here dead-ends a launch-stage coach, so the
window was tightened to 40 chars — which then broke `"A mum who'd been feeding to sleep"`, the
commonest case-study opener, because a contraction never matches a plain `had been`. Both fixed;
both are now permanent regression strings.

**Live generation, second run — PASS, zero blocking, zero false positives.**

**Audit of real prod service 277 — the layer works on real data and found 12 blocking claims in
already-persisted content**, including an invented `15%` statistic in a live headline and in live ad
copy. That content predates this work and is exactly what the layer exists to surface.

| Gate | Result |
|---|---|
| 9 harvested track-record strings | **9/9 BLOCK** |
| 12 method controls (incl. 2 new live-harvested FPs) | **12/12 PASS** |
| Supplied-proof controls · supplied guarantee | **PASS** |
| Mutation sets (nouns × number forms × names × non-person) | **all hold** |
| `trackRecordClaims` + `fabricationValidator` | **38/38** |
| `pipeline-fixes` | **382/382** |
| TypeScript | **35** — baseline, zero added |
| Live generation (real LLM, zero-client coach) | **PASS** |

## ⚠️ 4. NOT DONE — folding in the legacy families

`_core/validator.ts`'s per-asset validators (offer, email, WhatsApp, bonus, LP-testimonials) still
run in parallel with their own verdicts. **Partially mitigated:** the persistence gate applies ONE
verdict to persisted rows regardless of which family produced them — but only for the three tables
wired so far, and the legacy families remain a separate code path.

**Also still open:** `leadMagnetContent` / `adCreatives` / `bonusPdf` generator wiring; extending the
persistence gate to `adCopy`, `landingPages`, `emailSequences`, `whatsappSequences`, `bonuses`
(those do not insert through `db.ts` helpers, so each needs its own hook); and scheduling the audit
script rather than leaving it manual.

**Deliberately not built, per instruction:** the informal-results ladder question — it must ship
together with the `hasProof` change, since `isLaunchStage` reads only structured fields and a coach
could otherwise write a full account of real results and still be blocked.

## §16 note

Banked at ~77%, past the 70% target. The overshoot bought the second live-generation run, which is
what caught the false positive — a fixture-only stop would have shipped it.

---

# ITEM 4 — 2026-07-29. Wiring complete; legacy fold demonstrated, not finished.

## ✅ Persistence gate extended to the five tables that bypass `db.ts`

`adCopy`, `landingPages`, `emailSequences`, `whatsappSequences`, `bonuses` all insert from
generator files, so each got its own hook at the insert.

**Three of them keep their copy in JSON columns** (`emails`, `messages`, `*Angle`) — `copyFieldsOf`
only sees top-level strings, so without a new extractor the three biggest published surfaces would
have been screened as if they were empty. Added `copyFieldsOfJson` (recursive, depth-capped,
NON_COPY_KEYS-aware) and wired it per site via the new `textOf` option.

## ✅ The three remaining generators — with the RIGHT disposition

`adCreatives`, `leadMagnetContent` (`hvco.ts` assetBody) and `bonusPdf` use a new
**`screenOnPersist`** — screens and logs, never drops. Dropping is the wrong remedy for all three:
an ad creative's image is already rendered and uploaded (dropping the row orphans it), and blanking a
lead-magnet or bonus body hands the coach an empty deliverable. The publish gate stays the hard stop.

## 🟡 Legacy fold — capability built, ONE site wired

`gateBeforePersist` now takes `legacyHits`, folding the legacy family's residual findings into the
**same verdict** rather than letting each family conclude separately. Demonstrated end-to-end in
`bonusGenerator`: the loop-scoped `fab.hits` are hoisted into `__residualLegacyHits` and passed to
the gate.

**NOT wired: email, WhatsApp, LP-testimonials, offer.** All four run their validator inside a retry
loop, so each needs the same hoist. The recipe is exactly bonusGenerator's:
1. declare `let __residualLegacyHits = []` before the retry loop
2. assign `fab.ok ? [] : fab.hits.map(...)` inside it
3. pass `{ legacyHits: __residualLegacyHits }` at the gate call

## Verification — live output caught two more false positives

Unit suites cannot find these. Screening **187 real email/WhatsApp rows** through the new JSON
extractor produced 140 fabrication hits, and frequency analysis (the same technique that caught the
detector bug on 2026-07-28) exposed two FPs immediately:

| False positive | Hits | Cause |
|---|---|---|
| `"First Name"` → `invented_named_third_party` | **10** | the CRM **merge token** the sequence generators emit deliberately, read as a person |
| `"Once I saw"` → `invented_testimonial` | 2 | `Once` read as a first name; the stoplist had `one`, not `once` |

Both fixed. The remaining hits look genuine — `"I've worked with hundreds"`, `"28 students"`,
`"six students"`, `"One client came"`, `"a professional services firm came"`, percentages.

**That is three separate live-only false positives this week** (the narrative-window FP, then these
two). Every one would have shipped on a green unit suite.

| Gate | Result |
|---|---|
| `trackRecordClaims` + `fabricationValidator` | **38/38** |
| `pipeline-fixes` | **382/382** |
| TypeScript | **34** — see disclosure below |
| Live JSON-extractor screen, 187 real rows | ran; 2 FPs found and fixed |

⚠️ **TS is 34, one BELOW the 35 baseline — this is not an improvement.** The `as any` on the
landingPages insert suppresses a pre-existing overload error at `landingPageGenerator.ts:1025`
(confirmed by stashing and re-counting at HEAD). Suppression, not a fix; the underlying mismatch is
untouched. **Zero errors added.**

## Risk note on the new extractor

`copyFieldsOfJson` only feeds the three **single-row** inserts, where the gate's floor keeps the row
and logs rather than dropping. So even if it over-fires, it cannot delete an asset. The two
**array** inserts that can drop rows (`adCopy`, `bonuses`) use the older `copyFieldsOf`, which has
already been validated across 15,586 prod rows.

## §16 note

Banked at ~72%, past the 70% target. The overshoot was spent on the live screen and the two FP fixes
it produced — stopping at the green unit suite would have shipped both.

---

# ITEM 4 CLOSE-OUT — 2026-07-29. Legacy fold finished; TS suppression properly fixed.

## ✅ TS suppression removed — it was a real, fixable bug

The `as any` is gone from both places on the landingPages persistence path. The underlying
TS2769 was **two** separate problems:

1. **Pre-existing.** `allAngles` cast each angle to `Record<string, unknown>`, throwing away the
   shape the `landingPages.*Angle` columns declare. Fixed at source by casting to
   **`LandingPageContent`** — the column's own type. This is the error the 35-baseline had
   absorbed for however long.
2. **Mine.** Extracting the row into a `const` lost the contextual typing that inline
   `.values({...})` supplied, so `activeAngle: "original"` widened to `string` and no longer
   satisfied the column enum. Fixed with `as const`.

**The baseline is now 34 and it means something:** 35 minus one genuinely fixed error, with no
suppression anywhere. `landingPageGenerator` type-checks clean. Server errors 9, client 25.

## ✅ Legacy fold — 4 of 5 sites, and the recipe did NOT transfer

The doc's "three-line hoist" only worked for `bonusGenerator`. In the other four the validator
lives in a **helper function** that returns content, with the insert in a different function — so
the hits needed a *channel*, not a hoist. Each helper has exactly one call site, so they take an
optional `__legacySink` the helper writes into; smaller diff than changing four return types.

**Folded:** `bonusGenerator` (prior) · `emailSequenceGenerator` · `whatsappSequenceGenerator` ·
`offersGenerator`. **Not folded: LP-testimonials** — same pattern, ~10 minutes, banked.

**`offers` also had NO persistence gate at all** — the last cascade table with none. Now gated.

## 🔴 THE LIVE CHECK CAUGHT THE MOST SERIOUS THING THIS WEEK

Screening **288 real prod rows** through the legacy families produced **1,833 hits (~6.4 per row)**,
overwhelmingly the OFFER validator flagging ordinary offer content:

```
  85x offer_invented_currency|$97        48x offer_invented_refund_mechanic|full refund
  64x offer_invented_currency|$27        27x offer_invented_refund_mechanic|Risk-Free
  24x offer_invented_cohort_date|next cohort   22x offer_invented_bonus_value|($97 value)
  22x offer_invented_guarantee_timeframe|within 48 hours
```

**That is an offer doing its job.** Those strings are flagged only because they are not
operator-supplied, and each legacy family's OWN disposition is retry-with-failContext then persist
best-effort — deliberately not a block.

I had folded them as **tier 1**. Had that fed the drop decision, **it would have dropped nearly
every offer row generated.** It did not, because the fold lands after the keep/drop loop — but the
label was wrong and the next person to filter on tier 1 would have inherited a live landmine.

**Corrected to tier 2.** Consolidation here unifies the **verdict surface**, not the **disposition**:
one place to read what every detector found, while each family keeps the remedy it was tuned for.
That is the honest reading of "one verdict, not one regex".

**Four live-only findings this week** — the narrative-window FP, `"First Name"`, `"Once I saw"`, and
now this. Every one on a green unit suite.

## Test-quality fix

Two `pipeline-fixes` assertions grepped the generator source for an exact call string and broke on
the new sink parameter. They asserted the arg list rather than the wiring, so they were narrowed to
match the wiring — a literal whole-call match breaks on any future parameter without the wiring
having changed.

| Gate | Result |
|---|---|
| `trackRecordClaims` + `fabricationValidator` | **38/38** |
| `pipeline-fixes` | **382/382** |
| TypeScript | **34** — real baseline, no suppression |
| Live legacy-family screen, 288 prod rows | ran; tier mislabel found and fixed |

## Remaining

LP-testimonials fold (one site, known pattern). Everything else in item 4 is closed.
