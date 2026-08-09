# STEP 2b — PROPOSAL ONLY. Nothing built, nothing applied, nothing pushed.

Written 2026-08-10 against HEAD `ab9addb` (`railway-build`, 15 ahead of `origin/railway-build`
`51eda78`, nothing deployed). Every number below is either read off the code or measured by a
read-only query against production, and each is labelled with which.

---

## 1. What step 2b changes, in one paragraph

Today a row of ad copy gets its **desire** from the concept set and its **awareness stage** from a
completely separate cold-weighted allocation (`awarenessPlanForCount`). The two are computed
independently, so the pair `(desire, awareness)` stamped on a row need not correspond to any concept
that actually exists. Step 2a gave each row a `conceptId`, but that stamp only records *which concept
supplied the desire* — the stage beside it came from somewhere else. Step 2b makes each slot take
**both** axes from one real concept, so a row is a faithful instance of a concept rather than a
mix-and-match of two plans. That is the precondition for step 4's "one concept → one ad".

The desire-string dedupe is removed in the same change, because once a concept is a
`(desire, awareness)` unit, two concepts sharing a desire but differing in stage are genuinely
different and must both survive.

---

## 2. The mechanism

Replace the two independent plans with **one concept plan per surface**:

```
BEFORE   stagePlan  = awarenessPlanForCount(n)          // cold-weighted, synthetic
         desirePlan = dealAcrossSlots(conceptDesires, n) // distinct desire strings

AFTER    conceptPlan = dealAcrossSlots(concepts, n)      // whole concept rows, not deduped
         slot.awareness = concept.awareness
         slot.desire    = concept.desire
         slot.conceptId = concept.id
```

`dealAcrossSlots` is already generic (`<T>`), proven in step 2a — no signature changes.

**The no-concept fallback is untouched.** When an ICP has no concept set (older ICP, failed
generation, a run still in flight), `concepts` is empty and every surface falls back to
`awarenessPlanForCount` + the single deck-constant desire, exactly as today. That path cannot
regress.

### 2.1 Migration

**None.** `adCopy.conceptId` already exists (migration 0101, applied). No new column, no schema
change, no backfill. Step 2b is code-only.

---

## 3. The exact code

All in `server/adCopyGenerator.ts` unless stated.

### 3.1 Fetch concepts as rows, ordered, not deduped (`:545-566`)

```ts
// ── THE CONCEPT PLAN (step 2b) ──────────────────────────────────────────────
// A concept is a (desire, awareness) UNIT. Both axes now come off the same row, so a
// slot's stamp describes the copy rather than labelling it. The dedupe-by-desire that
// step 2a kept is REMOVED: two concepts sharing a desire are distinct on awareness by
// the set rule (conceptValidator enforces distinct desire x awareness pairs), and
// dropping one of them destroys a real slot.
//
// ORDER IS NOW LOAD-BEARING and therefore explicit. The plan is dealt in row order, so
// an unordered SELECT would make the deck's stage mix depend on MySQL's row return
// order. It did not matter while awareness came from a synthetic plan; it does now.
//
// One set per ICP is guaranteed upstream: ensureConceptsForIcp deletes any prior set for
// the icpId before inserting (conceptGenerator.ts:407). If that ever changes, this query
// must scope to the newest conceptSetId.
type ConceptSlot = { id: number; desire: string; awareness: AwarenessStage };
let concepts: ConceptSlot[] = [];
if (icp?.id) {
  try {
    const { campaignConcepts } = await import("../drizzle/schema");
    const rows = await db
      .select({
        id: campaignConcepts.id,
        desire: campaignConcepts.desire,
        awareness: campaignConcepts.awareness,
      })
      .from(campaignConcepts)
      .where(and(eq(campaignConcepts.icpId, icp.id), ne(campaignConcepts.status, "dismissed")))
      .orderBy(campaignConcepts.id);
    concepts = (rows as any[])
      .map((r) => ({
        id: Number(r.id),
        desire: String(r.desire ?? "").trim(),
        awareness: r.awareness as AwarenessStage,
      }))
      .filter((c) => c.desire && isAwarenessStage(c.awareness));
  } catch (err) {
    console.warn(`[adCopyGenerator] concept plan unavailable for icp ${icp.id}:`,
      err instanceof Error ? err.message : err);
  }
}

/** Distinct desire strings — a POOL of choices for the gate, not a plan. Dedupe belongs here. */
const conceptDesires: string[] = Array.from(new Set(concepts.map((c) => c.desire)));

/**
 * The concept behind a (desire, awareness) pair after the gate has moved an axis.
 * Exact pair first. Where the gate lands on a pair no concept holds, fall back to the
 * concept that supplied the DESIRE — step 2a's semantics — and count it, so an inexact
 * stamp is a reported number rather than a silent one.
 */
let inexactStamps = 0;
const conceptByPair = new Map<string, number>();
const conceptByDesire = new Map<string, number>();
for (const c of concepts) {
  const k = `${c.desire}|${c.awareness}`;
  if (!conceptByPair.has(k)) conceptByPair.set(k, c.id);
  if (!conceptByDesire.has(c.desire)) conceptByDesire.set(c.desire, c.id);
}
const conceptIdForPair = (desire: unknown, awareness: unknown): number | null => {
  const d = String(desire ?? "").trim();
  const exact = conceptByPair.get(`${d}|${String(awareness ?? "")}`);
  if (exact != null) return exact;
  const byDesire = conceptByDesire.get(d);
  if (byDesire != null) { inexactStamps++; return byDesire; }
  return null;
};

const fallbackDesire = [resolvedPressingProblem, resolvedDesiredOutcome]
  .filter(Boolean).join(" ⁝ ") || null;
console.log(`[adCopyGenerator] concept plan: ${concepts.length} concepts ` +
  `(${conceptDesires.length} distinct desires), stage mix ` +
  `${AWARENESS_STAGES.map((s) => `${s}:${concepts.filter((c) => c.awareness === s).length}`).join(" ")}` +
  `${concepts.length ? "" : " — falling back to the cold plan and the deck-constant desire"}`);
```

Imports needed at the top of the function's import block: `ne` from `drizzle-orm`;
`isAwarenessStage`, `AWARENESS_STAGES`, `type AwarenessStage` from `./_core/conceptAxis` (that module
is already dynamically imported at `:514`).

### 3.2 One helper, used by all four surfaces

```ts
/**
 * Plan `n` slots from the concept set. Falls back to the cold-weighted plan when there
 * are no concepts, so the pre-concept behaviour is preserved exactly.
 */
const planSlots = (n: number): Array<{ stage: AwarenessStage; desire: string | null; conceptId: number | null }> => {
  if (!concepts.length) {
    return awarenessPlanForCount(n).map((stage) => ({ stage, desire: fallbackDesire, conceptId: null }));
  }
  return dealAcrossSlots(concepts, n).map((c) => ({
    stage: c.awareness, desire: c.desire, conceptId: c.id,
  }));
};
```

### 3.3 The four surfaces

```ts
// headlines (:571-601)
const headlinePlan = planSlots(count);
const headlineSlots = headlinePlan.map((p, i) => ({
  stage: p.stage, angle: angleSlotsByIndex[i], desire: p.desire, conceptId: p.conceptId,
}));

// bodies (:732, :748) — the angle still derives FROM the stage, so angleForStage now
// walks the concept-derived stages. slotCount is unchanged.
const stagePlan = planSlots(slotCount);
const slots: Array<{ angle; stage; desire; conceptId }> = [];
for (const p of stagePlan) {
  const mapped = angleForStage(p.stage, availableAngles, usedAngles);
  const angle = mapped ?? availableAngles.find((a) => !usedAngles.has(a));
  if (!angle) break;
  usedAngles.add(angle);
  slots.push({ angle, stage: p.stage, desire: p.desire, conceptId: p.conceptId });
}
// `bodyDesirePlan` is deleted — the desire now travels on the slot.

// links (:908-909)  const linkPlan = planSlots(count);
// hooks (:1010-1011) const hookPlan = planSlots(count);
```

The four prompt blocks read `p.stage` / `p.desire` off the slot instead of two parallel arrays. No
prompt wording changes.

### 3.4 The four insert stamps (`:1135`, `:1184`, `:1232`, `:1282`)

```ts
desire:    headlineSlots[headlineIdx]?.desire ?? pdafDesire,
awareness: headlineSlots[headlineIdx]?.stage ?? null,
conceptId: headlineSlots[headlineIdx]?.conceptId ?? null,   // carried, not looked up by string
```

and the same shape for body / link / hook. **The string lookup disappears from the insert path** —
the id travels with the slot, so the step-2a ambiguity ("where two concepts share a desire the stamp
points at the first") no longer applies to freshly generated rows. It survives only in the gate's
repair path, where it is now counted (`inexactStamps`).

### 3.5 The gate pool — this one is not optional (`:1492-1499`)

```ts
const pools = {
  desires: conceptDesires.length ? conceptDesires : (fallbackDesire ? [fallbackDesire] : []),
  // ⚠️ THE PLAN THE GATE REPAIRS TOWARD MUST BE THE PLAN THE DECK WAS BUILT FROM.
  // suggestAwarenessFromSlack moves a row to the stage most under-represented against
  // this array, and never introduces a stage the array does not contain. Left as
  // awarenessPlanForCount(populationSize) it would pull rows back toward the synthetic
  // cold plan and could stamp a stage NO CONCEPT HOLDS — reintroducing exactly the
  // label-without-a-concept state this step removes.
  awarenessPlan: concepts.length
    ? [...headlinePlan, ...stagePlan, ...hookPlan].map((p) => p.stage)
    : awarenessPlanForCount(populationSize),
  formats: /* unchanged */,
};
```

(Links are excluded from the population, so `linkPlan` is excluded here too.)

### 3.6 The gate's re-stamp (`:1591-1601`)

```ts
for (const { dimension, value } of moves) {
  next[dimension] = value;
  (nextLabels as any)[dimension] = value;
  if (dimension === "format" && isBody) next.bodyAngle = value;
}
// ⚠️ RE-DERIVED AFTER ALL MOVES, NOT PER MOVE. A desire move and an awareness move can
// arrive together; stamping inside the loop would resolve against a half-applied pair.
if (moves.some((m) => m.dimension === "desire" || m.dimension === "awareness")) {
  next.conceptId = conceptIdForPair(next.desire, next.awareness);
}
```

and after the gate returns, one line in the summary log:

```ts
if (inexactStamps) console.warn(`[adCopyGenerator] ${inexactStamps} rows stamped by desire only — ` +
  `the gate moved them to a (desire, awareness) pair no concept holds.`);
```

### 3.7 Unit coverage to add (`server/conceptPlan.test.ts`, new)

- `planSlots` with an empty concept set returns exactly `awarenessPlanForCount(n)` and the fallback
  desire (the no-regression proof).
- `planSlots` with a set returns each slot's stage equal to its concept's stage, and `conceptId`
  equal to that concept's id, for n < , = and > the set size.
- Two concepts sharing a desire and differing in awareness both appear in a plan of size ≥ set size
  (the dedupe-removal proof).
- `conceptIdForPair` prefers the exact pair and falls back to the desire's concept, incrementing the
  inexact counter only on the fallback.

---

## 4. Expected deck numbers

### 4.1 Deck TOTALS are expected to hold at 12 / 12 / 4

Read off the code, not assumed: headlines and bodies are each trimmed to the budget band ceiling of
**12**, and `image_hook` to `IMAGE_HOOK_BAND_MAX` = `AD_VARIATIONS.length` = **4**. Generation issues
15 headlines, 16–18 bodies and 15 hooks, so the totals are decided by the band, not by the stage mix.

**The honest risk is on the downside:** if the new mix causes more collapse than the gate can repair,
a surface can finish below its band and the deck ships short. That is one of the things the live run
is for. A total above 12 is impossible.

### 4.2 The stage MIX inside the deck does move — and how much depends entirely on the concept set

Measured by read-only query on production 2026-08-10: there is exactly **one** concept set in the
database, on ICP 264, and it holds **6 concepts, not 8** — ids 49–54, stages in row order
`[unaware, solution_aware, unaware, problem_aware, unaware, problem_aware]`; mix **unaware 3 ·
problem_aware 2 · solution_aware 1 · product_aware 0**. **Zero duplicate desires** across the set.

| slots | surface | TODAY (cold plan) | AFTER, with a full 8-concept set | AFTER, with today's live 6-concept set |
|---|---|---|---|---|
| 15 | headlines | u6 · p5 · s2 · **pr2** | u6 · p5 · s2 · **pr2** | u8 · p4 · s3 · **pr0** |
| 16 | bodies (no proof) | u6 · p6 · s2 · **pr2** | u6 · p6 · s2 · **pr2** | u8 · p5 · s3 · **pr0** |
| 18 | bodies (with proof) | u7 · p7 · s2 · **pr2** | u7 · p7 · s2 · **pr2** | u9 · p6 · s3 · **pr0** |
| 15 | hooks / links | u6 · p5 · s2 · **pr2** | u6 · p5 · s2 · **pr2** | u8 · p4 · s3 · **pr0** |

**Two findings fall out of that table, and they are the substance of this proposal.**

**Finding 1 — with a FULL set the mix does not move at all.** An 8-concept set is itself apportioned
by `awarenessPlanForCount(8)` and trimmed stage-balanced, so it carries the cold mix 3/3/1/1/0
exactly; cycling it across any number of slots reproduces the same proportions the cold plan
produces. The change is therefore not "a different weighting" — it is **the same weighting, now
carried by real concepts instead of a parallel synthetic plan**.

**Finding 2 — with a SHORT set the concept set's shortfall propagates into every deck.** Today's live
set lost its `product_aware` concept to the concept gate, and after step 2b that loss reaches the ad
copy: **product_aware goes to zero on every surface.** The prospecting research calls that warmer
tail *"a vital safeguard against Entity-ID pigeonholing"* — losing it entirely is a real cost, and
today it is invisible because the ad deck manufactures its own stages regardless of what the concepts
did.

That is the argument for fixing it **upstream, by biasing concept generation**, exactly as the brief
directs — not by keeping the separate allocation downstream.

### 4.3 Removing the dedupe changes nothing on today's data

Measured, not assumed: **0 of the sets on production contain a duplicate desire.** The dedupe is
inert against live data. Removing it is correct-by-design (a shared desire with different stages is
two real slots) rather than a behaviour change we have to prove — which also means **the live run
cannot exercise it**. Its proof is the unit test in §3.7, and that is stated plainly rather than
claimed as a live result.

---

## 5. THE DECISION FOR ARFEEN — the cold-traffic mix

The brief says to preserve the cold-traffic weighting by biasing concept generation rather than
dropping it, and that the mix itself is Arfeen's call. Two separate questions:

**Q1. When the concept gate leaves a stage empty, should concept generation top it up?**
Today: 12 concepts are asked for, survivors are trimmed to 8 stage-balanced, and if a stage has no
survivor it simply ends up absent — as `product_aware` is on the live set. After step 2b that hole
is inherited by every ad. Options:

- **(A) Top-up pass — recommended.** After the trim, if a stage the plan asked for has zero
  survivors, run one extra targeted generation for that stage only. Preserves 3/3/1/1/0 as an
  intent rather than an aspiration, costs one short extra call, and never pads (if the top-up also
  fails the gate, the set still ships short and says so).
- **(B) Accept the set as generated.** Cheapest, no new code. The mix then floats with whatever the
  gate happens to pass, run to run.

**Q2. Is 3 unaware / 3 problem-aware / 1 solution-aware / 1 product-aware / 0 most-aware still the
target mix?** It is currently derived from two prospecting reports that agree with each other; a
third report disagrees about excluding most-aware and that conflict is recorded, not resolved. Step
2b does not change this constant either way — it only decides whether the ad deck *inherits* it or
*re-manufactures* it. Flagging it because after 2b the constant has exactly one place of effect
instead of two, which is the moment to confirm it is the number wanted.

**Nothing in §3 depends on the answer to Q2.** Q1 does change scope: option (A) adds a change to
`conceptGenerator.ts` that would travel in the same commit.

---

## 6. Node 6

**Recommendation: do not change Node 6 in step 2b.** `headlinesGenerator` has the same
two-independent-plans shape, but the `headlines` table has **no `conceptId` column** (migration 0101
was `adCopy` only). Making its awareness concept-derived without a stamp column would recreate
exactly the unstamped-label state step 2a removed. If symmetry is wanted it is a step 2c with its own
additive migration 0102.

Node 6 is still **live re-proved as a non-regression** in this sprint, as the brief asks — it must
still produce its full deck through the hardened path, and it is where the open `story`-formula
shape defect shows itself.

---

## 7. Risks, stated before the run

1. **Collapse could rise and a surface could finish under its band.** With `product_aware` absent,
   more rows share a stage, so more pairs depend on desire or format to clear 2-of-4. Hooks are the
   exposed surface: with persona pinned and format fixed, a hook has only two movable axes, so a hook
   pair sharing desire and awareness is unrecoverable by construction. Measured, not guessed, by the
   run.
2. **Body angles shift.** The body angle is chosen from the stage, so a changed stage sequence
   changes which angles are issued. Expected, not a defect — but it means the body deck is not
   comparable angle-for-angle against the 2a run.
3. **The gate can still move a row off its concept.** An awareness move with no matching concept
   leaves the row stamped by desire only. Now counted and logged (§3.6) instead of silent, and it is
   a number the run must report.
4. **Order dependence.** The deck's mix now depends on concept row order, hence the explicit
   `ORDER BY id`.

---

## 8. Proof plan (live, one labelled throwaway, id-scoped teardown)

Baselines to reconcile to: adCopy **5424** · headlines **2174** · adCreatives **405** ·
meta_published_ads **2** · protected services **29**. Teardown is id-scoped, never user-scoped, and
clears Cloudinary before the rows are deleted.

1. One throwaway service + ICP on smoke user 117174; generate a concept set and record its size and
   stage mix **before** any copy runs — the run's expected numbers are derived from that set, not
   from the table in §4.2.
2. **Node 7** — full cascade. Report: issued vs kept per surface, the kept stage mix, collapse before
   and after, evictions, `inexactStamps`, and whether every kept row's `(desire, awareness)` matches
   its stamped concept's own `(desire, awareness)`. That last check is the point of the step: a stamp
   that resolves is not the same as a stamp that is TRUE.
3. **Node 6** — a headline run on the same service, as a non-regression: full deck through the
   hardened path, and whether the `story` formula returns the wrong shape a third time.
4. Teardown, then reconcile all five baselines and report the figures.

## 9. Gates before any commit

- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → must be **34**.
- The canonical 13-suite command in CHECKPOINT §8 → **552**, quoted from its own output, plus the new
  `server/conceptPlan.test.ts` and `server/conceptAxis.test.ts`.
- Commit held for Arfeen's word; push held separately for an explicit "push".
