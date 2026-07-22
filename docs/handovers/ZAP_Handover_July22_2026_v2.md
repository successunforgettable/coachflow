# ZAP Handover — 2026-07-22 (v2) — the turnaround + deploy pipeline fixed

State-save before the run-10 window. **No new feature code in this checkpoint** — it commits docs +
the banked bonus spec; the three in-flight fixes stay in the working tree (unpushed, migration-gated).

## 🎉 THE TURNAROUND (record prominently)
After a full session where **nothing shipped**, **Batch A (structured facts inputs + sentinel routing) +
offer facts-wire are now LIVE on prod and machine-verified in the served bundle.**
- `HEAD = origin/railway-build = 1c86e3d`.
- Served bundle changed **`index-BPwzEJuO.js` → `index-BP4-9u8H.js`**.
- **Deploy-verification Playwright spec (`e2e/deploy-verify.spec.ts`): 5/5 PASS** against zapcampaigns.com —
  `structured-input` + "Venue name & city" markers present in the served bytes.
- The **"committed but not in served bundle"** failure class is closed. Every ship now watches the Railway
  build reach **SUCCESS** and verifies the served bundle — no more assuming a push deployed.

## 🔴 DEPLOY-PIPELINE ROOT CAUSE + FIX (critical — do not lose)
Every deploy had failed for ~a day with **`ERR_PNPM_OUTDATED_LOCKFILE`**. Cause: `@playwright/test` was added
to `package.json` + npm's `package-lock.json` but **never to `pnpm-lock.yaml`**; Railway builds with
`pnpm install --frozen-lockfile`, which rejects any `package.json`↔`pnpm-lock` mismatch → **the build aborted
before it started.** Local `npm ci` masked it (npm vs pnpm). This is why even the docs-only `4576217` failed.

**Fix applied (`1c86e3d`):** removed `@playwright/test` from `package.json` (test tooling is never a deployed
dep — the harness installs Playwright out-of-band in the clean-room), removed the vestigial `package-lock.json`,
**standardized on pnpm**. `pnpm-lock.yaml` needed no change (it never had Playwright) and the frozen check now
passes.

**🧨 RESIDUAL LANDMINE — STANDING RULE:** if anyone runs `npm install` locally it regenerates
`package-lock.json` and **re-opens the exact drift**. **The team must use pnpm** (matches Railway; the
`packageManager` field pins `pnpm@10.4.1`). Never add a dep with `npm`.

## ✅ LIVE ON PROD NOW (verified in the served bundle)
Structured date/venue/price facts inputs · typed-"free"→`__FREE__`→Iman routing · WhatsApp length-from-date
(canonical date kills the NaN→3 bug) · offer facts-wire (offer carries the real price/date, no fabrication).

## 🔧 IN FLIGHT — run 10 (~45 min), three decision-free fixes (in the working tree, NOT pushed)
1. **A7 fabricated cities:** `server/lib/locationSweep.ts` — deterministic backstop (curated ~45-city list;
   keeps a coach-supplied city, replaces any fabricated city → `[INSERT_EVENT_VENUE]`, which facts-apply then
   fills). Wired in the orchestration LP case (event pages, before facts-apply). + prompt LOCATION LOCKs on
   `adCopyGenerator:281` and `hvcoGenerator:104` (both instructed `[city]`/`[City]` fabrication). Unit test
   `locationSweep.test.ts` 6/6.
2. **A10 LP completion gate:** gate on a real publish — on any non-publish (review-draft, unbuilt template,
   discovery-needs-booking, or a swallowed Cloudflare failure) the orchestration flags
   `nodeStatuses.landingPage = 'needs_publish'` (an explicit non-complete state, **NOT a throw** — the cascade
   continues). `V2Trail` STOPS maps `needs_publish` → non-complete so there's no false 11-of-11.
3. **A14 / FAQ scaffolding:** `stripObjectionScaffolding` in `icps.ts` cleans the stored ICP `objections`
   (strips `**` + "What they say:/What they mean:" → clean prose) at the SOURCE — every downstream surface
   inherits clean copy. Harness adds A14 (no scaffolding / raw `**` in served LP copy).

Gates so far: **TS 38**, `locationSweep` 6/6. Harness climbing from 9/14 → ~12–13/14 after run 10.

## 🚨 MIGRATION GATE — must not miss
A10 needs **migration `0091_nodestatus_needs_publish.sql`** (adds `'needs_publish'` to the `nodeStatuses.status`
enum) **applied to prod BEFORE/WITH the code deploy**, or the orchestration insert fails (on prod, publish
usually succeeds so it mostly no-ops, but a publish-failure would throw and break the cascade — the opposite
of the fix). This is a **PROD WRITE → routes through Arfeen's explicit "execute" gate; CC does not apply it
autonomously.** Applied to the local clean-room already. **Flag at push time; do not push the A10 code until
0091 is executed on prod.** A7 + FAQ are pure code (no migration).

## HARNESS + ENV
Machine-tests-the-machine holds: no fix is "done" until its harness assertion passes AND (for prod) the served
bundle is verified. Clean-room: local `mysqld :3307` + no-watch dev server `:3000` (restarted with the three
fixes loaded); status at checkpoint: **UP**. Full run ~45 min; resume mode (`E2E_RESUME_KIT=N`) drives just
LP→whatsapp on a positioned kit.

## 💰 BONUS RESEARCH — BANKED, SPEC'D, PARKED (its own future run)
Six NotebookLM reports (taxonomy · ICP-derivation · coherence/number · honest value-framing · deliverable
format · failure modes) are the bonus source-of-truth. **They are NOT yet in the repo** — place them under
`docs/bonus-research/` (git-lfs, mirroring `docs/landing-page-references/`). The filtered build spec (guru
value-inflation removed, structural mechanics kept) lives in `docs/bonus-research/README.md`:
- Generate **3 bonuses** — one **Accelerator** + one **Gap-Filler** + one **Objection-Crusher** (Arfeen's
  varied stack), each derived via **Problem-Solution Mapping** from the ICP.
- Each is an **implementation asset** (checklist / template / script / SOP — never an info-dump).
- **Honest framing**: outcome / time / problem — **NEVER a fabricated £**; "included free" default, a £ value
  only if the coach supplies it.
- Rendered to premium craft via the **existing lead-magnet pipeline** (`leadMagnetContentGenerator` →
  `leadMagnetRenderer` → `leadMagnetPublisher` — already produces real hosted PDF deliverables; bonuses ride
  it — **moderate reuse, not net-new**).
- **3 product decisions still PENDING from Arfeen:** (1) confirm generate-3, (2) value-line handling,
  (3) Class-C facts reframe-vs-ask. The A11 offer-token work (Class A bonuses + Class B resolve-URLs +
  Class C reframe-missing-facts) is that run.

**Deferred:** off-ICP testimonial ICP-filtering (product call — leave as-is).

## RESUME POINT
Run 10 verifying the three fixes → on green, ship them with **migration 0091 gated through Arfeen's "execute"**
(migration first, then push code, then watch build→SUCCESS + verify served bundle). After that, the remaining
piece is the **A11 / bonus build** with Arfeen's 3 decisions. **TS baseline 38** (corrected from 35); vitest ≥ 565.

## 🧭 FORWARD SEQUENCE (banked 2026-07-23 — Claude's lead, the ordered roadmap)
The agreed forward order (each earlier piece unblocks/cheapens the next):
1. **Ship the three in-flight fixes** — run 10 verification → migration `0091` via Arfeen's "execute" → push code → watch build SUCCESS → verify served bundle.
2. **Bonus build** — Arfeen's 3 product decisions (generate-3 · value-line · Class-C reframe); the six NotebookLM research reports → `docs/bonus-research/`. This is the A11 / offer-token run.
3. **Problem B** — per-node review surface + existing-assets import (forward-only wizard; retire the stale / re-crown / `markTweakStale` / dismiss machinery).
4. **Andromeda backbone** — piece 1 (read the REAL Meta fatigue/diversity signals — `frequency`, `first_time_impression_ratio`, duplicate-post detection via `effective_object_story_id`; the practitioner "score" fields `creative_diversity_score`/`creative_similarity_score`/`creative_fatigue` **DO NOT EXIST** — CC-verified against Meta's live docs) + piece 2 (P.D.A. concept axis + validator). **Deliberately AFTER Problem B** — Problem B's per-node review surface is likely SHARED machinery with Andromeda's concept-picker UI; build once, inherit, don't duplicate. **First re-verify the Andromeda thesis against Meta's live docs** (same discipline that caught the fake score-fields).
5. **Andromeda downstream** — LP message-match (nearly free once the P.D.A. axis exists — ad + LP already share `cascadeContext`), video-script generator (extends the paused `server/routers/videoScripts.ts`).
6. **Andromeda closed write-back loop** — SEPARATE, gated, LAST (autonomy + coach ad-spend; per-action approval; its own scope decision).
7. **Parked** — OpenAI GPT Image 2 evaluation + swap (quality + cost-per-image on real prompts).

**Constraints to hold:** Andromeda piece 2 touches `adCopyGenerator.ts` — the file currently carrying the A7 location-lock — so **Andromeda does NOT start until the current work ships** (no same-file collision). The bonus path is fully independent. **Every Meta API field is CC-verified against live docs before building.** Full brief (DOCUMENTATION — do NOT execute until Arfeen says so): `docs/andromeda/EXECUTION_BRIEF.md`.

**Deferred (unchanged):** off-ICP testimonial ICP-filtering — product call, leave as-is.

Prior: `docs/handovers/ZAP_Handover_July22_2026.md`.
