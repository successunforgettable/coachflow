# VIDEO SCRIPTS — moderate build: the per-concept generator made reachable (2026-09-14)

> ⚠️ **CORRECTION (2026-09-15): the Tool Library was never an entry point.** This document listed the Tool Library (the "Video Creator" / "Video Scripts" card in `V2ToolLibrary.tsx`) as a place coaches reach video. **That was wrong when it was written.** `V2Dashboard.tsx` imports `V2ToolLibrary` and never renders it. The "Jump to Tool Library" button sets an `activeTab` state that nothing reads, and none of the component's own strings exist in the production bundle, before or after deploy `87596d7`. It was found before the push, by the bundle-marker count (CLAUDE.md §15h). **The only live entry point is Ad Copy node → Video tab.** Each claim below is corrected in place and marked `[CORRECTED 2026-09-15]`; nothing was silently removed. Record: `docs/handovers/ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md`.

Branch `docs/held-2026-09-12`. **Not pushed, not deployed** (`railway-build` still `9156875`). Scope and design:
`PROPOSAL_VIDEO_SCRIPTS_MODERATE_2026-09-14.md`, as decided by Arfeen 2026-09-14:
- lengths from the research table, capped at 60 s;
- no quota;
- no migration.

## 1. What was built

| piece | file | notes |
|---|---|---|
| pure batch core | `server/_core/scriptBatch.ts` | set-id resolution, `decideGenerate`, `runScriptBatch` (one job row per concept, claimed as that concept starts; a claim collision aborts the loop), `planAndStart` (no-kit check first) |
| batch owner / DB wiring | `server/conceptScriptBatch.ts` | `ensureScriptsForIcp` — ownership, kit check, `ensureConceptsForIcp` when no concepts, background batch; failed rows re-armed with a fresh `created_at` |
| router | `server/routers/conceptScripts.ts`, `server/routers.ts` | `listForIcp` (concepts + scripts + per-concept job status), `generateForIcp` |
| generator | `server/conceptScriptGenerator.ts` | optional `scriptSetId` (`?? randomUUID()` keeps the proof scripts); length-conditional prompt sentence; header |
| length | `server/_core/conceptAxis.ts` | active lengths unaware 60 · problem 30 · solution 60 · product 30 · most 15; `ACTIVE_LENGTH_CEILING_SECONDS = 60` replaces the flat 30 s cap; `hasGroundedWordBudget` |
| read screen | `client/src/v2/V2ConceptScripts.tsx` | concepts + scripts; states: no profile · no kit · preparing concepts · generate · writing n of N · missing retry; teleprompter + copy |
| mounts | `V2AdCopyResultPanel.tsx` (+ `icpId` prop), `V2GeneratorWizard.tsx` (passes `activeIcp?.id`), `V2ToolLibrary.tsx` | the Ad Copy Video tab now renders `V2ConceptScripts`. `[CORRECTED 2026-09-15]` "Both entry points" was wrong: the `V2ToolLibrary.tsx` edit is inert, because that component is never rendered. **`V2VideoCreator.tsx` untouched and unmounted**; its gate and flag, and V1's, are unchanged |
| tests | `server/scriptBatch.test.ts` (new, 15) · `server/conceptAxis.test.ts` (updated) | |
| harness | `server/scripts/verify-concept-scripts-batch.ts` | drives the real endpoints via `appRouter.createCaller` |

## 2. Entry-point copy (CC's wording, matched to the neighbouring surfaces)

**Ad Copy node → Video tab caption.** It sits beside the Images caption, *"Optional — generate scroll-stopping ad images
using your copy as context."*, and uses the same form:

> *Optional — generate talk-to-camera video scripts, one for each of your ad concepts.*

**Tool Library card** `[CORRECTED 2026-09-15]`: written and deployed, but on no live screen. The component is never rendered, so no coach sees this copy. Neighbouring cards use a plural product noun as the name ("Ad Images", "Email Sequences"), and a
description of the form "what — details."

- **name:** *Video Scripts*
- **description:** *Talk-to-camera video ad scripts, one per ad concept — scene-by-scene lines, on-screen text, and a
  teleprompter view.*
- **emoji:** 🎬 (kept)

**No count is stated**, deliberately. Other cards state one ("15 Meta-compliant…"), but a batch can land partial (§4), and
the item-15 declared-count lesson is that promised N against delivered fewer is a defect. **No outcome or timing claim**
(§14b).

## 3. Gates (measured at run time)

| gate | result |
|---|---|
| `npx tsc --noEmit` | **34** (baseline), re-measured after the final client edit |
| scriptBatch (new) | 15/15 |
| conceptAxis | 20/20 |
| conceptScriptGenerator · conceptScriptValidator | 11/11 · 8/8 |
| fabricationGateDefects · complianceGate (source pins on the generator) | 15/15 · 24/24 |
| pipeline-fixes · complianceFilter · tokenCrypto | 414/414 · 31/31 · 10/10 |

### Negative controls (§15c)

Each mutation was applied, confirmed present, run against its test file, then reverted, and the file's md5 was checked
against the original. **Every one failed its target tests:**

| mutation | failed |
|---|---|
| M1 mint a new set id per script | 2 (same-set-id, retry-joins-existing-set) |
| M2 remove the no-kit early return | 1 (NO KIT never generates) |
| **M3 the inverted tiering** (unaware 30, product-aware 60) | **3** — exact values, inside-research-range, **DIRECTION** |
| M4 a 90 s tier (ceiling 90, unaware 90) | 2 — exact values, **grounded word budget** |
| M5 no abort when a concept is already claimed | 2 (pending-row abort, collision abort) |

## 4. Real runs

### Local (throwaway MySQL 3308, schema via `drizzle-kit push`)

Production has **no ICP without a kit** (measured), so the no-kit path could not be run on production data without
creating one. The local database has since been shut down.

| case | result |
|---|---|
| ICP with no kit → `generateForIcp` | **`{"status":"no_kit"}`**; after the call: 0 concepts for that ICP, **0 jobs rows in the whole database** |
| control: ICP with kit + concept + script | `hasKit=true`, `expectedSeconds=60` → **`{"status":"complete"}`** (the kit check does fire true) |
| ownership: user 2 → user 1's ICP | **`NOT_FOUND`** |

### Production — kit 225 (user 1, ICP 291, 8 concepts)

Target check before each run: `@@version_comment` = *MySQL Community Server - GPL*.

**Run 1 (18:33:56–18:39:22 UTC): 7 of 8 written, all in ONE set `60731b15-a5fd-4ebe-9f67-0851e0a2e573`.**

| concept | stage | stored length | scenes | spoken words (budget) |
|---|---|---|---|---|
| 223 | unaware | 60 | 5 | 179 (150–180) |
| 224 | problem-aware | 30 | 4 | 79 (75–90) |
| 225 | solution-aware | 60 | 5 | 169 (150–180) |
| 226 | product-aware | 30 | 4 | 90 (75–90) |
| 227 | unaware | — | — | **job failed:** *"Script failed validation after 3 attempts: script_length_over_budget, unearned_authority"* |
| 228 | problem-aware | 30 | 4 | 79 (75–90) |
| 229 | unaware | 60 | 5 | 165 (150–180) |
| 230 | problem-aware | 30 | 4 | 90 (75–90) |

- **Per-concept job rows ran 20–61 s each** (created 18:34:05 → 18:38:25), well inside the reaper's 5 minutes. That
  is the reason for one row per concept.
- **First pass was blocked on length in 6 of 8** (compliance telemetry). The generator's existing retry recovered 5;
  concept 227 was refused. That is the gate working, not this build failing.

**Run 2 (retry, 18:42:14): `generateForIcp` → `started`.**
- The batch skipped 7 and re-armed 227's failed row.
- 227 was written (178 words, 60 s) **into the same set `60731b15…`**.
- **Kit 225 now holds 8/8 scripts in one set.** Lengths match the stage table on all 8.

**Content, read (concepts 223 and 224):** real, niche-specific scripts built from service 318. The 60 s unaware script
runs hook → problem → turn → solution → CTA; the 30 s runs 4 scenes.

- 224's on-screen CTA reads `FREE MASTERCLASS → [INSERT_LINK]`. **This is by design** (`_core/scriptPromptCraft.ts:84`:
  "the coach's real one or the placeholder [INSERT_LINK] — never invent a contact"), and the coach sees it on the screen.
- Claim quality in the copy was **not judged in this package** (out of scope).

### Production — kit 187 ("no concepts yet": user 117174, ICP 249, service 272)

**What the endpoint did:**
- `generateForIcp` returned **`preparing_concepts`**, with outcome `enqueued` on the first run and a re-arm on the second.
- `ensureConceptsForIcp` ran. **No script batch was started.**

**What the concept set did:** 🔴 **it did not land, in either run.** The cause is in the EXISTING concept generator, which
this build calls but does not change:

1. **Run 1.** The live reaper marked `concepts-icp-249` failed at 5 min (*"Interrupted by server restart"*) while
   generation was alive. The harness exited on that status, killing the in-process generation — a **harness fault**.
   It was fixed to wait on rows, not job status, and re-run.
2. **Run 2.** Attempt 1 returned a full set (in 4,427 / out 7,892 tokens) that **the concept gate rejected**; the gate
   labels were not logged. The retry appended the gate's failure context (in 5,080) and **was cut off at max_tokens
   (8,192)**. `conceptGenerator.ts:198` then threw *"Concept generation returned no concepts array"*. `invokeConcepts`
   asks for `maxTokens: 4000` (`:192`), yet 7,892 and 8,192 were emitted, so **the requested cap is not the one
   applied**.

**What this means for the screen, found by this run and FIXED in the client.**
- Concept generation takes over 5 minutes, and the reaper marks it `failed` while it is still alive.
- `V2ConceptScripts` first treated `conceptsJob=failed` as the end. It now **waits on the rows** for up to 12 minutes,
  starts the scripts itself when they land, and offers a retry only after that.

**Not confirmed end-to-end on production:** a kit with no concepts reaching written scripts. It is blocked on the concept
generator for ICP 249.

## 5. Blast radius (58 tables, row count + max id + max updatedAt + CHECKSUM, baseline taken immediately before each run)

| window | changed | unchanged |
|---|---|---|
| run 1 (18:33:49 → 18:39:30) | `conceptScripts` 0 → **7** · `jobs` 0 → **9** | the other 56 |
| run 2 (18:42:07 → 18:57:40) | `conceptScripts` 7 → **8** · `jobs` checksum only (227 re-armed and completed; ICP 249 re-armed and failed) | the other 56 |
| **whole session** | **`conceptScripts` +8** (ids 2–9: user 1, concepts 223–230, one set) · **`jobs` +9** (`script-concept-223…230` complete; `concepts-icp-249` failed) | **56 of 58**, incl. `campaignConcepts` (no concept row written or deleted) |

Every change is one the two authorised runs account for. There were no Cloudinary, KV or Meta calls.

## 6. Findings — logged, not fixed

1. **The concept generator fails for ICP 249** (§4). The truncation on retry and the ignored 4,000 cap are its own
   package. It blocks the no-concepts path for that kit. Whether it also affects kits 188–192 / 200 is **not measured**.
2. **The concept job re-arm keeps its old `created_at`** (`conceptGenerator.ts:643`), so the reaper sweeps a re-armed job
   within 60 s. It predates this build. Script rows re-arm with a fresh `created_at`.
3. **The screen is not browser-verified.** Nothing is deployed. Proof needs a deploy and screenshots from Arfeen's
   browser (CLAUDE.md §7).
4. **Stale references:**
   - `docs/LAUNCH_READINESS_AUDIT.md:242` (Video Creator hard-disabled);
   - the `components/UpgradePrompt.tsx:18` comment lists `V2VideoCreator` as a call site;
   - `routers/videos.ts:432` loses its only client.
5. **`isFreeTier`** in `V2ToolLibrary.tsx` is now read by nothing (a free computation, left in place).
