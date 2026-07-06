# CHECKPOINT 2026-07-07 — Ad-image track CORE COMPLETE (six styles live)

**HEAD `1744878` on `railway-build` (= origin). Served bundle `index-Bw9-BR6u.js`. Gates: TS 35, `npx vitest run server/pipeline-fixes.test.ts` 367/367. Prod 200.**

> Dev-env note: bare `git` hits an Xcode-license wall on this machine — prefix git with `DEVELOPER_DIR=/Library/Developer/CommandLineTools`.

## Ad-image track — CORE COMPLETE

Six selectable ad-image styles are live, each × 4:5 (feed) and 9:16 (on-demand vertical):

| Style (picker value) | Engine | Notes |
|---|---|---|
| **Photo Ad** (`photo_ad`) | tabloid flux-1.1-pro | deterministic photo prompt |
| **Editorial** (`editorial`) | flux-2-pro gold-on-black | zone-aware composition contract |
| **Quote Card** (`quote_card:<palette>`) | template `renderQuoteCard`, no Flux | 5 palettes |
| **Notification** (`notification:<palette>`) | template `renderNotificationMockup` | 5 palettes |
| **Testimonial** (`testimonial:<palette>`) | template `renderTestimonialCard` | real testimonials only |
| **Comparison** (`comparison_card:<palette>`) | template `renderComparisonCard`, no Flux | NEW — ✗/✓ us-vs-them, premium gold-on-dark |

Palettes (all templates): charcoal / navy / forest / slate / burgundy.

Supporting machinery in place across the track:
- **Headline→scene link** (`c6cf814`): per-batch LLM micro-call pairs each headline to a constrained editorial scene brief (index-locked).
- **Resonant-emotion ceiling LOCKED** (`cd69742`): human-moment scenes, not literal object-metaphors; explicit-expression direction overshoots into posed/fake — do NOT re-add.
- **Meta-compliance verification**: creatives are compliance-checked; placement-aware `asset_feed_spec` maps feed→facebook feed + ig stream and vertical→story/reels.
- **On-demand 9:16 vertical** (`f21b953` + this sprint): editorial/photo-ad reuse the persisted `sceneBrief`; comparison cards reuse persisted `{palette, pairs}` and re-render synchronously (no Flux) — the first template style with genuine vertical support.

## Comparison cards — what shipped this sprint (commit `1744878`)

New 6th style, pure-render (no Flux), designed ✗/✓ "us vs them" checklist in 4:5 + 9:16.

- **Content source** (the crux): a new LLM micro-call `generateComparisonPairs` (`server/_core/comparisonPairs.ts`) — mirrors `generateEditorialSceneBriefs`. Generates parallel, campaign-specific, COMPLETE self-contained ✗/✓ pairs from the real service + ICP + mechanism context already assembled in the orchestration adCreatives case. Positive-only prompt (~7-word complete lines, land on a strong final word, no dangling phrases). Never parses prose. Run-on reject (cap 80, whole-pair drop — never mid-word truncation). Grounded never-throw fallback.
- **Renderer** (`server/_core/renderComparisonCard.ts`): opentype → resvg → sharp. Premium gold-on-dark editorial register — two-tier Playfair headline ("The old way vs." near-white over the method in gold), gold column headers + dividers + top hairline, old-way text dimmed vs offer side bright, ✗ red / ✓ green semantic discs (drawn as SVG, font-independent). 4:5 two-column; 9:16 restacks WITHOUT-block over WITH-block with a **fit-loop** that guarantees every row lands inside the Reels/Stories UI-safe zone (top 0.11·H / bottom 0.20·H). `shortMethod` guards a long mechanism string.
- **Wiring**: `comparison_card` rides the template path in `orchestration.ts` (isTemplate); pairs generated once, lead pair rotated across 5 variations; persists `{palette, pairs}` to the new `adCreatives.comparisonPairs` json column, imageFormat 1080×1350. `adCreatives.makeVertical` gains a comparison branch (`comparisonPairs != null`) that re-renders 9:16 synchronously and returns `{jobId:null, verticalImageUrl}` — placed BEFORE the Bug-A template guard. `StyleChooser.tsx` adds the 6th card + live preview + palette picker (default Charcoal). Client `V2AdImageCreator.tsx` allows `canMakeVertical` for comparison cards and skips polling on the null jobId.
- **Migration** (already applied to prod, Arfeen go): `ALTER TABLE adCreatives ADD COLUMN comparisonPairs json NULL;` — verified live, existing rows NULL.
- **Discriminator** for a comparison card everywhere = `comparisonPairs != null`.
- **Live proof** (real prod campaign svc 258 + real LLM, no deploy/no prod write): 5 valid campaign-specific complete pairs, both ratios clean. Montage: https://res.cloudinary.com/dunshei0y/image/upload/v1783368082/comparison_cmpcard-premium-258-1783368080354.png.png

## Outstanding (verification only, NON-BLOCKING)
- Arfeen browser click-through of the Comparison style + Make Vertical (pick "Comparison" in StyleChooser → run a campaign → verify 4:5 batch of 5 with complete campaign-specific pairs + premium palette → Make Vertical on one → correct 9:16 restack).

## Parked / next candidates — ad-track additive
- **Real 9:16 render for the other 3 template styles** (Quote / Notification / Testimonial) — Bug-A option (a). Comparison card proves the pattern; needs DB labeling + per-renderer W/H params + kit/service reconstruction for testimonial name/title.
- **Retire old `V2AdImageCreator` LP-headline picker** (long-LP-headline-on-image path superseded).
- **`generateContextualAdHeadlines` ≤38-char flakiness** — intermittent `headline_over_length` after retries on longish niches; small hardening pass.

## Bigger parked sprints (beyond ad-track)
- **Lead-magnet Node-5 content generation** — LAUNCH-CRITICAL: Node 5 names the lead magnet but doesn't generate the actual deliverable body. → [[project_leadmagnet_content_generation_sprint]].
- **Landing-page multiple-pages sprint.**
- **Video-quality sprint** (built, paused on quality).
- **ZAP Intelligence / performance-loop** — the strategic flagship (close the loop from generated assets → Meta performance → regeneration). Meta's official Ads MCP is a tailwind here.
- **Over-generation "surface a curated few"** — the Generate-More-Show-Less question applied to the ad-image batches.

## Resume protocol
On restart: load MEMORY.md top entry + `memory/session_state_2026_07_07_adimage_core_complete.md` + this file. RE-VERIFY LIVE before trusting (`DEVELOPER_DIR=… git`): HEAD `1744878` == origin, bundle `index-Bw9-BR6u.js`, TS 35, vitest 367/367, prod 200. Do NOT push/build on resume — hold for Arfeen's go on the next sprint.

## Known blocker (not urgent)
GHL OAuth token expired 2026-06-08.
