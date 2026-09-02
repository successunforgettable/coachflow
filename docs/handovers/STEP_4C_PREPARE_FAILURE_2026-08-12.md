# STEP 4c `--prepare` — FAILURE DIAGNOSTIC, 2026-08-12

Read-only snapshot captured **before any teardown**, so the failure can be studied without
rebuilding the cascade. Nothing here was written; no Meta call was made in the run or in this
capture.

Run artifacts: service **313** · ICP **287** · adSet **`MqGYlX-BFJdSz1xjRUzUM`** · batch
**`batch-1786538755783-e2ae8858`** · creatives **495–498** · landing page **238**.
Composites preserved at `docs/screenshots/run-2026-08-12-step4c-prepare/`.

---

## 1. THE FAILURE WAS A FALSE POSITIVE — the page would have published clean

**The blocking check is stricter than both the publisher and the harness's own render check.**

Landing page 238: `activeAngle = original`, `pageType = sales_page`. Token census across all four
stored angles, after the answering pass:

| angle | chars | `[INSERT_*]` tokens |
|---|---|---|
| **`originalAngle`** ◀ **ACTIVE** | 26,431 | **0** |
| `godfatherAngle` | 27,129 | 0 |
| `freeAngle` | 25,109 | 0 |
| `dollarAngle` | 22,870 | **1 — `[INSERT_CART_CLOSE]`** |

**The active angle is clean.** `assertRenderedPageIsClean` renders the ACTIVE angle only
(`step4c-multiad-publish.ts:322-323`), so it would have passed. The real publish gate scans the
rendered HTML of the active angle, so it would have passed too. The run was stopped by a token in
an angle that is **never rendered**.

### The precise gap between the two passes

Both live in `answerPageOperatorQuestions` (`step4c-multiad-publish.ts:219-301`):

| step | line | scope | result |
|---|---|---|---|
| `collectTokens(activeContent)` | 236 | **ACTIVE angle only** | did not see `[INSERT_CART_CLOSE]` |
| `deriveOperatorQuestions(pageType, activeContent, …)` | 237 | **ACTIVE angle only** | derived **`[INSERT_PRICE]`** and nothing else |
| the write loop `for (const col of ANGLE_COLS)` | 258 | **ALL FOUR angles** | wrote the price answer into every angle |
| re-derive `remaining` | 289 | **ACTIVE angle only** | ✅ 0 remaining — passed |
| `assertNoOperatorTokens` per column | **296-298** | **ALL FOUR angles** | 🔴 **threw on `dollarAngle`** |

🔑 **Derivation reads ONE angle; the final assertion checks FOUR.** A token that exists only in a
non-active angle is therefore *structurally unreachable* by the answering pass and *structurally
fatal* to the assertion. There is no input for which this run could have succeeded.

### ⚠️ The script's own error advice is WRONG for this case

The thrown message says *"Add the token to `CANNED_OPERATOR_ANSWERS` in `step4cPageAnswers.ts`
rather than loosening the gate."* **That would not have fixed it.** The plan is built from
`planOperatorAnswers(baked, asked)`, and `[INSERT_CART_CLOSE]` appears in NEITHER input because
both are computed from the active angle alone. A canned answer for a token that is never planned is
never applied. Following the advice literally produces a second identical failure.

### The two real fixes — this is a decision, not a mechanism CC should pick

- **(a) Widen derivation to all angles** — make `baked`/`asked` span `ANGLE_COLS`, matching the
  write loop and the assertion. Conservative: keeps the strict check and makes it satisfiable.
- **(b) Narrow the assertion to the active angle** — matches the publisher, which is what
  "mirrors the publisher" implies, and matches `assertRenderedPageIsClean`.

⚠️ **(b) has a real hazard:** `activeAngle` is user-switchable. A token parked in a non-active
angle becomes live the moment someone switches angles, and the page then renders with a token in
it. **(a) is the safer shape**, at the cost of answering questions for angles that may never ship.

---

## 2. 🔴 SEPARATE LATENT DEFECT FOUND WHILE DIAGNOSING — the coach-scoped snapshot CANNOT RUN

**This is a present-tense bug, not the future-token risk recorded in CHECKPOINT §0a item 6.**

- The DB column is **`users.booking_url`** (snake_case) — confirmed against `INFORMATION_SCHEMA`.
- The registry carries **`path: "bookingUrl"`** (`operatorFields.ts:200`) — the Drizzle JS key.
- `coachColumn.column = resolution.structured.path` (`operatorFields.ts:390`), so it is `"bookingUrl"`.
- The harness snapshot runs **raw SQL**: ``sql`SELECT ${sql.identifier(coachColumn.column)} AS v FROM users …` ``
  (`step4c-multiad-publish.ts:273-275`) → emits `` SELECT `bookingUrl` `` → **`ERROR 1054 Unknown
  column 'bookingUrl'`**. Reproduced directly: the identical query failed with exactly that error.
- The **write** on line 279 goes through Drizzle, which maps the key correctly, so the write works.

**Consequence: any page whose operator questions include `[INSERT_BOOKING_URL]` hard-crashes
`--prepare` at the snapshot line.** The snapshot read precedes the write, so it throws first — which
is fail-safe (no unreversed write can occur) but means **the coach-scoped snapshot path has never
executed successfully and cannot.** §0a item 6's premise — *"`--prepare` snapshots the prior value
before writing and `--teardown` restores it"* — is **false today**.

This run dodged it only because `[INSERT_PRICE]` was the sole derived question. Verified: the
`⚠️ wrote users.<col>` log line appears **0 times**, so no coach-scoped write occurred and
`users.booking_url` was not modified.

📌 Textbook instance of **CLAUDE.md §9 trap 1** (snake_case DB column vs JS key), in a file whose
own docblock is careful about the registry.

---

## 3. Compliance-gate record for this run

Per-angle failures, from the generator log:

| attempt | angle | classes tripped |
|---|---|---|
| 1/3 | `dollar` | `clinical_outcome_claim` |
| 1/3 | `godfather` | `second_person_protected_attribute`, `clinical_outcome_claim` |
| 1/3 | `free` | `second_person_protected_attribute`, `clinical_outcome_claim` |
| 2/3 | `godfather` | `deceptive_urgency` |

**`original` never appears in the retry log** — it passed on first attempt.

**Persistence-gate decision:**

> `[persistenceGate] landingPages: every row carried a blocking claim (classes=[deceptive_urgency,
> promised_result, second_person_protected_attribute, unearned_authority, invented_testimonial,
> invented_guarantee]). Keeping the batch rather than emptying the node — publish gate remains the
> hard stop.`

⚠️ **Note the disagreement, and do not read past it.** The retry log shows `original` passing, while
the persistence gate reports that **every** row carried a blocking claim — a union spanning four
classes never seen in the retry log. Both cannot be describing the same evaluation. Since `original`
is the ACTIVE angle, this matters: it is the angle that would publish and the one
`checkAdToPageMatch` would judge at `--publish`. **Which of the two is authoritative is unresolved
and is worth settling before the next attempt** — a page that passes the token gate may still be
carrying a blocking claim into the ad-to-page gate.

---

## 4. Preserved artifacts

`docs/screenshots/run-2026-08-12-step4c-prepare/` — **12 files, three per creative**, confirming the
0099 three-object pattern (composite · raw · intermediate source), all with the documented
`.png.png` double suffix:

- `495-composite.png` (+ `-raw`, `-source`)
- `496-composite.png` (+ `-raw`, `-source`)
- **`497-composite-BLANK-HOOK-BAND.png`** (+ `-raw`, `-source`)
- `498-composite.png` (+ `-raw`, `-source`)

### ✅ THE BLANK-HOOK-BAND BRANCH FIRED LIVE FOR THE FIRST TIME

Node 7 kept **3 hooks against 4 render slots**. `dealHooksByConcept` never reuses a row, so slot 3
baked no hook line. Confirmed in the database — **creative 497 carries `hookAdCopyId = NULL`** while
495/496/498 carry 6172/6170/6171 — and confirmed on the pixels: 497 renders headline plus CTA pill
with **no hook band at all**, not a fallback line and not a repeat.

This retires the "never fired live" half of **§0a item 2**. The remaining half stands: **whether a
blank band is acceptable is a pixel judgement and Arfeen's alone** (§6). It has not been made.

📌 Third independent run where the hook surface landed at 3, not 4. More evidence that the hook
surface is the binding constraint on 4 → 8 (§0a item 1).

---

## 5. State + teardown reconciliation

`/tmp/step4c-state.json` records:

```
phase prepare · host iMac.local · label "ZZ-4C-MULTIAD — throwaway, safe to delete"
serviceId 313 · icpId 287 · conceptCount 8 · adSetId MqGYlX-BFJdSz1xjRUzUM
batchId batch-1786538755783-e2ae8858 · landingPageId 238
```

⚠️ **It names FIVE identifiers, not six. Creatives 495–498 are NOT enumerated** — they are addressed
through `batchId`, which is how `sweepAdCreativeBatch(db, batchId, userId)` resolves and sweeps
them. That is by design and teardown can clear them; but if the batch id were ever wrong, nothing in
the state file would independently name the rows.

⚠️ **`answeredTokens` and `coachFieldsBefore` are ABSENT from the state file.** The throw happened at
line 298, *inside* `answerPageOperatorQuestions` and before its `return`, so
`saveState({ answeredTokens, coachFieldsBefore })` at line 450 never ran. Harmless here — the only
answer was `[INSERT_PRICE]`, which is page-scoped and dies with the page — but it means **a crash
inside the answering pass leaves no record of answers already written.**

### Reconciliation targets for teardown

| metric | pre-run baseline | now | after teardown |
|---|---|---|---|
| `adCopy` | **5424** | 5466 (+42) | **5424** |
| `headlines` | **2174** | 2174 (Node 6 never ran) | **2174** |
| `adCreatives` | **405** | 409 (+4) | **405** |
| `campaignConcepts` | **6** | 14 (+8) | **6** ← newly established |
| `meta_published_ads` | **2** | 2 (untouched) | **2** |
| protected | `272:5 273:5 275:5 276:5 277:5 285:4` = **29** | verified identical | **29** |

📌 **The concept baseline of 6 is recorded here for the first time.** §12.10 banks adCopy/headlines/
adCreatives but has never carried a concept figure, so there was previously nothing to reconcile the
concept count against. Add it to §12.10.

Teardown will **skip the Meta phase entirely** — the ledger is 0 bytes and no campaign id exists in
either the ledger or the state, which is the documented skip condition. Nothing on the ad account.

---

## 6. Confirmation that Meta was never touched

Three independent checks:

1. `/tmp/step4c-ledger.jsonl` is **0 bytes**.
2. A scan of the full run output for `graph.facebook`, `createCampaign`, `createAdSet`,
   `createAdCreative`, `createAd`, `GET /me` and `act_1254349025145319` returns **0 hits**.
3. Structural: `assertTokenLive` and all four Graph calls exist only inside `publish()`, which was
   never invoked — the dispatcher ran `prepare` alone.
