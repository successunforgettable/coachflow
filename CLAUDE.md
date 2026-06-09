# CLAUDE.md — ZAP Campaigns Project Memory

## 1. Project Identity

- **Product:** ZAP Campaigns (zapcampaigns.com) — AI marketing-asset generator for coaches/speakers/consultants
- **Core UX:** 11-node Duolingo-style guided campaign path, 110+ assets per kit
- **Auto Mode vision:** signup -> single-text intake -> cascade -> Campaign Kit ready to push to Meta + GHL
- **Two user types:** blank-slate (ZAP generates all) and existing-assets (ZAP imports offer/ICP/method/lead-magnet as upstream context, fills gaps only)
- **Repo:** github.com/successunforgettable/coachflow
- **Working dir:** /Users/arfeenkhan/zap-deploy

## 2. Deference Rule (compulsory, locked)

- **Product owner:** Arfeen Khan (non-technical) — owns brand/product/scope calls only
- **CC role:** executes all code, owns ALL technical decisions
- **Claude (strategic assistant) role:** framing only; defers all technical calls to CC
- When CC has codebase grounding + HIGH confidence, recommendations are ACCEPTED — not punted back to Arfeen
- **Override trigger:** only if CC proposes a shortcut over the structurally correct path
- **Failure mode to avoid:** listing fix-shape options (H/I/J/K) instead of letting CC investigate and recommend

## 3. Branch + Deployment

- **Production branch:** `railway-build` (NEVER push to `main` during active sprints)
- Railway auto-deploys `railway-build` on push (~2-3 min)
- `server/_core/index.ts` on `railway-build` has W5 hotfixes (validateFontAtBoot + reapStuckJobs) that `main` lacks — naive bulk port from `main` silently deletes production safety
- 7 prompt-quality routers outstanding from `main` require own dedicated sprint, never bulk-merge
- Git convention: atomic single-commit sprints with descriptive conventional-commit messages

## 4. Tech Stack

- **Frontend:** React 19, Tailwind 4, shadcn/ui, Vite
- **Backend:** Express 4, tRPC 11, Drizzle ORM
- **DB:** MySQL/TiDB on Railway
- **AI:** Anthropic Claude API (Sonnet for generation)
- **Storage/media:** Cloudinary, Remotion Lambda (us-east-1)
- **Integrations:** Stripe (live mode), Meta Ads API, GoHighLevel marketplace OAuth (workflows.readonly + locations/customValues.write scopes)

## 5. Architectural Invariants (never reverse)

1. **Duolingo principle** — all interactions within node, never break to separate page
2. **Generate More Show Less** — scoring engine picks single best; "Show Me More" pulls from already-generated batch at no extra cost
3. **Campaign Kit = source of truth** — "Use This & Continue" is the ONLY completion action
4. **Context cascade** — every downstream generator receives upstream selected assets
5. **V1 read-only** — `client/src/pages/` never touched for development; V2 files only
6. **DB migrations isolated** — never bundled with UI work
7. **Inline font styles mandatory** — every text element carries full font stack inline (never relies on CSS inheritance); root cause of all prior renderer failures
8. **Generate full batches always** — token cost negligible; larger pools produce better top selections

## 6. V2 Design System Non-Negotiables

- Inline styles only (className caused renderer failures)
- V2 CSS vars: `--v2-font-heading`, `--v2-font-body`, `--v2-text-color`, `--v2-primary-btn`, `--v2-border-radius-pill`
- Fonts: Fraunces italic 900 (headings), Instrument Sans (body)
- Pill buttons: `borderRadius: 9999`, padding `12px 28px`
- Card radius: 16px (V2 standard), 24px (feature cards)

## 7. Sprint Discipline

- One sprint, one commit, one spot-check
- **Pre-flight investigation** before every implementation prompt — investigation + recommendation only, no code, surface HIGH/MEDIUM/LOW confidence
- Comprehensive single-pass prompts to CC embedding all locked design decisions — no back-and-forth investigation rounds
- Screenshot proof mandatory before sprint approved
- Two-state proof required for persistence features (active + post-refresh)
- Screenshots come from Arfeen's browser (zapcampaigns.com) — CC never fabricates screenshots or Railway logs

## 8. Test Gates

- **Type-check baseline:** 53 errors (`npx tsc --noEmit 2>&1 | grep -c "error TS"`) — must not regress
- **Test suite:** `npx vitest run server/pipeline-fixes.test.ts` — report pass count (251 as of June 4, 2026)
- Never use global vitest output (dominated by pre-existing infrastructure failures)
- Verify-before-commit: TS baseline holds, vitest passes, atomic commits
- Hold pushes for go-ahead unless explicitly authorized

## 9. SQL Safety Scan

Before any cross-table SQL on first-touch tables, check Drizzle schema for three failure classes:

1. **snake_case DB column overrides** where DB col != JS key (e.g., `jobs.created_at`, `idealCustomerProfiles.angle_name`) — alias as needed
2. **MySQL reserved-word column names** requiring backticks (e.g., `idealCustomerProfiles.values`)
3. **Generation-time parameters that aren't actual columns** (e.g., `whatsappSequences.sequenceLength` — count lives in `JSON_LENGTH(messages)`)

Always audit `INFORMATION_SCHEMA` before assuming Drizzle key == DB column. Committing `drizzle/*.sql` != applied; verify migrations match DB shape via direct query.

## 10. DB + Log Access Pattern

- CC runs read-only DB queries + Railway log fetches directly via `railway run --environment production --service coachflow sh -c '... mysql ...'` (DATABASE_URL injected, no password exposure)
- ALL prod-table writes — including schema-only ALTERs and migrations — route through Arfeen for go-ahead BEFORE execution. No exceptions for "low-risk" or "done it before." This applies to any `ALTER TABLE`, `INSERT`, `UPDATE`, `DELETE`, or migration SQL run against the production database.
- DB-first investigation: inspect DB type/structure (JSON_TYPE, JSON_KEYS) BEFORE proposing code-side mechanisms

## 11. GHL Deployment Architecture (locked)

- Workflows live in customer's own GHL via snapshot import, not on ZAP servers
- ZAP push only writes Custom Values via `locations/customValues.write` endpoint
- **Snapshot apply CANNOT be automated** — GHL v2 marketplace OAuth lacks `workflows.write` scope; Location tokens get 401 on `/snapshots/*`
- Customer's agency admin must manually click "Apply ZAP Master Snapshot" deep-link button in GHL's UI; one-time per location
- `GHL_MASTER_SNAPSHOT_ID` env var holds the snapshot ID
- **Tagging is customer-side responsibility** (decided May 27, 2026): push writes CVs only, never applies tags to contacts. Tag patterns: `zap-{workflow-name}` (email), `zap-wa-{workflow-name}` (WhatsApp). Customer wires their own funnel entry to apply the right tag.
- 16 canonical workflow names hardcoded in `server/routers/ghl.ts` `ZAP_WORKFLOW_NAMES` constant
- **Status detection** (shipped June 4): case-insensitive prefix `/^zap[\s-]/i` + 75% threshold (12/16). Green pill (installed), amber (partial), red + hard gate on Push to GHL (missing)

## 12. Key Accounts + IDs

- Arfeen: arfeen@arfeenkhan.com (Pro + Admin)
- Reviewer: zapreviewer@mailinator.com (Pro until 2027-04-09)
- Meta App ID: 1812711376090686
- GHL Marketplace app: 69af3395095745d484bc1b18 (APPROVED)
- GHL master location: yfK7u2subVFh1BJHPSyg
- Cloudinary: dunshei0y

## 13. Communication with Arfeen

- Terse, single concrete recommendation — never option menus
- Lead with next action; don't ask "what do you want to do"
- No rest/sleep/break suggestions — frame session breaks only in work logistics terms ("fresh head for spot-check"), never wellbeing or time of day
- Step-by-step click-by-click instructions for UI tests (he finds the UI confusing)
- Plain-text single-block prompts; no nested code blocks inside CC prompts

## 14. LLM Prompt-Writing Discipline

- Negative examples in system prompts are dangerous for Anthropic models — positive-only framing is the correct pattern
- Root cause of Sprint B email regression (May 2026): showing failure shape as "Wrong:" primed the model to emit it
- Stick to concrete-shape directives describing what the output IS

## 15. Marketing Content Default

- For ALL wire sprints, design decisions, content audits, copy reviews: authorize researching the marketingskills repo (github.com/mysticaltech/marketingskills.git) + web as the PRIMARY industry-grounded reference frame, BY DEFAULT without Arfeen prompting
- Fall back to general principles only where the repo doesn't cover the asset type
