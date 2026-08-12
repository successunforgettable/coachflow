# CHECKPOINT — image chapter LIVE; COPY + CONCEPT-PAIRING chapter PROVEN, held local through step 3

**For a cold terminal with no memory of the session that produced this.** Read this file, then
`docs/handovers/STATE.md`. Everything below was verified in-session, not recalled.

---

## 0. NEXT ACTION — read this before anything else

# 👉 RUN STEP 4c. The harness is now THREE phases. It needs **a word per phase** on the day.

Steps 4a and 4b are done and proven live (`793d4ed`); the 4c harness was built and unit-proven
(`e862c76`) and has since been **reworked into three phases** after its first live attempt failed.

### 🔴 THE 2026-08-10 ATTEMPT — IT FAILED, AND IT NEVER REACHED META

One `--publish` run was attempted. **It died at the landing-page publish gate on an unfilled
`[INSERT_PRICE]` placeholder — BEFORE a single Graph call.** Confirmed clean afterwards: no
`/tmp/step4c-ledger.jsonl` was ever created, `meta_published_ads` was still **2**, and **nothing
exists on the ad account**. The local rows it had already made were cleared by
`server/scripts/step4c-failed-run-cleanup.ts` (kept in-tree as the incident record) and reconciled
exactly to baseline. **4c is therefore still UNPROVEN, and that attempt consumed the publish word.**

⚠️ **`placeholderValues` was NOT the mechanism and seeding it would not have helped.** The
landing-page publisher never calls `buildResolvedMap`; that registry is read only at the Meta and
GHL export points. The gate scans the RENDERED HTML for `[INSERT_*]`. The only thing that clears a
token on a PAGE is writing the answer INTO the stored content, which is what the coach-facing
operator intake does via `applyOperatorAnswer`.

### ✅ ALL THREE GAPS ARE NOW FIXED (built 2026-08-11, unit-proven with fakes, NEVER RUN)

| gap | fix |
|---|---|
| the page could not clear its own gate | `--prepare` derives the page's operator questions and answers **every** one through `applyOperatorAnswer` — the coach's own path, not a test shortcut — from a token-keyed table with a REAL price (never the `__FREE__` sentinel, which routes a different template) and a non-fabricating hedge for unknown tokens. It then re-derives, re-renders, and **hard-stops if any token survives**. |
| teardown could not clean a pre-Meta failure | the state file is now written **incrementally, one id at a time as each row is created**; and when neither the ledger nor the state names a campaign, teardown **SKIPS the Meta phase** and runs the local sweep. ⚠️ `assertDeletableCampaign` is **UNCHANGED** — every non-null id still hits the full protected-id refusal. A ledger/state DISAGREEMENT is a STOP, never a skip. |
| ~12 min of generation sat inside the publish window | **the run is split into three phases.** `--prepare` builds the throwaway and touches Meta not at all; `--publish` is short and its failure surface is only what 4c tests; a failed publish retries against the SAME prepared set. |

```
npx tsx server/scripts/meta-4c-preflight.ts                      # READ-ONLY, re-run this FIRST
railway run … npx tsx server/scripts/step4c-multiad-publish.ts --prepare     # local + page only
railway run … npx tsx server/scripts/step4c-multiad-publish.ts --publish     # the ad-account write
railway run … npx tsx server/scripts/step4c-multiad-publish.ts --teardown    # SEPARATE word
```

⚠️ **`--prepare` and `--publish` must run on the SAME machine** — the state file and ledger live in
`/tmp`, and `assertPublishable` refuses a state prepared on another host. `--publish` also refuses
if the prepared service is no longer in the database (already torn down) or if the state has already
published (a second run would leave two campaigns standing).

**With no flag the script prints its plan and exits without a single call** — verified by running it
deliberately without `railway run`, so no production credential was in the environment. `--publish`
begins with a live `GET /me`; a stale or rejected token stops everything before any object exists.

### ✅ THE MINIMUM-TWO-ADS FLOOR — built 2026-08-12, unit-proven with fakes, NEVER RUN

**The floor is now ONE exported constant — `MIN_ADS = 2` in `_core/multiAdPublish.ts` — enforced at
three points that finally mean the same thing.** It is deliberately a constant and not a parameter:
a caller-supplied minimum would be a path straight back to the one-ad campaign being closed.

**What was actually wrong, and it was worse than one missing check.** Three counts lived in three
files enforcing three different things, and the number 2 appeared ONLY in the throwaway harness:

| point | before | now |
|---|---|---|
| assembly output | core and tRPC both refused on **exactly zero** | refuses below `MIN_ADS`, before the screen is even called |
| **post-screening survivor count** | refused on **exactly zero** — 🔴 **a single survivor sailed through into a real campaign, ad set, creative and ad, and every layer reported success** | refuses below `MIN_ADS` in the SAME branch as the zero-survivor refusal, creating nothing at all |
| final published count | core had **no check whatsoever**; the harness printed one **after** the campaign existed and after the `meta_published_ads` provenance rows were inserted — advisory, never a floor | reported on a new `belowFloor` field (see below) |

🔑 **The post-screening survivor count is the load-bearing one, and the reason is structural: it is
the LAST count taken while Meta still holds nothing.** It is therefore the only point that can
enforce the floor by creating nothing. A single survivor is not a reduced success — it is a
multi-ad push with no second ad to share an ad set with, which is the entire purpose of this path;
`publishToMeta` is the single-ad way and does it better.

**`meta.publishAssembledAds` (the tRPC procedure) also refuses below the floor**, throwing
`BAD_REQUEST` beside the existing zero-assembly throw, so a caller gets a usable message rather than
a silent refusal object. The core refuses independently regardless — belt and braces, deliberately.
⚠️ **That procedure is NOT WIRED TO ANY CLIENT** — verified by grep over `client/src`, zero hits,
consistent with the module's own "NOT WIRED, NOT INVOKED" docblock. **So today's exposure is the 4c
harness path and any FUTURE wiring, not a live coach-facing path.** That makes the fix cheaper to
land, not less worth landing — and it means nobody should read this as a coach-facing bug fixed.

`publishToMeta` (the legacy single-ad path) is **UNCHANGED and must stay so** — it publishes exactly
one ad by design and a two-ad floor there would be wrong.

#### 📌 POINT THREE IS REPORTED, NOT AUTO-TORN-DOWN — a deliberate decision

An under-floor campaign can arise **only** from per-ad Graph failures AFTER creation, because the
survivor floor guarantees at least `MIN_ADS` ads entered the loop. When it happens the result
carries `belowFloor` (non-null) and **nothing is un-created**. Three reasons, all standing:

1. it preserves the **create-only publish / delete-only teardown separation** — a publish path that
   deletes is a publish path that can delete the wrong thing;
2. it honours the module's **keep-what-landed rule** — auto-deleting destroys a good ad to tidy up
   a bad one;
3. it leaves the call with the operator, who can see the account.

**Therefore the operator MUST run teardown on a below-floor result. It does not clean itself.**

#### 🔑 OPERATING RULE — at the read-back between `--publish` and `--teardown`

**`belowFloor` MUST be null before proceeding. A below-floor result means RUN TEARDOWN — never
retry.** Retrying leaves the under-floor campaign standing and adds a second one beside it, which is
exactly the orphan class already visible on the account (five "Auto Campaign Kit" campaigns against
two `meta_published_ads` rows). The harness prints the field as `🔴 BELOW FLOOR:` so it cannot be
missed in the log.

**Unit-proven with fakes, never run:** three assembled ads screened down to one survivor asserts all
four Graph fakes were never called and the refusal names "only 1 of 3"; two survivors publish into
one ad set with a single asserted `adset_id` and leave `belowFloor` null. Six pre-existing single-ad
fixtures had to become two-ad fixtures — forced, since under the floor a one-ad fixture now proves
the opposite of its own point. **No existing assertion was removed or weakened**; the conversions
changed setup data only.

### 🔴 A DEAD GATE WAS FOUND AND FIXED IN THE PUBLISH PHASE — it is now LIVE

The publish phase built its ad-to-page compliance text from `lpRow.content` — **a column
`landingPages` does not have.** It was always `undefined`, so the page text was always `""` and
**`checkAdToPageMatch` NEVER RAN.** That silently defeated the whole reason 4c generates its own
landing page (plan §2: so the gate is judged against a page the copy agrees with). It now reads the
**active angle**, the same one the publisher renders.

⚠️ **This is a behaviour change: a previously dead gate is now a live blocking surface inside
`--publish`.** It is the correct fix, but if the first proving run should not carry that surface it
is a one-line revert — Arfeen's call.

⚠️ **It writes to `act_1254349025145319` ("KS 1") — ACTIVE, billed in AED, ~AED 1,168,324 lifetime
spend across ~200 REAL campaigns. It is Arfeen's own advertising account, not a sandbox.** It runs
as **userId 1** because the Meta token is bound to user 1; the 117174 smoke account cannot publish.

**What it proves:** N assembled ads in ONE campaign and ONE ad set. Meta only compares variants
inside one ad set, so until that holds the whole distinctness chapter buys nothing at delivery time.
The load-bearing assertion is that **every ad's `adset_id` is the same value**, read back from
Meta's stored state rather than from our own request.

📌 **Re-run the read-only pre-flight on the day rather than trusting the numbers below** — the token
expires 2026-10-05, and the orphan inventory is a point-in-time read.

**Full design: `docs/handovers/STEP_4C_PLAN.md`. Read §0a — four things are open.**

### Where the repo is — as at 2026-08-10

⚠️ **This block deliberately names only the SHAs that CANNOT go stale — the per-step commits, which
are immutable once made. For "where is HEAD right now", run the command. §1 records that this file
hardcoded a moving SHA three times and went stale three times; writing one here would be the fourth.**

```
git fetch origin && git rev-parse HEAD origin/railway-build origin/backup/publish-path-sprint-2026-08-08
```

| | |
|---|---|
| Branch | `railway-build`. HEAD is this CHECKPOINT commit, sitting on top of **`e862c76`** (the 4c harness). |
| `origin/railway-build` | **`51eda78` — UNCHANGED since before this sprint. NOTHING here is deployed.** |
| Off-machine backup | `origin/backup/publish-path-sprint-2026-08-08`, updated to HEAD and SHA-verified after a fetch each time. **It does NOT deploy.** |
| Deploy discipline | Pushing `railway-build` IS an instant production deploy (~4s, no gate). It needs a fresh explicit "push" from Arfeen every time; no prior authorisation carries forward. |

⚠️ **MIGRATIONS 0097 – 0103 ARE ALL APPLIED TO PRODUCTION.** Every one is additive and inert.
**Do NOT re-apply any of them — 0103 least of all, it was applied 2026-08-10.** Their presence is
NOT evidence that the code using them is live; the schema is deliberately ahead of the code.

| migration | what | applied |
|---|---|---|
| 0097 | P.D.A.F. axes on `headlines` + `adCopy` | ✅ |
| 0098 | `image_hook` content type | ✅ |
| 0099 | `adCreatives.sourceImageUrl` (the third Cloudinary object) | ✅ |
| 0100 | publish-copy provenance on `meta_published_ads` + `adCreatives.headlineAdCopyId` | ✅ |
| 0101 | `adCopy.conceptId` | ✅ |
| 0102 | `adCreatives.conceptId` | ✅ 2026-08-10 |
| 0103 | `adCreatives.hookAdCopyId` — which image_hook row the picture baked | ✅ **2026-08-10** |

📌 **0103 carries NO foreign key and NO index, deliberately.** It follows `headlineAdCopyId` (0100),
not `conceptId` (0101/0102): `ON DELETE SET NULL` is right for a grouping key and WRONG for
provenance — it would erase the record of what was baked into a picture that still exists.
Verified after applying: `int / YES / NULL default`, 0 FKs, 405 rows unchanged, 0 stamped.

### The chapter, banked and proven — all LOCAL ONLY

| commit | what | proven |
|---|---|---|
| `e2eff85` | copy distinctness engine (per-surface gate, hook regeneration, harness) | live, both nodes |
| `64f5dc8` | **step 1** — the published headline and body come from the gated pool | live, real paused Meta ad, read back by id |
| `20a0f39` | **step 2a** — `adCopy.conceptId` plumbing and stamp | live, 28/28 stamped |
| `a313717` | Node 6 hardening — an off-shape model response no longer zeroes the deck | live, the guard fired for real |
| `8502f36` | **step 2b** — ad-copy awareness is concept-derived; dedupe removed; gate keyed on conceptId; concept top-up | live, both nodes |
| `269947c` | **step 3** — `adCreatives.conceptId`, tabloid cascade only | live, 4 real renders, 4/4 stamped |
| `793d4ed` | **steps 4a + 4b** — hook identity (0103), concept-keyed assembly, step-1 tests, inert multi-ad publish | live, 4 ads from 4 concepts, 0 dropped |
| `e862c76` | **4c harness** — metaSafety / publishLedger / metaTeardown + the flagged publish script | ⚠️ unit-proven with fakes only; **NEVER run against Meta** |

### ✅ STEP 3 — PROVEN LIVE (2026-08-10)

Four real renders on a throwaway. **4/4 stamped · 0 unstamped · 0 DANGLING · 0 JOIN-MISMATCH** —
each stamp equal to the concept of the `adCopy` row named by `headlineAdCopyId`, established by
joining on ids and never by comparing text. The render deck came back **UNDISTURBED**: four slots,
the same style sequence, and the generator's Layer 1+2+3 line **byte-identical (188 chars)** to an
expectation computed BEFORE the run from `awarenessDeckPlan`/`subTypePlanFor`/`visibilityTierPlanFor`.
Teardown swept **12 public_ids → 12 Cloudinary objects deleted, 0 failures** (exactly 3 per
creative). Reconciled: adCopy 5424 · headlines 2174 · adCreatives 405 (0 stamped) · protected 29.

⚠️ **What the stamp MEANS:** the concept whose HEADLINE the picture bakes — not "the picture
descends from that concept". The scene still comes from `awarenessDeckPlan`, and the on-picture
hook comes from a separately-chosen `image_hook` row. See §0a.

---

## 0a. WHAT IS OPEN — four items, and two of them are DECISIONS, not work

**The three findings step 4 was designed around are now CLOSED.** The A-vs-B gap is fixed at the
source and inverted (3 of 4 now AGREE); the 8 gate-moved rows are handled by judging awareness
coherence row-to-row on the live stamps, so there is deliberately no moved-row rule; NULL stamps are
skipped and never defaulted. Full design and the live ledger: `docs/handovers/STEP_4_PLAN.md`.

1. 🔑 **THE COHERENCE CAP — NEW, and it sharpens the 4 → 8 decision.** On the 4b run the four kept
   HOOKS carried concepts 175/176/177/178 while the four dealt HEADLINES carried 175/177/178/179.
   Concept 179 had no hook of its own, so slot 4 took the fallback and shipped a hook from another
   concept. **Root cause: distinctness is judged WITHIN each surface, so each surface keeps its own
   survivors and their concept coverage need not line up.** Hook-to-headline agreement is therefore
   capped by how much the two surfaces' surviving concept sets OVERLAP, and that cap tightens as the
   deck grows. ⚠️ **This is a second, independent reason the hook surface is the binding constraint
   on 4 → 8**, alongside the already-measured "natural distinct capacity is exactly 4". Not a defect
   in the deal — the deal did what it is specified to do.
2. **THE BLANK-HOOK-BAND BRANCH HAS NEVER FIRED LIVE.** When the hook rows run out a slot bakes NO
   line rather than repeating one already in the deck — an empty band is a visible symptom, a
   repeated line is an invisible collapse. Built and unit-tested; the 4b run had 4 hooks for 4 slots
   so it was never exercised, and **no composite with a blank band has ever been judged on pixels.**
   The 4b harness names such files `…-BLANK-HOOK-BAND.png` so they are impossible to miss.
3. **SHIP-VERSUS-DROP STRICTNESS — an open product decision.** Today a **mismatched but unique**
   hook SHIPS and is recorded (`hook.agreement: "mismatch"`); only a **duplicate hook string** drops
   the later ad. The reasoning is that the hook is already baked by assembly time, so discarding a
   rendered picture over a surface that can no longer be re-chosen ships fewer ads for no gain.
   **Whether that is the right strictness is Arfeen's call, and it is not settled.** Tightening it
   would trade ad count for surface purity; the 4b run is the only measurement so far (3 match,
   1 mismatch, 0 dropped).
4. **STEP 4c IS BUILT, ATTEMPTED ONCE, AND STILL UNPROVEN** — see §0 for the attempt, the three
   fixes and the commands. The 2026-08-10 run **died before any Graph call** and the account is
   confirmed untouched; the harness is now three phases. Everything remains unit-proven with
   injected Graph calls and **has never been invoked against Meta**. Three facts it depends on,
   all measured read-only on 2026-08-10 and all worth re-checking on the day:
   · the ad account is **AED**, ACTIVE, ~AED 1.17M lifetime spend, ~200 real campaigns;
   · the token is live (Meta answered `GET /me`) and expires **2026-10-05**;
   · **the three pre-existing orphans are `120246733286970626`, `120246731977370626`,
     `120246731522130626`** — hardcoded in `_core/metaSafety.ts` and refused by the teardown guard.
     They are NOT 4c's to clean up; a run that tidied them would destroy the evidence for a
     question nobody has decided. 4c's only obligation is to not add a sixth.
   ⚠️ **The AED budget floor is where our currency-unaware `z.number().min(1)` finally bites.**
   `createAdSet` sends `dailyBudget * 100` minor units, so `1` sends AED 1.00 and Meta rejects it.
   The harness pins **20** (proven accepted) and refuses below 4. **Zero is not an option** — an ad
   set with no budget is rejected outright. The coach-facing defect stays parked and unfixed.

5. 📌 **PARKED — the page render is duplicated in two places and can drift.** `--prepare`'s
   early "is the rendered page token-free?" check **mirrors** `landingPagePublisher`'s render
   dispatch (`styleForPageType` → the three style discriminators → `renderLandingPageHtml`, with
   the same testimonial injection and the same coach-asset fetch) rather than sharing one function
   with it. Accepted deliberately for the harness build: the publisher's own gate still runs a
   moment later and remains the authority, so the worst case of drift is a duplicated error
   message, never a page that publishes with a token in it. **The proper fix is to extract ONE
   shared render helper both call** — that is a change to production code and wants its own pass.
6. 🔴 **PARKED, AND IT WILL BITE SILENTLY — the coach-scoped answer snapshot must grow with the
   registry.** A coach-scoped operator answer writes OUTSIDE the throwaway, onto the owner's own
   `users` row; today `[INSERT_BOOKING_URL]` → `users.bookingUrl` is **the only** token with
   `scope: "coach"` in `OPERATOR_TOKEN_REGISTRY`. `--prepare` snapshots the prior value before
   writing and `--teardown` restores it, including restoring it to NULL when there was nothing
   there before. ⚠️ **If any NEW coach-scoped token is ever added to the registry, that snapshot
   must be extended or teardown will silently stop reversing it** — the throwaway would be deleted
   while a made-up value stayed on the real account, with no error anywhere. There is a comment at
   the snapshot site saying so; this is the second place, because the person adding a registry
   entry will not be reading the harness.

📌 **The coach-facing review UI (4d) is deliberately unstarted.** The server capability is proven
first so the pixels can be argued about separately.

### ✅ FIXED IN 4a — the short hook deck no longer duplicates the on-image line

**The defect, for the record.** Node 7 kept **3** image hooks on the step-3 run, not 4. The hook
surface is the fragile one — with persona pinned and format fixed it has only two movable axes — and
it landed at 3 against a band of 1–4, so it was above floor and shipped. The image path then took
`bodyTexts[i % bodyTexts.length]` over 4 slots, so **two pictures baked the IDENTICAL on-image hook
line** (adCopy row 6044 on slots 1 and 4) — duplication on the exact surface Meta's OCR reads.

**Fixed by `dealHooksByConcept` (`793d4ed`): the deal NEVER reuses a row.** A slot with nothing left
bakes no hook at all. Arfeen's call was taken the "ship with no line rather than a repeated one" way,
because an empty band is a visible symptom of a short deck while a repeated line is an invisible
collapse. ⚠️ **That branch has still never fired live** — see §0a item 2 — and it **still interacts
with 4 → 8**: growing the deck to 8 makes the shortfall worse unless the hook band grows with it,
and §0a item 1 adds a second, independent cap on top of that.

## ✅ PUBLISH-PATH STEP 1 — PROVEN END TO END ON A REAL PAUSED AD (2026-08-09)

**META RETURNED THE GATED COPY ON ALL THREE FUSED SURFACES.** Read back BY ID from the live ad
before anything was deleted — not from our request, and not from a list endpoint:

| surface | Meta's stored value | source |
|---|---|---|
| headline field | `"Postpartum stalls don't respond to less — here's why"` | gated adCopy **5889** (solution_aware/curiosity) |
| primary text | 964 chars, byte-identical | gated adCopy **5902** (problem_aware/pain_agitation) |
| baked on the image | same string as the headline field | adCreatives 482 |

✅ headline === 5889 · ✅ body === 5902 (964/964) · ✅ baked === field · ✅ NOT the ungated control
headline · ✅ NOT the landing-page subheadline body · ✅ **PAUSED at campaign, ad set AND ad**
(`daily_budget=2000` = AED 20.00; nothing could deliver, nothing spent) · ✅ campaign deleted and
confirmed by id (`status=DELETED` — Meta SOFT-deletes, so the id stays readable, which is exactly
why a by-id read beats a list check) · ✅ provenance persisted: `meta_published_ads` carried
`headlineAdCopyId=5889 bodyAdCopyId=5902` and a real `adSetId` beside legacy rows still showing
`temp`/NULL.

**Migration 0100 APPLIED** — 3 additive nullable columns, row counts identical before and after,
zero non-null values (no backfill), ALTERs 2.08s/2.23s. 0097, 0098, 0099, 0100 are ALL applied while
the code using them is NOT deployed. Schema is deliberately ahead of code.

**All step-1 throwaways torn down** and reconciled EXACTLY: adCopy **5424** · headlines **2174** ·
adCreatives **405** · meta_published_ads **2** · protected `272:5 273:5 275:5 276:5 277:5 285:4` =
**29**. The sweep cleared **3 Cloudinary objects for 1 row** — 0099 working; pre-0099 it would have
cleared 2 and leaked 1.

### What step 1 shipped

`_core/publishCopySource.ts` (resolver — REFUSES ungated or unscreened rows rather than falling
back, because a silent fallback is indistinguishable from the defect being removed) ·
`measureHeadlineFit` (the length rule, measured in RENDERED WIDTH on the real canvas with the real
font — the 52-char proven headline would have been rejected by the retired ≤38-char guard yet fits
with 9px to spare at 896px) · gated headlines baked by the render path so picture and field match by
construction · `metaAPI` by-id fetchers · provenance wiring · `meta.getGatedPublishCopy`.

🔑 **THE STRONGEST RESULT IS NOT DISTINCTNESS.** The control run was BLOCKED by our own compliance
gate on the landing-page body (`second_person_protected_attribute`) — page copy is never screened as
ad copy, so the live path could hard-fail at the final step after the coach did everything right.
The gated body clears that gate: **control 1 blocking hit, rerouted 0**, same gate, same service.

## ✅ STEP 2, FIRST HALF — conceptId PLUMBING AND STAMP, PROVEN (2026-08-09)

**Migration 0101 APPLIED** — `adCopy.conceptId INT NULL`, FK to `campaignConcepts(id)` with
`DELETE_RULE = SET NULL`, plus `idx_adCopy_conceptId`. Row counts identical either side, zero
non-null values (no backfill), protected 29. ~2s per statement, no rebuild. This DB is **MySQL
9.4.0 with 81 real FK constraints**; the name follows adCopy's existing
`adCopy_<col>_<reftable>_<refcol>_fk` convention.

**Proven live on one throwaway (both nodes, one concept generation):**

1. **Deck shape UNDISTURBED** — headline 12 / body 12 / hook 4, collapse 6→0, 4→0, 30→0, every
   surface at or above floor. Awareness is still the cold-weighted `awarenessPlanForCount`; this
   half changed nothing about it, and the shape matching two prior runs is the evidence.
2. **Stamps RESOLVE** — 28 counted rows, **stamped 28 · unstamped 0 · MISMATCHED 0 · DANGLING 0**,
   **8 of 8 concepts represented**. Verified by comparing the stamped concept's `desire` against
   the ROW's own desire, not by checking the column is non-null — a stamp pointing at the wrong
   concept is worse than none, because it looks complete.
3. **The `regenerate` re-stamp is verified by that same zero** — 7 rows were recovered on a moved
   axis. The gate moves `desire` to another value from the same pool, so a conceptId left pointing
   at the ORIGINAL concept would silently become a lie. `regenerate` now re-derives it.

### ✅ SUPERSEDED BY STEP 2b — the dedupe is GONE, and removing it mattered

2a kept the dedupe-by-desire-string deliberately and deferred its removal to 2b. **2b removed it
(`8502f36`), and the live run proved it was not a theoretical concern:** the generated set held 8
concepts with only **6 distinct desires** — two pairs sharing a want and differing only in stage.
Under the old code those two concepts were erased before reaching a single row, a quarter of the
set, silently. All 8 reached the deck.

The 2a "stamp points at the first" ambiguity is therefore **retired**: the plan carries the concept
id on the slot, so the insert path performs no lookup at all, and the gate's desire axis is keyed
on `concept:<id>` rather than on prose. Two rows collapse on that axis when they came from the SAME
concept row, never because a generator phrased two wants alike.

📌 `dealAcrossSlots` turned out to be **already generic (`<T>`)**, so no signature changed and
`headlinesGenerator` was never touched. `link` rows are stamped too — excluded from the
distinctness population but they carry axes for coordination, so a hole there would be incoherent.

### ✅ STEP 2b — PROVEN LIVE, BOTH NODES (2026-08-10)

Node 7: collapse **43 pairs (13.2%) → 0**, KEPT headline 12 / body 12 / hook 4, every surface above
floor. 28 counted rows — **stamped 28 · unstamped 0 · desire-mismatch 0 · dangling 0 · 8/8 concepts
represented**. The ungated link band came back `unaware 6 · problem 5 · solution 2 · product 2` —
the same weighting the old cold plan produced, now carried by real concepts. Node 6 UNCHANGED by
design (its table has no `conceptId` column): non-regression run collapse 25 → 0, KEPT 12/band 8–12,
persisted 12 = ledger 12 = returned 12.

**The concept top-up is BUILT and its restore branch has FIRED live, but it has never successfully
restored a stage.** Forced-condition run 2026-08-10: the concept gate killed `product_aware` on its
own (7/12 survived, 5 blocked on `invented_testimonial`/`unearned_authority`), the branch fired
correctly — one targeted call, right stage, `room=1` — and **the replacement concept failed the same
gate** (`asked 1, returned 1, passed 0, ADDED 0`). Never-pad held: no other stage moved, the set
stayed at 7 ≤ 8, and it reported the shortfall. **Root cause is structural, not luck:**
`product_aware`'s primary hook is `social_proof` and its first secondary is `data_chart`, both
withheld when the coach has no client material, so the model reaches for authority it has not earned
and is blocked. Fixing it means giving the top-up call a proof-free product-aware framing — a PROMPT
change, not a control-flow one — and it is Arfeen's call. 📌 Instrumentation gap worth closing at the
same time: the top-up logs `passed 0` but not the failure CLASSES, which are already in the gate
result.

⚠️ **Step 1 delivers GATED and COMPLIANT, not yet COHERENT.** The resolver picks the strongest
headline and body INDEPENDENTLY, so the proven ad paired a `solution_aware` headline with a
`problem_aware` body. Both good, both compliant, different stages.
✅ **CLOSED BY STEP 4b (`793d4ed`)** — `_core/adAssembly.ts` chooses the surfaces together and
requires the headline and body to share one awareness stage. Proven live: all 4 assembled ads
stage-coherent. ⚠️ `resolveGatedPublishCopy` itself is UNCHANGED and still picks independently — it
is the pool, and assembly is what pairs from it. Do not read this as the resolver having been fixed.

### ✅ NODE 6 HARDENED — the crash is now survivable (2026-08-09)

**The defect.** All THREE branches consumed the model's `headlines` with a bare `.forEach` and no
shape check — `story`/`question`/`urgency`, `eyebrow`, and `authority`. A JSON schema is a REQUEST,
not a guarantee. Worse, the five formulas ran in a **`Promise.all`**, so ONE off-shape response
rejected the whole batch and the coach got **zero** headlines. Guarding one branch would have closed
nothing.

**The fix, in four parts:**

1. **`headlineItemsFrom`** — container guard on all three branches. Not an array → contribute 0 for
   that formula, logged loudly, the rest of the deck lands.
2. **`structuredHeadlineFields`** — per-element safety for `eyebrow` (`item.eyebrow/.main/.sub`) and
   `authority` (`item.main/.sub`). A missing `main` DROPS the element, because `headline` is NOT
   NULL and it would otherwise fail at insert far from its cause; `sub`/`eyebrow` are nullable so
   absent ones degrade to null rather than discarding a good headline. The string branch got the
   same check — a non-string element would reach the insert as an object.
3. **`Promise.allSettled`**, and the per-formula catch LOGS WITHOUT RETHROWING. Two layers on
   purpose: the catch handles the normal case, `allSettled` covers anything thrown OUTSIDE the try.
4. **A summary line** (attempted / settled / rejected / collected) so a short deck is visible in one
   line — and **all-formulas-empty still THROWS**, because persisting an empty set and reporting
   success is worse than failing.

**No retry**, deliberately: this generator has never had one around the LLM call, and adding one
inside a crash fix would smuggle in new behaviour.

**Proven both ways.** 29 unit cases in `headlineItemsGuard.test.ts` — bad shapes across all five
formula names, plus valid-shape pass-through for each branch so the guards are shown NOT to perturb
a normal deck. And the live run **exercised the fix for real**: the `story` formula returned
`headlines` as a **string**, the guard caught it, and the other four still produced a full deck —
`KEPT 12/band 8-12`, collapse 18 → 0, `question 4 · eyebrow 4 · authority 2 · urgency 2`, ledger
KEPT = rows = returned = 12. Under the old code that identical run would have crashed.

Node 6 is now PROVEN for step 2 as well — the parity result step 2a never reached.

### 🔴 PRE-LAUNCH — the `story` formula systematically returns the wrong shape

**Lower severity than the crash, but not fixed.** `story` returned a non-array `headlines` on BOTH
runs that reached it (2026-08-09, twice). Two for two on one formula is a pattern in its prompt or
schema, not model variance.

The guard makes it **survivable, not fixed**: every story run silently costs a fifth of the deck —
12 kept instead of the ~15 five formulas would give — and the only trace is one `console.error`. Fix
the story prompt/schema before launch, and check whether `FORMULA_SCHEMAS.story` differs from its
four siblings in a way that invites the wrong shape.

### 📌 OPEN — unit coverage for the step-1 code, before step 4

Step 1 shipped with **zero new tests** (568 before, 568 after). `publishCopySource.resolveGatedPublishCopy`,
`measureHeadlineFit` and the `metaAPI` by-id fetchers are proven live but have no unit coverage.
Step 4's assembly builds directly on the resolver, so close this first.
⚠️ Also: the step-1 commit gate ran **8 suites (501)** rather than the canonical 14 (**568**) that §8
records. Nothing was lost — the six omitted suites account for exactly 67 — but run the §8 command.

### 🔴 TWO PRE-LAUNCH DEFECTS FOUND WHILE PROVING STEP 1 — neither is fixed

1. **The `dailyBudget` floor is CURRENCY-UNAWARE.** `publishToMeta` accepts `z.number().min(1)`,
   which assumes USD. The ad account is denominated in **AED**, and `createAdSet` rejected a budget
   of 1 with `blame_field_specs [["daily_budget"]]` — *"must be more than AED3.00"*. A coach on any
   non-USD account entering 1 or 2 hits this. The modal's default of 20 masks it.
2. **No low-balance guard on the Anthropic key.** A payload proof burned ~10 minutes polling before
   failing with *"credit balance is too low"*. When credit runs out EVERY generator fails — concepts,
   copy, headlines, landing pages — and the only signal is a 400 deep in a run. Second occurrence
   (first: 2026-07-24). Wanted: a cheap pre-flight and a coach-facing message.

🔴 **WHY THIS OUTRANKS EVERYTHING ELSE IN THE SPRINT. The gated copy reaches nothing live.**
Traced end to end 2026-08-09, in code, not recalled:

- The **published headline** is `selectedCreative.headline` (`PushKitModal.tsx:263`) — a row from
  the ad-creatives batch, written by `generateContextualAdHeadlines`, a SEPARATE micro-call inside
  the image engine. It has its own ≤38-char validator but **no P.D.A.F. axes, no concept desire, no
  awareness stamp, and it never passes through the gate.**
- The **published body** comes from `deriveDefaultBody` — landing-page **subheadline**, else
  **eyebrowHeadline**, else operator-typed. **The adCopy body pool is not in that priority list at
  all.**
- So of Meta's three fused surfaces, **only the baked image hook is gated.** The 12 gated headlines
  and 12 gated bodies are generated, gated, and never shipped.
- ⚠️ **CHECKPOINT §12.7 SAYS THE PUBLISHED PRIMARY TEXT COMES FROM THE adCopy TABLE. That is TRUE
  OF V1 ONLY** (`AdCopyDetail.tsx:246-247` → `PublishToMetaDialog`), and `client/src/pages/` is
  read-only legacy per CLAUDE.md §5. It is FALSE of the live V2 path. Corrected here rather than
  left to mislead the next session — the §15a failure mode exactly.
- **Assessed as an unfinished GAP, not a design decision.** Nothing in the build spec says publish
  should draw from the creative row; spec §3 requires the three surfaces to ship as a coordinated
  set, which only means anything if the coordinated set is what ships.

### 🔴 THE PUBLISH SURFACE — traced 2026-08-09. ONE PUSH MAKES ONE AD, IN ITS OWN CAMPAIGN.

There is **no fan-out and no batch step.** `handlePush` calls `fireMeta()` once, which calls
`publishToMeta` once, built from ONE creative chosen in a single `<select>`
(`PushKitModal.tsx:470`) plus ONE body textarea. The `Promise.allSettled` in that file is **Meta
and GHL in parallel — two platforms, not several ads.**

And each call builds a COMPLETE new hierarchy: `createCampaign` → `createAdSet` →
`createAdCreative` → `createAd` (`meta.ts:340-396`). **Four ads today = four separate campaigns and
four separate ad sets.** No code path anywhere adds an ad to an EXISTING ad set.

⚠️ **THIS IS THE REAL CONTENT OF STEP 4, AND IT IS A SERVER CAPABILITY, NOT A UI CHANGE.** The
point of shipping distinct variants is that Meta compares them INSIDE ONE AD SET and distributes
across them. Four ads in four campaigns do not compete in a shared auction — they are four
unrelated campaigns with separate budgets, which defeats the distinctness work no matter how good
the copy is. Step 4 must add "publish N ads into one campaign/ad set" before any multi-select UI
means anything.

### 🔴 META CONTROL RUN — 2026-08-09. BLOCKED BY OUR OWN GATE, NOT BY META.

Run as userId **1** (the token is bound to user 1; the smoke account cannot publish). LP **221**
(`https://zapcampaigns.com/p/campaign-221`, service 270), verified genuinely live by HTTP 200 /
31KB rather than by a database row. Creative **368** (`person_shocked`/`benefit`). Harness:
`server/scripts/meta-control-publish.ts`, which ports `buildMetaInput()` and `deriveDefaultBody()`
VERBATIM so the capture reflects shipped behaviour.

**THE CONTROL PAYLOAD — keep this; the reroute run is diffed against it:**

| field | value |
|---|---|
| headline (Meta headline field) | `"Lose the mum tummy. Feel like you."` (34 chars) — the CREATIVE ROW's headline, image-side, ungated |
| body (Meta primary text) | `"This is not a workout class and it is not a meal plan handout. It is the explanation nobody gave you at your 6-week check — why your postpartum body responds differently to everything you used to do, and exactly what to do instead."` (231 chars) — landing-page `freeAngle.subheadline`, kit 185's angle |
| linkUrl | `https://zapcampaigns.com/p/campaign-221` · status PAUSED · dailyBudget $1 |

**ZERO of the four Graph calls fired.** `publishToMeta` blocked at `meta.ts:316` — before
`createCampaign` at `:340` — with `classes=[second_person_protected_attribute]`. The gate is RIGHT:
the body says *"your postpartum body"* and *"nobody gave you at your 6-week check"* — second-person
assertions about a protected attribute.

🔑 **THIS IS THE STRONGEST ARGUMENT FOR STEP 1, STRONGER THAN THE DISTINCTNESS CASE.** The landing
page subheadline was written as PAGE copy and never passed the compliance layer as AD copy. Gated
Node 7 bodies DO pass it at generation. So the live path can hard-fail at the final step on copy
nobody ever screened for this use, after the coach has done everything right. **No retry was
attempted on a different LP — picking one whose subheadline happens to pass would have buried the
finding.**

✅ **THE META CONNECTION IS CONFIRMED LIVE.** `getCampaigns` returned **25 real campaigns** off the
account, so token, app config and the Graph READ path all work today. Token expires **2026-10-05**
(~58 days). Only the WRITE path is still unproven — and it is unproven because our own gate never
let it try. Nothing was created: `ZZ-CONTROL present? false`, verified by read-back.
⚠️ **This ad account carries Arfeen's REAL advertising** (`[ME] CBO | Leads | UAE`, `Crypto Workshop
GCC/UAE`). It is not an empty sandbox — scope every future live-fire accordingly.

### 📌 PARKED — none of these block step 1

- **Meta-side campaign orphans.** The account shows **FIVE** campaigns named "Auto Campaign Kit"
  while `meta_published_ads` holds **TWO** rows. Most plausibly a publish that got past
  `createCampaign` and failed later, leaving an orphan — the same shape as the Cloudinary orphan
  class. **Observed, not concluded; needs its own look.**
- **Eight Cloudinary orphans** from runs predating 0099 (`generated_17862073*` ×4,
  `generated_17862012*` ×4). Urls never recorded, unrecoverable from the database; they need the
  pattern-scoped listing sweep (`cloudinary.search` sorted `created_at desc`, NOT `api.resources()`).
- **The live PAUSED reroute run** — pending Arfeen's explicit word, and only after the payload-level
  proof passes.

### The approved publish-path design (Arfeen, 2026-08-09) — build sequence

1. **Reroute the published headline and body to the gated pool.** Retire the image-side headline
   generation from the tabloid render path so the picture and the headline FIELD carry the SAME
   gated line — two different headlines would be spec §3's "three unrelated messages", worse than
   repetition. ⚠️ The reroute inherits no length guard (the ≤38 validator lives in the retired
   side-generation), so it needs an explicit length rule. Record provenance on the published row,
   which also closes the `adSetId: "temp"` traceability gap in §8c.
2. **Stamp `conceptId` on `adCopy`** — additive migration, travels alone. Pair by id, NEVER by
   matching desire/awareness label text: two concepts can share a stage and a silent mispair is
   invisible.
3. **Tie images to concepts** — additive `conceptId` on `adCreatives`. Also defuses the
   `awarenessDeckPlan` trap (distinct stages guaranteed only at ≤4 slots).
4. ✅ **DONE (`793d4ed`) — Ad assembly: one concept → one ad.** Headline, body, hook and image all descend from the same
   persona/desire/awareness concept. **Each body is used by AT MOST ONE ad; if bodies run short the
   campaign ships FEWER ads rather than reusing one** — the never-pad rule applied to assembly.
   Today every ad in a push ships the identical operator-typed body, a 100% duplication rate.
   Fixing the pairing also strengthens the anti-echo: it currently checks a pool that can be
   recombined arbitrarily at publish, whereas with fixed concept pairing **what is checked is what
   ships**.
5. **Congruence: THE LANDING PAGE IS THE ANCHOR — LOCKED.** The gated body aligns TO the page,
   never the page to the body. The page is the destination, exists earlier in the cascade, is what
   Meta scans for compliance, and one page serves many ads — regenerating it per winning ad breaks
   that shape. Seeding the page from a winner is a POST-LAUNCH optimisation, not this build.
   `checkAdToPageMatch` (`meta.ts:304`, already called at publish) is promoted from advisory to
   gate, and the page's own lines join the anti-echo avoid-list so the body agrees with the page
   without parroting it — today's degenerate default IS the subheadline.
6. **Only then** revisit the hook bar and 4 → 8.

📌 **Step 1 does NOT depend on concepts** and can land alone. Step 4 does depend on steps 2 and 3.
📌 **Open, not designed over:** how a coach reviews and confirms N assembled ads. `publishToMeta`
builds ONE ad per call; the multi-ad UI shape needs its own look before step 4 is specified.

7. **Then deploy**, which needs Arfeen's explicit "push" like every other deploy.

✅ **The distinctness gate is DONE** — built, proven live on BOTH nodes, committed locally. See
§12.6 for the measured before/after numbers, the two defects the first run exposed, and what is
still unexercised.

⚠️ **Migration 0097 is ALREADY APPLIED TO PRODUCTION** — four additive nullable columns
(`persona`, `desire`, `awareness`, `format`) on `headlines` and `adCopy`. Additive and inert: no
deployed code reads or writes them, because the code that does is the unpushed work. Do not
re-apply it, and do not treat its presence as evidence the copy engine is live.

⚠️ **`docs/handovers/STATE.md` is dated 2026-07-28 and knows nothing about the last six sessions.**
It has been wrong more than once. **Trace code and query the DB; do not trust handover prose.**

---

## 1. Where the repo is

| | |
|---|---|
| Branch | `railway-build` — the only deploy branch. Never push `main`. |
| HEAD / origin | **Do not read a SHA from this file. Run the command below.** |
| Deployed? | Railway auto-deploys `railway-build` on push. If HEAD == origin and Railway is green, the tip is live. |

```
git fetch origin railway-build && git rev-parse HEAD origin/railway-build && git log --oneline -8
```

⚠️ **THIS SECTION HARDCODED A SHA THREE TIMES AND WENT STALE THREE TIMES — SO IT NO LONGER CARRIES
ONE.** It claimed `eb50e3a` while the six-commit chapter had already shipped; it then claimed
`51bdd03` while the §11 canvas fix (`774a39b`) was already pushed and live. A fresh session reads
this file first, so a stale §1 is the most expensive stale prose in the repo. **The fix is not to
update the SHA faster — it is to stop storing one here.** Git is the source of truth for where the
repo is; this file's job is to explain what that code *means*, which is everything below.

**What is true as at 2026-08-06:** the Andromeda image chapter and the §11 canvas + routing fix are
both pushed and live. The narrative sections below describe that state. If `git log` shows commits
newer than §11's, this file has not caught up with them and the code wins.

**Push discipline is unchanged: the next push needs a fresh explicit "push" from Arfeen.** No prior
authorisation carries forward. Committing does NOT deploy; **pushing** deploys (~4s, no gate).

### The six commits that are live

| SHA | what |
|---|---|
| `e71f62f` | image engine Layers 1+2 — awareness × sub-type drives image selection |
| `eb50e3a` | stage-led engine, 4:5 feed, emitted-pixel text-safe band |
| `98cb623` | CHECKPOINT refresh |
| `e8c6ed3` | **visibility tier** — a repeated sub-type cedes its face rather than collapsing to one Entity ID |
| `5a42eaf` | deploy-gate fixture for `regenerateSingle` / `makeVertical` |
| `3d085ee` · `51bdd03` | id-scoped teardown rule · banked research reports |

Live in production, therefore: **stage-led shot concepts across five awareness stages** (Layer 1) ·
**sub-type styling** (Layer 2) · **4:5 feed with a per-canvas, emitted-pixel-measured text-safe band**
(Layer 3) · **the visibility tier** · compliance gate · awareness foundation · stage-aware copy.

Verified live by one labelled throwaway cascade (service 290), reconciled to baseline.

---

## 2. What `eb50e3a` actually changes

The awareness stage now drives the **shot concept** — subject, action, composition — and the sub-type
only **styles** it (lighting, backdrop, texture). Previously the style template fixed pose and
composition and the stage was appended afterwards, so it modified a decision already made.
`[AWARENESS-PLAYBOOK §3]` names that exact failure: *"If styling is allowed to lead, the ad risks
falling into 'default' poses… which trigger Entity ID clustering."*

Files: `routers/adCreatives.ts` · `_core/imageGeneration.ts` · `_core/compositeHeadline.ts` ·
`adCreativesGenerator.ts` · two test files · `scripts/measure-text-safe-zone.ts` · 3 research
reports + their README.

---

## 3. ✅ PROVEN — on live renders, zero DB writes, every run reconciled to 405

- **Layer 1 across all five awareness stages**, isolated: style and sub-type held constant, stage the
  only variable, with the styling half of every prompt asserted **byte-identical before any spend**.
  A same-prompt control render sets the diffusion-noise floor — noise changes *who and how*, the
  stage changes *what is happening*.
- **Fix 1 — Problem-Aware** carries friction in the **environment**, not the face. The first rebuild
  used "a hand at the temple", which the banked guardrails list verbatim as a prohibited distress
  trigger carrying *"a total retrieval penalty"*.
- **Fix 2 — Product-Aware** is an expert mid-demonstration addressing someone off-camera. It had been
  rendering as a head-on portrait, colliding with Most-Aware's PD-4 direct address. Guarded by test.
- **Fix 3 — verified ONLY on the composite.** Headline/body/CTA land on darkened defocused surface
  instead of across the work the scene was told to keep clear. ⚠️ **The raw render looked fine while
  the finished ad was broken — raw pixels cannot prove this.**
- **4:5 feed** with the reserved band keyed to **emitted pixels**, plus its guards (§4).
- **Still-life `screenshot` slot has pixels for the first time** — person-free, abstract text-free
  screen, clean plate held, and it stayed on gpt-image-1. **n=1.**

Proof images on disk (not committed — binary weight):
`docs/screenshots/run-2026-08-05-layer1-isolation/` · `run-2026-08-05-layer1-reprove/` ·
`run-2026-08-06-layer3-45/` · `run-2026-08-06-layer3-verify/`.
`run-2026-08-05-layer12-proof/` is the **pre-rebuild** "before" set.

---

## 4. The text-safe band — measured, per-canvas, and guarded

**Do not replace this with a constant.** It was measured by pushing a synthetic plate through the
real compositor at worst-case content (`scripts/measure-text-safe-zone.ts`).

| canvas | topmost glyph | reserved | wording |
|---|---|---|---|
| Flux 4:5 → **896×1088** | 0.6445 | 0.5048 | "the lower three-fifths" |
| gpt-image-1 4:5 → **1024×1280** | 0.6445 | 0.4955 | "the lower half" |
| 1:1 1024×1024 | 0.5693 | 0.5707 | "the lower three-fifths" |
| 9:16 1080×1920 | 0.5875 | 0.5515 | "the lower three-fifths" |

- **NOT ratio-invariant** — 4:5 and 9:16 are **5.7pp apart**. A scalar silently mis-reserves the
  9:16 path. Size-invariant *within* a ratio (1024×1280 vs 1440×1800 differ by 0.0001).
- `reservedFromBottom = 0.376 × W + padBottom(H)` — predicts 9:16 to within **two pixels**.
- **Keyed off EMITTED pixels, never the ratio string.** Flux answers "4:5" with **896×1088** (0.824);
  gpt-image-1 returns a true 1024×1280. Those straddle a band boundary, so the person slots were
  under-reserving by ~1pp — clearance by margin, not design. **Flux is deliberately NOT forced to
  exact 4:5**; 896×1088 is a valid Meta asset.
- **Crop direction settled on pixels**: `DEFAULT_CROP_DIRECTION = "bottom"` (keep the upper 1280).
  gpt-image-1 cannot emit 4:5, so it renders 1024×1536 and is cropped. The alternative was cramped
  and top-heavy. Both candidates are in `run-2026-08-06-layer3-45/08-crop-A` vs `08-crop-B`.
- `imageFormat` now records dimensions read off the rendered buffer, so a row cannot lie.

---

## 5. 🔴 OPEN — read this before claiming anything works

1. **THE WIRING GAP IS THE NEXT ROCK.** **Five of eight fan-out sites pass no stage** and render the
   pre-rebuild prompt. Only the cascade (`adCreativesGenerator.ts`) carries Layers 1–3.
   ⚠️ **Opening this forces the 4-vs-8 cardinality decision** — the tabloid deck is 4
   (`AD_VARIATIONS`), the concept batch is 8, and `adCreativesGenerator.ts:534` **throws** on a
   mismatch because a mismatch once caused a live outage (`5f3294d` → `304f6fd`). **Arfeen's call.**
2. **Esoteric and aspirational sub-types are unproven** with the new shot concepts. Only `grounded`
   has been rendered since the rebuild.
3. **flux@9:16 emission has never been measured.** It takes the conservative fallback.
   **Measure it before any stage-led vertical ships.**
4. **The editorial path has no Layers 1/2/3** and is untouched. A run routing editorial proves nothing.
5. **Four person stages (Unaware, Problem-Aware, Product-Aware, Most-Aware) were not re-rendered**
   after the band was rekeyed to emitted pixels. That change only **widened** clearance so it cannot
   have regressed them, but they are unswept — fold into the next full run.
6. **DEPLOY IS GATED on the shared paths.** `makeVertical` (9:16) and `regenerateSingle` share
   `generateAdImagePrompt` / `rendererForStyle` / `renderAdCreative`. **None of the five wizard
   procedures has an automated test** and they are historically error-prone (P6b). Exercise them
   before pushing. (`5a42eaf` added `sharedProcedureShapes.test.ts` for the first two — a shape
   fixture, NOT a render proof.)
7. **`makeVertical` builds its prompt with no aspectRatio**, so its reserved band comes from the
   static legacy clause while it renders 9:16 — the canvas whose true reserve is **0.5515**, furthest
   from the others. Inert today because it takes PATH A, but it is the same omission
   `regenerateSingle` had. **Not fixed — deliberately out of scope of the 08-06 canvas fix, which
   Arfeen scoped to two sites.**
8. **`generateAsync` (`routers/adCreatives.ts:1552`) passes NO aspectRatio AT ALL — so it still
   emits 1:1 while the cascade emits 4:5.** Found 2026-08-06 by tracing every prompt-builder call
   site; not previously written down. Neither the `generateAdImagePrompt` call at `:1552` nor the
   `genImg({ prompt, style })` call that follows it carries a ratio, and `generateImage` defaults
   `aspect_ratio` to `"1:1"` (`imageGeneration.ts:265`). **This is the same missing-argument family
   as the `regenerateSingle` fix (§8b symptom 1) and as `makeVertical` (item 7) — three instances of
   one shape.** Unlike item 7 this one is NOT inert: any card produced by this path is a different
   SHAPE from a cascade-produced sibling. It also takes PATH A (no stage passed), so it renders the
   pre-rebuild prompt as well. **Not fixed, nothing touched — logged for a decision.** Fixing it is
   the same one-line shape as the two sites already fixed, but it belongs to the wiring gap (item 1)
   and therefore inherits the 4-vs-8 cardinality question, which is **Arfeen's call**.

---

## 6. ⚠️ EVERY GATE IS BLIND TO WHETHER A PICTURE IS GOOD

G4 checks only that a non-empty PNG reached disk. Nothing in the suite can see melodrama, legible
in-image text, an anatomical failure, or a subject buried under the headline.
**That judgement is Arfeen's and only Arfeen's. CC never self-certifies a visual result.**

---

## 7. Production data — verified 2026-08-06 (re-verified post-deploy by direct query)

- `adCreatives` = **405** (the baseline). `meta_published_ads` = **2**. `jobs` running = **0**.
- **All campaigns currently on ZAP are dummy/test data.** Nothing to preserve, migrate, or keep
  backward-compatible. This drops the urgency of the sites-4/6 stage-column migration — no real old
  campaign needs regeneration coherence.
- **The "never touch services 272–277 and 285" protection is RETIRED.** Those 29 creatives are
  confirmed pre-rebuild dummy/old-engine — 25 belong to the E2E smoke account (`117174`, created
  Jul 23–24), 4 are Arfeen's own Aug-3 old-engine set. **None is behind a live ad.** Deletable for a
  clean slate, but **only on Arfeen's explicit instruction, and any delete is id-scoped** (§10).
- **The two `meta_published_ads` rows are app-review dummies** — both `userId=1`, both **PAUSED**,
  both created **2026-05-12**, objective `OUTCOME_LEADS`, campaign name "Auto Campaign Kit". Not real
  campaigns. **No real Meta ad work has been done.**
- **Protected services untouched:** `272:5 273:5 275:5 276:5 277:5 285:4` — 29 creatives.
- **The 409-vs-405 drift is resolved.** It was NOT failed teardown: the previous proof's teardown was
  clean (0 surviving proof services, 0 orphan rows). Four rows (450–453, service 287, user 1) were a
  dummy demo campaign Arfeen made on 2026-08-05; he authorised their deletion and they are gone.
- ⚠️ **Service 287 still exists** and is NOT a shell — ~115 rows across 11 tables (60 hvcoTitles,
  14 placeholderValues, 11 heroMechanisms, 10 headlines, 9 adCopy, 6 campaignConcepts, plus ICP,
  offer, LP, email and WhatsApp). It now has **0 adCreatives** and is inert. Deleting the service row
  would cascade-delete the placeholderValues and orphan ~101 rows at `serviceId = NULL`. **Not done;
  needs its own decision.**

---

## 8. Gates

⚠️ **RECORD THE COMMAND, NEVER A BARE COUNT.** This section used to carry figures like "574 tests
green" with no record of which suites produced them. A number with no command behind it **cannot be
re-verified**, and on 2026-08-08 a fresh session lost a round trip proving exactly that: tsc
reproduced to the digit, the copy-engine set reproduced to the digit (442), and "574" turned out to
be unreconstructable because three different sessions had each used a different ad-hoc suite list.
Every count below now travels with the command that produces it.

**The canonical gate command for the copy engine + image sprint** (13 suites — run this, quote its
output, and update the number here when the suite list changes):

```
npx vitest run \
  server/pipeline-fixes.test.ts server/lib/complianceFilter.test.ts \
  server/_core/tokenCrypto.test.ts server/adCopyAngles.stageAware.test.ts \
  server/conceptGenerator.test.ts server/conceptValidator.test.ts \
  server/_core/pdafGate.test.ts server/headlinesTemplateTokens.test.ts \
  server/lib/adCreativeTeardown.test.ts server/_core/compositeShortHook.test.ts \
  server/_core/imageHookRedraft.test.ts server/sharedProcedureShapes.test.ts \
  server/_core/imageRenderer.test.ts
```

→ **556 passed across 13 suites** (re-measured 2026-08-11). It read **552** from 2026-08-08 and had
gone stale by four: the 4c harness rework touched none of these thirteen files, so the delta
predates it and the doc was simply behind. The six-suite copy-engine subset alone is **442**, which
is the figure §12.6 quotes.

**The 4c safety set** — `metaSafety` · `metaTeardown` · `publishLedger` · `multiAdPublish` ·
`adAssembly` · `adCreativeTeardown` · `operatorFields` · **`step4cPageAnswers`** ·
**`step4cRunState`** → **217 passed across 9 suites, 0 skipped** (2026-08-11). The last two are new
with the three-phase rework and are **39 of that 217**. Scanned for `.skip` / `.todo` / `.only` /
`xit` / `xdescribe`: none present in any of the nine, so nothing is silently excluded.

- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **34** (34 re-confirmed 2026-08-06 post-deploy after
  the §11 canvas fix, again 2026-08-08, and again 2026-08-12 either side of the min-2 floor)
  ⚠️ **ONLY THE COUNT 34 HAS EVER BEEN STORED — there is NO per-error baseline list anywhere in this
  repo.** So "the baseline held" can only ever mean the COUNT reproduced; it has never meant the same
  34 errors. Two errors could swap — one fixed, one introduced — and every gate in this file would
  pass. **If that distinction matters for a given change, capture the list BEFORE touching anything
  and diff it, because there is nothing to diff against after the fact.** A list was captured
  2026-08-12 to a session scratchpad as `tsc-now.txt`; ⚠️ **that path is ephemeral session scratch and
  will NOT survive**, so the command above is the only durable source. As at that capture the 34 sat
  in: `V2GeneratorWizard.tsx` 8 · `AdminDashboard.tsx` 7 · `V2LandingPageResultPanel.tsx` 3 ·
  `V2AdImageCreator.tsx` 3 · `admin.ts` 2 · `oauth.ts` 2 · then one each in `campaignKits.ts`,
  `autoMode.ts`, `landingPageHtml.ts`, `_core/index.ts`, `icpEnrichment.ts`,
  `V2WhatsAppResultPanel.tsx`, `ComplianceWarningPanel.tsx`, `AdminContentModeration.tsx`,
  `CampaignCreativesSection.tsx` — all pre-existing legacy/V2 files, none in the publish path.
- **554 tests across 12 suites**, including `server/textSafeZoneCoupling.test.ts`. The copy-engine
  gate set (`pipeline-fixes` + `complianceFilter` + `tokenCrypto` + `adCopyAngles.stageAware` +
  `conceptGenerator` + `conceptValidator`) = **442 passed**, re-run after the copy work.
- CLAUDE.md §8 gate suites re-run 2026-08-06: `pipeline-fixes` + `complianceFilter` + `tokenCrypto`
  = **407 passed**. Image suites = **108 passed** across 6 files.
- ⚠️ `jobs` is **NOT a baseline metric** — 24h retention. Only `running = 0` has signal.

---

## 8b. 🔴 `regenerateSingle` — the diagnosis was TOO NARROW (corrected 2026-08-06)

It was recorded as *"screenshot rows regenerate on Flux (no style passed) — one-line fix"*. Traced,
the omission at **`routers/adCreatives.ts:1078`** is real but has **two live symptoms, not one**, and
a third that turned out to be a non-issue worth writing down so nobody re-derives it.

The canonical call is `adCreativesGenerator.ts:621` — `{ prompt, style, aspectRatio: FEED_ASPECT }`.
`regenerateSingle` passed **none of the three**.

| # | symptom | live? |
|---|---|---|
| 1 | **Emits 1:1 while the four sibling cards in the deck are 4:5** — a regenerated card is a different SHAPE. `generateImage` defaults `aspect_ratio` to `"1:1"` (`imageGeneration.ts:265`). | 🔴 **yes, and the most visible** |
| 2 | **Wrong model** — `rendererForStyle(undefined, …)` returns Flux, so a stored `screenshot` row loses gpt-image-1 (bake-off **6/6 vs 2/6** on niche relevance). | 🔴 yes |
| 3 | "Text-safe band computed for the wrong canvas" | ⚪ **NO — inert. See below.** |

⚠️ **SYMPTOM 3 IS NOT REAL TODAY, AND THE REASON MATTERS.** `generateAdImagePrompt` has two assembly
paths. **PATH A early-exits at `if (!stageAction) return stylePrompts[known]`** (`:719-720`) before
`zonePersonFor`/`zoneStillFor` are ever called. Both of these sites pass **no awareness stage**, so
they take PATH A and the `aspectRatio` argument is **never read** — the band wording comes from the
static `compositionPerson` / `compositionSetting` constants. Passing the ratio into the prompt
builder is therefore correct-and-inert; it goes live the moment these sites are wired to pass a stage
(the open fan-out gap, §5.1).

🔑 **AND MOVING TO 4:5 IMPROVES THE LEGACY WORDING RATHER THAN BREAKING IT** — measured against §4's
table, not assumed. The static clause says *"The lower half"*:

| canvas | true reserved fraction | static clause says | error |
|---|---|---|---|
| 1:1 1024×1024 (**old**) | 0.571 | "the lower half" (0.50) | **7.1pp UNDER-reserved** |
| 4:5 Flux 896×1088 (**new**) | 0.505 | "the lower half" | 0.5pp under |
| 4:5 gpt 1024×1280 (**new**) | 0.495 | "the lower half" | 0.5pp **over** — safe |

So these two paths were carrying a 7-point prompt/compositor disagreement at 1:1 and land within half
a point at 4:5. **This is a side benefit, not the reason for the fix, and it is still not a render
proof.**

**Also folded in, because leaving them out would create a NEW defect rather than avoid one:**
`imageFormat` is now measured off the rendered buffer at both sites (`regenerateSingle` previously
never updated it; `generateAdCreativesBatch` hardcoded `"1080x1080"`, which becomes a bigger lie once
the canvas moves). **`FEED_ASPECT` moved to `_core/adVariations.ts`** — it was a local `const` inside
`runAdCreativesGeneration`, which is precisely why two sibling loops never got it, and is the exact
duplication class that module's docblock exists to prevent.

---

## 8c. META — VERIFIED STATUS, scoped read-only 2026-08-06

**⚠️ THIS SUPERSEDES EVERY EARLIER NOTE TREATING META AS UNBUILT OR REVIEW-BLOCKED.** The handover
line *"the generate → publish-to-Meta → run path … is the real gate, and it's separate work"* was
wrong about the reason. **The integration is FULLY BUILT. The blocker is an expired user token.**

- ✅ **The publish path is real, end-to-end — not stubbed.** `meta.publishToMeta`
  (`routers/meta.ts:240`) makes four live Graph **v21.0** calls in sequence: `createCampaign` →
  `createAdSet` → `createAdCreative` → `createAd`, each a real `fetch` POST in `lib/metaAPI.ts`. Full
  CRUD plus status sync, alerts and pause/resume. **The client is wired:** `PushKitModal.tsx:291`
  calls it; `V2Settings.tsx` carries the connect flow.
- ✅ **App config is present on prod:** `META_APP_ID`, `META_APP_SECRET`, `VITE_APP_URL` all set on
  Railway service `coachflow` / environment `production`. `META_APP_SECRET` is read at
  `_core/metaOAuth.ts:37` and `routers/meta.ts:162`, nowhere else, and is not cached in a module
  variable — but `process.env` is fixed at process start, so a value change needs the restart Railway
  performs automatically on save.
- ✅ **RESOLVED 2026-08-06 — THE TOKEN IS RECONNECTED AND LIVE.** The expiry blocker recorded here
  is CLEARED. Verified by direct read-only query against production (token value never selected):
  `meta_access_tokens` still holds **exactly one row**, `id=3`, `userId=1` — `tokenExpiresAt`
  **2026-10-05**, i.e. **valid, ~59 days of runway**, `lastRefreshedAt` **2026-08-06 13:36**, with
  both `adAccountId` and `pageId` present. Note the reconnect **updated the existing row in place**
  (`connectedAt` is still 2026-05-11); it did not insert a second one, so "exactly one row" remains
  the correct expectation.
  ⚠️ **This proves the token is stored and unexpired — NOT that a publish succeeds.** `getMetaToken`
  (`metaAPI.ts:79`) will now return a token instead of `null`, so the four Graph calls will actually
  be attempted for the first time. **The first real publish is still unproven live-fire.** If it
  errors, read the exact Graph error out of the Railway logs rather than guessing — the four calls
  fail with distinct messages (`Failed to create Meta campaign` / `ad set` / `ad creative` / `ad`),
  and which one fires localises the problem immediately.
- ✅ **`adSetId: "temp"` IS NOT A MISSING AD-SET ARCHITECTURE.** The real Meta ad-set id is stored
  correctly beside it as **`metaAdSetId`** (`meta.ts:419`), returned by the mutation and used by
  status sync. `adSetId` is the **internal CoachFlow** grouping nanoid (`schema.ts:1077`, matching
  `adCopy.adSetId`), so `"temp"` means only that the published row is not traceable back to the
  ad-copy set that produced it. **An internal traceability gap. It does NOT block running an ad**,
  and it is not evidence of an unbuilt ABO layer.
- ✅ **OWN-ACCOUNT PUBLISHING NEEDS NO APP REVIEW.** Meta grants an app's admins/developers/testers
  full permission on assets **they own** while the app is in Development Mode. Arfeen is the app
  admin and the ad account is his, so **App Review is NOT on the path to running his own ad** — and
  the two ads that published on 2026-05-12 are explained by this, rather than being evidence that
  review passed.
- 🔵 **Advanced Access review is a SEPARATE, UNSTARTED TRACK** — required only to onboard OTHER
  coaches (serving `ads_management` against ad accounts Arfeen does not own). Its status lives in
  Meta's App Dashboard and cannot be read from this repo; it needs Arfeen's login. **Do not conflate
  the two: nothing about that track blocks the first real ad.**
- 📌 `metaConnections` is a **dead table** — 0 rows, zero code references. Only `meta_access_tokens`
  is live. Do not read it.

**Plain answer to "to run one real ad, what is the blocker?"** — on Arfeen's own ad account:
**nothing is blocking it any more.** The token is reconnected, the config is present, the path is
built. No review, no config, no build. What remains is a live-fire test of an existing path, not new
work. Onboarding other coaches is the separate Advanced Access track above.

**What the first publish will do, read off the code — it does NOT spend by default.** `status`
defaults to **`PAUSED`** in two independent places: the zod input default (`meta.ts`, the
`publishToMeta` input schema) and the operator UI's initial state (`client/src/v2/PushKitModal.tsx`,
`useState<"PAUSED" | "ACTIVE">("PAUSED")`). The same status is applied to campaign, ad set AND ad.
The daily-budget field starts at **$20 USD** (minimum $1) and is only ever charged once something is
switched to `ACTIVE`. **A publish left on the defaults creates a real, genuinely-in-Meta but PAUSED
ad that spends nothing** — which is the correct shape for the first live-fire test.

📌 **Housekeeping, 2026-08-06 — DONE.** `META_APP_SECRET` was exposed in a session transcript by a
failed redaction and **has been rotated**; the Meta connection was re-established in the same trip
(see the token row above). Rotation point is the Railway variable named above; Railway redeploys
`coachflow` automatically on save.

---

## 9. Traps specific to this work

- **The old test asserting the stage directive is APPENDED was DELETED.** It passed throughout while
  the stage never reached the picture — it was locking in the defect. Do not reinstate it.
- **`rendererForStyle` bounces unknown ratios to Flux.** Requesting a ratio gpt-image-1 cannot serve
  silently moves the still life off the model the bake-off chose (**6/6 vs 2/6** niche relevance).
- **The banked safe-zone figures describe META'S UI clearance**, not our own type. Never size our
  text band from them — measure it.
- **Research vs. code:** `[AWARENESS-PLAYBOOK §2]` asks for proof charts, calendars and labelled
  diagrams at various stages. **All are composed of text.** The object slot was retired over exactly
  this (48 renders, 2 leaked). Three departures are documented on `AWARENESS_DEPICTION`. PD-4 stands.
- **`[AWARENESS-PLAYBOOK §4]` contradicts its own §3** — its table makes Action a function of style.
  §3 + §2 govern.

---

## 10. Standing rules

- **⛔ NO PUSH WITHOUT ARFEEN'S EXPLICIT "push" IN THE IMMEDIATELY PRECEDING MESSAGE.**
- **Every prod write needs explicit "execute"/"go ahead" in the immediately preceding message.**
- **A LIVE RENDER IS THE ONLY PROOF OF A LIVE IMAGE PATH** — and for anything involving the text
  overlay, **the COMPOSITE is the only proof**. The raw render passed while the finished ad was broken.
- **Save proof images to disk BEFORE any teardown.** Teardown outranks the artifact read.
- **⚠️ TEARDOWN IS NOT DONE WHEN THE DB RECONCILES — IT MUST CLEAR CLOUDINARY TOO, AND THE ORDER IS
  FIXED: READ THE public_ids, THEN DELETE THE ROWS.** A DB delete never touches Cloudinary, and once
  the rows are gone **the URLs are unrecoverable from the database** — the images stay hosted
  forever. `server/lib/adCreativeTeardown.ts` exists precisely for this and does the two steps in the
  correct order; its docblock records the 30 orphans that accumulated across three runs on
  2026-07-29 before it was written.
  **This rule is here because CC broke it on 2026-08-06** — `scripts/regen-canvas-proof.ts` deleted
  its two rows directly, reported "405 ✅ RECONCILED", and left 4 orphans (raw + composited × 2). A
  green reconciliation line said the run was clean when it was not.
  **Recovery, if it happens again:** the ids can still be recovered from Cloudinary by listing —
  but use `cloudinary.search` sorted by `created_at desc`, **NOT `api.resources()`**, which caps at
  500 per page in no useful order and returned zero matches on the first attempt.
  `scripts/sweep-regen-canvas-orphans.ts` is the worked example (dry-run by default, pattern-scoped,
  refuses to delete unless the match count is exactly what was expected).
- **Do NOT write to protected services 272–277, or to service 285.**
- **⚠️ TEARDOWN IS ALWAYS ID-SCOPED, NEVER USER-SCOPED.** Smoke user **117174 OWNS the 25 protected
  creatives on services 272–277** (verified 2026-08-06). A teardown written as "delete this user's
  rows" would destroy them. Always `WHERE id IN (…)` plus a userId guard — never userId alone.
- **Write prose-heavy records with Write/Edit, never a bash heredoc** — backticks get shell-substituted.
- **⚠️ ONLY THE TABLOID DECK IS 4.** `EDITORIAL_VARIATIONS` stays 5.
- **Untracked earlier-session files are deliberately left alone: 331 as at 2026-08-12.** Never sweep
  them into a commit — `git add -A` / `git commit -a` is always wrong in this repo. Stage named
  paths only.
  ⚠️ **CORRECTED 2026-08-12 — this line used to say "539 … and it only ever grows". BOTH HALVES WERE
  WRONG.** It reads **331** now, DOWN from 539 on 2026-08-06, so something cleared proof files
  between those dates and the "only ever grows" claim is false. **Do not treat any count here as a
  tripwire** — a drop is not evidence of a deletion incident and a rise is not evidence of a leak;
  these are untracked proof screenshots, not tracked state. The count is a point-in-time
  observation. **The rule that matters is "stage named paths only", and it does not depend on the
  number.**
- **`railway run` block-buffers stdout.** Two runs today were invisible for 25 minutes while failing.
  Proof scripts log to a file with `appendFileSync` as well as stdout — keep that.
- **`MYSQLHOST`/`MYSQLPORT`/`MYSQLPASSWORD` are NOT set on the prod service.** Only `DATABASE_URL` is.
  Parse it (`python3 -c "urllib.parse.urlparse(os.environ['DATABASE_URL'])"`) and pass the parts to
  `mysql`; the CLAUDE.md §10 snippet using `$MYSQLHOST` fails with *"Empty value for 'port'"*.
- **The Drizzle key is not the table name.** `metaPublishedAds` in `schema.ts` is **`meta_published_ads`**
  in MySQL — querying the JS key errors with *"table doesn't exist"*. §9 of CLAUDE.md, in the wild.

---

## 11. ✅ SHIPPED — the two-site canvas + routing fix (2026-08-06), PROVEN LIVE

**Files:** `_core/adVariations.ts` (adds `FEED_ASPECT`) · `adCreativesGenerator.ts` (imports it, same
value, zero behaviour change) · `routers/adCreatives.ts` (the two call sites) ·
`sharedProcedureShapes.test.ts` (routing assertion **inverted** — it previously pinned the defect on
purpose, with a comment saying it was pinned "so the fix is a deliberate, visible change").

**Gates:** tsc **34**, six image suites **108 passed**, gate suites **407 passed**.

### Proven on prod, not on tests — `scripts/regen-canvas-proof.ts`

The harness calls **`appRouter.createCaller(ctx).adCreatives.regenerateSingle(...)`** — the real tRPC
procedure including its `setImmediate` background body. It does **not** re-implement the sequence; a
rebuilt sequence would prove the harness (STANDING RULE 2). Two labelled throwaway rows created and
regenerated, so **no pre-existing row was read-modify-written**.

| row | style | renderer | emitted | `imageFormat` written |
|---|---|---|---|---|
| 460 | `screenshot` | **gpt-image-1** (24.7s) | **1024×1280** | `1024x1280` ✅ |
| 461 | `person_shocked` | **flux-1.1-pro** | **896×1088** | `896x1088` ✅ |

Both rows were seeded with the old `1080x1080` lie and the fix overwrote each with true emitted
dimensions. **The person slot correctly STAYED on Flux** — a fix that moved every style would have
been a regression, not a fix. Images: `docs/screenshots/run-2026-08-06-regen-canvas/`.

**Reconciled:** `adCreatives` 405 → 407 → **405**, running jobs **0**, Cloudinary swept 4/4.

### ⚠️ Judged by Arfeen, and one thing is NOT fixed by this

The person card is clean — face entirely clear of the headline. **On the still life the headline
crosses the laptop screen and mug while the top ~45% is empty wall**: the legacy PATH A clause says
*"the main object sits high in the frame"* and the model did not obey. **This fix neither caused nor
cured that** — these paths were already on the legacy composition at 1:1, and there is no 1:1
before-shot from this path to compare against. Logged as a separate prompt-adherence issue on the
legacy still-life composition. Approved for ship by Arfeen on the pixels.

---

## 12. ✅ THE COPY ENGINE — built, PROVEN LIVE, committed LOCAL ONLY (not deployed)

The copy equivalent of the image chapter. Same discipline: a researched rule, applied in the
generator, judged against real produced output — not a green test.

**Research + spec are banked in git** (commit `d9dc69c`): six NotebookLM reports at
`docs/andromeda/copy-research/`, plus the build spec, the alignment audit and the as-built
description at `docs/andromeda/`. The build spec's §8a records the settled product decisions.

### 12.1 The rule everything serves

From `docs/andromeda/copy-research/Andromeda_Copy_EntityID_Distinctness.md`: two pieces of copy are
genuinely different to Meta only if they differ on **at least two of four** dimensions — **P**ersona,
**D**esire, **A**wareness, **F**ormat. Differ on 0 or 1 and Meta collapses them into one Entity ID
with one auction ticket. **The gate is this categorical 2-of-4 check. It is NOT a cosine score** —
the 0.40 figure that appears in the audit comes from a local model that is not Meta's, and the
audit contradicts itself on it (its own evidence-hygiene section excludes static thresholds).

### 12.2 What was measured — the whole point of this chapter

Phase 0 baseline, measured on production before any change: **69–71% of all copy pairs collapsed**;
both headline populations were at **100%**.

| population | no stage | stage + format | **+ desire (now)** |
|---|---|---|---|
| Node 6 headlines | 100% | 42.3% | **19.4%** |
| Node 7 headlines | 100% | 37.1% | **17.1%** |
| Node 7 bodies | — | 26.7% | **13.3%** |
| fused surfaces (headlines + bodies) | — | — | **17.2%** |

All figures MEASURED on live generated decks against the stamped columns, never estimated.

**Three of four axes are live: awareness, format, desire. Persona is still pinned** — one ICP means
one target market across a whole deck, and the concept engine pins it too (`conceptGenerator.ts`
sets `personaLabel` once from the ICP). Before desire landed, no pair anywhere could exceed TWO
differing axes; the live decks now show pairs at three, which is what proves the axis is real
rather than a label.

### 12.3 What is built and proven

1. **Node 6 — awareness stage** (`headlinesGenerator.ts`). Accepts an optional stage; otherwise
   distributes the set across stages via `awarenessPlanForCount`, the same cold-weighted allocation
   ad copy uses. **Planned across the WHOLE SET and dealt to the formulas, never per formula** —
   per-formula planning left 10 zero-axis pairs and starved product_aware of every slot.
   Stage guidance is the Headline (Intrigue) column of `[COHERENCE §2]`, kept in `adCopyAngles.ts`
   beside the Primary-Text column so the two halves of one research table cannot drift.
2. **Node 7 — awareness on all surfaces + three-surface chaining** (`adCopyGenerator.ts`).
   Headlines and links now carry a stage (they carried none). The three surfaces are generated as a
   CHAIN: headline first, then the body paired with a same-stage headline and told not to restate
   its nouns and verbs and to open on the priming words, then the link description aware of both.
3. **The desire axis, durable and early** (`conceptGenerator.ts`, `routers/campaignKits.ts`).
   Concept generation moved from the ad-copy entry to **campaign-kit creation**, four nodes earlier,
   made durable with a deterministic per-ICP job id, and left non-blocking. Both copy nodes read the
   concept set's desires and deal them across their slots.

### 12.4 Decisions LOCKED (do not reopen without Arfeen)

- **Cardinality target is 8** — proven on COPY only. **Image growth 4 → 8 is deferred** to its own
  sprint. Do not ship 8 copy angles against 4 images: two ads sharing a picture re-collapse, which
  is exactly what the image chapter was spent eliminating.
- **Variation counts are configurable** (`_core/variationCounts.ts`), defaults reproducing the old
  behaviour exactly. **The cut happens AT THE GATE, never by generating fewer** — the gate needs a
  surplus to reject from.
- **Link descriptions are OUT of the distinctness population.** A 30-character CTA surface is not
  one of the three fused surfaces (image / headline / body), so link-vs-link collapse is not a real
  delivery signal. They keep the awareness stamp for coordination and are never counted.
- **Anti-echo must be DECK-WIDE at the gate, not pairwise.** Publishing recombines headlines and
  bodies, so complementarity has to hold across the combinations that can actually ship — not just
  the 1:1 pair generation happened to produce.
- **Yield is handled by OVER-GENERATING and by biasing proof-less coaches toward proof-free angles.
  Never by padding** a batch to hit a number.
- **The gate compares axes ASSIGNED at generation, never inferred from finished text.**
  `format` reuses the formula (Node 6) or angle (Node 7) each piece was already written to — no
  parallel taxonomy.

### 12.5 Open items

- **Node 6 still shows 3 zero-axis pairs.** Pigeonhole, not a defect: 25 headlines over 20
  (stage × formula) cells must repeat. **Retired by the volume trim** when counts drop to the
  budget band. Node 7's equivalent went 3 → 0 once the whole-set dealing was ported to it.
- **Node 6 falls back to a single desire on the no-service path.** It resolves an ICP only when a
  serviceId is supplied; without one there are no concepts. The fallback is the pre-change
  behaviour, so nothing regresses. **Whether that entry SHOULD resolve an ICP is a product call**
  — it means either demanding a service or guessing which ICP a headline set belongs to.
- **Concept yield is not guaranteed to equal the ask.** A launch-stage fixture asked for 8 and kept
  **4**: the gate blocked all 8 first-pass (`invented_testimonial`, `unearned_authority`), recovered
  none on retry, kept 4 on the per-concept pass. A coach with no proof makes the model reach for
  proof it does not have. This is the yield the over-generate decision above exists to absorb.

### 12.6 ✅ THE GATE — BUILT, PROVEN LIVE ON BOTH NODES, COMMITTED LOCAL ONLY

**Not deployed.** Committed locally with the rest of the copy chapter; the next push needs a fresh
explicit "push" from Arfeen like every other deploy.

`server/_core/pdafGate.ts`, with the comparator moved from `scripts/` to `_core/pdafDistinctness.ts`
unchanged — it was written to make that move. Four stages in order: **evict** (max-degree greedy,
ties to the later item so runs are reproducible) → **regenerate** (capped, reusing
`COMPLIANCE_RETRY_MAX_ATTEMPTS`, no new ceiling) → **deck-wide anti-echo** → **trim to band**.

Settled by Arfeen 2026-08-07: band defaults to **small (8-12) as an explicit setting, never inferred
from a Meta daily budget**; Node 6's no-service path keeps its single-desire fallback; anti-echo
starts at a **shared three-word run, labelled a tunable heuristic in code**. The **2-of-4 categorical
rule is the sole authority** — no score in the module decides pass or fail.

#### Proven live on production, measured off the stamped 0097 columns

| run | node | before | after | ledger | composition |
|---|---|---|---|---|---|
| `vO1S7PVlm6G6EM76qYMX2` | 7 | 35 pairs (7.5%) | **0 (0.0%)** | evicted 19 · recovered 7 · **dropped 12** | 🔴 11 headlines / 1 body |
| `kxIJSJURbLVZ7SPpleBX0` | 7 | 35 pairs (7.5%) | **0 (0.0%)** | evicted 19 · **recovered 19** · dropped 0 | ✅ **6 / 6** |
| `XBNb-yre_-dTkWGxDxFx9` | 6 | 29 pairs (9.7%) | **0 (0.0%)** | evicted 13 · recovered 8 · dropped 5 (all honest) | 12 kept, **11 landed** 🔴 |
| `BcqE6DizGMUFkpNY4XWi5` | 6 | 22 pairs (9.5%) | **0 (0.0%)** | evicted 10 · recovered 6 · dropped 4 (all honest) | ✅ 12 kept, **12 landed** |

Every run: fresh labelled throwaway with a real ICP and 8 concepts (so **desire was genuinely
live**, not the deck-constant fallback), id-scoped teardown, all four baselines reconciled to
**adCopy 5424 · headlines 2174 · adCreatives 405 · running jobs 0**. No images rendered on any run,
so Cloudinary was never involved.

**Deck-wide anti-echo is proven live, not just on fixtures.** Run 2 caught **3 echoes, all against a
NON-PARTNER headline** (`"scope first sequence"`), zero against a body's own generation partner —
cases pairwise checking could not have found. The gate records `wasPartner` per finding so this is
mechanical rather than argued. Run 1 reported it **NOT DEMONSTRATED** and was reported that way.

#### Two defects the first run exposed, both fixed and re-proven

1. **Fall-through tested the POOL, not the OUTCOME.** All 19 evictions chose `desire`; 12 died on it.
   With persona pinned and format fixed, moving desire alone yields at most two differing axes, and
   against a survivor sharing awareness AND format it yields one — so the redraft collapsed again and
   the loop burned all three attempts on an axis that could never separate it.
   **Fixed:** candidate moves are now SIMULATED against every survivor before any model call, and
   only a combination that clears the rule is returned; two-axis moves are tried when no single axis
   works. Nodes declare what they can move (`pools.movable`). Result: **19/19 recovered, 0 dropped.**
2. **Trim was blind to surface role** and kept 11 headlines / 1 body — safe under 2-of-4 and
   unshippable. **Fixed:** round-robin quota across surfaces (6/6 at band max 12), slack flowing to
   whichever surface still has pieces; separation still decides WHICH survive, not how many of each.

⚠️ **They were masking each other** — run 1 showed no echoes because it kept one body. The trim fix
is what made Verdict B measurable.

#### Node 6 ordering, settled 2026-08-07 (was documented, now fixed)

Node 6 had **no blocking compliance pass of its own** — `checkCompliance` only SCORES — so the real
block was `gateBeforePersist` running AFTER the gate. Measured: the gate kept 12, the backstop then
dropped 1 for `promised_result`, 11 landed. **Reordered** to match Node 7 and the design, using the
same `checkOutput` + grounding corpus so the two cannot disagree; scope matches the backstop exactly
(skips without a `serviceId`). Live: `blocked 3/25 headlines before the distinctness gate`, and
ledger KEPT = DB rows = returned count = **12**. No headline retry, matching Node 7's measured
decision that a 40-character headline has too little room for a redraft to change a verdict.

#### Three coach-facing accuracy bugs fixed alongside

- `runHeadlinesGeneration` returned the **pre-gate** count; `runAdCopyGeneration` counted off the
  **pre-distinctness** array. Both would have told a coach the deck was larger than the database
  holds. `createHeadlines` now returns what it actually persisted and both generators report that.
- Concept telemetry logged the impossible `generated=8 … kept=10` because it still used `count`
  after the 1.5x over-generation landed. Now uses `overGenerateCount`.
- **Template-token leak (pre-existing).** Two of eleven persisted headlines shipped
  `[INSERT_AUTHORITY_TITLE] Revealed What…`. The token is *sanctioned* — the fabrication rule offers
  bracketed placeholders as a legal alternative to inventing a credential — but nothing ever
  RESOLVED it before write. Now resolved from `services.pressFeatures`, else generic role framing
  that claims no credential, never the raw token. Live: `resolved 10 unfilled template token(s)`.
  ⚠️ **Forward-only.** 216 legacy headline rows still carry raw tokens; Arfeen's call 2026-08-08 is
  **no backfill** — they are dummy data and go in the pre-launch clean-slate wipe.

#### Yield fix, under real stress

Concepts hit a **100% first-pass block rate** (`invented_testimonial`, `unearned_authority`) on the
Node 6 run and the 1.5x over-generation still delivered a full set of 8. That is the tail it exists
to absorb. Never pads — a short set ships short and says so.

#### Gates at commit

`tsc --noEmit` → **34** (baseline held, zero new). **547 tests across 10 suites**, including 32 in
`_core/pdafGate.test.ts` and 8 in `headlinesTemplateTokens.test.ts`. Both fix families carry
regression tests that fail against the old behaviour.

#### Still open

- **Node 7's `movable` is all three axes and its format moves are unexercised live** — every Node 7
  recovery so far landed on desire or awareness. The path is unit-tested only.
- **`sweepAdCreativeBatch` still has no userId guard** — see §12.7a. Blocks the image sprint's
  teardown, not this chapter.

### 12.7 The image-baked-text duplication — for the image sprint

The compositor bakes in the headline AND `bodyText`, which is **the first 140 characters of an
ad-copy body row**, taken verbatim from the same table the published primary text comes from. So the
text Meta's OCR reads off the picture is a truncation of the body's opening — the exact
repeat-across-surfaces case the research names as collapse-inducing, live today.

**Decided:** the image surface gets its OWN short hook line. Do NOT solve it by constraining the
body's opening — the body's first words are the priming real estate and must stay free.

**No OCR pre-pass is needed for our own ads.** We bake the text in, so we already know the string.

### 12.7a ✅ RESOLVED — `sweepAdCreativeBatch` userId guard (see §12.11 step 1)

**Noted 2026-08-07, FIXED 2026-08-08.** Kept here as the record of what was wrong; the fix and its
23 tests are described in §12.11 step 1. Original diagnosis below.

`server/lib/adCreativeTeardown.ts` → `sweepAdCreativeBatch(db, batchId)` is scoped by **`batchId`
alone**. The file contains **zero references to `userId`** — verified by grep, count 0. Both the
Cloudinary sweep and the row delete run off `eq(adCreatives.batchId, batchId)` and nothing else.

This contradicts the standing rule in §10: *"TEARDOWN IS ALWAYS ID-SCOPED, NEVER USER-SCOPED …
Always `WHERE id IN (…)` plus a userId guard."* The module gets the ORDER right (read public_ids,
then delete rows — the thing it was written for) and gets the COLUMNS right (it sweeps both
`imageUrl` and `rawImageUrl`, which is the raw + composited pair, the "4 orphans" case). What it
lacks is the guard.

**Why it matters here specifically:** smoke user **117174 owns the 25 protected creatives on
services 272-277**, plus 285. A wrong, stale or reused `batchId` would delete outside its intended
scope with nothing in the function to stop it. `batchId` is a nanoid, so accidental collision is
implausible — this is a missing seatbelt, not a live bug, and no run has been harmed by it.

**Not a risk to the COPY chapter.** The copy proofs render nothing and never call this function.
It becomes load-bearing the moment the image sprint starts tearing down rendered creatives.

## 12.11 THE IMAGE SPRINT — steps 1 and 2 DONE, nothing applied, nothing proven live

**State at 2026-08-08: 0098 AND 0099 APPLIED to production. Steps 1-2 proven live. Two further
fixes built and proven live. Committed locally, NOT deployed.** Gates: tsc **34**, **552 passed
across 13 suites** — via the §8 command, not a bare count.

### What the 2026-08-08 live proofs actually established

- **Migration 0098 applied.** `adCopy.contentType` is now four values; 5424 rows unchanged
  (1714 headline + 1997 body + 1713 link). **0099 applied** the same way: `adCreatives.sourceImageUrl`
  varchar(500) NULL, 405 rows unchanged. Both additive and inert, exactly like 0097.
- **Step 2 proven, then found broken, then fixed.** The first run persisted hooks of
  **74/92/114/127 chars** against a 60-char ceiling — every surviving hook had been gate-recovered,
  and the gate's `regenerate` callback branched on `isBody`, sweeping `image_hook` into the HEADLINE
  branch: wrong voice, and the ceiling applied only on first generation. The compositor ellipsised
  them over the picture. **Fixed** (`redraftSurfaceFor` / `buildHookRedraftInstruction` /
  `clampHookText`, all module-scope and shared by both call sites) and **re-proven live**: five
  hooks at **53/59/56/59/51**, in hook voice, no mechanism-name repetition. 18 regression tests pin
  the four real oversized strings.
- ⚠️ **THE DECK IS NOT SHIPPABLE AND THAT IS THE OPEN ROCK.** Run 2 kept **6 headlines / 5 hooks /
  1 body**. Not the trim — **15 of ~17 bodies were dropped at the cap**, every one "no axis move
  clears 2-of-4", so trim had one body left to rebalance. All 38 evictions chose `desire`. Cause:
  one shared band of 12 across three surfaces, with persona pinned and only 8 desires, so hooks and
  bodies compete for the same distinct cells. **Settled by Arfeen 2026-08-08: distinctness is judged
  WITHIN each surface, not across** — a headline and a body are surfaces of ONE ad, meant to be
  coherent. The deck-wide anti-echo stays cross-surface, unchanged.
- **The `…HOW IT…` line was NOT the copy engine.** The image engine has its own headline source;
  with none passed it falls back to `HEADLINE_FORMULAS`, whose `benefit` formula is
  `${MECHANISM}: HOW IT WORKS` — 38 chars against a 37-char fitter, so `fitTitle` always ate
  "WORKS". Auto Mode never had this (it passes contextual headlines); **only the wizard path did**.
  Fixed at that one call site, with a try/catch falling back to the templates rather than turning a
  cosmetic defect into a failed generation. Proven live: 34/33/35/35 chars, none truncated.
- **Sweep completeness (0099) proven END-TO-END.** Every render makes THREE Cloudinary objects; the
  sweep could only ever see two, so one leaked per render — confirmed by listing: 4 orphans from the
  first proof run and 4 from the second, **8 legacy orphans outstanding**, needing the pattern-scoped
  listing sweep. After the fix the sweep resolved **12 ids across 4 rows** and the post-teardown
  Cloudinary listing showed **all four intermediates GONE — zero orphans from that run**.
- 📌 **The manual wizard image path is UNGATED** — it does not run through the distinctness gate at
  all, which is why its four cards share one small line. Noted 2026-08-08, **not this sprint's
  concern**, and a separate future question from the per-surface work.

### Settled decisions (Arfeen, 2026-08-07/08)

- **`image_hook` JOINS the distinctness population.** It is one of the three surfaces Meta fuses
  (image text / headline / body), which is the exact test the link-exclusion uses to justify
  excluding a 30-character CTA. So it is counted, unlike links.
- **Image stage and desire come from the CONCEPT ROWS** (sprint step 3), replacing
  `awarenessDeckPlan` at eight. This is what dissolves the hole described under step 4 below.
- The style-list extension and the arity audit ride with the 4 → 8 step, not before it.

### ✅ Step 1 — the `sweepAdCreativeBatch` userId guard (was §12.7a)

`userId` is now a **required positional parameter**, and `and(batchId, userId)` is applied to
**both the read and the delete** — guarding only the read would report the right rows and delete
the wrong ones. An optional guard is one a caller forgets, and this function deletes rows whose
Cloudinary URLs are unrecoverable the moment they go.

**Plus a hard refusal that is independent of the guard.** `PROTECTED_SERVICE_IDS`
(272-277, 285) is checked against the RESOLVED ROWS — not the arguments — and throws
`ProtectedServiceError` before touching Cloudinary or the database. It cannot be folded into the
userId check, because **user 117174 legitimately OWNS services 272-277**: a wrong-but-same-user
batchId passes the guard cleanly, and that is precisely the case this catches.

**23 tests.** The fake db records the SQL scope it is handed, so the assertions are about what the
helper actually asks the database to do rather than what its comments claim. Includes: mismatched
userId deletes nothing and never calls Cloudinary; the delete scope carries both keys; one case per
protected service; refusal fires even when the userId guard passes; refusal happens BEFORE
Cloudinary. The pre-existing five `publicIdFromUrl` cases are preserved verbatim — they pin the
`.png.png` double-suffix behaviour that made the 2026-07-29 orphan recovery possible.

**No production callers** — the only mention anywhere is a comment in
`scripts/sweep-regen-canvas-orphans.ts` explaining why that one-off does not use it.

### ✅ Step 2 — the baked-text fix (built; NOT proven live)

The compositor was handed `bodyText` from `resolveAdBodyTexts`, which truncates an ad-copy BODY row
to 140 characters — so the string Meta's OCR read off the picture was the body's opening, verbatim.
The same words on two of the three fused surfaces. Live in production today.

- **`drizzle/0098_image_hook_content_type.sql`** — widens `adCopy.contentType` by one value.
  Travels alone. Additive and inert: every existing row stays valid.
- **Node 7 generates the hook as its own chained surface**, told the build spec §3 division of
  labour explicitly (picture = the feeling, headline = proof/mechanism, body = context) and to use
  different words from both. 60-char ceiling enforced in code as well as the prompt — a model
  running long would push text into the band the renderer was told to keep clear.
- **Stamped with all four P.D.A.F. axes**, because it is written by the generator that assigns
  them. Generating it image-side would mean re-deriving axes that already exist, which is the
  fake-diversity failure this chapter exists to remove.
- **GATE WIRING CONFIRMED ZERO-CHANGE.** `partitionPopulation` excludes only links, so hooks are
  counted; and `"image_hook"` was ALREADY in the anti-echo default `targetRoles` with a passing
  test written before the surface existed. `pdafGate.ts` is untouched by this step.
- **The compositor prefers hook rows and FALLS BACK to the body truncation** when none exist. Kept
  deliberately: every service generated before 0098 has no hooks, and must still composite rather
  than render a picture with no text on it. The fallback is the old behaviour exactly.

**`fitLines` at short strings — checked, not assumed.** The layout is fully derived
(`bodyBlockH = lines × lineHeight`, with empty-case guards on both the headline and pill gaps). A
hook fits at FULL size on ≤2 lines with no shrink and no ellipsis on both real canvases, and always
produces a SHORTER block than the body it replaces — more clear picture, and the text-safe band was
measured at worst-case content. 8 tests (`compositeShortHook.test.ts`), including the empty case and
the 60-char worst case.

⚠️ **Two things the type system forced out, both decisions rather than omissions:** `image_hook`
needed the **short** compliance role (it was falling through to body-prose handling); and the
compliance-REWRITE tables type on their own narrower enum, so hooks are excluded from rewriting
rather than adding a second migration — matching the measured decision that short fields are never
retried.

### ✅ PER-SURFACE DISTINCTNESS — BUILT, PROVEN LIVE ON BOTH NODES, COMMITTED LOCAL ONLY

**Settled by Arfeen 2026-08-08: distinctness is judged WITHIN a surface, never across.** Meta
collapses whole ADS, and an ad is the fused triple of image text / headline / body — so two
headlines competing is a real delivery signal, while a headline "colliding" with the body it only
ever ships ALONGSIDE is not. The deck-wide anti-echo stays CROSS-surface, unchanged.

**What the shared band was doing.** Live run 2026-08-08 (adSet `NUTz86js4K4fovKp0ZxT1`) kept
**6 headlines / 5 hooks / 1 BODY**. Not a trim failure — **15 of ~17 bodies were dropped at the
cap**, every one "no axis move clears 2-of-4", so trim had one body left to rebalance. Persona
pinned + 8 desires = a finite supply of distinct cells, and the surface generated in the largest
quantity lost the race. A deck with one body cannot ship.

**After, measured on TWO independent live runs:**

| run | headline | body | image_hook |
|---|---|---|---|
| `qAGvRhVPiLdDjpGDm-fUW` | 12 kept, 5 evicted, **5 recovered**, 0 dropped | **12 kept**, 6 evicted, **6 recovered**, 0 dropped | 4 kept, 11 evicted, **0 recovered**, 11 dropped |
| contextual-headline rerun | 12 kept, 4 evicted, **4 recovered**, 0 dropped | **12 kept**, 4 evicted, **4 recovered**, 0 dropped | 4 kept, 11 evicted, **0 recovered**, 11 dropped |

Bodies 1 → 12. Every surface at or above floor, zero collapsing pairs anywhere.

**Node 6 re-proved live at parity — and the first result was a false alarm worth recording.**
`pdaf-node6-proof.ts` passes NO serviceId, so the generator resolves no ICP, finds no concepts, and
falls back to a SINGLE deck-constant desire. With persona pinned, desire constant and Node 6 unable
to move format, only awareness can move: one axis cannot clear 2-of-4, so `recovered 0` is FORCED,
and `KEPT 4` is the ceiling (4 awareness stages). Its collapse-BEFORE of **127 pairs / 42.3%**
reproduces the documented baseline exactly, which is what proves the population and comparison are
unchanged. `pdaf-node6-icp-proof.ts` was written to build the §12.6 configuration (service + ICP +
concepts, live desire) and returned **KEPT 12 / band 8-12 ✅**, matching §12.6, with one surface in
the ledger, per-surface equal to aggregate, and ledger KEPT equal to the rows in the database.
⚠️ **Never compare a no-service Node 6 run against §12.6 and call the difference a regression.**

**Also in this commit:**
- **The hook's format IS its surface.** `format` off the hook's movable axes — the gate was stamping
  `pain_agitation` and `story` onto hook rows.
- **Anti-echo gained hook OPENINGS as a source** (`openingRoles` was `["body"]`, so a hook echoing
  another hook was structurally invisible) **and `rewriteEcho` now handles hook rows** — without
  that second half the new detection would find echoes and silently discard them.
- **The hook-regeneration fix**: the gate's `regenerate` branched on `isBody`, sweeping `image_hook`
  into the HEADLINE branch — wrong voice, and the 60-char ceiling applied only on first generation.
  All four hooks on the first live run were gate-recovered and came back at **74/92/114/127 chars**,
  ellipsised over the picture. Now `redraftSurfaceFor` / `buildHookRedraftInstruction` /
  `clampHookText`, module-scope and shared by both call sites.
- **The proof harness passes contextual headlines**, mirroring the cascade. It previously fell
  through to HEADLINE_FORMULAS and baked `THE SCOPE-FIRST SEQUENCE: HOW IT…`, which read as a render
  defect but was the harness taking a path no production caller takes any more.

### 🔴 THE 4 → 8 HOOK BLOCKER — measured twice, do not build over it

`image_hook` shows a green tick only because its floor is 1. Underneath, on BOTH runs: **11 evicted,
0 recovered, 4 surviving.** The hook surface's natural distinct capacity is **exactly 4** — today's
deck size, so nothing looks wrong. At eight it falls short, and recovery cannot rescue it: with
persona pinned and format now fixed, a hook has TWO movable axes against a two-axis threshold, so
any hook pair sharing desire and awareness is unrecoverable by construction. **This is the cost of
the format-taxonomy fix, accepted deliberately.**

⚠️ **The proposed relaxation — hold hooks to anti-echo only — rests on a premise that DOES NOT
HOLD.** Verified 2026-08-09: `adCreatives` has **no persona/desire/awareness/conceptId/icpId
column**, so the image contributes **ZERO** categorical axes; awareness shapes the shot at prompt
time and is discarded. And there is **no ad-assembly step at all** — `publishToMeta` takes one
headline, one body, one image and creates one ad, so nothing computes ad-level distinctness. Ad-level
2-of-4 holds only CONDITIONALLY: for two ads using a different headline AND a different body from
the gated pool. Resolve the publish path and image→concept first.

### 🔴 Remaining, in order

1. **Apply 0098**, then **run `imagehook-proof.ts`** — renders real composites for Arfeen to judge.
2. **Tie images to concepts, at FOUR slots first.** ⚠️ The comment at `adCreativesGenerator.ts`
   saying *"adCreativesGenerator has no icpId, and ensureConceptsForIcp is fire-and-forget, so a
   lookup here would be a race"* is **STALE ON BOTH HALVES**: the cascade caller has `input.icpId`
   in scope (`orchestration.ts:961`) and simply does not pass it, and concept generation moved to
   kit creation four nodes earlier in `e91c13d`, so by cascade step 9 the concepts have existed
   since before step 1. This is threading one argument, not building a lookup.
3. **Grow 4 → 8**, with the arity audit. ⚠️ **THE REAL RISK IN THE WHOLE SPRINT SITS HERE.**
   `awarenessDeckPlan` returns distinct cold stages only while `slots <= 4` and DEFERS to
   `awarenessPlanForCount` above that — so at 8 it silently swaps a distinct-stages guarantee for
   the proportional 3/3/1/1/0 mix, giving three `unaware` slots. `unaware` has
   `FACE_ABSENT_AFFINITY = 0` and is **never eligible** for the visibility tier, so those repeats
   cannot be rescued. Nothing throws, no test fails, and the deck looks fine until Meta collapses
   it. **Doing step 2 first is what defuses this**, because concept-driven stages replace that call.
   Also: `AD_VARIATIONS` has 4 entries over 4 styles and needs 8; and its docblock records two call
   sites that hardcoded `i < 5` and would have crashed on the coach's Generate button — audit every
   consumer for derived-vs-hardcoded arity.
4. **Then deploy.**

### Explicitly OUT of scope (unchanged, and none blocks the above)

`generateAsync`'s 1:1 emit · `makeVertical`'s missing aspectRatio (inert, takes PATH A) · the
editorial engine and its 5 variations · the legacy orphaned Cloudinary objects · the 5-of-8 fan-out
sites that pass no stage.

### 12.8 Proof + audit tooling (all read-only or teardown-safe)

- `server/scripts/pdafDistinctness.ts` — the pure 2-of-4 comparator (gate-bound)
- `server/scripts/pdaf-collapse-audit.ts` — read-only Phase 0 baseline over existing prod rows
- `server/scripts/pdaf-node6-proof.ts` · `pdaf-node7-proof.ts` · `pdaf-step1-proof.ts` ·
  `pdaf-desire-proof.ts` — live proofs, each printing an id-scoped teardown it does NOT execute

### 12.9 Traps this chapter added

- **`serviceId` is load-bearing on `ensureConceptsForIcp`.** Without it no grounding corpus is built
  and the output gate — fail-closed by design for concepts — refuses all three attempts with
  `fabrication_check_unavailable` and writes nothing. The first version of the kit-creation trigger
  omitted it and generated ZERO concepts while reporting a clean "enqueued". The gate was right.
- **Concept generation takes minutes, not seconds.** 8 concepts × 3 gate attempts plus a
  per-concept solo pass. A 240s poll window timed out on a job that was alive and later completed;
  combined with `railway run`'s block-buffered stdout the run looked like a durability failure and
  was not. Poll for 10 minutes.
- **The concept job stays `pending` and never moves to `running`, deliberately.** The reaper sweeps
  `pending` older than 5 minutes; `running` is never swept, which is exactly how a dead job becomes
  a permanent zombie blocking every retry. A false "failed" on a slow-but-alive run is harmless —
  the rows still land and the next call returns "exists".
- **Kit creation is the earliest SAFE concept trigger.** `icps.sharpenWithLadder` regenerates a
  profile in place and is documented as sitting "BEFORE the kit exists, so nothing downstream has
  consumed the ICP yet". Triggering at ICP creation would make a sharpen leave a stale concept set.

### 12.12 Teardown ledger — 2026-08-09, all four proofs cleared

Torn down and reconciled EXACTLY to baseline: adCopy **5424** · headlines **2174** · adCreatives
**405** · running jobs **0**. Protected verified per service, not in aggregate:
`272:5 273:5 275:5 276:5 277:5 285:4` = **29**, all seven service rows present, never touched — the
refusal never needed to fire because every batch resolved to services 301/303.

- Node 7 per-surface — service 301, ICP 275, batch `batch-1786213463599-60a8e800`
- Node 7 contextual-headline — service 303, ICP 277, batch `batch-1786217580577-5456dea6`
- Node 6 no-service — headline rows 2330-2333
- Node 6 ICP-backed — service 302, ICP 276, headlineSet `INvexs9yh7JLQ3Eyy48Rz`

**Migration 0099 proven at teardown:** each sweep resolved **12 public ids across 4 rows — three per
row**. Under the old code each would have cleared 8 and leaked 4. Cloudinary verified by direct
listing, not by the sweep's self-report: both batches GONE.

⚠️ **8 legacy orphans remain** (4 at `generated_17862073*`, 4 at `generated_17862012*`), both sets
from runs that PREDATE 0099. Their urls were never recorded and are unrecoverable from the database;
they need the pattern-scoped listing sweep (`cloudinary.search` sorted by `created_at desc`, NOT
`api.resources()`). Not yet done.

### 12.10 Baselines to reconcile every proof run against

`adCopy` **5424** · `headlines` **2174** · `adCreatives` **405**. All three were restored exactly
after every proof run in this chapter. The copy proofs render no images, so Cloudinary is not
involved — but the moment a proof renders one, §10's teardown rules apply in full.
