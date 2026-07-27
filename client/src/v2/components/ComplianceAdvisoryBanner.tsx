/**
 * ComplianceAdvisoryBanner — coach-facing compliance advisories in the Campaign Kit.
 *
 * WHY THIS IS VISIBLE TO THE COACH rather than a server-side log: if the advisory
 * fires, the cost has already landed on a real coach — a rejected ad, or an account
 * flagged. Waiting to measure how often it happens means learning the rate from broken
 * campaigns. So it surfaces at the campaign, with the remedies attached.
 *
 * NEVER GATES. Every advisory here rests on practitioner reports rather than Meta's
 * published policy (Tier 2 in docs/compliance/META_AD_COMPLIANCE_REFERENCE.md), and
 * Tier-2 evidence must not become a hard gate. It warns; the coach decides.
 *
 * HONEST ABOUT UNCERTAINTY. The copy says Meta MAY treat the ad this way. It never
 * states it as established fact, because it is not one — it is a pattern practitioners
 * report, which Meta's own documentation does not confirm.
 *
 * Self-hides when there is nothing to say. Warning tint, not error panic — matching
 * KitPlaceholderBanner, whose pattern this follows.
 */

export type Advisory = { classId: string; where: string; matched: string };

type Props = { advisories: Advisory[] };

/** Per-class coach-facing copy. Each names the trigger, the risk, and both remedies. */
const COPY: Record<string, { title: string; body: string; remedies: string[] }> = {
  special_ad_category_employment: {
    title: "This campaign uses career and employment language",
    body:
      "Meta may treat an ad that talks about jobs, hiring, promotions, salaries or CVs as a job advert. " +
      "If it does, the ad falls under Meta's Employment Special Ad Category, which limits how it can be " +
      "targeted — and an ad that should have been declared and wasn't can be rejected. This is a pattern " +
      "advertisers report rather than something Meta publishes, so it may not apply to your ad at all.",
    remedies: [
      "Declare the Employment Special Ad Category when you set the campaign up in Meta Ads Manager. Targeting is narrower, and the ad runs without this risk.",
      "Or reword so the offer is about the coaching itself — the method, what changes, what someone leaves with — rather than about jobs, hiring or salary.",
    ],
  },
};

export default function ComplianceAdvisoryBanner({ advisories }: Props) {
  const known = advisories.filter((a) => COPY[a.classId]);
  if (known.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Compliance advisory"
      style={{
        background: "rgba(255, 176, 32, 0.08)",
        border: "1px solid rgba(255, 176, 32, 0.32)",
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 18,
        fontFamily: "var(--v2-font-body, 'Instrument Sans', sans-serif)",
      }}
    >
      {known.map((a) => {
        const c = COPY[a.classId];
        return (
          <div key={a.classId} style={{ marginBottom: known.length > 1 ? 14 : 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#8A5A00", margin: "0 0 6px" }}>
              Worth checking before you run this — {c.title.toLowerCase()}
            </p>

            <p style={{ fontSize: 13, color: "#444", margin: "0 0 10px", lineHeight: 1.6 }}>{c.body}</p>

            <p style={{ fontSize: 12.5, color: "#555", margin: "0 0 6px", lineHeight: 1.5 }}>
              Triggered by <strong style={{ color: "#333" }}>&ldquo;{a.matched}&rdquo;</strong> in{" "}
              <strong style={{ color: "#333" }}>{a.where}</strong>.
            </p>

            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#444", margin: "10px 0 4px" }}>
              You have two options:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {c.remedies.map((r, i) => (
                <li key={i} style={{ fontSize: 12.5, color: "#555", lineHeight: 1.6, marginBottom: 4 }}>
                  {r}
                </li>
              ))}
            </ul>

            <p style={{ fontSize: 11.5, color: "#777", margin: "10px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
              This is a heads-up, not a block — your campaign is ready to run either way.
            </p>
          </div>
        );
      })}
    </div>
  );
}
