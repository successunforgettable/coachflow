# ZAP Handover — July 26, 2026 (evening) — ICP GROUNDING, Phase 1 CONFIRMED / Phase 2 BUILT-AND-HELD

**Status: SAFE-HOLD. Committed LOCAL-ONLY. Nothing pushed. No migration executed. Nothing written to prod.**

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

## 2. Phase 2 — what is BUILT (all local-only)

### Core
| Piece | File | Notes |
|---|---|---|
| Single prompt source + angle as parameter | `server/_core/icpPrompts.ts` | Class-A grounding written **in place** into sections 4/12/13 (no re-numbering — that was the Phase-1 bug). Exports `ICP_JSON_SCHEMA`, previously duplicated in 4 places. |
| Structural gate + R3 labelling + provenance | `server/_core/icpGrounding.ts` *(new)* | `validateIcpStructure` (hard gate), `validateIcpGrounding` (4 R3 modes), `computeIcpProvenance`, `normalizeDemographics`. Reuses `bonusWordOverlap` for traceability. |
| Shared generation runner | `server/_core/icpGenerate.ts` *(new)* | structural → retry then **throw** (malformed never persists); grounding → retry then **label-and-persist**. Retry 1→3, mirrors the bonus generator's hit/failContext shape. |
| Shared sanitiser | `server/_core/icpSanitize.ts` *(new)* | `stripObjectionScaffolding` extracted so the angle path gets it too. |
| Migration (AUTHORED, **NOT APPLIED**) | `drizzle/0096_icp_grounding_provenance.sql` | one additive nullable `groundingMeta JSON` column. |

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
* **Tests 401 pass** — `pipeline-fixes` 382 unchanged + **19 new** in `server/icpGrounding.test.ts` (add-only).
  Includes a regression test reproducing the exact Phase-1 flattening payload.
* Guards intact: no `@playwright/test`, no `package-lock.json`, `pnpm install --frozen-lockfile` passes.

---

## 3. 🔴 THE OPEN BLOCKER — Phase 2 MUST NOT SHIP YET

**The Class-A hardened prompt makes ICP generation hard-fail for some services.** This is the reason nothing
was pushed. It is NOT about the laddered input (an earlier reading of mine that the evidence disproved).

**Failure mode:** the model stops nesting the demographics object and hoists its seven values to the top level
— **23 keys instead of 17**. `validateIcpStructure` catches it, so **nothing malformed ever persists** (that
part works exactly as designed), but it survives all three retries, so the coach gets
*"could not produce a correctly structured profile… nothing was saved."*

**Final measured run** (`verify-icp-grounding.ts 3`, both cases WITHOUT a ladder — the shipped configuration):

```
217 Rest Assured   run 1  attempts=2  keys=17  demoObject=true  notSpecified=5/7  structuralHits=0  ✅
217 Rest Assured   run 2  attempts=1  keys=17  demoObject=true  notSpecified=5/7  structuralHits=0  ✅
217 Rest Assured   run 3  attempts=1  keys=17  demoObject=true  notSpecified=5/7  structuralHits=0  ✅
218 Visible Auth   run 1  THREW after 3 attempts (icp_demographics_not_object, icp_unexpected_top_level_keys)
218 Visible Auth   run 2  THREW after 3 attempts (same)
218 Visible Auth   run 3  THREW after 3 attempts (same)
MALFORMED THAT WOULD HAVE PERSISTED: 0
```

**One service is 3/3 clean; the other is 3/3 dead (9/9 attempts flattened).** Stochastic per attempt, but the
rate is service-dependent and high enough on 218 that retries never recover.

**Hypotheses tested and DISPROVED — do not re-tread:**
1. *The laddered block causes it.* No — 218 fails identically with and without a ladder.
2. *Truncation.* No — `stop_reason` was `tool_use` on 4/4 raw-captured runs, `output_tokens` 6.1k–7.1k against
   `max_tokens: 8192` (`llm.ts:355`).
3. *The `"demographics": { ... }` placeholder in the trailing format block.* Spelling the seven keys out
   explicitly made it **worse** — 10 keys instead of 17, 3/3 failures. Reverted.

**What separates the two cases (UNTESTED hypothesis, best lead):** 217's input states "aged 28–40", so two of
the seven demographic values are concrete. 218's input establishes none, so under the honesty rule nearly all
seven must be the literal string `"Not specified"`. A degenerate object of seven identical strings may be what
tips the model out of nesting. Note the Phase-1 CONTROL runs of the *original* (ungrounded) prompt were 2/2
clean — the hardening is what raises the rate, because it is what produces the repeated `"Not specified"`.

**Untried fixes, in the order I would try them:**
* **Flatten the schema** — seven top-level demographic keys, re-nested server-side by `normalizeDemographics`
  (which already accepts multiple shapes). Removes the nesting requirement, so the failure mode cannot occur.
  Highest confidence, smallest blast radius, no migration.
* Let unsupported demographic values be **omitted** rather than all set to the same `"Not specified"` string
  (tests the degeneracy hypothesis directly and is arguably better output anyway).
* Generate demographics in its own small second call.
* Raise `max_tokens` — **shared parameter used by every generator**, so not a local call.

**Everything else in Phase 2 verified clean on the passing case:** Class A honest (`notSpecified=5/7`, zero
named third parties, zero unsupported demographic values), Class B prose vivid (first-person density 20/1k,
clock-times present — in band with the Phase-1 originals), provenance computed out-of-band
(`overall=partial`, `corpusWords=25`), and 0 malformed payloads reached persistence across all 12 generations
run this session.

## 4. Resume checklist (exact)

1. `git log -1` on `railway-build` — confirm the held commit (SHA in §5) is local and **not** on origin.
2. Decide the demographics-nesting fix (schema flattening is my recommendation) and implement.
3. Re-run `railway run --environment production --service coachflow npx tsx server/scripts/verify-icp-grounding.ts 3`
   with a ladder restored in the second case. Require **0 throws** across ≥6 runs before flipping
   `LADDER_ENABLED = true`.
4. **Arfeen: "execute" migration `0096`** (one additive nullable JSON column) — must land **before** the code
   deploy, because `icps.generate`, `icps.generateAsync` and `icpAngleSuggestions` all now write `groundingMeta`.
   Verify: `INFORMATION_SCHEMA` shows the column, row count unchanged.
5. Only then push `railway-build`; watch Railway → SUCCESS on the exact SHA; prod 200.
6. Server-side only apart from the (gated-off) intake questions → the client bundle will change *only* because
   of `V2TrailIntake.tsx`/`V2AutoModeIntakeConfirm.tsx` edits.

## 5. State

* Branch `railway-build`, **local commit only — nothing pushed**, `origin/railway-build` still `744981c`.
* Migration `0096` **authored and HELD**. Not applied to prod or anywhere.
* Clean-room artifacts: **none created** — all verification ran through the LLM only, no DB writes anywhere.
  Prod reads were `SELECT`-only via a read-only helper.
