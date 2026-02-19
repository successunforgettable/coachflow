# Character Limits Implementation - War Plan

**Goal:** Apply Kong-verified character limits to all 9 generators using CharLimitInput component

**Timeline:** 4-6 hours

**Success Criteria:** All text inputs across all 9 generators enforce Kong's exact character limits with visual feedback

---

## Progress Tracker

- [x] CharLimitInput component created (with id and rows props)
- [x] CHARACTER_LIMITS constants defined
- [x] Headlines generator updated (52/48/25 limits)
- [ ] HVCO generator (52/72 limits)
- [ ] Hero Mechanisms generator (11 fields)
- [ ] ICP generator (17 sections, all 0 = no limit)
- [ ] Ad Copy generator (17 fields)
- [ ] Email Sequence generator (52/72/25 limits)
- [ ] WhatsApp Sequence generator (52/72/25 limits)
- [ ] Landing Pages generator (52/72/25 + price/guarantee limits)
- [ ] Offers generator (52/72/25 + price/guarantee/bonus/scarcity limits)

---

## Phase 1: HVCO Generator (30 min)

**File:** `client/src/pages/HVCOTitlesNew.tsx`

**Current Limits (INCORRECT):**
- Target Market: 52 ✅ (correct)
- HVCO Topic: 72 ❌ (should be 80 for subtitle based on CHARACTER_LIMITS.hvco.subtitle)

**Action:**
1. Import CharLimitInput and CHARACTER_LIMITS
2. Replace Target Market Input with CharLimitInput (52 chars)
3. Replace HVCO Topic Textarea with CharLimitInput (80 chars, multiline)
4. Remove manual char counter variables (lines 98-99)

---

## Phase 2: Hero Mechanisms Generator (1 hour)

**File:** `client/src/pages/HeroMechanismsNew.tsx`

**Fields (11 total):**
1. Target Market: 52
2. Product Category: 79
3. Specific Product Name: 72
4. Pressing Problem: 48
5. Desired Outcome: 25
6. Unique Mechanism: 0 (no limit)
7. List Benefits: 0 (no limit)
8. Specific Technology: 23
9. Scientific Studies: 31
10. Credible Authority: 70
11. Featured In: 65

**Action:**
Replace all Input/Textarea with CharLimitInput using CHARACTER_LIMITS.heroMechanisms

---

## Phase 3: ICP Generator (30 min)

**File:** `client/src/pages/ICPGenerator.tsx`

**Fields (17 sections, all 0 = no limit):**
All ICP sections have no character limits per Kong specifications.

**Action:**
No changes needed - ICP uses Textarea without limits (already correct)

---

## Phase 4: Ad Copy Generator (1.5 hours)

**File:** `client/src/pages/AdCopyGenerator.tsx`

**Fields (17 total):**
1. Target Market: 52
2. Product Category: 79
3. Specific Product Name: 72
4. Pressing Problem: 48
5. Desired Outcome: 25
6. Unique Mechanism: 0
7. List Benefits: 0
8. Specific Technology: 23
9. Scientific Studies: 31
10. Credible Authority: 70
11. Featured In: 65
12. Testimonials: 511
13. Specific Price: 20
14. Specific Guarantee: 67
15. Specific Bonus: 71
16. Specific Scarcity: 68
17. Specific CTA: 50

**Action:**
Replace all Input/Textarea with CharLimitInput using CHARACTER_LIMITS.adCopy

---

## Phase 5: Email Sequence Generator (30 min)

**File:** `client/src/pages/EmailSequenceGenerator.tsx`

**Fields:**
- Target Market: 52
- Product/Service: 72
- Desired Outcome: 25
- Sequence Type: Dropdown (no limit)
- Tone: Dropdown (no limit)

**Action:**
Replace 3 text inputs with CharLimitInput

---

## Phase 6: WhatsApp Sequence Generator (30 min)

**File:** `client/src/pages/WhatsAppSequenceGenerator.tsx`

**Fields:**
- Target Market: 52
- Product/Service: 72
- Desired Outcome: 25
- Sequence Type: Dropdown (no limit)
- Tone: Dropdown (no limit)

**Action:**
Replace 3 text inputs with CharLimitInput

---

## Phase 7: Landing Pages Generator (45 min)

**File:** `client/src/pages/LandingPageGenerator.tsx`

**Fields:**
- Target Market: 52
- Product/Service: 72
- Desired Outcome: 25
- Unique Mechanism: 0 (no limit)
- Price: 20
- Guarantee: 67

**Action:**
Replace all Input/Textarea with CharLimitInput using CHARACTER_LIMITS.landingPages

---

## Phase 8: Offers Generator (45 min)

**File:** `client/src/pages/OffersGenerator.tsx`

**Fields:**
- Target Market: 52
- Product/Service: 72
- Desired Outcome: 25
- Price: 20
- Guarantee: 67
- Bonus: 71
- Scarcity: 68

**Action:**
Replace all Input/Textarea with CharLimitInput using CHARACTER_LIMITS.offers

---

## Phase 9: Testing (30 min)

**Test Cases:**
1. Verify character counters display correctly
2. Verify yellow warning at 10 chars remaining
3. Verify red error when over limit
4. Verify maxLength enforcement prevents typing beyond limit
5. Verify all generators match Kong's exact limits
6. Verify no TypeScript errors
7. Verify no build errors

**Testing Approach:**
- Open each generator in browser
- Type to near-limit (should show yellow)
- Type to limit (should enforce maxLength)
- Verify visual feedback matches design
- Verify no console errors

---

## Completion Checklist

- [ ] All 9 generators use CharLimitInput component
- [ ] All character limits match CHARACTER_LIMITS constants
- [ ] All character limits match Kong's specifications
- [ ] Visual feedback (yellow/red) works correctly
- [ ] No TypeScript errors
- [ ] No build errors
- [ ] All generators tested in browser
- [ ] Todo.md updated with completion status

---

## Notes

**Kong Character Limit Sources:**
- Headlines: docs/PHASE1_KONG_PARITY_WAR_PLAN.md line 346
- HVCO: CHARACTER_LIMITS.hvco (title: 60, subtitle: 80)
- Hero Mechanisms: CHARACTER_LIMITS.heroMechanisms (11 fields)
- Ad Copy: CHARACTER_LIMITS.adCopy (17 fields)
- Email/WhatsApp: CHARACTER_LIMITS.emailSequences / whatsappSequences
- Landing Pages: CHARACTER_LIMITS.landingPages
- Offers: CHARACTER_LIMITS.offers

**CharLimitInput Props:**
- label: string (field name)
- value: string (current value)
- onChange: (value: string) => void
- maxLength: number (from CHARACTER_LIMITS)
- multiline?: boolean (use for Textarea)
- rows?: number (default: 4)
- required?: boolean
- id?: string
- placeholder?: string
