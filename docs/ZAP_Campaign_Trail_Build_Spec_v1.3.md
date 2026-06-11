# ZAP CAMPAIGN TRAIL — EXPERIENCE BUILD SPEC v1.3
## For Claude Code, implementing directly in the ZAP codebase

**v1.3 changes (2026-06-12):** ComplianceDial narrowed to 3 scored nodes; ChatThread built fresh (AIChatBox reference-only); quota visibility replaces credits language; confirmed schema additions named; Sprint 4 largely retired — crown-selection mechanism already shipped and verified on prod.

**Revised build estimate:** The original v1.2 spec scoped 6 sprints assuming selection was unbuilt. With crown-selection shipped (commits 05dd1cd, 5bcfd52, 0087c95) and verified on prod, the core Manual Mode selection mechanism — visible Selected badge, "Use this one" re-crowning, writes to existing selected*Id columns, amber downstream stale note, dead controls removed — is proven and live. Sprint 4 (Manual Mode selection) is largely retired; the remaining Manual Mode work is porting the proven mechanism into the ChatThread/CardDeck surface, not building selection from scratch. The cascade mapping bug (whatsapp→selectedWhatsAppSequenceId) is also already fixed. Realistic revised scope: 4 full sprints + 1 polish sprint. The biggest remaining unknowns are ChatThread (net-new component, 7 message types) and the chat transcript persistence layer.

This document is the complete specification for replacing ZAP's wizard-driven campaign creation with a single chat-driven, gamified experience called the Campaign Trail. It covers all three entry paths (Auto, Manual, Has-Assets), every screen state, every Zappy line, all timings, and all animations. Build exactly what is specified. Where the existing codebase conflicts with this spec, this spec wins for the experience layer; the backend cascade engine is untouchable (see Ground Rules).

---

## 0. GROUND RULES (read before writing any code)

1. Work from ~/zap-deploy on the railway-build branch only — this is the live working tree wired to the deploy pipeline and carrying the W5 hotfixes. Never work from a fresh clone in /tmp or anywhere else. Never push to main.
2. DO NOT modify the backend cascade engine, node prompts, generation logic, compliance checking, or copywritingRules.ts. This is an experience-layer rebuild. The only backend changes permitted are the new persistence endpoints explicitly listed in Section 10.
3. Before building, read the existing theme/tokens file and the existing homepage chat intake component (AIChatBox.tsx). Reuse the brand palette. AIChatBox is a **tone and pattern reference only** — it uses className-based styling which violates the V2 inline-styles rule, so ChatThread must be built fresh under the V2 inline-styles convention. Section 2 defines additions, not replacements.
4. The existing multi-step wizard is REPLACED as the default route for "Start New Campaign." Do not delete wizard code in Sprint 1–3; route around it. Delete it only in the final cleanup sprint after the Manual path reaches parity.
5. Respect prefers-reduced-motion: every animation in this spec must have a reduced variant (instant state change, no confetti, no bobbing).
6. Every sprint ends with screenshot proof from zapcampaigns.com showing the completed sprint's acceptance criteria. No sprint is complete without screenshots.
7. Mobile-first. The chat surface must be fully usable at 375px width. The Trail Bar collapses gracefully (see 3.2).

---

## 1. THE CONCEPT IN ONE PARAGRAPH

There is one surface: a chat thread with Zappy the fox. Pinned above the chat is the Trail Bar — the 11-node cascade rendered as a path of stops that light up as the campaign builds. Every campaign, regardless of path, begins with the same two-question conversation. Auto Mode users watch their campaign build itself with narrated waits, rolling reveals, and one-tap approvals. Manual users get options dealt as cards and crown their favourite. Has-Assets users paste what they own and ZAP fills the gaps. Each completed node is a small win; milestones are medium wins; the finished Campaign Kit is the trophy. The cascade's coherence magic stays fully intact underneath — the surface just makes it feel like a game instead of software.

---

## 2. DESIGN SYSTEM ADDITIONS

### 2.1 Palette (additions layered on existing ZAP brand tokens)
- trail-active: the existing ZAP primary brand colour (read from theme; do not invent)
- trail-pending: neutral-300 equivalent from existing theme
- trail-stale: amber-500 (#F59E0B) — used ONLY for stale/needs-refresh states
- crown-gold: #EAB308 — used ONLY for the selection crown and selected-card ribbon
- celebrate-spark: derive a lighter tint of the brand primary for sparkle particles
- compliance-green: existing success green from theme

Rule: gold means "chosen," amber means "needs refresh," brand primary means "done/active." Never mix these meanings.

### 2.2 Type and voice
- Reuse existing app typefaces. Zappy's messages use the body face at chat scale; reveals use the display/heading face for the asset title only.
- Zappy's written voice: short sentences, present tense, talks about the USER'S business specifics, never about "the system." Max 14 words per chat bubble line. One emoji maximum per bubble, never two.

### 2.3 Zappy treatment (static image only — assume ONE static fox asset)
Do not request or assume new artwork. All Zappy personality comes from:
- A circular avatar of the static fox image beside each Zappy chat bubble.
- CSS-only motion states on the avatar:
  - idle: gentle 3s ease-in-out vertical bob, 3px amplitude
  - thinking: slow 8deg side-to-side tilt loop while a node is generating
  - celebrating: single 360deg spin with slight scale-up to 1.15, 600ms, on node completion
- Mood is conveyed by bubble copy + at most one emoji, never by swapping images.
If multiple poses ship later, these three states map 1:1 to pose swaps — structure the avatar component so the static image is a replaceable slot.

### 2.4 Motion budget
One orchestrated moment per event. A node completion gets EITHER the trail-stop sparkle OR a bubble animation, not both stacked. Durations: micro-interactions 150–250ms, reveals 400ms, celebrations 600ms, campaign-complete confetti 2.5s max then fully cleared from DOM.

---

## 3. SHARED COMPONENTS (build these first — every path uses them)

### 3.1 ChatThread
The container for the whole experience. Built fresh under the V2 inline-styles convention — AIChatBox.tsx is a tone and UX-pattern reference only (its className/shadcn styling is incompatible with V2 rules). Behaviours:
- Auto-scrolls to newest message; pauses auto-scroll if user scrolls up; shows a "↓ New" pill to return.
- Message types it must render: zappy-bubble, user-bubble, chip-row (tappable quick replies), asset-reveal-card, card-deck, milestone-badge, system-divider.
- Chips disappear after tap and the choice is echoed as a user-bubble (standard chat pattern).

### 3.2 TrailBar (pinned header)
- Renders 11 stops on a horizontal path with the 4 milestone groupings subtly bracketed: FOUNDATION (Service, ICP, Offer, Mechanism), MAGNET (Lead Magnet, Headlines, Ad Copy), CONVERT (Landing Page, Email, WhatsApp), CREATIVE (Ad Images).
- Stop states: pending (hollow, trail-pending), generating (pulsing ring, brand primary), done (filled, brand primary, check), stale (amber with refresh glyph), imported (filled with a small paperclip glyph instead of check).
- Below the path: "X of 11 complete" counter that ticks up with a 300ms count animation.
- Mobile: collapses to a slim progress bar + "X of 11" text; tapping expands a bottom-sheet showing all 11 stops.
- Tapping a DONE stop scrolls the chat back to that node's reveal. Tapping a PENDING stop does nothing in Auto, and in Manual shows tooltip "Finish the steps before this one first."

### 3.3 AssetRevealCard (Auto Mode's reveal unit)
- Slides up + fades in over 400ms when a node's chosen asset arrives.
- Contents: node label eyebrow (e.g. "YOUR OFFER"), asset title in display face, 2–4 line preview of the asset body, expandable to full view.
- Footer: two chips — "Love it ✓" and "Tweak". (Behaviour in Section 5.)
- A small compliance chip in the corner: "Meta ✓ 100" — shown ONLY on the 3 scored nodes (headlines, ad copy, landing pages). See 3.6.

### 3.4 CardDeck + Crown (Manual Mode's selection unit)
- Options are DEALT one at a time, 350ms apart, sliding in from the right into a horizontally scrollable deck (vertical stack on mobile).
- Option #1 arrives ALREADY CROWNED: a crown-gold ribbon across the top-left corner reading "Selected." This is the persisted default selection — making the existing auto-pick visible. NOTE: The core crown-selection mechanism (visible Selected badge, "Use this one" button, writes to existing selected*Id columns, amber downstream stale note) is already shipped and verified on prod in the existing wizard (commits 5bcfd52 + 0087c95). The CardDeck ports this proven mechanism into the chat surface, not rebuilds it from scratch.
- Every other card shows a full-width "Use this one" button. Tapping it: ribbon animates off the old card and onto this one with a 250ms snap + single sparkle at the ribbon; Zappy posts a one-line reaction bubble (copy library 12.6).
- A small heart icon on each card saves to Favourites (persisted). Heart has NO effect on selection. Thumbs-up/thumbs-down icons are REMOVED everywhere. Star icon is REMOVED. (Thumbs-down and star already removed from prod in commit 5bcfd52; thumbs-up kept only where wired to the real favourites table.)
- A "Deal 5 more" chip under the deck triggers regeneration of additional options for that node. The chip shows remaining quota for that generator: "Deal 5 more · 3 left" (see Section 16).

### 3.5 TweakBox
- Opens inline under a reveal card when "Tweak" is tapped. Single text input, placeholder: "What should change?" plus 3 contextual quick-chips per node type (library in 12.5). Submitting regenerates ONLY that node with the tweak appended as guidance, then re-reveals.

### 3.6 ComplianceDial
A real 0–100 compliance score exists ONLY for three node types: **headlines, ad copy, and landing pages.** The dial appears on these 3 nodes only. On the other 8 nodes, there is no dial — use the normal generating state (narrator + Zappy thinking animation).

For the 3 scored nodes:
- A small circular dial appears in the generating state. HONESTY RULE: the dial must reflect the real compliance signal, never a scripted climb to 100. The compliance score is final-only (not streamed), so the dial behaves as a progress indicator during generation (climbing, capped at 90) and snaps to the REAL returned score at reveal. It only ever displays 100 when the engine returned 100.
- On reveal it collapses into a static "Meta ✓ {real_score}" chip. If the real score is below 100, show it in amber with chip "Auto-fixing…" and re-run the existing compliance rewrite; if the retry still lands below 100, surface honestly per Section 11. The dial and the chip always show the same real number.

### 3.7 CelebrationSystem
Three tiers, strictly enforced so celebration keeps meaning:
- Tier 1 — node done: trail stop fills with a 600ms sparkle burst (6–8 particles), counter ticks, Zappy avatar does the celebrate spin. No confetti.
- Tier 2 — milestone group done (after Mechanism, after Ad Copy, after WhatsApp): a milestone-badge message drops into the chat with a 500ms bounce — badge art is a simple medallion built in CSS/SVG with the group name (FOUNDATION LOCKED / MAGNET READY / CONVERSION ENGINE ON). No confetti.
- Tier 3 — campaign complete: full-screen confetti 2.5s in brand colours, the TrailBar folds/morphs into the Campaign Kit header, and an asset counter rolls up from 0 to the real total ("110 assets ready") over 1.2s. One time only per campaign.

### 3.8 GenerationNarrator (the dead-air killer)
While any node generates, Zappy posts a timed sequence of narration bubbles:
- t=0s: line 1 (what Zappy is doing, in terms of THIS user's business)
- t=4s: line 2 (a specific in-progress detail)
- t=8s: line 3 (a templated tease from the copy library — no streaming API exists, so real fragments are not available)
- t=14s+ (only if still waiting): patience line from 12.7. Rotate; never repeat within a campaign.
Bubbles appear with the avatar in "thinking" tilt. The moment results arrive, narration stops and the reveal fires. Nothing on screen is ever static for more than 4 seconds during generation.

---

## 4. THE UNIFIED ENTRY FLOW (all three paths start here)

Route: "Start New Campaign" anywhere in the app opens the ChatThread at this script. The old wizard route redirects here.

Beat 1 — t=0s. Zappy bubble: "Hey! Let's build you a campaign. 🦊"
Beat 2 — t=0.8s. Zappy bubble: "Tell me about your business — who do you help, and what do you do for them?"
- Free-text input is focused. No chips yet. The user types naturally.

Beat 3 — on submit. Zappy: "Got it. Reading that like a strategist…" (avatar: thinking tilt, 2–4s while the existing Service/ICP extraction runs).

Beat 4 — extraction echo (trust moment). Zappy posts a compact summary card: "So: you're a {service_short} helping {icp_short}. Right?" with chips: "That's me" / "Not quite".
- "Not quite" opens TweakBox ("What did I get wrong?") and re-extracts. Loop max twice, then offer free-text correction fields.

Beat 5 — the fork. Zappy: "How do you want to do this?"
Three chips (these ARE the three paths, but never use the words Auto/Manual internally-facing):
- "Build it for me ⚡" → Path A (Auto)
- "I'll pick as we go" → Path B (Manual)
- "I already have some pieces" → Path C (Has-Assets)

The chosen path is stored on the campaign record. Users can switch paths mid-campaign via an overflow menu ("Switch to picking myself" / "Let Zappy take over from here") — switching preserves all completed nodes.

---

## 5. PATH A — AUTO MODE, BEAT BY BEAT (the flagship)

Principle: the user is a passenger who gets to honk the horn. ZAP generates and auto-selects everything; the user sees each asset revealed in sequence and can approve or tweak inline. Approval is optional — silence equals approval after the next node reveals.

### 5.1 The loop (identical for every node)
1. TrailBar stop enters "generating" pulse. On the 3 scored nodes (headlines, ad copy, landing pages), the ComplianceDial appears and starts climbing. On all other nodes, the normal generating state plays (narrator + thinking animation, no dial).
2. GenerationNarrator plays that node's 3-line sequence (full copy in Section 12.2).
3. On completion: narration stops, AssetRevealCard slides in with the AUTO-SELECTED option (the engine's existing best-pick). Tier 1 celebration fires.
4. Chips: "Love it ✓" / "Tweak".
   - "Love it": chip echoes as user bubble "Love it ✓", Zappy replies with a 1-line reaction (12.6), next node starts immediately.
   - "Tweak": TweakBox opens. Regenerates only this node. Re-reveal. Downstream has not started yet, so no stale logic needed mid-flow.
   - No tap: after the NEXT node's reveal appears, the previous card's chips quietly collapse to a "✓" — momentum never blocks on approval.
5. Between nodes there is NO gap: the next node's narration line 1 posts within 500ms of the previous reveal (or of "Love it"). The cascade should feel like it is rolling downhill.

### 5.2 Node order and reveal formats
1. Service — revealed inside the Beat-4 echo card (already confirmed). Stop 1 marks done at fork time.
2. ICP — reveal shows persona name, one-line identity, top 3 fears/desires as small pills.
3. Offer — reveal shows offer name, price line, stack count ("6 components"), guarantee line.
4. Mechanism — reveal shows the named method in display type (this is the most "named-thing" moment — give the title an extra 150ms letter-spacing settle animation). Tier 2 badge: FOUNDATION LOCKED.
5. Lead Magnet — reveal shows HVCO title + format (guide/webinar/etc.).
6. Headlines — reveal shows the chosen headline large, with a small "+14 more in your Kit" note.
7. Ad Copy — reveal shows first 3 lines, expandable. Tier 2 badge: MAGNET READY.
8. Landing Page — reveal shows a mini wireframe-style preview block (hero headline + CTA text), not a full render.
9. Email Sequence — reveal shows sequence length ("5 emails") + subject line of email 1. IMPORTANT: when a tweak regenerates an email, the reveal must visibly change — show the new body's first line, never just the (possibly unchanged) subject. This fixes the current "looks unchanged" trust bug.
10. WhatsApp Sequence — reveal shows message count + message 1 preview. Tier 2 badge: CONVERSION ENGINE ON.
11. Ad Creatives — reveal shows image thumbnails dealt 300ms apart. Then Tier 3: campaign complete.

### 5.3 Campaign complete
After confetti and the TrailBar morph, Zappy's closing sequence:
- "Done. {campaign_count} assets, all singing the same song."
- "Every piece matches your offer, your method, your voice."
- Chips: "Open my Campaign Kit" / "Review piece by piece"
The Kit itself is unchanged in this build except for receiving the morph animation entry.

### 5.4 Total-time framing
At fork time in Path A, Zappy sets the expectation: "This takes about {estimate} minutes. I'll show you everything as I build it." Estimate = node count × current average node time, read from config, rounded up to whole minutes.

---

## 6. PATH B — MANUAL MODE ("I'll pick as we go")

The same ChatThread and TrailBar — Manual is NOT a different surface, it is the same conversation with a deal-and-crown step inserted per node. This retires the form-wizard feel entirely.

NOTE: The core crown-selection mechanism is already shipped and verified on prod (commits 05dd1cd, 5bcfd52, 0087c95). Manual Mode in the Trail ports this proven mechanism into the CardDeck/ChatThread surface. The remaining work is the chat-surface integration (dealing animation, inline chips, narrator), not the selection logic itself.

### 6.1 The loop per node
1. Zappy intro line for the node (copy 12.3), with one chip: "Deal me options 🎴" plus a small text link "Skip — I already have this" (preserves existing skip-node feature; skipping opens a paste/upload box and marks the stop as imported).
2. On deal: generating state + narrator, same as Auto.
3. Options arrive as a CardDeck (3.4), dealt one at a time. Option #1 pre-crowned.
4. User crowns their pick (or doesn't — default stands). Heart saves favourites.
5. Continue chip: "Lock it in →". On tap: Tier 1 celebration, next node intro posts.
6. "Deal 5 more · {remaining} left" available before locking; new cards append to the deck.

### 6.2 Re-crowning after downstream exists (stale logic — must be exact)
NOTE: The amber "Built with your previous selection — regenerate to update" stale note is already implemented and verified on prod. The Trail surface extends this with the chat-native interaction pattern below.

- Changing a crowned selection on node N when any node > N is done: every downstream DONE stop flips to stale (amber + refresh glyph), their reveal cards gain an amber "Needs refresh" banner.
- Zappy posts: "New pick! {n} pieces below this were built on the old one. Want me to update them?" Chips: "Update the rest" / "Keep them as they are".
- "Update the rest" regenerates stale nodes in cascade order, replaying the Auto-style narration/reveal loop for each. Any node the user manually EDITED (kit-level edits) is NOT auto-regenerated — it stays stale-flagged with a per-card "Refresh this one" button so user edits are never silently wiped.
- NOTHING ever regenerates silently. This is a hard rule.

### 6.3 Wizard parity checklist (must all exist before old wizard is deleted)
Generate per node, regenerate, skip node with import, advanced edit AI inputs (kept, but moved behind a small "Advanced" link in the node intro bubble), favourites, continue gating in cascade order, Campaign Kit handoff. The double "Continue to Next Step" button bug dies with the wizard (already fixed in commit 5bcfd52).

---

## 7. PATH C — HAS-ASSETS ("I already have some pieces")

1. Zappy: "Nice — what have you got? Tap everything you already have." A chip-grid of the 11 node names (multi-select) + "Done choosing".
2. For each selected item, in cascade order, Zappy asks for it conversationally ("Paste your offer — rough is fine, I'll structure it.") with a paste box + file upload. The existing import/extraction endpoints process it; the structured echo is shown for confirmation ("Here's how I read your offer: …" chips: "Correct" / "Fix something").
3. Imported stops fill on the TrailBar with the paperclip glyph immediately — the user sees instant progress for things they already own. This is a deliberate psychology beat: a user with 4 assets starts the campaign at "4 of 11 complete."
4. Zappy then bridges: "You're already {x} of 11 done. I'll build the missing {y} so they match what you have." Then runs the AUTO loop (Section 5) over only the gap nodes, reading imported assets as upstream context.
5. If an imported asset conflicts with cascade order (e.g. user has headlines but no offer), accept it, hold it, and when the upstream node generates, validate fit: if mismatch, Zappy flags: "Your headline doesn't quite match the new offer — keep yours, or want a matching set?" Never silently discard user-provided material.

---

## 8. DEAD-AIR RULES (system-wide, hard requirements)

1. No spinner ever appears without a narration bubble alongside it.
2. Nothing static on screen for more than 4 seconds while generating (narration cadence guarantees this).
3. No streaming API exists. All options are dealt via simulated progressive arrival from the completed batch (dealt-card animation, 350ms apart). Narration line 3 uses the templated tease from the copy library, not real fragments.
4. Full-cascade Auto runs get one "while I work" insight bubble per milestone group: Zappy shares one real, specific observation drawn from the user's generated ICP (e.g. "By the way — {icp_fear_1} is the fear we'll hammer in your ads. It's the one that moves people."). Pull from generated data, never canned generic marketing tips.
5. If generation exceeds 30s: switch to honest reassurance line (12.7) + keep the dial moving (on scored nodes) or keep the narrator going (on non-scored nodes). If it fails: Section 11 error voice. Never leave a dead dial or a silent screen.

---

## 9. GAMIFICATION LEDGER (what exists, what deliberately does not)

EXISTS:
- Trail progress + "X of 11" counter (per campaign)
- Tier 1/2/3 celebrations and milestone badges (per campaign)
- Compliance dial climbing to 100 (on the 3 scored nodes only: headlines, ad copy, landing pages)
- Campaign streak on the dashboard: "{n} campaigns this month 🔥" — counts campaigns COMPLETED in the calendar month. No daily-login streaks; marketers don't work daily and broken streaks punish.
- A Badges shelf on the user profile: FIRST CAMPAIGN, FOUNDATION ×10, 5 IN A MONTH, FULL HOUSE (used all three paths). Simple CSS/SVG medallions, same style as milestone badges.

DELIBERATELY DOES NOT EXIST (do not build):
- Points/XP systems, leaderboards, daily streaks, lives/hearts, anything that gates functionality behind game mechanics. Gamification here rewards progress; it never restricts.

---

## 10. PERSISTENCE & DATA (the only backend additions allowed)

### 10.1 Selection (ALREADY SHIPPED — no migration needed)
The `selected*Id` columns on `campaignKits` already serve as `selected_option_id`. The crown-selection mechanism — visible Selected badge, "Use this one" re-crowning, writes via existing `updateSelection` mutation — is shipped and verified on prod (commits 05dd1cd, 5bcfd52, 0087c95). The cascade mapping bug (whatsapp→selectedWhatsAppSequenceId) is also fixed (commit 05dd1cd). No schema migration required for selection.

### 10.2 Favourites (ALREADY EXISTS — no migration needed)
The `favourites` table and `useFavourites` hook persist heart/thumbs-up across refresh. DB-backed, separate from cascade selection.

### 10.3 Confirmed schema additions (net-new, require migrations)
These three additions are confirmed needed:

1. **`campaign.path`** — enum column on `campaigns` or `campaignKits`: `auto` / `manual` / `has_assets`. Mutable (supports path switching mid-campaign).
2. **`node_status`** — no node_status field exists today; node completion is currently inferred from whether a `selected*Id` is populated. The Trail needs explicit status tracking for `imported` and `stale` states. Implementation: either a new column per node on `campaignKits` or a new `node_statuses` join table `(campaignKitId, nodeType, status)`.
3. **`chat_transcript`** — net-new table to persist the chat message list per campaign so reload/resume restores the full thread scrolled to the live position. Schema: `(id, campaignKitId, messages JSON, updatedAt)`.

### 10.4 Resume behaviour
Opening an in-progress campaign posts Zappy: "Welcome back. We're {x} of 11 — {next_node} is up next." with the appropriate chip to continue.

### 10.5 Baseline analytics (ALREADY SHIPPED)
The minimal baseline events (campaign_started, node_completed, campaign_completed, option_recrowned) are already firing on the existing wizard via the `product_events` table and `trackEvent()` helper (commit 5bcfd52). No additional wiring needed for baseline.

---

## 11. EDGE CASES & ERROR VOICE

- Generation failure: stop pulse ends, dial pauses on scored nodes (not resets). Zappy: "Hm — that one fizzled. Let me try again." Auto-retry once silently. Second failure: "Still stuck. One more go?" chips: "Retry" / "Skip for now" (skip marks the stop pending, campaign continues if no downstream dependency; if dependent, explain: "Can't skip this one — everything after it builds on it.")
- Errors never apologise effusively, never say "error", never blame the user, always state what happens next.
- Mid-generation tab close: generation continues server-side where the engine already supports it; resume shows completed reveals on return.
- Compliance below 100 after auto-fix retry (headlines, ad copy, landing pages only): surface honestly: "This one's at {score} — {reason}. Want me to rewrite it safe, or keep your wording?" Never fake 100.
- Empty/garbage business description at intake: "I need a little more — even one messy sentence about who you help works."

---

## 12. ZAPPY COPY LIBRARY (verbatim — use these lines)

Voice rules recap: short, specific to the user's business, present tense, max one emoji, never refers to "the system/AI/model", never exclaims more than once per bubble.

### 12.1 Intake (Section 4 contains the full scripted beats — canonical there)

### 12.2 Auto Mode narration, per node (line1 / line2 / line3-tease)
ICP:
- "Studying the people you help…"
- "Mapping what keeps them up at night."
- "Found {n} fears that'll drive everything. Revealing your customer 👀"
Offer:
- "Building your offer now."
- "Stacking value until no is harder than yes."
- "Pricing it. Guarantee going on top…"
Mechanism:
- "Every great coach has a named method. Naming yours."
- "Testing names against {icp_short}'s ears…"
- "It's going to be called something like 'The ___ {fragment}'…"
Lead Magnet:
- "Now the free thing that pulls people in."
- "It has to be worth paying for — that's the bar."
- "Title's landing… almost there."
Headlines:
- "Headline time. First impressions, fifteen ways."
- "Each one aims at {icp_fear_1}."
- "Dealing them as they land 🎴" (then simulate dealing from completed batch)
Ad Copy:
- "Writing the words under those headlines."
- "Hook, story, offer — in your voice."
- "Meta's rules are being checked line by line…"
Landing Page:
- "Building the page that turns clicks into bookings."
- "Headline above the fold, proof below it."
- "Wiring every section back to your offer…"
Email Sequence:
- "Now the follow-up emails."
- "Five touches, each one a different angle."
- "Subject lines getting their final polish…"
WhatsApp Sequence:
- "WhatsApp messages next — short, human, no essay-texting."
- "Matching the rhythm people actually reply to."
- "Last message links it all back to your page…"
Ad Creatives:
- "Final stretch: the visuals."
- "Composing images that match your message."
- "Rendering… these take a few extra breaths 🦊"

### 12.3 Manual Mode node intros (one line each + the deal chip)
ICP: "Who exactly are we hunting for? Let me show you some sharp profiles."
Offer: "Time to build an offer they can't shrug off."
Mechanism: "Your method needs a name people remember."
Lead Magnet: "What's the irresistible free thing?"
Headlines: "Fifteen ways to stop the scroll. Ready?"
Ad Copy: "Words that earn the click."
Landing Page: "The page that does the convincing."
Email Sequence: "The follow-up that does the selling."
WhatsApp Sequence: "Short messages, big results."
Ad Creatives: "Let's make it look as good as it reads."

### 12.4 Reveal eyebrow labels
YOUR IDEAL CUSTOMER / YOUR OFFER / YOUR METHOD / YOUR LEAD MAGNET / YOUR HEADLINE / YOUR AD COPY / YOUR LANDING PAGE / YOUR EMAIL SEQUENCE / YOUR WHATSAPP SEQUENCE / YOUR AD CREATIVES

### 12.5 Tweak quick-chips per node type
ICP: "More specific" / "Different niche" / "Higher-end client"
Offer: "Lower price point" / "Stronger guarantee" / "Simpler stack"
Mechanism: "Punchier name" / "Less jargon" / "More premium"
Lead Magnet: "Different format" / "Narrower topic" / "Bolder title"
Headlines: "More curiosity" / "More direct" / "Less hype"
Ad Copy: "Shorter" / "More story" / "Harder CTA"
Landing Page: "Stronger hero" / "More proof" / "Shorter page"
Email: "Warmer tone" / "Shorter emails" / "More urgency"
WhatsApp: "More casual" / "Fewer messages" / "Stronger opener"
Creatives: "Different style" / "Bolder text" / "Calmer look"

### 12.6 Reactions (rotate randomly, never repeat consecutively)
On "Love it": "Knew it." / "That's the one." / "Good eye." / "Locked. 🦊" / "On we go."
On re-crown (Manual): "Ooh, bold choice." / "Better. Agreed." / "That one bites harder." / "Switched. Good call."

### 12.7 Patience lines (>14s) and long-wait (>30s)
>14s: "Still cooking — good things, slow oven." / "Worth the wait, promise." / "Polishing the edges…"
>30s: "Taking longer than usual — still on it, nothing's stuck."

### 12.8 Milestone badge lines
FOUNDATION LOCKED: "The hard thinking is done. Everything from here builds on this."
MAGNET READY: "You now attract attention on purpose."
CONVERSION ENGINE ON: "Clicks now have somewhere to become clients."

---

## 13. BUILD ORDER (sprints, each gated on screenshots from zapcampaigns.com)

**Revised from v1.2:** Sprint 4 (Manual Mode selection) is largely retired — the core selection mechanism is shipped. The remaining Manual Mode work (CardDeck dealing, chat-surface integration) folds into Sprint 3's scope since the hard part (selection logic, stale detection, cascade writes) is proven.

Sprint 1 — Foundations. ChatThread (built fresh, V2 inline styles, 7 message types), TrailBar (all states incl. mobile collapse), Zappy avatar motion states, schema migrations (campaign.path, node_status, chat_transcript). Acceptance: screenshot of TrailBar showing pending/generating/done/stale/imported states; screenshot of mobile collapsed bar; screenshot of ChatThread rendering at least 3 message types.

Sprint 2 — Entry flow. Unified intake script (Section 4), extraction echo, fork chips, path stored, old wizard route redirected, in-flight wizard campaign migration + greeting. Acceptance: screenshots of all 5 beats + both echo-correction states + a migrated campaign opening in the chat surface.

Sprint 3 — Auto + Manual Modes. Full Auto loop for all 11 nodes: narrator, ComplianceDial (on 3 scored nodes only), AssetRevealCard, Love it/Tweak, Tier 1+2+3 celebrations, campaign-complete morph into Kit. Manual Mode: CardDeck dealing (porting the proven crown-selection from the existing wizard), "Deal 5 more · {remaining} left" with quota visibility, Lock it in, stale propagation + "Update the rest" chat flow, advanced-inputs link, skip/import. Campaign-complete third chip + single-clone flow (15.1–15.3, 15.5). Acceptance: screenshots of Auto (node mid-narration with dial on a scored node, a reveal card, a Tier 2 badge, campaign-complete state) + Manual (dealt deck with crowned default, re-crowned deck, amber stale stops with update prompt, Deal 5 more showing quota) + clone flow.

Sprint 4 — Has-Assets + Polish. Chip-grid selection, per-asset paste/upload + structured echo, paperclip stops, gap-fill auto run, conflict flag flow. Reduced-motion variants verified, resume flow, error voice paths, dashboard campaign streak + badges shelf, wizard parity checklist (6.3) verified. Acceptance: screenshots of chip grid, imported echo, TrailBar mixing paperclip + generated stops, resume bubble, error state, badges shelf.

Sprint 5 — Cleanup + batch clone. THEN delete the old wizard (only after migration path is screenshot-proven). Batch cloning (15.4), quota visibility on all generation actions, north-star dashboard queries. Acceptance: proof old wizard route redirects, batch clone queue on dashboard.

Each sprint: single recommendation if a decision is needed, act immediately, end with the screenshot set. Never push to main.

---

## 14. ANALYTICS EVENTS (build into every sprint — success is measured, not assumed)

Fire these events via the existing `product_events` table and `trackEvent()` helper (already wired — no new table needed):

Funnel events:
- intake_started, intake_business_submitted, intake_echo_confirmed, intake_echo_corrected
- path_chosen {path}, path_switched {from, to, at_node}
- node_generation_started {node, path}, node_revealed {node, duration_ms}
- node_approved {node, method: tap | silent}, node_tweaked {node, tweak_text_length, quick_chip_used}
- option_recrowned {node, from_position, to_position} — **already firing on prod** (commit 5bcfd52). Position matters: if users overwhelmingly keep option #1, auto-select is working; if they constantly re-crown, the engine's best-pick needs tuning
- deck_dealt_more {node}, node_skipped_imported {node}
- stale_triggered {changed_node, downstream_count}, stale_updated | stale_kept
- campaign_completed {path, total_duration_ms, tweak_count, recrown_count} — **already firing on prod** (commit 5bcfd52)
- campaign_abandoned {last_node, state} — fire on 24h inactivity on an in-progress campaign

NOTE: campaign_started, node_completed, campaign_completed, and option_recrowned are already firing on the existing wizard (commit 5bcfd52). The Trail build extends these with the additional funnel events above.

North-star dashboard (one simple internal page or query set):
1. Completion rate: campaigns completed ÷ campaigns started, split by path
2. Per-node abandonment: where people stop (this is the wizard-killer metric — compare against wizard baseline before deleting it)
3. Time-to-Kit: median intake→complete, by path
4. Tweak rate per node: which nodes' output people don't trust
5. Re-crown rate per node: how often the auto-pick loses

Baseline analytics are already captured on the existing wizard — the Trail build has a before/after from day one.

---

## 15. MULTI-ICP CLONE ("Run this for another audience")

Purpose: supports the 10-ICP simultaneous testing methodology. A finished campaign becomes the template; only the audience changes; everything downstream regenerates to match.

### 15.1 Entry points
- Primary: a third chip on the campaign-complete screen (5.3): "Open my Campaign Kit" / "Review piece by piece" / "Run this for another audience 🎯"
- Secondary: a "Clone for new audience" action on every campaign card on the dashboard.

### 15.2 The clone flow (chat, short)
1. Zappy: "Same offer, new crowd. Who's this version for?" Free-text box + chips of the user's other existing ICPs if any are on file ("Use {icp_name}").
2. ICP extraction/echo runs exactly as intake Beat 3–4.
3. Zappy: "Got it. I'll rebuild everything that speaks to the audience — your offer and method stay yours." Then Auto loop (Section 5) runs over the AUDIENCE-DEPENDENT nodes only.

### 15.3 What clones vs regenerates (exact)
- COPIED as-is, marked done instantly on the new trail: Service, Offer, Mechanism. (Stops fill immediately with a small clone glyph — same instant-progress psychology as Path C.)
- REGENERATED against the new ICP: ICP (the new one), Lead Magnet, Headlines, Ad Copy, Landing Page, Email, WhatsApp, Creatives.
- The clone is a NEW campaign record linked by parent_campaign_id. Edits to a clone never touch the parent.

### 15.4 Batch cloning (power move, simple build)
After one clone completes, Zappy offers once: "Want to line up more audiences? Give me up to 9 and I'll build them all." Multi-line input (one ICP per line). Clones queue and run sequentially server-side; the dashboard shows each as its own campaign card with a live trail-progress ring. No babysitting required — this is the 10-ICP test in one sitting.
- Events: campaign_cloned {parent_id, batch_size}, clone_batch_completed.

### 15.5 Naming
Clones auto-name as "{parent_name} — {icp_short}" so ten variants stay readable on the dashboard and map cleanly to ad-set naming later.

---

## 16. QUOTA VISIBILITY & IN-FLIGHT MIGRATION

### 16.1 Quota display (billing is quota-based, not credits)
Generation is metered by per-generator quota counts (not transferable credits). Each generator has a limit per subscription tier (e.g. Pro: 50 per generator). The cost must be visible ON the action chip itself: "Deal 5 more · 3 left" shows remaining quota for that specific generator. The remaining balance for the current generator lives quietly in the chat header during Manual Mode. No action may silently consume quota. If a user hits their limit, Zappy: "You've used all your {node_type} generations this cycle. Upgrade for more, or work with what you have."

### 16.2 Migration of in-flight wizard campaigns
On first open of an in-progress old-wizard campaign after Sprint 2 ships: it opens in the new ChatThread, completed nodes pre-filled as done stops, and Zappy greets: "This campaign just got an upgrade. Everything you built is here — {next_node} is up next." Selections map via the existing `selected*Id` columns (no backfill needed — the wizard already writes these).
- No campaign is ever orphaned; the old wizard is deleted in Sprint 5 only after this migration path is screenshot-proven.

---

## 17. WHAT'S ALREADY SHIPPED (v1.3 status)

These items from the original spec are already implemented, verified on prod, and do not need to be rebuilt:

1. **Crown selection mechanism** (commits 05dd1cd, 5bcfd52, 0087c95): visible "✓ Selected" badge on auto-picked option, "Use this one" button on alternatives, writes to existing `selected*Id` columns via `updateSelection` mutation, amber "Built with your previous selection — regenerate to update" stale note on downstream panels when upstream selection changes. No auto-regeneration — manual regenerate only.
2. **Dead control cleanup** (commit 5bcfd52): thumbs-down removed from 6 panels, star removed from 5 panels (both were pure useState, no persistence). Thumbs-up kept where wired to real `favourites` table.
3. **Cascade mapping fix** (commit 05dd1cd): whatsapp node correctly maps to `selectedWhatsAppSequenceId` (was incorrectly mapped to `selectedEmailSequenceId`). Full 8-node audit confirmed no other mismatches. 10 tests locking each node to its own selected column.
4. **Baseline analytics** (commit 5bcfd52): `campaign_started`, `node_completed`, `campaign_completed`, `option_recrowned` events firing via `product_events` table.
5. **Double Continue button** (commit 5bcfd52): removed from V2UniqueMethodResultPanel.

— END OF SPEC v1.3 —
