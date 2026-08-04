# Picture-strategy research — the image side of an ad (banked 2026-08-03)

**This set fills the one real design gap the Andromeda map identified.**

`../../handovers/ANDROMEDA_MAP_PLAIN_2026-08-03.md` found that the **words** half of an ad was
researched and built (angle strategy, ad copy, video scripts) while the **picture** half had no
research behind it at all — every image decision in the product came from our own trial and error.
That map's conclusion was: *"connecting Andromeda to the ads is not purely wiring; there is no
researched rule yet for what image an angle should carry."*

**These reports are that rule** (seven at first banking; four more added 2026-08-05 — see below). Banked here the day the map named the gap. Copied verbatim
from Arfeen's Downloads; plain git, matching `../script-research/` and `../landing-page-research/`.

**Do NOT execute anything from these — reference material.** Nothing in the codebase reads them yet.
No build has been done against them.

⚠️ **Three files have an internal title that differs from their filename** (noted so nobody thinks
they have the wrong document — content was verified against topic in every case): the Visual
Archetype file opens as *"Strategic Report: Image Archetypes Across the B2C Transformation
Spectrum"*; the Eugene Schwartz file opens as *"Awareness Mapping Strategy Report: Visual
Architecture for the Andromeda Retrieval Era"*; the Guardrails file opens as *"Definitive 2026 Meta
Ad Image Compliance Report"*. **Per CLAUDE.md §15a discipline, judge these by their content, not by
either title.**

## The seven reports

1. **`Eugene Schwartz Awareness-Stage Static Image Strategy_ …`** — ⭐ **the core mapping, and the
   direct counterpart to the hook→awareness map in `../script-research/`.** Gives each of the five
   awareness stages its own visual approach, environment, emotional register and named pitfalls:
   Unaware → relatable candids (pattern break) · Problem-Aware → symbolic friction, the empathetic
   mirror · Solution-Aware → labeled diagrams, the mechanism made visible · Product-Aware → expert
   portraits and proof · Most-Aware → portal mockups and value-stack visuals. **This is the document
   that answers "what image should this angle carry".**

2. **`The Angle-to-Image Strategic Matrix_ …`** — the largest report in the set. A **5×3 decision
   matrix** crossing the five awareness stages with three seller archetypes, giving a visual
   approach, environment, emotional target and compliance note per cell.

3. **`Visual Archetype Strategy for B2C Transformation Sellers_ …`** — defines the three archetypes
   the matrix's second axis uses: **Grounded, Esoteric, Aspirational**.

4. **`Meta Andromeda Entity ID & Visual Diversity Protocol_ …`** — 🔑 **the report that decides
   whether the eight-angle strategy actually works.** Entity ID is assigned to *meaning*, not to a
   file hash, so **cosmetic variation collapses to the same Entity ID** (swapping text overlays,
   toggling colours, minor wardrobe changes) while **structural variation earns a new one** (a
   different image form, a genuinely different face, a different kind of scene). This confirms the
   concern the map raised: eight distinct messages wearing broadly the same picture would collapse
   back into one auction entry and undo the reason for generating eight.

5. **`Image-and-Copy Coherence_ The Matched-Pair Principle & Visual Composition …`** — how the
   picture and the words have to agree, and composition rules. Relevant to the existing headline
   compositing work.

6. **`Meta Ad Image Compliance Guardrails 2026_ The Do-Not-Do List …`** — prohibited visual triggers
   and their compliant substitutes (distress imagery → routine/clinical framing; body-flaw framing →
   ingredient and process shots). The visual counterpart to
   `../../compliance/META_AD_COMPLIANCE_REFERENCE.md`. ⚠️ **Same evidence discipline applies: check a
   claim's tier before it becomes enforcement logic.**

7. **`Meta Ad Image Technical Specifications & Rendering Guide (2026 Edition)`** — placements, aspect
   ratios, resolutions, formats and file-size limits (Feed 4:5 at 1440×1800; Stories/Reels 9:16 at
   1080×1920; Carousel 1:1 at 1440²). ⚠️ **Worth checking against what the renderer produces today** —
   these are higher-density figures than the 1080px plates currently generated.

## ⚠️ FOUR REPORTS ADDED 2026-08-05 — they OVERTURN the sub-type model

Banked from `~/Downloads`, SHA-256 verified byte-identical, verified by content not filename.

8. **`Meta Ads 2026_ Visual Sub-Type Architecture for B2C Transformation Sellers.md`** — ⭐ **the
   one that changes the rule.** §1 names the "Fixed Identity Model" as a performance bottleneck that
   "traps the brand's Entity ID in one narrow branch". §2 scores four methods for choosing sub-type
   and picks the **Hybrid** — an onboarding aesthetic anchor plus per-concept flexing — rating
   inference-from-niche the weakest and *"the primary cause of campaign stagnation in 2026"*.

9. **`Meta Ads 2026_ The B2C Creative Testing Matrix & Andromeda Architecture Playbook.md`** — the
   largest of the four and the most directly buildable. §2.1 carries a **complete worked 8-concept
   matrix** on three axes — Awareness × Format × Visual Style — for a single seller. This is the
   concrete allocation the image rule now uses.

10. **`Meta Ads 2026_ Visual Styles, Creative Similarity, and Unaware Stage Architecture.md`** —
    the Entity-ID Trap restated: ads that "communicate the same idea" collapse to one ID regardless
    of font or colour changes.

11. **`Meta Ads 2026_ The Andromeda AI Ecosystem Shifting Marketing Strategy.md`** — three worked
    creative briefs, one per sub-type, each anchored to a different PDA pillar (Grounded→Awareness,
    Esoteric→Desire, Aspirational→Persona).

**What they changed:** sub-type is NOT a fixed per-coach identity to be detected. It is a
**per-concept diversity lever assigned across the batch**. See `../image-rule-spec.md` §5 (rev 4).

⚠️ **They also introduce a THIRD awareness distribution** (2/2/2/1/1, including one Most-Aware),
conflicting with the two already banked. Unreconciled — spec §5.7.

## TWO MORE ADDED 2026-08-05 (later the same day)

Banked from `~/Downloads`, SHA-256 verified byte-identical, verified by content not filename.

12. **`Meta Ads 2026_ Compliance vs. Creative Diversity under the Andromeda Architecture.md`** —
    ✅ **closes a standing worry.** Compliance and diversity act on different axes: *"Compliance is
    semantic; diversity is structural… a 'safe' ad is not a 'similar' ad."* §2 enumerates six
    structural levers that all survive strict compliance, and warns that compliance alone is a
    delivery cap — *"if 7 out of 8 ads in a set are clustered, Andromeda will prune the redundant
    branches."* Recorded at `../image-rule-spec.md` §3.5 (rev 5).

13. **`Meta Ads 2026_ Ad Copy Hook Optimization for Andromeda's Language Encoders.md`** —
    ⚠️ **COPY-side, not an image document.** Concerns how Andromeda's NLP encoders categorise intent
    from ad text. Banked here for provenance only; nothing in the image rule uses it. Parked at
    spec §11a for the next pass over the copy generators.

## What this set does NOT do

It does not wire anything. The concept records still carry **no image field**, nothing reads a
concept, and the live image system still picks its look from the coach's niche rather than from an
angle. **This research closes the design gap; the build gap is untouched and unstarted.**
