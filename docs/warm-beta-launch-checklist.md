# ZAP Warm-Beta Launch Checklist

**Audience:** internal operators (you, Arfeen, support).
**Date created:** 2026-05-16 (post Phase D Sprint 3).
**Production SHA at lock:** `0f4e080`.
**Classification:** SAFE FOR WARM BETA — WITH CONTROLS.

Use this checklist as the gate before letting any external warm-beta cohort
member log in. Walk top-to-bottom on launch day; every item must be either
checked or explicitly waived in writing.

---

## 1. Pre-launch verification (T-24h)

### 1.1 Code state
- [ ] `git log -1` on production branch resolves to `0f4e080` or a later SHA
      that contains the Phase D Sprint 3 commit.
- [ ] `git status` on the deploy machine is **clean** — no untracked files,
      no stashed changes, no half-applied patches.
- [ ] `origin/railway-build` and local HEAD point at the same SHA.
- [ ] No `WIP`, `DEBUG`, `FIXME_BEFORE_BETA`, `TODO_REMOVE` markers in any
      file shipped to production (see §1.4 instrumentation audit).

### 1.2 Build gates
- [ ] `npm run check 2>&1 | grep -E "error TS" | wc -l` → exactly **53**
      (the locked baseline). Any drift requires investigation before launch.
- [ ] `npx vitest run server/pipeline-fixes.test.ts` → **170 / 170 passing**.
- [ ] Phase D suite specifically: all 46 tests across the four Phase D
      describe blocks (Sprint 1 validator: 17, Sprint 1 retry-loop: 6,
      Sprint 2 archetypal: 5, Sprint 3 detector + UX: 19) green.

### 1.3 Database / migrations
- [ ] `drizzle/` ends at `0072_add_kit_ad_creative_batch.sql` — Phase D
      Sprints 1/2/3 introduced **no new migrations**. If your local list
      shows a higher number, investigate before deploying.
- [ ] On the production DB, run an `INFORMATION_SCHEMA` audit confirming
      the `0072` schema is applied (memory note: committed `drizzle/*.sql`
      ≠ applied — verify directly via DB query, not file presence).
- [ ] No half-applied migrations from previous sprints. Run the
      auto-mode-reaper Option-α resume against any kit jobs stuck at
      `status='running'` before opening the cohort (memory:
      `project_reaper_option_alpha_gap`).

### 1.4 Instrumentation audit
- [ ] No new `console.log` calls in generators, validators, orchestration,
      or the Phase D Sprint 3 files (`placeholderDetector.ts`,
      `KitPlaceholderBanner.tsx`, banner integration in `V2CampaignKit.tsx`,
      `PushKitModal.tsx`).
- [ ] Existing `console.warn` lines in `server/offersGenerator.ts` and
      `server/landingPageGenerator.ts` (lines containing
      `[offersGenerator]` / `[landingPageGenerator]` prefixes) **stay in
      place** — these are the warm-beta observability surface. Do not
      strip them.
- [ ] One known pre-existing debug `console.log` in
      `client/src/v2/V2CampaignKit.tsx` (`[CampaignKit] params:`) is
      acceptable for warm beta. Schedule cleanup post-cohort, do not
      remove during launch window (scope discipline).

### 1.5 Environment
- [ ] `ANTHROPIC_API_KEY` valid + quota healthy for projected cohort load.
- [ ] Meta + GHL OAuth credentials current; no expired tokens for the
      operator service account.
- [ ] Resend / Stripe / Forge / ElevenLabs / Pexels API keys present in
      Railway env (only check existence, do not log values).
- [ ] Database connection pool sized for cohort: a warm-beta cohort of N
      operators each running Auto Mode = N concurrent cascades each
      hitting ~9 LLM calls; size accordingly.

---

## 2. Onboarding flow readiness

- [ ] New cohort member can complete service setup (industry, ICP, source
      of truth fixtures) without hitting validation dead-ends.
- [ ] **Source-of-truth fields are clearly labeled as REQUIRED** — pricing,
      guarantee terms, cohort cadence. Operators who skip these will get
      `[INSERT_X]` placeholders in their output. This is intentional, but
      the banner only catches it after generation — better to catch at
      input.
- [ ] First-run user sees no broken UI in the v2 flow (Stage1–Stage4
      onboarding components; canvas-confetti loads).
- [ ] Onboarding does not require any action that the operator hasn't been
      briefed on in the operator guide (`docs/warm-beta-operator-guide.md`).

---

## 3. Auto Mode generation flow

- [ ] Operator triggers Auto Mode and the orchestrator dispatches the
      9-step cascade (offer → hero mech → lead magnet → headlines → ad
      copy → LP → email seq → WhatsApp seq → ad creatives).
- [ ] Each step persists its result before the next step starts (so a
      mid-cascade Railway redeploy does not strand work — but see §5.1
      reaper).
- [ ] Offer step routinely emits canonical `[INSERT_X]` tokens when
      operator did not supply price/guarantee/cohort facts — this is
      EXPECTED behaviour per Phase D Sprint 1. Banner surfaces these.
- [ ] LP step retries on archetypal-testimonial fabrication; check warn
      logs after a few cohort runs to confirm validator-retry rate is
      sane (see §6 monitoring).

---

## 4. Placeholder review flow (Sprint 3 UX gate)

- [ ] Operator lands on `/v2/campaign-kits/[id]` and sees the
      `KitPlaceholderBanner` at the top of the page **iff**
      `placeholderReport.total > 0`.
- [ ] Banner shows: count, per-asset chips with sub-counts, up to 3
      example tokens, and a "Review & Complete →" CTA.
- [ ] Clicking the CTA scrolls to the highest-count affected asset
      section. (`data-section-key` anchor on each `AssetSection`.)
- [ ] Operator edits the asset, returns to the kit page, banner count
      decrements. Repeat until banner self-hides (`report.total === 0`).
- [ ] On a fully-clean kit (operator supplied every fact during
      onboarding), banner never appears.

---

## 5. Meta / GHL push flow

- [ ] Operator clicks "Push to Meta / GHL" → `PushKitModal` opens.
- [ ] If `placeholderReport.total > 0` and not yet pushed, the modal
      shows the **compact** `KitPlaceholderBanner` + "← Review on kit
      page first" back button.
- [ ] Clicking the back button closes the modal and scrolls the page
      to the banner anchor (`requestAnimationFrame` coordination).
- [ ] If `placeholderReport.total === 0`, the modal shows no warning
      and the operator can proceed directly to platform selection.
- [ ] Meta push: campaign + ad-set + creative push completes (with
      LINK_CLICKS goal, LOWEST_COST_WITHOUT_CAP bid strategy per the
      C3 follow-on series).
- [ ] GHL push: master-snapshot CV architecture applies (Phase C C3
      follow-on 8). Operator approves Apply Snapshot UX.

### 5.1 Mid-cascade resilience
- [ ] Auto-Mode reaper / Option-α resume verified working against the
      stranded-`running` job class (memory note); manual recovery path
      documented for support.

---

## 6. Monitoring procedures (warm beta)

Lightweight observability — no new instrumentation added in this prep
sprint. Operators monitor existing warn-level logs.

### 6.1 Log surfaces to tail
| Surface | What to watch | Alert threshold |
|---|---|---|
| `[offersGenerator] Offer fabrication check failed on attempt N/3` | Per-retry validator hits | More than ~30% of generations hitting attempt 2 = prompt drift |
| `[offersGenerator] Offer fabrication check exhausted retries` | Best-effort persistence | **>5% of generations** in any 24h window → halt cohort, investigate |
| `[landingPageGenerator] Testimonials fabrication check failed on attempt N` | LP retry rate | Same as above |
| `[landingPageGenerator] Testimonials fabrication check exhausted retries` | LP best-effort persistence | **>5% in 24h** → halt cohort |
| `[landingPageGenerator]   hit N: <classId>` | Per-hit details | Inspect to see if a new fabrication class is emerging that the catalog doesn't cover |
| Banner show-rate (placeholder density) | What fraction of kit visits render the banner | Steady state expected: 40–80% (kits with at least one operator-fill gap). 100% = onboarding capture broken. 0% = detector broken. |

### 6.2 Placeholder-density sampling
- [ ] Once per week, sample 5 random kits from the cohort and run
      `detectPlaceholders` against their persisted brief data. Confirm
      banner show/hide matches detector output. (Manual sanity check;
      protects against silent regression in the `useMemo` chain.)

### 6.3 Generation-failure surface
- [ ] Tail orchestration error logs for `TRPCError` / `Internal Server
      Error` in any of the 9 cascade steps. Phase D did not change
      these — baseline failure rate from Phase C C3 era applies.

---

## 7. Rollback procedures

- [ ] Revert to `1ece275` (Sprint 2 head) is a single `git reset --hard`
      on the deploy branch + Railway redeploy. This loses the
      PlaceholderBanner UX (kits silently ship with `[INSERT_X]` tokens
      to operators with no surfacing) but preserves Sprint 1/2
      generator hardening.
- [ ] Revert to `77ddce7` (post-baseline-lock, pre-Sprint-2) drops the
      LP archetypal validator. Only do this if Sprint 2's validator is
      proven to cause unbounded retry exhaust on legitimate inputs.
- [ ] Revert to `f324018` (Sprint 1) is the deepest tolerable rollback —
      keeps offer hardening but loses all post-Sprint-1 work.
- [ ] Do **not** rollback below `f324018` without explicit decision —
      pre-Sprint-1 the offer generator emits fabricated currency/cohort
      data and was classified launch-blocker per `redteam-audit-baseline-v1`.

---

## 8. Support procedures

- [ ] Single support channel (Slack/email) is staffed during cohort
      active hours.
- [ ] Support runbook references `docs/warm-beta-operator-guide.md`
      first — most operator questions are placeholder-review or
      kit-completion flow.
- [ ] Escalation path for fabrication report: operator says "I see
      something the AI invented" → support pulls the kit's brief
      JSONs, runs the detector + validator manually, and if it's a
      genuine generator slip (not just an unfilled placeholder),
      files it against the next forensic-baseline backlog item.
- [ ] Escalation path for push failure: operator says "Meta / GHL
      push failed" → support inspects the `pushes` audit log (per
      Phase C C3) and the orchestration `jobs` table.

---

## 9. Known limitations

Reference: `docs/warm-beta-known-limitations.md` (sister document).
The big four to internalize:

1. **AI drafts; operator finishes.** Canonical `[INSERT_X]` tokens are
   intentional gaps.
2. **Retry-exhaust ships best-effort.** ~3 LLM attempts per fabrication
   check; on exhaust, content ships with diagnostic log.
3. **Out-of-scope generators** (email / WhatsApp / headlines / ad copy /
   lead magnet / hero mech / ad creatives) lack the Phase D Sprint 1
   retry-with-failContext fabrication hardening. They have schema/shape
   validators but not Sprint-1-grade prompt fortification. Phase E
   scope.
4. **No v3 forensic harness baseline** post-Sprint-2. Sprint 2's
   archetypal validator is proven by unit tests, not by a fresh 15-fixture
   forensic. Schedule v3 forensic as the first post-warm-beta backlog.

---

## 10. Go / no-go gate

Final approval before opening the cohort:

- [ ] §1 pre-launch verification — all checked
- [ ] §2 onboarding readiness — confirmed on a fresh test account
- [ ] §3–5 generation + UX + push flow — walked end-to-end on staging
- [ ] §6 monitoring surfaces — log tail is live + alert thresholds set
- [ ] §7 rollback procedure — operator knows the revert SHAs by heart
- [ ] §8 support — staffed
- [ ] §9 limitations — every cohort member has read the operator guide

If every box is checked, **launch warm beta**. If any box is unchecked,
**do not open the cohort** until that gap is resolved or explicitly
waived in writing by the operator owner.
