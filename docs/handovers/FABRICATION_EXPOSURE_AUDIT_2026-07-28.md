# Pre-existing fabrication exposure — fleet-wide audit, 2026-07-28

**Read-only. Nothing was modified or deleted.** Run with
`scripts/fabrication-e2e-audit.ts all` and `scripts/fabrication-precision-probe.ts`.

## 🔴 Read the precision caveat before quoting any number

The first pass returned **4,109 blocking hits** and that figure is **misleading**. Quoting it as
"4,109 invented claims" would be exactly the fake precision `META_AD_COMPLIANCE_REFERENCE.md`
warns against. Two corrections were needed before the number meant anything.

**Correction 1 — two different layers were being added together.** Of 4,109: **3,010 fabrication**
(did the model invent this?) and **1,099 compliance** (does this read like a claim Meta polices?).
They answer different questions and must not be summed.

**Correction 2 — the detector was over-firing, and the audit caught it.** Frequency analysis showed
systematic false positives immediately, because a bad rule repeats the same string across unrelated
services:

| False positive | Hits | Cause |
|---|---|---|
| `"coaching business"` | 326× | `business` was in `PERSON_NOUNS` — an organisation is not a person served |
| `"Our ideal customer"` | 179× | audience description, not a track record |
| `"one person"` | 158× | `person`/`people` too generic to be a client count |
| `"two kids"` | 67× | the CLIENT'S dependants, not the coach's clients |
| `"First Resequencing Method"`, `"Ballpark Reframe Protocol"` | many | the coach's own MECHANISM names read as third-party endorsements |
| `"Enrolment is now"` | 6 services | `is now` was too weak an outcome verb — scheduling copy, not a result |

**All fixed this session.** Fabrication hits fell **3,010 → 1,825 (−39%)** with **zero** test
regressions (38/38 fabrication, 382/382 pipeline, TS 35).

⚠️ **This is a finding about the detector I shipped, not just about the content.** A 12-string
held-out corpus could never have surfaced it; only fleet scale did. The persistence gate is live,
so these false positives would have dropped legitimate rows.

## Scale, after correction

| | |
|---|---|
| Services in prod | **124** |
| Services with ≥1 fabrication hit | **78 (63%)** |
| Content rows screened | **15,586** |
| Fabrication hits | **1,825** |
| Compliance hits (separate layer) | **1,099** |

**By class (post-fix):** `invented_statistic` 710 · `unearned_authority` 850 ·
`invented_named_third_party` 135 · `invented_testimonial` 129 · `invented_guarantee` 1.

**By table (pre-fix distribution):** adCopy 2,243 · hvcoTitles 771 · heroMechanisms 646 ·
headlines 402 · landingPages 46 · offers 1.

**Worst services:** service 1 (734) · 181 (380) · 232 (258) · 198 (246) · 205 (203) · 210 (183).

**Honest residual estimate: roughly 1,300–1,600 genuine invented-proof claims.** `invented_statistic`
and the client-count half of `unearned_authority` look largely real; `invented_testimonial` and
`invented_named_third_party` still carry a meaningful false-positive share (Title-Case fragments
like `"Live Training"`, `"Get Instant Access"`). **This is an estimate, not a measurement** — a
hand-classified random sample would be needed to state it properly.

## The worst confirmed examples

- **`"According to Dr. Sarah Chen"` / `"Sarah Chen"` (15 hits, 1 service)** — a **fabricated named
  expert with a title, presented as a citation**. The single most serious item found.
- **`"Hundreds of successful clients"` (76 hits, 5 services)** — the exact phrase
  `offersGenerator` used to instruct the model to produce when no data existed. That prompt
  instruction was removed this session; **this is its historical output, still stored.**
- **`"28 students"`, `"8 clients"`, `"three clients"`, `"two students"`** — specific client counts
  for coaches whose supplied material carries no such figure.
- **`"a SaaS founder £600/day for a design sprint and he came…"`** — a complete invented case study
  with a named price.
- **Percentages across 19 services** — `40%` (122×), `15%` (102×), `20%` (57×), `4.2%` (51×).

## What this does NOT tell us

- **Nothing here is a Meta violation finding.** Invented proof is ZAP's own honesty standard; its
  nearest Tier-1 anchor is §1.6 deceptive practices, which is broad and unenumerated.
- **Published ≠ generated.** Most of this content sits in decks that were never selected or
  published. Exposure to a real audience is a **subset** of these numbers and was not measured.
- No content was changed. Deciding what to do — leave, regenerate, or suppress on next edit — is
  Arfeen's call.

## Recommended next step

Measure **published** exposure before anything else: restrict the audit to assets that are actually
live (landing pages with a `publicUrl`, ad copy pushed to Meta). That is the number that matters,
and it is a small, cheap query on top of what already exists.
