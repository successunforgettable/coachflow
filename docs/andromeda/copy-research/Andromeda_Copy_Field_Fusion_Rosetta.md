# Andromeda Copy Field Fusion & Rosetta OCR: The Multimodal Ingestion Architecture

This technical report provides a source-grounded analysis of how Meta’s ad recommendation engine, **Andromeda**, ingests, parses, and fuses the separate text surfaces of an ad asset [4]. Specifically, we analyze how standard text fields—**headlines**, **primary text**, and **link descriptions**—are integrated with visual text extracted via the **Rosetta OCR pipeline** [10, 13]. 

We examine the exact mechanics of this multi-modal fusion, address practitioner assumptions, and outline an implementable, three-tier rule for copywriting generators to maximize retrieval efficiency under the **GEM (Generative Ads Model)** stack [8, 10].

---

## 1. Ingestion and Linguistic Encoding Architecture

During Candidate Generation (Retrieval), Andromeda must filter tens of millions of ads down to roughly 1,000 candidates within a strict sub-300ms latency budget [4, 5, 806]. To achieve this, ad text is processed using multilingual, Transformer-based dual-encoders, such as **XLM-RoBERTa (XLM-R)** and **multilingual BERT (mBERT)** [11, 14, 15]. These models project user behavior sequences and ad content into a shared, high-dimensional semantic embedding space [11, 15]. 

During ingestion, standard text fields are handled as separate semantic inputs [10, 1198]:
*   **Primary Text Field**: Ingested as a source of contextual cues, parsing long-range semantic frameworks [11, 14, 1198].
*   **Headline Field**: Treated as a high-density summary of the ad's core proposition, establishing the primary cognitive category [10, 1198].
*   **Link Description Field**: Ingested as secondary placement-specific metadata, conditionally rendered on supported surfaces like Marketplace or Search [183, 621, 628].
*   **On-Image/On-Video Text (Rosetta OCR)**: Extracted directly from visual frames, transcribed, and saved in Meta’s social graph database, **TAO** [12, 1170]. Downstream retrieval layers read this on-media copy alongside standard metadata [12].

---

## 2. Multi-Modal Fusion: One Vector, Weighted, or Kept Separate?

### The Verified Mechanics: Hierarchical Graph Representation
According to Meta’s engineering disclosures, ad copy fields are **neither flattened into a single text block prior to embedding, nor are they governed by static, hard-coded weighting multipliers** (such as "headlines carry exactly 50% more weight than primary text") [10, 1198]. 

Instead, Andromeda utilizes **Hierarchical Interest Representation (HIR)** to build a unified joint embedding space [10, 1187]. HIR constructs a typed, weighted, and time-decayed heterogeneous graph containing billions of nodes (representing users, advertisers, product catalogs, specific ad campaigns, and conversion pixels) [10, 1188]. 

Within this heterogeneous graph structure [10]:
1.  **Independent Ingestion**: Standard text fields and Rosetta OCR transcriptions enter the system as **separate feature inputs** [10, 1198].
2.  **Node Enrichment**: Product metadata, descriptions, and Rosetta OCR transcriptions are processed through a customized LLM inference engine, generating semantic feature inputs [10, 1188].
3.  **Cross-Feature Learning**: The system uses a transformer-based hierarchical encoder (such as the **InterFormer** or **Wukong** architectures) to learn interactions between these unpooled embeddings [6, 10, 1125]. This is done via target-aware multi-head attention mechanisms that evaluate the semantic alignment between different fields and real-time user intent, rather than applying flat, static weights [6, 8, 316, 1125].
4.  **Discretization into BoM Tokens**: To enable sub-millisecond retrieval via inverted-index lookups, the continuous universal embeddings are discretized into a structured vocabulary of latent semantic primitives called **Bag-of-Meaning (BoM) tokens** via composite quantization [10, 174].

### Excluding Practitioner Speculation
We must explicitly flag and exclude unverified practitioner claims regarding hard-coded weighting rules [1205]. Practitioner speculation often asserts that "dynamic primary text variations are pooled and weighted exactly 50% less than headlines" [1198, 1205]. Meta’s official publications contradict this, describing a holistic, multi-modal semantic fusion process where all inputs are embedded into a single relational graph without explicit, field-level multiplier weights [10, 1198, 1205].

---

## 3. The Rosetta OCR Pipeline: Extracting Visual Text

When copy is baked directly into static image creatives or video frames, Andromeda relies on the **Rosetta OCR system** to extract the text [12, 13, 1184]. Rosetta operates through two decoupled steps [12, 13, 1171]:

### A. Text Detection Stage
Rosetta first localizes rectangular bounding boxes likely to contain multi-character text [13, 1150]. To fit within real-time latency budgets, the pipeline utilizes a **Faster R-CNN model** where the conventional, compute-heavy ResNet convolutional body is replaced with an optimized, lightweight **ShuffleNet-based architecture** (which is up to 4.5x faster than ResNet-50) [12, 13, 1172]. The Region Proposal Network (RPN) anchor ratios and sizes are specifically modified to generate wider bounding boxes, optimized for horizontal text segments rather than square objects [13, 1152].

### B. Text Recognition Stage
Once visual word regions are localized and cropped, they are passed to a **ResNet-18 convolutional neural network (CNN)** [13, 1153]. Rosetta casts character extraction as a sequence prediction problem [13, 1153]. The network models the cropped pixels and transcribes them using **Connectionist Temporal Classification (CTC) loss**, allowing the system to recognize out-of-vocabulary terms and words of arbitrary length [13, 1153]. Post-processing character-reversal techniques are applied to seamlessly handle both left-to-right and right-to-left language structures in a unified model [13, 1155].

---

## 4. Copywriting Strategy: Complementary Signal Reinforcement

The multi-modal fusion architecture has profound implications for ad copywriting. Because Andromeda projects all copy surfaces into a single, joint embedding space and evaluates them via cross-feature attention, advertisers must abandon historical copywriting templates [10, 1187, 1198].

### The Limits of Pure Replication and Total Divergence
*   **Pure Replication (Duplicate Copy)**: Reusing the exact same hook across the image, headline, and primary text fields creates **severe semantic redundancy** [10, 1194]. This "fake diversity" does not expand the ad's representation [1194]. Instead, Andromeda’s entity clustering mechanism groups the visually and textually identical creatives under a single backend **Entity ID**, allocating only a single "auction ticket" and triggering retrieval suppression [3, 20, 1193, 1194].
*   **Total Divergence (Disconnected Copy)**: Using completely unrelated messages across fields (e.g., an on-image hook about "spinal alignment," a written headline about "free shipping," and primary text about "eco-friendly manufacturing") introduces **semantic noise** [10, 1194]. Because the dual-encoders cannot map these discordant vectors to a stable, high-confidence cluster, the ad fails to align with any specific "latent interest primitives" in the HIR super-graph [10, 1194].
*   **The Optimal Strategy: Complementary Reinforcement**: The fields must carry **distinct, complementary signals that align with a unified semantic concept** [10, 1194, 1198]. The different text surfaces should reinforce the same conceptual angle from different cognitive angles, providing a cohesive and robust set of features for the dual-encoders and the hierarchical graph [10, 1194].

---

## 5. Scenario Analysis: Image-Baked Headlines vs. Written Copy

Consider a common production scenario: an ad featuring a headline baked directly into the visual image (read by Rosetta OCR), alongside a separate written headline and a primary-text field. 

To maximize retrieval and prevent Entity ID collapsing under Andromeda, the three copy surfaces must be structurally coordinated [3, 10, 20]:

```
┌────────────────────────────────────────────────────────┐
│                   [ Ad Ingestion ]                     │
├───────────────────────┬────────────────────────────────┤
│ Copy Surface          │ Architectural Role             │
├───────────────────────┼────────────────────────────────┤
│ 1. Baked-in Text      │ Attention Grabber (Hook)       │
│ 2. Written Headline   │ Structural Proof (Mechanism)   │
│ 3. Primary Text       │ Contextual Depth (Persona/Pain)│
└───────────────────────┴────────────────────────────────┘
```

### The Architectural Blueprint for Coordination
1.  **Visual Baked-in Text (Rosetta Input)**: Must act as the primary, high-impact attention hook [13, 1198]. It establishes the visual and semantic context that primes self-attention layers [26, 1196].
2.  **Written Headline Field**: Must **never duplicate** the baked-in visual text [10, 1194]. Instead, it should act as the "structural proof" or "mechanism" that validates the baked-in hook, shifting the semantic vector toward a more concrete category [10, 1194, 1198].
3.  **Primary Text Field**: Must provide "contextual depth" by expanding on the specific target persona or pain point, utilizing sequence-initial token priming to route the ad toward the appropriate behavioral branch of the hierarchical tree [10, 26, 1196].

### Concrete Execution Example:
*   ❌ **The Restricted (Duplicate) Approach**:
    *   *Visual Baked-in Headline*: "Wake Up Without Back Pain!"
    *   *Written Headline*: "Wake Up Without Back Pain!"
    *   *Primary Text*: "Wake up without back pain today! Buy our mattress..."
    *   *Result*: Triggered retrieval suppression. Highly redundant token embeddings collapse into a single Entity ID [3, 20].
*   ✅ **The Optimized (Complementary) Approach**:
    *   *Visual Baked-in Headline*: "Wake Up Without Back Pain!" (Rosetta maps the attention-grabbing hook) [13].
    *   *Written Headline*: "Orthopedic Doctor-Approved" (Written headline introduces the authority mechanism, validating the baked-in hook) [10, 1198].
    *   *Primary Text*: "Why correct spinal alignment is the secret to deep, restorative sleep. If you toss and turn all night..." (Primary text primes sequence-initial self-attention blocks with clinical and problem-aware tokens) [10, 26, 1196].
    *   *Result*: High-confidence semantic alignment across standard copy fields and Rosetta OCR transcriptions [10, 1198]. The ad is successfully mapped to stable, high-value latent interest primitives while maintaining unique visual and linguistic properties to avoid Entity ID collapsing [3, 10, 20].

---

## 6. The Copy Generator Rule: Three-Tier Multi-Modal Framework

To automate the generation of copy across all text surfaces while strictly adhering to Andromeda's multimodal fusion constraints, copy generators must implement the following **Three-Tier Multi-Modal Framework**:

### Tier 1: Rosetta Visual Hook (The "Attention Anchor")
*   **Character Limit**: Bounded by visual layout safe zones (approx. 30–50 characters) to prevent visual overlap with platform UI [705].
*   **Semantic Objective**: High-salience emotional hook (Pain Agitation, Desire, Identity, or Aspirational Outlier) [179].
*   **Structural Constraint**: Limit to a maximum of 10 words. Must contain at least two high-frequency semantic category tokens (e.g., "Sleep," "Back Pain," "Focus") to serve as a topological anchor for the hierarchical index [10].

### Tier 2: Written Headline (The "Verification Mechanism")
*   **Character Limit**: Max 40 characters (ideally 27 characters to prevent mobile Feed and Reels truncation) [183, 620].
*   **Semantic Objective**: Structural verification of the Tier 1 visual hook (Authority Proof, Social Proof, Risk Reversal, or Core Benefit) [179].
*   **Structural Constraint**: **Must exhibit a cosine similarity below 0.40** against Tier 1 text when processed via a local sentence-transformer validation gate. It must contain zero duplicate tokens from Tier 1, utilizing complementary vocabulary instead.

### Tier 3: Primary Text (The "Context Cascade")
*   **Character Limit**: Recommended 125 characters (up to 2,200 characters max, but essential hooks must precede mobile truncation) [183, 627, 638].
*   **Semantic Objective**: Contextual depth mapping to sequential user behavior (Persona Framing, Deep Problem Agitation, or Sequential Storytelling) [179, 1112].
*   **Structural Constraint**: The first 10 tokens (opening tokens) must be reserved for **Topological Priming** [26, 1196]. This sequence must contain highly distinct keywords associated with the targeted user cohort's recent search sequences (e.g., "If you toss and turn...") to heavily bias the self-attention weights and ensure precise routing down the retrieval tree [10, 26, 1196].

---

## References

1. Touvron et al., *Llama 2: Open Foundation and Fine-Tuned Chat Models*, arXiv 2023. [cite: 44]
2. Meta Engineering, *Meta Andromeda: Supercharging Advantage+ Automation*, Dec 2024. [cite: 4]
3. Borisyuk et al., *Rosetta: Large Scale System for Text Detection and Recognition in Images*, KDD 2018. [cite: 12]
4. Meta Engineering, *Exploring Hierarchical Interest Representation for Ads Deep Funnel Optimization*, Jul 2026. [cite: 10]
5. Meta Engineering, *From User Sequences to Scaling Laws: A Multi-Stage Ads Ranking Architecture*, Aug 2026. [cite: 6]
6. Webtopia, *Entity IDs, Andromeda and the New Era of Creative Led Targeting*, 2026. [cite: 18]
7. TheOptimizer, *How to Test Ad Creatives After Meta's Andromeda Update*, 2026. [cite: 25]
8. Meta Engineering, *Horizon-Length Prediction: Lookahead Planning for Code Generation*, OpenReview 2026. [cite: 26]
9. OpenReview, *Less Diverse, Less Safe: The Indirect but Pervasive Risk of Test-Time Scaling*, 2026. [cite: 27]
