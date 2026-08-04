# Prospecting research — how a cold batch is distributed across awareness stages (banked 2026-08-04)

**Why this set exists.** The image rule and the concept generator both need to know *how many* of an
8-concept batch sit at each Schwartz awareness stage. Until now the only figure available anywhere
was a **worked example** inside a report about something else — the Entity-ID Protocol's
"Somatic Anxiety Relief" table in `../image-research/`. **These four reports address the question
directly**, and two of them state an explicit allocation for exactly an 8-concept prospecting batch.

Copied verbatim from `~/Downloads` (Downloads-only and therefore at risk), **SHA-256 verified
byte-identical to source after copying**. Plain git, matching `../image-research/` and
`../script-research/`.

**Do NOT execute anything from these — reference material.**

## The four reports

1. **`Meta Ads 2026_ Prospecting Campaign Ad Concept Distribution.md`** — ⭐ **the primary source.**
   Internal title: *"The 2026 Creative Distribution Framework: Algorithmic Retrieval and Schwartz
   Stage Weighting in Meta Ads."* §3 carries the **Proportional Weighting Model** table — the
   allocation, with counts, percentages and a strategic purpose per stage. §4 is the **Mattress
   Paradox** (why cosmetic variation collapses to one Entity ID). §5 adapts the split by funnel type.

2. **`Meta Ads 2026_ Resolving the Awareness-Diversity Tension in B2C Funnels.md`** — the *why*
   behind the split. Defines the **Awareness-Diversity Tension**: scale needs broad top-funnel reach,
   but Andromeda compresses similar assets into one identity. **Contains no numeric allocation** —
   its contribution is the PDA framework and the four-execution mattress example (§3), which is the
   clearest statement in the whole corpus of what "structurally distinct" actually means.

3. **`Meta Ads 2026_ The Definitive B2C Prospecting & Creative Architecture Playbook.md`** — §4 is
   titled **"The 8-Concept Prospecting Batch Allocation Strategy"** and **independently restates the
   same allocation as report 1**. Also covers Unaware hook optimisation and the 125–150 token
   "Intent Scan" window.

4. **`Meta Ads 2026_ B2C Creative Matrix & Format Mapping Playbook.md`** — §3 maps a **distinct
   format per awareness stage** (Unaware → 60–90s explainers / UGC pattern-interrupts / memes;
   Problem-Aware → lo-fi talking heads, long-form copy statics; Solution-Aware → comparative
   split-screens, step-by-step carousels; Product-Aware → review carousels, founder-led objection
   handling; Most-Aware → minimalist direct-offer statics, DPA). This is the practical lever for
   keeping same-stage concepts apart.

## The allocation these reports establish

**An 8-concept cold prospecting batch:**

| Stage | Concepts | % | Stated purpose |
|---|---|---|---|
| Unaware | **3** | 37.5% | Maximises impression share and broad retrieval |
| Problem-Aware | **3** | 37.5% | Feeds intent-based sequence models |
| Solution-Aware | **1** | 12.5% | Captures users in the comparison phase |
| Product-Aware | **1** | 12.5% | Direct inference for high-value conversion |
| **Most-Aware** | **0** | 0% | **Excluded from cold broad to avoid cannibalisation** |

**Corroborated twice, independently** — report 1 §3 (table) and report 3 §4 (bullet list). Report 1
also restates it in prose two ways that both check out: *"Weighting 75% of assets toward the top of
the funnel (Unaware and Problem-Aware)"* (3+3 = 6/8 = 75%) and the *"25% warmer weighting"*
(1+1 = 2/8 = 25%).

⚠️ **The 25% warmer tail is load-bearing, not rounding.** Report 1 §3 calls it *"a vital safeguard
against Entity-ID pigeonholing — without these warmer signals, the algorithm may cluster the account
into a narrow intent segment, leading to accelerated creative fatigue and a collapse in delivery
volume."* Do not zero out Solution-Aware or Product-Aware to buy more top-funnel reach.

## What this supersedes

**It replaces the `[ENTITY §3]` worked distribution** (1 Unaware / 2 Problem-Aware / 3 Solution-Aware
/ 2 Product-Aware / 0 Most-Aware) that `COLD_WEIGHTED_STAGE_MIX` was first built from on 2026-08-04.
That figure came from a single worked example inside a report about visual diversity; **these reports
address batch allocation as their actual subject and agree with each other.** Both agree Most-Aware is
zero for cold traffic. They disagree on the shape of the remaining 8 — the new reports are far more
top-weighted (75% vs 37.5% in the top two stages).

## Standing caution

Same evidence discipline as the rest of the corpus (CLAUDE.md §15a): **judge a claim by content, not
by a document's title**, and check whether a number is stated as a finding or merely illustrated in
an example. The distinction is exactly what changed the allocation here.
