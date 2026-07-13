# ZAP Handover — 2026-07-14

## State at handoff
- **HEAD = origin/railway-build = `c19064b`.** Working tree clean of tracked changes (only pre-existing untracked screenshots/artifacts remain — do NOT sweep).
- **Gates:** TS floor **35**; vitest **431** (`pipeline-fixes` 382 + `imageSlots` 23 + `deckCards` 3 + `placeholderLabels` 2 + `burchardProductivity` 6 + `renderRegistry` 8 + `discoveryBurchard` 7).
- Dev-env: git prefix `DEVELOPER_DIR=/Library/Developer/CommandLineTools`; prod harness `railway run --environment production --service coachflow npx tsx <file>` (DATABASE_URL injected).

## Templates shipped on the new pipeline
- **#1 Burchard lead-magnet — SHIPPING-PROVEN LIVE.** `https://zapcampaigns.com/p/campaign-211` (`publishedStyle=lead_magnet_burchard`, real PDF-derived magnet cover, energetic absent). `server/lib/templates/burchardProductivity.ts` + `leadMagnetPublish.ts`. Blank-slate composite honesty fix live: `pdfPageOneCoverUrl`/`resolveProductCoverUrl` derive the real cover from `hvcoTitles.magnetPdfUrl`; graceful empty-states — no fabricated stand-ins anywhere.
- **#2 Discovery — CODE-COMPLETE, PROD-READY (`c19064b`).** `server/lib/templates/discoveryBurchard.ts` + `discoveryPublish.ts`. Burchard design-LANGUAGE applied to a booking flow: real `<a href={bookingUrl}>` "Book a Discovery Call" CTA (no email form), honest "Your Free Discovery Call" composite card (no magnet → no fabricated product), benefit bands bind `consultationOutline`, no tile grid / no FAQ in v1. Gate-judged vs the frozen Burchard bar (headless render at 2240px CSS × 2 DPR) — PASS. **Stages as a review-draft until a coach sets `booking_url`** (none set yet); a live discovery publish needs a coach URL + explicit "execute".

## Phase 0 infrastructure (LIVE)
- **Template registry** (`server/lib/templates/renderRegistry.ts`): `Map<styleMode,{pageType,render}>`. Adding a template = one-line entry. Both publish paths (`landingPagePublisher` + `complianceRewrites`) and orchestration dispatch through it. `styleForPageType(pageType)` → the per-reference style, or `null` → orchestration stages a review-draft (keeps rejected energetic un-shipped).
- **Shared primitives** (`templatePrimitives.ts`): esc/ok/imgOrOmit/sectionOrEmpty/stars/checkCircle/initials/highlightKeyword/highlightTerm/tileIconSet/ctaLink/renderDocument. Minimal — NOT a config engine. Legacy `shared.ts` (energetic renderer, under the 382-test gate) left untouched.
- **Slot-transform** (`slotImageUrl`/`slotDimensions`): wired for legacy/text/visual + templates 2–9. Burchard keeps raw slots (its cover is already a page-1 transform URL).
- **Additive read-surface fields** on `LandingPageContent`: `eventSchedule`, `proofMetrics`, `caseStudies`, `curriculum`, `bonuses`, `price` — all optional, graceful-omit, never fabricated. Structured GENERATION is wired per-template as each template needs it (the strict `json_schema` in `landingPageGenerator.ts` is extended alongside each build).

## Prod migrations (APPLIED + verified)
- **0084** — `landingPages.publishedStyle` += `lead_magnet_burchard`.
- **0085** — `landingPages.publishedStyle` += the 8 templates-2–9 enum values. Prod enum = **11 values**; legacy `energetic/executive/clinical/warm/bold` deliberately EXCLUDED (never re-ship the rejected designs).
- **0086** — `users.booking_url VARCHAR(500) NULL` (additive, nullable; 22 rows unchanged, zero loss).
- **0081 is SUPERSEDED — must NEVER be applied** (would re-enable the old rejected energetic/stub designs across all LPs).

## booking_url (systemic gap closed)
- Per-coach. Also backs the **email/whatsapp** booking-URL CTAs — the pre-existing `[INSERT_BOOKING_URL]` fallback gap is closed: orchestration passes `getCoachBookingUrl(userId)` into both sequences' `eventDetails`.
- Read via a **guarded raw query** (`server/lib/coachBookingUrl.ts`), NOT a typed Drizzle `users` column — adding it to the schema before 0086 applied would have put it in every `select().from(users)` (incl. the auth hot path `db.ts` getUserByOpenId) and broken prod.
- **Queued (trivial, safe now 0086 is applied): promote `booking_url` to a typed Drizzle column** — fold into the webinar branch.

## Reference base — all 5 campaign types FROZEN
`docs/landing-page-references/` (reference PNGs are in **git-lfs**):
- lead-magnet → Burchard Productivity (`lead_magnet_download--brendon-burchard-productivity.png`)
- webinar → Rajsekar (`webinar_registration--rajsekar.png`, 4480×23788 — rendered from saved HTML via DevTools Protocol; complete/styled, only 12 success-avatar thumbnails empty)
- event → Iman Gadzhi + Alex Hormozi (`event_registration--iman-gadzhi.png`, `event_registration--alex-hormozi.png` — generic headline canonical)
- sales → Ali Abdaal (`sales_page--ali-abdaal.png`)
- discovery → Burchard design-language (no own capture — resolved)
Deferred post-launch (dead/duplicate pages): **Jenna/Amy DCA, Jeff Walker, Rajsekar AI-marketing**.

---

## 🟢 RESUME POINT — next session starts here: template #3, Webinar (Rajsekar)

Reference frozen (`webinar_registration--rajsekar.png`), enum `webinar_rajsekar_coaching` live on prod, registry takes a one-line entry. **This is a NEW design bar — NOT Burchard design-language.** A webinar investigate-and-propose prompt was drafted but **NOT yet sent to CC**. **Next action: CC produces its proposal (section-map + video-slot + countdown + CTA + field gaps) BEFORE building** — same discipline that made template #1 and #2 go clean.

Key open structural questions to resolve in that proposal:
- **(a) Video slot** — the reference hero leads with a presenter video. Use the coach's real video URL if they have one; graceful static fallback (hero image / presenter photo) if not. **ZAP NEVER fabricates video.** Flag an additive operator-captured video-URL field (like `booking_url` was for discovery).
- **(b) Countdown timer** — binds to the Phase-0 `eventSchedule` field (date/time/tz). **Review-draft when no date** (same pattern as discovery's booking_url; webinar/event also emit `[INSERT_EVENT_*]` tokens the publish hard-gate rejects).
- **(c) Reserve-seat CTA** — wires to `/api/capture-lead` (unlike discovery's external calendar link; webinar captures the registration).
- **(d) Stats bar / success-stories** — **real-or-nothing**, never invent the reference's "50,000+ / ₹1,500Cr+ / 9,100+" figures for a coach. Bind to `proofMetrics`/`testimonials` where real, omit gracefully otherwise.

**Also queued (small, fold into the webinar branch):** promote `booking_url` to a typed Drizzle `users` column (trivial, safe now 0086 is applied).

**Optional-deferred:** a batched live-proof pass — prove discovery + webinar + event + sales live together once built, rather than proof-per-template. (Template #1 is already live-proven; discovery is prod-ready pending a coach booking_url.)

## Standing discipline (carry forward)
- **Prove-live-not-structure.** Committed ≠ applied ≠ deployed ≠ rendered.
- **Prod writes gated on Arfeen's explicit "execute"** in the immediately-preceding message (CLAUDE.md §10). 0084/0085/0086 were each executed under that gate; the discovery live-proof publish is not yet authorized.
- **Fix the family, not the leaf** (both publish paths dispatch through the registry; booking_url fixed LP + email + whatsapp at once).
- **No fabrication** — stats, testimonials, magnet covers, video, price, URLs must be real coach data or a graceful/non-numeric empty-state; never invented.
- **Investigate-and-propose before building each template** — surface every structural gap up front (the pipeline's whole point).
