# THREAD B — grounding check of kit 225's 8 video scripts (2026-09-15)

**Investigation only.** No repo code changed, no commit, nothing staged. Production was touched with read-only SELECTs
only, through a runner that refuses any statement not starting with SELECT/SHOW/DESCRIBE. Columns were audited in
INFORMATION_SCHEMA before each query (`@@version_comment` = MySQL Community Server - GPL).

---

## 0. Answer in one paragraph

Of **37 distinct specific details** across the 8 scripts:
- **4** trace to the coach's own words;
- **23** trace **only** to generated upstream material;
- **10** are **untraced**, including every biographical detail in 229: *forty-four*, *since 2021*, *procurement*, *a global
  firm*.

All 8 pass the real gate with the real corpus, and **the gate detects zero proof-shaped claims in any of them**. It is not
a case of "detected, then excused". The fabrication gate is a closed-set detector for **claims about clients and proof**
(my clients, counts of people, named outcomes, statistics, guarantees, cued third parties, tenure with a digit). It has
no category for **the speaker's own biography**: age, family, job title, employer, tenure written in words, dates, or
witnessed anecdotes.

The negative control proves this is a detection blind spot, not a disconnected instrument (§15k). The same fields block
the moment a proof-shaped phrase is added. They pass when 229's age, family member, job title, employer and year are
swapped for different values that are certainly absent. **Verdict: a general blind spot in `checkFabrication`, HIGH
confidence.**

---

## 1. The coach's own material, and what the gate's corpus actually is

### 1.1 What the coach typed (`chatTranscripts` id 72, campaignKitId 225, the 9 `user-bubble` messages)

| msg | text |
|---|---|
| 2 | *"I run a coaching practice helping women who have decided to return to work after leaving their professional careers for their family and now that the children are grown up they want to become entrepreneurs."* |
| 6, 11, 13, 27 | "That's me" · "Lead magnet" · "Build it all for me ⚡" · "Sharpen it" (button answers) |
| 29 = `ladderAnswers.trigger` | *"They had lost the confidence. They wanted to start they initially thought about going back to a job but then they thought no they have to build legacy wealth for their family. So they didn't have many ideas. All they knew is that they wanted to become entrepreneurs and didn't have the skills but now know that there's artificial intelligence that could help them."* |
| 31 = `priorAttempts` | *"They done research online, watched YouTube videos, but they tried but it was too complex."* |
| 33 = `hesitation` | *"They liked the product but they were unsure of themselves so what was going to stop them from saying yes was their own limiting beliefs."* |
| 35 = `successMoment` | *"They said without the support, without the other people in the mastermind, without the systematic process that I offered them, they would never have done it and it was worth it."* |

**That is the entire coach-typed record.** The coach gave no age, family detail about himself, profession, employer,
tenure, year, method name or product name.

### 1.2 What `buildCoachCorpus({ service, groundingMeta })` assembles

This was reproduced with the real function on the real rows, in `scratchpad/threadb-grounding/replay.ts`.

- `corpus.text` is **3,808 chars**, `words` 253, `ladderAnswered` = trigger, hesitation, priorAttempts, successMoment.
  **`isLaunchStage` = true.**
- It is built from these fields, in order: services `category` ("coaching"), `description`, `targetCustomer`,
  `mainBenefit`, `painPoints`, `whyProblemExists`, `uniqueMechanismSuggestion`, then the 4 ladder answers. Every other
  corpus field on service 318 is NULL.
- **Only 766 of the 3,808 chars (20%) are coach-typed** (the ladder answers). The rest is **model output**:
  - services 318 was created 16:27:53 and updated 16:29:18 on 2026-08-30. That matches `services.expandProfile`
    (`server/routers/services.ts` ~515–545), whose own comment says these fields are *"MODEL OUTPUT, so every one of them
    is tagged `extracted` — never `coach_stated`"*.
  - `buyerIntelSource` is NULL because migration 0108 (commit `0c9905a`, 2026-09-02) postdates the row.
    `icpPrompts.ts:47` resolves NULL to `extracted`.
  - `services.description` is a close paraphrase of msg 2.
  - This matches `server/scripts/traceability-proof.ts:10`: *"buildCoachCorpus is ~80% machine-written (766 typed of
    3,788)"*.
- `buildProofSupplied` has every scalar null (no customers, reviews, testimonials, press, stat or guarantee).
- **Side finding:** `coachBackground` is always null on this path. `drizzle/schema.ts:55` declares it on **`users`**, not
  `services`, and production `services` has no such column. `buildProofSupplied(serviceRow).coachBackground` is
  therefore null for **every** caller. This errs strict, not loose: it can only reduce what counts as grounded.

So per §15a, the corpus the gate reads **already includes generated prose**:

| corpus field | generated text it contains |
|---|---|
| `services.painPoints` | *"what I did in HR for 12 years"*, *"my husband is supportive but treats it like a hobby"*, *"posting on LinkedIn for four months"* |
| `services.mainBenefit` | *"first three paying consulting or coaching clients … within 90 days"* |
| `services.uniqueMechanismSuggestion` | *"excavating"* |

In §2 these are binned **(b)**, never (a).

---

## 2. Per-detail table

**Script ids:** concept id, then the `conceptScripts` row id. So 223=r2, 224=r3, 225=r4, 226=r5, 228=r6, **229=r7**,
230=r8, 227=r9. All are in set `60731b15…`.

**Bins:**
- **(a)** traced to the coach's own words;
- **(b)** traced only to generated material;
- **(c)** untraced.

Every (c) and (b) search covered all of these: the ladder answers, all service fields, all ICP 291 prose, concepts
223–230, offer 218, mechanism 1271, magnet 7293 (title + assetBody), headline 2374 and ad copy 6205. The search
patterns and every hit are in `search.out`.

| # | concept (row) | detail | bin | source quote — field |
|---|---|---|---|---|
| 1 | 229 (r7) | "Me at **forty-four**" | **c** | none: `forty[- ]four` or `\b44\b` has 0 hits anywhere |
| 2 | 229 (r7) | "watching **my youngest leave for university**" | b | *"when my youngest left for college and the house was quiet"* — `icp.buyingTriggers` |
| 3 | 229 (r7) | "thinking about' **since 2021**" | **c** | none: `2021` has 0 hits |
| 4 | 229 (r7) | "twelve years **running procurement**" | **c** | none: `procurement` has 0 hits. Generated material says HR (`services.painPoints`, `services.avatarTitle`) |
| 5 | 229 (r7) | "for **a global firm**" | **c** | none: 0 hits |
| 6 | 223, 224, 225, 226 (+ on-screen "12 YEARS"), 228, 229, 230, 227 | "**twelve years** of (real) expertise" | b | *"what I did in HR for 12 years"* — `services.painPoints` (expandProfile output); *"twelve years of professional expertise"* — `offer 218` all angles; *"12 years of corporate HR expertise"* — `mech 1271.whatTried` |
| 7 | 226 (r5) | "**director-level** expertise" | b | *"Former HR Director, First-Time Founder"* — `services.avatarTitle` (model output, not in corpus); *"an HR director"* — `icp.introduction` |
| 8 | 226 (r5) | "**I watched a woman** list twelve years … and then call it background. She thought none of it counted." (a witnessed event) | **c** | none: no such event in any source. The coach's `hesitation` answer ("unsure of themselves") does not describe it |
| 9 | 230 (r8) | "every time **my husband** asked how it was going, I said fine" | b | *"my husband is supportive but treats it like a hobby"* — `services.painPoints` (expandProfile output, a persona quote); *"Every week I avoid telling my husband exactly how the business is going"* — `icp.pains`; *"Stop hiding from my husband…"* — `concept 230.desire` |
| 10 | 223 (r2) | "what I noticed **working with women coming back** after a career break" (the coach's delivery to this audience) | a | *"I run a coaching practice helping women who have decided to return to work after leaving their professional careers"* — chat msg 2; *"the systematic process that I offered them"* — `ladderAnswers.successMoment`. The phrase "career break" itself is ICP-name vocabulary |
| 11 | 223, 229 | "**I built a process**" (that the coach has a process) | a | *"the systematic process that I offered them"* — `ladderAnswers.successMoment` |
| 12 | 227 (r9) | "**I built a free masterclass called** the First Client Blueprint" | b | offerName *"The First Client Blueprint: Free Masterclass for Career-Returners"* — `offer 218.godfatherAngle` |
| 13 | 223, 224, 225, 229, 230 | "**Career Layer Excavation Process**" | b | `mech 1271.mechanismName`; *"The Career Layer Excavation Worksheet"* — `hvco 7293.assetBody`. The corpus names a different method ("Dormant Expert Reactivation Method", itself model output) |
| 14 | 223, 225, 226, 228, 229, 227 | "**First Client Blueprint**" | b | `offer 218.godfatherAngle` offerName |
| 15 | 225 (r4) | "**90-Day First Client Script**" | b | `hvco 7293.title` |
| 16 | all 8 | "**free masterclass**" | b | *"This masterclass is free to attend"* — `offer 218.godfatherAngle` |
| 17 | 225, 229, 227 | "**forensic** process" | b | *"Walk out holding the exact forensic process"* — `offer 218.godfatherAngle` |
| 18 | 223, 224, 225, 228, 229, 230, 227 | "**first three outreach conversations** scripted at the sentence level / word for word / already scripted inside" | b | *"first three outreach conversations scripted at the sentence level"* — `offer 218.godfatherAngle`; *"first three paying consulting or coaching clients"* — `services.mainBenefit` (model output) |
| 19 | 223, 225, 229, 227 | "**Every quarter** … the notes app stays closed" | b | *"Every quarter spent without this is another quarter the notes a[pp stays closed]"* — `offer 218.godfatherAngle` |
| 20 | 223, 225, 226, 229, 230, 227 | "**notes app** (full of ideas)" | b | *"I open the notes app on my phone where I've been jotting down business…"* — `icp.pains`; `concept 229.hook`; *"BONUS #1: The Notes App Excavation Checklist"* — `offer 218` |
| 21 | 230 (r8) | "kept my notes app open **for months**" | b | *"any months I had been 'working on this'"* — `icp.buyingTriggers` |
| 22 | 227 (r9) | "**three months later**" | **c** | none for "three months". Generated material has "four months" (`services.painPoints`, LinkedIn) |
| 23 | all 8 | "the **niche-down worksheet/exercise** was built for people without experience" (and 229/230's "every niche exercise I tried" / "told me to find what I love") | b | *"Everyone tells me to 'niche down'"* — `services.painPoints`; *"the niche-identification exercise: a worksheet … people without experience find a direction"* — `mech 1271.mechanismDescription`; `headline 2374` |
| 24 | 223, 224, 225, 226, 229, 230, 227 | "what your **former industry will (actually) pay for** vs what they assume is free" | b | *"the expertise your former industry will pay for"* — `offer 218.godfatherAngle`; *"the stuff they just expect to be free advice"* — `services.painPoints` |
| 25 | 229 (r7) | "the **professional identity corporate trained you to perform**" | b | *"the professional identity a corporate environment trained someone to perform"* — `mech 1271.mechanismDescription` |
| 26 | 223, 225, 229, 227 | "**consulting** offer / business / conversations; pay a consultant" | b | *"paying consulting or coaching clients"* — `services.mainBenefit` (model output). The coach typed only "become entrepreneurs" |
| 27 | 223 (r2) | "colour-coded a **Notion** board" | **c** | none: `notion` has 0 hits |
| 28 | 223 (r2) | "watched … **YouTube videos**" | a | *"watched YouTube videos, but they tried but it was too complex"* — `ladderAnswers.priorAttempts` |
| 29 | 223 (r2) | "**three** YouTube videos **about niching down**" (count + topic) | **c** | none. The ladder answer gives no count and no topic |
| 30 | 223 (r2) | "Me at **9am** … Me at **11am**" | **c** | none. This is a meme timestamp device and scene-setting, not a promise (§14b) |
| 31 | 223, 227 | "Nothing signed" / "**ZERO CLIENTS**" | b | *"signed zero clients"* — `services.failedSolutions` (model output); *"I haven't had a client yet"* — `services.painPoints` |
| 32 | 228 (r6) | "You open **LinkedIn**, you find the name, and then you close the app" | b | *"posting on LinkedIn for four months"* — `services.painPoints` (model output); *"updating LinkedIn, calling old colleagues"* — `icp.introduction` |
| 33 | 228 (r6) | "It's not **fear of rejection**. It's that you don't know what to say" | b | *"fear of rejection"* — `icp.fears`. The coach's `hesitation` names "their own limiting beliefs", a different diagnosis |
| 34 | 225 (r4) | "not another **AI draft** you have to gut and rewrite" | b | *"Every time I try to use one of the AI tools…"* — `icp.pains`; `concept 225.hook`. The coach's `trigger` says AI "could help them", the opposite valence |
| 35 | 224 (r3) | "Someone asks what you do. And you hear yourself **start a sentence you don't finish**" | b | *"I still can't explain what I do"* — `services.painPoints` (model output) |
| 36 | 229 (r7) | "finally ready to **launch** the … business" (the audience's intent to start a business) | a | *"they want to become entrepreneurs"* — chat msg 2 / `ladderAnswers.trigger` |
| 37 | 230 (r8) | "**link in bio**" | **c** | none. This is CTA mechanics, not a factual claim; listed for completeness |

**Counts:** **(a) 4** (#10, 11, 28, 36) · **(b) 23** · **(c) 10** (#1, 3, 4, 5, 8, 22, 27, 29, 30, 37).

The high-stakes (c) items are #1, 3, 4, 5 and 8. Items 22, 27, 29, 30 and 37 are low-stakes scene or CTA detail.

**Voice note, from the same read.** Script 229 presents #1–5 as **the first-person speaker's own biography**, and the
same speaker says "I built a forensic process" (#11). The script therefore attributes an invented life history to the
coach. Script 230 does the same with #9 ("my husband"). In both, a generated persona quote from `services.painPoints` /
`icp.pains` has been moved into the coach's mouth as fact.

---

## 3. Did the gate run? Evidence, not comments

### 3.1 The call path (read in code, current HEAD = deployed `87596d7` for all gate files)

1. `routers/conceptScripts.ts:97-99` `generateForIcp`
2. → `conceptScriptBatch.ts:99` `ensureScriptsForIcp` → `runScriptBatch` → `deps.generate` (`:83-85`)
3. → `conceptScriptGenerator.ts:167` `generateScriptForConcept`
4. `:217-240` loads the service row by `concept.serviceId` and the ICP's `groundingMeta`, then builds
   `grounding = { corpus: buildCoachCorpus({ service, groundingMeta }), supplied: buildProofSupplied(service) }`
5. → `:245-253` `checkOutput(scenes' spokenLine + onScreenText, grounding, { requireGrounding: true })`
6. → `complianceAxis.ts:1262`: `groundingUsable` is set; if it is false, `requireGrounding` pushes a blocking
   `fabrication_check_unavailable` (`:1263-1279`)
7. → `:1285` `checkFabrication`
8. → `fabricationValidator.ts:320` `ungroundedClaims` (`trackRecordClaims.ts`), `:329` `AUTHORITY_RE`, `:337` proper nouns

**The script row is inserted only after `if (!result.ok) throw`** (`conceptScriptGenerator.ts:299` then `:305`). A
missing corpus blocks under `requireGrounding`. So under this code, **a stored row means the final attempt passed a
fabrication check that had a corpus.**

The gate code in this path is unchanged since the runs:
- `requireGrounding: true` and `groundingMeta: gateIcp` date from `7c93d84` (2026-08-04).
- They are present in `9156875`.
- `git diff 9156875 8d1bdd1` touches none of complianceAxis, fabricationValidator, trackRecordClaims, groundingCorpus or
  validator.
- Its 13+/6− change to conceptScriptGenerator touches no gate or corpus line.
- All of these files are identical between `87596d7` and HEAD.

### 3.2 Recorded verdicts

- **A positive fabrication verdict on this exact run, recorded.** `docs/handovers/VIDEO_SCRIPTS_BUILD_2026-09-14.md:93`,
  production run 1, concept 227: job failed with *"Script failed validation after 3 attempts: script_length_over_budget,
  unearned_authority"*.
  - `unearned_authority` is emitted only by `_core/fabricationValidator.ts`. `conceptGenerator.ts` is a different
    generator that is not on this path; `grep -rln unearned_authority server`.
  - So in that run the fabrication half executed with a usable corpus, and it fired.
  - That jobs row was later re-armed and completed (today it reads `complete`, `result {"scriptId":9}`, error NULL). The
    doc is the only surviving copy of the verdict.
- **Row-level evidence for all 8, measured today.** jobs `script-concept-223…230` are all `complete`, with `result`
  holding scriptIds 2–9 and set `60731b15…`, created 18:34:05 → 18:42:21 UTC. `conceptScripts` rows 2–9 were created
  18:34:27 → 18:43:00.
- **No stored gate metadata.** `conceptScripts` has no verdict columns. `recordComplianceGate` is an in-process tally plus
  one console line (`complianceTelemetry.ts:92`).
- **No logs recoverable.** `railway logs --since 3d --filter COMPLIANCE_GATE` and `--filter conceptScriptBatch` each
  returned **0** matching lines. That is expected, per §3.3. The harness log dir `/tmp/verify-concept-scripts` does not
  exist on this machine.

### 3.3 🔴 What "live production path" has to be qualified to

**The 8 scripts were not written by the deployed server.** At 18:34 UTC the deployed build was `9156875` (deployed
2026-09-10T19:44Z), which **does not contain `conceptScriptBatch.ts`**. The runs were driven by
`server/scripts/verify-concept-scripts-batch.ts`:
- through `railway run … npx tsx`;
- from a local working tree, against the production DB;
- through the real `appRouter.createCaller` endpoint.

The commit carrying the batch owner (`8d1bdd1`) was authored 19:00:33Z, **26 minutes after run 1**. It was deployed as
`87596d7` at 21:11:33Z.

So the gate ran in the product's code path, against production data, from what was then uncommitted local code. The gate
modules and the gate lines are unchanged in every commit on either side. It is still **not byte-provable** that the
working tree matched them at 18:34.

### 3.4 Replay (deterministic, so it reproduces the verdict)

The gate makes no LLM calls: `invokeLLM`, `fetch(` and `anthropic` return no hits in the four gate modules. Running the
real `checkOutput` on the stored text with the real corpus and `requireGrounding: true` gives **ok=true for all 8**,
blocking 0, and **`detectProofShapedClaims` returns 0 claims on every field of every script** (`replay_out.json`).

**Conclusion.** The fabrication gate provably ran with a corpus on this path: the 227 verdict is recorded, and the rows
exist only after a pass under fail-closed code. The deployed server did not run it. Its verdict on the 8 stored scripts
is reproducible, and it is "nothing detected".

---

## 4. Why the gate did not catch it

### 4.1 What the fabrication check actually detects (the closed set)

**`trackRecordClaims.ts:226-250` `detectProofShapedClaims`.** Only these:

| kind | lines | shape |
|---|---|---|
| `possessive_population` | `:80-81` | my/our + a PERSON_NOUNS noun |
| `people_count` | `:84-90` | a count + a PERSON_NOUNS noun |
| `named_person_outcome` | `:105-106` | a capitalised name + an outcome verb |
| `past_client_event` | `:122-141` | helped/coached/worked with + a PERSON_NOUNS noun, or "I've helped" |
| `client_narrative` | `:162-163` | a/an/one + a PERSON_NOUNS noun + past tense |
| `outcome_statistic` | `:165-166` | % / "N out of N" / "Nx more" |
| `stated_guarantee` | `:172-173` | guarantee phrases |
| `third_party_attribution` | `:182-183` | an attribution cue + a capitalised name |

**`PERSON_NOUNS` (`:65-70`)** holds clients, customers, students, members, families, parents, mum/mom/mother, dad/father,
couples, founders, owners, consultants, coachees, patients, participants, attendees, subscribers and professionals.
- It **deliberately excludes** person/people, kid/child/baby, as *"the CLIENT'S dependants … PERSONA detail"* (`:58-64`).
- It has no husband, wife, son, daughter, youngest or **woman/women**.

**`fabricationValidator.ts`** adds two legacy detectors:
- **`AUTHORITY_RE`, `:169-170`:** `(in|over|after|with) my <digits> years`, `I've helped|coached… <digits|hundreds>`, and
  `hundreds|thousands of clients`. **Digits only.** The spelled-out `NUMBER_WORDS` exists in trackRecordClaims but is
  not used here.
- **The proper-noun scan, `:337`,** runs only if `ATTRIBUTION_CUE` matches. "blueprint", "process"-adjacent method
  nouns and role titles are exempt (`:104-130`, *"METHOD-NAME NOUNS … the coach's own IP"*).

**Tier-2 persona traceability (`:350`)** runs only with `checkPersonaTraceability`, which `checkOutput` never passes
(`complianceAxis.ts:1285`). Even when enabled, it flags only a field with **zero** word overlap; on 229 that is just
`scene[4].onScreenText`, "FREE MASTERCLASS → LINK BELOW".

**Governing design** (`trackRecordClaims.ts:4-8`, `fabricationValidator.ts:12-18`): block *proof* and *track record*
about **people the coach served**. Nothing in the module models **the speaker's own biography**.

### 4.2 The class that slips through

First-person biographical and situational fact attributed to the speaker (the coach). None of these kinds is a detected
kind:

| kind of detail | example from the scripts |
|---|---|
| age | "Me at forty-four" |
| family members | "my husband", "my youngest" |
| life events | "leave for university" |
| prior job title / function | "running procurement", "director-level" |
| employer | "a global firm" |
| tenure written in words | "twelve years" |
| calendar years / dates | "since 2021" |
| durations | "three months later" |
| an anecdote about an unnamed non-client ("woman") | "I watched a woman…" |
| tools and apps | "Notion" |
| method / product names | lifted from generated upstream rows |

Launch-stage status makes no difference here: `isLaunchStage=true` would block *any* detected claim
(`trackRecordClaims.ts:277`). The gap is **detection**, not grounding.

A second, compounding layer (§15a): **~80% of `corpus.text` is model output**. If a traceability check against the
corpus were added, it would credit #6 "12 years", #9 "husband" and #32 "LinkedIn" as grounded, because the corpus
contains the generated persona quotes they came from. `groundingCorpus.ts:4-9` rules out ICP prose as ground truth but
admits `expandProfile` output, which carries the same risk.

---

## 5. Negative control (real gate, real corpus, local, no LLM, no DB writes)

These scripts ran the real functions (`checkOutput` with `requireGrounding: true`, plus `detectProofShapedClaims` for
visibility):
- `control.ts`, output in `control_out.json`: script 229's scenes with one field mutated per case;
- `control2.ts`, output in `control2_out.json`: single lines.

**Positive artefacts, per §15k.** Every case reports:
- `fieldsExamined` (10 fields for script-shaped cases);
- the exact `detectProofShapedClaims` output;
- the blocking hits.

The P-cases show the **same field positions** blocking when a proof-shaped phrase is present. Silence is therefore
distinguishable from disconnection.

### 5.1 Inputs → outputs

| case | input (changed text) | verdict | detected / blocking |
|---|---|---|---|
| **(i)** | script 229, actual text (all 10 fields) | **PASS** | examined 10 · detected `[]` · blocking `[]` |
| (ii-a) | 229 s0: "forty-four" → "**fifty-seven**", "my youngest leave for university" → "**my eldest son leave for the army**", "2021" → "**2016**" | **PASS** | detected `[]` |
| (ii-b) | 229 s1: "twelve years running procurement for a global firm" → "**twenty-two years as chief pharmacist for the NHS**" | **PASS** | detected `[]` |
| (ii-c) | digits: "Me at **57** … since **2016**. I spent **22 years as chief pharmacist at Pfizer**." | **PASS** | detected `[]` |
| (ii-d, clean) | 230 s0 with "my husband" → "**my wife**" / "**my son**" | **PASS** / **PASS** | detected `[]` |
| (ii-d, mum) | 230 s0 with "**my mum**" | BLOCK | `possessive_population:"my mum"` → `unearned_authority`. **Wrong reason:** "mum" is in PERSON_NOUNS as a client type, so it reads as "my clients" |
| (ii-e) | "I watched a woman list **nineteen years of VP-level expertise at Deloitte**" | **PASS** | detected `[]` |
| actuals | 229 s0, 229 s1, 230 s0, 226 s0 (spoken + on-screen "12 YEARS…"), 223 s1, 227 s3, each alone | **PASS** ×7 | detected `[]` on every one |
| **P1** | 229 s0 + "**In my 15 years of coaching** I've seen this every week." | BLOCK | `unearned_authority:"In my 15 years of coaching"` (AUTHORITY_RE) |
| **P2** | 229 s1 + "**I've helped 40 women** do this." | BLOCK | `past_client_event:"I've helped"` → `unearned_authority` ×2 |
| **P3** | "**A client I worked with** had twelve years of director-level expertise…" | BLOCK | `past_client_event` + `client_narrative` → `unearned_authority`, `invented_testimonial` |
| **P4** | "what I noticed **working with clients** coming back after a career break" | BLOCK | `past_client_event:"working with clients"` |
| P4′ | the same sentence with "**women**" (223's actual) | PASS | detected `[]` |
| **P5** | 229 s0 + "In my **twelve** years of coaching I've seen this." | **PASS** | detected `[]`: tenure in words is invisible to AUTHORITY_RE |
| P5′ | "After my **12** years in procurement I built this process." | BLOCK | `unearned_authority:"After my 12 years"` |
| P5″ | "After twelve years coaching returners, I built this process." | **PASS** | detected `[]` |
| P5‴ | "**I've coached** women back to work since 2019" | BLOCK | `past_client_event:"I've coached"` |
| **P6** | 229 s1 + "I was **trained by Goldman Sachs**." | BLOCK | `third_party_attribution` → `invented_named_third_party` ×2 |

### 5.2 What it caught and missed

- **Caught:**
  - client/track-record phrasings built on a PERSON_NOUNS noun (P2, P3, P4, "my mum");
  - tenure with a digit and "my" (P1, P5′);
  - a cued third party (P6);
  - "I've coached" (P5‴).
- **Missed:**
  - an invented age, spelled or digit (ii-a, ii-c);
  - an invented family member other than mum/dad/mother/father (ii-d);
  - an invented job title or function, and an employer, including a real named brand without a cue (ii-b, ii-c "Pfizer",
    ii-e "Deloitte");
  - an invented year (ii-a, ii-c);
  - invented tenure written in words, even in AUTHORITY_RE's own frame (P5, P5″);
  - an invented witnessed anecdote about "a woman" (ii-e);
  - the same client-delivery claim when the noun is "women" rather than "clients" (P4′).
- **Accidental coverage:** "my mum" blocks and "my husband" passes. The family-member result depends on whether the word
  happens to be a client-audience noun, not on whether it is invented.

### 5.3 Callers that share the blind spot

Every caller that reaches `checkFabrication` goes through `checkOutput(…, grounding)`, the only call site
(`complianceAxis.ts:1285`). All of them share the same detector:

| caller | line(s) | gate settings |
|---|---|---|
| `conceptGenerator.ts` | `:304`, `:374` | requireGrounding |
| `conceptScriptGenerator.ts` | `:245` | requireGrounding |
| `routers/meta.ts` | `:421`, `:596` | the publish-to-Meta boundary; requireGrounding |
| `headlinesGenerator.ts` | `:857` | |
| `adCopyGenerator.ts` | `:1366` | |
| `landingPageGenerator.ts` | `:850` | grounding when available |
| `_core/persistenceGate.ts` | `:182`, `:260` | the persistence gate for the remaining surfaces |

Two callers do **not** reach the fabrication half:
- `landingPagePublisher.ts:210` and `routers/compliance.ts:159` pass no grounding, so they are compliance-only.
- `heroMechanismsGenerator.ts:223` builds a corpus only for prompt guidance and runs no gate.

`server/scripts/step4c-multiad-publish.ts:610` and `publish-reroute-payload-proof.ts:157` are scripts that use the same
gate.

---

## 6. Verdict

**Yes: a general blind spot in the fabrication gate, not a script-specific miss. Confidence HIGH.**

- **What slips through.** Any first-person biographical or situational fact stated as the speaker's own:
  - age;
  - family members outside the client-audience noun list;
  - life events;
  - prior role or function;
  - employer (named without an attribution cue, or unnamed);
  - tenure written in words, or with a digit but without the "in/over/after/with my N years" frame;
  - calendar years and durations;
  - anecdotes about people described with nouns outside PERSON_NOUNS ("woman", "women");
  - tools;
  - method and product names.
- **Why.** `checkFabrication` detects a closed set of proof and track-record shapes about the coach's clients. It has no
  category for the speaker's own life. A detail it does not detect is treated as allowed (`trackRecordClaims.ts:222-225`:
  *"A claim NOT returned here is a method claim and is always allowed"*).
- **Compounding layer.** If a traceability check were added, the corpus it would search is ~80% generated
  (`expandProfile` output). The persona quotes that seeded "12 years", "husband" and "LinkedIn" would then read as
  grounded (§15a).
- **Where it applies.** Every surface that shares `checkOutput(…, grounding)`, including the Meta publish boundary.
- **Why HIGH.**
  - The detector code is read line by line.
  - The negative control shows certainly-absent details of the same kinds passing, with detection output empty.
  - The paired positive controls block in the same fields, so the instrument is connected.
  - The replay reproduces the stored verdict exactly.
- **The one qualification** is about provenance, not the finding. The 8 scripts were produced by the harness from local
  code against production, not by the deployed server (§3.3). The gate code involved is unchanged in every commit on
  either side.

---

## 7. Temp files — all in the scratchpad, none in the repo; left in place

Location: `/private/tmp/claude-501/-Users-arfeenkhan-zap-deploy/57bcb7ed-4d1c-4421-b236-173c483df455/scratchpad/threadb-grounding/`

**Scripts:**

| file | purpose |
|---|---|
| `run_sql.py` | read-only runner (refuses non-SELECT/SHOW/DESCRIBE) |
| `replay.ts` | reproduces the corpus and gate on the 8 stored scripts |
| `control.ts`, `control2.ts` | negative control and per-line cases |

**SQL:** `q_schema.sql`, `q_data.sql`, `q_up.sql`, `q_svc2.sql`, `q_ct_schema.sql`, `q_ct.sql`.

**Outputs, containing production data.** They hold the coach's transcript and generated copy: session-scoped, not
shared, not committed.

| file(s) | contents |
|---|---|
| `schema.out`, `data.out`, `up.out`, `svc2.out`, `ct_schema.out`, `ct.out` | raw query results |
| `rows.json` | parsed production rows |
| `scripts.txt` | script text |
| `corpus.txt`, `corpus_meta.json` | the corpus as the real function builds it |
| `coach_typed.txt` | the coach's typed messages |
| `search.out` | detail search, every pattern and hit |
| `replay_out.json`, `control_out.json`, `control2_out.json` | gate outputs |

**Removed:** none. Nothing was written to `/tmp` or to the repo other than this report, which is untracked and not added.
