# Item 15: bonus-35 closing summary (2026-09-14)

**bonus-35 is closed as a confirmed node defect.** This summary covers the final state of all six production bonus pages
(33, 34, 35, 42, 43, 44) and records what is proven, what is not, and what is still open.

Branch `docs/held-2026-09-12`, not pushed. Production is untouched at `9156875`. This pass wrote nothing to production:
two read-only DB queries and anonymous page fetches only.

Full evidence record: `docs/handovers/CHECKPOINT_2026-09-14_ITEM15_BONUS35_NODE_DEFECT_PENDING_CLOSE.md` (§3, §4) and
`docs/handovers/item15-diag-2026-09-14/CAPTURE.md`.

---

## 1. Why bonus-35 is closed as a node defect

The basis stands on its own. It does not depend on the root-cause question in §2, which is still open.

1. **Two full 3-attempt generation runs, zero passing bodies.** The runs were pass 6 (a real run; nothing written) and the
   read-only capture. They used the full current gate stack: strict tool use, completeness floor, hedged-clock scanner,
   action-timing ruling and declared-count gate. No attempt in either run produced a body that passed every check.
2. **Published live twice with a defective body.** Pass 4 published a degenerate body: 2 tools, with one "x" in every
   field. Pass 5 published the current body. **It promises seventeen scripts and delivers 13**, and it is live now (§3).
3. **Directive (Arfeen): no further re-rolls of bonus-35.** Do not re-run it without a fix upstream of the body generator.

## 2. Root cause: UNCONFIRMED

**`bonusGenerator.ts:121` is not the cause.** Line 121 tells a new bonus description to state the asset's size or count.
It was added in `6d88070` on **2026-09-13**. bonus-35's description was created **2026-08-03**, six weeks earlier, and
its hash has not changed since (description md5 prefix `ddc7d773`, re-read from production 2026-09-14). A line written
after the text existed cannot have produced that text.

Line 121 still sets up the same count mismatch for every *future* bonus (a count in the brief versus a 4,000-character
per-tool cap). That is logged as an upstream item (§5). Fixing line 121 alone would not change bonus-35: its stored
description, and so its brief, would also need regenerating.

**Open question for whoever picks this up next.** The only known clock in bonus-35's brief is its own August description
wording: *"have a prospect say 'you completely get me' **within fifteen minutes**"*. The same phrase appears in its
`derivedFromObstacle`. **Whether this wording drives the repeated timed-outcome claims in bonus-35's bodies has not been
tested.** It is a hypothesis, not a finding.

## 3. Timed-outcome evidence: one confirmed instance

Two bodies met both the declared count (17 scripts) and the completeness floor. They are not equal evidence:

| run | attempt | rejected on | status |
|---|---|---|---|
| read-only capture | 3 | *"move from stuck to moving **in under two minutes**"* (promise) | ✅ **confirmed** timed-outcome claim |
| pass 6 | 3 | `in a second@nextStep.body` | ❓ **unresolved** |

The pass 6 body was never saved, so its sentence cannot be recovered. It cannot be told apart from the known scanner
misread on *"Keep it open in a second tab"*, which appears on the live bonus-35 page from the same pass. None of the
capture's three attempts reproduced the words "in a second".

The capture's attempt 3 was also flagged on *"Nothing I write in the next twenty minutes is going public"*. That is a
misread of scene-setting speech; the attempt would have been refused on the confirmed claim alone. The capture's
attempt 1 carried two further genuine claims (*"in under three minutes"*, and *"in 12 Minutes"* in a tool name), but it
failed the floor and the count, so it was not a complete body.

**What the evidence supports:** across two full 3-attempt runs, zero bodies passed every check, and one complete body
carried a confirmed timed-outcome claim. It does not establish a pattern beyond that.

## 4. Final state of the six bonus pages

**Live pages** were fetched three times on 2026-09-14, at 15:33, 15:36 and 15:40 UTC. Every read returned HTTP 200 and
the same bytes and md5 all three times. **DB rows** were re-read from production the same hour.

Every live md5 and every DB `updatedAt` matches the checkpoint's capture exactly, so no page or row has changed since
then. The scan and count-gate verdicts below are therefore measurements of these same bytes.

The checkpoint labels that capture "2026-09-14 ~21:45 UTC". The commit order shows that is a date slip: the checkpoint
commit `f4a53fa` is 2026-09-13 21:48 UTC. The capture was **2026-09-13 ~21:45 UTC**.

| page | live bytes · md5 | DB `updatedAt` (UTC) | timed-claim scan | declared-count gate | final state |
|---|---|---|---|---|---|
| **bonus-42** | 12,202 · `df65ba26` | 2026-09-12 13:52 | ✅ 0 | no count declared | ✅ **clean, closed** |
| **bonus-44** | 24,581 · `7e4d395c` | 2026-09-13 17:20 | ✅ 0 (1 exempt, action timing) | no count declared | ✅ **clean, closed** |
| **bonus-34** | 25,200 · `8ffc94f8` | 2026-09-13 15:03 | ✅ 0 (1 exempt, quoted speech) | 🔴 declares **12 prompts**, delivers **9** | clean of timed claims · **count-gate follow-on (§5)** |
| **bonus-43** | 29,539 · `0912244e` | 2026-09-12 13:37 | ✅ 0 | 🔴 declares **5 steps**, delivers **3** | clean of timed claims · **count-gate follow-on (§5)** |
| **bonus-35** | 21,586 · `dc3044da` | 2026-09-13 20:51 | ✅ 0 (1 exempt, "in a second tab" misread) | 🔴 declares **17 scripts**, delivers **13** | 🔴 **CONFIRMED NODE DEFECT, closed.** Live with the mismatch; no re-rolls |
| bonus-33 | 13,606 · `cf26e3e6` | 2026-09-12 13:25 | 🔴 2 (`in 48 hours`, `today`), on the OLD live body | declares 7 tasks, delivers 11 ✅ | **parked for item 14.** Clean body in DB; publish held on `[INSERT_BOOKING_DURATION]` / `[INSERT_BOOKING_URL]`. Not item 15 work |

## 5. Still open

### Pending follow-ons: bonus-34 and bonus-43

Both need the same declared-count check that bonus-35 failed. Both fail it on their live bodies today:

- **bonus-34:** the brief tool ends at an empty `## SECTION 4 — THE EDGES OF YOUR VOICE`. Prompts 1–9 are delivered and
  10–12 are absent, yet other tools send the reader to "Prompt 10" and "Prompt 11". Its promise: *"Fill in all twelve
  prompts…"*.
- **bonus-43:** the SOP tool "(5 Steps)" ends inside STEP 3. Steps 1–3 are delivered, yet other tools send the reader
  to "SOP Step 4c", "Step 5" and "Step 5c". Its promise: *"Follow the five steps…"*.

🛑 **Fixing either one is a production write. It needs Arfeen's explicit go-ahead before anything is touched.** Each fix
then needs the same whole-database blast-radius check and three spaced live fetches. Every republish also leaves the
previous PDF address permanently public (CLAUDE.md §4), so a republish must not publish a bad file.

### Out of scope for item 15 by design: logged, not fixed, not authorised

- **Scanner gaps** (checkpoint §5):
  - the `in a second` literal match;
  - trigger/situational lines read as outcome promises;
  - scene-setting speech with a counted timeframe.
- **Upstream items** (checkpoint §6):
  - `server/routers/services.ts:383` requires a concrete result in `mainBenefit`. It may share a root with parked
    item 12.
  - `server/bonusGenerator.ts:121` asks every future description to state a count (§2).
- **The §2 open question:** whether bonus-35's *"within fifteen minutes"* brief wording drives its timed claims.

### Permanent public addresses from item 15 (no purge attempted)

These previous PDF addresses remain public:

- bonus-34 `v1785780554`;
- bonus-35 `v1789220011` and `v1789319816` (the degenerate "x" body);
- bonus-44 `v1789220451`.

Current addresses: 34 `v1789311838` · 35 `v1789332694` · 44 `v1789320008`.
