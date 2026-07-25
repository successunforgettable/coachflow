# ZAP Handover — July 24, 2026

## Headline (checkpoint 2026-07-25)

**✅ BONUS ARC COMPLETE (reading-task tier) + LIVE.** Full arc, all machine-verified: **Layer 1** (ICP-derived
3-bonus content, coherent across offer/LP/email) → **Layer 2** (hosted PDF deliverables + Kit "Your Bonuses"
surface) → **durability fix** (jobs-table, self-heal reconcile, no orphans) → **correctness pass** (post-purchase
framing + markdown rendering). **NEXT = the Andromeda script generator** (Arfeen re-prioritized it AHEAD of the
readability pass). Everything below documents the two most recent stages.

## 🧩 ANDROMEDA — campaignConcepts per-concept mechanism (2026-07-25): migration 0093 LIVE on prod (empty), code HELD local, 7th hook + mapping GROUNDED

The Andromeda per-concept fan-out mechanism was built this session (investigation → build → migration). **"One person, many angles": N concepts (default 8) vary Desire × Awareness WITHIN one ICP** (persona fixed to the ICP). Full detail: [[project_icp_generator_enhancement_spec]] context + the concept memory.

**Migration state (the migration-before-code gate — track this before any push):**
- **`0093_campaign_concepts.sql` — APPLIED TO PROD + VERIFIED (2026-07-25) via Arfeen's explicit "execute".** New additive `campaignConcepts` table: **19 cols**, 2 FKs (`userId`→users, `icpId`→idealCustomerProfiles, both cascade), PRIMARY + 3 indexes, enums (awareness 5, hookPattern, status 3). **Verified EMPTY (0 rows)** on prod. Additive — zero risk to existing tables.
- **`0094_campaign_concepts_direct_offer_hook.sql` — AUTHORED, NOT APPLIED (awaits Arfeen "execute").** Appends the **7th hook pattern `direct_offer_urgency`** to `campaignConcepts.hookPattern` via `ALTER TABLE … MODIFY COLUMN`. Append-to-end enum = metadata-only + the table is empty → safe, near-instant. **Prod hookPattern is still the 6-value enum until 0094 runs.**

**🔴 CODE HELD LOCAL — do NOT push until 0094 executes on prod.** Application code (schema enum + generator that can write `hookPattern='direct_offer_urgency'`) queries `campaignConcepts` and can emit the 7th value; deploying it before 0094 runs would break on the 6-value prod enum. Committed local-only (crash-safety; base build was `cb387f9`, the 7th-hook + mapping build sits on top). Push gated on: 0094 "execute" + harness green (harness IS green — see below).

**What's grounded/approved this session:**
- **Hook→awareness mapping — now APPROVED + GROUNDED** in `conceptAxis.ts` (`approved:true`). Source: Arfeen's NotebookLM run on his corpus, corroborated by banked ICP docs on the 2 independently-matching stages (Problem-Aware→Problem-First, Product-Aware→Social-Proof). The earlier web-derived candidate is RETIRED. Mapping: Unaware→meme_humor · Problem-Aware→problem_first · Solution-Aware→aspirational_transformation · Product-Aware→social_proof · Most-Aware→**direct_offer_urgency** (the 7th). Cross-stage: Founder/Authenticity spans Problem/Solution-Aware; Data/Chart spans Unaware/Product-Aware; Social-Proof spans Solution/Product-Aware.
- **7th hook = highest Meta-compliance-risk** → compliance built IN, not bolted on: `screenConceptCompliance` routes every concept's hook/headline/shortText/longText through the existing `complianceFilter` (`server/lib/complianceFilter.ts` — guaranteed-income REJECT patterns + the "6b" fabricated-deadline-scarcity PIVOT pattern). The generator runs structural validate **AND** compliance screen every attempt → retry-with-failContext. Prompt instructs REAL urgency only (a genuine coach-supplied deadline), never fabricated scarcity.

**Verification (all real, clean-room UP this session):** TS **35** · unit tests **20/20** concept (structural 8, compliance 3, mapping/7-hook 6, prompt 5 — 402 total incl. canonical 382) · **real end-to-end generation** (`server/scripts/verify-concept-generation.ts`, ICP 15): 8 concepts, all 5 awareness stages, **all 7 hook patterns incl. direct_offer_urgency**, 8 distinct desire×awareness, and the urgency concept used a `[DATE]` placeholder — REAL-urgency, NOT fabricated scarcity · **Playwright harness GREEN** (`e2e/campaign-concepts.spec.ts`, structural invariants from the DB). **Still deferred by design:** the ICP-corpus anti-fabrication validator (the ICP feeding this is knowingly fabricated → deferred to the ICP grounding sprint; DRAFT-only, nothing reaches Meta until publishToMeta).

### Correctness pass — `10582b9` (post-purchase framing + markdown rendering)

`HEAD = origin/railway-build = 10582b9`. Deploy **SUCCESS**, image digest **`sha256:46ce904e5f16`** (container
swapped, prod 200; server-side render/content change → no client bundle, proof = digest + boot). Two defects from
Arfeen's live review (kit 191) fixed:
- **Framing:** the generator prompt was pre-registration lead-magnet copy, so a post-purchase bonus pitched the
  buyer to convert ("Reserve My Spot… next cohort is forming"). Added `mode:"bonus"` — system + user prompts write
  to a buyer already enrolled; `nextStep` orients to USING the programme; requires a `howToUse` orientation.
  `bonusPdfGenerator` passes `mode:"bonus"`. Lead-magnet mode byte-identical (characterization 3/3).
- **Rendering:** tool content is well-structured markdown but was dumped raw into `<pre>` (literal `##`/`**`/`|`).
  Replaced with an in-house line-based markdown renderer (no dependency): headings, bold/italic, ordered &
  unordered lists, tables, rules; `[BRACKET]` fill-ins render as distinct chips; `howToUse` renders in a "How to
  use this" card under the cover; cover states the format.

**Verified LIVE in prod output (kit 192, all 3 bonuses):** framing OK (buyer CTAs, no register/reserve/book) ·
`noRawMd:true ×3` · no `<pre>` · fill-in chips · how-to card + format cover. Gates: TS 35, new tests **19/19**,
characterization **3/3**. **Both teardowns clean** — pre-fix kit-191 + smoke kit-192 (6 rows/6 KV/6 PDFs removed;
post-teardown DB 0 + all 6 pages & PDFs 404; nothing hosted). Files: `leadMagnetRenderer.ts` (+ `.test.ts`),
`leadMagnetContentGenerator.ts` (+ `.bonus.test.ts`), `bonusPdfGenerator.ts`, `scripts/verify-bonus-render.ts`.

### Prior — `0cf0a38` (Layer 2 bonus PDF DURABILITY FIX)

The Layer 2 bonus hosted-PDF path was live but fire-and-forget (a process recycle mid-run orphaned bonuses with no
recovery). It is now a durable jobs-table job with on-Kit-load self-heal. Shipped `0cf0a38`, deploy SUCCESS, prod
smoke A22-prod green, artifacts torn down.

## What shipped — `0cf0a38` (durable bonus PDF generation)

`HEAD = origin/railway-build = 0cf0a38`. Railway build **SUCCESS**, image digest `sha256:6427351bedf7`, container
swapped (`Starting Container` → `Server running` → prod HTTP 200, clean boot). **Server-side only** (no `client/src`)
→ served bundle unchanged BY DESIGN; the deploy proof is the fresh image digest + healthy boot, not a bundle hash.
**🔑 Do NOT misread the unchanged bundle as a failed deploy** — same class as Layer 1 (server-only): there is no
new client bundle to fingerprint, so the digest `sha256:6427351bedf7` + healthy boot IS the deployment proof.

Five files:
- `server/bonusPdfGenerator.ts` — `enqueueBonusPdfJob` (durable jobs row `bpdf-{setId}`; deterministic id =
  idempotency lock; upsert resets stale/failed/complete → pending; reaped-if-pending by the existing stuck-job
  reaper). `runBonusPdfGeneration` now **resumable** (skips bonuses already fully done). `reconcileBonusPdfs`
  (on-Kit-load self-heal: a bonus with a concept but no `assetBody` past the 10-min stale window, not covered by an
  active job, gets a fresh durable job).
- `server/_core/orchestration.ts` — orchestration now **enqueues** the durable job (was direct fire-and-forget).
- `server/routers/bonuses.ts` — `bonuses.listForKit` fires `reconcileBonusPdfs` non-blocking on Kit load.
- `e2e/manual-wizard-free-event.spec.ts` — bounded the A22 poll's `dbQuery` with a timeout (a transient DB hang
  can no longer wedge the run).
- `server/scripts/verify-durable-bonus-pdf.ts` — the browser-free durable-path verifier (kept as a tool).

**Gates:** TS **35**, `leadMagnetPublisher` characterization **3/3** (proves `publishLeadMagnet` byte-identical
after the `publishDeliverableBody` extraction). Guards: `@playwright/test` absent, no `package-lock.json`,
`pnpm --frozen-lockfile` passes.

## Verification chain (all green)

1. **Clean-room durable verify** (`verify-durable-bonus-pdf.ts`): two orphaned sets (kit 13, 14) healed 0/3 → 3/3
   through `reconcileBonusPdfs → enqueueBonusPdfJob → runner → assetBody ×3`; done set (kit 15) untouched
   (resumable guard); idempotency lock held (exactly 2 `bpdf-` job ids across re-enqueue, no duplicates).
2. **Deploy**: build SUCCESS on `0cf0a38`, container swapped, prod 200.
3. **No-publish guard armed**: `E2E_NOPUBLISH_OPENID = native_ea8a5ee639013dd01bc0b6b585b9dd52` on the running
   service (the hard rule before any prod run).
4. **Prod smoke** (real campaign on zapcampaigns.com, kit 190): **24/26 PASS**. **A22-prod GREEN** — each bonus has
   `assetBody + magnetPdfUrl + all URLs 200` (poll 2/3 → 3/3). **A24 GREEN** — no-publish guard held. The 2 FAILs
   (**A8** ad-copy 0-card deck, **A11** `[INSERT_*]` count) are the documented pre-existing tracked reds — **zero
   regression** (matches the clean-room 23/25 baseline).
5. **Kit "Your Bonuses" links resolve**: 3 bonuses × (Cloudinary PDF + `/p/bonus-{id}` page) = **6/6 → 200**.
6. **Lead-magnet no-regression**: characterization 3/3 + `publishDeliverableBody` (the exact extracted core) proven
   LIVE via the 3 hosted bonus PDFs. Full-wrapper live publish not forced (would need a deliberate prod write; the
   manual-wizard flow doesn't publish a hosted magnet PDF, so no fresh smoke magnet existed to GET).
7. **Final teardown + clean assertion**: guarded script removed 3 bonus rows + 3 KV pages + 3 PDFs; post-teardown
   DB bonuses = 0, all 6 URLs → **404**. Nothing left hosted.

**User-perspective timing (from the smoke run):** once the 3 bonus concepts persist, all 3 hosted PDFs are live
within **~86s** (A22 poll: 2/3 at 599s-left → 3/3 at 514s-left of the 600s budget). A coach sees
"generating → your 3 bonuses are ready" inside ~1.5 min after the kit completes. The long pole remains the full
node-by-node campaign generation, not the bonus PDFs.

**Minor cosmetic (tidy later, non-blocking):** bonus PDF storage key double-suffixes `.pdf.pdf`
(`bonuses_117174_10.pdf.pdf`) — resolves 200, harmless.

## 🔴 INCIDENT NOTE — prod Anthropic API credit exhaustion (2026-07-24)

**What happened:** mid-session, the prod Anthropic API key (`sk-ant-api03-p…wAA`, shared by prod + the clean-room)
hit a **zero credit balance** and returned `400 – Your credit balance is too low to access the Anthropic API` on
**every** generation call (after both retries). This took down **all production generation** — every campaign build,
LP, email, bonus, lead-magnet generation for real coaches — silently (no alert; surfaced only because the clean-room
harness stalled with nothing to wait for, and a targeted probe returned the 400).

**Blast radius:** total for generation. Non-generation paths (auth, publish, reads) unaffected. The clean-room
"hang" that consumed ~1h of this session was a downstream symptom, not a code fault.

**Resolution:** Arfeen topped up credits. Confirmed restored via a 1-token probe (HTTP 200) on the exact key, and
the prod service key prefix matches the topped-up key (`sk-ant-api03-p…wAA`) → same workspace → prod restored.

**Guardrail against recurrence — auto-reload:** the balance reached zero and **stayed** there until a manual
top-up, which indicates **auto-reload was NOT enabled** (auto-reload would have recharged before hard-zero).
**ACTION FOR ARFEEN: enable auto-reload (auto-recharge) in the Anthropic Console → Billing** so the balance can
never hit hard-zero again. Claude cannot toggle billing settings. **Status as of this handover: auto-reload
NOT confirmed enabled — OPEN.** A secondary guardrail worth considering: a low-balance alert / a boot-time or
scheduled cheap-probe healthcheck that pages on a 400-credit error (today nothing surfaced the outage).

## 🔵 TRACKED (do not drop) — Bonus deliverable FORMAT + design decision: INTERACTIVE-FIRST (deferred until AFTER the Andromeda script generator)

**Supersedes and EXPANDS the earlier "make the bonus PDF look better" pass — this is a FORMAT decision, not polish.**

**Reframe:** the earlier item was "make the bonus PDF look better." The real question is bigger — **is PDF even the
right format?** Arfeen's position, research-backed: **a bonus should be a tool the buyer OPERATES, not a reading
task.** *"If it's a reading task, generally people hate it."*

**Why PDF was chosen (honest record):** it was **never chosen.** PDF came bundled with the decision to reuse the
lead-magnet pipeline (which produces PDFs). The format question was **never surfaced as a product decision.**

**What the research supports:** implementation-over-information (the Xanax-vs-meditation principle) — the deliverable
should **do the work, not describe it.** Premium examples in the research are interactive (Notion workspaces,
"one-click Notion OS", plug-and-play systems) *because they're operated, not read.* **Nothing privileges PDF.**

**Interactive-first is the leading candidate. Functional case per format:**
- **Checklist** — boxes that actually tick (a PDF checklist you can't tick is a worse checklist).
- **Script bank** — copy-to-clipboard per script (use the words, don't retype them).
- **SOP / template** — real typeable fill-in fields, not printed brackets.
- Plus **HTML has far more design headroom than a print-oriented PDF renderer** (interactivity, motion, layout,
  states) — the design ambition is MORE achievable in HTML than PDF.

**Counterweights to resolve when built (validate, don't assume):** perceived value (a download feels owned, a link
feels visited) · portability/permanence (a PDF survives independent of ZAP hosting; does the link die on archive?) ·
**state persistence — does a ticked box survive a refresh? If not, an interactive checklist is a toy. Make-or-break.**

**Likely answer (validate, not assume): BOTH.** The HTML is already generated and the PDF is rendered FROM it —
`magnetHtmlUrl` AND `magnetPdfUrl` already exist. So this is probably "present the **interactive** version as the
PRIMARY deliverable, with a PDF to keep" — not either/or. **The genuinely new work is making the HTML actually
interactive (tickable / copyable / typeable), rather than just being the print source.**

**Why it MUST NOT be dropped (Arfeen's reasoning):** the offer assigns value to these bonuses. A bonus framed as
valuable that arrives as a plain document nobody wants to read **has no value and undermines the offer's credibility.**

**Sequencing:** DEFERRED until AFTER the Andromeda script generator (more important — the Andromeda backbone; the
current bonuses are now correct + clear rather than broken; rushing a format change on an uncommitted fix is how good
decisions get made badly). Full detail: memory `project_bonus_pdf_visual_design_pass`. **Separate from the correctness
fixes** (register/framing · `<pre>`→markdown · howToUse · fill-in chips) which already made the current PDF bonuses
correct + clear.

## 🧠 TRACKED (do not drop) — ICP-GENERATOR ENHANCEMENT SPEC (research + audit + spec COMPLETE; NOT scheduled — after the Andromeda script generator)

**The highest-leverage node in the system** (R4 quality-multiplier — ICP quality compounds through the entire downstream cascade) and the **load-bearing front-door of the funnel strategy** (the free-tool "wow, this gets me" hook). Research + a read-only audit + the enhancement spec are complete; **not scheduled** — Arfeen picks this up **after the Andromeda script generator ships.**

**Research banked** (2026-07-25): `docs/icp-research/` — 4 NotebookLM reports + README. **R1** `The Psychology of the ICP…` (deep internal-buyer-dimension standard) · **R2** `Methodology Report… Signal Extraction…` (5 Rings, laddering, evidence-vs-hunch) · **R3** `Diagnostic Report… Failure and Recovery` (5 failure modes) · **R4** `Strategic Report… Precision-Impact Matrix` (downstream stakes). The reports are **B2B/RevOps-framed** — translate the psychological dimensions + anti-fabrication discipline to ZAP's coach/B2C context; drop the firmographic/territory/CRM machinery.

**Current-state finding (read-only audit).** Generator: `server/routers/icps.ts` (`generate` sync + `generateAsync`) via shared prompts `server/_core/icpPrompts.ts` (`ICP_USER_PROMPT`/`ICP_SYSTEM_PROMPT`). It **MEETS the R1 depth standard** — root-vs-surface pain, fears (3am version), identity outcomes, buying triggers (specific moment), objections (say-vs-mean), first-person internal-monologue voice (only `demographics` is structured JSON; the other 16 tabs are `•`-bulleted prose). **BUT it has NONE of the R2/R3 safety machinery.** Critically it is **fabrication BY DESIGN**: the prompt demands invented specifics (real influencer names, specific ages/incomes/locations, verbatim first-person quotes) from **one thin freeform input** (the 3 real free-text answers: service `description`/`targetCustomer`/`mainBenefit`) with **zero grounding requirement** → the polished, convincing ICP is **confident fabrication = exactly R3's most dangerous failure mode ("Aspirational Fantasy" / fantasy-as-fact)**. It **reads excellent regardless of input quality because it's built to invent persuasively** (proof: real generated ICP #254 confidently invented unflagged income £60–120k, gender skew, six named cities, MBA/MSc, verbatim quotes). **No quality validator exists** — only a compliance language filter (`filterRecord` REJECTs banned terms) + `stripObjectionScaffolding`; `icpEnrichment` fills nulls for **imported** ICPs only, not generated.

**Enhancement spec (research-grounded, 3 parts):**
1. **Grounding (R2)** — input laddering (pain-point / 5-Whys to root pain, JTBD inference) + **inferred-vs-stated flagging** so the generator distinguishes what's grounded from what it's inventing.
2. **Validator (R3)** — post-generation check for too-broad / aspirational-seller-centric / fantasy-unflagged / demographic-hollow — **mirror `validateBonusFabricationPatterns`** (generate → validate → retry-with-failContext, `server/_core/validator.ts`).
3. **Input depth** — move from one freeform description to a small set of targeted questions that ladder to root pain.

**🔴 THE KEY PRODUCT TENSION (Arfeen's call at BUILD time — record explicitly, do NOT resolve now).** The generator's vividness **comes from the fabrication**. A punchy, specific ICP is what makes the free-tool hook land ("wow, this gets me") — but that specificity is invented. The enhancement must **thread a needle**: keep the ICP compelling + specific ENOUGH to work as the funnel's front-door hook, while making it grounded + honest about what's inferred. **Over-ground it → hedged and boring, kills the hook. Leave it fabricated → poisons the cascade (R4: ICP quality compounds downstream).** This **grounding-vs-vividness balance is the real decision — a product/brand call for build time, NOT a mechanism CC decides.** Full detail: memory `project_icp_generator_enhancement_spec`.

## Next in the forward sequence

(2a) **Copy readability / register pass** — visible on every campaign; A13 measures FK but no bar agreed; needs a
register standard, not just a number. · (3) **Problem B** — per-node review surface + existing-assets import. ·
(4) **Andromeda backbone** → then **(4.5) Bonus PDF visual design pass** (queued after the Andromeda script generator).
See CLAUDE.md §1a for the full ordered roadmap.
