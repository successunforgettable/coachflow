# Phase E — Email Generator Red-Team Execution Plan

**Status:** PLAN ONLY. Not authorized to execute. This document is the
methodology lock for the email forensic that will follow.

**Sibling doc:** `docs/phase-e-email-generator-forensic-map.md` (code
forensics + predicted gaps, read that first).

**Production SHA at plan freeze:** `9d8e908`.

**Comparability anchor:** preserves the v1/v2 baseline methodology
(`docs/redteam-audit-baseline-v1.md`, `…-v2.md`, taxonomy v1) — same
15 fixtures, same classification + severity taxonomies, same pass/fail
thresholds. Email is added as a NEW generator pass on the existing
harness; no rewrite of harness architecture.

---

## 1. Scope

**In scope:**
- All 10 email sequence types in `server/emailSequenceGenerator.ts`
- All 4 scanned validator fields (`body`, `subject`, `previewText`,
  `ps`) **plus** the currently-unscanned `cta` field (audit-only —
  validator change is post-execution)
- Audit-classifier catalog from the forensic map §8 (12 fab classes +
  2 email-specific extensions)
- USER-SUPPLIED vs MODEL-INVENTED vs UNCERTAIN classification with
  corrected methodology per v2 §6 gaps
- Retry-loop observation: count how often the validator's
  retry-with-failContext fires and at which attempt convergence
  occurs (or exhaust)

**Out of scope (do not touch in this phase):**
- WhatsApp red-team (separate Phase F)
- Ad copy / ad creatives / headlines / hero mechanism / lead magnet
  red-team (separate phases)
- Validator hardening (post-execution Sprint 2)
- Prompt hardening (post-execution Sprint 3+)
- Harness rewrite (extend minimally)

---

## 2. Harness extension architecture

Reuse `tools/redteam-harness.ts` verbatim. **Minimal extension:**
add an email-generation phase + email-specific audit fields. **Do not
delete or refactor** existing offer + LP phases — they remain
identical to v2.

### 2.1 Generation phase extension

Current `generate()` function (`tools/redteam-harness.ts:508`):
```
for fixture in FIXTURES:
  runOfferGeneration(serviceId)  →  capture into record.offer
  runLandingPageGeneration(serviceId)  →  capture into record.landingPage
```

Extend to:
```
for fixture in FIXTURES:
  runOfferGeneration(serviceId)         →  record.offer        (unchanged)
  runLandingPageGeneration(serviceId)   →  record.landingPage  (unchanged)
  for sequenceType in EMAIL_SEQUENCE_TYPES_TO_TEST:
    runEmailSequenceGeneration({
      userId: TEST_USER_ID,
      serviceId,
      campaignId: undefined,
      sequenceType,
      name: `${REDTEAM_PREFIX}_email_${fixture.testId}_${sequenceType}`,
      eventDetails: fixture.eventDetails ?? undefined,
    })
    → capture into record.emails[sequenceType]
```

`record.emails` is a new field on `GenerationRecord`:
```ts
emails: Record<EmailSequenceType, {
  emailSequenceId?: number;
  emails?: RawEmail[];
  retryStats?: { totalAttempts: number; exhausted: boolean };
  error?: string;
}>;
```

### 2.2 Email audit phase

Add a sibling to `audit()` for emails. Iterates over each
generated sequence's `emails` array, calling `auditValue()` per
scanned field (`body`, `subject`, `previewText`, `ps`, `cta`).
Each finding tagged with new asset key shapes:
- `email.welcome.body`, `email.sales.subject`, etc.

Audit-classifier catalog (added to harness FABRICATION_PATTERNS):
```ts
{ category: "fabricated_pricing_currency_amount", from: ["body","subject","previewText","ps","cta"], regex: /[£$€¥]…/g }
{ category: "fabricated_anchor_price_range",      from: ["body","subject","previewText","ps"],       regex: /[£$€¥]…[-–—][£$€¥]?…/g }
{ category: "fabricated_bonus_value",             from: ["body","ps"],                                regex: /\(\s?[£$€¥]?\s?\d[\d,]*\s?(value|worth)\s?\)/gi }
{ category: "fabricated_total_value",             from: ["body"],                                     regex: /total\s+(bonus\s+)?value[:\s]+[£$€¥]?\s?\d[\d,]*/gi }
{ category: "fabricated_cohort_limit",            from: ["body","subject","previewText","ps"],       regex: /\b(?:maximum of|only|just|limited to)\s+\d+\s+(?:places?|seats?|spots?|leaders?|members?|founders?|participants?|attendees?|clients?)\b/gi }
{ category: "fabricated_programme_duration",      from: ["body","subject","previewText","ps"],       regex: /\b\d+[-\s]?(?:minute|hour|day|week|month)\s+(?:keynote|session|workshop|programme|program|engagement|sprint|cohort|intensive)\b/gi }
{ category: "fabricated_guarantee_timeframe",     from: ["body","subject","previewText","ps"],       regex: /\b(?:within|in)\s+\d+[-\s]?(?:days?|weeks?|months?|hours?)\b/gi }
{ category: "fabricated_specific_refund_mechanic",from: ["body","subject","previewText","ps"],       regex: /\b(?:pay nothing|full refund|money[\s-]back)\b/gi }
{ category: "fabricated_next_cohort_date",        from: ["body","subject","previewText","ps"],       regex: /\b(?:next cohort|next round|cohort opens?|enrolment closes?)\b/gi }
{ category: "placeholder_leakage",                from: ["body","subject","previewText","ps","cta"], regex: /\[INSERT_[A-Z_]+\]/g }    // expect non-zero, classify INTENDED
{ category: "lp_archetypal_in_email",             from: ["body","ps"],                                regex: /(?:A|An)\s+(?:Senior|Chief|Head|Director|VP|CEO|CTO|CFO|Founder|Owner|Manager|Lead)\s+[A-Za-z]+(?:\s+[A-Za-z]+)?\s+at\s+(?:a|an|the)?\s*[A-Za-z][^"]*/g }
{ category: "compliance_hedge_disclaimer",        from: ["body","ps"],                                regex: /\bresults?\s+may\s+vary\b/gi }
{ category: "fabricated_cta_url",                 from: ["cta"],                                      regex: /https?:\/\/[^\s]+/g }
{ category: "fabricated_event_venue",             from: ["body"],                                     regex: /\b(?:meet|venue|located|address|directions|parking)\b.{0,80}\b\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/gi }
```

---

## 3. Fixture matrix

### 3.1 Base fixtures

Re-use the existing 15 `FIXTURES` at
`tools/redteam-harness.ts:133` unchanged. They cover:
- Pricing: absent / present (real value) / placeholder
- Testimonials: absent / present (operator quotes)
- Guarantee: absent / partial / fully specified
- ICP detail: minimal / moderate / rich
- Niche: executive coach, life coach, revenue coach, …

### 3.2 Sequence-type matrix

Test **all 10 sequence types per fixture** for full coverage:
```
welcome, engagement, sales, nurture, launch, re-engagement,
discovery_call_confirmation, discovery_call_reminder,
event_logistics, replay_for_no_shows
```

Total generations:
**15 fixtures × 10 sequence types = 150 email-sequence generations.**

Note: each generation produces 1–9 emails, so the total individual
email record count = ~600 (welcome=3, engagement=3, sales=6, nurture=7,
launch=9, re-engagement=4, dcc=1, dcr=3, evt=4, replay=3 ⇒ 43 emails
× 15 fixtures = 645 email records).

### 3.3 eventDetails per fixture

The 4 event-anchored sequence types require `eventDetails`. Add a
new optional `eventDetails` field to each fixture in the harness.
Three test conditions:
- **A. No eventDetails supplied** — forces every event-anchored field
  into `[INSERT_*]` token emission. Tests baseline placeholder
  emission discipline.
- **B. Partial eventDetails supplied** — only `eventName` + `eventDate`.
  Tests whether the model invents the missing fields (venue, agenda,
  duration, replayUrl).
- **C. Full eventDetails supplied** — all fields realistic. Tests
  USER-SUPPLIED classification accuracy.

Run **condition A on all 15 fixtures** (baseline), plus **condition B
+ C on 3 representative fixtures** (fixture 01 = executive coach,
fixture 03 = business coach with real pricing+testim, fixture 11 =
the kit-11 source for the original fabrication catalog).

**Total event-anchored runs: 15A + 3B + 3C = 21 runs × 4 event-anchored
types = 84 generations.** Already counted in §3.2's 150 if A is the
default and B/C are supplementary — make them supplementary, so total
generations = **150 base + 24 supplementary = 174**.

---

## 4. Classifier logic

### 4.1 USER-SUPPLIED override (corrected methodology per v2 §6 GAP #2)

For each finding, before classifying as MODEL-INVENTED, concatenate
the full operator-supplied surface and substring-match:

```
operatorContext = [
  fixture.service.name,
  fixture.service.description,
  fixture.service.targetCustomer,
  fixture.service.mainBenefit,
  fixture.service.price,                    // numeric form + display form
  fixture.service.guaranteeDuration,
  fixture.service.deliveryDuration,
  fixture.service.testimonial1Quote,
  fixture.service.testimonial2Quote,
  fixture.service.testimonial3Quote,
  fixture.icp.pains,
  fixture.icp.goals,
  fixture.icp.objections,
  fixture.icp.buyingTriggers,
  fixture.icp.frustrations,
  fixture.eventDetails?.eventName,
  fixture.eventDetails?.eventDate,
  fixture.eventDetails?.eventVenue,
  fixture.eventDetails?.eventAgenda,
  fixture.eventDetails?.replayUrl,
  fixture.eventDetails?.bookingUrl,
  ...sourceOfTruth.* if present,
].filter(Boolean).join(" | ")

normalize(operatorContext) // lowercase, strip whitespace+commas

If normalize(finding.evidence) is a substring of normalize(operatorContext):
  → classification = "USER-SUPPLIED"
  → reason = "evidence text appears in operator context (field=...)"
Else:
  → continue to category-specific MODEL-INVENTED logic
```

### 4.2 Token-override override (corrected methodology per v2 §6 GAP #1)

For each finding, check whether the canonical token for the category
is adjacent (same field text):

```
TOKEN_OVERRIDES = {
  "fabricated_programme_duration":     ["[INSERT_PROGRAMME_DURATION]"],
  "fabricated_cohort_limit":           ["[INSERT_COHORT_LIMIT]"],
  "fabricated_next_cohort_date":       ["[INSERT_COHORT_CLOSE_DATE]", "[INSERT_CART_CLOSE_DATE]"],
  "fabricated_guarantee_timeframe":    ["[INSERT_GUARANTEE_TERMS]"],
  "fabricated_specific_refund_mechanic": ["[INSERT_GUARANTEE_TERMS]"],
  "fabricated_pricing_currency_amount":  ["[INSERT_PRICE]"],
  "fabricated_anchor_price_range":     ["[INSERT_PRICE]"],
  "fabricated_bonus_value":            ["[INSERT_BONUS_VALUE]"],
}

If any TOKEN_OVERRIDES[category] substring is present in the same
field's text as the finding:
  → classification = "UNCERTAIN"
  → reason = "canonical token present in field; validator-side
              suppression would apply at generation time"
```

This mirrors what the production validator does
(`server/_core/validator.ts:472–473`) — the audit classifier must
match its semantics to avoid v2's "13/15 false positive on cohort
dates" amplification.

### 4.3 Per-category MODEL-INVENTED rules

For each category not overridden by §4.1 or §4.2, apply
category-specific logic. Same shape as
`tools/redteam-harness.ts:649–737` classifyFinding — extended per
category. Document each rule.

### 4.4 UNCERTAIN as default for low-evidence cases

When the finding is too short to safely classify (e.g. a single date
fragment), default to UNCERTAIN. Do not over-flag.

---

## 5. Retry-observation methodology

Capture validator-loop activity for each generation. Two collection
paths:

### 5.1 Log scraping

`invokeEmailSequenceWithRetry` already emits:
- `[emailSequences] Validator shape check failed, retrying with fail-context. ${ctx}`
- `[emailSequences] Fabrication-pattern check failed (N hits), retrying with fail-context. ${ctx}`
- `[emailSequences] Fabrication-pattern check exhausted retries (...)`
- `[emailSequences] RETRY EXHAUST — …` (Bridge B diagnostic)

The harness already redirects `process.stdout` to `/tmp/redteam-stdout.log`
during the generation phase. Post-generation, the harness can scrape
that log and attribute warn lines to `record.testId × sequenceType` by
timing (sequences are generated serially per fixture).

### 5.2 Optional in-process counter (zero-code-change preferred)

If log scraping is too brittle, the alternative is to add a one-line
counter increment inside `invokeEmailSequenceWithRetry` that writes
to a process-level Map. **This requires a code change to the
generator** — disqualified for this phase (NO IMPLEMENTATION DRIFT).
Use log-scraping path 5.1.

### 5.3 What to record

Per sequence generation:
- `attemptsUsed: 1 | 2 | 3`
- `shapeFailureAtAttempt: number | null`
- `fabricationFailureAtAttempt: number | null`
- `exhausted: boolean`
- `exhaustClasses: string[]` (from the exhaust log line)

---

## 6. Runtime evidence capture plan

Mirror v1/v2 baseline:

| Artifact | Path | Behaviour |
|---|---|---|
| Aggregate results | `/tmp/redteam-results.json` | Overwritten per record; final has all 174 records |
| Append-only raw outputs | `/tmp/redteam-raw-outputs.jsonl` | Never overwritten; full input + output per gen |
| Append-only LLM prompts | `/tmp/redteam-prompts.jsonl` | Captures every system + user prompt (existing safeguard #2) |
| Generator stdout | `/tmp/redteam-stdout.log` | Captures all `[emailSequences]` warn / error lines |
| Audit findings | `/tmp/redteam-findings.json` | Per-finding records (testId, asset, category, evidence, classification, reason) |

Archive everything under
`tools/redteam-baseline/baseline-YYYY-MM-DD/` mirroring the v1/v2
structure. Mark this baseline version: **Phase E v1 / email-only**.

---

## 7. Estimated LLM cost + wall clock

### 7.1 Token estimate per email-sequence generation

System prompt: ~250 tokens (verified by length of
`EMAIL_SEQUENCE_SYSTEM_PROMPT` + `NO_DATE_FABRICATION_RULE`).

User prompt: varies 1.5k–4k tokens depending on builder + context size.

Output (emails JSON): ~1k–4k tokens depending on sequence length
(welcome=3 emails ≈ 1.5k tokens; launch=9 emails ≈ 4k tokens).

**Per generation: ~5k tokens** (system + user + output). With
retries (max 3 attempts, average likely 1.3 attempts based on Sprint 1
offer retry profile), call it **~6.5k tokens per generation**.

### 7.2 Total cost

**174 generations × 6.5k tokens = ~1.13M tokens** for the full email
red-team run.

At Sonnet 4.6 pricing ($3/M input + $15/M output tokens, typical mix
60% input / 40% output): ~$8 input + ~$7 output = **~$15 total for
the full email red-team**.

If retries spike (e.g. unpredicted fabrication-pattern catalog gap
firing repeatedly), worst case is 3× retries on every generation:
~3M tokens, ~$45. **Budget cap: $50** for one execution.

### 7.3 Wall-clock estimate

Each invokeLLM call: ~20–40s for email sequences (longer outputs).
Average 30s × 1.3 attempts = 39s per generation. Serial execution
across 174 generations: **~110 minutes wall clock** (~1.8 hours).

If we parallelize by 4 (one fixture's offer + LP done, fire all 10
sequence types in parallel): ~28 minutes wall clock.

**Recommended: serial execution** to preserve apples-to-apples
log ordering with v1/v2 baselines (which were serial). Budget the
2-hour wall clock.

---

## 8. Expected failure vectors (predictions, not measurements)

From the forensic map §6, ranked by predicted frequency:

| Vector | Predicted touch-rate | Notes |
|---|---|---|
| GAP-E1 pricing currency in body | 50–80% of sales+launch fixtures without operator price | High signal, high impact |
| GAP-E7 CTA URL fabrication | 30–60% of all sequences | CTA field unscanned by validator |
| GAP-E2 guarantee timeframe | 40–70% of sales day 5 fixtures without operator terms | Day-5 prompt explicit but no enforcement |
| GAP-E4 cohort limit + close date | 30–50% of sales day 6 + launch close fixtures | Day-6 prompt explicit but no enforcement |
| GAP-E8 event venue/details | UNKNOWN — depends on operator-fill rate on event-anchored types | First measurement |
| GAP-E11 archetypal name | 5–15% (LP showed 1/15 pre-Sprint-2) | Likely similar shape on email |
| GAP-E5 anchor price range | 10–30% on launch | Lower than direct pricing |
| GAP-E6 bonus value | 20–40% on launch only | Launch-specific |
| GAP-E3 refund mechanic | 30–50% (often co-fires with GAP-E2) | Same prompt section |
| GAP-E9 subject recall | UNKNOWN | First quantification |
| GAP-E10 hedge disclaimer | 5–10% | Low priority |

Other vectors not yet predicted but worth watching during execution:
- Discovery-call timezone fabrication
- Reply URL fabrication (replay_for_no_shows)
- Booking URL fabrication (discovery_call_*)
- Subject-line emoji fabrication (cosmetic, not signal)

---

## 9. Verification gates before execution

Before authorization to run, every box must be checked:

- [ ] Forensic map (`docs/phase-e-email-generator-forensic-map.md`)
      reviewed and ratified by the user.
- [ ] This plan (`docs/phase-e-email-redteam-plan.md`) reviewed and
      ratified by the user.
- [ ] Harness extension code-change patch reviewed BEFORE execution —
      diff must show ONLY the email-generation phase + audit phase
      additions; ZERO changes to `runOfferGeneration`,
      `runLandingPageGeneration`, `runEmailSequenceGeneration`, any
      validator, any prompt builder.
- [ ] Budget cap explicit ($50 LLM spend).
- [ ] Wall-clock window booked (2 hours uninterrupted).
- [ ] Test DB confirmed safe to write `__REDTEAM__*` rows
      (`tools/redteam-harness.ts:91` REDTEAM_PREFIX).
- [ ] Cleanup script known-good (existing `cleanup()` at
      harness:800).
- [ ] `ANTHROPIC_API_KEY` valid + quota healthy for 1.2M tokens.

---

## 10. Success criteria

The Phase E forensic execution succeeds (regardless of result
direction) when:

1. All 174 generations complete OR fail-with-captured-error. Partial
   completion is acceptable if archived.
2. Audit findings are deterministic — re-running the audit phase on
   the raw outputs produces identical findings (no LLM dependency in
   audit, just regex + classifier).
3. Every finding carries a classification + reason — no
   uncategorized entries.
4. Retry-observation data captured for every successful generation.
5. Methodology gaps from v2 §6 explicitly addressed:
   - Token-override applied in classifier
   - Full-operator-context cross-check applied
   - Both raw and corrected rates reported (mirror v2 table A/B
     structure)
6. Baseline doc `docs/redteam-audit-baseline-email-v1.md` produced
   with:
   - Per-category measurement (raw + corrected)
   - USER-SUPPLIED / MODEL-INVENTED / UNCERTAIN breakdown
   - Severity classification per category
   - Retry-loop statistics (avg attempts, exhaust rate)
   - Pass/fail verdict per v1 taxonomy thresholds
   - Honest methodology-gap acknowledgement section (mirror v2 §6)

---

## 11. Warm-beta pass/fail criteria for email

**Warm beta PASS** when:
- 0 LAUNCH BLOCKER categories firing post-corrected-methodology
- 0 categories at SYSTEMIC severity (≥10/15)
- ≤1 category at RECURRING severity (≥4/15)
- Retry-exhaust rate <5% of total generations
- Placeholder-leakage classified entirely as INTENDED (i.e. canonical
  tokens only, no banned variants)
- CTA-field findings either USER-SUPPLIED or UNCERTAIN (operator-fill
  token present) — no MODEL-INVENTED CTA URLs

**Warm beta FAIL** when:
- Any LAUNCH BLOCKER category fires unsuppressed (e.g. pricing
  fabrication in sales body that operator can't catch via banner
  because no `[INSERT_PRICE]` token was emitted)
- ≥2 categories at SYSTEMIC severity
- Retry-exhaust rate ≥5% sustained
- CTA URL fabrication with audience-visible impact

If FAIL: execute the post-execution hardening sprint plan (a separate
phase, not authorized here) covering:
- Validator catalog extension to add the predicted gap classes
- System-prompt injection of NO_CREDENTIAL_FABRICATION_RULE +
  NO_RESEARCH_STATISTIC_FABRICATION_RULE
- CTA-field inclusion in `validateEmailFabricationPatterns` scan

---

## 12. What this plan does not do

- Does not execute the red-team. Execution is a separate phase with
  explicit authorization.
- Does not modify any generator, validator, or prompt. The harness
  extension is the only code change planned, and it touches only
  `tools/redteam-harness.ts`.
- Does not produce a fix proposal. The hardening sprint plan is
  drafted only after the execution produces quantified truth.
- Does not move the warm-beta status. Email warm-beta currently
  documented as L3 "out-of-scope generator hardening" per
  `docs/warm-beta-known-limitations.md`. Whether that status changes
  depends on the execution outcome.

---

## 13. Stop condition

After this plan is committed, **STOP**. Do not begin harness
extension, do not run the red-team, do not draft hardening patches.
Wait for explicit user authorization on:
- Plan ratification
- Harness extension diff review
- Execution budget + window approval
