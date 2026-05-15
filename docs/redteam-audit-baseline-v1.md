# ZAP Red-Team Audit Baseline v1

**Status: HISTORICAL BASELINE — PRE-PHASE-1 STATE.** This document is the canonical pre-fix record. Do not modify it after Phase 1 fixes land. Future audits create new versioned baselines (`v2`, `v3`, …) and reference this one for delta comparison.

---

## 1. Audit Metadata

| Field | Value |
|---|---|
| Audit date | 2026-05-13 |
| Production SHA audited | `3aad948` (Phase 1 GHL master snapshot CV architecture) |
| Scope | β — Offer generator + Landing Page generator |
| Fixtures | 15, realistic-coach-adjacent (no hostile/regulated inputs in v1) |
| LLM calls | 116 (logged verbatim in `tools/redteam-baseline/baseline-2026-05-13/prompts.jsonl`) |
| Wall-clock execution | 60 minutes |
| LLM cost | ~$40-80 actual (Anthropic Sonnet 4.6) |
| Environment | Production (Railway env vars, production DB, real Anthropic API key) |
| Test rows persisted briefly | 15 services + 15 ICPs + 15 offers + 15 LPs + autoselected campaignKits |
| Cleanup verification | 0 `__REDTEAM__`-prefixed rows remained after run (SQL-confirmed) |
| Harness | `tools/redteam-harness.ts` (committed) |
| Raw artifacts | `tools/redteam-baseline/baseline-2026-05-13/` |

## 2. Generator Reliability Summary

| Generator | Score / 10 | Evidence |
|---|---|---|
| **`offersGenerator`** | **0/10** | 15/15 fixtures had ≥25 fabrication findings. Every fundamental offer attribute (price, bonuses, guarantee, scarcity, cohort, duration, placeholder names) fabricated. Zero validator coverage. |
| **`landingPageGenerator`** | **8/10** | 14/15 LPs clean against the audit catalog. Phase 2 testimonial validator caught and retried fabrications on ~10 angles during generation; the retry-with-failContext loop successfully cleaned them. 1/15 archetypal-testimonial slipped past the validator catalog. |
| `emailSequenceGenerator` | not tested in v1 | Out of scope β. Prior code analysis suggests well-hardened post Sprint B+1/B+2. |
| `whatsappSequenceGenerator` | not tested in v1 | Same |
| `adCopyGenerator` (Node 7) | not tested in v1 | Same |
| `adCreativesGenerator` (C1.1) | not tested in v1 | Same — has its own validator (`validateAdHeadlines`) |

### Quantified asymmetry

The two audited generators sit at opposite ends of fabrication safety:

| Metric | offers | LPs |
|---|---|---|
| Fixtures with ≥1 MODEL-INVENTED finding | 15/15 (100%) | 1/15 (7%) |
| Total MODEL-INVENTED findings | 457 | 1 |
| Validator catalog coverage | 0 patterns | 8 patterns |
| In-flight validator retries observed | 0 (no validator) | 10+ (working as designed) |

**This asymmetry is the central finding of v1.** The Sprint B+1 / Phase 2 validator architecture works materially when applied; the offer generator has not received that architecture.

## 3. Full Failure-Frequency Matrix

Frequency = MODEL-INVENTED-classified findings, deduplicated per fixture per category. USER-SUPPLIED false positives (4 total) excluded.

| Fabrication category | Hit rate | % | Severity (per taxonomy v1) |
|---|---|---|---|
| `fabricated_pricing_currency_amount` | 15/15 | 100% | SYSTEMIC + LAUNCH BLOCKER |
| `fabricated_bonus_value` | 15/15 | 100% | SYSTEMIC + LAUNCH BLOCKER |
| `fabricated_total_value` | 15/15 | 100% | SYSTEMIC + LAUNCH BLOCKER |
| `placeholder_leakage` (banned/invented variants) | 15/15 | 100% | SYSTEMIC + HIGH |
| `fabricated_guarantee_timeframe` | 14/15 | 93% | SYSTEMIC + LAUNCH BLOCKER |
| `fabricated_next_cohort_date` | 13/15 | 86% | SYSTEMIC + LAUNCH BLOCKER |
| `fabricated_specific_refund_mechanic` | 13/15 | 86% | SYSTEMIC + LAUNCH BLOCKER |
| `fabricated_anchor_price_range` | 12/15 | 80% | SYSTEMIC + LAUNCH BLOCKER |
| `fabricated_cohort_limit` | 5/15 | 33% | RECURRING + LAUNCH BLOCKER |
| `fabricated_programme_duration` | 5/15 | 33% | RECURRING |
| `lp_testimonial_archetypal_with_location` | 1/15 | 7% | EDGE CASE + LAUNCH BLOCKER |
| `compliance_hedge_disclaimer` ("results may vary") | 0/15 | 0% | CLEAN |

Raw finding count (multiple hits per fixture, not deduplicated): **458 MODEL-INVENTED + 4 USER-SUPPLIED = 462 total findings.**

### Severity classification mapping (per taxonomy v1 thresholds)

- **SYSTEMIC (9+/15)**: 8 categories — pricing, bonus value, total value, placeholder leakage, guarantee timeframe, next-cohort date, refund mechanic, anchor price range
- **RECURRING (3-8/15)**: 2 categories — cohort limit, programme duration
- **EDGE CASE (1-2/15)**: 1 category — LP testimonial archetypal
- **CLEAN (0/15)**: 1 category — compliance hedge

## 4. Launch Verdicts (v1 baseline state)

- ☑ **READY FOR INTERNAL TESTING ONLY**
- ☐ ~~READY FOR WARM BETA~~ — blocked
- ☐ ~~READY FOR PUBLIC BETA~~ — blocked

## 5. Exact Launch Blockers

To clear warm beta from this baseline, the following must change:

1. **Offer generator hardening** — apply Sprint B+1 canonical operator-fill token architecture + create `validateOfferFabricationPatterns` validator + wire validator into `runOfferGeneration` retry loop. Closes categories 1-10 of the matrix above.
2. **LP testimonial catalog extension** — add `archetypal_name_with_location_detail` pattern to `validateLandingPageTestimonialsFabrication`. Closes category 11.
3. **`PlaceholderBanner` UX** — surface operator-fill `[INSERT_X]` placeholders on the kit page + push modal so non-technical users can edit before deployment. Closes the discoverability gap that makes intentional placeholder emission a trust risk.

Verification gate before warm beta: re-run `tools/redteam-harness.ts` against post-fix code; compare against per-category pass criteria in `docs/redteam-failure-taxonomy-v1.md`.

## 6. Positive Findings (validator architecture working where applied)

These findings explicitly REFUTE a strawman "ZAP is fully fabricating everything" narrative.

| Positive finding | Evidence |
|---|---|
| **LP testimonials validator IS firing in production** | 10+ retry-with-failContext events observed live in `stdout.log`. Patterns caught: `programme_duration_drift`, `invented_tenure`, `direct_quoted_speech`. All retries succeeded within 3-attempt budget. |
| **User-supplied prices ARE respected when given** | 4 USER-SUPPLIED findings correctly identified across fixtures 6 ($97), 9 ($27), 11 ($15,000), 11 ($15k anchor range). The LLM uses supplied prices verbatim; the systemic failure is the LLM inventing ADDITIONAL prices on top. |
| **Zero cascade contagion** | Offer-side fabricated prices did NOT appear in LP body output. The two generators run on independent prompts; offer fabrication is contained to the offer asset and does not propagate downstream. |
| **Sprint B+1 architecture is proven** | The same prompt-canonical-token-enforcement + post-generation-validator pattern that successfully hardened `landingPageGenerator` is what the offer generator lacks. Phase 1 fix is structurally validated by this asymmetric finding. |
| **Zero hard generation failures** | 15/15 offers + 15/15 LPs generated successfully. No retry-exhausts. No HTTP errors. The system PRODUCES content reliably; what it produces in the offer category is the problem. |

## 7. Reproduction

### Re-run the audit harness against current production state

```bash
cd /Users/arfeenkhan/zap-deploy
REDTEAM_EXECUTE=1 \
  REDTEAM_PROMPT_LOG_FILE=/tmp/redteam-prompts.jsonl \
  railway run --service coachflow --environment production -- \
  npx tsx tools/redteam-harness.ts
```

### Environment requirements

- Railway CLI authenticated for the `coachflow` service / `production` environment
- Anthropic API key configured as Railway env var
- `MySQL` connection available (production DB)
- Node.js + tsx installed locally (`npx tsx ...` via repo `node_modules`)

### Expected runtime + cost

- Wall clock: 30-60 min sequential execution (per-fixture to avoid LLM rate limits)
- LLM cost: $40-80 (Anthropic Sonnet 4.6, ~115 calls per run)
- DB impact: 15 services + 15 ICPs + 15 offers + 15 LPs + ~15 campaignKits temporarily persisted, fully cleaned in `finally{}` block

### Cleanup guarantees

- `finally{}` block runs on success, on generator failure, on audit failure
- Cleanup not guaranteed on Ctrl+C / `SIGKILL` — manual cleanup SQL is at the top of `tools/redteam-harness.ts`
- Post-run verification: 0 `__REDTEAM__`-prefixed rows in `services`, `idealCustomerProfiles`, `offers`, `landingPages`, `campaignKits`

### Smoke mode (validates harness scaffolding without LLM cost)

```bash
REDTEAM_EXECUTE=1 REDTEAM_SMOKE=1 railway run ... npx tsx tools/redteam-harness.ts
```

Inserts the 15 fixtures, skips all generation, runs cleanup. Expected runtime: ~30 seconds. Expected LLM cost: $0.

## 8. Historical Baseline Statement

**This file represents the ZAP system state BEFORE Phase 1 implementation work begins.**

Specifically, before:
- The offer generator's canonical operator-fill token hardening
- The `validateOfferFabricationPatterns` validator function + its 8-pattern catalog
- The retry-with-failContext loop wiring into `runOfferGeneration`
- The LP testimonial catalog extension (`archetypal_name_with_location_detail` pattern)
- The `PlaceholderBanner` UX surface on the kit page + push modal

Post-Phase-1 audits will produce a `redteam-audit-baseline-v2.md` document. The comparison between `v1` and `v2` is the verification gate for warm-beta sign-off.

This v1 document is FROZEN. It is not edited after creation. Future findings, corrections, or interpretation changes go into the v2+ document, with explicit reference back to v1's data.

---

## Appendix — Raw Artifact Index

All preserved in `tools/redteam-baseline/baseline-2026-05-13/`:

| File | Size | What it contains |
|---|---|---|
| `results.json` | 680 KB | Full structured findings + classifications + per-fixture record + summary stats |
| `raw-outputs.jsonl` | 510 KB | 15 fixtures × full generated content (offer + LP angles) — append-only, never overwritten during execution |
| `prompts.jsonl` | 2.1 MB | 116 exact LLM prompts sent to Anthropic during execution (input + system message + tool config) |
| `stdout.log` | 10 KB | Full execution narrative including validator-firing log lines |

These artifacts are the canonical evidence for every finding in this document. Any claim above is verifiable by inspecting the matching artifact.
