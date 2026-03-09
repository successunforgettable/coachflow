import React from "react";

export function Privacy() {
  return (
    <div
      style={{
        backgroundColor: "#F5F1EA",
        minHeight: "100vh",
        fontFamily: "'Instrument Sans', sans-serif",
        color: "#1A1624",
      }}
    >
      {/* Back link */}
      <div style={{ padding: "24px 32px" }}>
        <a
          href="https://zapcampaigns.com"
          style={{
            color: "#1A1624",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 500,
            opacity: 0.65,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
        >
          ← zapcampaigns.com
        </a>
      </div>

      {/* Main content */}
      <main
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "0 32px 96px",
        }}
      >
        {/* Page title */}
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: "clamp(40px, 6vw, 64px)",
            lineHeight: 1.1,
            color: "#1A1624",
            margin: "0 0 10px",
          }}
        >
          Privacy Policy
        </h1>

        <p
          style={{
            fontSize: "13px",
            opacity: 0.45,
            marginBottom: "60px",
            marginTop: 0,
            letterSpacing: "0.02em",
          }}
        >
          Last updated: March 2026
        </p>

        <PolicySection number="1" title="Introduction">
          <p>
            ZAP Campaigns is a marketing asset generation platform operated by{" "}
            <strong>Incredible You Consultants</strong>. This policy explains
            how we collect, use, and protect your data when you use our
            platform.
          </p>
        </PolicySection>

        <PolicySection number="2" title="What data we collect">
          <ul>
            <li>Email address and name at signup.</li>
            <li>
              Meta Ad Account ID and campaign data when you connect your Meta
              account.
            </li>
            <li>
              Payment information processed by Stripe — we do not store card
              details.
            </li>
            <li>
              Campaign inputs and generated assets you create within the
              platform.
            </li>
          </ul>
        </PolicySection>

        <PolicySection number="3" title="How we use your data">
          <ul>
            <li>To operate your ZAP Campaigns account.</li>
            <li>
              To generate marketing assets using the Anthropic AI API on your
              behalf.
            </li>
            <li>
              To push campaign assets to your Meta Ad account with your explicit
              authorisation.
            </li>
            <li>To process subscription payments via Stripe.</li>
            <li>To send transactional emails related to your account.</li>
          </ul>
        </PolicySection>

        <PolicySection number="4" title="Data sharing">
          <p>
            We share data with the following third-party services solely to
            operate the platform:
          </p>
          <ul>
            <li>
              <strong>Anthropic API</strong> — for AI-powered asset generation.
            </li>
            <li>
              <strong>Stripe</strong> — for payment processing.
            </li>
            <li>
              <strong>Meta Marketing API</strong> — for ad account integration,
              with your explicit permission.
            </li>
          </ul>
          <p>
            We do not sell your data to any third party under any circumstances.
          </p>
        </PolicySection>

        <PolicySection number="5" title="Meta Ad Account data">
          <ul>
            <li>
              We access your Meta ad account only with your explicit OAuth
              authorisation.
            </li>
            <li>
              We use this access solely to push campaign assets you have
              approved within ZAP Campaigns.
            </li>
            <li>
              We do not store your Meta access tokens beyond your active
              session.
            </li>
            <li>
              You can revoke ZAP Campaigns access to your Meta account at any
              time from your{" "}
              <a
                href="https://business.facebook.com/settings"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#1A1624", fontWeight: 600 }}
              >
                Meta Business Settings
              </a>
              .
            </li>
          </ul>
        </PolicySection>

        <PolicySection number="6" title="Data retention">
          <ul>
            <li>Your account data is retained while your account is active.</li>
            <li>
              If you delete your account, all personal data is permanently
              deleted within 30 days.
            </li>
            <li>Generated campaign assets are deleted on request.</li>
          </ul>
        </PolicySection>

        <PolicySection number="7" title="Your rights">
          <ul>
            <li>You have the right to access all data we hold about you.</li>
            <li>
              You have the right to export your campaign data at any time.
            </li>
            <li>
              You have the right to request deletion of your account and all
              associated data.
            </li>
          </ul>
          <p>
            To exercise any of these rights, contact{" "}
            <a
              href="mailto:support@zapcampaigns.com"
              style={{ color: "#1A1624", fontWeight: 600 }}
            >
              support@zapcampaigns.com
            </a>
            .
          </p>
        </PolicySection>

        <PolicySection number="8" title="Cookies">
          <p>
            We use essential cookies only for session management and
            authentication. We do not use advertising or tracking cookies.
          </p>
        </PolicySection>

        <PolicySection number="9" title="Contact">
          <p>
            For privacy enquiries, contact{" "}
            <a
              href="mailto:privacy@zapcampaigns.com"
              style={{ color: "#1A1624", fontWeight: 600 }}
            >
              privacy@zapcampaigns.com
            </a>
            .
          </p>
          <p>
            ZAP Campaigns is operated by{" "}
            <strong>Incredible You Consultants</strong>.
          </p>
        </PolicySection>

        {/* Divider + last updated */}
        <div
          style={{
            borderTop: "1px solid rgba(26,22,36,0.12)",
            paddingTop: "32px",
            marginTop: "8px",
          }}
        >
          <p style={{ fontSize: "13px", opacity: 0.4, margin: 0 }}>
            Last updated: March 2026
          </p>
        </div>
      </main>
    </div>
  );
}

// ── Reusable section component ────────────────────────────────────────────────
function PolicySection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "52px" }}>
      <h2
        style={{
          fontFamily: "'Fraunces', serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: "22px",
          color: "#1A1624",
          marginBottom: "18px",
          marginTop: 0,
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontStyle: "normal",
            fontWeight: 600,
            fontFamily: "'Instrument Sans', sans-serif",
            backgroundColor: "rgba(26,22,36,0.08)",
            borderRadius: "4px",
            padding: "3px 8px",
            letterSpacing: "0.06em",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {number.padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div
        style={{
          fontSize: "16px",
          lineHeight: 1.8,
          color: "rgba(26,22,36,0.78)",
        }}
        className="privacy-body"
      >
        {children}
      </div>
    </section>
  );
}
