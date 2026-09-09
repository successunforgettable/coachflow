# The Video-Script Rule

**STATUS: rev 1 — 2026-09-10. Written from four revisions of a real nine-script set, graded against
the corpus each time. No code implements any of it yet.**

**What this is.** The rule that decides what a video ad *says*, for the Andromeda per-concept script
generator (`generateScriptForConcept`). That generator currently **has no caller** — no router, no
client, no job; `conceptScripts` holds zero rows. It is being built, and this document exists so the
build does not repeat four rounds of the same failures.

**Why it is written from failures rather than from the research.** The nine scripts that produced
this document were written by someone who had read the corpus, held the rules in mind, and applied
them deliberately. **Every mechanical rule in Part One was violated anyway, by a draft written with
that rule in front of the writer.** That is the evidence for the central claim of this spec:

> ## A prompt instruction is not an enforcement mechanism.
> ## If a rule can be counted, the generator must count it — not ask the model to respect it.

This is the §15i/§15j family applied to generation: a guarantee nothing enforces is worse than no
guarantee, because the absence of a visible failure gets read as compliance.

---

## 0. Source key

| Code | Document (all under `docs/andromeda/`) |
|---|---|
| `[LENGTHS]` | `script-research/Strategic Report_ Optimising Meta Video Ad Lengths for the 2026 AI Ecosystem.md` |
| `[STRUCTURE]` | `script-research/Comprehensive Report on Video Ad Script Structure and Timing Metrics.md` |
| `[HOOKS-COLD]` | `script-research/Analysis of High-Performance Video Ad Hooks for Cold Audiences.md` |
| `[SPEECH]` | `script-research/Technical Report_ Synthesizing Natural Speech Patterns for Talking-to-Camera Ad Scripts.md` |
| `[NATURAL]` | `script-research/Scripting for Success_ Analytical Report on Natural Video Ad Performance.md` |
| `[MIDDLE]` | `script-research/Scripting the _Messy Middle__ Maintaining Attention in Talking-to-Camera Video Ads.md` |
| `[TONE]` | `script-research/Analytical Report_ Calibrating Spoken Tone for Video Ad Performance.md` |
| `[CTA]` | `script-research/Analysis of Conversational Calls-to-Action in Video Advertising.md` |
| `[HOOK-MAP]` | `script-research/Meta Ads Creative Strategy 2026_ Mapping Hook Patterns to Schwartz Awareness Stages.md` |
| `[TOKENS]` | `copy-research/Andromeda_Copy_Opening_Tokens.md` |
| `[FUSION]` | `copy-research/Andromeda_Copy_Field_Fusion_Rosetta.md` |
| `[ENTITY-COPY]` | `copy-research/Andromeda_Copy_EntityID_Distinctness.md` |
| `[DIST]` | `prospecting-research/Meta Ads 2026_ Prospecting Campaign Ad Concept Distribution.md` |
| `[PROSPECT]` | `prospecting-research/Meta Ads 2026_ The Definitive B2C Prospecting & Creative Architecture Playbook.md` |
| `[STRUCT-VIS]` | `image-research/Structural Visual Distinctness under Meta Andromeda.md` |
| `[SAME-TALENT]` | `image-research/Meta Ads 2026_ Visual Distinctness and Entity ID Architecture in Same-Talent Campaigns.md` ⚠️ **not** the file `image-rule-spec.md` binds to `[VISUAL-SIM]` — different document, deliberately different code |
| `[COHERENCE]` | `image-research/Image-and-Copy Coherence_ The Matched-Pair Principle & Visual Composition for B2C Transformation Sellers in Meta Andromeda.md` |
| `[HOOK-ENCODERS]` | `image-research/Meta Ads 2026_ Ad Copy Hook Optimization for Andromeda's Language Encoders.md` |
| `[TECH]` | `image-research/Meta Ad Image Technical Specifications & Rendering Guide (2026 Edition).md` |
| `[TESTING-MATRIX]` | `image-research/Meta Ads 2026_ The B2C Creative Testing Matrix & Andromeda Architecture Playbook.md` |
| `[GUARD]` | `image-research/Meta Ad Image Compliance Guardrails 2026_ The Do-Not-Do List for Transformation Sellers.md` |
| `[DESIGN-BRIEF]` | `image-research/Programmatic Design Brief_ Separation of Variables & Visual Layout Rules (Meta Andromeda 2026).md` |
| `[CODE]` | `server/_core/conceptAxis.ts` — `LENGTH_BY_AWARENESS`, `WORD_BUDGET_TABLE`, `PLACEMENT_SAFE_CEILING_SECONDS`, `CANDIDATE_HOOK_AWARENESS_MAP` |

### How to read the marks

| mark | meaning |
|---|---|
| ✅ **CORPUS** | stated in a cited document. Quote or section given. |
| 🔷 **INFERRED** | drawn from the four revisions graded here, **not** a corpus finding. Held to the same standard as any other untested belief — if it is later contradicted by research, the research wins. |
| ⚠️ **CONFLICT** | the corpus disagrees with itself. §4. The generator must surface it, never resolve it silently. |
| ⬜ **SILENT** | the corpus says nothing. §5. An absence, not a finding. |

### The evidence base

**Five** revisions of nine cold-audience scripts for a free live event, each graded by independent
recomputation of every stated figure. Where a rule below cites "rev N", that is the revision in
which the violation was measured. **All figures in this document were recomputed, not quoted.**

Rev 5 was the final pass before filming and was signed off. Its remaining defects are recorded here
anyway — a signed-off draft is the most dangerous place for a defect to hide, because nothing after
it will look again.

---

# PART ONE — mechanical rules the generator enforces in code

**Every rule in this part was violated by a draft written with the rule in mind.** That is the
entire argument for enforcing them mechanically. Each carries the measured violation as evidence.

## 1.1 · Headline: 27 characters, hard

✅ **CORPUS.** `[TOKENS] §3`: *"Headlines are truncated to **27 characters** on Facebook Feed and
**10 characters** on Reels Overlay."* `[FUSION] §6` Tier 2 concurs: *"Max 40 characters (ideally 27
characters to prevent mobile Feed and Reels truncation)."*

**Rule.** Reject any headline over 27 characters. Where the placement is Reels overlay, 10.

**Evidence it needs enforcing.** Rev 3 shipped **eight of nine headlines over the limit**, ranging
34 to 53 characters, in a document that cited `[TOKENS]` on the page above. The 53-character one
lost its mechanism to truncation; a 43-character one was a two-part line whose second half — the
half that made it work — was cut.

🔷 **INFERRED, and important:** when rev 4 brought all nine inside 27, **one headline lost its
mechanism to the character budget** rather than losing padding. Enforcing the limit is necessary and
not sufficient — see §1.9. The generator must reject on length *and* on the Tier 2 semantic test,
or it will trade one failure for the other.

## 1.2 · Word budget: derive from duration at 2.7 words/second, never 3

✅ **CORPUS**, and this is a misreading the corpus invites. `[MIDDLE] §4`: *"3-Words-Per-Second
Limit: **This is your absolute maximum speed.** Any faster and you lose the natural cadence."*
`[SPEECH] §4`, `[NATURAL] §2` and `[HOOKS-COLD] §3` all add the buffer rule: the script must read
**2–3 seconds shy** of the slot.

🔷 **INFERRED.** Three is a ceiling, so using it as the divisor targets the ceiling. A budget built
at 3 w/s fills the slot exactly and leaves no room for the rests the same documents mandate.
**2.7 w/s is the target rate**; 3.0 remains the reject threshold.

**Evidence.** Rev 2 set its own target at 120–135 words for 45 seconds — arithmetic at 3 w/s — then
came in at 115–118 across all nine, below its own stated floor, while reporting 127–133. At 2.7 the
actual counts read 42–44 seconds in a 45-second slot, which is exactly the prescribed slack. **The
scripts were right and the target was wrong.** Rev 4 adopted 2.7 and the whole table came into
range without a single script being rewritten for length.

## 1.3 · The 45-second band: 112–127 words

✅ **CORPUS for the anchors**, 🔷 **INFERRED for the interpolation.** `[STRUCTURE] §3`, `[SPEECH] §4`
and `[MIDDLE] §4` agree: **30s = 75–85 words (max 90)**, **60s = 150–170 (max 180)**. `[CODE]`
carries the same table and states that *"other durations fall back to ~3 w/s"* — **there is no
45-second entry anywhere in the corpus or the code.**

**Rule.** Interpolating the two anchors gives **45s ≈ 112–127 recommended, max 135**. Use it, and
mark it in the output as interpolated rather than cited.

📌 **Do not let the fallback quietly become the standard.** `[CODE]`'s "~3 w/s" fallback for
unlisted durations is the same ceiling-as-target error as §1.2, sitting in the code already.

## 1.4 · Hook: 10 words maximum

✅ **CORPUS.** `[HOOKS-COLD] §5`, Hook Health checklist: *"Is the spoken word count for the
introductory segment **under 10 words**?"* And §1: the loop must open *"in under one second using a
physical anchor."*

**Evidence.** Rev 2 shipped hooks of 13, 15 and 16 words. Rev 3 and rev 4 held 4–10 across all
nine — so the rule is trivially satisfiable once counted, and was violated three times in nine when
it was merely intended.

## 1.5 · Tier 1 — niche-indicative vocabulary in tokens 1–5 of the primary text

✅ **CORPUS.** `[TOKENS] §4`, Three-Tier Opening Token Validation Gate, Tier 1: *"MUST contain
high-density, niche-indicative vocabulary. **EXCLUDE** conversational fillers, questions, or generic
CTAs."* The consequence is named in `[PROSPECT] §3`: *"High-signal intent words must be placed here
to avoid **'entertainment' misclassification**, which would suppress the ad from high-value
conversion auctions."*

**Rule.** Reject a primary text whose first five tokens carry no category term.

📌 **Scope, stated honestly.** `[TOKENS]` is written about **copy fields**, not spoken transcripts.
The rule applies to the primary text **without any bridging assumption**. Extending it to the video's
spoken opening is an inference — reasonable, since `[LENGTHS] §1` says Andromeda *"reads your video's
visuals, audio, and transcripts"*, but not stated. **Enforce it on the field where it certainly
applies. Report it, do not enforce it, on the transcript.** See §2.6 — getting this backwards is a
repeated error.

## 1.6 · Tier 2 — benefit or utility in tokens 6–10 of the primary text

✅ **CORPUS.** `[TOKENS] §4` Tier 2: *"MUST introduce the core benefit or physical utility.
Establishes relational mapping to target BoM primitives."*

**Evidence, and it is the sharpest case in this document.** Rev 4's own fix table states *"Tier 2 —
tokens 6–10 must introduce benefit or utility → **Applied across all nine**."* Recomputed, **eight of
nine carry logistics** in that window — *"Free this Sunday two hours"*, *"even is Free Sunday two"*,
*"on real examples Free Sunday"*. Scheduling words map to no interest primitive.

🔷 **INFERRED — and this is the mechanism the generator must guard against.** The logistics arrived
in tokens 6–10 **because a different rule pushed them there**: front-loading the price to satisfy
§1.7 displaced the benefit. **These two rules compete for the same ten tokens and must be validated
together, never in sequence.**

## 1.7 · Price and hook inside the first 125 characters of the primary text

✅ **CORPUS.** `[TOKENS] §3`: Meta recommends 125 characters for primary text *"because text beyond
this is hidden behind a mobile 'See More' link"*, and **only 1.05% of users click it**. `[FUSION] §6`
Tier 3: *"Recommended 125 characters (up to 2,200 characters max, but **essential hooks must precede
mobile truncation**)."*

**Rule.** The category term, the price (for a free offer, the word *free*) and the hook must all
land inside the first 125 characters. Body copy may run long — Tier 3 permits up to 2,200 — but
nothing load-bearing may sit past the fold.

**Evidence.** In rev 3, **"free" fell past the fold in four of nine primary texts**. For a free
event that is the highest-converting word in the copy, invisible to 99% of viewers.

📌 **A correction to an earlier grading of this project, recorded so it is not re-inherited.** The
rev-3 audit framed a conflict between *"125 characters"* and `[PROSPECT] §3`'s *"150–250 words for
NLP density"*, and judged the primary texts as satisfying neither. **`[FUSION] §6` Tier 3 resolves it
directly** — 125 recommended, 2,200 max, essential hooks first. Front-loading is the prescribed
answer, not a compromise. The audit's framing was the less accurate one.

## 1.8 · A call to action in every script, without exception

✅ **CORPUS.** `[NATURAL] §6` is titled *"Mistake 5: The 'Vague' or Missing Call to Action"* and
requires *"specific commands like 'Comment below,' 'Click the link.'"* `[CTA] §1`: the objective is
*"selling the click as a micro-commitment."*

**Evidence, and note how it was lost.** Rev 2 had a CTA in all nine. The rev-2 audit flagged a
**shared 20–30 word tail** across all nine as a redundancy risk. Rev 3 shortened the tails to 5–8
words — and **two of the nine lost their CTA entirely** in the process. Neither ended with any
direction at all. The defect was created by the fix and reported nowhere.

**Rule.** Assert CTA presence structurally after every transformation of the tail, not once at
generation.

## 1.9 · Sentence-length variation: a floor, not just a ceiling

⬜ **CORPUS IS SILENT ON THE STOP CONDITION — see §5.2.** The corpus prescribes fragmentation
relentlessly and nowhere says when to stop. `[MIDDLE] §1`: *"Cut the fluff. Kill the commas… If a
sentence has two ideas, split it. **If it has a comma, it's probably too long.**"* `[SPEECH] §2`
makes fragments *"a critical architect of trust."* Followed literally this produces machine-gun
prose, and there is no counterweight anywhere in the ten script-research files.

🔷 **INFERRED — the brake must come from outside the corpus.**

**Rule.** Enforce a maximum sentence length **and** a minimum standard deviation of sentence length.
A ceiling alone compresses the range and flattens rhythm, which is the same defect approached from
the other side.

**Evidence, measured across three revisions of the same nine scripts:**

| | max sentence | sentence-length SD | reading |
|---|---|---|---|
| rev 2 | 17–25 words | **5.1–7.7** | one-breath risk at the top end; rhythm good |
| rev 3 | ≤18 (capped) | **3.6–4.8** | one-breath fixed; variation compressed |
| rev 4 | ≤18 | **3.5–4.8** | unchanged; drift not reversed |

Capping the longest sentence at 18 removed the one-breath failures **and** cut variation by roughly
a third. Fragment counts held (3–9 per script), so the machine-gun problem did not return — but the
direction of travel is toward flat. Short sentences earn their force by contrast; a set of uniformly
medium ones has no contrast to spend.

**Suggested shape, offered as a starting value and not as a finding:** cap at ~18 words for a 45s
script, and reject any script whose sentence-length SD falls below ~4.0. Both numbers are 🔷.

## 1.10 · Structure: all five beats, and the Turn tested as a Turn

✅ **CORPUS.** `[STRUCTURE] §2`: **Hook → Problem → Turn → Solution → CTA**. The Turn is *"the
critical shift from problem to solution… frame the solution as a **'new opportunity'** or a unique
**'loophole/algorithm'**."* `[HOOKS-COLD] §1`: tension opened by a mystery *"must be resolved by the
second beat with a benefit-driven explanation"* or the ad is dismissed as *"advertising madness"*.

🔷 **INFERRED — the testable form of "is the Turn genuinely there".** A Turn is present when the
script contains **a reframe of the problem AND a named mechanism, both before the agenda**. An
agenda item that mentions the mechanism is not a Turn; it is a contents list.

**Evidence.** Rev 2 had three scripts of nine where the reframe was absent and the mechanism
appeared only as a bullet in what the event contains. All three read as complete to their author.

## 1.11 · Compliance gates that must be counted, not trusted

✅ **CORPUS.** `[GUARD]`: the *"Implied Transformation"* narrative and the *"Second-Person Personal
Attribute"* signature are the primary triggers for account-level suppression. `[DESIGN-BRIEF] §5`
names the **Pronoun Trap**: *"no combination of 'You/Your' with protected attributes (health,
**finance**, beliefs)."*

**Rule.** Scan every surface — transcript, headline, primary text — for outcome vocabulary
(returns, income, wealth, profit, freedom, guarantees) and for second person adjacent to a financial
state. **Scan all three, every time.** See §2.4 for why.

⚠️ **Scope, stated plainly:** both anti-second-person sources are scoped to **images and rendered
text**, while `[SPEECH] §3` and `[STRUCTURE] §5` **mandate** "you/your" in spoken copy without
qualification. The corpus contradicts itself here. §4.3.

## 1.12 · Tier 1 baked-in visual text — FOUR requirements, not one

✅ **CORPUS.** `[FUSION] §6` Tier 1, *Rosetta Visual Hook (The "Attention Anchor")*, and the
Architectural Blueprint at `[FUSION] §4`.

> 🔴 **A generator that checks only the character count PASSES VACUOUSLY.** Three of the four
> requirements are invisible to a length check, and the one that matters most is the one furthest
> from it.

| # | requirement | source |
|---|---|---|
| 1 | **30–50 characters**, *"bounded by visual layout safe zones… to prevent visual overlap with platform UI"* | `[FUSION] §6` T1 |
| 2 | **Maximum 10 words** | `[FUSION] §6` T1 |
| 3 | **Two or more high-frequency semantic category tokens**, *"to serve as a topological anchor for the hierarchical index"* | `[FUSION] §6` T1 |
| 4 | **Semantic objective: a high-salience EMOTIONAL HOOK** — *"Pain Agitation, Desire, Identity, or Aspirational Outlier"*; the Blueprint adds it *"must act as the primary, high-impact **attention hook**"* | `[FUSION] §6` T1, `[FUSION] §4` |

📌 **On requirement 3, read the corpus's own examples.** They are *"Sleep," "Back Pain," "Focus"* —
**subject-matter nouns, not qualifiers.** A line reading `CATEGORY · FROM ZERO · SUNDAY` carries
**one** category token; "from zero" and "Sunday" are qualifiers. Count nouns of the subject, not
words.

### Evidence — rev 5, the first revision in which Tier 1 existed at all

| requirement | rev 5 |
|---|---|
| 30–50 chars | ✅ **30–36** across all nine |
| ≤10 words | ✅ 4–6 words |
| ≥2 category tokens | 🟡 **generous** — four of nine carry one subject noun plus qualifiers |
| emotional hook | 🔴 **missed entirely** — all nine are category labels |

### 🔴 The consequence is structural, not cosmetic

`[FUSION] §4`'s Blueprint assigns Tier 2 exactly one job: *"the 'structural proof' or 'mechanism'
that **validates the baked-in hook**."*

> **With Tier 1 written as a label there is no hook for Tier 2 to validate.**
> **The headline ends up validating a category tag, the architecture reads complete, and the actual
> hook lives in the spoken script — where OCR cannot read it.**

The corpus's worked pair shows the intended shape: baked-in *"Wake Up Without Back Pain!"* (the
hook) against headline *"Orthopedic Doctor-Approved"* (the mechanism that proves it). A label in
slot one inverts that relationship while satisfying every countable constraint — **the §15c shape,
inside the tier architecture itself.**

**Rule.** Validate Tier 1 on all four requirements, and reject on requirement 4 the same way as on
requirement 1. A generator that cannot classify a line as hook-versus-label must at minimum emit the
classification as an open question rather than a pass.

## 1.13 · Production constraints on the baked-in text

✅ **CORPUS — all four, and all four were absent from rev 5**, which specified character counts and
content and nothing else.

| constraint | source |
|---|---|
| **High-contrast fonts** — *"Use high-contrast fonts for text overlays to assist Rosetta in extracting intent"* | `[HOOK-ENCODERS]` |
| **Sans-serif typography, strict ~20% text-to-grid ratio** — *"ensures Andromeda's OCR scanners can match the theme **without flagging for 'low visual quality'**"* | `[TESTING-MATRIX]` |
| **Shallow depth of field** — *"Bokeh Engineering: use a shallow depth-of-field to blur background elements, **creating high-legibility zones for typography**"* | `[COHERENCE]` |
| **Platform safe zones** — *"As of March 2026, safe zones across Facebook and Instagram Stories and Reels have been **synchronized** to prevent UI collision"* | `[TECH]` |

🔷 **INFERRED — the card must be on screen inside the first three seconds.** `[LENGTHS] §5`:
*"Andromeda assigns separate scoring to the first three seconds of a video."* `[CTA]` says
superimpositions and lower thirds *"captures attention within the first three seconds."* **Neither
states a required on-screen time for baked-in text.** But a card that appears at second twelve is
not anchoring at the moment the window is scored. **Marked as inference; do not cite it as a rule.**

📌 **Why this section is not cosmetic either.** If contrast is too low for Rosetta to extract the
text, Tier 1 does nothing **and reports nothing** — no error, no flag, no difference in the ad
manager. It is a check that cannot fail, and the practical failure case is real: an outdoor,
high-key shoot with light text over a bright background.

### ⚠️ Dominant overlays reposition the ad's branch

`[SAME-TALENT]`: *"Meta's Rosetta system prioritizes high-contrast, text-heavy grids. Using
**dominant** text overlays acts as a specific trigger for OCR-based repositioning, **moving an ad
from an 'Emotional' branch to a 'Utility' branch**."*

**The protection is keeping the card modest, not avoiding text.** A small lower-third held for a few
seconds is not a text-heavy grid. An emotional Problem-Aware narrative carrying a dominant text card
can be re-branched away from the audience it was written for.

---

# PART TWO — failure patterns that recur, and must be tested for

**Every pattern below was created by fixing something else.** They are recorded as pairs — the fix
and its side effect — because that is the only form in which they are recognisable in advance. A
generator that applies fixes sequentially without re-validating the whole will reproduce all of them.

> ## 🔑 THE SHAPE: A FIX IS A CHANGE, AND A CHANGE INVALIDATES THE PREVIOUS MEASUREMENTS.
> ## RE-RUN THE WHOLE SUITE AFTER EVERY EDIT. NEVER SPOT-CHECK THE THING JUST CHANGED.

## 2.1 · Fragmentation has no stop condition — the brake is external

**The corpus instruction:** `[MIDDLE] §1`, `[SPEECH] §2`, `[NATURAL] §3` — one idea per sentence,
fragments mandatory, kill the commas.

**The side effect:** followed literally, every sentence becomes short and the script reads as a
machine gun. **No document in the ten-file script corpus contains a warning about this.** Grepping
the whole set for `monoton|staccato|choppy|robotic|over-correct|vary sentence length` returns
nothing.

**The test:** §1.9's SD floor. Short sentences must sit against medium and long ones or they stop
functioning as emphasis.

🔷 **INFERRED** in full. The corpus supplies the accelerator and no brake; the brake is a decision
made here.

## 2.2 · Fixing a missing Turn with a formula creates cross-script redundancy

**The fix:** rev 2 lacked a Turn in three scripts. Rev 3 added one to each — by applying the same
reframe construction.

**The side effect, measured in rev 3:** the phrase *"one of four patterns, and it's…"* appeared in
**four** of nine scripts; *"how digital assets actually work"* in **six**; *"Sunday I go through all
four. Then…"* in **three**. `[ENTITY-COPY]` and `[FUSION] §4` are direct about the consequence —
semantically identical assets cluster under one Entity ID and receive one auction ticket.

**And a second-order failure nobody looked for:** three scripts each claimed their pattern was *the
most common* of the same four-item set. **Mutually exclusive claims about a finite set, generated by
a template applied per-script with no cross-script validation.** Two were unverifiable frequency
assertions of a kind that attracts a fabrication finding even where nothing is claimed about money.

**The rev-4 outcome, and the lesson that matters most here:** rev 4 reworded every instance. Script
overlap moved **25.4% → 24.6%**. Almost nothing. Because —

> ## Entity ID is assigned to MEANING, not to the string.
> `[PROSPECT]`: *"the Entity ID is assigned to the semantic meaning of the ad. If two ads
> communicate the same concept, they share an Entity ID."*

**Rewording nine sentences that all say the same thing buys nothing algorithmically.** It is worth
doing for the human viewer served three of them. It is not a diversity fix.

🔷 **AND IT COST SOMETHING.** Rev 4's rewrite left the device with **two names across the set** —
"four reasons" in four scripts, "four patterns" in three, "four of them" in one. A viewer served two
ads cannot tell they refer to the same thing. **A branded mechanism must have one fixed name; the
variation exercise is what split it.**

**The tests, both required:**
1. No n-gram of 4+ tokens may appear in more than two scripts in a set.
2. **Cross-script consistency of any named mechanism** — one canonical term, and no two scripts may
   assert incompatible superlatives about the same finite set.

## 2.3 · Shortening a shared tail can delete the CTA

Covered at §1.8. Recorded here too because it is the cleanest example of the shape: a redundancy
fix, applied to the correct target, that silently removed a required element from two of nine — and
the resulting document reported the redundancy fixed and said nothing about the CTA.

## 2.4 · Fixing a pronoun breach in one surface moves it to another

**The fix:** rev 2 had two scripts opening with second person plus a financial state. Rev 3 rewrote
both openings.

**The side effect:** rev 3's newly-written headlines contained **three** such breaches — *"Your money
is the last manual thing you own"*, *"Everything you own is in one place"*, *"Money you're trusted
with. Money that's yours."*

📌 **And the migration went from the safer surface to the more exposed one.** The anti-second-person
sources are scoped to images and rendered text. The transcript is the surface where the rule is
weakest; the headline is the surface where it is strongest. **The defect moved to where it matters
more, inside a change that fixed it where it mattered less.**

**The test:** the compliance scan runs over **every surface, after every edit to any surface**.

## 2.5 · Naming the subject only by negation

**The fix:** rev 1's scripts never named their subject at all. Rev 2 introduced it. In the
Problem-Aware scripts the natural insertion point was inside the Turn, and the natural construction
was a negation — *"it's not that crypto is hard"*, *"none of them is crypto being complicated"*,
*"it has nothing to do with crypto"*. **Six of nine scripts carried the sole category anchor inside a
negative.**

**Two problems, both 🔷 INFERRED:**
1. A negation is a weaker retrieval token than an assertion. `[TOKENS] §2` describes topological
   priming by *"specific, category-indicative terminology"* registering as a structural anchor; a
   term appearing only as the object of a negation is a thin anchor.
2. It plants an objection the viewer may not have had. Naming a difficulty in order to deny it
   introduces the difficulty.

**The fix that worked:** rev 4 converted several to positive temporal or factual assertions —
*"older than crypto"*, *"long before crypto existed"*, *"everybody there has read plenty about
crypto"*. Two negations remained, unstated in the fix table.

**The test:** for each script, classify the first occurrence of the category term as assertion or
negation, and cap the proportion of negations across a set.

## 2.6 · Measuring the bridged surface and not the direct one

🔷 **INFERRED, and it recurred twice in four revisions.**

`[TOKENS]` and `[FUSION]` are written about **copy fields**. Applying them to a spoken transcript
requires a bridging assumption. Applying them to the primary text and headline does not.

- **Rev 3** measured opening-token compliance on the **transcript** (bridged) and left the **primary
  text overlap** (direct) unmeasured. When measured it was **44.7%** — nearly double the transcript
  figure the document did report.
- **Rev 4** measured across-ad overlap on both fields and left **within-ad** overlap unmeasured.
  When measured, each primary text against its own script ran **43–76.5% Jaccard, mean 60%**, with
  **61–83% of each script's content words reappearing in its own primary text**. The highest
  *across*-ad pair anywhere was 29.5%.

**That second one is `[FUSION] §4`'s named failure, verbatim:**

> *"**Pure Replication (Duplicate Copy):** Reusing the exact same hook across the image, headline,
> and primary text fields creates **severe semantic redundancy**. This 'fake diversity' does not
> expand the ad's representation. Instead, Andromeda's entity clustering mechanism groups the
> visually and textually identical creatives under a single backend **Entity ID**, allocating only a
> single 'auction ticket' and triggering retrieval suppression."*

**The prescribed alternative is Complementary Reinforcement** — `[FUSION] §4`: *"distinct,
complementary signals that align with a unified semantic concept… reinforce the same conceptual angle
**from different cognitive angles**."* `[FUSION] §6` assigns the roles: Tier 1 baked-in visual text is
the **Attention Anchor (Hook)**, Tier 2 headline is **Structural Proof (Mechanism)**, Tier 3 primary
text is **Contextual Depth (Persona/Pain)**. The primary text is not a prose retelling of the video.
It is a different cognitive angle on the same concept.

**The rule for the generator:**

> **Measure the surface where the rule applies directly, first and always. Report the bridged
> surface separately and label it as bridged.** A figure from the surface needing an assumption is
> not evidence about the surface that does not.

**And one more surface that has never been written at all.** `[FUSION] §6` Tier 1 requires **baked-in
visual text** — 30–50 characters, max 10 words, *"at least two high-frequency semantic category
tokens… to serve as a topological anchor for the hierarchical index"*, read by Rosetta OCR. **None of
the nine ads in any of four revisions specified any on-screen text.** Tier 2's central rule — *"must
never duplicate the baked-in visual text"*, cosine similarity below 0.40, zero shared tokens —
therefore passed **vacuously**, having nothing to compare against. A check that cannot fail (§15c).
**The generator must emit all three tiers or declare Tier 1 absent; it must never validate Tier 2
against an empty Tier 1 and report a pass.**

## 2.7 · Fixing within-ad redundancy by rewriting to argument splits the voice

**The fix:** rev 4's primary texts were prose retellings of the scripts — 60.0% mean overlap
(§2.6). Rev 5 rewrote all nine as **contextual depth on persona and pain**, which is precisely what
`[FUSION] §6` Tier 3 asks for. **Within-ad overlap fell 60.0% → 16.1%.** The largest single
improvement across five revisions, and the right fix.

**The side effect, measured across all nine:**

| | scripts | primary texts |
|---|---|---|
| contractions / 100 words | **6.3** | **0.0** |
| median sentence | 6.7w | 9.6w |
| longest sentence (mean) | 15.6w | **26.2w** |
| longest sentence anywhere | 18w (capped) | **38w** |
| fragments ≤4 words | ~5 per script | ~1 |

**Zero contractions across 862 words.** Not one, in nine documents.

🔷 **INFERRED, and it cuts both ways.** The split is **defensible** — Tier 3 is read, not spoken,
and `[SPEECH]` and `[MIDDLE]` are explicitly standards for writing for the ear. A read surface has
no obligation to obey them.

**But zero out of 862 is not a decision. It is a different drafting mode**, uniform to a degree that
reads as machine-produced rather than written, and nothing in the revision records it as a choice. A
viewer who reads the primary text and then hears the video meets two different people.

**The test.** Measure register on every surface — contraction density, median and maximum sentence
length, fragment count — and **emit the delta between surfaces**. A generator producing both surfaces
must either hold one voice across them or declare, per surface, which register it is targeting and
why. Silence on the question is what produced this.

📌 **Same shape as the rest of Part Two:** a correct fix, applied to the correct target, whose side
effect landed in a dimension nobody was measuring.

---

# PART THREE — the process finding

**This is the most important section and the least technical.**

Across five revisions, **every draft reported itself complete while being measurably less so.**
Rev 2 was roughly two-thirds finished. Rev 3 was roughly nine-tenths. Rev 4 was closer still. Rev 5
got every computed figure right and still shipped two false sentences. In every case the gap was
found only by **independent recomputation**, and in every case —

> ## The error was in the SELF-REPORT, not in the work.

## 3.1 · The record

| revision | what the document asserted | what recomputation found |
|---|---|---|
| rev 2 | word counts of 127–133, presented as counts | **115–118.** Overstated by 10–16 on every one of nine. All nine below the document's own stated floor |
| rev 2 | *"Each one names… the vehicle (digital assets, crypto)"* | **One of nine named neither, anywhere.** The defect the revision existed to fix, surviving in the summary that declared it fixed |
| rev 2 | *"Every video differs from every other on at least two variables"* | **One pair matched on three of four.** 35 of 36 pairs held; the claim was universal |
| rev 3 | a table row reading *"subject at 10%"* | **68%.** The prose two pages later stated the correct range; the table was wrong and the table is what a reader quotes |
| rev 3 | overlap *"29.0% / 23.7%"* | unreproducible — **no method stated** |
| rev 4 | *"No phrase now repeats across more than two scripts"* | **three scripts share a verbatim six-word phrase** |
| rev 4 | *"Tier 2 — applied across all nine"* | **eight of nine carry logistics** in tokens 6–10 |
| rev 5 | *"P2 and W2 both converted to positive assertions"* | **both still negate** — *"has never been one of them"*, *"was never the subject"*. Reworded, not converted |
| rev 5 | *"Zero tokens shared between any on-screen text and its headline"* | **true under the document's own published stoplist; false literally** — E3 shares *"the"*. Trivial in effect, false as written |

Rev 4 got **54 of 54 computed figures exactly right** — word counts, hooks, contraction densities,
longest sentences, standard deviations, headline characters. The numbers it *computed* were flawless.
**The two claims it failed were the two it asserted rather than ran.**

Rev 5 got **72 of 72 computed figures exactly right**, and — **for the first time in the series —
its overlap figures reproduced to the decimal**: 22.5% script-to-script, 17.8% primary-text-to-
primary-text, 16.1% within-ad, all three matching an independent recomputation exactly. **What made
that possible was publishing the stoplist**, not naming the method. Rev 4 had named the method and
still ran ~1 point off, because the stoplist is a parameter of the method and was withheld.

**And rev 5 still shipped two false sentences, both typed, both in the fix table rather than the
measurement table.** That is now **three consecutive revisions with the identical signature.**

> ## That is the whole finding, and five revisions have not dented it.
> ## Computed figures: reliable, every time, in every revision.
> ## Asserted verifications: unreliable, every time, in every revision.
> ## The difference is not care, and it is not competence. It is whether a machine produced the number.

## 3.2 · The rules this imposes on the generator

**1. Compute and expose; never assert.** Every claim the generator makes about its own output must
be a value it calculated and emitted, not a sentence it wrote. `words: 117` is a measurement.
*"within budget"* is an opinion.

**2. Anything claimed must be independently checkable.** A figure needs its method attached, and the
method needs its parameters attached. Rev 4 named its overlap method — *stopword-filtered content-word
Jaccard* — and the figures still did not reproduce, consistently ~1 point low, because **the stoplist
is a parameter of the method and was not published.** Naming a method is not the same as making a
figure checkable.

**3. A universal claim needs a universal check.** *"Every pair differs on at least two variables"*
is a statement about 36 pairs. It was made without testing 36 pairs, and it was false for one. If
the generator says *all*, it must have iterated all.

**4. Re-run everything after every change.** §2's entire catalogue exists because fixes were applied
and only the fixed thing was re-checked.

**5. Emit the failures, not just the passes.** A validation report listing what passed is
indistinguishable from a validation report where the checks never ran (§15c, §15-PARENT). The
generator's report must name what it checked, what the value was, and what the threshold was — for
every check, passing or not.

**6. A self-report is not evidence about itself.** The five documents were written by a competent
author holding the standard in mind. That was not sufficient, five times running. **Build the
grader into the generator, or the generator will grade itself generously.**

**7. A method is not checkable until its PARAMETERS are published, not merely its name.** This
sharpens rule 2 and it was learned the expensive way. Rev 3 gave overlap figures with no method —
unreproducible. Rev 4 named the method — *stopword-filtered content-word Jaccard* — and the figures
still ran **consistently ~1 point low**, because the stoplist and the minimum token length are
parameters of that method and neither was given. Rev 5 published the stoplist verbatim and the
figures **reproduced to the decimal**.

> **"Jaccard" is not a method. "Jaccard over content words, with this stoplist, dropping tokens
> under three characters, apostrophes retained" is a method.** Emit every parameter alongside every
> figure, or the figure is an assertion wearing a number's clothes.

---

# 4. Conflicts the generator must surface, never silently resolve

## 4.1 ⚠️ Does hook variation alone separate Entity IDs?

- **Collapses:** `[LENGTHS] §4` — assets above 60% similarity trigger retrieval suppression, example
  given being *"only changing the headline on the same video"*. `[GUARD]`'s cosmetic/structural
  table puts headline swaps on the same template in the cosmetic column. `[STRUCT-VIS] §2` returns a
  *"firm NEGATIVE"* on micro-variation while face and lighting are constant.
- **Separates:** `[TOKENS] §4` — *"By enforcing unique, high-density vocabulary within the first 10
  tokens of each concept, the ad copy generator establishes distinct **Entity IDs**. Each concept
  occupies a separate branch of the hierarchical retrieval tree."*

**Unresolved.** The copy report's examples are text-field concepts; the video reports concern visual
embeddings. `[TOKENS] §4` Tier 3 requires the first ten tokens to be cross-checked against baked-in
video text via OCR, which implies the two are scored jointly — **that is where a reconciliation would
live, and no document makes it.**

**Rule.** The generator must not assume opening-token divergence is sufficient separation. Vary
structurally as well, and record which assumption a batch was built on.

## 4.2 ⚠️ Three competing awareness distributions

`3/3/1/1/0` (`[DIST] §3`, and one further report) · `2/3/2/1/0` (quoted in places) · `2/2/2/1/1`
(`[TESTING-MATRIX] §2.1` rev 4, which includes a Most-Aware ad the other two exclude *and give a
mechanism for excluding*).

`docs/andromeda/image-rule-spec.md` §5.7 records this as a **genuine three-way conflict** and says
in terms: *"The corpus does not reconcile them… **Genuine open question for Arfeen; do not treat as
settled.**"*

**What is settled and worth carrying:** a portfolio on a single stage *"risks being pruned globally"*
(`[DIST] §2`); the warmer tail is *"a vital safeguard against Entity-ID pigeonholing"* (`[DIST] §3`);
shifting stage is *"the most efficient lever for generating a unique Entity-ID"* (`[DIST] §4`); and
for this format specifically, *"**Webinar/VSL:** weight heavily toward **Problem-Aware**"* against
*"**Lead-Magnet:** focus heavily on **Unaware**."*

📌 **A trade the nine-script set made and did not name.** Relabelling three mislabelled Unaware
scripts as Problem-Aware was a gain in honesty and **a loss in branch coverage** — six of nine then
sat on one branch. Both halves must be stated. `[DIST] §2`'s pruning warning is about concentration,
and 67% is concentration.

🔷 **And a caution for any generator that treats stage as a diversity axis:** with a 6/3 split,
stage separated only three assets from six. All fifteen two-variable collisions in that grid included
stage. **A near-constant is not a separation variable.**

## 4.3 ⚠️ Second-person address — mandated by one half of the corpus, banned by the other

**Referenced at §1.11 and written up here.**

- **Mandated:** `[SPEECH] §3` and `[STRUCTURE] §5` require personal pronouns without qualification —
  *"Use personal pronouns: speak directly to the viewer using 'you' and 'your'."* `[CTA] §2`'s
  Relatability Hook is built on *"If you struggle with X, watch this."*
- **Rated inferior:** `[LENGTHS] §7` — *"Pattern Naming is superior to generic Persona Callouts."*
- **Banned in combination:** `[DESIGN-BRIEF] §5`, the **Pronoun Trap** — *"no combination of
  'You/Your' with protected attributes (health, **finance**, beliefs)"*; `[GUARD]` treats the
  *"Second-Person Personal Attribute"* as a suppression trigger and prescribes **Community Framing**
  instead: *"focus on the system's presence"* rather than the user's lack.

**Unresolved, and the scope is the load-bearing part.** Both anti-second-person sources are scoped to
**images and rendered text**; the pro-second-person sources are about **spoken copy**. That reading
would reconcile them — spoken transcript permissive, headline and baked-in text strict — but **no
document says so.** It is available as a working rule, not as a finding.

📌 **Rev 5 arrived at that split empirically and it worked**: second person runs 4–8% in the scripts,
**0–2.2% in the primary texts and zero in the headlines**, with every diagnosis put in the third
person about a group. That is `[GUARD]`'s Community Framing executed, whether or not it was reached
through the conflict.

## 4.4 ⚠️ May Tier 1 and Tier 3 share opening content?

- **Banned:** `[FUSION] §4` — *"Pure Replication (Duplicate Copy): Reusing the exact same hook across
  **the image, headline, and primary text fields** creates severe semantic redundancy… allocating
  only a single 'auction ticket' and triggering retrieval suppression."*
- **Required:** `[TOKENS] §4`, Tier 3 of the Opening Token Validation Gate — *"Cross-check that the
  first 10 tokens **match** or directly reinforce the high-salience text baked into image/video
  frames (OCR)."*

**One document bans the duplication the other requires, and neither acknowledges the other.**

**Evidence that this is live rather than theoretical.** In rev 5, **two of nine** ads have baked-in
text that is a near-verbatim slice of their own primary text's opening — `DIGITAL ASSETS · FROM ZERO
· SUNDAY` against *"Digital assets, taught from zero"*, and `DIGITAL ASSETS · THE MECHANICS` against
*"Digital assets, the mechanics explained."* **Both satisfy `[TOKENS]` by breaking `[FUSION]`.** The
other seven reinforce without matching, which is the reading that satisfies both — but that is an
observation about seven drafts, not a resolution.

**Rule.** Surface which reading a batch was built on. Do not silently pick one.

---

# 5. Explicit silences — absences, not findings

> **§15-PARENT: treating the absence of a signal as a signal. Both entries below were measured by
> negative-control sweep, not assumed.**

## 5.1 ⬜ Ads for free live events

Swept `script-research/` and `prospecting-research/` for
`workshop|training|session|class|host|agenda|date and time|join us|live`, and counted `event` per
file. **Every hit was a false positive** — "conversion events", "live auctions", "decisions live in".

**Nothing on** whether the format, duration, agenda, date or teacher must appear in the ad for a
click to become a registration. Nothing on registration as a conversion distinct from a download or
a purchase.

The only event-shaped statement in the corpus is a **targeting weighting**, not a content
requirement: `[DIST]` "Adaptations" — *"Webinar/VSL: weight heavily toward Problem-Aware. GEM looks
for the 'intent to learn' signal."*

⚠️ One passage cuts against stating logistics at all: `[CTA] §1` — the video's job is *"selling the
click as a micro-commitment rather than attempting to sell the product in the video itself"*, and
`[HOOKS-COLD] §1`'s Time Contract promises *"high-value insight rather than a standard product
lecture."* **Not a contradiction — the corpus never addresses events — but a cost.**

🔷 The nine-script set chose to state format, duration, price and teacher, on the reasoning that a
viewer cannot decide to attend something they cannot picture, and cut those tails to 5–8 words.
**Judgement, not a finding.** Worth filling from outside the corpus before the generator hard-codes
it.

## 5.2 ⬜ Any stop condition on sentence fragmentation

Covered at §1.9 and §2.1. Recorded here as a formal silence: **the corpus prescribes fragmentation
in four separate documents and nowhere says when to stop.** Any limit the generator enforces is an
invention of this spec, and must be labelled as one.

## 5.3 ⬜ The FLOOR on within-ad divergence

`[FUSION] §4` names two failure modes, not one. **Pure Replication** is the ceiling — §2.6. The floor
is **Total Divergence**:

> *"Using completely unrelated messages across fields (e.g. an on-image hook about 'spinal
> alignment,' a written headline about 'free shipping,' and primary text about 'eco-friendly
> manufacturing') introduces **semantic noise**. Because the dual-encoders cannot map these
> discordant vectors to a stable, high-confidence cluster, **the ad fails to align with any specific
> latent interest primitives**."*

The prescribed target between them is **Complementary Reinforcement** — *"distinct, complementary
signals that align with a unified semantic concept."*

🔴 **The corpus gives a number for neither bound.** Within-ad overlap moved **60.0% → 16.1%** across
one revision. 60.0% was demonstrably the replication failure. **Nothing establishes whether 16.1% is
safe or merely lower.** The concept remains shared in rev 5 — category, event and persona all carry
across — so it reads as complementary rather than disconnected, but that is a judgement of the prose,
not a measurement against a threshold.

📌 **Do not let the direction of travel stand in for a target.** "Lower than the number that failed"
is not the same as "inside the band", and a generator optimising this figure downward with no floor
will eventually cross into semantic noise and report an improving metric all the way there.

---

# 6. Not in scope

- **The picture.** `script-research/README.md` is explicit: *"Nothing here decides the picture. All
  nine are about words."* Visual separation lives in `image-rule-spec.md` and `[STRUCT-VIS]`.
- **The shoot grid.** Recorded here only where it interacts with copy — §4.2's note that stage is a
  weak axis at a 6/3 split.
- **Placement and length policy.** `[CODE]`'s `PLACEMENT_SAFE_CEILING_SECONDS = 30` is a **product
  decision, not a research finding** — the code comment says so — and it caps every stage below the
  research-ideal ranges stored beside it in `LENGTH_BY_AWARENESS`. Changing it is a product call,
  not a script-generator call.
- **Landing-page and thank-you-page copy.** Different surfaces, different rules.

---

## Revision log

**rev 2 — 2026-09-10 — the fifth and final grading applied.** Adds §1.12 (Tier 1's four requirements,
of which rev 5 met two), §1.13 (the production constraints on baked-in text, plus the branch-
repositioning warning), §2.7 (the voice split created by fixing within-ad redundancy), §4.3 (the
second-person conflict, referenced at §1.11 in rev 1 but never written — a dangling reference in a
document about checkability, now closed), §4.4 (Tier 1 versus Tier 3 opening content), §5.3 (the
missing floor on divergence) and operational rule 7 (publish the method's parameters, not its name).
Part Three extended to five revisions: **72 of 72 computed figures exact, overlap reproducible to the
decimal for the first time, and two typed claims still false.**

**rev 1 — 2026-09-10 — original.** Written from four graded revisions of a nine-script set for a
free live event. Every figure quoted was recomputed at the time of grading. **No code implements any
of it.** The generator it specifies (`generateScriptForConcept`) still has no caller.
