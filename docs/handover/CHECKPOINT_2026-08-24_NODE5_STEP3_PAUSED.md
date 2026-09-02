# CHECKPOINT — Node 5 step 3 PAUSED mid-flight. Step 2 shipped, step 3 built and deliberately unshipped

**Written for a cold session with no memory of the one that produced it.** Everything below was
verified in-session, not recalled. Read this file, then `CHECKPOINT.md`, then
`docs/handover/NODE5_REBUILD_PROPOSAL_2026-08-24.md` for the full working record.

**Do not start any work from this file without being asked.**

---

## 1. Git state

| | |
|---|---|
| HEAD | **`8b9b408`** on `railway-build` — **local, unpushed** |
| `origin/railway-build` | **`f5be0b0`** |
| position | **2 ahead, 0 behind.** The second commit is the pre-existing `0ef00bb` docs checkpoint, not from this work |
| deployed? | **Nothing has deployed.** Railway deploys on push, and there has been no push |

`server/scripts/ab-icp-phaseA.ts` is **untracked and not ours.** Leave it alone; it is not part of
this work and must not be staged.

---

## 2. What IS committed — `8b9b408`, step 2

The lead-magnet body generator now receives the coach's **method**, not the label on it.

- **Routes through `getCascadeContext(userId, icpId, "hvco", { mechanismChars: 1600 })`.** It
  previously took a single column — the mechanism's NAME — off the correct row through the correct
  foreign key. Node 5 is the node whose *content* is the coach's method, and it was the only node
  told what the method is called and never what it is.
- `getCascadeContext` gained an optional `mechanismChars`, **defaulting to 900**, so every other
  caller is byte-unchanged. `describeMechanismText` was split out pure and exported so tests
  exercise the real renderer.
- **Both invented fallbacks removed.** The first was an LLM-generated service-node field that the
  mechanism generator itself refuses to read, because feeding it back in launders an invention into
  evidence — Node 5 was doing exactly that. The second was a literal placeholder string. Where no
  mechanism resolves, **no method is named at all** and the prompt asks for plain description.
- **`coachMethods` resolver added** — designed for, never depended on. The table is empty on
  production and no row carries a `coachMethodId`, so the branch is proven by unit test, not by a
  live run.
- **Source-material framing added**: the injected mechanism is material to teach *from*, in the
  model's own words, with examples built from the audience.

### 🔑 Why the framing is load-bearing, not decoration

**10.4% of `mechanismDescription` rows (114 of 1,095) end in a fabricated vignette** — a
`The before:` / `The after:` frame carrying an invented quoted outcome. Injecting those unframed
licensed the body to write its own, and **one A/B row produced a fabricated person placed at real
named organisations.** With the framing in place that shape did not recur across five rows.

---

## 3. What is in the WORKING TREE, uncommitted — and deliberately so

Step 3, the size bounds. **Present, complete, tested — and NOT approved to ship as set.**

- `BOUNDS` for all four formats
- `applyBodyBounds` — **repair-not-reject**: upper bounds are trimmed after parse, never rejected,
  so a bound can never become a new route to a null body. Array trims keep the **first** N.
- Schema bounds on all four formats; quiz mirrors `validateQuizBody` exactly
- **Quiz counts are never repaired** — bands must partition 0–100 contiguously and a question's
  options must carry differing weights. Trimming either guarantees the validator failure the repair
  exists to prevent. Only the quiz's prose fields are capped.
- **`nextStep` left uncapped everywhere**
- **19 new tests. 463 tests green. TS baseline 34.**

> 🔴 **DO NOT COMMIT THIS IN ITS CURRENT FORM.** It is held on purpose.

---

## 4. Why it is not shipping

**The caps were derived at the target rather than above it.** They sit on the median, so they
truncate half the corpus by definition. Measured: median `section.body` is **1,442 chars against a
1,400 cap**; 53% of sections trimmed with the schema hint in place, 68% without it.

**Worse, the trims sever deliverables:**

| what was cut | |
|---|---|
| a fill-in template | section went 4,492 → 1,060 chars |
| a sector-filter checklist the reader ticks | 2,720 → 819 |
| **a swipe message cut mid-sentence** | kept *"…making a considered move into [TARGET SECTOR]."*, cut the rest |

### The principle, recorded so it is not relearned

**Repair-not-reject correctly avoided null bodies — but always returning something is not the same
as always returning something USABLE. A repair that damages the deliverable is not a repair.**

It also cuts directly against the 80/20 bar: **usable tools are the point of the asset, and they are
the longest things in any section**, so a length cap aimed at prose lands hardest on exactly the
content the format exists to deliver.

### A second, separate defect

`truncateAtSentence` cuts at the last sentence boundary inside the cap. **Markdown has none** — bold
labels, bullets, checkbox glyphs and table rows do not end in sentence punctuation — so the last
boundary can sit far back. One section came back **40% under its cap** (819 against 1,400).
**Correct function, wrong instrument for structured content.**

---

## 5. Approved and waiting to be built — NOT started

1. **Raise `section.body` above the centre** so the cap catches genuine outliers (the 4,492-char
   section) and leaves typical sections untouched. **Derive the number and show the derivation. No
   research figure anywhere, including in comments.**
2. **Move the length target into the prompt**, where a target belongs, so the median comes down by
   generation rather than by truncation.
3. **Trims on structured fields cut on a BLOCK boundary** — blank line, list item, heading — so a
   template, checklist or swipe message can never be severed. **Prose fields keep
   `truncateAtSentence`.**
4. **Hold the checklist caps out entirely.** 100% of items trimmed on a two-body sample means the
   cap and the output have never agreed. It needs its own evidence before any number is set.
5. **Toolkit ships as proposed** — 27% of tools trimmed is the tail-only behaviour intended, since
   its content *is* the deliverable.

### Two additions to that work

- **Audit whether `truncateAtSentence` is applied to structured content anywhere else.** Start with
  **`describeMechanismText` in `server/_core/cascadeContext.ts`**, which caps mechanism descriptions
  at 1,600 using it. **Report, do not fix.**
- **The numeric source-boundedness rule must cover `nextStep.body` explicitly.** Row 2's bridge
  carried *"puts you ahead of 90% of senior managers"* — **an invented statistic in the one field
  deliberately left uncapped.**

---

## 6. What held up under test

- ✅ **The root-cause diagnosis section was never trimmed** in any of the five rows, and structurally
  should not be: a framing section is shorter than a step carrying a worked example. Section 0
  measured 1,173 / 1,069 / 798 / 1,078 / 1,240 chars, all under cap. **No front-loading instruction
  is needed.**
- ✅ **The bridge survived**, vindicating the decision to leave `nextStep` uncapped.
- ⚠️ **Length is progress, not arrival.** Post-repair bodies are **~1,462 words** against a
  consumable-in-one-sitting bar — **and that figure is reached by truncating deliverable content,
  which is not a way to arrive anywhere.** A future session must not read step 3 as having closed
  the length question.

---

## 7. Banked, NOT started — nothing here is scoped

Listed so nobody picks one up believing it is ready to execute.

1. The **numeric source-boundedness rule** for figures — any number comes from what the coach
   supplied; otherwise describe the scale in words.
2. **Step 4 — the bridge CTA.** In the downloadable it is a dead `href="#"`; on the delivery page it
   loops back to the magnet the reader was just given.
3. **Step 5 — the publish-time compliance gate.** Blocked until classifier precision on
   `tools[].content` is fixed (86% of toolkit hits are misfires there), but **possibly viable for
   narrative formats sooner**, where misfires are the minority.
4. **Prompt-versus-output divergence audit across the cascade** — several prompts state ranges their
   output has never matched.
5. **`autoSelectBest` overwrites kit pointers unconditionally**, on any regeneration.
6. **Node 4 has no generation/persistence split**, unlike Node 5.
7. **`whatTried` is byte-identical to `whyExistingNotWork`** on 64% of populated rows.
8. **No Node 4 rebuild output survives on production** — `sourceTier` is NULL on all 1,095 rows and
   `coachMethods` is empty, so the tier-1 register question is still open.

### The thread running through all of it

Every one of these is the same defect in different clothing: **the generator fills a gap with
invention when it lacks real material.** Node 4 already answered it properly with the tier system —
know what you have, label the tier, degrade honestly. **It should become a cascade-wide standard
rather than a patch per node.**

---

## 8. Standing guardrails — a fresh session reading only this file has no other copy

- **Nothing commits, applies, pushes or deletes without Arfeen's explicit word in the immediately
  preceding message. Each authorisation is one-time.** If a session was interrupted or approval is
  ambiguous, **default to not writing.**
- **Pushing `railway-build` is an instant production deploy.**
- **Protected services 272–277 and 285 are untouchable**, as is any protected campaign.
- **Migrations 0097–0104 are applied — never re-apply them.**
- **Stage named paths only. `git add -A` is always wrong in this repo.**
- Off-machine backups go only to `backup/publish-path-sprint-2026-08-08`.
- The step-4c Meta publish scripts under `server/scripts/` shipped **dormant — do not invoke them.**
- **Test gates:** TS baseline **34** (`npx tsc --noEmit 2>&1 | grep -c "error TS"`), must not
  regress; new work adds zero. Repo is **pnpm-only**.
- **Node numbering: Lead Magnet is Node 5, Unique Method is Node 4.** Get it right before touching
  anything.
- **`HVCO` is the internal name for the lead magnet** — the code, the DB (`hvcoTitles`, `hvcoTopic`)
  and older docs all use it. **Any search must cover both terms.**
- **Search reliability:** `grep` here is **`ugrep`** and returns nothing silently when multiple
  `--include` flags are stacked; `timeout` makes `pdftotext` emit nothing. **Run a positive control
  before trusting any zero.** `rg` was used throughout this work for that reason.
- The **Google Drive mount is empty and unsynced**, so anything held in Drive is unreachable from
  this machine. Never report "not found" as "does not exist anywhere" without saying so.
- **Driver scripts live in the scratchpad, outside the repo.** Every measurement in this work was
  read-only; the A/B runs and the step-3 proof wrote nothing to production.
