# Session Checkpoint — 2026-07-05 · Ad-image Stage 2 SHIPPED; Stage 3 proposed

**HEAD `86c7b34` on `railway-build`, all on origin (nothing local-only, clean tree). Client bundle `index-BdeiV8t_.js` (Stage 2 is server-only → bundle unchanged; deploys via boot markers). Gates: TS 35, `vitest run server/pipeline-fixes.test.ts` 367/367. Prod 200.**

## Shipped & proven this session — Ad-image Stage 2 (render-template rebuild)
| Commit | What |
|---|---|
| `586537a` | `renderAdCreative` (successor to compositeHeadline): 2-font cache (Playfair Display ExtraBold + Instrument Sans, OFL static-instanced, in `assets/fonts`), gradient scrim, two-tone per-glyph headline (accent across wrap boundaries), body block, gold CTA pill. All render sites (parity). Flux photo prompt untouched. |
| `03fe247` | CTA resolves by **serviceId** (adCreatives.campaignId is NULL everywhere) via latest campaign kit. Shared `server/_core/campaignCta.ts`. |
| `86c7b34` | Strip markdown-escaped `[INSERT\_…]` tokens from reused ad-copy body. |
| `332cae3`, `47f9c1e` | Housekeeping: standard doc + 50-image reference set (downsampled ~1080px, 4.7MB) in `docs/`. |

Root of Stage 2: text layer was a bare white-outline headline; now a designed template (Playfair two-tone gold, scrim, campaign-type gold pill), applied to every photo style incl. tabloid. Proven live via `recompositeText` on real prod tabloid images (webinar 253 → "SAVE MY SEAT", product_launch 258 → "GET INSTANT ACCESS"). Two bugs caught + fixed by the live proof (serviceId CTA resolver, escaped-token body leak).

## Next — Ad-image Stage 3 (editorial photo engine): PROPOSED, NOT built, hard stop for Arfeen go
Full detail in `memory/project_ad_image_visual_quality_design_track.md` (STAGE 3 section). Summary:
- **(a) short-headline source** — fresh generation ALREADY uses the short ad headline + AI emphasis; long headlines come only from `recompositeText` (the "put my LP headline on the ad" feature, which the cheap Stage-2 proofs used). So (a) is small: prove short path live + optional wizard AI-emphasis.
- **(b) editorial photo engine** — flux-1.1-pro → **flux-2-pro** (`prompt`, `reference_images` ≤8, `aspect_ratio`), JSON gold-on-black recipe (near-black + warm gold rim + business wardrobe + location class + action-in-setting + declared copy zone), 50-set fed as `reference_images` for one-world consistency, `editorial` added as a new selectable `adImageStyle` beside tabloid (tabloid stays); fix two defects (`generateAdImagePrompt` ignores `problem`; `${niche} world` phrasing). Cost ≈ $0.03/MP; latency heavier — measure at build.
- **Text-over-face** — today's placement is a FIXED centre-bottom band, subject-position-agnostic → text lands on the face. Fix needs BOTH: editorial photo reserves a copy zone AND the text-placement becomes zone-aware (composition contract). Not just "better photos."
- **Provenance (definitive)** — every ad photo is generated 100% from the user's own campaign niche via a text prompt; the 50-set is NEVER fed to Flux (prompt-only Replicate input, no image param; no code reads `docs/ad-references`). References are a style guide/spec only.

Proof bar: real creative, short headline + gold accent, gold-on-black editorial photo, eyeballed vs the 50 refs. Gates TS 35, vitest 367/367. Nothing pushes without Arfeen's go.

## Also parked
- **Lead-Magnet Content Generation (Node 5)** — Node 5 is titles-only; generate the real asset for blank-slate users. Build AFTER the ad-image track.
- Ad-image later sub-stages: dual aspect ratios, comparison-card compositor. Endorsement family parked. Defaults = 4 families.

## On resume (crash or normal)
1. Load `memory/MEMORY.md` + `memory/session_state_2026_07_05_adimage_stage2_shipped.md` + this doc.
2. Re-verify LIVE first (never trust the checkpoint): HEAD matches origin (latest `86c7b34`, `git log origin/railway-build..HEAD` empty), bundle `BdeiV8t_`, TS 35, vitest `pipeline-fixes` 367/367, prod healthy.
3. Then await Arfeen's go on the Stage 3 editorial build (proposal ready; hard stop).

## Known blocker (not urgent)
GHL OAuth token EXPIRED 2026-06-08.
