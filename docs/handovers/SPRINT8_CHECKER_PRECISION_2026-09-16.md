# Sprint 8 — lexical checker precision (2026-09-16)

**Build plan:** `BUILD_PLAN_SCRIPT_QUALITY_AND_GROUNDING_2026-09-16.md` §1 K10, §2 Phase B track B1.
**Evidence:** addendum §4 and §6, capture 2 §2a.
**Scope:** `server/_core/complianceAxis.ts` only, plus the new test file `server/_core/complianceCheckerPrecision.test.ts`.
**Not touched:** prompts, UI, `copywritingRules.ts`, `client/src/pages/`, and every description / failContext string.
**Production access:** none. No `railway` command and no database access.

§15j holds: no term, class, check or list entry was removed. Each narrowing is paired with measured true positives that still block.

---

## 0. Prior art

- `git log --all -S` for `conviction`, `can't afford`, `CLINICAL_OUTCOME_VERB`, `CRYPTO_TERMS` and `digital asset`: no earlier fix and no revert.
- `CLINICAL_OUTCOME_VERB` and the widened crypto check came in with `7c93d84` and have not changed since.
- The other hits are the original axis commit (`c541405`), fixture text (`d593331`), and docs.

## 1. Baseline and after

Both measured at run time, in this worktree, on `35baeb1` (§15f).

| gate | before | after |
|---|---|---|
| `npx tsc --noEmit \| grep -c "error TS"` | **34** | **34** (0 in touched files) |
| `server/_core/complianceAxis.test.ts` | 48 ✓ | 48 ✓ |
| `server/complianceGate.test.ts` | 24 ✓ | 24 ✓ |
| `server/_core/complianceScalePrecision.test.ts` | 30 ✓ | 30 ✓ |
| `server/fabricationGateDefects.test.ts` | 15 ✓ | 15 ✓ |
| `server/pipeline-fixes.test.ts` | 414 ✓ | 414 ✓ |
| `server/lib/complianceFilter.test.ts` | 31 ✓ | 31 ✓ |
| `server/_core/tokenCrypto.test.ts` | 10 ✓ | 10 ✓ |
| other suites importing the axis¹ | 104 ✓ | 104 ✓ |
| **new** `server/_core/complianceCheckerPrecision.test.ts` | 37 ✓ / **26 ✗** (fixtures written before the change) | **63 ✓** |

¹ Run as an extra check: trackRecordClaims 15, fabricationValidator 23, node5Screening 16, conditionSensePrecision 14, promisedResultPrecision 27, landingPageActiveAngle 9.

No existing test was edited.

---

## 2. The four fixes

### Fix 1 · `clinical_outcome_claim` — adjacency

**Defect.** Check 10 fired when a verb from `CLINICAL_OUTCOME_VERB` and a protected term appeared anywhere in the same field.

**Now: `clinicalOutcomeMatch`.** The condition must stand in one of two positions:
- **Object:** within the next 6 words, before a clause boundary. The boundaries are `. ! ? ; :`, a newline, or but / so / because / while / although / though / whereas / unless / until / if / when.
- **Subject:** ending the clause right before the verb, with only auxiliaries (is / can be / will / …), commas or dashes in between.

A verb joined by a hyphen (`fixed-rate`, `Reverse-Map`) is a compound modifier, and is skipped. The verb list, the vocabulary, the class, the description and the matched format (`verb … cond`) are all unchanged.

**Must still block.** Each was measured blocking via check 10 on `35baeb1`:
- reverse your diabetes
- this protocol cures anxiety
- fix your back pain for good
- get rid of eczema
- Heal your gut health in 30 days
- we fix your anxiety
- Your eczema, healed.
- Your diabetes can be reversed.
- anxiety cured
- eliminate your debt
- cure your migraines
- get rid of the bloating for good
- Your savings, fixed. (the §15k artefact: the same words in one clause still reach the rule)

**Must pass:**
- Savings. Fixed deposits.
- Most money just sits in savings. A fixed rate is not the point.
- I kept my own savings in a fixed deposit for years.
- a fixed-rate savings account
- a fixed-price package and fixed income (both already passed on `35baeb1`: no protected term)

The two measured inputs now get the same verdict as one field and as two fields.

**Not pinned, recorded:** `heal your gut in 30 days` **did not block on `35baeb1`**. Bare "gut" is not a listed term; only "gut health" and "leaky gut" are. This sprint does not widen it.

**Consequence to know.** `Your savings are sitting in a fixed deposit doing nothing.` blocked before only as check 10 ("fixed … savings"), which was the wrong reason. It **no longer blocks at all.** Per addendum §4 it should block as viewer financial information, and that detector is F5 (sprint 2), which does not exist yet. The test asserts only that check 10 no longer reports it.

### Fix 2 · the "can't afford to" idiom

**Now.** `AFFORD_IDIOM_GUARD` is a negative lookahead on the `can't afford` / `cannot afford` terms. It sits inside `termRe`, so every consumer agrees. It skips an occurrence followed by `to` plus a verb from a closed list:
- wait, ignore, guess, delay, overlook, hesitate, postpone, procrastinate;
- get this / it / that wrong;
- make a / another / the same mistake(s).

"miss", "lose", "risk", "waste" and "not" were left out on purpose, because each has a money reading ("miss a payment", "lose your home").

**Must pass.** All blocked on `35baeb1` except the third, which already passed because it has no "you":
- You can't afford to get this wrong.
- you can't afford to wait
- we can't afford to ignore this
- It accounts for the fact that you can't afford to get this wrong. (capture 2, verbatim)
- you cannot afford to get this wrong.

**Must still block.** Each measured blocking on `35baeb1`:
- you can't afford rent
- you can't afford it right now
- you can't afford to pay rent
- you can't afford to lose your home
- You're stuck in debt and you can't afford another year of this.

**Not pinned, recorded:**
- `Can't afford the course?` **did not block on `35baeb1`** and is not widened.
- `you can't afford not to` and `you can't afford to lose another client` blocked before and still do.
- The typographic apostrophe `can’t afford` never matched the list before this sprint either, and is unchanged.

### Fix 3 · "conviction" — certainty sense

**Now.** `CONVICTION_CERTAINTY_GUARD` is a negative lookbehind. It skips `with conviction` and `with <intensifier> conviction`, where the intensifier comes from a closed list (real, actual, genuine, quiet, deep, …). A determiner defeats it, so `with a conviction` still matches. The guard applies per occurrence, not per sentence.

**Must pass.** All blocked on `35baeb1` except the second, which already passed:
- an answer you can say with conviction
- say it with real conviction
- It ends with an answer you can say with conviction. (capture 2, verbatim)
- A named role, a specific type of organisation, an answer you could say out loud with actual conviction. (capture 2, verbatim)
- you can say it with conviction

**Must still block.** Each measured blocking on `35baeb1`:
- you have a criminal conviction
- Your conviction still follows you into every interview.
- you're living with a conviction (the §15k artefact: "with" + a determiner)
- Worried your conviction will show up on a background check?
- Still carrying the weight of your conviction years after release?

⚠️ Mutation M3b shows that the last line blocks through another term. It is kept as a regression pin, but it is **not** evidence for the conviction rule.

**Asked for in the brief:**
- `a criminal conviction`, `even with a conviction on your record` and `spent convictions` **did not block on `35baeb1`.** The rule sees no "you" before the term, and "your" after it does not satisfy `\byou\b`. Not widened.
- **`your convictions` (beliefs) blocked on `35baeb1`**, and the brief said to keep that verdict. It is pinned as still blocking, together with `Stand by your convictions.`

**Still open, out of scope:** belief-sense false positives in real copy with no "with", for example `The conviction that you can't write is almost never about writing.` (bonus 35). They are unchanged; see §4.

### Fix 4 · crypto — "digital asset(s)"

**Now.** `cryptoTopicMatch` = `CRYPTO_TERMS` (unchanged) **or** `cryptoDigitalAssetMatch`. Both crypto checks, 4 and 8, use it.

An occurrence of `digital asset(s)` counts as the crypto topic unless one of these holds:
- it is followed by management / manager(s) / library / libraries;
- its **sentence** names a creative-file sense: templates, presets, logos, photos, images, graphics, fonts, icons, illustrations, mockups, printables, ebooks, brand(s) / branding, DAM, Canva, Lightroom, Etsy, stock photos / footage / images.

The topic still blocks nothing on its own. The existing `TRADE_ENDORSEMENT` and `CRYPTO_TRANSACTIONAL_RE` conjunctions decide.

**Now blocks.** All passed on `35baeb1`:
- start buying digital assets now
- grow your portfolio of digital assets before the price moves
- Here's which digital assets to buy before the next cycle.

**§15k artefacts:**
- `start buying now` and `grow your portfolio before the price moves` still pass without the term, so the new blocks come from the term.
- The education line plus an endorsement blocks, so the education line is read as crypto topic.

**Must pass.** All passed on `35baeb1`:
- digital asset management
- our DAM platform organises your digital assets
- sell digital assets like templates and presets
- your brand's digital assets (logos, photos)
- how digital assets work and how to think about risk
- **Learn how to sell digital assets like templates and presets.** (carries `to sell`)
- **Our digital asset management platform helps you profit from the files you already own.** (carries `profit from`)

The last two fail without the sense guard (mutations M4a and M4a2).

---

## 3. §15c mutations

Script: `mutate.py`, kept in the scratchpad. Each run edits the source, runs the new test file, then restores the file. The sha256 matched after every restore.

| mutation | result | what failed |
|---|---|---|
| **M1a** revert check 10 to field-wide co-occurrence | 14 ✗ | all 4 synthetic must-pass lines, field-split invariance, the savings/F5 line, all 8 real-copy fields |
| **M1b** disable check 10 | 13 ✗ | all 13 must-still-block lines |
| **M2a** remove the idiom guard | 4 ✗ | the 4 "you … can't afford to" must-pass lines (the "we" line has no reader anchor) |
| **M2b** remove the `can't afford` / `cannot afford` terms | 4 ✗ | rent · it right now · to pay rent · to lose your home (the debt line blocks on "debt") |
| **M3a** remove the conviction guard | 4 ✗ | the 4 "you … with conviction" must-pass lines |
| **M3b** remove the `conviction` term | 6 ✗ | 4 criminal-sense lines, the `your convictions` pin, the per-occurrence test. **Not** "Still carrying the weight…", which blocks via another term |
| **M4a** remove the creative-sense guard | 1 ✗ | Learn how to sell digital assets like templates and presets. |
| **M4a2** remove both sense guards | 2 ✗ | the two must-pass lines that carry an endorsement phrase |
| **M4b** remove the digital-asset match | 4 ✗ | the 3 now-blocks lines and the education §15k artefact |

📌 The sense-control lines without an endorsement phrase pass with or without the guard. They pin a verdict; they are not evidence for the guard. The two lines that carry an endorsement phrase are the ones that exercise it.

---

## 4. Corpus regression

`checkOutput` ran over every string leaf, one field per leaf, with no grounding. Sources:
- `server/__fixtures__/*.json` (9 files);
- `server/_core/__fixtures__/lead-magnets/*.json` (4 files);
- every string in the `timedClaimCorpus.ts` exports.

That is 280 fields in total.

| | fields blocked | blocking hits |
|---|---|---|
| before | 13 | 16 (clinical 8, protected-attribute 7, promised_result 1) |
| after | 8 | 8 (clinical 0, protected-attribute 7, promised_result 1) |

**Every changed verdict is the removal of a check-10 hit.** Nothing was added, and no other class moved.

| field | before, check 10 matched | why it was false, and why it no longer fires |
|---|---|---|
| live-bonus-43 `tools[3].content` | fix … pain | "has this client already tried to **fix this**?" is followed by `?`; "pain" is in another sentence. The field still blocks on its protected-attribute hit |
| raw-bonus-35-attempt2 `nextStep.body` | Reverse … pain | the product name "Client Psychology **Reverse-Map**" (hyphen); "pain" is elsewhere. **The field now passes** |
| raw-bonus-35-attempt3 `tools[2].content` | Reverse … pain | "Reverse-Map" (hyphen). Still blocks on "The conviction that you can't write…" (belief sense, out of scope) |
| trimmed-bonus-35 `tools[2].content` | Reverse … pain | "Reverse-Map" / "reverse-map" (hyphen). Still blocks on its protected-attribute hit |
| hvco-5686 `tools[0].content` | fix … diagnosis | "to **fix exactly that gap**": no term in the object. **Now passes** |
| hvco-5686 `tools[3].content` | Fix … fatigue | "**Fix:** add the specific observation" and "Fix the NO answers": a label and a checklist step. **Now passes** |
| hvco-5686 `nextStep.body` | fix … diagnosis | "The portfolio **fix** works", "**fixed** my Behance": no term in either clause. **Now passes** |
| hvco-7233 `sections[0].body` | fix … body | "What this means for **the fix:**" is a noun before `:`. **Now passes** |

No field in the corpus contains "digital asset", "can't afford to" or "with conviction". Fixes 2, 3 and 4 therefore change no corpus verdict, which the unchanged hits confirm.

---

## 5. Carried forward

- **K10:** any first-pass block rate measured before this commit includes the eight corpus-shape clinical false positives and the capture-2 idiom and conviction hits. Re-measure after; do not compare.
- **F5 (sprint 2)** is now the only route by which `Your savings are sitting in a fixed deposit doing nothing.` could block.
- **Blind spots not widened** (each measured passing before, and still passing):
  - heal your gut in 30 days
  - Can't afford the course?
  - a criminal conviction
  - even with a conviction on your record
  - spent convictions
- **Belief-sense "conviction" without "with"** (real bonus-35 copy) still blocks. A wider sense rule would need its own true-positive set.
