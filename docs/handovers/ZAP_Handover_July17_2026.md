# ZAP Handover — 2026-07-17

**Status:** WIP pushed to `railway-build` pending Arfeen's **final visual approval** of the six
`craft-review/final-*` side-by-sides + the proof-composition renders. Gates **TS 35 / vitest 507**.
Not sign-off. One migration (`0089`) is authored + HELD.

This session took the "all 5 templates built" state (prior handover July16) and did the visual/structural
corrections Arfeen's review demanded, then fixed two live proof bugs and rebuilt the proof-gating model.

---

## 1. Presenter cutouts (webinar + Iman) — the "framed rectangle" fix

- `server/lib/images/imageSlots.ts`: `presenterCutoutUrl(url)` (pure delivery-URL transform:
  `e_background_removal,c_fit,w_800,f_png`) + `resolvePresenterCutoutUrl(rawHeadshot)` (publish-time
  HEAD verify). Verified live on the prod Cloudinary account `dunshei0y` (200 image/png). Same pattern
  as the magnet-cover PDF derivation — no new API, no upload job, no migration.
- Webinar `heroPresenter` (`webinarRajsekar.ts`) dropped the bordered card → transparent
  `object-fit:contain` + drop-shadow on the figure. Iman `presenterScene` already used contain+drop-shadow,
  so it just receives the cutout. Wired in `webinarPublish.ts` + `eventPublish.ts`.
- **Fallback = review-draft, never a framed card.** No usable cutout (removal unavailable/failed/no photo)
  → `[INSERT_PRESENTER_PHOTO]` → publish hard-gate → the coach supplies a usable photo. Applied to both.
- Open product note stands: real coaches upload rectangles; the cutout is auto-derived. If bg-removal
  quota is exhausted the page stages a review-draft (does not ship a rectangle).

## 2. Iman palette corrected to the frozen PNG (`eventImanGadzhi.ts`)

Sampled hex-by-hex from `event_registration--iman-gadzhi.png`; the build had one hot `#FF6242` doing
everything. Corrected: **Day cards** black header `#0D0D0D` + orange chart icon + cream `#FAF8F3` body +
orange rule (was orange-gradient header); **All The Details** varied cream / orange `#D14F35` / charcoal
`#282828` (was 3× orange); **With/Without** light `#EFEFED` panels + black headings + green `#22C55E` /
red `#EF4444` borders + solid check badges (was dark panels); **CTA** gold `#E2DC2A` (was hot orange);
accent `#FF6242`→`#D14F35`. Test locks the gold + muted orange and **forbids `#FF6242` regressing**.

## 3. Webinar structural gap closed (`webinarRajsekar.ts`)

Section-by-section audit vs the frozen PNG found two entirely missing sections. Added, real-content-bound:
**"What changes if you don't do this?"** (cost-of-inaction from `problemAgitation`/`whyOldFail`/`scarcity`)
+ a **dedicated navy final CTA**; plus hero grandeur padding. 0.69× → 0.86× of reference height. The
residual is (b) unfakeable testimonial volume, not missing structure.

## 4. 🔴 3-cap fix — a BUG (`server/lib/realTestimonials.ts`)

**Root cause:** `content.testimonials` came only from `services.testimonial1/2/3` — three literal columns,
capped at 3. The unlimited `testimonials` LIBRARY table (its `addMany`/`activateForService` router exists)
was **never wired into LP rendering.** Every coach with >3 testimonials silently lost proof (8 → lost 5).
Not an optimisation — a bug.

**Fix (additive, no migration):** `injectRealTestimonials(content, userId, serviceId)` reads the coach's
full real library (service-scoped + global rows), maps `{name,title,quote}` → the content shape
(`title`→`location`), and **replaces `content.testimonials` verbatim** — bypassing both the 3-column
bridge and any LLM regurgitation. Wired at BOTH publish paths (`landingPagePublisher.ts` +
`complianceRewrites.ts`), **before** the discriminators. No-op when the library is empty (nothing
regresses). The 3 service columns stay for the ad/email/whatsapp generators that legitimately want ~3.
Pure merge logic unit-tested (`realTestimonials.test.ts`).

Family sweep: **Burchard/Discovery** keep `slice(0,2)` — the frozen Burchard PNG shows **exactly 2**
testimonials (Natalie Cruz + Chris Sommer), so it's intentional; the cap fix just makes those 2 the best
real ones. **Hormozi/Sales/Webinar** render the full set. **Iman** uses a non-testimonial proof model
(unaffected).

## 5. 🔴 Sales duplication bug (`salesAliAbdaal.ts`)

The three proof surfaces (review wall `[0-2]`, results grid `[0-5]`, interleaved strips `[3-7]`) all
sliced the **same** array → a coach's quote rendered **2–3×** to fake density. **Live until now.** Fixed
with `allocateProof(content)`: partitions the real testimonials into **disjoint** slices (wall → threaded
strips → results remainder), so each appears **exactly once**, and scales which surfaces render to N
(1–2 single block · 3 wall · 4 +1 strip · 5 +2 · 6–8 wall+3 strips+results · 9+ saturated). Proven no
duplication at N=1,2,3,5,8,12 (unit test asserting each renders once + a rendered-HTML scan + visual
comparison strips).

## 6. Proof-gating → PRESENCE, not magnitude (`renderRegistry.ts`)

The earlier `≥10`/`≥6` thresholds were derived from Ali's and Rajsekar's own pages (30 and 12+
testimonials) — almost no real coach clears them, so a 5–8-testimonial coach was routed to the light page
and **their real proof never appeared** (worse than the 3-cap). Now binary on presence:
**0 real → light spine; ≥1 → rich spine composing for N.** `resolveSalesStyle`/`resolveWebinarStyle`.
Webinar success grid: 6-cap removed, shaped by count (1–2 centered · 3–6 grid · 7–12 multi-row); stats bar
stays omitted (real-or-nothing). Light builders `salesLight.ts` / `webinarLight.ts` are self-contained
(Iman/Hormozi pattern); the rich builders are untouched (their tests pass unchanged).

## 7. Bulk testimonial import (§4)

Makes the cap fix real — the median coach has 5–10 testimonials in a doc with no way in.
- Server `testimonials.addMany` (`server/routers/testimonials.ts`): ≤200 rows, per-row validation
  (never all-or-nothing), dedupe by normalized quote (existing + within batch), returns per-row outcome.
- Client `client/src/v2/components/TestimonialBulkImport.tsx`: paste `Name | Title | Quote` or CSV upload
  (hand-rolled quoted-field parser, header auto-detect), live per-row validation preview with ✓/! badges,
  result summary ("8 added · 2 duplicates skipped"). A real user surface, not an admin tool. NOT yet
  mounted into a page — needs a host surface (settings / intake) to be reachable.

## 8. 🔴 Migration 0089 — AUTHORED + HELD

`drizzle/0089_lp_proof_light_styles.sql` adds `sales_ali_abdaal_light` + `webinar_rajsekar_light` to the
`landingPages.publishedStyle` enum. **NOT applied.** Because the light variants are now the DEFAULT for
sales_page/webinar_registration, **any prod sales/webinar (re)publish that resolves to a light styleMode
will hit enum truncation until 0089 executes.** Execute 0089 (gated, needs explicit "execute") before
light publishing is exercised on prod. (Migrations 0084–0088 applied; 0081 superseded — never apply.)

## RESUME POINT
1. Arfeen's **final visual approval** of `craft-review/final-*` + the proof-composition renders.
2. **Execute migration 0089** (gated) so light defaults can persist on prod.
3. Mount `TestimonialBulkImport` into a reachable surface; then the batched **live-proof** pass
   (needs `execute`): discovery + webinar + event + sales, now with real testimonials + presence gating.
4. The conversational operator-intake sprint (booking_url / video_url / date / price) remains queued.
