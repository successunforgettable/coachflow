# PRE-LAUNCH DUMMY-DATA WIPE — 2026-09-12

**Authority:** Arfeen, 2026-09-12 — explicit, conditional production delete. Everything that fails the
retention test goes; anything that passes is held and reported. **Established fact (Arfeen):** ZAP has never
been public; every account, campaign, page and asset is test data.

Every number below was MEASURED at run time (§15f). The working files (manifest, scripts, raw outputs) sit
in the private export folder named in §4.

---

## 1. INVENTORY — read-only, before anything was removed

| layer | what was there |
|---|---|
| **MySQL** (production: `MySQL Community Server - GPL`) | 58 tables · **18,725 rows** · 23 user accounts. Largest: `hvcoTitles` 7,077 · `adCopy` 5,484 · `headlines` 2,198 · `heroMechanisms` 1,200 · `product_events` 988 · `adCreatives` 430 |
| **Cloudflare KV** `ZAP_PAGES` (the only namespace) | **79 keys**: 32 bonus pages, 3+3 magnet pages, 41 landing-page and legacy magnet slugs |
| **Cloudinary** `dunshei0y` | **1,640 assets, 2.06 GB** — ad creatives 933 · generated images 560 · bonuses 35 · voiceovers 13 · lead magnets 11 · coach assets 7 · comparison images 17 · Cloudinary's own samples 64 · one real photo |
| **S3** `remotionlambda-useast1-am9lni57ts` | `renders/` 14 objects (generated video) · `sites/` 27 objects (the deployed renderer bundle — infrastructure) |
| **Backblaze** (Creatomate vendor storage) | 2 generated videos referenced by `videos` rows 1 and 6 — no credentials held |
| **Meta ad account** (external) | 3 PAUSED campaigns recorded in `meta_published_ads` (rows 1, 2, 5); row 5 is "ZZ-GATE-POSITIVE-ARM", reserved for Arfeen's own deletion |
| **GoHighLevel** (external) | custom values previously pushed to the master location |

## 2. RETENTION — what survives, and under which test

| kept | under | why |
|---|---|---|
| **Service 318, ICP 291, kit 225** and every row hanging off them (the 55-title set A, offer 218, mechanism 1271, magnet 7293, headline 2374, ad copy 6205, LP 241, email 424, WhatsApp 293, bonuses 42–44 with their KV pages and PDFs) | **Test 1** — pinned copy-grounding corpus | `traceability-proof.ts --service 318 --icp 291 --kit 225 --set A`; kit 225's selections all resolve inside service 318 |
| **User 117174 and all its content** (services 272–277, 20 kits, 6 LPs, 360 titles, 25 ad creatives) | **Test 2** + the prohibition | the Playwright prod smoke harness logs in as this account; it owns protected services 272–277 |
| **Service 285** (user 1) + ICP 262, kit 200, bonuses 33–35 with their pages and PDFs, LP 235, 52 titles, 4 ad creatives | **the prohibition** | "never touch services 272–277 and 285" |
| **User 1** — the login and its account-level rows (`ghl_access_tokens`, `meta_access_tokens`, `meta_published_ads`, `user_onboarding`, `videoCredits`, `videoCreditTransactions`) | **Test 3** + HELD (see §6) | the dev account; its generated content goes |
| — | **Test 4** | **no ZAP record carries a real Stripe transaction — verified**, see §3 |
| **Cloudinary:** 76 assets referenced by retained rows · 2 used by product code (`StyleChooser.tsx` samples) · 64 Cloudinary default samples (not ZAP data) · `arfeen_pic` (HELD) | tests 1–2 / not dummy data | the style chooser renders the two samples live |

## 3. STRIPE — the finding, stated explicitly

- The live Stripe key belongs to a **shared business account**: 4,465 live charges (2,324 succeeded), 758
  customers, customer ids from 2022 — it predates ZAP (March 2026) and is not ZAP's alone.
- **ZERO subscriptions** exist on that account, so no ZAP "pro" tier is Stripe-backed — they were granted.
- **Exactly one ZAP user (10258) has a `stripeCustomerId`; that customer has ZERO charges.**
- `videoCreditTransactions`: 23 rows, **0** with a `stripePaymentIntentId` (types: deduction, free_grant, refund).
- No Stripe customer carries ZAP's `metadata.userId`.
- **Verdict: no ZAP record carries a real Stripe transaction. "Everything is dummy" is now a verified fact
  for payments, not an assertion.**

## 4. EXPORT — restorable, verified before any delete

**Location:** `/Users/arfeenkhan/zap-wipe-export-2026-09-12/` on Arfeen's machine (chmod 700, outside the repo,
in no commit). **Retention: 90 days — delete on or after 2026-12-11.** It holds test-account emails and
encrypted integration tokens: never copy it into the repo.

| part | verification |
|---|---|
| `zap-prod-full-2026-09-12.sql.gz` — full logical dump, all 58 tables | restored into a throwaway local MySQL: **58/58 tables, 18,725/18,725 rows**, and a per-table content fingerprint (row count + CRC of every column rendered as text, UTC) **identical on all 58 tables** |
| `kv/` — every KV value | 79/79 exported |
| `cloudinary/` — every asset in the delete set, from ORIGIN (signed download, not the CDN) | byte size checked against the inventory, per file |
| `s3-renders/` — the 14 render objects | byte size checked per object |
| `manifest2.json`, `cloudinary.json`, `kv.ZAP_PAGES.json` | the exact delete lists |

## 5. THE DELETE — manifest and method

- **Database:** one transaction, id-scoped, child-first; every table's affected rows must equal the manifest's
  count or it rolls back. **17,742 rows**, 20 accounts. Guards checked against the DATA: refuses unless the
  target reports `MySQL Community Server - GPL`; refuses any row on services 272–277/285/318; refuses any
  smoke-account row; refuses a retained user. **Rehearsed on the restored copy: 17,742 affected, table for
  table equal to the manifest, rolled back. Negative controls — protected service in the list, smoke row in the
  list, the prod path pointed at a local server — all three ABORTED.**
- **KV:** 73 keys deleted; 6 kept (`bonus-33/34/35/42/43/44`).
- **Cloudinary:** 1,497 assets (1.79 GB) deleted with `invalidate: true`.
- **S3:** the 14 `renders/` objects only; `sites/` untouched.

## 7. RESULTS — measured after the run (2026-09-11 20:36–20:56 UTC)

| layer | result |
|---|---|
| **Database** | one transaction, **COMMITTED**: 17,742 rows, table for table equal to the manifest. Snapshot diff: **58/58 tables consistent** — every deleted table lost exactly its manifest count; every other table's row count AND checksum unchanged. **18,725 → 983 rows.** 23 → 3 accounts. |
| **KV** | 73/73 deleted. Namespace now holds exactly `bonus-33/34/35/42/43/44`. |
| **Cloudinary** | 1,497/1,497 deleted (`not_found` 0). Re-inventory: **143 assets = exactly the kept set; 0 deleted assets present at origin.** |
| **S3** | 14/14 render objects deleted; bucket holds `sites/` (27) only. |
| **DB across the external deletes** | no difference, all 58 tables |

**Live verification — real fetches of the deployed site, three rounds spaced ~6 minutes:**
- **All 73 deleted page addresses return 404** in every round; all 6 kept pages return 200.
- **A random 20 of the deleted Cloudinary assets return 404** in every round.
- 🔴 **Eight lead-magnet PDF addresses that had been fetched repeatedly in earlier sessions STILL RETURN THE
  OLD FILES — 200, on a CDN cache hit — although the file is gone at origin.** Only 7233's newest address had
  dropped to 404 by round 2. **So a DELETE does not retract a cached copy either** — it extends the settled
  §0.6c finding from purges to deletes. The earlier line in this record that a whole deleted public id "is how
  7293's addresses went to 404" was wrong as a general claim: those addresses were simply not cached where they
  were fetched. **Anything published to Cloudinary stays reachable for as long as a cache holds it — up to the
  30-day `max-age`, unconfirmed beyond that.** The eight: 7233 `v1788007578` (the dead page-240 link) ·
  `v1789055696` · 5686 `v1787860054` (the funnel) · `v1789071852` (the pre-A claim) · `v1789141529` · 7173
  `v1787948313` · `v1789074179` · 7233 `v1789144605`. **Rounds at 20:42, 20:49, 20:55 UTC:** 7233 `v1789144605`
  went 200 → 404 → **200 again**; 5686 `v1789141529` 200 → 200 → 404; 7233 `v1788007578` served the 10 Sep file,
  then the 29 Aug dead-link file again in round 3. **The answers flip between caches — no address is "gone" on the
  strength of a 404.** Nothing links to any of them any more.
- **Screenshots** (real browser, deployed site): `screenshots/` in the export folder — `campaign-211`,
  `priced-to-win-170` (one of the 13 raw-token pages) and `magnet-magnet-5686` each render **"Page not found"**
  (HTTP 404); `bonus-42` (kept) renders its checklist; 7233's old PDF address still renders the PDF (the cache
  residue above).
- The throwaway verification MySQL was shut down and its data directory removed; the dump itself is kept.

## 6. FOUND, NOT ANTICIPATED BY THE SCOPE — held, not deleted

1. **User 1613 is the Meta/GoHighLevel app-review login** (`zapreviewer@…`, CLAUDE.md §12). Its content goes
   (including pages 187 and 190, as instructed); **the login is HELD** — deleting it could lock app reviewers out.
2. **User 1's integration tokens** (GHL, Meta) and the **three Meta ad rows** — HELD. They map to real, paused
   campaigns on Arfeen's ad account (row 5 is reserved for his own deletion); the Meta token is needed to delete them.
3. **Two Cloudinary images are used by product code** (the style chooser's samples) — kept; deleting them breaks a live screen.
4. **`arfeen_pic`** — a real photo, not generated — HELD.
5. **The Remotion AWS credentials can read EVERY S3 bucket on the account**, including other businesses'
   (`arfeenkhan.com`, `arfeenkhans3`, `innerdna`, a Discourse backup bucket). A security finding: the key should
   be scoped to the Remotion bucket. Nothing outside `renders/` was touched.
6. **The deploy check `e2e/deploy-verify.spec.ts:69` asserts `/p/campaign-214` serves 200** — that page was
   unpublished on 2026-09-02, so the check already fails. It needs a page that exists (e.g. `bonus-42`).
7. **Backblaze (Creatomate)** holds 2 generated videos; no credentials — not deletable from here.
8. **GoHighLevel custom values and the paused Meta campaigns** live in external systems — out of scope, untouched.
9. **User 111968** had signed in on 2026-09-07 with no content — deleted as a test account per the scope.
