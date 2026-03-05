/**
 * V2Dashboard — Sprint 1 Sandbox
 *
 * This is the isolated /v2-dashboard route.
 * All V2 work happens here. Existing routes are untouched.
 */
import V2Layout from "./V2Layout";

export default function V2Dashboard() {
  return (
    <V2Layout>
      <div className="v2-container v2-section">

        {/* ── Header ── */}
        <header style={{ marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              fontFamily: "var(--v2-font-heading)",
              fontStyle: "italic",
              fontWeight: 900,
              fontSize: "22px",
              color: "var(--v2-text-color)",
              letterSpacing: "-0.02em",
            }}>
              ZAP
            </span>
            <span style={{
              fontFamily: "var(--v2-font-body)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--v2-accent-purple)",
              background: "rgba(139,92,246,0.10)",
              borderRadius: "var(--v2-border-radius-pill)",
              padding: "4px 12px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              V2 Sandbox — Sprint 1
            </span>
          </div>
        </header>

        {/* ── Hero ── */}
        <section style={{ marginBottom: "56px" }}>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", marginBottom: "20px" }}>
            Your campaign,<br />
            <em style={{ color: "var(--v2-primary-btn)" }}>built in minutes.</em>
          </h1>
          <p style={{
            fontFamily: "var(--v2-font-body)",
            fontSize: "18px",
            color: "rgba(26,22,36,0.65)",
            maxWidth: "520px",
            lineHeight: 1.6,
            marginBottom: "32px",
          }}>
            Five sentences in. One hundred and ten marketing assets out.
            ZAP's AI handles the research, the copywriting, and the strategy — automatically.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button className="v2-btn v2-btn-primary">
              Start generating
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="v2-btn v2-btn-secondary">
              See how it works
            </button>
          </div>
        </section>

        {/* ── Design Token Proof Cards ── */}
        <section>
          <h2 style={{ fontSize: "20px", marginBottom: "24px" }}>
            Sprint 1 — Design Token Verification
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "20px",
          }}>

            {/* Background token */}
            <div className="v2-card">
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#F5F1EA", border: "1.5px solid rgba(26,22,36,0.12)", marginBottom: "12px" }} />
              <p style={{ fontWeight: 600, marginBottom: "4px" }}>--v2-bg-color</p>
              <p style={{ fontSize: "13px", color: "rgba(26,22,36,0.55)" }}>#F5F1EA — Warm cream background</p>
            </div>

            {/* Text token */}
            <div className="v2-card">
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#1A1624", marginBottom: "12px" }} />
              <p style={{ fontWeight: 600, marginBottom: "4px" }}>--v2-text-color</p>
              <p style={{ fontSize: "13px", color: "rgba(26,22,36,0.55)" }}>#1A1624 — Deep aubergine text</p>
            </div>

            {/* Primary button token */}
            <div className="v2-card">
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#FF5B1D", marginBottom: "12px" }} />
              <p style={{ fontWeight: 600, marginBottom: "4px" }}>--v2-primary-btn</p>
              <p style={{ fontSize: "13px", color: "rgba(26,22,36,0.55)" }}>#FF5B1D — Burnt orange CTA</p>
            </div>

            {/* Accent purple token */}
            <div className="v2-card">
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#8B5CF6", marginBottom: "12px" }} />
              <p style={{ fontWeight: 600, marginBottom: "4px" }}>--v2-accent-purple</p>
              <p style={{ fontSize: "13px", color: "rgba(26,22,36,0.55)" }}>#8B5CF6 — Accent purple</p>
            </div>

            {/* Border radius card */}
            <div className="v2-card">
              <div style={{ width: "40px", height: "40px", borderRadius: "24px", background: "var(--v2-accent-purple)", marginBottom: "12px" }} />
              <p style={{ fontWeight: 600, marginBottom: "4px" }}>--v2-border-radius-card</p>
              <p style={{ fontSize: "13px", color: "rgba(26,22,36,0.55)" }}>24px — Card corners</p>
            </div>

            {/* Border radius pill */}
            <div className="v2-card">
              <div style={{ width: "80px", height: "32px", borderRadius: "9999px", background: "var(--v2-primary-btn)", marginBottom: "12px" }} />
              <p style={{ fontWeight: 600, marginBottom: "4px" }}>--v2-border-radius-pill</p>
              <p style={{ fontSize: "13px", color: "rgba(26,22,36,0.55)" }}>9999px — Pill buttons</p>
            </div>

          </div>
        </section>

        {/* ── Typography Proof ── */}
        <section style={{ marginTop: "56px" }}>
          <h2 style={{ fontSize: "20px", marginBottom: "24px" }}>Typography Verification</h2>
          <div className="v2-card">
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--v2-accent-purple)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
              Fraunces — Headings (italic, 900)
            </p>
            <h1 style={{ fontSize: "48px", marginBottom: "8px" }}>The quick brown fox</h1>
            <h2 style={{ fontSize: "36px", marginBottom: "8px" }}>jumps over the lazy dog</h2>
            <h3 style={{ fontSize: "24px", marginBottom: "24px" }}>ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</h3>

            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--v2-accent-purple)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
              Instrument Sans — Body
            </p>
            <p style={{ fontSize: "16px", lineHeight: 1.7, color: "rgba(26,22,36,0.75)" }}>
              The quick brown fox jumps over the lazy dog. Five sentences in. One hundred and ten marketing assets out.
              ZAP's AI handles the research, the copywriting, and the strategy — automatically.
            </p>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ marginTop: "80px", paddingTop: "24px", borderTop: "1px solid rgba(26,22,36,0.10)" }}>
          <p style={{ fontSize: "13px", color: "rgba(26,22,36,0.40)" }}>
            ZAP V2 Sandbox · Sprint 1 complete · Existing routes untouched
          </p>
        </footer>

      </div>
    </V2Layout>
  );
}
