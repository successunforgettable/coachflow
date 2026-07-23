# ZAP Handover — STEP 1 (A7/A10/A14) + STEP 2 (bonus Layer 1) SHIPPED + live

Two ships recorded here. **STEP 2 (bonus build, Layer 1) is the latest — shipped 2026-07-24.** STEP 1 (the
three fixes A7/A10/A14) shipped 2026-07-23 (detail below). Prior: `docs/handovers/ZAP_Handover_July22_2026_v2.md`.

## 🚢 STEP 2 — BONUS BUILD (Layer 1) SHIPPED + LIVE (2026-07-24)
- **Migration `0092`** applied to prod via Arfeen's "execute" (`bonuses` table — **19 columns incl. `shortLine`**,
  3 indexes + PK, FK `bonuses_userId_users_id_fk` → users), **BEFORE** the code deploy.
- Code **`d16c66c`** pushed; Railway deploy **`a0228625` = SUCCESS on that exact SHA** (frozen install passed,
  no drift). **Deploy-verify 5/5** (no regression, Batch A intact, campaign-214 → 200).
- **🔑 SERVED BUNDLE UNCHANGED BY DESIGN — do NOT misread as a failed deploy.** Layer 1 is **server-side only**
  (bonusGenerator / validator / orchestration / offer+email generators / schema) — **zero `client/src` changes**,
  so there is no new client bundle to fingerprint (`index-pYeJbqmn.js` stayed). The deployment proof is the
  **Railway-confirmed deployed-commit SHA = `d16c66c`**, not a bundle-hash change. (STEP 1 had a V2Trail client
  change and DID move the bundle; this ship legitimately does not.)
- **What's LIVE:** ICP-derived bonus generation — 3 bonuses, one per type (**Accelerator / Gap-Filler /
  Objection-Crusher**) via Problem-Solution Mapping; **single source of truth across offer + LP + email** (offer
  whole-line fill with title+shortLine; LP `content.bonuses` overwritten — kills the invented swipe-file +
  lead-magnet-as-bonus; email fed the real bonuses so reveals reference a real one); tightened **title register**
  (positive-framing); full validator guardrails (`validateBonusFabricationPatterns` — 6 patterns + structural);
  harness **A15–A21 + A23**. Gates at ship: **TS 35, unit tests 22/22, harness 22/24** (A8/A11 pre-existing/out-of-scope).
- **✅ LAYER 1 OPEN-VERIFICATION ITEM — CLOSED (2026-07-24) by the machine, not by manual eyeballing.** A prod
  smoke run drove a REAL campaign on prod: **A15–A23 green on prod** (kit 187 / LP 222 unpublished / 3 bonuses
  under the test account, preserved — no teardown), **A24 PASS** (no publicUrl, guard held). Prod run: **23/25**
  (the two reds are the known A8 ad-copy deck + A11 Class-B/C tokens). See the PROD SMOKE PATH section below.
- **Layer 2 (hosted PDF) remains deferred** — needs its own pass with live post-deploy verification (Cloudflare
  fail-fast → `magnetPdfUrl` null in the clean-room, so it can't be proven there).

## 🤖 PROD SMOKE PATH IS LIVE (2026-07-24) — the machine is the prod functional test
The Playwright harness can now drive a REAL campaign on prod after each deploy (so the machine, not Arfeen, is
the functional test). Full setup + maintenance: memory `project_prod_smoke_harness.md`.
- **Test coach (dedicated, non-privileged):** `zap-e2e-smoke@mailinator.com` · id **117174** · openId
  **`native_ea8a5ee639013dd01bc0b6b585b9dd52`** · `pro`/`active`/NULL expiries (non-expiring, no admin). Created
  via the normal native signup.
- **Auth:** harness `E2E_PROD=1` logs in via the EXISTING `nativeAuth.login` — **NO bypass, NO new endpoint;
  `/api/test-login` stays dev-only (NODE_ENV gate untouched).** Creds from env only (`TEST_PROD_EMAIL` /
  `TEST_PROD_PASSWORD` / `E2E_DB_URL`). **Password lives ONLY in `~/.zap-e2e-creds.env` (chmod 600, outside the
  repo) — never committed.** Opt-in teardown `E2E_TEARDOWN=1` (OFF by default).
- **Server no-publish guard:** `E2E_NOPUBLISH_OPENID` env-gated skip in the orchestration LP publish block —
  stages `needs_publish` instead of publishing, **for that one openId only**. **FAILS OPEN when unset → normal
  publish for everyone; no real coach affected under any misconfiguration.** Deployed at `9fb861a`; armed via
  `de5ef85f`. **WHY server-side (do NOT "simplify" into the harness):** publish runs INSIDE the same
  orchestration job as bonus generation — a spec-only publish guard is impossible; A24 is the detection layer.
- **🔴 HARD RULE:** NO prod harness run until `E2E_NOPUBLISH_OPENID` is verified **active on the running server**
  (resolves via `railway run` AND the applying deploy reached SUCCESS) — not merely saved in the dashboard.

---

## 🚢 THE SHIP (forward-sequence step 1 — DONE)

**Migration `0091` (prod write, applied via Arfeen's explicit "execute"):**
- `ALTER TABLE nodeStatuses MODIFY COLUMN status enum('generated','imported','stale','dismissed','needs_publish') NOT NULL DEFAULT 'generated'`.
- Readback confirmed: enum now carries `needs_publish`; **73 rows unchanged**.
- Applied **BEFORE** the code deploy — no window where the A10 code ran without the enum (the insert would otherwise throw on a publish-failure).

**Code shipped:**
- `b9e3284` pushed; **`HEAD = origin/railway-build = b9e3284`**.
- Railway deployment `ad4e9b9d` = **SUCCESS** (build **and** deploy). `pnpm install --frozen-lockfile` passed — **no lockfile drift** (the Jul-22 `ERR_PNPM_OUTDATED_LOCKFILE` class stayed closed: `@playwright/test` absent from `package.json`, no `package-lock.json`).

**Live-verified (committed ≠ deployed — proven):**
- Served bundle hash **changed `index-BP4-9u8H.js` → `index-pYeJbqmn.js`**.
- `e2e/deploy-verify.spec.ts` — **5/5 PASS**: prod reachable (3082KB served JS), `structured-input` + "Venue name & city" markers present (Batch A intact, no regression), `campaign-214` → 200.

**Now LIVE on prod** (on top of the previously-shipped Batch A + offer facts-wire):
- **A7** — no fabricated cities (`server/lib/locationSweep.ts` deterministic backstop + prompt LOCATION LOCKs on `adCopyGenerator`/`hvcoGenerator`).
- **A10** — LP completion gate: any non-publish flags `nodeStatuses.landingPage='needs_publish'` (explicit non-complete state, NOT a throw); `V2Trail` STOPS maps it non-complete.
- **A14** — FAQ scaffolding strip (`stripObjectionScaffolding` in `icps.ts`, at source).
- (already live from the Jul-22 ship: Batch A structured facts inputs · typed-"free"→`__FREE__`→Iman routing · WhatsApp date-derived length · offer facts-wire.)

**Harness proof (before the ship):** full manual free-event run **14/16**, with **A7 / A10 / A14 GREEN through real orchestration** (generate → location sweep → fact-apply → publish-fail → `needs_publish` write). The two RED are known & out-of-scope (A8, A11 — see TRACKED BUGS). **Skip-safety proven live:** the harness's new 0-card recovery clicked "Skip — I already have this" and all selections were preserved (offer 7, mechanism 76, hvco 241, headline 41, adCopy 37) — the app's 0-card Skip branch advances WITHOUT clearing selections.

## 🔧 HARNESS CHANGE (harness-only, NOT committed to the deploy — in the working tree)

`e2e/manual-wizard-free-event.spec.ts` gained a **0-card recovery** in the dealable-node driver: when
"Lock it in →" never appears (the ad-copy 0-card wall), it clicks "Skip — I already have this" to re-sync
the parked app, snapshots all upstream selections before/after to **prove Skip clears nothing** (records an
`S-<field>` row; hard-stops + gates phase-3 if anything is cleared). This is what unblocked A7/A10 verification
(the run previously deadlocked one node BEFORE landing page). It is a TEST change; it does not deploy.

## ⚠️ OPERATIONAL CONSTRAINTS (these will bite the next harness-heavy run — action first)

- **Disk near-full:** `412Gi / 460Gi` used, **~2.3Gi free** after clearing regenerable caches/trash. The harness
  writes **~629MB `trace.zip` + video per FAILED run** (`retain-on-failure` in `playwright.config.ts`) — this
  filled the data volume mid-ship and blocked tooling (ENOSPC on tool output). **Required pre-step before the
  next harness run:** set `trace: 'off'` (or add a cleanup step) in `playwright.config.ts`, and/or free real disk.
  Also killed the leftover playwright/chromium processes that were holding deleted trace files open.
- **Clean-room DOWN:** the local dev server (`:3000`, `pnpm run dev` / `tsx watch`) was **killed** during the
  disk recovery; `mysqld` (`:3307`) may still be up. **Must restart the dev server before the next manual-wizard
  harness run.** Not needed for the bonus build's early stages.

## 🐞 TRACKED BUGS (real, NOT fixed — own passes; NOT bundled into any migration-gated ship)

- **A8 — ad-copy 0-card deck** (`project_bug_manual_deck_skipped_null_id`): **re-confirmed live on a FRESH run**
  despite the `resolveDeckSourceId` fix (`b0a15ca`) — that fix did NOT fully close the ad-copy case. Clean-room
  evidence: the auto-selected `selectedAdCopyId` row is a `headline`-type row; the deck fetch resolves its
  `adSetId` then filters `contentType='body'` — the set genuinely HAS 3 body rows, yet the deck rendered 0
  (fetch/timing miss). Ad Copy shows ✓ in the STOPS bar while the deck is empty → app parks on "your ad copy
  options didn't come through." A real coach hits this. Own pass.
- **A11 — 27 unresolved `[INSERT_*]`:** the known **facts-schema gap** — the upfront facts step captures
  date/venue/price ONLY, but generators bake `EVENT_TIME`, `EVENT_TIMEZONE`, `PARKING_INFO`, `DRESS_CODE`,
  `BONUS_1–5_NAME/VALUE`, `GUARANTEE_TERMS`, `BOOKING_URL`, `PROGRAMME_DURATION`, `COHORT_*`, etc. This is the
  documented **"Way 2 per-node scan-ask"** item (Phase 2). NOT a regression (our fixes fill date/venue/price
  cleanly — that's why A6/A7 are green). Note: A11's placeholders are WHY A10's `needs_publish` correctly fires —
  the page genuinely isn't publishable yet, and the gate honestly says so.

## 📝 TRACKED WORK ITEM — Copy readability / register pass (raised by Arfeen live-run, never actioned)
Logged 2026-07-24 so it survives sessions. **Its own pass — do NOT bundle into a structural ship.** Full detail:
memory `project_copy_readability_register_pass.md`.
- **Problem:** generated copy across **headlines / landing-page / offer / method names** is overcomplicated &
  jargon-heavy — language real people don't use. Arfeen's live examples: *"Start The Postpartum Recalibration
  Protocol, and Drop the Baby Weight in 12 Weeks — Without Cutting Calories While Your Body Is Still
  Breastfeeding"*; a ~40-word LP header; jargon method names ("Postpartum Recalibration Protocol").
- **Current state:** A13 **measures** Flesch-Kincaid + reports a score (recent runs FK **9.4–9.6**) but **no bar
  was ever agreed** — it passes a threshold nobody set. Measurement exists; the fix does not.
- **Not just a number:** jargon like "Postpartum Recalibration Protocol" can score fine on syllables and still be
  jargon → needs a **REGISTER standard**, not only an FK threshold.
- **Proven template:** the **bonus-title register fix** — positive-framing prompt guidance (NEVER negative
  "Wrong:/Right:" examples — §14), verified in a harness run. Apply the same shape to the copy generators.
- **Open decision for Arfeen:** acceptable FK grade for **headlines vs body copy**, and the **register standard**
  for his market. A13 then gets a real bar; generators get positive-framing register guidance.
- **Priority (Claude's rec on record):** run **after Layer 1 ships, ahead of Layer 2 and Problem B** — visible on
  every campaign a coach publishes.

## 🧭 FORWARD SEQUENCE — steps 1 & 2 DONE, rest intact

1. ✅ **Ship the 3 in-flight fixes** (A7/A10/A14) — DONE.
2. ✅ **Bonus build, Layer 1** — DONE + LIVE (migration 0092 → `d16c66c` → deploy `a0228625` SUCCESS). **Layer 2
   (hosted PDF) is a SEPARATE deferred pass** (needs live post-deploy verification; can't be proven in the clean-room).
2a. **Copy readability / register pass (NEXT — Claude's rec on record)** — see the TRACKED WORK ITEM below; it's
   visible on every published campaign and slots in ahead of Layer 2 and Problem B.
3. **Problem B** — per-node review surface + existing-assets import (forward-only wizard; retire stale/re-crown/dismiss).
4. **Andromeda backbone** — piece 1 (REAL Meta fatigue/diversity signals: `frequency`/`first_time_impression_ratio`/
   duplicate-post detection — the practitioner "score" fields DON'T exist, CC-verified) + piece 2 (P.D.A. concept
   axis + validator). AFTER Problem B (shared per-node review machinery). Re-verify the thesis vs Meta's live docs first.
   Piece 2 touches `adCopyGenerator.ts` (the A7 file) → does NOT start until current work ships.
5. **Andromeda downstream** — LP message-match, video-script generator (extends paused `server/routers/videoScripts.ts`).
6. **Andromeda closed write-back loop** — SEPARATE, gated, LAST (autonomy + coach ad-spend; per-action approval).
7. **Parked** — OpenAI GPT Image 2 evaluation + swap.

Full Andromeda brief (DOCUMENTATION — do NOT execute until told): `docs/andromeda/EXECUTION_BRIEF.md`.
**Deferred (unchanged):** off-ICP testimonial ICP-filtering — product call, leave as-is.

## 🧪 GATE RECONCILIATION (not blocking)

**TS baseline reads 35 under pnpm, vs the 38 recorded in CLAUDE.md §8.** The difference is the `@types/node`
resolution artifact: a fresh `npm ci` pins `@types/node@24.12.0` whose iterator typings surface two pre-existing
`TS2802` errors → 38; the pnpm-resolved tree yields 35. **Since the repo is now pnpm-only (the deploy fix
standardized on pnpm; `packageManager` pins `pnpm@10.4.1`), the canonical baseline under pnpm is 35.** The three
fixes add ZERO errors either way. Recommend CLAUDE.md §8 adopt **35 (pnpm-canonical)** so the gate is enforceable
against the actual toolchain. vitest ≥ 565; `locationSweep` 6/6.

## RESUME POINT

Step 1 shipped + live. Next is **step 2 (bonus build)** once Arfeen supplies the six research reports + 3 product
decisions. **Before any next harness run:** fix the trace-disk constraint and restart the clean-room dev server.
