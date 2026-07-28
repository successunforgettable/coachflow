# ZAP Handover — July 27, 2026 — ANTI-FABRICATION VALIDATOR v1 — 🟡 BUILT + HELD

**Status: BUILT, clean-room verified on 6 paths, LOCAL-ONLY. Local commit `6a89396`. `origin/railway-build`
is still `8910000` — NOT pushed. No migration; `drizzle/` untouched.**

⛔ **Do NOT ship yet.** Arfeen chose **"test more first"** over ship-now. The next action is a widened
false-positive sweep (§5) with a hard pass bar. Only after that bar is cleared does this ship.

**Why it matters:** this validator is the **LAST GATE**. Once it clears the bar and ships, the whole
Andromeda spine — concepts → scripts → adCopy, all currently DRAFT-only — can reach a real coach.

---

## 1. Locked decisions (Arfeen)

* **Ground truth = the coach's OWN WORDS only** — service fields, `groundingMeta.ladderAnswers`, imported
  docs, supplied scalars. **NEVER the ICP prose**: it is model output, so crediting it would launder
  fabrication exactly one level down.
* **The governing line** — predictable category **psychology** is legitimate inference and **flows**
  ("business owners worry about cash flow"); specific invented **proof** is **blocked**.
* **BEGINNER IS A TARGET USER** — a coach with zero program, zero bonuses, zero lead magnet and zero clients
  must be able to build a full campaign. The block bites **only** on invented proof. Never dead-end a beginner.
* **Unearned authority** — "in my 15 years" **blocks** for a beginner, **passes** for a veteran whose supplied
  `coachBackground` / `totalCustomers` actually establishes it.

## 2. What is built

### PART A — prompt fixes (`adCopyGenerator.ts`, the A7 file, minimal diff)
1. The two proof-seeking headline angles ("name the exact result with a number", "name the result a specific
   type of person got") are now **conditional on the real `socialProof.has*` flags**. A launch-stage coach
   gets pain / situation / curiosity / mechanism / contrast instead — the prompt never asks for a claim they
   cannot back.
2. The no-proof branch is **reframed positively (§14)** — it describes what the copy *is* rather than listing
   `DO NOT fabricate X`. Negative priming is the documented Sprint-B regression cause.

### PART B — the validator
* **`server/_core/groundingCorpus.ts`** — builds the coach corpus (service + verbatim `ladderAnswers` +
  imports + supplied scalars) and `ProofSupplied`. `readLadderAnswers` is tolerant of legacy/NULL rows.
  `isLaunchStage` identifies the beginner.
* **`server/_core/fabricationValidator.ts`** —
  * **Class 1 (invented proof, tier 1) → BLOCKS**, retry 1→3: testimonials/case studies, statistics, named
    third parties, unstated guarantees, promised results, unearned authority.
  * **Class 2 (persona psychology, tier 2) → LABELS ONLY, never blocks.** Word overlap detects vocabulary
    reuse, not truth, and a launch-stage coach's inferred psychology is legitimate.
  * **Unearned-authority detector checks supplied `coachBackground` / `totalCustomers` FIRST** — it passes if
    the claim traces to real supplied data.
  * Adapters: `validateConcept…` / `validateScript…` / `validateAdCopy…` / `validatePublishContentFabrication`.
  * Positive-framed `failContext` (§14).
* **Dispositions differ by asset, deliberately:** concepts and scripts **throw** after retries (invented proof
  must never persist). **adCopy DROPS the fabricating variants** rather than throwing the deck — a deck carries
  15–30 variants, so removing a few leaves a usable one and never dead-ends a beginner mid-cascade; it throws
  only if nothing survives. *(This adCopy disposition was CC's call, not specified — flagged for review.)*

### PART C — publish gate
At `publishToMeta` (`server/routers/meta.ts`), run on the **RESOLVED** copy (after `[INSERT_*]` substitution)
so a resolved real price reads as supplied and an unresolved token does not read as a missing figure.
**Content-agnostic**, so it catches whatever produced the copy — including a coach's hand-edit in the Kit.

## 3. Verification so far (clean-room, all 6 paths PASS)

| | Path | Result |
|---|---|---|
| (a) | beginner psychology not blocked | PASS — 0 hits on a real generated beginner ICP |
| (b) | invented proof caught | PASS — concept·stat, script·testimonial, script·named-party, adCopy·promised-result, adCopy·guarantee |
| (c) | authority contrast | PASS — blocks for beginner, passes for veteran with supplied 15-yr background |
| (d) | prompt no longer requests proof | PASS — both proof-seeking angles withdrawn at `isLaunchStage` |
| (e) | publish gate | PASS — clean ad publishes, fabricating ad blocked |
| (f) | grounded claim | PASS — traces to the coach's own words |

**🔴 One false-positive class was already caught and fixed during verification.** The first live run BLOCKED a
real beginner ICP on 4 hits: `"Every Monday"` and `"When I'm"` (ordinary capitalised prose read as named third
parties) and idiomatic/hedged percentages (`"not 100% sure"`, `"about 80% of my week"`). That would have
dead-ended every launch-stage coach. Fixed with a non-name token stoplist (days, months, pronouns, sentence
openers) plus an idiom/hedge filter on percentages; the exact failing strings are now regression tests.

**Gates:** TS **35** · tests **448** (20 new, add-only; `pipeline-fixes` still 382 — the A7 prompt change
shifted no assertion) · guards intact · **no migration**.

**Honest limit of what has been proven:** one beginner ICP plus unit cases. That is thinner than it should be
for a detector that BLOCKS — which is exactly why §5 exists.

## 4. Why ship-now was rejected

Shipping now would have used **real coaches as the test set**. Given the validator blocks, a false-positive
class reaching production would dead-end real users on legitimate copy. Arfeen rejected that as a shortcut.

## 5. ⛔ NEXT ACTION — the widened false-positive sweep (ready-to-run prompt)

**PASS BAR: zero false positives on legitimate prose across the varied set, AND 100% of planted fabrications
still caught.** Fix-and-re-run on any false positive. If zero cannot be reached, report the honest residual
rate — **do NOT loosen the detector until a real fabrication actually slips**.

> **ANTI-FABRICATION VALIDATOR — WIDENED FALSE-POSITIVE SWEEP. Read-only, no push, no build unless a fix is needed.**
>
> The validator is built and held at local commit `6a89396` (origin still `8910000`). It BLOCKS, so a false
> positive dead-ends a real coach on legitimate copy. Before it ships it must clear a hard bar across varied
> coach shapes — not the single beginner case it has been proven on.
>
> **Assemble a varied corpus (read-only, no prod writes):**
> - **Beginner / launch-stage** — zero program, zero bonuses, zero lead magnet, zero clients (several niches:
>   fitness, B2B consulting, parenting, tarot/spiritual, finance, creative freelance).
> - **Veteran** — real supplied `coachBackground`, `totalCustomers`, testimonials, press.
> - **Has-assets** — coach who imported their own document (corpus is rich).
> - **Real prod ICPs** — pull a read-only sample of existing `idealCustomerProfiles` rows across different
>   users/niches (SELECT only; no writes, no teardown needed since nothing is created).
>
> **For each shape, generate or sample REAL in-scope assets** — concepts, scripts and ad copy — and run the
> Class-1 detectors over them.
>
> **Report two numbers per shape and in total:**
> 1. **False positives** — legitimate prose flagged as invented proof. For each, quote the exact matched string
>    and the sentence around it, and name which detector fired.
> 2. **True positives on planted fabrications** — inject the known set (invented testimonial, statistic,
>    promised result, unstated guarantee, named third party, unearned authority) into each shape and confirm
>    every one is still caught after any fix.
>
> **Then:** fix any false-positive class at the detector level (stoplist / idiom filter / supplied-data check —
> the pattern already used for "Every Monday" and "not 100% sure"), add the exact failing strings as regression
> tests, and re-run the whole sweep. Repeat until the bar is met.
>
> **If zero false positives cannot be reached**, stop and report the residual rate with examples, plus your
> recommendation — do not quietly widen the detector to make the number look good, because that trades a
> visible false positive for an invisible false negative.
>
> Gates: TS 35, tests add-only, guards, no migration. Commit local, do NOT push. Not main. Report the sweep
> table, any fixes made, and whether the bar is met.

## 6. Also open / carried

* **🔴 SECURITY (Arfeen action): rotate `zap-e2e-smoke@mailinator.com`'s password** and update
  `~/.zap-e2e-creds.env`. CC leaked it into a transcript via a redaction-pattern miss — low severity
  (non-privileged test account, public mailinator inbox) but rotate before the next smoke run.
* **Backlog:** cosmetic tidy-ups (stale "16 text section keys" comment at `icpPrompts.ts:204`;
  `ICP_JSON_SCHEMA.name` still `"ideal_customer_profile_17_tabs"`) · script filename feature (human-readable
  per-concept from awareness + hook + length) · blog generator + other ICP-powered tools · has-assets-path
  ladder (out of v1).

## 7. State

* Branch `railway-build`. **`HEAD = 6a89396` LOCAL ONLY; `origin/railway-build = 8910000`.** `main` untouched.
* No migration; `drizzle/` untouched. Re-validation happens at publish, so nothing durable is stored.
* No clean-room artifacts: verification drove the generators directly with zero DB writes.
