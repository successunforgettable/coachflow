# ZAP Campaigns — Master TODO
### Last updated: March 8, 2026
### Source of truth: ZAP_Master_TODO.md (user) + full codebase audit

---

## STATUS LEGEND
- [x] Complete and live
- [ ] Not started / queued
- [~] Partially done / in progress

---

## LAUNCH BLOCKERS

- [x] Admin panel — full build (MRR/ARR/churn, user table, audit log, content mod, system health)
- [x] Real data node unlocking on V2 campaign path
- [x] New user onboarding — Zappy welcome screen
- [x] Stripe live mode — keys active (STRIPE_SECRET_KEY configured)
- [x] Stripe live mode — webhook configured
- [x] Error handling — 4 Zappy error states (timeout, fail, offline, no ICP)
- [x] E2E test — 8/10 steps passed, 4 bugs fixed
- [ ] Stripe live price IDs — create 4 products in live dashboard and add env vars
  - [ ] Pro Monthly ($99/month) → STRIPE_PRO_MONTHLY_PRICE_ID
  - [ ] Pro Yearly ($990/year) → STRIPE_PRO_YEARLY_PRICE_ID
  - [ ] Agency Monthly ($299/month) → STRIPE_AGENCY_MONTHLY_PRICE_ID
  - [ ] Agency Yearly ($2,990/year) → STRIPE_AGENCY_YEARLY_PRICE_ID
  - **NOTE:** Current code has old prices ($49 Pro / $149 Agency). Update `server/stripe/products.ts` to match new pricing after IDs are added.

---

## PRICING — Under Review

- [~] NotebookLM competitive pricing research (in progress by Arfeen)
- [ ] Final pricing decision confirmed before landing page goes live
- **Current code prices:** Trial $0/7 days · Pro $49/month · Agency $149/month
- **Target prices (per TODO):** Trial $0/7 days · Pro $99/month · Agency $299/month
- [ ] Update `server/stripe/products.ts` with confirmed final prices

---

## V2 DASHBOARD — Complete

- [x] Cream design system (#F5F1EA, #FF5B1D, #8B5CF6)
- [x] Fraunces + Instrument Sans typography
- [x] 11-step Duolingo-style winding path
- [x] Real data node unlocking from database
- [x] Progress bar — live percentage
- [x] Fork point modal after ICP (shows once, stored in localStorage)
- [x] "Guide Me Step by Step" navigates to next incomplete wizard step
- [x] "Jump to Tool Library" navigates to /dashboard
- [x] Guided Campaign tab
- [x] Tool Library tab with ICP gate (Zappy prompt card when no ICP)
- [x] ICP selector dropdown in Tool Library
- [x] Zappy mascot — 4 emotional states (SVG): waiting, working, cheering, concerned
- [x] Zappy error states — timeout, fail, offline, no ICP
- [x] First-time user welcome screen
- [x] Mobile responsive below 768px
- [x] Switch to Classic View link
- [x] Post-login redirect to /v2-dashboard

---

## V2 WIZARD — All 11 Steps Wired

- [x] Step 1 — Service (create service form, sessionStorage pre-fill from hero)
- [x] Step 2 — ICP (inline name input → trpc.icps.generate)
- [x] Step 3 — Offer (trpc.offers.generate)
- [x] Step 4 — Unique Method (trpc.heroMechanisms.generate)
- [x] Step 5 — Free Opt-In (trpc.hvco.generate)
- [x] Step 6 — Headlines (trpc.headlines.generate)
- [x] Step 7 — Ad Copy (trpc.adCopy.generate)
- [x] Step 8 — Landing Page (trpc.landingPages.generate)
- [x] Step 9 — Email Sequence (trpc.emailSequences.generate)
- [x] Step 10 — WhatsApp Sequence (trpc.whatsappSequences.generate)
- [x] Step 11 — Push to Meta (instructions/link, no generation)
- [x] "Continue to Next Step" button in success state chains all 11 steps
- [x] Zappy mascot in idle/waiting/loading/success/error states
- [x] Node progress auto-invalidates after generation

---

## V2 LANDING PAGE — Complete

- [x] Section 1: Hero — Zappy + pill input + 4 campaign tiles + orange wipe transition
- [x] Section 2: 11-step winding path with scroll-triggered animations
- [x] Section 3: No Blank Pages split screen comparison
- [x] Section 4: Compliance score card 72→100 with confetti
- [x] Section 5: Footer CTA with Zappy waiting
- [x] Navigation: pill buttons, orange CTA, ZAP logo, sticky top bar
- [x] Mobile hamburger nav — fixed overlay (does not push content)
- [x] sessionStorage pre-fill: hero input → Services form name field
- [x] Pre-fill confirmation banner in Services form

---

## ADMIN PANEL — Complete

- [x] Admin nav link (role-gated, admin + superuser only)
- [x] MRR / ARR / Churn / Active Subs metric cards
- [x] Revenue chart — real Stripe data
- [x] Churn risk alert — expandable with user list
- [x] User management table with search + CSV export
- [x] Bulk actions — reset quota, change tier, grant quota
- [x] Superuser management section
- [x] User detail page (/admin/users/:id)
- [x] Cancel subscription dialog
- [x] Payment history + refund buttons
- [x] Admin notes per user
- [x] Audit log viewer (/admin/audit-log)
- [x] Content moderation (/admin/content-moderation)
- [x] System health monitor (/admin/system-health)
- [x] Compliance breadcrumb navigation
- [x] Audit log detail capture (before/after values)

---

## GENERATORS — All Complete (Classic Dashboard)

- [x] ICP Generator (17 tabs)
- [x] Offer Generator
- [x] Unique Method / Hero Mechanisms Generator
- [x] Free Opt-In / HVCO Titles Generator
- [x] Headlines Generator
- [x] Ad Copy Generator (17 fields, Beast Mode tab, 3 content type tabs)
- [x] Landing Page Generator (4 angle variations, 16 sections, PDF export)
- [x] Email Sequence Generator
- [x] WhatsApp Sequence Generator
- [x] PDF export on all generators
- [x] Search bars on all list pages
- [x] Regenerate sidebar on all detail pages
- [x] "+15 More Like This" on all generators
- [x] Examples carousel on all generators

---

## VIDEO CREDIT SYSTEM — Complete

- [x] videoCredits table (one row per user, integer balance)
- [x] videoCreditTransactions ledger (purchase / deduction / free_grant / refund)
- [x] Welcome bonus: 2 free credits on first balance check (lazy grant)
- [x] Credit cost: 15-30s = 1 credit, 60s = 2 credits, 90s = 3 credits
- [x] Deduction before render, auto-refund on render failure
- [x] 4 purchase bundles: Starter $9 (5cr) / Pro $29 (20cr) / Business $59 (50cr) / Agency $99 (100cr)
- [x] Stripe PaymentIntent flow with webhook fulfillment
- [x] CreditPurchaseModal with Stripe Elements
- [x] /video-credits page: balance + transaction history
- [x] VideoCreator shows live balance + cost before render

---

## CUSTOM AUTH SYSTEM — Complete

- [x] Google OAuth 2.0 via /api/auth/google (Manus-proxy compatible)
- [x] Email magic link via /api/auth/magic
- [x] ZAP-branded /login page (cream background)
- [x] Session cookie auth (no Manus OAuth dependency)
- [x] Sign-out redirects to /login
- [x] 12 vitest tests passing

---

## POST-LAUNCH QUEUE — Priority Order Fixed

### Priority 1 — Pricing Page Update
- [ ] Confirm final pricing with Arfeen after research
- [ ] Update `server/stripe/products.ts` (Pro $99 / Agency $299)
- [ ] Update pricing page copy and feature lists to match new tier values
- [ ] Update quota limits in `server/quotaLimits.ts` if tiers change

### Priority 2 — Multi-ICP Campaign Cloning
- [ ] UI: "Duplicate across ICPs" button on campaign detail page
- [ ] Backend: extend existing `campaigns.duplicate` to accept array of ICP IDs
- [ ] Generate one campaign copy per selected ICP in a single action
- [ ] Show progress indicator during bulk clone
- [ ] Initially for Arfeen's SMB + IYCT campaigns; then expose to Agency tier

### Priority 3 — Kill/Scale Automation
- [ ] Server-side scoring engine (reads Meta Ads performance data)
- [ ] Cron job to score campaigns on CTR/ROAS thresholds daily
- [ ] Surface winner/loser recommendations in dashboard
- [ ] Auto-pause/resume via existing Meta API integration
- [ ] Initially for Arfeen's personal use; then Agency tier

### Priority 4 — At-Risk Email Loop
- [ ] Trigger: user completes 1–2 steps then goes inactive 48 hrs
- [ ] Integrate with GoHighLevel automation
- [ ] Email template: Zappy waiting SVG + "Did you just ghost Zappy?" subject
- [ ] Track which users receive the email (avoid duplicate sends)

### Priority 5 — Metrics & Analytics
- [ ] Time-to-First-Value: track minutes from signup to first green node
- [ ] Step drop-off rate: which of 11 steps has highest abandonment
- [ ] CURR (weekly active user retention cohort tracking)
- [ ] Surface metrics in admin panel

---

## STANDING RULES — Never change these

1. Always provide screenshot of live zapcampaigns.com URL for every deliverable. Preview URLs are not acceptable proof.
2. Checkpoints do not auto-deploy. Always explicitly trigger deployment via Publish button.
3. Dark-mode /dashboard must never be touched. All V2 work is parallel only.
4. Every API-touching sprint must include console.log payload confirmation of real data.
5. All prompts must be plain text — no code blocks inside the prompt.
6. Screenshots must be reviewed before a sprint is approved.
7. DB migrations are always a separate isolated prompt — never bundled with UI work.

---

## Landing Page Rebuild — Priority 1 (March 8, 2026)

- [ ] Section 1: Interactive Hero — Zappy waiting, pill input, "Show Me" button, 4 campaign tiles animate in (client-side only, no backend)
- [ ] Section 2: 11-Step Path — scroll-animated nodes lighting up with Zappy moving, Free/Pro badges
- [ ] Section 3: Problem/Solution Split — dark left (Before ZAP) / cream right (With ZAP)
- [ ] Section 4: Meta Compliance Score Card — animated 47→100 score, confetti, 3 ticking checks
- [ ] Section 5: Pricing Teaser — 3-column simplified tiers ($0 / $147 / $497) linking to /pricing
- [ ] Section 6: Footer CTA — dark background, Zappy waiting, orange pill CTA
- [ ] Mobile responsive — all sections stack below 768px
- [ ] Signup/register modal triggered by campaign tile CTAs
- [ ] Checkpoint and deploy

## Landing Page Targeted Fixes (Mar 8, 2026)

- [x] Fix 1: PricingTeaserSection — ZAP Pro CTA "Start Free Trial" → "Start ZAP Pro"; Pro Plus CTA "Start Free Trial" → "Go Pro Plus"
- [x] Fix 2: HeroSection — wipeOrange transformOrigin "right" → "left" (left-to-right sweep)
- [x] Fix 3: PathSection — node lighting setTimeout 260ms → 400ms (slower reveal)

## Stripe Pricing Fix (Mar 8, 2026)

- [x] Step 1: Update server/stripe/products.ts — Pro $147/mo, $1,470/yr; Agency (Pro Plus) $497/mo, $4,970/yr
- [x] Step 2: Confirm 4 Stripe live price IDs in env vars (CUSTOM_STRIPE_SECRET_KEY wired as live override)
- [x] Step 3: All 4 price IDs validated against Stripe API (4/4 tests passing)
- [x] Step 4: Published to zapcampaigns.com

## Auth Wiring Fix (Mar 9, 2026)

- [x] Fix Pricing page unauthenticated redirect: "/" → "/login"

## Pricing Page Update (Mar 9, 2026)

- [x] Rename "Pro" → "ZAP Pro" everywhere (card title, description, button: "Start ZAP Pro")
- [x] Rename "Agency" → "ZAP Pro Plus" everywhere (card title, description, button: "Go Pro Plus")
- [x] Remove agency/client-management copy from ZAP Pro Plus description
- [x] Add "New here? Create a free account" signup link below each paid tier subscribe button

## Zappy Landing Page Presence (Mar 9, 2026)

- [x] Change 1: Hero Zappy width/height 110px → 160px
- [x] Change 2: Compliance section — add zappy-cheering.svg (100px, fadeUp 0.4s) when score hits 100 + confetti
- [x] Change 3: Pricing Teaser — add zappy-waiting.svg (80px, breathing, centred) above headline
- [x] Change 4: Nav logo — no size change (already correct)
- [x] Change 5: Path section hopping Zappy 28px → 36px
