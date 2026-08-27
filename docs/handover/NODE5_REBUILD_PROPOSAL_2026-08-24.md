# Node 5 (Lead Magnet / HVCO) — scope findings + rebuild proposal

**2026-08-24. Read-only pass. Nothing was changed in `server/` or `client/`; nothing staged,
committed or pushed.** HEAD `0ef00bb` on `railway-build`.

The only writes were the two the task authorised: six research reports copied into
`docs/lead-magnet-research/` (checksums verified against the `~/Downloads` originals) and a
`README.md` written beside them.

Search tooling: `grep` here is `ugrep`, so `rg` (ripgrep) was used throughout and a **positive
control was run before any zero was trusted** (`rg -n "screenLeadMagnetBody" server` → 9 hits).
No `--include` stacking, no `timeout` around extraction.

---

## THE HEADLINE FINDING

**The Golden Thread is breaking at Node 5, and it breaks in a specific, narrow way that is easy to
miss: the lead-magnet BODY generator receives the mechanism's NAME and nothing else.**

Not "the mechanism is missing". The cascade map is correct, the title generator is correctly wired,
and a string called `mechanism` genuinely reaches the body prompt. What reaches it is a varchar —
typically three to six words — where the Offer node and five other downstream nodes receive a
900-character description carrying the steps, the differentiator and the source-tier caveat.

Node 5 is therefore the one node that is told the *name* of the coach's method and never told what
the method *is*. Asked to write the coach's method in miniature, it has nothing to miniaturise.

---

## Q1 — Does the lead-magnet generator receive Node 4's unique mechanism as context?

**Two generators sit at Node 5, and they answer differently.**

### The TITLE generator — ✅ correctly wired

`server/hvcoGenerator.ts:71`

    const cascadeContext = await getCascadeContext(input.userId, icp?.id, "hvco");

and prepends it to all four prompts (`:183`, `:242`, `:293`, `:339`). The cascade map at
`server/_core/cascadeContext.ts:87` declares `hvco: ["offer", "mechanism"]`, and
`describeMechanism` (`:341-367`) renders name + descriptor + **900 chars of
`mechanismDescription`** via `truncateAtSentence`, plus the `guarded_fallback` confidence caveat.

**The title generator gets the full mechanism.** This half of the node is fine.

### The BODY generator — 🔴 this is the break

`server/leadMagnetContentGenerator.ts` **never calls `getCascadeContext`.** It is absent from the
list of ten callers (`offersGenerator`, `whatsappSequenceGenerator`, `bonusGenerator`,
`adCopyGenerator`, `hvcoGenerator`, `conceptScriptGenerator`, `heroMechanismsGenerator`,
`emailSequenceGenerator`, `landingPageGenerator`, `headlinesGenerator`). It hand-rolls its own
context in `gatherContext` (`:139-183`) instead.

The mechanism resolution, in full — `server/leadMagnetContentGenerator.ts:156-165`:

    let mechanism = service.uniqueMechanismSuggestion || "";
    if (icp?.id) {
      const [kit] = await db.select().from(campaignKits)
        .where(and(eq(campaignKits.userId, userId), eq(campaignKits.icpId, icp.id))).limit(1);
      if (kit?.selectedMechanismId) {
        const [m] = await db.select({ name: heroMechanisms.mechanismName }).from(heroMechanisms)
          .where(eq(heroMechanisms.id, kit.selectedMechanismId)).limit(1);
        if (m?.name) mechanism = m.name;
      }
    }

**The `.select({ name: heroMechanisms.mechanismName })` projection is the defect.** It reads the
correct row, through the correct foreign key, and takes one column off it.

It lands in the prompt as a single line — `contextBlock`, `:197`:

    c.mechanism ? `The named method behind it: ${c.mechanism}` : "",

**Three-level degradation, worst case first:**

| Level | Value of `mechanism` | Source |
|---|---|---|
| Best | `heroMechanisms.mechanismName` — **name only** | Node 4 output, one column of it |
| Fallback | `services.uniqueMechanismSuggestion` | Node 1, **LLM-invented** |
| Floor | the literal string `"the method"` | `:180` |

🔴 **The fallback is the field Node 4 explicitly refuses to trust.**
`server/heroMechanismsGenerator.ts:190-192`:

> `services.uniqueMechanismSuggestion` is DELIBERATELY ABSENT from that list. It is LLM-invented at
> the service node and unconditionally overwritten there, so feeding it back in would launder an
> invention into evidence — the exact loop this rebuild exists to break.

Node 5 uses that exact field as its default. When no mechanism is selected, the lead magnet is
grounded in the invention Node 4 was rebuilt to stop laundering.

### Precisely what the body generator DOES get

`MagnetContext` (`:124-137`), assembled at `:172-183` — eleven fields, all of them truncated:

| Field | Source | Cap |
|---|---|---|
| `title` | the selected HVCO title | — |
| `niche` | `services.targetCustomer ?? category ?? "coaching"` | 200 |
| `programme` | `services.name` | 120 |
| `mainBenefit` | `services.mainBenefit` | — |
| **`mechanism`** | **`heroMechanisms.mechanismName` only** | **varchar(255)** |
| `offerDescription` | `services.description` | 400 |
| `icpPains` | `idealCustomerProfiles.pains` | 600 |
| `icpGoals` | `idealCustomerProfiles.goals` | 400 |
| `icpBarriers` | `idealCustomerProfiles.implementationBarriers` | 400 |
| `sot` | `sourceOfTruth` coreOffer · mainBenefits · uniqueValue | 400 |
| `contentBrief` | caller-supplied (bonus path only) | 800 |

**What is available on the selected row and never read:** `mechanismDescription` (text, measured
average ~1,195 chars), `descriptor`, `whyProblem`, `whatTried`, `whyExistingNotWork`,
`application`, `desiredOutcome`, `credibility`, `sourceTier`, `coachMethodId`.

**And beyond that, the tier-1 table it points at** — `coachMethods` (`drizzle/schema.ts:57-69`):
`steps` (JSON, name + whatHappens per step), `operationalTwist` (the ordering claim Node 4's
validation identified as the real differentiator), `ump` / `ums`, `oldVehicle`, `differentiator`,
`confidence`. Node 5 reads none of it and does not know the table exists.

**Note the asymmetry this creates.** The lead magnet is referenced *downstream* by name only, and
that is a deliberate, documented decision (`cascadeContext.ts:36-45` — "HVCO carries `title` only …
Downstream copywriters need 'Reference [HVCO_TITLE] as the free resource'"). That reasoning is
sound for what flows *out* of Node 5. It was never a decision about what flows *in*, and the body
generator ended up name-only in both directions.

### All three body-generation call sites share the defect

`gatherContext` is the single context path, so every writer inherits it:

- `server/_core/orchestration.ts:438-443` — the cascade, the path every coach hits
- `server/routers/hvco.ts:200-206` — the quiz regenerate
- `server/bonusPdfGenerator.ts:37-60` — the bonus path

One fix at `gatherContext` reaches all three. That is the good news in this finding.

---

## Q2 — Are there length or size limits per format?

**Four formats exist** (`:20`): `guide` · `checklist` · `toolkit` · `quiz`. **There is no video
script format**, and no calculator or email mini-course format — three of the six formats the
research treats as first-class have no implementation to limit.

Format is not chosen by the coach. It is inferred from keyword signals in the selected title
(`inferLeadMagnetFormat`, `:114-121`), most-specific-first (quiz → toolkit → checklist), with
**`guide` as the default for everything unmatched** (`:120`).

**Limits by format, and where each one actually lives:**

| Format | Stated limit | Where it is stated | Enforced? |
|---|---|---|---|
| **guide** | 3–6 sections | prompt prose, `:302` | 🔴 **No** — accepted at `sections.length > 0` (`:415`) |
| **checklist** | 7–15 items | prompt prose, `:303` | 🔴 **No** — accepted at `items.length > 0` (`:416`) |
| **toolkit** | 3–4 tools | prompt prose, `:304` | 🔴 **No** — accepted at `tools.length > 0` (`:417`) |
| **quiz** | 7 questions (6–8 acceptable); 3–4 bands | prompt prose, `:308-311` | ✅ **Yes** — `validateQuizBody` (`:323-372`) |

**`validateQuizBody` is the only real enforcement in the node**, and its bounds are wider than the
prompt asks for: questions `>= 5` and `<= 12`, options `>= 3` per question with at least two
distinct weights, bands `>= 3` and `<= 5`, bands contiguous and partitioning 0–100 exactly, every
band carrying name/teaser/meaning/cta. It runs at `:411` and, on failure, drives the retry.

**Everything else is a suggestion the model may ignore without consequence.** Specifically:

1. **No `minItems` / `maxItems` anywhere in the JSON schemas.** `schemaFor` (`:229-291`) uses bare
   `arr(...)` throughout. Verified: `rg "maxLength|minItems|maxItems|maxWords"` over the file
   returns nothing.
2. **No length cap on any string.** Every field is `{ type: "string" }`. A guide section body may
   be a single sentence or three thousand words; nothing measures it.
3. **The acceptance test is non-emptiness.** `:415-418`: a one-section guide, a one-item checklist
   and a one-tool toolkit all pass and persist.
4. **No page, word or character budget exists anywhere** — not in the generator, not in
   `leadMagnetRenderer.ts`, not in the PDF path. "1–2 pages" is not a concept the code holds.
5. **The unbounded format is also the default format.** Any title whose keywords miss all three
   signal lists becomes a `guide`, the one format with no upper bound at all.

---

## Q3 — Does the asset end with a bridge, or simply stop?

**Structurally the bridge is there and it is required. Functionally the link is broken, and in the
downloadable it is a literal dead end.**

### What is enforced

`nextStep` (`heading`, `body`, `ctaLabel`) is in the `required` array of all four strict
`json_schema` response formats (`:241`, `:246`, `:255`, `:286`) — the model cannot omit it. The
quiz additionally requires a **per-band `cta`** of the same shape (`:277`), and `validateQuizBody`
rejects any band missing it (`:365-366`). Both system prompts close on "no dead end" (`:207`,
`:209`), and the user prompt names the destination and asks for a concrete label (`:295-297`).

**This part is done well and should be kept.**

### 🔴 Where it breaks — three separate places

**1. Inside the downloadable, the CTA is a dead anchor.**
`server/leadMagnetRenderer.ts:223-226`, `nextStepBlock`, used by guide (`:232`), checklist (`:237`)
and toolkit (`:244`):

    `<p>${esc(n.body)}</p><a class="cta" href="#">${esc(n.ctaLabel)}</a></section>`

`href="#"`. In the hosted HTML the button goes nowhere; in the PDF it is a styled rectangle. The
"back page CTA" the research builds its whole implementation protocol around is, in the artifact
the reader actually keeps, unclickable.

**2. On the delivery page, the CTA loops back to the magnet itself.**
`server/leadMagnetRenderer.ts:382`:

    var c = document.getElementById('next_cta'); c.textContent = NEXT.ctaLabel || 'Learn more'; c.href = view;

`view` is `d.magnetHtmlUrl || CFG.deliverableUrl` (`:376`) — the lead magnet they have just been
given. The "Your next step" card renders the correct heading and body and then sends the reader
back to the thing they already have. **This is the dead-end failure mode implemented as a loop.**

**3. Only the quiz points anywhere real.** `:585`:

    var a = $('qz_cta_a'); a.textContent = band.cta.ctaLabel || 'Learn more'; a.href = CFG.pageUrl || '#';

The quiz result CTA goes to the landing page, falling back to `'#'`. Of the four formats, one has
a working destination.

### A conflict worth naming before anything is built

The generator bridges to **the paid programme**: `programme = services.name` (`:176`), and the
prompt reads *`End with a nextStep that bridges to "${programme}"`* (`:296`), example label
*"Book My Free Call"*.

The research (`the-bridge-to-the-next-step.md` §5) is explicit that the bridge is to exactly **one
free next step**, and that the back-page CTA must offer **exactly one action**. The two are not the
same target, and which one ZAP should bridge to is a product decision, not a code decision.

---

## Q4 — Does the compliance gate scan lead-magnet body content?

**Yes — the body is scanned. But it is scanned advisory-only, and it is the one asset class with no
blocking check anywhere on its path to a real reader.**

### What scans the body

`screenLeadMagnetBody` (`server/_core/persistenceGate.ts:114-120`) — one shared helper, all three
writers routed through it, pinned by a test that asserts none of them hand-rolls the extraction
(`server/_core/node5Screening.test.ts:152-158`):

- `server/_core/orchestration.ts:452-453` — the cascade
- `server/routers/hvco.ts:212-213` — the quiz regenerate
- `server/bonusPdfGenerator.ts:72-73` — the bonus PDF

It extracts every string ≥ 12 chars to **depth 6** (`copyFieldsOfJson`) — the raise that first made
quiz band CTAs at `assetBody.scoring.bands[i].cta.body` visible at all — and runs the real
`checkOutput` with the coach corpus and supplied-proof grounding.

### 🔴 It never blocks anything

`persistenceGate.ts:264-270` — on blocking hits it emits `console.warn` and **returns them**. The
comment above the function is unambiguous and deliberate:

> ⚠️ ADVISORY BY DESIGN — screens, logs, returns. It never throws and never blanks a field …
> Do not convert this into a gate without Arfeen's word.

**That decision is correct and I am not proposing to reverse it.** Blanking a coach's deliverable
is worse than shipping copy they can edit. The problem is not the advisory screen. The problem is
what sits downstream of it.

### The asymmetry, stated plainly

| Asset | Persist-time | Publish-time |
|---|---|---|
| HVCO **titles** | 🟡 **blocking** — `gateBeforePersist("hvcoTitles", …)` (`server/db.ts:189`) drops failing rows | via landing page |
| Headlines / Ad copy | 🟡 blocking (`db.ts:108`, `adCopyGenerator.ts:1757`) | 🔴 **blocking** — `routers/meta.ts` refuses the Meta publish |
| Landing page | 🟡 blocking (`landingPageGenerator.ts:1048`) | 🔴 **blocking** — `landingPagePublisher.ts:198-210` **throws** on 11 named fields |
| **Lead-magnet body** | 🟢 **advisory only** | ⚪ **nothing** |

`server/leadMagnetPublisher.ts` contains **no compliance call of any kind** — verified by direct
search of the file. The LP publish gate scans `eyebrowHeadline`, `mainHeadline`, `subheadline`,
`problemAgitation`, `solutionIntro`, `whyOldFail`, `uniqueMechanism`, `insiderAdvantages`,
`shockingStat`, `timeSavingBenefit`, `primaryCta` — **the eleven landing-page fields, and not one
field of the magnet body**, even when that landing page is the `lead_magnet_download` page hosting
the magnet.

So: **the title cannot persist if it is non-compliant, and the body it introduces can be published
to the open web whatever it says.** The body is also the longest asset ZAP generates, and the only
one a prospect keeps a copy of.

---

# THE REBUILD PROPOSAL — plan only, no code

Ordered by risk, riskiest first, as asked. Nothing below is started.

---

## 🔴 RISK 1 (highest) — repointing the bridge CTA

**Why this is the riskiest thing on the list, ahead of the mechanism fix.** It is the only change
that alters what a real prospect clicks on a live coach's page, and it is the only one where **I do
not know the correct answer and cannot derive it from the code.**

Three problems compound:

1. **There is no field that reliably holds a next-step destination.** The quiz uses `CFG.pageUrl`;
   the other three formats have nothing. Before any of this is designed, someone has to establish
   what URL a coach's "next free step" actually is in ZAP today — a booking link, the landing page,
   a GHL calendar, or nothing at all. **I have not traced that and am not going to assume it.**
2. **A wrong destination is worse than `href="#"`.** A dead button reads as an unfinished page. A
   button that sends a warm lead to the wrong place loses the lead silently and the coach never
   finds out.
3. **Already-published magnets do not update.** The renderer runs at publish time, so existing
   hosted pages and PDFs keep the broken markup until republished. A republish sweep over live
   coach assets is a **production write** and needs its own explicit authorisation, separately from
   authorising the code change. It is not part of this proposal.

**Proposed shape, for discussion only:** resolve one destination in the publisher, pass it into the
renderer, use it for all four formats, and where no destination resolves, **render the next-step
card as text with no button at all** rather than a dead one. Never invent a URL.

**Decision needed from Arfeen before this can be scoped further:** does the lead magnet bridge to
the **paid programme** (what the code does now) or to **one free next step** (what the research
says)? Everything else about this item follows from that answer.

---

## 🟠 RISK 2 — the mechanism injection itself

The main ask, and mechanically the smallest change in the list: widen the `.select()` at
`leadMagnetContentGenerator.ts:161`, carry the description into `MagnetContext`, and give it real
estate in `contextBlock` instead of one line.

**It is second on the risk list rather than fifth for one non-obvious reason.** `CHECKPOINT.md`'s
own Node 4 backlog records that mechanism descriptions **read as consultant prose** (item 3, "~1,200
characters of analytical register") and that **the new Node 4 copy trips the persistence gate on
multiple classes** (item 7). Injecting ~900 characters of that into the magnet prompt can plausibly
push both the register and the compliance-hit rate of Node 5 output in the wrong direction — into
the one asset that has no blocking gate downstream of it (Q4).

**So the mechanism fix and the compliance work below are coupled. Doing the first without the
second widens an unguarded surface.**

Open questions I am flagging rather than resolving:

- **Which channel?** Reuse `getCascadeContext(userId, icpId, "hvco")` so Node 5 shares one truth
  with the other six nodes and inherits the `guarded_fallback` caveat for free — or read the
  columns directly for finer control over how they are laid out in the prompt. I lean to the
  cascade helper on consistency grounds, but the body prompt is structured differently from the six
  prompts that prepend a context block, so this needs a design pass rather than an assertion.
- **How much?** The 900-char cap was chosen against the *downstream* distribution. Node 5 is the
  node that needs the method most and may warrant more. That is a measurement, not a guess.
- **Should Node 5 read `coachMethods` (tier 1) directly?** `steps` and `operationalTwist` are
  exactly the "milestones and hidden obstacles" the grounding research asks the free asset to
  teach. ⚠️ **But `coachMethods` is empty on production** and, per Node 4 backlog item 1, its entry
  point is effectively unreachable. **Building Node 5 on it would build on a path no coach can
  reach today.** My recommendation: design for it, read it opportunistically, never depend on it —
  and treat Node 4 backlog item 1 as the real unblocker.
- **Kill the invented fallback.** `services.uniqueMechanismSuggestion` should stop being Node 5's
  default. Whether the floor becomes "no mechanism line at all" or something else is a small
  decision with a real correctness argument behind it.

---

## 🟠 RISK 3 — enforcing per-format size limits

**The risk is not the limits. It is the failure mode when they are missed.** Today a thin body
retries once and then returns `null` (`:429`), leaving `assetBody` NULL and the coach with a magnet
that has no content. Adding hard bounds to guide/checklist/toolkit adds three new ways to reach
that state, on the path every coach hits.

**Proposed approach:** bound the arrays in the JSON schema (`minItems`/`maxItems`) so the model is
constrained at generation rather than rejected after it, and keep the post-hoc validator for what a
schema cannot express. Schema-level bounds do not consume a retry.

⚠️ **The numbers themselves are a decision I am explicitly not making.** The sizing bands in
`lead-magnet-depth-and-length.md` §2 are structurally sensible and their **statistics are
unverified** — per the README just banked, no figure from that folder may reach a prompt, a UI
string or a comment justifying a constant. Any limit adopted is **our engineering decision**, with
our own reasoning written next to it. The research informs the shape; it does not get cited.

Also open, and a real scope question: **should the guide stay the default format?** It is the one
format with no natural size ceiling, and it catches every title the three signal lists miss.

---

## 🟡 RISK 4 — closing the compliance asymmetry

The advisory persist-time screen stays advisory. **I am not proposing to change it**, and per the
standing note it could not be changed without Arfeen's explicit word regardless.

The gap to close is the other end: `leadMagnetPublisher.ts` has no gate, while the landing page
that links to it throws on eleven fields. The shape that matches the rest of the codebase is a
**publish-time check on the magnet body**, mirroring `landingPagePublisher.ts:198-210` — the coach
can generate and edit freely, and the hard stop lands where it lands everywhere else: at the moment
the asset becomes public.

⚠️ **This is a new blocking gate on a live path and needs its own explicit authorisation.** It
should also be measured before it is proposed for real: run the existing advisory screen over
stored production `assetBody` rows and count what *would* have blocked. If that number is large,
the answer is a copy fix in the generator, not a gate that stops coaches publishing.

---

## 🟢 RISK 5 — the format roster, and the standard's central tension

Two items that are product decisions, not engineering ones. Both need Arfeen.

**1. Which formats exist.** Four are implemented; the research treats six as first-class, and the
three missing ones (mini-video training, email mini-course, interactive calculator) are each a
build of their own, not a variant. Whether Node 5 grows to cover them is a scope call. Nothing
about the four existing formats depends on the answer.

**2. 🔴 The 80/20 bar and "teach the what, not the how" may be in direct conflict — and this is the
one that decides what the rebuild is even for.**

The shipped system prompt (`:206`) sets the bar at *"~80% immediately-usable tools (swipe copy,
fill-in templates, SOPs, scripts, worksheets) and only ~20% teaching"*. The toolkit format is built
entirely around it. `grounding-practitioner-methodology.md` §3 puts *customised execution and
step-by-step implementation* on the **paid** side of the line and *milestones, hidden obstacles,
root-cause diagnosis and reframing* on the **free** side.

Read strictly, ZAP's current bar is closer to teaching the HOW than the WHAT.

**I am not going to resolve that by inference, for two reasons.** The 80/20 bar was a deliberate
product decision with a lot of shipped work behind it. And I have not seen the written Node 5
standard — it lives outside the repo (per the README's point 3 and `CHECKPOINT.md`), so I cannot
know whether it already reconciles these two, or which way.

**This is the first thing I need from you, because the answer changes what "rebuild" means.** If
the standard holds the 80/20 bar, the rebuild is plumbing: mechanism in, sizes bounded, bridge
fixed. If it adopts "teach the what", the prompts are rewritten from the ground up and the toolkit
format's whole premise is on the table.

---

## What I am NOT proposing

- No change to the advisory persist-time screen.
- No republish of existing live magnets.
- No change to the `describeHvco` name-only rule for what flows *downstream* of Node 5 — that
  decision is documented, reasoned, and about a different direction of travel.
- No migration. Nothing above needs a schema change.
- No touching Node 4's backlog beyond flagging item 1 as the `coachMethods` unblocker.

---

# STEP 1 RESULT — production `assetBody` compliance audit (read-only, 2026-08-24)

Ran the **existing** `screenLeadMagnetBody` over every stored production `assetBody` row. Driver
scripts live in the scratchpad, outside the repo. Selects only — `screenOnPersist` reads
`services` + `idealCustomerProfiles` and returns; `checkOutput` is deterministic (no LLM, no
network, verified by search). **No writes.**

## The numbers

    ROWS SCANNED           : 8   (hvcoTitles 2 + bonuses 6)
    ROWS WITH NO serviceId : 0
    FIELDS EXTRACTED       : 161
    ROWS THAT WOULD BLOCK  : 8/8 (100%)
    TOTAL BLOCKING HITS    : 72

| Violation class | hits | rows |
|---|---:|---:|
| `invented_named_third_party` | 24 | 5 |
| `unearned_authority` | 12 | 2 |
| `clinical_outcome_claim` | 10 | 4 |
| `second_person_protected_attribute` | 6 | 2 |
| `invented_statistic` | 6 | 4 |
| `negative_self_perception` | 5 | 2 |
| `deceptive_urgency` | 5 | 1 |
| `invented_testimonial` | 4 | 3 |

| Format | rows | blocked | fields | hits |
|---|---:|---:|---:|---:|
| toolkit | 6 | 6 (100%) | 109 | 66 |
| checklist | 2 | 2 (100%) | 52 | 6 |
| guide | 0 | — | — | — |
| quiz | 0 | — | — | — |

**By field location — this is the finding:**

    tools[].content   61      items[].detail   4      nextStep.body   3
    title              2      tools[].name     1      items[].label   1

**62 of 72 hits (86%) land in the toolkit's `tools[].content`.**

## What the hits actually are

The 100% rate is **not** 100% non-compliant copy. Sampled every hit; the dominant classes are
classifier misfires against a field shape no other asset class has — `tools[].content` is markdown
containing Title-Case headings, bracketed placeholders, quoted UI labels and worked examples.

- **`invented_named_third_party` (24 hits, the largest class) is almost entirely Title-Case
  heading detection.** Matches include `Pixel Exists`, `Is Installed`, `Data Sources`, `Add Events`,
  `Open Website`, `Event Setup Tool`, `Client Type`, `Brand Guidelines`, `Running Log`,
  `Plain English`. Two of them — `Chrome Web Store`, `Pixel Helper` — are **real products correctly
  named** in a Meta pixel SOP.
- **`deceptive_urgency` (5 hits, 1 row) fires on a banned-phrases list.** The tool teaches the coach
  what *not* to write; the matches are `Banned`, `BANNED`, `banned` and the example
  `doors close FOREVER` it tells them to avoid. **The asset teaching compliance is blocked for
  quoting the non-compliant phrase.**
- **`clinical_outcome_claim` (10 hits) is proximity matching across unrelated words** in long
  markdown: `fix … pain`, `fix … diagnosis`, `Reverse … body`, `Fix … fatigue` — copywriting
  vocabulary, not medical claims.
- **`unearned_authority` (12 hits) fires inside fill-in swipe copy** the coach completes with their
  own facts: `my ideal client`, `one client`, `three clients`, `helped a client`, `I've worked with 30`.
- **`invented_testimonial` (4 hits) misfires on short quoted strings**: `Glad it landed`,
  `Payment method added`, `Keep this completed`.
- **`second_person_protected_attribute` (6 hits)** mostly fires on worksheet prompts asking the
  coach about *their client's* symptoms, plus the placeholder
  `[THE SPECIFIC SYMPTOM YOU EXPERIENCED …]`.

**The residue that looks genuine is small and specific:** `invented_statistic` on generated
benchmark figures (`1.5%`, `0.8%`, `20%`, `25%`, `80%`), and two `unearned_authority` hits on the
copied `title` field (`48 Hours for Consultants`, `6,000 Branding Client`). Six-ish hits out of 72.

📌 Worth a separate look later: those two title hits are on titles that **persisted through**
`gateBeforePersist("hvcoTitles", …)` at `server/db.ts:189`. The body screen scans the copied
`body.title` under the `"body"` role; the title gate scans the row under its own role. Not
necessarily a contradiction, but the two disagree about the same string.

## What this does and does not gate

**It does not gate step 2, because it cannot.** The corpus is 8 rows — **2 actual lead magnets**
and 6 bonuses — with **zero guide rows and zero quiz rows**. Only 8 of 6,689 `hvcoTitles` rows
carry a body at all, because body generation is gated to `lead_magnet_download` campaigns
(`_core/orchestration.ts:432`) and almost every test campaign is another type. A before/after on
n=2 measures nothing.

**But it answers the underlying question better than a count would have.** The mechanism
description would land in `promise`, `sections[].body` and `nextStep.body` — narrative prose. The
classes dominating today are artifacts of markdown tool content and would not be amplified by it.
The RISK 2 concern (consultant-register mechanism prose raising the hit rate) remains **real and
unmeasured** — this corpus cannot see it.

**Proposed instead, as step 2's proof:** a paired A/B on one real service row — N bodies generated
with the mechanism carried and N without, same service, same title, both screened, hit rates
compared. That isolates the variable, which no audit of existing rows can. Production is dummy
data pre-launch, so it is cheap and safe.

**It does gate step 5, hard.** A blocking publish gate shipped today would block **8 of 8 rows**,
overwhelmingly wrongly. Step 5 must be preceded by a precision pass on `tools[].content` — the same
classifier-precision-under-a-coverage-gap shape `CHECKPOINT.md` §0 records for step 4c. That is now
evidenced rather than predicted.

---

# STEP 2 PROPOSAL — mechanism injection (plan only, no code written)

Read-only measurements taken first; drivers in the scratchpad. Two results changed the proposal
away from the field list I was given, so both are flagged rather than quietly applied.

## Measurements that drive the design

**heroMechanisms, 1,095 rows on production:**

| field | populated | median | p90 | max |
|---|---:|---:|---:|---:|
| `mechanismDescription` | **1095 / 1095** | 1,237 | 1,600 | 2,228 |
| `whyProblem` | 210 (19%) | 382 | 849 | 849 |
| `whatTried` | 210 (19%) | 821 | 1,421 | 1,421 |
| `whyExistingNotWork` | 210 (19%) | 821 | 1,421 | 1,421 |
| `descriptor` | 135 (12%) | 6 | 9 | 9 |

🔴 **`whyProblem` / `whatTried` / `whyExistingNotWork` are service-level, not mechanism-level.**
They are **identical across every mechanism of a service in 57 of 58 services**, and
**`whatTried` is byte-identical to `whyExistingNotWork` on 135 of 210 populated rows (64%)**.

🔴 **`sourceTier` is NULL on all 1,095 rows; `coachMethods` has 0 rows; 0 rows carry a
`coachMethodId`.** The 45 Node-4-rebuild rows were removed in the 2026-08-21 cleanup, so **no
output of the rebuilt extractor exists on production.**

## Proposal 1 — which fields, and how much

| field | carry? | cap | reason |
|---|---|---:|---|
| `mechanismDescription` | ✅ **yes** | **1,600** | 100% populated; 1,600 is the measured p90 — carries the whole description for ~90% of rows, `truncateAtSentence` degrades the rest to a clean paragraph |
| `descriptor` | ✅ yes | as-is | 6 chars median, free |
| `sourceTier` caveat | ✅ yes | as-is | inert today (all NULL), load-bearing the moment Node 4 writes again |
| `whyProblem` | ❌ **no** | — | service-level, duplicated across mechanisms, already covered by ICP pains + `services.description` |
| `whatTried` | ❌ **no** | — | 19% populated and identical to `whyExistingNotWork` on 64% of those |
| `whyExistingNotWork` | ❌ **not in v1** | — | conceptually right (the research's "why traditional approaches fail"), but service-level, 19% populated, and **absent entirely on the richest rows** |

⚠️ **This is a deliberate reduction from the field list I was given, on evidence.** Carrying the
trio would add ~2,000 chars that do not vary by mechanism, are absent on the row the A/B will use,
and largely restate context the prompt already has. The "why the old approach fails" material the
standard wants should come from **`coachMethods.oldVehicle` / `differentiator`** — per-method, not
per-service — once that table has rows.

## Proposal 2 — route through `getCascadeContext`, with one added parameter

**Route through it.** Reasons: Node 5 stops being the only node that hand-rolls upstream context;
it inherits the `guarded_fallback` caveat automatically; and it picks up **`describeOffer`'s
campaign-type awareness**, which suppresses price and guarantee facts on free campaigns — a guard
Node 5 has no equivalent of today.

**The one problem, and the fix.** `describeMechanism` caps at 900 and is shared by six nodes.
Raising it globally moves five other nodes; raising it on the `"hvco"` key also moves the *title*
generator, which shares that key.

**Proposed:** `getCascadeContext(userId, icpId, node, opts?: { mechanismChars?: number })`,
defaulting to **900**. The body generator passes **1,600**; every existing caller is byte-unchanged.
Opt-in at the call site, one file touched, testable.

**Prompt assembly:** prepend the cascade block, delete the now-redundant `The named method behind
it:` line from `contextBlock`, keep `mainBenefit` / `offerDescription` (service-level facts, not
offer-node output) in v1 and let the A/B show whether the prompt is bloated.

## Proposal 3 — no mechanism: say nothing, never invent

Both fallbacks die: `services.uniqueMechanismSuggestion` (the field Node 4 refuses as an invention
— service 233 is a live example, its suggestion *"The Cross-Sector Positioning Audit"* differs from
its selected mechanism *"The Sector Translation Audit"*) and the literal `"the method"`.

When nothing resolves, **no method line is emitted at all**, and the prompt carries a positive
directive to describe the approach in plain descriptive terms from what the coach supplied.
Positive framing only, per CLAUDE.md §14 — never a "do not invent" instruction, which primes the
shape it forbids.

⚠️ **Unsure, flagging rather than assuming:** whether to add a deterministic post-hoc check that
the no-mechanism branch did not introduce a named method anyway. `validateMechanismName`
(`_core/mechanismStandard.ts`) validates a *name*, not free prose, so this would be a new detector.
**Recommend measuring the failure first** rather than building a guard for a rate nobody has seen.

## Proposal 4 — `coachMethods`: designed for, never depended on

Resolution order inside one resolver: `heroMechanisms.coachMethodId` → `coachMethods` row →
`steps`, `operationalTwist`, `oldVehicle`, `differentiator`. Absent, null, or unreadable at any
point falls straight through to the `heroMechanisms` columns. Never a prereq, never an error.

⚠️ **The branch is unreachable on production today** — 0 `coachMethods` rows, 0 `coachMethodId`
values. It can therefore be proven **only by unit test with fakes**, and the handover must say that
plainly rather than implying live coverage. A test pins that the fallback is taken when
`coachMethodId` is null. **Node 4 backlog item 1 (the durable walkthrough button) is the real
unblocker — this proposal does not wait on it.**

## Proposal 5 — the A/B

**Row:** service **233** (non-protected), kit 152, user 1613, ICP 212, mechanism **712** *"The
Sector Translation Audit"* — 1,402 chars of description, the documented Node 4 proving ground with
known-restored state. Alternate if you prefer richer: service 266 / kit 181 / mechanism 912 (1,514
chars). **Protected services 272–277 and 285 are excluded and untouched.**

**Format: `guide`, pinned via `formatOverride`.** Service 233 has 48 guide-inferring titles, and
**zero guide rows exist anywhere on production** — this is also the first look at that format.
Guide is narrative prose, which is exactly where mechanism text lands.

**Three arms, 5 rows each (15 generations), because two arms would confound the variable:**

| arm | context |
|---|---|
| **A** | today's code — mechanism NAME only |
| **B** | cascade block, mechanism still name-only | 
| **C** | cascade block, full 1,600-char mechanism |

**B − A** isolates the offer block's effect; **C − B** isolates the mechanism injection. Two arms
would have measured both at once and attributed the result to the mechanism.

**Held constant:** service, ICP, title (one title, all 15), format, mode `lead_magnet`, model and
parameters, same build.

**🟢 The A/B writes NOTHING.** `generateLeadMagnetContent` returns a body; only `orchestration.ts`
and `routers/hvco.ts` persist. Bodies are screened in-process and results written to the
scratchpad. **The write authorisation is not needed and will go unused.** If that changes I will
come back first. Were persistence ever required, the tag would be `hvcoSetId` =
`abtest-n5-2026-08-24-arm{A|B|C}` — a free varchar(50) and the natural grouping key.

**Measured per row:** blocking hits by class and location · **hits per 1,000 chars of extracted
copy** (arm C is longer; raw counts would mislead) · fields extracted · body length · **grounding**
= count of ≥6-word body spans appearing verbatim in the mechanism description, case/punctuation
normalised (the mechanical check Node 4's tier-1 validation used) · **register proxy** = mean
words/sentence and syllables/word, computed in the driver and reported as a proxy, not a standard
(no readability util exists in `server/` — `pdafGate.ts` is budget bands).

**Decision rule, stated before the run:** ship if arm C's hits-per-1,000-chars is not materially
above arm A's **and** grounding rises. If hits/1k rises materially, the fix is the mechanism
framing in the prompt, not abandoning the injection. Numbers reported either way; no silent caps.

## ⚠️ The limitation this A/B cannot escape

`sourceTier` is NULL on every row and `coachMethods` is empty, so **the A/B measures injection of
LEGACY mechanism prose.** It does not test the rebuilt Node 4 extractor's register — the concern I
raised as RISK 2 — because none of that output exists on production any more.

**Two options, and this is your call:** accept it and state the limitation on the result, or
authorise generating one fresh mechanism set through the rebuilt Node 4 on service 233 first, which
writes `heroMechanisms` rows and is **outside the authorisation I currently hold**.

## Gates

TS baseline holds at 34 · `server/_core/node5Screening.test.ts` and
`server/_core/cascadeContext.truncate.test.ts` stay green · new tests written before the change.

---

# PRE-REGISTERED THRESHOLDS — committed before any generation runs

Both numbers below are fixed now. If the data lands outside them, the numbers do not move.

## Threshold 1 — compliance

**Metric:** blocking hits per 1,000 chars of extracted copy, meaned across the 5 rows of an arm.
Normalised because arm C is longer by construction and raw counts would flatter arm A.

**Arm C passes if:**

    mean(C)  ≤  max( mean(A) × 1.25 ,  mean(A) + 0.5 )

Composite deliberately: a pure ratio is brittle when `mean(A)` is near zero, a pure absolute is
brittle when it is high. Both are committed now and the more permissive applies.

**Also committed:** every per-row value and the arm's min/max spread get reported. **At n=5 this is
a screening signal, not a significance test**, and it will be reported as one. If C fails, the
response is a fix to how the mechanism is framed in the prompt — not abandoning the injection.

## Threshold 2 — grounding, with a ceiling

The verbatim-span metric measures **copying, not grounding**, and a body that parrots the mechanism
would score highest while being the worst result — the consultant-prose problem transplanted rather
than solved. So it is reported as a band, and above the ceiling **a high score is a failure**.

| # | Metric | Healthy range |
|---|---|---|
| **A** | **Body coverage** — % of body words inside verbatim ≥6-word spans shared with the mechanism description | **1% – 8%** |
| **B** | **Mechanism consumption** — % of mechanism-description words appearing verbatim in the body | **≤ 35%** |
| **C** | Mechanism name appears at least once (sanity check, not a discriminator — all three arms carry the name) | yes |

**Where the band comes from, so it is not arbitrary.** Mechanism description ≈ 1,400 chars ≈ 210
words; a guide body ≈ 1,000–1,500 words. At the 8% ceiling a 1,200-word body carries ~96 verbatim
words — roughly **46% of the mechanism transplanted wholesale**, which is parroting by any reading.
At the 1% floor it carries ~12 words, about two spans: minimal lexical contact.

**Stated plainly:** this is a screen for lexical contact, not evidence that the body teaches the
method. **I read the arm C bodies, and that read is the verdict** on whether the method was taught
or transplanted. The metric can only flag the two failure shapes at either end.

---

# 🔴 BLOCKED BEFORE GENERATING — the Node 4 entry point writes outside the authorisation

`runHeroMechanismGeneration` (`server/heroMechanismsGenerator.ts:43`) writes **three** tables, not
one. Traced before running, not after.

| write | table | in scope? |
|---|---|---|
| `createHeroMechanisms(allMechanisms)` (`:515`) | `heroMechanisms` | ✅ authorised |
| `incrementHeroMechanismCount(input.userId)` (`:516`) | `users.heroMechanismGeneratedCount`, user 1613 | ❌ **not authorised** |
| `autoSelectBest(userId, icp.id, "selectedMechanismId", …)` (`:526`) | `campaignKits` | ❌ **not authorised** |

🔴 **`autoSelectBest` overwrites unconditionally** (`routers/campaignKits.ts:181-184` — a bare
`.set({[field]: itemId})`, no null check). Service 233's ICP is **212**, whose kit is **152**, whose
`selectedMechanismId` is **712** — the pointer the 2026-08-21 cleanup recovered from the kit's
persisted trail transcript rather than guessing, because kit 152's downstream assets were built
against it. **Running Node 4 as shipped destroys it.**

There is no `skipAutoSelect` option; the ICP is resolved by `serviceId` fallback and cannot be
suppressed. `ensureCampaignKit` finds kit 152 rather than inserting, so there is **no repeat of the
kit-221 accident** — but the pointer still moves.

**What I need authorised to proceed**, and I am not proceeding on any of it until it is:

1. the incidental `campaignKits.selectedMechanismId` write on **kit 152** that the generator performs;
2. the `users.heroMechanismGeneratedCount` increment for **user 1613** (already left at 3 by the
   2026-08-21 cleanup, so this is consistent with precedent);
3. a **restoring** write setting kit 152's `selectedMechanismId` back to **712** once the A/B is
   done — otherwise kit 152 is left inconsistent with its own downstream assets.

## Tier prediction — measured read-only, before generating

    coachMethods for user 1613 : 0          → tier 1 impossible, exactly as you said
    service.description        : 197 chars
    service.mainBenefit        : 103 chars
    service.applicationMethod  :   0
    sourceOfTruth.*            :   0  (no row)
    TOTAL RAW MATERIAL         : 300 chars   (tier-2 gate is >= 120)

**Tier 2 (`extracted`) will be attempted, and it may degrade to tier 3.** The 300 chars are two
marketing sentences, not an account of how the coach works, and the extractor is built to return an
empty `steps` array rather than invent — at which point `hasSubstance` fails and the guarded
fallback takes over. **Either outcome is a real result about Node 4 on a thin service row.**

## Tagging

`mechanismSetId` is `nanoid()` at `heroMechanismsGenerator.ts:207` and cannot be passed in, so the
rows cannot be tagged at creation. Two options:

- **(a) zero extra writes** — record the returned `mechanismSetId`, the row id range and the
  timestamp here in the handover. Identifiable, nothing extra touched. **Recommended.**
- **(b) one extra UPDATE** on `heroMechanisms` (the authorised table) rewriting the set id to
  `n5ab-2026-08-24`. Human-readable in the DB, but it is still a write and I would want it named.

## Stated limitation, to travel with the result

The durable walkthrough entry point is unbuilt, so **there is no coach conversation to extract
from**. This produces tier 2 or tier 3 output. **The A/B therefore does not test the register of
tier-1 output** — the shape Node 4's own validation proved on 2026-08-21 and the shape a real coach
would eventually produce. This is a stated gap in coverage, not full coverage.

---

# THE IN-PROCESS QUESTION — traced. The split is HALF clean, and the half we need is entangled.

**Answer: not clean enough. We fall back to the legacy mechanism as originally scoped.**

## What is clean

`server/_core/methodExtractor.ts` is **pure — zero DB references of any kind** (verified by search
for `getDb|drizzle|schema|db.`). `extractMethod(rawMaterial, tier, niche) → DistilledMethod | null`
is one LLM call in, a structured object out. It writes nothing and could be run in-process today.

## What is entangled — and it is the part the A/B needs

`server/heroMechanismsGenerator.ts` exports **exactly one function**: `runHeroMechanismGeneration`.
There is no second export, no builder, no seam.

The `heroMechanisms` **row content** — `mechanismName`, and critically `mechanismDescription`, the
1,600-char field the A/B injects — is produced by prompt assembly, LLM invocation, response parsing
and row construction that all sit **inline inside that one function**, between the extraction step
and the write at `:514`. The function then unconditionally runs `createHeroMechanisms` (`:514`),
`incrementHeroMechanismCount` (`:515`) and `autoSelectBest` (`:526`).

**So the analogy to `generateLeadMagnetContent` does not hold.** Node 5 has a real split — the
generator returns a body and `orchestration.ts` persists it, which is exactly why the A/B needs no
writes. Node 4 has no such split: **generation and persistence are one function.** The asymmetry
you spotted between the two nodes is real, and it is the reason this path is closed.

Getting a fresh `mechanismDescription` with zero writes would need one of:

- **(a)** a dry-run seam added to `runHeroMechanismGeneration` — a code change to a shipped
  production path, made solely to enable a test, in a Node 5 sprint, on a node whose problems are
  banked and explicitly not mine to fix here; or
- **(b)** duplicating the inline prompt assembly in a driver — which would measure **my copy of the
  logic, not the product**. That is the exact failure mode CLAUDE.md §15a exists to prevent: a gate
  that passes against a reconstruction rather than the real thing.

Neither is worth it for output that would probably come back tier 3.

## 🟢 One free win worth taking anyway

`extractMethod` being pure means the **`coachMethods` branch of the Node 5 resolver can be unit-
tested against REAL rebuilt-extractor output rather than a hand-written fake.** That branch is
otherwise unreachable — 0 `coachMethods` rows, 0 `coachMethodId` values — and would have been
proven only with a fixture I invented. One LLM call, zero writes, no rows created. **Proposed as
part of step 2's test suite, not as a substitute for the A/B.**

## Honest prediction, on record before running anything

If `extractMethod` is run on service 233's raw material (300 chars: `service.description` 197 +
`service.mainBenefit` 103, everything else empty):

**I expect it to return fewer than two steps, and `hasSubstance` to return false.**

`hasSubstance` (`methodExtractor.ts:74-81`) requires **≥2 steps, each with a non-empty `name` and
`whatHappens`, and ≥1 evidence fragment**. Those 300 chars are two marketing sentences describing
what the service *achieves*, not an account of the sequence a coach puts people through. The
extractor's own system prompt instructs it to return an empty `steps` array when the material does
not say how someone works, and calls that "a correct and useful answer".

**In the real pipeline that means tier 3 — `guarded_fallback`.** Which is precisely your reason for
withdrawing: guarded-fallback prose is synthetic in a different flavour, not meaningfully closer to
a real coach's method than the legacy row already is.

## THE FALLBACK, CONFIRMED

The A/B runs on **legacy mechanism 712** as originally scoped. Zero writes. The result will carry,
verbatim, on the result itself and not only in a footnote:

> This A/B tests the injection of **legacy mechanism prose**, not rebuilt-extractor output. No Node
> 4 rebuild output exists on production — `sourceTier` is NULL on all 1,095 rows and `coachMethods`
> is empty. **The tier-1 register question remains open until the durable walkthrough entry point
> is built** (Node 4 backlog item 1).

Tagging is moot — nothing is written. Were that ever to change, option (a) applies: set id, row
range and timestamp recorded here, no extra writes for readability.

## Banked, not fixed here

- `autoSelectBest` (`routers/campaignKits.ts:181-184`) overwrites `selectedMechanismId`
  unconditionally — **repoints kits on any future regeneration**, not just this one.
- `whatTried` is byte-identical to `whyExistingNotWork` on 135 of 210 populated rows.
- No Node 4 rebuild output survives on production.
- Node 4 has no generation/persistence split, unlike Node 5.

---

# STEP 2 RESULT — build shipped locally, three-arm A/B run. 2026-08-24

**Zero production writes.** 14 bodies generated in-process (arm B lost one to a failed generation,
so B is n=4), screened in memory, nothing persisted. TS baseline 34, 424 existing tests green, 19
new tests green.

## Numbers, with denominators

Mechanism 712 injected text: **1,402 chars · 215 words · 146 distinct words.**

| arm | n | mean body words | mean chars | mean verbatim words | mean cov% | mean cons% | mean hits/1k |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 5 | 1,708 | 10,745 | 0.0 | 0.00 | 0.0 | **0.091** |
| B | 4 | 1,725 | 10,894 | 1.5 | 0.08 | 1.0 | 0.134 |
| C | 5 | 1,805 | 11,399 | 5.0 | 0.26 | 3.4 | **0.291** |

Per-row hits/1k — A: 0.08, 0.10, 0.10, 0.17, 0.00 · B: 0.11, 0.25, 0.18, 0.00 ·
**C: 0.08, 0.09, 0.28, 0.00, 1.01**

Verbatim word counts, absolute: **A = 0 on all five rows.** B = one row at 6. **C = 12 and 13 on
two rows, 0 on the other three.**

### The gate — PASS, and how it passed matters

    mean(C) 0.291  <=  max( A x1.25 = 0.114 ,  A + 0.5 = 0.591 ) = 0.591   → PASS

**C fails the ratio leg and passes on the absolute leg.** Both were committed in advance and the
more permissive applies, so this is a pass on the rule as written — but the ratio leg failing is
real information and is not being buried. **C's mean is 3.2x A's.**

**It is also one row.** Excluding the C5 outlier, C is **0.112** against A's 0.091 — a difference of
0.02 hits per 1,000 chars. At n=5 this is a screening signal, not a significance test, exactly as
pre-registered.

### 🔴 Calibration: the assumption was wrong, across the board

The band was sized against an assumed **1,000–1,500 word** guide body. Actual means are
**1,708 / 1,725 / 1,805**. At those lengths the 8% ceiling is ~145 verbatim words and the 1% floor
is ~18. **The highest figure observed anywhere in the run was 13.**

**Every row in every arm sits below the floor, so the band cannot deliver a verdict on this run.**
Treat it as a screening signal that needs re-sizing next time, not a result. And note which way it
misleads: the floor reads "the mechanism did not land", while the text below shows it demonstrably
did — **by paraphrase, which a verbatim-span metric cannot see.** That is the ceiling-and-floor
problem from the other end.

## The read — and it is the honest, unwelcome one

**Arms A and C read substantially the same, apart from a longer and better-sourced method paragraph
in about half the rows.** The injection is **necessary but not sufficient**, and prompt framing is
the next lever.

### 🔑 A confound that flatters arm A, and it is specific to this row

**The mechanism's NAME contains its own root cause** — *"The Sector **Translation** Audit"*. Arm A,
given only the name, already infers the translation theme. A2's own section, on the name alone:

> "Senior managers and directors consistently undervalue transferable skills because they describe
> them in **company-specific or function-specific language**. This matrix forces the translation."

Root-cause cues in section bodies: **A 1.6 · B 2.0 · C 1.6 — no lift at all.** In `nextStep.body`
there is a modest one: **A 1.4 → C 2.0.**

**A mechanism named "The Zappy Method" would likely show a far larger gap. This A/B therefore
understates the injection's value rather than overstating it.**

### Q1 — actual method, or generic advice with a name attached?

**Mixed, and closer to A than the metric or first impression suggested.** One row (C3) clearly
teaches the method; two (C4, C5) sit at or below arm A. C3 gives the root cause its own section —
*"The One Thing That Kills a Good Session: The Translation Gap"*:

> "the professional leaves with a clear destination but keeps using the language of where they came
> from to describe it… 'I led regulatory change programmes and P&L accountability for a £200m book'
> has just spoken fluent financial services to a health technology hiring manager… Same career.
> Completely different signal."

That is mechanism 712's actual root cause, taught as content and paraphrased rather than copied.

### Q2 — does anything name why previous attempts failed?

**Yes — in both arms.** C3 does it best and does it inside the teaching body rather than the pitch.
But A2, A3 and A4 all carry "translation"/"language" in their section headings. **Not exclusive to
C**, for the naming reason above.

### Q3 — nextStep in C vs A

**A real but partial lift.** Arm A closes with programme features:

> A1: "It combines career psychology, a full skills translation process, and industry-switching
> strategy into a single structured programme…"

C2 and C3 instead open a gap out of the reader's OWN output, then answer it:

> C2: "The Entry Evidence Statement **you wrote in Step 5** is a starting position, not a finished
> document… That gap is the exact reason capable Directors with 20-plus years of genuine authority
> receive automated rejections before a human reads their name."

> C3: "your career history is still written in the language of where you have been, not where you
> are going… hiring managers in your target sector will feel it before they can name it."

**C4 and C5 revert to feature lists.** So: better in roughly half the rows, unchanged in the rest.

## 🔴 A finding the numbers alone would have hidden

The guide format's hits are **qualitatively different from the toolkit's**. Step 1 found 86% of
toolkit hits were classifier misfires on markdown. In these guide bodies the misfires are a
minority — `Clarity Statement`, `Sector Intelligence` — and the rest look **genuine**:

- invented statistics: `22%` (C3), `12%` (A4) — in both arms;
- **C5's outlier is 7 hits in ONE section: a fabricated person placed at REAL named organisations**
  — `Sarah Chen` alongside `Clarion Housing`, `Inside Housing`, `Homes England Digital
  Transformation`, `Chartered Institute`. That is not a Title-Case misfire.

**Hypothesis, not a proven cause at n=1, and actionable:** mechanism 712's description **itself ends
in a fabricated vignette** — *"a hiring manager… forwards your profile to their Head of Talent with
a single line — 'this person gets what we're trying to do.'"* Injecting a description that models
an invented worked example may license the body to write its own, with named people and real
employers. **If true, the fix is framing the injected mechanism as source material rather than as a
style exemplar — which is precisely the "prompt framing is the next lever" conclusion.**

## Step 3 evidence, banked not acted on

Guide bodies run **~1,750 words / ~11,000 chars** with 5–6 sections. That is already past what the
standard treats as consumable in one sitting — and `guide` is both the **unbounded** format and the
**default** for any title the three signal lists miss, with `sections.length > 0` as its only
acceptance test.

---

# THE VIGNETTE SCAN — 2026-08-24, read-only, 1,095 heroMechanisms rows

## ✅ Mechanism 712 confirmed — it does end in a fabricated vignette

    The before: you apply for a Director role in a new sector and receive an automated rejection
    before a human reads your name. The after: a hiring manager in that sector forwards your
    profile to their Head of Talent with a single line — 'this person gets what we're trying to do.'

Both halves detected precisely: the `The before:` / `The after:` frame, and the quoted line
«this person gets what we're trying to do.» — an **invented quotation attributed to a hypothetical
hiring manager, describing a result.**

## ⚠️ Four detector iterations. The first three were wrong, and the numbers they produced are void

Recorded because the wrong numbers were plausible and would have been believed:

| pass | claimed | why it was wrong |
|---|---|---|
| 1 | vignette shape 27.4% | `quote` conflated quoted concept NAMES ("Permission Plays") with speech |
| 2 | 73.2% | apostrophes in contractions opened false quotes — `they've` → «ve felt like…» |
| 3 | 0.2% speech | double-quotes only; the corpus quotes with single marks, so it missed 712 itself |
| **4** | **below** | shortest-span extraction first, classify by length after. 712 extracts exactly right |

The fix that mattered: requiring 4+ words *inside* the regex made the engine run **past** a short
quoted name to find a later closing mark. Extract the shortest closed span, then count.

## The numbers — pass 4

| shape | rows | share |
|---|---:|---:|
| **`The before:` / `The after:` frame** | **114** | **10.4%** |
| invented statistic (`N%`) | 94 | 8.6% |
| quoted speech (≥5 words in a closed span) | 320 | 29.2% |
| quoted NAME only, no speech | 383 | 35.0% |
| **vignette shape (speech OR before/after)** | 397 | 36.3% |

## What it means — narrower than the headline figure

**The high-precision answer is 10.4%.** Roughly **one mechanism description in ten** carries the
exact frame 712 has. That is systemic enough to matter and is a **Node 4 template shape** — rows
#251, #252, #253 all open their vignette with the literal string `The before:`.

🔴 **Do not read the 29.2% quoted-speech figure as fabrication.** Sampling it shows most are the
READER'S OWN inner voice — «Am I allowed to want this?», «what should I do today», «can't afford
another failed attempt» — which is a legitimate copywriting device, not an invented third party.
Separating reader-voice from invented-testimony needs its own pass and has not been done.

🔑 **A correction to my own C5 hypothesis.** A scan for named individuals found **zero** across all
1,095 descriptions. **C5's "Sarah Chen" was therefore not inherited from the mechanism corpus — the
body generator invented her.** The mechanism supplies the *form* (a worked vignette with an invented
quoted outcome); the names are the body's own addition. The hypothesis holds as to form and fails as
to content, which is why the mitigation is framing rather than filtering.

**Banked as a Node 4 defect, not fixed here.**

---

# 🗑️ THE GROUNDING METRIC IS RETIRED, NOT RE-SIZED

It was built to catch copying, and it does. What this run established is that **it cannot detect
success either.** The mechanism landed in arm C by *paraphrase* — C3 taught 712's root cause as its
own section — while every row in every arm sat below the 1% floor. **It reported failure for the
thing working.**

A metric that is silent on success and loud on a failure mode we have not yet observed is not worth
its denominator. **Do not carry it into future runs.** The read of the bodies is the instrument;
the compliance hit rate stays as the quantitative gate.

---

# 📌 BETTER NEWS THAN I FRAMED IT — the precision problem is localised

Step 1 found **86% of toolkit hits were classifier misfires** on `tools[].content` markdown. On
guide prose the ratio inverts: misfires are the minority (`Clarity Statement`, `Sector
Intelligence`) and most hits are genuine (invented statistics; C5's fabricated person at real named
organisations).

**So the precision problem is concentrated in `tools[].content`, not in the classifier as a whole.**
That means **step 5's publish-time gate may be viable for narrative formats (guide, checklist, quiz)
well before toolkits** — a much smaller first step than "fix the classifier". **Recorded, not acted
on.**

---

# ARM C RE-RUN with source-material framing — 2026-08-25, zero writes, n=5

Not a second bite at the gate; the gate was decided on the original run and the injection ships
either way. This asks one question: **does the C5 shape recur?**

⚠️ The post-processor prints a gate line comparing against an absent arm A. **Ignore it** — there is
no arm A in this file. The comparison below is C-new against C-old, with arm A carried across.

## ✅ THE C5 SHAPE DID NOT RECUR

**Zero fabricated people across all five rows**, against one in the original run. No real named
organisations invoked. The `Sarah Chen / Clarion Housing / Homes England` construction is absent.

| | arm A | C-old | **C-new** |
|---|---:|---:|---:|
| mean hits/1k | 0.091 | 0.291 | **0.214** |
| worst row | 0.17 | **1.005** | **0.588** |
| rows at zero | 1/5 | 1/5 | **2/5** |
| rows with a fabricated person | 0/5 | **1/5** | **0/5** |
| **rows with an invented statistic** | 1/5 | 1/5 | 🔴 **3/5** |
| mean body words | 1,708 | 1,805 | **2,038** |
| mean chars | 10,745 | 11,399 | **12,579** |

Per-row hits/1k, C-new: 0.59, 0.00, 0.33, 0.00, 0.15.

### 🔴 The bad news, stated as plainly as the good

**Invented statistics tripled — 1 row to 3** (`94%` twice in one section, `23%`, `80%`). Overall
hits/1k fell 26% and the worst case nearly halved, but **one class moved the wrong way.** At n=5
this is a screening signal in both directions and neither movement is established.

**Bodies also got 13% LONGER** — 2,038 words / 12,579 chars. Teaching from source material costs
length. **More evidence for the step-3 size limits, and a cost the framing carries.**

## The read — the instrument, now the grounding metric is retired

### 🔑 The root cause moved from the pitch into the body, in every row

In C-old, **one row of five** had a root-cause section, and it was last. In C-new, **all five open
with one**:

- C1 — *"Why Most Senior Professionals Stay Stuck (The 90-Second Diagnosis)"*
- C2 — *"Why You're Stuck at 'I Don't Know What I Want' (And It's Not Self-Awareness You're Missing)"*
- C3 — *"Why You're Stuck Before You've Updated Anything (The Real Diagnosis)"*
- C4 — *"Why Smart Senior Leaders Leave This Call Without an Answer"*
- C5 — *"Why You're Stuck at 'I Just Want Something More Meaningful'"*

Root-cause cues in section bodies: **C-old 1.6 → C-new 2.6**, and with no zero rows (C-old had one).
In `nextStep.body` they fell, **2.0 → 1.0** — the diagnosis migrated out of the sales paragraph and
into the teaching. Against the standard that is the right direction: the "what" belongs in the body.

C2's bridge still opens the loop, and does it carrying the mechanism's own words:

> "they take that foundation and walk straight into the Sector Translation problem. They apply for
> roles in the new sector using a CV and LinkedIn profile written entirely in the language of the
> industry they're leaving. Hiring managers in the target sector read it and think
> **'insider from elsewhere'** — and the automated rejection arrives"

*"insider from elsewhere"* is lifted verbatim from mechanism 712. That is the injection working.

**C3 and C5 revert to feature lists** — *"career psychology, skills mapping, industry-switching
strategy"*. The bridge remains inconsistent, which is step 4's problem, not this change's.

### Grounding, reported as description only — the metric is retired as a gate

Verbatim contact rose (mean 5.0 → 18.0 words; peak consumption 19.9% of the mechanism's 146
distinct words). Directionally consistent with "teach from this source material" and nowhere near
parroting. **Recorded as description, not as a verdict.**

## Verdict on the framing change

**Keep it.** It removed the one genuinely serious failure in the original run, moved the root-cause
diagnosis into the body in every row, and cut the worst-case hit rate roughly in half — at the cost
of 13% more length and a rise in invented statistics that needs watching. **Invented statistics are
now the class to watch in narrative formats**, and the natural place to address them is step 5's
narrative-format publish gate, which the step-1 precision finding says is the viable first step.

---

# WHY THE INVENTED STATISTICS TRIPLED — Arfeen's read, recorded so nobody chases the wrong cause

**Do not undo the framing.** The framing fixed the **style-exemplar effect** — the body reading the
mechanism description as an example of how to WRITE, which is what produced the fabricated person at
real named organisations.

But instructing a model to **teach from** material pushes it into an **explanatory register**, and
explanation about a problem reaches for numbers to sound authoritative. All three figures are
*"here is how bad it is"* statistics. **That is a different failure from copying an invented
vignette. The framing fixed one and exposed the one beneath it.**

**The next lever — first item of the NEXT piece of work, not this one:** a **source-boundedness rule
aimed at numbers specifically.** Any figure must come from what the coach actually supplied; where
no figure exists, **describe the scale in words**. Positive directive, same pattern as the two
already in place.

---

# 🔴 THE ROOT DEFECT THIS SPRINT KEEPS MEETING FROM DIFFERENT ANGLES

Every finding in this document is the same defect wearing a different coat:

**the generator fills a gap with invention when it lacks real material.**

| where it surfaced | the invention |
|---|---|
| Node 5's mechanism fallback | an LLM-invented service field, laundered in as if it were evidence |
| Node 5's floor | the literal string `"the method"` standing in for a method |
| mechanism descriptions, 10.4% of rows | a `The before:` / `The after:` vignette with an invented quoted outcome |
| mechanism descriptions, 8.6% of rows | an invented statistic |
| arm C, original run | a fabricated person placed at real named organisations |
| arm C, re-run | invented "how bad it is" figures in an explanatory register |
| Node 5 titles (step 1) | invented benchmark percentages |

**Node 4 already answered this properly — with the TIER SYSTEM.** Tier 1 is the coach's own words,
tier 2 is extraction from real supplied material, tier 3 is a guarded fallback that is *labelled as
such* and travels with a caveat telling downstream nodes to lean on it lightly. The answer is not
"stop inventing"; it is **know what you have, say what tier it came from, and degrade honestly.**

**This should become a CASCADE-WIDE STANDARD rather than a patch per node.** Each node currently
re-derives its own answer — or fails to. A shared standard would mean: no generator invents a fact
it was not given; where material is absent the output says less rather than more; and the tier of
every input travels with it, as `describeMechanism`'s `guarded_fallback` caveat already does for
exactly one field.

**Not scoped, not started. Recorded because the sprint has now hit it seven times.**

## 🔑 THE RUNNING RECORD IS TWO FAMILIES, NOT ONE — they need different cures, so count them apart

Updated 2026-08-27. Everything above this line is family 1. Family 2 was being logged in the same
breath, and it should not be: one is a generator writing something it was never given, the other is
a fact stored twice and allowed to diverge. **A tier system fixes the first and does nothing for the
second; an extraction fixes the second and does nothing for the first.**

| family | what it is | the cure | count |
|---|---|---|---|
| **1 · Fabrication** | the generator supplies a fact nobody gave it | tier the inputs, degrade honestly, say less | **8** |
| **2 · Single-source drift** | one truth with copies that diverge silently | extract to one implementation; make an incomplete copy a COMPILE error | **4 sites, enumerated below** |

**Family 1, eight:** the seven in the table above, plus the **invented attendance limit** measured
five-of-five under a framing that forbade it (see the arm C / C2 evidence section, and `88c97ec`).

**Family 2, enumerated so the count is checkable rather than quoted:**

1. **`autoSelectBest` marked nothing** while the UI re-crown marked every downstream node — two
   representations of "the selection changed", one of them silent. Closed by extraction, `85bcc8b`.
2. **`markTweakStale`** — a third copy of the stale-marking logic, its own comment reading *"Same
   logic as re-crown"*. Contained rather than closed: the parity test pins the class at three
   copies, so a fourth fails a test.
3. **`PROOF_COMPOSITIONAL_CEILING_RULE`** — defined in `copywritingRules.ts` and **pasted into no
   prompt anywhere**. Reads as covered because it is present in the file. Open.
4. **The campaign-framing map — `_core/campaignFraming.ts` plus THREE more copies.** Its own pass
   below. Open, and the only one of the four with a live wrong-output consequence.

⚠️ **The count is stated as 4 SITES, not as a running total of copies.** Entry 4 is three copies of
one map; count copies individually and the family is 6. The enumeration is the checkable part — a
bare total is the artefact this document exists to stop.

---

# NEXT — STEP 3 IS NOW THE PRIORITY

Promoted from "later item" to next piece of work. Two reasons, and the second is the one that was
not obvious at the start:

1. Bodies run **~2,038 words** with the framing in place — well past what the standard treats as
   consumable in one sitting, and `guide` is both the **unbounded** format and the **default** for
   any title the three signal lists miss, with `sections.length > 0` as its only acceptance test.
2. **A bounded body has less room to pad with invented authority.** The size limits and the
   fabrication problem are the same lever pulled from two ends.

Ordering within step 3: the numeric source-boundedness rule above goes first, then the schema-level
array bounds.

---

# STEP 3 PROPOSAL — size limits. Plan only, nothing built. 2026-08-25

Ordering reversed as instructed: **bounds first, numeric source-boundedness second**, so the numeric
rule is measured once on the shape that ships.

**Two measurements changed this proposal before a single number was picked.**

## 🔴 FINDING 1 — array bounds barely bite. The length is inside the items, not in their count

Measured across the **19 guide bodies generated this sprint** and the **8 production `assetBody`
rows**:

| format | array counts observed | prompt's stated range | verdict |
|---|---|---|---|
| guide | **5–6 sections** (7 rows at 5, 12 at 6) | 3–6 | already inside |
| checklist | 7 and 13 items | 7–15 | already inside |
| toolkit | 4, 4, 4, 4, 4, **6** tools | 3–4 | **one row over** |

**`maxItems` on the guide would change nothing at all**, because nothing exceeds it. The length
lives in the per-item text:

| field | median | p90 | max |
|---|---:|---:|---:|
| guide `section.body` | **265 words** | 379 | 679 |
| checklist `item.detail` | **74 words** | — | 127 |
| toolkit `tool.content` | **546 words** | 908 | 1,102 |
| guide `promise` | 49 | 59 | 61 |
| guide `nextStep.body` | 163 | 236 | 237 |

**84% of a guide body's words sit in `section.body`.** So array bounds are still worth doing — they
close the `length > 0` degenerate-body gap and they catch the toolkit overrun — but **`maxLength` on
the strings is what actually reduces 2,038 words.** Both are schema-level and both act at
generation, so both belong in this step; only the second does the work.

## 🔴 FINDING 2 — "constrained at generation" is only partly true on this provider

`invokeLLM` is **Anthropic**, and `response_format: { type: "json_schema" }` is translated into a
**forced tool call**: a synthetic tool is built from the schema and `tool_choice` forces it
(`server/_core/llm.ts:279-289, 362-365`). The in-repo note scopes what that guarantees precisely —
Anthropic validates *"OBJECT-where-string, missing required fields, type mismatches"*.

**Bounds are not in that class.** `maxItems` / `maxLength` are a strong hint to the model, not a
grammar the decoder is held to, and **there is no client-side schema validation of the response
anywhere** (no ajv, no length checks — verified by search). So a schema bound will usually be obeyed
and is **not guaranteed**.

**Therefore the proposal does not rest on the schema obeying.** It pairs the bound with a
deterministic repair, which is also the clean answer to the failure mode below.

## ✅ THE FAILURE MODE — how a missed bound never produces a null body

The risk flagged earlier: a bound is missed → retry → second attempt also misses → `return null` →
`assetBody` NULL → coach gets a magnet with no content, on the path every coach hits.

**The rule that removes it: upper bounds are REPAIRED, never rejected. Lower bounds add no new
rejection at all.**

| bound | mechanism | can it produce a null? |
|---|---|---|
| **upper** (`maxItems`, `maxLength`) | schema hint, then **deterministic trim** after parse — extra array entries dropped, over-long strings cut with the existing `truncateAtSentence` | **No.** A repair always succeeds |
| **lower** (`minItems`) | schema hint + the prompt text already present | **No.** The acceptance test is **left exactly as it is** (`sections.length > 0`) |

**No new rejection reason is introduced anywhere.** The acceptance threshold is deliberately *not*
tightened to the new minimum: raising it to `>= 3` would manufacture precisely the null path this
is meant to avoid. A 2-section guide stays acceptable — it is thin, not broken.

Trimming **keeps the FIRST N entries, never the last**. The root-cause diagnosis now opens every
body (see the re-run), so trimming from the end preserves the beat that only just arrived.

`truncateAtSentence` is reused rather than re-derived — already exported, already tested at 9 cases.

## The numbers, and where each comes from

**Two derivation rules, and no research figure is used, quoted, or referenced in any comment:**

1. **Promote the prompt's OWN stated range into the schema.** Those numbers are already the agreed
   contract; enforcing what we already ask for invents nothing.
2. **Where the prompt states a shape rather than a count, size the cap from what the field has to
   DO**, and check it against the measured distribution so it trims the tail rather than the median.

### GUIDE

| field | bound | derivation |
|---|---|---|
| `sections` | **minItems 3, maxItems 6** | the prompt's own "3-6 sections" |
| `promise` | **maxLength 320** | the prompt's own "max two sentences" ≈ 45 words. Measured median 49 words — holds the line already being drawn |
| `section.heading` | **maxLength 120** | measured p90 is 17 words |
| `section.body` | **maxLength 1400** | what one section must do: state the move, say how to run it, give one worked example ≈ 200 words. Trims the tail (p90 379, max 679), leaves the median (265) near-intact |
| `nextStep.body` | **UNCAPPED in v1** | see the loop-splicing section — deliberate |

Worst case ≈ 320 + 6×(120+1400) ≈ **9,440 chars ≈ ~1,420 words** plus the bridge, against a measured
median of 1,893 and max of 2,300.

### CHECKLIST

| field | bound | derivation |
|---|---|---|
| `items` | **minItems 7, maxItems 15** | the prompt's own "7-15 concrete action items" |
| `item.label` | **maxLength 90** | a verb-led action label ≈ 12 words; measured 9–18 |
| `item.detail` | **maxLength 300** | the prompt's own "one-to-two-sentence detail" ≈ 45 words. **Measured median is 74 words — this one genuinely bites, and should** |

### TOOLKIT

| field | bound | derivation |
|---|---|---|
| `tools` | **minItems 3, maxItems 4** | the prompt's own "3-4 focused tools". **The only array bound that bites today** — one production row carries 6 |
| `tool.instructions` | **maxLength 180** | the prompt's own "one-line usage instructions" ≈ 25 words; measured median 28 |
| `tool.name` | **maxLength 80** | a tool name |
| `tool.content` | **maxLength 4000** | **the content IS the deliverable** — a real template the reader copies — so this trims only the tail: measured median 546 words, p90 908, max 1,102 |

📌 **Toolkit stays the longest format, by design.** The reader *operates* it tool by tool rather than
reading it through, so its budget is not the guide's. 🔑 Side benefit: `tool.content` is the field
carrying **86% of all compliance misfires**, so bounding it shrinks that surface too.

### QUIZ — mirrors the existing validator exactly, inventing nothing

| field | bound | source |
|---|---|---|
| `questions` | minItems 5, maxItems 12 | `validateQuizBody` |
| `options` | minItems 3, maxItems 4 | validator floor; 4 from the prompt's "3-4 options" |
| `scoring.bands` | minItems 3, maxItems 5 | `validateQuizBody` |
| `band.meaning` | maxLength 600 | the prompt's own "2-4 sentences" ≈ 85 words |
| `band.teaser` | maxLength 200 | the prompt's own "one-line teaser" |

**Quiz is the one format where a bound violation ALREADY causes a retry and then a null** — it is the
only format running a rubric validator. Mirroring the validator into the schema makes compliance
more likely at generation while the validator stays as the backstop, so this strictly *reduces* the
existing null risk rather than adding to it.

## The catch-all default — what happens to a title that matches nothing

`inferLeadMagnetFormat` is positive-only, most-specific-first (quiz → toolkit → checklist), and
**anything unmatched becomes `guide`** (`leadMagnetContentGenerator.ts:120`).

**Today that means the catch-all default is the ONE unbounded format — the worst possible pairing.**
After this change the default is bounded, which is most of the answer.

**I am not proposing to change the inference itself** — that is a separate concern with its own
failure modes. Residual risk, stated: a title that *implies* a toolkit but misses the signal list
gets guide-shaped bounds, and a toolkit squeezed into a guide's budget is worse than either.
**Proposed alongside: log the inferred format and whether it came from a signal match or the
default.** No behaviour change, and it sizes how often the default actually fires before anyone
argues about changing it.

## ⚠️ Will bounding break the loop-splicing structure?

**Yes, it could — and one specific cap is where the risk sits, so v1 does not apply it.**

The asset must still close the symptom loop, open the root-cause loop, and bridge. Two of those
three only started working with the source-material framing, which landed hours ago.

| beat | where it lives | risk under bounds | mitigation |
|---|---|---|---|
| close the symptom loop | the doing sections | low — 1,400 chars is ~200 words per section | — |
| **open the root-cause loop** | now **section 1** in all five re-run rows | **would be lost if trimming took from the end** | trim **keeps the first N**, never the last |
| **bridge** | `nextStep.body` | 🔴 **highest** — the best loop-opening bridge measured (C2) is also a long one | **`nextStep.body` is left UNCAPPED in v1** |

**Why uncapped is the right call rather than a generous cap:** `nextStep.body` is **163 of 1,893
median words — under 9% of the body.** Capping it buys almost nothing against the 84% sitting in
section bodies, while risking the one beat that only just began working. Cap where the length is.

**Proposed proof, same harness, zero writes:** after the change, re-run 5 guide rows on service 233
and confirm all three beats survive — a root-cause section still opens the body, the doing sections
still carry a worked example each, and the bridge still names a gap rather than listing features.
Word counts alone will not show that; the read will.

## Gates

TS baseline 34 · existing suites green · new tests written first, covering each bound and — the
important one — **a test that a body exceeding every upper bound is repaired and returned, never
turned into a null.**

---

# STEP 3 BUILT AND PROVEN — 🔴 DO NOT SHIP THE CAPS AS SET. 2026-08-25

Built as approved: `BOUNDS`, `applyBodyBounds` (repair-not-reject), schema bounds on all four
formats, quiz mirroring `validateQuizBody`, `nextStep` uncapped. **19 new tests, 463 green, TS 34.**
Five-row proof on service 233, zero writes. **The proof says the numbers are wrong.**

## Repair frequency — the measurement that decides it

| corpus | bodies repaired | **sections trimmed** |
|---|---|---|
| 19 guide bodies generated **without** the schema hint | 19/19 | **73/107 (68%)** |
| 5 guide bodies generated **with** the hint | 5/5 | **16/30 (53%)** |
| production toolkit rows (no hint) | 5/6 | 7/26 tools (27%) |
| production checklist rows (no hint) | 2/2 | 20/20 items (100%) |

**The hint moved the distribution, weakly: 68% → 53%.** Median `section.body` is **1,442 chars
against a cap of 1,400** — the cap sits *on* the median, so by construction half of everything is
trimmed. Mean body words 1,859 → 1,462, and **the repair is doing that reduction, not the hint.**

By the criterion set in advance — *if repair fires on most sections, the cap is wrong rather than the
approach* — **the cap is wrong.**

**The error is identifiable and mine.** I derived 1,400 chars as "what one section needs to do its
job" ≈ 200 words, and the model produces ≈ 212. **I set the cap at the target instead of above it.**
A cap that trims the tail has to sit above the intended centre; one placed on the centre truncates
half the corpus by definition.

## ✅ The diagnosis survived — the risk flagged in advance did not materialise

**The root-cause section was trimmed in none of the five rows.** Section 0 measured 1,173 / 1,069 /
798 / 1,078 / 1,240 chars — all under the cap. Trims landed on sections 1–5 only. It is structural
rather than lucky: the diagnosis is a framing section, not a step carrying a worked example, so it
is naturally the shortest. n=5.

And it lands. Every row's section 0 delivers its payoff in the closing lines:

> row 3: *"Skipping to the CV before answering all three is why most people in your position get
> automated rejections before a human reads their name."*

> row 5: *"…not because the capability is wrong, but because the language is coded as 'not us.'"*

**No front-loading instruction is needed.** Reporting that rather than pre-emptively building one.

## 🔴 But the trims are severing the deliverable, and that is the reason to stop

What truncation actually removed:

| row · section | chars | what was cut |
|---|---|---|
| 2 §2 *"Your Exact Agenda"* | **4,492 → 1,060** | the fill-in template — *"'In my highest-leverage moments the thing I was actually doing was ______'"* |
| 1 §1 *"Solo Session Structure"* | **2,720 → 819** | the sector-filter checklist the reader ticks |
| 1 §4 *"Swipe Copy — Three Warm Outreach Messages"* | 1,808 → 1,390 | **a swipe message cut mid-sentence.** Kept: *"…I'm in the process of making a considered move into [TARGET SECTOR]."* Cut: the rest of the message |
| 1 §3 | 1,966 → 1,305 | the *"→ Fix:"* line — the remedy the section builds to |

**A swipe message truncated halfway is worse than absent.** The 80/20 bar makes usable tools the
point of the asset, and this cuts them mid-artefact.

### A second, separate defect — the repair over-cuts on markdown

Row 1 §1 went to **819 chars against a 1,400 cap** — 40% below what the cap required.
`truncateAtSentence` cuts at the last `[.!?]\s` inside the cap, and this content is markdown:
bold labels, bullet lists, table rows, `□` checkboxes. Those do not end in sentence punctuation, so
the last boundary can sit far back. **The function is correct and well-tested for prose; it is the
wrong instrument for structured content.**

## The three beats, after bounding

| beat | verdict |
|---|---|
| close the symptom loop | 🔴 **harmed** — the tools that close it are what truncation cuts |
| open the root-cause loop | ✅ **intact** — untouched in all five rows, diagnosis lands |
| bridge | ✅ **intact** — `nextStep` uncapped, and leaving it uncapped is vindicated |

📌 One thing to note in the bridges: row 2 carries *"puts you ahead of 90% of senior managers"* — an
invented statistic, in the uncapped field. **The class flagged after the re-run is still live**, and
it is the next lever regardless of what happens to the caps.

## Recommendation — two changes, both needing a decision, neither built

1. **Move the length lever from truncation to generation.** Raise `section.body` to sit above the
   intended centre so it catches outliers like the 4,492-char section and leaves typical sections
   untouched, and get the median down by asking for it in the prompt — which is where a target
   belongs — rather than by cutting tails.
2. **Stop using `truncateAtSentence` on structured fields.** A trim on `section.body`,
   `tools[].content` or `items[].detail` must cut on a **block** boundary — a blank line, a list
   item, a heading — so it can never sever a template, a checklist or a swipe message mid-artefact.
   Prose fields keep the existing function.

**Checklist's 100% trim rate is untouched by either and needs its own look:** `item.detail` at 300
chars against a measured median of ~490 means the cap and the output have never agreed. Sample is 2
bodies / 20 items.

## 📌 Length: progress, not arrival

Post-repair bodies are **~1,462 words**, and the worst case the caps permit is **~1,420**. Both are
**progress toward the standard's consumable-in-one-sitting bar and not arrival at it** — and the
current figure is reached by truncating deliverable content, which is not a way to arrive at
anything. **A future session must not read step 3 as having closed the length question.**

---

# STEP 3 REVISED — caps re-derived, target moved into the prompt, structured trims made block-safe. 2026-08-25

Built as approved. **Nothing committed; held for authorisation.** TS baseline **34**, suites green
(**488**). Two five-row proofs on service 233, **zero production writes**.

## Change 1 — `section.body` raised from the centre to the outlier threshold

**Derivation corpus.** Production carries **no guide body at all** — its 8 populated `assetBody`
rows are 6 toolkit and 2 checklist — so the corpus is every guide section this rebuild has
generated: **137 sections across 24 bodies**, measured before any trim.

| | chars |
|---|---:|
| Q1 | 1,287 |
| median | 1,577 |
| Q3 | 1,858 |
| IQR | 571 |
| max | 4,492 |

An outlier is a point beyond the upper fence, **Q3 + 1.5 × IQR = 2,714.5**. Rounded **up** to the
nearest hundred — up, so nothing sitting at the fence is trimmed by a rounding artefact — the cap
is **2,800**.

**Retro over the same 137 sections: 7 trimmed, 5.1%** — against **89, 65%** at the old 1,400. The
2,720-char sector-filter checklist the first set cut to 819 is now untouched; the 4,492-char
fill-in template is still caught, which is the point of having a cap.

## Change 2 — the length target moved into the prompt

`about 200 words` per section. Derived as this generator's own **lower quartile (Q1 = 207 words)** —
the length at which a quarter of sections already carry the full shape the prompt asks for, stated
as the target for all of them.

### ⚠️ The first wording of it cost a beat, and that is why the shipped line states length only

The first version read *"about 200 words: the move, how to run it, and one worked example."* That
is a template for a DOING step, and over five rows it **pushed the root-cause diagnosis out of the
opening section, which had held it in 5 of 5 before** — down to 2 of 5, with row 4 carrying no
framed diagnosis at all. The shape is already stated in the line above it. **Saying it twice
displaced the beat.** Re-worded to a length target plus an artefact carve-out, the opener came back
at **5 of 5**.

## Change 3 — structured trims cut on a block boundary

New `truncateAtBlock` beside `truncateAtSentence` in `server/_core/cascadeContext.ts`. It cuts only
where a new block starts — blank line, list item, heading, table row, bold label — and falls back
to the sentence cut where the content inside the cap has no block structure, because that content
is prose. **`sections[].body` and `tools[].content` use it; every prose field keeps
`truncateAtSentence`.** 9 new cases, including the exact severing observed.

## Change 4 — checklist held out entirely

`BOUNDS` has no `checklist` key; `schemaFor("checklist")` and `applyBodyBounds(_, "checklist")` are
both back to pre-bounds behaviour. Re-measured on production: **the shortest of the 20 items
measured 309 against a proposed cap of 300** (p50 413, max 743), so the cap and the output have
never once agreed. That is an unmeasured cap, not a long output. **The array bounds went out with
it** — they never bit, and nothing on checklist ships without checklist evidence.

⚠️ `applyBodyBounds` now matches **quiz explicitly** rather than leaving it as the catch-all `else`,
so the hold-out cannot silently route checklists into the quiz branch. Covered by a test.

**Toolkit ships as proposed** (27% of tools trimmed, tail-only, its content IS the deliverable).
**Quiz counts still never trimmed** — bands must partition 0–100 and options must carry differing
weights, so a count repair there manufactures the null the repair exists to prevent.

## The five-row proof — service 233, zero writes

| | before this change | after |
|---|---|---|
| bodies repaired | 5/5 | **1/5** (a `promise`, a prose field) |
| sections trimmed | 16/30 (53%) | **0/30** |
| deliverables severed | **3** | **0** |
| root-cause opener | 5/5 | **5/5** |
| section median | 1,577 c / 257 w | **1,410 c / 227 w** |
| body words | 1,859 pre-repair → 1,462 post-truncation | **1,712, untruncated** |

## 📌 Length, again: progress, not arrival

The reduction is now generation-side, which is the point — but it is **1,859 → 1,712, about 8%**.
The old 1,462 was lower and was reached by cutting deliverables, which is not a way to arrive
anywhere. **The length question is still open.** n=5.

---

# REPORTED, NOT FIXED — 2026-08-25

## 1. `truncateAtSentence` on structured content elsewhere — audited, and it is clean

Three call sites in code, repo-wide (`rg`, positive control run):

| site | field | cap | verdict |
|---|---|---|---|
| `leadMagnetContentGenerator` `capStr` | prose fields only | various | correct by construction after this change |
| `cascadeContext.ts` `describeMechanismText` | `heroMechanisms.mechanismDescription` | 900, and **1,600 at Node 5's call site** | ✅ prose |
| `cascadeContext.ts` `describeHvco` | `hvcoTitles.hvcoTopic` | 300 | ✅ prose, and never actually cuts |

Measured read-only on production, not assumed:

- **`mechanismDescription`, 1,095 rows: 0 contain a newline, 0 contain a markdown block marker.**
  It is cut often — 714 rows (65%) exceed 900, 109 exceed 1,600 — but every one of those cuts is
  through prose, which is what `truncateAtSentence` is for. **No change needed.**
- **`hvcoTopic`, 2,077 rows: 0 newlines, 0 block markers, and 0 rows exceed 300** — its maximum
  observed length IS 300, so the column bounds it at write time and the function never fires.

**"Probably fine" is now measured fine.** The instrument is correctly matched at both sites.

## 2. The invented statistic in `nextStep.body` — the field deliberately left uncapped

Confirmed verbatim in the prior run, row 2:

> *"That puts you ahead of **90%** of senior managers attempting this move."*

Nothing in the coach's material supports it. It did **not** recur in either five-row run this
session (0/5 and 0/5 bridges carrying a bare figure), but **n=5 twice and nothing in this change
addresses it** — the disappearance is not evidence of a fix.

🔑 **Leaving `nextStep` unbounded on LENGTH was right and stays right** — it is under 9% of a body's
words and it carries the bridge. **Source-boundedness is a different axis from length, and the
numeric rule that comes next must name `nextStep.body` explicitly.** A field exempt from the length
cap is not exempt from where its numbers come from, and this is the one place that gap is already
proven to have been exercised.

---

# 🔑 A PROPERTY OF PROMPTS, NOT A SLIP — instructions COMPETE for a slot, they do not reinforce

**This is larger than the change that surfaced it, and it is recorded here so it is not buried
inside the step-3 revision.**

## What happened, precisely

The step-3 prompt already specified a guide section's shape:

> *"…each a clear heading and lean, directly-actionable content (steps, a mini-framework, an example
> the reader applies) — not padded prose."*

The length target was added on the line immediately below, and its first wording **restated that
shape while stating the length**:

> *"Write each section to about 200 words: the move, how to run it, and one worked example."*

Measured over five live rows: **the root-cause diagnosis fell out of the opening section, from 5 of
5 to 2 of 5.** One row carried no framed diagnosis anywhere. Re-worded to state **length only**,
keeping an artefact carve-out and nothing else, the opener returned at **5 of 5** — the baseline.

## The property, stated generally

**Two instructions describing the same thing do not add up. They compete for the same slot, and the
second can OVERRIDE the first rather than strengthening it.**

The restatement was not wrong and it did not contradict the line above it. It was a *narrower*
description of the same slot — a doing step — and being second and more concrete, it won. The beat
that had no room left was the one the earlier line permitted but did not name: a framing section
that opens the body by naming why previous attempts failed.

⚠️ **Do not read this as a wording slip to be more careful about next time.** The failure mode is
structural: adding an instruction that overlaps an existing one is a *silent edit to the existing
one*. Nothing throws, nothing fails a gate, and the output stays fluent and plausible — the loss is
a beat, and only a read finds it.

## Why it generalises across all eleven nodes

Every node's prompt is a stack of layered instructions written at different times by different
sprints, and **none of them was written knowing what the others would later add.** This node's
prompt alone carries the 80/20 bar, the method directive, the promise shape, the bridge shape, the
per-format shape and now a length target — six instructions competing over one output.

🔗 **It pairs directly with the prompt-versus-output divergence audit already banked** (§7 of the
pause checkpoint, item 4: *"several prompts state ranges their output has never matched"*). That
audit was framed as prompts asking for what they do not get. **This says why that happens**: an
instruction that a later, narrower one overlaps stops being enforced without ever being removed.
The audit should look for overlap, not only for divergence — the divergent range is the symptom,
the competing instruction is the cause.

---

# 📌 STANDING CHECK — any edit to a section-shape or length instruction requires a live run

**Trigger:** any change to a node's section-shape instruction or its length instruction, however
unrelated to structure it looks. A length target is exactly such a change, and it moved the beat.

**The check:** run live rows and **read the opening section of each — does it still open by naming
why previous attempts failed?** Report the rate. Do not trust the change until that read is done.

**It is a READ, not a metric.** No word count, no character distribution, no schema assertion and
no test detects it — every one of those was green across the run in which the beat was lost. The
diagnosis section is naturally the shortest section in the body, so length instrumentation looks
*healthier* precisely as it disappears.

**Why this beat and not another:** it is the newest of the three — it only began landing when the
mechanism arrived in step 2 — it is unguarded by any gate, and it is the one an edit aimed at
length will silently displace, because it is the section that carries no worked example and so
looks like the slack when a shape is restated.

---

# NUMERIC SOURCE-BOUNDEDNESS — closed by an IMPORT, not by a new rule. 2026-08-26

**The task changed at the inventory.** The rule already existed. `landingPageGenerator`,
`emailSequenceGenerator` and `whatsappSequenceGenerator` have carried
`NO_RESEARCH_STATISTIC_FABRICATION_RULE` since `3d604cd` (2026-05-10). Node 5's body generator
imported `GUARANTEE_CLAIMS_RULE` alone. **A missing import, not a missing rule.**

Built: one line added to the import, one clause appended in `systemPromptFor`. The shared rule is
**not modified**, no local variant is written, `methodDirective` is **untouched**.

## Why the SYSTEM prompt and nowhere else

Four statements in the **user** prompt already push toward concreteness — *"Everything is concrete
and specific… **real** fill-in-the-blank content"* (system), *"**real** fill-in content, **real**
swipe copy"* (`common`, all four formats), *"the **ACTUAL** usable content"* (toolkit), *"ONE
**real** dimension of readiness"* (quiz) — and an invented figure is the cheapest way for a model
to be concrete.

The import lands in the **system** prompt, beside `GUARANTEE_CLAIMS_RULE`. **That is the rules
layer; the concreteness statements are in the instruction layer.** Different layers, so this adds
nothing competing with them. Writing a second voice on figures in the user prompt as well would be
the exact failure documented above — and would also destroy the measurement, since two levers moved
at once tells you nothing about either. One change, one layer.

## The result — five rows, service 233, zero writes

| corpus | bodies | chars | wide /1k | **non-timing /1k** | rows carrying one |
|---|---:|---:|---:|---:|---:|
| 1 · A/B corpus, pre-framing | 19 | 217k | 0.064 | **0.014** | 2/19 |
| 2 · prior proof, step 3 as built | 5 | 58k | 0.103 | **0.052** | 2/5 |
| 3 · caps revised, no rule | 5 | 53k | 0.094 | **0.000** | 0/5 |
| 4 · **rule imported** | 5 | 54k | **0.037** | **0.000** | **0/5** |

Invented-statistic count per row against the thread's history — **1 of 5, then 3 of 5 after the
source-material framing, then 0 of 5 twice, now 0 of 5 a third time.**

**Both remaining hits are deliverable timings** — *"in 60 minutes"* (the offer's own duration) and
*"within 60 seconds"* (a tool instruction). Neither is a population claim; both are what
`GUARANTEE_CLAIMS_RULE` explicitly permits. **The non-timing rate is 0.000, at or below the
0.011–0.028 band the three inheriting generators sit in** — whose own post-rule hits, on
inspection, were also all non-genuine.

✅ **All five bridges clean.** `nextStep.body` is the field deliberately uncapped on length and the
one that carried *"ahead of 90% of senior managers"*. Zero numeric hits across all five.

✅ **Root-cause opener 5/5** — the standing check, run because this touches the prompt. Every row
opens *"Why You're Stuck…"* / *"Why Smart Senior Leaders Stay Stuck…"*.

## 🔴 THIS RUN DID NOT PROVE THE IMPORT WORKED. Do not cite it as evidence that it did.

**Read this before quoting any number in the table above.**

**The non-timing rate reached 0.000 in run 3 — BEFORE the import — and stayed at 0.000 after it.**
There is no movement in the class the rule governs, because there was no room left to move.

**The visible improvement, 0.094 → 0.037, sits ENTIRELY in deliverable timings** — *"in 60
minutes"*, *"within 60 seconds"* — which are permitted copy that `GUARANTEE_CLAIMS_RULE` explicitly
endorses. Fewer of them is not a compliance gain. It is noise moving.

**At five rows the run was STRUCTURALLY UNABLE to detect the rule's contribution.** The class
historically appears in 1 of 5 and 3 of 5 rows. A sample that size cannot separate "the rule
suppressed it" from "it did not occur", and run 3 had already shown it not occurring without the
rule present.

### What the import IS justified by

**Consistency of inheritance, and nothing else. Node 5 should carry what its three sibling
generators carry.** `landingPageGenerator`, `emailSequenceGenerator` and `whatsappSequenceGenerator`
have had this rule since `3d604cd`; Node 5 writes the longest asset in the kit and the only one a
prospect keeps a copy of, and it had never been given it. Closing that gap needs no experimental
result, and it did not get one.

⚠️ **The measurement that DOES stand is the one over the three inheriting generators' production
rows** — that corpus is 4.57M post-rule characters, not 54k. It says the rule is not harmful and is
plausibly working WHERE IT HAS BEEN. It says nothing about Node 5, which had no post-import
production corpus at the time of writing.

### The consequence for the `methodDirective` sibling extension

**It stays unwritten and undecided.** The whole point of importing alone was to learn whether the
import was sufficient on its own. **At this sample we cannot tell**, so the question is open, not
answered. A future session must not read "0 of 5 after the import" as having closed it.

**What would actually settle it:** a corpus large enough for the class's base rate to be visible —
the same treatment the three inheriting generators got, run over Node 5's own production rows once
enough exist post-import, partitioned at this commit.

⚠️ **n=5, ~54k characters. Absence at this sample is not proof.** The class appeared in 1 of 5 and
3 of 5 on earlier runs, so it was never dense enough for five clean rows to settle it.

## 📌 METHOD NOTE — check WHEN, not only WHAT

**Recorded as method, because the first pass produced a confident wrong answer.**

The scan over the three inheriting generators returned what looked like proof the rule was broken:
a fabricated **Harvard Study of Adult Development** citation, a fabricated *"2023 study on
professional women's wellbeing… more than 7 in 10 high-achieving women aged 35-55"*, and — most
damning-looking of all — *"the average working parent makes their first reactive decision of the
day within 90 seconds of waking"*, which is **the rule's own banned bullet reproduced almost word
for word.**

**Then the rows were dated.** LP 29/33/34/36 were created 28 April; email 13 on 23 March. The rule
landed 10 May. **Every one of them predates it.** Partitioned at the rule's commit timestamp the
picture inverts: validator hits **3 before, 0 after**; the wider sweep falls **0.032 → 0.011 per
thousand characters** on the landing page.

🔑 **Checking WHEN a row was written, not only WHAT it says, is what turned an impression into a
measurement.** The same trap waits in any before-and-after run over stored rows — the corpus is
never uniformly aged, and the oldest rows are the dirtiest precisely because they predate the fix
being evaluated.

**Caveats that travel with the result:**

- **Correlational, not controlled.** The compliance layer and the anti-fabrication validator landed
  in the same window; the rule's own contribution cannot be isolated from them.
- **Landing page carries the weight** — 4.30M post-rule characters against email's 170k and
  WhatsApp's 107k. The two smaller corpora support the finding; they do not establish it.
- Every post-rule hit was **read, not counted**: 20 deliverable timings, 23 the reader's or coach's
  own numbers, 6 the coach's own clients in the framing the rule itself permits, 2 *"On-chain data
  shows…"* (a real observable source), 3 a count and two outcome claims.

---

# 🔴 BANKED — THE VALIDATOR BLIND SPOT. It shapes step 5 and is NOT part of this change.

**The import is a prompt-side fix with nothing downstream to catch a miss.**

`_core/validator.ts` implements this rule's percentage class as:

- a quantifier from a fixed list — `above | over | nearly | almost | fewer than | less than`
- a group noun from a fixed list — `people | adults | women | men | professionals | leaders |
  founders | coaches | workers | parents | consultants | clients`

**Node 5's own known statistic — *"puts you ahead of 90% of senior managers"* — matches NEITHER.**
`ahead of` is not a listed quantifier and `senior managers` is not a listed group noun. The X-of-Y
pattern has the same shape and the same gap: the WhatsApp row carrying *"losing roughly 4 in 5 HNW
conversations"* is invisible to it for the same reason.

⚠️ **This is a known gap in the compliance layer on precisely the class of statistic this entire
thread has been about.** It is why the wider sweep was written for the measurement above — the
validator's own patterns fire zero times on post-rule content, and that zero is partly the rule
working and partly the patterns not looking.

🔑 **It shapes step 5 directly: a publish gate that cannot see this class is not a gate for it.**
Any claim that the publish-time compliance gate covers invented statistics has to be checked
against these two lists first.

**Widening the patterns is its own scoped work.** It lives in the compliance path, `validator.ts`
is read by four modules, and it is not part of this change. Not started.

# 📌 BANKED — `PROOF_COMPOSITIONAL_CEILING_RULE`: the same missing-import shape

Defined in `copywritingRules.ts` and **pasted into no prompt anywhere** — its own docblock records
that it was rolled back the day it landed after a JSON-shape regression, and that a post-generation
validator was to replace it. `validator.ts` is its only consumer.

**This is structurally identical to what was just found on Node 5**: a rule that exists, reads as
covered because it is present in the file, and is not actually reaching the generator it was
written for. The WhatsApp composite carrying an invented ratio inside an invented client story is
the shape it was built to stop.

**Not chased now. Recorded so the next audit of "which rules actually reach which generator" starts
from a list rather than from scratch.**

---

# STEP 4 — TIER 3 BUILT. Tiers 1 and 2 scoped only. 2026-08-26

The destination chain is Node 4's tier pattern applied to destinations rather than to mechanisms:
**tier 1** a free-type sibling campaign on the same service · **tier 2** an operator-captured URL
asked for at publish · **tier 3** no destination, card renders as text with no button, nothing ever
invented.

**Only tier 3 is built.** It is correct under every version of the product decision still open, and
it is today's behaviour for 100% of production rows.

## What changed — three surfaces, one rule

| surface | was | now |
|---|---|---|
| downloadable `nextStepBlock` | `<a class="cta" href="#">` — a dead anchor on a page that runs no script, so nothing could ever fill it | `<p class="cta-text">` carrying the same label |
| delivery page `next_cta` | script set `c.href = view` — **the magnet the reader had just been handed** | no anchor emitted; label rendered into `#next_cta_text` |
| quiz result `qz_cta_a` | script set `a.href = CFG.pageUrl` — **the quiz's own address** | no anchor emitted; label rendered into `#qz_cta_text` |

**The CTA label is kept as text on every surface.** Dropping it would silently delete generated
copy rather than degrade it; the coach's closing line still reads as a closing line, it just is not
a button that goes nowhere.

`nextStepUrl` is the seam tiers 1 and 2 land on: pass one and the anchor returns, on all three
surfaces, with `target="_blank" rel="noopener"`. **Nothing populates it** — every caller in
`leadMagnetPublisher.ts` omits it. That is the true state of the data, not a stub.

⚠️ `QuizPageOpts.pageUrl` is now **read by nothing**. It was the result CTA's target, which is
exactly the loop removed here. It is still carried into the page config so the publisher's call
site is untouched, and it is flagged in-file as never a fallback for a destination.

**Gates:** TS baseline **34** · **528 tests green**, 17 new · zero production writes · no published
row touched — the republish sweep remains out of scope and needs its own authorisation.

📌 One test was **loosened during the build, deliberately**: an assertion that no surface emits
`href="#"` failed on the opt-in page's *Read online* and *Download PDF* links, which ship as
placeholders and are filled by script from the capture response. Those are the magnet's own
delivery links, not the bridge. The assertion was wrong, not the code; it is now scoped to the
next-step CTA, with the downloadable — which runs no script — still asserted to emit no dead
anchor at all.

---

## TIER 1 SCOPE — a free-type sibling campaign. NOT BUILT.

**Is `campaign_links` usable? No. It is the wrong shape.**

Its semantics fit — `linkType: "leads_to"` — and it has **0 rows**, so nothing would be disturbed.
But it links `campaignAssets` to `campaignAssets` within one `campaignId`, and it is V1 canvas
furniture: `db.ts:486` `createCampaignLink` has exactly one caller, `routers/campaigns.ts:241`, on
the V1 path. The `campaigns` table it hangs off has **2 rows on production** and is vestigial — the
real campaign object is `campaignKits` (68 rows). So the table joins the wrong two things, inside
a table nothing uses, keyed to a table that is not where campaigns live. **Reusing it would mean
re-pointing all three of its foreign keys, which is a new table with an old name.**

**What would actually express it:** a nullable `nextStepKitId` on `campaignKits`, resolving to
another kit on the same service whose `campaignType` is `webinar`, `discovery_call` or
`in_person_event`, and reading that kit's `selectedLandingPageId` → `landingPages.publicUrl`.

**Cost:** one migration (nullable column, no backfill) · a resolver in the publisher, which already
receives only `hvcoId` and resolves the rest, so `serviceId` is in reach · a UI affordance for
choosing the sibling · publish-time re-resolution, since the sibling's page may be published after
the magnet.

⚠️ **Tier 1 resolves for nothing today.** Of the 3 services owning a lead-magnet kit, **0** carry a
webinar, discovery-call or event kit. Building it does not light up a single production row.

---

## TIER 2 SCOPE — an operator-captured URL. NOT BUILT.

**The machinery works and is proven** — `[INSERT_BOOKING_URL]` is how a discovery-call page gets a
real calendar link. A new token is genuinely cheap: one entry in `OPERATOR_TOKEN_REGISTRY`
(`operatorFields.ts:188`) and one non-empty list at `PAGETYPE_REQUIRED_TOKENS.lead_magnet_download`,
which is `[]` today.

The registry entry has an obvious shape, modelled on the booking token — a hard-hold with a
first-class N/A branch, since **"I don't have one yet" must stay a valid answer** and must land on
tier 3 rather than blocking publish.

**🔴 The token is the cheap half. The expensive half is where the answer lives and who reads it.**

`[INSERT_BOOKING_URL]` has `scope: "coach"`, `path: "bookingUrl"` — it writes one value to the
`users` row, because a coach has one calendar. **A next-step destination is not per-coach**: a coach
may run several magnets pointing at different free events. So it needs `scope: "content"` against a
new field, or a new scope entirely.

And the read path does not currently exist. Operator capture is keyed to a **landing page** —
`routers/landingPages.ts:346` derives questions from `page.pageType` and the angle's content. The
magnet renderer is not on that path: `publishLeadMagnet({ hvcoId })` resolves from `hvcoTitles`.
**A captured answer would sit in landing-page content that the publisher never reads.**

**Cost:** the token and the list (small) · a decision on where the answer is stored, which is the
real work · a read path from that store into `publishDeliverableBody` and `renderOptInHtml` ·
**and the ordering problem** — operator capture runs at landing-page publish, while the magnet is
published from `orchestration.ts:475` during the cascade, which is earlier. Either the magnet
publishes before the answer exists, or magnet publish moves behind the capture step. **That
ordering question is the decision tier 2 actually turns on, not the token.**

⚠️ **Also near-empty today:** 1 of 23 coaches has even a `bookingUrl`. The capture step exists but
coaches are not reaching it.

---

# 🔴 THE REAL GAP IS UPSTREAM — nothing in the cascade asks the coach to build the free next step

**This is the largest finding of the sprint and it is not a Node 5 problem. Recorded under its own
heading so it is not read as a bridge detail.**

`campaignFraming.ts:56-58` states the model outright: *"ZAP's coaches almost always convert on a
FREE next step — a webinar, a training, a free call, a report, a lead magnet — and sell the
high-ticket programme LATER, off-page, after that free step."* The code acts on that belief in
`OfferMode`, in price and guarantee suppression, and in page-type selection. The lead-magnet
standard is built on it: close the minor loop, open the major loop, hand off to **one more free
step**.

**But a campaign is one kit with one landing page.** A lead-magnet kit produces a magnet and the
opt-in page for that magnet, and that is the entire campaign. **Nowhere in the eleven-node cascade
is the coach asked to create, name, or point at the free next step.** It is not a field that is
empty. It is a concept with no field, and no step in the flow that would produce one.

**That is why 0 of 3 services with a lead-magnet kit have a sibling free campaign** — not coach
neglect, and not a data-quality problem. Nothing ever asked.

🔑 **The tier chain makes the failure honest. It does not make the bridge work.** Tier 3 stops the
asset lying to the reader. Tiers 1 and 2 are both retrieval mechanisms for a thing that, today, no
part of the product creates — which is why neither lights up a production row, and why building
either first would be building the back half of a path with no front half.

**The real fix is upstream: ZAP generating or prompting the free next step as part of the flow.**
It belongs on the roadmap **before launch rather than after**, because a lead magnet whose bridge
goes nowhere is the dead-end failure mode the standard names as the single most common reason a
good free asset produces nothing — and the standard's whole loop-splicing spine depends on the
handoff existing.

**Deliberately not scoped here.** It is a product question — what a campaign's free next step *is* —
and it sits upstream of anything the renderer, the publisher or the generator can fix.

---
---

# CHECKLIST — prompt fix at the SHIPPING TARGET (60 words). Caps re-derived, both held. 2026-08-26

**Nothing committed. TS baseline 34. Suites green: 547 across the ten Node-5/gate files**
(`leadMagnetBounds` 38 → 44). Twenty rows generated across three targets on service 233, **zero
production writes**.

## What shipped locally — the count, and nothing else

`userPromptFor("checklist")`: **`one-to-two-sentence detail` → `detail of about 60 words`.** The
surrounding clause is byte-identical. Six tests hold the line, including one asserting the slot
between *"plus a"* and *"that makes it doable today"* carries a length and nothing else.

## 🔴 TWO READINGS OF THIS CHANGE WERE OFFERED BEFORE IT WAS MEASURED. BOTH ARE RETIRED.

Recorded because both were argued confidently and both were wrong, in opposite directions.

| the claim | who made it | what the run showed |
|---|---|---|
| *"the two-sentence count pulls against the 80/20 bar; removing it frees the fill-in templates"* | Arfeen | ❌ **Fill-in-template items went DOWN**, 55/61 → 51/61 at a target of 70, and 46/61 at 60 on the same title. The bar was never the constraint |
| *"a reconciliation, not a reduction — it will not measurably shorten anything"* | CC | ❌ **It LENGTHENED.** Median detail 477 → 523 characters at a target of 70 |

## ✅ THE REASON TO KEEP IT IS THE SPREAD. That is the whole case.

Same title (4324), one clause different, everything else held:

| | old clause | target 70 | **target 60** |
|---|---:|---:|---:|
| `item.detail` median | 477 c / 73 w | 523 c / 83 w | **441 c / 69 w** |
| **`item.detail` IQR** | **126 c** | **69 c** | **38 c** |
| body words (median) | 1,164 | 1,309 | **1,144** |

**The spread collapses by a factor of three while the centre returns to where it started.** That is
what an instruction the model can meet looks like against one it can only ignore. **Predictability is
the gain — not length, and not the bar.** Write it up that way and do not let either retired reading
back in.

## ✅ THE OVERSHOOT RATIO HELD, AND IT PREDICTED THE LANDING

| asked | produced | over |
|---:|---:|---:|
| guide 200 w | 227 w | +13.5% |
| checklist 70 w | 83 w | +18.6% |
| **checklist 60 w** | **72 w** (both titles, n=119) | **+20%** |

60 was chosen to land the centre near 73 words, where old-clause output sat. **It landed at 72.**

📌 **STANDING: this generator lands 15-20% above any stated word target. Set a target BELOW the
intended centre.**

## 🔑 THE SECOND TITLE IS THE STRONGEST EVIDENCE IN THIS THREAD — the beat comes from the CASCADE, not the title

All four checklist-inferring titles on service 233 are **tab-variants of one deck**, so a different
theme is not obtainable here. What varies is **how much the title hands the generator**:

- **4324 (long tab)** — *"The 3 Reasons Senior Directors Get Auto-Rejected When They Apply Outside
  Their Industry — and the Exact CV Repositioning Fix That Gets Callbacks Within 2 Weeks."* States
  the domain, the mechanism's territory, the fix and the window.
- **4352 (short tab)** — *"The 3 Auto-Rejection Reasons Call."* States that three reasons exist.
  Nothing about what they are, what domain they live in, or what fixes them.

### Root-cause opener read — 9/10, and the split is the finding

| title | opener names why previous attempts failed |
|---|---|
| 4324 | **5/5** |
| 4352 | **4/5** — row 1 opens on evidence-gathering (timestamp your last three rejections to prove automated screening) and defers the mechanism to later items |

🔑 **READ THE 4/5, NOT THE 5/5. The 4/5 is the finding and the 5/5 cannot tell us anything.**

4324 states the mechanism's territory in the title, so its 5/5 is compatible with the generator
simply reading the beat off the title. **4352 states only that three reasons exist** — no domain, no
mechanism, no fix — **and the sector-membership diagnosis still arrived in 4 of 5 rows.** It is
therefore **not** being read off the title. **It is coming from the cascade context**, which is
identical for both. That is evidence of ROBUSTNESS in the beat itself, and it closes a weakness
flagged in the previous report rather than merely passing a check.

⚠️ **Two limits travel with it and must not be dropped.** 4352 still names a symptom
("auto-rejection"); a title naming no symptom at all does not exist in this deck. And **only the
TITLE varied — service, ICP, offer and mechanism are identical across all twenty rows**, so this
tests the title's contribution, not the cascade's.

## 📌 STANDING RULE — THE ROUNDING STEP SCALES WITH THE VALUE

**Round a derived cap UP to the nearest TEN below 1,000, and to the nearest HUNDRED at or above
1,000.** Up, so nothing sitting at the fence is trimmed by a rounding artefact.

**Why it is a rule and not a footnote:** the guide rounded a fence of 2,714.5 to the nearest hundred,
moving it 3.7%. Applying a hundred to a fence of 118.5 moves it 93% and converts a measured cap into
a decoration. **A rounding step that is a large fraction of the value silently relocates the cap off
the distribution it was derived from.** This applies to every cap derived anywhere in this codebase.

## ✅ BONUS MODE MEASURED AT THE TARGET — the mode gap was the CLAUSE, not the mode

`applyBodyBounds` takes a **format, not a mode**, so one cap governs both. Every bonus item in
existence was old-clause output, and it carried the widest spread of any corpus — **IQR 171.8, p90
660, max 743** — which is where the 20-25% legacy trim rate came from. **Five rows were regenerated
from the two ORIGINAL bonus briefs** (rows 36 and 33 — same title, same description, same obstacle),
so only the clause differs.

**Prediction stated before the run, and all four parts held:**

| predicted | measured |
|---|---|
| tail collapses, IQR ~172 → 50-70 | ✅ **IQR 171.8 → 52.0** |
| centre barely moves, ~420-460 c, no rise | ✅ **420 → 414 c**; 71.5 → 70.5 words |
| trim rate falls from ~20% to 0-5% | ✅ **1/54 = 1.9%** at the shipped cap |
| the cap does not need to move | ✅ **580 → 570**, one rounding step |

🔑 **The legacy 20-25% trim rate was a property of the ABANDONED CLAUSE, not of bonus mode.** Same
briefs, same mode, clause swapped: **25% → 1.9%.** The gap that held the caps back is closed.

### Do the modes sit differently? No — and the axis that DOES vary is not one a schema can express

| | median | IQR |
|---|---:|---:|
| bonus @60 | 70.5 w / 414 c | 11.5 w / 52 c |
| lead magnet @60 | 72.0 w / 448 c | 11.0 w / 53 c |

**In words — the unit the target is stated in — the two modes are 1.5 words apart with identical
spread.** The 34-character gap is a words-per-character artefact, not a difference in what the field
does.

📌 **Brief-to-brief variation is ~3x the mode gap:** within bonus, row 36 medians **407 c** and row 33
**501 c** — 94 characters apart, against 34 between the modes. **So `applyBodyBounds` does NOT need a
mode parameter.** Mode is not the axis of variation, and the axis that is — the individual brief —
is not something a per-mode schema split could address. Recorded so nobody builds that split later
believing this run implied it.

## ✅ THE CAPS — BUILT AND LANDED, derived across the FULL corpus at the shipping target, both modes

**173 items across 15 bodies**, every one generated at the shipping target: 119 lead-magnet across
two titles, 54 bonus across two briefs. **The legacy bonus rows, the target-70 arm and the old-clause
arm are all excluded** — caps are not derived from output at a target being abandoned. Legacy is
shown as a retro check only.

| field | proposed | derivation | retro over 173 |
|---|---:|---|---|
| `item.detail` | **570** | upper fence **563.5** (Q1 411.0 · Q3 472.0 · IQR 61.0) | **2/173 — 1.2%** |
| `item.label` | **120** | upper fence **119.0** (Q1 64.0 · Q3 86.0 · IQR 22.0) | **1/173 — 0.6%** |
| `promise` | **320** | rule 1 — `common`'s own "max two sentences" | 0/15 |
| `items` | **minItems 7, maxItems 15** | rule 1 — the prompt's own range | 0/15 |
| `nextStep` | **uncapped** | unchanged — it carries the bridge | — |

Per corpus at those caps — `detail` 0/61 · 1/58 · 1/54, and **5/20 on the legacy old-clause rows**;
`label` 1/61 · 0/58 · 0/54 · 0/20.

📌 **The trim rate is LOW (1.2%) because the generation-side lever is doing the work, and that is the
design.** A working target tightens the distribution, which pulls the fence in close to the data and
leaves few genuine outliers. **A cap trimming little is only a problem when the distribution is wide
and the cap is above it** — here IQR is 61 characters. Compare the numbers this replaced: 900/100
derived from bonus-only legacy data trimmed **0 of 20** across an IQR of 171.8 while permitting 1.8x
the largest body ever produced.

Worst case ≈ 15 x (120 + 570) + 320 ≈ **10,670 c ≈ ~1,600 words**, against a largest observed body of
1,459. **~1.10x.**

**Verified through the SHIPPED code, not through the derivation script** — `applyBodyBounds` re-run
over all 15 stored bodies reproduces the derivation exactly: **detail 2/173 (1.2%) · label 1/173
(0.6%) · array 0 · promise 0**, and — the check that stopped step 3 — **0 details severed
mid-sentence.** `items[].detail` uses the block-safe trim, which falls back to the sentence cut in
practice because 0 of 173 details carry a newline and the renderer emits the field as one paragraph.

📌 The BOUNDS hold-out note is replaced by the landed derivation, and the tests that asserted the
hold-out now assert the caps. Gates at the commit: **TS 34, 550 green across ten files.**

## ⚠️ WATCHED, NOT CLOSED — the population-claim family

| | items | population claims | numeric population claims |
|---|---:|---:|---:|
| old clause | 61 | 3 | 0 |
| target 70 | 61 | **6** | **1** — *"Most Directors in this position find 20-35 before they stop counting"* |
| target 60 | 119 | 3 | **0** |

**Bonus mode at the target: 54 items, 2 flagged, and BOTH are detector false positives.** Read in
full, they are *"the most common beginner mistake is opening Ads Manager"* and *"the single most
damaging thing beginners do is edit the campaign within the first 48-72 hours"* — **"most" as a
superlative, not as a population quantifier.** Genuine count: **0 population claims, 0 numeric.**
🔑 Same lesson the compliance work paid for: **a flagged span is not evidence of which rule fired.
Grade a hit by reading it.**

At the shipping target the rate is its lowest of the three and no numeric claim appeared. The
target-70 run is the outlier. **All arms carried `NO_RESEARCH_STATISTIC_FABRICATION_RULE` in the
system prompt.**

🔴 **This stays OPEN and watched, not closed.** It is the **second time a length change has moved
something in the invented-figure family**, and n per cell is around 60 items on one service. 🔗 It is
the shape banked as the validator blind spot — a quantifier plus a group noun matching neither fixed
list — so nothing downstream would catch it. **Any future length or shape edit in any node reports
this family alongside its word counts.**

## 📌 Also measured, reported without a conclusion

**Fill-in-template rate does not move cleanly with the target.** On title 4324: 90% (old clause) →
84% (70) → **75% (60)** — monotone down. But title 4352 at the same 60-word target returns **86%**.
Bonus mode at the same target returns **36/54, 67%**, the lowest of any arm — but on two briefs whose
legacy items measured 16/20.

**Title and brief variance is at least as large as the target effect**, so nothing here is
attributable at this n.

# 🔴 STANDING — DO NOT TIGHTEN THE CHECKLIST LENGTH TARGET FURTHER WITHOUT MEASURING FILL-IN RATE.

**It is the 80/20 bar's ONLY direct measurement**, it is the bar this format exists to serve, and no
test, gate or word count detects its loss. The trend on the one title measured at all three settings
is **monotone down — 90% → 84% → 75%**. That may be title noise. It may be the target squeezing out
the templates that make an item usable. **At the current setting it is open, not closed, and the next
tightening is the run that has to answer it.**

## 📌 BANKED, not chased

1. **`howToUse` is uncapped on all three static formats** while its prompt asks for "2-4 sentences";
   both production rows measure **481 characters**. Cross-format — it touches guide and toolkit too.
2. **Instruction competition runs BOTH WAYS, and repetition count matters, not only position.** On
   the guide a **narrower, LATER** instruction overrode a broader earlier one. On the checklist a
   **broader instruction stated THREE TIMES** overrode a narrower one stated once — and the winner
   was the earlier, vaguer one. 🔗 The overlap audit must count how many times a shape is stated, not
   only where each statement sits. **An instruction stated once is at risk from any instruction
   stated more often, wherever it sits in the prompt.**

---

# ✅ DECIDED — the free next step is GENERATED, not captured. 2026-08-27

Tier 1 is native generation: a lead-magnet campaign also produces a free-event landing page on the
same service, using the existing landing-page machinery and its existing free page types, and the
magnet's `nextStepUrl` resolves to that page's `publicUrl`. Tier 2 (a coach's own existing
destination) survives only as an escape hatch and is **not part of this build**. Tier 3 stays the
floor.

## 🔑 THE ARGUMENT THAT SETTLED IT — generation does not escape operator capture. It CHANGES THE QUESTION.

This was the strongest reason and it should be quoted rather than paraphrased.

A generated webinar/event page **cannot publish without operator input**: `operatorFields.ts:456-457`
gives `webinar_registration` the tokens `[INSERT_EVENT_DATE] [INSERT_EVENT_TIME]
[INSERT_EVENT_TIMEZONE]`, and `runLandingPagePublish` carries a hard gate that throws on any
surviving `[INSERT_*]` (`landingPagePublisher.ts:182-187`). So Tier 1 is generation **plus** a
capture moment, not generation instead of one.

**That is not a defeat of the decision — it is the case for it.** Capture-at-publish and generation
both ask the coach a question. The difference is which question:

| path | the question | can the coach answer it? |
|---|---|---|
| Tier 2 — capture | *"Paste the URL of your free next step"* | 🔴 **No.** 1 of 23 users has even a `bookingUrl`; `videoUrl` and `checkoutUrl` are zero. The URL does not exist because the thing does not exist |
| Tier 1 — generation | *"What is your free event — webinar, training, session — and when is it?"* | ✅ **Yes.** Answerable **before they have built anything.** ZAP then builds the thing the answer describes |

**One of those questions a coach cannot answer. The other they can answer before they have built
anything.** Capture asks for a destination the coach does not have and returns tier 3 with extra
steps; generation asks for facts they already hold and produces the destination.

📌 The answer has a home already: `campaignKits.campaignFacts`, a JSON column typed
`{ eventSchedule?, price? }`, captured upfront and applied deterministically to a freshly-generated
LP via `factsToTokenAnswers` (`orchestration.ts:303, 626-630`). **Nothing new is needed to hold it.**
And the path is proven, not theoretical: **15 webinar/event pages are published on production
today** (11 webinar, 4 event, across 12 services).

## Re-measured 2026-08-27, and the case holds

`users` 23 · `bookingUrl` **1** · `videoUrl` **0** · `checkoutUrl` **0** — unchanged from the prior
trace. `landingPages` 92 rows / 38 published. **Services with a magnet body: 2. Services with a
published webinar/event page: 12. Overlap: 0.** Still zero on a re-measure.

📌 **`landingPages` is ALREADY one-to-many per service** — 11 services carry more than one page and 5
carry more than one published page. The single-destination assumption is **not** in that table. It
lives entirely in `campaignKits.selectedLandingPageId`, one nullable `int`, read in **33 places
across 14 files** including Push to GHL, the Meta publish script and five V2 client components.

## Build order — the trigger goes LAST, and the content proof comes before the plumbing

Four of the five pieces live outside `server/_core/orchestration.ts`; only the automatic trigger
needs that guarded file, so it is built last, once everything it fires is proven.

**And the content question outranks all of the plumbing:** does a generated webinar page RESOLVE the
root-cause loop the magnet opens, or merely restate it? Wiring the cascade trigger before that is
known would be plumbing to a destination that may not hold. **Prove the content first.**

### 🔴 A CONSTRAINT THE TRIGGER OWNS — the free-event page must never be a kit's first or only landing page

Found while building the no-clobber path, and recorded here as well as in `crownIfPrimary`'s
docblock, in the same words, because whoever scopes the trigger will read this file rather than the
docblock of one they may never open.

**Suppressing the crown suppresses FOUR things, not one.** `autoSelectBest` performs, in order:

1. `ensureCampaignKit` — **CREATES the kit** when absent;
2. the `selectedLandingPageId` pointer write — the clobber the flag exists to prevent, on a pointer
   with **33 readers across 14 files** including Push to GHL and the Meta publish script;
3. **`markDownstreamStale`** (the extraction committed in `85bcc8b`);
4. the kit **COMPLETENESS check**, which flips `status` draft → complete.

**(3) is correct to suppress**, and is pinned by an executable-documentation test: an additional
artefact reselects nothing, so no downstream asset is built against a superseded choice. Stale
marking answers *"the selection moved"*; on this path it did not move. **Do not read its silence
there as a regression of `85bcc8b`.**

🔴 **(4) IS THE ONE THAT CAN BITE.** A kit whose **only** landing page is the free-event page would
**never flip to `complete`**, because nothing else would ever crown one. In the designed flow the
magnet's own opt-in page crowns first, so the kit already carries the pointer and completeness has
already been evaluated by a crowning step. **The trigger owns this: the free-event page must never
be a kit's first or only landing page.** (1) is likewise safe only because the kit exists by then —
the magnet campaign's own kit.

## 📌 BANKED, not chased — `markTweakStale` is a third copy, and it is contained

Found by the parity test on its first run, before the stale fix was committed (`85bcc8b`).
`campaignKits.ts:577-591`, comment *"Same logic as re-crown but triggered explicitly by the client
after a successful tweak."*

**Its two differences from the shared helper look DELIBERATE rather than accidental**, and that is
why it was not folded in:

1. **No old/new comparison — it marks unconditionally.** Correct for its trigger: the tweak has
   already happened, so there is no "was this a re-crown" question to ask.
2. **It does not clear stale on the tweaked node.** This may also be intended; nothing read so far
   settles it.

Folding it in would change a **shipped client mutation** on an assumption about (2). The parity
guard pins the class at **three copies** — a fourth implementation fails the test — so it is
contained rather than open. **Whether copy three's differences are right is its own small question,
for whenever we are next in that file.**

## ✅ PAGE TYPE DECIDED — `webinar_registration`, and the reason is structural

`PAGETYPE_REQUIRED_TOKENS` (`operatorFields.ts:455-460`):

| page type | hard-hold tokens |
|---|---|
| **`webinar_registration`** | date · time · timezone — **no price token at all** |
| `event_registration` | date · **venue** · **price** |

**A page type that structurally CANNOT display a price beats one that can and must be told not to.**
Choosing `event_registration` routes every free next step through the price question and depends on
the FREE sentinel to say "this is free". Webinar never raises the question.

**THE COST, STATED PLAINLY: three new questions in the intake, for campaigns that today ask none.**
Verbatim from the registry: *"When's your event — what date?"* · *"What time does it start?"* ·
*"Which timezone is that in?"* They are cheap and answerable **before the coach has built
anything** — which is the same argument that chose generation over capture — but they are three,
not zero. That is the price and it is real.

`NA_SENTINEL.FREE` **does** clear `[INSERT_PRICE]` cleanly (proven by running it: prose substituted
with "free", `price.amount = "__FREE__"` written structurally, zero leftover tokens), so
`event_registration` remains viable — it is simply the worse default.

📌 **BANKED — the FREE normalisation is anchored and misses a natural answer.**
`operatorFields.ts:300` matches `^(free|no charge|no cost|complimentary|£0|$0|0)$`. So `free`,
`no charge`, `£0`, `0` and `complimentary` all reach the sentinel — **`it's free` does not.** The
question is worded *"a set amount, free, or by application?"*, to which *"it's free"* is a natural
answer. It does not block publish (the token still clears) but `price.amount` becomes the literal
string, `classifyPrice` never sees FREE, **the free template variant is not selected**, and the
prose renders *"price it's free"*. One-line anchor change, its own small question.

# 🔴 CONTENT PROOF — the free next step needs its OWN framing. Neither existing frame fits. 2026-08-27

Two arms x 5 rows, `pageType: "webinar_registration"`, service 233, **zero writes** — the landing-page
generation core (`generateLandingPageAngle` / `generateAllAngles`) has no DB access at all, so the
proof needed no authorisation. Arms differ in ONE string: the campaign framing spliced into
`enrichedAvatarDescription`. A = `lpFramingForCampaign("lead_magnet")` (what the code does today),
B = `lpFramingForCampaign("webinar")` (what the build would need).

## ❌ THE PREDICTION WAS WRONG, and it is worth recording why

Predicted: the `lead_magnet` framing (*"Urgency mechanism: None… no deadline, no countdown"*, *"CTA
language: Get the free guide / Download free"*) would override the page-type instruction, and arm A
would read like a second lead magnet.

**It did not. Arm A produced a genuine webinar page in 5 of 5 rows** — *"Join me live on
[INSERT_EVENT_DATE]"*, CTA **"Save Your Seat"**, urgency built entirely on the live session. The
`pageType` block won the slot, not the campaign framing. **The slot competition ran the opposite way
to the guide-prompt case**, which is a caution against treating "the narrower, later instruction
wins" as a rule rather than an observation.

## The three questions, answered

**1. Does arm A read like a second lead magnet? NO.** It reads like a webinar. Prediction retired.

**2. Does arm B read like a webinar? YES**, marginally more strongly — it adds seat-cap scarcity arm
A lacks. ⚠️ **And that scarcity is INVENTED**: *"I am keeping attendance deliberately limited… a
capped number of seats. When those seats are gone, registration closes."* No coach supplied a seat
cap. The `webinar` framing's *"Limited seats available"* licensed an operational claim about the
coach's own event. Same fabrication family as the invented statistics — **banked**.

**3. 🔴 DOES EITHER ASSUME A COLD READER? BOTH DO, DECISIVELY. This is the finding.**

Measured across all 10 rows: phrases restating what the magnet already delivered (insider language,
sector-membership, jargon, auto-rejection, CV repositioning) appear **7-15 times per row, in every
row**. Phrases carrying the magnet's unresolved gap forward appear **0 times in 7 of 10 rows**.

The agendas are the plainest evidence. Arm A's curriculum:

> 1. *Why capable Directors get auto-rejected cross-sector*
> 2. *The three linguistic signals that mark you as an outsider*
> 3. *The Sector Translation Audit — line-by-line repositioning live*
> 4. *The callback-generating repositioning sequence*

**That is the magnet's table of contents.** The magnet is titled *"The 3 Reasons Senior Directors Get
Auto-Rejected… and the Exact CV Repositioning Fix That Gets Callbacks Within 2 Weeks"*, and its item 1
is the *'Insider Language' Scan*. Arm A's subheadline promises *"the exact **three reasons** Directors
… get auto-rejected before a human being ever reads their name — and the CV repositioning method that
starts getting callbacks **within two weeks**"* — the magnet's own promise, returned to a reader who
has just finished working through it.

Arm B is the same shape: *"the method that deconstructs why your CV is being read as a
sector-membership document rather than a leadership evidence file"* — against the magnet's promise
*"reads as transferable leadership evidence — not as a sector-membership badge"*.

**What NEITHER arm picks up is the gap the magnet's own bridge names and leaves open:**

> *"Repositioning your CV for a new sector only works when you're **aiming at the right sector**."*

The reader finishes the magnet with the language fixed and **no destination**. Nothing in either page
starts there. Arm B gets closest — one agenda item reads *"The Three-Conversation Entry Plan for
Directors Without Sector Contacts"* — but items 1-3 are still the magnet restated.

## 🔑 THE CONCLUSION — a new framing, not a reuse

Both `lead_magnet` and `webinar` framings in `campaignFraming.ts` are written for **a stranger
arriving from an ad**. `webinar` says *"Copy must give a compelling reason to attend live"* and says
nothing about what the reader already knows. **Neither frame has a concept of a reader who is one
step in**, so the generator does the only sensible thing with a cold frame: it introduces the problem.

> **NEW ITEM PROPOSED:** a campaign-framing entry for the post-magnet free next step
> **Purpose:** every existing entry in `LP_CAMPAIGN_FRAMING` addresses a cold reader. A page that
> converts someone who has ALREADY read the magnet and already knows the root cause needs framing
> that takes the diagnosis as understood and starts from the unresolved gap. No existing entry can
> express that, and reusing one produces a page that restates the magnet — measured, 10 of 10 rows.

**This is a finding about the design, not a failure of the run**, and it lands before any plumbing is
built around the wrong assumption — which is the whole reason the content proof came first.

---
---

# 📊 THE EVIDENCE BEHIND COMMIT `88c97ec` — arms A · B · C · C2, per row. 2026-08-27

**What this section is.** `88c97ec` records a finding — *a prohibition stated in an earlier, broader
layer does not survive a later, narrower instruction that names the same field and attaches a word
count* — and a result: invented attendance limits **5 of 5 → 1 of 5**. **These are the numbers behind
both.** They existed only in a session scratchpad, which does not survive.

🔑 **Why that mattered enough to bank.** This sprint spent a day undoing the phantom
*"research-backed quality bar"* — a claim written into a checkpoint with nothing behind it, quoted
for months, and unfalsifiable by the time anyone went looking (CLAUDE.md §15a records the same shape
in three replication specs). **A commit message reading "5 of 5 to 1 of 5" with the per-row counts
gone is that artefact in better clothes.** Someone reads it in six months and either trusts it
blindly or discards sound work because they cannot check it. Everything below is here so the finding
can be re-derived or overturned.

**Held constant across all four arms:** service **233** · ICP **212** · user **1613** · kit **152** ·
one HVCO title · `pageType: "webinar_registration"` · angle `original` · the same cascade context
(2,259 chars, `selectionsResolved=5/5`) · N=5 · same build. **The only string that differs between
arms is the campaign framing spliced into `enrichedAvatarDescription`.** Arms A and B were run
2026-08-27 (`lpFramingForCampaign("lead_magnet")` and `("webinar")`); C and C2 are the two wordings
of `LP_FRAMING_FREE_NEXT_STEP`. **Zero production writes on every run** — `generateLandingPageAngle`
and `generateAllAngles` contain no database access, so persistence never enters the path.

⚠️ **n=5 per arm. Every number below is a screening signal, not a significance test**, and the read
of the pages is the instrument the counters serve.

## The four framings, by their urgency line

| arm | framing | urgency line |
|---|---|---|
| **A** | `lead_magnet` | *"Urgency mechanism: None. The asset is genuinely free and stays available…"* |
| **B** | `webinar` | *"Urgency mechanism: Date and time of the webinar. **Limited seats available.**"* |
| **C** | free-next-step, **first wording** | *"the date and time of the session, **and nothing else** — any limit on attendance comes only from what the coach supplied"* |
| **C2** | free-next-step, **shipped wording** | *"the session is live and happens once… **write it from that fact, at whatever length the section calls for.** Any limit on numbers, seats or availability comes only from what the coach has supplied"* |

## Per-row counts — one instrument across all four arms

Arms A and B were **re-counted from their stored JSON with these same regexes**, because the 7–15 and
0-in-7-of-10 figures in the 08-25 checkpoint were counted by a different session with different
phrase lists. These counters are broader; direction is what transfers between the two records, not
the absolute number.

| | A | B | C | C2 |
|---|---|---|---|---|
| body chars, per row | 8192 · 8813 · 6855 · 8694 · 8872 | 10591 · 11173 · 10364 · 9724 · 9569 | 10525 · 9265 · 8927 · 9602 · 10301 | 9567 · 8105 · 7742 · 10299 · 7278 |
| **mean chars** | 8,285 | 10,284 | **9,724** | **8,598** |
| restating, per row (raw) | 23 · 12 · 12 · 13 · 22 | 12 · 17 · 19 · 16 · 15 | 17 · 12 · 8 · 5 · 5 | 15 · 9 · 14 · 9 · 5 |
| **restating, total** | 82 | 79 | **47** | **52** |
| gap-carrying, per row | 5 · 2 · 0 · 8 · 3 | 8 · 8 · 1 · 7 · 7 | 11 · 10 · 12 · 12 · 11 | 10 · 6 · 6 · 19 · 5 |
| done-as-done, per row | 1 · 0 · 0 · 0 · 0 | 1 · 0 · 0 · 0 · 0 | 0 · 1 · 1 · 0 · 1 | 1 · 1 · 1 · 3 · 2 |
| — rows at zero | 4/5 | 4/5 | 2/5 | **0/5** |
| **capacity claims, rows (read)** | **0/5** | **5/5** | **5/5** | **1/5** |

## Restating, normalised — and the arithmetic behind the C → C2 rise

Raw counts flatter arm A: its bodies are the shortest in the set. The rate is the fair figure.

| arm | per 1,000 chars, per row | mean | pooled | worst row |
|---|---|---|---|---|
| A | 2.81 · 1.36 · 1.75 · 1.50 · 2.48 | **1.98** | 1.98 | 2.81 |
| B | 1.13 · 1.52 · 1.83 · 1.65 · 1.57 | **1.54** | 1.54 | 1.83 |
| C | 1.62 · 1.30 · 0.90 · 0.52 · 0.49 | **0.97** | 0.97 | 1.62 |
| C2 | 1.57 · 1.11 · 1.81 · 0.87 · 0.69 | **1.21** | 1.21 | 1.81 |

**Mean-of-rates and pooled agree to two places on all four arms**, so the choice of estimator is not
carrying the result.

📌 **The C → C2 rise of 25% is TWO effects of near-equal size, not one.** Raw restating rose
**47 → 52 (+10.6%)** and mean body length fell **9,724 → 8,598 chars (−11.6%)**. ⚠️ An earlier
in-session characterisation of this as *"raw counts barely moved"* was **wrong and is corrected
here**: the count moved about as much as the denominator did. C2 remains the second-lowest of the
four arms and its worst row (1.81) is level with arm B's worst.

## The three questions, per arm

| | A | B | C | C2 |
|---|---|---|---|---|
| **Q1** reads like a webinar | 5/5 | 5/5 | 5/5 | 5/5 |
| **Q2** assumes a warm reader | **0/5** | **0/5** | 5/5 | 5/5 |
| **Q3** carries the magnet's unresolved gap | **0/5** | **0/5** | 5/5 | 5/5 |
| — of which the gap is the page's OPENING move | — | — | 3/5 | **4/5** |

Q1 held in **20 of 20 rows across four framings**: the `pageType` block wins that slot regardless of
framing, which retires the earlier prediction that campaign framing would dominate it.

Arm B's nearest miss on Q3 is a single agenda line, *"The Three-Conversation Entry Plan for Directors
Without Sector Contacts"*; items 1–3 of that same agenda are the magnet restated.

## 🔴 THE URGENCY SECTIONS — the contrast IS the evidence, so both sides are quoted

### The inventions — arm C, under a framing that forbids them, 5 of 5 rows

> **C1** *"**Seats are capped** so that there is enough space in the session for the live audit demonstration to be meaningful… When the seats are gone, the registration page closes… that changes **as soon as the cap is reached**, and I will not reopen it for this session."*
>
> **C2** *"the number of CVs I can review on screen in real time is finite, and **once those slots are taken, they are gone for this session**… the live audit slots, and **the three bonuses reserved for people in the room**, are not available on replay."*
>
> **C3** *"**I cap attendance** so that the Q&A at the end is a real conversation about your specific situation, not a queue. **Once the room is full, the registration link closes.**"*
>
> **C4** *"the session has a **hard limit on registered attendees**. Once that number is reached, registration closes, and **the next opportunity to attend live is the following cohort**."*
>
> **C5** *"**If the session fills** before [INSERT_EVENT_DATE], I will close registration and **open a waitlist for the next date**."*

Arm B, for comparison — the framing that licensed it: *"I am keeping attendance **deliberately
limited**… it is a working session with a **capped number of seats**. When those seats are gone,
registration closes."*

**The coach supplied none of this.** Verified read-only before the runs: `services` (233),
`idealCustomerProfiles` (212), `sourceOfTruth` and `campaignKits` (152) scanned for capacity
language — two hits, both unrelated (*"limited experience"*, one in `decisionMaking`);
`campaignFacts` is **NULL**; positive control fired.

### The true substitutes — arm A (before the fix existed) and arm C2 (after it)

**Arm A is the control, and it predicted the mechanism before the mechanism was named.** Same field,
same 200–300-word demand, same page type, urgency mechanism *"None"* — and **zero caps in five rows**:

> **A1** *"I am running it live — **not as a pre-recorded presentation dressed up as a live event** — because the questions that surface in the room are the ones that matter most."*
>
> **A2** *"This free live training **runs once**… **There is no evergreen version of this session** — what I walk through live is built around the questions that come in from the room."*
>
> **A4** *"I am running it live… the most useful part of an hour like this is not the slides. It is the moment you hear your specific situation named… **That only happens in a live room.**"*

**Arm C2, the shipped wording**, spends the field in the same place — rows 2, 3, 4 and 5 carry no
capacity claim of any kind:

> **C2-2** *"It runs once… **the work we do inside it cannot be replicated in a recording.**"*
>
> **C2-4** *"There is no version of it you can catch later at the same quality… **A recording of this session is a record of other people's questions. The live session is where your questions get answered.**"*
>
> **C2-5** *"there is no evergreen version of this, no automated replay drip, no 'catch it when you can.' … **When it ends, it ends.**"*

**The one survivor, C2 row 1** — one clause at the end of a ~240-word section, not a section built
around a cap:

> *"Register now, add it to your calendar, and show up with your current CV and your target sector in mind. That is the only preparation you need. **Seats are limited to keep the session genuinely interactive.**"*

🔑 **The field is the same length in every arm.** What changed is whether it had something true to
spend the words on. That is why the fix was a substitute and not a firmer prohibition, and why
`landingPageGenerator.ts` item 13 was left untouched.

## 🔴 THE FIVE WORDINGS THE PHRASE LIST MISSED — written out, because that list is what a gate gets built from

The counter as first written held `capped` · `cap on` · `limited seats` · `limited spots` ·
`limited places` · `limited attendance` · `attendance is limited` · `only N seats` · `seats are
gone` · `registration closes` · `room for only` · `small group of N` · `first N to register` ·
`keeping it small` · `deliberately limited` · `limited number` · `limited to N`.

**The model wrote these instead, and every one slipped through:**

| # | what the model wrote | where |
|---|---|---|
| 1 | **"slots are taken"** | arm C row 2 |
| 2 | **"I cap attendance"** | arm C row 3 |
| 3 | **"the room is full"** | arm C row 3 |
| 4 | **"if the session fills"** | arm C row 5 |
| 5 | **"seats are limited"** | arm C2 row 1 |

Adding those five, the widened list reproduces the read exactly on all four arms — **A 0/5 · B 5/5 ·
C 5/5 · C2 1/5** — with positive controls confirming the narrow list misses what the wide list
catches. **The narrow list scored arm C at 2 of 5 and arm C2 at 0 of 5.**

📌 **Its catch on arm B was luck of wording, not coverage** — B happened to phrase four of its five
caps with `registration closes`, which was on the list. A list that scores 5/5 on one arm and 2/5 on
the next, for the same defect, is not measuring the defect.

### The conclusion, stated plainly so it is not softened later

**AN UNFLAGGED SPAN IS NO MORE EVIDENCE THAN A FLAGGED ONE.** This repo already records that a
flagged span is not evidence of which rule fired; this is the same lesson from the other end, and it
is the more dangerous half, because a zero reads like a pass.

🔴 **A publish-time gate built on phrase lists would have passed three of arm C's five pages and
reported this run as clean.** This is the **second class** of the validator blind spot already banked
in this document — the first being a quantifier plus a group noun matching neither fixed list. **It
constrains step 5 further than the first instance did:** the narrative-format publish gate that
step 1's precision finding called the viable first step cannot be built on phrase matching for this
class, and any claim that it covers invented operational facts has to be checked against the actual
wordings above before it is believed.

## 📌 Two things this run did NOT establish — recorded so they are not read into it

1. **The gap's CONTENT came from the offer, not from the framing.** `describeHvco` carries the lead
   magnet by title only (a documented decision, `cascadeContext.ts:36-45`), so the generator never
   saw the magnet's own bridge line — *"repositioning your CV only works when you're aiming at the
   right sector"*. What it had was the offer's value proposition, in the cascade context verbatim:
   *"a specific, researched, viable industry, a named role type, and a credible entry plan"*, which
   arm C rows 3–5 and arm C2 rows 2, 4 and 5 reuse almost word for word. **The framing supplied the
   SHAPE of the gap; the offer supplied its CONTENT.** This result therefore **does not generalise to
   a service whose offer does not already name the destination**, and that is the first thing to test
   when the bridge build reaches a second service.
2. **The free next step drifts toward selling the thing it exists to precede.** Two C2 rows give
   agenda item 4 to a walkthrough of the paid 12-week programme — *"The Career Reinvention Blueprint:
   what a fully supported 12-week transition looks like from the inside"*, with weekly deliverables —
   inside a free session's agenda. Arm C row 5 has the same shape. The *"12-week"* itself is grounded
   (`services.description`); what is not is a quarter of a free session's agenda being a programme
   pitch. **This is the dead-end failure mode wearing different clothes** — the free asset pointing at
   the sale instead of at the next free step — and it belongs to the bridge work, not to the framing.

## Artefacts and gates

Driver: the arm A/B driver (`lp-freestep-proof.mts`) reused byte-for-byte for C and C2 with one line
changed — the framing string. Counters, criteria and raw JSON lived in the session scratchpad and are
**not** in the repo; this section is the durable record of what they produced. Criteria for arm C
were pre-registered before any output existed.

Gates at `88c97ec`: TS baseline **34** · `pipeline-fixes` **401** + `cascadeContext.truncate` **18** =
**419 green** · zero production writes across every run in this phase.

---
---

# 🔴 ITS OWN PASS — THE CAMPAIGN-FRAMING MAP EXISTS FOUR TIMES, AND TWO COPIES ARE WRONG TODAY

**This is a wrong-output defect, not a tidying job. Read the consequence before the mechanism.**

## The consequence, live on production right now

**A coach running a `discovery_call`, `lead_magnet` or `in_person_event` campaign gets emails and
WhatsApp messages framed as a paid course launch** — *"Transformation journey… **Enrolment is the
decision point**… Urgency mechanism: **Enrolment deadline. Cohort size is limited.** CTA language:
**Enrol now** / Join the programme / Claim your place before [date]"* — for a campaign where
**nothing is being enrolled in and nothing is for sale.**

That is not a hypothetical. **It is the same defect, in the same words, that was already found and
fixed once on the landing page.** `_core/campaignFraming.ts` exists *because* the landing-page map
carried four of seven campaign types and generated a FREE discovery-call page against *"Enrolment is
the decision point / CTA language: Enrol now"*. The fix was applied to the landing page and to
nothing else. **Two generators still carry the original.**

## The mechanism — four copies of one map, and the type is what separates them

Found 2026-08-27 while scoping a source guard for the free-next-step framing override. The guard as
first written asserted the framing prose lived in exactly one file; **it failed immediately**, which
is how this surfaced.

| file | key set | typed | status |
|---|---|---|---|
| **`_core/campaignFraming.ts`** | **7 of 7** | **`Record<CampaignType, string>`** | ✅ the single source, and the only one that cannot silently regress |
| `adCopyGenerator.ts` (`campaignTypeContextMap`) | 7 of 7 | `Record<string, string>` | 🟡 complete today, **unprotected** — nothing makes an omission fail |
| `emailSequenceGenerator.ts` (`campaignTypeContextMap`) | 🔴 **4 of 7** | `Record<string, string>` | 🔴 **wrong output today** |
| `whatsappSequenceGenerator.ts` (`campaignTypeContextMap`) | 🔴 **4 of 7** | `Record<string, string>` | 🔴 **wrong output today** |

The three copies carry **byte-identical prose** for the keys they share. The missing three in email
and WhatsApp are exactly the three the landing-page fix added: **`discovery_call`, `lead_magnet`,
`in_person_event`** — the FREE campaign types, which are the overwhelming majority of ZAP's traffic.

🔑 **`Record<string, string>` is the whole defect.** Under `Record<CampaignType, string>` an
incomplete map is a **compile error**; under `Record<string, string>` it is a lookup that misses and
falls through to whatever the default is. **The type-level completeness was the actual fix on the
landing page** — the three missing entries were only the symptom that happened to be visible.

⚠️ **Verify the fallback before writing the fix.** The consequence above assumes these maps fall
through to `course_launch` the way the landing page's did. That is the shape, and the prose quoted
above is what `course_launch` says in all four copies — **but the fallback expression in each of the
three files has NOT been read.** Read all three before quoting a consequence at anyone.

## The shape of the pass, not a design

**Import, do not re-derive** — the same instruction `GUARANTEE_CLAIMS_RULE` carries. `_core/
campaignFraming.ts` already exports `LP_CAMPAIGN_FRAMING` and `lpFramingForCampaign`, and the prose
is already shared, so this is deletion plus an import in three files.

**One question has to be answered first, and it is a product question:** the map is currently named
for the LANDING PAGE (`LP_CAMPAIGN_FRAMING`), and an email's framing needs are not a page's — *"CTA
language: Save your seat"* is right for both, *"the page runs with no deadline"* is page vocabulary.
**Whether the four surfaces genuinely share one framing, or share a spine with per-surface CTA
lines, decides whether this is one constant or a small structure.** Do not answer it by inference.

⚠️ **Three generators, all of them shipped copy paths, none of them touched since 07-29.** It travels
alone, it needs its own before/after on real output, and it does not belong in a Node 5 sprint.

📌 **The landing-page guard is deliberately scoped and says so in its own test comment.** A
repo-wide assertion would fail today, and **a guard that cannot pass is worse than no guard** — it
gets deleted by the next person rather than fixed. The scoped guard pins that the landing-page path
inlines no framing; widening it to the repo is a deliverable OF this pass, not a prerequisite for it.
