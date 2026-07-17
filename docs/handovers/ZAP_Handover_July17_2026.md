# ZAP Handover — 2026-07-17

**Status:** WIP pushed to `railway-build` pending Arfeen's **final visual approval** of the six
`craft-review/final-*` side-by-sides + the proof-composition renders. Gates **TS 35 / vitest 517**.
Not sign-off. Migration `0089` is **APPLIED + verified on prod (2026-07-17)**.

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

## 8. ✅ Migration 0089 — APPLIED + verified (2026-07-17)

`drizzle/0089_lp_proof_light_styles.sql` added `sales_ali_abdaal_light` + `webinar_rajsekar_light` to the
`landingPages.publishedStyle` enum. **APPLIED on prod 2026-07-17** with the read-first guard (0086/0087/0088
pattern): post-apply INFORMATION_SCHEMA verify confirmed **both light values present, 76 rows unchanged**
(text=50 / visual=25 / lead_magnet_burchard=1, identical before/after). The light variants are the DEFAULT
for sales_page/webinar_registration and can now persist on prod — the earlier enum-truncation risk is
resolved. (Migrations 0084–0089 all applied; 0081 superseded — never apply.)

## 9. 🔴 Coach-proof vs offer-proof partition (a BUG — `realTestimonials.ts`)

**Root cause:** the cap-fix query read `serviceId = S OR serviceId IS NULL`, so testimonials scoped to
a coach's OTHER programs never flowed onto a new program's page. **An established coach with 40
testimonials across programs #1–3 launching #4 saw ZERO of their own proof — the coach with the most
proof got the least.**

**Fix (Option A, scope-derived, NO migration):** read **coach-wide** (`getAllCoachTestimonials(userId)`,
`WHERE userId = X`), then `partitionProof(rows, S)`:
- `serviceId === S` → **offer proof** (about THIS program) → the results wall / success grid.
- everything else the coach owns (NULL or another program) → portable **COACH proof** → an authority
  surface near the bio.
Each row lands in exactly ONE bucket → **de-dup by construction** (no quote on the page twice).
Injected as `content.testimonials` (offer) + additive `content.coachTestimonials` (coach); no-op when
the library is empty.

**Discriminator** (`renderRegistry.ts`) now counts **coach-wide** (offer + coach): rich if the coach has
≥1 real testimonial anywhere; light only at genuine zero. The launch case (coach proof, zero offer
proof) → RICH.

**Honesty rule (the point):** the coach-proof surface uses authority framing ("what clients say about
working with [Coach]") — honest for any real testimonial the coach owns, claims nothing about the new
program. The **offer wall is `serviceId = S` ONLY and OMITS when empty** (a brand-new program shows no
results wall — coach proof carries the page). Never relabel coach proof as this program's results; never
pull another program's results into this wall.

**Placement per each frozen reference (not standardised):** sales = editorial quote cards after the
founder narrative (Ali's founder track-record band); webinar = check-bulleted authority items beside the
host bio (Rajsekar's "YOUR TRAINER" credential band). Burchard/Discovery/Hormozi have a single trust
surface (no split) → render offer + coach COMBINED (coach-wide, non-regressive).

**Proven:** rendered all four proof-states (0→light · coach-only→rich with authority band + NO results
wall · offer-only · both) + a rendered-HTML de-dup scan (each testimonial once, no quote in both
surfaces), locked with tests (`realTestimonials.test.ts`, `renderRegistry.test.ts`,
`salesAliAbdaal.test.ts`, `webinarRajsekar.test.ts`).

**DEFERRED follow-up:** an explicit `kind enum('offer','coach')` column on `testimonials` for CURATION
(a book review / "great mentor" quote a coach wants pinned as coach-proof regardless of scope). Not
built — scope derivation covers the launch case, and a curation UI doesn't exist yet.

## 10. Testimonial library — MOUNTED (`/v2-dashboard/settings`)

The last link in the proof chain: the cap fix / partition / presence-gating only matter if a coach can
get their testimonials in. Now they can. A **"Testimonials" section in `V2Settings`** (`client/src/v2/
components/TestimonialLibrarySection.tsx`, new) — coach-level persistent home matching the coach-proof
partition (portable, not campaign-scoped). Full **list + delete** (`testimonials.delete`), a collapsible
**bulk import** (`TestimonialBulkImport`, gained an additive `onImported` callback), and a plain-language
**value banner** after import ("N testimonials added — your landing pages will now show your real
proof"). The in-chat `TestimonialPicker` still handles per-campaign activation (up to 3). Client-only,
additive — publish path + templates untouched; matches V2 styling (Fraunces headings, Instrument Sans,
orange pills). **FOLLOW-UP flagged (not built):** a "manage your full library" link from the in-chat
picker into Settings.

## RESUME POINT
1. Arfeen's **final visual approval** of `craft-review/final-*` + the proof-composition renders.
2. The batched **live-proof** pass
   (needs `execute`): discovery + webinar + event + sales, now with real testimonials + presence gating.
4. The conversational operator-intake sprint (booking_url / video_url / date / price) remains queued.
