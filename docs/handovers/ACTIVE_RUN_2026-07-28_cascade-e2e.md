# ✅ CLOSED — cascade E2E + fix verification, 2026-07-28 — PROD CLEAN, NOTHING TO TEAR DOWN

**No live prod data remains.** Two full beginner cascades were run and both fully torn down; all
tables verified back to baseline with settle-then-reverify. **A fresh session has nothing to clean.**

**`HEAD = origin/railway-build = c34f2ae`.** Branch `railway-build`; `main` untouched.

⚠️ **ONE RESIDUAL, needs Arfeen's credentials:** two orphaned bonus PDFs on Cloudinary,
public_ids `bonuses_117174_19.pdf` and `bonuses_117174_20.pdf`, resource_type `image`, cloud
`dunshei0y` (the `.pdf.pdf` in the URL is the known double-suffix bug, so the id really does end
`.pdf`; using `raw` is why a delete silently no-ops). Dashboard → Media Library → search
`bonuses_117174_` → delete, or
`cloudinary.api.delete_resources([...], {resource_type:'image'})`.

---

## 1. WHAT SHIPPED AND IS LIVE

| Commit | What |
|---|---|
| `30f3a62` | terminal-node degradation + campaignType threading (partial — see F2) |
| `7d2f3f4` | event-date ISO normalisation; unparseable dates surface |
| `c34f2ae` | compliance reference: Meta's real headline figure; wording fixes |

Railway **`c8409c15` SUCCESS**, prod 200, clean boot.
⚠️ **SHA read-back is INDIRECT** (`RAILWAY_GIT_COMMIT_SHA` is empty under `railway run`, and these
are server-only commits so there is no client bundle to fingerprint). **The direct proof is
functional:** the live cascade's progress label read *"Writing your headline options across 5
formulas…"*, a string that exists only in the pushed commit.

---

## 2. ✅ F1(b) — VERIFIED ON PROD. The defect that killed whole runs is FIXED.

A cascade node failing no longer destroys the run. Verified live (service 281 / ICP 258 / kit 196 /
job `b133d921`):

```
✅ CASCADE COMPLETE
{"offers":1,"heroMechanisms":15,"hvcoTitles":60,"headlines":10,"adCopy":9,
 "landingPages":1,"emailSequences":1,"whatsappSequences":1,"adCreatives":0,"bonuses":3}

job.result = {"kitId":196,"failedSteps":[{"step":"adCreatives",
  "error":"Ad headlines LLM did not return Meta-compliant headlines after 5 attempts.
           Last failure: subCase=headline_over_length"}]}
```

Step 9 failed on the identical error that previously killed the cascade, and **the job still
completed with finalize run**. Kit 196 carried all eight selections (offer 209, mechanism 1118,
hvco 6706, headline 2167, adCopy 5540, LP 229, email 415, WhatsApp 284); only
`selectedAdCreativeBatchId` was null.

**Steps 1–8 still rethrow** — confirmed from source, no forced prod failure: `optional: true`
appears on exactly one line (`orchestration.ts:246`, step 9); steps 1–8 (lines 233–240) carry no
flag; the guard is `if (!step.optional) throw err`.

**F1(a) — the 38-char gate — deliberately NOT changed.** Meta's published figure is **27
characters**, a *display recommendation* (verified on two Ads Guide pages), so aligning to the
instructed 40 would have encoded a different invented number. Neither 38 nor 40 appears in Meta's
docs. Full reasoning now in `docs/compliance/META_AD_COMPLIANCE_REFERENCE.md` §1.4a. **Open product
decision:** keep 38 as craft, move toward 27, or stop treating length as a hard blocker.

---

## 3. 🔴 F2 — NOT FIXED. Diagnosis recorded so it is not repeated.

`campaignKits.campaignType` is **still NULL** after the fix. The change is **inert, not harmful**.

**Why it failed.** `campaignType` was threaded into `autoSelectBest` and passed from
`orchestration.ts:859` — but **the generators call `autoSelectBest` FIRST**.
`offersGenerator.ts:535` calls it with **four arguments** during step 1, creating the kit with
`campaignType` undefined. By the time line 859 runs the kit already exists, so the value is
correctly ignored — the parameter only applies on insert.

**THE FIX:** ensure the kit exists **with `campaignType`** at the **TOP of `runOrchestration`**,
before any generator runs. **Do NOT thread it through the generator call sites** — there are seven
of them and it is fragile. Code-only, **no migration**.

---

## 4. 🔴 F3 — capture half NOT built. Mechanism already decided.

**Shipped half (`7d2f3f4`):** `normalizeEventDateToISO` + `resolveSequenceLength`. UK day-first
slash dates (`27/09/2026`) and ordinal words (`28th august 2026`) now parse instead of silently
falling back to 3; overflow like `31/02` is rejected rather than rolled into March. **No date
supplied is a legitimate 3; a date supplied that cannot be read is a defect and now logs an explicit
error.** `deriveLengthFromDate` keeps its signature and delegates, so all existing callers are
unaffected.

**Slash-date policy (deliberate, do not silently flip):** `d/m/y` reads **day-first** — UK-centric
coach base, matches observed prod values.

**Remaining work — mechanism is settled, just execute it:**
1. optional `eventDate` on the `autoMode.orchestrate` input, alongside `campaignType`
2. write it to `campaignFacts` at the **same kit-creation point** that F2 fixes
3. one conditional question in the Auto Mode entry UI

**Asked ONLY for date-based types** (webinar, in_person_event, challenge). **Never** for
lead_magnet or discovery — those legitimately have no date and 3 messages may be correct.
**Not the ladder:** it runs before the kit exists while `campaignFacts` lives on the kit, so hosting
it there means staging state for no benefit. **No migration** — `campaignFacts` exists from 0090.

---

## 5. 🔴🔴 ZOMBIE-JOB DEFECT — SECOND OCCURRENCE IN TWO RUNS. ESCALATE.

**No longer "logged" — this is a real priority.**

- **Occurrence 1:** the cascade job died mid-run (container swap from a deploy) and sat `running`
  with zero writes, never resuming, never failing.
- **Occurrence 2 (this run):** the durable bonus-PDF job `bpdf-3XIA5eJbQ3RwSSRIP3i9g` was left
  `running` after teardown deleted its bonus rows underneath it. Found only because teardown
  reconciliation counted `running` jobs.

**Mechanism:** the stuck-job reaper filters `status='pending'` **only**. That filter is *deliberate*
and documented at `drizzle/schema.ts:1600-1605` — Auto-Mode orchestrators legitimately sit in
`running`, so **widening the sweep is NOT the fix and would kill live jobs**. Any job whose process
dies is never reaped, never marked failed, never resumed; nothing is written to `jobs.error`.

**Impact, both directions:** a coach sees a wizard that never finishes and never fails. **And it
fools us exactly as reliably** — a handover recorded a dead run as "IN FLIGHT" and a fresh session
would have kept believing it.

**FIX SHAPE:** a **liveness signal** — a heartbeat column touched by the running job, or reap
`running` jobs whose heartbeat/last-write exceeds a generous threshold, transitioning to `failed`
with an error the UI can surface. **Never infer liveness from `jobs.status`; the tell is the last
downstream write timestamp.** Own pass. Tracked as CLAUDE.md §1a item (l) + memory
`project_zombie_job_defect`.

---

## 6. STANDING CONTEXT for a fresh session

- **Never push mid-cascade.** A push is a deploy is a container swap is a dead cascade — that is
  what killed the first run (Railway `c9b0fdaa`, created ~1 min before the job's last write).
  Wait for deploy SUCCESS *before* starting a run.
- **`mysql2` timezone trap:** it parses `DATETIME` in the *connection* timezone (default local), so
  on an IST machine every stored UTC timestamp renders **5h30m early**. Compare DB timestamps to
  `SELECT NOW()` on the **same connection**, never the shell clock. This produced a wrong "6h45m"
  figure once already.
- **Teardown outranks the artifact read.** Reconcile counts against a pre-run baseline; never trust
  an id list. **Settle, then re-verify** — late writers are real (lazy concept generation, the
  durable bonus-PDF job, compliance-rewrite precompute).
- **DO NOT TOUCH the baseline smoke rows:** services 272–277, ICPs 249–254, kits 187–192, LPs
  222–227 and their sequences/creatives/headlines/adCopy. From the 23–24 July runs, legitimate.
- **Deck sizes are liteMode, not defects** — `liteMode: true` hardcoded at `orchestration.ts:334,
  401, 428`. 9 adCopy rows is the constant Auto Mode output; verified identical across six prior
  runs predating the compliance layer.
- **The LP's "missing" fields are by design** — `lead_magnet_download` prompt explicitly instructs
  `uniqueMechanism: ""`, `whyOldFail: ""`, `insiderAdvantages: ""`
  (`landingPageGenerator.ts:262-294`). Only asSeenIn/testimonials/shockingStat are beginner
  suppressions.

### Still never done on any run
Landing page published + screenshotted at its live `/p/{slug}` · ad creatives seen (blocked by
F1(a)) · bonus PDFs opened · Meta push against the publish gate · cascade coherence cross-read.
**Veteran shape is a separate run.**

### Arfeen's open actions
- 🔴 **Rotate the smoke password** (`zap-e2e-smoke@mailinator.com`) + update `~/.zap-e2e-creds.env`.
  Deferred through two runs; now due.
- Cloudinary cleanup (top of this file).
- Product call on the 38-char gate (§2).
