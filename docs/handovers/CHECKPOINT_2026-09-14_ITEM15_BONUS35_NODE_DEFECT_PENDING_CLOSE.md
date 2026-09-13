# 🟢 RESUME POINT — 2026-09-14, item 15: bonus-35 a node defect, closing summary NOT yet written

**Written so a fresh terminal resumes from this exact point with nothing lost. Every number below was MEASURED at
write time (2026-09-14 ~21:45 UTC) unless it says otherwise (§15f). Read this file first, then act.**

> 🛑 **HELD, NOT YET EXECUTED:** Arfeen's instruction *"mark bonus-35 as confirmed node defect + write closing summary"*
> was given and deliberately held until this checkpoint existed. **Do not treat it as done.** See §8 for the order.

---

## 1. PRODUCTION — untouched for the whole of item 15

| | measured |
|---|---|
| deployed | **`9156875`**, Railway SUCCESS, created 2026-09-10 19:44 UTC |
| `origin/railway-build` | `9156875` |
| `origin/main` | `67517e3` · local `main` `67517e3` |
| local `railway-build` | `aa9209b` — deliberately behind, so a stray push cannot deploy this work |

🔴 **PUSHING `railway-build` IS THE DEPLOY.** Nothing in item 15 is deployed. **Every NEW production generation still runs
the pre-item-15 code.** All changes below exist only on the held branch and in its working tree.

## 2. THE HELD BRANCH — `docs/held-2026-09-12`

**All item-15 work is now committed** (updated 2026-09-14, same session). Held-branch HEAD after the two pending passes
were committed: **`425a4cbed357e216951b2e3c2ecb454226959972`**, followed by the commit that records this update.
`origin/docs/held-2026-09-12` = **`6d88070`**. **Nothing pushed to origin at any point in item 15.**

### 2a. Committed — item 15, in order (`git log 6d88070^..HEAD`)

| commit | date (local) | what |
|---|---|---|
| `6d88070` | 2026-09-13 04:35 | checkpoint: three sources gated; fixes 1 + 2 authorised, not started *(on origin)* |
| `2349d6e` | 2026-09-13 21:14 | fix 1 (separate correction slots) + fix 2 (narrowed quoted-speech exemption); bonus-34 re-run |
| `f889c7d` | 2026-09-13 22:12 | `repairArrayField` — list-as-text repair before the shape check |
| `7ce210e` | 2026-09-13 22:28 | read-only diagnostic capture folder `docs/handovers/item15-diag-2026-09-13/` |
| `265207f` | 2026-09-13 22:40 | strict tool use for lead-magnet bodies + positive-only research-statistic rule |
| `d32e2c8` | 2026-09-14 02:31 | action-timing ruling, content floor, hedged clocks; bonus-35/44 re-runs |
| `f4a53fa` | 2026-09-14 03:18 | this checkpoint + `CHECKPOINT.md` restart block (written while the next two passes were still uncommitted) |
| **`d593331`** | 2026-09-14 | **declared-count gate** — `declaredCount.ts`, its 15 tests, 7 fixtures, generator + `bonusPdfGenerator` wiring, sixth-pass handover addendum |
| **`425a4cb`** | 2026-09-14 | **"in a second" read-only capture** — `docs/handovers/item15-diag-2026-09-14/` |
| *(next commit)* | 2026-09-14 | this update to the checkpoint file and the restart block |

### 2b. ✅ NOW COMMITTED — the two passes that were working-tree only when this checkpoint was first written

**Committed 2026-09-14, same session, on Arfeen's instruction — do NOT re-attempt these commits.** Before committing:
tsc 34, declaredCount suite 15/15. After: **0 uncommitted tracked changes; no item-15 file untracked.**

- **`d593331e6fb9129a23cb0c08b34e26011807cb4f`** — declared-count gate (12 files)
- **`425a4cbed357e216951b2e3c2ecb454226959972`** — "in a second" capture pass (8 files)

The table below is kept as the record of exactly what those two commits contain.

| state | path | pass |
|---|---|---|
| modified | `server/leadMagnetContentGenerator.ts` | declared-count gate wiring (`declaredCounts`, `countBrief`) |
| modified | `server/bonusPdfGenerator.ts` | passes `countBrief: b.description` |
| modified | `docs/handovers/ITEM15_2026-09-13_TWO_FIXES_BUILT_RERUN.md` | sixth-pass addendum §1–§5 (gate, re-run, capture, follow-ons) |
| new | `server/_core/declaredCount.ts` | the gate |
| new | `server/_core/declaredCount.test.ts` | 15 tests |
| new | `server/__fixtures__/bonus-descriptions-2026-09-14.json` | all six production descriptions, verbatim |
| new | `server/__fixtures__/live-bonus-{33,34,43}-2026-09-14.json` | live bodies (33 control; 34, 43 mismatches) |
| new | `server/__fixtures__/trimmed-bonus-35-2026-09-13.json` | live bonus-35 body (declares 17, delivers 13) |
| new | `server/__fixtures__/raw-bonus-35-attempt{2,3}-2026-09-13.json` | raw pre-trim bodies (17 scripts each) |
| new | `docs/handovers/item15-diag-2026-09-14/` | capture: `CAPTURE.md`, 3 raw + 3 bounded bodies, `capture-report.json` |

🛑 **WHAT A STRAY COMMAND DESTROYS:** item-15 work is now all committed, so a checkout/stash/reset no longer loses it.
**The held branch exists on origin only at `6d88070`** — deleting the local branch or its reflog loses every item-15
commit. Never `git add .`: ~330 untracked screenshots (~590 MB) sit in the tree.

## 3. ITEM 15 — PER-PAGE STATE (live pages fetched + scanned 2026-09-14 21:45 UTC; DB rows read the same minute)

| page | live md5 · bytes | scan | declared-count gate | DB `updatedAt` · body md5 | state |
|---|---|---|---|---|---|
| **bonus-42** | `df65ba26` · 12,202 | ✅ 0 | no count declared | 2026-09-12 13:52 · `6673397b` | **clean, live, confirmed** |
| **bonus-44** | `7e4d395c` · 24,581 | ✅ 0 (1 exempt, action timing) | no count declared | 2026-09-13 17:20 · `472b188b` | **clean, live, confirmed** |
| **bonus-34** | `8ffc94f8` · 25,200 | ✅ 0 (1 exempt, quoted speech) | 🔴 **declares 12 prompts, delivers 9** | 2026-09-13 15:03 · `3f66d115` | clean of timed claims, live — **count-gate FOLLOW-ON** |
| **bonus-43** | `0912244e` · 29,539 | ✅ 0 | 🔴 **declares 5 steps, delivers 3** | 2026-09-12 13:37 · `bcc26ead` | clean of timed claims, live — **count-gate FOLLOW-ON** |
| **bonus-35** | `dc3044da` · 21,586 | ✅ 0 (1 exempt, "in a second tab" misread) | 🔴 **declares 17 scripts, delivers 13** | 2026-09-13 20:51 · `65b98046` | 🔴 **NODE DEFECT — and LIVE with the mismatch** (§4) |
| bonus-33 | `cf26e3e6` · 13,606 | 🔴 2 (`in 48 hours`, `today`) | declares 7 tasks, delivers 11 ✅ | 2026-09-12 13:25 · `a93608db` | **PARKED FOR ITEM 14** — clean body in DB since 2026-09-12, OLD body live, publish held on `[INSERT_BOOKING_DURATION]`/`[INSERT_BOOKING_URL]`. Not item 15's remaining work |

- **bonus-34** brief tool ends at an empty `## SECTION 4 — THE EDGES OF YOUR VOICE` (3,897 c): Prompts 1–9 delivered, 10–12
  absent; other tools send the reader to "Prompt 10" and "Prompt 11". Promise: *"Fill in all twelve prompts…"*.
- **bonus-43** SOP tool "(5 Steps)" ends inside STEP 3 (3,958 c): Steps 1–3 delivered; other tools send the reader to
  "SOP Step 4c", "Step 5", "Step 5c". Promise: *"Follow the five steps…"*.

## 4. bonus-35 — NODE DEFECT (formal marking + closing summary held, §8)

**Evidence.** Under the full current gate stack (strict tool use, completeness floor, hedged-clock scanner, action-timing
ruling, declared-count gate), bonus-35 produced **no body passing every gate in two full 3-attempt cycles**:

| cycle | attempt | scripts raw → after trim | refused by |
|---|---|---|---|
| pass 6 (real run, nothing written) | 1 | 17 → **14** | declared-count gate (the trim cut a 5,046 c tool to 3,991) |
| | 2 | 0 | floor + count (853 tokens, degenerate) |
| | 3 | 17 → **17** | §14b: `in a second@nextStep.body` only — **genuine or misread UNRESOLVED** (body never saved) |
| read-only capture | 1 | 0 | floor + count; §14b: *"in under three minutes"* (genuine), *"in 12 Minutes"* in a tool name (genuine), *"after 90 seconds you have typed nothing"* (misread) |
| | 2 | 0 | floor + count (489 tokens, 1 tool) |
| | 3 | **17** | §14b: *"move from stuck to moving **in under two minutes**"* (**genuine**) + *"Nothing I write in the next twenty minutes is going public"* (misread) |

Earlier in item 15, bonus-35 also went live twice with defective bodies: pass 4 published a degenerate body (2 tools, one
"x" in every field) and pass 5 published the current body (promises seventeen, delivers 13).

**Directive (Arfeen): stop re-rolling bonus-35.** Do not re-run without a fix upstream of the body generator.

### ⚠️ Corrections recorded against the summary dictated for this checkpoint — ground truth, verified

1. **`bonusGenerator.ts:121` did not produce bonus-35's count.** bonus-35's `description` was created **2026-08-03** and
   is unchanged since (description md5 `ddc7d773` this pass); the `:121` instruction ("describe the asset itself — its
   length, or how many steps, items or fill-in fields it holds") arrived **2026-09-13** in `6d88070`. `:121` sets up the
   same mismatch for every FUTURE bonus. **Fixing `:121` alone will not change bonus-35** — its stored description (and
   so its brief) would need regenerating too.
2. **No evidence that `:121` primes timed-outcome claims.** `:121` steers descriptions AWAY from time ("rather than a
   time by which the buyer gets a result"). What IS in bonus-35's brief is a clock in its own 2026-08-03 description:
   *"have a prospect say 'you completely get me' **within fifteen minutes**"* — and the same phrase in
   `derivedFromObstacle`. Whether that input drives the repeated "in under N minutes" promises is a hypothesis, untested.
3. **Of the two bodies that met count and floor, ONE carried a confirmed genuine timed claim** (the capture's attempt 3).
   Pass 6 attempt 3's only hit, `in a second`, is unresolved. "Both carried a genuine claim" is not established.

## 5. KNOWN SCANNER GAPS — logged, NOT fixed. Do not act without explicit authorisation.

1. **`in a second` literal-match risk.** The pattern (NUM `a` + UNIT `second`) matches "in a second tab". Confirmed misread
   on the live bonus-35 page ("Keep it open in a second tab", exempted as action timing). Pass 6 attempt 3's rejection on
   the same words could not be confirmed or denied — the body was never saved; not reproduced in 3 capture attempts.
2. **Trigger / situational lines misread as outcome promises.** Confirmed: *"after 90 seconds you have typed nothing"*
   (capture attempt 1). Did not change an outcome — genuine violations were present in the same body.
3. **Scene-setting speech with a counted timeframe misread** — the residual of item 15's own fix 2 (a quantified clock
   inside quotes loses the exemption unless it only schedules an event). Confirmed: *"Nothing I write in the next
   twenty minutes is going public"* (capture attempt 3). Did not change an outcome — a genuine claim was in the same body.

## 6. UPSTREAM ITEMS — logged for future scoping, NOT touched

1. **`server/routers/services.ts:383`** — the service-expansion prompt requires `mainBenefit` to *"contain a concrete
   result — a number, a timeframe, or a named change in situation."* Traced from service 318's "three paying clients
   within 90 days". **Possible shared root with parked item 12** (the invented/required-figure defect).
   Record: `docs/handovers/item15-diag-2026-09-13/DIAGNOSTIC.md` §3.
2. **`server/bonusGenerator.ts:121`** — every new bonus description is told to state its size/count. Sets up the
   declared-count mismatch (count in the brief vs a 4,000-character per-tool cap) on every future bonus; the same shape
   is live on bonus-34, bonus-43 and bonus-35 (whose counts predate `:121` — §4 correction 1).

## 7. EVERYTHING BUILT AND GATED IN ITEM 15 — for the record

| # | fix | where | commit |
|---|---|---|---|
| 1 | **failContext separation** — timed-claim and thin-body corrections in separate accumulating slots; budget still 3 | `generateBodyWithRetries` | `2349d6e` |
| 2 | **narrowed quoted-speech exemption** — a figure or quantified clock in a quote is not exempt (event-schedule carve-out) | `timedClaimScanner.ts` | `2349d6e` |
| 3 | **JSON repair for list-as-text** — `repairArrayField`. Superseded as the fix by strict mode; **kept as a free check (§15j)** | generator | `f889c7d` |
| 4 | **strict tool use** — opt-in `strictToolUse`, `toStrictToolSchema`, non-strict fallback on a 400; eliminates the JSON-escaping fault class | `_core/llm.ts`, `leadMagnetRequest` | `265207f` |
| 5 | **positive-only research-statistic rule** — no quoted wrong-shape examples; four bonus prompt pins updated by a proof script | `copywritingRules.ts` | `265207f` |
| 6 | **action vs outcome timeframes** (Arfeen's ruling: action timing passes, outcome timing fails) | `isActionTiming` | `d32e2c8` |
| 7 | **completeness floor** — format `minItems`, per-field minimum lengths (calibrated), rejects one-character placeholders | `bodyCompleteness` | `d32e2c8` |
| 8 | **hedged-timeframe patch** — in/within under · less than · just · only … N unit | `timedClaimScanner.ts` | `d32e2c8` |
| 9 | **declared-count gate** — parses a count in the brief, counts delivered items (per noun, largest set), rejects a trimmed body below it | `_core/declaredCount.ts` | `d593331` |

**Gates as last measured.** tsc **34** (re-measured at write time). Suites last run 2026-09-14 ~21:05 UTC, **no source
changed since** (the capture pass added only docs): declaredCount 15 · completeness 9 · retry slots 10 · strictToolSchema 9
· researchStatRule 3 · timedClaimScanner 48 · pipeline-fixes 414 · offerStandard 13 · promptPins 21 · leadMagnetOfferMode 9
· leadMagnetClose 12 · complianceFilter 31 · tokenCrypto 10 · bonusPdfFormat 3 · node5Screening 16. **Pre-existing
failures, unchanged and not caused by item 15:** leadMagnetBounds 2, leadMagnetContentGenerator.bonus 1 (stale text pins,
identical on `6d88070`). Every new gate had a negative control / mutation that fired.

**Blast radius, every pass:** `CHECKSUM TABLE` on all 58 tables + whole-row MD5 on 467 hvcoTitles, 8 landingPages,
6 bonuses; baseline at run time; after-snapshot only once the run's completion artefact existed. **0 unexpected changes in
every pass.** Last two passes (pass 6, capture): **0 changes at all.**

🔴 **Permanent consequence (settled Cloudinary finding — no purge was attempted):** every republish in item 15 left its
previous PDF address publicly reachable. From this session: bonus-34 `v1785780554`; bonus-35 `v1789220011`,
**`v1789319816` (the degenerate "x" body)**; bonus-44 `v1789220451`. Current: 34 `v1789311838`, 35 `v1789332694`,
44 `v1789320008`.

## 8. NEXT SESSION — FIRST STEPS, IN ORDER

1. **Verify ground truth only — the two passes are ALREADY COMMITTED (`d593331`, `425a4cb`, §2b). Do not re-commit.**
   ```
   git fetch origin && git ls-remote origin refs/heads/railway-build refs/heads/docs/held-2026-09-12
                                                    # railway-build 9156875 · held branch on origin 6d88070
   git log --oneline 6d88070..HEAD                  # expect 2349d6e f889c7d 7ce210e 265207f d32e2c8 f4a53fa d593331 425a4cb + the checkpoint-update commit
   git status --porcelain | grep -v '^??'           # expect nothing
   npx tsc --noEmit 2>&1 | grep -c "error TS"       # 34
   ```
2. **Send / execute the held instruction:** *"mark bonus-35 as confirmed node defect, write closing summary."* Carry the
   §4 corrections into the summary — they are ground truth.
3. **bonus-34 and bonus-43 declared-count follow-ons** — check each against the gate and correct any that fails. Both
   fail today (§3). Any correction is a production write: explicit go-ahead first, same blast-radius check, three fetches.
4. **Item 15 then substantively closes**, leaving out of scope by design: the three logged scanner gaps (§5) and the two
   upstream items (§6).

🛑 **Hard gates unchanged:** production writes need an explicit go-ahead in the immediately preceding message; never push
`main`; pushing `railway-build` is the deploy; never `git add .`; screenshots come from Arfeen's browser; no Cloudinary
purge calls.
