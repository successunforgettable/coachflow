# Phase E — Email Generator Forensic Map

**Status:** FORENSIC MAPPING ONLY. No code, prompt, validator, or runtime
behaviour changed. Read-only audit of `server/emailSequenceGenerator.ts`
+ its validator wiring at production SHA `9d8e908`.

**Methodology continuity:** preserves apples-to-apples comparability
with `docs/redteam-audit-baseline-v1.md` (offer + LP forensic at
`5a8b3eb` baseline) and `docs/redteam-audit-baseline-v2.md` (post-Phase-1
offer-hardened state at `f324018`). Uses the same:
- classification taxonomy (USER-SUPPLIED / MODEL-INVENTED / UNCERTAIN)
- severity taxonomy (EDGE CASE / RECURRING / SYSTEMIC / LAUNCH BLOCKER)
- pass/fail thresholds from `docs/redteam-failure-taxonomy-v1.md §3`

**No conclusions drawn.** This document maps the existing code surface
and predicts vectors. Quantified truth is the deliverable of the
Phase E red-team execution (separate sprint, separate authorization).

---

## 1. Runtime call path

Production entry points reach `runEmailSequenceGeneration` via three
upstream callers. All three converge on the same generator function:

```
┌─────────────────────────────────────────────┐
│ trpc emailSequences.generate (sync)         │
│ trpc emailSequences.generateAsync (queue)   │  ──►  runEmailSequenceGeneration
│ autoMode.orchestrate (Phase B2 cascade)     │       (server/emailSequenceGenerator.ts:849)
└─────────────────────────────────────────────┘
                                                          │
                                                          ▼
       ┌──────────────────────────────────────────────────────┐
       │ 1. Fetch service / SOT / ICP / campaign / kit        │
       │ 2. Resolve sequenceType → buildXxxEmailPrompt        │
       │ 3. invokeEmailSequenceWithRetry(userPrompt)          │  ← line 730
       │ 4. DELAY_HOURS_BY_EMAIL_TYPE override                │
       │ 5. DB insert into emailSequences                     │
       │ 6. Return { id }                                     │
       └──────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
       ┌──────────────────────────────────────────────────────┐
       │ invokeEmailSequenceWithRetry loop, max 3 attempts:   │
       │   a. invokeLLM(system + user)                        │
       │   b. JSON.parse(stripMarkdownJson(content))          │
       │   c. validateEmailSequenceShape(parsed)              │
       │      └ shape fail → retry with shape failContext     │
       │   d. validateEmailFabricationPatterns(emails)        │
       │      └ fab hit + attempts left → retry w/ failCtx    │
       │      └ fab hit + exhaust → best-effort return + warn │
       │   e. shape pass + fab pass → return                  │
       │   f. shape exhaust → throw                           │
       └──────────────────────────────────────────────────────┘
```

10 sequence types route to 10 distinct prompt builders:

| Sequence type | Builder | Emails | Anchor |
|---|---|---|---|
| `welcome` | `buildWelcomeEmailPrompt` (line 148) | 3 | Lead magnet delivery |
| `engagement` | `buildEngagementEmailPrompt` (line 187) | 3 | Event |
| `sales` | `buildSalesEmailPrompt` (line 221) | 6 | Offer |
| `nurture` | `buildNurtureEmailPrompt` (line 286) | 7 over ~21d | Lead magnet (non-event) |
| `launch` | `buildLaunchEmailPrompt` (line 341) | 9 around cart window | Cart open/close |
| `re-engagement` | `buildReengagementEmailPrompt` (line 402) | 4 over 14d | Subscriber inactivity |
| `discovery_call_confirmation` | `buildDiscoveryCallConfirmationPrompt` (line 474) | 1 | Booking event |
| `discovery_call_reminder` | `buildDiscoveryCallReminderPrompt` (line 515) | 3 (T-24h, T-2h, T-15m) | Booking time |
| `event_logistics` | `buildEventLogisticsPrompt` (line 563) | 4 (Day −7, −3, −1, +1) | In-person event |
| `replay_for_no_shows` | `buildReplayForNoShowsPrompt` (line 624) | 3 (Day +1, +3, +5/+7) | Post-event replay |

---

## 2. Validator architecture (what exists today)

### 2.1 Shape validator — `validateEmailSequenceShape`

Location: `server/_core/validator.ts:64`.

**Coverage:** centralizes the defensive un-stringification + array shape
recovery (Sprint B+1 path d, 2026-05-11). Handles three sub-cases of
malformed LLM output and returns an explicit `failContext` for retry
injection. Wired into `invokeEmailSequenceWithRetry` line 771.

**Strength:** comprehensive — replaces all prior ad-hoc try/catch
recovery. On retry exhaust it `throw`s rather than silently fallbacks
(Phase 1 contract).

### 2.2 Fabrication-pattern validator — `validateEmailFabricationPatterns`

Location: `server/_core/validator.ts:497`. Wired at line 788 of the
generator's retry loop.

**Field scope** (what gets scanned):
- ✅ `email[i].body`
- ✅ `email[i].subject`
- ✅ `email[i].previewText`
- ✅ `email[i].ps`
- ❌ **`email[i].cta` is NOT scanned** (omitted from the loop at
  `validator.ts:499–504`). The CTA field can contain a URL string,
  link text, or short copy — any fabrication there bypasses the
  validator. Suspected gap.

**Pattern catalog** (FABRICATION_PATTERNS, `validator.ts:355`):
9 fabrication classes, 17 patterns total.

| Class | # patterns | Token-overridable | Notes |
|---|---|---|---|
| `family_composition` | 3 | no | "X-month-old", "N kids under N", "newly single" |
| `partner_specifics` | 1 | no | "partner on shift work" |
| `employer_specifics` | 1 | no | "at Big-4 / FAANG / Y Combinator" |
| `direct_quoted_speech` | 1 | no | "she told me" / "he said" — composite-proof speech |
| `invented_tenure` | 3 | no | "twelve years of domain depth", "for N years" |
| `programme_duration_drift` | 2 | **yes** — `[INSERT_PROGRAMME_DURATION]` | "inside eight weeks of …", "12-week programme" |
| `named_research_source` | 2 | no | "Harvard study", "research shows" |
| `x_of_y_demographic` | 2 | no | "1 in 8 women", "73% of coaches" |
| `archetypal_name_with_location_detail` | 0 in catalog (declared in FabricationClass enum line 346, implemented in `detectArchetypalTestimonialName` function at line 650) | n/a | LP-testimonial-only; not applied to email validation |

### 2.3 Retry loop behaviour

Located in `invokeEmailSequenceWithRetry` (line 730). Max 3 attempts.
Mirrors the Sprint 1 offer / Sprint 2 LP retry-with-failContext pattern:

| Stage | On fail (attempt < 3) | On fail (attempt = 3) |
|---|---|---|
| Shape | retry with shape failContext | **throw** (Phase 1 contract) |
| Fabrication | retry with fab failContext (top 3 hits) | **best-effort return** + `console.warn` (`[emailSequences] Fabrication-pattern check exhausted retries`) + per-hit detail (first 5) |

**Bridge B diagnostic dump on shape exhaust** (line 816–824):
multi-line `console.error` of `lastFailureContext`, last validator
failContext, FULL raw content, FULL parsed snapshot. Aggregator-safe
(separate lines vs one big string).

---

## 3. Prompt-side hardening inventory

### 3.1 System prompt (`EMAIL_SEQUENCE_SYSTEM_PROMPT`, line 685)

Injects exactly one shared rule constant:
- ✅ `NO_DATE_FABRICATION_RULE` (from `_core/copywritingRules.ts:103`)

**Does NOT inject** (compare to LP system prompt `landingPageGenerator.ts:483`):
- ❌ `NO_CREDENTIAL_FABRICATION_RULE`
- ❌ `NO_RESEARCH_STATISTIC_FABRICATION_RULE`
- ❌ `META_COMPLIANCE_NOTES`

This is a known asymmetry vs the LP generator's system prompt and
warrants confirmation in red-team execution: do emails fabricate
credentials or research stats more often because the LLM doesn't get
the constraint at system level?

### 3.2 Per-builder hardening (sample inventory)

Each prompt builder includes its own anti-fabrication scaffolding.
The structures vary:

| Builder | PROOF SPECIFICITY RULE | PLACEHOLDER ALLOW-LIST + banned-tokens | HOST-NAME ANCHOR | Operator-fill seam |
|---|---|---|---|---|
| `buildWelcomeEmailPrompt` | ✅ ep3 (proof email) | ✅ `[INSERT_HOST_NAME]`, `[INSERT_LEAD_MAGNET_NAME]`, `[INSERT_PROGRAMME_DURATION]` | ✅ | Lead magnet, host |
| `buildEngagementEmailPrompt` | ✅ ep2 (drama email) | ✅ `[INSERT_EVENT_NAME]`, `[INSERT_HOST_NAME]` | ✅ | Event, host |
| `buildSalesEmailPrompt` | ✅ ep2 (case-study email) | ✅ 10 canonical tokens incl `[INSERT_PRICE]`, `[INSERT_GUARANTEE_TERMS]`, `[INSERT_COHORT_LIMIT]`, `[INSERT_COHORT_CLOSE_DATE]`, `[INSERT_PROGRAMME_DURATION]`, `[INSERT_OFFER_LINK]` | ✅ | Offer, event, host, price, deadline |
| `buildNurtureEmailPrompt` | ✅ ep5 | (per code comment) Decision-C pattern | ✅ | Lead magnet (NOT event) |
| `buildLaunchEmailPrompt` | (to confirm at scan) | `[INSERT_LAUNCH_PRODUCT_NAME]`, `[INSERT_CART_OPEN_DATE]`, `[INSERT_CART_CLOSE_DATE]`, `[INSERT_CART_CLOSE_TIME]`, `[INSERT_PRICE]`, `[INSERT_BONUS_VALUE]` | (to confirm) | Product, cart window |
| `buildReengagementEmailPrompt` | (to confirm) | `[INSERT_LAST_ENGAGEMENT_TIMEFRAME]`, `[INSERT_INCENTIVE]` | (to confirm) | Subscriber inactivity |
| `buildDiscoveryCallConfirmationPrompt` | (to confirm — single email, transactional) | (to confirm) | (to confirm) | Booking event |
| `buildDiscoveryCallReminderPrompt` | (to confirm) | (to confirm) | (to confirm) | Booking time |
| `buildEventLogisticsPrompt` | (to confirm) | (to confirm) | (to confirm) | Venue, agenda, time |
| `buildReplayForNoShowsPrompt` | (to confirm) | (to confirm) | (to confirm) | Replay URL, event name |

The 4 event-anchored builders (discovery_call_confirmation,
discovery_call_reminder, event_logistics, replay_for_no_shows) were
added in workstream commit 3b (post-Sprint-B+2). They postdate the
validator-pattern catalog freeze. Their hardening depth is **not yet
externally audited** — the fabrication catalog was designed against
the original 6 sequence types and has not been re-audited for the 4
new event-anchored builders.

---

## 4. Canonical operator-fill token inventory (email)

Tokens emitted by the 10 builders, aggregated from the code:

```
[INSERT_HOST_NAME]               — host / coach identity
[INSERT_LEAD_MAGNET_NAME]        — welcome / nurture
[INSERT_PROGRAMME_DURATION]      — welcome, sales (PROGRAMME_DURATION_DRIFT token-override)
[INSERT_EVENT_NAME]              — engagement, sales, replay_for_no_shows
[INSERT_OFFER_NAME]              — sales
[INSERT_PRICE]                   — sales, launch
[INSERT_DEADLINE]                — sales (cart-close)
[INSERT_OFFER_LINK]              — sales (CTA URL)
[INSERT_GUARANTEE_TERMS]         — sales day 5
[INSERT_COHORT_LIMIT]            — sales day 6 (scarcity)
[INSERT_COHORT_CLOSE_DATE]       — sales day 6
[INSERT_LAUNCH_PRODUCT_NAME]     — launch
[INSERT_CART_OPEN_DATE]          — launch
[INSERT_CART_CLOSE_DATE]         — launch
[INSERT_CART_CLOSE_TIME]         — launch
[INSERT_BONUS_VALUE]             — launch
[INSERT_LAST_ENGAGEMENT_TIMEFRAME] — re-engagement
[INSERT_INCENTIVE]               — re-engagement
```

Plus the 4 event-anchored builders likely use `[INSERT_BOOKING_URL]`,
`[INSERT_EVENT_TIME]`, `[INSERT_EVENT_TIMEZONE]`, `[INSERT_EVENT_VENUE]`,
`[INSERT_EVENT_AGENDA]`, `[INSERT_EVENT_DURATION]`, `[INSERT_REPLAY_URL]`
based on the code-comment description (lines 453–467). Confirm during
red-team fixture preparation by reading the four builder bodies in
full.

**Token-override behaviour** at validator runtime
(`validator.ts:472–473`): if any of a pattern's `tokenOverrideAnyOf`
strings is present in the body, the pattern's hit is suppressed.
**Today only one pattern (`programme_duration_drift`) is
token-overridable.** Other classes (e.g. `named_research_source`,
`x_of_y_demographic`) cannot be silenced by canonical-token
adjacency — this matches the offer-side design.

---

## 5. Known-protected categories (theoretical)

Based on existing validator + prompt coverage, the following
fabrication classes are theoretically caught at generation time:

1. ✅ `family_composition` — composite-proof biographical scaffolding
2. ✅ `partner_specifics` — partner profession/schedule invention
3. ✅ `employer_specifics` — Big-4 / FAANG / Y Combinator class
4. ✅ `direct_quoted_speech` — "she told me", "he said" attribution
5. ✅ `invented_tenure` — "twelve years of domain depth" / "for N years"
6. ✅ `programme_duration_drift` — "inside 12 weeks of …" (token-override on `[INSERT_PROGRAMME_DURATION]`)
7. ✅ `named_research_source` — Harvard/Stanford/research-shows
8. ✅ `x_of_y_demographic` — "1 in 8 women", "73% of coaches"
9. ✅ Date fabrication — at PROMPT level via `NO_DATE_FABRICATION_RULE` system injection; not at validator level (date-shaped strings would slip past the 9 fab classes unless they hit one of them).

These match the post-Sprint-B+1 path d Phase 2 catalog. None of them
were added FOR email specifically — they were added for the LP
testimonial / WhatsApp surface and email reuses the same catalog by
calling `detectFabricationsInBody` over its 4 scanned fields.

---

## 6. Suspected unprotected categories (high-confidence gaps)

These are predicted vulnerabilities based on **code reading only** —
no live LLM evidence yet. The red-team execution must measure
quantified frequency before any of these is declared real.

### 6.1 GAP-E1 — Pricing currency amount fabrication in body

**Surface:** sales / launch / re-engagement (any sequence type with
offer context).

**Prediction:** when operator does not supply `service.price` and the
sales prompt instructs the LLM to use `[INSERT_PRICE]`, the LLM may
still write a literal `$497` / `£1,500` in body / subject / PS.

**Why predicted:** the offer generator had this exact failure mode
(documented at 15/15 in `redteam-audit-baseline-v1`, closed by Sprint 1
catalog at validator level). Email has the same operator-fill seam
(`[INSERT_PRICE]`) but **no `fabricated_pricing_currency_amount`
pattern in the email validator catalog**. Compare:
- `tools/redteam-harness.ts:739` — harness regex for the class exists
  (covers `[£$€¥]\s?\d[\d,]*…`)
- `server/_core/validator.ts:355–453` — production catalog has no
  matching pattern. Catalog only catches family/partner/tenure/
  research/demographic classes.

**Severity prediction:** RECURRING to SYSTEMIC, possibly LAUNCH BLOCKER
on sales emails where pricing accuracy is critical.

### 6.2 GAP-E2 — Guarantee-timeframe fabrication

**Surface:** sales day 5 (risk-reversal email), launch day cart-open
through close.

**Prediction:** when operator does not supply
`[INSERT_GUARANTEE_TERMS]`, the LLM may write "30-day money-back
guarantee" or "60-day full refund" verbatim despite the day-5 prompt's
explicit instruction.

**Why predicted:** same gap shape as GAP-E1. Offer catalog has
`fabricated_guarantee_timeframe` regex (`/\b(?:within|in)\s+\d+\s*(?:days?|weeks?)\b/`); email catalog does not.

**Severity prediction:** RECURRING — depending on prompt-pressure
compliance rate.

### 6.3 GAP-E3 — Specific refund mechanic fabrication

**Surface:** sales day 5.

**Prediction:** "pay nothing if it doesn't work", "full refund, no
questions asked".

**Why predicted:** offer catalog has
`fabricated_specific_refund_mechanic`; email does not.

### 6.4 GAP-E4 — Cohort limit / close date fabrication

**Surface:** sales day 6 (scarcity email), launch cart-close emails.

**Prediction:** "only 12 seats", "doors close Friday at midnight".

**Why predicted:** offer catalog has `fabricated_cohort_limit` +
`fabricated_next_cohort_date`; email does not. Day-6 prompt explicitly
warns against these but no regex enforces.

### 6.5 GAP-E5 — Anchor price range fabrication

**Surface:** launch, sales.

**Prediction:** "normally $5,000–$7,500, today $1,997".

**Why predicted:** offer catalog has `fabricated_anchor_price_range`;
email does not.

### 6.6 GAP-E6 — Bonus value fabrication

**Surface:** launch ($X value bonuses).

**Prediction:** "($497 value)" stacks for cart-open bonus enumeration.

**Why predicted:** offer catalog has `fabricated_bonus_value` +
`fabricated_total_value`; email does not. Launch builder uses
`[INSERT_BONUS_VALUE]` token at prompt level but no regex.

### 6.7 GAP-E7 — CTA URL fabrication (field not scanned)

**Surface:** ALL 10 sequence types — every email has a `cta` field.

**Prediction:** invented landing URLs in cta links — e.g.
`https://yourdomain.com/enroll-now`, `https://thecalmauthority.com/cart`.

**Why predicted:** `validateEmailFabricationPatterns` does NOT scan
`e.cta` (verified at `validator.ts:499–504`). Whatever the LLM puts in
CTA bypasses every pattern. Operator-fill seams `[INSERT_OFFER_LINK]`
+ `[INSERT_BOOKING_URL]` exist at prompt level, but the validator
cannot enforce.

**Severity prediction:** RECURRING and EXTERNALLY VISIBLE (links go to
real audiences). Could be LAUNCH BLOCKER on launch sequences where
the cart URL is what drives conversion.

### 6.8 GAP-E8 — Event/venue/date fabrication in event-anchored builders

**Surface:** discovery_call_confirmation, discovery_call_reminder,
event_logistics, replay_for_no_shows.

**Prediction:** invented venue addresses, fabricated event durations,
guessed timezones.

**Why predicted:** these 4 builders postdate the validator catalog
freeze. The 9 fabrication classes were designed against the original 6
sequence types. Event-specific fabrication (e.g. "We meet at 123 Main
St, parking on the corner of …") has no matching regex.

### 6.9 GAP-E9 — Subject + previewText specific-fabrication recall

**Surface:** ALL sequence types — subject lines and preview text.

**Prediction:** the 9 patterns are body-shaped (multi-word regex).
Subject lines are short (<60 chars). Recall of patterns like
`programme_duration_drift` (which requires "inside N weeks of [The]
…") on a 6-word subject line is likely low.

**Why predicted:** pattern shapes are tuned to body prose. A subject
line "Only 12 spots left for our 12-week program" would slip
`programme_duration_drift` if it doesn't include the right
preposition+article structure.

### 6.10 GAP-E10 — Compliance hedge / disclaimer fabrication

**Surface:** sales, launch.

**Prediction:** "results may vary", "individual results not guaranteed".

**Why predicted:** offer harness has `compliance_hedge_disclaimer`;
email catalog does not. Low priority (these tend to over-include
hedges, not invent claims).

### 6.11 GAP-E11 — Archetypal-name-with-location for email

**Surface:** sales (case-study email), engagement (drama email),
welcome (proof email).

**Prediction:** "Sarah, a Senior VP at a fintech in London" — the
exact pattern Sprint 2 closed for LP testimonials. The
`detectArchetypalTestimonialName` function at `validator.ts:650` is
LP-testimonial-only; it is not called from
`validateEmailFabricationPatterns`.

**Why predicted:** the prompt-level PROOF SPECIFICITY RULE says
"anonymised role-based composites only" — but Sprint 2 evidence
showed the LLM violates equivalent LP guidance. Email-side
violation likely persists.

---

## 7. Predicted warm-beta risks

Ranking by likely red-team frequency × audience-impact:

| Risk | Predicted frequency | Audience impact | Severity prediction |
|---|---|---|---|
| GAP-E1 pricing | HIGH (no operator price → strong fab pressure) | HIGH (wrong price ships to list) | LAUNCH BLOCKER if any unsuppressed fires |
| GAP-E7 CTA URL | MEDIUM (link generation routine) | HIGH (broken / wrong links) | LAUNCH BLOCKER |
| GAP-E2 guarantee | MEDIUM-HIGH on sales day 5 | HIGH (legal / refund liability) | RECURRING → LAUNCH BLOCKER |
| GAP-E4 cohort | MEDIUM on sales day 6 + launch close | MEDIUM-HIGH | RECURRING |
| GAP-E8 event/venue | UNKNOWN (depends on operator-fill discipline) | HIGH (no-shows if wrong) | RECURRING in event-anchored types |
| GAP-E11 archetypal | LP showed 1/15 pre-Sprint-2 — expect similar on email | MEDIUM (testimonial credibility) | RECURRING |
| GAP-E5 anchor pricing | LOW-MEDIUM | MEDIUM | EDGE CASE → RECURRING |
| GAP-E6 bonus value | LOW (launch-specific) | MEDIUM | EDGE CASE |
| GAP-E3 refund mechanic | MEDIUM on sales day 5 | MEDIUM (covered by GAP-E2 if same fire) | RECURRING |
| GAP-E9 subject recall | UNKNOWN | LOW-MEDIUM | EDGE CASE |
| GAP-E10 hedge fabrication | LOW | LOW | EDGE CASE |

---

## 8. Recommended red-team pattern catalog (Phase E execution input)

The Phase E red-team plan (sibling doc
`docs/phase-e-email-redteam-plan.md`) will use the following
audit-side regex catalog. **These are AUDIT classifiers — not
validator regexes.** Adding the matching patterns to the production
validator is OUT OF SCOPE for this phase and belongs to Phase E
Sprint 2 (hardening).

```
fabricated_pricing_currency_amount     /[£$€¥]\s?\d[\d,]*(?:\.\d+)?\s?(?:k\b|K\b|m\b|M\b|million|thousand)?/g
fabricated_anchor_price_range          /[£$€¥]\s?\d[\d,]+\s?[-–—]\s?[£$€¥]?\s?\d[\d,]+/g
fabricated_bonus_value                 /\(\s?[£$€¥]?\s?\d[\d,]*\s?(value|worth)\s?\)/gi
fabricated_total_value                 /total\s+(bonus\s+)?value[:\s]+[£$€¥]?\s?\d[\d,]*/gi
fabricated_cohort_limit                /\b(?:maximum of|only|just|limited to)\s+\d+\s+(?:places?|seats?|spots?|leaders?|members?|founders?|participants?|attendees?|clients?)\b/gi
fabricated_programme_duration          /\b\d+[-\s]?(?:minute|hour|day|week|month)\s+(?:keynote|session|workshop|programme|program|engagement|sprint|cohort|intensive)\b/gi
fabricated_guarantee_timeframe         /\b(?:within|in)\s+\d+[-\s]?(?:days?|weeks?|months?|hours?)\b/gi
fabricated_specific_refund_mechanic    /\b(?:pay nothing|full refund|money[\s-]back)\b/gi
fabricated_next_cohort_date            /\b(?:next cohort|next round|cohort opens?|enrolment closes?)\b/gi
placeholder_leakage                    /\[INSERT_[A-Z_]+\]/g   (banner-suppressed → expect non-zero, classify INTENDED)
lp_archetypal_in_email                 /(?:A|An)\s+(?:Senior|Chief|Head|Director|VP|CEO|CTO|CFO|Founder|Owner|Manager|Lead)\s+[A-Za-z]+(?:\s+[A-Za-z]+)?\s+at\s+(?:a|an|the)?\s*[A-Za-z][^"]*/g
compliance_hedge_disclaimer            /\bresults?\s+may\s+vary\b/gi
fabricated_cta_url                     /https?:\/\/[^\s]+/g    (new — audit cta field only)
fabricated_event_venue                 /\b(?:meet|venue|located|address|directions|parking)\b.{0,80}\b\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/gi
```

These mirror the existing harness regex catalog at
`tools/redteam-harness.ts:738`, with **two extensions** specific to
email:
- `fabricated_cta_url` — audits the unscanned `cta` field
- `fabricated_event_venue` — audits the 4 event-anchored builders

The plan doc covers fixture matrix, USER-SUPPLIED override logic, and
classifier extensions for email-specific fields.

---

## 9. Methodology lock — preserved invariants

The Phase E execution must preserve these invariants from v1/v2
baselines to keep apples-to-apples comparability:

1. **15 fixture matrix** at `tools/redteam-harness.ts:133` (executive
   coach, life coach, business coach, … with mixed presence/absence
   of pricing/testimonials/guarantee). Email red-team uses the SAME
   15 fixtures plus per-sequence-type optional `eventDetails` overrides
   for the 4 event-anchored types.
2. **Classification taxonomy**: USER-SUPPLIED (operator content) /
   MODEL-INVENTED (no operator anchor) / UNCERTAIN (insufficient
   evidence to decide).
3. **Severity taxonomy**: EDGE CASE / RECURRING / SYSTEMIC /
   LAUNCH BLOCKER from `docs/redteam-failure-taxonomy-v1.md`.
4. **Pass/fail thresholds**:
   - LAUNCH BLOCKER categories: 0/N or ≤1/N tolerable, no exhaust-shipped
   - SYSTEMIC: ≤2/N tolerable
   - RECURRING: ≤4/N tolerable, with mitigation documented
   - EDGE CASE: documented + accepted
5. **Methodology gaps inherited from v2**:
   - Token-override missing in audit classifier (v2 baseline §6 GAP #1)
   - Full-operator-context cross-check absent (v2 baseline §6 GAP #2)
   - USER-SUPPLIED methodology incomplete (v2 baseline §6 GAP #3)

   Phase E execution must apply CORRECTED methodology (close those
   gaps for the email audit) and report results under both raw +
   corrected rates, mirroring v2's "table A raw vs table B corrected"
   structure.

---

## 10. What this document is not

- Not a fix. No validator regex is added.
- Not a prompt change. No `NO_CREDENTIAL_FABRICATION_RULE` / 
  `NO_RESEARCH_STATISTIC_FABRICATION_RULE` is injected into the email
  system prompt yet.
- Not a forensic measurement. No quantified failure rates are
  reported here — predictions only, derived from code shape.
- Not a baseline. The next deliverable
  (`docs/phase-e-email-redteam-plan.md`) is the execution plan;
  running that plan produces the baseline.

**Next deliverable:** `docs/phase-e-email-redteam-plan.md` — the
execution plan with fixture matrix, classifier logic, cost estimate,
and verification gates. No execution authorized.
