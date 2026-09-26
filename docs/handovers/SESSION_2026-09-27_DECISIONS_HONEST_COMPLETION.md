# 2026-09-27 — decisions received, honest completion built, first deploy re-planned

## Decisions (Arfeen, 2026-09-27)
| # | decision | status |
|---|---|---|
| 1 | Pro caps | **OPEN** — investigated: `PRO_CAPS_AND_CAMPAIGN_COST_2026-09-27.md` |
| 2 | Apply migration 0112 as part of the deploy | ✅ approved (the apply itself still needs the go-ahead in the message immediately before) |
| 3 | Trial test account | **OPEN** — not needed for the first deploy; trial investigated: `TRIAL_MARCH_DESIGN_VS_CODE_2026-09-27.md` |
| 4 | Deploy first, then the walkthrough on the new build | ✅ approved |
| 5 | Skip → "use mine" import on Offer/Method/Lead Magnet; removed on Headlines/Ad Copy/Landing Page | ✅ approved — **built** `e08f973` |

First deploy **excludes** the trial / quota / expiry group (held for a second deploy). Plan:
`FIRST_DEPLOY_PLAN_REVISED_2026-09-27.md`.

## Honest completion — `e08f973` (held branch)
- One readiness answer: `server/_core/kitReadiness.ts` (`isKitBuilt`, `computeKitReadiness`) + `campaignKits.getReadiness`.
  Callers: `V2CampaignKit.tsx` (pill, blocker list, Push), `V2Trail.tsx` (`runCompletionBeat`, auto + manual).
- Both server completion writers share `isKitBuilt` (updateSelection used to ignore ad images).
- Skip: `client/src/v2/importPolicy.ts`, `components/AssetImportForm.tsx`, `V2Trail.tsx runImportMine`.
- Tests: kitReadiness 31 · kitReadinessView 11 · importPolicy 17. Deliberate breaks: **16/16 caught**.
- Browser: `docs/screenshots/honest-completion/` 01–12, local build, throwaway Homebrew MySQL (prod schema only),
  no model / publish keys. 07 and 11 are the same frame (the import that completes the Trail triggers the ready beat).
- The Trail does not replay the end beat on reload of a fully built kit — the beat fires when the loop finishes.
- e2e smoke spec: the 0-card re-sync now clicks "Try again" (the Skip chip is gone).
- Seen, NOT fixed (pre-existing): the Trail welcome says "Landing Page is up next" for a built-but-unpublished page.

## Hold-back re-checked ON TOP of `e08f973`
The plan's revert (`git revert --no-commit 4cfad01 7f624fc 493650b 8881b69 65af5e2`) run in a throwaway worktree
after honest completion: **one conflict, `server/_core/trpc.ts` only** (resolved as the plan says — keep the GHL
branch of the error formatter). V2Trail / V2CampaignKit reverted cleanly; honest completion intact; trial symbols gone.
tsc **34**; kitReadiness 31, kitReadinessView 11, importPolicy 17, ghlReliability 34, pipeline-fixes 414, parity 6 all
pass; `quotaLimits.ts` byte-identical to `87596d7`. Deploy markers must still be re-derived from the final build (§15h).

## Read-only checks
- **Complete kits without ad images: 0** (`COMPLETE_WITHOUT_AD_IMAGES_COUNT_2026-09-27.md`).
- **68 → 22 kits: explained.** The approved pre-launch dummy-data wipe, 2026-09-11 20:36–20:56 UTC
  (`WIPE_2026-09-12_PRELAUNCH_DUMMY_DATA.md`): 23 → 3 accounts, 18,725 → 983 rows. Retained kits = user 117174's 20 +
  kits 200 and 225 = **22**, exactly today's count. Production today: 3 users (1, 1613, 117174 — all Pro), 8 services,
  every table's `UPDATE_TIME` = the wipe. No binlog on production (`@@log_bin = 0`).

## Production
No writes. No migration applied. Nothing pushed to `railway-build` (still `87596d7`).
