# P6 / P7 / P8 + overlay — ad-creative defect investigation

**Date:** 2026-07-29 · **Status:** investigation + proposal only, nothing built.
**Evidence:** `docs/screenshots/run-2026-07-28/ad-creative-v{1..5}.png` (all 1024×1024), read directly.
**Prod verified clean at session start:** services 124 · ICPs 101 · kits 49 · creatives 397 ·
adCopy 5405 · **0 running jobs** — every count at STATE.md baseline.

---

## 0. Which path produced these five

`adImageStyle` was NULL on the kit, so `orchestration.ts:857` routed to neither `isTemplate` nor
`isEditorial` → the **tabloid path**, `runAdCreativesGeneration` on **flux-1.1-pro**
(`imageGeneration.ts:47`). All five outputs are 1:1, matching that path's `imageFormat: "1080x1080"`.
The editorial path (flux-2-pro, zone-aware) did not run. **Everything below is the tabloid path.**

Variation → style mapping confirmed against the pixels via `VARIATIONS`
(`adCreativesGenerator.ts:425-431`):

| File | style | formula | headline |
|---|---|---|---|
| v1 | `person_shocked` | benefit | BABY SLEEPS THROUGH IN 3 WEEKS. |
| v2 | `screenshot` | social_proof | FROM 2-HOUR BEDTIMES TO 7PM DONE. |
| v3 | `person_intense` | curiosity | IT'S NOT THE HABIT. IT'S THE SEQUENCE. |
| v4 | `object` | contrast | ROCKING HER DOWN VS. SHE GOES DOWN. |
| v5 | `person_curious` | challenge | STOP FEEDING TO SLEEP EVERY NIGHT. |

---

## 1. P6 — GENDER MISMATCH · **[CODE] prompt defect. Not a model choice.**

**Root cause: `server/routers/adCreatives.ts:78-110`, `generateAdImagePrompt`.**

Every one of the five style templates describes the subject as exactly:

```
Person (30-45 years old) dressed and styled for the ${niche} world
```

There is **no gender term, no ICP demographic, no age of the child** anywhere in the prompt. The
function's whole signature is `(style, niche, problem, uglyMode)`. `niche` is
`svc.targetCustomer.slice(0,200)` (`orchestration.ts:834`) — an audience label, not a casting brief.

Given "Person, 30-45, dramatic lighting, high contrast, tabloid", flux-1.1-pro's unconditioned prior
for an unspecified adult is male. Five out of five male is the expected result of asking for nothing.

**This would be wrong on any model.** Confirmed by grep: no ad-image code path reads ICP data at all.

### The data exists and is discarded

- `drizzle/schema.ts:285` — `idealCustomerProfiles.demographics` is JSON typed with **`gender`** and
  **`age_range`** keys.
- Measured on prod: **73 of 101** ICP rows have both populated.
- `orchestration.ts:841-851` already loads `icp` and passes `icp.pains / fears / objections /
  buyingTriggers` into **headline** generation — then passes **nothing from `icp`** into
  `runAdCreativesGeneration`. The image prompt is the only generator in step 9 blind to the ICP.

### ⚠️ The field is not directly injectable — this is the real design constraint

Actual prod values of `demographics.gender`:

```
id 254: "All genders; slightly skewed toward women 38–46 in managerial and professional roles…"
id 253: "Mixed, slight skew male 55% / female 45% — both represented equally in the core pain"
id 250: "All genders, skewing slightly female (55–60%)"
id 247: "Female"                                    ← the only clean token in the sample
```

Mostly **hedged distribution prose**, occasionally a clean token. Interpolating that string into a
Flux prompt produces garbage. A photo must depict **one** person; the ICP field describes a
population. The fix needs a resolution step that collapses the distribution to a single castable
subject, not a string concat.

**Also observed and same root cause:** v1 shows a **newborn** for an ICP whose baby is 4–12 months.
Note `generateAdImagePrompt` accepts a `problem` parameter that is **interpolated into none of the
five template strings** — it is a dead parameter. Nothing about the child, the scenario, or the
pain reaches the image.

---

## 2. P7 — GARBLED IN-IMAGE TEXT · **[CODE] prompt defect FIRST, model weakness SECOND**

The garbling is real and it is Flux's. But the prompt is asking for it.

**(a) The prompt requests a text-covered artifact.** `adCreatives.ts:86`:

```
"Gossip magazine style, tabloid aesthetic, phone-quality photo …"
```

A gossip magazine *is* a page of text: masthead, headline, standfirst, body columns, captions. v3 is
flux-1.1-pro competently obeying this — it rendered a full newsprint page with a masthead
("PRESUL"), a three-line display headline and two paragraphs of body copy. Every glyph is garbled,
but the **layout** is exactly what was asked for.

**(b) The negation cannot work.** `adCreatives.ts:95` appends to all five styles:

```
"NO text, NO words, NO letters, NO numbers, NO captions, NO labels, NO signs, …"
```

This is passed as flux-1.1-pro's **positive prompt** — the model has no negative-prompt input in
this call. Diffusion conditioning has no logical NOT; the tokens `text`, `words`, `letters`,
`captions`, `labels`, `signs` are all pushed *toward* the image. This is the diffusion analogue of
the negative-priming anti-pattern CLAUDE.md §14 already bans for LLM prompts, and it is currently
shipping in a live prompt. The file comment at :74-77 states the intent correctly ("removing text
instructions eliminates hallucinated glyphs") — the implementation does the opposite of the comment.

**(c) `prompt_upsampling: true`** (`imageGeneration.ts:55`) sends the prompt through an LLM rewriter
before generation. It routinely drops negations and embellishes stated aesthetics — consistent with
both the newsprint elaboration in v3 and the style drift in v4, where the `object` style ("Relevant
object … document, product, device or tool") produced a person instead.

**(d) The prompt also explicitly orders the green furniture** that then gets captioned. Each style
asks for "Green circle annotation… with checkmark", "Hand-drawn green arrow", "Multiple green
circles around key metrics". A blank green speech bubble is the single most label-inviting shape you
can put in a frame — v4's `"Parenting books"` and `"Baby time parents"` are Flux filling the callouts
it was told to draw. Those two are **crisply rendered** and semantically wrong, which is a different
failure from v3's garbling.

**Correction to STATE.md P7:** it lists `"Baby time parents"` / `"Parenting books"` as garbled. They
are not — they are cleanly rendered nonsense labels. The genuinely garbled text is in **v3** (the
newsprint) and **v5** (`"PARENT'S PARENT'S GUIDE"` on the book cover). Two distinct defects.

**Consequence for the model question:** a better text renderer on this prompt yields *legible*
nonsense instead of *garbled* nonsense. **P7 is not fixed by a model swap.** The prompt has to stop
requesting a magazine and stop drawing empty callouts.

---

## 3. P8 — ALL FIVE SHARE ONE BODY LINE · **[CODE] two independent single-value bottlenecks**

**Root cause 1 — resolved once per batch, outside the loop.**
`adCreativesGenerator.ts:468`:

```ts
const bodyText = await resolveAdBodyText(db, input.userId, input.serviceId);   // ← before the loop
…
for (let i = 0; i < VARIATIONS.length; i++) { …
  await renderAdCreative(rawBuffer, { headline, emphasis, bodyText, ctaLabel });  // ← same string ×5
```

**Root cause 2 — the resolver can only ever return one row anyway.**
`compositeHeadline.ts:141-146`:

```ts
.where(… contentType === "body")
.orderBy(desc(adCopy.id))
.limit(1)          // ← always the single newest body row
```

So even called per-variation it returns the identical string. Both layers independently force
uniqueness-of-one; fixing one alone changes nothing.

**Measured on prod: 3 `contentType='body'` rows exist per service** (1,991 body rows total). Two
usable, campaign-aligned bodies are generated, stored, and thrown away on every batch. This is a
selection bug, not a generation gap — **the fix costs zero additional LLM or image spend.**

Identical across all five variations for the same reason: `ctaLabel` (one per campaign type) and the
`emphasis`/accent treatment.

---

## 4. HEADLINE OVERLAYS THE FACE · **[CODE] compositing defect. Our layer, not the generator.**

**Root cause: `server/_core/compositeHeadline.ts:199-245`.**

The tabloid path calls `renderAdCreative` with **no `zone`** (`adCreativesGenerator.ts:512-517`).
`zone === undefined` selects `align: "center"`, `anchor: "bottom"`, full-width column. The block is
then stacked upward purely from text metrics:

```ts
pillTop  = H - padBottom - pillH;
bodyTop  = pillTop - pillGap - bodyBlockH;
headTop  = bodyTop - headGap - headBlockH;     // ← a function of font sizes ONLY
```

**Nothing in this function ever inspects the photograph.** No face detection, no saliency, no
reserved region. `headTop` is wherever the text stack happens to land. A 3-line headline pushes it
into the vertical middle of the frame — exactly where a portrait's face sits. That is v2, v3 and v5.

**The scrim does not rescue it either.** `compositeHeadline.ts:302-306` starts the gradient at
`stop-opacity 0` at `scrimTop = headTop − 0.06·H` and only reaches 0.72 at 55% down. The headline
therefore renders in the near-transparent part of its own scrim — text on an undarkened face.

**The editorial path already solved this and the tabloid path never got it.** Editorial passes
`zone: scene.zone` (`adCreativesGenerator.ts:620`), and per the type comment at
`compositeHeadline.ts:165-169` that zone **"matches the zone the editorial photo prompt was told to
leave clean"** — a two-sided contract between prompt and compositor. The tabloid path has neither
half: its prompt never reserves space, and its compositor never avoids the subject.

---

## 5. Proposed fixes — labelled by kind

| # | Defect | Kind | Change |
|---|---|---|---|
| A | P6 gender/age | **prompt** | Thread a resolved subject descriptor into `generateAdImagePrompt` |
| B | P6 child age / scene | **prompt** | Use the dead `problem` param, or drop it |
| C | P7 magazine furniture | **prompt** | Stop asking for a tabloid page; delete the `noText` negation; drop empty callouts; turn off `prompt_upsampling` |
| D | Face overlay | **compositing** | Give the tabloid path the zone contract editorial already has |
| E | P8 body repetition | **compositing / selection** | Rotate the 3 stored bodies by variation index |
| F | Model | **model change** | Bake-off — see §6. Do it **after** C, not instead of it |

### A — subject descriptor (prompt)

Add an optional `subject` argument to `generateAdImagePrompt` and thread `icp.demographics` from
`orchestration.ts` into `runAdCreativesGeneration`. Because the stored `gender` is distribution
prose, resolve it rather than interpolate it:

- Read via the existing `normalizeDemographics()` (`_core/icpGrounding.ts`) — already handles the
  snake/camel drift and string-shaped rows.
- Collapse to a single castable subject. Deterministic parse first (`/\bfemale\b|\bwomen\b/i` vs
  `male/men`, taking the *skew* term when the string hedges); fall back to the neutral current
  wording only when genuinely unresolvable, never to a coin flip.
- **Recommendation: resolve once per batch, not per variation.** Five creatives for one campaign
  should show the same audience — varying gender across the deck would look like a bug, and the ICP
  skew is a property of the campaign, not the slot.
- Feed `age_range` in the same descriptor, replacing the hardcoded "30-45 years old".

Zero new API cost. Applies to the editorial path too — `editorialPrompt.ts` should take the same
descriptor.

### B — scene grounding (prompt)

`problem` is already passed to `generateAdImagePrompt` and used by nothing. Either interpolate it as
a scene constraint (which would have carried "4-12 month old" and prevented v1's newborn) or delete
the parameter. Leaving a live dead parameter invites exactly this class of "we thought it was
wired" error.

### C — stop asking for text (prompt) — **the highest-leverage change here**

1. Replace the `Gossip magazine style, tabloid aesthetic` base with a **photographic** brief
   (documentary/candid, dramatic lighting, high contrast). Keep the raw, non-studio feel; drop the
   *publication* metaphor. A magazine prompt requests page furniture.
2. **Delete the `noText` string entirely.** It is a positive-prompt negation; it primes what it
   forbids. If flux-1.1-pro is kept, its API has no negative-prompt field on this endpoint, so the
   only lever is *not naming text at all*.
3. **Drop the green circles / arrows / checkmarks from the prompt.** They are the caption bait, and
   we can composite clean vector annotations ourselves with real type — the same resvg layer that
   already draws the headline, body and CTA. This converts a Flux weakness into our strength.
4. Set **`prompt_upsampling: false`** and re-measure. The upsampler is rewriting away the constraints
   and driving style drift (`object` → person in v4).

Items 1–3 are prompt-only, no migration. Item 4 is a one-line flag with a real quality trade-off —
worth an A/B before locking.

### D — zone contract for the tabloid path (compositing)

Two options; **recommend the second.**

1. *Cheap:* always pass `zone: "bottom"` on the tabloid path and darken the scrim's upper stop. Puts
   the headline in the lower third with real contrast behind it. ~2 lines. Does not stop a tall
   subject from occupying the lower third.
2. *Correct, and matches what editorial already does:* extend the two-sided contract. Tell the photo
   prompt to compose the subject in a named half and leave the other clean, then pass the matching
   `zone` to `renderAdCreative`. The plumbing exists — `zone` is already a supported input and the
   left-column scrim is already implemented (`compositeHeadline.ts:296-309`). This is mostly a
   prompt change plus one argument.

A saliency/face-detect pass is the general solution but is a much larger scope; the zone contract
gets most of the benefit and is already proven in this codebase.

### E — rotate the body copy (selection)

In `resolveAdBodyText`, raise `limit(1)` to fetch up to N rows and return the list; in the generator,
move resolution to per-variation and index `bodies[i % bodies.length]`. With 3 stored bodies across 5
slots that yields 3 distinct lines (pattern 1,2,3,1,2) instead of 1. No extra spend.

If genuinely-5-distinct is wanted, that is a separate ask on the ad-copy generator's deck size, not a
creatives change — and it is worth noting Auto Mode's `liteMode: true` is what caps the deck
(STATE.md "not defects"). **Recommend shipping the rotation first** and treating deck size as its own
decision.

**Entity-ID note:** Meta's diversity signal reads the creative asset, and each of these five already
carries a different image and a different headline. The identical body line makes the *deck* look
thin to a coach reviewing it, and reduces genuine test surface — that is the real cost. I have not
verified a specific Meta clustering behaviour on body text and am not asserting one.

---

## 6. Image-model evaluation — FLUX vs OpenAI

Scope is the **generation call only** (`imageGeneration.ts:43-99`). Cloudinary stays: `generateImage`
already downloads and hands a Buffer to `storagePut`, so a provider swap does not touch hosting or
transforms. OpenAI's Images API returns base64 rather than a URL, which *removes* the intermediate
fetch — the seam is genuinely contained.

### Cost — actual published prices, not estimates

**Current (verbatim, replicate.com/pricing):** `black-forest-labs/flux-1.1-pro` — **"$0.04 / output
image"**. Matches the `~$0.04` in the code comment at `adCreativesGenerator.ts:15`.

**OpenAI (verbatim, developers.openai.com image-generation guide), 1024×1024:**

| Model | Low | Medium | High |
|---|---|---|---|
| gpt-image-1 | $0.011 | $0.042 | $0.167 |
| gpt-image-1-mini | $0.005 | $0.011 | $0.036 |
| gpt-image-2 | $0.006 | $0.053 | $0.211 |

**At 5 creatives per campaign:**

| Option | Per campaign | vs today |
|---|---|---|
| **flux-1.1-pro (today)** | **$0.20** | — |
| gpt-image-1-mini · high | $0.18 | **−10%** |
| gpt-image-1 · medium | $0.21 | **+5%** |
| gpt-image-2 · medium | $0.265 | +33% |
| gpt-image-1 · high | $0.835 | +318% |
| gpt-image-2 · high | $1.055 | +428% |

**The headline cost finding: gpt-image-1 at medium is $0.042 vs Flux's $0.040 — cost-neutral. And
gpt-image-1-mini at *high* quality is cheaper than Flux is today.** Cost is not the blocker anyone
assumed it was; the decision rests on quality and latency. The 4–5× tiers are the only ones that
would change unit economics, and nothing so far argues we need them.

*(flux-2-pro, used by the editorial path, is not on Replicate's pricing page. Third-party sources
put it at $0.015 + $0.015/megapixel ≈ $0.055 per 1024². Treat as indicative, not verified.)*

### Quality — what to test, and the honest caveat

OpenAI's own guide says of gpt-image-2: *"Although significantly improved, the model can still
struggle with precise text placement and clarity."* Better, still not reliable.

**This matters more than it first appears.** Per §2, the text in our creatives is text we never
wanted. The goal is **zero** in-image text, and for that the relevant property is *instruction
adherence* — will the model leave the frame clean when asked — not text fidelity. On that axis
OpenAI's models are architecturally better placed than flux-1.1-pro, because they follow
instructions rather than condition on token proximity, so a "leave this area clean, no signage"
instruction can actually land.

That argues the bake-off should be judged on:

1. **Clean-frame rate** — of N images, how many contain zero unrequested glyphs. *The primary metric.*
2. **Subject adherence** — does a stated gender/age descriptor actually produce that person (fix A is
   worthless if the model ignores it).
3. **Zone adherence** — does "leave the lower third clean" hold, which is what fix D depends on.
4. Legibility of any text that does appear — secondary, since we want none.

### Reliability and latency — **not measured, do not assume**

I have run no OpenAI image calls and benchmarked no latency this session. The only figure I have is
the in-repo comment (`adCreativesGenerator.ts:16`): flux-1.1-pro, 5 images sequential, **~2–2.5 min
wall-clock** (~25–30s each). Step 9 is the cascade's terminal node and already carries
`optional: true`, so it degrades rather than kills a run — latency has headroom, but a materially
slower model would stretch an already-long cascade. **This needs measurement, not estimation.**

### Recommended sequence

1. **Ship fix C first** (prompt stops asking for a magazine, negation deleted, callouts dropped,
   upsampling off) and re-run on flux-1.1-pro. This is free and may resolve most of P7 on the current
   model. **It also establishes the corrected prompt that any bake-off must use** — comparing models
   on the current prompt would test which model draws a nicer garbled newspaper.
2. **Then bake off** on the corrected prompt: same 5 real ZAP prompts × flux-1.1-pro vs gpt-image-1
   medium vs gpt-image-1-mini high, scored on the four axes above, with latency recorded per call.
   ~30 images, roughly **$1.20** total. Never generic test prompts.
3. Decide on evidence.

Doing the swap first would attribute a prompt defect to the model and buy a migration we may not
need.

---

## 7. Summary — cause by kind

| Defect | Kind | Location |
|---|---|---|
| P6 gender + child age | **prompt** (data exists, never threaded) | `routers/adCreatives.ts:78-110` · `orchestration.ts:834` |
| P7 garbled text | **prompt** (asks for a magazine, negates in the positive prompt) then **model** | `routers/adCreatives.ts:86,95` · `imageGeneration.ts:55` |
| P8 one body line ×5 | **selection** (two independent limit-1 bottlenecks) | `adCreativesGenerator.ts:468` · `compositeHeadline.ts:145` |
| Headline over face | **compositing** (no zone contract on the tabloid path) | `compositeHeadline.ts:199-245,296-309` |

**Only one of the four is a model problem, and it is the second half of a prompt problem.**
