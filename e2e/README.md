# Manual-wizard E2E harness (2026-07-22)

The machine tests the machine. `manual-wizard-free-event.spec.ts` drives a full manual campaign (free,
in-person event) start→finish and asserts on real rendered DOM + real served page bytes — 13 assertions
(A1–A13). Fixes are iterated against this GREEN BAR in the terminal, not hand-verified.

## How to run

```bash
# 1. a server must be running with NODE_ENV=development (scripted login is dev-only)
#    → the run-target is a DECISION (see below); this is the prod-infra form:
railway run --environment production --service coachflow npm run dev      # boots on :3000

# 2. point the harness at it + supply a real users.openId to log in as
E2E_BASE_URL=http://localhost:3000 TEST_OPENID=<a-real-openId> npx playwright test
```

The full PASS/FAIL table prints at the end of the run (every assertion is a soft assertion, so the table is
complete even under heavy red).

## The run-target decision (needs Arfeen's approval — Phase 1 STOP)

Scripted auth (`GET /api/test-login/:openId`) exists **only when `NODE_ENV=development`**
(`server/_core/index.ts`). So the harness runs against a **local** server — never the deployed site, which
has no scripted-login path. But a local server has **no `.env`**, so it must be given secrets, and that
forces a choice:

| Option | Auth | Data / cost | Boot side-effects | Verdict |
| --- | --- | --- | --- | --- |
| **A. Isolated local DB** (local MySQL/TiDB, migrations applied) + real Anthropic | ✅ test-login | writes to a throwaway DB; still spends Anthropic tokens; publish assertions need Cloudflare creds or a stub | none on prod | **Recommended** — the only clean, repeatable Phase-2 iteration target |
| **B. Local server → PROD infra** (`railway run … npm run dev`) | ✅ test-login | creates REAL prod campaigns + REAL published pages + REAL token spend every run | ⚠️ boot runs `reapStuckJobs()` against the **prod jobs table** — a second reaper clashing with the live server | usable for a ONE-OFF proof; unsafe to hammer for Phase-2 iteration |
| **C. Deployed prod** (zapcampaigns.com) | ❌ no scripted login (OpenID only) | — | — | **Not scriptable** |

**Recommendation:** stand up Option A for Phase-2 iteration. If Cloudflare publish can't be reached from a
local box, the publish-dependent assertions (A5/A6/A7/A10) run against the render/persist path with a publish
stub, and a single Option-B run confirms the real published bytes at the end.

## Why current state is heavy RED — and the Batch-A reconciliation

Assertions **A1–A3** (structured facts inputs) fail on the **deployed** site because **Batch A is built but
not committed**: `HEAD = origin/railway-build = 3e67d33`, and the five Batch-A files are modified-but-
uncommitted in the working tree, so Railway has never deployed them. The deployed wizard still renders
free-text fact inputs. (Note: a local server built from the *working tree* WOULD include Batch A and pass
A1–A3 — so the target must be explicit about which tree it serves.)

Assertions **A4–A12** fail because their fixes are the settled batch that hasn't been built yet
(sentinel routing, LP-completion gate, offer facts-wire + no-invention lock, FAQ strip, Way 2, city fix).
**A13** always reports its number; the bar is Arfeen's to set.
