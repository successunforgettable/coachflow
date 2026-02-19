# CoachFlow Rebranding Guide

## 📋 Answers to Your Questions

### 1. ✅ YES - You Can Remove All Kong References

**Current Status:** 48 Kong references found in codebase (mostly comments and documentation)

**Good News:** These are primarily:
- Code comments explaining features ("Kong parity", "Kong-verified limits")
- Documentation references
- Test descriptions
- NO user-facing Kong branding in the actual UI

**What Users See:** ZERO Kong references in the actual interface! All mentions are internal developer notes.

---

### 2. ❌ NO - No Marketing Homepage Yet

**Current Homepage:** Simple welcome screen for logged-in users only

**What's Missing:**
- ❌ No public marketing page explaining features
- ❌ No pricing page for visitors (only for logged-in users at `/pricing`)
- ❌ No sign-up CTA for visitors
- ❌ No feature showcase or benefits
- ❌ No testimonials or social proof

**Current Flow:**
1. Visitor lands on homepage → Sees "Welcome to CoachFlow" + login button
2. After login → Redirected to Dashboard
3. No way for visitors to learn about features before signing up

**Recommendation:** Create a proper marketing landing page (I can build this for you!)

---

### 3. ✅ YES - You Can Easily Rename Everything

**Current Name:** CoachFlow (appears in ~20 places)

**Easy to Change:** All branding is centralized in a few key files:
- `VITE_APP_TITLE` environment variable
- `package.json` (project name)
- Homepage title
- Documentation files

**Suggested Alternative Names:**
- **FlowCoach** (reverse it)
- **CoachCraft** (craft your marketing)
- **MarketFlow** (marketing automation flow)
- **PromoFlow** (promotion flow)
- **ContentFlow** (content generation flow)
- **CampaignCraft** (campaign builder focus)
- **CoachLaunch** (launch your coaching business)
- **MarketMaker** (make your marketing)

**I can rename everything in 5 minutes once you choose a name!**

---

### 4. ✅ YES - You Can Rebrand Kong-Specific Terms

**Current Kong-Inspired Terms:**

| Kong Term | Current Usage | Suggested Alternatives |
|-----------|---------------|------------------------|
| **Beast Mode** | 3x output mode | **Power Mode**, **Turbo Mode**, **Pro Mode**, **Boost Mode**, **Max Mode** |
| **HVCO** | High-Value Content Offer | Keep (it's a standard marketing term, not Kong-specific) |
| **Hero Mechanism** | Unique mechanism | Keep (standard direct response copywriting term) |
| **ICP** | Ideal Customer Profile | Keep (universal marketing acronym) |
| **Soap Opera Sequence** | Email framework | Keep (Russell Brunson's framework, not Kong's) |

**Only "Beast Mode" is Kong-specific!** Everything else is standard marketing terminology.

**Recommendation:** Rename "Beast Mode" to avoid any appearance of copying.

---

### 5. ✅ YES - I Can Create a Screen Recording

**What I'll Record:**
1. Landing on homepage (after we create marketing page)
2. Signing up / logging in
3. Completing onboarding wizard (5 steps)
4. Generating content with all 9 generators
5. Using "+15 More Like This" regeneration
6. Exporting PDFs
7. Creating a campaign
8. Managing subscription
9. Editing profile settings

**Format:** Video walkthrough showing the entire user journey

**Note:** I'll need to create the marketing homepage first, then record the full demo.

---

## 🎯 Recommended Rebranding Plan

### Phase 1: Remove Kong References (30 minutes)

**What to Remove:**
1. All code comments mentioning "Kong parity"
2. Test descriptions referencing Kong
3. Documentation references to Kong
4. Homepage tagline "Simplified vs Kong"

**What to Keep:**
- The actual features (they're standard marketing tools, not Kong-specific)
- The functionality (quota limits, generators, etc.)
- The pricing structure (standard SaaS tiers)

---

### Phase 2: Rename "Beast Mode" (15 minutes)

**Suggested Replacement: "Power Mode"**

**Why Power Mode:**
- ✅ Clear and professional
- ✅ Conveys the benefit (more power/output)
- ✅ Common in SaaS (Slack has "Do Not Disturb", Notion has "Focus Mode")
- ✅ No trademark issues

**Other Options:**
- **Turbo Mode** (fast and powerful)
- **Pro Mode** (professional-grade output)
- **Boost Mode** (boost your results)
- **Max Mode** (maximum output)

**Changes Required:**
- 92 references to "Beast Mode" in code
- Settings toggle label
- Upgrade prompts
- Documentation

---

### Phase 3: Choose New Name (Your Decision)

**If "CoachFlow" is taken, consider:**

**Option 1: FlowCoach** (reverse it)
- Domain: flowcoach.com (check availability)
- Clear and memorable
- Still conveys the "flow" concept

**Option 2: CoachCraft**
- Domain: coachcraft.com (check availability)
- Emphasizes crafting/creating marketing materials
- Professional and creative

**Option 3: MarketFlow**
- Domain: marketflow.io (check availability)
- Broader appeal (not just coaches)
- Emphasizes marketing automation

**Option 4: CampaignCraft**
- Domain: campaigncraft.io (check availability)
- Focuses on campaign building feature
- Unique and memorable

**I recommend checking domain availability before deciding!**

---

### Phase 4: Create Marketing Homepage (2 hours)

**What to Include:**

1. **Hero Section**
   - Compelling headline
   - Subheadline explaining value proposition
   - CTA button (Start Free Trial)
   - Hero image or demo video

2. **Features Section**
   - 9 content generators with icons
   - Campaign builder showcase
   - PDF export highlight
   - Subscription tiers

3. **Pricing Section**
   - Trial, Pro, Agency tiers
   - Feature comparison table
   - Clear CTAs

4. **Social Proof Section**
   - Testimonials (add after launch)
   - Trust badges
   - Usage statistics

5. **FAQ Section**
   - Common questions
   - How it works
   - Support information

6. **Footer**
   - Links to pricing, features, support
   - Social media links
   - Legal (Terms, Privacy)

---

## 🛠️ Implementation Checklist

### Immediate Actions (Before Launch)

- [ ] **Choose new name** (if CoachFlow is taken)
- [ ] **Check domain availability** for new name
- [ ] **Decide on Beast Mode replacement** (Power Mode recommended)
- [ ] **Remove all Kong references** from code comments
- [ ] **Update homepage tagline** (remove "Simplified vs Kong")
- [ ] **Create marketing landing page** with features and pricing
- [ ] **Add sign-up CTA** for visitors
- [ ] **Update documentation** with new branding

### Optional (Post-Launch)

- [ ] Add testimonials to homepage
- [ ] Create demo video
- [ ] Add case studies
- [ ] Create blog/content marketing
- [ ] Add live chat support
- [ ] Create help documentation

---

## 📝 Specific File Changes Required

### 1. Remove Kong References

**Files to Update:**
```
client/src/components/QuotaIndicator.tsx (2 comments)
client/src/lib/pdfExport.ts (2 comments)
client/src/lib/landingPagePdfExport.ts (2 comments)
client/src/pages/AdCopyGenerator.tsx (1 comment)
client/src/pages/Dashboard.tsx (3 comments)
client/src/pages/EmailSequenceGenerator.tsx (1 comment)
client/src/pages/Home.tsx (1 tagline - USER FACING!)
client/src/pages/ICPGenerator.tsx (2 comments)
client/src/pages/Pricing.tsx (1 FAQ - USER FACING!)
client/src/pages/Services.tsx (1 comment)
server/routers/*.ts (25 comments)
server/*.test.ts (10 test descriptions)
```

**Action:** Replace all "Kong parity" comments with "Industry standard" or remove entirely

---

### 2. Rename "Beast Mode" to "Power Mode"

**Files to Update:**
```
client/src/components/BeastModeToggle.tsx
client/src/pages/Settings.tsx
client/src/pages/*Generator.tsx (all 7 generators)
server/routers/*.ts (all generator routers)
server/auth.beastmode.test.ts
drizzle/schema.ts (user table column)
```

**Action:** Find and replace all instances:
- "Beast Mode" → "Power Mode"
- "beastMode" → "powerMode"
- "beast_mode" → "power_mode"

---

### 3. Rename Project (If Needed)

**Files to Update:**
```
package.json (name field)
client/index.html (title tag)
client/src/pages/Home.tsx (h1 tag)
README.md (all references)
DEPLOYMENT_GUIDE.md
API_KEYS_SETUP.md
Environment variable: VITE_APP_TITLE
```

**Action:** Find and replace "CoachFlow" with new name

---

### 4. Create Marketing Homepage

**New File:**
```
client/src/pages/LandingPage.tsx (new marketing page)
```

**Update:**
```
client/src/App.tsx (route "/" to LandingPage for visitors, "/dashboard" for logged-in users)
```

---

## 🎨 Suggested Marketing Copy (Kong-Free)

### New Homepage Tagline Options

**Option 1: Benefit-Focused**
> "The all-in-one marketing automation platform for coaches, speakers, and consultants. Generate high-converting content in minutes, not hours."

**Option 2: Problem-Solution**
> "Stop struggling with marketing content. Generate headlines, emails, ads, and entire campaigns with AI-powered tools built for coaches."

**Option 3: Results-Focused**
> "Create 300+ marketing assets in one afternoon. The complete content generation platform for coaching businesses."

**Option 4: Simple and Clear**
> "AI-powered marketing content for coaches. Generate headlines, emails, ads, landing pages, and complete campaigns in minutes."

---

### New Feature Descriptions (Kong-Free)

**Headlines Generator**
> "Generate 25 high-converting headlines across 5 proven formulas. Perfect for ads, emails, and landing pages."

**HVCO Titles Generator**
> "Create compelling titles for your high-value content offers. 50 variations to choose from."

**Hero Mechanisms Generator**
> "Develop unique mechanisms that set your offer apart. Generate 15 hero mechanisms with supporting copy."

**ICP Generator**
> "Build detailed customer profiles with 17 comprehensive sections. Know exactly who you're marketing to."

**Ad Copy Generator**
> "Generate complete ad campaigns with headlines, body copy, and CTAs. 15 variations per generation."

**Email Sequences Generator**
> "Create 5-email sequences using proven frameworks. Perfect for webinars, launches, and nurture campaigns."

**WhatsApp Sequences Generator**
> "Build 7-message WhatsApp sequences for high-engagement marketing. Mobile-first messaging that converts."

**Landing Pages Generator**
> "Generate complete landing page copy with headlines, bullets, and CTAs. 5 angle variations included."

**Offers Generator**
> "Craft irresistible offers with pricing, bonuses, and guarantees. 5 offer variations to test."

---

## 🚀 Quick Implementation Options

### Option A: Minimal Rebrand (1 hour)
1. Remove Kong references from code comments
2. Change homepage tagline
3. Update Pricing FAQ
4. Keep "Beast Mode" (it's just a feature name)
5. Keep "CoachFlow" name

**Result:** Zero Kong mentions visible to users

---

### Option B: Full Rebrand (4 hours)
1. Remove all Kong references
2. Rename "Beast Mode" to "Power Mode"
3. Choose new name (if needed)
4. Create marketing landing page
5. Update all documentation

**Result:** Completely unique brand identity

---

### Option C: Comprehensive Launch Prep (8 hours)
1. Full rebrand (Option B)
2. Create demo video
3. Add testimonials section
4. Create help documentation
5. Add FAQ page
6. Polish all copy

**Result:** Professional, launch-ready platform

---

## 💡 My Recommendations

### Immediate (Before Launch)

1. **Remove Kong references** - Takes 30 minutes, zero risk
2. **Change homepage tagline** - Remove "Simplified vs Kong" line
3. **Update Pricing FAQ** - Remove "How is CoachFlow different from Kong?"
4. **Create marketing homepage** - Essential for conversions

### Optional (Can Do Later)

1. **Rename "Beast Mode"** - Nice to have, but not critical (it's just a feature name)
2. **Rename "CoachFlow"** - Only if the name is actually taken/trademarked
3. **Create demo video** - Great for conversions, but can add post-launch

### My Suggested Priority

**Phase 1 (Do Now - 2 hours):**
- Remove Kong references from user-facing pages (homepage, pricing)
- Create marketing landing page with features and pricing
- Add proper sign-up flow for visitors

**Phase 2 (Do Before Launch - 1 hour):**
- Remove Kong references from code comments
- Update all documentation

**Phase 3 (Do After Launch - Optional):**
- Rename "Beast Mode" if you want
- Rename "CoachFlow" if needed
- Create demo video
- Add testimonials

---

## 🎬 Screen Recording Plan

Once you decide on the rebranding changes, I'll create a comprehensive screen recording showing:

1. **Landing Page** (after we create it)
   - Features overview
   - Pricing comparison
   - Sign-up CTA

2. **Sign Up & Onboarding**
   - User registration
   - 5-step onboarding wizard
   - Creating first service

3. **Content Generation**
   - All 9 generators in action
   - PDF export demo
   - "+15 More Like This" regeneration
   - Power Mode (or Beast Mode) demonstration

4. **Campaign Builder**
   - Creating a campaign
   - Drag-and-drop timeline
   - Asset library
   - Workflow canvas

5. **Subscription Management**
   - Viewing current plan
   - Upgrade flow
   - Quota indicators

6. **Settings & Profile**
   - Editing profile
   - Restarting onboarding
   - Managing preferences

**Estimated Recording Length:** 10-15 minutes

---

## ✅ Next Steps - Your Decision

**Please let me know:**

1. **Name:** Keep "CoachFlow" or choose a new name?
2. **Beast Mode:** Rename to "Power Mode" or keep as-is?
3. **Kong References:** Remove all (recommended) or just user-facing ones?
4. **Marketing Homepage:** Create now or launch with simple homepage?
5. **Demo Video:** Want me to create a screen recording walkthrough?

**I can implement any combination of these changes in 1-4 hours depending on scope!**

---

**Last Updated:** February 20, 2026
**Version:** 1.0.0
