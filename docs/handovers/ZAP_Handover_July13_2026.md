# ZAP Handover — 2026-07-13

## State at handoff
- **HEAD = origin/railway-build = `a8242a2`.** Working tree clean (no tracked uncommitted changes; only pre-existing throwaway screenshots remain untracked — do NOT sweep).
- **Gates:** TS floor **35**; vitest **403** (`server/pipeline-fixes.test.ts` 382 + `imageSlots` 16 + `deckCards` 3 + `placeholderLabels` 2).
- **Served bundle:** `index-BFSq2I4L.js`.
- Dev-env: git prefix `DEVELOPER_DIR=/Library/Developer/CommandLineTools`; prod harness `railway run --environment production --service coachflow npx tsx <file>`.

## Shipped this session

### Deck skipped-null fix (LIVE)
Manual node-by-node deck now renders EXISTING content on resume / "Show me new options" instead of an empty deck (was: `orchestrateStep` returns `generatedId:null` on already-populated nodes → NaN → 0 cards). Fix: `resolveDeckSourceId(generatedId, kit[field])` fallback at both deck call sites; re-deal keeps the current set on a skip instead of blanking. Live-proven — served bundle contains "showing your current options".

### Burchard Productivity lead-magnet template — COMPLETE at template level (through `475b528`)
`server/lib/templates/burchardProductivity.ts` — bespoke per-reference replication of `docs/landing-page-references/lead_magnet_download--brendon-burchard--productivity-sheet.png` (canonical frozen reference, 4480×4202, from growthday.com/pdf). All three gates judged live (real builder output, headless at 2240px CSS) against the report's PASS/TUNE/REWORK crops:
- **Gate-1 hero** (y 0–1110): headline + orange magnet-name emphasis, sub, 5-star + NON-numeric trust line, email form, orange CTA, ZAP-composed creator/product card (route b: `headshot` + `value_stack` + chrome eyebrow/title/FREE badge). **PASS.**
- **Gate-2 bands + testimonials** (y 1141–2108): 3 charcoal bands (orange check + keyword) from `consultationOutline`; 2 testimonials from `content.testimonials` (real-or-nothing; initials monogram, no fabricated face). **PASS.**
- **Gate-3 cream** (y 2108–4202): chrome heading, 2×4 tile grid from `featureHighlights`, orange-bordered CTA card, navy footer (brand + placeholder legal links). **PASS.**
- **Whole-page pass** (`475b528`): spacing pass closed an 11%→6% vertical-rhythm gap.

Additive generator changes (`lead_magnet_download` block ONLY): `consultationOutline` populated with 3 benefit items; new optional `featureHighlights?: string[]` (up to 8 qualitative NON-numeric feature lines — no invented stats). Other page types and other fields untouched.

### Publish wiring — SHIPPED (`a8242a2`)
Route-by-pageType + one additive enum value + family sweep:
- `orchestration.ts`: `lead_magnet_download` campaigns publish with `styleMode "lead_magnet_burchard"`; all other page types keep their existing path.
- `landingPagePublisher.ts` AND `complianceRewrites.ts`: BOTH get an identical branch → shared `server/lib/templates/leadMagnetPublish.ts` `renderBurchardLeadMagnet` (single source of truth; resolves `headshot`/`value_stack`→`productCoverUrl`/`logo` slots + `leadMagnetName` from `hvcoTitles.title`; `trustCount` null). Existing text/visual/energetic/stub branches unchanged.
- `schema.ts`: `publishedStyle` enum + `lead_magnet_burchard` (additive).

### Prod migration 0084 — APPLIED + verified
`ALTER TABLE landingPages MODIFY publishedStyle ENUM('text','visual','lead_magnet_burchard') DEFAULT 'text'`. Read-first guard confirmed BEFORE = `('text','visual')`, in-use = text(51)/visual(25), no offenders → applied → AFTER = `('text','visual','lead_magnet_burchard')`. Zero data loss.
**Migration 0081 is SUPERSEDED — must NOT be applied** (would re-enable the old rejected energetic/stub designs across every LP). Marked superseded in its header.

## 🔴 THE OPEN ITEM — next session starts HERE (fix BEFORE live proof)

**Blank-slate composite gap — NOT yet fixed. Arfeen decided: fix now.**

`compositeCard` in `burchardProductivity.ts` still renders **FAKE stand-ins in the PRODUCTION path**:
- empty `value_stack` (`productCoverUrl`) → a fabricated pink-lined white "sheet" div.
- empty `headshot` → a gray SVG person silhouette.

These were built for the gate render but live in the real render path. A **blank-slate / Auto-Mode coach** (nothing to upload, nothing to import) would **publish a page showing these fakes** — an honesty problem AND an unfinished look. `value_stack` is **coach-supplied only** today (upload UI or Has-Assets import); **no magnet-cover generation exists** anywhere (Flux/Replicate are ad-images only).

**The fix is a two-piece sprint — CC must investigate-and-PROPOSE both before building:**
1. **Auto-derive the real magnet cover** from the EXISTING `magnetPdfUrl` (the lead-magnet delivery already renders the magnet to a PDF via Cloudflare Browser Rendering → Cloudinary, persisted on `hvcoTitles`). Cloudinary can render PDF page-1 → image → feed it into the `value_stack`/`productCoverUrl` path. **Fallback order: coach-uploaded → PDF-derived → graceful empty-state.**
2. **Replace the fake stand-ins with genuinely graceful empty-states** — no fabricated artifacts posing as real content — removed from the production path.

**Next action: CC proposes both pieces before building.**

## Live proof — STILL PENDING (do AFTER the gap fix)
The wiring's true "verified live" proof is a **published lead_magnet page rendering Burchard**. Triggering it is a **separate prod-table write** (`runLandingPagePublish` UPDATEs `landingPages`) → needs its own explicit **"execute"**. Do it via a **real blank-slate `lead_magnet` publish in Arfeen's browser** (natural flow, real slots + cascade) — NOT a synthetic re-publish. Confirm: Burchard renders at `/p/{slug}`, energetic design ABSENT, DB `publishedStyle = lead_magnet_burchard`, compliance re-render correct.

## Verification discipline that governed this build (carry forward)
- **Prove live, not by structure.** Committed ≠ applied ≠ deployed ≠ rendered.
- **Prod writes gated on Arfeen's explicit "execute"** in the immediately-preceding message (CLAUDE.md §10). Migration 0084 was executed under that gate; the publish-proof write is not yet authorized.
- **Fix the family, not the leaf** (publisher + complianceRewrites both route Burchard).
- **No fabrication** — trust counts, testimonials, and magnet covers must be real coach/magnet data or a graceful/non-numeric empty-state; never invented.

## Not fixed (out of scope, carried)
Non-lead_magnet page types still route to `energetic` (broken on prod, pre-existing); 47 orphaned NULL-publicSlug LPs — separate per-reference-template + backfill tracks. The other four reference templates (webinar/event/sales/discovery) are not built yet.
