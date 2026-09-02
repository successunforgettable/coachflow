# Campaign Trail Spec v1.2 — Pre-Flight Gap Report

**Date:** 2026-06-11
**Baseline:** HEAD `3eb1557` on `railway-build`, deployed and verified live.
**Method:** Every spec assumption checked against real code. No guessing.

---

## 1. THEME TOKENS — PASS (with gaps)

**File:** `client/src/v2/v2-theme.css` (scoped to `[data-v2]`)

**Actual tokens:**
| Token | Value |
|-------|-------|
| `--v2-bg-color` | `#F5F1EA` |
| `--v2-text-color` | `#1A1624` |
| `--v2-primary-btn` | `#FF5B1D` (brand primary / orange) |
| `--v2-accent-purple` | `#8B5CF6` |
| `--v2-border-radius-card` | `24px` |
| `--v2-border-radius-pill` | `9999px` |
| `--v2-font-heading` | `Fraunces, Georgia, serif` |
| `--v2-font-body` | `Instrument Sans, system-ui, sans-serif` |
| `--v2-error` | `#C0390A` |
| `--v2-shadow-card` | `0 2px 16px 0 rgba(26,22,36,0.08)` |
| `--v2-shadow-btn` | `0 4px 14px 0 rgba(255,91,29,0.30)` |
| `--v2-space-xs` through `--v2-space-2xl` | 4px to 64px scale |

**What the spec needs but doesn't exist:**
- `trail-active` — spec says "read from theme" = `--v2-primary-btn` (`#FF5B1D`). PASS.
- `trail-pending` — spec says "neutral-300 equivalent." No neutral scale exists. **GAP.** Must define (e.g. `#D1D5DB`).
- `trail-stale` / amber-500 — no amber token. **GAP.** Must add `#F59E0B`.
- `crown-gold` — not present. **GAP.** Must add `#EAB308`.
- `celebrate-spark` — not present. **GAP.** Must derive lighter tint of `#FF5B1D`.
- `compliance-green` / success green — no success/green token anywhere. **GAP.** Must add.

**Verdict:** The token file exists and is well-structured. 5 new colour tokens needed — trivial additions to the existing `[data-v2]` block.

---

## 2. HOMEPAGE CHAT INTAKE — CONFLICT

**File:** `client/src/components/AIChatBox.tsx`

**What exists:** A generic reusable chat box component with:
- Message list rendering (system/user/assistant roles)
- Markdown rendering via `Streamdown` library
- Auto-scroll to newest message
- Loading states with spinner
- Suggested prompts in empty state
- Props: `messages`, `onSendMessage`, `isLoading`, `placeholder`, `suggestedPrompts`, `height`, `className`
- Uses shadcn `ScrollArea`, `Textarea`, `Button`
- Uses `className`-based styling (shadcn `cn()` utility)

**Conflicts with spec:**
1. **Styling approach:** AIChatBox uses `className` + shadcn. The V2 design system mandates inline styles only (CLAUDE.md rule). The spec's ChatThread must use inline styles. AIChatBox cannot be used as-is.
2. **No conversation logic:** AIChatBox is a dumb renderer — no chat flow orchestration, no chip rows, no asset reveals, no card decks. All spec message types (zappy-bubble, chip-row, asset-reveal-card, card-deck, milestone-badge, system-divider) are net-new.
3. **No state management for conversation flow:** The component takes `messages[]` from outside. The spec needs a stateful chat orchestrator that sequences beats, manages chip responses, triggers generation, handles reveals.
4. **Tone reusable?** The conversational UX pattern (scrolling chat, input at bottom) is proven and the `Streamdown` markdown renderer could be reused. But the component itself needs a full rebuild for the spec's requirements.

**Verdict:** The concept is validated (chat UI exists and works), but ChatThread must be built from scratch using inline styles and the V2 design system. AIChatBox is a reference, not a base.

---

## 3. CURRENT SELECTION MECHANISM — PASS (critical, well-mapped)

This is the most important finding. The spec's `selected_option_id` concept **already exists** — it's the `selected*Id` columns on `campaignKits`.

### 3a. Where auto-pick happens

**File:** `client/src/v2/V2GeneratorWizard.tsx`, lines 1598-1639 (`persistSelection`)

For every node, after generation, the client calls `persistSelection` which always picks `[0]` (first item):
- Line 1606: `selectedOfferId = data.id`
- Line 1609: `selectedMechanismId = first mechanism row`
- Line 1613: `selectedHvcoId = first HVCO title row`
- Line 1618: `selectedHeadlineId = allHeadlines[0]?.id`
- Line 1623: `selectedAdCopyId = firstAd?.id`
- Line 1626-1630: landing page, email, whatsapp — direct ID

Called after each generation at lines 2104, 2137, 2153, 2182, 2217, 2261, 2318, 2369.

### 3b. How the backend reads selections

**File:** `server/_core/cascadeContext.ts`

`UPSTREAM` map (lines 85-94) defines cascade order. `CASCADE_NODE_TO_KIT_FIELD` (lines 101-110) maps node name to `selected*Id` column. `describeUpstream()` (lines 374-404) reads each `selected*Id` from the `campaignKits` row and fetches the full asset to build the LLM context prompt.

**BUG FOUND:** Line 110: `whatsapp: "selectedEmailSequenceId"` — this maps WhatsApp to the EMAIL sequence ID field, not `selectedWhatsAppSequenceId`. This means WhatsApp generation's upstream context for "email" reads the correct field by accident (email IS an upstream of whatsapp), but if the code ever tries to validate "does whatsapp have its own selection," it would check the wrong field. Low-impact today but a latent bug.

### 3c. Favourites

**File:** `client/src/v2/hooks/useFavourites.ts` + `server/routers/favourites.ts`
**Table:** `favourites` (schema.ts lines 1331-1340)
- Stores `(userId, nodeId, itemIndex)` — index-based, NOT entity ID
- Completely separate from cascade selection
- Persists across refresh (DB-backed)
- No cascade effect whatsoever

### 3d. What `selected_option_id` means for the build

The spec's `selected_option_id` = the existing `selected*Id` fields. They already:
- Persist server-side
- Feed the cascade via `describeUpstream()`
- Are written by `persistSelection()` (currently always `[0]`)

**What the spec ACTUALLY changes:**
1. Make the auto-pick of `[0]` **visible** (crown on card #1) — pure UI
2. Allow the user to **re-crown** (change which ID is in `selected*Id`) — needs a mutation call with the new ID, which `updateSelection` already supports
3. Add **stale detection** when a re-crown happens after downstream nodes are done — net-new logic
4. Persist the **chat transcript** — net-new table

**No schema migration needed for selection itself.** The existing `selected*Id` columns ARE `selected_option_id`. The spec's language suggests a new concept, but it maps 1:1 to what exists.

---

## 4. COMPLIANCE SIGNAL — CONFLICT

**Files:** `server/lib/complianceChecker.ts`, `server/routers/complianceRewrites.ts`

**What the engine actually returns:**
- `ComplianceResult`: `{ compliant: boolean, score: number (0-100), issues: ComplianceIssue[], suggestions: string[], version, lastUpdated, nextReviewDue }`
- Score = 100 minus deductions (-20 per critical, -8 per warning)
- `compliant` = true when score >= 70 AND zero critical violations

**Per-asset, not per-node.** Each headline and ad copy row gets its own `complianceScore` column. Not all node types are checked — only headlines, ad copy (headline/body/link), and landing pages.

**Final-only, not streamed.** `checkCompliance()` runs after generation completes and returns the full result synchronously. No partial/streaming compliance signal exists.

**Spec conflict:** The ComplianceDial (spec 3.6) assumes a real-time climbing signal during generation. Since compliance is final-only, the dial CANNOT reflect real compliance progress. The spec's own honesty rule acknowledges this: "If the engine returns a final score only (no streaming), the dial behaves as a progress indicator (climbing, capped at 90) and snaps to the REAL returned score at reveal." This is the correct implementation path — the dial is decorative during generation and honest at reveal.

**Additional conflict:** Not all nodes have compliance scores. Offer, Mechanism, HVCO, Email, WhatsApp have NO compliance checking. The ComplianceDial should only appear on nodes that actually get checked (headlines, ad copy, landing pages, ad creatives). The spec shows it on every node — that would require either faking it (violates honesty rule) or extending compliance to all node types (spec says don't touch the backend engine).

**Verdict:** Wire the dial to real `complianceScore` on the 3-4 nodes that have it. Show no dial on nodes without compliance. The spec must be narrowed here.

---

## 5. STREAMING — GAP

**File:** `server/_core/llm.ts`

`invokeLLM()` (line 515) and `invokeClaudeAPI()` (line 244) are **batch-only**. They call the Anthropic API with `stream: false` (default), wait for the complete response, and return `InvokeResult` as a single object. No SSE, no EventSource, no streaming endpoint exists anywhere in the server.

**Impact on spec:**
- Section 3.8 GenerationNarrator line 3 ("a REAL fragment from the generating output when the API streams partials") — **not possible.** Must use the templated tease from the copy library instead.
- Section 8.3 ("Stream partials wherever the API supports it: headlines/options are dealt as they arrive") — **not possible.** Must use the spec's own fallback: "Where streaming is unavailable, the dealt-card animation simulates progressive arrival from the completed batch."
- Both fallbacks are already specified in the spec, so this is a known gap with a designed solution.

**Verdict:** No streaming. Use the spec's fallback paths (templated teases, simulated dealing from completed batch). Adding streaming would require a new SSE transport layer — out of scope for the experience rebuild.

---

## 6. ANALYTICS — PASS (two layers exist)

**Layer 1: `analytics_events` table** (schema.ts line 693)
- Post-campaign performance tracking: email_open, email_click, link_click, conversion, purchase
- Router: `server/routers/analytics.ts` with `trackEvent`, `getCampaignMetrics`, `getOverallMetrics`, `calculateROI`
- This tracks OUTCOMES, not funnel behaviour

**Layer 2: `product_events` table** (schema.ts line 1345)
- In-app behaviour: `user_generated`, `user_upgraded`, `node_completed`
- `server/lib/productEvents.ts` — simple `trackEvent(userId, eventType, metadata)` fire-and-forget
- Already called after generation and node completion

**What the spec needs (Section 14):** Funnel events (intake_started, path_chosen, node_revealed, option_recrowned, campaign_completed, etc.). These are a different category — user journey events, not generation counts or post-campaign metrics.

**Verdict:** The `product_events` table and `trackEvent()` helper are the right place. The table schema (userId, eventType, metadata JSON) can hold any event shape. No new table needed — just fire new event types through the existing `trackEvent()`. The spec's "simple events table if none exists" is satisfied by `product_events`.

---

## 7. WIZARD SURFACE — PASS (fully mapped)

### Route
`/v2-dashboard/wizard/:step` — defined in `client/src/App.tsx` line 142.

### Components
- `client/src/v2/V2GeneratorWizardPage.tsx` (59 lines) — page wrapper, reads `?serviceId=` param
- `client/src/v2/V2GeneratorWizard.tsx` (3,075 lines) — the monolith wizard component

### Valid steps
campaignType, service, icp, offer, uniqueMethod, freeOptIn, headlines, adCopy, landingPage, emailSequence, whatsappSequence, pushToMeta

### Skip-node feature
- Table: `nodeSkips` (schema.ts lines 1362-1372) — `(userId, serviceId, nodeType)` unique constraint
- Router: `server/routers/nodeSkips.ts` — `skip` mutation + `getSkippedNodes` query
- Used in V2Dashboard.tsx to hide skipped nodes from the path UI

### Advanced Edit AI Inputs
- Defined in V2GeneratorWizard.tsx lines 152-217 (`ADVANCED_FIELDS`)
- Only wired for: ICP (name), Offer (offerType), Unique Method (application, descriptor), Free Opt-In (hvcoTopic)
- Headlines through WhatsApp have empty arrays — no advanced inputs
- Renders as an accordion toggle (line 3001), gated on `advancedFields.length > 0`

### Double Continue button bug
- **Confirmed** at `client/src/v2/V2UniqueMethodResultPanel.tsx` lines 199-220
- Purple `#8B5CF6` button absolutely positioned top-right, appears alongside the green SuccessState button
- The spec correctly notes this dies with the wizard replacement

### Start New Campaign flow
- `V2Dashboard.tsx` lines 291-304: `handleStartNewCampaign()` creates an empty `Service` via tRPC, then navigates to `/v2-dashboard/wizard/service?serviceId={id}`

### In-flight campaign state shape
- `campaigns` table: id, userId, serviceId, name, campaignType, status (draft/active/paused/completed)
- `campaignKits` table: id, userId, icpId, name, status (draft/complete/exported), 9 `selected*Id` fields, campaignType
- No `path` field (auto/manual/has_assets) — **GAP** for spec Section 10.4
- No `chat_transcript` field/table — **GAP** for spec Section 10.5

---

## 8. BILLING — PASS (quota-based, not credit-based)

**Files:** `server/quotaLimits.ts`, `server/lib/quotaEnforcement.ts`

**Model:** Per-generator quota counts, not transferable credits. Each generator has a limit per subscription tier:
- **Trial:** Most generators capped at 2 (headlines/hvco unlimited)
- **Pro:** 50 per generator (adCopy: 100)
- **Agency:** 999 (effectively unlimited)
- **Superuser:** Infinity

Enforcement: `enforceQuota()` called at the top of every generate procedure. Incremented after successful generation via `incrementQuotaCount()`.

**Spec Section 16 says:** "If any generation action consumes credits/quota, the cost must be visible ON the action chip itself." Since generation IS metered by quota, the "Deal 5 more" chip in Manual Mode should show remaining quota, and the system should surface when a user is near their limit.

**Verdict:** Billing section is ACTIVE — quota visibility should be built. But it's quota counts, not transferable credits, so the UX is simpler: show remaining generations for the current node type, not a universal balance.

---

## WRONG/UNBUILDABLE SPEC ASSUMPTIONS

1. **ComplianceDial on every node** (3.6, 5.1) — Only headlines, ad copy, and landing pages have compliance scores. Showing a dial on Offer/Mechanism/HVCO/Email/WhatsApp would violate the honesty rule. Must limit to scored nodes only.

2. **Streaming fragments in narration** (3.8 line 3, 8.3) — No streaming API exists. Must use templated teases and simulated dealing exclusively. The spec already has fallbacks for this.

3. **`selected_option_id` as a new field** (10.1) — Not needed. The existing 9 `selected*Id` columns on `campaignKits` already serve this exact purpose. No schema migration required for selection — just UI to make the existing auto-pick visible and changeable.

4. **`node_status` enum gains imported/stale** (10.3) — No `node_status` field exists anywhere. Node completion is currently inferred from whether a `selected*Id` is populated. Adding imported/stale requires either a new field per node on `campaignKits` or a new `node_statuses` table. This IS a real schema addition.

5. **`campaign.path` enum** (10.4) — No `path` column exists on `campaigns` or `campaignKits`. Must be added.

6. **Chat transcript persistence** (10.5) — No infrastructure for this. Net-new table needed.

7. **AIChatBox reusable for ChatThread** (Ground Rule 3) — Cannot be reused directly due to className styling vs inline-styles mandate. Reference only.

8. **Multi-ICP Clone** (Section 15) — `parent_campaign_id` doesn't exist. Net-new field + clone logic. Feasible but significant.

9. **Campaign streak + badges** (9) — No streak/badge system exists. Net-new.

10. **CASCADE_NODE_TO_KIT_FIELD bug** — `whatsapp` maps to `selectedEmailSequenceId` instead of `selectedWhatsAppSequenceId` at cascadeContext.ts line 110. Not caused by the spec, but the Trail build would expose it if stale detection reads this mapping.

---

## SPRINT 1 TRUE SIZE ASSESSMENT

Spec Sprint 1 scope: ChatThread, TrailBar (all states + mobile), Zappy avatar motion, persistence endpoints (Section 10), baseline analytics on old wizard.

**What's actually net-new:**
- ChatThread component — full build (no reusable base), 7 message types, auto-scroll with pause detection, chip interaction logic
- TrailBar — full build, 5 stop states, mobile collapse to bottom-sheet, tap-to-scroll-back
- Zappy avatar — CSS-only motion states (3 states), straightforward
- Persistence: `campaign.path` column (migration), `node_statuses` table or column (migration), `chat_transcript` table (migration) — 3 schema changes
- Baseline analytics on old wizard — 3 new `trackEvent()` calls in existing wizard code, trivial
- Section 10.1/10.2 endpoints — `updateSelection` mutation already exists; `favourites` table already exists and persists. Both PASS with minor wiring.

**True size:** This is a 2-component build (ChatThread + TrailBar) plus 3 DB migrations plus the Zappy avatar. The components are complex (ChatThread is effectively a chat framework with 7 renderable message types). TrailBar has 5 visual states plus mobile responsive behaviour. Estimate: a substantial sprint — not a quick one.

---

## RECOMMENDATION

**Ship the crown-selection fix as a standalone micro-release first, before the full Trail build.**

Justification from the code:

1. **The selection fix is the spec's highest-value backend change and it's almost free.** The `selected*Id` columns already exist. `updateSelection` mutation already works. `persistSelection` already writes `[0]`. The only changes needed: (a) surface the current auto-pick visually in the existing wizard with a "Selected" badge on item #1, (b) add a "Use this one" button on other items that calls the existing `updateSelection` mutation, (c) wire favourites heart to replace thumbs-up/down/star. This is a 1-commit change touching V2GeneratorWizard.tsx and the result panels — zero migrations, zero new components.

2. **It validates the core UX hypothesis immediately.** The spec's entire Manual Mode depends on crown-selection working. Shipping it in the existing wizard proves the mechanism before building the Trail surface around it. If users don't re-crown (the spec's own analytics event `option_recrowned` would tell you), the elaborate CardDeck dealing UX can be simplified.

3. **It fixes Finding 1 — the biggest open design item.** The three decisions Arfeen already locked (explicit "Use this" button, default-#1-visibly-marked, stale detection) align exactly with what the spec prescribes. This closes the longest-open design gap.

4. **The full Trail build has hard dependencies the selection fix doesn't.** ChatThread needs chat transcript persistence (new table), path enum (new column), node_statuses (new table/column) — three migrations that need design review. The selection fix needs zero migrations.

5. **The CASCADE_NODE_TO_KIT_FIELD bug (whatsapp mapped to email field) should be fixed before any stale-detection or re-crown logic reads that mapping.** One-line fix, but it needs to ship before the Trail, not during it.

**Sequence:** (A) Fix the cascadeContext bug → (B) Ship crown-selection in the existing wizard → (C) Begin Trail Sprint 1 with the selection mechanism proven and the mapping correct.

---

## BEFORE-STATE SCREENSHOT

I cannot capture visual screenshots from the browser. **Action for Arfeen:** Open zapcampaigns.com, log in, and capture:
1. The dashboard showing "Start New Campaign" button
2. The first wizard step after clicking it (the Service step)

These are the before-state baseline the Trail project will be measured against.

---

**Holding for Arfeen's review and explicit go-ahead before any building begins.**
