# ZAP — STATE

**The single handover a fresh session reads.** Everything dated is archived under
`docs/handovers/archive/` and is history, not current truth. Read this file plus CLAUDE.md §1a and
you are current.

Three sections: **CURRENT STATE** (what is true now) · **THE QUEUE** (what's next, in order, with
enough diagnosis to execute without re-investigating) · **TRAPS** (what will bite).

Last updated: 2026-07-28.

---

## 1. CURRENT STATE

### Ground truth

| | |
|---|---|
| Branch | `railway-build` (never push `main` during sprints) |
| HEAD | `origin/railway-build` — verify, do not recall |
| TS baseline | **35** under pnpm — must not regress; new work adds zero |
| Package manager | **pnpm only.** No `package-lock.json`, no `@playwright/test` in `package.json` |
| Migrations | latest applied = **0096**. `0081` is SUPERSEDED — never apply |
| Prod tables (verified 2026-07-28 post-teardown) | services 124 · ICPs 101 · kits 49 · LPs 90 · emails 96 · WA 91 · offers 101 · **bonuses 0 · concepts 0 · scripts 0** · mechs 1072 · hvco 6577 · headlines 2154 · adCopy 5405 · creatives 397 · jobs 88 (**0 running**) |
| Prod cleanliness | **Clean.** The 2026-07-28 run was fully torn down — every count back to baseline, 0 rows above it, protected smoke rows intact 6/6/6/6, all published pages purged from KV and verified 404. **A fresh session has nothing to clean.** |

Verify, never recall: `git rev-parse HEAD origin/railway-build` · `npx tsc --noEmit 2>&1 | grep -c
"error TS"` · `pnpm install --frozen-lockfile`.

### What is live and working

**The cascade completes.** A beginner Auto Mode run produces a full kit. Verified on prod
(service 281 / ICP 258 / kit 196):

```
{"offers":1,"heroMechanisms":15,"hvcoTitles":60,"headlines":10,"adCopy":9,
 "landingPages":1,"emailSequences":1,"whatsappSequences":1,"adCreatives":0,"bonuses":3}
```

- **Terminal-node degradation (F1(b)) — FIXED and verified live.** Step 9 failing no longer kills
  the run; the job completes with finalize and records `failedSteps`. Only step 9 carries
  `optional: true` (`orchestration.ts:246`); steps 1–8 rethrow by design.
- **Compliance layer** — register standard + compliance axis + anti-fabrication validator, shipped
  as ONE layer, wired and enforcing at HEAD. Tier-1 enforcement only; publish gate at
  `server/routers/meta.ts:262`. Blocking baseline **437**. ⚠️ **See queue item P1 — the fabrication half does not fire on real copy.**
- **ICP grounding** — Class-A invented fields removed at root; opt-in laddered intake sharpens the
  ICP in place after first reveal. `groundingMeta` proven written on prod.
- **Andromeda spine** — concept + per-concept script generators live, DRAFT-only.
- **Bonus arc** — 3 ICP-derived bonuses, hosted PDFs, durable job, coherent across offer/LP/email.
- **All 5 LP templates** built and proven live via the intake.

### The artifact read — DONE (2026-07-28, beginner shape)

All of it, on prod: landing page **published and screenshotted** at its live `/p/{slug}` · **5 ad
creatives generated** (step 9 passed) · bonus PDFs opened and confirmed rendering · Meta push
exercised against the publish gate with zero spend risk · full node-by-node read.

**Report: `docs/handovers/RUN_2026-07-28_beginner-cascade-artifact-read.md`**
Full text of every node: `RUN_2026-07-28_artifacts-full.txt` · screenshot:
`docs/screenshots/LP-230-published-fullpage.png`.

It found the P1 validator gap now sitting at the top of the queue, plus live-page defects: a literal
`yourbrand` placeholder, and five filled stars reading **"Trusted by high achievers"** on a page for
a coach with zero clients.

**Veteran / has-assets shape is still a separate run, never done.**

### Known-failing, input-dependent

**Step 9 (ad creatives) fails on MOST runs but not all.** When it fails,
`generateContextualAdHeadlines` (`orchestration.ts:816`) throws before `runAdCreativesGeneration`
(`:941`) is reached, so no image API is contacted. This is the F1(a) gate, queue item 10; the cascade
degrades correctly around it.

**✅ On 2026-07-28 step 9 PASSED and produced 5 creatives** — so the Replicate → Cloudinary path is
**verified end-to-end** and the old "UNVERIFIED" caveat is retired. **Credits are ruled out**:
Anthropic, Replicate and Cloudinary all probed HTTP 200 healthy (Cloudinary is on the **Free** plan
— watch if creative volume ramps).

---

## 2. THE QUEUE

In order. Each carries its diagnosis — execute without re-investigating.

### P1 🔴🔴 PUBLISH GATE FALSE NEGATIVE — top of the queue

The live `meta.publishToMeta` gate returned **`ok=true`, zero blocking, zero advisories** on a named
testimonial + invented client count + invented statistic + unstated guarantee, **for a zero-client
coach**. Evidence: `RUN_2026-07-28_beginner-cascade-artifact-read.md` §3.

**Two causes, fix both.**

**(a) `heroMechanismsGenerator.ts` has NO fabrication guard at all** — no `compliance`/`fabricat`/
`screen` reference anywhere in the file — and it sits **upstream of everything**, so its invented
claim propagates. `checkOutput` is wired into concept, landing-page, LP-publisher, concept-script,
ad-copy and the Meta gate only. Offer, lead-magnet, email, WhatsApp and bonus generators are also
unguarded.

**(b) The `of my` exemption opened a false negative.** `STAT_SELF_DESCRIPTIVE` was added to kill the
*"80% of my week"* false positive; it also exempts **`94% of my clients`**, which passes while
`87% of consultants` blocks. Same class: `TESTIMONIAL_RE` never matches a bare first name
("Sarah got her baby…"); `GUARANTEE_RE` misses "or your money back"; `AUTHORITY_RE` misses
spelled-out numbers and the noun "families".

**`fabricationValidator.test.ts` is 23/23 green while the gate is blind** — the suite asserts only
the strings the regexes were written against. **Add the real phrasings above as regression tests.**

⚠️ Surface-form matching will keep losing to paraphrase. Tightening regexes is the floor, not the
answer — the durable fix reasons about whether a claim is supported by the coach's own words.
**Do not quote CLAUDE.md's old "Class 1 invented proof BLOCKS" as current fact.**

### P2 🔴 TEMPLATE CHROME ASSERTS SOCIAL PROOF

**"Trusted by high achievers" + five filled stars is hardcoded page furniture, not generated copy —
so no generator guard can ever catch it.** It renders on **every zero-client coach's page**.
`burchardProductivity.ts:114-116`: the guard drops the trust *number* when unsupplied but keeps the
*claim*; the comment reads "Never fabricated". Make it conditional on real proof, exactly as
`asSeenIn` / `testimonials` already are.

### P2b `yourbrand` PLACEHOLDER SHIPS LIVE

`burchardProductivity.ts:123` falls back to the literal string `yourbrand` when `coachName` is unset;
the magnet card renders `YOUR BRAND'S`. **Both were visible on the published page.**

### P3 EMAIL PLUMBING

All three CTAs are `ctaLink: "#"` — **dead links**. All three sign-offs render an unfilled
`[INSERT_HOST_NAME]`.

### P4 WHATSAPP WRONG FUNNEL

Event-framed on a **lead-magnet campaign with no event**: *"At [INSERT_EVENT_NAME] with
[INSERT_HOST_NAME]"*, *"You've already said yes to [INSERT_EVENT_NAME]"*. Structural, not a token gap.

### P5 PROMPT EXAMPLE LEAKED INTO OUTPUT

Email 2's preview promises *"you sit in a car park"* — **the register standard's own worked example**
from `META_AD_COMPLIANCE_REFERENCE.md` §3.1, escaping the prompt as if it were the coach's story
(the body contains no car park). **Audit every generator for other worked examples leaking.**

### P6 CREATIVES — GENDER MISMATCH WITH ICP

All five images depict a **man**; the ICP is unambiguously a **mother** (partner, maternity pay,
mothers' group, antenatal group). **The image prompt is not carrying ICP gender.** Also: v1 shows a
**newborn** when the ICP's baby is 4–12 months, and reads alarming rather than gentle.

### P7 CREATIVES — GARBLED AI TEXT

v4 renders garbled label text — `"Baby time parents"` and `"Parenting books"` observed directly;
`"Whieck to fisrts-ime parents"` also reported. Headlines **overlay subjects' faces** in multiple
creatives. This is the **Flux text-rendering weakness**, and it feeds straight into the parked
image-model evaluation — **now UNBLOCKED**, since creatives generate again and these are real ZAP
prompts rather than generic test ones.

### P8 ALL 5 CREATIVES SHARE ONE IDENTICAL BODY LINE

*"I remember standing at the cot at 11pm…"* on all five. The deck is less varied than the count
implies — **relevant to Entity-ID diversity**.

### P9 LP TEXT OVERFLOW + GRAMMAR

Magnet title **clipped by the FREE badge** (`…SEQUENCE RESET: H`); **`Get Your Free The 3-Night…`**
double article; the 137-char lead-magnet title renders as a four-line run-on ending on a lonely full
stop. **The lead-magnet title length needs a cap.**

---

### 10. F1(a) — the all-or-nothing headline gate

**Symptom:** step 9 yields zero creatives on most runs. **⚠️ It is input-dependent, not
deterministic — the 2026-07-28 run PASSED step 9 and produced 5 ad creatives**, because that run's
headlines happened to fit the bar. **The Replicate → Cloudinary image path is therefore no longer
unverified — it executed end-to-end.** That closes the standing caveat and unblocks the parked
image-model evaluation.

**Mechanism:** the ad-headline check rejects the *whole batch* if any headline exceeds the length
bar (`subCase=headline_over_length`), retries 5×, then throws. The RETRY EXHAUST logs show
Anthropic returning 5 valid headlines each attempt — this is local validation killing a successful
response.

**Settled:** **38 characters stays.** It is ZAP's house standard and Arfeen has decided it. Meta's
published figure is 27 and is a *display recommendation*, not a limit; neither 38 nor 40 appears in
Meta's docs as a cap. **Do not re-litigate the number** — the defect is the all-or-nothing
behaviour, not the threshold.

**Fix shape:** drop over-length headlines and proceed with the survivors (the same disposition the
adCopy generator already uses — drop variants, never the deck), throwing only if none survive.
Code-only, no migration. Unblocks the ad-creative path and the parked image-model evaluation.

### 11. Zombie-job liveness signal 🔴🔴

**Hit twice in two runs.** A job whose process dies stays `status='running'` forever — never
reaped, never marked failed, never resumed, nothing written to `jobs.error`.

**Impact both directions:** a coach sees a wizard that never finishes *and never fails*. It fools us
just as reliably — a handover once recorded a dead run as "IN FLIGHT".

**The reaper's `status='pending'`-only filter is DELIBERATE** and documented at
`drizzle/schema.ts:1600-1605`: Auto-Mode orchestrators legitimately sit in `running`, so **widening
the sweep is NOT the fix and would kill live jobs.**

**Fix shape:** a liveness signal — a heartbeat column touched by the running job, or reap `running`
jobs whose heartbeat/last-write exceeds a generous threshold, transitioning to `failed` with an
error the UI can surface. **Never infer liveness from `jobs.status`; the tell is the last downstream
write timestamp.** Own pass.

### 12. F2 — `campaignKits.campaignType` is NULL

**Still NULL after the attempted fix. The change is inert, not harmful.**

**Why it failed:** `campaignType` was threaded into `autoSelectBest` and passed from
`orchestration.ts:859` — but the generators call `autoSelectBest` first.
`offersGenerator.ts:535` calls it with four arguments during step 1, creating the kit with
`campaignType` undefined. By line 859 the kit already exists, so the value is correctly ignored —
the parameter only applies on insert.

**Fix:** ensure the kit exists **with `campaignType`** at the **top of `runOrchestration`**, before
any generator runs. **Do NOT thread it through the generator call sites** — there are seven and it
is fragile. Code-only, no migration.

### 13. F3 — event-date capture (the unbuilt half)

**Shipped half:** `normalizeEventDateToISO` + `resolveSequenceLength`. UK day-first slash dates
(`27/09/2026`) and ordinal words (`28th august 2026`) parse instead of silently falling back to 3;
overflow like `31/02` is rejected. **No date supplied is a legitimate 3; a date supplied that cannot
be read is a defect and now logs an explicit error.** `deriveLengthFromDate` keeps its signature.

**Slash-date policy (deliberate, do not silently flip):** `d/m/y` reads **day-first** — UK-centric
coach base, matches observed prod values.

**Remaining, mechanism settled:**
1. optional `eventDate` on the `autoMode.orchestrate` input, alongside `campaignType`
2. write it to `campaignFacts` at the **same kit-creation point** that item 12 fixes
3. one conditional question in the Auto Mode entry UI

**Asked ONLY for date-based types** (webinar, in_person_event, challenge) — **never** for
lead_magnet or discovery, which legitimately have no date. **Not the ladder** — it runs before the
kit exists while `campaignFacts` lives on the kit. No migration (`campaignFacts` exists from 0090).

### Then, roughly in order

- **A8 — ad-copy 0-card deck.** Real body rows exist in DB but the deck fetch returns 0 → the coach
  sees "your ad copy options didn't come through". `b0a15ca` did NOT close the ad-copy case.
  A real coach hits this.
- **Copy readability / register pass.** Generated copy is jargon-heavy across headlines/LP/offer/
  method names. A13 measures Flesch-Kincaid (9.4–9.6) but **no bar was ever agreed**. Needs a
  *register standard*, not just a number — jargon scores fine. Proven template = the bonus-title
  fix (positive-framing prompt guidance, no negative examples). Needs Arfeen's call on the bar.
- **A11 — unresolved `[INSERT_*]` tokens** (EVENT_TIME, PARKING_INFO, BONUS_1–5, GUARANTEE_TERMS,
  BOOKING_URL…). The known facts-schema gap → the "Way 2" per-node scan-ask. Not a regression.
- **Bonus deliverable FORMAT decision — interactive-first.** A bonus is a tool you operate, not a
  reading task; PDF was never chosen, it came bundled with the lead-magnet pipeline. Likely both
  HTML (primary) + PDF. **State persistence is make-or-break.**
- **Problem B** — per-node review surface + existing-assets import (forward-only wizard).
- **Andromeda backbone** — real Meta fatigue signals (`frequency`,
  `first_time_impression_ratio`; the "score" fields do NOT exist) + P.D.A. concept axis.
  Touches `adCopyGenerator.ts`.
- **Image-model evaluation — FLUX vs OpenAI. UNBLOCKED (see P7)** — creatives generate again. Scope is the
  **generation call, not the image infrastructure** — Cloudinary is hosting/transformation and stays
  either way. Evaluate on **text-heavy ad creatives first** (where Flux is weakest), on **real ZAP
  prompts, never generic test prompts**. Three axes: quality on text-heavy creatives · cost per
  image at expected volume · reliability + latency.
- **Andromeda closed write-back loop** — gated, last, own scope call (autonomy + coach spend).
- **`.pdf.pdf`** bonus-PDF storage-key double-suffix — cosmetic, resolves 200, tidy later.
- **Off-ICP testimonial filtering** — deferred product call, leave as-is.

### Arfeen's open actions

- 🔴 **Rotate the smoke password** (`zap-e2e-smoke@mailinator.com`) + update `~/.zap-e2e-creds.env`.
  Deferred through three runs.
- **Cloudinary cleanup:** two orphaned bonus PDFs, public_ids `bonuses_117174_19.pdf` and
  `bonuses_117174_20.pdf`, resource_type **`image`** (not `raw` — that's why a delete silently
  no-ops), cloud `dunshei0y`. Media Library → search `bonuses_117174_` → delete.

---

## 3. TRAPS

Each of these has already cost real time. They are cheap to store and expensive to rediscover.

### Prod safety

- **PROTECTED ROWS — do not touch:** services **272–277**, ICPs **249–254**, kits **187–192**,
  LPs **222–227** and all their sequences/creatives/headlines/adCopy. Legitimate smoke rows from
  the 23–24 July runs.
- **Every prod write needs Arfeen's explicit "execute" in the immediately preceding message.** No
  exceptions for small, safe, schema-only, test-account, or "done it before". If approval is
  ambiguous, do not write.
- **Never push mid-cascade.** A push is a deploy is a container swap is a dead cascade — that is
  exactly what killed the first run (Railway `c9b0fdaa`, created ~1 min before the job's last
  write). Wait for deploy SUCCESS and a settled container before starting a run.

### Teardown

- **Teardown outranks the artifact read.** Take a **fresh pre-run baseline**; reconcile counts
  against it, never trust an id list.
- **Settle, then re-verify. A single post-delete count is not proof.** Late writers are real:
  lazy concept generation, the durable bonus-PDF job, compliance-rewrite precompute.
- Clean Cloudflare KV if a page was published.

### Measurement

- **`mysql2` timezone trap:** it parses MySQL `DATETIME` in the *connection* timezone (default
  local), so on an IST machine every stored UTC timestamp renders **5h30m early**. Compare DB
  timestamps to `SELECT NOW()` on the **same connection**, never the shell clock. This produced a
  wrong "6h45m" elapsed figure once already.
- **A malformed probe looks exactly like a broken service.** Two API probes returned HTTP 400
  `invalid_request_error` — that was shell quoting mangling JSON inside `railway run bash -c`, not
  the API. Probe from a node script with `JSON.stringify`, never a heredoc through nested quotes.
- **`RAILWAY_GIT_COMMIT_SHA` is empty under `railway run`** — deployed-SHA read-back is INDIRECT.
  For server-only commits there is no client bundle to fingerprint either. **The direct proof is
  functional:** find a string that exists only in the pushed commit and observe it live.

### Not defects — do not re-investigate

- **Deck sizes are liteMode.** 9 adCopy rows and ~10 headlines is the constant Auto Mode output —
  `liteMode: true` is hardcoded at `orchestration.ts:334, 401, 428`. Verified identical across six
  prior runs predating the compliance layer. **Normal, not a regression.**
- **The LP's empty fields are BY DESIGN.** The `lead_magnet_download` prompt explicitly instructs
  `uniqueMechanism: ""`, `whyOldFail: ""`, `insiderAdvantages: ""`
  (`landingPageGenerator.ts:262-294`). Only asSeenIn / testimonials / shockingStat are beginner
  suppressions. **Not a coherence break.**
- **Meta's headline figure is 27 and is a DISPLAY RECOMMENDATION, not a limit.** ZAP's **38 is a
  settled house standard — Arfeen has decided this. Do not re-litigate.**
- **The reaper's pending-only filter is DELIBERATE** (see queue item 2). Widening the sweep is not
  the fix.

### Process

- **The frozen PNG is the sole source of truth for any reference** (CLAUDE.md §15a). Three
  replication specs once carried prose contradicting their own PNGs, and every gate passed against
  the lie.
- **Never add a dep with npm** — it regenerates `package-lock.json` and re-opens the pnpm lockfile
  drift that broke deploys for a day.
- **A commit is not "held" once anything sits on top of it and is pushed** — push moves the whole
  ancestry.
- **Negative examples in prompts prime the failure** (CLAUDE.md §14). Positive-only framing.
- **Before any prod smoke run:** verify `E2E_NOPUBLISH_OPENID` is active on the **running** server,
  not merely saved.

---

## 4. WHERE THINGS LIVE

| | |
|---|---|
| Meta compliance (authoritative) | `docs/compliance/META_AD_COMPLIANCE_REFERENCE.md` — read before any compliance/copy-register work; carries a **DO-NOT-BUILD list** of plausible-sounding material absent from Meta's docs |
| Andromeda brief | `docs/andromeda/EXECUTION_BRIEF.md` |
| ICP research | `docs/icp-research/` |
| Bonus research | `docs/bonus-research/` |
| Visual quality bars | `docs/AD_IMAGE_VISUAL_QUALITY_STANDARD.md` · `LANDING_PAGE_VISUAL_QUALITY_STANDARD.md` |
| Dated handovers (history) | `docs/handovers/archive/` |
