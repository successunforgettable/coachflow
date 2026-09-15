# INVESTIGATION — `copywritingRules.ts` for decision D-b (2026-09-16)

**Status: investigation only. `copywritingRules.ts` is NOT edited.** Arfeen asked for three things before deciding D-b:
1. the specific proposed change;
2. what the file says today that causes the D-c problem;
3. what would change across its importers.

---

## 0. Short answer

- **One correction to the question.** `copywritingRules.ts` does not block anything; it is prompt text. What blocks is a checker.
  - Under **D-c**, unspecific narrative colour is allowed and only *specific invented biography* blocks, so the file's "a moment the
    coach lived" wording no longer conflicts with any checker.
  - The real problem is the other direction: **the file asks for specific, precise lived detail, and requires sourcing only for
    figures, results and named people.** Age, family, past roles, employers, dates and places — every invented fact in kit 225's
    script 229 — are not named anywhere as needing a source.
- **The proposed change is additive:** +48 words in `REGISTER_STANDARD` and +27 in `registerPersonGuidance(false)`. Nothing is removed.
  All 17 patterns pinned by `registerStandard.test.ts` still match.
- **It must NOT ship on its own.** The new sentence points the model at "the coach facts supplied above", a block no prompt carries
  until F1 is wired into generation (sprint 3). Shipped earlier, it points at nothing.
- **It reaches 11 of the 19 files** that mention `copywritingRules`. 8 import other exports only and are unaffected.
- **One unresolved conflict**, created by today's retry-note instruction (§4).

---

## 1. What the file says today (verbatim)

**`REGISTER_STANDARD`, paragraph 2** (`copywritingRules.ts:127-131`):

> Concrete and specific is the goal. Intensity, stakes and emotional weight all
> belong here in full — they are carried by the precise detail of a moment the coach
> actually lived, by the cost they paid, and by what the method changes. The detail
> comes from THIS coach's own material, never from an example: a borrowed moment
> reads as invented because it is. Specificity is what makes copy land; keep it.

**`registerPersonGuidance(false)`, the no-proof branch** (`copywritingRules.ts:200-204`):

> PERSON — first person throughout. This copy is built from the coach's own
> experience, the method itself, and what the offer does: the moment they remember,
> the shift the method creates, what makes the approach different, and what a working
> week looks like once it lands. Every figure, result and named person in the copy is
> one that appears in the supplied material above.

### Why these produce invented biography

1. **They demand precision** ("concrete and specific is the goal", "the precise detail of a moment the coach actually lived") without
   saying where the facts inside that moment come from.
2. **The sourcing rule is a closed list:** figures, results, named persons. A coach's age, children, former employer, job title, years
   in a role, a year or a place are none of these. The model is asked for specificity and given no source for those facts, so it
   supplies them.
3. **"THIS coach's own material" is satisfied by generated text.** The prompt carries the cascade (ICP prose, expandProfile fields),
   which the model cannot tell apart from what the coach typed (the grounding check, `THREADB_GROUNDING_CHECK_2026-09-15.md`).

---

## 2. The proposed change — before / after

Additive only. Every existing sentence stays, verbatim.

### `REGISTER_STANDARD`, paragraph 2

**BEFORE**
```
Concrete and specific is the goal. Intensity, stakes and emotional weight all
belong here in full — they are carried by the precise detail of a moment the coach
actually lived, by the cost they paid, and by what the method changes. The detail
comes from THIS coach's own material, never from an example: a borrowed moment
reads as invented because it is. Specificity is what makes copy land; keep it.
```

**AFTER**
```
Concrete and specific is the goal. Intensity, stakes and emotional weight all
belong here in full — they are carried by the precise detail of a moment the coach
actually lived, by the cost they paid, and by what the method changes. The detail
comes from THIS coach's own material, never from an example: a borrowed moment
reads as invented because it is. Facts about the coach's own life — their age, family,
past roles and employers, years in a role, places and dates — come only from the
coach facts supplied above; where none are supplied, the moment is told through
what happened, what the coach noticed and what changed.
Specificity is what makes copy land; keep it.
```

### `registerPersonGuidance(false)`

**BEFORE**
```
... Every figure, result and named person in the copy is
one that appears in the supplied material above.
```

**AFTER**
```
... Every figure, result and named person in the copy is
one that appears in the supplied material above, and every fact about the coach's own
life — age, family, past roles, employers, dates, places — is one that appears in the
coach facts supplied above.
```

### Checks already run on the AFTER text (proposal only; the file is untouched)

| check | result |
|---|---|
| `registerStandard.test.ts` pins: 7 required phrases + 5 banned negative framings on `REGISTER_STANDARD`, and 2 required + 3 excluded on `registerPersonGuidance(false)` | **17 / 17 satisfied.** A first draft failed 1 (it line-wrapped "Specificity is what makes copy land"); corrected above |
| §14 / §14a: could the model reproduce the added text as copy? | **No.** No quoted phrases, no digits, no first-person example sentence. It names categories, not a wrong shape |
| D-c | **Consistent.** "The moment they remember" and "what happened, what the coach noticed and what changed" keep unspecific narrative colour available. Only the *facts inside* a moment are sourced |
| §6a (first person is the guardrail) | **Preserved.** Voice unchanged |
| `leadMagnetOfferMode.test.ts` | **Unaffected.** It strips `REGISTER_STANDARD` from prompts by splitting on the imported constant, so it follows any wording automatically |

---

## 3. Blast radius — every file that mentions `copywritingRules`

Occurrences counted outside import lines.

| file | `REGISTER_STANDARD` | `registerPersonGuidance(` | affected by this change |
|---|---|---|---|
| `adCopyGenerator.ts` | 6 | 8 | **yes**: ad bodies, headlines, image hooks, rewrites |
| `conceptGenerator.ts` | 1 | 1 | **yes**: concepts (feed live ads) |
| `conceptScriptGenerator.ts` | 1 | 1 | **yes**: video scripts |
| `landingPageGenerator.ts` | 1 | 1 | **yes**: landing pages |
| `headlinesGenerator.ts` | 2 | 0 | **yes**: `REGISTER_STANDARD` only |
| `routers/compliance.ts` | 2 | 0 | **yes**: the compliance rewrite endpoint (`rewordForAdvisory`) |
| `adCopyAngles.ts` | 1 | 0 | **yes** |
| `emailSequenceGenerator.ts` | 1 | 0 | **yes** |
| `whatsappSequenceGenerator.ts` | 1 | 0 | **yes** |
| `hvcoGenerator.ts` | 1 | 0 | **yes**: lead-magnet titles |
| `offersGenerator.ts` | 1 | 0 | **yes** |
| `_core/complianceRewrite.ts` | 0 | 0 | no (imports other exports) |
| `_core/mechanismStandard.ts` | 0 | 0 | no |
| `heroMechanismsGenerator.ts` | 0 | 0 | no |
| `leadMagnetContentGenerator.ts` | 0 | 0 | no |
| `routers/landing.ts` | 0 | 0 | no |
| `routers/services.ts` | 0 | 0 | no |
| `routers/sourceOfTruth.ts` | 0 | 0 | no |
| `_core/offerStandard.ts` | 0 | 0 | no (mentions the file; imports nothing) |

**11 files change, 8 do not.** The earlier "19 importers" figure counted every file mentioning the module; 18 import it and 11 use
the two exports this change touches.

**What changes in those 11:** every prompt carrying `REGISTER_STANDARD` gains one sentence; every no-proof prompt carrying
`registerPersonGuidance(false)` gains one clause.
- Expected effect: fewer invented biographical facts.
- Expected cost: where a coach has supplied no facts, copy is less biographical and describes moments through events and change
  rather than personal particulars. **Neither effect is measured.** Sprint 0b's dry runs are the instrument for that, before the
  change ships.

**Tests to update:** none required by the proposed wording (§2). The change would still need the full checker and pipeline gate run,
plus a new pin that the biography sentence is present.

---

## 4. Conflicts and dependencies found

### ⚠️ C1 · Retry notes stay as they are, so the retry path will keep asking for biography

Arfeen ruled today that live retry-note behaviour stays untouched (the quoting ruling governs new code only). **Several live retry and
correction texts outside `copywritingRules.ts` steer toward the coach's experience with no sourcing clause:**

| live text | what it says |
|---|---|
| `fabricationValidator.ts:375` `buildFailContext`, the retry note after a fabrication block | "Where the supplied material does not carry one, the copy speaks from the coach's own experience — the moment they remember…" |
| `complianceAxis.ts:843, 895, 910, 1139`, finding descriptions that feed retry notes | "Told as a moment the coach lived…", "The same point lands as the coach's own experience" |
| `publishBlockMessage.ts:48`, shown to the coach | "Rewrite it to speak from your own experience and what the programme does" |

**If `REGISTER_STANDARD` changes and these do not:**
- the first draft is told to source biographical facts;
- a blocked draft's retry is told to reach for "the coach's own experience", unqualified.

That is script 229's shape, arriving on the retry.

🟡 **Needs a ruling:** does "leave retry-note behaviour untouched" cover only *quoting* flagged text, or all retry-note *wording*?
- If the latter, F3 loses half its scope and this divergence is accepted.
- If the former, adding the same sourcing clause to these texts is allowed.
- Nothing is changed until ruled (CLAUDE.md §15g).

### C2 · The change depends on sprint 3

"The coach facts supplied above" names a block F1 will add to prompts. No prompt carries it today. **Ship this edit in the same sprint
that adds the coach-facts block** (sprint 3 wiring / sprint 5 F3), never before.

### C3 · A second source of the same push, outside this file

`scriptPromptCraft.ts:96-101` (`META_COMPLIANCE`, video scripts only) routes "health, body, age, financial standing, background" into
"the coach's own account of their own experience", and carries a first-person example with a family fact ("the morning I went to pick
my toddler up and my back said no").
- Not part of `copywritingRules.ts`, and not a retry note.
- It belongs to F3 (sprint 5), and needs its own before/after when that sprint is scoped.

---

## 5. What Arfeen is deciding

**D-b:** whether to authorise the §2 wording, to ship bundled with the sprint that adds the coach-facts block to prompts (C2).
**Plus the C1 ruling.**
