# SCOPING: the video-script generator gap (investigation only, 2026-09-14)

> ⚠️ **CORRECTION (2026-09-15): the Tool Library was never an entry point.** This document listed the Tool Library (the "Video Creator" / "Video Scripts" card in `V2ToolLibrary.tsx`) as a place coaches reach video. **That was wrong when it was written.** `V2Dashboard.tsx` imports `V2ToolLibrary` and never renders it. The "Jump to Tool Library" button sets an `activeTab` state that nothing reads, and none of the component's own strings exist in the production bundle, before or after deploy `87596d7`. It was found before the push, by the bundle-marker count (CLAUDE.md §15h). **The only live entry point is Ad Copy node → Video tab.** Each claim below is corrected in place and marked `[CORRECTED 2026-09-15]`; nothing was silently removed. Record: `docs/handovers/ITEM_TOOL_LIBRARY_UNREACHABLE_UNSCOPED_2026-09-15.md`.

**Nothing was built, fixed or written.** Code was read at held-branch HEAD `7adb428`; production code is `9156875`. None
of the files named below differ between the two (`git diff 9156875..HEAD` touches no file in `server/routers`,
`server/conceptScriptGenerator.ts`, `server/conceptGenerator.ts`, `server/_core/conceptAxis.ts`,
`server/_core/cascadeContext.ts` or `client/src/v2`).

- **Production counts** were read with read-only SELECTs on 2026-09-14.
- `docs/andromeda/script-rule-spec.md` was read in full first.
- CHECKPOINT.md §0.6a ("THE HOLE IN THE DELIVERABLE") and §3 ("STANDING FINDINGS") are the prior record; both were
  re-checked here, not quoted.

**No fix shape is proposed here, by instruction.**

| question | answer | shares root with | blast radius | rough scope |
|---|---|---|---|---|
| **Generator has no caller?** | ✅ **still true** — no router, no job, no screen, no read endpoint; `conceptScripts` **0 rows** | the "machinery with no caller" law (CLAUDE.md §15d) | — | — |
| **Where a coach hits the gap** | **eight points listed; seven are real** (§B). ONE screen *advertises* video and opens a Coming Soon card; the second one listed, the Tool Library, is never rendered `[CORRECTED 2026-09-15]` | the gated Video Creator (a different pipeline) | wizard, Auto Mode, ~~Tool Library~~ (never rendered), Campaign Kit, Asset Library, Meta push, V1 | — |
| **`scriptSetId` blocks batching?** | ✅ **still true** (`conceptScriptGenerator.ts:296`) — and the spec's own set-level checks need a set too (§C) | `campaignConcepts.conceptSetId` shows the working pattern | every script ever generated | the change itself is small; **the missing piece is anything that owns a batch** |
| **Wiring it in** | not a missing button | concepts invisible to coaches; kit has no slot; no Meta video path | server, client, schema, orchestration, Meta | **a caller alone: moderate · what the spec describes: structural** |

---

## A. Where the generator sits

- **`server/conceptScriptGenerator.ts`** (314 lines). The one entry point is
  `generateScriptForConcept({ userId, conceptId }): Promise<number>` (`:166`).
  - It reads one `campaignConcepts` row for the user (`:170-175`) and asks for cascade context as node `"adCopy"`
    (`:182`).
  - It runs the LLM and a gate for up to 3 attempts (`:264-275`). The gate combines `validateScriptStructure`,
    `screenScriptCompliance` and `checkOutput` with `requireGrounding: true` (`:235-259`).
  - It records compliance telemetry (`:281-290`).
  - It **inserts ONE `conceptScripts` row** with `status: "draft"` (`:298-312`).
  - It is **synchronous and long**: up to three LLM calls inside one awaited call. It has no job, and no job id pattern
    exists for it.
- **Helpers:** `server/_core/conceptScriptValidator.ts` (structure + compliance screen), `server/_core/scriptPromptCraft.ts`,
  and `server/_core/conceptAxis.ts` (`activeLengthForStage`, `wordBudgetForSeconds`,
  `PLACEMENT_SAFE_CEILING_SECONDS = 30` at `:306`).
- **Table:** `conceptScripts` (`drizzle/schema.ts:1647`, migration `0095_concept_scripts.sql`).
  - Columns: `conceptId` NOT NULL with **`onDelete: "cascade"`**, plus `scriptSetId` NOT NULL with its own index
    `idx_conceptScripts_set`.
  - Output columns: `awareness`, `hookPattern`, `targetLengthSeconds`, `scenes` (json), `teleprompter`, `status`
    (draft/selected/dismissed), `source`.

**Every caller, exhaustively:**

| caller | kind |
|---|---|
| `server/scripts/pdaf-step1-proof.ts:28` | hand-run proof script |
| `server/scripts/verify-concept-script.ts:9` | hand-run proof script |
| `e2e/concept-scripts.spec.ts` | Playwright spec that **reads rows from a local test DB**. It never calls the generator; it needs rows made by hand first |
| `server/conceptScriptGenerator.test.ts` | imports only `buildConceptScriptPrompt` |
| `server/fabricationGateDefects.test.ts`, `server/complianceGate.test.ts` | read the source file as text |

- **Router or orchestration callers: zero.** `grep conceptScripts|generateScriptForConcept` in `server/routers/*.ts`
  and `server/routers.ts` returns nothing. `ORCHESTRATION_STEPS` (`_core/orchestration.ts:239-252`) runs offer ·
  mechanism · hvco · headlines · adCopy · landingPage · emailSequence · whatsappSequence · adCreatives.
- **Client references: zero.** There is also **no read, list or update endpoint** for `conceptScripts`. The file header
  says the generator "Ends at: generate + read/edit"; **the read/edit half does not exist** (§15d: the comment is a
  request, not an implementation).

### The generator's input DOES exist in production

Concepts are generated on the live path twice over:

- at kit creation, fire-and-forget: `routers/campaignKits.ts:183-184` → `ensureConceptsForIcp`;
- on ad copy: `adCopyGenerator.ts:356`.

Ad copy rows are stamped with a `conceptId` (`adCopyGenerator.ts:582-621`), and Meta assembly pairs by concept
(`routers/meta.ts:267-411`, `_core/adAssembly.ts`).

Production has **8 `campaignConcepts` rows in 1 set, for 1 ICP, all user 1, created 2026-08-30 16:48**. So for any kit
that exists, the rows the generator needs are already there. **What is missing is everything after them.**

**Concepts are invisible to coaches.** No client file references `campaignConcepts`, `conceptId` or a concept endpoint.
A coach meets concepts only indirectly, as ad-copy variants.

---

## B. Every point where a coach hits the gap

**Ordered by how strongly the screen invites the expectation.** Each was traced in code, not inferred from labels.

| # | where | what the coach sees / does | what actually happens |
|---|---|---|---|
| **1** | **Ad Copy node → "🎬 Video" tab** (`V2AdCopyResultPanel.tsx:848`, `:952-958`) | A top-level tab beside Copy and Images, captioned *"Optional — generate video ads with voiceover and motion graphics."* This is the moment the coach has just received concept-keyed ad copy | Renders `V2VideoCreator`, which returns `ComingSoonPlaceholder` (`V2VideoCreator.tsx:263-265`): *"Video Creator — Coming Soon … We're putting more polish into this before opening it up — check back soon."* |
| **2** | ~~**Tool Library → "Video Creator" card**~~ `[CORRECTED 2026-09-15]` **NOT A REAL POINT: `V2ToolLibrary` is never rendered, so no coach can reach this card** (`V2ToolLibrary.tsx:79-81`, opens inline at `:214`) | Card copy: *"AI-generated video ads with voiceover and motion graphics — script first (free), then render with credits."* | The same component, the same Coming Soon card |
| **3** | **The 11-node trail / wizard** (`V2TrailIntake.tsx:102-114`) | Stops: Service · ICP · Offer · Method · Lead Magnet · Headlines · Ad Copy · Landing Page · Email · WhatsApp · Ad Images | **No stop produces a video script.** The coach finishes the path with no script and no prompt that one is missing |
| **4** | **Auto Mode** (`_core/orchestration.ts:239-252`; `routers/autoMode.ts`) | "Signup → single-text intake → cascade → Campaign Kit ready" | No script step in the cascade. Auto Mode's promise of a finished kit is met without one |
| **5** | **Campaign Kit screen** (`V2CampaignKit.tsx`; `campaignKits` schema) | The kit is the source of truth; "Use This & Continue" is the only completion action | **The kit has no concept, script or video slot**: none of its 9 `selected*Id` columns names one. There is nothing to select, review or continue from |
| **6** | **Asset Library → "Videos" tab** (`V2AssetLibrary.tsx:135`, `:191`) | A Videos filter | Lists rendered `videos` rows only. There is no scripts view, and `videoScripts` holds 0 rows |
| **7** | **Push to Meta** (`routers/meta.ts`, `lib/metaAPI.ts`) | A coach who recorded a script by hand expects to publish it as a video ad | **No video upload path exists in `server/`.** `grep advideos\|video_id` returns nothing. The control grep for `adimages\|image_hash` finds `lib/metaAPI.ts`, so the empty result is a real absence, not a broken search (§15-PARENT). Publishing is image-only |
| **8** | **Legacy V1** (`/video-creator`; `/campaigns/:id`) | Reachable by URL and via the V1 `DashboardLayout` nav. Not linked from any V2 screen | `/video-creator` has its own `VIDEO_CREATOR_FEATURE_ENABLED = false` gate (`pages/VideoCreator.tsx:16,36`). `CampaignDashboard.tsx:268` calls `videoScripts.generate` behind only a credit check. That is the **old** pipeline, not the Andromeda generator, and V1 is read-only by invariant 5 |

### 📌 Two different "video script" systems exist, and the natural screen belongs to the other one

`videoScripts` (router `routers/videoScripts.ts`, table `videoScripts:1429`) is the credit-render tool.

- Its inputs are **service-keyed**: `serviceId`, `videoType`, `duration`, `visualStyle` (`:891-900`, `:1075-1084`).
- It produces 5 render scenes and a voiceover. It knows nothing about concepts.
- It is the pipeline **the advertised screen (B1) would call (B2 is never rendered `[CORRECTED 2026-09-15]`)** if the flag were flipped. Flipping
  `VIDEO_CREATOR_FEATURE_ENABLED` would **not** reach `generateScriptForConcept`.
- `conceptScripts`' own schema comment says it is a separate table "to avoid the credit-render coupling".

---

## C. The `scriptSetId` batching constraint: CONFIRMED

- **The mint.** `const scriptSetId = randomUUID()` at `conceptScriptGenerator.ts:296`, inside a function that inserts
  exactly one row. No parameter lets a caller pass one in. Every script is therefore a set of one, and
  `idx_conceptScripts_set` indexes a column that can never group two rows.
- **The working pattern already in the codebase.** `generateConceptsForIcp` mints **one** `conceptSetId` per call
  (`conceptGenerator.ts:518`) for the whole batch, deletes the ICP's prior set (`:522`), then inserts the set. The
  batch owner is the function that generates the batch.

### What fixing it would take: the constraint, not a design

1. **The mechanical part is small.** The set id must be minted by whoever generates the batch and passed to each
   per-script call.
2. **The missing part is the batch owner.** No function, job or endpoint generates "the scripts for a concept set".
   Minting the id elsewhere changes nothing until something owns the batch.
3. **"Batch" means two different things here, and the design has to choose.**
   - **(a) A SET:** one script per concept across a concept set. This is what the spec's set-level rules require:
     - §2.2 — no 4+-token n-gram in more than two scripts, and one canonical name for a mechanism;
     - §2.5 — cap on negation proportion;
     - §4.1 / §4.4 / §4.5 — "record which assumption a batch was built on".

     **None of those checks can run on a set of one**, so batching is required by the validator the spec describes, not
     only by Generate-More-Show-Less.
   - **(b) A POOL:** N candidates per concept, with the best one picked (invariants 2 and 8). `conceptScripts.status`
     has draft/selected/dismissed, but there is **no scoring and no selection** anywhere, and the kit has no slot
     to record a pick.
4. **Replacement semantics are unsettled, with a latent data-loss path.** `conceptScripts.conceptId` has
   `onDelete: "cascade"`, and `generateConceptsForIcp` deletes by `icpId` (`:522`), so **regenerating a concept set
   deletes every script written against it.**
   - It is **latent today.** `ensureConceptsForIcp` regenerates only when no rows exist (`:617-660`), and ICP sharpening
     runs before the kit exists (`routers/icps.ts:314-321`).
   - **It fires on ICP deletion, and on any future "regenerate concepts" action.**
5. **Set identity is per ICP, not per campaign.** The cascade is keyed on `(userId, icpId)` (`icps.ts:319-321`). Two
   kits on one ICP share one concept set, so "one script per concept in a campaign" really means one per concept per
   ICP, unless set identity moves.

---

## D. The known blockers from CHECKPOINT §0.6a, re-checked against code 2026-09-14

| # | blocker | status | where |
|---|---|---|---|
| 1 | no batch can form | ✅ confirmed | §C |
| 2 | requests cascade node `"adCopy"`, whose upstream excludes ad copy | ✅ confirmed — upstream is `["offer", "mechanism", "hvco", "headlines"]` | `conceptScriptGenerator.ts:182`; `_core/cascadeContext.ts:92` |
| 3 | 30-second ceiling vs the ~41–42 s worked example | ✅ confirmed — `PLACEMENT_SAFE_CEILING_SECONDS = 30`; the spec §6 calls it a product decision | `_core/conceptAxis.ts:306` |
| 4 | output is hook + scenes only; no headline, primary text or Tier 1 card | ✅ confirmed — `RawScript` is `{ hookPattern?, scenes? }`, and the table has no such columns | `_core/conceptScriptValidator.ts:27-30`; `schema.ts:1647-1678` |
| 5 | few of the spec's Part One checks implemented | ✅ partly re-counted — **5 structural classes** in the validator (`script_too_few_scenes`, `script_missing_spoken_line`, `script_opening_not_hook`, `script_hook_pattern_mismatch`, `script_length_over_budget`), plus `screenScriptCompliance` and `checkOutput`. **Not recounted rule by rule against §1.1–§1.13 in this pass**; none of Part Two's set-level tests can exist without §C | `conceptScriptValidator.ts` |

### New in this pass

| # | finding | where |
|---|---|---|
| 6 | **no read or edit endpoint** for `conceptScripts`; the header's "read/edit" is unbuilt | `routers/*` (0 hits) |
| 7 | **concepts are never shown to a coach**, so a per-concept script would sit on a concept the coach has never seen | `client/src` (0 hits) |
| 8 | **regenerating concepts deletes their scripts**, through the foreign key's delete cascade (latent) | §C.4 |
| 9 | **no Meta video publish path**; scripts end at a teleprompter with nowhere to go in ZAP | §B.7 |
| 10 | **both screens that advertise video call the other, gated pipeline**, so the natural home for this feature is occupied | §B note |
| 11 | **the generator is synchronous with no job**; any product caller runs up to three LLM calls in one request. The existing concept-job pattern is swept only while `pending` (zombie-job defect, memory `project_zombie_job_defect`) | `conceptScriptGenerator.ts:166-313` |

---

## E. Scope

- **Not contained.** This is not a missing button: the generator is correct machinery with nothing around it (§15d).
- **Reaching it at all** needs, at minimum:
  - a caller that runs asynchronously;
  - a read path;
  - a screen that shows the result against concepts coaches currently never see.

  The one existing screen for it is occupied by a different, gated pipeline. **Rough scope: moderate.**
- **Delivering what `script-rule-spec.md` describes** additionally needs:
  - a batch owner and set identity (§C);
  - set-level validation (Part Two);
  - output beyond hook + scenes — headline, primary text and a Tier 1 card, which means new columns and an isolated
    migration (invariant 6);
  - a kit slot, if the kit stays the source of truth (invariant 3), which is also a migration;
  - a product call on the 30 s ceiling;
  - an answer to the §4.5 structure conflict (Arfeen's 2026-09-11 evidence rule sets the starting position);
  - settled replacement semantics against the delete cascade.

  **A published video ad** needs a Meta video path, which does not exist at all. **Rough scope: structural.**
- **Decisions that are Arfeen's, not CC's, surfaced and not answered here:**
  1. set (a) vs pool (b), or both (§C.3);
  2. the 30 s ceiling;
  3. whether the gated Video Creator and this generator share a screen;
  4. whether video publishing to Meta is in the package or a later one.
