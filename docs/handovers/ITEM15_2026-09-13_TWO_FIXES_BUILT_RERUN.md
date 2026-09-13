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
