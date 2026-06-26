# Session Checkpoint — 2026-06-27

## THE ONE BLOCKER (start here)

Commit `d94bdc1` (import-then-enrich sprint) is correct in the repo but **NOT actually deployed** — Railway is running stale server code (container started 4h before the commit was pushed; no `[icpEnrichment]` logs ever fired; ICP 220 / kit 160 has the same 4-of-17 thin pattern as pre-fix). Same stale-deploy issue hit the client bundle too.

**First action:** Force a genuinely clean Railway rebuild (clear build cache or dummy-commit to bust it) so both server AND client compile fresh from `railway-build` HEAD, not cached `dist/` artifacts.

**Then prove it's live with hard evidence, not "redeploy ran":**

1. Confirm running server is on `d94bdc1`+
2. Run a fresh has-assets import and confirm `[icpEnrichment]` log lines actually fire in production logs
3. DB-read the resulting ICP and confirm all 17 fields populated (`fears`/`objections`/`buyingTriggers`/`psychographics`/`communicationStyle` no longer NULL) — and that the generated content is anchored to crypto beginners, not experienced-trader drift
4. Confirm client bundle hash changed (was `index-tEZHt2a1.js`) and plain-language gate + working PDF button are live

## WHAT'S BUILT (in repo, on railway-build, commit d94bdc1, NOT verified-live)

- **ICP enrichment** (`server/_core/icpEnrichment.ts`) — `enrichImportedIcp(icpId)`, 17-tab generator seeded with user content as ground truth, NULL-only write protection (user's provided fields never overwritten). Blocking `await` in `importIcp` (`server/routers/autoMode.ts` ~lines 335-347).
- **Offer enrichment** — missing free + dollar angles generated from imported godfather (background, `autoMode.ts` offer import section).
- **PPTX parsing** — `officeparser` library added, PPTX MIME in extract-documents endpoint.
- **Image reading** — Anthropic vision API: `llm.ts` multimodal fix (25 lines, ImageContent → native Anthropic `source: { type: "base64" }` format), images accepted in extract-documents, passed through to `extractFromAssets`.
- **Ad-creatives ICP wiring** — `icpPains`/`icpFears`/`icpObjections`/`icpBuyingTriggers` wired into headline prompt (`adCreativesGenerator.ts` type + prompt, `orchestration.ts` ICP row lookup + pass-through).
- **ICP PDF download** — `downloadPdf(formatIcpTxt(data))` wired into button in `V2ICPResultPanel.tsx` (replaced Phase L toast).
- **Plain-language gate** — explanation beat + "I have stuff like that" / "Actually, build it for me" self-selection in `V2TrailIntake.tsx` (before upload/paste choice in has-assets flow).
- **Gates at build time:** TS 36, vitest 356/356.

## WHAT WE LEARNED THIS SESSION

- The import path was discarding rich input — Arfeen's 38-page SMB doc produced only a 4-5 field ICP. Root cause: `importIcp` saves only `name`/`pains`/`goals`/`implementationBarriers`/`demographics`; the other 12 tabs left NULL. Code comment at line 289 calls this "acceptable v1 tradeoff." Source content quality is excellent (confirmed from DB reads); the problem was never the input.
- The "import-then-enrich" design (CC's counter-proposal) was chosen over building a new conversational intake flow — keep existing has-assets flow exactly as-is, auto-enrich after import. Simpler, no new UI, reuses the proven 17-tab generator.
- DB-read caught that enrichment never deployed despite a "deployed and healthy" report. Standing lesson reaffirmed: **"deployed" = running commit + firing logs + real output, never a redeploy-ran report.**
- Ad-creative headlines for kit 160 are BETTER than kit 159 (beginner-specific vs experienced-trader) — improvement came from richer `pressingProblem` field in service profile, not from the ICP wiring (which wasn't deployed). Once ICP wiring deploys, headlines should improve further.

## KNOWN OPEN BUGS (after deploy verified)

1. **Scroll/nav bug on completed-campaign view** (trail/160): clicking ICP node won't scroll to full ICP content; other nodes won't navigate. Root cause: `handleStopClick` (~line 1862 in V2Trail.tsx) calls `scrollIntoView` on `nodeRefMap` element — but the ref is missing (transcript truncated/deduped) or the content is in an unopened progressive-disclosure panel. Cleanup priority — after enrichment is verified live.
2. **Confirmation card shows pre-enrichment thin extraction** — minor UX confusion; the confirm card shows the extracted summary but the actual ICP is enriched after confirm. Note for later.

## TEST ARTIFACTS

- **Arfeen's source doc:** 38-page SMB ("Secret Millionaire Blueprint") PDF — the canonical test input
- **ICP fidelity check:** Must come out rich AND faithful to crypto beginners (new, jargon-intimidated, scam-fearful), not experienced traders
- **Existing thin ICPs for reference:** ICP 219 (kit 159), ICP 220 (kit 160) — both 4/17, pre-fix pattern

## PAUSED TRACK (do not lose, do not touch)

- **Landing-page template system:** Sprint 1 (commit `324b092`), image-slot Sprint A (commit `4ccf4a9`, migration `0082` applied). PAUSED with real progress, resumes after ICP foundation fix is verified live.
- **Decision locked:** Light/face-forward templates are the bar (not Kong dark), reference pages mapped per campaign type from SwipePages analysis.
- Fixing ICP richness directly improves this track — templates will render rich content instead of thin.

## RESUME SEQUENCE

1. Force clean Railway rebuild of `d94bdc1` (bust cache)
2. Prove it's live (running commit + `[icpEnrichment]` logs firing + DB field-count + client bundle hash)
3. Arfeen re-runs the SMB-doc has-assets test; confirm enriched ICP is rich (17/17) and faithful (beginners)
4. Verify ad headlines improve from the now-deployed ICP wiring
5. Scroll/nav bug cleanup
6. Resume landing-page template track

## COMMIT STACK (railway-build)

```
d94bdc1 feat: import-then-enrich (ICP enrichment, offer angles, PPTX+image, ad-creatives ICP, PDF, gate)
4ccf4a9 feat: image-slot system Sprint A (upload endpoint restored, per-LP scoping, migration 0082 applied)
324b092 feat: landing page template system Sprint 1 (Energetic, renderTemplate, guarantee+FAQ+suppress-proof)
0952f62 fix: deduplicate trail transcript (B6)
```

## STANDING RULES

- ALL prod-table writes need Arfeen's explicit "execute"
- TS floor: 36. Vitest: 356/356.
- `railway-build` IS prod — never push to `main`
- "Verified" = real run / real browser click / real DB read, never paper-only
- Investigate-and-propose before building
- Positive-only prompt framing (no "Wrong:/Right:" examples)
