# ZAP Handover — July 27, 2026 — SESSION CLOSE

**`HEAD = origin/railway-build = d6ecc4a`.** (An earlier draft of this handover recorded `0656b67`, the
commit immediately below — the docs session-close commit `d6ecc4a` sits on top of it and is the real tip.)
ICP grounding is fully live. The anti-fabrication validator is
built but **reverted off the branch**, awaiting a widened false-positive sweep. A new authoritative compliance
reference is in the repo and drives the next sprint.

---

## 1. SHIPPED + LIVE this session (prod-verified)

### ICP grounding Phase 2 — migration `0096` (`groundingMeta`)
The three invented Class-A fields — `demographics`, `mediaConsumption`, `influencers` — are **removed from ICP
generation entirely**. Not hardened: removed. They fed no downstream generator (verified across all twelve),
they were fossils of interest-based Meta targeting that Andromeda superseded, and `influencers`/
`mediaConsumption` invented **named real people** and stated them as fact about a coach's audience.

Removing them **dissolved a structural bug** that no prompt wording could fix: the model kept hoisting the
seven demographic values out of their nested object (23 keys instead of 17), often enough that three retries
never recovered. With no nested object in the schema there is nothing to flatten — **8/8 clean live runs, mean
attempts 1.00**. Class-B vivid prose is intact. **DB columns kept dormant**, not dropped, for a future
ICP-powered tool.

**Three sibling fixes shipped alongside:** `icpAngleSuggestions` prompt duplication killed (**it had been
running with NO compliance filter**) · `regenerateSection` brought under the guards it fully bypassed ·
demographics camelCase/snake_case bug (the export rendered empty for every generated ICP).

### Laddered intake — `1fe41ff`
Opt-in sharpen offer placed **after the reveal card and before the kit** — the one window where nothing
references the ICP, so an in-place regenerate carries zero staleness. Four questions verbatim, each skippable;
`icps.sharpenWithLadder` does a full in-place UPDATE on the same row; answers persist in `groundingMeta` so a
later regenerate re-grounds rather than reverting. **Live decline-path verified on the running site** — no
pre-generation ladder, wow moment untouched. Bonus: the ICP created during that run came back with
`groundingMeta` populated, the first runtime proof the 0096 column is written.

## 2. NEW AUTHORITATIVE REFERENCE

**`docs/compliance/META_AD_COMPLIANCE_REFERENCE.md` — read before ANY compliance or copy-register work.**

* **Three evidence tiers, which must not be collapsed.** Tier 1 (confirmed Meta policy) is the **only** tier
  that may become enforcement logic. Tier 2 (practitioner anecdote) informs judgement, **never a hard gate**.
  Tier 3 is ZAP's own implementation rules.
* **An explicit do-not-build list** of unverifiable agency claims that appear nowhere in Meta's docs — "MARS",
  "Account Health Score" 70/50/25, "Policy 4.3", the "Rule of 47", every cited percentage, and a "60-second
  review" that contradicts Meta's own "typically within 24 hours". Several research reports filed these under
  *"Verified Policy Realities"*. **Fake precision fails catastrophically rather than gracefully** — a threshold
  built on an unverifiable number breaks every campaign at once if the assumption was wrong.
* **Niche-aware strictness** keyed to `service.category`; the **crypto permission line** (the boundary is
  endorsement of buying/selling); and the **first-person register standard**.

## 3. HELD / NOT SHIPPED

**Anti-fabrication validator v1 — commit `6a89396`, REVERTED off the branch via `a912a2b`.**

It was pushed **by accident**: the docs checkpoint was authored on top of the held validator, so pushing the
docs carried it to origin and Railway began deploying it. Reverted rather than force-pushed, so history stays
intact and the work is recoverable.

* **Re-apply with `git revert a912a2b`** — *only* after the sweep clears its bar.
* **Bar: zero false positives on legitimate prose across VARIED coach shapes, AND 100% of planted fabrications
  still caught.** The ready-to-run sweep prompt is recorded verbatim in
  `ZAP_Handover_July27_2026_AntiFabrication_Validator_v1.md` §5.
* Why it is held: the validator **blocks**, and its false-positive surface is proven on only one beginner ICP
  plus unit cases. One class was already caught mid-verification (`"Every Monday"` read as a named third party;
  `"not 100% sure"` read as a statistic) which would have dead-ended every launch-stage coach.

**⚠️ Process lesson worth keeping:** a commit is not "held" once anything sits on top of it and gets pushed —
push moves the whole ancestry. Docs-only checkpoints must be authored from a branch position that carries no
held work, or the held work belongs on its own branch. Checking "no code in *this* commit" is not sufficient.

### 3a. REGISTER CHANGE — built, verified, HELD OFF `railway-build` (2026-07-27)

**Commit `5fc1a1c` — "feat(register): first-person register standard across all nine reader-facing generators".**

**Why held:** Arfeen's call — it ships as **ONE compliance layer** together with the compliance axis and the
fabrication validator, not on its own. Verification showed the register change fixes body copy comprehensively
but leaves **short high-visibility fields drifting diagnostic on body/weight offers** (a live postpartum run
produced the eyebrow *"FOR WOMEN WHO JUST HAD A BABY AND FEEL LIKE THEIR BODY NO LONGER BELONGS TO THEM"*).
A 100-character field cannot carry a first-person moment, so the register has nowhere to go there. Shipping
"better but still leaky" is not the bar; the compliance axis closes that gap on generated output.

**PARKED DELIBERATELY, applying the process lesson above.** It is NOT an unpushed commit on `railway-build` —
that is precisely the shape that caused the accidental push. It sits on two independent refs, neither of which
is in `railway-build`'s ancestry, so no future docs commit can carry it to origin:

| Ref | Kind | Points at |
|---|---|---|
| `held/register-change-2026-07-27` | local branch | `5fc1a1c` |
| `held-register-change-2026-07-27` | local tag (redundancy vs. branch deletion / reflog expiry) | `5fc1a1c` |

**Recovery — apply on top of whatever `railway-build` is at the time:**
```
git checkout railway-build
git cherry-pick 5fc1a1c          # or: git merge held/register-change-2026-07-27
```
Neither ref is pushed. To retire them after the combined layer ships:
`git branch -D held/register-change-2026-07-27 && git tag -d held-register-change-2026-07-27`.

**State at hold:** TS 35, targeted suites 439 pass, no new failing suites, **no migration**. Nine generators
touched. Does not restore `a912a2b`.

**Verification evidence — what is and is not confirmed.** Real generations, clean-room, six coach shapes.
CONFIRMED on complete runs: beginner (`asSeenIn []`, `testimonials []`, numberless shockingStat) · veteran
(third person unlocks; uses the supplied quotes, press and figures verbatim) · enumerated-attribute case
(prod service 269, ex-prisoners — no criminal-record assertion anywhere, **with no classifier involved**) ·
crypto (no buy/sell endorsement, no financial-vulnerability assertion) · the `social_proof` fabrication
(*"One client sat through…"* plus an invented quote for a zero-proof coach) and its fix by withholding
proof-dependent angles. **NOT live-confirmed: the `data_chart` concept-hook gate** — added last, after the
observed fabrication *"screened out … more than 70% of the time. Four months of data."*; currently backed by
unit test only. Confirm it when the combined layer is verified.

**⚠️ Two verification-method lessons, both worth keeping:**
1. **A regex scan that keys on literal "you're" under-reports badly.** It scored a run 0 hits whose copy read
   *"The clothes still don't fit… You avoid the camera… the mirror is a daily reminder."* The real pre-fix
   count was 8. Implied address carries no pronoun — detection has to catch that.
2. **A crashed run looks identical to a clean one.** Two "final" verification files were crash logs (the
   harness had been deleted while the job was still queued) and scanned as 0 hits. Any completeness check must
   assert a positive end-marker in the output, never infer success from absence of findings.

## 4. NEXT SPRINT — build order

**1. REGISTER CHANGE — first-person default** across adCopy, scripts and landing pages, with niche-aware
strictness by `service.category`.
*Rationale:* the banned thing is the **diagnostic address**, not emotional force — intensity is preserved and
only the aim changes. First person is **structurally outside** the personal-attributes rule (a claim about the
advertiser's own experience cannot assert knowledge of the viewer), and it avoids pushing beginners toward
inventing client testimonials.
**ICP generation is explicitly NOT reopened** — the ICP is internal, Meta never sees it; only generated
*output* register changes.

**2. WIDENED FALSE-POSITIVE SWEEP** on the held validator — deliberately **after** the register change, so it
sweeps against the new register rather than the old one.

**3. COMPLIANCE AXIS** — the six Tier-1 checks in §3.3 plus the crypto guard, shipped **with** the fabrication
validator as **one compliance layer**. Note check 5 (Special Ad Category trigger language) rests on **Tier-2
evidence → flag for coach confirmation, never auto-block**.

### 🔑 KEY INSIGHT to preserve
**The first-person register and the anti-fabrication validator solve the same beginner problem from two
directions.** A third-person case study requires a real client story — a new coach has no "Sarah" — so
third-person framing pushes them straight into inventing the exact Class-1 fabrication the validator blocks.
First person needs no client at all. They reinforce each other, which is why they ship as one layer rather
than as two unrelated passes.

## 4a. COMPLIANCE LAYER — SHIPPED + LIVE (2026-07-27)

**`HEAD = origin/railway-build = 7450103`** (merge of `held/compliance-layer-2026-07-27`, six commits:
register standard · compliance axis · combined FP sweep · noun-phrase fix + wiring · two runtime bugs ·
reword action). Railway `ddd2d60c` SUCCESS, image `sha256:bfd5a5ea13ad`, clean boot, prod 200. Client bundle
`index-DXG_4j4E.js` carries all five new strings. **No migration.** Live post-deploy generation on the running
site: 46 generated → 12 dropped → 34 persisted, DB row count matched the API exactly, gate fired on real prod
content, teardown returned every table to baseline.

⚠️ **Deployed-SHA confirmation is INDIRECT.** `RAILWAY_GIT_COMMIT_SHA` is empty under `railway run` (it injects
local env, not the container's), so the deployed commit could not be read back. Evidence is: deploy triggered
on the push, only SUCCESS since, and the served bundle contains strings unique to the pushed commits. Worth
finding a direct method before the next ship.

## 4c. COMPLIANCE LAYER — CORRECTION PASS SHIPPED (2026-07-27, second deploy)

**`HEAD = origin/railway-build = ce9b97d`.** Railway `ba2442b4` SUCCESS, clean boot, prod 200.
Three commits: deck-thinning fix · vocabulary expansion · exhaustive triage. **NO MIGRATION.**

**Served bundle UNCHANGED BY DESIGN** (`index-DXG_4j4E.js`) — all three commits touch `server/`
only, so there is no client bundle to fingerprint. ⚠️ `RAILWAY_GIT_COMMIT_SHA` is empty under
`railway run`, so SHA read-back is still INDIRECT. **The live generation is the deployment proof:**
service 272 produced **4/16 bodies pre-fix and 16/16 post-fix** on identical inputs.

**LIVE POST-DEPLOY GATE — all four sub-checks passed on prod:** generation completed in 28s
(46 generated · 0 dropped · 46 persisted) · DB row counts matched the API exactly
(`rows=46|headline=15|body=16|link=15`) · **the retry round fired live and recovered 5/5** ·
a planted enumerated violation was **BLOCKED at publishToMeta** with the coach-facing message.
Teardown returned every table to baseline.

⚠️ **TEARDOWN LESSON:** the first generate call succeeded but a shell error aborted before its
adSetId printed, orphaning 45 rows; and the ad-copy entry fires `ensureConceptsForIcp` lazily,
orphaning 8 concepts. **Prod teardown must reconcile row COUNTS against a pre-run baseline, not
just delete the ids you happen to hold.** Both were found and removed.

### 🔴 CORRECTED BLOCKING BASELINE — 437, not 470
The shipped layer had been **over-blocking real coach copy since it went live**, and it was
invisible because every sweep measured GENERATED text rather than prod copy. Measured on 3,006
real texts (5,405 prod ad-copy rows + 101 prod ICPs + generated blocks): **470 → 437.**

An earlier intermediate figure of 349 was WRONG — it came from sampling the released texts rather
than triaging them. Exhaustive triage of all 121 releases found two defects of my own and the
true number is 437. **Never quote 349.**

**The 121 releases, classified:** substring `nobody`→`body` 15 · product mechanism 17 · idiomatic
"weight" 10 · third-person client stories 5 · identity/register with no enumerated attribute 57 —
all CORRECT. Plus **8 genuine body assertions** that were false negatives, now fixed.

### Three defects the triage exposed
1. **Word-boundary over-correction** — fixing `body` inside `noBODY` stopped matching inflections
   (`\bavoid\b` missed "avoided"). Now inflection-tolerant `(s|es|ed|d|ing)`; "hive" still does
   not match "hiv". Restored 9 releases immediately.
2. **Anatomy was a family, not a leaf** — `midsection` was the term spotted; waistline, belly,
   thighs, hips, torso, jawline and colloquials were all missing. `figure`/`core`/`frame`
   deliberately EXCLUDED — with inflection tolerance they match "figure out", "core values",
   "framework".
3. **FOUR MATCHERS WHERE THERE SHOULD BE ONE** — `containsAny`, the non-neutral precedence check,
   and the forward and reverse adjacency checks each built their own regex and disagreed about
   what a term matches. All now derive from `termRe`, **with a test asserting exactly ONE
   term-escape site exists.** This defect recurred three times; the test is why it stops.

### Conditional guard — UNCHANGED, and measured
Arfeen's decision, on evidence. Of 1,150 conditional sentences in 3,006 real texts, the guard
suppresses 90 blocks. **Split: 0 named clinical diagnosis · 66 everyday state words · 24 neither.**
The motivating case ("If you've been living with IBS…") does not occur in real copy. Closing the
gap would cost 66 legitimate suppressions to catch 0 observed violations. Offer conditionals
("If you join before Friday") never depended on the guard — they carry no protected attribute.
**A test pins the guard so it cannot drift silently.**

### Enforcement scope — Tier 1 only
Diagnostic second person about NON-enumerated topics (employment, business frustration, ambition)
now LABELS as `register_diagnostic_address` (tier 2) instead of blocking. The register standard
stays in every generation prompt and still shapes copy; it no longer gates it. Only Tier 1 —
Meta's enumerated attributes, §1.3, §1.8, §1.4, §1.6 — blocks.

## 4b. BACKLOG banked from the compliance-layer ship

### (1) PRESS/MEDIA NAMES — FIXED ATTRIBUTION FORMAT ONLY (Arfeen's call, NOT yet built)
Press and media names may appear ONLY in a fixed format — **"As seen in: [publication]"** for publications,
**"As seen on: [TV/podcast]"** for broadcast — and **never woven into generated prose**.

**Root cause:** the model inflates a true supplied fact into a claim the fact does not support. Observed live:
supplied `pressFeatures: "SaaStr, Sales Hacker"` became *"Recognised by SaaStr and Sales Hacker as a structured
approach that works on live pipeline."* Being featured somewhere is not that outlet endorsing the method. The
fabrication validator correctly passes it — the names ARE supplied — so this is not a detector gap.

**Why format-lock rather than detection:** a detector would have to judge whether each sentence overstates the
supplied fact, which is the fuzzy problem we keep losing. Removing the prose freedom removes the inflation —
the same principle as `[INSERT_DATE]` for urgency: don't ask the model to be careful, remove the opportunity to
be wrong.

**SCOPE — fix the family, not the leaf:** every surface where supplied press names can surface — ad copy body
(the authority angle especially), scripts, LP prose, email — NOT only the LP "As Seen In" section. Locking just
that section relocates the inflation into prose.

### (2) SHORT-FIELD READER-QUESTIONS — ASSESS BEFORE FIXING
Previously logged as one "register residual". **That was wrong — they are not one thing, and at least one may be
a DETECTION MISS rather than style.** Assess each against Meta's enumerated attribute list specifically
(physical/mental health incl. medical conditions; vulnerable financial status), then split:

* **"Stuck financially?"** — plausibly implies **vulnerable financial status**, which IS enumerated. If so this is
  a genuine Tier-1 exposure the compliance axis is currently **MISSING** — a bug, not polish.
* **"Stressed about how long this is taking?"** — "stress" shades toward mental health, which is enumerated, but
  Meta's docs do not resolve whether ordinary stress language counts. This is one of the genuinely undefined
  boundaries in the reference's OPEN section. **Do NOT invent a threshold**; report it as undefined if that is
  what it is.
* **"Scared of crypto?"** — caution about an asset class is neither a health condition nor financial
  vulnerability. Probably outside the enumerated list; style rather than violation.

**DELIVERABLE:** a per-phrase verdict — detection miss (fix the detector) / style preference (register polish) /
genuinely undefined (leave, document) — each traced to Meta's own wording. Only then propose fixes.

### (4) EIGHT UNCOVERED CLAIM-TRIGGERS — SEPARATE AXIS, not built
`treat` · `heal` · `reverse` · `eliminate` · `erase permanently` · `proven to` ·
`clinically proven` · `big pharma`. **Audited against the existing filter:** `cure`,
`guaranteed`, `100%`, `secret`, "they don't want you to know" and income guarantees are ALREADY
covered by `complianceFilter` (PIVOT/REJECTED) — do not duplicate. Unsubstantiated statistical
claims need nothing new either: the fabrication axis already catches them as
`invented_statistic`.

These eight are **predicates, not protected nouns**, so they do NOT flow through the anchoring
engine and cannot simply be added to the vocabulary. They need their own rule shape (§1.6
deceptive claims). Own pass.

### (5) VOCABULARY — REJECTED, with the evidence, so it is not re-proposed
Measured over 3,006 real texts: `reset`, `reclaim`, `healing`, `career transitions` produced ALL
13 false positives — **`reset` and `reclaim` are PRODUCT NAMES in real prod copy** ("The Profit
Reset", "reclaim their sense of self"). Also rejected: marketing-industry terms (CAPI, ROAS, MRR…)
and the mental symptom/proxy group (executive function, sensory regulation — service categories
more often than health assertions). A known gap is documented rather than papered over: a
publication name containing a tool/role stoplist token ("Harvard Business REVIEW") is not
detected; narrowing that stoplist would reopen the job-title FP class, and backlog item (1)
removes the need to detect press names in prose at all.

### (3) CARRY FORWARD — "throws only if nothing survives" NEVER EXECUTED LIVE
The adCopy generator throws when every variant is dropped. The arithmetic and the empty-deck condition are
verified; **the live throw has never been observed** because forcing all 46 generated variants to violate is not
reproducible on demand. Recorded so it is not mistaken for verified. (Live prod drop rates so far: beginner 2/46,
crypto 5/46, attribute 8/46, veteran 10/48, health 10/46, career-pivot 12/46 — nothing close to total.)

## 4d. TWO VERIFICATION RULES banked (2026-07-27/28)

### 🔴 TEARDOWN — a single post-delete count is NOT proof while background jobs are in flight
**Prod carried 8 orphaned `campaignConcepts` rows from the correction-pass ship.** The teardown
deleted them and measured 0; the rows reappeared minutes later with `createdAt` AFTER the delete.
Cause: `ensureConceptsForIcp` is fire-and-forget (`setImmediate`) at the ad-copy entry, so the
background generation landed BEHIND the teardown and re-inserted.

**RULE: wait for background jobs to settle, then RE-VERIFY.** Reconcile row COUNTS against a
pre-run baseline captured before the run — never just delete the ids you happen to hold, and
never treat one post-delete count as final. Known async writers that can land late: lazy concept
generation, the durable bonus-PDF job, and compliance-rewrite precompute.

### ⚠️ API-DRIVEN CASCADE RUNS PROVE NOTHING ABOUT THE WIZARD
Cascade verification is driven through the real orchestration API — the same server-side code the
UI triggers, and far less brittle across a long run. Playwright is used only where RENDERING is
the thing under test (published landing page, ad creatives, bonus PDFs, the Kit surface).

**Do NOT read any such run as "the wizard is verified."** The 11-node wizard click-through UX —
node ordering, chip/deck interactions, skip/recovery paths, the operator-intake conversation — is
NOT exercised. A wizard-interaction run is its own piece of work and has not been done.

## 4e. 🔴 ACTIVE PROD RUN — NOT TORN DOWN

**A cascade E2E run is in flight on prod and has live data that must be removed.**
Full detail, ids and teardown procedure: **`docs/handovers/ACTIVE_RUN_2026-07-28_cascade-e2e.md`**.

Short version: smoke coach (userId 117174) · service **279** · ICP **256** · kit **194** · offer
**207** · cascade job `50196735-efbb-4dff-a966-1f4e77d4e69d` was at step 3/9 when banked, so MORE
rows exist than that list. Reconcile against the pre-run baseline recorded in that file — do not
trust the id list. Nothing in this run is a code change.

## 5. Still open — Arfeen actions

* **🔴 SECURITY: rotate `zap-e2e-smoke@mailinator.com`'s password** and update `~/.zap-e2e-creds.env` before
  the next smoke run. CC leaked it into a transcript via a redaction-pattern miss — low severity
  (non-privileged test account, public inbox) but real.
* **Backlog:** cosmetic tidy-ups (stale "16 text section keys" comment at `icpPrompts.ts:204`;
  `ICP_JSON_SCHEMA.name` still `"ideal_customer_profile_17_tabs"`) · script filename feature (human-readable
  per-concept from awareness + hook + length) · blog generator + other ICP-powered tools · has-assets-path
  ladder (out of v1).

## 6. State

* Branch `railway-build`, **`HEAD = origin = d6ecc4a`** (verified 2026-07-27; `0656b67` is its parent).
  `main` untouched.
* Migration `0096` applied and verified on prod. No migration pending.
* Validator code **absent from the branch** (`fabricationValidator.ts`, `groundingCorpus.ts` gone; 0 publish-gate
  references in `meta.ts`); `6a89396` still reachable in history.
