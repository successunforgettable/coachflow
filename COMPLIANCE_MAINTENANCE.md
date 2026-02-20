# Meta Compliance System - Quarterly Maintenance Guide

## Overview
The Meta Compliance Checker (`server/lib/complianceChecker.ts`) requires quarterly updates to stay aligned with Meta's advertising policy changes.

---

## Quarterly Review Schedule

**Review Dates:** One week before each quarter ends
- **February (Q1 review):** Feb 21-28
- **May (Q2 review):** May 24-31
- **August (Q3 review):** Aug 24-31
- **November (Q4 review):** Nov 23-30

**Set recurring calendar reminders** for these dates with task: "Review Meta Compliance Checker"

---

## Review Process (30 minutes per quarter)

### Step 1: Check Meta Policy Updates
1. Visit https://www.facebook.com/policies/ads/
2. Check "Recent Updates" section
3. Review Meta Business Help Center for policy announcements
4. Join Meta Advertiser Community for policy discussions

### Step 2: Update Banned Phrases Database
Open `server/lib/complianceChecker.ts` and review:

**CRITICAL_VIOLATIONS array (lines 16-60)**
- Add any new prohibited phrases from Meta updates
- Remove phrases if Meta relaxes restrictions (rare)

**WARNING_VIOLATIONS array (lines 63-88)**
- Add new phrases that trigger reviews
- Update suggestions based on current best practices

### Step 3: Update Metadata
Update three fields in the `checkCompliance` function return statement:

```typescript
return {
  // ... other fields
  version: 'v1.1',              // Increment version (v1.0 → v1.1 → v1.2)
  lastUpdated: '2026-05-21',    // Today's date
  nextReviewDue: '2026-08-21'   // 3 months from today
}
```

### Step 4: Update File Header
Update the comment at the top of the file:

```typescript
// Meta Ad Compliance Checker - v1.1 (Updated May 2026)
```

### Step 5: Test Changes
Run compliance checks on sample ads:

```bash
cd /home/ubuntu/coachflow
pnpm test
```

### Step 6: Document Changes
Add entry to this file under "Version History" section below.

### Step 7: Save Checkpoint
```bash
# Commit changes with descriptive message
git add server/lib/complianceChecker.ts
git commit -m "Update compliance checker to v1.1 - May 2026 Meta policy review"
```

Create checkpoint in Manus with description:
"Quarterly compliance update - v1.1 (May 2026) - Updated banned phrases based on Meta policy changes"

---

## Version History

### v1.0 (Feb 2026) - Initial Release
- 7 critical violation categories
- 5 warning categories
- Quoted phrase exception for testimonials
- Case-insensitive phrase matching
- Quarterly review metadata

### v1.1 (May 2026) - [To be updated]
- [Add changes here after May review]

### v1.2 (Aug 2026) - [To be updated]
- [Add changes here after Aug review]

---

## Common Policy Changes to Watch For

**Income Claims**
- Meta frequently updates thresholds for what constitutes an "income claim"
- Watch for changes to "financial opportunity" language

**Health Claims**
- Medical/wellness advertising rules change based on regulatory updates
- Watch for new restricted health conditions

**Scarcity/Urgency**
- Meta tightens enforcement on false scarcity tactics
- Watch for new prohibited urgency phrases

**Targeting Language**
- Rules around personal attributes (age, race, health) evolve
- Watch for expanded protected categories

---

## Emergency Updates (Outside Quarterly Schedule)

If Meta announces a **major policy change** mid-quarter:

1. **Assess Impact:** Does it affect our banned phrases?
2. **Update Immediately:** Don't wait for quarterly review
3. **Notify Users:** Add banner to Ad Copy Generator: "Compliance checker updated for new Meta policy"
4. **Increment Version:** Use patch version (v1.0 → v1.0.1)

---

## Future: Admin UI for Compliance Updates

**Phase 2 Enhancement** (not yet implemented):

Instead of manually editing the file, build an admin UI:
- `/admin/compliance` page
- Add/edit/remove banned phrases
- Update version metadata
- Preview changes before publishing
- Automatic user notification when rules update

This eliminates code deployments for compliance updates.

---

## Contact & Resources

**Meta Policy Resources:**
- Policy Center: https://www.facebook.com/policies/ads/
- Business Help: https://www.facebook.com/business/help
- Policy Updates: https://www.facebook.com/business/news

**Internal Resources:**
- Compliance Checker: `server/lib/complianceChecker.ts`
- Integration: `server/routers/adCopy.ts`
- UI Component: `client/src/components/ComplianceBadge.tsx`

---

**Last Updated:** Feb 21, 2026
**Next Review Due:** May 21, 2026
**Current Version:** v1.0
