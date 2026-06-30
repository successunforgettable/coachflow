# Session Checkpoint — 2026-06-29c

## STATUS

Sprint 1 (placeholder substitution + ad-ICP race) — **Fix A Phase 1 and Fix B both BUILT, PUSHED, and VERIFIED.** Only **Fix A Phase 2** (the quick-fill card) remains, then Sprint 1 is done.

## DONE & VERIFIED THIS SESSION

### Fix A Phase 1 — placeholder substitution rails (commit `21d0fe2`, live)

Live bundle was `index-D6mQFDMt.js`. New shared `server/lib/placeholderResolver.ts` (+ recursive `resolveTokensInObject`) and `client/src/v2/lib/resolveTokens.ts`; substitution wired into **render** (kit `*Preview` components), **download brief**, **Meta push**, and **GHL push** (all 10 content values). serviceId: GHL derives from `kit.icpId` (null-guarded), Meta takes it as an input param. Resolvers no-op when no filled value (already-built kits degrade gracefully).

**VERIFIED:**
- **Render rail proven** on already-built **kit 164** via DB ground truth — raw `[INSERT_EVENT_DATE]` in storage → `"1st July 2026"` on the live page; raw token resolved away (absent from DOM). Screenshot `fixA-p1-render-proof-kit164.png`.
- **Download brief confirmed clean** — it's a curated one-line-per-asset summary that doesn't carry price by design (NOT a gap). PDF generates fine post-change (no regression).
- **Push-path accepted as verified** via the reconstructed GHL payload (`[INSERT_PRICE]`→£1,500, unfilled `[INSERT_GUARANTEE_TERMS]` correctly left raw) + same-resolver proven at render. serviceId derivation (`kit.icpId`→`idealCustomerProfiles.serviceId`) verified by manual join: kit 164 → serviceId 250.
- The **live-fired Meta proof was ABANDONED deliberately** — it required publishing a live LP first (bigger side-effect than a clean paused ad: no kit has BOTH a published LP AND a tokenized Meta payload), not worth it for a proof already strongly evidenced. Capture literal £1,500-to-GHL naturally later when GHL is reconnected (see blocker).

### Fix B — ad-ICP race (commit `5762547`, live & verified)

Client-only (`V2AutoModeIntakeConfirm.tsx`): has-assets now polls `enrichmentJobId` to completion (via existing `pollIcpJob`) BEFORE `orchestrate`, so ad copy/creatives always read the enriched ICP. Guardrails honored: existing poll mechanism (no transport-timeout regression) + graceful degradation to thin ICP on enrichment failure (try/catch → proceed). Loader stays in `"icp"` phase — no dead screen.

**VERIFIED by timeline** (real has-assets run, fitness fixture, kit 165 / serviceId 251):
- `importIcp` 15:57:42 → **enrichment complete 16:00:20** → **orchestration start 16:00:25 (+5s)** → ad copy 16:01:32 → ad creatives 16:01:50+.
- Browser showed ~10 "thinking" messages during the wait (no dead screen), then "ICP imported" with a deep enriched persona, THEN the cascade.

**Honest caveat:** the race was **INTERMITTENT** — a timing gamble (sometimes enrichment won, sometimes the cascade did → generic hooks on unlucky runs). The pre-fix sample **kit 164 happened NOT to race** (its enrichment finished 11:39:32, its ad copy ran 11:40:45 — enrichment won by ~73s), so there is **no clean before/after**. Fix B's proven value is **REMOVING the gamble** so the enriched read happens every time — NOT a measured quality delta (correctly not overclaimed). No forced-race A/B needed.

## IMMEDIATE NEXT — Fix A Phase 2 (the only thing left in Sprint 1)

Tier-1 quick-fill card during has-assets intake. **~7 askable essentials** (price, host name, support email, offer/booking link, duration, start date). **Skip first-class on EVERY field** (no front-wall). Placed **after the confirm cards / before orchestrate**. Writes via existing `placeholders.save` (serviceId in scope at intake). Since Phase 1 rails are now live, anything filled here flows straight into rendered/exported assets. **NOT built yet.**

**VERIFY when built:** real has-assets run → fill price in the card → confirm it carries to the asset (render) WITHOUT touching the end-of-flow editor (proves card → registry → Phase-1 rails end to end). **Gates:** TS ≤36, vitest green. **Hold push for explicit go.**

## KNOWN BLOCKER (not urgent)

GHL OAuth token is **EXPIRED** (`tokenExpiresAt 2026-06-08`, `token_valid=0`). Any real GHL push throws `FORBIDDEN` until reconnected via the Push modal's "Reconnect". Not blocking Sprint 1; reconnect when convenient (also unblocks capturing the literal £1,500-to-GHL proof). **Meta token is valid** (expires 2026-07-10). DB table names: `ghl_access_tokens`, `meta_access_tokens` (Drizzle keys ≠ DB names). `jobs` uses snake_case `created_at` (no `updated_at`).

## QUEUED — Sprint 2 (after Sprint 1): navigation/discoverability

- **Gap 1:** surface the rich 17-section ICP (kit-page card + completion callout — currently undiscoverable).
- **Gap 2:** node panels need an explicit back/close control (`V2ICPResultPanel` has none) + a persistent "View Campaign Kit" route from the trail; plus the bigger **kit-as-hub** rethink (kit = home base where all assets incl. ICP live, trail = editor, clean routes both ways).

## THE ORIGINAL MISSION, STILL QUEUED (do NOT touch its code)

Landing-page DESIGN generator — commits `324b092`, `4ccf4a9`, migration `0082`. LIGHT/face-forward templates are the bar (not dark/Kong), reference pages mapped per campaign type. Next MAJOR piece after Sprint 2. The ad-image VISUAL quality (text styling/placement/classiness — the "visual half" of the weak-ads problem; the "data half" was Fix B) folds into this. Logged: `project_ad_image_visual_quality_design_track`.

## OTHER

- **Heroieskhan@gmail.com** is Pro (user 111968) — hold him until Fix A Phase 2 lands (so the up-front-details path is complete).
- Has-assets flow otherwise fully verified. Untested low-priority: has-assets "Let me upload the right file" re-upload loop.

## STANDING RULE (held well this session)

"deployed/done" = build logs watched + running commit confirmed + **bundle hash actually changed** (NOT just Railway "SUCCESS" — the container cutover lags; the served bundle must move). **Caveat learned this session:** for a **code-split route change** (e.g. Fix B in `V2AutoModeIntakeConfirm`), the main `index-*.js` entry hash does NOT move — verify via Railway's active `commitHash` + behavioral proof instead. Real browser/DB/log proof always. Prod writes/pushes need explicit "execute"/"go". `railway-build` IS prod. Test on thin/realistic input, not the exhaustive docs.

## RESUME NEXT SESSION

Build Fix A Phase 2 (quick-fill card) → verify the fill-during-intake → asset-render path → that closes Sprint 1 → then Sprint 2 (navigation/discoverability).

## COMMIT STACK (railway-build)

```
<this checkpoint commit> docs: session checkpoint 2026-06-29c — Fix A Ph1 + Fix B verified, Phase 2 remains
5762547 fix: poll enrichment before cascade on has-assets path (Fix B — ad-ICP race)
21d0fe2 feat: placeholder substitution rails (Fix A Phase 1)
fe920b7 docs: session checkpoint 2026-06-29b — Sprint 1 approved, nothing built yet
```
