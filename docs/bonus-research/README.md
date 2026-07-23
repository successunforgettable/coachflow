# Bonus generation — source-of-truth + settled build spec

This directory is the source-of-truth for the **bonus generation** build (forward-sequence step 2; the
A11 / offer-token "Class A" work). The six NotebookLM research reports are **in the repo** (below), and the
three product decisions are **settled** (below). Build proceeds to the settled spec.

## The six research reports (present, read in full 2026-07-23)
Stored under their original NotebookLM titles (not the idealized `01-…` filenames the old README listed):

1. **Taxonomy** — `The Taxonomy of High-Value Incentives_ A Strategic Report on High-Converting Bonus Architecture.md`
2. **ICP-derivation** — `The Strategic Architecture of High-Value Incentives_ A Decision Framework for Bonus Derivation.md`
3. **Coherence / number** — `Strategic Architecture of the Bonus Stack_ Coherence, Value, and Quantity.md`
4. **Honest value-framing** — `Strategic Report_ Honest Value Framing and the Architecture of High-Trust Bonuses.md`
5. **Deliverable format / quality** — `The Architecture of Premium Digital Bonuses_ Strategic Format and Quality Conventions.md`
6. **Failure modes** — `Bonus Failure Modes & Design Architecture Checklist_ A $100M Offers Strategic Report.md`

(The stray byte-identical duplicate `…Bonus Derivation (1).md` was deleted 2026-07-23.)

## Reference-truth caveat (mirrors §15a)
These sources carry **known guru value-inflation** that is INCOMPATIBLE with ZAP's no-fabrication rule and must
be stripped: fabricated MSRP "valued at $X" stacking, Goldilocks $20k/$9,997 tiers, RPM/"= 165,000 views" math,
invented "cost of inaction $50k" figures, and invented "Value Proof" case studies. Report #4 (honest framing)
**explicitly refutes** #1/#2/#5 on this — ZAP sides with #4. Guarantees, cohort caps, and durations are
**Class-C facts** (coach-supplied or reframed-when-absent), NOT bonuses, and stay OUT of the bonus generator.

## SETTLED build spec (Arfeen's decisions — build to this)
- **Generate 3 bonuses, one per type:**
  - **Accelerator** — collapses Time Delay: a quick-win checklist/protocol for a first result in ≤7 days.
  - **Gap-Filler** — resolves a missing prerequisite / logistical friction the ICP lacks.
  - **Objection-Crusher** — dissolves the ICP's **top-ranked buying objection**; ALWAYS the DFY-asset form
    (script bank / template), **NEVER a promised live session**.
- **Full deliverable:** each bonus is a **real hosted PDF** via the existing lead-magnet pipeline
  (`generateLeadMagnetContent` → `renderDeliverableHtml` → publish/PDF core). Not name-only.
- **Derivation:** Problem-Solution Mapping from the ICP — the core offer creates secondary problems; each bonus
  dissolves one. Input = the existing long ICP (pains, frustrations, objections), mirroring how
  `hvcoGenerator` derives lead-magnet titles.
- **Value framing:** outcome / time-saved / problem-solved. Value line **OPTIONAL** — default **no figure**;
  render a £ value ONLY if the coach supplies a real one. **Never emit any currency or ROI figure not
  coach-supplied.** No invented case studies, no "cost of inaction" numbers, no MSRP stacking.
- **Class-C facts** (guarantee / duration / cohort): **reframe when absent, never fabricate, never add to
  intake** — port the reframe-fallback the email/WhatsApp generators already use. Guarantees stay OUT entirely.
- **Format:** implementation-heavy only (checklist / fill-in template / swipe file / script bank / SOP / 1-page
  cheat sheet). Never a guide, info-dump, or video-course. Inherit the lead-magnet renderer's craft
  (≤2 fonts, 2–3 colours, whitespace). **Niche-specific to the ICP, never generic.**
- **Hard exclusions:** **Community** and **Third-Party/OPM** bonus types — ZAP cannot fulfill them; generating
  them fabricates a deliverable.
- **Guardrails (failure modes):** every bonus derives from a specific ICP obstacle · implementation-heavy ·
  subordinate to the core offer (never overshadow / no second offer in disguise) · niche-specific ·
  zero-marginal-cost DFY only.

## Settled mechanism decisions (no further input needed)
- Pass the already-selected **offer / method / lead-magnet** as cascade context so bonuses are **distinct by
  construction** (no duplication of the lead magnet).
- **Auto-pick the top-ranked ICP objection** for the Objection-Crusher.
- Defer "bonuses as their own reviewable wizard node" to **step 3 (Problem B)** so it inherits that review
  surface rather than building a second one. Bonuses generate silently for now.

## Where it plugs in (the A11 offer-token context — three classes)
- **Class A — bonuses:** generate as real deliverables (this spec); fill the offer's `[INSERT_BONUS_N_NAME]` /
  `[INSERT_BONUS_N_VALUE]` slots (value stripped when no coach figure).
- **Class B — resolve from existing data:** `HOST_NAME` (coach name), `OFFER_LINK` (`users.checkout_url`),
  `BOOKING_URL` (`users.booking_url`) — extend the offer facts-wire to resolve these.
- **Class C — real facts:** `GUARANTEE_TERMS`, `PROGRAMME_DURATION`, `COHORT_LIMIT`, `COHORT_CLOSE_DATE`,
  `PROGRAMME_START_DATE`, `FIRST_RESULT_TIMEFRAME`, `BONUS_VALUE` — port the reframe-when-absent pattern the
  email/WhatsApp generators already use (the offer generator is the only one emitting these raw).

Full read + independent analysis: handover `docs/handovers/ZAP_Handover_July23_2026.md` and the step-2 proposal.
