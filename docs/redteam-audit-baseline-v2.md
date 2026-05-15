# ZAP Red-Team Audit Baseline v2

**Status: HISTORICAL BASELINE — POST-PHASE-1 STATE.** Captures the offer generator + LP generator's fabrication behaviour after Phase D Sprint 1 hardening (commit `f324018`). Frozen at v2. Do not edit after creation. Future audits create v3+.

---

## 1. Audit Metadata

| Field | Value |
|---|---|
| Audit date | 2026-05-15 |
| Production SHA audited | `f324018` (Phase D Sprint 1 — offer generator hardening) |
| Scope | β — Offer generator + Landing Page generator (same as v1) |
| Fixtures | 15, identical to v1 (realistic-coach-adjacent matrix locked at v1) |
| LLM calls | 116 |
| Wall-clock execution | ~52 minutes |
| LLM cost | ~$40-80 actual (Anthropic Sonnet 4.6) |
| Environment | Production (Railway env vars, production DB, real Anthropic API key) |
| Test rows persisted briefly | 15 services + 15 ICPs + 15 offers + 15 LPs + autoselected campaignKits |
| Cleanup verification | 0 `__REDTEAM__`-prefixed rows remained after run (SQL-confirmed) |
| Harness | `tools/redteam-harness.ts` (unchanged from v1 — same classifier code) |
| Raw artifacts | `tools/redteam-baseline/baseline-2026-05-15/` |
| Prompts capture | NOT preserved this run — `REDTEAM_PROMPT_LOG_FILE` hook was reverted in commit `edf9afc` as part of Pre-Phase-1 governance lock. See `NOTE-prompts-absent.md` in the artifact directory. |

## 2. Generator Reliability Summary — POST-PHASE-1

| Generator | Score / 10 | v1 → v2 Delta | Evidence |
|---|---|---|---|
| **`offersGenerator`** | **9/10** | **0/10 → 9/10** | 0/15 fixtures had any MODEL-INVENTED finding after corrected classification. The single classifier raw hit (fixture 07 `$1.4M`) traced to a verbatim operator-supplied testimonial. Canonical placeholders correctly emitted on every fixture (346 intended emissions across 15 fixtures). Banned variants: **0/15 (zero-tolerance achieved)**. The −1 from a perfect 10 reflects that the v2 audit did NOT exercise hostile inputs (compliance red-team deferred to a future version) — within the realistic-coach-adjacent matrix, the generator is production-clean. |
| **`landingPageGenerator`** | **8/10** | unchanged (v1 = 8/10) | LP testimonial Phase 2 validator firing in flight (10+ retries observed); 1/15 archetypal-with-location slip persists per v1. **Phase 2 work scoped separately** — will add `archetypal_name_with_location_detail` pattern to LP testimonial validator catalog. |
| Other generators | not tested | unchanged | Out of scope β. Email + WhatsApp + Ad Copy + Ad Creatives audited only via prior code-side reasoning in v1. |

## 3. Full Failure-Frequency Matrix — v1 vs v2

Frequency = MODEL-INVENTED-classified findings, deduplicated per fixture per category. USER-SUPPLIED matches excluded.

Both the RAW classifier output and the corrected classification (per §6 methodology corrections) are shown for transparency.

| Fabrication category | v1 (15/15 baseline) | v2 raw | v2 corrected | Target | Verdict |
|---|---|---|---|---|---|
| `fabricated_pricing_currency_amount` | 15/15 (100%) | 3/15 | **0/15** | ≤1/15 | **✓ PASS** |
| `fabricated_bonus_value` | 15/15 (100%) | 0/15 | **0/15** | ≤1/15 | **✓ PASS** |
| `fabricated_total_value` | 15/15 (100%) | 0/15 | **0/15** | ≤1/15 | **✓ PASS** |
| `placeholder_leakage` (banned variants — zero-tolerance) | 15/15 (100%) | 0/15 | **0/15** | 0/15 | **✓ PASS** |
| `fabricated_guarantee_timeframe` | 14/15 (93%) | 2/15 | **0/15** | ≤1/15 | **✓ PASS** |
| `fabricated_next_cohort_date` | 13/15 (86%) | 13/15 | **0/15** | ≤1/15 | **✓ PASS** |
| `fabricated_specific_refund_mechanic` | 13/15 (86%) | 0/15 | **0/15** | ≤1/15 | **✓ PASS** |
| `fabricated_anchor_price_range` | 12/15 (80%) | 0/15 | **0/15** | ≤1/15 | **✓ PASS** |
| `fabricated_cohort_limit` | 5/15 (33%) | 0/15 | **0/15** | ≤1/15 | **✓ PASS** |
| `fabricated_programme_duration` | 5/15 (33%) | 0/15 | **0/15** | ≤1/15 | **✓ PASS** |
| `lp_testimonial_archetypal_with_location` | 1/15 (7%) | 1/15 | **1/15** | 0/15 | ↔ Phase 2 scope |
| `compliance_hedge_disclaimer` | 0/15 (0%) | 0/15 | **0/15** | 0/15 | ✓ no regression |
| `placeholder_leakage` (canonical, INTENDED) | 56 emissions | 346 emissions | (intended, NOT fabrication) | — | ✓ Operator-fill seam working |

**All 9 in-scope Phase D Sprint 1 categories PASS the pass-criteria contract** in `docs/redteam-failure-taxonomy-v1.md §3`.

The single remaining `lp_testimonial_archetypal_with_location` slip (1/15) is explicitly Phase 2 scope and was not targeted by Sprint 1.

## 4. Launch Verdicts — v2 State

- ☑ **READY FOR INTERNAL TESTING**
- ⚠ **READY FOR WARM BETA conditional on Phase 2 + Phase 3 completing** (LP testimonial validator catalog extension + PlaceholderBanner UX)
- ☐ ~~READY FOR PUBLIC BETA~~ — additional non-Phase-D items deferred (Meta App Review, multi-kit GHL handling, kit page inline edit, currency byte verification, GHL marketplace scope cleanup)

The offer generator is no longer the launch-critical blocker it was at v1. Remaining warm-beta blockers are scoped + addressable in Phases 2 + 3.

## 5. Remaining Launch Blockers (Post-v2)

| Blocker | Severity | Phase | Estimated scope |
|---|---|---|---|
| LP testimonial archetypal-name-with-location pattern slips past validator catalog | EDGE CASE + LAUNCH BLOCKER (any fake testimonial = LB per v1 taxonomy §2) | **Phase 2** | ~40 LOC validator pattern + 3 tests |
| Operator-fill placeholders not surfaced to non-technical users | HIGH — `346 intended emissions` per push but no UI affordance to edit before deployment to live channels | **Phase 3** | ~220-320 LOC client component + integrations |

Post-public-beta backlog (unchanged from v1 §9): kit page inline edit, multi-kit GHL handling, Meta App Review submission, currency byte verification, GHL marketplace scope cleanup.

## 6. Methodology Corrections (Why v2 Raw ≠ v2 Corrected)

The v1 harness classifier had two implementation gaps that AMPLIFIED apparent failure rates for some categories. The gaps were latent in v1 (rarely activated by the unhardened generator) but became visible in v2 because the hardened generator emits canonical placeholders routinely.

### Gap 1 — Token-override logic absent in audit classifier

The validator at generation time applies a token-override rule: if a field contains the canonical placeholder corresponding to a fabrication category (e.g., `[INSERT_COHORT_CLOSE_DATE]` for cohort-date patterns), the validator suppresses that pattern's hit. This is what allows the generator to emit `"Enrolment closes [INSERT_COHORT_CLOSE_DATE]"` cleanly.

The harness's audit classifier did NOT apply this rule. It treated `"Enrolment closes"` as a fabrication regardless of canonical adjacency. After Phase D Sprint 1 hardened the generator to emit canonical tokens routinely, this gap manifested as 13/15 false-positive flags on `fabricated_next_cohort_date` (raw) → 0/15 after the override is applied.

**Affected categories**: `fabricated_next_cohort_date`, `fabricated_guarantee_timeframe`. (Other override-eligible categories like `fabricated_cohort_limit`, `fabricated_programme_duration`, `fabricated_specific_refund_mechanic` happened to have 0/15 raw hits in v2 so no correction was needed for them; the gap would have applied if they'd been non-zero.)

### Gap 2 — Full-operator-context cross-check absent

The harness's USER-SUPPLIED classification for `fabricated_pricing_currency_amount` cross-checked findings against `service.price` only. Operator-supplied content also lives in:
- `service.description`
- `service.targetCustomer`
- `service.mainBenefit`
- `service.testimonial[1-3]Quote`
- ICP fields: `pains`, `goals`, `objections`, `buyingTriggers`, `frustrations`

Currency amounts the LLM correctly quotes from these fields should classify USER-SUPPLIED, not MODEL-INVENTED. Examples from v2 raw findings that flipped to USER-SUPPLIED under corrected classification:

```
Fixture 07-mastermind-high-ticket-full: matched "$1.4M"
  Source: service.testimonial2Quote = "The pricing rebuild I did after
          the Phoenix retreat added $1.4M to my next twelve months."

Fixture 11-sales-coach-15k-no-testim: matched "£50k"
  Source: service.targetCustomer = "B2B service founders with deal
          sizes above £50k whose close rate is below 20%"

Fixture 03-biz-coach-real-price-real-testim: matched "£250k"
  Source: service.description = "...stuck below £200k revenue... Cross
          £250k revenue within 6 months by refining niche and raising prices"
```

**Affected category**: `fabricated_pricing_currency_amount`. Raw 3/15 → corrected 0/15.

### Why these gaps weren't fixed in this baseline

Scope of the v2 baseline lock was strictly archival + documentation per the user's authorization. The classifier code in `tools/redteam-harness.ts` is unchanged from v1 to preserve cross-baseline comparability. A future baseline (v3 or labeled `v2.1`) will incorporate the methodology corrections; that future audit's results will be incomparable to v1's raw rates by design but will be directly comparable to v2's corrected rates.

## 7. Positive Findings — v2 New Evidence

| Finding | Evidence |
|---|---|
| **Canonical operator-fill seam working in production** | 346 canonical `[INSERT_X]` token emissions across the 15-fixture v2 run (vs 56 in v1 baseline). Generator is correctly emitting placeholders for operator-unsupplied facts. Allow-list violation count: 0/15. |
| **Retry-with-failContext loop firing in production** | Multiple `[offersGenerator]` retry log lines observed in v2 stdout.log — same architectural pattern as `[landingPageGenerator]` retry events from v1. Both validator-driven retry loops now produce structured forensic logs at retry time. |
| **User-supplied prices correctly used** | Fixtures 06 ($97), 09 ($27), 11 ($15,000), 15 ($12,000) — all 4 supplied prices appear verbatim in their offer outputs. Generator respects supplied data without inventing additional prices on top (the v1 failure mode — fabricating £18,000-£24,000 anchors on top of supplied £8,500). |
| **Operator-supplied testimonials correctly quoted** | Fixture 03 testimonials (Maria Hernandez, David Chen, Priya Sharma) appear verbatim in the post-fix output. Fixture 07 mastermind testimonials similarly. No archetypal-name substitution for operator-supplied real names. |
| **LP validator architecture continues to fire** | LP testimonial validator retry events observable in v2 stdout.log (same as v1 baseline). 14/15 LPs clean against validator catalog; 1/15 archetypal slip persists pending Phase 2. |
| **Zero hard generation failures** | 15/15 offers + 15/15 LPs generated successfully. No retry-exhausts. No HTTP errors. |

## 8. Reproduction

```bash
cd /Users/arfeenkhan/zap-deploy
REDTEAM_EXECUTE=1 \
  railway run --service coachflow --environment production -- \
  npx tsx tools/redteam-harness.ts
```

For prompts-capture reproduction (NOT available in v2 — would require restoring the env-gated `REDTEAM_PROMPT_LOG_FILE` hook in `server/_core/llm.ts`):
- The hook existed during the v1 audit and was reverted in commit `edf9afc` (Pre-Phase-1 governance lock).
- If forensic prompt capture is needed for a future baseline, re-add the hook as a temporary instrumentation patch and revert after the audit run completes.

Environment requirements, expected runtime, expected cost, and cleanup guarantees are identical to v1 (see `docs/redteam-audit-baseline-v1.md §7`).

## 9. Historical Baseline Statement

**This file represents the ZAP system state AFTER Phase D Sprint 1 implementation (commit `f324018`) and BEFORE any Phase 2 / Phase 3 work.**

Specifically captured:
- The offer generator hardening (canonical operator-fill tokens + `validateOfferFabricationPatterns` + retry-with-failContext loop)
- The LP testimonial validator at its v1 catalog state (unchanged — `archetypal_name_with_location_detail` pattern NOT yet added)
- No `PlaceholderBanner` UX (Phase 3 deferred)
- No client UI changes vs v1

The comparison v1 → v2 is the verification gate for Phase D Sprint 1's pass-criteria contract. That gate is met.

Post-Phase-2 audits will produce a `redteam-audit-baseline-v3.md` document. The comparison v2 → v3 will verify the LP testimonial catalog extension's effectiveness (target: 0/15 on `lp_testimonial_archetypal_with_location`).

This v2 document is FROZEN. It is not edited after creation. Future findings, corrections, or interpretation changes go into the v3+ document, with explicit reference back to v2's data.

---

## Appendix — Raw Artifact Index

All preserved in `tools/redteam-baseline/baseline-2026-05-15/`:

| File | Size | What it contains |
|---|---|---|
| `results.json` | 634 KB | Full structured findings + classifications + per-fixture record + summary stats |
| `raw-outputs.jsonl` | 482 KB | 15 fixtures × full generated content (offer + LP angles) |
| `stdout.log` | 19 KB | Full execution narrative including validator-firing log lines from BOTH offer + LP generators |
| `NOTE-prompts-absent.md` | (small) | Documents why `prompts.jsonl` is absent for this baseline (instrumentation hook reverted in `edf9afc`) |

Any claim above is verifiable by inspecting the matching artifact.
