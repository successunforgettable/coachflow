# Object-slot L5 — result, 2026-07-31

Local harness only. No prod rows, no Cloudinary, nothing torn down. Not committed, not pushed.

## The change

One clause, `unmarkedSurfacesObject`, in `server/routers/adCreatives.ts`, wired into the `object`
template only:

> Every face of the object, and of whatever it stands on, is worked smooth and continuous —
> unbroken plain material whose own grain, weave, glaze or polish is the sole marking it carries.
> Its silhouette and construction are what identify it.

Positively framed and clears the negation gate. The object classes that leaked (trophy, plaque,
monument) are deliberately NOT named — naming them to exclude them would be the §14 trap for a
sixth time. "whatever it stands on" covers the plinth without saying "plinth". The closing sentence
re-points the identifying signal at FORM, giving the model a route to satisfy `nicheContextObject`
that is not lettering.

Scoped by test: `imagePromptNegation.test.ts` asserts the four clean styles do NOT contain the
clause, so the scoping is enforced by CI rather than by care.

## Result — 24 renders, every one opened at full size

| niche | kind | clean | leaked |
|---|---|---|---|
| coaching | abstract | **4/4** | — |
| mindset | abstract | **4/4** | — |
| leadership | abstract | **4/4** | — |
| career-pivot | abstract | **4/4** | — |
| fitness | prop-rich | **4/4** | — |
| dog-training | prop-rich | **4/4** | — |

**24 clean / 0 leaked.** Prior L1–L4 run: 22 clean / 2 leaked.

Renders: `docs/screenshots/run-2026-07-31-objectleak-L5/`.

## The mechanism is confirmed, and that matters more than the count

`leadership` selected a **trophy on a plinth in all four renders** — the exact object class that
produced the L1–L4 leak — and the plinth face came back **blank in all four**. The L1–L4 render
`object__leadership__2` was a cast letterform "L" on a plinth engraved "LEADERSHIP"; same niche,
same object class, engraving gone.

That is the important observation. If the count had improved because the sample happened to avoid
trophies, the result would be luck. Instead the leak-prone object class was still chosen every time
and rendered unmarked — which is direct evidence the surface clause is doing the work.

`fitness` is the same story on the control side: the kettlebell is retained, and the cast weight
number a real kettlebell carries is absent, with no loss of the object.

## Cost to niche relevance: none detectable

Compared against the L1–L4 renders on disk:

- **fitness** — kettlebell before, kettlebell after, visually near-identical. Nothing lost.
- **dog-training** — jute bite tug and treat pouches. Genuine dog-training equipment, niche-correct.
- Intra-niche variety is low (mindset 4/4 zafu cushion, fitness 4/4 kettlebell, leadership 4/4
  trophy) — but the L1–L4 fitness renders show the SAME repetition, so this predates L5 and is not
  a cost of it. Worth a separate look; not a text-leak issue.

## Two honest observations that are not leaks

- `coaching__1` — the clipboard carries a printed basketball-court **diagram**. Line art, no
  letters or numbers, so not a text leak, but it is not a bare surface either. The L5 clause is
  being obeyed for lettering and not fully for markings generally. A diagram is one step from a
  labelled diagram.
- `coaching` renders read as **athletic** coaching (whistle, court clipboard) rather than
  business/life coaching. Pre-existing niche ambiguity, unrelated to L5.

## What 24/24 does and does not establish

- **Does:** the surface-engraving route is closed on the object class that was exercising it.
- **Does NOT:** prove zero. Rule of three bounds the rate below ~12.5% at 95% confidence.
- **Does NOT:** statistically separate 0/24 from the prior 2/24. Fisher's exact on 2/24 vs 0/24 is
  p≈0.49 — not significant. The count alone is suggestive; the held-constant object class is what
  carries the evidence.

## Gates

tsc **34** (baseline held) · pipeline-fixes 382 · imageRenderer 6 · negation gate **20** (was 18).
