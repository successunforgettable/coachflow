# Has-Assets Intake — End-to-End Walkthrough Script

Manual functional test for the has-assets import journey. Run after each deploy that touches intake, enrichment, or ICP flow.

## Prerequisites

- Logged in as a Pro-tier account on zapcampaigns.com
- Have the SMB PDF (38-page "Secret Millionaire Blueprint") or equivalent test document ready
- CC on standby to run DB verification queries

## Steps

### Step 1: Plain-language gate

**Action:** Navigate to zapcampaigns.com/v2-dashboard/trail/new. After greeting and description, reach the fork.

**Pass:** Two chips appear: "I have stuff like that" / "Actually, build it for me"

**Fail:** No gate shown, or flow skips directly to upload

---

### Step 2: Upload path

**Action:** Click "I have stuff like that" then "Upload files". Select the SMB PDF.

**Pass:** "Reading 1 file..." appears, extraction completes with asset reveal cards (ICP, Offer, Method, and/or Lead Magnet)

**Fail:** Upload errors, no extraction, or blank cards

---

### Step 3: ICP confirm — baseline

**Action:** ICP reveal card appears with extracted name and preview.

**Pass:** Name reflects document content (e.g., "Financial strugglers aged 25-55..."), not generic placeholder. "Looks right" and "Fix something" chips visible.

**Fail:** Generic name, missing card, or no chips

---

### Step 4: ICP correction (Bug 1 regression test)

**Action:** Click "Fix something". Type an amendment (e.g., "it's also business owners too"). Submit.

**Pass:**
- [ ] User bubble echoes the correction text
- [ ] "Got it — I'll factor that in." confirmation bubble appears
- [ ] Flow advances to the next asset card (Offer)
- [ ] (DB check later) ICP name preserves original extracted name, NOT the correction text

**Fail:** Correction replaces name, no confirmation bubble, flow stalls

---

### Step 5: Offer confirm

**Action:** Offer card appears. Click "Looks right" (or "Fix something" to test correction on offer).

**Pass:** Flow advances to Method card

**Fail:** No offer card, or flow stalls

---

### Step 6: Method confirm

**Action:** Method card appears. Click "Looks right".

**Pass:** Flow advances to Lead Magnet (either found or gap prompt)

**Fail:** No method card, or flow stalls

---

### Step 7: Lead magnet — describe gap

**Action:** If lead magnet was not found in extraction: "I'll describe it" chip appears. Click it. Paste a description (e.g., "a guide to help newbie cryptos discover the top 10 stable coins and how to protect their crypto without being hacked"). Submit.

**Pass:** User bubble echoes the description, flow advances to ICP import step

**Fail:** Flow stalls after pasting, no progress

---

### Step 8: ICP import + enrichment (Bug 2 regression test)

**Action:** "Studying the people you help..." appears. Wait for import + enrichment.

**Pass:**
- [ ] Progress/patience messages appear during wait (not dead air)
- [ ] Completes within 90 seconds
- [ ] ICP reveal card appears with enriched content

**Fail:** Dead air for >15s with no progress message, client timeout, or flow hangs indefinitely

---

### Step 9: Trail handoff

**Action:** Trail page loads after kit creation.

**Pass:**
- [ ] Trail diagram shows correct number of completed nodes (>1 of 11)
- [ ] Trail is not stuck at 1/11

**Fail:** Stuck at 1/11, error on navigation, or blank trail

---

### Step 10: DB verification (CC runs)

**Action:** CC queries the new ICP row.

**Pass:**
- [ ] 17/17 content fields populated (no NULLs in fears, objections, buyingTriggers, psychographics, communicationStyle)
- [ ] ICP name = original extracted name (not the correction text)
- [ ] fears/objections/psychographics content is anchored to the document's niche (e.g., crypto beginners), not generic
- [ ] User correction content ("also business owners") is reflected in the generated fields

**Fail:** Any NULL enrichment fields, name replaced by correction, or niche drift

---

## Quick Regression Checks

After the full walkthrough passes, also spot-check:

- [ ] "Actually, build it for me" path (from Step 1) still works — creates auto-mode kit
- [ ] Paste path (instead of upload) still works
- [ ] "Create one for me" chip (for gaps) still triggers generation, not import
- [ ] PDF download button works on the ICP result panel
