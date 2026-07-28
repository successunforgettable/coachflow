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
