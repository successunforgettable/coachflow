# Script-generator requirements, derived from a graded human draft (2026-09-03)

**What this is.** On the night of 2026-09-02 Arfeen hand-wrote three video ad scripts without
reading the script research in this repo. They were then graded against
`../script-research/`, and **eight specific defects came back**. This document turns each one into a
requirement a generator must satisfy, with the research quote behind it and the mechanism that
would enforce it.

**Why a graded human draft is worth more than the research alone.** The research says what a good
script contains. It does not say *which rules a competent writer working from instinct will miss.*
These eight are exactly that list — the failure modes of a smart person who has not read the
reports. A generator writes from instinct too, in the sense that matters: it produces fluent,
plausible output that satisfies the brief while quietly missing constraints nobody restated. **Every
defect below is a defect a language model will reproduce.**

A ninth item (§R9) was found while writing this document and is not one of Arfeen's eight.

---

## How to read the enforcement column

| class | meaning |
|---|---|
| 🔴 **HARD** | a validator can measure it from the script object. Deterministic, no model involved. Belongs in `conceptScriptValidator.ts`. |
| 🟡 **JUDGEMENT** | no reliable machine measurement. Belongs in the prompt, and can only be *screened* for absence, never confirmed present. |

**A note on the 🟡 class that must not be lost.** For a judgement rule, a validator can often prove
the *absence* of the required element but never its *presence* — a script with no bridge phrase
certainly lacks a bridge, but a script containing "Here's how" has not thereby earned one. Screen
for absence; do not report presence as compliance. Reading "the marker was found" as "the rule was
satisfied" is the §15h shape.

**And per §14 / §14a: none of the failing shapes below may be quoted into a generation prompt.**
This document is a HUMAN REFERENCE DOCUMENT, so the before-and-after pairs belong here. The prompt
gets the positive half only. Test fixtures may carry the failing shapes — they are the negative
control.

---
---

# R1 · Spoken pace must not exceed three words per second

**The defect.** All three v1 scripts ran at **3.4–3.8 words per second**, over the ceiling.

**The research.**
> *"Maintaining a pace of approximately three words per second allows for necessary pauses, which
> prevents the message from becoming unintelligible 'noise'."*
> — `Analysis of Conversational Calls-to-Action in Video Advertising.md`

> *"An acceptable pace for high-retention video is approximately three words per second."*
> — `Analysis of High-Performance Video Ad Hooks for Cold Audiences.md`

**Enforcement — 🔴 HARD.** Count spoken words across all scenes; divide by target seconds.

**Already built.** `wordBudgetForSeconds()` in `server/_core/conceptAxis.ts` encodes the
per-duration table (30s → min 75 / target 80 / max 90), and `validateScriptStructure()` raises
`script_length_over_budget` when total words exceed `budget.max`. **The ceiling half of R1 is
done.** The floor half is not — see §R9.

**Note on which table.** Three reports give slightly different bands (30–40 vs 30–45 at 15s;
75–85 vs 75–90 at 30s). The code took the conservative range with the higher max, which is the
right call and is already documented at the constant. Do not re-litigate it per-script.

---

# R2 · The script must be written short of the slot — the Buffer Rule

**The defect.** No buffer applied. The scripts filled the full duration, leaving no room to breathe.

**The research.**
> *"Buffer Rule: Time the script to read **2-3 seconds shy** of the final recording time to allow
> for talent emphasis."*
> — `Analytical Report_ Calibrating Spoken Tone for Video Ad Performance.md`

> *"Without these pauses, the script becomes a 'garbled ear-full' that confuses the listener and
> destroys conversion."*
> — `Analysis of High-Performance Video Ad Hooks for Cold Audiences.md`

**Enforcement — 🔴 HARD.** The budget is computed against `seconds - 2`, not `seconds`.

**Already built, and easy to double-count.** The buffer is **baked into `WORD_BUDGET_TABLE`
already** — the table comment states scripts are written 2–3s shy of the slot, and the fallback
branch computes `Math.max(0, seconds - 2) * 3` explicitly. ⚠️ **A new buffer check must not subtract
the buffer a second time.** If a generator applies its own 2-second haircut on top of the table, a
30-second script targets 84 words of budget against a 90-word cap it has already been trimmed for,
and every script drifts short. The buffer is a property of the table, not of the caller.

---

# R3 · The turn arrives at three seconds, not at the one-third mark

**The defect.** V1 placed the reframe at the one-third point — around **eleven seconds late** on a
thirty-second script.

**The research.**
> *"Once your hook ends at the 3-second mark, you must immediately bridge into the body."*
> — `Scripting the _Messy Middle__ Maintaining Attention in Talking-to-Camera Video Ads.md`

> *"the first three seconds of a video ad constitute the 'first handshake' with a cold prospect …
> a non-negotiable decision point."*
> — `Analysis of High-Performance Video Ad Hooks for Cold Audiences.md`

**Enforcement — 🔴 HARD, if scenes carry timings.** The hook scene's spoken content must fit three
seconds — which at three words per second means **the hook is a word-count constraint, not a timing
one** (see R4). Assert: scene[0] is the hook, and scene[1] begins by 3s.

**What is built.** `validateScriptStructure()` already asserts `scenes[0].sceneType === "hook"`. It
does **not** constrain the hook's length or the position of the second beat. That is the gap.

**The generator-shaped version of this rule.** Do not ask the model for "a hook at the start" —
ask for **a hook of at most ten words** (R4) followed immediately by a bridge (R4b). The three-second
mandate is not directly expressible to a text model; the word count is.

---

# R4 · The hook is under ten words, and R4b · an authoritative bridge follows it

**The defect (two halves, graded together).** V1 had no bridge at all — the hook ran straight into
explanation with nothing marking the turn.

**The research.**
> *"Intro Word Count: Is the spoken word count for the introductory segment under 10 words?"*
> — `Analysis of High-Performance Video Ad Hooks for Cold Audiences.md`, the report's own checklist

> *"you must immediately bridge into the body using an authoritative transition like 'Here's how,'
> 'Watch this,' or 'I literally guarantee it'."*
> — `Scripting the _Messy Middle__ Maintaining Attention in Talking-to-Camera Video Ads.md`

**Enforcement — R4 is 🔴 HARD.** `countWords(scenes[0].spokenLine) <= 10`. Directly measurable,
trivially checkable, and currently unchecked. **This is the single highest-value validator addition
in this document** — it is deterministic, it has an explicit numeric threshold stated in the
research, and it constrains the one beat that decides whether anything else is seen.

**Enforcement — R4b is 🟡 JUDGEMENT, with an absence screen.** A bridge is a rhetorical move, not a
string. A closed list of transition phrases would be gamed instantly by a model that learns the
list, and would reject a good bridge phrased a new way. **Screen for absence only:** if scene[1]'s
opening contains none of a broad transition set, flag for review rather than reject. Do not report
the presence of "Here's how" as proof of a bridge.

⚠️ **`"I literally guarantee it"` is quoted in the research and must NOT be carried into a
prompt for this campaign** — see §D2. The research's own example collides with a hard compliance
constraint. A generator that lifts the research examples verbatim will emit a guarantee.

---

# R5 · Something must be withheld — the open loop

**The defect.** V1 named the four patterns and then explained them. Nothing was left to resolve, so
there was no reason to click.

**The research.**
> *"creators must 'open a loop' in the viewer's subconscious."*
> — `Analysis of High-Performance Video Ad Hooks for Cold Audiences.md`

> *"Once tension is created through a mystery … it must be resolved by the second beat with a
> benefit-driven explanation."*
> — same report

**Enforcement — 🟡 JUDGEMENT.** There is no machine test for "was something withheld".

**The prompt shape that works** — stated positively, per §14:
> *Name the thing. Do not explain it. The viewer should finish the ad knowing that a specific
> answer exists and that they do not have it.*

**The tension a generator must hold, and the reason this is genuinely hard.** R5 says withhold; the
research also says the second beat must *resolve* the tension. Those are not contradictory but they
are easy to collapse in either direction — resolve nothing and the ad is a tease, resolve everything
and there is no click. The worked example threads it: *"There are four of them. One of them is
yours"* — the **category** is resolved, the **instance** is withheld. **Record that as the shape:
resolve the kind, withhold the which.**

---

# R6 · A physical anchor in the opening seconds

**The defect.** No object in any v1 script.

**The research.**
> *"High-performance creative often utilises visual and verbal interrupts, such as the presentation
> of a 'weird object' (e.g., a thumb drive or unique physical tool). Strategically, this object
> serves as a physical anchor for the loop; it creates an immediate psychological need for
> resolution."*
> — `Analysis of High-Performance Video Ad Hooks for Cold Audiences.md`

> *"The 'Visual Loop': Incorporating 'mystery objects' … creates a psychological loop in the
> viewer's mind that they feel compelled to finish."*
> — `Analysis of Conversational Calls-to-Action in Video Advertising.md`

> *"Does the loop open in under one second using a physical anchor?"* — the report's own checklist

**Enforcement — 🟡 JUDGEMENT, but with a 🔴 structural half.** Whether an object is a *good* anchor
is judgement. Whether the script **specifies one at all** is a field: if the schema carries
`visualDirection` or an `anchorObject` on the hook scene, its non-emptiness is hard-checkable. **Make
it a field and half the rule becomes deterministic.**

**The calibration the worked example provides.** The three anchors chosen were a **passport**, a
**single business key**, and a **household notebook** — each one an object the target already owns
and already has feelings about. That is a materially better rule than the research's own "thumb
drive", and it should go into the prompt: *an ordinary object from the viewer's own life, held up
and then set down.* The research example is a gadget; the worked example is a possession. **Prefer
the worked example.**

⚠️ **R6 applies only where an anchor is shootable.** In the worked set the anchors appear on the
50-second Feed cuts and **not** on the 30-second Reels cuts, which open straight to camera
mid-sentence. A generator must not demand an object on every script — see the shot list in
`video-ad-scripts.md` and the constraint in `shooting-guide.md`.

---

# R7 · Name-dropping an authority

**The defect.** No authority named in v1.

**The research.**
> *"The 'Authority' Validation: Name-dropping reputable brands or industry leaders (e.g., Tony
> Robbins, ClickFunnels, or Gym Launch) functions as a 'bet' that the viewer can trust the offer.
> This leverages external proof to lower the perceived risk of the micro-commitment."*
> — `Analysis of Conversational Calls-to-Action in Video Advertising.md`

**Enforcement — 🟡 JUDGEMENT, and heavily constrained.**

**This rule is already governed by existing code and must not be re-derived.** `SCRIPT_SAFETY` in
`server/_core/scriptPromptCraft.ts` states:
> *"Name a real person or brand only if the coach's material named them first."*

That is the correct and sufficient constraint, and it is live. **A name-drop requirement must be
expressed as a conditional on that:** *if the coach's material names a credible authority, use it;
otherwise build authority from the coach's own verifiable credentials.*

**The worked example took the second branch deliberately** — see §D1. It substituted the coach's own
checkable facts ("twenty-five years, fifty-two countries") for a celebrity name. **A generator
should treat the coach's own credentials as the DEFAULT authority source and a third-party name as
the exception,** which is the inverse of how the research frames it. The research assumes a
borrowed name is always available and always safe. Neither holds.

---

# R8 · The awareness stage must be a real Schwartz stage

**The defect.** The v1 brief labelled the audience **"problem-unaware"**, which is not a stage in
the taxonomy. Because length is prescribed *per stage*, an invalid label produced **two opposite
length verdicts** depending on which real stage it was read as.

**The research.**
> *"**Problem-Aware** → 30-60s → This duration allows for the validation of the user's struggle."*
> *"**Unaware** → 60-90s → Educational explainers are required to pull cold audiences through
> multiple stages of awareness within a single creative asset."*
> — `Strategic Report_ Optimising Meta Video Ad Lengths for the 2026 AI Ecosystem.md`

**Enforcement — 🔴 HARD.** The stage is an enum. `AwarenessStage` in `conceptAxis.ts` already
defines exactly five: `unaware`, `problem_aware`, `solution_aware`, `product_aware`, `most_aware`.
**Any string outside that set is a validation error, not a synonym to be resolved.**

**This is the most mechanically preventable defect in the list** — and it is also the one with the
widest blast radius, because stage drives length, hook pattern
(`CANDIDATE_HOOK_AWARENESS_MAP`), and tone. One bad label corrupts three downstream decisions.

**See §O1 — the ambiguity is not fully settled and blocks a generator from picking a length.**

---

# R9 · The word budget has a FLOOR, and nothing checks it

**Not one of Arfeen's eight. Found while writing this document, by measuring the banked scripts
against the code's own table rather than reading their self-reported figures.**

`video-ad-scripts.md` reports all six scripts as comfortably compliant, presenting low
words-per-second as unambiguously good:

> *"All six sit under the three-words-per-second ceiling with the buffer applied — comfortably,
> which means you have room to take the pauses rather than race the clock."*

**Measured against `WORD_BUDGET_TABLE`, all three 30-second scripts are UNDER the floor:**

| script | measured spoken words | 30s band | verdict |
|---|---|---|---|
| Professionals 30s | 67 | 75–90 | ⚠️ **below min** |
| Entrepreneurs 30s | 69 | 75–90 | ⚠️ **below min** |
| Women 30s | 72 | 75–90 | ⚠️ **below min** |

(Counts taken from the document text; they run ~2 words above the document's own table, which does
not change the verdict — all three are short either way.)

**And `validateScriptStructure()` would pass every one of them,** because it tests
`totalWords > budget.max` and never `totalWords < budget.min`. The floor exists in the data and is
read by nothing.

**Why this is the same shape as everything else in this repo's standing laws.** The absence of an
over-budget hit was read as correct length. A script at 40 words for a 30-second slot — two thirds
of the slot silent — passes the validator exactly as cleanly as one at 85. **No failure reported,
read as no failure** (§15-PARENT).

**Enforcement — 🔴 HARD.** Add `script_length_under_budget` on `totalWords < budget.min`. The
constant already exists; only the comparison is missing. **This is a two-line change and it is the
cheapest item in this document.**

⚠️ **Do not use R9 to "correct" the banked scripts.** They were written for a human to perform with
deliberate pauses, and Arfeen's judgement that they read well is the calibration this folder exists
to preserve. R9 says the *generator* needs a floor, and it also raises a real question — see §O2.

---
---

# Deliberate departures — decisions, not omissions

**A generator must know these two rules were considered and declined.** Recorded here so a future
session does not "fix" them back in, and so the generator can distinguish *a rule not applied* from
*a rule not known*.

## D1 · No celebrity name-drop beside this offer

**The rule declined:** R7's name-dropping prescription.

**Arfeen's reasoning, recorded from the source document:**
> *"You have a genuine Tony Robbins endorsement and the research says to use it. I've used your own
> credentials instead, because a celebrity name adjacent to a crypto offer reads as endorsing the
> crypto."*

**The endorsement is real and is now correctly held in the system** — testimonial id 14, tagged
`scope: coach_portable`, `source: coach_supplied`, and rendering in the coach band of landing page
243. So this is not a fabrication question. It is a **placement** question: a genuine endorsement of
the coach, placed beside a financial offer, reads as an endorsement of the offer.

**Generator rule.** A portable coach testimonial is available to every asset **except** where the
offer is in a regulated category. **Category, not truth, is the gate.** The same quote that is
correct on a coaching page is a liability on a crypto ad.

## D2 · No bold guarantee, no "Vegas bet"

**The rule declined:** the risk-reversal pattern.

**The research:**
> *"This 'Vegas bet' mechanism involves making a bold guarantee — comparable to slapping $100,000 on
> a table — to demonstrate extreme confidence in the results."*
> — `Analysis of Conversational Calls-to-Action in Video Advertising.md`

**Why declined:** it requires promising an outcome. This campaign cannot promise one under Meta's
financial-claims rules or UAE regulation. The research prescribes it for hot audiences; these are
cold. Both reasons stand independently.

**Generator rule.** The guarantee pattern is **unavailable when the offer touches money,
investment, or income** — regardless of awareness stage. This must be a hard gate, not prompt
guidance, because the pattern is attractive, it is explicitly prescribed by the research the
generator is grounded in, and one of the research's own bridge examples
(*"I literally guarantee it"*, quoted at R4b) smuggles it in through a rule about something else
entirely. **The compliance layer must catch it even when the copy rules invite it.**

---
---

# Open items — must be settled before a generator picks a length

## O1 · The awareness-stage mapping for this audience is unresolved

**Status: OPEN. Blocks automatic length selection.**

The ad brief used **"problem-unaware"**, which is not a Schwartz stage (R8). It has to resolve to
one of the five, and the two candidates give different lengths:

| reading | research length | rationale |
|---|---|---|
| **Unaware** | 60–90s | the buyer does not know the category or the problem frame exists |
| **Problem-Aware** | 30–60s | *"allows for the validation of the user's struggle"* |

**`video-ad-scripts.md` argues for Problem-Aware:**
> *"your buyer feels the pain — capped salary, nothing building — but doesn't know the answer.
> That's Problem-Aware, not Unaware."*

**That reading is defensible and probably right, but it is not settled**, because
`ad-copy-brief.md` builds the *copy* on the opposite premise — its whole retrieval strategy is
category-agnostic language reaching people **outside** the category, which is Unaware behaviour.
**The two documents in this folder disagree with each other**, and both are post-grading.

**The complication that makes it moot today, and won't tomorrow.**
`PLACEMENT_SAFE_CEILING_SECONDS = 30` caps *every* stage to 30 seconds, so `unaware` (ideal 60–90)
and `problem_aware` (ideal 30–60) currently produce **the same 30-second output**. The distinction
is invisible in the generator's present behaviour. It becomes load-bearing the moment
`TWO_CUT_ENABLED` is switched on — at which point the parked long-Feed cut is 60s under one reading
and 90s under the other.

⚠️ **A green run today therefore proves nothing about O1.** The cap hides the disagreement. This is
precisely a check that cannot fail (§15c): the length selector cannot currently be observed making
a wrong choice, because every choice is overwritten by the ceiling.

**What settles it:** Arfeen's call on whether the buyer knows they have a *wealth-building* problem
(→ problem_aware) or only feels a *financial unease* they have not yet framed as a problem
(→ unaware). Product decision, not a technical one.

**Interim position:** the worked set is labelled Problem-Aware and shipped at 30s, which is valid
under both readings given the cap. **Do not enable `TWO_CUT_ENABLED` until O1 is answered.**

## O2 · Does the floor apply to a script written for deliberate pauses?

Raised by §R9 and genuinely open.

The word-count table assumes a continuous read at roughly three words per second. The banked scripts
are written to be *performed*, with marked pauses ("*Pause after 'yours.' Two full beats.*") that
consume slot time without consuming words. Under that style, 67 words in 28 seconds may be correct
rather than short.

**The question a generator cannot currently answer:** does the floor measure *words*, or *words
plus scripted pause time*? If a script carries explicit pause directions, a naive floor check
penalises exactly the craft the worked example demonstrates.

**Recommendation:** implement the R9 floor as a **warning, not a rejection**, until the schema can
represent pause duration. A hard floor shipped today would reject all three of the human scripts
this folder banks as the quality bar — which is the clearest possible signal that the check is not
yet ready to be a gate.

---
---

# Summary — what to build, in order of cost

| # | requirement | class | status | cost |
|---|---|---|---|---|
| R9 | word-count **floor** (`< budget.min`) | 🔴 HARD | ❌ missing, constant exists | two lines |
| R4 | hook ≤ 10 words | 🔴 HARD | ❌ missing | small, high value |
| R8 | stage must be a valid enum member | 🔴 HARD | ⚠️ enum exists; reject unknown strings | small |
| R1 | pace ≤ 3 w/s (ceiling) | 🔴 HARD | ✅ built (`script_length_over_budget`) | — |
| R2 | buffer 2–3s shy of slot | 🔴 HARD | ✅ built into the table — **do not double-apply** | — |
| R3 | second beat by 3s | 🔴 HARD* | ⚠️ partial (hook-first only) | needs scene timings |
| R6 | physical anchor | 🟡 + 🔴 half | ❌ missing | needs a schema field |
| R4b | authoritative bridge | 🟡 | ❌ missing | absence screen only |
| R5 | open loop | 🟡 | ❌ missing | prompt only |
| R7 | authority name | 🟡 | ✅ governed by `SCRIPT_SAFETY` | conditional only |
| D1 | no celebrity beside a regulated offer | 🔴 gate | ❌ missing | category gate |
| D2 | no guarantee on a money offer | 🔴 gate | ⚠️ partial in compliance layer | hard gate |

**The three cheapest items — R9, R4 and R8 — are all 🔴 HARD, all have their constants already in
the codebase, and together they close the two defects with the widest blast radius.** Build those
first.

**And build the negative control alongside each** (§15c): feed the validator a 40-word 30-second
script, a twelve-word hook, and the string `"problem-unaware"`, and watch all three be rejected. A
validator that has never seen these fail is untested.
