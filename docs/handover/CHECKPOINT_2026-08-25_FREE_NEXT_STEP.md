# CHECKPOINT — the free next step is DECIDED and the content proof STOPPED it one step short

**Written for a cold session with no memory of the one that produced it.** Everything below was
verified in-session, not recalled. For the committed Node 5 work — the mechanism cascade, the size
bounds, the statistic-rule import, the honest bridge — read
`docs/handover/CHECKPOINT_2026-08-24_NODE5_STEP4_PAUSED.md` and then `CHECKPOINT.md`. This file does
not repeat them.

**Do not start work from this file without being asked.** The next action in §7 is scoped and
approved in principle; it is not running.

---

## 1. Git state — verified, not recalled

| | |
|---|---|
| HEAD | **`85bcc8b`** (`85bcc8ba66a2493765f8f872e670d4d71521d41d`) on `railway-build` |
| `origin/railway-build` | **`f5be0b0`** |
| position | **7 ahead, 0 behind — local and unpushed** |
| deployed? | **Nothing has deployed.** Railway deploys on push; there has been no push |
| uncommitted tracked | **exactly one file** — `docs/handover/NODE5_REBUILD_PROPOSAL_2026-08-24.md` |

### 🔑 THE STALENESS FIX IS COMMITTED. That ambiguity is closed.

`markDownstreamStale` and its **seven tests** are inside **`85bcc8b`**, verified by reading the
committed tree rather than the working tree:

- `git show 85bcc8b:server/routers/campaignKits.ts` contains `export async function markDownstreamStale` — 1 match
- `git show 85bcc8b:server/pipeline-fixes.test.ts` contains 7 `it(` blocks under the stale-propagation describe

**It is not sitting in the working tree.** The only uncommitted tracked file is the handover
document above, which carries the page-type decision, the three-question cost, the price
normalisation gap, the `markTweakStale` bank and the content-proof result. **That file is
deliberately uncommitted and its commit is a separate authorisation.**

Commits ahead of origin, oldest first:

| SHA | what |
|---|---|
| `0ef00bb` | pre-existing docs checkpoint — not from this work |
| `8b9b408` | Node 5 step 2 — mechanism cascade wiring |
| `2e5d94f` | Node 5 step 3 — size bounds |
| `ed3ea41` | the statistic-rule import |
| `c8a0bf5` | Node 5 step 4 tier 3 — the honest bridge |
| `1b591a4` | checklist word target + caps |
| `85bcc8b` | **the `markDownstreamStale` extraction + 7 tests** |

`server/scripts/ab-icp-phaseA.ts` is untracked and **is not ours** — never stage it.

---

## 2. The decision this phase rests on

**The cascade GENERATES the free next step. It is not captured from the coach.**

Asking a coach to supply a destination URL asks for something they do not have: **1 of 23 coaches has
even a `bookingUrl`; `videoUrl` and `checkoutUrl` are zero** (re-measured 2026-08-27, unchanged from
the prior trace). Capture returns an honest dead end with extra steps.

**Target design.** A lead-magnet campaign also produces a **free-event landing page on the same
service**, using the existing landing-page machinery, and the magnet's `nextStepUrl` resolves to that
page's `publicUrl`. **Tier 1 becomes native.** Tier 2 — a coach's own existing destination — survives
as an escape hatch and is **not part of this build**. Tier 3, the honest text card with no button, is
already shipped (`c8a0bf5`) and remains the floor.

### The argument that settled it: generation does not escape operator capture, it CHANGES THE QUESTION

A generated webinar page cannot publish without operator input — `runLandingPagePublish` throws on any
surviving `[INSERT_*]` token. So Tier 1 is generation **plus** a capture moment. That is the case for
it, not against it:

- **Capture asks:** *"Paste the URL of your free next step."* The coach cannot answer — the URL does
  not exist because the thing does not exist.
- **Generation asks:** *"What is your free event, and when is it?"* **Answerable before they have
  built anything.** ZAP then builds the thing the answer describes.

The answer already has a home: `campaignKits.campaignFacts`, JSON typed `{ eventSchedule?, price? }`,
applied deterministically to a fresh LP via `factsToTokenAnswers`. **Nothing new is needed to hold
it.** And the path is proven, not theoretical: **15 webinar/event pages are published on production**
(11 webinar, 4 event, across 12 services).

---

## 3. Settled since — the page type, its cost, and one banked gap

**`webinar_registration` is the default.** The reason is structural, from
`PAGETYPE_REQUIRED_TOKENS` (`server/lib/templates/operatorFields.ts:455-460`):

| page type | hard-hold tokens |
|---|---|
| **`webinar_registration`** | date · time · timezone — **no price token at all** |
| `event_registration` | date · **venue** · **price** |

**A page type that structurally cannot display a price beats one that can and must be told not to.**

### The three-question cost is REAL and is the price

Verbatim from the token registry: *"When's your event — what date?"* · *"What time does it start?"* ·
*"Which timezone is that in?"* Three new questions in the intake for campaigns that today ask none.
They are answerable before the coach has built anything — the same argument that chose generation
over capture — **but they are three, not zero.** Do not present this build as free of coach effort.

### 📌 BANKED — the FREE price normalisation is anchored and misses a natural answer

`operatorFields.ts:300` matches `^(free|no charge|no cost|complimentary|£0|$0|0)$`. So `free`,
`no charge`, `£0`, `0`, `complimentary` all reach `NA_SENTINEL.FREE` — **`it's free` does not.** The
question is worded *"a set amount, free, or by application?"*, to which *"it's free"* is natural.

**Publish still succeeds** (the token is substituted either way), but `price.amount` becomes the
literal string, `classifyPrice` never sees FREE, **the free template variant is silently not
selected**, and prose renders *"price it's free"*. A one-line anchor change, its own small question.
Only bites `event_registration`, which is no longer the default.

---

## 4. The content proof — and it is why this phase paused

**Two arms × 5 rows, service 233, `pageType: "webinar_registration"` throughout, differing in exactly
one string: the campaign framing spliced into `enrichedAvatarDescription`.**

- **Arm A** — `lpFramingForCampaign("lead_magnet")`, what the code does today
- **Arm B** — `lpFramingForCampaign("webinar")`, what the build was assumed to need

**ZERO WRITES, and it needed no authorisation.** Landing-page generation separates cleanly from
persistence: `generateLandingPageAngle` and `generateAllAngles` are exported and contain **no database
access at all** — verified by scanning `landingPageGenerator.ts:396-806` for `getDb`/`db.`/`insert`/
`update(`/`delete(`: zero hits. Persistence lives entirely in the `runLandingPageGeneration` wrapper,
after the generation call. This is the Node 5 shape, not the Node 4 shape.

### ❌ The prediction was wrong, and the way it was wrong matters

Predicted: the `lead_magnet` framing — *"Urgency mechanism: None… no deadline, no countdown"*, *"CTA
language: Get the free guide / Download free"* — would override the page-type block, and **arm A would
read like a second lead magnet.**

**It did not.** Arm A produced a genuine webinar page in **5 of 5 rows**: *"Join me live on
[INSERT_EVENT_DATE]"*, CTA **"Save Your Seat"**, urgency built entirely on the live session. **Page
type won the slot over campaign framing.**

### 🔴 But BOTH arms assume a COLD reader, decisively — and that is the finding

Measured across all ten rows:

| | arm A | arm B |
|---|---|---|
| phrases restating what the magnet already delivered | **7-15 per row, every row** | **7-13 per row, every row** |
| phrases carrying the magnet's unresolved gap forward | **0 in 4 of 5 rows** | **0 in 3 of 5 rows** |

Combined: **zero gap-carrying phrases in 7 of 10 rows.**

**Arm A's agenda is the magnet's table of contents:**

> 1. *Why capable Directors get auto-rejected cross-sector*
> 2. *The three linguistic signals that mark you as an outsider*
> 3. *The Sector Translation Audit — line-by-line repositioning live*
> 4. *The callback-generating repositioning sequence*

The magnet is titled *"The 3 Reasons Senior Directors Get Auto-Rejected… and the Exact CV
Repositioning Fix That Gets Callbacks Within 2 Weeks"*, and its first item is the *'Insider Language'
Scan*. Arm A's subheadline offers back *"the exact **three reasons** Directors … get auto-rejected
before a human being ever reads their name — and the CV repositioning method that starts getting
callbacks **within two weeks**"* — the magnet's own promise, returned to a reader who has just
finished working through it.

Arm B is the same shape: *"the method that deconstructs why your CV is being read as a
sector-membership document rather than a leadership evidence file"*, against the magnet's promise
*"reads as transferable leadership evidence — not as a sector-membership badge"*.

**Neither arm picks up the gap the magnet's OWN bridge names:**

> *"Repositioning your CV for a new sector only works when you're **aiming at the right sector**."*

**The reader finishes the magnet with the language fixed and no destination, and nothing in either
page starts there.** Arm B gets closest — one agenda item reads *"The Three-Conversation Entry Plan
for Directors Without Sector Contacts"* — but items 1-3 are still the magnet restated.

### The conclusion

**Neither existing frame fits. Every entry in `LP_CAMPAIGN_FRAMING` addresses a stranger arriving from
an ad**, and `webinar` says *"Copy must give a compelling reason to attend live"* while saying nothing
about what the reader already knows. **No frame has a concept of a reader who is one step in**, so the
generator does the only sensible thing with a cold frame: it introduces the problem.

**The fix is a NEW framing, not a reuse.** This is a finding about the design, not a failure of the
run, and it landed before any plumbing was built on the wrong assumption — which is the whole reason
the content proof came first.

---

## 5. 🔴 THE EIGHTH INSTANCE — the generator supplying a fact nobody gave it

Arm B invented a seat cap:

> *"I am keeping attendance deliberately limited so that I can take real questions from the room —
> this is not a pre-recorded broadcast with a fake chat sidebar, it is a working session with a
> **capped number of seats**. When those seats are gone, registration closes."*

**No coach set a limit.** The `webinar` framing's *"Limited seats available"* licensed an operational
claim about a real person's real event — a claim their attendees would hold them to.

**File it with its siblings. This sprint has now met the same defect eight times:** the invented
research statistics, the fabricated vignette closing a `mechanismDescription`, the fabricated person
placed at real named organisations, the invented population claim (*"Most Directors in this position
find 20-35"*), the invented benchmark figures in `tools[].content`, the invented city, the invented
numeric thresholds in checklist details — and now an invented attendance limit.

**The pattern is one thing: the generator fills a gap with invention when it lacks real material.**
Node 4 solved it with the tier system. It is not a per-node bug and patching it per node has not
worked.

---

## 6. Three gaps the build still needs — all found by tracing, none built

1. **`runLandingPageGeneration` needs a no-clobber flag.** It ends in
   `autoSelectBest(userId, icpId, "selectedLandingPageId", landingPageId)`, and that write is
   unconditional. Generating a second page under the same ICP silently repoints the kit and orphans
   the magnet's opt-in page. That pointer has **33 readers across 14 files**, including Push to GHL,
   the Meta publish script and five V2 client components. **Since `85bcc8b` that repoint also marks
   downstream nodes stale**, so the clobber is now louder, not quieter.
2. **It needs a campaign-framing override.** It derives `campaignType` from the kit and accepts no
   argument for it.
3. **It needs a new framing to override TO** — see §7. Found by the content proof, not by tracing.

**The automatic trigger necessarily edits `server/_core/orchestration.ts`**, which is under a standing
do-not-touch. The cascade step table is fixed (`ORCHESTRATION_STEPS`), `hvco` is step 3 and generates
**and publishes** the magnet, `landingPage` is step 6 — so the magnet publishes three steps before any
landing page exists. **The trigger goes LAST, as its own change, after everything it fires is proven.**
Everything else lives outside the guarded files.

## 6a. 🔴 TWO OPEN ITEMS AGAINST THE TRIGGER — recorded 2026-08-27, neither fixed

Both found while scoping the coach-triggered path. Neither is a defect in what has shipped; both are
things the automatic trigger inherits, and the second changes what a proof of that trigger is allowed
to claim.

### (a) QUOTA DOUBLE-COUNTING — every lead-magnet campaign would silently cost TWO landing pages

`runLandingPageGeneration` increments `users.landingPageGeneratedCount` **and** calls
`incrementQuotaCount(userId, "landingPages")` on every run, regardless of caller. The tRPC wrapper
additionally *enforces* a ceiling (trial 2 · pro 50 · agency 500); the orchestrator skips enforcement
by design but **the increments still happen**.

So a lead-magnet campaign that also generates a free-event page consumes **two** of the coach's
landing pages instead of one. **On a trial account that is the entire allowance, spent by one
campaign.**

🔑 **The reason this is worth writing down rather than noticing later: it is VISIBLE by hand and
INVISIBLE in the cascade.** A coach clicking "create the free event page" sees their count move and
has chosen to spend it. The automatic trigger would spend it silently, inside a run the coach did not
itemise. **The coach-triggered path cannot surface this problem, because on that path it is not a
problem.**

**Not changed now, deliberately.** Quota accounting is shared by every caller of
`runLandingPageGeneration`, so touching it is a change to a shipped path for the benefit of one that
does not exist. The decision the trigger owes: does the free-event page count against the coach's
landing-page quota at all, and if not, which of the two increments is suppressed and on what signal.

### (b) 🔴 THE COACH-TRIGGERED PATH PROVES THE REPUBLISH HALF AND NOT THE ORDERING HALF

**Say this in the orchestration proposal rather than letting the proof be cited as broader than it
is.** It is the difference between "add a call to a path already working" and "we know the automatic
sequencing works", and only the first is earned.

**The ordering problem, stated exactly.** In the cascade, `hvco` is **step 3** and it generates *and
publishes* the magnet. `landingPage` is **step 6**. So the magnet is published, live, and its KV
pages baked **three steps before any landing page exists at all** — and the free-event page would be
later still. The automatic trigger therefore has to publish a magnet whose destination does not yet
exist, and come back for it.

**Why the coach path cannot exercise that.** It runs entirely *after* a completed cascade. The magnet
is already published and the free-event page is generated afterwards, so the republish is trivially
second and the sequence is never under test. **The coach path proves the republish MECHANISM — that
re-publishing overwrites the same deterministic KV keys and the same DB columns with no URL change,
and that the bridge then resolves. It proves nothing about WHEN.**

**Three further things it cannot exercise**, all benign-by-construction on the coach path and live in
a cascade: a kit that does not exist yet (`pageRole: "additional"` deliberately skips
`ensureCampaignKit`, and nothing else would create one); the completeness constraint firing, since by
hand the kit always already carries `selectedLandingPageId`; and any race on that pointer, since the
coach generates one page at a time while the cascade retries and interleaves.

⚠️ **THEREFORE: the eventual `orchestration.ts` proposal must carry the ordering problem as UNPROVEN
and design for it explicitly** — whether the magnet publish moves behind the landing-page step, or
stays at step 3 and is republished after. **It must not cite the coach-triggered path as covering
it.** That path is the reason the guardrail change is small; it is not evidence that the sequencing
works.

### (c) THE COACH PATH HAS ITS OWN ORDERING PROBLEM — smaller, human, and silent

Reading the pointer's target fresh at magnet-publish time is the right design — one field, one
meaning, the pointer records WHICH page and never whether it is live. **But it puts a sequence in a
coach's hands: the free-event page must be PUBLISHED before the magnet is republished.**

Get it the wrong way round and nothing fails. The pointer is set, the target has no `publicUrl`
yet, the bridge resolves to nothing, and the magnet republishes **with the honest text card** —
which is exactly what it renders when no page is linked at all. **The magnet looks finished and
quietly links nowhere**, and the two states are indistinguishable on the page.

This is not the cascade's ordering problem — it is milder, and it is recoverable by republishing
again. It is worse in one respect: **a human can get it wrong at any time, and nothing tells them.**

**The mitigation shipped with the build rather than being left to the UI:**
`hvco.republishDeliverable` **reports which of the three bridge states it rendered** —
`linked` · `target-unpublished` · `no-pointer` — instead of returning success three ways. Only one
of the three is actionable, and it is the one that would otherwise be invisible:

> *"Republished, but your free event page is not published yet — the magnet shows the next step as
> text with no button until it is."*

📌 `target-unpublished` is the state to surface in any UI built over this, and the reason it earns
that is precisely that it is indistinguishable from success on the artefact itself.

📌 On the bridge itself: `nextStepUrl` already exists as a render-time seam in `leadMagnetRenderer.ts`
and **nothing populates it**. The deliverable HTML is baked into Cloudflare KV at publish, so
render-time resolution is not available — but `publishLeadMagnet({hvcoId})` uses **deterministic
slugs**, so re-publishing overwrites the same KV keys and the same DB columns with **no URL change**.
Re-publish after the free-event page publishes; do not reorder the publish path.

---

## 7. 👉 NEXT ACTION — the new framing entry, recorded VERBATIM

Arfeen's strategy assistant has written the entry. **It is to be added as given.**

⚠️ **Check first whether anything in it conflicts with an instruction already in the stack, rather
than assuming it composes.** The proof in §4 exists because an assumption about composition was
wrong in both directions.

The wording:

> **CAMPAIGN TYPE: Free Next Step After a Lead Magnet** — Framing: The reader has already worked
> through the free asset. They arrive knowing the problem, holding the diagnosis, and having already
> applied the first fix. Write to someone one step in. Name what they have done as done, and open on
> what is unresolved because they did it — the gap the asset leaves behind. The live session's job is
> to carry them past that gap. Where the asset ends, this page begins. Urgency mechanism: the date
> and time of the session, and nothing else — any limit on attendance comes only from what the coach
> supplied. CTA language: Save my seat / Join the session / Register for the session.

### The verification that follows it

**Re-run the proof as a THIRD ARM. Five rows, same service (233), same title, zero writes, held
against the two arms already captured.** Same three questions, criteria stated before looking:

1. **Does arm C read like a webinar?**
2. **Does it assume a WARM reader** — does it take the diagnosis as understood rather than teaching it?
3. **Does it pick up the gap the magnet's bridge names** — the reader has the language fixed and no
   destination?

**Count against the two baselines:** restating phrases at **7-15 per row**, gap-carrying phrases at
**0 in 7 of 10 rows**.

🔴 **And check specifically for the seat cap or any equivalent invented limit.** The new framing
explicitly forbids it — *"any limit on attendance comes only from what the coach supplied"*. **If it
recurs under a framing that forbids it, that is a MORE SERIOUS finding than the restating was, and it
gets flagged on its own rather than folded into a summary.** It would mean a prohibition in the
framing layer does not hold, which changes what the framing layer can be trusted to do at all.

**The framing entry stays UNCOMMITTED until arm C has been read.**

---

## 8. Instruction competition — the property is CONFIRMED, the deciding factor is NOT

Four cases now, and **a different attribute won each time**:

| case | winner | the attribute that won |
|---|---|---|
| guide section shape vs length target | the length restatement | **narrower, and LATER** |
| checklist shape vs the two-sentence count | the shape | **broader, but stated THREE TIMES** |
| page type vs campaign framing (smoke row) | page type | **specificity of the block** |
| page type vs campaign framing (all 10 proof rows) | page type | same, at n=10 |

**Position, repetition and specificity have each won at least once.**

🔴 **No rule for predicting the winner is established, and none should be written.** The overlap
audit's job is **to gather cases, not to apply a rule we do not have.**

**This unresolved state is deliberate.** It is exactly how the phantom "research-backed quality bar"
was born — a plausible generalisation written down once, then cited as settled by everything
downstream until three replication specs contradicted their own frozen PNGs and every gate passed
against the lie. **An honest open question in writing is worth more than a heuristic nobody
rechecks.**

---

## 9. Standing guardrails — a fresh session reading only this file has no other copy

- **Nothing commits, applies, pushes or deletes without Arfeen's explicit word in the immediately
  preceding message. Each authorisation is one-time.** If a session was interrupted or approval is
  ambiguous, **default to not writing.**
- **Pushing `railway-build` is an instant production deploy.**
- **Protected services 272–277 and 285 are untouchable**, as is any protected campaign.
- **Migrations 0097–0104 are applied — never re-apply them.** Any new migration needs Arfeen's
  explicit word; the proposed `campaignKits.selectedNextStepLandingPageId` pointer is **flagged and
  unbuilt** for exactly that reason.
- **Stage named paths only. `git add -A` is always wrong in this repo.**
- **`copywritingRules.ts` is never touched**, and **`server/_core/orchestration.ts` is under a
  standing do-not-touch** for this build. If a proposal lands on either, stop and say so rather than
  proposing a shape.
- **The republish sweep for already-published magnets is out of scope** and needs its own
  authorisation.
- Off-machine backups go **only** to `backup/publish-path-sprint-2026-08-08`.
- The step-4c Meta publish scripts under `server/scripts/` shipped **dormant — do not invoke them.**
- **Test gates:** TS baseline **34** (`npx tsc --noEmit 2>&1 | grep -c "error TS"`), must not
  regress; new work adds zero. Repo is **pnpm-only**. Suites green at HEAD: **557 across ten files**.
- **Node numbering: Lead Magnet is Node 5, Unique Method is Node 4.**
- **`HVCO` is the internal name for the lead magnet** — code, DB (`hvcoTitles`, `hvcoTopic`) and older
  docs all use it. **Any search must cover both terms.**
- **Search reliability:** `grep` here is **`ugrep`** and returns nothing silently when multiple
  `--include` flags are stacked; `timeout` makes `pdftotext` emit nothing. ⚠️ **`rg -r` is
  `--replace`, not "recursive"** — `rg -rn "foo"` silently rewrites every match. **Run a positive
  control before trusting any zero.**
- **Driver scripts live in the scratchpad, outside the repo.** Every measurement in this phase was
  read-only; **no run in this sprint wrote to production.**
- **`markTweakStale` is a known third copy** of the stale-marking logic (`campaignKits.ts`). Its two
  differences look deliberate. The parity test pins the class at three copies — **a fourth fails the
  test.** Whether copy three is right is its own question.
