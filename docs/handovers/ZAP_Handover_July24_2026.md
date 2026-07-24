# ZAP Handover — July 24, 2026

## Headline

**Forward-sequence STEP 2b — Layer 2 bonus PDF DURABILITY FIX shipped + prod-verified.** The Layer 2 bonus
hosted-PDF path was live but fire-and-forget (a process recycle mid-run orphaned bonuses with no recovery). It is
now a durable jobs-table job with on-Kit-load self-heal. Shipped `0cf0a38`, deploy SUCCESS, prod smoke A22-prod
green, artifacts torn down.

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

## Next in the forward sequence

(2a) **Copy readability / register pass** — visible on every campaign; A13 measures FK but no bar agreed; needs a
register standard, not just a number. · (3) **Problem B** — per-node review surface + existing-assets import. ·
(4) **Andromeda backbone.** See CLAUDE.md §1a for the full ordered roadmap.
