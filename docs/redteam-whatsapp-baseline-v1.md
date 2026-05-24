# WhatsApp Generator Red-Team Baseline — v1

**Status: HISTORICAL BASELINE — PRE-HARDENING STATE.** Captures the WhatsApp generator's fabrication behaviour BEFORE Phase F Sprint 2 hardening. Locked at production SHA `73110bf` (harness extension head — generator code unchanged from `7c1b4b2`). Frozen at v1.

**Methodology continuity:** identical 15-fixture matrix, classifier taxonomy, severity taxonomy, and pass/fail thresholds as the email + offer/LP baselines. All v3-corrected methodology fixes applied (token-override in classifier, full-operator-context cross-check, CTA token allow-list).

---

## 1. Audit metadata

| | |
|---|---|
| Production SHA audited | `73110bf` (harness extension + forensic map; generator unchanged from `7c1b4b2`) |
| Fixtures | 15 realistic-coach-adjacent (identical to email + offer/LP baselines) |
| WhatsApp sequence types | 6 (engagement, sales, nurture, discovery_call_confirmation, discovery_call_reminder, event_logistics) |
| Total WhatsApp generations | 90 (15 × 6) |
| Captured | **90 / 90 (100%)** |
| Generation failures | **0 / 90 (0%)** |
| Harness | `tools/redteam-harness.ts` γ' block (REDTEAM_WHATSAPP_PHASE=1 gated) |
| Archive | `tools/redteam-baseline/baseline-whatsapp-v1-2026-05-24/` |
| Execution date | 2026-05-24 |
| Wall-clock | ~3 h 30 m |
| LLM cost | ~$10 (well under the $50 hard cap) |

---

## 2. Headline result — v1 is clean enough to flip Phase F scope expectations

**8 MODEL-INVENTED findings across 90 generations = 0.09 MI/generation.**

Compare to email v1 (same fixture set, pre-Sprint-2): 71 MI / 136 successful generations = 0.52 MI/gen. **WhatsApp v1 is ~6× cleaner than email v1.**

Three factors plausibly explain the gap:

1. **Smaller surface per message.** WhatsApp prompt rule "maximum 3 sentences per message" + ~30-100 words per message vs email body's 200-400+ words. Less narrative real estate where fabrication-prone framings naturally land.
2. **Detailed per-builder PLACEHOLDER ALLOW-LIST blocks already exist.** The sales builder (`whatsappSequenceGenerator.ts:337+`) carries an explicit ANCHOR PLACEHOLDERS section listing 8 canonical tokens + a SPECIFICALLY FORBIDDEN list. Without validator catalog parity (LB-W2), the prompt-level guidance does most of the work the validator would otherwise do.
3. **6 sequence types × ~30 messages per fixture** vs email's 10 types × 43 messages — smaller total output volume per fixture, fewer fabrication opportunities.

The result reshapes Phase F Sprint 2 scope expectations significantly. See §6 below.

---

## 3. Findings by category (raw counts)

### 3.1 WhatsApp findings (γ' v3-corrected classifier)

| Category | Raw hits | Classification |
|---|---|---|
| `placeholder_leakage` | 474 | INTENDED (canonical operator-fill emission) |
| `fabricated_next_cohort_date` | 17 | mix (see §3.2) |
| `fabricated_pricing_currency_amount` | 11 | mix (see §3.2) |
| `fabricated_guarantee_timeframe` | 3 | all MI |
| `lp_archetypal_in_whatsapp` | 1 | classified non-MI |
| `fabricated_event_context` | **0** | **none — LB-W5 did not materialize** |

### 3.2 Classification breakdown

| Classification | Count |
|---|---|
| INTENDED | 474 |
| UNCERTAIN | 13 |
| USER-SUPPLIED | 11 |
| **MODEL-INVENTED** | **8** |

### 3.3 Offer+LP findings (audit re-run for cross-version reference)

The offer+LP audit fires alongside WhatsApp (same harness, audit() function — not the γ' WhatsApp audit). Numbers:

| Category | v1 (this run) | v2 baseline-email-v2 reference | Δ |
|---|---|---|---|
| placeholder_leakage (offer+LP) | 371 | 354 | +17 (within run-to-run variance) |
| fabricated_next_cohort_date | 32 | 27 | +5 |
| fabricated_pricing_currency_amount | 31 | 28 | +3 |
| fabricated_specific_refund_mechanic | 1 | 0 | +1 |
| fabricated_guarantee_timeframe | 1 | 1 | 0 |
| fabricated_anchor_price_range | 1 | 0 | +1 |

Offer + LP findings are statistically consistent with the Sprint 2 baseline-v2. No regression introduced by the harness extension.

---

## 4. The 8 MODEL-INVENTED findings — verbatim evidence

All 8 fit on this table:

| # | Sequence type | Field / msg index | Category | Evidence |
|---|---|---|---|---|
| 1 | sales | message msg0 | `fabricated_guarantee_timeframe` | `"in 90 days"` |
| 2 | engagement | message msg1 | `fabricated_guarantee_timeframe` | `"within 10 days"` |
| 3 | engagement | message msg1 | `fabricated_guarantee_timeframe` | `"in 11 weeks"` |
| 4 | sales | message msg2 | `fabricated_next_cohort_date` | `"Enrolment closes"` |
| 5 | sales | message msg0 | `fabricated_next_cohort_date` | `"enrolment closes"` |
| 6 | nurture | message msg4 | `fabricated_next_cohort_date` | `"next cohort"` |
| 7 | nurture | message msg4 | `fabricated_next_cohort_date` | `"next cohort"` |
| 8 | engagement | message msg2 | `fabricated_next_cohort_date` | `"next cohort"` |

**100% in message bodies, 0% in CTAs.** Two semantic classes only: vague-urgency phrasings (next cohort / enrolment closes) and guarantee-timeframe verbiage (in N days/weeks). Same residual classes Phase E left at email v2 (R-1 nurture vague-urgency).

**Per-sequence-type distribution:** sales 3, engagement 3, nurture 2. The 3 short event-anchored types (discovery_call_confirmation, discovery_call_reminder, event_logistics) produced **0 MI**.

---

## 5. Retry-loop behaviour

| Metric | Count |
|---|---|
| WA shape retries (sub-case fired, retry succeeded) | **2** |
| WA shape exhausts (Bridge B dump fired) | **0** |
| WA fab retries (catalog hit, retry succeeded) | **7** |
| WA fab exhausts (best-effort persistence) | **1** |
| Total generation failures | **0** |

**Shape: 2 retries, 0 exhausts.** The `messages_string_unrecoverable` sub-case that hit email v1 65× did not fire on WhatsApp. Two retries fired on other shape sub-cases (likely Python-dict or empty-array variants) and recovered cleanly.

**Fab: 7 retries → 1 exhaust.** Retry-with-failContext recovers 6 of 7 fab hits. The single exhaust shipped best-effort — likely one of the 8 MI findings above.

---

## 6. Per-LB closure assessment vs forensic-map predictions

Predicted (forensic map §3) vs measured:

| Gap | Forensic prediction | v1 measurement | Updated severity |
|---|---|---|---|
| **LB-W1** shape sub-case 3a missing | RECURRING→SYSTEMIC, 3-12 shape exhausts | **0 shape exhausts**, 2 retries | **EDGE CASE — not a real gap on this fixture set.** Architecturally right to port (~15 LOC, low risk) but not blocking. |
| **LB-W2** catalog parity vs offer/email | SYSTEMIC, 35-65 pricing MI | **0 pricing MI** (all 11 raw hits classified USER-SUPPLIED or UNCERTAIN via token-override + operator-context) | **RECURRING (downgraded).** The 8 MI come from cohort-date (5) + guarantee-timeframe (3) which the catalog WOULD catch. Still warranted but smaller than predicted. |
| **LB-W3** system-prompt symmetry | RECURRING, 15-35 guarantee MI | **3 guarantee MI** | **RECURRING (smaller).** The 4 categories these rules would suppress (credentials, research stats, refund mechanics, hedging) had near-zero MI in v1. Architecturally right to inject (~12 LOC) but cosmetic given current baseline. |
| **LB-W4** archetypal-in-body | EDGE→RECURRING, 0-2 MI | **0 MI** (1 raw → classified non-MI by USER-SUPPLIED cross-check) | **EDGE CASE.** Detector works; no production fabrication of this class. Port for future-proofing only. |
| **LB-W5** event-framing default (WA-specific) | SYSTEMIC for non-event services | **0 findings, period** | **NOT A REAL GAP at this fixture set.** Three possible explanations: (a) prompt-level ANCHOR PLACEHOLDERS guidance suppresses event hallucination on non-event services; (b) regex too narrow vs actual LLM phrasing; (c) fixture set lacks the right shape to exercise it. Sprint 2.5 audit concern was a forensic-map prediction, not a measured failure. **Pursue only if production evidence contradicts this.** |

---

## 7. Per `docs/redteam-failure-taxonomy-v1.md §3` thresholds

| Category (per-fixture) | Tolerable | v1 actual | Verdict |
|---|---|---|---|
| Pricing currency | ≤1/15 | 0/15 MI | ✅ PASS |
| Anchor price range | ≤1/15 | 0/15 | ✅ PASS |
| Bonus value | ≤1/15 | 0/15 | ✅ PASS |
| Total value | ≤1/15 | 0/15 | ✅ PASS |
| Cohort limit | ≤1/15 | 0/15 | ✅ PASS |
| Programme duration | ≤1/15 | 0/15 | ✅ PASS |
| Guarantee timeframe | ≤1/15 | 3/15 = 20% | ⚠ RECURRING |
| Specific refund mechanic | ≤1/15 | 0/15 | ✅ PASS |
| Next cohort date | ≤1/15 | 5/15 = 33% | ⚠ RECURRING |
| Placeholder leakage (banned) | 0/15 | 0/15 | ✅ PASS |
| LP-archetypal-in-WhatsApp | 0/15 | 0/15 MI | ✅ PASS |
| `fabricated_event_context` (LB-W5) | (new class) | 0/15 | ✅ PASS |

**10 of 12 categories PASS.** 2 categories ⚠ RECURRING (guarantee-timeframe + next-cohort-date) — same residual classes email v2 left in nurture/engagement. These are the only patterns the Phase F Sprint 2 hardening needs to close materially.

---

## 8. Phase F Sprint 2 scope recommendation (for your scope-lock review)

Based on v1 measurement, NOT forensic prediction. Updated severity-weighted scope:

### Material-impact items (close to flip the 2 ⚠ categories to ✅)

| Item | LOC | Material impact | Recommend |
|---|---|---|---|
| **LB-W3** — inject `NO_CREDENTIAL_FABRICATION_RULE` + `NO_RESEARCH_STATISTIC_FABRICATION_RULE` + `META_COMPLIANCE_NOTES` into `WHATSAPP_SEQUENCE_SYSTEM_PROMPT` | ~12 | Prompt-level pressure on guarantee/refund framing — expected to drop guarantee MI 3→0 | **YES, include** |
| **LB-W2** — full catalog parity (`WhatsappSuppliedData` + `WHATSAPP_TOKEN_OVERRIDES` + `detectWhatsappFabricationsInField` + retry-loop wiring) | ~250 | Catches cohort-date + guarantee-timeframe at validator level with USER-SUPPLIED cross-check; will catch the 8 MI findings above and force retry. Same pattern as Email Sprint 2 LB-E2 closure. | **YES, include** |

**Total material-impact LOC: ~262** plus ~50 LOC of tests.

### Architectural-parity items (defensive — close to future-proof, not because v1 evidence demands it)

| Item | LOC | Why include anyway | Recommend |
|---|---|---|---|
| **LB-W1** — port `extractTopLevelObjectsFromArrayString` sub-case 3a into WA's `tryUnstringifyArray` | ~15 | Email caught 65 exhausts; WA caught 0. Different message-shape, lower escape-error risk. But the function already exists — adding one call site has near-zero downside, future-proofs the 5/7-msg variants if generation patterns shift. | **YES (cheap defense)** |
| **LB-W4** — port archetypal-in-body detection to WA via `detectWhatsappFabricationsInField` | ~25 | v1 has 0 MI in this class. Email had 1 MI pre-Sprint-2 → 0 post. Cheap parity. | **YES (cheap defense)** |

**Total architectural-parity LOC: ~40** plus ~20 LOC of tests.

### NOT-recommended items (no v1 evidence)

| Item | Why skip |
|---|---|
| **LB-W5** — event-framing conditional branching across 5 prompt builders (~80 LOC) | Zero v1 hits. Forensic-map prediction overstated. Architecturally complex (5 builder edits + optional shared helper) for zero measurable improvement. **Pursue only if production evidence surfaces contradicting v1.** Save the LOC for when the failure mode is real. |

### Final recommended Sprint 2 scope

| | LOC | Tests | Total |
|---|---|---|---|
| Material-impact (LB-W2 + LB-W3) | ~262 | ~50 | ~312 |
| Architectural-parity defense (LB-W1 + LB-W4) | ~40 | ~20 | ~60 |
| **Sprint 2 total** | **~302** | **~70** | **~372** |

Compare to Email Sprint 2: +543 LOC (commit `bd67189`) closing 4 LBs. Phase F Sprint 2 estimated 60-70% of that scope because catalog architecture already exists (offer+email primitives reused), and LB-W5 is skipped.

**Predicted post-hardening v2 baseline:** MI 8→1 or 0, guarantee MI 3→0, cohort-date MI 5→1 (residual same as email v2 R-1 in nurture). Reliability stays 100%. No new failure classes expected.

---

## 9. Reliability score

| Metric | WhatsApp v1 | Email v1 (reference) |
|---|---|---|
| **Reliability** (captured/attempted) | **100% (90/90)** | 90.7% (136/150) |
| **MI rate per generation** | **0.09** | 0.52 |
| **Material-fabrication rate** (MI – nurture-vague-urgency) | **0.03** | 0.45 |

WhatsApp generator is **already at email-post-Sprint-2 reliability levels before hardening lands**. Phase F Sprint 2 is mostly defense-in-depth + the 2 ⚠ category closures, not a parity-gap rescue mission.

---

## 10. What this document is not

- Not a Sprint 2 implementation. No validator regex added, no prompt rule injected, no harness change beyond the γ' extension already committed at `73110bf`.
- Not a Sprint 2 scope lock. The recommendation in §8 is for the user's scope-lock review.
- Not a final hardening claim. v2 baseline (post-Sprint-2 forensic) is a separate document and a separate gate.

---

## 11. Verification provenance

- Harness commit: `73110bf` (Phase F Step 1+2)
- Pre-Phase-F generator state: `7c1b4b2` (validator + WhatsApp generator unchanged)
- Local artifacts: `tools/redteam-baseline/baseline-whatsapp-v1-2026-05-24/`
- Per-finding raw evidence: `redteam-whatsapp-findings.json` (225 KB)
- Per-generation raw evidence: `redteam-whatsapp-raw.jsonl` (150 KB, append-only)
- Full stdout: `redteam-whatsapp-run.log` (57 KB)
- Generation snapshots: `redteam-whatsapp-results.json` (169 KB)
