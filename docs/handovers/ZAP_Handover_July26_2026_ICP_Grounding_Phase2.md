# ZAP Handover — July 26, 2026 — ICP GROUNDING Phase 2 — ✅ SHIPPED + LIVE (first cut)

**Status: SHIPPED + LIVE. `HEAD = origin/railway-build = fecd7fc`. Migration `0096` APPLIED to prod via Arfeen's
explicit "execute" and verified. Railway SUCCESS on the exact SHA, prod 200.**

🔴 **This is the FIRST CUT of the ICP sprint, not the finish line** — see §6 for what is still gated or unbuilt.
Everything Andromeda stays DRAFT-only until ICP grounding fully lands.

Supersedes nothing — this sits on top of `ZAP_Handover_July26_2026.md` (Andromeda spine).

---

## 1. Phase 1 — CONFIRMED (the load-bearing assumption held)

The proposal rested on an INFERRED claim: *most vividness lives in Class-B prose, not Class-A specifics.*
It was tested, not asserted, on **two real coach ICPs from two different non-Arfeen accounts** (#217 user 107432
parenting, #218 user 1613 solopreneurs), three arms each:

* **ORIGINAL** — the row on prod
* **CONTROL** — fresh run of the *current* prompt (the run-to-run noise floor)
* **HARDENED** — Class-A grounded, Class-B instructions byte-identical

**Result: the magic survives.** Hardened prose sat inside or above the ORIGINAL↔CONTROL noise band on every
concreteness proxy (clock-times, digits, first-person density, quoted speech); on #217 hardened was the *most*
concrete of the three. Qualitatively, "two likes, one of them from my mum" (original) vs "four likes, two of
which were mine" (hardened) — same trick, no loss.

**Baseline fabrication documented:** #217's *entire* generator input is **322 characters**. From it the stored
profile asserts as fact `$75,000–$160,000` household income, `Bachelor's degree or higher`, five countries,
and **seven named real people** (Cara Dumaplin, Dr. Daniel Golshevsky, Kim West, Dr. Becky Kennedy…) with
claims attached. #218 likewise names Justin Welsh, Chris Do, April Dunford and specific newsletters.

---

## 2. Phase 2 — what SHIPPED

### Core
| Piece | File | Notes |
|---|---|---|
| Single prompt source + angle as parameter | `server/_core/icpPrompts.ts` | Class-A grounding written **in place** into sections 4/12/13 (no re-numbering — that was the Phase-1 bug). Exports `ICP_JSON_SCHEMA`, previously duplicated in 4 places. |
| Structural gate + R3 labelling + provenance | `server/_core/icpGrounding.ts` *(new)* | `validateIcpStructure` (hard gate), `validateIcpGrounding` (4 R3 modes), `computeIcpProvenance`, `normalizeDemographics`. Reuses `bonusWordOverlap` for traceability. |
| Shared generation runner | `server/_core/icpGenerate.ts` *(new)* | structural → retry then **throw** (malformed never persists); grounding → retry then **label-and-persist**. Retry 1→3, mirrors the bonus generator's hit/failContext shape. |
| Shared sanitiser | `server/_core/icpSanitize.ts` *(new)* | `stripObjectionScaffolding` extracted so the angle path gets it too. |
| Migration **APPLIED + VERIFIED** | `drizzle/0096_icp_grounding_provenance.sql` | one additive nullable `groundingMeta JSON` column, for Class-B provenance. |

### The three sibling fixes — all done
1. **`icpAngleSuggestions` duplication KILLED.** It carried its own near-verbatim copy of the 17-section prompt
   (`icpAngleSuggestions.ts:224-369`) which silently missed every improvement to the shared one **and ran with
   no compliance filter at all**. Now calls `runIcpGeneration` with the angle as a parameter, and gains the
   compliance filter + objection strip it never had. −146 lines.
2. **`regenerateSection` brought under guards.** It used a generic system prompt, no ground truth, no compliance
   filter, and wrote straight to the column. Now: real `ICP_SYSTEM_PROMPT`, the service row as authoritative
   ground truth, Class-A rule for demographics/media/influencers, `filterRecord`, objection strip.
3. **Demographics casing bug FIXED.** Schema declared `ageRange`, generators write `age_range`, the export read
   `ageRange` → **the demographics table rendered empty in every export of a generated ICP**. Canonicalised on
   snake_case + `normalizeDemographics()` accepts all three historical shapes.
   *Second bug found while fixing it:* `autoMode.ts:331` wrote the free-text import blob as `{ ageRange: blob }`
   — a key no reader understood, which also blocked `icpEnrichment` from ever filling demographics. Now
   `{ summary: blob }`, rendered as "Who They Are".

### Gates
* **TS 35** — provably identical error *set* to HEAD (captured HEAD baseline via `git stash`, diffed normalised;
  only line numbers moved). Zero new errors.
* **Tests 424 pass** — `pipeline-fixes` 382 + `campaignExport` 18 + **24** in `server/icpGrounding.test.ts`.
* Guards intact: no `@playwright/test`, no `package-lock.json`, `pnpm install --frozen-lockfile` passes.

---

## 3. ✅ BLOCKER RESOLVED — Class A REMOVED (revised direction, locked with Arfeen)

The earlier "harden Class A to Not specified" approach hit a structural bug that no prompt wording fixed:
the model kept hoisting the seven demographic values out of their nested object into top-level keys
(23 keys instead of 17), often enough on some services that 3 retries never recovered — one test service
3/3 clean, the other 3/3 hard-fail.

**Revised direction (locked): `demographics`, `mediaConsumption` and `influencers` are REMOVED from ICP
generation entirely.** Not hardened, not "Not specified" — the model no longer produces them.

Why:
* **No downstream generator reads any of them** — verified across all twelve.
* They are **fossils of interest-based Meta targeting**; Andromeda made the *creative* the targeting instrument.
* `influencers`/`mediaConsumption` invented **named real people and publications** and stated them as fact
  about a coach's audience — the highest fabrication risk in the system.

**The DB columns are KEPT** (dormant, empty). No column is dropped, so nothing breaks and a future
ICP-powered tool can populate them from real or coach-supplied data.

**This dissolved the bug, as predicted.** The nested `demographics` object was the thing being flattened;
`ICP_JSON_SCHEMA` is now **14 flat required string keys with no nested object at all**, so the failure mode
has nothing to attach to.

**Verification — 8 live generations, 4 per service, including the service that was 3/3 DEAD:**

```
217 Rest Assured   run 1-4  attempts=1  keys=14/14  retiredPresent=none  structuralHits=0  ✅ ✅ ✅ ✅
218 Visible Auth   run 1-4  attempts=1  keys=14/14  retiredPresent=none  structuralHits=0  ✅ ✅ ✅ ✅
TOTAL RUNS: 8 | mean attempts/run: 1.00 | MALFORMED THAT WOULD HAVE PERSISTED: 0
```

**mean attempts = 1.00 — not one retry was needed across 8 runs.** Before removal the same 218 case burned
9/9 attempts and threw every time.

(a) three fields absent on every run, zero malformed structures · (b) Class B prose still vivid
("Three likes — one from my mum", first-person density 16–21 per 1k, in band with the Phase-1 originals)
· (c) provenance labels the 14 generated sections only, out-of-band, `hitClasses: []` · (d) sibling fixes intact.

### Scope notes
* **`autoMode.ts` extraction is deliberately untouched.** It pulls `demographics` from the coach's OWN pasted
  document — coach-supplied real data, which the rationale explicitly permits. It is not speculative generation.
* `regenerateSection`'s enum drops the three keys (nothing generates them, so nothing to regenerate).
* `V2ICPResultPanel` now skips empty sections — otherwise a new profile would show three empty accordions.
  A legacy profile that still holds the data renders it exactly as before.
* `icpRichness` counts 14 instead of 17 so new profiles do not read as artificially thin.
* The Class-A validator checks are KEPT and still run — they find nothing on a generated profile (fields absent)
  but still guard legacy/imported rows and the day a future tool repopulates the columns.
* **Deviation from "tests add-only":** three assertions inside `pipeline-fixes.test.ts` asserted the OLD
  contract (`ICP_CONTENT_FIELDS` length 16, enrichment filling `demographics`). They were updated, not
  deleted. `pipeline-fixes` still reports 382.

## 4. Ship record — the exact sequence that ran

| # | Step | Result | Actual |
|---|---|---|---|
| 1 | Pre-check | PASS | `groundingMeta` absent (0), **101** ICP rows, 30 columns |
| 2 | Apply `0096` | PASS | `ALTER TABLE idealCustomerProfiles ADD COLUMN groundingMeta JSON NULL` → APPLIED OK (Arfeen "execute") |
| 3 | Verify migration | PASS | type `json`, `IS_NULLABLE=YES`, default null; **101 rows unchanged, 101 NULL / 0 non-NULL — no backfill** |
| 4 | Push | PASS | `744981c..fecd7fc`. Guards first: TS **35**, `@playwright/test` 0, no `package-lock.json`, frozen install passes |
| 5 | Railway | PASS | deployment `ccd031d4` BUILDING → **SUCCESS**; prod `GET /` **200** |
| 6 | SHA match + bundle | PASS | deployed `fecd7fcb9c0d757ea1cde95cb9466bf0a69ba180` == pushed SHA. Bundle `index-pYeJbqmn.js` → **`index-DVCmomSP.js`** — **changed as EXPECTED** (4 client files touched); proven by new string literals present in the served JS |
| 7 | Field contract | PASS | 14 flat keys, no nested object, three retired fields absent |

**Migration-before-code gate honoured**: `0096` landed before the deploy that writes the column.

**Post-deploy prod state:** 101 ICPs (unchanged), all 101 `groundingMeta` NULL, **0 rows created**. No test data anywhere.

**Step 7 was the read-only path, deliberately.** The contract was read straight from the pushed commit
(`ICP_TEXT_SECTION_KEYS` = 14; `ICP_RETIRED_SECTION_KEYS` = the three; `ICP_JSON_SCHEMA` flat with no nested
object; zero occurrences of DEMOGRAPHICS / MEDIA CONSUMPTION / INFLUENCERS in the prompt body) and combined
with the SHA match. Runtime behaviour was proven by the **8/8 live generations at this exact commit** before
push. What it does NOT prove is the running container executing a generation end-to-end — see backlog (d).

## 5. 🔴 STILL GATED / NOT DONE — the ICP sprint is BEGUN, not finished

* **Laddered intake** — built end-to-end (prompt block, tRPC input, provenance `ladderAnswered`, in-chat
  questions) but **`LADDER_ENABLED = false`** in `V2TrailIntake.tsx`. Never verified working. Separate decision.
* **Class-B provenance surfacing to the coach** — computed and persisted out-of-band, but whether/how any of it
  is shown in the UI is **undecided and unshipped**. Today it is internal-only, which was the locked Phase-2 call.
* **Concept/script anti-fabrication validator** — still DEFERRED. It now finally has a grounded corpus to check
  against (that was the blocker), but it is **not built**.
* **Everything Andromeda remains DRAFT-only** until ICP grounding fully lands. Nothing reaches Meta.

## 6. Backlog

* **(a) Two cosmetic leftovers — fold into the next deploy, not worth a build of their own:**
  stale comment `/** The 16 text section keys… */` stacked above the correct 14-section docblock at
  `server/_core/icpPrompts.ts:204`; and `ICP_JSON_SCHEMA.name` is still the string
  `"ideal_customer_profile_17_tabs"` (tool name only, zero functional impact). Both were live during the
  8/8 verification, so neither affects behaviour.
* **(b) Script filename feature** — human-readable per-concept script filenames derived from
  awareness + hook + length, rather than the raw ID.
* **(c) Blog generator + other ICP-powered content tools** — when built, **the consuming tool defines how
  `demographics` / `mediaConsumption` / `influencers` get populated** (real data, coach-supplied, or an explicit
  research prompt). Never speculatively regenerated. The dormant columns are already there waiting.
* **(d) Optional belt-and-suspenders:** one full end-to-end live ICP generation through the smoke coach on prod,
  with teardown, if Arfeen wants runtime proof beyond SHA match + the 8/8 pre-push runs.

## 7. State

* Branch `railway-build`, `HEAD = origin/railway-build = fecd7fc`. **`main` untouched.**
* Migration `0096` **APPLIED + VERIFIED** on prod.
* `autoMode`'s demographics path is **deliberately LEFT INTACT** — it extracts from the coach's OWN pasted
  document, i.e. coach-supplied real data, which the removal rationale explicitly permits.
* Clean-room artifacts: none. Verification was LLM-only; prod reads were SELECT-only apart from the one
  authorised ALTER.
