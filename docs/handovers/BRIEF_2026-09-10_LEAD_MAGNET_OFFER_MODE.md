# BUILD BRIEF — the lead-magnet offer mode, and the next step it hands to (2026-09-10)

**Status: BRIEF ONLY. Nothing built. Held for Arfeen's go-ahead.**
Authority: `docs/lead-magnet-research/LEAD_MAGNET_STANDARD.md` (saved 2026-09-10, verbatim).
Evidence behind every claim here was measured on 2026-09-10 and is summarised in §8.

---

## 0. What this package closes

A lead-magnet campaign resolves to free-event mode (`resolveOfferMode`, `campaignFraming.ts:92-101`),
so its offer is written by a prompt built for a live session. The cascade then hands that offer —
its call to action and a `[INSERT_OFFER_LINK]` token included — to every downstream node, and the
magnet's own next step copies it. Measured today on kit 225's real inputs: **4 of 4 offers came out
as a live session or masterclass**, with or without a service name, and **4 of 4 calls to action
carried `[INSERT_OFFER_LINK]`**.

**Arfeen's rulings (2026-09-10), which this brief implements:**
1. **The offer is the magnet itself** — not the paid programme, not the free next step.
2. **The next step's destination is the existing tier chain** (sibling campaign → operator URL →
   honest dead end). `nextStepBridge.ts:50-60` already does this; unchanged.
3. **Regenerate the live magnets 7173 and 7233 after the fix lands.** Leave kit 153.
4. **Email and WhatsApp get lead-magnet framing in this package**, reusing the one framing source.

## 1. 🔴 SCOPE IS WIDER THAN THE OFFER NODE — and ruling 1 is why

The magnet generator contradicts the standard on its own, independent of the offer:

| where | what it says today | the standard |
|---|---|---|
| `leadMagnetContentGenerator.ts:289` (system) | *"Close with a nextStep that bridges to the paid programme"* | *"Any output that funnels to a discovery call or a paid offer is wrong for ZAP"* |
| `:593` (lead-magnet user prompt) | *"End with a nextStep that bridges to "${programme}" … connects this free win to the paid outcome … ctaLabel (e.g. "Book My Free Call")"* | close the minor loop, open the major loop (the UMP) as a diagnostic question, then the next FREE step |
| `:649` (quiz bands) | *"its own "cta" bridging to "${programme}" … connecting their result to the paid outcome"* | same |

**Magnet 5686 is the prompt working as written** — it is live and its next step reads *"book a free
30-minute Pipeline Diagnosis call"*. And once ruling 1 makes the offer the magnet, a next step that
copies the offer's CTA points back at the magnet itself — the loop-back dead end the renderer
already refuses. **Fixing the offer without fixing the magnet's close would make regenerated 7173
and 7233 worse, not better.** So Part E is in scope.

## 2. THE BUILD — six parts

### A · The mode — `server/_core/campaignFraming.ts`
- `OfferMode` becomes `"paid" | "free_event" | "free_asset"`.
- `resolveOfferMode` order: a real supplied price → `paid` (unchanged) · **page type
  `lead_magnet_download` → `free_asset`** · explicit `__FREE__` → `free_event` · `sales_page` →
  `paid` · else `free_event`. The lead-magnet check sits BEFORE `__FREE__`, so "it's free" on a lead
  magnet stays a free asset, not a free event.
- `FREE_STEP_NOUN.lead_magnet` stays `"guide"`.

### B · The offer prompt — `server/_core/offerStandard.ts`, `server/offersGenerator.ts`
- **`FREE_ASSET_SECTION_SPEC`** — same seven keys, same shape (`OfferContent`), each field stating
  what it IS for a free asset. **Every word count must be satisfiable with true content** — the
  standard's closing finding (a count with nothing true to fill it produces invention):

  | field | is | words |
  |---|---|---|
  | offerName | the asset's own name — specific, per the naming block | ≤10 |
  | valueProposition | the one acute symptom it relieves, and how fast | 20-40 |
  | pricing | access terms: free, immediate, what arrives the moment they sign up | 15-30 |
  | bonuses | **unchanged bonus-slot tokens** — see decision P1 | — |
  | guarantee | what they keep: the asset is theirs and usable today | 20-35 |
  | urgency | the cost of the symptom continuing — the one urgency that is always true | 15-30 |
  | cta | one action: get the free asset | 10-20 |

- **`FREE_ASSET_ANGLE_PROMPTS`** — three positionings of the SAME asset: *the working tool itself*
  (godfather) · *the quick win, delivered in advance* (free) · *what the symptom costs* (dollar).
- **Mode-specific urgency and naming blocks for `free_asset` only.** The shared
  `ETHICAL_URGENCY_BLOCK` (`:97-113`) teaches seat capacity and live dates; the free-asset version
  carries only the cost of waiting. The shared `MAGIC_NAMING_BLOCK` (`:70-94`) lists "Live Q&A" and
  "Masterclass"; the free-asset version's containers are asset formats (Audit, Checklist, Template,
  Scorecard, Script, Guide, Toolkit). **`paid` and `free_event` prompts stay byte-identical** —
  pinned by test.
- `offersGenerator.ts`, `free_asset` branches for: the mode header (`:136-143`), the price and
  guarantee lines (`:79-88`), the cohort lines in the operator-fill block (a free asset states it is
  available to everyone, immediately), the Offer Type line (omitted — *"High-ticket offer…"* means
  nothing on a free download; offer 218 was generated as `premium`), the bonus-credibility line (its
  examples are *"recorded workshop, live group call"*), and the system line about price anchoring.
- **Positive framing only (§14 / §14a).** No new block carries a failure exemplar.

### C · The cascade — `server/_core/cascadeContext.ts`, `describeOffer`
A `free_asset` branch that tells downstream nodes **this offer IS the lead magnet the campaign gives
away**: its name (the angle's `offerName` — today the line uses `offer.productName`, which is the
service name, blank on 215-218) and its promise. **No CTA, no bonuses, no urgency, no "worth
attending".** This removes the channel that carried the offer's CTA and `[INSERT_OFFER_LINK]` into
magnet 7293's next step. `paid` and `free_event` branches unchanged.

### D · The title node — `server/hvcoGenerator.ts:122`
One sentence added to the `lead_magnet` context: the selected offer above describes this same asset,
and every title names the asset that keeps that promise. One asset, one thread. **Residual, stated:**
the selected title and the offer's `offerName` can still differ in wording; the magnet's public
name is its selected title.

### E · The magnet's close — `server/leadMagnetContentGenerator.ts` + `server/leadMagnetPublisher.ts`
- **The loop-splice close replaces the paid bridge**, in the system prompt (`:289`), the lead-magnet
  user prompt (`:593`) and the quiz bands (`:649`): close the minor loop, then open the major loop —
  the structural cause the reader had not considered (**the UMP**, which the mechanism description
  leads with: `heroMechanismsGenerator.ts:252`), written as a diagnostic question — then the next
  free step. The context line *"Paid programme name (what nextStep bridges to)"* (`:271`) keeps the
  programme as context only.
- **🔑 THE COPY IS CHOSEN AT PUBLISH, BECAUSE THAT IS WHEN THE DESTINATION IS KNOWN.** The magnet is
  written at cascade step 3; its free-event page is built at step 6, only when the coach gave all
  three event facts, and it may be taken down later (page 240). Copy that promises a session is
  true only when the bridge resolves `linked`. So the body carries two closes:
  - `nextStep` — **always**: opens the loop and names no destination. Its `ctaLabel` is something
    the reader can do on their own. This is what renders on `target-unpublished` and `no-pointer`.
    **Wording shape is decision P2.**
  - `nextStepLinked` — **only when the campaign has all three event facts**: the same loop, plus the
    free live session where the method (the UMS) is taught, dated from the coach's own facts.
  - `publishLeadMagnet` passes `nextStepLinked` only when the bridge is `linked`; otherwise `nextStep`.
    **Destinations are untouched** — ruling 2. `assetBody` is JSON, so no migration.
  - The page-side liveness check (`23587bf`) gains the matching swap: when it demotes the button, it
    also swaps in the no-destination close embedded in the page. It still only removes a claim.
- **Bonus mode is unchanged** — a bonus is post-purchase and legitimately points inside the programme.
- The 80/20 bar stays; per the standard the 20% is the root-cause frame that names the UMP.

### F · Email and WhatsApp — `server/emailSequenceGenerator.ts`, `server/whatsappSequenceGenerator.ts:901`
Both maps carry webinar / challenge / course_launch / product_launch only, and fall back to
**course_launch** — *"Enrolment deadline. Cohort size is limited… Enrol now"* — on every lead-magnet
campaign. The fallback becomes `lpFramingForCampaign(campaignType)` (the one framing source,
`campaignFraming.ts:220`). **The same edit covers `lead_magnet`, `discovery_call` and
`in_person_event`**, so all three are in. The four existing keys are untouched. Noted: the LP framing
text refers to "the page"; the framing, urgency and CTA lines are what carry.

## 3. WHAT THIS DOES NOT TOUCH

The `paid` and `free_event` modes (byte-identical, pinned) · the free-next-step page design and the
tier chain · the publish gates (`1def3b9`) · the offer node's bonus-slot mechanism (P1) · the magnet's
bonus mode · the name-ladder truncation (recorded separately, §7) · the headline, ad-copy and LP
framing maps, which are already correct for a lead magnet.

## 4. TESTS

1. `resolveOfferMode`: `lead_magnet` → `free_asset`, including with `__FREE__`; a real price → `paid`;
   the other six types unchanged. **`pipeline-fixes.test.ts:4108-4141` changes deliberately** — its
   "every type is free_event or paid" assertion widens to three.
2. **Byte-identity pins** — the assembled `paid` and `free_event` prompt blocks equal their
   pre-change strings. Proves no collateral.
3. **Prompt-content check** (a test-fixture surface, §14a): the assembled `free_asset` prompt contains
   none of the session vocabulary (attend, room, seat, live session, masterclass, register, replay).
   **Negative control:** the same check on the `free_event` prompt must find them.
4. `describeOffer` in `free_asset`: carries `offerName` and the promise; no CTA, no "worth attending",
   no `[INSERT_*]`.
5. Magnet prompt: the lead-magnet and quiz branches carry no paid or call bridge; the `nextStepLinked`
   request appears only with all three facts; the bonus branch is byte-identical.
6. Publisher: `linked` → `nextStepLinked`; `target-unpublished` / `no-pointer` → `nextStep`; a body with
   no `nextStepLinked` behaves exactly as today. Liveness swap: the demoted card carries the
   no-destination close.
7. Email/WhatsApp: the three missing types resolve to the LP framing; the four existing keys unchanged.
8. **Acceptance measurement on production inputs, no writes** — the 2026-09-10 harness. Kit 225 offer
   ×4 against today's baseline (4/4 event-framed, 14-21 event terms, 0-1 guide terms, 4/4 with
   `[INSERT_OFFER_LINK]`); magnet close ×2 for kit 225 (no facts) and ×2 for kit 223 (facts). Report
   computed counts with the term list published (script-rule-spec rule 7). **The guide-term count is
   the positive artefact** — zero event terms beside zero guide terms is not a pass (§15k).
9. Gates: `tsc` 34; `pipeline-fixes` (count stated with its deliberate changes); token-gate 15;
   liveness 10+; bridge and bounds suites.

## 5. VERIFICATION ON PRODUCTION

- **Deploy markers** counted in the old and the new build, at least one that must disappear (§15h).
- **The 83-URL diff**, baseline measured immediately before the push (§15f).
- **The token-gate proof — approved as designed.** On the production container, with the
  Cloudflare and Cloudinary credentials removed from that one process:
  `publishLeadMagnet({ hvcoId: 7293 })` must return `held` with `[INSERT_OFFER_LINK]` and log
  `HELD hvco 7293`; then `publishDeliverableBody` with 7293's body and a scratch slug must return
  `held`. A broken gate would attempt a write, fail for want of credentials, and return an error —
  distinguishable from `held`. **Afterwards:** both 7293 URLs 404, the row unchanged (URLs NULL,
  `updatedAt` 2026-09-10 15:52:34), the PDF 404.

## 6. BLAST RADIUS

- **Code:** the offer mode is consumed only in `offersGenerator.ts`, `offerStandard.ts` and
  `cascadeContext.ts`; the type checker forces every branch. One test file pins the two-way mode.
- **Data:** nothing regenerates by itself; stored rows keep their text. Seven lead-magnet kits exist.
  The event-framed ones are all user 1's test kits (177, 222-225). Kit 153 (user 1613) is paid-shaped
  from June and is left alone; kit 157 (user 107432) has no offer. **No customer kit carries the
  event defect.**
- **Live surfaces:** three magnets are public — 5686 (kit 177), 7173 (kit 222), 7233 (kit 223). None
  is touched by the deploy itself; the new close reaches them only when they are regenerated.

## 7. DECISIONS

**Product — Arfeen's:**
- **P1 · Bonuses on a lead-magnet offer.** Every campaign generates a three-bonus stack that fills
  the offer's bonus slots. The standard warns that breadth dilutes and names over-generosity as a
  dead-end trap. Keep the slots in this package (no change) and decide separately, or drop them for
  `free_asset` now? **Recommend: keep, and decide separately** — the stack also feeds the LP and email.
- **P2 · The no-destination close.** When there is no live free session, the close opens the loop
  (the root cause as a diagnostic question) and ends on something the reader can do alone, naming no
  destination. **Recommend approving that shape** — anything that names a session that does not
  exist is invention.
- **P3 · Add magnet 5686 to the regeneration list.** It is live, public, and funnels to a discovery
  call — exactly what the standard rules out. Not on the list only because it was not event-framed.
  **Recommend: add it.**

**Technical — CC's, stated so they are visible:** the mode name `free_asset` · the resolver order ·
the two-close design chosen at publish · the `describeOffer` wording · reusing the LP framing for
email and WhatsApp · the test set and the acceptance measurement.

**Recorded, not folded in:**
- The name ladder's tier-2 cut leaves a trailing conjunction — *"Coaching for Women who paused
  professional careers to raise a family and"* (`resolveServiceName`, `routers/services.ts:101`).
- Coach-described methods carry an `ump` field that `renderMethodDetail` does not pass to the magnet.
  Generated mechanisms carry the UMP inside the description, so the new close works without it.

## 8. EVIDENCE (measured 2026-09-10)

- **Blank names:** 38 of 139 services, all predating the ladder (`nameSource` NULL); 0 of the 3 created
  since 2 September. The ladder's tiers 2 and 3 have never run on production.
- **Name makes no difference to the offer's framing:** kit 225, godfather angle, two samples blank and
  two with the ladder's name — all four a live session or masterclass; event terms 21/20 vs 14/15;
  guide terms 1/1 vs 0/1; all four CTAs carry `[INSERT_OFFER_LINK]`.
- **Every entry point of event framing into a lead-magnet run:** the resolver; the offer mode header,
  guarantee line, angle prompts and section spec; the shared naming and urgency blocks; the cascade's
  free-event fence in `describeOffer`; the email and WhatsApp course-launch fallback; and, by design,
  the free-next-step page. The headline, ad-copy, title and LP framing are already correct.

## 9. SHAPE OF THE WORK

One push, three code commits, each independently revertable: **(1)** A-D, the mode, prompt, cascade
and title line · **(2)** E, the magnet's close · **(3)** F, email and WhatsApp. The standard, this
brief and the checkpoint go in with them. Then the §5 verification. **Then regeneration of 7173,
7233 (and 5686 if P3) — production writes, held for an explicit go-ahead at that moment.**
