# ZAP Warm-Beta — Known Limitations

**Date:** 2026-05-16
**Production SHA:** `0f4e080`
**Status:** SAFE FOR WARM BETA — WITH CONTROLS
**This is not a public-beta release.** Cohort access only.

This document is the canonical record of what ZAP **does not yet do**
at the warm-beta lock. Every limitation here is a deliberate, accepted
trade-off — not an unknown bug. Each entry classifies whether the
limitation is **acceptable for warm beta**, **post-beta backlog**, or
a **launch blocker for public beta**.

---

## Core mental model

> **ZAP drafts. The operator finishes.**

The system is an AI-first marketing-asset drafter, not an autonomous
publisher. The warm-beta gate (the PlaceholderBanner) exists precisely
to enforce this contract: every kit must pass through human review
before it touches Meta, GHL, or a live audience.

If an operator treats ZAP as fully autonomous and pushes kits
unreviewed, that operator is outside the supported usage envelope for
this release.

---

## L1 — Canonical placeholders are intentional

**What it is.** The offer / LP / email / WhatsApp generators emit
canonical `[INSERT_X]` tokens (e.g. `[INSERT_PRICE]`,
`[INSERT_GUARANTEE_TERMS]`, `[INSERT_COHORT_START_DATE]`,
`[INSERT_COHORT_LIMIT]`, `[INSERT_PROGRAMME_DURATION]`,
`[INSERT_RESULT_AMOUNT]`, etc.) whenever the operator did not supply
the underlying fact during service / ICP / source-of-truth setup.

**Why it is intentional.** Pre-Phase-1, the model invented these
facts. Inventing a price, a guarantee window, or a cohort start date
is a launch-blocker fabrication per `docs/redteam-failure-taxonomy-v1.md
§2`. Phase D Sprint 1 hardened the offer generator to **refuse to
invent** and instead emit the canonical operator-fill token. Sprint 2
extended the same discipline to LP testimonials. Sprint 3 added the
UX layer (PlaceholderBanner) that surfaces these tokens to operators
before publish.

**What operators see.** A kit-level banner counting placeholders +
per-asset breakdown + "Review & Complete →" CTA. A pre-push modal
warning + "← Review on kit page first" back button. Self-hides on a
clean kit.

**Classification.** Acceptable for warm beta. Core feature, not a bug.

---

## L2 — Retry-exhaust ships content as best-effort

**What it is.** The offer generator (`server/offersGenerator.ts`) and
the LP generator (`server/landingPageGenerator.ts`) both run a
3-attempt retry-with-failContext loop. On each attempt the validator
checks for fabrication-pattern hits. If hits remain after attempt 3,
the content is **persisted as best-effort** with a `console.warn`
diagnostic log dump (top hits, classes, locations).

**Why this exists.** The alternative is unbounded retries or a hard
failure that strands the orchestration cascade. Best-effort
persistence + diagnostic log is the same exhaust shape used by
`landingPageGenerator` LP testimonials (since Sprint B+1), C1.1 ad
headlines length validator, and now Sprint 1 offers.

**What operators see.** Nothing in the UI — the banner only catches
canonical `[INSERT_X]` tokens, not exhaust-shipped fabrications.
Operators must rely on the warn-level log surface + their own
content review.

**Expected exhaust rate.** Per the v2 baseline forensic (15 fixtures,
post-Sprint-1), offer exhaust rate was effectively zero across all 9
in-scope fabrication categories. If production exhaust rate exceeds
**5% of generations in any 24h window**, halt the cohort and
investigate (see launch checklist §6.1).

**Classification.** Acceptable for warm beta with the operator-review
gate (PlaceholderBanner) and warn-log monitoring. **Launch blocker
for public beta** unless rate is verifiable at <0.5%.

---

## L3 — Phase D hardening is scoped to offer + LP testimonials only

**What it is.** Phase D Sprints 1 and 2 hardened two generators:
- `offersGenerator.ts` — full retry-with-failContext + canonical token
  allow-list + 12-class fabrication catalog
- `landingPageGenerator.ts` — added `archetypal_name_with_location_detail`
  testimonial pattern to the existing LP retry loop

**What is not yet hardened to the same standard:**

| Generator | Schema validator | Phase-D-style retry+failContext |
|---|---|---|
| `emailSequenceGenerator` | ✅ Validator Phase 1+2 (shape + email fabrication patterns) | ❌ No prompt fortification pass |
| `whatsappSequenceGenerator` | ✅ Validator Phase 1+2 | ❌ No prompt fortification pass |
| `adHeadlinesGenerator` | ✅ C1.1 length validator (Phase 2 prompt fortification done) | Partial — length only, no fabrication catalog |
| `adCopyGenerator` | ✅ Schema | ❌ No fabrication catalog |
| `hvcoGenerator` (lead magnet) | ✅ Schema | ❌ No fabrication catalog |
| `heroMechanismGenerator` | ✅ Schema | ❌ No fabrication catalog |
| `adCreativesGenerator` (C1 cascade step) | ✅ Schema | ❌ No fabrication catalog |

**What this means in practice.** The PlaceholderBanner surfaces
canonical `[INSERT_X]` tokens across all 9 asset types — so operator
review still catches the high-signal "AI invented your price" class
of slips. But other fabrication classes (made-up statistics,
fabricated case-study results, invented quotes) in the un-hardened
generators rely on schema validation only — no retry-with-failContext
pressure.

**Classification.** Acceptable for warm beta under the operator-review
gate. **Phase E backlog** to apply Sprint-1-grade hardening to the
remaining 7 generators.

---

## L4 — No v3 forensic baseline post-Sprint-2

**What it is.** The `docs/redteam-audit-baseline-v2.md` baseline was
captured post-Sprint-1 (commit `f324018`) and froze 9 of 10
fabrication categories at 0/15. The remaining slip
(`lp_testimonial_archetypal_with_location` at 1/15) was explicitly
flagged as Phase 2 scope.

Sprint 2 added the validator pattern + 5 unit tests confirming it
catches the v1 kit-13 + v2 baseline fixture 01 patterns. The wiring
into `landingPageGenerator.ts` is verified by reading the retry-loop
code, but **no fresh 15-fixture forensic harness was executed
post-Sprint-2** to capture a v3 baseline.

**What this means.** The "0/15 archetypal" claim is currently
**inferential from structural unit tests + retry-loop wiring**, not
forensic-harness-confirmed.

**Mitigation in place.** The validator fires inside the retry loop
with failContext injection. Tests confirm the catalog catches all
known patterns. The probability of a regression slipping through is
low but not zero.

**Classification.** Acceptable for warm beta. **Launch blocker for
public beta** until v3 forensic baseline confirms 0/15.

---

## L5 — Mid-cascade redeploy still strands jobs at `running`

**What it is.** Memory note `project_reaper_option_alpha_gap` —
Railway redeploys during an Auto Mode cascade can leave orchestration
jobs at `status='running'` forever. Manual recovery via
skip-populated resume is validated.

**What this means for warm beta.** If Railway deploys mid-cohort,
some kits may stall. Support must run the Option-α resume manually.

**Mitigation in place.** Documented support procedure (launch
checklist §5.1 + §8). Memory note carries the recovery steps.

**Classification.** Acceptable for warm beta with support coverage.
**Post-beta backlog** to make the reaper auto-recover stranded jobs.

---

## L6 — Detector edge cases

**What it is.** `client/src/v2/lib/placeholderDetector.ts` uses the
regex `/\[INSERT_[A-Z_0-9]+\]/g`. It does **not** match:
- Lowercase variants (`[insert_price]`) — by design; generators only
  emit uppercase
- Variants with hyphens (`[INSERT-PRICE]`) — by design; canonical
  spec uses underscores
- Wrapped tokens (`{[INSERT_PRICE]}`) — by design; canonical form is
  unwrapped
- Tokens inside markdown code fences if the storage representation
  escapes brackets — not observed in current generator output

**What this means.** A generator that goes off-spec and emits a
non-canonical placeholder shape will slip past the banner. Validator
catalog catches the underlying fabrication (e.g. price-currency-amount)
even if the placeholder shape is wrong, but it would not show up in
the kit banner count.

**Classification.** Acceptable. Phase D Sprint 1+2 validators are the
ground-truth fabrication gate; the detector is a UX surface on top of
the canonical-token contract.

---

## L7 — Out-of-scope content classes

ZAP at warm-beta lock does **not** attempt to:
- Make legal / medical / financial claims compliant for any
  jurisdiction beyond `META_COMPLIANCE_NOTES` injection
- Generate factual research statistics or citations
  (`NO_RESEARCH_STATISTIC_FABRICATION_RULE` is injected into LP prompt)
- Generate dated content (`NO_DATE_FABRICATION_RULE` injected into LP
  prompt)
- Generate ad creative video / image content (creatives use Pexels
  + Creatomate / ElevenLabs / Replicate; not in Phase D scope)
- Translate or localize assets to non-English languages

Operator working in any of these areas must do their own compliance
pass before publishing.

**Classification.** Out of scope for warm beta. Documented operator
behaviour expectation.

---

## L8 — Nurture-builder vague-urgency residual (cross-cutting email + WhatsApp)

**What it is.** The email + WhatsApp nurture sequence builders produce
a small number of vague-urgency phrasings — `"next cohort"`,
`"enrolment closes"` — in message bodies without a canonical
operator-fill token to anchor them. Quantified evidence:

- Email v2 baseline (`docs/redteam-email-baseline-v2.md`, post Phase E
  Sprint 2 `bd67189`): 21 MI in this class out of 27 total residual
  MI (78%). Concentrated in nurture (18 of 27) + engagement / welcome
  / launch / re-engagement.
- WhatsApp v2 baseline (`docs/redteam-whatsapp-baseline-v2.md`, post
  Phase F Sprint 2 `d1fb883`): 3 MI in this class out of 3 total
  residual MI (100%). Concentrated in nurture (2) + engagement (1).

**Why it persists.** The nurture builders' canonical-token allow-lists
**intentionally exclude** cart/cohort tokens
(`[INSERT_COHORT_CLOSE_DATE]`, `[INSERT_CART_CLOSE_DATE]`,
`[INSERT_DEADLINE]`). Nurture is a non-event-anchored format
(Russell Brunson Soap Opera Sequence, anchored to a lead-magnet
download — not a cart-close window). The LLM occasionally generates
vague-urgency phrasings to create momentum toward the lead-magnet CTA;
the validator catches the pattern, retry-with-failContext fires, but
the LLM has no canonical token to substitute — so retry exhausts and
content ships best-effort with diagnostic `console.warn` logs.

**Why it's not closed by Phase E + F hardening.** Both Phase E Sprint 2
(email) and Phase F Sprint 2 (WhatsApp) added validator catalog parity
+ system-prompt symmetry. Both substantially reduced MI rates (email
71→27, WhatsApp 8→3). The 3 WhatsApp + 21 email residuals share this
single class because closing it would require a **builder-architecture
decision**: introduce a canonical operator-fill token for nurture's
"imagined-future-deadline" framing so the LLM has something to emit
verbatim instead of vague-urgency phrasings. That's nurture-builder
scope work, not validator hardening.

**Classification.** Same lane as L1 (operator-fill philosophy — AI
drafts, operator finishes). L1 covers the cases where a canonical
token IS emitted and PlaceholderBanner catches it; L8 covers the
nurture-specific case where no canonical exists and the operator
content-review surface is the guardrail. Operationally:

- Banner does **not** surface these — no `[INSERT_X]` is emitted.
- Operators must content-review nurture sequences before push (same
  expectation as L2 retry-exhaust review).
- The vague phrasings are non-fabricated in the strict sense (no
  invented date, no invented number) — they're imprecise framing
  that the operator should rewrite to point to their actual
  lead-magnet timing or omit the urgency.

**Acceptable for warm beta** with the operator-content-review surface.
Public-beta gating would require either (a) a builder-architecture
fix to introduce nurture cart-anchor canonicals, or (b) a measured
exhaust rate <0.5% on the class (currently ~3% on WhatsApp, ~14% on
email nurture).

**Tracking.** Cross-cutting registration logged 2026-05-24 post Phase F
closure. Address-or-defer decision deferred per the standing post-Phase-F
instruction; not a warm-beta blocker.

---

## Expected operator behaviour

A cohort operator using ZAP correctly will:

1. Complete service / ICP / source-of-truth setup with **real
   business facts** — price, guarantee terms, cohort cadence,
   programme duration, real customer names if using testimonials.
2. Trigger Auto Mode and wait for the 9-step cascade to complete.
3. Land on the kit page and **read the banner first** if present.
4. Click "Review & Complete →" and fill in every `[INSERT_X]` token
   that appears in the affected assets.
5. Re-check the banner — if count > 0, repeat. If self-hidden,
   proceed to push.
6. In the push modal, if the compact warning appears, click "Review
   on kit page first" and complete the loop above.
7. Push to Meta / GHL only when the kit is clean.

Operators who skip steps 3–6 are outside the supported envelope.

---

## What this document is not

- Not a feature roadmap.
- Not a public marketing document.
- Not a contract or SLA.
- Not exhaustive — only the **known** limitations are listed. Unknown
  unknowns are the reason this is a warm-beta cohort, not a public
  release.

---

## Update protocol

This document is frozen at the warm-beta lock (`0f4e080`) for the
cohort window. Pre-cohort post-Phase-D additions (L8, registered
2026-05-24 post Phase F Sprint 2 closure) are folded in here directly
because the cohort hasn't opened yet — the freeze applies to cohort-
active edits only.

Once the cohort opens, do not edit this document during the cohort
window. If a new limitation is discovered during warm beta, log it in
the support ticketing system and append a sibling document
`docs/warm-beta-discovered-limitations-YYYY-MM-DD.md`. The next
post-beta planning cycle merges the two and produces the next
versioned snapshot.
