# ZAP × Andromeda — Execution Brief

> **STATUS: DOCUMENTATION / PARKED. Do NOT execute until Arfeen explicitly says so.**
> Source-of-truth for the ZAP × Andromeda initiative. Banked 2026-07-23. The executing assistant reads this
> (and re-verifies every Meta API field against live docs) when the initiative starts — not before.

**For: the ZAP executing assistant. Purpose: adopt an "Andromeda-compliant" copy/creative standard in ZAP and add a video-script generator, grounded in what Claude Code (CC) has already verified against the real ZAP codebase and Meta's live developer docs.**

This is a planning brief, not a work order. It is deliberately structured so the first step is a CC feasibility pass you already have the results of (summarised in §7), then a sequenced build. Give CC goals and standards, not implementations — let CC propose from the real code, as always.

---

## 1. The one-paragraph thesis

Meta's ad system ("Andromeda," fully rolled out ~Oct 2025) no longer targets by audience settings — it reads the ad's creative and copy semantically and decides who to show it to. **Creative is the targeting.** If Meta can't categorise your ad, it never enters the auction, regardless of budget. Andromeda rewards two things above all: **genuine conceptual diversity across creatives**, and **ad-to-landing-page message match**. ZAP is unusually well-positioned to deliver both — it already generates ad copy, creative, and the landing page from one coherent cascade, and it already has the Meta integration, the insights pipeline, and a generate→validate→retry system. So this is an **upgrade to existing systems, not a rebuild**, and it repositions ZAP as "AI that builds ads engineered for how Meta actually works in 2026."

---

## 2. What is CONFIRMED and buildable (the standard)

The ad-facing copy standard, from cross-confirmed research (evidence-rated where it matters):

- **Generate 8–12 conceptually DISTINCT concepts per campaign** — not variations of one ad. Meta collapses near-identical creatives under one "Entity ID" (one auction ticket); genuine diversity earns separate tickets. Differentiate via the **P.D.A. framework**: Persona (who), Desire (core motivation), Awareness (funnel stage). *(Sources cluster at 5–12; build to a range, not false precision. Scale with spend where sensible.)*
- **Hooks lead by naming the audience explicitly** and use high-intent nouns — this is the signal Andromeda uses to categorise the ad fast. Six named hook patterns exist and each maps to an awareness stage: Problem-First, Founder/Authenticity, Social-Proof, Aspirational/Transformation, Meme/Humor, Data/Chart.
- **The headline must carry a DIFFERENT signal from the hook** (mechanism or outcome), never a repeat. Repeating the hook in the headline wastes a categorisation signal.
- **Primary text in both short and long-form** — short feeds the ranking model, long-form feeds Meta's sequence-learning.
- **A refresh is a NEW concept, not a tweak** — fatigue windows have compressed to ~2–3 weeks; the next distinct concept should be pre-drafted.

For **video scripts** (the new generator): a named hook pattern + a P.D.A. concept + multiple awareness-level versions + an aligned audio/visual/on-screen-text spec + pattern-interrupt pacing.

For the **landing page**: it must semantically match the ad's persona/awareness stage — which ZAP can do by construction, since ad and page come from one cascade. This is ZAP's competitive edge.

---

## 3. What is OUT of scope

- **Email, WhatsApp, and all post-conversion nurture.** Meta's retrieval system does not read these — confirmed. Adopting "Andromeda-compliance" here would be effort with zero mechanical payoff. Leave these nodes untouched.
- **Account-structure / media-buying advice** (campaign consolidation, CAPI setup, budget) — this is the coach's job to run their account, not something ZAP's copy output controls. ZAP can *inform*, not own it.

---

## 4. Folklore to IGNORE (flagged as unconfirmed in the research)

Do NOT build to these — they are practitioner speculation, explicitly unconfirmed:
- The "125–150 word intent scan" theory (that Andromeda only reads the first ~125 words).
- Emoji "hacks" to bypass filters.
- Keyword density / repetition tricks.

Build to semantic *meaning and diversity*, not to these mechanical superstitions.

---

## 5. THE CRITICAL CORRECTION — the research got the measurement fields wrong

The research (practitioner blogs) claimed Meta exposes queryable API fields called `creative_diversity_score`, `creative_similarity_score`, and `creative_fatigue`. **CC verified against Meta's live docs: these fields DO NOT EXIST.** "Creative diversity" and "creative fatigue" are Meta *strategy concepts* and *Ads Manager recommendation surfaces*, not single queryable numbers. Do not build against them.

**What IS real and queryable** (build on these instead):
- `frequency`, `reach`, `impressions`
- `first_time_impression_ratio` (real, API-queryable — the key fatigue leading-indicator)
- CTR / conversion signals bucketed by frequency
- `effective_object_story_id` — a practitioner-proposed method to detect duplicate ads: flag when multiple distinct Ad IDs share the same underlying Post ID (i.e. "clones wearing different hats"). **CC must verify each such field against Meta's live docs before building** — the same discipline that caught the fake "score" fields. Some fields in the practitioner "lookalike-detection" recipe may not exist; use only the ones that check out.

**So:** ZAP can't read a native "similarity score." It CAN approximate diversity/fatigue from real fields it already has access to, and derive the same signal. This keeps the loop buildable — just built on real data, not a magic number.

Also: the "Meta MCP server" exists as a tool surface but ZAP's production server should NOT depend on a Claude-side MCP — ZAP uses its own Graph API integration, which it already has. The MCP was a red herring; ZAP doesn't need it.

---

## 6. Enforcement architecture — validator-time, weighted

CC's recommendation from the real code: **do both, weighted to a validator + retry.**
- Put **creative quality** (voice, specificity, hook punch — things regex can't judge) in the **generation prompts**.
- Put the **structural rulebook** (hook names the audience · headline ≠ hook · the 8–12 concepts are persona/awareness-distinct · short + long-form both present) in a **post-generation validator with retry**, mirroring ZAP's existing `validateOfferFabricationPatterns` (generate → validate → retry-with-fail-context). This is deterministic, unit-testable, and the pattern ZAP already uses — lowest-friction, hardest to regress.

---

## 7. What CC already verified in the REAL codebase (feasibility read, 2026-07-23)

**ZAP is more built for this than the research assumed:**
- Ad generators live in `server/adCopyGenerator.ts` (+ `adCopyAngles.ts`), `server/headlinesGenerator.ts`, `server/adCreativesGenerator.ts` — mature prompt infra (few-shot, scoring engine, banned-pattern lists, compliance rewrites). Today: generates N *variations* (lite 3 / default 15 / power 30) via a fixed angle set + PAS; flat schema (headlines array, bodies per angle). Moving to 8–12 P.D.A. *concepts* = a structural schema change + prompt rewrite (Medium).
- **ZAP already reads Meta insights** (`getCampaigns(includeInsights)` → ctr/cpc/spend/impressions, with an alerts system).
- **ZAP already writes creative to Meta** (`createCampaign`/`createAdSet`/`createAdCreative`/`createAd` in `server/lib/metaAPI.ts`). Write-back exists.
- **Scopes already granted:** `ads_management`, `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`. Business app + Business Verification + app review — that hurdle is already met. (ZAP is on Graph API v21.0; v25.0 is a trivial version bump.)
- **A paused video-script generator already exists** (`server/routers/videoScripts.ts`) with hook rules, angle selection, few-shot, compliance, a `videoScripts` table and job pipeline — the new video-ad-script generator EXTENDS this, not net-new.
- **Ad and landing page already share one context** (`cascadeContext.ts` feeds both the same `UPSTREAM CONTEXT — SELECTED ASSETS` block) — so message-match is largely free; the gap is that persona/awareness isn't an axis yet.
- **A mature validator system already exists** (`server/_core/validator.ts` 78KB, `copywritingRules.ts` with `scoreAdContent`/`BANNED_HEADLINE_PATTERNS`, `complianceFilter.ts`) — the generate→validate→retry pattern is already in use (`validateOfferFabricationPatterns`).

---

## 8. The buildable sequence (CC's value-to-effort ranking)

Build in this order — each piece makes the next cheaper. **The P.D.A. concept axis is the backbone; the rest gets cheap after it.**

1. **Read the real fatigue/diversity signals** (`frequency`, `first_time_impression_ratio`, duplicate-post detection via `effective_object_story_id` — fields CC-verified) onto ZAP's existing insights pipeline. **Small.** Best value/effort, no new plumbing. *(This is the "reading" half — informing the coach, not auto-acting.)*
2. **Build the P.D.A. concept axis + validator.** Reframe ad copy from "angles → variations" to "8–12 concepts, each a record {persona, desire, awareness, hook, headline, shortText, longText}," enforced by a validator + retry. **Medium — this is the structural core of Andromeda-fit.** Ripples to the concept-picker UI and image gen (medium-large sub-piece: images following concepts).
3. **Landing-page message-match.** Thread the selected concept's persona/awareness into the LP prompt. **Small–medium once P.D.A. exists — nearly free, high leverage.** Real design question: one LP vs. many concepts — matching per-concept means awareness-variant LPs.
4. **Video-script generator.** Extend the paused `videoScripts.ts` + wire in full cascade context (LP + ICP + selected nodes). **Medium.** The Remotion render (script → actual video) is a separate, heavy, out-of-scope piece.
5. **Full closed write-back loop** (read fatigue → decide → regenerate → push new creative to Meta). **Large, and LAST.** This is the "ZAP Intelligence" tier. Carries real autonomy risk — auto-pushing creative and spending a coach's money. **Must be gated behind explicit per-action coach approval — no silent auto-refresh.** Consistent with ZAP's existing prod-write-gate philosophy.

---

## 9. Sequencing around the live work (CC's flag)

- The ad-copy restructure (piece 2) touches `adCopyGenerator.ts`, which is **currently carrying live in-flight work** (the A7 location-lock). **No hard conflict, but sequence the Andromeda copy-restructure AFTER the current fixes ship** so the two efforts don't collide.
- It also interacts with the already-logged "ad-images-after-ad-copy" ordering — sequence accordingly.
- The bonus/offer/lead-magnet path work is fully independent — no interaction.

---

## 10. Honest boundaries (so nobody builds false precision)

- Build to **ranges** (5–12 concepts, ~2–3 week refresh), not exact thresholds — Meta doesn't publish them and they may vary by spend/vertical.
- The specific numeric "<40% similarity" rule depends on a score ZAP can't read natively — approximate it via real signals, don't promise a "40% checker."
- Some research came from practitioner sources; **CC verifies every API field against Meta's live docs before building** — the discipline that already caught the fake score fields.
- Auto-write to a coach's live account is per-action-approval-gated. No autonomous spend.

---

## 11. First action for the executing assistant

Do NOT start building. First, confirm the current in-flight work has shipped and the tree is clean. Then have CC do an investigate-and-propose pass on **piece 1 (read the real signals)** and **piece 2 (the P.D.A. concept axis + validator)** — the backbone — proposing the exact schema, prompt, and validator shape from the real code, for review before any build. Everything downstream (LP match, video scripts, the write-back loop) sequences after the backbone exists.

**The strategic headline to hold onto:** ZAP already does the two hardest things Andromeda rewards — conceptual diversity (via the concept engine, once built) and ad-to-page match (by construction). Building this makes every ZAP campaign perform better on Meta automatically, and it's a genuine repositioning, not just a feature.
