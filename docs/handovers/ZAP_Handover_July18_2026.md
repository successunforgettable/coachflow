# ZAP Handover — 2026-07-18

**Investigation-only session.** No code shipped; `HEAD = origin/railway-build = 7c819bb`, tracked tree
clean, gates **TS 35 / vitest 517**. The findings below are the most important of the phase and must not
be lost — they explain why everything we built this phase is, in production terms, invisible.

Prior code detail: `ZAP_Handover_July17_2026.md`. This session was a live-run bug report from Arfeen on
`/v2-dashboard/trail/181` → a full root-cause of the landing-page publish path + an 11-node wizard audit.

---

## 🔴 FINDING 1 — Only ONE landing page has ever published on prod

Prod query (`landingPages`): **77 total, 26 with a `publicUrl`.** Of those 26, **25 are old legacy
`visual`-style rows** (published long ago) and **1 is id 211** (the Burchard live-proof, 2026-07-09).
**All 51 `text`-style pages: zero published.** **Zero** sales / webinar / event / discovery / light pages
have EVER gone live. Last 7 days: 3 created, **0 published**. The entire per-reference template phase has
produced exactly **one** published page (211). In production terms, everything we built is invisible.

## 🔴 FINDING 2 — The publish gate is working CORRECTLY; the templates are not the problem

Campaign 181 / LP 214 (Arfeen's, path=manual): the generated content **literally reads**
`"the training runs live on [INSERT_EVENT_DATE] at [INSERT_EVENT_TIME] [INSERT_EVENT_TIMEZONE]"` — no
event date was ever captured. The publish hard-gate (`server/landingPagePublisher.ts:148–153`,
`html.match(/\[INSERT_[A-Z_0-9]+\]/g)` → throw) **correctly refused to publish** — shipping a webinar page
that says "live on [INSERT_EVENT_DATE]" would be broken. **17 of the 51 unpublished pages carry
`[INSERT_*]` tokens** (mostly event/webinar missing a date). The pages can't publish because **the
operator fields they require — event date, price, booking URL — are never captured anywhere in the
product.** This is the INTAKE gap, not a rendering gap. The templates are fine; they're starved of the
fields that make them publishable.

## 🔴 FINDING 3 — The review-draft state is completely SILENT

`server/_core/orchestration.ts:~438` wraps `runLandingPagePublish` in a **non-fatal try/catch** → the
gate's throw is swallowed, the cascade continues, the landingPage node marks **"complete,"** advances to
Email, and **the coach is never told their page isn't live or why.** So a correct review-draft looks
exactly like a finished page. (The Railway runtime logs for the 07-17 21:28 run had rolled with the
redeploys since — but the DB state is conclusive: the token is in the page content, the code provably
throws on it, the page is unpublished `text` with no url.)

## 🔴 FINDING 4 — Two-state vs three-state model (the structural root)

Fields are modelled **present/absent**, but reality has **three** states:
`answered-with-a-value` / `answered-as-NOT-APPLICABLE` / `unanswered`. Collapsing "not applicable" into
"missing" is the root cause of the intake trap:

- **Discovery booking URL** — a coach who takes enquiries **by email** has no calendar link. That's a
  *complete* answer, read as *missing* → `[INSERT_BOOKING_URL]` → review-drafts **forever**. An email-only
  coach can NEVER publish a discovery page. (The graceful pattern already exists — sales `checkout_url`
  absent → email capture; discovery should do the same.)
- **Sales price** — "by application / price on a call" is legitimate → `[INSERT_PRICE]` blocks forever.
- **Event price** — `content.price` is present/absent with **no "free" representation**. `resolveEventStyle`
  routes absent→Iman(free), present→Hormozi(paid). So free and unanswered are identical → a genuinely free
  event publishes fine (Iman has no price token), BUT an **unanswered-but-actually-paid** event silently
  ships as a **free** page, and intake that waits for a number strands a free coach.
- **Event location** — "online" is complete. Iman defaults no-venue → "Live online" (graceful);
  **Hormozi** emits `[INSERT_EVENT_LOCATION]` → blocks. Inconsistent.
- **Already graceful — leave alone:** checkout URL (→ email capture), video (→ poster/omit).
- **Genuinely always-required — correct to gate:** event date/time/timezone, presenter photo.

Intake implication: Zappy must ask **"is it X or Y?"** where one branch is a *complete* answer that fills
the field — "free or paid?", "calendar link or email?", "fixed price or by application?", "in person or
online?" — and reserve review-draft for genuine silence. **N/A must be a first-class answer, not a skip.**
Architecturally: a three-state field (value / not-applicable / unanswered) via a sentinel
(`price:{free:true}`, `booking:{mode:"email"}`) or an "answered" marker distinct from the value; the
discriminator + publish gate then read the N/A answer as "field complete, publish."

## 🔴 FINDING 5 — 11-node wizard audit (`client/src/v2/V2Trail.tsx`)

- **Landing Page node** shows **angle-headline cards** ("Original: …", "Godfather: …"), never the rendered
  page. The page IS auto-published to `/p/{slug}` (when it publishes), but the only surface is an
  easy-to-miss **"Live at: {publicUrl} →"** link in the Kit (`V2CampaignKit.tsx:~104`) — absent whenever
  `publicUrl` is null, which is almost always (Finding 1).
- **Offer + Landing Page pickers are broken: all cards show "✓ Selected."** Root cause: their "options" are
  **angle sub-fields on ONE DB row**, so every card gets the **same parent id** (`id: offerId`/`id: lpId`,
  `V2Trail.tsx:1353/1368`); the single-select handler `selected: c.id === cardId` (`:801`) then matches ALL
  cards. Worse than cosmetic — **the angle choice is LOST** (proven: kit 181 `selectedLandingPageAngle=NULL`).
  The working deck nodes (mechanism/hvco/headlines/adCopy) deal one card **per row** with unique ids →
  single-select works.
- **WhatsApp** — no 3/5/7 length choice; **violates the locked elastic-sequence spec** (engagement + sales
  are the elastic pair). The server supports `sequenceLength` (3|5|7); the wizard never asks or passes it.
- **Email** — no length choice; auto-generates and advances.
- **TestimonialPicker** — still caps at 3, and its copy ("Using N of 3 … appear in your landing page,
  emails, and ads") is now **wrong for pages**: the LP path reads the library coach-wide and OVERWRITES the
  selection at publish. The ≤3 selection still drives ad-copy/email/whatsapp/offer generation only.
- **Ad Images — WORKS. The known-good reference implementation:** uses `StyleChooser` (a dedicated
  single-select component, not a card deck → no id collision) and reveals the **real artifact** (the
  generated images). The fix pattern for Landing Page is "be like Ad Images": clean single-select + show the
  coach the actual thing.

Node-by-node: Service/ICP (intake/reveal, no choice) · Offer 🔴picker · Method/Lead-Magnet/Headlines/Ad-Copy
✅ (unique-id decks) · Landing Page 🔴picker + 🔴never shows the page · Email 🔴no choice · WhatsApp 🔴no
choice (spec violation) · Ad Images ✅.

---

## RESUME POINT — in order

(a) **Three-state model proposal (Finding 4)** — prompt drafted, NOT yet sent. This sits UNDER the intake;
   get the model right before building on it. N/A is a first-class answer, not a skip.
(b) **Surface the review-draft (Finding 3)** — the node must say *"your page needs an event date before it
   can go live"* instead of silently marking complete.
(c) **Conversational intake sprint** — the actual unblocker; captures date / price / booking URL. Locked
   vision: Zappy-led, one ask at a time, progress-signalled, graceful skip, three tiers (Auto asks nothing
   / conversational asks all skippably / in-context at review). See
   `project_operator_capture_conversational_intake`.
(d) **Fix the Offer/LP picker** — unique ids per angle card + persist the chosen angle to `activeAngle`
   (model on the working per-row deck nodes; leave mechanism/hvco/headlines/adCopy/AdImages untouched).
(e) **LP preview** — pointless until pages actually publish; do it last.

Not doing (at time of the findings above): any build. Those findings were read-only diagnosis.

---

## ✅ MILESTONE (same day, 2026-07-18) — FIRST webinar page verified LIVE on prod

After the diagnosis above, the three-state model was built and Step 1 (prove one page publishes) was
executed. **`https://zapcampaigns.com/p/campaign-214` is LIVE and Arfeen has visually confirmed it in his
browser.** (LP 214 = trail 181's webinar; `publishedStyle=webinar_rajsekar_coaching`.)

- **Visually confirmed by Arfeen:** cutout presenter · correct Rajsekar per-reference template · real event
  date + countdown · **zero `[INSERT_*]` tokens** · and — the first REAL-DATA proof test — the coach-proof
  authority section ("what clients say about working with Arfeen") rendered **6 testimonials, once each, no
  duplication.** Template + slot rendering + coach/offer proof chain proven LIVE, not just in fixtures.
- **Verified 3 ways:** public GET 200 (32,917 bytes) · direct Cloudflare KV read (`ZAP_PAGES["campaign-214"]`
  → 200, 32,873 bytes) · DB `publicUrl` set. (A reported-URL scare — a tested slug `webinar-181-4c5f43`
  404'd — was a URL mismatch: that slug is in neither DB nor KV nor generated by any code; `campaign-214`
  is the real, live slug.)
- **⚠️ CAVEAT — published via HAND-SEEDED fields + MANUAL token substitution (a throwaway Step-1 script),
  NOT coach input.** Recipe proven token-free: seed structured `eventSchedule` AND substitute the baked
  copy tokens (`[INSERT_EVENT_DATE/TIME/TIMEZONE]` in subheadline/scarcity/faq + `[INSERT_REPLAY_AVAILABILITY]`).
  **The intake is what makes this reproducible by a coach — that is the phase's finish line.**
- **🔴 The root-cause that reshaped the intake:** `[INSERT_*]` tokens are BAKED INTO THE LLM COPY, not only
  emitted by templates → an answer must write the structured field AND substitute the copy token. The
  generator already carries a per-section allow-list (`landingPageGenerator.ts`) but it is prompt-only,
  scattered, and uses the §14-forbidden negative-list pattern → it must be canonicalized + constrained.
- **Landed + pushed to `railway-build`:** `bfadc6b` three-state foundation (`operatorFields.ts`) ·
  `09f1a02` publish-styleMode derived from `pageType` (manual publish path now renders the per-reference
  template + runs the gate). Gates: TS 35 / vitest 532.
- **NOW BUILDING — the intake core:** `OPERATOR_TOKEN_REGISTRY` + `resolveOperatorToken` (unify three-state
  + PlaceholderEditor) → constrain the generator (with the unknown-token fail-safe) → the six token-driven
  Zappy questions (N/A first-class). **Finish line: a NEW campaign (non-214, non-seeded) publishes because a
  coach answered Zappy — no SQL, no script.**
