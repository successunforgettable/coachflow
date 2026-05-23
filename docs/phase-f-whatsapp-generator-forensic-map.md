# Phase F — WhatsApp Generator Forensic Map

**Status:** FORENSIC MAPPING ONLY. Read-only audit of `server/whatsappSequenceGenerator.ts` + its validator wiring at production SHA `7c1b4b2`. No code, prompt, or validator changes proposed in this document.

**Methodology continuity:** mirrors `docs/phase-e-email-generator-forensic-map.md` exactly — same classification taxonomy (USER-SUPPLIED / MODEL-INVENTED / UNCERTAIN), same severity taxonomy (EDGE CASE / RECURRING / SYSTEMIC / LAUNCH BLOCKER), same pass/fail thresholds from `docs/redteam-failure-taxonomy-v1.md §3`.

**No conclusions drawn.** Predictions only. Quantified truth is the deliverable of the Step 3 harness execution (separate document).

---

## 1. Runtime call path

Production entry: `runWhatsappSequenceGeneration` in `server/whatsappSequenceGenerator.ts:738`. Reached via three upstream callers (mirrors email):

- `trpc whatsappSequences.generate` (sync mutation)
- `trpc whatsappSequences.generateAsync` (queued job)
- `autoMode.orchestrate` (Phase B2 cascade step 8)

```
runWhatsappSequenceGeneration
  ├─ Fetch service / SOT / ICP / campaign / kit
  ├─ Resolve sequenceType → buildWhatsappXxxPrompt (6-way dispatch)
  ├─ invokeWhatsappSequenceWithRetry(userPrompt)
  │    ├─ For attempt 1..3:
  │    │   ├─ invokeLLM(system + user, json_schema response_format)
  │    │   ├─ JSON.parse(stripMarkdownJson(content))
  │    │   ├─ validateWhatsappSequenceShape(parsed)         ← stage 1
  │    │   │    └─ on fail: retry with shape failContext
  │    │   ├─ validateWhatsappFabricationPatterns(messages) ← stage 2
  │    │   │    └─ on fail + attempts left: retry w/ fab failContext
  │    │   │    └─ on fail + exhaust: best-effort return + warn
  │    │   └─ shape pass + fab pass → return messages[]
  │    └─ shape exhaust → console.error Bridge B dump + throw
  ├─ DELAY_HOURS_BY_WHATSAPP_TYPE override (idx-based for unmapped types)
  ├─ DB insert into whatsappSequences
  └─ Return { id }
```

**Six sequence types** (server enum `["engagement", "sales", "nurture", "discovery_call_confirmation", "discovery_call_reminder", "event_logistics"]`):

| Type | Builder | Length | Anchor |
|---|---|---|---|
| `engagement` | `buildWhatsappEngagementPrompt` (line 301) | 3 / 5 / 7 (parameterized) | Event |
| `sales` | `buildWhatsappSalesPrompt` (line 337) | 3 / 5 / 7 (parameterized) | Offer (post-event) |
| `discovery_call_confirmation` | line 391 | 1 (fixed) | Booking |
| `discovery_call_reminder` | line 434 | 3 (T-24h, T-2h, T-15min) | Booking |
| `nurture` | line 488 | 5 (Day 0/3/7/14/21) | Lead magnet |
| `event_logistics` | line 537 | 3 (Day -7/-1/+1) | In-person event |

Total per-fixture coverage with default lengths: **6 generations × 13-17 messages persisted** (vs email's 10 sequence types × 43 messages — a smaller surface, but with parameterized lengths multiplying engagement+sales).

---

## 2. Validator architecture state (pre-Phase-F)

### 2.1 Shape validator — `validateWhatsappSequenceShape` (line 269)

Sub-cases handled today:
- `non_object_root`
- `messages_field_missing`
- `messages_string_unrecoverable` ← **GAP (see LB-W1 below)**
- `messages_wrong_type`
- `messages_empty_array`
- `message_item_not_object`
- `message_item_missing_required` (day + body where body = `message | text`)

**Helper:** `tryUnstringifyArray(raw)` at line 351. **Critical finding:** this helper has **ONLY sub-cases 1 + 2** (JSON.parse + Python-dict single-quote conversion). It does NOT include the Phase E Sprint 2 sub-case 3a (balanced-brace object extraction) that was added to `tryUnstringifyEmails`. The two helpers are structurally separate functions in `server/_core/validator.ts` — sub-case 3a was a targeted email-side hardening that has not been ported to WhatsApp.

### 2.2 Fabrication-pattern validator — `validateWhatsappFabricationPatterns` (line 782)

Iterates the **legacy shared `FABRICATION_PATTERNS` catalog only**. Calls `detectFabricationsInBody(messageBody, location)`. Catches 9 catalog classes (family / partner / employer / quoted speech / tenure / programme duration drift / research / demographic / archetypal-name-with-location for testimonial-name fields).

**No `WhatsappSuppliedData` interface exists.** Validator signature: `validateWhatsappFabricationPatterns(messages: RawWhatsappMessageFields[]): FabricationCheckResult`. No operator-context cross-check. No per-WA token-override map.

### 2.3 Retry loop — `invokeWhatsappSequenceWithRetry` (line 636)

Mirrors email's pre-Sprint-2 retry shape exactly:
- 3 attempts max
- Stage 1 shape: throw on exhaust (Phase 1 contract)
- Stage 2 fabrication: best-effort return on exhaust (Phase 2 contract)
- Bridge B diagnostic dump on shape exhaust (multi-line `console.error`)

### 2.4 System prompt

`WHATSAPP_SEQUENCE_SYSTEM_PROMPT` at line 597-599. Injects exactly one rule:
- ✅ `NO_DATE_FABRICATION_RULE`

Does NOT inject (compare to LP system prompt):
- ❌ `NO_CREDENTIAL_FABRICATION_RULE`
- ❌ `NO_RESEARCH_STATISTIC_FABRICATION_RULE`
- ❌ `META_COMPLIANCE_NOTES`

---

## 3. Predicted launch-blocker-equivalent gaps

### LB-W1 — shape sub-case 3a recovery missing

**Predicted by:** code reading at `tryUnstringifyArray` (line 351) — confirms only sub-cases 1 + 2 exist.

**Failure mode predicted:** longer WhatsApp sequences (5- and 7-message engagement/sales variants, plus the 5-message nurture) will exhibit the same `messages_string_unrecoverable` exhaust class email v1 baseline showed at 65/150. The LLM occasionally returns `{"messages": "<full-array-as-stringified-string>"}` instead of `{"messages": [...]}` for long outputs; current sub-case 1 fails on escape errors, sub-case 2 needs Python-dict shape.

**Fix scope predicted:** ~15 LOC. Add `extractTopLevelObjectsFromArrayString` call as sub-case 3a in `tryUnstringifyArray`. Function already exists in the file (line 216, lifted to file-private after Phase E Sprint 2) — just needs a call site.

**Severity prediction:** RECURRING to SYSTEMIC. Will reduce generation reliability from ~99% to ~90% if not closed. **Confidence HIGH** — same architectural mismatch as email LB-E1, same fix template.

### LB-W2 — fabrication catalog parity vs offer/email

**Predicted by:** `validateWhatsappFabricationPatterns` signature inspection — no `supplied` parameter, no per-WA catalog.

**Failure mode predicted:** when operator does not supply price/guarantee/cohort/duration, the WhatsApp sales/nurture sequences will generate invented currency amounts, fabricated guarantee timeframes ("30-day money-back"), fabricated cohort limits ("only 12 spots"), fabricated cohort dates. Prompt-level `[INSERT_*]` allow-lists exist (sales builder catalog at line 337 confirms this) but no validator enforces them — same gap email had pre-Sprint-2.

**Fix scope predicted:** ~250 LOC. Mirror Email Sprint 2 architecture:
- New `WhatsappFabricationClass` union with 9 classes (mirror EmailFabricationClass)
- New `WhatsappSuppliedData` interface (price / guaranteeType / guaranteeDuration / deliveryDuration / bonuses / testimonialNames)
- New `WHATSAPP_TOKEN_OVERRIDES` map
- New `detectWhatsappFabricationsInField` function (reuses offer's detector primitives at validator.ts:800+)
- Extend `validateWhatsappFabricationPatterns(messages, supplied?)` signature — backward-compatible
- `WhatsappSuppliedData` built at the `runWhatsappSequenceGeneration` call site from `service.*` fields + threaded through `invokeWhatsappSequenceWithRetry`

**Severity prediction:** SYSTEMIC for sales/nurture sequences (predicted 40-60% MI rate without catalog, similar to email pre-Sprint-2's 152 raw pricing hits). **Confidence HIGH.**

### LB-W3 — system-prompt symmetry vs LP

**Predicted by:** line 599 shows only `NO_DATE_FABRICATION_RULE` concatenated.

**Failure mode predicted:** LLM-invented credentials ("after 15 years of running boardroom workshops"), invented research stats ("studies show 73% of executives..."), and Meta-banned phrasings ("secret", "leaked", "guaranteed income") will appear in WhatsApp message bodies without prompt-level pressure to suppress them. Email v1 baseline showed `fabricated_guarantee_timeframe` dropping 37→1 after LB-E3 closure — same magnitude reduction predicted for WhatsApp.

**Fix scope predicted:** ~12 LOC. Add three imports + three string concatenations to `WHATSAPP_SEQUENCE_SYSTEM_PROMPT`. Mirror email Sprint 2's `import {... NO_CREDENTIAL_FABRICATION_RULE, NO_RESEARCH_STATISTIC_FABRICATION_RULE, META_COMPLIANCE_NOTES} from "./_core/copywritingRules"` + concatenation.

**Severity prediction:** RECURRING. Indirect (rules suppress framing-at-prompt-level rather than catch-at-validator-level). **Confidence HIGH.**

### LB-W4 — archetypal-name-with-location detection in WhatsApp body

**Predicted by:** `EMAIL_ARCHETYPAL_BODY_PATTERN` is email-only — fires inside `detectEmailFabricationsInField`. WhatsApp validator path doesn't call it.

**Failure mode predicted:** "A VP of Strategy at a fintech in London came to me last month..." composite phrases will appear in WhatsApp sales/engagement proof messages. Lower frequency than email (WhatsApp messages are shorter, less narrative real estate) but same class. Email v1 baseline showed 1/150 — predict 0-2/90 for WhatsApp pre-hardening.

**Fix scope predicted:** ~25 LOC. Add `WhatsappArchetypalBodyPattern` (can reuse `EMAIL_ARCHETYPAL_BODY_PATTERN` regex directly — same envelope) + a per-WA `whatsapp_archetypal_in_body` class. Inside `detectWhatsappFabricationsInField` (new), iterate the pattern with same USER-SUPPLIED cross-check against `supplied.testimonialNames` as the email side does.

**Severity prediction:** EDGE CASE to RECURRING. **Confidence HIGH** if implemented; but predicted low baseline frequency means measurement may surface only 0-2 hits.

### LB-W5 — Sprint 2.5 event-framing default forces event narrative on non-event services

**Predicted by:** prompt-builder code inspection. 5 of 6 WhatsApp builders (engagement, sales, discovery_call_confirmation, discovery_call_reminder, event_logistics) reference `${p.eventName}` directly in the prompt template. When operator's service has no associated event (e.g., a 1:1 coaching service, an open-enrollment ladder), `p.eventName` is `undefined` — renders as literal `Event: undefined` in the prompt OR as the empty string if upstream caller passes `""`. Worse: the prompt prose embeds the LLM in an "event attendees" framing regardless of service shape.

**Failure mode predicted:** for non-event services, the LLM hallucinates event context: "after attending the workshop you...", "when you joined the live session...", "the audience members who saw the demo...". These are MODEL-INVENTED contexts the operator never declared. Not a regex-catchable class — it's a prompt-shape issue.

**Fix scope predicted:** ~80 LOC across 5 prompt builders. Conditional prompt branching: when `p.eventName` is absent, switch to service-descriptor framing ("for prospects who downloaded your lead magnet" / "for customers who responded to your outreach") instead of "event attendees." Each builder gets a small `if (!p.eventName) { ... } else { ... }` split at the prompt prose level. Optional: extend `WhatsappPromptParams` with a `framingContext` discriminator if the conditional logic gets too dense.

**Severity prediction:** SYSTEMIC for non-event services running the engagement/sales/discovery_call_* types. EDGE CASE for event-anchored services that always have eventName populated.

**Confidence MEDIUM** on the fix scope — depends on how many prompt builders need conditional branching vs whether a shared helper `formatFramingContext(p)` can DRY up the conditional. Will be tighter scope after the v1 baseline run quantifies which builders actually exhibit the hallucination.

**Note:** LB-W5 is the only Phase F gap with no email/offer/LP analogue. Email side has `eventName?: string` in `EmailPromptParams` but the 4 event-anchored email builders are explicitly named for event use; the 6 non-event email builders never reference `p.eventName`. WhatsApp's tighter prompt surface (6 builders vs 10) means the same field-positionality issue compounds — 5 of 6 reference event.

---

## 4. Predicted high-risk fabrication vectors (predictions only)

From the LBs above, expected baseline measurements (ranges based on email pre/post Sprint 2 evidence):

| Vector | Predicted MI rate per 90 generations | Confidence |
|---|---|---|
| Pricing currency (WA sales body) | 35-65 | HIGH |
| Guarantee timeframe (WA sales day-N close) | 15-35 | HIGH |
| Cohort limit / cohort date (WA sales day-N scarcity) | 12-30 | HIGH |
| Programme duration drift (WA sales/nurture) | 1-5 | MEDIUM |
| Event context fabrication (non-event services) | unknown — first measurement | MEDIUM |
| Refund mechanic ("money-back", "pay nothing") | 8-20 | HIGH |
| Anchor price range | 1-5 | LOW (smaller WA message footprint than email) |
| Bonus value framings | 0-3 | LOW (sales sequences may reference; nurture/discovery typically don't) |
| Archetypal-name-with-location | 0-2 | MEDIUM |
| Named research source | 5-15 | MEDIUM (no NO_RESEARCH rule injected, same as email LB-E3) |
| Invented tenure | 2-8 | MEDIUM (no NO_CREDENTIAL rule injected, same as email LB-E3) |
| Shape exhausts (no sub-case 3a) | 3-12 | HIGH |

Total predicted MI: **80-150 per 90-generation run**, dominated by pricing + guarantee + cohort (LB-W2) and shape exhausts (LB-W1). Reliability prediction: **88-94%** (vs email's pre-hardening 90.7%).

---

## 5. Recommended audit-classifier catalog (Phase F harness γ' block)

Reuse the email audit-classifier catalog from `tools/redteam-harness.ts:940+` verbatim. **No WhatsApp-specific additions to the harness catalog** — same offerings, applied to WhatsApp body+cta scanning. The catalog already covers:

- `fabricated_pricing_currency_amount`
- `fabricated_anchor_price_range`
- `fabricated_bonus_value`
- `fabricated_total_value`
- `fabricated_cohort_limit`
- `fabricated_programme_duration`
- `fabricated_guarantee_timeframe`
- `fabricated_specific_refund_mechanic`
- `fabricated_next_cohort_date`
- `placeholder_leakage`
- `lp_archetypal_in_email` → re-purposed as `lp_archetypal_in_whatsapp` (same regex)
- `compliance_hedge_disclaimer`
- `fabricated_cta_url` (cta is scanned; WhatsApp cta values include URLs)
- `fabricated_event_venue`

For LB-W5 (event-framing fabrication), add **one new audit-classifier class**: `fabricated_event_context`. Regex catches "after attending", "when you joined", "during our session", "the live event", "your audience members" patterns ONLY when scanning a fixture whose service has no `eventName` supplied. Cross-check via `fixture.eventDetails === undefined`.

---

## 6. Methodology lock — preserved invariants from Phase E

1. **Same 15 fixtures** at `tools/redteam-harness.ts:133`. No new fixtures introduced — apples-to-apples comparability.
2. **All 6 sequence types** per fixture × default lengths. Total: **90 base generations** + **45 supplementary length-variant runs** (3 fixtures × engagement+sales × lengths 5+7 = 12; 3 fixtures × discovery_call_*+event_logistics with eventDetails populated = 15; 3 fixtures × nurture with bookingUrl populated = 9 — final supplementary count locked in the red-team plan doc) = ~135 total generations.
3. **v3-corrected classifier methodology** carries forward: token-override in audit classifier + full-operator-context cross-check + CTA token allow-list. Existing harness γ block already has these — just extend the WhatsApp invocation to use them.
4. **Append-only archives** — `tools/redteam-baseline/baseline-whatsapp-v1-YYYY-MM-DD/` (does NOT mutate email v1/v2 archives).

---

## 7. What this document is not

- Not a fix proposal. No validator regex added.
- Not a prompt change. No system-prompt rules injected.
- Not a baseline measurement. Predictions only.
- Not a scope-lock. The Phase F Sprint 2 hardening scope is locked AFTER the Step 3 v1 baseline produces quantified evidence.

**Next deliverable:** `docs/phase-f-whatsapp-redteam-plan.md` — execution plan (this session, Step 2). Then `docs/redteam-whatsapp-baseline-v1.md` — quantified evidence after Step 3 harness run.
