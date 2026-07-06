# CHECKPOINT 2026-07-07 — Lead-magnet CONTENT generation SHIPPED (Node 5 body)

**HEAD `b0fbc45` on `railway-build` (= origin). Served bundle `index-Bw9-BR6u.js` (unchanged — server-only change). Gates: TS 35, `npx vitest run server/pipeline-fixes.test.ts` 367/367. Prod 200.**

> Dev-env note: prefix git with `DEVELOPER_DIR=/Library/Developer/CommandLineTools`.

## What shipped (commit `b0fbc45`)

Node 5 (hvco) previously produced lead-magnet TITLES only. It now generates the actual deliverable BODY. **Content only** — delivery (file hosting, PDF/multi-page rendering, form→email/GHL wiring, interactive scored quiz) is a deferred follow-on sprint.

- **`server/leadMagnetContentGenerator.ts`** (new)
  - `inferLeadMagnetFormat(title)` → `guide | checklist | toolkit | quiz`. Positive-only signal sets; precedence quiz → toolkit → checklist → guide; **default guide** for ambiguous titles.
  - `generateLeadMagnetContent({userId, serviceId, icpId?, title, formatOverride?})` → structured body via `invokeLLM` + per-format `json_schema`, grounded in offer valueProp/mainBenefit, mechanism, ICP pains/goals/barriers, niche, and the title-as-promise. Quiz reuses the LP `quizSection {question, options, answer}` shape plus scoring bands. **2× internal retry** (a long/complex title can return a thin first pass; retry recovers it). Never throws — returns `null`, leaving `assetBody` unset so the cascade is never broken.
- **`server/_core/orchestration.ts`**
  - Hoisted `CAMPAIGN_TO_PAGE_TYPE` + `pageTypeForCampaign()` to module scope.
  - The `hvco` step generates + stores a body **only when the campaign resolves to `lead_magnet_download`** (i.e. only the `lead_magnet` campaign type). The other six types convert on registration/call/purchase → **no body**. Titles are still generated for all types (hard cascade dependency for headlines/adCopy/LP/email/whatsapp). Imported assets (`source === "imported"`) are respected and never overwritten.
- **`server/lib/placeholderResolver.ts`**
  - `buildResolvedMap` auto-resolves `[INSERT_LEAD_MAGNET_NAME]` from the selected HVCO title (icp → kit `selectedHvcoId` → title). Precedence: a campaign-specific operator value wins; otherwise the auto-title beats a stale account default. Kills the manual operator fill.
  - **Client mirror needed no change**: the in-app resolved map is built from `trpc.placeholders.list` → `Array.from(buildResolvedMap().values())` (`placeholders.ts:44`) — the same function — so in-app preview/download and Meta/GHL/export resolve the name identically. `client/src/v2/lib/resolveTokens.ts` (a pure substitution fn) is unchanged.
- **`drizzle/schema.ts`** — `hvcoTitles.assetBody json` (sparse; only the selected title of a lead_magnet campaign is populated).

## Migration (applied to prod, verified)
`ALTER TABLE hvcoTitles ADD COLUMN assetBody json NULL;` — additive, nullable, zero backfill. Verified: column present, 5677 rows NULL, Drizzle synced.

## Proof (real prod data + real LLM)
- Format inference correct on real titles (Quiz/Scorecard/Audit → quiz, Checklist → checklist, Toolkit → toolkit, Autopsy & no-signal → guide).
- Gating: only `lead_magnet` → `lead_magnet_download` → body; the other six → none.
- Specific, campaign-grounded content for all four formats.
- Storage end-to-end: svc 235 "The LinkedIn Growth Engine" (hvco 4594) → toolkit body persisted and read back from DB (5 real tools).
- Name auto-resolves per-campaign, identically in-app and external (shared `buildResolvedMap`).
- Deployed clean — prod held 200 across the full deploy window.

## Outstanding (verification only, non-blocking)
- Browser proof: run a `lead_magnet` campaign → confirm the generated magnet content appears and `[INSERT_LEAD_MAGNET_NAME]` is consistent in the in-app preview/download and on exports.

## Next sprint — Lead-Magnet DELIVERY (deferred follow-on, NOT started)
Content now exists in `hvcoTitles.assetBody`, but there is **no hosted file and no opt-in→delivery wiring — an opt-in currently delivers nothing.** Investigate-first when started (Arfeen pastes the full prompt):
- Render `assetBody` → a deliverable file: PDF vs hosted HTML (no multi-page document renderer exists yet — new infra either way).
- Hosting / stable URL.
- Opt-in → delivery wiring respecting the **LOCKED GHL architecture**: ZAP pushes Custom Values only; workflows are customer-side snapshot-deployed; ZAP does NOT apply tags.
- Quiz interactivity (scored/playable).
- What's harder than it looks.

## Roadmap (priority tiers)
- **Tier 1 (next):** lead-magnet delivery; landing pages (multi-page + design); trial-user upsell (C0.1).
- **Tier 2 (debt):** start-new-campaign fix; `generateContextualAdHeadlines` ≤38-char flakiness; retire old `V2AdImageCreator` LP-headline picker.
- **Tier 3+:** real 9:16 for the other 3 template styles; LP design refresh; video-quality (built/paused); ZAP Intelligence / performance-loop (flagship, post-launch; Meta official Ads MCP tailwind); over-generation "surface a curated few"; voice/brand capture; batch campaign creation.

## Resume protocol
Load MEMORY.md top + `memory/session_state_2026_07_07_leadmagnet_shipped.md` + this file. Re-verify live before trusting: HEAD `b0fbc45` == origin, bundle `index-Bw9-BR6u.js`, TS 35, vitest 367/367, prod 200. Do NOT push/build on resume — hold for go.

## Known blocker (not urgent)
GHL OAuth token expired 2026-06-08.
