# Andromeda Copy Verification Signals: Auditing and Detecting Ad Copy Collapse in Production

## Executive Summary
Under Meta’s AI-native ad retrieval engine, **Andromeda**, creative-led targeting has replaced legacy manual optimization [272, 319, 805]. The most critical structural challenge facing advertisers is **Entity ID collapsing (Similarity Suppression)** [124, 208, 1092]. Andromeda groups visually and semantically similar ad assets under a single backend **Entity ID** [124, 208, 1092], which is allocated exactly **one "auction ticket"** to the Stage 1 retrieval stage [124, 208, 1230]. Consequently, duplicate copy options do not expand reach; they compete internally, driving up costs while under-delivering [18, 211, 230].

Because Meta's internal Entity ID is a backend-only database classification that is not exposed directly via the Graph API [1152, 1166], advertisers must use in-platform signals to verify copy diversity. This technical audit report identifies **five core in-platform signals** that reveal whether your ad copy is achieving true semantic diversity or collapsing into a single retrieval node, concluding with a **concrete, six-point diagnostic checklist** for media buying teams.

---

## 1. The Five Core In-Platform Verification Signals

To audit ad copy uniqueness without direct API access to Entity IDs, media buyers must evaluate five interconnected performance, budget, and learning delivery patterns in Ads Manager [21, 1237].

```
                             ANDROMEDA RETRIEVAL FLOW
                             ┌──────────────────────┐
                             │  Creative Ingestion  │
                             └──────────┬───────────┘
                                        ▼
                         /──────────────────────────┐
                        /   Does Cosine Similarity   \
                       <     Exceed Threshold?        >
                        ╲   (mBERT & XLM-RoBERTa)    /
                         ╲──────────────────────────/
                                │            │
                          YES   │            │ NO
                                ▼            ▼
                        ┌──────────────┐  ┌──────────────┐
                        │Single Entity │  │Unique Entity │
                        │ (Collapsed)  │  │ (Divergent)  │
                        └──────┬───────┘  └──────┬───────┘
                               ▼                 ▼
                      - Hot Ad Spend Skew - Distributed Spend
                      - Starved Delivery  - Concurrent Learning
                      - CPM Inflation     - Distinct Audiences
```

### Signal 1: Spend Concentration and "Hot Ad Bias"
The most immediate indicator of Entity ID clustering is budget distribution [30, 211, 1237]. When multiple copy variations run inside a shared ad set under CBO or ASC, Andromeda and the Generative Engagement Model (GEM) evaluate early user interactions [30, 211, 524].
*   **The Collapse Pattern:** The algorithm concentrates **more than 40% (and up to 90%) of the ad set’s budget on a single "hero" asset**, leaving other variations starved of impressions [30, 171, 211, 1237]. When copy variations share highly correlated embeddings, Andromeda routes all traffic to the dominant variant to conserve server-side compute resources [211, 1237]. 
*   **The Diverse Pattern:** Spend is **distributed across multiple creatives** (e.g., 3–4 assets each capturing 15–30% of spend) [62, 1237]. This indicates that the copy variants map to different branches of Andromeda's hierarchical index, fanning out into separate audience pathways [20, 124, 1237].

### Signal 2: Delivery Starvation of New Variations
When introducing new ad copy to a running campaign, the rate and volume of initial impressions reveal how the retrieval engine classifies the asset [181, 211, 1157].
*   **The Collapse Pattern:** The new copy variant receives **near-zero delivery (starvation) immediately upon activation**, or receives less than 1,000 impressions over 72 hours despite a large campaign budget [211, 492, 1157]. If the new ad is semantically redundant with an active top-performing ad, the retrieval engine prunes its branch or merges its representation under the dominant Entity ID, suppressing its auction entry [124, 208, 1230].
*   **The Diverse Pattern:** The new ad **gains delivery momentum quickly**, securing a self-sustaining share of impressions within 6 to 12 hours of exiting the policy review stage [1378]. This indicates a net-new Entity ID that Andromeda can route to non-overlapping user segments [209, 1237].

### Signal 3: CPM Behavior and Auction Overlap
CPM acts as a direct diagnostic of account-level auction efficiency and creative fatigue [21, 186, 1237].
*   **The Collapse Pattern:** CPMs climb **20% to 50% above the historical account baseline** without any seasonal or competitive macro shifts, particularly when "similar" copy variations are distributed across different ad sets [21, 221, 1237]. Because the redundant ads are mapped to the same node in the hierarchical index, they compete against each other for the same audience clusters, causing artificial self-competition (auction overlap) and bidding up delivery costs [221, 1237].
*   **The Diverse Pattern:** CPMs remain **stable or drop** below the account baseline [1127]. Genuinely diverse copy concepts bypass retrieval suppression, fanning out into separate audience pockets and reducing overall auction pressure [209, 211, 1237].

### Signal 4: Learning Phase Recurrence
A creative's interaction with Meta's optimization loop (the "learning phase") is a powerful indicator of its structural uniqueness [14, 21, 1237]. Genuinely distinct creative concepts must accumulate approximately **50 optimization events within a 7-day window** to stabilize [222, 636, 653].
*   **The Collapse Pattern:** A new ad variation is activated and **immediately bypasses the learning phase, inheriting the performance state and stable delivery metrics of an active winner** [1237]. This is a clear indicator that Andromeda has classified the ad as a cosmetic variation, grouping its data signals under the existing Entity ID rather than generating a fresh learning bucket [124, 229, 1237].
*   **The Diverse Pattern:** The new copy variation **enters a fresh, independent learning phase**, showing initial volatility in CPA before stabilizing as conversion events accumulate [14, 1237]. This confirms that the copy has been indexed on a separate node of the tree, creating a new delivery pathway [235, 1237].

### Signal 5: Dynamic Spend Share and Placement Skew
Andromeda personalizes delivery by matching distinct creative templates to specific user behavioral profiles [215, 216].
*   **The Collapse Pattern:** The **spend share among copy variations remains static** even as the composition of the audience changes [1237]. If the copy lacks structural diversity (such as carrying conflicting awareness-stage signals across the headline and primary text), it fails to resonate with distinct cohorts, forcing the algorithm to default to its safest historical baseline [211, 1237].
*   **The Diverse Pattern:** Spend share fluctuates dynamically [1237]. Under an Advantage+ structure, **different copy variants capture spend on different placements and demographics** (e.g., Variant A scales on Instagram Reels targeting younger demographics, while Variant B delivers on Facebook Feed to older users) [215, 1237]. This proves the copy carries distinct, complementary signals that map to separate user sequences [210, 1237].

---

## 2. In-Platform Metric Proxy Matrix

Because internal similarity scores and Entity IDs are backend-only values [1152, 1166], advertisers must use the following matrix to translate observable Ads Manager metrics into structural diagnostics:

| Observable Signal | Metrics to Monitor | Collapse Threshold (Grouped Entity ID) | Diverse Target (Unique Entity ID) | Required Architectural Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Budget Concentration** | Spend Share % per Ad inside a single Ad Set [30, 1237]. | **Single asset captures >90% of spend** while other similar variants get <5% [30, 211, 1237]. | **spend is fanned out** across multiple assets (e.g., 3–4 ads each getting 15–30% of spend) [62, 1237]. | **Pause starved duplicates.** Inject a new ad with a 2-of-4 dimensional shift (persona, hook, format, or desire) [1190, 1198]. |
| **CPM Inflation** | Ad Set CPM vs. Account Historical Baseline [21, 1237]. | **CPM rises >20%** compared to baseline when similar copies run in parallel ad sets [21, 1237]. | **CPM remains stable or decreases** [1127]. | **Consolidate ad sets.** Merge duplicate audiences into a single broad ad set to eliminate auction overlap [216, 222, 1237]. |
| **Retrieval Speed** | Impression Count within first 24–48 hours [1237, 1378]. | **New variant gets <1,000 impressions** despite active budget [1237]. | **New variant scales to normal delivery** within 6–12 hours of approval [1378]. | **Reject cosmetic edits.** Avoid simple synonym swaps or button tweaks. Write a completely different emotional hook [1190, 1231]. |
| **Learning Reset** | Learning Phase Status & CPA Volatility [14, 1237]. | **New ad inherits historical performance** with zero learning-phase volatility [1237]. | **Fresh, independent learning curve** showing initial CPA volatility [14, 1237]. | **Enforce structural diversity.** Re-write the opening 10 tokens to prime a new self-attention trajectory [1192, 1194]. |
| **Placements Share** | Impression Breakdown by Placement & Demographics [1237]. | **Identical placement distribution** across all variants [1237]. | **Dynamic placement distribution** (e.g., Variant A on Reels, Variant B on Feed) [1237]. | **Vary format and style.** Combine vertical video (UGC-style) with static carousels to reach different cohorts [183, 210, 233]. |

---

## 3. The 6-Point Production Verification Checklist

Use this actionable checklist on your weekly ad account audit to verify that your copy generation pipeline is creating unique Entity IDs and bypassing retrieval suppression [25, 30]:

### [ ] Step 1: Audit Spend Distribution for "Hot Ad Bias"
*   **Measurement:** Open Ads Manager, set the date range to the last 7 days, and analyze the spend distribution at the ad level within CBO/ASC campaigns [30, 1237].
*   **Verification:** If a single copy variation is capturing >90% of the spend, pause the remaining, inactive ads immediately [30, 211, 1237]. Rather than attempting to "force" delivery by duplicating the inactive ads into new ad sets (which resets learning and inflates CPMs), send them back to the generator for structural rewrites [1184, 1237].

### [ ] Step 2: Query the "Creative Similarity" Reporting Panel
*   **Measurement:** Customize your Columns in Ads Manager to include the newly released creative performance metrics: **Creative Similarity**, **Creative Fatigue**, and **Top Creative Themes** [22, 59, 1240].
*   **Verification:** Verify that active ad sets maintain an average **Creative Similarity Score below 40%** [221, 1241]. If any active copy variants are flagged with a similarity score above 60%, they are actively triggering retrieval suppression—re-engineer their hook framing to secure unique Entity IDs [221, 339, 1241].

### [ ] Step 3: Run the "Differentiator" Human Check on Assets
*   **Measurement:** Open the ad-level preview panel in Ads Manager and look at your active copy variants side-by-side without reading the text [1237].
*   **Verification:** If you were a user scrolling at high speed, would these ads appear visually identical? [1237] If they share the exact same template, creator face, or backdrop, they will collapse under the same Entity ID [207, 211, 1237]. Ensure that every batch of copy is paired with distinct visual environments or format types [210, 233, 1237].

### [ ] Step 4: Track the Learning Curve of New Ingestions
*   **Measurement:** When launching a new copy variation, monitor the "Delivery" column in Ads Manager over the first 48 hours [1237].
*   **Verification:** Ensure the new asset enters a **"Learning"** state and exhibits typical initial performance variance [14, 1237]. If it immediately mirrors the CPA of your active winner with zero calibration period, it has collapsed under an existing Entity ID cluster [229, 1237]. Pause it and rewrite the opening 10 tokens to force a new vector encoding [1192, 1194].

### [ ] Step 5: Monitor the CPA-to-CPM Divergence Curve
*   **Measurement:** Plot your weekly CPA against your campaign CPM over a 30-day window [1237].
*   **Verification:** Look for the **divergence curve**: if your CTR is stable but CPM is rising alongside CPA, the retrieval engine is experiencing creative similarity fatigue [186, 1237]. Andromeda is running out of users within the specific branch your ads occupy [20, 1237]. You must launch a new concept that targets a completely different persona or awareness stage [26, 210, 1237].

### [ ] Step 6: Verify CAPI Deduplication Signal Health
*   **Measurement:** Open Meta Events Manager and analyze the **Deduplication** and **Event Match Quality (EMQ)** columns [39, 41, 1237].
*   **Verification:** Ensure that your pixel and server-side Conversions API (CAPI) events achieve a **deduplication rate above 90%** and an EMQ score above 6.0 [39, 1239, 1241]. Deduplication mismatches double-count conversion events, polluting user behavioral logs and preventing the sequence learning models from accurately routing your copy to high-intent buyers [28, 223, 1238].

---

## 4. Evidence Hygiene: Excluded Speculative Claims

To ensure software integrity, the following unverified industry claims have been audited and **explicitly excluded** from our diagnostic checklist and codebase recommendations [1202]:
1.  **The "60% Suppressive Threshold" Rule:** While industry agencies frequently state that a similarity score of exactly 60% triggers automatic delivery penalties, Meta’s official engineering documentation describes a highly elastic, dynamic similarity threshold governed by **Model Elasticity** [7, 203, 1241]. The threshold shifts based on real-time server traffic and predicted ad-set value [7, 1241]. We do not hardcode static percentage rules in our software.
2.  **The "Headline carries 50% more weight" Multiplier:** Practitioner blogs claim that headlines are weighted twice as heavily as primary text in Andromeda's retrieval index [1233, 1241]. Meta's technical publications explicitly contradict this, describing a holistic, multi-modal fusion process where all standard copy fields and Rosetta OCR visual text are projected into a unified metric space without field-level multiplier weights [10, 1233, 1241].
3.  **The "Exactly 6 Creatives per Ad Set" Limit:** Industry forums assert that accounts are penalized if they run more than 6 active creatives per ad set [1241]. Our framework rejects this; optimal creative volume is dynamic, scaling based on signal density, budget, and campaign objective (ranging from 8–12 for low budgets up to 150 for ASC campaigns), provided each active ad set maintains at least **50 conversion events per week** [1222, 1241].
