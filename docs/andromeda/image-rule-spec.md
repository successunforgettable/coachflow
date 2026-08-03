# The Per-Angle Image Rule

**STATUS: FINAL — UNCOMMITTED.** Awaiting Claude's last faithfulness pass, then Arfeen's approval,
before it is committed. No code implements any of it.

**What this is.** The rule that decides what an ad's *picture* should be, from the concept's angle —
the visual counterpart to how the hook research became the hook engine. It is a faithful extraction
from the 7 image-research reports in `docs/andromeda/image-research/`, plus an explicitly recorded set
of human decisions where the research was silent, self-contradictory, or incompatible with what this
codebase can safely render.

**Method.** Every substantive claim carries a citation to the document and section it came from.
Where the research does not decide something, this document says so rather than filling the gap.
Cells reasoned from row+column rather than read directly are marked **[derived from row+column]**.
Every human decision is recorded in §1 with its decider and its reasoning — none is a silent pick.
Where a decision **departs from** the research rather than resolving an ambiguity in it, that is
labelled as a departure, not dressed up as a resolution.

---

## 0. Source key

| Code | Document |
|---|---|
| `[MATRIX]` | *The Angle-to-Image Strategic Matrix…* |
| `[SCHWARTZ]` | *Eugene Schwartz Awareness-Stage Static Image Strategy…* (internal title: *Awareness Mapping Strategy Report*) |
| `[ARCHETYPE]` | *Visual Archetype Strategy…* (internal title: *Strategic Report: Image Archetypes Across the B2C Transformation Spectrum*) |
| `[ENTITY]` | *Meta Andromeda Entity ID & Visual Diversity Protocol…* |
| `[GUARD]` | *Meta Ad Image Compliance Guardrails 2026…* (internal title: *Definitive 2026 Meta Ad Image Compliance Report*) |
| `[COHERENCE]` | *Image-and-Copy Coherence: The Matched-Pair Principle…* |
| `[TECH]` | *Meta Ad Image Technical Specifications & Rendering Guide (2026 Edition)* |

⚠️ Three files carry an internal title differing from their filename; per CLAUDE.md §15a these were
judged by content, not by either label. Noted in `docs/andromeda/image-research/README.md`.

### Naming note

`[MATRIX] §2`'s table labels the third column **"Lifestyle"**; `[MATRIX] §3` calls it **"Aspirational
/ Lifestyle"**; `[ARCHETYPE] §4` calls it **"Aspirational & Lifestyle"**. One sub-type. This document
uses **Aspirational**.

`[ARCHETYPE] §5`'s table labels the first column **"Professional"**; §2 calls it **"Grounded &
Professional"**; `[SCHWARTZ] §4` calls it **"Grounded/Clinical"**. One sub-type. This document uses
**Grounded**.

---

## 1. Decisions of record

Everything in this section is a **human decision**, not an extraction.

### 1.1 The governing principles

**Principle 1 — for conflicts between a cell's row and its column:**

> **Awareness governs WHAT is depicted; archetype governs HOW it is styled.**

**Decided by:** Arfeen's strategic partner, 2026-08-04.
**Reasoning of record:** awareness reasons from the prospect's mental state — the deeper layer —
while archetype reasons from the seller's aesthetic — the surface layer. A picture aimed at the wrong
mental state fails regardless of styling; a picture aimed at the right mental state in imperfect
styling still lands. The deeper layer wins on subject matter; the surface layer retains full authority
over rendering.

**Scope limit.** This adjudicates conflicts *within a cell*, between the row's purpose and the
column's aesthetic. It does **not** adjudicate conflicts about *which column a profession belongs to*,
because such conflicts have no awareness axis to reason from. This is why R3 remains open — §7.3.

**Principle 2 — the no-in-image-text constraint:**

> **A generated image must not depend on baked-in text to do its job. Offer specifics live in the
> controllable headline overlay, never in the generated pixels.**

**Decided by:** Arfeen's strategic partner, 2026-08-04.
**Reasoning of record:** this is not a preference but a hard capability limit of this codebase,
established by measurement. Prompt-based in-image text suppression **failed three times** on this
project, at 46 clean / 2 leaked across 48 renders (~12% leak rate, exact 95% upper bound), which is
what retired the object slot and cut the tabloid deck from 5 to 4 (`5f3294d`). Any cell whose
prescribed visual is *composed of* text and numbers reintroduces a failure this project already paid
to solve. Governs **PD-4**.

### 1.2 Product decisions

| # | Decision | Decided by | Reasoning of record |
|---|---|---|---|
| **PD-1** | **Fitness coaches / personal trainers default to Grounded.** | Arfeen's strategic partner, 2026-08-04 | Meta health-scrutiny safety. `[GUARD §4]` treats health and weight as a high-scrutiny zone where distress framing and body-flaw framing trigger Entity ID suppression; fitness sits squarely inside it. Account-level suppression outweighs the warmer imagery Aspirational would produce. Settles the primary question in R3 — but not its residue; see §7.3. |
| **PD-2** | **Ambiguous sub-type detection defaults to Grounded, and the low-confidence state is stored explicitly.** | Arfeen's strategic partner, 2026-08-04 | Grounded produces the most compliance-conservative imagery (`[GUARD §4]`'s compliant substitute is clinical lighting). Storing low confidence rather than silently absorbing it keeps ambiguous cases visible, and is what gives PD-3's correction affordance something to act on. |
| **PD-3** | **Detection is shown and changeable.** The system auto-detects the sub-type, surfaces it to the coach, and lets them correct it. Auto-detect remains the default; it is not silent and not unchangeable. | **Arfeen**, 2026-08-04 | `[ARCHETYPE §1]` establishes that a wrong archetype causes branch-cutting into the wrong retrieval tree and "catastrophic conversion failure"; `[ARCHETYPE §3]` warns of *permanent* Entity ID suppression for the esoteric mismatch. Given that cost, and given §5.3's real and unresolvable ambiguity, the coach — who knows their own positioning — is the cheapest available correction. Auto-detect stays default so the flow is not gated on a question most coaches will not need to answer. |
| **PD-4** | **At Most-Aware, all three sub-types depict a founder/practitioner direct-to-camera human still — NOT the product, pricing, checkout or portal visual.** Offer specifics move to the headline overlay. No required in-image text. | Arfeen's strategic partner, 2026-08-04 | Two reasons, the second decisive. **(a)** A human direct-address moment is stronger ad creative than a static checkout or pricing screenshot, which reads as a banner rather than a scroll-stopping ad. **(b)** Decisively: a clean pricing/checkout visual is *composed of* text and numbers — exactly the uncontrolled in-image text that failed three times and retired the object slot (Principle 2). A founder still requires no baked-in text; the offer specifics live in the controllable overlay. The founder-still is therefore both the better creative **and** the only version compatible with what this image pipeline can safely render. ⚠️ **This is a departure from the research, not a resolution of a conflict in it — see §7.4.** |

**PD-3 is a build requirement, not only a policy.** It obliges the record to store the detected
sub-type, its confidence, and whether the coach overrode it. Carried into §6.2.

### 1.3 Contradiction resolutions

Four conflicts found *within* the research. Each records its reasoning. A fifth (**R3**) remains open
— §7.3.

| # | Conflict | Resolution | Decided by | Reasoning of record |
|---|---|---|---|---|
| **R1** | Unaware × Grounded: `[SCHWARTZ §2.1]` forbids practitioner portraits at Unaware; `[MATRIX §3.1.1]` prescribes an Authority Portrait for high-ticket | **No practitioner/authority portrait at Unaware. Candid pattern-break, styled Grounded.** | Arfeen's strategic partner, 2026-08-04 | Principle 1. Prospect-psychology is the spine of awareness-mapping: an unaware prospect has no context in which a portrait means anything, so it cannot do the pattern-break job the stage exists for. Schwartz governs the subject; Grounded still governs styling. |
| **R2** | Solution-Aware × Aspirational: `[SCHWARTZ §2.3]` prohibits vague lifestyle shots; `[MATRIX §3.3.3]` prescribes a lifestyle "Transformation Arc" | **Method-made-visible, NOT vague lifestyle — retaining aspirational styling (bright, high-key, energising).** | Arfeen's strategic partner, 2026-08-04 | Principle 1. Solution-Aware exists to make the mechanism visible; a freedom-state lifestyle shot shows no mechanism. The row sets the subject to the method; the column keeps full control of rendering, so the method is shown bright rather than clinical. |
| **R4** | Solution-Aware × Esoteric: `[MATRIX §2]` gives "Natural Landscape"; `[MATRIX §3.3.2]` gives whiteboard / raw stone / "Sacred Space" | **Resolve to the prose version: method-as-tactile-ritual — cards, charts and craft tools on raw stone or linen. NOT natural landscape.** | Arfeen's strategic partner, 2026-08-04 | A landscape shows no method, and Solution-Aware requires the mechanism. The craft's own tools *are* the esoteric method-made-visible, satisfying both the row's demand for a visible mechanism and the column's demand for tactile, atmospheric credibility. Consistent with Principle 1 and with R2. |
| **R5** | `[GUARD §4]` lists atmospheric lighting as a prohibited distress trigger; `[ARCHETYPE §3]` mandates it for Esoteric | **No adjudication required — the research self-resolves.** `[GUARD §6]`: atmospheric lighting permitted **only when paired with "Personal Reflection" copy.** | — (research-resolved; recorded, not decided) | Recording rather than deciding, because `[GUARD §6]` already states the conditional. Carried verbatim into §3.2. |

---

## 2. The 5×3 matrix — all 15 cells

Rows = the five awareness stages. Columns = the three seller sub-types.

**Sourcing.** Every cell's depicted subject, environment, emotional register, offer-dependent branch
and compliance note is stated directly in `[MATRIX]` — twice, in the §2 table and again in the §3
prose breakdown. Styling and lighting come from `[ARCHETYPE] §2–§5` and `[COHERENCE] §4`. **Five
cells do not state lighting explicitly in `[MATRIX] §3`**; for those the column's archetype lighting
is applied and the cell is marked **[derived from row+column]** on that attribute only.

**Marked cells:** ✅ **RESOLVED** = an intra-research conflict was adjudicated (R1, R2, R4).
🔶 **DEPARTURE** = the cell overrides a unanimous research prescription on engineering grounds (PD-4).

### Row-level objective (applies across all three columns)

| Stage | Objective | Visual approach | Register | Named pitfall |
|---|---|---|---|---|
| Unaware | Pattern Break `[SCHWARTZ §2.1]` | Relatable daily moments; organic candids `[SCHWARTZ §3]` | Curiosity `[SCHWARTZ §3]` | Explicit product mentions `[SCHWARTZ §3]`; structured solutions and practitioner portraits forbidden `[SCHWARTZ §2.1]` |
| Problem-Aware | Validation / Empathetic Mirror `[SCHWARTZ §2.2]` | Symbolic friction scenes; reflection `[SCHWARTZ §3]` | Validation `[SCHWARTZ §3]` | Pronoun traps; implied transformations `[SCHWARTZ §3]` |
| Solution-Aware | The Visible Mechanism `[SCHWARTZ §2.3]` | Labeled flowcharts; IP diagrams `[SCHWARTZ §3]` | Clarity `[SCHWARTZ §3]` | Vague lifestyle imagery `[SCHWARTZ §3]` |
| Product-Aware | The Authority Anchor `[SCHWARTZ §2.4]` | Active expert portraits; social proof `[SCHWARTZ §3]` | Credibility `[SCHWARTZ §3]` | Low-authority "lo-fi" settings `[SCHWARTZ §3]` |
| Most-Aware | The Transactional Bridge `[SCHWARTZ §2.5]` | Portal mockups; Value Stack visuals `[SCHWARTZ §3]` 🔶 **overridden by PD-4 — see §2.5** | Low-Friction `[SCHWARTZ §3]` | Educational or storytelling hooks `[SCHWARTZ §3]` |

### Column-level styling (applies across all five rows)

| Sub-type | Lighting | Backdrop / texture | Typography |
|---|---|---|---|
| **Grounded** | Soft, even, non-dramatic `[ARCHETYPE §2, §5]` | Professional office or studio; minimalist `[ARCHETYPE §2]`; welcoming yet authoritative seating `[ARCHETYPE §2]` | Clean sans-serif with high-contrast scrims `[COHERENCE §4]` |
| **Esoteric** | Low-key warm, deep shadows `[ARCHETYPE §3, §5]` — **conditional, see §3.2** | Raw stone, worn wood, dark linen `[ARCHETYPE §3, §5]` | Warm intimate serifs or hand-written scripts `[COHERENCE §4]` |
| **Aspirational** | Bright, high-key natural daylight `[ARCHETYPE §4, §5]` | Open residential/outdoor, uncluttered, light-filled `[ARCHETYPE §4]` | High-energy modern fonts; high-contrast `[COHERENCE §4]` |

---

### 2.1 UNAWARE

#### Unaware × Grounded — "Clinical Authority" ✅ RESOLVED (R1)
- **Depicted:** A **candid, relatable pattern-break moment** — organic, native-looking, unposed
  `[SCHWARTZ §2.1]`. **NOT a practitioner or authority portrait** `[SCHWARTZ §2.1]`; see §1.3 R1
- **Styling:** Grounded styling retained in full — 4:5 portrait format; soft even studio lighting;
  neutral palette; professional but approachable `[MATRIX §3.1.1]`, `[ARCHETYPE §2]`
- **Register:** Safety / Stability `[MATRIX §2]`
- **Branch:** If low-ticket/membership → minimalist typography card with a direct statement
  `[MATRIX §3.1.1]` — ⚠️ **retained by the research but constrained by Principle 2**: a typography
  card is composed of text, so it is subject to the same in-image-text limit as PD-4. Treat as
  overlay-rendered, not generated. If medical → credential overlays `[MATRIX §2]`, applied as overlay.
  ⚠️ **The high-ticket → Authority Portrait branch is struck by R1.**
- **Compliance:** Avoid assertive "you" diagnosis `[MATRIX §2]`; avoid "You" pronoun traps — focus on
  "the community" or "the research" `[MATRIX §3.1.1]`
- **Diversity:** Vary office backgrounds to hold <40% similarity `[MATRIX §3.1.1]`

#### Unaware × Esoteric — "Symbolic Imagery"
- **Depicted:** Close-ups of tactile objects — worn wood, crystals; atmospheric space `[MATRIX §2; §3.1.2]`
- **Styling:** Low-key warm lighting; deep shadows `[MATRIX §3.1.2]` — conditional per §3.2
- **Register:** Sacred Reflection `[MATRIX §2]`
- **Branch:** If selling a tool (deck/crystals) → focus on the object. If a reading → focus on
  atmospheric space `[MATRIX §3.1.2]`. If tactile → physical tools, linen/stone `[MATRIX §2]`
- **Compliance:** Avoid "healing" guarantees `[MATRIX §2]`; avoid dramatic "energy" illustrations —
  keep visuals grounded in physical tools `[MATRIX §3.1.2]`

#### Unaware × Aspirational — "Candid Moment"
- **Depicted:** Candid, unpolished, mobile-native frame; natural outdoor or residential `[MATRIX §2; §3.1.3]`
- **Styling:** Bright natural residential light; warm tones `[MATRIX §3.1.3]`
- **Register:** Hope / Curiosity `[MATRIX §2]`
- **Branch:** If coaching → practitioner mid-movement or mid-laugh. If digital product → an "at-home"
  usage shot `[MATRIX §3.1.3]`. If high-ticket → mobile-native unpolished shots `[MATRIX §2]`
- **Compliance:** Avoid "idealized" silhouettes `[MATRIX §2]`
- **Diversity:** Alternate talent, and outdoor vs indoor natural settings `[MATRIX §3.1.3]`

### 2.2 PROBLEM-AWARE

#### Problem-Aware × Grounded — "Labeled Framework"
- **Depicted:** Labeled "Friction Points" diagram; clean workspace `[MATRIX §2; §3.2.1]`
- **Styling:** High-contrast layout; professional sans-serif fonts `[MATRIX §3.2.1]`. **Lighting: soft,
  even, non-dramatic — [derived from row+column]**, applying `[ARCHETYPE §2, §5]`; `[MATRIX §3.2.1]`
  does not state lighting
- **Register:** Validated Relief `[MATRIX §2]`
- **Branch:** If health → a "Biomarker Matrix". If finance → a "Budget Leak" chart `[MATRIX §3.2.1]`.
  If digital course → a scientific "naming of pain" chart `[MATRIX §2]`
- **⚠️ Principle 2 note:** labeled diagrams and charts carry embedded text by nature. This cell is the
  clearest case where the research's prescription and the pipeline's capability are in tension. **Not
  resolved by PD-4, which covers Most-Aware only.** Flagged as **Gap G10, §9.**
- **Compliance:** No pain-state graphic depictions `[MATRIX §2]`; models must be in reflection, not
  extreme distress `[MATRIX §3.2.1]`

#### Problem-Aware × Esoteric — "Organic Texture"
- **Depicted:** Subject in quiet, low-lit reflection; organic textures, natural hues; low-key interior
  `[MATRIX §2; §3.2.2]`
- **Styling:** Low-lit; natural hues `[MATRIX §3.2.2]` — conditional per §3.2
- **Register:** Quiet Reflection `[MATRIX §2]`
- **Branch:** If somatic → a "Body Mapping" graphic. If tarot → a "Shadow Work" spread
  `[MATRIX §3.2.2]`. If spiritual → focus on the "internal" landscape `[MATRIX §2]`
- **Compliance:** Avoid attributing pain to "curses" `[MATRIX §2]`; avoid supernatural terminology in
  both copy and audio layers `[MATRIX §3.2.2]`

#### Problem-Aware × Aspirational — "Empathetic Capture"
- **Depicted:** A scene of "daily struggle" — e.g. a cluttered workspace; residential space
  `[MATRIX §2; §3.2.3]`
- **Styling:** Warm residential aesthetic; unpolished `[MATRIX §3.2.3]`
- **Register:** Personal Alignment `[MATRIX §2]`
- **Branch:** If parenting → the "chaos" moment. If fitness → the "low energy" moment
  `[MATRIX §3.2.3]` ⚠️ **the fitness branch is affected by PD-1 — see §7.3 (R3, OPEN)**
- **Compliance:** Avoid unrealistic distress levels `[MATRIX §2]`
- **Diversity:** Change talent and environment variables to prevent Entity ID collapse `[MATRIX §3.2.3]`

### 2.3 SOLUTION-AWARE

#### Solution-Aware × Grounded — "Method Made Visible"
- **Depicted:** Clinical flowcharts or "Gut-Brain Pathway Architecture" models; professional studio
  `[MATRIX §2; §3.3.1]`
- **Styling:** **Lighting: soft, even, non-dramatic — [derived from row+column]**, applying
  `[ARCHETYPE §2, §5]`; `[MATRIX §3.3.1]` does not state lighting
- **Register:** Intellectual Clarity `[MATRIX §2]`
- **Branch:** If technical service → a step-by-step flowchart. If consulting → a "3-Tier Scalability"
  diagram `[MATRIX §3.3.1]`
- **⚠️ Principle 2 note:** as with Problem-Aware × Grounded, labeled flowcharts are text-bearing by
  nature. **Gap G10, §9.**
- **Compliance:** Must have verifiable mechanism data `[MATRIX §2]`; claims must avoid "diagnosing" or
  "curing" `[MATRIX §3.3.1]`

#### Solution-Aware × Esoteric — "Conceptual Model" ✅ RESOLVED (R4)
- **Depicted:** **Method-as-tactile-ritual** — the craft's own tools arranged as the visible
  mechanism: card spreads, charts, hand-drawn conceptual models on physical whiteboards, raw stone or
  wood `[MATRIX §3.3.2]`. **NOT "Natural Landscape"** `[MATRIX §2]`; see §1.3 R4
- **Styling:** **Lighting: low-key warm, deep shadows — [derived from row+column]**, applying
  `[ARCHETYPE §3, §5]`; `[MATRIX §3.3.2]` does not state lighting. Conditional per §3.2
- **Register:** Spiritual Wisdom `[MATRIX §2]`
- **Branch:** If high-ticket mentorship → a "Sacred Space" visual. If course-based → a hand-drawn
  diagram `[MATRIX §3.3.2]`. If manifestation → hand-drawn esoteric diagrams `[MATRIX §2]`
- **Note:** R4's tactile-ritual reading is comparatively favourable under Principle 2 — physical
  cards, tools and textures are objects rather than text, unlike the Grounded column's flowcharts
- **Compliance:** Avoid promised material gains `[MATRIX §2]`; avoid guaranteed material outcomes
  (wealth/health) via spiritual means `[MATRIX §3.3.2]`

#### Solution-Aware × Aspirational — "Transformation Arc" ✅ RESOLVED (R2)
- **Depicted:** **The method made visible** — a labeled framework, habit system or blueprint
  `[SCHWARTZ §2.3]`. **NOT a vague freedom-state lifestyle shot** `[SCHWARTZ §2.3, §3]`; see §1.3 R2.
  The matrix's own branches already supply method-shaped visuals — "The Habit Stack" and "The Freedom
  Blueprint" are frameworks, not lifestyle scenes `[MATRIX §3.3.3]`
- **Styling:** **Aspirational styling retained in full** — high-key studio or bright outdoors, bright
  and energising `[MATRIX §3.3.3]`, `[ARCHETYPE §4]`. The framework renders bright, not clinical
- **Register:** Aspirational Hope `[MATRIX §2]`
- **Branch:** If fitness → "The Habit Stack" ⚠️ **affected by PD-1 — see §7.3 (R3, OPEN)**. If
  business → "The Freedom Blueprint" `[MATRIX §3.3.3]`. If transformation-based → the "Catalyst"
  moment `[MATRIX §2]`, rendered as the mechanism rather than its lifestyle aftermath
- **Compliance:** No time-bound weight loss claims `[MATRIX §2]`; avoid "implied transformations" such
  as a product beside an idealized silhouette `[MATRIX §3.3.3]`

### 2.4 PRODUCT-AWARE

#### Product-Aware × Grounded — "Authority Portrait"
- **Depicted:** Practitioner on a keynote stage or in a professional session `[MATRIX §2; §3.4.1]`
- **Styling:** High-contrast typography `[MATRIX §3.4.1]`. **Lighting: soft, even, non-dramatic —
  [derived from row+column]**, applying `[ARCHETYPE §2, §5]`; `[MATRIX §3.4.1]` does not state lighting
- **Register:** Professional Trust `[MATRIX §2]`
- **Branch:** If 1-on-1 coaching → the practitioner's face is mandatory. If certification → prioritise
  the credential badge `[MATRIX §3.4.1]`. If $2k+ → Keynote Stage Authority Portrait `[MATRIX §2]`
- **Compliance:** Ensure instructor credentials are clear `[MATRIX §2]`; authority must be
  demonstrable — real-world results rather than academic theories `[MATRIX §3.4.1]`

#### Product-Aware × Esoteric — "Tactile Session"
- **Depicted:** Close-ups of hands in motion during a session; intimate studio `[MATRIX §2; §3.4.2]`
- **Styling:** Intimate, low-key lighting `[MATRIX §3.4.2]` — conditional per §3.2
- **Register:** Deep Connection `[MATRIX §2]`
- **Branch:** If session-based → the tactile tools. If group-based → the "Sacred Circle" geometry
  `[MATRIX §3.4.2]`. If somatic → the practitioner's hands `[MATRIX §2]`
- **Compliance:** No "curing/treating" medical claims `[MATRIX §2]`; multimodal check — audio
  testimonials must not mention medical cures `[MATRIX §3.4.2]`

#### Product-Aware × Aspirational — "Social Proof Overlay"
- **Depicted:** Practitioner in a bright, uncluttered, successful environment, with social proof
  overlays; active daily life `[MATRIX §2; §3.4.3]`
- **Styling:** Bright, uncluttered `[MATRIX §3.4.3]`
- **Register:** Relatable Success `[MATRIX §2]`
- **Branch:** If community-based → the member "Dashboard Wall". If results-based → the Specificity
  Amplifier `[MATRIX §3.4.3]`. If membership → community testimonials `[MATRIX §2]`
- **Note:** the social-proof *overlay* is by name an overlay element — consistent with Principle 2,
  provided the proof text is composited rather than generated
- **Compliance:** Reviews must be verified/typical `[MATRIX §2]`
- **Diversity:** Shift from studio shots to "day-in-the-life" candids to hold <40% `[MATRIX §3.4.3]`

### 2.5 MOST-AWARE — 🔶 all three cells DEPART from the research per PD-4

**The research is unanimous that Most-Aware should be transactional** — `[SCHWARTZ §2.5]` "high-fidelity
mockups of the program portal, booking interfaces, or physical workbooks"; `[SCHWARTZ §3]` "Portal
mockups; Value Stack visuals"; `[COHERENCE §2]` "Direct transactional visuals; Program Portal Mockups
or Booking Interfaces"; `[MATRIX §2, §3.5]` Digital Portal / Booking Interface / Value Stack Visual.
**PD-4 overrides all four.** Reasoning at §1.2 and §7.4. The transactional *signal* is not lost — it
moves to the overlay, where it can be controlled.

**Applies to all three cells below:** depiction is a founder/practitioner direct-to-camera human
still. Offer specifics — pricing, deliverables, booking, refund terms — are **overlay only**. **No
required in-image text.** Column styling is retained in full.

#### Most-Aware × Grounded — founder direct-address 🔶 DEPARTURE (PD-4)
- **Depicted:** Practitioner direct-to-camera. **NOT** the portal/dashboard mockup or workbook stack
  `[MATRIX §2; §3.5.1]`, `[SCHWARTZ §2.5]` — overridden by PD-4
- **Styling:** **Lighting: soft, even, non-dramatic — [derived from row+column]**, applying
  `[ARCHETYPE §2, §5]`; `[MATRIX §3.5.1]` does not state lighting. Professional office or studio
  backdrop `[ARCHETYPE §2]`
- **Register:** Transactional Ease `[MATRIX §2]` — carried by the overlay and the direct address
- **Branch:** membership / physical-book / SaaS branches `[MATRIX §3.5.1]` become **overlay content**,
  not alternative generated subjects
- **Compliance:** Clear pricing/refund policy `[MATRIX §2]` and "Special Category" designations for
  financial or weight-management offers `[MATRIX §3.5.1]` — **now overlay obligations.** PD-4 moves
  where they are rendered, not whether they are required

#### Most-Aware × Esoteric — founder direct-address 🔶 DEPARTURE (PD-4)
- **Depicted:** Practitioner direct-to-camera. **NOT** the booking-calendar snapshot `[MATRIX §2; §3.5.2]`
- **Styling:** Low-key warm, deep shadows `[ARCHETYPE §3, §5]` — conditional per §3.2. Tactile
  textures — raw stone, worn wood, dark linen `[ARCHETYPE §3]`
- **Register:** Final Alignment `[MATRIX §2]`
- **Branch:** 1-on-1 booking and retreat "Sacred Schedule" specifics `[MATRIX §3.5.2]` → overlay
- **Note — partial research support:** `[MATRIX §4.1]`'s **Delivery Rule** already prescribes "feature
  the **Practitioner's Face**" for 1-on-1 services. For 1-on-1 offers PD-4 therefore *agrees* with the
  research rather than departing from it; the departure is real only for digital-product/SaaS offers,
  where the Delivery Rule points to the portal mockup
- **Compliance:** Clear session boundaries `[MATRIX §2]` → overlay; landing-page consistency must
  match the visual `[MATRIX §3.5.2]`

#### Most-Aware × Aspirational — founder direct-address 🔶 DEPARTURE (PD-4)
- **Depicted:** Practitioner direct-to-camera. **NOT** the value-stack checklist with price reveal
  `[MATRIX §2; §3.5.3]` — this is the cell PD-4's Principle 2 reasoning targets most directly, being
  a visual *composed of* enumerated text and a price
- **Styling:** Bright, high-key natural daylight `[ARCHETYPE §4, §5]`; bright workspace or open
  light-filled setting `[MATRIX §3.5.3]`, `[ARCHETYPE §4]`
- **Register:** Excitement `[MATRIX §2]`
- **Branch:** deliverable enumeration — "7 distinct modules + 2 bonuses" `[MATRIX §3.5.3]` → **overlay
  checklist**, not generated pixels
- **Compliance:** Avoid "risk-free income" phrasing `[MATRIX §2]`; no promised income amounts in the
  checklist `[MATRIX §3.5.3]` — **now an overlay obligation**

---

### 2.6 Cross-cutting modifiers

Apply regardless of cell; can override the cell's default subject:

1. **The Authority Rule** — B2B-leaning (consulting/corporate) → Authority Portraits (stage, office).
   B2C-leaning (coaching/spiritual) → vulnerability-based visuals (candid, residential). `[MATRIX §4.1]`
2. **The Delivery Rule** — 1-on-1 service → the practitioner's face. Digital product/SaaS → the
   method/portal mockup. `[MATRIX §4.1]`
3. **The Sophistication Shift** — in saturated markets, ignore benefits; use objection-first creative
   addressing scepticism via specific proof. `[MATRIX §4.1]`

⚠️ **No precedence order** is specified between these and the cell's own prescription. **Gap G3, §9.**

**Interactions with the decisions above:**
- **At Unaware, R1 governs** — no portrait regardless of what the Authority or Delivery Rule says, the
  awareness row being the deeper layer per Principle 1.
- **At Most-Aware, PD-4 governs** — the Delivery Rule's "portal mockup" branch for digital products is
  overridden; its "practitioner's face" branch for 1-on-1 coincides with PD-4.

---

## 3. The compliance filter — overrides the matrix

`[GUARD]` is a **do-not-depict** list. Where it conflicts with a matrix cell, it wins: it operates at
Stage 1 retrieval, before the auction. `[GUARD §1]`: "compliance is no longer a post-upload review; it
is a Stage 1 Retrieval gatekeeper… If your visual fails this filter, your auction access is revoked
before the first millisecond."

### 3.1 The five prohibition categories

| # | Category | Prohibited depiction | Compliant substitute | Source |
|---|---|---|---|---|
| 1 | Before/after & unrealistic results | Side-by-side before/after; "hiding" before-states in background layers; product beside an idealized silhouette | Creator preparing a healthy whole-food meal | `[GUARD §2]`, `[ENTITY §4]`, `[TECH §5.3]` |
| 2 | Personal-attribute implication | Isolating specific body parts (e.g. zooming on a midsection); dark, distress-focused imagery implying the user is suffering; visual "you/your" identity traps | Community Framing; "The Method Made Visible" — e.g. a high-contrast diagram of a 4-part operational system | `[GUARD §3]` |
| 3 | Health, weight, mental health | Heads in hands; dark, isolated, "atmospheric" lighting; body pinching or measuring physical "flaws"; medical/disease-specific claims in overlay | Bright "clinical" even lighting with soft shadows; ingredient-focused flat-lays and routine candid moments; labeled process models | `[GUARD §4]` |
| 4 | Finance & income claims | Private jets, luxury cars, stacks of cash, income dashboards — "lifestyle flexing" as the primary visual hook | The "Operational System" pivot: a laptop showing a structured business-model diagram, a whiteboard with a proprietary flowchart, a high-credibility professional workspace | `[GUARD §5]` |
| 5 | Spiritual & supernatural | Visual representations of "dark vs light" energy; claims of guaranteed physical healing via supernatural means | Tactile ritual: organic textures — linen, stone, wood — in flat-lays of cards or tools | `[GUARD §6]` |

### 3.2 The atmospheric-lighting condition (R5 — research-resolved)

- `[GUARD §4]` lists "dark, isolated, *atmospheric* lighting" as a **prohibited distress trigger**.
- `[ARCHETYPE §3]` **mandates** "low-key warm lighting with deep shadows" for Esoteric.

`[GUARD §6]` resolves it conditionally:

> "Use **Atmospheric Lighting** (low-key, deep shadows) **only when paired with 'Personal Reflection'
> copy.**" `[GUARD §6]`

**Rule as stated:** atmospheric lighting is permitted for the Esoteric column **only** where the
paired copy is personal-reflection framed. Where the offer sits in the health/weight/mental-health
zone, `[GUARD §4]` governs and clinical lighting overrides the archetype's atmospheric default.

**No human adjudication applied** — this is the research's own resolution, recorded per §1.3 R5.

### 3.3 Community Framing — a copy constraint that binds the image

MARS scans text, image and landing page together `[MATRIX §1.3]`, so the picture rule cannot ignore
the overlay text — and PD-4 increases the overlay's load, making this tighter, not looser.
`[GUARD §3]` / `[ENTITY §4]` / `[MATRIX §6.1]`: replace second-person personal attributes with shared
experience — "Your anxiety" → "The anxious nervous system"; "Are you struggling with *Condition*?" →
"Providing support for those seeking *Outcome*."

### 3.4 What the research does not decide here

**No precedence order among the five categories** when several apply (e.g. a spiritual practitioner
selling a wealth-manifestation offer triggers both 4 and 5), and **no definition** of which niches
count as the "health/weight/mental-health zone" triggering §3.2's override. **Gaps G4, G5, §9.**

---

## 4. The structural-diversity mechanism

### 4.1 The threshold, and why it is the render bar

`[ENTITY §1]` — Entity ID is assigned to *meaning*, via a semantic embedding of the creative's visual
DNA, not to a file hash:

- **Similarity > 60%** → vector clustering. Ads collapse into a single Entity ID with one auction
  "ticket"; result is auction suppression and inflated account-wide CPMs. `[ENTITY §1]`, `[GUARD §2]`
- **Similarity < 40%** → a unique Entity ID, letting the asset explore independent branches of the
  index tree. `[ENTITY §1]`

`[GUARD §2]`: "**Entity ID is assigned to *meaning*, not your file hash. Cosmetic tweaks will not save
you from suppression.**"

### 4.2 ⚠️ Why this is a correctness requirement, not an optimisation

The picture is chosen by **awareness × sub-type**. Sub-type is fixed per coach (§5.4). Awareness has
five values. **A batch of 8 concepts therefore has at most 5 distinct cells available, so at least 3
concepts must share a cell with another.**

If a shared cell yields the same picture, those concepts collapse into one Entity ID — the exact
failure the eight-angle strategy exists to avoid. **Within-cell structural diversification is a
correctness requirement of this rule, not a refinement of it.**

⚠️ **PD-4 tightens this.** With all three Most-Aware cells now depicting a founder direct-to-camera
still, concepts landing at Most-Aware start from a *more* similar visual baseline than the research's
three distinct transactional visuals would have produced. Any Most-Aware concepts sharing a batch must
lean harder on §4.3's remaining levers — talent framing, environment, format. **Recorded as a
consequence of PD-4, and a specific thing to watch in the first structural-diversity proof render.**

### 4.3 The four structural variables (unlock new Entity IDs)

| Variable | What to vary | Source |
|---|---|---|
| **Talent & demographic** | The featured face, age, or body type — "immediately breaks the semantic grouping" | `[ENTITY §2]`, `[ARCHETYPE §6]`, `[TECH §5.2]` |
| **Environmental coordinates** | Sterile clinical studio → natural outdoor landscape → warm residential setting | `[ENTITY §2]`, `[COHERENCE §3]` |
| **Visual composition & format** | Photographic portrait → hand-drawn whiteboard diagram → minimalist text-heavy card | `[ENTITY §2]`, `[ARCHETYPE §6]` |
| **Lighting & emotional register** | High-key bright daylight → low-key atmospheric with deep shadows | `[ENTITY §2]`, `[COHERENCE §3]` |

### 4.4 The three cosmetic variables (collapse Entity IDs — must NOT be the only difference)

- **Copy & overlay swaps** — changing headlines or hex codes on the same background template
- **Minor framing** — slight zooms, crops, or padding adjustments on the same person/environment
- **Accessory toggling** — a shirt colour or minor prop change on the same talent in the same room

`[ENTITY §2]`, plus the comparison tables at `[GUARD §2]` and `[COHERENCE §3]`.

**This is the objective render bar.** Two renders from different angles that differ only by headline
text are, by this definition, cosmetic — one Entity ID, one ticket. A proof render must show a
different subject, setting, lighting or format.

⚠️ **PD-4 interacts with this directly and must not be misread.** Because PD-4 moves offer specifics
into the overlay, two Most-Aware concepts could end up differing *only* by overlay text — which
`[ENTITY §2]` classifies as **cosmetic**, collapsing to one Entity ID. **PD-4 therefore makes §4.2's
within-cell diversification mandatory at Most-Aware specifically, not merely advisable.**

### 4.5 The worked mechanism the research supplies — the answer to §4.2

`[ENTITY §3]` gives a concrete 8-asset protocol — the **4-Dimension Scattershot** (Format, Persona,
Environment, Benefit) mapped across the **PDA framework** (Persona × Desire × Awareness) — plus a
filled 8-row example for a "Somatic Anxiety Relief" offer. Assets 2, 5 and 7 all sit at
**Solution-Aware** yet are structurally distinct:

| # | Awareness | Format | Persona | Environment |
|---|---|---|---|---|
| 2 | Solution-Aware | Diagram (4:5) | Abstract/Method | Whiteboard |
| 5 | Solution-Aware | Text Card (4:5) | Minimalist | Neutral Flat Colour |
| 7 | Solution-Aware | Process Flow (4:5) | The Method | Digital Graphic |

**The research's own demonstration** of how concepts sharing an awareness stage stay structurally
apart — and therefore the direct answer to §4.2.

Also stated: `[ENTITY §3]`'s **3-Axis Diversification Rule** — every batch must vary along a Message
axis, a Visual axis and a Format axis.

### 4.6 Desire is available as a within-cell lever

`[ENTITY §3]`'s framework is **PDA — Persona × Desire × Awareness**, and `[SCHWARTZ §5]` repeats it
("By varying these three axes, teams create 'meaningful divergence'").

This does **not** contradict the locked "picture is decided by awareness × sub-type, not desire"
decision. That governs *which cell selects the image direction*; PDA governs *how assets within a
batch are held apart*. Different jobs. But **desire is available as a within-cell diversification
lever**, and concept records already carry a `desire` field — so §4.2's collision has a ready input
requiring no new upstream data. Flagged as an available mechanism, not a change to the locked
decision.

---

## 5. Sub-type auto-detection

### 5.1 What the research gives — category membership

| Sub-type | Professions named | Buyer psychology | Source |
|---|---|---|---|
| **Grounded & Professional** | Therapists, Clinical Counselors, Nutritionists, Certified Personal Trainers | "Defensive Buying" — risk mitigation through evidence-based safety | `[ARCHETYPE §2]` |
| **Spiritual & Esoteric** | Tarot Readers, Energy Healers, Astrologers, Manifestation Mentors | "Atmospheric Resonance" and intuitive trust; sacred spaces over scientific proof | `[ARCHETYPE §3]` |
| **Aspirational & Lifestyle** | High-performance Mentors, Mindset Coaches, Keynote Speakers | "Future-Self Identification" — freedom, vitality, status elevation | `[ARCHETYPE §4]` |

Two other documents give overlapping but **not identical** lists:

- `[SCHWARTZ §4]` — Grounded/Clinical: *therapists, nutritionists* · Aspirational/Lifestyle: *mindset,
  **fitness coaches*** · Esoteric/Spiritual: *tarot, healers*
- `[ENTITY §4]` — Clinical & Grounded: *therapists, nutritionists* · Aspirational & Lifestyle:
  *mindset, **relationship*** · Esoteric & Spiritual: *tarot, energy healers*

**PD-1 settles the fitness disagreement in favour of Grounded.** The *relationship*-coach listing in
`[ENTITY §4]` appears in no other document and is not adjudicated anywhere — **Gap G9, §9.**

### 5.2 ⚠️ The research does NOT specify a detection algorithm

**None of the seven documents describes how to infer a sub-type from a free-text niche or service
description.** They provide category *membership examples* only. Any matching mechanism — keyword
lists, embedding similarity, an LLM classifier — is a build decision the research does not make. This
document does **not** invent one. **Gap G1, §9.**

**What the research does impose on whatever mechanism is chosen:**

- Getting it wrong is **not** a soft failure. `[ARCHETYPE §1]`: the wrong archetype — its example is a
  clinical flowchart for a spiritual offer — triggers "branch-cutting" that misfiles the ad into the
  wrong retrieval tree, leading to "immediate Entity ID suppression and catastrophic conversion
  failure."
- `[ARCHETYPE §3]` for the esoteric case: the generation model "must explicitly reject corporate
  headshots or scientific flowcharts for this sub-type," and flowcharts will branch-cut the ad into
  the Clinical/Professional tree "where it will fail to convert… leading to permanent Entity ID
  suppression."

Detection accuracy is load-bearing and the cost of a miss is account-level. **This is the evidence
base for PD-2 and PD-3.**

### 5.3 The ambiguous / fuzzy case

**(a) A genuine contradiction between two reports — fitness.** `[ARCHETYPE §2]` Grounded vs
`[SCHWARTZ §4]` Aspirational. **Settled by PD-1 → Grounded.** ⚠️ Residue remains — §7.3.

**(b) Services plausibly in two columns.** A "mindset coach" with a clinical psychology credential; a
"breathwork practitioner" (somatic content routes through Esoteric at `[MATRIX §3.2.2]`, yet
breathwork is also sold clinically); a "life coach" with no qualifier. **Not adjudicated by the
research.** → **PD-2**: default Grounded, store low confidence.

**(c) A ZAP-specific ambiguity already known to this codebase.** `STATE.md` records that the niche
string "coaching" currently renders as *athletic* coaching. A detector keying on the raw niche
inherits that directly. → **PD-2** applies; **PD-3** gives the coach the correction.

### 5.4 What detection resolves against, and when

The sub-type is a property of **the seller**, not the individual concept — `[ARCHETYPE]` defines all
three by practitioner profession, and `[MATRIX §2]`'s second axis is "Seller Sub-type". It resolves
**once per coach/service** and is constant across that coach's concepts. This is what creates §4.2's
collision, and why PD-3's correction affordance belongs at the service level rather than per-concept.

---

## 6. What the record must carry

Design requirement only — no implementation, no migration, no code.

### 6.1 Already present

`campaignConcepts` already stores `awareness` as an enum with exactly the five Schwartz stages
(`unaware`, `problem_aware`, `solution_aware`, `product_aware`, `most_aware`). **The row axis already
exists on the record** and needs no new field.

### 6.2 Missing — required for the image system to read the angle

| Requirement | Why | Grounded in |
|---|---|---|
| **Detected seller sub-type** — grounded / esoteric / aspirational | The matrix's second axis. Currently nowhere in the schema; the live image system reads the coach's niche instead | `[MATRIX §2]`, `[ARCHETYPE §2–4]` |
| **Detection confidence** | §5.2: a wrong sub-type is an account-level failure, and §5.3 shows real ambiguity. **PD-2 requires the low-confidence state be stored explicitly** | `[ARCHETYPE §1, §3]`; **PD-2** |
| **Coach-override flag + overridden value** | **PD-3**: detection is surfaced and changeable. The record must distinguish a detected sub-type from a coach-corrected one, so a correction survives regeneration and is not overwritten by the detector | **PD-3** |
| **Resolved awareness stage** | Already present (§6.1), but must be *read* by the image path rather than inferred — it is the matrix's row axis | `[MATRIX §2]`, `[SCHWARTZ §2–3]` |
| **Resolved image direction** — stored structurally, not as one prose blob: *archetype/format · subject · environment · lighting · emotional register · compliance note* | The six attributes the matrix returns per cell (`[MATRIX §2]` columns). Separate storage is what lets §4's diversity check compare two concepts attribute-by-attribute; a prose string cannot be compared structurally | `[MATRIX §2]` |
| **Structural-diversity assignment** — the concept's slot on the varying axes (talent, environment, format) | §4.2: concepts sharing a cell must differ structurally; §4.5's protocol assigns each asset explicit Format/Persona/Environment coordinates. Without a stored assignment nothing guarantees divergence. **PD-4 makes this mandatory at Most-Aware (§4.4)** | `[ENTITY §3]`; **PD-4** |
| **Target placement / aspect ratio** | `[TECH §5.2]`: native assets per ratio trigger *distinct* Entity IDs; auto-letterboxing pushes similarity above 60%. Format is a diversity axis (§4.3), so it must be a stored per-concept property, not a global render setting | `[TECH §5.2]`, `[ENTITY §3]` |
| **Overlay payload** — the offer specifics PD-4 moves out of the pixels | PD-4 relocates pricing, deliverables, booking and refund terms to the overlay. Those are now *required* render inputs at Most-Aware, and carry compliance obligations (§2.5) | **PD-4**; `[MATRIX §3.5.1–3.5.3]` |

**Placement note:** sub-type, confidence and override belong at the **service/coach** level per §5.4;
image direction, diversity assignment, aspect ratio and overlay payload are **per-concept**. The exact
table split is a build decision.

### 6.3 The UI requirement PD-3 creates

PD-3 is not satisfied by storage alone. The build must **surface** the detected sub-type to the coach
and accept a correction. The research says nothing about placement, wording or timing. **Gap G6, §9.**

### 6.4 What the research does not specify

No storage shape, field name, type or migration strategy. The table above states *what information
must be available* and stops there. **Gap G8, §9.**

---

## 7. Conflicts and departures

### 7.1 Resolved intra-research conflicts — applied in §2

| # | Conflict | Resolution | Applied at |
|---|---|---|---|
| **R1** | `[SCHWARTZ §2.1]` forbids portraits at Unaware vs `[MATRIX §3.1.1]` prescribes an Authority Portrait | Candid pattern-break, Grounded styling; high-ticket portrait branch struck | §2.1 Unaware × Grounded |
| **R2** | `[SCHWARTZ §2.3]` prohibits vague lifestyle vs `[MATRIX §3.3.3]` prescribes a lifestyle Transformation Arc | Method-made-visible, aspirational styling retained | §2.3 Solution-Aware × Aspirational |
| **R4** | `[MATRIX §2]` "Natural Landscape" vs `[MATRIX §3.3.2]` whiteboard / raw stone / Sacred Space | Prose version — method-as-tactile-ritual | §2.3 Solution-Aware × Esoteric |

Full reasoning in §1.3.

### 7.2 Research-resolved — no adjudication

**R5** — `[GUARD §4]` prohibits atmospheric lighting vs `[ARCHETYPE §3]` mandates it for Esoteric.
`[GUARD §6]` self-resolves: permitted only when paired with personal-reflection copy. Recorded at §3.2.

### 7.3 🔴 R3 — OPEN

**Not resolved. Nothing downstream should assume a resolution.**

#### The documents in conflict

| Document | Places fitness in | Exact wording |
|---|---|---|
| `[ARCHETYPE §2]` | **Grounded** | *"Therapists, Clinical Counselors, Nutritionists, and **Certified Personal Trainers**."* |
| `[SCHWARTZ §4]` | **Aspirational** | *"**Aspirational/Lifestyle (Mindset, Fitness Coaches):** The objective is to generate future-state desire."* |

#### What PD-1 settles, and what it does not

**PD-1 settles the primary question:** fitness defaults to **Grounded** (§1.2).

**PD-1 does not settle the residue.** The matrix embeds **fitness-specific prescriptions inside the
Aspirational column**, in three places — verified by search across all seven documents:

1. `[MATRIX §3.2.3]` — Problem-Aware × **Aspirational**: *"if fitness, show the 'low energy' moment."*
2. `[MATRIX §3.3.3]` — Solution-Aware × **Aspirational**: *"If fitness, prioritize 'The Habit Stack'
   visual."*
3. `[ARCHETYPE §5]` — the **Aspirational** row alone lists *"labeled tracker metrics"* among its key
   visual elements.

**Under PD-1 a fitness coach resolves to Grounded and never reaches any of the three.** The research's
only fitness-specific visual guidance becomes unreachable for exactly the coaches it was written for;
they receive the Grounded cells instead — a "Biomarker Matrix" at Problem-Aware `[MATRIX §3.2.1]`, a
clinical flowchart at Solution-Aware `[MATRIX §3.3.1]`.

**The open question:** should PD-1's Grounded classification carry the Aspirational column's
fitness-specific branches across, or should a Grounded-classified fitness coach forgo them entirely?

#### Why Principle 1 cannot adjudicate this

**Principle 1 resolves conflicts between a row's purpose and a column's aesthetic. R3 is not that kind
of conflict.** R1, R2 and R4 each pit *what the awareness stage demands* against *how the archetype
styles it* — there is an awareness axis to reason from. R3 is a disagreement about **which column a
profession belongs to**. Both documents agree on what each stage demands and how each archetype
styles; they differ only on taxonomy membership. There is no awareness-vs-archetype axis for the
principle to grip, so applying it would produce a confident-looking answer with no reasoning under it
— the failure mode CLAUDE.md §15a exists to prevent.

#### What adjudication needs to weigh

- **For carrying them across:** they are the only fitness-specific visual guidance in the research
  set. Discarding them means a fitness coach's images are chosen by rules written for therapists and
  nutritionists, with nothing fitness-aware in the path.
- **Against:** PD-1's basis is `[GUARD §4]` compliance safety. "The low energy moment" sits close to
  `[GUARD §4]`'s prohibited distress framing, and "labeled tracker metrics" edges toward the
  before/after and measurement territory of `[GUARD §2]`. Importing them could reintroduce the risk
  PD-1 was decided to avoid. **"The Habit Stack" appears safest of the three**, being a framework
  rather than a body or distress depiction — offered as an observation for the adjudicator, **not a
  recommendation and not a partial resolution.**
- **A third shape**, noted without endorsement: re-render the branches in Grounded styling rather than
  adopting or discarding them wholesale, consistent in form with R2's what-vs-how split. Whether that
  is legitimate here is exactly what is escalated, since Principle 1 does not reach R3.

### 7.4 🔶 PD-4 — a departure from the research, recorded as such

**This is not a contradiction resolution.** The research is **unanimous** that Most-Aware should be
transactional; there is no conflict in the sources to resolve. Four documents agree:

| Document | Prescription at Most-Aware |
|---|---|
| `[SCHWARTZ §2.5]` | "high-fidelity mockups of the program portal, booking interfaces, or physical workbooks" |
| `[SCHWARTZ §3]` | "Portal mockups; Value Stack visuals" |
| `[COHERENCE §2]` | "Direct transactional visuals; Program Portal Mockups or Booking Interfaces" |
| `[MATRIX §2, §3.5]` | Digital Portal · Booking Interface · Value Stack Visual |

**PD-4 overrides all four**, on the grounds recorded at §1.2 — principally Principle 2's
no-in-image-text constraint, which is a measured capability limit of this codebase rather than a
disagreement with the research's marketing reasoning.

**Recorded honestly because the distinction matters:** R1/R2/R4 pick a side in a genuine intra-research
dispute. PD-4 sets the research aside where it is unanimous. Both are legitimate, but a reader must be
able to tell them apart — and a future session must know that reverting PD-4 would return the spec to
what the research actually says, not to an error.

**Partial support:** `[MATRIX §4.1]`'s **Delivery Rule** prescribes "feature the **Practitioner's
Face**" for 1-on-1 services. For 1-on-1 offers PD-4 coincides with the research; the departure is real
only for digital-product/SaaS offers.

**Consequences carried into the spec:** §2.5 (all three cells), §4.2 and §4.4 (diversity tightening),
§6.2 (overlay payload becomes a required render input).

---

## 8. Technical & format constraints

### 8.1 Placement specifications `[TECH §1]`

| Placement | Aspect ratio | Recommended resolution | Format | File size |
|---|---|---|---|---|
| Feed (FB + IG) | 4:5 vertical | **1440 × 1800** | JPG, PNG, H.264 | <5MB static |
| Stories & Reels | 9:16 vertical | **1080 × 1920** | JPG, PNG, H.264 | <5MB static |
| Carousel cards | 1:1 square | **1440 × 1440** | JPG, PNG, H.264 | <5MB static |
| In-stream | 16:9 or 1:1 | 1920 × 1080 or 1440² | H.264 | 4GB max |
| Right column | 1.91:1 | 1200 × 628 | JPG, PNG | <5MB |
| Marketplace | 1:1 square | 1440 × 1440 | JPG, PNG | <5MB |
| Threads feed | 1:1 / 4:5 max | 1440 × 1800 | JPG, PNG | <5MB |

- **4:5 is the technically superior feed format** — 20–25% more mobile viewport real estate than 1:1
  `[TECH §2.1]`; `[GUARD §7]` puts it at 25%.
- **1:1 is mandatory for carousels** — Andromeda letterboxes or aggressively crops 4:5 assets in
  carousels, which "collapses the asset's Creative Similarity Score and penalizes the Entity ID"
  `[TECH §2.3]`.
- **1440p is the professional benchmark**, required to mitigate compression artifacts during Stage 1
  retrieval `[TECH §4.1]`; `[GUARD §7]`: "**1440px minimum** for high-density mobile rendering."

### 8.2 Text density `[TECH §4.4]`

- The "20% Rule" is **retired**; the standard is **<33% canvas coverage**.
- **Headline limit: 5–7 words maximum** `[TECH §4.4]`, `[GUARD §7]`, `[COHERENCE §4]`.
- Exceeding 33% "triggers visual complexity penalties within the Andromeda retrieval engine."

**Note:** PD-4 moves offer specifics into the overlay, so the overlay carries more text than before.
The <33% total-canvas ceiling and the 5–7 word headline limit apply to the **composited result**, not
the generated plate alone. This is a real constraint on how much PD-4 can relocate.

### 8.3 Safe zones `[TECH §3]`, `[COHERENCE §4]`

On a 1080 × 1920 canvas: top 14% (~250px) UI header clearance · bottom 20–35% (~340–670px) CTA and
caption clearance · side 6% (~65px) edge buffer. The **Center Safe Band** is the middle 51% —
**pixels 250 to 1248** — and all critical elements (logos, faces, primary headlines) must sit inside
it.

`[MATRIX §6.2]` gives Feed margins slightly differently — top 14% (250px), bottom 20% (340px) — and
Carousel as 10% minimum edge padding.

### 8.4 File hygiene `[TECH §4.2]`

sRGB mandatory · strip PNG metadata · <5MB for high-speed ingestion.

### 8.5 🔴 The build-time gap — a correctness issue, not only quality

Checked against `server/_core/imageGeneration.ts` at HEAD `f8761e4`:

| | Research requires | Renderer does today |
|---|---|---|
| **Resolution** | 1440px minimum `[TECH §4.1]`, `[GUARD §7]` | gpt-image-1 path hardcodes `size: "1024x1024"` (line 113) — **1024px, below even the 1080 figure previously recorded in the checkpoint** |
| **Aspect ratio** | 4:5 primary for feed `[TECH §2.1]` | Defaults to **`"1:1"`** on both generator paths (lines 189, 282) |
| **Per-placement natives** | Native assets per ratio trigger distinct Entity IDs; letterboxing pushes similarity >60% `[TECH §5.2]` | Only `makeVertical` requests 9:16; no 4:5 path observed |

The Flux paths pass `aspect_ratio` without an explicit pixel size, so their output resolution is
model-determined and was **not** verified here — establishing it needs a real render, not a code read.
**Gap G7, §9.**

**Why the aspect-ratio default is a correctness issue rather than polish:** `[TECH §5.2]` ties aspect
ratio directly to Entity ID generation, and **format is one of the four structural-diversity levers**
(§4.3) that §4.2 establishes as *required* for this rule to work at all. If every concept renders at
the same 1:1 default, one of the four levers available to resolve the 8-concepts-into-5-cells
collision is unavailable — and §4.4 shows PD-4 has already narrowed the others at Most-Aware. The
resolution shortfall is a quality matter; **the aspect-ratio default blocks the rule's core
guarantee.**

---

## 9. Production-validation watch-items

Findings to verify against real ad performance once Andromeda ads run, rather than treat as settled.
**Provenance is stated accurately for each** — the two items flagged for validation turned out to have
very different evidentiary weight, and recording them as equivalent would have buried the difference.

### V1 — 🔴 The Most-Aware founder-still conversion claim — **ZERO research sources**

**Status: an untested product hypothesis, not a research finding.**

PD-4's reason (a) — that a human direct-address moment outperforms a static checkout or pricing
visual — is **supported by no report in the set**. A search of all seven documents found the research
**unanimous in the opposite direction** (§7.4): four documents prescribe transactional visuals at
Most-Aware, and `[SCHWARTZ §2.5]` explicitly lists "storytelling or educational hooks" as the
Most-Aware pitfall.

**This does not invalidate PD-4.** Its decisive reason (b) — the no-in-image-text constraint — is an
engineering capability limit measured on this codebase (46 clean / 2 leaked on 48 renders), and it
stands regardless of which creative converts better. **But reason (a) should be labelled as what it
is: a hypothesis contradicting the research consensus, awaiting evidence.**

**Verify:** compare Most-Aware founder-still performance against the research's transactional visual
once real ads run. If the founder-still underperforms, reason (a) falls — and the correct response is
to solve the in-image-text problem, not to revert PD-4 blindly, since reason (b) would still hold.

### V2 — 🟢 The 4:5 primary aspect ratio — **FOUR corroborating sources**

**Status: the best-corroborated technical claim in the set. Not single-source.**

4:5 for feed appears in **`[TECH]` (8 mentions), `[ENTITY]` (8), `[MATRIX]` (3) and `[GUARD]` (2)** —
four of the seven documents, independently. `[TECH §2.1]` and `[GUARD §7]` also agree on the
magnitude of the benefit (20–25% and 25% more viewport respectively).

**Still worth watching in production**, because §8.5 shows the renderer does not currently produce it,
so ZAP has no first-party evidence either way — but it should be treated as a **strong, well-sourced
default**, not a fragile assumption.

**Verify:** once a 4:5 path exists, confirm the viewport and Entity-ID benefits appear in real
delivery data.

### V3 — The Entity-ID similarity thresholds (60% / 40%)

Recorded for completeness. Corroborated across `[ENTITY §1]`, `[MATRIX §1.2]`, `[GUARD §2]`,
`[COHERENCE §1]` and `[ARCHETYPE §1]` — five documents — but **Meta does not publish a Creative
Similarity Score**, so these are not directly observable. The *behaviour* (concepts collapsing into
one delivery pattern) is observable; the number is not. **Verify by outcome, never by reading a score
that does not exist in any Meta interface.**

---

## 10. Explicit gaps — where the research decides nothing

| # | Gap |
|---|---|
| **G1** | **No detection algorithm** for sub-type from a niche string (§5.2). PD-2 and PD-3 govern the *policy*; the mechanism is a build decision. |
| **G2** | **No distribution rule** for how many of the 8 concepts occupy each cell. `[ENTITY §3]`'s example distributes 8 assets unevenly (3 Solution-Aware, 2 Problem-Aware, 2 Product-Aware, 1 Unaware) but states no rule. |
| **G3** | **No precedence order** between §2.6's cross-cutting modifiers and the cell's own prescription. |
| **G4** | **No precedence order** among the five compliance categories when several apply (§3.4). |
| **G5** | **No definition** of which niches count as the health/weight/mental-health zone triggering §3.2's lighting override. |
| **G6** | **No guidance** on placement, wording or timing of PD-3's sub-type surface in the UI (§6.3). |
| **G7** | **No stated Flux output resolution**, so §8.5's gap is only partly established from code; a real render is needed to close it. |
| **G8** | **No storage shape** — field names, types, migration (§6.4). |
| **G9** | **The `[ENTITY §4]` "relationship coach" listing** appears in no other document and is adjudicated nowhere (§5.1). |
| **G10** | **The text-bearing cells outside Most-Aware.** Principle 2 is applied by PD-4 at Most-Aware only, but Problem-Aware × Grounded (labeled Friction-Points diagram, Biomarker Matrix), Solution-Aware × Grounded (clinical flowcharts) and the Unaware × Grounded typography-card branch are all text-composed by nature. **The same in-image-text limit applies to them and has not been decided.** Newly surfaced by PD-4's reasoning; needs its own call. |

---

## 11. Not in scope

No code. No schema migration. No prompt text. No wiring.

Per the checkpoint §5, the **fabrication validator remains a hard prerequisite before Andromeda drives
any live ad** — unchanged and untouched by this document.

**Open items carried out of this spec:**
1. **R3 (§7.3)** — open, awaiting adjudication.
2. **G10 (§10)** — the text-bearing cells outside Most-Aware, surfaced by PD-4's own reasoning.
3. **V1 (§9)** — the founder-still conversion hypothesis, awaiting production evidence.

**Next steps, in order:** Claude's faithfulness pass → Arfeen's approval → commit.
