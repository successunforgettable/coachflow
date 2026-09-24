# 🟢 RESUME POINT — 2026-09-24 (late): trial paywall, quota table, GHL reliability built; first deploy planned

**Supersedes `CHECKPOINT_2026-09-24_HOOK_WORDING_SETTLED_H2_NEXT.md`** (retained, marked superseded). Written so a cold
terminal resumes from exactly this point. **Every figure measured at write time (§15f)** — git / GitHub via
`git rev-parse` / `git ls-remote`, gates run at write time, production reads via the guarded SELECT-only runner.

---

## 0. THE THIRTY-SECOND VERSION

| | |
|---|---|
| **production** | `railway-build` = **`87596d7`**. **Untouched all session** — nothing pushed or merged to it |
| **held branch** | `docs/held-2026-09-12` = **this checkpoint's commit, on top of `33d2b10`**. `33d2b10` is **53 commits ahead** of production (54 with this checkpoint). **GitHub backup pushed to match local HEAD** as the last step of this checkpoint |
| **scenes fix** | `fix/scenes-array-guard` = **`94ae237`** (1 over `87596d7`), on GitHub, **unmerged, not deployed** |
| **migration 0112** | `drizzle/0112_ghl_reconnect_required.sql` — **written, NOT applied** to production (verified read-only: its two columns are absent). **0111 already applied** (verified: `coachFacts` table exists) |
| **production writes this session** | **ZERO** by CC. Every production DB touch was a SELECT (guarded runner, READ ONLY transaction) or `mysqldump --no-data` (schema only) |
| **deadline** | 🔴 **Arfeen's Meta login expires 2026-10-05.** The deploy and the walkthrough both need to happen before then |
| **next action** | §6 |

🔴 **PUSHING `railway-build` IS THE DEPLOY.** No push to it and no production write without Arfeen's explicit go-ahead.
🔴 **If Arfeen says he is starting the walkthrough: stop anything deploy-related until he says he is done.**

---

## 1. VERIFY GROUND TRUTH FIRST

```bash
git fetch origin && git rev-parse --short HEAD origin/railway-build origin/docs/held-2026-09-12 origin/fix/scenes-array-guard
#   expect: <this checkpoint's commit> · 87596d7 · <same as HEAD> · 94ae237
git rev-list --count origin/railway-build..HEAD          # expect 54
git status --porcelain --untracked-files=no              # expect nothing
npx tsc --noEmit 2>&1 | grep -c "error TS"               # expect 34
```

---

## 2. THE THREE TASKS FROM THE LAST PROMPT — NOT STARTED

The last prompt was investigate-and-propose only; it produced the plan (§3.7) and nothing else. The three build/measure
items the plan calls for are **all not started**:

| task | status | exactly what's left |
|---|---|---|
| **Hook-wording hold-back commit** | ⬜ **not started** | One forward commit on the held branch: `server/_core/scriptPromptCraft.ts` → identical to `0288828^`; the structure-retry sentence in `server/_core/conceptScriptValidator.ts` → its `0288828^` text; `conceptScriptGenerator.ts` scene-1 line is already `0288828^` (H0). Keep the label-only hook check and harness. Update the tests that pin the hook wording. Prove: `git diff 0288828^ -- server/_core/scriptPromptCraft.ts` empty; retry string byte-equal; a new test that `buildConceptScriptPrompt` output is byte-equal to production's for a fixed input. Plan §2.2 |
| **Sprint 8 before/after comparison** | ⬜ **not started — no result** | Read-only script: load real stored copy from production (SELECTs only — ad copy, headlines, landing-page sections, emails, WhatsApp, offers), run `87596d7`'s `complianceAxis.ts` and the branch's over every item, list every verdict flip with its text; Meta-publish path reported separately; include a known-flip negative control. Pass rule and revert path (`git revert 5c2d34e 51bda65`) in plan §2.4 |
| **Honest completion** | ⬜ **not started** (investigated and proposed only) | Needs Arfeen's Skip decision first. **The count of campaigns marked `complete` without ad images was NOT measured** — first step when resumed: one read-only query, `SELECT COUNT(*) FROM campaignKits WHERE status='complete' AND selectedAdCreativeBatchId IS NULL` (plus ids). Proposal in plan Part 1 |

---

## 3. FINISHED TODAY (all on the held branch, all on GitHub, none deployed)

### 3.1 Trial paywall — option (b) — sprints 1 and 2 (`65af5e2`, `493650b`)
Record: `TRIAL_PAYWALL_OPTION_B_PROPOSAL_2026-09-24.md` (§6 build record). Trial users drive the Trail node by node,
rationed by the quota table; Auto Mode ("Build it all for me") Pro-only and unchanged; trial imports fill gaps node by
node (D4); ad images = one batch per trial (D3); push to Meta / GHL Pro-only (D6, server-side first statement + a clear
"Push to Meta / GHL · Pro" note on the kit page); plain-English limit messages that stop the Trail instead of the
"fizzled / Try again" loop. Browser-proven locally: `docs/screenshots/sprint2-trial-paywall/` (01–08, trial vs Pro).

### 3.2 D5 correction (`8881b69`)
Pro keeps every pre-sprint limit outside the new Trail step; only the new trial rationing skips Pro.

### 3.3 The quota-table sprint (`7f624fc`)
`server/quotaLimits.ts` is the **single source of truth for every tier** (Arfeen's ruling): both headline routes read
it (Pro headlines now **50**, were 6/20); landing pages use it only (the router's `{trial 2, pro 50, agency 500}` removed);
Pro's five formerly uncounted counters count; the monthly reset runs before the check for every tier; the 14 stale
`quotaLimits.test.ts` tests updated to the current table. Also closed: the sync `adCreatives.generate` route had no trial
gate.

### 3.4 Trial-expiry gating (`7f624fc` + `4cfad01`)
An ended trial is blocked on every generator, every Trail step, imports, 11 Tweak/regenerate procedures and 10 further
AI routes (expiry only, no new quota). Dropped as scan errors: `landingPages.reanswerOperatorField` (no model call) and
`landing.generatePreviewAssets` (public homepage demo, IP rate-limited).

### 3.5 GHL login renewal + truthful push results (`5ecfeac`)
Record: `GHL_DELIVERY_RELIABILITY_PROPOSAL_2026-09-24.md` (§D). One helper `getGhlAccess` renews on read
(compare-and-set save; rejected key ⇒ reconnect-required + message and button; GHL down ⇒ "try again in a minute",
nothing marked; "can't check" is its own snapshot state). Push = one list, writes, one read-back; each value confirmed /
rejected / missing / changed; "Saved to GoHighLevel — N values confirmed" only when all confirmed; banner only after
a confirmed push; "Push to both" fires only ready platforms. **Needs migration 0112 before deploy.** Browser-proven
against a fake GHL: `docs/screenshots/ghl-reliability/` (01–06).

### 3.6 Walkthrough checklist
`docs/handovers/WALKTHROUGH_CHECKLIST_2026-09-24.md` — Lead Magnet, manual, Arfeen's admin account, Meta paused;
GHL reconnect, the snapshot-setting fix, never "Skip", check GHL Custom Values directly, delete ZZ-GATE-POSITIVE-ARM,
the 5 October Meta expiry.

### 3.7 First-deploy plan
`docs/handovers/COMPLETION_AND_FIRST_DEPLOY_PROPOSAL_2026-09-24.md` — honest-completion investigation and proposal
(Part 1); first deploy: in / held table, hook wording held by one forward commit, 0112 before the code, sprint 8
before/after method, live verification (incl. the trial-account check), rollback (Part 2).

**Other records from today:** `END_TO_END_READINESS_2026-09-24.md` (+ §7 corrections: no GHL push ever succeeded on
record; Meta pushes all paused tests), `HOOK_BASELINE_MEASUREMENT_2026-09-24.md` (hook H0/H1/control; the 10/24 baseline
is stale, 17/24 is today's).

---

## 4. DECISIONS WAITING ON ARFEEN — OPEN

The bracketed text is the recommendation from the requester — **not approvals**.

1. **Pro caps** — Pro headlines to 50 and Pro's other caps enforced from the table. [yes] — the trial/quota group
   cannot deploy without it.
2. **Applying migration 0112** as part of the deploy. [yes]
3. **Creating and deleting a trial test account on production** for the one live trial check. [yes]
4. **Timing** — deploy and verify first, then the walkthrough on the new build. [yes]
5. **The Skip button** — [import for Offer, Method and Lead Magnet; removed for Headlines, Ad Copy and Landing Page].

---

## 5. STILL OPEN FROM EARLIER — restated so nothing is lost

- **H2** — the hook as its own output field. **Paused** (script-quality micro-tuning is not the priority).
- **K9** — event-fact false positives (Sunday, two hours) marked ungrounded; no fixture; gates any F5/F2 promotion.
- **D-g** — F5's enforcement tier, undecided.
- **F2 false-positive drift** — 0–1 → 2 per 42 runs after `23c563e`; not investigated.
- **Auto Mode's missing event / pricing questions** — non-lead-magnet Auto kits cannot publish their page.
- **Stuck-job cleanup** — the reaper sweeps `pending` only; a dead job stays `running` and holds a concurrency slot.
- **Import-path fixes** — price dropped, testimonials discarded, imported text not in the grounding corpus,
  correction-text leak, imported method thin, imported lead magnet has no body.
- Carried: Thread A (kit 187; `llm.ts:428` 8,192 ceiling), `readLadderAnswers` string bug, bonus-34 / bonus-43
  count mismatches, the "Auto Campaign Kit" orphan Meta campaigns (separate decision).

---

## 6. EXACT NEXT ACTION ON COLD RESUME

1. §1 verification.
2. **Ask Arfeen for the five decisions in §4** — nothing in the deploy can proceed without 1–4.
3. Meanwhile, work that needs no decision and writes nothing to production, in this order:
   a. **The count** — one read-only query: campaigns `complete` without ad images (§2).
   b. **The sprint 8 before/after comparison** (read-only) — its result decides whether sprint 8 ships.
   c. **The hook-wording hold-back commit** (held branch; tests + gates).
4. With decisions 1–4: follow plan §2.5 — gates, deploy markers counted in both builds, apply 0112 (go-ahead),
   push `railway-build` (go-ahead), verify §2.6, then Arfeen's walkthrough — **all before 2026-10-05**.
5. With decision 5: build honest completion (plan Part 1).

---

## 7. GATES — measured at write time

| gate | result |
|---|---|
| `npx tsc --noEmit \| grep -c "error TS"` | **34** — floor held |
| recorded suites | pipeline-fixes **414** · complianceFilter **31** · tokenCrypto **10** · conceptScriptValidator **14** · conceptScriptScenesGuard **15** · conceptScriptGenerator **11** · conceptScriptGeneratorDryRun **7** · complianceGate **24** · fabricationGateDefects **15** · groundingChecker **60** · coachFacts **21** · gateSummary **7** |
| this session's suites | trialAccess **21** · trialGates **54** · trialClient **10** · quotaLimits **33** · auth.getQuotaLimits **5** · budgetFloorCurrency **21** · nextStepBridge **20** · ghlReliability **34** |
| **total** | **827 passed, 0 failed, across 20 suites** |
| mutation checks this session | all caught: sprint 1 (10), D5 fix (7), sprint 2 (8), quota sprint (12), expiry gates (6), GHL reliability (13) |
| NUL-byte scan | **clean** — 61 files changed this session |
| production writes | **ZERO** |
| pushes to `railway-build` | **NONE** — `87596d7` |
| working tree | clean of tracked changes; untracked files are the long-standing screenshots etc. (**never `git add .`**) |

## 8. RECORDS INDEX

| topic | file |
|---|---|
| **this resume point** | `CHECKPOINT_2026-09-24_TRIAL_QUOTA_GHL_DEPLOY_PLAN.md` |
| first deploy + honest completion | `COMPLETION_AND_FIRST_DEPLOY_PROPOSAL_2026-09-24.md` |
| walkthrough | `WALKTHROUGH_CHECKLIST_2026-09-24.md` |
| trial paywall + quota + expiry | `TRIAL_PAYWALL_OPTION_B_PROPOSAL_2026-09-24.md` |
| GHL reliability | `GHL_DELIVERY_RELIABILITY_PROPOSAL_2026-09-24.md` |
| readiness investigation | `END_TO_END_READINESS_2026-09-24.md` |
| hook measurements | `HOOK_BASELINE_MEASUREMENT_2026-09-24.md` |
| superseded resume point | `CHECKPOINT_2026-09-24_HOOK_WORDING_SETTLED_H2_NEXT.md` |
