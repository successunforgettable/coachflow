# PRO CAPS AND CAMPAIGN COST — investigation, 2026-09-27

**Status: investigation and recommendation only. Nothing built, nothing committed, zero production writes.**
Production reads: SELECT only, inside `START TRANSACTION READ ONLY`, after asserting
`@@version_comment = 'MySQL Community Server - GPL'` and `@@transaction_read_only = 1` (guard printed on every run).
Scripts: `scratchpad/proCaps/{ro,cols,sizes,who,usage}.mjs`, cost model `cost.py`, caps model `caps.py`.

**Every figure below is labelled MEASURED or ESTIMATED.** No per-call token usage is recorded anywhere this
investigation could reach (see §2.1), so the per-campaign cost is an estimate built from measured output sizes,
two measured token pairs, the code's call structure, and published prices.

---

## 0. THE ANSWER IN FIVE LINES

1. **No Pro monthly limit has ever been decided by Arfeen.** The numbers in `quotaLimits.ts` (Pro 50 / ad copy 100)
   were set by an engineering commit (`e8860cc`, 2026-03-24). Arfeen's only ruling (2026-09-24) is that *the table is
   the single source of truth* — not what the numbers are. "Pro caps" is open decision #1 in the current checkpoint.
2. **Pro price is $147/month** ($1,470/year) — stated in code as "Confirmed pricing (March 2026)"; agency ("ZAP Pro
   Plus") $497/month.
3. **One full campaign costs about $1.84 in AI fees typically (ESTIMATED), $1.72 low, $4.68 high with every retry
   loop exhausted.** Add ~$0.29 when landing-page compliance rewrites run on Opus (wizard path only) and ~$0.46 for
   the Andromeda video-script batch. Worst realistic single campaign ≈ **$5.40**.
4. **The current table, fully used, can lose money**: ~$102/month typical, ~$242/month high-retry, before ad images
   (which have no Pro cap at all) — against $142 net of Stripe fees.
5. **Recommended Pro caps** (per month): ICP 10 · offers 20 · method 20 · lead-magnet titles 20 · headlines 30 ·
   ad copy 30 · landing pages 15 · email 15 · WhatsApp 15 — plus two limits that have no counter today: ad-image
   batches 30, concept sets 10. A busy coach (defined §4.1) uses ~40% of each; fully maxed they cost ~$39 typical /
   ~$89 worst case, leaving ≥ 36% gross margin in the worst case.

---

## 1. QUESTION 1 — HAS ARFEEN DECIDED PRO MONTHLY LIMITS?

### 1.1 Every place a Pro limit or the Pro price is stated

| # | where | figures | Arfeen decision or engineering default? |
|---|---|---|---|
| 1 | `server/stripe/products.ts:4-8, 20-23` | **Pro $147/mo, $1,470/yr; Pro Plus $497/mo, $4,970/yr** | Header says *"Confirmed pricing (March 2026)"*; set by `b41bb90` ("Stripe pricing fix complete … all four live price IDs validated against Stripe API"). Reads as an owner-confirmed price; no verbatim Arfeen quote found |
| 2 | `server/stripe/products.ts:24-31` (Pro features) | "3 ICP Profiles", **"50–100 generations per tool"**, "10 video credits per month" | Marketing copy (`5cadef1`, Manus-era checkpoint). No owner wording |
| 3 | `client/src/pages/Pricing.tsx:26-34, 48-49` (live at `/pricing`) | Pro: "3 ICP Profiles", **"50–100 generations per tool"**, "10 video credits per month"; Free: "3 generations per tool on nodes 3–5", "1 ICP Profile"; Plus: "Unlimited Generations" | Same marketing copy (2026-03-08 rewrite). **Does not say "per month"** |
| 4 | `server/quotaLimits.ts:33-43` (identical on prod `87596d7` and held HEAD — `git diff 87596d7 HEAD -- server/quotaLimits.ts` is empty) | **Pro: headlines 50, hvco 50, heroMechanisms 50, icp 50, adCopy 100, email 50, whatsapp 50, landingPages 50, offers 50.** Agency 999 (= unlimited sentinel). Trial: headlines/hvco/mechanisms ∞, icp 2, adCopy 5, email 2, whatsapp 2, LP 2, offers 2 | **Engineering default.** `e8860cc` (2026-03-24, Claude-authored): *"fix: raise pro tier quota limits to production values — headlines/hvco/mechanisms from 3-6 to 50"*. No Arfeen wording in the commit |
| 5 | `5abe5f7` (2026-02-18) → `docs/E2E_TESTING_GUIDE.md:91-101` | "Kong-Verified Pro Limits": headlines 6, HVCO 3, hero 4, ICP 50, ad copy 100, email 20, WhatsApp 20, LP 10, offers 10 | Copied from a competitor ("Kong parity"), superseded by #4. Engineering |
| 6 | `server/routers/headlines.ts:144, 188` on **production 87596d7** | Pro headlines **6** (sync route) / **20** (async route); agency 20 / 50; trial 6 | Hardcoded engineering values, contradict #4 |
| 7 | `server/routers/landingPages.ts:506, 608` on **production** | `{ trial: 2, pro: 50, agency: 500 }` | Engineering duplicate table; removed on held (`7f624fc`) |
| 8 | `docs/handovers/TRIAL_PAYWALL_OPTION_B_PROPOSAL_2026-09-24.md` §4 D5, §7 | D5: *"Pro users are never counted or gated by the new Trail quota logic"* (Arfeen, as quoted in `8881b69`); §7: *"The limits table in `server/quotaLimits.ts` is the single source of truth (Arfeen's ruling, 2026-09-24)"* | **Arfeen rulings — but on mechanism, not on numbers.** He ruled which table governs, never what Pro's numbers should be |
| 9 | `docs/handovers/CHECKPOINT_2026-09-24_TRIAL_QUOTA_GHL_DEPLOY_PLAN.md:103-104` and `COMPLETION_AND_FIRST_DEPLOY_PROPOSAL_2026-09-24.md:79, 87, 185` | "1. **Pro caps** — Pro headlines to 50 and Pro's other caps enforced from the table. [yes]" — *"The bracketed text is the recommendation from the requester — not approvals."* | **Explicitly OPEN.** The trial/quota deploy group is held on it |
| 10 | `server/routers/videoCredits.ts:13-14` | "Margins: 63-79% based on $0.37/video cost" | Engineering note (video is credit-metered, separate) |
| 11 | CLAUDE.md, MEMORY.md and the memory directory | no Pro limit or Pro price stated | — |

### 1.2 Contradictions

- **"3 ICP Profiles" (pricing page + products.ts) vs `icp: 50` (table).** The page promises a profile count; the table
  meters monthly generations. They measure different things and neither enforces the other.
- **"50–100 generations per tool" does not say "per month"**; the code resets monthly on the signup anniversary
  (`server/quotaReset.ts:2-5`).
- **Production enforces Pro headlines at 6 or 20** (whichever route), while the table and the page say 50.
- **Trial length:** `products.ts:57` `TRIAL_DAYS = 7` and the pricing page's "7-Day Free Trial" button vs
  `nativeAuth.ts:91` / `customAuth.ts:86` granting **14** days.
- **Pricing-page "Free" plan** ("3 generations per tool on nodes 3–5") matches neither the trial table nor option (b).
- **Pro Plus "Unlimited Generations"** vs the landing-page router's `agency: 500` on production.

### 1.3 What production enforces for Pro TODAY (`87596d7`)

| counter | Pro enforcement on production | why |
|---|---|---|
| headlines | **6** (sync `generate`) / **20** (`generateAsync`) per month | hardcoded in `headlines.ts:144, 188`; counter moves (`db.ts:175`) |
| hvco, heroMechanisms | **50** per month | table; counters move (`db.ts:275, 375`) |
| landingPages | **50** per month | router table; counter moves (`landingPageGenerator.ts:1354`) |
| offers, adCopy, icp, email, whatsapp | **effectively unlimited** | checked against 50/100 but **the counters are never incremented** (proposal §1a; prod read 2026-09-27: all three users show 0 on all five while holding rows) |
| ad images | **unlimited** | trial-only gate |
| Trail / Auto Mode (`autoMode.orchestrate*`) | **unlimited** | no quota check on the orchestration path |

Measured 2026-09-27 (prod, read-only): user 1 counters m7/hv7/h6/lp6; user 117174 m12/hv14/h18/lp22; every
offer/adCopy/icp/email/whatsapp counter = 0.

### 1.4 What the held branch (`docs/held-2026-09-12`) would enforce for Pro

- `quotaLimits.ts` unchanged (the 50/100 table). `lib/quotaEnforcement.ts` `enforceQuota`: monthly reset first, then
  every tier against the table; `>= 999` or `Infinity` = unlimited.
- The 8 per-node routers + landing pages call `enforceQuota` for **every tier** → **Pro capped at 50 on headlines,
  hvco, mechanisms, ICP, offers, email, WhatsApp, landing pages; 100 on ad copy.**
- Counting: **every tier** — `countUsage` in the offer/adCopy/email/whatsapp cores (`offersGenerator.ts:620`,
  `adCopyGenerator.ts:1761`, `emailSequenceGenerator.ts:1160`, `whatsappSequenceGenerator.ts:1014`), ICP in the router,
  `db.ts` for headline/hvco/mechanism, `landingPageGenerator.ts:1354` for LPs.
- ⚠️ **Trail / Auto Mode for Pro is still never refused** (`autoMode.ts:254-257` — the check runs only when
  `!isAutoModeTierAllowed`), **but the cores still count.** So a Pro coach's cascade runs uncapped while it fills the
  counters; the refusal then lands on the per-node routes (wizard, "Show me more", regenerate). A cap that should bound
  cost has to be checked on the orchestration path too, or it bounds only the regenerations.
- Ad images for Pro: still unlimited (`enforceTrialAdImageBatchLimit` exempts every non-trial tier).
- Concepts, concept scripts, bonuses, lead-magnet body: no counter for any tier.

---

## 2. QUESTION 2 — WHAT ONE FULL CAMPAIGN COSTS

### 2.1 Recorded usage — what exists and what does not

- **No DB table or column records tokens or cost.** Schema grep for token/usage/cost: only `usageResetAt`, the
  per-user counters, `phrase_usage_stats` (banned-phrase hits), `storage_usage_bytes`.
- **Every Claude call logs usage on production**: `_core/llm.ts:594-600` prints
  `[LLM][model] … stop_reason=… in=<input_tokens> out=<output_tokens>` (present in `87596d7`). **But none are
  retrievable:** a scan of all 100 Railway deployments back to 2026-07-27 (`railway logs <id> --filter "stop_reason"`
  and `"responded"`) returned **zero lines**; raw pulls show only boot/Meta-daily-job lines. Either retention is
  short or there has been no production generation since the log line shipped (2026-08-31); the latest kit is 2026-08-30.
  §15-PARENT: the zero is not evidence of zero spend — it is an instrument that cannot see.
- **The only measured token pairs** (from local dry runs of the concept generator, kit 187):
  `CAPTURE_KIT187_CONCEPT_DRY_RUN_2026-09-15.md:63` `in=4427 out=8192 (max_tokens)`;
  `CAPTURE2_…:16-17` `in=4427 out=7163`, retry `in=4968 out=8192`.
- The 2026-07-24 credit-exhaustion incident records no spend figures.

### 2.2 Models and limits (from code)

- `_core/llm.ts:378-382`: every call asks **`claude-sonnet-4-6`** first; fallback ladder `claude-haiku-4-5-20251001`,
  `claude-3-haiku-20240307` (only on 404/500). **`max_tokens` is hard-coded 8192 at `llm.ts:428`** — the
  `maxTokens: 4000 / 2000` passed by the concept and script generators are ignored (the measured `out=8192` proves it).
- **`claude-opus-4-7`** only for compliance rewrites of landing-page **body** sections
  (`routers/landingPages.ts:200`, `routers/complianceRewrites.ts:602`). The post-generate precompute runs from the
  landing-page router routes only, not from the orchestration core — i.e. wizard/regenerate, not the Trail cascade.
- `claude-haiku-4-5-20251001` explicitly at `routers/autoMode.ts:893` (a small intake helper).
- Forge/`gemini-2.5-flash` only when no Anthropic key is set (not production).

### 2.3 Prices used (published, fetched 2026-09-27)

| item | price | source |
|---|---|---|
| claude-sonnet-4-6 | $3 in / $15 out per MTok | platform.claude.com/docs/en/about-claude/pricing |
| claude-opus-4-7 | $5 in / $25 out per MTok; its tokenizer yields ~30% more tokens for the same text | same |
| claude-haiku-4-5 | $1 / $5 per MTok | same |
| flux-1.1-pro (Replicate) | $0.04 per image | replicate.com/blog/flux-1-1-pro-is-here |
| flux-2-pro (Replicate, editorial style only) | $0.015 + $0.015 per input/output megapixel | replicate.com/blog/run-flux-2-on-replicate |
| gpt-image-1, medium | $0.042 (1024×1024), **$0.063 (1024×1536)** | OpenAI pricing (via langcopilot.com/gpt-image-1-pricing; OpenAI's own page defers to its calculator) |

Tool-use calls add ~589 system-prompt tokens per Sonnet 4.6 forced-tool call (folded into the input estimates).

### 2.4 Call structure per node (from code) and MEASURED output sizes (production)

Output sizes: production rows, 8 complete campaign groups surviving (kits 187, 188, 190, 191, 192, 200, 225 + one),
content columns only (ids, timestamps, scores, URLs excluded), chars ÷ 4 ≈ tokens. Stored rows include some copied
input fields, so these **overstate** output slightly — the safe direction.

| node | model | LLM calls per generation (typical) | retry loop | measured output (median per generation) |
|---|---|---|---|---|
| Service intake | Sonnet | 1–2 (`services.extractFromText` / `expandProfile`) | — | not measured (est. 1.5k tok) |
| ICP (Dream Buyer) | Sonnet | 2 (`_core/icpGenerate.ts` + `icpEnrichment.ts`) | icpGenerate ×3 max | 35,577 chars ≈ 8.9k tok |
| Offer | Sonnet | 3 in parallel (godfather / free / dollar, `offersGenerator.ts:405`) | ×3 each (`:12`) | 6,286 chars ≈ 1.6k tok |
| Unique Method | Sonnet | 3 (hero mechanisms, headline ideas, beast mode) + optional repair | repair only | 18,056 chars, 15 rows ≈ 4.5k tok |
| Lead-magnet titles | Sonnet | 4 (long, short, beast mode, subheadlines — tabs confirmed 5/5/30/20) | — | 6,903 chars, 60 rows ≈ 1.7k tok |
| Lead-magnet body (PDF) | Sonnet | 1 (`leadMagnetContentGenerator.ts:930`), selected magnet only | ×3 | 17,284 chars ≈ 4.3k tok (1 row) |
| Headlines | Sonnet | 5 in parallel (one per formula) + compliance rewrite of flagged rows | none | 2,508 chars, 10 rows |
| Ad copy | Sonnet | ~6 (headlines, 3 bodies, links, image hook) + distinctness redrafts + compliance regen | regen ×3 per flagged row | bodies ≈ 2.8k chars + heads/links; stored 12.3k |
| Andromeda concepts | Sonnet | 1 per ICP (triggered from ad copy / kit) | ×3 (`conceptGenerator.ts:350`) | **MEASURED tokens: in 4,427 / out 7,163–8,192** |
| Landing page | Sonnet | 4 in parallel (original + 3 angles, `landingPageGenerator.ts:942`) | ×3 each (`:32`) | 70,092 chars ≈ 17.5k tok (≈ 4.4k per angle) |
| LP compliance rewrites | **Opus 4.7** body / Sonnet heads | up to 12 sections (8 body on Opus) on the active angle, score < 100 | — | 0 rows left on prod to measure |
| Bonuses | Sonnet | 1 set call (3 bonuses) + 3 body calls (`bonusPdfGenerator.ts:55`) | ×3 set | set 42,989 chars; each body ≈ 15k chars ≈ 3.7k tok |
| Email sequence | Sonnet | 1 | ×3 (`:696`) | 4,379 chars ≈ 1.1k tok |
| WhatsApp sequence | Sonnet | 1 | ×3 (`:636`) | 3,756 chars ≈ 0.95k tok |
| Ad images | Sonnet + images | 1 LLM (ad headlines) + **4 images: 3 × flux-1.1-pro (person slots) + 1 × gpt-image-1 medium 1024×1536 (screenshot slot)** (`_core/adVariations.ts:67-71`, `imageGeneration.ts:82-90`) | headlines ×5 (`adCreativesGenerator.ts:104`) | 4 rows per batch since 2026-08-01 (5 before) |
| Concept video scripts (optional) | Sonnet | 1 per concept (8 in the stored set) | ×3; **measured 2026-09-24: 7/24 first-pass, 22/24 produced** → ~2.3 attempts avg | 21,086 chars / 8 ≈ 0.66k tok each |
| Push (Meta / GHL) | none | no model call | — | — |

**Input tokens are ESTIMATED.** Calibration: the concept prompt's own literal text is ~720 tokens, yet it measured
4,427 input — so ~3.7k comes from shared rule blocks, cascade context and the tool schema. Each node's input = its
own prompt literals (measured from the source, `cost.py` notes) + ~4–5k shared/context; landing pages ~9k per angle.

### 2.5 Cost per node and per campaign (ESTIMATED; working in `scratchpad/proCaps/cost.py`)

Low = one pass everywhere, no lead-magnet body. Typical = one pass, lead-magnet body included, a couple of compliance
rewrites. High = every validator loop runs to its maximum (3 attempts; ad-image headlines 5), ad images twice.

| node | low | typical | high |
|---|---|---|---|
| Service intake | $0.021 | $0.040 | $0.040 |
| ICP (generate + enrich) | $0.156 | $0.156 | $0.316 |
| Offer (3 angles) | $0.074 | $0.074 | $0.234 |
| Unique Method (3 calls) | $0.113 | $0.113 | $0.156 |
| Lead-magnet titles (4 calls) | $0.085 | $0.085 | $0.085 |
| Lead-magnet body | $0.000 | $0.083 | $0.252 |
| Headlines (5 formulas) | $0.105 | $0.105 | $0.105 |
| Ad copy (~6 calls) | $0.140 | $0.140 | $0.356 |
| Andromeda concepts (1 per ICP) | $0.121 | $0.121 | $0.413 |
| **Landing page (4 angles)** | **$0.370** | **$0.370** | **$1.129** |
| **Bonuses (set + 3 bodies)** | $0.254 | $0.254 | $0.778 |
| Email | $0.041 | $0.041 | $0.126 |
| WhatsApp | $0.037 | $0.037 | $0.115 |
| Ad-image headlines (LLM) | $0.022 | $0.022 | $0.120 |
| Compliance rewrites, headlines + ad copy | $0.000 | $0.021 | $0.084 |
| Ad images (3 Flux + 1 gpt-image-1) | $0.183 | $0.183 | $0.366 |
| **FULL CAMPAIGN (core)** | **$1.72** | **$1.84** | **$4.68** |
| + LP compliance rewrites on Opus (wizard path) | | +$0.29 | |
| + concept video scripts (8 × 2.3 attempts) | | +$0.46 | |

Typical campaign ≈ **40 model calls, ~228k input and ~65k output tokens**; high ≈ 92 calls, ~566k in / ~174k out.
Output is ~57% of the typical bill, so the measured output sizes carry most of the weight; if every input estimate
were double, typical rises by $0.68 to ~$2.50.

**Excluded:** Video Creator (credit-metered — 10 credits/month on Pro; the code's own note says ~$0.37 per video);
Cloudinary (plan-based storage/bandwidth; a campaign stores ~4–8 images + 2–5 PDFs — not per-campaign material at
this scale); Replicate flux-2-pro "editorial" style (not used by any stored batch — all 7 are `tabloid`); 9:16
vertical variants (on demand, +$0.04 each).

### 2.6 A regeneration costs its node again

"Show me new options" / regenerate re-runs a node's full generation: a landing-page regen ≈ $0.37 (+$0.25 bonuses
when the LP step reruns in the cascade, +$0.29 Opus rewrites on the router path), ad copy ≈ $0.15, headlines ≈
$0.11, an ad-image batch ≈ $0.21. **Landing pages dominate everything** — about 50% of a campaign with bonuses and
rewrites.

---

## 3. WHAT THE CURRENT TABLE COSTS IF A PRO COACH USES IT

Per-generation cost per counter (typical / high), bundling what each counter triggers — LP includes bonuses and Opus
rewrites; hvco includes the lead-magnet body; ad copy includes its compliance regen:

| counter | typical | high |
|---|---|---|
| icp | $0.156 | $0.316 |
| offers | $0.074 | $0.234 |
| heroMechanisms | $0.113 | $0.156 |
| hvco | $0.168 | $0.337 |
| headlines | $0.115 | $0.147 |
| adCopy | $0.150 | $0.398 |
| landingPages | $0.912 | $2.195 |
| email | $0.041 | $0.126 |
| whatsapp | $0.037 | $0.115 |
| ad-image batch (no counter) | $0.205 | $0.486 |
| concept set (no counter) | $0.121 | $0.413 |

**Held table fully maxed (50 each, ad copy 100, images uncapped, concepts at 50): ~$102/month typical, ~$242/month
high** against **$142.44** net of Stripe (2.9% + $0.30). The high case loses ~$99/month per maxed account — and ad
images and the Trail/Auto Mode path are uncapped on top of that.

---

## 4. RECOMMENDED PRO CAPS

### 4.1 "Normal busy coach", defined

**Four new campaigns a month (one a week), each on a fresh or re-angled ICP, plus about one regeneration of every
second node and two extra ad-image batches per campaign.** Monthly generations:

ICP 6 · offers 8 · method 6 · lead-magnet titles 8 · headlines 12 · ad copy 12 · landing pages 6 · email 5 ·
WhatsApp 5 · ad-image batches 10 · concept sets 6.

Cost: **~$15/month typical, ~$36 high-retry** → 86% / 73% gross margin at $147.

For reference, the heaviest real account on production (the smoke coach, a test machine) reached LP 22, headlines 18,
hvco 14, mechanisms 12 inside one reset window.

### 4.2 The proposal — about 2.5–3× the busy coach, each mapped to a counter

| counter (held `quotaLimits.ts` / `getQuotaCountField`) | users column | busy coach | **proposed Pro cap / month** | current table |
|---|---|---|---|---|
| `icp` | `icpGeneratedCount` | 6 | **10** | 50 |
| `offers` | `offerGeneratedCount` | 8 | **20** | 50 |
| `heroMechanisms` | `heroMechanismGeneratedCount` | 6 | **20** | 50 |
| `hvco` | `hvcoGeneratedCount` | 8 | **20** | 50 |
| `headlines` | `headlineGeneratedCount` | 12 | **30** | 50 |
| `adCopy` | `adCopyGeneratedCount` | 12 | **30** | 100 |
| `landingPages` | `landingPageGeneratedCount` | 6 | **15** | 50 |
| `email` | `emailSeqGeneratedCount` | 5 | **15** | 50 |
| `whatsapp` | `whatsappSeqGeneratedCount` | 5 | **15** | 50 |
| *ad-image batches* — **no counter exists** | — (would need one, or a `COUNT(DISTINCT batchId)` since the reset, as the trial gate already does) | 10 | **30** | uncapped |
| *concept sets* — **no counter exists** | — | 6 | **10** | uncapped |

**Margin at the proposed caps, every one maxed:** ~$39/month typical (**70% margin**), ~$89/month worst case
(**36% margin**). No realistic account maxes every counter at worst-case retry rates at once.

### 4.3 Conditions for these caps to mean anything (§15c / §15d)

1. **The orchestration path must check Pro against the table**, or the caps bound only regenerations. On the held
   branch `autoMode.orchestrateStep` skips Pro entirely (`autoMode.ts:254-257`) while the cores count — a coach can
   build unlimited campaigns through the Trail. This needs Arfeen's ruling: D5 said Pro is "never counted or gated by
   the new Trail quota logic".
2. Ad images and concept sets need enforcement that does not exist yet (no counter, no Pro gate).
3. The pricing page must change with the caps: "50–100 generations per tool" and "3 ICP Profiles" both contradict
   them; say "per month".
4. Negative control per cap: at cap − 1 passes, at cap refused, reset restores (the held tests already do this for the
   table values).

### 4.4 Cheaper levers (not caps, noted for later)

- **Prompt caching** is not used anywhere (`llm.ts` sends no `cache_control`). The 4 LP angles, 3 offer angles and
  5 headline formulas share long system prompts sent in parallel; caching could cut their input cost by up to ~90% on
  the shared prefix.
- **`max_tokens` is 8192 for every call** and the concept generator truncates at it (measured `out=8192`, then a
  retry) — a truncation costs a full extra attempt.
- **Opus for LP body rewrites** is ~1.7× Sonnet per token plus the ~30% tokenizer uplift.

---

## 5. WHAT COULD NOT BE MEASURED

- **Per-call token usage on production.** Logged by `llm.ts:594-600` but not retrievable from Railway (zero lines
  across 100 deployments). Every input figure is estimated; output figures come from stored rows.
- **Retry rates** for offer, landing page, email, WhatsApp, bonus, ICP and ad-headline loops (no data). Only concepts
  (measured 2 attempts, both failing) and scripts (7/24 first-pass) are measured. Low/high bound them.
- **Compliance-rewrite volume** — `complianceRewrites` has 0 rows on production today.
- **The Anthropic invoice.** No billing or Console usage data was reachable; the Usage & Cost Admin API needs an
  admin key.
- **Real usage by paying coaches** — production holds 3 users (all Pro-tier test/owner accounts) and 22 kits.
- **gpt-image-1 price** confirmed via a third-party calculator; OpenAI's pricing page defers to its own calculator.
- **Services-intake output size** (not measured; estimated).

**Recommended next step:** approve instrumenting cost at source — record `usage.input_tokens / output_tokens` and
the model per call to a table (or at least keep the existing log line retrievable), then re-run this model on a week
of real data before the caps are finalised.
