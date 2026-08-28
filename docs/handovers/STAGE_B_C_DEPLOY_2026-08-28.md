# STAGE B + C — migration and deploy to production, 2026-08-28

**Stage D NOT started.** `6edb654` is live. 0106 is applied. **`BUILD_SHA` was deliberately NOT
set — see the finding below; it turned out to be unnecessary.**

## Stage B — the migration led the deploy

### The guard, INVERTED

Stage A's guard aborted if the target looked like production. Here production **is** the target, so
it was turned around, not switched off: it aborts if the target is anything **other** than
production. Both directions were exercised before the write.

**Negative control — the local copy's identity fed to the Stage B guard:**
```
RESULT : 🔴 ABORT — database-is-not-railway  target-is-not-TiDB-so-not-production
                    hostname-looks-local  port-3307-is-the-LOCAL-copy
                    users-row-count-is-not-productions-23
```

### 🔴 THE GUARD CAUGHT A WRONG ASSUMPTION OF MINE — read this one

The first run against production **aborted**:

```
  hostname        : 62225c59c592
  port            : 3306
  database        : railway
  version         : 9.4.0
  version_comment : MySQL Community Server - GPL
  RESULT          : 🔴 ABORT — target-is-not-TiDB-so-not-production
```

**Production is NOT TiDB.** CLAUDE.md §4 says "MySQL/TiDB on Railway"; production actually reports
`MySQL Community Server - GPL`, version **9.4.0** — the *same version string* as the local Homebrew
copy. So `VERSION()` is not a discriminator at all, and the TiDB check could never have fired.

**The check was replaced, not deleted.** `@@version_comment` IS a discriminator: production says
`MySQL Community Server - GPL`, the local copy says `Homebrew`. The guard now requires the former
and rejects the latter.

📌 **Consequence for Stage A, stated rather than buried:** Stage A's guard carried the same inert
TiDB check. It would not have caught production. Stage A was still correctly protected — by three
*other* independent checks that WOULD have fired (database ≠ `zap_test`, port ≠ 3307, datadir
outside the scratchpad) — but one of its four checks was decorative and nobody knew.

### The write

Guard re-read the identity from the live connection and re-passed **immediately before** the write.

- **Pre-check: `precheck_existing_0106_columns=0`** — not already applied, no double-apply risk.
- Applied: `mysql_exit=0`, no errors on either stream.
- **Verification — exactly the 5 expected rows:**

```
hvcoTitles.renderedBuild     varchar(40)  nullable=YES
landingPages.eventDate       varchar(64)  nullable=YES
landingPages.eventTime       varchar(64)  nullable=YES
landingPages.eventTimezone   varchar(64)  nullable=YES
landingPages.renderedBuild   varchar(40)  nullable=YES
lp_total=92    stamped=0
hvco_total=6689 stamped=0
```

Row counts match the pre-check exactly. No half-apply. **0097–0106 are now applied.**

## Stage C — the deploy

Pre-flight: TS **34**, **550 tests** pass, 7 commits ahead. Pushed `2cb6491..6edb654`.

### Running bytes verified, NOT the deploy panel

The panel said `SUCCESS 6edb654`. That is not the check. Three independent confirmations from
inside the container:

| probe | pre-push baseline | after deploy |
|---|---|---|
| the new replay string in `/app/dist/index.js` | **absent** | **present** |
| `resolveAutoFillTokens` in the bundle | — | **3 occurrences** |
| container's own `RAILWAY_GIT_COMMIT_SHA` | — | `6edb654083…` = **exactly HEAD** |

The baseline matters: the string was proven absent *before* the push, so its presence after is
evidence of these bytes, not of a string that was always there.

### Service confirmed serving

`https://zapcampaigns.com` → **HTTP 200** on three consecutive requests (~1.3–1.5s).
`/api/trpc/user.getCoachProfile` → **401**, which is correct for an unauthenticated call and proves
the app is answering rather than a proxy returning 502.

## 🔵 FINDING — `BUILD_SHA` IS NOT NEEDED, AND WAS NOT SET

The plan said set `BUILD_SHA` last and expect a second redeploy. **The premise it rested on is
false.** CHECKPOINT.md records "There is no git variable in the Railway environment at all —
checked". There is one, and the app already uses it.

Read directly from the running app process (`/proc/33/environ`, `node dist/index.js`) — not from an
SSH session's environment, which can differ:

```
app_RAILWAY_GIT_COMMIT_SHA = 6edb654083969768c05ec66750479857c454cdbe   ← exactly HEAD
app_BUILD_SHA              = (absent)
app_SOURCE_COMMIT          = (absent)
```

`buildStamp.ts` resolves `BUILD_SHA ?? RAILWAY_GIT_COMMIT_SHA ?? SOURCE_COMMIT`. The second is
present and correct, so **`currentBuildSha()` already returns the right 40-character SHA today.**

**Setting `BUILD_SHA` would trigger a production redeploy that changes no behaviour** — precisely
the waste decision 2 was written to prevent ("setting it on its own would spend a deploy to no
purpose"). So it was **held, not skipped**: it is a production action whose justification has
evaporated, and that is Arfeen's call, not one to make silently.

If it is wanted anyway, the honest argument for it is durability, not function: an explicit
`BUILD_SHA` does not depend on Railway continuing to inject its own variable.

📌 The likely origin of the wrong note: the Railway **variables panel** does not list
auto-injected `RAILWAY_*` variables, so a check there shows nothing while the process has them.

## ⚠️ INCIDENTAL — a secret was printed to the terminal

While reading the app environment, an over-broad match pattern of mine (`[^ ]*` spans the NUL
separator between variables) printed the **`CREATOMATE_API_KEY`** value alongside the git SHA. It
was displayed in this session's output. Nothing was transmitted anywhere, and it was not written to
any file. **If terminal scrollback is treated as exposed, rotate that key.** Later probes used a
bounded character class.

## State

- Live: **`6edb654`**, verified by running bytes.
- Migrations applied: **0097–0106**.
- `BUILD_SHA`: **unset, deliberately.** Stamping works regardless.
- Uncommitted: `CHECKPOINT.md`, `docs/handovers/STATE.md`, and this file — recorded on disk, not
  committed, because only the fix and the 0106 header were authorised.
- **Stage D not started.** When authorised, a restore point of `hvcoTitles`, `nodeStatuses` and
  `landingPages` is taken FIRST — Stage D is the part that writes.
