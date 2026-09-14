# PROPOSAL: video scripts, moderate build (make `generateScriptForConcept` reachable), 2026-09-14

> ⚠️ **CORRECTION (2026-09-15): the Tool Library was never an entry point.** This document listed the Tool Library (the "Video Creator" / "Video Scripts" card in `V2ToolLibrary.tsx`) as a place coaches reach video. **That was wrong when it was written.** `V2Dashboard.tsx` imports `V2ToolLibrary` and never renders it. The "Jump to Tool Library" button sets an `activeTab` state that nothing reads, and none of the component's own strings exist in the production bundle, before or after deploy `87596d7`. It was found before the push, by the bundle-marker count (CLAUDE.md §15h). **The only live entry point is Ad Copy node → Video tab.** Each claim below is corrected in place and marked `[CORRECTED 2026-09-15]`; nothing was silently removed. Record: `docs/handovers/ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md`.

**Investigation and proposal only. Nothing built.** Scope was set by Arfeen on 2026-09-14: the moderate version only.
Follows `SCOPING_VIDEO_SCRIPT_GENERATOR_GAP_2026-09-14.md`.

**Out of scope by instruction:**
- a Meta publish path;
- set-level compliance checks beyond what exists;
- new copy fields (headline, primary text, text card);
- a kit slot or any migration.

§6 records every place the work touched one of those.

**Measured, not recalled:**
- Production (read-only, 2026-09-14): **22 kits, and only kit 225 (ICP 291) has concepts: 8, all `serviceId` 318**. The
  other 21 kits have none.
- `conceptScripts` and `jobs` both exist in production, so **no migration is needed** for anything below.

---

## 1. Batching: CONFIRMED as the small mechanical change

**The change, in full.** Give `generateScriptForConcept` (`server/conceptScriptGenerator.ts:166`) an optional
`scriptSetId`, and use `params.scriptSetId ?? randomUUID()` at `:296`.

- The optional default keeps both hand-run callers working unchanged (`scripts/pdaf-step1-proof.ts:139`,
  `scripts/verify-concept-script.ts:20`).
- The source-text test pins on this file are unaffected. They pin `groundingMeta`, `requireGrounding`,
  `recordComplianceGate` and `firstPassOk` (`fabricationGateDefects.test.ts:124-136`, `complianceGate.test.ts:167-176`),
  and none of those touches `:296`.

**Who creates the set id and passes it down:** a new batch owner, `ensureScriptsForIcp({ userId, icpId })` (§2).

- It reads the ICP's current concept set — the rows for `(userId, icpId)`; `DEFAULT_CONCEPT_COUNT = 8`,
  `_core/conceptAxis.ts:53`.
- If any concept in the set already has a script, it **reuses that script's `scriptSetId`**, so a retry of failed
  concepts joins the same set.
- Otherwise it mints **one** `randomUUID()` and passes it to every per-concept call. This is the same shape as
  `conceptSetId`, which is minted once per batch (`conceptGenerator.ts:518`).

**Considered and not recommended:** `scriptSetId = conceptSetId`, which needs no mint. It welds script identity to concept
identity, so any later "write a fresh set of scripts for the same concepts" would collide. Minting costs nothing and
keeps the two independent.

## 2. Background flow: one job row PER CONCEPT, inserted as that concept starts

### The constraint that decides the shape

The reaper runs **every 60 seconds**. It marks every `pending` job older than 5 minutes as failed
(`_core/index.ts:61-76`, `:143-150`).

Per concept, the generator runs up to 3 LLM calls (`conceptScriptGenerator.ts:264-275`); **the duration is
unmeasured.** One job row covering all 8 concepts could therefore be marked failed while it is still writing scripts. That
is the same failure the concept job accepts ("the rows still land", `conceptGenerator.ts:609-615`), but a coach watching
a progress screen would see it.

### Proposed flow

**Endpoint `conceptScripts.generateForIcp`** runs this sequence:

1. **Ownership.** The ICP must belong to `ctx.user.id`.
2. **No kit for this ICP → return `no_kit`, and never generate concepts.** Concepts are deliberately generated only
   once a kit exists, so that sharpening a profile cannot leave a stale set behind (`conceptGenerator.ts:588-595`;
   `routers/icps.ts:314-321`). ~~The Tool Library can select an ICP with no kit~~ `[CORRECTED 2026-09-15]`: the Tool Library is never rendered. The guard is still correct and proven, for any caller that reaches an ICP with no kit.
3. **Kit exists, no concepts** (21 of 22 production kits) → call `ensureConceptsForIcp({ userId, icpId, serviceId })`,
   which is safe once a kit exists, and return `preparing_concepts`.
4. **Concepts exist** → start `ensureScriptsForIcp` in `setImmediate` and return `started`.

**The loop inside `ensureScriptsForIcp`:**

- **Order:** concepts in id order, sequential (one LLM stream at a time). Parallelism is a later tuning knob, not needed
  for correctness.
- **Skip:** a concept that already has a script.
- **Job row:** for each remaining concept, insert `jobs` row `script-concept-{conceptId}` (fits the `varchar(36)` id)
  **at the moment that concept starts**. Its `created_at` is fresh, so each row lives for one generator call.
- **Status:** `pending → complete | failed`, never `running`, matching the concept job's reasoning.
- **Collision:** a primary-key clash means another loop is already on that concept, so skip it. That is the idempotency
  pattern `conceptGenerator.ts:646-653` already uses.
- **Retry:** a `failed` row is re-armed to `pending`, as at `:643`.
- **Failure:** the generator throws after 3 attempts, so that concept's row is marked `failed` with the message, and
  **the loop continues**. The set can be partial, and **"Generate the missing ones"** re-runs only the concepts with no
  script, under the same set id.

**Endpoint `conceptScripts.listForIcp`** is a query. It returns the concept set, each concept's script (if any) and
each concept's job status in one call.

- **The client polls this every 5 s while anything is pending**, the house interval. It does not poll `/api/jobs`,
  because this screen's state comes from rows, not from one job.

**Router.** Both endpoints go in a new `server/routers/conceptScripts.ts`, registered as `conceptScripts` in
`server/routers.ts` (one line). Every read is filtered by `ctx.user.id`.

### Two behaviours to know

- **Grounding fails closed.** When a concept's coach material cannot load (for example `serviceId` is null), every
  attempt is blocked with `fabrication_check_unavailable` (`_core/complianceAxis.ts:1262-1277`). That concept shows as
  failed. All 8 production concepts carry `serviceId` 318.
- **No quota in this package.** A per-generator quota needs a new `users` counter column (the `*GeneratedCount`
  pattern, `schema.ts:31-39`), which is a migration. The old Tool Library card called scripts free. **Arfeen's call.**

## 3. Read screen: ONE new component, mounted where the old Video Creator is mounted

**Recommendation: `client/src/v2/V2ConceptScripts.tsx` with props `{ icpId }`, mounted in the Ad Copy node's Video tab
and in the Tool Library's Video panel. Not in the Campaign Kit.** `[CORRECTED 2026-09-15]` The Tool Library panel is never rendered; the Video tab is the only real mount.

**Why not the Campaign Kit.** That screen is built from kit slots (`V2CampaignKit.tsx:28-35`). A scripts section there
either looks like a slot without being one, or invites a real slot, which is a migration and out of scope.

**Why the Ad Copy node.**
- It keeps the work inside the node (invariant 1).
- It is where concepts already shape the copy.
- The tab already exists and already says Video.
- It needs **no new route**.

### What it shows

- **One card per concept:** the concept's stage in plain words, its hook style, and its `desire` and `hook`, which are
  already stored.
- **Under each card, its script:** each scene's spoken line, on-screen text and delivery note; the target length; and a
  teleprompter view (the stored `teleprompter`) with a copy button.
- **Deliberately not shown:** the concept's own `headline`, `shortText` and `longText`. They are not the kit's selected
  ad copy, and showing them beside it would present two versions of the copy.
- **States:**
  - no kit — "appears once this profile has a campaign";
  - preparing concepts;
  - ready — Generate scripts;
  - generating *n* of 8;
  - done;
  - some failed — Generate the missing ones.
- **Read-only.** No edit: there is no update endpoint, and editing was not asked for.
- **Invariants 5 and 6 of the design system:** V2 file only, inline styles, pill buttons, 16 px cards.

### Wiring

| where | change |
|---|---|
| `V2GeneratorWizard.tsx:2843` | pass `icpId={activeIcp.id}` to `V2AdCopyResultPanel`; `activeIcp` is already in scope and used at `:1856`, `:2507` |
| `V2AdCopyResultPanel.tsx` | accept `icpId` and render `<V2ConceptScripts icpId={icpId} />` in the Video tab |
| `V2ToolLibrary.tsx` | render `<V2ConceptScripts icpId={effectiveIcpId} />`, using the existing ICP picker (`:179-205`) |

**The screen a coach sees it on (§15d):** Ad Copy node → **🎬 Video** tab. ~~and Tool Library → **Video** card~~ `[CORRECTED 2026-09-15]`: not a screen any coach can see.

## 4. Repointing the entry points, and whether the Coming Soon gate conflicts `[CORRECTED 2026-09-15]` (one real entry point, not two)

| entry point | today | change |
|---|---|---|
| Ad Copy node Video tab | `V2AdCopyResultPanel.tsx:24` import, `:958` element; caption `:955` *"Optional — generate video ads with voiceover and motion graphics."* | swap to `V2ConceptScripts`; **the caption describes the old tool and needs new wording** |
| ~~Tool Library card~~ `[CORRECTED 2026-09-15]` never rendered | `V2ToolLibrary.tsx:14` import, `:491` element; card `:79-81` *"Video Creator … voiceover and motion graphics — script first (free), then render with credits."* | swap the element; **the card name and description describe the old tool and need new wording** |

**The gate, checked for conflicts: none in code.**

- `VIDEO_CREATOR_FEATURE_ENABLED` and `ComingSoonPlaceholder` are referenced **only inside `V2VideoCreator.tsx`**
  (`:28`, `:226`, `:263-264`).
- **Recommendation: leave `V2VideoCreator.tsx` untouched and simply stop mounting it.** Its gate, its own flag and its
  "one-line flip" re-enable path all survive. After the swap it has no importer; that is deliberate and should be recorded.
- **V1** `pages/VideoCreator.tsx:16` has its **own separate** flag. Its comment and V2's say the two flip "in lockstep".
  Leaving both unchanged keeps them in lockstep.
- **No test pins either gate.** The only hits in `server/voiceover.test.ts` and `server/pipeline-fixes.test.ts` are
  unrelated strings.
- The old `videoScripts` / `videos` routers are untouched. `routers/videos.ts:432` (the old tool's "restore last result")
  loses its only client.
- **Docs that go stale:**
  - `docs/LAUNCH_READINESS_AUDIT.md:242` records the Video Creator as hard-disabled;
  - the comment at `components/UpgradePrompt.tsx:18` lists `V2VideoCreator` as a call site.

  Both get a note in the build commit.

📌 **The replacement caption and card copy are brand and product text: Arfeen writes or approves them.** CC will not
invent them.

## 5. Length: where the decision lives, and a conflict to decide before building

### Where the decision point is

It is **one function: `activeLengthForStage` in `server/_core/conceptAxis.ts:327-329`**, reading
`LENGTH_BY_AWARENESS[stage].activeSeconds` (`:319-325`) capped by `PLACEMENT_SAFE_CEILING_SECONDS = 30` (`:306`).

**Its only production consumer is `conceptScriptGenerator.ts:177`.** Everything else follows from the `targetSeconds` it
returns:

- the word budget (`wordBudgetForSeconds`, `:343`, used by the prompt at `:59` and the validator at
  `conceptScriptValidator.ts:91`);
- the scene count (`:61`: 15 s gives 3 scenes, up to 30 s gives 4, anything longer gives 5);
- the scene map (`:102`);
- the stored `targetLengthSeconds`.

**The change** is to the per-stage `activeSeconds` values plus retiring (or re-documenting) the 30 s cap.
`conceptAxis.test.ts:60-67` pins the cap and is updated in the same commit.

**Two further edits the change requires:**

1. **The prompt asserts shortness at `:98-99`**: *"Placement-safe short: Meta Advantage+ serves one asset across Reels,
   Stories and Feed, and the short end runs cleanly everywhere."* That sentence is untrue of a 60 s script. It needs
   length-conditional wording, positive-only (§14).
2. **90 s has no grounded word budget.** `WORD_BUDGET_TABLE` holds only 15, 30 and 60 (`:337-341`); 90 falls back to
   3 words per second (`:347`), the ceiling-used-as-target error `script-rule-spec.md` §1.2 names. **Either cap the
   longest tier at 60 (recommended for this package), or add a 90 row.** A 90 row would be extrapolated from the 30 and
   60 anchors (about 225–255 words, max 270) and labelled INFERRED, not corpus.

### 🔴 The tiering in the brief contradicts the only research on length by stage

Source: `script-research/Strategic Report_ Optimising Meta Video Ad Lengths…md`, lines 11–15. This is also the source
the code cites at `conceptAxis.ts:299`.

| stage | research | the brief's tiering |
|---|---|---|
| unaware (cold) | **60–90 s** — *"Educational explainers are required to pull cold audiences through multiple stages of awareness"* | 🔴 **15–30 s** (opposite) |
| problem-aware | 30–60 s | not stated |
| solution-aware | **60–90 s** | ✅ 60–90 s (agrees) |
| product-aware | **15–30 s** — *"**Retargeting** audiences at this stage require a fast, efficient product walkthrough"* | 🔴 retargeting **longer**, 60–90 s (opposite) |
| most-aware | 15 s | not stated |

- **Evidence tier.** That report is `script-research`, an untiered NotebookLM synthesis. A sweep of
  `performance-research/` found **no** length-by-stage finding (its hits are retention and hook-rate figures). Under
  Arfeen's 2026-09-11 rule, **neither side is evidenced**, and that is recorded rather than decided silently.
- **"Retargeting context" is not in the data.** A concept carries only `awareness`; nothing records audience
  temperature. Tiering on it needs a new field, which is a migration and out of scope. Stage is the only available key,
  and the research itself maps retargeting to product-aware.
- **What production would get today** (kit 225: 3 unaware, 3 problem-aware, 1 solution-aware, 1 product-aware).
  - Research tiering: the three unaware scripts are the **longest**.
  - The brief's tiering: they are the **shortest**.

  The decision changes what every current script looks like.

**CC's recommendation:** use the research table (the only cited source, already stored beside the cap), capped at 60 s:
unaware 60 · problem-aware 30 · solution-aware 60 · product-aware 30 · most-aware 15.

**This makes cold scripts LONGER, the opposite of the brief, so it is Arfeen's call, not CC's.** Whichever table is
chosen, the code change is identical and lives in the one function above.

## 6. Does this stay moderate? Yes, with the edges named

**None of the four exclusions is required by items 1–5.**

| exclusion | needed? |
|---|---|
| Meta publish path | no |
| set-level compliance | no — the per-script gate is unchanged |
| new copy fields | no |
| kit slot / migration | **no** — `conceptScripts` (0095) and `jobs` exist in production; no column is added |

**Where it would creep, and what this proposal does instead:**

| pull toward structural | cause | held back by |
|---|---|---|
| a quota for scripts | needs a `users` counter column → migration | no quota this package (§2) — Arfeen's call |
| length keyed on retargeting | no audience-temperature field exists | tier on stage only (§5) |
| a 90 s tier | no grounded word budget | cap at 60, or an INFERRED 90 row (§5) |
| concepts for a profile with no kit | would break the sharpen invariant | `no_kit` guard (§2) |
| picking a best script into the kit | a kit slot → migration | read-only; no selection (§3) |
| editing scripts | no update endpoint | read-only (§3) |

**Rough size:**
- **Server:** 2 lines + prompt wording in `conceptScriptGenerator.ts`; length values in `conceptAxis.ts`; the batch owner;
  one new router file; one line in `routers.ts`.
- **Client:** one new component; small edits in `V2AdCopyResultPanel.tsx`, `V2GeneratorWizard.tsx` and
  `V2ToolLibrary.tsx`.
- **Tests:**
  - `conceptAxis.test.ts` updated;
  - new tests for one set id across a set (**negative control:** without the parameter, ids differ);
  - one job row per concept;
  - the `no_kit` guard (**negative control:** an ICP with no kit must never enqueue concepts).
- **One commit, no migration.**

## 7. Decisions needed before the build

1. **Length table** (§5): the research table capped at 60 (CC's recommendation), or the brief's tiering.
2. **The Video tab caption and the Tool Library card name and description** (§4): Arfeen's wording. `[CORRECTED 2026-09-15]` The card is never rendered.
3. **Quota:** none this package (CC's recommendation), or add one later with its own migration.
