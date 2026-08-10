# STEP 4c — THE REAL MULTI-AD PUBLISH. PROPOSAL ONLY.

Nothing built, nothing published, nothing committed. Written 2026-08-10 against HEAD `289fa6d`.
**Every precondition below was verified live and read-only today** — no object was created, changed
or deleted on the ad account.

**What 4c proves, and it is the one thing this product has never shown:** that N assembled ads land
in **ONE campaign and ONE ad set**, so the variants finally compete in a single auction instead of
each getting its own campaign. Until that holds, the entire distinctness chapter — the gate, the
concept stamps, the assembly — buys nothing at delivery time.

---

## 1. PRECONDITIONS — verified today, read-only

### ✅ 1.1 The token is LIVE, not merely unexpired

Two different checks, because they answer different questions:

| check | result |
|---|---|
| our `meta_access_tokens` row | id **3**, userId **1**, expires **2026-10-05**, **56 days left**, one row only, `adAccountId` and `pageId` both present |
| **Meta's own answer to `GET /me`** | **`Afshan Khan` (id 122189493128796882)** — the token is genuinely honoured right now |

The second matters: our expiry column proves only what we *believe*. A rotated app secret or a
disconnected account would leave the row looking perfect and fail on the first write.

### ✅ 1.2 The app secret and app config are current

`META_APP_ID`, `META_APP_SECRET` and `VITE_APP_URL` are all present on Railway `coachflow` /
`production` (secret confirmed present, value never printed). The successful `GET /me` is the
practical proof they are consistent — an app-secret mismatch surfaces as an OAuth error, not a name.

### 🔴 1.3 THE BUDGET FLOOR — our code's assumption is wrong, and 4c is where it would bite

| fact | value |
|---|---|
| ad account | `act_1254349025145319` — **"KS 1"** |
| **currency** | **AED** |
| account status | **1 (ACTIVE)** |
| timezone | Asia/Dubai |
| **lifetime spend on this account** | **116,832,437 minor units ≈ AED 1,168,324** |

⚠️ **This is not a sandbox. It is a real, active, million-dirham ad account.** Scope everything
accordingly.

**What the path would actually send.** `createAdSet` converts to minor units —
`Math.round(dailyBudget * 100)` — and `publishAssembledAds` validates `z.number().min(1)`:

| our `dailyBudget` | sent to Meta | verdict |
|---|---|---|
| `1` (our validator's minimum) | `100` = AED 1.00 | 🔴 **REJECTED** — measured on this account in step 1: *"must be more than AED3.00"* |
| `20` | `2000` = AED 20.00 | ✅ **ACCEPTED** — proven on the step-1 publish |

📌 **Meta does not expose a per-currency floor to query.** `min_daily_budget_low_freq` does not
exist on the ad account in v21 — I tried it and Meta answered `(#100) Tried accessing nonexisting
field`. So the floor is the **measured** one from this account, not a documented one.

🔴 **"Zero budget" is NOT achievable, and the plan must not pretend otherwise.** `createAdSet`
omits `daily_budget` entirely when the value is falsy, and Meta rejects an ad set carrying neither a
daily nor a lifetime budget when the campaign has no CBO. **The honest minimum is a real number
above the AED 3.00 floor.**

**Recommendation: pin `dailyBudget = 20` in the harness — the value already proven accepted on this
exact account — and have the harness REFUSE to send anything below 4.** A budget is a ceiling, not a
charge: with everything PAUSED nothing delivers and nothing is spent, so choosing the proven value
buys certainty at zero cost, whereas probing the exact floor risks a rejected ad set part-way
through a live run.

📌 **Do NOT fix the currency-unaware `min(1)` as part of 4c.** It is a real pre-launch defect and it
stays parked: changing validation inside a live-fire proof would smuggle a behaviour change into the
one run whose job is to show the existing behaviour works. The harness pinning its own value is what
keeps this run honest.

### ✅ 1.4 PAUSED is the default, in three independent places

`publishAssembledAds`'s zod input defaults `status` to `"PAUSED"`; `multiAdPublish` applies that one
status to **campaign, ad set AND every ad**; and the harness will pass it explicitly as well.
Nothing can deliver, so nothing can spend.

### ✅ 1.5 The pre-existing orphans are now identified BY ID

The account carries **5** campaigns named exactly `"Auto Campaign Kit"` against **2** rows in
`meta_published_ads`:

| | ids |
|---|---|
| tracked (ours, from 2026-05-12) | `120246733556760626`, `120246734574720626` |
| 🔵 **PRE-EXISTING ORPHANS — LEAVE ALONE** | `120246733286970626`, `120246731977370626`, `120246731522130626` |

**4c must not touch, delete, count or "tidy" any of these five.** They are a separate parked
question. 4c's only obligation is to not add a sixth.

⚠️ **The campaign listing came back at exactly 200, the limit I set — so it is TRUNCATED.** There
may be older campaigns beyond it. This is precisely why teardown must key on **ids the run itself
created**, never on a name match. See §3.4.

---

## 2. WHAT THE RUN PUBLISHES — and why it needs its own cascade

⚠️ **4c runs as userId 1, NOT the 117174 smoke account.** The Meta token is bound to user 1, so the
smoke harness cannot publish. That means the assembled ads must belong to user 1 — so the run
creates its **own labelled throwaway cascade under the owner account**: service → ICP → concepts →
Node 7 copy → 4 creatives → its own landing page.

**Why its own landing page rather than reusing an existing one.** The publish gate runs
`checkAdToPageMatch` between the ad copy and the destination page, and Meta itself reviews the
destination. Pointing throwaway ad copy at an unrelated live page invites a block that would tell us
nothing about the capability under test — and the step-1 control run was blocked on exactly this
class. A page generated from the same brief agrees with the copy by construction.

📌 **This is a bigger run than 4b**: it writes local rows under the owner account and publishes a
real (if throwaway) landing page. Both come back in teardown (§3.5).

**How many ads:** publish **3**. Two would technically prove shared-ad-set membership; three
exercises the loop and shows it is not a two-case special case. If assembly yields fewer than 2
eligible ads, **stop and report** — the structural claim is unprovable with one.

---

## 3. THE RUN, STEP BY STEP

### 3.1 Labelling — unambiguous, and never the orphans' name

Campaign name: **`ZZ-4C-MULTIAD-<UTC timestamp>`**.

🔴 **It must NOT be "Auto Campaign Kit".** Reusing that name would make the test campaign
indistinguishable from the three orphans at a glance and put them at risk from any future cleanup.
The `ZZ-` prefix matches the throwaway convention already used for local proof rows.

### 3.2 The created-ids ledger, written the moment each object exists

Every id — campaign, ad set, each creative, each ad — is appended to a local file
**immediately as it is returned**, before the run does anything else.

**This is the Cloudinary lesson applied to Meta.** If the process dies mid-run, the delete list must
already be on disk; an id you never wrote down is an orphan you cannot find later without a name
search, and the name search is the thing §1.5 shows to be unreliable.

### 3.3 Gate before create, and partial failure keeps what landed

Already built into `multiAdPublish` and unit-proven with injected fakes:

- **every ad is compliance-screened BEFORE any object is created.** If all are blocked, the run
  **refuses without creating a campaign** — no empty shell, which is how the orphan class is
  believed to have formed in the first place;
- screening **fails closed** — a gate that throws blocks that ad;
- **one campaign, one ad set**, then a creative and an ad per survivor;
- a Graph failure part-way through **keeps the campaign, the ad set and the ads that already
  landed**, and reports the failure by index and stage. It does not half-create and lose track, and
  it does not tear down good ads to tidy up a bad one.

### 3.4 THE READ-BACK PROOF — Meta's stored state, never our own request

After creating, read every object back **by id** (`getAdById`, `getAdSetById`, `getCampaignById`,
`getAdCreativeById`) and assert:

1. 🔑 **every ad's `adset_id` is the SAME single value** — the whole point of 4c;
2. that ad set's `campaign_id` is the one campaign we created;
3. **campaign, ad set and every ad all report `status = PAUSED`** — read from Meta, not assumed;
4. the ad set's `daily_budget` is `2000` (AED 20.00), confirming what Meta actually stored;
5. each creative's `effectiveTitle` / `effectiveBody` **equal the assembled `adCopy` rows by id** —
   the same by-id read-back that made step 1 credible.

A create call returning an id is not evidence of what Meta stored. Only the read-back is.

### 3.5 TEARDOWN — Meta-side, then local

**Meta side, by id ONLY:**

- delete **only** the campaign id this run recorded in its ledger (deleting a campaign removes its
  ad sets and ads);
- 🔴 **a hard refusal, checked against the resolved id before any DELETE**: if the id to delete is
  any of the five known `"Auto Campaign Kit"` ids (2 tracked + 3 orphans), **throw and delete
  nothing**. Same shape as `PROTECTED_SERVICE_IDS` in the local teardown, and for the same reason —
  the guard must sit on the resolved target, not on the arguments;
- **never delete by name**, for the truncation reason in §1.5;
- confirm by id afterwards: `getCampaignById` returns **`status = DELETED`** (Meta SOFT-deletes, so
  the id stays readable — which is exactly why a by-id read beats a list check), and each ad id
  reads back gone;
- re-inventory `"Auto Campaign Kit"` campaigns and confirm the count is **still 5, unchanged** —
  proving the run neither added to nor removed from the pre-existing discrepancy.

**Local side, unchanged discipline:** id-scoped teardown with **Cloudinary cleared before the rows**
(read the ids → delete the objects → delete `adCreatives` → `adCopy` → `campaignConcepts`), the
throwaway landing page unpublished and deleted, the `meta_published_ads` rows this run inserted
deleted by id, and everything reconciled to:

**adCopy 5424 · headlines 2174 · adCreatives 405 · campaignConcepts 6 · meta_published_ads 2 ·
running jobs 0 · protected `272:5 273:5 275:5 276:5 277:5 285:4` = 29, untouched.**

### 3.6 Stop conditions — any one of these ends the run

- `GET /me` fails or the token row is missing/expired → **stop, publish nothing**;
- assembly yields fewer than 2 ads → **stop**, the structural claim is unprovable;
- compliance blocks all ads, or leaves fewer than 2 → **stop**; nothing will have been created;
- the ad set is rejected on budget → **stop and report the exact Graph error**, do not retry with a
  different number inside the same run;
- anything unexpected → stop, and tear down what the ledger records.

---

## 4. WHAT THIS RUN DOES NOT DO

- **It does not set anything ACTIVE and does not spend.** Every object is PAUSED.
- **It does not touch the 5 pre-existing "Auto Campaign Kit" campaigns**, or any of the ~200 real
  campaigns on the account.
- **It does not fix the currency-unaware budget floor** (parked), the `story` formula shape defect,
  or the Anthropic low-balance guard.
- **It does not build the coach-facing multi-ad UI** (4d) — the capability is proven first.
- **It does not deploy.** `origin/railway-build` stays at `51eda78` unless separately authorised.

---

## 5. WHAT IS NEEDED ON THE DAY

Two separate explicit words from Arfeen, not one:

1. **to run the publish** — this writes to the real ad account;
2. **to run the teardown** — this deletes from it.

Nothing commits, publishes or deploys before that. If the session is interrupted between the two,
the created-ids ledger (§3.2) is what makes the teardown recoverable.
