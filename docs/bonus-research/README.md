# Bonus generation — source-of-truth + filtered build spec (banked 2026-07-22)

This directory is the source-of-truth for the **bonus generation** build (the A11 / offer-token "Class A"
work). It is **parked** — it runs as its own future session after Arfeen's three product decisions.

## The six NotebookLM research reports — NOT YET IN THE REPO (place here)
Six NotebookLM reports are the research foundation. They are **not in the working tree yet**; Arfeen must add
them here as git-lfs `.md` files (mirroring `docs/landing-page-references/`), one per topic:

1. `01-taxonomy.md` — bonus taxonomy (Accelerator / Gap-Filler / Objection-Crusher / …)
2. `02-icp-derivation.md` — deriving bonuses from the ICP via Problem-Solution Mapping
3. `03-coherence-and-number.md` — how many bonuses, coherence across the stack
4. `04-honest-value-framing.md` — value framing WITHOUT fabricated currency
5. `05-deliverable-format.md` — implementation-asset formats (checklist / template / script / SOP)
6. `06-failure-modes.md` — bonus failure modes to avoid

Track them with git-lfs (add `*.md` under this dir to `.gitattributes` if large, or store as normal `.md`).
CC reads these as source-of-truth when the bonus run starts.

## Filtered build spec (guru value-inflation removed, structural mechanics kept)
- **Generate 3 bonuses** — one **Accelerator** (speeds the core result) + one **Gap-Filler** (covers a
  prerequisite the ICP lacks) + one **Objection-Crusher** (dissolves the top buying objection). Arfeen chose
  this varied stack over 3-of-a-kind.
- **Derive each via Problem-Solution Mapping from the ICP** — not generic; map to a real ICP pain/objection.
- **Each is a real implementation asset** — a checklist, template, script, or SOP the coach can hand over.
  **Never an info-dump / "ultimate guide" filler.**
- **Honest framing** — describe each by its **outcome / time saved / problem solved**. **NEVER fabricate a £
  value.** Default the value line to **"included free"**; show a £ figure **only if the coach supplies it**
  (same anti-fabrication rule as the offer price/guarantee tokens).
- **Rendered to premium craft via the existing lead-magnet pipeline** —
  `leadMagnetContentGenerator` → `leadMagnetRenderer` → `leadMagnetPublisher` already produces real hosted PDF
  deliverables (`storagePut` → hosted URL, persists `magnetHtmlUrl`/`magnetPdfUrl`). Bonuses **ride this
  pipeline** — moderate reuse, not net-new. Net-new = a bonus-concepts generator (3 concepts from the ICP,
  like `hvcoGenerator`'s titles) + a bonuses store wired into the offer's `[INSERT_BONUS_N_NAME]` slots.

## Three product decisions PENDING from Arfeen (before this run starts)
1. **Confirm generate-3** (Accelerator + Gap-Filler + Objection-Crusher).
2. **Value-line handling** — "included free" default vs require a £ value.
3. **Class-C facts** (guarantee / duration / cohort dates) — reframe-when-absent (matches email/WhatsApp
   generators) vs ask in the facts step.

## The A11 offer-token context (three classes — see the July-22 handover)
- **Class A — bonuses:** generate/import as real deliverables (this spec). `service.bonuses` import field exists.
- **Class B — resolve from existing data:** `HOST_NAME` (coach name), `OFFER_LINK` (`users.checkout_url`),
  `BOOKING_URL` (`users.booking_url`) — extend the offer facts-wire to resolve these.
- **Class C — real facts:** `GUARANTEE_TERMS`, `PROGRAMME_DURATION`, `COHORT_LIMIT`, `COHORT_CLOSE_DATE`,
  `PROGRAMME_START_DATE`, `FIRST_RESULT_TIMEFRAME`, `BONUS_VALUE` — port the reframe-when-absent pattern the
  email/WhatsApp generators already use (the offer generator is the only one emitting these raw).
