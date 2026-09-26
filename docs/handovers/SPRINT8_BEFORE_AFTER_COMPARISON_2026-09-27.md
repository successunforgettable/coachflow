# SPRINT 8 BEFORE/AFTER COMPARISON — result: ✅ PASS (ship with the first deploy) — 2026-09-27

Method: `COMPLETION_AND_FIRST_DEPLOY_PROPOSAL_2026-09-24.md` §2.4. Script: `sprint8-comparison/compare.ts`.
Production's checker is `87596d7:server/_core/complianceAxis.ts` (sha256 prefix `31380da2ddb3`), copied as `oldAxis.ts`
with its two relative imports made absolute. Neither import changed on the branch. The branch's checker is the held
branch's `complianceAxis.ts`, which is identical at `c58d335` and `d2db31e`.

- **Read only.** The script sets `SESSION TRANSACTION READ ONLY` and `START TRANSACTION READ ONLY`, runs SELECTs only,
  and ends with a ROLLBACK. It refused to run unless it got `@@version_comment = 'MySQL Community Server - GPL'` and
  `@@transaction_read_only = 1`, and it got both (database `railway`). It makes no model calls.
- **Compared: `checkComplianceAxis` only.** `checkOutput` runs this and then the fabrication half, and the fabrication
  half's code is identical in both builds. So any flip can only come from the compliance axis.
- **Field roles copy production's call sites:**
  - ad copy: headline and image_hook are short, link is cta, everything else is body;
  - headlines: short;
  - landing pages: eyebrow, main headline and subheadline are short, primaryCta is cta, everything else is body
    (the generator's and publisher's mapping);
  - every other surface: body, the same role the persistence gate uses.
- An **item** is one row, or one landing-page angle, checked as a whole, the way the gates check it.

## Negative controls (§15c) — both fired

| control | expected | result |
|---|---|---|
| "You can't afford to get this wrong." (sprint 8 fixture) | BLOCKED → ALLOWED | ✅ reported |
| "start buying digital assets now" (sprint 8 fixture) | ALLOWED → BLOCKED | ✅ reported |

The script exits non-zero if either control is missing.

## Counts (measured at run time)

| surface | items | fields | blocked before | blocked after | → blocked | → allowed | hits changed, verdict same |
|---|---|---|---|---|---|---|---|
| adCopy | 73 | 73 | 2 | 1 | 0 | 1 | 0 |
| headlines | 74 | 119 | 1 | 1 | 0 | 0 | 0 |
| landingPages (angles) | 32 | 1934 | 13 | 11 | 0 | 2 | 1 |
| emailSequences | 8 | 120 | 1 | 0 | 0 | 1 | 0 |
| whatsappSequences | 7 | 47 | 0 | 0 | 0 | 0 | 0 |
| offers | 8 | 207 | 0 | 0 | 0 | 0 | 0 |
| hvcoTitles | 467 | 484 | 5 | 5 | 0 | 0 | 0 |
| bonuses | 6 | 144 | 2 | 2 | 0 | 0 | 2 |
| heroMechanisms | 117 | 234 | 9 | 6 | 0 | 3 | 0 |
| campaignConcepts | 8 | 32 | 0 | 0 | 0 | 0 | 0 |
| conceptScripts | 8 | 120 | 0 | 0 | 0 | 0 | 0 |
| adCreatives | 33 | 33 | 0 | 0 | 0 | 0 | 0 |

The checker was not blind: it blocked 33 items before and 26 after.

## Meta-publish path (reported separately)

- **Every ad-copy row, under the publish gate's roles** (headline short, body body, link cta): 72 rows. 2 were blocked
  before and 1 after. **0 became blocked**, and 1 became allowed (`adCopy#5402`, listed below).
- **Ad-to-page match** (`checkAdToPageMatch`): 360 combinations checked, meaning every headline paired with every body
  in the same ad set, against each published page belonging to the same user. **0 flips.**
- **The 3 rows in `meta_published_ads`** (ids 1, 2, 5, all PAUSED, user 1) **cannot be replayed.** Each row has
  `adSetId = 'temp'` and NULL `headlineAdCopyId`/`bodyAdCopyId` — legacy rows written before provenance was recorded —
  so the copy that shipped is not stored anywhere. The per-row replay above covers every ad-copy row still stored.

## Every flip, with its text

**Allowed → blocked: none.** Only the control flipped this way.

**Blocked → allowed: 7 distinct items. All were `clinical_outcome_claim`, and none makes a clinical claim.**

1. `adCopy#5402` (body; also on the Meta path). Matched *fixes … diagnosis*:
   *"Their diagnosis is precise: screeners reject strong candidates… The Skills-to-Title Translation Method fixes this
   directly."* The verb and the "condition" sit in different sentences, and "diagnosis" means a career diagnosis.
2. `landingPages#235.originalAngle`. Matched *Fixed/fixes … diagnosis*: *"Live Copy Diagnosis — Real Attendee Pages
   Diagnosed and Fixed in the Room"*, *"the date is fixed… a live copy diagnosis segment"*, *"Real Pages, Real Fixes"*.
   These are copy diagnoses, and "fixed" and "fixes" are an adjective and a noun, not claims.
3. `landingPages#235.dollarAngle`. The same curriculum titles: *"real pages, real fixes, in the room"*.
4. `emailSequences#419`. Matched *Reverse … health*: the product name *"Client Psychology Reverse-Map"* and a *"health
   and wellness coach"* in another sentence.
5. `heroMechanisms#997`. Matched *reverse … pain*: *"reverse-engineer"*, a hyphenated compound.
6. `heroMechanisms#1176`. Matched *Reverse … pain*: the product name *"Reverse-Map"* and *"your client's pain"* in
   another sentence.
7. `heroMechanisms#1179`. Matched *fix … diagnosis*: *"names the exact problem before offering the fix"* (a noun) and
   *"diagnosis-first"*.

**Same verdict, blocking hits changed: 3 items.** Each lost only a clinical false positive and stays blocked on its
other hits.

- `landingPages#227.originalAngle` lost *fixed … weight*. The two sentences are *"The room has a fixed number of
  seats."* and *"Another Sunday evening with the familiar weight of Monday arriving."* It stays blocked on
  `promised_result`.
- `bonuses#35` lost *Reverse … pain* (the Reverse-Map product name) and `bonuses#43` lost *fix … pain* (the noun). Both
  stay blocked on `second_person_protected_attribute`. Both are sprint 8's own in-repo fixtures.

## Verdict against the pass rule

- **"Every newly blocked item is a real problem"** holds trivially: no real item became blocked.
- **"Every newly allowed item is a false alarm sprint 8 targeted"** holds for all 7. Each is the check-10 defect the
  sprint documented: a verb and a condition in different sentences, a hyphenated compound ("Reverse-Map",
  "reverse-engineer"), or "fix" used as a noun or adjective.

**⇒ PASS. Sprint 8 (`5c2d34e`, `51bda65`) can ship in the first deploy.**

Caveat: sprint 8's other widening, "digital assets" read as a crypto topic, had nothing to act on. No stored item
changed on that path, so it has been proven on the control only, not on production data.
