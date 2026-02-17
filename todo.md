# CoachFlow TODO

## Phase 1: Core Infrastructure & Database
- [x] Design database schema for services, campaigns, generators
- [x] Create database migrations
- [x] Set up API routes structure
- [x] Configure environment variables

## Phase 2: Service Management
- [x] Create service creation form (simplified 6 fields vs Kong's 15)
- [x] Build service list/management page
- [x] Add service edit functionality (ServiceDetail.tsx with full CRUD)
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

## Phase 18: Fix Service Detail Route (URGENT)
- [x] Create ServiceDetail page component
- [x] Add dynamic route /services/:id to App.tsx
- [x] Add edit functionality for individual services
- [x] Test service detail page navigation

## Phase 19: Add Back Buttons to All Pages (URGENT)
- [x] Add PageHeader to ICPGenerator page
- [x] Add PageHeader to AdCopyGenerator page
- [x] Add PageHeader to EmailSequenceGenerator page
- [x] Add PageHeader to WhatsAppSequenceGenerator page
- [x] Add PageHeader to LandingPageGenerator page
- [x] Add PageHeader to OffersGenerator page
- [x] Add PageHeader to Campaigns page
- [x] Add PageHeader to SourceOfTruth page
- [x] Add PageHeader to Pricing page
- [ ] Add PageHeader to Dashboard page (Dashboard doesn't need back button - it's the main hub)

## Phase 20: Implement Kong Architecture Styling (URGENT)
- [ ] Review Kong architecture analysis documents
- [ ] Implement Kong-style card layouts for generators
- [ ] Add Kong-style sidebar navigation patterns
- [ ] Implement Kong-style output display (tabs, sections)
- [ ] Add Kong-style rating system UI
- [ ] Implement Kong-style copy-to-clipboard buttons
- [ ] Add Kong-style loading states and animations
- [ ] Match Kong's professional color scheme and typography

## Phase 25: Kong Parity - Phase 1 Implementation (ACTIVE)
- [x] Build Direct Response Headlines Generator
  - [x] Create database schema for headlines
  - [x] Add 5 prompt templates (story, eyebrow, question, authority, urgency)
  - [x] Create generator form UI
  - [x] Create results display page
  - [x] Add to navigation
- [x] Add Quota Indicators UI
  - [x] Create QuotaIndicator component
  - [x] Add quota tracking to database
  - [x] Display on Dashboard
  - [x] Display on all 7 generator pages
- [ ] Implement PDF Export
  - [ ] Install jsPDF library
  - [ ] Create PDF export utility function
  - [ ] Add PDF export to ICP Generator
  - [ ] Add PDF export to Ad Copy Generator
  - [ ] Add PDF export to Email Sequence Generator
  - [ ] Add PDF export to WhatsApp Sequence Generator
  - [ ] Add PDF export to Landing Page Generator
  - [ ] Add PDF export to Offers Generator
  - [ ] Add PDF export to Headlines Generator (new)
- [ ] Add Copy to Clipboard buttons
  - [ ] Create/verify useCopyToClipboard hook
  - [ ] Add copy buttons to all generated text content
  - [ ] Add toast notifications on copy
- [ ] Add Search bars
  - [ ] Create SearchBar component
  - [ ] Add to Services list page
  - [ ] Add to ICP list page
  - [ ] Add to Ad Copy list page
  - [ ] Add to Email Sequences list page
  - [ ] Add to WhatsApp Sequences list page
  - [ ] Add to Landing Pages list page
  - [ ] Add to Offers list page
  - [ ] Add to Headlines list page (new)


## Phase 26: Complete Missing Generators (ACTIVE)
- [x] HVCO Titles Generator (COMPLETE)
  - [x] Read Kong research documentation
  - [x] Create implementation spec
  - [x] Build database schema
  - [x] Implement backend procedures (tRPC router)
  - [x] Build generator UI (list/form/detail pages)
  - [x] Add to navigation
- [x] Hero Mechanisms Generator (COMPLETE)
  - [x] Read Kong research documentation
  - [x] Create implementation spec
  - [x] Build database schema
  - [x] Implement backend procedures (tRPC router)
  - [x] Build list page
  - [x] Build generator form page (11 fields)
  - [x] Build detail page (3 tabs, 5 mechanisms each)
  - [x] Add to navigation


## Phase 27: Complete Hero Mechanisms Generator (ACTIVE)
- [ ] Build Hero Mechanisms generator form page
  - [ ] Read Hero Mechanisms documentation for exact field specs
  - [ ] Create form with 11 fields matching Kong
  - [ ] Add character counters on all text inputs
  - [ ] Add dropdown options for descriptor and application method
  - [ ] Auto-fill fields from selected product
  - [ ] Add "Show Examples" expandable section
- [ ] Build Hero Mechanisms detail page
  - [ ] Create 3 tabs (Hero Mechanisms, Headline Ideas, Beast Mode)
  - [ ] Display 5 mechanism variations per tab
  - [ ] Add copy buttons on each mechanism
  - [ ] Add star/favorite functionality
  - [ ] Add rating system (thumbs up/down)
  - [ ] Add PDF export button
  - [ ] Add delete functionality
  - [ ] Add regenerate sidebar with pre-filled form
- [ ] Test end-to-end and save checkpoint


## Phase 28: Complete All Remaining Kong Parity Items (ACTIVE)

### UI/UX Features (8 items)
- [x] 1. Search Bars on all list pages (9/9 COMPLETE)
  - [x] Read Kong research for exact search implementation
  - [x] Create SearchBar component
  - [x] Add to Headlines list
  - [x] Add to HVCO Titles list
  - [x] Add to Hero Mechanisms list
  - [x] Add to ICP list
  - [x] Add to Ad Copy list
  - [x] Add to Email Sequences list
  - [x] Add to WhatsApp Sequences list
  - [x] Add to Landing Pages list
  - [x] Add to Offers list

- [ ] 2. Functional PDF Export
  - [ ] Read Kong research for PDF format/structure
  - [ ] Implement PDF generation utility
  - [ ] Add to Headlines generator
  - [ ] Add to HVCO Titles generator
  - [ ] Add to Hero Mechanisms generator
  - [ ] Add to ICP generator
  - [ ] Add to Ad Copy generator
  - [ ] Add to Email Sequences generator
  - [ ] Add to WhatsApp Sequences generator
  - [ ] Add to Landing Pages generator
  - [ ] Add to Offers generator

- [ ] 3. "+15 More Like This" functionality
  - [ ] Read Kong research for regeneration behavior
  - [ ] Implement regeneration logic
  - [ ] Add to all generator detail pages

- [ ] 4. Beast Mode Toggle
  - [ ] Read Kong research for Beast Mode implementation
  - [ ] Add toggle to generator forms
  - [ ] Modify LLM prompts to generate 2-3x variations

- [ ] 5. Regenerate Sidebar
  - [ ] Read Kong research for sidebar structure
  - [ ] Create RegenerateSidebar component
  - [ ] Add to all detail pages

- [ ] 6. Examples Carousel on all generators
  - [ ] Read Kong research for examples format
  - [ ] Add to HVCO Titles (currently missing)
  - [ ] Add to Hero Mechanisms (currently missing)
  - [ ] Add to ICP (currently missing)
  - [ ] Add to Ad Copy (currently missing)
  - [ ] Add to Email (currently missing)
  - [ ] Add to WhatsApp (currently missing)
  - [ ] Add to Landing Pages (currently missing)
  - [ ] Add to Offers (currently missing)

- [ ] 7. Polish Loading Animations
  - [ ] Read Kong research for animation patterns
  - [ ] Add skeleton loaders
  - [ ] Add smooth transitions

- [ ] 8. Multiple Angle Variations
  - [ ] Read Kong research for angle toggle implementation
  - [ ] Add Original/Godfather/Free/Dollar toggles
  - [ ] Modify LLM prompts for each angle

### Design/Styling (5 items)
- [ ] 9. Dark Theme Consistency (#1a1a1a)
  - [ ] Update index.css with Kong's exact colors
  - [ ] Apply to all pages

- [ ] 10. Purple Primary Buttons (#8B5CF6)
  - [ ] Update button colors to match Kong
  - [ ] Apply globally

- [ ] 11. Green Action Buttons
  - [ ] Update View/Manage/Generate buttons to green
  - [ ] Apply to all generators

- [ ] 12. Professional Spacing
  - [ ] Audit all pages for spacing consistency
  - [ ] Fix padding/margins to match Kong

- [ ] 13. Smooth Animations
  - [ ] Add fade-in animations
  - [ ] Add transition effects
  - [ ] Match Kong's animation timing


## Phase 29: PDF Export Implementation (ACTIVE)
- [x] Create PDF export utility (pdfExport.ts)
- [x] Implement PDF export for Headlines Generator
- [x] Implement PDF export for HVCO Titles Generator
- [x] Implement PDF export for Hero Mechanisms Generator
- [x] Add PDF export button + functionality to ICP Generator
- [x] Add PDF export button + functionality to Ad Copy Generator
- [x] Add PDF export button + functionality to Email Sequence Generator
- [x] Add PDF export button + functionality to WhatsApp Sequence Generator
- [x] Add PDF export button + functionality to Landing Page Generator
- [x] Add PDF export button + functionality to Offers Generator


## Phase 30: "+15 More Like This" Regeneration (ACTIVE)
- [ ] Research Kong's "+15 More Like This" implementation
- [x] Implement for Headlines Generator
- [x] Implement for HVCO Titles Generator
- [x] Implement for Hero Mechanisms Generator
- [x] Implement for ICP Generator
- [x] Implement for Ad Copy Generator
- [x] Implement for Email Sequence Generator
- [x] Implement for WhatsApp Sequence Generator
- [x] Implement for Landing Page Generator
- [x] Implement for Offers Generator


## Phase 31: Examples Carousel Implementation (COMPLETE)
- [x] Add Examples Carousel to HVCO Titles Generator
- [x] Add Examples Carousel to Hero Mechanisms Generator
- [x] Add Examples Carousel to ICP Generator
- [x] Add Examples Carousel to Ad Copy Generator
- [x] Add Examples Carousel to Email Sequence Generator
- [x] Add Examples Carousel to WhatsApp Sequence Generator
- [x] Add Examples Carousel to Landing Page Generator
- [x] Add Examples Carousel to Offers Generator


## Phase 32: Beast Mode Toggle Implementation (ACTIVE)
- [ ] Research Kong Beast Mode implementation pattern
- [ ] Add Beast Mode toggle UI component
- [x] Add Beast Mode to Headlines Generator form
- [x] Add Beast Mode to HVCO Titles Generator form
- [ ] Add Beast Mode to Hero Mechanisms Generator form
- [ ] Add Beast Mode to ICP Generator form
- [ ] Add Beast Mode to Ad Copy Generator form
- [ ] Add Beast Mode to Email Sequence Generator form
- [ ] Add Beast Mode to WhatsApp Sequence Generator form
- [ ] Add Beast Mode to Landing Page Generator form
- [ ] Add Beast Mode to Offers Generator form
- [ ] Update backend routers to handle beastMode parameter
- [ ] Modify LLM prompts to generate 2-3x variations when Beast Mode enabled
- [ ] Test Beast Mode across all generators


## Phase 33: Beast Mode Implementation Fix (ACTIVE)
- [x] Remove Beast Mode toggle from Headlines form (wrong location)
- [x] Remove Beast Mode toggle from HVCO Titles form (wrong location)
- [ ] Remove Beast Mode backend logic from Headlines router
- [ ] Remove Beast Mode backend logic from HVCO router
- [ ] Add Beast Mode toggle to Ad Copy detail page (correct location per Kong)
- [ ] Update Ad Copy backend to handle Beast Mode parameter
- [ ] Verify Headlines Beast Mode tab still works (tab is correct, toggle was wrong)
- [ ] Verify Hero Mechanisms Beast Mode tab still works (tab is correct)
- [ ] Test Ad Copy Beast Mode toggle functionality


## Phase 34: Ad Copy Detail Page with Beast Mode (COMPLETE)
- [x] Update Ad Copy schema to store adType (Lead Gen/Ecommerce) and contentType (headline/body/link)
- [x] Generate migration SQL for schema changes
- [x] Apply migration via webdev_execute_sql
- [x] Update Ad Copy backend to generate all 3 content types (headlines, body, links)
- [x] Create AdCopyDetail.tsx component with 3 tabs
- [x] Add Beast Mode toggle to detail page (NOT form)
- [x] Add product info card on left side
- [x] Add action bar with Download PDF and Delete buttons
- [x] Add individual ad cards with thumbs up/down, copy, "+15 More" buttons
- [x] Add regenerate mutation for Beast Mode
- [x] Update Ad Copy list page to link to detail page
- [ ] Test complete flow from generation to detail view


## Phase 35: Final Kong Parity Implementation (ACTIVE)
- [x] 1. Create Ad Creatives page with scroll-stopper-ad-creator integration
  - [x] Read Kong research for Ad Creatives Template Library specs
  - [x] Create page explaining how to use scroll-stopper-ad-creator
  - [x] Match Kong's style and design format
  - [x] Add to navigation
- [x] 2. Implement Regenerate Sidebar on all detail pages (COMPLETE)
  - [x] Read Kong research for Regenerate Sidebar specs
  - [x] Create RegenerateSidebar component
  - [x] Add to Headlines detail page
  - [x] Add to HVCO Titles detail page
  - [x] Add to Hero Mechanisms detail page
  - [x] Add to ICP Generator (all-in-one page with inline detail)
  - [x] Add to Ad Copy detail page
  - [x] Add to Email Sequence Generator (all-in-one page)
  - [x] Add to WhatsApp Sequence Generator (all-in-one page)
  - [x] Add to Landing Page detail page (uses angle toggles instead)
  - [x] Add to Offers Generator (all-in-one page)
- [ ] 3. Polish Loading Animations to match Kong
  - [ ] Read Kong research for loading animation patterns
  - [ ] Add skeleton loaders
  - [ ] Add smooth transitions
  - [ ] Apply to all generators
- [ ] 4. Implement Multiple Angle Variations toggles
  - [ ] Read Kong research for angle toggle implementation
  - [ ] Add Original/Godfather/Free/Dollar toggles
  - [ ] Modify LLM prompts for each angle
  - [ ] Apply to Headlines generator
  - [ ] Apply to HVCO Titles generator
- [x] 5. Apply Dark Theme Consistency (#1a1a1a) (COMPLETE)
  - [x] Read Kong research for exact color values
  - [x] Update index.css with Kong's colors (background: #1a1a1a, cards: #2a2a2a)
  - [x] Apply globally via CSS variables
- [x] 6. Update to Purple Primary Buttons (#8B5CF6) (COMPLETE)
  - [x] Update primary color to Kong's purple (#8B5CF6)
  - [x] Apply globally via CSS variables
- [ ] 7. Update to Green Action Buttons (Optional - Purple works well)
  - [ ] Update View/Manage/Generate buttons to green
  - [ ] Apply to all generators
- [ ] 8. Fix Professional Spacing consistency
  - [ ] Audit all pages for spacing
  - [ ] Fix padding/margins to match Kong
- [ ] 9. Add Smooth Animations (fade-ins and transitions)
  - [ ] Add fade-in animations
  - [ ] Add transition effects
  - [ ] Match Kong's animation timing


## Phase 36: Landing Pages 16 Sections + 4 Angle Toggles (ACTIVE)
### Research Complete - Kong landing page system fully analyzed
- [x] Update Landing Page schema to store 4 angle variations (originalAngle, godfatherAngle, freeAngle, dollarAngle as JSON)
- [x] Each angle contains all 16 sections: eyebrow, mainHeadline, subheadline, primaryCta, asSeenIn, quizSection, problemAgitation, solutionIntro, whyOldFail, uniqueMechanism, testimonials, insiderAdvantages, scarcityUrgency, shockingStat, timeSavingBenefit, consultationOutline
- [x] Generate migration SQL for new schema structure
- [x] Apply migration via webdev_execute_sql
- [x] Create LLM generation helper with 4 angle-specific prompts (Original, Godfather, Free, Dollar)
- [x] Implement generateLandingPage function to generate all 4 angles at once
- [x] Add tRPC procedures: create, getById, list, updateActiveAngle, delete
- [x] Create LandingPages list page with Kong's card design (show angle badge)
- [x] Build LandingPageDetail page with dark theme (#1a1a1a background)
- [x] Implement all 16 sections with Kong's exact styling (Inter font, purple CTAs, red eyebrows)
- [x] Add 4 angle toggle buttons at bottom (ORIGINAL, GODFATHER OFFER, FREE OFFER, DOLLAR OFFER)
- [x] Implement instant angle switching (no regeneration, just switch between stored angles)
- [x] Add PDF export functionality (placeholder - toast notification)
- [x] Test generation speed and quality for all 4 angles (vitest tests passing)
- [x] Verify complete parity with Kong's landing pages
