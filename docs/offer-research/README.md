# The ZAP B2C Offer Standard

**This folder is the grounding for Node 3 (Offer).** Six commissioned B2C research reports sit
alongside this file; this file is the distilled standard the generator is built against. The
prompt-side expression of it lives in `server/_core/offerStandard.ts` — if the two ever disagree,
**this document is the authority and the prompt is the thing that is wrong.**

Reading order for a cold session: this file, then a report only when you need its detail.

---

## 0. Two laws, before anything else

### 🔴 ZAP IS B2C ONLY

Every buyer is an individual spending their own money on themselves — a coach, a consultant, a
tarot reader, an astrologer, a yoga teacher and their clients. **There is no buying committee, no
procurement, no board, no SME account, and no ROI case.** The decision is personal, and it is made
on identity and trust rather than on a business case.

A framework that arrives in B2B clothing is **rewritten or dropped, never translated.** A
B2B-framed prompt fails silently across most of the user base — the same failure mode CLAUDE.md
§15a records for corrupt reference specs, where every gate passed against a lie.

> ### ⚠️ TWO OF THE SIX REPORTS ARE CONTAMINATED. STRIP THE EXAMPLES, KEEP THE FRAMEWORKS.
>
> **`Psychological Economics…`** and **`Ethical Value Stacking…`** were generated against B2B
> source material and carry it throughout. The frameworks in them are sound; the examples are not
> about our user and must never be reused, quoted, or turned into prompt examples:
>
> | Contaminant | Where it appears | What it actually is |
> |---|---|---|
> | **Avian** | "Transport Management System", "eliminating empty miles", "1,500 vehicles" | B2B logistics SaaS |
> | **Nexius** | "AI reporting", "audit-ready accuracy", "99% error elimination", "cost of a human accountant" | B2B accounting SaaS |
> | **POLRI SuperApp** | "126% user growth", "access police services as easily as ordering pizza" | Government service app |
> | **SME** | "Small-to-Medium Enterprise", the whole "SME Efficiency Architecture" fulfilment table | B2B segment |
> | **LinkedIn Insight Tags** | platform-risk section | B2B ad channel; ZAP runs Meta |
>
> `Ethical Value Stacking…` §2's entire offer-stack worked example is an SME accounting stack.
> **Read it for the objection-dismantling STRUCTURE — time friction, skill friction, certainty
> friction — and discard every row.** The equivalent B2C structure is in the *Workbook*'s sleep-
> coaching stack, which is the one to imitate.
>
> The same discipline `docs/icp-research/`'s README applies to its own B2B/RevOps framing.

### 🔴 THE OFFER CONVERTS TO A FREE NEXT STEP

In almost every ZAP campaign the reader's next step is **free** — a webinar, a live training, a
free call, a report, a lead magnet. **The high-ticket programme is sold LATER, in conversation,
away from the page.** A paid tripwire is a deferred minority case.

This reframes the whole node. On a free campaign the offer's job is the **programme context that
makes attending worth an hour of someone's life** — the transformation, the mechanism, the value
equation — and **not a price and not a money-back guarantee.** There is nothing to buy in the
room, so there is nothing to refund.

> **Measured, 2026-08-20.** Ignoring this was a live defect, not a theoretical one. On service 1
> (`price=3000.00`, `guaranteeType="Full refund"`, `guaranteeDuration="90 days"`) a **free webinar**
> page was generated carrying the £3,000 in `faq[4]` and the money-back promise in `faq[5]`, on
> three of its four angles — inside the `faq[0..5]` window both webinar templates render straight
> to the buyer. See §7 for the two guards that now close it.

**What the reports say about SLO / tripwire funnels is deliberately NOT implemented.** *Engineering
Irresistible B2C Offers* §1 builds its whole architecture on a $7–$37 front-end, order bumps and
one-click upsells. ZAP's landing pages are not geared for it and ZAP has no payment integration
(the only checkout is the coach's own external URL on a sales page). The **value-equation,
positioning, naming, urgency and compliance** content of that report is fully in force; its funnel
architecture is on the shelf.

---

## 1. The value equation — the engine under every section

    Value = (Dream Outcome × Perceived Likelihood of Achievement) / (Time Delay × Effort & Sacrifice)

All six reports converge on it. In B2C the levers read differently than in B2B:

| Lever | B2C reading | What raises it |
|---|---|---|
| **Dream Outcome** ↑ | **Identity, not features.** The buyer is purchasing a version of themselves. | Translate raw pain into identity: *"anxious and overwhelmed"* → *"the woman who leads her family with calm authority."* Name both ends of the gap. |
| **Perceived Likelihood** ↑ | **Certainty is often worth more than the thing itself.** | A named, repeatable mechanism; the order it runs in; what it accounts for that prior attempts did not. Real proof where it exists — the mechanism alone where it does not. |
| **Time Delay** ↓ | **The 30-minute rule.** A fast, small, real win validates the whole system. | Name the FIRST thing that shifts and how soon. Speed is the strongest available evidence of certainty. |
| **Effort & Sacrifice** ↓ | **Cognitive load is the offer killer.** The 60-hour course is a liability. | Name the one thing they do NOT have to do that they assumed they would. Templates, checklists, walked-through steps. |

**Compounding note** (*Workbook* §1): collapsing Time Delay and Effort does double duty — an
immediate win drives Perceived Likelihood up at the same time.

**ZAP wiring.** These are the levers, so the generator is fed their actual inputs: ICP
`hopesDreams` is the Dream Outcome, and `pains` + `fears` are the cost of inaction. Before this
pass the offer prompt read `objections`, `buyingTriggers`, `implementationBarriers` and
`successMetrics` — four fields, **not one of them a lever in the equation the prompt was built on.**

---

## 2. New Opportunity, not Incremental Improvement

A reader who has tried and failed reads *"do it better"* as *"you didn't try hard enough"* and
withdraws — the reports attribute this to amygdala-driven defensiveness. The way through is to
move the blame off the person and onto the **old vehicle**.

Write it in three beats:

1. Name 1–2 approaches this reader has already tried, in their field's own words.
2. Say what those approaches **structurally leave out** — what they were never built to handle.
3. Introduce the coach's method as a different vehicle addressing exactly that gap, **named** so
   it can be held in mind as one thing.

The reader should finish thinking *"no wonder that didn't work"*, not *"I failed at that."*
Curiosity in place of shame is the entire objective.

| Old vehicle (triggers shame) | New opportunity (shifts the blame) |
|---|---|
| "Better stretching for flexibility" | **The Vagus Nerve Reset** — why frozen fascia makes traditional yoga useless |
| "Eat 10% less" | **The Insulin Myth** — why the metabolic switch is stuck |
| "Meditate more for focus" | **Quantum Reality Mapping** — the 5-minute script that bypasses the unfocused mind |

*(B2C examples only. The Nexius "better accounting" example in `Psychological Economics` §3 makes
the same point about a B2B SaaS and is not usable here.)*

---

## 3. Identity, status and symbolic consumption

B2C purchases are **symbolic**. The buyer is resolving friction between the **Actual Self** and the
**Ideal Self**, and the offer is the bridge. In the spiritual and wellness niches the need being
met is psychogenic — inner peace, grounding, certainty — and those are not soft benefits.

- Name the identity being **left** and the one being **moved to**, both specifically. *"The
  scattered seeker"* → *"the woman with a practice she trusts"* does more work than any feature list.
- Write in the field's own vocabulary. **Three or more phrases only an insider would use** is the bar.
- Address one person, and describe situations **from the coach's side of the table** — what they
  have watched happen — rather than asserting facts about the reader (see §6).

---

## 4. Naming — the MAGIC formula

On cold traffic the name is the primary magnet and the cognitive container for value. The reader
must know the result in about **three seconds**.

| | Component | Example |
|---|---|---|
| **M** | Magnet — theme or occasion, where one is real | "Winter Reset", "Live Q&A" |
| **A** | Avatar — who it is specifically for | "for postpartum mothers" |
| **G** | Goal — the outcome, in the field's words | "Deep Sleep", "Clear Skin" |
| **I** | Interval — timeframe, **only when it is a supplied fact** | "7-Day", "72-Hour" |
| **C** | Container — the word that makes it one designed thing | Protocol, Blueprint, Reset, Intensive, Roadmap, Audit |

Use the components that genuinely apply; forcing all five produces parody. Three architectures all
work: **result in the title** ("The Six-Figure Soulpreneur"), **stuck-to-unstuck** ("From Chronic
Fatigue to Boundless Energy"), and **it-is-what-it-says** ("The Somatic Yoga Academy").

**The two tests.** *Tell a friend* — if they cannot state the outcome back in three seconds, it is
not there. *Swap test* — if the name could sit on a different coach's page in a different field,
it is a category, not a name.

**Naming failure modes** (`The Anatomy of Offer Naming Failures`):

- **The Black Box** — naming the deliverable instead of the objective. *"60-Minute Coaching"* makes
  the reader do the imaginative work of picturing the result, which they will not do.
- **The Inside Joke** — self-centred branding ("The Zenith Method") with no outcome in it.
- **The absolute-outcome trap** — "Guaranteed Profits", "Instant Healing". These trigger semantic
  classifiers and invite FTC Section 5 scrutiny. A name carries an interval only when the interval
  is a supplied fact, and describes a result the method plausibly produces, never an absolute one.

---

## 5. Ethical urgency — real constraints only

Urgency comes from three places, **all of them facts**:

1. **Operational capacity** — the honest limit of what one person can deliver. A room holds what it
   holds; a coach fits so many calls in a week. Strongest and most defensible, because it is true.
2. **A real date** — a live session happens at a time. That time is the deadline; it needs no
   decoration.
3. **The cost of waiting** — what another quarter of the current situation actually costs,
   described from the coach's experience. Always available, never expires, needs no operator fact.

A "limited" offer that is not actually limited is deceptive pricing under **16 CFR § 233.5**, and a
countdown that resets is the fastest way to lose a reader. Where a figure or date would appear and
has not been supplied, ZAP emits the operator-fill token so the coach supplies the real one.

---

## 6. Guarantees, pricing and platform compliance

### Guarantees — transaction-framed, always

**The single hardest rule in this standard.** A guarantee describes **what the coach does** — what
is returned, and the window it runs for. It **never** describes how the buyer will turn out.

- ❌ Outcome-framed ("lose 10 lbs or money back", "cures anxiety", "guaranteed results",
  "100% effective", "permanent solution") — flagged by ML classifiers in health, wellness and
  finance; leads to ad rejection, conversion-tracking restriction and account bans.
- ✅ **Satisfaction-framed** — *"if you don't love the experience, we refund you."*
- ✅ **Better-than-money-back** — full refund and the buyer keeps the digital bonuses. Bonus
  valuations must be *bona fide* (16 CFR § 233.1); inflating a PDF to "£500 value" is deceptive.
- ✅ **Operationally anchored** — delivery/format guarantees, support-response SLAs, real capacity
  limits. These ground the promise in verifiable labour rather than in biology.
- ✅ **Results in advance** — a free assessment or session lets the reader verify quality before any
  transaction. **This is the free-event path's native risk reversal**, and it needs no refund.

Using "risk-free" or "money-back" creates a legal obligation to an unconditional, simple refund
process, disclosed **clear and conspicuous at the outset** — not in a footnote or behind an
asterisk. Under the **Consumer Review Fairness Act**, a refund may never be made contingent on a
non-disparagement clause.

### Pricing and anchoring — 16 CFR Parts 233 & 251

- **Bona fide former price.** Any "was" price must have been openly and actively offered for a
  reasonably substantial period — **typically 30 days**. The *John Doe* example: marking a £7.50 pen
  up to £10 for three days to advertise it back down to £7.50 is a deceptive act.
- **No fictitious value.** The "£9,997 for £27" aesthetic drives refunds and payment-processor
  freezes as well as regulatory risk. Prefer **verifiable worth** — saved labour, time compression,
  real capacity — over an arbitrary "Worth £497" label.
- **Defensible anchors only**: true historic prices; the coach's *actual* 1:1 rate where it has real
  sales history; the cost of the mainstream alternatives the work replaces; the cost of inaction.
- **"Free" is regulated.** Under Part 251 the buyer must pay nothing for the bonus and no more than
  the regular price for the core product; the cost of a "free" item may not be recovered by marking
  the core product up.

### Meta — personal attributes

Meta forbids asserting or implying knowledge of a user's sensitive traits. The **second-person
trap** — *"Are you tired of being broke?"*, *"Conquer your depression"* — is the primary trigger.
Pivot to community framing and to describing the coach's own experience:

| Instead of | Write |
|---|---|
| "Are you struggling with debt?" | "Tools for managing household cash flow" |
| "Conquer your depression today" | "A new path for those seeking mental wellness" |
| "Are you suffering from back pain?" | "How our members are finding relief through somatic movement" |

ZAP already enforces this as `second_person_protected_attribute` and `audience_attribute_descriptor`
in the compliance layer — **the two highest-volume tier-1 classes on free pages today.**

---

## 7. How the standard lands in ZAP: the two offer modes

The offer node resolves a **mode** and writes to it. The mode comes from the campaign's own type
via `_core/campaignFraming.ts` — the same `campaignType → pageType` chain the landing page uses —
so the offer and the page it feeds can never disagree about whether money changes hands. An
operator-captured price (`campaignKits.campaignFacts.price`) overrides in **both** directions, and
that override is the seam the deferred paid tripwire will land on.

| campaignType | pageType | mode |
|---|---|---|
| `webinar` | webinar_registration | **free_event** |
| `discovery_call` | discovery_call_booking | **free_event** |
| `lead_magnet` | lead_magnet_download | **free_event** |
| `in_person_event` | event_registration | **free_event** *(→ paid if the operator sets a real price)* |
| `course_launch`, `product_launch`, `challenge` | sales_page | **paid** |

**The output shape is identical in both modes** — the same seven `OfferContent` keys, all strings.
Only what they carry changes:

| key | `free_event` | `paid` |
|---|---|---|
| `offerName` | the **free session's** name (MAGIC) | the programme's name |
| `valueProposition` | what the attendee walks out with + cost of waiting | functional outcome + cost of waiting |
| `pricing` | **access & terms** — it's free, what to bring, nothing is sold in the room | the price, or `[INSERT_PRICE]` |
| `bonuses` | what attending live gets you (3 name slots, no values) | 3 name slots |
| `guarantee` | **the attendance promise** — what you keep even if you never buy | transaction-framed refund terms |
| `urgency` | real capacity + real date + cost of waiting | real capacity + real dates |
| `cta` | register / book / download | buy / enrol / book |

`pricing` and `guarantee` **stay non-empty in free mode** on purpose: an empty `pricing` renders as
"Pricing: —" on the kit card and ships blank in exports.

**Two independent guards close the FAQ leak**, deliberately not one:

1. **The offer node** (`offersGenerator.ts`) withholds the price and guarantee facts from the
   prompt in free mode. Asking a model not to use facts it has been handed is the failure this
   replaces.
2. **`describeOffer`** (`_core/cascadeContext.ts`) suppresses those facts on the way into the
   landing-page prompt, keyed off the **page's** campaign type — so it holds even for a legacy
   offer row that was generated paid-shaped.

### Anti-fabrication holds unchanged

Everything here operates **inside** the existing anti-fabrication layer, which is not relaxed:
`validateOfferFabricationPatterns` + the canonical `[INSERT_*]` token allow-list still govern every
price, value, duration, cohort size and date. Two consequences worth stating:

- **The customer profile is evidence about the BUYER, never a source of offer facts.** Since ICP
  Phase A, `pains` can legitimately contain the coach's own currency figures, and
  `detectInventedCurrencyAmounts` flags *every* `£N` in the output when no price is supplied. The
  ICP text is therefore passed through `neutraliseProfileCurrency` before it reaches the prompt —
  a structural guard, not a prompt instruction, because this codebase has already paid twice for
  the difference.
- **`services.riskReversal` is not a valid guarantee source.** It is AI-generated at the service
  node under a column commented *"Guarantee suggestion."* It may become a suggested default the
  coach opts into — never a silent fallback.

---

## 8. The non-negotiables

1. **B2C only.** No committee, no procurement, no ROI case. Strip Avian / Nexius / POLRI / SME.
2. **Free campaign → no price, no refund promise.** The offer is programme context.
3. **Guarantees describe the transaction, never the outcome.**
4. **No invented values.** Price, bonus values, durations, cohort sizes, dates and guarantee terms
   are operator-supplied or they are a canonical token.
5. **Urgency is a real constraint** — capacity, a real date, or the cost of waiting.
6. **No second-person claims about the reader's body, health, finances or state of mind.**
7. **Specificity from the field's vocabulary**, never from a fabricated number.
8. **The customer profile describes the buyer**, never the offer.

---

## 9. The six reports

| # | Report | Read it for | Status |
|---|---|---|---|
| 1 | *Engineering Irresistible B2C Offers for Cold Meta Traffic* | Value equation in B2C terms; New Opportunity; MAGIC; Meta personal-attributes matrix | ✅ clean *(SLO funnel §1 deliberately not implemented)* |
| 2 | *B2C Offer Engineering — A Step-by-Step Workbook* | Identity mapping; certitude protocol; 30-minute rule; friction stripping; the **B2C** bonus stack | ✅ clean |
| 3 | *The Anatomy of Offer Naming Failures* | Black Box / Inside Joke / absolute-outcome traps; MAGIC-compliant naming; name A/B testing | ✅ clean |
| 4 | *Compliant Risk Reversal & Guarantees for B2C Offers* | The guarantee rules in §6 — the most load-bearing report here | ✅ clean |
| 5 | *Psychological Economics — Desire, Status, Identity, Ethical Urgency* | Self-concept theory; belief-shifting sequence; ethical urgency | ⚠️ **B2B-contaminated** — Avian, Nexius, POLRI |
| 6 | *Ethical Value Stacking & Deception-Free Pricing* | 16 CFR 233/251 detail; objection-dismantling structure; defensible anchors | ⚠️ **B2B-contaminated** — Nexius, Avian, POLRI, the whole SME stack table |
