# OPTIONAL-TOKEN FIX — measurement, 2026-08-28

Local only. Nothing committed, pushed or migrated. `orchestration.ts` untouched.

## The defect (Test 5)

The publish gate throws on ANY surviving `[INSERT_*]`. The webinar prompt's allow-list permits
`[INSERT_EVENT_NAME]`, `[INSERT_HOST_NAME]` and `[INSERT_REPLAY_AVAILABILITY]` on top of the three
required facts, so a coach could answer date + time + timezone and the page still refused to publish.

## ROOT CAUSE — `autoFillFrom` was a DECLARED, DEAD field

`[INSERT_HOST_NAME]` and `[INSERT_EVENT_NAME]` are `category: "auto-fill"` in
`OPERATOR_TOKEN_REGISTRY`, documented "never asked of the coach — filled server-side".
`deriveOperatorQuestions` duly SKIPS them. And **nothing ever filled them** — repo-wide grep for
`autoFillFrom` returned the type declaration and the three registry entries, and no reader.
So they were never asked AND never answered, and survived to the gate.

## The three buckets

| token | bucket | resolution |
|---|---|---|
| `[INSERT_HOST_NAME]` | **1 — we hold the fact** | the coach's name |
| `[INSERT_EVENT_NAME]` | **1 — we hold the fact** | the service name |
| `[INSERT_REPLAY_AVAILABILITY]` | **2 — the framing answers it** | written from live-and-once |

**None became a question for the coach. Approved intake copy is unchanged.**

### The registry's declared host source is wrong in practice (production, measured)

- `users.coach_name` — the registry's declared source — set for **1 of 23** coaches (4%).
- `users.name` — set for **23 of 23** (100%).

So `coach_name` is preferred when present (the name the coach chose), `users.name` is the fallback
that makes the fill actually land.

### ⚠️ CORRECTION to the brief's premise on replay

The brief said `LP_FRAMING_FREE_NEXT_STEP`'s "strongest line contrasts a recording with the live
session". **It does not.** That line — "being there beats any recording" — belongs to the
IN-PERSON EVENT framing (`campaignFraming.ts:155`), a different campaign type.

What the free-next-step framing actually asserts is: *"the session is live and happens once, at the
stated date and time"*. **Live-and-once does not entail no-replay** — a session can happen once and
still be recorded. So the substituted text restates the framing's claim exactly and stops:

> "This session runs live, once, at the stated date and time."

It never says "no replay", "live only" or "will not be recorded" — ZAP does not hold that fact and
the coach was never asked. A unit test pins that it never makes those claims.

## What changed (3 files + 1 new test file)

- `server/lib/templates/operatorFields.ts` — `resolveAutoFillTokens` implements the dead
  `autoFillFrom` contract; `substituteCopyToken` exported as the single visible path for a
  fact-derived substitution.
- `server/_core/campaignFraming.ts` — positive naming directive added to the framing (no
  prohibition); `FREE_NEXT_STEP_REPLAY_TEXT` exported and documented.
- `server/landingPageGenerator.ts` — both resolutions run BEFORE the insert, so a page is never
  STORED holding a token nothing will ever fill. Replay resolution is scoped to the free-next-step
  framing, so a coach-driven webinar page still gets asked "Will there be a replay?".
- `server/_core/freeNextStepTokens.test.ts` — 9 tests.

**The publish gate is unchanged. No prohibition added. Nothing neutralised to an empty string** —
an absent fact leaves the token in place so the gate still catches it, rather than shipping a page
with a silent hole.

## MEASUREMENT — 26 real production pages, not fixtures

19 of them are `webinar_registration`, the free-event page type. The coach's three answers are
applied first, because the free-event page is only built when all three exist (`hasAllEventFacts`).

```
=== THE FREE-EVENT PAGE TYPE (webinar_registration), REAL PRODUCTION COPY ===
rows measured                        19
coach answers applied                date + time + timezone (the path's precondition)
ZERO surviving placeholders          16 / 19  -> these PUBLISH
rows still blocked                   3
--- what still blocks them ---
  page 171: [INSERT_BOOKING_URL]  (service="Priced to Win", coach="Arfeen")
  page 201: [INSERT_BOOKING_URL]  (service="", coach="Arfeen")
  page 206: [INSERT_BOOKING_URL]  (service="Incredible You Coach Training Program", coach="Arfeen")
residual token counts                {"[INSERT_BOOKING_URL]":3}
--- BASELINE, same rows, without today's fix ---
ZERO surviving placeholders          0 / 19

ROWS MEASURED                        26
page types                           {"webinar_registration":19,"discovery_call_booking":3,"event_registration":4}
--- the three tokens, occurrences ---
before                               32
after auto-fill only (all pages)     20
after auto-fill + free-next-step     1
--- rows cleared, per token ---
HOST_NAME cleared                    12
EVENT_NAME cleared                   0
REPLAY_AVAILABILITY cleared          19
--- FULL publish gate (every INSERT_ token) ---
rows with ZERO surviving tokens      1 / 26
residual tokens (NOT in scope today) {"[INSERT_EVENT_TIME]":20,"[INSERT_EVENT_TIMEZONE]":20,"[INSERT_EVENT_DATE]":18,"[INSERT_BOOKING_URL]":4,"[INSERT_ROOM_OR_FLOOR_INFO]":3,"[INSERT_DRESS_CODE]":3,"[INSERT_BOOKING_DURATION]":2,"[INSERT_EVENT_AGENDA]":2,"[INSERT_PARKING_INFO]":2,"[INSERT_DIETARY_NOTES]":2,"[INSERT_EVENT_NAME]":1,"[INSERT_PROGRAMME_DURATION]":1,"[INSERT_COHORT_CLOSE_DATE]":1}
```

### Result

**0 of 19 published at baseline. 16 of 19 publish after the fix.**
All 12 `HOST_NAME` rows cleared; all 19 `REPLAY_AVAILABILITY` rows cleared.

## 🔴 NEW FINDING — a FOURTH token, outside today's brief

The 3 rows still blocked are blocked by **`[INSERT_BOOKING_URL]`**, not by any of the three.

- It is `hard-hold` / `scope: "coach"` — a DIFFERENT category, meant to hold a page as a draft
  until answered. Resolving it is not the same decision as the three, so it was NOT touched.
- All 3 blocked coaches DO have `users.booking_url` set — but only **1 of 23** coaches does overall.
- 📌 **Likely not a free-event-path problem, but UNPROVEN.** All 19 rows were generated under the
  OLD webinar framing. `LP_FRAMING_FREE_NEXT_STEP`'s CTA language is "Save my seat / Join the
  session / Register for the session", which steers away from a call-booking CTA. Whether the new
  framing still emits `BOOKING_URL` can only be settled by a real generation — watch for it in
  the rehearsal.

## Gates

- TS: **34** (baseline holds, zero added)
- Tests: **550 passed** across the 7 pinned suites (412 + 61 + 31 + 20 + 10 + 9 + 7)
- `server/_core/orchestration.ts` **untouched** — confirmed by `git status`
