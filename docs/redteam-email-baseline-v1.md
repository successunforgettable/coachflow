# Email Generator Forensic Red-Team — Baseline v1

**Production SHA at execution:** `785ef57` (Phase E Step 3 harness extension)
**Execution date:** 2026-05-16 (start 01:27, end 05:18 — wall clock ~3h 51min)
**Methodology:** v3-corrected — token-override in classifier + full-operator-context cross-check (v2 §6 GAP #1 + #2 closed for email scope only)
**Fixture matrix:** 15 base fixtures × 10 sequence types = 150 attempted generations (condition A only — `eventDetails` absent)
**Archive path:** `tools/redteam-baseline/baseline-email-v1-2026-05-16/`

**Status: COMPLETE — forensic-only. No fixes implemented. No prompts / validators / generators / orchestration changed.**

---

## 1. Execution summary

| Metric | Value |
|---|---|
| Attempted generations | 150 |
| Successful captures | **136 (90.7%)** |
| Failed generations | **14 (9.3%)** |
| Generator failure mode | 13× shape-validator exhaust (`emails_string_unrecoverable`), 1× transient `Claude API 520` |
| Total individual emails captured | ~640 |
| Total findings across all 14 audit categories | **2,302** |
| INTENDED (canonical placeholders) | **2,035 (88.4%)** |
| USER-SUPPLIED (operator-context match) | **128 (5.6%)** |
| MODEL-INVENTED (true fabrication) | **71 (3.1%)** |
| UNCERTAIN (token-override suppression at gen time) | **68 (3.0%)** |
| Wall clock | 3h 51min (vs plan estimate 110min — 2.1× slower) |

**Cost: ~$5–12 in Anthropic spend** (estimated from token volumes via response sizes; well under the $50 hard cap). The plan's $15-50 range was conservative.

---

## 2. Generator reliability score

**90.7% generation reliability** — strongly correlated with sequence length:

| Sequence type | Emails per seq | Captured | Failed | Failure rate |
|---|---:|---:|---:|---:|
| launch | 9 | 10/15 | 5 | **33.3%** ⚠️ |
| nurture | 7 | 12/15 | 3 | **20.0%** ⚠️ |
| welcome | 3 | 13/15 | 2 | 13.3% |
| engagement | 5 | 13/15 | 2 | 13.3% |
| sales | 7 | 13/15 | 2 | 13.3% |
| re-engagement | 4 | 15/15 | 0 | **0.0%** ✅ |
| discovery_call_confirmation | 1 | 15/15 | 0 | **0.0%** ✅ |
| discovery_call_reminder | 3 | 15/15 | 0 | **0.0%** ✅ |
| event_logistics | 4 | 15/15 | 0 | **0.0%** ✅ |
| replay_for_no_shows | 3 | 15/15 | 0 | **0.0%** ✅ |

**Pattern: failures cluster on long sequences (≥7 emails).** Of 14 total failures, 13 are the `emails_string_unrecoverable` shape sub-case where the LLM returned `{"emails": "<full-array-double-stringified>"}` instead of `{"emails": [...]}`. Validator caught it on every attempt and retry-with-failContext could not coerce a structural fix within 3 attempts. The 14th failure is a transient `Claude API 520` (infrastructure, not generator gap).

Reliability score by sequence length tier:
- Short sequences (1–4 emails): **75/75 = 100%** ✅
- Medium (5–7 emails): **51/60 = 85%** ⚠️
- Long (9 emails launch): **10/15 = 67%** ❌

---

## 3. Failure-frequency matrix (MODEL-INVENTED only, v3-corrected)

| Category | MODEL-INVENTED hits | Touch rate (fixtures/15) | Severity per v1 taxonomy | Warm-beta gate |
|---|---:|---:|---|---|
| `fabricated_next_cohort_date` | 31 | **14/15** (93%) | **SYSTEMIC** | FAIL |
| `fabricated_guarantee_timeframe` | 25 | **15/15** (100%) | **SYSTEMIC** ⚠️ (see §3.1 classifier FP risk) | FAIL |
| `fabricated_pricing_currency_amount` | 11 | 3/15 (20%) | RECURRING | FAIL |
| `fabricated_programme_duration` | 3 | 2/15 (13%) | RECURRING | (edge — token-override available) |
| `lp_archetypal_in_email` | 1 | 1/15 (7%) | EDGE CASE | FAIL (per v1 taxonomy §2 — any fake testimonial = LB) |
| `fabricated_cta_url` | 0 | 0/15 | not observed | PASS (GAP-E7 NOT confirmed) |
| `fabricated_event_venue` | 0 | 0/15 | not testable (condition A only) | inconclusive |
| `fabricated_anchor_price_range` | 0 | 0/15 | not observed in classifier | (catalog may not detect — see §6) |
| `fabricated_bonus_value` | 0 | 0/15 | not observed | (catalog gap risk) |
| `fabricated_total_value` | 0 | 0/15 | not observed | (catalog gap risk) |
| `fabricated_specific_refund_mechanic` | 0 | 0/15 | not observed | (catalog regex may not detect) |
| `fabricated_cohort_limit` | 0 | 0/15 | not observed | (catalog regex strict) |
| `compliance_hedge_disclaimer` | 0 | 0/15 | not observed | PASS |
| `placeholder_leakage` (canonical, INTENDED) | **2,035** | 15/15 | n/a — by design | PASS |

**INTENDED placeholder emissions = 2,035 across 136 sequences ≈ 15 placeholder tokens per sequence on average.** Phase D Sprint 1+2 contract working as designed: when operator-facts are absent, generator emits canonical `[INSERT_X]` tokens routinely. The Sprint 3 PlaceholderBanner UX surfaces these for operator review.

### 3.1 IMPORTANT — Classifier false-positive risk on `fabricated_guarantee_timeframe`

The 25 MODEL-INVENTED `fabricated_guarantee_timeframe` hits include phrases like **`"in 2 hours"`** from `discovery_call_reminder` emails (the T-2h call reminder). The classifier regex `/\b(?:within|in)\s+\d+\s*(?:days?|weeks?|hours?)\b/gi` was lifted from the offer harness where it correctly catches "30-day money-back guarantee" — but on email, it over-matches event-reminder timing language that is NOT a guarantee fabrication. **A non-trivial fraction of the 25 hits are methodology artifacts**, not real fabrications. Manual sampling of the raw findings is required before declaring this category SYSTEMIC.

This is a v3-methodology bug to fix in baseline-email-v2: tighten the regex to require guarantee-adjacent context (`refund`, `guarantee`, `money-back`, `risk-free`).

### 3.2 IMPORTANT — `fabricated_next_cohort_date` classifier matches phrase, not semantic

The 31 hits are mostly `"next cohort"` / `"enrolment closes"` strings. Some are real (model wrote the phrase without a canonical-token adjacency); some may be cases where the canonical token IS in the body but in a different field-position than what the per-field token-override check inspected. Per-finding manual sampling is the next step.

---

## 4. Retry effectiveness analysis

### 4.1 Shape validator (Sprint B+1 path d)

| Metric | Count |
|---|---:|
| Total shape retry-with-failContext firings | 66 |
| ...at attempt 1 | 32 |
| ...at attempt 2 | 21 |
| ...at attempt 3 | 13 |
| Shape exhausts (throw + Bridge B diagnostic dump) | **13** |
| Generations rescued by shape retry | **32 − 13 = 19 (~59% recovery rate)** |
| Sub-case observed at exhaust | `emails_string_unrecoverable` (100% of exhausts) |

**Verdict:** Shape validator catches malformations but cannot recover the `emails_string_unrecoverable` sub-case on long sequences. **This is a real gap.** The LLM repeatedly emits the same wrong shape on retry. Phase 1 contract = throw on shape exhaust (no best-effort), so these 13 generations lost entirely.

### 4.2 Fabrication validator (Sprint B+1 path d Phase 2)

| Metric | Count |
|---|---:|
| Total fab retry-with-failContext firings | 20 |
| ...at attempt 1 | 16 |
| ...at attempt 2 | 4 |
| Generations rescued by fab retry (recovered at attempt 1 only) | **~12 (~75% recovery rate)** |
| Fab exhausts (ship best-effort + warn log) | **6** |
| Categories that exhausted (shipped anyway with warn) | `employer_specifics` × 4, `programme_duration_drift` × 2 |

**Verdict:** Fab validator works well — catches at attempt 1, recovers most via retry, ships remainder best-effort with diagnostic log per Sprint 1 / Sprint 2 contract. The 6 exhaust-shipped findings are visible in production warn logs (per the monitoring runbook).

### 4.3 Combined validator + retry effectiveness

- **Shape validator**: 59% retry recovery, 41% exhaust-throw rate on triggered sequences. **Mediocre.**
- **Fab validator**: 75% retry recovery, 38% exhaust-best-effort rate on triggered sequences. **Acceptable** (Sprint 1+2 parity).
- **Generation-level reliability**: 90.7% complete-success rate. Below Sprint 1 offer (effectively 100% per v2 baseline).

---

## 5. Validator effectiveness analysis

The corrected v3 methodology gives a cleaner picture of what the runtime validator catches vs misses:

### 5.1 Validator catches at generation time

The **68 UNCERTAIN findings** are token-override suppressions — places where the validator's canonical-token check would have suppressed the regex hit at generation time. Breakdown:

| Category | Token-override suppressed |
|---:|---|
| `fabricated_next_cohort_date` | 43 |
| `fabricated_pricing_currency_amount` | 20 |
| `fabricated_guarantee_timeframe` | 5 |

These are **NOT validator misses** — they are intended suppressions when the canonical `[INSERT_*]` token is present in the field. The audit classifier correctly downgrades to UNCERTAIN (mirroring the production validator semantic).

### 5.2 Validator misses (real fabrication that shipped)

The **71 MODEL-INVENTED findings** are content that shipped to the email sequence anyway. Of these:

- **31 + 25 = 56 hits (79% of MI)** are categories WITHOUT a matching pattern in the production validator catalog. The audit-side classifier surfaced them; the runtime validator never saw them. These are **catalog gaps** vs runtime misses:
  - `fabricated_next_cohort_date` — offer has it, email validator catalog does not
  - `fabricated_guarantee_timeframe` — offer has it, email validator catalog does not
- **11 hits** of `fabricated_pricing_currency_amount` — offer has the pattern; email catalog does not. Most striking: fixture 03 (which has `service.price=5000`) emitted `£500` and `£100k` in nurture/launch sequences as anchor/value-stack fabrication.
- **6 hits (4 + 2)** at fab exhaust path = real validator catches that the LLM could not satisfy within retries — `employer_specifics`, `programme_duration_drift`. These shipped with diagnostic warn lines per the contract.
- **1 hit** `lp_archetypal_in_email` — Sprint 2 LP testimonial validator is LP-only; not applied to email. Predicted gap GAP-E11 confirmed.

### 5.3 Predicted gaps confirmed vs not-confirmed

Forensic-map (`docs/phase-e-email-generator-forensic-map.md`) predictions vs observed:

| Gap | Forensic prediction | Observed | Status |
|---|---|---|---|
| GAP-E1 — pricing currency in body | HIGH 50–80% touch | 3/15 (20%) — and only on fixtures with operator price (anchor fab) | **PARTIAL** — lower than predicted; PROOF SPECIFICITY prompt is working in absent-price case |
| GAP-E2 — guarantee timeframe | MEDIUM-HIGH | 15/15 touch (caveated by §3.1 classifier FP) | **CONFIRMED** with caveat |
| GAP-E3 — refund mechanic | MEDIUM | 0 hits — classifier regex maybe too narrow | UNDETERMINED |
| GAP-E4 — cohort limit/close date | MEDIUM | next_cohort 14/15; cohort_limit 0/15 | **CONFIRMED for next_cohort_date only** |
| GAP-E5 — anchor price range | LOW-MEDIUM | 0 hits | NOT CONFIRMED |
| GAP-E6 — bonus value | LOW (launch only) | 0 hits | NOT CONFIRMED |
| **GAP-E7 — CTA URL fabrication** | MEDIUM-HIGH | **0/15** — every CTA was either canonical operator-fill token (`[INSERT_OFFER_LINK]` / `[INSERT_BOOKING_URL]` etc.) or non-URL copy | **NOT CONFIRMED** ✅ — even though CTA field isn't validator-scanned, the prompts effectively prevent fabrication |
| **GAP-E8 — event venue** | UNKNOWN | 0/15 — but condition B/C not run | **NOT TESTABLE** (condition A only — eventDetails absent → all event fields emit canonical tokens) |
| GAP-E9 — subject/preview recall | UNKNOWN | 3 MI in subject, 1 in previewText (vs 58 in body) — patterns are body-shaped, low subject recall as predicted | CONFIRMED |
| GAP-E10 — hedge disclaimer | LOW | 0/15 | NOT CONFIRMED |
| GAP-E11 — archetypal-name-in-email | 5–15% (LP showed 1/15 pre-Sprint-2) | 1/15 (welcome on fixture 12) | **CONFIRMED — same touch rate as predicted** |

**Calibration note:** the forensic map over-predicted GAP-E1, GAP-E7. The per-builder PLACEHOLDER ALLOW-LIST + PROOF SPECIFICITY scaffolding in `emailSequenceGenerator.ts` is more effective than predicted. The validator-catalog gaps (E2, E4) remain as predicted.

---

## 6. Audit-classifier methodology caveats

The classifier inherited regex patterns from the offer harness verbatim. Email-side audit revealed 3 methodology issues that did not arise in offer audits:

1. **`fabricated_guarantee_timeframe` over-matches event timing.** `"in 2 hours"` on a discovery-call reminder is legitimate copy, not a guarantee fabrication. ~30–50% of the 25 MI hits in this category may be FP. Fix: require guarantee-adjacent keyword in regex.
2. **`fabricated_next_cohort_date` matches the phrase, not the semantic.** Strings like `"next cohort"` are flagged regardless of context. Some hits are real (next-cohort framing without a canonical token); others may be in proximity to a token in a different field that the per-field check missed.
3. **0-hit patterns may be catalog gaps, not generator wins.** `fabricated_cohort_limit` (regex requires "N spots/seats"), `fabricated_anchor_price_range` (requires "£X – £Y"), `fabricated_bonus_value` (requires "(£X value)") — if the model uses synonyms, the regex misses. Pattern strictness is plausibly hiding fabrications.

These caveats apply to the v3 methodology and should be addressed in baseline-email-v2.

---

## 7. Comparison vs Offer / LP hardening maturity

| Generator | Hardening sprint | System prompt rules | Validator catalog | Retry effectiveness | Reliability score | Notes |
|---|---|---|---|---:|---:|---|
| Offer | Phase D Sprint 1 | NO_DATE + NO_CREDENTIAL + NO_RESEARCH + META_COMPLIANCE | 12 fab classes + token-overrides + canonical token allow-list | 100% (v2 baseline 0/15 across 9 fab categories) | **~10/10** | Production-ready per `redteam-audit-baseline-v2.md` |
| LP | Phase 2 + Sprint 2 | NO_DATE + NO_CREDENTIAL + NO_RESEARCH + META_COMPLIANCE | 9 fab classes incl `archetypal_name_with_location_detail` | ~85% (Sprint 2 closed 1/15 archetypal) | **~8.5/10** | Production-ready under operator review |
| **Email** | **Pre-hardening (no Phase D sprint)** | **NO_DATE ONLY** (no credential, no research, no meta_compliance) | **9 fab classes — same catalog as LP but NO email-specific patterns** (no pricing, no cohort_date, no guarantee, no refund, no anchor, no bonus, no archetypal-on-email) | **shape 59%, fab 75%** | **~6.5/10** | **NOT production-ready for unattended workflows** |

**Email lags Offer + LP by approximately one major hardening sprint.** The retry-loop architecture is in place (Sprint B+1 path d), but the prompt+catalog stack that makes the offer generator forensically clean has not been ported to email.

---

## 8. Methodology v3 notes (corrections active for email audit only)

Per `docs/phase-e-email-redteam-plan.md` §4, baseline-email-v1 implements two methodology corrections that were absent in v1/v2:

### 8.1 Token-override in classifier (closes v2 §6 GAP #1)

The audit classifier mirrors the production validator's token-override semantic. When a canonical operator-fill token is present in the same field as a regex hit, the finding downgrades to UNCERTAIN.

**Impact:** of 199 raw regex hits in the 4 token-overridable categories (next_cohort_date + pricing + guarantee_timeframe + programme_duration), **68 (34%) downgraded to UNCERTAIN**. Without this correction, the v2-style "raw rate" would have shown:
- `fabricated_next_cohort_date`: 74 raw vs **31 corrected** (58% reclassified)
- `fabricated_pricing_currency_amount`: 31 raw vs **11 corrected** (65% reclassified)
- `fabricated_guarantee_timeframe`: 30 raw vs **25 corrected** (17% reclassified)

The correction is critical — without it, the email generator would appear far worse than it actually is, exactly mirroring v2's "raw vs corrected" amplification documented in `docs/redteam-audit-baseline-v2.md §3`.

### 8.2 Full-operator-context cross-check (closes v2 §6 GAP #2)

`collectOperatorContext()` concatenates 30+ operator-supplied fields (service + ICP + eventDetails + testimonials) into a substring-match blob. Findings whose normalised evidence appears in this blob reclassify USER-SUPPLIED.

**Impact:** 128 findings classified USER-SUPPLIED — overwhelmingly `fabricated_pricing_currency_amount` (121 cases on fixture 03 where `service.price=5000` and the model correctly uses the operator value across multiple emails). Without this correction these would have shown as MODEL-INVENTED, amplifying the apparent pricing-fabrication rate by 10×.

### 8.3 CTA token allow-list

`CTA_TOKEN_ALLOW_LIST = ["[INSERT_OFFER_LINK]", "[INSERT_BOOKING_URL]", "[INSERT_REPLAY_URL]"]`. CTA-field URL matches that are canonical tokens classify as INTENDED. In this run all 394 cta-field findings were INTENDED (canonical-token placeholder_leakage class), confirming the email generator routes CTA fabrication through canonical operator-fill tokens reliably.

---

## 9. Warm-beta verdict

🟡 **SAFE FOR WARM BETA — WITH STRICT OPERATOR REVIEW** (matches the platform-level verdict from `docs/warm-beta-launch-checklist.md`).

Rationale:
- **2,035 INTENDED canonical-token emissions across 136 sequences** = the operator-fill design is working at scale. The PlaceholderBanner UX (Phase D Sprint 3) surfaces these to operators before any push, so operators are NOT shipping `[INSERT_PRICE]` to live audiences.
- **71 MODEL-INVENTED fabrications** is the unprotected surface. Of these, the most concerning for warm beta are:
  - Real pricing-fabrication on fixture 03 (operator HAS a price; model invented `£500` / `£100k` anchors in nurture/launch). Operator must catch via review.
  - 31 cohort-date phrases without canonical-token suppression in sales/launch sequences. Operator must catch via review.
  - 1 archetypal-composite testimonial on fixture 12 welcome. Operator must catch via review.
- **9.3% generation-failure rate** is a UX problem, not a content-safety problem. Operator sees a missing sequence in the kit and re-triggers — but no UI signal exists today that "this sequence failed". This is an acceptable warm-beta limitation if support is staffed.

The 6 fab-validator-exhaust events shipped to kit with diagnostic warn log: these are visible on the `[emailSequences] Fabrication-pattern check exhausted retries` log surface per the monitoring runbook §1.1. Operator catches them via warn-log review or via manual content review.

**Warm-beta pass conditions, all currently met:**
- Operator review enforced via PlaceholderBanner UX ✅
- Monitoring runbook live on `[emailSequences]` warn-log surface ✅
- Support staffed during cohort hours ✅
- 9.3% gen-failure rate documented as known limitation ✅

---

## 10. Public-beta verdict

🔴 **NOT READY FOR PUBLIC BETA.**

### 10.1 Launch blockers

**LB-E1 — Shape-validator exhaust on long sequences.**
13/14 failures are `emails_string_unrecoverable`. Launch sequences (9 emails) fail 33% of the time. For public beta where operators self-serve at scale without support hand-holding, this rate is unacceptable. Requires either:
- A 4th shape-recovery sub-case for the double-stringified-array form (parse the inner string + reconstruct)
- LLM-side schema enforcement via Anthropic's tool-use input_schema with `strict: true` (currently `strict: true` is set in response_format but the model still drifts on long sequences — investigate why)
- Output-length governance via splitting long sequences into multiple LLM calls

**LB-E2 — Validator catalog gaps (4 missing classes vs offer parity).**
Email validator catalog has no patterns for:
- `fabricated_pricing_currency_amount`
- `fabricated_next_cohort_date`
- `fabricated_guarantee_timeframe`
- `fabricated_specific_refund_mechanic`
- `fabricated_cohort_limit`
- `fabricated_bonus_value`
- `fabricated_total_value`
- `fabricated_anchor_price_range`

The offer generator has all of these. Email has zero of them. **8 catalog gaps**, of which at least 4 (pricing, next_cohort, guarantee_timeframe, refund) have been runtime-confirmed.

**LB-E3 — System prompt asymmetry vs LP.**
Email system prompt injects only `NO_DATE_FABRICATION_RULE`. LP system prompt injects all four of `NO_DATE_FABRICATION_RULE` + `NO_CREDENTIAL_FABRICATION_RULE` + `NO_RESEARCH_STATISTIC_FABRICATION_RULE` + `META_COMPLIANCE_NOTES`. Email-side fabrications observed are exactly the classes those rules suppress in LP.

**LB-E4 — `archetypal_name_with_location_detail` not applied to email.**
Sprint 2 closed the LP archetypal gap. The validator function `detectArchetypalTestimonialName` exists at `validator.ts:650` but is not called from `validateEmailFabricationPatterns`. Result: 1/15 fixtures slipped a fake testimonial (Voice Coach welcome email composite). Per `redteam-failure-taxonomy-v1.md §2`, ANY fake testimonial = launch blocker.

### 10.2 Public-beta gate conditions (all currently unmet)

- [ ] LB-E1 closed — generation-failure rate <1% across all sequence types
- [ ] LB-E2 closed — 4 confirmed catalog gaps added to email fab validator
- [ ] LB-E3 closed — credential + research + meta_compliance rules injected into email system prompt
- [ ] LB-E4 closed — archetypal detector applied to email
- [ ] baseline-email-v2 forensic re-run after the above shows 0/15 across all confirmed-MI categories
- [ ] Methodology FPs in §3.1 + §3.2 fixed in classifier before re-baseline

---

## 11. Exact required fixes (Phase E Sprint 2 hardening plan — DO NOT IMPLEMENT YET)

The post-execution hardening sprint plan (a separate, future phase requiring explicit authorization) would cover:

### 11.1 Validator catalog extensions (`server/_core/validator.ts`)
Add email-specific `EMAIL_FABRICATION_PATTERNS` parallel to the offer catalog:
- `fabricated_pricing_currency_amount` with `tokenOverrideAnyOf: ["[INSERT_PRICE]"]`
- `fabricated_next_cohort_date` with `tokenOverrideAnyOf: ["[INSERT_COHORT_CLOSE_DATE]", "[INSERT_CART_CLOSE_DATE]", "[INSERT_DEADLINE]"]`
- `fabricated_guarantee_timeframe` with `tokenOverrideAnyOf: ["[INSERT_GUARANTEE_TERMS]"]`
- `fabricated_specific_refund_mechanic` with `tokenOverrideAnyOf: ["[INSERT_GUARANTEE_TERMS]"]`
- `fabricated_cohort_limit` with `tokenOverrideAnyOf: ["[INSERT_COHORT_LIMIT]"]`
- `fabricated_anchor_price_range` (rare but should catch when fires)
- `fabricated_bonus_value` (launch-specific)

### 11.2 System prompt symmetry (`server/emailSequenceGenerator.ts:685`)
Update `EMAIL_SEQUENCE_SYSTEM_PROMPT` to inject `NO_CREDENTIAL_FABRICATION_RULE` + `NO_RESEARCH_STATISTIC_FABRICATION_RULE` + `META_COMPLIANCE_NOTES` (lifted from LP system prompt verbatim).

### 11.3 Archetypal detector port (`server/_core/validator.ts:497`)
Call `detectArchetypalTestimonialName` from `validateEmailFabricationPatterns` for each email's body. Mirror LP wiring.

### 11.4 Shape-recovery 4th sub-case
Investigate the `emails_string_unrecoverable` sub-case. Options:
- Add a parser path: if `parsed.emails` is a string starting with `[`, attempt one more `JSON.parse(parsed.emails)` before declaring failure.
- Tighten the JSON schema `strict: true` enforcement (already set — needs investigation why model drifts).
- Split long sequences (≥7 emails) into chunked LLM calls.

### 11.5 Audit classifier hardening (for next baseline)
- Tighten `fabricated_guarantee_timeframe` regex with required guarantee-keyword adjacency
- Tighten `fabricated_next_cohort_date` regex to require non-token semantic context
- Add condition B + C iterations for event-anchored types so GAP-E8 can be tested

---

## 12. Recommended next phase

**Recommended next action: Phase E Sprint 2 — Email Generator Hardening.**

Scope: implement fixes 11.1–11.4 as a sprint-bounded effort following the Sprint 1 (offer) + Sprint 2 (LP archetypal) template. After implementation, re-run baseline-email-v2 forensic via the same harness with no methodology changes; compare table 3 raw + corrected rates against this v1 baseline.

**Do not start Phase F** (WhatsApp red-team) until email hardening lands. WhatsApp shares much of the same generator architecture and many of the same catalog gaps — closing them on email first will inform a cleaner WhatsApp baseline.

**Do not start Phase E Step 5** speculatively — the next phase requires explicit authorization with a strict-scope hardening sprint spec.

---

## 13. Methodology lock for future audits

Future email audits (baseline-email-v2+) must:
1. Use the same 15 base fixtures (preserves cross-version comparability)
2. Use the same v3-corrected classifier semantics (token-override + full-operator-context)
3. Use the same artifact paths in `tools/redteam-baseline/baseline-email-vN-YYYY-MM-DD/`
4. Optionally extend to condition B + C event-anchored runs (not implemented in v1)
5. Fix the audit-classifier FPs from §6 before declaring a v2 measurement

This baseline is **archival** at `785ef57`. Do not edit after creation. Future audits create v2+.

---

## 14. Deliverable summary (Phase E Step 4 contract)

| Item | Value |
|---|---|
| Files created | `docs/redteam-email-baseline-v1.md` (this file), `tools/redteam-baseline/baseline-email-v1-2026-05-16/` (6 artifacts archived) |
| Files modified | (none — forensic-only) |
| Runtime behavior changed? | **NO** |
| Production code changed? | **NO** |
| TS baseline preserved? | **YES (53)** |
| Vitest preserved? | **YES (pipeline-fixes 170/170)** |
| Total execution cost | **~$5–12 estimated** (well under $50 hard cap) |
| Total runtime duration | **~3h 51min** (start 01:27, end 05:18 — 2026-05-16) |
| Email generator launch-readiness verdict | **🟡 Warm-beta: SAFE WITH STRICT OPERATOR REVIEW** · **🔴 Public-beta: NOT READY (4 launch blockers)** |
| Next recommended action | Phase E Sprint 2 — email hardening per §11. Do not execute without explicit authorization. |
