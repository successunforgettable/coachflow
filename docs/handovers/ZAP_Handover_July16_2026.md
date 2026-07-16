# ZAP Handover — 2026-07-16 (LP craft sweep + structural rebuilds; ROOT CAUSE = corrupt specs)

**Status: WIP pushed for crash-safety, NOT signed off. Arfeen's visual review of the six side-by-sides in `craft-review/` is the gate.** Gates green: TS 35 / vitest 478.

---

## 🔴 ROOT CAUSE FOUND — the replication specs were corrupt

Three replication specs contained **prose that contradicted their own frozen PNGs**, and every downstream artifact faithfully implemented the lie:

| Spec | Prose said (FALSE) | Frozen PNG actually is |
|---|---|---|
| Iman (`..Faceless_Product_Launch..`) | "one integrated poster… not a chain of funnel sections" | 4480×**13966** — a full ~8-section page |
| Rajsekar (`..AI_Coaching_Workshop..`) | "unusually compact, overwhelmingly white, coral, blue-outlined card" | 4480×**23788** — navy hero / purple / alternating bands |
| Ali (`..YouTube_Creator_Course..`) | "green CTA" (×5) | sky-blue `#5DCDF1` CTA |

The wrong prose propagated into: the **template**, its **unit test**, **CLAUDE.md**, the **template header comment**, and the **handovers**. Iman shipped at **0.48×** reference height and webinar at **0.54×** — and BOTH passed their own structural gates, because the gate checked against the lie. All three specs now carry a ⚠️ **PROSE-VS-PNG correction banner**.

### §15a Reference Truth Invariant (now law in CLAUDE.md)
**The frozen PNG is the SOLE source of truth for any reference. Spec prose is secondary and must be reconciled to the pixels — NEVER the reverse.** Before building or judging against any spec, verify its prose against the PNG. Any future spec must be written from the PNG, and re-reconciled if the capture is replaced.

---

## KEY LEARNING: craft ≠ structural PASS ≠ identical
Automated gates passed **twice** on pages that were structurally half-missing (Iman, webinar). A structural/self-judged PASS is worthless if judged against a misread. **Arfeen's eyes on the actual render are the only real design gate** — judge the render against the PNG itself, section-by-section, every time.

## THE FIXTURE FAILURE (3 occurrences — do not repeat)
Renders were judged against junk three times: (1) flower stock photos, (2) a Rick Astley YouTube video, (3) grey placeholder boxes. **Never judge visual fidelity through placeholder junk.** An honest fixture now lives in `scripts/craft-audit.ts`: real professional headshot (2:3), real 16:9 workshop scene, real audience-wall, a real *designed* magnet cover (navy+orange+title), and a neutral open-source video (Big Buck Bunny — a real, non-joke embed). Production swaps in the coach's own assets.

---

## What landed this session (all WIP, pending visual approval)

**Fonts corrected across ALL FIVE templates** (every one had the wrong typeface — the #1 "tacky" cause):
- Burchard + Discovery: Figtree → **Fira Sans** (headings) + **Open Sans** (body)
- Iman: Montserrat → **Inter** (Inter Display via tight tracking)
- Hormozi: Inter → **Poppins** + **Arial** (buttons/inputs)
- Rajsekar (webinar): Poppins-both → **Poppins** headings (Univia Pro match) + **Outfit** body
- Ali (sales): Inter body → **Hanken Grotesk** (Elza match); **Fraunces** kept as the Recoleta match; CTA green → **sky-blue `#5DCDF1`**

**Two structural REBUILDS** (were built to corrupt specs):
- **Iman** 0.48× → **1.01×**: added agenda (Day 0N) → All The Details → Cost of Doing Nothing vs Joining → What's Included grid → Register CTA. Honesty: never the $250K/McLaren/Rolex prize pool; all real-or-nothing.
- **Webinar** 0.54× → **0.69×**: navy-hero + presenter portrait re-layout, dedicated video section, alternating band rhythm (navy/white/navy/lavender/white/mint/white/lavender/navy), dark framework w/ large numerals, "Who is this class for?" lavender closer.

**Four FIXES:**
- Burchard 1.61× → **1.32×**, Discovery 1.42× → **1.22×** (density tightened; uncramped; residual is the reference's denser typography, not padding).
- Hormozi 0.85× → **0.87×**: real torn-paper divider edges, enriched numbered deliverable cards (honestly text-first — no per-deliverable image source), proof already threaded ([0,3]+[3,6]).
- Sales 0.41× → **0.45×**: interleaved proof strips between content sections (reference rhythm); distinct real testimonials, no repeats/fabrication.

**Latest fixture/defect round (real imagery):** fixed webinar hero (navy confirmed by pixel-sample — "green" was a misread; presenter now a 4:5 portrait, not an audience box); Iman presenter reproportioned (62% width so the audience wall frames it); all grey composites → real cover/photos/video.

### Height ratios vs reference (ours ÷ reference, normalized to 1280px width)
Burchard **1.32×** · Discovery **1.22×** · Webinar **0.69×** · Iman **1.01×** · Hormozi **0.87×** · Sales **0.45×**.
Sub-1.0× residuals are **honest content-volume gaps** (real-or-nothing testimonials/modules — a coach has ~6 testimonials, not the reference's dozens), NOT missing structure. Every template now maps section-for-section to its PNG.

---

## Infra state
- Migrations **0084–0088 all applied + typed** (booking_url, video_url, checkout_url are typed Drizzle columns); **0081 superseded — never apply**.
- **impeccable** design skill installed project-scoped (`.claude/skills/impeccable/`, gitignored, **no hook**) — a generic craft floor only; it CANNOT detect reference mismatch, so it never replaces the PNG gate.

## 🟢 RESUME POINT
1. **Arfeen re-reviews all six `craft-review/final-*` side-by-sides** (real fixtures). That is the design gate — nothing ships without it.
2. **Open defect carried:** the webinar hero presenter is a **framed rectangle**; the reference is a **free-standing cutout** — same issue on Iman (rectangular photo over the audience wall, not a cut-out figure). See the open product question below (it's not a fixture artifact).
3. After visual approval → the **conversational operator-intake sprint** (three tiers, Zappy-led, one ask at a time, skippable — a CONVERSATION not a form; locked vision in `project_operator_capture_conversational_intake.md`).
4. Then the **batched live-proof pass** (discovery + webinar + event + sales together — needs `execute`).
5. Then **Auto Mode orchestration**.

## 🔴 OPEN PRODUCT QUESTION (important — decide before launch)
The reference heroes (Iman presenter, webinar presenter, Burchard composite) use **transparent CUTOUT presenters** — free-standing figures over a background. **Real coaches will upload rectangular photos, not cut-outs.** So the "framed rectangle" we see is NOT a fixture artifact — **it is what production will look like.** This needs the magnet-cover treatment:
- **auto-derive a cutout** (background removal on the coach's uploaded headshot — the Cloudinary/AI equivalent of the PDF-page-1 magnet-cover derivation), **or**
- **design the heroes so a rectangular photo looks right** (framed portrait treatment that reads as intentional, not a fallback).
Related: other reference assets a blank-slate coach won't have (audience wall, designed composites) need the same rule — real content, a graceful branded fallback, or graceful omit; **NEVER a grey box.**
