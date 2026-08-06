# ZAP Copy Engine — Andromeda Build Spec (plain English)

**What this is:** the six NotebookLM reports on how Meta's Andromeda engine reads ad *copy*, boiled down into one set of build rules. This is the copy equivalent of the image rule-spec that actually shipped. It says what the copy engine must DO — it is what we hand to Claude Code to build.

**Status of sources:** built from the six reports you ran (Entity-ID Distinctness, Field Fusion / Rosetta, Opening Tokens, Awareness-Stage Retrieval, Account Diversity, Verification Signals). The standalone "Andromeda Copy Standard" report is NOT folded in yet — you were going to run it and haven't pasted it. All six here agree with each other, so this spec is safe to act on; the standalone can slot in as a cross-check when it arrives.

---

## 1. The one core rule (everything else serves this)

**Two pieces of copy count as "different" to Meta only if they differ in at least TWO of these four things:**

- **P — Persona** (who it speaks to: the burned-out founder vs. the new mum vs. the plateaued athlete)
- **D — Desire or Pain** (what it's about: fear of failure vs. desire for freedom vs. relief from exhaustion)
- **A — Awareness stage** (how switched-on the reader is: problem-unaware → most-aware)
- **F — Format** (the shape/voice: a first-person story vs. a blunt question vs. an authority statement)

Call it the **2-of-4 P.D.A.F. rule**.

- Differ in **2 or more** → Meta treats them as genuinely separate ads. Each gets its own place in the auction. Good.
- Differ in **0 or 1** → Meta collapses them into ONE ad behind the scenes ("same Entity ID"), gives the whole group a single ticket to the auction, and suppresses the rest. You *think* you're testing five ads; Meta is really running one. Bad.

This is the exact same failure we fixed on the image side ("Same-Talent Collapse"), just in words instead of faces. Swapping a few words — "Struggling to scale?" vs "Finding it hard to scale?" — is **cosmetic**. Meta sees through it. The engine has to force *structural* difference, not word-swaps.

**So the build rule is:** before the engine keeps a batch of copies, every pair must clear the 2-of-4 bar. Any pair that doesn't → reject one and regenerate on a different dimension. This is a categorical yes/no check we control — not a guess about Meta's internal score.

---

## 2. The opening words carry the weight (first 5–10 words)

Meta decides which "shelf" to file your ad on from the **first 5 to 10 words** of the body text — before it even reaches the rest. Reports call this "topological priming." Start with specific, category-naming language and Meta files you correctly; start with "Hey guys, are you tired of…" and Meta files you under generic chatter and shows the ad to the wrong people.

**Two different limits — don't confuse them:**
- **First ~10 words** = the *algorithm's* filing decision (does the right audience even get shown this).
- **First ~125 characters** = the *human's* "See More" cutoff (does the person bother to read on). Only ~1% ever tap "See More."

**Build rule:** the engine must open every body with high-specificity, category-naming words — the persona's actual problem language — not a generic warm-up. First 10 words do the algorithmic work; keep the human hook inside the first 125 characters too.

---

## 3. The three text surfaces must COMPLEMENT, not repeat (and not scatter)

An ad has up to three text surfaces Meta reads: **text baked into the image** (it reads this with OCR — "Rosetta"), the **headline field**, and the **body**. Meta fuses all three into one meaning — it does NOT weight them by fixed percentages (the "headlines are worth 50% more" claim is folklore; ignore it).

Three ways to get this wrong/right:

- **Repeat the same line across all three** → Meta sees redundancy, collapses it to one Entity ID, suppresses. (This is the fake-diversity trap again.)
- **Three unrelated messages** → Meta can't find a stable meaning, ad matches no one well.
- **Right way — complementary reinforcement:** the three surfaces hit the *same idea from different angles*.

The reports give a clean division of labour:
- **Image-baked text** = the emotional hook ("Wake up without back pain").
- **Headline** = the proof/mechanism, never a repeat of the hook ("Orthopaedic-doctor approved").
- **Body** = the context/persona depth, opening with the priming words ("Why spinal alignment is the secret to deep sleep. If you toss and turn all night…").

**Build rule:** the engine must generate the three surfaces as a coordinated set that complement each other — hook / proof / context — and must actively block the case where the headline or body just re-states the image text. This is the piece that ties the copy engine to the image engine we already shipped: they have to be aware of each other's text.

---

## 4. Awareness stage is a targeting lever, not just a tone of voice

We already knew awareness stage changes *how persuasive* copy feels. The new finding: awareness stage also changes **who Meta shows the ad to** — it's a retrieval signal, not only a persuasion one. Problem-unaware copy and most-aware copy get routed to different audiences by the machine.

**Build rule:** awareness stage must be wired into copy generation as a real, tracked dimension (it's the "A" in P.D.A.F.), and the mix across a batch should be deliberate — weighted toward colder stages for cold traffic — not accidental. Right now our headline node (Node 6) doesn't carry awareness stage at all; that's a concrete gap to close.

---

## 5. How many distinct copies per account (scale to budget)

More budget and more conversion signal = Meta can meaningfully tell apart more distinct ads. The reports give rough bands:

- Small budget / early signal: ~**8–12** genuinely distinct copies.
- Mid: ~**15–25**.
- Large / mature: ~**25–40+**.

"Distinct" means distinct by the 2-of-4 rule — not 40 word-swaps. Past the band, extras just collapse and compete with each other for the same ticket.

**Build rule:** volume targets should scale to the account's budget/signal, and the engine shouldn't manufacture more variants than the account can actually separate.

---

## 6. How we know it's working (watch behaviour, don't invent a number)

Meta does **not** show us its internal similarity score. So we never hard-code a made-up threshold. We judge collapse by what we *can* see:

- **Spend skew** — one ad in a set eats almost all the spend, the rest starve → collapse.
- **Delivery starvation** — variants stuck at near-zero impressions despite active status.
- **Overlapping CPM / auction overlap** — variants bidding against each other.
- **Stuck in learning** — a set that never exits the learning phase.

**Build rule:** verification is these observable proxies, checked after launch — not a promise from a local score.

---

## 7. The one number to strip out

All six reports slip in a specific instruction: run a local "sentence-transformer" check and reject any pair scoring **cosine similarity above 0.40**. **Treat this as a heuristic, not truth — same discipline that kept the image work honest.**

Why it's not truth: that 0.40 comes from a *local* model that is **not** Meta's embedding. It can't see Meta's Entity-ID clustering; it's an outside approximation with an arbitrary cut-off. If we bake 0.40 in as if it were Meta's real boundary, we're repeating exactly the "60% threshold" folklore mistake we already threw out on the research side.

**Build rule:** the real gate is the categorical **2-of-4 P.D.A.F.** check (Section 1) — that's a rule we own and can prove. A local similarity score may run *underneath* as a cheap tie-breaker / sanity flag, clearly labelled as a tunable heuristic, never as the pass/fail authority, and never with 0.40 presented as a Meta-derived fact.

---

## 8. What this means for our actual code (hand-off to Claude Code)

Against the as-built doc, the concrete gaps this spec implies — for CC to confirm against the live code and propose the build:

1. **Node 6 (Headlines):** currently has 5 formulas but **no awareness stage**. Add awareness stage as a tracked dimension; make headlines part of the complementary hook/proof/context set rather than standalone.
2. **Node 7 (Ad Copy):** enforce the three-surface **complementary** rule so headline/body don't restate the image-baked text; wire the **opening-10-words priming** rule into body generation.
3. **New gate across both:** the **2-of-4 P.D.A.F. distinctness check** on every batch, with regenerate-on-collapse — the copy analogue of the image visibility tier.
4. **Coordinate with the image engine** so the copy surfaces and the baked-in image text are generated aware of each other (complement, don't duplicate).
5. **Verification:** post-launch checks on the observable proxies, not a fabricated score.
6. **Volume:** scale distinct-variant count to budget band.

That's the WHAT. The HOW (which files, which functions, the order of the build) is CC's to propose from the live code — same rule as always.

---

## 8a. DECISIONS SETTLED 2026-08-07 (recorded, deliberately NOT built in the Node 6 step)

### Decision 1 — a campaign may carry more than one persona and more than one pain

**This is the ceiling-raising work, and the Phase 0 measurement is what makes the case.** Today
every piece of copy in a deck is generated from one ICP's single target market and single problem
statement, so **P and D are constant across the whole deck by construction**. Two of the four axes
are permanently pinned, and the entire distinctness budget rests on awareness and format.

The arithmetic is exact, and the live Node 6 run reproduces it to the pair. With P and D pinned, a
pair is distinct only if it differs on BOTH awareness and format. So the collapsing set is
"same stage OR same formula", which at 25 headlines across stages of 10/9/3/3 is:

- same-stage pairs: 45 + 36 + 3 + 3 = **87**
- same-format pairs: 5 formulas × 10 = **50**
- counted twice (same stage AND same formula): **10**
- total: 87 + 50 − 10 = **127 of 300 pairs = 42.3%** — exactly the measured figure.

**The floor cannot go below that while P and D are pinned.** Node 6 is already sitting on it. No
further prompt work, formula work or stage work moves this number; only a third varying axis does.

**Named phase: PERSONA/PAIN WIDENING.** Proposed shape, to be built only on explicit go-ahead:

**Can the existing concept machinery be connected rather than rebuilt? Partly — and the honest
answer is that it solves the D axis and not the P axis.**

- ✅ **Reusable as-is:** the axis vocabulary (`_core/conceptAxis.ts`), the deterministic
  cold-weighted allocation both nodes now share, the concept validator, and the shared
  three-attempt compliance retry cap. `campaignConcepts` already carries `personaLabel`, `desire`,
  `awareness` and `hookPattern` as live columns — the record shape exists and is in production for
  the video side.
- ✅ **Desire is genuinely available.** Concepts vary Desire × Awareness within one ICP, so wiring
  ad copy to read a concept row would supply a real third axis and break the same-stage collapse.
- 🔴 **Persona is NOT available, and this is the load-bearing finding.** `conceptGenerator.ts:332`
  sets `personaLabel` once from the ICP (`angleName || name`) and stamps the identical value on
  every concept in the set. `conceptAxis.ts:5` states the design plainly: *"N concepts vary Desire ×
  Awareness WITHIN one ICP (persona fixed to the ICP)."* **Connecting the concept engine would not
  widen persona, because the concept engine does not widen persona either.** Multiple personas
  require ICP-level work — more than one buyer per campaign — which is new build, not a connection.
- 🔴 **Two known blockers to the connection itself:** concept generation is fire-and-forget and
  explicitly must never delay ad-copy generation (the documented race at `adCopyGenerator.ts:489`),
  so an ordering change is needed before a concept row can be read; and the cardinality mismatch
  (concepts 8, tabloid deck 4, ad-copy deck 15–18) runs into the guard that **throws** on mismatch
  — the 4-vs-8 decision, which is Arfeen's.

**Recommended sequencing when it is taken up:** desire first (connect concepts, cheap, unblocks the
third axis), persona second (new ICP work, larger). Do not present them as one piece.

### Decision 2 — variation counts default smaller and scale to budget

Bands: roughly **8–12** small / **15–25** mid / **25–40+** large. Not a fixed ~50.

- The count becomes a **configurable setting**, not a constant. Today it is hardcoded three ways
  (`liteMode ? 3 : powerMode ? 30 : 15` in ad copy; a ×0.4/×1/×3 multiplier over 5 per formula in
  headlines).
- **The cut is enforced AT THE DISTINCTNESS GATE — never by trimming before the pieces are
  distinct.** Generating 40 and keeping the 12 that clear 2-of-4 is correct. Generating 12 and
  hoping is not: the gate needs a surplus to reject from, and the existing regenerate-on-failure
  loop needs somewhere to regenerate toward.
- Measured relevance: at 25 headlines with 5 formulas and 4 stages there are only 20 distinct
  (stage × formula) cells, so **25 headlines must repeat cells by pigeonhole** — 10 pairs on the
  live run differed on zero axes for exactly this reason. Smaller decks are not only cheaper, they
  are structurally less collapsed. Note the *percentage* stays near 42% while P and D are pinned;
  what falls is the absolute number of colliding ads actually published.

### Standing guardrails carried forward

1. **The gate compares assigned axes, never inferred ones.** The dimensions are written to columns
   at generation time (migration 0097). The Phase 0 recovery-by-replay was a one-off measurement
   device and is not how the gate works. No cosine score is the authority — see §7.
2. **Format is the formula or angle the piece was already written to** — `formulaType` for
   headlines, `bodyAngle` for bodies. No parallel format taxonomy.

---

## 9. Open item

The standalone **"Andromeda Copy Standard"** report is not pasted yet. Nothing here depends on it — the six agree — but when it arrives it's a good final cross-check against Section 1 (the 2-of-4 rule) and Section 7 (the 0.40 number). Decide whether you still want to run it, or call the six enough.
