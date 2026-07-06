# CHECKPOINT 2026-07-06 — Bug A shipped; editorial core + 9×16 vertical complete

**HEAD `13d409f` on `railway-build` (= origin, 0 ahead / 0 behind). Served bundle `index-DvCC0BgD.js`. Gates: TS 35, vitest 367/367 (`npx vitest run server/pipeline-fixes.test.ts`). Prod 200.**

> Dev-env note: bare `git` hits an Xcode-license wall on this machine — prefix git with `DEVELOPER_DIR=/Library/Developer/CommandLineTools`.

## State of the ad-image track

### Editorial core — COMPLETE & FINAL (through `cd69742`)
- **Stage 2** render template (`server/_core/compositeHeadline.ts`): Playfair two-tone headline + gradient scrim + campaign-type gold CTA pill + body block; ratio-agnostic. Tabloid photo prompt untouched.
- **Stage 3** editorial photo engine (`server/_core/imageGeneration.ts` flux-2-pro, `server/_core/editorialPrompt.ts`): gold-on-black world, zone-aware composition contract, StyleChooser "Editorial" card. Enum migration widened `styleType`/`designStyle` (Arfeen executed). editorial-aware `regenerateSingle`.
- **Headline→scene link** (`c6cf814`): per-batch LLM micro-call → constrained scene brief per headline into the LOCKED `buildEditorialPrompt` wrapper. Scenes vary by headline, world stays one shoot.
- **Resonant-emotion ceiling — LOCKED** (`cd69742`): literal object-metaphors REJECTED → resonant situation-driven human moments SHIPPED → emotive (explicit expression/posture/close-framing) OVERSHOT into posed/fake. Do NOT re-add explicit-expression direction.

### 9×16 vertical — Option B (on-demand) SHIPPED & LIVE-PROVEN (`f21b953`)
Feed batch unchanged (4:5/1:1); per-concept "Make Vertical (9:16)" generates the vertical on demand reusing the concept's persisted `sceneBrief` → one shoot with its feed version. Migration `ADD sceneBrief JSON + verticalImageUrl VARCHAR(500)` (Arfeen executed). Template reflow (vertical = H/W ≥ 1.5 → UI-safe insets top 0.11·H / bottom 0.20·H + bottom-anchor; 4:5/1:1 byte-identical). `adCreatives.makeVertical(id)` bg mutation. Meta `buildPlacementAwareAssetFeedSpec` (feed→facebook feed+ig stream; vertical→story/reels). Live proof job d310b049 (id 341). Live Meta ad-fire token/LP-gated (accepted ceiling).

### Bug A — FIXED & SHIPPED (`13d409f`)
- **Symptom:** template styles (Quote/Notification/Testimonial) showed "Make Vertical" but returned an unrelated 9:16 Flux photo. User-visible wrong output, pre-existing (not a vertical-work regression).
- **Root cause = DB-labeling gap:** template inserts (`orchestration.ts:490-511`) store `styleType:"tabloid"` + `designStyle:"person_shocked"` — indistinguishable from photo-ads; style+palette live only on `campaignKit.adImageStyle`; testimonial name/title only on the service row. Reliable per-creative discriminator: **`rawImageUrl === imageUrl`** (templates dual-write equal @`orchestration.ts:505`; photo-ad/editorial keep a distinct raw Flux URL).
- **Fix = (b) correct-by-hiding** (option a — true 9:16 template render — is a real build; parked): `V2AdImageCreator.tsx` `canMakeVertical` excludes `isTemplateCard = rawImageUrl != null && rawImageUrl === imageUrl`; `adCreatives.ts` `makeVertical` throws `PRECONDITION_FAILED` for template cards (defense-in-depth). Photo-Ad/Editorial verticals untouched.
- **VERIFIED LIVE in the served bundle** (`index-DvCC0BgD.js` contains `rawImageUrl!=null&&e.rawImageUrl===e.imageUrl)&&(e.…`). Gates TS 35 / vitest 367.
- **Arfeen's browser click-through is OPTIONAL/OUTSTANDING, not blocking.** Path: template-style kit → confirm "↕ Make Vertical" absent on each card; Photo-Ad/Editorial kit → confirm button still present + still generates 9:16.

## Live image-option inventory (CORRECTED — the earlier "tabloid, editorial" line undercounted)

The served `StyleChooser.tsx` offers **five** picker styles:

| Picker style (value) | Engine | Feed format | 9:16 today |
|---|---|---|---|
| **Photo Ad** (`photo_ad`) | tabloid flux-1.1-pro | 1080×1080 | ✅ deterministic prompt |
| **Editorial** (`editorial`) | flux-2-pro gold-on-black | 1080×1350 (4:5) | ✅ when `sceneBrief` present |
| **Quote Card** (`quote_card:<palette>`) | template `renderQuoteCard`, no Flux | 1080×1080 | ✖ excluded (Bug A fix) |
| **Notification** (`notification:<palette>`) | template `renderNotificationMockup` | 1080×1080 | ✖ excluded (Bug A fix) |
| **Testimonial Card** (`testimonial:<palette>`) | template `renderTestimonialCard`, real testimonials only | 1080×1080 | ✖ excluded (Bug A fix) |

Palettes (all templates): charcoal / navy / forest / slate / burgundy. **NOT available:** comparison cards (✗/✓ us-vs-them), endorsements/headshots.

## Next task (on Arfeen's go) — comparison-card compositor
Option in BOTH 4:5 and 9:16. No photo — designed ✗/✓ "us vs them" checklist graphic, Playfair + gold, per-ratio reflow (checklist re-stacks for 9:16). **Investigate-first:** propose where the ✗/✓ content is sourced (offer differentiators? ICP pains?) before building. Do NOT start until the investigation is reviewed.

## Parked
- **Real 9:16 template-card render** (Bug A option a) — deferred enhancement; the 3 template renderers reflow cleanly (only `W=1080/H=1080` is hardcoded), but proper support needs DB labeling + kit/service reconstruction (testimonial name/title) + per-renderer W/H params + 3-style×9:16 proof.
- Retire old `V2AdImageCreator` LP-headline picker.
- Lead-magnet Node-5 content generation (real deliverable body, not titles-only).
- Landing-page multiple-pages sprint.
- Video-quality sprint (built, paused).
- `generateContextualAdHeadlines` ≤38-char flakiness — small hardening pass.

## Resume protocol
On restart: load the three surfaces (MEMORY.md top entry, `memory/session_state_2026_07_06_bugA_shipped.md`, this file), then RE-VERIFY LIVE before trusting the checkpoint (`DEVELOPER_DIR=… git`): HEAD `13d409f` == origin, bundle `index-DvCC0BgD.js`, TS 35, vitest 367/367, prod 200. Do NOT push or build on resume — hold for Arfeen's go on the comparison-card investigation.

## Known blocker (not urgent)
GHL OAuth token expired 2026-06-08.
