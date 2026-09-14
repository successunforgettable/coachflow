# INVESTIGATION: the concept generator — a split for kit 187, and the re-arm race (2026-09-15)

**This is its own package, separate from video scripts. Investigation only:**
- nothing built;
- no fix shape proposed;
- no production write;
- no LLM call run for this investigation.

Every database read was read-only.

Follows `INVESTIGATION_LLM_TOKEN_CAP_AND_REAPER_2026-09-15.md`.

---

## A. Could a fix inside the concept generator resolve kit 187's truncation without touching `llm.ts`?

### What the generator does today (code read)

1. **One call asks for 12 concepts:** `overGenerateCount = ceil(8 × 1.5)` (`server/conceptGenerator.ts:223`, `:241`, `:264`).
2. **The whole set is gated at once:** structure + compliance + grounding (`:267-317`).
3. **On rejection the WHOLE set is retried,** up to 3 attempts, with the gate's failure context appended to the prompt,
   so each retry prompt is longer (`:320-331`).
4. Partial-delivery survivors (`:333-380`); stage-balanced trim to 8 (`:399-424`); **one** top-up call for any stage the
   gate killed (`:440-515`); delete-then-insert (`:522-541`).

### Measured on production (ICP 249 / kit 187, 2026-09-14)

| attempt | input tokens | output tokens | ≈ duration | outcome |
|---|---|---|---|---|
| 1 | 4,427 | 7,892 | ≈ 2.7 min | complete, **rejected by the gate. Labels not logged:** the failure is thrown inside the retry, before the telemetry line |
| 2 (retry + failure context) | 5,080 | **8,192** | ≈ 2.6 min | **cut off at the ceiling** → *"Concept generation returned no concepts array"* (`:198`) |

That is about **650 output tokens per concept**. **The ceiling bites the whole-set retry**, because it carries 12 concepts plus
a longer prompt.

### Whether a split is possible inside the generator: findings, not a design

1. **Only ONE rule is set-level:** no two concepts may share a desire × awareness pair (`concept_duplicate_axis`,
   `server/_core/conceptValidator.ts:147-155`). Every other rule is per concept: required fields, assigned awareness slot,
   hook pattern, headline ≠ hook, compliance, grounding.
2. **The machinery to generate a subset already exists and runs in production.**
   `buildConceptPrompt(icp, count, hasRealClientMaterial, planOverride, existingDesires)` (`:56-80`) takes a fixed stage plan
   plus the desires already in the set. The top-up uses it (`:479-487`) and gates the subset against its own plan
   (`gate(topUps, topUpPlan)`, `:487`).
3. **Estimated sizes** (from the measured ~650 tokens per concept):
   - a 4-concept piece ≈ **2,600 output tokens**;
   - with a failure-context retry, still far below 8,192;
   - duration ≈ **1 minute per piece** at the measured ≈ 49 tokens/s. **An estimate, not measured.**
4. **Distinctness across pieces decides the ordering.** A piece that is told the earlier desires must run after them, so
   pieces run sequentially: about 3 minutes for 12 concepts (estimate). Pieces run in parallel cannot see each other, so
   they would need a distinctness check after merging.
5. **What stays untouched:** `llm.ts`, the shared 8,192 ceiling, every other caller, the 5-minute fetch abort, and the
   landing-page / ad-copy full reruns. **A split is contained to `conceptGenerator.ts`** plus its tests.
   - One knock-on: the compliance telemetry counts `generated: overGenerateCount` per set (`:386-391`), so its per-set
     counters would change meaning.
6. **A separate lever in the same file** (an observation, not a proposal): the call size is 12 because of the 1.5×
   over-generation (`:233-241`, *"insurance, not a strategy"*). Eight concepts would be ≈ 5,200 tokens.

### What a split does NOT resolve for kit 187

🔴 **Attempt 1 was not truncated. It came back whole (7,892 tokens) and was REJECTED by the gate, for reasons that were never
logged.** A split removes the truncation on the retry. It says nothing about whether ICP 249's concepts can pass the gate. If
the rejection is systematic for that service's material (for example grounding failing closed, or a compliance class), kit
187 still ends with no concepts after a split.

- ✅ **CONFIRMED:** a contained fix can remove the truncation mechanism without shared infrastructure.
- ❌ **NOT CONFIRMED:** that it gives kit 187 a concept set.
- **The one measurement that closes the gap** is the attempt-1 gate labels for ICP 249. That needs **a read-only capture**:
  a fresh generation run through the gate and logged, **with nothing persisted**. It spends LLM tokens and writes nothing,
  the same shape as item 15's approved captures. **It needs Arfeen's go-ahead.**

---

## B. The concept re-arm race

### It is real, and it was reproduced live on production today

- **The code** (`ensureConceptsForIcp`, `conceptGenerator.ts:617-680`):
  - rows exist → `exists`;
  - a job is `pending` or `running` → `in_flight`;
  - **anything else → re-arm the row to `pending` WITHOUT resetting `created_at` (`:643`), and start a new generation.**
- **Kit 187, run 2** (started 18:42:18 UTC). The job row dated from 18:34:04. My call re-armed it, and **at +1.1 min the job
  already read `failed`**: the reaper saw a `created_at` 8 minutes old. The generation was still alive: its LLM calls
  returned at about +2.7 and +5.3 min. **Measured.**
- **How long one generation takes (measured):** about 2.7 min per attempt, so about 5.3 min for 2 attempts; 3 attempts plus
  a top-up would be about 8+ min. **Any concept generation needing more than one attempt outlives the reaper's 5 minutes.**

### How often it is triggered (code read)

| trigger | where |
|---|---|
| every `ensureCampaignKit` call fires `ensureConceptsForIcp`, **by design** ("self-healing") | `server/routers/campaignKits.ts:154-187` |
| `autoSelectBest` calls `ensureCampaignKit` | `campaignKits.ts:237` |
| `autoSelectBest` runs after every generator node | offers `offersGenerator.ts:624` · mechanisms `heroMechanismsGenerator.ts:526` · lead magnet `hvcoGenerator.ts:405` · headlines `headlinesGenerator.ts:1012` · ad copy `adCopyGenerator.ts:1782` · landing page `landingPageGenerator.ts:1016` · every orchestration step `orchestration.ts:1108` · Auto Mode `autoMode.ts:497,566,593` |
| orchestration calls `ensureCampaignKit` once at the start | `orchestration.ts:1123` |
| ad copy calls `ensureConceptsForIcp` directly | `adCopyGenerator.ts:356` |

**A full cascade is roughly 10–11 triggers spread over many minutes.**

### What happens, by the ICP's state

| ICP state | behaviour |
|---|---|
| generation succeeds in ONE attempt (≈ 3 min) | **no race.** Rows land before the reaper; later triggers read `exists` |
| succeeds but needs 2+ attempts (> 5 min) | the first run is reaped at 5 min while alive, and **every trigger after that re-arms and starts another generation** until the first run's rows land. Each re-armed job is re-reaped within 60 s. **Each extra generation that finishes REPLACES the set** (delete-then-insert, `:522-541`), giving new concept ids, so it **deletes every concept script** (`conceptScripts.conceptId` `onDelete: cascade`, `schema.ts:1650`) and **nulls the concept stamps on ad copy and ad creatives** (`onDelete: set null`, `schema.ts:433` adCopy, `:1328` adCreatives) |
| fails deterministically (kit 187's shape) | **every trigger starts another doomed full generation, with no concurrency needed.** Measured cost of ONE such generation (run 2): **9,507 input + 16,084 output tokens, zero concepts.** A cascade repeats it at each trigger, and every later auto-select repeats it again |

⚠️ **Two comments claim protection that nothing enforces:**
1. `campaignKits.ts:160-165`: repeat calls *"cost one indexed SELECT each and nothing more."* That is true only while the
   set exists or a job is `pending`. **Once a job has failed it is false: each call pays a full generation.**
2. `conceptGenerator.ts:602-603`: delete-then-insert means *"even a lost race cannot produce a doubled set."* **The delete
   and the insert are two statements with no transaction** (`:522-523`). Two finishing generations could interleave
   (delete, delete, insert, insert) and leave two sets. **A hypothesis:** the window is small and it has not been observed.

### Is it costing money RIGHT NOW? **No. Measured.**

- **No coach activity since the 2026-09-12 wipe:**
  - `product_events` holds **1 row** since the wipe, which is this session's browser proof (2026-09-14 21:18). That table
    is deleted only on account deletion (`server/routers.ts:210`), so this is trustworthy.
  - Tables with any `updatedAt` after the wipe: `bonuses` (item-15 work), `conceptScripts` (this session's runs), `users`
    (this session). **No generated content from any coach.**
  - 3 users in total; 1 signed in since the wipe (user 1, this session).
- **The only concept generations since the wipe** are this session's two kit-187 runs.
- **Caveat:** `jobs` evidence is limited, because rows older than 24 h are deleted daily (`server/_core/index.ts:275-289`).
- **Conclusion:** the spend is latent today. It will start on the first real cascade whose concept generation needs more
  than one attempt, or fails.

### Is a fix for just this separable from the token cap?

**In code: YES.** It lives in `ensureConceptsForIcp` and its job row (`conceptGenerator.ts:617-680`), and for option (b) in
the reaper's filter (`server/_core/index.ts:61-76`). Neither touches `llm.ts`, token handling, or any other caller.

**The two candidates named in the brief, assessed (not designed):**

| candidate | what it closes | what it leaves open |
|---|---|---|
| **(a) reset `created_at` on re-arm** | the 60-second re-reap of a re-armed job | **the FIRST reap of a generation longer than 5 min** (the next trigger still starts a second generation), and the deterministic-failure repeat. **It narrows the pile-up; it does not close it** |
| **(b) exclude concept jobs from the reaper** | duplicates: a live generation is never marked failed, so triggers read `in_flight` | **a permanent stall.** A generation killed by a restart or deploy (`setImmediate` dies with the process) stays `pending` forever, so every trigger reads `in_flight` and that ICP never gets concepts. That is exactly the zombie the header chose `pending` to avoid (`:609-615`). **It closes duplicates and opens a permanent-stall case**, unless something else expires the job |

**Neither addresses the deterministic-failure repeat** (row 3 above): the trigger-on-every-call design meeting a generation
that cannot succeed.

**In effect: COUPLED.** The race exists because one generation outlasts the reaper's window.
- A generation that finishes in under 5 minutes, such as the smaller calls in §A (an estimate), would largely remove the
  race for concepts **without touching the reaper**.
- A reaper-only fix leaves both the truncation and the deterministic-failure repeat.
- **The decision on one changes the value of the other.**

---

## C. Summary for the package decision

| question | answer | confidence |
|---|---|---|
| Can a contained split remove the truncation without touching `llm.ts`? | **yes.** The subset machinery exists, and only one rule is set-level | HIGH (code read + measured size per concept) |
| Would a split give kit 187 concepts? | **not established.** Attempt 1 was rejected by the gate, with unknown labels | needs the read-only capture (§A) |
| Is the re-arm race real on production? | **yes.** Reproduced today: the re-armed job was reaped at +1.1 min while alive | measured |
| Is it costing money now? | **no.** No coach activity since the wipe | measured |
| Is it separable from the token cap? | **in code yes; in effect coupled** (generation duration drives the race) | HIGH |
| Do the two named reaper fixes close it? | **(a) narrows it; (b) closes duplicates but opens a permanent stall** | code read |
| What does neither fix address? | a deterministically failing ICP re-runs a full generation on every trigger | code read + measured cost per run |
| What else does a duplicate destroy? | a set replaced by a second generation deletes concept scripts and nulls ad-copy / ad-creative concept stamps | code read (FKs) |

## D. The one proposed next measurement

A **read-only gate-label capture for ICP 249**: run one fresh generation through the gate, log the labels, and persist
nothing. It spends LLM tokens and writes nothing. **Pending Arfeen's go-ahead.**
