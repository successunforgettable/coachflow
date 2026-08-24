# Lead-magnet research — source material for the Node 5 standard

**Banked 2026-08-24.** Six commissioned NotebookLM B2C reports, copied verbatim from
`~/Downloads` (checksums verified against the originals). This folder is the same shape as
`docs/offer-research/` and `docs/bonus-research/`.

Three things, and they are the whole point of this file.

---

## 1. These are the SOURCE RESEARCH for the Node 5 (Lead Magnet / HVCO) standard

They close the gap recorded in `docs/handover/CHECKPOINT_2026-08-23_LEADMAGNET_RESEARCH_GAP.md`,
which found that no lead-magnet research existed anywhere on this machine and that the
*"research-backed quality bar"* the July delivery checkpoints cite was never written down. The
formats shipped in July therefore rested on an asserted standard. **These reports are the sourced
one.**

| File | Read it for |
|---|---|
| `b2c-lead-magnet-formats.md` | Which format to pick, and why, for a B2C consumer audience |
| `constructing-the-promise.md` | The offer/promise the magnet makes at the opt-in |
| `lead-magnet-depth-and-length.md` | Per-format sizing, minimum substance, the homework threshold |
| `the-bridge-to-the-next-step.md` | The dead-end failure mode; loop-splicing; the back-page CTA |
| `grounding-practitioner-methodology.md` | **Teach the WHAT, not the HOW** — the magnet is the coach's own method in miniature |
| `failure-modes-compliance-language.md` | Why B2C magnets fail; safe value language |

⚠️ **HVCO is our internal name for the lead magnet** (High-Value Content Offer). The codebase, the
DB (`hvcoTitles`, `hvcoTopic`) and the older docs use it. Search both terms, always.

---

## 2. 🔴 EVERY STATISTIC IN THESE REPORTS IS UNVERIFIED

The frames and the mechanisms are sound and are what these were commissioned for. **The numbers
are not.** NotebookLM's bracketed citations point at its own source set, not at anything audited
here — no figure below has been traced to a primary source.

**No statistic from this folder may ever reach:**

- a prompt (system or user), or any rule file a prompt interpolates;
- a UI string, tooltip, help text or coach-facing label;
- generated copy of any kind — magnet body, landing page, ad, email.

This is not a style preference. It is the anti-fabrication layer: a fabricated number in generated
copy is exactly the class of claim `_core/complianceAxis.ts` and the persistence gate exist to
catch, and a number that arrives through a *prompt* is laundered past every one of those checks.

**Structural guidance is usable; the number attached to it is not.** "A checklist is short and
scannable" is usable. "Every question past 12 drops completion by 5–8%" is not — not as a rule,
not as a comment justifying a constant, not as a coach-facing tooltip. Where a report's sizing
band is adopted as an implementation limit, it is adopted as **our engineering decision**, and the
justification written into the code is our own reasoning, never a cited figure.

Same discipline as `docs/offer-research/README.md` applies to its two B2B-contaminated reports:
**keep the framework, discard the payload.**

---

## 3. The standard itself lives OUTSIDE this repo

Unlike `docs/offer-research/README.md`, this file is **not** the standard. The written Node 5
standard was authored from these six reports and lives **outside the repo**, alongside the other
strategy documents in the Claude project (`ZAP_Node_Research_Coverage_Map`,
`ZAP_Research_Workflow`, `ZAP_Offer_Standard`) — see `CHECKPOINT.md`, "Strategy docs live in the
Claude project, NOT the repo".

**Consequence for a cold session:** these six files are the grounding, not the specification. Do
not reconstruct the standard by inference from them, and do not treat this README as an authority
on what Node 5 must produce. Ask for the standard.
