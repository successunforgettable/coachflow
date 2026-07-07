# CHECKPOINT 2026-07-08 — Lead-Magnet DELIVERY built to new quality bar (unpushed)

**Sprint: Lead-Magnet Delivery. All three static formats (guide/checklist/toolkit) BUILT to the new research-backed quality bar. Four atomic commits are LOCAL and UNPUSHED on `railway-build`. Migration `0083` is ALREADY APPLIED to prod. Nothing deployed. Gates: TS 35, `npx vitest run server/pipeline-fixes.test.ts` 367/367.**

> Dev-env: prefix git with `DEVELOPER_DIR=/Library/Developer/CommandLineTools`.

## Commits — LOCAL + UNPUSHED (recovery)
Branch `railway-build`, oldest→newest (first parent = origin `50ff071`):

1. `13a33604f818bbcd7050696d3679e4639062a7b5` — migration: capturedLeads + hvcoTitles magnet URLs (+ quiz forward-compat)
2. `0527fb7f985c37eb218c96dec6b4f54f61689fb7` — 80/20 tools-first content + minimalist render/host/PDF
3. `a92b59cb4f044656f946157fd1d02b8f397d8397` — ZAP-owned opt-in capture + data-handling
4. `dc2e74c2773bbf31eb0f2c7ca3b371ade3e84aab` — push ZAP Lead Magnet URL Custom Value on campaign push

- Recovery branch `leadmagnet-delivery-build` also points at `dc2e74c`.
- **origin/railway-build = `50ff071`; it does NOT contain these four commits (intentional).** Origin additionally holds this docs commit, so local `railway-build` shows diverged (ahead 4 build / behind 1 docs) until the deploy-time rebase onto origin.
- Do NOT push the build commits and do NOT deploy until `PII_ENCRYPTION_KEY` is set and Arfeen gives an explicit deploy go.

## Migration — ALREADY APPLIED to prod (`drizzle/0083_lead_magnet_delivery.sql`)
Executed 2026-07-08 with explicit go; verified from `INFORMATION_SCHEMA`:
- `hvcoTitles`: +`magnetHtmlUrl` varchar(500) NULL, +`magnetPdfUrl` varchar(500) NULL.
- `capturedLeads`: created (21 cols) incl. `emailEncrypted`(512) NOT NULL, `emailHash`(64) NOT NULL, `nameEncrypted`(512), `consentGiven`, `consentText`, `privacyPolicyUrl`, `sourceSlug`, `ipHash`(64), `userAgent`, `magnetHtmlUrl`, `magnetPdfUrl`, **`submissionData` json**, **`resultBand` varchar(120)**, `deliveredAt`, `createdAt`, `purgeAfter`.
- Indexes: `idx_capturedLeads_userId`, `idx_capturedLeads_purgeAfter`, `uq_capturedLeads_dedup` UNIQUE(userId,emailHash,hvcoId), PRIMARY.
- FKs: user→users.id **ON DELETE CASCADE**; service/campaign/hvco → SET NULL. Row count 0.
- **DB is AHEAD of the deployed code BY DESIGN.** Prod runs OLD code (bundle `index-Bw9-BR6u.js`, code head `b0fbc45`) against the migrated DB — safe, because the old code never selects the new columns. Migration-before-deploy is therefore satisfied.

## The new quality bar (what was built)
- **Content — 80/20 tools-first** (`server/leadMagnetContentGenerator.ts`): `assetBody` shapes `{promise, <blocks>, nextStep}`; usable tools first (~80%), tight 2-sentence `promise`, no prose-heavy intro/takeaways, `nextStep{heading,body,ctaLabel}` bridge-to-offer on every format. Toolkit 3–4 tools (name/type/instructions/content), checklist 7–15 items, guide 3–6 lean sections.
- **Design — minimalist** (`server/leadMagnetRenderer.ts`): upright Fraunces, muted neutral palette, heavy white space, single column, 17px body, cover/dividers/wordmark. Format-dispatch (`renderDeliverableHtml`; quiz→null). Fonts via public Google Fonts link so CF Browser Rendering embeds real faces.
- **PDF**: `renderPdfFromUrl` sets page margins + page-number footer ("Created with ZAP Campaigns · N / M") — footer-tight nit fixed.
- **CTA label**: type-aware ("Send me the toolkit/checklist/guide"), never the title.
- **Bridge upgrade** (`renderOptInHtml`): confirm → Read online + Download PDF → tailored nextStep CTA → testimonial slot (`services.testimonial1*`, hidden when absent).
- **Quiz accommodations built now** (quiz itself = next sprint): format-dispatch renderer/bridge + `submissionData`/`resultBand` columns. No re-architecture, no re-migration next sprint.

## Plumbing (built earlier, unchanged)
KV hosting (`writeKvPage`, reuse `/p/*` worker); PDF via Cloudflare Browser Rendering `/pdf`; publisher `server/leadMagnetPublisher.ts` (deliverable+opt-in KV pages, PDF→Cloudinary, testimonial, persists URLs; wired into orchestration hvco step, non-fatal); capture `POST /api/capture-lead` (`server/leadCapture.ts`) honeypot + per-IP rate limit + email/consent validation, PII encrypted, upsert dedup, on-page delivery (same-origin, no CORS); `server/lib/piiCrypto.ts` AES-256-GCM with separate `PII_ENCRYPTION_KEY` + keyed one-way `hashEmail`/`hashIp`; `server/routers/capturedLeads.ts` owner-scoped list/deleteLead/exportCsv; 24-month retention reaper; `ghl.ts` pushes `ZAP Lead Magnet URL` Custom Value (contacts.write DORMANT).

## Exact resume point (in order, on go)
1. **Set `PII_ENCRYPTION_KEY` on Railway** (`openssl rand -hex 32`, separate from `TOKEN_ENCRYPTION_KEY`). Required before live capture — otherwise capture/encryption throws (boot stays safe).
2. **Run the full post-migration live proof per format** — real generation → branded page → PDF → encrypted capture readback → dedup → delete/export → GHL CV present.
3. **Push commits → deploy → verify** the served bundle moved off `index-Bw9-BR6u.js`; re-check TS 35 / vitest 367 / prod 200. (Deploy-time rebase onto origin changes the four build SHAs — expected.)
4. **Deploy cleanup**: delete the throwaway `https://zapcampaigns.com/p/zzz-proposal-toolkit` KV page.

## Known open items (carry forward)
- **nextStep CTA button** links to the magnet page, not the coach's real booking URL — gated on booking-URL capture (brand-capture roadmap); small sprint to slot after quiz. Copy is real; only the button target is a placeholder.
- **Wordmark "ZAP CAMPAIGNS"** on magnets is a placeholder for the coach's logo (brand-capture roadmap).
- **GHL last-mile** depends on the customer's own workflow (locked arch: CVs only, no tags/contacts).
- **Quiz** = immediate next sprint (interactive scored surface; accommodations built).
- **Booking-URL capture** = small sprint to slot after quiz.

## Verification standard
Live proof of capture needs `PII_ENCRYPTION_KEY` present first, or capture/encryption throws. "Verified" = real readback / real browser click, never paper. Re-verify SHAs + gates on resume before trusting.
