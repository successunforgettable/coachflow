# ZAP CAMPAIGNS — LAUNCH-READINESS AUDIT

**Date:** 2026-08-16 · **Auditor:** CC, read-only pass · **Scope:** the whole product, not the ad/publish path
**Method:** every claim below is backed by a file path, a git ref, a read-only production DB query, or a
Railway read. Where something could not be verified from this machine it is marked **UNVERIFIED** with the
reason. Nothing was written, run, deployed, migrated, or pushed. No Meta call was made.

**Local HEAD at audit time:** `84b2f86` · **Branch:** `railway-build` · **Working tree:** clean of tracked changes

---

## 0. THE ONE-PARAGRAPH ANSWER

The product a real coach uses today is **`51eda78`, deployed 2026-08-06** — ten days and 29 commits behind
local. **Nothing from the copy-engine, distinctness, publish-path or 4c sprint is live.** The deployed app
does carry the 11-node trail, the compliance layer, landing-page publishing and a wired Meta push, and 32 of
68 kits have run the full cascade — so the journey largely *works*. But it breaks at the last mile in three
specific places, and two of them are live defects rather than missing features: **the ad-to-page compliance
check is silently dead in the product's own publish path on BOTH branches**, and **no user has ever paid
through Stripe**. The minimum launch does **not** require the 4c multi-ad proof.

---

## 1. DEPLOY AND RELEASE STATE

### What is actually running

| | |
|---|---|
| **Production commit** | **`51eda78`** — status `SUCCESS`, deployed **2026-08-06T16:03:34Z** |
| Railway target | project `cozy-vitality` · environment `production` · service `coachflow` |
| `origin/railway-build` | **`51eda78`** — identical, so the branch tip IS what is serving |
| Local `HEAD` | `84b2f86` — **29 commits ahead, 0 behind** |
| Site liveness | `https://zapcampaigns.com/` → **HTTP 200**, 367 KB, 1.12 s |

**Evidence:** `railway deployment list --environment production --service coachflow` (fields extracted at the
shell); `git ls-remote origin refs/heads/railway-build`; `git rev-list --left-right --count`; `curl -o /dev/null -w`.

The three deployments before it are all `REMOVED` and sit at `774a39b` / `51bdd03`, both older. There is no
newer deployment in any state — so production is not mid-rollout and has not silently advanced.

### 🔴 PLAINLY STATED — a real coach is running pre-sprint code

**Yes. The production app is the 2026-08-06 pre-sprint build.** Every one of the 29 local commits is
undeployed. Confirmed positively, not just by SHA comparison: three files central to the sprint do not exist
at all on the deployed tree —

```
git cat-file -e origin/railway-build:server/_core/pdafGate.ts        → NOT deployed
git cat-file -e origin/railway-build:server/_core/adAssembly.ts      → NOT deployed
git cat-file -e origin/railway-build:server/_core/publishCopySource.ts → NOT deployed
```

…while `complianceAxis.ts`, `persistenceGate.ts` and `lib/complianceFilter.ts` **are** deployed. So the
compliance *layer* is live; the distinctness gate, the ad assembly and the gated publish resolver are not.

### The 29 undeployed commits by theme

| theme | commits | what it contains |
|---|---|---|
| **Copy engine + P.D.A.F. distinctness** | `d9dc69c` `e91c13d` `9162e45` `e2eff85` `34fb997` `a313717` | awareness spine, three-surface chaining, desire axis, the 2-of-4 gate, per-surface judging, image hook line, Node 6 crash guard |
| **Publish path steps 1–4b** | `64f5dc8` `20a0f39` `8502f36` `269947c` `793d4ed` | gated copy reaches Meta, `conceptId` on adCopy + adCreatives, concept-keyed assembly, hook identity |
| **4c harness** | `e862c76` `f528800` `632db5b` `087873a` | three-phase prepare/publish/teardown, min-2 floor, active-angle token scoping |
| **Compliance precision** | `11a920a` | the `"scale"` collision and guarantee-negation fixes |
| **Migrations** | `0697cad` `38140a6` (+ 0097–0103 in tree) | additive, **already applied to prod**, code not live |
| **Teardown safety** | `71e28e1` `b9cf6d2` | userId guard, protected-service refusal, 3-object sweep |
| **Docs / proofs** | 9 commits | CHECKPOINT, research, plans, control-run record |

**Diff scope:** 94 files, +20,079 / −153. **Only ONE client file changed in the entire sprint**
(`client/src/v2/PushKitModal.tsx`) — verified by `git diff --name-only origin/railway-build..HEAD -- client/`.
**The whole UX layer a coach touches is already deployed.** This sprint is server-side almost end to end,
which materially lowers the risk of deploying it.

### Gates, re-measured today

| gate | result |
|---|---|
| `npx tsc --noEmit \| grep -c "error TS"` | **34** — baseline holds exactly |
| Canonical 13-suite copy/image gate (CHECKPOINT §8 command) | **573 passed / 13 suites** |
| 4c safety set, 9 suites | **241 passed / 9 suites, 0 skipped** |

📌 The 13-suite figure is **573**, not the **556** CHECKPOINT §8 records. The doc is stale by 17; the command
is the authority. Not a regression — no suite failed.

---

## 2. END-TO-END COACH JOURNEY

**Question: can a real coach go intake → 11 nodes → published campaign reaching Meta and a CRM?**
**Answer: almost. Four hard breaks and two silent ones.**

Production evidence that the cascade genuinely runs (read-only query over `campaignKits`, n=68):

| stage | kits reaching it |
|---|---|
| Offer | 49 |
| Unique Method | 47 |
| Lead Magnet | 47 |
| Headlines | 51 |
| Ad Copy | 57 |
| Landing Page | 45 |
| Email | 39 |
| WhatsApp | 36 |
| **Ad Images (final node)** | **32** |

**32 of 68 kits completed all eleven nodes on the deployed build.** The cascade is not theoretical.

Landing pages: **92 rows, 38 carrying a `publicSlug`** — so LP generation *and* publishing both work in
production today.

### Step-by-step

| # | step | status | evidence |
|---|---|---|---|
| 1 | Signup / auth | ✅ **works deployed** | Google OAuth + magic links, `server/_core/index.ts:615`; 23 users across Mar–Jul 2026 |
| 2 | Service + ICP intake | ✅ **works deployed** | 126 services, 103 ICPs on prod |
| 3 | Nodes 3–11 cascade | ✅ **works deployed** | 32 kits complete end to end (table above) |
| 4 | Operator capture (`[INSERT_*]`) | ✅ **works deployed** | `client/src/v2/components/V2OperatorIntake.tsx` present at `51eda78`; `applyOperatorAnswer` wired via `routers/landingPages.ts`, `routers/campaignKits.ts` |
| 5 | Publish landing page | ✅ **works deployed** | 38 published slugs; token gate at `server/landingPagePublisher.ts:183` |
| 6 | **Push to Meta** | ⚠️ **works, but ships UNGATED copy and can hard-fail** | see below |
| 7 | **Ad-to-page compliance** | 🔴 **SILENTLY DEAD on both branches** | see below |
| 8 | **Push to CRM (GHL)** | ⚠️ **writes Custom Values into a location with no workflows** | see below |
| 9 | Multi-ad into one ad set | 🔴 **not deployed, never run against Meta** | 4c harness, local only |

### 🔴 BREAK 1 — the ad-to-page gate never runs. Both branches. Product path.

⚠️ **CORRECTED 2026-08-17 — this section originally called it "the ad-to-page compliance gate",
which reads as though it screens the landing page for blocking claims. It does not.**
`checkAdToPageMatch` (`_core/complianceAxis.ts:1069`) is a **destination-match** check: it compares
the ad's content words against the page's and raises one class, `ad_to_page_mismatch`, when overlap
is ≤10% — Meta's rule that an ad must match the destination it points at. **Page compliance is
screened at generation** (`landingPageGenerator.ts:769-774` plus the persistence backstop), not
here. Fixed 2026-08-17; see CHECKPOINT §0-FIX.

`server/routers/meta.ts` builds its page text from `(lp as any)?.content` — **a column `landingPages` does
not have.** Confirmed against production:

```sql
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME="landingPages" AND COLUMN_NAME IN ("content","publicUrl","originalAngle");
→ originalAngle, publicUrl        -- "content" absent
```

`content` is always `undefined`, the `if (content && typeof content === "object")` never fires, `pageText`
is never built, and **`checkAdToPageMatch` is never called.** Meta's own destination-match rule is unchecked
for every real coach.

🔑 **This is NOT the dead gate CHECKPOINT records as fixed.** That fix landed only in the 4c *script*
(`server/scripts/step4c-multiad-publish.ts:576`, whose comment reads *"🔴 LATENT BUG, FIXED HERE"*). The
**product's** publish path still carries it at **`server/routers/meta.ts:338` and `:533` — two sites, present
identically on `origin/railway-build` and on local HEAD.** Fixing the harness did not fix the product.

### ⚠️ BREAK 2 — the copy that reaches Meta is ungated, and our own gate can then block it

On the deployed build, `publishToMeta` does not consult the gated pool at all:

```
git show origin/railway-build:server/routers/meta.ts | grep -c publishCopySource  → 0
grep -c publishCopySource server/routers/meta.ts                                  → 2   (local only)
```

Deployed, the headline is `selectedCreative.headline` (`PushKitModal.tsx:263`) — an image-side row that never
passed the gate — and the body is `deriveDefaultBody` (`:72`), i.e. the landing-page subheadline. Meanwhile
CHECKS 1–2 in `meta.ts` **do** screen that copy at publish. So page copy written as page copy is screened as
*ad* copy at the final step. **The 2026-08-09 control run is the proof this reproduces: it was blocked by our
own gate on `second_person_protected_attribute`, before any Graph call.** A coach who did everything right can
hit a hard stop at the last button. Step 1 (`64f5dc8`) fixes this and is undeployed.

### ⚠️ BREAK 3 — the CRM half cannot complete

`GHL_MASTER_SNAPSHOT_ID` is **not set on production** (checked against the Railway variable name list; value
never read). `server/routers/ghl.ts:275` therefore returns `masterSnapshotId: null`, and the client hides the
deep-link banner by design (`PushKitModal.tsx:465`, `V2GeneratorWizard.tsx:733`). Per CLAUDE.md §11 the
snapshot apply **cannot be automated** and the customer must click that deep-link once. With the variable
unset, **the coach is never shown the link**, so the 16 ZAP workflows are never installed, and the push writes
Custom Values into a location with nothing to consume them. One GHL token row exists on prod.

### Manual intervention points

1. Operator questions must be answered before an LP will publish (by design, and correct).
2. **The GHL snapshot must be applied by hand in the customer's own GHL** — unautomatable, and currently
   unreachable because of Break 3.
3. Meta connection is per-coach OAuth via `V2Settings.tsx`; **today exactly one token row exists, `userId=1`.**
   No coach other than Arfeen has ever connected.

---

## 3. PER-NODE STATUS — ALL ELEVEN

Node list is authoritative from `client/src/v2/V2Trail.tsx:44-56` (`STOP_DEFS`).

**Compliance coverage map**, established by grepping call sites rather than reading docs:
`gateBeforePersist` (the persistence backstop) is called for **8 tables** — `headlines`, `hvcoTitles`,
`heroMechanisms` (via `server/db.ts:108/189/288`), `offers`, `adCopy`, `landingPages`, `emailSequences`,
`whatsappSequences`. `checkOutput` (generation-time) is called by `conceptGenerator`, `headlinesGenerator`,
`adCopyGenerator`, `landingPageGenerator`, `conceptScriptGenerator`, `landingPagePublisher`, `routers/meta`.

| # | node | file | status | Andromeda / compliance |
|---|---|---|---|---|
| 1 | **Service** (intake) | `routers/services.ts` | ✅ built & working | n/a — structured input |
| 2 | **ICP** | `_core/icpGenerate.ts` + `icpGrounding.ts` | ✅ built & working | **own grounding validator** (`validateIcpGrounding`, Class-A retry, provenance labels) — **not** the compliance layer, **no Andromeda spine** |
| 3 | **Offer** | `offersGenerator.ts` | ⚠️ built, below standard | persistence backstop only (`:540`); **no generation-time gate, no spine** |
| 4 | **Unique Method** | `heroMechanismsGenerator.ts` | ⚠️ built, below standard | backstop only via `db.ts:288`; **no generation-time gate, no spine** |
| 5 | **Lead Magnet** | `hvcoGenerator.ts` (titles) · `leadMagnetContentGenerator.ts` (body) · `bonusGenerator.ts` | ⚠️ built, **partially ungated** | titles get the backstop (`db.ts:189`); **the BODY and the BONUSES have no gate at all** — `bonusGenerator.ts:231` inserts direct |
| 6 | **Headlines** | `headlinesGenerator.ts` | ✅ **at standard — undeployed** | `checkOutput` ×4 + backstop ×3 + P.D.A.F.; 25 spine markers |
| 7 | **Ad Copy** | `adCopyGenerator.ts` | ✅ **at standard — undeployed** | `checkOutput` ×2 + backstop + full spine; 52 spine markers |
| 8 | **Landing Page** | `landingPageGenerator.ts` | ⚠️ **partially gated** | generation gate screens **11 of ~78 fields** (`:769-774`); **`faq` and `guarantee` excluded** — the open FAQ blocker |
| 9 | **Email** | `emailSequenceGenerator.ts` | ⚠️ built, below standard | backstop only (`:1156`); **no generation gate, no spine** |
| 10 | **WhatsApp** | `whatsappSequenceGenerator.ts` | ⚠️ built, below standard | backstop only (`:1010`); **no generation gate, no spine** |
| 11 | **Ad Images** | `adCreativesGenerator.ts` | ⚠️ built, below standard | `checkCompliance` ×3 = **scoring only, not blocking**; spine present (15 markers) but **undeployed** |

### Nodes generating content that never passed the compliance work

**Seven of eleven.** Nodes **3, 4, 5, 9, 10** have only the persistence backstop and no generation-time
screen; node **5's lead-magnet body and bonuses have no screen at any layer**; node **11** only scores.
Node **8** is screened on 11 fields and blind on the rest — which is exactly how the `faq[6].answer`
`promised_result` line reached a page.

📌 Consistent with the 2026-08-15 audit: none of the seven upstream generators has been touched since
2026-07-29, and all show **0 spine markers**.

---

## 4. THE APP AND UX LAYER

**Functional end to end for a coach, and already deployed.** Every key surface exists at `51eda78`:
`V2Trail.tsx`, `V2CampaignKit.tsx`, `PushKitModal.tsx`, `V2OperatorIntake.tsx`, `V2AutoModeIntake.tsx`,
`V2Settings.tsx`. The 32 fully-completed kits are the behavioural proof.

| surface | state |
|---|---|
| Auth (Google OAuth + magic link) | ✅ working |
| Create campaign / trail intake | ✅ working |
| Move through 11 nodes, deal & select | ✅ working — `AUTO_STEPS`, `DealableConfig` |
| Auto Mode | ✅ built — `routers/autoMode.ts` (`orchestrate`, `orchestrateStep`, `importIcp`, `importAssets`, `extractFromAssets`, `checkCoherence`) |
| Campaign Kit + "Use This & Continue" | ✅ working |
| Publish landing page | ✅ working (38 live) |
| Push to Meta / GHL | ⚠️ works, with §2 breaks |

### Half-built or disabled

1. 🔴 **Video Creator — hard-disabled.** `VIDEO_CREATOR_FEATURE_ENABLED = false`
   (`V2VideoCreator.tsx:28`), renders a "Coming Soon" placeholder (`:244`). `REMOTION_LAMBDA_FUNCTION`
   is **not set on production**, consistent with the flag.
2. ⚠️ **Landing page is not compliance-scored in the trail.** Deliberate and documented at
   `V2Trail.tsx:113-117` — `landingPages` has no `complianceScore` column, and showing a dial with no real
   score behind it would breach the honesty rule. Only 3 nodes carry a score dial (headlines, ad copy, +1).
3. ⚠️ **Ad Images node has no Tweak surface** — `tweakable: false`, flagged in-code as an "honest gap"
   (`V2Trail.tsx:123-125`).
4. ⚠️ **Meta push is blocked until the LP is published** — `PushKitModal.tsx:488`. Correct behaviour;
   listed because it is a sequencing constraint a coach will meet.
5. 📌 `meta.publishAssembledAds` (multi-ad tRPC) is **wired to no client** — grep over `client/src` returns
   zero hits. Server capability only.

---

## 5. OPERATIONAL LAUNCH-BLOCKERS

### Meta

| item | state |
|---|---|
| Token | **1 row**, `id=3`, `userId=1`, ad account + page present. Expires **2026-10-05 — 50 days left** |
| Token coverage | 🔴 **Only Arfeen has one.** No coach can publish without their own OAuth |
| App Review / Advanced Access | **UNVERIFIED** — lives in Meta's App Dashboard, not readable from this repo; needs Arfeen's login. Per CLAUDE.md §8c it is **not** required for Arfeen's own account, but **is** required to onboard other coaches |
| Published ads | **2 rows**, both `userId=1`, both PAUSED, both **2026-05-12** app-review dummies |

🔴 **The Advanced Access track is the single biggest unknown in this audit, and it gates the business model.**
Serving `ads_management` against ad accounts Arfeen does not own requires it. Until confirmed, "coaches
publish their own ads" is unproven.

### Clean-slate wipe — **HAS NOT HAPPENED**

| table | rows |
|---|---|
| `services` | 126 |
| `idealCustomerProfiles` | 103 |
| `campaignKits` | 68 |
| `landingPages` | 92 (38 published) |
| `adCopy` | 5,424 |
| `headlines` | 2,174 |
| `adCreatives` | 405 |

All still present. Protected services verified intact and untouched: `272:5 273:5 275:5 276:5 277:5 285:4`
= **29**. CHECKPOINT §12.6 notes 216 legacy headline rows still carry raw `[INSERT_*]` tokens, with
Arfeen's 2026-08-08 call being **no backfill — they go in the wipe**. The wipe is still outstanding.

### `ANTHROPIC_API_KEY` rotation — **UNVERIFIED, and deliberately so**

The variable **is set** on production. Whether its *value* changed since the 2026-08-12 exposure cannot be
determined without reading the secret, which this audit will not do. **Treat as NOT rotated until Arfeen
confirms.** `AWS_ACCESS_KEY_ID` is also set (an identifier, not a secret).

### Error handling and monitoring

- 🔴 **No APM / error tracking.** Grep for `sentry|Sentry|datadog|newrelic` across `server` and `client`
  returns **zero files**. Production errors surface only in Railway logs, which nobody is watching.
- 🔴 **The zombie-job defect is live.** `reapStuckJobs` (`server/_core/index.ts:61-80`) sweeps
  **`status = "pending"` only**. A job that reaches `running` and dies is **never** swept — the coach sees a
  wizard that never finishes and never fails. Currently `jobs_running = 0` and `jobs_pending = 0`, so nothing
  is stuck right now, but the mechanism is unguarded.
- ⚠️ **No low-balance guard on the Anthropic key.** CHECKPOINT records two credit-exhaustion incidents
  (2026-07-24, 2026-08-09); when credit runs out every generator fails with a 400 deep in a run.
- ✅ Boot-time font validation and the reaper both run (`_core/index.ts`) and are deployed.

### Currency-aware budget validator — **NOT FIXED**

```
server/routers/meta.ts:279   dailyBudget: z.number().min(1).optional()
server/routers/meta.ts:459   dailyBudget: z.number().min(1).optional()
server/routers/meta.ts:731   dailyBudget: z.number().min(1).optional()
```

Three sites, all USD-assuming. The ad account is **AED**; Meta rejects a budget of 1 with *"must be more than
AED3.00"*. The modal's default of 20 masks it. A coach on any non-USD account who types 1 or 2 gets a raw
Graph error.

### Billing — 🔴 **NOBODY HAS EVER PAID**

Stripe is fully configured on production: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`VITE_STRIPE_PUBLISHABLE_KEY`, and four price IDs (pro/agency × monthly/yearly). Code exists at
`server/stripe/webhook.ts`, `server/stripe/products.ts`, `server/routers/subscription.ts`.

**But the production data says the path has never executed:**

```sql
SELECT COUNT(*) FROM users WHERE stripeSubscriptionId IS NOT NULL;  → 0
-- 23 users show subscriptionStatus active(11) / trialing(12)
-- exactly 1 user has a stripeCustomerId
```

**Zero Stripe subscriptions against 23 "active or trialing" users.** Those statuses are manual/test grants,
not paid subscriptions. **The checkout → webhook → entitlement loop is unproven end to end in production.**
Whether the keys are live-mode or test-mode is **UNVERIFIED** (values not read).

### Day-one breakage for a real paying coach

1. Cannot pay — checkout/webhook never exercised (above).
2. Cannot connect Meta unless Advanced Access is granted — **UNVERIFIED**.
3. Ad-to-page compliance silently unchecked → Meta-side rejection risk we cannot see coming.
4. Ungated copy at publish → possible hard block at the final button.
5. GHL workflows never installable → CRM half inert.
6. Non-USD budget entry throws a raw Graph error.
7. A crashed job hangs forever with no failure state.
8. No monitoring — we would learn about all of the above from the coach, not from an alert.

---

## 6. KNOWN-DEFECT AND PARKED-LIST TRIAGE

| item (CHECKPOINT ref) | verdict | one-line reason |
|---|---|---|
| **FAQ `promised_result` on active angle** (§0) | 🔴 **BLOCKING** | ships a non-compliant outcome promise on the page Meta scans |
| **Ad-to-page dead gate in `meta.ts`** (this audit) | 🔴 **BLOCKING** | Meta's destination rule unchecked for every coach, both branches |
| **Ungated copy reaches Meta** (§12.7) | 🔴 **BLOCKING** | coach can hard-fail at the last step on copy nobody screened |
| **Stripe never exercised** (this audit) | 🔴 **BLOCKING** | no revenue path proven; a paying coach cannot actually pay |
| **Meta Advanced Access** (§8c) | 🔴 **BLOCKING (unverified)** | without it no coach but Arfeen can publish |
| **`GHL_MASTER_SNAPSHOT_ID` unset** (this audit) | 🔴 **BLOCKING for the CRM half** | deep-link hidden → workflows never installed |
| **Clean-slate wipe not done** (§7) | 🔴 **BLOCKING** | 216 headline rows carry raw `[INSERT_*]`; dummy data would greet real users |
| **Zombie job — reaper skips `running`** (§12.9) | 🔴 **BLOCKING** | a dead job hangs the wizard forever with no error |
| **No error monitoring** (this audit) | 🔴 **BLOCKING** | we cannot detect any of the above in production |
| **`ANTHROPIC_API_KEY` rotation** (§0 housekeeping) | 🔴 **BLOCKING** | exposed key still possibly live |
| **Currency-unaware `dailyBudget`** (§0a.4) | 🟡 **BLOCKING if launching outside USD** | AED/GBP coach hits a raw Graph error on a plausible input |
| **No Anthropic low-balance guard** (§8) | 🟡 **BLOCKING-ish** | credit exhaustion fails every generator with no coach-facing message |
| **Node 5 body + bonuses ungated** (this audit) | 🟡 **BLOCKING-ish** | a whole deliverable class never screened; cheap to wire to the backstop |
| **`story` formula wrong shape** (§"PRE-LAUNCH") | 🟡 post-launch | costs a fifth of the deck; survivable, guard already catches it |
| **Video Creator disabled** (§4) | ⚪ **POST-LAUNCH** | honestly labelled "Coming Soon"; not on the campaign path |
| **4c multi-ad unproven** (§0a.4) | ⚪ **POST-LAUNCH** | see §7 — not required for one campaign |
| **4 → 8 cardinality + hook supply** (§0a.1) | ⚪ post-launch | an optimisation above today's working 4 |
| **Blank hook band** (§0-DEC Decision 2) | ⚪ post-launch | only fires when the hook deck runs short; 4 slots currently supplied |
| **Ship-vs-drop strictness** (§0a.3) | ⚪ post-launch | open product call, no correctness impact |
| **Duplicated page render in `--prepare`** (§0a.5) | ⚪ post-launch | harness-only; publisher's gate remains authority |
| **Coach-scoped snapshot must grow** (§0a.6) | ⚪ post-launch | harness-only, one token today, comment in place |
| **8 legacy Cloudinary orphans** (§12.12) | ⚪ post-launch | cost only; needs a pattern-scoped sweep |
| **Service 287 inert rows** (§7) | ⚪ post-launch | dies in the clean-slate wipe |
| **`generateAsync` 1:1 emit / `makeVertical`** (§5.7-8) | ⚪ post-launch | inert or cosmetic; belongs to the wiring gap |
| **5-of-8 fan-out sites pass no stage** (§5.1) | ⚪ post-launch | pre-rebuild prompt, not broken output |
| **Node 6 zero-axis pairs / no-service desire** (§12.5) | ⚪ post-launch | pigeonhole, retired by the volume trim |
| **`adSetId: "temp"`** (§8c) | ⚪ post-launch | internal traceability only |
| **LP not compliance-scored in trail** (§4) | ⚪ post-launch | honest omission, no false signal shown |

---

## 7. HONEST BOTTOM LINE

### Does the minimum launch require the 4c multi-ad proof? **No.**

**Stated plainly: 4c is not on the MVP path, and I would stop work on it.**

- The MVP is *one compliant campaign end to end*. That needs **one** ad, and `publishToMeta` — the
  single-ad path — is **built, deployed, client-wired** (`PushKitModal.tsx:291`) and has genuinely created
  real Meta objects before (the 2 rows from 2026-05-12, and the step-1 paused ad read back by id).
- 4c proves something different and strictly larger: **N ads into ONE campaign and ONE ad set**, so Meta
  compares variants in a shared auction. That is a *delivery-efficiency* property. It matters once coaches
  run real budget; it is not required for a coach to publish a compliant campaign.
- `meta.publishAssembledAds` **is wired to no client** — so 4c cannot reach a coach today even if proven.
- CHECKPOINT itself says `publishToMeta` "is the single-ad way and does it better" for one ad.

The FAQ blocker is worth fixing regardless — but note it blocks **4c**, not the MVP: the compliance hit is
in a page field, and it should be fixed because it ships a non-compliant promise, not because 4c is waiting.

### MUST-HAVE BEFORE LAUNCH

| # | item | effort |
|---|---|---|
| 1 | **Fix the dead ad-to-page gate in `routers/meta.ts` (2 sites)** — read the active angle, as the 4c script already does | **S** (~half day, pattern already written) |
| 2 | **Deploy the sprint.** 29 commits, server-side, migrations already applied, gates green (34 / 573 / 241) | **S** — but needs a staged smoke, call it **M** |
| 3 | **Prove Stripe end to end** — one real checkout → webhook → entitlement, and confirm live vs test keys | **M** |
| 4 | **Confirm Meta Advanced Access** (or scope launch to coaches who bring their own app) | **UNKNOWN — Arfeen must check the dashboard first** |
| 5 | **Fix the FAQ generation prompt** — the three layers + one niche-agnostic guardrail (already specced) | **S–M** |
| 6 | **Set `GHL_MASTER_SNAPSHOT_ID`**, then apply-and-verify the snapshot once | **S** (+ dependent on the snapshot existing — **UNVERIFIED**) |
| 7 | **Rotate `ANTHROPIC_API_KEY`** and add a low-balance pre-flight | **S** |
| 8 | **Fix the reaper to sweep `running`** with a last-write-timestamp rule | **S** |
| 9 | **Wire error monitoring** (Sentry or equivalent) + one alert on generator failure rate | **S–M** |
| 10 | **Clean-slate wipe** of dummy data, preserving nothing but real accounts | **M** — needs a written, id-scoped plan and explicit approval |
| 11 | **Currency-aware budget validator** — read account currency, validate against its floor | **S** |
| 12 | **Wire Node 5 body + bonuses to the persistence backstop** | **S** |

**Rough total: ~2–3 focused weeks**, dominated by items 3, 4, 9 and 10 — and item 4 could invalidate the
whole plan, so **check Advanced Access first, before any other work.**

### CAN FOLLOW AFTER LAUNCH

4c multi-ad proof · 4 → 8 cardinality and hook supply · blank hook band · ship-vs-drop strictness · Video
Creator · the `story` formula shape · Andromeda spine for Nodes 3/4/5/9/10 (Track B) · generation-time gates
for the upstream nodes · Cloudinary orphan sweep · service 287 · `adSetId: "temp"` · LP compliance scoring ·
the render-duplication and wiring-gap items.

### The honest summary

**The product is closer to launch than the sprint narrative suggests, and further from it than the node
completion rate suggests.** Eleven nodes work, 32 kits have run the full cascade, landing pages publish, and
the entire UX is already deployed. What is missing is not features — it is the **last mile and the
commercial plumbing**: a compliance check that silently does nothing, a publish path shipping unscreened
copy, a CRM link that cannot be completed, a payment path nobody has ever traversed, and no way to observe
any of it failing.

**My recommendation: stop the 4c work.** Redirect to items 1–3 and 8–9, and get item 4 answered this week —
it is the only finding here that could change what "launch" even means.

---

### Explicitly UNVERIFIED in this audit

1. **Meta App Review / Advanced Access status** — not readable from the repo or DB; needs Arfeen's Meta
   dashboard login.
2. **Whether `ANTHROPIC_API_KEY` was rotated** — would require reading the secret.
3. **Stripe live vs test mode** — key values deliberately not read.
4. **Whether the 13 gmail.com users are real coaches or Arfeen's test accounts** — domain alone cannot say.
5. **Whether the GHL master snapshot has actually been built** in Arfeen's agency GHL — only its env var
   absence is verifiable here.
6. **Runtime health beyond deployment status** — no Railway logs were fetched; no live generation was run,
   as this pass was read-only. **No claim is made about output *quality* from any generator today** —
   per CHECKPOINT §6, that judgement is Arfeen's and CC never self-certifies a visual result.
