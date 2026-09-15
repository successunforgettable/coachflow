# ADDENDUM — six lessons from a six-round manual revision, folded into the proposed fixes (2026-09-16)

**Status: investigate-and-propose only. Nothing built.** It refines two earlier documents:
- `THREADB_FIX_SCOPING_2026-09-15.md`: P1 length, P2 repetition;
- `PROPOSAL_SPEAKER_FACT_GROUNDING_2026-09-15.md`: F1–F4 and sprints 1–7.

**Source of the lessons:** six rounds of hands-on revision on a three-script founder-voice set. It is personal marketing content, kept
off every ZAP branch; **this document carries no text from it**, only measured numbers and generic shapes. Every claim below was
re-checked against this repo, and each is marked ✔ where re-checked here. Throwaway probes live in the session scratchpad only: no
repo code, no DB writes.

---

## 0. Summary

| # | lesson | verdict after checking | changes |
|---|---|---|---|
| 1 | metrics-passing ≠ natural; sequencing matters | **confirmed and measurable.** The "choppy" round ran 35% fragments, with runs of 4; the human benchmark is 20%, runs ≤ 2. The live prompt stacks numeric constraints into the draft | **P1 amended:** a fragment-run brake, and draft-then-enforce **tested before it is chosen** (needs a script dry run) |
| 2 | wording fixes miss structural repetition | **confirmed, with a complication.** The human benchmark itself shares one beat order within each awareness stage, by design | **P2 extended:** a structural check is feasible, but only if scoped to the part that must differ. The rule needs a decision |
| 3 | a documented fact can be stale | **confirmed as a design gap.** No stored fact carries its own time; the current gate grounds *any* figure present anywhere | **F1 + F2 amended:** single-valued fact slots, latest coach-supplied value wins, a conflicting figure is flagged. F1 now needs a small facts store (a migration) |
| 4 | viewer-financial-information gap | **confirmed, and NOT covered by any existing scope.** Today's checker: 0 of 6 caught for the right reason | **NEW fix shape F5.** Shares F2's machinery, but it is a different rule, needs no corpus, and has a different enforcement tier |
| 5 | overstated certainty | **confirmed as a gap.** Nothing detects certainty, and the §14b timed-claim scanner is not wired to scripts or concepts | **F2 extended** with offer-outcome claims + a deterministic certainty comparison; **§14b scanning added to the script and concept paths** |
| 6 | known checker failures are systematic | **systematic by MECHANISM, not by recurrence.** The six rounds were not independent inputs (see §6) | **new scoped item:** lexical-checker precision (clinical adjacency, crypto vocabulary word sense), separate from F5 |

---

## 1. Natural first, numbers second

### Measured

**The live prompt puts numeric pressure into the draft itself** ✔:
- `conceptScriptGenerator.ts:95` and `:106` both state the word floor and ceiling;
- `:97` sets a per-scene word range;
- `scriptPromptCraft.ts:60` "HOOK (the opening, under ~10 words)";
- `:63` "one idea, one breath";
- `:119` "Short, breath-length sentences — one idea per breath".

**Spec §2.1 and §5.2 already record the mechanism** ✔: the research corpus "prescribes fragmentation in four separate documents and
nowhere says when to stop"; "the brake is external". §1.9's SD floor is the only brake proposed, and it fails two human scripts
(scoping §F).

**Cadence across sets.** Fragment = a sentence of ≤ 3 words; same sentence splitter as the benchmark instrument.

| set | sentences / 100 w | fragment share | longest fragment run | SD | contractions |
|---|---|---|---|---|---|
| human nine | 12.89 | **0.20** (max per script 0.33) | **2** (every script ≤ 2) | 4.6 | 5.94 |
| kit 225 (ZAP generated) | 8.98 | 0.10 | 3 (script 223) | 7.41 | 3.98 |
| manual set, round 3 | 7.22 | 0.03 | 1 | 11.56 | 3.87 |
| manual set, round 4: met the hook and 18-word ceilings, read as choppy | 13.11 | **0.35** (one script 0.48) | **4** (two scripts) | 5.32 | 8.13 |
| manual set, round 5 | 12.56 | 0.21 | 3 | 4.24 | 7.80 |
| manual set, round 6 | 12.27 | 0.19 | 3 | 4.40 | 7.53 |

**Reading:**
- **The choppy impression is measurable.** Round 4 passed the hook and sentence ceilings with a fragment share 1.75× the human mean
  and fragment runs twice the human maximum.
- **The ZAP generator fails in the opposite direction:** kit 225 is long-sentence, low-fragment. The same constraint set produces
  both failures depending on which pressure wins, so **a ceiling alone cannot be the whole enforcement**.
- **Longest fragment run is the cleanest separator in this data.** Every human script is ≤ 2; round 4 reached 4; kit 225's 223
  reached 3.

### How P1 changes

1. **Add a cadence brake beside the ceilings.** Longest fragment run ≤ 2 (human maximum); fragment share ≤ 0.33 (human maximum).
   Both are derived from the benchmark and **must be labelled as an invention of the spec** (§5.2). Deterministic; same pass as the
   hook and 18-word checks.
2. **Draft-then-enforce is a hypothesis for the generator, not a finding.** The evidence is a human editor's sequence, not model
   behaviour. The existing retry loop already enforces after the fact. The real question is whether **removing numeric targets from
   the drafting prompt** — describing the voice positively and leaving the counts to a validator plus a targeted trim retry —
   produces better first drafts.
   **Measure it before choosing, two arms on the same concepts:**
   - **(a)** today's constraint-in-prompt;
   - **(b)** natural-draft prompt + deterministic checks + a trim retry carrying post-hoc location/count failContext.

   **Compare** fragment share, longest run, SD, contractions, overlap, attempts, tokens, and gate pass rate.
3. **Prerequisite, not yet in any sprint:** a `dryRun` on the script generator, the same shape as `82d1949` for concepts.
   Without it, arm (b) cannot be measured without writing rows (P1 already noted "no script dryRun exists").
4. **A trim pass must never follow the gate.** Any rewrite can reintroduce a claim, so grounding (F2/F5) runs on the **final** text,
   in the same merged pass (unchanged from proposal §6).

**Confidence:** HIGH that the brake is measurable and separates the sets. MEDIUM that draft-then-enforce helps; hence measure first.

---

## 2. Structural repetition

### Measured

- **P2 as scoped** compares content-word overlap and 4-grams. It cannot see a shared beat order, and the manual rounds show rewording
  repeatedly left the order intact.
- **The complication.** The human benchmark shares one beat order across each same-stage triplet ✔:
  - **Unaware** (CP1 / CE1 / CW1): lived observation → "I did the SMB programme" → the coach → "free session this Sunday" → "Digital
    assets from zero / from the beginning, for …" → "Two hours" → "Link's below / underneath".
  - **Solution-aware** (CP3 / CE3 / CW3): read about crypto, never bought → no process → "On Sunday the coach's brother …" → "Seven
    years" → "The coach goes first" → "Two hours, free" → "Link's …".
- **The three benchmark scripts in a stage differ in their first half** (a different lived situation per audience) **and share the
  offer tail and the order.** Round 6 of the manual set has the same shape. So **"same beat order" alone would fail the benchmark
  the project treats as gold**, exactly as the literal 4-gram rule did (scoping §F).
- **Available signal:** each ZAP scene already carries a `sceneType` label ✔ (`conceptScriptGenerator.ts:132`). It is a **free
  string, not an enum**, and it is self-reported by the generating model (spec §3.2 rule 6: a self-report is not evidence about
  itself).
- **Kit 225's concepts already span awareness stages and hook patterns**, assigned by the concept generator.

### How P2 changes

1. **Scope the structural check to where sameness is a defect:** scripts in the **same awareness stage** within a set, and only the
   **differentiating half** (hook, problem, turn). The offer/logistics tail may share by design, as the benchmark does.
2. **Label beats independently, not from `sceneType`.** One extra field in the F2/F5 model call returns a beat label per sentence
   from a closed set (hook · problem · reframe · mechanism · credential · offer · logistics · CTA), each with a verbatim quote verified
   deterministically. The sequence comparison itself is deterministic (edit distance over the differentiating half).
3. **The threshold is undecided and must be calibrated.** Within-stage human triplets are the positive control; the manual rounds'
   identical-template versions (rounds 2–3, where the problem half also matched) are the negative control.
4. **Meaning-level duplication stays unmeasured** (spec §5.4). This check narrows the gap; it does not close it.

**Confidence:** MEDIUM that it is feasible with the extra label field. LOW on a threshold until calibrated.
🟡 **Decision for Arfeen (D-f):** is a shared offer tail and order within a stage acceptable, as the benchmark does, provided the
differentiating half differs?

---

## 3. A documented fact can be stale

### Measured

- **No stored coach fact carries its own time** ✔:
  - `updatedAt` is row-level (`users` `schema.ts:70`, `services` `:122`);
  - `coachBackground` is one text column (`:55`);
  - ladder answers are a plain `Record<string, string>` with no timestamp (`icpGrounding.ts:397-409`).
- **A row's `updatedAt` also moves when generated text overwrites that row** (`expandProfile`), so it is not a proxy for fact
  recency.
- **Today's corpus grounds any figure present anywhere in it.** Two coach-supplied or generated values for the same fact (an old and a
  new people-trained count) would both pass.

### How F1 and F2 change

1. **F1 holds facts with provenance and time:** `{slot, value, source, sourcedAt}`. The existing columns cannot express this, so
   **it needs a small facts store: a DB migration, in its own isolated sprint** (CLAUDE.md §5.6). This changes proposal §5's "no
   migration required".
2. **Single-valued slots** — people trained, countries, years, clients, credentials:
   - **the latest coach-supplied value is canonical;**
   - older coach-supplied values and every generated value are **superseded**, not supplementary.
3. **F2 verdicts gain a third outcome.** Beyond grounded / ungrounded: **conflicts with the current fact** (the copy's figure
   matches a superseded value, not the canonical one). Deterministic once the slot is known.
4. **The generator receives the canonical slots**, and not upstream generated assets carrying old figures, as the source for any
   credential it states.
5. **F4 gains a job:** show the coach the stored facts and let them confirm or replace. The manual round's correct figure came only
   from asking the person directly.

**Confidence:** HIGH on the design (it is what fixed the manual case). The storage choice is CC's; the migration needs its own approval.

---

## 4. Viewer-financial-information — a NEW gap, needing its own fix shape

### The rule

Meta, repo ref `META_AD_COMPLIANCE_REFERENCE.md` §1.1 ✔. "Ads can't … **imply knowledge of personal or organisational financial
information**", and "the violation is *implying the advertiser knows something about the viewer*". **Truth is irrelevant, and so is
grounding:** a correct statement about the viewer's finances is still barred.

### Today's checker, measured

`checkOutput`, read-only, synthetic lines:

| line (synthetic) | expected | checker |
|---|---|---|
| "You're well paid, and most of what you've earned just sits there." | block | **pass** |
| "Your savings are sitting in a fixed deposit doing nothing." | block | block, **for the wrong reason** (`clinical_outcome_claim` "fixed … savings") |
| "You earn well but you've got nothing invested." | block | **pass** |
| "Your business makes money, but your personal net worth tells a different story." | block | **pass** |
| "You've got cash sitting in a current account right now." | block | **pass** |
| "Behind on your credit card again?" | block | **pass**, even though vulnerable financial status is an enumerated attribute |
| "A lot of well-earned money just sits in savings." | pass | pass |
| "If you're earning well and want a plan for it, the link's below." | pass | pass |
| "I kept my own savings in a fixed deposit for years." | pass | **block** (`clinical_outcome_claim`) |
| "You can't afford to get this wrong." | pass | **block** (`second_person_protected_attribute`) |

**0 of 6 must-block lines caught for the right reason; 2 of 4 must-pass lines falsely blocked.** The existing rule reaches only
enumerated *vulnerable* terms adjacent to "you"; "implies knowledge of financial information" has no detector at all.

### Why it is not F2

| | F2 speaker facts | **F5 viewer financial information** |
|---|---|---|
| subject | the speaker | the viewer |
| rule | fabrication: is it supported? | Meta §1.1: is it asserted at all? |
| corpus | coach facts required | **none**: truth does not matter |
| tier | label-only until Arfeen promotes it | Meta Tier-1 policy; promotion is still Arfeen's call, on measured precision |
| surfaces | first-person copy | **every reader-facing surface**, including ads and landing pages |

### F5 — the shape

- **The same model-read / machine-verified pattern as F2**, asked a different question: list every statement asserting or implying
  knowledge of the viewer's own financial situation, each with a verbatim quote.
- **Verdict:** a verified quote → finding.
- It can share one call with F2 (two output lists) to save latency.

### Probe

Synthetic, 17 fixtures × 3 runs, `strictToolUse: true`, no DB writes:
- **must-block: 21 / 21**;
- **must-pass: 18 / 24.** False blocks, all 3 / 3: "A lot of well-earned money just sits in savings." (read without context as
  implying the viewer), and "You can't afford to get this wrong." (the idiom — **the model misreads it too**);
- **both AMBIG lines blocked 3/3:** a second-person hook about "your own money", and a pronoun-free "personal net worth tells a
  different story";
- **0 malformed responses in 51 calls** with strict tool use, against 3 in 108 without it in the F2 probe (different prompt; supports
  A3);
- mean **905 in / 62 out tokens**; median **2.2 s**, max **5.0 s**.
- ⚠️ Fixtures were single sentences with no surrounding copy. Real copy gives context, which may fix or worsen the general-statement
  case. The labelled corpus must use whole scripts.

**Confidence:** HIGH that the gap is real and uncovered. MEDIUM that model-read reaches the zero-false-block bar: the idiom failed
both detectors.
🟡 **Decision for Arfeen (D-g):** F5's enforcement tier once measured.

---

## 5. Overstated certainty

### Measured

- **Nothing detects certainty** ("exactly", "guaranteed", "always") relative to what is true.
- **The §14b timed-claim scanner exists** ✔ (`_core/timedClaimScanner.ts`), but its only callers are `bonusGenerator`,
  `leadMagnetContentGenerator` and `offersGenerator`. **It does not run on concepts or scripts**, where "in the first N minutes,
  you'll see …" is exactly the §14b shape: a time attached to the reader's outcome.

### How F2 changes, plus one addition

1. **F2 extracts offer-outcome claims** — what the reader will get, see or know — and grounds them against A2's offer facts, the
   confirmed mechanic.
2. **Certainty comparison, deterministic, on already-grounded claims only:** a certainty marker present in the claim and absent from
   its evidence → **"overstated"**.
   - Scoping the marker list to extracted, grounded claims keeps word-sense exposure small.
   - **Label-only.** Blocking would need its own decision (D-h).
3. **Wire `scanTimedClaims` into the concept and script gates**, with offer facts as the "coach supplied it" exemption. A small
   addition in the same merged pass.

**Confidence:** MEDIUM. It reuses proven parts, but "overstated" is a comparison of strength, and precision is unmeasured.

---

## 6. The known checker failures: systematic, but not for the reason given

**Correction to the record.** Those rounds were not independent confirmations:
- the checker was run on 4 rounds (3–6), not six;
- every one of those inputs carried the same two words, "fixed" and "savings", in the same line.

Recurrence on a near-identical input is one observation, repeated.

**What makes it systematic is the mechanism** ✔:
- **`clinical_outcome_claim` has no adjacency requirement.** It fires when `CLINICAL_OUTCOME_VERB`, which includes `fix(es|ed)`,
  appears **anywhere** in a field together with a protected-attribute term anywhere in the same field (`complianceAxis.ts:1037-1043`).
  Measured:

  | input | as one field | split into two fields |
  |---|---|---|
  | "Savings. Fixed deposits." | block | pass |
  | "Most money just sits in savings. A fixed rate is not the point." | block | pass |

  **The verdict depends on how the caller splits text into fields.** Surfaces that pass a whole body as one field are the most
  exposed.
- **The crypto check has no "digital asset" vocabulary** ✔. `CRYPTO_TERMS` = crypto, cryptocurrency, bitcoin, ethereum, altcoin,
  coin, coins, token, tokens, blockchain, web3, wallet. Its silence on "digital assets" copy is structural.
- ⚠️ **Adding "digital asset(s)" is not a clean vocabulary fix.** "Digital asset management" is a software category, and ZAP's own
  coaches sell "digital assets" in the sense of templates and files. It needs negative controls; it is a word-sense problem, not a
  missing word.

**New scoped item (not F5): lexical-checker precision.**
- `clinical_outcome_claim` adjacency;
- the "can't afford to" idiom;
- "conviction" (capture 2);
- crypto vocabulary with word-sense controls.

These are false positives and blind spots in **existing** checks, each fixable deterministically with fixtures. Sprint-sized, and
§15j applies: tighten, never delete.

---

## 7. Updated sprint plan (supersedes proposal §5 where different)

| # | sprint | change from the proposal |
|---|---|---|
| 0 | **script generator `dryRun`** | **new**: prerequisite for measuring P1's two arms and F2/F5 on scripts without writes |
| 1 | coach-facts source (F1) | **now a facts store with slots, source and sourcedAt: a migration, isolated** |
| 1b | F1 wiring | superseded-value handling; canonical slots fed to generators |
| 2 | speaker-fact checker (F2), label-only | + offer-outcome claims, certainty comparison, "conflicts with current fact" verdict, beat labels for P2 |
| 2b | **viewer-financial-information checker (F5), label-only** | **new fix shape**; may share F2's call |
| 3 | async gate with accumulating correction slots | + `scanTimedClaims` wired to concepts and scripts |
| 4 | length + repetition | + cadence brake (fragment run ≤ 2, share ≤ 0.33, labelled invented); structural check within stage; the P1 A/B measured before the drafting prompt changes |
| 5 | steering correction (F3) | unchanged |
| 6 | coach ask (F4) | + show stored facts for confirm/replace |
| 7 | promotion to blocking | now covers F2, F5 and certainty; each on measured precision |
| 8 | **lexical-checker precision** | **new**: clinical adjacency, idiom, "conviction", crypto vocabulary with word-sense controls |

**Decisions added:**
- **D-f:** structural sameness within a stage.
- **D-g:** F5 tier.
- **D-h:** certainty overstatement label-only or blocking.
- **D-i:** whether to run P1's two-arm measurement before sprint 4, which CC recommends.

Existing D-a … D-e are unchanged.

## 8. Does any of this change the decided length and repetition rules?

**The rules do not change:**
- hook ≤ 10, sentence ≤ 18, uniform;
- pairwise overlap ≤ ~27% with the method name exempt.

**They gain three things:**
1. **a cadence brake**, so the ceilings cannot be satisfied by fragmenting (§1);
2. **a within-stage structural check**, so the overlap cap cannot be satisfied by rewording (§2);
3. **a measured decision** on whether the numbers belong in the drafting prompt at all (§1).
