# Ad-script + creative-strategy research — NotebookLM reports (banked 2026-08-03)

Nine reports covering **what an ad should say** — which angle suits which audience stage, how a
spoken video script is built, and how long it should run. Banked here because until today they
existed **only in `~/Downloads`**, while the code cited them by short name with no resolvable path.
Copied verbatim from Arfeen's Downloads; small markdown, plain git (the git-lfs rule is PNG-only),
mirroring `../landing-page-research/`.

**Do NOT execute anything from these — they are reference material.** They are the *source* behind
decisions already made; the decisions themselves live in `../EXECUTION_BRIEF.md` and in the code
constants cited below.

## The strategy report — the single most load-bearing source in the Andromeda build

1. `Meta Ads Creative Strategy 2026_ Mapping Hook Patterns to Schwartz Awareness Stages.md`
   The hook→awareness mapping. **This is the sole source for `CANDIDATE_HOOK_AWARENESS_MAP` in
   `server/_core/conceptAxis.ts`**, which is marked `approved: true`. Its §2–§6 give the per-stage
   primary/secondary hooks the code implements verbatim:
   Unaware → Meme/Humor + Data/Chart · Problem-Aware → Problem-First + Founder/Authenticity ·
   Solution-Aware → Aspirational/Transformation + Founder/Authenticity · Product-Aware → Social-Proof
   + Data/Chart · Most-Aware → §6 states the six patterns are ineffective here because these users
   are "waiting for the right timing or deal" — **which is the grounding for the 7th hook pattern,
   `direct_offer_urgency`.** ⚠️ The code comment at `conceptAxis.ts:25` describes that 7th pattern as
   "added this session"; on the evidence of §6 it is research-derived, not invented. Comment only —
   no logic depends on the distinction.

## The length report

2. `Strategic Report_ Optimising Meta Video Ad Lengths for the 2026 AI Ecosystem.md`
   Source for `LENGTH_BY_AWARENESS` and `PLACEMENT_SAFE_CEILING_SECONDS` (`conceptAxis.ts`).

## The seven scriptwriting reports

Cited collectively in code as "the 7 NotebookLM scriptwriting reports". Section references in
`server/_core/scriptPromptCraft.ts` and the `WORD_BUDGET_TABLE` in `conceptAxis.ts` resolve here.

3. `Comprehensive Report on Video Ad Script Structure and Timing Metrics.md` — §2 five-beat shape
   (Hook → Problem → Turn → Solution → CTA)
4. `Analysis of High-Performance Video Ad Hooks for Cold Audiences.md` — §5 intro under ~10 words, bold
5. `Scripting the _Messy Middle__ Maintaining Attention in Talking-to-Camera Video Ads.md` — §1 one idea per beat
6. `Scripting for Success_ Analytical Report on Natural Video Ad Performance.md` — §5 story before statistic
7. `Analysis of Conversational Calls-to-Action in Video Advertising.md` — §1 CTA as natural extension;
   also the contact-detail fabrication rule in `SCRIPT_SAFETY`
8. `Analytical Report_ Calibrating Spoken Tone for Video Ad Performance.md` — tone by audience warmth.
   ⚠️ The report defines **three** categories (cold/warm/hot); the code maps them onto **five**
   Schwartz stages and flags that step as INFERRED at `conceptScriptGenerator.ts:31-32`.
9. `Technical Report_ Synthesizing Natural Speech Patterns for Talking-to-Camera Ad Scripts.md` —
   making written lines sound spoken

## What these reports do NOT cover

**Nothing here decides the picture.** All nine are about words. There is no ad-image research
document in this set or anywhere else in the repo — see
`../../handovers/ANDROMEDA_MAP_PLAIN_2026-08-03.md`.
