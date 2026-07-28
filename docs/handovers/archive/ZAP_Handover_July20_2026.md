# ZAP Handover — 2026-07-20

**Live-run + investigation session (no fixes started — all fixes are NEXT session).**
`HEAD = origin/railway-build = 49734ec`, tracked tree clean, gates **TS 35 / vitest 554**.

## ✅ MILESTONE — ALL 5 landing-page templates proven LIVE via the intake

The landing-page TEMPLATE phase is COMPLETE. Every template has published a real, live, token-free page
driven by operator answers through the intake (`answerOperatorField` → `publishToCloudflare`), no SQL:

| Template | Proof | Branch(es) exercised |
|---|---|---|
| **Webinar** (Rajsekar) | LP 206 — coach in browser | date / time / timezone |
| **Sales** (Ali Abdaal) | LP 208 · LP 209 | real price · `__BY_APPLICATION__` (+ checkout→email-capture) |
| **Discovery** (Burchard) | LP 172 | real calendar URL |
| **Event** (Hormozi) | **LP 215 — full wizard run** | `__FREE__`→free tickets · `__ONLINE__` / Dubai venue |

Event (LP 215) rendered correctly: cutout presenter, torn black dividers, three numbered deliverables,
proof threading, "Tickets are free" copy, venue badge. **The remaining work is the WIZARD wrapping the
templates, not the templates themselves.**

Still open from the batched pass (not template bugs): discovery `__EMAIL_CAPTURE__` branch (blocked by
coach-wide booking + no edit flow — closed by the P2 edit flow below).

---

## 🔴 P1 — ATLANTA FABRICATION (ships a lie — DO FIRST)

The event generator is given **no location at generation time**, so the LLM **invents a plausible city
("Atlanta")** and bakes it into ~6 places in the event copy: `primaryCta` ("Reserve Your Seat in
Atlanta"), `subheadline` ("One day in Atlanta"), `eyebrowHeadline` ("LIVE IN ATLANTA"),
`insiderAdvantages` ("being in this room in Atlanta"). The coach's real venue answer was **Dubai**.

- **Why it ships:** the venue answer fills `eventSchedule.venue` (the badge + `faq[0]`, which DID use the
  `[INSERT_EVENT_VENUE]` token). But the Atlanta fields carry **no token** — the LLM wrote a literal city,
  so the intake had nothing to substitute. A plausible WRONG fact ships invisibly (worse than an
  `[INSERT_]` placeholder).
- **Root cause:** `server/landingPageGenerator.ts:~334` shows the model `"Register for [city]"` /
  `"Save Your Spot at [venue]"` as CTA examples — a bracketed fill (the §14 skeleton failure) that primes
  it to invent a city instead of emitting the canonical token.
- **Fix:** constrain the event generator to **emit the location TOKEN** (`[INSERT_EVENT_VENUE]`; the
  template already emits `[INSERT_EVENT_LOCATION]` on the badge — reconcile to ONE canonical token) for
  every location reference, never a literal city (positive-framing rewrite; drop `[city]`/`[venue]`
  examples). Then the venue answer substitutes EVERYWHERE.
- **Sweep:** look for other invented specifics baked the same way (cities, dates, numbers) across the event
  + other generators — this is the no-fabrication line breached at the one unguarded layer (generation).
- **Riders:** (i) LP 215's baked "Atlanta" can't be auto-substituted (no token) → needs REGEN; (ii) the
  venue ANSWER format ("in person. address: in5 tech, media city, dubai") reads awkwardly in "Reserve your
  seat in ___" → capture a concise city/venue; (iii) minor: typed "free" stored literal → routed Hormozi
  not Iman → normalize "free"/"no charge" → `__FREE__`.

## 🔴 P2 — PICKER DATA-LOSS (Offer + Landing Page)

Offer + Landing-Page pickers (shared logic in `V2Trail.tsx` `offerAngles`/`lpAngles`) give every angle
card the SAME id (`id: offerId` / `id: lpId`) + `selected:i===0`. Single-select matches by id → clicking
one selects ALL, and the chosen angle **never persists** → `selectedLandingPageAngle` / offer save as
**NULL** → the published page uses a DEFAULT angle, not the coach's pick.
- **Fix:** unique id per angle card (`${lpId}:${key}`, like the working per-row deck nodes) + **persist**
  the single-select choice to `activeAngle` / `selectedLandingPageAngle`. One fix covers both pickers.
- **Fold in the operator-field EDIT FLOW** ("change my answer" for dates/prices/booking/typos) — also
  closes the discovery `__EMAIL_CAPTURE__` live-proof (re-answer booking → email-capture).

## P3 — real node bugs

- **WhatsApp:** no 3/5/7 length choice — violates the locked elastic-sequence spec; server supports
  `sequenceLength`, the wizard never asks or passes it.
- **Email:** no length choice.
- **Ad Images node is LAST** — should come right after **Ad Copy** (creative flows from copy).

## P4 — polish

- **Zappy frozen after "I'll pick as we go"** — dead manual-path state (reported 3×, still unfixed).
- **Jargon method names** ("Pipeline Honesty Audit", "Rep Dependency Diagnostic") → plainer wording
  (generator).
- **Misfiring ad-copy error** — the error message misfired; ad-copy did NOT actually fail (display bug).
- **Testimonial-picker copy misleading** — copy implies the LP is capped at 3; the LP reads the library
  coach-wide (the cap fix works). The "3" is the AD/EMAIL picker limit and is CORRECT — only the COPY is
  misleading.
- **Long-copy font mismatch** — FAQ / "What do I walk away with" renders text-editor-style.
  `eventHormozi.ts:290` `whoForBody` emits `<ul>` with NO inline font-family (breaks §5 invariant #7) +
  nested invalidly inside a `<p>` → default serif. Poppins loads fine. Fix: add `font-family:${B}` to the
  `<ul>`/`<li>` + fix the `<p>`/`<ul>` nesting.

## P5 — enhancement (last)

- **Auto-derive email + WhatsApp sequence length from event-date proximity** (closer → shorter, further →
  longer nurture). Arfeen's idea — good, but an improvement, not a bug.

## ✅ FALSE ALARMS (confirmed NOT bugs — do not "fix")

- **Testimonial cap of 3 on the LP** — the LP is coach-wide (cap fix works); the "3" is the correct
  ad/email picker limit.
- **Ad-copy "failure"** — it did NOT fail; the error message misfired (a display bug, listed under P4).

---

## RESUME POINT

Build **P1 → P2, report BOTH before P3**, then **P3 → P4 → P5**. **P1 (Atlanta) is the priority — it's the
no-fabrication discipline breached at the one unguarded layer (generation).** No fixes are started; the
templates are done (5/5 live), the wizard is the remaining work. Hold TS 35 / vitest 554.

---

## PROGRESS (2026-07-20, later) — P1 + P2 + edit-flow + ad-copy loop SHIPPED; wizard flow-rework proposed

- **✅ P1 Atlanta fabrication — FIXED + verified live** (`5f0eb25`): generator LOCATION LOCK (emit
  `[INSERT_EVENT_VENUE]`, never invent a city) + token unification + long-copy font. Regenerated event
  LP 217 → 10 venue tokens / 0 cities; walked intake → `/p/campaign-217` venue everywhere, no Atlanta.
- **✅ P2 picker data-loss — FIXED** (`5e6e91f`): unique id per angle card + persist `activeAngle`
  (publisher-critical) / `offers.activeAngle`. DB-verified; **picker VISUAL still to confirm in Arfeen's
  browser (deferred to P4).**
- **✅ P2 edit flow — BUILT + verified live** (`d9f946c`): `reanswerOperatorField` (old→new copy sub +
  re-set field) + "Your details — edit any" in the finish-your-page surface. Changed venue on 217 (old
  gone) + **closed the discovery `__EMAIL_CAPTURE__` branch** (172 URL→email-capture live).
- **✅ Ad-copy LOOP — FIXED + shipped** (`1d54127`): zero-cards Skip now `continue`s (advances) instead of
  the shared `return` that re-dealt the same node. Unblocks campaign 179. Arfeen confirms in browser.

### 🔧 TO-DO (confirmed, independent, dependency-safe — do anytime)
- **Ad-Images node runs LAST; move it right after Ad-Copy** (creative flows from copy). Simple `AUTO_STEPS`
  reorder (move the `adCreatives` entry up to after `adCopy`). ad-images depend on headline+ad-copy only
  (both done by then), so it's safe. Needs a browser pass to confirm the wizard flow.

### 🧭 WIZARD FLOW-REWORK — FULL PROPOSAL (awaiting build decision; P3+ items are DOWNSTREAM of this)

Two structural problems Arfeen surfaced — the same conversation (the shape of the wizard flow):

**PROBLEM A — operator facts captured too LATE.** Date/time/price/venue/booking are captured in the intake
(the Kit "finish your page" surface) AFTER LP + email + WhatsApp generate. But sequence length depends on
the event date, and copy depends on venue/price → generation runs on hardcoded guesses (`sequenceLength:3`,
`orchestration.ts:~500`) + `[INSERT_*]` placeholders, then patches after. The date arrives too late to
inform what needs it.

**PROBLEM B — generated assets never shown AT the node.** Each generative node generates, marks complete,
advances — without showing the coach the real output. Current map:
- Offer / Method / Lead-magnet / Headlines / Ad-Copy → a deck of **short/truncated previews** (pick + tweak) — partial review.
- **Landing Page → angle HEADLINE cards, NEVER the rendered page** (the July-18 bug is this exact instance).
- **Email / WhatsApp → a summary reveal card ("full detail in your Kit")** — no real content, no regen.
- **Ad Images → the only node that shows the true artifact** (but runs LAST).
The real asset only appears in the Kit — too late to react. The wizard's whole point is CONTROL; without
in-node review it's "Auto Mode with extra clicks."

**PROPOSED FLOW (wizard-only):** facts captured UPFRONT + every node shows its REAL asset with
approve/regenerate. Reordered sequence:
`[CAMPAIGN FACTS] → Offer → Method → Lead-Magnet → Headlines → Ad-Copy → Ad-Images(after copy) →
Landing Page(show the page) → Email → WhatsApp`.

**AUTO MODE — confirmed NOT broken.** Both changes are WIZARD-ONLY and REUSE the same machinery (the
operator-token registry + resolveOperatorToken + the review surface). Auto Mode keeps generate-first-
backfill (one line → cascade → hold gaps → finish-your-page) — a blank-slate coach gives no facts upfront
and has no nodes to review. This is exactly the locked three-tier model (Auto asks nothing · wizard asks
upfront · in-context at review). The Auto cascade is untouched.

**ABSORBS OTHER BUGS:** (A) kills Atlanta at the SOURCE (generator has the venue → never invents; P1's
token-constraint becomes the Auto-Mode safety net) + enables email/WA auto-derive-from-date (P5). (B)
absorbs the July-18 "LP never shown" + the picker-visibility issues (pick by seeing the real asset).

**SCOPE (honest):** NOT a deep cascade rewrite — generators/registry/render/intake all EXIST. It's FLOW
rework. (A) = MODERATE (move the intake to the front + plumb facts into orchestrateStep → generators,
replacing placeholders + hardcoded length; wiring, not new generation). (B) = MODERATE→LARGE, UI-heavy
(render each node's real asset — LP page preview, actual emails/WA messages — + Approve/Regenerate,
extending the regen that dealable nodes already have). Not a hard launch blocker (Auto Mode is a viable
launch path), but the wizard isn't a real wizard until this lands.

### 🔒 LOCKED SEQUENCING (2026-07-20 decision)
**Fix the WIZARD (Problems A + B) FIRST — it serves EXISTING-ASSETS coaches, the priority launch users.
Auto Mode comes AFTER.** All P3/P4/P5 build items are HELD as downstream of this flow rework. Suggested
phasing: **Phase 1** — facts-upfront + plumb into generation (A); **Phase 2** — in-node real-asset review +
approve/regenerate per node (B); then the P3/P4/P5 items fold in (WhatsApp 3/5/7 + email length ride on
facts-upfront; ad-images reorder is part of the new sequence; picker visual + LP-preview are part of B).
