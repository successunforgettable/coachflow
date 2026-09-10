# Performance research — what a video ad's numbers actually predict (banked 2026-09-10)

**Eight NotebookLM reports** on Meta video-ad measurement, retention mechanics, hook economics,
script structure, webinar funnel economics, and pre-spend assessment — plus **an evidence audit that
tiers the other seven**. Copied verbatim from `~/Downloads` (Downloads-only and therefore at risk),
**SHA-256 verified byte-identical to source after copying**. Plain git, matching `../script-research/`
and `../prospecting-research/`.

**Do NOT execute anything from these — reference material.**

---

## 🔴 READ THIS BEFORE QUOTING ANYTHING FROM THIS SET

**This set CONTRADICTS the existing ZAP script corpus on beat structure**, and the conflict is
recorded — unresolved — at **`../script-rule-spec.md` §4.5**. Do not quote either side as settled.

**And this set tiers its own evidence.** `evidence_and_data_gaps_audit_report.md` sorts every
conclusion in the other seven into Tier 1 / Tier 2 / Tier 3 / No-Data. **Carry the tier whenever you
carry the number.** A Tier 2 finding here is not the same kind of claim as a Tier 1 one, and the
audit says so itself.

| tier | what it means, in the audit's own terms |
|---|---|
| **Tier 1** | large-sample quantitative audits, peer-reviewed experiments, or official Meta infrastructure documentation |
| **Tier 2** | *"strong qualitative and directional support… but methodological constraints, such as undisclosed baseline controls or genre-dependent variance"* |
| **Tier 3** | *"operational heuristics or qualitative frameworks that lack rigorous, controlled empirical backtesting"* |
| **No Data** | *"zero public data"* — §4 of the audit enumerates four such gaps |

---

## The eight reports

### The audit — read it first
1. **`evidence_and_data_gaps_audit_report.md`** — ⭐ **the index to the other seven.** Tiers every
   conclusion, and §4 enumerates the four areas where **no reliable public data exists at all**.
   Its closing Summary Matrix is the fastest way to see what any given number is worth.

### The measurement layer
2. **`meta_video_ads_metrics_report.md`** — metric definitions and 2025–26 benchmarks, post-Andromeda
   delivery architecture, and the engagement-versus-conversion correlation analysis.
3. **`video_ad_retention_curves_report.md`** — second-by-second drop-off across 30s / 45s / 60s, the
   0–3s hook cliff, the 8–15s dead zone, and the 1.5–2.5s micro-pacing reset rule. **Tier 2** — the
   audit notes absolute drop-offs *"vary heavily by visual genre, video length, and audience
   temperature."*
4. **`script_matrix_and_custom_metrics_guide.md`** — a 5-part pre-qualifying script matrix, and
   step-by-step Ads Manager custom-metric formulas (Hook-to-Hold, Pre-Qualification Efficiency,
   Terminal Conversion Yield).

### The findings that bear on how creative is judged
5. **`video_ad_opening_hooks_and_conversion_report.md`** — 🔑 the hook-rate disconnect.
   **Tier 1: R² ≈ 0.003** between Thumbstop Rate and downstream ROAS across **578,750 ads / $1.29B
   spend**. Pre-qualifying hooks deliberately *lower* hook rate and raise full-funnel yield.
6. **`script_structure_and_conversion_report.md`** — 🔴 **the source of the §4.5 conflict.** A
   **4-beat / 5-beat** macro structure with the **mechanism at beat 2 (seconds 3–12)**, and the
   front-loaded-versus-delayed comparison table. **Tier 2.**
7. **`webinar_attendance_predictors_report.md`** — 🔑 registration and attendance as **separate
   outcomes**, with show-up rate as the primary economic lever. **Tier 1** on the economics.
8. **`pre_spend_script_assessment_report.md`** — what can be audited before spend versus what only
   spend reveals, plus a 100-point pre-flight scorecard. **The scorecard is Tier 3** — the audit is
   explicit that its weights are *"heuristic models rather than statistically backtested
   algorithms"*, and that *"a script scoring 95/100 can still fail in live auction retrieval."*

---

## ⚠️ Three things to know before citing

**1. The beat timings disagree with themselves inside report 6.** Its ASCII timeline gives Beat 2 as
**3–15s**; its prose list gives **3–12s**; its comparison table header gives **Sec 3–12**. Two of
three say 3–12. Quote 3–12 and know the diagram says otherwise.

**2. The front-loading trade is a TRADE, and the report states both halves.** Front-loading the
mechanism *loses* engagement and *gains* conversion — 3s hook rate **−10 to −14 pp**, 15s hold rate
**−23 to −30 pp**, against outbound CTR **+105% to +130%** and landing-page CVR **+210% to +260%**.
Anyone quoting only the gains is quoting half the table.

**3. This set retires a number the older corpus leans on.** The audit's §4.1 records **zero public
data** on Andromeda Entity ID vector thresholds, which makes the **60% Creative Similarity Score**
figure in `../image-research/` unverifiable. `../image-rule-spec.md` §9 had already reached the same
conclusion independently — this is the second source, not a new one. See `../script-rule-spec.md`
§5.4.

---

## What these reports do NOT cover

**Nothing here decides the picture, and nothing here is about copy fields.** These are about *what a
video's numbers mean* and *how a script is sequenced*. Visual separation lives in
`../image-rule-spec.md`; the copy-surface architecture lives in `../copy-research/`; the spoken-
register standard lives in `../script-research/`.
