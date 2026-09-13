# ITEM 15 — 2026-09-13: both authorised fixes built; bonus-34 clean and live; 35 + 44 are node defects

Resumed from `CHECKPOINT_2026-09-13_ITEM15_TWO_FIXES_AUTHORIZED.md`. Every number measured at run time (§15f).

## 0. Ground truth at start (measured)

`origin/railway-build` = `9156875` (Railway: SUCCESS, 2026-09-10 19:44 UTC) · `main` = `67517e3` · held branch
`docs/held-2026-09-12` = `6d88070` on origin · local `railway-build` = `aa9209b` · tsc 34 · 0 tracked changes.
**Nothing deployed this session. Nothing committed or pushed at the time of writing.**

## 1. The fixes

**Fix 1 — separate accumulating slots** (`server/leadMagnetContentGenerator.ts`). The attempt loop moved into
exported `generateBodyWithRetries`; `generateLeadMagnetContent` now calls it. `timedViolations` (distinct clocks,
deduped on match+line) and `shapeNotes` (distinct shape faults) accumulate across the run; neither clears the
other. The thin-body branch now records a SPECIFIC shape note (`bodyShapeNote`) — §14a post-hoc form. The
`catch` branch is unchanged. **Budget of 3 untouched.**

**Fix 2 — exemption narrowed** (`server/_core/timedClaimScanner.ts`). A clock in quoted speech is judged on its
CLAUSE inside the innermost quote. It loses the exemption when the clause carries a figure besides the clock, or
the clock is itself quantified — unless the clause only schedules an event (`launch is in four days`).

⚠️ **Corrected once before any write.** The first version flagged every quantified clock in speech. The
before-scan showed it flagging bonus-34's third-person anchor *"she's been avoiding for two weeks, launch is in
four days"* — scene-setting that §14b says never bars a write. The event-schedule carve-out was added and that
line is now a permanent exempt control (`LIVE_EXEMPT.x34`). **Known residual:** a first-person schedule line
("I have a call in 20 minutes") is flagged — the safe direction.

The fail-context no longer says a quoted timeframe "is fine"; it names the spoken line when a figure is the fault.

## 2. Gates

- `npx tsc --noEmit` = **34** (a transient 35 from a `matchAll` spread was fixed).
- scanner 36 + retry slots 5 = **41/41** · pipeline-fixes 414 · offerStandard 13 · promptPins 21 ·
  leadMagnetOfferMode 9 · leadMagnetClose 12 · complianceFilter 31 · tokenCrypto 10.
- **Negative controls (§15c), all fire:** restoring the thin-clears-timed behaviour fails the timed→thin→timed
  test; removing the event carve-out fails x34; ignoring clause figures fails 2; restoring the old any-quote
  exemption fails 5. Restored file md5-verified.
- ⚠️ **Pre-existing, not caused here:** `leadMagnetContentGenerator.bonus.test.ts` (1 fail) and
  `leadMagnetBounds.test.ts` (2 fails) fail identically on a clean `6d88070` worktree — stale text pins
  ("bridges to", "doable today") against prompt text the earlier item-15 work changed. Not in the gate list.

## 3. The re-run — `bonus-34`, `bonus-35`, `bonus-44` (bonus-33 refused by construction)

Mirrors `runBonusPdfGeneration`; pre-write gates: non-null body · 0 violations · no `[INSERT_*]` token.
A first launch died on module resolution before any generation — diff **539 compared, 0 changed**.

| page | attempts | outcome |
|---|---|---|
| **bonus-34** | thin (`tools` as string) → timed (`one sitting`) → **clean** | ✅ written + published |
| bonus-35 | thin (`tools` as string) → thin (same) → timed (`in the next three minutes`, `in 48 hours`, `in a week`) | 🔴 **NODE DEFECT**, not written |
| bonus-44 | timed (`within the next 90 days`, `today`) → thin (`tools` as string) → timed (`today`@nextStep.body) | 🔴 **NODE DEFECT**, not written |

🔴 **The thin-body cause is now visible, and it is the §15i shape.** Every thin body in this run was
`tools` returned as a **string** instead of an array — 4 of 9 attempts. The Anthropic tool-use path does not
enforce the schema's array type. With one family of three attempts lost to a malformed structure, 35 and 44 had
at most two shots at a clean body. Not retried, per the standing ruling.

## 4. bonus-34 before / after (live, by fetch)

- `one sitting` — before: *"Work through all twelve prompts in one sitting."* → after (tools.0.instructions):
  *"A twelve-prompt fill-in template — answer each prompt in raw, unedited language, then copy the completed page
  into a pinned doc you open every time you write."*
- `the same day` — before: *"…this is how you turn a completed document into live copy within the same day."* →
  the SOP is now *"The Discovery Call Voice Mining SOP … A four-step process to run after any discovery call or
  client session…"*
- `today` — before: *"write one email — right now, today — using nothing but your Brand Brief"* → gone.
- **Fetched three times, four minutes apart (15:12:43, 15:16:49, 15:20:54 UTC):** http 200, 25,200 bytes, md5
  `8ffc94f8aaacfdd51f58ab4c6e921c81` all three (before: 29,849 bytes, `ed34da32…`). bonus-35 (`9b44f887…`) and
  bonus-44 (`ecff2110…`) byte-identical to their before-captures on all three reads; 33/42/43 likewise unchanged.
- Live scan: **0 violations, 1 exempt** — *"What was the one sentence my client said today that I could have
  written into a sales page?"* (a question the coach asks themself; no figure).

## 5. Blast radius

Baseline snapshot 14:58:31 UTC, immediately before the run; after snapshot only once the run's report existed.
58 table checksums + whole-row MD5 (every column, NULL distinguished) on 467 hvcoTitles, 8 landingPages, 6 bonuses.
**539 compared · 2 changed · 0 unexpected**: bonus-34 (`updatedAt`, `assetBody`, `magnetPdfUrl`) and the
`bonuses` table checksum. bonus-34 `title`/`shortLine`/`description` unchanged; bonus-35/44 rows unchanged.

🔴 **Permanent consequence:** bonus-34's previous PDF address `v1785780554/bonuses_1_34.pdf.pdf` stays publicly
reachable with the old claims (settled Cloudinary finding). New: `v1789311838`. No purge attempted.

## 6. Open

1. **bonus-35 and bonus-44 are node defects** — root: `tools` delivered as a string. Candidate fix is a
   parse-and-coerce of a JSON-string array before the shape check (a repair, not a rejection). Not built;
   needs a ruling because it interacts with the parked budget question.
2. bonus-33 — unchanged, parked for item 14.
3. Nothing deployed; the fixes are uncommitted working-tree changes on `docs/held-2026-09-12`.

---

# ADDENDUM — 2026-09-13 (second pass): the `tools` repair built; bonus-35 and bonus-44 still node defects

Pass 1 committed as **`2349d6e`** on `docs/held-2026-09-12` (not pushed). The repair below is **uncommitted**.

## 1. The repair — `repairArrayField` (`server/leadMagnetContentGenerator.ts`)

Runs in `generateBodyWithRetries` BEFORE the shape check and the bounds. For guide/checklist/toolkit it recovers a
list delivered as a JSON-encoded string (or a stringified wrapper carrying the list) or as a numeric-keyed object —
**only into a list of objects**. Anything unrecoverable is left as it came, stays thin, and is logged with its
first 160 characters. Quiz untouched. **Budget still 3.**

**Gates:** tsc **34** · retry slots 10 + scanner 36 = **46/46** · pipeline-fixes 414 · offerStandard 13 · promptPins 21
· leadMagnetOfferMode 9 · leadMagnetClose 12 · complianceFilter 31 · tokenCrypto 10. Negative control: repair
disabled → the text-form `tools` test fails; restored, md5-verified. Pre-existing failures unchanged (Bounds 2, bonus 1).

## 2. Re-run — bonus-35 and bonus-44 (baseline 15:46:58 UTC; run finished 15:55:46; report written)

| page | attempts | outcome |
|---|---|---|
| bonus-35 | text `tools` **unrepairable** ×3 | 🔴 **NODE DEFECT**, not written |
| bonus-44 | text `tools` unrepairable → timed (`within 90 days`, `within 10 minutes`) → timed (`in the next 30 minutes`) | 🔴 **NODE DEFECT**, not written |

🔴 **What the new log proves.** The text is list-SHAPED — every one begins `[\n  {\n    "name": "…", "type": …` — but
**`JSON.parse` rejects it**, so the repair correctly declined it. The repair handles well-formed JSON-in-a-string;
the model's text is not well-formed. **The exact parse fault is NOT confirmed** — only 160 characters were captured.
Candidates, unverified: a raw control character inside a string value, an unescaped quote in markdown content, or
a truncated string. **Next step, if approved: capture the full string and the parse error position (instrumentation
only, no retry), then decide whether a tolerant parse is structurally sound.**

bonus-44 shows a second, separate fact: once the list parsed, the correction was carried (both slots working) and the
node still re-introduced a fresh clock each attempt (`within 10 minutes` → `in the next 30 minutes`).

## 3. Blast radius — nothing written

**539 compared · 0 changed · 0 unexpected.** All 58 table checksums, 467 hvco, 8 landingPages, 6 bonuses identical.

## 4. Live pages — by fetch

bonus-35 `9b44f8872d00f20507a23fc8f4c571b0` (23,541 B) and bonus-44 `ecff211037eb8fbb876b57b33390aada` (22,772 B),
byte-identical to every earlier read this session — fetched three times, four minutes apart (15:56:31, 16:00:38,
16:04:43 UTC), http 200, identical md5 on every read, 1 violation each. Still live: 35 *"get words on the page in the next ten minutes"*;
44 *"three paying clients within 90 days of launching"*.

---

# ADDENDUM — 2026-09-13 (third pass): JSON-escaping fix + positive-only research rule. Gated. NOT re-run.

Commits before this pass: `2349d6e`, `f889c7d`, `7ce210e` (diagnostic folder) on `docs/held-2026-09-12`, none pushed.
**This pass is uncommitted. bonus-35/44 NOT re-run** — held for Arfeen's policy call on action-timeframes (the third
cause in `item15-diag-2026-09-13/DIAGNOSTIC.md` §2b.3). `services.ts` not touched (item-12 link logged there, §3).

## 1. JSON-escaping fix — strict tool use for lead-magnet bodies

**Chosen:** `strict: true` on the synthesised tool, so the API constrains sampling to the schema (grammar-constrained).
`tools` can then only be an array of objects and every value a properly escaped JSON string — quoted speech and
markdown included. Both captured fault classes (bare opening quote, `\_`) are impossible inside a grammar-valid
string. Confirmed against the live docs 2026-09-13: `claude-sonnet-4-6` and `claude-haiku-4-5-20251001` are
supported; no beta header; compatible with forced `tool_choice`; a raw schema with an unsupported keyword is a 400.

- `llm.ts` — new opt-in `strictToolUse` (NOT `json_schema.strict`: 20 call sites already set that inert field).
  `toStrictToolSchema` strips `maxLength`/`minLength`/`maxItems`/`minimum`/`maximum`/…, clamps `minItems` > 1 to 1,
  adds `additionalProperties: false`, and writes each removed bound into the field's `description` (the SDKs' own
  transformation). Bounds stay enforced after the response (`applyBodyBounds`, `validateQuizBody`, shape check).
- **Fallback:** a 400 on a strict request retries the same model once non-strict, logged `[LLM][strict]`. Covers a
  schema the grammar compiler refuses and the legacy ladder model `claude-3-haiku-20240307`.
- `leadMagnetContentGenerator.ts` — `leadMagnetRequest()` builds every attempt's request with `strictToolUse: true`.
  `repairArrayField` kept as a free check (§15j).
- **Rejected:** a tolerant parser for the malformed text (a bare quote is ambiguous — it cannot know where the value
  ends); a prompt instruction against stringifying (the email path does this and still fails ~50%); a model change.

## 2. Positive-only `NO_RESEARCH_STATISTIC_FABRICATION_RULE`

Every quoted wrong shape removed ("within 90 seconds of waking", "lose 47 minutes per interruption", "92% of…",
"a Harvard study found", "studies show"). States the requirement: every figure describing a group of people, and
every named study or institution, comes from the input fields. Positive ladder kept (the pinned phrases). The
header marker `NO RESEARCH STATISTIC FABRICATION` kept (pinned). "[n] cohorts" became "the people I've worked with"
— an invented count had been invited by the example. Appended to lead-magnet, email, WhatsApp and landing-page prompts.

**Prompt pins:** the four `magnet-bonus-*` recordings were updated by a script that proved, per file, that the old
rule appeared exactly once, that swapping in the new rule makes `system` byte-identical to the current code, and that
`user` and `schema` are unchanged. No other pin moved.

## 3. Gates

- `npx tsc --noEmit` = **34**.
- New: `strictToolSchema.test.ts` **9/9** · `researchStatRule.test.ts` **3/3**. Changed/related: retry slots 10/10 ·
  scanner 36/36. Named: pipeline-fixes 414 · offerStandard 13 · promptPins 21 · leadMagnetOfferMode 9 ·
  leadMagnetClose 12 · complianceFilter 31 · tokenCrypto 10.
- In-suite negative controls: every lead-magnet schema as written fails the strict-subset check; the pre-rewrite
  rule fails all four exemplar checks; a non-opted-in call is byte-identical to before; a non-strict 400 still throws.
- Pre-existing, unchanged: leadMagnetBounds 2 · leadMagnetContentGenerator.bonus 1.
- ⚠️ **NOT PROVEN LIVE:** no API call was made this pass. First thing on the next run: confirm no `[LLM][strict]`
  fallback line appears (a fallback on every call would mean strict is silently off) and that `tools` is an array.
- **Mutation checks (§15c), restored md5-verified:** strict flag deleted from the tool definition in `llm.ts` →
  `strictToolSchema` fails the opted-in and refused-schema tests; generator opt-in set false → fails 1; pre-rewrite
  rule restored → `researchStatRule` fails 2. (A first M1 attempt produced a syntax error and ran no tests — a crash,
  not a detection — and was redone.)

---

# ADDENDUM — 2026-09-13 (fourth pass): action-timing ruling built; bonus-35/44 re-run. 🔴 bonus-35 PUBLISHED DEGENERATE.

Pass 3 committed as `265207f` (not pushed). **This pass is uncommitted.**

## 1. The ruling and the scanner change

Arfeen, confirmed 2026-09-13: **a timeframe on the reader's ACTION is not a §14b violation; only a timeframe on the
reader's outcome or result is.** `timedClaimScanner.ts` `isActionTiming`: outside quoted speech, a hit is exempt
(`action-timing`) only when its clause opens with a reader-instruction verb, nothing before the clock turns it toward a
result (`to`, `and`, `you`, `your`, `get`, `have`…), the clause names no outcome (`you'll`, `you can`, `results`,
`ready`), and it carries no figure besides the clock. Fixture `LIVE_ACTION_TIMING` = the three real lines the diagnostic
captured. Fail-context now says an action timing may stay.

**Gates:** tsc **34** · scanner **43/43** (36 prior unchanged + 7 new: 3 live action lines pass, 7 same-verb outcome
controls fail, every 2026-09-12 live violation still fails) · retry slots 10 · strictToolSchema 9 · researchStatRule 3 ·
pipeline-fixes 414 · offerStandard 13 · promptPins 21 · leadMagnetOfferMode 9 · leadMagnetClose 12 · complianceFilter 31
· tokenCrypto 10. Pre-existing unchanged: Bounds 2, bonus 1. Mutations: exemption off → 3 fail; every clause forced to
action → every live violation fails. Restored md5-verified.

## 2. Re-run — baseline 17:16:12 UTC, run 17:16–17:20, report written, then after-snapshot

**Strict mode, per attempt, from the request actually sent (fetch wrapper):** 3 of 3 requests `strict: true`, HTTP 200,
`claude-sonnet-4-6`, **0 `[LLM][strict]` fallbacks**, `tools` a real array every time (35: array(2); 44: array(4), array(4)).

| page | attempts | outcome |
|---|---|---|
| bonus-35 | attempt 1 accepted | 🔴 **WRITTEN + PUBLISHED — DEGENERATE** (§3) |
| bonus-44 | attempt 1 rejected (`next 90 days` — outcome, correctly); attempt 2 clean, 1 exempt `action-timing` | ✅ written + published |

**Blast radius:** 539 compared · **3 changed** (bonus-35, bonus-44, `bonuses` checksum) · **0 unexpected.**

## 3. 🔴 bonus-35 — a broken deliverable reached the live page

Output **459 tokens**, `stop_reason: tool_use` (a full body runs 3,700–3,900). The model stopped early and filled the
required fields with placeholders, and the gates passed it:

- `tools` = **2** (floor is 3): tool 0 content **266 chars**, cut off at *"Script 1 — The Discovery Call Pivot"*;
  tool 1 is `name: "x"`, `type: "swipe"`, `instructions: "x"`, `content: "x"`.
- `nextStep` = `{ heading: "x", body: "x", ctaLabel: "x" }`.
- promise: *"…redirect yourself back into the copy **in under two minutes**."* — a timed OUTCOME claim the scanner
  **did not see** (`0 violations, 0 exempt`): the pattern requires in/within immediately before the number, so
  `in under two` passes. A hedged-timeframe sweep of both new bodies found this one hit only.
- Live page 23,541 → **7,412 bytes**. New PDF `v1789319816`; previous `v1789220011` stays public (settled finding).

**Why it got through — two gaps, the first introduced by pass 3:**
1. Strict mode requires `minItems` ≤ 1, so `toStrictToolSchema` clamped the toolkit's `minItems: 3` to 1 and moved the 3
   into a description. The generator's shape check only requires `tools.length > 0`, and nothing checks content length
   or placeholder values. Before strict, the schema's `minItems: 3` was steering the model; now nothing enforces it.
2. The scanner is blind to hedged timeframes (`in under N`, `in less than N`, `in just N`).

**Not corrected.** A corrective republish is a production write and needs Arfeen's go-ahead.

## 4. bonus-44 — clean

- Before (tools.1): *"'It's [INVESTMENT AMOUNT]. The goal the programme is built around is three paying clients within
  90 days of launching…'"* → gone. The new body contains no "90" and no "three paying clients".
- Promise after: *"These scripts give you the exact sentences to say in three high-stakes conversations — so 'I don't
  have my niche yet' stops being a reason to wait and becomes something you can move straight through."*
- 4 tools, content 1,975 / 3,410 / 3,634 / 2,979 chars; real `nextStep`. One exempt: *"Check the script that matches
  today's conversation:"* — `action-timing`. Hedged sweep: 0. Page 22,772 → 24,581 bytes. New PDF `v1789320008`;
  previous `v1789220451` stays public.

## 5. Live pages — fetched three times, four minutes apart (17:20:50 · 17:24:57 · 17:29:00 UTC)

- bonus-35: http 200, **7,412 bytes**, md5 `425de5e35103dacfa602b9baef4f10c4` on all three reads (before: 23,541 B,
  `9b44f887…`). The degenerate body is what is live: 6 lines reading `x`, and *"in under two minutes"* in the promise.
- bonus-44: http 200, **24,581 bytes**, md5 `7e4d395c13bf7213dc62151c5e4255fc` on all three (before: 22,772 B, `ecff2110…`).
  Scan 0 violations, 1 exempt (`action-timing`).
- bonus-33, 34, 42, 43 byte-identical to their pre-run captures.

---

# ADDENDUM — 2026-09-14 (fifth pass): content floor + hedged clocks built; bonus-35 re-run. 🔴 LIVE BUT INCOMPLETE — NODE DEFECT.

Pass 4 is uncommitted too (action-timing ruling). **This pass is uncommitted.** Production code still `9156875`.

## 1. The two fixes

**Content floor** — `bodyCompleteness` in `leadMagnetContentGenerator.ts`, checked after the response, before the §14b
scan. Enforces the format's `BOUNDS.minItems` (strict mode can only send `minItems` ≤ 1), minimum lengths per field, and
rejects any one-character value. Floors set far below every complete body measured 2026-09-14 (production: 7 bodies;
this item's captures: 6): toolkit content 400 (measured min 1,424), instructions 30 (95), name 8 (24); checklist detail
60 (296), label 8 (40); promise 40 (198); howToUse 80 (388); nextStep body 40 (453), heading 8 (43), ctaLabel 4 (26).
⚠️ Guide floors uncalibrated — no guide body exists in production. Quiz left to `validateQuizBody`.
Regression fixture: `server/__fixtures__/degenerate-bonus-35-2026-09-13.json` — the exact body published on 2026-09-13.
Positive control: `complete-bonus-44-2026-09-13.json`.

**Hedged clocks** — `timedClaimScanner.ts`: `in/within … under | less than | fewer than | just | only | about | around |
roughly | barely | as little as | no more than N unit`, and bare `less/fewer than N unit`, `just N unit`, `under N unit`.
Hits still pass through quoted-speech, refund-window and action-timing rules unchanged.

**Gates:** tsc **34** · completeness **9/9** · scanner **48/48** (43 prior unchanged + 5) · retry slots 10 (fixtures
raised to meet the floor) · strictToolSchema 9 · researchStatRule 3 · pipeline-fixes 414 · offerStandard 13 · promptPins
21 · leadMagnetOfferMode 9 · leadMagnetClose 12 · complianceFilter 31 · tokenCrypto 10. Pre-existing unchanged: Bounds 2,
bonus 1. Mutations: floor off → degenerate regression fails; hedge patterns removed → 3 fail. md5-restored.
Widened scanner on all six live pages: only new hit is bonus-35's own `in under two minutes`.

## 2. Re-run bonus-35 — baseline 20:48:09 UTC, run to 20:51:34, report written, then after-snapshot

**Strict mode, from the request actually sent:** 3/3 `strict: true`, HTTP 200, `claude-sonnet-4-6`, **0 fallbacks**,
`tools` a real array every attempt.

| attempt | out tokens | result |
|---|---|---|
| 1 | 717 | 🟢 **floor caught it** — 2 tools, tools.0 261 chars. Degenerate again; last pass this reached the live page |
| 2 | 3,774 | rejected §14b — `today`, `in seven days`, `under five minutes` (a hedged clock the old pattern missed) |
| 3 | 3,826 | passed every gate → **written + published** |

**Blast radius:** 539 compared · **2 changed** (bonus-35 row, `bonuses` checksum) · **0 unexpected.**

## 3. 🔴 What went live is NOT complete — the gates passed it

- Promise: *"These seventeen scripts hand you the exact words to redirect the 'my brain doesn't write' conviction the
  moment it surfaces, so you stay in the session and finish the copy."* — no clock, but it names **seventeen**.
- **Scripts delivered: 1–13, plus a reference to 15 in the worksheet. Scripts 14, 16, 17 are absent.**
- tools.0 *"Master Script Bank — All 17 Prompts"*: **404 chars** — a how-to paragraph and a section heading, ending at
  *"Script 1 — The Discovery Call Redirect"* with nothing under it. It cleared the 400 floor by four characters.
- tools.3 *"The 17-Script Bank — Expanded (All Sections, All Scripts)"*: returned at 5,142 chars, **cut by `applyBodyBounds`
  to 3,952 at the 4,000 cap**, ending at Script 13.
- Otherwise: 4 tools, howToUse and nextStep complete; 0 violations; 1 exempt — `in a second`, from *"Keep it open in a
  second tab"* — a pre-existing pattern misread ("a second" is not a clock), exempted as action timing, blocked nothing.

**Why this is a node defect, not a gate fix in waiting:** the node is asked for a 17-script bank inside tools capped at
4,000 characters each. It split the bank across two tools, left one a stub, and the upper-bound repair — designed to
"repair, never reject" — cut the other mid-set. The content floor measures length, not whether a promise's stated count
is delivered. Three separate mechanisms each behaved as designed, and the page promises more than it holds.

**Not corrected.** Any further write needs Arfeen's go-ahead. New PDF `v1789332694`; previous addresses stay public.

## 4. INVESTIGATION (2026-09-14, read-only, no fix proposed) — the "seventeen" mismatch on live bonus-35

### 4a. Where the count comes from — the INPUT, not the model

- `bonuses.description` for bonus-35 (read from production 2026-09-14; created 2026-08-03, unchanged since) says:
  *"This script bank hands you **seventeen** pre-written self-coaching prompts and perspective-shift scripts … Each
  script is one to three sentences long…"* `bonusPdfGenerator.ts:54` hands that description to the body generator as
  the MUST-MATCH brief. The model restates the number in the promise and in tool names ("The 17-Script Bank").
- The count was born in the bonus generator's ORIGINAL output (2026-08-03). The instruction now in
  `bonusGenerator.ts:121` ("describe the asset itself — its length, or how many steps, items or fill-in fields it
  holds") arrived with item 15 in `6d88070` (2026-09-13), after this description existed. It invites such counts for
  every future bonus.
- **Structurally nothing links a stated count to what is delivered.** `promise` and tool `name` are free strings; the
  toolkit schema has no count field; no code anywhere compares a number in prose to the items produced (searched).
- **The model CAN deliver the count** (instrument: bold `Script …` headings, letter or number labels):

| body | scripts | chars / script | trim |
|---|---|---|---|
| diagnostic attempt 3, raw | **17** (A1–C5), one tool, 3,791 c | ≈223 | none — fits |
| diagnostic attempt 2, raw | **17**, one tool, 4,454 c | ≈262 | cut to 3,780 → **15** |
| live (pass 5 attempt 3) | **13** in tools.3 (3,952 c after trim) + tools.0 a 404 c stub holding only Script 1's heading | ≈304 | tools.3 5,142 → 3,952 |

  Whether 17 scripts survive depends on how long the model writes each one against a fixed per-tool cap. ⚠️ An earlier
  reading this pass reported attempt 3 as "scripts 1–3" — that was the counter missing `Script A1` labels, not the body.

### 4b. The trim, independent of what the model wrote

- `applyBodyBounds` → `capBlock` → `truncateAtBlock` (`cascadeContext.ts:232`) keeps text up to the last block start
  under 4,000 characters. It reads only that one string. It does not see the promise, the tool name, or any count. Its
  only record is a `console.log` of `field(from->to)`; nothing downstream re-checks the trimmed body against a stated
  count (the completeness floor measures length, the §14b scan measures clocks).
- The 4,000 cap is rule 2 of the SIZE LIMITS derivation (`leadMagnetContentGenerator.ts:375`): an outlier threshold on
  measured field length — "repair after, never reject". It carries no notion of a brief's item count.
- **Measured, not inferred:** replaying the production trim on diagnostic attempt 2's raw output — a body that
  delivered all 17 scripts under a tool named "The 17-Script Reframe Bank" — **deletes scripts 16 and 17.** The trim
  alone turns a matching body into a mismatched one.
- **Live body:** the trim cut tools.3 by 1,190 characters and it now ends at Script 13. The pre-trim text was not
  captured, so that scripts 14–17 were in the cut portion is an INFERENCE (≈304 c/script × 4 ≈ 1,216 c), not a
  measurement. tools.0's 404 c stub was not trimmed — the model wrote it that way.

**So there are two causes, and they compound:** the input states a count that the per-tool cap can only hold when
scripts are short, and the trim removes delivered items silently with no knowledge of the count it breaks.

### Pass 5 live confirmation — bonus-35 fetched three times, four minutes apart (20:52:16 · 20:56:21 · 21:00:24 UTC)
http 200, **21,586 bytes**, md5 `dc3044dabb0133216d83f83a6acd270f` on all three (before: 7,412 B, `425de5e3…`). Scan 0
violations, 1 exempt (`in a second` — "Keep it open in a second tab", a pattern misread, exempted as action timing).
bonus-33, 34, 42, 43, 44 byte-identical to their pre-run captures.

---

# ADDENDUM — 2026-09-14 (sixth pass): the declared-count gate. Passes 4–5 committed as `d32e2c8` (not pushed).

## 📌 LOGGED, NOT TOUCHED — for whoever next scopes bonus-description generation

**`server/bonusGenerator.ts:121`** instructs every new bonus description to *"describe the asset itself (its length, or how
many steps, items or fill-in fields it holds)"*. It arrived with item 15 in `6d88070` (2026-09-13) as the §14b
alternative to a timed promise. It sets up the bonus-35 mismatch on every future bonus: the description states a count,
the description becomes the body generator's MUST-MATCH brief, and a toolkit tool's content is capped at 4,000
characters. **Out of scope for item 15. Not changed.**

## 🔴 TWO MORE LIVE MISMATCHES FOUND WHILE CALIBRATING — NOT TOUCHED

Measured 2026-09-14 against production `bonuses.description` and live `assetBody`:

- **bonus-34** — description "twelve targeted prompts"; promise *"Fill in all twelve prompts…"*. The brief tool
  "The Twelve-Prompt Voice Capture Brand Brief" is 3,897 chars and ends at an empty `## SECTION 4 — THE EDGES OF YOUR
  VOICE`: **Prompts 1–9 delivered, 10–12 absent**, while other tools send the reader to "Prompt 10" and "Prompt 11".
- **bonus-43** — description "five sequential steps"; promise *"Follow the five steps…"*. The SOP tool "(5 Steps)" is
  3,958 chars and ends inside STEP 3: **Steps 1–3 delivered, 4–5 absent**, while other tools send the reader to
  "SOP Step 4c", "Step 5", "Step 5c".

Both tools sit just under the 4,000 cap — the same trim shape as bonus-35. Published in earlier passes of this item
(bonus-43 on 2026-09-12, bonus-34 on 2026-09-13). Only bonus-35 is authorised for this pass.

## 1. The gate — `server/_core/declaredCount.ts` (uncommitted)

- `parseDeclaredCounts(description)` — a number followed within four words by a deliverable noun (script/prompt/reframe ·
  template · swipe/email/message/caption/headline · question · step · task/item/check · field · tool); counts < 2 ignored;
  stops at to/of/in/within/by/for/at/from/or/than/per/a/an/the/each/every. Calibrated on all six production
  descriptions: 33 → 7 task · 34 → 12 script · 35 → 17 script · 43 → 5 step · 42 none · 44 none.
- `countDeliveredItems` — checklist items / toolkit tools / guide sections where the noun is the container; otherwise
  distinct line-start headings of the family (`## Step 3`, `**Script A1**`) with ≥ 20 characters under them. **Per noun,
  largest set — never the sum:** a first version summed and read diagnostic attempt 3 as 22 (17 scripts + a worksheet's
  5 PROMPT headings). Stubs and in-sentence/table mentions never count. Both instruments fail closed.
- Wired: `generateBodyWithRetries({ declaredCounts })` — checked after `applyBodyBounds` alongside `bodyCompleteness`,
  so a trim below the declared count fails the attempt. `generateLeadMagnetContent({ countBrief })`;
  `bonusPdfGenerator` passes `b.description`. Lead magnets pass no count brief → no gate.

**Gates:** tsc **34** · declaredCount **15/15** · completeness 9 · retry slots 10 · strictToolSchema 9 · researchStatRule
3 · scanner 48 · pipeline-fixes 414 · offerStandard 13 · promptPins 21 · leadMagnetOfferMode 9 · leadMagnetClose 12 ·
complianceFilter 31 · tokenCrypto 10 · bonusPdfFormat 3 · node5Screening 16. Pre-existing unchanged: Bounds 2, bonus 1.
Mutations: gate removed from the loop → loop test fails; counter summing nouns → both inflation tests fail. md5-restored.
Tests include: live bonus-35 (declares 17, delivers 13) fails; attempt 2 passes pre-trim (17) and fails post-trim (15);
attempt 3 (Script A1–C5) passes; live bonus-34 (9 of 12) and bonus-43 (3 of 5) fail.

## 2. Re-run bonus-35 — baseline 21:09:15 UTC, run to 21:12:15, report written, then after-snapshot

**Strict:** 3/3 `strict: true`, HTTP 200, `claude-sonnet-4-6`, 0 fallbacks, `tools` an array every attempt.
Declared: **17 script** (`"seventeen … prompts"`).

| attempt | out tok | scripts raw → after trim | result |
|---|---|---|---|
| 1 | 4,173 | **17 → 14** (tool 5,046 → 3,991) | 🟢 **count gate rejected it** — the trim-induced mismatch, caught before publish |
| 2 | 853 | 0 → 0 | floor + count: tools 20–243 chars — degenerate |
| 3 | 2,807 | **17 → 17** (no content trim) | count gate PASSED; rejected by §14b: `in a second@nextStep.body`, 4 exempt |

🔴 **NODE DEFECT — null within the budget of 3. NOT WRITTEN.** Blast radius: **539 compared · 0 changed.**

⚠️ **Attempt 3 may have been lost to a scanner misread, UNCONFIRMED.** `in a second` is the same pattern shape that
exempted *"Keep it open in a second tab"* on the live page last pass (NUM `a` + UNIT `second` — not a clock). Failed
bodies are not persisted and the log carries only the summary, so the sentence itself was not captured. It may equally
be a genuine claim ("back to writing in a second"). The only body in three attempts that met its declared count was
refused on this one hit.

## 3. Live page — unchanged

bonus-35 fetched 21:13:06 UTC: http 200, 21,586 bytes, md5 `dc3044dabb0133216d83f83a6acd270f` — the pass-5 body
(promises seventeen, delivers 13) is still live. Rounds 2–3 below.
Rounds 2–3: 21:17:12 and 21:21:15 UTC — http 200, 21,586 bytes, md5 `dc3044dabb0133216d83f83a6acd270f` both times.
Three reads, four minutes apart, identical: nothing changed on the live page.

## 4. 📌 FOLLOW-ON WORK FOR ITEM 15 — NOT A NEW ITEM (Arfeen, 2026-09-14)

**Once bonus-35 is resolved,** check **bonus-34** and **bonus-43** against the declared-count gate and correct each that
fails it. Both are already live with the promise/delivery mismatch the gate exists to catch:

- **bonus-34** — description "twelve targeted prompts"; live body delivers **Prompts 1–9** (brief tool 3,897 chars,
  ends at an empty `## SECTION 4`). The gate already reads it: *declares 12 scripts, delivers 9*.
- **bonus-43** — description "five sequential steps"; live body delivers **Steps 1–3** (SOP tool 3,958 chars, ends
  inside STEP 3). The gate already reads it: *declares 5 steps, delivers 3*.

Not acted on in this pass. Both are regression cases in `server/_core/declaredCount.test.ts`.

## 5. READ-ONLY CAPTURE (2026-09-14, approved) — "in a second": not reproduced

Full record: **`docs/handovers/item15-diag-2026-09-14/CAPTURE.md`**. 0 writes (539 compared, 0 changed). Strict held 3/3.

- **None of three fresh attempts contained "in a second".** Pass 6 attempt 3's sentence was never persisted and cannot
  be recovered; genuine-vs-misread for that one hit is **unresolved by evidence**.
- The capture did expose the scanner on real output: **3 genuine** outcome clocks (*"in under three minutes"*,
  *"in 12 Minutes"* in a tool name, *"in under two minutes"*) and **2 misreads** — a trigger condition (*"after 90
  seconds you have typed nothing"*) and scene-setting speech (*"Nothing I write in the next twenty minutes is going
  public"*).
- Attempt 3 again met its declared count (17) and floor; refused on one genuine + one misread hit.
- **Scanner not touched. No real re-run.**
