# Session Checkpoint — 2026-06-29b

## STATUS

Has-assets flow fully verified. Two refinements verified-in-browser. **Sprint 1 (placeholder substitution + ad-ICP-race) APPROVED and ready to build — nothing built yet.**

## VERIFIED & WORKING (do not re-litigate)

- Has-assets import-then-enrich flow fully verified end-to-end (trail/162). Coherence check, transport job/poll, correction-append, trail-bar, stale-bundle reload — all confirmed.
- Full-artifact confirm cards + ICP-in-kit (17-section Dream Buyer Profile, PDF/TXT download) — verified in-browser at trail/164. Build `16250cbb`, bundle `index-D9bRvdri.js`, commit `1ec302b`.

## APPROVED, READY TO BUILD — Sprint 1

### Fix A — Placeholder substitution path (bigger finding)

The placeholder system does NOT substitute values into assets. A filled value (price=£1,500) saves to the registry but never reaches generated/rendered/exported text; `resolveTokensInText` has **zero callers anywhere**. A published campaign still shows "[INSERT_PRICE]" after the user fills it.

- **Phase 1 (rails, prerequisite):** resolve-at-render on the kit page + resolve-at-export on Download Brief, Push-to-Meta, Push-to-GHL. Shared resolver — extract existing fns to `server/lib/placeholderResolver.ts` + add recursive `resolveTokensInObject()`; new `client/src/v2/lib/resolveTokens.ts` mirroring regex + synonym map. (Generation-time substitution can't retroactively fix already-built kits — resolve at render/export.)
  - Hook points: render = per-brief memo after load (`V2CampaignKit.tsx:375-387`) → resolved objects into AssetSection (`:859-871`). Download = before extraction in `handleDownloadBrief` (`:483-531`; `exportUtils.ts:195-268`). Meta = server `meta.ts publishToMeta` (~`:287`). GHL = server `ghl.ts pushCampaign`, 9 `upsertCustomValue` sites (`:560-561,617,701,741,775,815,838,862,891`).
- **Phase 2 (after Phase 1 verified):** Tier-1 quick-fill card during has-assets intake (~7 essentials: price, host name, support email, offer/booking link, duration, start date — Skip first-class on every field). Writes via existing `placeholders.save`. **NEVER BUILT** — earlier "building" was aspirational.
- **Open item:** registry keyed `(userId, serviceId)` — verify `serviceId` resolvable at both push points.
- **Verify (real run):** fill price=£1,500 → shows "£1,500" on (1) kit render [screenshot], (2) Download Brief [file], (3) push payload [Meta `createAdCreative` / GHL custom-value, log/network capture]. Then Phase 2 card → same three surfaces, without touching the end editor.

### Fix B — Ad-ICP race (confirmed, stale-upstream class)

Has-assets `importIcp` inserts a THIN ICP, fires enrichment via `setImmediate`, returns immediately (`autoMode.ts:324-380`); client (`V2AutoModeIntakeConfirm.tsx:309-318`) triggers `orchestrate` WITHOUT polling enrichment. Ad copy (step ~5) and ad creatives (step ~9) generate while enriched fields (fears/objections/buyingTriggers) are still NULL → thin ICP → generic hooks. `generateIcp` path already polls; has-assets regressed by skipping it.

- **Fix shape:** has-assets path polls enrichment to completion before cascading (mirror `generateIcp`).
- **GUARDRAIL:** preserve enriched-before-cascade ordering WITHOUT reintroducing the transport-timeout — use the existing POLL mechanism, NOT a long blocking request (already-fixed bug).
- **Verify (real run):** ad copy AND ad creatives reference deep enriched ICP (specific fears/objections, not generic); enrichment completes before ad generators run — show the timing.

**Both:** atomic commit per phase/fix, hold push for go-ahead, gates TS ≤36 + vitest green (`pipeline-fixes.test.ts:3053` has `resolveTokensInText` tests — extend for `resolveTokensInObject`).

## APPROVED FOR LATER — Sprint 2 (navigation/discoverability)

- **Gap 1:** ICP card on the kit page + completion callout ("I also built you a full Dream Buyer Profile — view it") — currently undiscoverable (kit shows ICP name only, `V2CampaignKit.tsx:820`).
- **Gap 2:** node panels need explicit back/close control (`V2ICPResultPanel:352-392` has none) + persistent "View Campaign Kit" route from the trail. Plus the kit-as-hub mental-model rethink (kit = home base for all assets incl. ICP, trail = editor; `?node=&action=swap` deep-links already exist at `V2CampaignKit.tsx:285,321`).

## LOGGED FOR DESIGN SPRINT (not now)

Ad-image VISUAL quality (text styling, placement, classiness) → belongs with the paused landing-page design track. Weak ads = two problems: data half (Fix B) + visual half (here).

## ORIGINAL MISSION, STILL QUEUED (do not touch)

Landing-page DESIGN generator — commits `324b092`, `4ccf4a9`, migration `0082` applied. LIGHT/face-forward templates are the bar (not dark/Kong); reference pages mapped per campaign type. Next MAJOR piece after current sprints; ad-visual-quality folds in.

## OTHER

- Heroieskhan@gmail.com Pro (user 111968) — HOLD until placeholder substitution lands (pushing "[INSERT_PRICE]" = bad first impression).
- Untested: has-assets "Let me upload the right file" re-upload loop (low priority).

## STANDING RULE

"deployed/done" = build logs watched + running commit + bundle hash changed + real browser/DB/log proof. Never trust "should work". `railway-build` IS prod; all prod writes need explicit "execute".

## RESUME TOMORROW

Review CC's Sprint 1 build order → Fix A Phase 1 → verify 3 surfaces → Fix B → verify ad timing → Fix A Phase 2 → verify → Sprint 2.
