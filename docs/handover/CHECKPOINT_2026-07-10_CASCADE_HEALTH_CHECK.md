# CHECKPOINT 2026-07-10 — Post-sprint cascade health check (investigation-only)

**Session type:** investigation only — nothing built, committed, or deployed except this docs/memory checkpoint. Quiz + Lead-Magnet Delivery sprints both COMPLETE and live.

**State:** HEAD = origin/railway-build = `1d63d60` (docs); deployed code `34d20d9`; bundle `index-CQqIl7mU.js`. Gates: TS 35, vitest 382.

## Health check result — cascade HEALTHY, seams SOUND
Live blank-slate lead_magnet campaign on prod → **kit 177** (icpId 239, user 1). **11 of 11 nodes complete.** `[cascade] selectionsResolved` exact match: offer **0/0**, mech **1/1**, hvco **2/2**, headlines **3/3**, adCopy **4/4**, landingPage **5/5**, email **4/4**, whatsapp **7/7**. Assets persisted: offer 192, mechanism 833, hvco **5686**, headline 2004, adCopy 5271, landingPage **211**, email 400, whatsapp 272, **5 ad images**. **Kit 177 + assets remain on prod as the evidence trail — do NOT delete.**

Both sprints' seams verified sound:
- **Deferred-quiz interpose breaks nothing downstream** — no generator reads `hvcoTitles.magnetHtmlUrl`; `[INSERT_LEAD_MAGNET_NAME]` resolves from `hvcoTitles.title`. Only leadCapture (404 until published, a feature) and the GHL push (conditional/skipped if null) read it. Non-fatal try/catch.
- **Static magnet path proven in-cascade** (kit 177 auto-selected a toolkit → generated body → hvco 5686 published, auto-published — not a quiz).
- **Non-lead_magnet types = titles-only** — confirmed on the 15 most-recent real prod campaigns (all `assetBody` NULL + `magnetHtmlUrl` NULL).
- **`getCoachLogoUrl` isolated** to `leadMagnetPublisher`; `landingPagePublisher` reads coachAssets via its own independent query.
- **Has-assets imports not overwritten** (guard `source==="generated" && assetBody==null`).
- Quiz-in-cascade verified via the direct C4 proof (auto-selected titles aren't deterministic) — flagged honestly.

**CF token swap exonerated (verified vs the actual error):** `deployWorker` is non-fatal (`cloudflare.ts:146-147` returns on Workers-Scripts upload failure, never throws), so the token lacking Workers Scripts/Routes does not cause the LP failure. Separate latent risk: that token cannot deploy a brand-new worker/route (the pre-existing `/p/*` worker still serves KV pages).

## THE REAL FINDING — landing pages generate but never go live (pre-existing, NOT sprint-caused, launch-critical)
- **What fails:** `orchestration.ts:414` passes `styleMode: "energetic"` → `landingPagePublisher.ts:181-184` runs `UPDATE landingPages SET publicSlug, publicUrl, publishedStyle="energetic"` → prod DB column is **`enum('text','visual')`** (verified via INFORMATION_SCHEMA) → MySQL truncation → Drizzle throws `Failed query: update landingPages …`. The orchestration log label "LP publish to Cloudflare failed" is **misleading** — the Cloudflare calls succeed; the **DB UPDATE is what throws.**
- **Root cause:** commit `324b092` (2026-06-26, "landing page template system Sprint 1") switched `styleMode` visual→energetic and widened the `schema.ts` enum to 7 values, but its migration `drizzle/0081_landing_page_templates.sql` (which `MODIFY`s the column) was **never applied to prod**. Exactly the CLAUDE.md §9 hazard: committing `drizzle/*.sql` ≠ applied.
- **Impact:** systematic — every auto-mode publish fails. **47 of 69** of user 1's landing pages have NULL `publicSlug`. Last successful publish **2026-06-24**. Broken ~2 weeks. The LP HTML is physically written to KV (step 7 runs first) but the DB never records it → orphaned/unsurfaced. Coaches' landing pages show "complete" but have no public URL — a funnel hole (the LP is where ads send people).
- Also noted (pre-existing, not a regression): `[adCreativesGenerator]` `headline_over_length` flakiness on attempts 1-2/5, self-recovered. Known ≤38-char issue.

## Resume task — decided, not yet started: FIX THE LP PUBLISH DEFECT before the booking-URL sprint
A broken feature beats a missing one; it's live on existing data. Scope it properly first — do NOT just run the 3-week-old migration file:
- (a) verify the actual current `publishedStyle` column state from INFORMATION_SCHEMA;
- (b) establish exactly what `0081_landing_page_templates.sql` does and whether it's still correct;
- (c) determine whether the 47 orphaned landing pages can be recovered/backfilled or must be regenerated;
- (d) **critically — audit whether ANY OTHER migrations were committed but never applied to prod.** If one was missed, others may have been.
- Migration is a prod-table write → needs Arfeen's explicit "execute" (CLAUDE.md §10).

## Queued (after LP fix)
Booking-URL capture sprint — every nextStep/band CTA ("Book My Free Clarity Call") points at the magnet/quiz page, not the coach's real booking URL. Then: brand-capture proper, quiz archetype/multi-category variant, ad-image logo slot.

## Resume verification
Re-verify before trusting: HEAD == `1d63d60` == origin (docs), deployed code `34d20d9`, bundle `CQqIl7mU`, TS 35, vitest 382, prod 200. Kit 177 evidence intact.
