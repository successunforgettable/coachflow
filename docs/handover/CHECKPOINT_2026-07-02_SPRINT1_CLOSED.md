# Session Checkpoint — 2026-07-02 · SPRINT 1 CLOSED

## STATUS: Sprint 1 DONE ✅

The Tier-1 quick-fill in-chat card is **live and proven end-to-end** for everything it owns. All browser proofs complete. Rails live, race gate live. **Next session = Sprint 2 (navigation / discoverability).**

## What was proven this session (live Playwright on prod + read-only DB)

Two live has-assets runs on prod (served bundle `DfF_I2Lf`): a webinar (serviceId 253, trail/167) and a product launch (serviceId 254, trail/168).

1. **Card renders correctly as an in-chat card** — both campaign types. Pill "Save & continue →", green-check fields, "Skip the rest — I'll add them later" link. The link label **flexes by campaign type**: "Booking / calendar link" (webinar) vs "Checkout / sign-up link" (product launch).
2. **Feel = natural chat beat, not a wall** — warm Zappy lead-in ("A few quick details…"), inline in the stream, all fields optional and pre-filled "from last campaign", one-tap skip.
3. **Card → registry (DB-proven twice):** `[INSERT_PRICE]` = £1,499 written to `placeholderValues` for serviceId 253 (id 84) and 254 (id 92) at exact save timestamps, distinct from any source price. Conversion link **dual-writes** `[INSERT_OFFER_LINK]` + `[INSERT_BOOKING_URL]`. 6 details saved (Start Date left blank = kept as placeholder).
4. **Registry → resolver on the kit (on-screen):** the kit "Fill Your Campaign Details" editor shows **Price `[INSERT_PRICE]` = £1,499 ✓**; the kit placeholder-review treats `[INSERT_PRICE]` as satisfied (the 20 remaining are bonus/guarantee tokens the card never collects — intentional).
5. **Save → clean proceed, build completes 11/11** (webinar run).
6. **Skip → clean proceed, NO wall** — "Skipped — I'll keep these as fill-in-later placeholders." → straight into the build ("Studying the people you help…"). Skip-proof done.

## Live & correct (unchanged)
- **Fix A Phase 1 — substitution rails** (`21d0fe2`). Live.
- **Ad-ICP race gate** (`391d0ef`, V2TrailIntake — awaited enrichment poll before cascade). Live.
- **Fix A Phase 2 — quick-fill card** (`6e0e5f7`). Live + browser-proven.
- Live has-assets intake = `client/src/v2/V2TrailIntake.tsx` (`/v2-dashboard/trail/new`). `V2AutoModeIntakeConfirm.tsx` is DEAD/tree-shaken.

## PARKED — HIGH priority (generation-quality pass, NOT this sprint)

**"User enters price → published asset can show no price."** The generators emit `[INSERT_PRICE]` inconsistently: on the product-launch offer the **active `godfather` angle OMITS the token** while the inactive `free`/`dollar` angles carry it → the published/viewed offer shows **"Pricing: —"**. The generated **welcome email** and the **Campaign Brief** export carry **no price token** either; the webinar funnel emits none anywhere. This is a **generator token-emission inconsistency, not a rails/card defect** (the substitution engine is proven on kit 164 and by the live kit resolver showing £1,499) — but it reaches published output a real customer sees, so it is HIGH, not a minor quirk. **Fix surfaces:** active offer angle, welcome email, Campaign Brief; decide webinar/free-funnel behaviour.

## Next — Sprint 2 (navigation / discoverability)
- Surface the rich 17-section ICP (kit-page card + completion callout — undiscoverable now).
- Node panels need explicit back/close (`V2ICPResultPanel` has none) + persistent "View Campaign Kit" route from the trail.
- Bigger **kit-as-hub** rethink: kit = home base (all assets incl. ICP live there), trail = editor, clean routes both ways.
- THEN original mission (do NOT touch its code): landing-page DESIGN generator (`324b092`, `4ccf4a9`, migration `0082`); ad-image VISUAL quality folds in.

## Gates
TS = 36 (baseline held). Vitest `server/pipeline-fixes.test.ts` = 367/367. Prod healthy (HTTP 200), served bundle `DfF_I2Lf`.

## Known blocker (not urgent)
GHL OAuth token EXPIRED (`tokenExpiresAt 2026-06-08`) — reconnect for real GHL push. Meta valid till 2026-07-10. Not blocking Sprint 2.
