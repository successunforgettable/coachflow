# CHECKPOINT — Node 5 step 4 PAUSED on a PRODUCT DECISION. Tier 3 shipped locally; tiers 1 and 2 scoped, not built

**Written for a cold session with no memory of the one that produced it.** Everything below was
verified in-session, not recalled. Read this file, then `CHECKPOINT.md`, then
`docs/handover/NODE5_REBUILD_PROPOSAL_2026-08-24.md` for the full working record.

**Do not start any work from this file without being asked.** In particular, the scoped tiers
below are NOT approved work waiting to be picked up.

---

## 1. Git state

| | |
|---|---|
| HEAD | **`c8a0bf5`** on `railway-build` — **local, unpushed** |
| `origin/railway-build` | **`f5be0b0`** |
| position | **5 ahead, 0 behind** |
| deployed? | **Nothing has deployed.** Railway deploys on push, and there has been no push |

Commits ahead of origin, oldest first:

| SHA | what |
|---|---|
| `0ef00bb` | pre-existing docs checkpoint — **not from this work** |
| `8b9b408` | step 2 — mechanism cascade wiring |
| `2e5d94f` | step 3 — size bounds |
| `ed3ea41` | the statistic-rule import |
| `c8a0bf5` | step 4 tier 3 — the bridge |

`server/scripts/ab-icp-phaseA.ts` is **untracked and not ours.** Leave it alone; it must never be
staged.

---

## 2. What is DONE on Node 5

### Step 2 — the mechanism reaches the body (`8b9b408`)

The body generator routes through `getCascadeContext` at **1,600 characters**, so it receives Node
4's full mechanism rather than only its name. **Both invented fallbacks are gone** — the
LLM-generated service field that the mechanism generator itself refuses to read, and the literal
placeholder. Where no mechanism resolves, no method is named at all. A `coachMethods` resolver
exists (designed for, never depended on — the table is empty on production). The injected mechanism
is framed as **source material to teach from, not a style exemplar**, which is load-bearing:
10.4% of `mechanismDescription` rows end in a fabricated vignette, and injecting those unframed
licensed the body to write its own.

### Step 3 — size bounds (`2e5d94f`)

`section.body` sits at the **outlier fence (2,800 = Q3 + 1.5×IQR over 137 measured sections,
rounded up)** rather than on the centre, where the first version put it and truncated half the
corpus. The **length target lives in the prompt** (~200 words, the generator's own Q1) rather than
being achieved by truncation. Structured fields — `sections[].body`, `tools[].content` — trim on a
**block boundary via `truncateAtBlock`**; prose keeps `truncateAtSentence`. Result: sections
trimmed 16/30 → **0/30**, deliverables severed 3 → **0**.

**Checklist caps are deliberately held out entirely** — the shortest of 20 production items is
**309 characters against a proposed cap of 300**, so literally every item would have been trimmed.
The cap was wrong, not the corpus. `applyBodyBounds` now matches quiz explicitly rather than as the
catch-all `else`, so a held-out checklist cannot silently route into the quiz branch.

### The statistic rule (`ed3ea41`)

`NO_RESEARCH_STATISTIC_FABRICATION_RULE` was **a missing inheritance, not a missing rule.** Landing
page, email and WhatsApp have carried it since `3d604cd`; Node 5 imported only
`GUARANTEE_CLAIMS_RULE`. It is now in Node 5's **system prompt**, alongside the guarantee rule.
Shared rule unmodified, no local variant, `methodDirective` untouched — all asserted by test.

> 🔴 **CARRY THIS CAVEAT. The proof run did NOT prove the import worked.** The non-timing rate
> reached **zero in the run BEFORE the import** and stayed there. The visible 0.094 → 0.037
> improvement is entirely deliverable timings, which are permitted copy. At n=5, against a class
> appearing historically in 1 of 5 and 3 of 5 rows, the run was structurally unable to detect the
> rule's contribution. **The import is justified by consistency of inheritance alone.** Do not cite
> that run as evidence the rule works.

### Step 4 tier 3 — the bridge (`c8a0bf5`)

All three bridge surfaces now render an **honest text card with no button** instead of a dead
anchor or a loop: the downloadable's `href="#"`, the delivery page's CTA pointing back at the
magnet just handed over, and the quiz result pointing at its own page.

---

## 3. Why step 4 stopped where it did

**Tiers 1 and 2 are scoped and deliberately NOT built.**

- **Tier 1** — a free-type sibling campaign on the same service.
- **Tier 2** — an operator-captured URL asked for at publish.

Both fetch **something no part of the product creates.** And they are **mutually informing**:

- If ZAP **generates** the free next step itself, tier 1 is native and tier 2 is a rare escape hatch.
- If ZAP **asks the coach** for their own destination, tier 2 is the answer and tier 1 is optional.

**Building either now risks building the wrong one.**

> ⚠️ **These scopes are NOT approved work waiting to be picked up.**

---

## 4. 🔴 THE BLOCKING DECISION — a product decision, not a technical one

**Nothing in the eleven-node cascade asks the coach to create, name or point at the free next
step.** That is why **0 of 3 magnet-carrying services have one** — not coach neglect, not data
quality. Nothing ever asked.

`campaignFraming.ts` states the model plainly — coaches convert on a free next step and sell
high-ticket later, off-page — and the code acts on it throughout, in `OfferMode`, in price and
guarantee suppression, and in page-type selection. **But a campaign is one kit with one landing
page**, so the free next step has **no home in the data.** It is not an empty field; it is a concept
with no field.

**Arfeen is deciding between:**

1. **The cascade generates the free next step itself**, as part of the lead-magnet campaign — **this
   is the recommendation on the table**; or
2. **It is captured from the coach at publish.**

# 👉 NOTHING FURTHER GETS BUILT UNTIL THAT IS SETTLED.

### Tier 2's load-bearing detail, so it is not lost

**The decision is the ORDERING, not the token.** The token is cheap — one registry entry and one
non-empty list. But **operator capture is keyed to a landing page**, while the **magnet publishes
earlier, from the cascade, keyed to `hvcoId`**. So either the magnet publishes before the answer
exists, or magnet publish moves behind capture.

---

## 5. Banked findings — NOT STARTED, nothing here is scoped

Listed so nobody picks one up believing it is ready to execute.

1. **Compliance classifier precision**, concentrated in `tools[].content` — **blocks step 5**, though
   narrative formats may be viable sooner.
2. **The validator's percentage pattern** requires a quantifier AND a group noun from fixed lists,
   so *"ahead of 90% of senior managers"* **matches neither** — the statistic import is
   **prompt-side only**, with nothing downstream to catch a miss.
3. **`PROOF_COMPOSITIONAL_CEILING_RULE`** — defined in-file, **pasted into no prompt anywhere.** The
   same missing-inheritance shape.
4. **The prompt-versus-output audit** — it should look for **OVERLAP, not only divergence**, because
   instructions **compete for a slot rather than reinforcing each other.** The divergent range is
   the symptom; the competing instruction is the cause.
5. **`autoSelectBest` overwrites kit pointers unconditionally**, on any regeneration.
6. **Node 4 has no generation/persistence split** — it cannot be exercised without writing.
7. **`whatTried` is byte-identical to `whyExistingNotWork`** on 64% of populated rows.
8. **No Node 4 rebuild output survives on production** — `sourceTier` NULL on all 1,095 rows,
   `coachMethods` empty.

---

## 6. 📌 STANDING REGRESSION CHECK

**Any edit to a section-shape or length instruction requires a live run and a read of the
root-cause opener rate before that change is trusted.**

**It is a READ, not a metric.** Every count and every test was green in the run that lost the beat.
The diagnosis section is naturally the shortest in the body, so length instrumentation looks
*healthier* precisely as it disappears.

---

## 7. Standing guardrails — a fresh session reading only this file has no other copy

- **Nothing commits, applies, pushes or deletes without Arfeen's explicit word in the immediately
  preceding message. Each authorisation is one-time.** If a session was interrupted or approval is
  ambiguous, **default to not writing.**
- **Pushing `railway-build` is an instant production deploy.**
- **Protected services 272–277 and 285 are untouchable**, as is any protected campaign.
- **Migrations 0097–0104 are applied — never re-apply them.**
- **Stage named paths only. `git add -A` is always wrong in this repo.**
- **`copywritingRules.ts` is never touched.** Rewriting it also changes what `_core/validator.ts`
  reads, which puts it on the compliance path for four modules. Lifting that guardrail is Arfeen's
  call. **The positive-only rewrite of the shared statistic rule is banked behind it.**
- **The republish sweep for already-published magnets is out of scope** and needs its own
  authorisation.
- Off-machine backups go only to `backup/publish-path-sprint-2026-08-08`.
- The step-4c Meta publish scripts under `server/scripts/` shipped **dormant — do not invoke them.**
- **Test gates:** TS baseline **34** (`npx tsc --noEmit 2>&1 | grep -c "error TS"`), must not
  regress; new work adds zero. Repo is **pnpm-only**.
- **Node numbering: Lead Magnet is Node 5, Unique Method is Node 4.**
- **`HVCO` is the internal name for the lead magnet** — the code, the DB (`hvcoTitles`, `hvcoTopic`)
  and older docs all use it. **Any search must cover both terms.**
- **Search reliability:** `grep` here is **`ugrep`** and returns nothing silently when multiple
  `--include` flags are stacked; `timeout` makes `pdftotext` emit nothing. ⚠️ **`rg -r` is
  `--replace`, not "recursive" — `rg -rn "foo"` silently rewrites every match and destroys the
  result.** **Run a positive control before trusting any zero.**
- The **Google Drive mount is empty and unsynced**, so anything held in Drive is unreachable from
  this machine. Never report "not found" as "does not exist anywhere" without saying so.
- **Driver scripts live in the scratchpad, outside the repo.** Every measurement in this work was
  read-only; no run in this sprint wrote to production.
