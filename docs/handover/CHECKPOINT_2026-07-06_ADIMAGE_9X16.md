# CHECKPOINT 2026-07-06 — Editorial ad-image core COMPLETE + 9×16 vertical SHIPPED

**HEAD `f21b953` on `railway-build` (= origin, 0 ahead/0 behind). Served bundle `DS_d6yk6`. Gates: TS 35, vitest 367/367 (`npx vitest run server/pipeline-fixes.test.ts`).**

## Shipped & live-proven this session

### Editorial ad-image core — COMPLETE (commits through `cd69742`)
- **Stage 2** render template (`server/_core/compositeHeadline.ts`): Playfair two-tone headline + gradient scrim + campaign-type gold CTA pill + body block; applied to all styles. Tabloid photo prompt untouched.
- **Stage 3** editorial photo engine (`server/_core/imageGeneration.ts` flux-2-pro, `server/_core/editorialPrompt.ts`): gold-on-black world, zone-aware composition contract, StyleChooser "Editorial" card. Enum migration widened `styleType`/`designStyle` (Arfeen executed). editorial-aware `regenerateSingle`.
- **Headline→scene link** (`c6cf814`): per-batch LLM micro-call → constrained scene brief per headline into the LOCKED `buildEditorialPrompt` wrapper. Scenes vary by headline, world stays one shoot.
- **Resonant-emotion CEILING — LOCKED (`cd69742`):** three levels tested — literal object-metaphors (chessboard for "position") → REJECTED; **resonant** situation-driven human moments → SHIPPED; **emotive** (explicit expression/posture/close-framing) → OVERSHOT into posed/fake (AI faces break when made to perform). Restrained situation-driven emotion is the authentic ceiling — do NOT re-add explicit-expression direction. Full record in memory `project_ad_image_visual_quality_design_track.md`.

### 9×16 vertical — Option B (on-demand) SHIPPED & LIVE-PROVEN (`f21b953`)
Unlocks TikTok / Reels / Stories / Shorts. Feed batch unchanged (4:5/1:1); a per-concept "Make Vertical (9:16)" action generates the vertical on demand, reusing the concept's persisted scene → one shoot with its feed version.
- **Migration (Arfeen executed, verified):** `ALTER TABLE adCreatives ADD COLUMN sceneBrief JSON NULL, ADD COLUMN verticalImageUrl VARCHAR(500) NULL;` — both nullable, 337 existing rows untouched all-NULL, no existing column altered. Drizzle `schema.ts` synced.
- **Template reflow** (`compositeHeadline.ts`): `vertical = H/W ≥ 1.5` → UI-safe insets (top 0.11·H, bottom 0.20·H for Stories/Reels/TikTok overlay bands) + bottom-anchor the stack on vertical. 4:5/1:1 byte-identical (behind the `vertical` branch). `generateImage` (tabloid) gained optional `aspectRatio` (default 1:1, unregressed).
- **Generator** (`adCreativesGenerator.ts`): persists `sceneBrief: scene` on editorial rows at feed-batch time.
- **`adCreatives.makeVertical(id)`** background mutation (`server/routers/adCreatives.ts`): editorial → `buildEditorialPrompt(sceneBrief, niche)` @9:16 (same persisted scene = one-shoot); tabloid → deterministic `generateAdImagePrompt` @9:16; `renderAdCreative` auto-reflows; stores `verticalImageUrl`. Guards editorial-without-sceneBrief (legacy).
- **UI** (`client/src/v2/V2AdImageCreator.tsx`): "↕ Make Vertical (9:16)" button in `ImageCard` action row (own `vertIds` busy set + `handleMakeVertical` poll); success shows 9:16 thumb + "Download 9:16"; hidden on legacy editorial (no sceneBrief).
- **Meta export** (`server/lib/metaAPI.ts` + `server/routers/meta.ts` + `client/src/v2/PushKitModal.tsx`): `buildPlacementAwareAssetFeedSpec` (pure, exported) → `createAdCreative` uses `asset_feed_spec` when `verticalImageUrl` present (feed img → facebook `feed` + ig `stream`; vertical img → facebook `story`/`facebook_reels` + ig `story`/`reels`), else unchanged single-image spec. Threaded through `publishToMeta` input + `PushKitModal`.
- **LIVE PROOF (deployed):** feed editorial batch (job 4792f530, ids 338-342) → sceneBrief persisted on all 5 (zones extracted); picked id 341 "Final shortlist again. Lost again." → `makeVertical` job d310b049 ~20s → verticalImageUrl SET. Montage (feed 4:5 | 9:16 | 9:16+safe-bands): https://res.cloudinary.com/dunshei0y/image/upload/v1783290236/comparison_vertical-live-341-1783290234491.png.png — same woman/wardrobe/pose/setting as feed (one-shoot via persisted scene), native 752×1344 (ratio 1.79, own headroom not a crop), text clears bottom-20% + top-10% bands. Meta mapping proven offline; live ad-fire token/LP-gated (accepted ceiling).

## OUTSTANDING — DO FIRST NEXT SESSION (before any new build)
**Integrity report Arfeen requested that was never run** (vertical shipped before it). Read-only, report only, code evidence for each:
1. **Headline→image pairing correct** — headline N gets scene N (not offset/mismatched). Show the loop (`adCreativesGenerator.ts` editorial loop: `headlineList` → `generateEditorialSceneBriefs` → `scenes[i]` paired with `headlineList[i]`).
2. **Different campaigns → different images** — inputs are campaign-scoped. Show input sourcing (niche/problem/scene all from the service/kit).
3. **Nothing disconnected** — verify still-intact, list each + status: feed batch, tabloid, headline generator, CTA-by-campaign-type, recomposite/regenerate, kit→creative flow, existing Meta push.
4. **Full image-option inventory** — styles (tabloid, editorial) × formats (4:5, 9:16); and what's NOT available (comparison cards, endorsements/headshots).

## NEXT BUILD (only after integrity report reviewed + Arfeen's go)
**Comparison-card compositor** — an option in BOTH 4:5 and 9:16. No photo — designed ✗/✓ "us vs them" checklist graphic, Playfair + gold, per-ratio reflow (checklist re-stacks for 9:16). **Investigate-first:** propose where the ✗/✓ content is sourced (offer differentiators? ICP pains?) before building. Do NOT start until the integrity report is reviewed.

## Parked
- Retire old `V2AdImageCreator` LP-headline picker (long-LP-headline-on-image path superseded).
- Lead-magnet Node-5 content generation (real deliverable body, not titles-only).
- Landing-page multiple-pages sprint.
- Video-quality sprint (built, paused).
- `generateContextualAdHeadlines` ≤38-char flakiness — small hardening pass (intermittent `headline_over_length` after 5 retries on longish niches; fails BEFORE editorial code, unrelated; re-fire succeeds).

## Resume protocol
On restart: load the three surfaces (MEMORY.md top entry, this file, `memory/session_state_2026_07_05_adimage_stage2_shipped.md`), then RE-VERIFY LIVE before trusting the checkpoint: HEAD `f21b953` == origin, bundle `DS_d6yk6`, TS 35, vitest 367/367, prod healthy. Do NOT push or build on resume — hold at **"integrity report first, then comparison cards on Arfeen's go."**
