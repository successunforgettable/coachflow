# ITEM 15 — read-only diagnostic, 2026-09-13 (bonus-35, bonus-44). Nothing written.

Commits at capture time: `f889c7d` (repair) on `docs/held-2026-09-12`, not pushed. Production `9156875`.
Blast radius: baseline 16:42:56 UTC, run to 16:51:14, report written, then after-snapshot — **539 compared · 0 changed**.
One production attempt loop (`generateBodyWithRetries`, budget 3) per page; the body was discarded. Script imported
no publisher and made no DB/KV/Cloudinary write.

## Files in this folder

| file | what |
|---|---|
| `35-attempt1-tools.txt` | full `tools` text, 12,065 chars — **unparseable** |
| `44-attempt1-tools.txt` | full `tools` text, 13,125 chars — **unparseable** |
| `44-attempt2-tools.txt` | full `tools` text, 10,749 chars — **unparseable** |
| `NN-attemptN-raw.json` | full raw tool input for every attempt (all 6) |
| `35-user-prompt.txt`, `44-user-prompt.txt`, `44-system-prompt.txt` | the exact prompts sent (before any feedback block) |

## 1. The JSON fault — two classes, not truncation

Every raw tool input parsed (outer JSON ok); every stop_reason `tool_use`; output 3,210–3,948 tokens against the
8,192 cap. The failure is INSIDE `tools`: the model wrote the list as a JSON document inside a string and escaped
it inconsistently. 3 of 6 attempts; the other 3 returned a real array.

| capture | position | error | the characters |
|---|---|---|---|
| 35 · attempt 1 | **7036** (line 18, col 930) | `Expected ',' or '}' after property value` | `…said something like "` ⟶ `how did you know that?\" or \"you completely get it.\"` — the OPENING quote is bare (char 7035 = `"` 34), the closing ones are escaped |
| 44 · attempt 1 | **8299** (line 18, col 1610) | `Bad escaped character` | `"I spent [\` ⟶ `_\_\_ years] in [\_\_\_…` — markdown-escaped underscores; `\_` is not a JSON escape |
| 44 · attempt 2 | **626** (line 6, col 304) | `Expected ',' or '}' after property value` | `> *"` ⟶ `Waiting until my niche is clear is the exact reason it won't…` — a bare opening quote again |

**Class A — a bare `"` opening a quotation inside a value** (2 of 3). **Class B — a markdown escape `\_`** (1 of 3).

## 2. bonus-44 — why new timed claims keep appearing (findings only, no fix proposed)

### 2a. In this capture the timed-claim correction NEVER reached bonus-44's prompt

Feedback actually appended: attempt 2 — shape note only; attempt 3 — shape note only. The §14b scan runs only inside
the shape-OK branch (`leadMagnetContentGenerator.ts:909` `if (ok)` → `:914` `scanTimedClaims`). Attempts 1 and 2
were unparseable, so the loop never saw the clocks they carried (`within 90 days`, `today`, `in the next 20 minutes`,
`today`). Attempt 3 was the first body it could scan — and the last attempt.

For contrast, **bonus-35 attempt 3 received BOTH slots** (shape note + 4 named clocks, 1,785 chars) **and came back
clean.** Fix 1 delivers as designed when a parseable body has been seen. In the earlier second-pass run, where 44's
attempt 2 DID parse, the correction reached attempt 3, the named clocks were gone, and a different one appeared.

### 2b. What is putting clocks in front of the model

1. **The 90-day figure is IN THE INPUT, twice.** `44-user-prompt.txt` carries
   *"Main benefit of the paid offer: Sign their first three paying consulting or coaching clients … within 90 days of
   building and launching their offer"* (`services.mainBenefit`, service 318) and *"Audience goals: … I want to have
   three paying clients within 90 days of launching my offer"* (`idealCustomerProfiles.goals`, ICP 291).
   - ICP 291's `groundingMeta.perSection.goals` = **`partial`** (not `stated`).
   - ICP 291's coach ladder answers (trigger / hesitation / priorAttempts / successMoment) contain **no "90" and no "day"**.
   - Service 318's `description` contains no "90". The row records no provenance for `mainBenefit`.
   - **`server/routers/services.ts:383`** — the service-expansion prompt instructs `mainBenefit`: *"Must contain a
     concrete result — a number, a timeframe, or a named change in situation."* It writes the DB only when the field
     is a placeholder (`:567`), but always returns the generated value to the review screen (`:619`). Whether 318's
     value was typed, extracted or accepted from that screen **cannot be confirmed from the row.**
   - bonus-35's input carries clocks too: `within fifteen minutes` in the bonus `description` and `derivedFromObstacle`
     (stored before source C was fixed) and `in 48 hours` in the upstream offer.
2. **The standing system prompt quotes timed wrong shapes.** `NO_RESEARCH_STATISTIC_FABRICATION_RULE`
   (`_core/copywritingRules.ts:286`), appended to every deliverable prompt (`leadMagnetContentGenerator.ts:369`):
   *"Invented time-to-X claims: "first reactive decision within 90 seconds of waking" … "lose 47 minutes per
   interruption""* — a canonical failure exemplar in a standing prompt, the shape CLAUDE.md §14 bans.
   `GUARANTEE_CLAIMS_RULE` (`:382`) also invites timeframes: *"Where a timeframe appears, attach it to what gets
   DELIVERED in that time."*
3. **The correction and the scanner do not describe the same thing.** The fail-context tells the model a timeframe
   on the reader's RESULT is the fault. The scanner rejects every clock outside quoted speech or a refund window.
   bonus-44 attempt 3's two rejections are timing on a reader's ACTION, not an outcome:
   *"Follow up within 48 hours — even just: 'Great to reconnect…'"* and *"Complete this within an hour of any network
   conversation where you used one of the scripts above."* (bonus-35 attempt 2: *"the ONE email I am writing today"*.)
   A model can obey the correction as worded and still fail the scan. **Whether action-timing is a §14b violation is
   a product ruling** — §14b bars a time attached to the reader's outcome.

Evidence does not rank these three; all three were present in the capture.

## 3. 📌 LOGGED FOR ITEM 12 — NOT ACTED ON (Arfeen, 2026-09-13)

Service 318's `mainBenefit` (*"Sign their first three paying consulting or coaching clients … within 90 days of
building and launching their offer"*) traces to **`server/routers/services.ts:383`**, where the service-expansion
prompt requires a main benefit to *"contain a concrete result — a number, a timeframe, or a named change in
situation."* **This may be the same root as parked item 12 (the required-figure defect).** Whoever scopes item 12
next: start there. That value flows straight into every lead-magnet and bonus prompt as *"Main benefit of the paid
offer"* (`leadMagnetContentGenerator.ts` `gatherContext` → `mainBenefit`). **`services.ts` was deliberately not
touched in item 15.**
