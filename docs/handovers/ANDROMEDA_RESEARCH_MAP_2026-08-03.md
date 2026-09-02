> # ⚪️ SUPERSEDED 2026-09-01 — DO NOT USE THIS FILE AS THE CURRENT PICTURE
>
> **The live index is [`docs/RESEARCH_INDEX.md`](../RESEARCH_INDEX.md), which is GENERATED from the
> filesystem and regenerated with `python3 tools/research-index.py`.**
>
> **Nothing below has been edited.** Correcting a past record in place falsifies it — this file
> stays exactly as written, as the record of what was believed on 2026-08-03.
>
> Known to be wrong below, per the 2026-09-01 sweep: it classifies landing-page research by
> production method rather than content (so 51,872 words of teardowns file as "worked examples");
> it lists **Offer** and **Unique Method** as needing research when both are recorded done
> elsewhere; and it does not distinguish **HELD** research (Email, WhatsApp — exists, Arfeen holds
> it, not banked) from missing research.

---

# Andromeda research set — where every document lives, and which ones the code was built from

**2026-08-03. Read-only investigation. Nothing built, committed, or pushed.**

Answers §3b of `CHECKPOINT.md`. Three sections: **the full list** · **what the code was actually
built from** (traced through source-comment citations, not prose) · **the gaps**.

**Method:** every "built from" claim below is anchored to a citation in the source code itself —
a file and line where the code names its source. Where the link is asserted only by a handover or a
README and the code carries no citation, that is stated explicitly rather than assumed.

---

## 1. THE FULL LIST — 47 research documents in four locations

### A. `docs/andromeda/` — tracked in git, 9 files

| path | covers |
|---|---|
| `docs/andromeda/EXECUTION_BRIEF.md` | The Andromeda initiative brief. The P.D.A. framework (Persona × Desire × Awareness), the 8–12-distinct-concepts rule and the Entity-ID reason for it, the six named hook patterns, what is CONFIRMED vs folklore, and §5's correction that Meta's `creative_diversity_score` / `creative_fatigue` API fields **do not exist** |
| `docs/andromeda/landing-page-research/README.md` | Index of the seven below + the confirmed/unconfirmed split |
| `…/Technical Analysis of Meta's Landing Page Compliance and Policy Scanning Systems (2026).md` | How Meta crawls and OCRs the destination page to enforce policy |
| `…/Technical Analysis_ Meta's Landing Page as a Targeting Input and Retrieval Mechanism.md` | Whether the LP feeds targeting (the split-sources question) |
| `…/Technical Analysis_ Semantic Retrieval and the Role of Landing Pages in Meta's Andromeda Ecosystem.md` | Semantic retrieval and the LP's place in Andromeda |
| `…/Technical Analysis_ The Mechanics of Ad-to-Landing Page Alignment in Meta's 2026 AI Ecosystem.md` | Ad-to-page coherence as a hard compliance requirement |
| `…/Technical Report_ Meta Ad Infrastructure and Landing Page Semantic Analysis (2024–2026).md` | Meta's ad infrastructure and LP semantic analysis |
| `…/Technical Report_ Meta Landing Page Experience, Compliance, and Algorithmic Ranking in the Andromeda Era.md` | LP experience signals and algorithmic ranking |
| `…/Technical Report_ Meta's AI Ad Delivery and Audience Selection Architecture (2024–2026).md` | How Meta's AI picks the audience — the 2026 algorithm report |

### B. `docs/icp-research/` — ⚠️ ON DISK, NEVER COMMITTED, 5 files

`git ls-files` returns 0 for this directory; all 5 are untracked.

| path | covers |
|---|---|
| `docs/icp-research/README.md` | Synthesis into R1 (standard) / R2 (method) / R3 (validator) / R4, plus the B2B→coaching translation note |
| `…/The Psychology of the ICP_ A Strategic Report on Internal Buyer Dimensions.md` | **R1** — the depth bar: problem pressure, fears, JTBD/identity, sophistication, objections, buying triggers, verbatim VOC language |
| `…/Methodology Report_ Systematic ICP Signal Extraction from Vague Business Inputs.md` | **R2** — the 5 Rings of Buying Insight; laddering a vague pain to its root; evidence vs hunch |
| `…/Diagnostic Report_ The Mechanics of ICP Failure and Recovery.md` | **R3** — the five ICP failure modes (breadth trap, echo chamber/fabrication, demographic theatre…) |
| `…/Strategic Report_ The Precision-Impact Matrix of the Ideal Customer Profile (ICP).md` | **R4** — precision vs impact trade-off |

### C. `docs/bonus-research/` — tracked, 7 files

`README.md` plus: *Bonus Failure Modes & Design Architecture Checklist ($100M Offers)* · *Strategic
Architecture of the Bonus Stack: Coherence, Value, and Quantity* · *Honest Value Framing and the
Architecture of High-Trust Bonuses* · *The Architecture of Premium Digital Bonuses: Strategic Format
and Quality Conventions* · *The Strategic Architecture of High-Value Incentives: A Decision Framework
for Bonus Derivation* · *The Taxonomy of High-Value Incentives*.

### D. Other in-repo reference material — tracked

| path | covers |
|---|---|
| `docs/compliance/META_AD_COMPLIANCE_REFERENCE.md` | **The single most load-bearing document in the repo.** Meta's published policy + a ~15-report research sweep, split into Tier 1 (confirmed, may become enforcement logic) / Tier 2 (practitioner-reported) / Tier 3, with a **DO-NOT-BUILD list** of plausible-sounding material absent from Meta's docs |
| `docs/landing-page-research/The Comprehensive Guide to High-Converting Coaching Landing Pages (2025–2026).md` | LP conversion structure for coaching |
| `docs/landing-page-research/The Direct-Response Landing Page Image Guide_ A Systems Design Blueprint.md` | Which image goes in which LP slot, and why |
| `docs/landing-page-references/replication-specs/` (9 specs) | Per-page visual replication specs — Hormozi, Ali Abdaal, Burchard ×2, Iman Gadzhi, Jeff Walker, Jenna Kutcher, Rajsekar ×2. ⚠️ Governed by CLAUDE.md §15a: the frozen PNG outranks the prose |
| `docs/AD_IMAGE_VISUAL_QUALITY_STANDARD.md` · `LANDING_PAGE_VISUAL_QUALITY_STANDARD.md` | Internal quality bars — **written by us, not research** |

### E. ⚠️ `~/Downloads` ONLY — never copied into the repo, 24 documents

This is the material the ad-script and compliance code was actually built from. **It exists in one
place, on one machine, in a folder holding 847 unrelated files.**

**The ad-script / creative-strategy corpus — 9 documents (2026-07-25 and 07-26):**

| file | covers |
|---|---|
| `Meta Ads Creative Strategy 2026_ Mapping Hook Patterns to Schwartz Awareness Stages.md` | **The hook→awareness map.** Which hook pattern belongs to which of Schwartz's 5 stages |
| `Strategic Report_ Optimising Meta Video Ad Lengths for the 2026 AI Ecosystem.md` | **Script length by awareness stage**, and placement behaviour under Advantage+ |
| `Comprehensive Report on Video Ad Script Structure and Timing Metrics.md` | The five-beat script shape and per-beat timing |
| `Analysis of High-Performance Video Ad Hooks for Cold Audiences.md` | Opening lines that stop a cold scroll — under ~10 words, bold |
| `Scripting the _Messy Middle__ Maintaining Attention in Talking-to-Camera Video Ads.md` | Holding attention between hook and CTA — one idea at a time |
| `Scripting for Success_ Analytical Report on Natural Video Ad Performance.md` | Why natural/unpolished outperforms; story before statistic |
| `Analysis of Conversational Calls-to-Action in Video Advertising.md` | CTA as a natural extension rather than an interruption |
| `Analytical Report_ Calibrating Spoken Tone for Video Ad Performance.md` | Tone by audience warmth (cold / warm / hot) |
| `Technical Report_ Synthesizing Natural Speech Patterns for Talking-to-Camera Ad Scripts.md` | Making written lines sound spoken |

**The Meta-compliance corpus — 15 documents (2026-07-27).** These are the "~15 reports" the
compliance reference names in its own header. Only the *synthesis* was banked in the repo; the
sources were not.

Policy Analysis ×4 (Personal Hardship and Attribute Standards · Financial Information Targeting ·
Cryptocurrency Permission for Educators · Personal Attributes and Privacy Violations) · *Meta-Compliant
Vocabulary and Taxonomy Reference: Healthcare, Neurodivergence, and Finance* · *Linguistic Ambiguity
Report: Clinical vs Ordinary Language in Coaching Copy* · *False-Match Analysis: Linguistic Ambiguity
in Compliance Detection Systems* · *Enforcement Analysis: Meta Policy vs Practitioner-Reported
Reality* · *Compliance Strategy: Third-Person Framing* · *Taxonomy of B2C Coaching Vernacular* ·
*Scalable Compliance: The Coach & Consultant's Guide to Meta Ad Copy Patterns* · *Proxy Language
Analysis: Indirect Signaling of Protected Attributes* · Vocabulary Report ×3 (Financial Vulnerability ·
Physical Health Signalling · Mental Health and Neurodivergent Signalling).

### F. Adjacent — on disk, ZAP-shaped, no code trace found

Not counted in the 47. Flagged so they are not lost, but nothing in the codebase cites them:
*Universal High-Ticket Offer Template & Strategic Capture Report* · *Strategic Offer Frameworks and
Client Capture Systems* · *Challenge Architecture Report: 3–5 Day High-Intensity Transformation
Programs* · *Test-to-Discovery-Session Architecture Report* · *Distribution and Completion
Architecture Report* · *Landing Page Builder: Detailed Technical Stack* · *Architecting a Scalable
Landing Page Builder: The SwipePages Blueprint* · *ZAP_Strategic_Ideas_and_Weaknesses*.

### G. Not verifiable from here

The checkpoint records **6 documents uploaded to the project on 2026-08-02**. Files uploaded to a
Claude project are not visible on the filesystem, so they cannot be confirmed from this side. The
four named in the checkpoint — Meta 2026 algorithm, ad length, scripts, landing-page alignment — each
correspond to a document found above, so the likelihood is that they are re-uploads of the same
corpus rather than a seventh unknown set.

---

## 2. WHAT THE CODE WAS ACTUALLY BUILT FROM

Traced through citations in the source. Each row is a real file:line where the code names its source.

| research document | where it shows up in the build | anchor |
|---|---|---|
| `EXECUTION_BRIEF.md` §2/§8 | The P.D.A. concept axis — concepts vary Desire × Awareness with persona fixed to the ICP | `server/_core/conceptAxis.ts:5` |
| `EXECUTION_BRIEF.md` §2 | The 6 named hook patterns; the concept validator's structural rules | `conceptAxis.ts:25` · `_core/conceptValidator.ts:12` |
| `EXECUTION_BRIEF.md` §2 | Concept count — brief says 5–12 scaling with spend; code holds a single tunable at **8** | `conceptAxis.ts:41-44` |
| `docs/andromeda/landing-page-research/` (7) | Concepts span **all 5** Schwartz stages — diversity earns separate Meta Entity-IDs, and there is no cold-narrowing rule in the data | `conceptAxis.ts:13-15` |
| **`Meta Ads Creative Strategy 2026: Hook Patterns → Schwartz Stages`** (Downloads only) | **`CANDIDATE_HOOK_AWARENESS_MAP`** — the per-stage primary/secondary hook map, marked `approved: true` on 2026-07-25 | `conceptAxis.ts:46-71` |
| `docs/icp-research/The Psychology of the ICP` §6 | Corroborates 2 of the 5 stage mappings independently (Problem-Aware→Problem-First; Product-Aware→Social-Proof). The earlier web-derived candidate map was **retired** as ungrounded | `conceptAxis.ts:48-53` |
| **The 7 scriptwriting reports** (Downloads only) | The five-beat script shape **Hook → Problem → Turn → Solution → CTA**, with per-report section citations: Structure/Timing §2, Hooks §5 (intro <10 words + bold), Messy Middle §1 (one idea), Natural Perf §5 (story before stat), CTA §1 (natural extension). Turn length deliberately unspecified — *"reports: no strong signal"* | `_core/scriptPromptCraft.ts:51-73` |
| **The 7 scriptwriting reports** | `WORD_BUDGET_TABLE` — the grounded spoken-word budget (Zizzo conservative range + JL max), which **replaced** an older ~130-wpm formula that let a 94-word script pass a 30s slot | `conceptAxis.ts:111-120` |
| **`Optimising Meta Video Ad Lengths`** (Downloads only) | `LENGTH_BY_AWARENESS` — the research-ideal range per stage, stored in full, then capped by `PLACEMENT_SAFE_CEILING_SECONDS = 30` because Advantage+ serves one asset across all placements. The two-cut option is config-only and parked | `conceptAxis.ts:80-105` |
| The tone report | Tone-by-warmth in the script generator — ⚠️ code flags the 3-category → 5-stage step as **INFERRED**, not stated by the report | `conceptScriptGenerator.ts:31-32` |
| **`META_AD_COMPLIANCE_REFERENCE.md`** | The most deeply wired document in the repo — the compliance axis, the copywriting rules, the ad-copy angles, the headline advisory, the tier-2 never-block rule | `_core/complianceAxis.ts:4` · `_core/copywritingRules.ts:115` · `adCopyAngles.ts:15` · `routers/adCreatives.ts:45,95,179` · `routers/compliance.ts:37` |
| `The Direct-Response Landing Page Image Guide` | LP image-slot design — cited as "Spec source" | `server/lib/images/imageSlots.ts:5` |
| `docs/landing-page-references/replication-specs/` | The 5 landing-page templates, under the §15a frozen-PNG law | `server/lib/templates/*` |

**Research banked but NOT in the build:**

- **`docs/icp-research/` R1–R4.** Its *anti-fabrication discipline* did ship (ICP grounding, the
  coach's-own-words corpus) and one report corroborates the hook map. But the **deep-ICP standard
  itself** — problem pressure, buying triggers, VOC sticky language, the five failure modes as a
  validator — is a spec, not code. Tracked as the ICP-generator enhancement pass.
- **The 15 compliance source reports.** Only the Tier-1 subset became enforcement logic, by design —
  the reference's own DO-NOT-BUILD list exists to stop the rest being built. The vocabulary and
  taxonomy reports (healthcare / neurodivergence / finance signalling) are **not** encoded as
  detectors.
- **`docs/bonus-research/` (7).** The bonus arc shipped and is live, but see gap 4 — no source
  comment in the generator ties them together.

---

## 3. THE GAPS

### 🔴 Gap 1 — the picture half has no research behind it at all

The concept generator produces **words only**: hook, headline, shortText, longText. It emits no image
brief. Arfeen's research settles that **creative = words AND picture together**, and the checkpoint's
stock-take carries "the picture half" as item 2 — but **there is no ad-image research document
anywhere in the set.** Not in the repo, not in Downloads.

What exists instead is `docs/AD_IMAGE_VISUAL_QUALITY_STANDARD.md` and the reference PNGs in
`docs/ad-references/` — an internal bar and a visual library, both written by us. The whole ad-image
track (tabloid deck, editorial, subject resolution, compositing) was built from our own iteration and
from live renders, **not from a research report**.

**This is the one gap that is about intent rather than housekeeping.** Every other research area has
a document that decided something; the picture half has none.

### 🔴 Gap 2 — the script research exists in exactly one place, and it is not the repo

Nine documents live only in `~/Downloads`, in a folder with 847 files. The code cites them by short
name with no path — *"Structure/Timing §2"*, *"Hooks §5"*, *"the tone report"*, *"the 7 NotebookLM
scriptwriting reports"*. If that folder is cleared, **every one of those citations becomes
unresolvable** and the reasoning behind the five-beat shape, the word budgets and the length caps
becomes unverifiable.

The same applies to `Meta Ads Creative Strategy 2026` — the sole source for the hook→awareness map
that `conceptAxis.ts` marks `approved: true`.

The fix is a copy into `docs/andromeda/script-research/` with a README, exactly as
`landing-page-research/` was done on 07-24. **Not done — that would be a change, and this pass is
read-only.**

### 🟡 Gap 3 — `docs/icp-research/` is on disk but was never committed

Five files, zero tracked. `conceptAxis.ts:50` cites one of them **by repo path** — a path that does
not exist for anyone who clones the repo.

### 🟡 Gap 4 — the bonus research has no code-level citation

Seven reports are banked and the bonus arc is live, but `bonusGenerator.ts` carries no source comment.
The link is asserted by the README and the handovers only. Every other research area has at least one
file:line anchor; this one does not, so "built from the research" is prose, not something traceable.

### 🟡 Gap 5 — three pieces of the build have no research backing, and the code says so

Honest self-documentation, not defects — worth knowing they are our judgement calls:

1. **The 7th hook pattern, `direct_offer_urgency`** — the brief names six. The seventh was added in
   session as the Most-Aware close, and the code flags it as the highest compliance-risk hook
   (`conceptAxis.ts:25-29`).
2. **The 3→5 tone mapping** — explicitly marked INFERRED (`conceptScriptGenerator.ts:31-32`).
3. **Concept count 8** — the brief says 5–12 scaling with spend; 8 is a chosen constant
   (`conceptAxis.ts:41-44`).

### 🟡 Gap 6 — one dangling citation

`server/whatsappSequenceGenerator.ts:206` reads *"locked role arcs from the WhatsApp wire research
report."* **No such document exists** on disk or in the repo. Either it was never banked or it was
never written down.
