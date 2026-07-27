# 🔴 ACTIVE PROD RUN — cascade E2E, 2026-07-28 — TEARDOWN-CRITICAL

**A cascade run is IN FLIGHT on PROD and has NOT been torn down.** This file exists so a fresh
session can finish it or clean it up. If you are picking this up cold: **read §4 first — there is
live prod data that must be removed.**

Branch `railway-build`. No code changes belong to this run; it is verification only.

---

## 1. WHAT THE RUN IS

Full 11-node cascade end-to-end on prod as the E2E smoke coach, to establish whether a coach still
receives a coherent, complete campaign after the compliance layer touched nine generators. Email,
WhatsApp, ad creatives, published landing pages, bonuses and the Meta/GHL push had NOT been
verified since any of it landed.

Two shapes planned: **BEGINNER** (in flight) then **VETERAN**. Health only if both come in clean.

**Actor:** smoke coach `zap-e2e-smoke@mailinator.com`, userId **117174**, openId
`native_ea8a5ee639013dd01bc0b6b585b9dd52`. Creds in `~/.zap-e2e-creds.env` (600).
`E2E_NOPUBLISH_OPENID` verified SET and active on the running server before starting.

---

## 2. IDS CREATED SO FAR — BEGINNER SHAPE (delete these)

| Thing | Id |
|---|---|
| service | **279** ("The Retainer Runway") |
| ICP | **256** ("Freelance UX designer, 6 years in") |
| campaignKit | **194** |
| offer | **207** |
| heroMechanism | created — id not captured; find by `userId=117174 AND createdAt > '2026-07-27 18:40:00'` |
| ICP job | `6bf14e27-c7cd-4145-8893-58a23d73bafe` (complete) |
| cascade job | `50196735-efbb-4dff-a966-1f4e77d4e69d` (**running**, step 3/9) |

**Nothing else existed at the time of writing:** headlines 0 · adCopy adSets none · landingPages 0 ·
emailSequences 0 · whatsappSequences 0 · concepts 0 · adCreatives 0 · bonuses 0.

⚠️ **The cascade was STILL RUNNING when this was written.** It will have created more rows since —
headlines, ad copy, a landing page, email + WhatsApp sequences, concepts, ad creatives, bonuses.
**Do not trust this id list as complete. Reconcile against the baseline in §3.**

---

## 3. PRE-RUN BASELINE — reconcile teardown against THIS

Captured immediately before the run, after clearing 8 orphaned concept rows left by the previous
ship. Every table must return to these numbers.

```
services=124      icps=101          adCopy=5405       kits=49
concepts=0        scripts=0         offers=101        mechanisms=1072
headlines=2154    landingPages=90   emailSequences=96 whatsappSequences=91
bonuses=0         adCreatives=397   campaigns=2
```

(`hvcos` count not captured — the table name did not resolve; check the real table name and record
it before relying on a delta there.)

---

## 4. 🔴 TEARDOWN — WHAT MUST HAPPEN

Delete everything for **serviceId 279 / icpId 256 / kitId 194 / userId 117174** created on
2026-07-28, in FK-safe order:

```
conceptScripts → campaignConcepts → adCopy → adCreatives → bonuses
→ landingPages → emailSequences → whatsappSequences → headlines → hvcos
→ heroMechanisms → offers → campaignKits → idealCustomerProfiles → services
```

**If a landing page was published**, also delete its Cloudflare KV entry and confirm the public
`/p/{slug}` URL returns 404 — a DB delete alone leaves the page live.

**If a Meta campaign was created**, remove it. The push test was intended to run PAUSED with no
budget; verify no live spend exists.

### 🔴 THE TEARDOWN RULE — settle, THEN re-verify
A single post-delete count is **NOT proof** while background jobs are in flight. Prod carried 8
orphaned `campaignConcepts` rows from the previous ship for exactly this reason: the teardown
deleted them and measured 0, and they reappeared minutes later with `createdAt` AFTER the delete.

**Known late writers that can land behind a teardown:**
- `ensureConceptsForIcp` — fire-and-forget `setImmediate` at the ad-copy entry
- the durable bonus-PDF job (`bpdf-{setId}`) — resumable, self-healing on Kit load
- compliance-rewrite precompute (`ENABLE_COMPLIANCE_REWRITES`)

**Procedure:** delete → wait for jobs to settle → re-measure ALL tables against §3 → only then
call it clean.

---

## 5. WHERE THE RUN GOT TO

**Completed:** ICP · offer (with a notable event, §6) · heroMechanism.
**In progress:** step **3 of 9** — lead magnet / HVCO ("Building your free opt-in title…").
**Queued:** headlines · ad copy · landing page · email sequence · WhatsApp sequence · ad creatives ·
concepts + scripts · bonuses.

### Still to do after the cascade finishes
1. Capture every node's output as READABLE artifacts for Arfeen — not logs.
2. **Publish the landing page deliberately** via `landingPages.publishToCloudflare` (NOT
   orchestration — see §7) and **screenshot the live `/p/{slug}`**. This is the artifact most
   likely to reveal a problem: for a beginner, As-Seen-In, testimonials and shockingStat are all
   suppressed, so the question is whether the page renders cleanly or leaves visible holes.
3. Ad creatives — confirm images generate and the shorter first-person copy still FITS the
   template overlays. Nobody has checked copy-to-image fit since the register change.
4. Bonuses — confirm they generate and the hosted PDFs open.
5. Meta + GHL push — confirm the publish gate does NOT block legitimate copy and the push
   completes. PAUSED, no budget, no live spend.
6. Then the VETERAN shape end to end.
7. Teardown per §4.

### The artifact read must flag VISIBLE ABSENCE
Suppression working correctly at the data level can still look broken on the page. Flag headings
with nothing under them, awkward spacing, pages that end abruptly, Kit surfaces with empty slots.
**Structural pass is the floor, not the finding.**

### Report separately
Node failures/empty output · cascade coherence (does the offer named in the ad match the LP, email
and WhatsApp; does each script match its concept; does each concept hook carry to its LP hook
variant) · deck sizes and drop counts per node · anything differing from the isolated tests.

### WhatsApp — read length WITH the stored date
Report `campaignKits.campaignFacts.eventSchedule.date` for kit 194 **alongside** the message count.
A 3-message result is as likely an unparseable-date fallback as a genuine "event is imminent"
signal — `deriveLengthFromDate` returns 3 on `Date.parse` NaN, and real prod dates include
`28th august 2026` and `27/09/2026`, both of which parse to NaN. Email length is NOT dynamic (no
length parameter exists) — a fixed count is expected, not a bug.

---

## 6. OBSERVATIONS ALREADY BANKED FROM THIS RUN

**The offer generator caught itself fabricating and self-corrected.**
`[offersGenerator] Offer fabrication check failed on attempt 1/3 (angle=godfather, 1 hits,
top=[offer_invented_refund_mechanic@cta]). Retrying with fail-context.`
A beginner with no supplied guarantee terms got an invented refund mechanic in the CTA on the first
draft; the retry cleared it. This is the beginner failure mode exactly — no real guarantee to cite,
so the model invents one — on a node that had not been verified.

**Cascade context is genuinely flowing forward.** The mechanism node received
`UPSTREAM CONTEXT — SELECTED ASSETS: Selected offer: "The Retainer Runway" (godfather angle)`
(623 chars, 1/1 selections resolved), so nodes are building on the selected upstream asset rather
than each inventing independently. Verify the same reaches LP, email and WhatsApp.

---

## 7. TWO STANDING DECISIONS THAT SHAPED THIS RUN

**Publish guard vs the screenshot.** `E2E_NOPUBLISH_OPENID` hard-blocks LP auto-publish for the
smoke coach — but the guard lives ONLY in `orchestration.ts`. `landingPages.publishToCloudflare`
carries no guard. So the guard stays fully active (auto-publish blocked, CLAUDE.md's hard rule
honoured) and exactly ONE page is published deliberately via the manual path, then torn down
(DB + KV). Arfeen confirmed this resolution.

**API-driven, not Playwright-clicked.** The cascade is driven through the real orchestration API —
the same server-side code the UI triggers, far less brittle over a long run. Playwright is used
only where RENDERING is what's under test (published page, creatives, bonus PDFs, Kit).
⚠️ **This run therefore proves NOTHING about the wizard's click-through UX** — node ordering,
chip/deck interactions, skip/recovery paths, operator intake. That is a separate piece of work and
has not been done. Do not read this run as "the wizard is verified."
