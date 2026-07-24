### Technical Report: Meta’s AI Ad Delivery and Audience Selection Architecture (2024–2026)

##### 1\. Executive Summary of the AI Ecosystem Shift

Between late 2024 and mid-2026, Meta fundamentally overhauled its advertising delivery architecture, transitioning from legacy rule-based, siloed models to a unified, integrated AI stack. This architectural evolution represents a shift from reactive manual targeting to predictive,  **LLM-scale retrieval and ranking** . The current ecosystem is anchored by five interlocking systems:  **Andromeda** ,  **GEM** ,  **Lattice** ,  **UTIS** , and the  **Adaptive Ranking Model** .In this paradigm, audience selection has moved from a user-defined constraint to an AI-driven outcome. By deploying a teacher-student hierarchy, the system distils representations from massive foundational models into specialised downstream engines. Consequently, targeting is now effectively "inverted," where the visual and semantic signals of the creative asset itself—rather than advertiser-defined interests—dictate the audience retrieval and auction distribution.

##### 2\. The Retrieval Stage: Andromeda Architecture

Andromeda serves as Meta’s personalised ads retrieval engine, functioning as the primary gateway in the delivery pipeline. Its role is to filter the universe of tens of millions of potential ads into a candidate shortlist of 1,000–1,500 for the ranking stage. Following its global rollout completion in October 2025, Andromeda achieved a  **\+6% recall improvement**  and a  **\+8% increase in ad quality** .**Technical Capabilities and Hardware Foundation:**

1. **Hardware Infrastructure:**  Andromeda is built on a custom hardware-software co-design utilising  **NVIDIA Grace Hopper Superchips**  and  **Meta’s Training and Inference Accelerator (MTIA)**  silicon. This shifted the infrastructure from CPU-heavy loads to massive parallel GPU computing.  
2. **Model Complexity:**  The engine represents a  **10,000x increase in model complexity**  compared to legacy systems. In January 2026, Meta further optimised the stack, tripling Andromeda's compute efficiency to handle higher request densities.  
3. **Content-Aware Retrieval:**  Utilising computer vision and semantic analysis, Andromeda "reads" creative assets (visuals, audio, and transcript data) to extract latent signals. It achieved a 100x improvement in feature-extraction throughput compared to previous CPU-based components.  
4. **Hierarchical Indexing:**  To manage the explosion of generative-AI-built creatives, Andromeda employs a hierarchical index. This allows the system to scale to millions of new creatives without degrading sub-second latency.

##### 3\. The Ranking and Teaching Layer: GEM and Lattice

Meta’s ranking intelligence is organised into a  **Teacher-Student hierarchy** . The Generative Ads Recommendation Model (GEM) acts as the foundational teacher, while Lattice serves as the unified student model that executes ranking across all surfaces.| Component | Role | Training Foundation | Technical Function || \------ | \------ | \------ | \------ || **GEM (Teacher)** | Foundational Recommendation | Thousands of GPUs; LLM-scale architecture | Uses cross-layer attention and stackable factorisation machines to predict interactions across all Meta surfaces. || **Lattice (Student)** | Unified Ranking System | Consolidated vertical models; Multi-domain | Replaced hundreds of siloed models. Inherits representations from GEM via knowledge distillation to maintain low inference cost. |  
**Knowledge Distillation and Lattice Sub-Architectures**  Architecturally, GEM is too computationally expensive to serve billions of impressions directly. Instead, it transfers its high-level intelligence to Lattice through  **knowledge distillation** , ensuring students maintain low latency while inheriting "representation" intelligence. Lattice integrates several critical sub-components:

* **Lattice Zipper:**  A specialised layer that balances data freshness with long-term attribution signals.  
* **Lattice Filter:**  Selects the most relevant features across different domains (e.g., Feed vs. Reels) to optimise ranking.  
* **Sequence Learning:**  Models the chronology of user actions. It understands, for instance, that a user who recently purchased a mobile phone is a high-probability candidate for a headphones ad, even without manual funnel mapping.As of early 2026, Lattice has delivered a  **12% lift in ad quality**  and a  **6% conversion rate increase**  across landing-page-view objectives.

##### 4\. Calibration and Infrastructure: UTIS and Adaptive Ranking

To ensure system precision and efficient scaling of trillion-parameter models, Meta maintains a rigorous calibration and infrastructure layer.**UTIS (User True Interest Survey)**  Meta’s internal research indicated that legacy interest heuristics reached only  **48.3% precision**  in identifying true user intent. UTIS serves as a calibrator by utilising real-time, in-feed surveys (1–5 scale) to train a "Perception Layer." This model outputs a probability of genuine user satisfaction. UTIS specifically calibrates the  **Late Stage Ranking (LSR)**  and feeds back into early-stage retrieval via distillation, ensuring delivery is prioritised by true interest rather than impulsive engagement.**Adaptive Ranking Model**  This infrastructure layer enables the serving of trillion-parameter models under 100ms latency. Key specifications include:

* **Platform Specificity:**  As of Q4 2025, this system is  **Instagram-only** , with a phased expansion to Facebook expected throughout 2026\.  
* **Efficiency:**  Achieved a 35%  **Model FLOPs Utilisation (MFU)**  rate across hardware types.  
* **Technical Optimisation:**  Employs  **Selective FP8 Quantisation**  for lower-precision mathematics and  **Multi-card GPU Sharding**  to distribute massive parameter counts.  
* **Request-Centric Architecture:**  Computes high-density user signals once per page load rather than separately for every user-ad pair, drastically reducing redundant computation.

##### 5\. Technical Signal Hierarchy and Inputs

The 2026 delivery stack relies on a structured hierarchy of inputs to predict value:

* **Creative Assets and Entity IDs:**  Andromeda clusters visually similar ads under a single  **Entity ID** . Minor adjustments—such as  **font swaps, colour shifts, or aspect ratio variations** —do not trigger a new Entity ID. Conversely,  **Partnership ads**  and assets with distinct  **Persona-Desire-Awareness (PDA)**  angles are assigned unique IDs, granting them separate retrieval tickets.  
* **AI Chat Data:**  Integrated on  **December 16, 2025** , the system now utilises Meta AI chat interactions (text and voice) from Messenger, WhatsApp, and Ray-Ban smart glasses as a targeting signal.  **Regional exemptions apply**  to the UK, EU, and South Korea, where this data is not used for ad personalisation.  
* **Performance Metrics:**  The system calculates an  **Estimated Action Rate (EAR)**  based on historical click-to-conversion data. Signal quality is maintained via the  **Meta Pixel**  and  **Conversions API (CAPI)** , aiming for an  **Event Match Quality (EMQ)**  score of 7.0+.

##### 6\. The "Targeting Inversion": Hard Controls vs. Soft Suggestions

Under the current architecture, advertiser-defined parameters have been demoted to suggestions, allowing the AI to override manual constraints in pursuit of better performance.| Hard Controls (Strictly Enforced) | Soft Suggestions (AI Expandable) || \------ | \------ || **Exclusions**  (e.g. Purchaser lists) | Detailed Interests and Behaviours || Geographic Location | Age (Maximum/Specific ranges) || Languages | Gender || Minimum Age (Legal/Compliance) | Custom and Lookalike Audiences || Special Ad Categories | Lookalike Audience Seed Lists |  
Exclusions remain the most potent hard control for protecting margin. Conversely,  **Advantage+ Audiences**  now treat detailed targeting as a mere starting point; if the retrieval engine predicts a higher conversion probability outside these bounds, it will bypass them.

##### 7\. Destination Page Content and The Link Hierarchy

Selection intelligence extends to the landing page via the  **Facebookexternalhit**  robot. This web crawler is critical for calculating the "Ad Quality" component of the auction.

* **The 1MB Rule:**  The robot reads the first  **1MB of data**  on a webpage to identify Open Graph (OG) tags.  
* **Essential OG Tags:**  The system prioritises og:title, og:description, and og:image (optimised at 1200 x 630 pixels) to generate link previews and inform the AI’s semantic understanding of the destination.  
* **Auction Impact:**  Poor landing page experiences or mismatched OG signals lower the Ad Quality score, requiring higher bids to remain competitive in the Total Value equation.

##### 8\. Strategic Technical Conclusion

By 2026, the Meta delivery system rewards  **broad account structures**  and creative diversity over manual "audience hacking." Performance is governed by the universal  **Auction Equation** :**Total Value \= (Advertiser Bid × Estimated Action Rate) \+ Ad Quality**To maximise Total Value, architects must focus on creative diversity—ensuring distinct Entity IDs through varied PDA angles—and maintaining high-fidelity signal data via server-side CAPI. The architecture rewards advertisers who provide stable, consolidated budgets and a consistent pipeline of conceptually distinct creatives, allowing the AI's predictive retrieval and ranking layers to operate at peak efficiency. Strategic success in 2026 is no longer about finding the audience, but rather about feeding the system the variety required for the AI to match the ad to the user in real time.  
