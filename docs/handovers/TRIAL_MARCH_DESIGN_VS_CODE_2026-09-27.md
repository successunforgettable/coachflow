# TRIAL — MARCH 2026 FREE-TIER DESIGN vs THE CODE — 2026-09-27

**Read-only investigation. Nothing built, nothing committed, no production read or write.** Code read at production
`87596d7` (railway-build) and held HEAD `479a9b7` (docs/held-2026-09-12) with `git show <rev>:<path>` / `git grep <rev>`.
No production DB query was run: every finding below is about code paths, not about how many trial users exist.

---

## 0. ANSWER IN FIVE LINES

1. **The March design has no written spec in the repo.** Its only record is the commit messages of the L-QUOTA sprint
   (17 commits, all 2026-03-23) plus one earlier commit (`380a436`, 2026-03-08) that locked nodes 6–11 **outright**.
   Email "one 3-email sequence only", WhatsApp "3 messages only" and "2 free ad-image credits" appear in no L-QUOTA
   commit; they were never built as trial rules.
2. **The L-QUOTA client work was mostly disconnected on 2026-04-07** by `7b95543` ("B0: port remaining client-side
   files from main"), which replaced `V2GeneratorWizard.tsx` with main's copy: it dropped every `isFreeTier={isFreeTier}`
   prop to the nine result panels, the QuotaIndicator, and the Generate-Again lock. The panels still contain the lock
   code; nothing passes them the flag, so it defaults to `false`. **§15d: machinery with no caller.**
3. **What survived is the harsher 03-08 lock**: in the legacy wizard, trial users see a full "Upgrade to Pro" screen on
   Headlines, Ad Copy, Landing Page, Email, WhatsApp and Push (`V2GeneratorWizard.tsx:72, 2996`, identical on prod and
   HEAD). Even at the end of the L-QUOTA sprint that lock was in place, so **the L-QUOTA copy locks on Headlines (10)
   and Ad Copy (first set) could never be reached by a trial user, even in March.**
4. **Production today:** a trial user on the Trail (the dashboard's main button) gets one ICP and is then refused at
   Offer ("Auto Mode is a Pro feature"). None of the March design is experienced there. On the legacy wizard they get
   nodes 1–5 with **unlimited** generation and **unlocked** regenerate/export, and nodes 6–11 hard-locked.
5. **Held branch after this week:** the Trail is open to trial, rationed per asset (quota counts), push Pro-only. It
   matches the March design on **Push** and roughly on **Email**; it contradicts it on **regenerate (open)**, **landing
   page (auto-published live, downloads open)**, **headline/lead-magnet/method counts (unlimited)**, **ad copy (5 sets)**
   and **WhatsApp (3/5/7 messages)**. No March UI lock is reached on the Trail.

---

## 1. THE MARCH DESIGN'S WRITTEN RECORD

### 1a. Searched
`docs/` (incl. `docs/handovers/archive/`), `CHECKPOINT.md` (grep), every `.md` in the repo, the memory directory,
`todo.md`, and `git log --all` for `L-QUOTA`, `free tier`, `trial`.

- **No design document exists.** `grep -rn "L-QUOTA"` over the working tree hits only code comments
  (`client/src/v2/components/UpgradePrompt.tsx:2,16`, `server/pipeline-fixes.test.ts:2415`). CHECKPOINT.md: zero hits.
  Memory: zero hits for L-QUOTA; `project_redteam_2026_06_24.md:39` records a later Arfeen ruling *"Trial expiry: hard
  block on all generation, no 'free tier' concept"*.
- `todo.md:141` *"Welcome bonus: 2 free credits on first balance check (lazy grant)"* — this is the **video** credit
  system (`server/routers/videoCredits.ts:85`), not ad images. `todo.md:328` (March 8 test note): *"Nodes 6-11 — NOT
  locked on Free tier … expected to show upgrade/lock message per test spec"* — the origin of `380a436`.
- The design as stated in the brief (nodes 1–5 open with regenerate locked; headlines copy after 10; ad copy after first
  set; LP Preview/Download/Visual Style locked; email one 3-email welcome; WhatsApp 3 messages; push locked; 2 ad-image
  credits; video locked) is **recorded nowhere as a whole**. It is reconstructable only from the commits below.

### 1b. The commits (all in production's history)

| commit | date | what it did |
|---|---|---|
| `380a436` | 2026-03-08 | `PRO_GATED_STEPS` = headlines, adCopy, landingPage, emailSequence, whatsappSequence, pushToMeta → full "Upgrade to Pro" screen for trial in `V2GeneratorWizard`. **Stricter than the design** (nodes 6–10 not visible at all). |
| `eec6641` | 03-20 | trial `headlines / hvco / heroMechanisms` quota → `Infinity` in `server/quotaLimits.ts` |
| `e1a6e03` | 03-23 | **L-QUOTA 1** — `server/lib/quotaEnforcement.ts` (`enforceQuota`, `incrementQuotaCount`); `enforceQuota` at the top of every generate/generateAsync/regen in 9 routers |
| `3dd7999` | 03-23 | **2** — `UpgradePrompt` (modal + inline) |
| `784444e` | 03-23 | **3** — `QuotaIndicator` wired into the wizard for nodes 2,3,4,5,7,8,9,10; Generate replaced by inline UpgradePrompt at quota |
| `85ffd91` | 03-23 | **4** — Generate Again locked for trial with existing results |
| `57371d1` | 03-23 | **5** — `isFreeTier` prop to all 9 result panels; regen buttons greyed + modal; RegenPanel never renders for trial |
| `6c27dc7` | 03-23 | **6** — copy locked on Headlines index ≥ 10, Ad Copy index ≥ 3 ("first ad set") |
| `1111b76` | 03-23 | **7** — ICP/Offer/LP download buttons → "Export (Pro)" |
| `f297a34` | 03-23 | **8** — LP Visual Style picker locked (a text "Open Preview" is **kept** for trial — Preview was not locked) |
| `dd42c9b` | 03-23 | **9** — Video Creator render button locked (`V2ToolLibrary`, `V2VideoCreator`) |
| `7744aaa`, `5a1402b`, `4186503`, `51bd099`, `9ff58fe`, `01c9d8e`, `21a7048`, `710680c` | 03-23 | L-QUOTA fixes (Generate-Again prompt suppression on Pro-gated nodes; Video Creator back button / render lock) |
| `cf78ead`, `e8860cc` | 03-23/24 | quota count field names for email/WhatsApp; Pro limits raised to 50 |
| **`7b95543`** | **04-07** | **B0 port from `main` — overwrote `V2GeneratorWizard.tsx` (−3,250 lines). Removed** the `QuotaIndicator`/`UpgradePrompt` imports and every `isFreeTier={isFreeTier}` panel prop. Kept `PRO_GATED_STEPS`. Not described as a trial change. |
| `99db7e7` | 04-17 | `FREE_TIER_AD_IMAGE_LIMIT = 2` **rows** in `adCreatives.ts` (not credits; not L-QUOTA) |
| `cf5160d` | 04-08 | `headlines.ts` hard-codes trial 6 / pro 20 / agency 50 (disagreed with the table until `7f624fc`) |
| `7e5db2a` | 06-24 | trial expiry enforced in `enforceQuota` |

---

## 2. WHAT EXISTS TODAY — line by line

Legend: ✅ implemented and reached · 🟡 partly · ❌ absent · 💀 code exists but nothing reaches it (§15d).
Line numbers are identical on prod and HEAD unless marked.

### 2a. Production `87596d7`

A trial user has two surfaces: the **Trail** (`/v2-dashboard/trail/new`, dashboard main button `V2Dashboard.tsx:296`)
and the **legacy wizard** (`/v2-dashboard/wizard/:step`, reached from dashboard path nodes `V2Dashboard.tsx:453,510,517`
and Tool Library `V2ToolLibrary.tsx:220`).

**On the Trail every cascade node is refused**: `autoMode.orchestrateStep` → `isAutoModeTierAllowed` → FORBIDDEN
(`server/routers/autoMode.ts:202-205`). The trial user gets service extraction, profile expansion and one ICP, then
*"Still stuck on Offer (Auto Mode is a Pro feature…)"*. So the table below is the **legacy wizard** only.

| design line | prod status | evidence |
|---|---|---|
| Nodes 1–5 fully generate | 🟡 generate — and **unlimited**: ICP/offer counters are checked but never incremented; hvco/method are `Infinity` | `quotaLimits.ts:22-32`; proposal §1a |
| Nodes 1–5 regenerate locked | 💀 lock code in panels, flag never passed → regen **open** | panels `V2OfferResultPanel.tsx:212-224` etc.; wizard renders panels without the prop (`V2GeneratorWizard.tsx` R1a/R1b blocks after 2825); removal `7b95543` |
| Node 5 lead magnet | 🟡 generates, unlimited (`hvco: Infinity`) | `quotaLimits.ts:24` |
| Node 6 Headlines — all visible, copy after 10 | ❌ node fully locked (Upgrade screen); copy-lock code 💀 | `V2GeneratorWizard.tsx:72-79, 2996`; `V2HeadlinesResultPanel.tsx:175` |
| Node 7 Ad Copy — visible, copy after first set | ❌ locked; copy-lock 💀 | same; `V2AdCopyResultPanel.tsx:307,418,577` |
| Node 8 LP — angles readable; Preview/Download/Visual Style locked | ❌ node locked; Visual-Style/export lock 💀 | same; `V2LandingPageResultPanel.tsx:974-1038` |
| Node 9 Email — one 3-email welcome | ❌ node locked | `PRO_GATED_STEPS` |
| Node 10 WhatsApp — 3 messages | ❌ node locked | `PRO_GATED_STEPS` |
| Node 11 Push — fully locked | ✅ in the wizard (`pushToMeta` in `PRO_GATED_STEPS`); **no server gate** on `meta.ts` / `ghl.ts` push procedures | `git grep subscriptionTier` on those routers: 0 hits at prod |
| Ad images — 2 free credits | 🟡 2 **rows** total → in practice one generate click, then blocked | `adCreatives.ts:769-801` (`FREE_TIER_AD_IMAGE_LIMIT = 2`) |
| Video Creator locked | ✅ for everyone — feature-flagged "Coming Soon" (`pages/VideoCreator.tsx`, `VIDEO_CREATOR_FEATURE_ENABLED = false`); `V2VideoCreator` unmounted (`V2ToolLibrary.tsx:482`). Server `videos.generate` checks **credits only**, and trial users get 2 video credits (`videoCredits.ts:85`); `/video-creator/script/:id` (`VideoScriptEditor.tsx:33`) still calls it — a residual path, not traced end to end |
| Upgrade prompts | 🟡 only the full-node LockedUpgradeState and the Auto Mode fork warning (`V2TrailIntake.tsx:497`) |

### 2b. Held HEAD `479a9b7` (this week's work on top)

`quotaLimits.ts` is **byte-identical** to production (`git diff 87596d7 HEAD -- server/quotaLimits.ts` = empty). The
legacy wizard (`V2GeneratorWizard.tsx`) and all nine result panels are **unchanged**. What changed is the Trail and the
server enforcement.

| design line | HEAD — Trail (the main path) | HEAD — legacy wizard |
|---|---|---|
| Nodes 1–5 fully generate | ✅ ICP 2 (intake: `autoMode.ts:356,668`), offers 2, method/lead-magnet **unlimited**; step gate `autoMode.ts:123-140, 255-256`, map `TRIAL_STEP_QUOTA` `autoMode.ts:99-109` | ✅ same counters now move (trial and every tier, `quotaEnforcement.ts:90-95`) |
| …regenerate locked | ❌ **open.** Tweak chips shown to trial (no trial check near `V2Trail.tsx:254-263`); every regenerate/Tweak procedure checks **expiry only** (`enforceTrialActive`, e.g. `headlines.ts:329`); "Show me new options · N left" re-generates within the quota | 💀 as prod |
| Node 6 Headlines — all visible, copy after 10 | 🟡 generated, **unlimited sets** (`quotaLimits.ts:23`); Trail reveals the selected one; **no copy control exists on the Trail or Kit** (0 `clipboard` hits in `V2Trail.tsx` / `V2CampaignKit.tsx`) | ❌ locked |
| Node 7 Ad Copy — copy after first set | 🟡 **5 sets** (`quotaLimits.ts:27`), no copy lock | ❌ locked |
| Node 8 LP — readable; Preview/Download/Visual Style locked | ❌ **inverse**: 2 pages, **auto-published live to Cloudflare** (`_core/orchestration.ts:661-681`), style chosen automatically (`styleForPageType`), Kit shows "Live at:" link (`V2CampaignKit.tsx:98-110`); Campaign Brief, ad-image download, bonus PDFs, Asset Library ZIP all ungated | ❌ locked |
| Node 9 Email — one 3-email welcome | 🟡 each step = one `welcome` sequence (`orchestration.ts:893`), 3 emails Day 1/3/5 (`emailSequenceGenerator.ts:99`); quota **2** sequences; per-email Tweak open | ❌ locked |
| Node 10 WhatsApp — 3 messages | 🟡 3 by default, **5 or 7** when an event date is ≥ 8 / ≥ 22 days out (`orchestration.ts:156-165, 936`); quota **2** | ❌ locked |
| Node 11 Push — fully locked | ✅ server `assertCanPush` (`tierAccess.ts:104`; `meta.ts:335,520`; `ghl.ts:586`) + client note, no button (`V2CampaignKit.tsx:645-646, 868, 1240, 1292`) | ✅ locked |
| Ad images — 2 free credits | 🟡 **1 batch (5 images)** (`tierAccess.ts:45`, `quotaEnforcement.ts:69-83`, `adCreatives.ts:773-779`) | n/a |
| Video Creator locked | ✅ as prod; `videos.ts`/`videoScripts.ts` now also refuse an **expired** trial (active trial with credits still passes `videos.generate`) | — |
| Upgrade prompts | ❌ by decision — limit messages only, *"No upgrade flow — per Arfeen, not yet"* (proposal §2c); `usageLimit.ts`, `haltOnUsageLimit` `V2Trail.tsx:395-400` | LockedUpgradeState |

---

## 3. MARCH DESIGN vs THIS WEEK'S MODEL (side by side)

The two models are **different kinds of thing**. March was **feature-gated**: every node is visible, but *actions* on it
(regenerate, copy, export, preview, style, push) are locked — the coach sees the whole kit and pays to use it. This
week is **count-gated**: every action is allowed, a fixed number of *generations* per asset is allowed, and only push is
Pro. Neither is a subset of the other.

| node | March design | this week (HEAD, Trail) |
|---|---|---|
| 1 Service | generate + display | generate (expiry-gated extraction) |
| 2 ICP | generate + display; regen locked | 2 ICPs (incl. imports); ICP-panel regen + PDF export open |
| 3 Offer | generate; regen locked | 2 offers; Tweak open |
| 4 Unique Method | generate; regen locked | unlimited; Tweak open |
| 5 Lead Magnet | generate; regen locked | unlimited; Tweak open; magnet page/PDF **published** |
| 6 Headlines | all visible; copy after first 10 | unlimited sets; one shown; no copy control |
| 7 Ad Copy | all visible; copy after first ad set | 5 sets; no copy control |
| 8 Landing Page | angles readable; Preview / Download / Visual Style locked | 2 pages; **auto-published live**; downloads open |
| 9 Email | one 3-email welcome sequence | 2 welcome sequences (3 emails each); Tweak open |
| 10 WhatsApp | 3 messages | 2 sequences of 3/5/7 messages; Tweak open |
| 11 Push | fully locked | Pro-only ✅ (same) |
| Ad images | 2 free credits | 1 batch = 5 images |
| Video | locked | locked (feature off for all) |
| Regenerate generally | locked | open (expiry only) |
| Upgrade prompt | yes, on every lock | none — limit message only |

---

## 4. WHAT A TRIAL USER ACTUALLY EXPERIENCES

**Signup** → `subscriptionTier = "trial"`, `trialEndsAt = now + 14 days` (`customAuth.ts:84-86, 299-301`; schema default
`drizzle/schema.ts:26`) → V2 dashboard.

### 4a. Production today
- **Trail "Build it all for me ⚡"**: warned "Pro feature" at the fork (`V2TrailIntake.tsx:497`), server backs it.
- **Trail "I'll pick as we go"**: service + profile + **one ICP**, kit created, **Offer FORBIDDEN** — zero campaign
  assets; the client lands in the retry / "Still stuck on Offer" loop.
- **Trail "I have some — use mine"**: upload + extraction + confirm, then **FORBIDDEN at import**.
- **Legacy wizard (only if they click a path node)**: nodes 1–5 unlimited with regen and export open (L-QUOTA locks
  💀); nodes 6–11 a full Upgrade screen; ad images one generate.
- **→ None of the March design is experienced on the main path.** On the side path they experience the *03-08* lock,
  not the L-QUOTA design.

### 4b. Held branch, if deployed
- **Trail manual / has_assets**: open node by node. Offer ×2, method/lead magnet/headlines unlimited, ad copy ×5, LP ×2
  (live-published), email ×2, WhatsApp ×2, ad images 1 batch, regen/Tweak unlimited while the trial is active, push
  replaced by the Pro note. At a limit: plain message, drive stops, no upgrade path.
- **Legacy wizard**: unchanged UI — nodes 6–11 still hard-locked — but its nodes 1–5 now draw on the **same counters**.

### 4c. Where both mechanisms meet, and which wins
- **Legacy wizard, nodes 6–11:** the 03-08 lock renders *instead of* the Generate button, so the quota is never reached
  — **the lock wins**.
- **Legacy wizard, nodes 1–5 (HEAD):** only the quota acts (the panel locks are 💀).
- **Trail:** only the quota acts; no March UI is on this path at all.
- **Conflicts:**
  1. **Two surfaces, two rules for one account.** The Trail lets a trial user build Headlines, Ad Copy, LP, Email and
     WhatsApp; the wizard (same user, same counters) shows those nodes as Pro-only.
  2. **Shared counters.** Offers/ICPs made in the wizard consume the Trail's allowance and vice versa — correct in
     principle, but the coach is told different stories on each surface.
  3. **Regenerate is quota-free.** Tweak/regenerate cost model calls with no count; the March design's main cost
     control (regen locked) is absent on both surfaces.
  4. **Landing page is the opposite of the design** — published live and downloadable on the Trail vs "Preview /
     Download / Visual Style locked".
  5. `UpgradePrompt` / `QuotaIndicator` are dead code for the trial; this week's rule is "no upgrade flow".
  6. `videos.generate` has no tier gate while trial users hold 2 video credits (only the flag-off UI protects it).

---

## 5. PROPOSAL — bring the trial into line with the March design (not built)

### 5a. Keep from this week (all of it is structurally right)
`server/lib/tierAccess.ts` (one definition of "trial"), the fixed counters, the machine-readable `UsageLimitCause` →
`data.usageLimit` → `usageLimit.ts`, the Trail halt (`haltOnUsageLimit`), `enforceTrialStepAccess` (kit read
server-side; Auto Mode Pro-only), trial expiry on every AI route, `assertCanPush` + the Pro push note, the ad-image
batch gate. These are the enforcement spine the March rules need; March had almost none of it server-side.

### 5b. Add / change
| # | change | where | size |
|---|---|---|---|
| 1 | **Regenerate locked for trial**: one refusal (`usageLimitError("pro_only","regenerate")`) in the ~11 regenerateSingle / regenerateSection / Tweak procedures, next to the existing `enforceTrialActive`; hide/lock the Tweak chips and "Show me new options" for trial in `V2Trail.tsx` | server + client | M |
| 2 | **One of each on nodes 3–5 and 7, 9, 10** (the design's "one sequence / one ad set"): trial row of `quotaLimits.ts` → offers 1, heroMechanisms 1, hvco 1, adCopy 1, email 1, whatsapp 1 (ICP stays 2 or 1 — decision). **But** `quotaLimits.ts`'s header says it must match the pricing page — check the page first | server (table) | S |
| 3 | **Headlines: one set, all visible, copy after 10.** The Trail has no copy UI, so "copy" must be defined: recommend headlines set quota 1 and the trial Kit/brief/ZIP export truncated to the first 10 | server (export) + client | M |
| 4 | **WhatsApp 3 messages for trial**: force `sequenceLength = 3` for trial in `orchestration.ts:936` | server | S |
| 5 | **Landing page: readable, not live.** Skip auto-publish for trial (`orchestration.ts:661-681`), show angles as text in the Kit, lock Visual Style / Preview / Download. Knock-on: the A10 gate makes node completion depend on a real publish, and ad images + kit completion follow the LP — the trial kit's completion semantics must be redefined for trial | server + client | **L** — biggest risk |
| 6 | **Downloads**: gate Campaign Brief / Asset Library ZIP / LP text / ad-image download for trial (client `isTrialUser`; server on `campaignKits` ZIP export) — scope per decision Q5 | client + server | M |
| 7 | **Ad images "2 free credits"**: either keep 1 batch or cap trial at 2 images per batch | server | S |
| 8 | **Video**: add `assertCanPush`-style Pro gate on `videos.generate` (belt-and-braces; the UI is flagged off) | server | S |
| 9 | **Legacy wizard**: either re-pass `isFreeTier` to the nine panels and remove the 03-08 node lock (so the wizard obeys the same March rules), or route trial users away from it. Recommend the second — the Trail is the only path that yields a kit | client | S–M |
| 10 | **Upgrade prompt**: reuse `UpgradePrompt` on each lock and limit message, if Arfeen now wants the upgrade path | client | S |

**Risks:** #5 touches the kit completion gate and the LP publish path (live-page and Cloudinary permanence rules apply —
any trial page already published stays public; CLAUDE.md §4). #1 and #2 change the Trail's existing
"Show me new options · N left" chip semantics. Client-only copy/download locks are deterrents, not protection — the
text is on screen; only the server-side export gates are real. Every new gate needs its negative control
(§15c): a trial call refused, a Pro call through.

### 5c. Decisions for Arfeen (recommendation in bold)
1. **Which design wins — March feature-locks or this week's per-asset counts?** → **March's shape for what a trial
   user can *do* (see everything, act on little), keeping this week's server spine.**
2. **Landing page for trial: published live, or readable text only?** → **Text only, not published** — matches March
   and keeps trial pages off the public web; accept that a trial kit then never reaches "complete".
3. **Regenerate / Tweak / "Show me new options" for trial?** → **Locked on every node** (March), with the upgrade prompt.
4. **How many of each?** → **One of each asset** (one offer, method, lead magnet, headline set, ad copy set, email
   sequence, WhatsApp sequence, two landing-page angles readable), ICP **2**. Check against the pricing page first.
5. **What does "copy/download locked" cover now that the Trail has no copy button?** → **Server-side exports (brief,
   ZIP, LP text, image download) locked for trial; first 10 headlines and first ad set included in what trial can
   export.**
6. **Ad images: 2 images or 1 batch of 5?** → **2 images** (the March number; cheapest).
7. **Legacy wizard for trial?** → **Route trial users to the Trail only**; retire the 03-08 node lock with it.
8. **Upgrade prompt now, or still "not yet"?** → **Now** — every March lock was designed around one.
