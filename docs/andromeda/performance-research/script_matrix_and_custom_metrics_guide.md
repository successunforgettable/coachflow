# Meta Video Ad Script Matrix & Ads Manager Custom Metrics Implementation Guide

This document provides a dual operational framework for high-consideration and high-ticket Meta video ad campaigns post-Andromeda:
1. **A 5-Part Pre-Qualifying Script Matrix**: Modular video ad frameworks designed to filter for buyer intent in seconds 0–3, optimizing Stage 1 Andromeda candidate retrieval and maximizing downstream conversion.
2. **Meta Ads Manager Custom Metrics Guide**: Step-by-step formulas, UI setup instructions, and diagnostic benchmarks for tracking Hook-to-Hold ratios, Pre-Qualification Efficiency, and Terminal Conversion Yield directly inside Ads Manager.

---

## Part 1: The 5-Part Pre-Qualifying Video Script Matrix

### Conceptual Grounding
Under Meta’s two-stage retrieval architecture (Andromeda), Stage 1 utilizes GPU-accelerated nearest-neighbor search (NVIDIA Grace Hopper / MTIA) to query candidate ads against multi-modal user embeddings. Standard "clickbait" hooks generate high 3-second engagement from non-buying users, corrupting the ad's seed audience profile and causing Stage 1 to retrieve broader, lower-intent audiences. 

Pre-qualifying hooks deliberately sacrifice broad 3-second Thumbstop Rates (accepting 18–25% TSR vs. 35%+ broad TSR) in exchange for higher intent density, driving higher Hook-to-Hold ratios (35%+) and significantly lower downstream Cost-Per-Acquisition (CPA).

---

### Script Framework 1: The Negative Disqualifier ("If You Don't Have X, Skip This")

* **Strategic Purpose**: Immediately deters non-target scrollers to avoid feeding low-intent engagement signals to Andromeda, concentrating Stage 1 retrieval on qualified decision-makers.
* **Target Audience**: B2B Founders, Marketing Directors, and Enterprise Buyers.
* **Duration**: 45 Seconds.

```
[0:00 - 0:03] HOOK (Visual & Audio Directives)
Visual: Creator sitting at a desk, looking directly into camera, holding up a hand in a "stop" motion while pointing to a bold text overlay.
Text Overlay: "DO NOT WATCH IF YOU SPEND UNDER $10K/MO ON ADS"
Audio (Voiceover/Spoken): "If you’re spending less than $10,000 a month on Meta ads, please skip this video right now. This is not for you."

[0:03 - 0:07] NARRATIVE BRIDGE
Visual: Fast cut to screen recording of Meta Ads Manager interface highlighting an Andromeda campaign breakdown.
Text Overlay: "Why Meta Andromeda changed ad retrieval"
Audio: "But if you ARE scaling past $10k or $50k a month, you’ve probably noticed that your creative winning rate has plunged over the last two quarters."

[0:07 - 0:25] VALUE & PROOF BODY
Visual: Creator walking through a digital whiteboard diagram showing Stage 1 Andromeda Retrieval vs Stage 2 Auction Ranking.
Text Overlay: "Stage 1 Retrieval = Intent Matching"
Audio: "Here’s why: Meta’s Andromeda update stopped matching ads based on demographic targeting and started clustering ads into Entity IDs based on creative semantic concepts. When you use broad, curiosity-bait hooks, you pull in low-intent scrollers. Andromeda indexes your ad as 'broad interest',Tanking your downstream conversion rate."

[0:25 - 0:38] PROOF & OBJECTION HANDLING
Visual: On-screen case study chart showing CPA dropping from $120 to $42 after implementing pre-qualifying creative.
Text Overlay: "Case Study: -65% CPA via Pre-Qualifying Hooks"
Audio: "By shifting our scripts to pre-qualifying openings, we intentionally dropped our hook rate by 5%, but our Hook-to-Hold ratio doubled to 38%, and our Cost-Per-Qualified-Attendee dropped 62%."

[0:38 - 0:45] PRE-QUALIFYING CTA
Visual: Creator pointing down to a clear CTA banner with webinar event details.
Text Overlay: "Live Technical Briefing | Tuesday 2 PM EST | B2B / Scale-Up Brands Only"
Audio: "Click the link below to join our live 30-minute technical briefing on Andromeda creative engineering. If you’re ready to scale systematically, reserve your seat now."
```

---

### Script Framework 2: The Mechanism Call-Out ("The Death of General Ads / Rise of Entity IDs")

* **Strategic Purpose**: Appeals to sophisticated buyers by exposing a fundamental structural shift in their industry, establishing high authority in seconds 0–3.
* **Target Audience**: Performance Marketers, DTC Operators, and Agency Owners.
* **Duration**: 60 Seconds.

```
[0:00 - 0:03] HOOK
Visual: Dynamic camera zoom-in on creator holding a printed chart showing creative performance decay curves.
Text Overlay: "The Death of 50 Creative Variations/Week"
Audio: "Making 50 visual tweaks to the same ad hook used to work. In 2026, Meta’s Andromeda algorithm deletes those variations in Stage 1 retrieval."

[0:03 - 0:07] NARRATIVE BRIDGE
Visual: Cut to a split-screen comparing "Micro-Variations" (X mark) vs "Conceptual Diversity" (Check mark).
Text Overlay: "Entity ID Deduplication"
Audio: "If your creative variations share the same underlying concept, Andromeda assigns them a single Entity ID and suppresses 90% of your spend."

[0:07 - 0:30] VALUE & PROOF BODY
Visual: Kinetic typography overlay combined with B-roll of video editing timeline.
Text Overlay: "3 Structural Pillars for 2026 Creative"
Audio: "To win in the Andromeda environment, you need three distinct conceptual pillars in your script pipeline: First, pre-qualifying identity calls. Second, mechanism-first value delivery in seconds 3 to 15. Third, a single, high-friction CTA that pre-qualifies landing page traffic."

[0:30 - 0:48] PROOF & NEUROBIOLOGICAL DEMONSTRATION
Visual: Creator reviewing a prospective memory degradation graph from short-video research studies.
Text Overlay: "Context Switching = Attention Loss"
Audio: "Recent cognitive studies prove short-form video feed scrolling degrades prospective memory by 40%. If your script doesn't anchor a concrete mechanism within the first 10 seconds, viewers forget your message before the video even ends."

[0:48 - 1:00] PRE-QUALIFYING CTA
Visual: Clean slide graphic displaying the 3-Layer Testing Blueprint downloadable asset.
Text Overlay: "Download the Andromeda Creative Framework (PDF)"
Audio: "Tap below to get our complete 2026 Creative Testing Blueprint, including 15 pre-qualifying script templates. Claim your copy today."
```

---

### Script Framework 3: The Financial Benchmark Hook ("For Brands Spending $10k–$100k+/mo")

* **Strategic Purpose**: Uses exact financial parameters to self-select high-LTV accounts and filter out hobbyists or pre-revenue users instantly.
* **Target Audience**: Growth Executives, CMOs, and Enterprise Founders.
* **Duration**: 45 Seconds.

```
[0:00 - 0:03] HOOK
Visual: High-contrast text graphic over minimalist background; creator steps into frame.
Text Overlay: "IF YOUR ACQUISITION COST IS ABOVE $50 → WATCH THIS"
Audio: "If your customer acquisition cost on Meta is currently over $50, stop scrolling and look at these three numbers."

[0:03 - 0:07] NARRATIVE BRIDGE
Visual: Three metric callouts pop up on screen: "Hook Rate: 22%", "Hold Rate: 36%", "ROAS: 4.1x".
Text Overlay: "The Pre-Qualification Ratio"
Audio: "Notice how our hook rate is only 22%, but our ROAS is 4.1x? That's because we stopped optimizing for scrollers and started optimizing for buyers."

[0:07 - 0:28] VALUE & PROOF BODY
Visual: Live walk-through of an Ads Manager dashboard highlighting custom metrics (Hook-to-Hold Ratio).
Text Overlay: "Custom Metric: Hook-to-Hold > 30%"
Audio: "Most ad accounts fail because their agencies chase 40% thumbstop rates using sensationalized curiosity hooks. Those scrollers drop off at second 6 because the video body fails to deliver on the hook's false promise."

[0:28 - 0:38] PROOF & OBJECTION HANDLING
Visual: Side-by-side comparison chart showing Clickbait Hooks vs Pre-Qualifying Hooks on Webinar Show-Up Rates (30% vs 52%).
Text Overlay: "Show-Up Rate Impact: +73% Lift"
Audio: "When we switched to pre-qualifying hooks, our webinar show-up rate jumped from 30% to 52%, dropping effective cost-per-attended-lead from $50 down to $28."

[0:38 - 0:45] PRE-QUALIFYING CTA
Visual: Creator pointing to screen displaying calendar scheduling interface.
Text Overlay: "Schedule a 1-on-1 Growth Audit | Senior Strategists Only"
Audio: "If you're managing over $20k/month in ad spend, click below to book a direct creative audit with our strategy team."
```

---

### Script Framework 4: The Counter-Intuitive Myth Busting Hook ("Why High CTR is Destroying Your ROAS")

* **Strategic Purpose**: Disrupts conventional wisdom to capture analytical decision-makers who are frustrated with vanity metrics.
* **Target Audience**: Head of Performance, Growth Marketers, Data Analysts.
* **Duration**: 45 Seconds.

```
[0:00 - 0:03] HOOK
Visual: Creator holding a marker, drawing a big red 'X' through a box labeled "High CTR = High Sales".
Text Overlay: "HIGH CTR IS RUINING YOUR ADS"
Audio: "Here is a mathematical truth most ad agencies will never tell you: a high Click-Through Rate is often the primary reason your campaign ROAS is collapsing."

[0:03 - 0:07] NARRATIVE BRIDGE
Visual: Chart display showing a scatter plot of CTR vs ROAS across 1.4M ad spend showing zero statistical correlation (R^2 = 0.003).
Text Overlay: "1.4M Spend Data: R² = 0.003"
Audio: "Data across millions in ad spend proves that Outbound CTR has virtually zero statistical correlation with downstream revenue."

[0:07 - 0:26] VALUE & PROOF BODY
Visual: Animation illustrating viewer psychology: "Curiosity Clickers" vs "Intent Buyers".
Text Overlay: "Curiosity Clicks vs Intent Clicks"
Audio: "When your ad uses clickbait to force a click, you send un-prequalified traffic to your funnel. These users bounce in 5 seconds, ruining your landing page conversion rate and training Meta's AI to find more cheap clickers instead of high-value buyers."

[0:26 - 0:36] PROOF & OBJECTION HANDLING
Visual: Diagram showing the "Pre-Qualified Intent Funnel".
Text Overlay: "Filter Upfront → Convert Downstream"
Audio: "Instead, your video script must educate and pre-qualify *before* the click occurs. You want lower CTR with higher conversion intent."

[0:36 - 0:45] PRE-QUALIFYING CTA
Visual: Creator sitting at laptop, showing the workshop registration page.
Text Overlay: "Free Advanced Masterclass: Creative Engineering Post-Andromeda"
Audio: "Learn how to build creative systems that drive real revenue. Click the link to register for our upcoming live session."
```

---

### Script Framework 5: The Case Study / Audit Proof Hook ("How We Scaled $1.29M Spend at 3.4x ROAS")

* **Strategic Purpose**: Uses exact financial figures and data-backed proof to attract risk-averse, highly analytical enterprise prospects.
* **Target Audience**: CEOs, VCs, Financial Controllers, Enterprise CMOs.
* **Duration**: 60 Seconds.

```
[0:00 - 0:03] HOOK
Visual: Screen recording displaying audited financial metrics and verified Meta Ads Manager spend dashboards ($1.29M spend, 3.42 ROAS).
Text Overlay: "$1.29M Meta Spend | 3.42 ROAS Case Study"
Audio: "We spent $1.29 million on Meta video ads over the last 12 months at a 3.42 ROAS. Here is the exact 3-layer script structure we used."

[0:03 - 0:08] NARRATIVE BRIDGE
Visual: Graphic breaking down the 3 layers: 1. Identity Hook, 2. Mechanism Proof, 3. Friction CTA.
Text Overlay: "The 3-Layer Creative Blueprint"
Audio: "We didn't rely on viral trends or UGC reaction videos. We built systematic, thesis-driven ad scripts."

[0:08 - 0:35] VALUE & PROOF BODY
Visual: Step-by-step breakdown of script execution on screen with video clips demonstrating pacing.
Text Overlay: "Layer 1: Pre-Qualify | Layer 2: Proof | Layer 3: Action"
Audio: "Layer 1 identifies the target buyer's exact financial or operational constraint in 3 seconds. Layer 2 demonstrates our proprietary mechanism using live screen proof within 15 seconds. Layer 3 sets a high-friction expectation so only qualified leads click."

[0:35 - 0:50] PROOF & NEUROBIOLOGICAL DEMONSTRATION
Visual: Graphic highlighting the 2-Second Visual Pacing Rule (changing visual cues every 2.5s to reset attention).
Text Overlay: "The 2.5-Second Visual Reset Rule"
Audio: "To combat feed fatigue and keep Hold Rates above 30%, we execute a visual element change every 2.5 seconds—preventing cognitive habituation while maintaining message clarity."

[0:50 - 1:00] PRE-QUALIFYING CTA
Visual: Clean slide showing the case study breakdown document.
Text Overlay: "Download the Full 28-Page Breakdown (PDF)"
Audio: "Want to examine the full $1.29M case study? Click below to download the complete 28-page breakdown."
```

---

## Part 2: Meta Ads Manager Custom Metrics Setup Guide

To track pre-qualification performance, creative retention, and Andromeda retrieval alignment directly inside Meta Ads Manager, you must configure custom metrics. Standard metrics (CTR, CPM, CPC) fail to isolate script performance from creative fatigue.

---

### Key Custom Metric Formulas & Specifications

#### 1. Hook-to-Hold Ratio (%)
* **Definition**: The percentage of viewers who hit the 3-second hook AND continue watching through 15 seconds (or ThruPlay completion). Isolates body retention and narrative pacing from visual hook performance.
* **Formula**:
  $$	ext{Hook-to-Hold Ratio (\%)} = \left( rac{	ext{ThruPlays}}{	ext{3-Second Video Plays}} ight) 	imes 100$$
  *(Alternative formula if using 15-Second Plays: `(15-Second Video Plays / 3-Second Video Plays) * 100`)*
* **Format**: Percentage (`%`)
* **Benchmark Targets**:
  * `< 15%`: Poor narrative bridge; drop-off between hook and body.
  * `15% – 25%`: Average performance.
  * `25% – 35%`: Healthy pre-qualifying retention.
  * `> 35%`: Top 10% winning creative script.

#### 2. Hook Rate / Thumbstop Rate (%)
* **Definition**: The percentage of impressions that resulted in at least 3 seconds of video play.
* **Formula**:
  $$	ext{Hook Rate (\%)} = \left( rac{	ext{3-Second Video Plays}}{	ext{Impressions}} ight) 	imes 100$$
* **Format**: Percentage (`%`)
* **Benchmark Targets**:
  * `Broad UGC/E-com`: 30% – 45%+
  * `Pre-Qualifying B2B/High-Ticket`: 18% – 28% (Lower initial stop rate is expected and desirable when pre-qualifying).

#### 3. Pre-Qualification Efficiency Index (PQI)
* **Definition**: Measures how efficiently 3-second viewers are converted directly into outbound website clicks. High PQI indicates strong intent alignment across the hook and body script.
* **Formula**:
  $$	ext{PQI} = \left( rac{	ext{Outbound Clicks}}{	ext{3-Second Video Plays}} ight) 	imes 100$$
* **Format**: Percentage (`%`)
* **Benchmark Targets**: `1.5% – 3.5%+`

#### 4. Cost Per Retained Viewer (Cost Per Hold / ThruPlay) ($)
* **Definition**: The actual media cost to retain a user through 15 seconds of core messaging.
* **Formula**:
  $$	ext{Cost Per Hold} = rac{	ext{Amount Spent}}{	ext{ThruPlays}}$$
* **Format**: Currency (`$`)
* **Benchmark Targets**: `$0.08 – $0.25` (Vertical dependent).

#### 5. Terminal Conversion Yield (TCY) (%)
* **Definition**: Tracks end-of-funnel conversions per 15-second engaged video view. Connects video retention directly to downstream revenue.
* **Formula**:
  $$	ext{TCY (\%)} = \left( rac{	ext{Results (Conversions)}}{	ext{ThruPlays}} ight) 	imes 100$$
* **Format**: Percentage (`%`)
* **Benchmark Targets**: `0.5% – 2.0%+`

---

### Step-by-Step Meta Ads Manager Implementation

Follow these exact steps to create and save these metrics in your Meta Ads Manager UI:

1. **Navigate to Columns Customization**:
   * Open **Meta Ads Manager**.
   * Click on the **Columns: Performance** dropdown menu (located above the reporting table on the right).
   * Select **Customize Columns...** at the bottom of the dropdown.

2. **Create a New Custom Metric**:
   * In the top-right of the Customize Columns window, click the **Create Custom Metric** button.
   * In the setup modal, configure the metric parameters:

3. **Configure Custom Metric Setup**:

   * **Metric 1: Hook-to-Hold Ratio**
     * **Name**: `Hook-to-Hold Ratio (%)`
     * **Description**: `ThruPlays divided by 3-Second Video Plays`
     * **Format**: `Percentage (%)`
     * **Formula**: Click field and select `ThruPlays` $ightarrow$ type `/` $ightarrow$ select `3-Second Video Plays`.
     * **Access**: Set to `Anyone with access to this business`.

   * **Metric 2: Hook Rate**
     * **Name**: `Hook Rate / Thumbstop (%)`
     * **Description**: `3-Second Video Plays divided by Impressions`
     * **Format**: `Percentage (%)`
     * **Formula**: `3-Second Video Plays` `/` `Impressions`.

   * **Metric 3: Pre-Qualification Index**
     * **Name**: `Pre-Qual Efficiency Index (%)`
     * **Description**: `Outbound Clicks divided by 3-Second Video Plays`
     * **Format**: `Percentage (%)`
     * **Formula**: `Outbound Clicks` `/` `3-Second Video Plays`.

   * **Metric 4: Cost Per Hold**
     * **Name**: `Cost Per Hold ($)`
     * **Description**: `Amount spent divided by ThruPlays`
     * **Format**: `Currency ($)`
     * **Formula**: `Amount Spent` `/` `ThruPlays`.

4. **Build and Save the "Andromeda Creative Diagnostic" Preset**:
   * In the Customize Columns modal, select and order the following columns from left to right:
     1. **Ad Name**
     2. **Amount Spent**
     3. **Impressions**
     4. **3-Second Video Plays**
     5. **Hook Rate / Thumbstop (%)** *(Custom Metric)*
     6. **ThruPlays**
     7. **Hook-to-Hold Ratio (%)** *(Custom Metric)*
     8. **Cost Per Hold ($)** *(Custom Metric)*
     9. **Outbound Clicks**
     10. **Pre-Qual Efficiency Index (%)** *(Custom Metric)*
     11. **Results / Conversions**
     12. **Cost per Result**
     13. **ROAS (Purchase/Lead Value)**
   * Check the box in the bottom-left: **Save as preset**.
   * Name the preset: `Andromeda Creative Diagnostic View`.
   * Click **Apply**.

---

### Diagnostic Decision Tree Using Custom Metrics

Use this quantitative matrix to optimize creative assets based on custom metric outputs:

| Diagnostic Pattern | Metric Signature | Root Cause Analysis | Actionable Script Fix |
| :--- | :--- | :--- | :--- |
| **High Hook / Low Hold** | Hook Rate > 35%, Hook-to-Hold < 15% | Sensation/Bait Hook disconnects from Body messaging. | Re-write seconds 3–7 Narrative Bridge; align hook hook proposition directly with core offer. |
| **Low Hook / High Hold** | Hook Rate < 18%, Hook-to-Hold > 35% | Creative is highly qualified but visual hook lacks stopping power. | Retain body script; iterate on 3-second visual variation (text overlay, pacing, creator framing). |
| **Low Hook / Low Hold** | Hook Rate < 15%, Hook-to-Hold < 15% | Asset failure; lack of visual contrast and poor concept alignment. | Kill ad; pivot to a completely new Entity ID conceptual pillar. |
| **High Hook / High Hold / Low PQI** | Hook Rate > 25%, Hold > 30%, PQI < 1.0% | Video retains viewers but CTA fails to drive outbound click intent. | Strengthen pre-qualifying CTA in final 15 seconds; set clear expectations before the click. |
