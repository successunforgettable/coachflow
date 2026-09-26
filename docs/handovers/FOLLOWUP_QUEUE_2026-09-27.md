# Queued after Arfeen's walkthrough — 2026-09-27 (nothing here is built)

## A. One small follow-up deploy — "status that agrees with itself"
Found at R4.4 check 3 on campaign 225. Both pre-existing; neither was changed by the first deploy.
1. **The Trail bar and chat header read readiness.** Today a stop shows pending only when
   `nodeStatuses.status = 'needs_publish'` (`V2Trail.tsx` `stops` memo). LP 241's address was cleared by the 2026-09-02
   takedown without setting the flag, so the bar ticks Landing Page and says "11 of 11 complete" while readiness says
   unpublished. Fix: landing page is pending when readiness has a `not_published` blocker; the header counts from the
   same stops. Tests + deliberate breaks + screenshot.
2. **Old saved completion banners are hidden when the campaign is not ready.** Transcripts written before 2026-09-27
   carry "CAMPAIGN COMPLETE — 11 of 11 — every piece built and accounted for" + "Done. Eleven pieces…" (kit 225:
   messages 72–73 of 75, written 2026-08-30). A returning coach reads them as the current status. Fix: at render time,
   when readiness is not `ready`, skip those saved messages. Display only; no transcript row is written or deleted.
3. **Takedowns set the "needs publishing" flag.** Any path that clears a page's `publicUrl` (the 2026-09-02 takedown
   did it by hand) also records `needs_publish` for the owning kit, so no surface can call a removed page live.
   §15l family.

Also noted (not queued, needs a decision): GHL token renewal logs nothing on success (`server/_core/ghlToken.ts` has no
log line), so "did it renew?" can only be answered from the row's `updatedAt`/`tokenExpiresAt`. Suggest one log line.
And: the Tool Library is unreachable since `b2404b1` (2026-06-19) — `V2ToolLibrary` imported, never mounted;
`V2Dashboard.handleNodeClick` defined, never called (§15d). Standalone generators live only at typed URLs.

## B. Known open issue — "twelve years of professional expertise" (campaign 225)
Arfeen spotted it in the Method and the bonus copy. Traced read-only 2026-09-27:
- **Source:** service 318's own fields describe ONE example client, not the coach — `failedSolutions` "…not for
  someone with 12 years of corporate HR expertise…", `painPoints` "…what I did in HR for 12 years…".
- **Method (mechanism 1271, `mechanismDescription`)** generalises it to every reader: "…help people with twelve years
  of professional expertise identify which part of that expertise is a sellable consulting…". A specific figure
  asserted about the whole audience — not supplied as such.
- **Bonus 44 (`assetBody`)** uses it as a sample inside a fill-in line ("e.g., 'twelve years in financial services
  regulation'") — an example the coach replaces, lower risk, but it still reads as the product's voice.
- **Linked grounding work:** `SPRINT2_GROUNDING_CHECKER_2026-09-16.md` (F2 speaker facts, F5 viewer financial
  information — record-only, no production caller), `CHECKPOINT_2026-09-22_F5_HOOK_AND_SPRINT4.md` (K9, D-g),
  `FABRICATION_EXPOSURE_AUDIT_2026-07-28.md`, CLAUDE.md §15k (a reader-subject specific must trace or be flagged).
  Neither F2 (the coach's claims about themself) nor F5 (money) covers a numeric claim about the reader's background —
  this is the missing class.

## C. Decisions and later deploys
- **Pro caps** (decision 1) — `PRO_CAPS_AND_CAMPAIGN_COST_2026-09-27.md`.
- **The 8 trial decisions** — `TRIAL_MARCH_DESIGN_VS_CODE_2026-09-27.md` §5c.
- **Second deploy — the trial group:** `git revert 49c0d17` on the held branch (expect a `V2Trail.tsx` conflict from
  `32785ee`), re-run the trial suites, plus the Pro-caps and trial decisions.
