# CHECKPOINT — 2026-07-08 — Lead-Magnet Delivery: BUILT + LIVE-PROVEN (unpushed)

**Status:** All three static lead-magnet formats (guide / checklist / toolkit) built to the
research-backed quality bar, and the **full per-format live proof PASSED against production**.
Four atomic build commits are **LOCAL and UNPUSHED** on `railway-build`. Migration `0083`
already applied to prod. `PII_ENCRYPTION_KEY` now set on Railway. **Nothing deployed.**

Dev-env: prefix git with `DEVELOPER_DIR=/Library/Developer/CommandLineTools`.
Prod access: `railway run --environment production --service coachflow npx tsx <script>`
(injects DATABASE_URL, PII_ENCRYPTION_KEY, TOKEN key, Cloudflare, Cloudinary, LLM).

## Git state (verify on resume before trusting)
- `railway-build` HEAD = `dc2e74c`, reads **[ahead 4, behind 1]** of `origin/railway-build`.
- `origin/railway-build` = `a4583d7` (docs only) — does **NOT** contain the 4 build commits (intentional).
- Recovery branch `leadmagnet-delivery-build` → `dc2e74c` (keeps the 4 commits reachable).
- Gates: TS 35 (`npx tsc --noEmit | grep -c "error TS"`), vitest `server/pipeline-fixes.test.ts` 367/367.

### The four build commits (oldest → newest; parent of first branched before origin's docs commit)
1. `13a3360` — migration: capturedLeads + hvcoTitles magnet URLs (+ quiz fwd-compat submissionData/resultBand)
2. `0527fb7` — 80/20 tools-first content + minimalist render/host/PDF
3. `a92b59c` — ZAP-owned opt-in capture + data-handling
4. `dc2e74c` — push `ZAP Lead Magnet URL` Custom Value on campaign push

## Migration + runtime
- `0083_lead_magnet_delivery.sql` **already applied to prod**. `hvcoTitles` +`magnetHtmlUrl`/`magnetPdfUrl`;
  `capturedLeads` 21 cols incl. `submissionData` json + `resultBand` varchar(120) (quiz forward-compat),
  AES-GCM `emailEncrypted`/`nameEncrypted`, one-way `emailHash`/`ipHash`, `uq_capturedLeads_dedup`
  UNIQUE(userId,emailHash,hvcoId), FK user→CASCADE / service·campaign·hvco→SET NULL.
- Prod serves **OLD** bundle `index-Bw9-BR6u.js` (deployment commit `a4583d7`) against the migrated DB —
  safe by design (old code never selects the new columns). `capturedLeads` row count = 0.
- `PII_ENCRYPTION_KEY` **SET** on Railway (len 64, confirmed distinct from `TOKEN_ENCRYPTION_KEY`).

## Live proof — PASSED (all 3 formats, against prod)
Ran the real unpushed modules via `railway run npx tsx` against prod, service **252** / user **1** / ICP **229**
(full grounding + `testimonial1` so the bridge testimonial slot is exercised). Throwaway HVCO rows
**5678 (guide) / 5679 (checklist) / 5680 (toolkit)**. Every step green per format:

| Step | guide 5678 | checklist 5679 | toolkit 5680 |
|---|---|---|---|
| format inference | guide | checklist | toolkit |
| real generation | 5 sections | 12 items | 4 tools (template/script/swipe/swipe) |
| branded minimalist KV page (200) | ✅ | ✅ | ✅ |
| PDF rendered + stored (Cloudinary) | ✅ 612×792 ~113KB | ✅ | ✅ |
| capture HTTP 200 + delivers URLs | ✅ | ✅ | ✅ |
| ciphertext at rest `enc:1:…` | ✅ email+name | ✅ | ✅ |
| decrypt roundtrip = plaintext | ✅ | ✅ | ✅ |
| emailHash HMAC match / ipHash stored | ✅ | ✅ | ✅ |
| dedup on re-submit (stays 1 row) | ✅ | ✅ | ✅ |
| export (owner-scoped, decrypted) | ✅ | ✅ | ✅ |
| delete (erased) | ✅ | ✅ | ✅ |

`capturedLeads` returned to **0** after cleanup. Opt-in page confirmed: type-aware CTA
("Send me the toolkit"), consent + privacy form, testimonial slot populated, "Created with ZAP Campaigns"
wordmark. Screenshots in repo root: `proof-{guide-5678,checklist-5679,toolkit-5680}-deliverable.png`,
`proof-toolkit-5680-optin.png`. Live pages still up: `/p/magnet-magnet-567{8,9,0}` + `/p/magnet-get-567{8,9,0}`.

**Arfeen reviewed the live pages: toolkit/checklist content GOOD, minimalist clean look APPROVED
(colour deferred to the coach's brand via brand-capture), niche-agnostic engine CONFIRMED.**

## Resume task list — agreed pre-deploy work, NOT yet done (do in order, then deploy go)
1. **CC — spacing bug:** fix the consistent oversized vertical gap between intro/promise and the FIRST
   tool/section across ALL THREE formats. It is a spacing bug in `server/leadMagnetRenderer.ts`
   (not an image slot / not a missing element).
2. **CC — wordmark hide:** make the "ZAP CAMPAIGNS" wordmark gracefully HIDE when no coach logo exists
   (interim, not full brand-capture) so the coach's deliverable isn't stamped with ZAP's name.
3. **Arfeen — account settings, NOT CC:**
   - Cloudinary → flip **"Allow delivery of PDF and ZIP files"** (account `dunshei0y`, Settings→Security).
     PDF renders + stores fine; public delivery **401s** until this toggle is on (proven this session).
   - GHL → **OAuth reconnect** (token expired 2026-06-08; userId 1, location `yfK7u2subVFh1BJHPSyg`).
     CV push returns `401 Invalid JWT`; wiring proven correct (`ghl.ts:866-871` writes
     name=`ZAP Lead Magnet URL`, value=`magnetHtmlUrl`).

**Then:** deploy go → push build commits → deploy (deploy-time **rebase onto origin changes the 4 SHAs** —
expected) → verify served bundle moves **off** `index-Bw9-BR6u.js` → re-check TS 35 / vitest 367 / prod 200 →
**deploy cleanup:** delete throwaway KV pages `/p/zzz-proposal-toolkit` and the proof rows/pages
5678/5679/5680 (`/p/magnet-*-567{8,9,0}` + the `hvcoTitles` rows).

## Queued as their own proper sprints (confirmed — do NOT jam into this deploy; all near-term)
- **brand-capture** — coach logo upload/store/inject; does the wordmark properly (replaces the interim hide)
  AND unblocks the ad-image logo slot.
- **booking-URL capture** — the magnet's "Book my call" nextStep CTA currently points at the magnet page,
  not the coach's real booking URL; capture and inject it.
- **quiz** — interactive scored format; delivery/DB accommodations already built (renderer format-dispatch
  quiz→null, `capturedLeads.submissionData`/`resultBand`).

Memory mirror: `memory/session_state_2026_07_08_leadmagnet_delivery_proven.md`.
Predecessor (build): `docs/handover/CHECKPOINT_2026-07-08_LEADMAGNET_DELIVERY_BUILT.md`.
