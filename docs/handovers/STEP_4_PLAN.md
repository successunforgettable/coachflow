# STEP 4 — AD ASSEMBLY. 4a + 4b BUILT (uncommitted). 4c HELD.

Written 2026-08-10 against HEAD `1c70563` (18 ahead of `origin/railway-build` = `51eda78`; nothing
in this chapter is deployed). Traced in code and against the applied schema, not recalled.

---

## 0. BUILD STATUS — as at 2026-08-10, nothing committed and nothing applied

| | state |
|---|---|
| step-1 unit coverage (the open gap) | ✅ built — 40 tests, no behaviour change |
| **4a** hook identity + migration **0103** | ✅ built · ✅ **0103 APPLIED 2026-08-10** |
| **4b** assembly resolver + read-only preview | ✅ built · ✅ **PROVEN LIVE 2026-08-10** (see §0b) |
| **4c** multi-ad publish capability | ⚠️ function written with Graph calls INJECTED, **never invoked, no Meta call made** |
| the coach-facing UI (4d) | not started, deliberately |

**Gates measured on this working tree:** `tsc --noEmit` → **34** (baseline held, zero new) ·
canonical §8 13-suite command → **556 passed** (measured identical with and without these edits —
§8's recorded 552 is stale by 4, from the step-2b and step-3 commits) · the six new suites →
**92 passed**. Nothing has been committed, pushed, applied or run against production.

**What must happen next, and only on Arfeen's explicit word:** apply 0103, then run the 4b live
assembly proof on smoke user 117174. Neither has been done.

---

## 0b. ✅ 4b PROVEN LIVE — 2026-08-10, smoke user 117174, ZERO META CALLS

`server/scripts/step4b-assembly-proof.ts` · throwaway service **311** / ICP **285** / adSet
`CUy_qs5rWNsgwoDweEtqf` · concepts **8** generated, Node 7 returned **headlines 12 · bodies 12 ·
hooks 4**, four real renders in 69.7s.
Composites saved BEFORE teardown: `docs/screenshots/run-2026-08-10-step4b-assembly/`.

**Migration 0103 applied** — `hookAdCopyId int / YES / NULL default`, **0 foreign keys** as
designed, 405 rows unchanged, 0 stamped (no backfill). Row counts identical either side.

### The three results

**1. The A-vs-B gap is INVERTED.** Step 3 measured **3 of 4 DISAGREEING**; this run measured
**3 agree · 1 disagree · 0 blank**, established by id and never by comparing text.

**2. Zero stamp disagreements.** Every picture's `conceptId` equals the concept of the `adCopy`
row named by its `headlineAdCopyId` (487→178, 488→175, 489→177, 490→179).

**3. Coherence yield — 4 concepts in the deck, 4 complete coherent ads, 0 dropped.**
Every ad has its own headline, its own body and its own picture; every ad's headline and body
share one awareness stage. Bodies consumed 4 of 12 gated. Hook agreement across the assembled
set: match 3 · mismatch 1 · unknown 0. **No drops at all**, so no reason list was needed.

| ad | concept | stage | headline | body | picture | hook |
|---|---|---|---|---|---|---|
| 1 | 175 | unaware | 6060 | 6072 | 488 | 6084 match |
| 2 | 177 | solution_aware | 6061 | 6074 | 489 | 6086 match |
| 3 | 178 | product_aware | 6062 | 6075 | 487 | 6087 match |
| 4 | 179 | unaware | 6063 | 6076 | 490 | 6085 **mismatch** |

### 🔑 WHY THE ONE MISMATCH HAPPENED — a real finding, not noise

The four kept hooks carried concepts **175, 176, 177, 178**. The four dealt headlines carried
**175, 177, 178, 179**. **Concept 179 had no hook of its own**, so slot 4 took the fallback (rule
2) and got the only unused row, 6085 — concept 176.

**Root cause: distinctness is judged WITHIN each surface, so each surface keeps its own survivors
and their concept coverage need not line up.** This is not a defect in the deal; the deal did
exactly what it is specified to do. It means **hook-to-headline agreement is capped by how much
the two surfaces' surviving concept sets overlap**, and that cap tightens as the deck grows.
⚠️ **Feed this into the 4 → 8 decision** — it is a second, independent reason the hook surface is
the binding constraint, alongside the known "natural distinct capacity is exactly 4".

📌 **No blank hook band on this run** — 4 hooks for 4 slots, so the ship-short branch never fired
and the file names carry no `-BLANK-HOOK-BAND` flag. The branch remains unexercised live.
The slot-4 composite was inspected: the band renders `"I kept refining what I should have sent"` —
the text of hook row 6085, confirming at the pixel level that **the row recorded is the row
baked**. ⚠️ Visual QUALITY is Arfeen's judgement on those four files; nothing here self-certifies it.

### Teardown — clean, and verified by direct query rather than by the script's self-report

Order held: Cloudinary → creatives → copy → concepts. Sweep resolved **12 public_ids across 4 rows
→ 12 objects deleted, 0 failures** (exactly 3 per creative). Reconciled EXACTLY:
**adCopy 5424 · headlines 2174 · adCreatives 405 · campaignConcepts 6 · meta_published_ads 2 ·
running jobs 0**, protected `272:5 273:5 275:5 276:5 277:5 285:4` = **29**, untouched.
Service 311 and ICP 285 both gone. **Nothing was committed.**

🔒 **No Meta call was made anywhere in the run** — the harness imports no Meta module, and
`publishAssembledAds` has still never been invoked.

### Files this pass added or touched

New: `server/_core/adAssembly.ts` · `server/_core/multiAdPublish.ts` ·
`drizzle/0103_adcreatives_hook_ad_copy_id.sql` · six test suites.
Modified: `drizzle/schema.ts` (the `hookAdCopyId` column) ·
`server/_core/compositeHeadline.ts` (`resolveAdOnImageTextRows`, `dealHooksByConcept`;
`resolveAdBodyTexts` is now a thin wrapper with its behaviour unchanged) ·
`server/adCreativesGenerator.ts` (concept-keyed hook pick, stamp) ·
`server/routers/meta.ts` (`previewAssembledAds`, `publishAssembledAds` — neither is called by any
client code). **`publishToMeta` was deliberately NOT touched.**

**What step 4 is for, in one line:** today a push makes ONE ad, whose headline, body, picture and
on-picture hook were each chosen independently — so the distinct pool the copy engine built is not
what ships. Step 4 makes the unit of shipping a CONCEPT: one concept → one ad, every surface
descending from it, and N of them landing in ONE Meta campaign and ONE ad set so they actually
compete in one auction.

---

## 1. What is true today — the orientation

### 1.1 The pieces already exist and already carry identity

| surface | where it comes from today | carries concept? |
|---|---|---|
| Meta headline field | `selectedCreative.headline` (`PushKitModal.tsx:286`) — since step 1 the creative row BAKES a gated headline, so field and picture agree by construction | ✅ via `adCreatives.conceptId` (0102) + `headlineAdCopyId` (0100) |
| Meta primary text | `gatedBody.text` — `resolveGatedPublishCopy`'s strongest body (`PushKitModal.tsx:213`) | ✅ `adCopy.conceptId` (0101), but chosen INDEPENDENTLY of the headline |
| the line baked on the picture | `resolveAdBodyTexts` → `image_hook` rows, dealt `bodyTexts[i % bodyTexts.length]` (`adCreativesGenerator.ts:688`) | 🔴 **NO — the function returns `string[]` and throws the ids away** |
| the scene in the picture | `awarenessDeckPlan` | 🔴 no, and out of scope here |

So three of the four surfaces are already concept-identified. **Assembly is a selection problem, not
a generation problem** — nothing new gets generated in step 4.

### 1.2 The publish surface is the real work

`handlePush` → `fireMeta()` → `publishToMeta` once, and that mutation builds a COMPLETE hierarchy
every call: `createCampaign` → `createAdSet` → `createAdCreative` → `createAd`
(`routers/meta.ts:371-433`). **Four ads today = four campaigns and four ad sets.** No path anywhere
adds an ad to an existing ad set. Distinct copy in four unrelated campaigns is not distinctness —
Meta only compares variants INSIDE one ad set. This is a server capability, not a UI change.

---

## 2. THE RECOMMENDATION

### 2.1 The unit — an assembled ad

A new pure resolver, `server/_core/adAssembly.ts`, sitting on top of the step-1 resolver (which
already returns full candidate lists WITH `conceptId`) plus one query of the creative batch:

```
assembleConceptAds(db, userId, serviceId, { adSetId?, batchId? })
  → { ads: AssembledAd[], ledger: AssemblyLedger }

AssembledAd = { conceptId, awareness, headline: GatedPiece, body: GatedPiece,
                creative: { id, imageUrl, verticalImageUrl, hookAdCopyId }, }
```

Nothing about it touches Meta. It is read-only and independently provable, which is why it is its
own step.

### 2.2 The five assembly rules

1. **Pair by stamped id, never by label text.** The image is paired to the headline by
   `adCreatives.headlineAdCopyId` — an exact row identity, stronger than matching concepts — and its
   `conceptId` is then ASSERTED to agree. A disagreement is a defect in step 3's stamp and is
   reported loudly, never worked around.
2. **One body per ad, and a body is consumed.** Bodies are assigned per concept strongest-first and
   each row is used at most once. **A concept with no unconsumed body ships no ad.** Never pad,
   never reuse — the same rule the gate applies to the deck, applied to assembly.
3. **One picture per ad, and a picture is consumed too.** Two ads sharing one image re-collapse into
   one Entity ID, which is exactly what the image chapter was spent removing (§12.4).
4. **NULL `conceptId` means "not concept-keyed" — skip, never default.** The candidate set is
   `conceptId IS NOT NULL AND headlineAdCopyId IS NOT NULL`. See §3.3.
5. **Ship fewer, and SAY SO.** The ledger reports concepts in, ads out, and a named reason per
   concept that produced none. A push of 2 ads from 8 concepts is a correct result that must be
   legible, not a silent shortfall.

### 2.3 The publish capability — N ads, ONE campaign, ONE ad set

A NEW mutation `meta.publishAssembledAds`. `publishToMeta` is left exactly as it is — it is the
proven single-ad path and the fallback for editorial/ungated creatives.

Order of operations, chosen to avoid the orphan-campaign class already visible on the account (five
"Auto Campaign Kit" campaigns against two `meta_published_ads` rows):

1. Resolve tokens and run the existing compliance gate (`checkOutput` + `checkAdToPageMatch`) on
   **every** assembled ad FIRST.
2. Drop blocked ads with their named classes. **If zero survive, refuse before `createCampaign`** —
   no shell campaign is ever created.
3. `createCampaign` ONCE → `createAdSet` ONCE.
4. Loop the survivors: `createAdCreative` + `createAd` per ad, into that one ad set.
5. One `meta_published_ads` row per ad, each with its own `headlineAdCopyId` / `bodyAdCopyId` /
   `copyAdSetId`, sharing one `metaCampaignId` and `metaAdSetId`.
6. A Graph failure mid-loop keeps the campaign and ad set (they hold the ads that DID land),
   records what succeeded, and reports the failure per ad.

📌 **No new column for the ad's concept.** It is derivable by joining `headlineAdCopyId` →
`adCopy.conceptId`. Derivable means it does not earn a migration.

📌 **Side effect worth naming:** one ad set means the AED daily-budget floor is hit ONCE for the
whole push instead of N times. It does not fix the currency-unaware `min(1)` defect (parked).

---

## 3. THE THREE FINDINGS THIS IS DESIGNED AROUND (CHECKPOINT §0a)

### 3.1 The image A-vs-B gap — fix it at the source, and do not overclaim the fix

3 of 4 pictures carried an on-image hook from a different concept than the headline they baked. The
cause is mechanical: `resolveAdBodyTexts` (`_core/compositeHeadline.ts:249`) selects hook rows and
returns `string[]`, discarding the ids it just read; the generator then deals them by
`i % bodyTexts.length`. Two independent deals over the same 4 slots agree only by coincidence.

**Recommended fix, in two parts:**

- **Give the hook an identity.** Add `resolveAdHookRows(...) → { id, text, conceptId }[]`, and keep
  `resolveAdBodyTexts` as a thin wrapper over it so the three other call sites
  (`routers/adCreatives.ts:1555`, `:1738`, `compositeHeadline.ts:313`) keep their exact behaviour.
- **Pick the hook for slot *i* by concept**, matching the slot's gated headline's `conceptId`, and
  record it on the row as `adCreatives.hookAdCopyId` (**migration 0103**, additive nullable,
  travelling alone). This one is NOT derivable — the hook is pixels once baked — so it earns its
  column, and it is what makes A-vs-B agreement provable by id afterwards instead of by comparing
  text.

⚠️ **What this does and does not claim.** It makes the picture whole-concept-coherent on its WORDS
(headline + hook). **The SCENE still comes from `awarenessDeckPlan` and is untouched** — that is the
image sprint's step 3 / the 4→8 work. Saying otherwise would repeat exactly the overclaim §0a exists
to correct.

#### 🔑 WHAT HAPPENS WHEN A CONCEPT HAS NO MATCHING HOOK — stated plainly, as built

This is asked twice, in two different places, and the answers are deliberately different. Nothing
here is implicit.

**AT RENDER TIME** (`dealHooksByConcept`, when the picture is being composited). Three rules, in
order:

1. **Concept match** — the slot takes an unused hook row whose `conceptId` equals its headline's.
2. **FALL BACK to any unused hook row** when its own concept has none free. The picture still gets
   a line; the mismatch is recorded on the row rather than hidden, so it is measurable afterwards.
3. **SHIP SHORT — no line at all — rather than repeat one.** When the rows run out, the slot bakes
   NO hook. It never reuses a row already baked in that deck. Node 7 returned 3 hooks for 4 slots
   on 2026-08-10 and the old modulo deal put adCopy 6044 on slots 1 AND 4 — duplicate text on the
   exact surface Meta's OCR reads. An empty band is a visible symptom of a short hook deck; a
   repeated line is an invisible collapse, so the visible one is preferred.
   ⚠️ **Consequence to judge on the 4b proof pixels:** a short hook deck now shows up as a picture
   with no line on it. That is the intended signal. If it reads as broken, the fix is to grow the
   hook band — never to reuse.

**AT ASSEMBLY TIME** (`assembleConceptAds`, choosing which ads to ship). The hook is already baked,
so assembly records rather than decides — with one exception:

- A **mismatched but unique** hook does **NOT** drop the ad. It ships, and the ledger records
  `mismatch`. Discarding a rendered picture over a surface that can no longer be re-chosen would
  ship fewer ads for no gain.
- **No hook identity** on the row → recorded as `unknown` and the ad ships. ⚠️ `unknown` honestly
  collapses three cases the database cannot tell apart after the fact: no line was drawn, the row
  predates 0103, or the legacy fallback supplied the line.
- A **duplicate hook string** across two assembled ads in one push **DROPS the later ad**
  (`duplicate_hook_text`). Duplicate baked text is the real collapse risk and is the one thing
  still fixable at this point — rule 2 applied to the hook surface.
- Where a concept offers more than one eligible picture, assembly **PREFERS the one whose hook
  agrees** before falling back to headline strength.

The real hook recovery rate should be measured on the 4b proof run before the 4 → 8 decision.

### 3.2 The 8 gate-moved rows — judge COHERENCE on the row's own stamp, not on the concept's

The gate moved 8 of 28 kept rows to a different awareness stage to break collisions. A desire move
re-points `conceptId` at the moved concept (`adCopyGenerator.ts:1662`); an **awareness move does
not** — the row keeps its concept and its `awareness` column now differs from that concept's.

**Do not write a rule about "moved rows".** Eligibility does not depend on history, and the row's
current stamp is the truth. The rule that follows from the actual failure this step exists to fix —
step 1's proven ad shipped a `solution_aware` headline with a `problem_aware` body — is:

> **The concept is the grouping key (persona + desire, an identity). Awareness coherence is checked
> ROW TO ROW on the live stamps: an assembled ad's headline and body must carry the same
> `awareness`, and the hook too when it has one.**

A stage-moved row is therefore eligible whenever it still agrees with what it would ship beside, and
ineligible when it does not — with no bookkeeping about how it got there. An ad may ship on a stage
different from its concept's own, which is honest, and the ad's shipped stage is recoverable from
the rows themselves.

📌 **The number that decides whether this rule is too strict must come from a real run, not from
this document.** The ledger reports concepts lost to a stage mismatch. Relax it only against that
measured figure.

### 3.3 Editorial and NULL-stamped creatives

Editorial creatives and the two router insert sites write `conceptId = NULL` by design — three of
the five unwired fan-out sites. Assembly reads NULL as **"not concept-keyed"** and skips them; a
NULL is never a wildcard and never a default concept.

They are not dead: **the existing single-ad `publishToMeta` path stays and remains the way an
editorial creative is published.** And when a batch is entirely NULL the ledger says so — "0 ads
assembled: 5 creatives carry no concept stamp" — rather than failing obscurely.

---

## 4. SEQUENCE — three commits, each with its own proof

Mirrors how steps 1 / 2a / 2b / 3 ran. Each stops for Arfeen.

| | what | proof | state |
|---|---|---|---|
| **4a** | migration **0103** (`adCreatives.hookAdCopyId`), travelling alone | applied only on explicit word | written, **NOT applied** |
| **4b** | hook identity + concept-keyed hook selection + assembly resolver + a read-only `meta.previewAssembledAds` | live throwaway cascade on smoke **117174** — no Meta calls | built + unit-proven, **live proof not run** |
| **4c** | `meta.publishAssembledAds` — N ads, one campaign, one ad set | live PAUSED multi-ad push, read back BY ID | written, **never invoked**, held for its own plan |

**✅ DONE FIRST, before 4a: the open test gap is closed.** Step 1 shipped zero tests.
`publishCopySource` (14), `measureHeadlineFit` (8, against the real font) and the `metaAPI` by-id
fetchers (18) now have coverage, with no behaviour change — new files only. The assembly fixtures
pin what was promised: body never reused · picture never reused · stage-mismatched pair rejected ·
NULL `conceptId` skipped · image paired by `headlineAdCopyId` with the `conceptId` cross-check
firing on a deliberate disagreement.

### The live proof — 4b, and it has NOT been run

**⛔ Blocked on Arfeen's explicit word to apply migration 0103.** Assembly reads `hookAdCopyId`, so
the proof is meaningless until the column exists.

**4b — assembly, on the smoke path.** One labelled throwaway service on user 117174: real ICP,
concepts, Node 7, then the creative cascade carrying the new hook identity, then assemble.
**No Meta call anywhere in the run.** Print the ledger — concepts in, ads out, per-concept reason,
and hook agreement measured BY ID (the A-vs-B number, re-measured against the 3-of-4 baseline).
Save output and proof images to disk BEFORE teardown.

Teardown is id-scoped and ordered: read the Cloudinary ids → delete the objects → delete
`adCreatives` → delete `adCopy` → **then** the concepts (creatives before concepts, or the FK blanks
every stamp first). Reconcile to **adCopy 5424 · headlines 2174 · adCreatives 405 ·
campaignConcepts 6 · meta_published_ads 2 · protected 29**, verified per service
(`272:5 273:5 275:5 276:5 277:5 285:4`), never in aggregate. Commit nothing.

### 4c comes back as its own plan — it is NOT part of this build

The capability is written and unit-proven with the Graph calls injected; **it has never been
invoked and has made no Meta call.** Its live run is a separate authorisation and arrives as its
own plan, which must carry, before anything is pushed:

- **the Meta token and app secret confirmed live first** (token expiry was 2026-10-05 at last read
  — re-read it, do not recall it);
- ⚠️ it must run as **userId 1** — the token is bound to user 1, so the smoke account cannot
  publish — and ⚠️ **that account carries Arfeen's real advertising**;
- **PAUSED at campaign, ad set AND ad, and zero/minimum budget** above the AED 3 floor;
- **a Meta-side teardown** that removes the test campaign, ad set and every ad, confirmed BY ID
  (Meta soft-deletes, so a by-id read beats a list check), leaving no orphans — the account already
  shows five "Auto Campaign Kit" campaigns against two rows, and this must not add a sixth;
- **`meta_published_ads` reconciled back to 2**;
- the assertion that matters: **all ads share one `adset_id`**, read from Meta's stored values
  rather than from our request.

**It waits for an explicit word on the day.**

### Gates at each commit

`npx tsc --noEmit 2>&1 | grep -c "error TS"` → **34**, and the §8 canonical 13-suite command plus
the new suites. Quote the command's output, never a bare count.
📌 **§8's recorded 552 is stale by 4.** That command returns **556** on HEAD — measured identically
with and without this pass's edits, so the four are the step-2b and step-3 commits, not this work.

---

## 5. THE ONE THING STILL OPEN — the coach-facing review UI

CHECKPOINT records it as unspecified, and it stays that way here deliberately. **Recommendation:
4a–4c land the server capability and are proven without it**; the minimal UI (4d) then replaces the
single `<select>` with the assembled set — N ads, each showing its concept, headline, body and
thumbnail, behind one "Publish N ads" button, with the existing single-ad path kept for editorial
and ungated creatives. Splitting it this way means the capability is proven before any pixel is
argued about, and 4d can be scoped separately.

---

## 6. WHAT STEP 4 DOES NOT DO — noted, not folded in

- **The image SCENE** (`awarenessDeckPlan`), and **4 → 8**. The hook band would have to grow with the
  deck; that decision wants the recovery rate 4b measures.
- **The `story` formula's wrong shape** — survivable since the Node 6 hardening, still costing a
  fifth of the deck. Pre-launch.
- **The currency-unaware `dailyBudget` floor** and the **Anthropic low-balance guard**. Pre-launch.
- **The product-aware top-up's proof-free framing** — a prompt change and a product-quality call.
- **The 8 legacy Cloudinary orphans**, the **Meta-side campaign orphans**, and **service 287**.
- **No backfill of anything.** Every existing row keeps whatever stamp it has.
