# The Digital Asset Blueprint — Image Brief

**Replaces the image half of `ad-copy-brief.md`.** The copy in that document stands; the image prompts in it do not. Rewritten against `image-rule-spec.md` and the Andromeda image research after grading.

Eighteen concepts. Six per audience. Each one specifies the generated plate, the overlay hook, the sub-type, and the native format.

---

## What changed, and why

Four corrections, all from the spec.

**1 · Text is never in the generated image.**

> *"A generated image must not depend on baked-in text to do its job. Offer specifics live in the controllable headline overlay, never in the generated pixels."* — §1.1, Principle 2

> *"this is not a preference but a hard capability limit of this codebase, established by measurement. Prompt-based in-image text suppression failed three times on this project, at 46 clean / 2 leaked across 48 renders (~12% leak rate)."*

The earlier brief implied the hook was baked in. It is not. **Every prompt below produces a clean plate with no text. The hook is composited on top afterwards, in a layer you control.** That is what makes it editable, legible and reliably correct.

**2 · Hooks are 5–7 words.** Four in the earlier version ran to eight. All eighteen below are within limit.

**3 · Sub-type and format are diversity levers and must vary.**

> *"sub-type is allocated so that no (awareness × sub-type) pair repeats within a batch… every concept lands in a distinct cell, which is what earns eight Entity IDs rather than one."* — §5.1

Every prompt in the earlier version was the same register — photographic, documentary, editorial, unposed. That is uniformly **grounded**, one of three sub-types, and it collapsed eighteen ads into two matrix cells.

> *"If 7 out of 8 ads in a set are clustered, Andromeda will prune the redundant branches, effectively ghost-banning your creative pipeline before it even hits the auction."* — COMPLIANCE-DIVERSITY §2

**4 · Safe zones, resolution and file hygiene were missing entirely.** Specified at the end.

---

## The three sub-types

| sub-type | what it looks like |
|---|---|
| **Grounded** | Documentary realism. Natural light, unposed, real rooms, ordinary moments. Looks like a photograph someone took. |
| **Esoteric** | Pattern interrupt. Unexpected framing, symbolic objects, strong graphic composition, negative space, unusual crop or angle. Stops the scroll by being visually odd, not by being loud. |
| **Aspirational** | Elevated and cinematic. Controlled light, considered composition, high production value. Shows the version of the reader's life that is one decision away. |

**Awareness governs what is depicted. Sub-type governs how it is styled.** The subject of a problem-unaware concept stays the same whichever sub-type it wears — no charts, no coins, no screens, no crypto imagery anywhere in this set.

---

## The matrix

Six concepts per audience, allocated so no awareness × sub-type pair repeats — with one exception per audience, separated instead by native format:

> *"native assets per ratio trigger distinct Entity IDs; auto-letterboxing pushes similarity above 60%. Format is a diversity axis, so it must be a stored per-concept property, not a global render setting."* — §7.1

| # | awareness | sub-type | format |
|---|---|---|---|
| 1 | Problem-unaware | Grounded | 4:5 static |
| 2 | Problem-unaware | Esoteric | 9:16 static |
| 3 | Problem-unaware | Aspirational | 1:1 static |
| 4 | Problem-unaware | Grounded | 3-frame carousel |
| 5 | Solution-aware | Esoteric | 4:5 static |
| 6 | Solution-aware | Aspirational | 9:16 static |

Concepts 1 and 4 share a cell and are separated by format — a carousel is structurally a different asset, not a crop of the same one. **Render natively at each ratio. Never letterbox or crop one master.**

**One honest limit, from the spec itself:** *"none of this is measurable directly: Meta publishes no Creative Similarity Score, so the <40% target is engineered by construction and verified by observed delivery behaviour, never by reading a number back."* This structure is engineered to stay apart. It cannot be verified before it runs.

---
---

# AUDIENCE ONE — PROFESSIONALS

### 1 · Problem-unaware · Grounded · 4:5 static
**Overlay hook:** Eleven years. No pension behind it.

**Plate prompt:**
> A man in his late forties, South Asian, sitting alone at a marble kitchen counter in a modern Dubai apartment late at night. A closed laptop rests in front of him. He is turned toward the window, chin on his interlaced hands, thinking. Warm interior lamplight on his face, cool blue city glow beyond the glass. Photographic realism, natural documentary style, shallow depth of field. Clean empty wall space in the upper left of the frame.

---

### 2 · Problem-unaware · Esoteric · 9:16 static
**Overlay hook:** Still researching. Still not started.

**Plate prompt:**
> A single office chair pushed back from a desk in an empty room, seen from a low unusual angle. On the desk, a tall neat stack of printed articles and a pen resting on top, untouched. Strong late-afternoon light cutting diagonally across the floor, long shadows, large areas of empty space. Muted palette of grey and warm beige. Graphic, still, slightly uncanny composition. Nobody in frame.

---

### 3 · Problem-unaware · Aspirational · 1:1 static
**Overlay hook:** They weren't smarter. They started.

**Plate prompt:**
> A man in his forties in a well-cut open-collar shirt walking through a bright Dubai financial-district plaza in early morning light, mid-stride, relaxed and unhurried. Glass towers softly out of focus behind him. Cinematic, controlled golden light, elevated editorial fashion photography. Wide clean sky area in the upper third.

---

### 4 · Problem-unaware · Grounded · 3-frame carousel
**Overlay hook:** Waiting feels safe. It isn't.

**Frame 1:** A woman and man in their forties at a kitchen island early in the morning, school bags on the counter behind them, both looking down at a single sheet of paper between them. Warm morning light through a window. Documentary realism, unposed.

**Frame 2:** Close shot of the same sheet of paper, a household budget written by hand, a pen resting across it, a coffee cup at the edge of frame. Only hands visible at the border. Natural light.

**Frame 3:** The same kitchen an hour later, empty, the paper still on the counter untouched, morning light now higher and harder. Nobody in frame.

*Render each frame natively at 4:5. The sequence is the concept — decision, deferral, unchanged.*

---

### 5 · Solution-aware · Esoteric · 4:5 static
**Overlay hook:** See the process, not the result.

**Plate prompt:**
> An overhead flat-lay on a dark wooden table: a hand-drawn flow of five boxes connected by arrows on plain paper, a fountain pen laid diagonally across the corner, a folded pair of reading glasses. Strong single-source side light creating defined shadows. Graphic, tightly composed, high contrast, no people. Generous empty table surface along the top edge.

---

### 6 · Solution-aware · Aspirational · 9:16 static
**Overlay hook:** The one number everyone dodges.

**Plate prompt:**
> A man in his forties seated in a quiet, beautifully lit study at dusk, leaning back with a notebook open on his lap, calm and certain. Floor lamp, bookshelves softly out of focus, a window showing deep blue evening light. Cinematic, warm, high production value, controlled shadow. Clear space above his head in the upper quarter of the frame.

---
---

# AUDIENCE TWO — ENTREPRENEURS

### 1 · Problem-unaware · Grounded · 4:5 static
**Overlay hook:** One business. One market. Everything.

**Plate prompt:**
> A man in his forties standing alone in his own warehouse after closing, half the overhead lights off, hands in his pockets, surveying the racking and stock. Wide shot, small figure in a large space. Cool industrial light with one warm pool near him. Documentary realism, unposed. Dark ceiling area across the top of the frame.

---

### 2 · Problem-unaware · Esoteric · 9:16 static
**Overlay hook:** You built a job, not an asset.

**Plate prompt:**
> A single set of keys on a large empty desk in a shuttered shopfront, photographed from directly above. Roller shutter partly down in the background, a shaft of daylight falling across the floor. Deep shadow around the edges, one bright pool at the centre. Symbolic, minimal, strongly graphic. Nobody in frame.

---

### 3 · Problem-unaware · Aspirational · 1:1 static
**Overlay hook:** Decisive at work. Frozen outside.

**Plate prompt:**
> A woman in her late forties in a tailored blazer standing at the head of a meeting table mid-decision, two colleagues seated and listening. Confident, composed, in command of the room. Large windows, bright controlled daylight, glass and pale timber interior. Elevated corporate editorial photography, crisp and polished. Clean wall area behind her.

---

### 4 · Problem-unaware · Grounded · 3-frame carousel
**Overlay hook:** You get pitched every week.

**Frame 1:** A man in his forties at a desk at the end of the day, phone in hand, expression tired and sceptical. Office light going amber. Documentary, candid.

**Frame 2:** Close overhead shot of a desk drawer partly open, containing a thick stack of business cards and folded brochures. Only the drawer and a hand in frame.

**Frame 3:** The same man leaving the office, jacket over one arm, lights off behind him, walking away from the desk. Rear three-quarter view, natural evening light.

*Render each frame natively at 4:5.*

---

### 5 · Solution-aware · Esoteric · 4:5 static
**Overlay hook:** A process you run yourself.

**Plate prompt:**
> A close side-lit shot of a small brass mechanism — interlocking gears and a lever — resting on plain grey stone, photographed at a low angle with a very shallow depth of field. Precise, tactile, engineered. Single hard light source, deep shadow, muted metallic palette. No people, no text, no signage. Clear stone surface across the upper portion.

---

### 6 · Solution-aware · Aspirational · 9:16 static
**Overlay hook:** Cash flow that isn't flat.

**Plate prompt:**
> A man in his forties on a rooftop terrace at golden hour, forearms resting on the railing, looking out over a low-rise city skyline, relaxed and thinking. Warm directional sunset light, long shadows, shallow focus on the skyline. Cinematic, aspirational, high production value. Open sky filling the upper third.

---
---

# AUDIENCE THREE — WOMEN

*Tone guard for every image on this page: she is competent and in control of what she already handles. No image should show her anxious, confused, overwhelmed, or being taught by a man. The failure mode is condescension arriving disguised as empathy.*

### 1 · Problem-unaware · Grounded · 4:5 static
**Overlay hook:** You run it. You don't own it.

**Plate prompt:**
> A woman in her forties, South Asian, at a kitchen table mid-morning with an open notebook and a calculator, one hand resting on the page. Calm and capable, looking slightly off-camera in thought. Soft daylight through a window, warm domestic interior, plants on the sill. Documentary realism, unposed, natural colour. Clean wall space above her.

---

### 2 · Problem-unaware · Esoteric · 9:16 static
**Overlay hook:** Explained near you, not to you.

**Plate prompt:**
> A single empty chair set slightly apart from a circle of other chairs in a bright bare room, photographed from a raised angle. Hard afternoon light through a tall window casting a long shadow from the separated chair. Minimal, graphic, generous empty floor space. Muted palette, nobody in frame.

---

### 3 · Problem-unaware · Aspirational · 1:1 static
**Overlay hook:** Something that's still there later.

**Plate prompt:**
> A woman in her late forties standing at a window in the evening, watching two teenagers at a table behind her doing homework, seen over her shoulder in soft focus. Warm interior lamplight, deep blue outside. Cinematic, tender, high production value, controlled shadow. Clear darker area in the upper left.

---

### 4 · Problem-unaware · Grounded · 3-frame carousel
**Overlay hook:** Nobody tells you when you're ready.

**Frame 1:** A woman in her forties standing at a window with a cup of tea in the early morning, thoughtful, unhurried. Soft light, comfortable apartment interior. Documentary, unposed.

**Frame 2:** Close shot of a wall calendar with several months turned, a pen hanging beside it. Only the calendar and a hand reaching toward it in frame.

**Frame 3:** The same woman sitting down at a table and opening a notebook, decisive. Same apartment, light now higher. Natural colour, candid.

*Render each frame natively at 4:5.*

---

### 5 · Solution-aware · Esoteric · 4:5 static
**Overlay hook:** Taught from zero. Nothing assumed.

**Plate prompt:**
> An overhead flat-lay on a pale linen surface: a blank open notebook, a sharpened pencil, and a single wooden building block placed beside them. Soft even diffused light, minimal props, generous negative space around the objects. Calm, tactile, quietly graphic. No people.

---

### 6 · Solution-aware · Aspirational · 9:16 static
**Overlay hook:** What amount is actually sensible?

**Plate prompt:**
> A woman in her forties seated in a well-lit reading corner at dusk, notebook closed on her lap, looking directly at the camera with quiet certainty. Floor lamp, soft furnishings, a window showing evening blue. Cinematic warmth, controlled light, elevated portrait photography. Clear space above her head.

---
---

# Technical specification

## Overlay text — the part that is not generated

The hook is composited over the finished plate in a layer you control. It is never requested from the image model.

**Word limit:** 5–7 words. All eighteen hooks above comply.

**Coverage ceiling:**

> *"The '20% Rule' is retired; the standard is <33% canvas coverage."* — §8.2
> *"Exceeding 33% triggers visual complexity penalties within the Andromeda retrieval engine."*

> *"The <33% total-canvas ceiling and the 5–7 word headline limit apply to the composited result, not the generated plate alone."*

So the ceiling covers hook plus logo plus any CTA badge — everything added on top, measured together.

**What the hook must do:**

> *"Rosetta OCR Visual Hook: Acts as the primary sequence-initial visual anchor. It must establish the dominant awareness stage of the creative."*

Meta reads it by OCR and fuses it with the body copy. If the image says one thing and the body another, the mismatched vectors lower retrieval priority. Each hook above is in the same awareness stage as its concept's primary text in `ad-copy-brief.md`.

**Typography:** plain sans-serif, high contrast against the plate, no decorative faces. Each prompt above specifies where the clean space sits — put the hook there.

## Safe zones

> *"On a 1080 × 1920 canvas: top 14% (~250px) UI header clearance · bottom 20–35% (~340–670px) CTA and caption clearance · side 6% (~65px) edge buffer. The Center Safe Band is the middle 51% — pixels 250 to 1248 — and all critical elements (logos, faces, primary headlines) must sit inside it."* — §8.3

| zone | 1080 × 1920 | keep clear of |
|---|---|---|
| Top | 0 – 250px (14%) | platform UI header |
| **Center Safe Band** | **250 – 1248px (51%)** | **faces, hooks and logos go here** |
| Bottom | 1248 – 1920px (20–35%) | CTA button and caption |
| Sides | 65px each edge (6%) | edge crop |

Scale proportionally for 4:5 and 1:1. A face or hook placed in the bottom clearance zone gets covered by the CTA.

## File output

> *"1440px minimum for high-density mobile rendering"* — §8.1
> *"sRGB mandatory · strip PNG metadata · <5MB"* — §8.4

- Minimum 1440px on the short edge
- sRGB colour profile
- PNG metadata stripped
- Under 5MB per asset
- **Rendered natively at each ratio.** Never letterbox or crop a single master — auto-letterboxing pushes similarity above 60% and collapses the assets into one Entity ID.

## Generation rules

**Positive framing only.** Diffusion models have no NOT operator, and negative instructions tend to produce the thing they forbid. Every prompt above states what is in frame. None says "no charts" or "no text" — they simply describe scenes containing neither.

**No crypto imagery anywhere in this set.** No charts, coins, candlestick graphs, exchange screens, wallets or logos. Awareness governs what is depicted, and every concept here is problem-unaware or solution-aware. A person who has never bought crypto reads those images as being about somebody else's hobby.

**Casting.** People aged 35–55. South Asian, Middle Eastern and mixed. Gulf and Mauritian interiors and exteriors. Generic Western stock imagery costs relevance with this audience.

**Text leakage check.** Despite positive framing, models occasionally render signage, screen text or lettering unprompted — measured on this codebase at roughly one render in eight. **Inspect every plate before compositing.** Any legible word in the generated pixels means discard and regenerate, not patch over.

## Per-concept properties to store

Format and sub-type are per-concept properties, not global settings. Record for each asset:

| property | values |
|---|---|
| awareness | problem_unaware / solution_aware |
| sub_type | grounded / esoteric / aspirational |
| format | static / carousel |
| native_ratio | 4:5 / 9:16 / 1:1 |

If these are not stored per concept, the diversity structure exists in this document and nowhere in the pipeline.
