# ✅ CLOSED — cascade E2E (BEGINNER shape), 2026-07-28 — RUN FINISHED, PROD TORN DOWN

**No live prod data remains from this run.** All 20 tables verified back to the §2 baseline.
**Read §3a for the FINDINGS — the run failed at step 9 and surfaced several real defects.**

⚠️ **ONE RESIDUAL: two bonus PDFs are still hosted on Cloudinary** (DB rows deleted, assets not):
`bonuses_117174_19.pdf.pdf` and `bonuses_117174_20.pdf.pdf` under cloud `dunshei0y`. Harmless
(unreferenced, non-indexed) but not zero. Delete on the next pass that has Cloudinary credentials.

Branch `railway-build`. Verification only; no code changes belong to this run.

**This file was written BEFORE any rows existed and is updated as the run proceeds** — unlike the
previous attempt, which was banked mid-run and was incomplete by construction. The §2 baseline is
complete and authoritative. **Reconcile teardown against §2, never against the id list.**

---

## 0. PREVIOUS ATTEMPT — CLOSED, fully torn down

The 2026-07-27 attempt (service 279 / ICP 256 / kit 194 / offer 207) **died at step 3/9** and was
**torn down cleanly on 2026-07-28**. All 20 tables verified back to baseline with
settle-then-reverify. Nothing from it remains. Do not go looking for those ids.

**Why it died — the ZOMBIE-JOB DEFECT.** The job sat at `status='running'` with zero writes for
~1h55m and never resumed. A generation job whose process dies mid-cascade **stays `running`
forever**: the stuck-job reaper filters on `status='pending'` only — deliberate, documented at
`drizzle/schema.ts:1600-1605`, because Auto-Mode orchestrators legitimately sit in `running`.
Nothing reaps it, marks it failed, or resumes it. **A real coach sees a wizard that never finishes
and never fails.** Banked as CLAUDE.md §1a item (l) + memory `project_zombie_job_defect`.

✅ **PROBABLE CAUSE — A DEPLOY.** Railway deployment `c9b0fdaa` was created **2026-07-27 20:18 UTC**,
~1 min before the job's last write at **20:19:21 UTC**; its container swap would have landed during
the next step (headlines), which wrote nothing.
**→ HARD RULE: never start a long cascade with a deploy in flight, and never push mid-run — a push
IS a deploy IS a container swap IS a dead cascade.** This run waited for `08e9ced1` SUCCESS first.

⚠️ **TIMESTAMP TRAP — cost a wrong "6h45m" figure.** `mysql2` parses MySQL `DATETIME` in the
*connection* timezone (default local), so on an IST machine every stored UTC timestamp renders
**5h30m early**. Comparing that to a local `date -u` inflates every elapsed figure.
**Compare DB timestamps to `SELECT NOW()` on the SAME connection, never the shell clock.**

---

## 1. WHAT THIS RUN IS

Full cascade end-to-end on prod as the E2E smoke coach, **BEGINNER shape** (zero proof: no
testimonials, no press, no client results, no guarantee), to establish whether a coach still
receives a coherent, complete campaign after the compliance layer touched nine generators.

**Actor:** smoke coach `zap-e2e-smoke@mailinator.com`, userId **117174**, openId
`native_ea8a5ee639013dd01bc0b6b585b9dd52`. Creds `~/.zap-e2e-creds.env` (600), keys
`TEST_PROD_EMAIL` / `TEST_PROD_PASSWORD`. `E2E_NOPUBLISH_OPENID` is SET on prod.

**Driver:** `scratchpad/run.mjs` (`login|start|watch|state`), run under
`railway run --environment production --service coachflow node run.mjs <cmd>`.
Artifact dumper: `scratchpad/artifacts.mjs`. Read-only query helper: `scratchpad/dbq.mjs`.
⚠️ Scratchpad is session-scoped — **recreate these if the session is gone**; all three are simple.

---

## 2. PRE-RUN BASELINE — teardown reconciles against THIS

Captured 2026-07-28 after the previous attempt was torn down and verified.

```
services=124        icps=101            adCopy=5405        kits=49
concepts=0          scripts=0           offers=101         mechanisms=1072
hvcoTitles=6577     headlines=2154      landingPages=90    emailSequences=96
whatsappSequences=91 bonuses=0          adCreatives=397    campaigns=2
nodeStatuses=79     capturedLeads=0     complianceRewrites=10   meta_published_ads=2
```

`hvcoTitles`, `nodeStatuses`, `capturedLeads`, `complianceRewrites`, `meta_published_ads` were NOT
captured for the previous run — that gap is closed here.

### 🔴 DO NOT TOUCH — legitimate baseline rows for the SAME coach
From the 23–24 July runs, **included in the counts above**:

```
services 272-277 · ICPs 249-254 · kits 187-192
plus their landingPages (222-227, all unpublished), emailSequences, whatsappSequences,
adCreatives, headlines and adCopy rows
```
Only rows created in the run window belong to this run. (193/278/255 were removed earlier — the id
sequences have exactly that one gap. Expected, not damage.)

---

## 3. 🔴 IDS CREATED BY THIS RUN — **INCOMPLETE BY CONSTRUCTION (run still writing)**

🔑 **RUN WINDOW for scoping every delete: `createdAt >= '2026-07-27 21:40:00'` (UTC wall-clock).**

| Thing | Id | State |
|---|---|---|
| service | **280** "The Retainer Runway" | created |
| ICP | **257** "Freelance UX designer, 6 years in" | created |
| campaignKit | **195** | created |
| offer | **208** | created |
| heroMechanisms | **1103–1117** (15) | created |
| hvcoTitles | — | **in progress at time of writing** |
| headlines / adCopy / landingPages / emailSequences / whatsappSequences / adCreatives / bonuses / concepts / scripts | — | **queued, not yet written** |
| ICP job | `d45e1735-8c8d-44e7-8c23-6ec6f0c55a46` | complete |
| **cascade job** | **`16c6e327-bbe8-4707-9460-d452266a9292`** | **running** |

**campaignType** = `lead_magnet` → pageType `lead_magnet_download` → Burchard template.
Chosen because it is the genuine beginner path and the only template proven to publish without an
operator-supplied price or event date.

### Live status at the moment of banking
- cascade job **`running`**, progress **step 3/9** — "Building your free opt-in title…"
- **last downstream write: 2026-07-27 21:52:27 UTC** (offer + mechanisms). **Status lies; this
  timestamp is the tell.**
- landing page **PUBLISHED: NO** (`publicUrl` null for every LP of this coach) → **no KV entry to clean yet**
- Meta: `meta_published_ads` for user 117174 = **0**; `campaigns` = **0** → **no Meta cleanup yet**

**Re-check all four of the above before tearing down — the run was still writing.**

---

## 4. ✅ TEARDOWN — DONE 2026-07-28 (procedure kept below for the next run)

**Executed and verified.** Dry pre-check first (all 16 clauses matched expected counts exactly,
script set to abort on any mismatch), then FK-safe deletes:
```
campaignConcepts 8 · adCopy 9 · bonuses 3 · landingPages 1 · emailSequences 1
whatsappSequences 1 · headlines 10 · hvcoTitles 60 · heroMechanisms 15 · offers 1
nodeStatuses 1 · campaignKits 1 · idealCustomerProfiles 1 · services 1
(conceptScripts 0, adCreatives 0 — none existed)
```
**All 20 tables re-measured = §2 baseline exactly.** Baseline rows survived (services 272–277,
ICPs 249–254, kits 187–192, LPs 222–227 all at 6/6/6/6). No LP was ever published → **no KV entry
existed**. `meta_published_ads` and `campaigns` for the coach = **0** → **no Meta cleanup needed**.
⚠️ Residual: the two Cloudinary bonus PDFs named at the top of this file.

⚠️ **A late writer was caught in the act:** bonus 20's PDF appeared *between* the artifact dump and
the teardown — the durable bonus-PDF job was still running. This is exactly why settle-then-reverify
is mandatory.

### Procedure (reusable)

Delete everything for **serviceId 280 / icpId 257 / kitId 195 / userId 117174** in the run window,
FK-safe:

```
conceptScripts → campaignConcepts → adCopy → adCreatives → bonuses
→ landingPages → emailSequences → whatsappSequences → headlines → hvcoTitles
→ heroMechanisms → offers → nodeStatuses → campaignKits
→ idealCustomerProfiles → services
```

**Triple-pin every clause** — owner **and** id scope **and** run window — so it cannot reach
baseline rows:
```sql
WHERE userId=117174 AND id BETWEEN <lo> AND <hi> AND createdAt >= '2026-07-27 21:40:00'
-- singletons: WHERE id=<id> AND userId=117174
-- nodeStatuses has NO userId/createdAt: WHERE campaignKitId=195
```
Run a **dry pre-check first** that counts what each clause matches and **aborts on any mismatch**
(the previous teardown did this and it is why nothing was over-deleted).

### If a landing page was PUBLISHED
Delete the Cloudflare KV entry (`ZAP_PAGES[<slug>]`) and confirm the public `/p/{slug}` returns
**404**. A DB delete alone leaves the page live.

### If a Meta campaign was created
Remove it and verify **no live spend**. The push test is PAUSED with no budget by design.

### 🔴 SETTLE, THEN RE-VERIFY — a single post-delete count is NOT proof
Prod once carried 8 orphaned `campaignConcepts` rows that reappeared minutes AFTER a delete
measured 0. **Known late writers:** `ensureConceptsForIcp` (fire-and-forget `setImmediate` at
ad-copy entry) · the durable bonus-PDF job (`bpdf-{setId}`, resumable, self-heals on Kit load) ·
compliance-rewrite precompute (`ENABLE_COMPLIANCE_REWRITES=true` on prod).

**Procedure:** delete → wait for jobs to settle → re-measure **all 20 tables** against §2 → only
then call it clean.

---

## 3a. 🔴 FINDINGS — the run FAILED at step 9/9

**Cascade job `16c6e327` → `status='failed'`** (the failure surfaced correctly; the zombie defect
did NOT bite this time — contrast with §0):

```
Ad headlines LLM did not return Meta-compliant headlines after 5 attempts.
Last failure: subCase=headline_over_length
```

**Steps 1–8 completed; step 9 (ad creatives) failed → `adCreatives = 0`.**

### 🔴 F1 — AD CREATIVE GENERATION IS BROKEN FOR THIS SHAPE (headline_over_length, 5/5 attempts)
This is **exactly the risk flagged before the run** — copy is now shorter and first-person after
the register change, and the creative templates were built for the old shape. The creative headline
generator could not produce a headline that is BOTH Meta-compliant AND within the overlay length
budget, five attempts running, and **took the whole cascade down with it**.
**Not a flaky failure — a deterministic dead end for a beginner.** Highest-priority defect found.
Note it fails the ENTIRE job rather than degrading: a coach loses the creatives *and* the run.

### 🔴 F2 — LANDING PAGE: 11 OF 21 FIELDS EMPTY, and the mechanism did not carry
LP 228 (`lead_magnet_download`, Burchard). Field state on `originalAngle`:
```
filled : mainHeadline(92c) eyebrowHeadline(71c) subheadline(212c) problemAgitation(1437c)
         primaryCta(22c) faq[5] bonuses[3] curriculum[5] systemTiles[8]
         consultationOutline[3] quizSection{}
EMPTY  : asSeenIn[0]  testimonials[0]  shockingStat  ← the 3 EXPECTED beginner suppressions
EMPTY  : uniqueMechanism  whyOldFail  solutionIntro  insiderAdvantages
         timeSavingBenefit  guarantee  scarcityUrgency   ← NOT expected
```
**`uniqueMechanism` empty is a cascade-coherence break, not a suppression:** the mechanism node ran,
produced 15 mechanisms, and the kit selected **1103** — yet the LP's mechanism field is empty. The
same is true of the whole "why old ways fail → solution → advantages" spine. **Eight empty fields
beyond the three intended ones.** Whether each renders as a VISIBLE hole depends on the template's
omit logic — **that is the unfinished half of this read (see §5).**

### 🟡 F3 — WhatsApp = 3 messages, and it is a FALLBACK, not a signal
`campaignKits.campaignFacts` is **NULL** — there is no `eventSchedule.date` at all, so
`deriveLengthFromDate` had nothing to parse and returned its default 3. **Report the 3 as "no date
stored", never as "event imminent".** Email = 3 (fixed by design, not a bug — expected).

### 🟡 F4 — `campaignKits.campaignType` is NULL despite `campaignType:'lead_magnet'` being passed
`autoMode.orchestrate` was called with `campaignType:'lead_magnet'` and the LP correctly came out
`pageType=lead_magnet_download` — but the kit row's own `campaignType` column is NULL. The value
routed correctly yet never persisted to the kit. Likely why `campaignFacts` is empty too (F3).

### 🟡 F5 — DECK SIZES ARE FAR BELOW THE LABELS
| node | produced | note |
|---|---|---|
| offers | 1 | |
| heroMechanisms | 15 | |
| hvcoTitles | 60 (1 with `assetBody`) | only the selected title gets a body — expected |
| headlines | **10** | progress label says *"Writing 100 headlines across 5 formulas"* |
| adCopy | **9** (3 headline / 3 body / 3 link, 1 adSetId) | prior live runs persisted ~34 of 46 |
| landingPages | 1 | |
| emailSequences | 1 (3 emails) | |
| whatsappSequences | 1 (3 msgs) | |
| adCreatives | **0** | F1 |
| bonuses | 3 (2 with PDFs; 3rd never landed before teardown) | |
| campaignConcepts | 8 | lazy `setImmediate` writer fired as expected |
| conceptScripts | **0** | never generated |
**No `violationReasons` were recorded on any headline or adCopy row**, so the small decks are NOT
explained by compliance drops — worth a separate look at whether generation or persistence is
thinning them.

### ✅ F6 — what worked
Steps 1–8 all completed. The failure surfaced as a real `failed` status with a real error string
(no zombie). Bonuses generated with hosted PDFs. Lazy concept generation fired. Cascade context
flowed forward through the text nodes.

---

## 5. ARTIFACTS CAPTURED — and what was NOT done

**Captured as readable text** to `scratchpad/artifacts/` (session-scoped — regenerate with
`artifacts.mjs` on a future run; the DB rows for THIS run are gone):
`00-kit · 01-icp · 02-offer · 03-mechanism · 04-leadmagnet · 05-headlines · 06-adcopy ·
07-landingpage · 08-email · 09-whatsapp · 11-bonuses · 12-concepts` (10-creatives and 13-scripts
are empty — nothing was generated).

### 🔴 NOT DONE — carry to the next run
1. **LP published + screenshotted at its live `/p/{slug}`** — the headline artifact. NOT done.
   F2 makes this MORE important, not less: eight unexpected empty fields need eyes on the rendered
   page to know whether they leave visible holes.
2. **Ad creatives** — blocked by F1; nothing to look at.
3. **Bonus PDFs opened/verified** — 2 URLs existed but were not fetched.
4. **Meta push against the publish gate** — not run.
5. **Cascade coherence read** (offer named in ad vs LP vs email vs WhatsApp) — artifacts captured
   but not cross-read.

**Old §5 note (kept):**

**None yet as readable output** — the cascade had produced only offer + mechanisms when this was
banked, and the artifact dump runs against the finished cascade.

`scratchpad/artifacts.mjs` is written and ready; it dumps to `scratchpad/artifacts/`:
`00-kit · 01-icp · 02-offer · 03-mechanism · 04-leadmagnet · 05-headlines · 06-adcopy ·
07-landingpage · 08-email · 09-whatsapp · 10-creatives · 11-bonuses · 12-concepts · 13-scripts`,
and prints deck sizes, drop counts, creative headline lengths, and the WhatsApp-length-vs-
`campaignFacts` comparison. **No screenshots taken yet.**

**Banked observation from the PREVIOUS run, still relevant:** the offer generator caught itself
fabricating and self-corrected —
`[offersGenerator] Offer fabrication check failed on attempt 1/3 (angle=godfather, 1 hits,
top=[offer_invented_refund_mechanic@cta]). Retrying with fail-context.` A beginner with no supplied
guarantee terms got an invented refund mechanic in the CTA on the first draft; the retry cleared
it. Watch for the same on offer 208.

---

## 6. STANDING CONTEXT a fresh session will NOT infer

- **The goal is the ARTIFACT READ — what the coach RECEIVES, rendered. Structural PASS is the
  floor, not the finding.**
- **Flag any suppressed section that leaves a VISIBLE hole** — a heading with nothing under it,
  awkward spacing, a page ending abruptly, an empty Kit slot. **The beginner landing page is the
  one most expected to break:** As-Seen-In, testimonials and shockingStat are all conditional and
  suppressed at zero proof, and nobody has looked at a page with them off.
- **WhatsApp length must be reported BESIDE `campaignKits.campaignFacts.eventSchedule.date`.**
  A 3-message result is as likely a date-parse fallback as a real signal — `deriveLengthFromDate`
  returns 3 on `Date.parse` NaN, and real prod dates (`28th august 2026`, `27/09/2026`) parse to
  NaN. **Email length is FIXED BY DESIGN, not a bug** (no length parameter exists).
- **TEARDOWN OUTRANKS THE ARTIFACT READ.** The read is valuable but repeatable; orphaned prod rows
  accumulate. If only one can be done, clean up.
- **Dead-job detection: poll the last downstream write, NEVER `jobs.status`.**
- **VETERAN shape is a SEPARATE run — do not start it in the same session.**
- **Publish guard vs the screenshot:** `E2E_NOPUBLISH_OPENID` blocks LP auto-publish but lives ONLY
  in `orchestration.ts`; `landingPages.publishToCloudflare` carries no guard. The guard stays fully
  active and exactly ONE page is published deliberately via the manual path
  (`publishToCloudflare({landingPageId, styleMode})`), then torn down (DB + KV). Arfeen confirmed.
- **API-driven, not Playwright-clicked** — this run proves NOTHING about the wizard's click-through
  UX (node ordering, chip/deck interactions, skip/recovery, operator intake). Separate work.

### Still to do on this run
1. Let the cascade finish; capture every node's output as readable text.
2. Publish the LP deliberately + screenshot the live `/p/{slug}`.
3. Ad creatives — confirm images generate **and text overlays FIT** (copy is now shorter and
   first-person; templates were built for the old shape — unchecked since the register change).
4. Bonus PDFs open.
5. Meta push against the publish gate, guard active, PAUSED, no budget, no spend — confirm the gate
   does not block legitimate copy.
6. Report cascade coherence (does the offer named in the ad match LP/email/WhatsApp; does each
   script match its concept), deck sizes + drop counts per node, and any degraded node.
7. Teardown per §4.

---

## 7. ARFEEN'S OPEN ACTIONS

- 🔴 **ROTATE the smoke password** (`zap-e2e-smoke@mailinator.com`) and update
  `~/.zap-e2e-creds.env`. Deferred until after this run by Arfeen's decision — **now due once the
  run ends**. Creds file mtime is 24 July; the leak was the 27th. Do NOT rotate mid-run.
- **Backlog carried forward:**
  - **zombie-job liveness fix** — the reaper's `pending`-only filter is deliberate; needs a
    heartbeat/last-write liveness signal, not a wider sweep. Own pass.
  - **press/media fixed-format lock** — "As seen in: X" only, never woven into prose.
  - **short-field reader-questions** — per-phrase verdict (detection miss / style / undefined).
  - **eight uncovered claim-triggers** — `treat·heal·reverse·eliminate·erase permanently·proven
    to·clinically proven·big pharma`; predicates, not protected nouns, so they need their own rule
    shape (§1.6 deceptive claims).
  - **email length plumbing** — no length parameter exists; fixed count is by design today.
  - **event-date ISO normalisation** — UK-format dates silently fall back to 3-message WhatsApp
    sequences via `Date.parse` NaN.
  - **30 memory files have no index entry** in `MEMORY.md` (pre-existing; the index was compacted
    67KB → 9.7KB on 2026-07-28 and every previously-indexed entry was preserved).
