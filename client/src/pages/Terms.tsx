import React from "react";

export function Terms() {
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
          Terms of Service
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

        <TermsSection number="1" title="Acceptance of Terms">
          <p>
            By accessing or using ZAP Campaigns (the "Platform"), you agree to
            be bound by these Terms of Service. ZAP Campaigns is operated by{" "}
            <strong>Incredible You Consultants</strong> ("we", "us", or "our").
            If you do not agree to these Terms, you may not use the Platform.
          </p>
          <p>
            We reserve the right to update these Terms at any time. Continued
            use of the Platform after any changes constitutes your acceptance of
            the revised Terms. We will notify you of material changes via email
            or a notice within the Platform.
          </p>
        </TermsSection>

        <TermsSection number="2" title="Use of Platform">
          <p>
            ZAP Campaigns provides AI-powered marketing asset generation tools
            for business owners, coaches, and marketers. You agree to use the
            Platform only for lawful purposes and in accordance with these
            Terms.
          </p>
          <p>You must not:</p>
          <ul>
            <li>
              Use the Platform to generate content that is unlawful, harmful,
              defamatory, or misleading.
            </li>
            <li>
              Reverse-engineer, copy, or resell any part of the Platform or its
              AI-generated outputs as a competing service.
            </li>
            <li>
              Share your account credentials with third parties or allow
              unauthorised access to your account.
            </li>
            <li>
              Use automated scripts or bots to access the Platform in a way
              that places excessive load on our infrastructure.
            </li>
          </ul>
          <p>
            You are responsible for all content you input into the Platform and
            all assets generated on your behalf.
          </p>
        </TermsSection>

        <TermsSection number="3" title="Subscription and Billing">
          <p>
            ZAP Campaigns is offered on a subscription basis. By subscribing,
            you authorise us to charge your payment method on a recurring basis
            at the rate displayed at the time of purchase.
          </p>
          <ul>
            <li>
              Subscription fees are billed monthly or annually depending on the
              plan you select.
            </li>
            <li>
              All payments are processed securely by Stripe. We do not store
              your card details.
            </li>
            <li>
              Prices are displayed in USD and are subject to change with
              reasonable notice.
            </li>
            <li>
              Your subscription renews automatically unless cancelled before the
              renewal date.
            </li>
          </ul>
        </TermsSection>

        <TermsSection number="4" title="Cancellation and Refunds">
          <p>
            You may cancel your subscription at any time from your account
            settings. Cancellation takes effect at the end of your current
            billing period — you will retain access to the Platform until that
            date.
          </p>
          <p>
            We do not offer refunds for partial billing periods or unused
            subscription time, except where required by applicable law. If you
            believe you have been charged in error, contact{" "}
            <a
              href="mailto:support@zapcampaigns.com"
              style={{ color: "#1A1624", fontWeight: 600 }}
            >
              support@zapcampaigns.com
            </a>{" "}
            within 14 days of the charge.
          </p>
        </TermsSection>

        <TermsSection number="5" title="Intellectual Property">
          <p>
            All software, design, and infrastructure underlying the ZAP
            Campaigns Platform is owned by Incredible You Consultants and
            protected by applicable intellectual property laws.
          </p>
          <p>
            Marketing assets generated by the Platform using your inputs are
            owned by you. You grant us a limited, non-exclusive licence to
            process your inputs and store your generated assets solely for the
            purpose of operating the Platform on your behalf.
          </p>
          <p>
            You retain full ownership of any original content, brand assets, or
            business information you provide as inputs to the Platform.
          </p>
        </TermsSection>

        <TermsSection number="6" title="Limitation of Liability">
          <p>
            To the maximum extent permitted by law, Incredible You Consultants
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages arising from your use of the
            Platform, including but not limited to loss of revenue, loss of
            data, or business interruption.
          </p>
          <p>
            Our total liability to you for any claim arising from these Terms or
            your use of the Platform shall not exceed the total subscription
            fees you paid to us in the three months preceding the claim.
          </p>
          <p>
            The Platform is provided "as is" without warranties of any kind,
            express or implied. We do not warrant that AI-generated content will
            be error-free, compliant with all advertising policies, or suitable
            for any particular purpose.
          </p>
        </TermsSection>

        <TermsSection number="7" title="Meta Platform Usage">
          <p>
            ZAP Campaigns integrates with the Meta Marketing API to allow you
            to push approved campaign assets to your Meta Ad account. By using
            this feature, you agree to comply with Meta's Advertising Policies
            and Meta's Platform Terms.
          </p>
          <ul>
            <li>
              You are solely responsible for ensuring that any ads published to
              Meta comply with Meta's policies and applicable advertising laws.
            </li>
            <li>
              We access your Meta Ad account only with your explicit OAuth
              authorisation and only to perform actions you have approved within
              the Platform.
            </li>
            <li>
              We are not responsible for any account suspensions, policy
              violations, or ad rejections that occur as a result of content
              pushed to Meta.
            </li>
          </ul>
        </TermsSection>

        <TermsSection number="8" title="Governing Law">
          <p>
            These Terms are governed by and construed in accordance with the
            laws of Australia, without regard to its conflict of law provisions.
            Any disputes arising from these Terms shall be subject to the
            exclusive jurisdiction of the courts of Australia.
          </p>
          <p>
            If any provision of these Terms is found to be unenforceable, the
            remaining provisions will continue in full force and effect.
          </p>
        </TermsSection>

        <TermsSection number="9" title="Contact">
          <p>
            For questions about these Terms, contact us at{" "}
            <a
              href="mailto:support@zapcampaigns.com"
              style={{ color: "#1A1624", fontWeight: 600 }}
            >
              support@zapcampaigns.com
            </a>
            .
          </p>
          <p>
            ZAP Campaigns is operated by{" "}
            <strong>Incredible You Consultants</strong>.
          </p>
        </TermsSection>

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

function TermsSection({
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
