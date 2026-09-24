# HONEST COMPLETION + FIRST DEPLOY PLAN — investigation and proposal (nothing built) — 2026-09-24

Read-only: code at production `87596d7` and the held branch `5ecfeac` (the Trail and Campaign Kit completion code is
the same on both), git history, and two read-only production schema checks. No code changed, no production write.

---

## PART 1 — HONEST COMPLETION (item 3 of the readiness build order)

**The standard:** if a campaign can't be pushed, the coach is told plainly why, and what to do next.

### 1.1 Where "complete" is decided — five places, three different rules

| # | where | rule | notices an unpublished page? | notices a skipped node? |
|---|---|---|---|---|
| S1 | server `campaignKits.ts:262-290` `autoSelectBest` (after every generated node) | all **9** `selected*` fields, **including ad images** → `draft → complete` (never back) | ❌ | ❌ (field stays empty → never complete) |
| S2 | server `campaignKits.ts:572-606` `updateSelection` (after every card pick) | **8** fields — **ignores ad images** → `complete`, and back to `draft` if one is cleared | ❌ | ❌ |
| C1 | Trail progress bar `V2Trail.tsx:~336-360` | per stop; a `needs_publish` landing page is shown **pending** (the A10 fix) | ✅ | shows pending |
| C2 | Trail chat, end of the loop `V2Trail.tsx:1442` (auto) and `:2174` (manual) | **none** — *"CAMPAIGN COMPLETE — 11 of 11 — every piece built and accounted for"* posted whenever the loop ends | ❌ | ❌ |
| C3 | Campaign Kit page `V2CampaignKit.tsx:756` | `kit.status === "complete"` → "Complete" pill, Push enabled; otherwise "In Progress", Push **disabled with no reason** | ❌ | only as "In Progress" |

The push window itself (`PushKitModal.tsx:497-499`) does say *"Landing page not yet published… publish the landing page
first"* — the one honest message, and only after the coach has opened it.

### 1.2 Where they disagree
1. **Chat vs the bar.** An unpublished page: the bar shows Landing Page pending (C1), the chat says 11 of 11 (C2).
2. **Chat vs the kit.** A skipped node: the chat says 11 of 11 (C2); the kit stays `draft` (S1/S2) → "In Progress", Push
   disabled with no reason (C3).
3. **Server vs server.** S1 requires ad images, S2 does not. A kit can be `complete` via S2 with **no ad images** —
   and Meta push needs a creative.
4. **"Complete" vs pushable.** S1/S2 never look at publishing, so a kit can be `complete`, Push enabled, and Meta still
   blocked inside the window because the page has no live URL.

### 1.3 "Skip — I already have this": meant vs does
- **Meant** (`cf2ff20`, 2026-06-14): *"calling nodeSkips.skip + **marking imported**. Skipped nodes **don't block
  downstream**."*
- **Does** (`V2Trail.tsx:~1935-1947`): `trail.clearStale` + `nodeSkips.skip`. **It never marks the node imported** — the
  code's own comment records the change of plan mid-write: *"Upsert imported status … Actually we need a dedicated
  write. Use the existing nodeSkips mutation."* And it captures **no content**, so the kit field stays empty.
- **Consequences:** the node stays pending on the bar; the unified loop can re-offer it; the kit can never reach
  `complete` (S1/S2 need the field); Push stays disabled while the chat says 11 of 11. `nodeSkips` is keyed by
  **service**, not kit, and nothing on the Trail reads it (only the dashboard and the legacy wizard).
- Even if it had marked "imported", nothing would be imported: an empty field still blocks completion. "Don't block
  downstream" was never achievable with this shape.

### 1.4 Proposal — one readiness answer, used everywhere
1. **One server function** `getKitReadiness(kitId)` → `{ built, pushable: { meta, ghl }, blockers: [{ node, reason,
   action }] }`. Blockers, each with a plain sentence and the next step:
   - a node with nothing selected — *not reached* / *skipped* / *generation failed*;
   - **landing page not published** (`nodeStatuses = needs_publish`), with the publish gate's own reason where recorded
     (missing operator fact, leftover `[INSERT_*]` token, compliance hit, no template) and the action ("answer the 2
     remaining questions", "publish the landing page");
   - **no ad images** (Meta needs one);
   - no service on the kit (the push window cannot open).
2. **S1 and S2 share one completeness rule** (the 9 fields, ad images included — the Phase C C1 intent), so a kit is
   never `complete` by one path and not the other. A one-off read-only count of kits that S2 marked complete without
   ad images comes first (a data question, not a guess).
3. **The chat's end-of-Trail beat reads readiness.** Only *"Your campaign is built and ready to push"* when there are no
   blockers. Otherwise, e.g. *"10 of 11 done — your landing page didn't publish because two event details are
   missing. Answer them and I'll publish it."*, with a chip that goes straight there. The bar already tells the truth;
   the chat will match it.
4. **The Campaign Kit page** replaces "Complete / In Progress" with **Ready to push · Built — N things to fix · In
   progress**, lists the blockers above the Push button, and a disabled Push always says why.
5. **Skip, made honest — a product call for Arfeen:**
   - **Recommended:** on Offer, Method and Lead Magnet, "I already have this" **asks for it and imports it** (the
     import path already exists: `autoMode.importAssets` accepts offer / mechanism / lead magnet, and
     `trail.markImported` marks the stop). The node is then genuinely filled.
   - On Headlines, Ad Copy and Landing Page — which Meta push needs — **remove Skip**. If Arfeen wants it kept, it
     becomes "Leave this out", recorded per kit, and readiness names exactly what that costs (e.g. *"No ad copy — Meta
     can't be pushed"*).
6. **Tests, when built:** unpublished page ⇒ blocker named and the chat does NOT say ready; skipped node ⇒ blocker;
   S1 and S2 agree on every field combination; **negative control: a genuinely complete, published kit ⇒ no blockers
   and "ready to push"**. Browser proof of each state.

---

## PART 2 — FIRST DEPLOY PLAN FOR THE HELD BRANCH

**Premise:** Arfeen approves the Pro caps (flagged below — the trial/quota group depends on it). **No step here runs
while Arfeen's walkthrough is in progress.**

### 2.1 What goes in, what stays held

| group | commits | first deploy? | why |
|---|---|---|---|
| Scenes-crash fix | `231e655` | ✅ **in** | stops ~8 % of script generations crashing, no retry. Tested, negative-controlled |
| Trial paywall + quota table + expiry gates | `65af5e2` `8881b69` `493650b` `7f624fc` `4cfad01` | ✅ **in — only if Arfeen approves the Pro caps** | finished, tested, browser-proven locally. ⚠️ Pro headlines become **50** (from 6/20), and Pro offers / ad copy / ICPs / emails / WhatsApp start counting toward the table's caps. If Arfeen does NOT approve, this group stays held: the quota commit and the trial work are interlocked and cannot be split sensibly |
| GHL renewal + truthful push | `5ecfeac` | ✅ **in, after migration 0112** | fixes the walkthrough's two GHL problems (a login dying in a day; a push that says success when nothing arrived) |
| Grounding / checker (F2, F5, coach facts, latency, labels) | `799bd84` `41c817c` `d04a08c` `c609910` `23c563e` `60ec85f` `60a14bf` | ✅ in (inert) | no production caller — nothing changes on the live site |
| Dry-run / observation harnesses | `82d1949` `54c7555` `dbfe389` `ae175bc` | ✅ in (inert) | off unless a script passes them |
| **Compliance checker precision (sprint 8)** | `5c2d34e` `51bda65` | 🟡 **in only if the §2.4 comparison is clean**; otherwise held by a clean `git revert` of the two (they are the only commits touching `complianceAxis.ts` on the branch) | changes what the live compliance gate and the **Meta publish gate** block |
| **Video-script hook wording** | prompt text from `0288828`, `0787b33`, `a717818`, `d076ecb` | ❌ **held** — see §2.2 | measured no improvement (control 17/24 over-budget = the branch's 17/24; scripts produced 22/24 vs 19/24) |
| Docs | 27+ commits | ✅ in | no runtime effect |

### 2.2 How to hold back the hook wording — **recommended: one forward commit that restores the measured prompt**
- **Why not `git revert`:** the hook changes are tangled. `60ec85f` mixes the F5 grounding change with the hook
  check's demotion; `ae175bc` builds the measurement harness and a shared counter on the hook check; H0 already reverted
  part of `0787b33`. Reverting commits would drag grounding and tests out and conflict.
- **Why not a new branch from production:** it means cherry-picking ~20 code commits out of 52 interleaved ones — high
  risk of a missed dependency, for no benefit.
- **Recommended:** on the held branch, one commit that sets the **prompt-bearing text** back to exactly what the
  2026-09-24 same-day control measured (22/24 produced, 17/24 over-budget):
  1. `server/_core/scriptPromptCraft.ts` → identical to `0288828^` (HOOK_RULE and the SCRIPT_STRUCTURE_CRAFT hook
     bullet);
  2. the structure-retry sentence in `server/_core/conceptScriptValidator.ts` → its `0288828^` text;
  3. `server/conceptScriptGenerator.ts` scene-1 line — already the `0288828^` text since H0.
  - **Kept:** the label-only hook check (it records a label and blocks nothing — no prompt effect) and the harness.
  - **Proof it's clean:** `git diff 0288828^ -- server/_core/scriptPromptCraft.ts` empty; the retry string byte-equal to
    `0288828^`; `buildConceptScriptPrompt` output byte-equal to production's for a fixed input (a new test). This is the
    exact restoration the control run used, so the deployed prompt is the measured one.
  - Tests that pin the hook wording are updated in the same commit; tsc floor and suites as usual.

### 2.3 Migration order
1. **0111 `coachFacts` — already applied** on production (verified read-only today: the table exists). Nothing to do.
2. **0112 `ghl_reconnect_required` — apply BEFORE pushing the code.** Additive, two nullable columns. Verified read-only:
   not present on production today.
   - Safe in both directions: production's current code selects its columns explicitly (drizzle), so it ignores the
     new columns — 0112 can go on ahead of the deploy, and can stay in place after a rollback.
   - Apply with the house guard (target `@@version_comment = MySQL Community Server - GPL`, database `railway`), then
     verify with `INFORMATION_SCHEMA` that exactly the two columns exist. **Needs Arfeen's explicit go-ahead.**
3. No other migrations on the branch.

### 2.4 Sprint 8 compliance-checker: the before/after comparison
- **What changes:** `complianceAxis.ts` — the lexical checker's precision (clinical adjacency, the "afford" idiom,
  conviction senses), which feeds the generation gates and the **Meta publish gate**.
- **Method (read-only, no model calls):** a script loads real stored copy from production with SELECTs only — ad copy,
  headlines, landing-page sections, emails, WhatsApp, offers — and runs **both** checkers (`87596d7`'s `complianceAxis.ts`
  and the branch's) over every item, recording each item's verdict and hits under each.
- **Output:** every **flip** — blocked → allowed and allowed → blocked — with the text and the hit, for a line-by-line
  review. Counts per surface; the Meta-publish path reported separately.
- **Pass rule:** every allowed→blocked flip is a real Tier-1 problem, and every blocked→allowed flip is a documented
  false positive the sprint targeted. Anything else ⇒ hold sprint 8 (clean `git revert` of `5c2d34e` + `51bda65`) and
  ship the rest.
- **§15c negative control:** feed the comparison one item known to flip under the new rules (from the sprint's own
  fixtures) and confirm it shows up as a flip.

### 2.5 Deploy sequence (each step waits for the previous to be checked)
1. Arfeen confirms: the Pro caps, the migration, the deploy window — **not during the walkthrough**.
2. Build the hook-wording forward commit (§2.2) and run the sprint 8 comparison (§2.4); decide sprint 8.
3. Gates on the final branch: tsc floor, the recorded suites, NUL scan.
4. **Deploy markers (§15h), derived before the push:** build the branch's bundle, diff it against the live bundle, and
   choose markers counted in both — at least one that must **appear** (e.g. `Saved to GoHighLevel`, `push-pro-only-pill`)
   and one that must **disappear** (the old `slots pushed` result text).
5. Apply 0112 (§2.3), verify the columns.
6. Push `railway-build` (a fast-forward) = the deploy. Watch Railway until `SUCCESS` and the commit hash matches.

### 2.6 What gets verified on the live site, and how
1. **Build:** Railway `SUCCESS` on the right commit; both markers counted in the served bundle (appear 1, disappear 0).
2. **Boot:** logs clean — no `Unknown column`, font validation and reaper lines normal.
3. **GHL renewal happens on its own.** The first time Arfeen (or anyone) opens Settings or the push window, the app
   **renews the stored July key automatically** — a production write the code makes by design. Either the connection
   comes back (**Connected**, snapshot pill green) or it is marked **reconnect** and the message appears. Either result
   is correct and visible; read-only check: `ghl_access_tokens` either has a new expiry or `reconnectRequiredAt` set.
4. **Pro path — Arfeen's walkthrough is the verification.** Lead Magnet, manual, his account, following
   `WALKTHROUGH_CHECKLIST_2026-09-24.md`. It now also proves: the GHL push window says **"Saved to GoHighLevel — N
   values confirmed"** only when GHL has them (the checklist's step 20 check in GHL should agree), and his Pro account is
   never refused.
5. **The one trial-account check (production writes — needs Arfeen's go-ahead):**
   - Sign up a fresh account on the live site (a test address), which starts on the 14-day trial.
   - Check, in the browser: "Build it all for me" shows the Pro message · "I'll pick as we go" builds the ICP, then
     generates an Offer · on a Campaign Kit page Push shows **"Push to Meta / GHL · Pro"** with the note, and no push
     button exists.
   - **Stop before the Landing Page step** (it would publish a page to the live site).
   - Read-only DB check afterwards: the account's `offerGeneratedCount` rose by exactly one per generation, and it
     created no `meta_published_ads` or GHL rows.
   - Clean-up: delete the test account and its rows (a production write — the same go-ahead).
6. **24–48 hours of watching, read-only:** the compliance block rate from `complianceTelemetry` against the week
   before; any `FORBIDDEN` with `quota_exceeded` on a Pro account (there should be none below the table's caps); script
   generation failures (the scenes crash should be gone).

### 2.7 Rollback
- **Triggers:** boot failure; `Unknown column`; any Pro account refused below the table's caps; GHL pushes failing where
  they used to work; generation error rates up; compliance flips the comparison didn't predict.
- **Fastest (minutes):** Railway → the service's deployments → redeploy the previous deployment (`87596d7`). No git
  change; the live site is back on the old build.
- **Then make git match:** a single revert commit on `railway-build` back to `87596d7`'s tree — **never a force push**. The
  held branch keeps everything for the fix.
- **Migrations stay.** 0112's two nullable columns are ignored by the old code; 0111 was already live. Nothing to undo.
- **Data written meanwhile is compatible:** counters that moved stay valid numbers; a renewed GHL token works with the old
  code too, until its 24 hours end; `reconnectRequiredAt` is ignored by the old code.
- **Partial rollback option:** if only one group misbehaves (e.g. sprint 8), revert just its commits on the branch and
  redeploy, instead of rolling everything back.

### 2.8 Decisions this plan needs from Arfeen
1. **Pro caps** — if not approved, the trial/quota group stays held (it cannot be split sensibly).
2. **Apply migration 0112** — explicit go-ahead.
3. **The trial-account check** on production — creating and then deleting a test account.
4. **The deploy window** — recommended: deploy, verify §2.6 1–3, **then** do the walkthrough on the new build (it gets
   the GHL renewal and the truthful push). Or walkthrough first on the current site, then deploy.
5. **Honest completion (Part 1)** — which nodes keep "Skip", before that is built.
