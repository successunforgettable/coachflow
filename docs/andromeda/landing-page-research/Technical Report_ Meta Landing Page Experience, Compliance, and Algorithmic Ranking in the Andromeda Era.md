### Technical Report: Meta Landing Page Experience, Compliance, and Algorithmic Ranking in the Andromeda Era

#### 1\. Infrastructure Context: The Five-System AI Stack

By 2026, the Meta advertising environment has transitioned into a unified, interlocking AI stack that governs ad delivery with a compute scale equivalent to frontier large language models i. The "algorithm" is no longer a monolithic entity but a hierarchy of five distinct systems that process trillions of parameters to match individual ads to specific users in real time i. These systems utilise "Sequence Learning" to model the chronology of user actions both before and after the click, enabling the system to predict purchase journeys rather than just reacting to isolated signals i.| System | Primary Function | Impact on Landing Page Perception || \------ | \------ | \------ || **GEM**  (Generative Ads Recommendation Model) | The LLM-scale "Teacher Model" that generates predictions and transfers learning to students via knowledge distillation i. | Predicts post-click conversion probability by analysing deep semantic content between ad and destination i. || **Andromeda**  (Retrieval Engine) | A deep neural network on NVIDIA Grace Hopper chips that narrows millions of ads to \~1,500 candidates i. | Conducts a 10,000x more complex analysis of the landing page via the Facebookexternalhit crawler to determine retrieval eligibility i. || **Lattice**  (Unified Ranking) | A unified architecture that replaced siloed models to generalise learning across all surfaces and objectives i. | Incorporates post-click engagement signals (Sequence Learning) to refine ranking for subsequent users i. || **UTIS**  (Interest Calibration) | A survey-based feedback model that calibrates ranking based on genuine user interest match i. | Demotes destination URLs that drive high clicks but fail "true interest" tests, resulting in ranking suppression i. || **Adaptive Ranking Model** | The runtime infrastructure layer enabling trillion-parameter models at sub-100ms latency i. | Allows the system to "think" at an LLM level when evaluating the structural and content quality of the destination i. |

#### 2\. Official Meta Compliance: Policies and Quality Standards

Meta’s delivery system prioritises "Total Value," a metric designed to balance advertiser goals with the integrity of the user experience i. This is expressed through the  **Auction Equation** :**Total Value \= (Advertiser Bid × Estimated Action Rate) \+ Ad Quality**  i.Ad Quality is a multifaceted signal derived from real-time engagement and historical post-click behaviour i. The system assigns a lower Total Value—and thus higher costs—to ads associated with poor landing page experiences i.**Official Quality Signals:**

1. **Positive Engagement:**  Real-time interactions such as likes, shares, and meaningful comments i.  
2. **Negative Feedback:**  Frequency of users hiding ads or selecting "Already Purchased" or "Irrelevant" i.  
3. **Destination Relevance:**  The degree of semantic alignment between the ad creative and the landing page content i.  
4. **Landing Page Experience:**  Technical performance, mobile-friendliness, and adherence to disruptive content policies i.**Warning: Disruptive Page Policies**  Meta enforces algorithmic friction against destination URLs that degrade system integrity. i Penalties or rejections apply to pages featuring:  
* **Pop-ups and Interstitials:**  Any obstruction that prevents the user from accessing the primary content immediately after the click i.  
* **Forced Downloads:**  Initiating automatic file downloads or software installations without explicit user intent i.  
* **Misleading Claims:**  Significant disconnects between the creative "hook" and the actual offer found on the landing page i.  
* **Low-Quality Content:**  Pages with broken elements, placeholder text, or excessive ad-to-content ratios i.

#### 3\. Performance Diagnostics: The Three Ranking Signals

Advertisers can monitor how the Andromeda-Lattice stack perceives their landing page through three diagnostic rankings in Ads Manager i. These metrics compare performance against other advertisers competing for the same audience i.

##### Quality Ranking

This ranking assesses the perceived quality of the ad and its destination i. It factors in negative feedback and "Ad Quality Taxes" applied for poor post-click experiences i.

* **To Improve:**  Ensure the landing page contains high-quality assets and matches the visual and textual "promise" of the ad i.

##### Engagement Rate Ranking

This measures the probability that a user will click or engage with the ad i. While primarily creative-led, it is demoted if the system predicts a "false engagement" pattern where users click but find no relevance i.

* **To Improve:**  Align the ad hook with the specific value proposition featured in the first 1MB of the landing page code i.

##### Conversion Rate Ranking

This reflects the expected conversion rate relative to the chosen objective i. It is heavily influenced by the speed and technical performance of the landing page i.

* **To Improve:**  Optimise the destination URL for mobile page speed and ensure the Conversion API (CAPI) provides a clean feedback loop i.

#### 4\. Practitioner Inferences: The "Ad Quality Tax"

Performance architects observe that Meta applies an "Ad Quality Tax"—often referred to in the industry as a friction penalty—to accounts that drive low-quality traffic i. While Meta does not explicitly name this a "tax" in the interface, it functions as a governance mechanism within the Lattice architecture to protect user retention i.**The Latent Feedback Penalty:**  A systematic demotion of content where UTIS (User True Interest Survey) data reveals a mismatch between the engagement signal and actual user satisfaction. i If a user clicks an ad but immediately returns to the platform (a "bounce" in traditional terms), Sequence Learning flags the journey as low-quality, inflating CPMs to discourage the advertiser from continuing the delivery i.| Official Meta Statement | Practitioner/System Inference || \------ | \------ || Ad Quality affects the auction Total Value i. | Low-quality landing pages act as a "tax," driving up CPMs to protect the platform's ecosystem i. || Positive destination experience is recommended i. | Post-click engagement (time on page, scrolls) is a primary ranking signal for the Lattice model i. || Creative is a signal for ad retrieval i. | The algorithm uses computer vision to ensure the landing page "looks" like the ad that triggered the click i. |

#### 5\. Technical Signal Quality: Pixel, CAPI, and EMQ

To accurately value a landing page, the AI stack requires high-fidelity data that survives the restrictions of browser-side tracking (e.g., iOS 14.5+, ad blockers) i. Relying on the Meta Pixel alone results in a 30% loss of signal, which blinds the Andromeda retrieval engine i.The  **Conversions API (CAPI)**  is essential infrastructure that sends event data directly from the server to Meta i. Proper CAPI implementation typically results in 8–19% more attributed conversions and a 12% lower CPA i.**Event Match Quality (EMQ)**  is a 1–10 grading of data density i. A target EMQ of 7.0+ is the baseline for effective landing page optimisation in the Andromeda era i.**CAPI Payload Identifiers (Crucial Technical Requirements):**

* **fbc (Click ID):**  Must be passed without hashing; hashing breaks matching i.  
* **fbp (Browser Cookie):**  Must be passed without hashing; required for session identification i.  
* **Hashed Identifiers:**  Email, Phone Number, First/Last Name (must be SHA-256 hashed) i.  
* **Contextual Signals:**  IP Address and User Agent (unhashed) i.

#### 6\. Operational Strategy: Creative-Landing Page Alignment

Under the Andromeda framework, "creative is the targeting" i. The system reads the content of the ad and the destination URL to predict audience resonance i. This creates a critical dependency on the crawler's ability to "see" the page i.

##### The Crawler and Open Graph Logic

The Facebookexternalhit robot is responsible for parsing the landing page i. It prioritises Open Graph (og) tags located within the first 1MB of the page’s data i. If og:title, og:description, or og:image tags are missing or blocked by a firewall, Andromeda’s semantic analysis fails, resulting in a default quality penalty and retrieval suppression i.

##### The Entity ID Constraint

Andromeda clusters similar ads under a single  **Entity ID**  i. Launching 20 variations of a single landing page or ad graphic often fails to expand reach because the system assigns them the same retrieval "ticket" i. To break this constraint, architects use  **Partnership Ads** , which run the same destination through a different creator’s page, generating a completely new Entity ID and a fresh delivery trajectory i.

##### The PDA Framework

To feed diverse signals into the AI stack, practitioners use the  **Persona-Desire-Awareness (PDA)**  framework i:

* **Persona:**  Identifying specific demographics and their unique problem-states i.  
* **Desire:**  Aligning the landing page hook with a specific aspiration or pain point i.  
* **Awareness:**  Matching the landing page complexity to the user's stage (e.g., Unaware vs. Solution-Aware) i.

#### 7\. Conclusion: The Future of Destination Optimisation

Success in 2026 is defined by "signal feeding" rather than "system hacking" i. The Andromeda and Lattice systems have rendered manual audience segmentation obsolete, moving the competitive advantage to creative strategy and signal hygiene i. Advertisers who align their landing pages with the AI's retrieval logic will benefit from reduced "Ad Quality Taxes" and superior auction positioning i.**Strategic Summary:**

1. **Creative and Format Diversity:**  Deploy 8–12 conceptually distinct concepts per campaign to maintain unique Entity IDs and prevent retrieval suppression i.  
2. **Signal Hygiene (CAPI):**  Maintain an EMQ of 7.0+ and ensure fbc/fbp identifiers are passed unhashed to provide a clean feedback loop for Lattice i.  
3. **Crawler Optimisation:**  Ensure all Open Graph tags are present within the first 1MB of the destination URL to facilitate Andromeda's semantic classification i.  
4. **Simple Account Structure:**  Utilise Advantage+ and broad targeting to allow the Adaptive Ranking Model the necessary space to identify high-value segments i.  
5. **Budget Stability:**  Avoid major edits that reset the learning phase, which requires approximately 50 conversion events per week to achieve stable optimisation i.

