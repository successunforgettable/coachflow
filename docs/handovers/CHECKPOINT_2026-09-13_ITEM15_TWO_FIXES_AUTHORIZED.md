# 🟢 RESUME POINT — 2026-09-13, item 15: three sources fixed and gated, two fixes authorised, NOT started

**Written so a fresh terminal resumes from this exact point with no state lost. Every number measured at write
time (§15f). The two authorised fixes exist as an APPROVED INSTRUCTION ONLY — no code, at the time of writing.**

---

## 1. WHERE PRODUCTION IS

| | |
|---|---|
| deployed | **`9156875`, SUCCESS — UNTOUCHED.** Railway deploys only `railway-build`; `origin/railway-build` is still `9156875` |
| `main` | `67517e3`, untouched |
| **nothing is deployed** | every prompt fix, the scanner and both test files are **local and committed to the held branch only**. **Every NEW generation in production still carries the §14b defect** |
| local `railway-build` | still `aa9209b` — deliberately left behind so a stray push cannot deploy this work |

🔴 **PUSHING `railway-build` IS THE DEPLOY.** Nothing here is ready for that.

## 2. THE HELD BRANCH — `docs/held-2026-09-12`

Carries all prior work: the pre-launch dummy-data wipe, the Remotion AWS key scope-down, the queue-7/12/13/14/15
scoping, the last checkpoint `aa9209b`, **and — as of this checkpoint's own commit — the item-15 prompt fixes,
the timed-claim scanner, its tests and fixtures, and the two item-15 handover records.**

📌 **Correction worth carrying:** until this commit the item-15 code existed **only as uncommitted working-tree
changes**. It is committed now. Nothing is pushed.

Restorable wipe export: `~/zap-wipe-export-2026-09-12/` — **keep until 2026-12-11**.

## 3. ITEM 15 — WHAT WAS WRONG, AND WHAT IS FIXED

Scoped originally as one family; it was **two**, and a **third source** was found during the work:

| source | file | state |
|---|---|---|
| **A** — the free-asset offer prompt | `_core/offerStandard.ts`, `offersGenerator.ts` | ✅ fixed + gated (free-asset mode only) |
| **B** — the lead-magnet/bonus content generator | `leadMagnetContentGenerator.ts` | ✅ fixed + gated |
| **C** — **unscoped, found mid-work** | `bonusGenerator.ts` `description`/`shortLine` | ✅ fixed + gated |

**Source C was the root of the original symptom.** It instructed the accelerator bonus to *"produce a result
**within the first 7 days**"* — literally where bonus-42's *"By Day 7, you will hold…"* came from. It also
carried *"so acting takes minutes"* and *"framed by … the time it saves"*. It matters because
`bonusPdfGenerator.ts:54` builds the body's content brief **from `description`**, so a clock stored by C is
handed back to B as input.

**The enforcement:** `server/_core/timedClaimScanner.ts` (new) — detector + quoted-speech exemption + corrective
fail-context — wired into all three generators' retry loops. `timedClaimScanner.test.ts` (27 tests) and
`offerStandard.test.ts` (13 tests) calibrate it against the real text that was live on 2026-09-12.

**Gates at this checkpoint:** `npx tsc --noEmit` = **34** (baseline, zero new). 537 tests green
(pipeline-fixes 414, scanner 27, offerStandard 13, promptPins 21, leadMagnetOfferMode 9, leadMagnetClose 12,
complianceFilter 31, tokenCrypto 10).

## 4. 🔴 LIVE PAGE STATUS — all six, measured 2026-09-13 by fetch, widened scanner

| page | live | state |
|---|---|---|
| **`bonus-42`** | ✅ **0 violations** | clean |
| **`bonus-43`** | ✅ **0 violations** | clean |
| `bonus-35` | 🔴 1 — `in the next ten minutes` | **blocked by the gate** — the generator cannot return a clean body (§5) |
| `bonus-44` | 🔴 1 — `within 90 days` | **blocked by the gate** (§5). **Arfeen confirmed directly that the 90-day figure is FABRICATED, not coach-supplied — no §14b exemption applies** |
| `bonus-33` | 🔴 2 | **A NEW CLEAN BODY IS IN THE DB** (`assetBody` md5 `a93608db98`); the **OLD body is still live** because publish is HELD by the operator-token gate on `[INSERT_BOOKING_DURATION]` / `[INSERT_BOOKING_URL]`. 🛑 **PARKED FOR ITEM 14. DO NOT TOUCH IT IN THIS ITEM.** |
| `bonus-34` | 🔴 3 | **produces no passing body at all — a confirmed node defect** (§5) |

**bonus-42's live replacement text:** *"Run every saved idea through these seven prompts and you will leave with
a ranked shortlist of no more than three directions that carry real authority — and the clarity to name one of
them out loud."*

## 5. 🔴 ROOT CAUSE — CONFIRMED BY REPRODUCTION, NOT THEORY

**`server/leadMagnetContentGenerator.ts:871` sets `failContext = ""` whenever a thin/invalid body arrives**,
silently discarding an accumulated timed-claim correction.

```
attempt 1: §14b rejected          -> failContext SET
attempt 2: thin/invalid body      -> failContext = ""      <- the correction is DISCARDED
attempt 3: §14b rejected again    -> budget exhausted -> NULL
```

**Reproduced identically on three pages**, so it is not a bad roll:

| page | sequence | outcome |
|---|---|---|
| bonus-34 | timed → thin → timed | NULL |
| bonus-35 | timed → thin → timed | NULL, not written |
| bonus-44 | timed → thin → thin | NULL, not written |

**One `failContext` variable serves two independent failure families** — timed-claim violations and
thin/invalid bodies — **sharing a single attempt budget of 3.**

**Two hypotheses tested and DISPROVED** (recorded so they are not re-investigated):
- **output truncation** — out = 4466–5174 tokens against the `max_tokens: 8192` cap (`llm.ts:377`),
  `JSON.parse` OK, 4 tools returned every time;
- **input contamination** — bonus-34's brief scans clean of timed language.

## 6. 🔴 SECOND DEFECT FOUND — NOT YET FIXED

The **quoted-speech / scene-setting exemption** would pass bonus-44's *"three paying clients within 90 days"*
again on regeneration, because it sits inside a first-person script. Its pre-run scan reads
**`0 violations, 1 exempt`**.

**Arfeen has ruled that figure fabricated.** So: **the exemption must NOT apply when a quoted line asserts a
specific outcome figure — a number, a timeframe or a deadline — regardless of who is "speaking" it.**

## 7. ✅ TWO FIXES AUTHORISED — **NOT STARTED. NO CODE EXISTS FOR EITHER.**

1. **Give the timed-claim correction and the thin-body correction SEPARATE ACCUMULATING SLOTS**, instead of one
   shared variable that is cleared by either failure.
2. **Narrow the quoted-speech exemption** so it excludes lines asserting outcome figures (§6).

🛑 **THE TOOLKIT ATTEMPT BUDGET (currently 3) IS EXPLICITLY NOT TO BE TOUCHED** — parked as a separate question.

## 8. AFTER BOTH FIXES — the sequence

1. Re-run **bonus-34, bonus-35 and bonus-44** through the corrected generator.
2. **Confirm each live page BY FETCH, never by a successful write.**
3. **If any still cannot produce a clean body within the existing budget, REPORT IT AS A NODE DEFECT — do not
   retry blind.** (Standing ruling: a reproduced claim is a defect in the node, not a bad roll.)

## 9. STANDING VERIFICATION REQUIREMENT FOR THIS ITEM

**After ANY write: the blast-radius check** — `CHECKSUM TABLE` on all 58 tables plus row fingerprints on
`bonuses` / `hvcoTitles` / `landingPages`, baseline measured at run time, confirming every fixture and
prohibition row **outside** the touched pages is unchanged. Same as every prior pass in this item.

⚠️ **Take the "after" snapshot ONLY once the run has written its own completion artefact.** On 2026-09-12 a
snapshot taken while a child process was still running reported "0 changes" and a write to bonus-42 was missed;
the background wrapper's `exit code 0` was its own, not the child's.

## 10. THE NEXT SESSION'S FIRST STEP

> **Implement the two authorised fixes (§7). Then re-run the three blocked pages (§8). Then report before/after
> text, gate status, and the blast-radius result.**

Detail: `ITEM15_2026-09-12_SCANNER_BUILT_FOUR_PUBLISHED.md` (+ its 2026-09-13 addendum) and
`ITEM15_2026-09-12_PROMPTS_FIXED_RENDER_HELD.md`.

**Verify this block before trusting it:**
```
git ls-remote origin refs/heads/railway-build            # must still be 9156875
git log --oneline origin/railway-build..docs/held-2026-09-12 | wc -l
npx tsc --noEmit 2>&1 | grep -c "error TS"               # baseline 34
grep -n "failContext = \"\";" server/leadMagnetContentGenerator.ts   # fix 1 not yet applied -> still present at :871
```
