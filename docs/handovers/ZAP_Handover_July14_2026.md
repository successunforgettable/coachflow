# ZAP Handover — 2026-07-14/15 (ALL 5 landing-page templates built + sales craft-polished)

## State at handoff
- **HEAD = origin/railway-build = `09fce00`.** In sync, pushed. Working tree clean of tracked changes (only pre-existing untracked screenshots/docs remain — do NOT sweep).
- **Gates:** TS floor **35**; vitest **478** (`pipeline-fixes` 382 + `imageSlots` 23 + `deckCards` 3 + `placeholderLabels` 2 + `burchardProductivity` 6 + `renderRegistry` 13 + `discoveryBurchard` 7 + `webinarRajsekar` 11 + `eventImanGadzhi` 9 + `eventHormozi` 9 + `salesAliAbdaal` 13).
- Dev-env: git prefix `DEVELOPER_DIR=/Library/Developer/CommandLineTools`; prod harness `railway run --environment production --service coachflow npx tsx <file>` (DATABASE_URL injected).
- Local render+screenshot judging: `npx tsx` a scratch builder call → write HTML to /tmp → `python3 -m http.server` (file:// is blocked) → Playwright MCP navigate/screenshot. Colours sampled from the frozen PNG with PIL (`Image.MAX_IMAGE_PIXELS=None`).

## 🔑 KEY LEARNING — craft ≠ structural PASS (record prominently)
A template passing the **structural** full-page gate (right sections, right order, honest omits) is **NOT** the same as looking **polished**. The sales page passed structurally but Arfeen previewed it and it read **"tacky."** Root causes, all token-level:
- **Headline in Inter-800 sans instead of an editorial serif** (Fraunces). This was the single biggest tell — fonts *loaded fine*; they were just used wrong.
- **Over-saturated colours** — a too-yellow ivory (`#FBF8F1`/`#F5EFE3`) and a bright kelly green (`#16A34A`) vs the reference's barely-warm `#FAF6F3` and muted `#2F9E4E`; orange coral `#FF5A3C` vs soft `#FD6D6D`.
- **Heavy drop-shadows + coloured button glows** vs the reference's near-flat restraint.
- **Tight/uneven spacing** vs generous, consistent vertical rhythm.

The fix was a **token-level design-craft pass judged critically against the frozen PNG** (sample exact hexes; confirm the display font actually renders, not just loads; match weights; restrain shadows; widen spacing). **Going forward every template needs this craft pass — a structural PASS is necessary but not sufficient. Arfeen's eyes on the actual render are the real design gate.** Use the `frontend-design` skill's rigor (fonts first, then colour/spacing/restraint) for the sweep.

## Templates on the pipeline (5 of 5 built)
- **#1 Burchard lead-magnet — SHIPPING-PROVEN LIVE** at `https://zapcampaigns.com/p/campaign-211` (`publishedStyle=lead_magnet_burchard`). `server/lib/templates/burchardProductivity.ts` + `leadMagnetPublish.ts`. Reads `content.featureHighlights` (currently inert — not generated) for its "what's inside" tiles. Live-proven, so likely already reads polished; still worth a craft glance.
- **#2 Discovery — CODE-COMPLETE, PROD-READY.** `discoveryBurchard.ts` + `discoveryPublish.ts`. Burchard design-language on a booking flow; review-draft until a coach sets `booking_url`. **Craft-unverified — at risk.**
- **#3 Webinar (Rajsekar) — BUILT + SHIPPED.** `webinarRajsekar.ts` + `webinarPublish.ts` (`webinar_rajsekar_coaching`→`webinar_registration`). ⚠️ CORRECTED 2026-07-17: NAVY-hero/PURPLE/white (not white/coral — spec misread; rebuilt), Poppins/Outfit. `video_url`→headshot poster→omit; countdown binds a real `eventSchedule.date` (absent → `[INSERT_EVENT_*]` → review-draft); "Is This You" ← existing ICP; reserve-seat → `/api/capture-lead` webinar mode. **Craft-unverified — at risk.**
- **#4 Event (Iman free + Hormozi paid) — BUILT, both full-page PASS, both TUNEs applied.** TWO bespoke builders (`eventImanGadzhi.ts` + `eventHormozi.ts`) + `eventPublish.ts`; registry `event_iman_gadzhi`→`event_registration` (auto-default), `event_hormozi`→`null` (price-gated). Discriminator = `resolveEventStyle(styleMode, content)` in `renderRegistry.ts` (real `content.price` upgrades Iman→Hormozi at (re)publish in `runLandingPagePublish`, driving both render + persisted `publishedStyle`). Iman = dark cinematic poster (black/green/yellow, Montserrat); no headshot → `[INSERT_PRESENTER_PHOTO]` → review-draft. Hormozi = navy/white/purple objection ladder (Inter); price real-or-omit-section (never his $5k); qualification never his $250k/$1m–$100m; Gate-1 proof = honest monogram cards (disclosed divergence). TUNEs: Iman audience-headroom; Hormozi deepest-fallback headshot at natural aspect (no fake 16:9 box). Reserve (both) → `/api/capture-lead` **event mode**. Enum values already live (0085) → no migration. **Craft-unverified — at risk.**
- **#5 Sales (Ali Abdaal) — BUILT + full-page PASS + CRAFT-POLISHED.** `salesAliAbdaal.ts` + `salesPublish.ts`; registry `sales_ali_abdaal`→`sales_page`. **WIDEST blast radius: `styleForPageType('sales_page')` flips null→`sales_ali_abdaal`, so `course_launch`/`product_launch`/`challenge` now publish this template; every other page type keeps its own style (verified).** 14 sections: header → serif hero (video_url→headshot natural-aspect→omit) + green CTA → review wall (monogram, gold stars) → founder (coachBackground, no chart) → "simple formula" panel → systems tile grid (`systemTiles`) → deliverable bands (`consultationOutline` 2–6) → **Gate-1 results (honest testimonial monogram cards; structured `caseStudies` only if operator-supplied w/ real metric STRINGS, never charts — disclosed divergence)** → curriculum accordion (`curriculum`) → offer card → bonuses → guarantee → FAQ → footer. Honesty: price operator-or-`[INSERT_PRICE]`→review-draft; CTA → `checkout_url` (guarded reader, col pending 0088) else `/api/capture-lead` **sales mode** (never a dead button); never fabricates Ali's charts/counts/"6,000 creators"/$5.8m/metric trios. **Craft pass done (see learning): Fraunces serif headline; sampled palette `#FAF6F3`/`#1B1624`/green `#2F9E4E`/coral `#FD6D6D`/gold stars; restrained shadows; flat buttons; 92px section rhythm; subtle hero blob; sky-blue CTA (corrected 2026-07-17). Fonts proven to render (not fallback) via `document.fonts`.**

## Generator additions (additive, sales-branch only, strict json_schema)
`curriculum` (module titles + emoji) + NEW `systemTiles` (≤8 "how it helps" lines) added to the strict schema properties+required and instructed in the sales prompt only; other page types return `[]`. **Deliberately NOT `featureHighlights`** — `burchardProductivity.ts:204` reads that field, and activating it in the shared schema would change the shipped, live-proven Burchard output. A separate `systemTiles` field keeps Burchard byte-identical. Pre-existing `landingPageGenerator` TS2769 (the `db.insert(landingPages).values()` overload) is unrelated — line-shifted 928→959 by the additive lines, part of the 35 baseline.

## Prod migrations
- Applied + verified: **0084** (publishedStyle +lead_magnet_burchard), **0085** (8 template enum values), **0086** (`users.booking_url`), **0087** (`users.video_url`).
- **0088 (`drizzle/0088_users_checkout_url.sql`) — authored as a FILE, HELD. NOT applied. Needs an explicit "execute".** Read out-of-band via `server/lib/coachCheckoutUrl.ts` (guarded raw query) — NOT in the Drizzle `users` schema, so it can't break the auth hot path pre-migration (mirrors 0086/0087 staging).
- **0081 SUPERSEDED — never apply.**

## Per-coach columns
- Typed Drizzle columns: `users.bookingUrl`, `users.videoUrl` (read via `getCoachBookingUrl`/`getCoachVideoUrl`).
- `checkout_url` pending 0088 — read via the guarded `getCoachCheckoutUrl`; promote to a typed column post-0088.

## Reference base — all 5 campaign types FROZEN (git-lfs)
`docs/landing-page-references/`: Burchard lead-magnet · Rajsekar webinar · Iman + Hormozi event · Ali Abdaal sales · discovery = Burchard design-language. Replication specs in `docs/landing-page-references/replication-specs/`. Deferred post-launch: **Jenna/Amy DCA, Jeff Walker, Rajsekar AI-marketing, Hormozi paid-variant live-proof**.

---

## 🟢 RESUME POINT — next actions in order
1. **Execute migration 0088** (`users.checkout_url`) — gated prod write, needs Arfeen's explicit "execute" in the immediately-preceding message. Then promote to a typed Drizzle column + drop the guarded reader.
2. **Craft-polish sweep of the other 4 templates** (Burchard / discovery / webinar / event) — the same rigorous token-vs-reference pass just done on sales, since they passed the same structural gate *before* the craft-check discipline existed. **Discovery / webinar / event are most at risk; Burchard is live-proven so likely fine.** For each: sample the frozen PNG's exact hexes, confirm the display font renders (not just loads), match weights, restrain shadows, fix spacing rhythm, render + screenshot + judge against the PNG. Hold gates.
3. **Conversational operator-intake sprint** — the LOCKED vision (`project_operator_capture_conversational_intake.md`): Zappy-led chat, one ask at a time, skippable, three tiers (Auto asks nothing · Conversational asks all · in-context per-page); NOT a form. It lights up the scattered operator fields (`booking_url`, `video_url`, `eventSchedule`/date, `price`, `checkout_url`, bonus values) so pages can leave review-draft and publish.
4. **Batched LIVE-proof pass** across all 5 types (discovery+webinar+event+sales together) once intake can populate their fields — needs an "execute". Do NOT proof-per-template. (#1 is already live-proven.)

## Open minor
- **Sales hero serif orphan-wrap:** with a long generated headline the serif can leave a short orphan line ("…day / job"). A `text-wrap:balance` (or max-width) guard was OFFERED but **NOT applied** — Arfeen's call. Content-dependent editorial wrapping, not a bug.

## Standing discipline (carry forward)
- **Craft ≠ structural PASS** (this session's lesson) — every template gets a token-level craft pass judged against its frozen PNG; Arfeen's eyes on the real render are the design gate.
- **Prove-live-not-structure** — committed ≠ applied ≠ deployed ≠ rendered.
- **Prod writes gated on Arfeen's explicit "execute"** in the immediately-preceding message (CLAUDE.md §10). 0084–0087 were each executed under that gate; 0088 awaits it.
- **Fix the family, not the leaf** (registry dispatch; blast-radius sweep when touching shared/default paths — e.g. sales flips the `sales_page` default).
- **No fabrication** — stats, testimonials, magnet covers, video, price, URLs, dates, charts, subscriber counts must be real coach data or a graceful/non-numeric empty-state; never invented.
- **Investigate-and-propose before building each template.**
