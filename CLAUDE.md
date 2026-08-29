# CLAUDE.md — ZAP Campaigns Project Memory

## 1. Project Identity

- **Product:** ZAP Campaigns (zapcampaigns.com) — AI marketing-asset generator for coaches/speakers/consultants
- **Core UX:** 11-node Duolingo-style guided campaign path, 110+ assets per kit
- **Auto Mode vision:** signup -> single-text intake -> cascade -> Campaign Kit ready to push to Meta + GHL
- **Two user types:** blank-slate (ZAP generates all) and existing-assets (ZAP imports offer/ICP/method/lead-magnet as upstream context, fills gaps only)
- **Repo:** github.com/successunforgettable/coachflow
- **Working dir:** /Users/arfeenkhan/zap-deploy

## 1a. Current State — pointer, not a narrative

**👉 Read `docs/handovers/STATE.md`. That is the single source of current truth.**

It carries three sections and nothing else: **CURRENT STATE** (what is true now) · **THE QUEUE**
(what's next, in order, with enough diagnosis to execute without re-investigating) · **TRAPS** (what
will bite, including the protected prod rows and the not-a-defect list).

This section is deliberately a pointer. State used to be appended here and grew to ~94k characters
that loaded into every session automatically — the single largest cause of context exhaustion on
this project. **Do not re-accumulate state here.** New findings go into `STATE.md`, replacing what
they supersede rather than stacking on top of it.

Historical dated handovers live in `docs/handovers/archive/` — history, not current truth. Full
narrative of any past decision is recoverable from git.

**Verify ground truth at session start, actual values not recall:**

```
git fetch origin railway-build && git rev-parse HEAD origin/railway-build
npx tsc --noEmit 2>&1 | grep -c "error TS"     # expect 34
pnpm install --frozen-lockfile                  # must pass
```

## 2. Deference Rule (compulsory, locked)

- **Product owner:** Arfeen Khan (non-technical) — owns brand/product/scope calls only
- **CC role:** executes all code, owns ALL technical decisions
- **Claude (strategic assistant) role:** framing only; defers all technical calls to CC
- When CC has codebase grounding + HIGH confidence, recommendations are ACCEPTED — not punted back to Arfeen
- **Override trigger:** only if CC proposes a shortcut over the structurally correct path
- **Failure mode to avoid:** listing fix-shape options (H/I/J/K) instead of letting CC investigate and recommend

## 3. Branch + Deployment

- **Production branch:** `railway-build` (NEVER push to `main` during active sprints)
- Railway auto-deploys `railway-build` on push (~2-3 min)
- `server/_core/index.ts` on `railway-build` has W5 hotfixes (validateFontAtBoot + reapStuckJobs) that `main` lacks — naive bulk port from `main` silently deletes production safety
- 7 prompt-quality routers outstanding from `main` require own dedicated sprint, never bulk-merge
- Git convention: atomic single-commit sprints with descriptive conventional-commit messages

## 4. Tech Stack

- **Frontend:** React 19, Tailwind 4, shadcn/ui, Vite
- **Backend:** Express 4, tRPC 11, Drizzle ORM
- **DB:** **MySQL Community Server 9.4.0** on Railway — `@@version_comment` = `MySQL Community Server - GPL`. **NOT TiDB.** (Corrected 2026-08-28. The old line read "MySQL/TiDB"; a Stage B target guard that checked for TiDB to identify production could therefore never fire — see §15c.) ⚠️ Local Homebrew MySQL reports the **same** `VERSION()` string, `9.4.0`, so **VERSION() does not distinguish local from production.** `@@version_comment` does: production `MySQL Community Server - GPL` vs local `Homebrew`.
- **AI:** Anthropic Claude API (Sonnet for generation)
- **Storage/media:** Cloudinary, Remotion Lambda (us-east-1)
- **Integrations:** Stripe (live mode), Meta Ads API, GoHighLevel marketplace OAuth (workflows.readonly + locations/customValues.write scopes)

## 5. Architectural Invariants (never reverse)

1. **Duolingo principle** — all interactions within node, never break to separate page
2. **Generate More Show Less** — scoring engine picks single best; "Show Me More" pulls from already-generated batch at no extra cost
3. **Campaign Kit = source of truth** — "Use This & Continue" is the ONLY completion action
4. **Context cascade** — every downstream generator receives upstream selected assets
5. **V1 read-only** — `client/src/pages/` never touched for development; V2 files only
6. **DB migrations isolated** — never bundled with UI work
7. **Inline font styles mandatory** — every text element carries full font stack inline (never relies on CSS inheritance); root cause of all prior renderer failures
8. **Generate full batches always** — token cost negligible; larger pools produce better top selections

## 6. V2 Design System Non-Negotiables

- Inline styles only (className caused renderer failures)
- V2 CSS vars: `--v2-font-heading`, `--v2-font-body`, `--v2-text-color`, `--v2-primary-btn`, `--v2-border-radius-pill`
- Fonts: Fraunces italic 900 (headings), Instrument Sans (body)
- Pill buttons: `borderRadius: 9999`, padding `12px 28px`
- Card radius: 16px (V2 standard), 24px (feature cards)

## 7. Sprint Discipline

- One sprint, one commit, one spot-check
- **Pre-flight investigation** before every implementation prompt — investigation + recommendation only, no code, surface HIGH/MEDIUM/LOW confidence
- Comprehensive single-pass prompts to CC embedding all locked design decisions — no back-and-forth investigation rounds
- Screenshot proof mandatory before sprint approved
- Two-state proof required for persistence features (active + post-refresh)
- Screenshots come from Arfeen's browser (zapcampaigns.com) — CC never fabricates screenshots or Railway logs

## 8. Test Gates

- **Type-check baseline:** **34 errors** (`npx tsc --noEmit 2>&1 | grep -c "error TS"`) — must not regress; new work adds ZERO. The repo is **pnpm-only**, and 34 is the pnpm-canonical figure (**re-measured 2026-08-06**; it was 35 as at 2026-07-28, and one was retired by the Andromeda image work). The "38" figure came from an `npm ci` tree pinning `@types/node@24.12.0`, whose iterator typings surface two extra pre-existing `TS2802` errors — that path no longer exists, since `package-lock.json` is deleted.
- **Test suite:** `npx vitest run server/pipeline-fixes.test.ts` — report pass count. Also: `npx vitest run server/lib/complianceFilter.test.ts` and `npx vitest run server/_core/tokenCrypto.test.ts`
- Never use global vitest output (dominated by pre-existing infrastructure failures)
- Verify-before-commit: TS baseline holds, vitest passes, atomic commits
- Hold pushes for go-ahead unless explicitly authorized

## 9. SQL Safety Scan

Before any cross-table SQL on first-touch tables, check Drizzle schema for three failure classes:

1. **snake_case DB column overrides** where DB col != JS key (e.g., `jobs.created_at`, `idealCustomerProfiles.angle_name`) — alias as needed
2. **MySQL reserved-word column names** requiring backticks (e.g., `idealCustomerProfiles.values`)
3. **Generation-time parameters that aren't actual columns** (e.g., `whatsappSequences.sequenceLength` — count lives in `JSON_LENGTH(messages)`)

Always audit `INFORMATION_SCHEMA` before assuming Drizzle key == DB column. Committing `drizzle/*.sql` != applied; verify migrations match DB shape via direct query.

## 10. DB + Log Access Pattern

- CC runs read-only DB queries + Railway log fetches directly via `railway run --environment production --service coachflow sh -c '... mysql ...'` (DATABASE_URL injected, no password exposure)
- **HARD GATE — ALL prod-table writes** (INSERT, UPDATE, DELETE, ALTER TABLE, migrations, backfills) require Arfeen's explicit "execute" or "go ahead" in the **immediately preceding message** before the write is run. Showing the prepared statement and holding for approval is the ONLY correct pattern. Running a write without that explicit approval — regardless of how safe, how small, or how obviously correct — is a violation. If a session is interrupted, approval is ambiguous, or the prior message didn't contain an unambiguous go-ahead, **default to NOT writing**. No exceptions for low-risk, test accounts, schema-only, or "done it before."
- DB-first investigation: inspect DB type/structure (JSON_TYPE, JSON_KEYS) BEFORE proposing code-side mechanisms

## 11. GHL Deployment Architecture (locked)

- Workflows live in customer's own GHL via snapshot import, not on ZAP servers
- ZAP push only writes Custom Values via `locations/customValues.write` endpoint
- **Snapshot apply CANNOT be automated** — GHL v2 marketplace OAuth lacks `workflows.write` scope; Location tokens get 401 on `/snapshots/*`
- Customer's agency admin must manually click "Apply ZAP Master Snapshot" deep-link button in GHL's UI; one-time per location
- `GHL_MASTER_SNAPSHOT_ID` env var holds the snapshot ID
- **Tagging is customer-side responsibility** (decided May 27, 2026): push writes CVs only, never applies tags to contacts. Tag patterns: `zap-{workflow-name}` (email), `zap-wa-{workflow-name}` (WhatsApp). Customer wires their own funnel entry to apply the right tag.
- 16 canonical workflow names hardcoded in `server/routers/ghl.ts` `ZAP_WORKFLOW_NAMES` constant
- **Status detection** (shipped June 4): case-insensitive prefix `/^zap[\s-]/i` + 75% threshold (12/16). Green pill (installed), amber (partial), red + hard gate on Push to GHL (missing)

## 12. Key Accounts + IDs

- Arfeen: arfeen@arfeenkhan.com (Pro + Admin)
- Reviewer: zapreviewer@mailinator.com (Pro until 2027-04-09)
- Meta App ID: 1812711376090686
- GHL Marketplace app: 69af3395095745d484bc1b18 (APPROVED)
- GHL master location: yfK7u2subVFh1BJHPSyg
- Cloudinary: dunshei0y

## 13. Communication with Arfeen

- Terse, single concrete recommendation — never option menus
- Lead with next action; don't ask "what do you want to do"
- No rest/sleep/break suggestions — frame session breaks only in work logistics terms ("fresh head for spot-check"), never wellbeing or time of day
- Step-by-step click-by-click instructions for UI tests (he finds the UI confusing)
- Plain-text single-block prompts; no nested code blocks inside CC prompts

## 14. LLM Prompt-Writing Discipline

- Negative examples in system prompts are dangerous for Anthropic models — positive-only framing is the correct pattern
- Root cause of Sprint B email regression (May 2026): showing failure shape as "Wrong:" primed the model to emit it
- Stick to concrete-shape directives describing what the output IS

## 15. Marketing Content Default

- For ALL wire sprints, design decisions, content audits, copy reviews: authorize researching the marketingskills repo (github.com/mysticaltech/marketingskills.git) + web as the PRIMARY industry-grounded reference frame, BY DEFAULT without Arfeen prompting
- Fall back to general principles only where the repo doesn't cover the asset type
- **Visual-quality bars live in-repo — load the relevant one before any visual/design work on that asset type, and judge output against it:** ad images → `docs/AD_IMAGE_VISUAL_QUALITY_STANDARD.md` (+ `docs/ad-references/`); landing pages → `LANDING_PAGE_VISUAL_QUALITY_STANDARD.md` (+ `docs/landing-page-references/`)

## 15a. Reference Truth Invariant (STANDING LAW — compulsory, locked 2026-07-17)

- **The frozen PNG is the SOLE source of truth for any reference. Spec prose is secondary and must be reconciled to the pixels — NEVER the reverse.** Before building or judging against any replication spec, verify its prose against the frozen PNG; where they disagree, the PNG wins and the spec is wrong.
- **Why this is law:** three replication specs — Iman (`..Faceless_Product_Launch..`), Rajsekar (`..AI_Coaching_Workshop..`), and Ali (`..YouTube_Creator_Course..`) — carried prose that CONTRADICTED their own frozen PNGs ("poster only, not a chain of funnel sections"; "overwhelmingly white/coral"; "green CTA"). Every downstream artifact — the template, its unit test, CLAUDE.md, and the handovers — faithfully implemented the LIE and PASSED its gate, because the gate checked against the lie. Iman shipped at 0.48× and webinar at 0.54× of the real page. All three specs now carry a ⚠️ PROSE-VS-PNG correction banner.
- **A structural/self-judged PASS against a spec is worthless if the spec misreads the PNG.** Judge the render against the PNG itself, section-by-section, every time.
- **Any future reference spec MUST be written from the frozen PNG**, and re-reconciled to the pixels if the capture is ever replaced. A spec is a convenience index over the PNG, not an authority above it.

## 15b. Context Discipline — measured, not guessed (corrected 2026-07-29)

**The old "bank at 70% context" rule is WITHDRAWN. CC cannot measure its own context usage.**
Obeying an unseeable number meant guessing, and the guesses ran ~4× high: a session self-reported
"84%" while `/context` showed **22% used, 78% free**. On that invented constraint a live prod
cascade was declined **twice**, costing a session and a half of real work.

- **Never self-report a context percentage; never act on one.** No "I'm at ~70%", no "running low".
- **If a checkpoint decision genuinely depends on remaining room, ask Arfeen to run `/context` and
  paste it.** Only he can run it — it is a built-in CLI command, not a skill CC can invoke.
- **Never decline, defer, or truncate substantive work on a self-estimated figure.**
- **Bank at work boundaries** — task finished, run torn down, decision needing Arfeen's input,
  sprint ready to commit. Those are observable; percentages are not.

**Reading is the dominant cost — the real lever.** `/context` attributed **663.9k tokens (66%)** to
read results. Startup load is trivial by comparison (CLAUDE.md + MEMORY.md ≈ 10.5k combined).

- **Use `offset`/`limit`** — read the functions you need, not whole files. `adCreativesGenerator.ts`
  read in full cost 8,323 tokens; the two relevant functions would have cost a third.
- **Never pipe a bare `railway … --json` into context — ~94KB / ~24,000 tokens for ONE status
  check** (it embeds the entire commit message + service manifest). Always extract at the shell:
  `railway deployment list … --json | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(d['status'], d['meta']['commitHash'][:7])"`
- **Long reports go to `docs/handovers/` and get referenced, never pasted into chat.**
- Images are legitimately expensive (~1,400 tokens per 1024×1024) but are often the only ground
  truth for a visual defect — the 07-28 pixels overturned STATE.md's own P7 summary. Spend them
  deliberately, not reflexively.

**Unrelated and unchanged: teardown still outranks the artifact read.** That rule is about prod
safety, not context, and stands exactly as written in STATE.md TRAPS.

## 15c. VERIFICATION THAT CANNOT FAIL (STANDING LAW — locked 2026-08-28)

**A check that cannot fail proves nothing, and is worse than no check, because it reads as
coverage.** Three instances of this exact shape are now on record:

1. **The inert TiDB guard check.** A Stage B guard aborted if the target reported TiDB, to stop a
   migration hitting production. Production is **MySQL Community Server**, so that check could
   never fire. It sat in a guard that was otherwise correct and looked like a fourth layer of
   safety. It was decoration. (Stage A's guard carried the same dead check.)
2. **The completeness guard that never fires on the happy path.** Recorded as "an unfired guard is
   untested" — satisfied by construction, so it demonstrated nothing about the case it existed for.
3. **The statistic-rule proof run that could not detect its own subject.**
   `NO_RESEARCH_STATISTIC_FABRICATION_RULE` was reported missing from Node 5 on the strength of a
   pass that had no way to observe the rule's presence — and the rule had in fact been wired that
   same sprint by `ed3ea41`.

### The test — apply it to EVERY new guard, gate, proof run or assertion

> **State what result would make it fire. Then confirm that result is reachable.**
> **If it is not reachable, the check is decoration — delete it or fix it. Do not ship it.**

In practice that means running the **negative control**: feed the guard the thing it is supposed to
reject and watch it reject. Both 2026-08-28 stage guards were exercised this way and it is what
caught the TiDB error — the guard was pointed at production, aborted, and the abort was *correct*
for a reason nobody had predicted.

📌 **Related but distinct from §15a.** §15a is about judging against the wrong *source* (a spec that
misreads its own PNG; a generated row read back as framing). §15c is about a check that has no
*reachable failure*. A §15a gate passes against a lie; a §15c gate cannot fail at all. Both read as
green.

📌 **The corollary for test suites:** `fabricationValidator.test.ts` at 23/23 green while the gate
was blind is the same shape — the suite asserted only the strings the regexes were already written
against, so it could not fail on a phrasing nobody had thought of.

## 15d. MACHINERY WITH NO CALLER (STANDING LAW — locked 2026-08-29)

**Machinery is not done when it is correct. It is done when something reaches it.**

Three instances of one shape, every one found by accident rather than by looking:

1. **The pointer, the framings and `nextStepForHvcoId` shipped with no caller** — correct code,
   reviewed, tested, unreachable.
2. **`autoFillFrom`** — declared on the operator-token registry, read by nothing. Two tokens were
   documented "never asked of the coach, filled server-side", were duly SKIPPED by the question
   deriver, and were then never filled by anything.
3. **The trigger shipped with no input** (2026-08-29). `campaignKits.getCampaignFactsReadiness`
   returned `freeStepQuestions` carrying the comment *"the caller renders them as a skippable ask,
   never as a gate"* — and **no caller rendered them**. `grep -rn "freeStep" client/src` returned
   nothing. So `campaignFacts.eventSchedule` could never be filled by a coach, `hasAllEventFacts`
   was never true, and the free-event page could never be built. **Production had already proved it
   and nobody had read it that way: three lead-magnet kits, zero with event facts.** The approved
   intake copy existed only in `CHECKPOINT.md` — never in `client/`, never in `server/`.

### The rule

> **For anything a coach must supply, NAME THE SCREEN IT APPEARS ON before the work is called
> complete.** Not the endpoint, not the field, not the type — the screen, and the moment in the
> flow where the coach sees it.
>
> **A server endpoint returning a value is not a user being asked a question.**

📌 **Why this recurs here specifically.** The server half is satisfying to build and easy to test:
types, unit tests, a clean return value. The client half is where a value has to become a question
on a screen. And the server's own comment describing what "the caller" should do reads convincingly
like the work is finished — **that comment is a request, not an implementation.**

📌 **Related to but distinct from §15c.** §15c is a check that cannot fail; §15d is a feature that
cannot be reached. Both pass review, both look complete, neither does anything.

📌 **Cheap detection:** for every value a server hands to "the caller", grep the client for its
name. **Zero hits is the whole bug.** That single command would have caught all three instances.

## 15e. THE BRIEF IS NOT THE RATIONALE FOR THE BRIEF (STANDING LAW — locked 2026-08-29)

**A brief written to explain a test to the tester is not the brief production will see. Separate the
instruction from the reasoning for the instruction BEFORE anything is sent.**

**The instance.** To test whether the generator drifts B2B, this brief was supplied for a new
service: *"a relationship coach who helps individual people repair how they communicate with their
partner. One person, spending their own money, on their own relationship. No business, no clients,
nothing to sell to anyone."*

Sentences one and two are the niche. **Sentences three and four are the rationale** — Arfeen
explaining to CC why the niche is B2C. Sent verbatim into the product they become **priming**: the
generator is told the answer the experiment is trying to discover. A B2C result then proves much
less than it appears to, because the input contained its own conclusion.

### The rule

> **Before sending any brief, prompt or fixture into the product, strip every sentence that exists
> to explain the test rather than to describe the thing.** Ask of each sentence: *would the real
> user have written this?* If not, it is rationale, and it contaminates the result.

📌 **Why it is easy to miss:** the rationale is the most useful part of the message *to the person
receiving the instruction*, and the least legitimate part *of the input*. Its usefulness is exactly
what smuggles it through.

📌 **Related to §15c and §15d.** §15c is a check that cannot fail. §15d is a feature nothing reaches.
§15e is **an input that contains its own expected output** — the test is real, the harness is real,
and the result is still worthless. All three produce confident green.

📌 **The clean form of the brief above**, for the re-run:
*"I'm a relationship coach. I help people who keep having the same argument with their partner learn
how to talk to each other again."* — niche only, no framing in either direction.

## 15f. A BASELINE IS MEASURED, NEVER READ (STANDING LAW — locked 2026-08-29)

**Take the baseline at the moment of the run. Numbers printed in a document are history, not a
reference.**

**The instance.** CHECKPOINT.md carried a baseline for the six reads captured before any Stage D
write: `hvcoTitles` 6689 · `campaignKits` 68 · `landingPages` 92 / max id 236 / 38 published ·
`nodeStatuses` 85, ids 94–186. On 2026-08-29 the live numbers were **6749** and **69** — moved by
sixty magnet titles and one kit from the previous day's aborted run. Two of the six reads compared
against the printed figures would have shown a **surplus of 60 and 1** and been read as the new
run's own output. The two that had genuinely not moved would have looked equally trustworthy, which
is what makes the whole comparison unsafe rather than half-safe.

### The rule

> **Measure the baseline immediately before the run, from the source. Report deltas against those
> measured numbers, and SAY IN THE REPORT that they were measured at run time.**
>
> A document may record what a baseline *was*, for the decision record. It is never the thing a
> delta is computed against.

📌 **Why it is easy to miss:** the printed baseline is right there, it was measured carefully, and
it was correct when written. Nothing about reading it feels like a shortcut — it feels like using
the evidence. The staleness is invisible precisely because the document looks rigorous.

📌 **Same family as §15c.** A comparison against a stale baseline is a check whose result cannot be
trusted in either direction: a delta that matches proves nothing (the baseline may have drifted to
meet it) and a delta that misses proves nothing (the drift may be the whole difference). §15c is a
check that cannot fail; this is **a check that cannot mean anything** — and both read as rigour.

📌 **Applies to every count, fingerprint, row total, byte size, KV key count and quota figure**, and
to a restore point's own verification counts. If a number is going to be subtracted from, it gets
re-measured first.
