# ZAP Ad-Image Visual-Quality Standard

**Purpose:** the concrete bar ZAP's generated ad images must hit. This is the "visual half" of the weak-ads problem (the "data half" — the ad-ICP race gate — is already live). It is the reference brief for the ad-image visual-quality design track (now OPEN — Sprint 2 closed).

**Derived from:** a 50-image reference set (5 concepts × 5 variants × 2 aspect ratios) for a crypto-wealth workshop. Those references are the bar. This document names WHAT makes them work so CC can scope HOW from the real pipeline.

**Note:** the reference host shots appear AI-generated (consistent treatment with the non-host images), so this standard is reachable with generation alone — no mandatory headshot upload.

---

## 0. The one-line standard

Every ad image must look like a **single art-directed editorial shoot with a designed text layer on top** — one locked visual world across all concepts — not 25 independent AI generations each inventing their own look.

The references achieve this through two separately-controllable layers, which is exactly how ZAP is already architected:
1. **The photo layer** (Flux today) — the image.
2. **The text/design layer** (Cloudinary opentype/resvg/sharp render today) — headline, body, CTA, host lockup.

The gap is closed by locking a recipe on each layer. Neither layer needs a new technology; both need a locked system.

---

## 1. Photo layer — the locked recipe

The references share ONE photographic world. ZAP images currently read as "a person dropped into a scene" because each generation is unconstrained. Lock these:

**Lighting (biggest single lever — ~half the premium feel):**
- Near-black / deep-charcoal background, always.
- Warm gold rim / edge light on the subject; cinematic, moody, low-key.
- Never flat, never bright-white studio, never daylight-even.

**Subject as a real editorial moment, not a pose:**
- Subject is mid-action tied to the concept: typing, reading a printed statement, checking a phone, arms folded mid-boardroom, walking through a lobby.
- The prompt must specify the ACTION + SETTING, not "professional person." Generic gesture is the current failure mode.

**Deliberate negative space for text:**
- Every frame leaves a clean, uncluttered zone (a dark side, a shadow area, lower third) sized for the copy block.
- Generation must be instructed to leave that room. Text on a busy face = mud.

**One consistent world across all concepts:**
- Same colour temperature, same wardrobe register (sharp business), same location class (glass offices, boardrooms, city-at-dusk).
- Sameness across the set is what makes N images feel like one brand rather than N generations.

**On the host/person:**
- The reference host shots are AI-generated too (consistent with the non-host treatment) — so this standard is reachable with generation ALONE; no headshot upload is required to hit the bar.
- OPTIONAL quality lever (a product decision for Arfeen, not a requirement): allow users to upload a real headshot to composite into the template, removing the most fragile part of AI ad generation (uncanny / identity-inconsistent faces). Recommended eventually for a product whose ads feature the coach, but NOT a blocker for this standard.

---

## 2. Text / design layer — the locked recipe

The most copyable part and the likely fastest visible win. The references use a designed template, not stamped-on captions.

**Two typefaces, locked:**
- **Headline:** a high-contrast display SERIF (Didot / Playfair register — thin-and-thick strokes), title case or all caps. This face does enormous work — it reads expensive and editorial. Current ZAP headline font almost certainly reads generic by comparison.
- **Body:** one clean, quiet sans for the paragraph and sub-copy.
- No third face. Discipline is the point.

**Two-tone headline:**
- White for most of the line; ONE gold accent colour on the emphasis phrase only (e.g. `BACKUP PLAN`, `4+ INCOME STREAMS`, `SCARED OF INVESTING`).
- One accent colour, used sparingly. Never rainbow emphasis.

**A real layout template (same skeleton every image):**
- Headline in a fixed safe-zone (top third OR bottom third, chosen per composition).
- Body block beneath the headline — short, readable, consistent position.
- **Gold pill CTA button** ("RESERVE YOUR FREE SPOT →") — solid gold rounded pill, dark text, consistent size/position.
- **Host lockup:** small portrait + name + credential line ("HOST: ARFEEN KHAN — Entrepreneur | Investor | Educator"), consistent placement.

**Legibility scrim:**
- A dark-to-transparent gradient between photo and text so copy is ALWAYS legible over the image.
- This fade is the difference between "designed" and "text thrown on a photo." Non-negotiable.

**Aspect ratios:**
- Deliver both 4×5 feed (1080×1350) and 9×16 story from the same concept, with the text safe-zone re-flowed per ratio (not naively cropped).

---

## 3. Composition contract (how the two layers cooperate)

The photo and text share the frame BY DESIGN in the references — this is why nothing overlaps badly:
- Subject pushed to one side / lower third; negative space reserved on the opposite side for copy.
- The photo generation and the template must agree on WHERE the empty zone is, so the render layer always has clean space to place text.
- Practically: the photo prompt declares the copy zone; the template places text into that declared zone. They are designed together, not independently.

---

## 4. Current-state gap summary (what to fix)

| Layer | Reference standard | Current ZAP failure mode |
|---|---|---|
| Lighting | Locked gold-on-black cinematic | Unconstrained per generation |
| Subject | Mid-action editorial moment | Generic pose / person-in-void |
| Negative space | Reserved zone for text | Not reserved → text on busy areas |
| Consistency | One world across all concepts | Each image invents its own look |
| Headline font | High-contrast display serif, two-tone | Plainer/heavier generic font |
| Layout | Designed template + pill CTA + host lockup | Stamped captions, weaker hierarchy |
| Legibility | Gradient scrim guaranteed | Inconsistent → text can be unreadable |

---


## 4b. The five reference concept families

The 50 references span 5 concept families — a product decision (§6) covers which ZAP generates by default:
1. **Pain/stat hook** — headline states the pain or a statistic; object-metaphor or workspace photo.
2. **Audience callout** — "FOR PEOPLE DOING 9-5 WHO…" over an editorial subject photo.
3. **Problem/inflation narrative** — career-vs-wealth tension headlines, confident subject portraits.
4. **Comparison/contrast** — competitor-vs-us checklists (✗ vs ✓ cards), lighter backgrounds allowed.
5. **Authority/endorsement** — host photo + endorsement quote bubbles + credential lockup.

## 5. How to brief CC when this track opens (goal + standard, not implementation)

When Sprint 2 closes and this track begins:
- Hand CC THIS document as the bar, plus the 50 reference images.
- Ask CC to investigate-and-propose from the real pipeline: (a) how to lock the photo recipe in the Flux prompt layer, (b) how to build the template/two-font system in the render layer, (c) how the two layers share the copy-zone contract.
- Review CC's proposal for shortcuts and completeness. Do NOT pre-write the prompt strings, font choices in code, or render mechanics — CC scopes HOW from the actual `offersGenerator` / ad-image render path.
- Proof standard unchanged: a real generated image on a live run, side-by-side against the references, judged by eye — never "the prompt instructs it."

---

## 6. Open product decisions (Arfeen's calls, not the assistant's)

1. **Headshot upload** (§1): allow real-photo composite as an optional quality lever? Recommended eventually; not required to hit the bar.
2. **Font licensing:** the chosen display serif + body sans must be licensed for commercial render use. Confirm before locking specific faces.
3. **Concept breadth:** the references run 5 concept families (pain/stat, audience-callout, contrast-vs-competitor, comparison-table, authority/endorsement). Decide which families ZAP generates by default.
