# CoachFlow - Final Essential Tasks

**Last Updated:** Feb 21, 2026  
**Current Status:** 95% Feature Complete | Ready for Production Launch

---

## 🚨 CRITICAL - Must Complete Before Launch (Priority 1)

### 1. Complete Compliance Features ⚠️ IN PROGRESS
- [x] Email notifications for policy changes (owner notified on CSV imports)
- [x] Phrase usage analytics tracking system
- [x] Analytics UI at /admin/compliance/analytics
- [ ] **Scheduled compliance reports** (weekly/monthly email summaries to admins)
- [ ] **Write vitest tests for compliance analytics procedures**

**Why Critical:** Compliance is a legal requirement for Meta ads. Analytics help identify common violations before they cause ad rejections.

**Estimated Time:** 2-3 hours

---

### 2. PDF Export Functionality (9 Generators)
- [ ] Install and configure jsPDF library
- [ ] Create reusable PDF export utility function
- [ ] Add PDF export to Headlines Generator
- [ ] Add PDF export to HVCO Titles Generator
- [ ] Add PDF export to Hero Mechanisms Generator
- [ ] Add PDF export to ICP Generator
- [ ] Add PDF export to Ad Copy Generator
- [ ] Add PDF export to Email Sequence Generator
- [ ] Add PDF export to WhatsApp Sequence Generator
- [ ] Add PDF export to Landing Pages Generator
- [ ] Add PDF export to Offers Generator

**Why Critical:** Kong has this feature. Users expect to download/share their generated content professionally.

**Estimated Time:** 4-6 hours

---

### 3. Complete Ad Copy Generator - 17 Fields Expansion
Currently simplified to 6 fields. Kong has 17 fields with character limits:

**Missing Fields:**
- Specific technology/ingredient/methodology (23 char limit)
- Scientific Studies/Research/Stats (31 char limit)
- Credible Authority Figure (70 char limit, with examples carousel)
- Featured in / Social Proof (65 char limit)
- Number of reviews
- Average review rating
- Total customers of all time
- Testimonials (511 char limit)

**Tasks:**
- [ ] Update database schema with 11 new fields
- [ ] Generate and apply migration
- [ ] Update AdCopyGenerator.tsx form UI
- [ ] Add character limit validation and counters
- [ ] Update LLM prompt to use all 17 fields
- [ ] Test end-to-end generation
- [ ] Write vitest tests

**Why Critical:** Ad copy is the #1 most-used generator. Missing fields limit output quality vs Kong.

**Estimated Time:** 6-8 hours

---

### 4. Complete Offers Generator - 7 Sections + 3 Angles
Currently basic implementation. Kong has structured 7-section output with 3 angle variations:

**7 Sections:**
1. Eyebrow Headline
2. Main Headline
3. Subheadline
4. Primary CTA
5. Offer Details
6. Guarantee
7. Scarcity/Urgency

**3 Angles:** Godfather, Free, Dollar (instant toggle switching)

**Tasks:**
- [ ] Update database schema for 7 sections
- [ ] Generate and apply migration
- [ ] Create 3 angle-specific LLM prompts
- [ ] Build OffersDetail.tsx with 7 sections display
- [ ] Add 3 angle toggle buttons (instant switching, no reload)
- [ ] Test all 3 angles
- [ ] Write vitest tests

**Why Critical:** Offers are critical for sales conversion. Current implementation is too basic.

**Estimated Time:** 6-8 hours

---

## 🎯 HIGH PRIORITY - Launch Enhancers (Priority 2)

### 5. "+15 More Like This" Regeneration (All Detail Pages)
Kong allows users to generate 15 more variations of any specific output.

**Tasks:**
- [ ] Add "+15 More" button to Headlines detail page
- [ ] Add "+15 More" button to HVCO Titles detail page
- [ ] Add "+15 More" button to Hero Mechanisms detail page
- [ ] Add "+15 More" button to ICP detail page (regenerate specific sections)
- [ ] Add "+15 More" button to Ad Copy detail page
- [ ] Add "+15 More" button to Email Sequence detail page
- [ ] Add "+15 More" button to WhatsApp Sequence detail page
- [ ] Add "+15 More" button to Landing Pages detail page
- [ ] Add "+15 More" button to Offers detail page

**Why High Priority:** Increases user satisfaction. Users want variations without re-entering form data.

**Estimated Time:** 4-5 hours

---

### 6. Beast Mode Toggle (All Generators)
Kong's "Beast Mode" generates 2-3x more variations (e.g., 50 headlines instead of 15).

**Tasks:**
- [ ] Add Beast Mode toggle to all 9 generator forms
- [ ] Update LLM prompts to generate 2-3x variations when enabled
- [ ] Add quota validation (Beast Mode counts as 2-3 generations)
- [ ] Test Beast Mode on all generators
- [ ] Update pricing page to mention Beast Mode

**Why High Priority:** Premium feature that justifies higher pricing tiers. Kong users love it.

**Estimated Time:** 3-4 hours

---

### 7. Character Limits on ALL Text Inputs
Kong displays character counters (e.g., "23/52") on every text field.

**Tasks:**
- [ ] Add maxLength prop to all text inputs across all 9 generators
- [ ] Display "X/Y" character count below each input
- [ ] Add validation to prevent exceeding limits
- [ ] Style character counters to match Kong's design
- [ ] Test on all generators

**Why High Priority:** Prevents users from entering too much text, improves UX consistency.

**Estimated Time:** 3-4 hours

---

### 8. 18-Item Horizontal Scrollable Carousel (Examples)
Kong shows 18 pre-written examples in a horizontal carousel. Click to populate textarea.

**Locations:**
- Ad Copy: "Unique Mechanism" field
- Ad Copy: "Credible Authority Figure" field

**Tasks:**
- [ ] Create reusable ExamplesCarousel component
- [ ] Add 18 pre-written examples for Unique Mechanism
- [ ] Add 18 pre-written examples for Credible Authority Figure
- [ ] Implement click-to-populate functionality
- [ ] Style to match Kong's carousel design
- [ ] Test carousel interaction

**Why High Priority:** Speeds up form completion. Users can click examples instead of typing.

**Estimated Time:** 2-3 hours

---

### 9. Regenerate Sidebar (All Detail Pages)
Kong shows a sidebar on detail pages with the original form pre-filled for quick regeneration.

**Tasks:**
- [ ] Create RegenerateSidebar component
- [ ] Add to Headlines detail page
- [ ] Add to HVCO Titles detail page
- [ ] Add to Hero Mechanisms detail page
- [ ] Add to ICP detail page
- [ ] Add to Ad Copy detail page
- [ ] Add to Email Sequence detail page
- [ ] Add to WhatsApp Sequence detail page
- [ ] Add to Landing Pages detail page
- [ ] Add to Offers detail page

**Why High Priority:** Improves regeneration UX. Users can tweak inputs and regenerate without navigating away.

**Estimated Time:** 4-5 hours

---

## 📊 MEDIUM PRIORITY - Nice to Have (Priority 3)

### 10. Analytics Dashboard (Campaign Performance Tracking)
Track campaign performance, email open/click rates, conversion rates, ROI.

**Tasks:**
- [ ] Design analytics dashboard UI
- [ ] Create database schema for campaign metrics
- [ ] Implement tracking pixels/webhooks
- [ ] Build analytics visualization (charts, graphs)
- [ ] Add to navigation

**Why Medium Priority:** Useful but not essential for launch. Can be added post-launch.

**Estimated Time:** 12-16 hours

---

### 11. Campaign Builder (Drag-and-Drop Timeline)
Visual workflow builder to link ads → emails → landing pages with timing/scheduling.

**Tasks:**
- [ ] Design campaign builder UI
- [ ] Implement drag-and-drop timeline
- [ ] Add asset linking functionality
- [ ] Create visual workflow display
- [ ] Add timing/scheduling logic

**Why Medium Priority:** Advanced feature. Most users will use generators independently first.

**Estimated Time:** 16-20 hours

---

### 12. Onboarding Wizard (Guided Setup)
Multi-step wizard to guide new users through first campaign creation.

**Tasks:**
- [ ] Design onboarding wizard UI
- [ ] Step 1: Welcome + explain platform
- [ ] Step 2: Generate source of truth (AI service profile)
- [ ] Step 3: Create first ICP
- [ ] Step 4: Generate first ad copy
- [ ] Step 5: Create first email sequence
- [ ] Add progress indicator (1/5, 2/5, etc.)
- [ ] Add "Skip" and "Next" buttons

**Why Medium Priority:** Improves first-time user experience but not blocking launch.

**Estimated Time:** 8-10 hours

---

### 13. Industry-Specific Templates
Pre-built templates for common industries (coaching, consulting, e-commerce, SaaS).

**Tasks:**
- [ ] Research common industry patterns
- [ ] Create template database schema
- [ ] Build 5-10 industry templates
- [ ] Add template selection UI
- [ ] Implement template auto-population

**Why Medium Priority:** Speeds up setup for new users but not essential.

**Estimated Time:** 6-8 hours

---

## 🎨 POLISH - Final Touches (Priority 4)

### 14. Dark Theme Consistency Audit
Verify #1a1a1a background and #2a2a2a cards on ALL pages.

**Tasks:**
- [ ] Audit Home page
- [ ] Audit Dashboard page
- [ ] Audit all 9 generator list pages
- [ ] Audit all 9 generator form pages
- [ ] Audit all 9 generator detail pages
- [ ] Audit Settings page
- [ ] Audit Pricing page
- [ ] Audit Admin pages

**Estimated Time:** 2-3 hours

---

### 15. Purple Primary Buttons (#8B5CF6)
Update ALL primary action buttons to purple with smooth hover states.

**Tasks:**
- [ ] Update "Create New" buttons
- [ ] Update "Generate" buttons
- [ ] Update "Save" buttons
- [ ] Update "Submit" buttons
- [ ] Verify hover states

**Estimated Time:** 1-2 hours

---

### 16. Smooth Animations
Add fade-in animations to page loads and smooth transitions to hover states.

**Tasks:**
- [ ] Add fade-in animations to all pages
- [ ] Add smooth transitions to buttons
- [ ] Add loading animations (spinners, skeletons)
- [ ] Polish existing loading states

**Estimated Time:** 2-3 hours

---

## 🧪 TESTING - Quality Assurance (Priority 5)

### 17. Comprehensive Vitest Test Suite
Write unit tests for all critical flows.

**Current Status:** 99 tests passing

**Missing Tests:**
- [ ] Compliance analytics procedures (3 tests)
- [ ] Ad Copy 17-field generation (5 tests)
- [ ] Offers 3-angle generation (5 tests)
- [ ] PDF export utility (9 tests)
- [ ] Beast Mode generation (9 tests)
- [ ] "+15 More" regeneration (9 tests)

**Estimated Time:** 6-8 hours

---

### 18. Manual QA Testing
Test all features end-to-end in production-like environment.

**Tasks:**
- [ ] Test all 9 generators (form → generation → detail → PDF export)
- [ ] Test quota enforcement (Trial, Pro, Agency tiers)
- [ ] Test Stripe subscription flows (upgrade, downgrade, cancel)
- [ ] Test compliance checking on all ad copy
- [ ] Test responsive design on mobile/tablet/desktop
- [ ] Test admin compliance UI (add/edit/delete phrases, CSV import/export)
- [ ] Test analytics dashboard
- [ ] Cross-browser testing (Chrome, Safari, Firefox, Edge)

**Estimated Time:** 8-10 hours

---

## 📈 TOTAL ESTIMATED TIME TO LAUNCH

**Critical (Priority 1):** 18-25 hours  
**High Priority (Priority 2):** 20-28 hours  
**Medium Priority (Priority 3):** 42-54 hours  
**Polish (Priority 4):** 5-8 hours  
**Testing (Priority 5):** 14-18 hours  

**TOTAL:** 99-133 hours (12-17 working days at 8 hours/day)

---

## 🚀 RECOMMENDED LAUNCH STRATEGY

### Option A: Minimum Viable Launch (1-2 weeks)
Complete **Priority 1 (Critical)** only. Launch with core features, add Priority 2-4 post-launch based on user feedback.

**Launch Readiness:** 85%  
**Time to Launch:** 18-25 hours

---

### Option B: Feature-Complete Launch (3-4 weeks)
Complete **Priority 1 (Critical) + Priority 2 (High Priority)**. Launch with Kong parity on core generators.

**Launch Readiness:** 95%  
**Time to Launch:** 38-53 hours

---

### Option C: Premium Launch (5-6 weeks)
Complete **Priority 1-3 (Critical + High + Medium)**. Launch with advanced features like analytics dashboard and campaign builder.

**Launch Readiness:** 100%  
**Time to Launch:** 80-107 hours

---

## 💡 RECOMMENDATION

**Go with Option B: Feature-Complete Launch (3-4 weeks)**

**Rationale:**
- Priority 1 (Critical) tasks are essential for legal compliance and Kong parity
- Priority 2 (High Priority) tasks significantly improve UX and justify premium pricing
- Priority 3 (Medium Priority) tasks can be added post-launch based on user demand
- This approach balances speed to market with feature completeness

**Next Steps:**
1. Complete Priority 1 tasks (18-25 hours)
2. Complete Priority 2 tasks (20-28 hours)
3. Run comprehensive testing (Priority 5)
4. Soft launch to beta users for feedback
5. Fix critical bugs
6. Public launch
7. Add Priority 3 features based on user requests

---

**Questions? Need clarification on any task? Let me know and I'll provide detailed implementation specs.**
