# CHECKPOINT 2026-07-10 — Landing-Page Standard + CRITICAL correction (apply first, next session)

**Session type:** docs only. Records today's landing-page visual-quality standard work AND a critical correction to it that is **NOT yet applied** — applying it is the first task next session.

## State
- Lead-Magnet Delivery + Quiz sprints **COMPLETE and live on prod**. Cascade health check **COMPLETE** (kit 177: 11/11 nodes, all `[cascade]` counts exact, both sprints' seams sound). Deployed code `34d20d9`, bundle `index-CQqIl7mU.js`. Gates TS 35 / vitest 382.
- Docs commit **`782f5e3`** (local, unpushed until this checkpoint): `LANDING_PAGE_VISUAL_QUALITY_STANDARD.md` (repo root) + `docs/landing-page-references/` (5 SwipePages creator captures + README) + CLAUDE.md §15 pointer.

## ⚠️ CRITICAL CORRECTION — the standard's governing rule is WRONG (apply first, next session)
The standard as written (`782f5e3`) has the wrong governing rule at **§1 / §1a**. It has been **flagged with a stop-banner** in the file but **not yet rewritten**. The rewrite is task #1 next session.

1. **"Light, not dark Kong" is NOT the rule — delete it as a locked direction.** It was a reaction to one bad template (the dark "energetic"), not a specification. **Both the dark "energetic" template AND any prior "light" instruction are DEAD INPUTS.** Do not carry either forward **in any form** — including as "light-default with exceptions" (which is exactly what the current §1a wrongly says).
2. **The rule is: the five SwipePages landing pages Arfeen selected ARE the bar. Build those.** Each campaign type is built to genuinely **replicate its mapped reference**. Whatever those pages actually do — Forleo's cobalt blue, Walker's editorial navy, Ecom Mixer's alternating light/dark, Burchard's light-plus-dark-accent-band — **is correct because that is what they do.** The standard must not filter them through a colour rule.
3. **Rewrite the standard as a per-reference REPLICATION SPEC.** For each of the five: section order (top→bottom), typography (fonts/sizes/hierarchy), exact palette + accent restraint, spacing rhythm (where padding varies and why), image slots used and how, CTA placement + wording, and specifically what makes it read professional.
4. **The shared invariants CC identified are OBSERVED COMMONALITIES, not a law overriding the references:** face-forward real photography · single-colour discipline · no gradients · real trust marks (not text) · constrained body columns · varied rhythm · editorial type with two-tone headline accent. Keep them as "what the five share," never as a filter.
5. **Burchard stays mapped as a DESIGN-LANGUAGE reference, not a structural/conversion-mechanism reference** — his page is a newsletter signup, not a booking page. Say so plainly.

## ROOT-CAUSE NOTE (record permanently)
The landing-page research + blueprint existed since **~2026-07-01** but lived **only in conversation — never committed.** That is why prior investigations found only a one-line summary, and why this track kept getting rebuilt from scratch. The **ad images got good because their standard lives in the repo** (`docs/AD_IMAGE_VISUAL_QUALITY_STANDARD.md` + `docs/ad-references/`). **Decisions that live only in chat drift and die. Everything material goes in the repo.**

### ⚠️ The NotebookLM research is STILL not in the repo
The shutdown note said "both NotebookLM research documents committed verbatim to `docs/landing-page-research/`." **They are NOT there** — no `docs/landing-page-research/` dir exists; nothing in git history or the filesystem. CC does not have that research text (it was supplied in conversation only). **Arfeen must paste the two NotebookLM documents into `docs/landing-page-research/` next session** — otherwise the root-cause repeats. This is the single most important artifact still missing.

## Live-reference capture status (from the live-page pass, 2026-07-10)
The SwipePages captures in `782f5e3` are the frozen SELECTED designs and remain canonical. Attempting to re-capture the LIVE pages found that **3 of 5 no longer exist in their selected form** — which is *why* the frozen SwipePages captures matter:
- **Jenna Kutcher** — LIVE & matching (`listtolaunch.jennakutcher.com/webinar`): heading font **Maison Mono**, body **Public Sans**, single accent **coral `#EB6C8B`** on CTAs only, 13,471px long-form. Live desktop+mobile captured (`sales_page--jenna-kutcher--desktop.jpg` / `--mobile.jpg`).
- **Marie Forleo** — LIVE, same page RESTYLED (`jointimegenius.com/y/masterclass`): **Oswald** heading, **white** base, **orange `#F45C2E`** accent, single-screen, one "WATCH NOW". (SwipePages capture was cobalt-blue/serif — page has since changed.) Live desktop+mobile captured.
- **Brendon Burchard** — selected design GONE (`brendon.com` → `progressmode.com`, a bare newsletter opt-in). Use the SwipePages capture.
- **Jeff Walker** — specific "Followers-to-Buyers" funnel page not locatable (retired). Use the SwipePages capture.
- **Ecom Mixer** — domain gone (`theecommixer.com` doesn't resolve; past event). Use the SwipePages capture.

## Six recorded LP defects (carry forward)
1. **`publishedStyle` enum drift / migration `0081` unapplied** — 47/69 LPs never published. ⚠️ **Applying `0081` alone ships the WRONG design LIVE — it is GATED behind the rebuild.**
2. **Godfather/dollar prose-price defect** — violates the no-price rule (positive-only prompt fix queued).
3. **Four stub styles** (`executive`/`clinical`/`warm`/`bold`) all alias to `energetic` in `registry.ts`.
4. **No style-selection UI** in the coach panel.
5. **No `campaignType → templateStyle` map** (auto mode hardcodes `"energetic"`).
6. **47 orphaned pages** (generated, null `publicSlug`) — recover or regenerate.

Open funnel gap (separate, queued): every `nextStep`/band CTA ("Book My Free Clarity Call") points at the magnet/quiz page, not the coach's real booking URL — **booking-URL capture sprint**.

## Resume plan (next session)
1. **Apply the §1a correction** and rewrite `LANDING_PAGE_VISUAL_QUALITY_STANDARD.md` as a **per-reference replication spec** (delete the light/dark rule entirely; invariants become observed commonalities). Arfeen to add the NotebookLM research to `docs/landing-page-research/`.
2. **Push** the docs.
3. **Begin the build sequence — image slots FIRST** (image slots and the design rebuild are ONE effort): restore upload, add `hero_image` + `press_logo` slots, wire them; then the **per-reference template rebuild**, with **Arfeen judging against the captures with real images in place** (expect 2–3 iterations per template); then the other four templates, each matched to its reference.

Verify on resume: HEAD/origin, gates TS 35 / vitest 382, deployed code `34d20d9`, bundle `CQqIl7mU`.
