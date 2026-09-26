# RUNBOOK — FIRST DEPLOY, 2026-09-29

**Candidate:** held branch `docs/held-2026-09-12`. The runtime candidate is **`32785ee`**; anything above it on the
branch is docs only (step R0 proves it). Production today: `railway-build` = **`87596d7`**.
**What ships:** the scenes-crash fix, GHL renewal and truthful push (with migration 0112 first), sprint 8, the inert
grounding work, the hook-wording hold-back, and honest completion, including the Skip change and the welcome-line fix.
**What is held:** the trial paywall, the quota table and the expiry gates (hold-back commit `49c0d17`).

🔴 **Three production actions, each with its own go-ahead from Arfeen in the message immediately before it:**
**GO-1** apply 0112 · **GO-2** push `railway-build` · **GO-R** any rollback.
Everything else is read-only. If a go-ahead is ambiguous, don't act.
🔴 **If Arfeen says he is starting the walkthrough, stop everything deploy-related until he says he's done.**

---

## R0 — Pre-flight (read-only; no go-ahead needed)

```bash
cd /Users/arfeenkhan/zap-deploy
git fetch origin
git rev-parse --short origin/railway-build              # expect 87596d7 — if not, STOP (someone deployed)
TIP=$(git rev-parse origin/docs/held-2026-09-12); echo $TIP
git status --porcelain --untracked-files=no | wc -l     # expect 0
git merge-base --is-ancestor 87596d7 $TIP && echo FF-OK # must print FF-OK (push is a fast-forward)
git diff --stat 32785ee $TIP -- server client shared drizzle package.json pnpm-lock.yaml vite.config.ts   # expect EMPTY
npx tsc --noEmit 2>&1 | grep -c "error TS"               # expect 34
railway deployment list --service coachflow --environment production --json | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(d['status'], d['meta']['commitHash'][:7])"   # expect SUCCESS 87596d7
```
Any mismatch ⇒ **STOP and report.** Never push the local `railway-build` ref; it's stale.

## R1 — 0112 read-only check (no go-ahead needed)

```bash
railway run --environment production --service coachflow node docs/handovers/deploy-2026-09-29/0112-check.mjs
```
Expect:
- `target: MySQL Community Server - GPL | railway | read_only = 1`
- 11 columns, with **both** `reconnectRequiredAt present: false` and `lastRenewalError present: false`
- a row count. **Record it:** it is the baseline, measured now (§15f).

If either column is present, **STOP**: someone has applied it. Report it; do not continue.

⏸ **STOP. Report the R1 output to Arfeen and ask for GO-1.**

## R2 — Apply migration 0112 — 🔴 GO-1 required

Only after Arfeen's explicit go-ahead for 0112 in the immediately preceding message:
```bash
railway run --environment production --service coachflow sh -c 'CONFIRM=APPLY-0112 node docs/handovers/deploy-2026-09-29/0112-apply.mjs'
```
The script aborts, writing nothing, unless all of these hold:
- `CONFIRM` is set;
- the SQL file is the reviewed statement, exactly;
- the target is `MySQL Community Server - GPL` / `railway`;
- both columns are absent.

After running the statement it verifies itself. Expect
`APPLIED — verified: exactly the two columns added, no column lost, row count unchanged` and exit 0.

Then:
1. Re-run R1. Expect 13 columns, both columns `present: true` (`timestamp:YES` and `varchar(512):YES`), the row count
   equal to the R1 baseline, and `rows with reconnectRequiredAt set: 0`.
2. Watch the production logs for 5 minutes. The running code (`87596d7`) names its columns, so it ignores the new ones:
   ```bash
   railway logs --service coachflow --environment production 2>&1 | grep -iE "unknown column|ER_|error" | tail -20
   ```
   Expect nothing new.

If the script prints `ABORTED` or `VERIFY FAILED`, **STOP and report the output verbatim.**

⏸ **STOP. Report R2 to Arfeen and ask for GO-2.**

## R3 — Push = the deploy — 🔴 GO-2 required

Only after Arfeen's explicit go-ahead for the push in the immediately preceding message, **and only once R2 has
succeeded** (the new code reads the 0112 columns; without them every GHL read fails with "Unknown column"):
```bash
TIP=$(git rev-parse origin/docs/held-2026-09-12)
git merge-base --is-ancestor 87596d7 $TIP && git push origin $TIP:refs/heads/railway-build   # explicit sha; fast-forward only; NEVER --force
```
Watch until the tip is live (about 2–3 minutes; never pipe raw `--json` into context):
```bash
railway deployment list --service coachflow --environment production --json | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(d['status'], d['meta']['commitHash'][:7])"
```
Expect `SUCCESS <TIP short>`. If you see `FAILED`/`CRASHED`, go to **R5**. Tell Arfeen, and ask for GO-R before acting.

## R4 — Live checks (read-only, except that Arfeen uses the site)

**R4.1 Deploy markers (§15h).** Fetch the live entry bundle and every chunk it names, then count. Count markers; never
compare hashes. The live `87596d7` bundle hash does not match a local build of `87596d7` (Railway injects build-time
env), so a hash proves nothing.
```bash
D=$(mktemp -d); cd $D; E=$(curl -s https://zapcampaigns.com/ | grep -oE '/assets/index-[^"]+\.js' | head -1); curl -s "https://zapcampaigns.com$E" -o entry.js
for m in $(grep -oE '"(\./|/assets/)?[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.js"' entry.js | tr -d '"' | sed -E 's#^(\./|/assets/)##' | sort -u); do curl -s "https://zapcampaigns.com/assets/$m" -o "$m"; done
for k in "values confirmed" "ghl-status-cant-check" "Connection ended — reconnect GoHighLevel" "kit-readiness-pill" "I already have this — use mine" "hasn't been published yet" "Push is off until" "slots pushed" "Partial push" "Skip — I already have this" "11 of 11 — every piece built" "This campaign is complete." "push-pro-only-pill" "usageLimit"; do printf "%-45s %s\n" "$k" "$(cat *.js | grep -oF "$k" | wc -l | tr -d ' ')"; done
```
These counts were measured on 2026-09-27. "Live 87596d7" is today's served bundle. "Candidate" is a local build of
`32785ee`. "Control" is `106f863`, which still contains the trial code: it shows the trial markers can be detected.

| role | marker | live `87596d7` | candidate | control |
|---|---|---|---|---|
| must appear | `values confirmed` | 0 | **2** | 2 |
| must appear | `ghl-status-cant-check` | 0 | **1** | 1 |
| must appear | `Connection ended — reconnect GoHighLevel` | 0 | **1** | 1 |
| must appear | `kit-readiness-pill` | 0 | **1** | 1 |
| must appear | `I already have this — use mine` | 0 | **1** | 1 |
| must appear | `hasn't been published yet` | 0 | **1** | 0 |
| must appear | `Push is off until` | 0 | **2** | 2 |
| must disappear | `slots pushed` | 1 | **0** | 0 |
| must disappear | `Partial push` | 1 | **0** | 0 |
| must disappear | `Skip — I already have this` | 4 | **0** | 0 |
| must disappear | `11 of 11 — every piece built` | 2 | **0** | 0 |
| must disappear | `This campaign is complete.` | 1 | **0** | 1 |
| must stay absent | `push-pro-only-pill` | 0 | **0** | 1 |
| must stay absent | `usageLimit` | 0 | **0** | 1 |

**Pass:** every candidate count reproduced on the live site. Any "must disappear" still above 0 means the new bundle
isn't what's being served. Wait 2 minutes and re-fetch once; if it's still wrong, report.

**R4.2 Boot.** Search the logs since the deploy for `Unknown column`, `TypeError`, `Cannot find module` and `validateFontAtBoot`:
```bash
railway logs --service coachflow --environment production 2>&1 | grep -iE "unknown column|typeerror|cannot find module|validateFontAtBoot|reapStuckJobs" | tail -20
```
Expect the font-validation and reaper lines as normal, and no errors.

**R4.3 Sprint 8 unchanged verdicts.** The deployed `server/_core/complianceAxis.ts` must be the file the 2026-09-27
comparison ran: `git show $TIP:server/_core/complianceAxis.ts | shasum -a 256` starts **`7155e6b8688b6e79`**
(the same at `c58d335`).

**R4.4 Arfeen's browser checks** (click by click, on zapcampaigns.com, his admin account):
1. **Settings → GoHighLevel.** He sees either **Connected**, or *"Your GoHighLevel connection has ended — reconnect
   GoHighLevel"* with a button. If it's the second, he clicks Reconnect and completes GHL's screen, and the status turns
   green. (CC, read-only: `reconnectRequiredAt` is NULL again afterwards.)
2. **Open campaign 225's Campaign Kit.** The pill reads **"Ready to push"**, **"Built — N things to fix"** or
   **"In progress"**, never the old "Complete". If it isn't ready, the list above the sections says why, and the Push
   button is off.
3. **Open campaign 225's Trail.** The welcome line says what's actually true: *"up next"* only for a piece that isn't
   built, *"built but hasn't been published yet"* for an unpublished page, and *"ready to push"* only when it is.
4. **Pro unchanged.** He generates one set of headlines on his account. It isn't refused. Production's own limits still
   apply (6 on the sync route, 20 on the async route, `routers/headlines.ts:144/:188`, byte-identical to `87596d7`). A
   refusal *below* those numbers is a rollback trigger.

The walkthrough's own steps (the push read-back of *"Saved to GoHighLevel — N values confirmed"*, Offer/Method/Lead
Magnet "use mine", no Skip on Headlines/Ad Copy/Landing Page, a video script completing) are in
`WALKTHROUGH_CHECKLIST_2026-09-24.md`. They are done **after** R4, as decision 4 requires.

**R4.5 A 24–48 hour read-only watch.** Watch the compliance block rate against the week before. Expect a small drop
(7 false alarms released) and **no new blocks** on copy that was previously allowed. Watch for no `scenes` TypeError
in the logs, and for no `FORBIDDEN` on a Pro account below the old limits.

⏸ **STOP. Report R4 to Arfeen. The deploy is done. The walkthrough is his to start.**

## R5 — Rollback — 🔴 GO-R required (unless the site is down and Arfeen has said "roll back on sight")

**Triggers:**
- the boot fails, or the logs show `Unknown column`;
- GHL Settings or push errors where it used to work;
- the generation error rate goes up;
- a compliance block the comparison didn't predict;
- honest completion calls a finished kit unfinished (or the reverse) on real kits;
- Pro is refused below 6/20.

1. **Fastest:** Railway → coachflow → Deployments → the previous deployment (`87596d7`) → **Redeploy**. It takes
   minutes and needs no git change. Confirm `SUCCESS 87596d7` with the R3 watch command, and count the R4.1 markers:
   the live column should be back.
2. **Then make git match:** one **forward** commit on `railway-build` restoring `87596d7`'s tree, which needs its own
   go-ahead. **Never force-push.** The held branch keeps everything.
3. **0112 stays.** It's additive and nullable, and `87596d7` ignores the columns. A GHL token that was renewed stays
   valid for the old code.
4. **Partial rollback** (one group misbehaves): revert only its commits on the held branch, redeploy through R3, and get
   a new GO-2. Sprint 8 = `5c2d34e` + `51bda65`; honest completion = `e08f973` + `32785ee`.

---

## Measured on 2026-09-27, for the decision record (re-measure at run time; never subtract from these)

**Gates on `32785ee`:**
- tsc: **34** errors.
- `pnpm install --frozen-lockfile`: passes. `package.json` and `pnpm-lock.yaml` are identical to `87596d7`.
- 23 suites. 22 are green: pipeline-fixes 414 · complianceFilter 31 · tokenCrypto 10 · conceptScriptValidator 14 ·
  conceptScriptScenesGuard 15 · conceptScriptGenerator 11 · conceptScriptGeneratorDryRun 7 · complianceGate 24 ·
  fabricationGateDefects 15 · groundingChecker 60 · coachFacts 21 · gateSummary 7 · auth.getQuotaLimits 5 ·
  budgetFloorCurrency 21 · nextStepBridge 20 · ghlReliability 34 · conceptScriptPromptParity 6 ·
  complianceCheckerPrecision 63 · complianceAxis 48 · kitReadiness 31 · kitReadinessView 19 · importPolicy 17.
- `quotaLimits` is **14 failed / 19 passed**. That is identical, test by test by name, to production `87596d7`: the
  file is unchanged from production and the failures are inherited, not a regression.
- The trial suites (trialAccess, trialGates, trialClient) are absent by design and come back with the second deploy.
- NUL scan clean.

**Hold-back `49c0d17`:** of the 38 non-doc files the five trial commits touched, **34 are byte-identical to
`87596d7`**. The other 4 differ only by approved work and have **no** trial, quota or tier line in their diff:
V2Trail and V2CampaignKit (honest completion); trpc.ts and ghl.ts (GHL). `quotaLimits.ts`, `routers/headlines.ts` and
`routers/autoMode.ts` are byte-identical to `87596d7`, so **Pro headline limits are still 6 / 20**.

**Every runtime file that differs from `87596d7`** (50) is in the revised plan's §2 table or is one of the 5
honest-completion files. Tests, fixtures and `server/scripts/*` have no runtime importer.

**The 0112 guard's negative controls:**
- no `CONFIRM` ⇒ aborted.
- `CONFIRM` against local Homebrew ⇒ it passed the SQL-shape check (the check matches the real file), then aborted
  on "not production".
- The read-only check refuses a non-production target.
- The migration statement applied to a throwaway local copy adds exactly `reconnectRequiredAt timestamp NULL` and
  `lastRenewalError varchar(512) NULL`.

**Second deploy (not this one):** `git revert 49c0d17` on the held branch. `32785ee` (the welcome-line fix) edits
`V2Trail.tsx` after the hold-back, so expect a conflict there at re-apply time. Resolve it, then re-run the trial
suites.
