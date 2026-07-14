# ZAP Handover — 2026-07-14 (webinar shipped)

## State at handoff
- **HEAD = origin/railway-build = `bb1a7c2`.** In sync. Working tree clean of tracked changes (only pre-existing untracked screenshots/artifacts remain — do NOT sweep).
- **Gates:** TS floor **35**; vitest **442** (`pipeline-fixes` 382 + `imageSlots` 23 + `deckCards` 3 + `placeholderLabels` 2 + `burchardProductivity` 6 + `renderRegistry` 8 + `discoveryBurchard` 7 + `webinarRajsekar` 11).
- Dev-env: git prefix `DEVELOPER_DIR=/Library/Developer/CommandLineTools`; prod harness `railway run --environment production --service coachflow npx tsx <file>` (DATABASE_URL injected).

## Templates on the pipeline (3 of 5 built)
- **#1 Burchard lead-magnet — SHIPPING-PROVEN LIVE.** `https://zapcampaigns.com/p/campaign-211` (`publishedStyle=lead_magnet_burchard`, real PDF-derived cover, energetic absent). `server/lib/templates/burchardProductivity.ts` + `leadMagnetPublish.ts`.
- **#2 Discovery — CODE-COMPLETE, PROD-READY.** `server/lib/templates/discoveryBurchard.ts` + `discoveryPublish.ts`. Real `<a href={bookingUrl}>` CTA, honest "Free Discovery Call" composite, bands bind `consultationOutline`, no tile/FAQ v1. **Review-draft until a coach sets `booking_url`** (none set yet); a live publish needs a coach URL + explicit "execute".
- **#3 Webinar (Rajsekar) — BUILT + SHIPPED (`a312682` + `bb1a7c2`, 2026-07-14).** `server/lib/templates/webinarRajsekar.ts` + `webinarPublish.ts`; registry entry `webinar_rajsekar_coaching` → `webinar_registration`. NEW design bar (white/coral `#FF5847`/navy `#04113A`, Poppins). Full 10-section page; Gate-1 (hero media + reservation-card composite) + full-page self-judged vs the frozen PNG = PASS.
  - **Media** = coach's REAL `video_url` (YouTube/Vimeo/file → provider embed) → headshot poster in the 16:9 frame with NO fake play affordance → omit. ZAP never fabricates video.
  - **Countdown** binds a REAL `eventSchedule.date`; absent → `[INSERT_EVENT_*]` tokens → publish hard-gate → **review-draft until an event date is set**. A parseable (ISO) date shows the timer; unparseable → the timer hides itself (no fake clock).
  - **"Is This You"** cards bind the coach's EXISTING long ICP (`pains`/`frustrations`/`objections`, first-sentence-trimmed at resolve time in `webinarPublish.ts`) — NOT a fresh generation call. 3-part framework ← `consultationOutline`. Success grid = real `testimonials` only (monogram avatars, no padding to the reference's 12, no invented figures). Bonuses = generated title+description; monetary value renders only when operator-supplied (never a fabricated ₹/$). Numeric stats bar OMITTED (real-or-nothing).
  - **Reserve-seat** = button-only by default (matches the frozen "no visible fields"), reveals a minimal email+consent capture on click → **webinar mode on `/api/capture-lead`** (email+consent only, no magnet delivery; `hvcoId` nullable → NO migration). Owner resolved from the LP `publicSlug` read from the page URL at runtime.
  - Build-time reconciliation: the reference's separate hero-photo and Wistia-video blocks are merged into ONE media surface (no redundant empty second video).

## Phase 0 infrastructure (LIVE)
- **Template registry** (`renderRegistry.ts`): `Map<styleMode,{pageType,render}>`; add-template = one-line entry; both publish paths (`landingPagePublisher` + `complianceRewrites`) and orchestration dispatch through it; `styleForPageType(pageType)` → per-reference style or `null` → orchestration stages a review-draft.
- **Shared primitives** (`templatePrimitives.ts`): esc/ok/imgOrOmit/sectionOrEmpty/stars/checkCircle/initials/highlightKeyword/highlightTerm/tileIconSet/ctaLink/renderDocument. Minimal — NOT a config engine. Legacy `shared.ts` untouched.
- **Additive read-surface fields** on `LandingPageContent` (eventSchedule/proofMetrics/caseStudies/curriculum/bonuses/price — graceful-omit, never fabricated). Structured generation wired per-template — webinar now generates `bonuses` (title+description; value operator-only) via the shared strict `json_schema`.
- `landingPagePublisher.styleMode` imports `LpStyleMode` from the registry (no re-listed union) so a new template never drifts the publisher signature again.

## Prod migrations (APPLIED + verified)
- **0084** — `landingPages.publishedStyle` += `lead_magnet_burchard`.
- **0085** — `landingPages.publishedStyle` += the 8 templates-2–9 enum values. Prod enum = **11 values**; legacy excluded.
- **0086** — `users.booking_url VARCHAR(500) NULL`.
- **0087** — `users.video_url VARCHAR(500) NULL` (read-first guard: column ABSENT before, additive nullable; 22 rows unchanged, zero loss; verified via INFORMATION_SCHEMA after).
- **0081 is SUPERSEDED — must NEVER be applied.**

## Per-coach typed columns
- `booking_url` and `video_url` are now **typed Drizzle `users` columns** (`users.bookingUrl` / `users.videoUrl`), promoted from guarded raw queries now 0086/0087 are applied. `getCoachBookingUrl` / `getCoachVideoUrl` read typed. Auth hot path (`getUserByOpenId → select().from(users)`) verified booting on prod with both columns present.
- `booking_url` also backs the email/whatsapp booking-URL CTAs (systemic `[INSERT_BOOKING_URL]` gap closed via orchestration wiring `getCoachBookingUrl` into both sequences' `eventDetails`).

## Reference base — all 5 campaign types FROZEN
`docs/landing-page-references/` (git-lfs): Burchard lead-magnet · Rajsekar webinar · Iman + Hormozi event · Ali Abdaal sales · discovery = Burchard design-language (no own capture). Deferred post-launch: **Jenna/Amy DCA, Jeff Walker, Rajsekar AI-marketing**.

## 🔒 LOCKED VISION — Operator-Capture = Conversational Intake (NOT a form)
The scattered operator-captured fields (`booking_url`, `video_url`, `eventSchedule`/date, sales `price`, bonus values, future ones) are collected via a **Zappy-led conversation**, never a big form: one ask at a time, progress-signalled ("2 more and your page's ready"), graceful skip out loud (missing = omit, never a blocker; optional nudge, never forced), same field pool + fallback rules as the in-context/review path. **Three tiers → three user types:** (1) Auto Mode asks NOTHING; (2) Conversational intake asks everything one turn at a time, skippable; (3) In-context / at-review fills each field as its page needs it. **SEPARATE post-template sprint — do NOT build now** (needs the per-template fields to exist first). Memory: `project_operator_capture_conversational_intake.md`.

---

## 🟢 RESUME POINT — next session: template #4, Event (Iman/Hormozi)
References frozen (`event_registration--iman-gadzhi.png`, `event_registration--alex-hormozi.png`), enum `event_iman_gadzhi` + `event_hormozi` live on prod, registry takes one-line entries. **NEW design bar.** Investigate-and-propose FIRST (section-map + field gaps) before building — same discipline that made #1/#2/#3 go clean.

**Key structural question to resolve in the proposal:** two event variants — **free (Iman)** vs **paid (Hormozi)**. Flag whether they are **one builder with variants** (shared section engine, variant flags for free-vs-paid CTA/price/agenda) or **two separate builders** (two enum values, two files). Decide in the proposal, not mid-build. Paid/Hormozi implies a `price` field (operator-captured, never fabricated — same class as booking_url/video_url); free/Iman is a registration capture like the webinar.

## Carry-forward notes
- **(a) Webinar countdown needs ISO-format dates** from the intake to show the live timer — non-ISO strings hide the timer (honest). Downstream-intake concern, not a template bug.
- **(b) Batched live-proof pass** — prove discovery + webinar + event + sales LIVE together once the intake sprint can populate their operator fields (booking_url / video_url / event date / price). Do NOT proof-per-template. (Template #1 is already live-proven.)
- **(c) Queued sprints (after templates):** the conversational operator-intake sprint (locked above); then **Auto Mode orchestration + intake** — the product's core signup→cascade→kit flow.

## Standing discipline (carry forward)
- **Prove-live-not-structure.** Committed ≠ applied ≠ deployed ≠ rendered.
- **Prod writes gated on Arfeen's explicit "execute"** in the immediately-preceding message (CLAUDE.md §10). 0084/0085/0086/0087 were each executed under that gate.
- **Fix the family, not the leaf** (both publish paths dispatch through the registry; booking_url fixed LP + email + whatsapp at once; publisher styleMode imports the registry union).
- **No fabrication** — stats, testimonials, magnet covers, video, price, URLs, dates must be real coach data or a graceful/non-numeric empty-state; never invented.
- **Investigate-and-propose before building each template** — surface every structural gap up front.
