# ZAP Warm-Beta Monitoring Runbook

**For:** the on-call operator during the warm-beta cohort window.
**Date:** 2026-05-16.
**Production SHA:** `0f4e080`.

**Scope discipline:** this runbook adds **no new code**. It documents
the existing log surface emitted by Phase D Sprints 1+2 (offer +
LP validator warn lines) and explains how to use the Sprint 3
`detectPlaceholders` function as an ad-hoc sampling tool. Every
instruction below works against the system as it ships at `0f4e080`.

---

## Why monitoring exists at warm beta

Two limitations from `docs/warm-beta-known-limitations.md` are the
reason this runbook is necessary:

- **L2 — retry-exhaust ships best-effort.** If the offer or LP
  generator can't satisfy its fabrication validator within 3
  attempts, content is persisted with a `console.warn` diagnostic.
- **L4 — no v3 forensic baseline post-Sprint-2.** The 0/15 archetypal
  claim is inferential. Production monitoring is how we earn
  forensic-level confidence at warm-beta scale.

You are watching for two things: **drift** (generator behaviour
degrading toward fabrication) and **exhaust** (validator can't
correct the drift within 3 attempts).

---

## 1. Log surfaces to tail

All warn lines emitted by Phase D generators carry a stable prefix
tag. Tail Railway logs for these strings:

### 1.1 Offer generator (Sprint 1)

| Pattern | Meaning | What to do |
|---|---|---|
| `[offersGenerator] Offer fabrication check failed on attempt 1/3` | Attempt 1 produced fabrication, retrying | Normal — count it |
| `[offersGenerator] Offer fabrication check failed on attempt 2/3` | Attempt 2 also failed, retrying | Note — track ratio |
| `[offersGenerator] Offer fabrication check failed on attempt 3/3` | (Does not occur — line is only emitted on attempts `< MAX`; attempt 3 goes to exhaust branch) | n/a |
| `[offersGenerator] Offer fabrication check exhausted retries on angle=... (... hits remaining, classes=[...])` | All 3 attempts failed; content shipped as best-effort | **Alert. Read hit-detail lines.** |
| `[offersGenerator]   hit N: <classId> @ <location> matched "<text>"` | Per-hit forensic detail (up to first 10 hits dumped on exhaust) | Inspect to identify which fabrication class is exhausting |

### 1.2 Landing-page generator (Sprint 2 + earlier)

| Pattern | Meaning | What to do |
|---|---|---|
| `[landingPageGenerator] Testimonials fabrication check failed on attempt N/LP_SCHEMA_RETRY_MAX_ATTEMPTS` | LP retry pressure firing | Normal at low rates |
| `[landingPageGenerator] Testimonials fabrication check exhausted retries on angle=... (... hits remaining, classes=[...])` | LP exhaust | **Alert. Read hit-detail lines.** |
| `[landingPageGenerator]   hit N: <classId> @ <location> matched "<text>"` | Per-hit (up to first 5) | Inspect class — likely candidates: `archetypal_name_with_location_detail`, `fabricated_quote_pattern` |

### 1.3 What you do NOT need to tail

These are out of warm-beta-monitoring scope (Phase D didn't touch
them):

- General orchestration `[cascade]` logs — only investigate on user-
  reported push failures
- Meta / GHL push audit lines — handled by the push audit log
- C1.1 ad headlines validator warn lines — Sprint 2 baseline; not
  Phase-D-hardened to retry-with-failContext, so monitor opportunistically

---

## 2. Thresholds + actions

### 2.1 Retry rate (attempt 2 or 3 fires)

Sample window: rolling 24h.

| Rate | Interpretation | Action |
|---|---|---|
| 0–10% | Healthy | Continue. Note baseline. |
| 10–30% | Mild drift | Investigate which fabrication class is leading. Spot-check a couple of kits. |
| 30–50% | Significant drift | Halt new cohort signups. Read the hit-detail lines. Likely candidate: prompt drift after Anthropic model update. |
| >50% | Critical | Halt the cohort. Roll back to last known-good SHA per launch checklist §7. |

### 2.2 Exhaust rate (retry maxed out, content shipped best-effort)

This is the hard alert.

| Rate | Action |
|---|---|
| **>5% of generations in any 24h window** | **Halt cohort. Investigate immediately.** |
| **>1% but ≤5%** | Continue, but every exhausted kit must be spot-reviewed by support before the operator pushes. |
| **0–1%** | Acceptable. Spot-review on weekly cadence. |

### 2.3 Generation-failure rate

Phase D didn't change the orchestration failure surface — these are
TRPCError / 500-class outcomes from the cascade. Baseline failure
rate from the Phase C C3 era applies. If you see a spike
**coincident with a Phase D generator log surge**, it's likely a
prompt-retry timeout cascading into a job failure — read the
`[offersGenerator]` or `[landingPageGenerator]` lines first.

### 2.4 Placeholder density (banner show-rate)

The Sprint 3 banner only renders when `placeholderReport.total > 0`.
Expected show-rate across the cohort:

| Rate | Interpretation |
|---|---|
| 100% | Setup-flow capture is broken — operators are not getting a chance to supply real facts during onboarding. |
| 40–80% | Healthy — operators are completing setup but leaving some optional facts unfilled (which is fine, banner catches them). |
| 0–10% | Either: (a) cohort operators are unusually diligent at onboarding (good), or (b) detector is broken (read §3 below). |

---

## 3. Manual sampling — using the detector as a probe

Once per week during the cohort window, do an out-of-band sample:

1. Pick 5 random kits from the cohort (e.g. ordered by recent push
   activity).
2. Pull each kit's brief blobs (offer, LP, email, WhatsApp,
   headlines, ad copy, hvco, hero mechanism, ad creatives).
3. Run `detectPlaceholders` against them via an internal-only Node
   script. The function is exported from
   `client/src/v2/lib/placeholderDetector.ts`:

   ```ts
   import { detectPlaceholders } from "./client/src/v2/lib/placeholderDetector";
   const report = detectPlaceholders({ offer, lp, email, whatsapp,
     headlines, adCopy, hvco, heroMechanism, adCreatives });
   console.log(report.total, report.byAsset, report.byToken);
   ```

4. Open the same kit in the browser. Confirm the banner state
   matches:
   - `report.total === 0` ⇒ no banner visible on the kit page
   - `report.total > 0` ⇒ banner visible with matching count
5. Any mismatch is a regression — file it as a P1 bug, halt new
   cohort signups until investigated.

This sampling protects against silent regressions in:
- The `useMemo` chain in `V2CampaignKit.tsx`
- The trpc query enabling in the new `whatsappSequences.get` /
  `adCreatives.getBatch` queries
- The conditional render in `PushKitModal.tsx`

---

## 4. Daily on-call checklist

5 minutes, twice per day during cohort active hours:

- [ ] Tail the last 4 hours of Railway logs filtered to
      `[offersGenerator]` + `[landingPageGenerator]` warn lines
- [ ] Count: retry-rate / exhaust-rate / generation-failure-rate
- [ ] If any threshold from §2 crossed, follow the action column
- [ ] Note any new fabrication `classId` strings appearing in
      hit-detail lines that you don't recognize — log them in the
      support ticket system for post-beta backlog
- [ ] Glance at the support inbox for operator-reported
      "AI invented X" tickets

---

## 5. Weekly review

End of each cohort week:

- [ ] Run the manual detector-sampling protocol (§3) on 5 kits
- [ ] Aggregate the daily retry / exhaust / failure counts into a
      weekly trend
- [ ] If retry rate is trending up week over week, surface to the
      product owner — possible prompt drift, possible model update
- [ ] Update `docs/warm-beta-discovered-limitations-YYYY-MM-DD.md`
      with anything new found (this is the change-log doc; the main
      `warm-beta-known-limitations.md` stays frozen)

---

## 6. Escalation paths

| Symptom | First responder | Escalation |
|---|---|---|
| Single operator reports a fabrication slip | Support | Verify via detector + validator manually. If genuine slip past validator, file against Phase E backlog. |
| Exhaust rate >5% sustained | On-call operator | Halt cohort, roll back per launch checklist §7. |
| Banner show-rate drops to 0% | On-call operator | Run §3 manual sampling immediately. Suspect detector or trpc query break. |
| Banner show-rate spikes to 100% | Support + product | Setup flow may be broken — check onboarding completion rates. |
| Generator-failure rate spike | On-call operator | Standard infra investigation; not Phase-D-specific. |

---

## 7. What this runbook is not

- Not a replacement for a proper APM dashboard. If the cohort
  exceeds a couple of dozen operators, build observability tooling.
- Not a security incident response runbook.
- Not a change-management document — code changes to Phase D
  generators are out of scope during the cohort window per the
  launch lock.

The minimum bar is: someone is watching the warn-log surface, and
that someone knows when to halt.
