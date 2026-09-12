# ITEM 15 — the timed-claim scanner is built and wired; 4 of 6 pages republished, 1 of 6 fully clean

**Written 2026-09-12. Every number measured at run time (§15f). Supersedes
`ITEM15_2026-09-12_PROMPTS_FIXED_RENDER_HELD.md` for the render status; that file's prompt-fix record stands.**

Scope as extended by Arfeen: all six live bonus pages, retention rules overridden for those six rows only.

---

## 1. WHAT WAS BUILT

| file | what |
|---|---|
| **`server/_core/timedClaimScanner.ts`** | NEW — the detector, the quoted-speech exemption, and the corrective fail-context builder |
| `server/_core/__fixtures__/timedClaimCorpus.ts` | NEW — the calibration corpus, captured verbatim from the six live pages |
| `server/_core/timedClaimScanner.test.ts` | NEW — 27 tests, calibration controls first |
| `server/bonusGenerator.ts` | source C: three timed instructions removed + scanner in its retry loop + `dryRun` |
| `server/leadMagnetContentGenerator.ts` | source B: scanner gate, fail-context injection, attempts 2 → 3 |
| `server/offersGenerator.ts` | source A: scanner in the retry loop, **free-asset mode only** |
| `server/_core/offerStandard.ts` | (prior pass) free-asset value equation, angles, section spec |

**Gates:** `tsc --noEmit` = **34** (baseline, zero new). Tests: scanner 27, offerStandard 13, promptPins 21,
leadMagnetOfferMode 9, leadMagnetClose 12, pipeline-fixes 414, complianceFilter 31, tokenCrypto 10 — **537 green**.

### The root cause was in source C, and it was explicit

`bonusGenerator.ts` instructed the accelerator bonus to *"produce a result **within the first 7 days**"*. That is
where bonus-42's *"By Day 7, you will hold…"* came from. Also removed: *"so acting takes minutes"* and
*"framed by … the time it saves"*. Source C writes `description`, and `bonusPdfGenerator` builds the body's
content brief FROM `description` — so a clock stored there was handed back to the body generator as input.

### Source B was re-rolling, and now it corrects

Until this change, source B's retry re-sent the **same prompt** and hoped for a better roll — precisely what the
standing ruling bars. It now injects a fail-context naming what came back wrong in the response just produced
(§14a's permitted corrective form).

---

## 2. THE SCANNER — and the two times calibration caught it being wrong

**It is proven to fire, not assumed to.** 27 tests; every assertion is a positive artefact (a named clock, in a
named field), never an absence. The corpus is the real text that was live on 2026-09-12.

**Caught during calibration (bug 1):** the money-window exemption matched `charge` inside **"chargeable offer"**,
falsely exempting bonus-43's genuine *"One sitting."* Narrowed to refund/guarantee vocabulary only.

**🔴 Caught after publication (bug 2) — the scanner approved two claims it could not see.** The first version
matched only digit forms and only `by day N`. It passed:
- bonus-35's new promise — *"get words on the page in the next **ten** minutes"* (spelled-out numeral)
- bonus-42's new promise — *"you **leave Day 7** holding three ranked directions"* (bare `Day N`)

Both are §14b violations. The pattern now covers number words and the bare day form, and **both real misses are
permanent regression controls in the test file.** This is §15c turned on my own instrument: it could fail, but
not on these — so a clean read meant less than it appeared to.

### The exemption works, and it has a known limit

Quoted speech is exempt by default, per the standing rule. Double and single quotes are paired **separately**
because real output nests them; a single sequential pass put the clock between two spans and reported a false
violation inside plain quoted speech. Apostrophes inside words are not delimiters.

⚠️ **Spans are computed PER LINE.** A quotation that opens on one line and closes on another is not tracked, so
its clock reports as a violation. That is the safe direction, and it is exactly what happened on bonus-44: the
body scan exempted the line, the rendered page split it, and the page scan flagged it.

---

## 3. REAL-GENERATION VERIFICATION — all three sources

Run against production, through production's own paths. **Sources A and C wrote nothing** (direct call / `dryRun`).

| source | result |
|---|---|
| **A** — free-asset offer, 3 angles | **clean.** The `free` and `dollar` angles came back with `today@cta` on attempt 1, took the fail-context, and returned clean. **The retry fired; it is not decoration.** |
| **C** — bonus stack, 3 bonuses | **clean on attempt 1.** Output describes assets, not clocks: *"A 12-item checklist"*, *"A fill-in template"*, *"A done-for-you script bank"* |
| **B** — the six bodies | see §4. The gate rejected attempt 1 on bonus-35 (`within 24 hours`, `in 4 hours`) and bonus-42 (`today` ×3) and the corrective retry returned clean both times |

---

## 4. 🔴 THE LIVE PAGES — 1 of 6 fully clean. Read this as the status.

Each page fetched **twice, minutes apart**, identical byte counts both reads. Scanned with the **widened** scanner.

| page | live now | state |
|---|---|---|
| `bonus-33` | **2 violations — UNCHANGED** | 🔴 `assetBody` written clean, but **publish HELD by the operator-token gate**: the new body carries `[INSERT_BOOKING_DURATION]`, `[INSERT_BOOKING_URL]`. The gate was right to hold. **DB body is new, live page is old** |
| `bonus-34` | **3 violations — UNCHANGED** | 🔴 **generator returned null** after 3 attempts — never produced a body passing both shape and §14b. Nothing written. Per the standing ruling this is a **node defect, not a bad roll: NOT re-rolled** |
| `bonus-35` | 1 violation — `in the next ten minutes` | 🟡 republished; was 2. Remaining claim is scanner bug 2, now closed |
| `bonus-42` | 1 violation — `leave day 7` | 🟡 republished; was 4. *"By Day 7, you will hold"* → *"You leave Day 7 holding…"*. Weaker, not clean |
| **`bonus-43`** | **0 violations** | ✅ **fully clean**, on the widened scanner and a widened probe |
| `bonus-44` | 1 violation — `within 90 days` | 🟡 republished; was 4. **Corroborated independently**: the persistence gate classes the same line `promised_result` |

### Replacement text, as published

- **bonus-42** — before: *"**By Day 7, you will hold** a ranked shortlist of no more than three directions…"*
  after: *"Use this checklist to close the notes app with a decision instead of dread. **You leave Day 7 holding**
  three ranked, evidence-backed directions — not a longer list of possibilities, a shorter one you can act on."*
- **bonus-43** — before: *"…a single-paragraph offer you can name out loud and **send to a real person today**."*
  after: *"Follow the five steps and fill in every field, and you will leave this document holding a specific,
  nameable consulting offer traced directly back to expertise you already have."* ✅
- **bonus-44** — before: *"Each script is **ready to use today**, as-is."*
  after: *"You now have the exact words for the doubt spiral, the partner question, and the first network
  conversation — so no version of 'I'm not ready yet' can stall you."*
- **bonus-35** — before: *"You'll move from stuck to writing **in under three minutes**…"*
  after: *"…get words on the page **in the next ten minutes**."* 🟡 still a clock

---

## 5. BLAST RADIUS — clean, and measured before and after

`CHECKSUM TABLE` on all **58 tables** plus row fingerprints, taken immediately before the writes and again after.

**539 rows/tables compared · 6 changes · ZERO outside the six.**

- Changed: bonuses 33, 35, 42, 43, 44 (`updatedAt` + `assetBody` MD5) and the `bonuses` table checksum.
- **bonus-34 unchanged** — correct, nothing was written.
- **`hvcoTitles` (467 rows) unchanged. `landingPages` (8) unchanged. The other 57 table checksums unchanged.**
- **`title`/`shortLine`/`description` MD5 unchanged on all six** — those fields were not touched.
- No fixture in kit 225, kit 200 or services 272–277/285 was written outside the six authorised rows.
- A later aborted second pass (bonus-35/42) wrote **nothing**: a further whole-database diff showed **0 changes**.

### 🔴 Permanent consequence, as warned

Each republished PDF overwrote the same public id. Per the settled Cloudinary finding an overwritten address
keeps serving the replaced file, so **the four previous PDF addresses stay publicly reachable with the old
claims**: `v1785780748` (35), `v1788108509` (42), `v1788108732` (43), `v1788108820` (44). bonus-33's PDF was not
republished (publish held), so its address is unchanged. **No purge was attempted** — settled: a purge does not
retire an old address.

### A separate finding, not introduced by this work

The persistence gate ("screen-not-drop", it logs and does not block) reports more fabrication-class hits on the
new bodies than the old on three pages (42: 0→1, 43: 1→6, 44: 3→6; 35 improved 5→4). **Read individually, almost
all new hits are false positives of that tier-2 legacy validator** — `invented_named_third_party` matching
Title-Case asset names ("Script Reframe Bank", "Career Timeline"), `invented_testimonial` matching *"Place your
three completed"*. **The one real hit is bonus-44's `promised_result`**, the same "within 90 days" line above.

---

## 6. WHAT IS LEFT, AND WHAT NEEDS A RULING

1. **bonus-34 is a node defect.** The generator cannot produce a passing body for it. Needs diagnosis, not
   another roll.
2. **bonus-33 needs its operator tokens resolved** before it can publish; it currently sits with a new
   unpublished body and an old live page.
3. **bonus-35 and bonus-42 need one more pass** — now safe and cheap, because the widened scanner would force a
   correction on both. No ruling needed.
4. **bonus-44's *"three paying clients within 90 days of launching"* needs Arfeen's ruling:** it is inside a
   first-person script the reader says, but it asserts a programme outcome with a deadline. Two instruments
   independently flag it. **Is the 90-day goal coach-supplied?** If yes, §14b permits it and the page is done.
5. **Nothing is deployed.** Production is still `9156875`; the scanner and all prompt fixes are **local and
   uncommitted**, so every NEW generation still carries the defect. Pushing `railway-build` is the deploy.

---

# ADDENDUM — 2026-09-13. Root cause found; bonus-42 is clean; 35/44 blocked by one defect.

## 0. A CORRECTION TO §5 ABOVE

§5 states the aborted second pass "wrote **nothing**: a further whole-database diff showed 0 changes."
**That is wrong.** bonus-42's `updatedAt` is **08:22:59**, not the 08:05:12 the snapshot recorded, and its
`assetBody` MD5 moved `4a1c4751…` → `6673397b…`. **Pass 2 did write bonus-42.**

**Why the check failed:** the snapshot was taken while the child process was still running. The background
wrapper reported "exit code 0" for itself, not for the child, and that was read as completion. Same family as
§15f — the comparison was sound, it was run at the wrong moment. **Rule for every future run: snapshot only
after the run's own completion artefact exists** (here, its JSON report), never off a wrapper's exit code.

**The write was benign and helpful:** it is what made bonus-42 clean.

## 1. 🔴 BONUS-34 ROOT CAUSE — CONFIRMED BY REPRODUCTION, AND THE DEFECT IS IN THIS SPRINT'S OWN CODE

Reproduced against production with per-attempt visibility. Nothing written.

```
attempt 1: §14b rejected (2 violations)   -> failContext SET
attempt 2: thin/invalid toolkit body      -> failContext = ""     <- the correction is DISCARDED
attempt 3: §14b rejected (1 violation)    -> budget exhausted -> NULL
```

**`server/leadMagnetContentGenerator.ts:871` clears `failContext` when a thin body arrives.** A
**timed → thin → timed** sequence therefore burns all three attempts while the corrective feedback is applied
once and thrown away; attempt 3 re-runs with no correction at all. The model was *close* every time — attempt 3
carried a single `today` — so this is a **defect in the node, not a bad roll**, exactly as the standing ruling
frames it.

**Two hypotheses were tested and DISPROVED:**
- **Output truncation:** out = 4466–5174 tokens against the `max_tokens: 8192` cap (`llm.ts:377`);
  `JSON.parse` OK; 4 tools returned every time. Not truncation.
- **Input contamination:** bonus-34's brief scans clean of timed language. Not the brief.

**It is not specific to bonus-34 — three independent reproductions of one bug:**

| page | attempt sequence | outcome |
|---|---|---|
| bonus-34 | timed → thin → timed | NULL |
| bonus-35 | timed → thin → timed | NULL, not written |
| bonus-44 | timed → thin → thin | NULL, not written |

Toolkit is the format that triggers it, being prone to both failure families. **The retry budget of 3 is shared
between two independent failure modes and a single `failContext` variable serves both.**

**The fix (NOT APPLIED — reporting first, as instructed):** keep the timed-claim correction when a thin body
arrives and carry a shape note alongside it, rather than replacing it with `""`. Two failure families need two
accumulating slots. Whether the budget should also rise above 3 for toolkit is a second question.

## 2. 🔴 THE RULING EXPOSES A SECOND DEFECT — IN THE EXEMPTION ITSELF

bonus-44's pre-run scan reads **`0 violations, 1 exempt`**. The quoted-speech exemption is classifying
*"three paying clients within 90 days"* as scene-setting because it sits inside a first-person script.

**Arfeen has ruled that figure fabricated and not coach-supplied, so §14b's exemption does not apply.** As
implemented the gate would pass that exact claim again. **The exemption must stop applying when a quoted line
asserts an outcome figure** — a design change following directly from the ruling, flagged rather than decided.

## 3. LIVE PAGE STATUS — measured 2026-09-13, widened scanner, fetched twice

| page | live | note |
|---|---|---|
| **bonus-42** | ✅ **0 violations** | fixed by the pass-2 write corrected in §0 |
| **bonus-43** | ✅ **0 violations** | |
| bonus-35 | 🔴 1 — `in the next ten minutes` | re-render refused by the gate (§1) |
| bonus-44 | 🔴 1 — `within 90 days` | re-render refused by the gate (§1); exemption defect (§2) |
| bonus-33 | 🔴 2 — unchanged | new body IN THE DB (`a93608db98`), **old body still live**; publish held on `[INSERT_BOOKING_DURATION]`, `[INSERT_BOOKING_URL]`. **Item 14, not this pass** |
| bonus-34 | 🔴 3 — unchanged | node defect (§1) |

**bonus-42 replacement text, live:** *"Run every saved idea through these seven prompts and you will leave with
a ranked shortlist of no more than three directions that carry real authority — and the clarity to name one of
them out loud."*

## 4. BLAST RADIUS — nothing written this pass

Baseline measured at run time, compared **only after both runs wrote their completion artefacts** (§0).
**539 rows/tables compared · 0 changes · 0 outside the six.** All 58 table checksums, 6 bonuses, 467 hvco rows
and 8 landing pages identical. All six live pages byte-identical to the start-of-pass fetch.

## 5. INFRASTRUCTURE NOTE

`trolley.proxy.rlwy.net:14382` was unreachable for several minutes at the start of this pass (`connect
ETIMEDOUT`) while DNS resolved and general outbound TCP was fine — a Railway-side blip. It recovered on its own.
No writes were in flight.
