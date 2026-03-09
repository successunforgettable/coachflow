import React from "react";

export function GettingStarted() {
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
          Getting Started with ZAP Campaigns
        </h1>

        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "rgba(26,22,36,0.65)",
            marginBottom: "60px",
            marginTop: "16px",
            maxWidth: "580px",
          }}
        >
          Follow these five steps to go from sign-up to a fully built campaign
          ready to push live — in one session.
        </p>

        <Step
          number="1"
          title="Create your free account"
        >
          <p>
            Go to{" "}
            <a
              href="https://zapcampaigns.com"
              style={{ color: "#1A1624", fontWeight: 600 }}
            >
              zapcampaigns.com
            </a>{" "}
            and click <strong>Start Free</strong>. Enter your name and email to
            create your account. No credit card required.
          </p>
        </Step>

        <Step
          number="2"
          title="Enter your service details"
        >
          <p>
            On the landing page, answer three quick questions about who you
            help, what result you give them, and what they're struggling with.
            Zappy — your AI campaign assistant — will use this to build your
            entire campaign.
          </p>
        </Step>

        <Step
          number="3"
          title="Follow the 11-step campaign path"
        >
          <p>
            Your dashboard shows the full campaign path. Work through each node
            in order. Zappy generates every asset for you — just review, edit if
            needed, and move to the next step.
          </p>
        </Step>

        <Step
          number="4"
          title="Connect your GoHighLevel account"
        >
          <p>
            When you reach Node 11, click{" "}
            <strong>Connect GoHighLevel</strong> and authorise ZAP to access
            your GHL account. This is a one-time setup.
          </p>
        </Step>

        <Step
          number="5"
          title="Push your campaign live"
        >
          <p>
            Click <strong>Generate Now</strong> and ZAP pushes all your
            completed campaign assets directly into your GoHighLevel account in
            one click. Your ads, landing page copy, email sequence, and
            WhatsApp follow-up will all be ready to activate.
          </p>
        </Step>

        {/* Help section */}
        <div
          style={{
            borderTop: "1px solid rgba(26,22,36,0.12)",
            paddingTop: "40px",
            marginTop: "8px",
          }}
        >
          <p
            style={{
              fontSize: "15px",
              color: "rgba(26,22,36,0.65)",
              margin: 0,
              lineHeight: 1.7,
            }}
          >
            Need help? Email us at{" "}
            <a
              href="mailto:support@zapcampaigns.com"
              style={{ color: "#1A1624", fontWeight: 600 }}
            >
              support@zapcampaigns.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

// ── Step component ────────────────────────────────────────────────────────────
function Step({
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
      >
        {children}
      </div>
    </section>
  );
}
