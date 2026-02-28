# End-to-End Testing Guide - CoachFlow Quota Enforcement

This document provides comprehensive manual testing scenarios to verify the tier-based quota enforcement system works correctly across all 9 generators.

---

## Prerequisites

- Access to Stripe test mode dashboard
- Test credit card: `4242 4242 4242 4242`
- Admin access to CoachFlow database
- Browser with developer tools

---

## Phase 5.1: Trial Tier Testing

### Objective
Verify trial users have correct quota limits and see proper UI feedback when limits are reached.

### Kong-Verified Trial Limits
- Headlines: 0
- HVCO Titles: 0
- Hero Mechanisms: 0
- ICP: 2
- Ad Copy: 5
- Email Sequences: 2
- WhatsApp Sequences: 2
- Landing Pages: 2
- Offers: 2

### Test Steps

1. **Create New Trial User**
   - Navigate to `/` (homepage)
   - Click "Sign Up" or "Get Started"
   - Complete Manus OAuth flow
   - Verify redirected to Dashboard
   - Verify user tier shows "Trial" in database

2. **Test ICP Generator (Limit: 2)**
   - Navigate to `/icp-generator`
   - Verify QuotaProgressBar shows "0/2 Used"
   - Generate 1st ICP → Success
   - Verify QuotaProgressBar shows "1/2 Used"
   - Generate 2nd ICP → Success
   - Verify QuotaProgressBar shows "2/2 Used" (red/warning color)
   - Verify UpgradePrompt appears: "You've reached your Trial plan limit"
   - Verify Generate button is disabled
   - Attempt 3rd generation → Should fail with quota exceeded error

3. **Test Ad Copy Generator (Limit: 5)**
   - Navigate to `/ad-copy-generator`
   - Verify QuotaProgressBar shows "0/5 Used"
   - Generate 5 ad copies successfully
   - Verify QuotaProgressBar shows "5/5 Used"
   - Verify UpgradePrompt appears
   - Verify Generate button disabled
   - Attempt 6th generation → Should fail

4. **Test Headlines Generator (Limit: 0)**
   - Navigate to `/headlines`
   - Verify QuotaProgressBar shows "0/0 Used" (red immediately)
   - Verify UpgradePrompt appears immediately
   - Verify Generate button disabled from start
   - Attempt generation → Should fail with quota exceeded error

5. **Test Dashboard Quota Summary**
   - Navigate to `/dashboard`
   - Verify QuotaSummaryCard shows all 9 generators
   - Verify ICP shows "2/2 Used" (red)
   - Verify Ad Copy shows "5/5 Used" (red)
   - Verify Headlines shows "0/0 Used" (red)
   - Verify "Upgrade Plan" button appears

### Expected Results
✅ Trial users cannot generate headlines, HVCO, or hero mechanisms (0 limit)
✅ Trial users can generate exactly 2 ICPs, 5 ad copies, 2 emails, 2 whatsapp, 2 landing pages, 2 offers
✅ QuotaProgressBar shows correct limits and usage
✅ UpgradePrompt appears when quota exceeded
✅ Generate buttons disabled at quota limits
✅ Backend throws TRPCError with code "FORBIDDEN" when limit exceeded

---

## Phase 5.2: Pro Tier Testing

### Objective
Verify Pro users have correct quota limits and can generate up to their limits.

### Kong-Verified Pro Limits
- Headlines: 6
- HVCO Titles: 3
- Hero Mechanisms: 4
- ICP: 50
- Ad Copy: 100
- Email Sequences: 20
- WhatsApp Sequences: 20
- Landing Pages: 10
- Offers: 10

### Test Steps

1. **Upgrade Trial User to Pro**
   - Navigate to `/pricing`
   - Click "Start 7-Day Free Trial" on Pro plan
   - Complete Stripe checkout with test card `4242 4242 4242 4242`
   - Verify redirected back to CoachFlow
   - Verify subscription webhook fired (check server logs)
   - Verify user tier updated to "pro" in database
   - Verify quota counts NOT reset (existing usage preserved)

2. **Test Headlines Generator (Limit: 6)**
   - Navigate to `/headlines`
   - Verify QuotaProgressBar shows "0/6 Used"
   - Generate 6 headlines successfully
   - Verify QuotaProgressBar shows "6/6 Used"
   - Verify UpgradePrompt appears
   - Verify Generate button disabled
   - Attempt 7th generation → Should fail

3. **Test ICP Generator (Limit: 50)**
   - Navigate to `/icp-generator`
   - Verify QuotaProgressBar shows "2/50 Used" (from trial usage)
   - Generate 48 more ICPs (total 50)
   - Verify QuotaProgressBar shows "50/50 Used"
   - Attempt 51st generation → Should fail

4. **Test Ad Copy Generator (Limit: 100)**
   - Navigate to `/ad-copy-generator`
   - Verify QuotaProgressBar shows "5/100 Used" (from trial usage)
   - Generate 95 more ad copies (total 100)
   - Verify QuotaProgressBar shows "100/100 Used"
   - Attempt 101st generation → Should fail

5. **Test All 9 Generators**
   - Test each generator up to its Pro limit
   - Verify all quotas enforced correctly
   - Verify Dashboard shows accurate usage for all generators

### Expected Results
✅ Pro users can generate up to Pro limits (6/3/4/50/100/20/20/10/10)
✅ Existing trial usage counts preserved after upgrade
✅ QuotaProgressBar shows correct Pro limits
✅ Backend enforces Pro limits correctly
✅ Stripe webhook updates tier automatically

---

## Phase 5.3: Agency Tier Testing

### Objective
Verify Agency users have unlimited access (999 limit) to all generators.

### Kong-Verified Agency Limits
- All generators: 999 (unlimited)

### Test Steps

1. **Upgrade Pro User to Agency**
   - Navigate to `/pricing`
   - Click "Start 7-Day Free Trial" on Agency plan
   - Complete Stripe checkout
   - Verify user tier updated to "agency" in database

2. **Test Unlimited Generation**
   - Navigate to any generator (e.g., `/headlines`)
   - Verify QuotaProgressBar shows "X/999 Used" or "Unlimited"
   - Generate 100+ items successfully
   - Verify no quota errors thrown
   - Verify Generate button never disabled
   - Verify no UpgradePrompt appears

3. **Test Dashboard**
   - Navigate to `/dashboard`
   - Verify QuotaSummaryCard shows "Unlimited" or "999" for all generators
   - Verify no "Upgrade Plan" button (already on highest tier)

### Expected Results
✅ Agency users can generate unlimited items (up to 999)
✅ No quota errors thrown for Agency tier
✅ QuotaProgressBar shows "Unlimited" or very high limit
✅ Generate buttons never disabled for Agency users

---

## Phase 5.4: Upgrade Flow Testing

### Objective
Verify quota limits update immediately when users upgrade tiers.

### Test Steps

1. **Trial → Pro Upgrade**
   - Create new trial user
   - Generate 2 ICPs (trial limit reached)
   - Verify Generate button disabled
   - Upgrade to Pro via Stripe
   - Wait for webhook to process (check server logs)
   - Refresh page
   - Verify QuotaProgressBar now shows "2/50 Used"
   - Verify Generate button re-enabled
   - Generate 48 more ICPs successfully (total 50)

2. **Pro → Agency Upgrade**
   - Use Pro user at 50/50 ICP limit
   - Verify Generate button disabled
   - Upgrade to Agency via Stripe
   - Wait for webhook to process
   - Refresh page
   - Verify QuotaProgressBar shows "50/999 Used" or "Unlimited"
   - Verify Generate button re-enabled
   - Generate 100+ more ICPs successfully

### Expected Results
✅ Quota limits update immediately after Stripe webhook
✅ No manual database changes needed
✅ Users can continue generating after upgrade
✅ Existing usage counts preserved

---

## Phase 5.5: Downgrade Flow Testing

### Objective
Verify quota limits restrict access when users downgrade or cancel subscriptions.

### Test Steps

1. **Agency → Trial Downgrade**
   - Use Agency user with 100+ generations
   - Cancel subscription in Stripe dashboard
   - Trigger `customer.subscription.deleted` webhook
   - Verify user tier reverts to "trial" in database
   - Verify quota counts reset to 0 (or preserved based on business logic)
   - Navigate to any generator
   - Verify trial limits enforced (2 for ICP, 0 for headlines)

2. **Subscription Expiration**
   - Verify user retains access until period end
   - After period end, verify tier reverts to trial
   - Verify trial limits enforced

### Expected Results
✅ Downgraded users have trial limits enforced
✅ Quota counts reset (or preserved based on logic)
✅ Access retained until subscription period ends

---

## Phase 5.6: Monthly Reset Testing

### Objective
Verify quota counts reset automatically on each user's anniversary date (monthly from their signup date, not on the 1st of the calendar month).

### Test Steps

1. **Manual Reset Simulation**
   - Use Pro user with quota counts > 0
   - Manually update `usageResetAt` to yesterday in database:
     ```sql
     UPDATE users SET usageResetAt = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id = <user_id>;
     ```
   - Make a generation request (the anniversary-based reset check runs automatically at the start of each generation request)
   - Verify all quota counts reset to 0:
     ```sql
     SELECT headlineGeneratedCount, icpGeneratedCount, adCopyGeneratedCount FROM users WHERE id = <user_id>;
     ```
   - Verify `usageResetAt` updated to next month

2. **Test User Can Generate Again**
   - Navigate to any generator
   - Verify QuotaProgressBar shows "0/X Used"
   - Generate items successfully
   - Verify quota increments correctly

### Expected Results
✅ Quota counts reset to 0 on reset date
✅ usageResetAt updated to next month
✅ Users can generate again after reset

---

## Test Result Checklist

Use this checklist to track testing progress:

### Trial Tier
- [ ] ICP: 2 generations succeed, 3rd fails
- [ ] Ad Copy: 5 generations succeed, 6th fails
- [ ] Headlines: 0 generations (disabled from start)
- [ ] QuotaProgressBar shows correct limits
- [ ] UpgradePrompt appears at limit
- [ ] Generate buttons disabled at limit

### Pro Tier
- [ ] Headlines: 6 generations succeed, 7th fails
- [ ] ICP: 50 generations succeed, 51st fails
- [ ] Ad Copy: 100 generations succeed, 101st fails
- [ ] All 9 generators enforce Pro limits
- [ ] Stripe webhook updates tier automatically

### Agency Tier
- [ ] All generators allow 100+ generations
- [ ] No quota errors thrown
- [ ] QuotaProgressBar shows "Unlimited"

### Upgrade Flows
- [ ] Trial → Pro: limits update immediately
- [ ] Pro → Agency: unlimited access granted
- [ ] Existing usage counts preserved

### Downgrade Flows
- [ ] Agency → Trial: trial limits enforced
- [ ] Subscription cancellation handled correctly

### Monthly Reset
- [ ] Quota counts reset to 0
- [ ] usageResetAt updated correctly
- [ ] Users can generate after reset

---

## Troubleshooting

### Webhook Not Firing
- Check Stripe dashboard → Developers → Webhooks
- Verify webhook URL is correct
- Check server logs for webhook errors
- Verify webhook secret matches environment variable

### Quota Not Updating
- Check database: `SELECT subscriptionTier, icpGeneratedCount FROM users WHERE id = <user_id>;`
- Verify backend quota enforcement logic
- Check browser console for API errors

### Generate Button Still Disabled After Upgrade
- Hard refresh page (Ctrl+Shift+R)
- Clear browser cache
- Check if webhook processed (server logs)
- Verify tier updated in database

---

## Success Criteria

All tests pass when:

✅ Trial users have 0/0/0/2/5/2/2/2/2 limits enforced
✅ Pro users have 6/3/4/50/100/20/20/10/10 limits enforced
✅ Agency users have unlimited (999) access
✅ Upgrading unlocks higher limits immediately
✅ Downgrading restricts to trial limits
✅ Anniversary-based reset clears quota counts on each user's individual signup anniversary
✅ Frontend UI shows accurate quota usage
✅ Backend throws proper errors at limits
✅ Stripe webhooks update tiers automatically

---

**Last Updated:** 2026-02-18
**Version:** 1.0
**Tested By:** _____________
**Date Tested:** _____________
