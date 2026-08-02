# Meta Ad Compliance Reference — ZAP Campaigns

**Status:** Authoritative reference for all ad-copy, script, landing-page and concept generation.
**Created:** July 2026, from Meta's official published policy plus a research sweep (~15 reports).
**Those 15 source reports are banked at `docs/compliance/source-reports/`** (added 2026-08-03; previously they existed only outside the repo). This synthesis outranks them — see the evidence-discipline note below for why.
**How to use:** Tier 1 is the ONLY thing to build enforcement rules on. Tier 2 informs judgement but must never become a hard gate. Tier 3 must never be encoded at all.

---

## ⛔ READ THIS FIRST — EVIDENCE DISCIPLINE

A large research sweep returned material that *sounded* authoritative but does not appear anywhere in Meta's published documentation. Several reports even filed these under headings like "Verified Policy Realities."

**The following are UNVERIFIED. Do not encode them, cite them, build thresholds on them, or repeat them as fact:**

- "MARS" / "Multimodal Ad Review System" — no such named system in Meta's docs
- "Account Health Score" with 70 / 50 / 25 thresholds — not in Meta's docs
- "Policy 4.3" as a policy number — Meta does not number it this way
- "Rule of 47" / "47 new policy rules" — not in Meta's docs
- All percentages: "24% of disapprovals", "11%", "14%", "92%", "159 million scam ads"
- "60-second review" — Meta's own docs say review **typically completes within 24 hours**
- "Semantic intent detection" as a named Meta capability
- 12pt / 28px disclosure font requirements
- Jan-2026 targeting cutoffs, Location Fees, MiCA Article 29 specifics

These may or may not describe real behaviour. The point is we cannot verify them, so they must not become product rules. Building on fake precision means every campaign breaks at once if the assumption was wrong.

---

## TIER 1 — CONFIRMED META POLICY

Sourced from Meta's Transparency Centre and Business Help Centre. This is the only tier that may become enforcement logic.

### 1.1 Privacy Violations and Personal Attributes

Meta's stated rule: ads must not contain content that asserts or implies personal attributes, including **direct or indirect** assertions or implications about a person's:

> race, ethnicity, religion, beliefs, age, sexual orientation or practices, gender identity, disability, physical or mental health (including medical conditions), vulnerable financial status, voting status, membership in a trade union, criminal record, or name

**Meta's "Ads can't" list:**
- Share or ask for personal attributes of a user or their family
- Imply that the advertiser is **aware of** someone's personal attributes
- Imply knowledge of **personal or organisational financial information**
- Imply awareness of personally identifiable information, such as their name
- Imply knowledge of medical information

**Meta's "Ads can" list:**
- Broadly reference personal attributes **not** on the list above — Meta's own examples: calling someone "American" or "New Yorker" to reference where they live

**Meta's stated rationale and remedy:** ads that make assumptions about people may feel intrusive or unsettling; instead, ads should **focus on the benefits of the product or service being advertised**.

**The operative mechanism:** the violation is *implying the advertiser knows something about the viewer*. This is why first-person and third-person framing structurally avoid it — neither asserts anything about the person seeing the ad.

### 1.2 Community Standard behind it (broader than the enumerated list)

Meta removes ads that:
- **exploit users' personal hardships**
- appear to make **negative or inaccurate characterisations** about them
- imply knowledge of sensitive personal information

⚠️ This is wider than the attribute list. Copy built on the reader's struggle, dread, or failure sits here even when no enumerated attribute is named.

### 1.3 Health and Wellness

- Ads must not **imply or attempt to generate negative self-perception**, or declare there is a perfect body type, to promote diet, weight loss, cosmetic procedures or health-related products
- Diet / weight-loss / cosmetic ads must target 18+

### 1.4 Relevance / ad-to-landing-page match

- Ads must clearly represent the company, product, service or brand advertised
- All ad components must be relevant to the product or service offered
- **The products and services promoted in an ad must match those promoted on the landing page**

### 1.4a Headline character count — 27 is a DISPLAY RECOMMENDATION, not a compliance rule

**Meta's published figure for the Facebook Feed ad headline is 27 characters**, stated on the Ads
Guide under the heading **"Text Recommendations"** — presented alongside primary text "50-150
characters", and explicitly separated from the technical requirements (file size, resolution).
Verified on two independent Meta Ads Guide pages (`/business/ads-guide/image/facebook-feed/traffic`
and `/business/ads-guide/update/image/facebook-feed/link-clicks`), July 2026.

**What this means, precisely:**
- It is a **display/performance recommendation about truncation in the feed**, NOT a policy rule.
  Exceeding it is **not a policy violation** and cannot get an ad rejected on compliance grounds.
- **It is therefore NOT enforceable logic under this document's Tier-1 rule.** Nothing in §3.3 may
  gate on headline length.

**⛔ NEITHER 38 NOR 40 APPEARS ANYWHERE IN META'S DOCUMENTATION.**
- **ZAP's `AD_HEADLINE_MAX_CHARS = 38`** (`server/_core/validator.ts`) is **ZAP's own craft
  standard** — a house rule about what reads well in our ad-creative image templates. It is
  legitimate as a craft standard. It is **not** a Meta limit and must never be described as one.
- The **"40-character recommendation"** in the ad-headline system prompt
  (`server/adCreativesGenerator.ts`) is **unsourced**. It does not come from Meta's docs.

**Why this is recorded here.** A live beginner cascade was killed by this gate: 1 of 5 headlines
came in a single character over 38, the validator rejected the whole batch, and the throw took down
a run that had completed eight nodes. The failContext called 38 "the 38-character Meta-compliance
limit", which made a house craft rule look like an external policy constraint nobody could
negotiate. **Wording corrected in code** to "ZAP's house limit". Recorded so the number is not
re-litigated from a blog later, and so nobody "fixes" the gate by aligning it to another invented
figure.

**If the gate is ever revisited:** the honest options are to keep 38 as a craft standard, move
toward Meta's actual 27 recommendation, or stop treating length as a hard blocker at all. What is
NOT available is calling any of them a Meta compliance requirement.

### 1.5 Review scope and permanence

- Review is primarily automated, **typically completed within 24 hours**
- Review **may include the ad's associated landing page or other destinations**
- **Ads remain subject to review and re-review at any time.** Approval is never permanent
- Lower-quality ads that don't violate policy may still see performance impact

### 1.6 Deceptive / Unacceptable Business Practices

- No deceptive or misleading practices, including offers designed to scam people out of money or personal information

### 1.7 Discriminatory practices and Special Ad Categories

- Ads must not discriminate based on protected attributes
- Advertisers running **financial products/services, housing, or employment** ads (US, Canada, parts of Europe) must self-identify as a **Special Ad Category** and use approved targeting

### 1.8 Cryptocurrency

**Permitted WITHOUT prior written permission:**
- Events, education and news related to cryptocurrency
- Tax services for cryptocurrency companies
- Blockchain technology news
- Products/services based on blockchain that are **not** a virtual currency (e.g. NFTs)
- Wallets that only **store** tokens (no buying, selling, swapping, staking)

**Sole condition:** the content **does not endorse the buying or selling of cryptocurrencies**.

**Requires prior written permission (and regulatory licensing):**
- Exchanges and trading platforms (spot, margin, futures)
- Lending and borrowing platforms
- Wallets that allow buy / sell / swap / stake
- Mining hardware and software
- Cryptocurrency investment offers soliciting customers to invest or join trading platforms

### 1.9 Enforcement consequences

Restrictions may apply to the business portfolio, ad account, Page, or user account, and may include spend limits, loss of payment or advertising features, or loss of the ability to advertise. If an ad account is disabled for a policy violation and remains ineligible for six months, unused prepaid balances may be forfeited.

---

## TIER 2 — PRACTITIONER-REPORTED (anecdotal; informs judgement, never a hard gate)

Not Meta statements. Treat as risk signals, not rules.

- **"Coaching lock-out":** business/career coaches reportedly flagged for the Employment Special Ad Category over words like *resume*, *interview preparation*, *scale your consulting income* — even though general career-development advice is exempt. **Relevant to ZAP's core audience.**
- **Symptom-as-assertion:** copy naming symptoms rather than conditions (e.g. sleep patterns, "tired", "stress") reportedly flagged as implying a condition, even without "you".
- **Third-person also flagged:** several sources claim indirect/third-person framing is caught like direct address. **Not supported by Meta's own wording** (which targets implying knowledge of *the viewer*). Treat as unconfirmed.
- **Destination scanning:** educational crypto ads linking to Discord/Telegram communities where signal trading occurs are reportedly reclassified as restricted.
- **Business vs personal finance blur:** for solo operators, business finances and personal finances can be read as the same thing; "paying the bills" / personal ruin framing reportedly treated as personal attribute even in B2B.

---

## TIER 3 — ZAP IMPLEMENTATION RULES

### 3.1 The core register standard — FIRST PERSON DEFAULT

The banned thing is the **diagnostic address**, not emotional force. Intensity is preserved; the aim changes.

| Prohibited (implies knowledge of viewer) | Permitted (same emotional payload) |
|---|---|
| "You're sitting in the car park to delay going in." | "I sat in the car park four minutes every Monday just to delay going in." |
| "Are you struggling to land high-ticket clients?" | "The outreach routine I used to land my first 10 high-ticket clients." |
| "Tired of your acne?" | "A routine for clearer-looking skin." |
| "Struggling with debt?" | "Financial planning services for long-term growth." |
| "Living with anxiety? This helps." | "Support for people who want calmer days." |

**Default: first-person ("How I…").** Reasons:
1. A claim about the advertiser's own experience cannot assert knowledge about the viewer — structurally outside the rule, not a workaround.
2. Third-person case study requires a *client story*, which collides with ZAP's no-fabrication rule. A new coach has no "Sarah". First-person needs no client.

**Third-person case study is permitted only where the coach has supplied real client material** (gated by existing fabrication rules).

**The ICP itself is unchanged.** It is an internal document, never seen by Meta. Only generated *output* register changes.

### 3.2 Niche-aware strictness (keyed to `service.category`)

Not one risk profile. Strictness must vary:

- **Business / marketing / consulting:** lowest risk. Business conditions (pipeline, revenue, growth) are organisational, not personal attributes. Watch the Employment/SAC trigger words (Tier 2).
- **Money / wealth / debt coaching:** "vulnerable financial status" is enumerated. Business struggle ≠ personal financial vulnerability, but for solo operators the line blurs. Avoid personal-survival framing.
- **Health / weight / fitness / wellness:** highest risk. Two stacked rules — personal attributes *and* negative self-perception. No before/after side-by-sides for weight loss or anti-ageing. No close-ups of "flaws".
- **Life / mindset / therapy-adjacent:** mental health is enumerated. Avoid clinical or diagnostic framing.
- **Crypto education:** see 1.8. The line is endorsement of buying/selling, and the nature of the product promoted.

### 3.3 Compliance checks to enforce (Tier 1 only)

1. **Second person + protected attribute** in the same construction → block/rewrite
2. **Negative self-perception** framing for diet/weight/health → block
3. **Ad-to-landing-page mismatch** → block before publish
4. **Crypto endorsement of buying/selling** → block for education-positioned accounts
5. **Special Ad Category trigger language** → flag for coach confirmation (not auto-block; Tier 2)
6. **Deceptive urgency / fake scarcity** → already covered by existing complianceFilter

### 3.4 What NOT to build

- Any rule derived from Tier 3 (fabricated) claims above
- The "six-figure business owners loophole" — described in research as the classifier *misinterpreting* the copy. Building on a described misinterpretation means every campaign breaks simultaneously if the classifier improves. If professional-tier framing is used, ground it in Meta's own permission to broadly reference non-listed attributes — not in the loophole.
- Hard gates on Tier 2 anecdote

---

## OPEN / GENUINELY UNDEFINED

Meta's own documentation does not resolve these. Do not invent a threshold:

- Where a **general business challenge** becomes an **implied personal distress** ("organisational financial information" is in Meta's prohibited list, yet business-condition copy is widely run)
- Whether ordinary stress/overwhelm language counts as **mental health**
- Whether second-person framing per se matters, or only the attribute implied
- The exact boundary of **"vulnerable" financial status**

Where undefined, prefer the register change (first person) which sidesteps the question entirely rather than resolving it.
