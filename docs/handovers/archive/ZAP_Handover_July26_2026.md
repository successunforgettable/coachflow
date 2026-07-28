# ZAP Handover — July 26, 2026

## Headline

**✅ ANDROMEDA SPINE + RESEARCH-GROUNDED SCRIPT STANDARD SHIPPED + LIVE.** `HEAD = origin/railway-build = f9221fb`
(confirm on resume). TS **35**, **425 tests**. Two generators + three migrations live on prod, all DRAFT-only.
**NEXT SPRINT = ICP GROUNDING** — the gate; nothing shipped this session reaches a real coach until the ICP is grounded.

Full prior detail: `ZAP_Handover_July24_2026.md` (bonus arc + Andromeda build/migration narrative). This file is the
current session boundary.

## SHIPPED + LIVE this session (all on railway-build, prod-verified)

### The full Andromeda per-concept spine
- **Migrations `0093` / `0094` / `0095` — ALL applied to prod + verified via Arfeen "execute", each BEFORE its code deploy** (migration-before-code gate honored throughout; 0091/0092 precedent):
  - `0093_campaign_concepts.sql` — `campaignConcepts` table (19 cols, FKs userId→users + icpId→idealCustomerProfiles cascade, 3 idx, awareness/hookPattern/status enums). Verified EMPTY.
  - `0094_campaign_concepts_direct_offer_hook.sql` — widened `hookPattern` enum 6→7 (`direct_offer_urgency`), ALTER MODIFY append-to-end, empty table = metadata-only. Verified.
  - `0095_concept_scripts.sql` — `conceptScripts` table (16 cols, FKs userId→users + conceptId→campaignConcepts cascade, 3 idx). Verified EMPTY.
- **Concept generator** (`server/conceptGenerator.ts`, `campaignConcepts`): **"one person, many angles"** — N concepts (default 8) vary **Desire × Awareness** WITHIN one ICP (persona fixed). 5 Schwartz awareness stages × **7 hook patterns** (incl. `direct_offer_urgency`, the highest Meta-risk hook). **Approved grounded hook→awareness mapping** (`conceptAxis.ts`, `approved:true` — Arfeen's NotebookLM corpus + banked-doc corroboration on the 2 independently-matching stages; web candidate retired): Unaware→meme_humor · Problem→problem_first · Solution→aspirational_transformation · Product→social_proof · Most→direct_offer_urgency. Compliance-screened (`screenConceptCompliance`→`complianceFilter`). Lazy at the ad-copy entry (`ensureConceptsForIcp`, non-blocking).
- **Per-concept video-script generator** (`server/conceptScriptGenerator.ts`, `conceptScripts`): one script per concept → its {persona, desire, awareness, hookPattern}; concept's hookPattern drives the opening hook; cascade-fed (`getCascadeContext`) → ad↔script↔page coherence; **human-presenter output** (per-scene spokenLine/onScreenText/deliveryNote + a teleprompter view). Reuses the paused `videoScripts.ts` craft via `scriptPromptCraft.ts`; the legacy credit-render tool is untouched/unused.

### Script generator — spoken register + research-grounded standard
Two passes this session:
1. **Spoken-register baseline fix** — a regression: when `conceptScriptGenerator` was built, `scriptPromptCraft.ts` reused 5 craft blocks and DROPPED the paused generator's spoken-register standard, and the only "sounds like a person" cue was scoped to the hook only → spoken hook, written body. Restored as a positive-framed `SPOKEN_REGISTER` block scoped to EVERY scene.
2. **Research-grounded refinement** (distilled from **7 NotebookLM scriptwriting reports** — read + critiqued this session; reports live in `~/Downloads`, not in-repo). Prompt + config only, positive framing:
   - **Word budget — real code bug fixed:** the old ~130-wpm formula in `wordBudgetForSeconds` under-targeted and over-capped (30s gave max 98 → let a 94-word script pass). Replaced with the reports' grounded table: **15s 30-40/max 45; 30s 75-85/max 90; 60s 150-170/max 180.** Flows to both prompt + validator threshold; validator logic unchanged.
   - **5-beat structure WITH the new Turn beat:** Hook → Problem → **Turn** → Solution → CTA (the Turn = "here's the new way" shift, kept short; reports: no strong signal on Turn duration). Prompt-only — `sceneType` is a free JSON string, no enum/schema change.
   - **Register:** one idea per breath, fragments, contractions, active voice, conversational pivots ("Here's how"/"That's why"), read-aloud test, spell-out-numbers.
   - **Hook:** bold statement for cold (dominant-not-unanimous — 82% finding; legible opener alt; question weaker fallback); curiosity loop resolved next beat; opening <10 words.
   - **Body:** one idea per sentence, no hedging, So-What chain, story-before-statistic.
   - **CTA:** natural extension, sell the click, one step, state why.
   - **Tone by warmth** (labeled INTERNALLY as inferred, not a data-backed 1:1 map — reports say no strong 1:1 signal): Cold(Unaware/Problem)=introduce/curiosity; Warm(Solution/Product)=new-opportunity+reassurance+REAL authority; Hot(Most-Aware)=urgent/FOMO on REAL scarcity/pain.
   - **🔴 GOVERNING SAFETY RULE (overrides every tactic):** adopt structure/register/tone; strip ALL fabrication — no invented stats/%/$/guarantees/results; round ONLY real numbers (never round an invented figure into being); **never invent a contact** (link/URL/phone/email → coach's real one or `[INSERT_LINK]`); **"new opportunity / a different way" NOT "loophole/secret/hack"** (oversells AND trips the existing complianceFilter Meta-prohibited-language list — added to banned words); never name-drop unless coach-supplied; **strictest screening on the Hot/Most-Aware/direct_offer_urgency script** (highest fabrication risk). Every script stays routed through `complianceFilter`/`screenScriptCompliance`.
   - **Robustness (found in verification):** the model is stochastic on word count (75-104 for 30s) → added a per-scene word cap in the prompt + bumped the validate→retry loop **1→3 attempts**. Validator still enforces the cap; we just give it more draws than shipping an overrun.

**Verified real (clean-room, ICP 15)** each ship: 3 scripts Cold/Warm/Hot — all IN budget (86/86/41, the 94-overrun gone), Turn beat present in all, bodies spoken not just hooks, Hot script real-or-`[INSERT_*]`-placeholder only (no fabricated numbers/guarantees/contacts), no loophole/secret wording, numbers spelled out. Clean-room artifacts torn down after each run.

**Deploy chain this session:** ece1070 (concepts + 7th hook + mapping) → aaa89fb (script generator) → 7bbfd0e (spoken-register fix) → **f9221fb** (research-grounded standard). Each: Railway SUCCESS on the exact SHA, prod HTTP 200, deployed-commit == pushed SHA. Server-side → client bundle unchanged BY DESIGN (proven by SHA match).

## 🔴 STILL DRAFT-ONLY / DEFERRED (intentional — NOT missing)
- **Everything reads off a KNOWINGLY FABRICATED ICP.** Nothing reaches a real coach until the ICP grounding sprint. Both `campaignConcepts` + `conceptScripts` are EMPTY on prod until a real run fills them; nothing reaches Meta until `publishToMeta`.
- **record → upload → push-to-Meta plumbing:** SCOPE-OUT (separate pass; video upload is a different Meta endpoint needing its own live-docs verification, per §10/§12 discipline).
- **Video generation:** SCOPE-OUT (legacy Remotion/Creatomate credit-render tool untouched).
- **ICP-fabrication anti-fabrication validator:** DEFERRED — cross-checking concepts/scripts against a fabricated ICP is validation theatre; it becomes meaningful only once the ICP is grounded.

## 🎯 NEXT SPRINT = ICP GROUNDING (the gate for everything)
The ICP is the **R4 quality-multiplier + funnel front-door** — concepts, scripts, LP, ad copy, email ALL read persona/desire/pain off it. Everything shipped this session is structurally sound but rides a **confidently-fabricated** ICP (fabrication BY DESIGN — see the audit in [[project_icp_generator_enhancement_spec]]). **Approach** (from `docs/icp-research/`, R1-R4): **R2** input laddering (5-Whys to root pain, JTBD) + **inferred-vs-stated flagging**; **R3** post-generation failure-mode validator (too-broad / aspirational-seller-centric / fantasy-unflagged / demographic-hollow), mirroring `validateBonusFabricationPatterns`; deeper targeted input (one freeform → a small set of questions that ladder to root pain).

**🔴 THE ONE BANKED PRODUCT TENSION FOR ARFEEN (his call, do NOT resolve for him):** the ICP's vividness currently **comes from the fabrication** — a punchy, specific ICP is what makes the free-tool front-door hook land ("wow, this gets me"), but that specificity is invented. Grounding it without killing the hook is the real decision: over-ground → hedged/boring, kills the hook; leave fabricated → poisons the whole cascade (R4 compounds). Grounding-vs-vividness is a product/brand call. Full detail: [[project_icp_generator_enhancement_spec]].

## Resume checklist
1. Confirm `HEAD = origin/railway-build = f9221fb`, TS 35, 425 tests.
2. Clean-room is UP (local mysqld :3307 + dev :3000); the verify scripts (`server/scripts/verify-concept-generation.ts`, `verify-concept-script.ts`) drive real generations against a real ICP with the prod Anthropic key.
3. Start the ICP grounding sprint from `docs/icp-research/` + [[project_icp_generator_enhancement_spec]]; the first real decision is Arfeen's grounding-vs-vividness call.
