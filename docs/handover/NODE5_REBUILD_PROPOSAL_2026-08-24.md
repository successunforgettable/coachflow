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
