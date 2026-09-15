# SPRINT 1 + 1b — coach facts: the store (0111) and the builder (F1), 2026-09-16

**Two commits, worktree branch `worktree-agent-a5bab12e1adfefa97`, based on `35baeb1`. Not pushed.**
Sprint 1 = schema + migration only (invariant 6). Sprint 1b = builder + tests + this record.

🔴 **Migration 0111 is NOT applied to production.** A CREATE TABLE is a production write. It needs Arfeen's
explicit go-ahead in the immediately preceding message (CLAUDE.md §10).
🔴 **It is not applied locally either: no local database was reachable** (§3).

---

## 0. Prior art — none

- `git log --all -S` found no code for `coachFacts`, `coach_facts`, `supersededAt`, `superseded_at` or
  `factStore`. `sourcedAt` appears only in the two 2026-09-16 planning docs (`f8a7d77`, `949f4a6`).
- `git log --all --grep=revert` shows no removed fact store.
- No existing drizzle migration creates anything similar.

## 1. Schema — `coachFacts` (migration `drizzle/0111_coach_facts.sql`)

| column | type | why |
|---|---|---|
| `id` | INT AI PK | |
| `userId` | INT NOT NULL, FK `users` ON DELETE CASCADE | owner |
| `serviceId` | INT NULL, FK `services` ON DELETE SET NULL | optional service scope |
| `factScope` | ENUM('account','service') NOT NULL | SET NULL would otherwise turn a service-scoped fact into an account-wide one (the 0110 testimonial defect: NULL read as "applies everywhere"). `service` + NULL `serviceId` = orphaned, and the builder drops it. Not a CHECK: MySQL forbids FK referential actions on columns used in a CHECK. |
| `slot` | VARCHAR(64) NOT NULL | e.g. `people_trained` |
| `slotKind` | ENUM('practice','biography','credential','offer') NOT NULL | |
| `factValue` | TEXT NOT NULL | verbatim |
| `sourceChannel` | ENUM('coach_typed','coach_confirmed_rewording','ladder_answer','operator_capture','account_profile') NOT NULL | coach channels only; **no value exists for generated text** |
| `sourceRef` | VARCHAR(255) NOT NULL | where the value came from |
| `sourcedAt` | TIMESTAMP NOT NULL, **no default** | a default would stamp a backfill with today and make an old figure look current |
| `supersededAt` | TIMESTAMP NULL | NULL = current; older values marked, never deleted |
| `createdAt` | TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP | |

Indexes: `idx_coachFacts_user_slot_superseded (userId, slot, supersededAt)` (also covers the userId FK) and
`idx_coachFacts_serviceId`.

**SQL safety scan (§9).**
- No MySQL keywords as column names: `value`, `source`, `scope` and `kind` were renamed to `factValue`,
  `sourceChannel`, `factScope` and `slotKind`. Every identifier is backticked anyway.
- No snake_case overrides: every JS key equals its DB column.
- No generation-time parameter posing as a column.

**Journal.** Hand-written, like 0060–0110. `_journal.json` stops at 0059, so no entry was added.

## 2. What verifies the migration without a database

`server/coachFacts.test.ts`, last describe block, parses the SQL file and checks three things:
- its 12 columns equal `getTableColumns(coachFacts)`, in order;
- its three ENUM lists equal Drizzle's `enumValues` and the builder's constants;
- `sourcedAt` has no default, the FKs are CASCADE and SET NULL, and the file contains no INSERT, UPDATE,
  DELETE or ALTER.

**Only an apply followed by an `INFORMATION_SCHEMA` read proves the DB shape (§9). This test does not.**
The exact verification queries and the expected output are in the migration header.

## 3. Local apply: not run. There is no reachable local DB.

| candidate | finding |
|---|---|
| Homebrew MySQL 9.4.0, `127.0.0.1:3306` | Installed and stopped. It was started for this check, then stopped again, as found. **`root` without a password: `ERROR 1045 Access denied`.** The datadir holds only `mlm`, `mlm_db` and `mlm_system`, with no ZAP schema. No password was guessed. |
| `.env` target `127.0.0.1:3307/zap_test` | Nothing listening. It was the 2026-08-28 Stage A copy, whose datadir lived in that session's scratchpad (`…/scratchpad/mysql3307/data`). That datadir is gone. |

Creating a fresh instance was not done: the brief allows an apply "only if one exists".

**Target guard, and its controls.** The guard allows only an exact `@@version_comment = 'Homebrew'`.
`VERSION()` is not consulted. An unreadable comment refuses. Script: session scratchpad
`target_guard.py`, not committed.

| # | input | result |
|---|---|---|
| 1 | simulated `MySQL Community Server - GPL` (production's value) | **REFUSE**, exit 2 |
| 2 | simulated `Homebrew-ish MySQL Community Server` | **REFUSE**, exit 2 |
| 3 | simulated empty answer | **REFUSE**, exit 2 |
| 4 | simulated `Homebrew` | ALLOW, exit 0 |
| 5 | real `127.0.0.1:3306` (stopped) | **REFUSE** on silence: `ERROR 2003` |
| 6 | real `127.0.0.1:3307` | **REFUSE** on silence: `ERROR 2003` |

No `railway` command was run. Production was never contacted.

## 4. The builder — `server/_core/coachFacts.ts`, `buildCoachFacts(input)`

It is pure: it takes loaded rows and makes no DB access, so it works whether or not 0111 is applied. It returns:
- `facts`: groundable facts `{slot, kind, value, source, sourceRef, sourcedAt}`;
- `canonical`: the current value per single-valued slot;
- `superseded`: not groundable, kept for F2's "conflicts with the current fact" verdict;
- `excluded`: every refused source, with a reason.

**Single-valued slots:** `people_trained`, `countries`, `years_experience`, `clients_served`,
`headline_credential`. The newest `sourcedAt` wins, and on a tie the higher row id wins. The rest are superseded.
`sourcedAt` is `null` wherever storage records no per-fact time. Row-level `updatedAt` is not used, because
it moves when generated text overwrites the row (addendum §3).

**Ownership and scope** are checked on every source. A value from another user, from another service, or
from an orphaned service-scoped row is refused with a reason.

### Sources INCLUDED (each verified in code)

| source | slot / kind / channel | evidence it is the coach's |
|---|---|---|
| `coachFacts` rows, `supersededAt IS NULL` | as stored | the channel enum admits coach channels only; each row's enums, `sourceRef` and `sourcedAt` are validated at runtime |
| `users.coachBackground` | `coach_background` / biography / account_profile | only writer: `user.updateCoachProfile` (`routers/user.ts:61-69`), from `CoachIdentityModal`, which submits the typed textarea with no generation |
| ICP ladder answers | `ladder_<key>` / practice / ladder_answer | `icpGrounding.ts:394-409` stores the coach's answers verbatim. Keys are limited to `ICP_LADDER_KEYS`. ICP prose is never read. |
| method walkthrough: the coach turn right after Zappy's differentiator question | `method_differentiator` / practice / coach_typed | `coachMethods.rawMaterial` holds the transcript verbatim (`routers/methods.ts:35-41`), labelled `coach` or `zappy asked`. Read only when `sourceTier = coach_stated`. |
| `services.pressFeatures`, `services.socialProofStat` | `press_features` / `social_proof_stat` / credential / coach_typed | only writer is `services.update` (zod `services.ts:206,208`), fed by the service form (`ServiceDetail.tsx`). `expandProfile`, `create` and the intake never write them. |
| testimonial library, `source = coach_supplied` | `testimonial` / credential / coach_typed | `testimonials.add` fixes the source (`routers/testimonials.ts:61`). Placement mirrors `partitionProof` (`lib/realTestimonials.ts:84-99`). |
| A2: `campaignKits.campaignFacts` (eventSchedule date/time/timezone/venue, price.amount) | `event_*`, `offer_price` / offer / operator_capture | only writer: `answerCampaignFact` (`routers/campaignKits.ts:436-456`), from the coach's answer |
| A2: `placeholderValues` | `operator_token:<name>` / offer (credential for COACH_CREDENTIAL, AUTHORITY_TITLE, FEATURED_IN) / operator_capture | only writer: `placeholders.save` (`routers/placeholders.ts:51-122`), from `PlaceholderEditor` / `QuickFillChatCard`. The campaign row beats the account default, and `__SKIP__` is dropped. |

### Sources EXCLUDED

| source | reason recorded | evidence |
|---|---|---|
| `services` painPoints, whyProblemExists, failedSolutions, falseBeliefsVsRealReasons, hiddenReasons, avatarName, avatarTitle, riskReversal, uniqueMechanismSuggestion, hvcoTopic, applicationMethod, mechanismDescriptor | `generated` | written by `expandProfile` / AutoPop. Excluded **even when `buyerIntelSource` says `coach_stated`**, because that tag comes from a diff and a one-character edit tags the whole field (`services.ts:169-178`). |
| `services` description, targetCustomer, mainBenefit | `unconfirmed_rewording` | the extractFromText rewording. **No confirmation is persisted** (§5). |
| `services` name, buyerNegatives, testimonial1-3 Name/Quote, price, totalCustomers, averageRating, totalReviews, bonuses, guarantee / delivery / payment fields | `provenance_unrecorded` | `name` comes out of the extraction ladder. `buyerNegatives` is written by the extractor or typed, indistinguishably. `testimonials.activateForService` copies library rows of **any** source (seeded_demo and imported included) into testimonial1-3 (`routers/testimonials.ts:158-193`). The offer and count columns have no verified coach-only writer. |
| a `coachBackground` on the services object | `wrong_table` | `services` has no such column. `buildCoachCorpus` reads it there (`groundingCorpus.ts:102`), so it is always null (D2). |
| `coachMethods.differentiator` (and steps, ump, ums, oldVehicle) | `generated` | `saveMethod` re-extracts through the LLM at save time (`routers/methods.ts:143-147`). The reflect-back the coach confirms shows **only the steps** (`methods.ts:58-61`). `save()` also runs when the correction limit is hit, without a confirm (`V2MethodWalkthrough.tsx:161-164`). |
| method rawMaterial when `sourceTier ≠ coach_stated` | `not_coach_supplied` | material mined from elsewhere |
| testimonials with source `seeded_demo` / `imported` / NULL scope | `not_coach_supplied` / `provenance_unrecorded` | same gates as `partitionProof` |
| `coachFacts` rows: `supersededAt` set, a confirmed rewording for a non-practice kind, invalid enum or date, wrong owner, orphaned or out of scope | as named | runtime validation |
| ICP prose, offers, mechanisms, concepts, scripts | never read | the input type has no slot for them. ICP rows contribute `groundingMeta.ladderAnswers` only. |

Not included, and not in the brief: coach turns in the method transcript other than the differentiator
answer. They are coach-typed and are a candidate for sprint 2.

📌 **Found in passing, not fixed (§15j: `groundingCorpus.ts` untouched).**
- `readLadderAnswers` returns `{}` for a JSON string: its `typeof === "string"` branch sits after an
  object-only guard, so it can never run. The builder parses a string before calling it.

## 5. D-a confirmation finding

**ZAP persists no record that the coach confirmed the extractFromText rewording.**
- "That's me" (`V2TrailIntake.tsx:1188-1189`) goes straight to `askServiceNameOrCreate` → `createService`.
- The `services.create` payload (`V2TrailIntake.tsx:297-308`) carries name, category, description,
  targetCustomer, mainBenefit and buyerNegatives. It has no confirmation marker.
- `createServiceSchema` (`services.ts:10-33`) has no such field, and `drizzle/schema.ts` has no
  `confirmed*` column anywhere.
- The TweakBox path (`handleTweakConfirm`, :1204) is stored the same way, so coach-edited and untouched
  extractions cannot be told apart. So can services created through the V1 form.

**The builder therefore fails closed.** The three services columns never ground. Only a `coachFacts` row
with `sourceChannel = coach_confirmed_rewording` can carry a confirmed rewording, and only for `slotKind =
practice`. Such a row has no writer yet. Adding a confirmation flag is UI and migration work, out of scope here.

## 6. Tests — `server/coachFacts.test.ts`, 21/21

Verdicts were fixed before the first run.
- **(a) negative control.** Generated `painPoints` / `whyProblemExists` / `avatarTitle` / `riskReversal`, ICP
  prose and the method distillation carry "twelve years in HR" and "my husband". Neither appears in any fact,
  canonical or superseded value. Positive artefacts: six named coach facts are returned, and the refusals are
  recorded. Control on the control: the same strings typed into `coachBackground` do come through.
- **(b) supersession.** The newer of two values is canonical in both input orders. The older lands in
  `superseded`. A row with `supersededAt` never grounds. On equal times the higher id wins. Multi-valued slots
  keep every value.
- **(c) D-a.**
  - A confirmed rewording is accepted for `practice` and refused for `biography` and `credential`.
  - The same biography value typed by the coach is canonical.
  - The services rewording fields are recorded as `unconfirmed_rewording`.
- **(d)** the fact comes from `users.coachBackground` with ref `users:7.coach_background`. A value on the
  services object is refused as `wrong_table`. Another user's profile is refused.
- **(e)** a marker in every generated services field, ICP prose and method distillation never surfaces, and each
  field is recorded as `generated`.
  - A non-`coach_stated` method contributes nothing.
  - Only coach_supplied library testimonials ground. seeded, imported, untagged, other-service and
    services-row quotes do not.
- **Extras:**
  - an orphaned or out-of-scope service row is refused;
  - invalid rows are refused;
  - A2 kit and operator-token facts ground as offer facts;
  - schema/migration/builder parity (§2).

**Mutation controls (§15c).** The builder was broken five ways and restored byte-identical afterwards.
Every break failed the suite, each in the test written for it:

| mutation | failing tests |
|---|---|
| generated painPoints added as a fact | (a), (e) |
| D-a kind check disabled | (c) |
| supersession disabled | (b), both orders |
| coachBackground read from the services object | (d) |
| ICP prose read | (a), (e) |

**Gates, measured at run time in this worktree (§15f):**

| | baseline `35baeb1` | after sprint 1 `e00cbd1` | after sprint 1b |
|---|---|---|---|
| `tsc` errors | 34 | 34 | 34 |
| icpGrounding.test.ts | 46/46 | 46/46 | 46/46 |
| fabricationValidator.test.ts | 23/23 | 23/23 | 23/23 |
| fabricationGateDefects.test.ts | 15/15 | 15/15 | 15/15 |
| pipeline-fixes.test.ts | 414/414 | 414/414 | 414/414 |
| coachFacts.test.ts | — | — | 21/21 |

## 7. §15d — no caller, no writer

- **The builder has NO production caller until sprint 2 (F2).** Nothing imports `buildCoachFacts` outside its
  test.
- **The table has NO writer until sprint 6 (the coach screen) or a separately approved backfill.** No backfill
  was added. Until one exists, table rows contribute nothing, and every fact comes from the legacy columns
  in §4.
- **No loader was added.** A DB loader today would read a table that does not exist in production. Sprint 2
  owns loading, together with its caller.
- `buildCoachCorpus`, `buildProofSupplied`, `checkOutput` and the existing gate are unchanged (§15j).
- `_core/copywritingRules.ts` and `client/src/pages/` were not touched.

## 8. Pending

1. **Apply 0111 to production.** It needs Arfeen's explicit go-ahead. Apply it before any code that reads or
   writes the table deploys. The verification queries are in the migration header.
2. **The D-a confirmation flag.** It needs a screen and a migration before a confirmed rewording can exist.
3. **Sprint 2 (F2).** It needs the loader and the first caller.
