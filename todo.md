# CoachFlow TODO

## Phase 1: Core Infrastructure & Database
- [x] Design database schema for services, campaigns, generators
- [x] Create database migrations
- [x] Set up API routes structure
- [x] Configure environment variables

## Phase 2: Service Management
- [x] Create service creation form (simplified 6 fields vs Kong's 15)
- [x] Build service list/management page
- [ ] Add service edit functionality
- [x] Create service deletion with confirmation

## Phase 3: Ideal Customer Profile Generator
- [x] Build ICP generator form
- [x] Integrate OpenAI API for generation
- [x] Create ICP display page (5 sections vs Kong's 17)
- [x] Add rating system (thumbs up/down)
- [x] Implement regenerate functionality

## Phase 4: Ad Copy Generator
- [x] Build ad copy generator form
- [x] Generate 10 headline variations (vs Kong's 15+)
- [x] Organize by type (story, authority, question, CTA)
- [x] Add copy-to-clipboard functionality
- [x] Implement "+10 More" regeneration

## Phase 5: Email Sequence Generator (NEW - Kong missing)
- [x] Build email sequence generator
- [x] Generate 5-day welcome sequence
- [x] Generate 7-day engagement sequence
- [x] Generate 5-day sales sequence
- [x] Add personalization tokens
- [x] Implement timing recommendations

## Phase 6: WhatsApp Sequence Generator (NEW - Kong missing)
- [x] Build WhatsApp sequence generator
- [x] Generate 3-day engagement sequence
- [x] Generate 2-day sales sequence
- [x] Add emoji suggestions
- [x] Implement timing recommendations

## Phase 7: Landing Page Generator
- [x] Build landing page generator
- [x] Generate 3 landing page angles (vs Kong's unlimited)
- [x] Create preview functionality
- [x] Add PDF export
- [x] Implement edit/customize

## Phase 8: Offer Generator
- [x] Build offer generator form
- [x] Generate 3 offer types (Standard, Premium, VIP)
- [x] Add bonus suggestions
- [x] Create guarantee templates
- [x] Implement scarcity messaging

## Phase 9: Campaign Builder (NEW - Kong missing)
- [x] Design campaign builder UI
- [ ] Implement drag-and-drop timeline
- [ ] Add asset linking (ads → emails → landing pages)
- [ ] Create visual workflow
- [ ] Add timing/scheduling

## Phase 10: Analytics Dashboard (NEW - Kong missing)
- [ ] Design analytics dashboard
- [ ] Track campaign performance
- [ ] Show email open/click rates
- [ ] Display conversion rates
- [ ] Calculate ROI

## Phase 11: Subscription & Billing
- [x] Integrate Stripe
- [x] Create subscription plans (Free trial, Pro $49, Agency $149)
- [x] Implement usage quota tracking
- [x] Add upgrade/downgrade flows
- [x] Create billing management page

## Phase 12: User Experience
- [ ] Design onboarding wizard
- [ ] Create industry-specific templates
- [ ] Build help/documentation
- [ ] Add tooltips and guidance
- [x] Implement dark/light theme

## Phase 13: Testing & Deployment
- [ ] Write unit tests for all generators
- [ ] Test subscription flows
- [ ] Test campaign builder
- [ ] Performance optimization
- [ ] Security audit
- [ ] Deploy to production

## Phase 14: Navigation & UX Improvements (URGENT)
- [ ] Fix 404 error on navigation
- [ ] Add back buttons to all generator pages
- [ ] Add breadcrumb navigation
- [ ] Fix sidebar navigation highlighting
- [ ] Add "Home" button to all pages

## Phase 15: Source of Truth Generator (NEW)
- [ ] Create AI-powered service profile generator
- [ ] User fills in: program name + 3-5 key details
- [ ] AI generates complete service profile (6 fields)
- [ ] Store as "source of truth" for all generators
- [ ] Auto-populate generator inputs from source of truth

## Phase 16: Guided Onboarding Wizard (NEW)
- [ ] Create multi-step onboarding flow
- [ ] Step 1: Welcome + explain platform
- [ ] Step 2: Generate source of truth (AI service profile)
- [ ] Step 3: Create first ICP
- [ ] Step 4: Generate first ad copy
- [ ] Step 5: Create first email sequence
- [ ] Add progress indicator (1/5, 2/5, etc.)
- [ ] Add "Skip" and "Next" buttons

## Phase 17: Editable Source of Truth (NEW)
- [ ] Create database table for source of truth
- [ ] Store generated profile in database
- [ ] Create Source of Truth page with edit functionality
- [ ] Allow users to manually edit all fields
- [ ] Auto-populate service creation from source of truth
- [ ] Add "Use Source of Truth" button in service creation
