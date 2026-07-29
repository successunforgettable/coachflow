# ZAP — STATE

**The single handover a fresh session reads.** Everything dated is archived under
`docs/handovers/archive/` and is history, not current truth. Read this file plus CLAUDE.md §1a and
you are current.

Three sections: **CURRENT STATE** (what is true now) · **THE QUEUE** (what's next, in order, with
enough diagnosis to execute without re-investigating) · **TRAPS** (what will bite).

Last updated: 2026-07-28.

---

## 1. CURRENT STATE

### 🟢 CHECKPOINT 2026-07-29 — PROD IS CLEAN, NOTHING IN FLIGHT

**No run is live. No ACTIVE_RUN file is needed.** The last cascade (service 284 / ICP 261 / kit 199)
completed and was **fully torn down**: 111 rows removed, every cascade table back to its pre-run
baseline, **0 rows above baseline, 0 running jobs**, protected smoke rows intact 6/6/6/6.

- **No landing page published** (`publicUrl` NULL) → **no KV entry to purge**.
- **No Meta campaign** (`meta_published_ads` for the smoke user = 0) → nothing to pause or delete.
- **Coach name restored.** `users.name` for 117174 was temporarily set to "Dana Whitfield" for the
  P3b proof and is back to **"ZAP E2E Smoke (do not use)"** — verified by re-read.

**Baseline all cascade tables reconcile against** (verified post-teardown): services 124 · ICPs 101 ·
kits 49 · LPs 90 · emails 96 · WhatsApp 91 · bonuses 0 · concepts 0 · offers 101 · mechanisms 1072 ·
hvcoTitles 6577 · headlines 2154 · adCopy 5405 · adCreatives 397. Protected id ranges: services
272–277 · ICPs 249–254 · kits 187–192 · LPs 222–227.

### Ground truth

| | |
|---|---|
| Branch | `railway-build` (never push `main` during sprints) |
| HEAD | `origin/railway-build` — verify, do not recall |
| TS baseline | **35** under pnpm — must not regress; new work adds zero |
| Package manager | **pnpm only.** No `package-lock.json`, no `@playwright/test` in `package.json` |
| Migrations | latest applied = **0096**. `0081` is SUPERSEDED — never apply |
| Prod tables (verified 2026-07-28 post-teardown) | services 124 · ICPs 101 · kits 49 · LPs 90 · emails 96 · WA 91 · offers 101 · **bonuses 0 · concepts 0 · scripts 0** · mechs 1072 · hvco 6577 · headlines 2154 · adCopy 5405 · creatives 397 · jobs 88 (**0 running**) |
| Prod cleanliness | **Clean.** The 2026-07-28 run was fully torn down — every count back to baseline, 0 rows above it, protected smoke rows intact 6/6/6/6, all published pages purged from KV and verified 404. **A fresh session has nothing to clean.** |

Verify, never recall: `git rev-parse HEAD origin/railway-build` · `npx tsc --noEmit 2>&1 | grep -c
"error TS"` · `pnpm install --frozen-lockfile`.

### What is live and working

**The cascade completes.** A beginner Auto Mode run produces a full kit. Verified on prod
(service 281 / ICP 258 / kit 196):

```
{"offers":1,"heroMechanisms":15,"hvcoTitles":60,"headlines":10,"adCopy":9,
 "landingPages":1,"emailSequences":1,"whatsappSequences":1,"adCreatives":0,"bonuses":3}
```

- **Terminal-node degradation (F1(b)) — FIXED and verified live.** Step 9 failing no longer kills
  the run; the job completes with finalize and records `failedSteps`. Only step 9 carries
  `optional: true` (`orchestration.ts:246`); steps 1–8 rethrow by design.
- **Compliance layer** — register standard + compliance axis + anti-fabrication validator, shipped
  as ONE layer, wired and enforcing at HEAD. Tier-1 enforcement only; publish gate at
  `server/routers/meta.ts:262`. Blocking baseline **437**. ⚠️ **See queue item P1 — the fabrication half does not fire on real copy.**
- **ICP grounding** — Class-A invented fields removed at root; opt-in laddered intake sharpens the
  ICP in place after first reveal. `groundingMeta` proven written on prod.
- **Andromeda spine** — concept + per-concept script generators live, DRAFT-only.
- **Bonus arc** — 3 ICP-derived bonuses, hosted PDFs, durable job, coherent across offer/LP/email.
- **All 5 LP templates** built and proven live via the intake.

### The artifact read — DONE (2026-07-28, beginner shape)

All of it, on prod: landing page **published and screenshotted** at its live `/p/{slug}` · **5 ad
creatives generated** (step 9 passed) · bonus PDFs opened and confirmed rendering · Meta push
exercised against the publish gate with zero spend risk · full node-by-node read.

**Report: `docs/handovers/RUN_2026-07-28_beginner-cascade-artifact-read.md`**
Full text of every node: `RUN_2026-07-28_artifacts-full.txt` · screenshot:
`docs/screenshots/LP-230-published-fullpage.png`.

It found the P1 validator gap now sitting at the top of the queue, plus live-page defects: a literal
`yourbrand` placeholder, and five filled stars reading **"Trusted by high achievers"** on a page for
a coach with zero clients.

**Veteran / has-assets shape is still a separate run, never done.**

### Known-failing, input-dependent

**Step 9 (ad creatives) fails on MOST runs but not all.** When it fails,
`generateContextualAdHeadlines` (`orchestration.ts:816`) throws before `runAdCreativesGeneration`
(`:941`) is reached, so no image API is contacted. This is the F1(a) gate, queue item 10; the cascade
degrades correctly around it.

**✅ On 2026-07-28 step 9 PASSED and produced 5 creatives** — so the Replicate → Cloudinary path is
**verified end-to-end** and the old "UNVERIFIED" caveat is retired. **Credits are ruled out**:
Anthropic, Replicate and Cloudinary all probed HTTP 200 healthy (Cloudinary is on the **Free** plan
— watch if creative volume ramps).

---

## 2. THE QUEUE

In order. Each carries its diagnosis — execute without re-investigating.

### P1 🔴🔴 PUBLISH GATE FALSE NEGATIVE — top of the queue

**📊 EXPOSURE MEASURED 2026-07-29 — `docs/handovers/PUBLISHED_EXPOSURE_AUDIT_2026-07-29.md`.
NO REAL COACH IS EXPOSED.** All 35 published landing pages belong to just two accounts
(arfeen@arfeenkhan.com 32, zapreviewer 3); zero real-coach owners. Only 2 Meta rows exist ever,
both Arfeen's, both PAUSED, both with a placeholder `temp` adSetId — **no ad copy has ever reached
Meta**. "Dr. Sarah Chen" (24 rows) and "hundreds of successful clients" (75 rows) are both
generated-but-never-published. **The ~1,825 fleet figure is latent debt in stored decks, not a live
incident** — the risk is forward-looking. ⚠️ Blind spot: GHL deployment is not measurable (no
per-asset push record exists), so email/WhatsApp reach is unknown either way.

The live `meta.publishToMeta` gate returned **`ok=true`, zero blocking, zero advisories** on a named
testimonial + invented client count + invented statistic + unstated guarantee, **for a zero-client
coach**. Evidence: `RUN_2026-07-28_beginner-cascade-artifact-read.md` §3.

**Two causes, fix both.**

**(a) `heroMechanismsGenerator.ts` has NO fabrication guard at all** — no `compliance`/`fabricat`/
`screen` reference anywhere in the file — and it sits **upstream of everything**, so its invented
claim propagates. `checkOutput` is wired into concept, landing-page, LP-publisher, concept-script,
ad-copy and the Meta gate only. Offer, lead-magnet, email, WhatsApp and bonus generators are also
unguarded.

**(b) The `of my` exemption opened a false negative.** `STAT_SELF_DESCRIPTIVE` was added to kill the
*"80% of my week"* false positive; it also exempts **`94% of my clients`**, which passes while
`87% of consultants` blocks. Same class: `TESTIMONIAL_RE` never matches a bare first name
("Sarah got her baby…"); `GUARANTEE_RE` misses "or your money back"; `AUTHORITY_RE` misses
spelled-out numbers and the noun "families".

**`fabricationValidator.test.ts` is 23/23 green while the gate is blind** — the suite asserts only
the strings the regexes were written against. **Add the real phrasings above as regression tests.**

**✅ P1 ITEM 4 CLOSED 2026-07-29** — all five legacy families folded (bonus, email, WhatsApp,
offers, LP-testimonials); `offers` gained the persistence gate it never had. Folded as **tier 2**:
measured on 288 prod rows the legacy families fire ~6.4×/row on ordinary offer content ("$97",
"full refund", "next cohort"), so consolidation unifies the VERDICT SURFACE, not the disposition.

**📄 INVESTIGATED 2026-07-28 — proposal ready, nothing built:
`docs/handovers/P1_INVESTIGATION_publish-gate-false-negative.md`.** Corrections to the diagnosis
above: coverage is **bifurcated, not absent** (a legacy per-asset validator family in
`_core/validator.ts` runs alongside the compliance layer; **six** generators are in neither); the
gate **wiring is correct** — `complianceAxis.ts:826-834` does push `fab.blocking`, the detectors
simply returned nothing; **`isLaunchStage` is dead code** (computed, never read — the documented
"stricter for beginners" rule is unimplemented, and is the cheapest available fix); and the
**corpus is an allow-list, never a detector** — consulted only *after* a regex fires, so it cannot
catch a missed phrasing by construction. Email and WhatsApp *have* legacy guards and still leaked
invented case studies, so detection is insufficient in **both** families.

⚠️ Surface-form matching will keep losing to paraphrase. Tightening regexes is the floor, not the
answer — the durable fix reasons about whether a claim is supported by the coach's own words.
**Do not quote CLAUDE.md's old "Class 1 invented proof BLOCKS" as current fact.**

### P2 🔴 TEMPLATE CHROME ASSERTS SOCIAL PROOF

**"Trusted by high achievers" + five filled stars is hardcoded page furniture, not generated copy —
so no generator guard can ever catch it.** It renders on **every zero-client coach's page**.
`burchardProductivity.ts:114-116`: the guard drops the trust *number* when unsupplied but keeps the
*claim*; the comment reads "Never fabricated". Make it conditional on real proof, exactly as
`asSeenIn` / `testimonials` already are.

### P2b `yourbrand` PLACEHOLDER SHIPS LIVE

`burchardProductivity.ts:123` falls back to the literal string `yourbrand` when `coachName` is unset;
the magnet card renders `YOUR BRAND'S`. **Both were visible on the published page.**

### P3 ✅ FIXED + PROVEN LIVE 2026-07-29 — EMAIL PLUMBING

All three CTAs are `ctaLink: "#"` — **dead links**. All three sign-offs render an unfilled
`[INSERT_HOST_NAME]`.

### P4 ✅ FIXED + PROVEN LIVE 2026-07-29 — WHATSAPP WRONG FUNNEL (incl. display name)

Event-framed on a **lead-magnet campaign with no event**: *"At [INSERT_EVENT_NAME] with
[INSERT_HOST_NAME]"*, *"You've already said yes to [INSERT_EVENT_NAME]"*. Structural, not a token gap.

### P5 ✅ FIXED + PROVEN LIVE 2026-07-29 — PROMPT EXAMPLE LEAKED INTO OUTPUT

Email 2's preview promises *"you sit in a car park"* — **the register standard's own worked example**
from `META_AD_COMPLIANCE_REFERENCE.md` §3.1, escaping the prompt as if it were the coach's story
(the body contains no car park). **Audit every generator for other worked examples leaking.**

### P6 CREATIVES — GENDER MISMATCH WITH ICP

All five images depict a **man**; the ICP is unambiguously a **mother** (partner, maternity pay,
mothers' group, antenatal group). **The image prompt is not carrying ICP gender.** Also: v1 shows a
**newborn** when the ICP's baby is 4–12 months, and reads alarming rather than gentle.

### P7 ✅ FIX C BUILT + PROVEN ON REAL PROMPTS 2026-07-29 — NOT YET DEPLOYED

**The earlier wording here was wrong: this was a PROMPT defect first, model second.**
Full trace: `docs/handovers/P6-P8_INVESTIGATION_ad-creatives.md`.

Three causes, all ours: (1) the base style asked for `"Gossip magazine style, tabloid aesthetic"` —
a gossip magazine IS a page of text, and v3 was Flux obeying correctly; (2) the `noText` hard
negative (`"NO text, NO words, NO letters…"`) was concatenated into flux-1.1-pro's **positive**
prompt — that endpoint has no negative-prompt input and diffusion has no logical NOT, so every one
of those tokens pushed text toward the image (**§14 negative-priming, live, in a shipping prompt**);
(3) the prompt explicitly ordered empty green callout bubbles — the most caption-inviting shape
available, and what v4's labels were filling.

**Fixed:** photographic base style, `noText` deleted and replaced by a positively-framed clean-plate
description, callouts dropped, `prompt_upsampling: false`.

**Proof — 5 real ZAP prompts re-rendered on flux-1.1-pro, `docs/screenshots/run-2026-07-29-fixC/`:
ZERO text in all five.** Also **~5× faster: median 5.5s/image against the ~25–30s the code comment
recorded** — the upsampler was an LLM round-trip per image.

⚠️ **Two things fix C did NOT fix — do not assume otherwise:** subjects are still male (that is P6,
deliberately held); and the `object` style STILL returned a person rather than a still life, so
**upsampling was NOT the cause of that drift** — the niche string dominates. The investigation
doc's item-C4 hypothesis on drift is refuted by its own re-run.

**Correction to the old P7 text:** `"Baby time parents"` / `"Parenting books"` were **not garbled** —
they were crisply rendered nonsense labels. The genuine garbling was v3 (newsprint) and v5 (book
cover). Two distinct defects that the one-line summary had merged.

### P8 ✅ FIXED IN CODE 2026-07-29 — NOT YET PROVEN LIVE

*"I remember standing at the cot at 11pm…"* on all five. **Two independent single-value bottlenecks,
either alone inert:** `adCreativesGenerator.ts:468` resolved the body once OUTSIDE the variation
loop, and `compositeHeadline.ts:145` was `.orderBy(desc(id)).limit(1)` so it could only ever return
one row. **Prod has 3 `contentType='body'` rows per service** — two generated, stored and discarded
on every batch.

**Fixed:** new `resolveAdBodyTexts()` returns the deck; `resolveAdBodyText()` kept as a thin wrapper
so the 6 recomposite / single-creative call sites are untouched. Rotation `bodies[i %
bodies.length]` applied at **all three** batch sites — the third, `routers/adCreatives.ts:981`
(wizard batch), carried the identical defect and was **not** in the original P8 report. Zero added
LLM or image spend.

**Still needs a live cascade to prove** — rotation cannot be verified from a raw-plate render.

### P9 LP TEXT OVERFLOW + GRAMMAR

Magnet title **clipped by the FREE badge** (`…SEQUENCE RESET: H`); **`Get Your Free The 3-Night…`**
double article; the 137-char lead-magnet title renders as a four-line run-on ending on a lonely full
stop. **The lead-magnet title length needs a cap.**

---

### 10. F1(a) — the all-or-nothing headline gate

**Symptom:** step 9 yields zero creatives on most runs. **⚠️ It is input-dependent, not
deterministic — the 2026-07-28 run PASSED step 9 and produced 5 ad creatives**, because that run's
headlines happened to fit the bar. **The Replicate → Cloudinary image path is therefore no longer
unverified — it executed end-to-end.** That closes the standing caveat and unblocks the parked
image-model evaluation.

**Mechanism:** the ad-headline check rejects the *whole batch* if any headline exceeds the length
bar (`subCase=headline_over_length`), retries 5×, then throws. The RETRY EXHAUST logs show
Anthropic returning 5 valid headlines each attempt — this is local validation killing a successful
response.

**Settled:** **38 characters stays.** It is ZAP's house standard and Arfeen has decided it. Meta's
published figure is 27 and is a *display recommendation*, not a limit; neither 38 nor 40 appears in
Meta's docs as a cap. **Do not re-litigate the number** — the defect is the all-or-nothing
behaviour, not the threshold.

**Fix shape:** drop over-length headlines and proceed with the survivors (the same disposition the
adCopy generator already uses — drop variants, never the deck), throwing only if none survive.
Code-only, no migration. Unblocks the ad-creative path and the parked image-model evaluation.

### 11. Zombie-job liveness signal 🔴🔴

**Hit twice in two runs.** A job whose process dies stays `status='running'` forever — never
reaped, never marked failed, never resumed, nothing written to `jobs.error`.

**Impact both directions:** a coach sees a wizard that never finishes *and never fails*. It fools us
just as reliably — a handover once recorded a dead run as "IN FLIGHT".

**The reaper's `status='pending'`-only filter is DELIBERATE** and documented at
`drizzle/schema.ts:1600-1605`: Auto-Mode orchestrators legitimately sit in `running`, so **widening
the sweep is NOT the fix and would kill live jobs.**

**Fix shape:** a liveness signal — a heartbeat column touched by the running job, or reap `running`
jobs whose heartbeat/last-write exceeds a generous threshold, transitioning to `failed` with an
error the UI can surface. **Never infer liveness from `jobs.status`; the tell is the last downstream
write timestamp.** Own pass.

### 12. ✅ F2 CLOSED 2026-07-29 — `campaignKits.campaignType` was NULL

**Proven live: kit 199 carried `campaignType: "lead_magnet"`.** The fix is `ensureCampaignKit()`
called at the TOP of `runOrchestration`, before any generator runs — `autoSelectBest` now delegates
to it so there is ONE creation path. Deliberately NOT threaded through the seven generator call
sites; that approach failed twice. It also backfills `campaignType` on an existing kit that has
none. Original diagnosis retained below.

#### Original diagnosis

**Still NULL after the attempted fix. The change is inert, not harmful.**

**Why it failed:** `campaignType` was threaded into `autoSelectBest` and passed from
`orchestration.ts:859` — but the generators call `autoSelectBest` first.
`offersGenerator.ts:535` calls it with four arguments during step 1, creating the kit with
`campaignType` undefined. By line 859 the kit already exists, so the value is correctly ignored —
the parameter only applies on insert.

**Fix:** ensure the kit exists **with `campaignType`** at the **top of `runOrchestration`**, before
any generator runs. **Do NOT thread it through the generator call sites** — there are seven and it
is fragile. Code-only, no migration.

### 13. F3 — event-date capture (the unbuilt half)

**Shipped half:** `normalizeEventDateToISO` + `resolveSequenceLength`. UK day-first slash dates
(`27/09/2026`) and ordinal words (`28th august 2026`) parse instead of silently falling back to 3;
overflow like `31/02` is rejected. **No date supplied is a legitimate 3; a date supplied that cannot
be read is a defect and now logs an explicit error.** `deriveLengthFromDate` keeps its signature.

**Slash-date policy (deliberate, do not silently flip):** `d/m/y` reads **day-first** — UK-centric
coach base, matches observed prod values.

**Remaining, mechanism settled:**
1. optional `eventDate` on the `autoMode.orchestrate` input, alongside `campaignType`
2. write it to `campaignFacts` at the **same kit-creation point** that item 12 fixes
3. one conditional question in the Auto Mode entry UI

**Asked ONLY for date-based types** (webinar, in_person_event, challenge) — **never** for
lead_magnet or discovery, which legitimately have no date. **Not the ladder** — it runs before the
kit exists while `campaignFacts` lives on the kit. No migration (`campaignFacts` exists from 0090).

### 🔑 STANDING RULES EARNED THIS WEEK — carry these forward

**1. DROP vs SCREEN.** Drop a row **only** where rows are interchangeable variants (an ad-copy deck,
a mechanism deck). Where each row is a required **TYPE** (the three bonuses are one-per-type and the
offer and LP both reference the set) or **owns an already-produced artefact** (an ad creative's image
is already rendered and uploaded), **screen and log** — dropping leaves a structural hole or orphans
an asset. Established by creatives, then proven by bonuses losing the accelerator on a live run.

**2. LIVE VERIFICATION IS NOT OPTIONAL ON THIS CODEBASE.** Five live-only findings this week, every
one on a green suite: the narrative-window FP · `"First Name"` (a CRM merge token read as a person) ·
`"Once I saw"` · the legacy tier-1 mislabel that would have dropped nearly every offer row · the
inverted `"A parent I worked with"` client claim. **Plus one fix — P3b — that structural
verification called done and live output refuted.** Fixtures measure the fixtures.

**3. PROMPT STRINGS BECOME CONTENT.** A worked example or a token instruction sitting inside a prompt
gets reproduced as output. P5's car-park leak and P3b's HOST-NAME ANCHOR were both this: in P3b the
code correctly supplied `Host: Dana Whitfield` while the same prompt still instructed the model to
emit `[INSERT_HOST_NAME]`, and the instruction won. **Supplying a value is not enough — the
instruction to use the token must also go.**

### ✅ ORDINAL-AS-CHOICE — ALL 8 SITES FIXED + VERIFIED LIVE (`66a5682`)

**`server/_core/pickSelected.ts` is now the ONLY place this decision is made.** All four
orchestrator helpers and all four generator-side sites delegate to it — the two layers are collapsed
onto one call path, so **a fix can no longer land in one layer and miss the other** (which is exactly
what happened to the first hvco fix).

- **Scored** (`adCopy`, `headlines`): `selectionScore DESC`, id as tie-break. `selectionScore` is a
  real `decimal(5,2)`, so MySQL sorts numerically and puts NULLs last — an unscored row can never
  outrank a scored one.
- **Unscored, deliberate rules:** `hvco` prefers the `short` tab (mean 30, zero over 60) over `long`
  (133) and `subheadlines` (159), else shortest title. `heroMechanisms` prefers the
  `hero_mechanisms` tab — the one that actually names a mechanism (mean name 33) while
  `headline_ideas` averages **150** and would render a sentence where a method name belongs.
  ⚠️ **The old ordinal already landed there on 92/92 sets by accident of insertion order.** Stating
  the rule changes no output today; it stops a future reordering silently promoting a sentence.

**VERIFIED LIVE on real prod generations:**

| | picked | max available | ordinal would have taken | changed |
|---|---|---|---|---|
| headlines | **90.00** | 90 | 80.00 | ✅ |
| adCopy | **85.00** | 85 | 80.00 | ✅ |

Stale comment removed (it still called `selectionScore` ordering a "future enhancement" after it was
built — *a comment describing the opposite of the code is how the P7 negation trap survived*), and
four now-unused `asc` imports dropped. Teardown: 17 rows removed, settled 80s, re-verified, every
table at baseline, protected 6/6/6/6.

🔑 **THE PATTERN, for future sweeps:** an `orderBy(...).limit(1)` is only safe when the ordering
column *is* the decision. If it orders by `id` or `createdAt` to pick one of several interchangeable
generated variants, it is an ordinal standing in for a choice — and it will silently track insertion
order, which changes whenever a generator is reordered.

#### Original sweep record (impact measurements that justified the work)

The `orderBy(asc|desc(id)).limit(1)` pattern has now caused two defects (P8 ad-copy bodies, the hvco
selector). Swept every selection path. **List only — Arfeen wants to see it before any fix.**

**It is documented as provisional.** `orchestration.ts:332-338`: *"Strategy: pick the lowest-id row
in the set (first inserted; deterministic across re-runs). **Future enhancement: pick by
selectionScore DESC where the table tracks it (adCopy has selectionScore; others may not).**"* The
enhancement was never built — same shape as P1's dead `isLaunchStage`.

**MEASURED IMPACT — how often the ordinal differs from the best-scored row:**

| site | sets | picks a different row than the scorer would | avg score taken → available |
|---|---|---|---|
| **adCopy** | 134 | **82 (61%)** | 82.5 → **90.0** |
| **headlines** | 104 | **40 (38%)** | 81.3 → **87.1** |
| heroMechanisms | — | not comparable — **0 of 1,072 rows scored** | — |
| hvcoTitles | — | not comparable — **0 of 6,577 rows scored** | — |

So on ad copy the auto-selection is leaving ~7.5 points of its own scoring engine on the table in
6 runs out of 10, and on headlines ~5.8 points in 4 out of 10.

**THE 8 SITES — duplicated in two layers:**

*Orchestrator (`_core/orchestration.ts`), feeding `kit.selected*Id`:*
1. `:341` `pickFirstFromHeroMechanismSet` — unscored table
2. `:368/373` `pickFirstFromHvcoSet` — ✅ **FIXED** (prefers `short` tab, else shortest)
3. `:378` `pickFirstFromHeadlineSet` — **scored table, ignores the score**
4. `:383` `pickFirstFromAdCopySet` — **scored table, ignores the score, highest impact**

*Generator-side, same shape, feeding `autoSelectBest`:*
5. `hvcoGenerator.ts:368` — ⚠️ **STILL THE OLD SHAPE. My hvco fix only patched the orchestrator.**
   This path still selects the `long` tab. Same defect, second location.
6. `heroMechanismsGenerator.ts:375`
7. `headlinesGenerator.ts:542`
8. `adCopyGenerator.ts:817`

**Not the pattern (checked and cleared):** the ~35 `orderBy(desc(createdAt))` hits in routers are
list queries with no `limit(1)` — display ordering, not selection. `campaignExport.ts:283` and
`adCreativesGenerator.ts:448` (latest ICP for a service) take the latest of a set that should have
one member; defensible.

**Shape of the fix when authorised:** one shared helper, scored tables order by `selectionScore DESC`
with id as the tie-break; unscored tables keep a deliberate rule (hvco's tab preference) rather than
an ordinal; and the two layers collapse to one call path so a fix cannot land in only one of them —
which is exactly what just happened to me.

### 📌 COMMIT-MESSAGE DAMAGE — cosmetic, nothing lost

Backticks in a bash heredoc were shell-substituted, deleting words from two messages.
**Both are cosmetic and fully recoverable from surrounding context; no content is lost.**
- `e090e7e` — one word (`problem`): *"Also wires , which was a DEAD parameter: passed by all five
  call sites, interpolated into none"*. The clause names the parameter unambiguously.
- `c94f412` — four words (`long`, `subheadlines`, `short`, `short`), each named by the adjacent text
  (the insertion-order list, the parenthetical, and the quoted "Create 20 SHORT titles" rule).

**No STATE.md reconstruction needed** — the uncorrupted record was written here via the Edit tool,
which involves no shell. That is now the standing practice; see the TRAPS entry.

### ✅ HVCO LONG-TITLE DEFECT — it was SELECTION, not generation (`c94f412`)

**ROOT CAUSE.** `pickFirstFromHvcoSet` (`orchestration.ts`) was
`orderBy(asc(id)).limit(1)` — the lowest id in the set. The generator inserts tabs in order
**long → short → beast_mode → subheadlines**, so the lowest id is *always* the **`long`** tab.
Measured on **all 91 prod sets: the selector picked `long` 91/91**, mean 140 chars, max 271 — while
the **`short` tab (mean 30, ZERO over 60) was generated on every set and never once selected.**
Insertion order standing in for a choice — **the same bug shape as P8's `orderBy(desc(id))` on
ad-copy bodies. Look for this pattern elsewhere.**

**Fixed:** prefer the `short` tab; fall back to the **shortest** title for the 7 legacy sets that
predate it, so it can never return nothing where the old code returned something.
**Simulated across all 91 prod sets: mean 140 → 32 · max 271 → 45 · 97% over 60 → 3%.** The residual
3% is entirely legacy sets whose shortest title is itself 69–86 chars; P9 slot-fitting covers them.
Quality holds — *"The Sunday Dread Exit Intensive"*, *"5 Qualified Roles, 3-Line Fix"*.

⚠️ **THIS CORRECTS MY OWN P9 REPORT.** The "104-char average, the generator produces descriptions"
figure was **contaminated** — it pooled `subheadlines` (mean 159, and correctly sentences, they are
subheadlines) in with titles. By tab: **short 30 · long 133 · beast_mode 88 · subheadlines 159.**
The short tab was always producing perfect titles. **Do not quote the 104/318/79% figure again.**

⚠️ **AND CORRECTS MY P9 PROMPT PATCH, which was self-contradicting.** I had inserted *"every title
MUST be 60 characters or fewer"* into the LONG prompt **28 lines above its own instruction "Create
20 LONG, benefit-first titles"**, and into POWER MODE which asks for *"a mix of long (7-15 words)
and short"*. Two conflicting orders; the task instruction wins, so the cap was inert. Removed from
both — it now sits **only** on the `short` prompt, where it agrees with "Create 20 SHORT titles
(3-7 words)". **The few-shot examples were never the problem: all three are 44–59 chars.**

The `long` tab is a legitimate product surface, so it is **bounded, not capped**: *"7 to 15 WORDS —
one line, the length of a book title"*. **Verified by two real prod generations: long mean 242 → 81,
max 267 → 92**, now producing actual titles (*"The 90-Day Career Pivot Plan: Target Role, Real
Salary, No Credential Reset"*). Short unchanged at mean 31 / max 36 / 0% over 60.

**📌 BACKFILL DECISION — NOT WORTH IT, leave the 6,577 rows.** The selector fix is a **read-time**
fix, so it retroactively improves every existing set: 84 of 91 already have a `short` tab and now
resolve to a good title with zero regeneration. The 7 without fall back to shortest (23–86 chars),
of which only 3 exceed 60 and P9 slot-fitting handles those. A backfill would burn tokens
regenerating 6,577 rows to improve at most 3 sets that are already covered. **They are latent, not
live** — stored only, and just two accounts ever published, both Arfeen's.

🔴 **PROD IS ABOVE BASELINE — 113 test rows from the two verification generations.**
`hvcoTitles` **6690** vs baseline **6577**. Awaiting explicit go-ahead:
`DELETE FROM hvcoTitles WHERE hvcoSetId IN ('SOmzF3EsNP9M75J9uEfjx','rmr4FHtalld-WmKb8YLax');`

### ✅ P9 FIXED + PROVEN ON A PUBLISHED PAGE 2026-07-29 (`fda7127`)

All six defects fixed and verified at a real `/p/` URL. Screenshots:
`docs/screenshots/run-2026-07-29-p9/`.

**P9-1** `yourbrand` / `YOUR BRAND'S` → both slots OMIT when no coachName (the disposition the coach
cutout already used). **P9-2** stars + "Trusted by high achievers" → conditional on real supplied
proof; the old guard dropped the NUMBER and kept the CLAIM. **P9-3** cover clipping → title fitted +
badge gutter reserved. **P9-4** article stripped before prefixing. **P9-5** new shared primitives
(`fitTitle` / `withoutLeadingArticle` / `fitPrefixedTitle` / `fitTitleForPunctuatedSlot`) so ALL
templates benefit, plus a 60-char rule in all three hvco prompts. **P9-6** filler → `solutionIntro`,
omitted when absent.

🔑 **THE UNIT TEST ENCODED THE DEFECT.** `burchardProductivity.test.ts` asserted `★★★★★` was ALWAYS
present — it locked in fabricated social proof. Inverted, with the positive case added. **Check
whether a failing test is asserting the bug before "fixing" the code to satisfy it.**

🔑 **THREE MORE DEFECTS FOUND ONLY BY THE SCREENSHOT — after a served-bytes grep had reported all six
fixed.** A SECOND `cta` computation the hero fix missed (full 200-char title as a six-line orange
slab on the bottom button) · the fitted ellipsis colliding with the slot's own punctuation
(`"Is… Now!"`, `"Your…."`) · orphaned opening brackets from truncation (`"QUALIFIED FOR (BUT…"`).
**Grepping the HTML is not the same as looking at the page.**

⚠️ **MEASURED, AND BIGGER THAN THE CAP — needs its own pass.** 6,577 prod `hvcoTitles` average
**104 chars, max 318, 79% over 60**. **The hvco generator produces DESCRIPTIONS, not titles.** A
drop-based cap would collapse the deck (STANDING RULE 1), so the fix is prompt-side + slot-fitting.
Existing 6,577 rows are unchanged and still long.

**✅ Cloudinary sweep built** — `server/lib/adCreativeTeardown.ts`. Reads public_ids from the stored
URLs **before** deleting rows (unrecoverable afterwards), sweeps Cloudinary best-effort, then deletes
rows unconditionally so a Cloudinary failure never leaves the DB above baseline. `dryRun` lists what
would go. ⚠️ Drizzle's delete does NOT return `affectedRows` — the module falls back to `rows.length`;
do not trust that field elsewhere.

**Teardown complete:** KV purged (both slugs verified **404**), LP rows deleted, LPs back to **90**,
every table at baseline, protected **6/6/6/6**, smoke user has **0** published pages.

### ✅ HEADLINE-OVER-FACE FIXED + PROVEN LIVE 2026-07-29 — the tabloid zone contract (`c9398ae`)

Both halves built, mirroring what editorial always had and tabloid never did.

**Prompt half:** a composition clause on all five styles — subject high in frame, lower half kept as
calm open space. Positively framed. **STYLE-AWARE**, because the first draft said *"head and
shoulders, framed from the chest up"* and would have put person-wording on the two still lifes —
the exact self-contradiction of P6 cause 1, caught before it shipped. Split into
`compositionPerson` / `compositionSetting`.

**Compositor half:** new zone **`"lower"`**. Centring and bottom anchoring **unchanged** (tabloid
look preserved); what changes is the scrim. The legacy gradient began at `headTop − 0.06H` with
**stop-opacity 0** and only reached 0.72 at 55% down, so the first headline line rendered against an
effectively transparent scrim — text straight onto an undarkened face. `"lower"` starts at
`headTop − 0.14H` and ramps to 0.62 by 25%. **Legacy geometry untouched** for zone
`undefined`/`"bottom"`/`"left"`, so recomposite and wizard-single paths render as before.

**Verified live, service 277, ALL FIVE inspected:** faces and subjects clear of the headline in
every slot; the two still lifes composite over dark surface. ⚠️ **Honest limit — v3 and v5 have the
headline cap-height grazing the jawline** rather than crossing a feature. Large improvement, not
perfection. ⚠️ **Watch:** the `object` slot now renders quite dark, with the subject pushed high
behind a stronger scrim. Teardown complete (402 → 397, remnants 0, protected 6/6/6/6).

### ✅ P6 CAUSE 2 SHIPPED + PROVEN LIVE 2026-07-29 — the gender resolver (`dac624a`)

`server/_core/subjectDescriptor.ts`. Three tiers, failing to neutral, never to a guess. Wired into
**both** batch paths (Auto Mode + wizard) via `resolveSubjectForService` → `subjectClausesForBatch`.

**Verified live on prod against real ICPs:** clear-female (ICP 247, tier 1) → **all five female,
all five inspected** · clear-male (synthetic input through the real resolver, tier 1) → all five
male, **4 of 5 inspected** · mixed (ICP 253, tier 3) → **woman/man/woman** across person slots ·
end-to-end through `runAdCreativesGeneration` on service 277 → v1 woman, v3 man in the composited
output, P8 rotation still holding. **Teardown complete** — 5 rows, settled 80s, re-verified,
creatives back to 397, remnants 0, protected 6/6/6/6.

🔑 **LIVE RENDERING CAUGHT A BUG STRUCTURAL REASONING MISSED — carry this forward.** Alternating on
the *variation index* put every woman on a visible slot and every man on a still life: `VARIATIONS`
is `[person_shocked, screenshot, person_intense, object, person_curious]`, so the person-bearing
styles sit at indices **0, 2, 4 — all EVEN**. A "mixed" ICP rendered **three women and zero men**
while the unit tests passed, because they asserted the clause *sequence* rather than what a viewer
sees. Fixed by alternating over person-bearing slots; tests now assert the visible subset.

**Measured on prod:** every career-pivot ICP (249–254) resolves **tier 3 mixed** — the hedged
"All genders, skewing slightly…" prose is the common case, exactly as designed. ICP 247 ("Female")
is the only tier-1 clear resolve in the sample. **No ICP resolved via tier 2 in this sample** — the
07-28 parenting ICP that would have is deleted, so tier 2 is covered by unit tests using its
verbatim text, not by a live render.

⚠️ **Not testable and left unproven:** the "v1 no longer shows a newborn for a seven-month-old ICP"
check. That needs the deleted parenting ICP 259; the career-pivot ICPs have no baby. The `problem`
parameter wiring itself IS proven (scene text reaches every prompt).

### ✅ PROVEN LIVE ON PROD 2026-07-29 — fix C, P8 rotation, P6 cause 1

Deployed `e090e7e` (Railway SUCCESS on the exact SHA, prod 200). Step 9 invoked against **real prod
service 277 / ICP 254** via `scripts/prove-creatives-live.mjs` — the real `runAdCreativesGeneration`,
real prod `adCopy` rows, real Replicate + Cloudinary. Batch `batch-1785329050853-d6c03d7a`.

- **P8 ✅** three distinct bodies rotating exactly as designed (3 rows over 5 slots → 1,2,3,1,2):
  v1/v4 *"You've updated your LinkedIn…"* · v2 *"You've done the assessments…"* · v3 *"You know that
  feeling when Sunday evening arrives…"*. **4 of 5 inspected**; v5 not opened.
- **Fix C ✅** zero in-image text on all four inspected — no newsprint, no callout labels, no garbled
  book covers.
- **P6 cause 1 ✅** both person-free styles are genuinely person-free: `screenshot` = empty desk,
  `object` = desk still life. First time either has been.
- **Latency:** **13.1s per creative end-to-end** (65.6s / 5). The harness's 5.5s median is
  *generation only*; the extra ~7.6s is download + dual Cloudinary upload + resvg composite. **The
  `~2-2.5 min` batch figure in `adCreativesGenerator.ts:16` is stale — 65.6s measured. Correct it.**
- **Still male** (P6 cause 2, held) and **the headline still crosses the face in v3** (compositing
  fix, held). Both expected.

**Reconciliation: creatives 397 → 402 = exactly +5.** Every other table unchanged (services 124 ·
ICPs 101 · kits 49 · adCopy 5405 · LPs 90 · emails 96 · WA 91) · 0 running jobs · protected rows
intact 6/6/6/6. No LP published → no KV to purge.

✅ **TEARDOWN COMPLETE 2026-07-29** — executed on Arfeen's explicit go-ahead. 5 rows deleted,
**settled 75s, then re-verified**: creatives back to **397**, batch remnant **0**, and every other
table at baseline (services 124 · ICPs 101 · kits 49 · adCopy 5405 · LPs 90 · emails 96 · WA 91 ·
offers 101 · mechanisms 1072) · **0 running jobs** · protected rows intact **6/6/6/6**.
**A fresh session has nothing to clean in the DB.**

### 🔴 STILL UNPROVEN — the two paths this run did NOT exercise

1. **`routers/adCreatives.ts:981` — the WIZARD batch P8 site.** Fixed in code, never executed. This
   run drove `adCreativesGenerator.ts` only. **Needs a wizard generation through the UI.**
2. **The full 11-node cascade.** Not re-run — it was already proven end-to-end on 2026-07-28, and the
   unproven surface was step 9, which this run covered directly. ⚠️ **Blocker if a full cascade is
   wanted: the smoke user 117174 has ONLY protected rows** (services 272–277, ICPs 249–254) — there
   is no spare service/ICP to run against, and deployed prod has **no scripted login**
   (`/api/test-login/:openId` is `NODE_ENV=development` only). A full cascade therefore needs either
   Arfeen driving the UI, or new parent rows created first.

### Superseded — the old entry

**`1f077d9` is PUSHED to `railway-build` and deployed. The live cascade was NOT run** — the session
hit its context ceiling and a cascade must never be started without room to tear it down
(TRAPS: *teardown outranks the artifact read*). **This is the top of the queue.** Everything needed:

**What the cascade must prove — three things a raw-plate harness run cannot:**
1. **P8** — the five creatives carry **different** body lines. Three sites were fixed, not two;
   `routers/adCreatives.ts:981` (wizard batch) had the same defect. Auto Mode exercises
   `adCreativesGenerator.ts` only, so **the wizard site stays unproven unless a wizard batch is also
   run**. Do both if context allows; **if not, state explicitly which one is unproven** rather than
   letting an Auto-Mode pass imply the wizard path was covered.
2. **Fix C** — zero in-image text on *live-generated* creatives, not the reconstructed harness run
   (the harness reconstructs `niche` and never touches the ICP).
3. **Latency** — whether the harness's **median 5.5s/image** holds on the live path. If it does, the
   old `~2-2.5 min` batch comment in `adCreativesGenerator.ts:16` is stale and should be corrected.

**Preconditions (do not skip):** verify `E2E_NOPUBLISH_OPENID` active on the **running** server, not
merely saved · take a **fresh** pre-run baseline (do not trust the numbers below) · never push
mid-cascade.

**Baseline at 2026-07-29 push time** (re-verify, do not recall): services 124 · ICPs 101 · kits 49 ·
creatives **397** · adCopy 5405 · 0 running jobs. Protected rows untouched: services 272–277 ·
ICPs 249–254 · kits 187–192 · LPs 222–227.

**Teardown:** fresh baseline → reconcile counts (never an id list) → settle, then **re-verify**
(late writers are real: lazy concepts, durable bonus-PDF job, compliance precompute) → purge KV if a
page published. **Every delete needs Arfeen's explicit "execute" in the immediately preceding
message.**

### Then — P6, and it is wider than "gender"

**📄 PROPOSAL READY, NOTHING BUILT: `docs/handovers/P6_PROPOSAL_subject-control.md`.**

Two independent causes. **Cause 1 is a live self-contradiction and is cheap:** `nicheContext` is
appended unconditionally to **all five** styles, so the `object` prompt reads *"no person in frame …
**The person** and setting must visually match … **their** clothing, environment, and expression"* —
four words apart. That is why the fix-C re-run's object slot still returned a person, and it
**predates fix C**. ⚠️ **The earlier attribution of that drift to `prompt_upsampling` is REFUTED** —
the re-run had upsampling off and the drift persisted. Make `nicheContext` style-aware.

**Cause 2 needs a resolution step, not a concat** — `demographics.gender` is hedged *population*
prose (*"All genders, skewing slightly female (55–60%)"*) and a photo needs **one** person.
Three-tier resolver: deterministic skew parse → **the ICP's own first-person words** (the 07-28 ICP
says *"other mums in my antenatal group"* where the demographics field hedged; grounding the
depiction in what the ICP actually says is the anti-fabrication principle applied to imagery) →
the alternating path below.

**✅ BOTH PRODUCT CALLS DECIDED BY ARFEEN 2026-07-29 — do not re-litigate:**

> **One audience, one depiction. An actually-mixed audience, both.**

- **PER BATCH** — all five creatives depict the same person type, **resolved from the ICP, never
  guessed**. Applies whenever the ICP is **CLEAR** (mums / she / maternity pay → **all five
  female**). A clear ICP is not a mixed one.
- **ALTERNATE ACROSS THE FIVE SLOTS** — **only** when the ICP is *genuinely* mixed (a real 50/50, or
  a skew too weak to resolve). This is tier 3, not a general variety mechanism.
- **Never a coin flip; never a silent default to Flux's prior** — "unspecified" resolving to Flux's
  prior is precisely why all five subjects came out male.

Also: `problem` is a **dead parameter** in `generateAdImagePrompt` — passed by all five callers,
interpolated into none. Wire it (it carries the scenario that would have prevented v1's newborn) or
delete it.

### Then — headline-over-face, and P9

**Compositing, do it properly.** Editorial already has the answer: it passes `zone` AND its photo
prompt is told to leave that zone clean — a two-sided contract (`compositeHeadline.ts:165-169`).
Tabloid has **neither** half: `headTop` is computed from font metrics alone and never inspects the
photo, and the scrim starts at opacity 0 exactly where the headline lands. Extend the contract
rather than bolting on a fixed offset.

**P9** LP text overflow, grammar break, 137-char lead-magnet title cap.

### 🟡 LOGGED, NOT SCHEDULED — needs its own pass, not a drive-by

`adCopyGenerator.ts:40` carries a **"Do NOT write"** list with concrete failure examples
(*"I used to be fat, now I'm thin"*). That is the **§14 negative-priming anti-pattern** — the same
class as the P5 leak, sitting in a **live compliance block**. CLAUDE.md records negative examples as
the root cause of the Sprint B email regression. **Needs regression testing, not a quick edit.**

### Then, roughly in order

- **A8 — ad-copy 0-card deck.** Real body rows exist in DB but the deck fetch returns 0 → the coach
  sees "your ad copy options didn't come through". `b0a15ca` did NOT close the ad-copy case.
  A real coach hits this.
- **Copy readability / register pass.** Generated copy is jargon-heavy across headlines/LP/offer/
  method names. A13 measures Flesch-Kincaid (9.4–9.6) but **no bar was ever agreed**. Needs a
  *register standard*, not just a number — jargon scores fine. Proven template = the bonus-title
  fix (positive-framing prompt guidance, no negative examples). Needs Arfeen's call on the bar.
- **A11 — unresolved `[INSERT_*]` tokens** (EVENT_TIME, PARKING_INFO, BONUS_1–5, GUARANTEE_TERMS,
  BOOKING_URL…). The known facts-schema gap → the "Way 2" per-node scan-ask. Not a regression.
- **Bonus deliverable FORMAT decision — interactive-first.** A bonus is a tool you operate, not a
  reading task; PDF was never chosen, it came bundled with the lead-magnet pipeline. Likely both
  HTML (primary) + PDF. **State persistence is make-or-break.**
- **Problem B** — per-node review surface + existing-assets import (forward-only wizard).
- **Andromeda backbone** — real Meta fatigue signals (`frequency`,
  `first_time_impression_ratio`; the "score" fields do NOT exist) + P.D.A. concept axis.
  Touches `adCopyGenerator.ts`.
- 🔴 **Image-model evaluation — FLUX vs OpenAI. HALF-RUN, BLOCKED ON A KEY.** Harness built and
  working: `scripts/adimage-bakeoff.mjs` (calls the REAL `generateAdImagePrompt`, never a copy;
  writes PNGs + `results.json` with per-call latency; local-only, touches no prod row).
  **Flux half done** — 5/5, median **5.5s**, zero text. **OpenAI half cannot run: there is no
  `OPENAI_API_KEY` in the Railway prod env** (only `REPLICATE_API_KEY`). Arfeen must add one, then:
  `railway run … npx tsx scripts/adimage-bakeoff.mjs --models=gpt-image-1,gpt-image-1-mini --quality=medium`
  · **Cost is NOT the deciding axis — it is neutral.** Verbatim published prices, 5 creatives/campaign:
  flux-1.1-pro **$0.20** · gpt-image-1-mini high **$0.18 (−10%)** · gpt-image-1 medium **$0.21 (+5%)**
  · gpt-image-2 medium $0.265 · gpt-image-1 high $0.835. Decide on quality + latency.
  · **Judge on instruction adherence, not text fidelity** — we want ZERO in-image text, so the
  question is "does it leave the frame clean / hit a stated subject / respect a reserved zone",
  which is what fixes A and D depend on.
  · Scope is the **generation call only** — Cloudinary stays. `generateImage` already hands a Buffer
  to `storagePut`, and OpenAI returns base64, which removes a fetch.
- **Andromeda closed write-back loop** — gated, last, own scope call (autonomy + coach spend).
- **`.pdf.pdf`** bonus-PDF storage-key double-suffix — cosmetic, resolves 200, tidy later.
- **Off-ICP testimonial filtering** — deferred product call, leave as-is.

### Arfeen's open actions

- 🔴 **Rotate the smoke password** (`zap-e2e-smoke@mailinator.com`) + update `~/.zap-e2e-creds.env`.
  Deferred through three runs.
- 🟡 **Cloudinary cleanup — ad creatives (added 2026-07-29).** A DB delete never touches Cloudinary,
  so every torn-down run leaves its images behind. **30 orphans from the three 07-29 proof runs** —
  cloud `dunshei0y`, Media Library. Search **`batch-1785333231628`** → delete 10:
  ```
  ad-creatives_117174_batch-1785333231628-37151b84_variation-{1,2,3,4,5}.png.png
  ad-creatives_117174_batch-1785333231628-37151b84_raw-variation-{1,2,3,4,5}.png.png
  ```
  then search **`batch-1785332250726`** → delete 10:
  ```
  ad-creatives_117174_batch-1785332250726-7ef0a725_variation-{1,2,3,4,5}.png.png
  ad-creatives_117174_batch-1785332250726-7ef0a725_raw-variation-{1,2,3,4,5}.png.png
  ```
  then search **`batch-1785329050853`** → delete 10:
  ```
  ad-creatives_117174_batch-1785329050853-d6c03d7a_variation-{1,2,3,4,5}.png.png
  ad-creatives_117174_batch-1785329050853-d6c03d7a_raw-variation-{1,2,3,4,5}.png.png
  ```
  ⚠️ Note the **`.png.png` double suffix** — same storage-key bug class as the known `.pdf.pdf`
  issue, so search on the batch id rather than the extension. ⚠️ Also check `resource_type`: the
  bonus PDFs were stored as **`image`** not `raw`, which is why a delete silently no-ops.
  **Standing gap: teardown reconciles the DB only. Cloudinary orphans accumulate across every run
  and nothing sweeps them** — worth a small teardown-side sweep by batchId eventually.
- **Cloudinary cleanup:** two orphaned bonus PDFs, public_ids `bonuses_117174_19.pdf` and
  `bonuses_117174_20.pdf`, resource_type **`image`** (not `raw` — that's why a delete silently
  no-ops), cloud `dunshei0y`. Media Library → search `bonuses_117174_` → delete.

---

## 3. TRAPS

Each of these has already cost real time. They are cheap to store and expensive to rediscover.

### Prod safety

- **PROTECTED ROWS — do not touch:** services **272–277**, ICPs **249–254**, kits **187–192**,
  LPs **222–227** and all their sequences/creatives/headlines/adCopy. Legitimate smoke rows from
  the 23–24 July runs.
- **Every prod write needs Arfeen's explicit "execute" in the immediately preceding message.** No
  exceptions for small, safe, schema-only, test-account, or "done it before". If approval is
  ambiguous, do not write.
- **Never push mid-cascade.** A push is a deploy is a container swap is a dead cascade — that is
  exactly what killed the first run (Railway `c9b0fdaa`, created ~1 min before the job's last
  write). Wait for deploy SUCCESS and a settled container before starting a run.

### Teardown

- **Teardown outranks the artifact read.** Take a **fresh pre-run baseline**; reconcile counts
  against it, never trust an id list.
- **Settle, then re-verify. A single post-delete count is not proof.** Late writers are real:
  lazy concept generation, the durable bonus-PDF job, compliance-rewrite precompute.
- Clean Cloudflare KV if a page was published.

### Measurement

- **`mysql2` timezone trap:** it parses MySQL `DATETIME` in the *connection* timezone (default
  local), so on an IST machine every stored UTC timestamp renders **5h30m early**. Compare DB
  timestamps to `SELECT NOW()` on the **same connection**, never the shell clock. This produced a
  wrong "6h45m" elapsed figure once already.
- **NEVER put backticks in a commit message written through a bash heredoc.** `git commit -F - <<'EOF'`
  still lets the shell substitute inside the *outer* command line, so backticked words are executed
  and silently **deleted** from the message. This has now eaten words from two commits
  (`e090e7e`, `c94f412`). Write prose-heavy records with the Edit tool into `docs/handovers/`, where
  no shell is involved, and keep commit messages backtick-free.
- **A malformed probe looks exactly like a broken service.** Two API probes returned HTTP 400
  `invalid_request_error` — that was shell quoting mangling JSON inside `railway run bash -c`, not
  the API. Probe from a node script with `JSON.stringify`, never a heredoc through nested quotes.
- **`RAILWAY_GIT_COMMIT_SHA` is empty under `railway run`** — deployed-SHA read-back is INDIRECT.
  For server-only commits there is no client bundle to fingerprint either. **The direct proof is
  functional:** find a string that exists only in the pushed commit and observe it live.

### Not defects — do not re-investigate

- **Deck sizes are liteMode.** 9 adCopy rows and ~10 headlines is the constant Auto Mode output —
  `liteMode: true` is hardcoded at `orchestration.ts:334, 401, 428`. Verified identical across six
  prior runs predating the compliance layer. **Normal, not a regression.**
- **The LP's empty fields are BY DESIGN.** The `lead_magnet_download` prompt explicitly instructs
  `uniqueMechanism: ""`, `whyOldFail: ""`, `insiderAdvantages: ""`
  (`landingPageGenerator.ts:262-294`). Only asSeenIn / testimonials / shockingStat are beginner
  suppressions. **Not a coherence break.**
- **Meta's headline figure is 27 and is a DISPLAY RECOMMENDATION, not a limit.** ZAP's **38 is a
  settled house standard — Arfeen has decided this. Do not re-litigate.**
- **The reaper's pending-only filter is DELIBERATE** (see queue item 2). Widening the sweep is not
  the fix.

### Process

- **The frozen PNG is the sole source of truth for any reference** (CLAUDE.md §15a). Three
  replication specs once carried prose contradicting their own PNGs, and every gate passed against
  the lie.
- **Never add a dep with npm** — it regenerates `package-lock.json` and re-opens the pnpm lockfile
  drift that broke deploys for a day.
- **A commit is not "held" once anything sits on top of it and is pushed** — push moves the whole
  ancestry.
- **Negative examples in prompts prime the failure** (CLAUDE.md §14). Positive-only framing.
- **Before any prod smoke run:** verify `E2E_NOPUBLISH_OPENID` is active on the **running** server,
  not merely saved.

---

## 4. WHERE THINGS LIVE

| | |
|---|---|
| Meta compliance (authoritative) | `docs/compliance/META_AD_COMPLIANCE_REFERENCE.md` — read before any compliance/copy-register work; carries a **DO-NOT-BUILD list** of plausible-sounding material absent from Meta's docs |
| Andromeda brief | `docs/andromeda/EXECUTION_BRIEF.md` |
| ICP research | `docs/icp-research/` |
| Bonus research | `docs/bonus-research/` |
| Visual quality bars | `docs/AD_IMAGE_VISUAL_QUALITY_STANDARD.md` · `LANDING_PAGE_VISUAL_QUALITY_STANDARD.md` |
| Dated handovers (history) | `docs/handovers/archive/` |
