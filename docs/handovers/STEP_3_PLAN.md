# STEP 3 — PROPOSAL ONLY. Nothing built, no migration applied, nothing committed.

Written 2026-08-10 against HEAD `8502f36` (`railway-build`, 16 ahead of `origin/railway-build`
`51eda78`, nothing deployed). Everything below is read off the code or measured by a read-only
query against production, and labelled with which.

---

## 1. How the image path works today — the orientation, in plain English

### 1.1 Where creatives are stored, and what a creative knows about itself

`adCreatives` (`drizzle/schema.ts:1166`). A row records its **inputs** (niche, product, audience,
benefit, pressing problem), its **style choices** (`designStyle`, `headlineFormula`, `styleType`),
its **outputs** (the baked `headline`, three Cloudinary URLs, `imageFormat`), and batch bookkeeping.

**Verified by direct query against production, not from the schema file:**

| checked | result |
|---|---|
| axis columns on `adCreatives` (`conceptId`/`awareness`/`desire`/`persona`/`format`) | **none — only `headlineAdCopyId` exists** |
| rows | **405** |
| rows with `headlineAdCopyId` set | **0** |
| existing foreign keys on the table | 3 (userId, serviceId, campaignId) |

So: **a creative carries no link to a concept, and no awareness or desire of its own.** This is not
the pre-2b ad-copy situation, where the columns existed and were filled from a separate allocation.
On the image side the axes are not persisted **at all** — they exist only as in-memory arrays for
the length of one generation call and are then discarded.

The one provenance link that does exist is `headlineAdCopyId` — added by publish-path step 1,
recording which gated `adCopy` row supplied the headline baked onto the picture. It is **0/405 on
production** because step 1 is committed but not deployed. Note it carries **no foreign key**, so it
is a soft reference that can dangle if the adCopy row is later deleted.

### 1.2 Does the image have awareness? Yes — but its own, and never written down

`adCreativesGenerator.ts:563` calls **`awarenessDeckPlan(4)`**, not `awarenessPlanForCount`. That is
a deliberately *different* function, and the reason matters for what step 3 should do:

> a 4-slot deck apportioned from the cold mix 3/3/1/1 yields `[unaware, problem, unaware, problem]`
> — only two distinct stages with two repeats — and a repeated (awareness × sub-type) cell is a
> repeated Entity ID. So a deck smaller than the stage count spans as many DISTINCT stages as it has
> slots, coldest first: `[unaware, problem_aware, solution_aware, product_aware]`.

Two further plans are **derived from that one**: `subTypePlanFor(deckAwarenessPlan)` (Layer 2
styling) and `visibilityTierPlanFor(deckAwarenessPlan, deckSubTypePlan)` (which slot cedes its face
so a repeated sub-type does not collapse to one Entity ID). So the image awareness plan is not a
label — it is the root of a three-plan chain that drives what is actually rendered.

**And there is no desire axis on the image side at all.** Not planned, not stored, not written into
the prompt. The picture's subject comes from `resolveSubjectForService`, its scene from the
awareness stage, and its styling from the sub-type.

### 1.3 The image already carries concept-descended TEXT — from two different rows

This is the part that decides the design, and it is not written down anywhere else.

Each composited picture carries **two** pieces of text, drawn from **two independently chosen**
`adCopy` rows:

1. **The baked headline** — `resolveGatedPublishCopy` returns gated headline candidates, and the
   generator deals them across the deck (`usable[i % usable.length]`, `adCreativesGenerator.ts:601`).
   The chosen row's id **is** recorded, as `headlineAdCopyId`.
2. **The on-picture hook/body line** — `resolveAdBodyTexts` (`_core/compositeHeadline.ts:265`) takes
   the most recent `image_hook` rows for the service (`ORDER BY id DESC LIMIT 4`) and the generator
   uses `bodyTexts[i % bodyTexts.length]`. It selects **`content` only** — the row's **identity is
   discarded**.

After step 2b **both** of those adCopy rows carry a `conceptId`. So the image is already
concept-descended in its text; what is missing is that nobody writes down which concept.

⚠️ **The two are dealt independently, so slot `i`'s headline and slot `i`'s hook can descend from
different concepts.** That is a real coherence question for step 4, and it is measurable rather than
theoretical — see §5.

---

## 2. The migration — `0102`, additive and inert

```sql
ALTER TABLE `adCreatives` ADD COLUMN `conceptId` INT NULL;
ALTER TABLE `adCreatives`
  ADD CONSTRAINT `adCreatives_conceptId_campaignConcepts_id_fk`
  FOREIGN KEY (`conceptId`) REFERENCES `campaignConcepts`(`id`) ON DELETE SET NULL;
CREATE INDEX `idx_adCreatives_conceptId` ON `adCreatives` (`conceptId`);
```

- **Nullable, no default, no backfill.** All 405 existing rows keep `conceptId = NULL`, which is
  truthful: they were generated before concepts existed on this path.
- **`ON DELETE SET NULL`**, matching `adCopy.conceptId` from 0101. A deleted concept must not take a
  rendered, uploaded image row with it — the picture still exists in Cloudinary.
- **Naming follows the table's own convention** (`adCreatives_<col>_<reftable>_<refcol>_fk`), the
  same convention 0101 followed for adCopy.
- Genuinely inert until code writes it, exactly as 0101 was.

⚠️ **Teardown-order consequence, and it is the reverse of the copy case.** `adCopy` rows must be
deleted **before** concepts or the FK blanks their stamps first. The same now applies to
`adCreatives` — but adCreatives teardown must ALSO clear Cloudinary first, so the order becomes:
read the three Cloudinary ids → delete the objects → delete the adCreatives rows → delete the
concepts. `server/lib/adCreativeTeardown.ts` already does the first three; only the ordering against
concepts is new, and it is a documentation change, not a code one.

---

## 3. Where the stamp comes from — keyed on id, never on text

**The id is already in hand at the moment of insert.** `resolveGatedPublishCopy` selects the adCopy
rows it returns, and the generator already keeps `gatedForSlot.adCopyId`. The only change needed is
to carry `conceptId` alongside it:

- add `conceptId: adCopy.conceptId` to the resolver's `select` (`_core/publishCopySource.ts:135`),
- carry it into the per-slot array beside `text` and `adCopyId`,
- write it at the insert: `conceptId: gatedForSlot?.conceptId ?? null`.

That is an integer travelling from the adCopy row to the creative row. **No desire string, no
awareness label, and no text comparison anywhere in the path** — the same rule step 2b established
for copy, and the same rule that made step 2a's stamp exact.

`NULL` where the legacy template path produced the headline, exactly as `headlineAdCopyId` is —
which is itself the signal that the row is ungated.

### Which insert sites stamp

There are four sites that write an `adCreatives` row:

| site | what it is | proposal |
|---|---|---|
| `adCreativesGenerator.ts:704` | the tabloid cascade — the only path with gated headlines | **stamp** |
| `adCreativesGenerator.ts:817` | `runEditorialAdCreativesGeneration` — legacy, no gated headline | writes NULL (truthful) |
| `routers/adCreatives.ts:1621` | `generateAsync` background insert | writes NULL (truthful) |
| `routers/adCreatives.ts:1796` | the sync generate procedure | writes NULL (truthful) |

The last three are three of the five fan-out sites in the open wiring gap (CHECKPOINT §5.1). Wiring
them is the same decision as the 4→8 cardinality question, which is Arfeen's and is deliberately not
part of step 3. Leaving them NULL is not an oversight — a row those paths produce genuinely did not
descend from a concept today, and stamping one would be a lie.

---

## 4. THE RECOMMENDATION — plumbing only, and the fork stated rather than settled

**Recommendation: step 3 stays pure plumbing. Stamp the concept, leave the image deck untouched.**

The reasons are specific to the image side and do not carry over from 2b:

1. **The image's awareness plan is not a label — it is the root of a three-plan chain.** Sub-type and
   visibility tier are both derived from it. Changing where awareness comes from changes what is
   rendered, in three coupled ways, in the same step that is supposed to be plumbing.
2. **At 4 slots, concept-sourced awareness would break the guarantee `awarenessDeckPlan` exists to
   provide.** Taking the first four concepts of a healthy 8-set happens to give `[unaware,
   problem_aware, solution_aware, product_aware]` — the same answer. But that is a coincidence of
   ordering, not a property. **On the concept sets we have actually measured live it breaks:** the
   7-concept set from the top-up run was `unaware 3 · problem 3 · solution 1 · product 0`, whose
   first four are `[unaware, problem, solution, unaware]` — a repeated stage, therefore a repeated
   (stage × sub-type) cell, therefore the exact Entity-ID collapse the function was written to
   prevent. Short and lopsided sets are the normal case, not the edge case: **both** live sets we
   have measured were short.
3. **It would pre-empt a decision that is Arfeen's.** Concept-sourced image awareness is natural at
   8 slots (one concept per image) and hostile at 4 (four concepts chosen from eight, on what
   basis?). The 4→8 question is queued and unanswered. Doing the awareness switch first would settle
   it by accident.
4. **Step 4 needs identity, not axis alignment.** Pairing an image to its copy requires knowing
   which concept each came from. The stamp delivers that on its own.

### The genuine fork, surfaced rather than settled: what does the stamp MEAN?

There are two defensible answers, because the picture carries text from two rows (§1.3):

- **(A) The concept whose HEADLINE this picture bakes.** Available today at zero cost, exact, and it
  is the same semantics step 2a established for copy ("which concept supplied this"). It is also the
  surface the publish path actually reads.
- **(B) The concept the picture as a whole descends from** — which would require the headline row
  and the hook row to agree, and today nothing makes them agree.

I propose **(A)**, and propose **measuring the (A)-vs-(B) gap in the same run** rather than deciding
it blind (§5). If headline-concept and hook-concept turn out to agree most of the time, (B) is cheap
later. If they systematically disagree, that is a finding step 4 must handle and is much better
known now than discovered during assembly.

⚠️ **The honest limit of (A), stated plainly:** the stamp records where the picture's *words* came
from, not where its *picture* came from. The rendered scene still follows `awarenessDeckPlan`, so a
creative stamped with a `product_aware` concept may depict a `solution_aware` scene. That is a
stamp that resolves and is *narrowly* true, and it is exactly the kind of gap that 2b's coherence
check was built to expose. It should be recorded in the column's docblock, not glossed.

---

## 5. Live proof plan — a real generated set, no green test

On the labelled throwaway harness, smoke user **117174**, id-scoped teardown.

⚠️ **Unlike every step-2 proof, this one RENDERS.** Each creative writes **three** Cloudinary objects
(source, raw, composited). Teardown must therefore go through `server/lib/adCreativeTeardown.ts` —
read the ids off the rows, delete the Cloudinary objects, then delete the rows — and must run before
the concepts are deleted. Baselines to reconcile to: adCopy **5424** · headlines **2174** ·
adCreatives **405** · meta_published_ads **2** · protected **29**.

1. Throwaway service + ICP; generate concepts; record the set size and stage mix.
2. Run Node 7 (ad copy) so gated headlines and image hooks exist — the image path has nothing to
   descend from otherwise.
3. Run the tabloid cascade for a real 4-creative deck.
4. **Measure and report:**
   - every creative stamped; every `conceptId` resolves to a concept in this ICP's set; **0 dangling,
     0 pointing outside the set**;
   - the stamp equals the `conceptId` of the adCopy row named by `headlineAdCopyId` — checked by
     joining on ids, never by comparing text;
   - **the deck is otherwise undisturbed**: 4 creatives, the same `designStyle` sequence, and the
     Layer 1+2+3 plan line identical to a pre-change run. This is the plumbing-only claim, and it is
     the one that could fail quietly;
   - **the (A)-vs-(B) gap**: for each slot, the headline row's concept vs the hook row's concept.
     Derivable from ids alone — the hook for slot `i` is the `i`-th of the four highest-id
     `image_hook` rows, which is exactly how the generator picks it — so no text matching is needed
     to measure it.
5. Teardown: Cloudinary first, then adCreatives, then adCopy, then concepts; reconcile all five
   baselines and report the figures.

**Nothing is published to Meta.** Step 3 does not touch the publish path.

---

## 6. Collisions with the queued image-sprint items — noted, not folded in

- **4 → 8 cardinality.** `IMAGE_HOOK_BAND_MAX` is already derived from `AD_VARIATIONS.length`, and
  the gated-headline deal cycles, so both follow a change automatically. What does NOT follow is
  `awarenessDeckPlan`: at 8 slots it defers to `awarenessPlanForCount`, which is a different
  distribution from the four-distinct-stages rule. Step 3 touches none of this. **But note the
  order-of-operations: if 4→8 lands first, the case for concept-sourced image awareness gets much
  stronger, because eight slots and eight concepts pair one-to-one.**
- **The image baking a verbatim copy of the body's opening.** Already fixed in the code I read —
  `resolveAdBodyTexts` prefers purpose-built `image_hook` rows and falls back to the truncated body
  only for services generated before migration 0098. Step 3 does not touch it. It is, however, the
  same function step 3 would need to change if the fork above is later resolved toward **(B)**,
  since that is where the hook row's identity is currently discarded.
- **`regenerateSingle` / `makeVertical`** update existing rows rather than inserting. Neither would
  clear or rewrite `conceptId`, so a regenerated picture keeps the stamp of the copy it was built
  for. That is correct while regeneration re-renders the same slot — worth an explicit assertion in
  the proof if either is exercised, and neither is in step 3's scope.

---

## 7. What step 3 does NOT do

No change to `awarenessDeckPlan`, `subTypePlanFor` or `visibilityTierPlanFor`. No new axis columns
on `adCreatives`. No change to the publish path. No wiring of the five fan-out sites. No cardinality
change. No backfill of the 405 existing rows.

**Gates before any commit:** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **34**; the canonical
suite command in CHECKPOINT §8 plus `server/conceptPlan.test.ts`; migration applied only on an
explicit "execute"; commit and push each held for their own explicit word.
