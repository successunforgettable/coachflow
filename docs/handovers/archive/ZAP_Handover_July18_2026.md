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
  + PlaceholderEditor) → the six token-driven Zappy questions (N/A first-class). **Finish line: a NEW campaign
  (non-214, non-seeded) publishes because a coach answered Zappy — no SQL, no script.**

## QUEUED FOLLOW-UP (AFTER intake ships — NOT a publish-blocker) — prompt-quality sprint

**Two distinct bracket phenomena — do NOT conflate:**
- **`[INSERT_*]` operator tokens** (uppercase, 6 fields) — the coach's own facts (date/price/booking). The
  INTAKE captures these. They GATE publishing.
- **prose-blanks** (`[Specific numeric result]`, `[mechanism]`, `[misconception]`) — the LLM CORRECTLY
  refusing to fabricate a specific the coach never gave. **No-fabrication working at the generation layer,
  NOT a bug.** They must NEVER be "filled" (nothing real to fill them with; inventing is forbidden).

**Data (2026-07-18 prod scan, 77 LPs):** prose-blanks in landing-page content = **0**. They do NOT block
publishing — campaign-214 published fine. Root-cause: they're **prompt format-skeletons** in FIVE non-LP
generators (`headlinesGenerator`, `hvcoGenerator`, `emailSequenceGenerator`, `whatsappSequenceGenerator`,
`heroMechanismsGenerator`) — e.g. `"[Unique Mechanism] Turns [Audience] into [Result]"`, `"[Specific
Outcome] in 60 Minutes Live"`, `"If you're a [specific archetype]…"`. Showing the model a bracketed slot
occasionally makes it echo the slot verbatim (the §14 failure mode). The landing-page generator uses NO
such skeletons (→ 0 leaks). Other assets only carry INTENTIONAL brackets — `[First Name]` (GHL merge tag),
`[LINK TO LEAD MAGNET]` (link placeholder) — not defects.

**The sprint (polish, not publish-blocker):** audit those 5 generators for "insert specific X / cite a
numeric result" instructions; **rewrite them (per §14 positive framing) to produce compelling copy from
REAL inputs** (mechanism, transformation, ICP pain) rather than demanding a fabricated proof and leaving a
blank — replace bracket skeletons with concrete FILLED examples so the model has nothing to echo. **No
repair-by-fabrication:** a specific the coach didn't give is omitted/reworded, NEVER invented.
- **ALSO in this copy-polish sprint (shipping-page nit, found on the live LP 206):** the webinar "Who is
  this class for?" heading is hardcoded — "class" reads wrong for webinar/event/training pages. Adapt to
  pageType (webinar → "Who is this webinar for?", event → "…this event…") or neutral phrasing.

---

## ✅✅ PHASE FINISH LINE (2026-07-18) — a COACH published a live page via the intake conversation

The landing-page product gate is CLOSED. Arfeen, acting as the coach, opened Kit 171's **"Finish your
page →"** surface and answered Zappy's three questions (date / time / timezone). The page went live with
**no SQL and no script**: **`https://zapcampaigns.com/p/incredible-you-coach-training-program-206`**
(LP 206, `webinar_rajsekar_coaching`).

- **Verified 3 ways:** public GET 200 (29,274 bytes, zero `[INSERT_*]`) · Cloudflare KV read (200, 29KB) ·
  DB row `publicUrl` set with `eventSchedule={date:"28th september 2026", time:"9.30 am", timezone:"india,
  mumbai"}`. **Those are Arfeen's OWN typed answers** — proof the fields were set only by
  `answerOperatorField` (the intake), never seed-scripted (LP 206 had only read-only pulls; the throwaway
  seed script was hardcoded to 214 and deleted).
- **Shipped `8f878ed`** (on `2592aae` core / `09f1a02` publish-style wiring): `deriveOperatorQuestions` +
  `getPublishReadiness` / `answerOperatorField` (applies across all angles; writes the coach column — the
  missing booking/video/checkout setter) + `V2OperatorIntake` mounted in the Kit (replaces the silent
  `publicUrl===null` state — Finding 3). Refinements: front-loaded datetime parse, pageType-aware price
  branches ("free" only on events), URL-hero success. Gates TS 35 / vitest 554.

## BATCHED LIVE-PROOF via the intake (2026-07-19) — 3 of 5 templates proven live; 2 gaps found

Walked fresh/legacy campaigns through the REAL intake tRPC procedures (`appRouter.createCaller({user})` →
`getPublishReadiness` → `answerOperatorField` → `publishToCloudflare`; answers flow through
`applyOperatorAnswer`, NOT SQL). Verified each: HTTP 200 + KV 200 + DB `publicUrl`, zero `[INSERT_*]`.

- **✅ Sales — real price** (LP 208, fresh): £1,497 rendered · `sales_ali_abdaal` (rich). LIVE.
- **✅ Sales — `__BY_APPLICATION__`** (LP 209, fresh): "By application" + "Apply now" CTA + email-capture
  (`sl_optin`, no checkout_url → reveal not dead button). Checkout handling confirmed. LIVE.
- **✅ Discovery — real calendar URL** (LP 172, legacy-visual → re-published `discovery_burchard_performance`):
  real `<a href>` booking CTA ×2, no dead token. LIVE. (Confirms the styleMode-from-pageType wiring
  re-publishes legacy pages as the new template.)
- **🔴 Discovery — `__EMAIL_CAPTURE__` branch: NOT live-proven.** Booking URL is a COACH-WIDE column
  (`users.booking_url`); the LP 172 walk set it to a calendar URL, so LP 177's intake saw booking already
  answered and never asked → the `__EMAIL_CAPTURE__` answer wasn't applied (LP 177 inherited the URL).
  **Findings: (1) one booking mode per coach (can't mix discovery pages); (2) NO "change my answer" /
  edit flow for a captured operator answer.** The email-capture render is unit-proven
  (`discoveryBurchard.test.ts`); live-via-intake needs a coach with no prior URL, or an edit flow.
- **🔴 Event (Iman free / Hormozi paid / venue): NOT proven — no campaign exists.** `event_registration`
  maps ONLY from campaignType `in_person_event` (`CAMPAIGN_TO_PAGE_TYPE`), and no coach has ever created
  one (prod campaignTypes: course_launch/discovery_call/webinar/challenge/product_launch/lead_magnet).
  **The Iman/Hormozi templates + the `__FREE__`/price→Hormozi/`__ONLINE__` branches have NEVER been
  instantiated.** Needs an `in_person_event` campaign created (Arfeen via wizard = truest, or CC via
  cascade) BEFORE the intake can walk it.

**Tally: 5/5 templates built; live-via-intake proven for 3 (webinar 206 + sales + discovery); 5 branches
attempted, 4 live (webinar date/time/tz, sales price, sales by-application, discovery URL), 1 blocked
(discovery email-capture) + event blocked. Both blocks are campaign/coach-state gaps, NOT template bugs.**

## ✅ 5/5 TEMPLATES PROVEN LIVE + full-wizard-run findings (2026-07-20)

Arfeen ran a REAL `in_person_event` campaign through the whole wizard (the truest coach path) → **LP 215,
`event_hormozi`, LIVE at `/p/campaign-215`.** Event template PASSES (cutout, torn dividers, three
deliverables, proof threading, "Tickets are free" copy, `__ONLINE__`/venue badge correct). **This is the
5th and last template proven live — landing-page TEMPLATES are 5/5 DONE.** But running the full wizard
(not just the intake) exposed the sprint-(b) bugs with hard evidence + new finds. Root-causes:

- **🔴 #1 FABRICATED LOCATION (ship-blocking, invisible).** LP 215 copy says "Reserve Your Seat in
  Atlanta", "One day in Atlanta", "LIVE IN ATLANTA", "being in this room in Atlanta" — but the venue
  answer was DUBAI (`eventSchedule.venue` correct; the badge/faq[0] used `[INSERT_EVENT_VENUE]` and
  substituted right). **No `[INSERT_EVENT_VENUE]` token exists in the Atlanta fields — the LLM hallucinated
  a literal city.** Root cause: `landingPageGenerator.ts:334` shows the model `"Register for [city]"` /
  `"Save Your Spot at [venue]"` as CTA examples — a bracketed fill (the §14 skeleton failure) that primes
  it to invent a city instead of emitting the canonical token. Worse than an `[INSERT_]` token: it's a
  plausible wrong fact that ships silently. FIX = generation-side: constrain the event generator to ALWAYS
  use `[INSERT_EVENT_VENUE]` for location, never a literal city (positive framing). NB: (i) existing LP 215
  copy can't be auto-substituted (no token) → needs regen; (ii) the venue ANSWER format ("in person.
  address: in5 tech, media city, dubai") reads awkwardly in "Reserve your seat in ___" → consider a concise
  city/venue capture. Same fabrication family as the queued prose-blank sprint, ELEVATED to ship-blocking.
- **🔴 #2 LONG-COPY FONT.** The `disclosure` body is Poppins, BUT `whoForBody` (eventHormozi.ts:290)
  renders `<ul style="margin…padding-left:20px;">` with NO inline font-family (violates §5 invariant #7)
  AND nests a block `<ul>` inside a `<p>` → the browser breaks it out and it renders default serif
  ("text-editor look"). Poppins IS loaded (fontHref:370). FIX = add `font-family:${B}` to the `<ul>`/`<li>`
  + fix the `<p>`/`<ul>` nesting. Template-level.
- **Sub-observation (minor):** LP 215 `price.amount = "free"` (literal) not the `__FREE__` sentinel → it
  routed to **Hormozi (paid)**, not Iman (free). Arfeen TYPED "free" instead of tapping the "It's free"
  chip. Render reads fine, but normalize typed "free"/"no charge" → `__FREE__` so free routes to Iman.
- **#4/#5 PICKER (confirmed root cause):** `V2Trail.tsx` `offerAngles`/`lpAngles` give every angle card the
  SAME id (`id: offerId`/`id: lpId`) + `selected:i===0`; single-select matches by id → ALL cards select,
  chosen angle LOST (`selectedLandingPageAngle=NULL`). One shared bug. FIX = unique id per angle
  (`${lpId}:${key}`) + persist chosen angle to `activeAngle`/`selectedLandingPageAngle`.
- **New finds:** #10 method names jargony ("Pipeline Honesty Audit") — generator wording · #11 Ad Images
  node ordered LAST, should follow Ad Copy · #12 (design idea) email/WhatsApp counts could auto-derive from
  event-date proximity, not just be asked.
- **Re-confirmed (Finding 5, evidence again):** #3 Zappy freezes after "I'll pick as we go" · #6
  testimonial cap 3 · #7 ad-copy generation FAILED then looped to Offer (no ad-copy retry) · #8 no email
  length choice · #9 WhatsApp auto-ran no 3/5/7.

## FOLLOW-UP PUNCH-LIST (sequence next session)

(a) **Copy polish / prompt-quality** — prose-blank generator rewrites (5 generators, §14) + the "Who is
    this class for?" heading. Polish; blocks nothing.
(b) **Remaining wizard-node fixes** — Offer/LP picker single-select + persist `activeAngle` (Finding 5;
    kit `selectedLandingPageAngle=NULL`) · WhatsApp 3/5/7 length · Email length choice · **NEW: a
    "change my answer" EDIT FLOW for captured operator fields** (dates/prices/booking/typos — coaches WILL
    need to correct these; there is no re-answer path today once an operator field is set). **Building this
    edit flow also CLOSES the discovery email-capture live-proof as a side-effect** (re-answer booking →
    `__EMAIL_CAPTURE__`), so it's tied to the live-proof gap below.
(c) **Batched live-proof — PARTLY DONE (2026-07-19):** ✅ webinar (206) · ✅ sales price (208) + sales
    by-application (209) · ✅ discovery calendar-URL (172). REMAINING: discovery `__EMAIL_CAPTURE__` (blocked
    on the edit flow in (b) — coach-wide booking already set to a URL) · **event Iman-free / Hormozi-paid /
    `__ONLINE__` venue** — Arfeen is creating a real `in_person_event` campaign in the wizard (the truest
    coach path; campaign-creation + cascade for `in_person_event` are THEMSELVES untested — never
    instantiated). CC stands by to walk the intake (`__FREE__`→Iman, price→Hormozi, `__ONLINE__` venue) and
    verify each live (HTTP+KV+DB, zero tokens, correct template) once it reaches the landing-page stage. Do
    NOT trigger the cascade — let the coach path run.
(d) **Auto Mode tier** — asks nothing, holds unknowns, and the held page flows into the SAME "Finish your
    page" surface built here (tier-3 is the landing zone for tier-1's holds).

**PRODUCT DECISIONS FLAGGED (decide later, not code):**
- **Booking URL is COACH-WIDE** (`users.booking_url`) — a coach cannot mix booking modes across discovery
  pages (all their discovery pages share one calendar-URL-or-email-capture answer). Probably fine (a coach
  books the same way everywhere), but it's a deliberate constraint to confirm, not assume. Surfaced by the
  2026-07-19 live-proof (couldn't test URL and email-capture on the same coach).

**Leverage:** (c) is nearly closed (3/5 live; event pending the real coach campaign, discovery-email pending
the (b) edit flow). (b) is the biggest correctness win for the wizard the coach actually uses (the Offer/LP
picker silently loses the angle choice) AND its edit flow unblocks discovery-email. (a) is pure polish.
(d) is the widest-reach vision but builds ON (c). Recommended order next session: **finish (c) event via
Arfeen's campaign → (b) picker + edit flow (closes discovery-email) → (d) Auto Mode → (a) copy polish.**
