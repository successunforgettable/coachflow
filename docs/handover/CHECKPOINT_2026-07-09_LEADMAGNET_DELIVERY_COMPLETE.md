# CHECKPOINT 2026-07-09 — Lead-Magnet Delivery: COMPLETE & verified live on prod

**Status:** Sprint COMPLETE. Deployed clean and verified end-to-end against production. This supersedes the 2026-07-08 BUILT and PROVEN checkpoints (both pre-deploy).

## Deploy state
- **HEAD = origin/railway-build = `dff3dda`**, in sync (ahead 0 / behind 0).
- 5-commit stack (rebased onto origin docs `a4583d7`/`d3794f0`), oldest→newest:
  - `1bf35ce` migration — capturedLeads + hvcoTitles magnet URLs (+ quiz forward-compat)
  - `825dce2` 80/20 tools-first content + minimalist render/host/PDF
  - `5d71eb5` ZAP-owned opt-in capture + data-handling
  - `5449416` push ZAP Lead Magnet URL Custom Value on campaign push
  - `dff3dda` cover spacing + coach-logo brand slot (interim, no ZAP wordmark)
- Recovery branch `leadmagnet-delivery-build` holds the pre-rebase copy.
- **Server-only deploy** (zero `client/` changes) → served bundle **correctly unchanged `index-Bw9-BR6u.js`**. Bundle-move is the WRONG deploy signal here.
- `PII_ENCRYPTION_KEY` set on Railway (len 64, distinct from TOKEN key). Migration 0083 applied. prod 200. Gates TS 35 / `vitest run server/pipeline-fixes.test.ts` 367/367.

## How the deploy was verified (server-only ⇒ not by bundle grep)
- `POST /api/capture-lead` flipped from SPA-catchall (`200 text/html`) to the live handler: `400` JSON on bad email, `200 {"ok":true}` on honeypot, `"Magnet not found"` reaching the real DB lookup.
- Fresh boot markers: `[boot] Font validation OK`, `Stuck-job reaper`, `Server running on http://localhost:8080/`.

## Live end-to-end proof (real prod path, then cleaned up)
Generated a real magnet — hvco **5681**, svc **252** / ICP **229** / user **1**, title "The Career Comeback Toolkit: Templates and Scripts":
- Content: **toolkit**, real 242-char promise (new-quality-bar generation).
- Published: branded KV page `/p/magnet-magnet-5681` + Cloudinary PDF (**HEAD 200** — Cloudinary PDF-delivery toggle now enabled).
- Row `magnetHtmlUrl` persisted and matched the publish result.
- **Both live fixes confirmed on the fresh render:** spacing (`margin:0 0 60px`, no `min-height:74vh`) and NO ZAP wordmark (no `ZAP CAMPAIGNS`, no `Created with ZAP`).
- **GHL Custom Value:** exact prod path `upsertCustomValue(yfK7u2subVFh1BJHPSyg, …, "ZAP Lead Magnet URL", magnetHtmlUrl)` → **POST 201, no 401** → **independent GET readback**: CV id `HU0SrCSF1CTqon66z1zR`, `value === magnetHtmlUrl`. Landed in GHL, not just a 200.
- Prior session proved (all 3 static formats): AES-256-GCM PII at rest (`enc:1:` + decrypt roundtrip), emailHash/ipHash, consent + verbatim consentText, dedup, export CSV, delete, retention reaper, honeypot + rate-limit.

**Cleanup:** hvco 5681 + KV pages (`magnet-magnet-5681`, `magnet-get-5681`) + Cloudinary PDF deleted (all 404). **Custom Value LEFT in place per instruction** — its value points at the now-404 `/p/magnet-magnet-5681` by design (proof artifact); the next real kit push to that location overwrites it via PUT-update. `capturedLeads` = 0.

## Decision context (the point of this checkpoint)
- **Quality bar** — from three 2026 high-ticket lead-magnet research reports: 80% actionable tools / 20% teaching; right-size per format (toolkit 3–4 tools, checklist 7–15 items, guide lean); "useful beats comprehensive"; every magnet bridges to the paid offer; minimalist/muted/white-space design as the premium signal (deliberately quieter than the gold-on-black ad register); finishing elements (cover, dividers, page numbers) separate premium from AI-generated.
- **Quiz promoted** deferred → immediate next sprint: interactive formats convert 15–25% vs 2–5% static. Forward-compat already built (`submissionData`/`resultBand` columns; renderer + bridge format-dispatch, quiz→null today) → plugs in with no re-architecture and no re-migration.
- **Locked GHL line held:** ZAP captures leads into its OWN db only; `contacts.write` requested-but-dormant (grep-confirmed no GHL contacts call anywhere). Routing ZAP-captured leads into the customer's GHL nurture is a deliberate future decision, not to be slipped in.
- **GHL tokens do NOT auto-refresh** (~1-day life; refresh_token stored but unused) → any reconnect must be timed close to a push.
- **Two known open gaps (deliberate, neither breaks delivery; both must land before real coaches use this with real clients):**
  1. magnet's `nextStep` CTA links to the magnet page, not the coach's real booking URL → needs **booking-URL capture**.
  2. magnet is **unbranded** (interim) — `coachLogoUrl` brand slot is built and threaded through renderer/publisher/opt-in; **brand-capture** drops the coach's logo straight in (no re-work).

## Queue (in order)
1. **Quiz sprint** (accommodations built; highest conversion lift).
2. **Brand-capture** (coach logo — does the wordmark properly AND unblocks the booking-URL CTA button AND the ad-image logo slot).
3. **Booking-URL capture** (inject real coach booking URL into the nextStep CTA).

## Resume
Re-verify before trusting: HEAD == `dff3dda` == origin, bundle `Bw9-BR6u` (unchanged — server-only), TS 35, vitest 367/367, prod 200, `/api/capture-lead` live (POST `{}` → 400 JSON), PII key set, `capturedLeads` 0. Next work = Quiz sprint (investigate-first). "Verified" = real readback/browser, never paper.
