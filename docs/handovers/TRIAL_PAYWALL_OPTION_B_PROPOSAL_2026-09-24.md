# TRIAL PAYWALL — OPTION (b): PROPOSAL AND BUILD RECORD — 2026-09-24

**Arfeen's decision:** option (b), the original design — the manual path open to trial users, rationed by quotas;
Auto Mode ("Build it all for me") Pro-only and unchanged; **Pro users not limited on the Trail**.

**Status: BUILT on the held branch (sprints 1, 1-fix and 2 — see §6), NOT deployed.** D5 was later corrected: Pro keeps every
pre-sprint limit; only the new trial rationing skips it. Sections 1–5 are the original proposal, kept as written. Original investigation, read-only: code at production `87596d7`, the production DB through
the guarded SELECT-only runner. Context: `END_TO_END_READINESS_2026-09-24.md` §7a.

---

## 1. WHAT THE INVESTIGATION FOUND (evidence)

### 1a. 🔴 The trial quotas are mostly decoration today — on EVERY path
`quotaLimits.ts` rations trial users at **2** ICPs, offers, emails, WhatsApp sequences and landing pages, and **5** ad
copy sets. The routers **check** the counters — but **five of the counters are never incremented anywhere**:

| counter | checked in | incremented anywhere? |
|---|---|---|
| `offerGeneratedCount` | `offers.ts:94, 132` | **never** — only written by reset/admin/Stripe code |
| `adCopyGeneratedCount` | `adCopy.ts:210, 259` | **never** |
| `icpGeneratedCount` | `icps.ts:134, 228` | **never** — `icps.ts:327` admits it: *"checked but never incremented anywhere (a pre-existing bug)"* |
| `emailSeqGeneratedCount` | `emailSequences.ts:128, 168` | **never** |
| `whatsappSeqGeneratedCount` | `whatsappSequences.ts:129, 171` | **never** |
| `headlineGeneratedCount` · `hvcoGeneratedCount` · `heroMechanismGeneratedCount` | routers | ✅ `db.ts:175/275/375`, from the generator cores |
| `landingPageGeneratedCount` | `landingPages.ts` via `enforceQuota` | ✅ `landingPageGenerator.ts:1354` |

**Production confirms it** (read-only, 2026-09-24): the smoke coach (user 117174) has **6 offers, 54 ad copy rows, 6 ICPs,
6 email sequences** — and every one of those counters reads **0**. Its landing-page counter (22) and headline counter
(18) move. **The only trial limits that can actually fire today are landing pages (2) and headlines.**

This is §15c: a check that cannot fail. **Option (b) is not real until this is fixed, whichever route is chosen.**

### 1b. Trial expiry is enforced only on landing pages
Trials are **14 days** (`nativeAuth.ts:91`, `customAuth.ts:86`). The `trialEndsAt` check lives only in `enforceQuota`
(`lib/quotaEnforcement.ts:33`), which only the landing-page router calls. **An expired trial can still generate
offers, ad copy, emails and WhatsApp** through the per-node routers.

### 1c. Two headline limits disagree
`quotaLimits.ts` says trial headlines are **unlimited**; `headlines.ts:173-190` hardcodes **trial 6 / pro 20 / agency
50** and ignores `getQuotaLimit`. The Trail's quota display (`trail.getQuotaStatus`) reads `quotaLimits.ts`.

### 1d. The Trail was built for quotas but never enforces them
`trail.getQuotaStatus` (`trail.ts:~180-195`) feeds the Trail's **"Show me new options · N left"** chip
(`V2Trail.tsx:~2022-2089`) for offer, method, lead magnet, headlines, ad copy and landing page. **The server never
enforces those numbers on the Trail** (`orchestrateStep` → `runOrchestrationStep` never calls `getQuotaLimit`), and
for offers and ad copy the number can never go down (§1a).

### 1e. Routing trial users back to the legacy wizard — viable only with five fixes, and it ships a worse kit
The legacy wizard (`/v2-dashboard/wizard/:step`) generates every text asset through the quota-checked routers with no
Pro gate ✔. But a kit built there **cannot be pushed**:
- **no ad images are ever selected into the kit** (nothing outside orchestration writes `selectedAdCreativeBatchId`),
  so Meta push has no creative;
- **no landing page is published** (Meta push needs its URL), **no lead-magnet body or PDF**, **no bonuses**, **no
  campaign facts**, **no free-next-step page** — all of that lives only in the Trail's orchestration step;
- campaign type and `path` are lost (the landing page defaults to `course_launch`);
- `?serviceId` is dropped on every navigation (falls back to the newest service);
- email/WhatsApp selections depend on a client-side kit reference that can be stale → the kit may never complete;
- quota errors are shown as "missing data", not as a limit.

Before `c6c975c` the manual chip did exactly this: `navigate('/v2-dashboard/wizard/service?serviceId=…')`, carrying
nothing else. The legacy wizard's core logic was last changed 2026-06-12.

---

## 2. RECOMMENDATION — keep trial users on the Trail, make the Trail's step quota-limited for trial only

**⚠️ This differs from the literal ask ("re-route through the quota-limited wizard").** It delivers the same design —
a rationed manual build for trial, Auto Mode Pro-only, Pro unlimited on the Trail — but on the path that produces a
**pushable** kit. Routing to the wizard would give trial users a kit with no ad images and no published page, i.e. one
they could never push, and would need all five §1e fixes plus a second copy of the orchestration post-work.
**Arfeen to confirm the route (D1) before anything is built.**

### 2a. Server — `autoMode.orchestrateStep` (one place)
- **Pro / agency / admin / superuser:** exactly as today. No quota check, no counter change. *(Pro not limited on the
  Trail — untouched.)*
- **Trial:**
  1. Look up the kit **server-side** (by `userId` + `icpId`; never trust a client flag). **Refuse `path='auto'`** with
     the existing Pro message — Auto Mode stays Pro-only. Allow `path='manual'` (and `has_assets`, §3).
  2. **Trial expiry:** blocked once `trialEndsAt` has passed (reuse `enforceQuota`, which already does this).
  3. **Quota:** map step → generator (offer→offers, mechanism→heroMechanisms, hvco→hvco, headlines→headlines,
     adCopy→adCopy, landingPage→landingPages, email→email, whatsapp→whatsapp) and call `enforceQuota` **before** the job
     is created. Ad images use the existing trial rule in `adCreatives.ts:769-800` (see D3).
  4. **Charge on success only**, after the step's job completes — a failed attempt or an automatic retry costs nothing.
     A step that is skipped because the node is already filled costs nothing. **No double counting:** headlines, lead
     magnet, method and landing page are already incremented inside their generator cores; only offers, ad copy,
     email and WhatsApp need charging here.

### 2b. Fix the five never-incremented counters — required for either route
Increment `offer`, `adCopy`, `email`, `whatsapp` (and `icp` on generation) **after a successful generation** in the
per-node routers, and in the trial branch of 2a. **Recommend charging trial users only** in this sprint (D5), so no Pro
user anywhere starts hitting the 50/100 limits as a side effect.

### 2c. Client — the Trail
- **Quota reached:** today a FORBIDDEN from `orchestrateStep` lands in the automatic-retry and "Still stuck on … Try
  again" loop. It must be recognised and stop the loop with a plain statement of the limit (e.g. *"You've used your 2
  free offers."*). **No upgrade flow** — per Arfeen, not yet.
- The "Show me new options · N left" chip then becomes true for trial users, because the counters move and the server
  enforces them.
- No change for Pro users, and no change to the "Build it all for me ⚡" chip (the client already stops trial users
  there; the server gate backs it).

---

## 3. "I HAVE SOME — USE MINE" FOR TRIAL USERS

**Today:** a trial user goes through upload, extraction (an LLM call with **no gate at all**), coherence check,
confirm cards and quick-fill — and **only then** hits FORBIDDEN at `importIcp` / `importAssets`.

**Importing is not free generation, but it is not free either:** extraction and the coherence check are LLM calls;
`importIcp` runs a background LLM enrichment; `importAssets` generates the offer's free and dollar angles in the
background. And after import, the gaps are filled by the **auto loop** — for a trial user that is Auto Mode by another
door.

**Proposal: same quota logic, no new limit type, no migration.**
1. **Let trial users in**, with the trial-expiry check.
2. **Charge imports against the quota of the thing imported:** `importIcp` → one ICP; `importAssets` (offer) → one
   offer, since it generates two angles. An imported method or lead magnet generates nothing → free.
3. **Gate extraction for trial** before any LLM call: trial not expired and ICP quota not exhausted (not charged —
   the charge lands at import). This stops the "upload everything, then get refused" experience.
4. **The gaps are filled node by node, not automatically, for trial users** (D4): a trial `has_assets` kit uses the
   manual loop, each gap quota-limited through 2a. Keeps "build it all for me" meaning the same thing on every door.

A separate import limit is not needed: an importer who brings their own ICP and offer consumes one of each, which is
the same rationing a generator gets.

---

## 4. DECISIONS FOR ARFEEN

| # | decision | recommendation |
|---|---|---|
| **D1** | Route for trial manual: the Trail made quota-limited (§2), or the legacy wizard (literal ask; §1e fixes) | **The Trail** — it is the only path that yields a pushable kit |
| **D2** | Trial headline limit: unlimited (`quotaLimits.ts`) or 6 (`headlines.ts`) | Pick one; the Trail will follow `quotaLimits.ts` |
| **D3** | Trial ad images: today's rule allows 2 creative rows in total. A kit cannot reach `complete` — and so cannot be pushed — without an ad-image batch | Allow exactly the one batch the kit needs |
| **D4** | Trial `has_assets` gaps: node by node (manual) or automatic within quotas | **Node by node** |
| **D5** | Whether Pro users start being charged in the legacy wizard once the counters are fixed | **No — charge trial only** this sprint |
| D6 | Can a trial user push to Meta / GHL at all? | Not decided anywhere in the code today — flag only |

## 5. BUILD SHAPE, once decided (not started)

- **Sprint 1 (server):** 2a + 2b + §3 server side. Unit tests on the full matrix with negative controls: trial +
  `path='auto'` → refused; trial third offer → `quota_exceeded`; expired trial → `trial_expired`; failed attempt →
  counter unchanged; **Pro on the Trail → counters unchanged and never refused** (the negative control proving Pro is
  untouched); import charges the right counter.
- **Sprint 2 (client):** 2c + the trial `has_assets` loop switch. Proof in the browser.
- **A live proof needs a trial account on production** — creating one, or temporarily setting a test account to
  `trial`, is a **production write** and needs Arfeen's explicit go-ahead.
- No migration: every counter and `trialEndsAt` column already exists.

---

## 6. BUILD RECORD (2026-09-24)

| sprint | commit | what |
|---|---|---|
| 1 | `65af5e2` | server: rationed trial on the Trail, five counters fixed (trial only), trial expiry everywhere, D2/D3/D4-server/D6, limit errors + Trail halt |
| 1 fix | `8881b69` | **D5 corrected** — Pro keeps every pre-sprint limit; only the new trial rationing skips it (quotaLimits.ts, landingPages.ts, db.ts restored byte-identical to production) |
| 2 | `493650b` | client: D4 trial import node by node; limit messages on every limit-capable Trail/intake step; D6 Pro-only push state |
| 3 | *(quota-table sprint, next commit)* | §7 built: the table is the single source of truth for every tier; + expired trial blocked from 11 Tweak/regenerate procedures; + the sync `adCreatives.generate` route given the D3 gate it lacked |

### Sprint 2 browser proof — local build, local throwaway DB, zero model calls
Local MySQL `127.0.0.1:3307/zap_test` (`@@version_comment = Homebrew`), loaded with production's **schema only**
(`mysqldump --no-data`: 59 tables, 0 INSERT lines). Seeded two accounts identical except tier (trial / pro), each
with offer count 2 and the same three campaigns. Server run with `ANTHROPIC_API_KEY` blank — no model call possible;
no Cloudflare / Cloudinary keys — no publish possible. Screenshots: `docs/screenshots/sprint2-trial-paywall/`.

| # | case | trial | Pro (control) |
|---|---|---|---|
| 01 / 02 | imported offer + ICP | stops at Method: "Show me options / Skip" — node by node | "I'll build the missing 8…" — auto-fills, as before |
| 03 / 04 | Show me options on Offer at count 2 | *"You've used all 2 free offers included in the free trial."* — drive ends; **no job created** | job created (fails only on the blank model key, as designed for this harness) — not refused |
| 05 / 06 | completed kit | "Push to Meta / GHL · Pro" + note; overlay swaps its push CTA for the note; no push button exists | 07 / 08: both push buttons; the push modal opens, unchanged |

Local DB after: 4 jobs, all Pro's; the trial user created none; neither counter moved.

**Not browser-proven:** the three intake exits (a trial ICP limit needs `services.extractFromText`, a model call) —
pinned by `trialClient.test.ts` instead. Tweak / regenerate procedures were never quota-gated and still are not;
an expired trial can still use them.

---

## 7. THE QUOTA-TABLE SPRINT (Arfeen's ruling, 2026-09-24) — BUILT, see §6 row 3

**The limits table in `server/quotaLimits.ts` is the single source of truth** (its header: it must match the pricing
page). Scope:
1. Both headline routes read the table instead of hard-coding 6/20 (sync) and 20/50 (async).
2. Landing pages enforce the table's limit only — the router's separate `{ trial 2, pro 50, agency 500 }` removed
   (agency is effectively capped at 500 today).
3. Pro's five uncounted counters (offers, ad copy, ICPs, emails, WhatsApp) start counting, so the table's Pro caps
   are enforced (today they can never fire).
4. The monthly reset runs before the limit check for every tier (landing pages check first today).
5. The 14 stale `quotaLimits.test.ts` tests updated to the current table — they encode the 2026-02-18 table;
   `eec6641` (03-20) and `e8860cc` (03-24) changed it deliberately and never updated them.

6. *(added by Arfeen)* Expired trial users are blocked from Tweak / regenerate, as on every other generation path.

**Built.** Every tier × generator hits exactly the table's cap (one under passes, at the cap refused; `Infinity` and the
table's `999` sentinel never refuse). Generations count for every tier; imports stay a trial-only charge. Paid plans
get *"You've reached your monthly limit of N …"*, trial users the free-trial wording.

**Remaining AI routes — CLOSED 2026-09-24 (next commit).** Each candidate was read before gating:
- **Gated (confirmed: calls the model, had no gate), expiry only, no quota:** `services.extractFromText`,
  `services.expandProfile`, `icps.sharpenWithLadder`, `icpAngleSuggestions.generate`, `icpAngleSuggestions.generateICPs`,
  `videoScripts.generate`, `videoScripts.generateAsync`, `whatsappSequences.retoneSequence`,
  `compliance.rewordForAdvisory`, `sourceOfTruth.generate`.
- **Dropped — the scan was wrong:** `landingPages.reanswerOperatorField` makes no model call (it saves the coach's
  answer); `landing.generatePreviewAssets` is the public homepage demo for logged-out visitors (IP rate-limited, no
  account — an expired trial would get the same demo by logging out).

The original flagged list, for the record: model-calling procedures outside
generate / Tweak — `services.extractFromText`, `services.expandProfile`, `icps.sharpenWithLadder`,
`icpAngleSuggestions.generate` / `generateICPs`, `videoScripts.generate` / `generateAsync`,
`whatsappSequences.retoneSequence`, `compliance.rewordForAdvisory`, `landingPages.reanswerOperatorField`,
`landing.generatePreviewAssets`, `sourceOfTruth.generate` (heuristic scan; each needs confirming before gating).
