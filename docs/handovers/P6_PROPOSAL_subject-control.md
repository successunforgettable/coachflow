# P6 — subject control in the ad-image prompt: proposal, nothing built

**Date:** 2026-07-29. Written after fix C shipped (`1f077d9`). **Proposal only — build after review.**

P6 was scoped as "gender mismatch". The fix-C re-run showed it is the narrower symptom of a wider
defect: **the prompt does not control who is in the frame.** Two independent causes, one cheap and
one needing a design decision. Both are prompt work; neither is a model problem.

---

## Cause 1 — the prompt contradicts itself, and it always did · **CHEAP, HIGH CONFIDENCE**

`nicheContext` is appended unconditionally to **all five** styles
(`server/routers/adCreatives.ts`, `generateAdImagePrompt`):

```
The person and setting must visually match the ${niche} niche — their clothing,
environment, and expression must be recognisable to someone in that world…
```

Two of the five styles are explicitly person-free. The `object` prompt therefore reads, in sequence:

> "…photographed alone as a still life with **no person in frame**. Dramatic lighting, dark
> background. **The person** and setting must visually match the … niche — **their** clothing,
> environment, and expression must be recognisable…"

A self-contradiction four words apart. `screenshot` has the same problem. This is why the fix-C
re-run's `object` slot returned a father holding a baby despite the new "no person in frame"
wording — **and it predates fix C**, since `nicheContext` was always unconditional. My earlier
attribution of that drift to `prompt_upsampling` is **refuted**; the re-run had upsampling off and
the drift persisted.

**Fix:** make `nicheContext` style-aware — a person variant for the three person styles, a
setting-only variant ("The setting, props and styling must visually match the ${niche} world") for
`object` and `screenshot`. Pure string work, no new inputs, no cost. **Recommend doing this
regardless of what is decided about gender**, because it is a correctness bug in its own right.

---

## Cause 2 — nothing describes the subject · **needs the resolution step**

The only subject descriptor is `Person (30-45 years old) dressed and styled for the ${niche} world`.
No gender, no real age, nothing about the scenario. Five-of-five male is what asking for nothing
returns from an unconditioned prior.

The data exists — `idealCustomerProfiles.demographics` carries `gender` and `age_range`, populated
on **73/101** prod ICPs — and no image path reads it. But **it cannot be interpolated**, which is
the whole design problem:

```
id 254: "All genders; slightly skewed toward women 38–46 in managerial and professional roles…"
id 253: "Mixed, slight skew male 55% / female 45% — both represented equally in the core pain"
id 250: "All genders, skewing slightly female (55–60%)"
id 247: "Female"                                     ← the only clean token in the sample
```

**The field describes a population; a photograph depicts one person.** Concatenating that string
into a Flux prompt yields either garbage or, worse, the model latching onto "male 55%" in a string
that means the opposite. A resolution step is required.

### Proposed: `resolveSubjectDescriptor(icp, niche)` → `{ gender, ageBand, castingLine }`

A pure function, unit-testable without any API call, resolving in three tiers and **failing to
neutral, never to a guess**:

**Tier 1 — deterministic parse of `demographics.gender`.** Read via the existing
`normalizeDemographics()` (already handles the snake/camel drift and string-shaped rows). Resolve in
this order:
- a bare token (`"Female"`, `"Women"`) → direct;
- an explicit skew (`/skew\w*\s+(slightly\s+)?(toward\s+)?(female|male|women|men)/i`,
  `/(mostly|predominantly|primarily)\s+(female|male|women|men)/i`) → take the skew term;
- competing percentages (`"male 55% / female 45%"`) → take the larger, and **only** when the gap
  clears a margin (≥10 points). "50/50" resolves to nothing, correctly.

**Tier 2 — the ICP's own first-person text**, when tier 1 is unresolvable or hedged to nothing.
`introduction` and `fears` are written in the ICP's voice and are gendered in practice where the
demographics field hedges. The 2026-07-28 ICP is the case in point: `demographics.gender` would very
likely have hedged, while the introduction says *"other mums in my antenatal group"* and *"a worse
mother"*. Match a small explicit lexicon (`mum/mother/she/her` vs `dad/father/he/him`) and require a
clear majority.

This tier is not a nicety — it is the **anti-fabrication principle applied to imagery**: ground the
depiction in what the ICP actually says, not in a demographic inference. It is also the tier most
likely to fire, since the hedged prose is the common case.

**Tier 3 — unresolved → emit the current neutral wording.** Never a coin flip, never a silent
default to male. An unresolved ICP is a legitimate outcome (a genuinely mixed audience), and the
status quo is the honest render for it.

`age_range` needs the same treatment in miniature: `"35–50, with the core cluster at 38–46"` should
resolve to the cluster, not the outer band, and should replace the hardcoded `30-45`.

### ✅ DECIDED BY ARFEEN 2026-07-29 — both calls answered, do not re-litigate

**1. PER BATCH.** All five creatives depict the same person type, **resolved from the ICP, never
guessed**. Five creatives are one audience; varying the subject across a deck reads as a bug.

**2. A GENUINELY MIXED ICP ALTERNATES ACROSS THE FIVE SLOTS** — both represented, rather than
defaulting to one.

**These two interact, and the interaction is the whole rule:**

> **One audience, one depiction. An actually-mixed audience, both.**

- **Per-batch applies when the ICP is CLEAR** — e.g. "mums", "she", maternity pay, antenatal group →
  **all five female.** Not alternated. A clear ICP is not a mixed one.
- **Alternating applies ONLY when the ICP is genuinely mixed** — a real 50/50, or a skew too weak to
  resolve. It is the tier-3 path, not a general variety mechanism.

**Never a coin flip. Never a silent default to Flux's prior** (which is what "unspecified" resolved
to, and why all five subjects came out male).

### Revised tier 3

Tier 3 is therefore **not** "emit the current neutral wording" as originally drafted — that is what
produces the male default. It is: **mark the batch as mixed and alternate the resolved descriptor
across the five variation slots.** The neutral wording survives only for an ICP with no usable
signal at all in either tier 1 or tier 2, which should be rare and is worth logging when it happens.

### What this does NOT fix

`generateAdImagePrompt`'s `problem` parameter is **dead** — passed by every one of its five callers,
interpolated into none of the five templates. That is why the 2026-07-28 v1 showed a **newborn** for
an ICP whose baby is **seven months**. Either interpolate it as a scene constraint or delete the
parameter; leaving a live dead parameter is what makes "we thought it was wired" errors cheap to
make. **Recommend interpolating it** — it carries the scenario that would have prevented the newborn.

---

## Suggested order

1. Style-aware `nicheContext` (cause 1) — cheap, independent, fixes a live self-contradiction.
2. Interpolate or delete `problem`.
3. `resolveSubjectDescriptor` + unit tests, once the two decisions above are answered.

All three are prompt-layer, no migration, no added API cost. **Prove on a live cascade, not a
harness run** — the harness reconstructs `niche` and cannot exercise the ICP read at all.
