# END-TO-END READINESS — 2026-09-24 (overnight investigation, read-only)

**Question:** can Arfeen run ONE full campaign through the wizard next session, watch every asset generate, confirm
Meta compliance and cross-asset coherence, and push it successfully to GoHighLevel and Meta?

**Short answer: nearly. Generation is ready today; the PUSH is not.** The wizard path works end-to-end for a pro
account. Three things stand between Arfeen and a clean walkthrough, all on the push side: **GHL cannot push at all
today** (expired token, no refresh code, snapshot link unset), **the Meta token expires 2026-10-05**, and **no landing
page is currently published**, which Meta push requires. None needs a code change for a one-off walkthrough on
Arfeen's own account — but two of them are real defects that need a sprint before any other coach can use this.

**Method.** Read-only throughout. Code read at production `87596d7` (the wizard/Trail client is identical on the
held branch). Production DB read with SELECT-only queries through a guarded runner (it refuses anything but
SELECT/SHOW/DESCRIBE, and runs inside a READ ONLY transaction; negative control: a `DELETE` was refused). Env vars
checked for presence only, values never printed. Four code investigations ran in parallel; every claim that decides
a recommendation was re-verified directly (cited ✔). **No writes, no code changes, no pushes.**

Legend: ✔ verified tonight in code or DB · 📄 claimed in a doc, not re-verified.

---

## 0. THE WALKTHROUGH BLOCKERS, IN PRIORITY ORDER

| # | blocker | effect on the walkthrough | fix for the walkthrough | fix for real coaches |
|---|---|---|---|---|
| **1** | **GHL token expired 2026-07-10; no refresh code exists** ✔ | "Push to GHL" throws *"GHL token expired — please reconnect"* | Arfeen reconnects GHL **in the same sitting as the push** (a fresh token lasts ~24 h) | Build token refresh (the refresh token is stored, never used) |
| **2** | **`GHL_MASTER_SNAPSHOT_ID` is UNSET on production** ✔ | The "Apply ZAP Master Snapshot" link is hidden; the Push-to-GHL button stays disabled unless ≥12 `zap…` workflows already exist in the location | Arfeen's location `yfK7u2subVFh1BJHPSyg` IS the master — it probably already has the workflows; **confirm after reconnect** (the status pill) | Set the env var (Arfeen has the snapshot ID in GHL) |
| **3** | **No landing page is published** ✔ (all 8 rows: no `publicUrl`) | Meta push needs the page's `publicUrl`; a kit whose page is `needs_publish` cannot go to Meta | Run a **fresh** kit whose page publishes during the run (see §5 for the campaign type) | — |
| **4** | **Meta token expires 2026-10-05** ✔ (11 days) | After that, Meta reads as disconnected | Walk through before 10-05, or reconnect Meta first | Wire the existing but uncalled `meta.refreshToken` |
| **5** | **"Skip — I already have this" in the manual Trail silently breaks completion** ✔ | Skipping any node leaves its kit field empty → kit never `complete` → **Push button stays disabled**, while the chat still says "11 of 11" | **Do not skip any node** in the walkthrough | Make skip either capture content or stop blocking completion |
| **6** | **Landing-page publish can fail on a compliance or `[INSERT_*]` hit** and the cascade swallows it ✔ | Page lands `needs_publish`; the chat still says "every piece built" | Watch the Trail bar's landing-page stop — if it is not green, the walk stops there | Surface the failure; stop the false "11 of 11" |
| **7** | **GHL push reports success even when every slot failed** ✔ | A green toast proves nothing | **Verify in GHL itself** (Settings → Custom Values, look for `ZAP …` entries) | Return real per-asset results |
| 8 | Ad-copy deck may show zero cards on an already-generated node 📄 (memory 2026-07-23; code unchanged ✔) | A stuck node | Regenerate that node rather than skip it | Own pass |
| 9 | Zombie jobs ✔ (reaper sweeps `pending` only) | A deploy or crash mid-step leaves a job `running` forever; after 600 s the Trail says "timed out"; 3 zombies lock the account | **No deploy during the walkthrough.** `jobs` table is empty today ✔ | Liveness/heartbeat fix |

**Not blockers for the walkthrough** (state them so nobody chases them): the video-script `scenes` crash
(scripts are not a Trail node — only generated on a click in the legacy wizard or Tool Library ✔); Meta App Review
Advanced Access (only needed for OTHER coaches' ad accounts); the held branch (nothing on it is needed).

---

## 1. CAN A FULL END-TO-END CAMPAIGN BE RUN TODAY?

**Yes — on Arfeen's own admin account, as a fresh kit. There is no real third-party coach in the system.**

Production holds exactly **3 users** ✔, all `subscriptionTier = pro`:

| user | who | services | kits | notes |
|---|---|---|---|---|
| **1** | Arfeen (admin) | 285 (copywriting-for-coaches, **has testimonials**), 318 (women returning to work) — both with an **empty name** | **200** webinar/manual/complete · **225** lead_magnet/**auto**/complete (2026-08-30) | **Meta connected** (ad account "KS 1", page set) · **GHL connected to the master location, token expired** |
| 1613 | the reviewer account | — | — | |
| 117174 | the smoke coach (Playwright) | 6× "The Career Pivot Intensive" | 187–192 real-ish, 204–218 `ZZ-…` throwaways | test data |

**Why not reuse an existing kit.** Every landing page is unpublished ✔ — the 2026-09-02 takedown removed them
(pages 235 and 241 carry that day's timestamp), and magnet 7293 (kit 225's) had its Cloudinary files deleted. Pushing
kit 225 or 200 means republishing assets that were taken down for fabricated testimonials. **A fresh kit is cleaner
and is itself the test the launch bar asks for.**

**The smallest real setup:** Arfeen as the coach, describing his real business in the intake, on user 1 — it is pro
(passes the tier gate), already Meta-connected, and already GHL-linked to the master location. Nothing to create in
the DB.

⚠️ **Tier gate — CORRECTED 2026-09-24 (see §7).** The Pro gate is an **intentional paywall, not a bug.** What §7
records is where it sits today versus where it was designed to sit: every Trail node — **manual too** — runs through
`autoMode.orchestrateStep`, which rejects anyone not pro/agency/admin/superuser (`autoMode.ts:76-88, 202-205` ✔), so
a **trial** coach on the manual path is stopped at the first node. Not a walkthrough blocker (Arfeen is pro). **Where
the paywall should sit is Arfeen's decision; nothing here proposes removing it.**

### What the manual walkthrough actually is
Dashboard → **Start New Campaign** → `/v2-dashboard/trail/new` (the Trail, not the legacy wizard).
1. Service (one text box, ≥120 chars → extracted → "That's me") · 2. ICP (generated, optional sharpen ladder) →
campaign type → fork chip **"I'll pick as we go"** (manual).
3–11 run one node at a time, each as its own job: **Offer → Method → Lead Magnet → Headlines → Ad Copy → Landing
Page → Email → WhatsApp → Ad Images**. Offer … Landing Page deal cards ("Show me options" / "Lock it in →"); Email,
WhatsApp and Ad Images show a single result. A testimonial prompt and up to 12 campaign-fact questions come before
the Offer on a fresh build.
End: chip **"Open my Campaign Kit"** → `/v2-dashboard/campaign-kit/:id` → **"Push to Meta / GHL"** (enabled only
when the kit is `complete`) → `PushKitModal` with Push to GHL / Push to Meta / Push to both.

---

## 2. WHAT IS ACTUALLY PUSHABLE RIGHT NOW

### GoHighLevel — **not pushable today**
- **What push does** (`ghl.ts:482-961`): writes **Custom Values only** — email subjects/bodies, WhatsApp messages,
  landing-page text, headlines, ad copy, offer copy, lead magnet + URL, mechanism, ad-creative headlines and image
  URLs, with orphan-slot cleanup. Templates, funnels and workflows were removed in May as impossible under v2 OAuth.
  **No tags, no contacts** ✔ — matches the 2026-05-27 decision.
- **Token:** expired **2026-07-10** ✔; refresh token stored ✔ but **no code ever uses it** ✔. Every GHL connection in
  production dies ~24 h after connecting.
- **Snapshot detection** counts workflows named `zap…` (≥12 = installed), cached 1 h, **not cleared on reconnect**; any
  error — including an expired token — reads as "not installed". `GHL_MASTER_SNAPSHOT_ID` **unset** ✔.
- **Gate is client-only and bypassable:** "Push to both" fires GHL even when the GHL button is disabled.
- **CORRECTED 2026-09-24 (see §7): there is NO record of a successful GHL push, ever.** The only recorded live GHL
  push attempt is 2026-05-12/13 ("Frame (c)", `878a911`), and what that commit records is two FAILURES (templates
  401, funnels 404). Whether any Custom Value landed is not recorded anywhere. No GHL change since has been pushed.

### Meta — **pushable, image ads only, own account**
- `publishToMeta` (`meta.ts:473-767`): budget floor → token → **compliance gate** (fails closed; blocks Tier-1 hits;
  checks ad-to-page match against the live page angle) → campaign → ad set → creative → ad. **Default PAUSED**; the
  modal also offers ACTIVE (real spend).
- **Images only.** No video push exists anywhere ✔ — Andromeda scripts and Remotion videos never reach Meta. The 9:16
  `asset_feed_spec` path has never run live 📄.
- OAuth **auto-picks** the first active ad account and first page — the coach cannot choose.
- Errors: generic messages to the user, detail only in Railway logs; a partial failure leaves orphan PAUSED objects.
- **Meta publishes on record (CORRECTED 2026-09-24, see §7):** 2026-05-12 two PAUSED "Auto Campaign Kit" app-review
  dummies (still in the account) plus three orphans from failed attempts · 2026-08-09 one PAUSED throwaway test ad
  published by a **script** calling the server directly, read back and deleted · 2026-09-04 one PAUSED gate-test ad,
  still in the account awaiting Arfeen's deletion. **None was ever ACTIVE, none spent, none was a coach's campaign.**
- The multi-ad path (`publishAssembledAds`) is built, **not wired**, never proven.
- App Review Advanced Access for other coaches' accounts: **not started** 📄.

**Has either been verified end-to-end recently? No — only in pieces.** Meta's single-ad path was proven in August on
a script-driven call, not from the Campaign Kit page. **GHL has never been shown to push successfully.** **The two have never been
pushed together from one kit through the UI.** That is exactly what the walkthrough would prove.

---

## 3. AUTO MODE — REAL CURRENT STATE

**Two things are called "Auto Mode", and only one is alive.**
- **Dead:** the old 3-screen flow (Intake → Confirm → Progress) and its server orchestrator `autoMode.orchestrate` →
  `runOrchestration`. The routes redirect to the Trail; nothing calls the orchestrator ✔. Docs that describe Auto Mode
  as this flow (memory `project_auto_mode_full_state_map.md`, superseded `STATE.md` §13) are stale.
- **Alive:** the Trail's fork chip **"Build it all for me ⚡"** (`path='auto'`). The **client** runs the 9 cascade
  steps one job at a time through `autoMode.orchestrateStep`, polling each. **It has produced a complete kit on
  production: kit 225, 2026-08-30** ✔.

### A new user trying Auto Mode right now, step by step
1. **Sign up** — works. New users are **`trial`**.
2. **Dashboard** → "Have Zappy Build It For You" → Trail intake — works.
3. **Single-text intake** — works (three of six extracted fields are never shown to the coach 📄).
4. **Campaign type → "Build it all for me ⚡" → 🛑 A TRIAL USER STOPS HERE**: *"Building it for you is a Pro
   feature"* — the intended paywall for Auto Mode (§7). (The manual chip is stopped one node later — see §7.)
5. **Pro user**: profile expand → ICP → kit (`path='auto'`) → the Trail — works.
6. **Cascade** — works one node at a time, 2 automatic tries per step then a manual "Try again". **Breaks when:**
   - **no campaign facts are ever asked in auto mode** ✔ — webinar, event and sales pages generate but cannot publish
     (need date, venue, price); discovery pages need a booking URL. **Only lead-magnet campaigns publish cleanly.**
   - a deploy or crash mid-step leaves a zombie job (600 s timeout; 3 zombies lock the account).
   - **ad creatives fail** → the kit never becomes `complete` → push disabled; the Trail loops on "Try again".
   - lead-magnet body, bonuses, the Cloudflare page publish and the free-next-step page **fail silently** (warn only).
7. **Completion** — posts *"11 of 11 — every piece built"* **unconditionally**, even when the page did not publish.
8. **Push** — manual, never automatic. Needs `complete` + Meta connected + a published page (+ GHL connected, which
   today is impossible past 24 h).

**So:** for a **pro** user choosing a **lead-magnet** campaign, Auto Mode builds a full kit today. For anyone else it
stops at the tier gate (trial) or produces a page that cannot publish (every other campaign type). The "signup →
one text → ready-to-push kit" vision holds for exactly one campaign type and one tier.

---

## 4. EXISTING-ASSETS IMPORT PATH

**Alive, and wired only to the Auto loop.** Trail fork chip **"I have some — use mine"** (`path='has_assets'`):
upload (≤5 files) or paste → `extractFromAssets` (verbatim-rules LLM extraction) → coherence check → confirm cards
per category → "describe it" or "create one for me" for gaps → quick-fill → ICP imported (and the client **waits for
enrichment**, which fixes the old thin-ICP race) → offer, method and lead magnet imported, marked `source='imported'`
→ the Trail. Imported nodes are **skipped, not regenerated**; the rest generate through the same auto loop with the
imports as upstream context ✔.

### Where an existing-assets coach breaks
1. **Trial coach**: goes through upload, extraction (LLM cost, **no tier gate**), confirm cards and quick-fill — and
   only then hits FORBIDDEN at import: *"that one fizzled"*.
2. **Price dropped**: extracted and shown, but the import schema has no price field → the offer ships
   `[INSERT_PRICE]` unless re-entered in quick-fill (which then blocks page publish if missed). Duration also dropped.
3. **Testimonials discarded**: shown, never stored ("future work"); the testimonial ask only fires when the Offer is
   the first pending node, so an importer is never asked → no real proof on the page.
4. **Imported material is NOT ground truth for the anti-fabrication gates**: `buildCoachCorpus` has an
   `importedText` parameter that none of its 10 callers pass; the imported guarantee is invisible to
   `buildProofSupplied`. The coach's own claims can be blocked as invented.
5. **Correction text leaks**: a coach's correction is appended as `"User correction: …"` into the stored copy, and
   long corrections can exceed a 2,000-char limit and kill the flow.
6. Imported method has 8 empty context columns, never enriched · imported lead magnet gets **no body** (a lead-magnet
   campaign then has nothing to download) · the "already N of 11 done" count double-counts the ICP · the coach's
   service name is overwritten by the offer name.
7. **The manual wizard has no import at all** — "Skip — I already have this" stores nothing (see blocker 5).

Docs disagree with each other: memory 2026-06-29 says "has-assets FULLY VERIFIED" (one run); superseded `STATE.md`
says the has-assets shape was never run.

---

## 5. PROPOSAL — THE SMALLEST PATH TO ONE FULL WALKTHROUGH (not built)

**No code is required for one walkthrough on Arfeen's account.** Two decisions and a short sequence are.

### Decisions for Arfeen (morning)
- **D1 — campaign type: LEAD MAGNET (recommended).** It is the one type whose page publishes without date, venue,
  price or booking URL, and the one type Auto Mode has completed on production (kit 225). Webinar/event/sales need
  every operator fact answered or the page will not publish, and Meta push stops there.
- **D2 — manual or Auto for the walkthrough.** He asked for manual; that works. Auto on the same account is the same
  cascade and would additionally prove the next-to-fix product. Recommend **manual first**, as planned.
- **D3 — Meta ad status: keep PAUSED** (the default). ACTIVE spends money on creation.

### Sequence
1. **Before starting (5 min, Arfeen in the UI):** Settings → reconnect **GHL**; check the snapshot pill is green for
   the master location. If it is not green, stop — that needs `GHL_MASTER_SNAPSHOT_ID` set (an env change I will
   not make without a go-ahead). Confirm **Meta** shows connected.
2. **No deploys during the walkthrough** (zombie-job risk). The scenes fix and the held branch stay where they are.
3. Dashboard → Start New Campaign → describe the real business → **Lead Magnet** → **"I'll pick as we go"**.
   Answer the testimonial and fact questions. **Never press "Skip — I already have this."**
4. At each node, watch it generate; lock a card. **At Landing Page, confirm the Trail stop turns complete, not
   pending** — if it stays pending the page did not publish; stop and send me the kit id.
5. **Coherence check — by eye**, on the Campaign Kit page: the same promise, audience and lead magnet name across
   offer → headline → ad copy → landing page → emails. (There is no automated cross-asset coherence check beyond the
   ad-to-page match inside the Meta gate.)
6. Push to **Meta** (PAUSED). The compliance gate runs here; a block names its class.
7. Push to **GHL** within 24 h of reconnecting. **Then open GHL → Settings → Custom Values and confirm the `ZAP …`
   entries hold this kit's copy** — the app's success toast is not evidence (blocker 7).
8. In Meta Ads Manager, confirm the paused campaign, ad set and ad exist with the right image, copy and page URL.

**What I can prepare in the morning, read-only, before he starts:** confirm after his reconnect that the master
location reports ≥12 `zap…` workflows; watch the Railway logs live during the push (Meta and GHL errors are only
visible there).

### After the walkthrough — the build queue this investigation points to (priority order)
1. **GHL token refresh** — without it GHL push works for one day per connection, for every coach.
2. **~~Tier gate on the manual path + an upgrade path in chat~~ — WITHDRAWN 2026-09-24.** The gate is an intentional
   paywall. §7 records where it sits versus the design; where it should sit is Arfeen's decision, not a fix.
3. **Honest completion** — stop "11 of 11" when the page did not publish or a node was skipped; fix skip.
4. **Campaign facts in Auto Mode** — the only reason non-lead-magnet Auto kits cannot publish.
5. **GHL push truthfulness** — real per-asset results; server-side snapshot gate; fix the "Push to both" bypass.
6. **Zombie-job liveness.**
7. Existing-assets: price field, testimonials stored, imported text into the grounding corpus.
8. Scenes crash fix deploy (`fix/scenes-array-guard`, ready) — independent, affects only the script tool.

---

## 6. EVIDENCE INDEX (all read-only, 2026-09-24)

| check | result |
|---|---|
| DB identity | `@@version_comment` = MySQL Community Server - GPL, `DATABASE()` = railway — production ✔ |
| users / tiers | 3 users (1 admin, 1613, 117174), all `pro` |
| `ghl_access_tokens` | 1 row, user 1, location `yfK7u2subVFh1BJHPSyg`, `tokenExpiresAt` 2026-07-10 13:33:11, refresh token present, never updated since 2026-07-09 |
| `meta_access_tokens` | 1 row, user 1, `tokenExpiresAt` 2026-10-05 13:36:31, ad account + page set, last refreshed 2026-08-06 |
| `meta_published_ads` | 3 rows, all PAUSED; latest 2026-09-04 |
| `landingPages` for all 8 kit pages | no `publicSlug`, no `publicUrl` |
| `jobs` | 0 rows |
| env presence | `GHL_MASTER_SNAPSHOT_ID` **UNSET** · `GHL_CLIENT_ID`, `META_APP_ID`, `TOKEN_ENCRYPTION_KEY` set |
| GHL refresh code | `refresh_token` appears only where tokens are **stored** (`ghl.ts:452-456`, `ghlOAuth.ts:110-158`); no refresh grant anywhere |
| production code | `87596d7`; wizard/Trail client identical on the held branch |

⚠️ Historical row counts in older documents (e.g. `hvcoTitles` 6,749, `landingPages` 92) no longer match production
(467 and 8 today). Production data has been pruned since; never compute a delta against an old document (§15f).

---

## 7. CORRECTIONS AND EVIDENCE — added 2026-09-24 on Arfeen's questions

### 7a. The trial gate — intended design vs today (a decision for Arfeen, not a fix)

**Intended design (two separate mechanisms, both in the code):**
1. **Per-asset quotas for trial users** — `server/quotaLimits.ts` (*"must match the promises on the pricing page"*),
   enforced in each per-node router (e.g. `icps.generateAsync` checks `getQuotaLimit(tier, "icp")`, monthly reset):

   | generator | trial | pro | agency |
   |---|---|---|---|
   | headlines · lead magnet (hvco) · method | unlimited | 50 | 999 |
   | ICP · offers · emails · WhatsApp · landing pages | **2** each | 50 | 999 |
   | ad copy | **5** | 100 | 999 |

2. **Auto Mode (the one-click build) is paid-only** — `75ff795`, 2026-05-11. The commit's own reasoning: Auto Mode's
   generator cores **bypass the per-asset quotas**, so a trial user would burn ~8 quota slots in one cascade; *"gating
   mid-flow is worse UX than gating at intake"*. `8879fb0` (2026-05-24) added the trial upsell screen and an admin
   bypass. **The manual path was meant to stay open to trial users, rationed by the quotas above.**

**What changed:** on **2026-06-13** (`c6c975c`, "manual mode in chat"), the Trail's **"I'll pick as we go"** stopped
navigating to the quota-gated wizard and began running every node through `autoMode.orchestrateStep` — the Auto
Mode job, which carries the Pro gate and **no quota check** (`orchestrateStep` → `runOrchestrationStep` never calls
`getQuotaLimit`). The commit message does not mention tier, trial or quota. **Nothing records this as a decision.**

**What a trial user gets today** (✔ code at `87596d7`):
- **Trail → "Build it all for me ⚡":** blocked at the fork, *before any generation* — only their service
  description has been extracted. The client warns first ("Pro feature"); the server gate backs it.
- **Trail → "I'll pick as we go":** gets their **service extracted, profile expanded and ONE ICP generated**
  (`icps.generateAsync`, trial quota 2), a kit is created — then the **first cascade node (Offer) is FORBIDDEN**
  (*"Still stuck on Offer (Auto Mode is a Pro feature…)"*). **Zero campaign assets.**
- **Trail → "I have some — use mine":** runs the whole upload, extraction (an LLM call with no gate), confirm cards
  and quick-fill, then **FORBIDDEN at import** (*"that one fizzled"*). Zero assets.
- **The legacy wizard** (`/v2-dashboard/wizard/:step`, reached by clicking dashboard path nodes) still calls the
  per-node routers **with** the quotas (`V2GeneratorWizard.tsx:1578-1582`). So the designed trial experience still
  exists — on a surface the dashboard's main button no longer sends anyone to. 📄 reachability per the wizard audit.

**The gap, plainly:** the design gave trial users a rationed manual build (2 offers, 5 ad copy sets, 2 landing pages,
unlimited headlines…). Today the main path gives them **one ICP and then a paywall**, and the rationed build survives
only on the legacy wizard. The block fires **earlier than designed** on the manual Trail, and the per-asset quotas are
**not enforced anywhere on the Trail for any tier** — pro users are not rationed there either.

**Decision needed from Arfeen (options, not a recommendation to remove anything):** where the paywall sits —
(a) as today: the Trail is Pro-only, trial sees one ICP; (b) as designed: manual Trail open to trial, rationed by the
existing quotas, Auto Mode Pro-only; (c) a different line (e.g. first N nodes free). Separately: whether pro users
should be quota-limited on the Trail, as the pricing-page quotas imply.

### 7b. GHL — "last pushed in May" does NOT hold up. Corrected: no successful GHL push is on record.

What the evidence actually shows:
- **`878a911` (2026-05-13 02:07 IST)** — the "Frame (c) verification" push. The commit records **two failures** at the
  byte level: email templates → *HTTP 401 "The token is not authorized for this scope"*; funnel → *HTTP 404 "Cannot
  POST /locations/{id}/funnels"*. It then describes the push as reshaped from "8/10" to "8/8" — **an architecture
  description, not an observation that 8 Custom Values landed.** No response code, no GHL screenshot, no read-back of a
  Custom Value is recorded, in that commit or `3aad948` (the next one).
- **No later live push is recorded anywhere.** Searched: every commit message mentioning GHL/Custom Values since
  (`9d24ba3` 06-06, `1dfd804` 06-04, `5449416` 07-08 …), `CHECKPOINT.md`, `docs/handovers/`, and the session memory.
  The closest is memory 2026-06-29b: *"PUSH ✅ evidenced via reconstruction (**not fired**)"* — explicitly not a push.
- `WIPE_2026-09-12_PRELAUNCH_DUMMY_DATA.md:22` lists *"custom values previously pushed to the master location"* as an
  external inventory item — **an unverified assertion, with no source cited.**
- **There is no database record either way**: ZAP keeps no per-push log for GHL (the table does not exist).
- The GHL token row was last written **2026-07-09 13:33** (a reconnect) and expired a day later; nothing records a push
  in that window.

**So: Arfeen's recollection is consistent with the record. There is no evidence GHL has ever pushed successfully.**
The walkthrough would be the first proven GHL push — and must be verified inside GHL itself (blocker 7).

### 7c. Meta — exactly what "worked" means

| date | what | how | created | state now |
|---|---|---|---|---|
| **2026-05-12** (20:15 and 21:02 as stored; timezone not recorded) | two app-review campaigns named "Auto Campaign Kit" | publishes right after the payload fixes `f7accd5` / `c9a35c9` / `a71efc1`; the name is the kit default from `campaignKits.ts` — consistent with the Campaign Kit page's push (wired that day, `cb23ce0`), but **how they were fired is not recorded** | campaign + ad set + creative + ad, **PAUSED** (`meta_published_ads` rows 1–2 ✔ carry all four ids) | still in the account (`metaSafety.ts` TRACKED ids `120246733556760626`, `120246734574720626`) |
| 2026-05-12 | **three orphan campaigns**, same name | failed attempts that got past campaign creation | campaign only | still in the account (`KNOWN_ORPHAN_CAMPAIGN_IDS`) |
| **2026-08-09** | "ZZ-CONTROL-REROUTE — throwaway test publish, safe to delete" | **script** `server/scripts/reroute-live-publish-v2.ts`, calling `appRouter.createCaller(…).meta.publishToMeta` directly — **not the app UI**. Reused existing copy (adCopy 5889 headline / 5902 body) and creative 482; US targeting; $20/day | **one real PAUSED ad** on Arfeen's real ad account "KS 1" (AED, ~200 real campaigns) — read back by id: headline, body and baked image headline matched the gated copy | **deleted** after the read-back (commit `64f5dc8`) |
| **2026-09-04** | "ZZ-GATE-POSITIVE-ARM — paused, safe to delete" | the compliance-gate proof around `61c2908` | PAUSED ad (`meta_published_ads` row 5 ✔) | **still in the account, awaiting Arfeen's deletion** (CHECKPOINT 2026-09-05 §5, campaign `120251702758030626`) |

**What "Meta worked once" means, precisely:** the server's publish path has created real ad objects on Arfeen's own
ad account, **always PAUSED, never ACTIVE, never spending, never for a real coach's campaign**, and the only run with a
verified read-back (August) was **a test fired by a script, not by a person pressing Push in the app**. A push from
the Campaign Kit page with a real campaign's assets has not been verified.
