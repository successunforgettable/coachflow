# STAGE A — rehearsal against a local copy of production, 2026-08-28

**Nothing migrated against production. Nothing pushed. Stopped at Stage A as instructed.**

## Safety — the target guard, printed BEFORE 0106 was applied

```
TARGET GUARD ─────────────────────────────────────────
  hostname        : iMac.local
  port            : 3307
  database        : zap_test
  version         : 9.4.0
  version_comment : Homebrew
  datadir         : …/scratchpad/mysql3307/data/
  users rows      : 18  (production has 23; the local copy is synthetic)
  RESULT          : ✅ LOCAL COPY CONFIRMED — safe to apply 0106
```

The guard aborts on: port ≠ 3307, database ≠ `zap_test`, datadir outside the scratchpad, or a
version/comment containing **TiDB** — production is TiDB, the local copy is Homebrew MySQL, so that
last check is an independent signal that does not depend on getting the port right.

**The abort path was PROVEN, not assumed.** An unfired guard is untested, so the same script was run
against a target reporting the production database name and it exited non-zero:
`RESULT : 🔴 ABORT — database-is-not-zap_test`.

**No Stage A command ran under `railway run`.** `railway run` was used for exactly two things, both
read-only and both BEFORE Stage A: the production survey, and `mysqldump`. Every Stage A
command — schema load, 0106, generation, publish attempts — ran against `127.0.0.1:3307`.

## The dump — fresh, read-only, masked

Two passes: schema for all 58 tables, then data for every table EXCEPT the PII/secret set.
`mysqldump --single-transaction --skip-lock-tables` — SELECTs only, no locks, no writes.

**Excluded (schema only, zero rows):** `users`, `capturedLeads`, `ghl_access_tokens`,
`metaConnections`, `meta_access_tokens`, `compliance_history`. Verified: 0 INSERTs for each.

`users` was then repopulated with **18 synthetic rows** — real ids (foreign keys require them),
`openId` masked, names synthesised ("Synthetic Coach N"), 6 given a synthetic `coach_name` so BOTH
host-name sources are exercised. **Zero email, zero booking_url.**

📌 **Honest caveat.** 28 email-like strings remain in the dumped *generated copy* — all on the
account owner's own domains (`arfeenkhan.com`, `incredibleyou.com`, `incredibleyoucoaching.com`)
plus placeholders. They are the coach's own contact details written into their own marketing assets,
not third-party data. The `users` table itself is empty.

## 0106 applied to the local copy

Clean, both statements. Verification returned exactly the expected 5 rows:

```
hvcoTitles.renderedBuild     varchar(40)  nullable=YES
landingPages.eventDate       varchar(64)  nullable=YES
landingPages.eventTime       varchar(64)  nullable=YES
landingPages.eventTimezone   varchar(64)  nullable=YES
landingPages.renderedBuild   varchar(40)  nullable=YES
total=92 stamped=0
```

📌 **The migration header says "FOUR STATEMENTS" and the file has TWO** (one ALTER per table, four
ADD COLUMNs). Harmless today, misleading at 2am during a half-applied recovery. Worth a one-line fix
before it ships.

## Five free-event pages generated under the new framing

Five distinct services and ICPs, called exactly as the guarded orchestration block calls it
(`webinar_registration` · `pageRole: "additional"` · `LP_FRAMING_FREE_NEXT_STEP`).

| | result |
|---|---|
| generated | **5 / 5** |
| tokens left as stored | only the coach's three (date · time · timezone) — nothing else, on all five |
| zero placeholders after the three answers | **5 / 5** |
| **`[INSERT_BOOKING_URL]` appeared** | **0 / 5 — abort condition NOT tripped** |

Quota was not incremented and the kit pointer was not re-crowned on any of the five —
`pageRole: "additional"` behaving as designed.

### Did the fix actually fire, or did the model just not emit the tokens?

- **Replay: FIRED on all 5.** The model emitted the replay token every time and the framing-derived
  text replaced it every time. This is the dominant blocker (19 of 24 production pages) and it is
  now resolved on every run.
- **Event name: resolved** — the service name appears in the copy on 4 of 5.
- 🔶 **Host name: NOT EXERCISED here.** The model did not emit `[INSERT_HOST_NAME]` in any of the
  five. That path is covered by unit tests and by the 26-row production replay (12 rows cleared),
  but these five live generations did not test it. Stated rather than glossed.

## The publish gate — proven in BOTH directions, with the real publisher

Not a copy of its regex: `runLandingPagePublish` itself was invoked.

- **All three facts supplied →** past the operator-field gate, past the token gate, past the
  compliance gate. Failed only at `CLOUDFLARE_ACCOUNT_ID not set` — the local environment's limit.
  **On production this page publishes.**
- **Timezone deliberately withheld →** `🛑 Landing page has 1 unfilled placeholder:
  [INSERT_EVENT_TIMEZONE].` The guard still stops an incomplete page.

## What Stage A could NOT prove

No Cloudflare credentials exist locally, so **the KV write, the live URL, and the magnet's bridge
flipping to `linked` have still never been exercised.** That remains Stage D's job.

## Teardown — completed and verified

Local `mysqld` shut down; the 33 MB dump and the 380 MB datadir destroyed; sockets and pid files
removed; the Homebrew MySQL on 3306 that this session started was stopped, restoring the machine to
as-found. Verified afterwards: no listener on 3306 or 3307, and a scan of the scratchpad for the
coach's domains and service names returns nothing. Only generic scripts remain.

**Re-running Stage A needs a fresh ~10-minute dump.**
