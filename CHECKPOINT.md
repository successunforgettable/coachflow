# CHECKPOINT — NODE 4 (Unique Method) SHIPPED, LIVE and TIER-1 PROVEN; next node is the Lead Magnet

**For a cold terminal with no memory of the session that produced this.** Read this file, then
`docs/handovers/STATE.md`. Everything below was verified in-session, not recalled.

---

## 0. NEXT ACTION — read this before anything else

# 👉 STATE AT BREAK — 2026-08-28. THE TRIGGER IS BUILT AND TESTED, NOT DEPLOYED.

**Branch `railway-build`. Working tree CLEAN. `origin/railway-build` = `2cb6491` (deployed).
Local HEAD is ahead by five commits, NONE pushed. Migration 0106 is WRITTEN AND NOT APPLIED.**

### 👉 THE NEXT ACTION IS ONE THING

**Implement decision 1 below — resolve the three optional webinar tokens at their source — then
propose the verification and deploy sequence.** Nothing else is pending.

### The five unpushed commits

| SHA | what |
|---|---|
| `2684a81` | docs — Node 5 deploy banked, the three rehearsal findings, residual 11 |
| `2fc366b` | 🔴 **fix** — every landing page counted as TWO against quota. Live bug, fixed forward |
| `824a4d9` | docs — §6a(c), the coach path's own silent ordering problem |
| `294d795` | **0106** — `renderedBuild` stamp + event facts recorded. Migration NOT applied |
| `c5b3024` | **the trigger** — the cascade builds the magnet's free-event page |

### What is BUILT and COMMITTED (local only)

- **The double-count fix.** Two statements incremented the same `users` column; a real generation
  on a local copy moved the counter **0 → 2 for one page**, and **1 for one page** after. Trial
  ceiling is 2, so a trial coach's first page spent their whole allowance. Fix-forward, no backfill.
- **The trigger** — one guarded block in `orchestration.ts` `case "landingPage"`, gated on
  `lead_magnet`. **This is the only thing the do-not-touch guardrail was lifted for; it stands for
  everything else in that file.**
- **Quota suppression** for `pageRole: "additional"` — the free-event page is machinery, not an
  asset the coach asked for.
- **The readiness widening** (outside the guarded file) — `freeStepQuestions` / `freeStepReady`
  returned as their own list, so `ready` is unaffected and the three questions never block.
- **The renderer stamp and event facts**, both publishers.

### What is WRITTEN BUT NOT APPLIED

🔴 **Migration 0106 is not applied to production. 0097–0105 are applied.**
**The migration LEADS the deploy** — both tables are read with bare `db.select()`, so shipping the
schema first fails with `ERROR 1054` across the board. 0105 proved this in rehearsal.

🔴 **`BUILD_SHA` is not set, so `renderedBuild` writes NULL.** There is no git variable in the
Railway environment at all — checked. See decision 2.

### What was TESTED, and how

**604 green across 12 files · TS 34.** Tests 1–4 and 6 are units. Tests 5 and 7 ran against a
**local MySQL copy of production** (masked `users`: structure-only + 18 synthetic rows, zero email
/ name / booking_url; the four PII tables excluded).

- **TEST 5 — the first full cascade run any of these commits has ever had. 7/7.** Two pages
  created · quota moved by **one** · the kit's pointer stayed on the **primary** page · the magnet
  points at the free-event page · the bridge resolves `target-unpublished`.
- **TEST 7 — the ordering window. 4/4.** The pairing survives a failed publish; the magnet renders
  the honest text card; publishing the page later flips the bridge to `linked` **without the
  pointer being rewritten**.
- 📌 **No Cloudflare credentials exist locally**, so nothing could publish — which is why the local
  run could not touch production KV, and also why the `linked` state and the KV write still need a
  live run.

### 🔴 OPEN FINDING FROM TEST 5 — the three questions are NECESSARY BUT NOT SUFFICIENT

```
[orchestration.freeNextStep] skipped for kit 152:
  Landing page has 1 unfilled placeholder: [INSERT_REPLAY_AVAILABILITY]
```

**The publish gate throws on ANY surviving `[INSERT_*]`**, while
`PAGETYPE_REQUIRED_TOKENS.webinar_registration` covers only **date · time · timezone**. The webinar
prompt's placeholder ALLOW-LIST additionally permits **`[INSERT_EVENT_NAME]`,
`[INSERT_HOST_NAME]` and `[INSERT_REPLAY_AVAILABILITY]`**.

**So a coach can answer all three questions and the page still fails to publish.** The failure is
safe — caught, pointer kept, magnet keeps the text card, self-heals on the next run — but the
free-event page will frequently not publish. No unit test could have found this; only the cascade
run did.

### ✅ THREE DECISIONS — TAKEN IN CONVERSATION, RECORDED HERE BECAUSE THEY EXISTED NOWHERE ON DISK

**1 · OPTIONAL TOKENS — FIX THE SOURCE, NOT THE GATE.**
**Keep the publish gate strict. Add no prohibition. Do NOT neutralise unfilled placeholders.**
`LP_FRAMING_FREE_NEXT_STEP` already asserts the session **is live and happens once**, so replay
availability is not an open question on this page type. For each of the three optional tokens, in
this order: **if we already hold the fact, substitute it; if the framing already answers it, write
from that fact; only what fails both becomes a question for the coach.** Measure across **at least
five rows**.
📌 A prohibition would name the shape and leave the space empty — the seat-cap lesson. A
neutraliser would delete the gate's only signal.

🔴 **CORRECTION — 2026-08-28, DO NOT RE-INTRODUCE THE OLD BRIEF'S REPLAY PREMISE.**
The brief that set this work up said `LP_FRAMING_FREE_NEXT_STEP`'s "strongest line contrasts a
recording with the live session". **It does not, and it never did.** That line was a GENERATED ROW
from the A/B — model output, read back as if it were source. The framing's own text was never
checked against it.

**What the framing actually asserts:** *"the session is live and happens once, at the stated date
and time"*. That is all. **Live-and-once does NOT entail no-replay** — a session can happen once and
still be recorded. ZAP does not hold the replay fact and the coach was never asked for it.

**So the substituted text restates the framing's claim and STOPS:**
> "This session runs live, once, at the stated date and time."

It never says "no replay", "live only", or "will not be recorded". A unit test in
`server/_core/freeNextStepTokens.test.ts` pins that it never starts saying them, and a second test
pins that the framing still makes the live-and-once claim the text is derived from — so if the
framing is ever reworded, the pairing fails loudly instead of drifting.

📌 **The line the old brief was remembering is real, but belongs to a DIFFERENT campaign type** —
"being there beats any recording" is the IN-PERSON EVENT framing (`campaignFraming.ts`, the
`in_person_event` entry). It is not available to this page and must not be borrowed for it.

📌 **This is §15a's lesson in a new place.** §15a says a frozen PNG outranks spec prose. The same
rule applies one level up: **a generated OUTPUT never outranks the source it was generated from.**
An A/B row is evidence about the model, not about the framing.

**2 · 🔴 RETIRED 2026-08-28 — `BUILD_SHA` MUST STAY UNSET. SETTING IT WOULD MAKE THE STAMP LIE.**

The original decision said set `BUILD_SHA` as part of the deploy, on the premise — recorded in this
file — that *"there is no git variable in the Railway environment at all — checked."* **That premise
is false.** Read from the RUNNING APP PROCESS (`/proc/33/environ` of `node dist/index.js`, not an
SSH session's environment, which can differ):

```
app_RAILWAY_GIT_COMMIT_SHA = 6edb654083969768c05ec66750479857c454cdbe   ← exactly HEAD
app_BUILD_SHA              = (absent)
app_SOURCE_COMMIT          = (absent)
```

📌 Likely origin of the wrong note: **Railway's variables panel does not list auto-injected
`RAILWAY_*` variables**, so checking there shows nothing while the process has them.

**THE REASON IT MUST STAY UNSET IS NOT "it is unnecessary". IT IS THAT SETTING IT BREAKS THE
COLUMN.** `buildStamp.ts` resolves in this order:

```
process.env.BUILD_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.SOURCE_COMMIT
```

`BUILD_SHA` is **preferred**. A hand-set value is therefore **frozen at the moment it was typed and
authoritative from then on** — it does not follow HEAD, and it silently outranks the variable that
does. On the very next deploy, `renderedBuild` would stamp every newly published page with the
**previous** build's SHA, and go on doing so for every deploy after that, until someone remembered
to retype it.

**A stamp that reports the wrong build is worse than no stamp**, because `renderedBuild` exists for
exactly one question — *which build baked this page, and how stale is it?* — and it would answer
that question confidently and wrongly. The NULL it replaces is honest ("unknown age"); a stale SHA
is not. The whole point of the column is defeated by the variable that was meant to switch it on.

**Railway's `RAILWAY_GIT_COMMIT_SHA` tracks HEAD automatically, per deploy, with nothing to
remember.** It is the correct source and it is already wired as the fallback. Leave `BUILD_SHA`
unset. If it is ever set for some other reason, it must be reset on **every** deploy or the column
starts lying.

**3 · INTAKE COPY — FINAL, SHIP EXACTLY AS WRITTEN:**

> Planning to run a live session for the people who download this? Give me the date, time and
> timezone and I'll build the registration page — your guide will send readers straight to it.
>
> No date yet? Skip this. Your guide still ends with an invitation, it just won't have a link.

### 🔵 BACKLOG — CONFIGURATION THAT IS DECLARED BUT READ BY NO CODE (opened 2026-08-28)

**Wants its OWN sweep across the codebase. Not being chased now.** Logged while the instances are
in hand, because each was found by accident rather than by looking.

**Why this is a class and not three bugs.** A declared-and-unread setting is invisible in exactly
the way a missing one is not: it reads as deliberate, it survives review, tests that assert it
EXISTS still pass, and nothing anywhere fails. The token case below cost a whole failure mode — a
coach could answer every question asked of them and the page still would not publish.

**CONFIRMED DEAD — 0 readers, verified by repo-wide grep 2026-08-28:**

| what | where | evidence |
|---|---|---|
| `autoFillFrom` | `server/lib/templates/operatorFields.ts` | declared on the registry type + 3 token entries; **read by nothing**. `[INSERT_HOST_NAME]` / `[INSERT_EVENT_NAME]` were documented "never asked of the coach — filled server-side", were duly skipped by `deriveOperatorQuestions`, and were never filled. **Now implemented** — this is the worked example, kept here as the specimen. |
| `PROOF_COMPOSITIONAL_CEILING_RULE` | `server/_core/copywritingRules.ts:386` | exported; appears in exactly ONE other file and only inside a COMMENT (`_core/validator.ts:396`). Pasted into no prompt. **Still dead.** |

**⚠️ THE THIRD CANDIDATE DID NOT HOLD — and the reason matters more than the miss.**
`NO_RESEARCH_STATISTIC_FABRICATION_RULE` was logged as "never imported by Node 5". It **is**
imported: `server/leadMagnetContentGenerator.ts:18`, appended to the system prompt at `:327`, with
`leadMagnetBounds.test.ts:387` asserting it is there.

🔑 **It is wired because WE WIRED IT, THIS SPRINT — `ed3ea41`, "inherit
NO_RESEARCH_STATISTIC_FABRICATION_RULE — a missing import, not a new rule" (already on origin).**
So the candidate was a **FIXED instance cited as evidence of a live class**. That is a specific trap
worth naming: a defect you closed yourself is the easiest thing in the world to re-report, because
the memory of finding it is far more vivid than the memory of fixing it. **Check the git log before
logging a class from an instance.**

**COUNT: TWO confirmed dead-config instances, not three.**

---

### 🔵 THE SECOND CLASS — A PROMPT SITE MISSING RULES THAT ALREADY EXIST

**This is the bigger of the two, and it is NOT the same problem.** Class 1 is a setting nothing
reads — the rule text exists and is inert. Class 2 is a rule that is live, correct and enforced
*everywhere else*, and simply **absent at one prompt site**. Nothing fails, nothing is declared, and
the only way to see it is to compare prompt sites against each other. `ed3ea41` was exactly this
class — which is why it was fixable in one import and no new rule text.

Measured across every export of `copywritingRules.ts`, 2026-08-28:

- 🔴 **`server/bonusGenerator.ts` imports NOTHING from `copywritingRules.ts` at all** — while
  running a real LLM prompt (`BONUS_SYSTEM`, line 130). No banned words, no register standard, no
  fabrication rules, on **coach-facing deliverable content**. **The biggest single gap found.**
- `server/hvcoGenerator.ts` imports `BANNED_COPYWRITING_WORDS` + `REGISTER_STANDARD` and **none of
  the fabrication rules** — and it names the lead magnet.

**The sweep is therefore TWO passes, not one:**
1. every exported rule/config → is it read by anything other than a comment or a test?
2. **every LLM prompt site → which rules does it import, and which does it silently lack?**

Pass 2 is the one that produces a **WIRING MAP** — generators down one axis, rules across the other,
so a missing cell is visible instead of inferred. Neither pass is safe to eyeball; both are
mechanical and belong in a test that fails on regression.

📌 **This reframes the largest remaining piece of work.** See `docs/handovers/STATE.md` queue item
**P1** — its cause (a) already lists unguarded generators, but it was scoped as a DETECTION problem
(better regexes, more validator coverage). It is now known to need a **wiring map across every
prompt site first**: no amount of new rule text or sharper detectors reaches a generator that
imports neither. Annotated in STATE.md so the reframing is not lost.

### Carried, unchanged

The ordering problem stays **unproven** and the coach-triggered path is **not** cited as covering
it. The completeness guard **never fires on the happy path** — an unfired guard is untested. The
**expiry question is deferred**: a page advertising a date that has passed is worse than no page;
0106 records the date so the eventual degraded state can read it.

---

# 👉 NODE 5 (LEAD MAGNET) IS SHIPPED, DEPLOYED AND EXERCISED ON PRODUCTION — 2026-08-28

**`origin/railway-build` = `2cb6491`. Railway SUCCESS. Migration 0105 APPLIED.** Fifteen commits
went out in one push, the first production deploy since `f5be0b0`. **NEXT: the cascade trigger for
the free-event page — scoped, not started, and it needs the `orchestration.ts` guardrail lifted.**

### What shipped

The Node 5 rebuild: the mechanism reaching the body instead of its name, size bounds that trim
outliers rather than the median, the statistic-rule import, the checklist target, tier 3 of the
destination chain, the stale-marking extraction, the free-next-step framing, the crown/framing
seams, and the explicit magnet→page pointer (0105).

### 🔑 THE THREE FINDINGS FROM THE REHEARSAL — a local MySQL copy, 2026-08-27

Standing up a throwaway local database and running against it cost about an hour and no model
spend, and it paid for itself three times:

1. **THE DEPLOY HAZARD REPRODUCED ITSELF, RATHER THAN BEING ASSERTED.** Running the new code
   against a database without 0105 failed with **`ERROR 1054 Unknown column
   'nextStepLandingPageId'`** — and not only on the new path. `hvcoTitles` is read with a bare
   `db.select()` at **15 of its 22 call sites**, and a bare select emits every column declared in
   `schema.ts`. **The migration must lead the deploy.** Proven from the other side too: the exact
   column list the old build emits still returned rows after 0105 was applied, so the database can
   safely run one column ahead of the code.
2. **0105 IS TWO STATEMENTS AND MySQL DDL IS NOT TRANSACTIONAL.** The rehearsal produced the
   half-applied state — **column created, foreign key missing** — and re-running the file then
   fails on `Duplicate column name`. 🔴 **The half-applied state is the dangerous one:** the column
   alone stops `ERROR 1054`, so the app starts and looks healthy while `ON DELETE SET NULL` is
   absent and a deleted page leaves a DANGLING pointer. Recorded in the migration header with the
   two verification queries and the recovery.
3. **FOREIGN KEYS FORCED A TABLE THE COPY WAS MEANT TO EXCLUDE.** The ALTER rebuilds `hvcoTitles`
   and revalidates its three existing FKs, so `users` had to exist. Resolved by **structure-only
   dump + 18 synthetic rows** (real ids, `openId` masked, zero email / name / booking_url) rather
   than by copying user data.

📌 Also from the rehearsal: `ON DELETE SET NULL` **observed acting** — a real landing page deleted,
the pointer nulled rather than left dangling — which the declaration-pinned test cannot reach.

### ✅ THE TWO LIVE EXERCISES — after the deploy, on production

- **Stale marking (`85bcc8b`) fired for real.** Kit 147 / service 220 (outside the protected set):
  seven downstream nodes marked, the changed node's own mark cleared, `icp` correctly untouched
  because it is not downstream. Table-wide 81→85 rows, 3→10 stale. First time this code has run
  outside a fake `db`.
- **A magnet republished through the real tRPC procedure.** `hvco.republishDeliverable` on hvco
  5686: `bridge: no-pointer` (the expected pass — nothing on production carries a pointer), URL
  **byte-identical** so slug determinism holds, and on the live page the dead `href="#"` became a
  text card and the script's `c.href = view` — **the CTA that sent readers back to the magnet they
  had just been given** — is gone.

📌 **Deploy verification is a BYTES check, not a panel check.** A green Railway panel says a build
succeeded. What proves the right code is running is behaviour: `hvco.republishDeliverable` returned
**405** (exists, is a mutation) where a nonexistent path returns **404**.

### 🔴 RESIDUAL 11 — IT GENERALISES WELL BEYOND THIS NODE, SO READ IT EVEN IF NODE 5 IS NOT YOUR TOPIC

**A REPUBLISH RE-RENDERS WITH THE CURRENT RENDERER, SO IT CARRIES FORWARD EVERY RENDERER CHANGE MADE
SINCE THAT PAGE WAS LAST PUBLISHED — NOT ONLY THE CHANGE BEING TESTED.**

Found by diffing the republished page rather than trusting the intended diff. Republishing 5686
grew the deliverable 17,152 → 21,310 bytes and converted its `<pre>` blocks into structured
markdown. **None of that was in this push.** It came from `10582b9`, confirmed an ancestor of the
previously deployed `f5be0b0`. The page's HTML had been **baked into Cloudflare KV at its last
publish**, long before `10582b9` deployed, so the republish surfaced everything accumulated in
between.

**Why it matters generally:** hosted artefacts are frozen at publish, while the renderer keeps
moving. The gap between them is invisible until something forces a re-render, and then it arrives
all at once. **Any republish sweep applies every accumulated change to every page simultaneously.**
Diff a republished page against its live predecessor before believing you know what changed.

### 🔴 OPEN — 38 published landing pages and 2 magnet bodies sit at UNKNOWN RENDER AGES

The direct consequence of residual 11. Nobody knows how far behind the current renderer those live
pages are, because nothing records which renderer version baked them. **Before launch this resolves
one of two ways, and both are decisions rather than defaults:** republish them once, deliberately,
with the diff reviewed — or accept explicitly that live pages are stale renders and say so.
**Doing nothing is choosing the second without admitting it.**

📌 **The 10 stale marks now on production are NOT an open item.** Every row in that database is
pre-launch test data and a clean-slate wipe is planned before launch, which clears them. Nobody is
owed a decision about them.

---

# 👉 NODE 4 (UNIQUE METHOD) IS SHIPPED, LIVE AND PROVEN — superseded by Node 5 above

### STATE AT SHUTDOWN — 2026-08-21

| | |
|---|---|
| Last CODE commit | **`f5be0b0`** — the `truncateAtSentence` g-flag fix. Node 4 shipped in the three commits before it. Run the command below for live SHAs; §1 records what hardcoding one here costs |
| HEAD / `origin/railway-build` | **both `f5be0b0`** — 0 ahead, 0 behind. **Everything below is DEPLOYED.** Re-read the count from git; never quote one from here |
| Railway | ✅ deploy of `f5be0b0` **SUCCESS**. Site 200, live tRPC probe 200, boot clean (`[boot] Font validation OK`, `reaper: 0 pending`). ⚠️ `/health` and `/api/health` are the SPA catch-all, NOT a liveness route |
| Everything banked at 08-19 | ✅ **NOW DEPLOYED.** `51eda78` is 44 commits behind HEAD — the FAQ guardrail, Node 5 body/bonuses, the teardown fence, the currency-aware budget floor and ICP Phase A all went out with the intervening sprints |
| Migrations | **0097–0104 are APPLIED to production — do NOT re-apply.** 0104 = `coachMethods` + `heroMechanisms.sourceTier` / `coachMethodId` |
| Off-machine backup | `origin/backup/publish-path-sprint-2026-08-08` = **`3085b50`** — deliberately behind HEAD. It does **NOT** deploy. Off-machine backups go **only** there, never to `railway-build` |
| tsc | **34**, re-confirmed either side of `f5be0b0`. Suites green: pipeline-fixes 394, complianceFilter 31, tokenCrypto 10, cascadeContext.truncate 9 |
| **Node 4 — Unique Method** | ✅ **SHIPPED, LIVE and PROVEN on prod.** Full account in §0-P2 → Node 4 |
| Step-4c Meta publish scripts | ⚠️ shipped **DORMANT** under `server/scripts/` — **do not invoke them** |
| Phase 2 — node research pass | 🔵 **IN PROGRESS.** ZAP is **B2C ONLY**. Nodes 2 · 3 · 4 done. **NEXT: the Lead Magnet node.** ⚠️ Arfeen's research lives OFF-REPO (`~/Downloads`, Drive) — repo-only audits mislead. See §0-P2 |

⚠️ **The ahead-count moves with every docs commit — re-read it, never quote it.**
`git fetch origin && git rev-parse HEAD origin/railway-build origin/backup/publish-path-sprint-2026-08-08`

**The 4c harness is DONE.** Both failed attempts were diagnosed, fixed and banked — the 08-10 token
gap (three-phase rework, `f528800`) and the 08-12 false-positive assertion plus the `booking_url`
crash (`087873a`). Teardown reconciled exactly to baseline both times. **No harness work is pending.**

**BOTH COMPLIANCE CODE DEFECTS ARE FIXED AND BANKED** (`11a920a`) — the `"scale"` vocabulary
collision and the guarantee handling. Re-measuring the classifier over the preserved page-238
content took the blocking hits from **6 to 2**. Full account below.

### 🔴 THE SOLE REMAINING BLOCKER TO A 4c RE-RUN — ONE HIT, ON THE ACTIVE ANGLE

`promised_result` at **`original.faq[6].answer`** — the active angle. The line:

> *"…if the structure has not produced a retainer conversation within twelve weeks, **I will work
> with you one-to-one at no additional cost until it does**."*

**It matters to 4c because `checkAdToPageMatch` reads the ACTIVE ANGLE at `--publish`.** A re-run
clears the token gate and then points ads at a page carrying this claim. Nothing else on the page
blocks: `godfather` and `dollar` are clean, and `free`'s one hit is on a non-active angle.

⚠️ **This is not a code defect and must not be fixed as one.** The classifier is right that an
unconditional "until it does" reads as a promised outcome. What has to change is how the copy is
GENERATED — see the decision below.

### 🔑 THE REFRAME — this is a CLASSIFIER PRECISION problem sitting under a COVERAGE gap

The exact-text analysis on **2026-08-12** changed what this blocker is. It had been recorded as "the
copy engine writes non-compliant pages." **It is not.** Reading the actual flagged sentences against
Meta's own policy, **the copy is mostly fine and the gate is mostly wrong.**

**The coverage gap.** The generation-time gate screens a **hardcoded list of 11 top-level fields**
(`landingPageGenerator.ts:769-774`) while the persistence extractor walks **78**. The headline "67 of
78 unscreened" overstates the exposure, though: 42 of the 78 are labels, headings or numeric-ish
scaffolding. **The real exposure is ~28 unscreened PROSE fields** (median 57 words), concentrated in
`faq` 11 · `consultationOutline` 10 · `bonuses` 3 · `quizSection` 2 · `guarantee` 1 ·
`scarcityUrgency` 1. **All 6 of the page's blocking hits landed in fields the generation gate never
reads.**

### ✅ THE PRECISION WORK IS DONE — SIX BLOCKING HITS WERE **TWO CODE DEFECTS**, BOTH NOW FIXED

⚠️ **THE TABLE THAT STOOD HERE WAS WRONG ON ALL THREE OF ITS DIAGNOSES, AND IS DELETED.** It was
written by reading flagged spans and reasoning about policy. Every line of it was overturned by
running the classifier over the preserved page-238 content as a pure in-memory probe. **The lesson
generalises: a flagged span is not evidence of which rule fired**, and on this delegation path the
span was not even a match. Read the code and run it; do not grade a hit from its message.

What it got wrong, kept as the record: it blamed the two `second_person_protected_attribute` hits
on a **business-attribute** gap in the protected-attribute vocabulary (that vocabulary contains no
business or relationship noun and was never consulted); it blamed a third on **`resolveAnchors`
carrying second person across a sentence boundary** (`resolveAnchors` carries a *label*, never text,
and the firing rule sits BEFORE the anchor gate and needs no second person at all — the carry only
ever SUPPRESSES); and it graded the `free.guarantee` hit against
*"The Session Produces A Written Output Or We Run It Again"*, a sentence the classifier **never
objected to** — it was the field's first 80 characters, printed because nothing could be attributed.

#### THE TWO REAL DEFECTS

| # | defect | mechanism |
|---|---|---|
| 1 | **the `"scale"` vocabulary collision** | `"scale"`/`"scales"` sat in `BODY_PROXY_NOUNS` as the bathroom scales. The §1.3 body-proxy rule is a two-term conjunction — a proxy noun plus ANY `DEFICIT_PREDICATE`, and `"cannot"` is one — so ordinary consulting copy blocked at tier 1 as an assertion about the reader's BODY |
| 2 | **the guarantee handling**, in two halves | (a) bare `\bguaranteed\b` in `complianceFilter` pivot rule 2 had **no negation handling**, so copy DENYING a guarantee blocked exactly as hard as copy making one; (b) the delegation reported **every** `complianceFilter` verdict as `deceptive_urgency` and, when the pivot had emptied `flaggedTerms`, attached **the field's first 80 characters** as the span |

🔑 **Defect 2(b) is why the old table existed.** The class and the evidence were both wrong, so the
hits could only be graded against innocent text. `flaggedTerms` is collected by scanning the
**cleaned** text — after the pivot has already deleted the offending phrase — so an empty array is
the NORMAL outcome on that path, not an edge case.

#### MEASURED BEFORE AND AFTER — the same probe, over the same preserved content

**Blocking hits across all four angles: 6 → 2.** Four were outright false positives and are gone; a
fifth was a real catch reported under the wrong class with a span no rule had matched.

| angle | before | after |
|---|---|---|
| **`original`** ◀ ACTIVE | 2 | **1** — `promised_result` @ `faq[6].answer` |
| `godfather` | 1 | **0** |
| `free` | 2 | **1** — `promised_result` @ `guarantee` |
| `dollar` | 1 | **0** |

📌 **The arithmetic, stated exactly, because "five false positives" does not add up against two
survivors:** **four** of the six were outright false positives (both `scale` hits, both
guarantee-denial hits) and no longer block at all. A **fifth** — `free.guarantee` — carried a
classifier defect but not a false positive: the catch is real (*"the output is guaranteed"*), and
what was broken was the reporting. It now reports as **`promised_result`** with the span
**`"guaranteed"`** instead of `deceptive_urgency` against an innocent opening sentence. So **five of
six carried a defect; four of those were false positives.**

**The two survivors:**

1. `free.guarantee` — the one **real guarantee claim** on the page, now correctly classed and
   honestly spanned. `free` is **not the active angle**.
2. `original.faq[6].answer` — `promised_result` on *"within twelve weeks of completing the
   programme, I will work with you"*. **THE SINGLE OPEN POSTURE CALL, and it is Arfeen's.**
   Deliberately untouched by this work.

🔴 **THE ACTIVE ANGLE IS NOT CLEAN — IT CARRIES EXACTLY THAT ONE HIT.** Measured by walking all
**89 string fields** of each stored angle, not by re-reading a summary: `original` BLOCKING=1.
⚠️ An earlier report in this session said the active angle had dropped to **zero**; that was wrong
and is corrected here. The scarcity hit cleared; the faq hit did not, and it was always on
`original`. **So the compliance blocker on 4c reduces to one product decision, not a code fix.**

⚠️ **All of the above is measured on content captured before the 2026-08-12 teardown, not on a
fresh generation.** It proves the classifier's behaviour on that text exactly. It does NOT prove
what the copy engine will produce next run. Re-screen a freshly generated page before treating the
active angle as a solved problem.

### 🔴 WHY THE ORDER MATTERS — widening coverage FIRST changes nothing

Under the persistence gate's **degrade-never-kill floor**, a false positive **does not block**. It
**burns all three retry attempts and then persists the row anyway**. So widening the gate's field
list before fixing precision buys **zero** additional safety and spends generation time on retries
that cannot succeed. **Precision first is not a preference; it is the only ordering that does
anything.**

### THE PLAN — in this order, and not another

1. ✅ **DONE — fix classifier precision.** Both defects fixed and committed local-only. Not deployed.
2. ✅ **SETTLED 2026-08-14 — the posture call is DECIDED, and the answer is CONSTRAINED GENERATION.**
   See the decision below. The copy changes; the gate does not.
   ⚠️ **The OTHER posture call recorded here is WITHDRAWN, not decided.** It read *"should truthful
   structural scarcity trip the gate at all?"* — that question was an artefact of defect 2(b). Those
   two hits were never about the cohort-cap headings; they fired on the word `guaranteed` inside
   sentences that DENY a guarantee, and the headings were only ever the printed span. **The honest
   cohort-cap copy never tripped the gate and does not need a ruling.**
3. **Then widen coverage** by **single-sourcing the gate's field list from the persistence
   extractor**, so the two lists cannot drift. ⚠️ The hardcoded list is why every field added to the
   LP schema since it was written is unscreened by default — a silent gap that grows with the schema.
   📌 The ordering argument above still holds and is now also EVIDENCE: the generation-time gate
   screens 11 fields and every one of the six blocking hits landed outside them, so widening first
   would have added retry cost against four hits that were not real.

📌 **Third instance of one shape in this subsystem:** two representations of the same thing kept in
parallel and allowed to drift — the gate's field list vs the extractor, the `bookingUrl` JS key vs
the `booking_url` column, and the per-angle answering pass vs the all-angles assertion.
📌 **FOURTH INSTANCE FOUND, and it is the one that cost the most:** `complianceFilter`'s verdict and
its `flaggedTerms` were two representations of the same finding, and the second was collected over
REWRITTEN text — so it went empty exactly when the first said "blocked". Closed by `triggers`,
recorded against the original text at the moment each rule fires. **Watch for a fifth.**

---

## 0-P2. PHASE 2 — NODE RESEARCH PASS. State saved 2026-08-20

**This section is a SAVE, not a resume.** It records what is settled so a dead terminal costs nothing.

### 🔴 FOUNDATIONAL — ZAP IS B2C ONLY. NEVER B2B.

Every research report, standard, prompt, example and test fixture is **B2C**. The audience is
coaches, consultants, tarot readers, astrologers, yoga instructors and the like — individuals
selling to individuals. **There is no buying committee, no procurement, no board, no SME account.**
A framework that arrives in B2B clothing is translated or it is not used. This is not a preference
about tone; a B2B-framed prompt fails silently on most of the user base, which is the same failure
mode CLAUDE.md §15a records for corrupt reference specs.

### Where Phase 1 ended

Compliance layer + safe-to-run **item 1** (bonus-teardown predicate fence) + **item 2**
(currency-aware daily-budget validator) are **banked**. Remaining safe-to-run:

- **item 3 — `ANTHROPIC_API_KEY` rotation.** Pure ops, Arfeen's to run. Zero repo changes.
- **item 4 — crashed-job reaper.** Needs a migration, so it travels alone.
- **item 5 — monitoring.** Needs a buy-vs-build decision before scoping.

### What Phase 2 is

**Research → rebuild, one thin node at a time, the way Node 2 was done.**

🔑 **THE FINDING THAT CHANGES THE MAP: ARFEEN'S RESEARCH LIVES IN `~/Downloads` AND GOOGLE DRIVE,
NOT IN THE REPO.** Repo-only audits are therefore *misleading by construction* — they measure what
was banked, not what exists. An audit run against the repo alone called the Offer node
"unresearched" on 2026-08-19; the research existed off-repo the whole time. **Never conclude a node
is unresearched without checking off-repo first.**

| | |
|---|---|
| **Genuinely missing — must be commissioned** | **Email · WhatsApp** (Unique Method is now ✅ done — researched, rebuilt, deployed and proven) |
| **Research exists OFF-REPO** | **Lead Magnet · Landing Page** (Offer ✅ banked in-repo) |

⚠️ The WhatsApp case is worse than missing: `whatsappSequenceGenerator.ts:206` cites a *"WhatsApp
wire research report"* that exists **nowhere** — not in the repo, not in Downloads.

### Node 2 — ICP: ✅ DONE and banked

Phase A shipped (see §0-ICP). Phase B (multi-persona) scoped, not started.

### Node 3 — Offer: ✅ RESEARCH DONE, REBUILD DONE + BANKED, NOT DEPLOYED

**Shipped local-only in one commit** (run `git log --oneline -1` for the SHA — never quote one from
here). Eight paths: the standard, the two new `_core` modules, and the four generators it touches.

- **The node is campaign-type-aware.** `_core/campaignFraming.ts` owns `resolveOfferMode` →
  `free_event | paid`, single-sourced off the SAME `campaignType → pageType` chain the landing page
  uses, so the offer and the page it feeds cannot disagree about whether money changes hands. An
  operator price in `campaignKits.campaignFacts.price` overrides in BOTH directions — that override
  is the seam the deferred paid tripwire lands on, and it is already tested.
- 🔑 **THE FAQ LEAK IS CLOSED AT SOURCE, WITH TWO INDEPENDENT GUARDS.** Measured on service 1
  (`price=3000.00`, `"Full refund"`, `"90 days"`): a FREE webinar page carried the £3,000 in
  `faq[4]` and the money-back promise in `faq[5]` on **three of four angles**, inside the
  `faq[0..5]` window both webinar templates render to the buyer. The page-type prompt's
  `guarantee: ""` could not stop it — the model had the facts and a plausible place to put them.
  Guard 1: the offer node WITHHOLDS the facts in free mode. Guard 2: `describeOffer` suppresses
  them on the way into the LP prompt, keyed off the **page's** campaign type, so it holds for a
  legacy offer row generated paid-shaped. Re-measured after the fix: **0 currency, 0 refund,
  guarantee empty on all four angles, 0 tier-1 blocking hits.**
- **The value equation is fed its own inputs** — ICP `hopesDreams` (Dream Outcome) + `pains`/`fears`
  (cost of inaction), which were sitting unused while the prompt read four fields that are not
  levers. Guarded STRUCTURALLY by `neutraliseProfileCurrency`, not by a prompt instruction: since
  ICP Phase A `pains` legitimately carries the coach's own figures, and
  `detectInventedCurrencyAmounts` flags every `£N` when no price is supplied, so a copied figure
  would burn all three retries and persist anyway.
- **Output schema UNCHANGED** — same seven `OfferContent` keys, same three angle columns, same
  `activeAngle` enum, no migration. The three angles are REINTERPRETED per mode. `pricing` and
  `guarantee` stay non-empty in free mode (they carry access-terms and the attendance promise);
  an empty `pricing` renders as "Pricing: —" on the kit card and ships blank in exports.
- **The 4-of-7 framing drift is closed.** `LP_CAMPAIGN_FRAMING` is typed `Record<CampaignType, …>`,
  so an incomplete map is a compile error rather than a silent fallthrough to `course_launch`.

⚠️ **THE S4 GATES MOVED, AND ONE HAD GONE SILENTLY VACUOUS.** Three assertions read literal strings
out of `ANGLE_PROMPTS` in `offersGenerator.ts`; the prompts now live in `_core/offerStandard.ts` as
two sets. One used `indexOf("const ANGLE_PROMPTS")` → **-1**, `slice(-1, …)` → **empty string**, and
its `not.toContain` **passed against nothing**. Repointed and strengthened, 3 assertions → 8, and
proven non-vacuous (the directive regexes fire on the paid set, 1/2/2, and are clean on the free
set, 0/0/0). The `"(£497 value)"` worked example was placeholder-ised — a concrete figure in a
prompt is itself a priming source (§14) — and a property gate now asserts `offerStandard.ts`
contains no currency figure at all.

#### 🔵 TWO FOLLOW-UPS HELD — both are Arfeen's product call, neither is a defect

1. **The null-campaignType default is `course_launch` → `paid`**, i.e. unchanged from today and
   matching all six other generators. Product truth argues free should win, since free is the
   overwhelming majority. It is a **one-line flip** in `DEFAULT_CAMPAIGN_TYPE`. Held deliberately
   rather than smuggled in, and safe to hold because guard 2 protects the page independently.
2. **`challenge` resolves to `paid`** because it maps to `sales_page`. If challenges are usually
   free for ZAP's coaches this is wrong — but changing it also moves the LANDING PAGE, so it is a
   bigger decision than the one-line diff suggests.

### Node 3 — Offer: the research that grounds it

**Six B2C NotebookLM reports are now IN THE REPO at `docs/offer-research/`** (copied from
`~/Downloads` 2026-08-20; originals left in place):

1. Engineering Irresistible B2C Offers for Cold Meta Traffic
2. B2C Offer Engineering — A Step-by-Step Workbook for Wellness, Coaching, and Spiritual Practitioners
3. Ethical Value Stacking & Deception-Free Pricing
4. Compliant Risk Reversal & Guarantees for B2C Offers
5. Psychological Economics — Desire, Status, Identity, and Ethical Urgency
6. The Anatomy of Offer Naming Failures

📌 The **distilled standard** lives in the Claude project as `claude/ZAP_Offer_Standard.md` and is
**not in the repo**. Banking it is a pending action below.

#### 🔑 PRODUCT TRUTH — THE OFFER CONVERTS TO A FREE NEXT STEP

**In almost every case the offer's next step is FREE** — a free webinar, training, book, report or
lead magnet. **High-ticket is sold LATER, off-page**, after that free step. The offer is therefore
*"come to this free event and you get X, Y, Z"* — not a priced package with a stack slide.

An optional **operator tripwire ($10–100) is DEFERRED**: the landing page is not geared for it.

⚠️ **This reframes the whole node.** The offer schema carries `pricing`, `guarantee`, `bonuses` and
`urgency` — fields shaped for a paid sale. Whether they are even *used* on the free path is the
first thing the pending trace has to answer. Do not rebuild against a paid-offer standard.

#### ⚠️ TWO OF THE SIX REPORTS DRIFTED INTO B2B — STRIP THE EXAMPLES, KEEP THE FRAMEWORKS

**Psychological Economics** and **Ethical Value Stacking** carry B2B examples — **Avian, Nexius,
POLRI, SME**. The frameworks transfer; those examples do not and must be stripped rather than
translated. Same discipline the `docs/icp-research/` README applies to its own B2B/RevOps framing.

#### HELD, unbanked — the Offer value-equation input widening

Proposed and NOT built: feed the ICP's `hopesDreams` (Dream Outcome) plus `pains` and `fears` (the
cost of inaction) into the offer prompt, which today reads only `objections`, `buyingTriggers`,
`implementationBarriers` and `successMetrics` — four fields, none of them the equation's own inputs.
**This folds into the rebuild rather than shipping separately.**

📌 If it is ever revived standalone, it carries a mandatory companion rule: the customer profile is
evidence about the BUYER and never a source of offer facts. Phase A means ICP `pains` now legitimately
contains the coach's own currency figures, and `detectInventedCurrencyAmounts`
(`_core/validator.ts:1326`) flags **every** `£\d+` when no price is supplied.

#### Guarantee-from-intake — DECIDED, option 3, LOW priority

**Capture the guarantee at intake** (with safe templates the coach affirmatively opts into) **and
stop the landing page inventing one when they decline.** Both halves, or it delivers nothing: the
decline branch must show no guarantee, or an intake step has been added and the page still promises
a refund the coach never agreed to.

🔵 **LOW priority — because offers are mostly FREE**, so a guarantee rarely applies.

- 🔴 **`services.riskReversal` is NOT a valid source.** It is AI-generated at the service node
  (`routers/services.ts:196, 319`), stored under a column commented *"Guarantee suggestion."*
  Grounding a real refund obligation in the model's own invention is the same problem wearing a
  field name. It may become a *suggested default the coach opts into* — never a silent fallback.
- 🔴 **Resolve the `groundingCorpus.ts:158` drift in that pass** — it reads
  `guaranteeType ?? riskReversal ?? null`, so the validator already believes a guarantee was
  supplied when only the AI suggestion exists, while the generator does not. Two definitions of
  "supplied" in two files.

### Node 4 — Unique Method: ✅ SHIPPED, LIVE on prod, and PROVEN

**Four commits, all deployed** — `bf4bdc5` (migration 0104), `dbce424` (server rebuild), `b54522b`
(the Zappy walkthrough surface), and `f5be0b0` (the `truncateAtSentence` fix that unblocked the
cascade the rebuild depends on). `origin/railway-build` = `f5be0b0`, Railway green.

**Three tiers, ONE source-agnostic extractor** (`server/_core/methodExtractor.ts`). Tier 1 is a
stored `coachMethods` row from the guided Zappy conversation (`server/routers/methods.ts` +
`client/src/v2/components/V2MethodWalkthrough.tsx`). Tier 2 mines the same extractor over service +
`sourceOfTruth` material. Tier 3 is a guarded fallback governed by `validateMechanismName()`, and
it is reached only when the first two genuinely produce nothing. The brain never learns whether a
human was typing — chat turns become `RawMaterial[]` at the router boundary and nowhere below it.

#### ✅ TIER 1 VALIDATED ON PROD — 2026-08-21, and this is the part that was never proven before

Driven through the **real router procedures** (`walkthroughTurn` → `walkthroughTurn` → `saveMethod`
via `methodsRouter.createCaller({user:{id:1613}})`, HTTP auth bypassed and nothing else), on test
service 233, with an authored realistic coaching method — one client, first / then / then, in the
voice a coach actually answers in.

**A real method produces a genuinely more grounded mechanism than either the old baseline or the
tier-3 fallback.** The evidence, not the impression:

- **7 of 7 evidence fragments were verbatim substrings of the coach's own words** — checked
  mechanically after case/punctuation normalisation, not by eye. Zero fabricated citations.
- **`operationalTwist` was correctly caught as `kind: "sequence"`** — the ordering claim ("blocks
  all talk of what you want until two weeks of behavioural evidence exists") is the real
  differentiator, and it was identified as the twist rather than flattened into a step.
- **`ump`/`ums` came back a matched pair, both written as properties of the APPROACH**, not of the
  reader — which is the standard's hardest requirement to hold.
- Names moved from interchangeable niche nouns ("The Sector Translation Audit", "Cross-Sector
  Positioning Audit") to named operations that trace 1:1 onto the extracted steps ("Conditions
  Audit Before Career Conversation", "Real-Money Test Before Resignation").

**The foundation is solid enough to build the downstream nodes on.** That was the open question;
it is now answered.

#### The cascade fix the rebuild depended on — `f5be0b0`, measured

`truncateAtSentence` (`server/_core/cascadeContext.ts`) ran `/[.!?]\s/.exec()` **without the `g`
flag**, so it always cut at the FIRST sentence and the character cap barely mattered. Pre-existing
since `0002071`; inherited when `dbce424` raised the mechanism cap 250 → 900, which is why that
raise carried far less than intended. Fixed to take the LAST boundary within the cap; hard-cut at
cap when no boundary fits.

Measured on 60 production rows (services 233 + 2, avg description 1,137 chars): mechanism
descriptions now carry **~57% downstream, up from ~16%** (on the new `sourceTier` rows,
60.2% up from 16.3%). `hvcoTopic` at its 300 cap is **effectively unchanged** — 399 of the 400 most
recent rows are byte-identical, since no live row exceeds the cap. New test
`server/_core/cascadeContext.truncate.test.ts` (9 tests) covers multi-sentence carry at both caps
and every unchanged case; `truncateAtSentence` is exported so the test exercises the real function
rather than a copy.

#### 🧹 TEST DATA CLEANED UP — 2026-08-21, both services restored to pre-test state

Nothing of ours is left on prod. `heroMechanisms` back to **1095 rows, max id 1195**; `coachMethods`
**empty**; kit 152's `selectedMechanismId` restored to **712** ("The Sector Translation Audit" — the
mechanism its downstream assets were actually built against, recovered from the kit's persisted
trail transcript, not guessed); kit 221 removed entirely, since it was created by the test's own
auto-select two seconds after the rows it pointed at. 45 mechanism rows, 1 method row and 1 kit row
deleted; service 233 keeps its original 712-726 and service 2 its March set.

⚠️ `users.heroMechanismGeneratedCount` was left at 3 on both test accounts (1613, 1254)
**deliberately** — the pre-test values are inferred rather than recovered, and it is a quota counter
on test accounts. Repo untouched throughout at `f5be0b0`; the driver scripts live in the scratchpad,
outside the repo.

#### 📌 NODE 4 FINISHING BACKLOG — PARKED for a pre-launch pass. None of it blocks the next node

1. **The durable walkthrough entry point — DESIGNED, NOT BUILT.** As shipped, the "Tell Zappy how
   I work" chip (`V2Trail.tsx:509`) is transient, auto-path-only, never persisted, and has no
   return-visit surface — the auto driver does not block on chips, so the next node's reveal
   collapses it within about thirty seconds, and `runManualLoop` never offers it at all. **In
   practice it is unreachable, which is why `coachMethods` is empty.** The design: a permanent
   button in the Campaign Kit's Unique Method section (`V2CampaignKit.tsx`, inside `AssetSection`,
   which already receives `serviceId`/`kitId`/`navigate`), opening the **currently dead-code
   standalone `V2MethodWalkthrough` render** in the modal shell this file already uses for
   `V2QuizReviewModal`. `onSaved` from the Kit **captures only** — it refetches, closes, and offers
   an explicit "rebuild from this?" that routes to the existing `?node=uniqueMethod&action=swap`
   path. It must **never** silently regenerate a locked node. No server change, no migration.
2. **Naming — 2 of 5 still jargon.** "Condition-First Sector Mapping Process" is barely
   distinguishable from the tier-3 fallback it replaced. The scoring engine picks one, so *which*
   lands matters more than the batch average.
3. **Descriptions read as consultant prose** — ~1,200 characters of analytical register, nothing
   like the voice of the coach who said "if nobody has paid for it, it's a daydream." This is the
   shared copy-readability/register standard, not a Node 4 defect.
4. **Hide `beast_mode` / `headline_ideas`.** Both tabs ignore the method (their names came back
   unchanged in character even carrying the `coach_stated` stamp), and neither can be selected into
   the cascade — but the coach still sees them.
5. **The walkthrough's substance bar is too low.** `hasSubstance` went true after ONE substantive
   answer, so the session closed before asking for the coach's second real move; a step got
   salvaged from the optional differentiator beat instead. Ending on substance rather than a field
   count is right in principle — the bar is what needs raising.
6. **Two extractor wrinkles.** `oldVehicle` was filled with the client's *background* rather than a
   failed prior approach, and one description illustrated with a number ("two layers of sign-off")
   that the coach never said (they said four). Framed as an example, so not a fabrication in the
   anti-fabrication sense — but worth watching.
7. **Compliance.** The new copy trips the persistence gate on multiple classes; the publish gate
   holds, so nothing unsafe ships, but the copy is not compliance-clean. **Compare the hit rate
   against the old generator before calling this launch-ready.**

### Research method — STANDING, use this for every node

1. The assistant gives a **~2,000-character seed prompt** for an **empty NotebookLM notebook** —
   the seed contains **no questions**.
2. Then the necessary questions, **each annotated with its report length**, and each marked
   **"generate in Studio."**

### Strategy docs live in the Claude project, NOT the repo

`ZAP_Node_Research_Coverage_Map` · `ZAP_Research_Workflow` · `ZAP_Offer_Standard`.
⚠️ `ZAP_Offer_Standard_Translated` is **OBSOLETE** — do not read it.

### 📌 PENDING NEXT ACTIONS — in this order

1. ✅ **DONE — the read-only funnel trace.** The free-vs-paid + event-type choice lives at intake as
   the campaign-type chip ("What are you inviting people to?", `V2TrailIntake.tsx`), persisted to
   `campaignKits.campaignType` and derived to `pageType`. **Node 5 (HVCO/"Lead Magnet") is already
   the free-next-step node** and is campaign-type-aware for all 7 types — only `lead_magnet`
   campaigns get a downloadable body. The offer's paid schema was dormant in the free page's
   TEMPLATES (they never bind `guarantee`/`price`) but live in the PROMPT via `describeOffer`,
   and live coach-facing on the kit card and exports.
2. ✅ **DONE — the Offer README + standard banked** at `docs/offer-research/README.md`.
3. ✅ **DONE — the Offer node rebuilt** for the free-event offer. See above.
4. ✅ **DONE — Node 4 Unique Method** researched, rebuilt, deployed and tier-1-proven. See above.
5. **NEXT — THE LEAD MAGNET NODE.** Start by **reconciling Arfeen's existing lead-magnet research
   (in `~/Downloads`) against a B2C lead-magnet standard**, then seed NotebookLM **only for the
   gaps that reconciliation exposes**. Do not commission fresh research over work already done —
   that is the exact mistake the off-repo finding above exists to prevent.
6. **After that** — the two held Offer follow-ups (null-default flip; `challenge` remap), then the
   two genuinely uncommissioned nodes: **Email · WhatsApp**. Landing Page research exists OFF-REPO
   and needs banking first.
   ⚠️ `whatsappSequenceGenerator.ts:206` cites a *"WhatsApp wire research report"* that exists
   **nowhere** — not in the repo, not in Downloads.

---

## 0-ICP. ✅ NODE 2 ICP — PHASE A DONE 2026-08-19, local only. Phase B scoped, NOT started

**The node was not merely thin — it was starving on inputs it already held.** The coach types ~25
fields about their buyer at Node 1; `ICP_USER_PROMPT` interpolated **five** of them. Both live
routers already `.select()` the whole `services` row and pass it whole, so `painPoints`,
`failedSolutions`, `hiddenReasons`, `falseBeliefsVsRealReasons` and `whyProblemExists` were sitting
in the object at the call site and being ignored. The model was inventing buyer psychology the coach
had already written down.

### What shipped — output shape BYTE-UNCHANGED, so nothing downstream moved

`ICP_TEXT_SECTION_KEYS` and `ICP_JSON_SCHEMA` are untouched: 14 string fields, `strict: true`, one
persona. **No migration, no DB change, and not one of the 13 downstream generators was edited** —
they read the same fields with the same types and simply receive better material.

1. **Input widening.** Seven optional buyer-intel fields on `ICPServiceInput`, rendered by
   `buildBuyerIntelBlock`. `uniqueMechanismSuggestion` is deliberately EXCLUDED — it describes the
   solution, Node 4 generates the method, and feeding it here produces an ICP that assumes the buyer
   already knows the mechanism (R3's "Aspirational Fantasy").
2. **Prompt raised to `docs/icp-research/`** — awareness stage, market sophistication, prior
   attempts, identity/JTBD, and an explicit anti-breadth exclusion instruction, as a CALIBRATE block
   that adds NO sections. Only the transferable psychological + anti-fabrication halves were ported;
   the B2B/RevOps machinery (firmographics, buying committees, territory ops) was left out, per that
   folder's own README.
3. **PAINS in the first person**, matching fears / objections / buying triggers — one profile, one
   voice. Measured on the same row: **0/9 first-person bullets before the fix, 9/9 after**, against
   the old path's 9/9.

🔑 **THE ONE LIST IS THE LOAD-BEARING PART.** `ICP_BUYER_INTEL_FIELDS` is read by BOTH
`buildBuyerIntelBlock` (the prompt) and `buildIcpInputCorpus` (the grounding corpus). Widening the
prompt alone would have been actively harmful: the model repeats the coach's own words, and the
validator — still reading a 5-field corpus — reports them as content the coach never supplied.
**This is the FIFTH instance of the drift shape §0 tells you to watch for** (two representations of
the same thing kept in parallel), and it is closed by construction rather than by discipline.

⚠️ **A CORRECTION MADE IN-FLIGHT, KEPT BECAUSE THE REASONING WAS WRONG BEFORE IT WAS RIGHT.** The
proposal claimed the corpus widening prevents BURNED RETRIES via `icp_named_third_party`. It does
not. That check scans **`influencers` and `mediaConsumption` only** — both retired 2026-07-26 — so
it cannot fire on a generated profile at all. The class that actually reads generated fields is
**`icp_assumed_prior_evaluation`** on `objections` / `buyingTriggers`, and it is `retryable: false`.
So the widening prevents **mislabelled hits, not burned retries** — and it matters MORE than first
argued, because the new PRIOR ATTEMPTS instruction makes the model likelier to write exactly the
"already tried" phrasing that check matches. Both facts are now pinned by tests, one of which exists
purely as executable documentation so the same wrong inference is not drawn twice.

### Proven on a real row, read-only

A/B on **service 209** (yoga-teacher coaching, all seven intel fields populated), old path run in a
genuine detached worktree of the previous commit — real unmodified code, not a simulation. Grounding
hits **0 both sides**, attempts **1 both sides**. The new output is built out of the coach's actual
intel (the failed nine-member launch, the Kajabi subscription, the physio comparison, the January
reset) where the old was well-written but generic. `server/scripts/ab-icp-phaseA.ts` is the harness —
**no database access**, service row read from a JSON file captured read-only beforehand.

📌 **The LLM is non-deterministic and the specifics MOVE BETWEEN SECTIONS run to run.** The £12 class
price appeared in one run and not the next; the nine-member launch landed in PAINS once and in
FEARS/OBJECTIONS the next time. Judge the voice and the grounding as stable — never treat an
individual phrase as guaranteed, and do not diagnose a regression from one missing detail.

### 📅 SCHEDULED — NOT STARTED — Phase B: multi-persona, and it is NEW BUILD not a connection

**Single-persona is enforced by the schema, not by the prompt.** `campaignKits.icpId` is a single
`notNull` int, and `ICP_JSON_SCHEMA` returns one object. Phase B carries a MIGRATION, so it travels
alone (CLAUDE.md §6).

- **Unpin persona.** `conceptGenerator.ts` sets `personaLabel` once from the ICP (`angleName || name`)
  and stamps it on every concept; `pdafGate.ts` excludes persona from `MOVABLE_AXES` and says so
  explicitly: widening it *"needs ICP-level work, not a gate change."*
- **Make P and D addressable.** Today both are newline-joined bullet prose in one text column, so
  nothing downstream can select a single desire. The spine cannot vary an axis it cannot address.
- **Revive the segment machinery.** `routers/icpAngleSuggestions.ts` already generates **10 genuinely
  distinct segments** with sharp anti-generic rules, runs through the same grounded runner, and is
  mounted on the tRPC router — but its ONLY caller is V1 legacy onboarding
  (`pages/OnboardingPage.tsx`, behind `isLegacyOpen`). It is built and unreachable.
- 🔑 **Why Phase A had to come first:** the build spec §8a arithmetic — with P and D pinned, 127 of
  300 headline pairs collapse (42.3%, matching the live measurement exactly) and *"the floor cannot
  go below that."* Multiple personas only pay off once each persona is individually strong.

### 📌 OPEN QUESTION — `values` and `decisionMaking` are generated and read by NOBODY

Both are generated, compliance-filtered, stored, surfaced in the UI tabs and the campaign export, and
read by **zero** downstream generators — measured across all 13. Either wire them in or retire them
the way demographics / mediaConsumption / influencers were on 2026-07-26. Not urgent; recorded so the
next person measures rather than assumes.

---

## 0-SAFE. SAFE-TO-RUN CHECKLIST — items 1–2 DONE 2026-08-19, items 3–5 open

### ✅ ITEM 1 — the bonus teardown is fenced at the predicate

`server/scripts/e2e-bonus-teardown.ts` deleted **`WHERE userId = <smoke user>` with no service
condition**. Its four identity guards prove WHICH USER and say nothing about WHICH SERVICE — and
that user is **117174, which legitimately OWNS protected services 272–277**. The script's own
docblock claimed it was *"STRUCTURALLY INCAPABLE of touching a real coach's content"*, which is true
and is **the wrong invariant**: it was fully capable of reaching the protected FIXTURES, because the
fixtures belong to the account it targets. Exactly the shape §10 forbids.

📌 **MEASURED READ-ONLY BEFORE FIXING, and the diagnostic changed the severity, not the fix.**
Controls first, so an empty result could not be mistaken for a broken query:

| query | result |
|---|---|
| total `bonuses` rows (control) | **6** — pipeline proven to fire |
| owner of all bonuses (control) | **user 1**, all 6 |
| **`serviceId, COUNT(*) WHERE userId=117174`** | **ZERO ROWS** |
| owners of protected services (control) | 272–277 → **117174** · **285 → user 1** |
| bonuses on any protected service, any owner | **285 → user 1 → 3 rows** |

🔑 **So this closed a LATENT hole, not active damage** — the unfenced delete had never actually
removed a protected row, because 117174 holds none today. It is one smoke run away from mattering:
the moment a run generates a bonus on 272–277, the NEXT teardown would have taken it.
⚠️ **Service 285 is owned by user 1, NOT 117174** — a correction to earlier prose that lumped all
seven together. Its 3 bonus rows are outside this script's reach entirely, and they are the proof
that protected services do carry sweepable child rows in the ordinary course.

**The fix is in the PREDICATE, not a guard around it** — `WHERE userId = ? AND (serviceId IS NULL OR
serviceId NOT IN (...))`, built once and used by BOTH the SELECT and the DELETE. Fencing only the
DELETE would destroy a protected row's KV page and PDF and then leave its DB row pointing at them.

⚠️ **THE `isNull` ARM IS LOAD-BEARING, NOT DEFENSIVE PADDING.** `bonuses.serviceId` is NULLABLE and
`NULL NOT IN (...)` evaluates to **NULL, not TRUE** — so a bare `notInArray` would have silently
STOPPED deleting every NULL-service row, orphaning its hosted assets while still reporting success.
CLAUDE.md §9 in the wild.

### ✅ ITEM 2 — the daily-budget floor is currency-aware, and it runs before any Meta write

**The gap.** `z.number().min(1)` on the coach-facing router assumed USD. The account bills **AED**
and `createAdSet` sends `Math.round(budget * 100)` minor units (`lib/metaAPI.ts:509, 606, 922`), so
a coach could pass a number the router accepted and Meta refused. The floor logic already existed
and was proven — `assertDailyBudgetFloor` / `MIN_DAILY_BUDGET_AED` / `PINNED_DAILY_BUDGET_AED` in
`metaSafety.ts` — **it was simply never wired to the router.** This was wiring plus a currency
lookup. No migration, no DB write.

**What shipped.**

- `metaSafety.ts` gains **`MEASURED_DAILY_BUDGET_FLOORS`** (AED → `MIN_DAILY_BUDGET_AED` = 4) and
  **`UNMEASURED_CURRENCY_FLOOR` = 1**, behind a new `checkDailyBudgetFloor(budget, currency)`.
- `assertDailyBudgetFloor` — the **harness** entry — now delegates to it with a literal `"AED"`, so
  its behaviour is unchanged. `metaSafety.test.ts` stays at **19 passed**, byte-identical AED path.
- `routers/meta.ts` gains `assertDailyBudgetForAccount`, wired at **all three** publish/update
  sites — `publishAssembledAds`, `publishToMeta`, and **`updateCampaign`**. It runs **in the
  handler, before any Meta write**, not as a Zod refinement.
- `budgetFloorCurrency.test.ts` — **21 tests**, new.

🔑 **THE FLOOR OF 1 FOR AN UNMEASURED CURRENCY IS DELIBERATE, NOT A PLACEHOLDER.** We have measured
Meta's real minimum for exactly one currency. Inventing thresholds for the rest would block coaches
on numbers we made up, and the failure would look like our bug rather than Meta's rule. **Meta stays
the real gate**; our floor only catches what we have actually measured. Adding a currency is one
line in `MEASURED_DAILY_BUDGET_FLOORS`.

⚠️ **FAIL-OPEN ON CURRENCY-LOOKUP FAILURE IS ALSO DELIBERATE.** If the account currency cannot be
read, the publish proceeds. A safety check that cannot determine its own input must not become a new
outage path — an unknown currency and a failed lookup are the same state, and Meta will still refuse
a genuinely bad budget. 📌 The lookup costs one live Graph read per publish; caching it on
`meta_access_tokens` is scheduled below and needs a migration, so it travels alone.

### 🔴 ITEMS 3–5 STILL OPEN — scoped 2026-08-19, none started

3. 🔴 **`ANTHROPIC_API_KEY` rotation — PURE OPS, zero repo changes.** Full surface mapped: the only
   production read is `_core/env.ts:15`; `_core/llm.ts` consumes it; five standalone scripts read
   `process.env` directly. **No hardcoded key anywhere, `.env` gitignored and untracked, nothing
   logs it.** ⚠️ **TRAP: `llm.ts` falls back to `BUILT_IN_FORGE_API_KEY`.** If that is set on prod,
   a dead Anthropic key will NOT announce itself — generation keeps working on the other provider
   and the rotation looks fine while nothing uses the new key.
4. **Crashed-job reaper.** `reapStuckJobs` (`_core/index.ts:61`) filters `status='pending'` ONLY, so
   a `running` job whose process dies stays `running` forever. ⚠️ **Worse than recorded: there is NO
   `updatedAt` column on `jobs`** — only `created_at` — so "stuck" cannot be measured from last
   progress, which is what the tell actually requires. **Needs a MIGRATION, so it travels alone.**
5. **Monitoring.** No Sentry / Datadog / structured-logging dependency at all; observability is
   `console.*` into block-buffered Railway logs. No low-balance pre-flight on Anthropic, which has
   taken a run down twice. **Needs a buy-vs-build decision before scoping.**

---

## 0-N5. ✅ NODE 5 BODY + BONUSES SCREENING — DONE 2026-08-19, local only

**The premise going in was wrong, and the investigation is what corrected it.** Node 5 was recorded
as sitting OUTSIDE the gate. It mostly was not: bonuses screen at `bonusGenerator.ts`, the quiz
regenerate screens at `routers/hvco.ts`, and the bonus PDF screens at `bonusPdfGenerator.ts`.

🔴 **THE ACTUAL GAP WAS ONE WRITE PATH — AND IT WAS THE CASCADE.** `hvcoTitles.assetBody` has three
writers; two screened and `_core/orchestration.ts` did not. That is the path every coach hits in a
normal run, so the unguarded one was the only one that mattered. **One field, three writers, one
unguarded — the drift shape this repo keeps producing.** Now closed.

### 🔑 THE SECOND GAP WAS INVISIBLE, AND IT IS THE MORE IMPORTANT ONE

`copyFieldsOfJson` stopped at **depth 4**. A quiz band's CTA lives at
`assetBody.scoring.bands[i].cta.body` — **depth 5** — so it was extracted by nothing and screened by
nobody **even on the paths that were already screened**. Measured by planting a flagrant claim
there: **8 fields extracted, 0 blocking hits.** Cap raised to 6 (a runaway guard, never a coverage
decision — the deep-nesting test pins that it still terminates).

**Depth-cap delta, measured both sides on shapes built to the real interfaces:**

| shape | before (cap 4) | after (cap 6) |
|---|---|---|
| **quiz** | 8 fields · **0 blocking** | **13 fields · 2 blocking** |
| toolkit | 7 · 0 | 7 · 0 — unchanged |
| guide | 5 · 0 | 5 · 0 — unchanged |
| emails | 3 · 0 | 3 · 0 — unchanged |

**The cap only ever bit the quiz shape.** Both new hits land on the SAME planted field — zero new
false positives. ⚠️ **These are real-interface shapes, NOT stored production rows.** It proves which
fields the cap hid and that the hidden one is screened now; it does not say how often a real quiz
puts a claim there.

### ✅ DECISION 2 RESOLVED — **NO NEW ROLE.** The existing enforcement narrowing already covers it

The plan called for a dedicated `FieldRole` letting a quiz band address the reader diagnostically.
**Measured first, and it is not needed.** Under the ordinary `"body"` role, 8 of 9 realistic band
diagnostics already pass — blunt ones and tarot/yoga phrasings included — because the tier-1 rule
requires an **ENUMERATED** attribute and *"you are still pricing by the hour"* names none.
Diagnostic address about a non-enumerated topic is tier 2 and never blocks. That is the 2026-07-27
enforcement narrowing doing this job already.

🔴 **A ROLE WOULD HAVE COST SAFETY.** Suppressing attribute checks there would suppress exactly the
vulnerable-financial-status and burnout cases that must keep blocking — on the surface most tempted
to over-claim. All of it is pinned by test, so if a future change makes a band block, **fix the
change, not the role.**

📌 The one case that did block — *"you are exhausted by the end of every week"* — is **not** a
`condition`-style sense collision. That is the fatigue sense, the sense the rule targets, sitting
beside `burnout` in the vocabulary. Copy fix, not mechanism fix.

### ⚠️ SCREENING HERE IS ADVISORY, DELIBERATELY — DO NOT CONVERT IT TO A GATE

`screenLeadMagnetBody` screens, logs and returns. **It never throws and never blanks a field.**
Blanking a coach's deliverable is worse than shipping copy they can edit, and publish remains the
hard stop. Converting this to a blocking gate needs Arfeen's word.

### What shipped

| file | what |
|---|---|
| **NEW** `_core/persistenceGate.ts` → `screenLeadMagnetBody` | ONE screen for the body. All three writers route through it, so a FOURTH writer cannot silently go unguarded — pinned by a test asserting none of them hand-rolls the extraction |
| `_core/persistenceGate.ts` | depth cap 4 → 6 · `derivedFromObstacle` added to `NON_COPY_KEYS` |
| `_core/orchestration.ts` | **the gap** — the cascade now screens before the `assetBody` write |
| `leadMagnetContentGenerator.ts` | **`GUARANTEE_CLAIMS_RULE` PORTED AS-IS** into both prompt modes — Track B reuse, not re-derived. Every format closes on a `nextStep` bridge and a quiz adds per-band CTAs: the same "what you will get" position that produced the landing page's outcome promise |
| `routers/hvco.ts` · `bonusPdfGenerator.ts` | existing screens moved onto the shared helper |
| **NEW** `_core/node5Screening.test.ts` | **16 tests**, written first, red on 5 |

📌 **`derivedFromObstacle` is EXEMPT, and it was verified before exempting, not assumed.** Zero
references in `client/`; `routers/bonuses.ts` uses an explicit column list that omits it;
`emailSequenceGenerator`'s bare `select()` reads only `title` and `shortLine`; no publisher or
renderer touches it. It restates the READER'S PROBLEM, so screening it as coach-facing copy gated
our own working notes. Its one live use is an LLM prompt input, and everything generated from it is
screened downstream.

---

## 0-DEC. DECISIONS FINALISED 2026-08-14, Decision 1 REFINED 2026-08-15 — LOCKED, neither is built

### ✅ DECISION 1 — the FAQ fix is CONSTRAINED GENERATION. Not a template, not free generation.

**The rejected option was a fixed FAQ**, and the reason it is rejected is the audience. 🔑 **ZAP's
users are broad and diverse — coaches, consultants and agencies, but also tarot readers,
astrologers, yoga instructors and other service niches.** A single hardcoded FAQ cannot fit that
range: copy written for a retainer consultant is wrong for a tarot reader, and copy general enough
for both says nothing. **So the FAQ stays GENERATED.** What changes is that the generator is made
structurally unable to produce the risky phrasing in the first place, through **three layers**:

1. **A fixed, vetted set of the universal objection QUESTIONS.** The questions are the part that
   genuinely is common across every niche — price, time, "will this work for me", what happens if it
   does not. Those are stable; the answers are not.
2. **Hard niche-agnostic guardrails in the generation prompt.** ⚠️ **REFINED 2026-08-15 — see the
   allowed/forbidden split below. The blanket ban on the word `guaranteed` recorded here is
   WITHDRAWN**, because a refund guarantee is both compliant and commercially load-bearing. What is
   forbidden is the OUTCOME guarantee, not the word.
3. **The compliance gate as the BACKSTOP.** Third layer, not first. It catches what leaks; it is not
   the mechanism that makes the copy safe.

#### ✅ THE GUARANTEE SPLIT — SETTLED 2026-08-15. Keep the guarantee; make it compliant.

**The guarantee stays auto-generated. It is not deleted and not made optional.** What changes is
WHICH KIND of guarantee the prompt is allowed to produce. The line is between a promise about the
TRANSACTION (safe) and a promise about the RESULT (not safe).

| | |
|---|---|
| ✅ **ALLOWED** | refund · money-back · satisfaction · service guarantees — **including "or you don't pay"** — framed as **what the customer GETS or GETS BACK** |
| 🔴 **FORBIDDEN** | **outcome or results guarantees** — `"results-oriented"`, `"specific results and timeframe"`, `"you will [outcome]"`, `"until it does"` — and **cure or health claims** |

🔑 **Written NICHE-AGNOSTICALLY.** The audience spans tarot readers, astrologers and yoga
instructors as well as coaches and consultants, so the rule must constrain a tarot reader's FAQ as
tightly as a retainer consultant's. A guardrail phrased in consulting vocabulary fails silently on
half the user base.

📌 **DEFERRED TO TRACK B, Offer node.** The deeper fix is to SOURCE the guarantee from the coach's
actual offer rather than have the model invent one. That is an upstream change to the Offer node and
does not belong in this pass — the landing page cannot ground a guarantee the offer never captured.

⚠️ **THEREFORE THE IMMEDIATE `"until it does"` FIX IS A GENERATION-PROMPT GUARDRAIL, WRITTEN
NICHE-AGNOSTICALLY — NOT A ONE-STRING TEMPLATE EDIT.** Editing that single sentence would fix one
page and leave every future generation free to write it again, in whatever niche's vocabulary. The
guardrail must be phrased so it constrains a tarot reader's FAQ as tightly as a consultant's.

📌 Note the layering deliberately mirrors the compliance work just banked: the gate is the last
line, never the design.

### ✅ DECISION 2 — NO AD IMAGE MAY SHIP WITHOUT TEXT. The blank hook band is a DEFECT.

**Creative 497 rendered with no hook band at all** — `hookAdCopyId` NULL, the short-deck branch
firing live for the first time on the 2026-08-12 run. **That branch is a defect, not a style.**

**The fix is to GUARANTEE A HOOK FOR EVERY IMAGE**, not to render a clean band and move on. An ad
image with no text is not a quieter ad; it is an ad missing the surface Meta's OCR reads, on the
one surface `dealHooksByConcept` was built to keep distinct.

🔑 **This ties directly into the 4 → 8 cardinality work** (§0a items 1 and 2): the hook surface is
already the binding constraint at four slots — it landed at **3 hooks against 4 slots on three
independent runs** — so growing the deck to eight makes the shortfall worse unless hook supply
grows with it. "Ship with no line rather than a repeated one" was the right call **only while a
blank band was considered acceptable. It no longer is**, so the shortfall must be solved at supply.

⚠️ **THE BLANK-BAND ACCEPTABILITY QUESTION IS CLOSED.** §0a item 2's open half is settled, and the
pixel verdict on 497 is **MOOT** — the decision was taken without needing it.

---

## 0-READ. ✅ THE READ-ONLY PASS IS DONE — 2026-08-15. Both questions answered, nothing changed.

### ✅ FINDING 1 — THE FAQ IS LLM-GENERATED. THERE IS NO TEMPLATE TO EDIT.

**The fix is a generation-prompt change, confirmed at the source.** The FAQ is free-form model
output from the single large prompt built by **`generateLandingPageAngle()`** in
**`server/landingPageGenerator.ts`** (function at `:395`, prompt template `:445-533`), landing in the
schema at `:622`.

🔑 **PROVEN NOT A TEMPLATE, not assumed.** A repo-wide grep for `at no additional cost`,
`until it does` and `work with you` returns **zero hits in any generator, template or constant**.
The only hits are `tools/redteam-baseline/**/results.json` — recorded model OUTPUT from the May
red-team runs — and two test fixtures. **The sentence exists nowhere in source.**

#### THREE LAYERS OF THAT PROMPT DRIVE THE OUTCOME-GUARANTEE PHRASING — all three must be reshaped

| # | location | what it does |
|---|---|---|
| 1 | **`:520-521`** — the FAQ instruction | directs the model at **"guarantee details"** and asks for answers that are **"reassuring"**. Proximate cause: points at remedy language, then asks for comfort |
| 2 | **`:523-524`** — the dedicated Guarantee section | *"Write a dedicated **risk-reversal** guarantee section… write a **results-oriented satisfaction guarantee**… **Frame positively — what the customer gets, not what they lose**"*. "Results-oriented" is close to a direct instruction to promise an outcome |
| 3 | **`:31-79`** — `ANGLE_PROMPTS` | the ACTIVE angle `original` lists **`- Specific results and timeframe`** and **`- Guarantee included`** (`:36-39`). `godfather` is stronger: **`- Money-back guarantee`**, **`- "Or you don't pay"`**, and `Key phrase: Emphasize "Or you don't pay" throughout the copy` (`:47-53`) |

⚠️ **A rule added to layer 1 alone would still be fighting layer 2's "results-oriented" and layer
3's "Specific results and timeframe" upstream of it.** That is why the build touches all three.

#### 🔑 WHY IT SURVIVES TO THE PAGE — the coverage gap, now confirmed at the source

The generation-time compliance gate at **`:769-774`** screens **exactly 11 fields**:
`eyebrowHeadline` · `mainHeadline` · `subheadline` · `problemAgitation` · `solutionIntro` ·
`whyOldFail` · `uniqueMechanism` · `insiderAdvantages` · `shockingStat` · `timeSavingBenefit` ·
`primaryCta`. **Neither `faq` NOR `guarantee` is among them.** So the FAQ answer is never screened at
generation and only surfaces at the persistence screen. This confirms §0's coverage-gap finding by
reading the code rather than inferring it from hit locations.

### ✅ FINDING 2 — THE UPSTREAM NODE AUDIT IS CLEAN. THE AUGUST TRACK B PLAN HOLDS EXACTLY.

**All seven upstream nodes are UNTOUCHED since early August.** Nothing moved under the plan; a
guardrail written against Node 8 today cannot contradict a prompt that already changed.

| node | prompt file | verdict |
|---|---|---|
| 2 — ICP | `_core/icpPrompts.ts` (+ `icpGenerate` · `icpEnrichment` · `icpGrounding` · `routers/icps.ts`) | **untouched** — last 2026-07-26 / 07-27 |
| 3 — Offer | `offersGenerator.ts` | **untouched** — last `048d67b`, 07-29 |
| 4 — Unique Method | `heroMechanismsGenerator.ts` | **untouched** — last `66a5682`, 07-29 |
| 5 — Lead Magnet | `hvcoGenerator.ts` · `leadMagnetContentGenerator.ts` (+ `bonusGenerator.ts`) | **untouched** — last 07-29 / 07-24 / 07-29 |
| 8 — Landing Page | `landingPageGenerator.ts` | **untouched** — last `489b77b`, 07-29 |
| 9 — Email | `emailSequenceGenerator.ts` | **untouched** — last `e800331`, 07-29 |
| 10 — WhatsApp | `whatsappSequenceGenerator.ts` | **untouched** — last `048d67b`, 07-29 |

**Three independent lines of evidence, including a control:**

1. **Git, checked the strong way.** Not file-by-file — the COMPLETE list of every `server/` file
   touched by any commit since 2026-08-01 runs to 60 files, and **not one of the eight upstream
   generators appears in it.** August work is entirely inside the ad-copy / creative / concept /
   publish cluster.
2. **File contents.** Scanning each for the spine's own vocabulary (`andromeda`, `pdaf`,
   `distinctness`, `awarenessPlan`, `awarenessDeck`, `campaignConcepts`, `conceptId`,
   `personaLabel`) → **0 hits in all eight.** None reads a concept row, carries an awareness stamp,
   or touches the gate.
3. 🔑 **THE CONTROL — the method is shown to DETECT the change it looks for.** Same two tests against
   the nodes that WERE upgraded: `adCopyGenerator.ts` **8 commits / 52 markers** ·
   `_core/pdafGate.ts` 2 / 35 · `conceptGenerator.ts` 5 / 19 · `adCreativesGenerator.ts` 8 / 15 ·
   `headlinesGenerator.ts` 3 / 25. **A null result from a test that never fires proves nothing** —
   this one fires loudly one directory over.

⚠️ **ONE FALSE LEAD, PRE-EMPTED.** `_core/icpPrompts.ts:20` is the ONLY place the word "Andromeda"
appears anywhere upstream, in a comment: *"They are fossils of interest-based Meta targeting.
Andromeda made the…"*. That is the RATIONALE for **removing** demographics / mediaConsumption /
influencers on 2026-07-26 (`6b51372`, Class A retired) — Andromeda cited as a reason to DELETE
fabricated fields, **not the spine being adopted**. Node 2 is untouched. Recorded here so nobody
later greps for "Andromeda", hits that line, and concludes the ICP node was upgraded.

### 📌 THE SAME UNGUARDED GUARANTEE SHAPE EXISTS IN FOUR OTHER GENERATORS

**This guardrail is a REUSABLE PATTERN FOR TRACK B, not a one-node fix.** The Offer, Lead Magnet,
Email and WhatsApp generators write remedy and guarantee language on the same free-form basis, with
no allowed/forbidden split and no screening of those fields. Fixing Node 8 alone leaves four more
surfaces free to write the identical claim. **Do not re-derive the rule when Track B reaches them —
port it.**

---

## 0-FIX. ✅ THE DEAD AD-TO-PAGE GATE IS FIXED IN THE PRODUCT PATH — 2026-08-17, local only

### 🔑 FIRST, THE CORRECTION — WHAT `checkAdToPageMatch` ACTUALLY IS

⚠️ **`checkAdToPageMatch` is a DESTINATION-MATCH check, NOT a page-compliance screen.** This
corrects the wording in `docs/LAUNCH_READINESS_AUDIT.md`, which called it "the ad-to-page
compliance gate" and let it read as though it screened the landing page for blocking claims.
**It does not, and never did.**

Read the implementation (`_core/complianceAxis.ts:1069`): it tokenises the ad text and the page
text, counts shared content words, and raises **one** class — `ad_to_page_mismatch`, tier 1 — when
overlap is **≤ 10%**. It stays silent below a signal floor (`ad.size < 5 || page.size < 15`). That
is Meta's rule that the products and services promoted in an ad must match those on its landing
page, and that Meta reviews the destination. **It says nothing about whether either artefact is
compliant.**

📌 **Page compliance is screened at GENERATION, not here** — `landingPageGenerator.ts:769-774`
(11 fields at generation) plus the `gateBeforePersist` backstop over all four angles. The FAQ
`promised_result` blocker in §0 is a *generation* problem and is untouched by this fix. **Do not
expect this gate to catch it.**

### WHAT WAS BROKEN

Both call sites in `routers/meta.ts` built page text from `(lp as any)?.content` — **a column
`landingPages` does not have** (confirmed against production INFORMATION_SCHEMA; the copy lives in
`originalAngle` / `godfatherAngle` / `freeAngle` / `dollarAngle`, selected by `activeAngle`). The
read was always `undefined`, so `pageText` was always `""` and **`checkAdToPageMatch` never ran on
any publish, for any coach.**

⚠️ **This is NOT the dead gate §0 records as fixed.** That fix landed only in
`scripts/step4c-multiad-publish.ts`. The **product's** path carried the same defect at two sites,
unfixed, on `origin/railway-build` **and** on local HEAD. Fixing the harness did not fix the product.

### WHAT SHIPPED (local only — NOT deployed)

| file | what |
|---|---|
| **NEW** `_core/landingPageActiveAngle.ts` | one derivation of the active angle's page text, mirroring `landingPagePublisher.ts:86-91`. Both `meta.ts` sites now share it instead of carrying copies |
| **NEW** `_core/publishBlockMessage.ts` | per-class refusal wording. `ad_to_page_mismatch` gets its own sentence; **the compliance wording is unchanged and is now scoped to compliance hits only** |
| `routers/meta.ts` | three edits — the import, site 1 (`publishAssembledAds`), site 2 (`publishToMeta`) — plus the throw now calling `buildPublishBlockMessage` |
| **NEW** ×2 test files | **15 tests.** Includes a regression pinning the old `.content` shape to `""`, and a test proving the SAME mismatched pair passed silently before and blocks now |

**Why the coach-facing message changed:** the refusal used ONE message for every class, worded for
the compliance axis (*"it states things about the reader…"*). For a destination mismatch that is
simply wrong and would send a coach to rewrite copy that was never the problem.

### 🔴 WHAT NOW BLOCKS THAT DID NOT BEFORE — exactly one class

**`ad_to_page_mismatch` only.** No new check, no altered threshold, nothing touched in `checkOutput`.
It fires only when ALL hold: `serviceId` present (site 2's whole gate already sits inside that, so
no-serviceId still means no gate at all, unchanged) · an LP row matches `publicUrl` + `userId` · the
active angle has content · ad ≥5 content words and page ≥15 · overlap ≤10%.

**Exposure is low but real.** On the deployed default the body IS the page's subheadline
(`deriveDefaultBody`), so overlap is near-total. With step 1 the copy comes from the gated pool but
is generated from the same ICP and offer. The plausible misfires are a different-language ad, a thin
active angle, or a `linkUrl` pointing at another campaign's page — the last being the case the check
exists to catch.

### 📌 A FIFTH INSTANCE OF THE DRIFT SHAPE — found, named, NOT fixed

"Which column holds which angle" now exists in **five** places: `routers/landingPages.ts:48`,
`routers/complianceRewrites.ts:93`, `landingPagePublisher.ts:86-91` (inline ternary), the 4c harness,
and — until this fix — two broken copies in `meta.ts`. **This is what produced the bug.** The fix
collapses the two `meta.ts` copies onto one helper; **the other four are deliberately untouched** and
are the follow-up. §0 predicted a fifth instance; this is it.

### Gates at this commit

`tsc --noEmit` → **34**, and the per-file distribution matches the 2026-08-12 capture exactly, so it
is the same 34 rather than a swap. Canonical 13-suite gate **573 passed**. 4c safety set **241 passed
across 9 suites**. New tests **15 passed**.

---

## 0-FAQ. 🔴 THE FAQ GUARDRAIL WAS PROPOSED AND **NOT BANKED** — 2026-08-17. The order changed.

**Nothing was written to `landingPageGenerator.ts`. The file is untouched.** The proposal was right
about what the copy should say and **wrong about why the copy was blocking**, and running the
classifier rather than reading its message is what exposed it.

### 🔑 THE MECHANISM IS NOT THE WORD — IT IS A DURATION NEXT TO A BARE "you"

The blocker is `promised_result` at `original.faq[6].answer`. The rule is **`PROMISED_RESULT_RE`,
`_core/complianceAxis.ts:542`**. Its first alternation fires on a **duration phrase within 60
characters of `you` / `results` / `clients` / `revenue` / `leads` / `guarantee` / `promise`** — and
because the suffix in `you(?:'ll| will)?` is OPTIONAL, **bare "you" matches. No outcome verb is
required anywhere in the rule.**

Probed directly against the live sentence, in memory, no database:

```
BLOCK  the live blocker      promised_result :: "within twelve weeks, I will work with you"
```

⚠️ **The word `guaranteed` never enters into it.** The whole premise that the fix is a
no-`guaranteed` rule was mistaken; that rule is good hygiene and would not have stopped this line.

### 🔴 A FIFTH FALSE-POSITIVE FAMILY — it blocks legitimate delivery and refund windows

Same probe, same rule. Both of these are ordinary, compliant copy and **both block**:

| probe text | result |
|---|---|
| *"Our 90-day money-back guarantee: if you are not satisfied within 90 days, you get a full refund."* | 🔴 **BLOCK** — `"within 90 days, you"` |
| *"You get the full workbook within thirty days, and we review it with you on a call."* | 🔴 **BLOCK** — `"within thirty days, and we review it with you"` |
| *"In eight weeks you receive the scope map, the pricing model and the outreach sequence."* | 🔴 **BLOCK** — `"In eight weeks you"` |

**A refund window is not a promised result. A delivery window is not a promised result.** This is a
fifth false-positive family, alongside the four already recorded in §0.

🔴 **AND IT INVERTS THE PROPOSAL.** The brief asked to replace *"Specific results and timeframe"*
with *deliverables plus a timeframe*, and to have the guarantee *name its refund window*. Both of
those instructions **generate copy this rule blocks** — row 2 is a pure deliverable list and row 1
is exactly the compliant guarantee the decision asks for. Written as briefed, the guardrail would
have manufactured new false positives.

### ✅ THE DECISION — FIX THE CLASSIFIER FIRST. DO NOT CONTORT THE GENERATOR.

The proposal carried a **SENTENCE SHAPE** rule telling the model to keep durations and the word
"you" in separate sentences. It works — probe-verified — and it is **rejected**, because it bends
the copy engine around a defect instead of fixing the defect. *"In eight weeks you receive the scope
map"* is good marketing copy and must stay writable.

**In this order, and not another:**

1. ✅ **DONE 2026-08-18 — `PROMISED_RESULT_RE` precision fixed.** The duration alternation now
   requires an OUTCOME element — second person plus an achievement verb, or an explicit result
   noun — rather than a bare `you`. Probe-verified both ways: **23/23 agree with intent, up from
   18/23**; the page-238 corpus blocking baseline held at **1 of 8**, unmoved. Permanent regression
   suite: **`server/_core/promisedResultPrecision.test.ts`, 27 tests**, written before the fix and
   red on 6 of them first.
   🔑 **The load-bearing design point: the distinguishing element is the verb's OBJECT, not the
   verb.** *"you get a full refund"* and *"you get ten new clients"* share a verb, which is why
   `get` and `receive` are deliberately ABSENT from the achievement list and the result nouns carry
   that load. **Do not add them.**
   📌 **A SECOND CONST WAS ADDED, `OPEN_ENDED_REMEDY_RE`, and it is why the live blocker survived.**
   The faq[6] line is not a duration claim — it only ever matched as collateral of the bare-`you`
   defect, on the span `"within twelve weeks, I will work with you"`. Tightening alternation 1 alone
   would have **fixed the live blocker away by accident**, which this section forbids. Modelling it
   as its own shape also made the span honest: it now reports
   `"I will work with you one-to-one at no additional cost until it does"`.
   ⚠️ **It closes a PRE-EXISTING HOLE and so slightly WIDENS blocking**, deliberately and with
   Arfeen's word: *"We will keep coaching you free of charge until you get results"* did not block
   before and does now. Conjunctive, so *"until you are ready"* and *"until the cohort closes"* stay
   clean, both pinned by test.
   ⚠️ **THE PAGE-238 BASELINE IS 8 SENTENCES, NOT 89 FIELDS.** The row was deleted at the 08-12
   teardown, so the full content exists NOWHERE — not in the repo, not in the DB. What is preserved
   is the sentence corpus `11a920a` banked. It pins against regression; it does **not** prove what
   the copy engine writes next run. Re-screen a freshly generated page.
2. ✅ **DONE 2026-08-18 — THE CLEAN FAQ GUARDRAIL IS BANKED.** The **CLAIMS RULE** lives in
   `_core/copywritingRules.ts` as **`GUARANTEE_CLAIMS_RULE`**, wired across all four layers: the
   system prompt beside its sibling rules, the FAQ instruction, the guarantee section, and both
   `ANGLE_PROMPTS` entries (`original` and `godfather`). **The duration-and-`you` separation
   workaround is NOT in it**, deliberately — step 1 removed the need, and shipping it anyway would
   have left a permanent scar from a bug that no longer exists.
   🔑 **THE LOAD-BEARING SENTENCE IS THE BOUNDARY REQUIREMENT** — *every remedy carries the period,
   count or deliverable that closes it; a remedy with no end point is a promise about the reader's
   outcome rather than about the transaction*. That is what kills the open-ended family at the
   source **without naming it**, which matters: CLAUDE.md §14 is explicit that quoting a failure
   shape primes the model to emit it. The rule names the shape the copy TAKES and the category
   outside it, and never quotes the offending sentence.
   📌 **It went in `copywritingRules.ts`, not inline**, because §0-READ records the same unguarded
   shape in the Offer, Lead Magnet, Email and WhatsApp generators. **When Track B reaches them,
   IMPORT IT — do not re-derive it.** Zero instances of the `-ed` form in either file, as required.
   **Generation probe — 4 live landing pages before, 4 after, identical inputs, two niches
   (retainer consultant and TAROT reader), no DB write and nothing persisted:**
   · open-ended outcome-remedy phrasing **1 → 0** · `promised_result` blocking **1 → 0**
   · refund / money-back language **6 → 8 fields**, so the legitimate remedy survived and got MORE
   precise, which is the rule working rather than a gap in it.
   ⚠️ **THE DEFECT REPRODUCED LIVE BEFORE THE FIX, IN THE TAROT NICHE** — the generator wrote
   *"at no extra cost until it does"* unprompted, with no consulting vocabulary anywhere near it.
   That is the empirical case for the niche-agnostic framing, not an argument for it.

3. ✅ **DONE 2026-08-18 — THE `"condition"` SENSE SPLIT, sixth of the scale family.** The guardrail
   surfaced it: asking the generator to state a remedy's TERMS made it write conditions, and
   `"condition"` sat in `PROTECTED_ATTRIBUTE_TERMS` as the medical sense, so
   *"The condition is that you have done the work through week four"* blocked at tier 1 as an
   assertion about the reader's HEALTH. **A pre-existing defect the guardrail walked into, not one
   it caused.**
   🔑 **THE DISCRIMINATOR IS NOT THE DETERMINER.** That is what split the two senses of `"scale"`,
   and copying it here would have failed — the contractual sense takes one too (*"THE condition is
   that"*). The health sense is marked by a **possessive or a medical modifier**; the contractual
   sense by a **complementiser clause** following the noun.
   Not solved by deleting the term, for the same reason the scale fix was not — §1.1 enumerates
   physical and mental health and *"your condition"* is the plainest assertion of it. Removed from
   the bare list, health sense matched positively by `HEALTH_CONDITION_RE`, both reached through
   **one shared matcher, `protectedAttributeMatch`** — the same shape as `bodyProxyMatch`, so the
   list and the guarded term cannot drift. Suite: **`conditionSensePrecision.test.ts`, 14 tests**,
   written before the fix and red on 7 of them first.
   📌 **THE COMBINED RE-SCREEN IS THE RESULT THAT MATTERS.** Re-screening the 32 stored fields from
   the post-guardrail generation run through the fixed classifier — free, no LLM call — returns
   **zero blocking classes**, against `{"promised_result": 1}` on the pre-guardrail run. Guardrail
   plus classifier together take a freshly generated page, in both niches, to clean.

📌 **The FAQ line's own `"until it does"` is a GENUINE outcome promise and stays out of scope of the
classifier fix.** It is handled by the generator's **CLAIMS RULE** in step 2 — *never offer to keep
working at no charge until an outcome arrives*. Step 1 must not "fix" it away: after step 1 that
sentence should still block, and step 2 is what stops it being written.

📌 **Everything else in the proposal survives unchanged** and can be lifted as-is when step 2 runs:
the CLAIMS RULE, the allowed refund / money-back / satisfaction forms, `"or you don't pay"` kept,
the noun-not-adjective rule, and the niche-agnostic framing covering tarot, astrology and yoga as
well as consulting. It was checked to contain **zero instances of the `-ed` form**, and the file
contains none today either — keep it that way.

### NEXT ACTION ON RESUME

**PHASE 1 MOVES TO THE SAFE-TO-RUN CHECKLIST.** The copy-correctness chapter is closed at the
source: promised-result precision, the `"condition"` sense split, the FAQ guardrail and Node 5
screening coverage are all banked. Five items, none of them copy:

1. **The clean-slate wipe** — a repeatable way to reset to a known state before a proving run.
2. **The currency-aware budget validator** — `z.number().min(1)` assumes USD; the ad account is
   **AED** and Meta rejects a budget of 1. §0a item 4 and the pre-launch defect list both carry it.
3. 🔴 **The `ANTHROPIC_API_KEY` ROTATION** — still outstanding, see HOUSEKEEPING directly below.
4. **The crashed-job reaper** — the zombie-job defect: a dead job stays `status='running'` forever
   and the reaper sweeps `'pending'` only. The tell is the last write timestamp, not the status.
5. **Monitoring** — no low-balance guard on the Anthropic key; credit exhaustion has taken a run
   down twice and the only signal was a 400 deep in the log.

⚠️ **NOTHING FROM THIS WHOLE CHAPTER IS DEPLOYED.** `origin/railway-build` is still `51eda78`. The
guardrail changes what the copy engine WRITES, so it buys nothing until it ships — and a push is an
instant production deploy needing a fresh explicit word.

⚠️ **THE COPY WORK IS PROVEN ON PROBES, NOT ON A PROD CASCADE.** The FAQ guardrail rests on 4
generations across two niches; the Node 5 depth delta rests on real-interface shapes, not stored
rows. Strong evidence about the prompt and the extractor; not a live-run proof. Re-screen a freshly
generated page on the first real cascade rather than treating any of it as settled.

📌 **One observation carried forward, not chased:** a cure claim naming a protected attribute
reports `clinical_outcome_claim` TWICE — once from check 10, once from the delegated
`complianceFilter`. Pre-existing and unrelated to this chapter; the untouched *"cure your
migraines"* control duplicates identically.

### 📅 SCHEDULED — NOT STARTED — cache the account currency on `meta_access_tokens`

**The currency-aware budget floor costs one live Graph read per publish.** `getAdAccount()` is the
only place the account currency exists (`lib/metaAPI.ts:90`, Graph field `currency`), and
`meta_access_tokens` carries `adAccountId` / `adAccountName` / `businessId` / `pageId` but **no
currency column** — so the coach-facing floor has to fetch it every time.

**The fix is to store it at OAuth and refresh time** and read it from the row, removing the
per-publish round-trip and the failure mode that comes with it.

⚠️ **NEEDS A MIGRATION, SO IT TRAVELS ALONE** (CLAUDE.md §6). Additive nullable column; the code
must keep working when it is NULL, because every existing row will be.
📌 **The fail-open behaviour stays either way.** A cached NULL and a failed lookup are the same
state — unknown currency — and both must let the publish proceed, exactly as they do now.

### 📅 SCHEDULED — NOT STARTED — 🔵 LOW — recalibrate the provenance thresholds against the widened ICP corpus

**ICP Phase A widened `buildIcpInputCorpus` from 5 fields to 12, and the provenance ratio is
divided by corpus size.** Measured on service 209, the same row either side: **corpusWords 22 → 435**
(~20×), and the section labels moved **stated 4 / partial 10 / inferred 0 → stated 0 / partial 10 /
inferred 4**. `labelFor` computes `overlap(section, corpus) / corpusWords` against
`PROVENANCE_STATED_RATIO = 0.35` / `PROVENANCE_PARTIAL_RATIO = 0.15`, so a fixed-length section can
only overlap so many words and the ratio falls mechanically as the denominator grows.

🔑 **THE GROUNDING IMPROVED WHILE THE LABEL GOT WORSE. The label is the thing that is wrong.**
Same content, same coach, more of the coach's own words in the prompt — and the metric read it as
less grounded, because the metric measures coverage OF THE CORPUS rather than provenance OF THE
SECTION.

🔵 **LOW PRIORITY, and the reason is specific: nothing reads the per-section labels.**
`buildCoachCorpus` (`_core/groundingCorpus.ts:97`) reads only `groundingMeta.ladderAnswers`; no
generator and no client file reads `perSection`. The labels are stored and unread, so a wrong label
misleads a future reader and nothing else. ⚠️ That changes the moment anything starts consuming
them — check this note first if a consumer is ever added.

⚠️ **DO NOT SIMPLY MOVE 0.35 / 0.15 UNTIL IT LOOKS RIGHT.** That is the "reject above 0.40 cosine"
folklore-threshold mistake the copy-engine build spec §7 already threw out once: tuning a number to
produce a pleasing label, with no measurement behind it. **Measure first** — run the real path over
a spread of service rows (thin-input and rich-input alike), record the ratio distribution, and only
then decide whether the fix is new thresholds or a different denominator (section length rather
than corpus length, which is the shape that stops the metric moving when the input widens).

### 📅 SCHEDULED — NOT STARTED — relocate the protected fixtures off smoke account 117174

**The hazard is that ONE ACCOUNT IS BOTH the disposable smoke identity AND the owner of the
protected fixture set.** Measured read-only 2026-08-19: services **272–277 are owned by user
117174**, the account every smoke teardown targets by design. Service **285 is owned by user 1** —
a correction to earlier prose that lumped all seven together — and it already carries **3 `bonuses`
rows**, which is the proof that protected services do hold sweepable child rows in the ordinary
course.

**Every per-script fence is defense in depth against this one fact.** `e2e-bonus-teardown.ts` is now
fenced in its predicate; `adCreativeTeardown.ts` has its own `PROTECTED_SERVICE_IDS` refusal. Both
exist because a delete scoped to *that user* is a delete that can reach *those fixtures*. **The root
fix is to stop the smoke account owning them.**

⚠️ **DESIGN IT CAREFULLY, NOT UNDER LAUNCH PRESSURE, AND NOT AS PART OF A WIPE SPRINT.** Moving
fixtures means re-owning rows across `services` and every table that references them, and the
fixtures' whole value is that they are the untouched baseline every teardown reconciles against —
**a botched move destroys the very evidence used to prove nothing was destroyed.** Sequencing that
is the work; the SQL is the easy part.

📌 **Until it is done, the standing rule stands unchanged: teardown is ID-SCOPED, never
USER-SCOPED, and any new sweep must carry the protected-service fence in its PREDICATE.**

### ⚠️ HOUSEKEEPING — ONE ITEM OUTSTANDING, ONE NOW MOOT

- 🔴 **STILL OUTSTANDING — the `ANTHROPIC_API_KEY` needs ROTATING.** It was exposed in a session
  transcript on 2026-08-12 by a `pgrep -fl` against a `railway run` child, which prints the injected
  environment into the process listing. `AWS_ACCESS_KEY_ID` was exposed too (an identifier, not a
  secret). The dump truncated one entry short of `AWS_SECRET_ACCESS_KEY`; `META_APP_SECRET` and
  `DATABASE_URL` were NOT exposed. **Never run `pgrep -fl` / `ps` against a `railway run` child on
  this project** — `pgrep -f` without `-l` gives liveness with no argv dump.
- ✅ **MOOT — the pixel verdict on creative 497 is no longer needed.** It was held open as
  *"the blank-hook-band composite still needs a PIXEL VERDICT from Arfeen"*. **Decision 2 (§0-DEC)
  settled the question without it:** a blank band is a defect whatever it looks like, so there is
  nothing for the pixels to decide. The file stays at
  `docs/screenshots/run-2026-08-12-step4c-prepare/497-composite-BLANK-HOOK-BAND.png` as the record
  of the branch firing live. ⚠️ **Those 12 files are still the ONLY copies** — the Cloudinary
  originals were swept at teardown and the rows that held their URLs are deleted. §6 is unchanged
  and still stands for every other visual result: CC never self-certifies one.

### 🔴 THE 2026-08-10 ATTEMPT — IT FAILED, AND IT NEVER REACHED META

One `--publish` run was attempted. **It died at the landing-page publish gate on an unfilled
`[INSERT_PRICE]` placeholder — BEFORE a single Graph call.** Confirmed clean afterwards: no
`/tmp/step4c-ledger.jsonl` was ever created, `meta_published_ads` was still **2**, and **nothing
exists on the ad account**. The local rows it had already made were cleared by
`server/scripts/step4c-failed-run-cleanup.ts` (kept in-tree as the incident record) and reconciled
exactly to baseline. **4c is therefore still UNPROVEN, and that attempt consumed the publish word.**

⚠️ **`placeholderValues` was NOT the mechanism and seeding it would not have helped.** The
landing-page publisher never calls `buildResolvedMap`; that registry is read only at the Meta and
GHL export points. The gate scans the RENDERED HTML for `[INSERT_*]`. The only thing that clears a
token on a PAGE is writing the answer INTO the stored content, which is what the coach-facing
operator intake does via `applyOperatorAnswer`.

### ✅ ALL THREE GAPS ARE NOW FIXED (built 2026-08-11, unit-proven with fakes, NEVER RUN)

| gap | fix |
|---|---|
| the page could not clear its own gate | `--prepare` derives the page's operator questions and answers **every** one through `applyOperatorAnswer` — the coach's own path, not a test shortcut — from a token-keyed table with a REAL price (never the `__FREE__` sentinel, which routes a different template) and a non-fabricating hedge for unknown tokens. It then re-derives, re-renders, and **hard-stops if any token survives**. |
| teardown could not clean a pre-Meta failure | the state file is now written **incrementally, one id at a time as each row is created**; and when neither the ledger nor the state names a campaign, teardown **SKIPS the Meta phase** and runs the local sweep. ⚠️ `assertDeletableCampaign` is **UNCHANGED** — every non-null id still hits the full protected-id refusal. A ledger/state DISAGREEMENT is a STOP, never a skip. |
| ~12 min of generation sat inside the publish window | **the run is split into three phases.** `--prepare` builds the throwaway and touches Meta not at all; `--publish` is short and its failure surface is only what 4c tests; a failed publish retries against the SAME prepared set. |

```
npx tsx server/scripts/meta-4c-preflight.ts                      # READ-ONLY, re-run this FIRST
railway run … npx tsx server/scripts/step4c-multiad-publish.ts --prepare     # local + page only
railway run … npx tsx server/scripts/step4c-multiad-publish.ts --publish     # the ad-account write
railway run … npx tsx server/scripts/step4c-multiad-publish.ts --teardown    # SEPARATE word
```

⚠️ **`--prepare` and `--publish` must run on the SAME machine** — the state file and ledger live in
`/tmp`, and `assertPublishable` refuses a state prepared on another host. `--publish` also refuses
if the prepared service is no longer in the database (already torn down) or if the state has already
published (a second run would leave two campaigns standing).

**With no flag the script prints its plan and exits without a single call** — verified by running it
deliberately without `railway run`, so no production credential was in the environment. `--publish`
begins with a live `GET /me`; a stale or rejected token stops everything before any object exists.

### ✅ THE MINIMUM-TWO-ADS FLOOR — built 2026-08-12, unit-proven with fakes, NEVER RUN

**The floor is now ONE exported constant — `MIN_ADS = 2` in `_core/multiAdPublish.ts` — enforced at
three points that finally mean the same thing.** It is deliberately a constant and not a parameter:
a caller-supplied minimum would be a path straight back to the one-ad campaign being closed.

**What was actually wrong, and it was worse than one missing check.** Three counts lived in three
files enforcing three different things, and the number 2 appeared ONLY in the throwaway harness:

| point | before | now |
|---|---|---|
| assembly output | core and tRPC both refused on **exactly zero** | refuses below `MIN_ADS`, before the screen is even called |
| **post-screening survivor count** | refused on **exactly zero** — 🔴 **a single survivor sailed through into a real campaign, ad set, creative and ad, and every layer reported success** | refuses below `MIN_ADS` in the SAME branch as the zero-survivor refusal, creating nothing at all |
| final published count | core had **no check whatsoever**; the harness printed one **after** the campaign existed and after the `meta_published_ads` provenance rows were inserted — advisory, never a floor | reported on a new `belowFloor` field (see below) |

🔑 **The post-screening survivor count is the load-bearing one, and the reason is structural: it is
the LAST count taken while Meta still holds nothing.** It is therefore the only point that can
enforce the floor by creating nothing. A single survivor is not a reduced success — it is a
multi-ad push with no second ad to share an ad set with, which is the entire purpose of this path;
`publishToMeta` is the single-ad way and does it better.

**`meta.publishAssembledAds` (the tRPC procedure) also refuses below the floor**, throwing
`BAD_REQUEST` beside the existing zero-assembly throw, so a caller gets a usable message rather than
a silent refusal object. The core refuses independently regardless — belt and braces, deliberately.
⚠️ **That procedure is NOT WIRED TO ANY CLIENT** — verified by grep over `client/src`, zero hits,
consistent with the module's own "NOT WIRED, NOT INVOKED" docblock. **So today's exposure is the 4c
harness path and any FUTURE wiring, not a live coach-facing path.** That makes the fix cheaper to
land, not less worth landing — and it means nobody should read this as a coach-facing bug fixed.

`publishToMeta` (the legacy single-ad path) is **UNCHANGED and must stay so** — it publishes exactly
one ad by design and a two-ad floor there would be wrong.

#### 📌 POINT THREE IS REPORTED, NOT AUTO-TORN-DOWN — a deliberate decision

An under-floor campaign can arise **only** from per-ad Graph failures AFTER creation, because the
survivor floor guarantees at least `MIN_ADS` ads entered the loop. When it happens the result
carries `belowFloor` (non-null) and **nothing is un-created**. Three reasons, all standing:

1. it preserves the **create-only publish / delete-only teardown separation** — a publish path that
   deletes is a publish path that can delete the wrong thing;
2. it honours the module's **keep-what-landed rule** — auto-deleting destroys a good ad to tidy up
   a bad one;
3. it leaves the call with the operator, who can see the account.

**Therefore the operator MUST run teardown on a below-floor result. It does not clean itself.**

#### 🔑 OPERATING RULE — at the read-back between `--publish` and `--teardown`

**`belowFloor` MUST be null before proceeding. A below-floor result means RUN TEARDOWN — never
retry.** Retrying leaves the under-floor campaign standing and adds a second one beside it, which is
exactly the orphan class already visible on the account (five "Auto Campaign Kit" campaigns against
two `meta_published_ads` rows). The harness prints the field as `🔴 BELOW FLOOR:` so it cannot be
missed in the log.

**Unit-proven with fakes, never run:** three assembled ads screened down to one survivor asserts all
four Graph fakes were never called and the refusal names "only 1 of 3"; two survivors publish into
one ad set with a single asserted `adset_id` and leave `belowFloor` null. Six pre-existing single-ad
fixtures had to become two-ad fixtures — forced, since under the floor a one-ad fixture now proves
the opposite of its own point. **No existing assertion was removed or weakened**; the conversions
changed setup data only.

### 🔴 THE 2026-08-12 ATTEMPT (ATTEMPT 2) — DIED ON A FALSE POSITIVE, AND NEVER REACHED META

`--prepare` was run once. It built the whole throwaway — service 313 · ICP 287 · 8 concepts ·
adSet `MqGYlX-BFJdSz1xjRUzUM` (12 headlines / 12 bodies / **3 hooks**) · batch
`batch-1786538755783-e2ae8858` · creatives 495–498 · landing page 238 — and then **died at the
operator-token assertion, before publishing the page and before any Graph call.** Confirmed by
three independent checks: the ledger was 0 bytes, a scan for `graph.facebook` / the four create
calls / `GET /me` / the ad account id returned 0 hits, and `assertTokenLive` lives only in
`publish()`, which was never invoked. **Teardown ran clean and reconciled EXACTLY** — adCopy 5424 ·
headlines 2174 · adCreatives 405 · concepts 6 · published 2 · protected 29 — with Cloudinary
verified GONE by direct HTTP on all 12 objects, not by the sweep's self-report.

🔑 **IT WAS A FALSE POSITIVE. THE PAGE IT WAS ABOUT TO PUBLISH WAS ALREADY CLEAN.** The active angle
was `original` and carried **zero** tokens; the single `[INSERT_CART_CLOSE]` lived only in
`dollarAngle`, **an angle the publisher never renders**. The answering pass derives its questions
from the ACTIVE angle, so it could never plan an answer for it; the assertion then scanned ALL FOUR
columns. No input could satisfy both. ⚠️ **The thrown message's own advice — "add the token to
`CANNED_OPERATOR_ANSWERS`" — would NOT have fixed it**, because a token in a non-active angle is
never planned and so never applied.

#### ✅ FIX 1 — the final token assertion is scoped to the ACTIVE angle (2026-08-12)

`assertActiveAngleHasNoOperatorTokens` (`_core/step4cPageAnswers.ts`) replaces the four-column loop.
The active angle is the only one that renders, publishes, and is judged by `checkAdToPageMatch`.
⚠️ **The answering pass still applies every answer to ALL FOUR angles, deliberately — only the
ASSERTION narrowed.** If a coach later makes another angle active, the product's OWN publish gate
re-scans the newly rendered page at that moment, which is the right place for that check rather than
a harness that ran days earlier. **Do not restore the all-angles loop; it was the defect, not a
safeguard.** Scoping down also makes the error message's advice true again — a token that now
reaches the assertion IS in the active angle, so `collectTokens` saw it and a canned answer really
would apply.

#### ✅ FIX 2 — the `booking_url` snake_case crash (2026-08-12)

`OPERATOR_TOKEN_REGISTRY` carries `path: "bookingUrl"`; the DB column is **`users.booking_url`**. The
snapshot READ was raw SQL (`sql.identifier("bookingUrl")`) and failed with **`ERROR 1054 Unknown
column 'bookingUrl'`** — reproduced directly on production. The WRITE and the teardown RESTORE go
through Drizzle, which maps the key, so they were always correct. **Any page needing
`[INSERT_BOOKING_URL]` therefore hard-crashed `--prepare`, meaning the coach-scoped snapshot path
had NEVER ONCE EXECUTED.** §0a item 6 assumed it worked; it did not.

Fixed by `dbColumnNameFor`, which derives the real column from the **schema object**, so the raw-SQL
name and the JS key cannot drift. 🔑 **Two representations, one per API, and that is correct:** raw
SQL needs `booking_url`, Drizzle's `.set()` needs `bookingUrl`, so `coachFieldsBefore` stays keyed by
the JS KEY — re-keying it to snake_case would silently break the teardown restore. **This makes the
snapshot-and-restore path executable for the first time.** CLAUDE.md §9 trap 1, caught at the
boundary: an unmapped path now throws a named error instead of a bare 1054 far from its cause.

Gates: tsc **34**, 4c safety set **241 passed across 9 suites** (up from 217, +17 new cases).

#### ✅ SUPERSEDED — "the page does not pass compliance" was mostly the CLASSIFIER, not the copy

**This block is kept for the record. Its numbers are the BEFORE column of §0's table and are no
longer current.** It read, screened through the same `checkOutput` the persistence gate uses:

| angle | blocking | what |
|---|---|---|
| **`original`** ◀ ACTIVE | **2** | `promised_result` @ `faq[6].answer` ("within twelve weeks of completing the programme, I will work with you") · `deceptive_urgency` @ `scarcityUrgency` |
| `godfather` | 1 | `second_person_protected_attribute` @ `scarcityUrgency` |
| `free` | 2 | `deceptive_urgency` @ `guarantee` and @ `scarcityUrgency` |
| `dollar` | 1 | `second_person_protected_attribute` @ `scarcityUrgency` |

🔴 **ITS CONCLUSION — *"This is a COPY-ENGINE problem upstream of the harness"* — WAS WRONG.** Four
of those six hits were classifier false positives; the copy was fine. **6 → 2 after the precision
fixes, with the active angle at 1.** See §0. The claim that all four angles carry a blocking claim
is now false: `godfather` and `dollar` are clean.

**What survives from this block:** `checkAdToPageMatch` does read the active angle at `--publish`,
so the active angle's one remaining hit still matters to a 4c re-run — but it is now a posture
call awaiting Arfeen, not a defect to fix.

📌 Probe hygiene: the first pass read `res.hits` and reported 0 blocking. `checkOutput` returns
**`blocking` / `advisories`**, not `hits`. `ok: false` beside a zero count is what exposed it. Any
future probe must assert against the real shape — a wrong property name reads exactly like a pass.

#### 📌 RECONCILED — the retry-log vs persistence-gate disagreement

The `[persistenceGate]` line reported six classes while the retry log showed four failures and never
mentioned `original`. Both mechanisms confirmed in code:

1. **"Every row" is ONE row.** `gateBeforePersist` receives `[__row]` — a single `landingPages` row —
   and its extractor **flattens all four angles** into one text set. The class union therefore spans
   every angle, and **nothing in that message can be attributed to `original`.**
2. **The union also carries DISCARDED attempts.** `__lpSink` is passed into `generateAllAngles`,
   accumulates the generation-time validator's hits across every angle and every retry, and arrives
   as `legacyHits` at tier 2. So classes from attempts that were successfully retried away still
   appear — which accounts for `unearned_authority`, `invented_testimonial` and `invented_guarantee`,
   none of which any surviving angle carries.

⚠️ **What is NOT explained away: `original` never appears in the retry log, yet carries two blocking
claims.** The generation-time gate passed it and the persistence screen does not. Both hits sit in
`scarcityUrgency` and a deep `faq[]` entry. **HYPOTHESIS, NOT CONFIRMED:** the generation-time gate
screens a narrower field set than the 78 fields `copyFieldsOfJson` extracts, so a page can pass
generation while carrying blocking claims in fields that gate never reads. Confirm before relying
on it.

📌 Note the shape: one stage working per-angle while another works across all four fused — the same
asymmetry as Fix 1. Worth checking whether it recurs elsewhere.

### 🔴 A DEAD GATE WAS FOUND AND FIXED IN THE PUBLISH PHASE — it is now LIVE

The publish phase built its ad-to-page compliance text from `lpRow.content` — **a column
`landingPages` does not have.** It was always `undefined`, so the page text was always `""` and
**`checkAdToPageMatch` NEVER RAN.** That silently defeated the whole reason 4c generates its own
landing page (plan §2: so the gate is judged against a page the copy agrees with). It now reads the
**active angle**, the same one the publisher renders.

⚠️ **This is a behaviour change: a previously dead gate is now a live blocking surface inside
`--publish`.** It is the correct fix, but if the first proving run should not carry that surface it
is a one-line revert — Arfeen's call.

⚠️ **It writes to `act_1254349025145319` ("KS 1") — ACTIVE, billed in AED, ~AED 1,168,324 lifetime
spend across ~200 REAL campaigns. It is Arfeen's own advertising account, not a sandbox.** It runs
as **userId 1** because the Meta token is bound to user 1; the 117174 smoke account cannot publish.

**What it proves:** N assembled ads in ONE campaign and ONE ad set. Meta only compares variants
inside one ad set, so until that holds the whole distinctness chapter buys nothing at delivery time.
The load-bearing assertion is that **every ad's `adset_id` is the same value**, read back from
Meta's stored state rather than from our own request.

📌 **Re-run the read-only pre-flight on the day rather than trusting the numbers below** — the token
expires 2026-10-05, and the orphan inventory is a point-in-time read.

**Full design: `docs/handovers/STEP_4C_PLAN.md`. Read §0a — four things are open.**

### Where the repo is — as at 2026-08-10

⚠️ **This block deliberately names only the SHAs that CANNOT go stale — the per-step commits, which
are immutable once made. For "where is HEAD right now", run the command. §1 records that this file
hardcoded a moving SHA three times and went stale three times; writing one here would be the fourth.**

```
git fetch origin && git rev-parse HEAD origin/railway-build origin/backup/publish-path-sprint-2026-08-08
```

| | |
|---|---|
| Branch | `railway-build`. HEAD is this CHECKPOINT commit, sitting on top of **`e862c76`** (the 4c harness). |
| `origin/railway-build` | **`51eda78` — UNCHANGED since before this sprint. NOTHING here is deployed.** |
| Off-machine backup | `origin/backup/publish-path-sprint-2026-08-08`, updated to HEAD and SHA-verified after a fetch each time. **It does NOT deploy.** |
| Deploy discipline | Pushing `railway-build` IS an instant production deploy (~4s, no gate). It needs a fresh explicit "push" from Arfeen every time; no prior authorisation carries forward. |

⚠️ **MIGRATIONS 0097 – 0103 ARE ALL APPLIED TO PRODUCTION.** Every one is additive and inert.
**Do NOT re-apply any of them — 0103 least of all, it was applied 2026-08-10.** Their presence is
NOT evidence that the code using them is live; the schema is deliberately ahead of the code.

| migration | what | applied |
|---|---|---|
| 0097 | P.D.A.F. axes on `headlines` + `adCopy` | ✅ |
| 0098 | `image_hook` content type | ✅ |
| 0099 | `adCreatives.sourceImageUrl` (the third Cloudinary object) | ✅ |
| 0100 | publish-copy provenance on `meta_published_ads` + `adCreatives.headlineAdCopyId` | ✅ |
| 0101 | `adCopy.conceptId` | ✅ |
| 0102 | `adCreatives.conceptId` | ✅ 2026-08-10 |
| 0103 | `adCreatives.hookAdCopyId` — which image_hook row the picture baked | ✅ **2026-08-10** |

📌 **0103 carries NO foreign key and NO index, deliberately.** It follows `headlineAdCopyId` (0100),
not `conceptId` (0101/0102): `ON DELETE SET NULL` is right for a grouping key and WRONG for
provenance — it would erase the record of what was baked into a picture that still exists.
Verified after applying: `int / YES / NULL default`, 0 FKs, 405 rows unchanged, 0 stamped.

### The chapter, banked and proven — all LOCAL ONLY

| commit | what | proven |
|---|---|---|
| `e2eff85` | copy distinctness engine (per-surface gate, hook regeneration, harness) | live, both nodes |
| `64f5dc8` | **step 1** — the published headline and body come from the gated pool | live, real paused Meta ad, read back by id |
| `20a0f39` | **step 2a** — `adCopy.conceptId` plumbing and stamp | live, 28/28 stamped |
| `a313717` | Node 6 hardening — an off-shape model response no longer zeroes the deck | live, the guard fired for real |
| `8502f36` | **step 2b** — ad-copy awareness is concept-derived; dedupe removed; gate keyed on conceptId; concept top-up | live, both nodes |
| `269947c` | **step 3** — `adCreatives.conceptId`, tabloid cascade only | live, 4 real renders, 4/4 stamped |
| `793d4ed` | **steps 4a + 4b** — hook identity (0103), concept-keyed assembly, step-1 tests, inert multi-ad publish | live, 4 ads from 4 concepts, 0 dropped |
| `e862c76` | **4c harness** — metaSafety / publishLedger / metaTeardown + the flagged publish script | ⚠️ unit-proven with fakes only; **NEVER run against Meta** |

### ✅ STEP 3 — PROVEN LIVE (2026-08-10)

Four real renders on a throwaway. **4/4 stamped · 0 unstamped · 0 DANGLING · 0 JOIN-MISMATCH** —
each stamp equal to the concept of the `adCopy` row named by `headlineAdCopyId`, established by
joining on ids and never by comparing text. The render deck came back **UNDISTURBED**: four slots,
the same style sequence, and the generator's Layer 1+2+3 line **byte-identical (188 chars)** to an
expectation computed BEFORE the run from `awarenessDeckPlan`/`subTypePlanFor`/`visibilityTierPlanFor`.
Teardown swept **12 public_ids → 12 Cloudinary objects deleted, 0 failures** (exactly 3 per
creative). Reconciled: adCopy 5424 · headlines 2174 · adCreatives 405 (0 stamped) · protected 29.

⚠️ **What the stamp MEANS:** the concept whose HEADLINE the picture bakes — not "the picture
descends from that concept". The scene still comes from `awarenessDeckPlan`, and the on-picture
hook comes from a separately-chosen `image_hook` row. See §0a.

---

## 0a. WHAT IS OPEN — four items, and two of them are DECISIONS, not work

**The three findings step 4 was designed around are now CLOSED.** The A-vs-B gap is fixed at the
source and inverted (3 of 4 now AGREE); the 8 gate-moved rows are handled by judging awareness
coherence row-to-row on the live stamps, so there is deliberately no moved-row rule; NULL stamps are
skipped and never defaulted. Full design and the live ledger: `docs/handovers/STEP_4_PLAN.md`.

1. 🔑 **THE COHERENCE CAP — NEW, and it sharpens the 4 → 8 decision.** On the 4b run the four kept
   HOOKS carried concepts 175/176/177/178 while the four dealt HEADLINES carried 175/177/178/179.
   Concept 179 had no hook of its own, so slot 4 took the fallback and shipped a hook from another
   concept. **Root cause: distinctness is judged WITHIN each surface, so each surface keeps its own
   survivors and their concept coverage need not line up.** Hook-to-headline agreement is therefore
   capped by how much the two surfaces' surviving concept sets OVERLAP, and that cap tightens as the
   deck grows. ⚠️ **This is a second, independent reason the hook surface is the binding constraint
   on 4 → 8**, alongside the already-measured "natural distinct capacity is exactly 4". Not a defect
   in the deal — the deal did what it is specified to do.
2. ✅ **CLOSED 2026-08-14 — THE BLANK HOOK BAND IS A DEFECT. NO AD IMAGE SHIPS WITHOUT TEXT.**
   Both halves of this item are now settled. It FIRED live on the 2026-08-12 run (creative **497**,
   `hookAdCopyId` NULL), and Decision 2 in §0-DEC rules that an empty band is not an acceptable
   outcome at all. **The fix is to guarantee a hook for every image**, which makes hook SUPPLY the
   thing to solve and ties this straight into 4 → 8 (item 1). ⚠️ **The "ship with no line rather
   than a repeated one" rule that produced this branch was correct only while a blank band was
   acceptable — it no longer is.** Neither option is acceptable now; the deck must not run short.
   Historical record: built and unit-tested, unexercised on the 4b run because it had 4 hooks for
   4 slots. The harness still names such files `…-BLANK-HOOK-BAND.png` so they are impossible to
   miss — keep that, it is how the branch was caught.
3. **SHIP-VERSUS-DROP STRICTNESS — an open product decision.** Today a **mismatched but unique**
   hook SHIPS and is recorded (`hook.agreement: "mismatch"`); only a **duplicate hook string** drops
   the later ad. The reasoning is that the hook is already baked by assembly time, so discarding a
   rendered picture over a surface that can no longer be re-chosen ships fewer ads for no gain.
   **Whether that is the right strictness is Arfeen's call, and it is not settled.** Tightening it
   would trade ad count for surface purity; the 4b run is the only measurement so far (3 match,
   1 mismatch, 0 dropped).
4. **STEP 4c IS BUILT, ATTEMPTED ONCE, AND STILL UNPROVEN** — see §0 for the attempt, the three
   fixes and the commands. The 2026-08-10 run **died before any Graph call** and the account is
   confirmed untouched; the harness is now three phases. Everything remains unit-proven with
   injected Graph calls and **has never been invoked against Meta**. Three facts it depends on,
   all measured read-only on 2026-08-10 and all worth re-checking on the day:
   · the ad account is **AED**, ACTIVE, ~AED 1.17M lifetime spend, ~200 real campaigns;
   · the token is live (Meta answered `GET /me`) and expires **2026-10-05**;
   · **the three pre-existing orphans are `120246733286970626`, `120246731977370626`,
     `120246731522130626`** — hardcoded in `_core/metaSafety.ts` and refused by the teardown guard.
     They are NOT 4c's to clean up; a run that tidied them would destroy the evidence for a
     question nobody has decided. 4c's only obligation is to not add a sixth.
   ⚠️ **The AED budget floor is where our currency-unaware `z.number().min(1)` finally bites.**
   `createAdSet` sends `dailyBudget * 100` minor units, so `1` sends AED 1.00 and Meta rejects it.
   The harness pins **20** (proven accepted) and refuses below 4. **Zero is not an option** — an ad
   set with no budget is rejected outright. The coach-facing defect stays parked and unfixed.

5. 📌 **PARKED — the page render is duplicated in two places and can drift.** `--prepare`'s
   early "is the rendered page token-free?" check **mirrors** `landingPagePublisher`'s render
   dispatch (`styleForPageType` → the three style discriminators → `renderLandingPageHtml`, with
   the same testimonial injection and the same coach-asset fetch) rather than sharing one function
   with it. Accepted deliberately for the harness build: the publisher's own gate still runs a
   moment later and remains the authority, so the worst case of drift is a duplicated error
   message, never a page that publishes with a token in it. **The proper fix is to extract ONE
   shared render helper both call** — that is a change to production code and wants its own pass.
6. 🔴 **PARKED, AND IT WILL BITE SILENTLY — the coach-scoped answer snapshot must grow with the
   registry.** A coach-scoped operator answer writes OUTSIDE the throwaway, onto the owner's own
   `users` row; today `[INSERT_BOOKING_URL]` → `users.bookingUrl` is **the only** token with
   `scope: "coach"` in `OPERATOR_TOKEN_REGISTRY`. `--prepare` snapshots the prior value before
   writing and `--teardown` restores it, including restoring it to NULL when there was nothing
   there before. ⚠️ **If any NEW coach-scoped token is ever added to the registry, that snapshot
   must be extended or teardown will silently stop reversing it** — the throwaway would be deleted
   while a made-up value stayed on the real account, with no error anywhere. There is a comment at
   the snapshot site saying so; this is the second place, because the person adding a registry
   entry will not be reading the harness.

📌 **The coach-facing review UI (4d) is deliberately unstarted.** The server capability is proven
first so the pixels can be argued about separately.

### ✅ FIXED IN 4a — the short hook deck no longer duplicates the on-image line

**The defect, for the record.** Node 7 kept **3** image hooks on the step-3 run, not 4. The hook
surface is the fragile one — with persona pinned and format fixed it has only two movable axes — and
it landed at 3 against a band of 1–4, so it was above floor and shipped. The image path then took
`bodyTexts[i % bodyTexts.length]` over 4 slots, so **two pictures baked the IDENTICAL on-image hook
line** (adCopy row 6044 on slots 1 and 4) — duplication on the exact surface Meta's OCR reads.

**Fixed by `dealHooksByConcept` (`793d4ed`): the deal NEVER reuses a row.** A slot with nothing left
bakes no hook at all. Arfeen's call was taken the "ship with no line rather than a repeated one" way,
because an empty band is a visible symptom of a short deck while a repeated line is an invisible
collapse. ⚠️ **That branch has still never fired live** — see §0a item 2 — and it **still interacts
with 4 → 8**: growing the deck to 8 makes the shortfall worse unless the hook band grows with it,
and §0a item 1 adds a second, independent cap on top of that.

## ✅ PUBLISH-PATH STEP 1 — PROVEN END TO END ON A REAL PAUSED AD (2026-08-09)

**META RETURNED THE GATED COPY ON ALL THREE FUSED SURFACES.** Read back BY ID from the live ad
before anything was deleted — not from our request, and not from a list endpoint:

| surface | Meta's stored value | source |
|---|---|---|
| headline field | `"Postpartum stalls don't respond to less — here's why"` | gated adCopy **5889** (solution_aware/curiosity) |
| primary text | 964 chars, byte-identical | gated adCopy **5902** (problem_aware/pain_agitation) |
| baked on the image | same string as the headline field | adCreatives 482 |

✅ headline === 5889 · ✅ body === 5902 (964/964) · ✅ baked === field · ✅ NOT the ungated control
headline · ✅ NOT the landing-page subheadline body · ✅ **PAUSED at campaign, ad set AND ad**
(`daily_budget=2000` = AED 20.00; nothing could deliver, nothing spent) · ✅ campaign deleted and
confirmed by id (`status=DELETED` — Meta SOFT-deletes, so the id stays readable, which is exactly
why a by-id read beats a list check) · ✅ provenance persisted: `meta_published_ads` carried
`headlineAdCopyId=5889 bodyAdCopyId=5902` and a real `adSetId` beside legacy rows still showing
`temp`/NULL.

**Migration 0100 APPLIED** — 3 additive nullable columns, row counts identical before and after,
zero non-null values (no backfill), ALTERs 2.08s/2.23s. 0097, 0098, 0099, 0100 are ALL applied while
the code using them is NOT deployed. Schema is deliberately ahead of code.

**All step-1 throwaways torn down** and reconciled EXACTLY: adCopy **5424** · headlines **2174** ·
adCreatives **405** · meta_published_ads **2** · protected `272:5 273:5 275:5 276:5 277:5 285:4` =
**29**. The sweep cleared **3 Cloudinary objects for 1 row** — 0099 working; pre-0099 it would have
cleared 2 and leaked 1.

### What step 1 shipped

`_core/publishCopySource.ts` (resolver — REFUSES ungated or unscreened rows rather than falling
back, because a silent fallback is indistinguishable from the defect being removed) ·
`measureHeadlineFit` (the length rule, measured in RENDERED WIDTH on the real canvas with the real
font — the 52-char proven headline would have been rejected by the retired ≤38-char guard yet fits
with 9px to spare at 896px) · gated headlines baked by the render path so picture and field match by
construction · `metaAPI` by-id fetchers · provenance wiring · `meta.getGatedPublishCopy`.

🔑 **THE STRONGEST RESULT IS NOT DISTINCTNESS.** The control run was BLOCKED by our own compliance
gate on the landing-page body (`second_person_protected_attribute`) — page copy is never screened as
ad copy, so the live path could hard-fail at the final step after the coach did everything right.
The gated body clears that gate: **control 1 blocking hit, rerouted 0**, same gate, same service.

## ✅ STEP 2, FIRST HALF — conceptId PLUMBING AND STAMP, PROVEN (2026-08-09)

**Migration 0101 APPLIED** — `adCopy.conceptId INT NULL`, FK to `campaignConcepts(id)` with
`DELETE_RULE = SET NULL`, plus `idx_adCopy_conceptId`. Row counts identical either side, zero
non-null values (no backfill), protected 29. ~2s per statement, no rebuild. This DB is **MySQL
9.4.0 with 81 real FK constraints**; the name follows adCopy's existing
`adCopy_<col>_<reftable>_<refcol>_fk` convention.

**Proven live on one throwaway (both nodes, one concept generation):**

1. **Deck shape UNDISTURBED** — headline 12 / body 12 / hook 4, collapse 6→0, 4→0, 30→0, every
   surface at or above floor. Awareness is still the cold-weighted `awarenessPlanForCount`; this
   half changed nothing about it, and the shape matching two prior runs is the evidence.
2. **Stamps RESOLVE** — 28 counted rows, **stamped 28 · unstamped 0 · MISMATCHED 0 · DANGLING 0**,
   **8 of 8 concepts represented**. Verified by comparing the stamped concept's `desire` against
   the ROW's own desire, not by checking the column is non-null — a stamp pointing at the wrong
   concept is worse than none, because it looks complete.
3. **The `regenerate` re-stamp is verified by that same zero** — 7 rows were recovered on a moved
   axis. The gate moves `desire` to another value from the same pool, so a conceptId left pointing
   at the ORIGINAL concept would silently become a lie. `regenerate` now re-derives it.

### ✅ SUPERSEDED BY STEP 2b — the dedupe is GONE, and removing it mattered

2a kept the dedupe-by-desire-string deliberately and deferred its removal to 2b. **2b removed it
(`8502f36`), and the live run proved it was not a theoretical concern:** the generated set held 8
concepts with only **6 distinct desires** — two pairs sharing a want and differing only in stage.
Under the old code those two concepts were erased before reaching a single row, a quarter of the
set, silently. All 8 reached the deck.

The 2a "stamp points at the first" ambiguity is therefore **retired**: the plan carries the concept
id on the slot, so the insert path performs no lookup at all, and the gate's desire axis is keyed
on `concept:<id>` rather than on prose. Two rows collapse on that axis when they came from the SAME
concept row, never because a generator phrased two wants alike.

📌 `dealAcrossSlots` turned out to be **already generic (`<T>`)**, so no signature changed and
`headlinesGenerator` was never touched. `link` rows are stamped too — excluded from the
distinctness population but they carry axes for coordination, so a hole there would be incoherent.

### ✅ STEP 2b — PROVEN LIVE, BOTH NODES (2026-08-10)

Node 7: collapse **43 pairs (13.2%) → 0**, KEPT headline 12 / body 12 / hook 4, every surface above
floor. 28 counted rows — **stamped 28 · unstamped 0 · desire-mismatch 0 · dangling 0 · 8/8 concepts
represented**. The ungated link band came back `unaware 6 · problem 5 · solution 2 · product 2` —
the same weighting the old cold plan produced, now carried by real concepts. Node 6 UNCHANGED by
design (its table has no `conceptId` column): non-regression run collapse 25 → 0, KEPT 12/band 8–12,
persisted 12 = ledger 12 = returned 12.

**The concept top-up is BUILT and its restore branch has FIRED live, but it has never successfully
restored a stage.** Forced-condition run 2026-08-10: the concept gate killed `product_aware` on its
own (7/12 survived, 5 blocked on `invented_testimonial`/`unearned_authority`), the branch fired
correctly — one targeted call, right stage, `room=1` — and **the replacement concept failed the same
gate** (`asked 1, returned 1, passed 0, ADDED 0`). Never-pad held: no other stage moved, the set
stayed at 7 ≤ 8, and it reported the shortfall. **Root cause is structural, not luck:**
`product_aware`'s primary hook is `social_proof` and its first secondary is `data_chart`, both
withheld when the coach has no client material, so the model reaches for authority it has not earned
and is blocked. Fixing it means giving the top-up call a proof-free product-aware framing — a PROMPT
change, not a control-flow one — and it is Arfeen's call. 📌 Instrumentation gap worth closing at the
same time: the top-up logs `passed 0` but not the failure CLASSES, which are already in the gate
result.

⚠️ **Step 1 delivers GATED and COMPLIANT, not yet COHERENT.** The resolver picks the strongest
headline and body INDEPENDENTLY, so the proven ad paired a `solution_aware` headline with a
`problem_aware` body. Both good, both compliant, different stages.
✅ **CLOSED BY STEP 4b (`793d4ed`)** — `_core/adAssembly.ts` chooses the surfaces together and
requires the headline and body to share one awareness stage. Proven live: all 4 assembled ads
stage-coherent. ⚠️ `resolveGatedPublishCopy` itself is UNCHANGED and still picks independently — it
is the pool, and assembly is what pairs from it. Do not read this as the resolver having been fixed.

### ✅ NODE 6 HARDENED — the crash is now survivable (2026-08-09)

**The defect.** All THREE branches consumed the model's `headlines` with a bare `.forEach` and no
shape check — `story`/`question`/`urgency`, `eyebrow`, and `authority`. A JSON schema is a REQUEST,
not a guarantee. Worse, the five formulas ran in a **`Promise.all`**, so ONE off-shape response
rejected the whole batch and the coach got **zero** headlines. Guarding one branch would have closed
nothing.

**The fix, in four parts:**

1. **`headlineItemsFrom`** — container guard on all three branches. Not an array → contribute 0 for
   that formula, logged loudly, the rest of the deck lands.
2. **`structuredHeadlineFields`** — per-element safety for `eyebrow` (`item.eyebrow/.main/.sub`) and
   `authority` (`item.main/.sub`). A missing `main` DROPS the element, because `headline` is NOT
   NULL and it would otherwise fail at insert far from its cause; `sub`/`eyebrow` are nullable so
   absent ones degrade to null rather than discarding a good headline. The string branch got the
   same check — a non-string element would reach the insert as an object.
3. **`Promise.allSettled`**, and the per-formula catch LOGS WITHOUT RETHROWING. Two layers on
   purpose: the catch handles the normal case, `allSettled` covers anything thrown OUTSIDE the try.
4. **A summary line** (attempted / settled / rejected / collected) so a short deck is visible in one
   line — and **all-formulas-empty still THROWS**, because persisting an empty set and reporting
   success is worse than failing.

**No retry**, deliberately: this generator has never had one around the LLM call, and adding one
inside a crash fix would smuggle in new behaviour.

**Proven both ways.** 29 unit cases in `headlineItemsGuard.test.ts` — bad shapes across all five
formula names, plus valid-shape pass-through for each branch so the guards are shown NOT to perturb
a normal deck. And the live run **exercised the fix for real**: the `story` formula returned
`headlines` as a **string**, the guard caught it, and the other four still produced a full deck —
`KEPT 12/band 8-12`, collapse 18 → 0, `question 4 · eyebrow 4 · authority 2 · urgency 2`, ledger
KEPT = rows = returned = 12. Under the old code that identical run would have crashed.

Node 6 is now PROVEN for step 2 as well — the parity result step 2a never reached.

### 🔴 PRE-LAUNCH — the `story` formula systematically returns the wrong shape

**Lower severity than the crash, but not fixed.** `story` returned a non-array `headlines` on BOTH
runs that reached it (2026-08-09, twice). Two for two on one formula is a pattern in its prompt or
schema, not model variance.

The guard makes it **survivable, not fixed**: every story run silently costs a fifth of the deck —
12 kept instead of the ~15 five formulas would give — and the only trace is one `console.error`. Fix
the story prompt/schema before launch, and check whether `FORMULA_SCHEMAS.story` differs from its
four siblings in a way that invites the wrong shape.

### 📌 OPEN — unit coverage for the step-1 code, before step 4

Step 1 shipped with **zero new tests** (568 before, 568 after). `publishCopySource.resolveGatedPublishCopy`,
`measureHeadlineFit` and the `metaAPI` by-id fetchers are proven live but have no unit coverage.
Step 4's assembly builds directly on the resolver, so close this first.
⚠️ Also: the step-1 commit gate ran **8 suites (501)** rather than the canonical 14 (**568**) that §8
records. Nothing was lost — the six omitted suites account for exactly 67 — but run the §8 command.

### 🔴 TWO PRE-LAUNCH DEFECTS FOUND WHILE PROVING STEP 1 — neither is fixed

1. **The `dailyBudget` floor is CURRENCY-UNAWARE.** `publishToMeta` accepts `z.number().min(1)`,
   which assumes USD. The ad account is denominated in **AED**, and `createAdSet` rejected a budget
   of 1 with `blame_field_specs [["daily_budget"]]` — *"must be more than AED3.00"*. A coach on any
   non-USD account entering 1 or 2 hits this. The modal's default of 20 masks it.
2. **No low-balance guard on the Anthropic key.** A payload proof burned ~10 minutes polling before
   failing with *"credit balance is too low"*. When credit runs out EVERY generator fails — concepts,
   copy, headlines, landing pages — and the only signal is a 400 deep in a run. Second occurrence
   (first: 2026-07-24). Wanted: a cheap pre-flight and a coach-facing message.

🔴 **WHY THIS OUTRANKS EVERYTHING ELSE IN THE SPRINT. The gated copy reaches nothing live.**
Traced end to end 2026-08-09, in code, not recalled:

- The **published headline** is `selectedCreative.headline` (`PushKitModal.tsx:263`) — a row from
  the ad-creatives batch, written by `generateContextualAdHeadlines`, a SEPARATE micro-call inside
  the image engine. It has its own ≤38-char validator but **no P.D.A.F. axes, no concept desire, no
  awareness stamp, and it never passes through the gate.**
- The **published body** comes from `deriveDefaultBody` — landing-page **subheadline**, else
  **eyebrowHeadline**, else operator-typed. **The adCopy body pool is not in that priority list at
  all.**
- So of Meta's three fused surfaces, **only the baked image hook is gated.** The 12 gated headlines
  and 12 gated bodies are generated, gated, and never shipped.
- ⚠️ **CHECKPOINT §12.7 SAYS THE PUBLISHED PRIMARY TEXT COMES FROM THE adCopy TABLE. That is TRUE
  OF V1 ONLY** (`AdCopyDetail.tsx:246-247` → `PublishToMetaDialog`), and `client/src/pages/` is
  read-only legacy per CLAUDE.md §5. It is FALSE of the live V2 path. Corrected here rather than
  left to mislead the next session — the §15a failure mode exactly.
- **Assessed as an unfinished GAP, not a design decision.** Nothing in the build spec says publish
  should draw from the creative row; spec §3 requires the three surfaces to ship as a coordinated
  set, which only means anything if the coordinated set is what ships.

### 🔴 THE PUBLISH SURFACE — traced 2026-08-09. ONE PUSH MAKES ONE AD, IN ITS OWN CAMPAIGN.

There is **no fan-out and no batch step.** `handlePush` calls `fireMeta()` once, which calls
`publishToMeta` once, built from ONE creative chosen in a single `<select>`
(`PushKitModal.tsx:470`) plus ONE body textarea. The `Promise.allSettled` in that file is **Meta
and GHL in parallel — two platforms, not several ads.**

And each call builds a COMPLETE new hierarchy: `createCampaign` → `createAdSet` →
`createAdCreative` → `createAd` (`meta.ts:340-396`). **Four ads today = four separate campaigns and
four separate ad sets.** No code path anywhere adds an ad to an EXISTING ad set.

⚠️ **THIS IS THE REAL CONTENT OF STEP 4, AND IT IS A SERVER CAPABILITY, NOT A UI CHANGE.** The
point of shipping distinct variants is that Meta compares them INSIDE ONE AD SET and distributes
across them. Four ads in four campaigns do not compete in a shared auction — they are four
unrelated campaigns with separate budgets, which defeats the distinctness work no matter how good
the copy is. Step 4 must add "publish N ads into one campaign/ad set" before any multi-select UI
means anything.

### 🔴 META CONTROL RUN — 2026-08-09. BLOCKED BY OUR OWN GATE, NOT BY META.

Run as userId **1** (the token is bound to user 1; the smoke account cannot publish). LP **221**
(`https://zapcampaigns.com/p/campaign-221`, service 270), verified genuinely live by HTTP 200 /
31KB rather than by a database row. Creative **368** (`person_shocked`/`benefit`). Harness:
`server/scripts/meta-control-publish.ts`, which ports `buildMetaInput()` and `deriveDefaultBody()`
VERBATIM so the capture reflects shipped behaviour.

**THE CONTROL PAYLOAD — keep this; the reroute run is diffed against it:**

| field | value |
|---|---|
| headline (Meta headline field) | `"Lose the mum tummy. Feel like you."` (34 chars) — the CREATIVE ROW's headline, image-side, ungated |
| body (Meta primary text) | `"This is not a workout class and it is not a meal plan handout. It is the explanation nobody gave you at your 6-week check — why your postpartum body responds differently to everything you used to do, and exactly what to do instead."` (231 chars) — landing-page `freeAngle.subheadline`, kit 185's angle |
| linkUrl | `https://zapcampaigns.com/p/campaign-221` · status PAUSED · dailyBudget $1 |

**ZERO of the four Graph calls fired.** `publishToMeta` blocked at `meta.ts:316` — before
`createCampaign` at `:340` — with `classes=[second_person_protected_attribute]`. The gate is RIGHT:
the body says *"your postpartum body"* and *"nobody gave you at your 6-week check"* — second-person
assertions about a protected attribute.

🔑 **THIS IS THE STRONGEST ARGUMENT FOR STEP 1, STRONGER THAN THE DISTINCTNESS CASE.** The landing
page subheadline was written as PAGE copy and never passed the compliance layer as AD copy. Gated
Node 7 bodies DO pass it at generation. So the live path can hard-fail at the final step on copy
nobody ever screened for this use, after the coach has done everything right. **No retry was
attempted on a different LP — picking one whose subheadline happens to pass would have buried the
finding.**

✅ **THE META CONNECTION IS CONFIRMED LIVE.** `getCampaigns` returned **25 real campaigns** off the
account, so token, app config and the Graph READ path all work today. Token expires **2026-10-05**
(~58 days). Only the WRITE path is still unproven — and it is unproven because our own gate never
let it try. Nothing was created: `ZZ-CONTROL present? false`, verified by read-back.
⚠️ **This ad account carries Arfeen's REAL advertising** (`[ME] CBO | Leads | UAE`, `Crypto Workshop
GCC/UAE`). It is not an empty sandbox — scope every future live-fire accordingly.

### 📌 PARKED — none of these block step 1

- **Meta-side campaign orphans.** The account shows **FIVE** campaigns named "Auto Campaign Kit"
  while `meta_published_ads` holds **TWO** rows. Most plausibly a publish that got past
  `createCampaign` and failed later, leaving an orphan — the same shape as the Cloudinary orphan
  class. **Observed, not concluded; needs its own look.**
- **Eight Cloudinary orphans** from runs predating 0099 (`generated_17862073*` ×4,
  `generated_17862012*` ×4). Urls never recorded, unrecoverable from the database; they need the
  pattern-scoped listing sweep (`cloudinary.search` sorted `created_at desc`, NOT `api.resources()`).
- **The live PAUSED reroute run** — pending Arfeen's explicit word, and only after the payload-level
  proof passes.

### The approved publish-path design (Arfeen, 2026-08-09) — build sequence

1. **Reroute the published headline and body to the gated pool.** Retire the image-side headline
   generation from the tabloid render path so the picture and the headline FIELD carry the SAME
   gated line — two different headlines would be spec §3's "three unrelated messages", worse than
   repetition. ⚠️ The reroute inherits no length guard (the ≤38 validator lives in the retired
   side-generation), so it needs an explicit length rule. Record provenance on the published row,
   which also closes the `adSetId: "temp"` traceability gap in §8c.
2. **Stamp `conceptId` on `adCopy`** — additive migration, travels alone. Pair by id, NEVER by
   matching desire/awareness label text: two concepts can share a stage and a silent mispair is
   invisible.
3. **Tie images to concepts** — additive `conceptId` on `adCreatives`. Also defuses the
   `awarenessDeckPlan` trap (distinct stages guaranteed only at ≤4 slots).
4. ✅ **DONE (`793d4ed`) — Ad assembly: one concept → one ad.** Headline, body, hook and image all descend from the same
   persona/desire/awareness concept. **Each body is used by AT MOST ONE ad; if bodies run short the
   campaign ships FEWER ads rather than reusing one** — the never-pad rule applied to assembly.
   Today every ad in a push ships the identical operator-typed body, a 100% duplication rate.
   Fixing the pairing also strengthens the anti-echo: it currently checks a pool that can be
   recombined arbitrarily at publish, whereas with fixed concept pairing **what is checked is what
   ships**.
5. **Congruence: THE LANDING PAGE IS THE ANCHOR — LOCKED.** The gated body aligns TO the page,
   never the page to the body. The page is the destination, exists earlier in the cascade, is what
   Meta scans for compliance, and one page serves many ads — regenerating it per winning ad breaks
   that shape. Seeding the page from a winner is a POST-LAUNCH optimisation, not this build.
   `checkAdToPageMatch` (`meta.ts:304`, already called at publish) is promoted from advisory to
   gate, and the page's own lines join the anti-echo avoid-list so the body agrees with the page
   without parroting it — today's degenerate default IS the subheadline.
6. **Only then** revisit the hook bar and 4 → 8.

📌 **Step 1 does NOT depend on concepts** and can land alone. Step 4 does depend on steps 2 and 3.
📌 **Open, not designed over:** how a coach reviews and confirms N assembled ads. `publishToMeta`
builds ONE ad per call; the multi-ad UI shape needs its own look before step 4 is specified.

7. **Then deploy**, which needs Arfeen's explicit "push" like every other deploy.

✅ **The distinctness gate is DONE** — built, proven live on BOTH nodes, committed locally. See
§12.6 for the measured before/after numbers, the two defects the first run exposed, and what is
still unexercised.

⚠️ **Migration 0097 is ALREADY APPLIED TO PRODUCTION** — four additive nullable columns
(`persona`, `desire`, `awareness`, `format`) on `headlines` and `adCopy`. Additive and inert: no
deployed code reads or writes them, because the code that does is the unpushed work. Do not
re-apply it, and do not treat its presence as evidence the copy engine is live.

⚠️ **`docs/handovers/STATE.md` is dated 2026-07-28 and knows nothing about the last six sessions.**
It has been wrong more than once. **Trace code and query the DB; do not trust handover prose.**

---

## 1. Where the repo is

| | |
|---|---|
| Branch | `railway-build` — the only deploy branch. Never push `main`. |
| HEAD / origin | **Do not read a SHA from this file. Run the command below.** |
| Deployed? | Railway auto-deploys `railway-build` on push. If HEAD == origin and Railway is green, the tip is live. |

```
git fetch origin railway-build && git rev-parse HEAD origin/railway-build && git log --oneline -8
```

⚠️ **THIS SECTION HARDCODED A SHA THREE TIMES AND WENT STALE THREE TIMES — SO IT NO LONGER CARRIES
ONE.** It claimed `eb50e3a` while the six-commit chapter had already shipped; it then claimed
`51bdd03` while the §11 canvas fix (`774a39b`) was already pushed and live. A fresh session reads
this file first, so a stale §1 is the most expensive stale prose in the repo. **The fix is not to
update the SHA faster — it is to stop storing one here.** Git is the source of truth for where the
repo is; this file's job is to explain what that code *means*, which is everything below.

**What is true as at 2026-08-06:** the Andromeda image chapter and the §11 canvas + routing fix are
both pushed and live. The narrative sections below describe that state. If `git log` shows commits
newer than §11's, this file has not caught up with them and the code wins.

**Push discipline is unchanged: the next push needs a fresh explicit "push" from Arfeen.** No prior
authorisation carries forward. Committing does NOT deploy; **pushing** deploys (~4s, no gate).

### The six commits that are live

| SHA | what |
|---|---|
| `e71f62f` | image engine Layers 1+2 — awareness × sub-type drives image selection |
| `eb50e3a` | stage-led engine, 4:5 feed, emitted-pixel text-safe band |
| `98cb623` | CHECKPOINT refresh |
| `e8c6ed3` | **visibility tier** — a repeated sub-type cedes its face rather than collapsing to one Entity ID |
| `5a42eaf` | deploy-gate fixture for `regenerateSingle` / `makeVertical` |
| `3d085ee` · `51bdd03` | id-scoped teardown rule · banked research reports |

Live in production, therefore: **stage-led shot concepts across five awareness stages** (Layer 1) ·
**sub-type styling** (Layer 2) · **4:5 feed with a per-canvas, emitted-pixel-measured text-safe band**
(Layer 3) · **the visibility tier** · compliance gate · awareness foundation · stage-aware copy.

Verified live by one labelled throwaway cascade (service 290), reconciled to baseline.

---

## 2. What `eb50e3a` actually changes

The awareness stage now drives the **shot concept** — subject, action, composition — and the sub-type
only **styles** it (lighting, backdrop, texture). Previously the style template fixed pose and
composition and the stage was appended afterwards, so it modified a decision already made.
`[AWARENESS-PLAYBOOK §3]` names that exact failure: *"If styling is allowed to lead, the ad risks
falling into 'default' poses… which trigger Entity ID clustering."*

Files: `routers/adCreatives.ts` · `_core/imageGeneration.ts` · `_core/compositeHeadline.ts` ·
`adCreativesGenerator.ts` · two test files · `scripts/measure-text-safe-zone.ts` · 3 research
reports + their README.

---

## 3. ✅ PROVEN — on live renders, zero DB writes, every run reconciled to 405

- **Layer 1 across all five awareness stages**, isolated: style and sub-type held constant, stage the
  only variable, with the styling half of every prompt asserted **byte-identical before any spend**.
  A same-prompt control render sets the diffusion-noise floor — noise changes *who and how*, the
  stage changes *what is happening*.
- **Fix 1 — Problem-Aware** carries friction in the **environment**, not the face. The first rebuild
  used "a hand at the temple", which the banked guardrails list verbatim as a prohibited distress
  trigger carrying *"a total retrieval penalty"*.
- **Fix 2 — Product-Aware** is an expert mid-demonstration addressing someone off-camera. It had been
  rendering as a head-on portrait, colliding with Most-Aware's PD-4 direct address. Guarded by test.
- **Fix 3 — verified ONLY on the composite.** Headline/body/CTA land on darkened defocused surface
  instead of across the work the scene was told to keep clear. ⚠️ **The raw render looked fine while
  the finished ad was broken — raw pixels cannot prove this.**
- **4:5 feed** with the reserved band keyed to **emitted pixels**, plus its guards (§4).
- **Still-life `screenshot` slot has pixels for the first time** — person-free, abstract text-free
  screen, clean plate held, and it stayed on gpt-image-1. **n=1.**

Proof images on disk (not committed — binary weight):
`docs/screenshots/run-2026-08-05-layer1-isolation/` · `run-2026-08-05-layer1-reprove/` ·
`run-2026-08-06-layer3-45/` · `run-2026-08-06-layer3-verify/`.
`run-2026-08-05-layer12-proof/` is the **pre-rebuild** "before" set.

---

## 4. The text-safe band — measured, per-canvas, and guarded

**Do not replace this with a constant.** It was measured by pushing a synthetic plate through the
real compositor at worst-case content (`scripts/measure-text-safe-zone.ts`).

| canvas | topmost glyph | reserved | wording |
|---|---|---|---|
| Flux 4:5 → **896×1088** | 0.6445 | 0.5048 | "the lower three-fifths" |
| gpt-image-1 4:5 → **1024×1280** | 0.6445 | 0.4955 | "the lower half" |
| 1:1 1024×1024 | 0.5693 | 0.5707 | "the lower three-fifths" |
| 9:16 1080×1920 | 0.5875 | 0.5515 | "the lower three-fifths" |

- **NOT ratio-invariant** — 4:5 and 9:16 are **5.7pp apart**. A scalar silently mis-reserves the
  9:16 path. Size-invariant *within* a ratio (1024×1280 vs 1440×1800 differ by 0.0001).
- `reservedFromBottom = 0.376 × W + padBottom(H)` — predicts 9:16 to within **two pixels**.
- **Keyed off EMITTED pixels, never the ratio string.** Flux answers "4:5" with **896×1088** (0.824);
  gpt-image-1 returns a true 1024×1280. Those straddle a band boundary, so the person slots were
  under-reserving by ~1pp — clearance by margin, not design. **Flux is deliberately NOT forced to
  exact 4:5**; 896×1088 is a valid Meta asset.
- **Crop direction settled on pixels**: `DEFAULT_CROP_DIRECTION = "bottom"` (keep the upper 1280).
  gpt-image-1 cannot emit 4:5, so it renders 1024×1536 and is cropped. The alternative was cramped
  and top-heavy. Both candidates are in `run-2026-08-06-layer3-45/08-crop-A` vs `08-crop-B`.
- `imageFormat` now records dimensions read off the rendered buffer, so a row cannot lie.

---

## 5. 🔴 OPEN — read this before claiming anything works

1. **THE WIRING GAP IS THE NEXT ROCK.** **Five of eight fan-out sites pass no stage** and render the
   pre-rebuild prompt. Only the cascade (`adCreativesGenerator.ts`) carries Layers 1–3.
   ⚠️ **Opening this forces the 4-vs-8 cardinality decision** — the tabloid deck is 4
   (`AD_VARIATIONS`), the concept batch is 8, and `adCreativesGenerator.ts:534` **throws** on a
   mismatch because a mismatch once caused a live outage (`5f3294d` → `304f6fd`). **Arfeen's call.**
2. **Esoteric and aspirational sub-types are unproven** with the new shot concepts. Only `grounded`
   has been rendered since the rebuild.
3. **flux@9:16 emission has never been measured.** It takes the conservative fallback.
   **Measure it before any stage-led vertical ships.**
4. **The editorial path has no Layers 1/2/3** and is untouched. A run routing editorial proves nothing.
5. **Four person stages (Unaware, Problem-Aware, Product-Aware, Most-Aware) were not re-rendered**
   after the band was rekeyed to emitted pixels. That change only **widened** clearance so it cannot
   have regressed them, but they are unswept — fold into the next full run.
6. **DEPLOY IS GATED on the shared paths.** `makeVertical` (9:16) and `regenerateSingle` share
   `generateAdImagePrompt` / `rendererForStyle` / `renderAdCreative`. **None of the five wizard
   procedures has an automated test** and they are historically error-prone (P6b). Exercise them
   before pushing. (`5a42eaf` added `sharedProcedureShapes.test.ts` for the first two — a shape
   fixture, NOT a render proof.)
7. **`makeVertical` builds its prompt with no aspectRatio**, so its reserved band comes from the
   static legacy clause while it renders 9:16 — the canvas whose true reserve is **0.5515**, furthest
   from the others. Inert today because it takes PATH A, but it is the same omission
   `regenerateSingle` had. **Not fixed — deliberately out of scope of the 08-06 canvas fix, which
   Arfeen scoped to two sites.**
8. **`generateAsync` (`routers/adCreatives.ts:1552`) passes NO aspectRatio AT ALL — so it still
   emits 1:1 while the cascade emits 4:5.** Found 2026-08-06 by tracing every prompt-builder call
   site; not previously written down. Neither the `generateAdImagePrompt` call at `:1552` nor the
   `genImg({ prompt, style })` call that follows it carries a ratio, and `generateImage` defaults
   `aspect_ratio` to `"1:1"` (`imageGeneration.ts:265`). **This is the same missing-argument family
   as the `regenerateSingle` fix (§8b symptom 1) and as `makeVertical` (item 7) — three instances of
   one shape.** Unlike item 7 this one is NOT inert: any card produced by this path is a different
   SHAPE from a cascade-produced sibling. It also takes PATH A (no stage passed), so it renders the
   pre-rebuild prompt as well. **Not fixed, nothing touched — logged for a decision.** Fixing it is
   the same one-line shape as the two sites already fixed, but it belongs to the wiring gap (item 1)
   and therefore inherits the 4-vs-8 cardinality question, which is **Arfeen's call**.

---

## 6. ⚠️ EVERY GATE IS BLIND TO WHETHER A PICTURE IS GOOD

G4 checks only that a non-empty PNG reached disk. Nothing in the suite can see melodrama, legible
in-image text, an anatomical failure, or a subject buried under the headline.
**That judgement is Arfeen's and only Arfeen's. CC never self-certifies a visual result.**

---

## 7. Production data — verified 2026-08-06 (re-verified post-deploy by direct query)

- `adCreatives` = **405** (the baseline). `meta_published_ads` = **2**. `jobs` running = **0**.
- **All campaigns currently on ZAP are dummy/test data.** Nothing to preserve, migrate, or keep
  backward-compatible. This drops the urgency of the sites-4/6 stage-column migration — no real old
  campaign needs regeneration coherence.
- 🔴 **CORRECTED 2026-08-14 — THE PROTECTION ON SERVICES 272–277 AND 285 IS NOT RETIRED. THE
  RATIONALE IS.** This line used to open *"The 'never touch services 272–277 and 285' protection is
  RETIRED"*, which read as permission and contradicted three other places in this repo. What was
  actually retired is the *reason to treat them as precious*: those 29 creatives are confirmed
  pre-rebuild dummy/old-engine — 25 belong to the E2E smoke account (`117174`, created Jul 23–24),
  4 are Arfeen's own Aug-3 old-engine set, and **none is behind a live ad**. They are therefore
  deletable for a clean slate, but **only on Arfeen's explicit instruction, and any delete is
  id-scoped** (§10) — which is what the original line's own final clause already said.
  **The RULE stands, and is enforced in three independent places:**
  · §10 — *"Do NOT write to protected services 272–277, or to service 285"*;
  · **the code** — `PROTECTED_SERVICE_IDS` in `server/lib/adCreativeTeardown.ts` is checked against
    the RESOLVED ROWS and throws `ProtectedServiceError` before touching Cloudinary or the database
    (§12.11 step 1), and it cannot be folded into the userId guard because user 117174 legitimately
    OWNS 272–277;
  · **the reconciliation baseline** — `272:5 273:5 275:5 276:5 277:5 285:4` = **29** is the figure
    every teardown in this chapter reconciles against. Deleting them destroys the baseline itself.
- **The two `meta_published_ads` rows are app-review dummies** — both `userId=1`, both **PAUSED**,
  both created **2026-05-12**, objective `OUTCOME_LEADS`, campaign name "Auto Campaign Kit". Not real
  campaigns. **No real Meta ad work has been done.**
- **Protected services untouched:** `272:5 273:5 275:5 276:5 277:5 285:4` — 29 creatives.
- **The 409-vs-405 drift is resolved.** It was NOT failed teardown: the previous proof's teardown was
  clean (0 surviving proof services, 0 orphan rows). Four rows (450–453, service 287, user 1) were a
  dummy demo campaign Arfeen made on 2026-08-05; he authorised their deletion and they are gone.
- ⚠️ **Service 287 still exists** and is NOT a shell — ~115 rows across 11 tables (60 hvcoTitles,
  14 placeholderValues, 11 heroMechanisms, 10 headlines, 9 adCopy, 6 campaignConcepts, plus ICP,
  offer, LP, email and WhatsApp). It now has **0 adCreatives** and is inert. Deleting the service row
  would cascade-delete the placeholderValues and orphan ~101 rows at `serviceId = NULL`. **Not done;
  needs its own decision.**

---

## 8. Gates

⚠️ **RECORD THE COMMAND, NEVER A BARE COUNT.** This section used to carry figures like "574 tests
green" with no record of which suites produced them. A number with no command behind it **cannot be
re-verified**, and on 2026-08-08 a fresh session lost a round trip proving exactly that: tsc
reproduced to the digit, the copy-engine set reproduced to the digit (442), and "574" turned out to
be unreconstructable because three different sessions had each used a different ad-hoc suite list.
Every count below now travels with the command that produces it.

**The canonical gate command for the copy engine + image sprint** (13 suites — run this, quote its
output, and update the number here when the suite list changes):

```
npx vitest run \
  server/pipeline-fixes.test.ts server/lib/complianceFilter.test.ts \
  server/_core/tokenCrypto.test.ts server/adCopyAngles.stageAware.test.ts \
  server/conceptGenerator.test.ts server/conceptValidator.test.ts \
  server/_core/pdafGate.test.ts server/headlinesTemplateTokens.test.ts \
  server/lib/adCreativeTeardown.test.ts server/_core/compositeShortHook.test.ts \
  server/_core/imageHookRedraft.test.ts server/sharedProcedureShapes.test.ts \
  server/_core/imageRenderer.test.ts
```

→ **556 passed across 13 suites** (re-measured 2026-08-11). It read **552** from 2026-08-08 and had
gone stale by four: the 4c harness rework touched none of these thirteen files, so the delta
predates it and the doc was simply behind. The six-suite copy-engine subset alone is **442**, which
is the figure §12.6 quotes.

**The 4c safety set** — `metaSafety` · `metaTeardown` · `publishLedger` · `multiAdPublish` ·
`adAssembly` · `adCreativeTeardown` · `operatorFields` · **`step4cPageAnswers`** ·
**`step4cRunState`** → **241 passed across 9 suites, 0 skipped** (re-measured 2026-08-18; it read
**217** at 2026-08-11 and the delta is the 08-12 min-2-floor and `booking_url` work, which §0
already records as +17 and more). The last two are new with the three-phase rework. Scanned for
`.skip` / `.todo` / `.only` / `xit` / `xdescribe`: none present in any of the nine, so nothing is
silently excluded.

⚠️ **RUN IT BY THESE PATHS — SEVEN OF THE NINE ARE IN `server/_core/` AND TWO ARE NOT.**
`operatorFields` lives at **`server/lib/templates/operatorFields.test.ts`**, NOT `server/_core/`,
and `adCreativeTeardown` at **`server/lib/`**. Guessing `server/_core/operatorFields.test.ts` does
not error — **vitest silently runs 8 suites / 180 and reports them all green**, which reads exactly
like a pass of the full set. Caught 2026-08-18 while gating the classifier precision fix.

```
npx vitest run \
  server/_core/metaSafety.test.ts server/_core/metaTeardown.test.ts \
  server/_core/publishLedger.test.ts server/_core/multiAdPublish.test.ts \
  server/_core/adAssembly.test.ts server/lib/adCreativeTeardown.test.ts \
  server/lib/templates/operatorFields.test.ts \
  server/_core/step4cPageAnswers.test.ts server/_core/step4cRunState.test.ts
```

📌 **This is the "a number with no command behind it cannot be re-verified" lesson at the top of
this section, recurring one paragraph later** — the count travelled without its paths, and the
paths were where the error was.

- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **34** (34 re-confirmed 2026-08-06 post-deploy after
  the §11 canvas fix, again 2026-08-08, and again 2026-08-12 either side of the min-2 floor)
  ⚠️ **ONLY THE COUNT 34 HAS EVER BEEN STORED — there is NO per-error baseline list anywhere in this
  repo.** So "the baseline held" can only ever mean the COUNT reproduced; it has never meant the same
  34 errors. Two errors could swap — one fixed, one introduced — and every gate in this file would
  pass. **If that distinction matters for a given change, capture the list BEFORE touching anything
  and diff it, because there is nothing to diff against after the fact.** A list was captured
  2026-08-12 to a session scratchpad as `tsc-now.txt`; ⚠️ **that path is ephemeral session scratch and
  will NOT survive**, so the command above is the only durable source. As at that capture the 34 sat
  in: `V2GeneratorWizard.tsx` 8 · `AdminDashboard.tsx` 7 · `V2LandingPageResultPanel.tsx` 3 ·
  `V2AdImageCreator.tsx` 3 · `admin.ts` 2 · `oauth.ts` 2 · then one each in `campaignKits.ts`,
  `autoMode.ts`, `landingPageHtml.ts`, `_core/index.ts`, `icpEnrichment.ts`,
  `V2WhatsAppResultPanel.tsx`, `ComplianceWarningPanel.tsx`, `AdminContentModeration.tsx`,
  `CampaignCreativesSection.tsx` — all pre-existing legacy/V2 files, none in the publish path.
- **554 tests across 12 suites**, including `server/textSafeZoneCoupling.test.ts`. The copy-engine
  gate set (`pipeline-fixes` + `complianceFilter` + `tokenCrypto` + `adCopyAngles.stageAware` +
  `conceptGenerator` + `conceptValidator`) = **442 passed**, re-run after the copy work.
- CLAUDE.md §8 gate suites re-run 2026-08-06: `pipeline-fixes` + `complianceFilter` + `tokenCrypto`
  = **407 passed**. Image suites = **108 passed** across 6 files.
- ⚠️ `jobs` is **NOT a baseline metric** — 24h retention. Only `running = 0` has signal.

---

## 8b. 🔴 `regenerateSingle` — the diagnosis was TOO NARROW (corrected 2026-08-06)

It was recorded as *"screenshot rows regenerate on Flux (no style passed) — one-line fix"*. Traced,
the omission at **`routers/adCreatives.ts:1078`** is real but has **two live symptoms, not one**, and
a third that turned out to be a non-issue worth writing down so nobody re-derives it.

The canonical call is `adCreativesGenerator.ts:621` — `{ prompt, style, aspectRatio: FEED_ASPECT }`.
`regenerateSingle` passed **none of the three**.

| # | symptom | live? |
|---|---|---|
| 1 | **Emits 1:1 while the four sibling cards in the deck are 4:5** — a regenerated card is a different SHAPE. `generateImage` defaults `aspect_ratio` to `"1:1"` (`imageGeneration.ts:265`). | 🔴 **yes, and the most visible** |
| 2 | **Wrong model** — `rendererForStyle(undefined, …)` returns Flux, so a stored `screenshot` row loses gpt-image-1 (bake-off **6/6 vs 2/6** on niche relevance). | 🔴 yes |
| 3 | "Text-safe band computed for the wrong canvas" | ⚪ **NO — inert. See below.** |

⚠️ **SYMPTOM 3 IS NOT REAL TODAY, AND THE REASON MATTERS.** `generateAdImagePrompt` has two assembly
paths. **PATH A early-exits at `if (!stageAction) return stylePrompts[known]`** (`:719-720`) before
`zonePersonFor`/`zoneStillFor` are ever called. Both of these sites pass **no awareness stage**, so
they take PATH A and the `aspectRatio` argument is **never read** — the band wording comes from the
static `compositionPerson` / `compositionSetting` constants. Passing the ratio into the prompt
builder is therefore correct-and-inert; it goes live the moment these sites are wired to pass a stage
(the open fan-out gap, §5.1).

🔑 **AND MOVING TO 4:5 IMPROVES THE LEGACY WORDING RATHER THAN BREAKING IT** — measured against §4's
table, not assumed. The static clause says *"The lower half"*:

| canvas | true reserved fraction | static clause says | error |
|---|---|---|---|
| 1:1 1024×1024 (**old**) | 0.571 | "the lower half" (0.50) | **7.1pp UNDER-reserved** |
| 4:5 Flux 896×1088 (**new**) | 0.505 | "the lower half" | 0.5pp under |
| 4:5 gpt 1024×1280 (**new**) | 0.495 | "the lower half" | 0.5pp **over** — safe |

So these two paths were carrying a 7-point prompt/compositor disagreement at 1:1 and land within half
a point at 4:5. **This is a side benefit, not the reason for the fix, and it is still not a render
proof.**

**Also folded in, because leaving them out would create a NEW defect rather than avoid one:**
`imageFormat` is now measured off the rendered buffer at both sites (`regenerateSingle` previously
never updated it; `generateAdCreativesBatch` hardcoded `"1080x1080"`, which becomes a bigger lie once
the canvas moves). **`FEED_ASPECT` moved to `_core/adVariations.ts`** — it was a local `const` inside
`runAdCreativesGeneration`, which is precisely why two sibling loops never got it, and is the exact
duplication class that module's docblock exists to prevent.

---

## 8c. META — VERIFIED STATUS, scoped read-only 2026-08-06

**⚠️ THIS SUPERSEDES EVERY EARLIER NOTE TREATING META AS UNBUILT OR REVIEW-BLOCKED.** The handover
line *"the generate → publish-to-Meta → run path … is the real gate, and it's separate work"* was
wrong about the reason. **The integration is FULLY BUILT. The blocker is an expired user token.**

- ✅ **The publish path is real, end-to-end — not stubbed.** `meta.publishToMeta`
  (`routers/meta.ts:240`) makes four live Graph **v21.0** calls in sequence: `createCampaign` →
  `createAdSet` → `createAdCreative` → `createAd`, each a real `fetch` POST in `lib/metaAPI.ts`. Full
  CRUD plus status sync, alerts and pause/resume. **The client is wired:** `PushKitModal.tsx:291`
  calls it; `V2Settings.tsx` carries the connect flow.
- ✅ **App config is present on prod:** `META_APP_ID`, `META_APP_SECRET`, `VITE_APP_URL` all set on
  Railway service `coachflow` / environment `production`. `META_APP_SECRET` is read at
  `_core/metaOAuth.ts:37` and `routers/meta.ts:162`, nowhere else, and is not cached in a module
  variable — but `process.env` is fixed at process start, so a value change needs the restart Railway
  performs automatically on save.
- ✅ **RESOLVED 2026-08-06 — THE TOKEN IS RECONNECTED AND LIVE.** The expiry blocker recorded here
  is CLEARED. Verified by direct read-only query against production (token value never selected):
  `meta_access_tokens` still holds **exactly one row**, `id=3`, `userId=1` — `tokenExpiresAt`
  **2026-10-05**, i.e. **valid, ~59 days of runway**, `lastRefreshedAt` **2026-08-06 13:36**, with
  both `adAccountId` and `pageId` present. Note the reconnect **updated the existing row in place**
  (`connectedAt` is still 2026-05-11); it did not insert a second one, so "exactly one row" remains
  the correct expectation.
  ⚠️ **This proves the token is stored and unexpired — NOT that a publish succeeds.** `getMetaToken`
  (`metaAPI.ts:79`) will now return a token instead of `null`, so the four Graph calls will actually
  be attempted for the first time. **The first real publish is still unproven live-fire.** If it
  errors, read the exact Graph error out of the Railway logs rather than guessing — the four calls
  fail with distinct messages (`Failed to create Meta campaign` / `ad set` / `ad creative` / `ad`),
  and which one fires localises the problem immediately.
- ✅ **`adSetId: "temp"` IS NOT A MISSING AD-SET ARCHITECTURE.** The real Meta ad-set id is stored
  correctly beside it as **`metaAdSetId`** (`meta.ts:419`), returned by the mutation and used by
  status sync. `adSetId` is the **internal CoachFlow** grouping nanoid (`schema.ts:1077`, matching
  `adCopy.adSetId`), so `"temp"` means only that the published row is not traceable back to the
  ad-copy set that produced it. **An internal traceability gap. It does NOT block running an ad**,
  and it is not evidence of an unbuilt ABO layer.
- ✅ **OWN-ACCOUNT PUBLISHING NEEDS NO APP REVIEW.** Meta grants an app's admins/developers/testers
  full permission on assets **they own** while the app is in Development Mode. Arfeen is the app
  admin and the ad account is his, so **App Review is NOT on the path to running his own ad** — and
  the two ads that published on 2026-05-12 are explained by this, rather than being evidence that
  review passed.
- 🔵 **Advanced Access review is a SEPARATE, UNSTARTED TRACK** — required only to onboard OTHER
  coaches (serving `ads_management` against ad accounts Arfeen does not own). Its status lives in
  Meta's App Dashboard and cannot be read from this repo; it needs Arfeen's login. **Do not conflate
  the two: nothing about that track blocks the first real ad.**
- 📌 `metaConnections` is a **dead table** — 0 rows, zero code references. Only `meta_access_tokens`
  is live. Do not read it.

**Plain answer to "to run one real ad, what is the blocker?"** — on Arfeen's own ad account:
**nothing is blocking it any more.** The token is reconnected, the config is present, the path is
built. No review, no config, no build. What remains is a live-fire test of an existing path, not new
work. Onboarding other coaches is the separate Advanced Access track above.

**What the first publish will do, read off the code — it does NOT spend by default.** `status`
defaults to **`PAUSED`** in two independent places: the zod input default (`meta.ts`, the
`publishToMeta` input schema) and the operator UI's initial state (`client/src/v2/PushKitModal.tsx`,
`useState<"PAUSED" | "ACTIVE">("PAUSED")`). The same status is applied to campaign, ad set AND ad.
The daily-budget field starts at **$20 USD** (minimum $1) and is only ever charged once something is
switched to `ACTIVE`. **A publish left on the defaults creates a real, genuinely-in-Meta but PAUSED
ad that spends nothing** — which is the correct shape for the first live-fire test.

📌 **Housekeeping, 2026-08-06 — DONE.** `META_APP_SECRET` was exposed in a session transcript by a
failed redaction and **has been rotated**; the Meta connection was re-established in the same trip
(see the token row above). Rotation point is the Railway variable named above; Railway redeploys
`coachflow` automatically on save.

---

## 9. Traps specific to this work

- **The old test asserting the stage directive is APPENDED was DELETED.** It passed throughout while
  the stage never reached the picture — it was locking in the defect. Do not reinstate it.
- **`rendererForStyle` bounces unknown ratios to Flux.** Requesting a ratio gpt-image-1 cannot serve
  silently moves the still life off the model the bake-off chose (**6/6 vs 2/6** niche relevance).
- **The banked safe-zone figures describe META'S UI clearance**, not our own type. Never size our
  text band from them — measure it.
- **Research vs. code:** `[AWARENESS-PLAYBOOK §2]` asks for proof charts, calendars and labelled
  diagrams at various stages. **All are composed of text.** The object slot was retired over exactly
  this (48 renders, 2 leaked). Three departures are documented on `AWARENESS_DEPICTION`. PD-4 stands.
- **`[AWARENESS-PLAYBOOK §4]` contradicts its own §3** — its table makes Action a function of style.
  §3 + §2 govern.

---

## 10. Standing rules

- **⛔ NO PUSH WITHOUT ARFEEN'S EXPLICIT "push" IN THE IMMEDIATELY PRECEDING MESSAGE.**
  **`railway-build` auto-deploys on push — a push IS an instant production deploy.** Each
  authorisation is one-time and covers one action; it never carries to the next.
- **Every prod write needs explicit "execute"/"go ahead" in the immediately preceding message.**
  Same rule for deletes and restores, no exception for "small", "test-account" or "obviously right".
- **Migrations 0097–0104 are APPLIED to production — do NOT re-apply any of them.**
- **Off-machine backups go ONLY to `backup/publish-path-sprint-2026-08-08`, never to `railway-build`.**
- **The step-4c Meta publish scripts under `server/scripts/` shipped DORMANT — do not invoke them.**
- **A LIVE RENDER IS THE ONLY PROOF OF A LIVE IMAGE PATH** — and for anything involving the text
  overlay, **the COMPOSITE is the only proof**. The raw render passed while the finished ad was broken.
- **Save proof images to disk BEFORE any teardown.** Teardown outranks the artifact read.
- **⚠️ TEARDOWN IS NOT DONE WHEN THE DB RECONCILES — IT MUST CLEAR CLOUDINARY TOO, AND THE ORDER IS
  FIXED: READ THE public_ids, THEN DELETE THE ROWS.** A DB delete never touches Cloudinary, and once
  the rows are gone **the URLs are unrecoverable from the database** — the images stay hosted
  forever. `server/lib/adCreativeTeardown.ts` exists precisely for this and does the two steps in the
  correct order; its docblock records the 30 orphans that accumulated across three runs on
  2026-07-29 before it was written.
  **This rule is here because CC broke it on 2026-08-06** — `scripts/regen-canvas-proof.ts` deleted
  its two rows directly, reported "405 ✅ RECONCILED", and left 4 orphans (raw + composited × 2). A
  green reconciliation line said the run was clean when it was not.
  **Recovery, if it happens again:** the ids can still be recovered from Cloudinary by listing —
  but use `cloudinary.search` sorted by `created_at desc`, **NOT `api.resources()`**, which caps at
  500 per page in no useful order and returned zero matches on the first attempt.
  `scripts/sweep-regen-canvas-orphans.ts` is the worked example (dry-run by default, pattern-scoped,
  refuses to delete unless the match count is exactly what was expected).
- **Do NOT write to protected services 272–277, or to service 285.**
- **⚠️ TEARDOWN IS ALWAYS ID-SCOPED, NEVER USER-SCOPED.** Smoke user **117174 OWNS the 25 protected
  creatives on services 272–277** (verified 2026-08-06). A teardown written as "delete this user's
  rows" would destroy them. Always `WHERE id IN (…)` plus a userId guard — never userId alone.
- **Write prose-heavy records with Write/Edit, never a bash heredoc** — backticks get shell-substituted.
- **⚠️ ONLY THE TABLOID DECK IS 4.** `EDITORIAL_VARIATIONS` stays 5.
- **Untracked earlier-session files are deliberately left alone: 331 as at 2026-08-12.** Never sweep
  them into a commit — `git add -A` / `git commit -a` is always wrong in this repo. Stage named
  paths only.
  ⚠️ **CORRECTED 2026-08-12 — this line used to say "539 … and it only ever grows". BOTH HALVES WERE
  WRONG.** It reads **331** now, DOWN from 539 on 2026-08-06, so something cleared proof files
  between those dates and the "only ever grows" claim is false. **Do not treat any count here as a
  tripwire** — a drop is not evidence of a deletion incident and a rise is not evidence of a leak;
  these are untracked proof screenshots, not tracked state. The count is a point-in-time
  observation. **The rule that matters is "stage named paths only", and it does not depend on the
  number.**
- **`railway run` block-buffers stdout.** Two runs today were invisible for 25 minutes while failing.
  Proof scripts log to a file with `appendFileSync` as well as stdout — keep that.
- **`MYSQLHOST`/`MYSQLPORT`/`MYSQLPASSWORD` are NOT set on the prod service.** Only `DATABASE_URL` is.
  Parse it (`python3 -c "urllib.parse.urlparse(os.environ['DATABASE_URL'])"`) and pass the parts to
  `mysql`; the CLAUDE.md §10 snippet using `$MYSQLHOST` fails with *"Empty value for 'port'"*.
- **The Drizzle key is not the table name.** `metaPublishedAds` in `schema.ts` is **`meta_published_ads`**
  in MySQL — querying the JS key errors with *"table doesn't exist"*. §9 of CLAUDE.md, in the wild.

---

## 11. ✅ SHIPPED — the two-site canvas + routing fix (2026-08-06), PROVEN LIVE

**Files:** `_core/adVariations.ts` (adds `FEED_ASPECT`) · `adCreativesGenerator.ts` (imports it, same
value, zero behaviour change) · `routers/adCreatives.ts` (the two call sites) ·
`sharedProcedureShapes.test.ts` (routing assertion **inverted** — it previously pinned the defect on
purpose, with a comment saying it was pinned "so the fix is a deliberate, visible change").

**Gates:** tsc **34**, six image suites **108 passed**, gate suites **407 passed**.

### Proven on prod, not on tests — `scripts/regen-canvas-proof.ts`

The harness calls **`appRouter.createCaller(ctx).adCreatives.regenerateSingle(...)`** — the real tRPC
procedure including its `setImmediate` background body. It does **not** re-implement the sequence; a
rebuilt sequence would prove the harness (STANDING RULE 2). Two labelled throwaway rows created and
regenerated, so **no pre-existing row was read-modify-written**.

| row | style | renderer | emitted | `imageFormat` written |
|---|---|---|---|---|
| 460 | `screenshot` | **gpt-image-1** (24.7s) | **1024×1280** | `1024x1280` ✅ |
| 461 | `person_shocked` | **flux-1.1-pro** | **896×1088** | `896x1088` ✅ |

Both rows were seeded with the old `1080x1080` lie and the fix overwrote each with true emitted
dimensions. **The person slot correctly STAYED on Flux** — a fix that moved every style would have
been a regression, not a fix. Images: `docs/screenshots/run-2026-08-06-regen-canvas/`.

**Reconciled:** `adCreatives` 405 → 407 → **405**, running jobs **0**, Cloudinary swept 4/4.

### ⚠️ Judged by Arfeen, and one thing is NOT fixed by this

The person card is clean — face entirely clear of the headline. **On the still life the headline
crosses the laptop screen and mug while the top ~45% is empty wall**: the legacy PATH A clause says
*"the main object sits high in the frame"* and the model did not obey. **This fix neither caused nor
cured that** — these paths were already on the legacy composition at 1:1, and there is no 1:1
before-shot from this path to compare against. Logged as a separate prompt-adherence issue on the
legacy still-life composition. Approved for ship by Arfeen on the pixels.

---

## 12. ✅ THE COPY ENGINE — built, PROVEN LIVE, committed LOCAL ONLY (not deployed)

The copy equivalent of the image chapter. Same discipline: a researched rule, applied in the
generator, judged against real produced output — not a green test.

**Research + spec are banked in git** (commit `d9dc69c`): six NotebookLM reports at
`docs/andromeda/copy-research/`, plus the build spec, the alignment audit and the as-built
description at `docs/andromeda/`. The build spec's §8a records the settled product decisions.

### 12.1 The rule everything serves

From `docs/andromeda/copy-research/Andromeda_Copy_EntityID_Distinctness.md`: two pieces of copy are
genuinely different to Meta only if they differ on **at least two of four** dimensions — **P**ersona,
**D**esire, **A**wareness, **F**ormat. Differ on 0 or 1 and Meta collapses them into one Entity ID
with one auction ticket. **The gate is this categorical 2-of-4 check. It is NOT a cosine score** —
the 0.40 figure that appears in the audit comes from a local model that is not Meta's, and the
audit contradicts itself on it (its own evidence-hygiene section excludes static thresholds).

### 12.2 What was measured — the whole point of this chapter

Phase 0 baseline, measured on production before any change: **69–71% of all copy pairs collapsed**;
both headline populations were at **100%**.

| population | no stage | stage + format | **+ desire (now)** |
|---|---|---|---|
| Node 6 headlines | 100% | 42.3% | **19.4%** |
| Node 7 headlines | 100% | 37.1% | **17.1%** |
| Node 7 bodies | — | 26.7% | **13.3%** |
| fused surfaces (headlines + bodies) | — | — | **17.2%** |

All figures MEASURED on live generated decks against the stamped columns, never estimated.

**Three of four axes are live: awareness, format, desire. Persona is still pinned** — one ICP means
one target market across a whole deck, and the concept engine pins it too (`conceptGenerator.ts`
sets `personaLabel` once from the ICP). Before desire landed, no pair anywhere could exceed TWO
differing axes; the live decks now show pairs at three, which is what proves the axis is real
rather than a label.

### 12.3 What is built and proven

1. **Node 6 — awareness stage** (`headlinesGenerator.ts`). Accepts an optional stage; otherwise
   distributes the set across stages via `awarenessPlanForCount`, the same cold-weighted allocation
   ad copy uses. **Planned across the WHOLE SET and dealt to the formulas, never per formula** —
   per-formula planning left 10 zero-axis pairs and starved product_aware of every slot.
   Stage guidance is the Headline (Intrigue) column of `[COHERENCE §2]`, kept in `adCopyAngles.ts`
   beside the Primary-Text column so the two halves of one research table cannot drift.
2. **Node 7 — awareness on all surfaces + three-surface chaining** (`adCopyGenerator.ts`).
   Headlines and links now carry a stage (they carried none). The three surfaces are generated as a
   CHAIN: headline first, then the body paired with a same-stage headline and told not to restate
   its nouns and verbs and to open on the priming words, then the link description aware of both.
3. **The desire axis, durable and early** (`conceptGenerator.ts`, `routers/campaignKits.ts`).
   Concept generation moved from the ad-copy entry to **campaign-kit creation**, four nodes earlier,
   made durable with a deterministic per-ICP job id, and left non-blocking. Both copy nodes read the
   concept set's desires and deal them across their slots.

### 12.4 Decisions LOCKED (do not reopen without Arfeen)

- **Cardinality target is 8** — proven on COPY only. **Image growth 4 → 8 is deferred** to its own
  sprint. Do not ship 8 copy angles against 4 images: two ads sharing a picture re-collapse, which
  is exactly what the image chapter was spent eliminating.
- **Variation counts are configurable** (`_core/variationCounts.ts`), defaults reproducing the old
  behaviour exactly. **The cut happens AT THE GATE, never by generating fewer** — the gate needs a
  surplus to reject from.
- **Link descriptions are OUT of the distinctness population.** A 30-character CTA surface is not
  one of the three fused surfaces (image / headline / body), so link-vs-link collapse is not a real
  delivery signal. They keep the awareness stamp for coordination and are never counted.
- **Anti-echo must be DECK-WIDE at the gate, not pairwise.** Publishing recombines headlines and
  bodies, so complementarity has to hold across the combinations that can actually ship — not just
  the 1:1 pair generation happened to produce.
- **Yield is handled by OVER-GENERATING and by biasing proof-less coaches toward proof-free angles.
  Never by padding** a batch to hit a number.
- **The gate compares axes ASSIGNED at generation, never inferred from finished text.**
  `format` reuses the formula (Node 6) or angle (Node 7) each piece was already written to — no
  parallel taxonomy.

### 12.5 Open items

- **Node 6 still shows 3 zero-axis pairs.** Pigeonhole, not a defect: 25 headlines over 20
  (stage × formula) cells must repeat. **Retired by the volume trim** when counts drop to the
  budget band. Node 7's equivalent went 3 → 0 once the whole-set dealing was ported to it.
- **Node 6 falls back to a single desire on the no-service path.** It resolves an ICP only when a
  serviceId is supplied; without one there are no concepts. The fallback is the pre-change
  behaviour, so nothing regresses. **Whether that entry SHOULD resolve an ICP is a product call**
  — it means either demanding a service or guessing which ICP a headline set belongs to.
- **Concept yield is not guaranteed to equal the ask.** A launch-stage fixture asked for 8 and kept
  **4**: the gate blocked all 8 first-pass (`invented_testimonial`, `unearned_authority`), recovered
  none on retry, kept 4 on the per-concept pass. A coach with no proof makes the model reach for
  proof it does not have. This is the yield the over-generate decision above exists to absorb.

### 12.6 ✅ THE GATE — BUILT, PROVEN LIVE ON BOTH NODES, COMMITTED LOCAL ONLY

**Not deployed.** Committed locally with the rest of the copy chapter; the next push needs a fresh
explicit "push" from Arfeen like every other deploy.

`server/_core/pdafGate.ts`, with the comparator moved from `scripts/` to `_core/pdafDistinctness.ts`
unchanged — it was written to make that move. Four stages in order: **evict** (max-degree greedy,
ties to the later item so runs are reproducible) → **regenerate** (capped, reusing
`COMPLIANCE_RETRY_MAX_ATTEMPTS`, no new ceiling) → **deck-wide anti-echo** → **trim to band**.

Settled by Arfeen 2026-08-07: band defaults to **small (8-12) as an explicit setting, never inferred
from a Meta daily budget**; Node 6's no-service path keeps its single-desire fallback; anti-echo
starts at a **shared three-word run, labelled a tunable heuristic in code**. The **2-of-4 categorical
rule is the sole authority** — no score in the module decides pass or fail.

#### Proven live on production, measured off the stamped 0097 columns

| run | node | before | after | ledger | composition |
|---|---|---|---|---|---|
| `vO1S7PVlm6G6EM76qYMX2` | 7 | 35 pairs (7.5%) | **0 (0.0%)** | evicted 19 · recovered 7 · **dropped 12** | 🔴 11 headlines / 1 body |
| `kxIJSJURbLVZ7SPpleBX0` | 7 | 35 pairs (7.5%) | **0 (0.0%)** | evicted 19 · **recovered 19** · dropped 0 | ✅ **6 / 6** |
| `XBNb-yre_-dTkWGxDxFx9` | 6 | 29 pairs (9.7%) | **0 (0.0%)** | evicted 13 · recovered 8 · dropped 5 (all honest) | 12 kept, **11 landed** 🔴 |
| `BcqE6DizGMUFkpNY4XWi5` | 6 | 22 pairs (9.5%) | **0 (0.0%)** | evicted 10 · recovered 6 · dropped 4 (all honest) | ✅ 12 kept, **12 landed** |

Every run: fresh labelled throwaway with a real ICP and 8 concepts (so **desire was genuinely
live**, not the deck-constant fallback), id-scoped teardown, all four baselines reconciled to
**adCopy 5424 · headlines 2174 · adCreatives 405 · running jobs 0**. No images rendered on any run,
so Cloudinary was never involved.

**Deck-wide anti-echo is proven live, not just on fixtures.** Run 2 caught **3 echoes, all against a
NON-PARTNER headline** (`"scope first sequence"`), zero against a body's own generation partner —
cases pairwise checking could not have found. The gate records `wasPartner` per finding so this is
mechanical rather than argued. Run 1 reported it **NOT DEMONSTRATED** and was reported that way.

#### Two defects the first run exposed, both fixed and re-proven

1. **Fall-through tested the POOL, not the OUTCOME.** All 19 evictions chose `desire`; 12 died on it.
   With persona pinned and format fixed, moving desire alone yields at most two differing axes, and
   against a survivor sharing awareness AND format it yields one — so the redraft collapsed again and
   the loop burned all three attempts on an axis that could never separate it.
   **Fixed:** candidate moves are now SIMULATED against every survivor before any model call, and
   only a combination that clears the rule is returned; two-axis moves are tried when no single axis
   works. Nodes declare what they can move (`pools.movable`). Result: **19/19 recovered, 0 dropped.**
2. **Trim was blind to surface role** and kept 11 headlines / 1 body — safe under 2-of-4 and
   unshippable. **Fixed:** round-robin quota across surfaces (6/6 at band max 12), slack flowing to
   whichever surface still has pieces; separation still decides WHICH survive, not how many of each.

⚠️ **They were masking each other** — run 1 showed no echoes because it kept one body. The trim fix
is what made Verdict B measurable.

#### Node 6 ordering, settled 2026-08-07 (was documented, now fixed)

Node 6 had **no blocking compliance pass of its own** — `checkCompliance` only SCORES — so the real
block was `gateBeforePersist` running AFTER the gate. Measured: the gate kept 12, the backstop then
dropped 1 for `promised_result`, 11 landed. **Reordered** to match Node 7 and the design, using the
same `checkOutput` + grounding corpus so the two cannot disagree; scope matches the backstop exactly
(skips without a `serviceId`). Live: `blocked 3/25 headlines before the distinctness gate`, and
ledger KEPT = DB rows = returned count = **12**. No headline retry, matching Node 7's measured
decision that a 40-character headline has too little room for a redraft to change a verdict.

#### Three coach-facing accuracy bugs fixed alongside

- `runHeadlinesGeneration` returned the **pre-gate** count; `runAdCopyGeneration` counted off the
  **pre-distinctness** array. Both would have told a coach the deck was larger than the database
  holds. `createHeadlines` now returns what it actually persisted and both generators report that.
- Concept telemetry logged the impossible `generated=8 … kept=10` because it still used `count`
  after the 1.5x over-generation landed. Now uses `overGenerateCount`.
- **Template-token leak (pre-existing).** Two of eleven persisted headlines shipped
  `[INSERT_AUTHORITY_TITLE] Revealed What…`. The token is *sanctioned* — the fabrication rule offers
  bracketed placeholders as a legal alternative to inventing a credential — but nothing ever
  RESOLVED it before write. Now resolved from `services.pressFeatures`, else generic role framing
  that claims no credential, never the raw token. Live: `resolved 10 unfilled template token(s)`.
  ⚠️ **Forward-only.** 216 legacy headline rows still carry raw tokens; Arfeen's call 2026-08-08 is
  **no backfill** — they are dummy data and go in the pre-launch clean-slate wipe.

#### Yield fix, under real stress

Concepts hit a **100% first-pass block rate** (`invented_testimonial`, `unearned_authority`) on the
Node 6 run and the 1.5x over-generation still delivered a full set of 8. That is the tail it exists
to absorb. Never pads — a short set ships short and says so.

#### Gates at commit

`tsc --noEmit` → **34** (baseline held, zero new). **547 tests across 10 suites**, including 32 in
`_core/pdafGate.test.ts` and 8 in `headlinesTemplateTokens.test.ts`. Both fix families carry
regression tests that fail against the old behaviour.

#### Still open

- **Node 7's `movable` is all three axes and its format moves are unexercised live** — every Node 7
  recovery so far landed on desire or awareness. The path is unit-tested only.
- **`sweepAdCreativeBatch` still has no userId guard** — see §12.7a. Blocks the image sprint's
  teardown, not this chapter.

### 12.7 The image-baked-text duplication — for the image sprint

The compositor bakes in the headline AND `bodyText`, which is **the first 140 characters of an
ad-copy body row**, taken verbatim from the same table the published primary text comes from. So the
text Meta's OCR reads off the picture is a truncation of the body's opening — the exact
repeat-across-surfaces case the research names as collapse-inducing, live today.

**Decided:** the image surface gets its OWN short hook line. Do NOT solve it by constraining the
body's opening — the body's first words are the priming real estate and must stay free.

**No OCR pre-pass is needed for our own ads.** We bake the text in, so we already know the string.

### 12.7a ✅ RESOLVED — `sweepAdCreativeBatch` userId guard (see §12.11 step 1)

**Noted 2026-08-07, FIXED 2026-08-08.** Kept here as the record of what was wrong; the fix and its
23 tests are described in §12.11 step 1. Original diagnosis below.

`server/lib/adCreativeTeardown.ts` → `sweepAdCreativeBatch(db, batchId)` is scoped by **`batchId`
alone**. The file contains **zero references to `userId`** — verified by grep, count 0. Both the
Cloudinary sweep and the row delete run off `eq(adCreatives.batchId, batchId)` and nothing else.

This contradicts the standing rule in §10: *"TEARDOWN IS ALWAYS ID-SCOPED, NEVER USER-SCOPED …
Always `WHERE id IN (…)` plus a userId guard."* The module gets the ORDER right (read public_ids,
then delete rows — the thing it was written for) and gets the COLUMNS right (it sweeps both
`imageUrl` and `rawImageUrl`, which is the raw + composited pair, the "4 orphans" case). What it
lacks is the guard.

**Why it matters here specifically:** smoke user **117174 owns the 25 protected creatives on
services 272-277**, plus 285. A wrong, stale or reused `batchId` would delete outside its intended
scope with nothing in the function to stop it. `batchId` is a nanoid, so accidental collision is
implausible — this is a missing seatbelt, not a live bug, and no run has been harmed by it.

**Not a risk to the COPY chapter.** The copy proofs render nothing and never call this function.
It becomes load-bearing the moment the image sprint starts tearing down rendered creatives.

## 12.11 THE IMAGE SPRINT — steps 1 and 2 DONE, nothing applied, nothing proven live

**State at 2026-08-08: 0098 AND 0099 APPLIED to production. Steps 1-2 proven live. Two further
fixes built and proven live. Committed locally, NOT deployed.** Gates: tsc **34**, **552 passed
across 13 suites** — via the §8 command, not a bare count.

### What the 2026-08-08 live proofs actually established

- **Migration 0098 applied.** `adCopy.contentType` is now four values; 5424 rows unchanged
  (1714 headline + 1997 body + 1713 link). **0099 applied** the same way: `adCreatives.sourceImageUrl`
  varchar(500) NULL, 405 rows unchanged. Both additive and inert, exactly like 0097.
- **Step 2 proven, then found broken, then fixed.** The first run persisted hooks of
  **74/92/114/127 chars** against a 60-char ceiling — every surviving hook had been gate-recovered,
  and the gate's `regenerate` callback branched on `isBody`, sweeping `image_hook` into the HEADLINE
  branch: wrong voice, and the ceiling applied only on first generation. The compositor ellipsised
  them over the picture. **Fixed** (`redraftSurfaceFor` / `buildHookRedraftInstruction` /
  `clampHookText`, all module-scope and shared by both call sites) and **re-proven live**: five
  hooks at **53/59/56/59/51**, in hook voice, no mechanism-name repetition. 18 regression tests pin
  the four real oversized strings.
- ⚠️ **THE DECK IS NOT SHIPPABLE AND THAT IS THE OPEN ROCK.** Run 2 kept **6 headlines / 5 hooks /
  1 body**. Not the trim — **15 of ~17 bodies were dropped at the cap**, every one "no axis move
  clears 2-of-4", so trim had one body left to rebalance. All 38 evictions chose `desire`. Cause:
  one shared band of 12 across three surfaces, with persona pinned and only 8 desires, so hooks and
  bodies compete for the same distinct cells. **Settled by Arfeen 2026-08-08: distinctness is judged
  WITHIN each surface, not across** — a headline and a body are surfaces of ONE ad, meant to be
  coherent. The deck-wide anti-echo stays cross-surface, unchanged.
- **The `…HOW IT…` line was NOT the copy engine.** The image engine has its own headline source;
  with none passed it falls back to `HEADLINE_FORMULAS`, whose `benefit` formula is
  `${MECHANISM}: HOW IT WORKS` — 38 chars against a 37-char fitter, so `fitTitle` always ate
  "WORKS". Auto Mode never had this (it passes contextual headlines); **only the wizard path did**.
  Fixed at that one call site, with a try/catch falling back to the templates rather than turning a
  cosmetic defect into a failed generation. Proven live: 34/33/35/35 chars, none truncated.
- **Sweep completeness (0099) proven END-TO-END.** Every render makes THREE Cloudinary objects; the
  sweep could only ever see two, so one leaked per render — confirmed by listing: 4 orphans from the
  first proof run and 4 from the second, **8 legacy orphans outstanding**, needing the pattern-scoped
  listing sweep. After the fix the sweep resolved **12 ids across 4 rows** and the post-teardown
  Cloudinary listing showed **all four intermediates GONE — zero orphans from that run**.
- 📌 **The manual wizard image path is UNGATED** — it does not run through the distinctness gate at
  all, which is why its four cards share one small line. Noted 2026-08-08, **not this sprint's
  concern**, and a separate future question from the per-surface work.

### Settled decisions (Arfeen, 2026-08-07/08)

- **`image_hook` JOINS the distinctness population.** It is one of the three surfaces Meta fuses
  (image text / headline / body), which is the exact test the link-exclusion uses to justify
  excluding a 30-character CTA. So it is counted, unlike links.
- **Image stage and desire come from the CONCEPT ROWS** (sprint step 3), replacing
  `awarenessDeckPlan` at eight. This is what dissolves the hole described under step 4 below.
- The style-list extension and the arity audit ride with the 4 → 8 step, not before it.

### ✅ Step 1 — the `sweepAdCreativeBatch` userId guard (was §12.7a)

`userId` is now a **required positional parameter**, and `and(batchId, userId)` is applied to
**both the read and the delete** — guarding only the read would report the right rows and delete
the wrong ones. An optional guard is one a caller forgets, and this function deletes rows whose
Cloudinary URLs are unrecoverable the moment they go.

**Plus a hard refusal that is independent of the guard.** `PROTECTED_SERVICE_IDS`
(272-277, 285) is checked against the RESOLVED ROWS — not the arguments — and throws
`ProtectedServiceError` before touching Cloudinary or the database. It cannot be folded into the
userId check, because **user 117174 legitimately OWNS services 272-277**: a wrong-but-same-user
batchId passes the guard cleanly, and that is precisely the case this catches.

**23 tests.** The fake db records the SQL scope it is handed, so the assertions are about what the
helper actually asks the database to do rather than what its comments claim. Includes: mismatched
userId deletes nothing and never calls Cloudinary; the delete scope carries both keys; one case per
protected service; refusal fires even when the userId guard passes; refusal happens BEFORE
Cloudinary. The pre-existing five `publicIdFromUrl` cases are preserved verbatim — they pin the
`.png.png` double-suffix behaviour that made the 2026-07-29 orphan recovery possible.

**No production callers** — the only mention anywhere is a comment in
`scripts/sweep-regen-canvas-orphans.ts` explaining why that one-off does not use it.

### ✅ Step 2 — the baked-text fix (built; NOT proven live)

The compositor was handed `bodyText` from `resolveAdBodyTexts`, which truncates an ad-copy BODY row
to 140 characters — so the string Meta's OCR read off the picture was the body's opening, verbatim.
The same words on two of the three fused surfaces. Live in production today.

- **`drizzle/0098_image_hook_content_type.sql`** — widens `adCopy.contentType` by one value.
  Travels alone. Additive and inert: every existing row stays valid.
- **Node 7 generates the hook as its own chained surface**, told the build spec §3 division of
  labour explicitly (picture = the feeling, headline = proof/mechanism, body = context) and to use
  different words from both. 60-char ceiling enforced in code as well as the prompt — a model
  running long would push text into the band the renderer was told to keep clear.
- **Stamped with all four P.D.A.F. axes**, because it is written by the generator that assigns
  them. Generating it image-side would mean re-deriving axes that already exist, which is the
  fake-diversity failure this chapter exists to remove.
- **GATE WIRING CONFIRMED ZERO-CHANGE.** `partitionPopulation` excludes only links, so hooks are
  counted; and `"image_hook"` was ALREADY in the anti-echo default `targetRoles` with a passing
  test written before the surface existed. `pdafGate.ts` is untouched by this step.
- **The compositor prefers hook rows and FALLS BACK to the body truncation** when none exist. Kept
  deliberately: every service generated before 0098 has no hooks, and must still composite rather
  than render a picture with no text on it. The fallback is the old behaviour exactly.

**`fitLines` at short strings — checked, not assumed.** The layout is fully derived
(`bodyBlockH = lines × lineHeight`, with empty-case guards on both the headline and pill gaps). A
hook fits at FULL size on ≤2 lines with no shrink and no ellipsis on both real canvases, and always
produces a SHORTER block than the body it replaces — more clear picture, and the text-safe band was
measured at worst-case content. 8 tests (`compositeShortHook.test.ts`), including the empty case and
the 60-char worst case.

⚠️ **Two things the type system forced out, both decisions rather than omissions:** `image_hook`
needed the **short** compliance role (it was falling through to body-prose handling); and the
compliance-REWRITE tables type on their own narrower enum, so hooks are excluded from rewriting
rather than adding a second migration — matching the measured decision that short fields are never
retried.

### ✅ PER-SURFACE DISTINCTNESS — BUILT, PROVEN LIVE ON BOTH NODES, COMMITTED LOCAL ONLY

**Settled by Arfeen 2026-08-08: distinctness is judged WITHIN a surface, never across.** Meta
collapses whole ADS, and an ad is the fused triple of image text / headline / body — so two
headlines competing is a real delivery signal, while a headline "colliding" with the body it only
ever ships ALONGSIDE is not. The deck-wide anti-echo stays CROSS-surface, unchanged.

**What the shared band was doing.** Live run 2026-08-08 (adSet `NUTz86js4K4fovKp0ZxT1`) kept
**6 headlines / 5 hooks / 1 BODY**. Not a trim failure — **15 of ~17 bodies were dropped at the
cap**, every one "no axis move clears 2-of-4", so trim had one body left to rebalance. Persona
pinned + 8 desires = a finite supply of distinct cells, and the surface generated in the largest
quantity lost the race. A deck with one body cannot ship.

**After, measured on TWO independent live runs:**

| run | headline | body | image_hook |
|---|---|---|---|
| `qAGvRhVPiLdDjpGDm-fUW` | 12 kept, 5 evicted, **5 recovered**, 0 dropped | **12 kept**, 6 evicted, **6 recovered**, 0 dropped | 4 kept, 11 evicted, **0 recovered**, 11 dropped |
| contextual-headline rerun | 12 kept, 4 evicted, **4 recovered**, 0 dropped | **12 kept**, 4 evicted, **4 recovered**, 0 dropped | 4 kept, 11 evicted, **0 recovered**, 11 dropped |

Bodies 1 → 12. Every surface at or above floor, zero collapsing pairs anywhere.

**Node 6 re-proved live at parity — and the first result was a false alarm worth recording.**
`pdaf-node6-proof.ts` passes NO serviceId, so the generator resolves no ICP, finds no concepts, and
falls back to a SINGLE deck-constant desire. With persona pinned, desire constant and Node 6 unable
to move format, only awareness can move: one axis cannot clear 2-of-4, so `recovered 0` is FORCED,
and `KEPT 4` is the ceiling (4 awareness stages). Its collapse-BEFORE of **127 pairs / 42.3%**
reproduces the documented baseline exactly, which is what proves the population and comparison are
unchanged. `pdaf-node6-icp-proof.ts` was written to build the §12.6 configuration (service + ICP +
concepts, live desire) and returned **KEPT 12 / band 8-12 ✅**, matching §12.6, with one surface in
the ledger, per-surface equal to aggregate, and ledger KEPT equal to the rows in the database.
⚠️ **Never compare a no-service Node 6 run against §12.6 and call the difference a regression.**

**Also in this commit:**
- **The hook's format IS its surface.** `format` off the hook's movable axes — the gate was stamping
  `pain_agitation` and `story` onto hook rows.
- **Anti-echo gained hook OPENINGS as a source** (`openingRoles` was `["body"]`, so a hook echoing
  another hook was structurally invisible) **and `rewriteEcho` now handles hook rows** — without
  that second half the new detection would find echoes and silently discard them.
- **The hook-regeneration fix**: the gate's `regenerate` branched on `isBody`, sweeping `image_hook`
  into the HEADLINE branch — wrong voice, and the 60-char ceiling applied only on first generation.
  All four hooks on the first live run were gate-recovered and came back at **74/92/114/127 chars**,
  ellipsised over the picture. Now `redraftSurfaceFor` / `buildHookRedraftInstruction` /
  `clampHookText`, module-scope and shared by both call sites.
- **The proof harness passes contextual headlines**, mirroring the cascade. It previously fell
  through to HEADLINE_FORMULAS and baked `THE SCOPE-FIRST SEQUENCE: HOW IT…`, which read as a render
  defect but was the harness taking a path no production caller takes any more.

### 🔴 THE 4 → 8 HOOK BLOCKER — measured twice, do not build over it

`image_hook` shows a green tick only because its floor is 1. Underneath, on BOTH runs: **11 evicted,
0 recovered, 4 surviving.** The hook surface's natural distinct capacity is **exactly 4** — today's
deck size, so nothing looks wrong. At eight it falls short, and recovery cannot rescue it: with
persona pinned and format now fixed, a hook has TWO movable axes against a two-axis threshold, so
any hook pair sharing desire and awareness is unrecoverable by construction. **This is the cost of
the format-taxonomy fix, accepted deliberately.**

⚠️ **The proposed relaxation — hold hooks to anti-echo only — rests on a premise that DOES NOT
HOLD.** Verified 2026-08-09: `adCreatives` has **no persona/desire/awareness/conceptId/icpId
column**, so the image contributes **ZERO** categorical axes; awareness shapes the shot at prompt
time and is discarded. And there is **no ad-assembly step at all** — `publishToMeta` takes one
headline, one body, one image and creates one ad, so nothing computes ad-level distinctness. Ad-level
2-of-4 holds only CONDITIONALLY: for two ads using a different headline AND a different body from
the gated pool. Resolve the publish path and image→concept first.

### 🔴 Remaining, in order

1. **Apply 0098**, then **run `imagehook-proof.ts`** — renders real composites for Arfeen to judge.
2. **Tie images to concepts, at FOUR slots first.** ⚠️ The comment at `adCreativesGenerator.ts`
   saying *"adCreativesGenerator has no icpId, and ensureConceptsForIcp is fire-and-forget, so a
   lookup here would be a race"* is **STALE ON BOTH HALVES**: the cascade caller has `input.icpId`
   in scope (`orchestration.ts:961`) and simply does not pass it, and concept generation moved to
   kit creation four nodes earlier in `e91c13d`, so by cascade step 9 the concepts have existed
   since before step 1. This is threading one argument, not building a lookup.
3. **Grow 4 → 8**, with the arity audit. ⚠️ **THE REAL RISK IN THE WHOLE SPRINT SITS HERE.**
   `awarenessDeckPlan` returns distinct cold stages only while `slots <= 4` and DEFERS to
   `awarenessPlanForCount` above that — so at 8 it silently swaps a distinct-stages guarantee for
   the proportional 3/3/1/1/0 mix, giving three `unaware` slots. `unaware` has
   `FACE_ABSENT_AFFINITY = 0` and is **never eligible** for the visibility tier, so those repeats
   cannot be rescued. Nothing throws, no test fails, and the deck looks fine until Meta collapses
   it. **Doing step 2 first is what defuses this**, because concept-driven stages replace that call.
   Also: `AD_VARIATIONS` has 4 entries over 4 styles and needs 8; and its docblock records two call
   sites that hardcoded `i < 5` and would have crashed on the coach's Generate button — audit every
   consumer for derived-vs-hardcoded arity.
4. **Then deploy.**

### Explicitly OUT of scope (unchanged, and none blocks the above)

`generateAsync`'s 1:1 emit · `makeVertical`'s missing aspectRatio (inert, takes PATH A) · the
editorial engine and its 5 variations · the legacy orphaned Cloudinary objects · the 5-of-8 fan-out
sites that pass no stage.

### 12.8 Proof + audit tooling (all read-only or teardown-safe)

- `server/scripts/pdafDistinctness.ts` — the pure 2-of-4 comparator (gate-bound)
- `server/scripts/pdaf-collapse-audit.ts` — read-only Phase 0 baseline over existing prod rows
- `server/scripts/pdaf-node6-proof.ts` · `pdaf-node7-proof.ts` · `pdaf-step1-proof.ts` ·
  `pdaf-desire-proof.ts` — live proofs, each printing an id-scoped teardown it does NOT execute

### 12.9 Traps this chapter added

- **`serviceId` is load-bearing on `ensureConceptsForIcp`.** Without it no grounding corpus is built
  and the output gate — fail-closed by design for concepts — refuses all three attempts with
  `fabrication_check_unavailable` and writes nothing. The first version of the kit-creation trigger
  omitted it and generated ZERO concepts while reporting a clean "enqueued". The gate was right.
- **Concept generation takes minutes, not seconds.** 8 concepts × 3 gate attempts plus a
  per-concept solo pass. A 240s poll window timed out on a job that was alive and later completed;
  combined with `railway run`'s block-buffered stdout the run looked like a durability failure and
  was not. Poll for 10 minutes.
- **The concept job stays `pending` and never moves to `running`, deliberately.** The reaper sweeps
  `pending` older than 5 minutes; `running` is never swept, which is exactly how a dead job becomes
  a permanent zombie blocking every retry. A false "failed" on a slow-but-alive run is harmless —
  the rows still land and the next call returns "exists".
- **Kit creation is the earliest SAFE concept trigger.** `icps.sharpenWithLadder` regenerates a
  profile in place and is documented as sitting "BEFORE the kit exists, so nothing downstream has
  consumed the ICP yet". Triggering at ICP creation would make a sharpen leave a stale concept set.

### 12.12 Teardown ledger — 2026-08-09, all four proofs cleared

Torn down and reconciled EXACTLY to baseline: adCopy **5424** · headlines **2174** · adCreatives
**405** · running jobs **0**. Protected verified per service, not in aggregate:
`272:5 273:5 275:5 276:5 277:5 285:4` = **29**, all seven service rows present, never touched — the
refusal never needed to fire because every batch resolved to services 301/303.

- Node 7 per-surface — service 301, ICP 275, batch `batch-1786213463599-60a8e800`
- Node 7 contextual-headline — service 303, ICP 277, batch `batch-1786217580577-5456dea6`
- Node 6 no-service — headline rows 2330-2333
- Node 6 ICP-backed — service 302, ICP 276, headlineSet `INvexs9yh7JLQ3Eyy48Rz`

**Migration 0099 proven at teardown:** each sweep resolved **12 public ids across 4 rows — three per
row**. Under the old code each would have cleared 8 and leaked 4. Cloudinary verified by direct
listing, not by the sweep's self-report: both batches GONE.

⚠️ **8 legacy orphans remain** (4 at `generated_17862073*`, 4 at `generated_17862012*`), both sets
from runs that PREDATE 0099. Their urls were never recorded and are unrecoverable from the database;
they need the pattern-scoped listing sweep (`cloudinary.search` sorted by `created_at desc`, NOT
`api.resources()`). Not yet done.

### 12.10 Baselines to reconcile every proof run against

`adCopy` **5424** · `headlines` **2174** · `adCreatives` **405**. All three were restored exactly
after every proof run in this chapter. The copy proofs render no images, so Cloudinary is not
involved — but the moment a proof renders one, §10's teardown rules apply in full.
