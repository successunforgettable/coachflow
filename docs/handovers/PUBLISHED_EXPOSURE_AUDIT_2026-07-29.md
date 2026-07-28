# Published fabrication exposure — what a real audience could actually have seen

**READ-ONLY. Nothing was modified, deleted or remediated.** Follows the fleet audit of
2026-07-28, which counted GENERATED content (~1,825 fabrication hits across 78 of 124 services).
This measures the subset that was actually published or pushed.

## The answer

**No real coach is exposed. Not one.**

Every published asset in production belongs to **two accounts**, both ours:

| Owner | Published landing pages |
|---|---|
| `arfeen@arfeenkhan.com` (user 1, admin) | **32** |
| `zapreviewer@mailinator.com` (user 1613) | **3** |
| **Any real coach** | **0** |

`SELECT COUNT(DISTINCT userId) FROM landingPages WHERE publicUrl IS NOT NULL` → **2**.

Of the ~1,825 generated fabrication hits, **57 sit on the published surface, and all 57 are on those
two accounts.** Zero on a paying coach's content.

⚠️ **Correcting my own framing before it misleads:** calling user 1 a "test account" is a judgement,
not a fact. Those 32 pages are **genuinely, publicly live on zapcampaigns.com right now** — anyone
with the URL can read them. The honest statement is **"no CUSTOMER is exposed"**, not "nothing is
exposed". What is live is ZAP's own demo and proof content.

## Currently live vs historically published

**All 35 pages with a publish record are serving HTTP 200 today** (curl-verified, one request per
slug). Nothing was published-then-removed — so the distinction the task asked for turns out to be
empty: the published set and the currently-live set are the same 35 pages.

## Meta — effectively nothing was ever pushed

`meta_published_ads` holds **2 rows, total, ever**:

| userId | adSetId | status | publishedAt |
|---|---|---|---|
| 1 (Arfeen) | `temp` | PAUSED | 2026-05-12 14:45 UTC |
| 1 (Arfeen) | `temp` | PAUSED | 2026-05-12 15:32 UTC |

`adSetId` is the literal string **`temp`** — a placeholder, not a real ad set — both rows are
**PAUSED**, both are Arfeen's, and both are ten weeks old. **No ad copy has ever reached Meta for
any coach, real or test.** Ad-copy fabrication (the largest generated bucket at 2,243 hits) has
**zero** published exposure.

## The two named items — both confined, neither published

**`"According to Dr. Sarah Chen"`** — the fabricated named expert with a title, the most serious
item in the fleet audit.
- **24 rows**, every one in `adCopy`, every one on **service 1 / user 1** (Arfeen's own "incredible
  you2").
- **0 rows in adSet `temp`** — the only ad set ever pushed. So it never reached Meta.
- Not on any published landing page.
- **Verdict: generated, stored, never published anywhere.**

**`"hundreds of successful clients"`** — reported as 76 hits across 5 services; the precise figure is
**75 rows**.
- Every one in `heroMechanisms`, every one on **service 2 / user 1254**
  (`test-fitness@zapcampaigns.com`, a seeded test account).
- Hero mechanisms are never published directly — they feed downstream generators.
- **Verdict: confined to one test account's mechanism deck, never published.**
- This is the literal output of the `offersGenerator` instruction *"or 'hundreds of clients' minimum
  if none available"*, removed 2026-07-28. Its historical output is still stored.

## Hosted deliverables

1 lead magnet with a hosted URL; **0 bonuses** (the `bonuses` table is empty on prod after teardown).
Negligible surface.

## Spot-check of live pages

Three live pages (`the-calm-authority-57`, `deal-edge-176`, `visible-authority-190`) were fetched and
scanned for the high-severity patterns — `hundreds of … clients`, `N% of my/our …`, `Dr. Firstname
Lastname`, `NNN+ clients/students/families`. **No matches on any of the three.** Consistent with the
worst classes being absent from published pages; the 57 published-surface hits are lower-severity
forms (statistics and possessive-population phrasing).

## Measured vs estimated — stated plainly

**MEASURED (direct queries / HTTP):** the 35-page published set and its 2 owners · all 35 serving 200
· the 2 `meta_published_ads` rows and their `temp` adSetId · 24 `Sarah Chen` rows and their absence
from the pushed ad set · 75 `hundreds of successful clients` rows and their single-account
confinement · 57 published-surface fabrication hits, 0 on non-test accounts · the three-page spot
check.

**NOT MEASURED — and I will not guess:**
- **GHL deployment is not measurable from this database.** The push writes Custom Values into the
  customer's own GHL location, and the schema keeps only `ghl_access_tokens` — there is no per-asset
  push record. Email and WhatsApp reach **cannot be established either way**. This is a genuine blind
  spot, not a zero.
- **Traffic.** Whether any live page was ever visited, linked or indexed was not queried.
- **The class-by-class split of the 57.** The per-page screen timed out on `railway run` startup
  overhead twice; I stopped rather than burn context on the least decision-relevant number in the
  report. The totals and ownership above are unaffected.

## What this means

The fleet audit's ~1,825 figure is a **latent quality debt in stored decks**, not a live exposure
incident. The gap between generated and published is the whole story: **97% of the fabrication sits
in content no one outside ZAP has ever been able to see**, and the remainder is on ZAP's own pages.

This also explains itself — it matches the standing finding that the landing-page product had barely
published at all. Real coaches have not been reached because real coaches have not published.

**The exposure risk is forward-looking, not historical.** The prompt fixes and the persistence gate
shipped 2026-07-28 govern new generations; the stored backlog only becomes exposure if an old deck is
selected and published. Whether to leave it, regenerate it, or suppress it on next edit is Arfeen's
call — nothing here forces a cleanup.
