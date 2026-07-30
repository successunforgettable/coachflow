# Definitive ad-image site sweep — 2026-07-30

**Why this exists.** `STATE.md` recorded P8 (body rotation) and P6 (subject resolver) as fixed "at all
three batch sites" / "both batch paths". While consolidating the duplicated variation array I found a
**fourth** batch site that was never touched — and it is the one the coach actually presses. This
document is the true per-site coverage, read directly from the code, so the "all sites" claim is never
made again from memory.

Method: every call site of `generateAdImagePrompt`, `generateImage` / `generateEditorialImage`,
`renderAdCreative`, and the body resolvers, enumerated and read. Nothing inferred.

---

## The entry points

### Batch sites — produce a five-deck

| # | site | reached from | renderer |
|---|---|---|---|
| 1 | `adCreativesGenerator.ts:516` `runAdCreativesGeneration` | Auto Mode step 9; `scripts/prove-creatives-live.mjs` | flux-1.1-pro |
| 2 | `adCreativesGenerator.ts:653` `runEditorialAdCreativesGeneration` | Auto Mode step 9 when `adImageStyle` starts `editorial` | flux-2-pro |
| 3 | `routers/adCreatives.ts:917` `generateAsync` | **`V2AdImageCreator.tsx:775` — the coach's "Generate Ad Images" / "Generate Ugly Ads" button** | flux-1.1-pro |
| 4 | `routers/adCreatives.ts:1063` `generateAdCreativesBatch` | `routers/campaigns.ts:303` | flux-1.1-pro |
| 5 | `orchestration.ts:848` template path | Auto Mode when `adImageStyle` is quote_card / notification / testimonial / comparison_card | none — pure resvg render, no diffusion |

### Single-creative sites — produce or re-composite one row

| # | site | reached from |
|---|---|---|
| 6 | `routers/adCreatives.ts:488` `regenerateSingle` | per-card regenerate |
| 7 | `routers/adCreatives.ts:652` `makeVertical` | on-demand 9:16 |
| 8 | `routers/adCreatives.ts:~760` `recompositeText` | headline edit; **re-composites only, generates no image** |

---

## Coverage — per site, per fix

`✅` present · `❌` missing · `n/a` genuinely not applicable

| site | P8 body rotation | P6 subject resolver | F3 `zone` on the compositor |
|---|---|---|---|
| 1 `runAdCreativesGeneration` | ✅ `bodyTexts[i % len]` :562 | ✅ `subjectClauses[i]` :534 | ✅ `zone: "lower"` :567 |
| 2 `runEditorialAdCreativesGeneration` | ✅ `bodyTexts[i % len]` :673 | n/a — casting comes from the editorial scene brief, not `subjectDescriptor` | ✅ `zone: scene.zone` :674 |
| 3 `generateAsync` **(coach-facing)** | ❌ single `gaBody` :916 used flat at :949 | ❌ four-arg call at :933, `subject` omitted | ❌ no zone at :949 |
| 4 `generateAdCreativesBatch` | ✅ `batchBodies[i % len]` :1101 | ✅ `batchSubjectClauses[i]` :1086 | ❌ no zone at :1099 |
| 5 template path | n/a — no body/photo | n/a | n/a — own renderers |
| 6 `regenerateSingle` | n/a — single row by design | ❌ three-arg call at :513 | ⚠️ `zone: editorialScene?.zone` → **`undefined` for tabloid** :527 |
| 7 `makeVertical` | n/a | ❌ three-arg call at :670 | ⚠️ `zone: capturedScene?.zone` → **`undefined` for tabloid** :682 |
| 8 `recompositeText` | n/a — no image generated | n/a | ❌ no zone at :784 — **an editorial row loses its `left` zone on re-composite** |

---

## Answers to the three questions asked

### Is 917 the only miss? No.

**P8 — 917 is the only batch miss, but the count in `STATE.md` is wrong.** There are **four**
photo batch sites (1, 2, 3, 4), not three. Sites 1, 2 and 4 rotate correctly; site 3 never did. The
single-creative sites resolve one body correctly by design — that is the documented thin-wrapper
behaviour, not a defect.

**P6 — three misses, not one.** `STATE.md` says the resolver was "wired into both batch paths", which
is true of sites 1 and 4. But sites **3, 6 and 7** all call `generateAdImagePrompt` without the
`subject` argument, so each falls back to the neutral `"Person (30-45 years old)"` — which is precisely
the Flux prior that produced the all-male decks P6 was opened to fix. Practical effect: a coach who
generates from the wizard button, regenerates a single card, or requests a vertical loses the gender
resolution that Auto Mode applies.

**F3 — five sites, and I need to correct myself.** Earlier in this session I said "three sites rather
than two". That was wrong. The `"lower"` zone is passed at **exactly one** tabloid site — site 1.
Missing at **3, 4, 6, 7 and 8**. Site 2 (editorial) correctly passes its own stored `scene.zone`, so it
is not a miss. Site 8 is a distinct sub-case worth its own line: it passes **no zone at all**, so
re-compositing an *editorial* creative silently drops its `left` zone and reverts to the centred legacy
scrim.

### Any other fix claimed "at all sites"?

Checked and clear: the **ordinal-as-choice** fix (`pickSelected.ts`) genuinely does collapse all eight
selection sites onto one call path — verified by grep, no stragglers. The **fix C / negation** changes
live inside `generateAdImagePrompt` itself, which every photo site shares, so they reach all sites by
construction. The claim that failed is specifically the per-call-site wiring of P8 and P6.

### The pattern

Every miss has the same shape: the fix landed where the fix was being *tested* (Auto Mode, because
that is what the live harness drives) and not on the sibling call sites that duplicate the same loop by
hand. The array consolidation done in this sprint removes one of the three duplications. The remaining
divergence is behavioural, not structural, and needs the per-site wiring above.

---

## Status

Sites 3, 6, 7, 8 are **reported, not fixed** in this sprint. They are booked in `STATE.md` as a single
render-required unit — no pixel change ships on any of them without a live render proving it.
