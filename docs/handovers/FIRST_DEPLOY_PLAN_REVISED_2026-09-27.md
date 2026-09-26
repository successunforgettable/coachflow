# FIRST DEPLOY — REVISED PLAN (trial / quota group held back) — 2026-09-27

**Supersedes** `COMPLETION_AND_FIRST_DEPLOY_PROPOSAL_2026-09-24.md` Part 2 §2.1, §2.5–§2.8 where they differ. Part 1
(honest completion) and §2.2–§2.4 of that file stand. **Planned only: nothing pushed, nothing committed to any existing
ref, no production write.** Every figure below was measured on 2026-09-27 in throwaway worktrees (detached HEAD,
removed afterwards) — re-measure at run time (§15f), never subtract from these.

| | |
|---|---|
| production | `origin/railway-build` = **`87596d7`**. ⚠️ the LOCAL `railway-build` ref is stale at `aa9209b` (15 behind). **Never `git push origin railway-build`** — push an explicit sha (§3 step 7) |
| held branch | `docs/held-2026-09-12` = **`479a9b7`**, 56 over production; honest completion will land on top |
| `fix/scenes-array-guard` `94ae237` | superseded by `231e655` on the held branch (same three files, same guard). **Do not push it** |
| deadline | 🔴 Arfeen's Meta login expires **2026-10-05** |

---

## 1. HOLDING BACK THE TRIAL / QUOTA GROUP

### 1.1 Membership — verified
Exactly five commits: **`65af5e2` `8881b69` `493650b` `7f624fc` `4cfad01`**. Checked by (a) `git log --grep` over
`trial|quota|tier|subscription` — every other hit is a docs-only commit (`f5783a2`, `197d0a3`, `33d2b10`, `c58d335`,
`e22f03e`); (b) listing every commit that touches any file the five touch. Outside the five, only **`5ecfeac` (GHL)**
touches their files: `server/_core/trpc.ts` and `server/routers/ghl.ts`. The three other suites in the checkpoint's
"this session" list — `auth.getQuotaLimits`, `budgetFloorCurrency`, `nextStepBridge` — are **unchanged since
production** (not touched by any held commit).

### 1.2 The one real dependency
`65af5e2` added a tRPC `errorFormatter` to `trpc.ts` (for `UsageLimitCause`). `5ecfeac` **extended that same
formatter** with a `GhlConnectionCause` branch that the push window and Settings read (`data.ghlConnection`). So a revert
of `65af5e2` conflicts there, and the resolution must **keep the formatter with only the GHL branch**. In `ghl.ts`,
`65af5e2`'s `assertCanPush` import and its two-line call in `pushCampaign` revert cleanly inside `5ecfeac`'s rewrite.
Nothing else outside the group imports `lib/tierAccess.ts` or `client/src/v2/lib/usageLimit.ts`.

### 1.3 The three methods
| method | verdict | why |
|---|---|---|
| **(a) `git revert`, as ONE forward commit on the held branch** | ✅ **recommended** | Tried: 5 reverts newest-first, **one conflict** (`trpc.ts`, above), resolved in 10 lines. Resulting runtime tree is **byte-identical to production on every trial/quota file**. Keeps `railway-build` a fast-forward of the held branch. Re-applying later = one `git revert` of that commit, **tested: restores `479a9b7`'s tree exactly (empty diff)** |
| (b) feature flag | ❌ | The group is not one switch: it moves Pro's headline cap (6/20 → 50), makes five Pro counters start counting, replaces the landing-page table, adds ~40 gate call sites and client Trail behaviour. Flagging means editing all of them — new untested code on the deploy path, and the trial code still ships dormant in the bundle |
| (c) deploy branch cherry-picked from `87596d7` | ❌ | ~20 code commits cherry-picked out of 56 interleaved ones; `5ecfeac` hits the same `trpc.ts`/`ghl.ts` conflicts anyway; `railway-build` would stop being an ancestor of the held branch, so the second deploy gets a merge instead of a fast-forward |

Five separate revert commits vs one: **one** (squashed `--no-commit`). Tested: the squashed tree equals the step-wise
tree exactly, and the re-apply is then a single `git revert <sha>`.

**Docs are kept.** Reverting the five also deletes `TRIAL_PAYWALL_OPTION_B_PROPOSAL` edits and the 8
`docs/screenshots/sprint2-trial-paywall/*.png`; the sequence restores `docs/` from the pre-revert tip so only runtime
code is held back.

### 1.4 Exact command sequence (run AFTER honest completion has landed and passed its gates)
```bash
cd /Users/arfeenkhan/zap-deploy            # on docs/held-2026-09-12, clean tracked tree
TIP=$(git rev-parse HEAD)                   # the honest-completion tip
git revert --no-commit 4cfad01 7f624fc 493650b 8881b69 65af5e2
#   expect exactly one conflict: server/_core/trpc.ts  (plus any honest-completion conflicts — §1.6)
#   resolve trpc.ts to: import GhlConnectionCause only; errorFormatter with ONLY the GhlConnectionCause branch
#   (no UsageLimitCause import, no usageLimit branch). Verified shape in §1.5.
git checkout "$TIP" -- docs                 # keep the trial docs and screenshots
git add server/_core/trpc.ts && git add -u server client docs
git status --short                          # nothing unmerged; tierAccess.ts, usageLimit.ts, trial*.test.ts deleted
git commit -m "chore(deploy): hold back trial paywall + quota table + expiry gates for the second deploy (reverts 65af5e2 8881b69 493650b 7f624fc 4cfad01; GHL error formatter kept)"
HOLD=$(git rev-parse HEAD)                  # record it — the second deploy is `git revert $HOLD`
```
**Second deploy:** `git revert --no-edit $HOLD` on the held branch → tested: tree identical to pre-revert. If
honest completion later edits the same lines in `V2Trail.tsx` / `V2CampaignKit.tsx`, expect conflicts there at re-apply
time too; resolve and re-run the trial suites (they come back with the revert-of-revert).

### 1.5 Measured in the reverted worktree (`479a9b7` + the hold-back; honest completion not yet present)
- **`trpc.ts` after resolution — diff vs `87596d7`:** `+ import { GhlConnectionCause } from "./ghlToken";` and an
  `errorFormatter` whose only branch maps `GhlConnectionCause` → `data.ghlConnection`; every other error returns
  `shape` unchanged. This is pure `5ecfeac`.
- **`npx tsc --noEmit | grep -c "error TS"` = 34** — floor held.
- **Suites** (all pass unless noted):

| suite | result | note |
|---|---|---|
| pipeline-fixes | 414 ✅ | |
| complianceFilter | 31 ✅ | |
| tokenCrypto | 10 ✅ | |
| conceptScriptValidator | 14 ✅ | |
| conceptScriptScenesGuard | 15 ✅ | |
| conceptScriptGenerator | 11 ✅ | |
| conceptScriptGeneratorDryRun | 7 ✅ | |
| complianceGate | 24 ✅ | |
| fabricationGateDefects | 15 ✅ | |
| groundingChecker | 60 ✅ | |
| coachFacts | 21 ✅ | |
| gateSummary | 7 ✅ | |
| conceptScriptPromptParity | 6 ✅ | prompt + retry note byte-equal to `87596d7` |
| complianceCheckerPrecision (sprint 8) | 63 ✅ | |
| ghlReliability | 34 ✅ | GHL does not depend on the trial code |
| auth.getQuotaLimits | 5 ✅ | unchanged file |
| budgetFloorCurrency | 21 ✅ | unchanged file |
| nextStepBridge | 20 ✅ | unchanged file |
| **trialAccess / trialGates / trialClient** | **ABSENT** | deleted by the revert (added by the group); return with the re-apply |
| **quotaLimits** | **19 pass, 14 fail** | the file reverts to production's. **Production `87596d7` gives the identical 14 fail / 19 pass** (measured) — the stale-value failures `65af5e2` recorded. Pre-existing, not a regression; it goes green again with the re-apply |

- NUL-byte scan of every changed runtime file: **clean** (perl scan; negative control with a planted NUL detected).
- `package.json` and `pnpm-lock.yaml`: **unchanged vs production**.
- `npx vite build` and the server `esbuild` both succeed.

### 1.6 Conflict points with honest completion (being built on `479a9b7` now)
| file | touched by the hold-back? | risk |
|---|---|---|
| `client/src/v2/V2Trail.tsx` | **yes** — 23 trial hunks (`65af5e2`, `493650b`): limit-stop handling at many step call sites, import node-by-node | 🔴 highest — honest completion's Skip / completion edits sit in the same component |
| `client/src/v2/V2CampaignKit.tsx` | **yes** — 6 hunks (`493650b`): Pro-only push pill / note, completion overlay | 🔴 completion overlay is exactly honest-completion territory |
| `server/routers/campaignKits.ts` | no (only `54c7555`, comment-only) | ✅ none |
| node-skip code | unknown until it lands | check `git diff 479a9b7 <tip> --name-only` against the list in §2 |

**Ask the honest-completion builder:** do not build on trial symbols (`usageLimit.ts`, `isUsageLimit`, `tierAccess`,
the Pro-only pill/overlay branches from `493650b`). If it does, the hold-back revert will leave dangling references
(tsc will catch them — which is why tsc runs after the revert, not before).

---

## 2. WHAT SHIPS — every runtime file vs `87596d7` (reverted tree, before honest completion)

`git diff --name-only 87596d7 <reverted> -- server client/src shared drizzle` = **40 files**; outside those paths only
`docs/` and `CHECKPOINT.md`.

| file | commits | class |
|---|---|---|
| `client/src/v2/PushKitModal.tsx` | 5ecfeac | **intended — GHL** |
| `client/src/v2/V2Settings.tsx` | 5ecfeac | **intended — GHL** |
| `client/src/v2/components/WorkflowStatusPill.tsx` | 5ecfeac | **intended — GHL** |
| `server/_core/ghlToken.ts` (new) | 5ecfeac | **intended — GHL** |
| `server/_core/ghlOAuth.ts` | 5ecfeac | **intended — GHL** (removes the caller-less `exchangeCode`) |
| `server/routers/ghl.ts` | 5ecfeac (65af5e2 lines reverted) | **intended — GHL**. Diff vs `5ecfeac`'s own file = only the 3 `assertCanPush` lines |
| `server/_core/trpc.ts` | 5ecfeac | **intended — GHL** (error formatter, GHL branch only) |
| `drizzle/0112_ghl_reconnect_required.sql` | 5ecfeac | **intended — GHL migration** (applied separately, before the push) |
| `drizzle/schema.ts` | 5ecfeac, 799bd84 | **intended** (0112's two columns — **needs 0112 first**, every `ghl_access_tokens` read names them) + **inert** (`coachFacts` table def, 0111 already applied; no production query reads it) |
| `drizzle/0111_coach_facts.sql` | 799bd84 | **inert** — already applied on production |
| `server/_core/complianceAxis.ts` | 5c2d34e, 51bda65 | **intended — sprint 8** (comparison PASSED 2026-09-27) |
| `server/_core/conceptScriptValidator.ts` | 231e655, 0288828, 60ec85f, ae175bc, d076ecb, d2db31e | **intended — scenes fix** (`Array.isArray` guard) + **inert** label-only hook check (`labels` never enter `hits` or `failContext`; read only by `onGate`). Retry note byte-equal to production (parity test) |
| `server/conceptScriptGenerator.ts` | 231e655, c609910, dbfe389, ae175bc, 60ec85f, 0787b33, a717818 | **intended — scenes fix** + **inert** `dryRun` / `onGate` / `promptTransform` (sole production caller `conceptScriptBatch.ts:85` passes `{userId, conceptId, scriptSetId}` only). Prompt byte-equal to production (parity test, fixture from `87596d7`) |
| `server/conceptGenerator.ts` | 82d1949, 54c7555 | **inert** — `dryRun` / `onGate`; production callers (`ensureConceptsForIcp` from `adCopyGenerator.ts:356`, `conceptScriptBatch.ts:126`, `campaignKits.ts:188`) pass neither; the default observer is a no-op |
| `server/routers/campaignKits.ts` | 54c7555 | **inert** — comment only |
| `server/_core/coachFacts.ts` | 41c817c | **inert** — importers are only `groundingChecker.ts`, fixtures and `server/scripts/`; **absent from the server bundle** (symbol count 0 in `dist/index.js`) |
| `server/_core/groundingChecker.ts` | d04a08c, c609910, 23c563e | **inert** — importers only fixtures and `server/scripts/`; absent from the server bundle |
| `server/scripts/*` (9 files) | harness commits | **inert** — CLI scripts, not reachable from `server/_core/index.ts` |
| `server/__fixtures__/*` (2 files) | d04a08c, 60ec85f, d2db31e | **test fixture** |
| `server/*.test.ts`, `server/_core/complianceCheckerPrecision.test.ts` (9 files) | various | **test** (`pipeline-fixes.test.ts` edit follows the GHL banner rename) |

**Trial / quota / tier after the revert — identical to `87596d7`:** `quotaLimits.ts`, `lib/quotaEnforcement.ts`,
`db.ts` (counters), `_core/orchestration.ts`, `routers/autoMode.ts`, `routers/meta.ts`, `routers/landingPages.ts`, all
the per-node routers the group touched, the generators, `V2Trail.tsx`, `V2CampaignKit.tsx`, `V2TrailIntake.tsx` —
`git diff --quiet` on each. `auth.getQuotaLimits` was never changed. `lib/tierAccess.ts` and
`client/src/v2/lib/usageLimit.ts` do not exist. A keyword scan of the whole runtime diff for
`subscriptionTier|quota|trial|tier|isPro|Pro-only|getQuotaLimit` finds only `coachFacts.ts` (`sourceTier`, unrelated)
and a test fixture user. The `trpc.ts` middleware (`requireUser`, admin) is unchanged; only the formatter is new.

**Unexplained runtime differences: none.** Every changed runtime file maps to scenes fix, GHL, sprint 8, the
already-held-back hook wording (restored byte-equal), or inert machinery with no production caller.

---

## 3. DEPLOY SEQUENCE (each step waits for the one before)

**Gate 0 — honest completion lands** on the held branch with its own gates and Arfeen's screenshot sign-off.

1. **Hold-back commit** — §1.4. Then gates on the held tip: `npx tsc --noEmit | grep -c "error TS"` = 34; the §1.5
   suites (trial suites absent, quotaLimits 14/19 as production) **plus honest completion's suites**; NUL scan;
   `pnpm install --frozen-lockfile`; `git diff --quiet 87596d7 HEAD -- <trial file list in §2>` for every file except
   those honest completion itself changes (those get diffed by eye against its commit).
2. **Re-classify** — `git diff --name-only 87596d7 HEAD -- server client/src shared drizzle`: every file not in §2's
   table must be an honest-completion file. Anything else ⇒ stop.
3. **Deploy markers (§15h) — derive from built artefacts, count in both.** Build the new tip (`npx vite build` in a
   worktree), fetch the live bundle (`curl -s https://zapcampaigns.com/ | grep -oE '/assets/index-[^"]+\.js'`), count.
   Measured today (live bundle `index-Cw5P3O25.js` = local `87596d7` build; reverted build `index-C9Y25VoJ.js`):

   | marker | live `87596d7` | deploy build | role |
   |---|---|---|---|
   | `values confirmed` | 0 | 2 | must appear |
   | `ghl-status-cant-check` | 0 | 1 | must appear |
   | `Connection ended — reconnect GoHighLevel` | 0 | 1 | must appear |
   | `slots pushed` | 1 | **0** | **must disappear** |
   | `Partial push` | 1 | **0** | **must disappear** |
   | `push-pro-only-pill` | 0 | 0 | must stay absent — **control: the unreverted `479a9b7` build has 1**, so a 0 is a real absence (§15k) |
   | `usageLimit` | 0 | 0 | must stay absent — control: `479a9b7` build has 1 |

   Server bundle (`esbuild`, for the record; not fetchable live): `reconnectRequiredAt` 0 → 5, `GhlPushSession` 0 → 8,
   `UsageLimitCause` / `assertCanPush` / `trialUsageWhere` 0 → 0.
   **Re-derive after honest completion lands** (add ≥1 appear and ≥1 disappear marker from its own diff) and re-count
   all rows — honest completion changes the bundle.
4. **Arfeen's go-ahead for 0112** (explicit, in the immediately preceding message).
5. **0112 — read-only before** (guarded runner, READ ONLY transaction):
   `SELECT @@version_comment, DATABASE();` → `MySQL Community Server - GPL`, `railway` ·
   `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='railway' AND TABLE_NAME='ghl_access_tokens' ORDER BY ORDINAL_POSITION;`
   → `reconnectRequiredAt` and `lastRenewalError` **absent** (if present: stop — someone applied it) ·
   `SELECT COUNT(*) FROM ghl_access_tokens;` → baseline, measured now.
   **Apply** `drizzle/0112_ghl_reconnect_required.sql` with the house guard (abort unless the version comment and
   database match). **After:** the same COLUMNS query shows exactly the two new columns, `timestamp` / `varchar(512)`,
   both `IS_NULLABLE=YES`, every other column unchanged; row count equals the baseline;
   `SELECT COUNT(*) FROM ghl_access_tokens WHERE reconnectRequiredAt IS NOT NULL` = 0 (meaningful only because the
   COLUMNS read proved the column exists). Production's running code keeps working (it names its columns explicitly) —
   check boot/logs show no error in the minutes after.
6. **Arfeen's go-ahead for the push.**
7. **Push = the deploy:** `git merge-base --is-ancestor 87596d7 <tip>` (must be true — fast-forward),
   then `git push origin <tip-sha>:railway-build` (explicit sha; **never** the stale local `railway-build` ref).
   Watch: `railway deployment list --json | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(d['status'], d['meta']['commitHash'][:7])"` until `SUCCESS <tip>`.

## 4. LIVE VERIFICATION
1. **Build:** Railway `SUCCESS` on the tip sha; fetch the served `index-*.js` and count every §3 marker — appear rows
   at the build's count, disappear rows at 0, trial rows at 0.
2. **Boot:** logs clean — no `Unknown column`, font validation + reaper lines normal.
3. **GHL reconnect:** Arfeen opens Settings. Either **Connected** (renewal worked — read-only: `ghl_access_tokens`
   expiry moved) or **"Your GoHighLevel connection has ended — reconnect GoHighLevel"** with the button
   (`reconnectRequiredAt` set). If the latter, he reconnects; the pill goes green; `reconnectRequiredAt` back to NULL.
4. **Push read-back:** during the walkthrough, Push to GHL shows **"✓ Saved to GoHighLevel — N values confirmed"**, and
   N matches what he sees in GHL → Settings → Custom Values (checklist step 20). A partial result must say
   "Not everything reached GoHighLevel" with a Retry — never a false success.
5. **Sprint 8 unchanged verdicts:** `sha256sum` of the deployed `server/_core/complianceAxis.ts` (at the tip) equals the
   file the 2026-09-27 comparison ran (branch file identical at `c58d335`/`d2db31e`); then 24–48 h read-only watch of
   `complianceTelemetry` block rate vs the prior week — expect a small drop (7 false positives released), **zero new
   blocks** on previously-allowed copy.
6. **Scripts:** a video-script generation during the walkthrough completes; logs show no `scenes` TypeError; new
   `conceptScripts` rows appear for the kit. Prompt is production's byte-for-byte (parity test) — no quality shift
   expected.
7. **Honest completion:** a kit without ad images is not shown complete; Skip behaves per Arfeen's decision 5 — exact
   states to be listed by the honest-completion build record; check each on the live site.
8. **Pro account unchanged:** on Arfeen's account, generate headlines and one other node — never refused, no limit
   message beyond what production already does. Headline caps stay production's exactly — `87596d7`
   `routers/headlines.ts:144` (`agency ? 20 : 6`, so Pro = 6 on that route) and `:188` (Pro 20) — because the quota
   table did not ship. A Pro refusal at those old caps is existing behaviour, not a regression; any refusal BELOW them
   is a rollback trigger. Read-only: grep logs for `FORBIDDEN` on Pro accounts.
9. The trial test account is **not needed** for this deploy (the trial code is not in it).

## 5. ROLLBACK
- **Triggers:** boot failure; `Unknown column`; GHL push or Settings erroring where it worked; script/generation error
  rate up; a compliance block the comparison did not predict; honest completion marking a finished kit incomplete (or
  vice versa) on real kits.
- **Fastest:** Railway → deployments → redeploy the previous deployment (`87596d7`). Minutes, no git change.
- **Then make git match:** one forward commit on `railway-build` restoring `87596d7`'s tree — **never a force push**.
  The held branch keeps everything.
- **0112 stays.** Additive, nullable; the old code names its columns and ignores them. A renewed GHL token remains valid
  for the old code until it expires.
- **Partial:** if only one group misbehaves, revert just its commit(s) on the held branch and redeploy (sprint 8:
  `5c2d34e` + `51bda65`, the only commits touching `complianceAxis.ts`).

## 6. TIMELINE — 2026-09-27 → 2026-10-05

| date | work | gate / owner |
|---|---|---|
| **Sat 09-27** | This plan. Honest completion being built (other agent) | — |
| **Sun 09-28** | Honest completion finishes: gates + local screenshots; Arfeen signs it off. Then the hold-back commit (§1.4), all §3 step 1–3 gates, markers re-derived with honest completion's own | Arfeen: honest-completion screenshots |
| **Mon 09-29** | 0112 read-only before → **apply (go-ahead)** → read-only after. Then **push (go-ahead)**. Live checks §4.1–4.3 the same hour | Arfeen: two explicit go-aheads |
| **Tue 09-30** | Arfeen's walkthrough on the new build (`WALKTHROUGH_CHECKLIST_2026-09-24.md`): GHL reconnect, full Lead Magnet kit, Push to GHL + Custom Values check, scripts, completion states. Read-only watch starts (§4.5, §4.8) | Arfeen |
| **Wed 10-01** | Walkthrough finishes / fix anything it finds (fix = a forward commit, same gates, redeploy) | CC + Arfeen |
| **Thu 10-02** | 48 h watch closes: compliance rate, script failures, any Pro refusal. Decision: first deploy stable | CC reports |
| **Fri 10-03 – Sat 10-04** | **Buffer** for a rollback or a second fix deploy. Meta push of the walkthrough kit (paused) if not already done | Arfeen |
| **Sun 10-05** | 🔴 Meta login expires — everything Meta-dependent done by 10-04 | — |

**Slip rule:** if honest completion is not signed off by end of **09-30**, deploy without it (hold-back commit on
`479a9b7`'s line, markers as measured above) on 10-01 so the walkthrough still happens before 10-05; honest completion
follows in the second deploy with the trial group.

The second deploy (trial / quota / expiry) = `git revert $HOLD` on the held branch + the Pro-caps decision + the trial
test account check from the 09-24 plan §2.6.5 — after 10-05.
